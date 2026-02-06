// ========================================
// Node Library Component
// ========================================
// Displays built-in and custom node templates
// Supports creating, saving, and deleting custom templates with color selection

import { DragEvent, useState } from 'react';
import {
  MessageSquare, ChevronDown, ChevronRight, GripVertical,
  Terminal, Plus, Trash2, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFlowStore } from '@/stores';
import { NODE_TYPE_CONFIGS, QUICK_TEMPLATES } from '@/types/flow';
import type { QuickTemplate } from '@/types/flow';

// ========== Icon Mapping ==========

const TEMPLATE_ICONS: Record<string, React.ElementType> = {
  'slash-command-main': Terminal,
  'slash-command-async': Terminal,
};

// ========== Color Palette for custom templates ==========

const COLOR_OPTIONS = [
  { value: 'bg-blue-500', label: 'Blue' },
  { value: 'bg-green-500', label: 'Green' },
  { value: 'bg-purple-500', label: 'Purple' },
  { value: 'bg-rose-500', label: 'Rose' },
  { value: 'bg-amber-500', label: 'Amber' },
  { value: 'bg-cyan-500', label: 'Cyan' },
  { value: 'bg-teal-500', label: 'Teal' },
  { value: 'bg-orange-500', label: 'Orange' },
  { value: 'bg-indigo-500', label: 'Indigo' },
  { value: 'bg-pink-500', label: 'Pink' },
];

// ========== Sub-Components ==========

/**
 * Collapsible category section with optional action button
 */
function TemplateCategory({
  title,
  children,
  defaultExpanded = true,
  action,
}: {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  action?: React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div>
      <div className="flex items-center gap-1 mb-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 flex-1 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          {title}
        </button>
        {action}
      </div>

      {isExpanded && <div className="space-y-2">{children}</div>}
    </div>
  );
}

/**
 * Draggable card for a quick template
 */
function QuickTemplateCard({
  template,
  onDelete,
}: {
  template: QuickTemplate;
  onDelete?: () => void;
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
      )}
    >
      <div className={cn('p-2 rounded-md text-white shrink-0', template.color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{template.label}</div>
        <div className="text-xs text-muted-foreground truncate">{template.description}</div>
      </div>
      {onDelete ? (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
          title="Delete template"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ) : (
        <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
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

/**
 * Inline form for creating a new custom template
 */
function CreateTemplateForm({ onClose }: { onClose: () => void }) {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [instruction, setInstruction] = useState('');
  const [color, setColor] = useState('bg-blue-500');
  const addCustomTemplate = useFlowStore((s) => s.addCustomTemplate);

  const handleSubmit = () => {
    if (!label.trim()) return;

    const template: QuickTemplate = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: label.trim(),
      description: description.trim() || label.trim(),
      icon: 'MessageSquare',
      color,
      category: 'command',
      data: {
        label: label.trim(),
        instruction: instruction.trim(),
        contextRefs: [],
      },
    };

    addCustomTemplate(template);
    onClose();
  };

  return (
    <div className="p-3 rounded-lg border border-primary/50 bg-muted/50 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">New Custom Node</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <input
        type="text"
        placeholder="Node name"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="w-full text-sm px-2 py-1.5 rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        autoFocus
      />

      <input
        type="text"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full text-sm px-2 py-1.5 rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />

      <textarea
        placeholder="Default instruction (optional)"
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        rows={2}
        className="w-full text-sm px-2 py-1.5 rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
      />

      {/* Color picker */}
      <div>
        <div className="text-xs text-muted-foreground mb-1.5">Color</div>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setColor(opt.value)}
              className={cn(
                'w-6 h-6 rounded-full transition-all',
                opt.value,
                color === opt.value
                  ? 'ring-2 ring-offset-2 ring-offset-background ring-primary scale-110'
                  : 'hover:scale-110',
              )}
              title={opt.label}
            />
          ))}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!label.trim()}
        className={cn(
          'w-full text-sm font-medium py-1.5 rounded transition-colors',
          label.trim()
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'bg-muted text-muted-foreground cursor-not-allowed',
        )}
      >
        Save
      </button>
    </div>
  );
}

// ========== Main Component ==========

interface NodeLibraryProps {
  className?: string;
}

/**
 * Node library panel displaying built-in and custom node templates.
 * Built-in: Slash Command, Slash Command (Async), Prompt Template
 * Custom: User-created templates persisted to localStorage
 */
export function NodeLibrary({ className }: NodeLibraryProps) {
  const [isCreating, setIsCreating] = useState(false);
  const customTemplates = useFlowStore((s) => s.customTemplates);
  const removeCustomTemplate = useFlowStore((s) => s.removeCustomTemplate);

  return (
    <div className={cn('flex-1 overflow-y-auto p-4 space-y-4', className)}>
      {/* Built-in templates */}
      <TemplateCategory title="Built-in" defaultExpanded>
        <BasicTemplateCard />
        {QUICK_TEMPLATES.map((template) => (
          <QuickTemplateCard key={template.id} template={template} />
        ))}
      </TemplateCategory>

      {/* Custom templates */}
      <TemplateCategory
        title={`Custom (${customTemplates.length})`}
        defaultExpanded
        action={
          <button
            onClick={() => setIsCreating(true)}
            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Create custom node"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        }
      >
        {isCreating && <CreateTemplateForm onClose={() => setIsCreating(false)} />}
        {customTemplates.map((template) => (
          <QuickTemplateCard
            key={template.id}
            template={template}
            onDelete={() => removeCustomTemplate(template.id)}
          />
        ))}
        {customTemplates.length === 0 && !isCreating && (
          <div className="text-xs text-muted-foreground text-center py-3">
            No custom nodes yet. Click + to create.
          </div>
        )}
      </TemplateCategory>
    </div>
  );
}

export default NodeLibrary;
