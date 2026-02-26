/**
 * CLI Settings Type Definitions
 * Supports multi-provider CLI settings: Claude, Codex, Gemini
 */

/**
 * CLI Provider type discriminator
 */
export type CliProvider = 'claude' | 'codex' | 'gemini';

/**
 * Claude CLI Settings 文件格式
 * 对应 `claude --settings <file-or-json>` 参数
 */
export interface ClaudeCliSettings {
  /** 环境变量配置 */
  env: {
    /** Anthropic API Token */
    ANTHROPIC_AUTH_TOKEN?: string;
    /** Anthropic API Base URL */
    ANTHROPIC_BASE_URL?: string;
    /** 禁用自动更新 */
    DISABLE_AUTOUPDATER?: string;
    /** 其他自定义环境变量 */
    [key: string]: string | undefined;
  };
  /** 模型选择 */
  model?: 'opus' | 'sonnet' | 'haiku' | string;
  /** CLI工具标签 (用于标签路由) */
  tags?: string[];
  /** 可用模型列表 (显示在下拉菜单中) */
  availableModels?: string[];
  /** 外部配置文件路径 (用于 builtin claude 工具) */
  settingsFile?: string;
}

/**
 * Codex CLI Settings
 * Codex 使用 --profile 传递配置, auth.json / config.toml 管理凭证和设置
 */
export interface CodexCliSettings {
  /** 环境变量配置 */
  env: {
    /** OpenAI API Key */
    OPENAI_API_KEY?: string;
    /** OpenAI API Base URL */
    OPENAI_BASE_URL?: string;
    /** 其他自定义环境变量 */
    [key: string]: string | undefined;
  };
  /** Codex profile 名称 (传递为 --profile <name>) */
  profile?: string;
  /** 模型选择 */
  model?: string;
  /** auth.json 内容 (JSON 字符串) */
  authJson?: string;
  /** config.toml 内容 (TOML 字符串) */
  configToml?: string;
  /** CLI工具标签 */
  tags?: string[];
  /** 可用模型列表 */
  availableModels?: string[];
}

/**
 * Gemini CLI Settings
 */
export interface GeminiCliSettings {
  /** 环境变量配置 */
  env: {
    /** Gemini API Key */
    GEMINI_API_KEY?: string;
    /** Google API Key (alternative) */
    GOOGLE_API_KEY?: string;
    /** 其他自定义环境变量 */
    [key: string]: string | undefined;
  };
  /** 模型选择 */
  model?: string;
  /** CLI工具标签 */
  tags?: string[];
  /** 可用模型列表 */
  availableModels?: string[];
}

/**
 * Union type for all provider settings
 */
export type CliSettings = ClaudeCliSettings | CodexCliSettings | GeminiCliSettings;

/**
 * 端点 Settings 配置（带元数据）
 */
