# Claude Skills - 团队协作类

## 一句话定位

**团队协作类 Skills 是多角色协同工作的编排系统** — 通过协调器、工作者角色和消息总线实现复杂任务的并行处理和状态同步。

## 解决的痛点

| 痛点 | 现状 | Claude Code Workflow 方案 |
| --- | --- | --- |
| **单模型局限** | 只能调用一个 AI 模型 | 多角色并行协作，发挥各自专长 |
| **任务编排混乱** | 手动管理任务依赖和状态 | 自动任务发现、依赖解析、流水线编排 |
| **协作流程割裂** | 团队成员各自为战 | 统一消息总线、共享状态、进度同步 |
| **资源浪费** | 重复上下文加载 | Wisdom 累积、探索缓存、产物复用 |

---

## Skills 总览

| Skill | 功能 | 适用场景 |
| --- | --- | --- |
| `team-coordinate` | 通用团队协调器（动态角色生成） | 任意复杂任务 |
| `team-lifecycle` | 全生命周期团队（规范→实现→测试） | 完整功能开发 |
| `team-planex` | 规划-执行流水线 | Issue 批处理 |
| `team-review` | 代码审查团队 | 代码审查、漏洞扫描 |
| `team-testing` | 测试团队 | 测试覆盖、用例生成 |
| `team-arch-opt` | 架构优化团队 | 重构、架构分析 |
| `team-perf-opt` | 性能优化团队 | 性能调优、瓶颈分析 |
| `team-brainstorm` | 头脑风暴团队 | 多角度分析、创意生成 |
| `team-frontend` | 前端开发团队 | UI 开发、设计系统 |
| `team-uidesign` | UI 设计团队 | 设计系统、组件规范 |
| `team-issue` | Issue 处理团队 | Issue 分析、实现 |
| `team-iterdev` | 迭代开发团队 | 增量交付、敏捷开发 |
| `team-quality-assurance` | 质量保证团队 | 质量扫描、缺陷管理 |
| `team-roadmap-dev` | 路线图开发团队 | 分阶段开发、里程碑 |
| `team-tech-debt` | 技术债务团队 | 债务清理、代码治理 |
| `team-ultra-analyze` | 深度分析团队 | 复杂问题分析、协作探索 |
| `team-executor` | 轻量执行器 | 会话恢复、纯执行 |

---

## 核心架构

所有 Team Skills 共享统一的 **team-worker agent 架构**：

```
┌──────────────────────────────────────────────────────────┐
│  Skill(skill="team-xxx", args="任务描述")                 │
└────────────────────────┬─────────────────────────────────┘
                         │ Role Router
              ┌──── --role present? ────┐
              │ NO                      │ YES
              ↓                         ↓
       Orchestration Mode         Role Dispatch
       (auto → coordinator)      (route to role.md)
              │
    ┌─────────┴─────────┬───────────────┬──────────────┐
    ↓                   ↓               ↓              ↓
┌────────┐         ┌────────┐      ┌────────┐     ┌────────┐
│ coord  │         │worker 1│      │worker 2│     │worker N│
│ (编排) │         │(执行)  │      │(执行)  │     │(执行)  │
└────────┘         └────────┘      └────────┘     └────────┘
    │                   │               │              │
    └───────────────────┴───────────────┴──────────────┘
                         │
              Message Bus (消息总线)
```

**核心组件**:
- **Coordinator**: 内置编排器，负责任务分析、派发、监控
- **Team-Worker Agent**: 统一代理，加载 role-spec 执行角色逻辑
- **Role Router**: `--role=xxx` 参数路由到角色执行
- **Message Bus**: 团队成员间通信协议
- **Shared Memory**: 跨任务知识累积 (Wisdom)

---

## Skills 详解

### team-coordinate

**一句话定位**: 通用团队协调器 — 根据任务分析动态生成角色并编排执行

**触发**:
```bash
team-coordinate <task-description>
team-coordinate --role=coordinator <task>
```

**功能**:
- 只有 coordinator 是内置的，所有工作者角色都是运行时动态生成
- 支持内循环角色（处理多个同前缀任务）
- Fast-Advance 机制跳过协调器直接派生后继任务
- Wisdom 累积跨任务知识

