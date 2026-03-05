# CCW 工作流指南

## 概述

CCW 提供了基于 **Team 架构 v2** 和 **Skill 工作流系统** 的完整工作流体系，覆盖从快速原型到完整团队编排的软件开发全生命周期。

## v7.0 新增功能

**主要新特性**:
- **Team 架构 v2**: `team-coordinate` 和 `team-executor` 统一 team-worker 代理
- **team-lifecycle**: 完整生命周期统一团队技能 (规格 -> 实现 -> 测试 -> 审查)
- **队列调度器**: 具有依赖解析的后台任务执行
- **工作流会话命令**: `start`、`resume`、`complete`、`sync` 完整生命周期管理
- **节拍/韵律编排模型**: 事件驱动的协调模型
- **新仪表板视图**: 分析查看器、终端仪表板、编排器模板编辑器

---

## Skills 与 Commands

CCW 使用两种调用方式：

| 类型 | 格式 | 示例 |
|------|------|------|
| **Skills** | 触发短语（无斜杠） | `workflow-lite-planex`, `brainstorm`, `workflow-plan` |
| **Commands** | 斜杠命令 | `/ccw`, `/workflow/session:start`, `/issue/new` |

---

## 工作流 Skills

### 轻量规划

| Skill 触发词 | 用途 | 阶段 |
|--------------|------|------|
| `workflow-lite-planex` | 轻量规划与探索（包含执行） | 5 阶段 |

**5 阶段交互式工作流**：
```
阶段 1: 任务分析与探索 (30-90秒)
阶段 2: 澄清（用户参与）
阶段 3: 规划 (20-60秒)
阶段 4: 三维确认
阶段 5: 执行与跟踪
```

### 多 CLI 规划

| Skill 触发词 | 用途 |
|--------------|------|
| `workflow-multi-cli-plan` | 多 CLI 协同分析 |

**5 阶段工作流**：
```
阶段 1: 上下文收集（ACE 语义搜索）
阶段 2: 多 CLI 讨论（迭代）
阶段 3: 展示选项
阶段 4: 用户决策
阶段 5: 规划生成
```

### 标准规划

| Skill 触发词 | 用途 | 阶段 |
|--------------|------|------|
| `workflow-plan` | 完整规划与会话 | 5 阶段 |
| `workflow-plan-verify` | 规划验证 | 验证 |
| `workflow:replan` | 交互式重新规划 | 重规划 |

### TDD 工作流

| Skill 触发词 | 用途 |
|--------------|------|
| `workflow-tdd-plan` | TDD 规划 |
| `workflow-tdd-verify` | TDD 验证 |

**6 阶段 TDD 规划 + Red-Green-Refactor**：
```
阶段 1: 测试设计
阶段 2: Red（编写失败测试）
阶段 3: Green（最小实现）
阶段 4: Refactor（重构）
阶段 5: 验证
阶段 6: 下一循环
```

### 测试修复工作流

| Skill 触发词 | 用途 |
|--------------|------|
| `workflow-test-fix` | 测试生成与修复 |
| `workflow-test-fix` | 执行测试循环 |

**渐进式测试层级 (L0-L3)**：

| 层级 | 名称 | 焦点 |
|------|------|------|
| **L0** | 静态分析 | 编译、导入、类型、AI 代码问题 |
| **L1** | 单元测试 | 函数/类行为 |
| **L2** | 集成测试 | 组件交互、API 契约 |
| **L3** | E2E 测试 | 用户旅程、关键路径 |

---

## 会话生命周期

### 会话命令

```bash
/workflow:session:start     # 启动新工作流会话
/workflow:session:resume    # 恢复暂停的会话
/workflow:session:list      # 列出所有会话
/workflow:session:sync      # 同步会话工作
/workflow:session:complete  # 完成会话
/workflow:session:solidify  # 将学习结晶为永久记忆
```

### 会话类型

| 类型 | 前缀 | 描述 |
|------|------|------|
| **工作流** | `WFS-` | 通用开发会话 |
| **审查** | `WFS-review-` | 代码审查会话 |
| **TDD** | `WFS-tdd-` | TDD 工作流会话 |
| **测试** | `WFS-test-` | 测试生成会话 |

### 会话目录结构

```
.workflow/active/{session-id}/
├── workflow-session.json    # 会话元数据
├── IMPL_PLAN.md             # 实现计划
├── TODO_LIST.md             # 任务清单
├── .task/                   # 任务 JSON 文件
└── .process/                # 过程产物
```

---

## Team 架构 v2

### 核心概念

- **team-worker 智能体**: 所有角色的统一工作者智能体
- **role-spec 文件**: 轻量级 YAML frontmatter + 阶段 2-4 逻辑
- **内循环框架**: 同前缀任务的批处理
- **节拍/节奏模型**: 事件驱动协调

### 可用团队 Skills

| Skill | 用途 |
|-------|------|
| `team-coordinate` | 动态角色生成与协调 |
| `team-executor` | 现有会话的纯执行 |
| `team-lifecycle` | 完整生命周期（规格 -> 实现 -> 测试） |
| `team-brainstorm` | 头脑风暴团队 |
| `team-frontend` | 前端开发团队 |
| `team-testing` | 测试团队 |
| `team-review` | 代码审查团队 |

### 可用角色

| 角色 | 职责 |
|------|------|
| analyst | 代码分析、需求 |
| writer | 文档、内容 |
| planner | 规划、架构 |
| executor | 实现、编码 |
| tester | 测试、QA |
| reviewer | 代码审查、反馈 |
| architect | 系统设计、架构 |
| fe-developer | 前端开发 |
| fe-qa | 前端 QA |

---

## 命令分类

### 根命令

