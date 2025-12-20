import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { showHeader, createSpinner, info, warning, error, summaryBox, divider } from '../utils/ui.js';
import { createManifest, addFileEntry, addDirectoryEntry, saveManifest, findManifest, getAllManifests } from '../core/manifest.js';
import { validatePath } from '../utils/path-resolver.js';
import type { Ora } from 'ora';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Source directories to install (includes .codex with prompts folder)
const SOURCE_DIRS = ['.claude', '.codex', '.gemini', '.qwen'];

// Subdirectories that should always be installed to global (~/.claude/)
const GLOBAL_SUBDIRS = ['workflows', 'scripts', 'templates'];

// Files that should be excluded from cleanup (user-specific settings)
const EXCLUDED_FILES = ['settings.json', 'settings.local.json'];

interface InstallOptions {
  mode?: string;
  path?: string;
  force?: boolean;
}

interface CopyResult {
  files: number;
  directories: number;
}

// Get package root directory (ccw/src/commands -> ccw)
function getPackageRoot(): string {
  return join(__dirname, '..', '..');
}

// Get source installation directory (parent of ccw)
function getSourceDir(): string {
  return join(getPackageRoot(), '..');
}

/**
 * Install command handler
 * @param {Object} options - Command options
 */
export async function installCommand(options: InstallOptions): Promise<void> {
  const version = getVersion();

  // Show beautiful header
  showHeader(version);

  // Check for existing installations
  const existingManifests = getAllManifests();
  if (existingManifests.length > 0 && !options.force) {
    info('Existing installations detected:');
    console.log('');
    existingManifests.forEach((m, i) => {
      console.log(chalk.gray(`  ${i + 1}. ${m.installation_mode} - ${m.installation_path}`));
      console.log(chalk.gray(`     Installed: ${new Date(m.installation_date).toLocaleDateString()}`));
    });
    console.log('');

    const { proceed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'proceed',
      message: 'Continue with new installation?',
      default: true
    }]);

    if (!proceed) {
      info('Installation cancelled');
      return;
    }
  }

  // Local installation from package source
  const sourceDir = getSourceDir();

  // Interactive mode selection
  const mode = options.mode || await selectMode();

  let installPath: string;
  if (mode === 'Global') {
    installPath = homedir();
    info(`Global installation to: ${installPath}`);
  } else {
    const inputPath = options.path || await selectPath();

    // Validate the installation path
    const pathValidation = validatePath(inputPath, { mustExist: true });
    if (!pathValidation.valid || !pathValidation.path) {
      error(`Invalid installation path: ${pathValidation.error}`);
      process.exit(1);
    }

    installPath = pathValidation.path;
    info(`Path installation to: ${installPath}`);
  }

  // Validate source directories exist
  const availableDirs = SOURCE_DIRS.filter(dir => existsSync(join(sourceDir, dir)));

  if (availableDirs.length === 0) {
    error('No source directories found to install.');
    error(`Expected directories in: ${sourceDir}`);
    process.exit(1);
  }

  console.log('');
  info(`Found ${availableDirs.length} directories to install: ${availableDirs.join(', ')}`);

  // Show what will be installed including .codex/prompts
  if (availableDirs.includes('.codex')) {
    const promptsPath = join(sourceDir, '.codex', 'prompts');
    if (existsSync(promptsPath)) {
      const promptFiles = readdirSync(promptsPath, { recursive: true });
      info(`  └─ .codex/prompts: ${promptFiles.length} files (workflow execute, lite-execute)`);
    }
  }

  divider();

  // Check for existing installation manifest
  const existingManifest = findManifest(installPath, mode);
  let cleanStats = { removed: 0, skipped: 0 };

  if (existingManifest) {
    // Has manifest - clean based on manifest records
    warning('Existing installation found at this location');
    info(`  Files in manifest: ${existingManifest.files?.length || 0}`);
    info(`  Installed: ${new Date(existingManifest.installation_date).toLocaleDateString()}`);

    const { backup } = await inquirer.prompt([{
      type: 'confirm',
      name: 'backup',
      message: 'Create backup before reinstalling?',
      default: true
    }]);

    if (backup) {
      await createBackup(existingManifest);
    }

    // Clean based on manifest records
    console.log('');
    const cleanSpinner = createSpinner('Cleaning previous installation...').start();

    try {
      cleanSpinner.text = 'Removing manifest files...';
      cleanStats = await cleanManifestFiles(existingManifest, cleanSpinner);

      if (cleanStats.removed > 0 || cleanStats.skipped > 0) {
        cleanSpinner.succeed(`Cleanup: ${cleanStats.removed} files removed, ${cleanStats.skipped} settings preserved`);
      } else {
        cleanSpinner.succeed('Cleanup: no files to remove');
      }
    } catch (err) {
      const errMsg = err as Error;
      cleanSpinner.warn(`Cleanup warning: ${errMsg.message}`);
    }
  } else {
    // No manifest - first install or manual install, just overwrite
    const existingDirs = SOURCE_DIRS.filter(dir => existsSync(join(installPath, dir)));
    if (existingDirs.length > 0) {
      info('No installation manifest found, files will be overwritten');
      info(`  Existing directories: ${existingDirs.join(', ')}`);
    }
  }

  // Create manifest
  const manifest = createManifest(mode, installPath);

  // Perform installation
  console.log('');
  const spinner = createSpinner('Installing files...').start();

  let totalFiles = 0;
  let totalDirs = 0;

  try {
    // For Path mode, install workflows to global first
    if (mode === 'Path') {
      const globalPath = homedir();
      for (const subdir of GLOBAL_SUBDIRS) {
        const srcWorkflows = join(sourceDir, '.claude', subdir);
        if (existsSync(srcWorkflows)) {
          const destWorkflows = join(globalPath, '.claude', subdir);
          spinner.text = `Installing ${subdir} to global...`;
          const { files, directories } = await copyDirectory(srcWorkflows, destWorkflows, manifest);
          totalFiles += files;
          totalDirs += directories;
        }
      }
    }

    for (const dir of availableDirs) {
      const srcPath = join(sourceDir, dir);
      const destPath = join(installPath, dir);

      spinner.text = `Installing ${dir}...`;

      // For Path mode on .claude, exclude global subdirs (they're already installed to global)
      const excludeDirs = (mode === 'Path' && dir === '.claude') ? GLOBAL_SUBDIRS : [];
      const { files, directories } = await copyDirectory(srcPath, destPath, manifest, excludeDirs);
      totalFiles += files;
      totalDirs += directories;
    }

    // Create version.json
    const versionPath = join(installPath, '.claude', 'version.json');
    if (existsSync(dirname(versionPath))) {
      const versionData = {
        version: version,
        installedAt: new Date().toISOString(),
        mode: mode,
        installer: 'ccw'
      };
      writeFileSync(versionPath, JSON.stringify(versionData, null, 2), 'utf8');
      addFileEntry(manifest, versionPath);
      totalFiles++;
    }

    spinner.succeed('Installation complete!');

  } catch (err) {
    spinner.fail('Installation failed');
    const errMsg = err as Error;
    error(errMsg.message);
    process.exit(1);
  }

  // Save manifest
  const manifestPath = saveManifest(manifest);

  // Show summary
  console.log('');
  const summaryLines = [
    chalk.green.bold('✓ Installation Successful'),
    '',
    chalk.white(`Mode: ${chalk.cyan(mode)}`),
    chalk.white(`Path: ${chalk.cyan(installPath)}`),
    chalk.white(`Version: ${chalk.cyan(version)}`),
    '',
    chalk.gray(`Files installed: ${totalFiles}`),
    chalk.gray(`Directories created: ${totalDirs}`)
  ];

  // Add cleanup stats if any files were processed
  if (cleanStats.removed > 0 || cleanStats.skipped > 0) {
    summaryLines.push(chalk.gray(`Old files removed: ${cleanStats.removed}`));
    if (cleanStats.skipped > 0) {
      summaryLines.push(chalk.gray(`Settings preserved: ${cleanStats.skipped}`));
    }
  }

  summaryLines.push('');
  summaryLines.push(chalk.gray(`Manifest: ${basename(manifestPath)}`));

  // Add codex prompts info if installed
  if (availableDirs.includes('.codex')) {
    summaryLines.push('');
    summaryLines.push(chalk.cyan('Codex Prompts: ✓ Installed'));
    summaryLines.push(chalk.gray(`  Path: ${join(installPath, '.codex', 'prompts')}`));
  }

  summaryBox({
    title: ' Installation Summary ',
    lines: summaryLines,
    borderColor: 'green'
  });

  // Show next steps
  console.log('');
  info('Next steps:');
  console.log(chalk.gray('  1. Restart Claude Code or your IDE'));
  console.log(chalk.gray('  2. Run: ccw view - to open the workflow dashboard'));
  console.log(chalk.gray('  3. Run: ccw uninstall - to remove this installation'));
  console.log('');
}

