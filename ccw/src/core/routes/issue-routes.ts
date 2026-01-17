/**
 * Issue Routes Module (Optimized - Flat JSONL Storage)
 *
 * Storage Structure:
 * .workflow/issues/
 * ├── issues.jsonl              # All issues (one per line)
 * ├── queues/                   # Queue history directory
 * │   ├── index.json            # Queue index (active + history)
 * │   └── {queue-id}.json       # Individual queue files
 * └── solutions/
 *     ├── {issue-id}.jsonl      # Solutions for issue (one per line)
 *     └── ...
 *
 * API Endpoints (8 total):
 * - GET    /api/issues              - List all issues
 * - POST   /api/issues              - Create new issue
 * - GET    /api/issues/:id          - Get issue detail
 * - PATCH  /api/issues/:id          - Update issue (includes binding logic)
 * - DELETE /api/issues/:id          - Delete issue
 * - POST   /api/issues/:id/solutions - Add solution
 * - PATCH  /api/issues/:id/tasks/:taskId - Update task
 * - GET    /api/queue               - Get execution queue
 * - POST   /api/queue/reorder       - Reorder queue items
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join, resolve, normalize } from 'path';
import type { RouteContext } from './types.js';

// ========== JSONL Helper Functions ==========

function readIssuesJsonl(issuesDir: string): any[] {
  const issuesPath = join(issuesDir, 'issues.jsonl');
  if (!existsSync(issuesPath)) return [];
  try {
    const content = readFileSync(issuesPath, 'utf8');
    return content.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

function writeIssuesJsonl(issuesDir: string, issues: any[]) {
  if (!existsSync(issuesDir)) mkdirSync(issuesDir, { recursive: true });
  const issuesPath = join(issuesDir, 'issues.jsonl');
  writeFileSync(issuesPath, issues.map(i => JSON.stringify(i)).join('\n'));
}

function readSolutionsJsonl(issuesDir: string, issueId: string): any[] {
  const solutionsPath = join(issuesDir, 'solutions', `${issueId}.jsonl`);
  if (!existsSync(solutionsPath)) return [];
  try {
    const content = readFileSync(solutionsPath, 'utf8');
    return content.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

function readIssueHistoryJsonl(issuesDir: string): any[] {
  const historyPath = join(issuesDir, 'issue-history.jsonl');
  if (!existsSync(historyPath)) return [];
  try {
    const content = readFileSync(historyPath, 'utf8');
    return content.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

function writeIssueHistoryJsonl(issuesDir: string, issues: any[]) {
  if (!existsSync(issuesDir)) mkdirSync(issuesDir, { recursive: true });
  const historyPath = join(issuesDir, 'issue-history.jsonl');
  writeFileSync(historyPath, issues.map(i => JSON.stringify(i)).join('\n'));
}

function writeSolutionsJsonl(issuesDir: string, issueId: string, solutions: any[]) {
  const solutionsDir = join(issuesDir, 'solutions');
  if (!existsSync(solutionsDir)) mkdirSync(solutionsDir, { recursive: true });
  writeFileSync(join(solutionsDir, `${issueId}.jsonl`), solutions.map(s => JSON.stringify(s)).join('\n'));
}

function generateQueueFileId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `QUE-${ts}`;
}

function readQueue(issuesDir: string) {
  // Try new multi-queue structure first
  const queuesDir = join(issuesDir, 'queues');
  const indexPath = join(queuesDir, 'index.json');

  if (existsSync(indexPath)) {
    try {
      const index = JSON.parse(readFileSync(indexPath, 'utf8'));
      const activeQueueId = index.active_queue_id;

      if (activeQueueId) {
        const queueFilePath = join(queuesDir, `${activeQueueId}.json`);
        if (existsSync(queueFilePath)) {
          return JSON.parse(readFileSync(queueFilePath, 'utf8'));
        }
      }
    } catch {
      // Fall through to legacy check
    }
  }

  // Fallback to legacy queue.json
  const legacyQueuePath = join(issuesDir, 'queue.json');
  if (existsSync(legacyQueuePath)) {
    try {
      return JSON.parse(readFileSync(legacyQueuePath, 'utf8'));
    } catch {
      // Return empty queue
    }
  }

  return { tasks: [], conflicts: [], execution_groups: [], _metadata: { version: '1.0', total_tasks: 0 } };
}

function writeQueue(issuesDir: string, queue: any) {
  if (!existsSync(issuesDir)) mkdirSync(issuesDir, { recursive: true });

  // Support both solution-based and task-based queues
  const items = queue.solutions || queue.tasks || [];
  const isSolutionBased = Array.isArray(queue.solutions) && queue.solutions.length > 0;

  queue._metadata = {
    ...queue._metadata,
    updated_at: new Date().toISOString(),
    ...(isSolutionBased
      ? { total_solutions: items.length }
      : { total_tasks: items.length })
  };

  // Check if using new multi-queue structure
  const queuesDir = join(issuesDir, 'queues');
  const indexPath = join(queuesDir, 'index.json');

  if (existsSync(indexPath) && queue.id) {
    // Write to new structure
    const queueFilePath = join(queuesDir, `${queue.id}.json`);
    writeFileSync(queueFilePath, JSON.stringify(queue, null, 2));

    // Update index metadata
    try {
      const index = JSON.parse(readFileSync(indexPath, 'utf8'));
      const queueEntry = index.queues?.find((q: any) => q.id === queue.id);
      if (queueEntry) {
        if (isSolutionBased) {
          queueEntry.total_solutions = items.length;
          queueEntry.completed_solutions = items.filter((i: any) => i.status === 'completed').length;
        } else {
          queueEntry.total_tasks = items.length;
          queueEntry.completed_tasks = items.filter((i: any) => i.status === 'completed').length;
        }
        writeFileSync(indexPath, JSON.stringify(index, null, 2));
      }
    } catch {
      // Ignore index update errors
    }
  } else {
    // Fallback to legacy queue.json
    writeFileSync(join(issuesDir, 'queue.json'), JSON.stringify(queue, null, 2));
  }
}

function getIssueDetail(issuesDir: string, issueId: string) {
  const issues = readIssuesJsonl(issuesDir);
  let issue = issues.find(i => i.id === issueId);

  // Fallback: Reconstruct issue from solution file if issue not in issues.jsonl
  if (!issue) {
    const solutionPath = join(issuesDir, 'solutions', `${issueId}.jsonl`);
    if (existsSync(solutionPath)) {
      const solutions = readSolutionsJsonl(issuesDir, issueId);
      if (solutions.length > 0) {
        const boundSolution = solutions.find(s => s.is_bound) || solutions[0];
        issue = {
          id: issueId,
          title: boundSolution?.description || issueId,
          status: 'completed',
          priority: 3,
          context: boundSolution?.approach || '',
          bound_solution_id: boundSolution?.id || null,
          created_at: boundSolution?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          _reconstructed: true
        };
      }
    }
  }

  if (!issue) return null;

  const solutions = readSolutionsJsonl(issuesDir, issueId);
  let tasks: any[] = [];
  if (issue.bound_solution_id) {
    const boundSol = solutions.find(s => s.id === issue.bound_solution_id);
    if (boundSol?.tasks) tasks = boundSol.tasks;
  }
  return { ...issue, solutions, tasks };
}

function enrichIssues(issues: any[], issuesDir: string) {
  return issues.map(issue => {
    const solutions = readSolutionsJsonl(issuesDir, issue.id);
    let taskCount = 0;

    // Get task count from bound solution
    if (issue.bound_solution_id) {
      const boundSol = solutions.find(s => s.id === issue.bound_solution_id);
      if (boundSol?.tasks) {
        taskCount = boundSol.tasks.length;
      }
    }

    return {
      ...issue,
      solution_count: solutions.length,
      task_count: taskCount
    };
  });
}

/**
 * Get queue items (supports both solution-based and task-based queues)
 */
