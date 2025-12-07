import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join, dirname, basename, relative } from 'path';
import { homedir, tmpdir } from 'os';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { showHeader, showBanner, createSpinner, success, info, warning, error, summaryBox, step, divider } from '../utils/ui.js';
import { createManifest, addFileEntry, addDirectoryEntry, saveManifest, findManifest, getAllManifests } from '../core/manifest.js';
import { validatePath } from '../utils/path-resolver.js';
import { fetchLatestRelease, fetchLatestCommit, fetchRecentReleases, downloadAndExtract, cleanupTemp, REPO_URL } from '../utils/version-fetcher.js';

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

  // Determine source directory based on version option
  let sourceDir;
  let tempDir = null;
  let versionInfo = { version: getVersion(), branch: 'local', commit: '' };

  if (options.version && options.version !== 'local') {
    // Remote installation - download from GitHub
    const downloadResult = await selectAndDownloadVersion(options);
    if (!downloadResult) {
      return; // User cancelled or error occurred
    }
    sourceDir = downloadResult.repoDir;
    tempDir = downloadResult.tempDir;
    versionInfo = {
      version: downloadResult.version,
      branch: downloadResult.branch,
      commit: downloadResult.commit
    };
  } else {
    // Local installation from package source
    sourceDir = getSourceDir();
  }

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
      if (tempDir) cleanupTemp(tempDir);
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
    if (tempDir) cleanupTemp(tempDir);
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

    // Create version.json
    const versionPath = join(installPath, '.claude', 'version.json');
    if (existsSync(dirname(versionPath))) {
      const versionData = {
        version: versionInfo.version,
        branch: versionInfo.branch,
        commit: versionInfo.commit,
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
    if (tempDir) cleanupTemp(tempDir);
    process.exit(1);
  }

  // Cleanup temp directory if used
  if (tempDir) {
    cleanupTemp(tempDir);
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
    chalk.white(`Version: ${chalk.cyan(versionInfo.version)}`),
  ];

  if (versionInfo.branch && versionInfo.branch !== 'local') {
    summaryLines.push(chalk.white(`Branch: ${chalk.cyan(versionInfo.branch)}`));
  }
  if (versionInfo.commit) {
    summaryLines.push(chalk.white(`Commit: ${chalk.cyan(versionInfo.commit)}`));
  }

  summaryLines.push(
    '',
    chalk.gray(`Files installed: ${totalFiles}`),
    chalk.gray(`Directories created: ${totalDirs}`),
    '',
    chalk.gray(`Manifest: ${basename(manifestPath)}`)
  );

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
 * Select version and download from GitHub
 * @param {Object} options - Command options
 * @returns {Promise<Object|null>} - Download result or null if cancelled
 */
async function selectAndDownloadVersion(options) {
  console.log('');
  divider();
  info('Version Selection');
  divider();
  console.log('');

  // Fetch version information
  const spinner = createSpinner('Fetching version information...').start();

  let latestRelease = null;
  let latestCommit = null;
  let recentReleases = [];

  try {
    [latestRelease, latestCommit, recentReleases] = await Promise.all([
      fetchLatestRelease().catch(() => null),
      fetchLatestCommit('main').catch(() => null),
      fetchRecentReleases(5).catch(() => [])
    ]);
    spinner.succeed('Version information loaded');
  } catch (err) {
    spinner.warn('Could not fetch all version info');
  }

  console.log('');

  // Build version choices
  const choices = [];

  // Option 1: Latest Stable
  if (latestRelease) {
    choices.push({
      name: `${chalk.green('1)')} ${chalk.green.bold('Latest Stable')} ${chalk.cyan(latestRelease.tag)} ${chalk.gray(`(${latestRelease.date})`)} ${chalk.green('← Recommended')}`,
      value: { type: 'stable', tag: '' }
    });
  } else {
    choices.push({
      name: `${chalk.green('1)')} ${chalk.green.bold('Latest Stable')} ${chalk.gray('(auto-detect)')} ${chalk.green('← Recommended')}`,
      value: { type: 'stable', tag: '' }
    });
  }

  // Option 2: Latest Development
  if (latestCommit) {
    choices.push({
      name: `${chalk.yellow('2)')} ${chalk.yellow.bold('Latest Development')} ${chalk.gray(`main @ ${latestCommit.shortSha}`)} ${chalk.gray(`(${latestCommit.date})`)}`,
      value: { type: 'latest', branch: 'main' }
    });
  } else {
    choices.push({
      name: `${chalk.yellow('2)')} ${chalk.yellow.bold('Latest Development')} ${chalk.gray('(main branch)')}`,
      value: { type: 'latest', branch: 'main' }
    });
  }

  // Option 3: Specific Version
  choices.push({
    name: `${chalk.cyan('3)')} ${chalk.cyan.bold('Specific Version')} ${chalk.gray('- Choose from available releases')}`,
    value: { type: 'specific' }
  });

  // Option 4: Custom Branch
  choices.push({
    name: `${chalk.magenta('4)')} ${chalk.magenta.bold('Custom Branch')} ${chalk.gray('- Install from a specific branch')}`,
    value: { type: 'branch' }
  });

  // Check if version was specified via CLI
  if (options.version === 'stable') {
    return await downloadVersion({ type: 'stable', tag: options.tag || '' });
  } else if (options.version === 'latest') {
    return await downloadVersion({ type: 'latest', branch: 'main' });
  } else if (options.version === 'branch' && options.branch) {
    return await downloadVersion({ type: 'branch', branch: options.branch });
  }

  // Interactive selection
  const { versionChoice } = await inquirer.prompt([{
    type: 'list',
    name: 'versionChoice',
    message: 'Select version to install:',
    choices
  }]);

  // Handle specific version selection
  if (versionChoice.type === 'specific') {
    const tagChoices = recentReleases.length > 0
      ? recentReleases.map(r => ({
          name: `${r.tag} ${chalk.gray(`(${r.date})`)}`,
          value: r.tag
        }))
      : [
          { name: 'v3.2.0', value: 'v3.2.0' },
          { name: 'v3.1.0', value: 'v3.1.0' },
          { name: 'v3.0.1', value: 'v3.0.1' }
        ];

    tagChoices.push({
      name: chalk.gray('Enter custom tag...'),
      value: 'custom'
    });

    const { selectedTag } = await inquirer.prompt([{
      type: 'list',
      name: 'selectedTag',
      message: 'Select release version:',
      choices: tagChoices
    }]);

    let tag = selectedTag;
    if (selectedTag === 'custom') {
      const { customTag } = await inquirer.prompt([{
        type: 'input',
        name: 'customTag',
        message: 'Enter version tag (e.g., v3.2.0):',
        validate: (input) => input ? true : 'Tag is required'
      }]);
      tag = customTag;
    }

    return await downloadVersion({ type: 'stable', tag });
  }

  // Handle custom branch selection
  if (versionChoice.type === 'branch') {
    const { branchName } = await inquirer.prompt([{
      type: 'input',
      name: 'branchName',
      message: 'Enter branch name:',
      default: 'main',
      validate: (input) => input ? true : 'Branch name is required'
    }]);

    return await downloadVersion({ type: 'branch', branch: branchName });
  }

  return await downloadVersion(versionChoice);
}

/**
 * Download specified version
 * @param {Object} versionChoice - Version selection
 * @returns {Promise<Object|null>} - Download result
 */
async function downloadVersion(versionChoice) {
  console.log('');
  const spinner = createSpinner('Downloading from GitHub...').start();

  try {
    const result = await downloadAndExtract(versionChoice);
    spinner.succeed(`Downloaded: ${result.version} (${result.branch})`);
    return result;
  } catch (err) {
    spinner.fail('Download failed');
    error(err.message);
    console.log('');
    warning('Common causes:');
    console.log(chalk.gray('  • Network connection issues'));
    console.log(chalk.gray('  • Invalid version tag or branch name'));
    console.log(chalk.gray('  • GitHub API rate limit exceeded'));
    console.log('');
    return null;
  }
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
