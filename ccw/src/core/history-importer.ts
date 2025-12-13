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
   */
  private initSchema(): void {
    this.db.exec(`
      -- Conversations table
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        project_path TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        message_count INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        metadata TEXT
      );

      -- Messages table
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        parent_id TEXT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        model TEXT,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        cwd TEXT,
        git_branch TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      -- Tool calls table
      CREATE TABLE IF NOT EXISTS tool_calls (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        tool_input TEXT,
        tool_result TEXT,
        timestamp TEXT NOT NULL,
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

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_path);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_tool_calls_message ON tool_calls(message_id);
      CREATE INDEX IF NOT EXISTS idx_tool_calls_name ON tool_calls(tool_name);
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
      INSERT INTO conversations (id, session_id, project_path, created_at, updated_at, message_count, metadata)
      VALUES (@id, @session_id, @project_path, @created_at, @updated_at, 1, @metadata)
      ON CONFLICT(id) DO UPDATE SET
        updated_at = @updated_at,
        message_count = message_count + 1
    `);

    const upsertMessage = this.db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, timestamp, cwd)
      VALUES (@id, @conversation_id, 'user', @content, @timestamp, @cwd)
      ON CONFLICT(id) DO NOTHING
    `);

    const insertHash = this.db.prepare(`
      INSERT OR IGNORE INTO message_hashes (hash, message_id, created_at)
      VALUES (@hash, @message_id, @created_at)
    `);

    const transaction = this.db.transaction(() => {
      for (const entry of entries) {
        try {
          const timestamp = new Date(entry.timestamp).toISOString();
          const messageId = `${entry.sessionId}-${entry.timestamp}`;
          const hash = this.generateHash(entry.sessionId, timestamp, entry.display);

          // Check if hash exists
          const existing = this.db.prepare('SELECT message_id FROM message_hashes WHERE hash = ?').get(hash);
          if (existing) {
            result.skipped++;
            continue;
          }

          // Insert conversation
          upsertConversation.run({
            id: entry.sessionId,
            session_id: entry.sessionId,
            project_path: entry.project,
            created_at: timestamp,
            updated_at: timestamp,
            metadata: JSON.stringify({ source: 'global_history' })
          });

          // Insert message
          upsertMessage.run({
            id: messageId,
            conversation_id: entry.sessionId,
            content: entry.display,
            timestamp,
            cwd: entry.project
          });

          // Insert hash
          insertHash.run({
            hash,
            message_id: messageId,
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
      INSERT INTO conversations (id, session_id, project_path, created_at, updated_at, message_count, total_tokens, metadata)
      VALUES (@id, @session_id, @project_path, @created_at, @updated_at, @message_count, @total_tokens, @metadata)
      ON CONFLICT(id) DO UPDATE SET
        updated_at = @updated_at,
        message_count = @message_count,
        total_tokens = @total_tokens
    `);

    const upsertMessage = this.db.prepare(`
      INSERT INTO messages (id, conversation_id, parent_id, role, content, timestamp, model, input_tokens, output_tokens, cwd, git_branch)
      VALUES (@id, @conversation_id, @parent_id, @role, @content, @timestamp, @model, @input_tokens, @output_tokens, @cwd, @git_branch)
      ON CONFLICT(id) DO NOTHING
    `);

    const insertToolCall = this.db.prepare(`
      INSERT INTO tool_calls (id, message_id, tool_name, tool_input, tool_result, timestamp)
      VALUES (@id, @message_id, @tool_name, @tool_input, @tool_result, @timestamp)
      ON CONFLICT(id) DO NOTHING
    `);

    const insertHash = this.db.prepare(`
      INSERT OR IGNORE INTO message_hashes (hash, message_id, created_at)
      VALUES (@hash, @message_id, @created_at)
    `);

    const transaction = this.db.transaction(() => {
      let totalTokens = 0;
      const firstMessage = messages[0];
      const lastMessage = messages[messages.length - 1];

      // Insert conversation FIRST (before messages, for foreign key constraint)
      upsertConversation.run({
        id: sessionId,
        session_id: sessionId,
        project_path: metadata.cwd || null,
        created_at: firstMessage.timestamp,
        updated_at: lastMessage.timestamp,
        message_count: 0,
        total_tokens: 0,
        metadata: JSON.stringify({ ...metadata, source: 'session_file' })
      });

      for (const msg of messages) {
        if (!msg.message) continue;

        try {
          const messageId = msg.uuid || `${sessionId}-${msg.timestamp}`;
          const content = this.extractTextContent(msg.message.content);
          const hash = this.generateHash(sessionId, msg.timestamp, content);

          // Check if hash exists
          const existing = this.db.prepare('SELECT message_id FROM message_hashes WHERE hash = ?').get(hash);
          if (existing) {
            result.skipped++;
            continue;
          }

          // Calculate tokens
          const inputTokens = msg.message.usage?.input_tokens || 0;
          const outputTokens = msg.message.usage?.output_tokens || 0;
          totalTokens += inputTokens + outputTokens;

          // Insert message
          upsertMessage.run({
            id: messageId,
            conversation_id: sessionId,
            parent_id: msg.parentUuid || null,
            role: msg.message.role,
            content,
            timestamp: msg.timestamp,
            model: msg.message.model || null,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cwd: msg.cwd || metadata.cwd || null,
            git_branch: msg.gitBranch || metadata.gitBranch || null
          });

          // Extract and insert tool calls
          const toolCalls = this.extractToolCalls(msg.message.content);
          for (const tool of toolCalls) {
            insertToolCall.run({
              id: tool.id || `${messageId}-${tool.name}`,
              message_id: messageId,
              tool_name: tool.name,
              tool_input: JSON.stringify(tool.input),
              tool_result: tool.result || null,
              timestamp: msg.timestamp
            });
          }

          // Insert hash
          insertHash.run({
            hash,
            message_id: messageId,
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
        session_id: sessionId,
        project_path: metadata.cwd || null,
        created_at: firstMessage.timestamp,
        updated_at: lastMessage.timestamp,
        message_count: result.imported,
        total_tokens: totalTokens,
        metadata: JSON.stringify({ ...metadata, source: 'session_file' })
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
