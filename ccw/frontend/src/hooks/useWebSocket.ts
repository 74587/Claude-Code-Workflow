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

// Access store state/actions via getState() - avoids calling hooks in callbacks/effects
// This is the zustand-recommended pattern for non-rendering store access
function getStoreState() {
  const notification = useNotificationStore.getState();
  const execution = useExecutionStore.getState();
  const flow = useFlowStore.getState();
  const cliStream = useCliStreamStore.getState();
  return {
    // Notification store
    setWsStatus: notification.setWsStatus,
    setWsLastMessage: notification.setWsLastMessage,
    incrementReconnectAttempts: notification.incrementReconnectAttempts,
    resetReconnectAttempts: notification.resetReconnectAttempts,
    addA2UINotification: notification.addA2UINotification,
    // Execution store
    setExecutionStatus: execution.setExecutionStatus,
    setNodeStarted: execution.setNodeStarted,
    setNodeCompleted: execution.setNodeCompleted,
    setNodeFailed: execution.setNodeFailed,
    addLog: execution.addLog,
    completeExecution: execution.completeExecution,
    currentExecution: execution.currentExecution,
    // Flow store
    updateNode: flow.updateNode,
    // CLI stream store
    addOutput: cliStream.addOutput,
  };
}

export interface UseWebSocketOptions {
  enabled?: boolean;
  onMessage?: (message: OrchestratorWebSocketMessage) => void;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  send: (message: unknown) => void;
  reconnect: () => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { enabled = true, onMessage } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef(RECONNECT_DELAY_BASE);
  const mountedRef = useRef(true);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // Guard against state updates after unmount
      if (!mountedRef.current) {
        return;
      }

      try {
        const data = JSON.parse(event.data);
        const stores = getStoreState();

        // Store last message for debugging
        stores.setWsLastMessage(data);

        // Handle CLI messages
        if (data.type?.startsWith('CLI_')) {
          switch (data.type) {
            case 'CLI_STARTED': {
              const { executionId, tool, mode, timestamp } = data.payload;

              // Add system message for CLI start
              stores.addOutput(executionId, {
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
                  stores.addOutput(executionId, {
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

              stores.addOutput(executionId, {
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
            stores.addA2UINotification(parsed.data, 'Interactive UI');
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
        const { currentExecution } = stores;
        if (currentExecution && message.execId !== currentExecution.execId) {
          return;
        }

        // Dispatch to execution store based on message type
        switch (message.type) {
          case 'ORCHESTRATOR_STATE_UPDATE':
            stores.setExecutionStatus(message.status, message.currentNodeId);
            // Check for completion
            if (message.status === 'completed' || message.status === 'failed') {
              stores.completeExecution(message.status);
            }
            break;

          case 'ORCHESTRATOR_NODE_STARTED':
            stores.setNodeStarted(message.nodeId);
            // Update canvas node status
            stores.updateNode(message.nodeId, { executionStatus: 'running' });
            break;

          case 'ORCHESTRATOR_NODE_COMPLETED':
            stores.setNodeCompleted(message.nodeId, message.result);
            // Update canvas node status
            stores.updateNode(message.nodeId, {
              executionStatus: 'completed',
              executionResult: message.result,
            });
            break;

          case 'ORCHESTRATOR_NODE_FAILED':
            stores.setNodeFailed(message.nodeId, message.error);
            // Update canvas node status
            stores.updateNode(message.nodeId, {
              executionStatus: 'failed',
              executionError: message.error,
            });
            break;

          case 'ORCHESTRATOR_LOG':
            stores.addLog(message.log as ExecutionLog);
            break;
        }

        // Call custom message handler if provided
        onMessage?.(message);
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    },
    [onMessage] // Only dependency is onMessage, store access via getState()
  );

  // Connect to WebSocket
  // Use ref to avoid circular dependency with scheduleReconnect
  const connectRef = useRef<(() => void) | null>(null);

  // Schedule reconnection with exponential backoff
  // Define this first to avoid circular dependency
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = reconnectDelayRef.current;
    console.log(`[WebSocket] Reconnecting in ${delay}ms...`);

    const stores = getStoreState();
    stores.setWsStatus('reconnecting');
    stores.incrementReconnectAttempts();

    reconnectTimeoutRef.current = setTimeout(() => {
      connectRef.current?.();
    }, delay);

    // Increase delay for next attempt (exponential backoff)
    reconnectDelayRef.current = Math.min(
      reconnectDelayRef.current * RECONNECT_DELAY_MULTIPLIER,
      RECONNECT_DELAY_MAX
    );
  }, []); // No dependencies - uses connectRef and getStoreState()

  const connect = useCallback(() => {
    if (!enabled) return;

    // Construct WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      getStoreState().setWsStatus('connecting');

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        const s = getStoreState();
        s.setWsStatus('connected');
        s.resetReconnectAttempts();
        reconnectDelayRef.current = RECONNECT_DELAY_BASE;
      };

      ws.onmessage = handleMessage;

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        getStoreState().setWsStatus('disconnected');
        wsRef.current = null;
        scheduleReconnect();
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        getStoreState().setWsStatus('error');
      };
    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error);
      getStoreState().setWsStatus('error');
      scheduleReconnect();
    }
  }, [enabled, handleMessage, scheduleReconnect]);

  // Update connect ref after connect is defined
  connectRef.current = connect;

  // Send message through WebSocket
  const send = useCallback((message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Cannot send message: not connected');
    }
  }, []);

  // Manual reconnect
  // Use connectRef to avoid depending on connect
  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    reconnectDelayRef.current = RECONNECT_DELAY_BASE;
    connectRef.current?.();
  }, []); // No dependencies - uses connectRef

  // Check connection status
  const isConnected = wsRef.current?.readyState === WebSocket.OPEN;

  // Connect on mount, cleanup on unmount
  useEffect(() => {
    if (enabled) {
      connect();
    }

    // Listen for A2UI action events and send via WebSocket
    const handleA2UIAction = (event: CustomEvent) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(event.detail));
      } else {
        console.warn('[WebSocket] Cannot send A2UI action: not connected');
      }
    };

    // Type the event listener properly
    window.addEventListener('a2ui-action', handleA2UIAction as EventListener);

    return () => {
      // Mark as unmounted to prevent state updates in handleMessage
      mountedRef.current = false;

      window.removeEventListener('a2ui-action', handleA2UIAction as EventListener);
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
