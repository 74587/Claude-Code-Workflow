// ========================================
// Cache Settings Component
// ========================================
// Global cache configuration form with statistics display

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import {
  Database,
  Trash2,
  Save,
  HardDrive,
  FileText,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import { Progress } from '@/components/ui/Progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/AlertDialog';
import {
  useCacheStats,
  useUpdateCacheSettings,
  useClearCache,
} from '@/hooks/useApiSettings';
import { useNotifications } from '@/hooks/useNotifications';
import type { GlobalCacheSettings } from '@/lib/api';
import { cn } from '@/lib/utils';

// ========== Types ==========

export interface CacheSettingsProps {
  className?: string;
}

// ========== Helper Components ==========

interface CacheUsageIndicatorProps {
  used: number;
  total: number;
}

function CacheUsageIndicator({ used, total }: CacheUsageIndicatorProps) {
  const { formatMessage } = useIntl();
  const percentage = total > 0 ? Math.round((used / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {formatMessage({ id: 'apiSettings.cache.settings.cacheUsage' })}
        </span>
        <span className="font-medium">
          {percentage}%
        </span>
      </div>
      <Progress value={percentage} className="h-2" />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {formatMessage({ id: 'apiSettings.cache.settings.used' })} {(used / 1024 / 1024).toFixed(2)} MB
        </span>
        <span>
          {formatMessage({ id: 'apiSettings.cache.settings.total' })} {(total / 1024 / 1024).toFixed(2)} MB
        </span>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  className?: string;
}

function StatCard({ icon, label, value, className }: StatCardProps) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-md text-primary">
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </div>
    </Card>
  );
}

// ========== Main Component ==========

export function CacheSettings({ className }: CacheSettingsProps) {
  const { formatMessage } = useIntl();
  const { success, error } = useNotifications();

  // Queries and mutations
  const { stats, refetch } = useCacheStats();
  const { updateCacheSettings, isUpdating } = useUpdateCacheSettings();
  const { clearCache, isClearing } = useClearCache();

  // Form state - initialize with defaults, will update from API if available
  const [settings, setSettings] = useState<Partial<GlobalCacheSettings>>({
    enabled: true,
    cacheDir: '',
    maxTotalSizeMB: 1024,
  });

  const [showClearDialog, setShowClearDialog] = useState(false);

  // Update local state when stats load (if API returns settings)
  useEffect(() => {
    if (stats) {
      // CacheStats has totalSize, maxSize, entries - settings might need separate fetch
      // For now, keep local state as the source of truth for settings
    }
  }, [stats]);

  // Handle save
  const handleSave = async () => {
    try {
      await updateCacheSettings(settings);
      success(
        formatMessage({ id: 'apiSettings.cache.messages.cacheSettingsUpdated' })
      );
      await refetch();
    } catch (err) {
      error(
        formatMessage({ id: 'common.error' }),
        err instanceof Error ? err.message : formatMessage({ id: 'common.error' })
      );
    }
  };

  // Handle clear cache
  const handleClearCache = async () => {
    try {
      await clearCache();
      setShowClearDialog(false);
      success(
        formatMessage({ id: 'apiSettings.cache.messages.cacheCleared' })
      );
      await refetch();
    } catch (err) {
      error(
        formatMessage({ id: 'common.error' }),
        err instanceof Error ? err.message : formatMessage({ id: 'common.error' })
      );
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={<FileText className="w-5 h-5" />}
          label={formatMessage({ id: 'apiSettings.cache.settings.cacheEntries' })}
          value={stats?.entries ?? 0}
        />
        <StatCard
          icon={<HardDrive className="w-5 h-5" />}
          label={formatMessage({ id: 'apiSettings.cache.settings.cacheSize' })}
          value={`${((stats?.totalSize ?? 0) / 1024 / 1024).toFixed(2)} MB`}
        />
        <StatCard
          icon={<Database className="w-5 h-5" />}
          label={formatMessage({ id: 'apiSettings.cache.settings.maxSize' })}
          value={`${((stats?.maxSize ?? 0) / 1024 / 1024).toFixed(2)} MB`}
        />
      </div>

      {/* Cache Usage Progress */}
      {stats && (
        <Card className="p-4">
          <CacheUsageIndicator
            used={stats.totalSize}
            total={stats.maxSize}
          />
        </Card>
      )}

      {/* Settings Form */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          {formatMessage({ id: 'apiSettings.cache.settings.title' })}
        </h3>

        <div className="space-y-4">
          {/* Enable Global Caching */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="cache-enabled">
                {formatMessage({ id: 'apiSettings.cache.settings.enableGlobalCaching' })}
              </Label>
            </div>
            <Switch
              id="cache-enabled"
              checked={settings.enabled ?? true}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, enabled: checked })
              }
              disabled={isUpdating}
            />
          </div>

          {/* Cache Directory */}
          <div className="space-y-2">
            <Label htmlFor="cache-dir">
              {formatMessage({ id: 'apiSettings.cache.settings.cacheDirectory' })}
            </Label>
            <Input
              id="cache-dir"
              value={settings.cacheDir ?? ''}
              onChange={(e) =>
                setSettings({ ...settings, cacheDir: e.target.value })
              }
              disabled={isUpdating}
              placeholder="/path/to/cache"
            />
          </div>

          {/* Max Total Size */}
          <div className="space-y-2">
            <Label htmlFor="cache-max-size">
              {formatMessage({ id: 'apiSettings.cache.settings.maxSize' })}
            </Label>
            <Input
              id="cache-max-size"
              type="number"
              min={1}
              value={settings.maxTotalSizeMB ?? 1024}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  maxTotalSizeMB: parseInt(e.target.value) || 1024,
                })
              }
              disabled={isUpdating}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="destructive"
              onClick={() => setShowClearDialog(true)}
              disabled={isClearing}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {formatMessage({ id: 'apiSettings.cache.settings.actions.clearCache' })}
            </Button>

            <Button onClick={handleSave} disabled={isUpdating}>
              <Save className="w-4 h-4 mr-2" />
              {formatMessage({ id: 'common.save' })}
            </Button>
          </div>
        </div>
      </Card>

      {/* Clear Cache Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {formatMessage({ id: 'apiSettings.cache.settings.actions.clearCache' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {formatMessage({
                id: 'apiSettings.cache.settings.confirmClearCache',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>
              {formatMessage({ id: 'common.cancel' })}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleClearCache} disabled={isClearing}>
              {isClearing
                ? formatMessage({ id: 'common.loading' })
                : formatMessage({ id: 'common.confirm' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
