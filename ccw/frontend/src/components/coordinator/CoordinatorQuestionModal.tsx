// ========================================
// Coordinator Question Modal Component
// ========================================
// Interactive question dialog for coordinator execution

import { useState, useEffect, useRef } from 'react';
import { useIntl } from 'react-intl';
import { Loader2, AlertCircle } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { useCoordinatorStore, type CoordinatorQuestion } from '@/stores/coordinatorStore';

// ========== Types ==========

export interface CoordinatorQuestionModalProps {
  question: CoordinatorQuestion | null;
  onSubmit?: (questionId: string, answer: string | string[]) => void;
}

// ========== Component ==========

export function CoordinatorQuestionModal({
  question,
  onSubmit,
}: CoordinatorQuestionModalProps) {
  const { formatMessage } = useIntl();
  const { submitAnswer } = useCoordinatorStore();
  const [answer, setAnswer] = useState<string | string[]>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when question changes
  useEffect(() => {
    if (question) {
      setAnswer(question.type === 'multi' ? [] : '');
      setError(null);
      // Auto-focus on input when modal opens
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [question]);

  // Validate answer
  const validateAnswer = (): boolean => {
    if (!question) return false;

    if (question.required) {
      if (question.type === 'multi') {
        if (!Array.isArray(answer) || answer.length === 0) {
          setError(formatMessage({ id: 'coordinator.validation.answerRequired' }));
          return false;
        }
      } else {
        if (!answer || (typeof answer === 'string' && !answer.trim())) {
          setError(formatMessage({ id: 'coordinator.validation.answerRequired' }));
          return false;
        }
      }
    }

    return true;
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!question) return;

    if (!validateAnswer()) return;

    setIsSubmitting(true);
    try {
      const finalAnswer = typeof answer === 'string' ? answer.trim() : answer;

      // Call store action
      await submitAnswer(question.id, finalAnswer);

      // Call optional callback
      onSubmit?.(question.id, finalAnswer);

      setError(null);
    } catch (error) {
      console.error('Failed to submit answer:', error);
      setError(
        error instanceof Error
          ? error.message
          : formatMessage({ id: 'coordinator.error.submitFailed' })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && question?.type === 'text') {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Handle multi-select change
  const handleMultiSelectChange = (option: string, checked: boolean) => {
    if (!Array.isArray(answer)) {
      setAnswer([]);
      return;
    }

    if (checked) {
      setAnswer([...answer, option]);
    } else {
      setAnswer(answer.filter((a) => a !== option));
    }
    setError(null);
  };

  if (!question) {
    return null;
  }

  return (
    <Dialog open={!!question} onOpenChange={() => {/* Prevent manual close */}}>
      <DialogContent
        className="sm:max-w-[500px]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{question.title}</DialogTitle>
          {question.description && (
            <DialogDescription>{question.description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Text Input */}
          {question.type === 'text' && (
            <div className="space-y-2">
              <Label htmlFor="text-answer">
                {formatMessage({ id: 'coordinator.question.answer' })}
                {question.required && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="text-answer"
                ref={inputRef}
                value={typeof answer === 'string' ? answer : ''}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder={formatMessage({ id: 'coordinator.question.textPlaceholder' })}
                disabled={isSubmitting}
              />
            </div>
          )}

          {/* Single Select (RadioGroup) */}
          {question.type === 'single' && question.options && (
            <div className="space-y-2">
              <Label>
                {formatMessage({ id: 'coordinator.question.selectOne' })}
                {question.required && <span className="text-destructive">*</span>}
              </Label>
              <RadioGroup
                value={typeof answer === 'string' ? answer : ''}
                onValueChange={(value) => {
                  setAnswer(value);
                  setError(null);
                }}
                disabled={isSubmitting}
              >
                {question.options.map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`option-${option}`} />
                    <Label htmlFor={`option-${option}`} className="cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Multi Select (Checkboxes) */}
          {question.type === 'multi' && question.options && (
            <div className="space-y-2">
              <Label>
                {formatMessage({ id: 'coordinator.question.selectMultiple' })}
                {question.required && <span className="text-destructive">*</span>}
              </Label>
              <div className="space-y-2">
                {question.options.map((option) => {
                  const isChecked = Array.isArray(answer) && answer.includes(option);
                  return (
                    <div key={option} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`multi-${option}`}
                        checked={isChecked}
                        onChange={(e) => handleMultiSelectChange(option, e.target.checked)}
                        disabled={isSubmitting}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <Label htmlFor={`multi-${option}`} className="cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Yes/No Buttons */}
          {question.type === 'yes_no' && (
            <div className="space-y-2">
              <Label>
                {formatMessage({ id: 'coordinator.question.confirm' })}
                {question.required && <span className="text-destructive">*</span>}
              </Label>
              <div className="flex gap-2">
                <Button
                  variant={answer === 'yes' ? 'default' : 'outline'}
                  onClick={() => {
                    setAnswer('yes');
                    setError(null);
                  }}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {formatMessage({ id: 'coordinator.question.yes' })}
                </Button>
                <Button
                  variant={answer === 'no' ? 'default' : 'outline'}
                  onClick={() => {
                    setAnswer('no');
                    setError(null);
                  }}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {formatMessage({ id: 'coordinator.question.no' })}
                </Button>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {formatMessage({ id: 'coordinator.question.submitting' })}
              </>
            ) : (
              formatMessage({ id: 'coordinator.question.submit' })
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CoordinatorQuestionModal;
