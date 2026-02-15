// ========================================
// Remote Notification Routes
// ========================================
// API endpoints for remote notification configuration

import type { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import {
  loadConfig,
  saveConfig,
  resetConfig,
} from '../../config/remote-notification-config.js';
import {
  remoteNotificationService,
} from '../../services/remote-notification-service.js';
import {
  maskSensitiveConfig,
  type RemoteNotificationConfig,
  type TestNotificationRequest,
  type NotificationPlatform,
  type DiscordConfig,
  type TelegramConfig,
  type WebhookConfig,
} from '../../types/remote-notification.js';
import { deepMerge } from '../../types/util.js';

// ========== Input Validation ==========

/**
 * Validate URL format (must be http or https)
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Validate Discord webhook URL format
 */
function isValidDiscordWebhookUrl(url: string): boolean {
  if (!isValidUrl(url)) return false;
  try {
    const parsed = new URL(url);
    // Discord webhooks are typically: discord.com/api/webhooks/{id}/{token}
    return (
      (parsed.hostname === 'discord.com' || parsed.hostname === 'discordapp.com') &&
      parsed.pathname.startsWith('/api/webhooks/')
    );
  } catch {
    return false;
  }
}

/**
 * Validate Telegram bot token format (typically: 123456789:ABCdef...)
 */
function isValidTelegramBotToken(token: string): boolean {
  // Telegram bot tokens are in format: {bot_id}:{token}
  // Bot ID is a number, token is alphanumeric with underscores and hyphens
  return /^\d{8,15}:[A-Za-z0-9_-]{30,50}$/.test(token);
}

/**
 * Validate Telegram chat ID format
 */
function isValidTelegramChatId(chatId: string): boolean {
  // Chat IDs are numeric, optionally negative (for groups)
  return /^-?\d{1,20}$/.test(chatId);
}

/**
 * Validate webhook headers (must be valid JSON object)
 */
function isValidHeaders(headers: unknown): { valid: boolean; error?: string } {
  if (headers === undefined || headers === null) {
    return { valid: true }; // Optional field
  }

  if (typeof headers !== 'object' || Array.isArray(headers)) {
    return { valid: false, error: 'Headers must be an object' };
  }

  const headerObj = headers as Record<string, unknown>;

  // Check for reasonable size limit (10KB)
  const serialized = JSON.stringify(headers);
  if (serialized.length > 10240) {
    return { valid: false, error: 'Headers too large (max 10KB)' };
  }

  // Validate each header key and value
  for (const [key, value] of Object.entries(headerObj)) {
    if (typeof key !== 'string' || key.length === 0) {
      return { valid: false, error: 'Header keys must be non-empty strings' };
    }
    if (typeof value !== 'string') {
      return { valid: false, error: `Header '${key}' value must be a string` };
    }
    // Block potentially dangerous headers
    const lowerKey = key.toLowerCase();
    if (['host', 'content-length', 'connection'].includes(lowerKey)) {
      return { valid: false, error: `Header '${key}' is not allowed` };
    }
  }

  return { valid: true };
}

/**
 * Validate configuration updates
 */
function validateConfigUpdates(updates: Partial<RemoteNotificationConfig>): { valid: boolean; error?: string } {
  // Validate platforms if present
  if (updates.platforms) {
    const { discord, telegram, webhook } = updates.platforms;

    // Validate Discord config
    if (discord) {
      if (discord.webhookUrl !== undefined && discord.webhookUrl !== '') {
        if (!isValidUrl(discord.webhookUrl)) {
          return { valid: false, error: 'Invalid Discord webhook URL format' };
        }
        // Warning: we allow non-Discord URLs for flexibility, but log it
        if (!isValidDiscordWebhookUrl(discord.webhookUrl)) {
          console.warn('[RemoteNotification] Webhook URL does not match Discord format');
        }
      }
      if (discord.username !== undefined && discord.username.length > 80) {
        return { valid: false, error: 'Discord username too long (max 80 chars)' };
      }
    }

    // Validate Telegram config
    if (telegram) {
      if (telegram.botToken !== undefined && telegram.botToken !== '') {
        if (!isValidTelegramBotToken(telegram.botToken)) {
          return { valid: false, error: 'Invalid Telegram bot token format' };
        }
      }
      if (telegram.chatId !== undefined && telegram.chatId !== '') {
        if (!isValidTelegramChatId(telegram.chatId)) {
          return { valid: false, error: 'Invalid Telegram chat ID format' };
        }
      }
    }

    // Validate Webhook config
    if (webhook) {
      if (webhook.url !== undefined && webhook.url !== '') {
        if (!isValidUrl(webhook.url)) {
          return { valid: false, error: 'Invalid webhook URL format' };
        }
      }
      if (webhook.headers !== undefined) {
        const headerValidation = isValidHeaders(webhook.headers);
        if (!headerValidation.valid) {
          return { valid: false, error: headerValidation.error };
        }
      }
      if (webhook.timeout !== undefined && (webhook.timeout < 1000 || webhook.timeout > 60000)) {
        return { valid: false, error: 'Webhook timeout must be between 1000ms and 60000ms' };
      }
    }
  }

  // Validate timeout
  if (updates.timeout !== undefined && (updates.timeout < 1000 || updates.timeout > 60000)) {
    return { valid: false, error: 'Timeout must be between 1000ms and 60000ms' };
  }

  return { valid: true };
}

/**
 * Validate test notification request
 */
function validateTestRequest(request: TestNotificationRequest): { valid: boolean; error?: string } {
  if (!request.platform) {
    return { valid: false, error: 'Missing platform' };
  }

  const validPlatforms: NotificationPlatform[] = ['discord', 'telegram', 'webhook'];
  if (!validPlatforms.includes(request.platform as NotificationPlatform)) {
    return { valid: false, error: `Invalid platform: ${request.platform}` };
  }

  if (!request.config) {
    return { valid: false, error: 'Missing config' };
  }

  // Platform-specific validation
  switch (request.platform) {
    case 'discord': {
      const config = request.config as Partial<DiscordConfig>;
      if (!config.webhookUrl) {
        return { valid: false, error: 'Discord webhook URL is required' };
      }
      if (!isValidUrl(config.webhookUrl)) {
        return { valid: false, error: 'Invalid Discord webhook URL format' };
      }
      break;
    }
    case 'telegram': {
      const config = request.config as Partial<TelegramConfig>;
      if (!config.botToken) {
        return { valid: false, error: 'Telegram bot token is required' };
      }
      if (!config.chatId) {
        return { valid: false, error: 'Telegram chat ID is required' };
      }
      if (!isValidTelegramBotToken(config.botToken)) {
        return { valid: false, error: 'Invalid Telegram bot token format' };
      }
      if (!isValidTelegramChatId(config.chatId)) {
        return { valid: false, error: 'Invalid Telegram chat ID format' };
      }
      break;
    }
    case 'webhook': {
      const config = request.config as Partial<WebhookConfig>;
      if (!config.url) {
        return { valid: false, error: 'Webhook URL is required' };
      }
      if (!isValidUrl(config.url)) {
        return { valid: false, error: 'Invalid webhook URL format' };
      }
      if (config.headers) {
        const headerValidation = isValidHeaders(config.headers);
        if (!headerValidation.valid) {
          return { valid: false, error: headerValidation.error };
        }
      }
      break;
    }
  }

  return { valid: true };
}

/**
 * Handle remote notification routes
 * GET /api/notifications/remote/config - Get current config
 * POST /api/notifications/remote/config - Update config
 * POST /api/notifications/remote/test - Test notification
 * POST /api/notifications/remote/reset - Reset to defaults
 */
export async function handleNotificationRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<boolean> {
  // GET /api/notifications/remote/config
  if (pathname === '/api/notifications/remote/config' && req.method === 'GET') {
    const config = loadConfig();
    const masked = maskSensitiveConfig(config);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(masked));
    return true;
  }

  // POST /api/notifications/remote/config
  if (pathname === '/api/notifications/remote/config' && req.method === 'POST') {
    const body = await readBody(req);

    try {
      const updates = JSON.parse(body) as Partial<RemoteNotificationConfig>;

      // Validate input
      const validation = validateConfigUpdates(updates);
      if (!validation.valid) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: validation.error }));
        return true;
      }

      const current = loadConfig();
      const updated = deepMerge(current, updates);

      saveConfig(updated);

      // Reload service config
      remoteNotificationService.reloadConfig();

      const masked = maskSensitiveConfig(updated);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, config: masked }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'Invalid configuration',
      }));
    }
    return true;
  }

  // POST /api/notifications/remote/test
  if (pathname === '/api/notifications/remote/test' && req.method === 'POST') {
    const body = await readBody(req);

    try {
      const request = JSON.parse(body) as TestNotificationRequest;

      // Validate input
      const validation = validateTestRequest(request);
      if (!validation.valid) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: validation.error }));
        return true;
      }

      const result = await remoteNotificationService.testPlatform(
        request.platform as NotificationPlatform,
        request.config
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Invalid request',
      }));
    }
    return true;
  }

  // POST /api/notifications/remote/reset
  if (pathname === '/api/notifications/remote/reset' && req.method === 'POST') {
    const config = resetConfig();
    remoteNotificationService.reloadConfig();

    const masked = maskSensitiveConfig(config);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, config: masked }));
    return true;
  }

  return false;
}

/**
 * Read request body as string
 */
async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}
