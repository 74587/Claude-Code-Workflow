// ========================================
// useRealtimeUpdates Hook
// ========================================
// WebSocket hook for real-time ticker messages with typed handling and reconnection

import { useState, useEffect, useRef, useCallback } from 'react';
import { z } from 'zod';

// --- Types ---

export const TickerMessageSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: z.enum(['session', 'task', 'workflow', 'status']),
  link: z.string().optional(),
  timestamp: z.number(),
});

export type TickerMessage = z.infer<typeof TickerMessageSchema>;

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface RealtimeUpdatesResult {
  messages: TickerMessage[];
  connectionStatus: ConnectionStatus;
  reconnect: () => void;
}

// --- Constants ---

const RECONNECT_DELAY_BASE = 1000;
const RECONNECT_DELAY_MAX = 30000;
const RECONNECT_DELAY_MULTIPLIER = 1.5;
const MAX_MESSAGES = 50;
const MESSAGE_BATCH_DELAY = 500; // Batch messages every 500ms for performance

// --- Hook ---

export function useRealtimeUpdates(endpoint: string): RealtimeUpdatesResult {
  const [messages, setMessages] = useState<TickerMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(RECONNECT_DELAY_BASE);

  // Message batching for performance: accumulate messages and flush every 500ms
  const messageBatchRef = useRef<TickerMessage[]>([]);
  const batchFlushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flush batched messages to state
  const flushMessageBatch = useCallback(() => {
    if (messageBatchRef.current.length > 0) {
      const batch = [...messageBatchRef.current];
      messageBatchRef.current = [];

      setMessages((prev) => {
        const next = [...batch, ...prev];
        return next.length > MAX_MESSAGES ? next.slice(0, MAX_MESSAGES) : next;
      });
    }

    if (batchFlushTimeoutRef.current) {
      clearTimeout(batchFlushTimeoutRef.current);
      batchFlushTimeoutRef.current = null;
    }
  }, []);

  // Schedule a batch flush
  const scheduleBatchFlush = useCallback(() => {
    if (!batchFlushTimeoutRef.current) {
      batchFlushTimeoutRef.current = setTimeout(() => {
        flushMessageBatch();
      }, MESSAGE_BATCH_DELAY);
    }
  }, [flushMessageBatch]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = reconnectDelayRef.current;
    setConnectionStatus('reconnecting');

    reconnectTimeoutRef.current = setTimeout(() => {
      connectWs();
    }, delay);

    reconnectDelayRef.current = Math.min(
      reconnectDelayRef.current * RECONNECT_DELAY_MULTIPLIER,
      RECONNECT_DELAY_MAX
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectWs = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/${endpoint}`;

    try {
      setConnectionStatus('connecting');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        reconnectDelayRef.current = RECONNECT_DELAY_BASE;
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          const parsed = TickerMessageSchema.safeParse(data);
          if (parsed.success) {
            // Add to batch instead of immediate state update
            messageBatchRef.current.push(parsed.data);
            // Schedule flush (debounced - only one timer active at a time)
            scheduleBatchFlush();
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        wsRef.current = null;
        scheduleReconnect();
      };

      ws.onerror = () => {
        setConnectionStatus('disconnected');
      };
    } catch {
      setConnectionStatus('disconnected');
      scheduleReconnect();
    }
  }, [endpoint, scheduleReconnect]);

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    reconnectDelayRef.current = RECONNECT_DELAY_BASE;
    connectWs();
  }, [connectWs]);

  useEffect(() => {
    connectWs();

    return () => {
      // Flush any remaining batched messages
      flushMessageBatch();

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (batchFlushTimeoutRef.current) {
        clearTimeout(batchFlushTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWs, flushMessageBatch]);

  return { messages, connectionStatus, reconnect };
}

export default useRealtimeUpdates;