**会话目录**:
```
.workflow/.team/TC-<slug>-<date>/
├── team-session.json           # 会话状态 + 动态角色注册表
├── task-analysis.json          # Phase 1 输出
├── roles/                      # 动态角色定义
├── artifacts/                  # 所有 MD 交付产物
├── wisdom/                     # 跨任务知识
└── .msg/                       # 团队消息总线日志
```

---

### team-lifecycle

**一句话定位**: 全生命周期团队 — 从规范到实现到测试到审查的完整流水线

**触发**:
```bash
team-lifecycle <task-description>
```

**功能**:
- 基于 team-worker agent 架构，所有工作者共享同一代理定义
- 角色特定的 Phase 2-4 从 markdown 规范加载
- 支持规范流水线、实现流水线、前端流水线

**角色注册表**:
| 角色 | 规范 | 任务前缀 | 内循环 |
|------|------|----------|--------|
| coordinator | roles/coordinator/role.md | (无) | - |
| analyst | role-specs/analyst.md | RESEARCH-* | false |
| writer | role-specs/writer.md | DRAFT-* | true |
| planner | role-specs/planner.md | PLAN-* | true |
| executor | role-specs/executor.md | IMPL-* | true |
| tester | role-specs/tester.md | TEST-* | false |
| reviewer | role-specs/reviewer.md | REVIEW-* | false |

**流水线定义**:
```
规范流水线:  RESEARCH → DRAFT → QUALITY
实现流水线:  PLAN → IMPL → TEST + REVIEW
全生命周期:  [规范流水线] → [实现流水线]
```

---

### team-planex

**一句话定位**: 边规划边执行团队 — 逐 Issue 节拍流水线

**触发**:
```bash
team-planex <task-description>
team-planex --role=planner <input>
team-planex --role=executor --input <solution-file>
```

**功能**:
- 2 成员团队（planner + executor），planner 担任 lead 角色
- 逐 Issue 节拍：planner 完成后立即创建 EXEC-* 任务
- Solution 写入中间产物文件，executor 从文件加载

**Wave Pipeline**:
```
Issue 1:  planner 规划 → 写产物 → 创建 EXEC-* → executor 执行
Issue 2:  planner 规划 → 写产物 → 创建 EXEC-* → executor 并行消费
Final:    planner 发送 all_planned → executor 完成剩余 → 结束
```

---

### team-review

**一句话定位**: 代码审查团队 — 统一的代码扫描、漏洞审查、自动修复

**触发**:
```bash
team-review <target-path>
team-review --full <target-path>      # scan + review + fix
team-review --fix <review-files>      # fix only
team-review -q <target-path>          # quick scan only
```

**角色注册表**:
| 角色 | 任务前缀 | 类型 |
|------|----------|------|
| coordinator | RC-* | 编排器 |
| scanner | SCAN-* | 只读分析 |
| reviewer | REV-* | 只读分析 |
| fixer | FIX-* | 代码生成 |

**流水线**:
```
SCAN-* (扫描) → REV-* (审查) → [用户确认] → FIX-* (修复)
```

**审查维度**: 安全性、正确性、性能、可维护性

---

### team-testing

**一句话定位**: 测试团队 — 通过 Generator-Critic 循环实现渐进式测试覆盖

**触发**:
```bash
team-testing <task-description>
```

**角色注册表**:
| 角色 | 任务前缀 | 类型 |
|------|----------|------|
| coordinator | (无) | 编排器 |
| strategist | STRATEGY-* | pipeline |
| generator | TESTGEN-* | pipeline |
| executor | TESTRUN-* | pipeline |
| analyst | TESTANA-* | pipeline |

**三种流水线**:
```
Targeted:   STRATEGY → TESTGEN(L1) → TESTRUN
Standard:   STRATEGY → TESTGEN(L1) → TESTRUN → TESTGEN(L2) → TESTRUN → TESTANA
Comprehensive: STRATEGY → [TESTGEN(L1+L2) 并行] → [TESTRUN 并行] → TESTGEN(L3) → TESTRUN → TESTANA
```

