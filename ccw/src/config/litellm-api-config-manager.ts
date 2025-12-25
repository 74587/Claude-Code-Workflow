/**
 * LiteLLM API Configuration Manager
 * Manages provider credentials, custom endpoints, and cache settings
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { StoragePaths, GlobalPaths, ensureStorageDir } from './storage-paths.js';
import type {
  LiteLLMApiConfig,
  ProviderCredential,
  CustomEndpoint,
  GlobalCacheSettings,
  ProviderType,
  CacheStrategy,
  CodexLensEmbeddingRotation,
  CodexLensEmbeddingProvider,
} from '../types/litellm-api-config.js';

/**
 * Default configuration
 */
function getDefaultConfig(): LiteLLMApiConfig {
  return {
    version: 1,
    providers: [],
    endpoints: [],
    globalCacheSettings: {
      enabled: true,
      cacheDir: '~/.ccw/cache/context',
      maxTotalSizeMB: 100,
    },
  };
}

/**
 * Get config file path (global, shared across all projects)
 */
function getConfigPath(_baseDir?: string): string {
  const configDir = GlobalPaths.config();
  ensureStorageDir(configDir);
  return join(configDir, 'litellm-api-config.json');
}

/**
 * Load configuration from file
 */
export function loadLiteLLMApiConfig(baseDir: string): LiteLLMApiConfig {
  const configPath = getConfigPath(baseDir);

  if (!existsSync(configPath)) {
    return getDefaultConfig();
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as LiteLLMApiConfig;
  } catch (error) {
    console.error('[LiteLLM Config] Failed to load config:', error);
    return getDefaultConfig();
  }
}

/**
 * Save configuration to file
 */
