# Command: Monitor

Handle all coordinator monitoring events: worker callbacks, status checks, pipeline advancement, GC loops, and completion.

## Constants

| Key | Value |
|-----|-------|
| SPAWN_MODE | background |
| ONE_STEP_PER_INVOCATION | true |
| WORKER_AGENT | team-worker |
| MAX_GC_ROUNDS | 3 |

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Session state | <session>/session.json | Yes |
| Task list | TaskList() | Yes |
| Trigger event | From Entry Router detection | Yes |
| Meta state | <session>/.msg/meta.json | Yes |
| Pipeline definition | From SKILL.md | Yes |

1. Load session.json for current state, `pipeline_mode`, `gc_rounds`
2. Run TaskList() to get current task statuses
3. Identify trigger event type from Entry Router

### Role Detection Table

| Message Pattern | Role Detection |
|----------------|---------------|
| `[scout]` or task ID `SCOUT-*` | scout |
| `[strategist]` or task ID `QASTRAT-*` | strategist |
| `[generator]` or task ID `QAGEN-*` | generator |
| `[executor]` or task ID `QARUN-*` | executor |
| `[analyst]` or task ID `QAANA-*` | analyst |

### Pipeline Stage Order

```
SCOUT -> QASTRAT -> QAGEN -> QARUN -> QAANA
```

## Phase 3: Event Handlers

### handleCallback

Triggered when a worker sends completion message.

1. Parse message to identify role and task ID using Role Detection Table

2. Mark task as completed:

```
TaskUpdate({ taskId: "<task-id>", status: "completed" })
```

3. Record completion in session state

4. **GC Loop Check** (when executor QARUN completes):

Read `<session>/.msg/meta.json` for execution results.

| Condition | Action |
|-----------|--------|
| Coverage >= target OR no coverage data | Proceed to handleSpawnNext |
| Coverage < target AND gc_rounds < 3 | Create GC fix tasks, increment gc_rounds |
| Coverage < target AND gc_rounds >= 3 | Accept current coverage, proceed to handleSpawnNext |

**GC Fix Task Creation** (when coverage below target):

```
TaskCreate({
  subject: "QAGEN-fix-<round>",
  description: "PURPOSE: Fix failing tests and improve coverage | Success: Coverage meets target
TASK:
  - Load execution results and failing test details
  - Fix broken tests and add missing coverage
  - Re-validate fixes
CONTEXT:
  - Session: <session-folder>
  - Upstream artifacts: <session>/.msg/meta.json
EXPECTED: Fixed test files | Improved coverage
CONSTRAINTS: Targeted fixes only | Do not introduce regressions",
  blockedBy: [],
  status: "pending"
})

TaskCreate({
  subject: "QARUN-recheck-<round>",
  description: "PURPOSE: Re-execute tests after fixes | Success: Coverage >= target
TASK:
  - Execute test suite on fixed code
  - Measure coverage
  - Report results
CONTEXT:
  - Session: <session-folder>
EXPECTED: Execution results with coverage metrics
CONSTRAINTS: Read-only execution",
  blockedBy: ["QAGEN-fix-<round>"],
  status: "pending"
})
```

5. Proceed to handleSpawnNext

### handleSpawnNext

Find and spawn the next ready tasks.

1. Scan task list for tasks where:
   - Status is "pending"
   - All blockedBy tasks have status "completed"

2. If no ready tasks and all tasks completed, proceed to handleComplete

3. If no ready tasks but some still in_progress, STOP and wait

4. For each ready task, determine role from task subject prefix:

```javascript
const STAGE_WORKER_MAP = {
  'SCOUT':   { role: 'scout' },
  'QASTRAT': { role: 'strategist' },
  'QAGEN':   { role: 'generator' },
  'QARUN':   { role: 'executor' },
  'QAANA':   { role: 'analyst' }
}
```

5. Spawn team-worker (one at a time for sequential pipeline):

```
Agent({
  agent_type: "team-worker",
  description: "Spawn <role> worker for <task-id>",
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
inner_loop: false

## Current Task
- Task ID: <task-id>
- Task: <task-subject>

Read role_spec file to load Phase 2-4 domain instructions.
Execute built-in Phase 1 -> role-spec Phase 2-4 -> built-in Phase 5.`
})
```

6. STOP after spawning -- wait for next callback

### handleCheck

Output current pipeline status.

```
Pipeline Status:
  [DONE]  SCOUT-001    (scout)       -> scan complete
  [DONE]  QASTRAT-001  (strategist)  -> strategy ready
  [RUN]   QAGEN-001    (generator)   -> generating tests...
  [WAIT]  QARUN-001    (executor)    -> blocked by QAGEN-001
  [WAIT]  QAANA-001    (analyst)     -> blocked by QARUN-001

GC Rounds: 0/3
Session: <session-id>
```

Output status -- do NOT advance pipeline.

### handleResume

Resume pipeline after user pause or interruption.

1. Audit task list for inconsistencies:
   - Tasks stuck in "in_progress" -> reset to "pending"
   - Tasks with completed blockers but still "pending" -> include in spawn list
2. Proceed to handleSpawnNext

### handleComplete

Triggered when all pipeline tasks are completed.

1. Verify all tasks (including any GC fix/recheck tasks) have status "completed"
2. If any tasks not completed, return to handleSpawnNext
3. If all completed:
   - Read final state from `<session>/.msg/meta.json`
   - Compile summary: total tasks, completed, gc_rounds, quality_score, coverage
   - Transition to coordinator Phase 5

## Phase 4: State Persistence

After every handler execution:

1. Update session.json with current state (active tasks, gc_rounds, last event)
2. Verify task list consistency
3. STOP and wait for next event
