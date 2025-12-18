/**
 * Core Memory Store - Independent storage system for core memories
 * Provides persistent storage for high-level architectural and strategic context
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { StoragePaths, ensureStorageDir } from '../config/storage-paths.js';

// Types
export interface CoreMemory {
  id: string; // Format: CMEM-YYYYMMDD-HHMMSS
  content: string;
  summary: string;
  raw_output?: string;
  created_at: string;
  updated_at: string;
  archived: boolean;
  metadata?: string; // JSON string
}

export interface KnowledgeGraphNode {
  memory_id: string;
  node_id: string;
  node_type: string; // file, function, module, concept
  node_label: string;
}

export interface KnowledgeGraphEdge {
  memory_id: string;
  edge_source: string;
  edge_target: string;
  edge_type: string; // depends_on, implements, uses, relates_to
}

export interface EvolutionVersion {
  memory_id: string;
  version: number;
  content: string;
  timestamp: string;
  diff_stats?: {
    added: number;
    modified: number;
    deleted: number;
  };
}

export interface KnowledgeGraph {
  nodes: Array<{
    id: string;
    type: string;
    label: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: string;
  }>;
}

/**
 * Core Memory Store using SQLite
 */
export class CoreMemoryStore {
  private db: Database.Database;
  private dbPath: string;
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    // Use centralized storage path
    const paths = StoragePaths.project(projectPath);
    const coreMemoryDir = join(paths.root, 'core-memory');
    ensureStorageDir(coreMemoryDir);

