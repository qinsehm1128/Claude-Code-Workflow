# Command: Monitor

Handle all coordinator monitoring events: worker callbacks, status checks, pipeline advancement, and completion. Supports component, system, and full-system pipeline modes with sync point and Generator-Critic loop management.

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Session state | <session>/session.json | Yes |
| Task list | TaskList() | Yes |
| Trigger event | From Entry Router detection | Yes |
| Pipeline definition | From SKILL.md | Yes |

1. Load session.json for current state, `pipeline`, `gc_state`, `sync_points`
2. Run TaskList() to get current task statuses
3. Identify trigger event type from Entry Router

## Phase 3: Event Handlers

### handleCallback

Triggered when a worker sends completion message.

1. Parse message to identify role and task ID:

| Message Pattern | Role Detection |
|----------------|---------------|
| `[researcher]` or task ID `RESEARCH-*` | researcher |
| `[designer]` or task ID `DESIGN-*` | designer |
| `[reviewer]` or task ID `AUDIT-*` | reviewer |
| `[implementer]` or task ID `BUILD-*` | implementer |

2. Mark task as completed:

```
TaskUpdate({ taskId: "<task-id>", status: "completed" })
```

3. Record completion in session state

4. Check if checkpoint feedback is configured for this stage:

| Completed Task | Checkpoint | Action |
|---------------|------------|--------|
| RESEARCH-001 | - | Notify user: research complete |
| DESIGN-001 (tokens) | - | Proceed to AUDIT-001 |
| AUDIT-001 | Sync Point 1 | Check audit signal -> GC loop or unblock parallel (see below) |
| DESIGN-002 (components) | - | Proceed to AUDIT-002 |
| AUDIT-002 | Sync Point 2 | Check audit signal -> GC loop or unblock BUILD-002 |
| BUILD-001 (tokens) | - | Check if BUILD-002 ready |
| BUILD-002 (components) | - | Check if AUDIT-003 exists (full-system) or handleComplete |
| AUDIT-003 | Final | Notify user: final audit complete |

5. **Sync Point handling** (AUDIT task completed):
   - Read audit signal from message: `audit_passed`, `audit_result`, or `fix_required`
   - Route to GC loop control (see below)

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
  team_name: "uidesign",
  name: "<role>",
  run_in_background: true,
  prompt: `## Role Assignment
role: <role>
role_spec: .claude/skills/team-uidesign/role-specs/<role>.md
session: <session-folder>
session_id: <session-id>
team_name: uidesign
requirement: <task-description>
inner_loop: false

Read role_spec file to load Phase 2-4 domain instructions.
Execute built-in Phase 1 -> role-spec Phase 2-4 -> built-in Phase 5.`
})
```

3. **Parallel spawn rules by mode**:

| Mode | Scenario | Spawn Behavior |
|------|----------|---------------|
| Component | Sequential | One task at a time |
| System | After Sync Point 1 | Spawn DESIGN-002 + BUILD-001 in parallel |
| System | After Sync Point 2 | Spawn BUILD-002 |
| Full-system | After Sync Point 1 | Spawn DESIGN-002 + BUILD-001 in parallel |
| Full-system | After BUILD-002 | Spawn AUDIT-003 |

4. STOP after spawning -- wait for next callback

### Generator-Critic Loop Control

When AUDIT task completes, check signal:

| Signal | Condition | Action |
|--------|-----------|--------|
| `audit_passed` | Score >= 8, critical === 0 | GC converged -> record sync_point -> unblock downstream tasks |
| `audit_result` | Score 6-7, critical === 0 | GC round < max -> create DESIGN-fix task |
| `fix_required` | Score < 6 or critical > 0 | GC round < max -> create DESIGN-fix task (CRITICAL) |
| Any | GC round >= max | Escalate to user |

**GC Fix Task Creation**:
```
TaskCreate({
  subject: "DESIGN-fix-<round>",
  description: "PURPOSE: Address audit feedback from AUDIT-<NNN> | Success: All critical/high issues resolved
TASK:
  - Parse audit feedback for specific issues
  - Re-read affected design artifacts
  - Apply fixes: token adjustments, missing states, accessibility gaps
  - Re-write affected files
CONTEXT:
  - Session: <session-folder>
  - Upstream artifacts: audit/audit-<NNN>.md
  - Shared memory: <session>/wisdom/.msg/meta.json
EXPECTED: Updated design artifacts | All flagged issues addressed
CONSTRAINTS: Targeted fixes only"
})
TaskUpdate({ taskId: "DESIGN-fix-<round>", owner: "designer" })
```

After fix completes, create new AUDIT task blocked by the fix task. Increment gc_state.round.

**GC Escalation Options**:
1. Accept current design - Skip remaining review, continue implementation
2. Try one more round - Extra GC loop opportunity
3. Terminate - Stop and handle manually

### Dual-Track Sync Point Management

**When AUDIT at sync point passes (audit_passed)**:
1. Record sync point in session.sync_points
2. Unblock parallel tasks on both tracks
3. team_msg log(sync_checkpoint)

**Dual-track failure fallback**:
- Convert remaining parallel tasks to sequential
- Remove parallel dependencies, add sequential blockedBy
- team_msg log(error): "Dual-track sync failed, falling back to sequential"

### handleCheck

Output current pipeline status.

```
Pipeline Status (<pipeline-mode>):
  [DONE]  RESEARCH-001 (researcher)    -> research/*.json
  [DONE]  DESIGN-001   (designer)      -> design-tokens.json
  [RUN]   AUDIT-001    (reviewer)      -> auditing tokens...
  [WAIT]  BUILD-001    (implementer)   -> blocked by AUDIT-001
  [WAIT]  DESIGN-002   (designer)      -> blocked by AUDIT-001

GC Rounds: 0/2
Sync Points: 0/<expected>
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

**Completion check by mode**:

| Mode | Completion Condition |
|------|---------------------|
| Component | All 4 tasks (+ any fix/retry tasks) have status "completed" |
| System | All 7 tasks (+ any fix/retry tasks) have status "completed" |
| Full-system | All 8 tasks (+ any fix/retry tasks) have status "completed" |

If any tasks not completed, return to handleSpawnNext.
If all completed, transition to coordinator Phase 5.

## Phase 4: State Persistence

After every handler execution:

1. Update session.json with current state (active tasks, gc_state, sync_points, last event)
2. Verify task list consistency
3. STOP and wait for next event
