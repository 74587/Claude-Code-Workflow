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

interface TaskTest {
  unit?: string[];              // Unit test requirements
  integration?: string[];       // Integration test requirements
  commands?: string[];          // Test commands to run
  coverage_target?: number;     // Minimum coverage % (optional)
}

interface TaskAcceptance {
  criteria: string[];           // Acceptance criteria (testable)
  verification: string[];       // How to verify each criterion
  manual_checks?: string[];     // Manual verification steps if needed
}

interface TaskCommit {
  type: 'feat' | 'fix' | 'refactor' | 'test' | 'docs' | 'chore';
  scope: string;                // Commit scope (e.g., "auth", "api")
  message_template: string;     // Commit message template
  breaking?: boolean;           // Breaking change flag
}

interface SolutionTask {
  id: string;
  title: string;
  scope: string;
  action: string;
  description?: string;
  modification_points?: { file: string; target: string; change: string }[];

  // Lifecycle phases (closed-loop)
  implementation: string[];     // Implementation steps
  test: TaskTest;               // Test requirements
  regression: string[];         // Regression check points
  acceptance: TaskAcceptance;   // Acceptance criteria & verification
  commit: TaskCommit;           // Commit specification

  depends_on: string[];
  estimated_minutes?: number;
  executor: 'codex' | 'gemini' | 'agent' | 'auto';

  // Lifecycle status tracking
  lifecycle_status?: {
    implemented: boolean;
    tested: boolean;
    regression_passed: boolean;
    accepted: boolean;
    committed: boolean;
  };
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
  id: string;                    // Queue unique ID: QUE-YYYYMMDD-HHMMSS
  name?: string;                 // Optional queue name
  status: 'active' | 'completed' | 'archived' | 'failed';
  issue_ids: string[];           // Issues in this queue
  queue: QueueItem[];
  conflicts: any[];
  execution_groups?: any[];
  _metadata: {
    version: string;
    total_tasks: number;
    pending_count: number;
    executing_count: number;
    completed_count: number;
    failed_count: number;
    created_at: string;
    updated_at: string;
  };
}

