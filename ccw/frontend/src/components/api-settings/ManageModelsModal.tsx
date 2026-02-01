// ========================================
// Manage Models Modal Component
// ========================================
// Modal for viewing and managing models available for a provider

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import {
  Check,
  Plus,
  Trash2,
  Zap,
  ChevronDown,
  ChevronUp,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/Collapsible';
import { Badge } from '@/components/ui/Badge';
import { useProviders, useUpdateProvider } from '@/hooks/useApiSettings';
import { useNotifications } from '@/hooks/useNotifications';
import type { ModelDefinition } from '@/lib/api';

// ========== Types ==========

export interface ManageModelsModalProps {
  open: boolean;
  onClose: () => void;
  providerId: string;
}

interface ModelFormEntry {
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

interface ModelEntryRowProps {
  model: ModelFormEntry;
  onRemove: () => void;
  onUpdate: (field: keyof ModelFormEntry, value: string | number | boolean | undefined) => void;
  index: number;
}

function ModelEntryRow({
  model,
  onRemove,
  onUpdate,
  index,
}: ModelEntryRowProps) {
  const { formatMessage } = useIntl();
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 grid grid-cols-2 gap-2">
          <Input
            value={model.name}
            onChange={(e) => onUpdate('name', e.target.value)}
            placeholder={formatMessage({ id: 'apiSettings.providers.modelId' })}
            className="font-medium"
          />
          <Input
            value={model.series || ''}
            onChange={(e) => onUpdate('series', e.target.value)}
            placeholder={formatMessage({ id: 'apiSettings.providers.modelSeries' })}
          />
        </div>
        <div className="flex items-center gap-1">
          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="icon">
                {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="w-full">
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t">
                <div className="space-y-1">
                  <Label className="text-xs">{formatMessage({ id: 'apiSettings.providers.contextWindow' })}</Label>
                  <Input
                    type="number"
                    value={model.contextWindow || ''}
                    onChange={(e) => onUpdate('contextWindow', parseInt(e.target.value) || undefined)}
                    placeholder="200000"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{formatMessage({ id: 'apiSettings.providers.description' })}</Label>
                  <Input
                    value={model.description || ''}
                    onChange={(e) => onUpdate('description', e.target.value)}
                    placeholder="Optional description"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <div className="flex items-center gap-1">
                  <Switch
                    checked={model.streaming}
                    onCheckedChange={(checked) => onUpdate('streaming', checked)}
                    id={`streaming-${index}`}
                  />
                  <Label htmlFor={`streaming-${index}`} className="text-xs cursor-pointer">
                    {formatMessage({ id: 'apiSettings.providers.streaming' })}
                  </Label>
                </div>
                <div className="flex items-center gap-1">
                  <Switch
                    checked={model.functionCalling}
                    onCheckedChange={(checked) => onUpdate('functionCalling', checked)}
                    id={`fc-${index}`}
                  />
                  <Label htmlFor={`fc-${index}`} className="text-xs cursor-pointer">
                    {formatMessage({ id: 'apiSettings.providers.functionCalling' })}
                  </Label>
                </div>
                <div className="flex items-center gap-1">
                  <Switch
                    checked={model.vision}
                    onCheckedChange={(checked) => onUpdate('vision', checked)}
                    id={`vision-${index}`}
                  />
                  <Label htmlFor={`vision-${index}`} className="text-xs cursor-pointer">
                    {formatMessage({ id: 'apiSettings.providers.vision' })}
                  </Label>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
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
    </div>
  );
}

// ========== Main Component ==========

export function ManageModelsModal({ open, onClose, providerId }: ManageModelsModalProps) {
  const { formatMessage } = useIntl();
  const { showNotification } = useNotifications();
  const { providers } = useProviders();
  const { updateProvider, isUpdating } = useUpdateProvider();

  // Find provider
  const provider = providers.find((p) => p.id === providerId);

  // Form state
  const [llmModels, setLlmModels] = useState<ModelFormEntry[]>([]);
  const [embeddingModels, setEmbeddingModels] = useState<ModelFormEntry[]>([]);

  // Initialize form from provider
  useEffect(() => {
    if (provider) {
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
    }
  }, [provider, open]);

  // Handlers
  const handleAddLlmModel = () => {
    const newModel: ModelFormEntry = {
      id: `llm-${Date.now()}`,
      name: '',
      series: '',
    };
    setLlmModels([...llmModels, newModel]);
  };

  const handleRemoveLlmModel = (index: number) => {
    setLlmModels(llmModels.filter((_, i) => i !== index));
  };

  const handleUpdateLlmModel = (index: number, field: keyof ModelFormEntry, value: string | number | boolean | undefined) => {
    setLlmModels(llmModels.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const handleAddEmbeddingModel = () => {
    const newModel: ModelFormEntry = {
      id: `emb-${Date.now()}`,
      name: '',
      series: '',
    };
    setEmbeddingModels([...embeddingModels, newModel]);
  };

  const handleRemoveEmbeddingModel = (index: number) => {
    setEmbeddingModels(embeddingModels.filter((_, i) => i !== index));
  };

  const handleUpdateEmbeddingModel = (index: number, field: keyof ModelFormEntry, value: string | number | boolean | undefined) => {
    setEmbeddingModels(embeddingModels.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const handleSave = async () => {
    if (!provider) return;

    try {
      const now = new Date().toISOString();

      await updateProvider(providerId, {
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
      });

      showNotification('success', formatMessage({ id: 'apiSettings.providers.actions.save' }) + ' success');
      onClose();
    } catch (error) {
      showNotification('error', formatMessage({ id: 'apiSettings.providers.saveError' }));
    }
  };

  if (!provider) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{formatMessage({ id: 'apiSettings.providers.actions.manageModels' })}</DialogTitle>
          <DialogDescription>
            {formatMessage({ id: 'apiSettings.providers.description' })}: {provider.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* LLM Models */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{formatMessage({ id: 'apiSettings.providers.llmModels' })}</h3>
                <Badge variant="secondary">{llmModels.length}</Badge>
              </div>
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
                  <ModelEntryRow
                    key={model.id}
                    model={model}
                    onRemove={() => handleRemoveLlmModel(index)}
                    onUpdate={(field, value) => handleUpdateLlmModel(index, field, value)}
                    index={index}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Embedding Models */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{formatMessage({ id: 'apiSettings.providers.embeddingModels' })}</h3>
                <Badge variant="secondary">{embeddingModels.length}</Badge>
              </div>
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
                  <ModelEntryRow
                    key={model.id}
                    model={model}
                    onRemove={() => handleRemoveEmbeddingModel(index)}
                    onUpdate={(field, value) => handleUpdateEmbeddingModel(index, field, value)}
                    index={index}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isUpdating}>
            {formatMessage({ id: 'apiSettings.common.cancel' })}
          </Button>
          <Button onClick={handleSave} disabled={isUpdating}>
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

export default ManageModelsModal;
