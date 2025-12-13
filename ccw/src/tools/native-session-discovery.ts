/**
 * Native Session Discovery - Discovers and tracks native CLI tool sessions
 * Supports Gemini, Qwen, and Codex session formats
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, basename, resolve } from 'path';
// basename is used for extracting session ID from filename
import { createHash } from 'crypto';
import { homedir } from 'os';

// Types
export interface NativeSession {
  sessionId: string;           // Native UUID
  tool: string;                // gemini | qwen | codex
  filePath: string;            // Full path to session file
  projectHash?: string;        // Project directory hash (Gemini/Qwen)
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionDiscoveryOptions {
  workingDir?: string;         // Project working directory
  limit?: number;              // Max sessions to return
  afterTimestamp?: Date;       // Only sessions after this time
}

/**
 * Calculate project hash (same algorithm as Gemini/Qwen)
 * Note: Gemini/Qwen use the absolute path AS-IS without normalization
 * On Windows, this means using backslashes and original case
 */
export function calculateProjectHash(projectDir: string): string {
  // resolve() returns absolute path with native separators (backslash on Windows)
  const absolutePath = resolve(projectDir);
  return createHash('sha256').update(absolutePath).digest('hex');
}

/**
 * Get home directory path
 */
function getHomePath(): string {
  return homedir().replace(/\\/g, '/');
}

/**
 * Base session discoverer interface
 */
abstract class SessionDiscoverer {
  abstract tool: string;
  abstract basePath: string;

  /**
   * Get all sessions for a project
   */
  abstract getSessions(options?: SessionDiscoveryOptions): NativeSession[];

  /**
   * Get the latest session
   */
  getLatestSession(options?: SessionDiscoveryOptions): NativeSession | null {
    const sessions = this.getSessions({ ...options, limit: 1 });
    return sessions.length > 0 ? sessions[0] : null;
  }

  /**
   * Find session by ID
   */
  abstract findSessionById(sessionId: string): NativeSession | null;

  /**
   * Track new session created during execution
   */
  async trackNewSession(
    beforeTimestamp: Date,
    workingDir: string
  ): Promise<NativeSession | null> {
    const sessions = this.getSessions({
      workingDir,
      afterTimestamp: beforeTimestamp,
      limit: 1
    });
    return sessions.length > 0 ? sessions[0] : null;
  }
}

/**
 * Gemini Session Discoverer
 * Path: ~/.gemini/tmp/<projectHash>/chats/session-*.json
 */
class GeminiSessionDiscoverer extends SessionDiscoverer {
  tool = 'gemini';
  basePath = join(getHomePath(), '.gemini', 'tmp');

  getSessions(options: SessionDiscoveryOptions = {}): NativeSession[] {
    const { workingDir, limit, afterTimestamp } = options;
    const sessions: NativeSession[] = [];

    try {
      if (!existsSync(this.basePath)) return [];

      // If workingDir provided, only look in that project's folder
      let projectDirs: string[];
      if (workingDir) {
        const projectHash = calculateProjectHash(workingDir);
        const projectPath = join(this.basePath, projectHash);
        projectDirs = existsSync(projectPath) ? [projectHash] : [];
      } else {
        projectDirs = readdirSync(this.basePath).filter(d => {
          const fullPath = join(this.basePath, d);
          return statSync(fullPath).isDirectory();
        });
      }

      for (const projectHash of projectDirs) {
        const chatsDir = join(this.basePath, projectHash, 'chats');
        if (!existsSync(chatsDir)) continue;

        const sessionFiles = readdirSync(chatsDir)
          .filter(f => f.startsWith('session-') && f.endsWith('.json'))
          .map(f => ({
            name: f,
            path: join(chatsDir, f),
            stat: statSync(join(chatsDir, f))
          }))
          .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

        for (const file of sessionFiles) {
          if (afterTimestamp && file.stat.mtime <= afterTimestamp) continue;

          try {
            const content = JSON.parse(readFileSync(file.path, 'utf8'));
            sessions.push({
              sessionId: content.sessionId,
              tool: this.tool,
              filePath: file.path,
              projectHash,
              createdAt: new Date(content.startTime || file.stat.birthtime),
              updatedAt: new Date(content.lastUpdated || file.stat.mtime)
            });
          } catch {
            // Skip invalid files
          }
        }
      }

      // Sort by updatedAt descending
      sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      return limit ? sessions.slice(0, limit) : sessions;
    } catch {
      return [];
    }
  }

  findSessionById(sessionId: string): NativeSession | null {
    const sessions = this.getSessions();
    return sessions.find(s => s.sessionId === sessionId) || null;
  }
}

