/**
 * LiteLLM API Configuration Type Definitions
 *
 * Defines types for provider credentials, cache strategies, custom endpoints,
 * and the overall configuration structure for LiteLLM API integration.
 */

/**
 * API format types (simplified)
 * Most providers use OpenAI-compatible format
 */
export type ProviderType =
  | 'openai'      // OpenAI-compatible format (most providers)
  | 'anthropic'   // Anthropic format
  | 'custom';     // Custom format

/**
 * Advanced provider settings for LiteLLM compatibility
 * Maps to LiteLLM's provider configuration options
 */
export interface ProviderAdvancedSettings {
  /** Request timeout in seconds (default: 300) */
  timeout?: number;

  /** Maximum retry attempts on failure (default: 3) */
  maxRetries?: number;

  /** Organization ID (OpenAI-specific) */
  organization?: string;

  /** API version string (Azure-specific, e.g., "2024-02-01") */
  apiVersion?: string;

  /** Custom HTTP headers as JSON object */
  customHeaders?: Record<string, string>;

  /** Requests per minute rate limit */
  rpm?: number;

  /** Tokens per minute rate limit */
  tpm?: number;

  /** Proxy server URL (e.g., "http://proxy.example.com:8080") */
  proxy?: string;
}

/**
 * Model type classification
 */
export type ModelType = 'llm' | 'embedding';

/**
 * Model capability metadata
 */
export interface ModelCapabilities {
  /** Whether the model supports streaming responses */
  streaming?: boolean;

  /** Whether the model supports function/tool calling */
  functionCalling?: boolean;

  /** Whether the model supports vision/image input */
  vision?: boolean;

  /** Context window size in tokens */
  contextWindow?: number;

  /** Embedding dimension (for embedding models only) */
  embeddingDimension?: number;

  /** Maximum output tokens */
  maxOutputTokens?: number;
}

/**
 * Routing strategy for load balancing across multiple keys
 */
export type RoutingStrategy = 
  | 'simple-shuffle'    // Random selection (default, recommended)
  | 'weighted'          // Weight-based distribution
  | 'latency-based'     // Route to lowest latency
  | 'cost-based'        // Route to lowest cost
  | 'least-busy';       // Route to least concurrent

/**
 * Individual API key configuration with optional weight
 */
export interface ApiKeyEntry {
  /** Unique identifier */
  id: string;

  /** API key value or env var reference */
  key: string;

  /** Display label for this key */
  label?: string;

  /** Weight for weighted routing (default: 1) */
  weight?: number;

  /** Whether this key is enabled */
  enabled: boolean;

  /** Last health check status */
  healthStatus?: 'healthy' | 'unhealthy' | 'unknown';

  /** Last health check timestamp */
  lastHealthCheck?: string;

  /** Error message if unhealthy */
  lastError?: string;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /** Enable automatic health checks */
  enabled: boolean;

  /** Check interval in seconds (default: 300) */
  intervalSeconds: number;

  /** Cooldown period after failure in seconds (default: 5) */
  cooldownSeconds: number;

  /** Number of failures before marking unhealthy (default: 3) */
  failureThreshold: number;
}


/**
 * Model-specific endpoint settings
 * Allows per-model configuration overrides
 */
export interface ModelEndpointSettings {
  /** Override base URL for this model */
  baseUrl?: string;

  /** Override timeout for this model */
  timeout?: number;

  /** Override max retries for this model */
  maxRetries?: number;

  /** Custom headers for this model */
  customHeaders?: Record<string, string>;

  /** Cache strategy for this model */
  cacheStrategy?: CacheStrategy;
}

/**
 * Model definition with type and grouping
 */
export interface ModelDefinition {
  /** Unique identifier for this model */
  id: string;

  /** Display name for UI */
  name: string;

  /** Model type: LLM or Embedding */
  type: ModelType;

  /** Model series for grouping (e.g., "GPT-4", "Claude-3") */
  series: string;

  /** Whether this model is enabled */
  enabled: boolean;

  /** Model capabilities */
  capabilities?: ModelCapabilities;

  /** Model-specific endpoint settings */
  endpointSettings?: ModelEndpointSettings;

  /** Optional description */
  description?: string;

  /** Creation timestamp (ISO 8601) */
  createdAt: string;

  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

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

  /** Advanced provider settings (optional) */
  advancedSettings?: ProviderAdvancedSettings;

  /** Multiple API keys for load balancing */
  apiKeys?: ApiKeyEntry[];

