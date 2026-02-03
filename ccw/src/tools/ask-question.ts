// ========================================
// ask_question MCP Tool
// ========================================
// Interactive question tool using A2UI protocol

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import type {
  Question,
  QuestionType,
  QuestionOption,
  QuestionAnswer,
  AskQuestionParams,
  AskQuestionResult,
  PendingQuestion,
} from '../core/a2ui/A2UITypes.js';
import { a2uiWebSocketHandler } from '../core/a2ui/A2UIWebSocketHandler.js';

// ========== Constants ==========

/** Default question timeout (5 minutes) */
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

/** Map of pending questions waiting for responses */
const pendingQuestions = new Map<string, PendingQuestion>();

// ========== Validation ==========

/**
 * Validate question parameters
 * @param question - Question to validate
 * @returns Validated question or throws error
 */
function validateQuestion(question: unknown): Question {
  // Check required fields
  if (!question || typeof question !== 'object') {
    throw new Error('Question must be an object');
  }

  const q = question as Record<string, unknown>;

  if (!q.id || typeof q.id !== 'string') {
    throw new Error('Question must have an id field');
  }

  if (!q.type || typeof q.type !== 'string') {
    throw new Error('Question must have a type field');
  }

  if (!q.title || typeof q.title !== 'string') {
    throw new Error('Question must have a title field');
  }

  // Validate type
  const validTypes: QuestionType[] = ['confirm', 'select', 'input', 'multi-select'];
  if (!validTypes.includes(q.type as QuestionType)) {
    throw new Error(`Invalid question type: ${q.type}. Must be one of: ${validTypes.join(', ')}`);
  }

  // Validate options for select/multi-select
  if (q.type === 'select' || q.type === 'multi-select') {
    if (!Array.isArray(q.options) || q.options.length === 0) {
      throw new Error(`Question type '${q.type}' requires at least one option`);
    }

    for (const opt of q.options) {
      if (!opt.value || typeof opt.value !== 'string') {
        throw new Error('Each option must have a value field');
      }
      if (!opt.label || typeof opt.label !== 'string') {
        throw new Error('Each option must have a label field');
      }
    }
  }

  // Validate timeout
  const timeout = typeof q.timeout === 'number' ? q.timeout : DEFAULT_TIMEOUT_MS;
  if (timeout < 1000 || timeout > 3600000) {
    throw new Error('Timeout must be between 1 second and 1 hour');
  }

  return q as Question;
}

/**
 * Validate answer against question constraints
 * @param question - Question definition
 * @param answer - Answer to validate
 * @returns True if answer is valid
 */
function validateAnswer(question: Question, answer: QuestionAnswer): boolean {
  // Check question ID matches
  if (answer.questionId !== question.id) {
    return false;
  }

  // Handle cancelled answers
  if (answer.cancelled === true) {
    return true;
  }

  // Validate based on question type
  switch (question.type) {
    case 'confirm':
      return typeof answer.value === 'boolean';

    case 'input':
      return typeof answer.value === 'string';

    case 'select':
      if (typeof answer.value !== 'string') {
        return false;
      }
      if (!question.options) {
        return false;
      }
      return question.options.some((opt) => opt.value === answer.value);

    case 'multi-select':
      if (!Array.isArray(answer.value)) {
        return false;
      }
      if (!question.options) {
        return false;
      }
      const validValues = new Set(question.options.map((opt) => opt.value));
      return answer.value.every((v) => validValues.has(v));

    default:
      return false;
  }
}

// ========== A2UI Surface Generation ==========

/**
 * Generate A2UI surface update for a question
 * @param question - Question to render
 * @param surfaceId - Surface ID for the question
 * @returns A2UI surface update object
 */
