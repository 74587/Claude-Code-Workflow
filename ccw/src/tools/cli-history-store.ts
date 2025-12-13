/**
 * CLI History Store - SQLite Storage Backend
 * Provides persistent storage for CLI execution history with efficient queries
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, rmdirSync } from 'fs';
import { join } from 'path';

// Types
export interface ConversationTurn {
  turn: number;
  timestamp: string;
  prompt: string;
  duration_ms: number;
  status: 'success' | 'error' | 'timeout';
  exit_code: number | null;
  output: {
    stdout: string;
    stderr: string;
    truncated: boolean;
  };
}

export interface ConversationRecord {
  id: string;
  created_at: string;
  updated_at: string;
  tool: string;
  model: string;
  mode: string;
  total_duration_ms: number;
  turn_count: number;
  latest_status: 'success' | 'error' | 'timeout';
  turns: ConversationTurn[];
}

export interface HistoryQueryOptions {
  limit?: number;
  offset?: number;
  tool?: string | null;
  status?: string | null;
  search?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface HistoryIndexEntry {
  id: string;
  timestamp: string;
  updated_at?: string;
  tool: string;
  status: string;
  duration_ms: number;
  turn_count?: number;
  prompt_preview: string;
  sourceDir?: string;
}

/**
 * CLI History Store using SQLite
 */
export class CliHistoryStore {
  private db: Database.Database;
  private dbPath: string;

  constructor(baseDir: string) {
    const historyDir = join(baseDir, '.workflow', '.cli-history');
    if (!existsSync(historyDir)) {
      mkdirSync(historyDir, { recursive: true });
    }

    this.dbPath = join(historyDir, 'history.db');
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    this.initSchema();
    this.migrateFromJson(historyDir);
  }

  /**
   * Initialize database schema
   */
  private initSchema(): void {
    this.db.exec(`
      -- Conversations table (conversation metadata)
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        tool TEXT NOT NULL,
        model TEXT DEFAULT 'default',
        mode TEXT DEFAULT 'analysis',
        total_duration_ms INTEGER DEFAULT 0,
        turn_count INTEGER DEFAULT 0,
        latest_status TEXT DEFAULT 'success',
        prompt_preview TEXT
      );

      -- Turns table (individual conversation turns)
      CREATE TABLE IF NOT EXISTS turns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        turn_number INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        prompt TEXT NOT NULL,
        duration_ms INTEGER DEFAULT 0,
        status TEXT DEFAULT 'success',
        exit_code INTEGER,
        stdout TEXT,
        stderr TEXT,
        truncated INTEGER DEFAULT 0,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        UNIQUE(conversation_id, turn_number)
      );

      -- Indexes for efficient queries
      CREATE INDEX IF NOT EXISTS idx_conversations_tool ON conversations(tool);
      CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(latest_status);
      CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_turns_conversation ON turns(conversation_id);

      -- Full-text search for prompts
      CREATE VIRTUAL TABLE IF NOT EXISTS turns_fts USING fts5(
        prompt,
        stdout,
        content='turns',
        content_rowid='id'
      );

      -- Triggers to keep FTS index updated
      CREATE TRIGGER IF NOT EXISTS turns_ai AFTER INSERT ON turns BEGIN
        INSERT INTO turns_fts(rowid, prompt, stdout) VALUES (new.id, new.prompt, new.stdout);
      END;

      CREATE TRIGGER IF NOT EXISTS turns_ad AFTER DELETE ON turns BEGIN
        INSERT INTO turns_fts(turns_fts, rowid, prompt, stdout) VALUES('delete', old.id, old.prompt, old.stdout);
      END;

      CREATE TRIGGER IF NOT EXISTS turns_au AFTER UPDATE ON turns BEGIN
        INSERT INTO turns_fts(turns_fts, rowid, prompt, stdout) VALUES('delete', old.id, old.prompt, old.stdout);
        INSERT INTO turns_fts(rowid, prompt, stdout) VALUES (new.id, new.prompt, new.stdout);
      END;
    `);
  }

  /**
   * Migrate existing JSON files to SQLite
   */
  private migrateFromJson(historyDir: string): void {
    const migrationMarker = join(historyDir, '.migrated');
    if (existsSync(migrationMarker)) {
      return; // Already migrated
    }

    // Find all date directories
    const dateDirs = readdirSync(historyDir).filter(d => {
      const dirPath = join(historyDir, d);
      return statSync(dirPath).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d);
    });

    let migratedCount = 0;