/**
 * Encode a path to Qwen's project folder name format
 * D:\Claude_dms3 -> D--Claude-dms3
 * Rules: : -> -, \ -> -, _ -> -
 */
function encodeQwenProjectPath(projectDir: string): string {
  const absolutePath = resolve(projectDir);
  // Replace : -> -, \ -> -, _ -> -
  return absolutePath
    .replace(/:/g, '-')
    .replace(/\\/g, '-')
    .replace(/_/g, '-');
}

/**
 * Qwen Session Discoverer
 * New path: ~/.qwen/projects/<path-encoded>/chats/<uuid>.jsonl
 * Old path: ~/.qwen/tmp/<projectHash>/chats/session-*.json (deprecated, fallback)
 */
class QwenSessionDiscoverer extends SessionDiscoverer {
  tool = 'qwen';
  basePath = join(getHomePath(), '.qwen', 'projects');
  legacyBasePath = join(getHomePath(), '.qwen', 'tmp');

  getSessions(options: SessionDiscoveryOptions = {}): NativeSession[] {
    const { workingDir, limit, afterTimestamp } = options;
    const sessions: NativeSession[] = [];

    // Try new format first (projects folder)
    try {
      if (existsSync(this.basePath)) {
        let projectDirs: string[];
        if (workingDir) {
          const encodedPath = encodeQwenProjectPath(workingDir);
          const projectPath = join(this.basePath, encodedPath);
          projectDirs = existsSync(projectPath) ? [encodedPath] : [];
        } else {
          projectDirs = readdirSync(this.basePath).filter(d => {
            const fullPath = join(this.basePath, d);
            return statSync(fullPath).isDirectory();
          });
        }

        for (const projectFolder of projectDirs) {
          const chatsDir = join(this.basePath, projectFolder, 'chats');
          if (!existsSync(chatsDir)) continue;

          // New format: <uuid>.jsonl files
          const sessionFiles = readdirSync(chatsDir)
            .filter(f => f.endsWith('.jsonl'))
            .map(f => ({
              name: f,
              path: join(chatsDir, f),
              stat: statSync(join(chatsDir, f))
            }))
            .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

          for (const file of sessionFiles) {
            if (afterTimestamp && file.stat.mtime <= afterTimestamp) continue;

            try {
              // Parse JSONL - read first line for session info
              const content = readFileSync(file.path, 'utf8');
              const firstLine = content.split('\n')[0];
              const firstEntry = JSON.parse(firstLine);

              // Session ID is in the filename or first entry
              const sessionId = firstEntry.sessionId || basename(file.name, '.jsonl');

              // Find timestamp from entries
              let createdAt = file.stat.birthtime;
              let updatedAt = file.stat.mtime;

              if (firstEntry.timestamp) {
                createdAt = new Date(firstEntry.timestamp);
              }

              // Get last entry for updatedAt
              const lines = content.trim().split('\n').filter(l => l.trim());
              if (lines.length > 0) {
                try {
                  const lastEntry = JSON.parse(lines[lines.length - 1]);
                  if (lastEntry.timestamp) {
                    updatedAt = new Date(lastEntry.timestamp);
                  }
                } catch { /* ignore */ }
              }

              sessions.push({
                sessionId,
                tool: this.tool,
                filePath: file.path,
                projectHash: projectFolder, // Using encoded path as project identifier
                createdAt,
                updatedAt
              });
            } catch {
              // Skip invalid files
            }
          }
        }
      }
    } catch { /* ignore errors */ }

    // Fallback to legacy format (tmp folder with hash)
    try {
      if (existsSync(this.legacyBasePath)) {
        let projectDirs: string[];
        if (workingDir) {
          const projectHash = calculateProjectHash(workingDir);
          const projectPath = join(this.legacyBasePath, projectHash);
          projectDirs = existsSync(projectPath) ? [projectHash] : [];
        } else {
          projectDirs = readdirSync(this.legacyBasePath).filter(d => {
            const fullPath = join(this.legacyBasePath, d);
            return statSync(fullPath).isDirectory();
          });
        }

        for (const projectHash of projectDirs) {
          const chatsDir = join(this.legacyBasePath, projectHash, 'chats');
          if (!existsSync(chatsDir)) continue;

          const sessionFiles = readdirSync(chatsDir)
            .filter(f => f.startsWith('session-') && f.endsWith('.json'))
            .map(f => ({
              name: f,
              path: join(chatsDir, f),
              stat: statSync(join(chatsDir, f))
            }))
            .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

          for (const file of sessionFiles) {
            if (afterTimestamp && file.stat.mtime <= afterTimestamp) continue;

            try {
              const content = JSON.parse(readFileSync(file.path, 'utf8'));
              sessions.push({
                sessionId: content.sessionId,
                tool: this.tool,
                filePath: file.path,
                projectHash,
                createdAt: new Date(content.startTime || file.stat.birthtime),
                updatedAt: new Date(content.lastUpdated || file.stat.mtime)
              });
            } catch {
              // Skip invalid files
            }
          }
        }
      }
    } catch { /* ignore errors */ }

    // Sort by updatedAt descending and dedupe by sessionId
    sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    // Dedupe (new format takes precedence as it's checked first)
    const seen = new Set<string>();
    const uniqueSessions = sessions.filter(s => {
      if (seen.has(s.sessionId)) return false;
      seen.add(s.sessionId);
      return true;
    });

    return limit ? uniqueSessions.slice(0, limit) : uniqueSessions;
  }

