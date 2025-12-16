/**
 * History Importer - Import Claude Code history into memory store
 * Supports global history.jsonl and project session JSONL files
 *
 * Usage:
 * ```typescript
 * const importer = new HistoryImporter('path/to/database.db');
 *
 * // Import global history (incremental)
 * const globalResult = await importer.importGlobalHistory();
 * console.log(`Imported ${globalResult.imported} entries`);
 *
 * // Import all sessions for a project
 * const projectResult = await importer.importProjectSessions('D--Claude-dms3');
 * console.log(`Imported ${projectResult.imported} messages from project sessions`);
 *
 * // Import specific session
 * const sessionResult = await importer.importSession('path/to/session.jsonl');
 *
 * // Get import status
 * const status = importer.getImportStatus();
 * console.log(`Total imported: ${status.totalImported}`);
 *
 * importer.close();
 * ```
 */

import { createReadStream, existsSync, readdirSync, statSync } from 'fs';
import { createInterface } from 'readline';
import { join, basename } from 'path';
import { createHash } from 'crypto';
import Database from 'better-sqlite3';

// Type definitions
interface GlobalHistoryEntry {
  display: string;
  pastedContents: object;
  timestamp: number;
  project: string;
  sessionId: string;
}

interface SessionEntry {
  type: 'user' | 'assistant' | 'file-history-snapshot';
  message?: {
    role: 'user' | 'assistant';
    content: string | ContentBlock[];
    model?: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  sessionId: string;
  timestamp: string;
  cwd?: string;
  gitBranch?: string;
  todos?: any[];
  uuid?: string;
  parentUuid?: string;
}

interface ContentBlock {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result';
  text?: string;
  thinking?: string;
  name?: string;
  input?: object;
  content?: string;
  id?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
}

export interface ImportStatus {
  lastGlobalImport?: string;
  lastSessionImport?: string;
  totalImported: number;
  sessions: Map<string, { imported: number; lastUpdate: string }>;
}

/**
 * History Importer for Claude Code
 */
export class HistoryImporter {
  private db: Database.Database;
  private status: ImportStatus;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.status = {
      totalImported: 0,
      sessions: new Map()
    };
    this.initSchema();
  }

  /**
   * Initialize database schema for conversation history
   * NOTE: Schema aligned with MemoryStore for seamless importing
   */
  private initSchema(): void {
    this.db.exec(`
      -- Conversations table (aligned with MemoryStore schema)
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        source TEXT DEFAULT 'ccw',
        external_id TEXT,
        project_name TEXT,
        git_branch TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        quality_score INTEGER,
        turn_count INTEGER DEFAULT 0,
        prompt_preview TEXT
      );

      -- Messages table (aligned with MemoryStore schema)
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content_text TEXT,
        content_json TEXT,
        timestamp TEXT NOT NULL,
        token_count INTEGER,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      -- Tool calls table (aligned with MemoryStore schema)
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

      -- Import tracking table
      CREATE TABLE IF NOT EXISTS import_metadata (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT
      );

      -- Deduplication table (hash-based)
      CREATE TABLE IF NOT EXISTS message_hashes (
        hash TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      -- Indexes (aligned with MemoryStore)
      CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_tool_calls_message ON tool_calls(message_id);
    `);
  }

