// ========================================
// Property Panel Component
// ========================================
// Dynamic property editor for selected nodes

import { useCallback } from 'react';
import { useIntl } from 'react-intl';
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
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.labels.label' })}</label>
        <Input
          value={data.label || ''}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={formatMessage({ id: 'orchestrator.propertyPanel.placeholders.nodeLabel' })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.labels.command' })}</label>
        <Input
          value={data.command || ''}
          onChange={(e) => onChange({ command: e.target.value })}
          placeholder={formatMessage({ id: 'orchestrator.propertyPanel.placeholders.commandName' })}
          className="font-mono"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.labels.arguments' })}</label>
        <Input
          value={data.args || ''}
          onChange={(e) => onChange({ args: e.target.value })}
          placeholder={formatMessage({ id: 'orchestrator.propertyPanel.placeholders.commandArgs' })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.labels.executionMode' })}</label>
        <select
          value={data.execution?.mode || 'analysis'}
          onChange={(e) =>
            onChange({
              execution: { ...data.execution, mode: e.target.value as 'analysis' | 'write' },
            })
          }
          className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm"
        >
          <option value="analysis">{formatMessage({ id: 'orchestrator.propertyPanel.options.modeAnalysis' })}</option>
          <option value="write">{formatMessage({ id: 'orchestrator.propertyPanel.options.modeWrite' })}</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.labels.onError' })}</label>
        <select
          value={data.onError || 'stop'}
          onChange={(e) => onChange({ onError: e.target.value as 'continue' | 'stop' | 'retry' })}
          className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm"
        >
          <option value="stop">{formatMessage({ id: 'orchestrator.propertyPanel.options.errorStop' })}</option>
          <option value="continue">{formatMessage({ id: 'orchestrator.propertyPanel.options.errorContinue' })}</option>
          <option value="retry">{formatMessage({ id: 'orchestrator.propertyPanel.options.errorRetry' })}</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.labels.timeout' })}</label>
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
          placeholder={formatMessage({ id: 'orchestrator.propertyPanel.placeholders.timeout' })}
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
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.labels.label' })}</label>
        <Input
          value={data.label || ''}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={formatMessage({ id: 'orchestrator.propertyPanel.placeholders.nodeLabel' })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.labels.operation' })}</label>
        <select
          value={data.operation || 'read'}
          onChange={(e) =>
            onChange({
              operation: e.target.value as FileOperationNodeData['operation'],
            })
          }
          className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm"
        >
          <option value="read">{formatMessage({ id: 'orchestrator.propertyPanel.options.operationRead' })}</option>
          <option value="write">{formatMessage({ id: 'orchestrator.propertyPanel.options.operationWrite' })}</option>
          <option value="append">{formatMessage({ id: 'orchestrator.propertyPanel.options.operationAppend' })}</option>
          <option value="delete">{formatMessage({ id: 'orchestrator.propertyPanel.options.operationDelete' })}</option>
          <option value="copy">{formatMessage({ id: 'orchestrator.propertyPanel.options.operationCopy' })}</option>
          <option value="move">{formatMessage({ id: 'orchestrator.propertyPanel.options.operationMove' })}</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.labels.path' })}</label>
        <Input
          value={data.path || ''}
          onChange={(e) => onChange({ path: e.target.value })}
          placeholder={formatMessage({ id: 'orchestrator.propertyPanel.placeholders.path' })}
          className="font-mono"
        />
      </div>

      {(data.operation === 'write' || data.operation === 'append') && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.labels.content' })}</label>
          <textarea
            value={data.content || ''}
            onChange={(e) => onChange({ content: e.target.value })}
            placeholder={formatMessage({ id: 'orchestrator.propertyPanel.placeholders.content' })}
            className="w-full h-24 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm resize-none font-mono"
          />
        </div>
      )}

      {(data.operation === 'copy' || data.operation === 'move') && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.labels.destinationPath' })}</label>
          <Input
            value={data.destinationPath || ''}
            onChange={(e) => onChange({ destinationPath: e.target.value })}
            placeholder={formatMessage({ id: 'orchestrator.propertyPanel.placeholders.destinationPath' })}
            className="font-mono"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.labels.outputVariable' })}</label>
        <Input
          value={data.outputVariable || ''}
          onChange={(e) => onChange({ outputVariable: e.target.value })}
          placeholder={formatMessage({ id: 'orchestrator.propertyPanel.placeholders.variableName' })}
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
          {formatMessage({ id: 'orchestrator.propertyPanel.labels.addToContext' })}
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
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.labels.label' })}</label>
        <Input
          value={data.label || ''}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={formatMessage({ id: 'orchestrator.propertyPanel.placeholders.nodeLabel' })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.labels.condition' })}</label>
        <textarea
          value={data.condition || ''}
          onChange={(e) => onChange({ condition: e.target.value })}
          placeholder={formatMessage({ id: 'orchestrator.propertyPanel.placeholders.condition' })}
          className="w-full h-20 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm resize-none font-mono"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.labels.trueLabel' })}</label>
          <Input
            value={data.trueLabel || ''}
            onChange={(e) => onChange({ trueLabel: e.target.value })}
            placeholder={formatMessage({ id: 'orchestrator.propertyPanel.placeholders.trueLabel' })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.labels.falseLabel' })}</label>
          <Input
            value={data.falseLabel || ''}
            onChange={(e) => onChange({ falseLabel: e.target.value })}
            placeholder={formatMessage({ id: 'orchestrator.propertyPanel.placeholders.falseLabel' })}
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
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.labels.label' })}</label>
        <Input
          value={data.label || ''}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={formatMessage({ id: 'orchestrator.propertyPanel.placeholders.nodeLabel' })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.labels.joinMode' })}</label>
        <select
          value={data.joinMode || 'all'}
          onChange={(e) =>
            onChange({ joinMode: e.target.value as ParallelNodeData['joinMode'] })
          }
          className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm"
        >
          <option value="all">{formatMessage({ id: 'orchestrator.propertyPanel.options.joinModeAll' })}</option>
          <option value="any">{formatMessage({ id: 'orchestrator.propertyPanel.options.joinModeAny' })}</option>
          <option value="none">{formatMessage({ id: 'orchestrator.propertyPanel.options.joinModeNone' })}</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.labels.timeout' })}</label>
        <Input
          type="number"
          value={data.timeout || ''}
          onChange={(e) =>
            onChange({ timeout: e.target.value ? parseInt(e.target.value) : undefined })
          }
          placeholder={formatMessage({ id: 'orchestrator.propertyPanel.placeholders.timeout' })}
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
          {formatMessage({ id: 'orchestrator.propertyPanel.labels.failFast' })}
        </label>
      </div>
    </div>
  );
}

export function PropertyPanel({ className }: PropertyPanelProps) {
  const { formatMessage } = useIntl();
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
          title={formatMessage({ id: 'orchestrator.propertyPanel.open' })}
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
          <h3 className="font-semibold text-foreground">{formatMessage({ id: 'orchestrator.propertyPanel.title' })}</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsPropertyPanelOpen(false)}
            title={formatMessage({ id: 'orchestrator.propertyPanel.close' })}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-muted-foreground">
            <Settings className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{formatMessage({ id: 'orchestrator.propertyPanel.selectNode' })}</p>
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
          <h3 className="font-semibold text-foreground">{formatMessage({ id: 'orchestrator.propertyPanel.title' })}</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsPropertyPanelOpen(false)}
          title={formatMessage({ id: 'orchestrator.propertyPanel.close' })}
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
          {formatMessage({ id: 'orchestrator.propertyPanel.deleteNode' })}
        </Button>
      </div>
    </div>
  );
}

export default PropertyPanel;
