---
name: team-issue
description: Unified team skill for issue resolution. All roles invoke this skill with --role arg for role-specific execution. Triggers on "team issue".
allowed-tools: TeamCreate(*), TeamDelete(*), SendMessage(*), TaskCreate(*), TaskUpdate(*), TaskList(*), TaskGet(*), Agent(*), AskUserQuestion(*), Read(*), Write(*), Edit(*), Bash(*), Glob(*), Grep(*), mcp__ace-tool__search_context(*), mcp__ccw-tools__team_msg(*)
---

# Team Issue Resolution

Unified team skill: issue processing pipeline (explore → plan → implement → review → integrate). All team members invoke with `--role=xxx` to route to role-specific execution.

**Scope**: Issue processing flow (plan → queue → execute). Issue creation/discovery handled by `issue-discover`, CRUD management by `issue-manage`.

## Architecture

```
+---------------------------------------------------+
|  Skill(skill="team-issue")                         |
|  args="<issue-ids>"                                |
+-------------------+-------------------------------+
                    |
         Orchestration Mode (auto -> coordinator)
                    |
              Coordinator (inline)
              Phase 0-5 orchestration
                    |
    +-----+-----+-----+-----+-----+
    v     v     v     v     v
 [tw]  [tw]  [tw]  [tw]  [tw]
explor plann review integ- imple-
er     er    er     rator  menter

(tw) = team-worker agent
```

## Role Router

### Input Parsing

Parse `$ARGUMENTS` to extract `--role`. If absent → Orchestration Mode (auto route to coordinator). Extract issue IDs and `--mode` from remaining arguments.

### Role Registry

| Role | Spec | Task Prefix | Inner Loop |
|------|------|-------------|------------|
| coordinator | [roles/coordinator/role.md](roles/coordinator/role.md) | (none) | - |
| explorer | [role-specs/explorer.md](role-specs/explorer.md) | EXPLORE-* | false |
| planner | [role-specs/planner.md](role-specs/planner.md) | SOLVE-* | false |
| reviewer | [role-specs/reviewer.md](role-specs/reviewer.md) | AUDIT-* | false |
| integrator | [role-specs/integrator.md](role-specs/integrator.md) | MARSHAL-* | false |
| implementer | [role-specs/implementer.md](role-specs/implementer.md) | BUILD-* | false |

> **⚠️ COMPACT PROTECTION**: 角色文件是执行文档，不是参考资料。当 context compression 发生后，角色指令仅剩摘要时，**必须立即 `Read` 对应 role.md 重新加载后再继续执行**。不得基于摘要执行任何 Phase。

### Dispatch

1. Extract `--role` from arguments
2. If no `--role` → route to coordinator (Orchestration Mode)
3. Look up role in registry → Read the role file → Execute its phases

### Orchestration Mode

When invoked without `--role`, coordinator auto-starts. User provides issue IDs and optional mode.

**Invocation**: `Skill(skill="team-issue", args="<issue-ids> [--mode=<mode>]")`

**Lifecycle**:
```
User provides issue IDs
  → coordinator Phase 1-3: Mode detection → TeamCreate → Create task chain
  → coordinator Phase 4: spawn first batch workers (background) → STOP
  → Worker executes → SendMessage callback → coordinator advances next step
  → Loop until pipeline complete → Phase 5 report
```

**User Commands** (wake paused coordinator):

| Command | Action |
|---------|--------|
| `check` / `status` | Output execution status graph, no advancement |
| `resume` / `continue` | Check worker states, advance next step |

---

## Shared Infrastructure

The following templates apply to all worker roles. Each role.md only needs to write **Phase 2-4** role-specific logic.

### Worker Phase 1: Task Discovery (shared by all workers)

Every worker executes the same task discovery flow on startup:

1. Call `TaskList()` to get all tasks
2. Filter: subject matches this role's prefix + owner is this role + status is pending + blockedBy is empty
3. No tasks → idle wait
4. Has tasks → `TaskGet` for details → `TaskUpdate` mark in_progress

**Resume Artifact Check** (prevent duplicate output after resume):
- Check whether this task's output artifact already exists
- Artifact complete → skip to Phase 5 report completion
- Artifact incomplete or missing → normal Phase 2-4 execution

### Worker Phase 5: Report (shared by all workers)

