import http from 'http';
import { URL } from 'url';
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, promises as fsPromises } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';
import { scanSessions } from './session-scanner.js';
import { aggregateData } from './data-aggregator.js';
import { resolvePath, getRecentPaths, trackRecentPath, removeRecentPath, normalizePathForDisplay, getWorkflowDir } from '../utils/path-resolver.js';

// Claude config file paths
const CLAUDE_CONFIG_PATH = join(homedir(), '.claude.json');
const CLAUDE_SETTINGS_DIR = join(homedir(), '.claude');
const CLAUDE_GLOBAL_SETTINGS = join(CLAUDE_SETTINGS_DIR, 'settings.json');
const CLAUDE_GLOBAL_SETTINGS_LOCAL = join(CLAUDE_SETTINGS_DIR, 'settings.local.json');

// Enterprise managed MCP paths (platform-specific)
function getEnterpriseMcpPath() {
  const platform = process.platform;
  if (platform === 'darwin') {
    return '/Library/Application Support/ClaudeCode/managed-mcp.json';
  } else if (platform === 'win32') {
    return 'C:\\Program Files\\ClaudeCode\\managed-mcp.json';
  } else {
    // Linux and WSL
    return '/etc/claude-code/managed-mcp.json';
  }
}

// WebSocket clients for real-time notifications
const wsClients = new Set();

const TEMPLATE_PATH = join(import.meta.dirname, '../templates/dashboard.html');
const MODULE_CSS_DIR = join(import.meta.dirname, '../templates/dashboard-css');
const JS_FILE = join(import.meta.dirname, '../templates/dashboard.js');
const MODULE_JS_DIR = join(import.meta.dirname, '../templates/dashboard-js');

// Modular CSS files in load order
const MODULE_CSS_FILES = [
  '01-base.css',
  '02-session.css',
  '03-tasks.css',
  '04-lite-tasks.css',
  '05-context.css',
  '06-cards.css',
  '07-managers.css',
  '08-review.css'
];

/**
 * Handle POST request with JSON body
 */
function handlePostRequest(req, res, handler) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const parsed = JSON.parse(body);
      const result = await handler(parsed);

      if (result.error) {
        const status = result.status || 500;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: result.error }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      }
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
}

