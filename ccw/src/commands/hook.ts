/**
 * Hook Command - CLI endpoint for Claude Code hooks
 * Provides simplified interface for hook operations, replacing complex bash/curl commands
 */

import chalk from 'chalk';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

interface HookOptions {
  stdin?: boolean;
  sessionId?: string;
  prompt?: string;
  type?: 'session-start' | 'context';
  path?: string;
}

interface HookData {
  session_id?: string;
  prompt?: string;
  cwd?: string;
  tool_input?: Record<string, unknown>;
}

interface SessionState {
  firstLoad: string;
  loadCount: number;
  lastPrompt?: string;
}

/**
 * Read JSON data from stdin (for Claude Code hooks)
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk;
      }
    });
    process.stdin.on('end', () => {
      resolve(data);
    });
    // Handle case where stdin is empty or not piped
    if (process.stdin.isTTY) {
      resolve('');
    }
  });
}

/**
 * Get session state file path
 * Uses ~/.claude/.ccw-sessions/ for reliable persistence across sessions
 */
function getSessionStateFile(sessionId: string): string {
  const stateDir = join(homedir(), '.claude', '.ccw-sessions');
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }
  return join(stateDir, `session-${sessionId}.json`);
}

/**
 * Load session state from file
 */
function loadSessionState(sessionId: string): SessionState | null {
  const stateFile = getSessionStateFile(sessionId);
  if (!existsSync(stateFile)) {
    return null;
  }
  try {
    const content = readFileSync(stateFile, 'utf-8');
    return JSON.parse(content) as SessionState;
  } catch {
    return null;
  }
}

/**
 * Save session state to file
 */
