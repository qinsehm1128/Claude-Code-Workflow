---
name: team-brainstorm
description: Unified team skill for brainstorming team. All roles invoke this skill with --role arg for role-specific execution. Triggers on "team brainstorm".
allowed-tools: TeamCreate(*), TeamDelete(*), SendMessage(*), TaskCreate(*), TaskUpdate(*), TaskList(*), TaskGet(*), Agent(*), AskUserQuestion(*), Read(*), Write(*), Edit(*), Bash(*), Glob(*), Grep(*)
---

# Team Brainstorm

Unified team skill: multi-angle brainstorming via Generator-Critic loops, shared memory, and dynamic pipeline selection. All team members invoke with `--role=xxx` to route to role-specific execution.

## Architecture

```
+---------------------------------------------------+
|  Skill(skill="team-brainstorm")                    |
|  args="<topic-description>"                        |
+-------------------+-------------------------------+
                    |
         Orchestration Mode (auto -> coordinator)
                    |
              Coordinator (inline)
              Phase 0-5 orchestration
                    |
    +-------+-------+-------+-------+
    v       v       v       v
 [tw]    [tw]    [tw]    [tw]
ideator  chall-  synthe- evalua-
         enger   sizer   tor

(tw) = team-worker agent
```

## Command Execution Protocol

When coordinator needs to execute a command (dispatch, monitor):

1. **Read the command file**: `roles/coordinator/commands/<command-name>.md`
2. **Follow the workflow** defined in the command file (Phase 2-4 structure)
3. **Commands are inline execution guides** -- NOT separate agents or subprocesses
4. **Execute synchronously** -- complete the command workflow before proceeding

## Role Router

### Input Parsing

Parse `$ARGUMENTS` to extract `--role`. If absent → Orchestration Mode (auto route to coordinator).

### Role Registry

| Role | Spec | Task Prefix | Inner Loop |
|------|------|-------------|------------|
| coordinator | [roles/coordinator/role.md](roles/coordinator/role.md) | (none) | - |
| ideator | [role-specs/ideator.md](role-specs/ideator.md) | IDEA-* | false |
| challenger | [role-specs/challenger.md](role-specs/challenger.md) | CHALLENGE-* | false |
| synthesizer | [role-specs/synthesizer.md](role-specs/synthesizer.md) | SYNTH-* | false |
| evaluator | [role-specs/evaluator.md](role-specs/evaluator.md) | EVAL-* | false |

> **⚠️ COMPACT PROTECTION**: 角色文件是执行文档，不是参考资料。当 context compression 发生后，角色指令仅剩摘要时，**必须立即 `Read` 对应 role.md 重新加载后再继续执行**。不得基于摘要执行任何 Phase。

### Dispatch

1. Extract `--role` from arguments
2. If no `--role` → route to coordinator (Orchestration Mode)
3. Look up role in registry → Read the role file → Execute its phases

### Orchestration Mode

When invoked without `--role`, coordinator auto-starts. User just provides topic description.

**Invocation**: `Skill(skill="team-brainstorm", args="<topic-description>")`

**Lifecycle**:
```
User provides topic description
  → coordinator Phase 1-3: Topic clarification → TeamCreate → Create task chain
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
| Share state via team_msg(type="state_update") | Create tasks for other roles |
| Delegate to commands/ files | Modify resources outside own responsibility |

Coordinator additional restrictions: Do not generate ideas directly, do not evaluate/challenge ideas, do not execute analysis/synthesis, do not bypass workers.

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
| coordinator | `pipeline_selected`, `gc_loop_trigger`, `task_unblocked`, `error`, `shutdown` |
| ideator | `ideas_ready`, `ideas_revised`, `error` |
| challenger | `critique_ready`, `error` |
| synthesizer | `synthesis_ready`, `error` |
| evaluator | `evaluation_ready`, `error` |

### Shared State

Cross-role state is shared via `team_msg(type="state_update")` messages, persisted in `.msg/meta.json`:

| Role | State Key |
|------|-----------|
| ideator | `generated_ideas` |
| challenger | `critique_insights` |
| synthesizer | `synthesis_themes` |
| evaluator | `evaluation_scores` |

### Team Configuration

| Setting | Value |
|---------|-------|
| Team name | brainstorm |
| Session directory | `.workflow/.team/BRS-<slug>-<date>/` |
| Message store | `.msg/messages.jsonl` + `.msg/meta.json` in session dir |

---

## Three-Pipeline Architecture

```
Quick:
  IDEA-001 → CHALLENGE-001 → SYNTH-001

