/**
 * CLI Tool Model Reference Library
 *
 * System reference for available models per CLI tool provider.
 * This is a read-only reference, NOT user configuration.
 * User configuration is managed via tools.{tool}.primaryModel/secondaryModel in cli-tools.json
 */

export interface ProviderModelInfo {
  id: string;
  name: string;
  capabilities?: string[];
  contextWindow?: number;
  deprecated?: boolean;
}

export interface ProviderInfo {
  name: string;
  models: ProviderModelInfo[];
}

/**
 * System reference for CLI tool models
 * Maps provider names to their available models
 */
export const PROVIDER_MODELS: Record<string, ProviderInfo> = {
  google: {
    name: 'Google AI',
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', capabilities: ['text', 'vision', 'code'], contextWindow: 1000000 },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', capabilities: ['text', 'code'], contextWindow: 1000000 },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', capabilities: ['text'], contextWindow: 1000000 },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', capabilities: ['text', 'vision'], contextWindow: 2000000 },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', capabilities: ['text'], contextWindow: 1000000 }
    ]
  },
  qwen: {
    name: 'Qwen',
    models: [
      { id: 'coder-model', name: 'Qwen Coder', capabilities: ['code'] },
      { id: 'vision-model', name: 'Qwen Vision', capabilities: ['vision'] },
      { id: 'qwen2.5-coder-32b', name: 'Qwen 2.5 Coder 32B', capabilities: ['code'] }
    ]
  },
  openai: {
    name: 'OpenAI',
    models: [
      { id: 'gpt-5.2', name: 'GPT-5.2', capabilities: ['text', 'code'] },
      { id: 'gpt-4.1', name: 'GPT-4.1', capabilities: ['text', 'code'] },
      { id: 'o4-mini', name: 'O4 Mini', capabilities: ['text'] },
      { id: 'o3', name: 'O3', capabilities: ['text'] }
    ]
  },
  anthropic: {
    name: 'Anthropic',
    models: [
      { id: 'sonnet', name: 'Claude Sonnet', capabilities: ['text', 'code'] },
      { id: 'opus', name: 'Claude Opus', capabilities: ['text', 'code', 'vision'] },
      { id: 'haiku', name: 'Claude Haiku', capabilities: ['text'] },
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude 4.5 Sonnet (2025-09-29)', capabilities: ['text', 'code'] },
      { id: 'claude-opus-4-5-20251101', name: 'Claude 4.5 Opus (2025-11-01)', capabilities: ['text', 'code', 'vision'] }
    ]
  },
  litellm: {
    name: 'LiteLLM Aggregator',
    models: [
      { id: 'opencode/glm-4.7-free', name: 'GLM-4.7 Free', capabilities: ['text'] },
      { id: 'opencode/gpt-5-nano', name: 'GPT-5 Nano', capabilities: ['text'] },
      { id: 'opencode/grok-code', name: 'Grok Code', capabilities: ['code'] },
      { id: 'opencode/minimax-m2.1-free', name: 'MiniMax M2.1 Free', capabilities: ['text'] },
      { id: 'anthropic/claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (via LiteLLM)', capabilities: ['text'] },
      { id: 'anthropic/claude-opus-4-20250514', name: 'Claude Opus 4 (via LiteLLM)', capabilities: ['text'] },
      { id: 'openai/gpt-4.1', name: 'GPT-4.1 (via LiteLLM)', capabilities: ['text'] },
      { id: 'openai/o3', name: 'O3 (via LiteLLM)', capabilities: ['text'] },
      { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro (via LiteLLM)', capabilities: ['text'] },
      { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash (via LiteLLM)', capabilities: ['text'] }
    ]
  }
} as const;

/**
 * Get models for a specific provider
 * @param provider - Provider name (e.g., 'google', 'qwen', 'openai', 'anthropic', 'litellm')
 * @returns Array of model information
 */
export function getProviderModels(provider: string): ProviderModelInfo[] {
  return PROVIDER_MODELS[provider]?.models || [];
}

/**
 * Get all provider names
 * @returns Array of provider names
 */
export function getAllProviders(): string[] {
  return Object.keys(PROVIDER_MODELS);
}

/**
 * Find model information across all providers
 * @param modelId - Model identifier to search for
 * @returns Model information or undefined if not found
 */
export function findModelInfo(modelId: string): ProviderModelInfo | undefined {
  for (const provider of Object.values(PROVIDER_MODELS)) {
    const model = provider.models.find(m => m.id === modelId);
    if (model) return model;
  }
  return undefined;
}

/**
 * Get provider name for a model ID
 * @param modelId - Model identifier
 * @returns Provider name or undefined if not found
 */
export function getProviderForModel(modelId: string): string | undefined {
  for (const [providerId, provider] of Object.entries(PROVIDER_MODELS)) {
    if (provider.models.some(m => m.id === modelId)) {
      return providerId;
    }
  }
  return undefined;
}
