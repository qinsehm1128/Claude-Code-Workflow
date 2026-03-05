/**
 * LiteLLM Static Model Lists (Fallback)
 *
 * Sourced from LiteLLM's internal model lists.
 * Used as fallback when user config has no availableModels defined.
 *
 * Last updated: 2026-02-27
 * Source: Python litellm module static lists
 */

export interface ModelInfo {
  id: string;
  name: string;
}

/**
 * Mapping from CLI tool names to LiteLLM provider model lists
 */
export const LITELLM_STATIC_MODELS: Record<string, ModelInfo[]> = {
  // Gemini models (from litellm.gemini_models)
  gemini: [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.0-pro-exp-02-05', name: 'Gemini 2.0 Pro Exp' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro Latest' },
    { id: 'gemini-embedding-001', name: 'Gemini Embedding 001' }
  ],

  // OpenAI models (from litellm.open_ai_chat_completion_models)
  codex: [
    { id: 'gpt-5.2', name: 'GPT-5.2' },
    { id: 'gpt-5.1-chat-latest', name: 'GPT-5.1 Chat Latest' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'o4-mini-2025-04-16', name: 'O4 Mini' },
    { id: 'o3', name: 'O3' },
    { id: 'o1-mini', name: 'O1 Mini' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' }
  ],

  // Anthropic models (from litellm.anthropic_models)
  claude: [
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
    { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5' },
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' }
  ],

  // OpenAI models for opencode (via LiteLLM proxy)
  opencode: [
    { id: 'opencode/glm-4.7-free', name: 'GLM-4.7 Free' },
    { id: 'opencode/gpt-5-nano', name: 'GPT-5 Nano' },
    { id: 'opencode/grok-code', name: 'Grok Code' },
    { id: 'opencode/minimax-m2.1-free', name: 'MiniMax M2.1 Free' }
  ],

  // Qwen models
  qwen: [
    { id: 'qwen2.5-coder-32b', name: 'Qwen 2.5 Coder 32B' },
    { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder' },
    { id: 'qwen2.5-72b', name: 'Qwen 2.5 72B' },
    { id: 'qwen2-72b', name: 'Qwen 2 72B' },
    { id: 'coder-model', name: 'Qwen Coder' },
    { id: 'vision-model', name: 'Qwen Vision' }
  ]
};

/**
 * Get fallback models for a tool
 * @param toolId - Tool identifier (e.g., 'gemini', 'claude', 'codex')
 * @returns Array of model info, or empty array if not found
 */
export function getFallbackModels(toolId: string): ModelInfo[] {
  return LITELLM_STATIC_MODELS[toolId] ?? [];
}

/**
 * Check if a tool has fallback models defined
 * @param toolId - Tool identifier
 * @returns true if fallback models exist
 */
export function hasFallbackModels(toolId: string): boolean {
  return toolId in LITELLM_STATIC_MODELS;
}
