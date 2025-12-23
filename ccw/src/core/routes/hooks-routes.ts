// @ts-nocheck
/**
 * Hooks Routes Module
 * Handles all hooks-related API endpoints
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

export interface RouteContext {
  pathname: string;
  url: URL;
  req: IncomingMessage;
  res: ServerResponse;
  initialPath: string;
  handlePostRequest: (req: IncomingMessage, res: ServerResponse, handler: (body: unknown) => Promise<any>) => void;
  broadcastToClients: (data: unknown) => void;
  extractSessionIdFromPath: (filePath: string) => string | null;
}

// ========================================
// Helper Functions
// ========================================

const GLOBAL_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');

/**
 * Get project settings path
 * @param {string} projectPath
 * @returns {string}
 */
function getProjectSettingsPath(projectPath) {
  // path.join automatically handles cross-platform path separators
  return join(projectPath, '.claude', 'settings.json');
}

/**
 * Read settings file safely
 * @param {string} filePath
 * @returns {Object}
 */
function readSettingsFile(filePath) {
  try {
    if (!existsSync(filePath)) {
      return {};
    }
    const content = readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error: unknown) {
    console.error(`Error reading settings file ${filePath}:`, error);
    return {};
  }
}

/**
 * Get hooks configuration from global and project settings
 * @param {string} projectPath
 * @returns {Object}
 */
function getHooksConfig(projectPath) {
  const globalSettings = readSettingsFile(GLOBAL_SETTINGS_PATH);
  const projectSettingsPath = projectPath ? getProjectSettingsPath(projectPath) : null;
  const projectSettings = projectSettingsPath ? readSettingsFile(projectSettingsPath) : {};

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
  } catch (error: unknown) {
    console.error('Error saving hook:', error);
    return { error: (error as Error).message };
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
  } catch (error: unknown) {
    console.error('Error deleting hook:', error);
    return { error: (error as Error).message };
  }
}

// ========================================
// Session State Tracking (for progressive disclosure)
// ========================================

// Track sessions that have received startup context
// Key: sessionId, Value: timestamp of first context load
const sessionContextState = new Map<string, {
  firstLoad: string;
  loadCount: number;
  lastPrompt?: string;
}>();

// Cleanup old sessions (older than 24 hours)
function cleanupOldSessions() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [sessionId, state] of sessionContextState.entries()) {
    if (new Date(state.firstLoad).getTime() < cutoff) {
      sessionContextState.delete(sessionId);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupOldSessions, 60 * 60 * 1000);

// ========================================
// Route Handler
// ========================================

/**
 * Handle hooks routes
 * @returns true if route was handled, false otherwise
 */
export async function handleHooksRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath, handlePostRequest, broadcastToClients, extractSessionIdFromPath } = ctx;

  // API: Hook endpoint for Claude Code notifications
  if (pathname === '/api/hook' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { type, filePath, sessionId, ...extraData } = body;

      // Determine session ID from file path if not provided
      let resolvedSessionId = sessionId;
      if (!resolvedSessionId && filePath) {
        resolvedSessionId = extractSessionIdFromPath(filePath);
      }

      // Handle context hooks (session-start, context)
      if (type === 'session-start' || type === 'context') {
        try {
          const projectPath = url.searchParams.get('path') || initialPath;
          const { SessionClusteringService } = await import('../session-clustering-service.js');
          const clusteringService = new SessionClusteringService(projectPath);

          const format = url.searchParams.get('format') || 'markdown';

          // Pass type and prompt to getProgressiveIndex
          // session-start: returns recent sessions by time
          // context: returns intent-matched sessions based on prompt
          const index = await clusteringService.getProgressiveIndex({
            type: type as 'session-start' | 'context',
            sessionId: resolvedSessionId,
            prompt: extraData.prompt // Pass user prompt for intent matching
          });

          // Return context directly
          return {
            success: true,
            type: 'context',
            format,
            content: index,
            sessionId: resolvedSessionId
          };
        } catch (error) {
          console.error('[Hooks] Failed to generate context:', error);
          // Return empty content on failure (fail silently)
          return {
            success: true,
            type: 'context',
            format: 'markdown',
            content: '',
            sessionId: resolvedSessionId,
            error: (error as Error).message
          };
        }
      }

      // Broadcast to all connected WebSocket clients
      const notification = {
        type: type || 'session_updated',
        payload: {
          sessionId: resolvedSessionId,
          filePath: filePath,
          timestamp: new Date().toISOString(),
          ...extraData  // Pass through toolName, status, result, params, error, etc.
        }
      };

      broadcastToClients(notification);

      return { success: true, notification };
    });
    return true;
  }

  // API: Unified Session Context endpoint (Progressive Disclosure)
  // Automatically detects first prompt vs subsequent prompts
  // - First prompt: returns cluster-based session overview
  // - Subsequent prompts: returns intent-matched sessions based on prompt
  if (pathname === '/api/hook/session-context' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { sessionId, prompt } = body as { sessionId?: string; prompt?: string };

      if (!sessionId) {
        return {
          success: true,
          content: '',
          error: 'sessionId is required'
        };
      }

      try {
        const projectPath = url.searchParams.get('path') || initialPath;
        const { SessionClusteringService } = await import('../session-clustering-service.js');
        const clusteringService = new SessionClusteringService(projectPath);

        // Check if this is the first prompt for this session
        const existingState = sessionContextState.get(sessionId);
        const isFirstPrompt = !existingState;

        // Update session state
        if (isFirstPrompt) {
          sessionContextState.set(sessionId, {
            firstLoad: new Date().toISOString(),
            loadCount: 1,
            lastPrompt: prompt
          });
        } else {
          existingState.loadCount++;
          existingState.lastPrompt = prompt;
        }

        // Determine which type of context to return
        let contextType: 'session-start' | 'context';
        let content: string;

        if (isFirstPrompt) {
          // First prompt: return session overview with clusters
          contextType = 'session-start';
          content = await clusteringService.getProgressiveIndex({
            type: 'session-start',
            sessionId
          });
        } else if (prompt && prompt.trim().length > 0) {
          // Subsequent prompts with content: return intent-matched sessions
          contextType = 'context';
          content = await clusteringService.getProgressiveIndex({
            type: 'context',
            sessionId,
            prompt
          });
        } else {
          // Subsequent prompts without content: return minimal context
          contextType = 'context';
          content = ''; // No context needed for empty prompts
        }

        return {
          success: true,
          type: contextType,
          isFirstPrompt,
          loadCount: sessionContextState.get(sessionId)?.loadCount || 1,
          content,
          sessionId
        };
      } catch (error) {
        console.error('[Hooks] Failed to generate session context:', error);
        return {
          success: true,
          content: '',
          sessionId,
          error: (error as Error).message
        };
      }
    });
    return true;
  }

  // API: Get hooks configuration
  if (pathname === '/api/hooks' && req.method === 'GET') {
    const projectPathParam = url.searchParams.get('path');
    const hooksData = getHooksConfig(projectPathParam);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(hooksData));
    return true;
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
    return true;
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
    return true;
  }

  return false;
}
