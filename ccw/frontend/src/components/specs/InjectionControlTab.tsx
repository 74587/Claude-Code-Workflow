// ========================================
// InjectionControlTab Component
// ========================================
// Tab for managing spec injection control settings

import { useState, useEffect, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Progress } from '@/components/ui/Progress';
import {
  AlertCircle,
  Info,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

// ========== Types ==========

export interface InjectionStats {
  requiredOnly: number;
  withKeywords: number;
  maxLength: number;
  percentage: number;
}

export interface SpecStatsResponse {
  dimensions: {
    specs: { count: number; requiredCount: number };
    roadmap: { count: number; requiredCount: number };
    changelog: { count: number; requiredCount: number };
    personal: { count: number; requiredCount: number };
  };
  injectionLength: InjectionStats;
}

export interface InjectionSettings {
  maxLength: number;
  warnThreshold: number;
  truncateOnExceed: boolean;
}

export interface SystemSettingsResponse {
  injectionControl: InjectionSettings;
  personalSpecDefaults: {
    defaultReadMode: 'required' | 'optional';
    autoEnable: boolean;
  };
}

export interface InjectionControlTabProps {
  className?: string;
}

// ========== API Functions ==========

async function fetchSpecStats(): Promise<SpecStatsResponse> {
  const response = await fetch('/api/specs/stats');
  if (!response.ok) {
    throw new Error('Failed to fetch spec stats');
  }
  return response.json();
}

async function fetchSystemSettings(): Promise<SystemSettingsResponse> {
  const response = await fetch('/api/system/settings');
  if (!response.ok) {
    throw new Error('Failed to fetch system settings');
  }
  return response.json();
}

async function updateInjectionSettings(
  settings: Partial<InjectionSettings>
): Promise<SystemSettingsResponse> {
  const currentSettings = await fetchSystemSettings();
  const response = await fetch('/api/system/settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      injectionControl: {
        ...currentSettings.injectionControl,
        ...settings,
      },
    }),
  });
  if (!response.ok) {
    throw new Error('Failed to update settings');
  }
  return response.json();
}

// ========== Helper Functions ==========

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function calculatePercentage(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, (current / max) * 100);
}

// ========== Component ==========

