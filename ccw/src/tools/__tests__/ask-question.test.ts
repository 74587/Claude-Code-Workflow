// ========================================
// ask_question Tool Backend Tests
// ========================================
// Tests for the ask_question MCP tool functionality

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  execute,
  handleAnswer,
  cancelQuestion,
  getPendingQuestions,
  clearPendingQuestions,
} from '../tools/ask-question';
import type {
  Question,
  QuestionAnswer,
  AskQuestionParams,
  AskQuestionResult,
} from '../core/a2ui/A2UITypes';

describe('ask_question Tool', () => {
  beforeEach(() => {
    // Clear all pending questions before each test
    clearPendingQuestions();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    clearPendingQuestions();
    vi.useRealTimers();
  });

  describe('Question Validation', () => {
    const createValidQuestion = (): Question => ({
      id: 'test-question-1',
      type: 'confirm',
      title: 'Test Question',
    });

    it('should validate a valid confirm question', async () => {
      const params: AskQuestionParams = {
        question: createValidQuestion(),
      };

      // Should not throw during validation
      const result = await execute(params);
      expect(result).toBeDefined();
    });

    it('should validate a valid select question with options', async () => {
      const question: Question = {
        id: 'test-select',
        type: 'select',
        title: 'Select an option',
        options: [
          { value: 'opt1', label: 'Option 1' },
          { value: 'opt2', label: 'Option 2' },
        ],
      };

      const params: AskQuestionParams = { question };
      const result = await execute(params);

      expect(result).toBeDefined();
    });

    it('should validate a valid input question', async () => {
      const question: Question = {
        id: 'test-input',
        type: 'input',
        title: 'Enter your name',
        placeholder: 'Name',
      };

      const params: AskQuestionParams = { question };
      const result = await execute(params);

      expect(result).toBeDefined();
    });

    it('should validate a valid multi-select question', async () => {
      const question: Question = {
        id: 'test-multi',
        type: 'multi-select',
        title: 'Select multiple options',
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
          { value: 'c', label: 'C' },
        ],
      };

      const params: AskQuestionParams = { question };
      const result = await execute(params);

      expect(result).toBeDefined();
    });

    it('should reject question with missing id', async () => {
      const invalidQuestion = {
        type: 'confirm',
        title: 'Test',
      } as unknown as Question;

      const params: AskQuestionParams = { question: invalidQuestion };
      const result = await execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('id');
    });

    it('should reject question with missing type', async () => {
      const invalidQuestion = {
        id: 'test',
        title: 'Test',
      } as unknown as Question;

      const params: AskQuestionParams = { question: invalidQuestion };
      const result = await execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('type');
    });

    it('should reject question with missing title', async () => {
      const invalidQuestion = {
        id: 'test',
        type: 'confirm',
      } as unknown as Question;

      const params: AskQuestionParams = { question: invalidQuestion };
      const result = await execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('title');
    });

    it('should reject invalid question type', async () => {
      const invalidQuestion = {
        id: 'test',
        type: 'invalid-type',
        title: 'Test',
      } as unknown as Question;

      const params: AskQuestionParams = { question: invalidQuestion };
      const result = await execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid question type');
    });

    it('should reject select question without options', async () => {
      const invalidQuestion: Question = {
        id: 'test',
        type: 'select',
        title: 'Test',
        options: [],
      };

      const params: AskQuestionParams = { question: invalidQuestion };
      const result = await execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('options');
    });

    it('should reject options with missing value', async () => {
      const invalidQuestion = {
        id: 'test',
        type: 'select',
        title: 'Test',
        options: [{ label: 'Option' }],
      } as unknown as Question;

      const params: AskQuestionParams = { question: invalidQuestion };
      const result = await execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('value');
    });

    it('should reject invalid timeout (too small)', async () => {
      const question: Question = {
        id: 'test',
        type: 'confirm',
        title: 'Test',
        timeout: 500, // Less than 1000ms
      };

      const params: AskQuestionParams = { question };
      const result = await execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout');
    });

    it('should reject invalid timeout (too large)', async () => {
      const question: Question = {
        id: 'test',
        type: 'confirm',
        title: 'Test',
        timeout: 3600001, // More than 1 hour
      };

      const params: AskQuestionParams = { question };
      const result = await execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout');
    });
  });

  describe('Question Execution', () => {
    it('should create pending question on execute', async () => {
      const question: Question = {
        id: 'test-pending',
        type: 'confirm',
        title: 'Test',
      };

      const params: AskQuestionParams = { question };

      // Start execution (but don't await)
      const executePromise = execute(params);

      // Check that question is pending
      const pending = getPendingQuestions();
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('test-pending');

      // Cancel to clean up
      cancelQuestion('test-pending');
      await executePromise;
    });

    it('should use provided surfaceId', async () => {
      const question: Question = {
        id: 'test-surface-id',
        type: 'confirm',
        title: 'Test',
      };

      const params: AskQuestionParams = {
        question,
        surfaceId: 'custom-surface-123',
      };

      const executePromise = execute(params);

      const pending = getPendingQuestions();
      expect(pending[0].surfaceId).toBe('custom-surface-123');

      cancelQuestion('test-surface-id');
      await executePromise;
    });

    it('should auto-generate surfaceId if not provided', async () => {
      const question: Question = {
        id: 'test-auto-surface',
        type: 'confirm',
        title: 'Test',
      };

      const params: AskQuestionParams = { question };

      const executePromise = execute(params);

      const pending = getPendingQuestions();
      expect(pending[0].surfaceId).toMatch(/^question-test-auto-surface-\d+$/);

      cancelQuestion('test-auto-surface');
      await executePromise;
    });

    it('should use default timeout if not specified', async () => {
      const question: Question = {
        id: 'test-timeout',
        type: 'confirm',
        title: 'Test',
      };

      const params: AskQuestionParams = { question };

      const executePromise = execute(params);

      const pending = getPendingQuestions();
      expect(pending[0].timeout).toBe(5 * 60 * 1000); // 5 minutes

      cancelQuestion('test-timeout');
      await executePromise;
    });
  });

  describe('Answer Handling', () => {
    it('should accept valid confirm answer', async () => {
      const question: Question = {
        id: 'test-confirm-answer',
        type: 'confirm',
        title: 'Test',
      };

      const params: AskQuestionParams = { question };
      const executePromise = execute(params);

      // Send answer
      const answer: QuestionAnswer = {
        questionId: 'test-confirm-answer',
        value: true,
        cancelled: false,
      };

      const handled = handleAnswer(answer);
      expect(handled).toBe(true);

      const result = await executePromise;
      expect(result.success).toBe(true);
      expect(result.result?.cancelled).toBe(false);
    });

    it('should accept valid select answer', async () => {
      const question: Question = {
        id: 'test-select-answer',
        type: 'select',
        title: 'Test',
        options: [
          { value: 'opt1', label: 'Option 1' },
          { value: 'opt2', label: 'Option 2' },
        ],
      };

      const params: AskQuestionParams = { question };
      const executePromise = execute(params);

      const answer: QuestionAnswer = {
        questionId: 'test-select-answer',
        value: 'opt1',
      };

      const handled = handleAnswer(answer);
      expect(handled).toBe(true);

      const result = await executePromise;
      expect(result.success).toBe(true);
    });

    it('should accept valid input answer', async () => {
      const question: Question = {
        id: 'test-input-answer',
        type: 'input',
        title: 'Test',
      };

      const params: AskQuestionParams = { question };
      const executePromise = execute(params);

      const answer: QuestionAnswer = {
        questionId: 'test-input-answer',
        value: 'User input text',
      };

      const handled = handleAnswer(answer);
      expect(handled).toBe(true);

      const result = await executePromise;
      expect(result.success).toBe(true);
    });

    it('should accept valid multi-select answer', async () => {
      const question: Question = {
        id: 'test-multi-answer',
        type: 'multi-select',
        title: 'Test',
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
          { value: 'c', label: 'C' },
        ],
      };

      const params: AskQuestionParams = { question };
      const executePromise = execute(params);

      const answer: QuestionAnswer = {
        questionId: 'test-multi-answer',
        value: ['a', 'c'],
      };

      const handled = handleAnswer(answer);
      expect(handled).toBe(true);

      const result = await executePromise;
      expect(result.success).toBe(true);
    });

    it('should reject answer for non-existent question', () => {
      const answer: QuestionAnswer = {
        questionId: 'non-existent',
        value: 'test',
      };

      const handled = handleAnswer(answer);
      expect(handled).toBe(false);
    });

    it('should reject answer with wrong questionId', async () => {
      const question: Question = {
        id: 'test-wrong-id',
        type: 'confirm',
        title: 'Test',
      };

      const params: AskQuestionParams = { question };
      const executePromise = execute(params);

      const answer: QuestionAnswer = {
        questionId: 'different-id',
        value: true,
      };

      const handled = handleAnswer(answer);
      expect(handled).toBe(false);

      // Clean up
      cancelQuestion('test-wrong-id');
      await executePromise;
    });

    it('should reject invalid select answer (not in options)', async () => {
      const question: Question = {
        id: 'test-invalid-select',
        type: 'select',
        title: 'Test',
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
      };

      const params: AskQuestionParams = { question };
      const executePromise = execute(params);

      const answer: QuestionAnswer = {
        questionId: 'test-invalid-select',
        value: 'c', // Not in options
      };

      const handled = handleAnswer(answer);
      expect(handled).toBe(false);

      cancelQuestion('test-invalid-select');
      await executePromise;
    });

    it('should reject invalid multi-select answer (contains invalid value)', async () => {
      const question: Question = {
        id: 'test-invalid-multi',
        type: 'multi-select',
        title: 'Test',
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
      };

      const params: AskQuestionParams = { question };
      const executePromise = execute(params);

      const answer: QuestionAnswer = {
        questionId: 'test-invalid-multi',
        value: ['a', 'c'], // c is not in options
      };

      const handled = handleAnswer(answer);
      expect(handled).toBe(false);

      cancelQuestion('test-invalid-multi');
      await executePromise;
    });

    it('should handle cancelled answers', async () => {
      const question: Question = {
        id: 'test-cancelled',
        type: 'input',
        title: 'Test',
      };

      const params: AskQuestionParams = { question };
      const executePromise = execute(params);

      const answer: QuestionAnswer = {
        questionId: 'test-cancelled',
        cancelled: true,
      };

      const handled = handleAnswer(answer);
      expect(handled).toBe(true);

      const result = await executePromise;
      expect(result.success).toBe(true);
      expect(result.result?.cancelled).toBe(true);
    });
  });

  describe('Question Cancellation', () => {
    it('should cancel pending question', async () => {
      const question: Question = {
        id: 'test-cancel',
        type: 'confirm',
        title: 'Test',
      };

      const params: AskQuestionParams = { question };
      const executePromise = execute(params);

      // Cancel the question
      const cancelled = cancelQuestion('test-cancel');
      expect(cancelled).toBe(true);

      // Result should be resolved
      const result = await executePromise;
      expect(result.success).toBe(true);
      expect(result.result?.cancelled).toBe(true);
      expect(result.result?.error).toBe('Question cancelled');
    });

    it('should return false when cancelling non-existent question', () => {
      const cancelled = cancelQuestion('non-existent');
      expect(cancelled).toBe(false);
    });

    it('should remove question from pending after cancellation', async () => {
      const question: Question = {
        id: 'test-cancel-pending',
        type: 'confirm',
        title: 'Test',
      };

      const params: AskQuestionParams = { question };
      const executePromise = execute(params);

      expect(getPendingQuestions()).toHaveLength(1);

      cancelQuestion('test-cancel-pending');

      expect(getPendingQuestions()).toHaveLength(0);
      await executePromise;
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout question after specified duration', async () => {
      const question: Question = {
        id: 'test-timeout',
        type: 'confirm',
        title: 'Test',
        timeout: 5000, // 5 seconds
      };

      const params: AskQuestionParams = { question };
      const executePromise = execute(params);

      // Fast-forward time
      vi.advanceTimersByTime(5000);

      const result = await executePromise;
      expect(result.success).toBe(true);
      expect(result.result?.cancelled).toBe(false);
      expect(result.result?.error).toBe('Question timed out');
    });

    it('should use default timeout if not specified', async () => {
      const question: Question = {
        id: 'test-default-timeout',
        type: 'confirm',
        title: 'Test',
      };

      const params: AskQuestionParams = { question };
      const executePromise = execute(params);

      // Fast-forward past default timeout (5 minutes)
      vi.advanceTimersByTime(5 * 60 * 1000 + 1000);

      const result = await executePromise;
      expect(result.success).toBe(true);
      expect(result.result?.error).toBe('Question timed out');
    });
  });

  describe('getPendingQuestions()', () => {
    it('should return empty array when no questions pending', () => {
      const pending = getPendingQuestions();
      expect(pending).toEqual([]);
    });

    it('should return all pending questions', async () => {
      const executePromises = [];

      for (let i = 1; i <= 3; i++) {
        const question: Question = {
          id: `test-pending-${i}`,
          type: 'confirm',
          title: `Question ${i}`,
        };

        const params: AskQuestionParams = { question };
        executePromises.push(execute(params));
      }

      const pending = getPendingQuestions();
      expect(pending).toHaveLength(3);
      expect(pending.map((p) => p.id)).toEqual(['test-pending-1', 'test-pending-2', 'test-pending-3']);

      // Clean up
      cancelQuestion('test-pending-1');
      cancelQuestion('test-pending-2');
      cancelQuestion('test-pending-3');
      await Promise.all(executePromises);
    });
  });

  describe('clearPendingQuestions()', () => {
    it('should clear all pending questions', async () => {
      const executePromises = [];

      for (let i = 1; i <= 3; i++) {
        const question: Question = {
          id: `test-clear-${i}`,
          type: 'confirm',
          title: `Question ${i}`,
        };

        const params: AskQuestionParams = { question };
        executePromises.push(execute(params));
      }

      expect(getPendingQuestions()).toHaveLength(3);

      clearPendingQuestions();

      expect(getPendingQuestions()).toHaveLength(0);

      // All promises should be rejected
      for (const promise of executePromises) {
        const result = await promise;
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple questions with same id correctly', async () => {
      const question: Question = {
        id: 'duplicate-id',
        type: 'confirm',
        title: 'First',
      };

      const params1: AskQuestionParams = { question };
      const executePromise1 = execute(params1);

      // Second execution with same ID should replace first
      const question2: Question = {
        id: 'duplicate-id',
        type: 'confirm',
        title: 'Second',
      };
      const params2: AskQuestionParams = { question: question2 };
      const executePromise2 = execute(params2);

      // There should still be only one pending
      expect(getPendingQuestions()).toHaveLength(1);

      // Clean up
      cancelQuestion('duplicate-id');
      await Promise.all([executePromise1, executePromise2]);
    });

    it('should handle answer after question is cancelled', async () => {
      const question: Question = {
        id: 'test-then-cancel',
        type: 'confirm',
        title: 'Test',
      };

      const params: AskQuestionParams = { question };
      const executePromise = execute(params);

      // Cancel first
      cancelQuestion('test-then-cancel');
      await executePromise;

      // Then try to send answer
      const answer: QuestionAnswer = {
        questionId: 'test-then-cancel',
        value: true,
      };

      const handled = handleAnswer(answer);
      expect(handled).toBe(false);
    });

    it('should handle all question types with default values', async () => {
      const testCases: Array<{ type: Question['type']; defaultValue: unknown }> = [
        { type: 'input', defaultValue: 'default text' },
        { type: 'select', defaultValue: 'opt1' },
      ];

      for (const testCase of testCases) {
        const question: Question = {
          id: `test-default-${testCase.type}`,
          type: testCase.type,
          title: 'Test',
          options: testCase.type === 'select' ? [
            { value: 'opt1', label: 'Option 1' },
            { value: 'opt2', label: 'Option 2' },
          ] : undefined,
          defaultValue: testCase.defaultValue as string,
        };

        const params: AskQuestionParams = { question };
        const executePromise = execute(params);

        // Should execute without error
        expect(getPendingQuestions()).toHaveLength(1);

        cancelQuestion(`test-default-${testCase.type}`);
        await executePromise;
      }
    });
  });
});
