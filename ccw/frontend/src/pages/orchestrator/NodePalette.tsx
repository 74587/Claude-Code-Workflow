// ========================================
// Node Palette Component
// ========================================
// Draggable node palette with quick templates for creating nodes

import { DragEvent, useState } from 'react';
import { useIntl } from 'react-intl';
import {
  MessageSquare, ChevronDown, ChevronRight, GripVertical,
  Search, Code, FileOutput, GitBranch, GitFork, GitMerge, Plus, Terminal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useFlowStore } from '@/stores';
import { NODE_TYPE_CONFIGS, QUICK_TEMPLATES } from '@/types/flow';

interface NodePaletteProps {
  className?: string;
}

/**
 * Icon mapping for quick templates
 */
const TEMPLATE_ICONS: Record<string, React.ElementType> = {
  'slash-command-main': Terminal,
  'slash-command-async': Terminal,
  analysis: Search,
  implementation: Code,
  'file-operation': FileOutput,
  conditional: GitBranch,
  parallel: GitFork,
  merge: GitMerge,
};

/**
 * Draggable card for a quick template
 */
function QuickTemplateCard({
  template,
}: {
  template: typeof QUICK_TEMPLATES[number];
}) {
  const Icon = TEMPLATE_ICONS[template.id] || MessageSquare;

  // Handle drag start - store template ID
  const onDragStart = (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('application/reactflow-node-type', 'prompt-template');
    event.dataTransfer.setData('application/reactflow-template-id', template.id);
    event.dataTransfer.effectAllowed = 'move';
  };

  // Handle double-click to add node at default position
  const onDoubleClick = () => {
    const position = { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 };
    useFlowStore.getState().addNodeFromTemplate(template.id, position);
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDoubleClick={onDoubleClick}
      className={cn(
        'group flex items-center gap-3 p-3 rounded-lg border-2 bg-card cursor-grab transition-all',
        'hover:shadow-md hover:scale-[1.02] active:cursor-grabbing active:scale-[0.98]',
        `border-${template.color.replace('bg-', '')}`
      )}
    >
      <div className={cn('p-2 rounded-md text-white', template.color, `hover:${template.color}`)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{template.label}</div>
        <div className="text-xs text-muted-foreground truncate">{template.description}</div>
      </div>
      <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

/**
 * Basic empty prompt template card
 */
function BasicTemplateCard() {
  const config = NODE_TYPE_CONFIGS['prompt-template'];

  const onDragStart = (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('application/reactflow-node-type', 'prompt-template');
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDoubleClick = () => {
    const position = { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 };
    useFlowStore.getState().addNode(position);
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDoubleClick={onDoubleClick}
      className={cn(
        'group flex items-center gap-3 p-3 rounded-lg border-2 bg-card cursor-grab transition-all',
        'hover:shadow-md hover:scale-[1.02] active:cursor-grabbing active:scale-[0.98]',
        'border-dashed border-muted-foreground/50 hover:border-primary',
        'border-blue-500'
      )}
    >
      <div className="p-2 rounded-md text-white bg-blue-500 hover:bg-blue-600">
        <Plus className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{config.label}</div>
        <div className="text-xs text-muted-foreground truncate">{config.description}</div>
      </div>
      <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

/**
 * Category section with expand/collapse
 */
function TemplateCategory({
  title,
  children,
  defaultExpanded = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 hover:text-foreground transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        {title}
      </button>

      {isExpanded && <div className="space-y-2">{children}</div>}
    </div>
  );
}

export function NodePalette({ className }: NodePaletteProps) {
  const { formatMessage } = useIntl();
  const isPaletteOpen = useFlowStore((state) => state.isPaletteOpen);
  const setIsPaletteOpen = useFlowStore((state) => state.setIsPaletteOpen);

  if (!isPaletteOpen) {
    return (
      <div className={cn('w-10 bg-card border-r border-border flex flex-col items-center py-4', className)}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsPaletteOpen(true)}
          title={formatMessage({ id: 'orchestrator.palette.open' })}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('w-64 bg-card border-r border-border flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-foreground">{formatMessage({ id: 'orchestrator.palette.title' })}</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsPaletteOpen(false)}
          title={formatMessage({ id: 'orchestrator.palette.collapse' })}
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
      </div>

      {/* Instructions */}
      <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/50 border-b border-border">
        {formatMessage({ id: 'orchestrator.palette.instructions' })}
      </div>

      {/* Template Categories */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Basic / Empty Template */}
        <TemplateCategory title="Basic" defaultExpanded={false}>
          <BasicTemplateCard />
        </TemplateCategory>

        {/* Slash Commands */}
        <TemplateCategory title="Slash Commands" defaultExpanded={true}>
          {QUICK_TEMPLATES.filter(t => t.id.startsWith('slash-command')).map((template) => (
            <QuickTemplateCard key={template.id} template={template} />
          ))}
        </TemplateCategory>

        {/* CLI Tools */}
        <TemplateCategory title="CLI Tools" defaultExpanded={true}>
          {QUICK_TEMPLATES.filter(t => ['analysis', 'implementation'].includes(t.id)).map((template) => (
            <QuickTemplateCard key={template.id} template={template} />
          ))}
        </TemplateCategory>

        {/* Flow Control */}
        <TemplateCategory title="Flow Control" defaultExpanded={true}>
          {QUICK_TEMPLATES.filter(t => ['file-operation', 'conditional', 'parallel', 'merge'].includes(t.id)).map((template) => (
            <QuickTemplateCard key={template.id} template={template} />
          ))}
        </TemplateCategory>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border bg-muted/30">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Tip:</span> Drag to canvas or double-click to add
        </div>
      </div>
    </div>
  );
}

export default NodePalette;
