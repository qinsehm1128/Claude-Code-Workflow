---
name: team-quality-assurance
description: Unified team skill for quality assurance team. All roles invoke this skill with --role arg for role-specific execution. Triggers on "team quality-assurance", "team qa".
allowed-tools: TeamCreate(*), TeamDelete(*), SendMessage(*), TaskCreate(*), TaskUpdate(*), TaskList(*), TaskGet(*), Agent(*), AskUserQuestion(*), Read(*), Write(*), Edit(*), Bash(*), Glob(*), Grep(*)
---

# Team Quality Assurance

Unified team skill: quality assurance combining issue discovery and software testing into a closed loop of scout -> strategy -> generate -> execute -> analyze. Uses multi-perspective scanning, Generator-Executor pipeline, and shared defect pattern database for progressive quality assurance. All team members invoke with `--role=xxx` to route to role-specific execution.

## Architecture

```
+---------------------------------------------------+
|  Skill(skill="team-quality-assurance")             |
|  args="<task-description>"                         |
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
scout  stra-  gene- execu- analy-
       tegist rator tor    st

(tw) = team-worker agent
```

## Command Architecture

```
roles/
├── coordinator/
│   ├── role.md              # Pipeline orchestration (mode selection, task dispatch, monitoring)
│   └── commands/
│       ├── dispatch.md      # Task chain creation
│       └── monitor.md       # Progress monitoring
├── scout/
│   ├── role.md              # Multi-perspective issue scanning
│   └── commands/
│       └── scan.md          # Multi-perspective CLI fan-out scanning
├── strategist/
│   ├── role.md              # Test strategy formulation
│   └── commands/
│       └── analyze-scope.md # Change scope analysis
├── generator/
│   ├── role.md              # Test case generation
│   └── commands/
│       └── generate-tests.md # Layer-based test code generation
├── executor/
│   ├── role.md              # Test execution and fix cycles
│   └── commands/
│       └── run-fix-cycle.md # Iterative test-fix loop
└── analyst/
    ├── role.md              # Quality analysis reporting
    └── commands/
        └── quality-report.md # Defect pattern + coverage analysis
```

**Design principle**: role.md retains Phase 1 (Task Discovery) and Phase 5 (Report) inline. Phase 2-4 delegate to `commands/*.md` based on complexity.

## Role Router

### Input Parsing

Parse `$ARGUMENTS` to extract `--role`. If absent -> Orchestration Mode (auto route to coordinator).

### Role Registry

| Role | Spec | Task Prefix | Inner Loop |
|------|------|-------------|------------|
| coordinator | [roles/coordinator/role.md](roles/coordinator/role.md) | (none) | - |
| scout | [role-specs/scout.md](role-specs/scout.md) | SCOUT-* | false |
| strategist | [role-specs/strategist.md](role-specs/strategist.md) | QASTRAT-* | false |
| generator | [role-specs/generator.md](role-specs/generator.md) | QAGEN-* | false |
| executor | [role-specs/executor.md](role-specs/executor.md) | QARUN-* | true |
| analyst | [role-specs/analyst.md](role-specs/analyst.md) | QAANA-* | false |

> **COMPACT PROTECTION**: Role files are execution documents, not reference material. When context compression occurs and role instructions are reduced to summaries, **you MUST immediately `Read` the corresponding role.md to reload before continuing execution**. Do not execute any Phase based on summaries.

### Dispatch

1. Extract `--role` from arguments
2. If no `--role` -> route to coordinator (Orchestration Mode)
3. Look up role in registry -> Read the role file -> Execute its phases

### Orchestration Mode

When invoked without `--role`, coordinator auto-starts. User just provides task description.

**Invocation**: `Skill(skill="team-quality-assurance", args="<task-description>")`

