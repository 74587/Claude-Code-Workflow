// ========================================
// Platform Configuration Cards
// ========================================
// Individual configuration cards for each notification platform

import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  MessageCircle,
  Send,
  Link,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  TestTube,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type {
  RemoteNotificationConfig,
  NotificationPlatform,
  DiscordConfig,
  TelegramConfig,
  WebhookConfig,
} from '@/types/remote-notification';
import { PLATFORM_INFO } from '@/types/remote-notification';

interface PlatformConfigCardsProps {
  config: RemoteNotificationConfig;
  expandedPlatform: NotificationPlatform | null;
  testing: NotificationPlatform | null;
  onToggleExpand: (platform: NotificationPlatform | null) => void;
  onUpdateConfig: (
    platform: NotificationPlatform,
    updates: Partial<DiscordConfig | TelegramConfig | WebhookConfig>
  ) => void;
  onTest: (
    platform: NotificationPlatform,
    config: DiscordConfig | TelegramConfig | WebhookConfig
  ) => void;
  onSave: () => void;
  saving: boolean;
}

export function PlatformConfigCards({
  config,
  expandedPlatform,
  testing,
  onToggleExpand,
  onUpdateConfig,
  onTest,
  onSave,
  saving,
}: PlatformConfigCardsProps) {
  const { formatMessage } = useIntl();

  const platforms: NotificationPlatform[] = ['discord', 'telegram', 'webhook'];

  const getPlatformIcon = (platform: NotificationPlatform) => {
    switch (platform) {
      case 'discord':
        return <MessageCircle className="w-4 h-4" />;
      case 'telegram':
        return <Send className="w-4 h-4" />;
      case 'webhook':
        return <Link className="w-4 h-4" />;
    }
  };

  const getPlatformConfig = (
    platform: NotificationPlatform
  ): DiscordConfig | TelegramConfig | WebhookConfig => {
    switch (platform) {
      case 'discord':
        return config.platforms.discord || { enabled: false, webhookUrl: '' };
      case 'telegram':
        return config.platforms.telegram || { enabled: false, botToken: '', chatId: '' };
      case 'webhook':
        return config.platforms.webhook || { enabled: false, url: '', method: 'POST' };
    }
  };

  const isConfigured = (platform: NotificationPlatform): boolean => {
    const platformConfig = getPlatformConfig(platform);
    switch (platform) {
      case 'discord':
        return !!(platformConfig as DiscordConfig).webhookUrl;
      case 'telegram':
        return !!(platformConfig as TelegramConfig).botToken && !!(platformConfig as TelegramConfig).chatId;
      case 'webhook':
        return !!(platformConfig as WebhookConfig).url;
    }
  };

  return (
    <div className="grid gap-3">
      {platforms.map((platform) => {
        const info = PLATFORM_INFO[platform];
        const platformConfig = getPlatformConfig(platform);
        const configured = isConfigured(platform);
        const expanded = expandedPlatform === platform;

        return (
          <Card key={platform} className="overflow-hidden">
            {/* Header */}
            <div
              className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onToggleExpand(expanded ? null : platform)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2 rounded-lg',
                    platformConfig.enabled && configured
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {getPlatformIcon(platform)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{info.name}</span>
                      {configured && (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-500/30">
                          <Check className="w-3 h-3 mr-1" />
                          {formatMessage({ id: 'settings.remoteNotifications.configured' })}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{info.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={platformConfig.enabled ? 'default' : 'outline'}
                    size="sm"
                    className="h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateConfig(platform, { enabled: !platformConfig.enabled });
                    }}
                  >
                    {platformConfig.enabled ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                  </Button>
                  {expanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>

            {/* Expanded Content */}
            {expanded && (
              <div className="border-t border-border p-4 space-y-4 bg-muted/30">
                {platform === 'discord' && (
                  <DiscordConfigForm
                    config={platformConfig as DiscordConfig}
                    onUpdate={(updates) => onUpdateConfig('discord', updates)}
                  />
                )}
                {platform === 'telegram' && (
                  <TelegramConfigForm
                    config={platformConfig as TelegramConfig}
                    onUpdate={(updates) => onUpdateConfig('telegram', updates)}
                  />
                )}
                {platform === 'webhook' && (
                  <WebhookConfigForm
                    config={platformConfig as WebhookConfig}
                    onUpdate={(updates) => onUpdateConfig('webhook', updates)}
                  />
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onTest(platform, platformConfig)}
                    disabled={testing === platform || !configured}
                  >
                    <TestTube className={cn('w-3.5 h-3.5 mr-1', testing === platform && 'animate-pulse')} />
                    {formatMessage({ id: 'settings.remoteNotifications.testConnection' })}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={onSave}
                    disabled={saving}
                  >
                    {formatMessage({ id: 'settings.remoteNotifications.save' })}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ========== Discord Config Form ==========

function DiscordConfigForm({
  config,
  onUpdate,
}: {
  config: DiscordConfig;
  onUpdate: (updates: Partial<DiscordConfig>) => void;
}) {
  const { formatMessage } = useIntl();
  const [showUrl, setShowUrl] = useState(false);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium text-foreground">
          {formatMessage({ id: 'settings.remoteNotifications.discord.webhookUrl' })}
        </label>
        <div className="flex gap-2 mt-1">
          <Input
            type={showUrl ? 'text' : 'password'}
            value={config.webhookUrl || ''}
            onChange={(e) => onUpdate({ webhookUrl: e.target.value })}
            placeholder="https://discord.com/api/webhooks/..."
            className="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setShowUrl(!showUrl)}
          >
            {showUrl ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {formatMessage({ id: 'settings.remoteNotifications.discord.webhookUrlHint' })}
        </p>
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">
          {formatMessage({ id: 'settings.remoteNotifications.discord.username' })}
        </label>
        <Input
          value={config.username || ''}
          onChange={(e) => onUpdate({ username: e.target.value })}
          placeholder="CCW Notification"
          className="mt-1"
        />
      </div>
    </div>
  );
}

// ========== Telegram Config Form ==========

function TelegramConfigForm({
  config,
  onUpdate,
}: {
  config: TelegramConfig;
  onUpdate: (updates: Partial<TelegramConfig>) => void;
}) {
  const { formatMessage } = useIntl();
  const [showToken, setShowToken] = useState(false);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium text-foreground">
          {formatMessage({ id: 'settings.remoteNotifications.telegram.botToken' })}
        </label>
        <div className="flex gap-2 mt-1">
          <Input
            type={showToken ? 'text' : 'password'}
            value={config.botToken || ''}
            onChange={(e) => onUpdate({ botToken: e.target.value })}
            placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
            className="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setShowToken(!showToken)}
          >
            {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {formatMessage({ id: 'settings.remoteNotifications.telegram.botTokenHint' })}
        </p>
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">
          {formatMessage({ id: 'settings.remoteNotifications.telegram.chatId' })}
        </label>
        <Input
          value={config.chatId || ''}
          onChange={(e) => onUpdate({ chatId: e.target.value })}
          placeholder="-1001234567890"
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          {formatMessage({ id: 'settings.remoteNotifications.telegram.chatIdHint' })}
        </p>
      </div>
    </div>
  );
}

// ========== Webhook Config Form ==========

function WebhookConfigForm({
  config,
  onUpdate,
}: {
  config: WebhookConfig;
  onUpdate: (updates: Partial<WebhookConfig>) => void;
}) {
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium text-foreground">
          {formatMessage({ id: 'settings.remoteNotifications.webhook.url' })}
        </label>
        <Input
          value={config.url || ''}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder="https://your-server.com/webhook"
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">
          {formatMessage({ id: 'settings.remoteNotifications.webhook.method' })}
        </label>
        <div className="flex gap-2 mt-1">
          <Button
            variant={config.method === 'POST' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onUpdate({ method: 'POST' })}
          >
            POST
          </Button>
          <Button
            variant={config.method === 'PUT' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onUpdate({ method: 'PUT' })}
          >
            PUT
          </Button>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">
          {formatMessage({ id: 'settings.remoteNotifications.webhook.headers' })}
        </label>
        <Input
          value={config.headers ? JSON.stringify(config.headers) : ''}
          onChange={(e) => {
            try {
              const headers = e.target.value ? JSON.parse(e.target.value) : undefined;
              onUpdate({ headers });
            } catch {
              // Invalid JSON, ignore
            }
          }}
          placeholder='{"Authorization": "Bearer token"}'
          className="mt-1 font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground mt-1">
          {formatMessage({ id: 'settings.remoteNotifications.webhook.headersHint' })}
        </p>
      </div>
    </div>
  );
}

export default PlatformConfigCards;
