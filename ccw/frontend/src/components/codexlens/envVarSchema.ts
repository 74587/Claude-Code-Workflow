// ========================================
// CodexLens v2 Environment Variable Schema
// ========================================
// Defines structured groups for codexlens-search v2 configuration.
// Env var names match what the Python bridge CLI reads.

import type { EnvVarGroupsSchema } from '@/types/codexlens';

export const envVarGroupsSchema: EnvVarGroupsSchema = {
  embedding: {
    id: 'embedding',
    labelKey: 'codexlens.envGroup.embedding',
    icon: 'box',
    vars: {
      CODEXLENS_EMBEDDING_BACKEND: {
        key: 'CODEXLENS_EMBEDDING_BACKEND',
        labelKey: 'codexlens.envField.backend',
        type: 'select',
        options: ['local', 'api'],
        default: 'local',
        settingsPath: 'embedding.backend',
      },
      CODEXLENS_EMBED_API_URL: {
        key: 'CODEXLENS_EMBED_API_URL',
        labelKey: 'codexlens.envField.apiUrl',
        type: 'text',
        placeholder: 'https://api.siliconflow.cn/v1',
        default: '',
        settingsPath: 'embedding.api_url',
        showWhen: (env) => env['CODEXLENS_EMBEDDING_BACKEND'] === 'api',
      },
      CODEXLENS_EMBED_API_KEY: {
        key: 'CODEXLENS_EMBED_API_KEY',
        labelKey: 'codexlens.envField.apiKey',
        type: 'password',
        placeholder: 'sk-...',
        default: '',
        settingsPath: 'embedding.api_key',
        showWhen: (env) => env['CODEXLENS_EMBEDDING_BACKEND'] === 'api',
      },
      CODEXLENS_EMBED_API_MODEL: {
        key: 'CODEXLENS_EMBED_API_MODEL',
        labelKey: 'codexlens.envField.model',
        type: 'model-select',
        placeholder: 'Select or enter model...',
        default: '',
        settingsPath: 'embedding.api_model',
        showWhen: (env) => env['CODEXLENS_EMBEDDING_BACKEND'] === 'api',
        localModels: [],
        apiModels: [
          {
            group: 'SiliconFlow',
            items: ['BAAI/bge-m3', 'BAAI/bge-large-zh-v1.5', 'BAAI/bge-large-en-v1.5'],
          },
          {
            group: 'OpenAI',
            items: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'],
          },
          {
            group: 'Cohere',
            items: ['embed-english-v3.0', 'embed-multilingual-v3.0', 'embed-english-light-v3.0'],
          },
          {
            group: 'Voyage',
            items: ['voyage-3', 'voyage-3-lite', 'voyage-code-3'],
          },
          {
            group: 'Jina',
            items: ['jina-embeddings-v3', 'jina-embeddings-v2-base-en'],
          },
        ],
      },
      CODEXLENS_EMBED_API_ENDPOINTS: {
        key: 'CODEXLENS_EMBED_API_ENDPOINTS',
        labelKey: 'codexlens.envField.multiEndpoints',
        type: 'text',
        placeholder: 'url1|key1|model1,url2|key2|model2',
        default: '',
        settingsPath: 'embedding.api_endpoints',
        showWhen: (env) => env['CODEXLENS_EMBEDDING_BACKEND'] === 'api',
      },
      CODEXLENS_EMBED_DIM: {
        key: 'CODEXLENS_EMBED_DIM',
        labelKey: 'codexlens.envField.embedDim',
        type: 'number',
        placeholder: '384',
        default: '384',
        settingsPath: 'embedding.dim',
        min: 64,
        max: 4096,
        showWhen: (env) => env['CODEXLENS_EMBEDDING_BACKEND'] === 'api',
      },
      CODEXLENS_EMBED_API_CONCURRENCY: {
        key: 'CODEXLENS_EMBED_API_CONCURRENCY',
        labelKey: 'codexlens.envField.apiConcurrency',
        type: 'number',
        placeholder: '4',
        default: '4',
        settingsPath: 'embedding.api_concurrency',
        min: 1,
        max: 32,
        showWhen: (env) => env['CODEXLENS_EMBEDDING_BACKEND'] === 'api',
      },
      CODEXLENS_EMBED_API_MAX_TOKENS: {
        key: 'CODEXLENS_EMBED_API_MAX_TOKENS',
        labelKey: 'codexlens.envField.maxTokensPerBatch',
        type: 'number',
        placeholder: '8192',
        default: '8192',
        settingsPath: 'embedding.api_max_tokens_per_batch',
        min: 512,
        max: 65536,
        showWhen: (env) => env['CODEXLENS_EMBEDDING_BACKEND'] === 'api',
      },
      CODEXLENS_EMBEDDING_MODEL: {
        key: 'CODEXLENS_EMBEDDING_MODEL',
        labelKey: 'codexlens.envField.localModel',
        type: 'model-select',
        placeholder: 'Select local model...',
        default: 'BAAI/bge-small-en-v1.5',
        settingsPath: 'embedding.model',
        showWhen: (env) => env['CODEXLENS_EMBEDDING_BACKEND'] !== 'api',
        localModels: [
          {
            group: 'FastEmbed Profiles',
            items: ['small', 'base', 'large', 'code'],
          },
        ],
        apiModels: [],
      },
      CODEXLENS_USE_GPU: {
        key: 'CODEXLENS_USE_GPU',
        labelKey: 'codexlens.envField.useGpu',
        type: 'select',
        options: ['auto', 'cuda', 'cpu'],
        default: 'auto',
        settingsPath: 'embedding.device',
        showWhen: (env) => env['CODEXLENS_EMBEDDING_BACKEND'] !== 'api',
      },
      CODEXLENS_EMBED_BATCH_SIZE: {
        key: 'CODEXLENS_EMBED_BATCH_SIZE',
        labelKey: 'codexlens.envField.batchSize',
        type: 'number',
        placeholder: '64',
        default: '64',
        settingsPath: 'embedding.batch_size',
        min: 1,
        max: 512,
      },
    },
  },
  reranker: {
    id: 'reranker',
    labelKey: 'codexlens.envGroup.reranker',
    icon: 'arrow-up-down',
    vars: {
      CODEXLENS_RERANKER_BACKEND: {
        key: 'CODEXLENS_RERANKER_BACKEND',
        labelKey: 'codexlens.envField.backend',
        type: 'select',
        options: ['local', 'api'],
        default: 'local',
        settingsPath: 'reranker.backend',
      },
      CODEXLENS_RERANKER_API_URL: {
        key: 'CODEXLENS_RERANKER_API_URL',
        labelKey: 'codexlens.envField.apiUrl',
        type: 'text',
        placeholder: 'https://api.siliconflow.cn/v1',
        default: '',
        settingsPath: 'reranker.api_url',
        showWhen: (env) => env['CODEXLENS_RERANKER_BACKEND'] === 'api',
      },
      CODEXLENS_RERANKER_API_KEY: {
        key: 'CODEXLENS_RERANKER_API_KEY',
        labelKey: 'codexlens.envField.apiKey',
        type: 'password',
        placeholder: 'sk-...',
        default: '',
        settingsPath: 'reranker.api_key',
        showWhen: (env) => env['CODEXLENS_RERANKER_BACKEND'] === 'api',
      },
      CODEXLENS_RERANKER_API_MODEL: {
        key: 'CODEXLENS_RERANKER_API_MODEL',
        labelKey: 'codexlens.envField.model',
        type: 'model-select',
        placeholder: 'Select or enter model...',
        default: '',
        settingsPath: 'reranker.api_model',
        showWhen: (env) => env['CODEXLENS_RERANKER_BACKEND'] === 'api',
        localModels: [],
        apiModels: [
          {
            group: 'SiliconFlow',
            items: ['BAAI/bge-reranker-v2-m3', 'BAAI/bge-reranker-large', 'BAAI/bge-reranker-base'],
          },
          {
            group: 'Cohere',
            items: ['rerank-english-v3.0', 'rerank-multilingual-v3.0'],
          },
          {
            group: 'Jina',
            items: ['jina-reranker-v2-base-multilingual'],
          },
        ],
      },
      CODEXLENS_RERANKER_MODEL: {
        key: 'CODEXLENS_RERANKER_MODEL',
        labelKey: 'codexlens.envField.localModel',
        type: 'model-select',
        placeholder: 'Select local model...',
        default: 'Xenova/ms-marco-MiniLM-L-6-v2',
        settingsPath: 'reranker.model',
        showWhen: (env) => env['CODEXLENS_RERANKER_BACKEND'] !== 'api',
        localModels: [
          {
            group: 'FastEmbed/ONNX',
            items: [
              'Xenova/ms-marco-MiniLM-L-6-v2',
              'cross-encoder/ms-marco-MiniLM-L-6-v2',
              'BAAI/bge-reranker-base',
            ],
          },
        ],
        apiModels: [],
      },
      CODEXLENS_RERANKER_TOP_K: {
        key: 'CODEXLENS_RERANKER_TOP_K',
        labelKey: 'codexlens.envField.topKResults',
        type: 'number',
        placeholder: '20',
        default: '20',
        settingsPath: 'reranker.top_k',
        min: 5,
        max: 200,
      },
      CODEXLENS_RERANKER_BATCH_SIZE: {
        key: 'CODEXLENS_RERANKER_BATCH_SIZE',
        labelKey: 'codexlens.envField.batchSize',
        type: 'number',
        placeholder: '32',
        default: '32',
        settingsPath: 'reranker.batch_size',
        min: 1,
        max: 128,
      },
    },
  },
  search: {
    id: 'search',
    labelKey: 'codexlens.envGroup.search',
    icon: 'git-branch',
    vars: {
      CODEXLENS_BINARY_TOP_K: {
        key: 'CODEXLENS_BINARY_TOP_K',
        labelKey: 'codexlens.envField.binaryTopK',
        type: 'number',
        placeholder: '200',
        default: '200',
        settingsPath: 'search.binary_top_k',
        min: 10,
        max: 1000,
      },
      CODEXLENS_ANN_TOP_K: {
        key: 'CODEXLENS_ANN_TOP_K',
        labelKey: 'codexlens.envField.annTopK',
        type: 'number',
        placeholder: '50',
        default: '50',
        settingsPath: 'search.ann_top_k',
        min: 5,
        max: 500,
      },
      CODEXLENS_FTS_TOP_K: {
        key: 'CODEXLENS_FTS_TOP_K',
        labelKey: 'codexlens.envField.ftsTopK',
        type: 'number',
        placeholder: '50',
        default: '50',
        settingsPath: 'search.fts_top_k',
        min: 5,
        max: 500,
      },
      CODEXLENS_FUSION_K: {
        key: 'CODEXLENS_FUSION_K',
        labelKey: 'codexlens.envField.fusionK',
        type: 'number',
        placeholder: '60',
        default: '60',
        settingsPath: 'search.fusion_k',
        min: 1,
        max: 200,
      },
    },
  },
  indexing: {
    id: 'indexing',
    labelKey: 'codexlens.envGroup.indexing',
    icon: 'cpu',
    vars: {
      CODEXLENS_CODE_AWARE_CHUNKING: {
        key: 'CODEXLENS_CODE_AWARE_CHUNKING',
        labelKey: 'codexlens.envField.codeAwareChunking',
        type: 'checkbox',
        default: 'true',
        settingsPath: 'indexing.code_aware_chunking',
      },
      CODEXLENS_INDEX_WORKERS: {
        key: 'CODEXLENS_INDEX_WORKERS',
        labelKey: 'codexlens.envField.indexWorkers',
        type: 'number',
        placeholder: '2',
        default: '2',
        settingsPath: 'indexing.workers',
        min: 1,
        max: 16,
      },
      CODEXLENS_MAX_FILE_SIZE: {
        key: 'CODEXLENS_MAX_FILE_SIZE',
        labelKey: 'codexlens.envField.maxFileSize',
        type: 'number',
        placeholder: '1000000',
        default: '1000000',
        settingsPath: 'indexing.max_file_size_bytes',
        min: 10000,
        max: 10000000,
      },
      CODEXLENS_HNSW_EF: {
        key: 'CODEXLENS_HNSW_EF',
        labelKey: 'codexlens.envField.hnswEf',
        type: 'number',
        placeholder: '150',
        default: '150',
        settingsPath: 'indexing.hnsw_ef',
        min: 10,
        max: 500,
      },
      CODEXLENS_HNSW_M: {
        key: 'CODEXLENS_HNSW_M',
        labelKey: 'codexlens.envField.hnswM',
        type: 'number',
        placeholder: '32',
        default: '32',
        settingsPath: 'indexing.hnsw_M',
        min: 4,
        max: 128,
      },
    },
  },
};

/**
 * Get all env var keys from the schema
 */
export function getAllEnvVarKeys(): string[] {
  const keys: string[] = [];
  for (const group of Object.values(envVarGroupsSchema)) {
    for (const key of Object.keys(group.vars)) {
      keys.push(key);
    }
  }
  return keys;
}

/**
 * Evaluate showWhen condition for a field
 */
export function evaluateShowWhen(
  field: { showWhen?: (env: Record<string, string>) => boolean },
  values: Record<string, string>
): boolean {
  if (!field.showWhen) return true;
  return field.showWhen(values);
}

/**
 * Get default values for all env vars in the schema
 */
export function getSchemaDefaults(): Record<string, string> {
  const defaults: Record<string, string> = {};
  for (const group of Object.values(envVarGroupsSchema)) {
    for (const [key, field] of Object.entries(group.vars)) {
      if (field.default !== undefined) {
        defaults[key] = field.default;
      }
    }
  }
  return defaults;
}
