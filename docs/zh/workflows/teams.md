# 团队工作流

CCW 提供多个支持多角色协调复杂任务的团队协作技能。

## 团队技能概览

| 技能 | 角色 | 流水线 | 用例 |
|-------|-------|----------|----------|
| **team-planex** | 3 (planner + executor) | 波浪流水线（边规划边执行） | 规划和执行并行 |
| **team-iterdev** | 5 (generator → critic → integrator → validator) | 生成器-评论者循环 | 带反馈循环的迭代开发 |
| **team-lifecycle-v4** | 8 (spec → architect → impl → test) | 5 阶段生命周期 | 完整规范 → 实现 → 测试工作流 |
| **team-lifecycle** | 可变 (team-worker) | 内置阶段 | 最新 team-worker 架构 |
| **team-issue** | 6 (explorer → planner → implementer → reviewer → integrator) | 5 阶段问题解决 | 多角色问题求解 |
| **team-testing** | 5 (strategist → generator → executor → analyst) | 4 阶段测试 | 综合测试覆盖 |
| **team-quality-assurance** | 6 (scout → strategist → generator → executor → analyst) | 5 阶段 QA | 质量保障闭环 |
| **team-brainstorm** | 5 (coordinator → ideator → challenger → synthesizer → evaluator) | 5 阶段头脑风暴 | 多视角创意生成 |
| **team-uidesign** | 4 (designer → developer → reviewer) | CP-9 双轨 | UI 设计和实现并行 |
| **team-frontend** | 6 (frontend-lead → ui-developer → ux-engineer → component-dev → qa) | 设计集成 | 带 UI/UX 集成的前端开发 |
| **team-review** | 4 (scanner → reviewer → fixer) | 4 阶段代码审查 | 代码扫描和自动修复 |
| **team-roadmap-dev** | 4 (planner → executor → verifier) | 分阶段执行 | 路线图驱动开发 |
| **team-tech-debt** | 6 (scanner → assessor → planner → executor → validator) | 5 阶段清理 | 技术债务识别和解决 |
| **team-ultra-analyze** | 5 (explorer → analyst → discussant → synthesizer) | 4 阶段分析 | 深度协作代码库分析 |
| **team-coordinate** | 可变 | 通用协调 | 通用团队协调（旧版） |
| **team-coordinate** | 可变 (team-worker) | team-worker 架构 | 现代 team-worker 协调 |
| **team-executor** | 可变 | 轻量级执行 | 基于会话的执行 |
| **team-executor** | 可变 (team-worker) | team-worker 执行 | 现代 team-worker 执行 |

## 使用方法

### 通过 /ccw 编排器

```bash
# 基于意图自动路由
/ccw "team planex: 用户认证系统"
/ccw "全生命周期: 通知服务开发"
/ccw "QA 团队: 质量保障支付流程"

# 基于团队的工作流
/ccw "team brainstorm: 新功能想法"
/ccw "team issue: 修复登录超时"
/ccw "team testing: 测试覆盖率提升"
```

### 直接调用技能

```javascript
// 编程调用
Skill(skill="team-lifecycle", args="Build user authentication system")
Skill(skill="team-planex", args="Implement OAuth2 with concurrent planning")
Skill(skill="team-quality-assurance", args="Quality audit of payment system")

// 带模式选择
Skill(skill="workflow-plan", args="--mode replan")
```

### 通过 Task 工具（用于代理调用）

```javascript
// 生成团队工作器代理
Task({
  subagent_type: "team-worker",
  description: "Spawn executor worker",
  team_name: "my-team",
  name: "executor",
  run_in_background: true,
  prompt: `## Role Assignment
role: executor
session: D:/project/.workflow/.team/my-session
session_id: my-session
team_name: my-team
requirement: Implement user authentication
inner_loop: true`
})
```

## 检测关键词

