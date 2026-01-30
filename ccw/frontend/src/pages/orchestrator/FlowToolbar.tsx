// ========================================
// Flow Toolbar Component
// ========================================
// Toolbar for flow operations: New, Save, Load, Export

import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Save,
  FolderOpen,
  Download,
  Trash2,
  Copy,
  Workflow,
  Loader2,
  ChevronDown,
  Library,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useFlowStore, toast } from '@/stores';
import type { Flow } from '@/types/flow';

interface FlowToolbarProps {
  className?: string;
  onOpenTemplateLibrary?: () => void;
}

export function FlowToolbar({ className, onOpenTemplateLibrary }: FlowToolbarProps) {
  const [isFlowListOpen, setIsFlowListOpen] = useState(false);
  const [flowName, setFlowName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Flow store
  const currentFlow = useFlowStore((state) => state.currentFlow);
  const isModified = useFlowStore((state) => state.isModified);
  const flows = useFlowStore((state) => state.flows);
  const isLoadingFlows = useFlowStore((state) => state.isLoadingFlows);
  const createFlow = useFlowStore((state) => state.createFlow);
  const saveFlow = useFlowStore((state) => state.saveFlow);
  const loadFlow = useFlowStore((state) => state.loadFlow);
  const deleteFlow = useFlowStore((state) => state.deleteFlow);
  const duplicateFlow = useFlowStore((state) => state.duplicateFlow);
  const fetchFlows = useFlowStore((state) => state.fetchFlows);

  // Load flows on mount
  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  // Sync flow name with current flow
  useEffect(() => {
    setFlowName(currentFlow?.name || '');
  }, [currentFlow?.name]);

  // Handle new flow
  const handleNew = useCallback(() => {
    const newFlow = createFlow('Untitled Flow', 'A new workflow');
    setFlowName(newFlow.name);
    toast.success('Flow Created', 'New flow created successfully');
  }, [createFlow]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!currentFlow) {
      toast.error('No Flow', 'Create a flow first before saving');
      return;
    }

    setIsSaving(true);
    try {
      // Update flow name if changed
      if (flowName && flowName !== currentFlow.name) {
        useFlowStore.setState((state) => ({
          currentFlow: state.currentFlow
            ? { ...state.currentFlow, name: flowName }
            : null,
        }));
      }

      const saved = await saveFlow();
      if (saved) {
        toast.success('Flow Saved', `"${flowName || currentFlow.name}" saved successfully`);
      } else {
        toast.error('Save Failed', 'Could not save the flow');
      }
    } catch (err) {
      toast.error('Save Error', 'An error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  }, [currentFlow, flowName, saveFlow]);

  // Handle load
  const handleLoad = useCallback(
    async (flow: Flow) => {
      const loaded = await loadFlow(flow.id);
      if (loaded) {
        setIsFlowListOpen(false);
        toast.success('Flow Loaded', `"${flow.name}" loaded successfully`);
      } else {
        toast.error('Load Failed', 'Could not load the flow');
      }
    },
    [loadFlow]
  );

  // Handle delete
  const handleDelete = useCallback(
    async (flow: Flow, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm(`Delete "${flow.name}"? This cannot be undone.`)) return;

      const deleted = await deleteFlow(flow.id);
      if (deleted) {
        toast.success('Flow Deleted', `"${flow.name}" deleted successfully`);
      } else {
        toast.error('Delete Failed', 'Could not delete the flow');
      }
    },
    [deleteFlow]
  );

  // Handle duplicate
  const handleDuplicate = useCallback(
    async (flow: Flow, e: React.MouseEvent) => {
      e.stopPropagation();
      const duplicated = await duplicateFlow(flow.id);
      if (duplicated) {
        toast.success('Flow Duplicated', `"${duplicated.name}" created`);
      } else {
        toast.error('Duplicate Failed', 'Could not duplicate the flow');
      }
    },
    [duplicateFlow]
  );

  // Handle export
  const handleExport = useCallback(() => {
    if (!currentFlow) {
      toast.error('No Flow', 'Create or load a flow first');
      return;
    }

    const nodes = useFlowStore.getState().nodes;
    const edges = useFlowStore.getState().edges;
    const exportData = {
      ...currentFlow,
      nodes,
      edges,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentFlow.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Flow Exported', 'Flow exported as JSON file');
  }, [currentFlow]);

  return (
    <div className={cn('flex items-center gap-3 p-3 bg-card border-b border-border', className)}>
      {/* Flow Icon and Name */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Workflow className="w-5 h-5 text-primary flex-shrink-0" />
        <Input
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
          placeholder="Flow name"
          className="max-w-[200px] h-8 text-sm"
        />
        {isModified && (
          <span className="text-xs text-amber-500 flex-shrink-0">Unsaved changes</span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleNew}>
          <Plus className="w-4 h-4 mr-1" />
          New
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={isSaving || !currentFlow}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-1" />
          )}
          Save
        </Button>

        {/* Flow List Dropdown */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFlowListOpen(!isFlowListOpen)}
          >
            <FolderOpen className="w-4 h-4 mr-1" />
            Load
            <ChevronDown className="w-3 h-3 ml-1" />
          </Button>

          {isFlowListOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsFlowListOpen(false)}
              />

              {/* Dropdown */}
              <div className="absolute top-full right-0 mt-1 w-72 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-muted/50">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Saved Flows ({flows.length})
                  </span>
                </div>

                <div className="max-h-64 overflow-y-auto">
                  {isLoadingFlows ? (
                    <div className="p-4 text-center text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                      Loading...
                    </div>
                  ) : flows.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No saved flows
                    </div>
                  ) : (
                    flows.map((flow) => (
                      <div
                        key={flow.id}
                        onClick={() => handleLoad(flow)}
                        className={cn(
                          'flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors',
                          currentFlow?.id === flow.id && 'bg-primary/10'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-foreground truncate">
                            {flow.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(flow.updated_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => handleDuplicate(flow, e)}
                            title="Duplicate"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={(e) => handleDelete(flow, e)}
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={handleExport} disabled={!currentFlow}>
          <Download className="w-4 h-4 mr-1" />
          Export
        </Button>

        <Button variant="outline" size="sm" onClick={onOpenTemplateLibrary}>
          <Library className="w-4 h-4 mr-1" />
          Templates
        </Button>

        <div className="w-px h-6 bg-border" />
      </div>
    </div>
  );
}

export default FlowToolbar;
