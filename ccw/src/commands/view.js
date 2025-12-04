import { scanSessions } from '../core/session-scanner.js';
import { aggregateData } from '../core/data-aggregator.js';
import { generateDashboard } from '../core/dashboard-generator.js';
import { launchBrowser, isHeadlessEnvironment } from '../utils/browser-launcher.js';
import { resolvePath, ensureDir, getWorkflowDir, validatePath, validateOutputPath } from '../utils/path-resolver.js';
import chalk from 'chalk';
import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

/**
 * View command handler - generates and opens workflow dashboard
 * @param {Object} options - Command options
 */
export async function viewCommand(options) {
  // Validate project path
  const pathValidation = validatePath(options.path, { mustExist: true });
  if (!pathValidation.valid) {
    console.error(chalk.red(`\n  Error: ${pathValidation.error}\n`));
    process.exit(1);
  }

  const workingDir = pathValidation.path;
  const workflowDir = join(workingDir, '.workflow');

  console.log(chalk.blue.bold('\n  CCW Dashboard Generator\n'));
  console.log(chalk.gray(`  Project: ${workingDir}`));
  console.log(chalk.gray(`  Workflow: ${workflowDir}\n`));

  // Check if .workflow directory exists
  if (!existsSync(workflowDir)) {
    console.log(chalk.yellow('  No .workflow directory found.'));
    console.log(chalk.gray('  This project may not have any workflow sessions yet.\n'));

    // Still generate an empty dashboard
    const emptyData = {
      generatedAt: new Date().toISOString(),
      activeSessions: [],
      archivedSessions: [],
      reviewData: null,
      statistics: {
        totalSessions: 0,
        activeSessions: 0,
        totalTasks: 0,
        completedTasks: 0,
        reviewFindings: 0
      }
    };

    await generateAndOpen(emptyData, workflowDir, options);
    return;
  }

  try {
    // Step 1: Scan for sessions
    console.log(chalk.cyan('  Scanning sessions...'));
    const sessions = await scanSessions(workflowDir);
    console.log(chalk.green(`  Found ${sessions.active.length} active, ${sessions.archived.length} archived sessions`));

    if (sessions.hasReviewData) {
      console.log(chalk.magenta('  Review data detected - will include Reviews tab'));
    }

    // Step 2: Aggregate all data
    console.log(chalk.cyan('  Aggregating data...'));
    const dashboardData = await aggregateData(sessions, workflowDir);

    // Log statistics
    const stats = dashboardData.statistics;
    console.log(chalk.gray(`  Tasks: ${stats.completedTasks}/${stats.totalTasks} completed`));
    if (stats.reviewFindings > 0) {
      console.log(chalk.gray(`  Review findings: ${stats.reviewFindings}`));
    }

    // Step 3 & 4: Generate and open
    await generateAndOpen(dashboardData, workflowDir, options);

  } catch (error) {
    console.error(chalk.red(`\n  Error: ${error.message}\n`));
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Generate dashboard and optionally open in browser
 * @param {Object} data - Dashboard data
 * @param {string} workflowDir - Path to .workflow
 * @param {Object} options - Command options
 */
async function generateAndOpen(data, workflowDir, options) {
  // Step 3: Generate dashboard HTML
  console.log(chalk.cyan('  Generating dashboard...'));
  const html = await generateDashboard(data);

  // Step 4: Validate and write dashboard file
  let outputPath;
  if (options.output) {
    const outputValidation = validateOutputPath(options.output, workflowDir);
    if (!outputValidation.valid) {
      console.error(chalk.red(`\n  Error: ${outputValidation.error}\n`));
      process.exit(1);
    }
    outputPath = outputValidation.path;
  } else {
    outputPath = join(workflowDir, 'dashboard.html');
  }

  ensureDir(dirname(outputPath));
  writeFileSync(outputPath, html, 'utf8');
  console.log(chalk.green(`  Dashboard saved: ${outputPath}`));

  // Step 5: Open in browser (unless --no-browser or headless environment)
  if (options.browser !== false) {
    if (isHeadlessEnvironment()) {
      console.log(chalk.yellow('\n  Running in CI/headless environment - skipping browser launch'));
      console.log(chalk.gray(`  Open manually: file://${outputPath.replace(/\\/g, '/')}\n`));
    } else {
      console.log(chalk.cyan('  Opening in browser...'));
      try {
        await launchBrowser(outputPath);
        console.log(chalk.green.bold('\n  Dashboard opened in browser!\n'));
      } catch (error) {
        console.log(chalk.yellow(`\n  Could not open browser: ${error.message}`));
        console.log(chalk.gray(`  Open manually: file://${outputPath.replace(/\\/g, '/')}\n`));
      }
    }
  } else {
    console.log(chalk.gray(`\n  Open in browser: file://${outputPath.replace(/\\/g, '/')}\n`));
  }
}
