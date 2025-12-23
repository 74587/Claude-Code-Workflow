/**
 * LiteLLM API Configuration Manager
 * Manages provider credentials, custom endpoints, and cache settings
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { StoragePaths, ensureStorageDir } from './storage-paths.js';
import type {
  LiteLLMApiConfig,
  ProviderCredential,
  CustomEndpoint,
  GlobalCacheSettings,
  ProviderType,
  CacheStrategy,
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
 * Get config file path for a project
 */
function getConfigPath(baseDir: string): string {
  const paths = StoragePaths.project(baseDir);
  ensureStorageDir(paths.config);
  return join(paths.config, 'litellm-api-config.json');
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

// Re-export types
export type { ProviderCredential, CustomEndpoint, ProviderType, CacheStrategy };
