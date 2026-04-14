import { existsSync, unlinkSync, rmdirSync, readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { homedir, platform } from 'os';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { showBanner, createSpinner, success, info, warning, error, summaryBox, divider } from '../utils/ui.js';
import { getAllManifests, deleteManifest } from '../core/manifest.js';
import { removeGitBashFix } from './install.js';

// Global subdirectories that should be protected when Global installation exists
const GLOBAL_SUBDIRS = ['workflows', 'scripts', 'templates'];

// CCW reference patterns in CLAUDE.md
const CCW_REFERENCE_PATTERNS = [
  /^-\s*\*\*CCW Instructions\*\*:\s*@~\/\.claude\/CLAUDE\.CCW\.md\s*$/,
  /^-\s*\*\*CCW Instructions\*\*.*CLAUDE\.CCW\.md.*$/,
];

// Files that should have CCW content removed instead of being deleted
const CONTENT_MANAGED_FILES = ['CLAUDE.md'];

interface UninstallOptions {}

interface FileEntry {
  path: string;
  error: string;
}

/**
 * Uninstall command handler
 * @param {Object} options - Command options
 */
export async function uninstallCommand(options: UninstallOptions): Promise<void> {
  showBanner();
  console.log(chalk.cyan.bold('  Uninstall Claude Code Workflow\n'));

  // Get all manifests
  const manifests = getAllManifests();

  if (manifests.length === 0) {
    warning('No installations found.');
    info('Nothing to uninstall.');
    return;
  }

  // Display installations
  console.log(chalk.white.bold('  Found installations:\n'));

  manifests.forEach((m, i) => {
    const modeColor = m.installation_mode === 'Global' ? chalk.cyan : chalk.yellow;
    console.log(chalk.white(`  ${i + 1}. `) + modeColor.bold(m.installation_mode));
    console.log(chalk.gray(`     Path: ${m.installation_path}`));
    console.log(chalk.gray(`     Date: ${new Date(m.installation_date).toLocaleDateString()}`));
    console.log(chalk.gray(`     Version: ${m.application_version}`));
    console.log(chalk.gray(`     Files: ${m.files_count} | Dirs: ${m.directories_count}`));
    console.log('');
  });

  divider();

  // Select installation to uninstall
  let selectedManifest: any;

  if (manifests.length === 1) {
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Uninstall ${manifests[0].installation_mode} installation at ${manifests[0].installation_path}?`,
      default: false
    }]);

    if (!confirm) {
      info('Uninstall cancelled');
      return;
    }

    selectedManifest = manifests[0];
  } else {
    const choices = manifests.map((m, i) => ({
      name: `${m.installation_mode} - ${m.installation_path}`,
      value: i
    }));

    choices.push({ name: chalk.gray('Cancel'), value: -1 });

    const { selection } = await inquirer.prompt([{
      type: 'list',
      name: 'selection',
      message: 'Select installation to uninstall:',
      choices
    }]);

    if (selection === -1) {
      info('Uninstall cancelled');
      return;
    }

    selectedManifest = manifests[selection];

    // Confirm selection
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to uninstall ${selectedManifest.installation_mode} installation?`,
      default: false
    }]);

    if (!confirm) {
      info('Uninstall cancelled');
      return;
    }
  }

  console.log('');

  // Check if this is a Path mode uninstallation and if Global installation exists
  const isPathMode = selectedManifest.installation_mode === 'Path';
  const globalClaudeDir = join(homedir(), '.claude');
  let hasGlobalInstallation = false;
  let skippedFiles = 0;

  if (isPathMode) {
    // Check if any Global installation manifest exists
    const globalManifest = manifests.find(m => m.installation_mode === 'Global');
    if (globalManifest) {
      hasGlobalInstallation = true;
      info('Global installation detected - global files will be preserved');
      console.log('');
    }
  }

  // Perform uninstallation
  const spinner = createSpinner('Removing files...').start();

  let removedFiles = 0;
  let removedDirs = 0;
  let failedFiles: FileEntry[] = [];
  let orphanStats = { removed: 0, scanned: 0 };

  try {
    // Remove files first (in reverse order to handle nested files)
    const files = [...(selectedManifest.files || [])].reverse();

    for (const fileEntry of files) {
      const filePath = fileEntry.path;

      // For Path mode uninstallation, skip global files if Global installation exists
      if (isPathMode && hasGlobalInstallation) {
        const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');
        const normalizedGlobalDir = globalClaudeDir.toLowerCase().replace(/\\/g, '/');

        // Check if file is under global .claude directory
        if (normalizedPath.startsWith(normalizedGlobalDir)) {
          // Check if it's in one of the global subdirectories
          const relativePath = normalizedPath.substring(normalizedGlobalDir.length + 1);
          const topDir = relativePath.split('/')[0];

          if (GLOBAL_SUBDIRS.includes(topDir)) {
            skippedFiles++;
            continue;
          }
        }
      }

      const fileName = basename(filePath);
      spinner.text = `Removing: ${fileName}`;

      // Special handling for CLAUDE.md: remove CCW content instead of deleting
      if (CONTENT_MANAGED_FILES.includes(fileName)) {
        try {
          if (existsSync(filePath)) {
            const cleaned = removeCcwContentFromClaudeMd(filePath);
            if (cleaned) {
              removedFiles++; // Count as processed
            }
          }
        } catch (err) {
          const error = err as Error;
          failedFiles.push({ path: filePath, error: error.message });
        }
        continue;
      }

      try {
        if (existsSync(filePath)) {
          unlinkSync(filePath);
          removedFiles++;
        }
      } catch (err) {
        const error = err as Error;
        failedFiles.push({ path: filePath, error: error.message });
      }
    }

    // Remove directories (in reverse order to remove nested dirs first)
    const directories = [...(selectedManifest.directories || [])].reverse();

    // Sort by path length (deepest first)
    directories.sort((a: any, b: any) => b.path.length - a.path.length);

    for (const dirEntry of directories) {
      const dirPath = dirEntry.path;
      spinner.text = `Removing directory: ${basename(dirPath)}`;

      try {
        if (existsSync(dirPath)) {
          // Only remove if empty
          const contents = readdirSync(dirPath);
          if (contents.length === 0) {
            rmdirSync(dirPath);
            removedDirs++;
          }
        }
      } catch (err) {
        // Ignore directory removal errors (might not be empty)
      }
    }

    // Try to clean up parent directories if empty
    const installPath = selectedManifest.installation_path;
    for (const dir of ['.claude', '.codex']) {
      const dirPath = join(installPath, dir);
      try {
        if (existsSync(dirPath)) {
          await removeEmptyDirs(dirPath);
        }
      } catch {
        // Ignore
      }
    }

    // Note: orphan cleanup removed — only manifest-tracked files are deleted.
    // Non-manifest files (user-created skills/commands) are preserved.
    orphanStats = { removed: 0, scanned: 0 };

    // Clean up CLAUDE.CCW.md from global space
    const globalClaudeCcwMd = join(homedir(), '.claude', 'CLAUDE.CCW.md');
    if (existsSync(globalClaudeCcwMd)) {
      try {
        unlinkSync(globalClaudeCcwMd);
        removedFiles++;
      } catch {
        // Ignore if in use
      }
    }

    spinner.succeed('Uninstall complete!');

  } catch (err) {
    spinner.fail('Uninstall failed');
    const errMsg = err as Error;
    error(errMsg.message);
    return;
  }

  // Remove CCW hooks from settings.json (based on manifest records)
  let hookCleanupResult = { removed: 0, ids: [] as string[] };
  const manifestHooks = (selectedManifest as any).hooks || [];
  if (manifestHooks.length > 0) {
    try {
      const { uninstallTemplateHooks } = await import('../core/hooks/hook-templates.js');
      const hookIds = manifestHooks.map((h: any) => h.id);
      const scope = selectedManifest.installation_mode === 'Global' ? 'global' : 'project';
      hookCleanupResult = uninstallTemplateHooks(hookIds, scope);
    } catch {
      // Ignore if hook-templates is not available
    }
  }

  // Delete manifest
  deleteManifest(selectedManifest.manifest_file);

  // Show summary
  console.log('');

  const summaryLines: string[] = [];

  if (failedFiles.length > 0) {
    summaryLines.push(chalk.yellow.bold('⚠ Partially Completed'));
  } else {
    summaryLines.push(chalk.green.bold('✓ Successfully Uninstalled'));
  }

  summaryLines.push('');
  summaryLines.push(chalk.white(`Files removed: ${chalk.green(removedFiles.toString())}`));
  summaryLines.push(chalk.white(`Directories removed: ${chalk.green(removedDirs.toString())}`));

  if (skippedFiles > 0) {
    summaryLines.push(chalk.white(`Global files preserved: ${chalk.cyan(skippedFiles.toString())}`));
  }

  if (orphanStats.removed > 0) {
    summaryLines.push(chalk.white(`Orphan files cleaned: ${chalk.magenta(orphanStats.removed.toString())}`));
  }

  if (hookCleanupResult.removed > 0) {
    summaryLines.push(chalk.white(`Hooks removed: ${chalk.cyan(hookCleanupResult.removed.toString())} (${hookCleanupResult.ids.join(', ')})`));
  }

  if (failedFiles.length > 0) {
    summaryLines.push(chalk.white(`Failed: ${chalk.red(failedFiles.length.toString())}`));
    summaryLines.push('');
    summaryLines.push(chalk.gray('Some files could not be removed.'));
    summaryLines.push(chalk.gray('They may be in use or require elevated permissions.'));
  } else {
    summaryLines.push('');
    summaryLines.push(chalk.gray('Manifest removed'));
  }

  summaryBox({
    title: ' Uninstall Summary ',
    lines: summaryLines,
    borderColor: failedFiles.length > 0 ? 'yellow' : 'green'
  });

  if (process.env.DEBUG && failedFiles.length > 0) {
    console.log('');
    console.log(chalk.gray('Failed files:'));
    failedFiles.forEach(f => {
      console.log(chalk.red(`  ${f.path}: ${f.error}`));
    });
  }

  // Ask to remove Git Bash fix on Windows if this is the last installation
  const remainingManifests = getAllManifests();
  if (platform() === 'win32' && remainingManifests.length === 0) {
    console.log('');
    const { removeFix } = await inquirer.prompt([{
      type: 'confirm',
      name: 'removeFix',
      message: 'Remove Git Bash multi-line prompt fix from shell config?',
      default: true
    }]);

    if (removeFix) {
      const fixResult = removeGitBashFix();
      if (fixResult.removed) {
        info(`Git Bash fix: ${fixResult.message}`);
      } else {
        info(`Git Bash fix: ${fixResult.message}`);
      }
    }
  }

  console.log('');
}

