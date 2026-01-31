// ========================================
// Hook Quick Templates Component
// ========================================
// Predefined hook templates for quick installation

import { useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Bell,
  Database,
  Wrench,
  Check,
  Zap,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

// ========== Types ==========

/**
 * Template category type
 */
export type TemplateCategory = 'notification' | 'indexing' | 'automation';

/**
 * Hook template definition
 */
export interface HookTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  trigger: 'UserPromptSubmit' | 'PreToolUse' | 'PostToolUse' | 'Stop';
  command: string;
  args?: string[];
  matcher?: string;
}

/**
 * Component props
 */
export interface HookQuickTemplatesProps {
  /** Callback when install button is clicked */
  onInstallTemplate: (templateId: string) => Promise<void>;
  /** Array of installed template IDs */
  installedTemplates: string[];
  /** Optional loading state */
  isLoading?: boolean;
}

// ========== Hook Templates ==========

/**
 * Predefined hook templates for quick installation
 */
export const HOOK_TEMPLATES: readonly HookTemplate[] = [
  {
    id: 'ccw-notify',
    name: 'CCW Dashboard Notify',
    description: 'Send notifications to CCW dashboard when files are written',
    category: 'notification',
    trigger: 'PostToolUse',
    matcher: 'Write',
    command: 'bash',
    args: [
      '-c',
      'INPUT=$(cat); FILE_PATH=$(echo "$INPUT" | jq -r ".tool_input.file_path // .tool_input.path // empty"); [ -n "$FILE_PATH" ] && curl -s -X POST -H "Content-Type: application/json" -d "{\\"type\\":\\"file_written\\",\\"filePath\\":\\"$FILE_PATH\\"}" http://localhost:3456/api/hook || true'
    ]
  },
  {
    id: 'codexlens-update',
    name: 'CodexLens Auto-Update',
    description: 'Update CodexLens index when files are written or edited',
    category: 'indexing',
    trigger: 'Stop',
    command: 'bash',
    args: [
      '-c',
      'INPUT=$(cat); FILE=$(echo "$INPUT" | jq -r ".tool_input.file_path // .tool_input.path // empty"); [ -d ".codexlens" ] && [ -n "$FILE" ] && (python -m codexlens update "$FILE" --json 2>/dev/null || ~/.codexlens/venv/bin/python -m codexlens update "$FILE" --json 2>/dev/null || true)'
    ]
  },
  {
    id: 'git-add',
    name: 'Auto Git Stage',
    description: 'Automatically stage written files to git',
    category: 'automation',
    trigger: 'PostToolUse',
    matcher: 'Write',
    command: 'bash',
    args: [
      '-c',
      'INPUT=$(cat); FILE=$(echo "$INPUT" | jq -r ".tool_input.file_path // empty"); [ -n "$FILE" ] && git add "$FILE" 2>/dev/null || true'
    ]
  },
  {
    id: 'lint-check',
    name: 'Auto ESLint',
    description: 'Run ESLint on JavaScript/TypeScript files after write',
    category: 'automation',
    trigger: 'PostToolUse',
    matcher: 'Write',
    command: 'bash',
    args: [
      '-c',
      'INPUT=$(cat); FILE=$(echo "$INPUT" | jq -r ".tool_input.file_path // empty"); if [[ "$FILE" =~ \\.(js|ts|jsx|tsx)$ ]]; then npx eslint "$FILE" --fix 2>/dev/null || true; fi'
    ]
  },
  {
    id: 'log-tool',
    name: 'Tool Usage Logger',
    description: 'Log all tool executions to a file for audit trail',
    category: 'automation',
    trigger: 'PostToolUse',
    command: 'bash',
    args: [
      '-c',
      'mkdir -p "$HOME/.claude"; INPUT=$(cat); TOOL=$(echo "$INPUT" | jq -r ".tool_name // empty" 2>/dev/null); FILE=$(echo "$INPUT" | jq -r ".tool_input.file_path // .tool_input.path // empty" 2>/dev/null); echo "[$(date)] Tool: $TOOL, File: $FILE" >> "$HOME/.claude/tool-usage.log"'
    ]
  }
] as const;

