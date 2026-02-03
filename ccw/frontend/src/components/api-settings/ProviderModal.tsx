// ========================================
// Provider Modal Component
// ========================================
// Add/Edit provider modal with multi-key support

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import {
  Check,
  Plus,
  Trash2,
  Zap,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Switch } from '@/components/ui/Switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/Collapsible';
import { useCreateProvider, useUpdateProvider } from '@/hooks/useApiSettings';
import { useNotifications } from '@/hooks/useNotifications';
import type { ProviderCredential, ProviderType, RoutingStrategy } from '@/lib/api';

// ========== Types ==========

export interface ProviderModalProps {
  open: boolean;
  onClose: () => void;
  provider?: ProviderCredential | null;
}

interface ApiKeyFormEntry {
  id: string;
  key: string;
  label?: string;
  weight?: number;
  enabled: boolean;
}

interface ModelDefinitionEntry {
  id: string;
  name: string;
  series?: string;
  contextWindow?: number;
  streaming?: boolean;
  functionCalling?: boolean;
  vision?: boolean;
  description?: string;
}

// ========== Helper Components ==========

interface ApiKeyEntryRowProps {
  entry: ApiKeyFormEntry;
  showKey: boolean;
  onToggleShowKey: () => void;
  onUpdate: (updates: Partial<ApiKeyFormEntry>) => void;
  onRemove: () => void;
}

