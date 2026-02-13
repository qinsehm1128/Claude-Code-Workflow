---
name: team-lifecycle
description: Unified team skill for full lifecycle - spec/impl/test. All roles invoke this skill with --role arg for role-specific execution.
allowed-tools: TeamCreate(*), TeamDelete(*), SendMessage(*), TaskCreate(*), TaskUpdate(*), TaskList(*), TaskGet(*), Task(*), AskUserQuestion(*), TodoWrite(*), Read(*), Write(*), Edit(*), Bash(*), Glob(*), Grep(*)
---

# Team Lifecycle

Unified team skill covering specification, implementation, testing, and review. All team members invoke this skill with `--role=xxx` to route to role-specific execution.

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  Skill(skill="team-lifecycle", args="--role=xxx") │
└───────────────────┬─────────────────────────────┘
                    │ Role Router
    ┌───────┬───────┼───────┬───────┬───────┬───────┬───────┐
    ↓       ↓       ↓       ↓       ↓       ↓       ↓       ↓
┌─────────┐┌───────┐┌──────┐┌──────────┐┌───────┐┌────────┐┌──────┐┌────────┐
│coordinator││analyst││writer││discussant││planner││executor││tester││reviewer│
│ roles/   ││roles/ ││roles/││ roles/   ││roles/ ││ roles/ ││roles/││ roles/ │
└─────────┘└───────┘└──────┘└──────────┘└───────┘└────────┘└──────┘└────────┘
```

## Role Router

### Input Parsing

Parse `$ARGUMENTS` to extract `--role`:

```javascript
const args = "$ARGUMENTS"
const roleMatch = args.match(/--role[=\s]+(\w+)/)

if (!roleMatch) {
  throw new Error("Missing --role argument. Available roles: coordinator, analyst, writer, discussant, planner, executor, tester, reviewer")
}

const role = roleMatch[1]
const teamName = args.match(/--team[=\s]+([\w-]+)/)?.[1] || "lifecycle"
```

### Role Dispatch

```javascript
const VALID_ROLES = {
  "coordinator": { file: "roles/coordinator.md", prefix: null },
  "analyst":     { file: "roles/analyst.md",     prefix: "RESEARCH" },
  "writer":      { file: "roles/writer.md",      prefix: "DRAFT" },
  "discussant":  { file: "roles/discussant.md",  prefix: "DISCUSS" },
  "planner":     { file: "roles/planner.md",     prefix: "PLAN" },
  "executor":    { file: "roles/executor.md",    prefix: "IMPL" },
  "tester":      { file: "roles/tester.md",      prefix: "TEST" },
  "reviewer":    { file: "roles/reviewer.md",    prefix: ["REVIEW", "QUALITY"] }
}

if (!VALID_ROLES[role]) {
  throw new Error(`Unknown role: ${role}. Available: ${Object.keys(VALID_ROLES).join(', ')}`)
}

