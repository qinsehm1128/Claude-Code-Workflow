# Command: Monitor

Handle all coordinator monitoring events for the review pipeline using the async Spawn-and-Stop pattern. One operation per invocation, then STOP and wait for the next callback.

## Constants

| Key | Value | Description |
|-----|-------|-------------|
| SPAWN_MODE | background | All workers spawned via `Task(run_in_background: true)` |
| ONE_STEP_PER_INVOCATION | true | Coordinator does one operation then STOPS |
| WORKER_AGENT | team-worker | All workers spawned as team-worker agents |

### Role-Worker Map

| Prefix | Role | Role Spec | inner_loop |
|--------|------|-----------|------------|
| SCAN | scanner | `.claude/skills/team-review/role-specs/scanner.md` | false |
| REV | reviewer | `.claude/skills/team-review/role-specs/reviewer.md` | false |
| FIX | fixer | `.claude/skills/team-review/role-specs/fixer.md` | false |

### Pipeline Modes

| Mode | Stages |
|------|--------|
| scan-only | SCAN-001 |
| default | SCAN-001 -> REV-001 |
| full | SCAN-001 -> REV-001 -> FIX-001 |
| fix-only | FIX-001 |

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Session file | `<session-folder>/.msg/meta.json` | Yes |
| Task list | `TaskList()` | Yes |
| Active workers | session.active_workers[] | Yes |
| Pipeline mode | session.pipeline_mode | Yes |

```
Load session state:
  1. Read <session-folder>/.msg/meta.json -> session
  2. TaskList() -> allTasks
  3. Extract pipeline_mode from session
  4. Extract active_workers[] from session (default: [])
  5. Parse $ARGUMENTS to determine trigger event
  6. autoYes = /\b(-y|--yes)\b/.test(args)
```

## Phase 3: Event Handlers

### Wake-up Source Detection

Parse `$ARGUMENTS` to determine handler:

| Priority | Condition | Handler |
|----------|-----------|---------|
| 1 | Message contains `[scanner]`, `[reviewer]`, or `[fixer]` | handleCallback |
| 2 | Contains "check" or "status" | handleCheck |
| 3 | Contains "resume", "continue", or "next" | handleResume |
| 4 | Pipeline detected as complete (no pending, no in_progress) | handleComplete |
| 5 | None of the above (initial spawn after dispatch) | handleSpawnNext |

---

### Handler: handleCallback

Worker completed a task. Verify completion, check pipeline conditions, advance.

```
Receive callback from [<role>]
  +- Find matching active worker by role tag
  +- Task status = completed?
  |   +- YES -> remove from active_workers -> update session
  |   |   +- role = scanner?
  |   |   |   +- Read session.findings_count from meta.json
  |   |   |   +- findings_count === 0?
  |   |   |   |   +- YES -> Skip remaining stages:
  |   |   |   |   |   Delete all REV-* and FIX-* tasks (TaskUpdate status='deleted')
  |   |   |   |   |   Log: "0 findings, skipping review/fix stages"
  |   |   |   |   |   -> handleComplete
  |   |   |   |   +- NO -> normal advance
  |   |   |   +- -> handleSpawnNext
  |   |   +- role = reviewer?
  |   |   |   +- pipeline_mode === 'full'?
  |   |   |   |   +- YES -> Need fix confirmation gate
  |   |   |   |   |   +- autoYes?
  |   |   |   |   |   |   +- YES -> Set fix_scope='all' in meta.json
  |   |   |   |   |   |   +- Write fix-manifest.json
  |   |   |   |   |   |   +- -> handleSpawnNext
  |   |   |   |   |   +- NO -> AskUserQuestion:
  |   |   |   |   |       question: "<N> findings reviewed. Proceed with fix?"
  |   |   |   |   |       header: "Fix Confirmation"
  |   |   |   |   |       options:
  |   |   |   |   |         - "Fix all": Set fix_scope='all'
  |   |   |   |   |         - "Fix critical/high only": Set fix_scope='critical,high'
  |   |   |   |   |         - "Skip fix": Delete FIX-* tasks -> handleComplete
  |   |   |   |   |       +- Write fix_scope to meta.json
  |   |   |   |   |       +- Write fix-manifest.json:
  |   |   |   |   |           { source: "<session>/review/review-report.json",
  |   |   |   |   |             scope: fix_scope, session: sessionFolder }
  |   |   |   |   |       +- -> handleSpawnNext
  |   |   |   |   +- NO -> normal advance -> handleSpawnNext
  |   |   +- role = fixer?
  |   |       +- -> handleSpawnNext (checks for completion naturally)
  |   +- NO -> progress message, do not advance -> STOP
  +- No matching worker found
      +- Scan all active workers for completed tasks
      +- Found completed -> process each -> handleSpawnNext
      +- None completed -> STOP
```