function getQueueItems(queue: any): any[] {
  return queue.solutions || queue.tasks || [];
}

/**
 * Check if queue is solution-based
 */
function isSolutionBasedQueue(queue: any): boolean {
  return Array.isArray(queue.solutions) && queue.solutions.length > 0;
}

function groupQueueByExecutionGroup(queue: any) {
  const groups: { [key: string]: any[] } = {};
  const items = getQueueItems(queue);
  const isSolutionBased = isSolutionBasedQueue(queue);

  for (const item of items) {
    const groupId = item.execution_group || 'ungrouped';
    if (!groups[groupId]) groups[groupId] = [];
    groups[groupId].push(item);
  }
  for (const groupId of Object.keys(groups)) {
    groups[groupId].sort((a, b) => (a.execution_order || 0) - (b.execution_order || 0));
  }
  const executionGroups = Object.entries(groups).map(([id, groupItems]) => ({
    id,
    type: id.startsWith('P') ? 'parallel' : id.startsWith('S') ? 'sequential' : 'unknown',
    // Use appropriate count field based on queue type
    ...(isSolutionBased
      ? { solution_count: groupItems.length, solutions: groupItems.map(i => i.item_id) }
      : { task_count: groupItems.length, tasks: groupItems.map(i => i.item_id) })
  })).sort((a, b) => {
    const aFirst = groups[a.id]?.[0]?.execution_order || 0;
    const bFirst = groups[b.id]?.[0]?.execution_order || 0;
    return aFirst - bFirst;
  });
  return { ...queue, execution_groups: executionGroups, grouped_items: groups };
}

/**
 * Bind solution to issue with proper side effects
 */
function bindSolutionToIssue(issuesDir: string, issueId: string, solutionId: string, issues: any[], issueIndex: number) {
  const solutions = readSolutionsJsonl(issuesDir, issueId);
  const solIndex = solutions.findIndex(s => s.id === solutionId);

  if (solIndex === -1) return { error: `Solution ${solutionId} not found` };

  // Unbind all, bind new
  solutions.forEach(s => { s.is_bound = false; });
  solutions[solIndex].is_bound = true;
  solutions[solIndex].bound_at = new Date().toISOString();
  writeSolutionsJsonl(issuesDir, issueId, solutions);

  // Update issue
  issues[issueIndex].bound_solution_id = solutionId;
  issues[issueIndex].status = 'planned';
  issues[issueIndex].planned_at = new Date().toISOString();

  return { success: true, bound: solutionId };
}

// ========== Path Validation ==========

/**
 * Validate that the provided path is safe (no path traversal)
 * Returns the resolved, normalized path or null if invalid
 */