  /**
   * Import from global history.jsonl (incremental)
   */
  async importGlobalHistory(historyPath?: string): Promise<ImportResult> {
    const path = historyPath || join(process.env.USERPROFILE || process.env.HOME || '', '.claude', 'history.jsonl');

    if (!existsSync(path)) {
      return { imported: 0, skipped: 0, errors: 0 };
    }

    const result: ImportResult = { imported: 0, skipped: 0, errors: 0 };
    const lastImportTime = this.getLastImportTime('global_history');

    const fileStream = createReadStream(path, { encoding: 'utf8' });
    const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

    const batch: GlobalHistoryEntry[] = [];
    const BATCH_SIZE = 100;

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const entry: GlobalHistoryEntry = JSON.parse(line);

        // Skip if already imported
        if (lastImportTime && entry.timestamp <= new Date(lastImportTime).getTime()) {
          result.skipped++;
          continue;
        }

        batch.push(entry);

        if (batch.length >= BATCH_SIZE) {
          const batchResult = this.insertGlobalHistoryBatch(batch);
          result.imported += batchResult.imported;
          result.skipped += batchResult.skipped;
          result.errors += batchResult.errors;
          batch.length = 0;
        }
      } catch (err) {
        result.errors++;
        console.error(`Failed to parse line: ${(err as Error).message}`);
      }
    }

    // Process remaining batch
    if (batch.length > 0) {
      const batchResult = this.insertGlobalHistoryBatch(batch);
      result.imported += batchResult.imported;
      result.skipped += batchResult.skipped;
      result.errors += batchResult.errors;
    }

    if (result.imported > 0) {
      this.updateLastImportTime('global_history');
    }

    this.status.lastGlobalImport = new Date().toISOString();
    this.status.totalImported += result.imported;

    return result;
  }

  /**
   * Import full session from projects folder
   */
  async importSession(sessionFilePath: string): Promise<ImportResult> {
    if (!existsSync(sessionFilePath)) {
      return { imported: 0, skipped: 0, errors: 0 };
    }

    const result: ImportResult = { imported: 0, skipped: 0, errors: 0 };
    const sessionId = basename(sessionFilePath, '.jsonl');

    const fileStream = createReadStream(sessionFilePath, { encoding: 'utf8' });
    const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

    const messages: SessionEntry[] = [];
    let conversationMetadata: any = {};

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const entry: SessionEntry = JSON.parse(line);

        if (entry.type === 'user' || entry.type === 'assistant') {
          messages.push(entry);

          // Extract metadata from first message
          if (messages.length === 1) {
            conversationMetadata = {
              sessionId: entry.sessionId,
              cwd: entry.cwd,
              gitBranch: entry.gitBranch
            };
          }
        }
      } catch (err) {
        result.errors++;
        console.error(`Failed to parse session line: ${(err as Error).message}`);
      }
    }

    if (messages.length > 0) {
      const importResult = this.insertSessionMessages(sessionId, messages, conversationMetadata);
      result.imported = importResult.imported;
      result.skipped = importResult.skipped;
      result.errors += importResult.errors;
    }

    this.status.lastSessionImport = new Date().toISOString();
    this.status.totalImported += result.imported;
    this.status.sessions.set(sessionId, {
      imported: result.imported,
      lastUpdate: new Date().toISOString()
    });

    return result;
  }

  /**
   * Scan and import all sessions for a project
   */
  async importProjectSessions(projectName: string): Promise<ImportResult> {
    const projectsDir = join(process.env.USERPROFILE || process.env.HOME || '', '.claude', 'projects');
    const projectDir = join(projectsDir, projectName);

    if (!existsSync(projectDir)) {
      return { imported: 0, skipped: 0, errors: 0 };
    }

    const result: ImportResult = { imported: 0, skipped: 0, errors: 0 };
    const sessionFiles = readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));

    for (const sessionFile of sessionFiles) {
      const sessionPath = join(projectDir, sessionFile);
      const sessionResult = await this.importSession(sessionPath);

      result.imported += sessionResult.imported;
      result.skipped += sessionResult.skipped;
      result.errors += sessionResult.errors;
    }

    return result;
  }

  /**
   * Get import status
   */
  getImportStatus(): ImportStatus {
    return { ...this.status };
  }

  /**
   * Insert global history batch
   */
  private insertGlobalHistoryBatch(entries: GlobalHistoryEntry[]): ImportResult {
    const result: ImportResult = { imported: 0, skipped: 0, errors: 0 };

    const upsertConversation = this.db.prepare(`
      INSERT INTO conversations (id, source, external_id, project_name, created_at, updated_at, turn_count, prompt_preview)
      VALUES (@id, @source, @external_id, @project_name, @created_at, @updated_at, 1, @prompt_preview)
      ON CONFLICT(id) DO UPDATE SET
        updated_at = @updated_at,
        turn_count = turn_count + 1,
        prompt_preview = @prompt_preview
    `);

    const upsertMessage = this.db.prepare(`
      INSERT INTO messages (conversation_id, role, content_text, timestamp)
      VALUES (@conversation_id, 'user', @content_text, @timestamp)
    `);

    const insertHash = this.db.prepare(`
      INSERT OR IGNORE INTO message_hashes (hash, message_id, created_at)
      VALUES (@hash, @message_id, @created_at)
    `);

    const transaction = this.db.transaction(() => {
      for (const entry of entries) {
        try {
          const timestamp = new Date(entry.timestamp).toISOString();
          const hash = this.generateHash(entry.sessionId, timestamp, entry.display);

          // Check if hash exists
          const existing = this.db.prepare('SELECT message_id FROM message_hashes WHERE hash = ?').get(hash);
          if (existing) {
            result.skipped++;
            continue;
          }

          // Insert conversation (using MemoryStore-compatible fields)
          upsertConversation.run({
            id: entry.sessionId,
            source: 'global_history',
            external_id: entry.sessionId,
            project_name: entry.project,
            created_at: timestamp,
            updated_at: timestamp,
            prompt_preview: entry.display.substring(0, 100)
          });

          // Insert message (using MemoryStore-compatible fields)
          const insertResult = upsertMessage.run({
            conversation_id: entry.sessionId,
            content_text: entry.display,
            timestamp
          });

          // Insert hash (using actual message ID from insert)
          insertHash.run({
            hash,
            message_id: String(insertResult.lastInsertRowid),
            created_at: timestamp
          });

          result.imported++;
        } catch (err) {
          result.errors++;
          console.error(`Failed to insert entry: ${(err as Error).message}`);
        }
      }
    });

    transaction();
    return result;
  }

  /**
   * Insert session messages
   */
  private insertSessionMessages(
    sessionId: string,
    messages: SessionEntry[],
    metadata: any
  ): ImportResult {
    const result: ImportResult = { imported: 0, skipped: 0, errors: 0 };

    const upsertConversation = this.db.prepare(`
      INSERT INTO conversations (id, source, external_id, project_name, git_branch, created_at, updated_at, turn_count, prompt_preview)
      VALUES (@id, @source, @external_id, @project_name, @git_branch, @created_at, @updated_at, @turn_count, @prompt_preview)
      ON CONFLICT(id) DO UPDATE SET
        updated_at = @updated_at,
        turn_count = @turn_count,
        prompt_preview = @prompt_preview
    `);

    const upsertMessage = this.db.prepare(`
      INSERT INTO messages (conversation_id, role, content_text, content_json, timestamp, token_count)
      VALUES (@conversation_id, @role, @content_text, @content_json, @timestamp, @token_count)
    `);

    const insertToolCall = this.db.prepare(`
      INSERT INTO tool_calls (message_id, tool_name, tool_args, tool_output, status)
      VALUES (@message_id, @tool_name, @tool_args, @tool_output, @status)
    `);

    const insertHash = this.db.prepare(`
      INSERT OR IGNORE INTO message_hashes (hash, message_id, created_at)
      VALUES (@hash, @message_id, @created_at)
    `);

    const transaction = this.db.transaction(() => {
      const firstMessage = messages[0];
      const lastMessage = messages[messages.length - 1];
      const promptPreview = firstMessage?.message
        ? this.extractTextContent(firstMessage.message.content).substring(0, 100)
        : '';

      // Insert conversation FIRST (before messages, for foreign key constraint)
      upsertConversation.run({
        id: sessionId,
        source: 'session_file',
        external_id: sessionId,
        project_name: metadata.cwd || null,
        git_branch: metadata.gitBranch || null,
        created_at: firstMessage.timestamp,
        updated_at: lastMessage.timestamp,
        turn_count: 0,
        prompt_preview: promptPreview
      });

      for (const msg of messages) {
        if (!msg.message) continue;

        try {
          const content = this.extractTextContent(msg.message.content);
          const hash = this.generateHash(sessionId, msg.timestamp, content);

          // Check if hash exists
          const existing = this.db.prepare('SELECT message_id FROM message_hashes WHERE hash = ?').get(hash);
          if (existing) {
            result.skipped++;
            continue;
          }

          // Calculate total tokens
          const inputTokens = msg.message.usage?.input_tokens || 0;
          const outputTokens = msg.message.usage?.output_tokens || 0;
          const totalTokens = inputTokens + outputTokens;

          // Store content as JSON if complex, otherwise as text
          const contentJson = typeof msg.message.content === 'object'
            ? JSON.stringify(msg.message.content)
            : null;

          // Insert message (using MemoryStore-compatible fields)
          const insertResult = upsertMessage.run({
            conversation_id: sessionId,
            role: msg.message.role,
            content_text: content,
            content_json: contentJson,
            timestamp: msg.timestamp,
            token_count: totalTokens
          });

          const messageId = insertResult.lastInsertRowid as number;

          // Extract and insert tool calls
          const toolCalls = this.extractToolCalls(msg.message.content);
          for (const tool of toolCalls) {
            insertToolCall.run({
              message_id: messageId,
              tool_name: tool.name,
              tool_args: JSON.stringify(tool.input),
              tool_output: tool.result || null,
              status: 'success'
            });
          }

          // Insert hash (using actual message ID from insert)
          insertHash.run({
            hash,
            message_id: String(messageId),
            created_at: msg.timestamp
          });

          result.imported++;
        } catch (err) {
          result.errors++;
          console.error(`Failed to insert message: ${(err as Error).message}`);
        }
      }

      // Update conversation with final counts
      upsertConversation.run({
        id: sessionId,
        source: 'session_file',
        external_id: sessionId,
        project_name: metadata.cwd || null,
        git_branch: metadata.gitBranch || null,
        created_at: firstMessage.timestamp,
        updated_at: lastMessage.timestamp,
        turn_count: result.imported,
        prompt_preview: promptPreview
      });
    });

    transaction();
    return result;
  }

  /**
   * Extract text content from message content
   */
  private extractTextContent(content: string | ContentBlock[]): string {
    if (typeof content === 'string') {
      return content;
    }

    return content
      .filter(block => block.type === 'text' || block.type === 'thinking')
      .map(block => block.text || block.thinking || '')
      .join('\n\n');
  }

  /**
   * Extract tool calls from content blocks
   */
  private extractToolCalls(content: string | ContentBlock[]): Array<{
    id?: string;
    name: string;
    input?: object;
    result?: string;
  }> {
    if (typeof content === 'string') {
      return [];
    }

    const toolCalls: Array<{ id?: string; name: string; input?: object; result?: string }> = [];
    const toolResultMap = new Map<string, string>();

    // First pass: collect tool results
    for (const block of content) {
      if (block.type === 'tool_result' && block.id) {
        toolResultMap.set(block.id, block.content || '');
      }
    }

    // Second pass: collect tool uses with their results
    for (const block of content) {
      if (block.type === 'tool_use' && block.name) {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input,
          result: block.id ? toolResultMap.get(block.id) : undefined
        });
      }
    }

    return toolCalls;
  }

  /**
   * Generate SHA256 hash for deduplication
   */
  private generateHash(sessionId: string, timestamp: string, content: string): string {
    const data = `${sessionId}:${timestamp}:${content}`;
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get last import time for a source
   */
  private getLastImportTime(source: string): string | null {
    const result = this.db.prepare('SELECT value FROM import_metadata WHERE key = ?').get(source) as any;
    return result?.value || null;
  }

  /**
   * Update last import time
   */
  private updateLastImportTime(source: string): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO import_metadata (key, value, updated_at)
      VALUES (@key, @value, @updated_at)
      ON CONFLICT(key) DO UPDATE SET value = @value, updated_at = @updated_at
    `).run({
      key: source,
      value: now,
      updated_at: now
    });
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