  findSessionById(sessionId: string): NativeSession | null {
    const sessions = this.getSessions();
    return sessions.find(s => s.sessionId === sessionId) || null;
  }
}

/**
 * Codex Session Discoverer
 * Path: ~/.codex/sessions/YYYY/MM/DD/rollout-*-<uuid>.jsonl
 */
class CodexSessionDiscoverer extends SessionDiscoverer {
  tool = 'codex';
  basePath = join(getHomePath(), '.codex', 'sessions');

  getSessions(options: SessionDiscoveryOptions = {}): NativeSession[] {
    const { limit, afterTimestamp } = options;
    const sessions: NativeSession[] = [];

    try {
      if (!existsSync(this.basePath)) return [];

      // Get year directories (e.g., 2025)
      const yearDirs = readdirSync(this.basePath)
        .filter(d => /^\d{4}$/.test(d))
        .sort((a, b) => b.localeCompare(a)); // Descending

      for (const year of yearDirs) {
        const yearPath = join(this.basePath, year);
        if (!statSync(yearPath).isDirectory()) continue;

        // Get month directories
        const monthDirs = readdirSync(yearPath)
          .filter(d => /^\d{2}$/.test(d))
          .sort((a, b) => b.localeCompare(a));

        for (const month of monthDirs) {
          const monthPath = join(yearPath, month);
          if (!statSync(monthPath).isDirectory()) continue;

          // Get day directories
          const dayDirs = readdirSync(monthPath)
            .filter(d => /^\d{2}$/.test(d))
            .sort((a, b) => b.localeCompare(a));

          for (const day of dayDirs) {
            const dayPath = join(monthPath, day);
            if (!statSync(dayPath).isDirectory()) continue;

            // Get session files
            const sessionFiles = readdirSync(dayPath)
              .filter(f => f.startsWith('rollout-') && f.endsWith('.jsonl'))
              .map(f => ({
                name: f,
                path: join(dayPath, f),
                stat: statSync(join(dayPath, f))
              }))
              .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

            for (const file of sessionFiles) {
              if (afterTimestamp && file.stat.mtime <= afterTimestamp) continue;

              try {
                // Parse first line for session_meta
                const firstLine = readFileSync(file.path, 'utf8').split('\n')[0];
                const meta = JSON.parse(firstLine);

                if (meta.type === 'session_meta' && meta.payload?.id) {
                  sessions.push({
                    sessionId: meta.payload.id,
                    tool: this.tool,
                    filePath: file.path,
                    createdAt: new Date(meta.payload.timestamp || file.stat.birthtime),
                    updatedAt: file.stat.mtime
                  });
                }
              } catch {
                // Try extracting UUID from filename
                const uuidMatch = file.name.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i);
                if (uuidMatch) {
                  sessions.push({
                    sessionId: uuidMatch[1],
                    tool: this.tool,
                    filePath: file.path,
                    createdAt: file.stat.birthtime,
                    updatedAt: file.stat.mtime
                  });
                }
              }
            }
          }
        }
      }

      sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      return limit ? sessions.slice(0, limit) : sessions;
    } catch {
      return [];
    }
  }

  findSessionById(sessionId: string): NativeSession | null {
    const sessions = this.getSessions();
    return sessions.find(s => s.sessionId === sessionId) || null;
  }
}

/**
 * Claude Code Session Discoverer
 * Path: ~/.claude/projects/<projectHash>/sessions/*.jsonl
 * Claude Code stores sessions with UUID-based session IDs
 */
class ClaudeSessionDiscoverer extends SessionDiscoverer {
  tool = 'claude';
  basePath = join(getHomePath(), '.claude', 'projects');