export interface EndpointSettings {
  /** 端点唯一标识 */
  id: string;
  /** 端点显示名称 */
  name: string;
  /** 端点描述 */
  description?: string;
  /** CLI provider 类型 (默认 'claude' 兼容旧数据) */
  provider: CliProvider;
  /** CLI Settings (provider-specific) */
  settings: CliSettings;
  /** 是否启用 */
  enabled: boolean;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * Settings 列表响应
 */
export interface SettingsListResponse {
  endpoints: EndpointSettings[];
  total: number;
}

/**
 * Settings 操作结果
 */
export interface SettingsOperationResult {
  success: boolean;
  message?: string;
  endpoint?: EndpointSettings;
  filePath?: string;
}

/**
 * 创建/更新端点请求
 */
export interface SaveEndpointRequest {
  id?: string;
  name: string;
  description?: string;
  /** CLI provider 类型 */
  provider?: CliProvider;
  settings: CliSettings;
  enabled?: boolean;
}

/**
 * 从 LiteLLM Provider 映射到 Claude CLI env
 */
export function mapProviderToClaudeEnv(provider: {
  apiKey?: string;
  apiBase?: string;
}): ClaudeCliSettings['env'] {
  const env: ClaudeCliSettings['env'] = {};

  if (provider.apiKey) {
    env.ANTHROPIC_AUTH_TOKEN = provider.apiKey;
  }
  if (provider.apiBase) {
    env.ANTHROPIC_BASE_URL = provider.apiBase;
  }
  // 默认禁用自动更新
  env.DISABLE_AUTOUPDATER = '1';

  return env;
}

/**
 * 创建默认 Settings
 */
export function createDefaultSettings(provider: CliProvider = 'claude'): CliSettings {
  switch (provider) {
    case 'codex':
      return {
        env: {},
        model: '',
        tags: [],
        availableModels: []
      } satisfies CodexCliSettings;
    case 'gemini':
      return {
        env: {},
        model: '',
        tags: [],
        availableModels: []
      } satisfies GeminiCliSettings;
    case 'claude':
    default:
      return {
        env: {
          DISABLE_AUTOUPDATER: '1'
        },
        model: 'sonnet',
        tags: [],
        availableModels: []
      } satisfies ClaudeCliSettings;
  }
}

/**
 * 验证 Settings 格式 (provider-aware)
 */
export function validateSettings(settings: unknown, provider?: CliProvider): settings is CliSettings {
  if (!settings || typeof settings !== 'object') {
    return false;
  }

  const s = settings as Record<string, unknown>;

  // env 必须存在且为对象
  if (!s.env || typeof s.env !== 'object') {
    return false;
  }

  // 深层验证：env 内部所有值必须是 string 或 undefined
  const envObj = s.env as Record<string, unknown>;
  for (const key in envObj) {
    if (Object.prototype.hasOwnProperty.call(envObj, key)) {
      const value = envObj[key];
      if (value !== undefined && typeof value !== 'string') {
        return false;
      }
    }
  }

  // model 可选，但如果存在必须是字符串
  if (s.model !== undefined && typeof s.model !== 'string') {
    return false;
  }

  // tags 可选，但如果存在必须是数组
  if (s.tags !== undefined && !Array.isArray(s.tags)) {
    return false;
  }

  // availableModels 可选，但如果存在必须是数组
  if (s.availableModels !== undefined && !Array.isArray(s.availableModels)) {
    return false;
  }

  // Provider-specific validation
  if (provider === 'codex') {
    // profile 可选，但如果存在必须是字符串
    if (s.profile !== undefined && typeof s.profile !== 'string') {
      return false;
    }
    // authJson 可选，但如果存在必须是字符串
    if (s.authJson !== undefined && typeof s.authJson !== 'string') {
      return false;
    }
    // configToml 可选，但如果存在必须是字符串
    if (s.configToml !== undefined && typeof s.configToml !== 'string') {
      return false;
    }
  } else if (provider === 'claude' || !provider) {
    // settingsFile 可选，但如果存在必须是字符串
    if (s.settingsFile !== undefined && typeof s.settingsFile !== 'string') {
      return false;
    }
  }

  return true;
}

/**
 * Exported settings format for backup/restore
 */
export interface ExportedSettings {
  /** Export format version for future migrations */
  version: string;
  /** Export timestamp (ISO 8601) */
  timestamp: string;
  /** All endpoint settings */
  endpoints: EndpointSettings[];
}

/**
 * Import options for conflict resolution
 */
export interface ImportOptions {
  /** How to handle conflicts: 'skip' keeps existing, 'overwrite' replaces, 'merge' combines */
  conflictStrategy?: 'skip' | 'overwrite' | 'merge';
  /** Whether to skip invalid endpoints (default: true) */
  skipInvalid?: boolean;
  /** Whether to disable all imported endpoints (default: false) */
  disableImported?: boolean;
}

/**
 * Import result summary
 */
export interface ImportResult {
  /** Whether import was successful overall */
  success: boolean;
  /** Number of endpoints imported successfully */
  imported: number;
  /** Number of endpoints skipped (conflicts or validation errors) */
  skipped: number;
  /** Detailed error messages for failed imports */
  errors: string[];
  /** List of imported endpoint IDs */
  importedIds?: string[];
}

/**
 * Codex config preview response
 */
export interface CodexConfigPreviewResponse {
  /** Whether preview was successful */
  success: boolean;
  /** Path to config.toml */
  configPath: string;
  /** Path to auth.json */
  authPath: string;
  /** config.toml content with sensitive values masked */
  configToml: string | null;
  /** auth.json content with API keys masked */
  authJson: string | null;
  /** Error messages if any files could not be read */
  errors?: string[];
}

/**
 * Gemini config preview response
 */
export interface GeminiConfigPreviewResponse {
  /** Whether preview was successful */
  success: boolean;
  /** Path to settings.json */
  settingsPath: string;
  /** settings.json content with sensitive values masked */
  settingsJson: string | null;
  /** Error messages if file could not be read */
  errors?: string[];
}