Standard reporting flow after task completion:

1. **Message Bus**: Call `mcp__ccw-tools__team_msg` to log message
   - Parameters: operation="log", session_id=<session-id>, from=<role>, type=<message-type>, data={ref: "<artifact-path>"}
   - `to` and `summary` auto-defaulted -- do NOT specify explicitly
   - **CLI fallback**: `ccw team log --session-id <session-id> --from <role> --type <type> --json`
2. **SendMessage**: Send result to coordinator
3. **TaskUpdate**: Mark task completed
4. **Loop**: Return to Phase 1 to check next task

### Wisdom Accumulation (all roles)

Cross-task knowledge accumulation. Coordinator creates `wisdom/` directory at session initialization.

**Directory**:
```
<session-folder>/wisdom/
├── learnings.md      # Patterns and insights
├── decisions.md      # Architecture and design decisions
├── conventions.md    # Codebase conventions
└── issues.md         # Known risks and issues
```

**Worker Load** (Phase 2): Extract `Session: <path>` from task description, read wisdom directory files.
**Worker Contribute** (Phase 4/5): Write this task's discoveries to corresponding wisdom files.

### Role Isolation Rules

| Allowed | Forbidden |
|---------|-----------|
| Process tasks with own prefix | Process tasks with other role prefixes |
| SendMessage to coordinator | Communicate directly with other workers |
| Use tools declared in Toolbox | Create tasks for other roles |
| Delegate to reused agents | Modify resources outside own responsibility |

Coordinator additional restrictions: Do not write/modify code directly, do not execute analysis/review directly. Team members use CLI tools for analysis/implementation tasks.

### Output Tagging

All outputs must carry `[role_name]` prefix in both SendMessage content/summary and team_msg summary.

### Message Bus (All Roles)

Every SendMessage **before**, must call `mcp__ccw-tools__team_msg` to log:

**Parameters**: operation="log", session_id=<session-id>, from=<role>, type=<message-type>, data={ref: "<artifact-path>"}

`to` and `summary` auto-defaulted -- do NOT specify explicitly.

**CLI fallback**: `ccw team log --session-id <session-id> --from <role> --type <type> --json`


**Message types by role**:

| Role | Types |
|------|-------|
| coordinator | `task_assigned`, `pipeline_update`, `escalation`, `shutdown`, `error` |
| explorer | `context_ready`, `impact_assessed`, `error` |
| planner | `solution_ready`, `multi_solution`, `error` |
| reviewer | `approved`, `rejected`, `concerns`, `error` |
| integrator | `queue_ready`, `conflict_found`, `error` |
| implementer | `impl_complete`, `impl_failed`, `error` |

### Team Configuration

| Setting | Value |
|---------|-------|
| Team name | issue |
| Session directory | `.workflow/.team-plan/issue/` |
| Issue data directory | `.workflow/issues/` |

---

## Pipeline Modes

```
Quick Mode (1-2 simple issues):
  EXPLORE-001 → SOLVE-001 → MARSHAL-001 → BUILD-001

Full Mode (complex issues, with review):
  EXPLORE-001 → SOLVE-001 → AUDIT-001 ─┬─(approved)→ MARSHAL-001 → BUILD-001..N(parallel)
                                         └─(rejected)→ SOLVE-fix → AUDIT-002(re-review, max 2x)

Batch Mode (5-100 issues):
  EXPLORE-001..N(batch<=5) → SOLVE-001..N(batch<=3) → AUDIT-001(batch) → MARSHAL-001 → BUILD-001..M(DAG parallel)
```

### Mode Auto-Detection

When user does not specify `--mode`, auto-detect based on issue count and complexity:

| Condition | Mode | Description |
|-----------|------|-------------|
| User explicitly specifies `--mode=<M>` | Use specified mode | User override takes priority |
| Issue count <= 2 AND no high-priority issues (priority < 4) | `quick` | Simple issues, skip review step |
| Issue count <= 2 AND has high-priority issues (priority >= 4) | `full` | Complex issues need review gate |
| Issue count > 2 | `batch` | Multiple issues, parallel exploration and implementation |

### Review Gate (Full/Batch modes)

