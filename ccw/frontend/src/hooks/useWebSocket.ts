// ========================================
// useWebSocket Hook
// ========================================
// Typed WebSocket connection management with auto-reconnect

import { useEffect, useRef, useCallback } from 'react';
import { useNotificationStore } from '@/stores';
import { useExecutionStore } from '@/stores/executionStore';
import { useFlowStore } from '@/stores';
import { useCliStreamStore } from '@/stores/cliStreamStore';
import {
  OrchestratorMessageSchema,
  type OrchestratorWebSocketMessage,
  type ExecutionLog,
} from '../types/execution';
import { SurfaceUpdateSchema } from '../packages/a2ui-runtime/core/A2UITypes';

// Constants
const RECONNECT_DELAY_BASE = 1000; // 1 second
const RECONNECT_DELAY_MAX = 30000; // 30 seconds
const RECONNECT_DELAY_MULTIPLIER = 1.5;

interface UseWebSocketOptions {
  enabled?: boolean;
  onMessage?: (message: OrchestratorWebSocketMessage) => void;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  send: (message: unknown) => void;
  reconnect: () => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { enabled = true, onMessage } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef(RECONNECT_DELAY_BASE);

  // Notification store for connection status
  const setWsStatus = useNotificationStore((state) => state.setWsStatus);
  const setWsLastMessage = useNotificationStore((state) => state.setWsLastMessage);
  const incrementReconnectAttempts = useNotificationStore((state) => state.incrementReconnectAttempts);
  const resetReconnectAttempts = useNotificationStore((state) => state.resetReconnectAttempts);
  const addA2UINotification = useNotificationStore((state) => state.addA2UINotification);

  // Execution store for state updates
  const setExecutionStatus = useExecutionStore((state) => state.setExecutionStatus);
  const setNodeStarted = useExecutionStore((state) => state.setNodeStarted);
  const setNodeCompleted = useExecutionStore((state) => state.setNodeCompleted);
  const setNodeFailed = useExecutionStore((state) => state.setNodeFailed);
  const addLog = useExecutionStore((state) => state.addLog);
  const completeExecution = useExecutionStore((state) => state.completeExecution);
  const currentExecution = useExecutionStore((state) => state.currentExecution);

  // Flow store for node status updates on canvas
  const updateNode = useFlowStore((state) => state.updateNode);

  // CLI stream store for CLI output handling
  const addOutput = useCliStreamStore((state) => state.addOutput);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        // Store last message for debugging
        setWsLastMessage(data);

        // Handle CLI messages
        if (data.type?.startsWith('CLI_')) {
          switch (data.type) {
            case 'CLI_STARTED': {
              const { executionId, tool, mode, timestamp } = data.payload;

              // Add system message for CLI start
              addOutput(executionId, {
                type: 'system',
                content: `[${new Date(timestamp).toLocaleTimeString()}] CLI execution started: ${tool} (${mode || 'default'} mode)`,
                timestamp: Date.now(),
              });
              break;
            }

            case 'CLI_OUTPUT': {
              const { executionId, chunkType, data: outputData, unit } = data.payload;

              // Handle structured output
              const unitContent = unit?.content || outputData;
              const unitType = unit?.type || chunkType;

              // Special handling for tool_call type
              let content: string;
              if (unitType === 'tool_call' && typeof unitContent === 'object' && unitContent !== null) {
                // Format tool_call display
                content = JSON.stringify(unitContent);
              } else {
                content = typeof unitContent === 'string' ? unitContent : JSON.stringify(unitContent);
              }

              // Split by lines and add each line to store
              const lines = content.split('\n');
              lines.forEach((line: string) => {
                // Add non-empty lines, or single line if that's all we have
                if (line.trim() || lines.length === 1) {
                  addOutput(executionId, {
                    type: unitType as any,
                    content: line,
                    timestamp: Date.now(),
                  });
                }
              });
              break;
            }

            case 'CLI_COMPLETED': {
              const { executionId, success, duration } = data.payload;

              const statusText = success ? 'completed successfully' : 'failed';
              const durationText = duration ? ` (${duration}ms)` : '';

              addOutput(executionId, {
                type: 'system',
                content: `[${new Date().toLocaleTimeString()}] CLI execution ${statusText}${durationText}`,
                timestamp: Date.now(),
              });
              break;
            }
          }
          return;
        }

