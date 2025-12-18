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
  status?: string;
  json?: boolean;
  auto?: boolean;
  scope?: string;
  create?: boolean;
  name?: string;
  members?: string;
  format?: string;
  level?: string;
  type?: string;
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
 * List all clusters
 */
async function clustersAction(options: CommandOptions): Promise<void> {
  try {
    const store = getCoreMemoryStore(getProjectPath());
    const clusters = store.listClusters(options.status);

    if (options.json) {
      console.log(JSON.stringify(clusters, null, 2));
      return;
    }

    if (clusters.length === 0) {
      console.log(chalk.yellow('\n  No clusters found. Run "ccw core-memory cluster --auto" to create clusters.\n'));
      return;
    }

    console.log(chalk.bold.cyan('\n  📦 Session Clusters\n'));
    console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));

    for (const cluster of clusters) {
      const members = store.getClusterMembers(cluster.id);
      console.log(chalk.cyan(`  ● ${cluster.name}`) + chalk.gray(` (${cluster.id})`));
      console.log(chalk.white(`    Status: ${cluster.status} | Sessions: ${members.length}`));
      console.log(chalk.gray(`    Updated: ${cluster.updated_at}`));
      if (cluster.intent) console.log(chalk.white(`    Intent: ${cluster.intent}`));
      console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));
    }

    console.log(chalk.gray(`\n  Total: ${clusters.length}\n`));

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * View cluster details or create new cluster
 */
