import * as http from 'http';
import { URL } from 'url';
import { getCoreMemoryStore } from '../core-memory-store.js';
import type { CoreMemory, SessionCluster, ClusterMember, ClusterRelation } from '../core-memory-store.js';

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

  // ============================================================
  // Session Clustering API Endpoints
  // ============================================================

  // API: Get all clusters
  if (pathname === '/api/core-memory/clusters' && req.method === 'GET') {
    const projectPath = url.searchParams.get('path') || initialPath;
    const status = url.searchParams.get('status') || undefined;

    try {
      const store = getCoreMemoryStore(projectPath);
      const clusters = store.listClusters(status);

      // Add member count to each cluster
      const clustersWithCount = clusters.map(c => ({
        ...c,
        memberCount: store.getClusterMembers(c.id).length
      }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, clusters: clustersWithCount }));
    } catch (error: unknown) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
    return true;
  }

  // API: Get cluster detail with members
  if (pathname.match(/^\/api\/core-memory\/clusters\/[^\/]+$/) && req.method === 'GET') {
    const clusterId = pathname.split('/').pop()!;
    const projectPath = url.searchParams.get('path') || initialPath;

    try {
      const store = getCoreMemoryStore(projectPath);
      const cluster = store.getCluster(clusterId);

      if (!cluster) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Cluster not found' }));
        return true;
      }

      const members = store.getClusterMembers(clusterId);
      const relations = store.getClusterRelations(clusterId);

      // Get metadata for each member
      const membersWithMetadata = members.map(m => ({
        ...m,
        metadata: store.getSessionMetadata(m.session_id)
      }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        cluster,
        members: membersWithMetadata,
        relations
      }));
    } catch (error: unknown) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
    return true;
  }

  // API: Auto-cluster sessions
  if (pathname === '/api/core-memory/clusters/auto' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { scope = 'recent', minClusterSize = 2, path: projectPath } = body;
      const basePath = projectPath || initialPath;

      try {
        const { SessionClusteringService } = await import('../session-clustering-service.js');
        const service = new SessionClusteringService(basePath);

        const validScope: 'all' | 'recent' | 'unclustered' =
          scope === 'all' || scope === 'recent' || scope === 'unclustered' ? scope : 'recent';

        const result = await service.autocluster({
          scope: validScope,
          minClusterSize
        });

        // Broadcast update event
        broadcastToClients({
          type: 'CLUSTERS_UPDATED',
          payload: {
            ...result,
            timestamp: new Date().toISOString()
          }
        });

        return {
          success: true,
          ...result
        };
      } catch (error: unknown) {
        return { error: (error as Error).message, status: 500 };
      }
    });
    return true;
  }

  // API: Create new cluster
  if (pathname === '/api/core-memory/clusters' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { name, description, intent, metadata, path: projectPath } = body;

      if (!name) {
        return { error: 'name is required', status: 400 };
      }

      const basePath = projectPath || initialPath;

      try {
        const store = getCoreMemoryStore(basePath);
        const cluster = store.createCluster({
          name,
          description,
          intent,
          metadata: metadata ? JSON.stringify(metadata) : undefined
        });

        // Broadcast update event
        broadcastToClients({
          type: 'CLUSTER_UPDATED',
          payload: {
            cluster,
            timestamp: new Date().toISOString()
          }
        });

        return {
          success: true,
          cluster
        };
      } catch (error: unknown) {
        return { error: (error as Error).message, status: 500 };
      }
    });
    return true;
  }

  // API: Update cluster (supports both PUT and PATCH)
  if (pathname.match(/^\/api\/core-memory\/clusters\/[^\/]+$/) && (req.method === 'PUT' || req.method === 'PATCH')) {
    const clusterId = pathname.split('/').pop()!;

    handlePostRequest(req, res, async (body) => {
      const { name, description, intent, status, metadata, path: projectPath } = body;
      const basePath = projectPath || initialPath;

      try {
        const store = getCoreMemoryStore(basePath);
        const cluster = store.updateCluster(clusterId, {
          name,
          description,
          intent,
          status,
          metadata: metadata ? JSON.stringify(metadata) : undefined
        });

        if (!cluster) {
          return { error: 'Cluster not found', status: 404 };
        }

        // Broadcast update event
        broadcastToClients({
          type: 'CLUSTER_UPDATED',
          payload: {
            cluster,
            timestamp: new Date().toISOString()
          }
        });

        return {
          success: true,
          cluster
        };
      } catch (error: unknown) {
        return { error: (error as Error).message, status: 500 };
      }
    });
    return true;
  }

  // API: Delete cluster
  if (pathname.match(/^\/api\/core-memory\/clusters\/[^\/]+$/) && req.method === 'DELETE') {
    const clusterId = pathname.split('/').pop()!;
    const projectPath = url.searchParams.get('path') || initialPath;

    try {
      const store = getCoreMemoryStore(projectPath);
      const deleted = store.deleteCluster(clusterId);

      if (!deleted) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Cluster not found' }));
        return true;
      }

      // Broadcast update event
      broadcastToClients({
        type: 'CLUSTER_UPDATED',
        payload: {
          clusterId,
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

  // API: Add member to cluster
  if (pathname.match(/^\/api\/core-memory\/clusters\/[^\/]+\/members$/) && req.method === 'POST') {
    const clusterId = pathname.split('/')[4];

    handlePostRequest(req, res, async (body) => {
      const { session_id, session_type, sequence_order, relevance_score, path: projectPath } = body;

      if (!session_id || !session_type) {
        return { error: 'session_id and session_type are required', status: 400 };
      }

      const basePath = projectPath || initialPath;

      try {
        const store = getCoreMemoryStore(basePath);
        const member = store.addClusterMember({
          cluster_id: clusterId,
          session_id,
          session_type,
          sequence_order: sequence_order ?? 0,
          relevance_score: relevance_score ?? 1.0
        });

        // Broadcast update event
        broadcastToClients({
          type: 'CLUSTER_UPDATED',
          payload: {
            clusterId,
            member,
            timestamp: new Date().toISOString()
          }
        });

        return {
          success: true,
          member
        };
      } catch (error: unknown) {
        return { error: (error as Error).message, status: 500 };
      }
    });
    return true;
  }

  // API: Remove member from cluster
  if (pathname.match(/^\/api\/core-memory\/clusters\/[^\/]+\/members\/[^\/]+$/) && req.method === 'DELETE') {
    const parts = pathname.split('/');
    const clusterId = parts[4];
    const sessionId = parts[6];
    const projectPath = url.searchParams.get('path') || initialPath;

    try {
      const store = getCoreMemoryStore(projectPath);
      const removed = store.removeClusterMember(clusterId, sessionId);

      if (!removed) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Member not found' }));
        return true;
      }

      // Broadcast update event
      broadcastToClients({
        type: 'CLUSTER_UPDATED',
        payload: {
          clusterId,
          removedSessionId: sessionId,
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

  // API: Search sessions by keyword
  if (pathname === '/api/core-memory/sessions/search' && req.method === 'GET') {
    const keyword = url.searchParams.get('q') || '';
    const projectPath = url.searchParams.get('path') || initialPath;

    if (!keyword) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Query parameter q is required' }));
      return true;
    }

    try {
      const store = getCoreMemoryStore(projectPath);
      const results = store.searchSessionsByKeyword(keyword);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, results }));
    } catch (error: unknown) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
    return true;
  }

  return false;
}
