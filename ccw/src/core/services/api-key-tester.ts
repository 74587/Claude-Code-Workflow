/**
 * API Key Tester Service
 * Shared module for testing API key connectivity across different provider types.
 * Used by both manual testing (litellm-api-routes.ts) and health check service.
 */

import type { ProviderType } from '../../types/litellm-api-config.js';

/**
 * Allowed URL patterns for API base URLs (SSRF protection)
 * Only allows HTTPS URLs to known API providers or custom domains
 */
const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^\[::1\]$/,
  /^metadata\.google\.internal$/i,
  /^169\.254\.\d+\.\d+$/,  // AWS metadata service
];

/**
 * Validate API base URL to prevent SSRF attacks
 * @param url - The URL to validate
 * @returns Object with valid flag and optional error message
 */
export function validateApiBaseUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);

    // Must be HTTPS (except for localhost in development)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, error: 'URL must use HTTPS protocol' };
    }

    // Check against blocked hosts
    const hostname = parsed.hostname.toLowerCase();
    for (const pattern of BLOCKED_HOSTS) {
      if (pattern.test(hostname)) {
        return { valid: false, error: 'URL points to internal/private network address' };
      }
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const startTime = Date.now();

  try {
    if (providerType === 'anthropic') {
      // Anthropic format: POST /v1/messages with minimal payload
      const response = await fetch(`${apiBase}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
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

      // 401 = invalid API key, other 4xx might be valid key with other issues
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
      // OpenAI-compatible format: GET /v1/models
      const modelsUrl = apiBase.endsWith('/v1') ? `${apiBase}/models` : `${apiBase}/v1/models`;
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
