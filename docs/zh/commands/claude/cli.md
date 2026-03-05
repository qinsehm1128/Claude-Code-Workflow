# CLI 工具命令

## 一句话定位

**CLI 工具命令是外部模型调用的桥梁** — 整合 Gemini、Qwen、Codex 等多模型能力到工作流中。

## 核心概念速览

| 概念 | 说明 | 配置 |
| --- | --- | --- |
| **CLI 工具** | 外部 AI 模型调用接口 | `cli-tools.json` |
| **端点** | 可用的模型服务 | gemini, qwen, codex, claude |
| **模式** | analysis / write / review | 权限级别 |

## 命令列表

| 命令 | 功能 | 语法 |
| --- | --- | --- |
| [`cli-init`](#cli-init) | 生成配置目录和设置文件 | `/cli:cli-init [--tool gemini\|qwen\|all] [--output path] [--preview]` |
| [`codex-review`](#codex-review) | 使用 Codex CLI 进行交互式代码审查 | `/cli:codex-review [--uncommitted\|--base <branch>\|--commit <sha>] [prompt]` |

## 命令详解

### cli-init

**功能**: 根据工作空间技术检测生成 `.gemini/` 和 `.qwen/` 配置目录，包含 settings.json 和 ignore 文件。

**语法**:
```bash
/cli:cli-init [--tool gemini|qwen|all] [--output path] [--preview]
```

**选项**:
- `--tool=工具`: gemini, qwen 或 all
- `--output=路径`: 输出目录
- `--preview`: 预览模式（不实际创建）

**生成的文件结构**:
```
.gemini/
├── settings.json      # Gemini 配置
└── ignore            # 忽略模式

.qwen/
├── settings.json      # Qwen 配置
└── ignore            # 忽略模式
```

**技术检测**:

| 检测项 | 生成配置 |
| --- | --- |
| TypeScript | tsconfig 相关配置 |
| React | React 特定配置 |
| Vue | Vue 特定配置 |
| Python | Python 特定配置 |

**示例**:
```bash
# 初始化所有工具
/cli:cli-init --tool all

# 初始化特定工具
/cli:cli-init --tool gemini

# 指定输出目录
/cli:cli-init --output ./configs

# 预览模式
/cli:cli-init --preview
```

### codex-review

**功能**: 使用 Codex CLI 通过 ccw 端点进行交互式代码审查，支持可配置的审查目标、模型和自定义指令。

**语法**:
```bash
/cli:codex-review [--uncommitted|--base <branch>|--commit <sha>] [--model <model>] [--title <title>] [prompt]
```

**选项**:
- `--uncommitted`: 审查未提交的更改
- `--base <分支>`: 与分支比较
- `--commit <sha>`: 审查特定提交
- `--model <模型>`: 指定模型
- `--title <标题>`: 审查标题

**注意**: 目标标志和 prompt 是互斥的

**示例**:
```bash
# 审查未提交的更改
/cli:codex-review --uncommitted

# 与主分支比较
/cli:codex-review --base main

# 审查特定提交
/cli:codex-review --commit abc123

# 带自定义指令
/cli:codex-review --uncommitted "关注安全性问题"

# 指定模型和标题
/cli:codex-review --model gpt-5.2 --title "认证模块审查"
```

## CLI 工具配置

### cli-tools.json 结构

```json
{
  "version": "3.3.0",
  "tools": {
    "gemini": {
      "enabled": true,
      "primaryModel": "gemini-2.5-flash",
      "secondaryModel": "gemini-2.5-flash",
      "tags": ["分析", "Debug"],
      "type": "builtin"
    },
    "qwen": {
      "enabled": true,
      "primaryModel": "coder-model",
      "tags": [],
      "type": "builtin"
    },
    "codex": {
      "enabled": true,
      "primaryModel": "gpt-5.2",
      "tags": [],
      "type": "builtin"
    }
  }
}
```

### 模式说明

| 模式 | 权限 | 用途 |
| --- | --- | --- |
| `analysis` | 只读 | 代码审查、架构分析、模式发现 |
| `write` | 创建/修改/删除 | 功能实现、Bug 修复、文档创建 |
| `review` | Git 感知代码审查 | 审查未提交更改、分支差异、特定提交 |

## 相关文档

- [CLI 调用系统](../../features/cli.md)
- [核心编排](./core-orchestration.md)
- [工作流命令](./workflow.md)
