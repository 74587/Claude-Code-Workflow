/**
 * CodexLens Routes Module
 * Handles all CodexLens-related API endpoints
 *
 * TODO: Remove @ts-nocheck and add proper types:
 * - Define interfaces for request body types (ConfigBody, CleanBody, InitBody, etc.)
 * - Type error catches: (e: unknown) => { const err = e as Error; ... }
 * - Add null checks for extractJSON results
 * - Type the handlePostRequest callback body parameter
 */
// @ts-nocheck
import type { IncomingMessage, ServerResponse } from 'http';
import {
  checkVenvStatus,
  bootstrapVenv,
  executeCodexLens,
  checkSemanticStatus,
  ensureLiteLLMEmbedderReady,
  installSemantic,
  detectGpuSupport,
  uninstallCodexLens,
  cancelIndexing,
  isIndexingInProgress,
  getVenvPythonPath
} from '../../tools/codex-lens.js';
import type { ProgressInfo, GpuMode } from '../../tools/codex-lens.js';
import { loadLiteLLMApiConfig } from '../../config/litellm-api-config-manager.js';

// File watcher state (persisted across requests)
let watcherProcess: any = null;
let watcherStats = {
  running: false,
  root_path: '',
  events_processed: 0,
  start_time: null as Date | null
};

export interface RouteContext {
  pathname: string;
  url: URL;
  req: IncomingMessage;
  res: ServerResponse;
  initialPath: string;
  handlePostRequest: (req: IncomingMessage, res: ServerResponse, handler: (body: unknown) => Promise<any>) => void;
  broadcastToClients: (data: unknown) => void;
}

/**
 * Strip ANSI color codes from string
 * Rich library adds color codes even with --json flag
 */
function stripAnsiCodes(str: string): string {
  // ANSI escape code pattern: \x1b[...m or \x1b]...
  return str.replace(/\x1b\[[0-9;]*m/g, '')
            .replace(/\x1b\][0-9;]*\x07/g, '')
            .replace(/\x1b\][^\x07]*\x07/g, '');
}

/**
 * Format file size to human readable string
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(i < 2 ? 0 : 1));
  return size + ' ' + units[i];
}

/**
 * Extract JSON from CLI output that may contain logging messages
 * CodexLens CLI outputs logs like "INFO ..." before the JSON
 * Also strips ANSI color codes that Rich library adds
 * Handles trailing content after JSON (e.g., "INFO: Done" messages)
 */
