/**
 * Memory Command - Context tracking and prompt optimization
 * Provides CLI interface for Memory module operations
 */

import chalk from 'chalk';
import { getMemoryStore, type Entity, type HotEntity, type PromptHistory } from '../core/memory-store.js';
import { HistoryImporter } from '../core/history-importer.js';
import { notifyMemoryUpdate, notifyRefreshRequired } from '../tools/notifier.js';
import { join } from 'path';
import { existsSync, readdirSync } from 'fs';
import { StoragePaths } from '../config/storage-paths.js';
import {
  generateEmbeddings,
  searchMemories,
  getEmbeddingStatus,
  isEmbedderAvailable,
  type EmbedOptions,
  type SearchOptions as EmbedSearchOptions
} from '../core/memory-embedder-bridge.js';
import { getCoreMemoryStore } from '../core/core-memory-store.js';
import { CliHistoryStore } from '../tools/cli-history-store.js';

interface TrackOptions {
  type?: string;
  action?: string;
  value?: string;
  session?: string;
  stdin?: boolean;
}

interface ImportOptions {
  source?: string;
  project?: string;
}

interface StatsOptions {
  type?: string;
  limit?: string;
  sort?: string;
  json?: boolean;
}

interface SearchOptions {
  limit?: string;
  json?: boolean;
}

interface SuggestOptions {
  context?: string;
  limit?: string;
  json?: boolean;
}

interface PruneOptions {
  olderThan?: string;
  dryRun?: boolean;
}

interface EmbedCommandOptions {
  id?: string;
  force?: boolean;
  batchSize?: string;
}

interface SearchCommandOptions {
  topK?: string;
  type?: 'core_memory' | 'workflow' | 'cli_history';
  minScore?: string;
  json?: boolean;
}

interface EmbedStatusOptions {
  json?: boolean;
}

/**
 * Read JSON data from stdin (for Claude Code hooks)
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk;
      }
    });
    process.stdin.on('end', () => {
      resolve(data);
    });
    // Handle case where stdin is empty or not piped
    if (process.stdin.isTTY) {
      resolve('');
    }
  });
}

/**
 * Normalize file path for consistent storage
 */
function normalizePath(filePath: string): string {
  // Convert Windows paths to forward slashes and remove drive letter variations
  return filePath
    .replace(/\\/g, '/')
    .replace(/^[A-Za-z]:/, (match) => match.toLowerCase());
}

/**
 * Get project path from hook data or current working directory
 */
function getProjectPath(hookCwd?: string): string {
  // Prefer hook's cwd (actual project workspace) over process.cwd()
  return hookCwd || process.cwd();
}

/**
 * Track entity access (used by hooks)
 */
