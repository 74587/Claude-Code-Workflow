import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Scan lite-plan and lite-fix directories for task sessions
 * @param {string} workflowDir - Path to .workflow directory
 * @returns {Promise<Object>} - Lite tasks data
 */
export async function scanLiteTasks(workflowDir) {
  const litePlanDir = join(workflowDir, '.lite-plan');
  const liteFixDir = join(workflowDir, '.lite-fix');

  return {
    litePlan: scanLiteDir(litePlanDir, 'lite-plan'),
    liteFix: scanLiteDir(liteFixDir, 'lite-fix')
  };
}

/**
 * Scan a lite task directory
 * @param {string} dir - Directory path
 * @param {string} type - Task type ('lite-plan' or 'lite-fix')
 * @returns {Array} - Array of lite task sessions
 */
function scanLiteDir(dir, type) {
  if (!existsSync(dir)) return [];

  try {
    const sessions = readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => {
        const sessionPath = join(dir, d.name);
        const session = {
          id: d.name,
          type,
          path: sessionPath,
          createdAt: getCreatedTime(sessionPath),
          plan: loadPlanJson(sessionPath),
          tasks: loadTaskJsons(sessionPath)
        };

        // For lite-fix sessions, also load diagnoses separately
        if (type === 'lite-fix') {
          session.diagnoses = loadDiagnoses(sessionPath);
        }

        // Calculate progress
        session.progress = calculateProgress(session.tasks);

        return session;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return sessions;
  } catch (err) {
    console.error(`Error scanning ${dir}:`, err.message);
    return [];
  }
}

/**
 * Load plan.json or fix-plan.json from session directory
 * @param {string} sessionPath - Session directory path
 * @returns {Object|null} - Plan data or null
 */
function loadPlanJson(sessionPath) {
  // Try fix-plan.json first (for lite-fix), then plan.json (for lite-plan)
  const fixPlanPath = join(sessionPath, 'fix-plan.json');
  const planPath = join(sessionPath, 'plan.json');

  // Try fix-plan.json first
  if (existsSync(fixPlanPath)) {
    try {
      const content = readFileSync(fixPlanPath, 'utf8');
      return JSON.parse(content);
    } catch {
      // Continue to try plan.json
    }
  }

  // Fallback to plan.json
  if (existsSync(planPath)) {
    try {
      const content = readFileSync(planPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Load all task JSON files from session directory
 * Supports multiple task formats:
 * 1. .task/IMPL-*.json files
 * 2. tasks array in plan.json
 * 3. task-*.json files in session root
 * @param {string} sessionPath - Session directory path
 * @returns {Array} - Array of task objects
 */
function loadTaskJsons(sessionPath) {
  let tasks = [];

  // Method 1: Check .task/IMPL-*.json files
  const taskDir = join(sessionPath, '.task');
  if (existsSync(taskDir)) {
    try {
      const implTasks = readdirSync(taskDir)
        .filter(f => f.endsWith('.json') && (
          f.startsWith('IMPL-') ||
          f.startsWith('TASK-') ||
          f.startsWith('task-') ||
          f.startsWith('diagnosis-') ||
          /^T\d+\.json$/i.test(f)
        ))
        .map(f => {
          const taskPath = join(taskDir, f);
          try {
            const content = readFileSync(taskPath, 'utf8');
            return normalizeTask(JSON.parse(content));
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      tasks = tasks.concat(implTasks);
    } catch {
      // Continue to other methods
    }
  }

  // Method 2: Check plan.json or fix-plan.json for embedded tasks array
  if (tasks.length === 0) {
    // Try fix-plan.json first (for lite-fix), then plan.json (for lite-plan)
    const fixPlanPath = join(sessionPath, 'fix-plan.json');
    const planPath = join(sessionPath, 'plan.json');

    const planFile = existsSync(fixPlanPath) ? fixPlanPath :
                     existsSync(planPath) ? planPath : null;

    if (planFile) {
      try {
        const plan = JSON.parse(readFileSync(planFile, 'utf8'));
        if (Array.isArray(plan.tasks)) {
          tasks = plan.tasks.map(t => normalizeTask(t));
        }
      } catch {
        // Continue to other methods
      }
    }
  }

  // Method 3: Check for task-*.json and diagnosis-*.json files in session root
  if (tasks.length === 0) {
    try {
      const rootTasks = readdirSync(sessionPath)
        .filter(f => f.endsWith('.json') && (
          f.startsWith('task-') ||
          f.startsWith('TASK-') ||
          f.startsWith('diagnosis-') ||
          /^T\d+\.json$/i.test(f)
        ))
        .map(f => {
          const taskPath = join(sessionPath, f);
          try {
            const content = readFileSync(taskPath, 'utf8');
            return normalizeTask(JSON.parse(content));
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      tasks = tasks.concat(rootTasks);
    } catch {
      // No tasks found
    }
  }

  // Sort tasks by ID
  return tasks.sort((a, b) => {
    const aNum = parseInt(a.id?.replace(/\D/g, '') || '0');
    const bNum = parseInt(b.id?.replace(/\D/g, '') || '0');
    return aNum - bNum;
  });
}

/**
 * Normalize task object to consistent structure
 * @param {Object} task - Raw task object
 * @returns {Object} - Normalized task
 */
function normalizeTask(task) {
  if (!task) return null;

  // Determine status - support various status formats
  let status = task.status || 'pending';
  if (typeof status === 'object') {
    status = status.state || status.value || 'pending';
  }

  return {
    id: task.id || task.task_id || 'unknown',
    title: task.title || task.name || task.summary || 'Untitled Task',
    status: status.toLowerCase(),
    // Preserve original fields for flexible rendering
    meta: task.meta || {
      type: task.type || task.action || 'task',
      agent: task.agent || null,
      scope: task.scope || null,
      module: task.module || null
    },
    context: task.context || {
      requirements: task.requirements || task.description ? [task.description] : [],
      focus_paths: task.focus_paths || task.modification_points?.map(m => m.file) || [],
      acceptance: task.acceptance || [],
      depends_on: task.depends_on || []
    },
    flow_control: task.flow_control || {
      implementation_approach: task.implementation?.map((step, i) => ({
        step: `Step ${i + 1}`,
        action: step
      })) || []
    },
    // Keep all original fields for raw JSON view
    _raw: task
  };
}

/**
 * Get directory creation time
 * @param {string} dirPath - Directory path
 * @returns {string} - ISO date string
 */
function getCreatedTime(dirPath) {
  try {
    const stat = statSync(dirPath);
    return stat.birthtime.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Calculate progress from tasks
 * @param {Array} tasks - Array of task objects
 * @returns {Object} - Progress info
 */
function calculateProgress(tasks) {
  if (!tasks || tasks.length === 0) {
    return { total: 0, completed: 0, percentage: 0 };
  }

  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const percentage = Math.round((completed / total) * 100);

  return { total, completed, percentage };
}

/**
 * Get detailed lite task info
 * @param {string} workflowDir - Workflow directory
 * @param {string} type - 'lite-plan' or 'lite-fix'
 * @param {string} sessionId - Session ID
 * @returns {Object|null} - Detailed task info
 */
export function getLiteTaskDetail(workflowDir, type, sessionId) {
  const dir = type === 'lite-plan'
    ? join(workflowDir, '.lite-plan', sessionId)
    : join(workflowDir, '.lite-fix', sessionId);

  if (!existsSync(dir)) return null;

  const detail = {
    id: sessionId,
    type,
    path: dir,
    plan: loadPlanJson(dir),
    tasks: loadTaskJsons(dir),
    explorations: loadExplorations(dir),
    clarifications: loadClarifications(dir)
  };

  // For lite-fix sessions, also load diagnoses
  if (type === 'lite-fix') {
    detail.diagnoses = loadDiagnoses(dir);
  }

  return detail;
}

/**
 * Load exploration results
 * @param {string} sessionPath - Session directory path
 * @returns {Array} - Exploration results
 */
function loadExplorations(sessionPath) {
  const explorePath = join(sessionPath, 'explorations.json');
  if (!existsSync(explorePath)) return [];

  try {
    const content = readFileSync(explorePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

/**
 * Load clarification data
 * @param {string} sessionPath - Session directory path
 * @returns {Object|null} - Clarification data
 */
function loadClarifications(sessionPath) {
  const clarifyPath = join(sessionPath, 'clarifications.json');
  if (!existsSync(clarifyPath)) return null;

  try {
    const content = readFileSync(clarifyPath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Load diagnosis files for lite-fix sessions
 * Loads diagnosis-*.json files from session root directory
 * @param {string} sessionPath - Session directory path
 * @returns {Object} - Diagnoses data with manifest and items
 */
function loadDiagnoses(sessionPath) {
  const result = {
    manifest: null,
    items: []
  };

  // Try to load diagnoses-manifest.json first
  const manifestPath = join(sessionPath, 'diagnoses-manifest.json');
  if (existsSync(manifestPath)) {
    try {
      result.manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch {
      // Continue without manifest
    }
  }

  // Load all diagnosis-*.json files from session root
  try {
    const diagnosisFiles = readdirSync(sessionPath)
      .filter(f => f.startsWith('diagnosis-') && f.endsWith('.json'));

    for (const file of diagnosisFiles) {
      const filePath = join(sessionPath, file);
      try {
        const content = JSON.parse(readFileSync(filePath, 'utf8'));
        result.items.push({
          id: file.replace('diagnosis-', '').replace('.json', ''),
          filename: file,
          ...content
        });
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Return empty items if directory read fails
  }

  return result;
}
