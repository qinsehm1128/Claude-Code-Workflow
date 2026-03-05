# API 设置

## 一句话定位

**API 设置是统一的多端点配置管理** — 在一个地方配置所有 AI 服务商的 API Keys 和端点，支持多环境切换和密钥加密存储。

## 解决的痛点

| 痛点 | 现状 | API 设置方案 |
| --- | --- | --- |
| **配置分散** | API Keys 散落在各工具配置中 | 统一配置入口 |
| **安全性弱** | 明文存储密钥 | 支持密钥加密 |
| **切换困难** | 切换服务商需要修改多处 | 一个配置文件管理所有 |
| **环境隔离差** | 开发/生产环境混用 | 支持多环境配置 |

## 核心概念速览

| 概念 | 说明 | 位置 |
| --- | --- | --- |
| **API Keys** | 服务商认证密钥 | `settings.json` / `settings.local.json` |
| **Providers** | AI 服务提供商 | OpenAI, Anthropic, Gemini, LiteLLM |
| **Endpoints** | API 服务端点 | URL + 认证配置 |
| **LiteLLM** | 统一代理服务 | 支持 100+ 模型 |
| **本地配置** | 项目级配置 | `.cw/settings.json` |
| **全局配置** | 用户级配置 | `~/.claude/settings.json` |

## 配置层级

```
┌─────────────────────────────────────────────────────────────┐
│                    配置优先级                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. settings.local.json (最高优先级，不提交)               │
│     └─ 本地开发配置，覆盖其他配置                           │
│           │                                                 │
│           ▼                                                 │
│  2. .cw/settings.json (项目配置)                          │
│     └─ 项目特定配置，团队成员共享                           │
│           │                                                 │
│           ▼                                                 │
│  3. ~/.claude/settings.json (全局配置)                     │
│     └─ 用户默认配置，所有项目共享                           │
│           │                                                 │
│           ▼                                                 │
│  4. 默认值 (最低优先级)                                    │
│     └─ 系统内置默认配置                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 配置说明

### settings.json 结构

```json
{
  "$schema": "https://cdn.jsdelivr.net/gh/your-repo/schema/settings-schema.json",
  "providers": {
    "openai": {
      "apiKey": "sk-...",
      "baseURL": "https://api.openai.com/v1",
      "models": {
        "gpt-4": "gpt-4-turbo",
        "gpt-3.5": "gpt-3.5-turbo"
      }
    },
    "anthropic": {
      "apiKey": "sk-ant-...",
      "baseURL": "https://api.anthropic.com/v1",
      "models": {
        "claude-opus": "claude-3-opus-20240229",
        "claude-sonnet": "claude-3-sonnet-20240229"
      }
    },
    "gemini": {
      "apiKey": "AIza...",
      "baseURL": "https://generativelanguage.googleapis.com/v1beta",
      "models": {
        "gemini-pro": "gemini-pro",
        "gemini-flash": "gemini-1.5-flash"
      }
    },
    "litellm": {
      "apiKey": "sk-...",
      "baseURL": "https://litellm.example.com/v1",
      "models": {
        "qwen-embed": "qwen/qwen3-embedding-sf"
      }
    }
  },
  "cw": {
    "defaultTool": "gemini",
    "promptFormat": "plain",
    "smartContext": {
      "enabled": false,
      "maxFiles": 10
    },
    "nativeResume": true,
    "recursiveQuery": true,
    "cache": {
      "injectionMode": "auto",
      "defaultPrefix": "",
      "defaultSuffix": ""
    },
    "codeIndexMcp": "ace"
  },
  "hooks": {
    "prePrompt": [],
    "postResponse": []
  }
}
```

### Providers 配置详解

#### OpenAI

```json
{
  "providers": {
    "openai": {
      "apiKey": "sk-proj-...",
      "baseURL": "https://api.openai.com/v1",
      "organization": "org-...",
      "timeout": 60000,
      "maxRetries": 3
    }
  }
}
```

#### Anthropic (Claude)

```json
{
  "providers": {
    "anthropic": {
      "apiKey": "sk-ant-...",
      "baseURL": "https://api.anthropic.com/v1",
      "version": "2023-06-01",
      "timeout": 60000,
      "maxRetries": 3
    }
  }
}
```

#### Gemini (Google)

```json
{
  "providers": {
    "gemini": {
      "apiKey": "AIza...",
      "baseURL": "https://generativelanguage.googleapis.com/v1beta",
      "timeout": 60000
    }
  }
}
```

#### LiteLLM (统一代理)

```json
{
  "providers": {
    "litellm": {
      "apiKey": "sk-...",
      "baseURL": "https://litellm.example.com/v1",
      "dropParams": ["max_tokens"],
      "timeout": 120000
    }
  }
}
```

### CCW 配置详解

```json
{
  "cw": {
    "defaultTool": "gemini",
    "promptFormat": "plain",
    "smartContext": {
      "enabled": false,
      "maxFiles": 10
    },
    "nativeResume": true,
    "recursiveQuery": true,
    "cache": {
      "injectionMode": "auto",
      "defaultPrefix": "",
      "defaultSuffix": ""
    },
    "codeIndexMcp": "ace"
  }
}
```

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `defaultTool` | string | `gemini` | 默认 CLI 工具 |
| `promptFormat` | string | `plain` | Prompt 格式: `plain` / `yaml` / `json` |
| `smartContext.enabled` | boolean | `false` | 智能上下文开关 |
| `smartContext.maxFiles` | number | `10` | 最大文件数量 |
| `nativeResume` | boolean | `true` | 本地会话恢复 |
| `recursiveQuery` | boolean | `true` | 递归查询 |
| `cache.injectionMode` | string | `auto` | 缓存注入模式 |
| `codeIndexMcp` | string | `ace` | 代码索引 MCP: `codexlens` / `ace` / `none` |

### Hooks 配置

```json
{
  "hooks": {
    "prePrompt": [
      {
        "type": "command",
        "command": "ccw",
        "args": ["spec", "load", "--stdin"]
      },
      {
        "type": "mcp",
        "server": "cw-tools",
        "tool": "core_memory",
        "args": {
          "operation": "search",
          "query": "{{userPrompt}}",
          "top_k": 5
        }
      }
    ],
    "postResponse": [
      {
        "type": "command",
        "command": "ccw",
        "args": ["memory", "capture"]
      }
    ]
  }
}
```

## 操作步骤

### 初始化配置

```bash
# 在项目中初始化配置文件
ccw config init

