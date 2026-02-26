// ========================================
// HookDialog Component
// ========================================
// Dialog for editing hook configuration

import * as React from 'react';
import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { Textarea } from '@/components/ui/Textarea';
import { Globe, Folder, HelpCircle } from 'lucide-react';
import {
  HookConfig,
  HookEvent,
  HookScope,
  HookFailMode,
} from './HookCard';

export interface HookDialogProps {
  /** Whether dialog is open */
  open: boolean;
  /** Called when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Hook data to edit (undefined for new hook) */
  hook?: HookConfig;
  /** Called when save is triggered */
  onSave: (hook: Omit<HookConfig, 'id'> & { id?: string }) => void;
  /** Optional className */
  className?: string;
  /** Loading state */
  isLoading?: boolean;
}

/**
 * Default hook configuration
 */
const defaultHookConfig: Omit<HookConfig, 'id'> = {
  name: '',
  event: 'SessionStart',
  command: '',
  description: '',
  scope: 'global',
  enabled: true,
  installed: true,
  timeout: 30000,
  failMode: 'continue',
};

/**
 * HookDialog component for editing hook configuration
 */
export function HookDialog({
  open,
  onOpenChange,
  hook,
  onSave,
  className,
  isLoading = false,
}: HookDialogProps) {
  const { formatMessage } = useIntl();
  const isEditing = !!hook;

  // Form state
  const [formData, setFormData] = React.useState<Omit<HookConfig, 'id'>>(defaultHookConfig);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Reset form when hook changes or dialog opens
  React.useEffect(() => {
    if (open) {
      setFormData(hook ? { ...hook } : defaultHookConfig);
      setErrors({});
    }
  }, [open, hook]);

  // Update form field
  const updateField = <K extends keyof typeof formData>(
    field: K,
    value: (typeof formData)[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when field is updated
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = formatMessage({ id: 'hooks.validation.nameRequired' });
    }

    if (!formData.command.trim()) {
      newErrors.command = formatMessage({ id: 'hooks.validation.commandRequired' });
    }

    if (formData.timeout && formData.timeout < 1000) {
      newErrors.timeout = formatMessage({ id: 'hooks.validation.timeoutMin' });
    }

    if (formData.timeout && formData.timeout > 300000) {
      newErrors.timeout = formatMessage({ id: 'hooks.validation.timeoutMax' });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = () => {
    if (!validateForm()) {
      return;
    }

    onSave({
      ...(hook ? { id: hook.id } : {}),
      ...formData,
    });
  };

  // Handle cancel
  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('sm:max-w-[500px]', className)}>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? formatMessage({ id: 'hooks.dialog.editTitle' })
              : formatMessage({ id: 'hooks.dialog.createTitle' })}
          </DialogTitle>
          <DialogDescription>
            {formatMessage({ id: 'hooks.dialog.description' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name field */}
          <div className="space-y-2">
            <Label htmlFor="name" className="required">
              {formatMessage({ id: 'hooks.fields.name' })}
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder={formatMessage({ id: 'hooks.placeholders.name' })}
              className={errors.name ? 'border-destructive' : ''}
              disabled={isLoading}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Event type field */}
          <div className="space-y-2">
            <Label htmlFor="event" className="required">
              {formatMessage({ id: 'hooks.fields.event' })}
            </Label>
            <Select
              value={formData.event}
              onValueChange={(value) => updateField('event', value as HookEvent)}
              disabled={isLoading}
            >
              <SelectTrigger id="event">
                <SelectValue placeholder={formatMessage({ id: 'hooks.placeholders.event' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SessionStart">
                  {formatMessage({ id: 'hooks.events.sessionStart' })}
                </SelectItem>
                <SelectItem value="UserPromptSubmit">
                  {formatMessage({ id: 'hooks.events.userPromptSubmit' })}
                </SelectItem>
                <SelectItem value="SessionEnd">
                  {formatMessage({ id: 'hooks.events.sessionEnd' })}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'hints.hookEvents' })}
            </p>
          </div>

          {/* Scope field */}
          <div className="space-y-2">
            <Label className="required">
              {formatMessage({ id: 'hooks.fields.scope' })}
            </Label>
            <RadioGroup
              value={formData.scope}
              onValueChange={(value) => updateField('scope', value as HookScope)}
              className="flex gap-4"
              disabled={isLoading}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="global" id="scope-global" />
                <Label htmlFor="scope-global" className="flex items-center gap-1.5 cursor-pointer">
                  <Globe className="h-4 w-4" />
                  {formatMessage({ id: 'hooks.scope.global' })}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="project" id="scope-project" />
                <Label htmlFor="scope-project" className="flex items-center gap-1.5 cursor-pointer">
                  <Folder className="h-4 w-4" />
                  {formatMessage({ id: 'hooks.scope.project' })}
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'hints.hookScope' })}
            </p>
          </div>

          {/* Command field */}
          <div className="space-y-2">
            <Label htmlFor="command" className="required">
              {formatMessage({ id: 'hooks.fields.command' })}
            </Label>
            <Input
              id="command"
              value={formData.command}
              onChange={(e) => updateField('command', e.target.value)}
              placeholder={formatMessage({ id: 'hooks.placeholders.command' })}
              className={cn('font-mono', errors.command ? 'border-destructive' : '')}
              disabled={isLoading}
            />
            {errors.command && (
              <p className="text-xs text-destructive">{errors.command}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'hints.hookCommand' })}
            </p>
          </div>

          {/* Description field */}
          <div className="space-y-2">
            <Label htmlFor="description">
              {formatMessage({ id: 'hooks.fields.description' })}
            </Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder={formatMessage({ id: 'hooks.placeholders.description' })}
              rows={2}
              disabled={isLoading}
            />
          </div>

          {/* Timeout field */}
          <div className="space-y-2">
            <Label htmlFor="timeout" className="flex items-center gap-1">
              {formatMessage({ id: 'hooks.fields.timeout' })}
              <span className="text-xs text-muted-foreground">
                ({formatMessage({ id: 'hooks.fields.timeoutUnit' })})
              </span>
            </Label>
            <Input
              id="timeout"
              type="number"
              value={formData.timeout || ''}
              onChange={(e) => updateField('timeout', parseInt(e.target.value, 10) || undefined)}
              placeholder="30000"
              className={errors.timeout ? 'border-destructive' : ''}
              disabled={isLoading}
              min={1000}
              max={300000}
            />
            {errors.timeout && (
              <p className="text-xs text-destructive">{errors.timeout}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'hints.hookTimeout' })}
            </p>
          </div>

          {/* Fail mode field */}
          <div className="space-y-2">
            <Label htmlFor="failMode" className="flex items-center gap-1">
              {formatMessage({ id: 'hooks.fields.failMode' })}
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </Label>
            <Select
              value={formData.failMode || 'continue'}
              onValueChange={(value) => updateField('failMode', value as HookFailMode)}
              disabled={isLoading}
            >
              <SelectTrigger id="failMode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="continue">
                  {formatMessage({ id: 'hooks.failModes.continue' })}
                </SelectItem>
                <SelectItem value="warn">
                  {formatMessage({ id: 'hooks.failModes.warn' })}
                </SelectItem>
                <SelectItem value="block">
                  {formatMessage({ id: 'hooks.failModes.block' })}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'hints.hookFailMode' })}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            {formatMessage({ id: 'common.cancel' })}
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading
              ? formatMessage({ id: 'common.saving' })
              : formatMessage({ id: 'common.save' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { type HookConfig, type HookEvent, type HookScope, type HookFailMode } from './HookCard';
