/**
 * LiteLLM API Configuration Manager
 * Manages provider credentials, custom endpoints, and cache settings
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'fs';
import { homedir } from 'os';
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
  EmbeddingPoolConfig,
} from '../types/litellm-api-config.js';
import {
  addClaudeApiEndpoint,
  removeClaudeApiEndpoint
} from '../tools/claude-cli-tools.js';

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

function bestEffortRestrictPermissions(filePath: string, mode: number): void {
  try {
    chmodSync(filePath, mode);
  } catch {
    // Ignore permission errors (e.g., Windows or restrictive environments)
  }
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
  writeFileSync(configPath, JSON.stringify(config, null, 2), { encoding: 'utf8', mode: 0o600 });
  bestEffortRestrictPermissions(configPath, 0o600);
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

  const resolvedApiKey = resolveEnvVar(provider.apiKey);

  // Avoid leaking env-var syntax or secrets if this object is logged/serialized.
  const sanitizedProvider: ProviderCredential = {
    ...provider,
    apiKey: '***',
    apiKeys: provider.apiKeys?.map(keyEntry => ({
      ...keyEntry,
      key: '***',
    })),
  };

  Object.defineProperty(sanitizedProvider, 'resolvedApiKey', {
    value: resolvedApiKey,
    enumerable: false,
    writable: false,
    configurable: false,
  });

  return sanitizedProvider as ProviderCredential & { resolvedApiKey: string };
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

  // Sync to cli-tools.json as api-endpoint type
  // Usage: ccw cli -p "..." --tool <endpoint-id>
  try {
    addClaudeApiEndpoint(homedir(), {
      id: endpoint.id,
      name: endpoint.id,  // Use endpoint ID as tool name for CLI access
      enabled: endpoint.enabled !== false
    });
    console.log(`[LiteLLM Config] Synced endpoint ${endpoint.id} to cli-tools.json (api-endpoint)`);
  } catch (syncError) {
    console.warn(`[LiteLLM Config] Failed to sync endpoint to cli-tools.json: ${syncError}`);
    // Non-fatal: continue even if sync fails
  }

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

  // Sync enabled status to cli-tools.json
  const updatedEndpoint = config.endpoints[endpointIndex];
  try {
    addClaudeApiEndpoint(homedir(), {
      id: updatedEndpoint.id,
      name: updatedEndpoint.id,
      enabled: updatedEndpoint.enabled !== false
    });
    console.log(`[LiteLLM Config] Synced endpoint ${updatedEndpoint.id} update to cli-tools.json`);
  } catch (syncError) {
    console.warn(`[LiteLLM Config] Failed to sync endpoint update to cli-tools.json: ${syncError}`);
  }

  return updatedEndpoint;
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

  // Remove from cli-tools.json
  try {
    removeClaudeApiEndpoint(homedir(), endpointId);
    console.log(`[LiteLLM Config] Removed endpoint ${endpointId} from cli-tools.json`);
  } catch (syncError) {
    console.warn(`[LiteLLM Config] Failed to remove endpoint from cli-tools.json: ${syncError}`);
  }

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
 * Also triggers sync to CodexLens settings.json
 */