/**
 * Recursively remove empty directories
 * @param {string} dirPath - Directory path
 */
async function removeEmptyDirs(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) return;

  const stat = statSync(dirPath);
  if (!stat.isDirectory()) return;

  let files = readdirSync(dirPath);

  // Recursively check subdirectories
  for (const file of files) {
    const filePath = join(dirPath, file);
    if (statSync(filePath).isDirectory()) {
      await removeEmptyDirs(filePath);
    }
  }

  // Re-check after processing subdirectories
  files = readdirSync(dirPath);
  if (files.length === 0) {
    rmdirSync(dirPath);
  }
}

/**
 * Remove CCW-added content from CLAUDE.md instead of deleting the entire file.
 * If the file only contains CCW content (the minimal template), delete it.
 * If it has user content, only remove the CCW reference line.
 * @param filePath - Path to CLAUDE.md
 * @returns true if content was removed/cleaned, false if nothing to do
 */
function removeCcwContentFromClaudeMd(filePath: string): boolean {
  if (!existsSync(filePath)) return false;

  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Check if this is the minimal CCW-only CLAUDE.md
  const minimalClaudeMd = '# Project Instructions\n\n- **CCW Instructions**: @~/.claude/CLAUDE.CCW.md\n';
  if (content.trim() === minimalClaudeMd.trim()) {
    // Entirely CCW-generated — safe to delete
    unlinkSync(filePath);
    return true;
  }

  // Has user content — only remove CCW reference lines
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    return !CCW_REFERENCE_PATTERNS.some(pattern => pattern.test(trimmed));
  });

  if (filteredLines.length === lines.length) {
    // No CCW content found — leave file as-is
    return false;
  }

  // Clean up: remove consecutive blank lines left behind
  const cleaned = filteredLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd() + '\n';

  writeFileSync(filePath, cleaned, 'utf8');
  return true;
}
