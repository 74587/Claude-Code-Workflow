/**
 * LiteLLM Executor - Execute LiteLLM endpoints with context caching
 * Integrates with context-cache for file packing and LiteLLM client for API calls
 */

import { getLiteLLMClient } from './litellm-client.js';
import { handler as contextCacheHandler } from './context-cache.js';
import {
  findEndpointById,
  getProviderWithResolvedEnvVars,
} from '../config/litellm-api-config-manager.js';
import type { CustomEndpoint, ProviderCredential } from '../types/litellm-api-config.js';
import type { CliOutputUnit } from './cli-output-converter.js';

export interface LiteLLMExecutionOptions {
  prompt: string;
  endpointId: string; // Custom endpoint ID (e.g., "my-gpt4o")
  baseDir: string; // Project base directory
  cwd?: string; // Working directory for file resolution
  includeDirs?: string[]; // Additional directories for @patterns
  enableCache?: boolean; // Override endpoint cache setting
  onOutput?: (unit: CliOutputUnit) => void;
  /** Number of retries after the initial attempt (default: 0) */
  maxRetries?: number;
  /** Base delay for exponential backoff in milliseconds (default: 1000) */
  retryBaseDelayMs?: number;
}

export interface LiteLLMExecutionResult {
  success: boolean;
  output: string;
  model: string;
  provider: string;
  cacheUsed: boolean;
  cachedFiles?: string[];
  error?: string;
}

/**
 * Extract @patterns from prompt text
 */
export function extractPatterns(prompt: string): string[] {
  // Match @path patterns: @src/**/*.ts, @CLAUDE.md, @../shared/**/*
  const regex = /@([^\s]+)/g;
  const patterns: string[] = [];
  let match;
  while ((match = regex.exec(prompt)) !== null) {
    patterns.push('@' + match[1]);
  }
  return patterns;
}

/**
 * Execute LiteLLM endpoint with optional context caching
 */
