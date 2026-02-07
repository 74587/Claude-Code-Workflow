import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, readFileSync, writeFileSync } from 'fs';
import { join, basename, dirname } from 'path';
import { homedir } from 'os';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { showHeader, createSpinner, info, warning, error, summaryBox, divider } from '../utils/ui.js';
import { getPackageRoot as findPackageRoot, getPackageVersion } from '../utils/project-root.js';

// Workflow source directories (relative to package root)
const WORKFLOW_SOURCES = [
  { name: '~/.ccw/workflows', description: 'Claude workflows' },
  { name: '.claude/scripts', description: 'Claude scripts' },
  { name: '.claude/templates', description: 'Claude templates' },
  { name: '.codex/prompts', description: 'Codex prompts' },
  { name: '.gemini', description: 'Gemini configuration' },
  { name: '.qwen', description: 'Qwen configuration' }
];

interface WorkflowOptions {
  force?: boolean;
  all?: boolean;
  source?: string;
}

interface CopyStats {
  files: number;
  directories: number;
  updated: number;
  skipped: number;
}

/**
 * Get package root directory using robust path resolution
 */
function getPackageRoot(): string {
  return findPackageRoot();
}

/**
 * Get workflow installation target directory
 */
function getWorkflowTargetDir(): string {
  return homedir();
}

/**
 * Get package version
 */
function getVersion(): string {
  return getPackageVersion();
}

/**
 * Custom error with file path context
 */
class FileOperationError extends Error {
  constructor(message: string, public filePath: string, public operation: string) {
    super(`${operation} failed for ${filePath}: ${message}`);
    this.name = 'FileOperationError';
  }
}

/**
 * Copy directory recursively with stats tracking and detailed error handling
 */
async function copyDirectory(
  src: string,
  dest: string,
  stats: CopyStats = { files: 0, directories: 0, updated: 0, skipped: 0 }
): Promise<CopyStats> {
  if (!existsSync(src)) {
    return stats;
  }

  // Create destination directory with error context
  if (!existsSync(dest)) {
    try {
      mkdirSync(dest, { recursive: true });
      stats.directories++;
    } catch (err) {
      const e = err as Error;
      throw new FileOperationError(e.message, dest, 'Create directory');
    }
  }

  const entries = readdirSync(src);

  for (const entry of entries) {
    // Skip settings files
    if (entry === 'settings.json' || entry === 'settings.local.json') {
      stats.skipped++;
      continue;
    }

    const srcPath = join(src, entry);
    const destPath = join(dest, entry);

    try {
      const stat = statSync(srcPath);

      if (stat.isDirectory()) {
        await copyDirectory(srcPath, destPath, stats);
      } else {
        // Check if file needs update (use binary comparison for non-text files)
        if (existsSync(destPath)) {
          try {
            const srcContent = readFileSync(srcPath);
            const destContent = readFileSync(destPath);
            if (srcContent.equals(destContent)) {
              stats.skipped++;
              continue;
            }
            stats.updated++;
          } catch {
            // If comparison fails, proceed with copy
            stats.updated++;
          }
        }
        copyFileSync(srcPath, destPath);
        stats.files++;
      }
    } catch (err) {
      if (err instanceof FileOperationError) {
        throw err; // Re-throw our custom errors
      }
      const e = err as Error;
      throw new FileOperationError(e.message, srcPath, 'Copy file');
    }
  }

  return stats;
}

/**
 * List installed workflows
 */
async function listWorkflows(): Promise<void> {
  const targetDir = getWorkflowTargetDir();

  console.log(chalk.blue.bold('\n  Installed Workflows\n'));

  let hasWorkflows = false;

  for (const source of WORKFLOW_SOURCES) {
    const targetPath = join(targetDir, source.name);

    if (existsSync(targetPath)) {
      hasWorkflows = true;
      const files = readdirSync(targetPath, { recursive: true });
      const fileCount = files.filter(f => {
        const fullPath = join(targetPath, f.toString());
        return existsSync(fullPath) && statSync(fullPath).isFile();
      }).length;

      console.log(chalk.cyan(`  ${source.name}`));
      console.log(chalk.gray(`    Path: ${targetPath}`));
      console.log(chalk.gray(`    Files: ${fileCount}`));
      console.log('');
    }
  }

  if (!hasWorkflows) {
    info('No workflows installed. Run: ccw workflow install');
  }
}

/**
 * Install workflows to user home directory
 */
