import chalk from 'chalk';
import { showBanner, divider, info } from '../utils/ui.js';
import { getAllManifests } from '../core/manifest.js';

/**
 * List command handler - shows all installations
 */
export async function listCommand(): Promise<void> {
  showBanner();
  console.log(chalk.cyan.bold('  Installed Claude Code Workflow Instances\n'));

  const manifests = getAllManifests();

  if (manifests.length === 0) {
    info('No installations found.');
    console.log('');
    console.log(chalk.gray('  Run: ccw install - to install Claude Code Workflow'));
    console.log('');
    return;
  }

  manifests.forEach((m, i) => {
    const modeColor = m.installation_mode === 'Global' ? chalk.cyan : chalk.yellow;

    console.log(chalk.white.bold(`  ${i + 1}. `) + modeColor.bold(m.installation_mode));
    console.log(chalk.gray(`     Path:    ${m.installation_path}`));
    console.log(chalk.gray(`     Date:    ${new Date(m.installation_date).toLocaleDateString()}`));
    console.log(chalk.gray(`     Version: ${m.application_version}`));
    console.log(chalk.gray(`     Files:   ${m.files_count}`));
    console.log(chalk.gray(`     Dirs:    ${m.directories_count}`));
    console.log('');
  });

  divider();
  console.log(chalk.gray('  Run: ccw uninstall - to remove an installation'));
  console.log('');
}
