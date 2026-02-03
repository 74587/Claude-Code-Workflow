// ========================================
// Error Sanitizer Utility
// ========================================
// Maps technical errors to user-friendly messages

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTH = 'auth',
  SERVER = 'server',
  TIMEOUT = 'timeout',
  NOT_FOUND = 'not_found',
  UNKNOWN = 'unknown',
}

/**
 * Sanitized error result with user-friendly message
 */
export interface SanitizedError {
  /** User-friendly message key for i18n */
  messageKey: string;
  /** Error category for styling/icon selection */
  category: ErrorCategory;
  /** Whether operation can be retried */
  retryable: boolean;
  /** Optional context variables for message interpolation */
  context?: Record<string, string>;
}

/**
 * Sanitize error messages for user display
 * @param error - Error object or message
 * @param operation - Operation context (e.g., 'skillToggle', 'sessionCreate')
 * @returns Sanitized error with user-friendly message
 */
export function sanitizeErrorMessage(
  error: unknown,
  operation: string
): SanitizedError {
  // Default fallback
  const defaultError: SanitizedError = {
    messageKey: `feedback.${operation}.error`,
    category: ErrorCategory.UNKNOWN,
    retryable: true,
  };

  // Handle string errors
  if (typeof error === 'string') {
    return categorizeStringError(error, operation);
  }

  // Handle Error objects
  if (error instanceof Error) {
    return categorizeErrorObject(error, operation);
  }

  // Handle ApiError-like objects (from API layer)
  if (isApiError(error)) {
    return categorizeApiError(error, operation);
  }

  // Handle generic objects with message property
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return categorizeErrorObject(
      new Error(String(error.message)),
      operation
    );
  }

  return defaultError;
}

/**
 * Check if error is ApiError from API layer
 */
function isApiError(error: unknown): error is { status: number; message?: string; code?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  );
}

/**
 * Categorize string errors
 */
function categorizeStringError(message: string, operation: string): SanitizedError {
  const lowerMessage = message.toLowerCase();

  // Network errors
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
    return {
      messageKey: 'feedback.error.network',
      category: ErrorCategory.NETWORK,
      retryable: true,
    };
  }

  // Timeout errors
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return {
      messageKey: 'feedback.error.timeout',
      category: ErrorCategory.TIMEOUT,
      retryable: true,
    };
  }

  // Auth errors
  if (
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('forbidden') ||
    lowerMessage.includes('auth')
  ) {
    return {
      messageKey: 'feedback.error.auth',
      category: ErrorCategory.AUTH,
      retryable: false,
    };
  }

  // Validation errors
  if (
    lowerMessage.includes('validation') ||
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('required')
  ) {
    return {
      messageKey: 'feedback.error.validation',
      category: ErrorCategory.VALIDATION,
      retryable: false,
    };
  }

  // Server errors
  if (lowerMessage.includes('server') || lowerMessage.includes('500')) {
    return {
      messageKey: 'feedback.error.server',
      category: ErrorCategory.SERVER,
      retryable: true,
    };
  }

  // Not found errors
  if (lowerMessage.includes('not found') || lowerMessage.includes('404')) {
    return {
      messageKey: 'feedback.error.notFound',
      category: ErrorCategory.NOT_FOUND,
      retryable: false,
    };
  }

  // Operation-specific error
  return {
    messageKey: `feedback.${operation}.error`,
    category: ErrorCategory.UNKNOWN,
    retryable: true,
  };
}

/**
 * Categorize Error objects
 */
function categorizeErrorObject(error: Error, operation: string): SanitizedError {
  const message = error.message.toLowerCase();

  // Network errors (often include "ECONNREFUSED", "ENOTFOUND")
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('failed to fetch')
  ) {
    return {
      messageKey: 'feedback.error.network',
      category: ErrorCategory.NETWORK,
      retryable: true,
    };
  }

  // Timeout errors
  if (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('etimedout')
  ) {
    return {
      messageKey: 'feedback.error.timeout',
      category: ErrorCategory.TIMEOUT,
      retryable: true,
    };
  }

  // Auth errors
  if (
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('401') ||
    message.includes('403')
  ) {
    return {
      messageKey: 'feedback.error.auth',
      category: ErrorCategory.AUTH,
      retryable: false,
    };
  }

  // Validation errors
  if (
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('required')
  ) {
    return {
      messageKey: 'feedback.error.validation',
      category: ErrorCategory.VALIDATION,
      retryable: false,
    };
  }

  // Server errors
  if (
    message.includes('server') ||
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503')
  ) {
    return {
      messageKey: 'feedback.error.server',
      category: ErrorCategory.SERVER,
      retryable: true,
    };
  }

  // Not found errors
  if (message.includes('not found') || message.includes('404')) {
    return {
      messageKey: 'feedback.error.notFound',
      category: ErrorCategory.NOT_FOUND,
      retryable: false,
    };
  }

  // Operation-specific error
  return {
    messageKey: `feedback.${operation}.error`,
    category: ErrorCategory.UNKNOWN,
    retryable: true,
  };
}