        // Handle A2UI surface messages
        if (data.type === 'a2ui-surface') {
          const parsed = SurfaceUpdateSchema.safeParse(data.payload);
          if (parsed.success) {
            addA2UINotification(parsed.data, 'Interactive UI');
          } else {
            console.warn('[WebSocket] Invalid A2UI surface:', parsed.error.issues);
          }
          return;
        }

        // Check if this is an orchestrator message
        if (!data.type?.startsWith('ORCHESTRATOR_')) {
          return;
        }

        // Validate message with zod schema
        const parsed = OrchestratorMessageSchema.safeParse(data);
        if (!parsed.success) {
          console.warn('[WebSocket] Invalid orchestrator message:', parsed.error.issues);
          return;
        }

        // Cast validated data to our TypeScript interface
        const message = parsed.data as OrchestratorWebSocketMessage;

        // Only process messages for current execution
        if (currentExecution && message.execId !== currentExecution.execId) {
          return;
        }

        // Dispatch to execution store based on message type
        switch (message.type) {
          case 'ORCHESTRATOR_STATE_UPDATE':
            setExecutionStatus(message.status, message.currentNodeId);
            // Check for completion
            if (message.status === 'completed' || message.status === 'failed') {
              completeExecution(message.status);
            }
            break;

          case 'ORCHESTRATOR_NODE_STARTED':
            setNodeStarted(message.nodeId);
            // Update canvas node status
            updateNode(message.nodeId, { executionStatus: 'running' });
            break;

          case 'ORCHESTRATOR_NODE_COMPLETED':
            setNodeCompleted(message.nodeId, message.result);
            // Update canvas node status
            updateNode(message.nodeId, {
              executionStatus: 'completed',
              executionResult: message.result,
            });
            break;

          case 'ORCHESTRATOR_NODE_FAILED':
            setNodeFailed(message.nodeId, message.error);
            // Update canvas node status
            updateNode(message.nodeId, {
              executionStatus: 'failed',
              executionError: message.error,
            });
            break;

          case 'ORCHESTRATOR_LOG':
            addLog(message.log as ExecutionLog);
            break;
        }

        // Call custom message handler if provided
        onMessage?.(message);
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    },
    [
      currentExecution,
      setWsLastMessage,
      setExecutionStatus,
      setNodeStarted,
      setNodeCompleted,
      setNodeFailed,
      addLog,
      completeExecution,
      updateNode,
      addOutput,
      onMessage,
    ]
  );

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!enabled) return;

    // Construct WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      setWsStatus('connecting');

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        setWsStatus('connected');
        resetReconnectAttempts();
        reconnectDelayRef.current = RECONNECT_DELAY_BASE;
      };

      ws.onmessage = handleMessage;

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        setWsStatus('disconnected');
        wsRef.current = null;
        scheduleReconnect();
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        setWsStatus('error');
      };
    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error);
      setWsStatus('error');
      scheduleReconnect();
    }
  }, [enabled, handleMessage, setWsStatus, resetReconnectAttempts]);

  // Schedule reconnection with exponential backoff
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = reconnectDelayRef.current;
    console.log(`[WebSocket] Reconnecting in ${delay}ms...`);

    setWsStatus('reconnecting');
    incrementReconnectAttempts();

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);

    // Increase delay for next attempt (exponential backoff)
    reconnectDelayRef.current = Math.min(
      reconnectDelayRef.current * RECONNECT_DELAY_MULTIPLIER,
      RECONNECT_DELAY_MAX
    );
  }, [connect, setWsStatus, incrementReconnectAttempts]);

  // Send message through WebSocket
  const send = useCallback((message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Cannot send message: not connected');
    }
  }, []);

  // Manual reconnect
  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    reconnectDelayRef.current = RECONNECT_DELAY_BASE;
    connect();
  }, [connect]);

  // Check connection status
  const isConnected = wsRef.current?.readyState === WebSocket.OPEN;

  // Connect on mount, cleanup on unmount
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, connect]);

  return {
    isConnected,
    send,
    reconnect,
  };
}

export default useWebSocket;
