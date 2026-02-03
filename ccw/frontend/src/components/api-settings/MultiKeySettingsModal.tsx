// ========================================
// Multi-Key Settings Modal Component
// ========================================
// Modal for managing multiple API keys per provider

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import {
  Check,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Zap,
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
import { Switch } from '@/components/ui/Switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { useProviders, useUpdateProvider } from '@/hooks/useApiSettings';
import { useNotifications } from '@/hooks/useNotifications';
import type { RoutingStrategy } from '@/lib/api';

// ========== Types ==========

export interface MultiKeySettingsModalProps {
  open: boolean;
  onClose: () => void;
  providerId: string;
}

interface ApiKeyFormEntry {
  id: string;
  key: string;
  label?: string;
  weight?: number;
  enabled: boolean;
}

// ========== Helper Components ==========

interface ApiKeyEntryRowProps {
  entry: ApiKeyFormEntry;
  showKey: boolean;
  onToggleShowKey: () => void;
  onUpdate: (updates: Partial<ApiKeyFormEntry>) => void;
  onRemove: () => void;
  index: number;
}

function ApiKeyEntryRow({
  entry,
  showKey,
  onToggleShowKey,
  onUpdate,
  onRemove,
  index,
}: ApiKeyEntryRowProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="grid grid-cols-12 gap-2 items-start p-3 bg-muted/30 rounded-lg">
      <div className="col-span-3">
        <Label className="text-xs">{formatMessage({ id: 'apiSettings.providers.keyLabel' })}</Label>
        <Input
          value={entry.label || ''}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder={`Key ${index + 1}`}
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
          {entry.enabled
            ? formatMessage({ id: 'apiSettings.common.enabled' })
            : formatMessage({ id: 'apiSettings.common.disabled' })}
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

export function MultiKeySettingsModal({ open, onClose, providerId }: MultiKeySettingsModalProps) {
  const { formatMessage } = useIntl();
  const { success, error } = useNotifications();
  const { providers } = useProviders();
  const { updateProvider, isUpdating } = useUpdateProvider();

  // Find provider
  const provider = providers.find((p) => p.id === providerId);

  // Form state
  const [apiKeys, setApiKeys] = useState<ApiKeyFormEntry[]>([]);
  const [showKeyIndices, setShowKeyIndices] = useState<Set<number>>(new Set());
  const [routingStrategy, setRoutingStrategy] = useState<RoutingStrategy>('simple-shuffle');

  // Health check state
  const [enableHealthCheck, setEnableHealthCheck] = useState(false);
  const [checkInterval, setCheckInterval] = useState(60);
  const [cooldownPeriod, setCooldownPeriod] = useState(300);
  const [failureThreshold, setFailureThreshold] = useState(5);

  // Initialize form from provider
  useEffect(() => {
    if (provider) {
      const hasMultiKeys = Boolean(provider.apiKeys && provider.apiKeys.length > 0);
      if (hasMultiKeys && provider.apiKeys) {
        setApiKeys(provider.apiKeys.map((k) => ({
          id: k.id,
          key: k.key,
          label: k.label,
          weight: k.weight,
          enabled: k.enabled,
        })));
      } else if (provider.apiKey) {
        // Convert single key to multi-key format
        setApiKeys([{
          id: 'key-1',
          key: provider.apiKey,
          label: 'Key 1',
          weight: 1,
          enabled: true,
        }]);
      } else {
        setApiKeys([]);
      }

      setRoutingStrategy(provider.routingStrategy || 'simple-shuffle');

      // Health check
      if (provider.healthCheck) {
        setEnableHealthCheck(provider.healthCheck.enabled);
        setCheckInterval(provider.healthCheck.intervalSeconds);
        setCooldownPeriod(provider.healthCheck.cooldownSeconds);
        setFailureThreshold(provider.healthCheck.failureThreshold);
      }
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

  const handleSave = async () => {
    if (!provider) return;

    try {
      await updateProvider(providerId, {
        apiKey: '', // Clear single key when using multi-key
        apiKeys: apiKeys.map((k) => ({
          id: k.id,
          key: k.key,
          label: k.label,
          weight: k.weight,
          enabled: k.enabled,
        })),
        routingStrategy,
        healthCheck: enableHealthCheck ? {
          enabled: true,
          intervalSeconds: checkInterval,
          cooldownSeconds: cooldownPeriod,
          failureThreshold,
        } : undefined,
      });

      success(formatMessage({ id: 'apiSettings.providers.actions.save' }));
      onClose();
    } catch (err) {
      error(formatMessage({ id: 'apiSettings.providers.saveError' }));
    }
  };

  if (!provider) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{formatMessage({ id: 'apiSettings.providers.multiKeySettings' })}</DialogTitle>
          <DialogDescription>
            {formatMessage({ id: 'apiSettings.providers.description' })}: {provider.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* API Keys */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{formatMessage({ id: 'apiSettings.providers.actions.multiKeySettings' })}</h3>
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
                    index={index}
                  />
                ))}
              </div>
            )}
          </div>

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

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isUpdating}>
            {formatMessage({ id: 'apiSettings.common.cancel' })}
          </Button>
          <Button onClick={handleSave} disabled={isUpdating || apiKeys.length === 0}>
            {isUpdating ? (
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

export default MultiKeySettingsModal;
