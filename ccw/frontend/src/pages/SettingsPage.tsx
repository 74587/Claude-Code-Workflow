// ========================================
// Settings Page
// ========================================
// Application settings and configuration with CLI tools management

import { useState } from 'react';
import { useIntl } from 'react-intl';
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
  Languages,
  GitFork,
  Scale,
  Search,
  Power,
  PowerOff,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useTheme } from '@/hooks';
import { useHooks, useRules, useToggleHook, useToggleRule } from '@/hooks';
import { useConfigStore, selectCliTools, selectDefaultCliTool, selectUserPreferences } from '@/stores/configStore';
import type { CliToolConfig, UserPreferences } from '@/types/store';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';

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
  const { formatMessage } = useIntl();

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
                  <Badge variant="default" className="text-xs">{formatMessage({ id: 'settings.cliTools.default' })}</Badge>
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
                  {formatMessage({ id: 'settings.cliTools.enabled' })}
                </>
              ) : (
                <>
                  <X className="w-4 h-4 mr-1" />
                  {formatMessage({ id: 'settings.cliTools.disabled' })}
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
              <label className="text-sm font-medium text-foreground">{formatMessage({ id: 'settings.cliTools.primaryModel' })}</label>
              <Input
                value={config.primaryModel}
                onChange={(e) => onUpdateModel('primaryModel', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">{formatMessage({ id: 'settings.cliTools.secondaryModel' })}</label>
              <Input
                value={config.secondaryModel}
                onChange={(e) => onUpdateModel('secondaryModel', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          {!isDefault && config.enabled && (
            <Button variant="outline" size="sm" onClick={onSetDefault}>
              {formatMessage({ id: 'settings.cliTools.setDefault' })}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

// ========== Hooks Section Component ==========

function HooksSection() {
  const { formatMessage } = useIntl();
  const [searchQuery, setSearchQuery] = useState('');
  
  const { hooks, enabledCount, totalCount, isLoading } = useHooks();
  const { toggleHook, isToggling } = useToggleHook();

  const filteredHooks = hooks.filter(h =>
    h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (h.description && h.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <GitFork className="w-5 h-5" />
          {formatMessage({ id: 'settings.sections.hooks' })}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {enabledCount}/{totalCount} {formatMessage({ id: 'cliHooks.stats.enabled' })}
          </span>
        </div>
      </div>
      
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={formatMessage({ id: 'cliHooks.filters.searchPlaceholder' })}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredHooks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <GitFork className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>{formatMessage({ id: 'cliHooks.emptyState.title' })}</p>
          </div>
        ) : (
          filteredHooks.map((hook) => (
            <div
              key={hook.name}
              className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-2 rounded-lg',
                  hook.enabled ? 'bg-primary/10' : 'bg-muted'
                )}>
                  <GitFork className={cn(
                    'w-4 h-4',
                    hook.enabled ? 'text-primary' : 'text-muted-foreground'
                  )} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{hook.name}</p>
                  {hook.description && (
                    <p className="text-xs text-muted-foreground">{hook.description}</p>
                  )}
                  <Badge variant="outline" className="text-xs mt-1">
                    {formatMessage({ id: `cliHooks.trigger.${hook.trigger}` })}
                  </Badge>
                </div>
              </div>
              <Button
                variant={hook.enabled ? 'default' : 'outline'}
                size="sm"
                className="h-8"
                onClick={() => toggleHook(hook.name, !hook.enabled)}
                disabled={isToggling}
              >
                {hook.enabled ? (
                  <><Power className="w-4 h-4 mr-1" />{formatMessage({ id: 'settings.cliTools.enabled' })}</>
                ) : (
                  <><PowerOff className="w-4 h-4 mr-1" />{formatMessage({ id: 'settings.cliTools.disabled' })}</>
                )}
              </Button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

// ========== Rules Section Component ==========

function RulesSection() {
  const { formatMessage } = useIntl();
  const [searchQuery, setSearchQuery] = useState('');
  
  const { rules, enabledCount, totalCount, isLoading } = useRules();
  const { toggleRule, isToggling } = useToggleRule();

  const filteredRules = rules.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Scale className="w-5 h-5" />
          {formatMessage({ id: 'settings.sections.rules' })}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {enabledCount}/{totalCount} {formatMessage({ id: 'cliRules.stats.enabled' })}
          </span>
        </div>
      </div>
      
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={formatMessage({ id: 'cliRules.filters.searchPlaceholder' })}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Scale className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>{formatMessage({ id: 'cliRules.emptyState.title' })}</p>
          </div>
        ) : (
          filteredRules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-2 rounded-lg',
                  rule.enabled ? 'bg-primary/10' : 'bg-muted'
                )}>
                  <Scale className={cn(
                    'w-4 h-4',
                    rule.enabled ? 'text-primary' : 'text-muted-foreground'
                  )} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{rule.name}</p>
                  {rule.description && (
                    <p className="text-xs text-muted-foreground">{rule.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {rule.category && (
                      <Badge variant="secondary" className="text-xs">{rule.category}</Badge>
                    )}
                    {rule.severity && (
                      <Badge 
                        variant={rule.severity === 'error' ? 'destructive' : 'outline'} 
                        className="text-xs"
                      >
                        {formatMessage({ id: `cliRules.severity.${rule.severity}` })}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant={rule.enabled ? 'default' : 'outline'}
                size="sm"
                className="h-8"
                onClick={() => toggleRule(rule.id, !rule.enabled)}
                disabled={isToggling}
              >
                {rule.enabled ? (
                  <><Power className="w-4 h-4 mr-1" />{formatMessage({ id: 'settings.cliTools.enabled' })}</>
                ) : (
                  <><PowerOff className="w-4 h-4 mr-1" />{formatMessage({ id: 'settings.cliTools.disabled' })}</>
                )}
              </Button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

// ========== Main Page Component ==========

export function SettingsPage() {
  const { formatMessage } = useIntl();
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
          {formatMessage({ id: 'settings.title' })}
        </h1>
        <p className="text-muted-foreground mt-1">
          {formatMessage({ id: 'settings.description' })}
        </p>
      </div>

      {/* Appearance Settings */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <Moon className="w-5 h-5" />
          {formatMessage({ id: 'settings.sections.appearance' })}
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{formatMessage({ id: 'settings.appearance.theme' })}</p>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'settings.appearance.description' })}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('light')}
              >
                <Sun className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'settings.appearance.themeOptions.light' })}
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('dark')}
              >
                <Moon className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'settings.appearance.themeOptions.dark' })}
              </Button>
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('system')}
              >
                {formatMessage({ id: 'settings.appearance.themeOptions.system' })}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Language Settings */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <Languages className="w-5 h-5" />
          {formatMessage({ id: 'settings.sections.language' })}
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{formatMessage({ id: 'settings.language.displayLanguage' })}</p>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'settings.language.chooseLanguage' })}
              </p>
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      </Card>

      {/* CLI Tools Configuration */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <Cpu className="w-5 h-5" />
          {formatMessage({ id: 'settings.sections.cliTools' })}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {formatMessage({ id: 'settings.cliTools.description' })} <strong className="text-foreground">{defaultCliTool}</strong>
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
          {formatMessage({ id: 'settings.dataRefresh.title' })}
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{formatMessage({ id: 'settings.dataRefresh.autoRefresh' })}</p>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'settings.dataRefresh.autoRefreshDesc' })}
              </p>
            </div>
            <Button
              variant={userPreferences.autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePreferenceChange('autoRefresh', !userPreferences.autoRefresh)}
            >
              {userPreferences.autoRefresh ? formatMessage({ id: 'settings.dataRefresh.enabled' }) : formatMessage({ id: 'settings.dataRefresh.disabled' })}
            </Button>
          </div>

          {userPreferences.autoRefresh && (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{formatMessage({ id: 'settings.dataRefresh.refreshInterval' })}</p>
                <p className="text-sm text-muted-foreground">
                  {formatMessage({ id: 'settings.dataRefresh.refreshIntervalDesc' })}
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
          {formatMessage({ id: 'settings.notifications.title' })}
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{formatMessage({ id: 'settings.notifications.enableNotifications' })}</p>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'settings.notifications.enableNotificationsDesc' })}
              </p>
            </div>
            <Button
              variant={userPreferences.notificationsEnabled ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePreferenceChange('notificationsEnabled', !userPreferences.notificationsEnabled)}
            >
              {userPreferences.notificationsEnabled ? formatMessage({ id: 'settings.dataRefresh.enabled' }) : formatMessage({ id: 'settings.dataRefresh.disabled' })}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{formatMessage({ id: 'settings.notifications.soundEffects' })}</p>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'settings.notifications.soundEffectsDesc' })}
              </p>
            </div>
            <Button
              variant={userPreferences.soundEnabled ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePreferenceChange('soundEnabled', !userPreferences.soundEnabled)}
            >
              {userPreferences.soundEnabled ? formatMessage({ id: 'settings.notifications.on' }) : formatMessage({ id: 'settings.notifications.off' })}
            </Button>
          </div>
        </div>
      </Card>

      {/* Display Settings */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5" />
          {formatMessage({ id: 'settings.sections.display' })}
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{formatMessage({ id: 'settings.display.showCompletedTasks' })}</p>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'settings.display.showCompletedTasksDesc' })}
              </p>
            </div>
            <Button
              variant={userPreferences.showCompletedTasks ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePreferenceChange('showCompletedTasks', !userPreferences.showCompletedTasks)}
            >
              {userPreferences.showCompletedTasks ? formatMessage({ id: 'settings.display.show' }) : formatMessage({ id: 'settings.display.hide' })}
            </Button>
          </div>
        </div>
      </Card>

      {/* Git Hooks */}
      <HooksSection />

      {/* Rules */}
      <RulesSection />

      {/* Reset Settings */}
      <Card className="p-6 border-destructive/50">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <RotateCcw className="w-5 h-5" />
          {formatMessage({ id: 'common.actions.reset' })}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {formatMessage({ id: 'settings.reset.description' })}
        </p>
        <Button
          variant="destructive"
          onClick={() => {
            if (confirm(formatMessage({ id: 'settings.reset.confirm' }))) {
              resetUserPreferences();
            }
          }}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          {formatMessage({ id: 'common.actions.resetToDefaults' })}
        </Button>
      </Card>
    </div>
  );
}

export default SettingsPage;