| 技能 | 关键词（英文） | 关键词（中文） |
|-------|-------------------|----------------|
| **team-planex** | team planex, plan execute, wave pipeline | 团队规划执行, 波浪流水线 |
| **team-iterdev** | team iterdev, iterative development | 迭代开发团队 |
| **team-lifecycle** | team lifecycle, full lifecycle, spec impl test | 全生命周期, 规范实现测试 |
| **team-issue** | team issue, resolve issue, issue team | 团队 issue, issue 解决团队 |
| **team-testing** | team test, comprehensive test, test coverage | 测试团队, 全面测试 |
| **team-quality-assurance** | team qa, qa team, quality assurance | QA 团队, 质量保障团队 |
| **team-brainstorm** | team brainstorm, collaborative brainstorming | 团队头脑风暴, 协作头脑风暴 |
| **team-uidesign** | team ui design, ui design team, dual track | UI 设计团队, 双轨设计 |
| **team-frontend** | team frontend, frontend team | 前端开发团队 |
| **team-review** | team review, code review team | 代码审查团队 |
| **team-roadmap-dev** | team roadmap, roadmap driven | 路线图驱动开发 |
| **team-tech-debt** | tech debt cleanup, technical debt | 技术债务清理, 清理技术债 |
| **team-ultra-analyze** | team analyze, deep analysis, collaborative analysis | 深度协作分析 |

## 团队技能架构

### 版本演进

| 版本 | 架构 | 状态 |
|---------|-------------|--------|
| **v5** | team-worker（动态角色） | **最新** |
| v4 | 5 阶段生命周期，内联讨论 | 稳定 |
| v3 | 3 阶段生命周期 | 旧版 |
| v2 | 通用协调 | 已弃用 |

### v5 Team Worker 架构

最新架构使用 `team-worker` 代理，基于阶段前缀进行动态角色分配：

| 阶段 | 前缀 | 角色 |
|-------|--------|------|
| 分析 | ANALYSIS | doc-analyst |
| 草稿 | DRAFT | doc-writer |
| 规划 | PLAN | planner |
| 实现 | IMPL | executor (code-developer, tdd-developer 等) |
| 测试 | TEST | tester (test-fix-agent 等) |
| 审查 | REVIEW | reviewer |

### 角色类型

| 类型 | 前缀 | 描述 |
|------|--------|-------------|
| **编排器** | COORD | 管理工作流，协调代理 |
| **负责人** | SPEC, IMPL, TEST | 领导阶段，委派给工作器 |
| **工作器** | 可变 | 执行特定任务 |

## 工作流模式

### 波浪流水线 (team-planex)

```text
Wave 1: Plan ──────────────────────────────────┐
         ↓                                      │
Wave 2: Exec  ←────────────────────────────────┘
         ↓
Wave 3: Plan → Exec → Plan → Exec → ...
```

规划和执行并发 - 执行者在第 N 波工作时，规划者正在规划第 N+1 波。

### 生成器-评论者循环 (team-iterdev)

```text
Generator → Output → Critic → Feedback → Generator
                ↓
            Integrator → Validator
```

通过反馈循环进行迭代改进。

### CP-9 双轨 (team-uidesign)

```text
Design Track:  Designer → Tokens → Style
                           ↓
Implementation Track:        Developer → Components
                           ↓
                      Reviewer → Verify
```

设计和实现并行的双轨进行。

### 5 阶段生命周期 (team-lifecycle-v4)

```text
1. Spec Planning (coordinator + spec-lead)
2. Architecture Design (architect)
3. Implementation Planning (impl-lead + dev team)
4. Test Planning (test-lead + qa-analyst)
5. Execution & Verification (all roles)
```

线性推进所有生命周期阶段。

## 何时使用各团队技能

| 场景 | 推荐技能 |
|----------|-------------------|
| 需要并行规划和执行 | **team-planex** |
| 带多次迭代的复杂功能 | **team-iterdev** |
| 完整规范 → 实现 → 测试工作流 | **team-lifecycle** |
| 问题解决 | **team-issue** |
| 综合测试 | **team-testing** |
| 质量审计 | **team-quality-assurance** |
| 新功能创意 | **team-brainstorm** |
| UI 设计 + 实现 | **team-uidesign** |
| 前端特定开发 | **team-frontend** |
| 代码质量审查 | **team-review** |
| 带路线图的大型项目 | **team-roadmap-dev** |
| 技术债务清理 | **team-tech-debt** |
| 深度代码库分析 | **team-ultra-analyze** |

::: info 另请参阅
- [技能参考](../skills/reference.md) - 所有技能文档
- [CLI 命令](../cli/commands.md) - 命令参考
- [代理](../agents/index.md) - 代理文档
- [4 级工作流](./4-level.md) - 工作流系统概览
:::
