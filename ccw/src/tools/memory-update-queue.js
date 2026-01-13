/**
 * Memory Update Queue Tool
 * Queue mechanism for batching CLAUDE.md updates
 *
 * Configuration:
 * - Threshold: 5 paths trigger update
 * - Timeout: 5 minutes auto-trigger
 * - Storage: ~/.claude/.memory-queue.json
 * - Deduplication: Same path only kept once
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { homedir } from 'os';

// Configuration constants
const QUEUE_THRESHOLD = 5;
const QUEUE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const QUEUE_FILE_PATH = join(homedir(), '.claude', '.memory-queue.json');

// In-memory timeout reference (for cross-call persistence, we track via file timestamp)
let scheduledTimeoutId = null;

/**
 * Ensure parent directory exists
 */
function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Load queue from file
 * @returns {{ items: Array<{path: string, tool: string, strategy: string, addedAt: string}>, createdAt: string | null }}
 */
function loadQueue() {
  try {
    if (existsSync(QUEUE_FILE_PATH)) {
      const content = readFileSync(QUEUE_FILE_PATH, 'utf8');
      const data = JSON.parse(content);
      return {
        items: Array.isArray(data.items) ? data.items : [],
        createdAt: data.createdAt || null
      };
    }
  } catch (e) {
    console.error('[MemoryQueue] Failed to load queue:', e.message);
  }
  return { items: [], createdAt: null };
}

/**
 * Save queue to file
 * @param {{ items: Array<{path: string, tool: string, strategy: string, addedAt: string}>, createdAt: string | null }} data
 */
