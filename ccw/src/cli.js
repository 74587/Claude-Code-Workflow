import { Command } from 'commander';
import { viewCommand } from './commands/view.js';
import { serveCommand } from './commands/serve.js';
import { stopCommand } from './commands/stop.js';
import { installCommand } from './commands/install.js';
import { uninstallCommand } from './commands/uninstall.js';
import { upgradeCommand } from './commands/upgrade.js';
import { listCommand } from './commands/list.js';
import { toolCommand } from './commands/tool.js';
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
    .action((subcommand, args, options) => toolCommand(subcommand, args, options));

  program.parse(argv);
}
