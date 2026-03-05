/**
 * Provider Reference Routes Module
 * Handles read-only provider model reference API endpoints
 *
 * Model source priority:
 * 1. User configuration (cli-tools.json availableModels)
 * 2. LiteLLM static model lists (fallback)
 */

import type { RouteContext } from './types.js';
import { loadClaudeCliTools, type ClaudeCliToolsConfig } from '../../tools/claude-cli-tools.js';
import { getFallbackModels, hasFallbackModels, type ModelInfo } from '../../config/litellm-static-models.js';

/**
 * Get models for a tool, using config or fallback
 */
function getToolModels(toolId: string, configModels?: string[]): ModelInfo[] {
  // Priority 1: User config
  if (configModels && configModels.length > 0) {
    return configModels.map(id => ({ id, name: id }));
  }

  // Priority 2: LiteLLM static fallback
  return getFallbackModels(toolId);
}

/**
 * Handle Provider Reference routes
 * @returns true if route was handled, false otherwise
 */
export async function handleProviderRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, req, res, initialPath } = ctx;

  // ========== GET ALL PROVIDERS ==========
  // GET /api/providers
  if (pathname === '/api/providers' && req.method === 'GET') {
    try {
      const config = loadClaudeCliTools(initialPath);
      const providers = Object.entries(config.tools)
        .filter(([, tool]) => tool.enabled)
        .map(([id, tool]) => {
          // Use config models or fallback count
          const models = getToolModels(id, tool.availableModels);
          return {
            id,
            name: id.charAt(0).toUpperCase() + id.slice(1),
            modelCount: models.length,
            primaryModel: tool.primaryModel ?? '',
            secondaryModel: tool.secondaryModel ?? '',
            type: tool.type ?? 'builtin',
            hasCustomModels: !!(tool.availableModels && tool.availableModels.length > 0)
          };
        });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, providers }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: (err as Error).message
      }));
    }
    return true;
  }

  // ========== GET MODELS FOR PROVIDER ==========
  // GET /api/providers/:provider/models
  const providerMatch = pathname.match(/^\/api\/providers\/([^\/]+)\/models$/);
  if (providerMatch && req.method === 'GET') {
    const provider = decodeURIComponent(providerMatch[1]);

    try {
      const config = loadClaudeCliTools(initialPath);
      const tool = config.tools[provider];

      if (!tool || !tool.enabled) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: `Provider not found: ${provider}`
        }));
        return true;
      }

      // Get models from config or fallback
      const models = getToolModels(provider, tool.availableModels);
      const usingFallback = !tool.availableModels || tool.availableModels.length === 0;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        provider,
        providerName: provider.charAt(0).toUpperCase() + provider.slice(1),
        models,
        primaryModel: tool.primaryModel ?? '',
        secondaryModel: tool.secondaryModel ?? '',
        source: usingFallback ? 'fallback' : 'config'
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: (err as Error).message
      }));
    }
    return true;
  }

  return false;
}
