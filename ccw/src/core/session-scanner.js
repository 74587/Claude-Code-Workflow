import { glob } from 'glob';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, basename } from 'path';

/**
 * Scan .workflow directory for active and archived sessions
 * @param {string} workflowDir - Path to .workflow directory
 * @returns {Promise<{active: Array, archived: Array, hasReviewData: boolean}>}
 */
export async function scanSessions(workflowDir) {
  const result = {
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
  result.active.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  result.archived.sort((a, b) => new Date(b.archived_at || b.created_at || 0) - new Date(a.archived_at || a.created_at || 0));

  return result;
}

/**
 * Find WFS-* directories in a given path
 * @param {string} dir - Directory to search
 * @returns {Promise<string[]>} - Array of session directory names
 */
async function findWfsSessions(dir) {
  try {
    // Use glob for cross-platform pattern matching
    const sessions = await glob('WFS-*', {
      cwd: dir,
      onlyDirectories: true,
      absolute: false
    });
    return sessions;
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
 * @param {string} sessionName - Session directory name
 * @returns {string|null} - ISO date string or null
 */
function parseTimestampFromName(sessionName) {
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
 * @param {string} sessionName - Session directory name
 * @returns {string} - Inferred type
 */
function inferTypeFromName(sessionName) {
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
 * @param {string} sessionPath - Path to session directory
 * @returns {Object|null} - Session data object or null if invalid
 */
function readSessionData(sessionPath) {
  const sessionFile = join(sessionPath, 'workflow-session.json');
  const sessionName = basename(sessionPath);

  if (existsSync(sessionFile)) {
    try {
      const data = JSON.parse(readFileSync(sessionFile, 'utf8'));

      // Multi-level type detection: JSON type > workflow_type > infer from name
      let type = data.type || data.workflow_type || inferTypeFromName(sessionName);

      // Normalize workflow_type values
      if (type === 'test_session') type = 'test';
      if (type === 'implementation') type = 'workflow';

      return {
        session_id: data.session_id || sessionName,
        project: data.project || data.description || '',
        status: data.status || 'active',
        created_at: data.created_at || data.initialized_at || data.timestamp || null,
        archived_at: data.archived_at || null,
        type: type,
        workflow_type: data.workflow_type || null  // Keep original for reference
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
    return {
      session_id: sessionName,
      project: '',
      status: 'unknown',
      created_at: timestampFromName || stats.birthtime.toISOString(),
      archived_at: null,
      type: inferredType,
      workflow_type: null
    };
  } catch {
    // Even if stat fails, return with name-extracted data
    if (timestampFromName) {
      return {
        session_id: sessionName,
        project: '',
        status: 'unknown',
        created_at: timestampFromName,
        archived_at: null,
        type: inferredType,
        workflow_type: null
      };
    }
    return null;
  }
}

/**
 * Check if session has review data
 * @param {string} sessionPath - Path to session directory
 * @returns {boolean}
 */
export function hasReviewData(sessionPath) {
  const reviewDir = join(sessionPath, '.review');
  return existsSync(reviewDir);
}

/**
 * Get list of task files in session
 * @param {string} sessionPath - Path to session directory
 * @returns {Promise<string[]>}
 */
export async function getTaskFiles(sessionPath) {
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
