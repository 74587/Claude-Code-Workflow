import { existsSync, readdirSync, statSync, copyFileSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname, basename } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { showBanner, createSpinner, info, warning, error, summaryBox, divider } from '../utils/ui.js';
import { getAllManifests, createManifest, addFileEntry, addDirectoryEntry, saveManifest, deleteManifest } from '../core/manifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Source directories to install
const SOURCE_DIRS = ['.claude', '.codex', '.ccw'];

// Subdirectories that should always be installed to global (~/.claude/)
const GLOBAL_SUBDIRS = ['workflows', 'scripts', 'templates'];

// Files that should always be installed to global (~/.claude/)
const GLOBAL_FILES = ['CLAUDE.CCW.md'];

// Files that should be excluded from copy (user-specific settings)
const EXCLUDED_FILES = ['settings.json', 'settings.local.json', 'CLAUDE.md'];

interface UpgradeOptions {
  all?: boolean;
}

interface UpgradeResult {
  files: number;
  directories: number;
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

/**
 * Upgrade command handler
 * @param {Object} options - Command options
 */
export async function upgradeCommand(options: UpgradeOptions): Promise<void> {
  showBanner();
  console.log(chalk.cyan.bold('  Upgrade Claude Code Workflow\n'));

  const currentVersion = getVersion();

  // Get all manifests
  const manifests = getAllManifests();

  if (manifests.length === 0) {
    warning('No installations found.');
    info('Run "ccw install" to install first.');
    return;
  }

  // Display current installations
  console.log(chalk.white.bold('  Current installations:\n'));

  const upgradeTargets: any[] = [];

  for (let i = 0; i < manifests.length; i++) {
    const m = manifests[i];
    const modeColor = m.installation_mode === 'Global' ? chalk.cyan : chalk.yellow;

    // Read installed version
    const versionFile = join(m.installation_path, '.claude', 'version.json');
    let installedVersion = 'unknown';

    if (existsSync(versionFile)) {
      try {
        const versionData = JSON.parse(readFileSync(versionFile, 'utf8'));
        installedVersion = versionData.version || 'unknown';
      } catch {
        // Ignore parse errors
      }
    }

    // Check if upgrade needed
    const needsUpgrade = installedVersion !== currentVersion;

    console.log(chalk.white(`  ${i + 1}. `) + modeColor.bold(m.installation_mode));
    console.log(chalk.gray(`     Path: ${m.installation_path}`));
    console.log(chalk.gray(`     Installed: ${installedVersion}`));

    if (needsUpgrade) {
      console.log(chalk.green(`     Package: ${currentVersion} `) + chalk.green('← Update available'));
      upgradeTargets.push({ manifest: m, installedVersion, index: i });
    } else {
      console.log(chalk.gray(`     Up to date ✓`));
    }
    console.log('');
  }

  divider();

  if (upgradeTargets.length === 0) {
    info('All installations are up to date.');
    console.log('');
    info('To upgrade ccw itself, run:');
    console.log(chalk.cyan('  npm update -g claude-code-workflow'));
    console.log('');
    return;
  }

  // Select which installations to upgrade
  let selectedManifests: any[] = [];

  if (options.all) {
    selectedManifests = upgradeTargets.map(t => t.manifest);
  } else if (upgradeTargets.length === 1) {
    const target = upgradeTargets[0];
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Upgrade ${target.manifest.installation_mode} installation (${target.installedVersion} → ${currentVersion})?`,
      default: true
    }]);

    if (!confirm) {
      info('Upgrade cancelled');
      return;
    }

    selectedManifests = [target.manifest];
  } else {
    const choices = upgradeTargets.map((t, i) => ({
      name: `${t.manifest.installation_mode} - ${t.manifest.installation_path} (${t.installedVersion} → ${currentVersion})`,
      value: i,
      checked: true
    }));

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

    selectedManifests = selections.map((i: number) => upgradeTargets[i].manifest);
  }

  // Perform upgrades
  console.log('');
  const results: any[] = [];
  const sourceDir = getSourceDir();

  for (const manifest of selectedManifests) {
    const upgradeSpinner = createSpinner(`Upgrading ${manifest.installation_mode} at ${manifest.installation_path}...`).start();

    try {
      const result = await performUpgrade(manifest, sourceDir, currentVersion);
      upgradeSpinner.succeed(`Upgraded ${manifest.installation_mode}: ${result.files} files`);
      results.push({ manifest, success: true, ...result });
    } catch (err) {
      const errMsg = err as Error;
      upgradeSpinner.fail(`Failed to upgrade ${manifest.installation_mode}`);
      error(errMsg.message);
      results.push({ manifest, success: false, error: errMsg.message });
    }
  }

  // Show summary
  console.log('');

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  const summaryLines = [
    successCount === results.length
      ? chalk.green.bold('✓ Upgrade Successful')
      : chalk.yellow.bold('⚠ Upgrade Completed with Issues'),
    '',
    chalk.white(`Version: ${chalk.cyan(currentVersion)}`),
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
 * Perform upgrade for a single installation
 * @param {Object} manifest - Installation manifest
 * @param {string} sourceDir - Source directory
 * @param {string} version - Version string
 * @returns {Promise<Object>} - Upgrade result
 */
async function performUpgrade(manifest: any, sourceDir: string, version: string): Promise<UpgradeResult> {
  const installPath = manifest.installation_path;
  const mode = manifest.installation_mode;

  // Get available source directories
  const availableDirs = SOURCE_DIRS.filter(dir => existsSync(join(sourceDir, dir)));

  if (availableDirs.length === 0) {
    throw new Error('No source directories found');
  }

  // Create new manifest
  const newManifest = createManifest(mode, installPath);

  let totalFiles = 0;
  let totalDirs = 0;

  // For Path mode, upgrade workflows to global first
  if (mode === 'Path') {
    const globalPath = homedir();
    for (const subdir of GLOBAL_SUBDIRS) {
      const srcWorkflows = join(sourceDir, '.claude', subdir);
      if (existsSync(srcWorkflows)) {
        const destWorkflows = join(globalPath, '.claude', subdir);
        const { files, directories } = await copyDirectory(srcWorkflows, destWorkflows, newManifest);
        totalFiles += files;
        totalDirs += directories;
      }
    }
  }

  // Copy each directory
  for (const dir of availableDirs) {
    const srcPath = join(sourceDir, dir);

    // .ccw always upgrades to global ~/.ccw/ regardless of mode
    const destBase = (mode === 'Path' && dir === '.ccw') ? homedir() : installPath;
    const destPath = join(destBase, dir);

    // For Path mode on .claude, exclude global subdirs (they're already installed to global)
    const excludeDirs = (mode === 'Path' && dir === '.claude') ? GLOBAL_SUBDIRS : [];
    const { files, directories } = await copyDirectory(srcPath, destPath, newManifest, excludeDirs);
    totalFiles += files;
    totalDirs += directories;
  }

  // Install global files (CLAUDE.CCW.md) always to ~/.claude/
  for (const file of GLOBAL_FILES) {
    const srcFile = join(sourceDir, '.claude', file);
    if (existsSync(srcFile)) {
      const globalClaudeDir = join(homedir(), '.claude');
      if (!existsSync(globalClaudeDir)) {
        mkdirSync(globalClaudeDir, { recursive: true });
      }
      const destFile = join(globalClaudeDir, file);
      copyFileSync(srcFile, destFile);
      addFileEntry(newManifest, destFile);
      totalFiles++;
    }
  }

  // Migration: if old CLAUDE.md was installed by ccw, migrate to CLAUDE.CCW.md
  const oldClaudeMd = join(installPath, '.claude', 'CLAUDE.md');
  const srcClaudeCcwMd = join(sourceDir, '.claude', 'CLAUDE.CCW.md');
  if (existsSync(oldClaudeMd) && existsSync(srcClaudeCcwMd)) {
    const oldContent = readFileSync(oldClaudeMd, 'utf8');
    const srcContent = readFileSync(srcClaudeCcwMd, 'utf8');

    // Calculate similarity between old CLAUDE.md and source CLAUDE.CCW.md
    const similarity = calculateSimilarity(oldContent, srcContent);

    if (similarity > 0.5) {
      // Similar content — ask user whether to migrate
      console.log('');
      info(`Detected existing CLAUDE.md that is ${Math.round(similarity * 100)}% similar to ccw's CLAUDE.CCW.md`);
      console.log(chalk.gray(`  File: ${oldClaudeMd}`));

      const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'How to handle the old CLAUDE.md?',
        choices: [
          {
            name: 'Delete and create project CLAUDE.md with @ reference (recommended)',
            value: 'migrate',
            short: 'Migrate'
          },
          {
            name: 'Keep as-is (manual merge required)',
            value: 'keep',
            short: 'Keep'
          }
        ]
      }]);

      if (action === 'migrate') {
        // Delete old ccw CLAUDE.md from install path
        unlinkSync(oldClaudeMd);
        // Create project CLAUDE.md with @ reference
        const minimalContent = '# Project Instructions\n\n- **CCW Instructions**: @~/.claude/CLAUDE.CCW.md\n';
        writeFileSync(oldClaudeMd, minimalContent, 'utf8');
        addFileEntry(newManifest, oldClaudeMd);
        totalFiles++;
        info('Migrated CLAUDE.md → CLAUDE.CCW.md (global) + project @ reference');
      }
    } else if (oldContent.includes('Coding Philosophy') || oldContent.includes('CLI Endpoints')) {
      // Contains ccw markers but content diverged — still migrate
      const newClaudeMd = join(homedir(), '.claude', 'CLAUDE.CCW.md');
      const globalClaudeDir = join(homedir(), '.claude');
      if (!existsSync(globalClaudeDir)) mkdirSync(globalClaudeDir, { recursive: true });
      writeFileSync(newClaudeMd, oldContent, 'utf8');
      addFileEntry(newManifest, newClaudeMd);
      unlinkSync(oldClaudeMd);
      totalFiles++;
      info('Migrated CLAUDE.md → CLAUDE.CCW.md (global)');
    }
  }

  // For Path mode: ensure project CLAUDE.md has @ reference
  if (mode === 'Path') {
    const projectClaudeMd = join(installPath, '.claude', 'CLAUDE.md');
    if (!existsSync(projectClaudeMd)) {
      const minimalContent = '# Project Instructions\n\n- **CCW Instructions**: @~/.claude/CLAUDE.CCW.md\n';
      const projectClaudeDir = join(installPath, '.claude');
      if (!existsSync(projectClaudeDir)) {
        mkdirSync(projectClaudeDir, { recursive: true });
      }
      writeFileSync(projectClaudeMd, minimalContent, 'utf8');
      addFileEntry(newManifest, projectClaudeMd);
      totalFiles++;
    } else {
      const content = readFileSync(projectClaudeMd, 'utf8');
      if (!content.includes('CLAUDE.CCW.md')) {
        warning('Project CLAUDE.md does not reference CLAUDE.CCW.md');
        info('Add this line to your CLAUDE.md: - **CCW Instructions**: @~/.claude/CLAUDE.CCW.md');
      }
    }
  }

  // Update version.json
  const versionPath = join(installPath, '.claude', 'version.json');
  if (existsSync(dirname(versionPath))) {
    const versionData = {
      version: version,
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
 * @param {string[]} excludeDirs - Directory names to exclude (optional)
 * @returns {Object} - Count of files and directories
 */
async function copyDirectory(
  src: string,
  dest: string,
  manifest: any,
  excludeDirs: string[] = [],
  excludeFiles: string[] = EXCLUDED_FILES
): Promise<CopyResult> {
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
      addFileEntry(manifest, destPath);
    }
  }

  return { files, directories };
}

/**
 * Calculate similarity between two strings using line-based comparison
 * Returns a value between 0 (completely different) and 1 (identical)
 */
function calculateSimilarity(a: string, b: string): number {
  const linesA = a.split('\n').filter(l => l.trim().length > 0);
  const linesB = b.split('\n').filter(l => l.trim().length > 0);

  if (linesA.length === 0 && linesB.length === 0) return 1;
  if (linesA.length === 0 || linesB.length === 0) return 0;

  const setA = new Set(linesA);
  const setB = new Set(linesB);

  let intersection = 0;
  for (const line of setA) {
    if (setB.has(line)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}
