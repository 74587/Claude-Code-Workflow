import { createHash } from 'crypto';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { a2uiWebSocketHandler, handleA2UIMessage } from './a2ui/A2UIWebSocketHandler.js';
import { handleAnswer } from '../tools/ask-question.js';

// WebSocket clients for real-time notifications
export const wsClients = new Set<Duplex>();

/**
 * WebSocket message types for Loop monitoring
 */
export type LoopMessageType =
  | 'LOOP_STATE_UPDATE'
  | 'LOOP_STEP_COMPLETED'
  | 'LOOP_COMPLETED'
  | 'LOOP_LOG_ENTRY';

/**
 * Loop State Update - fired when loop status changes
 */
export interface LoopStateUpdateMessage {
  type: 'LOOP_STATE_UPDATE';
  loop_id: string;
  status: 'created' | 'running' | 'paused' | 'completed' | 'failed';
  current_iteration: number;
  current_cli_step: number;
  updated_at: string;
  timestamp: string;
}

/**
 * Loop Step Completed - fired when a CLI step finishes
 */
export interface LoopStepCompletedMessage {
  type: 'LOOP_STEP_COMPLETED';
  loop_id: string;
  step_id: string;
  exit_code: number;
  duration_ms: number;
  output: string;
  timestamp: string;
}

/**
 * Loop Completed - fired when entire loop finishes
 */
export interface LoopCompletedMessage {
  type: 'LOOP_COMPLETED';
  loop_id: string;
  final_status: 'completed' | 'failed';
  total_iterations: number;
  reason?: string;
  timestamp: string;
}

/**
 * Loop Log Entry - fired for streaming log lines
 */
export interface LoopLogEntryMessage {
  type: 'LOOP_LOG_ENTRY';
  loop_id: string;
  step_id: string;
  line: string;
  timestamp: string;
}

/**
 * Orchestrator WebSocket message types
 */
export type OrchestratorMessageType =
  | 'ORCHESTRATOR_STATE_UPDATE'
  | 'ORCHESTRATOR_NODE_STARTED'
  | 'ORCHESTRATOR_NODE_COMPLETED'
  | 'ORCHESTRATOR_NODE_FAILED'
  | 'ORCHESTRATOR_LOG';

/**
 * Execution log entry for Orchestrator
 */
export interface ExecutionLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  nodeId?: string;
  message: string;
}

/**
 * Orchestrator State Update - fired when execution status changes
 */
export interface OrchestratorStateUpdateMessage {
  type: 'ORCHESTRATOR_STATE_UPDATE';
  execId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  currentNodeId?: string;
  timestamp: string;
}

/**
 * Orchestrator Node Started - fired when a node begins execution
 */
export interface OrchestratorNodeStartedMessage {
  type: 'ORCHESTRATOR_NODE_STARTED';
  execId: string;
  nodeId: string;
  timestamp: string;
}

/**
 * Orchestrator Node Completed - fired when a node finishes successfully
 */
export interface OrchestratorNodeCompletedMessage {
  type: 'ORCHESTRATOR_NODE_COMPLETED';
  execId: string;
  nodeId: string;
  result?: unknown;
  timestamp: string;
}

/**
 * Orchestrator Node Failed - fired when a node encounters an error
 */
export interface OrchestratorNodeFailedMessage {
  type: 'ORCHESTRATOR_NODE_FAILED';
  execId: string;
  nodeId: string;
  error: string;
  timestamp: string;
}

/**
 * Orchestrator Log - fired for execution log entries
 */
export interface OrchestratorLogMessage {
  type: 'ORCHESTRATOR_LOG';
  execId: string;
  log: ExecutionLog;
  timestamp: string;
}