/**
 * Interactive mode selection
 * @returns {Promise<string>} - Selected mode
 */
async function selectMode(): Promise<string> {
  const { mode } = await inquirer.prompt([{
    type: 'list',
    name: 'mode',
    message: 'Select installation mode:',
    choices: [
      {
        name: `${chalk.cyan('Global')} - Install to home directory (recommended)`,
        value: 'Global'
      },
      {
        name: `${chalk.yellow('Path')} - Install to specific project path`,
        value: 'Path'
      }
    ]
  }]);

  return mode;
}

/**
 * Interactive path selection
 * @returns {Promise<string>} - Selected path
 */
async function selectPath(): Promise<string> {
  const { path } = await inquirer.prompt([{
    type: 'input',
    name: 'path',
    message: 'Enter installation path:',
    default: process.cwd(),
    validate: (input: string) => {
      if (!input) return 'Path is required';
      if (!existsSync(input)) {
        return `Path does not exist: ${input}`;
      }
      return true;
    }
  }]);

  return path;
}

/**
 * Clean files based on manifest record
 * Only removes files that were installed by the previous installation
 * @param manifest - Existing manifest with file records
 * @param spinner - Spinner for progress display
 * @returns Count of removed files and skipped files
 */
async function cleanManifestFiles(
  manifest: any,
  spinner: Ora
): Promise<{ removed: number; skipped: number }> {
  let removed = 0;
  let skipped = 0;

  const files = manifest.files || [];
  const directories = manifest.directories || [];

  // Remove files in reverse order (process deepest paths first)
  const sortedFiles = [...files].sort((a: any, b: any) => b.path.length - a.path.length);

  for (const fileEntry of sortedFiles) {
    const filePath = fileEntry.path;
    const fileName = basename(filePath);

    // Skip excluded files (user settings)
    if (EXCLUDED_FILES.includes(fileName)) {
      skipped++;
      continue;
    }

    try {
      if (existsSync(filePath)) {
        spinner.text = `Removing: ${fileName}`;
        unlinkSync(filePath);
        removed++;
      }
    } catch {
      // Ignore errors during cleanup
    }
  }

  // Clean up empty directories (deepest first)
  const sortedDirs = [...directories].sort((a: any, b: any) => b.path.length - a.path.length);

  for (const dirEntry of sortedDirs) {
    const dirPath = dirEntry.path;
    try {
      if (existsSync(dirPath)) {
        const contents = readdirSync(dirPath);
        if (contents.length === 0) {
          rmdirSync(dirPath);
        }
      }
    } catch {
      // Ignore errors during cleanup
    }
  }

  return { removed, skipped };
}

