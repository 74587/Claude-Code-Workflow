/**
 * CodexLens v2 Routes Module
 * Handles CodexLens model management, index operations, env config, and MCP config API endpoints
 */

import { homedir } from 'os';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

import type { RouteContext } from './types.js';

// ========== HELPERS ==========

/**
 * Spawn a CLI command and collect stdout/stderr
 */
function spawnCli(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const child = spawn(cmd, args);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (err: Error) => {
      reject(err);
    });

    child.on('close', (code: number | null) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
  });
}

/**
 * Return the path to the codexlens env config file
 */
function getEnvFilePath(): string {
  return join(homedir(), '.ccw', 'codexlens-env.json');
}

/**
 * Read the codexlens env config file; returns {} when file does not exist
 */
function readEnvFile(): Record<string, string> {
  const filePath = getEnvFilePath();
  if (!existsSync(filePath)) {
    return {};
  }
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Write the codexlens env config file
 */
function writeEnvFile(env: Record<string, string>): void {
  const filePath = getEnvFilePath();
  const dir = join(homedir(), '.ccw');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(env, null, 2), 'utf-8');
}

// ========== ROUTE HANDLER ==========

/**
 * Handle CodexLens routes
 * @returns true if route was handled, false otherwise
 */
export async function handleCodexLensRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, req, res, handlePostRequest, url } = ctx;

  // ========== LIST MODELS ==========
  // GET /api/codexlens/models
  if (pathname === '/api/codexlens/models' && req.method === 'GET') {
    try {
      const result = await spawnCli('codexlens-search', ['list-models']);
      if (result.exitCode !== 0) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: result.stderr || 'Failed to list models' }));
        return true;
      }
      let models: unknown;
      try {
        models = JSON.parse(result.stdout);
      } catch {
        models = result.stdout;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, models }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // ========== DOWNLOAD MODEL ==========
  // POST /api/codexlens/models/download
  if (pathname === '/api/codexlens/models/download' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: unknown) => {
      const { name } = body as { name?: string };
      if (!name) {
        return { error: 'name is required', status: 400 };
      }
      try {
        const result = await spawnCli('codexlens-search', ['download-model', name]);
        if (result.exitCode !== 0) {
          return { error: result.stderr || 'Failed to download model', status: 500 };
        }
        return { success: true, output: result.stdout };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // ========== DELETE MODEL ==========
  // POST /api/codexlens/models/delete
  if (pathname === '/api/codexlens/models/delete' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: unknown) => {
      const { name } = body as { name?: string };
      if (!name) {
        return { error: 'name is required', status: 400 };
      }
      try {
        const result = await spawnCli('codexlens-search', ['delete-model', name]);
        if (result.exitCode !== 0) {
          return { error: result.stderr || 'Failed to delete model', status: 500 };
        }
        return { success: true, output: result.stdout };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // ========== INDEX STATUS ==========
  // GET /api/codexlens/index/status?projectPath=
  if (pathname === '/api/codexlens/index/status' && req.method === 'GET') {
    const projectPath = url.searchParams.get('projectPath');
    if (!projectPath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'projectPath query parameter is required' }));
      return true;
    }
    try {
      const dbPath = join(projectPath, '.codexlens');
      const result = await spawnCli('codexlens-search', ['status', '--db-path', dbPath]);
      if (result.exitCode !== 0) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: result.stderr || 'Failed to get index status' }));
        return true;
      }
      let status: unknown;
      try {
        status = JSON.parse(result.stdout);
      } catch {
        status = { raw: result.stdout };
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, status }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // ========== INDEX SYNC ==========
  // POST /api/codexlens/index/sync
  if (pathname === '/api/codexlens/index/sync' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: unknown) => {
      const { projectPath } = body as { projectPath?: string };
      if (!projectPath) {
        return { error: 'projectPath is required', status: 400 };
      }
      try {
        const result = await spawnCli('codexlens-search', ['sync', '--root', projectPath]);
        if (result.exitCode !== 0) {
          return { error: result.stderr || 'Failed to sync index', status: 500 };
        }
        return { success: true, output: result.stdout };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // ========== INDEX REBUILD ==========
  // POST /api/codexlens/index/rebuild
  if (pathname === '/api/codexlens/index/rebuild' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: unknown) => {
      const { projectPath } = body as { projectPath?: string };
      if (!projectPath) {
        return { error: 'projectPath is required', status: 400 };
      }
      try {
        const initResult = await spawnCli('codexlens-search', ['init', '--root', projectPath]);
        if (initResult.exitCode !== 0) {
          return { error: initResult.stderr || 'Failed to init index', status: 500 };
        }
        const syncResult = await spawnCli('codexlens-search', ['sync', '--root', projectPath]);
        if (syncResult.exitCode !== 0) {
          return { error: syncResult.stderr || 'Failed to sync after init', status: 500 };
        }
        return { success: true, initOutput: initResult.stdout, syncOutput: syncResult.stdout };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // ========== GET ENV ==========
  // GET /api/codexlens/env
  if (pathname === '/api/codexlens/env' && req.method === 'GET') {
    try {
      const env = readEnvFile();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, env }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // ========== SAVE ENV ==========
  // POST /api/codexlens/env
  if (pathname === '/api/codexlens/env' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: unknown) => {
      const { env } = body as { env?: Record<string, string> };
      if (!env || typeof env !== 'object') {
        return { error: 'env object is required', status: 400 };
      }
      try {
        writeEnvFile(env);
        return { success: true };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // ========== MCP CONFIG ==========
  // GET /api/codexlens/mcp-config
  if (pathname === '/api/codexlens/mcp-config' && req.method === 'GET') {
    try {
      const env = readEnvFile();
      // Filter to non-empty string values only
      const filteredEnv: Record<string, string> = {};
      for (const [key, value] of Object.entries(env)) {
        if (typeof value === 'string' && value.trim() !== '') {
          filteredEnv[key] = value;
        }
      }
      const mcpConfig = {
        mcpServers: {
          codexlens: {
            command: 'codexlens-mcp',
            env: filteredEnv
          }
        }
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, config: mcpConfig }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  return false;
}
