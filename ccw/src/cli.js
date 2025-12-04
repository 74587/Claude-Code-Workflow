import { Command } from 'commander';
import { viewCommand } from './commands/view.js';
import { installCommand } from './commands/install.js';
import { uninstallCommand } from './commands/uninstall.js';
import { listCommand } from './commands/list.js';
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

  // View command
  program
    .command('view')
    .description('Open workflow dashboard in browser')
    .option('-p, --path <path>', 'Path to project directory', '.')
    .option('--no-browser', 'Generate dashboard without opening browser')
    .option('-o, --output <file>', 'Output path for generated HTML')
    .action(viewCommand);

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

  // List command
  program
    .command('list')
    .description('List all installed Claude Code Workflow instances')
    .action(listCommand);

  program.parse(argv);
}
