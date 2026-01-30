// ========================================
// Settings Page
// ========================================
// Application settings and configuration with CLI tools management

import { useState } from 'react';
import {
  Settings,
  Moon,
  Sun,
  Bell,
  Cpu,
  RefreshCw,
  RotateCcw,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useTheme } from '@/hooks';
import { useConfigStore, selectCliTools, selectDefaultCliTool, selectUserPreferences } from '@/stores/configStore';
import type { CliToolConfig, UserPreferences } from '@/types/store';
import { cn } from '@/lib/utils';

// ========== CLI Tool Card Component ==========

interface CliToolCardProps {
  toolId: string;
  config: CliToolConfig;
  isDefault: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onSetDefault: () => void;
  onUpdateModel: (field: 'primaryModel' | 'secondaryModel', value: string) => void;
}

function CliToolCard({
  toolId,
  config,
  isDefault,
  isExpanded,
  onToggleExpand,
  onToggleEnabled,
  onSetDefault,
  onUpdateModel,
}: CliToolCardProps) {
  return (
    <Card className={cn('overflow-hidden', !config.enabled && 'opacity-60')}>
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              config.enabled ? 'bg-primary/10' : 'bg-muted'
            )}>
              <Cpu className={cn(
                'w-5 h-5',
                config.enabled ? 'text-primary' : 'text-muted-foreground'
              )} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground capitalize">
                  {toolId}
                </span>
                {isDefault && (
                  <Badge variant="default" className="text-xs">Default</Badge>
                )}
                <Badge variant="outline" className="text-xs">{config.type}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {config.primaryModel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={config.enabled ? 'default' : 'outline'}
              size="sm"
              className="h-8"
              onClick={(e) => {
                e.stopPropagation();
                onToggleEnabled();
              }}
            >
              {config.enabled ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Enabled
                </>
              ) : (
                <>
                  <X className="w-4 h-4 mr-1" />
                  Disabled
                </>
              )}
            </Button>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Tags */}
        {config.tags && config.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {config.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-4 bg-muted/30">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground">Primary Model</label>
              <Input
                value={config.primaryModel}
                onChange={(e) => onUpdateModel('primaryModel', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Secondary Model</label>
              <Input
                value={config.secondaryModel}
                onChange={(e) => onUpdateModel('secondaryModel', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          {!isDefault && config.enabled && (
            <Button variant="outline" size="sm" onClick={onSetDefault}>
              Set as Default
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

// ========== Main Page Component ==========

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const cliTools = useConfigStore(selectCliTools);
  const defaultCliTool = useConfigStore(selectDefaultCliTool);
  const userPreferences = useConfigStore(selectUserPreferences);
  const { updateCliTool, setDefaultCliTool, setUserPreferences, resetUserPreferences } = useConfigStore();

  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  const toggleToolExpand = (toolId: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  const handleToggleToolEnabled = (toolId: string) => {
    updateCliTool(toolId, { enabled: !cliTools[toolId].enabled });
  };

  const handleSetDefaultTool = (toolId: string) => {
    setDefaultCliTool(toolId);
  };

  const handleUpdateModel = (toolId: string, field: 'primaryModel' | 'secondaryModel', value: string) => {
    updateCliTool(toolId, { [field]: value });
  };

  const handlePreferenceChange = (key: keyof UserPreferences, value: unknown) => {
    setUserPreferences({ [key]: value });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure your dashboard preferences and CLI tools
        </p>
      </div>

      {/* Appearance Settings */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <Moon className="w-5 h-5" />
          Appearance
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Theme</p>
              <p className="text-sm text-muted-foreground">
                Choose your preferred color theme
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('light')}
              >
                <Sun className="w-4 h-4 mr-2" />
                Light
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('dark')}
              >
                <Moon className="w-4 h-4 mr-2" />
                Dark
              </Button>
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('system')}
              >
                System
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Compact View</p>
              <p className="text-sm text-muted-foreground">
                Use a more compact layout for lists
              </p>
            </div>
            <Button
              variant={userPreferences.compactView ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePreferenceChange('compactView', !userPreferences.compactView)}
            >
              {userPreferences.compactView ? 'On' : 'Off'}
            </Button>
          </div>
        </div>
      </Card>

      {/* CLI Tools Configuration */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <Cpu className="w-5 h-5" />
          CLI Tools
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Configure available CLI tools and their models. Default tool: <strong className="text-foreground">{defaultCliTool}</strong>
        </p>
        <div className="space-y-3">
          {Object.entries(cliTools).map(([toolId, config]) => (
            <CliToolCard
              key={toolId}
              toolId={toolId}
              config={config}
              isDefault={toolId === defaultCliTool}
              isExpanded={expandedTools.has(toolId)}
              onToggleExpand={() => toggleToolExpand(toolId)}
              onToggleEnabled={() => handleToggleToolEnabled(toolId)}
              onSetDefault={() => handleSetDefaultTool(toolId)}
              onUpdateModel={(field, value) => handleUpdateModel(toolId, field, value)}
            />
          ))}
        </div>
      </Card>

      {/* Data Refresh Settings */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <RefreshCw className="w-5 h-5" />
          Data Refresh
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Auto Refresh</p>
              <p className="text-sm text-muted-foreground">
                Automatically refresh data periodically
              </p>
            </div>
            <Button
              variant={userPreferences.autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePreferenceChange('autoRefresh', !userPreferences.autoRefresh)}
            >
              {userPreferences.autoRefresh ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          {userPreferences.autoRefresh && (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Refresh Interval</p>
                <p className="text-sm text-muted-foreground">
                  How often to refresh data
                </p>
              </div>
              <div className="flex gap-2">
                {[15000, 30000, 60000, 120000].map((interval) => (
                  <Button
                    key={interval}
                    variant={userPreferences.refreshInterval === interval ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePreferenceChange('refreshInterval', interval)}
                  >
                    {interval / 1000}s
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5" />
          Notifications
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Enable Notifications</p>
              <p className="text-sm text-muted-foreground">
                Show notifications for workflow events
              </p>
            </div>
            <Button
              variant={userPreferences.notificationsEnabled ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePreferenceChange('notificationsEnabled', !userPreferences.notificationsEnabled)}
            >
              {userPreferences.notificationsEnabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Sound Effects</p>
              <p className="text-sm text-muted-foreground">
                Play sound for notifications
              </p>
            </div>
            <Button
              variant={userPreferences.soundEnabled ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePreferenceChange('soundEnabled', !userPreferences.soundEnabled)}
            >
              {userPreferences.soundEnabled ? 'On' : 'Off'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Display Settings */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5" />
          Display Settings
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Show Completed Tasks</p>
              <p className="text-sm text-muted-foreground">
                Display completed tasks in task lists
              </p>
            </div>
            <Button
              variant={userPreferences.showCompletedTasks ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePreferenceChange('showCompletedTasks', !userPreferences.showCompletedTasks)}
            >
              {userPreferences.showCompletedTasks ? 'Show' : 'Hide'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Reset Settings */}
      <Card className="p-6 border-destructive/50">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <RotateCcw className="w-5 h-5" />
          Reset Settings
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Reset all user preferences to their default values. This cannot be undone.
        </p>
        <Button
          variant="destructive"
          onClick={() => {
            if (confirm('Reset all settings to defaults?')) {
              resetUserPreferences();
            }
          }}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset to Defaults
        </Button>
      </Card>
    </div>
  );
}

export default SettingsPage;
