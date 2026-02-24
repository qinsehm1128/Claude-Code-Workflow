/**
 * LiteLLM API Routes Module
 * Handles LiteLLM provider management, endpoint configuration, and cache management
 */
import { z } from 'zod';
import { spawn } from 'child_process';
import { getSystemPython } from '../../utils/python-utils.js';
import {
  isUvAvailable,
  createCodexLensUvManager
} from '../../utils/uv-manager.js';
import { ensureLiteLLMEmbedderReady } from '../../tools/codex-lens.js';
import type { RouteContext } from './types.js';

// ========== Input Validation Schemas ==========

/**
 * Validation schema for ModelPoolConfig
 * Used to validate incoming API requests for model pool operations
 */
const ModelPoolConfigSchema = z.object({
  modelType: z.enum(['embedding', 'llm', 'reranker']),
  enabled: z.boolean(),
  targetModel: z.string().min(1, 'Target model is required'),
  strategy: z.enum(['round_robin', 'latency_aware', 'weighted_random']),
  autoDiscover: z.boolean(),
  excludedProviderIds: z.array(z.string()).optional().default([]),
  defaultCooldown: z.number().int().min(0).default(60),
  defaultMaxConcurrentPerKey: z.number().int().min(1).default(4),
  name: z.string().optional(),
  description: z.string().optional(),
});

/**
 * Partial schema for updating ModelPoolConfig
 * All fields are optional for PATCH-like updates
 */
const ModelPoolConfigUpdateSchema = ModelPoolConfigSchema.partial();


import {
  getAllProviders,
  getProvider,
  addProvider,
  updateProvider,
  deleteProvider,
  getAllEndpoints,
  getEndpoint,
  addEndpoint,
  updateEndpoint,
  deleteEndpoint,
  getDefaultEndpoint,
  setDefaultEndpoint,
  getGlobalCacheSettings,
  updateGlobalCacheSettings,
  loadLiteLLMApiConfig,
  saveLiteLLMYamlConfig,
  generateLiteLLMYamlConfig,
  getCodexLensEmbeddingRotation,
  updateCodexLensEmbeddingRotation,
  getEmbeddingProvidersForRotation,
  generateRotationEndpoints,
  syncCodexLensConfig,
  getEmbeddingPoolConfig,
  updateEmbeddingPoolConfig,
  discoverProvidersForModel,
  getModelPools,
  getModelPool,
  addModelPool,
  updateModelPool,
  deleteModelPool,
  getAvailableModelsForType,
  type ProviderCredential,
  type CustomEndpoint,
  type ProviderType,
  type CodexLensEmbeddingRotation,
  type EmbeddingPoolConfig,
} from '../../config/litellm-api-config-manager.js';
import { getContextCacheStore } from '../../tools/context-cache-store.js';
import { getLiteLLMClient } from '../../tools/litellm-client.js';
import { testApiKeyConnection, getDefaultApiBase } from '../services/api-key-tester.js';

// Cache for ccw-litellm status check
let ccwLitellmStatusCache: {
  data: { installed: boolean; version?: string; error?: string } | null;
  timestamp: number;
  ttl: number;
} = {
  data: null,
  timestamp: 0,
  ttl: 5 * 60 * 1000, // 5 minutes
};

// Clear cache (call after install)
export function clearCcwLitellmStatusCache() {
  ccwLitellmStatusCache.data = null;
  ccwLitellmStatusCache.timestamp = 0;
}

function sanitizeProviderForResponse(provider: any): any {
  if (!provider) return provider;
  return {
    ...provider,
    apiKey: '***',
    apiKeys: Array.isArray(provider.apiKeys)
      ? provider.apiKeys.map((entry: any) => ({ ...entry, key: '***' }))
      : provider.apiKeys,
  };
}

function sanitizeRotationEndpointForResponse(endpoint: any): any {
  if (!endpoint) return endpoint;
  return { ...endpoint, api_key: '***' };
}

// ===========================
// Model Information
// ===========================

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description?: string;
}

