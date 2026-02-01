// ========================================
// CodexLens Settings Tab
// ========================================
// Configuration form for basic CodexLens settings

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Save, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { useCodexLensConfig, useUpdateCodexLensConfig } from '@/hooks';
import { useNotifications } from '@/hooks';
import { cn } from '@/lib/utils';

interface SettingsTabProps {
  enabled?: boolean;
}

interface FormErrors {
  index_dir?: string;
  api_max_workers?: string;
  api_batch_size?: string;
}

export function SettingsTab({ enabled = true }: SettingsTabProps) {
  const { formatMessage } = useIntl();
  const { success, error: showError } = useNotifications();

  const {
    config,
    indexCount,
    apiMaxWorkers,
    apiBatchSize,
    isLoading: isLoadingConfig,
    refetch,
  } = useCodexLensConfig({ enabled });

  const { updateConfig, isUpdating } = useUpdateCodexLensConfig();

  // Form state
  const [formData, setFormData] = useState({
    index_dir: '',
    api_max_workers: 4,
    api_batch_size: 8,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form from config
  useEffect(() => {
    if (config) {
      setFormData({
        index_dir: config.index_dir || '',
        api_max_workers: config.api_max_workers || 4,
        api_batch_size: config.api_batch_size || 8,
      });
      setErrors({});
      setHasChanges(false);
    }
  }, [config]);

  const handleFieldChange = (field: keyof typeof formData, value: string | number) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      // Check if there are changes
      if (config) {
        const changed =
          newData.index_dir !== config.index_dir ||
          newData.api_max_workers !== config.api_max_workers ||
          newData.api_batch_size !== config.api_batch_size;
        setHasChanges(changed);
      }
      return newData;
    });
    // Clear error for this field
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Index dir required
    if (!formData.index_dir.trim()) {
      newErrors.index_dir = formatMessage({ id: 'codexlens.settings.validation.indexDirRequired' });
    }

    // API max workers: 1-32
    if (formData.api_max_workers < 1 || formData.api_max_workers > 32) {
      newErrors.api_max_workers = formatMessage({ id: 'codexlens.settings.validation.maxWorkersRange' });
    }

    // API batch size: 1-64
    if (formData.api_batch_size < 1 || formData.api_batch_size > 64) {
      newErrors.api_batch_size = formatMessage({ id: 'codexlens.settings.validation.batchSizeRange' });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const result = await updateConfig({
        index_dir: formData.index_dir,
        api_max_workers: formData.api_max_workers,
        api_batch_size: formData.api_batch_size,
      });

      if (result.success) {
        success(
          formatMessage({ id: 'codexlens.settings.saveSuccess' }),
          result.message || formatMessage({ id: 'codexlens.settings.configUpdated' })
        );
        refetch();
      } else {
        showError(
          formatMessage({ id: 'codexlens.settings.saveFailed' }),
          result.message || formatMessage({ id: 'codexlens.settings.saveError' })
        );
      }
    } catch (err) {
      showError(
        formatMessage({ id: 'codexlens.settings.saveFailed' }),
        err instanceof Error ? err.message : formatMessage({ id: 'codexlens.settings.unknownError' })
      );
    }
  };

  const handleReset = () => {
    if (config) {
      setFormData({
        index_dir: config.index_dir || '',
        api_max_workers: config.api_max_workers || 4,
        api_batch_size: config.api_batch_size || 8,
      });
      setErrors({});
      setHasChanges(false);
    }
  };

  const isLoading = isLoadingConfig;

  return (
    <div className="space-y-6">
      {/* Current Info Card */}
      <Card className="p-4 bg-muted/30">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">{formatMessage({ id: 'codexlens.settings.currentCount' })}</span>
            <p className="text-foreground font-medium">{indexCount}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{formatMessage({ id: 'codexlens.settings.currentWorkers' })}</span>
            <p className="text-foreground font-medium">{apiMaxWorkers}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{formatMessage({ id: 'codexlens.settings.currentBatchSize' })}</span>
            <p className="text-foreground font-medium">{apiBatchSize}</p>
          </div>
        </div>
      </Card>

      {/* Configuration Form */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          {formatMessage({ id: 'codexlens.settings.configTitle' })}
        </h3>

        <div className="space-y-4">
          {/* Index Directory */}
          <div className="space-y-2">
            <Label htmlFor="index_dir">
              {formatMessage({ id: 'codexlens.settings.indexDir.label' })}
            </Label>
            <Input
              id="index_dir"
              value={formData.index_dir}
              onChange={(e) => handleFieldChange('index_dir', e.target.value)}
              placeholder={formatMessage({ id: 'codexlens.settings.indexDir.placeholder' })}
              error={!!errors.index_dir}
              disabled={isLoading}
            />
            {errors.index_dir && (
              <p className="text-sm text-destructive">{errors.index_dir}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'codexlens.settings.indexDir.hint' })}
            </p>
          </div>

          {/* API Max Workers */}
          <div className="space-y-2">
            <Label htmlFor="api_max_workers">
              {formatMessage({ id: 'codexlens.settings.maxWorkers.label' })}
            </Label>
            <Input
              id="api_max_workers"
              type="number"
              min="1"
              max="32"
              value={formData.api_max_workers}
              onChange={(e) => handleFieldChange('api_max_workers', parseInt(e.target.value) || 1)}
              error={!!errors.api_max_workers}
              disabled={isLoading}
            />
            {errors.api_max_workers && (
              <p className="text-sm text-destructive">{errors.api_max_workers}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'codexlens.settings.maxWorkers.hint' })}
            </p>
          </div>

          {/* API Batch Size */}
          <div className="space-y-2">
            <Label htmlFor="api_batch_size">
              {formatMessage({ id: 'codexlens.settings.batchSize.label' })}
            </Label>
            <Input
              id="api_batch_size"
              type="number"
              min="1"
              max="64"
              value={formData.api_batch_size}
              onChange={(e) => handleFieldChange('api_batch_size', parseInt(e.target.value) || 1)}
              error={!!errors.api_batch_size}
              disabled={isLoading}
            />
            {errors.api_batch_size && (
              <p className="text-sm text-destructive">{errors.api_batch_size}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'codexlens.settings.batchSize.hint' })}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-6">
          <Button
            onClick={handleSave}
            disabled={isLoading || isUpdating || !hasChanges}
          >
            <Save className={cn('w-4 h-4 mr-2', isUpdating && 'animate-spin')} />
            {isUpdating
              ? formatMessage({ id: 'codexlens.settings.saving' })
              : formatMessage({ id: 'codexlens.settings.save' })
            }
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isLoading || !hasChanges}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'codexlens.settings.reset' })}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default SettingsTab;
