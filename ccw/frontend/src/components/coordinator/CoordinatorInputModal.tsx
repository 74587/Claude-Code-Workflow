// ========================================
// Coordinator Input Modal Component
// ========================================
// Modal dialog for starting coordinator execution with task description and parameters

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useCoordinatorStore } from '@/stores/coordinatorStore';
import { useNotifications } from '@/hooks/useNotifications';

// ========== Types ==========

export interface CoordinatorInputModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormErrors {
  taskDescription?: string;
  parameters?: string;
}

// ========== Validation Helper ==========

function validateForm(taskDescription: string, parameters: string): FormErrors {
  const errors: FormErrors = {};

  // Validate task description
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

  // Validate parameters if provided
  if (parameters.trim()) {
    try {
      JSON.parse(parameters.trim());
    } catch (error) {
      errors.parameters = 'coordinator.validation.parametersInvalidJson';
    }
  }

  return errors;
}

// ========== Component ==========

export function CoordinatorInputModal({ open, onClose }: CoordinatorInputModalProps) {
  const { formatMessage } = useIntl();
  const { success, error: showError } = useNotifications();
  const { startCoordinator } = useCoordinatorStore();

  // Form state
  const [taskDescription, setTaskDescription] = useState('');
  const [parameters, setParameters] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      setTaskDescription('');
      setParameters('');
      setErrors({});
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

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Handle submit
  const handleSubmit = async () => {
    // Validate form
    const validationErrors = validateForm(taskDescription, parameters);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      // Parse parameters if provided
      const parsedParams = parameters.trim() ? JSON.parse(parameters.trim()) : undefined;

      // Generate execution ID
      const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Call API to start coordinator
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

      // Call store to update state
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {formatMessage({ id: 'coordinator.modal.title' })}
          </DialogTitle>
          <DialogDescription>
            {formatMessage({ id: 'coordinator.modal.description' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Task Description */}
          <div className="space-y-2">
            <Label htmlFor="task-description" className="text-base font-medium">
              {formatMessage({ id: 'coordinator.form.taskDescription' })}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="task-description"
              value={taskDescription}
              onChange={(e) => handleFieldChange('taskDescription', e.target.value)}
              placeholder={formatMessage({ id: 'coordinator.form.taskDescriptionPlaceholder' })}
              rows={6}
              className={errors.taskDescription ? 'border-destructive' : ''}
              disabled={isSubmitting}
            />
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>
                {formatMessage({ id: 'coordinator.form.characterCount' }, {
                  current: taskDescription.length,
                  min: 10,
                  max: 2000,
                })}
              </span>
              {taskDescription.length >= 10 && taskDescription.length <= 2000 && (
                <span className="text-green-600">Valid</span>
              )}
            </div>
            {errors.taskDescription && (
              <p className="text-sm text-destructive">
                {formatMessage({ id: errors.taskDescription })}
              </p>
            )}
          </div>

          {/* Parameters (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="parameters" className="text-base font-medium">
              {formatMessage({ id: 'coordinator.form.parameters' })}
            </Label>
            <Input
              id="parameters"
              value={parameters}
              onChange={(e) => handleFieldChange('parameters', e.target.value)}
              placeholder={formatMessage({ id: 'coordinator.form.parametersPlaceholder' })}
              className={`font-mono text-sm ${errors.parameters ? 'border-destructive' : ''}`}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'coordinator.form.parametersHelp' })}
            </p>
            {errors.parameters && (
              <p className="text-sm text-destructive">
                {formatMessage({ id: errors.parameters })}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {formatMessage({ id: 'common.actions.cancel' })}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {formatMessage({ id: 'coordinator.form.starting' })}
              </>
            ) : (
              formatMessage({ id: 'coordinator.form.start' })
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CoordinatorInputModal;
