# Command: Monitor

Handle all coordinator monitoring events: worker callbacks, status checks, pipeline advancement, review-fix cycle control, and completion.

## Constants

| Key | Value |
|-----|-------|
| SPAWN_MODE | background |
| ONE_STEP_PER_INVOCATION | true |
| WORKER_AGENT | team-worker |
| MAX_FIX_CYCLES | 2 |

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Session state | <session>/session.json (.msg/meta.json) | Yes |
| Task list | TaskList() | Yes |
| Trigger event | From Entry Router detection | Yes |
| Meta state | <session>/.msg/meta.json | Yes |

1. Load session.json for current state, pipeline mode, fix_cycles
2. Run TaskList() to get current task statuses
3. Identify trigger event type from Entry Router

## Phase 3: Event Handlers

### handleCallback

Triggered when a worker sends completion message.

1. Parse message to identify role and task ID:

| Message Pattern | Role Detection |
|----------------|---------------|
| `[explorer]` or task ID `EXPLORE-*` | explorer |
| `[planner]` or task ID `SOLVE-*` | planner |
| `[reviewer]` or task ID `AUDIT-*` | reviewer |
| `[integrator]` or task ID `MARSHAL-*` | integrator |
| `[implementer]` or task ID `BUILD-*` | implementer |

2. Mark task as completed:

```
TaskUpdate({ taskId: "<task-id>", status: "completed" })
```

3. Record completion in session state

4. **Review gate check** (when reviewer completes):
   - If completed task is AUDIT-* AND pipeline is full or batch:
   - Read audit report from `<session>/audits/audit-report.json`
   - Read .msg/meta.json for fix_cycles

   | Verdict | fix_cycles < max | Action |
   |---------|-----------------|--------|
   | rejected | Yes | Increment fix_cycles, create SOLVE-fix + AUDIT re-review tasks (see dispatch.md Review-Fix Cycle), proceed to handleSpawnNext |
   | rejected | No (>= max) | Force proceed -- log warning, unblock MARSHAL |
   | concerns | - | Log concerns, proceed to MARSHAL (non-blocking) |
   | approved | - | Proceed to MARSHAL via handleSpawnNext |

   - Log team_msg with type "review_result" or "fix_required"
   - If force proceeding past rejection, mark skipped fix tasks as completed (skip)

5. **Deferred BUILD task creation** (when integrator completes):
   - If completed task is MARSHAL-* AND pipeline is batch:
   - Read execution queue from `.workflow/issues/queue/execution-queue.json`
   - Parse parallel_groups to determine BUILD task count M
   - Create BUILD-001..M tasks dynamically (see dispatch.md Batch Pipeline BUILD section)
   - Proceed to handleSpawnNext

6. Proceed to handleSpawnNext

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
Execute built-in Phase 1 -> role-spec Phase 2-4 -> built-in Phase 5.`
})
```

3. **Parallel spawn rules**:

| Pipeline | Scenario | Spawn Behavior |
|----------|----------|---------------|
| Quick | All stages | One worker at a time |
| Full | All stages | One worker at a time |
| Batch | EXPLORE-001..N unblocked | Spawn up to 5 explorer workers in parallel |
| Batch | BUILD-001..M unblocked | Spawn up to 3 implementer workers in parallel |
| Batch | Other stages | One worker at a time |

4. **Parallel spawn** (Batch mode with multiple ready tasks for same role):

```
Agent({
  subagent_type: "team-worker",
  description: "Spawn <role>-<N> worker for <task-id>",
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
inner_loop: false

Agent name: <role>-<N>
Only process tasks where owner === "<role>-<N>".

Read role_spec file to load Phase 2-4 domain instructions.
Execute built-in Phase 1 -> role-spec Phase 2-4 -> built-in Phase 5.`
})
```

5. STOP after spawning -- wait for next callback

### handleCheck

Output current pipeline status. Do NOT advance pipeline.

```
Pipeline Status (<pipeline-mode>):
  [DONE]  EXPLORE-001   (explorer)      -> explorations/context-<id>.json
  [DONE]  SOLVE-001     (planner)       -> solutions/solution-<id>.json
  [RUN]   AUDIT-001     (reviewer)      -> reviewing...
  [WAIT]  MARSHAL-001   (integrator)    -> blocked by AUDIT-001
  [WAIT]  BUILD-001     (implementer)   -> blocked by MARSHAL-001

Fix Cycles: <fix_cycles>/<max_fix_cycles>
Mode: <pipeline-mode>
Session: <session-id>
Issues: <issue-id-list>
```

### handleResume

Resume pipeline after user pause or interruption.

1. Audit task list for inconsistencies:
   - Tasks stuck in "in_progress" -> reset to "pending"
   - Tasks with completed blockers but still "pending" -> include in spawn list
2. Proceed to handleSpawnNext

### handleComplete

Triggered when all pipeline tasks are completed.

**Completion check by mode**:

| Mode | Completion Condition |
|------|---------------------|
| quick | All 4 tasks completed |
| full | All 5 tasks (+ any fix cycle tasks) completed |
| batch | All N EXPLORE + N SOLVE + 1 AUDIT + 1 MARSHAL + M BUILD (+ any fix cycle tasks) completed |

1. Verify all tasks completed via TaskList()
2. If any tasks not completed, return to handleSpawnNext
3. If all completed, transition to coordinator Phase 5 (Report + Completion Action)

**Stall detection** (no ready tasks and no running tasks but pipeline not complete):

| Check | Condition | Resolution |
|-------|-----------|------------|
| Worker no response | in_progress task with no callback | Report waiting task list, suggest user `resume` |
| Pipeline deadlock | no ready + no running + has pending | Check blockedBy chain, report blocking point |
| Fix cycle exceeded | AUDIT rejection > 2 rounds | Terminate loop, force proceed with current solution |

## Phase 4: State Persistence

After every handler execution:

1. Update session.json (.msg/meta.json) with current state (fix_cycles, last event, active tasks)
2. Update .msg/meta.json fix_cycles if changed
3. Verify task list consistency
4. STOP and wait for next event