function generateQuestionSurface(question: Question, surfaceId: string): {
  surfaceUpdate: {
    surfaceId: string;
    components: unknown[];
    initialState: Record<string, unknown>;
  };
} {
  const components: unknown[] = [];

  // Add title
  components.push({
    id: 'title',
    component: {
      Text: {
        text: { literalString: question.title },
        usageHint: 'h3',
      },
    },
  });

  // Add message if provided
  if (question.message) {
    components.push({
      id: 'message',
      component: {
        Text: {
          text: { literalString: question.message },
          usageHint: 'p',
        },
      },
    });
  }

  // Add description if provided
  if (question.description) {
    components.push({
      id: 'description',
      component: {
        Text: {
          text: { literalString: question.description },
          usageHint: 'small',
        },
      },
    });
  }

  // Add input components based on question type
  switch (question.type) {
    case 'confirm': {
      components.push({
        id: 'confirm-btn',
        component: {
          Button: {
            onClick: { actionId: 'confirm', parameters: { questionId: question.id } },
            content: {
              Text: { text: { literalString: 'Confirm' } },
            },
            variant: 'primary',
          },
        },
      });
      components.push({
        id: 'cancel-btn',
        component: {
          Button: {
            onClick: { actionId: 'cancel', parameters: { questionId: question.id } },
            content: {
              Text: { text: { literalString: 'Cancel' } },
            },
            variant: 'secondary',
          },
        },
      });
      break;
    }

    case 'select': {
      const options = question.options?.map((opt) => ({
        label: { literalString: opt.label },
        value: opt.value,
      })) || [];
      components.push({
        id: 'select',
        component: {
          Dropdown: {
            options,
            selectedValue: question.defaultValue ? { literalString: String(question.defaultValue) } : undefined,
            onChange: { actionId: 'answer', parameters: { questionId: question.id } },
            placeholder: question.placeholder || 'Select an option',
          },
        },
      });
      break;
    }

    case 'multi-select': {
      const options = question.options?.map((opt) => ({
        label: { literalString: opt.label },
        value: opt.value,
      })) || [];
      components.push({
        id: 'checkboxes',
        component: {
          Card: {
            content: options.map((opt, idx) => ({
              id: `checkbox-${idx}`,
              component: {
                Checkbox: {
                  label: opt.label,
                  onChange: { actionId: 'toggle', parameters: { questionId: question.id, value: opt.value } },
                },
              },
            })),
          },
        },
      });
      break;
    }

    case 'input': {
      components.push({
        id: 'input',
        component: {
          TextField: {
            value: question.defaultValue ? { literalString: String(question.defaultValue) } : undefined,
            onChange: { actionId: 'answer', parameters: { questionId: question.id } },
            placeholder: question.placeholder || 'Enter your answer',
            type: 'text',
          },
        },
      });
      break;
    }
  }

  return {
    surfaceUpdate: {
      surfaceId,
      components,
      initialState: {
        questionId: question.id,
        questionType: question.type,
        options: question.options,
        required: question.required,
      },
    },
  };
}

// ========== Question Handler ==========

/**
 * Execute ask_question tool
 * @param params - Tool parameters
 * @returns Tool result with answer or timeout
 */
