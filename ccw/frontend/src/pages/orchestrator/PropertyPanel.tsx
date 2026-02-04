// ========================================
// Property Panel Component
// ========================================
// Dynamic property editor for unified PromptTemplate nodes

import { useCallback, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { Settings, X, MessageSquare, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useFlowStore } from '@/stores';
import type { PromptTemplateNodeData, CliTool, ExecutionMode } from '@/types/flow';

// ========== Form Field Components ==========

interface LabelInputProps {
  value: string;
  onChange: (value: string) => void;
}

function LabelInput({ value, onChange }: LabelInputProps) {
  const { formatMessage } = useIntl();
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        {formatMessage({ id: 'orchestrator.propertyPanel.labels.label' })}
      </label>
      <Input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={formatMessage({ id: 'orchestrator.propertyPanel.placeholders.nodeLabel' })}
      />
    </div>
  );
}

// ========== Unified PromptTemplate Property Editor ==========

interface PromptTemplatePropertiesProps {
  data: PromptTemplateNodeData;
  onChange: (updates: Partial<PromptTemplateNodeData>) => void;
}

function PromptTemplateProperties({ data, onChange }: PromptTemplatePropertiesProps) {
  const { formatMessage } = useIntl();
  const nodes = useFlowStore((state) => state.nodes);
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId);

  // Build available outputNames from other nodes for contextRefs picker
  const availableOutputNames = useMemo(() => {
    return nodes
      .filter((n) => n.id !== selectedNodeId && n.data?.outputName)
      .map((n) => ({
        id: n.data.outputName as string,
        label: n.data.label || n.id,
      }));
  }, [nodes, selectedNodeId]);

  const toggleContextRef = useCallback(
    (outputName: string) => {
      const currentRefs = data.contextRefs || [];
      const newRefs = currentRefs.includes(outputName)
        ? currentRefs.filter((ref) => ref !== outputName)
        : [...currentRefs, outputName];
      onChange({ contextRefs: newRefs });
    },
    [data.contextRefs, onChange]
  );

  return (
    <div className="space-y-4">
      {/* Label */}
      <LabelInput value={data.label} onChange={(value) => onChange({ label: value })} />

      {/* Instruction - main textarea */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          {formatMessage({ id: 'orchestrator.propertyPanel.labels.instruction' })}
        </label>
        <textarea
          value={data.instruction || ''}
          onChange={(e) => onChange({ instruction: e.target.value })}
          placeholder={formatMessage({ id: 'orchestrator.propertyPanel.placeholders.instruction' })}
          className="w-full h-32 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm resize-none font-mono"
        />
      </div>

      {/* Output Name */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          {formatMessage({ id: 'orchestrator.propertyPanel.labels.outputName' })}
        </label>
        <Input
          value={data.outputName || ''}
          onChange={(e) => onChange({ outputName: e.target.value || undefined })}
          placeholder={formatMessage({ id: 'orchestrator.propertyPanel.placeholders.outputName' })}
        />
      </div>

      {/* Tool Select */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          {formatMessage({ id: 'orchestrator.propertyPanel.labels.tool' })}
        </label>
        <select
          value={data.tool || ''}
          onChange={(e) => onChange({ tool: (e.target.value || undefined) as CliTool | undefined })}
          className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm"
        >
          <option value="">{formatMessage({ id: 'orchestrator.propertyPanel.options.toolNone' })}</option>
          <option value="gemini">{formatMessage({ id: 'orchestrator.propertyPanel.options.toolGemini' })}</option>
          <option value="qwen">{formatMessage({ id: 'orchestrator.propertyPanel.options.toolQwen' })}</option>
          <option value="codex">{formatMessage({ id: 'orchestrator.propertyPanel.options.toolCodex' })}</option>
          <option value="claude">{formatMessage({ id: 'orchestrator.propertyPanel.options.toolClaude' })}</option>
        </select>
      </div>

      {/* Mode Select */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          {formatMessage({ id: 'orchestrator.propertyPanel.labels.mode' })}
        </label>
        <select
          value={data.mode || 'mainprocess'}
          onChange={(e) => onChange({ mode: e.target.value as ExecutionMode })}
          className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm"
        >
          <option value="analysis">{formatMessage({ id: 'orchestrator.propertyPanel.options.modeAnalysis' })}</option>
          <option value="write">{formatMessage({ id: 'orchestrator.propertyPanel.options.modeWrite' })}</option>
          <option value="mainprocess">{formatMessage({ id: 'orchestrator.propertyPanel.options.modeMainprocess' })}</option>
          <option value="async">{formatMessage({ id: 'orchestrator.propertyPanel.options.modeAsync' })}</option>
        </select>
      </div>

      {/* Context References - multi-select */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          {formatMessage({ id: 'orchestrator.propertyPanel.labels.contextRefs' })}
        </label>
        <div className="space-y-2">
          {/* Selected refs tags */}
          {data.contextRefs && data.contextRefs.length > 0 && (
            <div className="flex flex-wrap gap-2 p-2 rounded-md border border-border bg-muted/30">
              {data.contextRefs.map((ref) => {
                const node = availableOutputNames.find((n) => n.id === ref);
                return (
                  <span
                    key={ref}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary text-primary-foreground text-xs"
                  >
                    <span>{node?.label || ref}</span>
                    <button
                      type="button"
                      onClick={() => toggleContextRef(ref)}
                      className="hover:bg-primary-foreground/20 rounded p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
              <button
                type="button"
                onClick={() => onChange({ contextRefs: [] })}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                {formatMessage({ id: 'orchestrator.multiNodeSelector.clear' })}
              </button>
            </div>
          )}

          {/* Available outputs list */}
          <div className="border border-border rounded-md bg-background max-h-32 overflow-y-auto">
            {availableOutputNames.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground text-center">
                {formatMessage({ id: 'orchestrator.variablePicker.empty' })}
              </div>
            ) : (
              <div className="p-1">
                {availableOutputNames.map((item) => {
                  const isSelected = data.contextRefs?.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleContextRef(item.id)}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded cursor-pointer transition-colors',
                        'hover:bg-muted',
                        isSelected && 'bg-muted'
                      )}
                    >
                      <div
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center',
                          isSelected ? 'bg-primary border-primary' : 'border-border'
                        )}
                      >
                        {isSelected && <span className="text-primary-foreground text-xs">+</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{item.label}</div>
                        <div className="text-xs text-muted-foreground font-mono">{'{{' + item.id + '}}'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== Main PropertyPanel Component ==========

interface PropertyPanelProps {
  className?: string;
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
    (updates: Partial<PromptTemplateNodeData>) => {
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

  // Collapsed state
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

  // No node selected
  if (!selectedNode) {
    return (
      <div className={cn('w-72 bg-card border-l border-border flex flex-col', className)}>
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
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-muted-foreground">
            <Settings className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{formatMessage({ id: 'orchestrator.propertyPanel.selectNode' })}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('w-72 bg-card border-l border-border flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
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
          prompt template
        </span>
      </div>

      {/* Properties Form - unified for all nodes */}
      <div className="flex-1 overflow-y-auto p-4">
        <PromptTemplateProperties
          data={selectedNode.data as PromptTemplateNodeData}
          onChange={handleChange}
        />
      </div>

      {/* Delete Button */}
      <div className="px-4 py-3 border-t border-border">
        <Button variant="destructive" className="w-full" onClick={handleDelete}>
          <Trash2 className="w-4 h-4 mr-2" />
          {formatMessage({ id: 'orchestrator.propertyPanel.deleteNode' })}
        </Button>
      </div>
    </div>
  );
}

export default PropertyPanel;
