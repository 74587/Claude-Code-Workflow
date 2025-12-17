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
  installSemantic,
  uninstallCodexLens
} from '../../tools/codex-lens.js';
import type { ProgressInfo } from '../../tools/codex-lens.js';

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
      // Fetch both config and status to merge index_count
      const [configResult, statusResult] = await Promise.all([
        executeCodexLens(['config', '--json']),
        executeCodexLens(['status', '--json'])
      ]);

      let responseData = { index_dir: '~/.codexlens/indexes', index_count: 0 };

      // Parse config (extract JSON from output that may contain log messages)
      if (configResult.success) {
        try {
          const config = extractJSON(configResult.output);
          if (config.success && config.result) {
            responseData.index_dir = config.result.index_root || responseData.index_dir;
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
        const result = await executeCodexLens(['config-set', '--key', 'index_dir', '--value', index_dir, '--json']);
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
      const { path: projectPath } = body;
      const targetPath = projectPath || initialPath;

      // Broadcast start event
      broadcastToClients({
        type: 'CODEXLENS_INDEX_PROGRESS',
        payload: { stage: 'start', message: 'Starting index...', percent: 0, path: targetPath }
      });

      try {
        const result = await executeCodexLens(['init', targetPath, '--json'], {
          cwd: targetPath,
          timeout: 300000, // 5 minutes
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


  // API: CodexLens Semantic Search Install (fastembed, ONNX-based, ~200MB)
  if (pathname === '/api/codexlens/semantic/install' && req.method === 'POST') {
    handlePostRequest(req, res, async () => {
      try {
        const result = await installSemantic();
        if (result.success) {
          const status = await checkSemanticStatus();
          return {
            success: true,
            message: 'Semantic search installed successfully (fastembed)',
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
