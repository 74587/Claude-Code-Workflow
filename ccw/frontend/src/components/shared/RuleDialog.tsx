// ========================================
// RuleDialog Component
// ========================================
// Add/Edit dialog for rule configuration

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import {
  createRule,
  updateRule,
  type Rule,
  type RuleCreateInput,
} from '@/lib/api';
import { rulesKeys } from '@/hooks';
import { cn } from '@/lib/utils';

// ========== Types ==========

export interface RuleDialogProps {
  mode: 'add' | 'edit';
  rule?: Rule;
  open: boolean;
  onClose: () => void;
  onSave?: () => void;
}

interface RuleFormData {
  name: string;
  description: string;
  enabled: boolean;
  category: string;
  severity: Rule['severity'];
  fileName: string;
  location: 'project' | 'user';
  subdirectory: string;
  content: string;
  pattern: string;
}

interface FormErrors {
  name?: string;
  fileName?: string;
  content?: string;
  location?: string;
}

// ========== Categories ==========

const RULE_CATEGORIES = [
  'coding',
  'testing',
  'security',
  'architecture',
  'documentation',
  'performance',
  'workflow',
  'tooling',
  'general',
];

const SEVERITY_LEVELS: Exclude<Rule['severity'], undefined>[] = ['error', 'warning', 'info'];

// ========== Component ==========

