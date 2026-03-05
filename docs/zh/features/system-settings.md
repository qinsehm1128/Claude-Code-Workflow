# 系统设置

## 一句话定位

**系统设置是 CCW 的全局配置中心** — 管理 CLI 工具定义、Hooks、代理、Agent 和行为偏好，控制整个 CCW 工作流的运行方式。

## 解决的痛点

| 痛点 | 现状 | 系统设置方案 |
| --- | --- | --- |
| **配置分散** | 配置散落多个文件 | 集中在 `~/.claude/` 目录 |
| **工具定义复杂** | 添加新工具需要修改代码 | JSON 配置定义工具 |
| **自动化困难** | 手动执行重复任务 | Hooks 自动化 |
| **行为不一致** | 不同项目行为差异大 | 全局配置统一行为 |

## 核心概念速览

| 概念 | 说明 | 位置 |
| --- | --- | --- |
| **cli-tools.json** | CLI 工具定义 | `~/.claude/cli-tools.json` |
| **settings.json** | 项目设置 | `.cw/settings.json` |
| **CLAUDE.md** | 项目指令 | `.cw/CLAUDE.md` |
| **Hooks** | 自动化钩子 | `settings.json` hooks |
| **Agents** | 智能代理配置 | `~/.claude/agents/` |
| **Proxy** | 网络代理配置 | `settings.json` proxy |

## 配置文件总览

```
~/.claude/                              # 全局配置目录
├── cli-tools.json                      # CLI 工具定义
├── settings.json                       # 默认设置
├── agents/                             # Agent 配置
│   ├── cli-execution-agent.md
│   └── ...
└── workflows/                          # 工作流配置
    └── ...

.cw/                                   # 项目配置目录
├── settings.json                       # 项目设置
├── settings.local.json                 # 本地设置（不提交）
├── CLAUDE.md                           # 项目指令
├── cli-settings.json                   # CLI 行为配置
├── specs/                              # 项目规范
│   ├── coding-conventions.md
│   └── ...
└── personal/                           # 个人偏好
    └── ...
```

## 配置详解

### cli-tools.json (CLI 工具定义)

定义可用的 AI 工具及其配置：

```json
{
  "version": "3.3.0",
  "tools": {
    "gemini": {
      "enabled": true,
      "primaryModel": "gemini-2.5-flash",
      "secondaryModel": "gemini-2.5-flash",
      "availableModels": [
        "gemini-3-pro-preview",
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-2.0-flash"
      ],
      "tags": ["分析", "Debug"],
      "type": "builtin"
    },
    "qwen": {
      "enabled": true,
      "primaryModel": "coder-model",
      "secondaryModel": "coder-model",
      "tags": [],
      "type": "builtin"
    },
    "codex": {
      "enabled": true,
      "primaryModel": "gpt-5.2",
      "secondaryModel": "gpt-5.2",
      "tags": [],
      "type": "builtin"
    },
    "claude": {
      "enabled": true,
      "primaryModel": "sonnet",
      "secondaryModel": "haiku",
      "tags": [],
      "type": "builtin",
      "settingsFile": "D:\\settings-glm5.json"
    },
    "opencode": {
      "enabled": true,
      "primaryModel": "opencode/glm-4.7-free",
      "secondaryModel": "opencode/glm-4.7-free",
      "tags": [],
      "type": "builtin"
    }
  }
}
```

#### 字段说明

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `version` | string | 配置文件版本 |
| `tools` | object | 工具定义集合 |
| `enabled` | boolean | 是否启用 |
| `primaryModel` | string | 主模型 |
| `secondaryModel` | string | 备用模型 |
| `availableModels` | string[] | 可用模型列表 |
| `tags` | string[] | 能力标签 |
| `type` | string | 工具类型: `builtin` / `cli-wrapper` / `api-endpoint` |

### cli-settings.json (CLI 行为配置)

```json
{
  "$schema": "../cli-tools-schema.json",
  "version": "1.0.0",
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
```

#### 字段说明

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `defaultTool` | string | `gemini` | 默认 CLI 工具 |
| `promptFormat` | string | `plain` | Prompt 格式 |
| `smartContext.enabled` | boolean | `false` | 智能上下文开关 |
| `smartContext.maxFiles` | number | `10` | 最大文件数 |
| `nativeResume` | boolean | `true` | 本地会话恢复 |
| `recursiveQuery` | boolean | `true` | 递归查询 |
| `cache.injectionMode` | string | `auto` | 缓存注入模式 |
| `codeIndexMcp` | string | `ace` | 代码索引 MCP |

### CLAUDE.md (项目指令)

全局项目指令：

```markdown
# Claude Instructions

## Coding Philosophy

- **Pursue good taste** - Eliminate edge cases
- **Embrace extreme simplicity**
- **Be pragmatic** - Solve real problems

## CLI Endpoints

- **CLI Tools Usage**: @~/.ccw/workflows/cli-tools-usage.md
- **CLI Endpoints Config**: @~/.claude/cli-tools.json

## Tool Execution

- **Always use `run_in_background: false`** for Task tool agent calls
- **Default: Use Bash `run_in_background: true`** for CLI calls

## Code Diagnostics

- **Prefer `mcp__ide__getDiagnostics`** for code error checking
```

### CLAUDE.md 结构

```markdown
# 全局指令 (~/)
├── Coding Philosophy        # 编码哲学
├── CLI Endpoints            # CLI 配置
├── Tool Execution           # 工具执行规则
├── Code Diagnostics         # 诊断规则
└── ...

# 项目指令 (.cw/)
├── Project Overview         # 项目概述
├── Architecture             # 架构说明
├── Conventions              # 编码约定
└── Module Specifics         # 模块特定规则
```

