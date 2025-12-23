/**
 * LiteLLM API Configuration Type Definitions
 *
 * Defines types for provider credentials, cache strategies, custom endpoints,
 * and the overall configuration structure for LiteLLM API integration.
 */

/**
 * Supported LLM provider types
 */
export type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'ollama'
  | 'azure'
  | 'google'
  | 'mistral'
  | 'deepseek'
  | 'custom';

/**
 * Provider credential configuration
 * Stores API keys, base URLs, and provider metadata
 */
export interface ProviderCredential {
  /** Unique identifier for this provider configuration */
  id: string;

  /** Display name for UI */
  name: string;

  /** Provider type */
  type: ProviderType;

  /** API key or environment variable reference (e.g., ${OPENAI_API_KEY}) */
  apiKey: string;

  /** Custom API base URL (optional, overrides provider default) */
  apiBase?: string;

  /** Whether this provider is enabled */
  enabled: boolean;

  /** Creation timestamp (ISO 8601) */
  createdAt: string;

  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/**
 * Cache strategy for prompt context optimization
 * Enables file-based caching to reduce token usage
 */
export interface CacheStrategy {
  /** Whether caching is enabled for this endpoint */
  enabled: boolean;

  /** Time-to-live in minutes (default: 60) */
  ttlMinutes: number;

  /** Maximum cache size in KB (default: 512) */
  maxSizeKB: number;

  /** File patterns to cache (glob patterns like "*.md", "*.ts") */
  filePatterns: string[];
}

/**
 * Custom endpoint configuration
 * Maps CLI identifiers to specific models and caching strategies
 */
export interface CustomEndpoint {
  /** Unique CLI identifier (used in --model flag, e.g., "my-gpt4o") */
  id: string;

  /** Display name for UI */
  name: string;

  /** Reference to provider credential ID */
  providerId: string;

  /** Model identifier (e.g., "gpt-4o", "claude-3-5-sonnet-20241022") */
  model: string;

  /** Optional description */
  description?: string;

  /** Cache strategy for this endpoint */
  cacheStrategy: CacheStrategy;

  /** Whether this endpoint is enabled */
  enabled: boolean;

  /** Creation timestamp (ISO 8601) */
  createdAt: string;

  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/**
 * Global cache settings
 * Applies to all endpoints unless overridden
 */
export interface GlobalCacheSettings {
  /** Whether caching is globally enabled */
  enabled: boolean;

  /** Cache directory path (default: ~/.ccw/cache/context) */
  cacheDir: string;

  /** Maximum total cache size in MB (default: 100) */
  maxTotalSizeMB: number;
}

/**
 * Complete LiteLLM API configuration
 * Root configuration object stored in JSON file
 */
export interface LiteLLMApiConfig {
  /** Configuration schema version */
  version: number;

  /** List of configured providers */
  providers: ProviderCredential[];

  /** List of custom endpoints */
  endpoints: CustomEndpoint[];

  /** Default endpoint ID (optional) */
  defaultEndpoint?: string;

  /** Global cache settings */
  globalCacheSettings: GlobalCacheSettings;
}
