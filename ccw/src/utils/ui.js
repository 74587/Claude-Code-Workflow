import chalk from 'chalk';
import figlet from 'figlet';
import boxen from 'boxen';
import gradient from 'gradient-string';
import ora from 'ora';

// Custom gradient colors
const claudeGradient = gradient(['#00d4ff', '#00ff88']);
const codeGradient = gradient(['#00ff88', '#ffff00']);
const workflowGradient = gradient(['#ffff00', '#ff8800']);

/**
 * Display ASCII art banner
 */
export function showBanner() {
  console.log('');

  // CLAUDE in cyan gradient
  try {
    const claudeText = figlet.textSync('Claude', { font: 'Standard' });
    console.log(claudeGradient(claudeText));
  } catch {
    console.log(chalk.cyan.bold('  Claude'));
  }

  // CODE in green gradient
  try {
    const codeText = figlet.textSync('Code', { font: 'Standard' });
    console.log(codeGradient(codeText));
  } catch {
    console.log(chalk.green.bold('  Code'));
  }

  // WORKFLOW in yellow gradient
  try {
    const workflowText = figlet.textSync('Workflow', { font: 'Standard' });
    console.log(workflowGradient(workflowText));
  } catch {
    console.log(chalk.yellow.bold('  Workflow'));
  }

  console.log('');
}

/**
 * Display header with version info
 * @param {string} version - Version number
 * @param {string} mode - Installation mode
 */
export function showHeader(version, mode = '') {
  showBanner();

  const versionText = version ? `v${version}` : '';
  const modeText = mode ? ` (${mode})` : '';

  console.log(boxen(
    chalk.cyan.bold('Claude Code Workflow System') + '\n' +
    chalk.gray(`Installer ${versionText}${modeText}`) + '\n\n' +
    chalk.white('Unified workflow system with comprehensive coordination'),
    {
      padding: 1,
      margin: { top: 0, bottom: 1, left: 2, right: 2 },
      borderStyle: 'round',
      borderColor: 'cyan'
    }
  ));
}

/**
 * Create a spinner
 * @param {string} text - Spinner text
 * @returns {ora.Ora}
 */
export function createSpinner(text) {
  return ora({
    text,
    color: 'cyan',
    spinner: 'dots'
  });
}

/**
 * Display success message
 * @param {string} message
 */
export function success(message) {
  console.log(chalk.green('✓') + ' ' + chalk.green(message));
}

/**
 * Display info message
 * @param {string} message
 */
export function info(message) {
  console.log(chalk.cyan('ℹ') + ' ' + chalk.cyan(message));
}

/**
 * Display warning message
 * @param {string} message
 */
export function warning(message) {
  console.log(chalk.yellow('⚠') + ' ' + chalk.yellow(message));
}

/**
 * Display error message
 * @param {string} message
 */
export function error(message) {
  console.log(chalk.red('✖') + ' ' + chalk.red(message));
}

/**
 * Display step message
 * @param {number} step - Step number
 * @param {number} total - Total steps
 * @param {string} message - Step message
 */
export function step(stepNum, total, message) {
  console.log(chalk.gray(`[${stepNum}/${total}]`) + ' ' + chalk.white(message));
}

/**
 * Display summary box
 * @param {Object} options
 * @param {string} options.title - Box title
 * @param {string[]} options.lines - Content lines
 * @param {string} options.borderColor - Border color
 */
export function summaryBox({ title, lines, borderColor = 'green' }) {
  const content = lines.join('\n');
  console.log(boxen(content, {
    title,
    titleAlignment: 'center',
    padding: 1,
    margin: { top: 1, bottom: 1, left: 2, right: 2 },
    borderStyle: 'round',
    borderColor
  }));
}

/**
 * Display a divider line
 */
export function divider() {
  console.log(chalk.gray('─'.repeat(60)));
}
