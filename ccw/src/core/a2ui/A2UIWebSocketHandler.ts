// ========================================
// A2UI WebSocket Handler
// ========================================
// WebSocket transport for A2UI surfaces and actions

import type { Duplex } from 'stream';
import type { IncomingMessage } from 'http';
import { createWebSocketFrame, parseWebSocketFrame, wsClients } from '../websocket.js';
import type { QuestionAnswer, AskQuestionParams, Question } from './A2UITypes.js';

// ========== A2UI Message Types ==========

/** A2UI WebSocket message types */
export type A2UIMessageType =
  | 'a2ui-surface'      // Send surface to frontend
  | 'a2ui-action';      // Receive action from frontend

/** A2UI surface message - sent to frontend */
export interface A2UISurfaceMessage {
  type: 'a2ui-surface';
  surfaceUpdate: {
    surfaceId: string;
    components: unknown[];
    initialState: Record<string, unknown>;
  };
  timestamp: string;
}

/** A2UI action message - received from frontend */
export interface A2UIActionMessage {
  type: 'a2ui-action';
  actionId: string;
  surfaceId: string;
  parameters?: Record<string, unknown>;
  timestamp: string;
}

/** A2UI question answer message - received from frontend */
export interface A2UIQuestionAnswerMessage {
  type: 'a2ui-answer';
  questionId: string;
  surfaceId: string;
  value: unknown;
  cancelled: boolean;
  timestamp: string;
}

// ========== A2UI Handler ==========

/**
 * A2UI WebSocket Handler
 * Manages A2UI surface distribution and action handling
 */
export class A2UIWebSocketHandler {
  private activeSurfaces = new Map<string, {
    surfaceId: string;
    questionId: string;
    timestamp: number;
  }>();

  /**
   * Send A2UI surface to all connected clients
   * @param surfaceUpdate - A2UI surface update to send
   * @returns Number of clients notified
   */
  sendSurface(surfaceUpdate: {
    surfaceId: string;
    components: unknown[];
    initialState: Record<string, unknown>;
  }): number {
    const message: A2UISurfaceMessage = {
      type: 'a2ui-surface',
      surfaceUpdate,
      timestamp: new Date().toISOString(),
    };

    // Track active surface
    const questionId = surfaceUpdate.initialState?.questionId as string | undefined;
    if (questionId) {
      this.activeSurfaces.set(questionId, {
        surfaceId: surfaceUpdate.surfaceId,
        questionId,
        timestamp: Date.now(),
      });
    }

    // Broadcast to all clients
    const frame = createWebSocketFrame(message);
    let sentCount = 0;

    for (const client of wsClients) {
      try {
        client.write(frame);
        sentCount++;
      } catch (e) {
        wsClients.delete(client);
      }
    }

    console.log(`[A2UI] Sent surface ${surfaceUpdate.surfaceId} to ${sentCount} clients`);
    return sentCount;
  }

  /**
   * Send A2UI surface to specific client
   * @param client - Specific WebSocket client
   * @param surfaceUpdate - A2UI surface update to send
   * @returns True if sent successfully
   */
  sendSurfaceToClient(
    client: Duplex,
    surfaceUpdate: {
      surfaceId: string;
      components: unknown[];
      initialState: Record<string, unknown>;
    }
  ): boolean {
    const message: A2UISurfaceMessage = {
      type: 'a2ui-surface',
      surfaceUpdate,
      timestamp: new Date().toISOString(),
    };

    try {
      const frame = createWebSocketFrame(message);
      client.write(frame);
      return true;
    } catch (e) {
      wsClients.delete(client);
      return false;
    }
  }

  /**
   * Handle incoming A2UI action from frontend
   * @param action - Action message from frontend
   * @param callback - Optional callback to handle the action
   * @returns True if action was handled
   */
  handleAction(action: A2UIActionMessage, callback?: (action: A2UIActionMessage) => void): boolean {
    console.log(`[A2UI] Received action: ${action.actionId} for surface ${action.surfaceId}`);

    // Call callback if provided
    if (callback) {
      callback(action);
      return true;
    }

    return true;
  }