    this.dbPath = join(coreMemoryDir, 'core_memory.db');
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    this.initDatabase();
  }

  /**
   * Initialize database schema
   */
  private initDatabase(): void {
    this.db.exec(`
      -- Core memories table
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        summary TEXT,
        raw_output TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived INTEGER DEFAULT 0,
        metadata TEXT
      );

      -- Knowledge graph nodes table
      CREATE TABLE IF NOT EXISTS knowledge_graph (
        memory_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        node_type TEXT NOT NULL,
        node_label TEXT NOT NULL,
        PRIMARY KEY (memory_id, node_id),
        FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
      );

      -- Knowledge graph edges table
      CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
        memory_id TEXT NOT NULL,
        edge_source TEXT NOT NULL,
        edge_target TEXT NOT NULL,
        edge_type TEXT NOT NULL,
        PRIMARY KEY (memory_id, edge_source, edge_target),
        FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
      );

      -- Evolution history table
      CREATE TABLE IF NOT EXISTS evolution_history (
        memory_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        diff_stats TEXT,
        PRIMARY KEY (memory_id, version),
        FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
      );

      -- Indexes for efficient queries
      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_updated ON memories(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_archived ON memories(archived);
      CREATE INDEX IF NOT EXISTS idx_knowledge_graph_memory ON knowledge_graph(memory_id);
      CREATE INDEX IF NOT EXISTS idx_knowledge_graph_edges_memory ON knowledge_graph_edges(memory_id);
      CREATE INDEX IF NOT EXISTS idx_evolution_history_memory ON evolution_history(memory_id);
    `);
  }

  /**
   * Generate timestamp-based ID
   */
  private generateId(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `CMEM-${year}${month}${day}-${hours}${minutes}${seconds}`;
  }

  /**
   * Upsert a core memory
   */
  upsertMemory(memory: Partial<CoreMemory> & { content: string }): CoreMemory {
    const now = new Date().toISOString();
    const id = memory.id || this.generateId();

    // Check if memory exists
    const existingMemory = this.getMemory(id);

    if (existingMemory) {
      // Update existing memory
      const stmt = this.db.prepare(`
        UPDATE memories
        SET content = ?, summary = ?, raw_output = ?, updated_at = ?, archived = ?, metadata = ?
        WHERE id = ?
      `);

      stmt.run(
        memory.content,
        memory.summary || existingMemory.summary,
        memory.raw_output || existingMemory.raw_output,
        now,
        memory.archived !== undefined ? (memory.archived ? 1 : 0) : existingMemory.archived ? 1 : 0,
        memory.metadata || existingMemory.metadata,
        id
      );

      // Add evolution history entry
      const currentVersion = this.getLatestVersion(id);
      this.addEvolutionVersion(id, currentVersion + 1, memory.content);

      return this.getMemory(id)!;
    } else {
      // Insert new memory
      const stmt = this.db.prepare(`
        INSERT INTO memories (id, content, summary, raw_output, created_at, updated_at, archived, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        memory.content,
        memory.summary || '',
        memory.raw_output || null,
        now,
        now,
        memory.archived ? 1 : 0,
        memory.metadata || null
      );

      // Add initial evolution history entry (version 1)
      this.addEvolutionVersion(id, 1, memory.content);

      return this.getMemory(id)!;
    }
  }

  /**
   * Get memory by ID
   */
  getMemory(id: string): CoreMemory | null {
    const stmt = this.db.prepare(`SELECT * FROM memories WHERE id = ?`);
    const row = stmt.get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      content: row.content,
      summary: row.summary,
      raw_output: row.raw_output,
      created_at: row.created_at,
      updated_at: row.updated_at,
      archived: Boolean(row.archived),
      metadata: row.metadata
    };
  }

  /**
   * Get all memories
   */
  getMemories(options: { archived?: boolean; limit?: number; offset?: number } = {}): CoreMemory[] {
    const { archived = false, limit = 50, offset = 0 } = options;

    const stmt = this.db.prepare(`
      SELECT * FROM memories
      WHERE archived = ?
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(archived ? 1 : 0, limit, offset) as any[];
    return rows.map(row => ({
      id: row.id,
      content: row.content,
      summary: row.summary,
      raw_output: row.raw_output,
      created_at: row.created_at,
      updated_at: row.updated_at,
      archived: Boolean(row.archived),
      metadata: row.metadata
    }));
  }

  /**
   * Archive a memory
   */
  archiveMemory(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE memories
      SET archived = 1, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(new Date().toISOString(), id);
  }

  /**
   * Delete a memory
   */
  deleteMemory(id: string): void {
    const stmt = this.db.prepare(`DELETE FROM memories WHERE id = ?`);
    stmt.run(id);
  }

  /**
   * Generate summary for a memory using CLI tool
   */
  async generateSummary(memoryId: string, tool: 'gemini' | 'qwen' = 'gemini'): Promise<string> {
    const memory = this.getMemory(memoryId);
    if (!memory) throw new Error('Memory not found');

    // Import CLI executor
    const { executeCliTool } = await import('../tools/cli-executor.js');

    const prompt = `
PURPOSE: Generate a concise summary (2-3 sentences) of the following core memory content
TASK: Extract key architectural decisions, strategic insights, and important context
MODE: analysis
EXPECTED: Plain text summary without markdown or formatting
RULES: Be concise. Focus on high-level understanding. No technical jargon unless essential.

CONTENT:
${memory.content}
`;

    const result = await executeCliTool({
      tool,
      prompt,
      mode: 'analysis',
      timeout: 60000,
      cd: this.projectPath,
      category: 'internal'
    });

    const summary = result.stdout?.trim() || 'Failed to generate summary';

    // Update memory with summary
    const stmt = this.db.prepare(`
      UPDATE memories
      SET summary = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(summary, new Date().toISOString(), memoryId);

    // Add evolution history entry
    const currentVersion = this.getLatestVersion(memoryId);
    this.addEvolutionVersion(memoryId, currentVersion + 1, memory.content);

    return summary;
  }

  /**
   * Extract knowledge graph from memory content
   */
  extractKnowledgeGraph(memoryId: string): KnowledgeGraph {
    const memory = this.getMemory(memoryId);
    if (!memory) throw new Error('Memory not found');

    // Simple extraction based on patterns in content
    const nodes: KnowledgeGraph['nodes'] = [];
    const edges: KnowledgeGraph['edges'] = [];
    const nodeSet = new Set<string>();

    // Extract file references
    const filePattern = /(?:file|path|module):\s*([^\s,]+(?:\.ts|\.js|\.py|\.go|\.java|\.rs))/gi;
    let match;
    while ((match = filePattern.exec(memory.content)) !== null) {
      const filePath = match[1];
      if (!nodeSet.has(filePath)) {
        nodes.push({ id: filePath, type: 'file', label: filePath.split('/').pop() || filePath });
        nodeSet.add(filePath);
      }
    }

    // Extract function/class references
    const functionPattern = /(?:function|class|method):\s*(\w+)/gi;
    while ((match = functionPattern.exec(memory.content)) !== null) {
      const funcName = match[1];
      const nodeId = `func:${funcName}`;
      if (!nodeSet.has(nodeId)) {
        nodes.push({ id: nodeId, type: 'function', label: funcName });
        nodeSet.add(nodeId);
      }
    }

    // Extract module references
    const modulePattern = /(?:module|package):\s*(\w+(?:\/\w+)*)/gi;
    while ((match = modulePattern.exec(memory.content)) !== null) {
      const moduleName = match[1];
      const nodeId = `module:${moduleName}`;
      if (!nodeSet.has(nodeId)) {
        nodes.push({ id: nodeId, type: 'module', label: moduleName });
        nodeSet.add(nodeId);
      }
    }

    // Extract relationships
    const dependsPattern = /(\w+)\s+depends on\s+(\w+)/gi;
    while ((match = dependsPattern.exec(memory.content)) !== null) {
      const source = match[1];
      const target = match[2];
      edges.push({ source, target, type: 'depends_on' });
    }

    const usesPattern = /(\w+)\s+uses\s+(\w+)/gi;
    while ((match = usesPattern.exec(memory.content)) !== null) {
      const source = match[1];
      const target = match[2];
      edges.push({ source, target, type: 'uses' });
    }

    // Save to database
    this.db.prepare(`DELETE FROM knowledge_graph WHERE memory_id = ?`).run(memoryId);
    this.db.prepare(`DELETE FROM knowledge_graph_edges WHERE memory_id = ?`).run(memoryId);

    const nodeStmt = this.db.prepare(`
      INSERT INTO knowledge_graph (memory_id, node_id, node_type, node_label)
      VALUES (?, ?, ?, ?)
    `);

    for (const node of nodes) {
      nodeStmt.run(memoryId, node.id, node.type, node.label);
    }

    const edgeStmt = this.db.prepare(`
      INSERT INTO knowledge_graph_edges (memory_id, edge_source, edge_target, edge_type)
      VALUES (?, ?, ?, ?)
    `);

    for (const edge of edges) {
      edgeStmt.run(memoryId, edge.source, edge.target, edge.type);
    }

    return { nodes, edges };
  }

  /**
   * Get knowledge graph for a memory
   */
  getKnowledgeGraph(memoryId: string): KnowledgeGraph {
    const nodeStmt = this.db.prepare(`
      SELECT node_id, node_type, node_label
      FROM knowledge_graph
      WHERE memory_id = ?
    `);

    const edgeStmt = this.db.prepare(`
      SELECT edge_source, edge_target, edge_type
      FROM knowledge_graph_edges
      WHERE memory_id = ?
    `);

    const nodeRows = nodeStmt.all(memoryId) as any[];
    const edgeRows = edgeStmt.all(memoryId) as any[];

    const nodes = nodeRows.map(row => ({
      id: row.node_id,
      type: row.node_type,
      label: row.node_label
    }));

    const edges = edgeRows.map(row => ({
      source: row.edge_source,
      target: row.edge_target,
      type: row.edge_type
    }));

    return { nodes, edges };
  }

  /**
   * Get latest version number for a memory
   */
  private getLatestVersion(memoryId: string): number {
    const stmt = this.db.prepare(`
      SELECT MAX(version) as max_version
      FROM evolution_history
      WHERE memory_id = ?
    `);
    const result = stmt.get(memoryId) as { max_version: number | null };
    return result.max_version || 0;
  }

  /**
   * Add evolution version
   */
  private addEvolutionVersion(memoryId: string, version: number, content: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO evolution_history (memory_id, version, content, timestamp)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(memoryId, version, content, new Date().toISOString());
  }

  /**
   * Track evolution history
   */
  trackEvolution(memoryId: string): EvolutionVersion[] {
    const stmt = this.db.prepare(`
      SELECT version, content, timestamp, diff_stats
      FROM evolution_history
      WHERE memory_id = ?
      ORDER BY version ASC
    `);

    const rows = stmt.all(memoryId) as any[];
    return rows.map((row, index) => {
      let diffStats: EvolutionVersion['diff_stats'];

      if (index > 0) {
        const prevContent = rows[index - 1].content;
        const currentContent = row.content;

        // Simple diff calculation
        const prevLines = prevContent.split('\n');
        const currentLines = currentContent.split('\n');

        let added = 0;
        let deleted = 0;
        let modified = 0;

        const maxLen = Math.max(prevLines.length, currentLines.length);
        for (let i = 0; i < maxLen; i++) {
          const prevLine = prevLines[i];
          const currentLine = currentLines[i];

          if (!prevLine && currentLine) added++;
          else if (prevLine && !currentLine) deleted++;
          else if (prevLine !== currentLine) modified++;
        }

        diffStats = { added, modified, deleted };
      }

      return {
        memory_id: memoryId,
        version: row.version,
        content: row.content,
        timestamp: row.timestamp,
        diff_stats: diffStats
      };
    });
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// Singleton instance cache
const storeCache = new Map<string, CoreMemoryStore>();

/**
 * Get or create a store instance for a project
 */
export function getCoreMemoryStore(projectPath: string): CoreMemoryStore {
  const normalizedPath = projectPath.toLowerCase().replace(/\\/g, '/');

  if (!storeCache.has(normalizedPath)) {
    storeCache.set(normalizedPath, new CoreMemoryStore(projectPath));
  }
  return storeCache.get(normalizedPath)!;
}

/**
 * Close all store instances
 */
export function closeAllStores(): void {
  const stores = Array.from(storeCache.values());
  for (const store of stores) {
    store.close();
  }
  storeCache.clear();
}

export default CoreMemoryStore;