**测试层**: L1: Unit (80%) → L2: Integration (60%) → L3: E2E (40%)

---

### team-arch-opt

**一句话定位**: 架构优化团队 — 分析架构问题、设计重构策略、实施改进

**触发**:
```bash
team-arch-opt <task-description>
```

**角色注册表**:
| 角色 | 任务前缀 | 功能 |
|------|----------|------|
| coordinator | (无) | 编排器 |
| analyzer | ANALYZE-* | 架构分析 |
| designer | DESIGN-* | 重构设计 |
| refactorer | REFACT-* | 实施重构 |
| validator | VALID-* | 验证改进 |
| reviewer | REVIEW-* | 代码审查 |

**检测范围**: 依赖循环、耦合/内聚、分层违规、上帝类、死代码

---

### team-perf-opt

**一句话定位**: 性能优化团队 — 性能分析、瓶颈识别、优化实施

**触发**:
```bash
team-perf-opt <task-description>
```

**角色注册表**:
| 角色 | 任务前缀 | 功能 |
|------|----------|------|
| coordinator | (无) | 编排器 |
| profiler | PROFILE-* | 性能分析 |
| strategist | STRAT-* | 优化策略 |
| optimizer | OPT-* | 实施优化 |
| benchmarker | BENCH-* | 基准测试 |
| reviewer | REVIEW-* | 代码审查 |

---

### team-brainstorm

**一句话定位**: 头脑风暴团队 — 多角度创意分析、Generator-Critic 循环

**触发**:
```bash
team-brainstorm <topic>
team-brainstorm --role=ideator <topic>
```

**角色注册表**:
| 角色 | 任务前缀 | 功能 |
|------|----------|------|
| coordinator | (无) | 编排器 |
| ideator | IDEA-* | 创意生成 |
| challenger | CHALLENGE-* | 批判质疑 |
| synthesizer | SYNTH-* | 综合整合 |
| evaluator | EVAL-* | 评估评分 |

---

### team-frontend

**一句话定位**: 前端开发团队 — 内置 ui-ux-pro-max 设计智能

**触发**:
```bash
team-frontend <task-description>
```

**角色注册表**:
| 角色 | 任务前缀 | 功能 |
|------|----------|------|
| coordinator | (无) | 编排器 |
| analyst | ANALYZE-* | 需求分析 |
| architect | ARCH-* | 架构设计 |
| developer | DEV-* | 前端实现 |
| qa | QA-* | 质量保证 |

---

### team-uidesign

**一句话定位**: UI 设计团队 — 设计系统分析、Token 定义、组件规范

**触发**:
```bash
team-uidesign <task>
```

**角色注册表**:
| 角色 | 任务前缀 | 功能 |
|------|----------|------|
| coordinator | (无) | 编排器 |
| researcher | RESEARCH-* | 设计研究 |
| designer | DESIGN-* | 设计定义 |
| reviewer | AUDIT-* | 无障碍审计 |
| implementer | BUILD-* | 代码实现 |

---

### team-issue

**一句话定位**: Issue 处理团队 — Issue 处理流水线

**触发**:
```bash
team-issue <issue-ids>
```

**角色注册表**:
| 角色 | 任务前缀 | 功能 |
|------|----------|------|
| coordinator | (无) | 编排器 |
| explorer | EXPLORE-* | 代码探索 |
| planner | PLAN-* | 方案规划 |
| implementer | IMPL-* | 代码实现 |
| reviewer | REVIEW-* | 代码审查 |
| integrator | INTEG-* | 集成验证 |

---

### team-iterdev

**一句话定位**: 迭代开发团队 — Generator-Critic 循环、增量交付

**触发**:
```bash
team-iterdev <task-description>
```

**角色注册表**:
| 角色 | 任务前缀 | 功能 |
|------|----------|------|
| coordinator | (无) | 编排器 |
| architect | ARCH-* | 架构设计 |
| developer | DEV-* | 功能开发 |
| tester | TEST-* | 测试验证 |
| reviewer | REVIEW-* | 代码审查 |

**特点**: Developer-Reviewer 循环（最多 3 轮），Task Ledger 实时进度

---

### team-quality-assurance