async function clusterAction(clusterId: string | undefined, options: CommandOptions): Promise<void> {
  try {
    const store = getCoreMemoryStore(getProjectPath());

    // Auto clustering
    if (options.auto) {
      const { SessionClusteringService } = await import('../core/session-clustering-service.js');
      const service = new SessionClusteringService(getProjectPath());

      console.log(chalk.cyan('🔄 Running auto-clustering...'));
      const scope: 'all' | 'recent' | 'unclustered' =
        options.scope === 'all' || options.scope === 'recent' || options.scope === 'unclustered'
          ? options.scope
          : 'recent';
      const result = await service.autocluster({ scope });

      console.log(chalk.green(`✓ Created ${result.clustersCreated} clusters`));
      console.log(chalk.white(`  Processed ${result.sessionsProcessed} sessions`));
      console.log(chalk.white(`  Clustered ${result.sessionsClustered} sessions`));

      // Notify dashboard
      notifyRefreshRequired('memory').catch(() => { /* ignore */ });
      return;
    }

    // Create new cluster
    if (options.create) {
      if (!options.name) {
        console.error(chalk.red('Error: --name is required for --create'));
        process.exit(1);
      }

      const cluster = store.createCluster({ name: options.name });
      console.log(chalk.green(`✓ Created cluster: ${cluster.id}`));

      // Add members if specified
      if (options.members) {
        const memberIds = options.members.split(',').map(s => s.trim());
        for (const memberId of memberIds) {
          // Detect session type from ID
          let sessionType = 'core_memory';
          if (memberId.startsWith('WFS-')) sessionType = 'workflow';
          else if (memberId.includes('-gemini') || memberId.includes('-qwen') || memberId.includes('-codex')) {
            sessionType = 'cli_history';
          }

          store.addClusterMember({
            cluster_id: cluster.id,
            session_id: memberId,
            session_type: sessionType as any,
            sequence_order: memberIds.indexOf(memberId) + 1,
            relevance_score: 1.0
          });
        }
        console.log(chalk.white(`  Added ${memberIds.length} members`));
      }

      // Notify dashboard
      notifyRefreshRequired('memory').catch(() => { /* ignore */ });
      return;
    }

    // View cluster details
    if (clusterId) {
      const cluster = store.getCluster(clusterId);
      if (!cluster) {
        console.error(chalk.red(`Cluster not found: ${clusterId}`));
        process.exit(1);
      }

      const members = store.getClusterMembers(clusterId);
      const relations = store.getClusterRelations(clusterId);

      console.log(chalk.bold.cyan(`\n  📦 Cluster: ${cluster.name}\n`));
      console.log(chalk.white(`  ID: ${cluster.id}`));
      console.log(chalk.white(`  Status: ${cluster.status}`));
      if (cluster.description) console.log(chalk.white(`  Description: ${cluster.description}`));
      if (cluster.intent) console.log(chalk.white(`  Intent: ${cluster.intent}`));

      if (members.length > 0) {
        console.log(chalk.bold.white('\n  📋 Sessions:'));
        for (const member of members) {
          const meta = store.getSessionMetadata(member.session_id);
          console.log(chalk.cyan(`     ${member.sequence_order}. ${member.session_id}`) + chalk.gray(` (${member.session_type})`));
          if (meta?.title) console.log(chalk.white(`        ${meta.title}`));
          if (meta?.token_estimate) console.log(chalk.gray(`        ~${meta.token_estimate} tokens`));
        }
      }

      if (relations.length > 0) {
        console.log(chalk.bold.white('\n  🔗 Relations:'));
        for (const rel of relations) {
          console.log(chalk.white(`     → ${rel.relation_type} ${rel.target_cluster_id}`));
        }
      }

      console.log();
      return;
    }

    // No action specified - show usage
    console.log(chalk.yellow('Usage: ccw core-memory cluster <id> or --auto or --create --name <name>'));

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Get progressive disclosure context
 */
async function contextAction(options: CommandOptions): Promise<void> {
  try {
    const { SessionClusteringService } = await import('../core/session-clustering-service.js');
    const service = new SessionClusteringService(getProjectPath());

    const index = await service.getProgressiveIndex();

    if (options.format === 'json') {
      console.log(JSON.stringify({ index }, null, 2));
    } else {
      console.log(index);
    }

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Load cluster context
 */
async function loadClusterAction(clusterId: string, options: CommandOptions): Promise<void> {
  if (!clusterId) {
    console.error(chalk.red('Error: Cluster ID is required'));
    console.error(chalk.gray('Usage: ccw core-memory load-cluster <id> [--level metadata|keyFiles|full]'));
    process.exit(1);
  }

  try {
    const store = getCoreMemoryStore(getProjectPath());

    const cluster = store.getCluster(clusterId);
    if (!cluster) {
      console.error(chalk.red(`Cluster not found: ${clusterId}`));
      process.exit(1);
    }

    const members = store.getClusterMembers(clusterId);
    const level = options.level || 'metadata';

    console.log(chalk.bold.cyan(`\n# Cluster: ${cluster.name}\n`));
    if (cluster.intent) console.log(chalk.white(`Intent: ${cluster.intent}\n`));

    console.log(chalk.bold.white('## Sessions\n'));

    for (const member of members) {
      const meta = store.getSessionMetadata(member.session_id);

      console.log(chalk.bold.cyan(`### ${member.sequence_order}. ${member.session_id}`));
      console.log(chalk.white(`Type: ${member.session_type}`));

      if (meta) {
        if (meta.title) console.log(chalk.white(`Title: ${meta.title}`));

        if (level === 'metadata') {
          if (meta.summary) console.log(chalk.white(`Summary: ${meta.summary}`));
        } else if (level === 'keyFiles' || level === 'full') {
          if (meta.summary) console.log(chalk.white(`Summary: ${meta.summary}`));
          if (meta.file_patterns) {
            const patterns = JSON.parse(meta.file_patterns as any);
            console.log(chalk.white(`Files: ${patterns.join(', ')}`));
          }
          if (meta.keywords) {
            const keywords = JSON.parse(meta.keywords as any);
            console.log(chalk.white(`Keywords: ${keywords.join(', ')}`));
          }
        }

        if (level === 'full') {
          // Load full content based on session type
          if (member.session_type === 'core_memory') {
            const memory = store.getMemory(member.session_id);
            if (memory) {
              console.log(chalk.white('\nContent:'));
              console.log(chalk.gray(memory.content));
            }
          }
        }
      }
      console.log();
    }

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Search sessions by keyword
 */
async function searchAction(keyword: string, options: CommandOptions): Promise<void> {
  if (!keyword || keyword.trim() === '') {
    console.error(chalk.red('Error: Keyword is required'));
    console.error(chalk.gray('Usage: ccw core-memory search <keyword> [--type core|workflow|cli|all]'));
    process.exit(1);
  }

  try {
    const store = getCoreMemoryStore(getProjectPath());

    const results = store.searchSessionsByKeyword(keyword);

    if (results.length === 0) {
      console.log(chalk.yellow(`\n  No sessions found for: "${keyword}"\n`));
      return;
    }

    // Filter by type if specified
    let filtered = results;
    if (options.type && options.type !== 'all') {
      const typeMap: Record<string, string> = {
        core: 'core_memory',
        workflow: 'workflow',
        cli: 'cli_history'
      };
      filtered = results.filter(r => r.session_type === typeMap[options.type!]);
    }

    console.log(chalk.bold.cyan(`\n  🔍 Found ${filtered.length} sessions for "${keyword}"\n`));
    console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));

    for (const result of filtered) {
      console.log(chalk.cyan(`  ● ${result.session_id}`) + chalk.gray(` (${result.session_type})`));
      if (result.title) console.log(chalk.white(`    ${result.title}`));
      if (result.token_estimate) console.log(chalk.gray(`    ~${result.token_estimate} tokens`));
      console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));
    }

    console.log();

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

    case 'clusters':
      await clustersAction(options);
      break;

    case 'cluster':
      await clusterAction(argsArray[0], options);
      break;

    case 'context':
      await contextAction(options);
      break;

    case 'load-cluster':
      await loadClusterAction(textArg, options);
      break;

    case 'search':
      await searchAction(textArg, options);
      break;

    default:
      console.log(chalk.bold.cyan('\n  CCW Core Memory\n'));
      console.log('  Manage core memory entries and session clusters.\n');
      console.log(chalk.bold('  Basic Commands:'));
      console.log(chalk.white('    list                        ') + chalk.gray('List all memories'));
      console.log(chalk.white('    import "<text>"             ') + chalk.gray('Import text as new memory'));
      console.log(chalk.white('    export --id <id>            ') + chalk.gray('Export memory as plain text'));
      console.log(chalk.white('    summary --id <id>           ') + chalk.gray('Generate AI summary'));
      console.log();
      console.log(chalk.bold('  Clustering Commands:'));
      console.log(chalk.white('    clusters [--status]         ') + chalk.gray('List all clusters'));
      console.log(chalk.white('    cluster [id]                ') + chalk.gray('View cluster details'));
      console.log(chalk.white('    cluster --auto              ') + chalk.gray('Run auto-clustering'));
      console.log(chalk.white('    cluster --create --name     ') + chalk.gray('Create new cluster'));
      console.log(chalk.white('    context                     ') + chalk.gray('Get progressive index'));
      console.log(chalk.white('    load-cluster <id>           ') + chalk.gray('Load cluster context'));
      console.log(chalk.white('    search <keyword>            ') + chalk.gray('Search sessions'));
      console.log();
      console.log(chalk.bold('  Options:'));
      console.log(chalk.gray('    --id <id>                   Memory ID (for export/summary)'));
      console.log(chalk.gray('    --tool gemini|qwen          AI tool for summary (default: gemini)'));
      console.log(chalk.gray('    --status <status>           Filter by status (active/archived/merged)'));
      console.log(chalk.gray('    --json                      Output as JSON'));
      console.log(chalk.gray('    --scope <scope>             Auto-cluster scope (all/recent/unclustered)'));
      console.log(chalk.gray('    --name <name>               Cluster name (for --create)'));
      console.log(chalk.gray('    --members <ids>             Comma-separated session IDs (for --create)'));
      console.log(chalk.gray('    --format <format>           Output format (markdown/json)'));
      console.log(chalk.gray('    --level <level>             Detail level (metadata/keyFiles/full)'));
      console.log(chalk.gray('    --type <type>               Filter by type (core/workflow/cli/all)'));
      console.log();
      console.log(chalk.bold('  Examples:'));
      console.log(chalk.gray('    # Basic commands'));
      console.log(chalk.gray('    ccw core-memory list'));
      console.log(chalk.gray('    ccw core-memory import "Important context"'));
      console.log(chalk.gray('    ccw core-memory export --id CMEM-20251217-143022'));
      console.log();
      console.log(chalk.gray('    # Clustering commands'));
      console.log(chalk.gray('    ccw core-memory clusters'));
      console.log(chalk.gray('    ccw core-memory cluster --auto'));
      console.log(chalk.gray('    ccw core-memory cluster CLU-001'));
      console.log(chalk.gray('    ccw core-memory cluster --create --name "Auth Module"'));
      console.log(chalk.gray('    ccw core-memory load-cluster CLU-001 --level full'));
      console.log(chalk.gray('    ccw core-memory search authentication --type workflow'));
      console.log();
  }
}
