// ========================================
// GlobalSettingsTab Component
// ========================================
// Global settings for personal spec defaults and spec statistics

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { Settings, RefreshCw } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select';
import { cn } from '@/lib/utils';

// ========== Types ==========

interface PersonalSpecDefaults {
  defaultReadMode: 'required' | 'optional';
  autoEnable: boolean;
}

interface SystemSettings {
  injectionControl: {
    maxLength: number;
    warnThreshold: number;
    truncateOnExceed: boolean;
  };
  personalSpecDefaults: PersonalSpecDefaults;
}

interface SpecDimensionStats {
  count: number;
  requiredCount: number;
}

interface SpecStats {
  dimensions: {
    specs: SpecDimensionStats;
    personal: SpecDimensionStats;
  };
  injectionLength?: {
    requiredOnly: number;
    withKeywords: number;
    maxLength: number;
    percentage: number;
  };
}

// ========== API Functions ==========

const API_BASE = '/api';

async function fetchSystemSettings(): Promise<SystemSettings> {
  const response = await fetch(`${API_BASE}/system/settings`, {
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch settings: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

async function updateSystemSettings(
  settings: Partial<SystemSettings>
): Promise<{ success: boolean; settings: SystemSettings }> {
  const response = await fetch(`${API_BASE}/system/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify(settings),
  });
  if (!response.ok) {
    throw new Error(`Failed to update settings: ${response.statusText}`);
  }
  return response.json();
}

async function fetchSpecStats(): Promise<SpecStats> {
  const response = await fetch(`${API_BASE}/specs/stats`, {
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch spec stats: ${response.statusText}`);
  }
  return response.json();
}

// ========== Query Keys ==========

const settingsKeys = {
  all: ['system-settings'] as const,
  settings: () => [...settingsKeys.all, 'settings'] as const,
  stats: () => [...settingsKeys.all, 'stats'] as const,
};

// ========== Component ==========

export function GlobalSettingsTab() {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();

  // Local state for immediate UI feedback
  const [localDefaults, setLocalDefaults] = useState<PersonalSpecDefaults>({
    defaultReadMode: 'optional',
    autoEnable: true,
  });

  // Fetch system settings
  const {
    data: settings,
    isLoading: isLoadingSettings,
    error: settingsError,
  } = useQuery({
    queryKey: settingsKeys.settings(),
    queryFn: fetchSystemSettings,
    staleTime: 60000, // 1 minute
  });

  // Fetch spec stats
  const {
    data: stats,
    isLoading: isLoadingStats,
    error: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: settingsKeys.stats(),
    queryFn: fetchSpecStats,
    staleTime: 30000, // 30 seconds
  });

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: updateSystemSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKeys.settings(), data.settings);
      toast.success(formatMessage({ id: 'specs.injection.saveSuccess', defaultMessage: 'Settings saved successfully' }));
    },
    onError: (error) => {
      toast.error(formatMessage(
        { id: 'specs.injection.saveError', defaultMessage: 'Failed to save settings: {error}' },
        { error: error.message }
      ));
    },
  });

  // Sync local state with server state
  useEffect(() => {
    if (settings?.personalSpecDefaults) {
      setLocalDefaults(settings.personalSpecDefaults);
    }
  }, [settings]);

  // Handlers
  const handleReadModeChange = (value: 'required' | 'optional') => {
    const newDefaults = { ...localDefaults, defaultReadMode: value };
    setLocalDefaults(newDefaults);
    updateMutation.mutate({ personalSpecDefaults: newDefaults });
  };

  const handleAutoEnableChange = (checked: boolean) => {
    const newDefaults = { ...localDefaults, autoEnable: checked };
    setLocalDefaults(newDefaults);
    updateMutation.mutate({ personalSpecDefaults: newDefaults });
  };

  // Calculate totals - Only include specs and personal dimensions
  const dimensions = stats?.dimensions || {};
  const dimensionEntries = Object.entries(dimensions)
    .filter(([dim]) => dim === 'specs' || dim === 'personal') as [
    keyof typeof dimensions,
    SpecDimensionStats
  ][];
  const totalCount = dimensionEntries.reduce(
    (sum, [, data]) => sum + data.count,
    0
  );
  const totalRequired = dimensionEntries.reduce(
    (sum, [, data]) => sum + data.requiredCount,
    0
  );

  const isLoading = isLoadingSettings || isLoadingStats;
  const hasError = settingsError || statsError;

  return (
    <div className="space-y-6">
      {/* Personal Spec Defaults Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <CardTitle>
              {formatMessage({ id: 'specs.settings.personalSpecDefaults', defaultMessage: 'Personal Spec Defaults' })}
            </CardTitle>
          </div>
          <CardDescription>
            {formatMessage({ id: 'specs.settings.personalSpecDefaultsDesc', defaultMessage: 'These settings will be applied when creating new personal specs' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Default Read Mode */}
          <div className="space-y-2">
            <Label htmlFor="default-read-mode">
              {formatMessage({ id: 'specs.settings.defaultReadMode', defaultMessage: 'Default Read Mode' })}
            </Label>
            <Select
              value={localDefaults.defaultReadMode}
              onValueChange={(value) =>
                handleReadModeChange(value as 'required' | 'optional')
              }
            >
              <SelectTrigger id="default-read-mode" className="w-full">
                <SelectValue placeholder={formatMessage({ id: 'specs.settings.selectReadMode', defaultMessage: 'Select read mode' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="required">
                  {formatMessage({ id: 'specs.readMode.required', defaultMessage: 'Required' })}
                </SelectItem>
                <SelectItem value="optional">
                  {formatMessage({ id: 'specs.readMode.optional', defaultMessage: 'Optional' })}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {formatMessage({ id: 'specs.settings.defaultReadModeHelp', defaultMessage: 'The default read mode for newly created personal specs' })}
            </p>
          </div>

          {/* Auto Enable */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-enable">
                {formatMessage({ id: 'specs.settings.autoEnable', defaultMessage: 'Auto Enable New Specs' })}
              </Label>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'specs.settings.autoEnableDescription', defaultMessage: 'Automatically enable newly created personal specs' })}
              </p>
            </div>
            <Switch
              id="auto-enable"
              checked={localDefaults.autoEnable}
              onCheckedChange={handleAutoEnableChange}
              disabled={updateMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Spec Statistics Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {formatMessage({ id: 'specs.settings.specStatistics', defaultMessage: 'Spec Statistics' })}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchStats()}
              disabled={isLoadingStats}
            >
              <RefreshCw
                className={cn(
                  'h-4 w-4',
                  isLoadingStats && 'animate-spin'
                )}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="text-center p-4 rounded-lg bg-muted animate-pulse"
                >
                  <div className="h-8 w-12 mx-auto bg-muted-foreground/20 rounded mb-2" />
                  <div className="h-4 w-16 mx-auto bg-muted-foreground/20 rounded" />
                </div>
              ))}
            </div>
          ) : hasError ? (
            <div className="text-center py-8 text-muted-foreground">
              {formatMessage({ id: 'specs.injection.loadError', defaultMessage: 'Failed to load statistics' })}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                {dimensionEntries
                  .filter(([entry]) => entry[0] === 'specs' || entry[1] === 'personal')
                  .map(([dim, data]) => (
                  <div
                    key={dim}
                    className="text-center p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="text-2xl font-bold text-foreground">
                      {data.count}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatMessage({ id: `specs.dimension.${dim}`, defaultMessage: dim })}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {data.requiredCount} {formatMessage({ id: 'specs.required', defaultMessage: 'required' })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    {formatMessage(
                      { id: 'specs.settings.totalSpecs', defaultMessage: 'Total: {count} spec files' },
                      { count: totalCount }
                    )}
                  </span>
                  <span>
                    {totalRequired} {formatMessage({ id: 'specs.readMode.required', defaultMessage: 'required' })} | {totalCount - totalRequired}{' '}
                    {formatMessage({ id: 'specs.readMode.optional', defaultMessage: 'optional' })}
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default GlobalSettingsTab;
