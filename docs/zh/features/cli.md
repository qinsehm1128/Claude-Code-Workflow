# CLI 调用系统

## 一句话定位

**CLI 调用系统是统一的多模型 AI 执行框架** — 一个命令调用多个 AI 工具 (Gemini、Qwen、Codex、Claude)，支持 analysis/write/review 模式，自动处理流式输出和错误恢复。

## 解决的痛点

| 痛点 | 现状 | CLI 调用系统方案 |
| --- | --- | --- |
| **多工具分散** | 不同 AI 工具命令格式不一致 | 统一 `ccw cli` 入口 |
| **模型切换困难** | 换模型要查文档记参数 | `--tool` + `--model` 简化切换 |
| **输出格式混乱** | 各工具输出格式不统一 | 统一 JSON Lines 流式输出 |
| **错误恢复缺失** | 工具失败只能手动重试 | 自动 fallback 到备用模型 |
| **上下文管理弱** | 多轮对话上下文不连贯 | Native Resume 自动管理 |

---

## 语义化调用（推荐）

::: tip 核心理念
CLI 工具是 **AI 自动调用的能力扩展**。用户只需用自然语言描述需求，AI 会自动选择并调用合适的工具。
:::

### 语义触发示例

只需在对话中自然表达，AI 会自动调用对应工具：

| 目标 | 用户语义描述 | AI 自动执行 |
| :--- | :--- | :--- |
| **代码分析** | "用 Gemini 分析 auth 模块的代码结构" | Gemini + 分析规则 |
| **安全审计** | "用 Gemini 扫描安全漏洞，重点关注 OWASP Top 10" | Gemini + 安全评估规则 |
| **代码实现** | "让 Qwen 实现一个带缓存的用户仓库" | Qwen + 功能实现规则 |
| **代码审查** | "用 Codex 审查这个 PR 的改动" | Codex + 审查规则 |
| **Bug 诊断** | "用 Gemini 分析这个内存泄漏的根因" | Gemini + 诊断规则 |

### 多模型协作模式

通过语义描述，可以让多个 AI 模型协同工作：

| 模式 | 描述方式 | 适用场景 |
| --- | --- | --- |
| **协作型** | "让 Gemini 和 Codex 共同分析架构问题" | 多角度分析同一问题 |
| **流水线型** | "Gemini 设计方案，Qwen 实现，Codex 审查" | 分阶段完成复杂任务 |
| **迭代型** | "用 Gemini 诊断问题，Codex 修复，迭代直到通过测试" | Bug 修复循环 |
| **并行型** | "让 Gemini 和 Qwen 分别给出优化建议" | 对比不同方案 |

### 协作示例

**流水线开发**
```
用户：我需要实现一个 WebSocket 实时通知功能。
      请 Gemini 设计架构，Qwen 实现代码，最后用 Codex 审查。
AI：[依次调用三个模型，完成设计→实现→审查流程]
```

**迭代修复**
```
用户：测试失败了，用 Gemini 诊断原因，让 Qwen 修复，循环直到测试通过。
AI：[自动迭代诊断-修复流程，直到问题解决]
```

---

## 底层命令参考

以下是 AI 自动调用时使用的底层命令，用户通常无需手动执行。

## 核心概念速览

| 概念 | 说明 | 示例 |
| --- | --- | --- |
| **Tool (工具)** | AI 执行端点 | `gemini`, `qwen`, `codex`, `claude`, `opencode` |
| **Mode (模式)** | 执行权限级别 | `analysis` (只读), `write` (读写), `review` (代码审查) |
| **Model (模型)** | 工具使用的具体模型 | `gemini-2.5-flash`, `gpt-5.2`, `coder-model` |
| **Fallback (备用)** | 主模型失败时的自动切换 | secondaryModel 配置 |
| **Resume (恢复)** | 多轮对话上下文管理 | `--resume` 参数 |
| **Session (会话)** | 命令执行的对话上下文 | Native UUID / 消息历史 |

## 使用场景

| 场景 | 推荐工具 | 推荐模式 |
| --- | --- | --- |
| **代码分析** | `gemini` / `qwen` | `analysis` |
| **代码生成** | `codex` / `gemini` | `write` |
| **代码审查** | `codex` | `review` |
| **架构设计** | `gemini` + `codex` 并行 | `analysis` |
| **Bug 调试** | `gemini` (分析) -> `codex` (修复) | `analysis` -> `write` |
| **文档生成** | `qwen` / `gemini` | `write` |

## 操作步骤

### 基础用法

```bash
# 分析代码（默认 analysis 模式）
ccw cli -p "分析 auth 模块的代码结构" --tool gemini

# 生成代码（write 模式）
ccw cli -p "创建一个 JWT 认证中间件" --tool codex --mode write

# 代码审查（review 模式，仅 codex）
ccw cli -p "审查本次提交的代码变更" --tool codex --mode review

# 指定模型
ccw cli -p "分析性能瓶颈" --tool gemini --model "gemini-2.5-pro" --mode analysis
```

### 从文件读取 Prompt

```bash
# 使用 -p @file 语法
ccw cli -p @prompt.txt --tool gemini

# 使用 -f 参数
ccw cli -f prompt.md --tool qwen --mode write
```

### 工作目录控制

```bash
# 在特定目录执行
ccw cli -p "分析当前项目" --tool gemini --cd /path/to/project

# 包含额外目录（用于跨项目分析）
ccw cli -p "分析 shared 和 current 项目的关系" \
  --tool gemini \
  --cd /path/to/current \
  --includeDirs /path/to/shared
```

