# Claude Commands

## 一句话定位

**Claude Commands 是 Claude_dms3 的核心命令系统** — 通过斜杠命令调用各种工作流、工具和协作功能。

## 核心概念速览

| 类别 | 命令数量 | 功能说明 |
| --- | --- | --- |
| **核心编排** | 2 | 主工作流编排器 (ccw, ccw-coordinator) |
| **工作流** | 20+ | 规划、执行、审查、TDD、测试等工作流 |
| **会话管理** | 6 | 会话创建、列表、恢复、完成等 |
| **Issue 工作流** | 7 | Issue 发现、规划、队列、执行 |
| **Memory** | 8 | 记忆捕获、更新、文档生成 |
| **CLI 工具** | 2 | CLI 初始化、Codex 审查 |
| **UI 设计** | 10 | UI 设计原型生成、样式提取 |

## 命令分类

### 1. 核心编排命令

| 命令 | 功能 | 难度 |
| --- | --- | --- |
| [`/ccw`](./core-orchestration.md#ccw) | 主工作流编排器 - 意图分析→工作流选择→命令链执行 | Intermediate |
| [`/ccw-coordinator`](./core-orchestration.md#ccw-coordinator) | 命令编排工具 - 链式命令执行和状态持久化 | Intermediate |

### 2. 工作流命令

| 命令 | 功能 | 难度 |
| --- | --- | --- |
| [`/workflow-lite-planex`](./workflow.md#lite-plan) | 轻量级交互式规划工作流 | Intermediate |
| [`/workflow:lite-fix`](./workflow.md#lite-fix) | 轻量级 Bug 诊断和修复 | Intermediate |
| [`/workflow-plan`](./workflow.md#plan) | 5 阶段规划工作流 | Intermediate |
| [`/workflow-execute`](./workflow.md#execute) | 协调代理执行工作流任务 | Intermediate |
| [`/workflow:replan`](./workflow.md#replan) | 交互式工作流重新规划 | Intermediate |
| [`/workflow-multi-cli-plan`](./workflow.md#multi-cli-plan) | 多 CLI 协作规划 | Intermediate |
| [`/workflow:review`](./workflow.md#review) | 实现后审查 | Intermediate |
| [`/workflow:clean`](./workflow.md#clean) | 智能代码清理 | Intermediate |
| [`/workflow:init`](./workflow.md#init) | 初始化项目状态 | Intermediate |
| [`/workflow:brainstorm-with-file`](./workflow.md#brainstorm-with-file) | 交互式头脑风暴 | Intermediate |
| [`/workflow:analyze-with-file`](./workflow.md#analyze-with-file) | 交互式协作分析 | Beginner |
| [`/workflow:debug-with-file`](./workflow.md#debug-with-file) | 交互式假设驱动调试 | Intermediate |
| [`/workflow:unified-execute-with-file`](./workflow.md#unified-execute-with-file) | 通用执行引擎 | Intermediate |

### 3. 会话管理命令

| 命令 | 功能 | 难度 |
| --- | --- | --- |
| [`/workflow:session:start`](./session.md#start) | 发现现有会话或启动新工作流会话 | Intermediate |
| [`/workflow:session:list`](./session.md#list) | 列出所有工作流会话 | Beginner |
| [`/workflow:session:resume`](./session.md#resume) | 恢复最近暂停的工作流会话 | Intermediate |
| [`/workflow:session:complete`](./session.md#complete) | 标记活动工作流会话为完成 | Intermediate |
| [`/workflow:session:solidify`](./session.md#solidify) | 将会话学习结晶为项目指南 | Intermediate |

### 4. Issue 工作流命令

| 命令 | 功能 | 难度 |
| --- | --- | --- |
| [`/issue:new`](./issue.md#new) | 从 GitHub URL 或文本描述创建结构化 Issue | Intermediate |
| [`/issue:discover`](./issue.md#discover) | 从多个角度发现潜在 Issue | Intermediate |
| [`/issue:discover-by-prompt`](./issue.md#discover-by-prompt) | 通过用户提示发现 Issue | Intermediate |
| [`/issue:plan`](./issue.md#plan) | 批量规划 Issue 解决方案 | Intermediate |
| [`/issue:queue`](./issue.md#queue) | 形成执行队列 | Intermediate |
| [`/issue:execute`](./issue.md#execute) | 执行队列 | Intermediate |
| [`/issue:convert-to-plan`](./issue.md#convert-to-plan) | 转换规划工件为 Issue 解决方案 | Intermediate |

### 5. Memory 命令

| 命令 | 功能 | 难度 |
| --- | --- | --- |
| [`/memory:compact`](./memory.md#compact) | 压缩当前会话记忆为结构化文本 | Intermediate |
| [`/memory:tips`](./memory.md#tips) | 快速笔记记录 | Beginner |
| [`/memory:load`](./memory.md#load) | 通过 CLI 分析项目加载任务上下文 | Intermediate |
| [`/memory:update-full`](./memory.md#update-full) | 更新所有 CLAUDE.md 文件 | Intermediate |
| [`/memory:update-related`](./memory.md#update-related) | 更新 git 变更模块的 CLAUDE.md | Intermediate |
| [`/memory:docs-full-cli`](./memory.md#docs-full-cli) | 使用 CLI 生成完整项目文档 | Intermediate |
| [`/memory:docs-related-cli`](./memory.md#docs-related-cli) | 生成 git 变更模块文档 | Intermediate |
| [`/memory:style-skill-memory`](./memory.md#style-skill-memory) | 从样式参考生成 SKILL 记忆包 | Intermediate |

### 6. CLI 工具命令

| 命令 | 功能 | 难度 |
| --- | --- | --- |
| [`/cli:cli-init`](./cli.md#cli-init) | 生成配置目录和设置文件 | Intermediate |
| [`/cli:codex-review`](./cli.md#codex-review) | 使用 Codex CLI 进行交互式代码审查 | Intermediate |

### 7. UI 设计命令

| 命令 | 功能 | 难度 |
| --- | --- | --- |
| [`/workflow:ui-design:explore-auto`](./ui-design.md#explore-auto) | 交互式探索性 UI 设计工作流 | Intermediate |
| [`/workflow:ui-design:imitate-auto`](./ui-design.md#imitate-auto) | 直接代码/图片输入的 UI 设计 | Intermediate |
| [`/workflow:ui-design:style-extract`](./ui-design.md#style-extract) | 从参考图片或提示提取设计样式 | Intermediate |
| [`/workflow:ui-design:layout-extract`](./ui-design.md#layout-extract) | 从参考图片提取布局信息 | Intermediate |
| [`/workflow:ui-design:animation-extract`](./ui-design.md#animation-extract) | 提取动画和过渡模式 | Intermediate |
| [`/workflow:ui-design:codify-style`](./ui-design.md#codify-style) | 从代码提取样式并生成可共享引用包 | Intermediate |
| [`/workflow:ui-design:generate`](./ui-design.md#generate) | 组合布局模板与设计令牌生成原型 | Intermediate |

## 自动模式

大多数命令支持 `--yes` 或 `-y` 标志，启用自动模式后跳过确认步骤。

```bash
# 标准模式 - 需要确认
/ccw "实现用户认证"

# 自动模式 - 跳过确认直接执行
/ccw "实现用户认证" --yes
```

## 相关文档

- [Skills 参考](../skills/)
- [CLI 调用系统](../features/cli.md)
- [工作流指南](../guide/ch04-workflow-basics.md)