// Read and execute role-specific logic
Read(VALID_ROLES[role].file)
// → Execute the 5-phase process defined in that file
```

### Available Roles

| Role | Task Prefix | Responsibility | Role File |
|------|-------------|----------------|-----------|
| `coordinator` | N/A | Pipeline orchestration, requirement clarification, task dispatch | [roles/coordinator.md](roles/coordinator.md) |
| `analyst` | RESEARCH-* | Seed analysis, codebase exploration, context gathering | [roles/analyst.md](roles/analyst.md) |
| `writer` | DRAFT-* | Product Brief / PRD / Architecture / Epics generation | [roles/writer.md](roles/writer.md) |
| `discussant` | DISCUSS-* | Multi-perspective critique, consensus building | [roles/discussant.md](roles/discussant.md) |
| `planner` | PLAN-* | Multi-angle exploration, structured planning | [roles/planner.md](roles/planner.md) |
| `executor` | IMPL-* | Code implementation following plans | [roles/executor.md](roles/executor.md) |
| `tester` | TEST-* | Adaptive test-fix cycles, quality gates | [roles/tester.md](roles/tester.md) |
| `reviewer` | `REVIEW-*` + `QUALITY-*` | Code review + Spec quality validation (auto-switch by prefix) | [roles/reviewer.md](roles/reviewer.md) |

## Shared Infrastructure

### Message Bus (All Roles)

Every SendMessage **before**, must call `mcp__ccw-tools__team_msg` to log:

```javascript
mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: role,
  to: "coordinator",
  type: "<type>",
  summary: "<summary>",
  ref: "<file_path>"
})
```

**Message types by role**:

| Role | Types |
|------|-------|
| coordinator | `plan_approved`, `plan_revision`, `task_unblocked`, `fix_required`, `error`, `shutdown` |
| analyst | `research_ready`, `research_progress`, `error` |
| writer | `draft_ready`, `draft_revision`, `impl_progress`, `error` |
| discussant | `discussion_ready`, `discussion_blocked`, `impl_progress`, `error` |
| planner | `plan_ready`, `plan_revision`, `impl_progress`, `error` |
| executor | `impl_complete`, `impl_progress`, `error` |
| tester | `test_result`, `impl_progress`, `fix_required`, `error` |
| reviewer | `review_result`, `quality_result`, `fix_required`, `error` |

### CLI Fallback

When `mcp__ccw-tools__team_msg` MCP is unavailable:

```javascript
Bash(`ccw team log --team "${teamName}" --from "${role}" --to "coordinator" --type "<type>" --summary "<summary>" --json`)
Bash(`ccw team list --team "${teamName}" --last 10 --json`)
Bash(`ccw team status --team "${teamName}" --json`)
```

### Task Lifecycle (All Worker Roles)

```javascript
// Standard task lifecycle every worker role follows
// Phase 1: Discovery
const tasks = TaskList()
const prefixes = Array.isArray(VALID_ROLES[role].prefix) ? VALID_ROLES[role].prefix : [VALID_ROLES[role].prefix]
const myTasks = tasks.filter(t =>
  prefixes.some(p => t.subject.startsWith(`${p}-`)) &&
  t.owner === role &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)
if (myTasks.length === 0) return // idle
const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })

// Phase 2-4: Role-specific (see roles/{role}.md)

// Phase 5: Report + Loop
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: role, to: "coordinator", type: "...", summary: "..." })
SendMessage({ type: "message", recipient: "coordinator", content: "...", summary: "..." })
TaskUpdate({ taskId: task.id, status: 'completed' })
// Check for next task → back to Phase 1
```

## Three-Mode Pipeline

```
Spec-only:
  RESEARCH-001 → DISCUSS-001 → DRAFT-001 → DISCUSS-002
  → DRAFT-002 → DISCUSS-003 → DRAFT-003 → DISCUSS-004
  → DRAFT-004 → DISCUSS-005 → QUALITY-001 → DISCUSS-006

Impl-only:
  PLAN-001 → IMPL-001 → TEST-001 + REVIEW-001

Full-lifecycle:
  [Spec pipeline] → PLAN-001(blockedBy: DISCUSS-006) → IMPL-001 → TEST-001 + REVIEW-001
```

## Coordinator Spawn Template

When coordinator creates teammates:

```javascript
TeamCreate({ team_name: teamName })

// Analyst (spec-only / full)
Task({
  subagent_type: "general-purpose",
  team_name: teamName,
  name: "analyst",
  prompt: `你是 team "${teamName}" 的 ANALYST。
当你收到 RESEARCH-* 任务时，调用 Skill(skill="team-lifecycle", args="--role=analyst") 执行。
当前需求: ${taskDescription}
约束: ${constraints}
Session: ${sessionFolder}

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录。

工作流程:
1. TaskList → 找到 RESEARCH-* 任务
2. Skill(skill="team-lifecycle", args="--role=analyst") 执行
3. team_msg log + SendMessage 结果给 coordinator
4. TaskUpdate completed → 检查下一个任务`
})