interface QueueIndex {
  active_queue_id: string | null;
  queues: {
    id: string;
    status: string;
    issue_ids: string[];
    total_tasks: number;
    completed_tasks: number;
    created_at: string;
    completed_at?: string;
  }[];
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

// ============ Queue Management (Multi-Queue) ============

function getQueuesDir(): string {
  return join(getIssuesDir(), 'queues');
}

function ensureQueuesDir(): void {
  const dir = getQueuesDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function readQueueIndex(): QueueIndex {
  const path = join(getQueuesDir(), 'index.json');
  if (!existsSync(path)) {
    return { active_queue_id: null, queues: [] };
  }
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function writeQueueIndex(index: QueueIndex): void {
  ensureQueuesDir();
  writeFileSync(join(getQueuesDir(), 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
}

function generateQueueFileId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `QUE-${ts}`;
}

function readQueue(queueId?: string): Queue | null {
  const index = readQueueIndex();
  const targetId = queueId || index.active_queue_id;

  if (!targetId) return null;

  const path = join(getQueuesDir(), `${targetId}.json`);
  if (!existsSync(path)) return null;

  return JSON.parse(readFileSync(path, 'utf-8'));
}

function readActiveQueue(): Queue {
  const queue = readQueue();
  if (queue) return queue;

  // Return empty queue structure if no active queue
  return createEmptyQueue();
}

function createEmptyQueue(): Queue {
  return {
    id: generateQueueFileId(),
    status: 'active',
    issue_ids: [],
    queue: [],
    conflicts: [],
    _metadata: {
      version: '2.0',
      total_tasks: 0,
      pending_count: 0,
      executing_count: 0,
      completed_count: 0,
      failed_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  };
}

function writeQueue(queue: Queue): void {
  ensureQueuesDir();

  // Update metadata counts
  queue._metadata.total_tasks = queue.queue.length;
  queue._metadata.pending_count = queue.queue.filter(q => q.status === 'pending').length;
  queue._metadata.executing_count = queue.queue.filter(q => q.status === 'executing').length;
  queue._metadata.completed_count = queue.queue.filter(q => q.status === 'completed').length;
  queue._metadata.failed_count = queue.queue.filter(q => q.status === 'failed').length;
  queue._metadata.updated_at = new Date().toISOString();

  // Write queue file
  const path = join(getQueuesDir(), `${queue.id}.json`);
  writeFileSync(path, JSON.stringify(queue, null, 2), 'utf-8');

  // Update index
  const index = readQueueIndex();
  const existingIdx = index.queues.findIndex(q => q.id === queue.id);

  const indexEntry = {
    id: queue.id,
    status: queue.status,
    issue_ids: queue.issue_ids,
    total_tasks: queue._metadata.total_tasks,
    completed_tasks: queue._metadata.completed_count,
    created_at: queue._metadata.created_at,
    completed_at: queue.status === 'completed' ? new Date().toISOString() : undefined
  };

  if (existingIdx >= 0) {
    index.queues[existingIdx] = indexEntry;
  } else {
    index.queues.unshift(indexEntry);
  }

  if (queue.status === 'active') {
    index.active_queue_id = queue.id;
  }

  writeQueueIndex(index);
}

function generateQueueItemId(queue: Queue): string {
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
    const queue = readActiveQueue();
    const issues = readIssues();
    const index = readQueueIndex();

    if (options.json) {
      console.log(JSON.stringify({ queue: queue._metadata, issues: issues.length, queues: index.queues.length }, null, 2));
      return;
    }

    console.log(chalk.bold.cyan('\nSystem Status\n'));
    console.log(`Issues: ${issues.length}`);
    console.log(`Queues: ${index.queues.length} (Active: ${index.active_queue_id || 'none'})`);
    console.log(`Active Queue: ${queue._metadata.total_tasks} tasks`);
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
      test: {
        unit: [],
        commands: ['npm test']
      },
      regression: ['npm test'],
      acceptance: {
        criteria: ['Task completed successfully'],
        verification: ['Manual verification']
      },
      commit: {
        type: 'feat',
        scope: 'core',
        message_template: `feat(core): ${options.title}`
      },
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
 * queue - Queue management (list / add / history)
 */
async function queueAction(subAction: string | undefined, issueId: string | undefined, options: IssueOptions): Promise<void> {
  // List all queues (history)
  if (subAction === 'list' || subAction === 'history') {
    const index = readQueueIndex();

    if (options.json) {
      console.log(JSON.stringify(index, null, 2));
      return;
    }

    console.log(chalk.bold.cyan('\nQueue History\n'));
    console.log(chalk.gray(`Active: ${index.active_queue_id || 'none'}`));
    console.log();

    if (index.queues.length === 0) {
      console.log(chalk.yellow('No queues found'));
      console.log(chalk.gray('Create one: ccw issue queue add <issue-id>'));
      return;
    }

    console.log(chalk.gray('ID'.padEnd(22) + 'Status'.padEnd(12) + 'Tasks'.padEnd(10) + 'Issues'));
    console.log(chalk.gray('-'.repeat(70)));

    for (const q of index.queues) {
      const statusColor = {
        'active': chalk.green,
        'completed': chalk.cyan,
        'archived': chalk.gray,
        'failed': chalk.red
      }[q.status] || chalk.white;

      const marker = q.id === index.active_queue_id ? '→ ' : '  ';
      console.log(
        marker +
        q.id.padEnd(20) +
        statusColor(q.status.padEnd(12)) +
        `${q.completed_tasks}/${q.total_tasks}`.padEnd(10) +
        q.issue_ids.join(', ')
      );
    }
    return;
  }

  // Switch active queue
  if (subAction === 'switch' && issueId) {
    const queueId = issueId; // issueId is actually queue ID here
    const targetQueue = readQueue(queueId);

    if (!targetQueue) {
      console.error(chalk.red(`Queue "${queueId}" not found`));
      process.exit(1);
    }

    const index = readQueueIndex();
    index.active_queue_id = queueId;
    writeQueueIndex(index);

    console.log(chalk.green(`✓ Switched to queue ${queueId}`));
    return;
  }

  // Archive current queue
  if (subAction === 'archive') {
    const queue = readActiveQueue();
    if (!queue.id || queue.queue.length === 0) {
      console.log(chalk.yellow('No active queue to archive'));
      return;
    }

    queue.status = 'archived';
    writeQueue(queue);

    const index = readQueueIndex();
    index.active_queue_id = null;
    writeQueueIndex(index);

    console.log(chalk.green(`✓ Archived queue ${queue.id}`));
    return;
  }

  // Add issue tasks to queue
  if (subAction === 'add' && issueId) {
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

    // Get or create active queue (create new if current is completed/archived)
    let queue = readActiveQueue();
    const isNewQueue = queue.queue.length === 0 || queue.status !== 'active';

    if (queue.status !== 'active') {
      // Create new queue if current is not active
      queue = createEmptyQueue();
    }

    // Add issue to queue's issue list
    if (!queue.issue_ids.includes(issueId)) {
      queue.issue_ids.push(issueId);
    }

    let added = 0;
    for (const task of solution.tasks) {
      const exists = queue.queue.some(q => q.issue_id === issueId && q.task_id === task.id);
      if (exists) continue;

      queue.queue.push({
        queue_id: generateQueueItemId(queue),
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

    if (isNewQueue) {
      console.log(chalk.green(`✓ Created queue ${queue.id}`));
    }
    console.log(chalk.green(`✓ Added ${added} tasks from ${solution.id}`));
    return;
  }

  // Show current queue
  const queue = readActiveQueue();

  if (options.json) {
    console.log(JSON.stringify(queue, null, 2));
    return;
  }

  console.log(chalk.bold.cyan('\nActive Queue\n'));

  if (!queue.id || queue.queue.length === 0) {
    console.log(chalk.yellow('No active queue'));
    console.log(chalk.gray('Create one: ccw issue queue add <issue-id>'));
    console.log(chalk.gray('Or list history: ccw issue queue list'));
    return;
  }

  console.log(chalk.gray(`Queue: ${queue.id}`));
  console.log(chalk.gray(`Issues: ${queue.issue_ids.join(', ')}`));
  console.log(chalk.gray(`Total: ${queue._metadata.total_tasks} | Pending: ${queue._metadata.pending_count} | Executing: ${queue._metadata.executing_count} | Completed: ${queue._metadata.completed_count}`));
  console.log();

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
  const queue = readActiveQueue();

  // Priority 1: Resume executing tasks (interrupted/crashed)
  const executingTasks = queue.queue.filter(item => item.status === 'executing');

  // Priority 2: Find pending tasks with satisfied dependencies
  const pendingTasks = queue.queue.filter(item => {
    if (item.status !== 'pending') return false;
    return item.depends_on.every(depId => {
      const dep = queue.queue.find(q => q.queue_id === depId);
      return !dep || dep.status === 'completed';
    });
  });

  // Combine: executing first, then pending
  const readyTasks = [...executingTasks, ...pendingTasks];

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
  const isResume = nextItem.status === 'executing';

  // Load task definition
  const solution = findSolution(nextItem.issue_id, nextItem.solution_id);
  const taskDef = solution?.tasks.find(t => t.id === nextItem.task_id);

  if (!taskDef) {
    console.log(JSON.stringify({ status: 'error', message: 'Task definition not found' }));
    process.exit(1);
  }

  // Only update status if not already executing (new task)
  if (!isResume) {
    const idx = queue.queue.findIndex(q => q.queue_id === nextItem.queue_id);
    queue.queue[idx].status = 'executing';
    queue.queue[idx].started_at = new Date().toISOString();
    writeQueue(queue);
    updateIssue(nextItem.issue_id, { status: 'executing' });
  }

  // Calculate queue stats for context
  const stats = {
    total: queue.queue.length,
    completed: queue.queue.filter(q => q.status === 'completed').length,
    failed: queue.queue.filter(q => q.status === 'failed').length,
    executing: executingTasks.length,
    pending: pendingTasks.length
  };
  const remaining = stats.pending + stats.executing;

  console.log(JSON.stringify({
    queue_id: nextItem.queue_id,
    issue_id: nextItem.issue_id,
    solution_id: nextItem.solution_id,
    task: taskDef,
    context: solution?.exploration_context || {},
    resumed: isResume,
    resume_note: isResume ? `Resuming interrupted task (started: ${nextItem.started_at})` : undefined,
    execution_hints: {
      executor: nextItem.assigned_executor,
      estimated_minutes: taskDef.estimated_minutes || 30
    },
    queue_progress: {
      completed: stats.completed,
      remaining: remaining,
      total: stats.total,
      progress: `${stats.completed}/${stats.total}`
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

  const queue = readActiveQueue();
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

  // Check if all issue tasks are complete
  const issueId = queue.queue[idx].issue_id;
  const issueTasks = queue.queue.filter(q => q.issue_id === issueId);
  const allIssueComplete = issueTasks.every(q => q.status === 'completed');
  const anyIssueFailed = issueTasks.some(q => q.status === 'failed');

  if (allIssueComplete) {
    updateIssue(issueId, { status: 'completed', completed_at: new Date().toISOString() });
    console.log(chalk.green(`✓ ${queueId} completed`));
    console.log(chalk.green(`✓ Issue ${issueId} completed (all tasks done)`));
  } else if (anyIssueFailed) {
    updateIssue(issueId, { status: 'failed' });
    console.log(chalk.red(`✗ ${queueId} failed`));
  } else {
    console.log(isFail ? chalk.red(`✗ ${queueId} failed`) : chalk.green(`✓ ${queueId} completed`));
  }

  // Check if entire queue is complete
  const allQueueComplete = queue.queue.every(q => q.status === 'completed');
  const anyQueueFailed = queue.queue.some(q => q.status === 'failed');

  if (allQueueComplete) {
    queue.status = 'completed';
    console.log(chalk.green(`\n✓ Queue ${queue.id} completed (all tasks done)`));
  } else if (anyQueueFailed && queue.queue.every(q => q.status === 'completed' || q.status === 'failed')) {
    queue.status = 'failed';
    console.log(chalk.yellow(`\n⚠ Queue ${queue.id} has failed tasks`));
  }

  writeQueue(queue);
}

/**
 * retry - Retry failed tasks, or reset stuck executing tasks (--force)
 */
async function retryAction(issueId: string | undefined, options: IssueOptions): Promise<void> {
  const queue = readActiveQueue();

  if (!queue.id || queue.queue.length === 0) {
    console.log(chalk.yellow('No active queue'));
    return;
  }

  let updated = 0;

  // Check for stuck executing tasks (started > 30 min ago with no completion)
  const stuckThreshold = 30 * 60 * 1000; // 30 minutes
  const now = Date.now();

  for (const item of queue.queue) {
    // Retry failed tasks
    if (item.status === 'failed') {
      if (!issueId || item.issue_id === issueId) {
        item.status = 'pending';
        item.failure_reason = undefined;
        item.started_at = undefined;
        item.completed_at = undefined;
        updated++;
      }
    }
    // Reset stuck executing tasks (optional: use --force or --reset-stuck)
    else if (item.status === 'executing' && options.force) {
      const startedAt = item.started_at ? new Date(item.started_at).getTime() : 0;
      if (now - startedAt > stuckThreshold) {
        if (!issueId || item.issue_id === issueId) {
          console.log(chalk.yellow(`Resetting stuck task: ${item.queue_id} (started ${Math.round((now - startedAt) / 60000)} min ago)`));
          item.status = 'pending';
          item.started_at = undefined;
          updated++;
        }
      }
    }
  }

  if (updated === 0) {
    console.log(chalk.yellow('No failed/stuck tasks to retry'));
    console.log(chalk.gray('Use --force to reset stuck executing tasks (>30 min)'));
    return;
  }

  // Reset queue status if it was failed
  if (queue.status === 'failed') {
    queue.status = 'active';
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
      console.log(chalk.bold.cyan('\nCCW Issue Management (v3.0 - Multi-Queue + Lifecycle)\n'));
      console.log(chalk.bold('Core Commands:'));
      console.log(chalk.gray('  init <issue-id>                    Initialize new issue'));
      console.log(chalk.gray('  list [issue-id]                    List issues or tasks'));
      console.log(chalk.gray('  status [issue-id]                  Show detailed status'));
      console.log(chalk.gray('  task <issue-id> [task-id]          Add or update task'));
      console.log(chalk.gray('  bind <issue-id> [sol-id]           Bind solution (--solution <path> to register)'));
      console.log();
      console.log(chalk.bold('Queue Commands:'));
      console.log(chalk.gray('  queue                              Show active queue'));
      console.log(chalk.gray('  queue list                         List all queues (history)'));
      console.log(chalk.gray('  queue add <issue-id>               Add issue to active queue (or create new)'));
      console.log(chalk.gray('  queue switch <queue-id>            Switch active queue'));
      console.log(chalk.gray('  queue archive                      Archive current queue'));
      console.log(chalk.gray('  retry [issue-id] [--force]         Retry failed/stuck tasks'));
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
      console.log(chalk.gray('  .workflow/issues/queues/           Queue files (multi-queue)'));
      console.log(chalk.gray('  .workflow/issues/queues/index.json Queue index'));
  }
}
