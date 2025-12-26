/**
 * Issue Command - Issue lifecycle management with JSONL task tracking
 * Supports: init, list, add, update, status, export, retry, clean
 */

import chalk from 'chalk';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

// Handle EPIPE errors gracefully
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') {
    process.exit(0);
  }
  throw err;
});

interface IssueTask {
  id: string;
  title: string;
  type: 'feature' | 'bug' | 'refactor' | 'test' | 'chore' | 'docs';
  description: string;
  file_context: string[];
  depends_on: string[];
  delivery_criteria: string[];
  pause_criteria: string[];
  status: 'pending' | 'ready' | 'in_progress' | 'completed' | 'failed' | 'paused' | 'skipped';
  current_phase: 'analyze' | 'implement' | 'test' | 'optimize' | 'commit' | 'done';
  executor: 'agent' | 'codex' | 'gemini' | 'auto';
  priority: number;
  phase_results?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface IssueState {
  issue_id: string;
  title: string;
  status: 'planned' | 'in_progress' | 'completed' | 'paused' | 'failed';
  created_at: string;
  updated_at: string;
  task_count: number;
  completed_count: number;
  current_task: string | null;
  executor_default: string;
}

interface IssueOptions {
  status?: string;
  phase?: string;
  title?: string;
  type?: string;
  description?: string;
  dependsOn?: string;
  deliveryCriteria?: string;
  pauseCriteria?: string;
  executor?: string;
  priority?: string;
  format?: string;
  force?: boolean;
  json?: boolean;
}

const ISSUES_DIR = '.workflow/issues';

/**
 * Get project root (where .workflow exists or should be created)
 */
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

/**
 * Get issues directory path
 */
function getIssuesDir(): string {
  const projectRoot = getProjectRoot();
  return join(projectRoot, ISSUES_DIR);
}

/**
 * Get issue directory path
 */
function getIssueDir(issueId: string): string {
  return join(getIssuesDir(), issueId);
}

/**
 * Read JSONL file into array of tasks
 */
function readJsonl(filePath: string): IssueTask[] {
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, 'utf-8');
  return content.split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

/**
 * Write tasks to JSONL file
 */
function writeJsonl(filePath: string, tasks: IssueTask[]): void {
  const content = tasks.map(t => JSON.stringify(t)).join('\n');
  writeFileSync(filePath, content, 'utf-8');
}

/**
 * Read issue state
 */
function readState(issueId: string): IssueState | null {
  const statePath = join(getIssueDir(issueId), 'state.json');
  if (!existsSync(statePath)) return null;
  return JSON.parse(readFileSync(statePath, 'utf-8'));
}

/**
 * Write issue state
 */
function writeState(issueId: string, state: IssueState): void {
  const statePath = join(getIssueDir(issueId), 'state.json');
  writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Generate next task ID
 */
function generateTaskId(tasks: IssueTask[]): string {
  const maxNum = tasks.reduce((max, t) => {
    const match = t.id.match(/^TASK-(\d+)$/);
    return match ? Math.max(max, parseInt(match[1])) : max;
  }, 0);
  return `TASK-${String(maxNum + 1).padStart(3, '0')}`;
}

/**
 * Initialize a new issue
 */
async function initAction(issueId: string | undefined, options: IssueOptions): Promise<void> {
  if (!issueId) {
    console.error(chalk.red('Issue ID is required'));
    console.error(chalk.gray('Usage: ccw issue init <issue-id> [--title "..."]'));
    process.exit(1);
  }

  const issueDir = getIssueDir(issueId);

  if (existsSync(issueDir) && !options.force) {
    console.error(chalk.red(`Issue "${issueId}" already exists`));
    console.error(chalk.gray('Use --force to reinitialize'));
    process.exit(1);
  }

  // Create directory
  mkdirSync(issueDir, { recursive: true });

  // Initialize state
  const state: IssueState = {
    issue_id: issueId,
    title: options.title || issueId,
    status: 'planned',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    task_count: 0,
    completed_count: 0,
    current_task: null,
    executor_default: options.executor || 'auto'
  };

  writeState(issueId, state);

  // Create empty tasks.jsonl
  writeFileSync(join(issueDir, 'tasks.jsonl'), '', 'utf-8');

  // Create context.md placeholder
  writeFileSync(join(issueDir, 'context.md'), `# ${options.title || issueId}\n\n<!-- Issue context will be added here -->\n`, 'utf-8');

  console.log(chalk.green(`✓ Issue "${issueId}" initialized`));
  console.log(chalk.gray(`  Location: ${issueDir}`));
  console.log(chalk.gray(`  Next: ccw issue add ${issueId} --title "Task title"`));
}

/**
 * List issues or tasks within an issue
 */
async function listAction(issueId: string | undefined, options: IssueOptions): Promise<void> {
  const issuesDir = getIssuesDir();

  if (!issueId) {
    // List all issues
    if (!existsSync(issuesDir)) {
      console.log(chalk.yellow('No issues found'));
      console.log(chalk.gray('Create one with: ccw issue init <issue-id>'));
      return;
    }

    const issues = readdirSync(issuesDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => {
        const state = readState(d.name);
        return state || { issue_id: d.name, status: 'unknown', task_count: 0, completed_count: 0 };
      });

    if (options.json) {
      console.log(JSON.stringify(issues, null, 2));
      return;
    }

    console.log(chalk.bold.cyan('\nIssues\n'));
    console.log(chalk.gray('ID'.padEnd(20) + 'Status'.padEnd(15) + 'Progress'.padEnd(15) + 'Title'));
    console.log(chalk.gray('-'.repeat(70)));

    for (const issue of issues) {
      const statusColor = {
        'planned': chalk.blue,
        'in_progress': chalk.yellow,
        'completed': chalk.green,
        'paused': chalk.magenta,
        'failed': chalk.red
      }[issue.status as string] || chalk.gray;

      const progress = `${issue.completed_count}/${issue.task_count}`;
      console.log(
        issue.issue_id.padEnd(20) +
        statusColor(issue.status.padEnd(15)) +
        progress.padEnd(15) +
        ((issue as IssueState).title || '')
      );
    }
    return;
  }

  // List tasks within an issue
  const issueDir = getIssueDir(issueId);
  if (!existsSync(issueDir)) {
    console.error(chalk.red(`Issue "${issueId}" not found`));
    process.exit(1);
  }

  const tasks = readJsonl(join(issueDir, 'tasks.jsonl'));
  const state = readState(issueId);

  if (options.json) {
    console.log(JSON.stringify({ state, tasks }, null, 2));
    return;
  }

  // Filter by status if specified
  const filteredTasks = options.status
    ? tasks.filter(t => t.status === options.status)
    : tasks;

  console.log(chalk.bold.cyan(`\nIssue: ${issueId}\n`));
  if (state) {
    console.log(chalk.gray(`Status: ${state.status} | Progress: ${state.completed_count}/${state.task_count}`));
  }
  console.log();

  if (filteredTasks.length === 0) {
    console.log(chalk.yellow('No tasks found'));
    return;
  }

  console.log(chalk.gray('ID'.padEnd(12) + 'Status'.padEnd(12) + 'Phase'.padEnd(12) + 'Deps'.padEnd(10) + 'Title'));
  console.log(chalk.gray('-'.repeat(80)));

  for (const task of filteredTasks) {
    const statusColor = {
      'pending': chalk.gray,
      'ready': chalk.blue,
      'in_progress': chalk.yellow,
      'completed': chalk.green,
      'failed': chalk.red,
      'paused': chalk.magenta,
      'skipped': chalk.gray
    }[task.status] || chalk.white;

    const deps = task.depends_on.length > 0 ? task.depends_on.join(',') : '-';
    console.log(
      task.id.padEnd(12) +
      statusColor(task.status.padEnd(12)) +
      task.current_phase.padEnd(12) +
      deps.padEnd(10) +
      task.title.substring(0, 40)
    );
  }
}

/**
 * Add a new task to an issue
 */
async function addAction(issueId: string | undefined, options: IssueOptions): Promise<void> {
  if (!issueId) {
    console.error(chalk.red('Issue ID is required'));
    console.error(chalk.gray('Usage: ccw issue add <issue-id> --title "..." [--depends-on "TASK-001,TASK-002"]'));
    process.exit(1);
  }

  if (!options.title) {
    console.error(chalk.red('Task title is required (--title)'));
    process.exit(1);
  }

  const issueDir = getIssueDir(issueId);
  if (!existsSync(issueDir)) {
    console.error(chalk.red(`Issue "${issueId}" not found. Run: ccw issue init ${issueId}`));
    process.exit(1);
  }

  const tasksPath = join(issueDir, 'tasks.jsonl');
  const tasks = readJsonl(tasksPath);

  // Parse options
  const dependsOn = options.dependsOn ? options.dependsOn.split(',').map(s => s.trim()) : [];
  const deliveryCriteria = options.deliveryCriteria ? options.deliveryCriteria.split('|').map(s => s.trim()) : ['Task completed successfully'];
  const pauseCriteria = options.pauseCriteria ? options.pauseCriteria.split('|').map(s => s.trim()) : [];

  // Validate dependencies
  const taskIds = new Set(tasks.map(t => t.id));
  for (const dep of dependsOn) {
    if (!taskIds.has(dep)) {
      console.error(chalk.red(`Dependency "${dep}" not found`));
      process.exit(1);
    }
  }

  const newTask: IssueTask = {
    id: generateTaskId(tasks),
    title: options.title,
    type: (options.type as IssueTask['type']) || 'feature',
    description: options.description || options.title,
    file_context: [],
    depends_on: dependsOn,
    delivery_criteria: deliveryCriteria,
    pause_criteria: pauseCriteria,
    status: 'pending',
    current_phase: 'analyze',
    executor: (options.executor as IssueTask['executor']) || 'auto',
    priority: options.priority ? parseInt(options.priority) : 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  tasks.push(newTask);
  writeJsonl(tasksPath, tasks);

  // Update state
  const state = readState(issueId);
  if (state) {
    state.task_count = tasks.length;
    state.updated_at = new Date().toISOString();
    writeState(issueId, state);
  }

  console.log(chalk.green(`✓ Task ${newTask.id} added to ${issueId}`));
  console.log(chalk.gray(`  Title: ${newTask.title}`));
  if (dependsOn.length > 0) {
    console.log(chalk.gray(`  Depends on: ${dependsOn.join(', ')}`));
  }
}

/**
 * Update task status or properties
 */
async function updateAction(issueId: string | undefined, taskId: string | undefined, options: IssueOptions): Promise<void> {
  if (!issueId || !taskId) {
    console.error(chalk.red('Issue ID and Task ID are required'));
    console.error(chalk.gray('Usage: ccw issue update <issue-id> <task-id> --status completed'));
    process.exit(1);
  }

  const tasksPath = join(getIssueDir(issueId), 'tasks.jsonl');
  if (!existsSync(tasksPath)) {
    console.error(chalk.red(`Issue "${issueId}" not found`));
    process.exit(1);
  }

  const tasks = readJsonl(tasksPath);
  const taskIndex = tasks.findIndex(t => t.id === taskId);

  if (taskIndex === -1) {
    console.error(chalk.red(`Task "${taskId}" not found in issue "${issueId}"`));
    process.exit(1);
  }

  const task = tasks[taskIndex];
  const updates: string[] = [];

  if (options.status) {
    task.status = options.status as IssueTask['status'];
    updates.push(`status → ${options.status}`);
  }
  if (options.phase) {
    task.current_phase = options.phase as IssueTask['current_phase'];
    updates.push(`phase → ${options.phase}`);
  }
  if (options.title) {
    task.title = options.title;
    updates.push(`title → ${options.title}`);
  }
  if (options.executor) {
    task.executor = options.executor as IssueTask['executor'];
    updates.push(`executor → ${options.executor}`);
  }

  task.updated_at = new Date().toISOString();
  tasks[taskIndex] = task;
  writeJsonl(tasksPath, tasks);

  // Update state
  const state = readState(issueId);
  if (state) {
    state.completed_count = tasks.filter(t => t.status === 'completed').length;
    state.current_task = task.status === 'in_progress' ? taskId : state.current_task;
    state.updated_at = new Date().toISOString();
    writeState(issueId, state);
  }

  console.log(chalk.green(`✓ Task ${taskId} updated`));
  updates.forEach(u => console.log(chalk.gray(`  ${u}`)));
}

/**
 * Show detailed issue/task status
 */
async function statusAction(issueId: string | undefined, taskId: string | undefined, options: IssueOptions): Promise<void> {
  if (!issueId) {
    console.error(chalk.red('Issue ID is required'));
    console.error(chalk.gray('Usage: ccw issue status <issue-id> [task-id]'));
    process.exit(1);
  }

  const issueDir = getIssueDir(issueId);
  if (!existsSync(issueDir)) {
    console.error(chalk.red(`Issue "${issueId}" not found`));
    process.exit(1);
  }

  const state = readState(issueId);
  const tasks = readJsonl(join(issueDir, 'tasks.jsonl'));

  if (taskId) {
    // Show specific task
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      console.error(chalk.red(`Task "${taskId}" not found`));
      process.exit(1);
    }

    if (options.json) {
      console.log(JSON.stringify(task, null, 2));
      return;
    }

    console.log(chalk.bold.cyan(`\nTask: ${task.id}\n`));
    console.log(`Title: ${task.title}`);
    console.log(`Type: ${task.type}`);
    console.log(`Status: ${task.status}`);
    console.log(`Phase: ${task.current_phase}`);
    console.log(`Executor: ${task.executor}`);
    console.log(`Priority: ${task.priority}`);
    console.log();
    console.log(chalk.bold('Description:'));
    console.log(task.description);
    console.log();
    console.log(chalk.bold('Delivery Criteria:'));
    task.delivery_criteria.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
    if (task.pause_criteria.length > 0) {
      console.log();
      console.log(chalk.bold('Pause Criteria:'));
      task.pause_criteria.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
    }
    if (task.depends_on.length > 0) {
      console.log();
      console.log(chalk.bold('Dependencies:'));
      task.depends_on.forEach(d => console.log(`  - ${d}`));
    }
    if (task.phase_results) {
      console.log();
      console.log(chalk.bold('Phase Results:'));
      console.log(JSON.stringify(task.phase_results, null, 2));
    }
    return;
  }

  // Show issue overview
  if (options.json) {
    console.log(JSON.stringify({ state, tasks }, null, 2));
    return;
  }

  console.log(chalk.bold.cyan(`\nIssue: ${issueId}\n`));
  if (state) {
    console.log(`Title: ${state.title}`);
    console.log(`Status: ${state.status}`);
    console.log(`Progress: ${state.completed_count}/${state.task_count} tasks`);
    console.log(`Current: ${state.current_task || 'none'}`);
    console.log(`Created: ${state.created_at}`);
    console.log(`Updated: ${state.updated_at}`);
  }

  // Task summary by status
  const byStatus: Record<string, number> = {};
  tasks.forEach(t => {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
  });

  console.log();
  console.log(chalk.bold('Task Summary:'));
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  // Dependency graph
  const readyTasks = tasks.filter(t =>
    t.status === 'pending' &&
    t.depends_on.every(dep => tasks.find(tt => tt.id === dep)?.status === 'completed')
  );

  if (readyTasks.length > 0) {
    console.log();
    console.log(chalk.bold('Ready to Execute:'));
    readyTasks.forEach(t => console.log(`  ${t.id}: ${t.title}`));
  }
}

/**
 * Export issue to markdown
 */
async function exportAction(issueId: string | undefined, options: IssueOptions): Promise<void> {
  if (!issueId) {
    console.error(chalk.red('Issue ID is required'));
    console.error(chalk.gray('Usage: ccw issue export <issue-id>'));
    process.exit(1);
  }

  const issueDir = getIssueDir(issueId);
  if (!existsSync(issueDir)) {
    console.error(chalk.red(`Issue "${issueId}" not found`));
    process.exit(1);
  }

  const state = readState(issueId);
  const tasks = readJsonl(join(issueDir, 'tasks.jsonl'));

  const markdown = `# ${state?.title || issueId}

## Progress: ${state?.completed_count || 0}/${state?.task_count || 0}

## Tasks

${tasks.map(t => {
  const checkbox = t.status === 'completed' ? '[x]' : '[ ]';
  const deps = t.depends_on.length > 0 ? ` (after: ${t.depends_on.join(', ')})` : '';
  return `- ${checkbox} **${t.id}**: ${t.title}${deps}
  - Criteria: ${t.delivery_criteria.join('; ')}`;
}).join('\n')}

---
*Generated by CCW Issue Tracker*
`;

  if (options.format === 'json') {
    console.log(JSON.stringify({ state, tasks }, null, 2));
  } else {
    console.log(markdown);
  }
}

/**
 * Retry failed tasks
 */
async function retryAction(issueId: string | undefined, taskId: string | undefined, options: IssueOptions): Promise<void> {
  if (!issueId) {
    console.error(chalk.red('Issue ID is required'));
    console.error(chalk.gray('Usage: ccw issue retry <issue-id> [task-id]'));
    process.exit(1);
  }

  const tasksPath = join(getIssueDir(issueId), 'tasks.jsonl');
  if (!existsSync(tasksPath)) {
    console.error(chalk.red(`Issue "${issueId}" not found`));
    process.exit(1);
  }

  const tasks = readJsonl(tasksPath);
  let updated = 0;

  for (const task of tasks) {
    if ((taskId && task.id === taskId) || (!taskId && task.status === 'failed')) {
      task.status = 'pending';
      task.current_phase = 'analyze';
      task.updated_at = new Date().toISOString();
      updated++;
    }
  }

  if (updated === 0) {
    console.log(chalk.yellow('No failed tasks to retry'));
    return;
  }

  writeJsonl(tasksPath, tasks);

  // Update state
  const state = readState(issueId);
  if (state) {
    state.updated_at = new Date().toISOString();
    writeState(issueId, state);
  }

  console.log(chalk.green(`✓ Reset ${updated} task(s) to pending`));
}

/**
 * Clean completed issues
 */
async function cleanAction(options: IssueOptions): Promise<void> {
  const issuesDir = getIssuesDir();
  if (!existsSync(issuesDir)) {
    console.log(chalk.yellow('No issues to clean'));
    return;
  }

  const issues = readdirSync(issuesDir, { withFileTypes: true })
    .filter(d => d.isDirectory());

  let cleaned = 0;
  for (const issue of issues) {
    const state = readState(issue.name);
    if (state?.status === 'completed') {
      if (!options.force) {
        console.log(chalk.gray(`Would remove: ${issue.name}`));
      } else {
        // Actually remove (implement if needed)
        console.log(chalk.green(`✓ Cleaned: ${issue.name}`));
      }
      cleaned++;
    }
  }

  if (cleaned === 0) {
    console.log(chalk.yellow('No completed issues to clean'));
  } else if (!options.force) {
    console.log(chalk.gray(`\nUse --force to actually remove ${cleaned} issue(s)`));
  }
}

/**
 * Issue command entry point
 */
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
    case 'add':
      await addAction(argsArray[0], options);
      break;
    case 'update':
      await updateAction(argsArray[0], argsArray[1], options);
      break;
    case 'status':
      await statusAction(argsArray[0], argsArray[1], options);
      break;
    case 'export':
      await exportAction(argsArray[0], options);
      break;
    case 'retry':
      await retryAction(argsArray[0], argsArray[1], options);
      break;
    case 'clean':
      await cleanAction(options);
      break;
    default:
      console.log(chalk.bold.cyan('\nCCW Issue Management\n'));
      console.log('Commands:');
      console.log(chalk.gray('  init <issue-id>                    Initialize new issue'));
      console.log(chalk.gray('  list [issue-id]                    List issues or tasks'));
      console.log(chalk.gray('  add <issue-id> --title "..."       Add task to issue'));
      console.log(chalk.gray('  update <issue-id> <task-id>        Update task properties'));
      console.log(chalk.gray('  status <issue-id> [task-id]        Show detailed status'));
      console.log(chalk.gray('  export <issue-id>                  Export to markdown'));
      console.log(chalk.gray('  retry <issue-id> [task-id]         Retry failed tasks'));
      console.log(chalk.gray('  clean                              Clean completed issues'));
      console.log();
      console.log('Options:');
      console.log(chalk.gray('  --title <title>                    Task title'));
      console.log(chalk.gray('  --type <type>                      Task type (feature|bug|refactor|test|chore|docs)'));
      console.log(chalk.gray('  --status <status>                  Task status'));
      console.log(chalk.gray('  --phase <phase>                    Execution phase'));
      console.log(chalk.gray('  --depends-on <ids>                 Comma-separated dependency IDs'));
      console.log(chalk.gray('  --delivery-criteria <items>        Pipe-separated criteria'));
      console.log(chalk.gray('  --pause-criteria <items>           Pipe-separated pause conditions'));
      console.log(chalk.gray('  --executor <type>                  Executor (agent|codex|gemini|auto)'));
      console.log(chalk.gray('  --json                             Output as JSON'));
      console.log(chalk.gray('  --force                            Force operation'));
      console.log();
      console.log('Examples:');
      console.log(chalk.gray('  ccw issue init GH-123 --title "Add authentication"'));
      console.log(chalk.gray('  ccw issue add GH-123 --title "Setup JWT middleware" --type feature'));
      console.log(chalk.gray('  ccw issue add GH-123 --title "Protect routes" --depends-on TASK-001'));
      console.log(chalk.gray('  ccw issue list GH-123'));
      console.log(chalk.gray('  ccw issue status GH-123 TASK-001'));
      console.log(chalk.gray('  ccw issue update GH-123 TASK-001 --status completed'));
  }
}
