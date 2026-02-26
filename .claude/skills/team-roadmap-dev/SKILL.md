---
name: team-roadmap-dev
description: Unified team skill for roadmap-driven development workflow. Coordinator discusses roadmap with user, then dispatches phased execution pipeline (plan → execute → verify). All roles invoke this skill with --role arg. Triggers on "team roadmap-dev".
allowed-tools: TeamCreate(*), TeamDelete(*), SendMessage(*), TaskCreate(*), TaskUpdate(*), TaskList(*), TaskGet(*), Task(*), AskUserQuestion(*), Read(*), Write(*), Edit(*), Bash(*), Glob(*), Grep(*)
---

# Team Roadmap Dev

Phased project execution team. Coordinator discusses roadmap with the user and manages phase transitions. Workers handle planning, execution, and verification per phase. Follows filesystem-based state machine pattern with fixed and dynamic artifacts.

## Architecture Overview

```
┌───────────────────────────────────────────────┐
│  Skill(skill="team-roadmap-dev")                       │
│  args="任务描述" 或 args="--role=xxx"          │
└───────────────────┬───────────────────────────┘
                    │ Role Router
                    │
         ┌──── --role present? ────┐
         │ NO                      │ YES
         ↓                         ↓
  Orchestration Mode         Role Dispatch
  (auto → coordinator)      (route to role.md)
         │
    ┌────┴────┬───────────┬───────────┐
    ↓         ↓           ↓           ↓
┌──────────┐┌─────────┐┌──────────┐┌──────────┐
│coordinator││ planner ││ executor ││ verifier │
│ (human   ││ PLAN-*  ││ EXEC-*   ││ VERIFY-* │
│  交互)   ││         ││          ││          │
└──────────┘└─────────┘└──────────┘└──────────┘
```

## Command Architecture

```
roles/
├── coordinator/
│   ├── role.md                # Orchestrator: roadmap discussion + phase management
│   └── commands/
│       ├── roadmap-discuss.md # Discuss roadmap with user, generate phase plan
│       ├── dispatch.md        # Create task chain per phase
│       ├── monitor.md         # Stop-Wait phase execution loop
│       ├── pause.md           # Save state and exit cleanly
│       └── resume.md          # Resume from paused session
├── planner/
│   ├── role.md                # Research + task JSON generation per phase
│   └── commands/
│       ├── research.md        # Context gathering + codebase exploration
│       └── create-plans.md    # action-planning-agent delegation → IMPL-*.json
├── executor/
│   ├── role.md                # Task execution with wave parallelism
│   └── commands/
│       └── implement.md       # Code implementation via code-developer
└── verifier/
    ├── role.md                # Goal-backward verification
    └── commands/
        └── verify.md          # Convergence criteria checking + gap detection
```

## Role Router

### Input Parsing

```javascript
const args = "$ARGUMENTS"
const roleMatch = args.match(/--role[=\s]+(\w+)/)
const resumeMatch = args.match(/--resume[=\s]+(.+?)(?:\s|$)/)
const teamName = "roadmap-dev"

if (!roleMatch) {
  // No --role: Orchestration Mode → auto route to coordinator
  // If --resume present: coordinator handles resume via commands/resume.md
}

const role = roleMatch ? roleMatch[1] : "coordinator"
const agentName = args.match(/--agent-name[=\s]+([\w-]+)/)?.[1] || role
```

### Role Dispatch

```javascript
const VALID_ROLES = {
  "coordinator": { file: "roles/coordinator/role.md", prefix: null },
  "planner":     { file: "roles/planner/role.md",     prefix: "PLAN" },
  "executor":    { file: "roles/executor/role.md",     prefix: "EXEC" },
  "verifier":    { file: "roles/verifier/role.md",     prefix: "VERIFY" }
}

if (!VALID_ROLES[role]) {
  throw new Error(`Unknown role: ${role}. Available: ${Object.keys(VALID_ROLES).join(', ')}`)
}

Read(VALID_ROLES[role].file)
```

### Orchestration Mode

```javascript
if (!roleMatch) {
  const role = "coordinator"
  Read(VALID_ROLES[role].file)
}
```

### Available Roles

| Role | Task Prefix | Responsibility | Role File |
|------|-------------|----------------|-----------|
| `coordinator` | N/A | Human interaction, roadmap discussion, phase transitions, state management | [roles/coordinator/role.md](roles/coordinator/role.md) |
| `planner` | PLAN-* | Research, context gathering, task JSON generation via action-planning-agent | [roles/planner/role.md](roles/planner/role.md) |
| `executor` | EXEC-* | Code implementation following plans, wave-based parallel execution | [roles/executor/role.md](roles/executor/role.md) |
| `verifier` | VERIFY-* | Convergence criteria verification, gap detection, fix loop trigger | [roles/verifier/role.md](roles/verifier/role.md) |

## Shared Infrastructure

### Artifact System

**Fixed Artifacts** (session-level, persist throughout session):

| Artifact | Path | Created By | Purpose |
|----------|------|------------|---------|
| roadmap.md | `{session}/roadmap.md` | coordinator (roadmap-discuss) | Phase plan with requirements and success criteria |
| state.md | `{session}/state.md` | coordinator | Living memory (<100 lines), updated every significant action |
| config.json | `{session}/config.json` | coordinator | Session settings: mode, depth, gates |

**Dynamic Artifacts** (per-phase, form execution history):

