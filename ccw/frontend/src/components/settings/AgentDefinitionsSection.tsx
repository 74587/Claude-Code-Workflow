// ========================================
// Agent Definitions Section
// ========================================
// Settings section for viewing and editing Codex/Claude agent model and effort fields
// Claude agents support advanced frontmatter config: MCP servers, hooks, permissions, etc.

import { useState, useEffect, useCallback } from 'react';
import { Bot, ChevronDown, ChevronRight, Save, RefreshCw, Settings2, Plus, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  fetchAgentDefinitions,
  updateAgentDefinition,
  batchUpdateAgentDefinitions,
  fetchMcpConfig,
  type AgentDefinition,
} from '@/lib/api';

// ========== Constants ==========

const CODEX_EFFORTS = ['', 'low', 'medium', 'high'];
const CLAUDE_EFFORTS = ['', 'low', 'medium', 'high', 'max'];
const CLAUDE_MODEL_PRESETS = ['sonnet', 'opus', 'haiku', 'inherit'];
const PERMISSION_MODES = ['', 'default', 'acceptEdits', 'dontAsk', 'bypassPermissions', 'plan'];
const MEMORY_OPTIONS = ['', 'user', 'project', 'local'];
const ISOLATION_OPTIONS = ['', 'worktree'];
const COLOR_OPTIONS = ['', 'purple', 'blue', 'yellow', 'green', 'red'];
const HOOK_EVENTS = ['PreToolUse', 'PostToolUse', 'Stop'];

const selectClass = 'h-7 text-xs rounded border border-input bg-background px-2';
const labelClass = 'text-xs text-muted-foreground shrink-0';

// ========== YAML helpers ==========

function parseMcpServersYaml(yaml: string): string[] {
  if (!yaml) return [];
  const servers: string[] = [];
  const lines = yaml.split('\n');
  for (const line of lines) {
    const match = line.match(/^\s+-\s+(.+)$/);
    if (match) servers.push(match[1].trim());
  }
  return servers;
}

function serializeMcpServersYaml(servers: string[]): string {
  if (servers.length === 0) return '';
  return `mcpServers:\n${servers.map(s => `  - ${s}`).join('\n')}`;
}

interface HookEntry {
  matcher: string;
  command: string;
}

interface ParsedHooks {
  PreToolUse: HookEntry[];
  PostToolUse: HookEntry[];
  Stop: HookEntry[];
}

function parseHooksYaml(yaml: string): ParsedHooks {
  const result: ParsedHooks = { PreToolUse: [], PostToolUse: [], Stop: [] };
  if (!yaml) return result;

  let currentEvent: string | null = null;
  let currentMatcher: string | null = null;
  const lines = yaml.split('\n');

  for (const line of lines) {
    // Top-level event: "  PreToolUse:"
    const eventMatch = line.match(/^\s{2,4}(\w+):$/);
    if (eventMatch && (eventMatch[1] in result)) {
      currentEvent = eventMatch[1];
      currentMatcher = null;
      continue;
    }
    // Matcher line: "      - matcher: "Bash""
    const matcherMatch = line.match(/^\s+-\s+matcher:\s*["']?([^"'\n]+)["']?$/);
    if (matcherMatch && currentEvent) {
      currentMatcher = matcherMatch[1].trim();
      continue;
    }
    // Command line: "            command: "./scripts/validate.sh"
    const commandMatch = line.match(/^\s+command:\s*["']?([^"'\n]+)["']?$/);
    if (commandMatch && currentEvent && currentMatcher !== null) {
      result[currentEvent as keyof ParsedHooks].push({
        matcher: currentMatcher,
        command: commandMatch[1].trim(),
      });
      currentMatcher = null;
      continue;
    }
    // type: command line — skip, we only support command type
  }
  return result;
}

