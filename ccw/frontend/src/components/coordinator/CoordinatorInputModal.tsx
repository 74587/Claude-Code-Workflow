// ========================================
// Coordinator Input Modal Component (Multi-Step)
// ========================================
// Two-step modal: Welcome page -> Template & Parameters

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Loader2, Rocket, Zap, GitBranch, Eye, ChevronRight, ChevronLeft } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Label } from '@/components/ui/Label';
import { useCoordinatorStore } from '@/stores/coordinatorStore';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

// ========== Types ==========

export interface CoordinatorInputModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormErrors {
  taskDescription?: string;
  parameters?: string;
}

// ========== Constants ==========

const TEMPLATES = [
  { id: 'feature-dev', nameKey: 'coordinator.multiStep.step2.templates.featureDev', description: 'Complete feature development workflow' },
  { id: 'api-integration', nameKey: 'coordinator.multiStep.step2.templates.apiIntegration', description: 'Third-party API integration' },
  { id: 'performance', nameKey: 'coordinator.multiStep.step2.templates.performanceOptimization', description: 'System performance analysis' },
  { id: 'documentation', nameKey: 'coordinator.multiStep.step2.templates.documentGeneration', description: 'Auto-generate documentation' },
] as const;

const TOTAL_STEPS = 2;

// ========== Validation Helper ==========

function validateForm(taskDescription: string, parameters: string): FormErrors {
  const errors: FormErrors = {};

  if (!taskDescription.trim()) {
    errors.taskDescription = 'coordinator.validation.taskDescriptionRequired';
  } else {
    const length = taskDescription.trim().length;
    if (length < 10) {
      errors.taskDescription = 'coordinator.validation.taskDescriptionTooShort';
    } else if (length > 2000) {
      errors.taskDescription = 'coordinator.validation.taskDescriptionTooLong';
    }
  }

  if (parameters.trim()) {
    try {
      JSON.parse(parameters.trim());
    } catch {
      errors.parameters = 'coordinator.validation.parametersInvalidJson';
    }
  }

  return errors;
}

// ========== Feature Card Data ==========

const FEATURES = [
  {
    icon: Zap,
    titleKey: 'coordinator.multiStep.step1.feature1.title',
    descriptionKey: 'coordinator.multiStep.step1.feature1.description',
    bgClass: 'bg-primary/10',
    iconClass: 'text-primary',
  },
  {
    icon: GitBranch,
    titleKey: 'coordinator.multiStep.step1.feature2.title',
    descriptionKey: 'coordinator.multiStep.step1.feature2.description',
    bgClass: 'bg-secondary/10',
    iconClass: 'text-secondary-foreground',
  },
  {
    icon: Eye,
    titleKey: 'coordinator.multiStep.step1.feature3.title',
    descriptionKey: 'coordinator.multiStep.step1.feature3.description',
    bgClass: 'bg-accent/10',
    iconClass: 'text-accent-foreground',
  },
] as const;

// ========== Component ==========

