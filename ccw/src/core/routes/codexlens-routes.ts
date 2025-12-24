// @ts-nocheck
/**
 * CodexLens Routes Module
 * Handles all CodexLens-related API endpoints
 */
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
  isIndexingInProgress
} from '../../tools/codex-lens.js';
import type { ProgressInfo, GpuMode } from '../../tools/codex-lens.js';

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
 */
function extractJSON(output: string): any {
  // Strip ANSI color codes first
  const cleanOutput = stripAnsiCodes(output);

  // Find the first { or [ character (start of JSON)
  const jsonStart = cleanOutput.search(/[{\[]/);
  if (jsonStart === -1) {
    throw new Error('No JSON found in output');
  }

  // Extract everything from the first { or [ onwards
  const jsonString = cleanOutput.substring(jsonStart);
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
      // Get config for index directory path
      const configResult = await executeCodexLens(['config', '--json']);
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

      // Get project list using 'projects list' command
      const projectsResult = await executeCodexLens(['projects', 'list', '--json']);
      let indexes: any[] = [];
      let totalSize = 0;
      let vectorIndexCount = 0;
      let normalIndexCount = 0;

      if (projectsResult.success) {
        try {
          const projectsData = extractJSON(projectsResult.output);
          if (projectsData.success && Array.isArray(projectsData.result)) {
            const { statSync, existsSync } = await import('fs');
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
                  const { readdirSync } = await import('fs');
                  const files = readdirSync(project.index_root);
                  for (const file of files) {
                    try {
                      const filePath = join(project.index_root, file);
                      const stat = statSync(filePath);
                      projectSize += stat.size;
                      if (!lastModified || stat.mtime > lastModified) {
                        lastModified = stat.mtime;
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

      // Also get summary stats from status command
      const statusResult = await executeCodexLens(['status', '--json']);
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

      let responseData = { index_dir: '~/.codexlens/indexes', index_count: 0 };

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
      const { index_dir } = body;

      if (!index_dir) {
        return { success: false, error: 'index_dir is required', status: 400 };
      }

      try {
        const result = await executeCodexLens(['config', 'set', 'index_dir', index_dir, '--json']);
        if (result.success) {
          return { success: true, message: 'Configuration updated successfully' };
        } else {
          return { success: false, error: result.error || 'Failed to update configuration', status: 500 };
        }
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
    const projectPath = url.searchParams.get('path') || initialPath;

    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Query parameter is required' }));
      return true;
    }

    try {
      const args = ['search', query, '--path', projectPath, '--limit', limit.toString(), '--mode', mode, '--json'];

      const result = await executeCodexLens(args, { cwd: projectPath });

      if (result.success) {
        try {
          const parsed = extractJSON(result.output);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, ...parsed.result }));
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

  return false;
}
