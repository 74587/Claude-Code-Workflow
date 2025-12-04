import { existsSync, unlinkSync, rmdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { showBanner, createSpinner, success, info, warning, error, summaryBox, divider } from '../utils/ui.js';
import { getAllManifests, deleteManifest } from '../core/manifest.js';

/**
 * Uninstall command handler
 * @param {Object} options - Command options
 */
export async function uninstallCommand(options) {
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
  let selectedManifest;

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

  // Perform uninstallation
  const spinner = createSpinner('Removing files...').start();

  let removedFiles = 0;
  let removedDirs = 0;
  let failedFiles = [];

  try {
    // Remove files first (in reverse order to handle nested files)
    const files = [...(selectedManifest.files || [])].reverse();

    for (const fileEntry of files) {
      const filePath = fileEntry.path;
      spinner.text = `Removing: ${basename(filePath)}`;

      try {
        if (existsSync(filePath)) {
          unlinkSync(filePath);
          removedFiles++;
        }
      } catch (err) {
        failedFiles.push({ path: filePath, error: err.message });
      }
    }

    // Remove directories (in reverse order to remove nested dirs first)
    const directories = [...(selectedManifest.directories || [])].reverse();

    // Sort by path length (deepest first)
    directories.sort((a, b) => b.path.length - a.path.length);

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
    for (const dir of ['.claude', '.codex', '.gemini', '.qwen']) {
      const dirPath = join(installPath, dir);
      try {
        if (existsSync(dirPath)) {
          await removeEmptyDirs(dirPath);
        }
      } catch {
        // Ignore
      }
    }

    spinner.succeed('Uninstall complete!');

  } catch (err) {
    spinner.fail('Uninstall failed');
    error(err.message);
    return;
  }

  // Delete manifest
  deleteManifest(selectedManifest.manifest_file);

  // Show summary
  console.log('');

  if (failedFiles.length > 0) {
    summaryBox({
      title: ' Uninstall Summary ',
      lines: [
        chalk.yellow.bold('⚠ Partially Completed'),
        '',
        chalk.white(`Files removed: ${chalk.green(removedFiles)}`),
        chalk.white(`Directories removed: ${chalk.green(removedDirs)}`),
        chalk.white(`Failed: ${chalk.red(failedFiles.length)}`),
        '',
        chalk.gray('Some files could not be removed.'),
        chalk.gray('They may be in use or require elevated permissions.'),
      ],
      borderColor: 'yellow'
    });

    if (process.env.DEBUG) {
      console.log('');
      console.log(chalk.gray('Failed files:'));
      failedFiles.forEach(f => {
        console.log(chalk.red(`  ${f.path}: ${f.error}`));
      });
    }
  } else {
    summaryBox({
      title: ' Uninstall Summary ',
      lines: [
        chalk.green.bold('✓ Successfully Uninstalled'),
        '',
        chalk.white(`Files removed: ${chalk.green(removedFiles)}`),
        chalk.white(`Directories removed: ${chalk.green(removedDirs)}`),
        '',
        chalk.gray('Manifest removed'),
      ],
      borderColor: 'green'
    });
  }

  console.log('');
}

/**
 * Recursively remove empty directories
 * @param {string} dirPath - Directory path
 */
async function removeEmptyDirs(dirPath) {
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

