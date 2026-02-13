/**
 * CodexLens semantic search + reranker + SPLADE handlers.
 */

import {
  checkSemanticStatus,
  checkVenvStatus,
  executeCodexLens,
  installSemantic,
} from '../../../tools/codex-lens.js';
import { getCodexLensPython } from '../../../utils/codexlens-path.js';
import { spawn } from 'child_process';
import type { GpuMode } from '../../../tools/codex-lens.js';
import { loadLiteLLMApiConfig, getAvailableModelsForType, getProvider, getAllProviders } from '../../../config/litellm-api-config-manager.js';
import {
  isUvAvailable,
  createCodexLensUvManager,
} from '../../../utils/uv-manager.js';
import type { RouteContext } from '../types.js';
import { extractJSON } from './utils.js';
import { getDefaultTool } from '../../../tools/claude-cli-tools.js';
import { getCodexLensDataDir } from '../../../utils/codexlens-path.js';

/**
 * Execute CodexLens Python API call directly (bypasses CLI for richer API access).
 */
async function executeCodexLensPythonAPI(
  apiFunction: string,
  args: Record<string, unknown>,
  timeout: number = 60000
): Promise<{ success: boolean; results?: unknown; error?: string }> {
  return new Promise((resolve) => {
    const pythonScript = `
import json
import sys
from dataclasses import is_dataclass, asdict
from codexlens.api import ${apiFunction}

def to_serializable(obj):
    if obj is None:
        return None
    if is_dataclass(obj) and not isinstance(obj, type):
        return asdict(obj)
    if isinstance(obj, list):
        return [to_serializable(item) for item in obj]
    if isinstance(obj, dict):
        return {key: to_serializable(value) for key, value in obj.items()}
    if isinstance(obj, tuple):
        return tuple(to_serializable(item) for item in obj)
    return obj

try:
    args = ${JSON.stringify(args)}
    result = ${apiFunction}(**args)
    output = to_serializable(result)
    print(json.dumps({"success": True, "result": output}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
    sys.exit(1)
`;

    const pythonPath = getCodexLensPython();
    const child = spawn(pythonPath, ['-c', pythonScript], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        try {
          const errorData = JSON.parse(stderr || stdout);
          resolve({ success: false, error: errorData.error || 'Unknown error' });
        } catch {
          resolve({ success: false, error: stderr || stdout || `Process exited with code ${code}` });
        }
        return;
      }

      try {
        const data = JSON.parse(stdout);
        resolve({ success: data.success, results: data.result, error: data.error });
      } catch (err) {
        resolve({ success: false, error: `Failed to parse output: ${(err as Error).message}` });
      }
    });

    child.on('error', (err) => {
      resolve({ success: false, error: `Failed to execute: ${err.message}` });
    });
  });
}

