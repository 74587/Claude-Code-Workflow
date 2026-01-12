/**
 * Health Check Service
 * Singleton service that periodically checks API key health for providers
 * with health check enabled. Updates key health status and filters unhealthy
 * keys from rotation endpoints.
 */

import {
  getAllProviders,
  getProvider,
  updateProvider,
  resolveEnvVar,
} from '../../config/litellm-api-config-manager.js';
import { testApiKeyConnection, getDefaultApiBase } from './api-key-tester.js';
import type { ProviderCredential, ApiKeyEntry, HealthCheckConfig } from '../../types/litellm-api-config.js';

/**
 * Internal state for tracking consecutive failures per key
 */
interface KeyHealthState {
  consecutiveFailures: number;
  cooldownUntil?: Date;
}

/**
 * Health Check Service - Singleton
 * Manages periodic health checks for API keys across all providers
 */
export class HealthCheckService {
  private static instance: HealthCheckService;

  /** Timer handles for each provider's health check interval */
  private timers: Map<string, NodeJS.Timeout> = new Map();

  /** Track consecutive failures and cooldown per key (providerId:keyId -> state) */
  private keyStates: Map<string, KeyHealthState> = new Map();

  /** Base directory for config operations */
  private baseDir: string = '';

  /** Lock to prevent concurrent checks on same provider */
  private checkingProviders: Set<string> = new Set();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }

  /**
   * Start health check for a specific provider
   * @param providerId - The provider ID to start health checks for
   */
  startHealthCheck(providerId: string): void {
    // Stop existing timer if any
    this.stopHealthCheck(providerId);

    const provider = getProvider(this.baseDir, providerId);
    if (!provider) {
      console.warn(`[HealthCheck] Provider not found: ${providerId}`);
      return;
    }

    if (!provider.enabled) {
      console.log(`[HealthCheck] Provider ${providerId} is disabled, skipping`);
      return;
    }

    const healthConfig = provider.healthCheck;
    if (!healthConfig || !healthConfig.enabled) {
      console.log(`[HealthCheck] Health check not enabled for provider ${providerId}`);
      return;
    }

    const intervalMs = (healthConfig.intervalSeconds || 300) * 1000;

    console.log(`[HealthCheck] Starting health check for ${provider.name} (${providerId}), interval: ${healthConfig.intervalSeconds}s`);

    // Run initial check immediately
    void this.checkProviderNow(providerId);

    // Set up interval
    const timer = setInterval(() => {
      void this.checkProviderNow(providerId);
    }, intervalMs);

    this.timers.set(providerId, timer);
  }

  /**
   * Stop health check for a specific provider
   * @param providerId - The provider ID to stop health checks for
   */
  stopHealthCheck(providerId: string): void {
    const timer = this.timers.get(providerId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(providerId);
      console.log(`[HealthCheck] Stopped health check for provider ${providerId}`);
    }
  }

  /**
   * Start health checks for all providers that have health check enabled
   * @param baseDir - Base directory for config operations
   */
  startAllHealthChecks(baseDir: string): void {
    this.baseDir = baseDir;

    const providers = getAllProviders(baseDir);
    let startedCount = 0;

    for (const provider of providers) {
      if (provider.enabled && provider.healthCheck?.enabled) {
        this.startHealthCheck(provider.id);
        startedCount++;
      }
    }

    if (startedCount > 0) {
      console.log(`[HealthCheck] Started health checks for ${startedCount} provider(s)`);
    } else {
      console.log('[HealthCheck] No providers with health check enabled');
    }
  }

  /**
   * Stop all active health checks
   */
  stopAllHealthChecks(): void {
    const providerIds = Array.from(this.timers.keys());
    for (const providerId of providerIds) {
      this.stopHealthCheck(providerId);
    }
    this.keyStates.clear();
    console.log('[HealthCheck] Stopped all health checks');
  }

  /**
   * Manually trigger a health check for a provider
   * @param providerId - The provider ID to check
   */
  async checkProviderNow(providerId: string): Promise<void> {
    // Prevent concurrent checks on same provider
    if (this.checkingProviders.has(providerId)) {
      console.log(`[HealthCheck] Already checking provider ${providerId}, skipping`);
      return;
    }

    this.checkingProviders.add(providerId);

    try {
      const provider = getProvider(this.baseDir, providerId);
      if (!provider) {
        console.warn(`[HealthCheck] Provider not found: ${providerId}`);
        return;
      }

      if (!provider.enabled) {
        return;
      }

      const healthConfig = provider.healthCheck;
      if (!healthConfig) {
        return;
      }

      const apiBase = provider.apiBase || getDefaultApiBase(provider.type);
      const apiKeys = provider.apiKeys || [];

      if (apiKeys.length === 0 && provider.apiKey) {
        // Single key mode - create virtual key entry
        await this.checkSingleKey(provider, 'default', provider.apiKey, apiBase, healthConfig);
      } else {
        // Multi-key mode
        for (const keyEntry of apiKeys) {
          if (!keyEntry.enabled) continue;
          await this.checkSingleKey(provider, keyEntry.id, keyEntry.key, apiBase, healthConfig);
        }
      }

      // Persist updated health statuses
      const updatedApiKeys = provider.apiKeys;
      if (updatedApiKeys && updatedApiKeys.length > 0) {
        try {
          updateProvider(this.baseDir, providerId, { apiKeys: updatedApiKeys });
        } catch (err) {
          console.error(`[HealthCheck] Failed to persist health status for ${providerId}:`, err);
        }
      }
    } finally {
      this.checkingProviders.delete(providerId);
    }
  }

  /**
   * Check a single API key's health
   */
  private async checkSingleKey(
    provider: ProviderCredential,
    keyId: string,
    keyValue: string,
    apiBase: string,
    healthConfig: HealthCheckConfig
  ): Promise<void> {
    const stateKey = `${provider.id}:${keyId}`;
    let state = this.keyStates.get(stateKey);

    if (!state) {
      state = { consecutiveFailures: 0 };
      this.keyStates.set(stateKey, state);
    }

    // Check if in cooldown
    if (state.cooldownUntil && new Date() < state.cooldownUntil) {
      console.log(`[HealthCheck] Key ${keyId} for ${provider.name} is in cooldown until ${state.cooldownUntil.toISOString()}`);
      return;
    }

    // Resolve environment variables
    const resolvedKey = resolveEnvVar(keyValue);
    if (!resolvedKey) {
      console.warn(`[HealthCheck] Key ${keyId} for ${provider.name} has empty value (env var not set?)`);
      this.updateKeyHealth(provider, keyId, 'unhealthy', 'API key is empty or environment variable not set');
      return;
    }

    // Test the key
    const result = await testApiKeyConnection(provider.type, apiBase, resolvedKey);
    const now = new Date().toISOString();

    if (result.valid) {
      // Reset failure count on success
      state.consecutiveFailures = 0;
      state.cooldownUntil = undefined;
      this.updateKeyHealth(provider, keyId, 'healthy', undefined, now, result.latencyMs);
      console.log(`[HealthCheck] Key ${keyId} for ${provider.name}: healthy (${result.latencyMs}ms)`);
    } else {
      // Increment failure count
      state.consecutiveFailures++;

      if (state.consecutiveFailures >= healthConfig.failureThreshold) {
        // Mark as unhealthy and enter cooldown
        const cooldownMs = (healthConfig.cooldownSeconds || 60) * 1000;
        state.cooldownUntil = new Date(Date.now() + cooldownMs);
        this.updateKeyHealth(provider, keyId, 'unhealthy', result.error, now);
        console.warn(`[HealthCheck] Key ${keyId} for ${provider.name}: UNHEALTHY after ${state.consecutiveFailures} failures. Cooldown until ${state.cooldownUntil.toISOString()}`);
      } else {
        // Still unknown/degraded, not yet unhealthy
        this.updateKeyHealth(provider, keyId, 'unknown', result.error, now);
        console.log(`[HealthCheck] Key ${keyId} for ${provider.name}: failed (${state.consecutiveFailures}/${healthConfig.failureThreshold}): ${result.error}`);
      }
    }
  }

  /**
   * Update the health status of a key in the provider's apiKeys array
   */
  private updateKeyHealth(
    provider: ProviderCredential,
    keyId: string,
    status: 'healthy' | 'unhealthy' | 'unknown',
    error?: string,
    timestamp?: string,
    latencyMs?: number
  ): void {
    if (!provider.apiKeys) return;

    const keyEntry = provider.apiKeys.find(k => k.id === keyId);
    if (keyEntry) {
      keyEntry.healthStatus = status;
      keyEntry.lastHealthCheck = timestamp || new Date().toISOString();
      if (error) {
        keyEntry.lastError = error;
      } else {
        delete keyEntry.lastError;
      }
      // Save latency if provided (only on successful checks)
      if (latencyMs !== undefined) {
        keyEntry.lastLatencyMs = latencyMs;
      }
    }
  }

  /**
   * Get the current health status of all keys for a provider
   */
  getProviderHealthStatus(providerId: string): Array<{
    keyId: string;
    status: 'healthy' | 'unhealthy' | 'unknown';
    lastCheck?: string;
    lastError?: string;
    consecutiveFailures: number;
    inCooldown: boolean;
  }> {
    const provider = getProvider(this.baseDir, providerId);
    if (!provider || !provider.apiKeys) return [];

    return provider.apiKeys.map(key => {
      const stateKey = `${providerId}:${key.id}`;
      const state = this.keyStates.get(stateKey) || { consecutiveFailures: 0 };

      return {
        keyId: key.id,
        status: key.healthStatus || 'unknown',
        lastCheck: key.lastHealthCheck,
        lastError: key.lastError,
        consecutiveFailures: state.consecutiveFailures,
        inCooldown: state.cooldownUntil ? new Date() < state.cooldownUntil : false,
      };
    });
  }

  /**
   * Check if the service is running health checks for any provider
   */
  isRunning(): boolean {
    return this.timers.size > 0;
  }

  /**
   * Get list of provider IDs currently being monitored
   */
  getMonitoredProviders(): string[] {
    return Array.from(this.timers.keys());
  }
}

/**
 * Get the singleton health check service instance
 */
export function getHealthCheckService(): HealthCheckService {
  return HealthCheckService.getInstance();
}
