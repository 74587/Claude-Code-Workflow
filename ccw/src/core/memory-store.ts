/**
 * Memory Store - SQLite Storage Backend
 * Provides persistent storage for memory module with entity tracking, associations, and conversation history
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { StoragePaths, ensureStorageDir, getProjectId } from '../config/storage-paths.js';

// Types
export interface Entity {
  id?: number;
  type: 'file' | 'module' | 'topic' | 'url';
  value: string;
  normalized_value: string;
  first_seen_at: string;
  last_seen_at: string;
  metadata?: string;
}

export interface AccessLog {
  id?: number;
  entity_id: number;
  action: 'read' | 'write' | 'mention';
  session_id?: string;
  timestamp: string;
  context_summary?: string;
}

export interface EntityStats {
  entity_id: number;
  read_count: number;
  write_count: number;
  mention_count: number;
  heat_score: number;
}

export interface Association {
  source_id: number;
  target_id: number;
  weight: number;
  last_interaction_at?: string;
}

export interface PromptHistory {
  id?: number;
  session_id: string;
  project_path?: string;
  prompt_text?: string;
  context_summary?: string;
  timestamp: number;
  hash?: string;
  quality_score?: number;
  intent_label?: string;
}

export interface PromptPattern {
  id?: number;
  pattern_type?: string;
  frequency: number;
  example_ids?: string;
  last_detected?: number;
}

export interface Conversation {
  id: string;
  source?: string;
  external_id?: string;
  project_name?: string;
  git_branch?: string;
  created_at: string;
  updated_at: string;
  quality_score?: number;
  turn_count: number;
  prompt_preview?: string;
}

export interface Message {
  id?: number;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content_text?: string;
  content_json?: string;
  timestamp: string;
  token_count?: number;
}

export interface ToolCall {
  id?: number;
  message_id: number;
  tool_name: string;
  tool_args?: string;
  tool_output?: string;
  status?: string;
  duration_ms?: number;
}

export interface HotEntity extends Entity {
  stats: EntityStats;
}

export interface EntityWithAssociations extends Entity {
  associations: Array<{
    target: Entity;
    weight: number;
    last_interaction_at?: string;
  }>;
}

/**
 * Memory Store using SQLite
 */
export class MemoryStore {
  private db: Database.Database;
  private dbPath: string;

  constructor(projectPath: string) {
    // Use centralized storage path
    const paths = StoragePaths.project(projectPath);
    const memoryDir = paths.memory;
    ensureStorageDir(memoryDir);

    this.dbPath = paths.memoryDb;
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    this.initDatabase();
    this.migrateSchema();
  }