| Artifact | Path | Created By | Purpose |
|----------|------|------------|---------|
| context.md | `{session}/phase-N/context.md` | planner (research) | Phase context and requirements |
| IMPL_PLAN.md | `{session}/phase-N/IMPL_PLAN.md` | planner (create-plans) | Implementation overview with task dependency graph |
| IMPL-*.json | `{session}/phase-N/.task/IMPL-*.json` | planner (create-plans) | Task JSON files (unified flat schema with convergence criteria) |
| TODO_LIST.md | `{session}/phase-N/TODO_LIST.md` | planner (create-plans) | Checklist tracking for all tasks |
| summary-{ID}.md | `{session}/phase-N/summary-{IMPL-ID}.md` | executor (implement) | Execution record with requires/provides/convergence-met |
| verification.md | `{session}/phase-N/verification.md` | verifier (verify) | Convergence criteria check results + gap list |

### Init Prerequisite

Coordinator **must** ensure `.workflow/project-tech.json` exists before starting. If not found, invoke `/workflow:init`.

### Team Configuration

```javascript
const TEAM_CONFIG = {
  name: "roadmap-dev",
  sessionDir: ".workflow/.team/RD-{slug}-{date}/",
  msgDir: ".workflow/.team-msg/roadmap-dev/"
}
```

### Role Isolation Rules

#### Output Tagging

All outputs must carry `[role_name]` prefix.

#### Coordinator Isolation

| Allowed | Forbidden |
|---------|-----------|
| Discuss roadmap with user (AskUserQuestion) | Direct code writing/modification |
| Create task chain (TaskCreate) | Calling implementation subagents |
| Dispatch tasks to workers | Direct analysis/testing/verification |
| Monitor progress (message bus) | Bypassing workers |
| Report results to user | Modifying source code |

#### Worker Isolation

| Allowed | Forbidden |
|---------|-----------|
| Process own-prefix tasks only | Process other roles' tasks |
| SendMessage to coordinator only | Direct worker-to-worker communication |
| Use Toolbox-declared tools | TaskCreate for other roles |
| Delegate to commands/*.md | Modify resources outside scope |

### Message Bus & Task Lifecycle

Each role's role.md contains self-contained Message Bus and Task Lifecycle. See `roles/{role}/role.md`.

## Pipeline

```
Phase N lifecycle:
  Coordinator (roadmap-discuss → dispatch phase N)
    → PLAN-N01: Planner (research → action-planning-agent → IMPL-*.json)
    → EXEC-N01: Executor (load IMPL-*.json → wave-based code-developer)
    → VERIFY-N01: Verifier (convergence criteria check)
    → Coordinator (transition: gap closure or next phase)

Cross-phase flow:
  Init → Roadmap Discussion → Phase 1 → Phase 2 → ... → Phase N → Complete
                                   ↑                          |
                                   └── gap closure loop ──────┘

Session lifecycle:
  Running → Pause (save coordinates) → Resume (re-enter monitor at coordinates)
```

## Coordinator Spawn Template

```javascript
TeamCreate({ team_name: "roadmap-dev" })

// Planner
Task({
  subagent_type: "general-purpose",
  team_name: "roadmap-dev",
  name: "planner",
  prompt: `你是 team "roadmap-dev" 的 PLANNER。

## 首要指令（MUST）
Skill(skill="team-roadmap-dev", args="--role=planner")

当前需求: ${taskDescription}
Session: ${sessionFolder}

## 角色准则
- 只处理 PLAN-* 前缀任务
- 所有输出带 [planner] 标识
- 仅与 coordinator 通信

## 工作流程
1. Skill(skill="team-roadmap-dev", args="--role=planner")
2. TaskList → PLAN-* 任务 → 执行 → 汇报
3. TaskUpdate completed → 检查下一个任务`
})

// Executor
Task({
  subagent_type: "general-purpose",
  team_name: "roadmap-dev",
  name: "executor",
  prompt: `你是 team "roadmap-dev" 的 EXECUTOR。

## 首要指令（MUST）
Skill(skill="team-roadmap-dev", args="--role=executor")

当前需求: ${taskDescription}
Session: ${sessionFolder}

## 角色准则
- 只处理 EXEC-* 前缀任务
- 所有输出带 [executor] 标识
- 仅与 coordinator 通信

## 工作流程
1. Skill(skill="team-roadmap-dev", args="--role=executor")
2. TaskList → EXEC-* 任务 → 执行 → 汇报
3. TaskUpdate completed → 检查下一个任务`
})

// Verifier
Task({
  subagent_type: "general-purpose",
  team_name: "roadmap-dev",
  name: "verifier",
  prompt: `你是 team "roadmap-dev" 的 VERIFIER。

## 首要指令（MUST）
Skill(skill="team-roadmap-dev", args="--role=verifier")

当前需求: ${taskDescription}
Session: ${sessionFolder}

## 角色准则
- 只处理 VERIFY-* 前缀任务
- 所有输出带 [verifier] 标识
- 仅与 coordinator 通信

## 工作流程
1. Skill(skill="team-roadmap-dev", args="--role=verifier")
2. TaskList → VERIFY-* 任务 → 执行 → 汇报
3. TaskUpdate completed → 检查下一个任务`
})
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Unknown --role value | Error with available role list |
| Missing --role arg | Orchestration Mode → auto route to coordinator |
| Role file not found | Error with expected path |
| project-tech.json missing | Coordinator invokes /workflow:init |
| Phase verification fails with gaps | Coordinator triggers gap closure loop |
| Max gap closure iterations (3) | Report to user, ask for guidance |