**一句话定位**: 质量保证团队 — Issue 发现 + 测试验证闭环

**触发**:
```bash
team-quality-assurance <task-description>
team-qa <task-description>
```

**角色注册表**:
| 角色 | 任务前缀 | 功能 |
|------|----------|------|
| coordinator | (无) | 编排器 |
| scout | SCOUT-* | 问题发现 |
| strategist | QASTRAT-* | 策略制定 |
| generator | QAGEN-* | 测试生成 |
| executor | QARUN-* | 测试执行 |
| analyst | QAANA-* | 结果分析 |

---

### team-roadmap-dev

**一句话定位**: 路线图开发团队 — 分阶段开发、里程碑管理

**触发**:
```bash
team-roadmap-dev <task-description>
```

**角色注册表**:
| 角色 | 任务前缀 | 功能 |
|------|----------|------|
| coordinator | (无) | 人机交互 |
| planner | PLAN-* | 阶段规划 |
| executor | EXEC-* | 阶段执行 |
| verifier | VERIFY-* | 阶段验证 |

---

### team-tech-debt

**一句话定位**: 技术债务团队 — 债务扫描、评估、清理、验证

**触发**:
```bash
team-tech-debt <task-description>
```

**角色注册表**:
| 角色 | 任务前缀 | 功能 |
|------|----------|------|
| coordinator | (无) | 编排器 |
| scanner | TDSCAN-* | 债务扫描 |
| assessor | TDEVAL-* | 量化评估 |
| planner | TDPLAN-* | 治理规划 |
| executor | TDFIX-* | 清理执行 |
| validator | TDVAL-* | 验证回归 |

---

### team-ultra-analyze

**一句话定位**: 深度分析团队 — 多角色协作探索、渐进式理解

**触发**:
```bash
team-ultra-analyze <topic>
team-analyze <topic>
```

**角色注册表**:
| 角色 | 任务前缀 | 功能 |
|------|----------|------|
| coordinator | (无) | 编排器 |
| explorer | EXPLORE-* | 代码探索 |
| analyst | ANALYZE-* | 深度分析 |
| discussant | DISCUSS-* | 讨论交互 |
| synthesizer | SYNTH-* | 综合输出 |

**特点**: 支持 Quick/Standard/Deep 三种深度模式

---

### team-executor

**一句话定位**: 轻量执行器 — 恢复会话、纯执行模式

**触发**:
```bash
team-executor --session=<path>
```

**功能**:
- 无分析、无角色生成 — 仅加载并执行现有会话
- 用于恢复中断的 team-coordinate 会话

---

## 用户命令

所有 Team Skills 支持统一的用户命令（唤醒暂停的协调器）：

| 命令 | 动作 |
|------|------|
| `check` / `status` | 输出执行状态图，不推进 |
| `resume` / `continue` | 检查工作者状态，推进下一步 |
| `revise <TASK-ID>` | 创建修订任务 + 级联下游 |
| `feedback <text>` | 分析反馈影响，创建定向修订链 |

---

## 最佳实践

1. **选择合适的团队类型**:
   - 通用任务 → `team-coordinate`
   - 完整功能开发 → `team-lifecycle`
   - Issue 批处理 → `team-planex`
   - 代码审查 → `team-review`
   - 测试覆盖 → `team-testing`
   - 架构优化 → `team-arch-opt`
   - 性能调优 → `team-perf-opt`
   - 头脑风暴 → `team-brainstorm`
   - 前端开发 → `team-frontend`
   - UI 设计 → `team-uidesign`
   - 技术债务 → `team-tech-debt`
   - 深度分析 → `team-ultra-analyze`

2. **利用内循环角色**: 设置 `inner_loop: true` 让单个工作者处理多个同前缀任务

3. **Wisdom 累积**: 团队会话中的所有角色都会累积知识到 `wisdom/` 目录

4. **Fast-Advance**: 简单线性后继任务会自动跳过协调器直接派生

5. **断点恢复**: 所有团队技能支持会话恢复，通过 `--resume` 或 `resume` 命令继续

---

## 相关命令

- [Claude Commands - Workflow](../commands/claude/workflow.md)
- [Claude Commands - Session](../commands/claude/session.md)