export async function executeLiteLLMEndpoint(
  options: LiteLLMExecutionOptions
): Promise<LiteLLMExecutionResult> {
  const { prompt, endpointId, baseDir, cwd, includeDirs, enableCache, onOutput } = options;

  // 1. Find endpoint configuration
  const endpoint = findEndpointById(baseDir, endpointId);
  if (!endpoint) {
    return {
      success: false,
      output: '',
      model: '',
      provider: '',
      cacheUsed: false,
      error: `Endpoint not found: ${endpointId}`,
    };
  }

  // 2. Get provider with resolved env vars
  const provider = getProviderWithResolvedEnvVars(baseDir, endpoint.providerId);
  if (!provider) {
    return {
      success: false,
      output: '',
      model: '',
      provider: '',
      cacheUsed: false,
      error: `Provider not found: ${endpoint.providerId}`,
    };
  }

  // Verify API key is available
  if (!provider.resolvedApiKey) {
    return {
      success: false,
      output: '',
      model: endpoint.model,
      provider: provider.type,
      cacheUsed: false,
      error: `API key not configured for provider: ${provider.name}`,
    };
  }

  // 3. Process context cache if enabled
  let finalPrompt = prompt;
  let cacheUsed = false;
  let cachedFiles: string[] = [];

  const shouldCache = enableCache ?? endpoint.cacheStrategy.enabled;
  if (shouldCache) {
    const patterns = extractPatterns(prompt);
    if (patterns.length > 0) {
      if (onOutput) {
        onOutput({
          type: 'stderr',
          content: `[Context cache: Found ${patterns.length} @patterns]\n`,
          timestamp: new Date().toISOString()
        });
      }

      // Pack files into cache
      const packResult = await contextCacheHandler({
        operation: 'pack',
        patterns,
        cwd: cwd || process.cwd(),
        include_dirs: includeDirs,
        ttl: endpoint.cacheStrategy.ttlMinutes * 60 * 1000,
        max_file_size: endpoint.cacheStrategy.maxSizeKB * 1024,
      });

      if (packResult.success && packResult.result) {
        const pack = packResult.result as any;

        if (onOutput) {
          onOutput({
            type: 'stderr',
            content: `[Context cache: Packed ${pack.files_packed} files, ${pack.total_bytes} bytes]\n`,
            timestamp: new Date().toISOString()
          });
        }

        // Read cached content
        const readResult = await contextCacheHandler({
          operation: 'read',
          session_id: pack.session_id,
          limit: endpoint.cacheStrategy.maxSizeKB * 1024,
        });

        if (readResult.success && readResult.result) {
          const read = readResult.result as any;
          // Prepend cached content to prompt
          finalPrompt = `${read.content}\n\n---\n\n${prompt}`;
          cacheUsed = true;
          cachedFiles = pack.files_packed ? Array(pack.files_packed).fill('...') : [];

          if (onOutput) {
            onOutput({
              type: 'stderr',
              content: `[Context cache: Applied to prompt]\n`,
              timestamp: new Date().toISOString()
            });
          }
        }
      } else if (packResult.error) {
        if (onOutput) {
          onOutput({
            type: 'stderr',
            content: `[Context cache warning: ${packResult.error}]\n`,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  }

  // 4. Call LiteLLM
  try {
    if (onOutput) {
      onOutput({
        type: 'stderr',
        content: `[LiteLLM: Calling ${provider.type}/${endpoint.model}]\n`,
        timestamp: new Date().toISOString()
      });
    }

    const client = getLiteLLMClient({
      pythonPath: 'python',
      timeout: 120000, // 2 minutes
    });

    // Configure provider credentials via environment
    // LiteLLM uses standard env vars like OPENAI_API_KEY, ANTHROPIC_API_KEY
    const envVarName = getProviderEnvVarName(provider.type);
    if (envVarName) {
      process.env[envVarName] = provider.resolvedApiKey;
    }

    // Set base URL if custom
    if (provider.apiBase) {
      const baseUrlEnvVar = getProviderBaseUrlEnvVarName(provider.type);
      if (baseUrlEnvVar) {
        process.env[baseUrlEnvVar] = provider.apiBase;
      }
    }

    // Set custom headers from provider advanced settings
    if (provider.advancedSettings?.customHeaders) {
      process.env['CCW_LITELLM_EXTRA_HEADERS'] = JSON.stringify(provider.advancedSettings.customHeaders);
    } else {
      // Clear any previous custom headers
      delete process.env['CCW_LITELLM_EXTRA_HEADERS'];
    }

    // Use litellm-client to call chat
    const response = await callWithRetries(
      () => client.chat(finalPrompt, endpoint.model),
      {
        maxRetries: options.maxRetries ?? 0,
        baseDelayMs: options.retryBaseDelayMs ?? 1000,
        onOutput,
        rateLimitKey: `${provider.type}:${endpoint.model}`,
      },
    );

    if (onOutput) {
      onOutput({
        type: 'stdout',
        content: response,
        timestamp: new Date().toISOString()
      });
    }

    return {
      success: true,
      output: response,
      model: endpoint.model,
      provider: provider.type,
      cacheUsed,
      cachedFiles,
    };
  } catch (error) {
    const errorMsg = (error as Error).message;
    if (onOutput) {
      onOutput({
        type: 'stderr',
        content: `[LiteLLM error: ${errorMsg}]\n`,
        timestamp: new Date().toISOString()
      });
    }

    return {
      success: false,
      output: '',
      model: endpoint.model,
      provider: provider.type,
      cacheUsed,
      error: errorMsg,
    };
  }
}

/**
 * Get environment variable name for provider API key
 */
function getProviderEnvVarName(providerType: string): string | null {
  const envVarMap: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_API_KEY',
    azure: 'AZURE_API_KEY',
    mistral: 'MISTRAL_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
  };

  return envVarMap[providerType] || null;
}

/**
 * Get environment variable name for provider base URL
 */
function getProviderBaseUrlEnvVarName(providerType: string): string | null {
  const envVarMap: Record<string, string> = {
    openai: 'OPENAI_API_BASE',
    anthropic: 'ANTHROPIC_API_BASE',
    azure: 'AZURE_API_BASE',
  };

  return envVarMap[providerType] || null;
}

const rateLimitRetryQueueNextAt = new Map<string, number>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(errorMessage: string): boolean {
  return /429|rate limit|too many requests/i.test(errorMessage);
}

function isRetryableError(errorMessage: string): boolean {
  // Never retry auth/config errors
  if (/401|403|unauthorized|forbidden/i.test(errorMessage)) {
    return false;
  }

  // Retry rate limits, transient server errors, and network timeouts
  return /(429|500|502|503|504|timeout|timed out|econnreset|enotfound|econnrefused|socket hang up)/i.test(
    errorMessage,
  );
}

async function callWithRetries(
  call: () => Promise<string>,
  options: {
    maxRetries: number;
    baseDelayMs: number;
    onOutput?: (unit: CliOutputUnit) => void;
    rateLimitKey: string;
  },
): Promise<string> {
  const { maxRetries, baseDelayMs, onOutput, rateLimitKey } = options;
  let attempt = 0;

  while (true) {
    try {
      return await call();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      if (attempt >= maxRetries || !isRetryableError(errorMessage)) {
        throw err;
      }

      const delayMs = baseDelayMs * 2 ** attempt;

      if (onOutput) {
        onOutput({
          type: 'stderr',
          content: `[LiteLLM retry ${attempt + 1}/${maxRetries}: waiting ${delayMs}ms] ${errorMessage}\n`,
          timestamp: new Date().toISOString()
        });
      }

      attempt += 1;

      if (isRateLimitError(errorMessage)) {
        const now = Date.now();
        const earliestAt = now + delayMs;
        const queuedAt = rateLimitRetryQueueNextAt.get(rateLimitKey) ?? 0;
        const scheduledAt = Math.max(queuedAt, earliestAt);
        rateLimitRetryQueueNextAt.set(rateLimitKey, scheduledAt + delayMs);

        await sleep(scheduledAt - now);
        continue;
      }

      await sleep(delayMs);
    }
  }
}
