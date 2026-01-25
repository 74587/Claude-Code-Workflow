/**
 * Provider Model Presets
 *
 * Predefined model information for each supported LLM provider.
 * Used for UI dropdowns and validation.
 */

import type { ProviderType } from '../types/litellm-api-config.js';

/**
 * Model information metadata
 */
export interface ModelInfo {
  /** Model identifier (used in API calls) */
  id: string;

  /** Human-readable display name */
  name: string;

  /** Context window size in tokens */
  contextWindow: number;

  /** Whether this model supports prompt caching */
  supportsCaching: boolean;
}

/**
 * Embedding model information metadata
 */
export interface EmbeddingModelInfo {
  /** Model identifier (used in API calls) */
  id: string;

  /** Human-readable display name */
  name: string;

  /** Embedding dimensions */
  dimensions: number;

  /** Maximum input tokens */
  maxTokens: number;

  /** Provider identifier */
  provider: string;
}


/**
 * Predefined models for each API format
 * Used for UI selection and validation
 * Note: Most providers use OpenAI-compatible format
 */
export const PROVIDER_MODELS: Record<ProviderType, ModelInfo[]> = {
  // OpenAI-compatible format (used by OpenAI, DeepSeek, Ollama, etc.)
  openai: [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      contextWindow: 128000,
      supportsCaching: true
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      contextWindow: 128000,
      supportsCaching: true
    },
    {
      id: 'o1',
      name: 'O1',
      contextWindow: 200000,
      supportsCaching: true
    },
    {
      id: 'deepseek-chat',
      name: 'DeepSeek Chat',
      contextWindow: 64000,
      supportsCaching: false
    },
    {
      id: 'deepseek-coder',
      name: 'DeepSeek Coder',
      contextWindow: 64000,
      supportsCaching: false
    },
    {
      id: 'llama3.2',
      name: 'Llama 3.2',
      contextWindow: 128000,
      supportsCaching: false
    },
    {
      id: 'qwen2.5-coder',
      name: 'Qwen 2.5 Coder',
      contextWindow: 32000,
      supportsCaching: false
    }
  ],

  // Anthropic format
  anthropic: [
    {
      id: 'claude-sonnet-4-20250514',
      name: 'Claude Sonnet 4',
      contextWindow: 200000,
      supportsCaching: true
    },
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      contextWindow: 200000,
      supportsCaching: true
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      contextWindow: 200000,
      supportsCaching: true
    },
    {
      id: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      contextWindow: 200000,
      supportsCaching: false
    }
  ],

  // Custom format
  custom: [
    {
      id: 'custom-model',
      name: 'Custom Model',
      contextWindow: 128000,
      supportsCaching: false
    }
  ]
};

/**
 * Get models for a specific provider
 * @param providerType - Provider type to get models for
 * @returns Array of model information
 */
export function getModelsForProvider(providerType: ProviderType): ModelInfo[] {
  return PROVIDER_MODELS[providerType] || [];
}

/**
 * Predefined embedding models for each API format
 * Used for UI selection and validation
 */
export const EMBEDDING_MODELS: Record<ProviderType, EmbeddingModelInfo[]> = {
  // OpenAI embedding models
  openai: [
    {
      id: 'text-embedding-3-small',
      name: 'Text Embedding 3 Small',
      dimensions: 1536,
      maxTokens: 8191,
      provider: 'openai'
    },
    {
      id: 'text-embedding-3-large',
      name: 'Text Embedding 3 Large',
      dimensions: 3072,
      maxTokens: 8191,
      provider: 'openai'
    },
    {
      id: 'text-embedding-ada-002',
      name: 'Ada 002',
      dimensions: 1536,
      maxTokens: 8191,
      provider: 'openai'
    }
  ],

  // Anthropic doesn't have embedding models
  anthropic: [],

  // Custom embedding models
  custom: [
    {
      id: 'custom-embedding',
      name: 'Custom Embedding',
      dimensions: 1536,
      maxTokens: 8192,
      provider: 'custom'
    }
  ]
};

/**
 * Get embedding models for a specific provider
 * @param providerType - Provider type to get embedding models for
 * @returns Array of embedding model information
 */
export function getEmbeddingModelsForProvider(providerType: ProviderType): EmbeddingModelInfo[] {
  return EMBEDDING_MODELS[providerType] || [];
}


/**
 * Get model information by ID within a provider
 * @param providerType - Provider type
 * @param modelId - Model identifier
 * @returns Model information or undefined if not found
 */
export function getModelInfo(providerType: ProviderType, modelId: string): ModelInfo | undefined {
  const models = PROVIDER_MODELS[providerType] || [];
  return models.find(m => m.id === modelId);
}

/**
 * Validate if a model ID is supported by a provider
 * @param providerType - Provider type
 * @param modelId - Model identifier to validate
 * @returns true if model is valid for provider
 */
export function isValidModel(providerType: ProviderType, modelId: string): boolean {
  return getModelInfo(providerType, modelId) !== undefined;
}