| AUDIT Verdict | Action |
|---------------|--------|
| approved | Proceed to MARSHAL → BUILD |
| rejected (round < 2) | Create SOLVE-fix task → AUDIT re-review |
| rejected (round >= 2) | Force proceed with warnings, report to user |

### Cadence Control

**Beat model**: Event-driven, each beat = coordinator wake → process → spawn → STOP. Issue beat: explore → plan → implement → review → integrate.

```
Beat Cycle (single beat)
═══════════════════════════════════════════════════════════
  Event                   Coordinator              Workers
───────────────────────────────────────────────────────────
  callback/resume ──→ ┌─ handleCallback ─┐
                      │  mark completed   │
                      │  check pipeline   │
                      ├─ handleSpawnNext ─┤
                      │  find ready tasks │
                      │  spawn workers ───┼──→ [Worker A] Phase 1-5
                      │  (parallel OK)  ──┼──→ [Worker B] Phase 1-5
                      └─ STOP (idle) ─────┘         │
                                                     │
  callback ←─────────────────────────────────────────┘
  (next beat)              SendMessage + TaskUpdate(completed)
═══════════════════════════════════════════════════════════
```

**Pipeline beat views**:

```
Quick Mode (4 beats, strictly serial)
──────────────────────────────────────────────────────────
Beat  1         2         3              4
      │         │         │              │
      EXPLORE → SOLVE → MARSHAL ──→ BUILD
      ▲                                  ▲
   pipeline                           pipeline
    start                              done

EXPLORE=explorer  SOLVE=planner  MARSHAL=integrator  BUILD=implementer

Full Mode (5-7 beats, with review gate)
──────────────────────────────────────────────────────────
Beat  1         2         3              4         5
      │         │         │              │         │
      EXPLORE → SOLVE → AUDIT ─┬─(ok)→ MARSHAL → BUILD
                               │
                          (rejected?)
                        SOLVE-fix → AUDIT-2 → MARSHAL → BUILD

Batch Mode (parallel windows)
──────────────────────────────────────────────────────────
Beat  1                    2                 3         4              5
 ┌────┴────┐         ┌────┴────┐             │         │         ┌────┴────┐
 EXP-1..N    →   SOLVE-1..N    →  AUDIT → MARSHAL → BUILD-1..M
 ▲                                                         ▲
 parallel                                               DAG parallel
 window (<=5)                                          window (<=3)
```

**Checkpoints**:

| Trigger | Location | Behavior |
|---------|----------|----------|
| Review gate | After AUDIT-* | If approved → MARSHAL; if rejected → SOLVE-fix (max 2 rounds) |
| Review loop limit | AUDIT round >= 2 | Force proceed with warnings |
| Pipeline stall | No ready + no running | Check missing tasks, report to user |

**Stall Detection** (coordinator `handleCheck` executes):

| Check | Condition | Resolution |
|-------|-----------|------------|
| Worker no response | in_progress task no callback | Report waiting task list, suggest user `resume` |
| Pipeline deadlock | no ready + no running + has pending | Check blockedBy dependency chain, report blocking point |
| Review loop exceeded | AUDIT rejection > 2 rounds | Terminate loop, force proceed with current solution |

### Task Metadata Registry

| Task ID | Role | Phase | Dependencies | Description |
|---------|------|-------|-------------|-------------|
| EXPLORE-001 | explorer | explore | (none) | Context analysis and impact assessment |
| EXPLORE-002..N | explorer | explore | (none) | Parallel exploration (Batch mode only) |
| SOLVE-001 | planner | plan | EXPLORE-001 (or all EXPLORE-*) | Solution design and task decomposition |
| SOLVE-002..N | planner | plan | EXPLORE-* | Parallel solution design (Batch mode only) |
| AUDIT-001 | reviewer | review | SOLVE-001 (or all SOLVE-*) | Technical feasibility and risk review |
| MARSHAL-001 | integrator | integrate | AUDIT-001 (or last SOLVE-*) | Conflict detection and queue orchestration |
| BUILD-001 | implementer | implement | MARSHAL-001 | Code implementation and result submission |
| BUILD-002..M | implementer | implement | MARSHAL-001 | Parallel implementation (Batch DAG parallel) |

---

## Coordinator Spawn Template

### v5 Worker Spawn (all roles)

When coordinator spawns workers, use `team-worker` agent with role-spec path:

