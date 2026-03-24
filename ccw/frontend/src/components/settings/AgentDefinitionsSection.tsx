// ========================================
// Agent Definitions Section
// ========================================
// Settings section for viewing and editing Codex/Claude agent model and effort fields

import { useState, useEffect, useCallback } from 'react';
import { Bot, ChevronDown, ChevronRight, Save, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  fetchAgentDefinitions,
  updateAgentDefinition,
  batchUpdateAgentDefinitions,
  type AgentDefinition,
} from '@/lib/api';

// ========== Effort options ==========

const CODEX_EFFORTS = ['', 'low', 'medium', 'high'];
const CLAUDE_EFFORTS = ['', 'low', 'medium', 'high', 'max'];
const CLAUDE_MODEL_PRESETS = ['sonnet', 'opus', 'haiku', 'inherit'];

// ========== Agent Card ==========

interface AgentCardProps {
  agent: AgentDefinition;
  onSaved: () => void;
}

function AgentCard({ agent, onSaved }: AgentCardProps) {
  const [model, setModel] = useState(agent.model);
  const [effort, setEffort] = useState(agent.effort);
  const [saving, setSaving] = useState(false);

  const isDirty = model !== agent.model || effort !== agent.effort;
  const effortOptions = agent.type === 'codex' ? CODEX_EFFORTS : CLAUDE_EFFORTS;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const body: { filePath: string; model?: string; effort?: string } = { filePath: agent.filePath };
      if (model !== agent.model) body.model = model;
      if (effort !== agent.effort) body.effort = effort;
      await updateAgentDefinition(agent.type, agent.name, body);
      toast.success(`Updated ${agent.name}`);
      onSaved();
    } catch (err) {
      toast.error(`Failed to update ${agent.name}: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }, [agent, model, effort, onSaved]);

  // Sync local state when agent prop changes (after refetch)
  useEffect(() => {
    setModel(agent.model);
    setEffort(agent.effort);
  }, [agent.model, agent.effort]);

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-md border border-border bg-card hover:bg-accent/30 transition-colors">
      <Badge variant={agent.type === 'codex' ? 'default' : 'secondary'} className="text-xs shrink-0">
        {agent.type}
      </Badge>
      <span className="text-sm font-medium text-foreground min-w-[140px] truncate" title={agent.name}>
        {agent.name}
      </span>

      {/* Model input */}
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <span className="text-xs text-muted-foreground shrink-0">Model:</span>
        {agent.type === 'claude' ? (
          <div className="flex gap-1 flex-1 min-w-0">
            <select
              className="h-7 text-xs rounded border border-input bg-background px-2 shrink-0"
              value={CLAUDE_MODEL_PRESETS.includes(model) ? model : '__custom__'}
              onChange={(e) => {
                if (e.target.value === '__custom__') return;
                setModel(e.target.value);
              }}
            >
              {CLAUDE_MODEL_PRESETS.map(m => (
                <option key={m} value={m}>{m || '(none)'}</option>
              ))}
              {!CLAUDE_MODEL_PRESETS.includes(model) && (
                <option value="__custom__">custom</option>
              )}
            </select>
            {!CLAUDE_MODEL_PRESETS.includes(model) && (
              <Input
                className="h-7 text-xs flex-1 min-w-[100px]"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="model id"
              />
            )}
          </div>
        ) : (
          <Input
            className="h-7 text-xs flex-1 min-w-[100px]"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="model id"
          />
        )}
      </div>

      {/* Effort select */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-muted-foreground">Effort:</span>
        <select
          className="h-7 text-xs rounded border border-input bg-background px-2"
          value={effort}
          onChange={(e) => setEffort(e.target.value)}
        >
          {effortOptions.map(e => (
            <option key={e} value={e}>{e || '—'}</option>
          ))}
        </select>
      </div>

      {/* Save button */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 shrink-0"
        disabled={!isDirty || saving}
        onClick={handleSave}
      >
        <Save className="w-3 h-3 mr-1" />
        {saving ? '...' : 'Save'}
      </Button>
    </div>
  );
}

// ========== Installation Group ==========

interface InstallationGroupProps {
  installationPath: string;
  agents: AgentDefinition[];
  onSaved: () => void;
}

function InstallationGroup({ installationPath, agents, onSaved }: InstallationGroupProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left py-1 hover:text-primary transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <span className="text-sm font-medium text-foreground truncate" title={installationPath}>
          {installationPath}
        </span>
        <Badge variant="outline" className="text-xs ml-auto shrink-0">
          {agents.length} agents
        </Badge>
      </button>
      {expanded && (
        <div className="space-y-1 ml-6">
          {agents.map((agent) => (
            <AgentCard key={agent.filePath} agent={agent} onSaved={onSaved} />
          ))}
        </div>
      )}
    </div>
  );
}

// ========== Main Component ==========

export function AgentDefinitionsSection() {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchModel, setBatchModel] = useState('');
  const [batchEffort, setBatchEffort] = useState('');
  const [batchSaving, setBatchSaving] = useState(false);

  const loadAgents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAgentDefinitions();
      setAgents(data.agents);
    } catch (err) {
      toast.error(`Failed to load agents: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  // Group agents by installation path
  const grouped = agents.reduce<Record<string, AgentDefinition[]>>((acc, agent) => {
    const key = agent.installationPath;
    if (!acc[key]) acc[key] = [];
    acc[key].push(agent);
    return acc;
  }, {});

  const handleBatchApply = useCallback(async () => {
    if (!batchModel && !batchEffort) {
      toast.error('Set a model or effort value first');
      return;
    }

    setBatchSaving(true);
    try {
      const targets = agents.map(a => ({ filePath: a.filePath, type: a.type }));
      const result = await batchUpdateAgentDefinitions({
        targets,
        model: batchModel || undefined,
        effort: batchEffort || undefined,
      });
      toast.success(`Updated ${result.updated}/${result.total} agents`);
      loadAgents();
    } catch (err) {
      toast.error(`Batch update failed: ${(err as Error).message}`);
    } finally {
      setBatchSaving(false);
    }
  }, [agents, batchModel, batchEffort, loadAgents]);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Bot className="w-5 h-5" />
          Agent Definitions
        </h2>
        <Button variant="ghost" size="sm" onClick={loadAgents} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Batch Controls */}
      <div className="flex items-center gap-3 p-3 mb-4 rounded-md border border-border bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground shrink-0">Batch:</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Model:</span>
          <Input
            className="h-7 text-xs w-[160px]"
            value={batchModel}
            onChange={(e) => setBatchModel(e.target.value)}
            placeholder="model for all"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Effort:</span>
          <select
            className="h-7 text-xs rounded border border-input bg-background px-2"
            value={batchEffort}
            onChange={(e) => setBatchEffort(e.target.value)}
          >
            <option value="">—</option>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="max">max (claude only)</option>
          </select>
        </div>
        <Button
          variant="default"
          size="sm"
          className="h-7"
          disabled={batchSaving || (!batchModel && !batchEffort)}
          onClick={handleBatchApply}
        >
          {batchSaving ? 'Applying...' : 'Apply to All'}
        </Button>
      </div>

      {/* Agent list */}
      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-8">Loading agents...</div>
      ) : agents.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8">
          No agent definitions found. Install CCW to a project first.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([path, groupAgents]) => (
            <InstallationGroup
              key={path}
              installationPath={path}
              agents={groupAgents}
              onSaved={loadAgents}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

export default AgentDefinitionsSection;