// Modular JS files in dependency order
const MODULE_FILES = [
  'utils.js',
  'state.js',
  'api.js',
  'components/theme.js',
  'components/modals.js',
  'components/navigation.js',
  'components/sidebar.js',
  'components/carousel.js',
  'components/notifications.js',
  'components/mcp-manager.js',
  'components/hook-manager.js',
  'components/_exp_helpers.js',
  'components/tabs-other.js',
  'components/tabs-context.js',
  'components/_conflict_tab.js',
  'components/_review_tab.js',
  'components/task-drawer-core.js',
  'components/task-drawer-renderers.js',
  'components/flowchart.js',
  'views/home.js',
  'views/project-overview.js',
  'views/session-detail.js',
  'views/review-session.js',
  'views/lite-tasks.js',
  'views/fix-session.js',
  'views/mcp-manager.js',
  'views/hook-manager.js',
  'main.js'
];
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
      // Debug log for API requests
      if (pathname.startsWith('/api/')) {
        console.log(`[API] ${req.method} ${pathname}`);
      }

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

      // API: Switch workspace path (for ccw view command)
      if (pathname === '/api/switch-path') {
        const newPath = url.searchParams.get('path');
        if (!newPath) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Path is required' }));
          return;
        }

        const resolved = resolvePath(newPath);
        if (!existsSync(resolved)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Path does not exist' }));
          return;
        }

        // Track the path and return success
        trackRecentPath(resolved);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          path: resolved,
          recentPaths: getRecentPaths()
        }));
        return;
      }

      // API: Health check (for ccw view to detect running server)
      if (pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
        return;
      }

      // API: Shutdown server (for ccw stop command)
      if (pathname === '/api/shutdown' && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'shutting_down' }));

        // Graceful shutdown
        console.log('\n  Received shutdown signal...');
        setTimeout(() => {
          server.close(() => {
            console.log('  Server stopped.\n');
            process.exit(0);
          });
          // Force exit after 3 seconds if graceful shutdown fails
          setTimeout(() => process.exit(0), 3000);
        }, 100);
        return;
      }

      // API: Remove a recent path
      if (pathname === '/api/remove-recent-path' && req.method === 'POST') {
        handlePostRequest(req, res, async (body) => {
          const { path } = body;
          if (!path) {
            return { error: 'path is required', status: 400 };
          }
          const removed = removeRecentPath(path);
          return { success: removed, paths: getRecentPaths() };
        });
        return;
      }

      // API: Read a JSON file (for fix progress tracking)
      if (pathname === '/api/file') {
        const filePath = url.searchParams.get('path');
        if (!filePath) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'File path is required' }));
          return;
        }

        try {
          const content = await fsPromises.readFile(filePath, 'utf-8');
          const json = JSON.parse(content);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(json));
        } catch (err) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'File not found or invalid JSON' }));
        }
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

      // API: Update task status
      if (pathname === '/api/update-task-status' && req.method === 'POST') {
        handlePostRequest(req, res, async (body) => {
          const { sessionPath, taskId, newStatus } = body;

          if (!sessionPath || !taskId || !newStatus) {
            return { error: 'sessionPath, taskId, and newStatus are required', status: 400 };
          }

          return await updateTaskStatus(sessionPath, taskId, newStatus);
        });
        return;
      }

      // API: Bulk update task status
      if (pathname === '/api/bulk-update-task-status' && req.method === 'POST') {
        handlePostRequest(req, res, async (body) => {
          const { sessionPath, taskIds, newStatus } = body;

          if (!sessionPath || !taskIds || !newStatus) {
            return { error: 'sessionPath, taskIds, and newStatus are required', status: 400 };
          }

          const results = [];
          for (const taskId of taskIds) {
            try {
              const result = await updateTaskStatus(sessionPath, taskId, newStatus);
              results.push(result);
            } catch (err) {
              results.push({ taskId, error: err.message });
            }
          }
          return { success: true, results };
        });
        return;
      }

      // API: Get MCP configuration
      if (pathname === '/api/mcp-config') {
        const mcpData = getMcpConfig();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mcpData));
        return;
      }

      // API: Toggle MCP server enabled/disabled
      if (pathname === '/api/mcp-toggle' && req.method === 'POST') {
        handlePostRequest(req, res, async (body) => {
          const { projectPath, serverName, enable } = body;
          if (!projectPath || !serverName) {
            return { error: 'projectPath and serverName are required', status: 400 };
          }
          return toggleMcpServerEnabled(projectPath, serverName, enable);
        });
        return;
      }

      // API: Copy MCP server to project
      if (pathname === '/api/mcp-copy-server' && req.method === 'POST') {
        handlePostRequest(req, res, async (body) => {
          const { projectPath, serverName, serverConfig } = body;
          if (!projectPath || !serverName || !serverConfig) {
            return { error: 'projectPath, serverName, and serverConfig are required', status: 400 };
          }
          return addMcpServerToProject(projectPath, serverName, serverConfig);
        });
        return;
      }

      // API: Remove MCP server from project
      if (pathname === '/api/mcp-remove-server' && req.method === 'POST') {
        handlePostRequest(req, res, async (body) => {
          const { projectPath, serverName } = body;
          if (!projectPath || !serverName) {
            return { error: 'projectPath and serverName are required', status: 400 };
          }
          return removeMcpServerFromProject(projectPath, serverName);
        });
        return;
      }

      // API: Hook endpoint for Claude Code notifications
      if (pathname === '/api/hook' && req.method === 'POST') {
        handlePostRequest(req, res, async (body) => {
          const { type, filePath, sessionId } = body;

          // Determine session ID from file path if not provided
          let resolvedSessionId = sessionId;
          if (!resolvedSessionId && filePath) {
            resolvedSessionId = extractSessionIdFromPath(filePath);
          }

          // Broadcast to all connected WebSocket clients
          const notification = {
            type: type || 'session_updated',
            payload: {
              sessionId: resolvedSessionId,
              filePath: filePath,
              timestamp: new Date().toISOString()
            }
          };

          broadcastToClients(notification);

          return { success: true, notification };
        });
        return;
      }

      // API: Get hooks configuration
      if (pathname === '/api/hooks' && req.method === 'GET') {
        const projectPathParam = url.searchParams.get('path');
        const hooksData = getHooksConfig(projectPathParam);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(hooksData));
        return;
      }

      // API: Save hook
      if (pathname === '/api/hooks' && req.method === 'POST') {
        handlePostRequest(req, res, async (body) => {
          const { projectPath, scope, event, hookData } = body;
          if (!scope || !event || !hookData) {
            return { error: 'scope, event, and hookData are required', status: 400 };
          }
          return saveHookToSettings(projectPath, scope, event, hookData);
        });
        return;
      }

      // API: Delete hook
      if (pathname === '/api/hooks' && req.method === 'DELETE') {
        handlePostRequest(req, res, async (body) => {
          const { projectPath, scope, event, hookIndex } = body;
          if (!scope || !event || hookIndex === undefined) {
            return { error: 'scope, event, and hookIndex are required', status: 400 };
          }
          return deleteHookFromSettings(projectPath, scope, event, hookIndex);
        });
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

  // Handle WebSocket upgrade requests
  server.on('upgrade', (req, socket, head) => {
    if (req.url === '/ws') {
      handleWebSocketUpgrade(req, socket, head);
    } else {
      socket.destroy();
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      console.log(`Dashboard server running at http://localhost:${port}`);
      console.log(`WebSocket endpoint available at ws://localhost:${port}/ws`);
      console.log(`Hook endpoint available at POST http://localhost:${port}/api/hook`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

// ========================================
// WebSocket Functions
// ========================================

/**
 * Handle WebSocket upgrade
 */
function handleWebSocketUpgrade(req, socket, head) {
  const key = req.headers['sec-websocket-key'];
  const acceptKey = createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  const responseHeaders = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`,
    '',
    ''
  ].join('\r\n');

  socket.write(responseHeaders);

  // Add to clients set
  wsClients.add(socket);
  console.log(`[WS] Client connected (${wsClients.size} total)`);

  // Handle incoming messages
  socket.on('data', (buffer) => {
    try {
      const message = parseWebSocketFrame(buffer);
      if (message) {
        console.log('[WS] Received:', message);
      }
    } catch (e) {
      // Ignore parse errors
    }
  });

  // Handle disconnect
  socket.on('close', () => {
    wsClients.delete(socket);
    console.log(`[WS] Client disconnected (${wsClients.size} remaining)`);
  });

  socket.on('error', () => {
    wsClients.delete(socket);
  });
}

/**
 * Parse WebSocket frame (simplified)
 */
function parseWebSocketFrame(buffer) {
  if (buffer.length < 2) return null;

  const secondByte = buffer[1];
  const isMasked = (secondByte & 0x80) !== 0;
  let payloadLength = secondByte & 0x7f;

  let offset = 2;
  if (payloadLength === 126) {
    payloadLength = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLength === 127) {
    payloadLength = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  let mask = null;
  if (isMasked) {
    mask = buffer.slice(offset, offset + 4);
    offset += 4;
  }

  const payload = buffer.slice(offset, offset + payloadLength);

  if (isMasked && mask) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= mask[i % 4];
    }
  }

  return payload.toString('utf8');
}

/**
 * Create WebSocket frame
 */
function createWebSocketFrame(data) {
  const payload = Buffer.from(JSON.stringify(data), 'utf8');
  const length = payload.length;

  let frame;
  if (length <= 125) {
    frame = Buffer.alloc(2 + length);
    frame[0] = 0x81; // Text frame, FIN
    frame[1] = length;
    payload.copy(frame, 2);
  } else if (length <= 65535) {
    frame = Buffer.alloc(4 + length);
    frame[0] = 0x81;
    frame[1] = 126;
    frame.writeUInt16BE(length, 2);
    payload.copy(frame, 4);
  } else {
    frame = Buffer.alloc(10 + length);
    frame[0] = 0x81;
    frame[1] = 127;
    frame.writeBigUInt64BE(BigInt(length), 2);
    payload.copy(frame, 10);
  }

  return frame;
}

/**
 * Broadcast message to all connected WebSocket clients
 */
function broadcastToClients(data) {
  const frame = createWebSocketFrame(data);

  for (const client of wsClients) {
    try {
      client.write(frame);
    } catch (e) {
      wsClients.delete(client);
    }
  }

  console.log(`[WS] Broadcast to ${wsClients.size} clients:`, data.type);
}

/**
 * Extract session ID from file path
 */
function extractSessionIdFromPath(filePath) {
  // Normalize path
  const normalized = filePath.replace(/\\/g, '/');

  // Look for session pattern: WFS-xxx, WRS-xxx, etc.
  const sessionMatch = normalized.match(/\/(W[A-Z]S-[^/]+)\//);
  if (sessionMatch) {
    return sessionMatch[1];
  }

  // Look for .workflow/.sessions/xxx pattern
  const sessionsMatch = normalized.match(/\.workflow\/\.sessions\/([^/]+)/);
  if (sessionsMatch) {
    return sessionsMatch[1];
  }

  // Look for lite-plan/lite-fix pattern
  const liteMatch = normalized.match(/\.(lite-plan|lite-fix)\/([^/]+)/);
  if (liteMatch) {
    return liteMatch[2];
  }

  return null;
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

    // Load explorations (exploration-*.json files) - check .process/ first, then session root
    if (dataType === 'context' || dataType === 'explorations' || dataType === 'all') {
      result.explorations = { manifest: null, data: {} };

      // Try .process/ first (standard workflow sessions), then session root (lite tasks)
      const searchDirs = [
        join(normalizedPath, '.process'),
        normalizedPath
      ];

      for (const searchDir of searchDirs) {
        if (!existsSync(searchDir)) continue;

        // Look for explorations-manifest.json
        const manifestFile = join(searchDir, 'explorations-manifest.json');
        if (existsSync(manifestFile)) {
          try {
            result.explorations.manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));

            // Load each exploration file based on manifest
            const explorations = result.explorations.manifest.explorations || [];
            for (const exp of explorations) {
              const expFile = join(searchDir, exp.file);
              if (existsSync(expFile)) {
                try {
                  result.explorations.data[exp.angle] = JSON.parse(readFileSync(expFile, 'utf8'));
                } catch (e) {
                  // Skip unreadable exploration files
                }
              }
            }
            break; // Found manifest, stop searching
          } catch (e) {
            result.explorations.manifest = null;
          }
        } else {
          // Fallback: scan for exploration-*.json files directly
          try {
            const files = readdirSync(searchDir).filter(f => f.startsWith('exploration-') && f.endsWith('.json'));
            if (files.length > 0) {
              // Create synthetic manifest
              result.explorations.manifest = {
                exploration_count: files.length,
                explorations: files.map((f, i) => ({
                  angle: f.replace('exploration-', '').replace('.json', ''),
                  file: f,
                  index: i + 1
                }))
              };

              // Load each file
              for (const file of files) {
                const angle = file.replace('exploration-', '').replace('.json', '');
                try {
                  result.explorations.data[angle] = JSON.parse(readFileSync(join(searchDir, file), 'utf8'));
                } catch (e) {
                  // Skip unreadable files
                }
              }
              break; // Found explorations, stop searching
            }
          } catch (e) {
            // Directory read failed
          }
        }
      }
    }

    // Load conflict resolution decisions (conflict-resolution-decisions.json)
    if (dataType === 'context' || dataType === 'conflict' || dataType === 'all') {
      result.conflictResolution = null;

      // Try .process/ first (standard workflow sessions)
      const conflictFiles = [
        join(normalizedPath, '.process', 'conflict-resolution-decisions.json'),
        join(normalizedPath, 'conflict-resolution-decisions.json')
      ];

      for (const conflictFile of conflictFiles) {
        if (existsSync(conflictFile)) {
          try {
            result.conflictResolution = JSON.parse(readFileSync(conflictFile, 'utf8'));
            break; // Found file, stop searching
          } catch (e) {
            // Skip unreadable file
          }
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
 * Update task status in a task JSON file
 * @param {string} sessionPath - Path to session directory
 * @param {string} taskId - Task ID (e.g., IMPL-001)
 * @param {string} newStatus - New status (pending, in_progress, completed)
 * @returns {Promise<Object>}
 */
async function updateTaskStatus(sessionPath, taskId, newStatus) {
  // Normalize path (handle both forward and back slashes)
  let normalizedPath = sessionPath.replace(/\\/g, '/');

  // Handle Windows drive letter format
  if (normalizedPath.match(/^[a-zA-Z]:\//)) {
    // Already in correct format
  } else if (normalizedPath.match(/^\/[a-zA-Z]\//)) {
    // Convert /D/path to D:/path
    normalizedPath = normalizedPath.charAt(1).toUpperCase() + ':' + normalizedPath.slice(2);
  }

  const taskDir = join(normalizedPath, '.task');

  // Check if task directory exists
  if (!existsSync(taskDir)) {
    throw new Error(`Task directory not found: ${taskDir}`);
  }

  // Try to find the task file
  let taskFile = join(taskDir, `${taskId}.json`);

  if (!existsSync(taskFile)) {
    // Try without .json if taskId already has it
    if (taskId.endsWith('.json')) {
      taskFile = join(taskDir, taskId);
    }
    if (!existsSync(taskFile)) {
      throw new Error(`Task file not found: ${taskId}.json in ${taskDir}`);
    }
  }

  try {
    const content = JSON.parse(readFileSync(taskFile, 'utf8'));
    const oldStatus = content.status || 'pending';
    content.status = newStatus;

    // Add status change timestamp
    if (!content.status_history) {
      content.status_history = [];
    }
    content.status_history.push({
      from: oldStatus,
      to: newStatus,
      changed_at: new Date().toISOString()
    });

    writeFileSync(taskFile, JSON.stringify(content, null, 2), 'utf8');

    return {
      success: true,
      taskId,
      oldStatus,
      newStatus,
      file: taskFile
    };
  } catch (error) {
    throw new Error(`Failed to update task ${taskId}: ${error.message}`);
  }
}

/**
 * Generate dashboard HTML for server mode
 * @param {string} initialPath
 * @returns {string}
 */
function generateServerDashboard(initialPath) {
  let html = readFileSync(TEMPLATE_PATH, 'utf8');

  // Read and concatenate modular CSS files in load order
  const cssContent = MODULE_CSS_FILES.map(file => {
    const filePath = join(MODULE_CSS_DIR, file);
    return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  }).join('\n\n');

  // Read and concatenate modular JS files in dependency order
  let jsContent = MODULE_FILES.map(file => {
    const filePath = join(MODULE_JS_DIR, file);
    return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  }).join('\n\n');

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

// ========================================
// MCP Configuration Functions
// ========================================

/**
 * Safely read and parse JSON file
 * @param {string} filePath
 * @returns {Object|null}
 */
function safeReadJson(filePath) {
  try {
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Get MCP servers from a JSON file (expects mcpServers key at top level)
 * @param {string} filePath
 * @returns {Object} mcpServers object or empty object
 */
function getMcpServersFromFile(filePath) {
  const config = safeReadJson(filePath);
  if (!config) return {};
  return config.mcpServers || {};
}

/**
 * Get MCP configuration from multiple sources (per official Claude Code docs):
 *
 * Priority (highest to lowest):
 * 1. Enterprise managed-mcp.json (cannot be overridden)
 * 2. Local scope (project-specific private in ~/.claude.json)
 * 3. Project scope (.mcp.json in project root)
 * 4. User scope (mcpServers in ~/.claude.json)
 *
 * Note: ~/.claude/settings.json is for MCP PERMISSIONS, NOT definitions!
 *
 * @returns {Object}
 */
function getMcpConfig() {
  try {
    const result = {
      projects: {},
      userServers: {},        // User-level servers from ~/.claude.json mcpServers
      enterpriseServers: {},  // Enterprise managed servers (highest priority)
      configSources: []       // Track where configs came from for debugging
    };

    // 1. Read Enterprise managed MCP servers (highest priority)
    const enterprisePath = getEnterpriseMcpPath();
    if (existsSync(enterprisePath)) {
      const enterpriseConfig = safeReadJson(enterprisePath);
      if (enterpriseConfig?.mcpServers) {
        result.enterpriseServers = enterpriseConfig.mcpServers;
        result.configSources.push({ type: 'enterprise', path: enterprisePath, count: Object.keys(enterpriseConfig.mcpServers).length });
      }
    }

    // 2. Read from ~/.claude.json
    if (existsSync(CLAUDE_CONFIG_PATH)) {
      const claudeConfig = safeReadJson(CLAUDE_CONFIG_PATH);
      if (claudeConfig) {
        // 2a. User-level mcpServers (top-level mcpServers key)
        if (claudeConfig.mcpServers) {
          result.userServers = claudeConfig.mcpServers;
          result.configSources.push({ type: 'user', path: CLAUDE_CONFIG_PATH, count: Object.keys(claudeConfig.mcpServers).length });
        }

        // 2b. Project-specific configurations (projects[path].mcpServers)
        if (claudeConfig.projects) {
          result.projects = claudeConfig.projects;
        }
      }
    }

    // 3. For each known project, check for .mcp.json (project-level config)
    const projectPaths = Object.keys(result.projects);
    for (const projectPath of projectPaths) {
      const mcpJsonPath = join(projectPath, '.mcp.json');
      if (existsSync(mcpJsonPath)) {
        const mcpJsonConfig = safeReadJson(mcpJsonPath);
        if (mcpJsonConfig?.mcpServers) {
          // Merge .mcp.json servers into project config
          // Project's .mcp.json has lower priority than ~/.claude.json projects[path].mcpServers
          const existingServers = result.projects[projectPath]?.mcpServers || {};
          result.projects[projectPath] = {
            ...result.projects[projectPath],
            mcpServers: {
              ...mcpJsonConfig.mcpServers,  // .mcp.json (lower priority)
              ...existingServers             // ~/.claude.json projects[path] (higher priority)
            },
            mcpJsonPath: mcpJsonPath  // Track source for debugging
          };
          result.configSources.push({ type: 'project-mcp-json', path: mcpJsonPath, count: Object.keys(mcpJsonConfig.mcpServers).length });
        }
      }
    }

    // Build globalServers by merging user and enterprise servers
    // Enterprise servers override user servers
    result.globalServers = {
      ...result.userServers,
      ...result.enterpriseServers
    };

    return result;
  } catch (error) {
    console.error('Error reading MCP config:', error);
    return { projects: {}, globalServers: {}, userServers: {}, enterpriseServers: {}, configSources: [], error: error.message };
  }
}

/**
 * Normalize project path for .claude.json (Windows backslash format)
 * @param {string} path
 * @returns {string}
 */
function normalizeProjectPathForConfig(path) {
  // Convert forward slashes to backslashes for Windows .claude.json format
  let normalized = path.replace(/\//g, '\\');

  // Handle /d/path format -> D:\path
  if (normalized.match(/^\\[a-zA-Z]\\/)) {
    normalized = normalized.charAt(1).toUpperCase() + ':' + normalized.slice(2);
  }

  return normalized;
}

/**
 * Toggle MCP server enabled/disabled
 * @param {string} projectPath
 * @param {string} serverName
 * @param {boolean} enable
 * @returns {Object}
 */
function toggleMcpServerEnabled(projectPath, serverName, enable) {
  try {
    if (!existsSync(CLAUDE_CONFIG_PATH)) {
      return { error: '.claude.json not found' };
    }

    const content = readFileSync(CLAUDE_CONFIG_PATH, 'utf8');
    const config = JSON.parse(content);

    const normalizedPath = normalizeProjectPathForConfig(projectPath);

    if (!config.projects || !config.projects[normalizedPath]) {
      return { error: `Project not found: ${normalizedPath}` };
    }

    const projectConfig = config.projects[normalizedPath];

    // Ensure disabledMcpServers array exists
    if (!projectConfig.disabledMcpServers) {
      projectConfig.disabledMcpServers = [];
    }

    if (enable) {
      // Remove from disabled list
      projectConfig.disabledMcpServers = projectConfig.disabledMcpServers.filter(s => s !== serverName);
    } else {
      // Add to disabled list if not already there
      if (!projectConfig.disabledMcpServers.includes(serverName)) {
        projectConfig.disabledMcpServers.push(serverName);
      }
    }

    // Write back to file
    writeFileSync(CLAUDE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');

    return {
      success: true,
      serverName,
      enabled: enable,
      disabledMcpServers: projectConfig.disabledMcpServers
    };
  } catch (error) {
    console.error('Error toggling MCP server:', error);
    return { error: error.message };
  }
}

/**
 * Add MCP server to project
 * @param {string} projectPath
 * @param {string} serverName
 * @param {Object} serverConfig
 * @returns {Object}
 */
function addMcpServerToProject(projectPath, serverName, serverConfig) {
  try {
    if (!existsSync(CLAUDE_CONFIG_PATH)) {
      return { error: '.claude.json not found' };
    }

    const content = readFileSync(CLAUDE_CONFIG_PATH, 'utf8');
    const config = JSON.parse(content);

    const normalizedPath = normalizeProjectPathForConfig(projectPath);

    // Create project entry if it doesn't exist
    if (!config.projects) {
      config.projects = {};
    }

    if (!config.projects[normalizedPath]) {
      config.projects[normalizedPath] = {
        allowedTools: [],
        mcpContextUris: [],
        mcpServers: {},
        enabledMcpjsonServers: [],
        disabledMcpjsonServers: [],
        hasTrustDialogAccepted: false,
        projectOnboardingSeenCount: 0,
        hasClaudeMdExternalIncludesApproved: false,
        hasClaudeMdExternalIncludesWarningShown: false
      };
    }

    const projectConfig = config.projects[normalizedPath];

    // Ensure mcpServers exists
    if (!projectConfig.mcpServers) {
      projectConfig.mcpServers = {};
    }

    // Add the server
    projectConfig.mcpServers[serverName] = serverConfig;

    // Write back to file
    writeFileSync(CLAUDE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');

    return {
      success: true,
      serverName,
      serverConfig
    };
  } catch (error) {
    console.error('Error adding MCP server:', error);
    return { error: error.message };
  }
}

/**
 * Remove MCP server from project
 * @param {string} projectPath
 * @param {string} serverName
 * @returns {Object}
 */
function removeMcpServerFromProject(projectPath, serverName) {
  try {
    if (!existsSync(CLAUDE_CONFIG_PATH)) {
      return { error: '.claude.json not found' };
    }

    const content = readFileSync(CLAUDE_CONFIG_PATH, 'utf8');
    const config = JSON.parse(content);

    const normalizedPath = normalizeProjectPathForConfig(projectPath);

    if (!config.projects || !config.projects[normalizedPath]) {
      return { error: `Project not found: ${normalizedPath}` };
    }

    const projectConfig = config.projects[normalizedPath];

    if (!projectConfig.mcpServers || !projectConfig.mcpServers[serverName]) {
      return { error: `Server not found: ${serverName}` };
    }

    // Remove the server
    delete projectConfig.mcpServers[serverName];

    // Also remove from disabled list if present
    if (projectConfig.disabledMcpServers) {
      projectConfig.disabledMcpServers = projectConfig.disabledMcpServers.filter(s => s !== serverName);
    }

    // Write back to file
    writeFileSync(CLAUDE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');

    return {
      success: true,
      serverName,
      removed: true
    };
  } catch (error) {
    console.error('Error removing MCP server:', error);
    return { error: error.message };
  }
}

// ========================================
// Hook Configuration Functions
// ========================================

const GLOBAL_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');

/**
 * Get project settings path
 * @param {string} projectPath
 * @returns {string}
 */
function getProjectSettingsPath(projectPath) {
  const normalizedPath = projectPath.replace(/\//g, '\\').replace(/^\\([a-zA-Z])\\/, '$1:\\');
  return join(normalizedPath, '.claude', 'settings.json');
}

/**
 * Read settings file safely
 * @param {string} filePath
 * @returns {Object}
 */
function readSettingsFile(filePath) {
  try {
    if (!existsSync(filePath)) {
      return { hooks: {} };
    }
    const content = readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading settings file ${filePath}:`, error);
    return { hooks: {} };
  }
}

/**
 * Write settings file safely
 * @param {string} filePath
 * @param {Object} settings
 */
function writeSettingsFile(filePath, settings) {
  const dirPath = dirname(filePath);
  // Ensure directory exists
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8');
}

/**
 * Get hooks configuration from both global and project settings
 * @param {string} projectPath
 * @returns {Object}
 */
function getHooksConfig(projectPath) {
  const globalSettings = readSettingsFile(GLOBAL_SETTINGS_PATH);
  const projectSettingsPath = projectPath ? getProjectSettingsPath(projectPath) : null;
  const projectSettings = projectSettingsPath ? readSettingsFile(projectSettingsPath) : { hooks: {} };

  return {
    global: {
      path: GLOBAL_SETTINGS_PATH,
      hooks: globalSettings.hooks || {}
    },
    project: {
      path: projectSettingsPath,
      hooks: projectSettings.hooks || {}
    }
  };
}

/**
 * Save a hook to settings file
 * @param {string} projectPath
 * @param {string} scope - 'global' or 'project'
 * @param {string} event - Hook event type
 * @param {Object} hookData - Hook configuration
 * @returns {Object}
 */
function saveHookToSettings(projectPath, scope, event, hookData) {
  try {
    const filePath = scope === 'global' ? GLOBAL_SETTINGS_PATH : getProjectSettingsPath(projectPath);
    const settings = readSettingsFile(filePath);

    // Ensure hooks object exists
    if (!settings.hooks) {
      settings.hooks = {};
    }

    // Ensure the event array exists
    if (!settings.hooks[event]) {
      settings.hooks[event] = [];
    }

    // Ensure it's an array
    if (!Array.isArray(settings.hooks[event])) {
      settings.hooks[event] = [settings.hooks[event]];
    }

    // Check if we're replacing an existing hook
    if (hookData.replaceIndex !== undefined) {
      const index = hookData.replaceIndex;
      delete hookData.replaceIndex;
      if (index >= 0 && index < settings.hooks[event].length) {
        settings.hooks[event][index] = hookData;
      }
    } else {
      // Add new hook
      settings.hooks[event].push(hookData);
    }

    // Ensure directory exists and write file
    const dirPath = dirname(filePath);
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
    writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8');

    return {
      success: true,
      event,
      hookData
    };
  } catch (error) {
    console.error('Error saving hook:', error);
    return { error: error.message };
  }
}

/**
 * Delete a hook from settings file
 * @param {string} projectPath
 * @param {string} scope - 'global' or 'project'
 * @param {string} event - Hook event type
 * @param {number} hookIndex - Index of hook to delete
 * @returns {Object}
 */
function deleteHookFromSettings(projectPath, scope, event, hookIndex) {
  try {
    const filePath = scope === 'global' ? GLOBAL_SETTINGS_PATH : getProjectSettingsPath(projectPath);
    const settings = readSettingsFile(filePath);

    if (!settings.hooks || !settings.hooks[event]) {
      return { error: 'Hook not found' };
    }

    // Ensure it's an array
    if (!Array.isArray(settings.hooks[event])) {
      settings.hooks[event] = [settings.hooks[event]];
    }

    if (hookIndex < 0 || hookIndex >= settings.hooks[event].length) {
      return { error: 'Invalid hook index' };
    }

    // Remove the hook
    settings.hooks[event].splice(hookIndex, 1);

    // Remove empty event arrays
    if (settings.hooks[event].length === 0) {
      delete settings.hooks[event];
    }

    writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8');

    return {
      success: true,
      event,
      hookIndex
    };
  } catch (error) {
    console.error('Error deleting hook:', error);
    return { error: error.message };
  }
}