// ========== Category Icons ==========

const CATEGORY_ICONS: Record<TemplateCategory, { icon: typeof Bell; color: string }> = {
  notification: { icon: Bell, color: 'text-blue-500' },
  indexing: { icon: Database, color: 'text-purple-500' },
  automation: { icon: Wrench, color: 'text-orange-500' }
};

// ========== Category Names ==========

function getCategoryName(category: TemplateCategory, formatMessage: ReturnType<typeof useIntl>['formatMessage']): string {
  const names: Record<TemplateCategory, string> = {
    notification: formatMessage({ id: 'cliHooks.templates.categories.notification' }),
    indexing: formatMessage({ id: 'cliHooks.templates.categories.indexing' }),
    automation: formatMessage({ id: 'cliHooks.templates.categories.automation' })
  };
  return names[category];
}

// ========== Main Component ==========

/**
 * HookQuickTemplates - Display predefined hook templates for quick installation
 */
export function HookQuickTemplates({
  onInstallTemplate,
  installedTemplates,
  isLoading = false
}: HookQuickTemplatesProps) {
  const { formatMessage } = useIntl();

  // Group templates by category
  const templatesByCategory = useMemo(() => {
    return HOOK_TEMPLATES.reduce((acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    }, {} as Record<TemplateCategory, HookTemplate[]>);
  }, []);

  // Define category order
  const categoryOrder: TemplateCategory[] = ['notification', 'indexing', 'automation'];

  const handleInstall = async (templateId: string) => {
    await onInstallTemplate(templateId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Zap className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {formatMessage({ id: 'cliHooks.templates.title' })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {formatMessage({ id: 'cliHooks.templates.description' })}
          </p>
        </div>
      </div>

      {/* Categories */}
      {categoryOrder.map((category) => {
        const templates = templatesByCategory[category];
        if (!templates || templates.length === 0) return null;

        const { icon: CategoryIcon, color } = CATEGORY_ICONS[category];

        return (
          <div key={category} className="space-y-3">
            {/* Category Header */}
            <div className="flex items-center gap-2">
              <CategoryIcon className={cn('w-4 h-4', color)} />
              <h3 className="text-sm font-medium text-foreground">
                {getCategoryName(category, formatMessage)}
              </h3>
              <Badge variant="outline" className="text-xs">
                {templates.length}
              </Badge>
            </div>

            {/* Template Cards */}
            <div className="grid grid-cols-1 gap-3">
              {templates.map((template) => {
                const isInstalled = installedTemplates.includes(template.id);
                const isInstalling = isLoading && !isInstalled;

                return (
                  <Card key={template.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      {/* Template Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-medium text-foreground">
                            {formatMessage({ id: `cliHooks.templates.templates.${template.id}.name` })}
                          </h4>
                          <Badge variant="secondary" className="text-xs">
                            {formatMessage({ id: `cliHooks.trigger.${template.trigger}` })}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatMessage({ id: `cliHooks.templates.templates.${template.id}.description` })}
                        </p>
                        {template.matcher && (
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-mono bg-muted px-1 rounded">
                              {template.matcher}
                            </span>
                          </p>
                        )}
                      </div>

                      {/* Install Button */}
                      <Button
                        size="sm"
                        variant={isInstalled ? 'outline' : 'default'}
                        disabled={isInstalled || isInstalling}
                        onClick={() => handleInstall(template.id)}
                        className="shrink-0"
                      >
                        {isInstalled ? (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            {formatMessage({ id: 'cliHooks.templates.actions.installed' })}
                          </>
                        ) : (
                          formatMessage({ id: 'cliHooks.templates.actions.install' })
                        )}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default HookQuickTemplates;
