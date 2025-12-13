/**
 * CLI Command - Unified CLI tool executor command
 * Provides interface for executing Gemini, Qwen, and Codex
 */

import chalk from 'chalk';
import {
  cliExecutorTool,
  getCliToolsStatus,
  getExecutionHistory,
  getExecutionDetail
} from '../tools/cli-executor.js';

interface CliExecOptions {
  tool?: string;
  mode?: string;
  model?: string;
  cd?: string;
  includeDirs?: string;
  timeout?: string;
  noStream?: boolean;
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

  const { tool = 'gemini', mode = 'analysis', model, cd, includeDirs, timeout, noStream } = options;

  console.log(chalk.cyan(`\n  Executing ${tool} (${mode} mode)...\n`));

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
      dir: cd,
      include: includeDirs,
      timeout: timeout ? parseInt(timeout, 10) : 300000,
      stream: !noStream
    });

    // If not streaming, print output now
    if (noStream && result.stdout) {
      console.log(result.stdout);
    }

    // Print summary
    console.log();
    if (result.success) {
      console.log(chalk.green(`  ✓ Completed in ${(result.execution.duration_ms / 1000).toFixed(1)}s`));
    } else {
      console.log(chalk.red(`  ✗ Failed (${result.execution.status})`));
      if (result.stderr) {
        console.error(chalk.red(result.stderr));
      }
      process.exit(1);
    }
  } catch (error) {
    const err = error as Error;
    console.error(chalk.red(`  Error: ${err.message}`));
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

    const timeAgo = getTimeAgo(new Date(exec.timestamp));

    console.log(`  ${statusIcon} ${chalk.bold.white(exec.tool.padEnd(8))} ${chalk.gray(timeAgo.padEnd(12))} ${chalk.gray(duration.padEnd(8))}`);
    console.log(chalk.gray(`    ${exec.prompt_preview}`));
    console.log(chalk.dim(`    ID: ${exec.id}`));
    console.log();
  }
}

/**
 * Show execution detail
 * @param {string} executionId - Execution ID
 */
async function detailAction(executionId: string | undefined): Promise<void> {
  if (!executionId) {
    console.error(chalk.red('Error: Execution ID is required'));
    console.error(chalk.gray('Usage: ccw cli detail <execution-id>'));
    process.exit(1);
  }

  const detail = getExecutionDetail(process.cwd(), executionId);

  if (!detail) {
    console.error(chalk.red(`Error: Execution not found: ${executionId}`));
    process.exit(1);
  }

  console.log(chalk.bold.cyan('\n  Execution Detail\n'));
  console.log(`  ${chalk.gray('ID:')}         ${detail.id}`);
  console.log(`  ${chalk.gray('Tool:')}       ${detail.tool}`);
  console.log(`  ${chalk.gray('Model:')}      ${detail.model}`);
  console.log(`  ${chalk.gray('Mode:')}       ${detail.mode}`);
  console.log(`  ${chalk.gray('Status:')}     ${detail.status}`);
  console.log(`  ${chalk.gray('Duration:')}   ${detail.duration_ms}ms`);
  console.log(`  ${chalk.gray('Timestamp:')}  ${detail.timestamp}`);

  console.log(chalk.bold.cyan('\n  Prompt:\n'));
  console.log(chalk.gray('  ' + detail.prompt.split('\n').join('\n  ')));

  if (detail.output.stdout) {
    console.log(chalk.bold.cyan('\n  Output:\n'));
    console.log(detail.output.stdout);
  }

  if (detail.output.stderr) {
    console.log(chalk.bold.red('\n  Errors:\n'));
    console.log(detail.output.stderr);
  }

  if (detail.output.truncated) {
    console.log(chalk.yellow('\n  Note: Output was truncated due to size.'));
  }

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
      console.log(chalk.gray('    --cd <path>         Working directory (-C for codex)'));
      console.log(chalk.gray('    --includeDirs <dirs>  Additional directories (comma-separated)'));
      console.log(chalk.gray('                        → gemini/qwen: --include-directories'));
      console.log(chalk.gray('                        → codex: --add-dir'));
      console.log(chalk.gray('    --timeout <ms>      Timeout in milliseconds (default: 300000)'));
      console.log(chalk.gray('    --no-stream         Disable streaming output'));
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
      console.log(chalk.gray('    ccw cli history --tool gemini --limit 10'));
      console.log();
  }
}
