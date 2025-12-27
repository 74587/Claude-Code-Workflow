/**
 * Issue Command - Unified JSONL storage with CLI & API compatibility
 * Storage: issues.jsonl + solutions/{issue-id}.jsonl + queue.json
 * Commands: init, list, status, task, bind, queue, next, done, retry
 */

import chalk from 'chalk';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

// Handle EPIPE errors gracefully
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') {
    process.exit(0);
  }
  throw err;
});

// ============ Interfaces ============

interface Issue {
  id: string;
  title: string;
  status: 'registered' | 'planning' | 'planned' | 'queued' | 'executing' | 'completed' | 'failed' | 'paused';
  priority: number;
  context: string;
  bound_solution_id: string | null;
  solution_count: number;
  source?: string;
  source_url?: string;
  labels?: string[];
  created_at: string;
  updated_at: string;
  planned_at?: string;
  queued_at?: string;
  completed_at?: string;
}

interface SolutionTask {
  id: string;
  title: string;
  scope: string;
  action: string;
  description?: string;
  modification_points?: { file: string; target: string; change: string }[];
  implementation: string[];
  acceptance: string[];
  depends_on: string[];
  estimated_minutes?: number;
  executor: 'codex' | 'gemini' | 'agent' | 'auto';
  status?: string;
  priority?: number;
}

interface Solution {
  id: string;
  description?: string;
  tasks: SolutionTask[];
  exploration_context?: Record<string, any>;
  analysis?: { risk?: string; impact?: string; complexity?: string };
  score?: number;
  is_bound: boolean;
  created_at: string;
  bound_at?: string;
}

interface QueueItem {
  queue_id: string;
  issue_id: string;
  solution_id: string;
  task_id: string;
  status: 'pending' | 'ready' | 'executing' | 'completed' | 'failed' | 'blocked';
  execution_order: number;
  execution_group: string;
  depends_on: string[];
  semantic_priority: number;
  assigned_executor: 'codex' | 'gemini' | 'agent';
  queued_at: string;
  started_at?: string;
  completed_at?: string;
  result?: Record<string, any>;
  failure_reason?: string;
}

interface Queue {
  queue: QueueItem[];
  conflicts: any[];
  _metadata: {
    version: string;
    total_tasks: number;
    pending_count: number;
    executing_count: number;
    completed_count: number;
    failed_count: number;
    last_updated: string;
  };
}

interface IssueOptions {
  status?: string;
  title?: string;
  description?: string;
  executor?: string;
  priority?: string;
  solution?: string;
  result?: string;
  reason?: string;
  json?: boolean;
  force?: boolean;
  fail?: boolean;
}

const ISSUES_DIR = '.workflow/issues';

// ============ Storage Layer (JSONL) ============

function getProjectRoot(): string {
  let dir = process.cwd();
  while (dir !== resolve(dir, '..')) {
    if (existsSync(join(dir, '.workflow')) || existsSync(join(dir, '.git'))) {
      return dir;
    }
    dir = resolve(dir, '..');
  }
  return process.cwd();
}

function getIssuesDir(): string {
  return join(getProjectRoot(), ISSUES_DIR);
}

