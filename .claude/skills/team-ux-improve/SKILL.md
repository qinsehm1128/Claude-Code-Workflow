---
name: team-ux-improve
description: Unified team skill for UX improvement. Systematically discovers and fixes UI/UX interaction issues including unresponsive buttons, missing feedback, and state refresh problems. Uses team-worker agent architecture with role-spec files for domain logic. Coordinator orchestrates pipeline, workers are team-worker agents. Triggers on "team ux improve".
allowed-tools: Agent, AskUserQuestion, Read, Write, Edit, Bash, Glob, Grep, TaskList, TaskGet, TaskUpdate, TaskCreate, TeamCreate, TeamDelete, SendMessage, mcp__ace-tool__search_context, mcp__ccw-tools__read_file, mcp__ccw-tools__write_file, mcp__ccw-tools__edit_file, mcp__ccw-tools__team_msg
---

# Team UX Improve

Unified team skill for systematically discovering and fixing UI/UX interaction issues. Built on **team-worker agent architecture** — all worker roles share a single agent definition with role-specific Phase 2-4 loaded from markdown specs.

## Architecture

```
+-------------------------------------------------------------------+
|  Skill(skill="team-ux-improve")                                    |
|  args="<project-path> [--framework react|vue]"                     |
+-------------------+-----------------------------------------------+
                    |
         Orchestration Mode (auto -> coordinator)
                    |
              Coordinator (inline)
              Phase 0-5 orchestration
                    |
    +-------+-------+-------+-------+-------+
    v       v       v       v       v       v
 [team-worker agents, each loaded with a role-spec]
  scanner  diagnoser  designer  implementer  tester

  Utility Members (spawned by coordinator for utility work):
    [explorer]
```

## Role Router

This skill is **coordinator-only**. Workers do NOT invoke this skill — they are spawned as `team-worker` agents directly.

### Input Parsing

Parse `$ARGUMENTS`. No `--role` needed — always routes to coordinator.

### Role Registry

| Role | Spec | Task Prefix | Type | Inner Loop |
|------|------|-------------|------|------------|
| coordinator | [roles/coordinator/role.md](roles/coordinator/role.md) | (none) | orchestrator | - |
| scanner | [role-specs/scanner.md](role-specs/scanner.md) | SCAN-* | worker | false |
| diagnoser | [role-specs/diagnoser.md](role-specs/diagnoser.md) | DIAG-* | worker | false |
| designer | [role-specs/designer.md](role-specs/designer.md) | DESIGN-* | worker | false |
| implementer | [role-specs/implementer.md](role-specs/implementer.md) | IMPL-* | worker | true |
| tester | [role-specs/tester.md](role-specs/tester.md) | TEST-* | worker | false |

### Utility Member Registry

**⚠️ COORDINATOR ONLY**: Utility members can only be spawned by Coordinator. Workers CANNOT call Agent() to spawn utility members. Workers must use CLI tools instead.

| Utility Member | Spec | Callable By | Purpose |
|----------------|------|-------------|---------|
| explorer | [role-specs/explorer.md](role-specs/explorer.md) | **Coordinator only** | Explore codebase for UI component patterns, state management conventions, and framework-specific patterns |

### Worker Alternatives

Workers needing similar capabilities must use CLI tools:

| Capability | CLI Command | Example |
|------------|-------------|---------|
| Codebase exploration | `ccw cli --tool gemini --mode analysis` | Explore architecture patterns |
| Multi-perspective critique | Parallel CLI calls | Security + performance + quality reviews |
| Document generation | `ccw cli --tool gemini --mode write` | Generate implementation guide |

### Dispatch

Always route to coordinator. Coordinator reads `roles/coordinator/role.md` and executes its phases.

### Orchestration Mode

User provides project path and optional framework flag.

**Invocation**: `Skill(skill="team-ux-improve", args="<project-path> [--framework react|vue]")`

**Lifecycle**:
```
User provides project path
  -> coordinator Phase 1-3: Requirement clarification -> TeamCreate -> Create task chain
  -> coordinator Phase 4: spawn first batch workers (background) -> STOP
  -> Worker (team-worker agent) executes -> SendMessage callback -> coordinator advances
  -> Loop until pipeline complete -> Phase 5 report + completion action
```

**User Commands** (wake paused coordinator):

| Command | Action |
|---------|--------|
| `check` / `status` | Output execution status graph, no advancement |
| `resume` / `continue` | Check worker states, advance next step |

---

## Command Execution Protocol

When coordinator needs to execute a command (dispatch, monitor):

1. **Read the command file**: `roles/coordinator/commands/<command-name>.md`
2. **Follow the workflow** defined in the command file (Phase 2-4 structure)
3. **Commands are inline execution guides** - NOT separate agents or subprocesses
4. **Execute synchronously** - complete the command workflow before proceeding

Example:
```
Phase 3 needs task dispatch
  -> Read roles/coordinator/commands/dispatch.md
  -> Execute Phase 2 (Context Loading)
  -> Execute Phase 3 (Task Chain Creation)
  -> Execute Phase 4 (Validation)
  -> Continue to Phase 4
```

---

## Coordinator Spawn Template

### v5 Worker Spawn (all roles)

When coordinator spawns workers, use `team-worker` agent with role-spec path:

```
Agent({
  subagent_type: "team-worker",
  description: "Spawn <role> worker",
  team_name: <team-name>,
  name: "<role>",
  run_in_background: true,
  prompt: `## Role Assignment
role: <role>
role_spec: .claude/skills/team-ux-improve/role-specs/<role>.md
session: <session-folder>
session_id: <session-id>
team_name: <team-name>
requirement: <task-description>
inner_loop: <true|false>

Read role_spec file to load Phase 2-4 domain instructions.
Execute built-in Phase 1 (task discovery) -> role-spec Phase 2-4 -> built-in Phase 5 (report).`
})
```

**Inner Loop roles** (implementer): Set `inner_loop: true`. The team-worker agent handles the loop internally.

**Single-task roles** (scanner, diagnoser, designer, tester): Set `inner_loop: false`.

---

## Pipeline Definitions

### Pipeline Diagram

```
scanner (SCAN) → diagnoser (DIAG) → designer (DESIGN) → implementer (IMPL) → tester (TEST)

Stage 1: UI Scanning
  └─ scanner: Scan UI components for interaction issues

Stage 2: Root Cause Diagnosis
  └─ diagnoser: Diagnose root causes of identified issues

Stage 3: Solution Design
  └─ designer: Design feedback mechanisms and state management solutions

Stage 4: Code Implementation
  └─ implementer: Generate fix code with proper state handling

Stage 5: Test Validation
  └─ tester: Generate and run tests to verify fixes
```

### Cadence Control

**Beat model**: Event-driven, each beat = coordinator wake -> process -> spawn -> STOP.

```
Beat Cycle (single beat)
======================================================================
  Event                   Coordinator              Workers
----------------------------------------------------------------------
  callback/resume --> +- handleCallback -+
                      |  mark completed   |
                      |  check pipeline   |
                      +- handleSpawnNext -+
                      |  find ready tasks |
                      |  spawn workers ---+--> [team-worker scanner] Phase 1-5
                      |  (parallel OK)  --+--> [team-worker diagnoser] Phase 1-5
                      +- STOP (idle) -----+         |
                                                     |
  callback <-----------------------------------------+
  (next beat)              SendMessage + TaskUpdate(completed)
======================================================================

  Fast-Advance (skips coordinator for simple linear successors)
======================================================================
  [Worker scanner] Phase 5 complete
    +- 1 ready task? simple successor?
    |   --> spawn team-worker diagnoser directly
    |   --> log fast_advance to message bus (coordinator syncs on next wake)
    +- complex case? --> SendMessage to coordinator
======================================================================
```

**Checkpoints**:

| Checkpoint | Trigger | Location | Behavior |
|------------|---------|----------|----------|
| Pipeline complete | All tasks completed | coordinator Phase 5 | Execute completion action |

### Task Metadata Registry

| Task ID | Role | Phase | Dependencies | Description |
|---------|------|-------|-------------|-------------|
| SCAN-001 | scanner | 2-4 | [] | Scan UI components for interaction issues |
| DIAG-001 | diagnoser | 2-4 | [SCAN-001] | Diagnose root causes of identified issues |
| DESIGN-001 | designer | 2-4 | [DIAG-001] | Design feedback mechanisms and state management solutions |
| IMPL-001 | implementer | 2-4 | [DESIGN-001] | Generate fix code with proper state handling |
| TEST-001 | tester | 2-4 | [IMPL-001] | Generate and run tests to verify fixes |

---

## Completion Action

When the pipeline completes (all tasks done, coordinator Phase 5):

```
AskUserQuestion({
  questions: [{
    question: "Team pipeline complete. What would you like to do?",
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
| Archive & Clean | Update session status="completed" -> TeamDelete(ux-improve) -> output final summary |
| Keep Active | Update session status="paused" -> output resume instructions: `Skill(skill="team-ux-improve", args="resume")` |
| Export Results | AskUserQuestion for target path -> copy deliverables -> Archive & Clean |

---

## Session Directory

```
.workflow/.team/ux-improve-<timestamp>/
├── .msg/
│   ├── messages.jsonl     ← Messages + state_update audit log
│   └── meta.json          ← Pipeline config + role state snapshot
├── artifacts/             ← Role deliverables
│   ├── scan-report.md     ← scanner output
│   ├── diagnosis.md       ← diagnoser output
│   ├── design-guide.md    ← designer output
│   ├── fixes/             ← implementer output
│   └── test-report.md     ← tester output
├── explorations/          ← explorer cache
│   └── cache-index.json
└── wisdom/                ← Session knowledge base
    ├── contributions/     ← Worker contributions (write-only for workers)
    ├── principles/        ← Core principles
    │   └── general-ux.md
    ├── patterns/          ← Solution patterns
    │   ├── ui-feedback.md
    │   └── state-management.md
    └── anti-patterns/     ← Issues to avoid
        └── common-ux-pitfalls.md
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Role spec file not found | Error with expected path (role-specs/<name>.md) |
| Command file not found | Fallback to inline execution in coordinator role.md |
| Utility member spec not found | Error with expected path (role-specs/explorer.md) |
| Fast-advance orphan detected | Coordinator resets task to pending on next check |
| team-worker agent unavailable | Error: requires .claude/agents/team-worker.md |
| Completion action timeout | Default to Keep Active |
| Framework detection fails | Prompt user for framework selection |
| No UI issues found | Complete with empty fix list |