  /** Routing strategy for multi-key load balancing */
  routingStrategy?: RoutingStrategy;

  /** Health check configuration */
  healthCheck?: HealthCheckConfig;

  /** LLM models configured for this provider */
  llmModels?: ModelDefinition[];

  /** Embedding models configured for this provider */
  embeddingModels?: ModelDefinition[];

  /** Reranker models configured for this provider */
  rerankerModels?: ModelDefinition[];

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
 * CodexLens embedding provider selection for rotation
 * Aggregates provider + model + all API keys
 */
export interface CodexLensEmbeddingProvider {
  /** Reference to provider credential ID */
  providerId: string;

  /** Embedding model ID from the provider */
  modelId: string;

  /** Whether to use all API keys from this provider (default: true) */
  useAllKeys: boolean;

  /** Specific API key IDs to use (if useAllKeys is false) */
  selectedKeyIds?: string[];

  /** Weight for weighted routing (default: 1.0, applies to all keys from this provider) */
  weight: number;

  /** Maximum concurrent requests per key (default: 4) */
  maxConcurrentPerKey: number;

  /** Whether this provider is enabled for rotation */
  enabled: boolean;
}

/**
 * CodexLens multi-provider embedding rotation configuration
 * Aggregates multiple providers with same model for parallel rotation
 */
export interface CodexLensEmbeddingRotation {
  /** Whether multi-provider rotation is enabled */
  enabled: boolean;

  /** Selection strategy: round_robin, latency_aware, weighted_random */
  strategy: 'round_robin' | 'latency_aware' | 'weighted_random';

  /** Default cooldown seconds for rate-limited endpoints (default: 60) */
  defaultCooldown: number;

  /** Target model name that all providers should support (e.g., "qwen3-embedding") */
  targetModel: string;

  /** List of providers to aggregate for rotation */
  providers: CodexLensEmbeddingProvider[];
}

/**
 * Generic embedding pool configuration (refactored from CodexLensEmbeddingRotation)
 * Supports automatic discovery of all providers offering a specific model
 * @deprecated Use ModelPoolConfig instead
 */
export interface EmbeddingPoolConfig {
  /** Whether embedding pool is enabled */
  enabled: boolean;

  /** Target embedding model name (e.g., "text-embedding-3-small") */
  targetModel: string;

  /** Selection strategy: round_robin, latency_aware, weighted_random */
  strategy: 'round_robin' | 'latency_aware' | 'weighted_random';

  /** Whether to automatically discover all providers offering targetModel */
  autoDiscover: boolean;

  /** Provider IDs to exclude from auto-discovery (optional) */
  excludedProviderIds?: string[];

  /** Default cooldown seconds for rate-limited endpoints (default: 60) */
  defaultCooldown: number;

  /** Default maximum concurrent requests per key (default: 4) */
  defaultMaxConcurrentPerKey: number;
}

/**
 * Model type for pool configuration
 */
export type ModelPoolType = 'embedding' | 'llm' | 'reranker';

/**
 * Individual model pool configuration
 * Supports embedding, LLM, and reranker models with high availability
 */
export interface ModelPoolConfig {
  /** Unique identifier for this pool */
  id: string;

  /** Model type: embedding, llm, or reranker */
  modelType: ModelPoolType;

  /** Whether this pool is enabled */
  enabled: boolean;

  /** Target model name (e.g., "text-embedding-3-small", "gpt-4o") */
  targetModel: string;

  /** Selection strategy: round_robin, latency_aware, weighted_random */
  strategy: 'round_robin' | 'latency_aware' | 'weighted_random';

  /** Whether to automatically discover all providers offering targetModel */
  autoDiscover: boolean;

  /** Provider IDs to exclude from auto-discovery (optional) */
  excludedProviderIds?: string[];

  /** Default cooldown seconds for rate-limited endpoints (default: 60) */
  defaultCooldown: number;

  /** Default maximum concurrent requests per key (default: 4) */
  defaultMaxConcurrentPerKey: number;

  /** Optional display name for this pool */
  name?: string;

  /** Optional description */
  description?: string;
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

  /** CodexLens multi-provider embedding rotation config (deprecated, use embeddingPoolConfig) */
  codexlensEmbeddingRotation?: CodexLensEmbeddingRotation;

  /** Generic embedding pool configuration with auto-discovery support (deprecated, use modelPools) */
  embeddingPoolConfig?: EmbeddingPoolConfig;

  /** Multi-model pool configurations (supports embedding, LLM, reranker) */
  modelPools?: ModelPoolConfig[];
}
