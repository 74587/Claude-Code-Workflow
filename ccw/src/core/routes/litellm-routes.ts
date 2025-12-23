// @ts-nocheck
/**
 * LiteLLM Routes Module
 * Handles all LiteLLM-related API endpoints
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { getLiteLLMClient, getLiteLLMStatus, checkLiteLLMAvailable } from '../../tools/litellm-client.js';

export interface RouteContext {
  pathname: string;
  url: URL;
  req: IncomingMessage;
  res: ServerResponse;
  initialPath: string;
  handlePostRequest: (req: IncomingMessage, res: ServerResponse, handler: (body: unknown) => Promise<any>) => void;
  broadcastToClients: (data: unknown) => void;
}

/**
 * Handle LiteLLM routes
 * @returns true if route was handled, false otherwise
 */
export async function handleLiteLLMRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath, handlePostRequest } = ctx;

  // API: LiteLLM Status - Check availability and version
  if (pathname === '/api/litellm/status') {
    try {
      const status = await getLiteLLMStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ available: false, error: err.message }));
    }
    return true;
  }

  // API: LiteLLM Config - Get configuration
  if (pathname === '/api/litellm/config' && req.method === 'GET') {
    try {
      const client = getLiteLLMClient();
      const config = await client.getConfig();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(config));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return true;
  }

  // API: LiteLLM Embed - Generate embeddings
  if (pathname === '/api/litellm/embed' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { texts, model = 'default' } = body;

      if (!texts || !Array.isArray(texts)) {
        return { error: 'texts array is required', status: 400 };
      }

      if (texts.length === 0) {
        return { error: 'texts array cannot be empty', status: 400 };
      }

      try {
        const client = getLiteLLMClient();
        const result = await client.embed(texts, model);
        return { success: true, ...result };
      } catch (err) {
        return { error: err.message, status: 500 };
      }
    });
    return true;
  }

  // API: LiteLLM Chat - Chat with LLM
  if (pathname === '/api/litellm/chat' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { message, messages, model = 'default' } = body;

      // Support both single message and messages array
      if (!message && (!messages || !Array.isArray(messages))) {
        return { error: 'message or messages array is required', status: 400 };
      }

      try {
        const client = getLiteLLMClient();

        if (messages && Array.isArray(messages)) {
          // Multi-turn chat
          const result = await client.chatMessages(messages, model);
          return { success: true, ...result };
        } else {
          // Single message chat
          const content = await client.chat(message, model);
          return { success: true, content, model };
        }
      } catch (err) {
        return { error: err.message, status: 500 };
      }
    });
    return true;
  }

  return false;
}
