/**
 * Notifier Module - CLI to Server Communication
 * Provides best-effort notification to running CCW Server
 * when CLI commands modify data that should trigger UI updates
 */

import http from 'http';

// Default server configuration
const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 3456;
const NOTIFY_TIMEOUT = 2000; // 2 seconds - quick timeout for best-effort

export type NotifyScope = 'memory' | 'history' | 'insights' | 'all';

export interface NotifyPayload {
  type: 'REFRESH_REQUIRED' | 'MEMORY_UPDATED' | 'HISTORY_UPDATED' | 'INSIGHT_GENERATED';
  scope: NotifyScope;
  data?: {
    entityType?: string;
    entityId?: string | number;
    action?: string;
    executionId?: string;
    [key: string]: unknown;
  };
}

export interface NotifyResult {
  success: boolean;
  error?: string;
}

/**
 * Send notification to CCW Server (best-effort, non-blocking)
 * If server is not running or unreachable, silently fails
 */
export async function notifyServer(
  payload: NotifyPayload,
  options?: { host?: string; port?: number }
): Promise<NotifyResult> {
  const host = options?.host || DEFAULT_HOST;
  const port = options?.port || DEFAULT_PORT;

  return new Promise((resolve) => {
    const postData = JSON.stringify(payload);

    const req = http.request(
      {
        hostname: host,
        port: port,
        path: '/api/system/notify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: NOTIFY_TIMEOUT,
      },
      (res) => {
        // Success if we get a 2xx response
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: `HTTP ${res.statusCode}` });
        }
      }
    );

    // Handle errors silently - server may not be running
    req.on('error', () => {
      resolve({ success: false, error: 'Server not reachable' });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Convenience: Notify memory update
 */
export async function notifyMemoryUpdate(data?: {
  entityType?: string;
  entityId?: string | number;
  action?: string;
}): Promise<NotifyResult> {
  return notifyServer({
    type: 'MEMORY_UPDATED',
    scope: 'memory',
    data,
  });
}

/**
 * Convenience: Notify CLI history update
 */
export async function notifyHistoryUpdate(executionId?: string): Promise<NotifyResult> {
  return notifyServer({
    type: 'HISTORY_UPDATED',
    scope: 'history',
    data: executionId ? { executionId } : undefined,
  });
}

/**
 * Convenience: Notify insight generated
 */
export async function notifyInsightGenerated(executionId?: string): Promise<NotifyResult> {
  return notifyServer({
    type: 'INSIGHT_GENERATED',
    scope: 'insights',
    data: executionId ? { executionId } : undefined,
  });
}

/**
 * Convenience: Request full refresh
 */
export async function notifyRefreshRequired(scope: NotifyScope = 'all'): Promise<NotifyResult> {
  return notifyServer({
    type: 'REFRESH_REQUIRED',
    scope,
  });
}