/**
 * Create backup of files recorded in manifest
 * @param manifest - Existing manifest with file records
 */
async function createBackup(manifest: any): Promise<void> {
  const spinner = createSpinner('Creating backup...').start();

  try {
    const installPath = manifest.installation_path;
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').split('.')[0];
    const backupDir = join(installPath, `.claude-backup-${timestamp}`);

    const files = manifest.files || [];
    let backedUp = 0;

    for (const fileEntry of files) {
      const filePath = fileEntry.path;

      if (!existsSync(filePath)) continue;

      // Calculate relative path from install path
      const relativePath = filePath.replace(installPath, '').replace(/^[\\/]/, '');
      const backupPath = join(backupDir, relativePath);

      // Create directory structure
      const backupFileDir = dirname(backupPath);
      if (!existsSync(backupFileDir)) {
        mkdirSync(backupFileDir, { recursive: true });
      }

      // Copy file
      try {
        spinner.text = `Backing up: ${basename(filePath)}`;
        copyFileSync(filePath, backupPath);
        backedUp++;
      } catch {
        // Ignore individual file errors
      }
    }

    if (backedUp > 0) {
      spinner.succeed(`Backup created: ${backupDir} (${backedUp} files)`);
    } else {
      spinner.info('No files to backup');
      // Remove empty backup dir
      try { rmdirSync(backupDir); } catch { /* ignore */ }
    }
  } catch (err) {
    const errMsg = err as Error;
    spinner.warn(`Backup failed: ${errMsg.message}`);
  }
}

/**
 * Copy directory recursively
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 * @param {Object} manifest - Manifest to track files (optional)
 * @param {string[]} excludeDirs - Directory names to exclude (optional)
 * @returns {Object} - Count of files and directories
 */
async function copyDirectory(
  src: string,
  dest: string,
  manifest: any = null,
  excludeDirs: string[] = [],
  excludeFiles: string[] = EXCLUDED_FILES
): Promise<CopyResult> {
  let files = 0;
  let directories = 0;

  // Create destination directory
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
    directories++;
    if (manifest) addDirectoryEntry(manifest, dest);
  }

  const entries = readdirSync(src);

  for (const entry of entries) {
    // Skip excluded directories
    if (excludeDirs.includes(entry)) {
      continue;
    }

    // Skip excluded files
    if (excludeFiles.includes(entry)) {
      continue;
    }

    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      const result = await copyDirectory(srcPath, destPath, manifest, [], excludeFiles);
      files += result.files;
      directories += result.directories;
    } else {
      copyFileSync(srcPath, destPath);
      files++;
      if (manifest) addFileEntry(manifest, destPath);
    }
  }

  return { files, directories };
}

/**
 * Get package version
 * @returns {string} - Version string
 */
function getVersion(): string {
  try {
    // First try root package.json (parent of ccw)
    const rootPkgPath = join(getSourceDir(), 'package.json');
    if (existsSync(rootPkgPath)) {
      const pkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
      if (pkg.version) return pkg.version;
    }
    // Fallback to ccw package.json
    const pkgPath = join(getPackageRoot(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}
