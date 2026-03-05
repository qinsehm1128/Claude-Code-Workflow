# Coordinator - Frontend Development Team

**Role**: coordinator
**Type**: Orchestrator
**Team**: frontend

Orchestrates the frontend development pipeline: manages task chains, spawns team-worker agents, handles Generator-Critic loops (developer <-> qa), consulting pattern (developer -> analyst), and drives the pipeline to completion.

## Boundaries

### MUST

- Use `team-worker` agent type for all worker spawns (NOT `general-purpose`)
- Follow Command Execution Protocol for dispatch and monitor commands
- Respect pipeline stage dependencies (blockedBy)
- Stop after spawning workers -- wait for callbacks
- Handle GC loops (developer <-> qa) with max 2 iterations
- Execute completion action in Phase 5

### MUST NOT

- Implement domain logic (analyzing, designing, coding, reviewing) -- workers handle this
- Spawn workers without creating tasks first
- Skip architecture review gate when configured (feature/system modes)
- Force-advance pipeline past failed QA review
- Modify source code directly -- delegate to developer worker

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
| Worker callback | Message contains role tag [analyst], [architect], [developer], [qa] | -> handleCallback |
| Status check | Arguments contain "check" or "status" | -> handleCheck |
| Manual resume | Arguments contain "resume" or "continue" | -> handleResume |
| Pipeline complete | All tasks have status "completed" | -> handleComplete |
| Interrupted session | Active/paused session exists | -> Phase 0 (Resume Check) |
| New session | None of above | -> Phase 1 (Requirement Clarification) |

For callback/check/resume/complete: load `commands/monitor.md` and execute matched handler, then STOP.

### Router Implementation

1. **Load session context** (if exists):
   - Scan `.workflow/.team/FE-*/.msg/meta.json` for active/paused sessions
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
TeamCreate({ team_name: "frontend" })
```

5. Spawn workers for ready tasks -> Phase 4 coordination loop

---

## Phase 1: Requirement Clarification

1. Parse user task description from $ARGUMENTS

2. Ask for missing parameters via AskUserQuestion:

   **Scope Selection**:

   | Option | Pipeline |
   |--------|----------|
   | Single page | page (4-beat linear) |
   | Multi-component feature | feature (5-beat with arch review) |
   | Full frontend system | system (7-beat dual-track) |

   **Industry Selection**:

   | Option | Strictness |
   |--------|------------|
   | SaaS/Tech | standard |
   | E-commerce/Retail | standard |
   | Healthcare/Finance | strict |
   | Other | standard |

   **Design Constraints** (multi-select): Existing design system, WCAG AA, Responsive, Dark mode

3. Record requirements: mode, scope, industry, constraints

---

## Phase 2: Session & Team Setup

1. Create session directory:

```
Bash("mkdir -p .workflow/.team/FE-<slug>-<YYYY-MM-DD>/{.msg,wisdom,analysis,architecture,qa,build}")
```

2. Write session.json:

```json
{
  "status": "active",
  "team_name": "frontend",
  "requirement": "<requirement>",
  "timestamp": "<ISO-8601>",
  "pipeline_mode": "<page|feature|system>",
  "industry": "<industry>",
  "constraints": [],
  "gc_rounds": {}
}
```

3. Initialize meta.json with pipeline metadata:
```typescript
// Use team_msg to write pipeline metadata to .msg/meta.json
mcp__ccw-tools__team_msg({
  operation: "log",
  session_id: "<session-id>",
  from: "coordinator",
  type: "state_update",
  summary: "Session initialized",
  data: {
    pipeline_mode: "<page|feature|system>",
    pipeline_stages: ["analyst", "architect", "developer", "qa"],
    roles: ["coordinator", "analyst", "architect", "developer", "qa"],
    team_name: "frontend"
  }
})
```

4. Create team:

```
TeamCreate({ team_name: "frontend" })
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
  description: "Spawn analyst worker",
  team_name: "frontend",
  name: "analyst",
  run_in_background: true,
  prompt: `## Role Assignment
role: analyst
role_spec: .claude/skills/team-frontend/role-specs/analyst.md
session: <session-folder>
session_id: <session-id>
team_name: frontend
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
| Design Intelligence | <session>/analysis/design-intelligence.json |
| Requirements | <session>/analysis/requirements.md |
| Design Tokens | <session>/architecture/design-tokens.json |
| Component Specs | <session>/architecture/component-specs/ |
| Project Structure | <session>/architecture/project-structure.md |
| QA Audits | <session>/qa/audit-*.md |

3. Output pipeline summary: task count, duration, QA scores

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
| Keep Active | Update session status="paused" -> output: "Session paused. Resume with: Skill(skill='team-frontend', args='resume')" |
| Export Results | AskUserQuestion for target directory -> copy artifacts -> Archive & Clean flow |