export function updateCodexLensEmbeddingRotation(
  baseDir: string,
  rotationConfig: CodexLensEmbeddingRotation | undefined
): { syncResult: { success: boolean; message: string; endpointCount?: number } } {
  const config = loadLiteLLMApiConfig(baseDir);

  if (rotationConfig) {
    config.codexlensEmbeddingRotation = rotationConfig;
  } else {
    delete config.codexlensEmbeddingRotation;
  }

  saveConfig(baseDir, config);

  // Auto-sync to CodexLens settings.json
  const syncResult = syncCodexLensConfig(baseDir);
  return { syncResult };
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
 * Extended rotation endpoint with routing and health check info
 */
export interface RotationEndpointConfig {
  name: string;
  api_key: string;
  api_base: string;
  model: string;
  weight: number;
  max_concurrent: number;
  /** Routing strategy for load balancing */
  routing_strategy?: string;
  /** Health check configuration */
  health_check?: {
    enabled: boolean;
    interval_seconds: number;
    cooldown_seconds: number;
    failure_threshold: number;
  };
  /** Last recorded latency in milliseconds */
  last_latency_ms?: number;
}

/**
 * Generate rotation endpoints for ccw_litellm
 * Creates endpoint list from rotation config for parallel embedding
 * Supports both legacy codexlensEmbeddingRotation and new embeddingPoolConfig
 */
export function generateRotationEndpoints(baseDir: string): RotationEndpointConfig[] {
  const config = loadLiteLLMApiConfig(baseDir);

  // Prefer embeddingPoolConfig, fallback to codexlensEmbeddingRotation for backward compatibility
  const poolConfig = config.embeddingPoolConfig;
  const rotationConfig = config.codexlensEmbeddingRotation;

  // Check if new poolConfig is enabled
  if (poolConfig && poolConfig.enabled) {
    return generateEndpointsFromPool(baseDir, poolConfig, config);
  }

  // Fallback to legacy rotation config
  if (rotationConfig && rotationConfig.enabled) {
    return generateEndpointsFromLegacyRotation(baseDir, rotationConfig, config);
  }

  return [];
}

/**
 * Generate endpoints from new embeddingPoolConfig (with auto-discovery support)
 */
function generateEndpointsFromPool(
  baseDir: string,
  poolConfig: EmbeddingPoolConfig,
  config: LiteLLMApiConfig
): RotationEndpointConfig[] {
  const endpoints: RotationEndpointConfig[] = [];

  if (poolConfig.autoDiscover) {
    // Auto-discover all providers offering targetModel
    const discovered = discoverProvidersForModel(baseDir, poolConfig.targetModel);
    const excludedIds = new Set(poolConfig.excludedProviderIds || []);

    for (const disc of discovered) {
      // Skip excluded providers
      if (excludedIds.has(disc.providerId)) continue;

      // Find the provider config
      const provider = config.providers.find(p => p.id === disc.providerId);
      if (!provider || !provider.enabled) continue;

      // Find the embedding model
      const embeddingModel = provider.embeddingModels?.find(m => m.id === disc.modelId);
      if (!embeddingModel || !embeddingModel.enabled) continue;

      // Get API base (model-specific or provider default)
      const apiBase = embeddingModel.endpointSettings?.baseUrl ||
                      provider.apiBase ||
                      getDefaultApiBaseForType(provider.type);

      // Get API keys to use
      let keysToUse: Array<{ id: string; key: string; label: string }> = [];

      if (provider.apiKeys && provider.apiKeys.length > 0) {
        // Use all enabled and healthy keys (filter out unhealthy)
        const healthyKeys = provider.apiKeys.filter(k =>
          k.enabled && k.healthStatus !== 'unhealthy'
        );

        // Log filtered keys for debugging
        const unhealthyCount = provider.apiKeys.filter(k =>
          k.enabled && k.healthStatus === 'unhealthy'
        ).length;
        if (unhealthyCount > 0) {
          console.log(`[RotationEndpoints] Filtered ${unhealthyCount} unhealthy key(s) from provider ${provider.name}`);
        }

        keysToUse = healthyKeys.map(k => ({ id: k.id, key: k.key, label: k.label || k.id }));
      } else if (provider.apiKey) {
        // Single key fallback
        keysToUse = [{ id: 'default', key: provider.apiKey, label: 'Default' }];
      }

      // Create endpoint for each key
      for (const keyInfo of keysToUse) {
        const endpoint: RotationEndpointConfig = {
          name: `${provider.name}-${keyInfo.label}`,
          api_key: resolveEnvVar(keyInfo.key),
          api_base: apiBase,
          model: embeddingModel.name,
          weight: 1.0, // Default weight for auto-discovered providers
          max_concurrent: poolConfig.defaultMaxConcurrentPerKey,
        };

        // Add routing strategy from provider config
        if (provider.routingStrategy) {
          endpoint.routing_strategy = provider.routingStrategy;
        }

        // Add health check config from provider
        if (provider.healthCheck) {
          endpoint.health_check = {
            enabled: provider.healthCheck.enabled,
            interval_seconds: provider.healthCheck.intervalSeconds,
            cooldown_seconds: provider.healthCheck.cooldownSeconds,
            failure_threshold: provider.healthCheck.failureThreshold,
          };
        }

        // Add last latency if available from key entry
        const keyEntry = provider.apiKeys?.find(k => k.id === keyInfo.id);
        if (keyEntry && keyEntry.lastLatencyMs !== undefined) {
          endpoint.last_latency_ms = keyEntry.lastLatencyMs;
        }

        endpoints.push(endpoint);
      }
    }
  }

  return endpoints;
}

/**
 * Generate endpoints from legacy codexlensEmbeddingRotation config
 */
function generateEndpointsFromLegacyRotation(
  baseDir: string,
  rotationConfig: CodexLensEmbeddingRotation,
  config: LiteLLMApiConfig
): RotationEndpointConfig[] {
  const endpoints: RotationEndpointConfig[] = [];

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
      // Filter out unhealthy keys first
      const healthyKeys = provider.apiKeys.filter(k =>
        k.enabled && k.healthStatus !== 'unhealthy'
      );

      // Log filtered keys for debugging
      const unhealthyCount = provider.apiKeys.filter(k =>
        k.enabled && k.healthStatus === 'unhealthy'
      ).length;
      if (unhealthyCount > 0) {
        console.log(`[RotationEndpoints] Filtered ${unhealthyCount} unhealthy key(s) from provider ${provider.name}`);
      }

      if (rotationProvider.useAllKeys) {
        // Use all enabled and healthy keys
        keysToUse = healthyKeys.map(k => ({ id: k.id, key: k.key, label: k.label || k.id }));
      } else if (rotationProvider.selectedKeyIds && rotationProvider.selectedKeyIds.length > 0) {
        // Use only selected healthy keys
        keysToUse = healthyKeys
          .filter(k => rotationProvider.selectedKeyIds!.includes(k.id))
          .map(k => ({ id: k.id, key: k.key, label: k.label || k.id }));
      }
    } else if (provider.apiKey) {
      // Single key fallback
      keysToUse = [{ id: 'default', key: provider.apiKey, label: 'Default' }];
    }

    // Create endpoint for each key
    for (const keyInfo of keysToUse) {
      const endpoint: RotationEndpointConfig = {
        name: `${provider.name}-${keyInfo.label}`,
        api_key: resolveEnvVar(keyInfo.key),
        api_base: apiBase,
        model: embeddingModel.name,
        weight: rotationProvider.weight,
        max_concurrent: rotationProvider.maxConcurrentPerKey,
      };

      // Add routing strategy from provider config
      if (provider.routingStrategy) {
        endpoint.routing_strategy = provider.routingStrategy;
      }

      // Add health check config from provider
      if (provider.healthCheck) {
        endpoint.health_check = {
          enabled: provider.healthCheck.enabled,
          interval_seconds: provider.healthCheck.intervalSeconds,
          cooldown_seconds: provider.healthCheck.cooldownSeconds,
          failure_threshold: provider.healthCheck.failureThreshold,
        };
      }

      // Add last latency if available from key entry
      const keyEntry = provider.apiKeys?.find(k => k.id === keyInfo.id);
      if (keyEntry && keyEntry.lastLatencyMs !== undefined) {
        endpoint.last_latency_ms = keyEntry.lastLatencyMs;
      }

      endpoints.push(endpoint);
    }
  }

  return endpoints;
}