  /**
   * Initialize database schema
   */
  private initDatabase(): void {
    this.db.exec(`
      -- Entity table
      CREATE TABLE IF NOT EXISTS entities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        normalized_value TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        metadata TEXT,
        UNIQUE(type, normalized_value)
      );

      -- Access logs table
      CREATE TABLE IF NOT EXISTS access_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        session_id TEXT,
        timestamp TEXT NOT NULL,
        context_summary TEXT,
        FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
      );

      -- Entity statistics table
      CREATE TABLE IF NOT EXISTS entity_stats (
        entity_id INTEGER PRIMARY KEY,
        read_count INTEGER DEFAULT 0,
        write_count INTEGER DEFAULT 0,
        mention_count INTEGER DEFAULT 0,
        heat_score REAL DEFAULT 0,
        FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
      );

      -- Associations table
      CREATE TABLE IF NOT EXISTS associations (
        source_id INTEGER NOT NULL,
        target_id INTEGER NOT NULL,
        weight INTEGER DEFAULT 0,
        last_interaction_at TEXT,
        PRIMARY KEY (source_id, target_id),
        FOREIGN KEY (source_id) REFERENCES entities(id) ON DELETE CASCADE,
        FOREIGN KEY (target_id) REFERENCES entities(id) ON DELETE CASCADE
      );

      -- Prompt history table
      CREATE TABLE IF NOT EXISTS prompt_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        project_path TEXT,
        prompt_text TEXT,
        context_summary TEXT,
        timestamp INTEGER,
        hash TEXT UNIQUE,
        quality_score INTEGER,
        intent_label TEXT
      );

      -- Prompt patterns table
      CREATE TABLE IF NOT EXISTS prompt_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern_type TEXT,
        frequency INTEGER,
        example_ids TEXT,
        last_detected INTEGER
      );

      -- Conversations table
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        source TEXT DEFAULT 'ccw',
        external_id TEXT,
        project_name TEXT,
        git_branch TEXT,
        created_at TEXT,
        updated_at TEXT,
        quality_score INTEGER,
        turn_count INTEGER,
        prompt_preview TEXT
      );

      -- Messages table
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content_text TEXT,
        content_json TEXT,
        timestamp TEXT NOT NULL,
        token_count INTEGER,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      -- Tool calls table
      CREATE TABLE IF NOT EXISTS tool_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL,
        tool_name TEXT NOT NULL,
        tool_args TEXT,
        tool_output TEXT,
        status TEXT,
        duration_ms INTEGER,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
      );

      -- Indexes for efficient queries
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_entities_normalized ON entities(normalized_value);
      CREATE INDEX IF NOT EXISTS idx_entities_last_seen ON entities(last_seen_at DESC);
      CREATE INDEX IF NOT EXISTS idx_access_logs_entity ON access_logs(entity_id);
      CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON access_logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_access_logs_session ON access_logs(session_id);
      CREATE INDEX IF NOT EXISTS idx_entity_stats_heat ON entity_stats(heat_score DESC);
      CREATE INDEX IF NOT EXISTS idx_associations_source ON associations(source_id);
      CREATE INDEX IF NOT EXISTS idx_associations_target ON associations(target_id);
      CREATE INDEX IF NOT EXISTS idx_prompt_history_session ON prompt_history(session_id);
      CREATE INDEX IF NOT EXISTS idx_prompt_history_timestamp ON prompt_history(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_tool_calls_message ON tool_calls(message_id);

      -- Full-text search for prompt history
      CREATE VIRTUAL TABLE IF NOT EXISTS prompt_history_fts USING fts5(
        prompt_text,
        context_summary,
        content='prompt_history',
        content_rowid='id'
      );

      -- Triggers to keep FTS index updated
      CREATE TRIGGER IF NOT EXISTS prompt_history_ai AFTER INSERT ON prompt_history BEGIN
        INSERT INTO prompt_history_fts(rowid, prompt_text, context_summary)
        VALUES (new.id, new.prompt_text, new.context_summary);
      END;

      CREATE TRIGGER IF NOT EXISTS prompt_history_ad AFTER DELETE ON prompt_history BEGIN
        INSERT INTO prompt_history_fts(prompt_history_fts, rowid, prompt_text, context_summary)
        VALUES('delete', old.id, old.prompt_text, old.context_summary);
      END;

      CREATE TRIGGER IF NOT EXISTS prompt_history_au AFTER UPDATE ON prompt_history BEGIN
        INSERT INTO prompt_history_fts(prompt_history_fts, rowid, prompt_text, context_summary)
        VALUES('delete', old.id, old.prompt_text, old.context_summary);
        INSERT INTO prompt_history_fts(rowid, prompt_text, context_summary)
        VALUES (new.id, new.prompt_text, new.context_summary);
      END;
    `);
  }

