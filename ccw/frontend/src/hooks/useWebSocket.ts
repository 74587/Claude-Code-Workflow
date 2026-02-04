// ========================================
// useWebSocket Hook
// ========================================
// Typed WebSocket connection management with auto-reconnect

import { useEffect, useRef, useCallback } from 'react';
import { useNotificationStore } from '@/stores';
import { useExecutionStore } from '@/stores/executionStore';
import { useFlowStore } from '@/stores';
import { useCliStreamStore } from '@/stores/cliStreamStore';
import { useCoordinatorStore } from '@/stores/coordinatorStore';
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
  const mountedRef = useRef(true);

  // Store refs to prevent handler recreation - use useRef to keep stable references
  const storeRefs = useRef({
    // Notification store
    setWsStatus: useNotificationStore((state) => state.setWsStatus),
    setWsLastMessage: useNotificationStore((state) => state.setWsLastMessage),
    incrementReconnectAttempts: useNotificationStore((state) => state.incrementReconnectAttempts),
    resetReconnectAttempts: useNotificationStore((state) => state.resetReconnectAttempts),
    addA2UINotification: useNotificationStore((state) => state.addA2UINotification),

    // Execution store
    setExecutionStatus: useExecutionStore((state) => state.setExecutionStatus),
    setNodeStarted: useExecutionStore((state) => state.setNodeStarted),
    setNodeCompleted: useExecutionStore((state) => state.setNodeCompleted),
    setNodeFailed: useExecutionStore((state) => state.setNodeFailed),
    addLog: useExecutionStore((state) => state.addLog),
    completeExecution: useExecutionStore((state) => state.completeExecution),
    currentExecution: useExecutionStore((state) => state.currentExecution),

    // Flow store
    updateNode: useFlowStore((state) => state.updateNode),

    // CLI stream store
    addOutput: useCliStreamStore((state) => state.addOutput),

    // Coordinator store
    updateNodeStatus: useCoordinatorStore((state) => state.updateNodeStatus),
    addCoordinatorLog: useCoordinatorStore((state) => state.addLog),
    setActiveQuestion: useCoordinatorStore((state) => state.setActiveQuestion),
    markExecutionComplete: useCoordinatorStore((state) => state.markExecutionComplete),
    coordinatorExecutionId: useCoordinatorStore((state) => state.currentExecutionId),
  });

  // Update refs periodically to ensure they have fresh store references
  useEffect(() => {
    storeRefs.current = {
      // Notification store
      setWsStatus: useNotificationStore((state) => state.setWsStatus),
      setWsLastMessage: useNotificationStore((state) => state.setWsLastMessage),
      incrementReconnectAttempts: useNotificationStore((state) => state.incrementReconnectAttempts),
      resetReconnectAttempts: useNotificationStore((state) => state.resetReconnectAttempts),
      addA2UINotification: useNotificationStore((state) => state.addA2UINotification),

      // Execution store
      setExecutionStatus: useExecutionStore((state) => state.setExecutionStatus),
      setNodeStarted: useExecutionStore((state) => state.setNodeStarted),
      setNodeCompleted: useExecutionStore((state) => state.setNodeCompleted),
      setNodeFailed: useExecutionStore((state) => state.setNodeFailed),
      addLog: useExecutionStore((state) => state.addLog),
      completeExecution: useExecutionStore((state) => state.completeExecution),
      currentExecution: useExecutionStore((state) => state.currentExecution),

      // Flow store
      updateNode: useFlowStore((state) => state.updateNode),

      // CLI stream store
      addOutput: useCliStreamStore((state) => state.addOutput),

      // Coordinator store
      updateNodeStatus: useCoordinatorStore((state) => state.updateNodeStatus),
      addCoordinatorLog: useCoordinatorStore((state) => state.addLog),
      setActiveQuestion: useCoordinatorStore((state) => state.setActiveQuestion),
      markExecutionComplete: useCoordinatorStore((state) => state.markExecutionComplete),
      coordinatorExecutionId: useCoordinatorStore((state) => state.currentExecutionId),
    };
  }); // Run on every render to keep refs fresh

  // Handle incoming WebSocket messages
  // Note: Using refs via storeRefs to prevent handler recreation on every store change
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // Guard against state updates after unmount
      if (!mountedRef.current) {
        return;
      }

      try {
        const data = JSON.parse(event.data);

        // Store last message for debugging
        storeRefs.current.setWsLastMessage(data);

        // Handle CLI messages
        if (data.type?.startsWith('CLI_')) {
          switch (data.type) {
            case 'CLI_STARTED': {
              const { executionId, tool, mode, timestamp } = data.payload;

              // Add system message for CLI start
              storeRefs.current.addOutput(executionId, {
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
                  storeRefs.current.addOutput(executionId, {
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

              storeRefs.current.addOutput(executionId, {
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
            storeRefs.current.addA2UINotification(parsed.data, 'Interactive UI');
          } else {
            console.warn('[WebSocket] Invalid A2UI surface:', parsed.error.issues);
          }
          return;
        }

        // Handle Coordinator messages
        if (data.type?.startsWith('COORDINATOR_')) {
          const { coordinatorExecutionId } = storeRefs.current;
          // Only process messages for current coordinator execution
          if (coordinatorExecutionId && data.executionId !== coordinatorExecutionId) {
            return;
          }

          // Dispatch to coordinator store based on message type
          switch (data.type) {
            case 'COORDINATOR_STATE_UPDATE':
              // Check for completion
              if (data.status === 'completed') {
                storeRefs.current.markExecutionComplete(true);
              } else if (data.status === 'failed') {
                storeRefs.current.markExecutionComplete(false);
              }
              break;

            case 'COORDINATOR_COMMAND_STARTED':
              storeRefs.current.updateNodeStatus(data.nodeId, 'running');
              break;

            case 'COORDINATOR_COMMAND_COMPLETED':
              storeRefs.current.updateNodeStatus(data.nodeId, 'completed', data.result);
              break;

            case 'COORDINATOR_COMMAND_FAILED':
              storeRefs.current.updateNodeStatus(data.nodeId, 'failed', undefined, data.error);
              break;

            case 'COORDINATOR_LOG_ENTRY':
              storeRefs.current.addCoordinatorLog(
                data.log.message,
                data.log.level,
                data.log.nodeId,
                data.log.source
              );
              break;

            case 'COORDINATOR_QUESTION_ASKED':
              storeRefs.current.setActiveQuestion(data.question);
              break;

            case 'COORDINATOR_ANSWER_RECEIVED':
              // Answer received - handled by submitAnswer in the store
              break;
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
        const { currentExecution } = storeRefs.current;
        if (currentExecution && message.execId !== currentExecution.execId) {
          return;
        }

        // Dispatch to execution store based on message type
        switch (message.type) {
          case 'ORCHESTRATOR_STATE_UPDATE':
            storeRefs.current.setExecutionStatus(message.status, message.currentNodeId);
            // Check for completion
            if (message.status === 'completed' || message.status === 'failed') {
              storeRefs.current.completeExecution(message.status);
            }
            break;

          case 'ORCHESTRATOR_NODE_STARTED':
            storeRefs.current.setNodeStarted(message.nodeId);
            // Update canvas node status
            storeRefs.current.updateNode(message.nodeId, { executionStatus: 'running' });
            break;

          case 'ORCHESTRATOR_NODE_COMPLETED':
            storeRefs.current.setNodeCompleted(message.nodeId, message.result);
            // Update canvas node status
            storeRefs.current.updateNode(message.nodeId, {
              executionStatus: 'completed',
              executionResult: message.result,
            });
            break;

          case 'ORCHESTRATOR_NODE_FAILED':
            storeRefs.current.setNodeFailed(message.nodeId, message.error);
            // Update canvas node status
            storeRefs.current.updateNode(message.nodeId, {
              executionStatus: 'failed',
              executionError: message.error,
            });
            break;

          case 'ORCHESTRATOR_LOG':
            storeRefs.current.addLog(message.log as ExecutionLog);
            break;
        }

        // Call custom message handler if provided
        onMessage?.(message);
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    },
    [onMessage] // Only dependency is onMessage, all other functions accessed via refs
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

    storeRefs.current.setWsStatus('reconnecting');
    storeRefs.current.incrementReconnectAttempts();

    reconnectTimeoutRef.current = setTimeout(() => {
      connectRef.current?.();
    }, delay);

    // Increase delay for next attempt (exponential backoff)
    reconnectDelayRef.current = Math.min(
      reconnectDelayRef.current * RECONNECT_DELAY_MULTIPLIER,
      RECONNECT_DELAY_MAX
    );
  }, []); // No dependencies - uses connectRef

  const connect = useCallback(() => {
    if (!enabled) return;

    // Construct WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      storeRefs.current.setWsStatus('connecting');

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        storeRefs.current.setWsStatus('connected');
        storeRefs.current.resetReconnectAttempts();
        reconnectDelayRef.current = RECONNECT_DELAY_BASE;
      };

      ws.onmessage = handleMessage;

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        storeRefs.current.setWsStatus('disconnected');
        wsRef.current = null;
        scheduleReconnect();
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        storeRefs.current.setWsStatus('error');
      };
    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error);
      storeRefs.current.setWsStatus('error');
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
