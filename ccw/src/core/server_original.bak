import http from 'http';
import { URL } from 'url';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { scanSessions } from './session-scanner.js';
import { aggregateData } from './data-aggregator.js';
import { resolvePath, getRecentPaths, trackRecentPath, normalizePathForDisplay, getWorkflowDir } from '../utils/path-resolver.js';

const TEMPLATE_PATH = join(import.meta.dirname, '../templates/dashboard.html');
const CSS_FILE = join(import.meta.dirname, '../templates/dashboard.css');
const JS_FILE = join(import.meta.dirname, '../templates/dashboard.js');

/**
 * Create and start the dashboard server
 * @param {Object} options - Server options
 * @param {number} options.port - Port to listen on (default: 3456)
 * @param {string} options.initialPath - Initial project path
 * @returns {Promise<http.Server>}
 */
export async function startServer(options = {}) {
  const port = options.port || 3456;
  const initialPath = options.initialPath || process.cwd();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const pathname = url.pathname;

    // CORS headers for API requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      // API: Get workflow data for a path
      if (pathname === '/api/data') {
        const projectPath = url.searchParams.get('path') || initialPath;
        const data = await getWorkflowData(projectPath);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
        return;
      }

      // API: Get recent paths
      if (pathname === '/api/recent-paths') {
        const paths = getRecentPaths();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ paths }));
        return;
      }

      // API: Get session detail data (context, summaries, impl-plan, review)
      if (pathname === '/api/session-detail') {
        const sessionPath = url.searchParams.get('path');
        const dataType = url.searchParams.get('type') || 'all';

        if (!sessionPath) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Session path is required' }));
          return;
        }

        const detail = await getSessionDetailData(sessionPath, dataType);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(detail));
        return;
      }

      // Serve dashboard HTML
      if (pathname === '/' || pathname === '/index.html') {
        const html = generateServerDashboard(initialPath);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      // 404
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');

    } catch (error) {
      console.error('Server error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      console.log(`Dashboard server running at http://localhost:${port}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

/**
 * Get workflow data for a project path
 * @param {string} projectPath
 * @returns {Promise<Object>}
 */
async function getWorkflowData(projectPath) {
  const resolvedPath = resolvePath(projectPath);
  const workflowDir = join(resolvedPath, '.workflow');

  // Track this path
  trackRecentPath(resolvedPath);

  // Check if .workflow exists
  if (!existsSync(workflowDir)) {
    return {
      generatedAt: new Date().toISOString(),
      activeSessions: [],
      archivedSessions: [],
      liteTasks: { litePlan: [], liteFix: [] },
      reviewData: { dimensions: {} },
      projectOverview: null,
      statistics: {
        totalSessions: 0,
        activeSessions: 0,
        totalTasks: 0,
        completedTasks: 0,
        reviewFindings: 0,
        litePlanCount: 0,
        liteFixCount: 0
      },
      projectPath: normalizePathForDisplay(resolvedPath),
      recentPaths: getRecentPaths()
    };
  }

  // Scan and aggregate data
  const sessions = await scanSessions(workflowDir);
  const data = await aggregateData(sessions, workflowDir);

  data.projectPath = normalizePathForDisplay(resolvedPath);
  data.recentPaths = getRecentPaths();

  return data;
}

/**
 * Get session detail data (context, summaries, impl-plan, review)
 * @param {string} sessionPath - Path to session directory
 * @param {string} dataType - Type of data to load: context, summary, impl-plan, review, or all
 * @returns {Promise<Object>}
 */
async function getSessionDetailData(sessionPath, dataType) {
  const result = {};

  // Normalize path
  const normalizedPath = sessionPath.replace(/\\/g, '/');

  try {
    // Load context-package.json (in .process/ subfolder)
    if (dataType === 'context' || dataType === 'all') {
      // Try .process/context-package.json first (common location)
      let contextFile = join(normalizedPath, '.process', 'context-package.json');
      if (!existsSync(contextFile)) {
        // Fallback to session root
        contextFile = join(normalizedPath, 'context-package.json');
      }
      if (existsSync(contextFile)) {
        try {
          result.context = JSON.parse(readFileSync(contextFile, 'utf8'));
        } catch (e) {
          result.context = null;
        }
      }
    }

    // Load task JSONs from .task/ folder
    if (dataType === 'tasks' || dataType === 'all') {
      const taskDir = join(normalizedPath, '.task');
      result.tasks = [];
      if (existsSync(taskDir)) {
        const files = readdirSync(taskDir).filter(f => f.endsWith('.json') && f.startsWith('IMPL-'));
        for (const file of files) {
          try {
            const content = JSON.parse(readFileSync(join(taskDir, file), 'utf8'));
            result.tasks.push({
              filename: file,
              task_id: file.replace('.json', ''),
              ...content
            });
          } catch (e) {
            // Skip unreadable files
          }
        }
        // Sort by task ID
        result.tasks.sort((a, b) => a.task_id.localeCompare(b.task_id));
      }
    }

    // Load summaries from .summaries/
    if (dataType === 'summary' || dataType === 'all') {
      const summariesDir = join(normalizedPath, '.summaries');
      result.summaries = [];
      if (existsSync(summariesDir)) {
        const files = readdirSync(summariesDir).filter(f => f.endsWith('.md'));
        for (const file of files) {
          try {
            const content = readFileSync(join(summariesDir, file), 'utf8');
            result.summaries.push({ name: file.replace('.md', ''), content });
          } catch (e) {
            // Skip unreadable files
          }
        }
      }
    }

    // Load plan.json (for lite tasks)
    if (dataType === 'plan' || dataType === 'all') {
      const planFile = join(normalizedPath, 'plan.json');
      if (existsSync(planFile)) {
        try {
          result.plan = JSON.parse(readFileSync(planFile, 'utf8'));
        } catch (e) {
          result.plan = null;
        }
      }
    }

    // Load IMPL_PLAN.md
    if (dataType === 'impl-plan' || dataType === 'all') {
      const implPlanFile = join(normalizedPath, 'IMPL_PLAN.md');
      if (existsSync(implPlanFile)) {
        try {
          result.implPlan = readFileSync(implPlanFile, 'utf8');
        } catch (e) {
          result.implPlan = null;
        }
      }
    }

    // Load review data from .review/
    if (dataType === 'review' || dataType === 'all') {
      const reviewDir = join(normalizedPath, '.review');
      result.review = {
        state: null,
        dimensions: [],
        severityDistribution: null,
        totalFindings: 0
      };

      if (existsSync(reviewDir)) {
        // Load review-state.json
        const stateFile = join(reviewDir, 'review-state.json');
        if (existsSync(stateFile)) {
          try {
            const state = JSON.parse(readFileSync(stateFile, 'utf8'));
            result.review.state = state;
            result.review.severityDistribution = state.severity_distribution || {};
            result.review.totalFindings = state.total_findings || 0;
            result.review.phase = state.phase || 'unknown';
            result.review.dimensionSummaries = state.dimension_summaries || {};
            result.review.crossCuttingConcerns = state.cross_cutting_concerns || [];
            result.review.criticalFiles = state.critical_files || [];
          } catch (e) {
            // Skip unreadable state
          }
        }

        // Load dimension findings
        const dimensionsDir = join(reviewDir, 'dimensions');
        if (existsSync(dimensionsDir)) {
          const files = readdirSync(dimensionsDir).filter(f => f.endsWith('.json'));
          for (const file of files) {
            try {
              const dimName = file.replace('.json', '');
              const data = JSON.parse(readFileSync(join(dimensionsDir, file), 'utf8'));

              // Handle array structure: [ { findings: [...] } ]
              let findings = [];
              let summary = null;

              if (Array.isArray(data) && data.length > 0) {
                const dimData = data[0];
                findings = dimData.findings || [];
                summary = dimData.summary || null;
              } else if (data.findings) {
                findings = data.findings;
                summary = data.summary || null;
              }

              result.review.dimensions.push({
                name: dimName,
                findings: findings,
                summary: summary,
                count: findings.length
              });
            } catch (e) {
              // Skip unreadable files
            }
          }
        }
      }
    }

  } catch (error) {
    console.error('Error loading session detail:', error);
    result.error = error.message;
  }

  return result;
}

/**
 * Generate dashboard HTML for server mode
 * @param {string} initialPath
 * @returns {string}
 */
function generateServerDashboard(initialPath) {
  let html = readFileSync(TEMPLATE_PATH, 'utf8');

  // Read CSS and JS files
  const cssContent = existsSync(CSS_FILE) ? readFileSync(CSS_FILE, 'utf8') : '';
  let jsContent = existsSync(JS_FILE) ? readFileSync(JS_FILE, 'utf8') : '';

  // Inject CSS content
  html = html.replace('{{CSS_CONTENT}}', cssContent);

  // Prepare JS content with empty initial data (will be loaded dynamically)
  const emptyData = {
    generatedAt: new Date().toISOString(),
    activeSessions: [],
    archivedSessions: [],
    liteTasks: { litePlan: [], liteFix: [] },
    reviewData: { dimensions: {} },
    projectOverview: null,
    statistics: { totalSessions: 0, activeSessions: 0, totalTasks: 0, completedTasks: 0, reviewFindings: 0, litePlanCount: 0, liteFixCount: 0 }
  };

  // Replace JS placeholders
  jsContent = jsContent.replace('{{WORKFLOW_DATA}}', JSON.stringify(emptyData, null, 2));
  jsContent = jsContent.replace(/\{\{PROJECT_PATH\}\}/g, normalizePathForDisplay(initialPath).replace(/\\/g, '/'));
  jsContent = jsContent.replace('{{RECENT_PATHS}}', JSON.stringify(getRecentPaths()));

  // Add server mode flag and dynamic loading functions at the start of JS
  const serverModeScript = `
// Server mode - load data dynamically
window.SERVER_MODE = true;
window.INITIAL_PATH = '${normalizePathForDisplay(initialPath).replace(/\\/g, '/')}';

async function loadDashboardData(path) {
  try {
    const res = await fetch('/api/data?path=' + encodeURIComponent(path));
    if (!res.ok) throw new Error('Failed to load data');
    return await res.json();
  } catch (err) {
    console.error('Error loading data:', err);
    return null;
  }
}

async function loadRecentPaths() {
  try {
    const res = await fetch('/api/recent-paths');
    if (!res.ok) return [];
    const data = await res.json();
    return data.paths || [];
  } catch (err) {
    return [];
  }
}

`;

  // Prepend server mode script to JS content
  jsContent = serverModeScript + jsContent;

  // Inject JS content
  html = html.replace('{{JS_CONTENT}}', jsContent);

  // Replace any remaining placeholders in HTML
  html = html.replace(/\{\{PROJECT_PATH\}\}/g, normalizePathForDisplay(initialPath).replace(/\\/g, '/'));

  return html;
}
