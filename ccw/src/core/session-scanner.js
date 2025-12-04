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
 * Read session data from workflow-session.json or create minimal from directory
 * @param {string} sessionPath - Path to session directory
 * @returns {Object|null} - Session data object or null if invalid
 */
function readSessionData(sessionPath) {
  const sessionFile = join(sessionPath, 'workflow-session.json');

  if (existsSync(sessionFile)) {
    try {
      const data = JSON.parse(readFileSync(sessionFile, 'utf8'));
      return {
        session_id: data.session_id || basename(sessionPath),
        project: data.project || data.description || '',
        status: data.status || 'active',
        created_at: data.created_at || data.initialized_at || null,
        archived_at: data.archived_at || null,
        type: data.type || 'workflow'
      };
    } catch {
      // Fall through to minimal session
    }
  }

  // Fallback: create minimal session from directory info
  try {
    const stats = statSync(sessionPath);
    return {
      session_id: basename(sessionPath),
      project: '',
      status: 'unknown',
      created_at: stats.birthtime.toISOString(),
      archived_at: null,
      type: 'workflow'
    };
  } catch {
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