function serializeHooksYaml(hooks: ParsedHooks): string {
  const parts: string[] = [];
  for (const event of HOOK_EVENTS) {
    const entries = hooks[event as keyof ParsedHooks];
    if (entries.length === 0) continue;
    parts.push(`  ${event}:`);
    for (const entry of entries) {
      parts.push(`    - matcher: "${entry.matcher}"`);
      parts.push(`      hooks:`);
      parts.push(`        - type: command`);
      parts.push(`          command: "${entry.command}"`);
    }
  }
  if (parts.length === 0) return '';
  return `hooks:\n${parts.join('\n')}`;
}

// ========== Advanced Settings (Claude only) ==========

interface AdvancedSettingsProps {
  agent: AgentDefinition;
  onSaved: () => void;
}

function AdvancedSettings({ agent, onSaved }: AdvancedSettingsProps) {
  // Quick settings
  const [color, setColor] = useState(agent.color);
  const [permissionMode, setPermissionMode] = useState(agent.permissionMode);
  const [memory, setMemory] = useState(agent.memory);
  const [maxTurns, setMaxTurns] = useState(agent.maxTurns);
  const [background, setBackground] = useState(agent.background === 'true');
  const [isolation, setIsolation] = useState(agent.isolation);

  // Tools
  const [tools, setTools] = useState(agent.tools);
  const [disallowedTools, setDisallowedTools] = useState(agent.disallowedTools);
  const [skills, setSkills] = useState(agent.skills);

  // MCP Servers
  const [installedServers, setInstalledServers] = useState<string[]>([]);
  const [selectedServers, setSelectedServers] = useState<string[]>(() => parseMcpServersYaml(agent.mcpServers));
  const [mcpLoading, setMcpLoading] = useState(false);
  const [customServer, setCustomServer] = useState('');

  // Hooks
  const [hooks, setHooks] = useState<ParsedHooks>(() => parseHooksYaml(agent.hooks));
  const [newHookEvent, setNewHookEvent] = useState('PreToolUse');

  const [saving, setSaving] = useState(false);

  // Load installed MCP servers
  useEffect(() => {
    let cancelled = false;
    setMcpLoading(true);
    fetchMcpConfig()
      .then((config) => {
        if (cancelled) return;
        const names = new Set<string>();
        // Collect from all sources
        if (config.userServers) Object.keys(config.userServers).forEach(n => names.add(n));
        if (config.globalServers) Object.keys(config.globalServers).forEach(n => names.add(n));
        if (config.projects) {
          Object.values(config.projects).forEach((proj: any) => {
            if (proj?.mcpServers) Object.keys(proj.mcpServers).forEach(n => names.add(n));
          });
        }
        setInstalledServers(Array.from(names).sort());
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setMcpLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Sync state on agent prop change
  useEffect(() => {
    setColor(agent.color);
    setPermissionMode(agent.permissionMode);
    setMemory(agent.memory);
    setMaxTurns(agent.maxTurns);
    setBackground(agent.background === 'true');
    setIsolation(agent.isolation);
    setTools(agent.tools);
    setDisallowedTools(agent.disallowedTools);
    setSkills(agent.skills);
    setSelectedServers(parseMcpServersYaml(agent.mcpServers));
    setHooks(parseHooksYaml(agent.hooks));
  }, [agent]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const body: { filePath: string; [key: string]: string | undefined } = { filePath: agent.filePath };

      // Only send changed fields
      if (color !== agent.color) body.color = color;
      if (permissionMode !== agent.permissionMode) body.permissionMode = permissionMode;
      if (memory !== agent.memory) body.memory = memory;
      if (maxTurns !== agent.maxTurns) body.maxTurns = maxTurns;
      const bgStr = background ? 'true' : '';
      if (bgStr !== agent.background) body.background = bgStr;
      if (isolation !== agent.isolation) body.isolation = isolation;
      if (tools !== agent.tools) body.tools = tools;
      if (disallowedTools !== agent.disallowedTools) body.disallowedTools = disallowedTools;
      if (skills !== agent.skills) body.skills = skills;

      // MCP servers
      const newMcpYaml = serializeMcpServersYaml(selectedServers);
      if (newMcpYaml !== agent.mcpServers) body.mcpServers = newMcpYaml;

      // Hooks
      const newHooksYaml = serializeHooksYaml(hooks);
      if (newHooksYaml !== agent.hooks) body.hooks = newHooksYaml;

      // Only save if something changed
      const changedKeys = Object.keys(body).filter(k => k !== 'filePath');
      if (changedKeys.length === 0) {
        toast.info('No changes to save');
        return;
      }

      await updateAgentDefinition(agent.type, agent.name, body);
      toast.success(`Updated ${agent.name} advanced settings`);
      onSaved();
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }, [agent, color, permissionMode, memory, maxTurns, background, isolation, tools, disallowedTools, skills, selectedServers, hooks, onSaved]);

  const toggleServer = (name: string) => {
    setSelectedServers(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  const addCustomServer = () => {
    const name = customServer.trim();
    if (name && !selectedServers.includes(name)) {
      setSelectedServers(prev => [...prev, name]);
      setCustomServer('');
    }
  };

  const addHook = () => {
    setHooks(prev => ({
      ...prev,
      [newHookEvent]: [...prev[newHookEvent as keyof ParsedHooks], { matcher: '', command: '' }],
    }));
  };

  const removeHook = (event: string, idx: number) => {
    setHooks(prev => ({
      ...prev,
      [event]: prev[event as keyof ParsedHooks].filter((_, i) => i !== idx),
    }));
  };

  const updateHook = (event: string, idx: number, field: 'matcher' | 'command', value: string) => {
    setHooks(prev => ({
      ...prev,
      [event]: prev[event as keyof ParsedHooks].map((h, i) => i === idx ? { ...h, [field]: value } : h),
    }));
  };

  return (
    <div className="mt-2 ml-6 p-3 rounded-md border border-border bg-muted/20 space-y-4">
      {/* Quick Settings Row 1 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <span className={labelClass}>Color:</span>
          <select className={selectClass} value={color} onChange={e => setColor(e.target.value)}>
            {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c || '—'}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <span className={labelClass}>Permission:</span>
          <select className={selectClass} value={permissionMode} onChange={e => setPermissionMode(e.target.value)}>
            {PERMISSION_MODES.map(p => <option key={p} value={p}>{p || '—'}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <span className={labelClass}>Memory:</span>
          <select className={selectClass} value={memory} onChange={e => setMemory(e.target.value)}>
            {MEMORY_OPTIONS.map(m => <option key={m} value={m}>{m || '—'}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <span className={labelClass}>MaxTurns:</span>
          <Input
            className="h-7 text-xs w-[60px]"
            type="number"
            value={maxTurns}
            onChange={e => setMaxTurns(e.target.value)}
            placeholder="—"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Checkbox
            checked={background}
            onCheckedChange={(v) => setBackground(v === true)}
          />
          <span className={labelClass}>Background</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={labelClass}>Isolation:</span>
          <select className={selectClass} value={isolation} onChange={e => setIsolation(e.target.value)}>
            {ISOLATION_OPTIONS.map(i => <option key={i} value={i}>{i || '—'}</option>)}
          </select>
        </div>
      </div>

      {/* Tools Row */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={labelClass}>Tools:</span>
          <Input
            className="h-7 text-xs flex-1"
            value={tools}
            onChange={e => setTools(e.target.value)}
            placeholder="Read, Write, Bash, Glob, Grep"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className={labelClass}>Disallowed:</span>
          <Input
            className="h-7 text-xs flex-1"
            value={disallowedTools}
            onChange={e => setDisallowedTools(e.target.value)}
            placeholder="e.g. Edit"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className={labelClass}>Skills:</span>
          <Input
            className="h-7 text-xs flex-1"
            value={skills}
            onChange={e => setSkills(e.target.value)}
            placeholder="e.g. api-conventions, error-handling"
          />
        </div>
      </div>

      {/* MCP Servers Picker */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">MCP Servers:</span>
        {mcpLoading ? (
          <span className="text-xs text-muted-foreground ml-2">Loading...</span>
        ) : (
          <div className="flex flex-wrap gap-3 ml-1">
            {installedServers.map(name => (
              <label key={name} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox
                  checked={selectedServers.includes(name)}
                  onCheckedChange={() => toggleServer(name)}
                />
                <span className="text-foreground">{name}</span>
              </label>
            ))}
            {/* Show selected servers not in installed list */}
            {selectedServers.filter(s => !installedServers.includes(s)).map(name => (
              <label key={name} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox checked onCheckedChange={() => toggleServer(name)} />
                <span className="text-foreground italic">{name}</span>
              </label>
            ))}
            <div className="flex items-center gap-1">
              <Input
                className="h-6 text-xs w-[120px]"
                value={customServer}
                onChange={e => setCustomServer(e.target.value)}
                placeholder="+ Custom"
                onKeyDown={e => { if (e.key === 'Enter') addCustomServer(); }}
              />
              <Button variant="ghost" size="sm" className="h-6 px-1" onClick={addCustomServer} disabled={!customServer.trim()}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Hooks Editor */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">Hooks:</span>
        {HOOK_EVENTS.map(event => {
          const entries = hooks[event as keyof ParsedHooks];
          if (entries.length === 0) return null;
          return (
            <div key={event} className="ml-1 space-y-1">
              <span className="text-xs text-muted-foreground font-medium">{event}:</span>
              {entries.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-2 ml-3">
                  <Input
                    className="h-6 text-xs w-[100px]"
                    value={entry.matcher}
                    onChange={e => updateHook(event, idx, 'matcher', e.target.value)}
                    placeholder="matcher (e.g. Bash)"
                  />
                  <span className="text-xs text-muted-foreground">&rarr;</span>
                  <Input
                    className="h-6 text-xs flex-1"
                    value={entry.command}
                    onChange={e => updateHook(event, idx, 'command', e.target.value)}
                    placeholder="command"
                  />
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => removeHook(event, idx)}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          );
        })}
        <div className="flex items-center gap-2 ml-1">
          <select className={selectClass} value={newHookEvent} onChange={e => setNewHookEvent(e.target.value)}>
            {HOOK_EVENTS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={addHook}>
            <Plus className="w-3 h-3 mr-1" />
            Add Hook
          </Button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button variant="default" size="sm" className="h-7" disabled={saving} onClick={handleSave}>
          <Save className="w-3 h-3 mr-1" />
          {saving ? 'Saving...' : 'Save Advanced'}
        </Button>
      </div>
    </div>
  );
}

// ========== Agent Card ==========

interface AgentCardProps {
  agent: AgentDefinition;
  onSaved: () => void;
}

function AgentCard({ agent, onSaved }: AgentCardProps) {
  const [model, setModel] = useState(agent.model);
  const [effort, setEffort] = useState(agent.effort);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isDirty = model !== agent.model || effort !== agent.effort;
  const effortOptions = agent.type === 'codex' ? CODEX_EFFORTS : CLAUDE_EFFORTS;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const body: { filePath: string; [key: string]: string | undefined } = { filePath: agent.filePath };
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
    <div>
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

        {/* Advanced toggle (claude only) */}
        {agent.type === 'claude' && (
          <button
            type="button"
            className={cn(
              'p-1 rounded hover:bg-accent transition-colors',
              showAdvanced && 'text-primary'
            )}
            onClick={() => setShowAdvanced(!showAdvanced)}
            title="Advanced Settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Advanced Settings Panel */}
      {showAdvanced && agent.type === 'claude' && (
        <AdvancedSettings agent={agent} onSaved={onSaved} />
      )}
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
  const [batchType, setBatchType] = useState<'all' | 'codex' | 'claude'>('all');
  const [batchColor, setBatchColor] = useState('');
  const [batchPermission, setBatchPermission] = useState('');
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

  const batchTargets = agents.filter(a => batchType === 'all' || a.type === batchType);
  const batchHasClaudeTargets = batchTargets.some(a => a.type === 'claude');
  const batchEffortOptions = batchType === 'codex'
    ? CODEX_EFFORTS
    : batchType === 'claude'
      ? CLAUDE_EFFORTS
      : ['', 'low', 'medium', 'high', 'max (claude only)'];

  const handleBatchApply = useCallback(async () => {
    const hasAnyValue = batchModel || batchEffort || batchColor || batchPermission;
    if (!hasAnyValue) {
      toast.error('Set at least one value first');
      return;
    }
    if (batchTargets.length === 0) {
      toast.error('No agents match the selected type');
      return;
    }

    setBatchSaving(true);
    try {
      // For model/effort, use the batch endpoint
      if (batchModel || batchEffort) {
        const targets = batchTargets.map(a => ({ filePath: a.filePath, type: a.type }));
        const result = await batchUpdateAgentDefinitions({
          targets,
          model: batchModel || undefined,
          effort: batchEffort || undefined,
        });
        toast.success(`Updated model/effort: ${result.updated}/${result.total} agents`);
      }

      // For claude-only fields (color, permissionMode), update each claude agent individually
      if ((batchColor || batchPermission) && batchHasClaudeTargets) {
        const claudeTargets = batchTargets.filter(a => a.type === 'claude');
        let updated = 0;
        for (const agent of claudeTargets) {
          try {
            const body: { filePath: string; [key: string]: string | undefined } = { filePath: agent.filePath };
            if (batchColor) body.color = batchColor;
            if (batchPermission) body.permissionMode = batchPermission;
            await updateAgentDefinition(agent.type, agent.name, body);
            updated++;
          } catch { /* skip failed */ }
        }
        toast.success(`Updated claude fields: ${updated}/${claudeTargets.length} agents`);
      }

      loadAgents();
    } catch (err) {
      toast.error(`Batch update failed: ${(err as Error).message}`);
    } finally {
      setBatchSaving(false);
    }
  }, [batchTargets, batchHasClaudeTargets, batchModel, batchEffort, batchColor, batchPermission, loadAgents]);

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
      <div className="p-3 mb-4 rounded-md border border-border bg-muted/30 space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground shrink-0">Batch:</span>
          <div className="flex items-center gap-1">
            <span className={labelClass}>Target:</span>
            <select
              className={selectClass}
              value={batchType}
              onChange={(e) => setBatchType(e.target.value as 'all' | 'codex' | 'claude')}
            >
              <option value="all">All ({agents.length})</option>
              <option value="codex">Codex ({agents.filter(a => a.type === 'codex').length})</option>
              <option value="claude">Claude ({agents.filter(a => a.type === 'claude').length})</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <span className={labelClass}>Model:</span>
            <Input
              className="h-7 text-xs w-[140px]"
              value={batchModel}
              onChange={(e) => setBatchModel(e.target.value)}
              placeholder="model"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className={labelClass}>Effort:</span>
            <select
              className={selectClass}
              value={batchEffort}
              onChange={(e) => setBatchEffort(e.target.value)}
            >
              {batchEffortOptions.map(e => {
                const val = e.startsWith('max') ? 'max' : e;
                return <option key={e} value={val}>{e || '—'}</option>;
              })}
            </select>
          </div>
          {/* Claude-only batch fields */}
          {batchType !== 'codex' && (
            <>
              <div className="flex items-center gap-1">
                <span className={labelClass}>Color:</span>
                <select className={selectClass} value={batchColor} onChange={e => setBatchColor(e.target.value)}>
                  {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c || '—'}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <span className={labelClass}>Permission:</span>
                <select className={selectClass} value={batchPermission} onChange={e => setBatchPermission(e.target.value)}>
                  {PERMISSION_MODES.map(p => <option key={p} value={p}>{p || '—'}</option>)}
                </select>
              </div>
            </>
          )}
          <Button
            variant="default"
            size="sm"
            className="h-7"
            disabled={batchSaving || (!batchModel && !batchEffort && !batchColor && !batchPermission)}
            onClick={handleBatchApply}
          >
            {batchSaving ? 'Applying...' : `Apply to ${batchType === 'all' ? 'All' : batchType} (${batchTargets.length})`}
          </Button>
        </div>
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
