// ========================================
// AskQuestionDialog Component
// ========================================
// Dialog for handling ask_question MCP tool with all question types

import { useState, useCallback, useEffect } from 'react';
import { useIntl } from 'react-intl';
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
import { Textarea } from '@/components/ui/Textarea';
import { Checkbox } from '@/components/ui/Checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/Label';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/stores';
import type { AskQuestionPayload, Question, QuestionType } from '@/types/store';

// ========== Types ==========

interface AskQuestionDialogProps {
  /** Question payload from ask_question tool */
  payload: AskQuestionPayload;
  /** Callback when dialog is closed (cancelled or confirmed) */
  onClose: () => void;
}

/** Answer value per question */
type AnswerValue = string | string[];

/** Answers record keyed by question ID */
interface Answers {
  [questionId: string]: AnswerValue;
}

// ========== Component ==========

export function AskQuestionDialog({ payload, onClose }: AskQuestionDialogProps) {
  const { formatMessage } = useIntl();
  const sendA2UIAction = useNotificationStore((state) => state.sendA2UIAction);

  // Initialize answers with default values
  const [answers, setAnswers] = useState<Answers>(() => {
    const initial: Answers = {};
    for (const question of payload.questions) {
      if (question.default !== undefined) {
        initial[question.id] = question.default;
      } else if (question.type === 'multi') {
        initial[question.id] = [];
      } else if (question.type === 'yes_no') {
        initial[question.id] = 'yes';
      } else {
        initial[question.id] = '';
      }
    }
    return initial;
  });

  // Validation error state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasValidationError, setHasValidationError] = useState(false);

  // Clear validation error when answers change
  useEffect(() => {
    if (hasValidationError) {
      setHasValidationError(false);
      setErrors({});
    }
  }, [answers, hasValidationError]);

  // ========== Question Renderers ==========

  const renderQuestion = useCallback((question: Question) => {
    const value = answers[question.id] || '';
    const setValue = (newValue: AnswerValue) => {
      setAnswers((prev) => ({ ...prev, [question.id]: newValue }));
    };

    const error = errors[question.id];

    switch (question.type) {
      case 'single':
        return (
          <div key={question.id} className="space-y-3">
            <Label className={cn('text-sm font-medium', question.required && "after:content-['*'] after:ml-0.5 after:text-destructive")}>
              {question.question}
            </Label>
            <RadioGroup
              value={String(value)}
              onValueChange={(v) => setValue(v)}
              className="space-y-2"
            >
              {question.options?.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                  <Label
                    htmlFor={`${question.id}-${option}`}
                    className="cursor-pointer text-sm font-normal"
                  >
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
            )}
          </div>
        );

      case 'multi':
        return (
          <div key={question.id} className="space-y-3">
            <Label className={cn('text-sm font-medium', question.required && "after:content-['*'] after:ml-0.5 after:text-destructive")}>
              {question.question}
            </Label>
            <div className="space-y-2">
              {question.options?.map((option) => {
                const checked = Array.isArray(value) && value.includes(option);
                return (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${question.id}-${option}`}
                      checked={checked}
                      onCheckedChange={(checked) => {
                        const currentArray = Array.isArray(value) ? value : [];
                        if (checked) {
                          setValue([...currentArray, option]);
                        } else {
                          setValue(currentArray.filter((v) => v !== option));
                        }
                      }}
                    />
                    <Label
                      htmlFor={`${question.id}-${option}`}
                      className="cursor-pointer text-sm font-normal"
                    >
                      {option}
                    </Label>
                  </div>
                );
              })}
            </div>
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
            )}
          </div>
        );

      case 'text':
        return (
          <div key={question.id} className="space-y-2">
            <Label className={cn('text-sm font-medium', question.required && "after:content-['*'] after:ml-0.5 after:text-destructive")}>
              {question.question}
            </Label>
            <Textarea
              value={String(value)}
              onChange={(e) => setValue(e.target.value)}
              placeholder={formatMessage({ id: 'askQuestion.textPlaceholder' }) || 'Enter your answer...'}
              rows={3}
              className={cn(error && 'border-destructive')}
            />
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
            )}
          </div>
        );

      case 'yes_no':
        return (
          <div key={question.id} className="space-y-3">
            <Label className={cn('text-sm font-medium', question.required && "after:content-['*'] after:ml-0.5 after:text-destructive")}>
              {question.question}
            </Label>
            <RadioGroup
              value={String(value)}
              onValueChange={(v) => setValue(v)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id={`${question.id}-yes`} />
                <Label
                  htmlFor={`${question.id}-yes`}
                  className="cursor-pointer text-sm font-normal"
                >
                  {formatMessage({ id: 'askQuestion.yes' }) || 'Yes'}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id={`${question.id}-no`} />
                <Label
                  htmlFor={`${question.id}-no`}
                  className="cursor-pointer text-sm font-normal"
                >
                  {formatMessage({ id: 'askQuestion.no' }) || 'No'}
                </Label>
              </div>
            </RadioGroup>
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  }, [answers, errors, formatMessage]);

  // ========== Handlers ==========

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    for (const question of payload.questions) {
      if (question.required) {
        const answer = answers[question.id];

        // Check if answer is empty
        const isEmpty = (
          answer === undefined ||
          answer === null ||
          answer === '' ||
          (Array.isArray(answer) && answer.length === 0)
        );

        if (isEmpty) {
          newErrors[question.id] = formatMessage({ id: 'askQuestion.required' }) || 'This question is required';
          isValid = false;
        }
      }
    }

    setErrors(newErrors);
    return isValid;
  }, [answers, payload.questions, formatMessage]);

  const handleConfirm = useCallback(() => {
    if (!validate()) {
      setHasValidationError(true);
      return;
    }

    // Send answer via notificationStore
    sendA2UIAction('submit-answer', payload.surfaceId, {
      type: 'a2ui-answer',
      cancelled: false,
      answers,
    });

    onClose();
  }, [validate, sendA2UIAction, payload.surfaceId, answers, onClose]);

  const handleCancel = useCallback(() => {
    // Send cancellation via notificationStore
    sendA2UIAction('cancel-question', payload.surfaceId, {
      type: 'a2ui-answer',
      cancelled: true,
      answers: {},
    });

    onClose();
  }, [sendA2UIAction, payload.surfaceId, onClose]);

  // ========== Render ==========

  const title = payload.title || formatMessage({ id: 'askQuestion.defaultTitle' }) || 'Questions';

  return (
    <Dialog open onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {formatMessage({ id: 'askQuestion.description' }) || 'Please answer the following questions'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {payload.questions.map(renderQuestion)}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="w-full sm:w-auto"
          >
            {formatMessage({ id: 'common.actions.cancel' }) || 'Cancel'}
          </Button>
          <Button
            variant="default"
            onClick={handleConfirm}
            className="w-full sm:w-auto"
          >
            {formatMessage({ id: 'common.actions.confirm' }) || 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AskQuestionDialog;
