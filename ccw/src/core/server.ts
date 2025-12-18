// @ts-nocheck
import http from 'http';
import { URL } from 'url';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { resolvePath, getRecentPaths, normalizePathForDisplay } from '../utils/path-resolver.js';

// Import route handlers
import { handleStatusRoutes } from './routes/status-routes.js';
import { handleCliRoutes } from './routes/cli-routes.js';
import { handleMemoryRoutes } from './routes/memory-routes.js';
import { handleCoreMemoryRoutes } from './routes/core-memory-routes.js';
import { handleMcpRoutes } from './routes/mcp-routes.js';
import { handleHooksRoutes } from './routes/hooks-routes.js';
import { handleCodexLensRoutes } from './routes/codexlens-routes.js';
import { handleGraphRoutes } from './routes/graph-routes.js';
import { handleSystemRoutes } from './routes/system-routes.js';
import { handleFilesRoutes } from './routes/files-routes.js';
import { handleSkillsRoutes } from './routes/skills-routes.js';
import { handleRulesRoutes } from './routes/rules-routes.js';
import { handleSessionRoutes } from './routes/session-routes.js';
import { handleCcwRoutes } from './routes/ccw-routes.js';
import { handleClaudeRoutes } from './routes/claude-routes.js';
import { handleHelpRoutes } from './routes/help-routes.js';

// Import WebSocket handling
import { handleWebSocketUpgrade, broadcastToClients } from './websocket.js';

import type { ServerConfig } from '../types/config.js';

interface ServerOptions {
  port?: number;
  initialPath?: string;
  host?: string;
  open?: boolean;
}

interface PostResult {
  error?: string;
  status?: number;
  [key: string]: unknown;
}

type PostHandler = (body: unknown) => Promise<PostResult>;

// Template paths
const TEMPLATE_PATH = join(import.meta.dirname, '../../src/templates/dashboard.html');
const MODULE_CSS_DIR = join(import.meta.dirname, '../../src/templates/dashboard-css');
const JS_FILE = join(import.meta.dirname, '../../src/templates/dashboard.js');
const MODULE_JS_DIR = join(import.meta.dirname, '../../src/templates/dashboard-js');
const ASSETS_DIR = join(import.meta.dirname, '../../src/templates/assets');

// Modular CSS files in load order
const MODULE_CSS_FILES = [
  '01-base.css',
  '02-session.css',
  '03-tasks.css',
  '04-lite-tasks.css',
  '05-context.css',
  '06-cards.css',
  '07-managers.css',
  '08-review.css',
  '09-explorer.css',
  // CLI modules (split from 10-cli.css)
  '10-cli-status.css',
  '11-cli-history.css',
  '12-cli-legacy.css',
  '13-cli-ccw.css',
  '14-cli-modals.css',
  '15-cli-endpoints.css',
  '16-cli-session.css',
  '17-cli-conversation.css',
  '18-cli-settings.css',
  '19-cli-native-session.css',
  '20-cli-taskqueue.css',
  '21-cli-toolmgmt.css',
  '22-cli-semantic.css',
  // Other modules
  '23-memory.css',
  '24-prompt-history.css',
  '25-skills-rules.css',
  '26-claude-manager.css',
  '27-graph-explorer.css',
  '28-mcp-manager.css',
  '29-help.css',
  '30-core-memory.css'
];

// Modular JS files in dependency order
const MODULE_FILES = [
  'i18n.js',  // Must be loaded first for translations
  'help-i18n.js',  // Help page translations
  'utils.js',
  'state.js',
  'api.js',
  'components/theme.js',
  'components/modals.js',
  'components/navigation.js',
  'components/sidebar.js',
  'components/tabs-context.js',
  'components/tabs-other.js',
  'components/task-drawer-core.js',
  'components/task-drawer-renderers.js',
  'components/flowchart.js',
  'components/carousel.js',
  'components/notifications.js',
  'components/global-notifications.js',
  'components/task-queue-sidebar.js',
  'components/cli-status.js',
  'components/cli-history.js',
  'components/mcp-manager.js',
  'components/hook-manager.js',
  'components/version-check.js',
  'components/storage-manager.js',
  'components/index-manager.js',
  'components/_exp_helpers.js',
  'components/_conflict_tab.js',
  'components/_review_tab.js',
  'views/home.js',
  'views/project-overview.js',
  'views/session-detail.js',
  'views/review-session.js',
  'views/lite-tasks.js',
  'views/fix-session.js',
  'views/cli-manager.js',
  'views/codexlens-manager.js',
  'views/explorer.js',
  'views/mcp-manager.js',
  'views/hook-manager.js',
  'views/history.js',
  'views/graph-explorer.js',
  'views/memory.js',
  'views/core-memory.js',
  'views/core-memory-graph.js',
  'views/core-memory-clusters.js',
  'views/prompt-history.js',
  'views/skills-manager.js',
  'views/rules-manager.js',
  'views/claude-manager.js',
  'views/help.js',
  'main.js'
];

/**
 * Handle POST request with JSON body
 */
function handlePostRequest(req: http.IncomingMessage, res: http.ServerResponse, handler: PostHandler): void {
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
    } catch (error: unknown) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
  });
}

/**
 * Generate dashboard HTML with embedded CSS and JS
 */
