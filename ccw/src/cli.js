import { Command } from 'commander';
import { viewCommand } from './commands/view.js';
import { serveCommand } from './commands/serve.js';
import { stopCommand } from './commands/stop.js';
import { installCommand } from './commands/install.js';
import { uninstallCommand } from './commands/uninstall.js';
import { upgradeCommand } from './commands/upgrade.js';
import { listCommand } from './commands/list.js';
import { toolCommand } from './commands/tool.js';
import { sessionCommand } from './commands/session.js';
import { cliCommand } from './commands/cli.js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load package.json with error handling
 * @returns {Object} - Package info with version
 */
function loadPackageInfo() {
  const pkgPath = join(__dirname, '../package.json');

  try {
    if (!existsSync(pkgPath)) {
      console.error('Fatal Error: package.json not found.');
      console.error(`Expected location: ${pkgPath}`);
      process.exit(1);
    }

    const content = readFileSync(pkgPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error('Fatal Error: package.json contains invalid JSON.');
      console.error(`Parse error: ${error.message}`);
    } else {
      console.error('Fatal Error: Could not read package.json.');
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

const pkg = loadPackageInfo();

export function run(argv) {
  const program = new Command();

  program
    .name('ccw')
    .description('Claude Code Workflow CLI - Dashboard and workflow tools')
    .version(pkg.version);

  // View command (server mode with live path switching)
  program
    .command('view')
    .description('Open workflow dashboard server with live path switching')
    .option('-p, --path <path>', 'Path to project directory', '.')
    .option('--port <port>', 'Server port', '3456')
    .option('--no-browser', 'Start server without opening browser')
    .action(viewCommand);

  // Serve command (alias for view)
  program
    .command('serve')
    .description('Alias for view command')
    .option('-p, --path <path>', 'Initial project directory')
    .option('--port <port>', 'Server port', '3456')
    .option('--no-browser', 'Start server without opening browser')
    .action(serveCommand);

  // Stop command
  program
    .command('stop')
    .description('Stop the running CCW dashboard server')
    .option('--port <port>', 'Server port', '3456')
    .option('-f, --force', 'Force kill process on the port')
    .action(stopCommand);

  // Install command
  program
    .command('install')
    .description('Install Claude Code Workflow to your system')
    .option('-m, --mode <mode>', 'Installation mode: Global or Path')
    .option('-p, --path <path>', 'Installation path (for Path mode)')
    .option('-f, --force', 'Force installation without prompts')
    .action(installCommand);

  // Uninstall command
  program
    .command('uninstall')
    .description('Uninstall Claude Code Workflow')
    .action(uninstallCommand);

  // Upgrade command
  program
    .command('upgrade')
    .description('Upgrade Claude Code Workflow installations')
    .option('-a, --all', 'Upgrade all installations without prompting')
    .action(upgradeCommand);

  // List command
  program
    .command('list')
    .description('List all installed Claude Code Workflow instances')
    .action(listCommand);

  // Tool command
  program
    .command('tool [subcommand] [args...]')
    .description('Execute CCW tools')
    .option('--path <path>', 'File path (for edit_file)')
    .option('--old <text>', 'Old text to replace (for edit_file)')
    .option('--new <text>', 'New text (for edit_file)')
    .option('--action <action>', 'Action to perform (for codex_lens)')
    .option('--query <query>', 'Search query (for codex_lens)')
    .option('--limit <n>', 'Max results (for codex_lens)', '20')
    .option('--file <file>', 'File path for symbol extraction (for codex_lens)')
    .option('--files <files>', 'Comma-separated file paths (for codex_lens update)')
    .option('--languages <langs>', 'Comma-separated languages (for codex_lens init)')
    .action((subcommand, args, options) => toolCommand(subcommand, args, options));

  // Session command
  program
    .command('session [subcommand] [args...]')
    .description('Workflow session lifecycle management')
    .option('--location <loc>', 'Location filter: active|archived|both')
    .option('--type <type>', 'Content type or session type')
    .option('--content <json>', 'Content for write/update')
    .option('--task-id <id>', 'Task ID for task content')
    .option('--filename <name>', 'Filename for process/chat/etc')
    .option('--dimension <dim>', 'Dimension for review-dim')
    .option('--iteration <iter>', 'Iteration for review-iter')
    .option('--subdir <dir>', 'Subdirectory for mkdir')
    .option('--raw', 'Output raw content only')
    .option('--no-metadata', 'Exclude metadata from list')
    .option('--no-update-status', 'Skip status update on archive')
    .action((subcommand, args, options) => sessionCommand(subcommand, args, options));

  // CLI command
  program
    .command('cli [subcommand] [args...]')
    .description('Unified CLI tool executor (gemini/qwen/codex)')
    .option('--tool <tool>', 'CLI tool to use', 'gemini')
    .option('--mode <mode>', 'Execution mode: analysis, write, auto', 'analysis')
    .option('--model <model>', 'Model override')
    .option('--cd <path>', 'Working directory (-C for codex)')
    .option('--includeDirs <dirs>', 'Additional directories (--include-directories for gemini/qwen, --add-dir for codex)')
    .option('--timeout <ms>', 'Timeout in milliseconds', '300000')
    .option('--no-stream', 'Disable streaming output')
    .option('--limit <n>', 'History limit')
    .option('--status <status>', 'Filter by status')
    .action((subcommand, args, options) => cliCommand(subcommand, args, options));

  program.parse(argv);
}