---

### Handler: handleSpawnNext

Find all ready tasks, spawn one team-worker agent in background, update session, STOP.

```
Collect task states from TaskList()
  +- completedSubjects: status = completed
  +- inProgressSubjects: status = in_progress
  +- deletedSubjects: status = deleted
  +- readySubjects: status = pending
      AND (no blockedBy OR all blockedBy in completedSubjects)

Ready tasks found?
  +- NONE + work in progress -> report waiting -> STOP
  +- NONE + nothing in progress -> PIPELINE_COMPLETE -> handleComplete
  +- HAS ready tasks -> take first ready task:
      +- Determine role from prefix:
      |   SCAN-* -> scanner
      |   REV-*  -> reviewer
      |   FIX-*  -> fixer
      +- TaskUpdate -> in_progress
      +- team_msg log -> task_unblocked (team_session_id=<session-id>)
      +- Spawn team-worker (see spawn call below)
      +- Add to session.active_workers
      +- Update session file
      +- Output: "[coordinator] Spawned <role> for <subject>"
      +- STOP
```

**Spawn worker tool call**:

```
Agent({
  agent_type: "team-worker",
  description: "Spawn <role> worker for <subject>",
  team_name: "review",
  name: "<role>",
  run_in_background: true,
  prompt: `## Role Assignment
role: <role>
role_spec: .claude/skills/team-review/role-specs/<role>.md
session: <session-folder>
session_id: <session-id>
team_name: review
requirement: <task-description>
inner_loop: false

## Current Task
- Task ID: <task-id>
- Task: <subject>

Read role_spec file to load Phase 2-4 domain instructions.
Execute built-in Phase 1 -> role-spec Phase 2-4 -> built-in Phase 5.`
})
```

---

### Handler: handleCheck

Read-only status report. No pipeline advancement.

**Output format**:

```
[coordinator] Review Pipeline Status
[coordinator] Mode: <pipeline_mode>
[coordinator] Progress: <completed>/<total> (<percent>%)

[coordinator] Pipeline Graph:
  SCAN-001: <status-icon> <summary>
  REV-001:  <status-icon> <summary>
  FIX-001:  <status-icon> <summary>

  done=completed  >>>=running  o=pending  x=deleted  .=not created

[coordinator] Active Workers:
  > <subject> (<role>) - running

[coordinator] Ready to spawn: <subjects>
[coordinator] Commands: 'resume' to advance | 'check' to refresh
```

Then STOP.

---

### Handler: handleResume

Check active worker completion, process results, advance pipeline.

```
Load active_workers from session
  +- No active workers -> handleSpawnNext
  +- Has active workers -> check each:
      +- status = completed -> mark done, remove from active_workers, log
      +- status = in_progress -> still running, log
      +- other status -> worker failure -> reset to pending
      After processing:
        +- Some completed -> handleSpawnNext
        +- All still running -> report status -> STOP
        +- All failed -> handleSpawnNext (retry)
```

---

### Handler: handleComplete

Pipeline complete. Generate summary and finalize session.

```
All tasks completed or deleted (no pending, no in_progress)
  +- Read final session state from meta.json
  +- Generate pipeline summary:
  |   - Pipeline mode
  |   - Findings count
  |   - Stages completed
  |   - Fix results (if applicable)
  |   - Deliverable paths
  |
  +- Update session:
  |   session.pipeline_status = 'complete'
  |   session.completed_at = <timestamp>
  |   Write meta.json
  |
  +- team_msg log -> pipeline_complete
  +- Output summary to user
  +- STOP
```

---

### Worker Failure Handling

When a worker has unexpected status (not completed, not in_progress):

1. Reset task -> pending via TaskUpdate
2. Remove from active_workers
3. Log via team_msg (type: error)
4. Report to user: task reset, will retry on next resume

## Phase 4: State Persistence

After every handler action, before STOP:

| Check | Action |
|-------|--------|
| Session state consistent | active_workers matches TaskList in_progress tasks |
| No orphaned tasks | Every in_progress task has an active_worker entry |
| Meta.json updated | Write updated session state |
| Completion detection | readySubjects=0 + inProgressSubjects=0 -> handleComplete |

```
Persist:
  1. Reconcile active_workers with actual TaskList states
  2. Remove entries for completed/deleted tasks
  3. Write updated meta.json
  4. Verify consistency
  5. STOP (wait for next callback)
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Session file not found | Error, suggest re-initialization |
| Worker callback from unknown role | Log info, scan for other completions |
| All workers still running on resume | Report status, suggest check later |
| Pipeline stall (no ready, no running, has pending) | Check blockedBy chains, report to user |
| 0 findings after scan | Delete remaining stages, complete pipeline |
| User declines fix | Delete FIX tasks, complete with review-only results |
