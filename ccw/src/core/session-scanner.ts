import { glob } from 'glob';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import type { SessionMetadata, SessionType } from '../types/session.js';

interface SessionData extends SessionMetadata {
  path: string;
  isActive: boolean;
  archived_at?: string | null;
  workflow_type?: string | null;
}

interface ScanSessionsResult {
  active: SessionData[];
  archived: SessionData[];
  hasReviewData: boolean;
}

/**
 * Scan .workflow directory for active and archived sessions
 * @param workflowDir - Path to .workflow directory
 * @returns Active and archived sessions
 */
export async function scanSessions(workflowDir: string): Promise<ScanSessionsResult> {
  const result: ScanSessionsResult = {
    active: [],
    archived: [],
    hasReviewData: false
  };

  if (!existsSync(workflowDir)) {
    return result;
  }

  // Scan active sessions
  const activeDir = join(workflowDir, 'active');
  if (existsSync(activeDir)) {
    const activeSessions = await findWfsSessions(activeDir);
    for (const sessionName of activeSessions) {
      const sessionPath = join(activeDir, sessionName);
      const sessionData = readSessionData(sessionPath);
      if (sessionData) {
        result.active.push({
          ...sessionData,
          path: sessionPath,
          isActive: true
        });
        // Check for review data
        if (existsSync(join(sessionPath, '.review'))) {
          result.hasReviewData = true;
        }
      }
    }
  }

  // Scan archived sessions
  const archivesDir = join(workflowDir, 'archives');
  if (existsSync(archivesDir)) {
    const archivedSessions = await findWfsSessions(archivesDir);
    for (const sessionName of archivedSessions) {
      const sessionPath = join(archivesDir, sessionName);
      const sessionData = readSessionData(sessionPath);
      if (sessionData) {
        result.archived.push({
          ...sessionData,
          path: sessionPath,
          isActive: false
        });
      }
    }
  }

  // Sort by creation date (newest first)
  result.active.sort((a, b) => new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime());
  result.archived.sort((a, b) => {
    const aDate = a.archived_at || a.created || 0;
    const bDate = b.archived_at || b.created || 0;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  return result;
}

/**
 * Find WFS-* directories in a given path
 * @param dir - Directory to search
 * @returns Array of session directory names
 */
async function findWfsSessions(dir: string): Promise<string[]> {
  try {
    // Use glob for cross-platform pattern matching
    const sessions = await glob('WFS-*/', {
      cwd: dir,
      absolute: false
    });
    // Remove trailing slashes from directory names
    return sessions.map(s => s.replace(/\/$/, ''));
  } catch {
    // Fallback: manual directory listing
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      return entries
        .filter(e => e.isDirectory() && e.name.startsWith('WFS-'))
        .map(e => e.name);
    } catch {
      return [];
    }
  }
}

/**
 * Parse timestamp from session name
 * Supports formats: WFS-xxx-20251128172537 or WFS-xxx-20251120-170640
 * @param sessionName - Session directory name
 * @returns ISO date string or null
 */
function parseTimestampFromName(sessionName: string): string | null {
  // Format: 14-digit timestamp (YYYYMMDDHHmmss)
  const match14 = sessionName.match(/(\d{14})$/);
  if (match14) {
    const ts = match14[1];
    return `${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)}T${ts.slice(8,10)}:${ts.slice(10,12)}:${ts.slice(12,14)}Z`;
  }

  // Format: 8-digit date + 6-digit time separated by hyphen (YYYYMMDD-HHmmss)
  const match8_6 = sessionName.match(/(\d{8})-(\d{6})$/);
  if (match8_6) {
    const d = match8_6[1];
    const t = match8_6[2];
    return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T${t.slice(0,2)}:${t.slice(2,4)}:${t.slice(4,6)}Z`;
  }

  return null;
}

/**
 * Infer session type from session name pattern
 * @param sessionName - Session directory name
 * @returns Inferred type
 */
function inferTypeFromName(sessionName: string): SessionType {
  const name = sessionName.toLowerCase();

  if (name.includes('-review-') || name.includes('-code-review-')) {
    return 'review';
  }
  if (name.includes('-test-')) {
    return 'test';
  }
  if (name.includes('-docs-')) {
    return 'docs';
  }
  if (name.includes('-tdd-')) {
    return 'tdd';
  }

  return 'workflow';
}

/**
 * Read session data from workflow-session.json or create minimal from directory
 * @param sessionPath - Path to session directory
 * @returns Session data object or null if invalid
 */
function readSessionData(sessionPath: string): SessionData | null {
  const sessionFile = join(sessionPath, 'workflow-session.json');
  const sessionName = basename(sessionPath);

  if (existsSync(sessionFile)) {
    try {
      const data = JSON.parse(readFileSync(sessionFile, 'utf8')) as Record<string, unknown>;

      // Multi-level type detection: JSON type > workflow_type > infer from name
      let type = (data.type as SessionType) || (data.workflow_type as SessionType) || inferTypeFromName(sessionName);

      // Normalize workflow_type values
      if (type === 'test_session' as SessionType) type = 'test';
      if (type === 'implementation' as SessionType) type = 'workflow';

      return {
        id: (data.session_id as string) || sessionName,
        type,
        status: (data.status as 'active' | 'paused' | 'completed' | 'archived') || 'active',
        project: (data.project as string) || (data.description as string) || '',
        description: (data.description as string) || (data.project as string) || '',
        created: (data.created_at as string) || (data.initialized_at as string) || (data.timestamp as string) || '',
        updated: (data.updated_at as string) || (data.created_at as string) || '',
        path: sessionPath,
        isActive: true,
        archived_at: (data.archived_at as string) || null,
        workflow_type: (data.workflow_type as string) || null  // Keep original for reference
      };
    } catch {
      // Fall through to minimal session
    }
  }

  // Fallback: create minimal session from directory info
  // Try to extract timestamp from session name first
  const timestampFromName = parseTimestampFromName(sessionName);
  const inferredType = inferTypeFromName(sessionName);

  try {
    const stats = statSync(sessionPath);
    const createdAt = timestampFromName || stats.birthtime.toISOString();
    return {
      id: sessionName,
      type: inferredType,
      status: 'active',
      project: '',
      description: '',
      created: createdAt,
      updated: createdAt,
      path: sessionPath,
      isActive: true,
      archived_at: null,
      workflow_type: null
    };
  } catch {
    // Even if stat fails, return with name-extracted data
    if (timestampFromName) {
      return {
        id: sessionName,
        type: inferredType,
        status: 'active',
        project: '',
        description: '',
        created: timestampFromName,
        updated: timestampFromName,
        path: sessionPath,
        isActive: true,
        archived_at: null,
        workflow_type: null
      };
    }
    return null;
  }
}

/**
 * Check if session has review data
 * @param sessionPath - Path to session directory
 * @returns True if review data exists
 */
export function hasReviewData(sessionPath: string): boolean {
  const reviewDir = join(sessionPath, '.review');
  return existsSync(reviewDir);
}

/**
 * Get list of task files in session
 * @param sessionPath - Path to session directory
 * @returns Array of task file names
 */
export async function getTaskFiles(sessionPath: string): Promise<string[]> {
  const taskDir = join(sessionPath, '.task');
  if (!existsSync(taskDir)) {
    return [];
  }

  try {
    return await glob('IMPL-*.json', { cwd: taskDir, absolute: false });
  } catch {
    return [];
  }
}