  /**
   * Migrate schema for existing databases
   */
  private migrateSchema(): void {
    try {
      // Check if hierarchical storage columns exist in conversations table
      const tableInfo = this.db.prepare('PRAGMA table_info(conversations)').all() as Array<{ name: string }>;
      const hasProjectRoot = tableInfo.some(col => col.name === 'project_root');
      const hasRelativePath = tableInfo.some(col => col.name === 'relative_path');

      // Add hierarchical storage support columns
      if (!hasProjectRoot) {
        console.log('[Memory Store] Migrating database: adding project_root column for hierarchical storage...');
        this.db.exec(`
          ALTER TABLE conversations ADD COLUMN project_root TEXT;
        `);
        try {
          this.db.exec(`CREATE INDEX IF NOT EXISTS idx_conversations_project_root ON conversations(project_root);`);
        } catch (indexErr) {
          console.warn('[Memory Store] Project root index creation warning:', (indexErr as Error).message);
        }
        console.log('[Memory Store] Migration complete: project_root column added');
      }

      if (!hasRelativePath) {
        console.log('[Memory Store] Migrating database: adding relative_path column for hierarchical storage...');
        this.db.exec(`
          ALTER TABLE conversations ADD COLUMN relative_path TEXT;
        `);
        console.log('[Memory Store] Migration complete: relative_path column added');
      }
    } catch (err) {
      console.error('[Memory Store] Migration error:', (err as Error).message);
      // Don't throw - allow the store to continue working with existing schema
    }
  }

  /**
   * Upsert an entity
   */
  upsertEntity(entity: Entity): number {
    const stmt = this.db.prepare(`
      INSERT INTO entities (type, value, normalized_value, first_seen_at, last_seen_at, metadata)
      VALUES (@type, @value, @normalized_value, @first_seen_at, @last_seen_at, @metadata)
      ON CONFLICT(type, normalized_value) DO UPDATE SET
        value = @value,
        last_seen_at = @last_seen_at,
        metadata = @metadata
      RETURNING id
    `);

    const result = stmt.get({
      type: entity.type,
      value: entity.value,
      normalized_value: entity.normalized_value,
      first_seen_at: entity.first_seen_at,
      last_seen_at: entity.last_seen_at,
      metadata: entity.metadata || null
    }) as { id: number };

    return result.id;
  }

  /**
   * Get entity by type and normalized value
   */
  getEntity(type: string, normalizedValue: string): Entity | null {
    const stmt = this.db.prepare(`
      SELECT * FROM entities WHERE type = ? AND normalized_value = ?
    `);
    return stmt.get(type, normalizedValue) as Entity | null;
  }

  /**
   * Get entity by ID
   */
  getEntityById(id: number): Entity | null {
    const stmt = this.db.prepare(`SELECT * FROM entities WHERE id = ?`);
    return stmt.get(id) as Entity | null;
  }

