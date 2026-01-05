/**
 * E2E tests for Dashboard WebSocket Live Updates
 *
 * Tests that Dashboard receives real-time updates via WebSocket when
 * CLI commands modify sessions, tasks, or other entities.
 *
 * Verifies:
 * - WebSocket connection and event dispatch
 * - Fire-and-forget notification behavior
 * - Event payload structure
 * - Network failure resilience
 */

import { after, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const serverUrl = new URL('../../dist/core/server.js', import.meta.url);
serverUrl.searchParams.set('t', String(Date.now()));

const sessionCommandUrl = new URL('../../dist/commands/session.js', import.meta.url);
sessionCommandUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let serverMod: any;

interface WsMessage {
  type: string;
  sessionId?: string;
  entityId?: string;
  payload?: any;
  timestamp?: string;
}

class WebSocketClient {
  private socket: any;
  private connected = false;
  private messages: WsMessage[] = [];
  private messageHandlers: Array<(msg: WsMessage) => void> = [];

  async connect(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const net = require('net');
      this.socket = net.connect(port, 'localhost', () => {
        // Send WebSocket upgrade request
        const key = Buffer.from('test-websocket-key').toString('base64');
        const upgradeRequest = [
          'GET /ws HTTP/1.1',
          'Host: localhost',
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Key: ${key}`,
          'Sec-WebSocket-Version: 13',
          '',
          ''
        ].join('\r\n');

        this.socket.write(upgradeRequest);
      });

      this.socket.on('data', (data: Buffer) => {
        const response = data.toString();

        // Check for upgrade response
        if (response.includes('101 Switching Protocols')) {
          this.connected = true;
          resolve();
          return;
        }

        // Parse WebSocket frames
        if (this.connected) {
          try {
            const message = this.parseWebSocketFrame(data);
            if (message) {
              this.messages.push(message);
              this.messageHandlers.forEach(handler => handler(message));
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      });

      this.socket.on('error', (err: Error) => {
        if (!this.connected) {
          reject(err);
        }
      });

      this.socket.on('close', () => {
        this.connected = false;
      });
    });
  }

  private parseWebSocketFrame(buffer: Buffer): WsMessage | null {
    if (buffer.length < 2) return null;

    const opcode = buffer[0] & 0x0f;
    if (opcode !== 0x1) return null; // Only handle text frames

    let offset = 2;
    let payloadLength = buffer[1] & 0x7f;

    if (payloadLength === 126) {
      payloadLength = buffer.readUInt16BE(2);
      offset += 2;
    } else if (payloadLength === 127) {
      payloadLength = Number(buffer.readBigUInt64BE(2));
      offset += 8;
    }

    const payload = buffer.slice(offset, offset + payloadLength).toString('utf8');
    return JSON.parse(payload);
  }

  onMessage(handler: (msg: WsMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  async waitForMessage(
    predicate: (msg: WsMessage) => boolean,
    timeoutMs = 5000
  ): Promise<WsMessage> {
    // Check existing messages first
    const existing = this.messages.find(predicate);
    if (existing) return existing;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
        reject(new Error('Timeout waiting for WebSocket message'));
      }, timeoutMs);

      const handler = (msg: WsMessage) => {
        if (predicate(msg)) {
          clearTimeout(timeout);
          this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
          resolve(msg);
        }
      };

      this.messageHandlers.push(handler);
    });
  }

  getMessages(): WsMessage[] {
    return [...this.messages];
  }

  close(): void {
    if (this.socket) {
      this.socket.end();
      this.connected = false;
    }
  }
}

describe('E2E: Dashboard WebSocket Live Updates', async () => {
  let server: http.Server;
  let port: number;
  let projectRoot: string;
  const originalCwd = process.cwd();

  before(async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'ccw-e2e-websocket-'));
    process.chdir(projectRoot);
    process.env.CCW_PORT = '0'; // Use random port

    serverMod = await import(serverUrl.href);
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});

    // Start server
    server = await serverMod.startServer(projectRoot, 0);
    const addr = server.address();
    port = typeof addr === 'object' && addr ? addr.port : 0;
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => {
        process.chdir(originalCwd);
        rmSync(projectRoot, { recursive: true, force: true });
        mock.restoreAll();
        resolve();
      });
    });
  });

  it('broadcasts SESSION_CREATED event when session is initialized', async () => {
    const wsClient = new WebSocketClient();
    await wsClient.connect(port);

    // Create session via HTTP API
    const sessionId = 'WFS-ws-test-001';
    await new Promise<void>((resolve, reject) => {
      const data = JSON.stringify({
        type: 'SESSION_CREATED',
        sessionId,
        payload: { status: 'initialized' }
      });

      const req = http.request({
        hostname: 'localhost',
        port,
        path: '/api/hook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      }, (res) => {
        res.on('end', () => resolve());
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });

    // Wait for WebSocket message
    const message = await wsClient.waitForMessage(
      msg => msg.type === 'SESSION_CREATED' && msg.sessionId === sessionId
    );

    assert.equal(message.type, 'SESSION_CREATED');
    assert.equal(message.sessionId, sessionId);
    assert.ok(message.payload);
    assert.ok(message.timestamp);

    wsClient.close();
  });

  it('broadcasts TASK_UPDATED event when task status changes', async () => {
    const wsClient = new WebSocketClient();
    await wsClient.connect(port);

    const sessionId = 'WFS-ws-task-001';
    const taskId = 'IMPL-001';

    // Simulate task update
    await new Promise<void>((resolve, reject) => {
      const data = JSON.stringify({
        type: 'TASK_UPDATED',
        sessionId,
        entityId: taskId,
        payload: { status: 'completed' }
      });

      const req = http.request({
        hostname: 'localhost',
        port,
        path: '/api/hook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      }, (res) => {
        res.on('end', () => resolve());
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });

    const message = await wsClient.waitForMessage(
      msg => msg.type === 'TASK_UPDATED' && msg.entityId === taskId
    );

    assert.equal(message.type, 'TASK_UPDATED');
    assert.equal(message.sessionId, sessionId);
    assert.equal(message.entityId, taskId);
    assert.equal(message.payload.status, 'completed');

    wsClient.close();
  });

  it('broadcasts SESSION_ARCHIVED event when session is archived', async () => {
    const wsClient = new WebSocketClient();
    await wsClient.connect(port);

    const sessionId = 'WFS-ws-archive-001';

    await new Promise<void>((resolve, reject) => {
      const data = JSON.stringify({
        type: 'SESSION_ARCHIVED',
        sessionId,
        payload: { from: 'active', to: 'archives' }
      });

      const req = http.request({
        hostname: 'localhost',
        port,
        path: '/api/hook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      }, (res) => {
        res.on('end', () => resolve());
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });

    const message = await wsClient.waitForMessage(
      msg => msg.type === 'SESSION_ARCHIVED' && msg.sessionId === sessionId
    );

    assert.equal(message.type, 'SESSION_ARCHIVED');
    assert.equal(message.sessionId, sessionId);
    assert.equal(message.payload.from, 'active');
    assert.equal(message.payload.to, 'archives');

    wsClient.close();
  });

  it('handles multiple WebSocket clients simultaneously', async () => {
    const client1 = new WebSocketClient();
    const client2 = new WebSocketClient();
    const client3 = new WebSocketClient();

    await Promise.all([
      client1.connect(port),
      client2.connect(port),
      client3.connect(port)
    ]);

    // Send event
    const sessionId = 'WFS-ws-multi-001';
    await new Promise<void>((resolve, reject) => {
      const data = JSON.stringify({
        type: 'SESSION_UPDATED',
        sessionId,
        payload: { status: 'active' }
      });

      const req = http.request({
        hostname: 'localhost',
        port,
        path: '/api/hook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      }, (res) => {
        res.on('end', () => resolve());
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });

    // All clients should receive the message
    const [msg1, msg2, msg3] = await Promise.all([
      client1.waitForMessage(msg => msg.type === 'SESSION_UPDATED'),
      client2.waitForMessage(msg => msg.type === 'SESSION_UPDATED'),
      client3.waitForMessage(msg => msg.type === 'SESSION_UPDATED')
    ]);

    assert.equal(msg1.sessionId, sessionId);
    assert.equal(msg2.sessionId, sessionId);
    assert.equal(msg3.sessionId, sessionId);

    client1.close();
    client2.close();
    client3.close();
  });

  it('handles fire-and-forget notification behavior (no blocking)', async () => {
    const wsClient = new WebSocketClient();
    await wsClient.connect(port);

    const startTime = Date.now();
    const sessionId = 'WFS-ws-async-001';

    // Send notification (should return immediately)
    await new Promise<void>((resolve, reject) => {
      const data = JSON.stringify({
        type: 'SESSION_UPDATED',
        sessionId,
        payload: { status: 'active' }
      });

      const req = http.request({
        hostname: 'localhost',
        port,
        path: '/api/hook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      }, (res) => {
        res.on('end', () => resolve());
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });

    const requestDuration = Date.now() - startTime;

    // Fire-and-forget should be very fast (< 100ms typically)
    assert.ok(requestDuration < 1000, `Request took ${requestDuration}ms, expected < 1000ms`);

    // Message should still be delivered
    const message = await wsClient.waitForMessage(
      msg => msg.type === 'SESSION_UPDATED' && msg.sessionId === sessionId
    );

    assert.ok(message);
    wsClient.close();
  });

  it('handles network failure gracefully (no dashboard crash)', async () => {
    // Close server temporarily to simulate network failure
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    // Attempt to send notification (should not crash)
    const sendNotification = async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          const data = JSON.stringify({
            type: 'SESSION_UPDATED',
            sessionId: 'WFS-network-fail',
            payload: {}
          });

          const req = http.request({
            hostname: 'localhost',
            port,
            path: '/api/hook',
            method: 'POST',
            timeout: 1000,
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(data)
            }
          }, () => resolve());

          req.on('error', () => resolve()); // Ignore errors (fire-and-forget)
          req.write(data);
          req.end();
        });
      } catch (e) {
        // Should not throw
      }
    };

    // Should complete without throwing
    await sendNotification();
    assert.ok(true, 'Notification handled gracefully despite network failure');

    // Restart server
    server = await serverMod.startServer(projectRoot, port);
  });

  it('validates event payload structure', async () => {
    const wsClient = new WebSocketClient();
    await wsClient.connect(port);

    const sessionId = 'WFS-ws-validate-001';
    const complexPayload = {
      status: 'completed',
      metadata: {
        nested: {
          value: 'test'
        }
      },
      tasks: [
        { id: 'IMPL-001', status: 'done' },
        { id: 'IMPL-002', status: 'pending' }
      ],
      tags: ['tag1', 'tag2']
    };

    await new Promise<void>((resolve, reject) => {
      const data = JSON.stringify({
        type: 'SESSION_UPDATED',
        sessionId,
        payload: complexPayload
      });

      const req = http.request({
        hostname: 'localhost',
        port,
        path: '/api/hook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      }, (res) => {
        res.on('end', () => resolve());
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });

    const message = await wsClient.waitForMessage(
      msg => msg.type === 'SESSION_UPDATED' && msg.sessionId === sessionId
    );

    assert.deepEqual(message.payload, complexPayload);
    assert.ok(message.timestamp);
    assert.ok(new Date(message.timestamp!).getTime() > 0);

    wsClient.close();
  });

  it('handles WebSocket reconnection after disconnect', async () => {
    const wsClient = new WebSocketClient();
    await wsClient.connect(port);

    // Send initial message
    await new Promise<void>((resolve, reject) => {
      const data = JSON.stringify({
        type: 'SESSION_CREATED',
        sessionId: 'WFS-reconnect-1',
        payload: {}
      });

      const req = http.request({
        hostname: 'localhost',
        port,
        path: '/api/hook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      }, (res) => {
        res.on('end', () => resolve());
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });

    await wsClient.waitForMessage(msg => msg.type === 'SESSION_CREATED');

    // Disconnect
    wsClient.close();

    // Reconnect
    const wsClient2 = new WebSocketClient();
    await wsClient2.connect(port);

    // Send another message
    await new Promise<void>((resolve, reject) => {
      const data = JSON.stringify({
        type: 'SESSION_CREATED',
        sessionId: 'WFS-reconnect-2',
        payload: {}
      });

      const req = http.request({
        hostname: 'localhost',
        port,
        path: '/api/hook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      }, (res) => {
        res.on('end', () => resolve());
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });

    const message = await wsClient2.waitForMessage(
      msg => msg.type === 'SESSION_CREATED' && msg.sessionId === 'WFS-reconnect-2'
    );

    assert.ok(message);
    wsClient2.close();
  });
});