export function InjectionControlTab({ className }: InjectionControlTabProps) {
  const { formatMessage } = useIntl();

  // State for stats
  const [stats, setStats] = useState<SpecStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<Error | null>(null);

  // State for settings
  const [settings, setSettings] = useState<InjectionSettings>({
    maxLength: 8000,
    warnThreshold: 6000,
    truncateOnExceed: true,
  });
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Form state (for local editing before save)
  const [formData, setFormData] = useState<InjectionSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch stats
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const data = await fetchSpecStats();
      setStats(data);
    } catch (err) {
      setStatsError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch settings
  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const data = await fetchSystemSettings();
      setSettings(data.injectionControl);
      setFormData(data.injectionControl);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadStats();
    loadSettings();
  }, [loadStats, loadSettings]);

  // Check for changes
  useEffect(() => {
    const changed =
      formData.maxLength !== settings.maxLength ||
      formData.warnThreshold !== settings.warnThreshold ||
      formData.truncateOnExceed !== settings.truncateOnExceed;
    setHasChanges(changed);
  }, [formData, settings]);

  // Handle form field changes
  const handleFieldChange = <K extends keyof InjectionSettings>(
    field: K,
    value: InjectionSettings[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Save settings
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await updateInjectionSettings(formData);
      setSettings(result.injectionControl);
      setFormData(result.injectionControl);
      setHasChanges(false);
      toast.success(
        formatMessage({ id: 'specs.injection.saveSuccess' }, { default: 'Settings saved successfully' })
      );
    } catch (err) {
      toast.error(
        formatMessage({ id: 'specs.injection.saveError' }, { default: 'Failed to save settings' })
      );
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setFormData(settings);
    setHasChanges(false);
  };

  // Calculate progress and status
  const currentLength = stats?.injectionLength?.withKeywords || 0;
  const maxLength = settings.maxLength;
  const warnThreshold = settings.warnThreshold;
  const percentage = calculatePercentage(currentLength, maxLength);
  const isOverLimit = currentLength > maxLength;
  const isOverWarning = currentLength > warnThreshold;
  const remainingSpace = Math.max(0, maxLength - currentLength);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Current Injection Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {formatMessage(
              { id: 'specs.injection.statusTitle', defaultMessage: 'Current Injection Status' }
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={loadStats}
              disabled={statsLoading}
            >
              <RefreshCw className={cn('h-4 w-4', statsLoading && 'animate-spin')} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {statsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : statsError ? (
            <div className="text-sm text-destructive">
              {formatMessage(
                { id: 'specs.injection.loadError', defaultMessage: 'Failed to load stats' }
              )}
            </div>
          ) : (
            <>
              {/* Current Length Display */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {formatMessage({ id: 'specs.injection.currentLength', defaultMessage: 'Current Length' })}
                </span>
                <span
                  className={cn(
                    'font-medium',
                    isOverLimit && 'text-destructive',
                    !isOverLimit && isOverWarning && 'text-yellow-600 dark:text-yellow-400'
                  )}
                >
                  {formatNumber(currentLength)} / {formatNumber(maxLength)}{' '}
                  {formatMessage({ id: 'specs.injection.characters', defaultMessage: 'characters' })}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <Progress
                  value={percentage}
                  className={cn(
                    'h-3',
                    isOverLimit && 'bg-destructive/20',
                    !isOverLimit && isOverWarning && 'bg-yellow-100 dark:bg-yellow-900/30'
                  )}
                  indicatorClassName={cn(
                    isOverLimit && 'bg-destructive',
                    !isOverLimit && isOverWarning && 'bg-yellow-500'
                  )}
                />

                {/* Warning threshold marker */}
                <div
                  className="relative h-0"
                  style={{
                    left: `${Math.min(100, (warnThreshold / maxLength) * 100)}%`,
                  }}
                >
                  <div className="absolute -top-5 transform -translate-x-1/2 flex flex-col items-center">
                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                    <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatMessage({ id: 'specs.injection.warnThreshold', defaultMessage: 'Warn' })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Warning Alert when over limit */}
              {isOverLimit && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-destructive">
                      {formatMessage({ id: 'specs.injection.overLimit', defaultMessage: 'Over Limit' })}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {formatMessage(
                        {
                          id: 'specs.injection.overLimitDescription',
                          defaultMessage: 'Current injection content exceeds maximum length of {max} characters. Excess content will be truncated.',
                        },
                        { max: formatNumber(maxLength) }
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Statistics Info */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  {formatMessage({ id: 'specs.injection.statsInfo', defaultMessage: 'Statistics' })}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">
                    {formatMessage({ id: 'specs.injection.requiredLength', defaultMessage: 'Required specs length:' })}
                  </div>
                  <div className="text-right">
                    {formatNumber(stats?.injectionLength?.requiredOnly || 0)} {formatMessage({ id: 'specs.injection.characters', defaultMessage: 'characters' })}
                  </div>
                  <div className="text-muted-foreground">
                    {formatMessage({ id: 'specs.injection.matchedLength', defaultMessage: 'Keyword-matched length:' })}
                  </div>
                  <div className="text-right">
                    {formatNumber(stats?.injectionLength?.withKeywords || 0)} {formatMessage({ id: 'specs.injection.characters', defaultMessage: 'characters' })}
                  </div>
                  <div className="text-muted-foreground">
                    {formatMessage({ id: 'specs.injection.remaining', defaultMessage: 'Remaining space:' })}
                  </div>
                  <div className={cn('text-right', remainingSpace === 0 && 'text-destructive')}>
                    {formatNumber(remainingSpace)} ({Math.round(100 - percentage)}%)
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            {formatMessage({ id: 'specs.injection.settingsTitle', defaultMessage: 'Injection Control Settings' })}
          </CardTitle>
          <CardDescription>
            {formatMessage({
              id: 'specs.injection.settingsDescription',
              defaultMessage: 'Configure how spec content is injected into AI context.',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {settingsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Max Injection Length */}
              <div className="space-y-2">
                <Label htmlFor="maxLength">
                  {formatMessage({ id: 'specs.injection.maxLength', defaultMessage: 'Max Injection Length (characters)' })}
                </Label>
                <Input
                  id="maxLength"
                  type="number"
                  min={1000}
                  max={50000}
                  step={500}
                  value={formData.maxLength}
                  onChange={(e) => handleFieldChange('maxLength', Number(e.target.value))}
                />
                <p className="text-sm text-muted-foreground">
                  {formatMessage({
                    id: 'specs.injection.maxLengthHelp',
                    defaultMessage: 'Recommended: 4000-10000. Too large may consume too much context; too small may truncate important specs.',
                  })}
                </p>
              </div>

              {/* Warning Threshold */}
              <div className="space-y-2">
                <Label htmlFor="warnThreshold">
                  {formatMessage({ id: 'specs.injection.warnThresholdLabel', defaultMessage: 'Warning Threshold (characters)' })}
                </Label>
                <Input
                  id="warnThreshold"
                  type="number"
                  min={500}
                  max={formData.maxLength - 1}
                  step={500}
                  value={formData.warnThreshold}
                  onChange={(e) => handleFieldChange('warnThreshold', Number(e.target.value))}
                />
                <p className="text-sm text-muted-foreground">
                  {formatMessage({
                    id: 'specs.injection.warnThresholdHelp',
                    defaultMessage: 'A warning will be displayed when injection length exceeds this value.',
                  })}
                </p>
              </div>

              {/* Truncate on Exceed */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="truncate">
                    {formatMessage({ id: 'specs.injection.truncateOnExceed', defaultMessage: 'Truncate on Exceed' })}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {formatMessage({
                      id: 'specs.injection.truncateHelp',
                      defaultMessage: 'Automatically truncate content when it exceeds the maximum length.',
                    })}
                  </p>
                </div>
                <Switch
                  id="truncate"
                  checked={formData.truncateOnExceed}
                  onCheckedChange={(checked) => handleFieldChange('truncateOnExceed', checked)}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={!hasChanges || isSaving}
                >
                  {formatMessage({ id: 'common.actions.reset', defaultMessage: 'Reset' })}
                </Button>
                <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {formatMessage({ id: 'common.actions.saving', defaultMessage: 'Saving...' })}
                    </>
                  ) : (
                    formatMessage({ id: 'common.actions.save', defaultMessage: 'Save' })
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default InjectionControlTab;