## Hooks 配置

### Hook 类型

| 类型 | 触发时机 | 用途 |
| --- | --- | --- |
| `prePrompt` | 发送 Prompt 前 | 注入上下文、规范 |
| `postResponse` | 收到响应后 | 捕获记忆、更新状态 |
| `preCommand` | 执行命令前 | 验证、修改参数 |
| `postCommand` | 执行命令后 | 清理、通知 |

### Hook 配置示例

```json
{
  "hooks": {
    "prePrompt": [
      {
        "type": "command",
        "command": "ccw",
        "args": ["spec", "load", "--stdin"],
        "timeout": 5000
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
      },
      {
        "type": "file",
        "path": ".cw/prompts/system-prefix.md"
      }
    ],
    "postResponse": [
      {
        "type": "command",
        "command": "ccw",
        "args": ["memory", "capture", "--auto"]
      },
      {
        "type": "mcp",
        "server": "cw-tools",
        "tool": "core_memory",
        "args": {
          "operation": "import",
          "text": "{{response}}",
          "tags": ["auto-capture"]
        }
      }
    ]
  }
}
```

## Agents 配置

### Agent 定义

Agent 定义文件位于 `~/.claude/agents/`：

```markdown
---
name: cli-execution-agent
version: "1.0.0"
description: Execute CLI tools with intelligent fallback
---

# CLI Execution Agent

## Phase 1: Intent Analysis

Analyze user prompt to determine:
- Task type (analyze/plan/execute/discuss)
- Tool selection (gemini/qwen/codex/claude)
- Mode (analysis/write/review)

## Phase 2: Tool Selection

| Task Type | Primary Tool | Fallback |
|-----------|--------------|----------|
| analyze | gemini | qwen |
| plan | gemini | codex |
| execute (simple) | gemini | qwen |
| execute (complex) | codex | gemini |
| discuss | multi | - |

## Phase 3: Execution

Build and execute CLI command with:
- Proper mode selection
- Model configuration
- Error handling
- Output formatting
```

### Agent 调用

```bash
# 调用 Agent
ccw agent execute cli-execution-agent \
  --prompt "分析代码结构" \
  --context @src/**/*.ts
```

## 代理配置

### HTTP 代理

```json
{
  "proxy": {
    "http": "http://proxy.example.com:8080",
    "https": "https://proxy.example.com:8080",
    "noProxy": ["localhost", "127.0.0.1", "*.local"]
  }
}
```

### SOCKS 代理

```json
{
  "proxy": {
    "socks": "socks5://127.0.0.1:1080"
  }
}
```

### 环境变量

```bash
# 设置代理环境变量
export HTTP_PROXY="http://proxy.example.com:8080"
export HTTPS_PROXY="https://proxy.example.com:8080"
export NO_PROXY="localhost,127.0.0.1"
```

## 操作步骤

### 初始化系统配置

```bash
# 初始化全局配置
ccw config init --global

# 初始化项目配置
ccw config init

# 查看当前配置
ccw config show

# 验证配置
ccw config validate
```

### 添加新工具

```bash
# 编辑 cli-tools.json
code ~/.claude/cli-tools.json

# 添加新工具定义
{
  "tools": {
    "new-tool": {
      "enabled": true,
      "primaryModel": "model-name",
      "secondaryModel": "fallback-model",
      "tags": ["tag1", "tag2"],
      "type": "builtin"
    }
  }
}
```

### 配置 Hooks

```bash
# 编辑项目 settings.json
code .cw/settings.json

# 添加 prePrompt hook
{
  "hooks": {
    "prePrompt": [
      {
        "type": "command",
        "command": "ccw",
        "args": ["spec", "load", "--stdin"]
      }
    ]
  }
}
```

### 配置代理

```bash
# 编辑全局配置
code ~/.claude/settings.json

# 添加代理配置
{
  "proxy": {
    "http": "http://proxy.example.com:8080",
    "https": "https://proxy.example.com:8080"
  }
}
```

## 配置优先级

```
1. 环境变量 (最高)
2. settings.local.json
3. settings.json (项目)
4. settings.json (全局)
5. 默认值 (最低)
```

## 常见问题

### Q1: cli-tools.json 和 cli-settings.json 的区别？

A:
- **cli-tools.json**: 定义可用的工具（工具商店）
- **cli-settings.json**: 配置 CLI 的行为（偏好设置）

### Q2: Hooks 执行顺序？

A: 按数组顺序依次执行：
1. 数组前面的先执行
2. 失败会中断后续 Hook
3. 使用 `continueOnError: true` 忽略失败

### Q3: 如何调试配置？

A: 使用 debug 模式：

```bash
# 查看配置加载过程
ccw config show --debug

# 验证配置语法
ccw config validate

# 查看有效配置
ccw config effective
```

### Q4: 配置修改后不生效？

A: 检查：
1. 配置文件位置是否正确
2. JSON 语法是否正确
3. 配置优先级是否被覆盖
4. 是否需要重启服务

## 相关功能

- [API 设置](./api-settings.md) — API Keys 配置
- [CLI 调用系统](./cli.md) — CLI 工具使用
- [Spec 规范系统](./spec.md) — 规范文件配置

## 进阶阅读

- 配置加载器: `ccw/src/config/settings-loader.ts`
- CLI 工具管理: `ccw/src/tools/claude-cli-tools.ts`
- Hooks 执行: `ccw/src/core/hooks/hook-executor.ts`
- 代理处理: `ccw/src/utils/proxy-agent.ts`