export async function handleCodexLensSemanticRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath, handlePostRequest } = ctx;

  // API: CodexLens Semantic Search Status
  if (pathname === '/api/codexlens/semantic/status') {
    const status = await checkSemanticStatus();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
    return true;
  }

  // API: CodexLens Semantic Metadata List
  if (pathname === '/api/codexlens/semantic/metadata') {
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const tool = url.searchParams.get('tool') || '';
    const projectPath = url.searchParams.get('path') || initialPath;

    try {
      const args = [
        'semantic-list',
        '--path', projectPath,
        '--offset', offset.toString(),
        '--limit', limit.toString(),
        '--json'
      ];
      if (tool) {
        args.push('--tool', tool);
      }

      const result = await executeCodexLens(args, { cwd: projectPath });

      if (result.success) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(result.output ?? '');
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: result.error }));
      }
    } catch (err: unknown) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }));
    }
    return true;
  }

  // API: CodexLens LLM Enhancement (run enhance command)
  if (pathname === '/api/codexlens/enhance' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { path: projectPath, tool, batchSize = 5, timeoutMs = 300000 } = body as {
        path?: unknown;
        tool?: unknown;
        batchSize?: unknown;
        timeoutMs?: unknown;
      };
      const targetPath = typeof projectPath === 'string' && projectPath.trim().length > 0 ? projectPath : initialPath;
      const resolvedTool = typeof tool === 'string' && tool.trim().length > 0 ? tool : getDefaultTool(targetPath);
      const resolvedBatchSize = typeof batchSize === 'number' ? batchSize : Number(batchSize);
      const resolvedTimeoutMs = typeof timeoutMs === 'number' ? timeoutMs : Number(timeoutMs);

      try {
        const args = ['enhance', targetPath, '--tool', resolvedTool, '--batch-size', String(resolvedBatchSize)];
        const timeout = !Number.isNaN(resolvedTimeoutMs) ? resolvedTimeoutMs + 30000 : 330000;
        const result = await executeCodexLens(args, { cwd: targetPath, timeout });
        if (result.success) {
          try {
            const parsed = extractJSON(result.output ?? '');
            return { success: true, result: parsed };
          } catch {
            return { success: true, output: result.output ?? '' };
          }
        } else {
          return { success: false, error: result.error, status: 500 };
        }
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : String(err), status: 500 };
      }
    });
    return true;
  }

  // API: CodexLens Search (FTS5 text search with mode support)
  if (pathname === '/api/codexlens/search') {
    const query = url.searchParams.get('query') || '';
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const mode = url.searchParams.get('mode') || 'exact';  // exact, fuzzy, hybrid, vector
    const maxContentLength = parseInt(url.searchParams.get('max_content_length') || '200', 10);
    const extraFilesCount = parseInt(url.searchParams.get('extra_files_count') || '10', 10);
    const projectPath = url.searchParams.get('path') || initialPath;

    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Query parameter is required' }));
      return true;
    }

    try {
      // Request more results to support split (full content + extra files)
      const totalToFetch = limit + extraFilesCount;
      // Use --method instead of deprecated --mode
      const args = ['search', query, '--path', projectPath, '--limit', totalToFetch.toString(), '--method', mode, '--json'];

      const result = await executeCodexLens(args, { cwd: projectPath });

      if (result.success) {
        try {
          const parsed = extractJSON(result.output ?? '');
          const allResults = parsed.result?.results || [];

          // Truncate content and split results
          const truncateContent = (content: string | null | undefined): string => {
            if (!content) return '';
            if (content.length <= maxContentLength) return content;
            return content.slice(0, maxContentLength) + '...';
          };

          // Split results: first N with full content, rest as file paths only
          const resultsWithContent = allResults.slice(0, limit).map((r: any) => ({
            ...r,
            content: truncateContent(r.content || r.excerpt),
            excerpt: truncateContent(r.excerpt || r.content),
          }));

          const extraResults = allResults.slice(limit, limit + extraFilesCount);
          const extraFiles = [...new Set(extraResults.map((r: any) => r.path || r.file))];

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            results: resultsWithContent,
            extra_files: extraFiles.length > 0 ? extraFiles : undefined,
            metadata: {
              total: allResults.length,
              limit,
              max_content_length: maxContentLength,
              extra_files_count: extraFilesCount,
            },
          }));
        } catch {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, results: [], output: result.output }));
        }
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: result.error }));
      }
    } catch (err: unknown) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }));
    }
    return true;
  }

  // API: CodexLens Search Files Only (return file paths only, with mode support)
  if (pathname === '/api/codexlens/search_files') {
    const query = url.searchParams.get('query') || '';
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const mode = url.searchParams.get('mode') || 'exact';  // exact, fuzzy, hybrid, vector
    const projectPath = url.searchParams.get('path') || initialPath;

    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Query parameter is required' }));
      return true;
    }

    try {
      // Use --method instead of deprecated --mode
      const args = ['search', query, '--path', projectPath, '--limit', limit.toString(), '--method', mode, '--files-only', '--json'];

      const result = await executeCodexLens(args, { cwd: projectPath });

      if (result.success) {
        try {
          const parsed = extractJSON(result.output ?? '');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, ...parsed.result }));
        } catch {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, files: [], output: result.output }));
        }
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: result.error }));
      }
    } catch (err: unknown) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }));
    }
    return true;
  }

  // API: CodexLens Symbol Search (search for symbols by name)
  if (pathname === '/api/codexlens/symbol') {
    const query = url.searchParams.get('query') || '';
    const file = url.searchParams.get('file');
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const projectPath = url.searchParams.get('path') || initialPath;

    if (!query && !file) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Either query or file parameter is required' }));
      return true;
    }

    try {
      let args;
      if (file) {
        // Get symbols from a specific file
        args = ['symbol', '--file', file, '--json'];
      } else {
        // Search for symbols by name
        args = ['symbol', query, '--path', projectPath, '--limit', limit.toString(), '--json'];
      }

      const result = await executeCodexLens(args, { cwd: projectPath });

      if (result.success) {
        try {
          const parsed = extractJSON(result.output ?? '');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, ...parsed.result }));
        } catch {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, symbols: [], output: result.output }));
        }
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: result.error }));
      }
    } catch (err: unknown) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }));
    }
    return true;
  }

  // API: CodexLens Semantic Search Install (with GPU mode support)
  if (pathname === '/api/codexlens/semantic/install' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      try {
        // Get GPU mode from request body, default to 'cpu'
        const { gpuMode } = body as { gpuMode?: unknown };
        const resolvedGpuModeCandidate = typeof gpuMode === 'string' && gpuMode.trim().length > 0 ? gpuMode : 'cpu';
        const validModes: GpuMode[] = ['cpu', 'cuda', 'directml'];

        if (!validModes.includes(resolvedGpuModeCandidate as GpuMode)) {
          return {
            success: false,
            error: `Invalid GPU mode: ${resolvedGpuModeCandidate}. Valid modes: ${validModes.join(', ')}`,
            status: 400
          };
        }

        const resolvedGpuMode = resolvedGpuModeCandidate as GpuMode;
        const result = await installSemantic(resolvedGpuMode);
        if (result.success) {
          const status = await checkSemanticStatus();
          const modeDescriptions = {
            cpu: 'CPU (ONNX Runtime)',
            cuda: 'NVIDIA CUDA GPU',
            directml: 'Windows DirectML GPU'
          };
          return {
            success: true,
            message: `Semantic search installed successfully with ${modeDescriptions[resolvedGpuMode]}`,
            gpuMode: resolvedGpuMode,
            ...status
          };
        } else {
          return { success: false, error: result.error, status: 500 };
        }
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : String(err), status: 500 };
      }
    });
    return true;
  }

  // ============================================================
  // RERANKER CONFIGURATION ENDPOINTS
  // ============================================================

  // API: Get Reranker Configuration
  if (pathname === '/api/codexlens/reranker/config' && req.method === 'GET') {
    try {
      const venvStatus = await checkVenvStatus();

      // Default reranker config (matches fastembed default)
      const rerankerConfig = {
        backend: 'fastembed',
        model_name: 'Xenova/ms-marco-MiniLM-L-6-v2',
        api_provider: 'siliconflow',
        api_key_set: false,
        available_backends: ['onnx', 'api', 'litellm', 'legacy'],
        api_providers: ['siliconflow', 'cohere', 'jina'],
        litellm_endpoints: [] as string[],
        config_source: 'default'
      };

      // Load LiteLLM reranker models for dropdown (from litellm-api-config providers)
      try {
        const availableRerankerModels = getAvailableModelsForType(initialPath, 'reranker');
        if (availableRerankerModels && Array.isArray(availableRerankerModels)) {
          // Return full model info for frontend to use
          (rerankerConfig as any).litellm_models = availableRerankerModels.map((m: any) => ({
            modelId: m.modelId,
            modelName: m.modelName,
            providers: m.providers
          }));
          // Keep litellm_endpoints for backward compatibility (just model IDs)
          rerankerConfig.litellm_endpoints = availableRerankerModels.map((m: any) => m.modelId);
        }
      } catch {
        // LiteLLM config not available, continue with empty models
      }

      // If CodexLens is installed, try to get actual config
      if (venvStatus.ready) {
        try {
          const result = await executeCodexLens(['config', '--json']);
          if (result.success) {
            const config = extractJSON(result.output ?? '');
            if (config.success && config.result) {
              // Map config values
              if (config.result.reranker_backend) {
                rerankerConfig.backend = config.result.reranker_backend;
                rerankerConfig.config_source = 'codexlens';
              }
              if (config.result.reranker_model) {
                rerankerConfig.model_name = config.result.reranker_model;
              }
              if (config.result.reranker_api_provider) {
                rerankerConfig.api_provider = config.result.reranker_api_provider;
              }
              // Check if API key is set (from env)
              if (process.env.RERANKER_API_KEY) {
                rerankerConfig.api_key_set = true;
              }
            }
          }
        } catch (e) {
          console.error('[CodexLens] Failed to get reranker config:', e);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...rerankerConfig }));
    } catch (err: unknown) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }));
    }
    return true;
  }

  // API: Set Reranker Configuration
  if (pathname === '/api/codexlens/reranker/config' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { backend, model_name, api_provider, api_key, litellm_endpoint } = body as {
        backend?: unknown;
        model_name?: unknown;
        api_provider?: unknown;
        api_key?: unknown;
        litellm_endpoint?: unknown;
      };
      const resolvedBackend = typeof backend === 'string' && backend.trim().length > 0 ? backend : undefined;
      const resolvedModelName = typeof model_name === 'string' && model_name.trim().length > 0 ? model_name : undefined;
      const resolvedApiProvider = typeof api_provider === 'string' && api_provider.trim().length > 0 ? api_provider : undefined;
      const resolvedApiKey = typeof api_key === 'string' && api_key.trim().length > 0 ? api_key : undefined;
      const resolvedLiteLLMEndpoint =
        typeof litellm_endpoint === 'string' && litellm_endpoint.trim().length > 0 ? litellm_endpoint : undefined;

      // Validate backend
      const validBackends = ['onnx', 'api', 'litellm', 'legacy', 'fastembed'];
      if (resolvedBackend && !validBackends.includes(resolvedBackend)) {
        return {
          success: false,
          error: `Invalid backend: ${resolvedBackend}. Valid options: ${validBackends.join(', ')}`,
          status: 400
        };
      }

      // Validate api_provider
      const validProviders = ['siliconflow', 'cohere', 'jina'];
      if (resolvedApiProvider && !validProviders.includes(resolvedApiProvider)) {
        return {
          success: false,
          error: `Invalid api_provider: ${resolvedApiProvider}. Valid options: ${validProviders.join(', ')}`,
          status: 400
        };
      }

      try {
        const updates: string[] = [];

        // Special handling for litellm backend - auto-configure from litellm-api-config
        if (resolvedBackend === 'litellm' && (resolvedModelName || resolvedLiteLLMEndpoint)) {
          const selectedModel = (resolvedModelName || resolvedLiteLLMEndpoint) as string;

          // Find the provider that has this model
          const providers = getAllProviders(initialPath);
          let providerWithModel: any = null;
          let foundModel: any = null;

          for (const provider of providers) {
            if (!provider.enabled || !provider.rerankerModels) continue;
            const model = provider.rerankerModels.find((m: any) => m.id === selectedModel && m.enabled);
            if (model) {
              providerWithModel = provider;
              foundModel = model;
              break;
            }
          }

          if (providerWithModel) {
            // Set backend to litellm
            const backendResult = await executeCodexLens(['config', 'set', 'reranker_backend', 'litellm', '--json']);
            if (backendResult.success) updates.push('backend');

            // Set model
            const modelResult = await executeCodexLens(['config', 'set', 'reranker_model', selectedModel, '--json']);
            if (modelResult.success) updates.push('model_name');

            // Auto-configure API credentials from provider
            // Write to CodexLens .env file for persistence
            const { writeFileSync, existsSync, readFileSync } = await import('fs');
            const { join } = await import('path');

            const codexlensDir = getCodexLensDataDir();
            const envFile = join(codexlensDir, '.env');

            // Read existing .env content
            let envContent = '';
            if (existsSync(envFile)) {
              envContent = readFileSync(envFile, 'utf-8');
            }

            // Update or add RERANKER_API_KEY and RERANKER_API_BASE
            const apiKey = providerWithModel.apiKey;
            const apiBase = providerWithModel.apiBase;

            // Helper to update env var in content
            const updateEnvVar = (content: string, key: string, value: string): string => {
              const regex = new RegExp(`^${key}=.*$`, 'm');
              const newLine = `${key}="${value}"`;
              if (regex.test(content)) {
                return content.replace(regex, newLine);
              } else {
                return content.trim() + '\n' + newLine;
              }
            };

            if (apiKey) {
              envContent = updateEnvVar(envContent, 'RERANKER_API_KEY', apiKey);
              envContent = updateEnvVar(envContent, 'CODEXLENS_RERANKER_API_KEY', apiKey);
              process.env.RERANKER_API_KEY = apiKey;
              updates.push('api_key (auto-configured)');
            }
            if (apiBase) {
              envContent = updateEnvVar(envContent, 'RERANKER_API_BASE', apiBase);
              envContent = updateEnvVar(envContent, 'CODEXLENS_RERANKER_API_BASE', apiBase);
              process.env.RERANKER_API_BASE = apiBase;
              updates.push('api_base (auto-configured)');
            }

            // Write updated .env
            writeFileSync(envFile, envContent.trim() + '\n', 'utf-8');

            return {
              success: true,
              message: `LiteLLM backend configured with model: ${selectedModel}`,
              updated_fields: updates,
              provider: providerWithModel.name,
              auto_configured: true
            };
          } else {
            return {
              success: false,
              error: `Model "${selectedModel}" not found in any enabled LiteLLM provider. Please configure it in API Settings first.`,
              status: 400
            };
          }
        }

        // Standard handling for non-litellm backends
        // Set backend
        if (resolvedBackend) {
          const result = await executeCodexLens(['config', 'set', 'reranker_backend', resolvedBackend, '--json']);
          if (result.success) updates.push('backend');
        }

        // Set model
        if (resolvedModelName) {
          const result = await executeCodexLens(['config', 'set', 'reranker_model', resolvedModelName, '--json']);
          if (result.success) updates.push('model_name');
        }

        // Set API provider
        if (resolvedApiProvider) {
          const result = await executeCodexLens(['config', 'set', 'reranker_api_provider', resolvedApiProvider, '--json']);
          if (result.success) updates.push('api_provider');
        }

        // Set LiteLLM endpoint (for backward compatibility)
        if (resolvedLiteLLMEndpoint && resolvedBackend !== 'litellm') {
          const result = await executeCodexLens([
            'config',
            'set',
            'reranker_litellm_endpoint',
            resolvedLiteLLMEndpoint,
            '--json'
          ]);
          if (result.success) updates.push('litellm_endpoint');
        }

        // Handle API key - write to .env file or environment
        if (resolvedApiKey) {
          // For security, we store in process.env for the current session
          // In production, this should be written to a secure .env file
          process.env.RERANKER_API_KEY = resolvedApiKey;
          updates.push('api_key');
        }

        return {
          success: true,
          message: `Updated: ${updates.join(', ')}`,
          updated_fields: updates
        };
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : String(err), status: 500 };
      }
    });
    return true;
  }

  // ============================================================
  // RERANKER MODEL MANAGEMENT ENDPOINTS
  // ============================================================

  // API: List Reranker Models (list available reranker models)
  if (pathname === '/api/codexlens/reranker/models' && req.method === 'GET') {
    try {
      // Check if CodexLens is installed first
      const venvStatus = await checkVenvStatus();
      if (!venvStatus.ready) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'CodexLens not installed' }));
        return true;
      }
      const result = await executeCodexLens(['reranker-model-list', '--json']);
      if (result.success) {
        try {
          const parsed = extractJSON(result.output ?? '');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(parsed));
        } catch {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, result: { models: [] }, output: result.output }));
        }
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: result.error }));
      }
    } catch (err: unknown) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }));
    }
    return true;
  }

  // API: Download Reranker Model (download reranker model by profile)
  if (pathname === '/api/codexlens/reranker/models/download' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { profile } = body as { profile?: unknown };
      const resolvedProfile = typeof profile === 'string' && profile.trim().length > 0 ? profile.trim() : undefined;

      if (!resolvedProfile) {
        return { success: false, error: 'profile is required', status: 400 };
      }

      try {
        const result = await executeCodexLens(['reranker-model-download', resolvedProfile, '--json'], { timeout: 600000 }); // 10 min for download
        if (result.success) {
          try {
            const parsed = extractJSON(result.output ?? '');
            return { success: true, ...parsed };
          } catch {
            return { success: true, output: result.output };
          }
        } else {
          return { success: false, error: result.error, status: 500 };
        }
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : String(err), status: 500 };
      }
    });
    return true;
  }

  // API: Delete Reranker Model (delete reranker model by profile)
  if (pathname === '/api/codexlens/reranker/models/delete' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { profile } = body as { profile?: unknown };
      const resolvedProfile = typeof profile === 'string' && profile.trim().length > 0 ? profile.trim() : undefined;

      if (!resolvedProfile) {
        return { success: false, error: 'profile is required', status: 400 };
      }

      try {
        const result = await executeCodexLens(['reranker-model-delete', resolvedProfile, '--json']);
        if (result.success) {
          try {
            const parsed = extractJSON(result.output ?? '');
            return { success: true, ...parsed };
          } catch {
            return { success: true, output: result.output };
          }
        } else {
          return { success: false, error: result.error, status: 500 };
        }
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : String(err), status: 500 };
      }
    });
    return true;
  }

  // API: Reranker Model Info (get reranker model info by profile)
  if (pathname === '/api/codexlens/reranker/models/info' && req.method === 'GET') {
    const profile = url.searchParams.get('profile');

    if (!profile) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'profile parameter is required' }));
      return true;
    }

    try {
      const result = await executeCodexLens(['reranker-model-info', profile, '--json']);
      if (result.success) {
        try {
          const parsed = extractJSON(result.output ?? '');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(parsed));
        } catch {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Failed to parse response' }));
        }
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: result.error }));
      }
    } catch (err: unknown) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }));
    }
    return true;
  }

  // ============================================================
  // SPLADE ENDPOINTS
  // ============================================================

  // API: SPLADE Status - Check if SPLADE is available and installed
  if (pathname === '/api/codexlens/splade/status') {
    try {
      // Check if CodexLens is installed first
      const venvStatus = await checkVenvStatus();
      if (!venvStatus.ready) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          available: false,
          installed: false,
          model: 'naver/splade-cocondenser-ensembledistil',
          error: 'CodexLens not installed'
        }));
        return true;
      }

      // Check SPLADE availability using Python check
      const result = await executeCodexLens(['python', '-c',
        'from codexlens.semantic.splade_encoder import check_splade_available; ok, err = check_splade_available(); print(\"OK\" if ok else err)'
      ]);

      const output = result.output ?? '';
      const available = output.includes('OK');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        available,
        installed: available,
        model: 'naver/splade-cocondenser-ensembledistil',
        error: available ? null : output.trim()
      }));
    } catch (err: unknown) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        available: false,
        installed: false,
        model: 'naver/splade-cocondenser-ensembledistil',
        error: err instanceof Error ? err.message : String(err)
      }));
    }
    return true;
  }

  // API: SPLADE Install - Install SPLADE dependencies
  if (pathname === '/api/codexlens/splade/install' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      try {
        const { gpu } = body as { gpu?: unknown };
        const useGpu = typeof gpu === 'boolean' ? gpu : false;
        const extras = useGpu ? ['splade-gpu'] : ['splade'];

        // Priority: Use UV if available (faster, better dependency resolution)
        if (await isUvAvailable()) {
          console.log('[SPLADE Install] Using UV for installation...');
          const uv = createCodexLensUvManager();

          // Ensure venv exists
          if (!uv.isVenvValid()) {
            console.log('[SPLADE Install] Venv not valid, creating...');
            const venvResult = await uv.createVenv();
            if (!venvResult.success) {
              throw new Error(`Failed to create venv: ${venvResult.error}`);
            }
          }

          // Find local codex-lens package
          const { existsSync } = await import('fs');
          const { join, dirname } = await import('path');
          const { fileURLToPath } = await import('url');
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = dirname(__filename);

          // Look for local codex-lens package
          const possiblePaths = [
            join(__dirname, '..', '..', '..', '..', '..', 'codex-lens'),
            join(__dirname, '..', '..', '..', '..', '..', '..', 'codex-lens'),
            join(process.cwd(), 'codex-lens'),
          ];

          let codexLensPath: string | null = null;
          for (const p of possiblePaths) {
            if (existsSync(join(p, 'pyproject.toml'))) {
              codexLensPath = p;
              break;
            }
          }

          if (codexLensPath) {
            // Install from local project with extras
            const result = await uv.installFromProject(codexLensPath, extras);
            if (result.success) {
              return {
                success: true,
                message: `SPLADE installed successfully via UV (${useGpu ? 'GPU' : 'CPU'} mode)`,
                duration: result.duration
              };
            }
            console.log('[SPLADE Install] UV install failed, falling back to pip:', result.error);
          } else {
            // Install from PyPI with extras
            const packageSpec = `codex-lens[${extras.join(',')}]`;
            const result = await uv.install([packageSpec]);
            if (result.success) {
              return {
                success: true,
                message: `SPLADE installed successfully via UV from PyPI (${useGpu ? 'GPU' : 'CPU'} mode)`,
                duration: result.duration
              };
            }
            console.log('[SPLADE Install] UV install failed, falling back to pip:', result.error);
          }
        }

        // Fallback: Use pip for installation
        console.log('[SPLADE Install] Using pip fallback...');
        const packageName = useGpu ? 'codex-lens[splade-gpu]' : 'codex-lens[splade]';
        const { promisify } = await import('util');
        const execFilePromise = promisify(require('child_process').execFile);

        const result = await execFilePromise('pip', ['install', packageName], {
          timeout: 600000 // 10 minutes
        });

        return {
          success: true,
          message: `SPLADE installed successfully via pip (${useGpu ? 'GPU' : 'CPU'} mode)`,
          output: result.stdout
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const stderr = (err as { stderr?: unknown })?.stderr;
        return {
          success: false,
          error: message,
          stderr: typeof stderr === 'string' ? stderr : undefined,
          status: 500
        };
      }
    });
    return true;
  }

  // API: SPLADE Index Status - Check if SPLADE index exists for a project
  if (pathname === '/api/codexlens/splade/index-status') {
    try {
      const projectPath = url.searchParams.get('path');
      if (!projectPath) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Missing path parameter' }));
        return true;
      }

      // Check if CodexLens is installed first
      const venvStatus = await checkVenvStatus();
      if (!venvStatus.ready) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ exists: false, error: 'CodexLens not installed' }));
        return true;
      }

      const { join } = await import('path');
      const indexDb = join(projectPath, '.codexlens', '_index.db');

      // Use Python to check SPLADE index status
      const pythonCode = `
from codexlens.storage.splade_index import SpladeIndex
from pathlib import Path
try:
    idx = SpladeIndex(Path(\"${indexDb.replace(/\\\\/g, '\\\\\\\\')}\"))
    if idx.has_index():
        stats = idx.get_stats()
        meta = idx.get_metadata()
        model = meta.get('model_name', '') if meta else ''
        print(f\"OK|{stats['unique_chunks']}|{stats['total_postings']}|{model}\")
    else:
        print(\"NO_INDEX\")
except Exception as e:
    print(f\"ERROR|{str(e)}\")
`;

      const result = await executeCodexLens(['python', '-c', pythonCode]);

      const output = result.output ?? '';
      if (output.startsWith('OK|')) {
        const parts = output.trim().split('|');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          exists: true,
          chunks: parseInt(parts[1]),
          postings: parseInt(parts[2]),
          model: parts[3]
        }));
      } else if (output.startsWith('ERROR|')) {
        const errorMsg = output.substring(6).trim();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ exists: false, error: errorMsg }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ exists: false }));
      }
    } catch (err: unknown) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ exists: false, error: err instanceof Error ? err.message : String(err) }));
    }
    return true;
  }

  // API: SPLADE Index Rebuild - Rebuild SPLADE index for a project
  if (pathname === '/api/codexlens/splade/rebuild' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { path: projectPath } = body as { path?: unknown };
      const resolvedProjectPath = typeof projectPath === 'string' && projectPath.trim().length > 0 ? projectPath : undefined;

      if (!resolvedProjectPath) {
        return { success: false, error: 'Missing path parameter', status: 400 };
      }

      try {
        // Use 'index splade' instead of deprecated 'splade-index'
        const result = await executeCodexLens(['index', 'splade', resolvedProjectPath, '--rebuild'], {
          cwd: resolvedProjectPath,
          timeout: 1800000 // 30 minutes for large codebases
        });

        if (result.success) {
          return {
            success: true,
            message: 'SPLADE index rebuilt successfully',
            output: result.output
          };
        } else {
          return {
            success: false,
            error: result.error || 'Failed to rebuild SPLADE index',
            output: result.output,
            status: 500
          };
        }
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : String(err), status: 500 };
      }
    });
    return true;
  }

  // ============================================================
  // LSP / SEMANTIC SEARCH API ENDPOINTS
  // ============================================================

  // API: LSP Status - Check if LSP/semantic search capabilities are available
  if (pathname === '/api/codexlens/lsp/status') {
    try {
      const venvStatus = await checkVenvStatus();
      if (!venvStatus.ready) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          available: false,
          semantic_available: false,
          vector_index: false,
          error: 'CodexLens not installed'
        }));
        return true;
      }

      // Check semantic deps and vector index availability in parallel
      const [semanticStatus, workspaceResult] = await Promise.all([
        checkSemanticStatus(),
        executeCodexLens(['status', '--json'])
      ]);

      let hasVectorIndex = false;
      let projectCount = 0;
      let embeddingsInfo: Record<string, unknown> = {};

      if (workspaceResult.success) {
        try {
          const status = extractJSON(workspaceResult.output ?? '');
          if (status.success !== false && status.result) {
            projectCount = status.result.projects_count || 0;
            embeddingsInfo = status.result.embeddings || {};
            // Check if any projects have embeddings
            hasVectorIndex = projectCount > 0 && Object.keys(embeddingsInfo).length > 0;
          } else if (status.projects_count !== undefined) {
            projectCount = status.projects_count || 0;
            embeddingsInfo = status.embeddings || {};
            hasVectorIndex = projectCount > 0 && Object.keys(embeddingsInfo).length > 0;
          }
        } catch {
          // Parse failed
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        available: semanticStatus.available && hasVectorIndex,
        semantic_available: semanticStatus.available,
        vector_index: hasVectorIndex,
        project_count: projectCount,
        embeddings: embeddingsInfo,
        modes: ['fusion', 'vector', 'structural'],
        strategies: ['rrf', 'staged', 'binary', 'hybrid', 'dense_rerank'],
      }));
    } catch (err: unknown) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        available: false,
        semantic_available: false,
        vector_index: false,
        error: err instanceof Error ? err.message : String(err)
      }));
    }
    return true;
  }

  // API: LSP Start - Start the standalone LSP manager
  if (pathname === '/api/codexlens/lsp/start' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { path: workspacePath } = body as { path?: unknown };
      const targetPath = typeof workspacePath === 'string' && workspacePath.trim().length > 0
        ? workspacePath : initialPath;

      try {
        const venvStatus = await checkVenvStatus();
        if (!venvStatus.ready) {
          return { success: false, error: 'CodexLens not installed', status: 400 };
        }

        const result = await executeCodexLensPythonAPI('lsp_start', {
          workspace_root: targetPath,
        }, 30000);

        if (result.success) {
          return {
            success: true,
            message: 'LSP server started',
            workspace_root: targetPath,
            ...((result.results && typeof result.results === 'object') ? result.results : {}),
          };
        } else {
          return { success: false, error: result.error || 'Failed to start LSP server', status: 500 };
        }
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : String(err), status: 500 };
      }
    });
    return true;
  }

  // API: LSP Stop - Stop the standalone LSP manager
  if (pathname === '/api/codexlens/lsp/stop' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { path: workspacePath } = body as { path?: unknown };
      const targetPath = typeof workspacePath === 'string' && workspacePath.trim().length > 0
        ? workspacePath : initialPath;

      try {
        const venvStatus = await checkVenvStatus();
        if (!venvStatus.ready) {
          return { success: false, error: 'CodexLens not installed', status: 400 };
        }

        const result = await executeCodexLensPythonAPI('lsp_stop', {
          workspace_root: targetPath,
        }, 15000);

        if (result.success) {
          return {
            success: true,
            message: 'LSP server stopped',
          };
        } else {
          return { success: false, error: result.error || 'Failed to stop LSP server', status: 500 };
        }
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : String(err), status: 500 };
      }
    });
    return true;
  }

  // API: LSP Restart - Stop then start the standalone LSP manager
  if (pathname === '/api/codexlens/lsp/restart' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { path: workspacePath } = body as { path?: unknown };
      const targetPath = typeof workspacePath === 'string' && workspacePath.trim().length > 0
        ? workspacePath : initialPath;

      try {
        const venvStatus = await checkVenvStatus();
        if (!venvStatus.ready) {
          return { success: false, error: 'CodexLens not installed', status: 400 };
        }

        const result = await executeCodexLensPythonAPI('lsp_restart', {
          workspace_root: targetPath,
        }, 45000);

        if (result.success) {
          return {
            success: true,
            message: 'LSP server restarted',
            workspace_root: targetPath,
            ...((result.results && typeof result.results === 'object') ? result.results : {}),
          };
        } else {
          return { success: false, error: result.error || 'Failed to restart LSP server', status: 500 };
        }
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : String(err), status: 500 };
      }
    });
    return true;
  }

  // API: LSP Semantic Search - Advanced semantic search via Python API
  if (pathname === '/api/codexlens/lsp/search' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const {
        query,
        path: projectPath,
        mode = 'fusion',
        fusion_strategy = 'rrf',
        vector_weight = 0.5,
        structural_weight = 0.3,
        keyword_weight = 0.2,
        kind_filter,
        limit = 20,
        include_match_reason = false,
      } = body as {
        query?: unknown;
        path?: unknown;
        mode?: unknown;
        fusion_strategy?: unknown;
        vector_weight?: unknown;
        structural_weight?: unknown;
        keyword_weight?: unknown;
        kind_filter?: unknown;
        limit?: unknown;
        include_match_reason?: unknown;
      };

      const resolvedQuery = typeof query === 'string' ? query.trim() : '';
      if (!resolvedQuery) {
        return { success: false, error: 'Query parameter is required', status: 400 };
      }

      const targetPath = typeof projectPath === 'string' && projectPath.trim().length > 0 ? projectPath : initialPath;
      const resolvedMode = typeof mode === 'string' && ['fusion', 'vector', 'structural'].includes(mode) ? mode : 'fusion';
      const resolvedStrategy = typeof fusion_strategy === 'string' &&
        ['rrf', 'staged', 'binary', 'hybrid', 'dense_rerank'].includes(fusion_strategy) ? fusion_strategy : 'rrf';
      const resolvedVectorWeight = typeof vector_weight === 'number' ? vector_weight : 0.5;
      const resolvedStructuralWeight = typeof structural_weight === 'number' ? structural_weight : 0.3;
      const resolvedKeywordWeight = typeof keyword_weight === 'number' ? keyword_weight : 0.2;
      const resolvedLimit = typeof limit === 'number' ? limit : 20;
      const resolvedIncludeReason = typeof include_match_reason === 'boolean' ? include_match_reason : false;

      // Build Python API call args
      const apiArgs: Record<string, unknown> = {
        project_root: targetPath,
        query: resolvedQuery,
        mode: resolvedMode,
        vector_weight: resolvedVectorWeight,
        structural_weight: resolvedStructuralWeight,
        keyword_weight: resolvedKeywordWeight,
        fusion_strategy: resolvedStrategy,
        limit: resolvedLimit,
        include_match_reason: resolvedIncludeReason,
      };

      if (Array.isArray(kind_filter) && kind_filter.length > 0) {
        apiArgs.kind_filter = kind_filter;
      }

      try {
        const result = await executeCodexLensPythonAPI('semantic_search', apiArgs);
        if (result.success) {
          return {
            success: true,
            results: result.results,
            query: resolvedQuery,
            mode: resolvedMode,
            fusion_strategy: resolvedStrategy,
            count: Array.isArray(result.results) ? result.results.length : 0,
          };
        } else {
          return { success: false, error: result.error || 'Semantic search failed', status: 500 };
        }
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : String(err), status: 500 };
      }
    });
    return true;
  }

  return false;
}
