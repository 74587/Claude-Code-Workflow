// ========================================
// Remote Notification Service
// ========================================
// Core service for dispatching notifications to external platforms
// Non-blocking, best-effort delivery with parallel dispatch

import http from 'http';
import https from 'https';
import { URL } from 'url';
import type {
  RemoteNotificationConfig,
  NotificationContext,
  NotificationDispatchResult,
  PlatformNotificationResult,
  NotificationPlatform,
  DiscordConfig,
  TelegramConfig,
  WebhookConfig,
} from '../../types/remote-notification.js';
import {
  loadConfig,
  getEnabledPlatformsForEvent,
  hasEnabledPlatform,
} from '../../config/remote-notification-config.js';

/**
 * Remote Notification Service
 * Handles dispatching notifications to configured platforms
 */
class RemoteNotificationService {
  private config: RemoteNotificationConfig | null = null;
  private configLoadedAt: number = 0;
  private readonly CONFIG_TTL = 30000; // Reload config every 30 seconds

  /**
   * Get current config (with auto-reload)
   */
  private getConfig(): RemoteNotificationConfig {
    const now = Date.now();
    if (!this.config || now - this.configLoadedAt > this.CONFIG_TTL) {
      this.config = loadConfig();
      this.configLoadedAt = now;
    }
    return this.config;
  }

  /**
   * Force reload configuration
   */
  reloadConfig(): void {
    this.config = loadConfig();
    this.configLoadedAt = Date.now();
  }

  /**
   * Check if notifications are enabled for a given event
   */
  shouldNotify(eventType: string): boolean {
    const config = this.getConfig();
    if (!config.enabled) return false;

    const enabledPlatforms = getEnabledPlatformsForEvent(config, eventType);
    return enabledPlatforms.length > 0;
  }

  /**
   * Send notification to all configured platforms for an event
   * Non-blocking: returns immediately, actual dispatch is async
   */
  sendNotification(
    eventType: string,
    context: Omit<NotificationContext, 'eventType' | 'timestamp'>
  ): void {
    const config = this.getConfig();

    // Quick check before async dispatch
    if (!config.enabled) return;

    const enabledPlatforms = getEnabledPlatformsForEvent(config, eventType);
    if (enabledPlatforms.length === 0) return;

    const fullContext: NotificationContext = {
      ...context,
      eventType: eventType as NotificationContext['eventType'],
      timestamp: new Date().toISOString(),
    };

    // Fire-and-forget dispatch
    this.dispatchToPlatforms(enabledPlatforms, fullContext, config).catch((error) => {
      // Silent failure - log only
      console.error('[RemoteNotification] Dispatch failed:', error);
    });
  }

  /**
   * Send notification and wait for results (for testing)
   */
  async sendNotificationAsync(
    eventType: string,
    context: Omit<NotificationContext, 'eventType' | 'timestamp'>
  ): Promise<NotificationDispatchResult> {
    const config = this.getConfig();
    const startTime = Date.now();

    if (!config.enabled) {
      return { success: false, results: [], totalTime: 0 };
    }

    const enabledPlatforms = getEnabledPlatformsForEvent(config, eventType);
    if (enabledPlatforms.length === 0) {
      return { success: false, results: [], totalTime: Date.now() - startTime };
    }

    const fullContext: NotificationContext = {
      ...context,
      eventType: eventType as NotificationContext['eventType'],
      timestamp: new Date().toISOString(),
    };

    const results = await this.dispatchToPlatforms(enabledPlatforms, fullContext, config);

    return {
      success: results.some((r) => r.success),
      results,
      totalTime: Date.now() - startTime,
    };
  }

