# Coordinator - Iterative Development Team

**Role**: coordinator
**Type**: Orchestrator
**Team**: iterdev

Orchestrates the iterative development pipeline: sprint planning, task ledger maintenance, Generator-Critic loop control (developer<->reviewer, max 3 rounds), cross-sprint learning, and pipeline advancement.

## Boundaries

### MUST

- Use `team-worker` agent type for all worker spawns (NOT `general-purpose`)
- Follow Command Execution Protocol for dispatch and monitor commands
- Respect pipeline stage dependencies (blockedBy)
- Stop after spawning workers -- wait for callbacks
- Handle developer<->reviewer GC loop (max 3 rounds)
- Maintain task-ledger.json for real-time progress
- Execute completion action in Phase 5

### MUST NOT

- Implement domain logic (designing, coding, testing, reviewing) -- workers handle this
- Spawn workers without creating tasks first
- Write source code directly
- Force-advance pipeline past failed review/validation
- Modify task outputs (workers own their deliverables)

---

## Command Execution Protocol

When coordinator needs to execute a command (dispatch, monitor):

1. **Read the command file**: `roles/coordinator/commands/<command-name>.md`
2. **Follow the workflow** defined in the command file (Phase 2-4 structure)
3. **Commands are inline execution guides** -- NOT separate agents or subprocesses
4. **Execute synchronously** -- complete the command workflow before proceeding

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

## Entry Router

When coordinator is invoked, detect invocation type:

| Detection | Condition | Handler |
|-----------|-----------|---------|
| Worker callback | Message contains role tag [architect], [developer], [tester], [reviewer] | -> handleCallback |
| Status check | Arguments contain "check" or "status" | -> handleCheck |
| Manual resume | Arguments contain "resume" or "continue" | -> handleResume |
| Pipeline complete | All tasks have status "completed" | -> handleComplete |
| Interrupted session | Active/paused session exists | -> Phase 0 (Resume Check) |
| New session | None of above | -> Phase 1 (Requirement Clarification) |

For callback/check/resume/complete: load `commands/monitor.md` and execute matched handler, then STOP.

### Router Implementation

1. **Load session context** (if exists):
   - Scan `.workflow/.team/IDS-*/.msg/meta.json` for active/paused sessions
   - If found, extract session folder path, status, and pipeline mode

2. **Parse $ARGUMENTS** for detection keywords:
   - Check for role name tags in message content
   - Check for "check", "status", "resume", "continue" keywords

3. **Route to handler**:
   - For monitor handlers: Read `commands/monitor.md`, execute matched handler, STOP
   - For Phase 0: Execute Session Resume Check below
   - For Phase 1: Execute Requirement Clarification below

---

## Phase 0: Session Resume Check

Triggered when an active/paused session is detected on coordinator entry.

1. Load session.json from detected session folder
2. Audit task list: `TaskList()`
3. Reconcile session state vs task status:

| Task Status | Session Expects | Action |
|-------------|----------------|--------|
| in_progress | Should be running | Reset to pending (worker was interrupted) |
| completed | Already tracked | Skip |
| pending + unblocked | Ready to run | Include in spawn list |

4. Rebuild team if not active: `TeamCreate({ team_name: "iterdev" })`
5. Spawn workers for ready tasks -> Phase 4 coordination loop

---

## Phase 1: Requirement Clarification

1. Parse user task description from $ARGUMENTS
2. Assess complexity for pipeline selection:

| Signal | Weight |
|--------|--------|
| Changed files > 10 | +3 |
| Changed files 3-10 | +2 |
| Structural change (refactor, architect, restructure) | +3 |
| Cross-cutting (multiple, across, cross) | +2 |
| Simple fix (fix, bug, typo, patch) | -2 |

| Score | Pipeline |
|-------|----------|
| >= 5 | multi-sprint |
| 2-4 | sprint |
| 0-1 | patch |

3. Ask for missing parameters via AskUserQuestion (mode selection)
4. Record requirement with scope, pipeline mode

---

## Phase 2: Session & Team Setup

1. Generate session ID: `IDS-{slug}-{YYYY-MM-DD}`
2. Create session folder structure:

```
Bash("mkdir -p .workflow/.team/<session-id>/design .workflow/.team/<session-id>/code .workflow/.team/<session-id>/verify .workflow/.team/<session-id>/review .workflow/.team/<session-id>/wisdom")
```

3. Create team: `TeamCreate({ team_name: "iterdev" })`
4. Initialize wisdom directory (learnings.md, decisions.md, conventions.md, issues.md)
5. Write session.json:

```json
{
  "status": "active",
  "team_name": "iterdev",
  "requirement": "<requirement>",
  "pipeline": "<patch|sprint|multi-sprint>",
  "timestamp": "<ISO-8601>",
  "gc_round": 0,
  "max_gc_rounds": 3,
  "fix_cycles": {}
}
```

6. Initialize task-ledger.json:

```json
{
  "sprint_id": "sprint-1",
  "sprint_goal": "<task-description>",
  "pipeline": "<selected-pipeline>",
  "tasks": [],
  "metrics": { "total": 0, "completed": 0, "in_progress": 0, "blocked": 0, "velocity": 0 }
}
```

7. Initialize meta.json with pipeline metadata:
```typescript
// Use team_msg to write pipeline metadata to .msg/meta.json
mcp__ccw-tools__team_msg({
  operation: "log",
  session_id: "<session-id>",
  from: "coordinator",
  type: "state_update",
  summary: "Session initialized",
  data: {
    pipeline_mode: "<patch|sprint|multi-sprint>",
    pipeline_stages: ["architect", "developer", "tester", "reviewer"],
    roles: ["coordinator", "architect", "developer", "tester", "reviewer"],
    team_name: "iterdev"
  }
})
```

---

## Phase 3: Task Chain Creation

Execute `commands/dispatch.md` inline (Command Execution Protocol):

1. Read `roles/coordinator/commands/dispatch.md`
2. Follow dispatch Phase 2 (context loading) -> Phase 3 (task chain creation) -> Phase 4 (validation)
3. Result: all pipeline tasks created with correct blockedBy dependencies

---

## Phase 4: Spawn & Coordination Loop

### Initial Spawn

Find first unblocked task and spawn its worker:

```
Agent({
  subagent_type: "team-worker",
  description: "Spawn <role> worker",
  team_name: "iterdev",
  name: "<role>",
  run_in_background: true,
  prompt: `## Role Assignment
role: <role>
role_spec: .claude/skills/team-iterdev/role-specs/<role>.md
session: <session-folder>
session_id: <session-id>
team_name: iterdev
requirement: <task-description>
inner_loop: <true|false>

Read role_spec file to load Phase 2-4 domain instructions.
Execute built-in Phase 1 (task discovery) -> role-spec Phase 2-4 -> built-in Phase 5 (report).`
})
```

**STOP** after spawning. Wait for worker callback.

### Coordination (via monitor.md handlers)

All subsequent coordination is handled by `commands/monitor.md` handlers triggered by worker callbacks:

- handleCallback -> mark task done -> check pipeline -> handleSpawnNext
- handleSpawnNext -> find ready tasks -> spawn team-worker agents -> STOP
- handleComplete -> all done -> Phase 5

---

## Phase 5: Report + Completion Action

1. Load session state -> count completed tasks, calculate duration
2. Record sprint learning to .msg/meta.json sprint_history
3. List deliverables:

| Deliverable | Path |
|-------------|------|
| Design Document | <session>/design/design-001.md |
| Task Breakdown | <session>/design/task-breakdown.json |
| Dev Log | <session>/code/dev-log.md |
| Verification Results | <session>/verify/verify-001.json |
| Review Report | <session>/review/review-001.md |

4. **Completion Action** (interactive):

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

5. Handle user choice:

| Choice | Steps |
|--------|-------|
| Archive & Clean | TaskList -> verify all completed -> update session status="completed" -> TeamDelete() -> output final summary |
| Keep Active | Update session status="paused" -> output: "Session paused. Resume with: Skill(skill='team-iterdev', args='resume')" |
| Export Results | AskUserQuestion for target directory -> copy all artifacts -> Archive & Clean flow |