  /**
   * Get hot entities (by heat score)
   */
  getHotEntities(limit: number = 20): HotEntity[] {
    const stmt = this.db.prepare(`
      SELECT e.*, s.read_count, s.write_count, s.mention_count, s.heat_score
      FROM entities e
      INNER JOIN entity_stats s ON e.id = s.entity_id
      ORDER BY s.heat_score DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map(row => ({
      id: row.id,
      type: row.type,
      value: row.value,
      normalized_value: row.normalized_value,
      first_seen_at: row.first_seen_at,
      last_seen_at: row.last_seen_at,
      metadata: row.metadata,
      stats: {
        entity_id: row.id,
        read_count: row.read_count,
        write_count: row.write_count,
        mention_count: row.mention_count,
        heat_score: row.heat_score
      }
    }));
  }

  /**
   * Log entity access
   */
  logAccess(log: AccessLog): void {
    const stmt = this.db.prepare(`
      INSERT INTO access_logs (entity_id, action, session_id, timestamp, context_summary)
      VALUES (@entity_id, @action, @session_id, @timestamp, @context_summary)
    `);

    stmt.run({
      entity_id: log.entity_id,
      action: log.action,
      session_id: log.session_id || null,
      timestamp: log.timestamp,
      context_summary: log.context_summary || null
    });
  }

  /**
   * Get recent access logs for an entity
   */
  getRecentAccess(entityId: number, limit: number = 50): AccessLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM access_logs
      WHERE entity_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(entityId, limit) as AccessLog[];
  }

  /**
   * Update entity statistics
   */
  updateStats(entityId: number, action: 'read' | 'write' | 'mention'): void {
    const upsertStmt = this.db.prepare(`
      INSERT INTO entity_stats (entity_id, read_count, write_count, mention_count, heat_score)
      VALUES (@entity_id, 0, 0, 0, 0)
      ON CONFLICT(entity_id) DO NOTHING
    `);

    upsertStmt.run({ entity_id: entityId });

    const field = `${action}_count`;
    const updateStmt = this.db.prepare(`
      UPDATE entity_stats
      SET ${field} = ${field} + 1
      WHERE entity_id = ?
    `);

    updateStmt.run(entityId);
  }

  /**
   * Get entity statistics
   */
  getStats(entityId: number): EntityStats | null {
    const stmt = this.db.prepare(`SELECT * FROM entity_stats WHERE entity_id = ?`);
    return stmt.get(entityId) as EntityStats | null;
  }

  /**
   * Calculate and update heat score for an entity
   */
  calculateHeatScore(entityId: number): number {
    const stats = this.getStats(entityId);
    if (!stats) return 0;

    const now = Date.now();
    const logs = this.getRecentAccess(entityId, 100);

    let recencyScore = 0;
    for (const log of logs) {
      const ageMs = now - new Date(log.timestamp).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const decay = Math.exp(-ageDays / 7); // 7-day half-life
      recencyScore += decay;
    }

    const heatScore = (
      stats.read_count * 1 +
      stats.write_count * 3 +
      stats.mention_count * 2 +
      recencyScore * 5
    );

    const updateStmt = this.db.prepare(`
      UPDATE entity_stats SET heat_score = ? WHERE entity_id = ?
    `);
    updateStmt.run(heatScore, entityId);

    return heatScore;
  }

  /**
   * Record association between entities
   */
  recordAssociation(sourceId: number, targetId: number, timestamp?: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO associations (source_id, target_id, weight, last_interaction_at)
      VALUES (@source_id, @target_id, 1, @last_interaction_at)
      ON CONFLICT(source_id, target_id) DO UPDATE SET
        weight = weight + 1,
        last_interaction_at = @last_interaction_at
    `);

    stmt.run({
      source_id: sourceId,
      target_id: targetId,
      last_interaction_at: timestamp || new Date().toISOString()
    });
  }

  /**
   * Get associations for an entity
   */
  getAssociations(entityId: number, limit: number = 20): EntityWithAssociations['associations'] {
    const stmt = this.db.prepare(`
      SELECT e.*, a.weight, a.last_interaction_at
      FROM associations a
      INNER JOIN entities e ON a.target_id = e.id
      WHERE a.source_id = ?
      ORDER BY a.weight DESC
      LIMIT ?
    `);

    const rows = stmt.all(entityId, limit) as any[];
    return rows.map(row => ({
      target: {
        id: row.id,
        type: row.type,
        value: row.value,
        normalized_value: row.normalized_value,
        first_seen_at: row.first_seen_at,
        last_seen_at: row.last_seen_at,
        metadata: row.metadata
      },
      weight: row.weight,
      last_interaction_at: row.last_interaction_at
    }));
  }

  /**
   * Save prompt to history
   */
  savePrompt(prompt: PromptHistory): number {
    const stmt = this.db.prepare(`
      INSERT INTO prompt_history (session_id, project_path, prompt_text, context_summary, timestamp, hash, quality_score, intent_label)
      VALUES (@session_id, @project_path, @prompt_text, @context_summary, @timestamp, @hash, @quality_score, @intent_label)
      ON CONFLICT(hash) DO UPDATE SET
        quality_score = @quality_score,
        intent_label = @intent_label
      RETURNING id
    `);

    const result = stmt.get({
      session_id: prompt.session_id,
      project_path: prompt.project_path || null,
      prompt_text: prompt.prompt_text || null,
      context_summary: prompt.context_summary || null,
      timestamp: prompt.timestamp,
      hash: prompt.hash || null,
      quality_score: prompt.quality_score || null,
      intent_label: prompt.intent_label || null
    }) as { id: number };

    return result.id;
  }

