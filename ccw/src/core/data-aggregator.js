import { glob } from 'glob';
import { readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { scanLiteTasks } from './lite-scanner.js';

/**
 * Aggregate all data for dashboard rendering
 * @param {Object} sessions - Scanned sessions from session-scanner
 * @param {string} workflowDir - Path to .workflow directory
 * @returns {Promise<Object>} - Aggregated dashboard data
 */
export async function aggregateData(sessions, workflowDir) {
  const data = {
    generatedAt: new Date().toISOString(),
    activeSessions: [],
    archivedSessions: [],
    liteTasks: {
      litePlan: [],
      liteFix: []
    },
    reviewData: null,
    statistics: {
      totalSessions: 0,
      activeSessions: 0,
      totalTasks: 0,
      completedTasks: 0,
      reviewFindings: 0,
      litePlanCount: 0,
      liteFixCount: 0
    }
  };

  // Process active sessions
  for (const session of sessions.active) {
    const sessionData = await processSession(session, true);
    data.activeSessions.push(sessionData);
    data.statistics.totalTasks += sessionData.tasks.length;
    data.statistics.completedTasks += sessionData.tasks.filter(t => t.status === 'completed').length;
  }

  // Process archived sessions
  for (const session of sessions.archived) {
    const sessionData = await processSession(session, false);
    data.archivedSessions.push(sessionData);
    data.statistics.totalTasks += sessionData.taskCount || 0;
    data.statistics.completedTasks += sessionData.taskCount || 0;
  }

  // Aggregate review data if present
  if (sessions.hasReviewData) {
    data.reviewData = await aggregateReviewData(sessions.active);
    data.statistics.reviewFindings = data.reviewData.totalFindings;
  }

  data.statistics.totalSessions = sessions.active.length + sessions.archived.length;
  data.statistics.activeSessions = sessions.active.length;

  // Scan and include lite tasks
  try {
    const liteTasks = await scanLiteTasks(workflowDir);
    data.liteTasks = liteTasks;
    data.statistics.litePlanCount = liteTasks.litePlan.length;
    data.statistics.liteFixCount = liteTasks.liteFix.length;
  } catch (err) {
    console.error('Error scanning lite tasks:', err.message);
  }

  return data;
}

/**
 * Process a single session, loading tasks and review info
 * @param {Object} session - Session object from scanner
 * @param {boolean} isActive - Whether session is active
 * @returns {Promise<Object>} - Processed session data
 */
async function processSession(session, isActive) {
  const result = {
    session_id: session.session_id,
    project: session.project || session.session_id,
    status: session.status || (isActive ? 'active' : 'archived'),
    type: session.type || 'workflow',  // Session type (workflow, review, test, docs)
    workflow_type: session.workflow_type || null,  // Original workflow_type for reference
    created_at: session.created_at || null,  // Raw ISO string - let frontend format
    archived_at: session.archived_at || null,  // Raw ISO string - let frontend format
    path: session.path,
    tasks: [],
    taskCount: 0,
    hasReview: false,
    reviewSummary: null
  };

  // Load tasks for active sessions (full details)
  if (isActive) {
    const taskDir = join(session.path, '.task');
    if (existsSync(taskDir)) {
      const taskFiles = await safeGlob('IMPL-*.json', taskDir);
      for (const taskFile of taskFiles) {
        try {
          const taskData = JSON.parse(readFileSync(join(taskDir, taskFile), 'utf8'));
          result.tasks.push({
            task_id: taskData.id || basename(taskFile, '.json'),
            title: taskData.title || 'Untitled Task',
            status: taskData.status || 'pending',
            type: taskData.meta?.type || 'task'
          });
        } catch {
          // Skip invalid task files
        }
      }
      // Sort tasks by ID
      result.tasks.sort((a, b) => sortTaskIds(a.task_id, b.task_id));
    }
    result.taskCount = result.tasks.length;

    // Check for review data
    const reviewDir = join(session.path, '.review');
    if (existsSync(reviewDir)) {
      result.hasReview = true;
      result.reviewSummary = loadReviewSummary(reviewDir);
    }
  } else {
    // For archived, just count tasks
    const taskDir = join(session.path, '.task');
    if (existsSync(taskDir)) {
      const taskFiles = await safeGlob('IMPL-*.json', taskDir);
      result.taskCount = taskFiles.length;
    }
  }

  return result;
}

/**
 * Aggregate review data from all active sessions with reviews
 * @param {Array} activeSessions - Active session objects
 * @returns {Promise<Object>} - Aggregated review data
 */
async function aggregateReviewData(activeSessions) {
  const reviewData = {
    totalFindings: 0,
    severityDistribution: { critical: 0, high: 0, medium: 0, low: 0 },
    dimensionSummary: {},
    sessions: []
  };

  for (const session of activeSessions) {
    const reviewDir = join(session.path, '.review');
    if (!existsSync(reviewDir)) continue;

    const reviewProgress = loadReviewProgress(reviewDir);
    const dimensionData = await loadDimensionData(reviewDir);

    if (reviewProgress || dimensionData.length > 0) {
      const sessionReview = {
        session_id: session.session_id,
        progress: reviewProgress,
        dimensions: dimensionData,
        findings: []
      };

      // Collect and count findings
      for (const dim of dimensionData) {
        if (dim.findings && Array.isArray(dim.findings)) {
          for (const finding of dim.findings) {
            const severity = (finding.severity || 'low').toLowerCase();
            if (reviewData.severityDistribution.hasOwnProperty(severity)) {
              reviewData.severityDistribution[severity]++;
            }
            reviewData.totalFindings++;
            sessionReview.findings.push({
              ...finding,
              dimension: dim.name
            });
          }
        }

        // Track dimension summary
        if (!reviewData.dimensionSummary[dim.name]) {
          reviewData.dimensionSummary[dim.name] = { count: 0, sessions: [] };
        }
        reviewData.dimensionSummary[dim.name].count += dim.findings?.length || 0;
        reviewData.dimensionSummary[dim.name].sessions.push(session.session_id);
      }

      reviewData.sessions.push(sessionReview);
    }
  }

  return reviewData;
}

/**
 * Load review progress from review-progress.json
 * @param {string} reviewDir - Path to .review directory
 * @returns {Object|null}
 */
function loadReviewProgress(reviewDir) {
  const progressFile = join(reviewDir, 'review-progress.json');
  if (!existsSync(progressFile)) return null;
  try {
    return JSON.parse(readFileSync(progressFile, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Load review summary from review-state.json
 * @param {string} reviewDir - Path to .review directory
 * @returns {Object|null}
 */
function loadReviewSummary(reviewDir) {
  const stateFile = join(reviewDir, 'review-state.json');
  if (!existsSync(stateFile)) return null;
  try {
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    return {
      phase: state.phase || 'unknown',
      severityDistribution: state.severity_distribution || {},
      criticalFiles: (state.critical_files || []).slice(0, 3),
      status: state.status || 'in_progress'
    };
  } catch {
    return null;
  }
}

/**
 * Load dimension data from .review/dimensions/
 * @param {string} reviewDir - Path to .review directory
 * @returns {Promise<Array>}
 */
async function loadDimensionData(reviewDir) {
  const dimensionsDir = join(reviewDir, 'dimensions');
  if (!existsSync(dimensionsDir)) return [];

  const dimensions = [];
  const dimFiles = await safeGlob('*.json', dimensionsDir);

  for (const file of dimFiles) {
    try {
      const data = JSON.parse(readFileSync(join(dimensionsDir, file), 'utf8'));
      dimensions.push({
        name: basename(file, '.json'),
        findings: Array.isArray(data) ? data : (data.findings || []),
        status: data.status || 'completed'
      });
    } catch {
      // Skip invalid dimension files
    }
  }

  return dimensions;
}

/**
 * Safe glob wrapper that returns empty array on error
 * @param {string} pattern - Glob pattern
 * @param {string} cwd - Current working directory
 * @returns {Promise<string[]>}
 */
async function safeGlob(pattern, cwd) {
  try {
    return await glob(pattern, { cwd, absolute: false });
  } catch {
    return [];
  }
}

// formatDate removed - dates are now passed as raw ISO strings
// Frontend (dashboard.js) handles all date formatting

/**
 * Sort task IDs numerically (IMPL-1, IMPL-2, IMPL-1.1, etc.)
 * @param {string} a - First task ID
 * @param {string} b - Second task ID
 * @returns {number}
 */
function sortTaskIds(a, b) {
  const parseId = (id) => {
    const match = id.match(/IMPL-(\d+)(?:\.(\d+))?/);
    if (!match) return [0, 0];
    return [parseInt(match[1]), parseInt(match[2] || 0)];
  };
  const [a1, a2] = parseId(a);
  const [b1, b2] = parseId(b);
  return a1 - b1 || a2 - b2;
}