export function RuleDialog({
  mode,
  rule,
  open,
  onClose,
  onSave,
}: RuleDialogProps) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState<RuleFormData>({
    name: '',
    description: '',
    enabled: true,
    category: 'general',
    severity: 'info',
    fileName: '',
    location: 'project',
    subdirectory: '',
    content: '',
    pattern: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});

  // Initialize form from rule prop (edit mode)
  useEffect(() => {
    if (rule && mode === 'edit') {
      setFormData({
        name: rule.name,
        description: rule.description || '',
        enabled: rule.enabled,
        category: rule.category || 'general',
        severity: rule.severity || 'info',
        fileName: rule.path?.split(/[/\\]/).pop() || `${rule.name.toLowerCase().replace(/\s+/g, '-')}.md`,
        location: rule.location || 'project',
        subdirectory: rule.subdirectory || '',
        content: '',
        pattern: rule.pattern || '',
      });
    } else {
      // Reset form for add mode
      setFormData({
        name: '',
        description: '',
        enabled: true,
        category: 'general',
        severity: 'info',
        fileName: '',
        location: 'project',
        subdirectory: '',
        content: '',
        pattern: '',
      });
    }
    setErrors({});
  }, [rule, mode, open]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: RuleCreateInput) => createRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rulesKeys.all });
      handleClose();
      onSave?.();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ ruleId, config }: { ruleId: string; config: Partial<Rule> }) =>
      updateRule(ruleId, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rulesKeys.all });
      handleClose();
      onSave?.();
    },
  });

  // Handlers
  const handleClose = () => {
    setErrors({});
    onClose();
  };

  const handleFieldChange = (
    field: keyof RuleFormData,
    value: string | boolean | Rule['severity']
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Auto-generate fileName from name if not set
  useEffect(() => {
    if (formData.name && !formData.fileName) {
      const generatedFileName = `${formData.name.toLowerCase().replace(/\s+/g, '-')}.md`;
      setFormData((prev) => ({ ...prev, fileName: generatedFileName }));
    }
  }, [formData.name, formData.fileName]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Name required
    if (!formData.name.trim()) {
      newErrors.name = formatMessage({ id: 'rules.dialog.validation.nameRequired' });
    }

    // File name required
    if (!formData.fileName.trim()) {
      newErrors.fileName = formatMessage({ id: 'rules.dialog.validation.fileNameRequired' });
    }

    // File name must end with .md
    if (formData.fileName && !formData.fileName.endsWith('.md')) {
      newErrors.fileName = formatMessage({ id: 'rules.dialog.validation.fileNameMd' });
    }

    // Location required
    if (!formData.location) {
      newErrors.location = formatMessage({ id: 'rules.dialog.validation.locationRequired' });
    }

    // Content required for new rules
    if (mode === 'add' && !formData.content.trim()) {
      newErrors.content = formatMessage({ id: 'rules.dialog.validation.contentRequired' });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    if (mode === 'add') {
      const input: RuleCreateInput = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        enabled: formData.enabled,
        category: formData.category || undefined,
        severity: formData.severity,
        fileName: formData.fileName.trim(),
        location: formData.location,
        subdirectory: formData.subdirectory.trim() || undefined,
        content: formData.content.trim(),
        pattern: formData.pattern.trim() || undefined,
      };
      createMutation.mutate(input);
    } else {
      updateMutation.mutate({
        ruleId: rule!.id,
        config: {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          enabled: formData.enabled,
          category: formData.category || undefined,
          severity: formData.severity,
          pattern: formData.pattern.trim() || undefined,
        },
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'add'
              ? formatMessage({ id: 'rules.dialog.addTitle' })
              : formatMessage({ id: 'rules.dialog.editTitle' }, { name: rule?.name })}
          </DialogTitle>
          <DialogDescription>
            {formatMessage({ id: 'rules.dialog.description' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'rules.dialog.form.name' })}
              <span className="text-destructive ml-1">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder={formatMessage({ id: 'rules.dialog.form.namePlaceholder' })}
              error={!!errors.name}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'rules.dialog.form.description' })}
            </label>
            <Input
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder={formatMessage({ id: 'rules.dialog.form.descriptionPlaceholder' })}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'rules.dialog.form.category' })}
            </label>
            <Select value={formData.category} onValueChange={(v) => handleFieldChange('category', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RULE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'rules.dialog.form.severity' })}
            </label>
            <Select
              value={formData.severity}
              onValueChange={(v) => handleFieldChange('severity', v as Rule['severity'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_LEVELS.map((sev) => (
                  <SelectItem key={sev} value={sev}>
                    {formatMessage({ id: `rules.severity.${sev}` })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'rules.dialog.form.fileName' })}
              <span className="text-destructive ml-1">*</span>
            </label>
            <Input
              value={formData.fileName}
              onChange={(e) => handleFieldChange('fileName', e.target.value)}
              placeholder="rule-name.md"
              error={!!errors.fileName}
            />
            {errors.fileName && (
              <p className="text-sm text-destructive">{errors.fileName}</p>
            )}
          </div>

          {/* Location */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'rules.dialog.form.location' })}
              <span className="text-destructive ml-1">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="location"
                  value="project"
                  checked={formData.location === 'project'}
                  onChange={(e) => handleFieldChange('location', e.target.value as 'project' | 'user')}
                  className="w-4 h-4"
                />
                <span className="text-sm">
                  {formatMessage({ id: 'rules.location.project' })}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="location"
                  value="user"
                  checked={formData.location === 'user'}
                  onChange={(e) => handleFieldChange('location', e.target.value as 'project' | 'user')}
                  className="w-4 h-4"
                />
                <span className="text-sm">
                  {formatMessage({ id: 'rules.location.user' })}
                </span>
              </label>
            </div>
            {errors.location && (
              <p className="text-sm text-destructive">{errors.location}</p>
            )}
          </div>

          {/* Subdirectory */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'rules.dialog.form.subdirectory' })}
            </label>
            <Input
              value={formData.subdirectory}
              onChange={(e) => handleFieldChange('subdirectory', e.target.value)}
              placeholder={formatMessage({ id: 'rules.dialog.form.subdirectoryPlaceholder' })}
            />
          </div>

          {/* Pattern */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'rules.dialog.form.pattern' })}
            </label>
            <Input
              value={formData.pattern}
              onChange={(e) => handleFieldChange('pattern', e.target.value)}
              placeholder={formatMessage({ id: 'rules.dialog.form.patternPlaceholder' })}
            />
          </div>

          {/* Content (only for new rules) */}
          {mode === 'add' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {formatMessage({ id: 'rules.dialog.form.content' })}
                <span className="text-destructive ml-1">*</span>
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => handleFieldChange('content', e.target.value)}
                placeholder={formatMessage({ id: 'rules.dialog.form.contentPlaceholder' })}
                className={cn(
                  'flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                  errors.content && 'border-destructive focus-visible:ring-destructive'
                )}
              />
              {errors.content && (
                <p className="text-sm text-destructive">{errors.content}</p>
              )}
            </div>
          )}

          {/* Enabled */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => handleFieldChange('enabled', e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="enabled" className="text-sm font-medium text-foreground cursor-pointer">
              {formatMessage({ id: 'rules.dialog.form.enabled' })}
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
          >
            {formatMessage({ id: 'common.actions.cancel' })}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending
              ? formatMessage({ id: 'rules.dialog.actions.saving' })
              : formatMessage({ id: 'common.actions.save' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RuleDialog;