async function trackAction(options: TrackOptions): Promise<void> {
  let { type, action, value, session, stdin } = options;
  let hookCwd: string | undefined;

  // If --stdin flag is set, read from stdin (Claude Code hook format)
  if (stdin) {
    try {
      const stdinData = await readStdin();
      if (stdinData) {
        const hookData = JSON.parse(stdinData);
        session = hookData.session_id || session;
        hookCwd = hookData.cwd; // Extract workspace path from hook

        // Extract value based on hook event
        if (hookData.tool_input) {
          // PostToolUse event
          value = hookData.tool_input.file_path ||
                  hookData.tool_input.paths ||
                  hookData.tool_input.path ||
                  JSON.stringify(hookData.tool_input);
        } else if (hookData.prompt) {
          // UserPromptSubmit event
          value = hookData.prompt;
        }
      }
    } catch {
      // Silently continue if stdin parsing fails
    }
  }

  if (!type || !action) {
    console.error(chalk.red('Error: --type and --action are required'));
    console.error(chalk.gray('Usage: ccw memory track --type file --action read --value "path" --session "id"'));
    console.error(chalk.gray('       ccw memory track --type file --action read --stdin'));
    process.exit(1);
  }

  // Validate type and action
  const validTypes = ['file', 'module', 'topic', 'url'];
  const validActions = ['read', 'write', 'mention'];

  if (!validTypes.includes(type)) {
    if (!stdin) {
      console.error(chalk.red(`Error: Invalid type "${type}". Must be one of: ${validTypes.join(', ')}`));
    }
    process.exit(stdin ? 0 : 1);
  }

  if (!validActions.includes(action)) {
    if (!stdin) {
      console.error(chalk.red(`Error: Invalid action "${action}". Must be one of: ${validActions.join(', ')}`));
    }
    process.exit(stdin ? 0 : 1);
  }

  // Skip if no value provided
  if (!value) {
    if (stdin) {
      process.exit(0);
    }
    console.error(chalk.red('Error: --value is required'));
    process.exit(1);
  }

  try {
    const projectPath = getProjectPath(hookCwd);
    const store = getMemoryStore(projectPath);
    const now = new Date().toISOString();

    // Normalize value for file types
    const normalizedValue = type === 'file' ? normalizePath(value) : value.toLowerCase();

    // Upsert entity
    const entityId = store.upsertEntity({
      type: type as Entity['type'],
      value: value,
      normalized_value: normalizedValue,
      first_seen_at: now,
      last_seen_at: now
    });

    // Log access
    store.logAccess({
      entity_id: entityId,
      action: action as 'read' | 'write' | 'mention',
      session_id: session,
      timestamp: now
    });

    // Update statistics
    store.updateStats(entityId, action as 'read' | 'write' | 'mention');

    // Calculate heat score periodically (every 10th access)
    const stats = store.getStats(entityId);
    if (stats) {
      const totalAccess = stats.read_count + stats.write_count + stats.mention_count;
      if (totalAccess % 10 === 0) {
        store.calculateHeatScore(entityId);
      }
    }

    // Notify server of memory update (best-effort, non-blocking)
    notifyMemoryUpdate({
      entityType: type,
      entityId: String(entityId),
      action: action
    }).catch(() => { /* ignore errors - server may not be running */ });

    if (stdin) {
      // Silent mode for hooks - just exit successfully
      process.exit(0);
    }

    console.log(chalk.green('✓ Tracked:'), chalk.cyan(`${type}:${action}`), chalk.gray(value));
  } catch (error) {
    if (stdin) {
      // Silent failure for hooks
      process.exit(0);
    }
    console.error(chalk.red(`Error tracking: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Import Claude Code history
 */
async function importAction(options: ImportOptions): Promise<void> {
  const { source = 'all', project } = options;

  console.log(chalk.bold.cyan('\n  Importing Claude Code History\n'));
  console.log(chalk.gray(`  Source: ${source}`));
  if (project) {
    console.log(chalk.gray(`  Project: ${project}`));
  }

  try {
    const projectPath = getProjectPath();
    const paths = StoragePaths.project(projectPath);
    const dbPath = join(paths.memory, 'history.db');

    // Ensure memory directory exists
    const { mkdirSync } = await import('fs');
    if (!existsSync(paths.memory)) {
      mkdirSync(paths.memory, { recursive: true });
    }

    const importer = new HistoryImporter(dbPath);
    let totalImported = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // Import global history
    if (source === 'all' || source === 'history') {
      console.log(chalk.gray('\n  Importing global history...'));
      const globalResult = await importer.importGlobalHistory();
      totalImported += globalResult.imported;
      totalSkipped += globalResult.skipped;
      totalErrors += globalResult.errors;
      console.log(chalk.gray(`    Imported: ${globalResult.imported}, Skipped: ${globalResult.skipped}, Errors: ${globalResult.errors}`));
    }

    // Import project sessions
    if (source === 'all' || source === 'sessions') {
      const claudeHome = process.env.USERPROFILE || process.env.HOME || '';
      const projectsDir = join(claudeHome, '.claude', 'projects');

      if (existsSync(projectsDir)) {
        const projects = project
          ? [project]
          : readdirSync(projectsDir).filter(f => {
              const fullPath = join(projectsDir, f);
              return existsSync(fullPath) && require('fs').statSync(fullPath).isDirectory();
            });

        for (const proj of projects) {
          console.log(chalk.gray(`\n  Importing sessions for: ${proj}...`));
          const sessionResult = await importer.importProjectSessions(proj);
          totalImported += sessionResult.imported;
          totalSkipped += sessionResult.skipped;
          totalErrors += sessionResult.errors;
          console.log(chalk.gray(`    Imported: ${sessionResult.imported}, Skipped: ${sessionResult.skipped}, Errors: ${sessionResult.errors}`));
        }
      }
    }

    importer.close();

    console.log(chalk.bold.green('\n  Import Complete\n'));
    console.log(chalk.gray(`  Total Imported: ${totalImported}`));
    console.log(chalk.gray(`  Total Skipped: ${totalSkipped}`));
    console.log(chalk.gray(`  Total Errors: ${totalErrors}`));
    console.log(chalk.gray(`  Database: ${dbPath}\n`));

    // Notify server to refresh memory data
    if (totalImported > 0) {
      notifyRefreshRequired('memory').catch(() => { /* ignore */ });
    }
  } catch (error) {
    console.error(chalk.red(`\n  Error importing: ${(error as Error).message}\n`));
    process.exit(1);
  }
}

/**
 * Show hotspot statistics
 */
async function statsAction(options: StatsOptions): Promise<void> {
  const { type, limit = '20', sort = 'heat', json } = options;
  const limitNum = parseInt(limit, 10);

  try {
    const projectPath = getProjectPath();
    const store = getMemoryStore(projectPath);

    // Get hot entities
    const hotEntities = store.getHotEntities(limitNum * 2); // Get more to filter

    // Filter by type if specified
    let filtered: HotEntity[] = type
      ? hotEntities.filter((e: HotEntity) => e.type === type)
      : hotEntities;

    // Sort by specified field
    if (sort === 'reads') {
      filtered.sort((a: HotEntity, b: HotEntity) => b.stats.read_count - a.stats.read_count);
    } else if (sort === 'writes') {
      filtered.sort((a: HotEntity, b: HotEntity) => b.stats.write_count - a.stats.write_count);
    }
    // Default is already sorted by heat_score

    // Limit results
    filtered = filtered.slice(0, limitNum);

    if (json) {
      const output = filtered.map((e: HotEntity) => ({
        type: e.type,
        value: e.value,
        reads: e.stats.read_count,
        writes: e.stats.write_count,
        mentions: e.stats.mention_count,
        heat: Math.round(e.stats.heat_score * 100) / 100,
        lastSeen: e.last_seen_at
      }));
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log(chalk.bold.cyan('\n  Memory Hotspot Statistics\n'));

    if (type) {
      console.log(chalk.gray(`  Type: ${type}`));
    }
    console.log(chalk.gray(`  Sort: ${sort} | Limit: ${limit}\n`));

    if (filtered.length === 0) {
      console.log(chalk.yellow('  No data yet. Use hooks to track file access or run:'));
      console.log(chalk.gray('    ccw memory track --type file --action read --value "path/to/file"'));
      console.log(chalk.gray('    ccw memory import --source all\n'));
      return;
    }

    // Display table header
    console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));
    console.log(
      chalk.bold('  Type     ') +
      chalk.bold('Heat   ') +
      chalk.bold('R   ') +
      chalk.bold('W   ') +
      chalk.bold('M   ') +
      chalk.bold('Value')
    );
    console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));

    for (const entity of filtered) {
      const typeStr = entity.type.padEnd(8);
      const heatStr = entity.stats.heat_score.toFixed(1).padStart(6);
      const readStr = String(entity.stats.read_count).padStart(3);
      const writeStr = String(entity.stats.write_count).padStart(3);
      const mentionStr = String(entity.stats.mention_count).padStart(3);

      // Truncate value if too long
      const maxValueLen = 40;
      let valueStr = entity.value;
      if (valueStr.length > maxValueLen) {
        valueStr = '...' + valueStr.slice(-maxValueLen + 3);
      }

      // Color based on type
      const typeColor = entity.type === 'file' ? chalk.blue :
                       entity.type === 'module' ? chalk.magenta :
                       entity.type === 'topic' ? chalk.yellow : chalk.gray;

      console.log(
        '  ' +
        typeColor(typeStr) +
        chalk.cyan(heatStr) + ' ' +
        chalk.green(readStr) + ' ' +
        chalk.red(writeStr) + ' ' +
        chalk.yellow(mentionStr) + ' ' +
        chalk.gray(valueStr)
      );
    }

    console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));
    console.log(chalk.gray(`\n  R=Reads, W=Writes, M=Mentions, Heat=Composite score\n`));

  } catch (error) {
    if (json) {
      console.log(JSON.stringify({ error: (error as Error).message }, null, 2));
    } else {
      console.error(chalk.red(`\n  Error: ${(error as Error).message}\n`));
    }
    process.exit(1);
  }
}

/**
 * Search through prompt history
 */
async function searchAction(query: string | undefined, options: SearchOptions): Promise<void> {
  if (!query) {
    console.error(chalk.red('Error: Search query is required'));
    console.error(chalk.gray('Usage: ccw memory search "<query>"'));
    process.exit(1);
  }

  const { limit = '20', json } = options;
  const limitNum = parseInt(limit, 10);

  try {
    const projectPath = getProjectPath();
    const store = getMemoryStore(projectPath);

    // Search prompts using FTS
    const results = store.searchPrompts(query, limitNum);

    if (json) {
      const output = results.map((p: PromptHistory) => ({
        id: p.id,
        sessionId: p.session_id,
        prompt: p.prompt_text?.substring(0, 200) + (p.prompt_text && p.prompt_text.length > 200 ? '...' : ''),
        timestamp: p.timestamp,
        intentLabel: p.intent_label
      }));
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log(chalk.bold.cyan('\n  Searching Prompt History\n'));
    console.log(chalk.gray(`  Query: ${query}`));
    console.log(chalk.gray(`  Limit: ${limit}\n`));

    if (results.length === 0) {
      console.log(chalk.yellow('  No results found.'));
      console.log(chalk.gray('  Try importing history first: ccw memory import --source all\n'));
      return;
    }

    console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));

    for (const prompt of results) {
      const timestamp = new Date(prompt.timestamp).toLocaleString();
      const preview = prompt.prompt_text?.substring(0, 80).replace(/\n/g, ' ') || '(no content)';

      console.log(chalk.gray(`  ${timestamp}`));
      console.log(chalk.white(`  ${preview}${preview.length >= 80 ? '...' : ''}`));
      if (prompt.intent_label) {
        console.log(chalk.cyan(`  Intent: ${prompt.intent_label}`));
      }
      console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));
    }

    console.log(chalk.gray(`\n  Found ${results.length} result(s)\n`));

  } catch (error) {
    if (json) {
      console.log(JSON.stringify({ error: (error as Error).message }, null, 2));
    } else {
      console.error(chalk.red(`\n  Error: ${(error as Error).message}\n`));
    }
    process.exit(1);
  }
}

/**
 * Get optimization suggestions based on similar successful prompts
 */
async function suggestAction(options: SuggestOptions): Promise<void> {
  const { context, limit = '5', json } = options;
  const limitNum = parseInt(limit, 10);

  try {
    const projectPath = getProjectPath();
    const store = getMemoryStore(projectPath);

    // Get hot entities for suggestions
    const hotEntities = store.getHotEntities(limitNum);

    const suggestions = hotEntities.map((e: HotEntity) => ({
      type: e.type,
      value: e.value,
      reason: `Frequently accessed (${e.stats.read_count} reads, ${e.stats.write_count} writes)`,
      heat: e.stats.heat_score
    }));

    if (json) {
      console.log(JSON.stringify({ suggestions, context }, null, 2));
      return;
    }

    console.log(chalk.bold.cyan('\n  Memory Optimization Suggestions\n'));

    if (context) {
      console.log(chalk.gray(`  Context: ${context}\n`));
    }

    if (suggestions.length === 0) {
      console.log(chalk.yellow('  No suggestions available yet.'));
      console.log(chalk.gray('  Track more file access to get suggestions.\n'));
      return;
    }

    console.log(chalk.gray('  Based on your access patterns:\n'));

    for (let i = 0; i < suggestions.length; i++) {
      const s = suggestions[i];
      console.log(chalk.cyan(`  ${i + 1}. ${s.type}: `) + chalk.white(s.value));
      console.log(chalk.gray(`     ${s.reason}`));
    }

    console.log(chalk.gray('\n  Tip: Include frequently accessed files in your context for better results.\n'));

  } catch (error) {
    if (json) {
      console.log(JSON.stringify({ error: (error as Error).message }, null, 2));
    } else {
      console.error(chalk.red(`\n  Error: ${(error as Error).message}\n`));
    }
    process.exit(1);
  }
}

/**
 * Parse age string to milliseconds
 */
function parseAge(ageStr: string): number {
  const match = ageStr.match(/^(\d+)([dhm])$/);
  if (!match) {
    throw new Error(`Invalid age format: ${ageStr}. Use format like 30d, 24h, or 60m`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'm': return value * 60 * 1000;
    default: throw new Error(`Unknown unit: ${unit}`);
  }
}

/**
 * Clean up old data
 */
async function pruneAction(options: PruneOptions): Promise<void> {
  const { olderThan = '30d', dryRun } = options;

  console.log(chalk.bold.cyan('\n  Pruning Memory Data\n'));
  console.log(chalk.gray(`  Older than: ${olderThan}`));
  console.log(chalk.gray(`  Mode: ${dryRun ? 'Dry run (preview)' : 'Delete'}\n`));

  try {
    const ageMs = parseAge(olderThan);
    const cutoffDate = new Date(Date.now() - ageMs);
    const cutoffStr = cutoffDate.toISOString();

    const projectPath = getProjectPath();
    const paths = StoragePaths.project(projectPath);

    if (!existsSync(paths.memoryDb)) {
      console.log(chalk.yellow('  No memory database found. Nothing to prune.\n'));
      return;
    }

    // Use direct database access for pruning
    const Database = require('better-sqlite3');
    const db = new Database(paths.memoryDb);

    // Count records to prune
    const accessLogsCount = db.prepare(`
      SELECT COUNT(*) as count FROM access_logs WHERE timestamp < ?
    `).get(cutoffStr) as { count: number };

    const entitiesCount = db.prepare(`
      SELECT COUNT(*) as count FROM entities WHERE last_seen_at < ?
    `).get(cutoffStr) as { count: number };

    console.log(chalk.gray(`  Access logs to prune: ${accessLogsCount.count}`));
    console.log(chalk.gray(`  Entities to prune: ${entitiesCount.count}`));

    if (dryRun) {
      console.log(chalk.yellow('\n  Dry run - no changes made.\n'));
      db.close();
      return;
    }

    if (accessLogsCount.count === 0 && entitiesCount.count === 0) {
      console.log(chalk.green('\n  Nothing to prune.\n'));
      db.close();
      return;
    }

    // Delete old access logs
    const deleteAccessLogs = db.prepare(`DELETE FROM access_logs WHERE timestamp < ?`);
    const accessResult = deleteAccessLogs.run(cutoffStr);

    // Delete entities not seen recently (and their stats)
    const deleteStats = db.prepare(`
      DELETE FROM entity_stats WHERE entity_id IN (
        SELECT id FROM entities WHERE last_seen_at < ?
      )
    `);
    deleteStats.run(cutoffStr);

    const deleteEntities = db.prepare(`DELETE FROM entities WHERE last_seen_at < ?`);
    const entitiesResult = deleteEntities.run(cutoffStr);

    db.close();

    console.log(chalk.green(`\n  Pruned ${accessResult.changes} access logs`));
    console.log(chalk.green(`  Pruned ${entitiesResult.changes} entities\n`));

    // Notify server to refresh memory data
    if (accessResult.changes > 0 || entitiesResult.changes > 0) {
      notifyRefreshRequired('memory').catch(() => { /* ignore */ });
    }

  } catch (error) {
    console.error(chalk.red(`\n  Error: ${(error as Error).message}\n`));
    process.exit(1);
  }
}

/**
 * Chunk and prepare memories for embedding
 */
async function chunkMemoriesForEmbedding(projectPath: string, sourceId?: string, force?: boolean): Promise<number> {
  const coreMemoryStore = getCoreMemoryStore(projectPath);
  let chunksCreated = 0;

  // 1. Chunk core memories
  const memories = coreMemoryStore.getMemories({ archived: false, limit: 1000 });
  for (const memory of memories) {
    if (sourceId && memory.id !== sourceId) continue;

    // Check if already chunked (skip unless force)
    const existingChunks = coreMemoryStore.getChunks(memory.id);
    if (existingChunks.length > 0 && !force) continue;

    // Delete old chunks if force
    if (force && existingChunks.length > 0) {
      coreMemoryStore.deleteChunks(memory.id);
    }

    // Chunk the memory content
    const chunks = coreMemoryStore.chunkContent(memory.content, memory.id, 'core_memory');

    // Insert chunks
    for (let i = 0; i < chunks.length; i++) {
      coreMemoryStore.insertChunk({
        source_id: memory.id,
        source_type: 'core_memory',
        chunk_index: i,
        content: chunks[i],
        created_at: new Date().toISOString()
      });
      chunksCreated++;
    }
  }

  // 2. Chunk CLI history
  try {
    const cliHistoryStore = new CliHistoryStore(projectPath);
    const history = cliHistoryStore.getHistory({ limit: 500 });

    for (const exec of history.executions) {
      if (sourceId && exec.id !== sourceId) continue;

      // Check if already chunked
      const existingChunks = coreMemoryStore.getChunks(exec.id);
      if (existingChunks.length > 0 && !force) continue;

      // Delete old chunks if force
      if (force && existingChunks.length > 0) {
        coreMemoryStore.deleteChunks(exec.id);
      }

      // Get conversation content
      const conversation = cliHistoryStore.getConversation(exec.id);
      if (!conversation || !conversation.turns || conversation.turns.length === 0) continue;

      // Create content from turns
      const content = conversation.turns
        .map((t: any) => `Prompt: ${t.prompt}\nOutput: ${(t.stdout || '').substring(0, 500)}`)
        .join('\n---\n');

      // Chunk the content
      const chunks = coreMemoryStore.chunkContent(content, exec.id, 'cli_history');

      // Insert chunks
      for (let i = 0; i < chunks.length; i++) {
        coreMemoryStore.insertChunk({
          source_id: exec.id,
          source_type: 'cli_history',
          chunk_index: i,
          content: chunks[i],
          created_at: new Date().toISOString()
        });
        chunksCreated++;
      }
    }
  } catch {
    // CLI history might not exist, continue
  }

  return chunksCreated;
}

/**
 * Generate embeddings for memory chunks
 */
async function embedAction(options: EmbedCommandOptions): Promise<void> {
  const { id, force, batchSize } = options;

  try {
    // Check embedder availability
    if (!isEmbedderAvailable()) {
      console.error(chalk.red('\nError: Memory embedder not available'));
      console.error(chalk.gray('Ensure CodexLens venv exists at ~/.codexlens/venv\n'));
      process.exit(1);
    }

    const projectPath = getProjectPath();
    const paths = StoragePaths.project(projectPath);
    const dbPath = join(paths.root, 'core-memory', 'core_memory.db');

    if (!existsSync(dbPath)) {
      console.error(chalk.red('\nError: Core memory database not found'));
      console.error(chalk.gray('Create memories first using "ccw core-memory import"\n'));
      process.exit(1);
    }

    // Step 1: Chunk memories first
    console.log(chalk.cyan('Chunking memories...'));
    const chunksCreated = await chunkMemoriesForEmbedding(projectPath, id, force);
    if (chunksCreated > 0) {
      console.log(chalk.green(`  Created ${chunksCreated} new chunks`));
    }

    // Step 2: Generate embeddings
    console.log(chalk.cyan('Generating embeddings...'));

    const embedOptions: EmbedOptions = {
      sourceId: id,
      force: force || false,
      batchSize: batchSize ? parseInt(batchSize, 10) : 8
    };

    const result = await generateEmbeddings(dbPath, embedOptions);

    if (!result.success) {
      console.error(chalk.red(`\nError: ${result.error}\n`));
      process.exit(1);
    }

    console.log(chalk.green(`\n✓ Processed ${result.chunks_processed} chunks in ${result.elapsed_time.toFixed(1)}s`));

    // Get status to show breakdown by type
    const status = await getEmbeddingStatus(dbPath);
    if (status.success && Object.keys(status.by_type).length > 0) {
      for (const [type, stats] of Object.entries(status.by_type)) {
        if (stats.total > 0) {
          console.log(chalk.white(`  - ${type}: ${stats.embedded} chunks`));
        }
      }
    }
    console.log();

  } catch (error) {
    console.error(chalk.red(`\nError: ${(error as Error).message}\n`));
    process.exit(1);
  }
}

/**
 * Search memories using semantic search
 */
async function searchEmbedAction(query: string | undefined, options: SearchCommandOptions): Promise<void> {
  if (!query) {
    console.error(chalk.red('Error: Search query is required'));
    console.error(chalk.gray('Usage: ccw memory search "<query>"'));
    process.exit(1);
  }

  const { topK = '10', type, minScore = '0.5', json } = options;

  try {
    // Check embedder availability
    if (!isEmbedderAvailable()) {
      console.error(chalk.red('\nError: Memory embedder not available'));
      console.error(chalk.gray('Ensure CodexLens venv exists at ~/.codexlens/venv\n'));
      process.exit(1);
    }

    const projectPath = getProjectPath();
    const paths = StoragePaths.project(projectPath);
    const dbPath = join(paths.root, 'core-memory', 'core_memory.db');

    if (!existsSync(dbPath)) {
      console.error(chalk.red('\nError: Core memory database not found'));
      console.error(chalk.gray('Create memories first using "ccw core-memory import"\n'));
      process.exit(1);
    }

    const searchOptions: EmbedSearchOptions = {
      topK: parseInt(topK, 10),
      minScore: parseFloat(minScore),
      sourceType: type
    };

    const result = await searchMemories(dbPath, query, searchOptions);

    if (!result.success) {
      console.error(chalk.red(`\nError: ${result.error}\n`));
      process.exit(1);
    }

    if (json) {
      const output = result.matches.map(m => ({
        sourceId: m.source_id,
        sourceType: m.source_type,
        score: m.score,
        content: m.content,
        restoreCommand: m.restore_command
      }));
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log(chalk.bold.cyan(`\nFound ${result.matches.length} matches for "${query}":\n`));

    if (result.matches.length === 0) {
      console.log(chalk.yellow('No results found. Try:'));
      console.log(chalk.gray('  - Using different keywords'));
      console.log(chalk.gray('  - Lowering --min-score threshold'));
      console.log(chalk.gray('  - Running "ccw memory embed" to generate embeddings\n'));
      return;
    }

    for (let i = 0; i < result.matches.length; i++) {
      const match = result.matches[i];
      const preview = match.content.length > 80
        ? match.content.substring(0, 80) + '...'
        : match.content;

      console.log(chalk.bold.white(`${i + 1}. [${match.score.toFixed(2)}] ${match.source_id}`) + chalk.gray(` (${match.source_type})`));
      console.log(chalk.white(`   "${preview}"`));
      console.log(chalk.cyan(`   → ${match.restore_command}`));
      console.log();
    }

  } catch (error) {
    if (json) {
      console.log(JSON.stringify({ error: (error as Error).message }, null, 2));
    } else {
      console.error(chalk.red(`\nError: ${(error as Error).message}\n`));
    }
    process.exit(1);
  }
}

/**
 * Show embedding status
 */
async function embedStatusAction(options: EmbedStatusOptions): Promise<void> {
  const { json } = options;

  try {
    // Check embedder availability
    if (!isEmbedderAvailable()) {
      console.error(chalk.red('\nError: Memory embedder not available'));
      console.error(chalk.gray('Ensure CodexLens venv exists at ~/.codexlens/venv\n'));
      process.exit(1);
    }

    const projectPath = getProjectPath();
    const paths = StoragePaths.project(projectPath);
    const dbPath = join(paths.root, 'core-memory', 'core_memory.db');

    if (!existsSync(dbPath)) {
      console.error(chalk.red('\nError: Core memory database not found'));
      console.error(chalk.gray('Create memories first using "ccw core-memory import"\n'));
      process.exit(1);
    }

    const status = await getEmbeddingStatus(dbPath);

    if (!status.success) {
      console.error(chalk.red(`\nError: ${status.error}\n`));
      process.exit(1);
    }

    if (json) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    const embeddedPercent = status.total_chunks > 0
      ? Math.round((status.embedded_chunks / status.total_chunks) * 100)
      : 0;

    console.log(chalk.bold.cyan('\nEmbedding Status:'));
    console.log(chalk.white(`  Total chunks: ${status.total_chunks}`));
    console.log(chalk.white(`  Embedded: ${status.embedded_chunks} (${embeddedPercent}%)`));
    console.log(chalk.white(`  Pending: ${status.pending_chunks}`));

    if (Object.keys(status.by_type).length > 0) {
      console.log(chalk.bold.white('\nBy Type:'));
      for (const [type, stats] of Object.entries(status.by_type)) {
        const typePercent = stats.total > 0
          ? Math.round((stats.embedded / stats.total) * 100)
          : 0;
        console.log(chalk.cyan(`  ${type}: `) + chalk.white(`${stats.embedded}/${stats.total} (${typePercent}%)`));
      }
    }
    console.log();

  } catch (error) {
    if (json) {
      console.log(JSON.stringify({ error: (error as Error).message }, null, 2));
    } else {
      console.error(chalk.red(`\nError: ${(error as Error).message}\n`));
    }
    process.exit(1);
  }
}

/**
 * Memory command entry point
 * @param {string} subcommand - Subcommand (track, import, stats, search, suggest, prune, embed, embed-status)
 * @param {string|string[]} args - Arguments array
 * @param {Object} options - CLI options
 */
export async function memoryCommand(
  subcommand: string,
  args: string | string[],
  options: TrackOptions | ImportOptions | StatsOptions | SearchOptions | SuggestOptions | PruneOptions | EmbedCommandOptions | SearchCommandOptions | EmbedStatusOptions
): Promise<void> {
  const argsArray = Array.isArray(args) ? args : (args ? [args] : []);

  switch (subcommand) {
    case 'track':
      await trackAction(options as TrackOptions);
      break;

    case 'import':
      await importAction(options as ImportOptions);
      break;

    case 'stats':
      await statsAction(options as StatsOptions);
      break;

    case 'search':
      // Check if this is semantic search (has --top-k or --min-score) or prompt history search
      if ('topK' in options || 'minScore' in options) {
        await searchEmbedAction(argsArray[0], options as SearchCommandOptions);
      } else {
        await searchAction(argsArray[0], options as SearchOptions);
      }
      break;

    case 'suggest':
      await suggestAction(options as SuggestOptions);
      break;

    case 'prune':
      await pruneAction(options as PruneOptions);
      break;

    case 'embed':
      await embedAction(options as EmbedCommandOptions);
      break;

    case 'embed-status':
      await embedStatusAction(options as EmbedStatusOptions);
      break;

    default:
      console.log(chalk.bold.cyan('\n  CCW Memory Module\n'));
      console.log('  Context tracking and prompt optimization.\n');
      console.log('  Subcommands:');
      console.log(chalk.gray('    track               Track entity access (used by hooks)'));
      console.log(chalk.gray('    import              Import Claude Code history'));
      console.log(chalk.gray('    stats               Show hotspot statistics'));
      console.log(chalk.gray('    search <query>      Search through prompt history (semantic or FTS)'));
      console.log(chalk.gray('    suggest             Get optimization suggestions'));
      console.log(chalk.gray('    prune               Clean up old data'));
      console.log(chalk.gray('    embed               Generate embeddings for semantic search'));
      console.log(chalk.gray('    embed-status        Show embedding generation status'));
      console.log();
      console.log('  Track Options:');
      console.log(chalk.gray('    --type <type>       Entity type: file, module, topic'));
      console.log(chalk.gray('    --action <action>   Action: read, write, mention'));
      console.log(chalk.gray('    --value <value>     Entity value (file path, etc.)'));
      console.log(chalk.gray('    --session <id>      Session ID (optional)'));
      console.log();
      console.log('  Import Options:');
      console.log(chalk.gray('    --source <source>   Source: history, sessions, all (default: all)'));
      console.log(chalk.gray('    --project <name>    Project name filter (optional)'));
      console.log();
      console.log('  Stats Options:');
      console.log(chalk.gray('    --type <type>       Filter: file, module, topic (optional)'));
      console.log(chalk.gray('    --limit <n>         Number of results (default: 20)'));
      console.log(chalk.gray('    --sort <field>      Sort by: heat, reads, writes (default: heat)'));
      console.log(chalk.gray('    --json              Output as JSON'));
      console.log();
      console.log('  Search Options (Prompt History):');
      console.log(chalk.gray('    --limit <n>         Number of results (default: 20)'));
      console.log(chalk.gray('    --json              Output as JSON'));
      console.log();
      console.log('  Search Options (Semantic - requires embeddings):');
      console.log(chalk.gray('    --top-k <n>         Number of results (default: 10)'));
      console.log(chalk.gray('    --min-score <f>     Minimum similarity score (default: 0.5)'));
      console.log(chalk.gray('    --type <type>       Filter: core_memory, workflow, cli_history'));
      console.log(chalk.gray('    --json              Output as JSON'));
      console.log();
      console.log('  Embed Options:');
      console.log(chalk.gray('    --id <id>           Specific memory/session ID to embed'));
      console.log(chalk.gray('    --force             Force re-embed all chunks'));
      console.log(chalk.gray('    --batch-size <n>    Batch size for embedding (default: 8)'));
      console.log();
      console.log('  Embed Status Options:');
      console.log(chalk.gray('    --json              Output as JSON'));
      console.log();
      console.log('  Suggest Options:');
      console.log(chalk.gray('    --context <text>    Current task context (optional)'));
      console.log(chalk.gray('    --limit <n>         Number of suggestions (default: 5)'));
      console.log(chalk.gray('    --json              Output as JSON'));
      console.log();
      console.log('  Prune Options:');
      console.log(chalk.gray('    --older-than <age>  Age threshold (default: 30d)'));
      console.log(chalk.gray('    --dry-run           Preview without deleting'));
      console.log();
      console.log('  Examples:');
      console.log(chalk.gray('    ccw memory track --type file --action read --value "src/auth.ts"'));
      console.log(chalk.gray('    ccw memory import --source history --project "my-app"'));
      console.log(chalk.gray('    ccw memory stats --type file --sort heat --limit 10'));
      console.log(chalk.gray('    ccw memory search "authentication patterns"  # FTS search'));
      console.log(chalk.gray('    ccw memory embed                              # Generate all embeddings'));
      console.log(chalk.gray('    ccw memory embed --id CMEM-xxx                # Embed specific memory'));
      console.log(chalk.gray('    ccw memory embed-status                       # Check embedding status'));
      console.log(chalk.gray('    ccw memory search "auth patterns" --top-k 5   # Semantic search'));
      console.log(chalk.gray('    ccw memory suggest --context "implementing JWT auth"'));
      console.log(chalk.gray('    ccw memory prune --older-than 60d --dry-run'));
      console.log();
  }
}
