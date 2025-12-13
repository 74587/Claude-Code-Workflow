import chalk from 'chalk';
import figlet from 'figlet';
import boxen from 'boxen';
import gradient from 'gradient-string';
import ora from 'ora';
import type { Ora } from 'ora';

// Custom gradient colors
const claudeGradient = gradient(['#00d4ff', '#00ff88']);
const codeGradient = gradient(['#00ff88', '#ffff00']);
const workflowGradient = gradient(['#ffff00', '#ff8800']);

/**
 * Options for summary box display
 */
export interface SummaryBoxOptions {
  title: string;
  lines: string[];
  borderColor?: string;
}

/**
 * Display ASCII art banner
 */
export function showBanner(): void {
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
 * @param version - Version number
 * @param mode - Installation mode
 */
export function showHeader(version: string, mode: string = ''): void {
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
 * @param text - Spinner text
 * @returns Ora spinner instance
 */
export function createSpinner(text: string): Ora {
  return ora({
    text,
    color: 'cyan',
    spinner: 'dots'
  });
}

/**
 * Display success message
 * @param message - Success message
 */
export function success(message: string): void {
  console.log(chalk.green('✓') + ' ' + chalk.green(message));
}

/**
 * Display info message
 * @param message - Info message
 */
export function info(message: string): void {
  console.log(chalk.cyan('ℹ') + ' ' + chalk.cyan(message));
}

/**
 * Display warning message
 * @param message - Warning message
 */
export function warning(message: string): void {
  console.log(chalk.yellow('⚠') + ' ' + chalk.yellow(message));
}

/**
 * Display error message
 * @param message - Error message
 */
export function error(message: string): void {
  console.log(chalk.red('✖') + ' ' + chalk.red(message));
}

/**
 * Display step message
 * @param stepNum - Step number
 * @param total - Total steps
 * @param message - Step message
 */
export function step(stepNum: number, total: number, message: string): void {
  console.log(chalk.gray(`[${stepNum}/${total}]`) + ' ' + chalk.white(message));
}

/**
 * Display summary box
 * @param options - Summary box options
 */
export function summaryBox({ title, lines, borderColor = 'green' }: SummaryBoxOptions): void {
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
export function divider(): void {
  console.log(chalk.gray('─'.repeat(60)));
}