Deep (Generator-Critic Loop):
  IDEA-001 → CHALLENGE-001 → IDEA-002(fix) → CHALLENGE-002 → SYNTH-001 → EVAL-001

Full (Fan-out + Generator-Critic):
  [IDEA-001 + IDEA-002 + IDEA-003](parallel) → CHALLENGE-001(batch) → IDEA-004(fix) → SYNTH-001 → EVAL-001
```

### Generator-Critic Loop

ideator <-> challenger loop, max 2 rounds:

```
IDEA → CHALLENGE → (if critique.severity >= HIGH) → IDEA-fix → CHALLENGE-2 → SYNTH
                   (if critique.severity < HIGH) → SYNTH
```

### Cadence Control

**Beat model**: Event-driven, each beat = coordinator wake → process → spawn → STOP. Brainstorm beat: generate → challenge → synthesize → evaluate.

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
Quick (3 beats, strictly serial)
──────────────────────────────────────────────────────────
Beat  1         2              3
      │         │              │
      IDEA → CHALLENGE ──→ SYNTH
      ▲                        ▲
   pipeline                 pipeline
    start                    done

IDEA=ideator  CHALLENGE=challenger  SYNTH=synthesizer

Deep (5-6 beats, with Generator-Critic loop)
──────────────────────────────────────────────────────────
Beat  1         2              3         4         5         6
      │         │              │         │         │         │
      IDEA → CHALLENGE → (GC loop?) → IDEA-fix → SYNTH → EVAL
                              │
                        severity check
                  (< HIGH → skip to SYNTH)

Full (4-7 beats, fan-out + Generator-Critic)
──────────────────────────────────────────────────────────
Beat  1                    2              3-4        5         6
 ┌────┴────┐               │              │          │         │
 IDEA-1 ∥ IDEA-2 ∥ IDEA-3 → CHALLENGE → (GC loop) → SYNTH → EVAL
 ▲                                                              ▲
 parallel                                                    pipeline
 window                                                       done
```

**Checkpoints**:

| Trigger | Location | Behavior |
|---------|----------|----------|
| Generator-Critic loop | After CHALLENGE-* | If severity >= HIGH → create IDEA-fix task; else proceed to SYNTH |
| GC loop limit | Max 2 rounds | Exceeds limit → force convergence to SYNTH |
| Pipeline stall | No ready + no running | Check missing tasks, report to user |

**Stall Detection** (coordinator `handleCheck` executes):

| Check | Condition | Resolution |
|-------|-----------|------------|
| Worker no response | in_progress task no callback | Report waiting task list, suggest user `resume` |
| Pipeline deadlock | no ready + no running + has pending | Check blockedBy dependency chain, report blocking point |
| GC loop exceeded | ideator/challenger iteration > 2 rounds | Terminate loop, force convergence to synthesizer |

### Task Metadata Registry

| Task ID | Role | Phase | Dependencies | Description |
|---------|------|-------|-------------|-------------|
| IDEA-001 | ideator | generate | (none) | Multi-angle idea generation |
| IDEA-002 | ideator | generate | (none) | Parallel angle (Full pipeline only) |
| IDEA-003 | ideator | generate | (none) | Parallel angle (Full pipeline only) |
| CHALLENGE-001 | challenger | challenge | IDEA-001 (or all IDEA-*) | Devil's advocate critique and feasibility challenge |
| IDEA-004 | ideator | gc-fix | CHALLENGE-001 | Revision based on critique (GC loop, if triggered) |
| CHALLENGE-002 | challenger | gc-fix | IDEA-004 | Re-critique of revised ideas (GC loop round 2) |
| SYNTH-001 | synthesizer | synthesize | last CHALLENGE-* | Cross-idea integration, theme extraction, conflict resolution |
| EVAL-001 | evaluator | evaluate | SYNTH-001 | Scoring, ranking, priority recommendation, final selection |