| 命令 | 描述 |
|------|------|
| `/ccw` | 主工作流编排器 |
| `/ccw-coordinator` | 智能链编排器 |
| `/flow-create` | 流程模板生成器 |

### Issue 命令

| 命令 | 描述 |
|------|------|
| `/issue/new` | 创建新 issue |
| `/issue/plan` | 批量规划 issue 解决方案 |
| `/issue/queue` | 形成执行队列 |
| `/issue/execute` | 执行队列 |
| `/issue/discover` | 发现潜在问题 |
| `/issue/discover-by-prompt` | 从提示发现 |

### 工作流命令

| 命令 | 描述 |
|------|------|
| `/workflow/init` | 初始化项目状态 |
| `/workflow/init-specs` | 创建规格文件 |
| `/workflow/init-guidelines` | 填充规格文件 |
| `/workflow/clean` | 代码清理 |
| `/workflow/analyze-with-file` | 协同分析 |
| `/workflow/brainstorm-with-file` | 头脑风暴 |
| `/workflow/collaborative-plan-with-file` | 协同规划 |
| `/workflow/debug-with-file` | 调试工作流 |
| `/workflow/refactor-cycle` | 重构工作流 |
| `/workflow/integration-test-cycle` | 集成测试 |
| `/workflow/roadmap-with-file` | 路线图规划 |
| `/workflow/unified-execute-with-file` | 统一执行 |

### UI 设计命令

| 命令 | 描述 |
|------|------|
| `/workflow/ui-design/style-extract` | 提取样式 |
| `/workflow/ui-design/layout-extract` | 提取布局 |
| `/workflow/ui-design/animation-extract` | 提取动画 |
| `/workflow/ui-design/generate` | 生成 UI 原型 |
| `/workflow/ui-design/import-from-code` | 从代码导入设计 |
| `/workflow/ui-design/codify-style` | 编码样式 |
| `/workflow/ui-design/design-sync` | 同步设计引用 |

---

## Skill 分类

### 工作流 Skills

| Skill | 触发词 |
|-------|--------|
| workflow-lite-planex | `workflow-lite-planex` |
| workflow-multi-cli-plan | `workflow-multi-cli-plan` |
| workflow-plan | `workflow-plan`, `workflow-plan-verify`, `workflow:replan` |
| workflow-execute | `workflow-execute` |
| workflow-tdd-plan | `workflow-tdd-plan`, `workflow-tdd-verify` |
| workflow-test-fix | `workflow-test-fix`, `workflow-test-fix` |

### 专项 Skills

| Skill | 触发词 |
|-------|--------|
| brainstorm | `brainstorm` |
| review-code | `review code` |
| review-cycle | `workflow:review-cycle` |
| spec-generator | `workflow:spec`, `generate spec` |
| skill-generator | `create skill` |
| skill-tuning | `skill tuning` |

### 记忆 Skills

| Skill | 触发词 |
|-------|--------|
| memory-capture | `memory capture` |
| memory-manage | `memory manage` |

---

## 工作流选择指南

```
                    任务复杂度
                    低           中            高
                    │            │             │
────────────────────┼────────────┼─────────────┼────────────
                    │            │             │
快速修复            │            │             │
配置变更        ────┼──>         │             │
单模块功能          │            │             │
                    │ lite-plan  │             │
                    │            │             │
────────────────────┼────────────┼─────────────┼────────────
                    │            │             │
多模块功能          │            │             │
功能开发        ────┼────────────┼──>          │
                    │            │   plan      │
                    │            │             │
────────────────────┼────────────┼─────────────┼────────────
                    │            │             │
架构设计            │            │             │
新系统          ────┼────────────┼─────────────┼──>
                    │            │             │ brainstorm
                    │            │             │ + plan
                    │            │             │ + execute
```

### 决策流程图

```
开始
  │
  ├─ 是快速修复或配置变更？
  │    └─> 是：workflow-lite-planex
  │
  ├─ 是单模块功能？
  │    └─> 是：workflow-lite-planex
  │
  ├─ 需要多 CLI 分析？
  │    └─> 是：workflow-multi-cli-plan
  │
  ├─ 是多模块且需要会话？
  │    └─> 是：workflow-plan
  │
  ├─ 是 TDD 开发？
  │    └─> 是：workflow-tdd-plan
  │
  ├─ 是测试生成？
  │    └─> 是：workflow-test-fix
  │
  └─ 是架构/新系统？
       └─> 是：brainstorm + workflow-plan
```

---

## Issue 工作流

### Issue 生命周期

```
/issue/new          创建带解决方案的 issue
      ↓
/issue/plan         批量规划解决方案
      ↓
/issue/queue        形成执行队列（DAG）
      ↓
/issue/execute      并行编排执行
```

### Issue 命令

| 命令 | 用途 |
|------|------|
| `/issue/new` | 从 URL 或描述创建结构化 issue |
| `/issue/discover` | 从多视角发现问题 |
| `/issue/plan` | 使用 issue-plan-agent 批量规划 |
| `/issue/queue` | 使用 issue-queue-agent 形成队列 |
| `/issue/execute` | 基于 DAG 的并行执行 |

---

## 快速参考

### 最常用 Skills

| Skill | 何时使用 |
|-------|----------|
| `workflow-lite-planex` | 快速修复、单功能 |
| `workflow-plan` | 多模块开发 |
| `brainstorm` | 架构、新功能 |
| `workflow-execute` | 执行已规划的工作 |

### 最常用 Commands

| 命令 | 何时使用 |
|------|----------|
| `/ccw` | 自动工作流选择 |
| `/workflow/session:start` | 启动新会话 |
| `/workflow/session:resume` | 继续暂停的工作 |
| `/issue/new` | 创建新 issue |
