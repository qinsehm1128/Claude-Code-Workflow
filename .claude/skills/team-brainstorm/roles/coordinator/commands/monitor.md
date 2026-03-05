# Command: Monitor

Handle all coordinator monitoring events: worker callbacks, status checks, pipeline advancement, Generator-Critic loop control, and completion.

## Constants

| Key | Value |
|-----|-------|
| SPAWN_MODE | background |
| ONE_STEP_PER_INVOCATION | true |
| WORKER_AGENT | team-worker |
| MAX_GC_ROUNDS | 2 |

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Session state | <session>/session.json | Yes |
| Task list | TaskList() | Yes |
| Trigger event | From Entry Router detection | Yes |
| Meta state | <session>/.msg/meta.json | Yes |

1. Load session.json for current state, pipeline mode, gc_round
2. Run TaskList() to get current task statuses
3. Identify trigger event type from Entry Router

## Phase 3: Event Handlers

### handleCallback

Triggered when a worker sends completion message.

1. Parse message to identify role and task ID:

| Message Pattern | Role Detection |
|----------------|---------------|
| `[ideator]` or task ID `IDEA-*` | ideator |
| `[challenger]` or task ID `CHALLENGE-*` | challenger |
| `[synthesizer]` or task ID `SYNTH-*` | synthesizer |
| `[evaluator]` or task ID `EVAL-*` | evaluator |

2. Mark task as completed:

```
TaskUpdate({ taskId: "<task-id>", status: "completed" })
```

3. Record completion in session state

4. **Generator-Critic check** (when challenger completes):
   - If completed task is CHALLENGE-* AND pipeline is deep or full:
   - Read critique file for GC signal
   - Read .msg/meta.json for gc_round

   | GC Signal | gc_round < max | Action |
   |-----------|----------------|--------|
   | REVISION_NEEDED | Yes | Increment gc_round, unblock IDEA-fix task |
   | REVISION_NEEDED | No (>= max) | Force convergence, unblock SYNTH |
   | CONVERGED | - | Unblock SYNTH (skip remaining GC tasks) |

   - Log team_msg with type "gc_loop_trigger" or "task_unblocked"
   - If skipping GC tasks, mark them as completed (skip)

5. Proceed to handleSpawnNext

### handleSpawnNext

Find and spawn the next ready tasks.

1. Scan task list for tasks where:
   - Status is "pending"
   - All blockedBy tasks have status "completed"

2. For each ready task, spawn team-worker:

```
Agent({
  subagent_type: "team-worker",
  description: "Spawn <role> worker for <task-id>",
  team_name: "brainstorm",
  name: "<role>",
  run_in_background: true,
  prompt: `## Role Assignment
role: <role>
role_spec: .claude/skills/team-brainstorm/role-specs/<role>.md
session: <session-folder>
session_id: <session-id>
team_name: brainstorm
requirement: <task-description>
inner_loop: false

Read role_spec file to load Phase 2-4 domain instructions.
Execute built-in Phase 1 -> role-spec Phase 2-4 -> built-in Phase 5.`
})
```

3. **Parallel spawn rules**:

| Pipeline | Scenario | Spawn Behavior |
|----------|----------|---------------|
| Quick | Single sequential | One worker at a time |
| Deep | Sequential with GC | One worker at a time |
| Full | IDEA-001/002/003 unblocked | Spawn ALL 3 ideator workers in parallel |
| Full | Other stages | One worker at a time |

4. STOP after spawning -- wait for next callback

### handleCheck

Output current pipeline status. Do NOT advance pipeline.

```
Pipeline Status (<pipeline-mode>):
  [DONE]  IDEA-001      (ideator)      -> ideas/idea-001.md
  [DONE]  CHALLENGE-001 (challenger)   -> critiques/critique-001.md
  [RUN]   SYNTH-001     (synthesizer)  -> synthesizing...
  [WAIT]  EVAL-001      (evaluator)    -> blocked by SYNTH-001

GC Rounds: <gc_round>/<max_gc_rounds>
Session: <session-id>
```

### handleResume

Resume pipeline after user pause or interruption.

1. Audit task list for inconsistencies:
   - Tasks stuck in "in_progress" -> reset to "pending"
   - Tasks with completed blockers but still "pending" -> include in spawn list
2. Proceed to handleSpawnNext

### handleConsensus

Handle consensus_blocked signals.

| Severity | Action |
|----------|--------|
| HIGH | Pause pipeline, notify user with findings summary |
| MEDIUM | Log finding, attempt to continue |
| LOW | Log finding, continue pipeline |

### handleComplete

Triggered when all pipeline tasks are completed.

**Completion check by mode**:

| Mode | Completion Condition |
|------|---------------------|
| quick | All 3 tasks completed |
| deep | All 6 tasks (+ any skipped GC tasks) completed |
| full | All 7 tasks (+ any skipped GC tasks) completed |

1. Verify all tasks completed via TaskList()
2. If any tasks not completed, return to handleSpawnNext
3. If all completed, transition to coordinator Phase 5 (Report + Completion Action)

## Phase 4: State Persistence

After every handler execution:

1. Update session.json with current state (gc_round, last event, active tasks)
2. Update .msg/meta.json gc_round if changed
3. Verify task list consistency
4. STOP and wait for next event