function extractJSON(output: string): any {
  // Strip ANSI color codes first
  const cleanOutput = stripAnsiCodes(output);

  // Find the first { or [ character (start of JSON)
  const jsonStart = cleanOutput.search(/[{\[]/);
  if (jsonStart === -1) {
    throw new Error('No JSON found in output');
  }

  const startChar = cleanOutput[jsonStart];
  const endChar = startChar === '{' ? '}' : ']';

  // Find matching closing brace/bracket using a simple counter
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let jsonEnd = -1;

  for (let i = jsonStart; i < cleanOutput.length; i++) {
    const char = cleanOutput[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === startChar) {
        depth++;
      } else if (char === endChar) {
        depth--;
        if (depth === 0) {
          jsonEnd = i + 1;
          break;
        }
      }
    }
  }

  if (jsonEnd === -1) {
    // Fallback: try to parse from start to end (original behavior)
    const jsonString = cleanOutput.substring(jsonStart);
    return JSON.parse(jsonString);
  }

  const jsonString = cleanOutput.substring(jsonStart, jsonEnd);
  return JSON.parse(jsonString);
}

/**
 * Handle CodexLens routes
 * @returns true if route was handled, false otherwise
 */
export async function handleCodexLensRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath, handlePostRequest, broadcastToClients } = ctx;

  // API: CodexLens Index List - Get all indexed projects with details
  if (pathname === '/api/codexlens/indexes') {
    try {
      // Check if CodexLens is installed first (without auto-installing)
      const venvStatus = await checkVenvStatus();
      if (!venvStatus.ready) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, indexes: [], totalSize: 0, totalSizeFormatted: '0 B' }));
        return true;
      }
      
      // Execute all CLI commands in parallel
      const [configResult, projectsResult, statusResult] = await Promise.all([
        executeCodexLens(['config', '--json']),
        executeCodexLens(['projects', 'list', '--json']),
        executeCodexLens(['status', '--json'])
      ]);
      
      let indexDir = '';
      if (configResult.success) {
        try {
          const config = extractJSON(configResult.output);
          if (config.success && config.result) {
            // CLI returns index_dir (not index_root)
            indexDir = config.result.index_dir || config.result.index_root || '';
          }
        } catch (e) {
          console.error('[CodexLens] Failed to parse config for index list:', e.message);
        }
      }

      let indexes: any[] = [];
      let totalSize = 0;
      let vectorIndexCount = 0;
      let normalIndexCount = 0;

      if (projectsResult.success) {
        try {
          const projectsData = extractJSON(projectsResult.output);
          if (projectsData.success && Array.isArray(projectsData.result)) {
            const { stat, readdir } = await import('fs/promises');
            const { existsSync } = await import('fs');
            const { basename, join } = await import('path');

            for (const project of projectsData.result) {
              // Skip test/temp projects
              if (project.source_root && (
                project.source_root.includes('\\Temp\\') ||
                project.source_root.includes('/tmp/') ||
                project.total_files === 0
              )) {
                continue;
              }

              let projectSize = 0;
              let hasVectorIndex = false;
              let hasNormalIndex = true; // All projects have FTS index
              let lastModified = null;

              // Try to get actual index size from index_root
              if (project.index_root && existsSync(project.index_root)) {
                try {
                  const files = await readdir(project.index_root);
                  for (const file of files) {
                    try {
                      const filePath = join(project.index_root, file);
                      const fileStat = await stat(filePath);
                      projectSize += fileStat.size;
                      if (!lastModified || fileStat.mtime > lastModified) {
                        lastModified = fileStat.mtime;
                      }
                      // Check for vector/embedding files
                      if (file.includes('vector') || file.includes('embedding') ||
                          file.endsWith('.faiss') || file.endsWith('.npy') ||
                          file.includes('semantic_chunks')) {
                        hasVectorIndex = true;
                      }
                    } catch (e) {
                      // Skip files we can't stat
                    }
                  }
                } catch (e) {
                  // Can't read index directory
                }
              }

              if (hasVectorIndex) vectorIndexCount++;
              if (hasNormalIndex) normalIndexCount++;
              totalSize += projectSize;

              // Use source_root as the display name
              const displayName = project.source_root ? basename(project.source_root) : `project_${project.id}`;

              indexes.push({
                id: displayName,
                path: project.source_root || '',
                indexPath: project.index_root || '',
                size: projectSize,
                sizeFormatted: formatSize(projectSize),
                fileCount: project.total_files || 0,
                dirCount: project.total_dirs || 0,
                hasVectorIndex,
                hasNormalIndex,
                status: project.status || 'active',
                lastModified: lastModified ? lastModified.toISOString() : null
              });
            }

            // Sort by file count (most files first), then by name
            indexes.sort((a, b) => {
              if (b.fileCount !== a.fileCount) return b.fileCount - a.fileCount;
              return a.id.localeCompare(b.id);
            });
          }
        } catch (e) {
          console.error('[CodexLens] Failed to parse projects list:', e.message);
        }
      }

      // Parse summary stats from status command (already fetched in parallel)
      let statusSummary: any = {};

      if (statusResult.success) {
        try {
          const status = extractJSON(statusResult.output);
          if (status.success && status.result) {
            statusSummary = {
              totalProjects: status.result.projects_count || indexes.length,
              totalFiles: status.result.total_files || 0,
              totalDirs: status.result.total_dirs || 0,
              // Keep calculated totalSize for consistency with per-project sizes
              // status.index_size_bytes includes shared resources (models, cache)
              indexSizeBytes: totalSize,
              indexSizeMb: totalSize / (1024 * 1024),
              embeddings: status.result.embeddings || {},
              // Store full index dir size separately for reference
              fullIndexDirSize: status.result.index_size_bytes || 0,
              fullIndexDirSizeFormatted: formatSize(status.result.index_size_bytes || 0)
            };
          }
        } catch (e) {
          console.error('[CodexLens] Failed to parse status:', e.message);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        indexDir,
        indexes,
        summary: {
          totalProjects: indexes.length,
          totalSize,
          totalSizeFormatted: formatSize(totalSize),
          vectorIndexCount,
          normalIndexCount,
          ...statusSummary
        }
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return true;
  }

  // API: CodexLens Status
  if (pathname === '/api/codexlens/status') {
    const status = await checkVenvStatus();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
    return true;
  }

  // API: CodexLens Dashboard Init - Aggregated endpoint for page initialization
  if (pathname === '/api/codexlens/dashboard-init') {
    try {
      const venvStatus = await checkVenvStatus();
      
      if (!venvStatus.ready) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          installed: false,
          status: venvStatus,
          config: { index_dir: '~/.codexlens/indexes', index_count: 0 },
          semantic: { available: false }
        }));
        return true;
      }
      
      // Parallel fetch all initialization data
      const [configResult, statusResult, semanticStatus] = await Promise.all([
        executeCodexLens(['config', '--json']),
        executeCodexLens(['status', '--json']),
        checkSemanticStatus()
      ]);
      
      // Parse config
      let config = { index_dir: '~/.codexlens/indexes', index_count: 0 };
      if (configResult.success) {
        try {
          const configData = extractJSON(configResult.output);
          if (configData.success && configData.result) {
            config.index_dir = configData.result.index_dir || configData.result.index_root || config.index_dir;
          }
        } catch (e) {
          console.error('[CodexLens] Failed to parse config for dashboard init:', e.message);
        }
      }
      
      // Parse status
      let statusData: any = {};
      if (statusResult.success) {
        try {
          const status = extractJSON(statusResult.output);
          if (status.success && status.result) {
            config.index_count = status.result.projects_count || 0;
            statusData = status.result;
          }
        } catch (e) {
          console.error('[CodexLens] Failed to parse status for dashboard init:', e.message);
        }
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        installed: true,
        status: venvStatus,
        config,
        semantic: semanticStatus,
        statusData
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return true;
  }

  // API: CodexLens Bootstrap (Install)
  if (pathname === '/api/codexlens/bootstrap' && req.method === 'POST') {
    handlePostRequest(req, res, async () => {
      try {
        const result = await bootstrapVenv();
        if (result.success) {
          const status = await checkVenvStatus();
          // Broadcast installation event
          broadcastToClients({
            type: 'CODEXLENS_INSTALLED',
            payload: { version: status.version, timestamp: new Date().toISOString() }
          });
          return { success: true, message: 'CodexLens installed successfully', version: status.version };
        } else {
          return { success: false, error: result.error, status: 500 };
        }
      } catch (err) {
        return { success: false, error: err.message, status: 500 };
      }
    });
    return true;
  }

  // API: CodexLens Uninstall
  if (pathname === '/api/codexlens/uninstall' && req.method === 'POST') {
    handlePostRequest(req, res, async () => {
      try {
        const result = await uninstallCodexLens();
        if (result.success) {
          // Broadcast uninstallation event
          broadcastToClients({
            type: 'CODEXLENS_UNINSTALLED',
            payload: { timestamp: new Date().toISOString() }
          });
          return { success: true, message: 'CodexLens uninstalled successfully' };
        } else {
          return { success: false, error: result.error, status: 500 };
        }
      } catch (err) {
        return { success: false, error: err.message, status: 500 };
      }
    });
    return true;
  }

  // API: CodexLens Config - GET (Get current configuration with index count)
  if (pathname === '/api/codexlens/config' && req.method === 'GET') {
    try {
      // Check if CodexLens is installed first (without auto-installing)
      const venvStatus = await checkVenvStatus();

      let responseData = { index_dir: '~/.codexlens/indexes', index_count: 0, api_max_workers: 4, api_batch_size: 8 };

      // If not installed, return default config without executing CodexLens
      if (!venvStatus.ready) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseData));
        return true;
      }

      // Fetch both config and status to merge index_count
      const [configResult, statusResult] = await Promise.all([
        executeCodexLens(['config', '--json']),
        executeCodexLens(['status', '--json'])
      ]);

      // Parse config (extract JSON from output that may contain log messages)
      if (configResult.success) {
        try {
          const config = extractJSON(configResult.output);
          if (config.success && config.result) {
            // CLI returns index_dir (not index_root)
            responseData.index_dir = config.result.index_dir || config.result.index_root || responseData.index_dir;
            // Extract API settings
            if (config.result.api_max_workers !== undefined) {
              responseData.api_max_workers = config.result.api_max_workers;
            }
            if (config.result.api_batch_size !== undefined) {
              responseData.api_batch_size = config.result.api_batch_size;
            }
          }
        } catch (e) {
          console.error('[CodexLens] Failed to parse config:', e.message);
          console.error('[CodexLens] Config output:', configResult.output.substring(0, 200));
        }
      }

      // Parse status to get index_count (projects_count)
      if (statusResult.success) {
        try {
          const status = extractJSON(statusResult.output);
          if (status.success && status.result) {
            responseData.index_count = status.result.projects_count || 0;
          }
        } catch (e) {
          console.error('[CodexLens] Failed to parse status:', e.message);
          console.error('[CodexLens] Status output:', statusResult.output.substring(0, 200));
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responseData));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return true;
  }

  // API: CodexLens Config - POST (Set configuration)
  if (pathname === '/api/codexlens/config' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { index_dir, api_max_workers, api_batch_size } = body;

      if (!index_dir) {
        return { success: false, error: 'index_dir is required', status: 400 };
      }

      // Validate index_dir path
      const indexDirStr = String(index_dir).trim();

      // Check for dangerous patterns
      if (indexDirStr.includes('\0')) {
        return { success: false, error: 'Invalid path: contains null bytes', status: 400 };
      }

      // Prevent system root paths and their subdirectories (Windows and Unix)
      const dangerousPaths = ['/', 'C:\\', 'C:/', '/etc', '/usr', '/bin', '/sys', '/proc', '/var',
                              'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)', 'C:\\System32'];
      const normalizedPath = indexDirStr.replace(/\\/g, '/').toLowerCase();
      for (const dangerous of dangerousPaths) {
        const dangerousLower = dangerous.replace(/\\/g, '/').toLowerCase();
        // Block exact match OR any subdirectory (using startsWith)
        if (normalizedPath === dangerousLower ||
            normalizedPath === dangerousLower + '/' ||
            normalizedPath.startsWith(dangerousLower + '/')) {
          return { success: false, error: 'Invalid path: cannot use system directories or their subdirectories', status: 400 };
        }
      }

      // Additional check: prevent path traversal attempts
      if (normalizedPath.includes('../') || normalizedPath.includes('/..')) {
        return { success: false, error: 'Invalid path: path traversal not allowed', status: 400 };
      }

      // Validate api settings
      if (api_max_workers !== undefined) {
        const workers = Number(api_max_workers);
        if (isNaN(workers) || workers < 1 || workers > 32) {
          return { success: false, error: 'api_max_workers must be between 1 and 32', status: 400 };
        }
      }
      if (api_batch_size !== undefined) {
        const batch = Number(api_batch_size);
        if (isNaN(batch) || batch < 1 || batch > 64) {
          return { success: false, error: 'api_batch_size must be between 1 and 64', status: 400 };
        }
      }

      try {
        // Set index_dir
        const result = await executeCodexLens(['config', 'set', 'index_dir', indexDirStr, '--json']);
        if (!result.success) {
          return { success: false, error: result.error || 'Failed to update index_dir', status: 500 };
        }

        // Set API settings if provided
        if (api_max_workers !== undefined) {
          await executeCodexLens(['config', 'set', 'api_max_workers', String(api_max_workers), '--json']);
        }
        if (api_batch_size !== undefined) {
          await executeCodexLens(['config', 'set', 'api_batch_size', String(api_batch_size), '--json']);
        }

        return { success: true, message: 'Configuration updated successfully' };
      } catch (err) {
        return { success: false, error: err.message, status: 500 };
      }
    });
    return true;
  }

  // API: CodexLens Clean (Clean indexes)
  if (pathname === '/api/codexlens/clean' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { all = false, path } = body;

      try {
        const args = ['clean'];
        if (all) {
          args.push('--all');
        } else if (path) {
          // Path is passed as a positional argument, not as a flag
          args.push(path);
        }
        args.push('--json');

        const result = await executeCodexLens(args);
        if (result.success) {
          return { success: true, message: 'Indexes cleaned successfully' };
        } else {
          return { success: false, error: result.error || 'Failed to clean indexes', status: 500 };
        }
      } catch (err) {
        return { success: false, error: err.message, status: 500 };
      }
    });
    return true;
  }

  // API: CodexLens Init (Initialize workspace index)
  if (pathname === '/api/codexlens/init' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { path: projectPath, indexType = 'vector', embeddingModel = 'code', embeddingBackend = 'fastembed', maxWorkers = 1 } = body;
      const targetPath = projectPath || initialPath;

      // Ensure LiteLLM backend dependencies are installed before running the CLI
      if (indexType !== 'normal' && embeddingBackend === 'litellm') {
        const installResult = await ensureLiteLLMEmbedderReady();
        if (!installResult.success) {
          return { success: false, error: installResult.error || 'Failed to prepare LiteLLM embedder', status: 500 };
        }
      }

      // Build CLI arguments based on index type
      const args = ['init', targetPath, '--json'];
      if (indexType === 'normal') {
        args.push('--no-embeddings');
      } else {
        // Add embedding model selection for vector index
        args.push('--embedding-model', embeddingModel);
        // Add embedding backend if not using default fastembed
        if (embeddingBackend && embeddingBackend !== 'fastembed') {
          args.push('--embedding-backend', embeddingBackend);
        }
        // Add max workers for concurrent API calls (useful for litellm backend)
        if (maxWorkers && maxWorkers > 1) {
          args.push('--max-workers', String(maxWorkers));
        }
      }

      // Broadcast start event
      broadcastToClients({
        type: 'CODEXLENS_INDEX_PROGRESS',
        payload: { stage: 'start', message: 'Starting index...', percent: 0, path: targetPath, indexType }
      });

      try {
        const result = await executeCodexLens(args, {
          cwd: targetPath,
          timeout: 1800000, // 30 minutes for large codebases
          onProgress: (progress: ProgressInfo) => {
            // Broadcast progress to all connected clients
            broadcastToClients({
              type: 'CODEXLENS_INDEX_PROGRESS',
              payload: { ...progress, path: targetPath }
            });
          }
        });

        if (result.success) {
          // Broadcast completion
          broadcastToClients({
            type: 'CODEXLENS_INDEX_PROGRESS',
            payload: { stage: 'complete', message: 'Index complete', percent: 100, path: targetPath }
          });

          try {
            const parsed = extractJSON(result.output);
            return { success: true, result: parsed };
          } catch {
            return { success: true, output: result.output };
          }
        } else {
          // Broadcast error
          broadcastToClients({
            type: 'CODEXLENS_INDEX_PROGRESS',
            payload: { stage: 'error', message: result.error || 'Unknown error', percent: 0, path: targetPath }
          });
          return { success: false, error: result.error, status: 500 };
        }
      } catch (err) {
        // Broadcast error
        broadcastToClients({
          type: 'CODEXLENS_INDEX_PROGRESS',
          payload: { stage: 'error', message: err.message, percent: 0, path: targetPath }
        });
        return { success: false, error: err.message, status: 500 };
      }
    });
    return true;
  }

  // API: Cancel CodexLens Indexing
  if (pathname === '/api/codexlens/cancel' && req.method === 'POST') {
    const result = cancelIndexing();

    // Broadcast cancellation event
    if (result.success) {
      broadcastToClients({
        type: 'CODEXLENS_INDEX_PROGRESS',
        payload: { stage: 'cancelled', message: 'Indexing cancelled by user', percent: 0 }
      });
    }

    res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return true;
  }

  // API: Check if indexing is in progress
  if (pathname === '/api/codexlens/indexing-status') {
    const inProgress = isIndexingInProgress();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, inProgress }));
    return true;
  }

  // API: CodexLens Semantic Search Status
  if (pathname === '/api/codexlens/semantic/status') {
    const status = await checkSemanticStatus();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
    return true;
  }

  // API: CodexLens Semantic Metadata List
  if (pathname === '/api/codexlens/semantic/metadata') {
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const tool = url.searchParams.get('tool') || '';
    const projectPath = url.searchParams.get('path') || initialPath;

    try {
      const args = [
        'semantic-list',
        '--path', projectPath,
        '--offset', offset.toString(),
        '--limit', limit.toString(),
        '--json'
      ];
      if (tool) {
        args.push('--tool', tool);
      }

      const result = await executeCodexLens(args, { cwd: projectPath });

      if (result.success) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(result.output);
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: result.error }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return true;
  }

  // API: CodexLens LLM Enhancement (run enhance command)
  if (pathname === '/api/codexlens/enhance' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { path: projectPath, tool = 'gemini', batchSize = 5, timeoutMs = 300000 } = body;
      const targetPath = projectPath || initialPath;

      try {
        const args = ['enhance', targetPath, '--tool', tool, '--batch-size', batchSize.toString()];
        const result = await executeCodexLens(args, { cwd: targetPath, timeout: timeoutMs + 30000 });
        if (result.success) {
          try {
            const parsed = extractJSON(result.output);
            return { success: true, result: parsed };
          } catch {
            return { success: true, output: result.output };
          }
        } else {
          return { success: false, error: result.error, status: 500 };
        }
      } catch (err) {
        return { success: false, error: err.message, status: 500 };
      }
    });
    return true;
  }


  // API: CodexLens Search (FTS5 text search with mode support)
  if (pathname === '/api/codexlens/search') {
    const query = url.searchParams.get('query') || '';
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const mode = url.searchParams.get('mode') || 'exact';  // exact, fuzzy, hybrid, vector
    const maxContentLength = parseInt(url.searchParams.get('max_content_length') || '200', 10);
    const extraFilesCount = parseInt(url.searchParams.get('extra_files_count') || '10', 10);
    const projectPath = url.searchParams.get('path') || initialPath;

    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Query parameter is required' }));
      return true;
    }

    try {
      // Request more results to support split (full content + extra files)
      const totalToFetch = limit + extraFilesCount;
      const args = ['search', query, '--path', projectPath, '--limit', totalToFetch.toString(), '--mode', mode, '--json'];

      const result = await executeCodexLens(args, { cwd: projectPath });

      if (result.success) {
        try {
          const parsed = extractJSON(result.output);
          const allResults = parsed.result?.results || [];

          // Truncate content and split results
          const truncateContent = (content: string | null | undefined): string => {
            if (!content) return '';
            if (content.length <= maxContentLength) return content;
            return content.slice(0, maxContentLength) + '...';
          };

          // Split results: first N with full content, rest as file paths only
          const resultsWithContent = allResults.slice(0, limit).map((r: any) => ({
            ...r,
            content: truncateContent(r.content || r.excerpt),
            excerpt: truncateContent(r.excerpt || r.content),
          }));

          const extraResults = allResults.slice(limit, limit + extraFilesCount);
          const extraFiles = [...new Set(extraResults.map((r: any) => r.path || r.file))];

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            results: resultsWithContent,
            extra_files: extraFiles.length > 0 ? extraFiles : undefined,
            metadata: {
              total: allResults.length,
              limit,
              max_content_length: maxContentLength,
              extra_files_count: extraFilesCount,
            },
          }));
        } catch {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, results: [], output: result.output }));
        }
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: result.error }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return true;
  }

  // API: CodexLens Search Files Only (return file paths only, with mode support)
  if (pathname === '/api/codexlens/search_files') {
    const query = url.searchParams.get('query') || '';
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const mode = url.searchParams.get('mode') || 'exact';  // exact, fuzzy, hybrid, vector
    const projectPath = url.searchParams.get('path') || initialPath;

    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Query parameter is required' }));
      return true;
    }

    try {
      const args = ['search', query, '--path', projectPath, '--limit', limit.toString(), '--mode', mode, '--files-only', '--json'];

      const result = await executeCodexLens(args, { cwd: projectPath });

      if (result.success) {
        try {
          const parsed = extractJSON(result.output);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, ...parsed.result }));
        } catch {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, files: [], output: result.output }));
        }
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: result.error }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return true;
  }

  // API: CodexLens Symbol Search (search for symbols by name)
  if (pathname === '/api/codexlens/symbol') {
    const query = url.searchParams.get('query') || '';
    const file = url.searchParams.get('file');
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const projectPath = url.searchParams.get('path') || initialPath;

    if (!query && !file) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Either query or file parameter is required' }));
      return true;
    }

    try {
      let args;
      if (file) {
        // Get symbols from a specific file
        args = ['symbol', '--file', file, '--json'];
      } else {
        // Search for symbols by name
        args = ['symbol', query, '--path', projectPath, '--limit', limit.toString(), '--json'];
      }

      const result = await executeCodexLens(args, { cwd: projectPath });

      if (result.success) {
        try {
          const parsed = extractJSON(result.output);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, ...parsed.result }));
        } catch {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, symbols: [], output: result.output }));
        }
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: result.error }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return true;
  }


  // API: Detect GPU support for semantic search
  if (pathname === '/api/codexlens/gpu/detect' && req.method === 'GET') {
    try {
      const gpuInfo = await detectGpuSupport();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...gpuInfo }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return true;
  }

  // API: List available GPU devices for selection
  if (pathname === '/api/codexlens/gpu/list' && req.method === 'GET') {
    try {
      // Check if CodexLens is installed first (without auto-installing)
      const venvStatus = await checkVenvStatus();
      if (!venvStatus.ready) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, devices: [], selected_device_id: null }));
        return true;
      }
      const result = await executeCodexLens(['gpu-list', '--json']);
      if (result.success) {
        try {
          const parsed = extractJSON(result.output);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(parsed));
        } catch {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, devices: [], output: result.output }));
        }
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: result.error }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return true;
  }

  // API: Select GPU device for embedding
  if (pathname === '/api/codexlens/gpu/select' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { device_id } = body;

      if (device_id === undefined || device_id === null) {
        return { success: false, error: 'device_id is required', status: 400 };
      }

      try {
        const result = await executeCodexLens(['gpu-select', String(device_id), '--json']);
        if (result.success) {
          try {
            const parsed = extractJSON(result.output);
            return parsed;
          } catch {
            return { success: true, message: 'GPU selected', output: result.output };
          }
        } else {
          return { success: false, error: result.error, status: 500 };
        }
      } catch (err) {
        return { success: false, error: err.message, status: 500 };
      }
    });
    return true;
  }

  // API: Reset GPU selection to auto-detection
  if (pathname === '/api/codexlens/gpu/reset' && req.method === 'POST') {
    handlePostRequest(req, res, async () => {
      try {
        const result = await executeCodexLens(['gpu-reset', '--json']);
        if (result.success) {
          try {
            const parsed = extractJSON(result.output);
            return parsed;
          } catch {
            return { success: true, message: 'GPU selection reset', output: result.output };
          }
        } else {
          return { success: false, error: result.error, status: 500 };
        }
      } catch (err) {
        return { success: false, error: err.message, status: 500 };
      }
    });
    return true;
  }

  // API: CodexLens Semantic Search Install (with GPU mode support)
  if (pathname === '/api/codexlens/semantic/install' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      try {
        // Get GPU mode from request body, default to 'cpu'
        const gpuMode: GpuMode = body?.gpuMode || 'cpu';
        const validModes: GpuMode[] = ['cpu', 'cuda', 'directml'];

        if (!validModes.includes(gpuMode)) {
          return { success: false, error: `Invalid GPU mode: ${gpuMode}. Valid modes: ${validModes.join(', ')}`, status: 400 };
        }

        const result = await installSemantic(gpuMode);
        if (result.success) {
          const status = await checkSemanticStatus();
          const modeDescriptions = {
            cpu: 'CPU (ONNX Runtime)',
            cuda: 'NVIDIA CUDA GPU',
            directml: 'Windows DirectML GPU'
          };
          return {
            success: true,
            message: `Semantic search installed successfully with ${modeDescriptions[gpuMode]}`,
            gpuMode,
            ...status
          };
        } else {
          return { success: false, error: result.error, status: 500 };
        }
      } catch (err) {
        return { success: false, error: err.message, status: 500 };
      }
    });
    return true;
  }

  // API: CodexLens Model List (list available embedding models)
  if (pathname === '/api/codexlens/models' && req.method === 'GET') {
    try {
      // Check if CodexLens is installed first (without auto-installing)
      const venvStatus = await checkVenvStatus();
      if (!venvStatus.ready) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'CodexLens not installed' }));
        return true;
      }
      const result = await executeCodexLens(['model-list', '--json']);
      if (result.success) {
        try {
          const parsed = extractJSON(result.output);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(parsed));
        } catch {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, result: { models: [] }, output: result.output }));
        }
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: result.error }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return true;
  }

  // API: CodexLens Model Download (download embedding model by profile)
  if (pathname === '/api/codexlens/models/download' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { profile } = body;

      if (!profile) {
        return { success: false, error: 'profile is required', status: 400 };
      }

      try {
        const result = await executeCodexLens(['model-download', profile, '--json'], { timeout: 600000 }); // 10 min for download
        if (result.success) {
          try {
            const parsed = extractJSON(result.output);
            return { success: true, ...parsed };
          } catch {
            return { success: true, output: result.output };
          }
        } else {
          return { success: false, error: result.error, status: 500 };
        }
      } catch (err) {
        return { success: false, error: err.message, status: 500 };
      }
    });
    return true;
  }

  // API: CodexLens Model Delete (delete embedding model by profile)
  if (pathname === '/api/codexlens/models/delete' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { profile } = body;

      if (!profile) {
        return { success: false, error: 'profile is required', status: 400 };
      }

      try {
        const result = await executeCodexLens(['model-delete', profile, '--json']);
        if (result.success) {
          try {
            const parsed = extractJSON(result.output);
            return { success: true, ...parsed };
          } catch {
            return { success: true, output: result.output };
          }
        } else {
          return { success: false, error: result.error, status: 500 };
        }
      } catch (err) {
        return { success: false, error: err.message, status: 500 };
      }
    });
    return true;
  }

  // API: CodexLens Model Info (get model info by profile)
  if (pathname === '/api/codexlens/models/info' && req.method === 'GET') {
    const profile = url.searchParams.get('profile');

    if (!profile) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'profile parameter is required' }));
      return true;
    }

    try {
      const result = await executeCodexLens(['model-info', profile, '--json']);
      if (result.success) {
        try {
          const parsed = extractJSON(result.output);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(parsed));
        } catch {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Failed to parse response' }));
        }
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: result.error }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return true;
  }

  // ============================================================
  // RERANKER CONFIGURATION ENDPOINTS
  // ============================================================

  // API: Get Reranker Configuration
  if (pathname === '/api/codexlens/reranker/config' && req.method === 'GET') {
    try {
      const venvStatus = await checkVenvStatus();

      // Default reranker config (matches fastembed default)
      const rerankerConfig = {
        backend: 'fastembed',
        model_name: 'Xenova/ms-marco-MiniLM-L-6-v2',
        api_provider: 'siliconflow',
        api_key_set: false,
        available_backends: ['onnx', 'api', 'litellm', 'legacy'],
        api_providers: ['siliconflow', 'cohere', 'jina'],
        litellm_endpoints: [] as string[],
        config_source: 'default'
      };

      // Load LiteLLM endpoints for dropdown
      try {
        const litellmConfig = loadLiteLLMApiConfig(initialPath);
        if (litellmConfig.endpoints && Array.isArray(litellmConfig.endpoints)) {
          rerankerConfig.litellm_endpoints = litellmConfig.endpoints.map(
            (ep: any) => ep.alias || ep.name || ep.baseUrl
          ).filter(Boolean);
        }
      } catch (e) {
        // LiteLLM config not available, continue with empty endpoints
      }

      // If CodexLens is installed, try to get actual config
      if (venvStatus.ready) {
        try {
          const result = await executeCodexLens(['config', '--json']);
          if (result.success) {
            const config = extractJSON(result.output);
            if (config.success && config.result) {
              // Map config values
              if (config.result.reranker_backend) {
                rerankerConfig.backend = config.result.reranker_backend;
                rerankerConfig.config_source = 'codexlens';
              }
              if (config.result.reranker_model) {
                rerankerConfig.model_name = config.result.reranker_model;
              }
              if (config.result.reranker_api_provider) {
                rerankerConfig.api_provider = config.result.reranker_api_provider;
              }
              // Check if API key is set (from env)
              if (process.env.RERANKER_API_KEY) {
                rerankerConfig.api_key_set = true;
              }
            }
          }
        } catch (e) {
          console.error('[CodexLens] Failed to get reranker config:', e);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...rerankerConfig }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return true;
  }

  // API: Set Reranker Configuration
  if (pathname === '/api/codexlens/reranker/config' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { backend, model_name, api_provider, api_key, litellm_endpoint } = body;

      // Validate backend
      const validBackends = ['onnx', 'api', 'litellm', 'legacy'];
      if (backend && !validBackends.includes(backend)) {
        return { success: false, error: `Invalid backend: ${backend}. Valid options: ${validBackends.join(', ')}`, status: 400 };
      }

      // Validate api_provider
      const validProviders = ['siliconflow', 'cohere', 'jina'];
      if (api_provider && !validProviders.includes(api_provider)) {
        return { success: false, error: `Invalid api_provider: ${api_provider}. Valid options: ${validProviders.join(', ')}`, status: 400 };
      }

      try {
        const updates: string[] = [];

        // Set backend
        if (backend) {
          const result = await executeCodexLens(['config', 'set', 'reranker_backend', backend, '--json']);
          if (result.success) updates.push('backend');
        }

        // Set model
        if (model_name) {
          const result = await executeCodexLens(['config', 'set', 'reranker_model', model_name, '--json']);
          if (result.success) updates.push('model_name');
        }

        // Set API provider
        if (api_provider) {
          const result = await executeCodexLens(['config', 'set', 'reranker_api_provider', api_provider, '--json']);
          if (result.success) updates.push('api_provider');
        }

        // Set LiteLLM endpoint
        if (litellm_endpoint) {
          const result = await executeCodexLens(['config', 'set', 'reranker_litellm_endpoint', litellm_endpoint, '--json']);
          if (result.success) updates.push('litellm_endpoint');
        }

        // Handle API key - write to .env file or environment
        if (api_key) {
          // For security, we store in process.env for the current session
          // In production, this should be written to a secure .env file
          process.env.RERANKER_API_KEY = api_key;
          updates.push('api_key');
        }

        return {
          success: true,
          message: `Updated: ${updates.join(', ')}`,
          updated_fields: updates
        };
      } catch (err) {
        return { success: false, error: err.message, status: 500 };
      }
    });
    return true;
  }

  // ============================================================
  // FILE WATCHER CONTROL ENDPOINTS
  // ============================================================

  // API: Get File Watcher Status
  if (pathname === '/api/codexlens/watch/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      running: watcherStats.running,
      root_path: watcherStats.root_path,
      events_processed: watcherStats.events_processed,
      start_time: watcherStats.start_time?.toISOString() || null,
      uptime_seconds: watcherStats.start_time
        ? Math.floor((Date.now() - watcherStats.start_time.getTime()) / 1000)
        : 0
    }));
    return true;
  }

  // API: Start File Watcher
  if (pathname === '/api/codexlens/watch/start' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { path: watchPath, debounce_ms = 1000 } = body;
      const targetPath = watchPath || initialPath;

      if (watcherStats.running) {
        return { success: false, error: 'Watcher already running', status: 400 };
      }

      try {
        const { spawn } = await import('child_process');
        const { join } = await import('path');
        const { existsSync, statSync } = await import('fs');

        // Validate path exists and is a directory
        if (!existsSync(targetPath)) {
          return { success: false, error: `Path does not exist: ${targetPath}`, status: 400 };
        }
        const pathStat = statSync(targetPath);
        if (!pathStat.isDirectory()) {
          return { success: false, error: `Path is not a directory: ${targetPath}`, status: 400 };
        }

        // Get the codexlens CLI path
        const venvStatus = await checkVenvStatus();
        if (!venvStatus.ready) {
          return { success: false, error: 'CodexLens not installed', status: 400 };
        }

        // Verify directory is indexed before starting watcher
        try {
          const statusResult = await executeCodexLens(['projects', 'list', '--json']);
          if (statusResult.success && statusResult.stdout) {
            const parsed = extractJSON(statusResult.stdout);
            const projects = parsed.result || parsed || [];
            const normalizedTarget = targetPath.toLowerCase().replace(/\\/g, '/');
            const isIndexed = Array.isArray(projects) && projects.some((p: { source_root: string }) =>
              p.source_root && p.source_root.toLowerCase().replace(/\\/g, '/') === normalizedTarget
            );
            if (!isIndexed) {
              return {
                success: false,
                error: `Directory is not indexed: ${targetPath}. Run 'codexlens init' first.`,
                status: 400
              };
            }
          }
        } catch (err) {
          console.warn('[CodexLens] Could not verify index status:', err);
          // Continue anyway - watcher will fail with proper error if not indexed
        }

        // Spawn watch process using Python (no shell: true for security)
        // CodexLens is a Python package, must run via python -m codexlens
        const pythonPath = getVenvPythonPath();
        const args = ['-m', 'codexlens', 'watch', targetPath, '--debounce', String(debounce_ms)];
        watcherProcess = spawn(pythonPath, args, {
          cwd: targetPath,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env }
        });

        watcherStats = {
          running: true,
          root_path: targetPath,
          events_processed: 0,
          start_time: new Date()
        };

        // Capture stderr for error messages (capped at 4KB to prevent memory leak)
        const MAX_STDERR_SIZE = 4096;
        let stderrBuffer = '';
        if (watcherProcess.stderr) {
          watcherProcess.stderr.on('data', (data: Buffer) => {
            stderrBuffer += data.toString();
            // Cap buffer size to prevent memory leak in long-running watchers
            if (stderrBuffer.length > MAX_STDERR_SIZE) {
              stderrBuffer = stderrBuffer.slice(-MAX_STDERR_SIZE);
            }
          });
        }

        // Handle process output for event counting
        if (watcherProcess.stdout) {
          watcherProcess.stdout.on('data', (data: Buffer) => {
            const output = data.toString();
            // Count processed events from output
            const matches = output.match(/Processed \d+ events?/g);
            if (matches) {
              watcherStats.events_processed += matches.length;
            }
          });
        }

        // Handle spawn errors (e.g., ENOENT)
        watcherProcess.on('error', (err: Error) => {
          console.error(`[CodexLens] Watcher spawn error: ${err.message}`);
          watcherStats.running = false;
          watcherProcess = null;
          broadcastToClients({
            type: 'CODEXLENS_WATCHER_STATUS',
            payload: { running: false, error: `Spawn error: ${err.message}` }
          });
        });

        // Handle process exit
        watcherProcess.on('exit', (code: number) => {
          watcherStats.running = false;
          watcherProcess = null;
          console.log(`[CodexLens] Watcher exited with code ${code}`);

          // Broadcast error if exited with non-zero code
          if (code !== 0) {
            const errorMsg = stderrBuffer.trim() || `Exited with code ${code}`;
            // Use stripAnsiCodes helper for consistent ANSI cleanup
            const cleanError = stripAnsiCodes(errorMsg);
            broadcastToClients({
              type: 'CODEXLENS_WATCHER_STATUS',
              payload: { running: false, error: cleanError }
            });
          } else {
            broadcastToClients({
              type: 'CODEXLENS_WATCHER_STATUS',
              payload: { running: false }
            });
          }
        });

        // Broadcast watcher started
        broadcastToClients({
          type: 'CODEXLENS_WATCHER_STATUS',
          payload: { running: true, path: targetPath }
        });

        return {
          success: true,
          message: 'Watcher started',
          path: targetPath,
          pid: watcherProcess.pid
        };
      } catch (err) {
        return { success: false, error: err.message, status: 500 };
      }
    });
    return true;
  }

  // API: Stop File Watcher
  if (pathname === '/api/codexlens/watch/stop' && req.method === 'POST') {
    handlePostRequest(req, res, async () => {
      if (!watcherStats.running || !watcherProcess) {
        return { success: false, error: 'Watcher not running', status: 400 };
      }

      try {
        // Send SIGTERM to gracefully stop the watcher
        watcherProcess.kill('SIGTERM');

        // Wait a moment for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 500));

        // Force kill if still running
        if (watcherProcess && !watcherProcess.killed) {
          watcherProcess.kill('SIGKILL');
        }

        const finalStats = {
          events_processed: watcherStats.events_processed,
          uptime_seconds: watcherStats.start_time
            ? Math.floor((Date.now() - watcherStats.start_time.getTime()) / 1000)
            : 0
        };

        watcherStats = {
          running: false,
          root_path: '',
          events_processed: 0,
          start_time: null
        };
        watcherProcess = null;

        // Broadcast watcher stopped
        broadcastToClients({
          type: 'CODEXLENS_WATCHER_STATUS',
          payload: { running: false }
        });

        return {
          success: true,
          message: 'Watcher stopped',
          ...finalStats
        };
      } catch (err) {
        return { success: false, error: err.message, status: 500 };
      }
    });
    return true;
  }


  // ============================================================
  // SPLADE ENDPOINTS
  // ============================================================

  // API: SPLADE Status - Check if SPLADE is available and installed
  if (pathname === '/api/codexlens/splade/status') {
    try {
      // Check if CodexLens is installed first
      const venvStatus = await checkVenvStatus();
      if (!venvStatus.ready) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          available: false,
          installed: false,
          model: 'naver/splade-cocondenser-ensembledistil',
          error: 'CodexLens not installed'
        }));
        return true;
      }

      // Check SPLADE availability using Python check
      const result = await executeCodexLens(['python', '-c',
        'from codexlens.semantic.splade_encoder import check_splade_available; ok, err = check_splade_available(); print("OK" if ok else err)'
      ]);

      const available = result.output.includes('OK');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        available,
        installed: available,
        model: 'naver/splade-cocondenser-ensembledistil',
        error: available ? null : result.output.trim()
      }));
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        available: false,
        installed: false,
        model: 'naver/splade-cocondenser-ensembledistil',
        error: err.message
      }));
    }
    return true;
  }

  // API: SPLADE Install - Install SPLADE dependencies
  if (pathname === '/api/codexlens/splade/install' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      try {
        const gpu = body?.gpu || false;
        const packageName = gpu ? 'codex-lens[splade-gpu]' : 'codex-lens[splade]';

        // Use pip to install the SPLADE extras
        const { spawn } = await import('child_process');
        const { promisify } = await import('util');
        const execFilePromise = promisify(require('child_process').execFile);

        const result = await execFilePromise('pip', ['install', packageName], {
          timeout: 600000 // 10 minutes
        });

        return {
          success: true,
          message: `SPLADE installed successfully (${gpu ? 'GPU' : 'CPU'} mode)`,
          output: result.stdout
        };
      } catch (err) {
        return {
          success: false,
          error: err.message,
          stderr: err.stderr,
          status: 500
        };
      }
    });
    return true;
  }

  // API: SPLADE Index Status - Check if SPLADE index exists for a project
  if (pathname === '/api/codexlens/splade/index-status') {
    try {
      const projectPath = url.searchParams.get('path');
      if (!projectPath) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Missing path parameter' }));
        return true;
      }

      // Check if CodexLens is installed first
      const venvStatus = await checkVenvStatus();
      if (!venvStatus.ready) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ exists: false, error: 'CodexLens not installed' }));
        return true;
      }

      const { join } = await import('path');
      const indexDb = join(projectPath, '.codexlens', '_index.db');

      // Use Python to check SPLADE index status
      const pythonCode = `
from codexlens.storage.splade_index import SpladeIndex
from pathlib import Path
try:
    idx = SpladeIndex(Path("${indexDb.replace(/\\/g, '\\\\')}"))
    if idx.has_index():
        stats = idx.get_stats()
        meta = idx.get_metadata()
        model = meta.get('model_name', '') if meta else ''
        print(f"OK|{stats['unique_chunks']}|{stats['total_postings']}|{model}")
    else:
        print("NO_INDEX")
except Exception as e:
    print(f"ERROR|{str(e)}")
`;

      const result = await executeCodexLens(['python', '-c', pythonCode]);

      if (result.output.startsWith('OK|')) {
        const parts = result.output.trim().split('|');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          exists: true,
          chunks: parseInt(parts[1]),
          postings: parseInt(parts[2]),
          model: parts[3]
        }));
      } else if (result.output.startsWith('ERROR|')) {
        const errorMsg = result.output.substring(6).trim();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ exists: false, error: errorMsg }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ exists: false }));
      }
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ exists: false, error: err.message }));
    }
    return true;
  }

  // API: SPLADE Index Rebuild - Rebuild SPLADE index for a project
  if (pathname === '/api/codexlens/splade/rebuild' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { path: projectPath } = body;

      if (!projectPath) {
        return { success: false, error: 'Missing path parameter', status: 400 };
      }

      try {
        const result = await executeCodexLens(['splade-index', projectPath, '--rebuild'], {
          cwd: projectPath,
          timeout: 1800000 // 30 minutes for large codebases
        });

        if (result.success) {
          return {
            success: true,
            message: 'SPLADE index rebuilt successfully',
            output: result.output
          };
        } else {
          return {
            success: false,
            error: result.error || 'Failed to rebuild SPLADE index',
            output: result.output,
            status: 500
          };
        }
      } catch (err) {
        return { success: false, error: err.message, status: 500 };
      }
    });
    return true;
  }

  // ============================================================
  // ENV FILE MANAGEMENT ENDPOINTS
  // ============================================================

  // API: Get global env file content
  if (pathname === '/api/codexlens/env' && req.method === 'GET') {
    try {
      const { homedir } = await import('os');
      const { join } = await import('path');
      const { readFile } = await import('fs/promises');

      const envPath = join(homedir(), '.codexlens', '.env');
      let content = '';
      try {
        content = await readFile(envPath, 'utf-8');
      } catch (e) {
        // File doesn't exist, return empty
      }

      // Parse env file into key-value pairs (robust parsing)
      const envVars: Record<string, string> = {};
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) continue;

        // Find first = that's part of key=value (not in a quote)
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex <= 0) continue;

        const key = trimmed.substring(0, eqIndex).trim();
        // Validate key format (alphanumeric + underscore)
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

        let value = trimmed.substring(eqIndex + 1);

        // Handle quoted values (preserves = inside quotes)
        if (value.startsWith('"')) {
          // Find matching closing quote (handle escaped quotes)
          let end = 1;
          while (end < value.length) {
            if (value[end] === '"' && value[end - 1] !== '\\') break;
            end++;
          }
          value = value.substring(1, end).replace(/\\"/g, '"');
        } else if (value.startsWith("'")) {
          // Single quotes don't support escaping
          const end = value.indexOf("'", 1);
          value = end > 0 ? value.substring(1, end) : value.substring(1);
        } else {
          // Unquoted: trim and take until comment or end
          const commentIndex = value.indexOf(' #');
          if (commentIndex > 0) {
            value = value.substring(0, commentIndex);
          }
          value = value.trim();
        }

        envVars[key] = value;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        path: envPath,
        env: envVars,
        raw: content
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return true;
  }

  // API: Save global env file content (merge mode - preserves existing values)
  if (pathname === '/api/codexlens/env' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { env } = body as { env: Record<string, string> };

      if (!env || typeof env !== 'object') {
        return { success: false, error: 'env object is required', status: 400 };
      }

      try {
        const { homedir } = await import('os');
        const { join, dirname } = await import('path');
        const { writeFile, mkdir, readFile } = await import('fs/promises');

        const envPath = join(homedir(), '.codexlens', '.env');
        await mkdir(dirname(envPath), { recursive: true });

        // Read existing env file to preserve custom variables
        let existingEnv: Record<string, string> = {};
        let existingComments: string[] = [];
        try {
          const content = await readFile(envPath, 'utf-8');
          const lines = content.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            // Preserve comment lines that aren't our headers
            if (trimmed.startsWith('#') && !trimmed.includes('Managed by CCW')) {
              if (!trimmed.includes('Reranker API') && !trimmed.includes('Embedding API') &&
                  !trimmed.includes('LiteLLM Config') && !trimmed.includes('CodexLens Settings') &&
                  !trimmed.includes('Other Settings') && !trimmed.includes('CodexLens Environment')) {
                existingComments.push(line);
              }
            }
            if (!trimmed || trimmed.startsWith('#')) continue;

            // Robust parsing (same as GET handler)
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex <= 0) continue;

            const key = trimmed.substring(0, eqIndex).trim();
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

            let value = trimmed.substring(eqIndex + 1);
            if (value.startsWith('"')) {
              let end = 1;
              while (end < value.length) {
                if (value[end] === '"' && value[end - 1] !== '\\') break;
                end++;
              }
              value = value.substring(1, end).replace(/\\"/g, '"');
            } else if (value.startsWith("'")) {
              const end = value.indexOf("'", 1);
              value = end > 0 ? value.substring(1, end) : value.substring(1);
            } else {
              const commentIndex = value.indexOf(' #');
              if (commentIndex > 0) value = value.substring(0, commentIndex);
              value = value.trim();
            }
            existingEnv[key] = value;
          }
        } catch (e) {
          // File doesn't exist, start fresh
        }

        // Merge: update known keys from payload, preserve unknown keys
        const knownKeys = new Set([
          'RERANKER_API_KEY', 'RERANKER_API_BASE', 'RERANKER_MODEL',
          'EMBEDDING_API_KEY', 'EMBEDDING_API_BASE', 'EMBEDDING_MODEL',
          'LITELLM_API_KEY', 'LITELLM_API_BASE', 'LITELLM_MODEL'
        ]);

        // Apply updates from payload
        for (const [key, value] of Object.entries(env)) {
          if (value) {
            existingEnv[key] = value;
          } else if (knownKeys.has(key)) {
            // Remove known key if value is empty
            delete existingEnv[key];
          }
        }

        // Build env file content
        const lines = [
          '# CodexLens Environment Configuration',
          '# Managed by CCW Dashboard',
          ''
        ];

        // Add preserved custom comments
        if (existingComments.length > 0) {
          lines.push(...existingComments, '');
        }

        // Group by prefix
        const groups: Record<string, string[]> = {
          'RERANKER': [],
          'EMBEDDING': [],
          'LITELLM': [],
          'CODEXLENS': [],
          'OTHER': []
        };

        for (const [key, value] of Object.entries(existingEnv)) {
          if (!value) continue;
          // SECURITY: Escape special characters to prevent .env injection
          const escapedValue = value
            .replace(/\\/g, '\\\\')  // Escape backslashes first
            .replace(/"/g, '\\"')    // Escape double quotes
            .replace(/\n/g, '\\n')   // Escape newlines
            .replace(/\r/g, '\\r');  // Escape carriage returns
          const line = `${key}="${escapedValue}"`;
          if (key.startsWith('RERANKER_')) groups['RERANKER'].push(line);
          else if (key.startsWith('EMBEDDING_')) groups['EMBEDDING'].push(line);
          else if (key.startsWith('LITELLM_')) groups['LITELLM'].push(line);
          else if (key.startsWith('CODEXLENS_')) groups['CODEXLENS'].push(line);
          else groups['OTHER'].push(line);
        }

        // Add grouped content
        if (groups['RERANKER'].length) {
          lines.push('# Reranker API Configuration');
          lines.push(...groups['RERANKER'], '');
        }
        if (groups['EMBEDDING'].length) {
          lines.push('# Embedding API Configuration');
          lines.push(...groups['EMBEDDING'], '');
        }
        if (groups['LITELLM'].length) {
          lines.push('# LiteLLM Configuration');
          lines.push(...groups['LITELLM'], '');
        }
        if (groups['CODEXLENS'].length) {
          lines.push('# CodexLens Settings');
          lines.push(...groups['CODEXLENS'], '');
        }
        if (groups['OTHER'].length) {
          lines.push('# Other Settings');
          lines.push(...groups['OTHER'], '');
        }

        await writeFile(envPath, lines.join('\n'), 'utf-8');

        return {
          success: true,
          message: 'Environment configuration saved',
          path: envPath
        };
      } catch (err) {
        return { success: false, error: err.message, status: 500 };
      }
    });
    return true;
  }

  return false;
}
