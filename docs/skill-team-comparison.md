# Skill/Team 命令对比表

本文档对比 d:\Claude_dms3 项目中的规划类和执行类 skill/team 命令，帮助选择合适的工具。

---

## 目录

1. [规划类命令对比](#规划类命令对比)
2. [执行类命令对比](#执行类命令对比)
3. [Team Skill 架构对比](#team-skill-架构对比)
4. [Claude vs Codex 执行方式](#claude-vs-codex-执行方式)
5. [使用场景选择指南](#使用场景选择指南)

---

## 规划类命令对比

### 单体规划 Skill

| 命令 | 类型 | 输出 | 适用场景 | 特点 |
|------|------|------|----------|------|
| **workflow-plan** | 4阶段规划 | IMPL_PLAN.md, task JSONs, TODO_LIST.md | 标准功能开发 | 完整规划流程，支持冲突检测，可选验证 |
| **workflow-lite-planex** | 轻量规划 | task JSONs | 快速任务 | 精简流程，直接执行，无验证阶段 |
| **workflow-tdd-plan** | TDD规划 | IMPL_PLAN.md (含Red-Green-Refactor) | 测试驱动开发 | 强制TDD结构，测试先行 |
| **brainstorm** | 头脑风暴 | guidance-specification.md, role分析, feature-specs | 需求探索 | 多角色分析，角色扮演，创意生成 |
| **issue:plan** | Issue规划 | solution JSON per issue | Issue驱动开发 | 批量规划，自动绑定，冲突检测 |
| **workflow-wave-plan** | CSV Wave规划 | task JSONs | 批量文件处理 | CSV分批，冲突解决，并行执行 |

### Team 规划 Skill

| 命令 | 角色 | 输出 | 适用场景 | 特点 |
|------|------|------|----------|------|
| **team-brainstorm** | ideator, challenger, synthesizer, evaluator | ideas/, critiques/, synthesis/, evaluation/ | 深度头脑风暴 | Generator-Critic循环，多角度分析 |
| **team-planex** | planner, executor | solutions/ | Issue批量执行 | 规划+执行一体化，逐Issue节拍 |
| **team-lifecycle** (Spec阶段) | analyst, writer, reviewer | spec/, product-brief.md, requirements/, architecture/, epics/ | 全生命周期规格 | 完整规格文档，质量门控 |

### 规划类详细对比

```
┌─────────────────┬───────────────────┬───────────────────┬───────────────────┐
│                 │ workflow-plan     │ workflow-lite-planex│ issue:plan        │
├─────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ 复杂度          │ 高 (4-6阶段)      │ 低 (1-2阶段)      │ 中 (3阶段)        │
│ 验证阶段        │ ✓ (Phase 5)       │ ✗                 │ ✗                 │
│ 冲突检测        │ ✓ (Phase 3)       │ ✗                 │ ✓                 │
│ 上下文收集      │ ✓ (完整)          │ ✓ (轻量)          │ ✓ (ACE搜索)       │
│ 任务依赖        │ ✓ (DAG)           │ 简单              │ ✓                 │
│ 自动模式        │ -y/--yes          │ -y/--yes          │ -y/--yes          │
│ 输出格式        │ IMPL_PLAN.md + JSON│ JSON only         │ solution JSON     │
│ 适用规模        │ 中大型功能        │ 小任务/修复       │ Issue批量         │
└─────────────────┴───────────────────┴───────────────────┴───────────────────┘
```

---

## 执行类命令对比

### 单体执行 Skill

| 命令 | 类型 | 执行方式 | 适用场景 | 特点 |
|------|------|----------|----------|------|
| **workflow-execute** | 任务执行器 | code-developer agent | 规划后执行 | 会话发现，并行任务，进度跟踪 |
| **workflow-lite-planex** (执行模式) | 轻量执行 | code-developer / CLI | 快速实现 | 内置执行，无会话 |
| **review-code** | 代码审查 | read-only | 质量检查 | 多维度审查，自动修复建议 |

### Team 执行 Skill

| 命令 | 角色 | 执行方式 | 适用场景 | 特点 |
|------|------|----------|----------|------|
| **team-executor** | (继承会话角色) | team-worker agents | 恢复执行 | 纯执行，无分析，需现有team会话 |
| **team-issue** | explorer (EXPLORE), planner (SOLVE), reviewer (AUDIT), integrator (MARSHAL), implementer (BUILD) | general-purpose agents | Issue处理流程 | 探索→规划→审查→集成→实现 |
| **team-testing** | strategist, generator, executor, analyst | general-purpose agents | 测试生成 | L1-L3分层，Generator-Critic循环 |
| **team-lifecycle** (Impl阶段) | planner, executor, tester, reviewer | team-worker agents | 全生命周期实现 | 规格→实现→测试→审查 |
| **team-frontend** | analyst, architect, developer, qa | general-purpose agents | 前端开发 | ui-ux-pro-max集成，设计系统 |
| **team-review** | scanner, reviewer, fixer | Skill invocation | 代码审查 | 扫描→审查→修复 |
| **team-coordinate** | (动态生成) | team-worker agents | 通用协调 | 动态角色生成，按需创建 |

### 执行类详细对比

```
┌─────────────────┬───────────────────┬───────────────────┬───────────────────┐
│                 │ workflow-execute  │ team-executor  │ team-issue        │
├─────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ 前置条件        │ 现有规划会话      │ 现有team会话       │ Issue ID          │
│ 角色模型        │ 单一agent         │ 动态role-specs    │ 5固定角色         │
│ 并行执行        │ ✓ (批量)          │ ✓                 │ ✓ (Batch模式)     │
│ 消息总线        │ ✗                 │ ✓ (team_msg)      │ ✓ (team_msg)      │
│ 进度跟踪        │ TodoWrite         │ TaskList + msg    │ TaskList + msg    │
│ 会话恢复        │ --resume-session  │ 需session路径     │ check/resume      │
│ 自动提交        │ --with-commit     │ ✗                 │ ✗                 │
│ CLI集成         │ ✓                 │ ✗                 │ ✗                 │
└─────────────────┴───────────────────┴───────────────────┴───────────────────┘
```

---

## Team Skill 架构对比

### 架构模式

| 模式 | 使用命令 | 特点 |
|------|----------|------|
| **静态角色** | team-issue, team-testing, team-brainstorm, team-frontend, team-review | 预定义角色，role.md文件 |
| **动态角色** | team-coordinate, team-lifecycle | 运行时生成role-specs |
| **混合模式** | team-planex, team-executor | 静态coordinator + 动态workers |

### 通信模式

| 模式 | 使用命令 | 特点 |
|------|----------|------|
| **SendMessage** | 所有team-* skills | 点对点通信 |
| **team_msg MCP** | team-issue, team-testing, team-brainstorm, team-frontend | 消息总线日志 |
| **shared-memory.json** | team-testing, team-brainstorm, team-frontend | 跨角色状态共享 |
| **wisdom/** | team-lifecycle, team-coordinate | 跨任务知识积累 |

### Pipeline 模式

| 模式 | 使用命令 | 流程 |
|------|----------|------|
| **线性** | team-review, team-issue (Quick) | A → B → C → D |
| **Generator-Critic** | team-testing, team-brainstorm, team-frontend | Generator ↔ Critic (max N rounds) |
| **Checkpoint** | team-lifecycle, team-issue (Full) | Phase → Gate → Continue |
| **Fan-out** | team-issue (Batch), team-brainstorm (Full) | [A, B, C] → D → E |

---

## Claude vs Codex 执行方式

### 执行后端对比

| 后端 | 工具 | 适用场景 | 特点 |
|------|------|----------|------|
| **Claude Agent** | code-developer, test-fix-agent | 同步执行，简单任务 | 内置agent，直接执行 |
| **Codex CLI** | `ccw cli --tool codex --mode write` | 复杂任务，后台执行 | 异步执行，更强能力 |
| **Gemini CLI** | `ccw cli --tool gemini --mode analysis` | 分析类任务 | 只读分析，语义搜索 |

### 选择决策表

| 条件 | 推荐后端 |
|------|----------|
| 任务数 ≤ 3 且简单 | Claude Agent |
| 任务数 > 3 或复杂 | Codex CLI |
| 只读分析 | Gemini CLI |
| 需要后台执行 | Codex/Gemini CLI |
| 需要即时反馈 | Claude Agent |

### team-planex 执行方法选择

```javascript
// team-planex 支持三种执行后端
--exec=agent   // code-developer subagent (默认)
--exec=codex   // ccw cli --tool codex --mode write
--exec=gemini  // ccw cli --tool gemini --mode write

// 自动选择逻辑
if (task_count <= 3) → Agent
if (task_count > 3)  → Codex
```

### CLI 工具配置

```json
// ~/.claude/cli-tools.json
{
  "tools": {
    "gemini": {
      "enabled": true,
      "primaryModel": "gemini-2.5-flash",
      "tags": ["分析", "Debug"],
      "type": "builtin"
    },
    "codex": {
      "enabled": true,
      "primaryModel": "gpt-5.2",
      "type": "builtin"
    }
  }
}
```

---

## 使用场景选择指南

### 按任务类型选择

| 任务类型 | 推荐命令 | 备选命令 |
|----------|----------|----------|
| **新功能开发** | workflow-plan → workflow-execute | team-lifecycle |
| **快速修复** | workflow-lite-planex | issue:plan → issue:execute |
| **TDD开发** | workflow-tdd-plan → workflow-execute | - |
| **需求探索** | brainstorm | team-brainstorm |
| **Issue处理** | issue:plan → issue:queue → issue:execute | team-issue |
| **测试生成** | team-testing | workflow-test-fix |
| **前端开发** | team-frontend | - |
| **代码审查** | team-review | review-code |
| **恢复中断** | team-executor | workflow-execute --resume-session |

### 按团队规模选择

| 规模 | 推荐命令 | 原因 |
|------|----------|------|
| **单人快速** | workflow-lite-planex | 轻量，直接执行 |
| **单人完整** | workflow-plan → workflow-execute | 完整流程，有验证 |
| **多人协作** | team-coordinate | 动态角色，灵活分工 |
| **专项团队** | team-* (按领域) | 领域专家角色 |

### 按复杂度选择

```
复杂度低 (1-2任务)
└─ workflow-lite-planex (推荐)
└─ issue:plan (Issue驱动)

复杂度中 (3-10任务)
└─ workflow-plan → workflow-execute (推荐)
└─ team-planex (Issue批量)

复杂度高 (10+任务)
└─ team-lifecycle (推荐)
└─ team-coordinate (动态角色)
```

### 决策流程图

```
                    ┌─────────────────┐
                    │   任务类型?     │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ↓                   ↓                   ↓
    ┌─────────┐        ┌─────────┐        ┌─────────┐
    │ 新功能  │        │ Issue   │        │ 探索/分析│
    └────┬────┘        └────┬────┘        └────┬────┘
         │                  │                  │
         ↓                  ↓                  ↓
    ┌─────────┐        ┌─────────┐        ┌─────────┐
    │TDD需求? │        │批量?    │        │多角度?  │
    └────┬────┘        └────┬────┘        └────┬────┘
         │                  │                  │
    ┌────┴────┐        ┌────┴────┐        ┌────┴────┐
    ↓         ↓        ↓         ↓        ↓         ↓
  是        否       是        否       是        否
    │         │        │         │        │         │
    ↓         ↓        ↓         ↓        ↓         ↓
workflow-  workflow- team-    issue:   team-    brainstorm
tdd-plan   plan      issue    plan     brainstorm
```

---

## 命令速查表

### 规划类

| 命令 | 调用方式 |
|------|----------|
| workflow-plan | `Skill(skill="workflow-plan", args="任务描述")` |
| workflow-lite-planex | `Skill(skill="workflow-lite-planex", args="任务描述")` |
| workflow-tdd-plan | `Skill(skill="workflow-tdd-plan", args="TDD任务描述")` |
| brainstorm | `Skill(skill="brainstorm", args="主题 --count 3")` |
| issue:plan | `/issue:plan GH-123,GH-124` |

### 执行类

| 命令 | 调用方式 |
|------|----------|
| workflow-execute | `Skill(skill="workflow-execute")` 或 `/workflow-execute` |
| team-executor | `Skill(skill="team-executor", args="--session=.workflow/.team/TC-xxx")` |
| team-issue | `Skill(skill="team-issue", args="GH-123")` |
| team-testing | `Skill(skill="team-testing", args="测试任务描述")` |
| team-lifecycle | `Skill(skill="team-lifecycle", args="任务描述")` |
| team-frontend | `Skill(skill="team-frontend", args="前端任务描述")` |
| team-review | `Skill(skill="team-review", args="src/**/*.ts")` |

---

## 附录：命令分类汇总

### Team Skills (19个)

| 分类 | 命令 | 角色 |
|------|------|------|
| **通用协调** | team-coordinate, team-coordinate | coordinator + 动态角色 |
| **执行器** | team-executor, team-executor | executor |
| **全生命周期** | team-lifecycle-v3/v4/v5 | analyst, writer, planner, executor, tester, reviewer |
| **Issue处理** | team-issue | explorer (EXPLORE), planner (SOLVE), reviewer (AUDIT), integrator (MARSHAL), implementer (BUILD) |
| **测试** | team-testing | strategist, generator, executor, analyst |
| **头脑风暴** | team-brainstorm | ideator, challenger, synthesizer, evaluator |
| **前端** | team-frontend | analyst, architect, developer, qa |
| **审查** | team-review | scanner, reviewer, fixer |
| **专项** | team-quality-assurance, team-roadmap-dev, team-tech-debt, team-iterdev, team-uidesign, team-ultra-analyze | 特定领域角色 |
| **规划执行** | team-planex | planner, executor |

### Workflow Skills (7个)

| 分类 | 命令 | 阶段数 |
|------|------|--------|
| **规划** | workflow-plan | 6阶段 |
| **执行** | workflow-execute | 6阶段 |
| **轻量** | workflow-lite-planex | 2阶段 |
| **TDD** | workflow-tdd-plan | 7阶段 |
| **测试修复** | workflow-test-fix | 4阶段 |
| **多CLI** | workflow-multi-cli-plan | - |
| **技能设计** | workflow-skill-designer | 4阶段 |

---

*文档生成日期: 2026-03-01*
*版本: 1.0.0*
