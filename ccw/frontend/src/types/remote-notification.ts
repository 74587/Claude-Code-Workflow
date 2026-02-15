// ========================================
// Remote Notification Types (Frontend)
// ========================================
// Type definitions for remote notification system UI
// Mirrors backend types with UI-specific additions

/**
 * Supported notification platforms
 */
export type NotificationPlatform = 'discord' | 'telegram' | 'webhook';

/**
 * Event types that can trigger notifications
 */
export type NotificationEventType =
  | 'ask-user-question'
  | 'session-start'
  | 'session-end'
  | 'task-completed'
  | 'task-failed';

/**
 * Discord platform configuration
 */
export interface DiscordConfig {
  enabled: boolean;
  webhookUrl: string;
  username?: string;
  avatarUrl?: string;
}

/**
 * Telegram platform configuration
 */
export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}

/**
 * Generic Webhook platform configuration
 */
export interface WebhookConfig {
  enabled: boolean;
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Event configuration
 */
export interface EventConfig {
  event: NotificationEventType;
  platforms: NotificationPlatform[];
  enabled: boolean;
}

/**
 * Full remote notification configuration
 */
export interface RemoteNotificationConfig {
  enabled: boolean;
  platforms: {
    discord?: DiscordConfig;
    telegram?: TelegramConfig;
    webhook?: WebhookConfig;
  };
  events: EventConfig[];
  timeout: number;
}

/**
 * Test notification request
 */
export interface TestNotificationRequest {
  platform: NotificationPlatform;
  config: DiscordConfig | TelegramConfig | WebhookConfig;
}

/**
 * Test notification result
 */
export interface TestNotificationResult {
  success: boolean;
  error?: string;
  responseTime?: number;
}

/**
 * Platform display info
 */
export interface PlatformInfo {
  id: NotificationPlatform;
  name: string;
  icon: string;
  description: string;
  requiredFields: string[];
}

/**
 * Event display info
 */
export interface EventInfo {
  id: NotificationEventType;
  name: string;
  description: string;
  icon: string;
}

/**
 * Predefined platform information
 */
export const PLATFORM_INFO: Record<NotificationPlatform, PlatformInfo> = {
  discord: {
    id: 'discord',
    name: 'Discord',
    icon: 'message-circle',
    description: 'Send notifications to Discord channels via webhook',
    requiredFields: ['webhookUrl'],
  },
  telegram: {
    id: 'telegram',
    name: 'Telegram',
    icon: 'send',
    description: 'Send notifications to Telegram chats via bot',
    requiredFields: ['botToken', 'chatId'],
  },
  webhook: {
    id: 'webhook',
    name: 'Custom Webhook',
    icon: 'link',
    description: 'Send notifications to a custom HTTP endpoint',
    requiredFields: ['url'],
  },
};

/**
 * Predefined event information
 */
export const EVENT_INFO: Record<NotificationEventType, EventInfo> = {
  'ask-user-question': {
    id: 'ask-user-question',
    name: 'Ask User Question',
    description: 'Notification when Claude asks a question via AskUserQuestion',
    icon: 'help-circle',
  },
  'session-start': {
    id: 'session-start',
    name: 'Session Start',
    description: 'Notification when a CLI session starts',
    icon: 'play',
  },
  'session-end': {
    id: 'session-end',
    name: 'Session End',
    description: 'Notification when a CLI session ends',
    icon: 'square',
  },
  'task-completed': {
    id: 'task-completed',
    name: 'Task Completed',
    description: 'Notification when a task completes successfully',
    icon: 'check-circle',
  },
  'task-failed': {
    id: 'task-failed',
    name: 'Task Failed',
    description: 'Notification when a task fails',
    icon: 'alert-circle',
  },
};

/**
 * Default configuration for UI initialization
 */
export function getDefaultConfig(): RemoteNotificationConfig {
  return {
    enabled: false,
    platforms: {},
    events: [
      { event: 'ask-user-question', platforms: ['discord', 'telegram'], enabled: true },
      { event: 'session-start', platforms: [], enabled: false },
      { event: 'session-end', platforms: [], enabled: false },
      { event: 'task-completed', platforms: [], enabled: false },
      { event: 'task-failed', platforms: ['discord', 'telegram'], enabled: true },
    ],
    timeout: 10000,
  };
}