  /**
   * Dispatch to multiple platforms in parallel
   */
  private async dispatchToPlatforms(
    platforms: string[],
    context: NotificationContext,
    config: RemoteNotificationConfig
  ): Promise<PlatformNotificationResult[]> {
    const promises = platforms.map((platform) =>
      this.dispatchToPlatform(platform as NotificationPlatform, context, config)
    );

    const results = await Promise.allSettled(promises);

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        platform: platforms[index] as NotificationPlatform,
        success: false,
        error: result.reason?.message || 'Unknown error',
      };
    });
  }

  /**
   * Dispatch to a single platform
   */
  private async dispatchToPlatform(
    platform: NotificationPlatform,
    context: NotificationContext,
    config: RemoteNotificationConfig
  ): Promise<PlatformNotificationResult> {
    const startTime = Date.now();

    try {
      switch (platform) {
        case 'discord':
          return await this.sendDiscord(context, config.platforms.discord!, config.timeout);
        case 'telegram':
          return await this.sendTelegram(context, config.platforms.telegram!, config.timeout);
        case 'webhook':
          return await this.sendWebhook(context, config.platforms.webhook!, config.timeout);
        default:
          return {
            platform,
            success: false,
            error: `Unknown platform: ${platform}`,
          };
      }
    } catch (error) {
      return {
        platform,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Send Discord notification via webhook
   */
  private async sendDiscord(
    context: NotificationContext,
    config: DiscordConfig,
    timeout: number
  ): Promise<PlatformNotificationResult> {
    const startTime = Date.now();

    if (!config.webhookUrl) {
      return { platform: 'discord', success: false, error: 'Webhook URL not configured' };
    }

    const embed = this.buildDiscordEmbed(context);
    const body = {
      username: config.username || 'CCW Notification',
      avatar_url: config.avatarUrl,
      embeds: [embed],
    };

    try {
      await this.httpRequest(config.webhookUrl, body, timeout);
      return {
        platform: 'discord',
        success: true,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        platform: 'discord',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Build Discord embed from context
   */
  private buildDiscordEmbed(context: NotificationContext): Record<string, unknown> {
    const eventEmoji: Record<string, string> = {
      'ask-user-question': '❓',
      'session-start': '▶️',
      'session-end': '⏹️',
      'task-completed': '✅',
      'task-failed': '❌',
    };

    const eventColors: Record<string, number> = {
      'ask-user-question': 0x3498db, // Blue
      'session-start': 0x2ecc71, // Green
      'session-end': 0x95a5a6, // Gray
      'task-completed': 0x27ae60, // Dark Green
      'task-failed': 0xe74c3c, // Red
    };

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

    if (context.sessionId) {
      fields.push({ name: 'Session', value: context.sessionId.slice(0, 16) + '...', inline: true });
    }

    if (context.questionText) {
      const truncated = context.questionText.length > 200
        ? context.questionText.slice(0, 200) + '...'
        : context.questionText;
      fields.push({ name: 'Question', value: truncated, inline: false });
    }

    if (context.taskDescription) {
      const truncated = context.taskDescription.length > 200
        ? context.taskDescription.slice(0, 200) + '...'
        : context.taskDescription;
      fields.push({ name: 'Task', value: truncated, inline: false });
    }

    if (context.errorMessage) {
      const truncated = context.errorMessage.length > 200
        ? context.errorMessage.slice(0, 200) + '...'
        : context.errorMessage;
      fields.push({ name: 'Error', value: truncated, inline: false });
    }

    return {
      title: `${eventEmoji[context.eventType] || '📢'} ${this.formatEventName(context.eventType)}`,
      color: eventColors[context.eventType] || 0x9b59b6,
      fields,
      timestamp: context.timestamp,
      footer: { text: 'CCW Remote Notification' },
    };
  }

  /**
   * Send Telegram notification via Bot API
   */
  private async sendTelegram(
    context: NotificationContext,
    config: TelegramConfig,
    timeout: number
  ): Promise<PlatformNotificationResult> {
    const startTime = Date.now();

    if (!config.botToken || !config.chatId) {
      return { platform: 'telegram', success: false, error: 'Bot token or chat ID not configured' };
    }

    const text = this.buildTelegramMessage(context);
    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    const body = {
      chat_id: config.chatId,
      text,
      parse_mode: config.parseMode || 'HTML',
    };

    try {
      await this.httpRequest(url, body, timeout);
      return {
        platform: 'telegram',
        success: true,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        platform: 'telegram',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Build Telegram message from context
   */
  private buildTelegramMessage(context: NotificationContext): string {
    const eventEmoji: Record<string, string> = {
      'ask-user-question': '❓',
      'session-start': '▶️',
      'session-end': '⏹️',
      'task-completed': '✅',
      'task-failed': '❌',
    };

    const lines: string[] = [];
    lines.push(`<b>${eventEmoji[context.eventType] || '📢'} ${this.formatEventName(context.eventType)}</b>`);
    lines.push('');

    if (context.sessionId) {
      lines.push(`<b>Session:</b> <code>${context.sessionId.slice(0, 16)}...</code>`);
    }

    if (context.questionText) {
      const truncated = context.questionText.length > 300
        ? context.questionText.slice(0, 300) + '...'
        : context.questionText;
      lines.push(`<b>Question:</b> ${this.escapeHtml(truncated)}`);
    }

    if (context.taskDescription) {
      const truncated = context.taskDescription.length > 300
        ? context.taskDescription.slice(0, 300) + '...'
        : context.taskDescription;
      lines.push(`<b>Task:</b> ${this.escapeHtml(truncated)}`);
    }

    if (context.errorMessage) {
      const truncated = context.errorMessage.length > 300
        ? context.errorMessage.slice(0, 300) + '...'
        : context.errorMessage;
      lines.push(`<b>Error:</b> <code>${this.escapeHtml(truncated)}</code>`);
    }

    lines.push('');
    lines.push(`<i>📅 ${new Date(context.timestamp).toLocaleString()}</i>`);

    return lines.join('\n');
  }

  /**
   * Send generic webhook notification
   */
  private async sendWebhook(
    context: NotificationContext,
    config: WebhookConfig,
    timeout: number
  ): Promise<PlatformNotificationResult> {
    const startTime = Date.now();

    if (!config.url) {
      return { platform: 'webhook', success: false, error: 'Webhook URL not configured' };
    }

    const body = {
      event: context.eventType,
      timestamp: context.timestamp,
      sessionId: context.sessionId,
      questionText: context.questionText,
      taskDescription: context.taskDescription,
      errorMessage: context.errorMessage,
      metadata: context.metadata,
    };

    try {
      await this.httpRequest(config.url, body, config.timeout || timeout, config.method, config.headers);
      return {
        platform: 'webhook',
        success: true,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        platform: 'webhook',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Check if a URL is safe from SSRF attacks
   * Blocks private IP ranges, loopback, and link-local addresses
   */
  private isUrlSafe(urlString: string): { safe: boolean; error?: string } {
    try {
      const parsedUrl = new URL(urlString);

      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return { safe: false, error: 'Only http and https protocols are allowed' };
      }

      const hostname = parsedUrl.hostname.toLowerCase();

      // Block localhost variants
      if (hostname === 'localhost' || hostname === 'localhost.localdomain' || hostname === '0.0.0.0') {
        return { safe: false, error: 'Localhost addresses are not allowed' };
      }

      // Block IPv4 loopback (127.0.0.0/8)
      if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
        return { safe: false, error: 'Loopback addresses are not allowed' };
      }

      // Block IPv4 private ranges
      // 10.0.0.0/8
      if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
        return { safe: false, error: 'Private IP addresses are not allowed' };
      }
      // 172.16.0.0/12
      if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
        return { safe: false, error: 'Private IP addresses are not allowed' };
      }
      // 192.168.0.0/16
      if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
        return { safe: false, error: 'Private IP addresses are not allowed' };
      }

      // Block link-local addresses (169.254.0.0/16)
      if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
        return { safe: false, error: 'Link-local addresses are not allowed' };
      }

      // Block IPv6 loopback and private
      if (hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd') || hostname === '::') {
        return { safe: false, error: 'IPv6 private/loopback addresses are not allowed' };
      }

      // Block hostnames that look like IP addresses in various formats
      // (e.g., 0x7f.0.0.1, 2130706433, etc.)
      if (/^0x[0-9a-f]+/i.test(hostname) || /^\d{8,}$/.test(hostname)) {
        return { safe: false, error: 'Suspicious hostname format' };
      }

      // Block cloud metadata endpoints
      if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal' || hostname === 'metadata.azure.internal') {
        return { safe: false, error: 'Cloud metadata endpoints are not allowed' };
      }

      return { safe: true };
    } catch (error) {
      return { safe: false, error: 'Invalid URL format' };
    }
  }

  /**
   * Generic HTTP request helper
   */
  private httpRequest(
    url: string,
    body: unknown,
    timeout: number,
    method: 'POST' | 'PUT' = 'POST',
    headers: Record<string, string> = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // SSRF protection: validate URL before making request
      const urlSafety = this.isUrlSafe(url);
      if (!urlSafety.safe) {
        reject(new Error(`URL validation failed: ${urlSafety.error}`));
        return;
      }

      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const requestOptions: http.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        timeout,
      };

      const req = client.request(requestOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(JSON.stringify(body));
      req.end();
    });
  }

  /**
   * Format event name for display
   */
  private formatEventName(eventType: string): string {
    return eventType
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Escape HTML for Telegram messages
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Test a platform configuration
   */
  async testPlatform(
    platform: NotificationPlatform,
    config: DiscordConfig | TelegramConfig | WebhookConfig
  ): Promise<{ success: boolean; error?: string; responseTime?: number }> {
    const testContext: NotificationContext = {
      eventType: 'task-completed',
      sessionId: 'test-session',
      taskDescription: 'This is a test notification from CCW',
      timestamp: new Date().toISOString(),
    };

    const startTime = Date.now();

    try {
      switch (platform) {
        case 'discord':
          return await this.sendDiscord(testContext, config as DiscordConfig, 10000);
        case 'telegram':
          return await this.sendTelegram(testContext, config as TelegramConfig, 10000);
        case 'webhook':
          return await this.sendWebhook(testContext, config as WebhookConfig, 10000);
        default:
          return { success: false, error: `Unknown platform: ${platform}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
      };
    }
  }
}

// Singleton instance
export const remoteNotificationService = new RemoteNotificationService();
