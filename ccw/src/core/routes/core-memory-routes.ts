import * as http from 'http';
import { URL } from 'url';
import { getCoreMemoryStore } from '../core-memory-store.js';
import type { CoreMemory } from '../core-memory-store.js';

/**
 * Route context interface
 */
interface RouteContext {
  pathname: string;
  url: URL;
  req: http.IncomingMessage;
  res: http.ServerResponse;
  initialPath: string;
  handlePostRequest: (req: http.IncomingMessage, res: http.ServerResponse, handler: (body: any) => Promise<any>) => void;
  broadcastToClients: (data: any) => void;
}

/**
 * Handle Core Memory API routes
 * @returns true if route was handled, false otherwise
 */
export async function handleCoreMemoryRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath, handlePostRequest, broadcastToClients } = ctx;

  // API: Core Memory - Get all memories
  if (pathname === '/api/core-memory/memories' && req.method === 'GET') {
    const projectPath = url.searchParams.get('path') || initialPath;
    const archived = url.searchParams.get('archived') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    try {
      const store = getCoreMemoryStore(projectPath);
      const memories = store.getMemories({ archived, limit, offset });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, memories }));
    } catch (error: unknown) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
    return true;
  }

  // API: Core Memory - Get single memory
  if (pathname.startsWith('/api/core-memory/memories/') && req.method === 'GET') {
    const memoryId = pathname.replace('/api/core-memory/memories/', '');
    const projectPath = url.searchParams.get('path') || initialPath;

    try {
      const store = getCoreMemoryStore(projectPath);
      const memory = store.getMemory(memoryId);

      if (memory) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, memory }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Memory not found' }));
      }
    } catch (error: unknown) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
    return true;
  }

  // API: Core Memory - Create or update memory
  if (pathname === '/api/core-memory/memories' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { content, summary, raw_output, id, archived, metadata, path: projectPath } = body;

      if (!content) {
        return { error: 'content is required', status: 400 };
      }

      const basePath = projectPath || initialPath;

      try {
        const store = getCoreMemoryStore(basePath);
        const memory = store.upsertMemory({
          id,
          content,
          summary,
          raw_output,
          archived,
          metadata: metadata ? JSON.stringify(metadata) : undefined
        });

        // Broadcast update event
        broadcastToClients({
          type: 'CORE_MEMORY_UPDATED',
          payload: {
            memory,
            timestamp: new Date().toISOString()
          }
        });

        return {
          success: true,
          memory
        };
      } catch (error: unknown) {
        return { error: (error as Error).message, status: 500 };
      }
    });
    return true;
  }

  // API: Core Memory - Archive memory
  if (pathname.startsWith('/api/core-memory/memories/') && pathname.endsWith('/archive') && req.method === 'POST') {
    const memoryId = pathname.replace('/api/core-memory/memories/', '').replace('/archive', '');
    const projectPath = url.searchParams.get('path') || initialPath;

    try {
      const store = getCoreMemoryStore(projectPath);
      store.archiveMemory(memoryId);

      // Broadcast update event
      broadcastToClients({
        type: 'CORE_MEMORY_UPDATED',
        payload: {
          memoryId,
          archived: true,
          timestamp: new Date().toISOString()
        }
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (error: unknown) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
    return true;
  }

  // API: Core Memory - Delete memory
  if (pathname.startsWith('/api/core-memory/memories/') && req.method === 'DELETE') {
    const memoryId = pathname.replace('/api/core-memory/memories/', '');
    const projectPath = url.searchParams.get('path') || initialPath;

    try {
      const store = getCoreMemoryStore(projectPath);
      store.deleteMemory(memoryId);

      // Broadcast update event
      broadcastToClients({
        type: 'CORE_MEMORY_UPDATED',
        payload: {
          memoryId,
          deleted: true,
          timestamp: new Date().toISOString()
        }
      });

      res.writeHead(204, { 'Content-Type': 'application/json' });
      res.end();
    } catch (error: unknown) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
    return true;
  }

  // API: Core Memory - Generate summary
  if (pathname.startsWith('/api/core-memory/memories/') && pathname.endsWith('/summary') && req.method === 'POST') {
    const memoryId = pathname.replace('/api/core-memory/memories/', '').replace('/summary', '');

    handlePostRequest(req, res, async (body) => {
      const { tool = 'gemini', path: projectPath } = body;
      const basePath = projectPath || initialPath;

      try {
        const store = getCoreMemoryStore(basePath);
        const summary = await store.generateSummary(memoryId, tool);

        // Broadcast update event
        broadcastToClients({
          type: 'CORE_MEMORY_UPDATED',
          payload: {
            memoryId,
            summary,
            timestamp: new Date().toISOString()
          }
        });

        return {
          success: true,
          summary
        };
      } catch (error: unknown) {
        return { error: (error as Error).message, status: 500 };
      }
    });
    return true;
  }

  return false;
}
