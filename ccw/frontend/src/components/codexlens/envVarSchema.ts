// ========================================
// CodexLens Environment Variable Schema
// ========================================
// TypeScript port of ENV_VAR_GROUPS from codexlens-manager.js
// Defines structured groups for CodexLens configuration

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
      CODEXLENS_EMBEDDING_MODEL: {
        key: 'CODEXLENS_EMBEDDING_MODEL',
        labelKey: 'codexlens.envField.model',
        type: 'model-select',
        placeholder: 'Select or enter model...',
        default: 'fast',
        settingsPath: 'embedding.model',
        localModels: [
          {
            group: 'FastEmbed Profiles',
            items: ['fast', 'code', 'base', 'minilm', 'multilingual', 'balanced'],
          },
        ],
        apiModels: [
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
            items: ['voyage-3', 'voyage-3-lite', 'voyage-code-3', 'voyage-multilingual-2'],
          },
          {
            group: 'SiliconFlow',
            items: ['BAAI/bge-m3', 'BAAI/bge-large-zh-v1.5', 'BAAI/bge-large-en-v1.5'],
          },
          {
            group: 'Jina',
            items: ['jina-embeddings-v3', 'jina-embeddings-v2-base-en', 'jina-embeddings-v2-base-zh'],
          },
        ],
      },
      CODEXLENS_USE_GPU: {
        key: 'CODEXLENS_USE_GPU',
        labelKey: 'codexlens.envField.useGpu',
        type: 'select',
        options: ['true', 'false'],
        default: 'true',
        settingsPath: 'embedding.use_gpu',
        showWhen: (env) => env['CODEXLENS_EMBEDDING_BACKEND'] === 'local',
      },
      CODEXLENS_EMBEDDING_POOL_ENABLED: {
        key: 'CODEXLENS_EMBEDDING_POOL_ENABLED',
        labelKey: 'codexlens.envField.highAvailability',
        type: 'select',
        options: ['true', 'false'],
        default: 'false',
        settingsPath: 'embedding.pool_enabled',
        showWhen: (env) => env['CODEXLENS_EMBEDDING_BACKEND'] === 'api',
      },
      CODEXLENS_EMBEDDING_STRATEGY: {
        key: 'CODEXLENS_EMBEDDING_STRATEGY',
        labelKey: 'codexlens.envField.loadBalanceStrategy',
        type: 'select',
        options: ['round_robin', 'latency_aware', 'weighted_random'],
        default: 'latency_aware',
        settingsPath: 'embedding.strategy',
        showWhen: (env) =>
          env['CODEXLENS_EMBEDDING_BACKEND'] === 'api' &&
          env['CODEXLENS_EMBEDDING_POOL_ENABLED'] === 'true',
      },
      CODEXLENS_EMBEDDING_COOLDOWN: {
        key: 'CODEXLENS_EMBEDDING_COOLDOWN',
        labelKey: 'codexlens.envField.rateLimitCooldown',
        type: 'number',
        placeholder: '60',
        default: '60',
        settingsPath: 'embedding.cooldown',
        min: 0,
        max: 300,
        showWhen: (env) =>
          env['CODEXLENS_EMBEDDING_BACKEND'] === 'api' &&
          env['CODEXLENS_EMBEDDING_POOL_ENABLED'] === 'true',
      },
    },
  },
  reranker: {
    id: 'reranker',
    labelKey: 'codexlens.envGroup.reranker',
    icon: 'arrow-up-down',
    vars: {
      CODEXLENS_RERANKER_ENABLED: {
        key: 'CODEXLENS_RERANKER_ENABLED',
        labelKey: 'codexlens.envField.enabled',
        type: 'select',
        options: ['true', 'false'],
        default: 'true',
        settingsPath: 'reranker.enabled',
      },
      CODEXLENS_RERANKER_BACKEND: {
        key: 'CODEXLENS_RERANKER_BACKEND',
        labelKey: 'codexlens.envField.backend',
        type: 'select',
        options: ['onnx', 'api', 'litellm', 'legacy'],
        default: 'onnx',
        settingsPath: 'reranker.backend',
      },
      CODEXLENS_RERANKER_MODEL: {
        key: 'CODEXLENS_RERANKER_MODEL',
        labelKey: 'codexlens.envField.model',
        type: 'model-select',
        placeholder: 'Select or enter model...',
        default: 'Xenova/ms-marco-MiniLM-L-6-v2',
        settingsPath: 'reranker.model',
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
        apiModels: [
          {
            group: 'Cohere',
            items: ['rerank-english-v3.0', 'rerank-multilingual-v3.0', 'rerank-english-v2.0'],
          },
          {
            group: 'Voyage',
            items: ['rerank-2', 'rerank-2-lite', 'rerank-1'],
          },
          {
            group: 'SiliconFlow',
            items: ['BAAI/bge-reranker-v2-m3', 'BAAI/bge-reranker-large', 'BAAI/bge-reranker-base'],
          },
          {
            group: 'Jina',
            items: ['jina-reranker-v2-base-multilingual', 'jina-reranker-v1-base-en'],
          },
        ],
      },
      CODEXLENS_RERANKER_TOP_K: {
        key: 'CODEXLENS_RERANKER_TOP_K',
        labelKey: 'codexlens.envField.topKResults',
        type: 'number',
        placeholder: '50',
        default: '50',
        settingsPath: 'reranker.top_k',
        min: 5,
        max: 200,
      },
      CODEXLENS_RERANKER_POOL_ENABLED: {
        key: 'CODEXLENS_RERANKER_POOL_ENABLED',
        labelKey: 'codexlens.envField.highAvailability',
        type: 'select',
        options: ['true', 'false'],
        default: 'false',
        settingsPath: 'reranker.pool_enabled',
        showWhen: (env) => env['CODEXLENS_RERANKER_BACKEND'] === 'api' || env['CODEXLENS_RERANKER_BACKEND'] === 'litellm',
      },
      CODEXLENS_RERANKER_STRATEGY: {
        key: 'CODEXLENS_RERANKER_STRATEGY',
        labelKey: 'codexlens.envField.loadBalanceStrategy',
        type: 'select',
        options: ['round_robin', 'latency_aware', 'weighted_random'],
        default: 'latency_aware',
        settingsPath: 'reranker.strategy',
        showWhen: (env) =>
          (env['CODEXLENS_RERANKER_BACKEND'] === 'api' || env['CODEXLENS_RERANKER_BACKEND'] === 'litellm') &&
          env['CODEXLENS_RERANKER_POOL_ENABLED'] === 'true',
      },
      CODEXLENS_RERANKER_COOLDOWN: {
        key: 'CODEXLENS_RERANKER_COOLDOWN',
        labelKey: 'codexlens.envField.rateLimitCooldown',
        type: 'number',
        placeholder: '60',
        default: '60',
        settingsPath: 'reranker.cooldown',
        min: 0,
        max: 300,
        showWhen: (env) =>
          (env['CODEXLENS_RERANKER_BACKEND'] === 'api' || env['CODEXLENS_RERANKER_BACKEND'] === 'litellm') &&
          env['CODEXLENS_RERANKER_POOL_ENABLED'] === 'true',
      },
    },
  },
  concurrency: {
    id: 'concurrency',
    labelKey: 'codexlens.envGroup.concurrency',
    icon: 'cpu',
    vars: {
      CODEXLENS_API_MAX_WORKERS: {
        key: 'CODEXLENS_API_MAX_WORKERS',
        labelKey: 'codexlens.envField.maxWorkers',
        type: 'number',
        placeholder: '4',
        default: '4',
        settingsPath: 'api.max_workers',
        min: 1,
        max: 32,
      },
      CODEXLENS_API_BATCH_SIZE: {
        key: 'CODEXLENS_API_BATCH_SIZE',
        labelKey: 'codexlens.envField.batchSize',
        type: 'number',
        placeholder: '8',
        default: '8',
        settingsPath: 'api.batch_size',
        min: 1,
        max: 64,
        showWhen: (env) => env['CODEXLENS_API_BATCH_SIZE_DYNAMIC'] !== 'true',
      },
      CODEXLENS_API_BATCH_SIZE_DYNAMIC: {
        key: 'CODEXLENS_API_BATCH_SIZE_DYNAMIC',
        labelKey: 'codexlens.envField.dynamicBatchSize',
        type: 'checkbox',
        default: 'false',
        settingsPath: 'api.batch_size_dynamic',
      },
      CODEXLENS_API_BATCH_SIZE_UTILIZATION: {
        key: 'CODEXLENS_API_BATCH_SIZE_UTILIZATION',
        labelKey: 'codexlens.envField.batchSizeUtilization',
        type: 'number',
        placeholder: '0.8',
        default: '0.8',
        settingsPath: 'api.batch_size_utilization_factor',
        min: 0.1,
        max: 0.95,
        step: 0.05,
        showWhen: (env) => env['CODEXLENS_API_BATCH_SIZE_DYNAMIC'] === 'true',
      },
      CODEXLENS_API_BATCH_SIZE_MAX: {
        key: 'CODEXLENS_API_BATCH_SIZE_MAX',
        labelKey: 'codexlens.envField.batchSizeMax',
        type: 'number',
        placeholder: '2048',
        default: '2048',
        settingsPath: 'api.batch_size_max',
        min: 1,
        max: 4096,
        showWhen: (env) => env['CODEXLENS_API_BATCH_SIZE_DYNAMIC'] === 'true',
      },
      CODEXLENS_CHARS_PER_TOKEN: {
        key: 'CODEXLENS_CHARS_PER_TOKEN',
        labelKey: 'codexlens.envField.charsPerToken',
        type: 'number',
        placeholder: '4',
        default: '4',
        settingsPath: 'api.chars_per_token_estimate',
        min: 1,
        max: 10,
        showWhen: (env) => env['CODEXLENS_API_BATCH_SIZE_DYNAMIC'] === 'true',
      },
    },
  },
  cascade: {
    id: 'cascade',
    labelKey: 'codexlens.envGroup.cascade',
    icon: 'git-branch',
    vars: {
      CODEXLENS_CASCADE_STRATEGY: {
        key: 'CODEXLENS_CASCADE_STRATEGY',
        labelKey: 'codexlens.envField.searchStrategy',
        type: 'select',
        options: ['binary', 'hybrid', 'binary_rerank', 'dense_rerank', 'staged'],
        default: 'dense_rerank',
        settingsPath: 'cascade.strategy',
      },
      CODEXLENS_CASCADE_COARSE_K: {
        key: 'CODEXLENS_CASCADE_COARSE_K',
        labelKey: 'codexlens.envField.coarseK',
        type: 'number',
        placeholder: '100',
        default: '100',
        settingsPath: 'cascade.coarse_k',
        min: 10,
        max: 500,
      },
      CODEXLENS_CASCADE_FINE_K: {
        key: 'CODEXLENS_CASCADE_FINE_K',
        labelKey: 'codexlens.envField.fineK',
        type: 'number',
        placeholder: '10',
        default: '10',
        settingsPath: 'cascade.fine_k',
        min: 1,
        max: 100,
      },
      CODEXLENS_STAGED_STAGE2_MODE: {
        key: 'CODEXLENS_STAGED_STAGE2_MODE',
        labelKey: 'codexlens.envField.stagedStage2Mode',
        type: 'select',
        options: ['precomputed', 'realtime', 'static_global_graph'],
        default: 'precomputed',
        settingsPath: 'staged.stage2_mode',
        showWhen: (env) => env['CODEXLENS_CASCADE_STRATEGY'] === 'staged',
      },
      CODEXLENS_STAGED_CLUSTERING_STRATEGY: {
        key: 'CODEXLENS_STAGED_CLUSTERING_STRATEGY',
        labelKey: 'codexlens.envField.stagedClusteringStrategy',
        type: 'select',
        options: ['auto', 'hdbscan', 'dbscan', 'frequency', 'noop', 'score', 'dir_rr', 'path'],
        default: 'auto',
        settingsPath: 'staged.clustering_strategy',
        showWhen: (env) => env['CODEXLENS_CASCADE_STRATEGY'] === 'staged',
      },
      CODEXLENS_STAGED_CLUSTERING_MIN_SIZE: {
        key: 'CODEXLENS_STAGED_CLUSTERING_MIN_SIZE',
        labelKey: 'codexlens.envField.stagedClusteringMinSize',
        type: 'number',
        placeholder: '3',
        default: '3',
        settingsPath: 'staged.clustering_min_size',
        min: 1,
        max: 50,
        showWhen: (env) => env['CODEXLENS_CASCADE_STRATEGY'] === 'staged',
      },
      CODEXLENS_ENABLE_STAGED_RERANK: {
        key: 'CODEXLENS_ENABLE_STAGED_RERANK',
        labelKey: 'codexlens.envField.enableStagedRerank',
        type: 'checkbox',
        default: 'true',
        settingsPath: 'staged.enable_rerank',
        showWhen: (env) => env['CODEXLENS_CASCADE_STRATEGY'] === 'staged',
      },
    },
  },
  indexing: {
    id: 'indexing',
    labelKey: 'codexlens.envGroup.indexing',
    icon: 'git-branch',
    vars: {
      CODEXLENS_USE_ASTGREP: {
        key: 'CODEXLENS_USE_ASTGREP',
        labelKey: 'codexlens.envField.useAstGrep',
        type: 'checkbox',
        default: 'false',
        settingsPath: 'parsing.use_astgrep',
      },
      CODEXLENS_STATIC_GRAPH_ENABLED: {
        key: 'CODEXLENS_STATIC_GRAPH_ENABLED',
        labelKey: 'codexlens.envField.staticGraphEnabled',
        type: 'checkbox',
        default: 'false',
        settingsPath: 'indexing.static_graph_enabled',
      },
      CODEXLENS_STATIC_GRAPH_RELATIONSHIP_TYPES: {
        key: 'CODEXLENS_STATIC_GRAPH_RELATIONSHIP_TYPES',
        labelKey: 'codexlens.envField.staticGraphRelationshipTypes',
        type: 'text',
        placeholder: 'imports,inherits,calls',
        default: 'imports,inherits',
        settingsPath: 'indexing.static_graph_relationship_types',
        showWhen: (env) => env['CODEXLENS_STATIC_GRAPH_ENABLED'] === 'true',
      },
    },
  },
  chunking: {
    id: 'chunking',
    labelKey: 'codexlens.envGroup.chunking',
    icon: 'scissors',
    vars: {
      CHUNK_STRIP_COMMENTS: {
        key: 'CHUNK_STRIP_COMMENTS',
        labelKey: 'codexlens.envField.stripComments',
        type: 'select',
        options: ['true', 'false'],
        default: 'true',
        settingsPath: 'chunking.strip_comments',
      },
      CHUNK_STRIP_DOCSTRINGS: {
        key: 'CHUNK_STRIP_DOCSTRINGS',
        labelKey: 'codexlens.envField.stripDocstrings',
        type: 'select',
        options: ['true', 'false'],
        default: 'true',
        settingsPath: 'chunking.strip_docstrings',
      },
      RERANKER_TEST_FILE_PENALTY: {
        key: 'RERANKER_TEST_FILE_PENALTY',
        labelKey: 'codexlens.envField.testFilePenalty',
        type: 'number',
        placeholder: '0.0',
        default: '0.0',
        settingsPath: 'reranker.test_file_penalty',
        min: 0,
        max: 1,
        step: 0.1,
      },
      RERANKER_DOCSTRING_WEIGHT: {
        key: 'RERANKER_DOCSTRING_WEIGHT',
        labelKey: 'codexlens.envField.docstringWeight',
        type: 'number',
        placeholder: '1.0',
        default: '1.0',
        settingsPath: 'reranker.docstring_weight',
        min: 0,
        max: 1,
        step: 0.1,
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