export async function execute(params: AskQuestionParams): Promise<ToolResult<AskQuestionResult>> {
  try {
    // Validate question
    const question = validateQuestion(params.question);

    // Generate surface ID
    const surfaceId = params.surfaceId || `question-${question.id}-${Date.now()}`;

    // Create promise for answer
    const resultPromise = new Promise<AskQuestionResult>((resolve, reject) => {
      // Store pending question
      const pendingQuestion: PendingQuestion = {
        id: question.id,
        surfaceId,
        question,
        timestamp: Date.now(),
        timeout: params.timeout || DEFAULT_TIMEOUT_MS,
        resolve,
        reject,
      };
      pendingQuestions.set(question.id, pendingQuestion);

      // Set timeout
      setTimeout(() => {
        if (pendingQuestions.has(question.id)) {
          pendingQuestions.delete(question.id);
          resolve({
            success: false,
            surfaceId,
            cancelled: false,
            answers: [],
            timestamp: new Date().toISOString(),
            error: 'Question timed out',
          });
        }
      }, params.timeout || DEFAULT_TIMEOUT_MS);
    });

    // Send A2UI surface via WebSocket to frontend
    const a2uiSurface = generateQuestionSurface(question, surfaceId);
    a2uiWebSocketHandler.sendSurface(a2uiSurface.surfaceUpdate);

    // Wait for answer
    const result = await resultPromise;

    return {
      success: true,
      result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ========== Answer Handler ==========

/**
 * Handle incoming answer from frontend
 * @param answer - Answer from user
 * @returns True if answer was processed
 */
export function handleAnswer(answer: QuestionAnswer): boolean {
  const pending = pendingQuestions.get(answer.questionId);
  if (!pending) {
    return false;
  }

  // Validate answer
  if (!validateAnswer(pending.question, answer)) {
    return false;
  }

  // Resolve promise
  pending.resolve({
    success: true,
    surfaceId: pending.surfaceId,
    cancelled: answer.cancelled || false,
    answers: [answer],
    timestamp: new Date().toISOString(),
  });

  // Remove from pending
  pendingQuestions.delete(answer.questionId);

  return true;
}

// ========== Cleanup ==========

/**
 * Cancel a pending question
 * @param questionId - Question ID to cancel
 * @returns True if question was cancelled
 */
export function cancelQuestion(questionId: string): boolean {
  const pending = pendingQuestions.get(questionId);
  if (!pending) {
    return false;
  }

  pending.resolve({
    success: false,
    surfaceId: pending.surfaceId,
    cancelled: true,
    answers: [],
    timestamp: new Date().toISOString(),
    error: 'Question cancelled',
  });

  pendingQuestions.delete(questionId);
  return true;
}

/**
 * Get all pending questions
 * @returns Array of pending questions
 */
export function getPendingQuestions(): PendingQuestion[] {
  return Array.from(pendingQuestions.values());
}

/**
 * Clear all pending questions
 */
export function clearPendingQuestions(): void {
  for (const pending of pendingQuestions.values()) {
    pending.reject(new Error('Question cleared'));
  }
  pendingQuestions.clear();
}

// ========== Tool Schema ==========

export const schema: ToolSchema = {
  name: 'ask_question',
  description: 'Ask the user a question through an interactive A2UI interface. Supports confirmation dialogs, selection from options, text input, and multi-select checkboxes.',
  inputSchema: {
    type: 'object',
    properties: {
      question: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique identifier for this question' },
          type: {
            type: 'string',
            enum: ['confirm', 'select', 'input', 'multi-select'],
            description: 'Question type: confirm (yes/no), select (dropdown), input (text field), multi-select (checkboxes)',
          },
          title: { type: 'string', description: 'Question title' },
          message: { type: 'string', description: 'Additional message text' },
          description: { type: 'string', description: 'Helper text' },
          options: {
            type: 'array',
            description: 'Options for select/multi-select questions',
            items: {
              type: 'object',
              properties: {
                value: { type: 'string' },
                label: { type: 'string' },
                description: { type: 'string' },
              },
              required: ['value', 'label'],
            },
          },
          defaultValue: { type: 'string', description: 'Default value' },
          required: { type: 'boolean', description: 'Whether an answer is required' },
          placeholder: { type: 'string', description: 'Placeholder text for input fields' },
        },
        required: ['id', 'type', 'title'],
      },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default: 300000 / 5 minutes)' },
      surfaceId: { type: 'string', description: 'Custom surface ID (auto-generated if not provided)' },
    },
    required: ['question'],
  },
};

/**
 * Tool handler for MCP integration
 * Wraps the execute function to match the expected handler signature
 */
export async function handler(params: Record<string, unknown>): Promise<ToolResult<AskQuestionResult>> {
  return execute(params as AskQuestionParams);
}