/**
 * Sync CodexLens settings with CCW API config
 * Writes rotation endpoints to ~/.codexlens/settings.json
 * This enables the Python backend to use UI-configured rotation
 * Supports both new embeddingPoolConfig and legacy codexlensEmbeddingRotation
 */
export function syncCodexLensConfig(baseDir: string): { success: boolean; message: string; endpointCount?: number } {
  try {
    const config = loadLiteLLMApiConfig(baseDir);

    // Prefer embeddingPoolConfig, fallback to codexlensEmbeddingRotation
    const poolConfig = config.embeddingPoolConfig;
    const rotationConfig = config.codexlensEmbeddingRotation;

    // Get CodexLens settings path
    const codexlensDir = join(homedir(), '.codexlens');
    const settingsPath = join(codexlensDir, 'settings.json');

    // Ensure directory exists
    if (!existsSync(codexlensDir)) {
      mkdirSync(codexlensDir, { recursive: true });
    }

    // Load existing settings or create new
    let settings: Record<string, unknown> = {};
    if (existsSync(settingsPath)) {
      try {
        settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      } catch {
        settings = {};
      }
    }

    // Check if either config is enabled
    const isPoolEnabled = poolConfig && poolConfig.enabled;
    const isRotationEnabled = rotationConfig && rotationConfig.enabled;

    // If neither is enabled, remove rotation endpoints and return
    if (!isPoolEnabled && !isRotationEnabled) {
      if (settings.litellm_rotation_endpoints) {
        delete settings.litellm_rotation_endpoints;
        delete settings.litellm_rotation_strategy;
        delete settings.litellm_rotation_cooldown;
        delete settings.litellm_target_model;
        writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
      }
      return { success: true, message: 'Rotation disabled, cleared endpoints', endpointCount: 0 };
    }

    // Generate rotation endpoints (function handles priority internally)
    const endpoints = generateRotationEndpoints(baseDir);

    if (endpoints.length === 0) {
      return { success: false, message: 'No valid endpoints generated from rotation config' };
    }

    // Update settings with rotation config (use poolConfig if available)
    settings.litellm_rotation_endpoints = endpoints;

    if (isPoolEnabled) {
      settings.litellm_rotation_strategy = poolConfig!.strategy;
      settings.litellm_rotation_cooldown = poolConfig!.defaultCooldown;
      settings.litellm_target_model = poolConfig!.targetModel;
    } else {
      settings.litellm_rotation_strategy = rotationConfig!.strategy;
      settings.litellm_rotation_cooldown = rotationConfig!.defaultCooldown;
      settings.litellm_target_model = rotationConfig!.targetModel;
    }

    // Write updated settings
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

    return {
      success: true,
      message: `Synced ${endpoints.length} rotation endpoints to CodexLens`,
      endpointCount: endpoints.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[LiteLLM Config] Failed to sync CodexLens config:', errorMessage);
    return { success: false, message: `Sync failed: ${errorMessage}` };
  }
}

// ===========================
// Embedding Pool Management (Generic, with Auto-Discovery)
// ===========================

/**
 * Get embedding pool config
 */
export function getEmbeddingPoolConfig(baseDir: string): EmbeddingPoolConfig | undefined {
  const config = loadLiteLLMApiConfig(baseDir);
  return config.embeddingPoolConfig;
}

/**
 * Update embedding pool config
 * Also triggers sync to CodexLens settings.json if enabled
 */
export function updateEmbeddingPoolConfig(
  baseDir: string,
  poolConfig: EmbeddingPoolConfig | undefined
): { syncResult: { success: boolean; message: string; endpointCount?: number } } {
  const config = loadLiteLLMApiConfig(baseDir);

  if (poolConfig) {
    config.embeddingPoolConfig = poolConfig;
  } else {
    delete config.embeddingPoolConfig;
  }

  saveConfig(baseDir, config);

  // Auto-sync to CodexLens settings.json
  const syncResult = syncCodexLensConfig(baseDir);
  return { syncResult };
}

/**
 * Discover all providers that offer a specific embedding model
 * Returns list of {providerId, providerName, modelId, modelName, apiKeys[]}
 */
export function discoverProvidersForModel(baseDir: string, targetModel: string): Array<{
  providerId: string;
  providerName: string;
  modelId: string;
  modelName: string;
  apiKeys: Array<{ keyId: string; keyLabel: string; enabled: boolean }>;
}> {
  const config = loadLiteLLMApiConfig(baseDir);
  const result: Array<{
    providerId: string;
    providerName: string;
    modelId: string;
    modelName: string;
    apiKeys: Array<{ keyId: string; keyLabel: string; enabled: boolean }>;
  }> = [];

  for (const provider of config.providers) {
    if (!provider.enabled) continue;

    // Check if provider has embedding models matching targetModel
    const matchingModels = (provider.embeddingModels || []).filter(
      m => m.enabled && (m.id === targetModel || m.name === targetModel)
    );

    if (matchingModels.length === 0) continue;

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

    // Add each matching model
    for (const model of matchingModels) {
      result.push({
        providerId: provider.id,
        providerName: provider.name,
        modelId: model.id,
        modelName: model.name,
        apiKeys,
      });
    }
  }

  return result;
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

// ===========================
// Multi-Model Pool Management
// ===========================

/**
 * Migrate legacy embeddingPoolConfig to new modelPools array
 * This function ensures backward compatibility with existing configurations
 */
function migrateEmbeddingPoolToModelPools(config: LiteLLMApiConfig): void {
  // Skip if already has modelPools or no legacy config
  if (config.modelPools && config.modelPools.length > 0) return;
  if (!config.embeddingPoolConfig) return;

  // Convert legacy embeddingPoolConfig to ModelPoolConfig
  const legacyPool = config.embeddingPoolConfig;
  const modelPool: import('../types/litellm-api-config.js').ModelPoolConfig = {
    id: `pool-embedding-${Date.now()}`,
    modelType: 'embedding',
    enabled: legacyPool.enabled,
    targetModel: legacyPool.targetModel,
    strategy: legacyPool.strategy,
    autoDiscover: legacyPool.autoDiscover,
    excludedProviderIds: legacyPool.excludedProviderIds || [],
    defaultCooldown: legacyPool.defaultCooldown,
    defaultMaxConcurrentPerKey: legacyPool.defaultMaxConcurrentPerKey,
    name: `Embedding Pool - ${legacyPool.targetModel}`,
    description: 'Migrated from legacy embeddingPoolConfig',
  };

  config.modelPools = [modelPool];
  // Keep legacy config for backward compatibility with old CodexLens versions
}

/**
 * Get all model pool configurations
 * Returns empty array if no pools configured
 */
export function getModelPools(baseDir: string): import('../types/litellm-api-config.js').ModelPoolConfig[] {
  const config = loadLiteLLMApiConfig(baseDir);
  
  // Auto-migrate if needed
  migrateEmbeddingPoolToModelPools(config);
  
  return config.modelPools || [];
}

/**
 * Get a specific model pool by ID
 */
export function getModelPool(
  baseDir: string,
  poolId: string
): import('../types/litellm-api-config.js').ModelPoolConfig | undefined {
  const pools = getModelPools(baseDir);
  return pools.find(p => p.id === poolId);
}

/**
 * Add a new model pool configuration
 */
export function addModelPool(
  baseDir: string,
  poolConfig: Omit<import('../types/litellm-api-config.js').ModelPoolConfig, 'id'>
): { poolId: string; syncResult?: { success: boolean; message: string; endpointCount?: number } } {
  const config = loadLiteLLMApiConfig(baseDir);
  
  // Auto-migrate if needed
  migrateEmbeddingPoolToModelPools(config);
  
  // Ensure modelPools array exists
  if (!config.modelPools) {
    config.modelPools = [];
  }

  // Generate unique ID
  const poolId = `pool-${poolConfig.modelType}-${Date.now()}`;
  
  const newPool: import('../types/litellm-api-config.js').ModelPoolConfig = {
    ...poolConfig,
    id: poolId,
  };

  config.modelPools.push(newPool);
  saveConfig(baseDir, config);

  // Sync to CodexLens if this is an embedding pool
  const syncResult = poolConfig.modelType === 'embedding' && poolConfig.enabled
    ? syncCodexLensConfig(baseDir)
    : undefined;

  return { poolId, syncResult };
}

/**
 * Update an existing model pool configuration
 */
export function updateModelPool(
  baseDir: string,
  poolId: string,
  updates: Partial<Omit<import('../types/litellm-api-config.js').ModelPoolConfig, 'id'>>
): { success: boolean; syncResult?: { success: boolean; message: string; endpointCount?: number } } {
  const config = loadLiteLLMApiConfig(baseDir);
  
  // Auto-migrate if needed
  migrateEmbeddingPoolToModelPools(config);
  
  if (!config.modelPools) {
    return { success: false };
  }

  const poolIndex = config.modelPools.findIndex(p => p.id === poolId);
  if (poolIndex === -1) {
    return { success: false };
  }

  // Apply updates
  config.modelPools[poolIndex] = {
    ...config.modelPools[poolIndex],
    ...updates,
  };

  saveConfig(baseDir, config);

  // Sync to CodexLens if this is an enabled embedding pool
  const pool = config.modelPools[poolIndex];
  const syncResult = pool.modelType === 'embedding' && pool.enabled
    ? syncCodexLensConfig(baseDir)
    : undefined;

  return { success: true, syncResult };
}

/**
 * Delete a model pool configuration
 */
export function deleteModelPool(
  baseDir: string,
  poolId: string
): { success: boolean; syncResult?: { success: boolean; message: string; endpointCount?: number } } {
  const config = loadLiteLLMApiConfig(baseDir);
  
  if (!config.modelPools) {
    return { success: false };
  }

  const poolIndex = config.modelPools.findIndex(p => p.id === poolId);
  if (poolIndex === -1) {
    return { success: false };
  }

  const deletedPool = config.modelPools[poolIndex];
  config.modelPools.splice(poolIndex, 1);
  
  saveConfig(baseDir, config);

  // Sync to CodexLens if we deleted an embedding pool
  const syncResult = deletedPool.modelType === 'embedding'
    ? syncCodexLensConfig(baseDir)
    : undefined;

  return { success: true, syncResult };
}

/**
 * Get available models for a specific model type
 * Used for pool configuration UI
 */
export function getAvailableModelsForType(
  baseDir: string,
  modelType: import('../types/litellm-api-config.js').ModelPoolType
): Array<{ modelId: string; modelName: string; providers: string[] }> {
  const config = loadLiteLLMApiConfig(baseDir);
  const availableModels: Array<{ modelId: string; modelName: string; providers: string[] }> = [];
  const modelMap = new Map<string, { modelId: string; modelName: string; providers: string[] }>();

  for (const provider of config.providers) {
    if (!provider.enabled) continue;

    let models: typeof provider.embeddingModels | undefined;
    
    switch (modelType) {
      case 'embedding':
        models = provider.embeddingModels;
        break;
      case 'llm':
        models = provider.llmModels;
        break;
      case 'reranker':
        models = provider.rerankerModels;
        break;
    }

    if (!models) continue;

    for (const model of models) {
      if (!model.enabled) continue;

      const key = model.id;
      if (modelMap.has(key)) {
        modelMap.get(key)!.providers.push(provider.name);
      } else {
        modelMap.set(key, {
          modelId: model.id,
          modelName: model.name,
          providers: [provider.name],
        });
      }
    }
  }

  availableModels.push(...Array.from(modelMap.values()));
  return availableModels;
}

// Re-export types
export type { ProviderCredential, CustomEndpoint, ProviderType, CacheStrategy, CodexLensEmbeddingRotation, CodexLensEmbeddingProvider, EmbeddingPoolConfig };
