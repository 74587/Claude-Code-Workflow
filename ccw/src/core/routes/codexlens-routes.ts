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
  installSemantic
} from '../../tools/codex-lens.js';

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

  // API: CodexLens Init (Initialize workspace index)
  if (pathname === '/api/codexlens/init' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { path: projectPath } = body;
      const targetPath = projectPath || initialPath;

      try {
        const result = await executeCodexLens(['init', targetPath, '--json'], { cwd: targetPath });
        if (result.success) {
          try {
            const parsed = JSON.parse(result.output);
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
            const parsed = JSON.parse(result.output);
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

  return false;
}
