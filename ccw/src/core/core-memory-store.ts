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

export interface SessionCluster {
  id: string;  // Format: CLST-YYYYMMDD-HHMMSS
  name: string;
  description?: string;
  intent?: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'archived' | 'merged';
  metadata?: string;
}

export interface ClusterMember {
  cluster_id: string;
  session_id: string;
  session_type: 'core_memory' | 'workflow' | 'cli_history' | 'native';
  sequence_order: number;
  added_at: string;
  relevance_score: number;
}

export interface ClusterRelation {
  source_cluster_id: string;
  target_cluster_id: string;
  relation_type: 'depends_on' | 'extends' | 'conflicts_with' | 'related_to';
  created_at: string;
}

export interface SessionMetadataCache {
  session_id: string;
  session_type: string;
  title?: string;
  summary?: string;
  keywords?: string[];  // stored as JSON
  token_estimate?: number;
  file_patterns?: string[];  // stored as JSON
  created_at?: string;
  last_accessed?: string;
  access_count: number;
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
    // Migrate old tables
    this.migrateDatabase();

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

      -- Session clusters table
      CREATE TABLE IF NOT EXISTS session_clusters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        intent TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        metadata TEXT
      );

      -- Cluster members table
      CREATE TABLE IF NOT EXISTS cluster_members (
        cluster_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        session_type TEXT NOT NULL,
        sequence_order INTEGER NOT NULL,
        added_at TEXT NOT NULL,
        relevance_score REAL DEFAULT 1.0,
        PRIMARY KEY (cluster_id, session_id),
        FOREIGN KEY (cluster_id) REFERENCES session_clusters(id) ON DELETE CASCADE
      );

      -- Cluster relations table
      CREATE TABLE IF NOT EXISTS cluster_relations (
        source_cluster_id TEXT NOT NULL,
        target_cluster_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (source_cluster_id, target_cluster_id),
        FOREIGN KEY (source_cluster_id) REFERENCES session_clusters(id) ON DELETE CASCADE,
        FOREIGN KEY (target_cluster_id) REFERENCES session_clusters(id) ON DELETE CASCADE
      );

      -- Session metadata cache table
      CREATE TABLE IF NOT EXISTS session_metadata_cache (
        session_id TEXT PRIMARY KEY,
        session_type TEXT NOT NULL,
        title TEXT,
        summary TEXT,
        keywords TEXT,
        token_estimate INTEGER,
        file_patterns TEXT,
        created_at TEXT,
        last_accessed TEXT,
        access_count INTEGER DEFAULT 0
      );

      -- Indexes for efficient queries
      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_updated ON memories(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_archived ON memories(archived);
      CREATE INDEX IF NOT EXISTS idx_session_clusters_status ON session_clusters(status);
      CREATE INDEX IF NOT EXISTS idx_cluster_members_cluster ON cluster_members(cluster_id);
      CREATE INDEX IF NOT EXISTS idx_cluster_members_session ON cluster_members(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_metadata_type ON session_metadata_cache(session_type);
    `);
  }

  /**
   * Migrate database by removing old tables, views, and triggers
   */
  private migrateDatabase(): void {
    const oldTables = ['knowledge_graph', 'knowledge_graph_edges', 'evolution_history'];

    try {
      // Disable foreign key constraints during migration
      this.db.pragma('foreign_keys = OFF');

      // Drop any triggers that might reference old tables
      const triggers = this.db.prepare(
        `SELECT name FROM sqlite_master WHERE type='trigger'`
      ).all() as { name: string }[];

      for (const trigger of triggers) {
        try {
          this.db.exec(`DROP TRIGGER IF EXISTS "${trigger.name}"`);
        } catch (e) {
          // Ignore trigger drop errors
        }
      }

      // Drop any views that might reference old tables
      const views = this.db.prepare(
        `SELECT name FROM sqlite_master WHERE type='view'`
      ).all() as { name: string }[];

      for (const view of views) {
        try {
          this.db.exec(`DROP VIEW IF EXISTS "${view.name}"`);
        } catch (e) {
          // Ignore view drop errors
        }
      }

      // Now drop the old tables
      for (const table of oldTables) {
        try {
          this.db.exec(`DROP TABLE IF EXISTS "${table}"`);
        } catch (e) {
          // Ignore if table doesn't exist
        }
      }

      // Re-enable foreign key constraints
      this.db.pragma('foreign_keys = ON');
    } catch (e) {
      // If migration fails, continue - tables may not exist
      try {
        this.db.pragma('foreign_keys = ON');
      } catch (_) {
        // Ignore
      }
    }
  }

  /**
   * Generate timestamp-based ID for core memory
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
   * Generate cluster ID
   */
  generateClusterId(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    // Add random 2-digit suffix to ensure uniqueness
    const random = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    return `CLST-${year}${month}${day}-${hours}${minutes}${seconds}${ms}${random}`;
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

    return summary;
  }

  /**
   * Create a new session cluster
   */
  createCluster(cluster: Partial<SessionCluster> & { name: string }): SessionCluster {
    const now = new Date().toISOString();
    const id = cluster.id || this.generateClusterId();

    const stmt = this.db.prepare(`
      INSERT INTO session_clusters (id, name, description, intent, created_at, updated_at, status, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      cluster.name,
      cluster.description || null,
      cluster.intent || null,
      now,
      now,
      cluster.status || 'active',
      cluster.metadata || null
    );

    return this.getCluster(id)!;
  }

  /**
   * Get cluster by ID
   */
  getCluster(id: string): SessionCluster | null {
    const stmt = this.db.prepare(`SELECT * FROM session_clusters WHERE id = ?`);
    const row = stmt.get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      intent: row.intent,
      created_at: row.created_at,
      updated_at: row.updated_at,
      status: row.status,
      metadata: row.metadata
    };
  }

  /**
   * List all clusters
   */
  listClusters(status?: string): SessionCluster[] {
    let query = 'SELECT * FROM session_clusters';
    const params: any[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY updated_at DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      intent: row.intent,
      created_at: row.created_at,
      updated_at: row.updated_at,
      status: row.status,
      metadata: row.metadata
    }));
  }

  /**
   * Update cluster
   */
  updateCluster(id: string, updates: Partial<SessionCluster>): SessionCluster | null {
    const existing = this.getCluster(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE session_clusters
      SET name = ?, description = ?, intent = ?, updated_at = ?, status = ?, metadata = ?
      WHERE id = ?
    `);

    stmt.run(
      updates.name || existing.name,
      updates.description !== undefined ? updates.description : existing.description,
      updates.intent !== undefined ? updates.intent : existing.intent,
      now,
      updates.status || existing.status,
      updates.metadata !== undefined ? updates.metadata : existing.metadata,
      id
    );

    return this.getCluster(id);
  }

  /**
   * Delete cluster
   */
  deleteCluster(id: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM session_clusters WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Add member to cluster
   */
  addClusterMember(member: Omit<ClusterMember, 'added_at'>): ClusterMember {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO cluster_members (cluster_id, session_id, session_type, sequence_order, added_at, relevance_score)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      member.cluster_id,
      member.session_id,
      member.session_type,
      member.sequence_order,
      now,
      member.relevance_score
    );

    return {
      ...member,
      added_at: now
    };
  }

  /**
   * Remove member from cluster
   */
  removeClusterMember(clusterId: string, sessionId: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM cluster_members
      WHERE cluster_id = ? AND session_id = ?
    `);
    const result = stmt.run(clusterId, sessionId);
    return result.changes > 0;
  }

  /**
   * Get all members of a cluster
   */
  getClusterMembers(clusterId: string): ClusterMember[] {
    const stmt = this.db.prepare(`
      SELECT * FROM cluster_members
      WHERE cluster_id = ?
      ORDER BY sequence_order ASC
    `);

    const rows = stmt.all(clusterId) as any[];
    return rows.map(row => ({
      cluster_id: row.cluster_id,
      session_id: row.session_id,
      session_type: row.session_type,
      sequence_order: row.sequence_order,
      added_at: row.added_at,
      relevance_score: row.relevance_score
    }));
  }

  /**
   * Get all clusters that contain a session
   */
  getSessionClusters(sessionId: string): SessionCluster[] {
    const stmt = this.db.prepare(`
      SELECT sc.*
      FROM session_clusters sc
      INNER JOIN cluster_members cm ON sc.id = cm.cluster_id
      WHERE cm.session_id = ?
      ORDER BY sc.updated_at DESC
    `);

    const rows = stmt.all(sessionId) as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      intent: row.intent,
      created_at: row.created_at,
      updated_at: row.updated_at,
      status: row.status,
      metadata: row.metadata
    }));
  }

  /**
   * Add relation between clusters
   */
  addClusterRelation(relation: Omit<ClusterRelation, 'created_at'>): ClusterRelation {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO cluster_relations (source_cluster_id, target_cluster_id, relation_type, created_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      relation.source_cluster_id,
      relation.target_cluster_id,
      relation.relation_type,
      now
    );

    return {
      ...relation,
      created_at: now
    };
  }

  /**
   * Remove relation between clusters
   */
  removeClusterRelation(sourceId: string, targetId: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM cluster_relations
      WHERE source_cluster_id = ? AND target_cluster_id = ?
    `);
    const result = stmt.run(sourceId, targetId);
    return result.changes > 0;
  }

  /**
   * Get all relations for a cluster
   */
  getClusterRelations(clusterId: string): ClusterRelation[] {
    const stmt = this.db.prepare(`
      SELECT * FROM cluster_relations
      WHERE source_cluster_id = ? OR target_cluster_id = ?
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(clusterId, clusterId) as any[];
    return rows.map(row => ({
      source_cluster_id: row.source_cluster_id,
      target_cluster_id: row.target_cluster_id,
      relation_type: row.relation_type,
      created_at: row.created_at
    }));
  }

  /**
   * Upsert session metadata
   */
  upsertSessionMetadata(metadata: SessionMetadataCache): SessionMetadataCache {
    const now = new Date().toISOString();

    const existing = this.getSessionMetadata(metadata.session_id);

    if (existing) {
      const stmt = this.db.prepare(`
        UPDATE session_metadata_cache
        SET session_type = ?, title = ?, summary = ?, keywords = ?, token_estimate = ?,
            file_patterns = ?, last_accessed = ?, access_count = ?
        WHERE session_id = ?
      `);

      stmt.run(
        metadata.session_type,
        metadata.title || null,
        metadata.summary || null,
        metadata.keywords ? JSON.stringify(metadata.keywords) : null,
        metadata.token_estimate || null,
        metadata.file_patterns ? JSON.stringify(metadata.file_patterns) : null,
        now,
        existing.access_count + 1,
        metadata.session_id
      );
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO session_metadata_cache
        (session_id, session_type, title, summary, keywords, token_estimate, file_patterns, created_at, last_accessed, access_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        metadata.session_id,
        metadata.session_type,
        metadata.title || null,
        metadata.summary || null,
        metadata.keywords ? JSON.stringify(metadata.keywords) : null,
        metadata.token_estimate || null,
        metadata.file_patterns ? JSON.stringify(metadata.file_patterns) : null,
        metadata.created_at || now,
        now,
        metadata.access_count || 1
      );
    }

    return this.getSessionMetadata(metadata.session_id)!;
  }

  /**
   * Get session metadata
   */
  getSessionMetadata(sessionId: string): SessionMetadataCache | null {
    const stmt = this.db.prepare(`SELECT * FROM session_metadata_cache WHERE session_id = ?`);
    const row = stmt.get(sessionId) as any;
    if (!row) return null;

    return {
      session_id: row.session_id,
      session_type: row.session_type,
      title: row.title,
      summary: row.summary,
      keywords: row.keywords ? JSON.parse(row.keywords) : undefined,
      token_estimate: row.token_estimate,
      file_patterns: row.file_patterns ? JSON.parse(row.file_patterns) : undefined,
      created_at: row.created_at,
      last_accessed: row.last_accessed,
      access_count: row.access_count
    };
  }

  /**
   * Search sessions by keyword
   */
  searchSessionsByKeyword(keyword: string): SessionMetadataCache[] {
    const stmt = this.db.prepare(`
      SELECT * FROM session_metadata_cache
      WHERE title LIKE ? OR summary LIKE ? OR keywords LIKE ?
      ORDER BY access_count DESC, last_accessed DESC
    `);

    const pattern = `%${keyword}%`;
    const rows = stmt.all(pattern, pattern, pattern) as any[];

    return rows.map(row => ({
      session_id: row.session_id,
      session_type: row.session_type,
      title: row.title,
      summary: row.summary,
      keywords: row.keywords ? JSON.parse(row.keywords) : undefined,
      token_estimate: row.token_estimate,
      file_patterns: row.file_patterns ? JSON.parse(row.file_patterns) : undefined,
      created_at: row.created_at,
      last_accessed: row.last_accessed,
      access_count: row.access_count
    }));
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