**Lifecycle**:
```
User provides task description
  -> coordinator Phase 1-3: Mode detection + requirement clarification -> TeamCreate -> Create task chain
  -> coordinator Phase 4: spawn first batch workers (background) -> STOP
  -> Worker executes -> SendMessage callback -> coordinator advances next step
  -> Loop until pipeline complete -> Phase 5 report
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
3. No tasks -> idle wait
4. Has tasks -> `TaskGet` for details -> `TaskUpdate` mark in_progress

**Resume Artifact Check** (prevent duplicate output after resume):
- Check whether this task's output artifact already exists
- Artifact complete -> skip to Phase 5 report completion
- Artifact incomplete or missing -> normal Phase 2-4 execution

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

#### Output Tagging

All outputs must carry `[role_name]` prefix.

#### Coordinator Isolation

| Allowed | Forbidden |
|---------|-----------|
| Requirement clarification (AskUserQuestion) | Direct test writing |
| Create task chain (TaskCreate) | Direct test execution or scanning |
| Mode selection + quality gating | Direct coverage analysis |
| Monitor progress (message bus) | Bypassing workers |

#### Worker Isolation

| Allowed | Forbidden |
|---------|-----------|
| Process tasks with own prefix | Process tasks with other role prefixes |
| Share state via team_msg(type='state_update') | Create tasks for other roles |
| SendMessage to coordinator | Communicate directly with other workers |
| Delegate to commands/ files | Modify resources outside own responsibility |

### Team Configuration

| Setting | Value |
|---------|-------|
| Team name | quality-assurance |
| Session directory | `.workflow/.team/QA-<slug>-<date>/` |
| Test layers | L1: Unit (80%), L2: Integration (60%), L3: E2E (40%) |
| Scan perspectives | bug, security, ux, test-coverage, code-quality |

### Shared Memory

Cross-role accumulated knowledge stored via team_msg(type='state_update'):

| Field | Owner | Content |
|-------|-------|---------|
| `discovered_issues` | scout | Multi-perspective scan findings |
| `test_strategy` | strategist | Layer selection, coverage targets, scope |
| `generated_tests` | generator | Test file paths and metadata |
| `execution_results` | executor | Test run results and coverage data |
| `defect_patterns` | analyst | Recurring defect pattern database |
| `quality_score` | analyst | Overall quality assessment |
| `coverage_history` | analyst | Coverage trend over time |

Each role reads in Phase 2, writes own fields in Phase 5.

### Message Bus (All Roles)

Every SendMessage **before**, must call `mcp__ccw-tools__team_msg` to log.

**Message types by role**:

| Role | Types |
|------|-------|
| coordinator | `mode_selected`, `gc_loop_trigger`, `quality_gate`, `task_unblocked`, `error`, `shutdown` |
| scout | `scan_ready`, `issues_found`, `error` |
| strategist | `strategy_ready`, `error` |
| generator | `tests_generated`, `tests_revised`, `error` |
| executor | `tests_passed`, `tests_failed`, `coverage_report`, `error` |
| analyst | `analysis_ready`, `quality_report`, `error` |

---

## Three-Mode Pipeline Architecture

### Mode Auto-Detection

| Condition | Mode |
|-----------|------|
| Explicit `--mode=discovery` flag | discovery |
| Explicit `--mode=testing` flag | testing |
| Explicit `--mode=full` flag | full |
| Task description contains: discovery/scan/issue keywords | discovery |
| Task description contains: test/coverage/TDD keywords | testing |
| No explicit flag and no keyword match | full (default) |

### Pipeline Diagrams

```
Discovery Mode (issue discovery first):
  SCOUT-001(multi-perspective scan) -> QASTRAT-001 -> QAGEN-001 -> QARUN-001 -> QAANA-001

Testing Mode (skip scout, test first):
  QASTRAT-001(change analysis) -> QAGEN-001(L1) -> QARUN-001(L1) -> QAGEN-002(L2) -> QARUN-002(L2) -> QAANA-001

Full QA Mode (complete closed loop):
  SCOUT-001(scan) -> QASTRAT-001(strategy)
  -> [QAGEN-001(L1) || QAGEN-002(L2)](parallel) -> [QARUN-001 || QARUN-002](parallel)
  -> QAANA-001(analysis) -> SCOUT-002(regression scan)