  /**
   * Get prompt history for a session
   */
  getPromptHistory(sessionId: string, limit: number = 50): PromptHistory[] {
    const stmt = this.db.prepare(`
      SELECT * FROM prompt_history
      WHERE session_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(sessionId, limit) as PromptHistory[];
  }

  /**
   * Search prompts by text
   */
  searchPrompts(query: string, limit: number = 20): PromptHistory[] {
    const stmt = this.db.prepare(`
      SELECT ph.* FROM prompt_history ph
      INNER JOIN prompt_history_fts fts ON fts.rowid = ph.id
      WHERE prompt_history_fts MATCH ?
      ORDER BY ph.timestamp DESC
      LIMIT ?
    `);
    return stmt.all(query, limit) as PromptHistory[];
  }

  /**
   * Save or update a conversation
   */
  saveConversation(conversation: Conversation): void {
    const stmt = this.db.prepare(`
      INSERT INTO conversations (id, source, external_id, project_name, git_branch, created_at, updated_at, quality_score, turn_count, prompt_preview)
      VALUES (@id, @source, @external_id, @project_name, @git_branch, @created_at, @updated_at, @quality_score, @turn_count, @prompt_preview)
      ON CONFLICT(id) DO UPDATE SET
        updated_at = @updated_at,
        quality_score = @quality_score,
        turn_count = @turn_count,
        prompt_preview = @prompt_preview
    `);

    stmt.run({
      id: conversation.id,
      source: conversation.source || 'ccw',
      external_id: conversation.external_id || null,
      project_name: conversation.project_name || null,
      git_branch: conversation.git_branch || null,
      created_at: conversation.created_at,
      updated_at: conversation.updated_at,
      quality_score: conversation.quality_score || null,
      turn_count: conversation.turn_count,
      prompt_preview: conversation.prompt_preview || null
    });
  }

  /**
   * Get conversations
   */
  getConversations(limit: number = 50, offset: number = 0): Conversation[] {
    const stmt = this.db.prepare(`
      SELECT * FROM conversations
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset) as Conversation[];
  }

  /**
   * Get conversation by ID
   */
  getConversation(id: string): Conversation | null {
    const stmt = this.db.prepare(`SELECT * FROM conversations WHERE id = ?`);
    return stmt.get(id) as Conversation | null;
  }

  /**
   * Save message
   */
  saveMessage(message: Message): number {
    const stmt = this.db.prepare(`
      INSERT INTO messages (conversation_id, role, content_text, content_json, timestamp, token_count)
      VALUES (@conversation_id, @role, @content_text, @content_json, @timestamp, @token_count)
      RETURNING id
    `);

    const result = stmt.get({
      conversation_id: message.conversation_id,
      role: message.role,
      content_text: message.content_text || null,
      content_json: message.content_json || null,
      timestamp: message.timestamp,
      token_count: message.token_count || null
    }) as { id: number };

    return result.id;
  }

  /**
   * Get messages for a conversation
   */
  getMessages(conversationId: string): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY timestamp ASC
    `);
    return stmt.all(conversationId) as Message[];
  }

  /**
   * Save tool call
   */
  saveToolCall(toolCall: ToolCall): number {
    const stmt = this.db.prepare(`
      INSERT INTO tool_calls (message_id, tool_name, tool_args, tool_output, status, duration_ms)
      VALUES (@message_id, @tool_name, @tool_args, @tool_output, @status, @duration_ms)
      RETURNING id
    `);

    const result = stmt.get({
      message_id: toolCall.message_id,
      tool_name: toolCall.tool_name,
      tool_args: toolCall.tool_args || null,
      tool_output: toolCall.tool_output || null,
      status: toolCall.status || null,
      duration_ms: toolCall.duration_ms || null
    }) as { id: number };

    return result.id;
  }

  /**
   * Get tool calls for a message
   */
  getToolCalls(messageId: number): ToolCall[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tool_calls
      WHERE message_id = ?
    `);
    return stmt.all(messageId) as ToolCall[];
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// Singleton instance cache - keyed by normalized project ID for consistency
const storeCache = new Map<string, MemoryStore>();