### 多轮对话 (Resume)

```bash
# 启动新会话
ccw cli -p "设计一个用户认证系统" --tool gemini

# 继续上一轮对话
ccw cli -p "现在实现登录接口" --tool gemini --resume

# 继续指定会话
ccw cli -p "修改登录接口返回 JWT" --tool gemini --resume abc123-def456

# 合并多个会话上下文
ccw cli -p "整合之前的讨论" --tool gemini --resume abc123,def456
```

### 代码审查模式 (Codex 专用)

```bash
# 审查未提交的变更
ccw cli --tool codex --mode review

# 审查与指定分支的差异
ccw cli --tool codex --mode review --base main

# 审查指定提交
ccw cli --tool codex --mode review --commit abc123

# 带标题的审查
ccw cli -p "关注安全性问题" --tool codex --mode review --uncommitted
```

### 使用规则模板

```bash
# 加载预定义模板
ccw cli -p "分析代码安全性" \
  --tool gemini \
  --mode analysis \
  --rule analysis-assess-security-risks

# 查看可用模板
ccw cli --help
```

## 配置说明

### 配置文件结构

**全局配置**: `~/.claude/cli-tools.json`

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
    "codex": {
      "enabled": true,
      "primaryModel": "gpt-5.2",
      "secondaryModel": "gpt-5.2",
      "tags": [],
      "type": "builtin"
    }
  }
}
```

**设置文件**: `.cw/cli-settings.json`

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

### 工具类型 (Type)

| 类型 | 说明 | 可用模型 | 支持 |
| --- | --- | --- | --- |
| `builtin` | 内置 CLI 工具 | 完整模型列表 | 分析 + 写入 |
| `cli-wrapper` | Claude CLI 包装 | settings.json 中的模型 | 分析 + 写入 |
| `api-endpoint` | LiteLLM 端点 | 端点配置的模型 | **仅分析** |

### 标签 (Tags) 路由

标签用于工具选择和路由：

| 标签 | 说明 | 适用工具 |
| --- | --- | --- |
| `分析` | 代码分析、架构审查 | gemini, qwen |
| `Debug` | 调试、错误诊断 | gemini, qwen |
| `实现` | 代码生成、功能实现 | codex, gemini |

## 输出格式

### JSON Lines 流式输出

所有工具统一使用 JSON Lines 输出：

```json
{"type": "status", "message": "Connecting to API..."}
{"type": "delta", "content": "基于代码分析"}
{"type": "delta", "content": "，auth 模块包含以下组件"}
{"type": "usage", "prompt_tokens": 1000, "completion_tokens": 500}
{"type": "error", "message": "API timeout, retrying..."}
{"type": "done", "finish_reason": "stop"}
```

### 输出类型

| 类型 | 说明 |
| --- | --- |
| `status` | 状态更新 |
| `delta` | 内容增量 |
| `usage` | Token 使用量 |
| `error` | 错误信息 |
| `done` | 完成标记 |

## Dashboard 中的 CLI 终端

### 终端面板功能

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI 终端面板                             │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 工具选择: [gemini ▼] 模式: [analysis ▼] 模型: [...]  │ │
│  │ 目录: /path/to/project  包含: [shared]               │ │
│  └───────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Prompt 输入区 (支持多行)                              │ │
│  │ [执行] [规则模板] [恢复会话]                          │ │
│  └───────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 输出区 (流式显示，支持 Markdown 渲染)                │ │
│  │ - 代码高亮                                            │ │
│  │ - 错误高亮                                            │ │
│  │ - Token 统计                                          │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 功能按钮

- **工具选择**: 下拉选择可用工具
- **模式选择**: analysis / write / review
- **模型选择**: 工具可用模型列表
- **规则模板**: 快速加载预定义模板
- **恢复会话**: 选择历史会话继续

## 常见问题

### Q1: analysis 和 write 模式的区别？

A:
- **analysis**: 只读模式，AI 只能读取文件，不能创建/修改/删除
- **write**: 读写模式，AI 可以完整操作文件系统
- **review**: 仅 Codex 支持，Git 感知的代码审查模式

### Q2: 如何选择合适的工具？

A: 基于场景推荐：
- **代码分析/架构设计**: `gemini` (速度快，上下文大)
- **代码生成/Bug 修复**: `codex` (代码能力强)
- **中文任务**: `qwen` (中文优化)
- **长上下文**: `claude` (200K+ tokens)

### Q3: Fallback 机制如何工作？

A: 当主工具失败时：
1. 尝试 `secondaryModel` (同工具)
2. 尝试下一个启用的工具
3. 回退到默认工具

### Q4: 如何调试 CLI 调用？

A: 使用 `-d, --debug` 参数：

```bash
ccw cli -p "分析代码" --tool gemini -d
```

输出详细诊断信息，包括：
- 工具可用性检查
- 命令构建过程
- API 调用详情
- 错误堆栈

## 相关功能

- [Spec 规范系统](./spec.md) — 规范自动注入到 Prompt
- [Memory 记忆系统](./memory.md) — Resume 上下文管理
- [API 设置](./api-settings.md) — API Keys 配置
- [系统设置](./system-settings.md) — cli-tools.json 配置

## 进阶阅读

- CLI 执行核心: `ccw/src/tools/cli-executor-core.ts`
- CLI 工具管理: `ccw/src/tools/claude-cli-tools.ts`
- 命令路由: `ccw/src/commands/cli.ts`
- 前端终端: `ccw/frontend/src/components/terminal-dashboard/`
