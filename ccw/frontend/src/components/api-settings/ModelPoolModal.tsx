// ========================================
// Model Pool Modal Component
// ========================================
// Add/Edit model pool modal with auto-discovery

import { useState, useEffect, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Save,
  X,
  Zap,
  Loader2,
  Info,
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
import { Checkbox } from '@/components/ui/Checkbox';
import {
  useCreateModelPool,
  useUpdateModelPool,
  useDiscoverModelsForPool,
  useAvailableModelsForPool,
} from '@/hooks/useApiSettings';
import { useNotifications } from '@/hooks/useNotifications';
import type { ModelPoolConfig, ModelPoolType, DiscoveredProvider } from '@/lib/api';

// ========== Types ==========

export interface ModelPoolModalProps {
  open: boolean;
  onClose: () => void;
  pool?: ModelPoolConfig | null;
}

interface FormData {
  modelType: ModelPoolType | '';
  targetModel: string;
  strategy: 'round_robin' | 'latency_aware' | 'weighted_random';
  autoDiscover: boolean;
  excludedProviderIds: string[];
  defaultCooldown: number;
  defaultMaxConcurrentPerKey: number;
  name: string;
  description: string;
}

const defaultFormData: FormData = {
  modelType: '',
  targetModel: '',
  strategy: 'round_robin',
  autoDiscover: true,
  excludedProviderIds: [],
  defaultCooldown: 60,
  defaultMaxConcurrentPerKey: 5,
  name: '',
  description: '',
};

// ========== Helper Components ==========

interface ProviderDiscoveryItemProps {
  provider: DiscoveredProvider;
  excluded: boolean;
  onToggle: (providerId: string) => void;
}

function ProviderDiscoveryItem({ provider, excluded, onToggle }: ProviderDiscoveryItemProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`provider-${provider.providerId}`}
            checked={!excluded}
            onCheckedChange={() => onToggle(provider.providerId)}
          />
          <Label
            htmlFor={`provider-${provider.providerId}`}
            className="font-medium cursor-pointer"
          >
            {provider.providerName}
          </Label>
        </div>
        <div className="ml-6 mt-1 flex flex-wrap gap-1">
          {provider.models.map((model) => (
            <span
              key={model}
              className="text-xs px-2 py-0.5 bg-background rounded text-muted-foreground"
            >
              {model}
            </span>
          ))}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onToggle(provider.providerId)}
      >
        {excluded ? (
          <span className="text-xs text-muted-foreground">
            {formatMessage({ id: 'apiSettings.modelPools.excludeProvider' })}
          </span>
        ) : (
          <span className="text-xs text-primary">
            {formatMessage({ id: 'apiSettings.modelPools.includeProvider' })}
          </span>
        )}
      </Button>
    </div>
  );
}

// ========== Main Component ==========