    for (const dateDir of dateDirs) {
      const dirPath = join(historyDir, dateDir);
      const files = readdirSync(dirPath).filter(f => f.endsWith('.json'));

      for (const file of files) {
        try {
          const filePath = join(dirPath, file);
          const data = JSON.parse(readFileSync(filePath, 'utf8'));

          // Convert to conversation record if legacy format
          const conversation = this.normalizeRecord(data);
          this.saveConversation(conversation);
          migratedCount++;

          // Optionally delete the JSON file after migration
          // unlinkSync(filePath);
        } catch (err) {
          console.error(`Failed to migrate ${file}:`, (err as Error).message);
        }
      }
    }

    // Create migration marker
    if (migratedCount > 0) {
      require('fs').writeFileSync(migrationMarker, new Date().toISOString());
      console.log(`[CLI History] Migrated ${migratedCount} records to SQLite`);
    }
  }

  /**
   * Normalize legacy record to ConversationRecord format
   */
  private normalizeRecord(data: any): ConversationRecord {
    if (data.turns && Array.isArray(data.turns)) {
      return data as ConversationRecord;
    }

    // Legacy single execution format
    return {
      id: data.id,
      created_at: data.timestamp,
      updated_at: data.timestamp,
      tool: data.tool,
      model: data.model || 'default',
      mode: data.mode || 'analysis',
      total_duration_ms: data.duration_ms || 0,
      turn_count: 1,
      latest_status: data.status || 'success',
      turns: [{
        turn: 1,
        timestamp: data.timestamp,
        prompt: data.prompt,
        duration_ms: data.duration_ms || 0,
        status: data.status || 'success',
        exit_code: data.exit_code,
        output: data.output || { stdout: '', stderr: '', truncated: false }
      }]
    };
  }

  /**
   * Save or update a conversation
   */
  saveConversation(conversation: ConversationRecord): void {
    const promptPreview = conversation.turns.length > 0
      ? conversation.turns[conversation.turns.length - 1].prompt.substring(0, 100)
      : '';

    const upsertConversation = this.db.prepare(`
      INSERT INTO conversations (id, created_at, updated_at, tool, model, mode, total_duration_ms, turn_count, latest_status, prompt_preview)
      VALUES (@id, @created_at, @updated_at, @tool, @model, @mode, @total_duration_ms, @turn_count, @latest_status, @prompt_preview)
      ON CONFLICT(id) DO UPDATE SET
        updated_at = @updated_at,
        total_duration_ms = @total_duration_ms,
        turn_count = @turn_count,
        latest_status = @latest_status,
        prompt_preview = @prompt_preview
    `);

    const upsertTurn = this.db.prepare(`
      INSERT INTO turns (conversation_id, turn_number, timestamp, prompt, duration_ms, status, exit_code, stdout, stderr, truncated)
      VALUES (@conversation_id, @turn_number, @timestamp, @prompt, @duration_ms, @status, @exit_code, @stdout, @stderr, @truncated)
      ON CONFLICT(conversation_id, turn_number) DO UPDATE SET
        timestamp = @timestamp,
        prompt = @prompt,
        duration_ms = @duration_ms,
        status = @status,
        exit_code = @exit_code,
        stdout = @stdout,
        stderr = @stderr,
        truncated = @truncated
    `);

    const transaction = this.db.transaction(() => {
      upsertConversation.run({
        id: conversation.id,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        tool: conversation.tool,
        model: conversation.model,
        mode: conversation.mode,
        total_duration_ms: conversation.total_duration_ms,
        turn_count: conversation.turn_count,
        latest_status: conversation.latest_status,
        prompt_preview: promptPreview
      });

      for (const turn of conversation.turns) {
        upsertTurn.run({
          conversation_id: conversation.id,
          turn_number: turn.turn,
          timestamp: turn.timestamp,
          prompt: turn.prompt,
          duration_ms: turn.duration_ms,
          status: turn.status,
          exit_code: turn.exit_code,
          stdout: turn.output.stdout,
          stderr: turn.output.stderr,
          truncated: turn.output.truncated ? 1 : 0
        });
      }
    });

    transaction();
  }

  /**
   * Get conversation by ID
   */
  getConversation(id: string): ConversationRecord | null {
    const conv = this.db.prepare(`
      SELECT * FROM conversations WHERE id = ?
    `).get(id) as any;

    if (!conv) return null;

    const turns = this.db.prepare(`
      SELECT * FROM turns WHERE conversation_id = ? ORDER BY turn_number ASC
    `).all(id) as any[];

    return {
      id: conv.id,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      tool: conv.tool,
      model: conv.model,
      mode: conv.mode,
      total_duration_ms: conv.total_duration_ms,
      turn_count: conv.turn_count,
      latest_status: conv.latest_status,
      turns: turns.map(t => ({
        turn: t.turn_number,
        timestamp: t.timestamp,
        prompt: t.prompt,
        duration_ms: t.duration_ms,
        status: t.status,
        exit_code: t.exit_code,
        output: {
          stdout: t.stdout || '',
          stderr: t.stderr || '',
          truncated: !!t.truncated
        }
      }))
    };
  }

  /**
   * Query execution history
   */
  getHistory(options: HistoryQueryOptions = {}): {
    total: number;
    count: number;
    executions: HistoryIndexEntry[];
  } {
    const { limit = 50, offset = 0, tool, status, search, startDate, endDate } = options;

    let whereClause = '1=1';
    const params: any = {};

    if (tool) {
      whereClause += ' AND tool = @tool';
      params.tool = tool;
    }

    if (status) {
      whereClause += ' AND latest_status = @status';
      params.status = status;
    }

    if (startDate) {
      whereClause += ' AND created_at >= @startDate';
      params.startDate = startDate;
    }

    if (endDate) {
      whereClause += ' AND created_at <= @endDate';
      params.endDate = endDate;
    }

    // Full-text search
    let joinClause = '';
    if (search) {
      joinClause = `
        INNER JOIN (
          SELECT DISTINCT conversation_id FROM turns t
          INNER JOIN turns_fts ON turns_fts.rowid = t.id
          WHERE turns_fts MATCH @search
        ) AS matched ON c.id = matched.conversation_id
      `;
      params.search = search;
    }

    const countQuery = this.db.prepare(`
      SELECT COUNT(*) as count FROM conversations c ${joinClause} WHERE ${whereClause}
    `);
    const total = (countQuery.get(params) as any).count;

    const dataQuery = this.db.prepare(`
      SELECT c.* FROM conversations c ${joinClause}
      WHERE ${whereClause}
      ORDER BY c.updated_at DESC
      LIMIT @limit OFFSET @offset
    `);

    const rows = dataQuery.all({ ...params, limit, offset }) as any[];

    return {
      total,
      count: rows.length,
      executions: rows.map(r => ({
        id: r.id,
        timestamp: r.created_at,
        updated_at: r.updated_at,
        tool: r.tool,
        status: r.latest_status,
        duration_ms: r.total_duration_ms,
        turn_count: r.turn_count,
        prompt_preview: r.prompt_preview || ''
      }))
    };
  }

  /**
   * Delete a conversation
   */
  deleteConversation(id: string): { success: boolean; error?: string } {
    try {
      const result = this.db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
      return { success: result.changes > 0 };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Batch delete conversations
   */
  batchDelete(ids: string[]): { success: boolean; deleted: number; errors?: string[] } {
    const deleteStmt = this.db.prepare('DELETE FROM conversations WHERE id = ?');
    const errors: string[] = [];
    let deleted = 0;

    const transaction = this.db.transaction(() => {
      for (const id of ids) {
        try {
          const result = deleteStmt.run(id);
          if (result.changes > 0) deleted++;
        } catch (err) {
          errors.push(`${id}: ${(err as Error).message}`);
        }
      }
    });

    transaction();

    return {
      success: true,
      deleted,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Delete conversations by tool
   */
  deleteByTool(tool: string): { success: boolean; deleted: number } {
    const result = this.db.prepare('DELETE FROM conversations WHERE tool = ?').run(tool);
    return { success: true, deleted: result.changes };
  }

  /**
   * Delete all conversations
   */
  deleteAll(): { success: boolean; deleted: number } {
    const count = (this.db.prepare('SELECT COUNT(*) as c FROM conversations').get() as any).c;
    this.db.prepare('DELETE FROM conversations').run();
    return { success: true, deleted: count };
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    byTool: Record<string, number>;
    byStatus: Record<string, number>;
    totalDuration: number;
  } {
    const total = (this.db.prepare('SELECT COUNT(*) as c FROM conversations').get() as any).c;

    const byToolRows = this.db.prepare(`
      SELECT tool, COUNT(*) as count FROM conversations GROUP BY tool
    `).all() as any[];
    const byTool: Record<string, number> = {};
    for (const row of byToolRows) {
      byTool[row.tool] = row.count;
    }

    const byStatusRows = this.db.prepare(`
      SELECT latest_status, COUNT(*) as count FROM conversations GROUP BY latest_status
    `).all() as any[];
    const byStatus: Record<string, number> = {};
    for (const row of byStatusRows) {
      byStatus[row.latest_status] = row.count;
    }

    const totalDuration = (this.db.prepare(`
      SELECT COALESCE(SUM(total_duration_ms), 0) as total FROM conversations
    `).get() as any).total;

    return { total, byTool, byStatus, totalDuration };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// Singleton instance cache
const storeCache = new Map<string, CliHistoryStore>();

/**
 * Get or create a store instance for a directory
 */
export function getHistoryStore(baseDir: string): CliHistoryStore {
  if (!storeCache.has(baseDir)) {
    storeCache.set(baseDir, new CliHistoryStore(baseDir));
  }
  return storeCache.get(baseDir)!;
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