function saveQueue(data) {
  try {
    ensureDir(QUEUE_FILE_PATH);
    writeFileSync(QUEUE_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[MemoryQueue] Failed to save queue:', e.message);
    throw e;
  }
}

/**
 * Normalize path for comparison (handle Windows/Unix differences)
 * @param {string} p
 * @returns {string}
 */
function normalizePath(p) {
  return resolve(p).replace(/\\/g, '/').toLowerCase();
}

/**
 * Add path to queue with deduplication
 * @param {string} path - Module path to update
 * @param {{ tool?: string, strategy?: string }} options
 * @returns {{ queued: boolean, queueSize: number, willFlush: boolean, message: string }}
 */
function addToQueue(path, options = {}) {
  const { tool = 'gemini', strategy = 'single-layer' } = options;
  const queue = loadQueue();
  const normalizedPath = normalizePath(path);
  const now = new Date().toISOString();

  // Check for duplicates
  const existingIndex = queue.items.findIndex(
    item => normalizePath(item.path) === normalizedPath
  );

  if (existingIndex !== -1) {
    // Update existing entry timestamp but keep it deduplicated
    queue.items[existingIndex].addedAt = now;
    queue.items[existingIndex].tool = tool;
    queue.items[existingIndex].strategy = strategy;
    saveQueue(queue);

    return {
      queued: false,
      queueSize: queue.items.length,
      willFlush: queue.items.length >= QUEUE_THRESHOLD,
      message: `Path already in queue (updated): ${path}`
    };
  }

  // Add new item
  queue.items.push({
    path,
    tool,
    strategy,
    addedAt: now
  });

  // Set createdAt if this is the first item
  if (!queue.createdAt) {
    queue.createdAt = now;
  }

  saveQueue(queue);

  const willFlush = queue.items.length >= QUEUE_THRESHOLD;

  // Schedule timeout if not already scheduled
  scheduleTimeout();

  return {
    queued: true,
    queueSize: queue.items.length,
    willFlush,
    message: willFlush
      ? `Queue threshold reached (${queue.items.length}/${QUEUE_THRESHOLD}), will flush`
      : `Added to queue (${queue.items.length}/${QUEUE_THRESHOLD})`
  };
}

/**
 * Get current queue status
 * @returns {{ queueSize: number, threshold: number, items: Array, timeoutMs: number | null, createdAt: string | null }}
 */
function getQueueStatus() {
  const queue = loadQueue();
  let timeUntilTimeout = null;

  if (queue.createdAt && queue.items.length > 0) {
    const createdTime = new Date(queue.createdAt).getTime();
    const elapsed = Date.now() - createdTime;
    timeUntilTimeout = Math.max(0, QUEUE_TIMEOUT_MS - elapsed);
  }

  return {
    queueSize: queue.items.length,
    threshold: QUEUE_THRESHOLD,
    items: queue.items,
    timeoutMs: QUEUE_TIMEOUT_MS,
    timeUntilTimeout,
    createdAt: queue.createdAt
  };
}

/**
 * Flush queue - execute batch update
 * @returns {Promise<{ success: boolean, processed: number, results: Array, errors: Array }>}
 */
async function flushQueue() {
  const queue = loadQueue();

  if (queue.items.length === 0) {
    return {
      success: true,
      processed: 0,
      results: [],
      errors: [],
      message: 'Queue is empty'
    };
  }

  // Clear timeout
  clearScheduledTimeout();

  // Import update_module_claude dynamically to avoid circular deps
  const { updateModuleClaudeTool } = await import('./update-module-claude.js');

  const results = [];
  const errors = [];

  // Group by tool and strategy for efficiency
  const groups = new Map();
  for (const item of queue.items) {
    const key = `${item.tool}:${item.strategy}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  }

  // Process each group
  for (const [key, items] of groups) {
    const [tool, strategy] = key.split(':');
    console.log(`[MemoryQueue] Processing ${items.length} items with ${tool}/${strategy}`);

    for (const item of items) {
      try {
        const result = await updateModuleClaudeTool.execute({
          path: item.path,
          tool: item.tool,
          strategy: item.strategy
        });

        results.push({
          path: item.path,
          success: result.success !== false,
          result
        });
      } catch (e) {
        console.error(`[MemoryQueue] Failed to update ${item.path}:`, e.message);
        errors.push({
          path: item.path,
          error: e.message
        });
      }
    }
  }

  // Clear queue after processing
  saveQueue({ items: [], createdAt: null });

  return {
    success: errors.length === 0,
    processed: queue.items.length,
    results,
    errors,
    message: `Processed ${results.length} items, ${errors.length} errors`
  };
}

/**
 * Schedule timeout for auto-flush
 */
function scheduleTimeout() {
  // We use file-based timeout tracking for persistence across process restarts
  // The actual timeout check happens on next add/status call
  const queue = loadQueue();

  if (!queue.createdAt || queue.items.length === 0) {
    return;
  }

  const createdTime = new Date(queue.createdAt).getTime();
  const elapsed = Date.now() - createdTime;

  if (elapsed >= QUEUE_TIMEOUT_MS) {
    // Timeout already exceeded, should flush
    console.log('[MemoryQueue] Timeout exceeded, auto-flushing');
    // Don't await here to avoid blocking
    flushQueue().catch(e => {
      console.error('[MemoryQueue] Auto-flush failed:', e.message);
    });
  } else if (!scheduledTimeoutId) {
    // Schedule in-memory timeout for current process
    const remaining = QUEUE_TIMEOUT_MS - elapsed;
    scheduledTimeoutId = setTimeout(() => {
      scheduledTimeoutId = null;
      const currentQueue = loadQueue();
      if (currentQueue.items.length > 0) {
        console.log('[MemoryQueue] Timeout reached, auto-flushing');
        flushQueue().catch(e => {
          console.error('[MemoryQueue] Auto-flush failed:', e.message);
        });
      }
    }, remaining);

    // Prevent timeout from keeping process alive
    if (scheduledTimeoutId.unref) {
      scheduledTimeoutId.unref();
    }
  }
}

/**
 * Clear scheduled timeout
 */
function clearScheduledTimeout() {
  if (scheduledTimeoutId) {
    clearTimeout(scheduledTimeoutId);
    scheduledTimeoutId = null;
  }
}

/**
 * Check if timeout has expired and auto-flush if needed
 * @returns {Promise<{ expired: boolean, flushed: boolean, result?: object }>}
 */
async function checkTimeout() {
  const queue = loadQueue();

  if (!queue.createdAt || queue.items.length === 0) {
    return { expired: false, flushed: false };
  }

  const createdTime = new Date(queue.createdAt).getTime();
  const elapsed = Date.now() - createdTime;

  if (elapsed >= QUEUE_TIMEOUT_MS) {
    console.log('[MemoryQueue] Timeout expired, triggering flush');
    const result = await flushQueue();
    return { expired: true, flushed: true, result };
  }

  return { expired: false, flushed: false };
}

/**
 * Main execute function for tool interface
 * @param {Record<string, unknown>} params
 * @returns {Promise<unknown>}
 */
async function execute(params) {
  const { action, path, tool = 'gemini', strategy = 'single-layer' } = params;

  switch (action) {
    case 'add':
      if (!path) {
        throw new Error('Parameter "path" is required for add action');
      }
      // Check timeout first
      const timeoutCheck = await checkTimeout();
      if (timeoutCheck.flushed) {
        // Queue was flushed due to timeout, add to fresh queue
        const result = addToQueue(path, { tool, strategy });
        return {
          ...result,
          timeoutFlushed: true,
          flushResult: timeoutCheck.result
        };
      }

      const addResult = addToQueue(path, { tool, strategy });

      // Auto-flush if threshold reached
      if (addResult.willFlush) {
        const flushResult = await flushQueue();
        return {
          ...addResult,
          flushed: true,
          flushResult
        };
      }

      return addResult;

    case 'status':
      // Check timeout first
      await checkTimeout();
      return getQueueStatus();

    case 'flush':
      return await flushQueue();

    default:
      throw new Error(`Unknown action: ${action}. Valid actions: add, status, flush`);
  }
}

/**
 * Tool Definition
 */
export const memoryQueueTool = {
  name: 'memory_queue',
  description: `Memory update queue management. Batches CLAUDE.md updates for efficiency.

Actions:
- add: Add path to queue (auto-flushes at threshold ${QUEUE_THRESHOLD} or timeout ${QUEUE_TIMEOUT_MS / 1000}s)
- status: Get queue status
- flush: Immediately execute all queued updates`,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['add', 'status', 'flush'],
        description: 'Queue action to perform'
      },
      path: {
        type: 'string',
        description: 'Module directory path (required for add action)'
      },
      tool: {
        type: 'string',
        enum: ['gemini', 'qwen', 'codex'],
        description: 'CLI tool to use (default: gemini)',
        default: 'gemini'
      },
      strategy: {
        type: 'string',
        enum: ['single-layer', 'multi-layer'],
        description: 'Update strategy (default: single-layer)',
        default: 'single-layer'
      }
    },
    required: ['action']
  },
  execute
};

// Export individual functions for direct use
export {
  loadQueue,
  saveQueue,
  addToQueue,
  getQueueStatus,
  flushQueue,
  scheduleTimeout,
  clearScheduledTimeout,
  checkTimeout,
  QUEUE_THRESHOLD,
  QUEUE_TIMEOUT_MS,
  QUEUE_FILE_PATH
};
