import { z } from 'zod';

// Tool parameter schema for Zod validation
export const ToolParamSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  description: z.string(),
  required: z.boolean().default(false),
  default: z.any().optional(),
  enum: z.array(z.string()).optional(),
});

export type ToolParam = z.infer<typeof ToolParamSchema>;

// Tool Schema definition (MCP compatible)
export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Tool execution result
export interface ToolResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
}

// Tool handler function type
export type ToolHandler<TParams = Record<string, unknown>, TResult = unknown> =
  (params: TParams) => Promise<ToolResult<TResult>>;

// Tool registration entry
export interface ToolRegistration<TParams = Record<string, unknown>> {
  schema: ToolSchema;
  handler: ToolHandler<TParams>;
}