  /**
   * Handle incoming A2UI question answer from frontend
   * @param answer - Answer message from frontend
   * @param callback - Callback to process the answer
   * @returns True if answer was handled
   */
  handleAnswer(answer: A2UIQuestionAnswerMessage, callback: (answer: QuestionAnswer) => boolean): boolean {
    console.log(`[A2UI] Received answer for question ${answer.questionId}: cancelled=${answer.cancelled}`);

    // Convert to QuestionAnswer format
    const questionAnswer: QuestionAnswer = {
      questionId: answer.questionId,
      value: answer.value as string | boolean | string[],
      cancelled: answer.cancelled,
    };

    // Call callback
    const handled = callback(questionAnswer);

    // Remove from active surfaces if answered/cancelled
    if (handled) {
      this.activeSurfaces.delete(answer.questionId);
    }

    return handled;
  }

  /**
   * Cancel an active surface
   * @param questionId - Question ID to cancel
   * @returns True if surface was cancelled
   */
  cancelSurface(questionId: string): boolean {
    const surface = this.activeSurfaces.get(questionId);
    if (!surface) {
      return false;
    }

    // Send cancel notification to frontend
    const message = {
      type: 'a2ui-cancel' as const,
      surfaceId: surface.surfaceId,
      questionId,
      timestamp: new Date().toISOString(),
    };

    const frame = createWebSocketFrame(message);
    for (const client of wsClients) {
      try {
        client.write(frame);
      } catch (e) {
        wsClients.delete(client);
      }
    }

    this.activeSurfaces.delete(questionId);
    return true;
  }

  /**
   * Get active surfaces
   * @returns Array of active surface info
   */
  getActiveSurfaces(): Array<{
    surfaceId: string;
    questionId: string;
    timestamp: number;
  }> {
    return Array.from(this.activeSurfaces.values());
  }

  /**
   * Clear all active surfaces
   */
  clearSurfaces(): void {
    this.activeSurfaces.clear();
  }

  /**
   * Remove stale surfaces (older than specified time)
   * @param maxAge - Maximum age in milliseconds
   * @returns Number of surfaces removed
   */
  removeStaleSurfaces(maxAge: number = 3600000): number {
    const now = Date.now();
    let removed = 0;

    for (const [questionId, surface] of this.activeSurfaces) {
      if (now - surface.timestamp > maxAge) {
        this.activeSurfaces.delete(questionId);
        removed++;
      }
    }

    return removed;
  }
}

// ========== WebSocket Integration ==========

/**
 * Handle A2UI messages in WebSocket data handler
 * Called from main WebSocket handler
 * @param payload - Message payload
 * @param a2uiHandler - A2UI handler instance
 * @param answerCallback - Callback for question answers
 * @returns True if message was handled as A2UI message
 */
export function handleA2UIMessage(
  payload: string,
  a2uiHandler: A2UIWebSocketHandler,
  answerCallback?: (answer: QuestionAnswer) => boolean
): boolean {
  try {
    const data = JSON.parse(payload);

    // Handle A2UI action messages
    if (data.type === 'a2ui-action') {
      a2uiHandler.handleAction(data as A2UIActionMessage);
      return true;
    }

    // Handle A2UI answer messages
    if (data.type === 'a2ui-answer' && answerCallback) {
      a2uiHandler.handleAnswer(data as A2UIQuestionAnswerMessage, answerCallback);
      return true;
    }

    return false;
  } catch (e) {
    console.error('[A2UI] Failed to parse message:', e);
    return false;
  }
}

// ========== Singleton Export ==========

/** Global A2UI WebSocket handler instance */
export const a2uiWebSocketHandler = new A2UIWebSocketHandler();