const PROVIDER_MODELS: Record<string, ModelInfo[]> = {
  openai: [
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', description: '128K context' },
    { id: 'gpt-4', name: 'GPT-4', provider: 'openai', description: '8K context' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', description: '16K context' },
  ],
  anthropic: [
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic', description: '200K context' },
    { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: 'anthropic', description: '200K context' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'anthropic', description: '200K context' },
  ],
  google: [
    { id: 'gemini-pro', name: 'Gemini Pro', provider: 'google', description: '32K context' },
    { id: 'gemini-pro-vision', name: 'Gemini Pro Vision', provider: 'google', description: '16K context' },
  ],
  ollama: [
    { id: 'llama2', name: 'Llama 2', provider: 'ollama', description: 'Local model' },
    { id: 'mistral', name: 'Mistral', provider: 'ollama', description: 'Local model' },
  ],
  azure: [],
  mistral: [
    { id: 'mistral-large-latest', name: 'Mistral Large', provider: 'mistral', description: '32K context' },
    { id: 'mistral-medium-latest', name: 'Mistral Medium', provider: 'mistral', description: '32K context' },
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek', description: '64K context' },
    { id: 'deepseek-coder', name: 'DeepSeek Coder', provider: 'deepseek', description: '64K context' },
  ],
  custom: [],
};

/**
 * Handle LiteLLM API routes
 * @returns true if route was handled, false otherwise
 */
export async function handleLiteLLMApiRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath, handlePostRequest, broadcastToClients } = ctx;

  // ===========================
  // Provider Management Routes
  // ===========================

  // GET /api/litellm-api/providers - List all providers
  if (pathname === '/api/litellm-api/providers' && req.method === 'GET') {
    try {
      const providers = getAllProviders(initialPath).map(sanitizeProviderForResponse);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ providers, count: providers.length }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // POST /api/litellm-api/providers - Create provider
  if (pathname === '/api/litellm-api/providers' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: unknown) => {
      const providerData = body as Omit<ProviderCredential, 'id' | 'createdAt' | 'updatedAt'>;

      if (!providerData.name || !providerData.type || !providerData.apiKey) {
        return { error: 'Provider name, type, and apiKey are required', status: 400 };
      }

      try {
        const provider = addProvider(initialPath, providerData);
        const sanitizedProvider = sanitizeProviderForResponse(provider);

        broadcastToClients({
          type: 'LITELLM_PROVIDER_CREATED',
          payload: { provider: sanitizedProvider, timestamp: new Date().toISOString() }
        });

        return { success: true, provider: sanitizedProvider };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // GET /api/litellm-api/providers/:id - Get provider by ID
  const providerGetMatch = pathname.match(/^\/api\/litellm-api\/providers\/([^/]+)$/);
  if (providerGetMatch && req.method === 'GET') {
    const providerId = providerGetMatch[1];

    try {
      const provider = getProvider(initialPath, providerId);
      if (!provider) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Provider not found' }));
        return true;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(sanitizeProviderForResponse(provider)));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // PUT /api/litellm-api/providers/:id - Update provider
  const providerUpdateMatch = pathname.match(/^\/api\/litellm-api\/providers\/([^/]+)$/);
  if (providerUpdateMatch && req.method === 'PUT') {
    const providerId = providerUpdateMatch[1];

    handlePostRequest(req, res, async (body: unknown) => {
      const updates = body as Partial<Omit<ProviderCredential, 'id' | 'createdAt' | 'updatedAt'>>;

      try {
        const provider = updateProvider(initialPath, providerId, updates);
        const sanitizedProvider = sanitizeProviderForResponse(provider);

        broadcastToClients({
          type: 'LITELLM_PROVIDER_UPDATED',
          payload: { provider: sanitizedProvider, timestamp: new Date().toISOString() }
        });

        return { success: true, provider: sanitizedProvider };
      } catch (err) {
        return { error: (err as Error).message, status: 404 };
      }
    });
    return true;
  }

  // DELETE /api/litellm-api/providers/:id - Delete provider
  const providerDeleteMatch = pathname.match(/^\/api\/litellm-api\/providers\/([^/]+)$/);
  if (providerDeleteMatch && req.method === 'DELETE') {
    const providerId = providerDeleteMatch[1];

    try {
      const success = deleteProvider(initialPath, providerId);

      if (!success) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Provider not found' }));
        return true;
      }

      // Clean up health check service state for deleted provider
      try {
        const { getHealthCheckService } = await import('../services/health-check-service.js');
        getHealthCheckService().cleanupProvider(providerId);
      } catch (cleanupErr) {
        console.warn('[Provider Delete] Failed to cleanup health check state:', cleanupErr);
      }

      broadcastToClients({
        type: 'LITELLM_PROVIDER_DELETED',
        payload: { providerId, timestamp: new Date().toISOString() }
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Provider deleted' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // POST /api/litellm-api/providers/:id/test - Test provider connection
  const providerTestMatch = pathname.match(/^\/api\/litellm-api\/providers\/([^/]+)\/test$/);
  if (providerTestMatch && req.method === 'POST') {
    const providerId = providerTestMatch[1];

    try {
      const provider = getProvider(initialPath, providerId);

      if (!provider) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Provider not found' }));
        return true;
      }

      if (!provider.enabled) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Provider is disabled' }));
        return true;
      }

      // Get the API key to test (prefer first key from apiKeys array, fall back to default apiKey)
      let apiKeyValue: string | null = null;
      if (provider.apiKeys && provider.apiKeys.length > 0) {
        apiKeyValue = provider.apiKeys[0].key;
      } else if (provider.apiKey) {
        apiKeyValue = provider.apiKey;
      }

      if (!apiKeyValue) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'No API key configured for this provider' }));
        return true;
      }

      // Resolve environment variables in the API key
      const { resolveEnvVar } = await import('../../config/litellm-api-config-manager.js');
      const resolvedKey = resolveEnvVar(apiKeyValue);

      if (!resolvedKey) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'API key is empty or environment variable not set' }));
        return true;
      }

      // Determine API base URL
      const apiBase = provider.apiBase || getDefaultApiBase(provider.type);

      // Test the API key connection
      const testResult = await testApiKeyConnection(provider.type, apiBase, resolvedKey);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: testResult.valid,
        provider: provider.type,
        latencyMs: testResult.latencyMs,
        error: testResult.error,
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (err as Error).message }));
    }
    return true;
  }

  // POST /api/litellm-api/providers/:id/test-key - Test specific API key
  const providerTestKeyMatch = pathname.match(/^\/api\/litellm-api\/providers\/([^/]+)\/test-key$/);
  if (providerTestKeyMatch && req.method === 'POST') {
    const providerId = providerTestKeyMatch[1];

    handlePostRequest(req, res, async (body: unknown) => {
      const { keyId } = body as { keyId?: string };

      if (!keyId) {
        return { valid: false, error: 'keyId is required', status: 400 };
      }

      try {
        const provider = getProvider(initialPath, providerId);

        if (!provider) {
          return { valid: false, error: 'Provider not found', status: 404 };
        }

        // Find the specific API key
        let apiKeyValue: string | null = null;
        let keyLabel = 'Default';

        if (keyId === 'default' && provider.apiKey) {
          // Use the single default apiKey
          apiKeyValue = provider.apiKey;
        } else if (provider.apiKeys && provider.apiKeys.length > 0) {
          const keyEntry = provider.apiKeys.find(k => k.id === keyId);
          if (keyEntry) {
            apiKeyValue = keyEntry.key;
            keyLabel = keyEntry.label || keyEntry.id;
          }
        }

        if (!apiKeyValue) {
          return { valid: false, error: 'API key not found' };
        }

        // Resolve environment variables
        const { resolveEnvVar } = await import('../../config/litellm-api-config-manager.js');
        const resolvedKey = resolveEnvVar(apiKeyValue);

        if (!resolvedKey) {
          return { valid: false, error: 'API key is empty or environment variable not set' };
        }

        // Determine API base URL
        const apiBase = provider.apiBase || getDefaultApiBase(provider.type);

        // Test the API key with appropriate endpoint based on provider type
        const startTime = Date.now();
        const testResult = await testApiKeyConnection(provider.type, apiBase, resolvedKey);
        const latencyMs = Date.now() - startTime;

        // Update key health status in provider config
        if (provider.apiKeys && provider.apiKeys.length > 0) {
          const keyEntry = provider.apiKeys.find(k => k.id === keyId);
          if (keyEntry) {
            keyEntry.healthStatus = testResult.valid ? 'healthy' : 'unhealthy';
            keyEntry.lastHealthCheck = new Date().toISOString();
            if (!testResult.valid) {
              keyEntry.lastError = testResult.error;
            } else {
              delete keyEntry.lastError;
            }

            // Save updated provider
            try {
              updateProvider(initialPath, providerId, { apiKeys: provider.apiKeys });
            } catch (updateErr) {
              console.warn('[test-key] Failed to update key health status:', updateErr);
            }
          }
        }

        return {
          valid: testResult.valid,
          error: testResult.error,
          latencyMs: testResult.valid ? latencyMs : undefined,
          keyLabel,
        };
      } catch (err) {
        return { valid: false, error: (err as Error).message };
      }
    });
    return true;
  }

  // GET /api/litellm-api/providers/:id/health-status - Get health status for all keys
  const providerHealthStatusMatch = pathname.match(/^\/api\/litellm-api\/providers\/([^/]+)\/health-status$/);
  if (providerHealthStatusMatch && req.method === 'GET') {
    const providerId = providerHealthStatusMatch[1];

    try {
      const provider = getProvider(initialPath, providerId);

      if (!provider) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Provider not found' }));
        return true;
      }

      // Import health check service to get runtime state
      const { getHealthCheckService } = await import('../services/health-check-service.js');
      const healthService = getHealthCheckService();
      const healthStatus = healthService.getProviderHealthStatus(providerId);

      // Merge persisted key data with runtime health status
      const keys = (provider.apiKeys || []).map(key => {
        const runtimeStatus = healthStatus.find(s => s.keyId === key.id);
        return {
          keyId: key.id,
          label: key.label || key.id,
          status: runtimeStatus?.status || key.healthStatus || 'unknown',
          lastCheck: runtimeStatus?.lastCheck || key.lastHealthCheck,
          lastLatencyMs: key.lastLatencyMs,
          consecutiveFailures: runtimeStatus?.consecutiveFailures || 0,
          inCooldown: runtimeStatus?.inCooldown || false,
          lastError: runtimeStatus?.lastError || key.lastError,
        };
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        providerId,
        providerName: provider.name,
        keys,
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // POST /api/litellm-api/providers/:id/health-check-now - Trigger immediate health check
  const providerHealthCheckNowMatch = pathname.match(/^\/api\/litellm-api\/providers\/([^/]+)\/health-check-now$/);
  if (providerHealthCheckNowMatch && req.method === 'POST') {
    const providerId = providerHealthCheckNowMatch[1];

    try {
      const provider = getProvider(initialPath, providerId);

      if (!provider) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Provider not found' }));
        return true;
      }

      // Import health check service and trigger check
      const { getHealthCheckService } = await import('../services/health-check-service.js');
      const healthService = getHealthCheckService();

      // Trigger immediate check (async, but we wait for completion)
      await healthService.checkProviderNow(providerId);

      // Get updated status
      const healthStatus = healthService.getProviderHealthStatus(providerId);

      // Reload provider to get updated persisted data
      const updatedProvider = getProvider(initialPath, providerId);
      const keys = (updatedProvider?.apiKeys || []).map(key => {
        const runtimeStatus = healthStatus.find(s => s.keyId === key.id);
        return {
          keyId: key.id,
          label: key.label || key.id,
          status: runtimeStatus?.status || key.healthStatus || 'unknown',
          lastCheck: runtimeStatus?.lastCheck || key.lastHealthCheck,
          lastLatencyMs: key.lastLatencyMs,
          consecutiveFailures: runtimeStatus?.consecutiveFailures || 0,
          inCooldown: runtimeStatus?.inCooldown || false,
          lastError: runtimeStatus?.lastError || key.lastError,
        };
      });

      broadcastToClients({
        type: 'PROVIDER_HEALTH_CHECKED',
        payload: { providerId, keys, timestamp: new Date().toISOString() }
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        providerId,
        providerName: updatedProvider?.name,
        keys,
        checkedAt: new Date().toISOString(),
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (err as Error).message }));
    }
    return true;
  }

  // ===========================
  // Endpoint Management Routes
  // ===========================

  // GET /api/litellm-api/endpoints - List all endpoints
  if (pathname === '/api/litellm-api/endpoints' && req.method === 'GET') {
    try {
      const endpoints = getAllEndpoints(initialPath);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ endpoints, count: endpoints.length }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // POST /api/litellm-api/endpoints - Create endpoint
  if (pathname === '/api/litellm-api/endpoints' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: unknown) => {
      const endpointData = body as Omit<CustomEndpoint, 'createdAt' | 'updatedAt'>;

      if (!endpointData.id || !endpointData.name || !endpointData.providerId || !endpointData.model) {
        return { error: 'Endpoint id, name, providerId, and model are required', status: 400 };
      }

      try {
        const endpoint = addEndpoint(initialPath, endpointData);

        broadcastToClients({
          type: 'LITELLM_ENDPOINT_CREATED',
          payload: { endpoint, timestamp: new Date().toISOString() }
        });

        return { success: true, endpoint };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // GET /api/litellm-api/endpoints/:id - Get endpoint by ID
  const endpointGetMatch = pathname.match(/^\/api\/litellm-api\/endpoints\/([^/]+)$/);
  if (endpointGetMatch && req.method === 'GET') {
    const endpointId = endpointGetMatch[1];

    try {
      const endpoint = getEndpoint(initialPath, endpointId);
      if (!endpoint) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
        return true;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(endpoint));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // PUT /api/litellm-api/endpoints/:id - Update endpoint
  const endpointUpdateMatch = pathname.match(/^\/api\/litellm-api\/endpoints\/([^/]+)$/);
  if (endpointUpdateMatch && req.method === 'PUT') {
    const endpointId = endpointUpdateMatch[1];

    handlePostRequest(req, res, async (body: unknown) => {
      const updates = body as Partial<Omit<CustomEndpoint, 'id' | 'createdAt' | 'updatedAt'>>;

      try {
        const endpoint = updateEndpoint(initialPath, endpointId, updates);

        broadcastToClients({
          type: 'LITELLM_ENDPOINT_UPDATED',
          payload: { endpoint, timestamp: new Date().toISOString() }
        });

        return { success: true, endpoint };
      } catch (err) {
        return { error: (err as Error).message, status: 404 };
      }
    });
    return true;
  }

  // DELETE /api/litellm-api/endpoints/:id - Delete endpoint
  const endpointDeleteMatch = pathname.match(/^\/api\/litellm-api\/endpoints\/([^/]+)$/);
  if (endpointDeleteMatch && req.method === 'DELETE') {
    const endpointId = endpointDeleteMatch[1];

    try {
      const success = deleteEndpoint(initialPath, endpointId);

      if (!success) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
        return true;
      }

      broadcastToClients({
        type: 'LITELLM_ENDPOINT_DELETED',
        payload: { endpointId, timestamp: new Date().toISOString() }
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Endpoint deleted' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // ===========================
  // Model Discovery Routes
  // ===========================

  // GET /api/litellm-api/models/:providerType - Get available models for provider type
  const modelsMatch = pathname.match(/^\/api\/litellm-api\/models\/([^/]+)$/);
  if (modelsMatch && req.method === 'GET') {
    const providerType = modelsMatch[1];

    try {
      const models = PROVIDER_MODELS[providerType];

      if (!models) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Provider type not found' }));
        return true;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ providerType, models, count: models.length }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // ===========================
  // Cache Management Routes
  // ===========================

  // GET /api/litellm-api/cache/stats - Get cache statistics
  if (pathname === '/api/litellm-api/cache/stats' && req.method === 'GET') {
    try {
      const cacheStore = getContextCacheStore();
      const stats = cacheStore.getStatus();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // POST /api/litellm-api/cache/clear - Clear cache
  if (pathname === '/api/litellm-api/cache/clear' && req.method === 'POST') {
    try {
      const cacheStore = getContextCacheStore();
      const result = cacheStore.clear();

      broadcastToClients({
        type: 'LITELLM_CACHE_CLEARED',
        payload: { removed: result.removed, timestamp: new Date().toISOString() }
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, removed: result.removed }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // ===========================
  // Config Management Routes
  // ===========================

  // GET /api/litellm-api/config - Get full config
  if (pathname === '/api/litellm-api/config' && req.method === 'GET') {
    try {
      const config = loadLiteLLMApiConfig(initialPath);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(config));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // PUT /api/litellm-api/config/cache - Update global cache settings
  if (pathname === '/api/litellm-api/config/cache' && req.method === 'PUT') {
    handlePostRequest(req, res, async (body: unknown) => {
      const settings = body as Partial<{ enabled: boolean; cacheDir: string; maxTotalSizeMB: number }>;

      try {
        updateGlobalCacheSettings(initialPath, settings);

        const updatedSettings = getGlobalCacheSettings(initialPath);

        broadcastToClients({
          type: 'LITELLM_CACHE_SETTINGS_UPDATED',
          payload: { settings: updatedSettings, timestamp: new Date().toISOString() }
        });

        return { success: true, settings: updatedSettings };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // PUT /api/litellm-api/config/default-endpoint - Set default endpoint
  if (pathname === '/api/litellm-api/config/default-endpoint' && req.method === 'PUT') {
    handlePostRequest(req, res, async (body: unknown) => {
      const { endpointId } = body as { endpointId?: string };

      try {
        setDefaultEndpoint(initialPath, endpointId);

        const defaultEndpoint = getDefaultEndpoint(initialPath);

        broadcastToClients({
          type: 'LITELLM_DEFAULT_ENDPOINT_UPDATED',
          payload: { endpointId, defaultEndpoint, timestamp: new Date().toISOString() }
        });

        return { success: true, defaultEndpoint };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // ===========================
  // Config Sync Routes
  // ===========================

  // POST /api/litellm-api/config/sync - Sync UI config to ccw_litellm YAML config
  if (pathname === '/api/litellm-api/config/sync' && req.method === 'POST') {
    try {
      const yamlPath = saveLiteLLMYamlConfig(initialPath);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Config synced to ccw_litellm',
        yamlPath,
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // GET /api/litellm-api/config/yaml-preview - Preview YAML config without saving
  if (pathname === '/api/litellm-api/config/yaml-preview' && req.method === 'GET') {
    try {
      const yamlConfig = generateLiteLLMYamlConfig(initialPath);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        config: yamlConfig,
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // ===========================
  // CCW-LiteLLM Package Management
  // ===========================

  // GET /api/litellm-api/ccw-litellm/status - Check ccw-litellm installation status
  // Supports ?refresh=true to bypass cache
  if (pathname === '/api/litellm-api/ccw-litellm/status' && req.method === 'GET') {
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    // Check cache first (unless force refresh)
    if (!forceRefresh && ccwLitellmStatusCache.data &&
        Date.now() - ccwLitellmStatusCache.timestamp < ccwLitellmStatusCache.ttl) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(ccwLitellmStatusCache.data));
      return true;
    }

    // Async check - use CodexLens venv Python for reliable detection
    try {
      let result: { installed: boolean; version?: string; error?: string } = { installed: false };

      // Check ONLY in CodexLens venv (where UV installs packages)
      // Do NOT fallback to system pip - we want isolated venv dependencies
      const uv = createCodexLensUvManager();
      const venvPython = uv.getVenvPython();
      const statusTimeout = process.platform === 'win32' ? 15000 : 10000;

      if (uv.isVenvValid()) {
        try {
          result = await new Promise<{ installed: boolean; version?: string }>((resolve) => {
            const child = spawn(venvPython, ['-c', 'import ccw_litellm; print(ccw_litellm.__version__)'], {
              stdio: ['ignore', 'pipe', 'pipe'],
              timeout: statusTimeout,
              windowsHide: true,
            });
            let stdout = '';
            child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
            child.on('close', (code: number | null) => {
              if (code === 0) {
                const version = stdout.trim();
                if (version) {
                  console.log(`[ccw-litellm status] Found in CodexLens venv: ${version}`);
                  resolve({ installed: true, version });
                  return;
                }
              }
              console.log('[ccw-litellm status] Not found in CodexLens venv');
              resolve({ installed: false });
            });
            child.on('error', () => {
              console.log('[ccw-litellm status] Spawn error checking venv');
              resolve({ installed: false });
            });
          });
        } catch (venvErr) {
          console.log('[ccw-litellm status] Not found in CodexLens venv');
          result = { installed: false };
        }
      } else {
        console.log('[ccw-litellm status] CodexLens venv not valid');
        result = { installed: false };
      }

      // Update cache
      ccwLitellmStatusCache = {
        data: result,
        timestamp: Date.now(),
        ttl: 5 * 60 * 1000,
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      const errorResult = { installed: false, error: (err as Error).message };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(errorResult));
    }
    return true;
  }

  // ===========================
  // CodexLens Embedding Rotation Routes
  // ===========================

  // GET /api/litellm-api/codexlens/rotation - Get rotation config
  if (pathname === '/api/litellm-api/codexlens/rotation' && req.method === 'GET') {
    try {
      const rotationConfig = getCodexLensEmbeddingRotation(initialPath);
      const availableProviders = getEmbeddingProvidersForRotation(initialPath);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        rotationConfig: rotationConfig || null,
        availableProviders,
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // PUT /api/litellm-api/codexlens/rotation - Update rotation config
  if (pathname === '/api/litellm-api/codexlens/rotation' && req.method === 'PUT') {
    handlePostRequest(req, res, async (body: unknown) => {
      const rotationConfig = body as CodexLensEmbeddingRotation | null;

      try {
        const { syncResult } = updateCodexLensEmbeddingRotation(initialPath, rotationConfig || undefined);

        broadcastToClients({
          type: 'CODEXLENS_ROTATION_UPDATED',
          payload: { rotationConfig, syncResult, timestamp: new Date().toISOString() }
        });

        return { success: true, rotationConfig, syncResult };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // GET /api/litellm-api/codexlens/rotation/endpoints - Get generated rotation endpoints
  if (pathname === '/api/litellm-api/codexlens/rotation/endpoints' && req.method === 'GET') {
    try {
      const endpoints = generateRotationEndpoints(initialPath);
      const sanitizedEndpoints = endpoints.map(sanitizeRotationEndpointForResponse);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        endpoints: sanitizedEndpoints,
        count: sanitizedEndpoints.length,
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // POST /api/litellm-api/codexlens/rotation/sync - Manually sync rotation config to CodexLens
  if (pathname === '/api/litellm-api/codexlens/rotation/sync' && req.method === 'POST') {
    try {
      const syncResult = syncCodexLensConfig(initialPath);

      if (syncResult.success) {
        broadcastToClients({
          type: 'CODEXLENS_CONFIG_SYNCED',
          payload: { ...syncResult, timestamp: new Date().toISOString() }
        });
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(syncResult));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: (err as Error).message }));
    }
    return true;
  }

  // ===========================
  // Embedding Pool Routes (New Generic API)
  // ===========================

  // GET /api/litellm-api/embedding-pool - Get pool config and available models
  if (pathname === '/api/litellm-api/embedding-pool' && req.method === 'GET') {
    try {
      const poolConfig = getEmbeddingPoolConfig(initialPath);

      // Get list of all available embedding models from all providers
      const config = loadLiteLLMApiConfig(initialPath);
      const availableModels: Array<{ modelId: string; modelName: string; providers: string[] }> = [];
      const modelMap = new Map<string, { modelId: string; modelName: string; providers: string[] }>();

      for (const provider of config.providers) {
        if (!provider.enabled || !provider.embeddingModels) continue;

        for (const model of provider.embeddingModels) {
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

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        poolConfig: poolConfig || null,
        availableModels,
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // PUT /api/litellm-api/embedding-pool - Update pool config
  if (pathname === '/api/litellm-api/embedding-pool' && req.method === 'PUT') {
    handlePostRequest(req, res, async (body: unknown) => {
      const poolConfig = body as EmbeddingPoolConfig | null;

      try {
        const { syncResult } = updateEmbeddingPoolConfig(initialPath, poolConfig || undefined);

        broadcastToClients({
          type: 'EMBEDDING_POOL_UPDATED',
          payload: { poolConfig, syncResult, timestamp: new Date().toISOString() }
        });

        return { success: true, poolConfig, syncResult };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // GET /api/litellm-api/reranker-pool - Get available reranker models from all providers
  if (pathname === '/api/litellm-api/reranker-pool' && req.method === 'GET') {
    try {
      // Get list of all available reranker models from all providers
      const config = loadLiteLLMApiConfig(initialPath);
      const availableModels: Array<{ modelId: string; modelName: string; providers: string[] }> = [];
      const modelMap = new Map<string, { modelId: string; modelName: string; providers: string[] }>();

      for (const provider of config.providers) {
        if (!provider.enabled || !provider.rerankerModels) continue;

        for (const model of provider.rerankerModels) {
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

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        availableModels,
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // GET /api/litellm-api/embedding-pool/discover/:model - Preview auto-discovery results
  const discoverMatch = pathname.match(/^\/api\/litellm-api\/embedding-pool\/discover\/([^/]+)$/);
  if (discoverMatch && req.method === 'GET') {
    const targetModel = decodeURIComponent(discoverMatch[1]);

    try {
      const discovered = discoverProvidersForModel(initialPath, targetModel);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        targetModel,
        discovered,
        count: discovered.length,
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // ========== Multi-Model Pool Management ==========

  // GET /api/litellm-api/model-pools - Get all model pool configurations
  if (pathname === '/api/litellm-api/model-pools' && req.method === 'GET') {
    try {
      const pools = getModelPools(initialPath);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ pools }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // GET /api/litellm-api/model-pools/:id - Get specific pool configuration
  const poolGetMatch = pathname.match(/^\/api\/litellm-api\/model-pools\/([^/]+)$/);
  if (poolGetMatch && req.method === 'GET') {
    const poolId = decodeURIComponent(poolGetMatch[1]);

    try {
      const pool = getModelPool(initialPath, poolId);
      
      if (!pool) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Pool not found' }));
        return true;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ pool }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // POST /api/litellm-api/model-pools - Create new model pool
  if (pathname === '/api/litellm-api/model-pools' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: unknown) => {
      // Validate input using zod schema
      const validationResult = ModelPoolConfigSchema.safeParse(body);
      if (!validationResult.success) {
        return {
          error: 'Invalid request body',
          details: validationResult.error.issues.map(e => ({
            field: String(e.path.join('.')),
            message: e.message
          })),
          status: 400
        };
      }

      try {
        const poolConfig = validationResult.data;
        const result = addModelPool(initialPath, poolConfig);

        broadcastToClients({
          type: 'MODEL_POOL_CREATED',
          payload: { poolId: result.poolId, timestamp: new Date().toISOString() }
        });

        return { success: true, ...result };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // PUT /api/litellm-api/model-pools/:id - Update model pool
  const poolPutMatch = pathname.match(/^\/api\/litellm-api\/model-pools\/([^/]+)$/);
  if (poolPutMatch && req.method === 'PUT') {
    const poolId = decodeURIComponent(poolPutMatch[1]);

    handlePostRequest(req, res, async (body: unknown) => {
      // Validate input using partial schema (all fields optional for updates)
      const validationResult = ModelPoolConfigUpdateSchema.safeParse(body);
      if (!validationResult.success) {
        return {
          error: 'Invalid request body',
          details: validationResult.error.issues.map(e => ({
            field: String(e.path.join('.')),
            message: e.message
          })),
          status: 400
        };
      }

      try {
        const updates = validationResult.data;
        const result = updateModelPool(initialPath, poolId, updates);

        if (!result.success) {
          return { error: 'Pool not found', status: 404 };
        }

        broadcastToClients({
          type: 'MODEL_POOL_UPDATED',
          payload: { poolId, syncResult: result.syncResult, timestamp: new Date().toISOString() }
        });

        return result;
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // DELETE /api/litellm-api/model-pools/:id - Delete model pool
  const poolDeleteMatch = pathname.match(/^\/api\/litellm-api\/model-pools\/([^/]+)$/);
  if (poolDeleteMatch && req.method === 'DELETE') {
    const poolId = decodeURIComponent(poolDeleteMatch[1]);

    try {
      const result = deleteModelPool(initialPath, poolId);

      if (!result.success) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Pool not found' }));
        return true;
      }

      broadcastToClients({
        type: 'MODEL_POOL_DELETED',
        payload: { poolId, syncResult: result.syncResult, timestamp: new Date().toISOString() }
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // GET /api/litellm-api/model-pools/available-models/:modelType - Get available models for type
  const availableModelsMatch = pathname.match(/^\/api\/litellm-api\/model-pools\/available-models\/([^/]+)$/);
  if (availableModelsMatch && req.method === 'GET') {
    const modelType = decodeURIComponent(availableModelsMatch[1]) as import('../../types/litellm-api-config.js').ModelPoolType;

    try {
      const availableModels = getAvailableModelsForType(initialPath, modelType);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ availableModels, modelType }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // GET /api/litellm-api/model-pools/discover/:modelType/:model - Discover providers for model
  const discoverPoolMatch = pathname.match(/^\/api\/litellm-api\/model-pools\/discover\/([^/]+)\/([^/]+)$/);
  if (discoverPoolMatch && req.method === 'GET') {
    const modelType = decodeURIComponent(discoverPoolMatch[1]);
    const targetModel = decodeURIComponent(discoverPoolMatch[2]);

    try {
      const discovered = discoverProvidersForModel(initialPath, targetModel);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        modelType,
        targetModel,
        discovered,
        count: discovered.length,
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // POST /api/litellm-api/ccw-litellm/install - Install ccw-litellm package
  if (pathname === '/api/litellm-api/ccw-litellm/install' && req.method === 'POST') {
    handlePostRequest(req, res, async () => {
      try {
        // Delegate entirely to ensureLiteLLMEmbedderReady for consistent installation
        // This uses unified package discovery and handles UV → pip fallback
        const result = await ensureLiteLLMEmbedderReady();

        if (result.success) {
          clearCcwLitellmStatusCache();
          broadcastToClients({
            type: 'CCW_LITELLM_INSTALLED',
            payload: { timestamp: new Date().toISOString(), method: 'unified' }
          });
        }

        return result;
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    });
    return true;
  }

  // POST /api/litellm-api/ccw-litellm/uninstall - Uninstall ccw-litellm package
  if (pathname === '/api/litellm-api/ccw-litellm/uninstall' && req.method === 'POST') {
    handlePostRequest(req, res, async () => {
      try {
        // Priority 1: Use UV to uninstall from CodexLens venv
        if (await isUvAvailable()) {
          const uv = createCodexLensUvManager();
          if (uv.isVenvValid()) {
            console.log('[ccw-litellm uninstall] Using UV to uninstall from CodexLens venv...');
            const uvResult = await uv.uninstall(['ccw-litellm']);
            clearCcwLitellmStatusCache();

            if (uvResult.success) {
              broadcastToClients({
                type: 'CCW_LITELLM_UNINSTALLED',
                payload: { timestamp: new Date().toISOString() }
              });
              return { success: true, message: 'ccw-litellm uninstalled successfully via UV' };
            }
            console.log('[ccw-litellm uninstall] UV uninstall failed, falling back to pip:', uvResult.error);
          }
        }

        // Priority 2: Fallback to system pip uninstall
        console.log('[ccw-litellm uninstall] Using pip fallback...');
        const pythonCmd = getSystemPython();

        return new Promise((resolve) => {
          const proc = spawn(pythonCmd, ['-m', 'pip', 'uninstall', '-y', 'ccw-litellm'], { shell: true, timeout: 120000 });
          let output = '';
          let error = '';
          proc.stdout?.on('data', (data) => { output += data.toString(); });
          proc.stderr?.on('data', (data) => { error += data.toString(); });
          proc.on('close', (code) => {
            // Clear status cache after uninstallation attempt
            clearCcwLitellmStatusCache();

            if (code === 0) {
              broadcastToClients({
                type: 'CCW_LITELLM_UNINSTALLED',
                payload: { timestamp: new Date().toISOString() }
              });
              resolve({ success: true, message: 'ccw-litellm uninstalled successfully' });
            } else {
              // Check if package was not installed
              if (error.includes('not installed') || output.includes('not installed')) {
                resolve({ success: true, message: 'ccw-litellm was not installed' });
              } else {
                resolve({ success: false, error: error || output || 'Uninstallation failed' });
              }
            }
          });
          proc.on('error', (err) => resolve({ success: false, error: err.message }));
        });
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    });
    return true;
  }

  return false;
}