export function CoordinatorInputModal({ open, onClose }: CoordinatorInputModalProps) {
  const { formatMessage } = useIntl();
  const { success, error: showError } = useNotifications();
  const { startCoordinator } = useCoordinatorStore();

  // Step state
  const [step, setStep] = useState(1);

  // Form state
  const [taskDescription, setTaskDescription] = useState('');
  const [parameters, setParameters] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset all state when modal opens/closes
  useEffect(() => {
    if (open) {
      setStep(1);
      setTaskDescription('');
      setParameters('');
      setSelectedTemplate(null);
      setErrors({});
      setIsSubmitting(false);
    }
  }, [open]);

  // Handle field change
  const handleFieldChange = (
    field: 'taskDescription' | 'parameters',
    value: string
  ) => {
    if (field === 'taskDescription') {
      setTaskDescription(value);
    } else {
      setParameters(value);
    }

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setTaskDescription(template.description);
      if (errors.taskDescription) {
        setErrors((prev) => ({ ...prev, taskDescription: undefined }));
      }
    }
  };

  // Handle submit - preserved exactly from original
  const handleSubmit = async () => {
    const validationErrors = validateForm(taskDescription, parameters);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedParams = parameters.trim() ? JSON.parse(parameters.trim()) : undefined;

      const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const response = await fetch('/api/coordinator/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionId,
          taskDescription: taskDescription.trim(),
          parameters: parsedParams,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || 'Failed to start coordinator');
      }

      await startCoordinator(executionId, taskDescription.trim(), parsedParams);

      success(formatMessage({ id: 'coordinator.success.started' }));
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showError('Error', errorMessage);
      console.error('Failed to start coordinator:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Navigation
  const handleNext = () => setStep(2);
  const handleBack = () => setStep(1);

  // ========== Step 1: Welcome ==========

  const renderStep1 = () => (
    <div className="flex flex-col items-center px-6 py-8">
      {/* Hero Icon */}
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-6">
        <Rocket className="h-8 w-8" />
      </div>

      {/* Title & Subtitle */}
      <h2 className="text-2xl font-bold text-foreground mb-2">
        {formatMessage({ id: 'coordinator.multiStep.step1.title' })}
      </h2>
      <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
        {formatMessage({ id: 'coordinator.multiStep.step1.subtitle' })}
      </p>

      {/* Feature Cards */}
      <div className="grid grid-cols-3 gap-4 w-full">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.titleKey}
              className={cn(
                'flex flex-col items-center rounded-xl p-5 text-center',
                feature.bgClass
              )}
            >
              <Icon className={cn('h-6 w-6 mb-3', feature.iconClass)} />
              <span className="text-sm font-medium text-foreground mb-1">
                {formatMessage({ id: feature.titleKey })}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatMessage({ id: feature.descriptionKey })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ========== Step 2: Template + Parameters ==========

  const renderStep2 = () => (
    <div className="flex min-h-[380px]">
      {/* Left Column: Template Selection */}
      <div className="w-2/5 border-r border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          {formatMessage({ id: 'coordinator.multiStep.step2.templateLabel' })}
        </h3>
        <div className="space-y-2">
          {TEMPLATES.map((template) => {
            const isSelected = selectedTemplate === template.id;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => handleTemplateSelect(template.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:bg-muted/50'
                )}
              >
                {/* Radio dot */}
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                    isSelected
                      ? 'border-primary'
                      : 'border-muted-foreground/40'
                  )}
                >
                  {isSelected && (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </span>
                <span className={cn(
                  'text-sm',
                  isSelected ? 'font-medium text-foreground' : 'text-muted-foreground'
                )}>
                  {formatMessage({ id: template.nameKey })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Parameter Form */}
      <div className="w-3/5 p-5 space-y-4">
        {/* Task Description */}
        <div className="space-y-2">
          <Label htmlFor="task-description" className="text-sm font-medium">
            {formatMessage({ id: 'coordinator.form.taskDescription' })}
            <span className="text-destructive ml-0.5">*</span>
          </Label>
          <Textarea
            id="task-description"
            value={taskDescription}
            onChange={(e) => handleFieldChange('taskDescription', e.target.value)}
            placeholder={formatMessage({ id: 'coordinator.form.taskDescriptionPlaceholder' })}
            rows={5}
            className={cn(
              'resize-none',
              errors.taskDescription && 'border-destructive'
            )}
            disabled={isSubmitting}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {formatMessage(
                { id: 'coordinator.form.characterCount' },
                { current: taskDescription.length, min: 10, max: 2000 }
              )}
            </span>
            {taskDescription.length >= 10 && taskDescription.length <= 2000 && (
              <span className="text-primary">Valid</span>
            )}
          </div>
          {errors.taskDescription && (
            <p className="text-xs text-destructive">
              {formatMessage({ id: errors.taskDescription })}
            </p>
          )}
        </div>

        {/* Custom Parameters */}
        <div className="space-y-2">
          <Label htmlFor="parameters" className="text-sm font-medium">
            {formatMessage({ id: 'coordinator.form.parameters' })}
          </Label>
          <Textarea
            id="parameters"
            value={parameters}
            onChange={(e) => handleFieldChange('parameters', e.target.value)}
            placeholder={formatMessage({ id: 'coordinator.form.parametersPlaceholder' })}
            rows={3}
            className={cn(
              'resize-none font-mono text-sm',
              errors.parameters && 'border-destructive'
            )}
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground">
            {formatMessage({ id: 'coordinator.form.parametersHelp' })}
          </p>
          {errors.parameters && (
            <p className="text-xs text-destructive">
              {formatMessage({ id: errors.parameters })}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  // ========== Footer ==========

  const renderFooter = () => (
    <div className="flex items-center justify-between border-t border-border px-6 py-4">
      {/* Left: Step indicator + Back */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {formatMessage(
            { id: 'coordinator.multiStep.progress.step' },
            { current: step, total: TOTAL_STEPS }
          )}
        </span>
        {step === 2 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            disabled={isSubmitting}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {formatMessage({ id: 'coordinator.multiStep.actions.back' })}
          </Button>
        )}
      </div>

      {/* Right: Cancel + Next/Submit */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={isSubmitting}
        >
          {formatMessage({ id: 'common.actions.cancel' })}
        </Button>

        {step === 1 ? (
          <Button size="sm" onClick={handleNext}>
            {formatMessage({ id: 'coordinator.multiStep.actions.next' })}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {formatMessage({ id: 'coordinator.form.starting' })}
              </>
            ) : (
              formatMessage({ id: 'coordinator.multiStep.actions.submit' })
            )}
          </Button>
        )}
      </div>
    </div>
  );

  // ========== Render ==========

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl gap-0 p-0 overflow-hidden">
        {/* Visually hidden title for accessibility */}
        <DialogTitle className="sr-only">
          {formatMessage({ id: 'coordinator.modal.title' })}
        </DialogTitle>

        {/* Step Content */}
        {step === 1 ? renderStep1() : renderStep2()}

        {/* Footer */}
        {renderFooter()}
      </DialogContent>
    </Dialog>
  );
}

export default CoordinatorInputModal;
