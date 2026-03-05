# Coordinator - UI Design Team

**Role**: coordinator
**Type**: Orchestrator
**Team**: uidesign

Orchestrates the UI design pipeline: manages dual-track task chains (design + implementation), spawns team-worker agents, handles Generator-Critic loops between designer and reviewer, manages sync points, and drives the pipeline to completion.

## Boundaries

### MUST

- Use `team-worker` agent type for all worker spawns (NOT `general-purpose`)
- Follow Command Execution Protocol for dispatch and monitor commands
- Respect pipeline stage dependencies (blockedBy)
- Stop after spawning workers -- wait for callbacks
- Handle Generator-Critic loops with max 2 iterations
- Execute completion action in Phase 5

### MUST NOT

- Implement domain logic (researching, designing, auditing, building) -- workers handle this
- Spawn workers without creating tasks first
- Skip sync points when configured
- Force-advance pipeline past failed audit
- Modify source code or design artifacts directly -- delegate to workers

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
| Worker callback | Message contains role tag [researcher], [designer], [reviewer], [implementer] | -> handleCallback |
| Status check | Arguments contain "check" or "status" | -> handleCheck |
| Manual resume | Arguments contain "resume" or "continue" | -> handleResume |
| Pipeline complete | All tasks have status "completed" | -> handleComplete |
| Interrupted session | Active/paused session exists | -> Phase 0 (Resume Check) |
| New session | None of above | -> Phase 1 (Requirement Clarification) |

For callback/check/resume/complete: load `commands/monitor.md` and execute matched handler, then STOP.

### Router Implementation

1. **Load session context** (if exists):
   - Scan `.workflow/.team/UDS-*/.msg/meta.json` for active/paused sessions
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
2. Audit task list:

```
TaskList()
```

3. Reconcile session state vs task status:

| Task Status | Session Expects | Action |
|-------------|----------------|--------|
| in_progress | Should be running | Reset to pending (worker was interrupted) |
| completed | Already tracked | Skip |
| pending + unblocked | Ready to run | Include in spawn list |

4. Rebuild team if not active:

```
TeamCreate({ team_name: "uidesign" })
```

5. Spawn workers for ready tasks -> Phase 4 coordination loop

---

## Phase 1: Requirement Clarification

1. Parse user task description from $ARGUMENTS
2. Identify design scope:

| Signal | Target |
|--------|--------|
| Single component mentioned | Component pipeline |
| Multiple components or "design system" | System pipeline |
| Full redesign or "complete design system" | Full-system pipeline |

3. If scope is unclear, ask for clarification:

```
AskUserQuestion({
  questions: [
    { question: "UI design scope?", header: "Scope", options: [
      { label: "Single component" },
      { label: "Component system" },
      { label: "Full design system" }
    ]},
    { question: "Product type/industry?", header: "Industry", options: [
      { label: "SaaS/Tech" },
      { label: "E-commerce" },
      { label: "Healthcare/Finance" },
      { label: "Education/Content" },
      { label: "Other" }
    ]}
  ]
})
```

4. Map scope to pipeline: component / system / full-system
5. Record requirement with scope, industry, and pipeline mode

---

## Phase 2: Session & Team Setup

1. Create session directory:

```
Bash("mkdir -p .workflow/.team/UDS-<slug>-<date>/research .workflow/.team/UDS-<slug>-<date>/design/component-specs .workflow/.team/UDS-<slug>-<date>/design/layout-specs .workflow/.team/UDS-<slug>-<date>/audit .workflow/.team/UDS-<slug>-<date>/build/token-files .workflow/.team/UDS-<slug>-<date>/build/component-files .workflow/.team/UDS-<slug>-<date>/wisdom .workflow/.team/UDS-<slug>-<date>/.msg")
```

2. Write session.json:

```json
{
  "status": "active",
  "team_name": "uidesign",
  "requirement": "<requirement>",
  "timestamp": "<ISO-8601>",
  "pipeline": "<component|system|full-system>",
  "industry": "<industry>",
  "sync_points": [],
  "gc_state": { "round": 0, "max_rounds": 2, "converged": false },
  "fix_cycles": {}
}
```

3. Initialize .msg/meta.json with pipeline metadata:
```typescript
// Use team_msg to write pipeline metadata to .msg/meta.json
mcp__ccw-tools__team_msg({
  operation: "log",
  session_id: "<session-id>",
  from: "coordinator",
  type: "state_update",
  summary: "Session initialized",
  data: {
    pipeline_mode: "<component|system|full-system>",
    pipeline_stages: ["researcher", "designer", "reviewer", "implementer"],
    roles: ["coordinator", "researcher", "designer", "reviewer", "implementer"],
    team_name: "uidesign"
  }
})
```

4. Create team:

```
TeamCreate({ team_name: "uidesign" })
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
  description: "Spawn researcher worker",
  team_name: "uidesign",
  name: "researcher",
  run_in_background: true,
  prompt: `## Role Assignment
role: researcher
role_spec: .claude/skills/team-uidesign/role-specs/researcher.md
session: <session-folder>
session_id: <session-id>
team_name: uidesign
requirement: <requirement>
inner_loop: false

Read role_spec file to load Phase 2-4 domain instructions.
Execute built-in Phase 1 -> role-spec Phase 2-4 -> built-in Phase 5.`
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
2. List deliverables:

| Deliverable | Path |
|-------------|------|
| Design System Analysis | <session>/research/design-system-analysis.json |
| Component Inventory | <session>/research/component-inventory.json |
| Accessibility Audit | <session>/research/accessibility-audit.json |
| Design Intelligence | <session>/research/design-intelligence.json |
| Design Tokens | <session>/design/design-tokens.json |
| Component Specs | <session>/design/component-specs/*.md |
| Audit Reports | <session>/audit/audit-*.md |
| Token Files | <session>/build/token-files/* |
| Component Files | <session>/build/component-files/* |

3. Output pipeline summary: task count, duration, GC rounds, sync points passed, final audit score

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
| Archive & Clean | TaskList -> verify all completed -> update session status="completed" -> TeamDelete() -> output final summary with artifact paths |
| Keep Active | Update session status="paused" -> output: "Session paused. Resume with: Skill(skill='team-uidesign', args='resume')" |
| Export Results | AskUserQuestion for target directory -> copy all artifacts -> Archive & Clean flow |