function ensureIssuesDir(): void {
  const dir = getIssuesDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// ============ Issues JSONL ============

function readIssues(): Issue[] {
  const path = join(getIssuesDir(), 'issues.jsonl');
  if (!existsSync(path)) return [];
  try {
    return readFileSync(path, 'utf-8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

function writeIssues(issues: Issue[]): void {
  ensureIssuesDir();
  const path = join(getIssuesDir(), 'issues.jsonl');
  writeFileSync(path, issues.map(i => JSON.stringify(i)).join('\n'), 'utf-8');
}

function findIssue(issueId: string): Issue | undefined {
  return readIssues().find(i => i.id === issueId);
}

function updateIssue(issueId: string, updates: Partial<Issue>): boolean {
  const issues = readIssues();
  const idx = issues.findIndex(i => i.id === issueId);
  if (idx === -1) return false;
  issues[idx] = { ...issues[idx], ...updates, updated_at: new Date().toISOString() };
  writeIssues(issues);
  return true;
}

// ============ Solutions JSONL ============

function getSolutionsPath(issueId: string): string {
  return join(getIssuesDir(), 'solutions', `${issueId}.jsonl`);
}

function readSolutions(issueId: string): Solution[] {
  const path = getSolutionsPath(issueId);
  if (!existsSync(path)) return [];
  try {
    return readFileSync(path, 'utf-8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

function writeSolutions(issueId: string, solutions: Solution[]): void {
  const dir = join(getIssuesDir(), 'solutions');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(getSolutionsPath(issueId), solutions.map(s => JSON.stringify(s)).join('\n'), 'utf-8');
}

function findSolution(issueId: string, solutionId: string): Solution | undefined {
  return readSolutions(issueId).find(s => s.id === solutionId);
}

function getBoundSolution(issueId: string): Solution | undefined {
  return readSolutions(issueId).find(s => s.is_bound);
}

function generateSolutionId(): string {
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `SOL-${ts}`;
}

// ============ Queue JSON ============

function readQueue(): Queue {
  const path = join(getIssuesDir(), 'queue.json');
  if (!existsSync(path)) {
    return {
      queue: [],
      conflicts: [],
      _metadata: {
        version: '2.0',
        total_tasks: 0,
        pending_count: 0,
        executing_count: 0,
        completed_count: 0,
        failed_count: 0,
        last_updated: new Date().toISOString()
      }
    };
  }
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function writeQueue(queue: Queue): void {
  ensureIssuesDir();
  queue._metadata.total_tasks = queue.queue.length;
  queue._metadata.pending_count = queue.queue.filter(q => q.status === 'pending').length;
  queue._metadata.executing_count = queue.queue.filter(q => q.status === 'executing').length;
  queue._metadata.completed_count = queue.queue.filter(q => q.status === 'completed').length;
  queue._metadata.failed_count = queue.queue.filter(q => q.status === 'failed').length;
  queue._metadata.last_updated = new Date().toISOString();
  writeFileSync(join(getIssuesDir(), 'queue.json'), JSON.stringify(queue, null, 2), 'utf-8');
}

function generateQueueId(queue: Queue): string {
  const maxNum = queue.queue.reduce((max, q) => {
    const match = q.queue_id.match(/^Q-(\d+)$/);
    return match ? Math.max(max, parseInt(match[1])) : max;
  }, 0);
  return `Q-${String(maxNum + 1).padStart(3, '0')}`;
}

// ============ Commands ============

/**
 * init - Initialize a new issue
 */
async function initAction(issueId: string | undefined, options: IssueOptions): Promise<void> {
  if (!issueId) {
    console.error(chalk.red('Issue ID is required'));
    console.error(chalk.gray('Usage: ccw issue init <issue-id> [--title "..."]'));
    process.exit(1);
  }

  const existing = findIssue(issueId);
  if (existing && !options.force) {
    console.error(chalk.red(`Issue "${issueId}" already exists`));
    console.error(chalk.gray('Use --force to reinitialize'));
    process.exit(1);
  }

  const issues = readIssues().filter(i => i.id !== issueId);
  const newIssue: Issue = {
    id: issueId,
    title: options.title || issueId,
    status: 'registered',
    priority: options.priority ? parseInt(options.priority) : 3,
    context: options.description || '',
    bound_solution_id: null,
    solution_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  issues.push(newIssue);
  writeIssues(issues);

  console.log(chalk.green(`✓ Issue "${issueId}" initialized`));
  console.log(chalk.gray(`  Next: ccw issue task ${issueId} --title "Task title"`));
}

/**
 * list - List issues or tasks
 */
async function listAction(issueId: string | undefined, options: IssueOptions): Promise<void> {
  if (!issueId) {
    // List all issues
    const issues = readIssues();

    if (options.json) {
      console.log(JSON.stringify(issues, null, 2));
      return;
    }

    if (issues.length === 0) {
      console.log(chalk.yellow('No issues found'));
      console.log(chalk.gray('Create one with: ccw issue init <issue-id>'));
      return;
    }

    console.log(chalk.bold.cyan('\nIssues\n'));
    console.log(chalk.gray('ID'.padEnd(20) + 'Status'.padEnd(15) + 'Solutions'.padEnd(12) + 'Title'));
    console.log(chalk.gray('-'.repeat(70)));

    for (const issue of issues) {
      const statusColor = {
        'registered': chalk.gray,
        'planning': chalk.blue,
        'planned': chalk.cyan,
        'queued': chalk.yellow,
        'executing': chalk.yellow,
        'completed': chalk.green,
        'failed': chalk.red,
        'paused': chalk.magenta
      }[issue.status] || chalk.white;

      const bound = issue.bound_solution_id ? `[${issue.bound_solution_id}]` : `${issue.solution_count}`;
      console.log(
        issue.id.padEnd(20) +
        statusColor(issue.status.padEnd(15)) +
        bound.padEnd(12) +
        (issue.title || '').substring(0, 30)
      );
    }
    return;
  }

  // List tasks in bound solution
  const issue = findIssue(issueId);
  if (!issue) {
    console.error(chalk.red(`Issue "${issueId}" not found`));
    process.exit(1);
  }

  const solution = getBoundSolution(issueId);
  const tasks = solution?.tasks || [];

  if (options.json) {
    console.log(JSON.stringify({ issue, solution, tasks }, null, 2));
    return;
  }

  console.log(chalk.bold.cyan(`\nIssue: ${issueId}\n`));
  console.log(`Title: ${issue.title}`);
  console.log(`Status: ${issue.status}`);
  console.log(`Bound: ${issue.bound_solution_id || 'none'}`);
  console.log();

  if (tasks.length === 0) {
    console.log(chalk.yellow('No tasks (bind a solution first)'));
    return;
  }

  console.log(chalk.gray('ID'.padEnd(8) + 'Action'.padEnd(12) + 'Scope'.padEnd(20) + 'Title'));
  console.log(chalk.gray('-'.repeat(70)));

  for (const task of tasks) {
    console.log(
      task.id.padEnd(8) +
      task.action.padEnd(12) +
      task.scope.substring(0, 18).padEnd(20) +
      task.title.substring(0, 30)
    );
  }
}

/**
 * status - Show detailed status
 */
async function statusAction(issueId: string | undefined, options: IssueOptions): Promise<void> {
  if (!issueId) {
    // Show queue status
    const queue = readQueue();
    const issues = readIssues();

    if (options.json) {
      console.log(JSON.stringify({ queue: queue._metadata, issues: issues.length }, null, 2));
      return;
    }

    console.log(chalk.bold.cyan('\nSystem Status\n'));
    console.log(`Issues: ${issues.length}`);
    console.log(`Queue: ${queue._metadata.total_tasks} tasks`);
    console.log(`  Pending: ${queue._metadata.pending_count}`);
    console.log(`  Executing: ${queue._metadata.executing_count}`);
    console.log(`  Completed: ${queue._metadata.completed_count}`);
    console.log(`  Failed: ${queue._metadata.failed_count}`);
    return;
  }

  const issue = findIssue(issueId);
  if (!issue) {
    console.error(chalk.red(`Issue "${issueId}" not found`));
    process.exit(1);
  }

  const solutions = readSolutions(issueId);
  const boundSol = solutions.find(s => s.is_bound);

  if (options.json) {
    console.log(JSON.stringify({ issue, solutions, bound: boundSol }, null, 2));
    return;
  }

  console.log(chalk.bold.cyan(`\nIssue: ${issueId}\n`));
  console.log(`Title: ${issue.title}`);
  console.log(`Status: ${issue.status}`);
  console.log(`Priority: ${issue.priority}`);
  console.log(`Created: ${issue.created_at}`);
  console.log(`Updated: ${issue.updated_at}`);

  if (issue.context) {
    console.log();
    console.log(chalk.bold('Context:'));
    console.log(issue.context.substring(0, 200));
  }

  console.log();
  console.log(chalk.bold(`Solutions (${solutions.length}):`));
  for (const sol of solutions) {
    const marker = sol.is_bound ? chalk.green('◉') : chalk.gray('○');
    console.log(`  ${marker} ${sol.id}: ${sol.tasks.length} tasks`);
  }
}

/**
 * task - Add or update task (simplified - mainly for manual task management)
 */
async function taskAction(issueId: string | undefined, taskId: string | undefined, options: IssueOptions): Promise<void> {
  if (!issueId) {
    console.error(chalk.red('Issue ID is required'));
    console.error(chalk.gray('Usage: ccw issue task <issue-id> [task-id] --title "..."'));
    process.exit(1);
  }

  const issue = findIssue(issueId);
  if (!issue) {
    console.error(chalk.red(`Issue "${issueId}" not found`));
    process.exit(1);
  }

  const solutions = readSolutions(issueId);
  let boundIdx = solutions.findIndex(s => s.is_bound);

  // Create default solution if none bound
  if (boundIdx === -1) {
    const newSol: Solution = {
      id: generateSolutionId(),
      description: 'Manual tasks',
      tasks: [],
      is_bound: true,
      created_at: new Date().toISOString(),
      bound_at: new Date().toISOString()
    };
    solutions.push(newSol);
    boundIdx = solutions.length - 1;
    updateIssue(issueId, { bound_solution_id: newSol.id, status: 'planned' });
  }

  const solution = solutions[boundIdx];

  if (taskId) {
    // Update existing task
    const taskIdx = solution.tasks.findIndex(t => t.id === taskId);
    if (taskIdx === -1) {
      console.error(chalk.red(`Task "${taskId}" not found`));
      process.exit(1);
    }

    if (options.title) solution.tasks[taskIdx].title = options.title;
    if (options.status) solution.tasks[taskIdx].status = options.status;
    if (options.executor) solution.tasks[taskIdx].executor = options.executor as any;

    writeSolutions(issueId, solutions);
    console.log(chalk.green(`✓ Task ${taskId} updated`));
  } else {
    // Add new task
    if (!options.title) {
      console.error(chalk.red('Task title is required (--title)'));
      process.exit(1);
    }

    const newTaskId = `T${solution.tasks.length + 1}`;
    const newTask: SolutionTask = {
      id: newTaskId,
      title: options.title,
      scope: '',
      action: 'Implement',
      description: options.description || options.title,
      implementation: [],
      acceptance: ['Task completed successfully'],
      depends_on: [],
      executor: (options.executor as any) || 'auto'
    };

    solution.tasks.push(newTask);
    writeSolutions(issueId, solutions);
    console.log(chalk.green(`✓ Task ${newTaskId} added to ${issueId}`));
  }
}

/**
 * bind - Register and/or bind a solution
 */
async function bindAction(issueId: string | undefined, solutionId: string | undefined, options: IssueOptions): Promise<void> {
  if (!issueId) {
    console.error(chalk.red('Issue ID is required'));
    console.error(chalk.gray('Usage: ccw issue bind <issue-id> [solution-id] [--solution <path>]'));
    process.exit(1);
  }

  const issue = findIssue(issueId);
  if (!issue) {
    console.error(chalk.red(`Issue "${issueId}" not found`));
    process.exit(1);
  }

  let solutions = readSolutions(issueId);

  // Register new solution from file if provided
  if (options.solution) {
    try {
      const content = readFileSync(options.solution, 'utf-8');
      const data = JSON.parse(content);
      const newSol: Solution = {
        id: solutionId || generateSolutionId(),
        description: data.description || data.approach_name || 'Imported solution',
        tasks: data.tasks || [],
        exploration_context: data.exploration_context,
        analysis: data.analysis,
        score: data.score,
        is_bound: false,
        created_at: new Date().toISOString()
      };
      solutions.push(newSol);
      solutionId = newSol.id;
      console.log(chalk.green(`✓ Solution ${solutionId} registered (${newSol.tasks.length} tasks)`));
    } catch (e) {
      console.error(chalk.red(`Failed to read solution file: ${options.solution}`));
      process.exit(1);
    }
  }

  if (!solutionId) {
    // List available solutions
    if (solutions.length === 0) {
      console.log(chalk.yellow('No solutions available'));
      console.log(chalk.gray('Register one: ccw issue bind <issue-id> --solution <path>'));
      return;
    }

    console.log(chalk.bold.cyan(`\nSolutions for ${issueId}:\n`));
    for (const sol of solutions) {
      const marker = sol.is_bound ? chalk.green('◉') : chalk.gray('○');
      console.log(`  ${marker} ${sol.id}: ${sol.tasks.length} tasks - ${sol.description || ''}`);
    }
    return;
  }

  // Bind the specified solution
  const solIdx = solutions.findIndex(s => s.id === solutionId);
  if (solIdx === -1) {
    console.error(chalk.red(`Solution "${solutionId}" not found`));
    process.exit(1);
  }

  // Unbind all, bind selected
  solutions = solutions.map(s => ({ ...s, is_bound: false }));
  solutions[solIdx].is_bound = true;
  solutions[solIdx].bound_at = new Date().toISOString();

  writeSolutions(issueId, solutions);
  updateIssue(issueId, {
    bound_solution_id: solutionId,
    solution_count: solutions.length,
    status: 'planned',
    planned_at: new Date().toISOString()
  });

  console.log(chalk.green(`✓ Solution ${solutionId} bound to ${issueId}`));
}

/**
 * queue - Queue management (list / add)
 */
async function queueAction(subAction: string | undefined, issueId: string | undefined, options: IssueOptions): Promise<void> {
  const queue = readQueue();

  if (subAction === 'add' && issueId) {
    // Add issue tasks to queue
    const issue = findIssue(issueId);
    if (!issue) {
      console.error(chalk.red(`Issue "${issueId}" not found`));
      process.exit(1);
    }

    const solution = getBoundSolution(issueId);
    if (!solution) {
      console.error(chalk.red(`No bound solution for "${issueId}"`));
      console.error(chalk.gray('First bind a solution: ccw issue bind <issue-id> <solution-id>'));
      process.exit(1);
    }

    let added = 0;
    for (const task of solution.tasks) {
      const exists = queue.queue.some(q => q.issue_id === issueId && q.task_id === task.id);
      if (exists) continue;

      queue.queue.push({
        queue_id: generateQueueId(queue),
        issue_id: issueId,
        solution_id: solution.id,
        task_id: task.id,
        status: 'pending',
        execution_order: queue.queue.length + 1,
        execution_group: 'P1',
        depends_on: task.depends_on.map(dep => {
          const depItem = queue.queue.find(q => q.task_id === dep && q.issue_id === issueId);
          return depItem?.queue_id || dep;
        }),
        semantic_priority: 0.5,
        assigned_executor: task.executor === 'auto' ? 'codex' : task.executor as any,
        queued_at: new Date().toISOString()
      });
      added++;
    }

    writeQueue(queue);
    updateIssue(issueId, { status: 'queued', queued_at: new Date().toISOString() });

    console.log(chalk.green(`✓ Added ${added} tasks to queue from ${solution.id}`));
    return;
  }

  // List queue
  if (options.json) {
    console.log(JSON.stringify(queue, null, 2));
    return;
  }

  console.log(chalk.bold.cyan('\nExecution Queue\n'));
  console.log(chalk.gray(`Total: ${queue._metadata.total_tasks} | Pending: ${queue._metadata.pending_count} | Executing: ${queue._metadata.executing_count} | Completed: ${queue._metadata.completed_count}`));
  console.log();

  if (queue.queue.length === 0) {
    console.log(chalk.yellow('Queue is empty'));
    console.log(chalk.gray('Add tasks: ccw issue queue add <issue-id>'));
    return;
  }

  console.log(chalk.gray('QueueID'.padEnd(10) + 'Issue'.padEnd(15) + 'Task'.padEnd(8) + 'Status'.padEnd(12) + 'Executor'));
  console.log(chalk.gray('-'.repeat(60)));

  for (const item of queue.queue) {
    const statusColor = {
      'pending': chalk.gray,
      'ready': chalk.cyan,
      'executing': chalk.yellow,
      'completed': chalk.green,
      'failed': chalk.red,
      'blocked': chalk.magenta
    }[item.status] || chalk.white;

    console.log(
      item.queue_id.padEnd(10) +
      item.issue_id.substring(0, 13).padEnd(15) +
      item.task_id.padEnd(8) +
      statusColor(item.status.padEnd(12)) +
      item.assigned_executor
    );
  }
}

/**
 * next - Get next ready task for execution (JSON output)
 */
async function nextAction(options: IssueOptions): Promise<void> {
  const queue = readQueue();

  // Find ready tasks
  const readyTasks = queue.queue.filter(item => {
    if (item.status !== 'pending') return false;
    return item.depends_on.every(depId => {
      const dep = queue.queue.find(q => q.queue_id === depId);
      return !dep || dep.status === 'completed';
    });
  });

  if (readyTasks.length === 0) {
    console.log(JSON.stringify({
      status: 'empty',
      message: 'No ready tasks',
      queue_status: queue._metadata
    }, null, 2));
    return;
  }

  // Sort by execution order
  readyTasks.sort((a, b) => a.execution_order - b.execution_order);
  const nextItem = readyTasks[0];

  // Load task definition
  const solution = findSolution(nextItem.issue_id, nextItem.solution_id);
  const taskDef = solution?.tasks.find(t => t.id === nextItem.task_id);

  if (!taskDef) {
    console.log(JSON.stringify({ status: 'error', message: 'Task definition not found' }));
    process.exit(1);
  }

  // Mark as executing
  const idx = queue.queue.findIndex(q => q.queue_id === nextItem.queue_id);
  queue.queue[idx].status = 'executing';
  queue.queue[idx].started_at = new Date().toISOString();
  writeQueue(queue);

  // Update issue status
  updateIssue(nextItem.issue_id, { status: 'executing' });

  console.log(JSON.stringify({
    queue_id: nextItem.queue_id,
    issue_id: nextItem.issue_id,
    solution_id: nextItem.solution_id,
    task: taskDef,
    context: solution?.exploration_context || {},
    execution_hints: {
      executor: nextItem.assigned_executor,
      estimated_minutes: taskDef.estimated_minutes || 30
    }
  }, null, 2));
}

/**
 * done - Mark task completed or failed
 */
async function doneAction(queueId: string | undefined, options: IssueOptions): Promise<void> {
  if (!queueId) {
    console.error(chalk.red('Queue ID is required'));
    console.error(chalk.gray('Usage: ccw issue done <queue-id> [--fail] [--reason "..."]'));
    process.exit(1);
  }

  const queue = readQueue();
  const idx = queue.queue.findIndex(q => q.queue_id === queueId);

  if (idx === -1) {
    console.error(chalk.red(`Queue item "${queueId}" not found`));
    process.exit(1);
  }

  const isFail = options.fail;
  queue.queue[idx].status = isFail ? 'failed' : 'completed';
  queue.queue[idx].completed_at = new Date().toISOString();

  if (isFail) {
    queue.queue[idx].failure_reason = options.reason || 'Unknown failure';
  } else if (options.result) {
    try {
      queue.queue[idx].result = JSON.parse(options.result);
    } catch {
      console.warn(chalk.yellow('Warning: Could not parse result JSON'));
    }
  }

  writeQueue(queue);

  // Check if all issue tasks are complete
  const issueId = queue.queue[idx].issue_id;
  const issueTasks = queue.queue.filter(q => q.issue_id === issueId);
  const allComplete = issueTasks.every(q => q.status === 'completed');
  const anyFailed = issueTasks.some(q => q.status === 'failed');

  if (allComplete) {
    updateIssue(issueId, { status: 'completed', completed_at: new Date().toISOString() });
    console.log(chalk.green(`✓ ${queueId} completed`));
    console.log(chalk.green(`✓ Issue ${issueId} completed (all tasks done)`));
  } else if (anyFailed) {
    updateIssue(issueId, { status: 'failed' });
    console.log(chalk.red(`✗ ${queueId} failed`));
  } else {
    console.log(isFail ? chalk.red(`✗ ${queueId} failed`) : chalk.green(`✓ ${queueId} completed`));
  }
}

/**
 * retry - Retry failed tasks
 */
async function retryAction(issueId: string | undefined, options: IssueOptions): Promise<void> {
  const queue = readQueue();
  let updated = 0;

  for (const item of queue.queue) {
    if (item.status === 'failed') {
      if (!issueId || item.issue_id === issueId) {
        item.status = 'pending';
        item.failure_reason = undefined;
        item.started_at = undefined;
        item.completed_at = undefined;
        updated++;
      }
    }
  }

  if (updated === 0) {
    console.log(chalk.yellow('No failed tasks to retry'));
    return;
  }

  writeQueue(queue);

  if (issueId) {
    updateIssue(issueId, { status: 'queued' });
  }

  console.log(chalk.green(`✓ Reset ${updated} task(s) to pending`));
}

// ============ Main Entry ============

export async function issueCommand(
  subcommand: string,
  args: string | string[],
  options: IssueOptions
): Promise<void> {
  const argsArray = Array.isArray(args) ? args : (args ? [args] : []);

  switch (subcommand) {
    case 'init':
      await initAction(argsArray[0], options);
      break;
    case 'list':
      await listAction(argsArray[0], options);
      break;
    case 'status':
      await statusAction(argsArray[0], options);
      break;
    case 'task':
      await taskAction(argsArray[0], argsArray[1], options);
      break;
    case 'bind':
      await bindAction(argsArray[0], argsArray[1], options);
      break;
    case 'queue':
      await queueAction(argsArray[0], argsArray[1], options);
      break;
    case 'next':
      await nextAction(options);
      break;
    case 'done':
      await doneAction(argsArray[0], options);
      break;
    case 'retry':
      await retryAction(argsArray[0], options);
      break;
    // Legacy aliases
    case 'register':
      console.log(chalk.yellow('Deprecated: use "ccw issue bind <issue-id> --solution <path>"'));
      await bindAction(argsArray[0], undefined, options);
      break;
    case 'complete':
      await doneAction(argsArray[0], options);
      break;
    case 'fail':
      await doneAction(argsArray[0], { ...options, fail: true });
      break;
    default:
      console.log(chalk.bold.cyan('\nCCW Issue Management (v2.0 - Unified JSONL)\n'));
      console.log(chalk.bold('Core Commands:'));
      console.log(chalk.gray('  init <issue-id>                    Initialize new issue'));
      console.log(chalk.gray('  list [issue-id]                    List issues or tasks'));
      console.log(chalk.gray('  status [issue-id]                  Show detailed status'));
      console.log(chalk.gray('  task <issue-id> [task-id]          Add or update task'));
      console.log(chalk.gray('  bind <issue-id> [sol-id]           Bind solution (--solution <path> to register)'));
      console.log();
      console.log(chalk.bold('Queue Commands:'));
      console.log(chalk.gray('  queue [list]                       Show execution queue'));
      console.log(chalk.gray('  queue add <issue-id>               Add bound solution tasks to queue'));
      console.log(chalk.gray('  retry [issue-id]                   Retry failed tasks'));
      console.log();
      console.log(chalk.bold('Execution Endpoints:'));
      console.log(chalk.gray('  next                               Get next ready task (JSON)'));
      console.log(chalk.gray('  done <queue-id>                    Mark task completed'));
      console.log(chalk.gray('  done <queue-id> --fail             Mark task failed'));
      console.log();
      console.log(chalk.bold('Options:'));
      console.log(chalk.gray('  --title <title>                    Issue/task title'));
      console.log(chalk.gray('  --solution <path>                  Solution JSON file'));
      console.log(chalk.gray('  --result <json>                    Execution result'));
      console.log(chalk.gray('  --reason <text>                    Failure reason'));
      console.log(chalk.gray('  --json                             JSON output'));
      console.log(chalk.gray('  --force                            Force operation'));
      console.log();
      console.log(chalk.bold('Storage:'));
      console.log(chalk.gray('  .workflow/issues/issues.jsonl      All issues'));
      console.log(chalk.gray('  .workflow/issues/solutions/*.jsonl Solutions per issue'));
      console.log(chalk.gray('  .workflow/issues/queue.json        Execution queue'));
  }
}