---

## Coordinator Spawn Template

### v5 Worker Spawn (all roles)

When coordinator spawns workers, use `team-worker` agent with role-spec path:

```
Agent({
  subagent_type: "team-worker",
  description: "Spawn <role> worker",
  team_name: "brainstorm",
  name: "<role>",
  run_in_background: true,
  prompt: `## Role Assignment
role: <role>
role_spec: .claude/skills/team-brainstorm/role-specs/<role>.md
session: <session-folder>
session_id: <session-id>
team_name: brainstorm
requirement: <topic-description>
inner_loop: <true|false>

Read role_spec file to load Phase 2-4 domain instructions.
Execute built-in Phase 1 (task discovery) -> role-spec Phase 2-4 -> built-in Phase 5 (report).`
})
```

**All roles** (ideator, challenger, synthesizer, evaluator): Set `inner_loop: false`.

**Parallel ideator spawn** (Full pipeline with N angles):

> When Full pipeline has N parallel IDEA tasks assigned to ideator role, spawn N distinct team-worker agents named `ideator-1`, `ideator-2`, etc. Each agent only processes tasks where owner matches its agent name.

| Condition | Action |
|-----------|--------|
| Full pipeline with N idea angles (N > 1) | Spawn N team-worker agents: `ideator-1`, `ideator-2`, ... `ideator-N` with `run_in_background: true` |
| Quick/Deep pipeline (single ideator) | Standard spawn: single `ideator` team-worker agent |

```
Agent({
  subagent_type: "team-worker",
  description: "Spawn ideator-<N> worker",
  team_name: "brainstorm",
  name: "ideator-<N>",
  run_in_background: true,
  prompt: `## Role Assignment
role: ideator
role_spec: .claude/skills/team-brainstorm/role-specs/ideator.md
session: <session-folder>
session_id: <session-id>
team_name: brainstorm
requirement: <topic-description>
agent_name: ideator-<N>
inner_loop: false

Read role_spec file to load Phase 2-4 domain instructions.
Execute built-in Phase 1 (task discovery, owner=ideator-<N>) -> role-spec Phase 2-4 -> built-in Phase 5 (report).`
})
```

**Dispatch must match agent names**: When dispatching parallel IDEA tasks, coordinator sets each task's owner to the corresponding instance name (`ideator-1`, `ideator-2`, etc.). In role.md, task discovery uses `--agent-name` for owner matching.

---

## Completion Action

When the pipeline completes (all tasks done, coordinator Phase 5):

```
AskUserQuestion({
  questions: [{
    question: "Brainstorm pipeline complete. What would you like to do?",
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
| Keep Active | Update session status="paused" -> output resume instructions: `Skill(skill="team-brainstorm", args="resume")` |
| Export Results | AskUserQuestion for target path -> copy deliverables -> Archive & Clean |

---

## Unified Session Directory

```
.workflow/.team/BRS-<slug>-<YYYY-MM-DD>/
├── .msg/
│   ├── messages.jsonl          # Message bus log
│   └── meta.json               # Session state + cross-role state
├── wisdom/                     # Cross-task knowledge
│   ├── learnings.md
│   ├── decisions.md
│   ├── conventions.md
│   └── issues.md
├── ideas/                      # Ideator output
│   ├── idea-001.md
│   ├── idea-002.md
│   └── idea-003.md
├── critiques/                  # Challenger output
│   ├── critique-001.md
│   └── critique-002.md
├── synthesis/                  # Synthesizer output
│   └── synthesis-001.md
└── evaluation/                 # Evaluator output
    └── evaluation-001.md
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Unknown --role value | Error with available role list |
| Missing --role arg | Orchestration Mode → auto route to coordinator |
| Role file not found | Error with expected path (roles/<name>.md) |
| Task prefix conflict | Log warning, proceed |
| Generator-Critic loop exceeds 2 rounds | Force convergence → SYNTH |
| No ideas generated | Coordinator prompts with seed questions |