```

### Generator-Executor Pipeline (GC Loop)

Generator and executor iterate per test layer until coverage targets are met:

```
QAGEN -> QARUN -> (if coverage < target) -> QAGEN-fix -> QARUN-2
                  (if coverage >= target) -> next layer or QAANA
```

Coordinator monitors GC loop progress. After 3 GC iterations without convergence, accept current coverage with warning.

In Full QA mode, spawn N generator agents in parallel (one per test layer). Each receives a QAGEN-N task with layer assignment. Use `run_in_background: true` for all spawns, then coordinator stops and waits for callbacks. Similarly spawn N executor agents in parallel for QARUN-N tasks.

### Cadence Control

**Beat model**: Event-driven, each beat = coordinator wake -> process -> spawn -> STOP.

```
Beat Cycle (single beat)
═══════════════════════════════════════════════════════════
  Event                   Coordinator              Workers
───────────────────────────────────────────────────────────
  callback/resume ──> ┌─ handleCallback ─┐
                      │  mark completed   │
                      │  check pipeline   │
                      ├─ handleSpawnNext ─┤
                      │  find ready tasks │
                      │  spawn workers ───┼──> [Worker A] Phase 1-5
                      │  (parallel OK)  ──┼──> [Worker B] Phase 1-5
                      └─ STOP (idle) ─────┘         │
                                                     │
  callback <─────────────────────────────────────────┘
  (next beat)              SendMessage + TaskUpdate(completed)
═══════════════════════════════════════════════════════════
```

**Pipeline beat view**:

```
Discovery mode (5 beats, strictly serial)
──────────────────────────────────────────────────────────
Beat  1         2         3         4         5
      │         │         │         │         │
      SCOUT -> STRAT -> GEN -> RUN -> ANA
      ▲                                      ▲
   pipeline                               pipeline
    start                                  done

S=SCOUT  STRAT=QASTRAT  GEN=QAGEN  RUN=QARUN  ANA=QAANA

Testing mode (6 beats, layer progression)
──────────────────────────────────────────────────────────
Beat  1         2         3         4         5         6
      │         │         │         │         │         │
      STRAT -> GEN-L1 -> RUN-L1 -> GEN-L2 -> RUN-L2 -> ANA
      ▲                                                  ▲
   no scout                                           analysis
   (test only)

Full QA mode (6 beats, with parallel windows + regression)
──────────────────────────────────────────────────────────
Beat  1       2       3              4              5       6
      │       │  ┌────┴────┐   ┌────┴────┐         │       │
      SCOUT -> STRAT -> GEN-L1||GEN-L2 -> RUN-1||RUN-2 -> ANA -> SCOUT-2
                        ▲                                          ▲
                   parallel gen                              regression
                                                               scan
