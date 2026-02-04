// ========================================
// Settings Page
// ========================================
// Application settings and configuration with CLI tools management

import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  Settings,
  Moon,
  Bell,
  Cpu,
  RefreshCw,
  RotateCcw,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Languages,
  Plus,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ThemeSelector } from '@/components/shared/ThemeSelector';
import { useTheme } from '@/hooks';
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
  onUpdateTags: (tags: string[]) => void;
  onUpdateAvailableModels: (models: string[]) => void;
  onUpdateSettingsFile: (settingsFile: string | undefined) => void;
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
  onUpdateTags,
  onUpdateAvailableModels,
  onUpdateSettingsFile,
}: CliToolCardProps) {
  const { formatMessage } = useIntl();

  // Local state for tag and model input
  const [tagInput, setTagInput] = useState('');
  const [modelInput, setModelInput] = useState('');

  // Handler for adding tags
  const handleAddTag = () => {
    const newTag = tagInput.trim();
    if (newTag && !config.tags.includes(newTag)) {
      onUpdateTags([...config.tags, newTag]);
      setTagInput('');
    }
  };

  // Handler for removing tags
  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateTags(config.tags.filter((t) => t !== tagToRemove));
  };

  // Handler for adding available models
  const handleAddModel = () => {
    const newModel = modelInput.trim();
    const currentModels = config.availableModels || [];
    if (newModel && !currentModels.includes(newModel)) {
      onUpdateAvailableModels([...currentModels, newModel]);
      setModelInput('');
    }
  };

  // Handler for removing available models
  const handleRemoveModel = (modelToRemove: string) => {
    const currentModels = config.availableModels || [];
    onUpdateAvailableModels(currentModels.filter((m) => m !== modelToRemove));
  };

  // Predefined tags
  const predefinedTags = ['分析', 'Debug', 'implementation', 'refactoring', 'testing'];

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

          {/* Tags Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'apiSettings.cliSettings.tags' })}
            </label>
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'apiSettings.cliSettings.tagsDescription' })}
            </p>
            <div className="flex gap-2">
              <div className="flex-1 flex flex-wrap gap-1.5 p-2 border border-input bg-background rounded-md min-h-[38px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                {config.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs h-6"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-destructive transition-colors"
                      aria-label={formatMessage({ id: 'apiSettings.cliSettings.removeTag' })}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder={config.tags.length === 0 ? formatMessage({ id: 'apiSettings.cliSettings.tagInputPlaceholder' }) : ''}
                  className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground"
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleAddTag}
                variant="outline"
                className="shrink-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {/* Predefined Tags */}
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-muted-foreground">
                {formatMessage({ id: 'apiSettings.cliSettings.predefinedTags' })}:
              </span>
              {predefinedTags.map((predefinedTag) => (
                <button
                  key={predefinedTag}
                  type="button"
                  onClick={() => {
                    if (!config.tags.includes(predefinedTag)) {
                      onUpdateTags([...config.tags, predefinedTag]);
                    }
                  }}
                  disabled={config.tags.includes(predefinedTag)}
                  className="text-xs px-2 py-0.5 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {predefinedTag}
                </button>
              ))}
            </div>
          </div>

          {/* Available Models Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'apiSettings.cliSettings.availableModels' })}
            </label>
            <div className="flex gap-2">
              <div className="flex-1 flex flex-wrap gap-1.5 p-2 border border-input bg-background rounded-md min-h-[38px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                {(config.availableModels || []).map((model) => (
                  <span
                    key={model}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs h-6"
                  >
                    {model}
                    <button
                      type="button"
                      onClick={() => handleRemoveModel(model)}
                      className="hover:text-destructive transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddModel();
                    }
                  }}
                  placeholder={(config.availableModels || []).length === 0 ? formatMessage({ id: 'apiSettings.cliSettings.availableModelsPlaceholder' }) : ''}
                  className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground"
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleAddModel}
                variant="outline"
                className="shrink-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'apiSettings.cliSettings.availableModelsHint' })}
            </p>
          </div>

          {/* Settings File */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'apiSettings.cliSettings.settingsFile' })}
            </label>
            <Input
              value={config.settingsFile || ''}
              onChange={(e) => onUpdateSettingsFile(e.target.value || undefined)}
              placeholder={formatMessage({ id: 'apiSettings.cliSettings.settingsFilePlaceholder' })}
            />
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'apiSettings.cliSettings.settingsFileHint' })}
            </p>
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

  const handleUpdateTags = (toolId: string, tags: string[]) => {
    updateCliTool(toolId, { tags });
  };

  const handleUpdateAvailableModels = (toolId: string, availableModels: string[]) => {
    updateCliTool(toolId, { availableModels });
  };

  const handleUpdateSettingsFile = (toolId: string, settingsFile: string | undefined) => {
    updateCliTool(toolId, { settingsFile });
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
        <div className="space-y-6">
          {/* Multi-Theme Selector */}
          <div>
            <p className="font-medium text-foreground mb-1">
              {formatMessage({ id: 'settings.appearance.theme' })}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {formatMessage({ id: 'settings.appearance.description' })}
            </p>
            <ThemeSelector />
          </div>

          {/* System Theme Toggle (Backward Compatibility) */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div>
              <p className="font-medium text-foreground">{formatMessage({ id: 'settings.appearance.systemFollow' })}</p>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'settings.appearance.systemFollowDesc' })}
              </p>
            </div>
            <Button
              variant={theme === 'system' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTheme('system')}
            >
              {formatMessage({ id: 'settings.appearance.themeOptions.system' })}
            </Button>
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
              onUpdateTags={(tags) => handleUpdateTags(toolId, tags)}
              onUpdateAvailableModels={(models) => handleUpdateAvailableModels(toolId, models)}
              onUpdateSettingsFile={(settingsFile) => handleUpdateSettingsFile(toolId, settingsFile)}
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
      <div className="py-4">
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
      </div>

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