export function ModelPoolModal({ open, onClose, pool }: ModelPoolModalProps) {
  const { formatMessage } = useIntl();
  const { success, error, warning } = useNotifications();

  // Form state
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [hasDiscovered, setHasDiscovered] = useState(false);

  // Mutations and queries
  const { createModelPool, isCreating } = useCreateModelPool();
  const { updateModelPool, isUpdating } = useUpdateModelPool();
  const { discoverModels, isDiscovering, data: discoveredResponse } = useDiscoverModelsForPool();
  const { data: availableModelsResponse, isLoading: isLoadingModels } = useAvailableModelsForPool(
    (formData.modelType as ModelPoolType | '') || ('embedding' as ModelPoolType)
  );

  const isEdit = !!pool;
  const isLoading = isCreating || isUpdating;

  // Initialize form from pool (edit mode)
  useEffect(() => {
    if (pool) {
      setFormData({
        modelType: pool.modelType,
        targetModel: pool.targetModel,
        strategy: pool.strategy,
        autoDiscover: pool.autoDiscover,
        excludedProviderIds: pool.excludedProviderIds ?? [],
        defaultCooldown: pool.defaultCooldown,
        defaultMaxConcurrentPerKey: pool.defaultMaxConcurrentPerKey,
        name: pool.name ?? '',
        description: pool.description ?? '',
      });
    } else {
      setFormData(defaultFormData);
    }
    setHasDiscovered(false);
  }, [pool, open]);

  // Handle input change
  const handleInputChange = <K extends keyof FormData>(
    key: K,
    value: FormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    // Reset discovered state when model type or target model changes
    if (key === 'modelType' || key === 'targetModel') {
      setHasDiscovered(false);
    }
  };

  // Handle auto-discover
  const handleAutoDiscover = async () => {
    if (!formData.modelType || !formData.targetModel) {
      warning(
        'Please select model type and target model first'
      );
      return;
    }

    try {
      await discoverModels(formData.modelType as ModelPoolType, formData.targetModel);
      setHasDiscovered(true);
    } catch (err) {
      error(
        formatMessage({ id: 'common.error' }),
        err instanceof Error ? err.message : 'Failed to discover providers'
      );
    }
  };

  // Toggle provider exclusion
  const handleToggleProvider = (providerId: string) => {
    setFormData((prev) => ({
      ...prev,
      excludedProviderIds: prev.excludedProviderIds.includes(providerId)
        ? prev.excludedProviderIds.filter((id) => id !== providerId)
        : [...prev.excludedProviderIds, providerId],
    }));
  };

  // Validate form
  const isValid = useMemo(() => {
    return !!formData.modelType && !!formData.targetModel;
  }, [formData.modelType, formData.targetModel]);

  // Handle submit
  const handleSubmit = async () => {
    if (!isValid) return;

    try {
      const poolData: Omit<ModelPoolConfig, 'id'> = {
        modelType: formData.modelType as ModelPoolType,
        targetModel: formData.targetModel,
        strategy: formData.strategy,
        autoDiscover: formData.autoDiscover,
        excludedProviderIds: formData.excludedProviderIds,
        defaultCooldown: formData.defaultCooldown,
        defaultMaxConcurrentPerKey: formData.defaultMaxConcurrentPerKey,
        name: formData.name || undefined,
        description: formData.description || undefined,
        enabled: true,
      };

      if (isEdit && pool) {
        await updateModelPool(pool.id, poolData);
      } else {
        await createModelPool(poolData);
      }

      success(
        formatMessage({ id: 'apiSettings.modelPools.poolSaved' })
      );
      onClose();
    } catch (err) {
      error(
        formatMessage({ id: 'common.error' }),
        err instanceof Error ? err.message : 'Failed to save model pool'
      );
    }
  };

  // Extract discovered providers from response
  const discoveredProviders = discoveredResponse?.discovered ?? [];

  // Count included providers
  const includedCount = useMemo(() => {
    if (!discoveredResponse || !discoveredProviders) return 0;
    return discoveredProviders.length - formData.excludedProviderIds.filter(
      (id) => discoveredProviders.some((p) => p.providerId === id)
    ).length;
  }, [discoveredResponse, discoveredProviders, formData.excludedProviderIds]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? formatMessage({ id: 'apiSettings.modelPools.actions.edit' })
              : formatMessage({ id: 'apiSettings.modelPools.actions.add' })}
          </DialogTitle>
          <DialogDescription>
            {formatMessage({ id: 'apiSettings.modelPools.embeddingPoolDesc' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Model Type */}
          <div className="space-y-2">
            <Label htmlFor="pool-model-type">
              {formatMessage({ id: 'apiSettings.modelPools.modelType' })} *
            </Label>
            <Select
              value={formData.modelType}
              onValueChange={(value) => handleInputChange('modelType', value as ModelPoolType)}
              disabled={isEdit}
            >
              <SelectTrigger id="pool-model-type">
                <SelectValue placeholder={formatMessage({ id: 'apiSettings.modelPools.selectTargetModel' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="embedding">
                  {formatMessage({ id: 'apiSettings.modelPools.embedding' })}
                </SelectItem>
                <SelectItem value="llm">
                  {formatMessage({ id: 'apiSettings.modelPools.llm' })}
                </SelectItem>
                <SelectItem value="reranker">
                  {formatMessage({ id: 'apiSettings.modelPools.reranker' })}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Target Model */}
          <div className="space-y-2">
            <Label htmlFor="pool-target-model">
              {formatMessage({ id: 'apiSettings.modelPools.targetModel' })} *
            </Label>
            {isLoadingModels ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                {formatMessage({ id: 'common.loading' })}
              </div>
            ) : (
              <Select
                value={formData.targetModel}
                onValueChange={(value) => handleInputChange('targetModel', value)}
                disabled={!formData.modelType}
              >
                <SelectTrigger id="pool-target-model">
                  <SelectValue placeholder={formatMessage({ id: 'apiSettings.modelPools.selectTargetModel' })} />
                </SelectTrigger>
                <SelectContent>
                  {availableModelsResponse?.availableModels?.map((model) => (
                    <SelectItem key={model.modelId} value={model.modelId}>
                      {model.modelName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Strategy */}
          <div className="space-y-2">
            <Label htmlFor="pool-strategy">
              {formatMessage({ id: 'apiSettings.modelPools.strategy' })}
            </Label>
            <Select
              value={formData.strategy}
              onValueChange={(value) => handleInputChange('strategy', value as FormData['strategy'])}
            >
              <SelectTrigger id="pool-strategy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="round_robin">
                  {formatMessage({ id: 'apiSettings.modelPools.roundRobin' })}
                </SelectItem>
                <SelectItem value="latency_aware">
                  {formatMessage({ id: 'apiSettings.modelPools.latencyAware' })}
                </SelectItem>
                <SelectItem value="weighted_random">
                  {formatMessage({ id: 'apiSettings.modelPools.weightedRandom' })}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Auto-Discover Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="pool-auto-discover">
                {formatMessage({ id: 'apiSettings.modelPools.autoDiscover' })}
              </Label>
              <p className="text-xs text-muted-foreground">
                Automatically find providers offering this model
              </p>
            </div>
            <Switch
              id="pool-auto-discover"
              checked={formData.autoDiscover}
              onCheckedChange={(checked) => handleInputChange('autoDiscover', checked)}
            />
          </div>

          {/* Auto-Discover Button and Results */}
          {formData.autoDiscover && formData.modelType && formData.targetModel && (
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleAutoDiscover}
                disabled={isDiscovering}
                className="w-full"
              >
                {isDiscovering ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {formatMessage({ id: 'common.loading' })}
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    {formatMessage({ id: 'apiSettings.modelPools.actions.autoDiscover' })}
                  </>
                )}
              </Button>

              {hasDiscovered && discoveredProviders.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Info className="w-4 h-4" />
                    <span>
                      {formatMessage({ id: 'apiSettings.modelPools.discovered' })}{' '}
                      {discoveredProviders.length}{' '}
                      {formatMessage({ id: 'apiSettings.modelPools.providers' })} •{' '}
                      {includedCount} {formatMessage({ id: 'apiSettings.modelPools.discovered' }).toLowerCase()}
                    </span>
                  </div>
                  {discoveredProviders.map((provider) => (
                    <ProviderDiscoveryItem
                      key={provider.providerId}
                      provider={provider}
                      excluded={formData.excludedProviderIds.includes(provider.providerId)}
                      onToggle={handleToggleProvider}
                    />
                  ))}
                </div>
              )}

              {hasDiscovered && discoveredProviders.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-sm">
                    {formatMessage({ id: 'apiSettings.modelPools.noProvidersFound' })}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Cooldown and Concurrent */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pool-cooldown">
                {formatMessage({ id: 'apiSettings.modelPools.defaultCooldown' })}
              </Label>
              <Input
                id="pool-cooldown"
                type="number"
                min={0}
                value={formData.defaultCooldown}
                onChange={(e) => handleInputChange('defaultCooldown', parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pool-concurrent">
                {formatMessage({ id: 'apiSettings.modelPools.defaultConcurrent' })}
              </Label>
              <Input
                id="pool-concurrent"
                type="number"
                min={1}
                value={formData.defaultMaxConcurrentPerKey}
                onChange={(e) => handleInputChange('defaultMaxConcurrentPerKey', parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          {/* Name and Description */}
          <div className="space-y-2">
            <Label htmlFor="pool-name">
              {formatMessage({ id: 'apiSettings.common.name' })}
            </Label>
            <Input
              id="pool-name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder={formatMessage({ id: 'apiSettings.common.optional' })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pool-description">
              {formatMessage({ id: 'apiSettings.common.description' })}
            </Label>
            <Textarea
              id="pool-description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder={formatMessage({ id: 'apiSettings.common.optional' })}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            <X className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'common.cancel' })}
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {formatMessage({ id: 'common.loading' })}
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'common.save' })}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