/**
 * Get or create a store instance for a project
 * Uses normalized project ID as cache key to handle path casing differences
 */
export function getMemoryStore(projectPath: string): MemoryStore {
  // Use getProjectId to normalize path for consistent cache key
  const cacheKey = getProjectId(projectPath);

  if (!storeCache.has(cacheKey)) {
    storeCache.set(cacheKey, new MemoryStore(projectPath));
  }
  return storeCache.get(cacheKey)!;
}

/**
 * Get aggregated stats from parent and all child projects
 * @param projectPath - Parent project path
 * @returns Aggregated statistics from all projects
 */
export function getAggregatedStats(projectPath: string): {
  entities: number;
  prompts: number;
  conversations: number;
  total: number;
  projects: Array<{ path: string; stats: { entities: number; prompts: number; conversations: number } }>;
} {
  const { scanChildProjects } = require('../config/storage-paths.js');
  const childProjects = scanChildProjects(projectPath);

  const projectStats: Array<{ path: string; stats: { entities: number; prompts: number; conversations: number } }> = [];
  let totalEntities = 0;
  let totalPrompts = 0;
  let totalConversations = 0;

  // Get parent stats
  try {
    const parentStore = getMemoryStore(projectPath);
    const db = (parentStore as any).db;

    const entityCount = (db.prepare('SELECT COUNT(*) as count FROM entities').get() as { count: number }).count;
    const promptCount = (db.prepare('SELECT COUNT(*) as count FROM prompt_history').get() as { count: number }).count;
    const conversationCount = (db.prepare('SELECT COUNT(*) as count FROM conversations').get() as { count: number }).count;

    projectStats.push({
      path: projectPath,
      stats: { entities: entityCount, prompts: promptCount, conversations: conversationCount }
    });
    totalEntities += entityCount;
    totalPrompts += promptCount;
    totalConversations += conversationCount;
  } catch (error) {
    if (process.env.DEBUG) {
      console.error(`[Memory Store] Failed to get stats for parent ${projectPath}:`, error);
    }
  }

  // Get child stats
  for (const child of childProjects) {
    try {
      const childStore = getMemoryStore(child.projectPath);
      const db = (childStore as any).db;

      const entityCount = (db.prepare('SELECT COUNT(*) as count FROM entities').get() as { count: number }).count;
      const promptCount = (db.prepare('SELECT COUNT(*) as count FROM prompt_history').get() as { count: number }).count;
      const conversationCount = (db.prepare('SELECT COUNT(*) as count FROM conversations').get() as { count: number }).count;

      projectStats.push({
        path: child.relativePath,
        stats: { entities: entityCount, prompts: promptCount, conversations: conversationCount }
      });
      totalEntities += entityCount;
      totalPrompts += promptCount;
      totalConversations += conversationCount;
    } catch (error) {
      if (process.env.DEBUG) {
        console.error(`[Memory Store] Failed to get stats for child ${child.projectPath}:`, error);
      }
    }
  }

  return {
    entities: totalEntities,
    prompts: totalPrompts,
    conversations: totalConversations,
    total: totalEntities + totalPrompts + totalConversations,
    projects: projectStats
  };
}

/**
 * Get aggregated entities from parent and all child projects
 * @param projectPath - Parent project path
 * @param options - Query options
 * @returns Combined entities from all projects with source information
 */