export function handleWebSocketUpgrade(req: IncomingMessage, socket: Duplex, _head: Buffer): void {
  const header = req.headers['sec-websocket-key'];
  const key = Array.isArray(header) ? header[0] : header;
  if (!key) {
    socket.end();
    return;
  }
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
  let pendingBuffer = Buffer.alloc(0);

  socket.on('data', (buffer: Buffer) => {
    // Buffers may contain partial frames or multiple frames; accumulate and parse in a loop.
    pendingBuffer = Buffer.concat([pendingBuffer, buffer]);

    try {
      while (true) {
        const frame = parseWebSocketFrame(pendingBuffer);
        if (!frame) return;

        const { opcode, payload, frameLength } = frame;
        pendingBuffer = pendingBuffer.slice(frameLength);

        switch (opcode) {
          case 0x1: // Text frame
            if (payload) {
              console.log('[WS] Received:', payload);
              // Try to handle as A2UI message
              const handledAsA2UI = handleA2UIMessage(payload, a2uiWebSocketHandler, handleAnswer);
              if (handledAsA2UI) {
                console.log('[WS] Handled as A2UI message');
              }
            }
            break;
          case 0x8: // Close frame
            socket.end();
            return;
          case 0x9: { // Ping frame - respond with Pong
            const pongFrame = Buffer.alloc(2);
            pongFrame[0] = 0x8A; // Pong opcode with FIN bit
            pongFrame[1] = 0x00; // No payload
            socket.write(pongFrame);
            break;
          }
          case 0xA: // Pong frame - ignore
            break;
          default:
            // Ignore other frame types (binary, continuation)
            break;
        }
      }
    } catch (e) {
      // On parse error, drop the buffered data to avoid unbounded growth.
      pendingBuffer = Buffer.alloc(0);
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
 * Returns { opcode, payload } or null
 */
export function parseWebSocketFrame(buffer: Buffer): { opcode: number; payload: string; frameLength: number } | null {
  if (buffer.length < 2) return null;

  const firstByte = buffer[0];
  const opcode = firstByte & 0x0f; // Extract opcode (bits 0-3)

  // Opcode types:
  // 0x0 = continuation, 0x1 = text, 0x2 = binary
  // 0x8 = close, 0x9 = ping, 0xA = pong

  const secondByte = buffer[1];
  const isMasked = (secondByte & 0x80) !== 0;
  let payloadLength = secondByte & 0x7f;

  let offset = 2;
  if (payloadLength === 126) {
    if (buffer.length < 4) return null;
    payloadLength = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLength === 127) {
    if (buffer.length < 10) return null;
    payloadLength = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  let mask: Buffer | null = null;
  if (isMasked) {
    if (buffer.length < offset + 4) return null;
    mask = buffer.slice(offset, offset + 4);
    offset += 4;
  }

  const frameLength = offset + payloadLength;
  if (buffer.length < frameLength) return null;

  const payload = buffer.slice(offset, offset + payloadLength);

  if (isMasked && mask) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= mask[i % 4];
    }
  }

  return { opcode, payload: payload.toString('utf8'), frameLength };
}

/**
 * Create WebSocket frame
 */
export function createWebSocketFrame(data: unknown): Buffer {
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
export function broadcastToClients(data: unknown): void {
  const frame = createWebSocketFrame(data);

  for (const client of wsClients) {
    try {
      client.write(frame);
    } catch (e) {
      wsClients.delete(client);
    }
  }

  const eventType =
    typeof data === 'object' && data !== null && 'type' in data ? (data as { type?: unknown }).type : undefined;
  console.log(`[WS] Broadcast to ${wsClients.size} clients:`, eventType);
}

/**
 * Extract session ID from file path
 */
export function extractSessionIdFromPath(filePath: string): string | null {
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
 * Loop-specific broadcast with throttling
 * Throttles LOOP_STATE_UPDATE messages to avoid flooding clients
 */
let lastLoopBroadcast = 0;
const LOOP_BROADCAST_THROTTLE = 1000; // 1 second

export type LoopMessage =
  | Omit<LoopStateUpdateMessage, 'timestamp'>
  | Omit<LoopStepCompletedMessage, 'timestamp'>
  | Omit<LoopCompletedMessage, 'timestamp'>
  | Omit<LoopLogEntryMessage, 'timestamp'>;

/**
 * Broadcast loop state update with throttling
 */
export function broadcastLoopUpdate(message: LoopMessage): void {
  const now = Date.now();

  // Throttle LOOP_STATE_UPDATE to reduce WebSocket traffic
  if (message.type === 'LOOP_STATE_UPDATE' && now - lastLoopBroadcast < LOOP_BROADCAST_THROTTLE) {
    return;
  }

  lastLoopBroadcast = now;

  broadcastToClients({
    ...message,
    timestamp: new Date().toISOString()
  });
}

/**
 * Broadcast loop log entry (no throttling)
 * Used for streaming real-time logs to Dashboard
 */
export function broadcastLoopLog(loop_id: string, step_id: string, line: string): void {
  broadcastToClients({
    type: 'LOOP_LOG_ENTRY',
    loop_id,
    step_id,
    line,
    timestamp: new Date().toISOString()
  });
}

/**
 * Union type for Orchestrator messages (without timestamp - added automatically)
 */
export type OrchestratorMessage =
  | Omit<OrchestratorStateUpdateMessage, 'timestamp'>
  | Omit<OrchestratorNodeStartedMessage, 'timestamp'>
  | Omit<OrchestratorNodeCompletedMessage, 'timestamp'>
  | Omit<OrchestratorNodeFailedMessage, 'timestamp'>
  | Omit<OrchestratorLogMessage, 'timestamp'>;

/**
 * Orchestrator-specific broadcast with throttling
 * Throttles ORCHESTRATOR_STATE_UPDATE messages to avoid flooding clients
 */
let lastOrchestratorBroadcast = 0;
const ORCHESTRATOR_BROADCAST_THROTTLE = 1000; // 1 second

/**
 * Broadcast orchestrator update with throttling
 * STATE_UPDATE messages are throttled to 1 per second
 * Other message types are sent immediately
 */
export function broadcastOrchestratorUpdate(message: OrchestratorMessage): void {
  const now = Date.now();

  // Throttle ORCHESTRATOR_STATE_UPDATE to reduce WebSocket traffic
  if (message.type === 'ORCHESTRATOR_STATE_UPDATE' && now - lastOrchestratorBroadcast < ORCHESTRATOR_BROADCAST_THROTTLE) {
    return;
  }

  if (message.type === 'ORCHESTRATOR_STATE_UPDATE') {
    lastOrchestratorBroadcast = now;
  }

  broadcastToClients({
    ...message,
    timestamp: new Date().toISOString()
  });
}

/**
 * Broadcast orchestrator log entry (no throttling)
 * Used for streaming real-time execution logs to Dashboard
 */
export function broadcastOrchestratorLog(execId: string, log: Omit<ExecutionLog, 'timestamp'>): void {
  broadcastToClients({
    type: 'ORCHESTRATOR_LOG',
    execId,
    log: {
      ...log,
      timestamp: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * Coordinator WebSocket message types
 */
export type CoordinatorMessageType =
  | 'COORDINATOR_STATE_UPDATE'
  | 'COORDINATOR_COMMAND_STARTED'
  | 'COORDINATOR_COMMAND_COMPLETED'
  | 'COORDINATOR_COMMAND_FAILED'
  | 'COORDINATOR_LOG_ENTRY'
  | 'COORDINATOR_QUESTION_ASKED'
  | 'COORDINATOR_ANSWER_RECEIVED';

/**
 * Coordinator State Update - fired when coordinator execution status changes
 */
export interface CoordinatorStateUpdateMessage {
  type: 'COORDINATOR_STATE_UPDATE';
  executionId: string;
  status: 'idle' | 'initializing' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentNodeId?: string;
  timestamp: string;
}

/**
 * Coordinator Command Started - fired when a command node begins execution
 */
export interface CoordinatorCommandStartedMessage {
  type: 'COORDINATOR_COMMAND_STARTED';
  executionId: string;
  nodeId: string;
  commandName: string;
  timestamp: string;
}

/**
 * Coordinator Command Completed - fired when a command node finishes successfully
 */
export interface CoordinatorCommandCompletedMessage {
  type: 'COORDINATOR_COMMAND_COMPLETED';
  executionId: string;
  nodeId: string;
  result?: unknown;
  timestamp: string;
}

/**
 * Coordinator Command Failed - fired when a command node encounters an error
 */
export interface CoordinatorCommandFailedMessage {
  type: 'COORDINATOR_COMMAND_FAILED';
  executionId: string;
  nodeId: string;
  error: string;
  timestamp: string;
}

/**
 * Coordinator Log Entry - fired for execution log entries
 */
export interface CoordinatorLogEntryMessage {
  type: 'COORDINATOR_LOG_ENTRY';
  executionId: string;
  log: {
    level: 'info' | 'warn' | 'error' | 'debug' | 'success';
    message: string;
    nodeId?: string;
    source?: 'system' | 'node' | 'user';
    timestamp: string;
  };
  timestamp: string;
}

/**
 * Coordinator Question Asked - fired when coordinator needs user input
 */
export interface CoordinatorQuestionAskedMessage {
  type: 'COORDINATOR_QUESTION_ASKED';
  executionId: string;
  question: {
    id: string;
    nodeId: string;
    title: string;
    description?: string;
    type: 'text' | 'single' | 'multi' | 'yes_no';
    options?: string[];
    required: boolean;
  };
  timestamp: string;
}

/**
 * Coordinator Answer Received - fired when user submits an answer
 */
export interface CoordinatorAnswerReceivedMessage {
  type: 'COORDINATOR_ANSWER_RECEIVED';
  executionId: string;
  questionId: string;
  answer: string | string[];
  timestamp: string;
}

/**
 * Union type for Coordinator messages (without timestamp - added automatically)
 */
export type CoordinatorMessage =
  | Omit<CoordinatorStateUpdateMessage, 'timestamp'>
  | Omit<CoordinatorCommandStartedMessage, 'timestamp'>
  | Omit<CoordinatorCommandCompletedMessage, 'timestamp'>
  | Omit<CoordinatorCommandFailedMessage, 'timestamp'>
  | Omit<CoordinatorLogEntryMessage, 'timestamp'>
  | Omit<CoordinatorQuestionAskedMessage, 'timestamp'>
  | Omit<CoordinatorAnswerReceivedMessage, 'timestamp'>;

/**
 * Coordinator-specific broadcast with throttling
 * Throttles COORDINATOR_STATE_UPDATE messages to avoid flooding clients
 */
let lastCoordinatorBroadcast = 0;
const COORDINATOR_BROADCAST_THROTTLE = 1000; // 1 second

/**
 * Broadcast coordinator update with throttling
 * STATE_UPDATE messages are throttled to 1 per second
 * Other message types are sent immediately
 */
export function broadcastCoordinatorUpdate(message: CoordinatorMessage): void {
  const now = Date.now();

  // Throttle COORDINATOR_STATE_UPDATE to reduce WebSocket traffic
  if (message.type === 'COORDINATOR_STATE_UPDATE' && now - lastCoordinatorBroadcast < COORDINATOR_BROADCAST_THROTTLE) {
    return;
  }

  if (message.type === 'COORDINATOR_STATE_UPDATE') {
    lastCoordinatorBroadcast = now;
  }

  broadcastToClients({
    ...message,
    timestamp: new Date().toISOString()
  });
}

/**
 * Broadcast coordinator log entry (no throttling)
 * Used for streaming real-time coordinator logs to Dashboard
 */
export function broadcastCoordinatorLog(
  executionId: string,
  log: {
    level: 'info' | 'warn' | 'error' | 'debug' | 'success';
    message: string;
    nodeId?: string;
    source?: 'system' | 'node' | 'user';
  }
): void {
  broadcastToClients({
    type: 'COORDINATOR_LOG_ENTRY',
    executionId,
    log: {
      ...log,
      timestamp: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  });
}
