// ========================================
// Inline Template Panel Component
// ========================================
// Compact template list for the left sidebar, uses useTemplates hook

import { useState, useCallback, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { Search, Loader2, FileText, Download, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useTemplates, useInstallTemplate } from '@/hooks/useTemplates';
import { useFlowStore } from '@/stores';
import type { FlowTemplate } from '@/types/execution';

// ========== Sub-Components ==========

interface TemplateItemProps {
  template: FlowTemplate;
  onInstall: (template: FlowTemplate) => void;
  isInstalling: boolean;
}

function TemplateItem({ template, onInstall, isInstalling }: TemplateItemProps) {
  const { formatMessage } = useIntl();

  return (
    <button
      onClick={() => onInstall(template)}
      disabled={isInstalling}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors',
        'hover:bg-muted/60 active:bg-muted',
        isInstalling && 'opacity-50 cursor-wait'
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">
          {template.name}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <GitBranch className="w-3 h-3" />
            {template.nodeCount} {formatMessage({ id: 'orchestrator.inlineTemplates.nodes' })}
          </span>
          {template.category && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {template.category}
            </Badge>
          )}
        </div>
      </div>
      {isInstalling ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
      ) : (
        <Download className="w-4 h-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100" />
      )}
    </button>
  );
}

// ========== Main Component ==========

interface InlineTemplatePanelProps {
  className?: string;
}

/**
 * Compact template browser for the left sidebar.
 * Loads templates via the useTemplates API hook and displays them in a searchable list.
 * Clicking a template installs it as the current flow.
 */
export function InlineTemplatePanel({ className }: InlineTemplatePanelProps) {
  const { formatMessage } = useIntl();
  const [searchQuery, setSearchQuery] = useState('');
  const [installingId, setInstallingId] = useState<string | null>(null);

  const setCurrentFlow = useFlowStore((state) => state.setCurrentFlow);

  const { data, isLoading, error } = useTemplates();
  const installTemplate = useInstallTemplate();

  // Filter templates by search query
  const filteredTemplates = useMemo(() => {
    if (!data?.templates) return [];
    if (!searchQuery.trim()) return data.templates;

    const query = searchQuery.toLowerCase();
    return data.templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.category?.toLowerCase().includes(query) ||
        t.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  }, [data?.templates, searchQuery]);

  // Handle install - load template as current flow
  const handleInstall = useCallback(
    async (template: FlowTemplate) => {
      setInstallingId(template.id);
      try {
        const result = await installTemplate.mutateAsync({
          templateId: template.id,
        });
        setCurrentFlow(result.flow);
      } catch (err) {
        console.error('Failed to install template:', err);
      } finally {
        setInstallingId(null);
      }
    },
    [installTemplate, setCurrentFlow]
  );

  return (
    <div className={cn('flex-1 flex flex-col overflow-hidden', className)}>
      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={formatMessage({ id: 'orchestrator.inlineTemplates.searchPlaceholder' })}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Template List */}
      <div className="flex-1 overflow-y-auto px-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground px-4">
            <FileText className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-xs text-center">
              {formatMessage({ id: 'orchestrator.inlineTemplates.loadFailed' })}
            </p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground px-4">
            <FileText className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-xs text-center">
              {searchQuery ? formatMessage({ id: 'orchestrator.inlineTemplates.noMatches' }) : formatMessage({ id: 'orchestrator.inlineTemplates.noTemplates' })}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredTemplates.map((template) => (
              <TemplateItem
                key={template.id}
                template={template}
                onInstall={handleInstall}
                isInstalling={installingId === template.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default InlineTemplatePanel;