// Writer (spec-only / full)
Task({
  subagent_type: "general-purpose",
  team_name: teamName,
  name: "writer",
  prompt: `你是 team "${teamName}" 的 WRITER。
当你收到 DRAFT-* 任务时，调用 Skill(skill="team-lifecycle", args="--role=writer") 执行。
当前需求: ${taskDescription}
Session: ${sessionFolder}

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录。

工作流程:
1. TaskList → 找到 DRAFT-* 任务
2. Skill(skill="team-lifecycle", args="--role=writer") 执行
3. team_msg log + SendMessage 结果给 coordinator
4. TaskUpdate completed → 检查下一个任务`
})

// Discussant (spec-only / full)
Task({
  subagent_type: "general-purpose",
  team_name: teamName,
  name: "discussant",
  prompt: `你是 team "${teamName}" 的 DISCUSSANT。
当你收到 DISCUSS-* 任务时，调用 Skill(skill="team-lifecycle", args="--role=discussant") 执行。
当前需求: ${taskDescription}
Session: ${sessionFolder}
讨论深度: ${discussionDepth}

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录。

工作流程:
1. TaskList → 找到 DISCUSS-* 任务
2. Skill(skill="team-lifecycle", args="--role=discussant") 执行
3. team_msg log + SendMessage 结果给 coordinator
4. TaskUpdate completed → 检查下一个任务`
})

// Planner (impl-only / full)
Task({
  subagent_type: "general-purpose",
  team_name: teamName,
  name: "planner",
  prompt: `你是 team "${teamName}" 的 PLANNER。
当你收到 PLAN-* 任务时，调用 Skill(skill="team-lifecycle", args="--role=planner") 执行。
当前需求: ${taskDescription}
约束: ${constraints}

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录。

工作流程:
1. TaskList → 找到 PLAN-* 任务
2. Skill(skill="team-lifecycle", args="--role=planner") 执行
3. team_msg log + SendMessage 结果给 coordinator
4. TaskUpdate completed → 检查下一个任务`
})

// Executor (impl-only / full)
Task({
  subagent_type: "general-purpose",
  team_name: teamName,
  name: "executor",
  prompt: `你是 team "${teamName}" 的 EXECUTOR。
当你收到 IMPL-* 任务时，调用 Skill(skill="team-lifecycle", args="--role=executor") 执行。
当前需求: ${taskDescription}
约束: ${constraints}

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录。

工作流程:
1. TaskList → 找到 IMPL-* 任务
2. Skill(skill="team-lifecycle", args="--role=executor") 执行
3. team_msg log + SendMessage 结果给 coordinator
4. TaskUpdate completed → 检查下一个任务`
})

// Tester (impl-only / full)
Task({
  subagent_type: "general-purpose",
  team_name: teamName,
  name: "tester",
  prompt: `你是 team "${teamName}" 的 TESTER。
当你收到 TEST-* 任务时，调用 Skill(skill="team-lifecycle", args="--role=tester") 执行。
当前需求: ${taskDescription}
约束: ${constraints}

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录。

工作流程:
1. TaskList → 找到 TEST-* 任务
2. Skill(skill="team-lifecycle", args="--role=tester") 执行
3. team_msg log + SendMessage 结果给 coordinator
4. TaskUpdate completed → 检查下一个任务`
})

// Reviewer (all modes)
Task({
  subagent_type: "general-purpose",
  team_name: teamName,
  name: "reviewer",
  prompt: `你是 team "${teamName}" 的 REVIEWER。
当你收到 REVIEW-* 或 QUALITY-* 任务时，调用 Skill(skill="team-lifecycle", args="--role=reviewer") 执行。
- REVIEW-* → 代码审查逻辑
- QUALITY-* → 规格质量检查逻辑
当前需求: ${taskDescription}

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录。

工作流程:
1. TaskList → 找到 REVIEW-* 或 QUALITY-* 任务
2. Skill(skill="team-lifecycle", args="--role=reviewer") 执行
3. team_msg log + SendMessage 结果给 coordinator
4. TaskUpdate completed → 检查下一个任务`
})
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Unknown --role value | Error with available role list |
| Missing --role arg | Error with usage hint |
| Role file not found | Error with expected path |
| Task prefix conflict | Log warning, proceed |