function saveSessionState(sessionId: string, state: SessionState): void {
  const stateFile = getSessionStateFile(sessionId);
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

/**
 * Get project path from hook data or current working directory
 */
function getProjectPath(hookCwd?: string): string {
  return hookCwd || process.cwd();
}

/**
 * Session context action - provides progressive context loading
 * First prompt: returns session overview with clusters
 * Subsequent prompts: returns intent-matched sessions
 */
async function sessionContextAction(options: HookOptions): Promise<void> {
  let { stdin, sessionId, prompt } = options;
  let hookCwd: string | undefined;

  // If --stdin flag is set, read from stdin (Claude Code hook format)
  if (stdin) {
    try {
      const stdinData = await readStdin();
      if (stdinData) {
        const hookData = JSON.parse(stdinData) as HookData;
        sessionId = hookData.session_id || sessionId;
        hookCwd = hookData.cwd;
        prompt = hookData.prompt || prompt;
      }
    } catch {
      // Silently continue if stdin parsing fails
    }
  }

  if (!sessionId) {
    if (!stdin) {
      console.error(chalk.red('Error: --session-id is required'));
      console.error(chalk.gray('Usage: ccw hook session-context --session-id <id>'));
      console.error(chalk.gray('       ccw hook session-context --stdin'));
    }
    process.exit(stdin ? 0 : 1);
  }

  try {
    const projectPath = getProjectPath(hookCwd);

    // Load existing session state
    const existingState = loadSessionState(sessionId);
    const isFirstPrompt = !existingState;

    // Update session state
    const newState: SessionState = isFirstPrompt
      ? {
          firstLoad: new Date().toISOString(),
          loadCount: 1,
          lastPrompt: prompt
        }
      : {
          ...existingState,
          loadCount: existingState.loadCount + 1,
          lastPrompt: prompt
        };

    saveSessionState(sessionId, newState);

    // Determine context type and generate content
    let contextType: 'session-start' | 'context';
    let content = '';

    // Dynamic import to avoid circular dependencies
    const { SessionClusteringService } = await import('../core/session-clustering-service.js');
    const clusteringService = new SessionClusteringService(projectPath);

    if (isFirstPrompt) {
      // First prompt: return session overview with clusters
      contextType = 'session-start';
      content = await clusteringService.getProgressiveIndex({
        type: 'session-start',
        sessionId
      });
    } else if (prompt && prompt.trim().length > 0) {
      // Subsequent prompts with content: return intent-matched sessions
      contextType = 'context';
      content = await clusteringService.getProgressiveIndex({
        type: 'context',
        sessionId,
        prompt
      });
    } else {
      // Subsequent prompts without content: return minimal context
      contextType = 'context';
      content = ''; // No context needed for empty prompts
    }

    if (stdin) {
      // For hooks: output content directly to stdout
      if (content) {
        process.stdout.write(content);
      }
      process.exit(0);
    }

    // Interactive mode: show detailed output
    console.log(chalk.green('Session Context'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.cyan('Session ID:'), sessionId);
    console.log(chalk.cyan('Type:'), contextType);
    console.log(chalk.cyan('First Prompt:'), isFirstPrompt ? 'Yes' : 'No');
    console.log(chalk.cyan('Load Count:'), newState.loadCount);
    console.log(chalk.gray('─'.repeat(40)));
    if (content) {
      console.log(content);
    } else {
      console.log(chalk.gray('(No context generated)'));
    }
  } catch (error) {
    if (stdin) {
      // Silent failure for hooks
      process.exit(0);
    }
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Parse CCW status.json and output formatted status
 */
async function parseStatusAction(options: HookOptions): Promise<void> {
  const { path: filePath } = options;

  if (!filePath) {
    console.error(chalk.red('Error: --path is required'));
    process.exit(1);
  }

  try {
    // Check if this is a CCW status.json file
    if (!filePath.includes('status.json') ||
        !filePath.match(/\.(ccw|ccw-coordinator|ccw-debug)[/\\]/)) {
      console.log(chalk.gray('(Not a CCW status file)'));
      process.exit(0);
    }

    // Read and parse status.json
    if (!existsSync(filePath)) {
      console.log(chalk.gray('(Status file not found)'));
      process.exit(0);
    }

    const statusContent = readFileSync(filePath, 'utf8');
    const status = JSON.parse(statusContent);

    // Extract key information
    const sessionId = status.session_id || 'unknown';
    const workflow = status.workflow || status.mode || 'unknown';

    // Find current command (running or last completed)
    let currentCommand = status.command_chain?.find((cmd: { status: string }) => cmd.status === 'running')?.command;
    if (!currentCommand) {
      const completed = status.command_chain?.filter((cmd: { status: string }) => cmd.status === 'completed');
      currentCommand = completed?.[completed.length - 1]?.command || 'unknown';
    }

    // Find next command (first pending)
    const nextCommand = status.command_chain?.find((cmd: { status: string }) => cmd.status === 'pending')?.command || '无';

    // Format status message
    const message = `📋 CCW Status [${sessionId}] (${workflow}): 当前处于 ${currentCommand}，下一个命令 ${nextCommand}`;

    console.log(message);
    process.exit(0);
  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Notify dashboard action - send notification to running ccw view server
 */
async function notifyAction(options: HookOptions): Promise<void> {
  const { stdin } = options;
  let hookData: HookData = {};

  if (stdin) {
    try {
      const stdinData = await readStdin();
      if (stdinData) {
        hookData = JSON.parse(stdinData) as HookData;
      }
    } catch {
      // Silently continue if stdin parsing fails
    }
  }

  try {
    const { notifyRefreshRequired } = await import('../tools/notifier.js');
    await notifyRefreshRequired();

    if (!stdin) {
      console.log(chalk.green('Notification sent to dashboard'));
    }
    process.exit(0);
  } catch (error) {
    if (stdin) {
      process.exit(0);
    }
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Show help for hook command
 */
function showHelp(): void {
  console.log(`
${chalk.bold('ccw hook')} - CLI endpoint for Claude Code hooks

${chalk.bold('USAGE')}
  ccw hook <subcommand> [options]

${chalk.bold('SUBCOMMANDS')}
  parse-status      Parse CCW status.json and display current/next command
  session-context   Progressive session context loading (replaces curl/bash hook)
  notify            Send notification to ccw view dashboard

${chalk.bold('OPTIONS')}
  --stdin           Read input from stdin (for Claude Code hooks)
  --path            Path to status.json file (for parse-status)
  --session-id      Session ID (alternative to stdin)
  --prompt          Current prompt text (alternative to stdin)

${chalk.bold('EXAMPLES')}
  ${chalk.gray('# Parse CCW status file:')}
  ccw hook parse-status --path .workflow/.ccw/ccw-123/status.json

  ${chalk.gray('# Use in Claude Code hook (settings.json):')}
  ccw hook session-context --stdin

  ${chalk.gray('# Interactive usage:')}
  ccw hook session-context --session-id abc123

  ${chalk.gray('# Notify dashboard:')}
  ccw hook notify --stdin

${chalk.bold('HOOK CONFIGURATION')}
  ${chalk.gray('Add to .claude/settings.json for status tracking:')}
  {
    "hooks": {
      "PostToolUse": [{
        "trigger": "PostToolUse",
        "matcher": "Write",
        "command": "bash",
        "args": ["-c", "INPUT=$(cat); FILE_PATH=$(echo \\"$INPUT\\" | jq -r \\".tool_input.file_path // empty\\"); [ -n \\"$FILE_PATH\\" ] && ccw hook parse-status --path \\"$FILE_PATH\\""]
      }]
    }
  }
`);
}

/**
 * Main hook command handler
 */
export async function hookCommand(
  subcommand: string,
  args: string | string[],
  options: HookOptions
): Promise<void> {
  switch (subcommand) {
    case 'parse-status':
      await parseStatusAction(options);
      break;
    case 'session-context':
    case 'context':
      await sessionContextAction(options);
      break;
    case 'notify':
      await notifyAction(options);
      break;
    case 'help':
    case undefined:
      showHelp();
      break;
    default:
      console.error(chalk.red(`Unknown subcommand: ${subcommand}`));
      console.error(chalk.gray('Run "ccw hook help" for usage information'));
      process.exit(1);
  }
}
