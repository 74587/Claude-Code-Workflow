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

// Files that should be excluded from installation (user-specific settings)
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

  // Check for existing installation at target path
  const existingManifest = findManifest(installPath, mode);
  let cleanStats = { removed: 0, preserved: 0 };

  // Check if any target directories exist (regardless of manifest)
  const existingDirs = SOURCE_DIRS.filter(dir => existsSync(join(installPath, dir)));
  const hasExistingFiles = existingDirs.length > 0;

  if (hasExistingFiles) {
    if (existingManifest) {
      warning('Existing installation found at this location');
    } else {
      warning('Existing configuration directories found (no manifest)');
    }
    info(`  Found: ${existingDirs.join(', ')}`);

    const { backup } = await inquirer.prompt([{
      type: 'confirm',
      name: 'backup',
      message: 'Create backup before clean install?',
      default: true
    }]);

    if (backup) {
      await createBackup(installPath, existingManifest || { files: [], directories: [] });
    }

    // Clean install: remove all old files before copying new ones
    console.log('');
    const cleanSpinner = createSpinner('Performing clean install...').start();

    try {
      cleanSpinner.text = 'Removing old files...';
      cleanStats = await cleanTargetDirectories(installPath, mode, cleanSpinner);

      if (cleanStats.removed > 0 || cleanStats.preserved > 0) {
        cleanSpinner.succeed(`Clean install: ${cleanStats.removed} files removed, ${cleanStats.preserved} user files preserved`);
      } else {
        cleanSpinner.succeed('Clean install: directories prepared');
      }
    } catch (err) {
      const errMsg = err as Error;
      cleanSpinner.warn(`Cleanup warning: ${errMsg.message}`);
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

  // Add clean install stats if any files were processed
  if (cleanStats.removed > 0 || cleanStats.preserved > 0) {
    summaryLines.push(chalk.gray(`Old files removed: ${cleanStats.removed}`));
    if (cleanStats.preserved > 0) {
      summaryLines.push(chalk.gray(`User files preserved: ${cleanStats.preserved}`));
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
 * Clean target directories before installation
 * Removes all files except user-specific settings files
 * @param installPath - Installation path
 * @param mode - Installation mode
 * @param spinner - Spinner for progress display
 * @returns Count of removed files and preserved files
 */
async function cleanTargetDirectories(
  installPath: string,
  mode: string,
  spinner: Ora
): Promise<{ removed: number; preserved: number }> {
  let removed = 0;
  let preserved = 0;
  const globalPath = homedir();

  // For Path mode, also clean global subdirectories
  if (mode === 'Path') {
    for (const subdir of GLOBAL_SUBDIRS) {
      const targetPath = join(globalPath, '.claude', subdir);
      if (existsSync(targetPath)) {
        spinner.text = `Cleaning global ${subdir}...`;
        const stats = cleanDirectoryRecursive(targetPath, EXCLUDED_FILES);
        removed += stats.removed;
        preserved += stats.preserved;
      }
    }
  }

  // Clean all target directories
  for (const dir of SOURCE_DIRS) {
    const targetPath = join(installPath, dir);
    if (existsSync(targetPath)) {
      spinner.text = `Cleaning ${dir}...`;
      // For Path mode on .claude, exclude global subdirs (they're handled separately)
      const excludeDirs = (mode === 'Path' && dir === '.claude') ? GLOBAL_SUBDIRS : [];
      const stats = cleanDirectoryRecursive(targetPath, EXCLUDED_FILES, excludeDirs);
      removed += stats.removed;
      preserved += stats.preserved;
    }
  }

  return { removed, preserved };
}

/**
 * Recursively clean a directory, removing all files except excluded ones
 * @param dirPath - Directory to clean
 * @param excludeFiles - Files to preserve
 * @param excludeDirs - Directories to skip
 * @returns Count of removed and preserved files
 */
function cleanDirectoryRecursive(
  dirPath: string,
  excludeFiles: string[] = [],
  excludeDirs: string[] = []
): { removed: number; preserved: number } {
  let removed = 0;
  let preserved = 0;

  if (!existsSync(dirPath)) {
    return { removed, preserved };
  }

  const entries = readdirSync(dirPath);

  for (const entry of entries) {
    const entryPath = join(dirPath, entry);

    // Skip excluded directories
    if (excludeDirs.includes(entry)) {
      continue;
    }

    try {
      const stat = statSync(entryPath);

      if (stat.isDirectory()) {
        // Recursively clean subdirectory
        const stats = cleanDirectoryRecursive(entryPath, excludeFiles, []);
        removed += stats.removed;
        preserved += stats.preserved;

        // Remove empty directory
        try {
          const contents = readdirSync(entryPath);
          if (contents.length === 0) {
            rmdirSync(entryPath);
          }
        } catch {
          // Ignore errors
        }
      } else {
        // Check if file should be preserved
        if (excludeFiles.includes(entry)) {
          preserved++;
        } else {
          unlinkSync(entryPath);
          removed++;
        }
      }
    } catch {
      // Ignore errors during cleanup
    }
  }

  return { removed, preserved };
}

/**
 * Create backup of existing installation
 * @param installPath - Installation path
 * @param _manifest - Existing manifest (unused, kept for compatibility)
 */
async function createBackup(installPath: string, _manifest: any): Promise<void> {
  const spinner = createSpinner('Creating backup...').start();

  try {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').split('.')[0];
    const backupDir = join(installPath, `.claude-backup-${timestamp}`);

    mkdirSync(backupDir, { recursive: true });

    // Backup all existing source directories
    let backedUp = 0;
    for (const dir of SOURCE_DIRS) {
      const srcDir = join(installPath, dir);
      if (existsSync(srcDir)) {
        spinner.text = `Backing up ${dir}...`;
        await copyDirectory(srcDir, join(backupDir, dir));
        backedUp++;
      }
    }

    if (backedUp > 0) {
      spinner.succeed(`Backup created: ${backupDir}`);
    } else {
      spinner.info('No directories to backup');
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
