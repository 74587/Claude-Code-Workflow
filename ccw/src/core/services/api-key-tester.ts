/**
 * API Key Tester Service
 * Shared module for testing API key connectivity across different provider types.
 * Used by both manual testing (litellm-api-routes.ts) and health check service.
 */

import type { ProviderType } from '../../types/litellm-api-config.js';

/**
 * Validate API base URL format
 * Note: This is a local development tool, so we allow localhost and internal networks
 * for users who run local API gateways or proxies.
 * @param url - The URL to validate
 * @returns Object with valid flag and optional error message
 */
export function validateApiBaseUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);

    // Must be HTTP or HTTPS
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Result of an API key connection test
 */
export interface TestResult {
  /** Whether the API key is valid */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Latency in milliseconds (only if valid) */
  latencyMs?: number;
}

/**
 * Get default API base URL for a provider type
 */
export function getDefaultApiBase(providerType: ProviderType): string {
  const defaults: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    custom: 'https://api.openai.com/v1', // Assume OpenAI-compatible by default
  };
  return defaults[providerType] || defaults.openai;
}

/**
 * Test API key connection by making a minimal API request
 * @param providerType - The type of provider (openai, anthropic, custom)
 * @param apiBase - The base URL for the API
 * @param apiKey - The API key to test
 * @param timeout - Timeout in milliseconds (default: 10000)
 * @returns TestResult indicating if the key is valid
 */
export async function testApiKeyConnection(
  providerType: ProviderType,
  apiBase: string,
  apiKey: string,
  timeout: number = 10000
): Promise<TestResult> {
  // Validate URL to prevent SSRF
  const urlValidation = validateApiBaseUrl(apiBase);
  if (!urlValidation.valid) {
    return { valid: false, error: urlValidation.error };
  }

  // Normalize apiBase: remove trailing slashes to prevent URL construction issues
  // e.g., "https://api.openai.com/v1/" -> "https://api.openai.com/v1"
  const normalizedApiBase = apiBase.replace(/\/+$/, '');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const startTime = Date.now();

  try {
    if (providerType === 'anthropic') {
      // Anthropic format: Use /v1/models endpoint (no cost, no model dependency)
      // This validates the API key without making a billable request
      const response = await fetch(`${normalizedApiBase}/models`, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        return { valid: true, latencyMs };
      }

      // Parse error response
      const errorBody = await response.json().catch(() => ({}));
      const errorMessage = (errorBody as any)?.error?.message || response.statusText;

      // 401 = invalid API key
      if (response.status === 401) {
        return { valid: false, error: 'Invalid API key' };
      }
      if (response.status === 403) {
        return { valid: false, error: 'Access denied - check API key permissions' };
      }
      if (response.status === 429) {
        // Rate limited means the key is valid but being throttled
        return { valid: true, latencyMs };
      }

      return { valid: false, error: errorMessage };
    } else {
      // OpenAI-compatible format: GET /v{N}/models
      // Detect if URL already ends with a version pattern like /v1, /v2, /v4, etc.
      const hasVersionSuffix = /\/v\d+$/.test(normalizedApiBase);
      const modelsUrl = hasVersionSuffix ? `${normalizedApiBase}/models` : `${normalizedApiBase}/v1/models`;
      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        return { valid: true, latencyMs };
      }

      // Parse error response
      const errorBody = await response.json().catch(() => ({}));
      const errorMessage = (errorBody as any)?.error?.message || response.statusText;

      if (response.status === 401) {
        return { valid: false, error: 'Invalid API key' };
      }
      if (response.status === 403) {
        return { valid: false, error: 'Access denied - check API key permissions' };
      }
      if (response.status === 429) {
        // Rate limited means the key is valid but being throttled
        return { valid: true, latencyMs };
      }

      return { valid: false, error: errorMessage };
    }
  } catch (err) {
    clearTimeout(timeoutId);

    if ((err as Error).name === 'AbortError') {
      return { valid: false, error: 'Connection timed out' };
    }

    return { valid: false, error: `Connection failed: ${(err as Error).message}` };
  }
}