function saveConfig(baseDir: string, config: LiteLLMApiConfig): void {
  const configPath = getConfigPath(baseDir);
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Resolve environment variables in API key
 * Supports ${ENV_VAR} syntax
 */
export function resolveEnvVar(value: string): string {
  if (!value) return value;

  const envVarMatch = value.match(/^\$\{(.+)\}$/);
  if (envVarMatch) {
    const envVarName = envVarMatch[1];
    return process.env[envVarName] || '';
  }

  return value;
}

// ===========================
// Provider Management
// ===========================

/**
 * Get all providers
 */
export function getAllProviders(baseDir: string): ProviderCredential[] {
  const config = loadLiteLLMApiConfig(baseDir);
  return config.providers;
}

/**
 * Get provider by ID
 */
export function getProvider(baseDir: string, providerId: string): ProviderCredential | null {
  const config = loadLiteLLMApiConfig(baseDir);
  return config.providers.find((p) => p.id === providerId) || null;
}

/**
 * Get provider with resolved environment variables
 */
export function getProviderWithResolvedEnvVars(
  baseDir: string,
  providerId: string
): (ProviderCredential & { resolvedApiKey: string }) | null {
  const provider = getProvider(baseDir, providerId);
  if (!provider) return null;

  return {
    ...provider,
    resolvedApiKey: resolveEnvVar(provider.apiKey),
  };
}

/**
 * Add new provider
 */
export function addProvider(
  baseDir: string,
  providerData: Omit<ProviderCredential, 'id' | 'createdAt' | 'updatedAt'>
): ProviderCredential {
  const config = loadLiteLLMApiConfig(baseDir);

  const provider: ProviderCredential = {
    ...providerData,
    id: `${providerData.type}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  config.providers.push(provider);
  saveConfig(baseDir, config);

  return provider;
}

/**
 * Update provider
 */
export function updateProvider(
  baseDir: string,
  providerId: string,
  updates: Partial<Omit<ProviderCredential, 'id' | 'createdAt' | 'updatedAt'>>
): ProviderCredential {
  const config = loadLiteLLMApiConfig(baseDir);
  const providerIndex = config.providers.findIndex((p) => p.id === providerId);

  if (providerIndex === -1) {
    throw new Error(`Provider not found: ${providerId}`);
  }

  config.providers[providerIndex] = {
    ...config.providers[providerIndex],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveConfig(baseDir, config);
  return config.providers[providerIndex];
}

/**
 * Delete provider
 */
export function deleteProvider(baseDir: string, providerId: string): boolean {
  const config = loadLiteLLMApiConfig(baseDir);
  const initialLength = config.providers.length;

  config.providers = config.providers.filter((p) => p.id !== providerId);

  if (config.providers.length === initialLength) {
    return false;
  }

  // Also remove endpoints using this provider
  config.endpoints = config.endpoints.filter((e) => e.providerId !== providerId);

  saveConfig(baseDir, config);
  return true;
}

// ===========================
// Endpoint Management
// ===========================

/**
 * Get all endpoints
 */
export function getAllEndpoints(baseDir: string): CustomEndpoint[] {
  const config = loadLiteLLMApiConfig(baseDir);
  return config.endpoints;
}

/**
 * Get endpoint by ID
 */
export function getEndpoint(baseDir: string, endpointId: string): CustomEndpoint | null {
  const config = loadLiteLLMApiConfig(baseDir);
  return config.endpoints.find((e) => e.id === endpointId) || null;
}

/**
 * Find endpoint by ID (alias for getEndpoint)
 */
export function findEndpointById(baseDir: string, endpointId: string): CustomEndpoint | null {
  return getEndpoint(baseDir, endpointId);
}

/**
 * Add new endpoint
 */
export function addEndpoint(
  baseDir: string,
  endpointData: Omit<CustomEndpoint, 'createdAt' | 'updatedAt'>
): CustomEndpoint {
  const config = loadLiteLLMApiConfig(baseDir);

  // Check if ID already exists
  if (config.endpoints.some((e) => e.id === endpointData.id)) {
    throw new Error(`Endpoint ID already exists: ${endpointData.id}`);
  }

  // Verify provider exists
  if (!config.providers.find((p) => p.id === endpointData.providerId)) {
    throw new Error(`Provider not found: ${endpointData.providerId}`);
  }

  const endpoint: CustomEndpoint = {
    ...endpointData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  config.endpoints.push(endpoint);
  saveConfig(baseDir, config);

  return endpoint;
}

/**
 * Update endpoint
 */
export function updateEndpoint(
  baseDir: string,
  endpointId: string,
  updates: Partial<Omit<CustomEndpoint, 'id' | 'createdAt' | 'updatedAt'>>
): CustomEndpoint {
  const config = loadLiteLLMApiConfig(baseDir);
  const endpointIndex = config.endpoints.findIndex((e) => e.id === endpointId);

  if (endpointIndex === -1) {
    throw new Error(`Endpoint not found: ${endpointId}`);
  }

  // Verify provider exists if updating providerId
  if (updates.providerId && !config.providers.find((p) => p.id === updates.providerId)) {
    throw new Error(`Provider not found: ${updates.providerId}`);
  }

  config.endpoints[endpointIndex] = {
    ...config.endpoints[endpointIndex],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveConfig(baseDir, config);
  return config.endpoints[endpointIndex];
}

/**
 * Delete endpoint
 */
export function deleteEndpoint(baseDir: string, endpointId: string): boolean {
  const config = loadLiteLLMApiConfig(baseDir);
  const initialLength = config.endpoints.length;

  config.endpoints = config.endpoints.filter((e) => e.id !== endpointId);

  if (config.endpoints.length === initialLength) {
    return false;
  }

  // Clear default endpoint if deleted
  if (config.defaultEndpoint === endpointId) {
    delete config.defaultEndpoint;
  }

  saveConfig(baseDir, config);
  return true;
}

// ===========================
// Default Endpoint Management
// ===========================

/**
 * Get default endpoint
 */
export function getDefaultEndpoint(baseDir: string): string | undefined {
  const config = loadLiteLLMApiConfig(baseDir);
  return config.defaultEndpoint;
}

/**
 * Set default endpoint
 */
export function setDefaultEndpoint(baseDir: string, endpointId?: string): void {
  const config = loadLiteLLMApiConfig(baseDir);

  if (endpointId) {
    // Verify endpoint exists
    if (!config.endpoints.find((e) => e.id === endpointId)) {
      throw new Error(`Endpoint not found: ${endpointId}`);
    }
    config.defaultEndpoint = endpointId;
  } else {
    delete config.defaultEndpoint;
  }

  saveConfig(baseDir, config);
}

// ===========================
// Cache Settings Management
// ===========================

/**
 * Get global cache settings
 */
export function getGlobalCacheSettings(baseDir: string): GlobalCacheSettings {
  const config = loadLiteLLMApiConfig(baseDir);
  return config.globalCacheSettings;
}

/**
 * Update global cache settings
 */
export function updateGlobalCacheSettings(
  baseDir: string,
  settings: Partial<GlobalCacheSettings>
): void {
  const config = loadLiteLLMApiConfig(baseDir);

  config.globalCacheSettings = {
    ...config.globalCacheSettings,
    ...settings,
  };

  saveConfig(baseDir, config);
}

// ===========================
// CodexLens Embedding Rotation Management
// ===========================

/**
 * Get CodexLens embedding rotation config
 */
export function getCodexLensEmbeddingRotation(baseDir: string): CodexLensEmbeddingRotation | undefined {
  const config = loadLiteLLMApiConfig(baseDir);
  return config.codexlensEmbeddingRotation;
}

/**
 * Update CodexLens embedding rotation config
 */
export function updateCodexLensEmbeddingRotation(
  baseDir: string,
  rotationConfig: CodexLensEmbeddingRotation | undefined
): void {
  const config = loadLiteLLMApiConfig(baseDir);

  if (rotationConfig) {
    config.codexlensEmbeddingRotation = rotationConfig;
  } else {
    delete config.codexlensEmbeddingRotation;
  }

  saveConfig(baseDir, config);
}

/**
 * Get all enabled embedding providers with their API keys for rotation
 * This aggregates all providers that have embedding models configured
 */
export function getEmbeddingProvidersForRotation(baseDir: string): Array<{
  providerId: string;
  providerName: string;
  apiBase: string;
  embeddingModels: Array<{
    modelId: string;
    modelName: string;
    dimensions: number;
  }>;
  apiKeys: Array<{
    keyId: string;
    keyLabel: string;
    enabled: boolean;
  }>;
}> {
  const config = loadLiteLLMApiConfig(baseDir);
  const result: Array<{
    providerId: string;
    providerName: string;
    apiBase: string;
    embeddingModels: Array<{
      modelId: string;
      modelName: string;
      dimensions: number;
    }>;
    apiKeys: Array<{
      keyId: string;
      keyLabel: string;
      enabled: boolean;
    }>;
  }> = [];

  for (const provider of config.providers) {
    if (!provider.enabled) continue;

    // Check if provider has embedding models
    const embeddingModels = (provider.embeddingModels || [])
      .filter(m => m.enabled)
      .map(m => ({
        modelId: m.id,
        modelName: m.name,
        dimensions: m.capabilities?.embeddingDimension || 1536,
      }));

    if (embeddingModels.length === 0) continue;

    // Get API keys (single key or multiple from apiKeys array)
    const apiKeys: Array<{ keyId: string; keyLabel: string; enabled: boolean }> = [];

    if (provider.apiKeys && provider.apiKeys.length > 0) {
      // Use multi-key configuration
      for (const keyEntry of provider.apiKeys) {
        apiKeys.push({
          keyId: keyEntry.id,
          keyLabel: keyEntry.label || keyEntry.id,
          enabled: keyEntry.enabled,
        });
      }
    } else if (provider.apiKey) {
      // Single key fallback
      apiKeys.push({
        keyId: 'default',
        keyLabel: 'Default Key',
        enabled: true,
      });
    }

    result.push({
      providerId: provider.id,
      providerName: provider.name,
      apiBase: provider.apiBase || getDefaultApiBaseForType(provider.type),
      embeddingModels,
      apiKeys,
    });
  }

  return result;
}

/**
 * Generate rotation endpoints for ccw_litellm
 * Creates endpoint list from rotation config for parallel embedding
 */
export function generateRotationEndpoints(baseDir: string): Array<{
  name: string;
  api_key: string;
  api_base: string;
  model: string;
  weight: number;
  max_concurrent: number;
}> {
  const config = loadLiteLLMApiConfig(baseDir);
  const rotationConfig = config.codexlensEmbeddingRotation;

  if (!rotationConfig || !rotationConfig.enabled) {
    return [];
  }

  const endpoints: Array<{
    name: string;
    api_key: string;
    api_base: string;
    model: string;
    weight: number;
    max_concurrent: number;
  }> = [];

  for (const rotationProvider of rotationConfig.providers) {
    if (!rotationProvider.enabled) continue;

    // Find the provider config
    const provider = config.providers.find(p => p.id === rotationProvider.providerId);
    if (!provider || !provider.enabled) continue;

    // Find the embedding model
    const embeddingModel = provider.embeddingModels?.find(m => m.id === rotationProvider.modelId);
    if (!embeddingModel || !embeddingModel.enabled) continue;

    // Get API base (model-specific or provider default)
    const apiBase = embeddingModel.endpointSettings?.baseUrl ||
                    provider.apiBase ||
                    getDefaultApiBaseForType(provider.type);

    // Get API keys to use
    let keysToUse: Array<{ id: string; key: string; label: string }> = [];

    if (provider.apiKeys && provider.apiKeys.length > 0) {
      if (rotationProvider.useAllKeys) {
        // Use all enabled keys
        keysToUse = provider.apiKeys
          .filter(k => k.enabled)
          .map(k => ({ id: k.id, key: k.key, label: k.label || k.id }));
      } else if (rotationProvider.selectedKeyIds && rotationProvider.selectedKeyIds.length > 0) {
        // Use only selected keys
        keysToUse = provider.apiKeys
          .filter(k => k.enabled && rotationProvider.selectedKeyIds!.includes(k.id))
          .map(k => ({ id: k.id, key: k.key, label: k.label || k.id }));
      }
    } else if (provider.apiKey) {
      // Single key fallback
      keysToUse = [{ id: 'default', key: provider.apiKey, label: 'Default' }];
    }

    // Create endpoint for each key
    for (const keyInfo of keysToUse) {
      endpoints.push({
        name: `${provider.name}-${keyInfo.label}`,
        api_key: resolveEnvVar(keyInfo.key),
        api_base: apiBase,
        model: embeddingModel.name,
        weight: rotationProvider.weight,
        max_concurrent: rotationProvider.maxConcurrentPerKey,
      });
    }
  }

  return endpoints;
}

// ===========================
// YAML Config Generation for ccw_litellm
// ===========================

/**
 * Convert UI config (JSON) to ccw_litellm config (YAML format object)
 * This allows CodexLens to use UI-configured providers
 */
export function generateLiteLLMYamlConfig(baseDir: string): Record<string, unknown> {
  const config = loadLiteLLMApiConfig(baseDir);

  // Build providers object
  const providers: Record<string, unknown> = {};
  for (const provider of config.providers) {
    if (!provider.enabled) continue;

    providers[provider.id] = {
      api_key: provider.apiKey,
      api_base: provider.apiBase || getDefaultApiBaseForType(provider.type),
    };
  }

  // Build embedding_models object from providers' embeddingModels
  const embeddingModels: Record<string, unknown> = {};
  for (const provider of config.providers) {
    if (!provider.enabled || !provider.embeddingModels) continue;

    for (const model of provider.embeddingModels) {
      if (!model.enabled) continue;

      embeddingModels[model.id] = {
        provider: provider.id,
        model: model.name,
        dimensions: model.capabilities?.embeddingDimension || 1536,
        // Use model-specific base URL if set, otherwise use provider's
        ...(model.endpointSettings?.baseUrl && {
          api_base: model.endpointSettings.baseUrl,
        }),
      };
    }
  }

  // Build llm_models object from providers' llmModels
  const llmModels: Record<string, unknown> = {};
  for (const provider of config.providers) {
    if (!provider.enabled || !provider.llmModels) continue;

    for (const model of provider.llmModels) {
      if (!model.enabled) continue;

      llmModels[model.id] = {
        provider: provider.id,
        model: model.name,
        ...(model.endpointSettings?.baseUrl && {
          api_base: model.endpointSettings.baseUrl,
        }),
      };
    }
  }

  // Find default provider
  const defaultProvider = config.providers.find((p) => p.enabled)?.id || 'openai';

  return {
    version: 1,
    default_provider: defaultProvider,
    providers,
    embedding_models: Object.keys(embeddingModels).length > 0 ? embeddingModels : {
      default: {
        provider: defaultProvider,
        model: 'text-embedding-3-small',
        dimensions: 1536,
      },
    },
    llm_models: Object.keys(llmModels).length > 0 ? llmModels : {
      default: {
        provider: defaultProvider,
        model: 'gpt-4',
      },
    },
  };
}

/**
 * Get default API base URL for provider type
 */
function getDefaultApiBaseForType(type: ProviderType): string {
  const defaults: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    custom: 'https://api.example.com/v1',
  };
  return defaults[type] || 'https://api.openai.com/v1';
}

/**
 * Save ccw_litellm YAML config file
 * Writes to ~/.ccw/config/litellm-config.yaml
 */
export function saveLiteLLMYamlConfig(baseDir: string): string {
  const yamlConfig = generateLiteLLMYamlConfig(baseDir);

  // Convert to YAML manually (simple format)
  const yamlContent = objectToYaml(yamlConfig);

  // Write to ~/.ccw/config/litellm-config.yaml
  const homePath = process.env.HOME || process.env.USERPROFILE || '';
  const yamlPath = join(homePath, '.ccw', 'config', 'litellm-config.yaml');

  // Ensure directory exists
  const configDir = join(homePath, '.ccw', 'config');
  ensureStorageDir(configDir);

  writeFileSync(yamlPath, yamlContent, 'utf-8');
  return yamlPath;
}

/**
 * Simple object to YAML converter
 */
function objectToYaml(obj: unknown, indent: number = 0): string {
  const spaces = '  '.repeat(indent);

  if (obj === null || obj === undefined) {
    return 'null';
  }

  if (typeof obj === 'string') {
    // Quote strings that contain special characters
    if (obj.includes(':') || obj.includes('#') || obj.includes('\n') || obj.startsWith('$')) {
      return `"${obj.replace(/"/g, '\\"')}"`;
    }
    return obj;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj.map((item) => `${spaces}- ${objectToYaml(item, indent + 1).trimStart()}`).join('\n');
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return '{}';

    return entries
      .map(([key, value]) => {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return `${spaces}${key}:\n${objectToYaml(value, indent + 1)}`;
        }
        return `${spaces}${key}: ${objectToYaml(value, indent)}`;
      })
      .join('\n');
  }

  return String(obj);
}

// Re-export types
export type { ProviderCredential, CustomEndpoint, ProviderType, CacheStrategy, CodexLensEmbeddingRotation, CodexLensEmbeddingProvider };
