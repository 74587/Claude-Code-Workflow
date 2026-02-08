/**
 * E2E: ask_question Answer Broker
 *
 * Verifies that when the MCP server runs as a separate stdio process (no local WS clients),
 * `ask_question` forwards the surface to the Dashboard via /api/hook and later retrieves
 * the user's answer via /api/a2ui/answer polling.
 */
import { after, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverUrl = new URL('../../dist/core/server.js', import.meta.url);
serverUrl.searchParams.set('t', String(Date.now()));

interface JsonRpcRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params: any;
}

interface JsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

class McpClient {
  private serverProcess!: ChildProcess;
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve: (r: JsonRpcResponse) => void; reject: (e: Error) => void }>();

  private env: Record<string, string | undefined>;

  constructor(env: Record<string, string | undefined>) {
    this.env = env;
  }

  async start(): Promise<void> {
    const serverPath = join(__dirname, '../../bin/ccw-mcp.js');
    this.serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...this.env },
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('MCP server start timeout')), 15000);
      this.serverProcess.stderr!.on('data', (data) => {
        const message = data.toString();
        if (message.includes('started') || message.includes('ccw-tools')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      this.serverProcess.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    this.serverProcess.stdout!.on('data', (data) => {
      try {
        const lines = data.toString().split('\n').filter((l: string) => l.trim());
        for (const line of lines) {
          const response: JsonRpcResponse = JSON.parse(line);
          const pending = this.pendingRequests.get(response.id);
          if (pending) {
            this.pendingRequests.delete(response.id);
            pending.resolve(response);
          }
        }
      } catch {
        // ignore parse errors
      }
    });
  }

  async call(method: string, params: any = {}, timeoutMs = 10000): Promise<JsonRpcResponse> {
    const id = ++this.requestId;
    const request: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout for ${method}`));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (response) => {
          clearTimeout(timeout);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.serverProcess.stdin!.write(JSON.stringify(request) + '\n');
    });
  }

  stop(): void {
    this.serverProcess?.kill();
  }
}

function waitForWebSocketOpen(ws: WebSocket, timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('WebSocket open timeout')), timeoutMs);
    ws.addEventListener('open', () => {
      clearTimeout(t);
      resolve();
    });
    ws.addEventListener('error', () => {
      clearTimeout(t);
      reject(new Error('WebSocket error'));
    });
  });
}

function waitForA2UISurface(ws: WebSocket, timeoutMs = 15000): Promise<any> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Timed out waiting for a2ui-surface')), timeoutMs);
    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(String(event.data));
        if (data?.type === 'a2ui-surface' && data?.payload?.initialState?.questionId) {
          clearTimeout(t);
          ws.removeEventListener('message', handler);
          resolve(data);
        }
      } catch {
        // ignore
      }
    };
    ws.addEventListener('message', handler);
  });
}

function httpRequest(options: http.RequestOptions, body?: string, timeout = 10000): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode || 0, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    if (body) req.write(body);
    req.end();
  });
}

describe('E2E: ask_question Answer Broker', async () => {
  let server: http.Server;
  let port: number;
  let projectRoot: string;
  const originalCwd = process.cwd();
  let mcp: McpClient;
  let ws: WebSocket;

  before(async () => {
    process.env.CCW_DISABLE_WARMUP = '1';

    projectRoot = mkdtempSync(join(tmpdir(), 'ccw-e2e-askq-'));
    process.chdir(projectRoot);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serverMod: any = await import(serverUrl.href);
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});

    server = await serverMod.startServer({ initialPath: projectRoot, port: 0 });
    const addr = server.address();
    port = typeof addr === 'object' && addr ? addr.port : 0;
    assert.ok(port > 0, 'Server should start on a valid port');

    ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await waitForWebSocketOpen(ws);

    mcp = new McpClient({
      CCW_PROJECT_ROOT: projectRoot,
      CCW_ENABLED_TOOLS: 'all',
      CCW_PORT: String(port),
      CCW_DISABLE_WARMUP: '1',
    });
    await mcp.start();

    // Sanity: broker endpoint should be reachable without auth from localhost
    const broker = await httpRequest({ hostname: '127.0.0.1', port, path: '/api/a2ui/answer?questionId=nonexistent', method: 'GET' });
    assert.equal(broker.status, 200);
  });

  after(async () => {
    try {
      ws?.close();
    } catch {}
    mcp?.stop();

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    process.chdir(originalCwd);
    rmSync(projectRoot, { recursive: true, force: true });
    mock.restoreAll();
  });

  it('returns the answered value via MCP tool call', async () => {
    const questionId = `e2e-q-${Date.now()}`;

    const toolCallPromise = mcp.call(
      'tools/call',
      {
        name: 'ask_question',
        arguments: {
          question: {
            id: questionId,
            type: 'confirm',
            title: 'E2E Confirm',
            message: 'Confirm this in the test harness',
          },
          timeout: 15000,
        },
      },
      30000,
    );

    const surfaceMsg = await waitForA2UISurface(ws, 15000);
    const surfaceId = surfaceMsg.payload.surfaceId as string;
    const receivedQuestionId = surfaceMsg.payload.initialState.questionId as string;
    assert.equal(receivedQuestionId, questionId);

    ws.send(
      JSON.stringify({
        type: 'a2ui-action',
        actionId: 'confirm',
        surfaceId,
        parameters: { questionId },
        timestamp: new Date().toISOString(),
      }),
    );

    const response = await toolCallPromise;
    assert.equal(response.jsonrpc, '2.0');
    assert.ok(response.result);
    assert.ok(Array.isArray(response.result.content));

    const text = response.result.content[0]?.text as string;
    const parsed = JSON.parse(text);
    const resultObj = parsed.result ?? parsed;

    assert.equal(resultObj.success, true);
    assert.equal(resultObj.cancelled, false);
    assert.ok(Array.isArray(resultObj.answers));
    assert.equal(resultObj.answers[0].questionId, questionId);
    assert.equal(resultObj.answers[0].value, true);
  });
});