# 编辑配置
ccw config edit
```

### 设置 API Keys

**方式 1: 编辑配置文件**

```bash
# 编辑项目配置
code .cw/settings.json

# 编辑全局配置
code ~/.claude/settings.json
```

**方式 2: 使用命令**

```bash
# 设置 OpenAI API Key
ccw config set providers.openai.apiKey "sk-proj-..."

# 设置 Anthropic API Key
ccw config set providers.anthropic.apiKey "sk-ant-..."

# 设置默认工具
ccw config set cw.defaultTool "codex"
```

**方式 3: 环境变量**

```bash
# 设置环境变量（优先级最高）
export OPENAI_API_KEY="sk-proj-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GEMINI_API_KEY="AIza..."
```

### 本地配置 (不提交)

```bash
# 创建本地配置（自动添加到 .gitignore）
cat > .cw/settings.local.json << 'EOF'
{
  "providers": {
    "openai": {
      "apiKey": "sk-proj-..."
    }
  }
}
EOF
```

### 验证配置

```bash
# 验证 API Keys
ccw config verify

# 测试连接
ccw cli -p "Hello" --tool gemini --mode analysis
```

## 配置文件位置

| 配置文件 | 位置 | 用途 | Git |
| --- | --- | --- | --- |
| 项目配置 | `.cw/settings.json` | 项目共享配置 | 提交 |
| 本地配置 | `.cw/settings.local.json` | 个人开发配置 | **不提交** |
| 全局配置 | `~/.claude/settings.json` | 用户默认配置 | 不适用 |
| CLI 工具配置 | `~/.claude/cli-tools.json` | CLI 工具定义 | 不适用 |
| CLI 设置 | `.cw/cli-settings.json` | CLI 行为配置 | 提交 |

## 常见问题

### Q1: API Key 存储安全吗？

A: 建议使用 `settings.local.json` 存储敏感信息：
- `settings.local.json` 自动被 `.gitignore` 排除
- 永不提交到仓库
- 优先级最高，覆盖其他配置

### Q2: 如何切换不同环境？

A: 使用多配置文件：

```bash
# 开发环境
.cw/settings.dev.json

# 生产环境
.cw/settings.prod.json

# 切换环境
cp .cw/settings.dev.json .cw/settings.local.json
```

### Q3: LiteLLM 如何配置？

A: 配置 LiteLLM 端点：

```json
{
  "providers": {
    "litellm": {
      "apiKey": "sk-...",
      "baseURL": "https://your-litellm-proxy.com/v1"
    }
  },
  "cw": {
    "defaultTool": "litellm"
  }
}
```

### Q4: 配置不生效怎么办？

A: 检查优先级和语法：

```bash
# 验证配置语法
ccw config validate

# 查看有效配置
ccw config show

# 查看配置来源
ccw config --debug
```

## 相关功能

- [CLI 调用系统](./cli.md) — 使用 API Keys 执行命令
- [系统设置](./system-settings.md) — cli-tools.json 配置
- [Dashboard 面板](./dashboard.md) — 可视化配置管理

## 进阶阅读

- 配置加载: `ccw/src/config/settings-loader.ts`
- 配置验证: `ccw/src/config/settings-validator.ts`
- CLI 配置: `ccw/src/tools/claude-cli-tools.ts`
- Hooks 执行: `ccw/src/core/hooks/`
