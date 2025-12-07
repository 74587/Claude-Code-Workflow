import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join, dirname, basename } from 'path';
import { homedir } from 'os';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { showBanner, createSpinner, success, info, warning, error, summaryBox, divider } from '../utils/ui.js';
import { getAllManifests, createManifest, addFileEntry, addDirectoryEntry, saveManifest, deleteManifest } from '../core/manifest.js';
import { fetchLatestRelease, fetchLatestCommit, fetchRecentReleases, downloadAndExtract, cleanupTemp, REPO_URL } from '../utils/version-fetcher.js';

// Source directories to install
const SOURCE_DIRS = ['.claude', '.codex', '.gemini', '.qwen'];

/**
 * Upgrade command handler
 * @param {Object} options - Command options
 */
export async function upgradeCommand(options) {
  showBanner();
  console.log(chalk.cyan.bold('  Upgrade Claude Code Workflow\n'));

  // Get all manifests
  const manifests = getAllManifests();

  if (manifests.length === 0) {
    warning('No installations found.');
    info('Run "ccw install" to install first.');
    return;
  }

  // Fetch latest version info
  const spinner = createSpinner('Checking for updates...').start();

  let latestRelease = null;
  let latestCommit = null;

  try {
    [latestRelease, latestCommit] = await Promise.all([
      fetchLatestRelease().catch(() => null),
      fetchLatestCommit('main').catch(() => null)
    ]);
    spinner.succeed('Version information loaded');
  } catch (err) {
    spinner.fail('Could not fetch version info');
    error(err.message);
    return;
  }

  console.log('');

  // Display current installations with version comparison
  console.log(chalk.white.bold('  Current installations:\n'));

  const upgradeTargets = [];

  for (let i = 0; i < manifests.length; i++) {
    const m = manifests[i];
    const modeColor = m.installation_mode === 'Global' ? chalk.cyan : chalk.yellow;

    // Read current version
    const versionFile = join(m.installation_path, '.claude', 'version.json');
    let currentVersion = 'unknown';
    let currentBranch = '';

    if (existsSync(versionFile)) {
      try {
        const versionData = JSON.parse(readFileSync(versionFile, 'utf8'));
        currentVersion = versionData.version || 'unknown';
        currentBranch = versionData.branch || '';
      } catch {
        // Ignore parse errors
      }
    }

    // Determine if upgrade is available
    let upgradeAvailable = false;
    let targetVersion = '';

    if (latestRelease) {
      const latestVer = latestRelease.version;
      if (currentVersion !== latestVer && !currentVersion.startsWith('dev-')) {
        upgradeAvailable = true;
        targetVersion = latestVer;
      }
    }

    console.log(chalk.white(`  ${i + 1}. `) + modeColor.bold(m.installation_mode));
    console.log(chalk.gray(`     Path: ${m.installation_path}`));
    console.log(chalk.gray(`     Current: ${currentVersion}${currentBranch ? ` (${currentBranch})` : ''}`));

    if (upgradeAvailable && latestRelease) {
      console.log(chalk.green(`     Available: ${latestRelease.tag} `) + chalk.green('← Update available'));
      upgradeTargets.push({
        manifest: m,
        currentVersion,
        targetVersion: latestRelease.tag,
        index: i
      });
    } else if (currentVersion.startsWith('dev-')) {
      console.log(chalk.yellow(`     Development version - use --latest to update`));
    } else {
      console.log(chalk.gray(`     Up to date ✓`));
    }
    console.log('');
  }

  divider();

  // Version selection
  let versionChoice = { type: 'stable', tag: '' };

  if (options.latest) {
    versionChoice = { type: 'latest', branch: 'main' };
    info('Upgrading to latest development version (main branch)');
  } else if (options.tag) {
    versionChoice = { type: 'stable', tag: options.tag };
    info(`Upgrading to specific version: ${options.tag}`);
  } else if (options.branch) {
    versionChoice = { type: 'branch', branch: options.branch };
    info(`Upgrading to branch: ${options.branch}`);
  } else {
    // Interactive version selection if no targets or --select specified
    if (upgradeTargets.length === 0 || options.select) {
      const { selectVersion } = await inquirer.prompt([{
        type: 'confirm',
        name: 'selectVersion',
        message: 'Select a specific version to install?',
        default: false
      }]);

      if (selectVersion) {
        versionChoice = await selectVersionInteractive(latestRelease, latestCommit);
        if (!versionChoice) return;
      } else if (upgradeTargets.length === 0) {
        info('All installations are up to date.');
        return;
      }
    }
  }

  // Select which installations to upgrade
  let selectedManifests = [];

  if (options.all) {
    selectedManifests = manifests;
  } else if (manifests.length === 1) {
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Upgrade ${manifests[0].installation_mode} installation at ${manifests[0].installation_path}?`,
      default: true
    }]);

    if (!confirm) {
      info('Upgrade cancelled');
      return;
    }

    selectedManifests = [manifests[0]];
  } else {
    const choices = manifests.map((m, i) => {
      const target = upgradeTargets.find(t => t.index === i);
      const label = target
        ? `${m.installation_mode} - ${m.installation_path} ${chalk.green('(update available)')}`
        : `${m.installation_mode} - ${m.installation_path}`;
      return {
        name: label,
        value: i,
        checked: !!target
      };
    });

    const { selections } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selections',
      message: 'Select installations to upgrade:',
      choices
    }]);

    if (selections.length === 0) {
      info('No installations selected');
      return;
    }

    selectedManifests = selections.map(i => manifests[i]);
  }

  // Download new version
  console.log('');
  const downloadSpinner = createSpinner('Downloading update...').start();

  let downloadResult;
  try {
    downloadResult = await downloadAndExtract(versionChoice);
    downloadSpinner.succeed(`Downloaded: ${downloadResult.version} (${downloadResult.branch})`);
  } catch (err) {
    downloadSpinner.fail('Download failed');
    error(err.message);
    return;
  }

  // Perform upgrades
  console.log('');
  const results = [];

  for (const manifest of selectedManifests) {
    const upgradeSpinner = createSpinner(`Upgrading ${manifest.installation_mode} at ${manifest.installation_path}...`).start();

    try {
      const result = await performUpgrade(manifest, downloadResult);
      upgradeSpinner.succeed(`Upgraded ${manifest.installation_mode}: ${result.files} files`);
      results.push({ manifest, success: true, ...result });
    } catch (err) {
      upgradeSpinner.fail(`Failed to upgrade ${manifest.installation_mode}`);
      error(err.message);
      results.push({ manifest, success: false, error: err.message });
    }
  }

  // Cleanup
  cleanupTemp(downloadResult.tempDir);

  // Show summary
  console.log('');

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  const summaryLines = [
    successCount === results.length
      ? chalk.green.bold('✓ Upgrade Successful')
      : chalk.yellow.bold('⚠ Upgrade Completed with Issues'),
    '',
    chalk.white(`Version: ${chalk.cyan(downloadResult.version)}`),
    chalk.white(`Branch: ${chalk.cyan(downloadResult.branch)}`),
    ''
  ];

  if (successCount > 0) {
    summaryLines.push(chalk.green(`Upgraded: ${successCount} installation(s)`));
  }
  if (failCount > 0) {
    summaryLines.push(chalk.red(`Failed: ${failCount} installation(s)`));
  }

  summaryBox({
    title: ' Upgrade Summary ',
    lines: summaryLines,
    borderColor: failCount > 0 ? 'yellow' : 'green'
  });

  // Show next steps
  console.log('');
  info('Next steps:');
  console.log(chalk.gray('  1. Restart Claude Code or your IDE'));
  console.log(chalk.gray('  2. Run: ccw view - to open the workflow dashboard'));
  console.log('');
}

/**
 * Interactive version selection
 * @param {Object} latestRelease - Latest release info
 * @param {Object} latestCommit - Latest commit info
 * @returns {Promise<Object|null>} - Version choice
 */
async function selectVersionInteractive(latestRelease, latestCommit) {
  const choices = [];

  // Option 1: Latest Stable
  if (latestRelease) {
    choices.push({
      name: `${chalk.green.bold('Latest Stable')} ${chalk.cyan(latestRelease.tag)} ${chalk.gray(`(${latestRelease.date})`)}`,
      value: { type: 'stable', tag: '' }
    });
  }

  // Option 2: Latest Development
  if (latestCommit) {
    choices.push({
      name: `${chalk.yellow.bold('Latest Development')} ${chalk.gray(`main @ ${latestCommit.shortSha}`)}`,
      value: { type: 'latest', branch: 'main' }
    });
  }

  // Option 3: Specific Version
  choices.push({
    name: `${chalk.cyan.bold('Specific Version')} ${chalk.gray('- Enter a release tag')}`,
    value: { type: 'specific' }
  });

  // Option 4: Cancel
  choices.push({
    name: chalk.gray('Cancel'),
    value: null
  });

  const { versionChoice } = await inquirer.prompt([{
    type: 'list',
    name: 'versionChoice',
    message: 'Select version to upgrade to:',
    choices
  }]);

  if (!versionChoice) {
    info('Upgrade cancelled');
    return null;
  }

  if (versionChoice.type === 'specific') {
    const recentReleases = await fetchRecentReleases(5).catch(() => []);

    const tagChoices = recentReleases.length > 0
      ? recentReleases.map(r => ({
          name: `${r.tag} ${chalk.gray(`(${r.date})`)}`,
          value: r.tag
        }))
      : [];

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

    return { type: 'stable', tag };
  }

  return versionChoice;
}

/**
 * Perform upgrade for a single installation
 * @param {Object} manifest - Installation manifest
 * @param {Object} downloadResult - Download result with repoDir
 * @returns {Promise<Object>} - Upgrade result
 */
async function performUpgrade(manifest, downloadResult) {
  const installPath = manifest.installation_path;
  const sourceDir = downloadResult.repoDir;

  // Get available source directories
  const availableDirs = SOURCE_DIRS.filter(dir => existsSync(join(sourceDir, dir)));

  if (availableDirs.length === 0) {
    throw new Error('No source directories found in download');
  }

  // Create new manifest
  const newManifest = createManifest(manifest.installation_mode, installPath);

  let totalFiles = 0;
  let totalDirs = 0;

  // Copy each directory
  for (const dir of availableDirs) {
    const srcPath = join(sourceDir, dir);
    const destPath = join(installPath, dir);

    const { files, directories } = await copyDirectory(srcPath, destPath, newManifest);
    totalFiles += files;
    totalDirs += directories;
  }

  // Update version.json
  const versionPath = join(installPath, '.claude', 'version.json');
  if (existsSync(dirname(versionPath))) {
    const versionData = {
      version: downloadResult.version,
      branch: downloadResult.branch,
      commit: downloadResult.commit,
      installedAt: new Date().toISOString(),
      upgradedAt: new Date().toISOString(),
      mode: manifest.installation_mode,
      installer: 'ccw'
    };
    writeFileSync(versionPath, JSON.stringify(versionData, null, 2), 'utf8');
    addFileEntry(newManifest, versionPath);
    totalFiles++;
  }

  // Delete old manifest and save new one
  if (manifest.manifest_file) {
    deleteManifest(manifest.manifest_file);
  }
  saveManifest(newManifest);

  return { files: totalFiles, directories: totalDirs };
}

/**
 * Copy directory recursively
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 * @param {Object} manifest - Manifest to track files
 * @returns {Object} - Count of files and directories
 */
async function copyDirectory(src, dest, manifest) {
  let files = 0;
  let directories = 0;

  // Create destination directory
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
    directories++;
    addDirectoryEntry(manifest, dest);
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
      addFileEntry(manifest, destPath);
    }
  }

  return { files, directories };
}
