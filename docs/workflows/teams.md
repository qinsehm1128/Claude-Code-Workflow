# Team Workflows

CCW provides multiple team collaboration Skills that support multi-role coordination for complex tasks.

## Team Skill Overview

| Skill | Roles | Pipeline | Use Case |
|-------|-------|----------|----------|
| **team-planex** | 3 (planner + executor) | Wave pipeline (边规划边执行) | Planning and execution in parallel waves |
| **team-iterdev** | 5 (generator → critic → integrator → validator) | Generator-critic loop | Iterative development with feedback cycles |
| **team-lifecycle-v4** | 8 (spec → architect → impl → test) | 5-phase lifecycle | Full spec → impl → test workflow |
| **team-lifecycle** | Variable (team-worker) | Built-in phases | Latest team-worker architecture |
| **team-issue** | 6 (explorer → planner → implementer → reviewer → integrator) | 5-phase issue resolution | Multi-role issue solving |
| **team-testing** | 5 (strategist → generator → executor → analyst) | 4-phase testing | Comprehensive test coverage |
| **team-quality-assurance** | 6 (scout → strategist → generator → executor → analyst) | 5-phase QA | Quality assurance closed loop |
| **team-brainstorm** | 5 (coordinator → ideator → challenger → synthesizer → evaluator) | 5-phase brainstorming | Multi-perspective ideation |
| **team-uidesign** | 4 (designer → developer → reviewer) | CP-9 dual-track | UI design and implementation in parallel |
| **team-frontend** | 6 (frontend-lead → ui-developer → ux-engineer → component-dev → qa) | Design integration | Frontend development with UI/UX integration |
| **team-review** | 4 (scanner → reviewer → fixer) | 4-phase code review | Code scanning and automated fix |
| **team-roadmap-dev** | 4 (planner → executor → verifier) | Phased execution | Roadmap-driven development |
| **team-tech-debt** | 6 (scanner → assessor → planner → executor → validator) | 5-phase cleanup | Technical debt identification and resolution |
| **team-ultra-analyze** | 5 (explorer → analyst → discussant → synthesizer) | 4-phase analysis | Deep collaborative codebase analysis |
| **team-coordinate** | Variable | Generic coordination | Generic team coordination (legacy) |
| **team-coordinate** | Variable (team-worker) | team-worker architecture | Modern team-worker coordination |
| **team-executor** | Variable | Lightweight execution | Session-based execution |
| **team-executor** | Variable (team-worker) | team-worker execution | Modern team-worker execution |

## Usage

### Via /ccw Orchestrator

```bash
# Automatic routing based on intent
/ccw "team planex: 用户认证系统"
/ccw "全生命周期: 通知服务开发"
/ccw "QA 团队: 质量保障支付流程"

# Team-based workflows
/ccw "team brainstorm: 新功能想法"
/ccw "team issue: 修复登录超时"
/ccw "team testing: 测试覆盖率提升"
```

### Direct Skill Invocation

```javascript
// Programmatic invocation
Skill(skill="team-lifecycle", args="Build user authentication system")
Skill(skill="team-planex", args="Implement OAuth2 with concurrent planning")
Skill(skill="team-quality-assurance", args="Quality audit of payment system")

// With mode selection
Skill(skill="workflow-plan", args="--mode replan")
```

### Via Task Tool (for agent invocation)

```javascript
// Spawn team worker agent
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

## Detection Keywords

| Skill | Keywords (English) | Keywords (中文) |
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

## Team Skill Architecture

### Version Evolution

| Version | Architecture | Status |
|---------|-------------|--------|
| **v5** | team-worker (dynamic roles) | **Latest** |
| v4 | 5-phase lifecycle with inline discuss | Stable |
| v3 | 3-phase lifecycle | Legacy |
| v2 | Generic coordination | Obsolete |

### v5 Team Worker Architecture

The latest architecture uses the `team-worker` agent with dynamic role assignment based on phase prefixes:

| Phase | Prefix | Role |
|-------|--------|------|
| Analysis | ANALYSIS | doc-analyst |
| Draft | DRAFT | doc-writer |
| Planning | PLAN | planner |
| Implementation | IMPL | executor (code-developer, tdd-developer, etc.) |
| Testing | TEST | tester (test-fix-agent, etc.) |
| Review | REVIEW | reviewer |

### Role Types

| Type | Prefix | Description |
|------|--------|-------------|
| **Orchestrator** | COORD | Manages workflow, coordinates agents |
| **Lead** | SPEC, IMPL, TEST | Leads phase, delegates to workers |
| **Worker** | Various | Executes specific tasks |

## Workflow Patterns

### Wave Pipeline (team-planex)

```text
Wave 1: Plan ──────────────────────────────────┐
         ↓                                      │
Wave 2: Exec  ←────────────────────────────────┘
         ↓
Wave 3: Plan → Exec → Plan → Exec → ...
```

Concurrent planning and execution - executor works on wave N while planner plans wave N+1.

### Generator-Critic Loop (team-iterdev)

```text
Generator → Output → Critic → Feedback → Generator
                ↓
            Integrator → Validator
```

Iterative improvement through feedback cycles.

### CP-9 Dual-Track (team-uidesign)

```text
Design Track:  Designer → Tokens → Style
                           ↓
Implementation Track:        Developer → Components
                           ↓
                      Reviewer → Verify
```

Design and implementation proceed in parallel tracks.

### 5-Phase Lifecycle (team-lifecycle-v4)

```text
1. Spec Planning (coordinator + spec-lead)
2. Architecture Design (architect)
3. Implementation Planning (impl-lead + dev team)
4. Test Planning (test-lead + qa-analyst)
5. Execution & Verification (all roles)
```

Linear progression through all lifecycle phases.

## When to Use Each Team Skill

| Scenario | Recommended Skill |
|----------|-------------------|
| Need parallel planning and execution | **team-planex** |
| Complex feature with multiple iterations | **team-iterdev** |
| Full spec → impl → test workflow | **team-lifecycle** |
| Issue resolution | **team-issue** |
| Comprehensive testing | **team-testing** |
| Quality audit | **team-quality-assurance** |
| New feature ideation | **team-brainstorm** |
| UI design + implementation | **team-uidesign** |
| Frontend-specific development | **team-frontend** |
| Code quality review | **team-review** |
| Large project with roadmap | **team-roadmap-dev** |
| Tech debt cleanup | **team-tech-debt** |
| Deep codebase analysis | **team-ultra-analyze** |

::: info See Also
- [Skills Reference](../skills/reference.md) - All skills documentation
- [CLI Commands](../cli/commands.md) - Command reference
- [Agents](../agents/index.md) - Agent documentation
- [4-Level Workflows](./4-level.md) - Workflow system overview
:::