async function installWorkflows(options: WorkflowOptions): Promise<void> {
  const version = getVersion();
  showHeader(version);

  const sourceDir = getPackageRoot();
  const targetDir = getWorkflowTargetDir();

  // Filter sources if specific source requested
  let sources = WORKFLOW_SOURCES;
  if (options.source) {
    sources = WORKFLOW_SOURCES.filter(s => s.name.includes(options.source!));
    if (sources.length === 0) {
      error(`Unknown source: ${options.source}`);
      info(`Available sources: ${WORKFLOW_SOURCES.map(s => s.name).join(', ')}`);
      return;
    }
  }

  // Validate source directories exist
  const availableSources = sources.filter(s => existsSync(join(sourceDir, s.name)));

  if (availableSources.length === 0) {
    error('No workflow sources found to install.');
    error(`Expected directories in: ${sourceDir}`);
    return;
  }

  console.log('');
  info(`Found ${availableSources.length} workflow sources to install:`);
  availableSources.forEach(s => {
    console.log(chalk.gray(`  - ${s.name} (${s.description})`));
  });

  divider();

  // Confirm installation
  if (!options.force) {
    const { proceed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'proceed',
      message: `Install workflows to ${targetDir}?`,
      default: true
    }]);

    if (!proceed) {
      info('Installation cancelled');
      return;
    }
  }

  // Perform installation
  console.log('');
  const spinner = createSpinner('Installing workflows...').start();

  const totalStats: CopyStats = { files: 0, directories: 0, updated: 0, skipped: 0 };

  try {
    for (const source of availableSources) {
      const srcPath = join(sourceDir, source.name);
      const destPath = join(targetDir, source.name);

      spinner.text = `Installing ${source.name}...`;
      const stats = await copyDirectory(srcPath, destPath);

      totalStats.files += stats.files;
      totalStats.directories += stats.directories;
      totalStats.updated += stats.updated;
      totalStats.skipped += stats.skipped;
    }

    // Write version marker
    const versionPath = join(targetDir, '.claude', 'workflow-version.json');
    if (existsSync(dirname(versionPath))) {
      const versionData = {
        version,
        installedAt: new Date().toISOString(),
        installer: 'ccw workflow'
      };
      writeFileSync(versionPath, JSON.stringify(versionData, null, 2), 'utf8');
    }

    spinner.succeed('Workflow installation complete!');

  } catch (err) {
    spinner.fail('Installation failed');
    const errMsg = err as Error;
    error(errMsg.message);
    return;
  }

  // Show summary
  console.log('');
  const summaryLines = [
    chalk.green.bold('\u2713 Workflow Installation Successful'),
    '',
    chalk.white(`Target: ${chalk.cyan(targetDir)}`),
    chalk.white(`Version: ${chalk.cyan(version)}`),
    '',
    chalk.gray(`New files: ${totalStats.files}`),
    chalk.gray(`Updated: ${totalStats.updated}`),
    chalk.gray(`Skipped: ${totalStats.skipped}`),
    chalk.gray(`Directories: ${totalStats.directories}`)
  ];

  summaryBox({
    title: ' Workflow Summary ',
    lines: summaryLines,
    borderColor: 'green'
  });

  // Show next steps
  console.log('');
  info('Next steps:');
  console.log(chalk.gray('  1. Restart Claude Code or your IDE'));
  console.log(chalk.gray('  2. Workflows are now available globally'));
  console.log(chalk.gray('  3. Run: ccw workflow list - to see installed workflows'));
  console.log('');
}

/**
 * Sync workflows (update existing installation)
 */
async function syncWorkflows(options: WorkflowOptions): Promise<void> {
  info('Syncing workflows (same as install with updates)...');
  await installWorkflows({ ...options, force: false });
}

/**
 * Show workflow help
 */
function showWorkflowHelp(): void {
  console.log(chalk.blue.bold('\n  CCW Workflow Manager\n'));
  console.log(chalk.white('  Usage:'));
  console.log(chalk.gray('    ccw workflow <command> [options]'));
  console.log('');
  console.log(chalk.white('  Commands:'));
  console.log(chalk.cyan('    install') + chalk.gray('  Install workflows to global directory (~/)'));
  console.log(chalk.cyan('    list') + chalk.gray('     List installed workflows'));
  console.log(chalk.cyan('    sync') + chalk.gray('     Sync/update workflows from package'));
  console.log('');
  console.log(chalk.white('  Options:'));
  console.log(chalk.gray('    -f, --force   Force installation without prompts'));
  console.log(chalk.gray('    --source      Install specific source only'));
  console.log('');
  console.log(chalk.white('  Examples:'));
  console.log(chalk.gray('    ccw workflow install              # Install all workflows'));
  console.log(chalk.gray('    ccw workflow install -f           # Force install'));
  console.log(chalk.gray('    ccw workflow install --source ~/.ccw/workflows'));
  console.log(chalk.gray('    ccw workflow list                 # List installed'));
  console.log(chalk.gray('    ccw workflow sync                 # Update workflows'));
  console.log('');
}

/**
 * Main workflow command handler
 */
export async function workflowCommand(
  subcommand?: string,
  args?: string[],
  options: WorkflowOptions = {}
): Promise<void> {
  switch (subcommand) {
    case 'install':
      await installWorkflows(options);
      break;
    case 'list':
    case 'ls':
      await listWorkflows();
      break;
    case 'sync':
    case 'update':
      await syncWorkflows(options);
      break;
    case 'help':
    default:
      showWorkflowHelp();
      break;
  }
}