/**
 * Categorize API errors with status codes
 */
function categorizeApiError(
  error: { status: number; message?: string; code?: string },
  operation: string
): SanitizedError {
  const { status, code } = error;

  // Network errors (status 0)
  if (status === 0) {
    return {
      messageKey: 'feedback.error.network',
      category: ErrorCategory.NETWORK,
      retryable: true,
    };
  }

  // Timeout errors
  if (status === 408 || code === 'ETIMEDOUT') {
    return {
      messageKey: 'feedback.error.timeout',
      category: ErrorCategory.TIMEOUT,
      retryable: true,
    };
  }

  // Auth errors
  if (status === 401 || status === 403) {
    return {
      messageKey: 'feedback.error.auth',
      category: ErrorCategory.AUTH,
      retryable: false,
    };
  }

  // Validation errors
  if (status === 400 || status === 422) {
    return {
      messageKey: 'feedback.error.validation',
      category: ErrorCategory.VALIDATION,
      retryable: false,
    };
  }

  // Not found errors
  if (status === 404) {
    return {
      messageKey: 'feedback.error.notFound',
      category: ErrorCategory.NOT_FOUND,
      retryable: false,
    };
  }

  // Server errors
  if (status >= 500) {
    return {
      messageKey: 'feedback.error.server',
      category: ErrorCategory.SERVER,
      retryable: true,
    };
  }

  // Operation-specific error
  return {
    messageKey: `feedback.${operation}.error`,
    category: ErrorCategory.UNKNOWN,
    retryable: status < 500,
  };
}

/**
 * Get success message key for an operation
 * @param operation - Operation identifier
 * @returns i18n message key
 */
export function getSuccessMessageKey(operation: string): string {
  return `feedback.${operation}.success`;
}

/**
 * Get default feedback message keys for common operations
 */
export const DEFAULT_FEEDBACK_KEYS = {
  // Skill operations
  skillToggle: {
    success: 'feedback.skillToggle.success',
    error: 'feedback.skillToggle.error',
  },
  skillEnable: {
    success: 'feedback.skillEnable.success',
    error: 'feedback.skillEnable.error',
  },
  skillDisable: {
    success: 'feedback.skillDisable.success',
    error: 'feedback.skillDisable.error',
  },

  // Command operations
  commandExecute: {
    success: 'feedback.commandExecute.success',
    error: 'feedback.commandExecute.error',
  },
  commandToggle: {
    success: 'feedback.commandToggle.success',
    error: 'feedback.commandToggle.error',
  },

  // Session operations
  sessionCreate: {
    success: 'feedback.sessionCreate.success',
    error: 'feedback.sessionCreate.error',
  },
  sessionDelete: {
    success: 'feedback.sessionDelete.success',
    error: 'feedback.sessionDelete.error',
  },
  sessionUpdate: {
    success: 'feedback.sessionUpdate.success',
    error: 'feedback.sessionUpdate.error',
  },

  // Settings operations
  settingsSave: {
    success: 'feedback.settingsSave.success',
    error: 'feedback.settingsSave.error',
  },
  settingsReset: {
    success: 'feedback.settingsReset.success',
    error: 'feedback.settingsReset.error',
  },

  // Memory operations
  memoryImport: {
    success: 'feedback.memoryImport.success',
    error: 'feedback.memoryImport.error',
  },
  memoryExport: {
    success: 'feedback.memoryExport.success',
    error: 'feedback.memoryExport.error',
  },
  memoryDelete: {
    success: 'feedback.memoryDelete.success',
    error: 'feedback.memoryDelete.error',
  },

  // Coordinator operations
  coordinatorStart: {
    success: 'feedback.coordinatorStart.success',
    error: 'feedback.coordinatorStart.error',
  },
  coordinatorStop: {
    success: 'feedback.coordinatorStop.success',
    error: 'feedback.coordinatorStop.error',
  },

  // Hook operations
  hookToggle: {
    success: 'feedback.hookToggle.success',
    error: 'feedback.hookToggle.error',
  },

  // Index operations
  indexRebuild: {
    success: 'feedback.indexRebuild.success',
    error: 'feedback.indexRebuild.error',
  },
} as const;
