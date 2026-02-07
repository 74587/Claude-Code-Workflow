// ========================================
// A2UI Protocol Parser
// ========================================
// Parses and validates A2UI surface update JSON

import { z } from 'zod';
import {
  SurfaceUpdateSchema,
  SurfaceUpdate,
  ComponentSchema,
  A2UIComponent,
} from './A2UITypes';

// ========== Error Class ==========

/** Custom error for A2UI parsing failures */
export class A2UIParseError extends Error {
  public readonly originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message);
    this.name = 'A2UIParseError';
    this.originalError = originalError;
  }

  /** Get detailed error information */
  getDetails(): string {
    if (this.originalError instanceof z.ZodError) {
      return this.originalError.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
    }
    if (this.originalError instanceof Error) {
      return this.originalError.message;
    }
    return this.message;
  }
}

// ========== Parser Class ==========

/**
 * A2UI Protocol Parser
 * Parses JSON strings into validated SurfaceUpdate objects
 */
export class A2UIParser {
  /**
   * Parse JSON string into SurfaceUpdate
   * @param json - JSON string to parse
   * @returns Validated SurfaceUpdate object
   * @throws A2UIParseError if JSON is invalid or doesn't match schema
   */
  parse(json: string): SurfaceUpdate {
    try {
      // First, parse JSON
      const data = JSON.parse(json);

      // Then validate against schema
      return SurfaceUpdateSchema.parse(data);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new A2UIParseError(`Invalid JSON: ${error.message}`, error);
      }
      if (error instanceof z.ZodError) {
        throw new A2UIParseError(
          `A2UI validation failed: ${error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
          error
        );
      }
      throw new A2UIParseError(`Failed to parse A2UI surface: ${error instanceof Error ? error.message : String(error)}`, error);
    }
  }

  /**
   * Parse object into SurfaceUpdate
   * @param data - Object to validate
   * @returns Validated SurfaceUpdate object
   * @throws A2UIParseError if object doesn't match schema
   */
  parseObject(data: unknown): SurfaceUpdate {
    try {
      return SurfaceUpdateSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new A2UIParseError(
          `A2UI validation failed: ${error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
          error
        );
      }
      throw new A2UIParseError(`Failed to validate A2UI surface: ${error instanceof Error ? error.message : String(error)}`, error);
    }
  }

  /**
   * Type guard to check if value is a valid SurfaceUpdate
   * @param value - Value to check
   * @returns True if value is a valid SurfaceUpdate
   */
  validate(value: unknown): value is SurfaceUpdate {
    return SurfaceUpdateSchema.safeParse(value).success;
  }

  /**
   * Safe parse that returns result instead of throwing
   * @param json - JSON string to parse
   * @returns Result object with success flag and data or error
   */
  safeParse(json: string): ReturnType<typeof SurfaceUpdateSchema.safeParse> {
    try {
      const data = JSON.parse(json);
      return SurfaceUpdateSchema.safeParse(data);
    } catch (error) {
      return {
        success: false as const,
        error: error as any,
      };
    }
  }

  /**
   * Safe parse object that returns result instead of throwing
   * @param data - Object to validate
   * @returns Result object with success flag and data or error
   */
  safeParseObject(data: unknown): ReturnType<typeof SurfaceUpdateSchema.safeParse> {
    return SurfaceUpdateSchema.safeParse(data);
  }

  /**
   * Validate a component against the component schema
   * @param component - Component to validate
   * @returns True if component is valid
   */
  validateComponent(component: unknown): component is A2UIComponent {
    return ComponentSchema.safeParse(component).success;
  }
}

// ========== Singleton Export ==========

/** Default parser instance */
export const a2uiParser = new A2UIParser();
