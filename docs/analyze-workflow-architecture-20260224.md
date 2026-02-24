# CCW (Claude-Code-Workflow) 工作流架构深度分析

> 分析日期：2026-02-24
> 范围：任务规划、文档产出、上下文压缩、记忆系统、项目生命周期

---

## 目录

1. [整体架构概览](#1-整体架构概览)
2. [任务规划与文档产出体系](#2-任务规划与文档产出体系)
3. [.workflow 目录的内容积累机制](#3-workflow-目录的内容积累机制)
4. [上下文压缩满额问题：根因分析](#4-上下文压缩满额问题根因分析)
5. [记忆系统架构](#5-记忆系统架构)
6. [记忆是否全量加载？](#6-记忆是否全量加载)
7. [项目 0→1 和 1→N 的生命周期](#7-项目-01-和-1n-的生命周期)
8. [优化建议](#8-优化建议)

---

## 1. 整体架构概览

CCW 是一个多层架构系统，核心由以下层级构成：

```
┌──────────────────────────────────────────────────┐
│  Layer 1: CLAUDE.md + @ 引用文件                  │  ← 启动时自动加载
│  (coding-philosophy.md, cli-tools-usage.md, ...)  │
├──────────────────────────────────────────────────┤
│  Layer 2: Skills 技能层                           │  ← 按需加载 (用户触发)
│  (20+ skills, 每个含 SKILL.md + phases/*.md)      │
├──────────────────────────────────────────────────┤
│  Layer 3: Commands 命令层                         │  ← 按需加载 (用户触发)
│  (71+ commands in .claude/commands/)              │
├──────────────────────────────────────────────────┤
│  Layer 4: Agents 执行层                           │  ← 由 Task() 调用时加载
│  (21 agent definitions in .claude/agents/)        │
├──────────────────────────────────────────────────┤
│  Layer 5: .workflow/ 持久化层                      │  ← 按需读取
│  (sessions, tasks, brainstorming, reviews, ...)   │
├──────────────────────────────────────────────────┤
│  Layer 6: CLI Templates + Schemas                 │  ← 按需读取
│  (.ccw/workflows/cli-templates/)                  │
└──────────────────────────────────────────────────┘
```

### 关键文件体量估计

| 文件/目录 | 估计行数 | 加载时机 |
|-----------|---------|---------|
| `.claude/CLAUDE.md` | ~45 行 | **启动时自动加载** |
| `@~/.ccw/workflows/coding-philosophy.md` | ~70 行 | **启动时 @ 引用加载** |
| `@~/.ccw/workflows/cli-tools-usage.md` | ~539 行 | **启动时 @ 引用加载** |
| `@~/.ccw/workflows/context-tools.md` | ~77 行 | **启动时 @ 引用加载** |
| `@~/.ccw/workflows/file-modification.md` | 未知 | **启动时 @ 引用加载** |
| `@~/.claude/cli-tools.json` | 未知 | **启动时 @ 引用加载** |
| Skills SKILL.md (每个) | 50-250 行 | 用户触发技能时 |
| Skills phases/*.md (每个) | 100-300 行 | 技能执行时按需加载 |
| Agents *.md (每个) | 30-100 行 | Task() 调用时 |
| `.workflow/` 各类产出 | 数千-数万行 | 执行器读取时 |

---

## 2. 任务规划与文档产出体系

### 2.1 规划流程链

CCW 的任务规划是一个多阶段管道：

```
用户需求
    │
    ├─ /workflow:plan (5阶段标准规划)
    │   ├─ Phase 1: Session Discovery → workflow-session.json
    │   ├─ Phase 2: Context Gathering → context-package.json
    │   ├─ Phase 3: Conflict Resolution (可选)
    │   ├─ Phase 4: Task Generation → IMPL_PLAN.md + IMPL-*.json + TODO_LIST.md
    │   └─ 完成: 产出 .task/ 目录下所有任务文件
    │
    ├─ /workflow:lite-plan (轻量规划)
    │   └─ 内存中规划 → 直接执行
    │
    ├─ /workflow:multi-cli-plan (多CLI协作规划)
    │   └─ Gemini + Qwen 交叉验证 → 综合方案
    │
    └─ /brainstorm (头脑风暴)
        ├─ 多角色并行分析 (系统架构师/产品经理/UX专家/...)
        └─ 产出 .brainstorming/ 目录文件
```

### 2.2 每次规划产出的文件

一次完整的 `/workflow:plan` 执行，会在 `.workflow/active/WFS-{topic}/` 下产出：

```
WFS-topic-slug/
├── workflow-session.json          # 会话元数据 (~20-50 行 JSON)
├── IMPL_PLAN.md                   # 实施计划 (~100-500 行)
├── TODO_LIST.md                   # 进度追踪 (~30-100 行)
├── .task/                         # 任务定义
│   ├── IMPL-1.json               # 每个任务 (~50-200 行 JSON)
│   ├── IMPL-1.1.json
│   ├── IMPL-2.json
│   └── ...
├── .process/                      # 分析产物
│   ├── context-package.json       # 上下文包 (~200-500 行)
│   └── ANALYSIS_RESULTS.md        # 分析结果
├── .brainstorming/                # 头脑风暴 (可选)
│   ├── guidance-specification.md
│   └── role-analysis-*.md         # 每个角色的分析文档
├── .chat/                         # CLI 交互记录
│   ├── chat-analysis-*.md
│   └── analysis-*.md
└── .summaries/                    # 完成摘要
    └── IMPL-*-summary.md
```

### 2.3 任务 JSON 核心结构

每个任务文件 (`IMPL-*.json`) 遵循统一的 6 字段 Schema：

```
{
  "id":             → 任务标识 (IMPL-N 或 IMPL-N.M)
  "title":          → 任务标题
  "status":         → pending | active | completed | blocked | container
  "meta":           → 类型 + 执行代理
  "context":        → 需求/路径/依赖/继承上下文/制品引用
  "flow_control":   → pre_analysis + implementation_approach + target_files
}
```

关键特点：
- **JSON 是唯一的权威数据源**，所有 Markdown 文档都是只读的生成视图
- **最大 2 层深度**：IMPL-N（主任务）和 IMPL-N.M（子任务）
- **10 个任务硬上限**：超过需重新划分迭代范围
- **flow_control**：包含完整的执行步骤链，支持变量引用 `[variable_name]`

---

## 3. .workflow 目录的内容积累机制

### 3.1 积累来源

内容积累发生在多个维度：

| 积累维度 | 存储位置 | 增长速度 |
|----------|---------|---------|
| **任务定义** | `.task/IMPL-*.json` | 每次规划新增 3-10 个文件 |
| **执行摘要** | `.summaries/IMPL-*-summary.md` | 每完成一个任务新增 1 个 |
| **CLI 交互** | `.chat/chat-*.md, analysis-*.md` | 每次 CLI 调用新增 1 个 |
| **分析产物** | `.process/context-package.json` | 每次规划覆写 |
| **头脑风暴** | `.brainstorming/*.md` | 每个角色分析 1 个文件 |
| **代码审查** | `.review/*.json, *.md` | 每次审查多个维度 |
| **非会话输出** | `.scratchpad/*.md` | 每次 ad-hoc 分析 1 个 |
| **项目技术分析** | `project-tech.json` | 初始化 1 次 |
| **项目指南** | `project-guidelines.json` | 初始化 + 增量更新 |

### 3.2 关键问题：内容只增不减

```
.workflow/ 的增长模式:

时间 →
     Session 1     Session 2     Session 3     Session N
     ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐
     │ 5 tasks│    │ 8 tasks│    │ 6 tasks│    │ 7 tasks│
     │ 3 chats│    │ 5 chats│    │ 4 chats│    │ 6 chats│
     │ 2 brain│    │ 4 brain│    │ 3 brain│    │ 5 brain│
     └────────┘    └────────┘    └────────┘    └────────┘
         │              │              │              │
         └──────────────┴──────────────┴──────────────┘
                               ↓
                    .workflow/ 持续膨胀
                    (active/ + archives/ 都保留)
```

**archives/ 目录**：已完成的会话被移动到 archives/，但不会被删除，文件持续积累。

---

## 4. 上下文压缩满额问题：根因分析

### 4.1 问题描述

当调用 CLI (`ccw cli -p "..." --tool gemini`) 时，特别是在有大量 .workflow 内容积累后，容易出现上下文窗口满额/压缩的情况。

### 4.2 根本原因

**原因 1：CLAUDE.md 的 @ 引用全量加载**

```
.claude/CLAUDE.md 引用了 5+ 个外部文件：
  @~/.ccw/workflows/coding-philosophy.md     → ~70 行
  @~/.ccw/workflows/cli-tools-usage.md       → ~539 行
  @~/.ccw/workflows/context-tools.md         → ~77 行
  @~/.ccw/workflows/file-modification.md     → 未知
  @~/.claude/cli-tools.json                  → 未知

这些文件在每次启动 Claude Code 时都会被加载到初始上下文中。
仅 cli-tools-usage.md 就有 539 行，占用相当的 token 空间。
```

**原因 2：技能/命令的级联加载**

一次典型的 `/workflow:plan` 执行：
1. 加载 `workflow-plan/SKILL.md` (~130 行)
2. 触发 Phase 1: 加载 `session/start.md` (~100 行)
3. 触发 Phase 2: 加载 `tools/context-gather.md` (~150 行)
4. 触发 Phase 3: 加载 `tools/conflict-resolution.md` (~100 行)
5. 触发 Phase 4: 加载 `tools/task-generate-agent.md` (~200 行)
6. 最终 agent 还需要加载: `workflow-architecture.md` (942 行!) + `task-core.md` (210 行)

**单次规划流程可能加载 ~2000+ 行的指令文档**，这还不包括实际的代码文件读取。

**原因 3：CLI 调用时的上下文注入**

`ccw cli` 命令的 Prompt Template 结构要求注入大量上下文：

```
PURPOSE:  [目标描述]
TASK:     [具体步骤]
MODE:     [analysis|write]
CONTEXT:  @[file patterns] | Memory: [历史记忆]  ← 这里可能包含大量文件
EXPECTED: [期望输出]
CONSTRAINTS: [约束条件]
```

当使用 `@**/*` (全量上下文) 时，所有项目文件都会被注入。

**原因 4：flow_control 的 pre_analysis 累积**

任务 JSON 中的 `flow_control.pre_analysis` 步骤会逐步读取文件并累积变量：

```json
pre_analysis: [
  { step: "load_context",      output_to: "project_structure" },   // 读取一批文件
  { step: "load_role_analyses", output_to: "role_analyses" },       // 读取头脑风暴文件
  { step: "load_codebase",      output_to: "codebase_structure" }  // 搜索代码
]
```

每个步骤的输出都被保留在上下文中，**上下文只增不减**。

**原因 5：多代理调用的上下文膨胀**

CCW 使用 Task() 调用子代理：
- 每个子代理会获得完整的任务 JSON + 工作流上下文
- 子代理读取的文件内容会累积在当前会话中
- 代理返回的结果也会被加入上下文

### 4.3 上下文压力定量估计

```
典型一次 /workflow:plan 的上下文消耗:

基础层 (启动加载):
  CLAUDE.md + @ 引用             → ~800 行 ≈ 4000 tokens
  System instructions             → ~2000 tokens

规划层 (技能加载):
  SKILL.md + 4 个 phase docs     → ~700 行 ≈ 3500 tokens
  workflow-architecture.md        → ~942 行 ≈ 5000 tokens
  task-core.md                    → ~210 行 ≈ 1000 tokens

执行层 (文件读取 + CLI):
  context-package.json 生成       → ~500 行 ≈ 2500 tokens
  代码文件读取 (focus_paths)      → ~1000-5000 行 ≈ 5000-25000 tokens
  CLI 调用响应                    → ~500-2000 行 ≈ 2500-10000 tokens

产出层 (写入操作):
  IMPL_PLAN.md 生成              → ~200 行 ≈ 1000 tokens
  IMPL-*.json 生成 (5-10个)       → ~1000 行 ≈ 5000 tokens
  TODO_LIST.md 生成              → ~50 行 ≈ 250 tokens

──────────────────────────────────────
总计估算:                         ≈ 30,000 - 60,000 tokens (单次规划)
```

Claude 的上下文窗口约 200K tokens。当多轮对话累积 + 多个 CLI 调用后，很容易达到压缩阈值。

---

## 5. 记忆系统架构

### 5.1 两套并行的记忆系统

CCW 拥有两套不同层面的记忆系统：

#### 系统 A：MCP core_memory（应用层记忆）

```
核心组件:
├── CoreMemoryStore (SQLite)
│   路径: ~/.storage/projects/{projectId}/core-memory/core_memory.db
│   表: core_memories, session_clusters, stage1_outputs, jobs, memory_chunks
│
├── MemoryExtractionPipeline (Phase 1)
│   触发: 启动时自动扫描符合条件的历史会话
│   作用: 从 CLI 历史记录中提取结构化记忆
│   配置: MAX_SESSIONS=64, CONCURRENCY=64, MAX_AGE=30天, IDLE=12h
│
├── MemoryConsolidationPipeline (Phase 2)
│   触发: Phase 1 完成后
│   作用: 将所有提取结果合并为全局 MEMORY.md
│   产出: rollout_summaries/*.md + raw_memories.md + MEMORY.md
│
├── MemoryEmbedderBridge
│   作用: 语义搜索支持
│   后端: Python (CodexLens venv)
│   操作: embed, search, status
│
└── MemoryJobScheduler
    作用: 基于租约的分布式任务调度
    确保: 单进程执行 + 原子操作
```

存储路径：
```
~/.storage/projects/{projectId}/
├── core-memory/
│   ├── core_memory.db           ← SQLite 主数据库
│   ├── rollout_summaries/*.md   ← Phase 1 提取结果
│   ├── raw_memories.md          ← 合并的原始记忆
│   └── MEMORY.md                ← 最终整理的记忆文档
└── memory/
    └── memory.db                ← 遗留记忆存储
```

**这些记忆数据完全存储在本地文件系统中**，以 SQLite 数据库 + Markdown 文件的形式保存。

#### 系统 B：CLAUDE.md 分层记忆（代码记忆）

```
记忆管理技能 (/memory-manage):
├── update-full:     全量更新所有模块的 CLAUDE.md
│   策略: 3层架构 (Layer 3→2→1) bottom-up
│   工具: gemini/qwen/codex CLI 分析每个模块
│
├── update-related:  增量更新变更模块
│   策略: git diff → 变更模块 + 父级
│
└── update-single:   单模块深度更新
    策略: Explore 分析 → 手册式文档

产出: 每个模块目录下的 CLAUDE.md 文件
格式: 6个标准段落 (Purpose, Structure, Components, Dependencies, Integration, Notes)
```

#### 系统 C：会话记忆捕获（/memory-capture）

```
├── Compact 模式: 压缩完整会话为结构化文本
│   提取: sessionId, objective, executionPlan, workingFiles,
│         decisions, constraints, knownIssues, pending
│   存储: → core_memory import → 获得 Recovery ID
│
└── Tips 模式: 快速记录想法/片段
    提取: content, tags, context
    存储: → core_memory import → 获得 Tip ID
```

### 5.2 记忆存储本质

**所有记忆都存储在本地文件中：**

| 记忆类型 | 存储形式 | 路径 |
|----------|---------|------|
| 核心记忆 | SQLite DB | `~/.storage/projects/{id}/core-memory/core_memory.db` |
| 遗留记忆 | SQLite DB | `~/.storage/projects/{id}/memory/memory.db` |
| 记忆摘要 | Markdown | `~/.storage/projects/{id}/core-memory/rollout_summaries/*.md` |
| 全局记忆 | Markdown | `~/.storage/projects/{id}/core-memory/MEMORY.md` |
| 原始记忆 | Markdown | `~/.storage/projects/{id}/core-memory/raw_memories.md` |
| 模块记忆 | Markdown | 每个模块目录下的 `CLAUDE.md` |
| CLI 历史 | SQLite DB | CLI history store |
| 工作流产出 | JSON/MD | `.workflow/active/WFS-*/` |

---

## 6. 记忆是否全量加载？

### 6.1 启动时的加载行为

**不是全量加载，但初始负载不小。** Claude Code 启动时的加载链：

```
启动加载链:
1. 读取 .claude/CLAUDE.md                              ← 必须加载
2. 解析 @ 引用，加载引用的外部文件:
   ├── @~/.ccw/workflows/coding-philosophy.md           ← ~70行
   ├── @~/.ccw/workflows/cli-tools-usage.md             ← ~539行
   ├── @~/.ccw/workflows/context-tools.md               ← ~77行
   ├── @~/.ccw/workflows/file-modification.md           ← 未知
   └── @~/.claude/cli-tools.json                        ← 未知
3. 加载系统 prompt (Claude Code 内置指令)               ← ~2000 tokens
4. 注入 available skills 列表                           ← 当前列表约 100+ 条

以上在每个新对话开始时都会执行。
```

**注意**：
- Skills 的 SKILL.md 和 phases/*.md **不会**在启动时加载，只在用户触发技能时按需加载
- Commands 的 .md 文件 **不会**在启动时加载，只在用户执行命令时加载
- Agents 的 .md 文件 **不会**在启动时加载，只在 Task() 调用时注入给子代理
- `.workflow/` 下的文件 **不会**在启动时加载，只在工作流执行时按需读取
- `core_memory` 的 SQLite 内容 **不会**在启动时全量加载，而是通过 MCP 工具按需搜索/读取

### 6.2 按需加载的触发点

```
触发 → 加载 的映射:

用户说 "/workflow:plan"
  → 加载 .claude/skills/workflow-plan/SKILL.md
  → 执行 Phase 1: 加载 session/start.md
  → 执行 Phase 2: 加载 tools/context-gather.md
  → ...每个 phase 独立加载

用户说 "/memory-capture compact"
  → 加载 .claude/skills/memory-capture/SKILL.md
  → 路由到 Compact
  → 加载 phases/01-compact.md

代理被调用 Task(subagent_type="code-developer", ...)
  → 子进程加载 .claude/agents/code-developer.md
  → 子进程独立上下文，不污染主对话
```

### 6.3 MEMORY.md 和 core_memory 的加载

- **MEMORY.md** 是全局整理后的记忆文档，存储在 `~/.storage/projects/{id}/core-memory/MEMORY.md`
- 它 **不会自动加载**。需要通过以下方式访问：
  - MCP 工具：`mcp__ccw-tools__core_memory({ operation: "search", query: "..." })`
  - CLI：`ccw core-memory export --id <CMEM-ID>`
  - 手动恢复：用户说 "Please import memory <ID>"

---

## 7. 项目 0→1 和 1→N 的生命周期

### 7.1 0→1 阶段（从零到一）

CCW 为全新项目提供了完整的 0→1 工作流：

```
阶段 0: 项目初始化
┌─────────────────────────────────────────────┐
│  /workflow:init                              │
│  ├── cli-explore-agent 深度分析项目           │
│  ├── 生成 .workflow/project-tech.json        │
│  │   (技术栈、架构、组件、统计)               │
│  ├── 生成 .workflow/project-guidelines.json   │
│  │   (编码约定、约束、质量规则的脚手架)        │
│  └── 可选: /workflow:init-guidelines          │
│      (交互式问答填充指南)                      │
└─────────────────────────────────────────────┘
          ↓
阶段 1: 规格生成 (产品定义)
┌─────────────────────────────────────────────┐
│  /spec-generator                             │
│  ├── Phase 1: Discovery (发现+种子分析)       │
│  │   → spec-config.json + discovery-context   │
│  ├── Phase 2: Product Brief (产品简报)        │
│  │   → product-brief.md                      │
│  │   (3个CLI并行: 产品视角/技术视角/用户视角)  │
│  ├── Phase 3: Requirements/PRD (需求文档)     │
│  │   → requirements/ (REQ-*.md + NFR-*.md)   │
│  ├── Phase 4: Architecture (架构决策)         │
│  │   → architecture/ (ADR-*.md)              │
│  ├── Phase 5: Epics & Stories (史诗/用户故事)  │
│  │   → epics/ (EPIC-*.md + 依赖图)           │
│  └── Phase 6: Readiness Check (就绪检查)      │
│      → readiness-report.md + spec-summary.md  │
└─────────────────────────────────────────────┘
          ↓
阶段 2: 任务规划
┌─────────────────────────────────────────────┐
│  /workflow:plan 或 /workflow:lite-plan        │
│  ├── 自动创建 WFS 会话                       │
│  ├── 上下文收集 + 冲突检测                    │
│  ├── 任务分解 → IMPL_PLAN.md                 │
│  └── 任务 JSON 生成 → .task/IMPL-*.json      │
└─────────────────────────────────────────────┘
          ↓
阶段 3: 执行
┌─────────────────────────────────────────────┐
│  /workflow:execute                            │
│  ├── 自动发现会话 + 待执行任务                 │
│  ├── 按依赖顺序分配代理:                      │
│  │   @code-developer → 实现代码                │
│  │   @test-fix-agent → 测试修复                │
│  ├── 每个任务完成后生成 summary                │
│  └── 更新 TODO_LIST.md 进度                   │
└─────────────────────────────────────────────┘
          ↓
阶段 4: 验证
┌─────────────────────────────────────────────┐
│  /workflow:review-session-cycle               │
│  ├── 7维度代码审查                            │
│  │   (正确性/可读性/性能/安全/测试/架构/...)    │
│  └── 生成 REVIEW-SUMMARY.md                  │
└─────────────────────────────────────────────┘
```

**关键文档链条：**
```
spec-config.json
  → product-brief.md
    → requirements/ (REQ-*.md)
      → architecture/ (ADR-*.md)
        → epics/ (EPIC-*.md)
          → .brainstorming/guidance-specification.md (桥接)
            → IMPL_PLAN.md + .task/IMPL-*.json (执行计划)
```

### 7.2 1→N 阶段（迭代增长）

已有项目的迭代开发流程：

```
日常迭代流程:

1. 需求输入
   ├── /workflow:lite-plan "新功能描述"     ← 轻量级
   ├── /workflow:plan "详细需求"            ← 标准流程
   ├── /brainstorm "复杂问题"              ← 需要多角色分析
   └── /issue:new "bug描述"                ← 问题驱动

2. 执行
   ├── /workflow:execute                    ← 自动执行
   └── /workflow:lite-execute               ← 轻量执行

3. 质量保证
   ├── /workflow:review-session-cycle       ← 会话级审查
   ├── /workflow:review-module-cycle        ← 模块级审查
   └── /workflow:test-fix                   ← 测试修复循环

4. 记忆更新
   ├── /memory-manage update-related        ← 增量更新 CLAUDE.md
   ├── /memory-capture compact              ← 保存会话记忆
   └── /workflow:session:solidify           ← 固化经验到指南

5. 会话管理
   ├── /workflow:session:complete           ← 完成 → 归档
   └── /workflow:session:list               ← 查看所有会话
```

### 7.3 基座项目结构文件

项目初始化和持续维护依赖以下基座文件：

```
基座文件 (项目级):
├── .workflow/project-tech.json          ← 技术分析 (自动生成)
│   内容: 技术栈、架构风格、关键组件、特性索引、统计
│
├── .workflow/project-guidelines.json    ← 项目指南 (交互式配置)
│   内容: 编码约定、命名规范、架构约束、性能/安全要求、质量规则
│
├── .claude/CLAUDE.md                    ← 全局指令
│   内容: 引用 coding-philosophy, cli-tools-usage 等
│
└── 各模块的 CLAUDE.md                   ← 模块级记忆
    内容: 模块目的、结构、组件、依赖、集成点

基座文件 (CCW 框架级):
├── .ccw/workflows/workflow-architecture.md  ← 工作流架构定义
├── .ccw/workflows/task-core.md              ← 任务系统核心
├── .ccw/workflows/coding-philosophy.md      ← 编码理念
├── .ccw/workflows/cli-tools-usage.md        ← CLI 工具规范
├── .ccw/workflows/context-tools.md          ← 上下文工具优先级
├── .ccw/workflows/file-modification.md      ← 文件修改策略
└── .ccw/workflows/cli-templates/            ← 模板库
    ├── schemas/ (23个 JSON Schema)
    ├── prompts/ (66个提示模板)
    ├── planning-roles/ (10个规划角色)
    └── tech-stacks/ (6个技术栈模板)
```

---

## 8. 优化建议

### 8.1 上下文压缩问题的优化方案

#### 方案 A：@ 引用文件精简

**问题**：`cli-tools-usage.md` 有 539 行，每次启动都全量加载。

**建议**：
1. 将 `cli-tools-usage.md` 拆分为 `cli-tools-quick-ref.md` (~50行核心) + `cli-tools-full.md` (~500行完整版)
2. CLAUDE.md 只 @ 引用 quick-ref 版本
3. 完整版在 CLI 实际执行时按需加载

```markdown
# 优化前 (CLAUDE.md)
- **CLI Tools Usage**: @~/.ccw/workflows/cli-tools-usage.md   ← 539行全量

# 优化后 (CLAUDE.md)
- **CLI Tools Quick**: @~/.ccw/workflows/cli-tools-quick-ref.md  ← ~50行精简
```

#### 方案 B：技能 Phase 懒加载优化

**问题**：某些 Skill 的 SKILL.md 自身就很大 (100-250行)，而且包含了所有 phase 的完整描述。

**建议**：
1. SKILL.md 只保留路由逻辑和架构概览 (30-50行)
2. Phase 详细执行逻辑保持在 phases/*.md 中
3. 严格按需加载：只在进入该 phase 时才 Read 对应文件

#### 方案 C：workflow-architecture.md 摘要化

**问题**：`workflow-architecture.md` 有 942 行，是最大的单一指令文件。agent 被调用时需要加载它理解任务结构。

**建议**：
1. 提取一个 `workflow-architecture-summary.md` (~100行)，只包含 JSON Schema 骨架和关键规则
2. 完整版仅在 `action-planning-agent` (生成任务的 agent) 中使用
3. `code-developer` 等执行 agent 只需要 summary 版

#### 方案 D：.workflow 文件的 TTL 清理

**问题**：`.chat/`、`.scratchpad/`、`.summaries/` 等目录持续积累。

**建议**：
1. 为 `.chat/` 和 `.scratchpad/` 文件设置 TTL（如 30 天）
2. 实现 `/workflow:clean` 命令（已存在但需要强化）自动清理过期文件
3. 归档会话时自动压缩 `.chat/` 目录内容为摘要

#### 方案 E：CLI 调用上下文控制

**问题**：`CONTEXT: @**/*` 全量上下文导致 token 爆炸。

**建议**：
1. 默认使用 `CONTEXT: @focus_paths` 而非 `@**/*`
2. 在 cli-tools-usage.md 中强调具体路径优先
3. 添加 `--max-context-tokens` 参数限制上下文注入量

#### 方案 F：记忆系统的增量查询

**问题**：`core_memory` 可能在某些操作中被大量读取。

**建议**：
1. 确保 `core_memory search` 使用 top_k 限制返回量
2. 引入记忆相关性评分，只返回高相关性记忆
3. 会话恢复时不加载全部记忆，而是基于目标任务描述做语义搜索

### 8.2 总结

CCW 的上下文压缩问题本质上是一个 **"指令膨胀 × 产出累积 × 多代理串联"** 的复合问题：

```
上下文消耗 = 基础指令 (固定)
           + 技能加载 (按需但单次量大)
           + 文件读取 (随项目规模增长)
           + CLI 响应 (每次调用积累)
           + 代理交互 (串联放大)
```

最有效的优化路径是：
1. **减少基础指令的 token 占用**（精简 @ 引用文件）
2. **控制单次操作的文件读取量**（严格使用 focus_paths）
3. **利用子代理的独立上下文**（避免主会话积累）
4. **定期清理过期工作流产出**（TTL 机制）
