/**
 * LiteLLM Client - STUB (v1 Python bridge removed)
 *
 * The Python ccw-litellm bridge has been removed. This module provides
 * no-op stubs so that existing consumers compile without errors.
 */

const V1_REMOVED = 'LiteLLM Python bridge has been removed (v1 cleanup).';

export interface LiteLLMConfig {
  pythonPath?: string;
  configPath?: string;
  timeout?: number;
}

export function getCodexLensVenvPython(): string {
  return 'python';
}

export function getCodexLensPythonPath(): string {
  return 'python';
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface EmbedResponse {
  vectors: number[][];
  dimensions: number;
  model: string;
}

export interface LiteLLMStatus {
  available: boolean;
  version?: string;
  error?: string;
}

export class LiteLLMClient {
  constructor(_config: LiteLLMConfig = {}) {}

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async getStatus(): Promise<LiteLLMStatus> {
    return { available: false, error: V1_REMOVED };
  }

  async getConfig(): Promise<unknown> {
    return { error: V1_REMOVED };
  }

  async embed(_texts: string[], _model?: string): Promise<EmbedResponse> {
    throw new Error(V1_REMOVED);
  }

  async chat(_message: string, _model?: string): Promise<string> {
    throw new Error(V1_REMOVED);
  }

  async chatMessages(_messages: ChatMessage[], _model?: string): Promise<ChatResponse> {
    throw new Error(V1_REMOVED);
  }
}

let _client: LiteLLMClient | null = null;

export function getLiteLLMClient(config?: LiteLLMConfig): LiteLLMClient {
  if (!_client) {
    _client = new LiteLLMClient(config);
  }
  return _client;
}

export async function checkLiteLLMAvailable(): Promise<boolean> {
  return false;
}

export async function getLiteLLMStatus(): Promise<LiteLLMStatus> {
  return { available: false, error: V1_REMOVED };
}