  getSessions(options: SessionDiscoveryOptions = {}): NativeSession[] {
    const { workingDir, limit, afterTimestamp } = options;
    const sessions: NativeSession[] = [];

    try {
      if (!existsSync(this.basePath)) return [];

      // If workingDir provided, only look in that project's folder
      let projectDirs: string[];
      if (workingDir) {
        const projectHash = calculateProjectHash(workingDir);
        const projectPath = join(this.basePath, projectHash);
        projectDirs = existsSync(projectPath) ? [projectHash] : [];
      } else {
        projectDirs = readdirSync(this.basePath).filter(d => {
          const fullPath = join(this.basePath, d);
          return statSync(fullPath).isDirectory();
        });
      }

      for (const projectHash of projectDirs) {
        const sessionsDir = join(this.basePath, projectHash, 'sessions');
        if (!existsSync(sessionsDir)) continue;

        const sessionFiles = readdirSync(sessionsDir)
          .filter(f => f.endsWith('.jsonl') || f.endsWith('.json'))
          .map(f => ({
            name: f,
            path: join(sessionsDir, f),
            stat: statSync(join(sessionsDir, f))
          }))
          .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

        for (const file of sessionFiles) {
          if (afterTimestamp && file.stat.mtime <= afterTimestamp) continue;

          try {
            // Extract session ID from filename or content
            const uuidMatch = file.name.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
            if (uuidMatch) {
              sessions.push({
                sessionId: uuidMatch[1],
                tool: this.tool,
                filePath: file.path,
                projectHash,
                createdAt: file.stat.birthtime,
                updatedAt: file.stat.mtime
              });
            } else {
              // Try reading first line for session metadata
              const firstLine = readFileSync(file.path, 'utf8').split('\n')[0];
              const meta = JSON.parse(firstLine);
              if (meta.session_id) {
                sessions.push({
                  sessionId: meta.session_id,
                  tool: this.tool,
                  filePath: file.path,
                  projectHash,
                  createdAt: new Date(meta.timestamp || file.stat.birthtime),
                  updatedAt: file.stat.mtime
                });
              }
            }
          } catch {
            // Skip invalid files
          }
        }
      }

      sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      return limit ? sessions.slice(0, limit) : sessions;
    } catch {
      return [];
    }
  }

  findSessionById(sessionId: string): NativeSession | null {
    const sessions = this.getSessions();
    return sessions.find(s => s.sessionId === sessionId) || null;
  }
}

// Singleton discoverers
const discoverers: Record<string, SessionDiscoverer> = {
  gemini: new GeminiSessionDiscoverer(),
  qwen: new QwenSessionDiscoverer(),
  codex: new CodexSessionDiscoverer(),
  claude: new ClaudeSessionDiscoverer()
};

/**
 * Get session discoverer for a tool
 */
export function getDiscoverer(tool: string): SessionDiscoverer | null {
  return discoverers[tool] || null;
}

/**
 * Get latest native session for a tool
 */
export function getLatestNativeSession(
  tool: string,
  workingDir?: string
): NativeSession | null {
  const discoverer = discoverers[tool];
  if (!discoverer) return null;
  return discoverer.getLatestSession({ workingDir });
}

/**
 * Find native session by ID
 */
export function findNativeSessionById(
  tool: string,
  sessionId: string
): NativeSession | null {
  const discoverer = discoverers[tool];
  if (!discoverer) return null;
  return discoverer.findSessionById(sessionId);
}

/**
 * Track new session created during execution
 */
export async function trackNewSession(
  tool: string,
  beforeTimestamp: Date,
  workingDir: string
): Promise<NativeSession | null> {
  const discoverer = discoverers[tool];
  if (!discoverer) return null;
  return discoverer.trackNewSession(beforeTimestamp, workingDir);
}

/**
 * Get all sessions for a tool
 */
export function getNativeSessions(
  tool: string,
  options?: SessionDiscoveryOptions
): NativeSession[] {
  const discoverer = discoverers[tool];
  if (!discoverer) return [];
  return discoverer.getSessions(options);
}

/**
 * Check if a tool supports native resume
 */
export function supportsNativeResume(tool: string): boolean {
  return tool in discoverers;
}

/**
 * Get native resume command arguments for a tool
 */
export function getNativeResumeArgs(
  tool: string,
  sessionId: string | 'latest'
): string[] {
  switch (tool) {
    case 'gemini':
      // gemini -r <uuid> or -r latest
      return ['-r', sessionId];

    case 'qwen':
      // qwen --continue (latest) or --resume <uuid>
      if (sessionId === 'latest') {
        return ['--continue'];
      }
      return ['--resume', sessionId];

    case 'codex':
      // codex resume <uuid> or codex resume --last
      if (sessionId === 'latest') {
        return ['resume', '--last'];
      }
      return ['resume', sessionId];

    default:
      return [];
  }
}

/**
 * Get base path for a tool's sessions
 */
export function getToolSessionPath(tool: string): string | null {
  const discoverer = discoverers[tool];
  return discoverer?.basePath || null;
}
