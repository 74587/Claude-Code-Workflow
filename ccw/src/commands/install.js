import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { showHeader, createSpinner, info, warning, error, summaryBox, divider } from '../utils/ui.js';
import { createManifest, addFileEntry, addDirectoryEntry, saveManifest, findManifest, getAllManifests } from '../core/manifest.js';
import { validatePath } from '../utils/path-resolver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Source directories to install
const SOURCE_DIRS = ['.claude', '.codex', '.gemini', '.qwen'];

// Get package root directory (ccw/src/commands -> ccw)
function getPackageRoot() {
  return join(__dirname, '..', '..');
}

// Get source installation directory (parent of ccw)
function getSourceDir() {
  return join(getPackageRoot(), '..');
}

/**
 * Install command handler
 * @param {Object} options - Command options
 */
export async function installCommand(options) {
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

  let installPath;
  if (mode === 'Global') {
    installPath = homedir();
    info(`Global installation to: ${installPath}`);
  } else {
    const inputPath = options.path || await selectPath();

    // Validate the installation path
    const pathValidation = validatePath(inputPath, { mustExist: true });
    if (!pathValidation.valid) {
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
  divider();

  // Check for existing installation at target path
  const existingManifest = findManifest(installPath, mode);
  if (existingManifest) {
    warning('Existing installation found at this location');
    const { backup } = await inquirer.prompt([{
      type: 'confirm',
      name: 'backup',
      message: 'Create backup before reinstalling?',
      default: true
    }]);

    if (backup) {
      await createBackup(installPath, existingManifest);
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
    for (const dir of availableDirs) {
      const srcPath = join(sourceDir, dir);
      const destPath = join(installPath, dir);

      spinner.text = `Installing ${dir}...`;

      const { files, directories } = await copyDirectory(srcPath, destPath, manifest);
      totalFiles += files;
      totalDirs += directories;
    }

    // Copy CLAUDE.md to .claude directory
    const claudeMdSrc = join(sourceDir, 'CLAUDE.md');
    const claudeMdDest = join(installPath, '.claude', 'CLAUDE.md');
    if (existsSync(claudeMdSrc) && existsSync(dirname(claudeMdDest))) {
      spinner.text = 'Installing CLAUDE.md...';
      copyFileSync(claudeMdSrc, claudeMdDest);
      addFileEntry(manifest, claudeMdDest);
      totalFiles++;
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
    error(err.message);
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
    chalk.gray(`Directories created: ${totalDirs}`),
    '',
    chalk.gray(`Manifest: ${basename(manifestPath)}`)
  ];

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
async function selectMode() {
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
async function selectPath() {
  const { path } = await inquirer.prompt([{
    type: 'input',
    name: 'path',
    message: 'Enter installation path:',
    default: process.cwd(),
    validate: (input) => {
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
 * Create backup of existing installation
 * @param {string} installPath - Installation path
 * @param {Object} manifest - Existing manifest
 */
async function createBackup(installPath, manifest) {
  const spinner = createSpinner('Creating backup...').start();

  try {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').split('.')[0];
    const backupDir = join(installPath, `.claude-backup-${timestamp}`);

    mkdirSync(backupDir, { recursive: true });

    // Copy existing .claude directory
    const claudeDir = join(installPath, '.claude');
    if (existsSync(claudeDir)) {
      await copyDirectory(claudeDir, join(backupDir, '.claude'));
    }

    spinner.succeed(`Backup created: ${backupDir}`);
  } catch (err) {
    spinner.warn(`Backup failed: ${err.message}`);
  }
}

/**
 * Copy directory recursively
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 * @param {Object} manifest - Manifest to track files (optional)
 * @returns {Object} - Count of files and directories
 */
async function copyDirectory(src, dest, manifest = null) {
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
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      const result = await copyDirectory(srcPath, destPath, manifest);
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
function getVersion() {
  try {
    const pkgPath = join(getPackageRoot(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}
