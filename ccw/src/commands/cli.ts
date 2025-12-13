/**
 * CLI Command - Unified CLI tool executor command
 * Provides interface for executing Gemini, Qwen, and Codex
 */

import chalk from 'chalk';
import http from 'http';
import {
  cliExecutorTool,
  getCliToolsStatus,
  getExecutionHistory,
  getExecutionDetail,
  getConversationDetail
} from '../tools/cli-executor.js';

// Dashboard notification settings
const DASHBOARD_PORT = process.env.CCW_PORT || 3456;

/**
 * Notify dashboard of CLI execution events (fire and forget)
 */
function notifyDashboard(data: Record<string, unknown>): void {
  const payload = JSON.stringify({
    type: 'cli_execution',
    ...data,
    timestamp: new Date().toISOString()
  });

  const req = http.request({
    hostname: 'localhost',
    port: Number(DASHBOARD_PORT),
    path: '/api/hook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  });

  // Fire and forget - log errors only in debug mode
  req.on('error', (err) => {
    if (process.env.DEBUG) console.error('[Dashboard] CLI notification failed:', err.message);
  });
  req.write(payload);
  req.end();
}

interface CliExecOptions {
  tool?: string;
  mode?: string;
  model?: string;
  cd?: string;
  includeDirs?: string;
  timeout?: string;
  noStream?: boolean;
  resume?: string | boolean; // true = last, string = execution ID
  id?: string; // Custom execution ID (e.g., IMPL-001-step1)
}

interface HistoryOptions {
  limit?: string;
  tool?: string;
  status?: string;
}

/**
 * Show CLI tool status
 */
async function statusAction(): Promise<void> {
  console.log(chalk.bold.cyan('\n  CLI Tools Status\n'));

  const status = await getCliToolsStatus();

  for (const [tool, info] of Object.entries(status)) {
    const statusIcon = info.available ? chalk.green('●') : chalk.red('○');
    const statusText = info.available ? chalk.green('Available') : chalk.red('Not Found');

    console.log(`  ${statusIcon} ${chalk.bold.white(tool.padEnd(10))} ${statusText}`);
    if (info.available && info.path) {
      console.log(chalk.gray(`      ${info.path}`));
    }
  }

  console.log();
}

/**
 * Execute a CLI tool
 * @param {string} prompt - Prompt to execute
 * @param {Object} options - CLI options
 */
async function execAction(prompt: string | undefined, options: CliExecOptions): Promise<void> {
  if (!prompt) {
    console.error(chalk.red('Error: Prompt is required'));
    console.error(chalk.gray('Usage: ccw cli exec "<prompt>" --tool gemini'));
    process.exit(1);
  }

  const { tool = 'gemini', mode = 'analysis', model, cd, includeDirs, timeout, noStream, resume, id } = options;

  // Parse resume IDs for merge scenario
  const resumeIds = resume && typeof resume === 'string' ? resume.split(',').map(s => s.trim()).filter(Boolean) : [];
  const isMerge = resumeIds.length > 1;

  // Show execution mode
  let resumeInfo = '';
  if (isMerge) {
    resumeInfo = ` merging ${resumeIds.length} conversations`;
  } else if (resume) {
    resumeInfo = typeof resume === 'string' ? ` resuming ${resume}` : ' resuming last';
  }
  const idInfo = id ? ` [${id}]` : '';
  console.log(chalk.cyan(`\n  Executing ${tool} (${mode} mode${resumeInfo})${idInfo}...\n`));

  // Show merge details
  if (isMerge) {
    console.log(chalk.gray('  Merging conversations:'));
    for (const rid of resumeIds) {
      console.log(chalk.gray(`    • ${rid}`));
    }
    console.log();
  }

  // Notify dashboard: execution started
  notifyDashboard({
    event: 'started',
    tool,
    mode,
    prompt_preview: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
    custom_id: id || null
  });

  // Streaming output handler
  const onOutput = noStream ? null : (chunk: any) => {
    process.stdout.write(chunk.data);
  };

  try {
    const result = await cliExecutorTool.execute({
      tool,
      prompt,
      mode,
      model,
      cd,
      includeDirs,
      timeout: timeout ? parseInt(timeout, 10) : 300000,
      resume,
      id // custom execution ID
    }, onOutput);

    // If not streaming, print output now
    if (noStream && result.stdout) {
      console.log(result.stdout);
    }

    // Print summary with execution ID and turn info
    console.log();
    if (result.success) {
      const turnInfo = result.conversation.turn_count > 1
        ? ` (turn ${result.conversation.turn_count})`
        : '';
      console.log(chalk.green(`  ✓ Completed in ${(result.execution.duration_ms / 1000).toFixed(1)}s${turnInfo}`));
      console.log(chalk.gray(`  ID: ${result.execution.id}`));
      if (isMerge && !id) {
        // Merge without custom ID: updated all source conversations
        console.log(chalk.gray(`  Updated ${resumeIds.length} conversations: ${resumeIds.join(', ')}`));
      } else if (isMerge && id) {
        // Merge with custom ID: created new merged conversation
        console.log(chalk.gray(`  Created merged conversation from ${resumeIds.length} sources`));
      }
      if (result.conversation.turn_count > 1) {
        console.log(chalk.gray(`  Total: ${result.conversation.turn_count} turns, ${(result.conversation.total_duration_ms / 1000).toFixed(1)}s`));
      }
      console.log(chalk.dim(`  Continue: ccw cli exec "..." --resume ${result.execution.id}`));

      // Notify dashboard: execution completed
      notifyDashboard({
        event: 'completed',
        tool,
        mode,
        execution_id: result.execution.id,
        success: true,
        duration_ms: result.execution.duration_ms,
        turn_count: result.conversation.turn_count
      });
    } else {
      console.log(chalk.red(`  ✗ Failed (${result.execution.status})`));
      console.log(chalk.gray(`  ID: ${result.execution.id}`));
      if (result.stderr) {
        console.error(chalk.red(result.stderr));
      }

      // Notify dashboard: execution failed
      notifyDashboard({
        event: 'completed',
        tool,
        mode,
        execution_id: result.execution.id,
        success: false,
        status: result.execution.status,
        duration_ms: result.execution.duration_ms
      });

      process.exit(1);
    }
  } catch (error) {
    const err = error as Error;
    console.error(chalk.red(`  Error: ${err.message}`));

    // Notify dashboard: execution error
    notifyDashboard({
      event: 'error',
      tool,
      mode,
      error: err.message
    });

    process.exit(1);
  }
}

/**
 * Show execution history
 * @param {Object} options - CLI options
 */
async function historyAction(options: HistoryOptions): Promise<void> {
  const { limit = '20', tool, status } = options;

  console.log(chalk.bold.cyan('\n  CLI Execution History\n'));

  const history = getExecutionHistory(process.cwd(), { limit: parseInt(limit, 10), tool, status });

  if (history.executions.length === 0) {
    console.log(chalk.gray('  No executions found.\n'));
    return;
  }

  console.log(chalk.gray(`  Total executions: ${history.total}\n`));

  for (const exec of history.executions) {
    const statusIcon = exec.status === 'success' ? chalk.green('●') :
                       exec.status === 'timeout' ? chalk.yellow('●') : chalk.red('●');
    const duration = exec.duration_ms >= 1000
      ? `${(exec.duration_ms / 1000).toFixed(1)}s`
      : `${exec.duration_ms}ms`;

    const timeAgo = getTimeAgo(new Date(exec.updated_at || exec.timestamp));
    const turnInfo = exec.turn_count && exec.turn_count > 1 ? chalk.cyan(` [${exec.turn_count} turns]`) : '';

    console.log(`  ${statusIcon} ${chalk.bold.white(exec.tool.padEnd(8))} ${chalk.gray(timeAgo.padEnd(12))} ${chalk.gray(duration.padEnd(8))}${turnInfo}`);
    console.log(chalk.gray(`    ${exec.prompt_preview}`));
    console.log(chalk.dim(`    ID: ${exec.id}`));
    console.log();
  }
}

/**
 * Show conversation detail with all turns
 * @param {string} conversationId - Conversation ID
 */
async function detailAction(conversationId: string | undefined): Promise<void> {
  if (!conversationId) {
    console.error(chalk.red('Error: Conversation ID is required'));
    console.error(chalk.gray('Usage: ccw cli detail <conversation-id>'));
    process.exit(1);
  }

  const conversation = getConversationDetail(process.cwd(), conversationId);

  if (!conversation) {
    console.error(chalk.red(`Error: Conversation not found: ${conversationId}`));
    process.exit(1);
  }

  console.log(chalk.bold.cyan('\n  Conversation Detail\n'));
  console.log(`  ${chalk.gray('ID:')}         ${conversation.id}`);
  console.log(`  ${chalk.gray('Tool:')}       ${conversation.tool}`);
  console.log(`  ${chalk.gray('Model:')}      ${conversation.model}`);
  console.log(`  ${chalk.gray('Mode:')}       ${conversation.mode}`);
  console.log(`  ${chalk.gray('Status:')}     ${conversation.latest_status}`);
  console.log(`  ${chalk.gray('Turns:')}      ${conversation.turn_count}`);
  console.log(`  ${chalk.gray('Duration:')}   ${(conversation.total_duration_ms / 1000).toFixed(1)}s total`);
  console.log(`  ${chalk.gray('Created:')}    ${conversation.created_at}`);
  if (conversation.turn_count > 1) {
    console.log(`  ${chalk.gray('Updated:')}    ${conversation.updated_at}`);
  }

  // Show all turns
  for (const turn of conversation.turns) {
    console.log(chalk.bold.cyan(`\n  ═══ Turn ${turn.turn} ═══`));
    console.log(chalk.gray(`  ${turn.timestamp} | ${turn.status} | ${(turn.duration_ms / 1000).toFixed(1)}s`));

    console.log(chalk.bold.white('\n  Prompt:'));
    console.log(chalk.gray('  ' + turn.prompt.split('\n').join('\n  ')));

    if (turn.output.stdout) {
      console.log(chalk.bold.white('\n  Output:'));
      console.log(turn.output.stdout);
    }

    if (turn.output.stderr) {
      console.log(chalk.bold.red('\n  Errors:'));
      console.log(turn.output.stderr);
    }

    if (turn.output.truncated) {
      console.log(chalk.yellow('\n  Note: Output was truncated due to size.'));
    }
  }

  console.log(chalk.dim(`\n  Continue: ccw cli exec "..." --resume ${conversation.id}`));
  console.log();
}

/**
 * Get human-readable time ago string
 * @param {Date} date
 * @returns {string}
 */
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

/**
 * CLI command entry point
 * @param {string} subcommand - Subcommand (status, exec, history, detail)
 * @param {string[]} args - Arguments array
 * @param {Object} options - CLI options
 */
export async function cliCommand(
  subcommand: string,
  args: string | string[],
  options: CliExecOptions | HistoryOptions
): Promise<void> {
  const argsArray = Array.isArray(args) ? args : (args ? [args] : []);

  switch (subcommand) {
    case 'status':
      await statusAction();
      break;

    case 'exec':
      await execAction(argsArray[0], options as CliExecOptions);
      break;

    case 'history':
      await historyAction(options as HistoryOptions);
      break;

    case 'detail':
      await detailAction(argsArray[0]);
      break;

    default:
      console.log(chalk.bold.cyan('\n  CCW CLI Tool Executor\n'));
      console.log('  Unified interface for Gemini, Qwen, and Codex CLI tools.\n');
      console.log('  Subcommands:');
      console.log(chalk.gray('    status              Check CLI tools availability'));
      console.log(chalk.gray('    exec <prompt>       Execute a CLI tool'));
      console.log(chalk.gray('    history             Show execution history'));
      console.log(chalk.gray('    detail <id>         Show execution detail'));
      console.log();
      console.log('  Exec Options:');
      console.log(chalk.gray('    --tool <tool>       Tool to use: gemini, qwen, codex (default: gemini)'));
      console.log(chalk.gray('    --mode <mode>       Mode: analysis, write, auto (default: analysis)'));
      console.log(chalk.gray('    --model <model>     Model override'));
      console.log(chalk.gray('    --cd <path>         Working directory'));
      console.log(chalk.gray('    --includeDirs <dirs>  Additional directories (comma-separated)'));
      console.log(chalk.gray('                        → gemini/qwen: --include-directories'));
      console.log(chalk.gray('                        → codex: --add-dir'));
      console.log(chalk.gray('    --timeout <ms>      Timeout in milliseconds (default: 300000)'));
      console.log(chalk.gray('    --no-stream         Disable streaming output'));
      console.log(chalk.gray('    --resume [id]       Resume previous session (empty=last, or execution ID)'));
      console.log(chalk.gray('    --id <id>           Custom execution ID (e.g., IMPL-001-step1)'));
      console.log();
      console.log('  History Options:');
      console.log(chalk.gray('    --limit <n>         Number of results (default: 20)'));
      console.log(chalk.gray('    --tool <tool>       Filter by tool'));
      console.log(chalk.gray('    --status <status>   Filter by status'));
      console.log();
      console.log('  Examples:');
      console.log(chalk.gray('    ccw cli status'));
      console.log(chalk.gray('    ccw cli exec "Analyze the auth module" --tool gemini'));
      console.log(chalk.gray('    ccw cli exec "Analyze with context" --tool gemini --includeDirs ../shared,../types'));
      console.log(chalk.gray('    ccw cli exec "Implement feature" --tool codex --mode auto --includeDirs ./lib'));
      console.log(chalk.gray('    ccw cli exec "Continue analysis" --resume               # Resume last session'));
      console.log(chalk.gray('    ccw cli exec "Continue..." --resume <id> --tool gemini  # Resume specific session'));
      console.log(chalk.gray('    ccw cli history --tool gemini --limit 10'));
      console.log();
  }
}