function validateProjectPath(requestedPath: string, basePath: string): string | null {
  if (!requestedPath) return basePath;

  // Resolve to absolute path and normalize
  const resolvedPath = resolve(normalize(requestedPath));
  const resolvedBase = resolve(normalize(basePath));

  // For local development tool, we allow any absolute path
  // but prevent obvious traversal attempts
  if (requestedPath.includes('..') && !resolvedPath.startsWith(resolvedBase)) {
    // Check if it's trying to escape with ..
    const normalizedRequested = normalize(requestedPath);
    if (normalizedRequested.startsWith('..')) {
      return null;
    }
  }

  return resolvedPath;
}

// ========== Route Handler ==========

export async function handleIssueRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath, handlePostRequest } = ctx;
  const rawProjectPath = url.searchParams.get('path') || initialPath;

  // Validate project path to prevent path traversal
  const projectPath = validateProjectPath(rawProjectPath, initialPath);
  if (!projectPath) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid project path' }));
    return true;
  }

  const issuesDir = join(projectPath, '.workflow', 'issues');

  // ===== Queue Routes (top-level /api/queue) =====

  // GET /api/queue - Get execution queue
  if (pathname === '/api/queue' && req.method === 'GET') {
    const queue = groupQueueByExecutionGroup(readQueue(issuesDir));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(queue));
    return true;
  }

  // GET /api/queue/history - Get queue history (all queues from index)
  if (pathname === '/api/queue/history' && req.method === 'GET') {
    const queuesDir = join(issuesDir, 'queues');
    const indexPath = join(queuesDir, 'index.json');

    if (!existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ queues: [], active_queue_id: null }));
      return true;
    }

    try {
      const index = JSON.parse(readFileSync(indexPath, 'utf8'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(index));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ queues: [], active_queue_id: null }));
    }
    return true;
  }

  // GET /api/queue/:id - Get specific queue by ID
  const queueDetailMatch = pathname.match(/^\/api\/queue\/([^/]+)$/);
  const reservedQueuePaths = ['history', 'reorder', 'switch', 'deactivate', 'merge'];
  if (queueDetailMatch && req.method === 'GET' && !reservedQueuePaths.includes(queueDetailMatch[1])) {
    const queueId = queueDetailMatch[1];
    const queuesDir = join(issuesDir, 'queues');
    const queueFilePath = join(queuesDir, `${queueId}.json`);

    if (!existsSync(queueFilePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Queue ${queueId} not found` }));
      return true;
    }

    try {
      const queue = JSON.parse(readFileSync(queueFilePath, 'utf8'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(groupQueueByExecutionGroup(queue)));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read queue' }));
    }
    return true;
  }

  // POST /api/queue/switch - Switch active queue
  if (pathname === '/api/queue/switch' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: any) => {
      const { queueId } = body;
      if (!queueId) return { error: 'queueId required' };

      const queuesDir = join(issuesDir, 'queues');
      const indexPath = join(queuesDir, 'index.json');
      const queueFilePath = join(queuesDir, `${queueId}.json`);

      if (!existsSync(queueFilePath)) {
        return { error: `Queue ${queueId} not found` };
      }

      try {
        const index = existsSync(indexPath)
          ? JSON.parse(readFileSync(indexPath, 'utf8'))
          : { active_queue_id: null, queues: [] };

        index.active_queue_id = queueId;
        writeFileSync(indexPath, JSON.stringify(index, null, 2));

        return { success: true, active_queue_id: queueId };
      } catch (err) {
        return { error: 'Failed to switch queue' };
      }
    });
    return true;
  }

  // POST /api/queue/deactivate - Deactivate current queue (set active to null)
  if (pathname === '/api/queue/deactivate' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: any) => {
      const queuesDir = join(issuesDir, 'queues');
      const indexPath = join(queuesDir, 'index.json');

      try {
        const index = existsSync(indexPath)
          ? JSON.parse(readFileSync(indexPath, 'utf8'))
          : { active_queue_id: null, queues: [] };

        const previousActiveId = index.active_queue_id;
        index.active_queue_id = null;
        writeFileSync(indexPath, JSON.stringify(index, null, 2));

        return { success: true, previous_active_id: previousActiveId };
      } catch (err) {
        return { error: 'Failed to deactivate queue' };
      }
    });
    return true;
  }

  // POST /api/queue/reorder - Reorder queue items (supports both solutions and tasks)
  if (pathname === '/api/queue/reorder' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: any) => {
      const { groupId, newOrder } = body;
      if (!groupId || !Array.isArray(newOrder)) {
        return { error: 'groupId and newOrder (array) required' };
      }

      const queue = readQueue(issuesDir);
      const items = getQueueItems(queue);
      const isSolutionBased = isSolutionBasedQueue(queue);

      const groupItems = items.filter((item: any) => item.execution_group === groupId);
      const otherItems = items.filter((item: any) => item.execution_group !== groupId);

      if (groupItems.length === 0) return { error: `No items in group ${groupId}` };

      const groupItemIds = new Set(groupItems.map((i: any) => i.item_id));
      if (groupItemIds.size !== new Set(newOrder).size) {
        return { error: 'newOrder must contain all group items' };
      }
      for (const id of newOrder) {
        if (!groupItemIds.has(id)) return { error: `Invalid item_id: ${id}` };
      }

      const itemMap = new Map(groupItems.map((i: any) => [i.item_id, i]));
      const reorderedItems = newOrder.map((qid: string, idx: number) => ({ ...itemMap.get(qid), _idx: idx }));
      const newQueueItems = [...otherItems, ...reorderedItems].sort((a, b) => {
        const aGroup = parseInt(a.execution_group?.match(/\d+/)?.[0] || '999');
        const bGroup = parseInt(b.execution_group?.match(/\d+/)?.[0] || '999');
        if (aGroup !== bGroup) return aGroup - bGroup;
        if (a.execution_group === b.execution_group) {
          return (a._idx ?? a.execution_order ?? 999) - (b._idx ?? b.execution_order ?? 999);
        }
        return (a.execution_order || 0) - (b.execution_order || 0);
      });

      newQueueItems.forEach((item, idx) => { item.execution_order = idx + 1; delete item._idx; });

      // Write back to appropriate array based on queue type
      if (isSolutionBased) {
        queue.solutions = newQueueItems;
      } else {
        queue.tasks = newQueueItems;
      }
      writeQueue(issuesDir, queue);

      return { success: true, groupId, reordered: newOrder.length };
    });
    return true;
  }

  // DELETE /api/queue/:queueId/item/:itemId - Delete item from queue
  const queueItemDeleteMatch = pathname.match(/^\/api\/queue\/([^/]+)\/item\/([^/]+)$/);
  if (queueItemDeleteMatch && req.method === 'DELETE') {
    const queueId = queueItemDeleteMatch[1];
    const itemId = decodeURIComponent(queueItemDeleteMatch[2]);

    const queuesDir = join(issuesDir, 'queues');
    const queueFilePath = join(queuesDir, `${queueId}.json`);

    if (!existsSync(queueFilePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Queue ${queueId} not found` }));
      return true;
    }

    try {
      const queue = JSON.parse(readFileSync(queueFilePath, 'utf8'));
      const items = queue.solutions || queue.tasks || [];
      const filteredItems = items.filter((item: any) => item.item_id !== itemId);

      if (filteredItems.length === items.length) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Item ${itemId} not found in queue` }));
        return true;
      }

      // Update queue items
      if (queue.solutions) {
        queue.solutions = filteredItems;
      } else {
        queue.tasks = filteredItems;
      }

      // Recalculate metadata
      const completedCount = filteredItems.filter((i: any) => i.status === 'completed').length;
      queue._metadata = {
        ...queue._metadata,
        updated_at: new Date().toISOString(),
        ...(queue.solutions
          ? { total_solutions: filteredItems.length, completed_solutions: completedCount }
          : { total_tasks: filteredItems.length, completed_tasks: completedCount })
      };

      writeFileSync(queueFilePath, JSON.stringify(queue, null, 2));

      // Update index counts
      const indexPath = join(queuesDir, 'index.json');
      if (existsSync(indexPath)) {
        try {
          const index = JSON.parse(readFileSync(indexPath, 'utf8'));
          const queueEntry = index.queues?.find((q: any) => q.id === queueId);
          if (queueEntry) {
            if (queue.solutions) {
              queueEntry.total_solutions = filteredItems.length;
              queueEntry.completed_solutions = completedCount;
            } else {
              queueEntry.total_tasks = filteredItems.length;
              queueEntry.completed_tasks = completedCount;
            }
            writeFileSync(indexPath, JSON.stringify(index, null, 2));
          }
        } catch (err) {
          console.error('Failed to update queue index:', err);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, queueId, deletedItemId: itemId }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to delete item' }));
    }
    return true;
  }

  // DELETE /api/queue/:queueId - Delete entire queue
  const queueDeleteMatch = pathname.match(/^\/api\/queue\/([^/]+)$/);
  if (queueDeleteMatch && req.method === 'DELETE') {
    const queueId = queueDeleteMatch[1];
    const queuesDir = join(issuesDir, 'queues');
    const queueFilePath = join(queuesDir, `${queueId}.json`);
    const indexPath = join(queuesDir, 'index.json');

    if (!existsSync(queueFilePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Queue ${queueId} not found` }));
      return true;
    }

    try {
      // Delete queue file
      unlinkSync(queueFilePath);

      // Update index
      if (existsSync(indexPath)) {
        const index = JSON.parse(readFileSync(indexPath, 'utf8'));

        // Remove from queues array
        index.queues = (index.queues || []).filter((q: any) => q.id !== queueId);

        // Clear active if this was the active queue
        if (index.active_queue_id === queueId) {
          index.active_queue_id = null;
        }

        writeFileSync(indexPath, JSON.stringify(index, null, 2));
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, deletedQueueId: queueId }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to delete queue' }));
    }
    return true;
  }

  // POST /api/queue/merge - Merge source queue into target queue
  if (pathname === '/api/queue/merge' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: any) => {
      const { sourceQueueId, targetQueueId } = body;
      if (!sourceQueueId || !targetQueueId) {
        return { error: 'sourceQueueId and targetQueueId required' };
      }

      if (sourceQueueId === targetQueueId) {
        return { error: 'Cannot merge queue into itself' };
      }

      const queuesDir = join(issuesDir, 'queues');
      const sourcePath = join(queuesDir, `${sourceQueueId}.json`);
      const targetPath = join(queuesDir, `${targetQueueId}.json`);

      if (!existsSync(sourcePath)) return { error: `Source queue ${sourceQueueId} not found` };
      if (!existsSync(targetPath)) return { error: `Target queue ${targetQueueId} not found` };

      try {
        const sourceQueue = JSON.parse(readFileSync(sourcePath, 'utf8'));
        const targetQueue = JSON.parse(readFileSync(targetPath, 'utf8'));

        const sourceItems = sourceQueue.solutions || sourceQueue.tasks || [];
        const targetItems = targetQueue.solutions || targetQueue.tasks || [];
        const isSolutionBased = !!targetQueue.solutions;

        // Re-index source items to avoid ID conflicts
        const maxOrder = targetItems.reduce((max: number, i: any) => Math.max(max, i.execution_order || 0), 0);
        const reindexedSourceItems = sourceItems.map((item: any, idx: number) => ({
          ...item,
          item_id: `${item.item_id}-merged`,
          execution_order: maxOrder + idx + 1,
          execution_group: item.execution_group ? `M-${item.execution_group}` : 'M-ungrouped'
        }));

        // Merge items
        const mergedItems = [...targetItems, ...reindexedSourceItems];

        if (isSolutionBased) {
          targetQueue.solutions = mergedItems;
        } else {
          targetQueue.tasks = mergedItems;
        }

        // Merge issue_ids
        const mergedIssueIds = [...new Set([
          ...(targetQueue.issue_ids || []),
          ...(sourceQueue.issue_ids || [])
        ])];
        targetQueue.issue_ids = mergedIssueIds;

        // Update metadata
        const completedCount = mergedItems.filter((i: any) => i.status === 'completed').length;
        targetQueue._metadata = {
          ...targetQueue._metadata,
          updated_at: new Date().toISOString(),
          ...(isSolutionBased
            ? { total_solutions: mergedItems.length, completed_solutions: completedCount }
            : { total_tasks: mergedItems.length, completed_tasks: completedCount })
        };

        // Write merged queue
        writeFileSync(targetPath, JSON.stringify(targetQueue, null, 2));

        // Update source queue status
        sourceQueue.status = 'merged';
        sourceQueue._metadata = {
          ...sourceQueue._metadata,
          merged_into: targetQueueId,
          merged_at: new Date().toISOString()
        };
        writeFileSync(sourcePath, JSON.stringify(sourceQueue, null, 2));

        // Update index
        const indexPath = join(queuesDir, 'index.json');
        if (existsSync(indexPath)) {
          try {
            const index = JSON.parse(readFileSync(indexPath, 'utf8'));
            const sourceEntry = index.queues?.find((q: any) => q.id === sourceQueueId);
            const targetEntry = index.queues?.find((q: any) => q.id === targetQueueId);
            if (sourceEntry) {
              sourceEntry.status = 'merged';
            }
            if (targetEntry) {
              if (isSolutionBased) {
                targetEntry.total_solutions = mergedItems.length;
                targetEntry.completed_solutions = completedCount;
              } else {
                targetEntry.total_tasks = mergedItems.length;
                targetEntry.completed_tasks = completedCount;
              }
              targetEntry.issue_ids = mergedIssueIds;
            }
            writeFileSync(indexPath, JSON.stringify(index, null, 2));
          } catch {
            // Ignore index update errors
          }
        }

        return {
          success: true,
          sourceQueueId,
          targetQueueId,
          mergedItemCount: sourceItems.length,
          totalItems: mergedItems.length
        };
      } catch (err) {
        return { error: 'Failed to merge queues' };
      }
    });
    return true;
  }

  // POST /api/queue/split - Split items from source queue into a new queue
  if (pathname === '/api/queue/split' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: any) => {
      const { sourceQueueId, itemIds } = body;
      if (!sourceQueueId || !itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
        return { error: 'sourceQueueId and itemIds (non-empty array) required' };
      }

      const queuesDir = join(issuesDir, 'queues');
      const sourcePath = join(queuesDir, `${sourceQueueId}.json`);

      if (!existsSync(sourcePath)) {
        return { error: `Source queue ${sourceQueueId} not found` };
      }

      try {
        const sourceQueue = JSON.parse(readFileSync(sourcePath, 'utf8'));
        const sourceItems = sourceQueue.solutions || sourceQueue.tasks || [];
        const isSolutionBased = !!sourceQueue.solutions;

        // Find items to split
        const itemsToSplit = sourceItems.filter((item: any) =>
          itemIds.includes(item.item_id) ||
          itemIds.includes(item.solution_id) ||
          itemIds.includes(item.task_id)
        );

        if (itemsToSplit.length === 0) {
          return { error: 'No matching items found to split' };
        }

        if (itemsToSplit.length === sourceItems.length) {
          return { error: 'Cannot split all items - at least one item must remain in source queue' };
        }

        // Find remaining items
        const remainingItems = sourceItems.filter((item: any) =>
          !itemIds.includes(item.item_id) &&
          !itemIds.includes(item.solution_id) &&
          !itemIds.includes(item.task_id)
        );

        // Create new queue with split items
        const newQueueId = generateQueueFileId();
        const newQueuePath = join(queuesDir, `${newQueueId}.json`);

        // Re-index split items
        const reindexedSplitItems = itemsToSplit.map((item: any, idx: number) => ({
          ...item,
          execution_order: idx + 1
        }));

        // Extract issue IDs from split items
        const splitIssueIds = [...new Set(itemsToSplit.map((item: any) => item.issue_id).filter(Boolean))];

        // Remaining issue IDs
        const remainingIssueIds = [...new Set(remainingItems.map((item: any) => item.issue_id).filter(Boolean))];

        // Create new queue
        const newQueue: any = {
          id: newQueueId,
          status: 'active',
          issue_ids: splitIssueIds,
          conflicts: [],
          _metadata: {
            version: '2.1',
            updated_at: new Date().toISOString(),
            split_from: sourceQueueId,
            split_at: new Date().toISOString(),
            ...(isSolutionBased
              ? {
                  total_solutions: reindexedSplitItems.length,
                  completed_solutions: reindexedSplitItems.filter((i: any) => i.status === 'completed').length
                }
              : {
                  total_tasks: reindexedSplitItems.length,
                  completed_tasks: reindexedSplitItems.filter((i: any) => i.status === 'completed').length
                })
          }
        };

        if (isSolutionBased) {
          newQueue.solutions = reindexedSplitItems;
        } else {
          newQueue.tasks = reindexedSplitItems;
        }

        // Update source queue with remaining items
        const reindexedRemainingItems = remainingItems.map((item: any, idx: number) => ({
          ...item,
          execution_order: idx + 1
        }));

        if (isSolutionBased) {
          sourceQueue.solutions = reindexedRemainingItems;
        } else {
          sourceQueue.tasks = reindexedRemainingItems;
        }

        sourceQueue.issue_ids = remainingIssueIds;
        sourceQueue._metadata = {
          ...sourceQueue._metadata,
          updated_at: new Date().toISOString(),
          ...(isSolutionBased
            ? {
                total_solutions: reindexedRemainingItems.length,
                completed_solutions: reindexedRemainingItems.filter((i: any) => i.status === 'completed').length
              }
            : {
                total_tasks: reindexedRemainingItems.length,
                completed_tasks: reindexedRemainingItems.filter((i: any) => i.status === 'completed').length
              })
        };

        // Write both queues
        writeFileSync(newQueuePath, JSON.stringify(newQueue, null, 2));
        writeFileSync(sourcePath, JSON.stringify(sourceQueue, null, 2));

        // Update index
        const indexPath = join(queuesDir, 'index.json');
        if (existsSync(indexPath)) {
          try {
            const index = JSON.parse(readFileSync(indexPath, 'utf8'));

            // Add new queue to index
            const newQueueEntry: any = {
              id: newQueueId,
              status: 'active',
              issue_ids: splitIssueIds,
              created_at: new Date().toISOString(),
              ...(isSolutionBased
                ? {
                    total_solutions: reindexedSplitItems.length,
                    completed_solutions: reindexedSplitItems.filter((i: any) => i.status === 'completed').length
                  }
                : {
                    total_tasks: reindexedSplitItems.length,
                    completed_tasks: reindexedSplitItems.filter((i: any) => i.status === 'completed').length
                  })
            };

            index.queues = index.queues || [];
            index.queues.push(newQueueEntry);

            // Update source queue in index
            const sourceEntry = index.queues.find((q: any) => q.id === sourceQueueId);
            if (sourceEntry) {
              sourceEntry.issue_ids = remainingIssueIds;
              if (isSolutionBased) {
                sourceEntry.total_solutions = reindexedRemainingItems.length;
                sourceEntry.completed_solutions = reindexedRemainingItems.filter((i: any) => i.status === 'completed').length;
              } else {
                sourceEntry.total_tasks = reindexedRemainingItems.length;
                sourceEntry.completed_tasks = reindexedRemainingItems.filter((i: any) => i.status === 'completed').length;
              }
            }

            writeFileSync(indexPath, JSON.stringify(index, null, 2));
          } catch {
            // Ignore index update errors
          }
        }

        return {
          success: true,
          sourceQueueId,
          newQueueId,
          splitItemCount: itemsToSplit.length,
          remainingItemCount: remainingItems.length
        };
      } catch (err) {
        return { error: 'Failed to split queue' };
      }
    });
    return true;
  }

  // Legacy: GET /api/issues/queue (backward compat)
  if (pathname === '/api/issues/queue' && req.method === 'GET') {
    const queue = groupQueueByExecutionGroup(readQueue(issuesDir));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(queue));
    return true;
  }

  // ===== Issue Routes =====

  // GET /api/issues - List all issues
  if (pathname === '/api/issues' && req.method === 'GET') {
    const issues = enrichIssues(readIssuesJsonl(issuesDir), issuesDir);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      issues,
      _metadata: { version: '2.0', storage: 'jsonl', total_issues: issues.length, last_updated: new Date().toISOString() }
    }));
    return true;
  }

  // GET /api/issues/history - List completed issues from history
  if (pathname === '/api/issues/history' && req.method === 'GET') {
    const history = readIssueHistoryJsonl(issuesDir);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      issues: history,
      _metadata: { version: '1.0', storage: 'jsonl', total_issues: history.length, last_updated: new Date().toISOString() }
    }));
    return true;
  }

  // POST /api/issues - Create issue
  if (pathname === '/api/issues' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: any) => {
      if (!body.id || !body.title) return { error: 'id and title required' };

      const issues = readIssuesJsonl(issuesDir);
      if (issues.find(i => i.id === body.id)) return { error: `Issue ${body.id} exists` };

      const newIssue = {
        id: body.id,
        title: body.title,
        status: body.status || 'registered',
        priority: body.priority || 3,
        context: body.context || '',
        source: body.source || 'text',
        source_url: body.source_url || null,
        tags: body.tags || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      issues.push(newIssue);
      writeIssuesJsonl(issuesDir, issues);
      return { success: true, issue: newIssue };
    });
    return true;
  }

  // GET /api/issues/:id - Get issue detail
  const detailMatch = pathname.match(/^\/api\/issues\/([^/]+)$/);
  if (detailMatch && req.method === 'GET') {
    const issueId = decodeURIComponent(detailMatch[1]);
    if (issueId === 'queue') return false;

    const detail = getIssueDetail(issuesDir, issueId);
    if (!detail) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Issue not found' }));
      return true;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(detail));
    return true;
  }

  // PATCH /api/issues/:id - Update issue (with binding support)
  const updateMatch = pathname.match(/^\/api\/issues\/([^/]+)$/);
  if (updateMatch && req.method === 'PATCH') {
    const issueId = decodeURIComponent(updateMatch[1]);
    if (issueId === 'queue') return false;

    handlePostRequest(req, res, async (body: any) => {
      const issues = readIssuesJsonl(issuesDir);
      const issueIndex = issues.findIndex(i => i.id === issueId);
      if (issueIndex === -1) return { error: 'Issue not found' };

      const updates: string[] = [];

      // Handle binding if bound_solution_id provided
      if (body.bound_solution_id !== undefined) {
        if (body.bound_solution_id) {
          const bindResult = bindSolutionToIssue(issuesDir, issueId, body.bound_solution_id, issues, issueIndex);
          if (bindResult.error) return bindResult;
          updates.push('bound_solution_id');
        } else {
          // Unbind
          const solutions = readSolutionsJsonl(issuesDir, issueId);
          solutions.forEach(s => { s.is_bound = false; });
          writeSolutionsJsonl(issuesDir, issueId, solutions);
          issues[issueIndex].bound_solution_id = null;
          updates.push('bound_solution_id (unbound)');
        }
      }

      // Update other fields
      for (const field of ['title', 'context', 'status', 'priority', 'tags']) {
        if (body[field] !== undefined) {
          issues[issueIndex][field] = body[field];
          updates.push(field);
        }
      }

      issues[issueIndex].updated_at = new Date().toISOString();
      writeIssuesJsonl(issuesDir, issues);
      return { success: true, issueId, updated: updates };
    });
    return true;
  }

  // DELETE /api/issues/:id
  const deleteMatch = pathname.match(/^\/api\/issues\/([^/]+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const issueId = decodeURIComponent(deleteMatch[1]);

    const issues = readIssuesJsonl(issuesDir);
    const filtered = issues.filter(i => i.id !== issueId);
    if (filtered.length === issues.length) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Issue not found' }));
      return true;
    }

    writeIssuesJsonl(issuesDir, filtered);

    // Clean up solutions file
    const solPath = join(issuesDir, 'solutions', `${issueId}.jsonl`);
    if (existsSync(solPath)) {
      try { unlinkSync(solPath); } catch {}
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, issueId }));
    return true;
  }

  // POST /api/issues/:id/archive - Archive issue (move to history)
  const archiveMatch = pathname.match(/^\/api\/issues\/([^/]+)\/archive$/);
  if (archiveMatch && req.method === 'POST') {
    const issueId = decodeURIComponent(archiveMatch[1]);

    const issues = readIssuesJsonl(issuesDir);
    const issueIndex = issues.findIndex(i => i.id === issueId);

    if (issueIndex === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Issue not found' }));
      return true;
    }

    // Get the issue and add archive metadata
    const issue = issues[issueIndex];
    issue.archived_at = new Date().toISOString();
    issue.status = 'completed';

    // Move to history
    const history = readIssueHistoryJsonl(issuesDir);
    history.push(issue);
    writeIssueHistoryJsonl(issuesDir, history);

    // Remove from active issues
    issues.splice(issueIndex, 1);
    writeIssuesJsonl(issuesDir, issues);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, issueId, archivedAt: issue.archived_at }));
    return true;
  }

  // POST /api/issues/:id/solutions - Add solution
  const addSolMatch = pathname.match(/^\/api\/issues\/([^/]+)\/solutions$/);
  if (addSolMatch && req.method === 'POST') {
    const issueId = decodeURIComponent(addSolMatch[1]);

    handlePostRequest(req, res, async (body: any) => {
      if (!body.id || !body.tasks) return { error: 'id and tasks required' };

      const solutions = readSolutionsJsonl(issuesDir, issueId);
      if (solutions.find(s => s.id === body.id)) return { error: `Solution ${body.id} exists` };

      const newSolution = {
        id: body.id,
        description: body.description || '',
        tasks: body.tasks,
        exploration_context: body.exploration_context || {},
        analysis: body.analysis || {},
        score: body.score || 0,
        is_bound: false,
        created_at: new Date().toISOString()
      };

      solutions.push(newSolution);
      writeSolutionsJsonl(issuesDir, issueId, solutions);

      // Update issue solution_count
      const issues = readIssuesJsonl(issuesDir);
      const idx = issues.findIndex(i => i.id === issueId);
      if (idx !== -1) {
        issues[idx].solution_count = solutions.length;
        issues[idx].updated_at = new Date().toISOString();
        writeIssuesJsonl(issuesDir, issues);
      }

      return { success: true, solution: newSolution };
    });
    return true;
  }

  // PATCH /api/issues/:id/tasks/:taskId - Update task
  const taskMatch = pathname.match(/^\/api\/issues\/([^/]+)\/tasks\/([^/]+)$/);
  if (taskMatch && req.method === 'PATCH') {
    const issueId = decodeURIComponent(taskMatch[1]);
    const taskId = decodeURIComponent(taskMatch[2]);

    handlePostRequest(req, res, async (body: any) => {
      const issues = readIssuesJsonl(issuesDir);
      const issue = issues.find(i => i.id === issueId);
      if (!issue?.bound_solution_id) return { error: 'Issue or bound solution not found' };

      const solutions = readSolutionsJsonl(issuesDir, issueId);
      const solIdx = solutions.findIndex(s => s.id === issue.bound_solution_id);
      if (solIdx === -1) return { error: 'Bound solution not found' };

      const taskIdx = solutions[solIdx].tasks?.findIndex((t: any) => t.id === taskId);
      if (taskIdx === -1 || taskIdx === undefined) return { error: 'Task not found' };

      const updates: string[] = [];
      for (const field of ['status', 'priority', 'result', 'error']) {
        if (body[field] !== undefined) {
          solutions[solIdx].tasks[taskIdx][field] = body[field];
          updates.push(field);
        }
      }
      solutions[solIdx].tasks[taskIdx].updated_at = new Date().toISOString();
      writeSolutionsJsonl(issuesDir, issueId, solutions);

      return { success: true, issueId, taskId, updated: updates };
    });
    return true;
  }

  // Legacy: PUT /api/issues/:id/task/:taskId (backward compat)
  const legacyTaskMatch = pathname.match(/^\/api\/issues\/([^/]+)\/task\/([^/]+)$/);
  if (legacyTaskMatch && req.method === 'PUT') {
    const issueId = decodeURIComponent(legacyTaskMatch[1]);
    const taskId = decodeURIComponent(legacyTaskMatch[2]);

    handlePostRequest(req, res, async (body: any) => {
      const issues = readIssuesJsonl(issuesDir);
      const issue = issues.find(i => i.id === issueId);
      if (!issue?.bound_solution_id) return { error: 'Issue or bound solution not found' };

      const solutions = readSolutionsJsonl(issuesDir, issueId);
      const solIdx = solutions.findIndex(s => s.id === issue.bound_solution_id);
      if (solIdx === -1) return { error: 'Bound solution not found' };

      const taskIdx = solutions[solIdx].tasks?.findIndex((t: any) => t.id === taskId);
      if (taskIdx === -1 || taskIdx === undefined) return { error: 'Task not found' };

      const updates: string[] = [];
      if (body.status !== undefined) { solutions[solIdx].tasks[taskIdx].status = body.status; updates.push('status'); }
      if (body.priority !== undefined) { solutions[solIdx].tasks[taskIdx].priority = body.priority; updates.push('priority'); }
      solutions[solIdx].tasks[taskIdx].updated_at = new Date().toISOString();
      writeSolutionsJsonl(issuesDir, issueId, solutions);

      return { success: true, issueId, taskId, updated: updates };
    });
    return true;
  }

  // Legacy: PUT /api/issues/:id/bind/:solutionId (backward compat)
  const legacyBindMatch = pathname.match(/^\/api\/issues\/([^/]+)\/bind\/([^/]+)$/);
  if (legacyBindMatch && req.method === 'PUT') {
    const issueId = decodeURIComponent(legacyBindMatch[1]);
    const solutionId = decodeURIComponent(legacyBindMatch[2]);

    const issues = readIssuesJsonl(issuesDir);
    const issueIndex = issues.findIndex(i => i.id === issueId);
    if (issueIndex === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Issue not found' }));
      return true;
    }

    const result = bindSolutionToIssue(issuesDir, issueId, solutionId, issues, issueIndex);
    if (result.error) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return true;
    }

    issues[issueIndex].updated_at = new Date().toISOString();
    writeIssuesJsonl(issuesDir, issues);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, issueId, solutionId }));
    return true;
  }

  // Legacy: PUT /api/issues/:id (backward compat for PATCH)
  const legacyUpdateMatch = pathname.match(/^\/api\/issues\/([^/]+)$/);
  if (legacyUpdateMatch && req.method === 'PUT') {
    const issueId = decodeURIComponent(legacyUpdateMatch[1]);
    if (issueId === 'queue') return false;

    handlePostRequest(req, res, async (body: any) => {
      const issues = readIssuesJsonl(issuesDir);
      const issueIndex = issues.findIndex(i => i.id === issueId);
      if (issueIndex === -1) return { error: 'Issue not found' };

      const updates: string[] = [];
      for (const field of ['title', 'context', 'status', 'priority', 'bound_solution_id', 'tags']) {
        if (body[field] !== undefined) {
          issues[issueIndex][field] = body[field];
          updates.push(field);
        }
      }

      issues[issueIndex].updated_at = new Date().toISOString();
      writeIssuesJsonl(issuesDir, issues);
      return { success: true, issueId, updated: updates };
    });
    return true;
  }

  return false;
}