export function getAggregatedEntities(
  projectPath: string,
  options: { type?: string; limit?: number; offset?: number } = {}
): Array<HotEntity & { sourceProject?: string }> {
  const { scanChildProjects } = require('../config/storage-paths.js');
  const childProjects = scanChildProjects(projectPath);

  const limit = options.limit || 50;
  const offset = options.offset || 0;
  const allEntities: Array<HotEntity & { sourceProject?: string }> = [];

  // Get parent entities - apply LIMIT at SQL level
  try {
    const parentStore = getMemoryStore(projectPath);
    const db = (parentStore as any).db;

    let query = 'SELECT * FROM entities';
    const params: any[] = [];

    if (options.type) {
      query += ' WHERE type = ?';
      params.push(options.type);
    }

    query += ' ORDER BY last_seen_at DESC LIMIT ?';
    params.push(limit);

    const stmt = db.prepare(query);
    const parentEntities = stmt.all(...params) as Entity[];
    allEntities.push(...parentEntities.map((e: Entity) => ({ ...e, stats: {} as EntityStats, sourceProject: projectPath })));
  } catch (error) {
    if (process.env.DEBUG) {
      console.error(`[Memory Store] Failed to get entities for parent ${projectPath}:`, error);
    }
  }

  // Get child entities - apply LIMIT to each child
  for (const child of childProjects) {
    try {
      const childStore = getMemoryStore(child.projectPath);
      const db = (childStore as any).db;

      let query = 'SELECT * FROM entities';
      const params: any[] = [];

      if (options.type) {
        query += ' WHERE type = ?';
        params.push(options.type);
      }

      query += ' ORDER BY last_seen_at DESC LIMIT ?';
      params.push(limit);

      const stmt = db.prepare(query);
      const childEntities = stmt.all(...params) as Entity[];
      allEntities.push(...childEntities.map((e: Entity) => ({ ...e, stats: {} as EntityStats, sourceProject: child.relativePath })));
    } catch (error) {
      if (process.env.DEBUG) {
        console.error(`[Memory Store] Failed to get entities for child ${child.projectPath}:`, error);
      }
    }
  }

  // Sort by last_seen_at and apply final limit with offset
  allEntities.sort((a, b) => {
    const aTime = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
    const bTime = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
    return bTime - aTime;
  });

  return allEntities.slice(offset, offset + limit);
}

/**
 * Get aggregated prompts from parent and all child projects
 * @param projectPath - Parent project path
 * @param limit - Maximum number of prompts to return
 * @returns Combined prompts from all projects with source information
 */
export function getAggregatedPrompts(
  projectPath: string,
  limit: number = 50
): Array<PromptHistory & { sourceProject?: string }> {
  const { scanChildProjects } = require('../config/storage-paths.js');
  const childProjects = scanChildProjects(projectPath);

  const allPrompts: Array<PromptHistory & { sourceProject?: string }> = [];

  // Get parent prompts - use direct SQL query with LIMIT
  try {
    const parentStore = getMemoryStore(projectPath);
    const db = (parentStore as any).db;

    const stmt = db.prepare('SELECT * FROM prompt_history ORDER BY timestamp DESC LIMIT ?');
    const parentPrompts = stmt.all(limit) as PromptHistory[];
    allPrompts.push(...parentPrompts.map((p: PromptHistory) => ({ ...p, sourceProject: projectPath })));
  } catch (error) {
    if (process.env.DEBUG) {
      console.error(`[Memory Store] Failed to get prompts for parent ${projectPath}:`, error);
    }
  }

  // Get child prompts - apply LIMIT to each child to reduce memory footprint
  for (const child of childProjects) {
    try {
      const childStore = getMemoryStore(child.projectPath);
      const db = (childStore as any).db;

      const stmt = db.prepare('SELECT * FROM prompt_history ORDER BY timestamp DESC LIMIT ?');
      const childPrompts = stmt.all(limit) as PromptHistory[];
      allPrompts.push(...childPrompts.map((p: PromptHistory) => ({ ...p, sourceProject: child.relativePath })));
    } catch (error) {
      if (process.env.DEBUG) {
        console.error(`[Memory Store] Failed to get prompts for child ${child.projectPath}:`, error);
      }
    }
  }

  // Sort by timestamp and apply final limit
  allPrompts.sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return bTime - aTime;
  });

  return allPrompts.slice(0, limit);
}

/**
 * Close all store instances
 */
export function closeAllStores(): void {
  for (const store of storeCache.values()) {
    store.close();
  }
  storeCache.clear();
}

export default MemoryStore;
