// ========================================
// CLI Settings Modal Component
// ========================================
// Add/Edit CLI settings modal with provider-based and direct modes

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Check, Eye, EyeOff } from 'lucide-react';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { useCreateCliSettings, useUpdateCliSettings, useProviders } from '@/hooks/useApiSettings';
import { useNotifications } from '@/hooks/useNotifications';
import type { CliSettingsEndpoint } from '@/lib/api';

// ========== Types ==========

export interface CliSettingsModalProps {
  open: boolean;
  onClose: () => void;
  cliSettings?: CliSettingsEndpoint | null;
}

type ModeType = 'provider-based' | 'direct';

// ========== Main Component ==========

export function CliSettingsModal({ open, onClose, cliSettings }: CliSettingsModalProps) {
  const { formatMessage } = useIntl();
  const { showNotification } = useNotifications();
  const isEditing = !!cliSettings;

  // Mutations
  const { createCliSettings, isCreating } = useCreateCliSettings();
  const { updateCliSettings, isUpdating } = useUpdateCliSettings();

  // Get providers for provider-based mode
  const { providers } = useProviders();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState<ModeType>('direct');

  // Provider-based mode state
  const [providerId, setProviderId] = useState('');
  const [model, setModel] = useState('sonnet');
  const [includeCoAuthoredBy, setIncludeCoAuthoredBy] = useState(false);

  // Direct mode state
  const [authToken, setAuthToken] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showToken, setShowToken] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form from cliSettings
  useEffect(() => {
    if (cliSettings) {
      setName(cliSettings.name);
      setDescription(cliSettings.description || '');
      setEnabled(cliSettings.enabled);
      setModel(cliSettings.settings.model || 'sonnet');
      setIncludeCoAuthoredBy(cliSettings.settings.includeCoAuthoredBy || false);

      // Determine mode based on settings
      const hasCustomBaseUrl = Boolean(
        cliSettings.settings.env.ANTHROPIC_BASE_URL &&
        !cliSettings.settings.env.ANTHROPIC_BASE_URL.includes('api.anthropic.com')
      );

      if (hasCustomBaseUrl) {
        setMode('direct');
        setBaseUrl(cliSettings.settings.env.ANTHROPIC_BASE_URL || '');
        setAuthToken(cliSettings.settings.env.ANTHROPIC_AUTH_TOKEN || '');
      } else {
        setMode('provider-based');
        // Try to find matching provider
        const matchingProvider = providers.find((p) => p.apiBase === cliSettings.settings.env.ANTHROPIC_BASE_URL);
        if (matchingProvider) {
          setProviderId(matchingProvider.id);
        }
      }
    } else {
      // Reset form for new CLI settings
      setName('');
      setDescription('');
      setEnabled(true);
      setMode('direct');
      setProviderId('');
      setModel('sonnet');
      setIncludeCoAuthoredBy(false);
      setAuthToken('');
      setBaseUrl('');
      setErrors({});
    }
  }, [cliSettings, open, providers]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = formatMessage({ id: 'apiSettings.validation.nameRequired' });
    }

    if (mode === 'provider-based') {
      if (!providerId) {
        newErrors.providerId = formatMessage({ id: 'apiSettings.cliSettings.validation.providerRequired' });
      }
    } else {
      // Direct mode
      if (!authToken.trim() && !baseUrl.trim()) {
        newErrors.direct = formatMessage({ id: 'apiSettings.cliSettings.validation.authOrBaseUrlRequired' });
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      // Build settings object based on mode
      const env: Record<string, string> = {
        DISABLE_AUTOUPDATER: '1',
      };

      if (mode === 'provider-based') {
        // Provider-based mode: get settings from selected provider
        const provider = providers.find((p) => p.id === providerId);
        if (provider) {
          if (provider.apiBase) {
            env.ANTHROPIC_BASE_URL = provider.apiBase;
          }
          if (provider.apiKey) {
            env.ANTHROPIC_AUTH_TOKEN = provider.apiKey;
          }
        }
      } else {
        // Direct mode: use manual input
        if (authToken.trim()) {
          env.ANTHROPIC_AUTH_TOKEN = authToken.trim();
        }
        if (baseUrl.trim()) {
          env.ANTHROPIC_BASE_URL = baseUrl.trim();
        }
      }

      const request = {
        id: cliSettings?.id,
        name: name.trim(),
        description: description.trim() || undefined,
        enabled,
        settings: {
          env,
          model,
          includeCoAuthoredBy,
        },
      };

      if (isEditing && cliSettings) {
        await updateCliSettings(cliSettings.id, request);
      } else {
        await createCliSettings(request);
      }

      onClose();
    } catch (error) {
      showNotification('error', formatMessage({ id: 'apiSettings.cliSettings.saveError' }));
    }
  };

  // Get selected provider info
  const selectedProvider = providers.find((p) => p.id === providerId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? formatMessage({ id: 'apiSettings.cliSettings.actions.edit' })
              : formatMessage({ id: 'apiSettings.cliSettings.actions.add' })}
          </DialogTitle>
          <DialogDescription>
            {formatMessage({ id: 'apiSettings.cliSettings.modalDescription' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Common Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                {formatMessage({ id: 'apiSettings.common.name' })}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={formatMessage({ id: 'apiSettings.cliSettings.namePlaceholder' })}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                {formatMessage({ id: 'apiSettings.common.description' })}
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={formatMessage({ id: 'apiSettings.cliSettings.descriptionPlaceholder' })}
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
              <Label htmlFor="enabled" className="cursor-pointer">
                {formatMessage({ id: 'apiSettings.common.enableThis' })}
              </Label>
            </div>
          </div>

          {/* Mode Tabs */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as ModeType)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="provider-based">
                {formatMessage({ id: 'apiSettings.cliSettings.providerBased' })}
              </TabsTrigger>
              <TabsTrigger value="direct">
                {formatMessage({ id: 'apiSettings.cliSettings.direct' })}
              </TabsTrigger>
            </TabsList>

            {/* Provider-based Mode */}
            <TabsContent value="provider-based" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="providerId">
                  {formatMessage({ id: 'apiSettings.common.provider' })}
                  <span className="text-destructive">*</span>
                </Label>
                <Select value={providerId} onValueChange={setProviderId}>
                  <SelectTrigger className={errors.providerId ? 'border-destructive' : ''}>
                    <SelectValue placeholder={formatMessage({ id: 'apiSettings.cliSettings.selectProvider' })} />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.providerId && <p className="text-sm text-destructive">{errors.providerId}</p>}
              </div>

              {selectedProvider && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <p className="text-sm font-medium">{selectedProvider.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMessage({ id: 'apiSettings.common.type' })}: {selectedProvider.type}
                  </p>
                  {selectedProvider.apiBase && (
                    <p className="text-xs text-muted-foreground truncate">
                      {formatMessage({ id: 'apiSettings.providers.apiBaseUrl' })}: {selectedProvider.apiBase}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="model-pb">
                  {formatMessage({ id: 'apiSettings.cliSettings.model' })}
                </Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model-pb">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="opus">Opus</SelectItem>
                    <SelectItem value="sonnet">Sonnet</SelectItem>
                    <SelectItem value="haiku">Haiku</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* Direct Mode */}
            <TabsContent value="direct" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="authToken">
                  {formatMessage({ id: 'apiSettings.cliSettings.authToken' })}
                </Label>
                <div className="relative">
                  <Input
                    id="authToken"
                    type={showToken ? 'text' : 'password'}
                    value={authToken}
                    onChange={(e) => setAuthToken(e.target.value)}
                    placeholder="sk-ant-..."
                    className={errors.direct ? 'border-destructive pr-10' : 'pr-10'}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-2"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="baseUrl">
                  {formatMessage({ id: 'apiSettings.cliSettings.baseUrl' })}
                </Label>
                <Input
                  id="baseUrl"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.anthropic.com"
                  className={errors.direct ? 'border-destructive' : ''}
                />
              </div>

              {errors.direct && <p className="text-sm text-destructive">{errors.direct}</p>}

              <div className="space-y-2">
                <Label htmlFor="model-direct">
                  {formatMessage({ id: 'apiSettings.cliSettings.model' })}
                </Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model-direct">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="opus">Opus</SelectItem>
                    <SelectItem value="sonnet">Sonnet</SelectItem>
                    <SelectItem value="haiku">Haiku</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>

          {/* Additional Settings (both modes) */}
          <div className="flex items-center gap-2">
            <Switch
              id="coAuthored"
              checked={includeCoAuthoredBy}
              onCheckedChange={setIncludeCoAuthoredBy}
            />
            <Label htmlFor="coAuthored" className="cursor-pointer">
              {formatMessage({ id: 'apiSettings.cliSettings.includeCoAuthoredBy' })}
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {formatMessage({ id: 'common.actions.cancel' })}
          </Button>
          <Button onClick={handleSave} disabled={isCreating || isUpdating}>
            {(isCreating || isUpdating) ? (
              formatMessage({ id: 'common.actions.saving' })
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'common.actions.save' })}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CliSettingsModal;