function generateServerDashboard(initialPath: string): string {
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

  // Add server mode flag at the start of JS
  const serverModeScript = `
// Server mode - load data dynamically
window.SERVER_MODE = true;
window.INITIAL_PATH = '${normalizePathForDisplay(initialPath).replace(/\\/g, '/')}';
`;

  // Prepend server mode script to JS content
  jsContent = serverModeScript + jsContent;

  // Inject JS content
  html = html.replace('{{JS_CONTENT}}', jsContent);

  // Replace any remaining placeholders in HTML
  html = html.replace(/\{\{PROJECT_PATH\}\}/g, normalizePathForDisplay(initialPath).replace(/\\/g, '/'));

  return html;
}

/**
 * Create and start the dashboard server
 * @param {Object} options - Server options
 * @param {number} options.port - Port to listen on (default: 3456)
 * @param {string} options.initialPath - Initial project path
 * @returns {Promise<http.Server>}
 */
export async function startServer(options: ServerOptions = {}): Promise<http.Server> {
  const port = options.port || 3456;
  const initialPath = options.initialPath || process.cwd();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const pathname = url.pathname;

    // CORS headers for API requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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

      // Route context for all handlers
      const routeContext = {
        pathname,
        url,
        req,
        res,
        initialPath,
        handlePostRequest,
        broadcastToClients,
        server
      };

      // Try each route handler in order
      // Order matters: more specific routes should come before general ones

      // Status routes (/api/status/*) - Aggregated endpoint for faster loading
      if (pathname.startsWith('/api/status/')) {
        if (await handleStatusRoutes(routeContext)) return;
      }

      // CLI routes (/api/cli/*)
      if (pathname.startsWith('/api/cli/')) {
        if (await handleCliRoutes(routeContext)) return;
      }

      // Claude CLAUDE.md routes (/api/memory/claude/*) and Language routes (/api/language/*)
      if (pathname.startsWith('/api/memory/claude/') || pathname.startsWith('/api/language/')) {
        if (await handleClaudeRoutes(routeContext)) return;
      }

      // Memory routes (/api/memory/*)
      if (pathname.startsWith('/api/memory/')) {
        if (await handleMemoryRoutes(routeContext)) return;
      }

      // Core Memory routes (/api/core-memory/*)
      if (pathname.startsWith('/api/core-memory/')) {
        if (await handleCoreMemoryRoutes(routeContext)) return;
      }


      // MCP routes (/api/mcp*, /api/codex-mcp*)
      if (pathname.startsWith('/api/mcp') || pathname.startsWith('/api/codex-mcp')) {
        if (await handleMcpRoutes(routeContext)) return;
      }

      // Hooks routes (/api/hooks, /api/hook)
      if (pathname.startsWith('/api/hook')) {
        if (await handleHooksRoutes(routeContext)) return;
      }

      // CodexLens routes (/api/codexlens/*)
      if (pathname.startsWith('/api/codexlens/')) {
        if (await handleCodexLensRoutes(routeContext)) return;
      }

      // Graph routes (/api/graph/*)
      if (pathname.startsWith('/api/graph/')) {
        if (await handleGraphRoutes(routeContext)) return;
      }

      // CCW routes (/api/ccw/*)
      if (pathname.startsWith('/api/ccw/')) {
        if (await handleCcwRoutes(routeContext)) return;
      }

      // Skills routes (/api/skills*)
      if (pathname.startsWith('/api/skills')) {
        if (await handleSkillsRoutes(routeContext)) return;
      }

      // Rules routes (/api/rules*)
      if (pathname.startsWith('/api/rules')) {
        if (await handleRulesRoutes(routeContext)) return;
      }

      // Help routes (/api/help/*)
      if (pathname.startsWith('/api/help/')) {
        if (await handleHelpRoutes(routeContext)) return;
      }

      // Session routes (/api/session-detail, /api/update-task-status, /api/bulk-update-task-status)
      if (pathname.includes('session') || pathname.includes('task-status')) {
        if (await handleSessionRoutes(routeContext)) return;
      }

      // Files routes (/api/files, /api/file, /api/file-content, /api/update-claude-md)
      if (pathname === '/api/files' || pathname === '/api/file' ||
          pathname === '/api/file-content' || pathname === '/api/update-claude-md') {
        if (await handleFilesRoutes(routeContext)) return;
      }

      // System routes (data, health, version, paths, shutdown, notify, storage)
      if (pathname === '/api/data' || pathname === '/api/health' ||
          pathname === '/api/version-check' || pathname === '/api/shutdown' ||
          pathname === '/api/recent-paths' || pathname === '/api/switch-path' ||
          pathname === '/api/remove-recent-path' || pathname === '/api/system/notify' ||
          pathname.startsWith('/api/storage/')) {
        if (await handleSystemRoutes(routeContext)) return;
      }

      // Serve dashboard HTML
      if (pathname === '/' || pathname === '/index.html') {
        const html = generateServerDashboard(initialPath);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      // Handle favicon.ico (return empty response to prevent 404)
      if (pathname === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Serve static assets (js, css, images, fonts)
      if (pathname.startsWith('/assets/')) {
        const assetPath = join(ASSETS_DIR, pathname.replace('/assets/', ''));
        if (existsSync(assetPath)) {
          const ext = assetPath.split('.').pop().toLowerCase();
          const mimeTypes = {
            'js': 'application/javascript',
            'css': 'text/css',
            'json': 'application/json',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'svg': 'image/svg+xml',
            'woff': 'font/woff',
            'woff2': 'font/woff2',
            'ttf': 'font/ttf'
          };
          const contentType = mimeTypes[ext] || 'application/octet-stream';
          const content = readFileSync(assetPath);
          res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache, must-revalidate'
          });
          res.end(content);
          return;
        }
      }

      // 404
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');

    } catch (error: unknown) {
      console.error('Server error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (error as Error).message }));
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