```

**Checkpoints**:

| Trigger | Location | Behavior |
|---------|----------|----------|
| GC loop limit | QARUN coverage < target | After 3 iterations, accept current coverage with warning |
| Pipeline stall | No ready + no running | Check missing tasks, report to user |
| Regression scan (full mode) | QAANA-001 complete | Trigger SCOUT-002 for regression verification |

**Stall Detection** (coordinator `handleCheck` executes):

| Check | Condition | Resolution |
|-------|-----------|------------|
| Worker no response | in_progress task no callback | Report waiting task list, suggest user `resume` |
| Pipeline deadlock | no ready + no running + has pending | Check blockedBy dependency chain, report blocking point |
| GC loop exceeded | generator/executor iteration > 3 | Terminate loop, output latest coverage report |

### Task Metadata Registry

| Task ID | Role | Phase | Dependencies | Description |
|---------|------|-------|-------------|-------------|
| SCOUT-001 | scout | discovery | (none) | Multi-perspective issue scanning |
| QASTRAT-001 | strategist | strategy | SCOUT-001 or (none) | Change scope analysis + test strategy |
| QAGEN-001 | generator | generation | QASTRAT-001 | L1 unit test generation |
| QAGEN-002 | generator | generation | QASTRAT-001 (full mode) | L2 integration test generation |
| QARUN-001 | executor | execution | QAGEN-001 | L1 test execution + fix cycles |
| QARUN-002 | executor | execution | QAGEN-002 (full mode) | L2 test execution + fix cycles |
| QAANA-001 | analyst | analysis | QARUN-001 (+ QARUN-002) | Defect pattern analysis + quality report |
| SCOUT-002 | scout | regression | QAANA-001 (full mode) | Regression scan after fixes |

---

## Coordinator Spawn Template

### v5 Worker Spawn (all roles)

When coordinator spawns workers, use `team-worker` agent with role-spec path:

```
Agent({
  agent_type: "team-worker",
  description: "Spawn <role> worker",
  team_name: "quality-assurance",
  name: "<role>",
  run_in_background: true,
  prompt: `## Role Assignment
role: <role>
role_spec: .claude/skills/team-quality-assurance/role-specs/<role>.md
session: <session-folder>
session_id: <session-id>
team_name: quality-assurance
requirement: <task-description>
inner_loop: <true|false>

Read role_spec file to load Phase 2-4 domain instructions.
Execute built-in Phase 1 (task discovery) -> role-spec Phase 2-4 -> built-in Phase 5 (report).`
})
```

**Inner Loop roles** (executor): Set `inner_loop: true`.

**Single-task roles** (scout, strategist, generator, analyst): Set `inner_loop: false`.

### Parallel Spawn (N agents for same role)

> When pipeline has parallel tasks assigned to the same role, spawn N distinct team-worker agents with unique names.

**Parallel detection**:

| Condition | Action |
|-----------|--------|
| N parallel tasks for same role prefix | Spawn N agents named `<role>-1`, `<role>-2` ... |
| Single task for role | Standard spawn (single agent) |

**Parallel spawn template**:

```
Agent({
  agent_type: "team-worker",
  description: "Spawn <role>-<N> worker",
  team_name: "quality-assurance",
  name: "<role>-<N>",
  run_in_background: true,
  prompt: `## Role Assignment
role: <role>
role_spec: .claude/skills/team-quality-assurance/role-specs/<role>.md
session: <session-folder>
session_id: <session-id>
team_name: quality-assurance
requirement: <task-description>
agent_name: <role>-<N>
inner_loop: <true|false>

Read role_spec file to load Phase 2-4 domain instructions.
Execute built-in Phase 1 (task discovery, owner=<role>-<N>) -> role-spec Phase 2-4 -> built-in Phase 5 (report).`
})
```

**Dispatch must match agent names**: In dispatch, parallel tasks use instance-specific owner: `<role>-<N>`.

---

## Completion Action

When the pipeline completes (all tasks done, coordinator Phase 5):

```
AskUserQuestion({
  questions: [{
    question: "Quality Assurance pipeline complete. What would you like to do?",
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
| Keep Active | Update session status="paused" -> output resume instructions: `Skill(skill="team-quality-assurance", args="resume")` |
| Export Results | AskUserQuestion for target path -> copy deliverables -> Archive & Clean |

## Unified Session Directory

```
.workflow/.team/QA-<slug>-<YYYY-MM-DD>/
├── .msg/meta.json           # Session state
├── .msg/messages.jsonl          # Team message bus
├── .msg/meta.json               # Session metadata
├── wisdom/                     # Cross-task knowledge
│   ├── learnings.md
│   ├── decisions.md
│   ├── conventions.md
│   └── issues.md
├── scan/                       # Scout output
│   └── scan-results.json
├── strategy/                   # Strategist output
│   └── test-strategy.md
├── tests/                      # Generator output
│   ├── L1-unit/
│   ├── L2-integration/
│   └── L3-e2e/
├── results/                    # Executor output
│   ├── run-001.json
│   └── coverage-001.json
└── analysis/                   # Analyst output
    └── quality-report.md
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Unknown --role value | Error with available role list |
| Missing --role arg | Orchestration Mode -> auto route to coordinator |
| Role file not found | Error with expected path (roles/<name>/role.md) |
| Task prefix conflict | Log warning, proceed |
| Coverage never reaches target | After 3 GC loops, accept current with warning |
| Scout finds no issues | Report clean scan, skip to testing mode |
| Test environment broken | Notify user, suggest manual fix |
