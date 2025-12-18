/**
 * Core Memory Command - Simplified CLI for core memory management
 * Four commands: list, import, export, summary
 */

import chalk from 'chalk';
import { getCoreMemoryStore } from '../core/core-memory-store.js';
import { notifyRefreshRequired } from '../tools/notifier.js';

interface CommandOptions {
  id?: string;
  tool?: 'gemini' | 'qwen';
}

/**
 * Get project path from current working directory
 */
function getProjectPath(): string {
  return process.cwd();
}

/**
 * List all memories
 */
async function listAction(): Promise<void> {
  try {
    const store = getCoreMemoryStore(getProjectPath());
    const memories = store.getMemories({ limit: 100 });

    console.log(chalk.bold.cyan('\n  Core Memories\n'));

    if (memories.length === 0) {
      console.log(chalk.yellow('  No memories found\n'));
      return;
    }

    console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));

    for (const memory of memories) {
      const date = new Date(memory.updated_at).toLocaleString();
      const archived = memory.archived ? chalk.gray(' [archived]') : '';
      console.log(chalk.cyan(`  ${memory.id}`) + archived);
      console.log(chalk.white(`    ${memory.summary || memory.content.substring(0, 80)}${memory.content.length > 80 ? '...' : ''}`));
      console.log(chalk.gray(`    Updated: ${date}`));
      console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));
    }

    console.log(chalk.gray(`\n  Total: ${memories.length}\n`));

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Import text as a new memory
 */
async function importAction(text: string): Promise<void> {
  if (!text || text.trim() === '') {
    console.error(chalk.red('Error: Text content is required'));
    console.error(chalk.gray('Usage: ccw core-memory import "your text content here"'));
    process.exit(1);
  }

  try {
    const store = getCoreMemoryStore(getProjectPath());
    const memory = store.upsertMemory({
      content: text.trim()
    });

    console.log(chalk.green(`✓ Created memory: ${memory.id}`));

    // Extract knowledge graph
    store.extractKnowledgeGraph(memory.id);

    // Notify dashboard
    notifyRefreshRequired('memory').catch(() => { /* ignore */ });

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Export a memory as plain text
 */
async function exportAction(options: CommandOptions): Promise<void> {
  const { id } = options;

  if (!id) {
    console.error(chalk.red('Error: --id is required'));
    console.error(chalk.gray('Usage: ccw core-memory export --id <id>'));
    process.exit(1);
  }

  try {
    const store = getCoreMemoryStore(getProjectPath());
    const memory = store.getMemory(id);

    if (!memory) {
      console.error(chalk.red(`Error: Memory "${id}" not found`));
      process.exit(1);
    }

    // Output plain text content
    console.log(memory.content);

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Generate summary for a memory
 */
async function summaryAction(options: CommandOptions): Promise<void> {
  const { id, tool = 'gemini' } = options;

  if (!id) {
    console.error(chalk.red('Error: --id is required'));
    console.error(chalk.gray('Usage: ccw core-memory summary --id <id> [--tool gemini|qwen]'));
    process.exit(1);
  }

  try {
    const store = getCoreMemoryStore(getProjectPath());
    const memory = store.getMemory(id);

    if (!memory) {
      console.error(chalk.red(`Error: Memory "${id}" not found`));
      process.exit(1);
    }

    console.log(chalk.cyan(`Generating summary using ${tool}...`));

    const summary = await store.generateSummary(id, tool);

    console.log(chalk.green('\n✓ Summary generated:\n'));
    console.log(chalk.white(`  ${summary}\n`));

    // Notify dashboard
    notifyRefreshRequired('memory').catch(() => { /* ignore */ });

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Core Memory command entry point
 */
export async function coreMemoryCommand(
  subcommand: string,
  args: string | string[],
  options: CommandOptions
): Promise<void> {
  const argsArray = Array.isArray(args) ? args : (args ? [args] : []);
  const textArg = argsArray.join(' ');

  switch (subcommand) {
    case 'list':
      await listAction();
      break;

    case 'import':
      await importAction(textArg);
      break;

    case 'export':
      await exportAction(options);
      break;

    case 'summary':
      await summaryAction(options);
      break;

    default:
      console.log(chalk.bold.cyan('\n  CCW Core Memory\n'));
      console.log('  Manage core memory entries.\n');
      console.log('  Commands:');
      console.log(chalk.white('    list                        ') + chalk.gray('List all memories'));
      console.log(chalk.white('    import "<text>"             ') + chalk.gray('Import text as new memory'));
      console.log(chalk.white('    export --id <id>            ') + chalk.gray('Export memory as plain text'));
      console.log(chalk.white('    summary --id <id>           ') + chalk.gray('Generate AI summary'));
      console.log();
      console.log('  Options:');
      console.log(chalk.gray('    --id <id>          Memory ID (for export/summary)'));
      console.log(chalk.gray('    --tool gemini|qwen AI tool for summary (default: gemini)'));
      console.log();
      console.log('  Examples:');
      console.log(chalk.gray('    ccw core-memory list'));
      console.log(chalk.gray('    ccw core-memory import "This is important context about the auth module"'));
      console.log(chalk.gray('    ccw core-memory export --id CMEM-20251217-143022'));
      console.log(chalk.gray('    ccw core-memory summary --id CMEM-20251217-143022'));
      console.log();
  }
}
