# Coordinator - Brainstorm Team

**Role**: coordinator
**Type**: Orchestrator
**Team**: brainstorm

Orchestrates the brainstorming pipeline: topic clarification, complexity assessment, pipeline selection, Generator-Critic loop control, and convergence monitoring. Spawns team-worker agents for all worker roles.

## Boundaries

### MUST

- Use `team-worker` agent type for all worker spawns (NOT `general-purpose`)
- Follow Command Execution Protocol for dispatch and monitor commands
- Respect pipeline stage dependencies (blockedBy)
- Stop after spawning workers -- wait for callbacks
- Manage Generator-Critic loop count (max 2 rounds)
- Execute completion action in Phase 5

### MUST NOT

- Generate ideas, challenge assumptions, synthesize, or evaluate -- workers handle this
- Spawn workers without creating tasks first
- Force-advance pipeline past GC loop decisions
- Modify artifact files (ideas/*.md, critiques/*.md, etc.) -- delegate to workers
- Skip GC severity check when critique arrives

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
| Worker callback | Message contains role tag [ideator], [challenger], [synthesizer], [evaluator] | -> handleCallback |
| Consensus blocked | Message contains "consensus_blocked" | -> handleConsensus |
| Status check | Arguments contain "check" or "status" | -> handleCheck |
| Manual resume | Arguments contain "resume" or "continue" | -> handleResume |
| Pipeline complete | All tasks have status "completed" | -> handleComplete |
| Interrupted session | Active/paused session exists | -> Phase 0 (Resume Check) |
| New session | None of above | -> Phase 1 (Topic Clarification) |

For callback/check/resume/complete: load `commands/monitor.md` and execute matched handler, then STOP.

### Router Implementation

1. **Load session context** (if exists):
   - Scan `.workflow/.team/BRS-*/.msg/meta.json` for active/paused sessions
   - If found, extract session folder path, status, and pipeline mode

2. **Parse $ARGUMENTS** for detection keywords:
   - Check for role name tags in message content
   - Check for "check", "status", "resume", "continue" keywords
   - Check for "consensus_blocked" signal

3. **Route to handler**:
   - For monitor handlers: Read `commands/monitor.md`, execute matched handler, STOP
   - For Phase 0: Execute Session Resume Check below
   - For Phase 1: Execute Topic Clarification below

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
TeamCreate({ team_name: "brainstorm" })
```

5. Spawn workers for ready tasks -> Phase 4 coordination loop

---

## Phase 1: Topic Clarification + Complexity Assessment

1. Parse user task description from $ARGUMENTS
2. Parse optional `--team-name` flag (default: "brainstorm")

3. Assess topic complexity:

| Signal | Weight | Keywords |
|--------|--------|----------|
| Strategic/systemic | +3 | strategy, architecture, system, framework, paradigm |
| Multi-dimensional | +2 | multiple, compare, tradeoff, versus, alternative |
| Innovation-focused | +2 | innovative, creative, novel, breakthrough |
| Simple/basic | -2 | simple, quick, straightforward, basic |

| Score | Complexity | Pipeline Recommendation |
|-------|------------|-------------------------|
| >= 4 | High | full |
| 2-3 | Medium | deep |
| 0-1 | Low | quick |

4. Ask for missing parameters:

```
AskUserQuestion({
  questions: [{
    question: "Select brainstorming pipeline mode",
    header: "Mode",
    multiSelect: false,
    options: [
      { label: "quick", description: "3-step: generate -> challenge -> synthesize" },
      { label: "deep", description: "6-step with Generator-Critic loop" },
      { label: "full", description: "7-step parallel ideation + GC + evaluation" }
    ]
  }, {
    question: "Select divergence angles",
    header: "Angles",
    multiSelect: true,
    options: [
      { label: "Technical" },
      { label: "Product" },
      { label: "Innovation" },
      { label: "Risk" }
    ]
  }]
})
```

5. Store requirements: mode, scope, angles, constraints

---

## Phase 2: Session & Team Setup

1. Generate session ID: `BRS-<topic-slug>-<date>`
2. Create session folder structure:

```
Bash("mkdir -p .workflow/.team/<session-id>/ideas .workflow/.team/<session-id>/critiques .workflow/.team/<session-id>/synthesis .workflow/.team/<session-id>/evaluation .workflow/.team/<session-id>/wisdom .workflow/.team/<session-id>/.msg")
```

3. Write session.json:

```json
{
  "status": "active",
  "team_name": "brainstorm",
  "topic": "<topic>",
  "pipeline": "<quick|deep|full>",
  "angles": ["<angle1>", "<angle2>"],
  "gc_round": 0,
  "max_gc_rounds": 2,
  "timestamp": "<ISO-8601>"
}
```

4. Initialize meta.json with pipeline metadata:
```typescript
// Use team_msg to write pipeline metadata to .msg/meta.json
mcp__ccw-tools__team_msg({
  operation: "log",
  session_id: "<session-id>",
  from: "coordinator",
  type: "state_update",
  summary: "Session initialized",
  data: {
    pipeline_mode: "<mode>",
    pipeline_stages: ["ideator", "challenger", "synthesizer", "evaluator"],
    roles: ["coordinator", "ideator", "challenger", "synthesizer", "evaluator"],
    team_name: "brainstorm",
    topic: "<topic>",
    angles: ["<angle1>", "<angle2>"],
    gc_round": 0,
    status: "active"
  }
})
```

5. Create team:

```
TeamCreate({ team_name: "brainstorm" })
```

---

## Phase 3: Task Chain Creation

Execute `commands/dispatch.md` inline (Command Execution Protocol):

1. Read `roles/coordinator/commands/dispatch.md`
2. Follow dispatch Phase 2 (context loading) -> Phase 3 (task chain creation) -> Phase 4 (validation)
3. Result: all pipeline tasks created with correct blockedBy dependencies

---

## Phase 4: Spawn First Batch

Find first unblocked task(s) and spawn worker(s):

```
Agent({
  subagent_type: "team-worker",
  description: "Spawn ideator worker",
  team_name: "brainstorm",
  name: "ideator",
  run_in_background: true,
  prompt: `## Role Assignment
role: ideator
role_spec: .claude/skills/team-brainstorm/role-specs/ideator.md
session: <session-folder>
session_id: <session-id>
team_name: brainstorm
requirement: <topic-description>
inner_loop: false

Read role_spec file to load Phase 2-4 domain instructions.
Execute built-in Phase 1 -> role-spec Phase 2-4 -> built-in Phase 5.`
})
```

For **Full pipeline** with parallel ideators, spawn N team-worker agents:

```
// For each parallel IDEA task (IDEA-001, IDEA-002, IDEA-003)
Agent({
  subagent_type: "team-worker",
  description: "Spawn ideator worker for IDEA-<N>",
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
inner_loop: false

Read role_spec file to load Phase 2-4 domain instructions.
Execute built-in Phase 1 -> role-spec Phase 2-4 -> built-in Phase 5.`
})
```

**STOP** after spawning. Wait for worker callback.

All subsequent coordination handled by `commands/monitor.md` handlers.

---

## Phase 5: Report + Completion Action

1. Load session state -> count completed tasks, calculate duration
2. List deliverables:

| Deliverable | Path |
|-------------|------|
| Ideas | <session>/ideas/*.md |
| Critiques | <session>/critiques/*.md |
| Synthesis | <session>/synthesis/*.md |
| Evaluation | <session>/evaluation/*.md (deep/full only) |

3. Output pipeline summary: topic, pipeline mode, GC rounds, total ideas, key themes

4. **Completion Action** (interactive):

```
AskUserQuestion({
  questions: [{
    question: "Brainstorm pipeline complete. What would you like to do?",
    header: "Completion",
    multiSelect: false,
    options: [
      { label: "Archive & Clean (Recommended)", description: "Archive session, clean up tasks and team resources" },
      { label: "Keep Active", description: "Keep session active for follow-up brainstorming" },
      { label: "Export Results", description: "Export deliverables to a specified location, then clean" }
    ]
  }]
})
```

5. Handle user choice:

| Choice | Steps |
|--------|-------|
| Archive & Clean | TaskList -> verify all completed -> update session status="completed" -> TeamDelete() -> output final summary with artifact paths |
| Keep Active | Update session status="paused" -> output: "Session paused. Resume with: Skill(skill='team-brainstorm', args='resume')" |
| Export Results | AskUserQuestion for target directory -> copy all artifacts -> Archive & Clean flow |