```
Agent({
  subagent_type: "team-worker",
  description: "Spawn <role> worker",
  team_name: "issue",
  name: "<role>",
  run_in_background: true,
  prompt: `## Role Assignment
role: <role>
role_spec: .claude/skills/team-issue/role-specs/<role>.md
session: <session-folder>
session_id: <session-id>
team_name: issue
requirement: <task-description>
inner_loop: false

Read role_spec file to load Phase 2-4 domain instructions.
Execute built-in Phase 1 (task discovery) -> role-spec Phase 2-4 -> built-in Phase 5 (report).`
})
```

**All roles** (explorer, planner, reviewer, integrator, implementer): Set `inner_loop: false`.

### Parallel Spawn (Batch Mode)

> When Batch mode has parallel tasks assigned to the same role, spawn N distinct team-worker agents with unique names.

**Explorer parallel spawn** (Batch mode, N issues):

| Condition | Action |
|-----------|--------|
| Batch mode with N issues (N > 1) | Spawn min(N, 5) team-worker agents: `explorer-1`, `explorer-2`, ... with `run_in_background: true` |
| Quick/Full mode (single explorer) | Standard spawn: single `explorer` team-worker agent |

**Implementer parallel spawn** (Batch mode, M BUILD tasks):

| Condition | Action |
|-----------|--------|
| Batch mode with M BUILD tasks (M > 2) | Spawn min(M, 3) team-worker agents: `implementer-1`, `implementer-2`, ... with `run_in_background: true` |
| Quick/Full mode (single implementer) | Standard spawn: single `implementer` team-worker agent |

**Parallel spawn template**:

```
Agent({
  subagent_type: "team-worker",
  description: "Spawn <role>-<N> worker",
  team_name: "issue",
  name: "<role>-<N>",
  run_in_background: true,
  prompt: `## Role Assignment
role: <role>
role_spec: .claude/skills/team-issue/role-specs/<role>.md
session: <session-folder>
session_id: <session-id>
team_name: issue
requirement: <task-description>
agent_name: <role>-<N>
inner_loop: false

Read role_spec file to load Phase 2-4 domain instructions.
Execute built-in Phase 1 (task discovery, owner=<role>-<N>) -> role-spec Phase 2-4 -> built-in Phase 5 (report).`
})
```

**Dispatch must match agent names**: When dispatching parallel tasks, coordinator sets each task's owner to the corresponding instance name (`explorer-1`, `explorer-2`, etc. or `implementer-1`, `implementer-2`, etc.).

---

## Completion Action

When the pipeline completes (all tasks done, coordinator Phase 5):

```
AskUserQuestion({
  questions: [{
    question: "Issue resolution pipeline complete. What would you like to do?",
    header: "Completion",
    multiSelect: false,
    options: [
      { label: "Archive & Clean (Recommended)", description: "Archive session, clean up tasks and team resources" },
      { label: "Keep Active", description: "Keep session active for follow-up work or inspection" },
      { label: "Export Results", description: "Export deliverables to a specified location, then clean" }
    ]
  }]
})
```

| Choice | Action |
|--------|--------|
| Archive & Clean | Update session status="completed" -> TeamDelete() -> output final summary |
| Keep Active | Update session status="paused" -> output resume instructions: `Skill(skill="team-issue", args="resume")` |
| Export Results | AskUserQuestion for target path -> copy deliverables -> Archive & Clean |

---

## Session Directory

```
.workflow/.team-plan/issue/
├── .msg/
│   ├── messages.jsonl          # Message bus log
│   └── meta.json               # Session state + cross-role state
├── wisdom/                     # Cross-task knowledge
│   ├── learnings.md
│   ├── decisions.md
│   ├── conventions.md
│   └── issues.md
├── explorations/               # Explorer output
├── solutions/                  # Planner output
├── audits/                     # Reviewer output
├── queue/                      # Integrator output
└── builds/                     # Implementer output
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Unknown --role value | Error with available role list |
| Missing --role arg | Orchestration Mode → auto route to coordinator |
| Role file not found | Error with expected path (roles/<name>.md) |
| Task prefix conflict | Log warning, proceed |
| Review rejection exceeds 2 rounds | Force proceed with warnings |
| No issues found for given IDs | Coordinator reports error to user |
