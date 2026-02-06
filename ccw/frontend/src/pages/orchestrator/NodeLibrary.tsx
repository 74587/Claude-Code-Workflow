// ========================================
// Node Library Component
// ========================================
// Displays quick templates organized by category (phase / tool / command)
// Extracted from NodePalette for use inside LeftSidebar

import { DragEvent, useState } from 'react';
import {
  MessageSquare, ChevronDown, ChevronRight, GripVertical,
  Search, Code, Terminal, Plus,
  FolderOpen, Database, ListTodo, Play, CheckCircle,
  FolderSearch, GitMerge, ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFlowStore } from '@/stores';
import { NODE_TYPE_CONFIGS, QUICK_TEMPLATES } from '@/types/flow';
import type { QuickTemplate } from '@/types/flow';

// ========== Icon Mapping ==========

const TEMPLATE_ICONS: Record<string, React.ElementType> = {
  // Command templates
  'slash-command-main': Terminal,
  'slash-command-async': Terminal,
  analysis: Search,
  implementation: Code,
  // Phase templates
  'phase-session': FolderOpen,
  'phase-context': Database,
  'phase-plan': ListTodo,
  'phase-execute': Play,
  'phase-review': CheckCircle,
  // Tool templates
  'tool-context-gather': FolderSearch,
  'tool-conflict-resolution': GitMerge,
  'tool-task-generate': ListChecks,
};

// ========== Category Configuration ==========

const CATEGORY_CONFIG: Record<QuickTemplate['category'], { title: string; defaultExpanded: boolean }> = {
  phase: { title: '\u9636\u6BB5\u8282\u70B9', defaultExpanded: true },
  tool: { title: '\u5DE5\u5177\u8282\u70B9', defaultExpanded: true },
  command: { title: '\u547D\u4EE4', defaultExpanded: false },
};

const CATEGORY_ORDER: QuickTemplate['category'][] = ['phase', 'tool', 'command'];

// ========== Sub-Components ==========

/**
 * Collapsible category section
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

/**
 * Draggable card for a quick template
 */
function QuickTemplateCard({
  template,
}: {
  template: QuickTemplate;
}) {
  const Icon = TEMPLATE_ICONS[template.id] || MessageSquare;

  const onDragStart = (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('application/reactflow-node-type', 'prompt-template');
    event.dataTransfer.setData('application/reactflow-template-id', template.id);
    event.dataTransfer.effectAllowed = 'move';
  };

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
        'group flex items-center gap-3 p-3 rounded-lg border bg-card cursor-grab transition-all',
        'hover:shadow-md hover:scale-[1.02] active:cursor-grabbing active:scale-[0.98]',
        `border-${template.color.replace('bg-', '')}`
      )}
    >
      <div className={cn('p-2 rounded-md text-white', template.color)}>
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
        'group flex items-center gap-3 p-3 rounded-lg border bg-card cursor-grab transition-all',
        'hover:shadow-md hover:scale-[1.02] active:cursor-grabbing active:scale-[0.98]',
        'border-dashed border-muted-foreground/50 hover:border-primary',
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

// ========== Main Component ==========

interface NodeLibraryProps {
  className?: string;
}

/**
 * Node library panel displaying quick templates grouped by category.
 * Renders a scrollable list of template cards organized into collapsible sections.
 * Used inside LeftSidebar - does not manage its own header/footer/collapse state.
 */
export function NodeLibrary({ className }: NodeLibraryProps) {
  return (
    <div className={cn('flex-1 overflow-y-auto p-4 space-y-4', className)}>
      {/* Basic / Empty Template */}
      <TemplateCategory title="Basic" defaultExpanded={false}>
        <BasicTemplateCard />
      </TemplateCategory>

      {/* Category groups in order: phase -> tool -> command */}
      {CATEGORY_ORDER.map((category) => {
        const config = CATEGORY_CONFIG[category];
        const templates = QUICK_TEMPLATES.filter((t) => t.category === category);
        if (templates.length === 0) return null;

        return (
          <TemplateCategory
            key={category}
            title={config.title}
            defaultExpanded={config.defaultExpanded}
          >
            {templates.map((template) => (
              <QuickTemplateCard key={template.id} template={template} />
            ))}
          </TemplateCategory>
        );
      })}
    </div>
  );
}

export default NodeLibrary;
