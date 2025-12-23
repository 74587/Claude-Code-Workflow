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
 * Predefined models for each provider
 * Used for UI selection and validation
 */
export const PROVIDER_MODELS: Record<ProviderType, ModelInfo[]> = {
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
      id: 'o1-mini',
      name: 'O1 Mini',
      contextWindow: 128000,
      supportsCaching: true
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      contextWindow: 128000,
      supportsCaching: false
    }
  ],

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

  ollama: [
    {
      id: 'llama3.2',
      name: 'Llama 3.2',
      contextWindow: 128000,
      supportsCaching: false
    },
    {
      id: 'llama3.1',
      name: 'Llama 3.1',
      contextWindow: 128000,
      supportsCaching: false
    },
    {
      id: 'qwen2.5-coder',
      name: 'Qwen 2.5 Coder',
      contextWindow: 32000,
      supportsCaching: false
    },
    {
      id: 'codellama',
      name: 'Code Llama',
      contextWindow: 16000,
      supportsCaching: false
    },
    {
      id: 'mistral',
      name: 'Mistral',
      contextWindow: 32000,
      supportsCaching: false
    }
  ],

  azure: [
    {
      id: 'gpt-4o',
      name: 'GPT-4o (Azure)',
      contextWindow: 128000,
      supportsCaching: true
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini (Azure)',
      contextWindow: 128000,
      supportsCaching: true
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo (Azure)',
      contextWindow: 128000,
      supportsCaching: false
    },
    {
      id: 'gpt-35-turbo',
      name: 'GPT-3.5 Turbo (Azure)',
      contextWindow: 16000,
      supportsCaching: false
    }
  ],

  google: [
    {
      id: 'gemini-2.0-flash-exp',
      name: 'Gemini 2.0 Flash Experimental',
      contextWindow: 1048576,
      supportsCaching: true
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      contextWindow: 2097152,
      supportsCaching: true
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      contextWindow: 1048576,
      supportsCaching: true
    },
    {
      id: 'gemini-1.0-pro',
      name: 'Gemini 1.0 Pro',
      contextWindow: 32000,
      supportsCaching: false
    }
  ],

  mistral: [
    {
      id: 'mistral-large-latest',
      name: 'Mistral Large',
      contextWindow: 128000,
      supportsCaching: false
    },
    {
      id: 'mistral-medium-latest',
      name: 'Mistral Medium',
      contextWindow: 32000,
      supportsCaching: false
    },
    {
      id: 'mistral-small-latest',
      name: 'Mistral Small',
      contextWindow: 32000,
      supportsCaching: false
    },
    {
      id: 'codestral-latest',
      name: 'Codestral',
      contextWindow: 32000,
      supportsCaching: false
    }
  ],

  deepseek: [
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
    }
  ],

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