function ApiKeyEntryRow({
  entry,
  showKey,
  onToggleShowKey,
  onUpdate,
  onRemove,
}: ApiKeyEntryRowProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="grid grid-cols-12 gap-2 items-start p-3 bg-muted/30 rounded-lg">
      <div className="col-span-3">
        <Label className="text-xs">{formatMessage({ id: 'apiSettings.providers.keyLabel' })}</Label>
        <Input
          value={entry.label || ''}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Key 1"
          className="mt-1"
        />
      </div>
      <div className="col-span-4">
        <Label className="text-xs">{formatMessage({ id: 'apiSettings.providers.keyValue' })}</Label>
        <div className="relative mt-1">
          <Input
            type={showKey ? 'text' : 'password'}
            value={entry.key}
            onChange={(e) => onUpdate({ key: e.target.value })}
            placeholder="sk-..."
            className="pr-8"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full px-2"
            onClick={onToggleShowKey}
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
        </div>
      </div>
      <div className="col-span-2">
        <Label className="text-xs">{formatMessage({ id: 'apiSettings.providers.keyWeight' })}</Label>
        <Input
          type="number"
          min="0"
          max="100"
          value={entry.weight ?? 1}
          onChange={(e) => onUpdate({ weight: parseInt(e.target.value) || 1 })}
          className="mt-1"
        />
      </div>
      <div className="col-span-2 flex items-center gap-2 pt-5">
        <Switch
          checked={entry.enabled}
          onCheckedChange={(enabled) => onUpdate({ enabled })}
        />
        <span className="text-sm text-muted-foreground">
          {entry.enabled ? formatMessage({ id: 'apiSettings.common.enabled' }) : formatMessage({ id: 'apiSettings.common.disabled' })}
        </span>
      </div>
      <div className="col-span-1 flex items-center justify-end pt-5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ========== Main Component ==========

export function ProviderModal({ open, onClose, provider }: ProviderModalProps) {
  const { formatMessage } = useIntl();
  const { error } = useNotifications();
  const isEditing = !!provider;

  // Mutations
  const { createProvider, isCreating } = useCreateProvider();
  const { updateProvider, isUpdating } = useUpdateProvider();

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<ProviderType>('openai');
  const [apiKey, setApiKey] = useState('');
  const [apiBase, setApiBase] = useState('');
  const [enabled, setEnabled] = useState(true);

  // Advanced settings
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [timeout, setTimeout] = useState<number>(300);
  const [maxRetries, setMaxRetries] = useState<number>(0);
  const [organization, setOrganization] = useState('');
  const [apiVersion, setApiVersion] = useState('');
  const [customHeaders, setCustomHeaders] = useState('');
  const [rpm, setRpm] = useState<number | undefined>();
  const [tpm, setTpm] = useState<number | undefined>();
  const [proxy, setProxy] = useState('');

  // Multi-key configuration
  const [useMultiKey, setUseMultiKey] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeyFormEntry[]>([]);
  const [showKeyIndices, setShowKeyIndices] = useState<Set<number>>(new Set());

  // Routing strategy
  const [routingStrategy, setRoutingStrategy] = useState<RoutingStrategy>('simple-shuffle');

  // Health check
  const [enableHealthCheck, setEnableHealthCheck] = useState(false);
  const [checkInterval, setCheckInterval] = useState(60);
  const [cooldownPeriod, setCooldownPeriod] = useState(300);
  const [failureThreshold, setFailureThreshold] = useState(5);

  // Models
  const [showModels, setShowModels] = useState(false);
  const [llmModels, setLlmModels] = useState<ModelDefinitionEntry[]>([]);
  const [embeddingModels, setEmbeddingModels] = useState<ModelDefinitionEntry[]>([]);

  // Initialize form from provider
  useEffect(() => {
    if (provider) {
      setName(provider.name);
      setType(provider.type);
      setApiKey(provider.apiKey);
      setApiBase(provider.apiBase || '');
      setEnabled(provider.enabled);
      setRoutingStrategy(provider.routingStrategy || 'simple-shuffle');

      // Advanced settings
      if (provider.advancedSettings) {
        setTimeout(provider.advancedSettings.timeout || 300);
        setMaxRetries(provider.advancedSettings.maxRetries || 0);
        setOrganization(provider.advancedSettings.organization || '');
        setApiVersion(provider.advancedSettings.apiVersion || '');
        setCustomHeaders(provider.advancedSettings.customHeaders ? JSON.stringify(provider.advancedSettings.customHeaders, null, 2) : '');
        setRpm(provider.advancedSettings.rpm);
        setTpm(provider.advancedSettings.tpm);
        setProxy(provider.advancedSettings.proxy || '');
      }

      // Multi-key
      const hasMultiKeys = Boolean(provider.apiKeys && provider.apiKeys.length > 0);
      setUseMultiKey(hasMultiKeys);
      if (hasMultiKeys && provider.apiKeys) {
        setApiKeys(provider.apiKeys.map((k) => ({
          id: k.id,
          key: k.key,
          label: k.label,
          weight: k.weight,
          enabled: k.enabled,
        })));
      }

      // Health check
      if (provider.healthCheck) {
        setEnableHealthCheck(provider.healthCheck.enabled);
        setCheckInterval(provider.healthCheck.intervalSeconds);
        setCooldownPeriod(provider.healthCheck.cooldownSeconds);
        setFailureThreshold(provider.healthCheck.failureThreshold);
      }

      // Models
      if (provider.llmModels) {
        setLlmModels(provider.llmModels.map((m) => ({
          id: m.id,
          name: m.name,
          series: m.series,
          description: m.description,
        })));
      }
      if (provider.embeddingModels) {
        setEmbeddingModels(provider.embeddingModels.map((m) => ({
          id: m.id,
          name: m.name,
          series: m.series,
          description: m.description,
        })));
      }
    } else {
      // Reset form for new provider
      setName('');
      setType('openai');
      setApiKey('');
      setApiBase('');
      setEnabled(true);
      setTimeout(300);
      setMaxRetries(0);
      setOrganization('');
      setApiVersion('');
      setCustomHeaders('');
      setRpm(undefined);
      setTpm(undefined);
      setProxy('');
      setUseMultiKey(false);
      setApiKeys([]);
      setRoutingStrategy('simple-shuffle');
      setEnableHealthCheck(false);
      setCheckInterval(60);
      setCooldownPeriod(300);
      setFailureThreshold(5);
      setLlmModels([]);
      setEmbeddingModels([]);
    }
  }, [provider, open]);

  // Handlers
  const handleAddKey = () => {
    const newKey: ApiKeyFormEntry = {
      id: `key-${Date.now()}`,
      key: '',
      label: `Key ${apiKeys.length + 1}`,
      weight: 1,
      enabled: true,
    };
    setApiKeys([...apiKeys, newKey]);
  };

  const handleUpdateKey = (index: number, updates: Partial<ApiKeyFormEntry>) => {
    setApiKeys(apiKeys.map((k, i) => (i === index ? { ...k, ...updates } : k)));
  };

  const handleRemoveKey = (index: number) => {
    setApiKeys(apiKeys.filter((_, i) => i !== index));
  };

  const handleToggleShowKey = (index: number) => {
    setShowKeyIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleAddLlmModel = () => {
    const newModel: ModelDefinitionEntry = {
      id: `llm-${Date.now()}`,
      name: '',
      series: '',
    };
    setLlmModels([...llmModels, newModel]);
  };

  const handleRemoveLlmModel = (index: number) => {
    setLlmModels(llmModels.filter((_, i) => i !== index));
  };

  const handleUpdateLlmModel = (index: number, field: keyof ModelDefinitionEntry, value: string | number | boolean | undefined) => {
    setLlmModels(llmModels.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const handleAddEmbeddingModel = () => {
    const newModel: ModelDefinitionEntry = {
      id: `emb-${Date.now()}`,
      name: '',
      series: '',
    };
    setEmbeddingModels([...embeddingModels, newModel]);
  };

  const handleRemoveEmbeddingModel = (index: number) => {
    setEmbeddingModels(embeddingModels.filter((_, i) => i !== index));
  };

  const handleUpdateEmbeddingModel = (index: number, field: keyof ModelDefinitionEntry, value: string | number | boolean | undefined) => {
    setEmbeddingModels(embeddingModels.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const handleSubmit = async () => {
    try {
      // Validate custom headers JSON
      let parsedHeaders: Record<string, string> | undefined;
      if (customHeaders.trim()) {
        try {
          parsedHeaders = JSON.parse(customHeaders);
        } catch {
          alert(formatMessage({ id: 'apiSettings.messages.invalidJsonHeaders' }));
          return;
        }
      }

      const now = new Date().toISOString();

      const providerData = {
        name,
        type,
        apiKey: useMultiKey ? '' : apiKey,
        apiBase: apiBase || undefined,
        enabled,
        advancedSettings: {
          timeout,
          maxRetries,
          organization: organization || undefined,
          apiVersion: apiVersion || undefined,
          customHeaders: parsedHeaders,
          rpm,
          tpm,
          proxy: proxy || undefined,
        },
        apiKeys: useMultiKey ? apiKeys.map((k) => ({
          id: k.id,
          key: k.key,
          label: k.label,
          weight: k.weight,
          enabled: k.enabled,
        })) : undefined,
        routingStrategy: useMultiKey ? routingStrategy : undefined,
        healthCheck: enableHealthCheck ? {
          enabled: true,
          intervalSeconds: checkInterval,
          cooldownSeconds: cooldownPeriod,
          failureThreshold,
        } : undefined,
        llmModels: llmModels.filter((m) => m.name.trim()).map((m) => ({
          id: m.id,
          name: m.name,
          type: 'llm' as const,
          series: m.series || m.name.split('-')[0],
          enabled: true,
          createdAt: now,
          updatedAt: now,
        })),
        embeddingModels: embeddingModels.filter((m) => m.name.trim()).map((m) => ({
          id: m.id,
          name: m.name,
          type: 'embedding' as const,
          series: m.series || m.name.split('-')[0],
          enabled: true,
          createdAt: now,
          updatedAt: now,
        })),
      };

      if (isEditing && provider) {
        await updateProvider(provider.id, providerData);
      } else {
        await createProvider(providerData);
      }

      onClose();
    } catch (err) {
      error(formatMessage({ id: 'apiSettings.providers.saveError' }));
    }
  };

  const isSaving = isCreating || isUpdating;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? formatMessage({ id: 'apiSettings.providers.actions.edit' })
              : formatMessage({ id: 'apiSettings.providers.actions.add' })}
          </DialogTitle>
          <DialogDescription>
            {formatMessage({ id: 'apiSettings.providers.description' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">{formatMessage({ id: 'apiSettings.providers.basicInfo' })}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{formatMessage({ id: 'apiSettings.providers.displayName' })} *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My OpenAI"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">{formatMessage({ id: 'apiSettings.common.type' })} *</Label>
                <Select value={type} onValueChange={(v: ProviderType) => setType(v)}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!useMultiKey && (
              <div className="space-y-2">
                <Label htmlFor="apiKey">{formatMessage({ id: 'apiSettings.providers.apiKey' })} *</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                />
                <p className="text-xs text-muted-foreground">{formatMessage({ id: 'apiSettings.providers.useEnvVar' })}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="apiBase">{formatMessage({ id: 'apiSettings.providers.apiBaseUrl' })}</Label>
              <Input
                id="apiBase"
                value={apiBase}
                onChange={(e) => setApiBase(e.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
              <Label htmlFor="enabled">{formatMessage({ id: 'apiSettings.providers.enableProvider' })}</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="useMultiKey"
                checked={useMultiKey}
                onCheckedChange={setUseMultiKey}
              />
              <Label htmlFor="useMultiKey">{formatMessage({ id: 'apiSettings.providers.multiKeySettings' })}</Label>
            </div>
          </div>

          {/* Multi-Key Configuration */}
          {useMultiKey && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{formatMessage({ id: 'apiSettings.providers.multiKeySettings' })}</h3>
                <Button type="button" size="sm" onClick={handleAddKey}>
                  <Plus className="w-4 h-4 mr-2" />
                  {formatMessage({ id: 'apiSettings.providers.addKey' })}
                </Button>
              </div>

              {apiKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground">{formatMessage({ id: 'apiSettings.providers.noModels' })}</p>
              ) : (
                <div className="space-y-2">
                  {apiKeys.map((entry, index) => (
                    <ApiKeyEntryRow
                      key={entry.id}
                      entry={entry}
                      showKey={showKeyIndices.has(index)}
                      onToggleShowKey={() => handleToggleShowKey(index)}
                      onUpdate={(updates) => handleUpdateKey(index, updates)}
                      onRemove={() => handleRemoveKey(index)}
                    />
                  ))}
                </div>
              )}

              {/* Routing Strategy */}
              <div className="space-y-2">
                <Label htmlFor="routingStrategy">{formatMessage({ id: 'apiSettings.providers.routingStrategy' })}</Label>
                <Select value={routingStrategy} onValueChange={(v: RoutingStrategy) => setRoutingStrategy(v)}>
                  <SelectTrigger id="routingStrategy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple-shuffle">{formatMessage({ id: 'apiSettings.providers.simpleShuffle' })}</SelectItem>
                    <SelectItem value="weighted">{formatMessage({ id: 'apiSettings.providers.weighted' })}</SelectItem>
                    <SelectItem value="latency-based">{formatMessage({ id: 'apiSettings.providers.latencyBased' })}</SelectItem>
                    <SelectItem value="cost-based">{formatMessage({ id: 'apiSettings.providers.costBased' })}</SelectItem>
                    <SelectItem value="least-busy">{formatMessage({ id: 'apiSettings.providers.leastBusy' })}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Health Check */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{formatMessage({ id: 'apiSettings.providers.healthCheck' })}</Label>
                  <Switch
                    checked={enableHealthCheck}
                    onCheckedChange={setEnableHealthCheck}
                  />
                </div>
                {enableHealthCheck && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="checkInterval">{formatMessage({ id: 'apiSettings.providers.checkInterval' })}</Label>
                      <Input
                        id="checkInterval"
                        type="number"
                        min="10"
                        value={checkInterval}
                        onChange={(e) => setCheckInterval(parseInt(e.target.value) || 60)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cooldownPeriod">{formatMessage({ id: 'apiSettings.providers.cooldownPeriod' })}</Label>
                      <Input
                        id="cooldownPeriod"
                        type="number"
                        min="10"
                        value={cooldownPeriod}
                        onChange={(e) => setCooldownPeriod(parseInt(e.target.value) || 300)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="failureThreshold">{formatMessage({ id: 'apiSettings.providers.failureThreshold' })}</Label>
                      <Input
                        id="failureThreshold"
                        type="number"
                        min="1"
                        value={failureThreshold}
                        onChange={(e) => setFailureThreshold(parseInt(e.target.value) || 5)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Advanced Settings */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="w-full justify-between">
                <span className="font-semibold">{formatMessage({ id: 'apiSettings.providers.advancedSettings' })}</span>
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timeout">{formatMessage({ id: 'apiSettings.providers.timeout' })}</Label>
                  <Input
                    id="timeout"
                    type="number"
                    min="1"
                    value={timeout}
                    onChange={(e) => setTimeout(parseInt(e.target.value) || 300)}
                  />
                  <p className="text-xs text-muted-foreground">{formatMessage({ id: 'apiSettings.providers.timeoutHint' })}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxRetries">{formatMessage({ id: 'apiSettings.providers.maxRetries' })}</Label>
                  <Input
                    id="maxRetries"
                    type="number"
                    min="0"
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization">{formatMessage({ id: 'apiSettings.providers.organization' })}</Label>
                  <Input
                    id="organization"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{formatMessage({ id: 'apiSettings.providers.organizationHint' })}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="apiVersion">{formatMessage({ id: 'apiSettings.providers.apiVersion' })}</Label>
                  <Input
                    id="apiVersion"
                    value={apiVersion}
                    onChange={(e) => setApiVersion(e.target.value)}
                    placeholder="2024-02-01"
                  />
                  <p className="text-xs text-muted-foreground">{formatMessage({ id: 'apiSettings.providers.apiVersionHint' })}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rpm">{formatMessage({ id: 'apiSettings.providers.rpm' })}</Label>
                  <Input
                    id="rpm"
                    type="number"
                    min="0"
                    value={rpm ?? ''}
                    onChange={(e) => setRpm(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder={formatMessage({ id: 'apiSettings.providers.unlimited' })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tpm">{formatMessage({ id: 'apiSettings.providers.tpm' })}</Label>
                  <Input
                    id="tpm"
                    type="number"
                    min="0"
                    value={tpm ?? ''}
                    onChange={(e) => setTpm(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder={formatMessage({ id: 'apiSettings.providers.unlimited' })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proxy">{formatMessage({ id: 'apiSettings.providers.proxy' })}</Label>
                <Input
                  id="proxy"
                  value={proxy}
                  onChange={(e) => setProxy(e.target.value)}
                  placeholder="http://proxy.example.com:8080"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customHeaders">{formatMessage({ id: 'apiSettings.providers.customHeaders' })}</Label>
                <Textarea
                  id="customHeaders"
                  value={customHeaders}
                  onChange={(e) => setCustomHeaders(e.target.value)}
                  placeholder={`{\n  "X-Custom": "value"\n}`}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">{formatMessage({ id: 'apiSettings.providers.customHeadersHint' })}</p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Model Configuration */}
          <Collapsible open={showModels} onOpenChange={setShowModels}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="w-full justify-between">
                <span className="font-semibold">{formatMessage({ id: 'apiSettings.providers.modelSettings' })}</span>
                {showModels ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              {/* LLM Models */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">{formatMessage({ id: 'apiSettings.providers.llmModels' })}</h4>
                  <Button type="button" size="sm" onClick={handleAddLlmModel}>
                    <Plus className="w-4 h-4 mr-2" />
                    {formatMessage({ id: 'apiSettings.providers.addLlmModel' })}
                  </Button>
                </div>
                {llmModels.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{formatMessage({ id: 'apiSettings.providers.noModels' })}</p>
                ) : (
                  <div className="space-y-2">
                    {llmModels.map((model, index) => (
                      <div key={model.id} className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <Input
                            value={model.name}
                            onChange={(e) => handleUpdateLlmModel(index, 'name', e.target.value)}
                            placeholder={formatMessage({ id: 'apiSettings.providers.modelId' })}
                          />
                          <Input
                            value={model.series || ''}
                            onChange={(e) => handleUpdateLlmModel(index, 'series', e.target.value)}
                            placeholder={formatMessage({ id: 'apiSettings.providers.modelSeries' })}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveLlmModel(index)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Embedding Models */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">{formatMessage({ id: 'apiSettings.providers.embeddingModels' })}</h4>
                  <Button type="button" size="sm" onClick={handleAddEmbeddingModel}>
                    <Plus className="w-4 h-4 mr-2" />
                    {formatMessage({ id: 'apiSettings.providers.addEmbeddingModel' })}
                  </Button>
                </div>
                {embeddingModels.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{formatMessage({ id: 'apiSettings.providers.noModels' })}</p>
                ) : (
                  <div className="space-y-2">
                    {embeddingModels.map((model, index) => (
                      <div key={model.id} className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <Input
                            value={model.name}
                            onChange={(e) => handleUpdateEmbeddingModel(index, 'name', e.target.value)}
                            placeholder={formatMessage({ id: 'apiSettings.providers.modelId' })}
                          />
                          <Input
                            value={model.series || ''}
                            onChange={(e) => handleUpdateEmbeddingModel(index, 'series', e.target.value)}
                            placeholder={formatMessage({ id: 'apiSettings.providers.modelSeries' })}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveEmbeddingModel(index)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            {formatMessage({ id: 'apiSettings.common.cancel' })}
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || !name.trim()}>
            {isSaving ? (
              <Zap className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            {formatMessage({ id: 'apiSettings.common.save' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ProviderModal;
