// @ts-nocheck
/**
 * Issue Routes Module (Optimized - Flat JSONL Storage)
 *
 * Storage Structure:
 * .workflow/issues/
 * ├── issues.jsonl              # All issues (one per line)
 * ├── queue.json                # Execution queue
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
import type { IncomingMessage, ServerResponse } from 'http';
import { readFileSync, existsSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';

export interface RouteContext {
  pathname: string;
  url: URL;
  req: IncomingMessage;
  res: ServerResponse;
  initialPath: string;
  handlePostRequest: (req: IncomingMessage, res: ServerResponse, handler: (body: unknown) => Promise<any>) => void;
  broadcastToClients: (data: unknown) => void;
}

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

function writeSolutionsJsonl(issuesDir: string, issueId: string, solutions: any[]) {
  const solutionsDir = join(issuesDir, 'solutions');
  if (!existsSync(solutionsDir)) mkdirSync(solutionsDir, { recursive: true });
  writeFileSync(join(solutionsDir, `${issueId}.jsonl`), solutions.map(s => JSON.stringify(s)).join('\n'));
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

  return { queue: [], conflicts: [], execution_groups: [], _metadata: { version: '1.0', total_tasks: 0 } };
}

function writeQueue(issuesDir: string, queue: any) {
  if (!existsSync(issuesDir)) mkdirSync(issuesDir, { recursive: true });
  queue._metadata = { ...queue._metadata, updated_at: new Date().toISOString(), total_tasks: queue.queue?.length || 0 };

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
        queueEntry.total_tasks = queue.queue?.length || 0;
        queueEntry.completed_tasks = queue.queue?.filter((i: any) => i.status === 'completed').length || 0;
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
  const issue = issues.find(i => i.id === issueId);
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
  return issues.map(issue => ({
    ...issue,
    solution_count: readSolutionsJsonl(issuesDir, issue.id).length
  }));
}

function groupQueueByExecutionGroup(queue: any) {
  const groups: { [key: string]: any[] } = {};
  for (const item of queue.queue || []) {
    const groupId = item.execution_group || 'ungrouped';
    if (!groups[groupId]) groups[groupId] = [];
    groups[groupId].push(item);
  }
  for (const groupId of Object.keys(groups)) {
    groups[groupId].sort((a, b) => (a.execution_order || 0) - (b.execution_order || 0));
  }
  const executionGroups = Object.entries(groups).map(([id, items]) => ({
    id,
    type: id.startsWith('P') ? 'parallel' : id.startsWith('S') ? 'sequential' : 'unknown',
    task_count: items.length,
    tasks: items.map(i => i.queue_id)
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

// ========== Route Handler ==========

export async function handleIssueRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath, handlePostRequest } = ctx;
  const projectPath = url.searchParams.get('path') || initialPath;
  const issuesDir = join(projectPath, '.workflow', 'issues');

  // ===== Queue Routes (top-level /api/queue) =====

  // GET /api/queue - Get execution queue
  if (pathname === '/api/queue' && req.method === 'GET') {
    const queue = groupQueueByExecutionGroup(readQueue(issuesDir));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(queue));
    return true;
  }

  // POST /api/queue/reorder - Reorder queue items
  if (pathname === '/api/queue/reorder' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: any) => {
      const { groupId, newOrder } = body;
      if (!groupId || !Array.isArray(newOrder)) {
        return { error: 'groupId and newOrder (array) required' };
      }

      const queue = readQueue(issuesDir);
      const groupItems = queue.queue.filter((item: any) => item.execution_group === groupId);
      const otherItems = queue.queue.filter((item: any) => item.execution_group !== groupId);

      if (groupItems.length === 0) return { error: `No items in group ${groupId}` };

      const groupQueueIds = new Set(groupItems.map((i: any) => i.queue_id));
      if (groupQueueIds.size !== new Set(newOrder).size) {
        return { error: 'newOrder must contain all group items' };
      }
      for (const id of newOrder) {
        if (!groupQueueIds.has(id)) return { error: `Invalid queue_id: ${id}` };
      }

      const itemMap = new Map(groupItems.map((i: any) => [i.queue_id, i]));
      const reorderedItems = newOrder.map((qid: string, idx: number) => ({ ...itemMap.get(qid), _idx: idx }));
      const newQueue = [...otherItems, ...reorderedItems].sort((a, b) => {
        const aGroup = parseInt(a.execution_group?.match(/\d+/)?.[0] || '999');
        const bGroup = parseInt(b.execution_group?.match(/\d+/)?.[0] || '999');
        if (aGroup !== bGroup) return aGroup - bGroup;
        if (a.execution_group === b.execution_group) {
          return (a._idx ?? a.execution_order ?? 999) - (b._idx ?? b.execution_order ?? 999);
        }
        return (a.execution_order || 0) - (b.execution_order || 0);
      });

      newQueue.forEach((item, idx) => { item.execution_order = idx + 1; delete item._idx; });
      queue.queue = newQueue;
      writeQueue(issuesDir, queue);

      return { success: true, groupId, reordered: newOrder.length };
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
        labels: body.labels || [],
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
      for (const field of ['title', 'context', 'status', 'priority', 'labels']) {
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
      for (const field of ['title', 'context', 'status', 'priority', 'bound_solution_id', 'labels']) {
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
