// ========================================
// Property Panel Component
// ========================================
// Dynamic property editor for selected nodes

import { useCallback } from 'react';
import { Settings, X, Terminal, FileText, GitBranch, GitMerge, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useFlowStore } from '@/stores';
import type {
  FlowNodeType,
  SlashCommandNodeData,
  FileOperationNodeData,
  ConditionalNodeData,
  ParallelNodeData,
  NodeData,
} from '@/types/flow';

interface PropertyPanelProps {
  className?: string;
}

// Icon mapping for node types
const nodeIcons: Record<FlowNodeType, React.FC<{ className?: string }>> = {
  'slash-command': Terminal,
  'file-operation': FileText,
  conditional: GitBranch,
  parallel: GitMerge,
};

// Slash Command Property Editor
function SlashCommandProperties({
  data,
  onChange,
}: {
  data: SlashCommandNodeData;
  onChange: (updates: Partial<SlashCommandNodeData>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Label</label>
        <Input
          value={data.label || ''}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Node label"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Command</label>
        <Input
          value={data.command || ''}
          onChange={(e) => onChange({ command: e.target.value })}
          placeholder="/command-name"
          className="font-mono"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Arguments</label>
        <Input
          value={data.args || ''}
          onChange={(e) => onChange({ args: e.target.value })}
          placeholder="Command arguments"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Execution Mode</label>
        <select
          value={data.execution?.mode || 'analysis'}
          onChange={(e) =>
            onChange({
              execution: { ...data.execution, mode: e.target.value as 'analysis' | 'write' },
            })
          }
          className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm"
        >
          <option value="analysis">Analysis (Read-only)</option>
          <option value="write">Write (Modify files)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">On Error</label>
        <select
          value={data.onError || 'stop'}
          onChange={(e) => onChange({ onError: e.target.value as 'continue' | 'stop' | 'retry' })}
          className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm"
        >
          <option value="stop">Stop execution</option>
          <option value="continue">Continue</option>
          <option value="retry">Retry</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Timeout (ms)</label>
        <Input
          type="number"
          value={data.execution?.timeout || ''}
          onChange={(e) =>
            onChange({
              execution: {
                ...data.execution,
                mode: data.execution?.mode || 'analysis',
                timeout: e.target.value ? parseInt(e.target.value) : undefined,
              },
            })
          }
          placeholder="60000"
        />
      </div>
    </div>
  );
}

// File Operation Property Editor
function FileOperationProperties({
  data,
  onChange,
}: {
  data: FileOperationNodeData;
  onChange: (updates: Partial<FileOperationNodeData>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Label</label>
        <Input
          value={data.label || ''}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Node label"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Operation</label>
        <select
          value={data.operation || 'read'}
          onChange={(e) =>
            onChange({
              operation: e.target.value as FileOperationNodeData['operation'],
            })
          }
          className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm"
        >
          <option value="read">Read</option>
          <option value="write">Write</option>
          <option value="append">Append</option>
          <option value="delete">Delete</option>
          <option value="copy">Copy</option>
          <option value="move">Move</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Path</label>
        <Input
          value={data.path || ''}
          onChange={(e) => onChange({ path: e.target.value })}
          placeholder="/path/to/file"
          className="font-mono"
        />
      </div>

      {(data.operation === 'write' || data.operation === 'append') && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Content</label>
          <textarea
            value={data.content || ''}
            onChange={(e) => onChange({ content: e.target.value })}
            placeholder="File content..."
            className="w-full h-24 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm resize-none font-mono"
          />
        </div>
      )}

      {(data.operation === 'copy' || data.operation === 'move') && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Destination Path</label>
          <Input
            value={data.destinationPath || ''}
            onChange={(e) => onChange({ destinationPath: e.target.value })}
            placeholder="/path/to/destination"
            className="font-mono"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Output Variable</label>
        <Input
          value={data.outputVariable || ''}
          onChange={(e) => onChange({ outputVariable: e.target.value })}
          placeholder="variableName"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="addToContext"
          checked={data.addToContext || false}
          onChange={(e) => onChange({ addToContext: e.target.checked })}
          className="rounded border-border"
        />
        <label htmlFor="addToContext" className="text-sm text-foreground">
          Add to context
        </label>
      </div>
    </div>
  );
}

// Conditional Property Editor
function ConditionalProperties({
  data,
  onChange,
}: {
  data: ConditionalNodeData;
  onChange: (updates: Partial<ConditionalNodeData>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Label</label>
        <Input
          value={data.label || ''}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Node label"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Condition</label>
        <textarea
          value={data.condition || ''}
          onChange={(e) => onChange({ condition: e.target.value })}
          placeholder="e.g., result.success === true"
          className="w-full h-20 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm resize-none font-mono"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">True Label</label>
          <Input
            value={data.trueLabel || ''}
            onChange={(e) => onChange({ trueLabel: e.target.value })}
            placeholder="True"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">False Label</label>
          <Input
            value={data.falseLabel || ''}
            onChange={(e) => onChange({ falseLabel: e.target.value })}
            placeholder="False"
          />
        </div>
      </div>
    </div>
  );
}

// Parallel Property Editor
function ParallelProperties({
  data,
  onChange,
}: {
  data: ParallelNodeData;
  onChange: (updates: Partial<ParallelNodeData>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Label</label>
        <Input
          value={data.label || ''}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Node label"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Join Mode</label>
        <select
          value={data.joinMode || 'all'}
          onChange={(e) =>
            onChange({ joinMode: e.target.value as ParallelNodeData['joinMode'] })
          }
          className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm"
        >
          <option value="all">Wait for all branches</option>
          <option value="any">Complete when any branch finishes</option>
          <option value="none">No synchronization</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Timeout (ms)</label>
        <Input
          type="number"
          value={data.timeout || ''}
          onChange={(e) =>
            onChange({ timeout: e.target.value ? parseInt(e.target.value) : undefined })
          }
          placeholder="30000"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="failFast"
          checked={data.failFast || false}
          onChange={(e) => onChange({ failFast: e.target.checked })}
          className="rounded border-border"
        />
        <label htmlFor="failFast" className="text-sm text-foreground">
          Fail fast (stop all branches on first error)
        </label>
      </div>
    </div>
  );
}

export function PropertyPanel({ className }: PropertyPanelProps) {
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId);
  const nodes = useFlowStore((state) => state.nodes);
  const updateNode = useFlowStore((state) => state.updateNode);
  const removeNode = useFlowStore((state) => state.removeNode);
  const isPropertyPanelOpen = useFlowStore((state) => state.isPropertyPanelOpen);
  const setIsPropertyPanelOpen = useFlowStore((state) => state.setIsPropertyPanelOpen);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const handleChange = useCallback(
    (updates: Partial<NodeData>) => {
      if (selectedNodeId) {
        updateNode(selectedNodeId, updates);
      }
    },
    [selectedNodeId, updateNode]
  );

  const handleDelete = useCallback(() => {
    if (selectedNodeId) {
      removeNode(selectedNodeId);
    }
  }, [selectedNodeId, removeNode]);

  if (!isPropertyPanelOpen) {
    return (
      <div className={cn('w-10 bg-card border-l border-border flex flex-col items-center py-4', className)}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsPropertyPanelOpen(true)}
          title="Open properties panel"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  if (!selectedNode) {
    return (
      <div className={cn('w-72 bg-card border-l border-border flex flex-col', className)}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground">Properties</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsPropertyPanelOpen(false)}
            title="Close panel"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-muted-foreground">
            <Settings className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Select a node to edit its properties</p>
          </div>
        </div>
      </div>
    );
  }

  const nodeType = selectedNode.type as FlowNodeType;
  const Icon = nodeIcons[nodeType];

  return (
    <div className={cn('w-72 bg-card border-l border-border flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-primary" />}
          <h3 className="font-semibold text-foreground">Properties</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsPropertyPanelOpen(false)}
          title="Close panel"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Node Type Badge */}
      <div className="px-4 py-2 border-b border-border bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {nodeType.replace('-', ' ')}
        </span>
      </div>

      {/* Properties Form */}
      <div className="flex-1 overflow-y-auto p-4">
        {nodeType === 'slash-command' && (
          <SlashCommandProperties
            data={selectedNode.data as SlashCommandNodeData}
            onChange={handleChange}
          />
        )}
        {nodeType === 'file-operation' && (
          <FileOperationProperties
            data={selectedNode.data as FileOperationNodeData}
            onChange={handleChange}
          />
        )}
        {nodeType === 'conditional' && (
          <ConditionalProperties
            data={selectedNode.data as ConditionalNodeData}
            onChange={handleChange}
          />
        )}
        {nodeType === 'parallel' && (
          <ParallelProperties
            data={selectedNode.data as ParallelNodeData}
            onChange={handleChange}
          />
        )}
      </div>

      {/* Delete Button */}
      <div className="px-4 py-3 border-t border-border">
        <Button
          variant="destructive"
          className="w-full"
          onClick={handleDelete}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Node
        </Button>
      </div>
    </div>
  );
}

export default PropertyPanel;
