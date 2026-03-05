# Command: monitor

Event-driven pipeline coordination. v2: 3 discuss points, simplified consensus handling.

## Constants

| Constant | Value |
|----------|-------|
| SPAWN_MODE | background |
| ONE_STEP_PER_INVOCATION | true |
| FAST_ADVANCE_AWARE | true |
| WORKER_AGENT | team-worker |

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Session file | team-session.json | Yes |
| Task list | TaskList() | Yes |
| Active workers | session.active_workers[] | Yes |

## Phase 3: Handler Routing

| Priority | Condition | Handler |
|----------|-----------|---------|
| 1 | `[<role-name>]` from worker | handleCallback |
| 2 | "check" or "status" | handleCheck |
| 3 | "resume" / "continue" | handleResume |
| 4 | None (initial spawn) | handleSpawnNext |
| 5 | "revise" + task ID | handleRevise |
| 6 | "feedback" + text | handleFeedback |
| 7 | "recheck" | handleRecheck |
| 8 | "improve" | handleImprove |

---

### handleCallback

```
Receive callback from [<role>]
  +- Progress update? -> Update session -> STOP
  +- Task completed? -> remove from active_workers -> update session
  |   +- Handle checkpoints (QUALITY-001)
  |   +- -> handleSpawnNext
  +- No matching worker -> scan all active -> handleSpawnNext or STOP
```

Fast-advance reconciliation: read team_msg fast_advance entries, sync active_workers.

### handleCheck

Read-only status report, no advancement.

```
[coordinator] Pipeline Status (v2)
[coordinator] Mode: <mode> | Progress: <completed>/<total> (<percent>%)
[coordinator] Discuss: <completed-discuss>/<total-discuss> rounds

[coordinator] Execution Graph:
  Spec Phase:
    [<icon> RESEARCH-001(+D1)] -> [<icon> DRAFT-001] -> [<icon> DRAFT-002(+D2)] -> [<icon> DRAFT-003] -> [<icon> DRAFT-004] -> [<icon> QUALITY-001(+D3)]
  Impl Phase:
    [<icon> PLAN-001] -> [<icon> IMPL-001] -> [<icon> TEST-001] + [<icon> REVIEW-001]

  done=completed  >>>=running  o=pending
```

Then STOP.

### handleResume

```
Load active_workers
  +- No active -> handleSpawnNext
  +- Has active -> check each:
      +- completed -> mark done
      +- in_progress -> still running
      +- other -> reset to pending
      After: some completed -> handleSpawnNext; all running -> STOP
```

### handleSpawnNext

```
Collect task states from TaskList()
  +- readySubjects: pending + all blockedBy completed
  +- NONE + work in progress -> STOP
  +- NONE + nothing running -> PIPELINE_COMPLETE -> Phase 5
  +- HAS ready -> for each:
      +- Inner Loop role AND already active? -> SKIP
      +- Spawn team-worker (see SKILL.md Spawn Template)
      +- Add to active_workers
      Update session -> STOP
```

### handleRevise / handleFeedback / handleRecheck / handleImprove

Same as v1 (see dispatch.md for templates). Changes:
- Revision tasks use v2 Validation field ("self-validate" or "DISCUSS-NNN")

---

### Consensus-Blocked Handling (v2 simplified)

Only 3 discuss points to handle:

```
handleCallback receives consensus_blocked:
  +- DISCUSS-003 (QUALITY) + HIGH -> PAUSE for user (final gate)
  +- Any discuss + HIGH -> Create REVISION task (max 1 per task)
  +- MEDIUM -> proceed with warning, log to wisdom/issues.md
  +- LOW -> proceed normally
```

### Fast-Advance State Sync

On every coordinator wake:
1. Read team_msg fast_advance entries
2. Sync active_workers with spawned successors

### Worker Failure Handling

1. Reset task -> pending
2. Log via team_msg (type: error)
3. Report to user

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Session not found | Error, suggest re-init |
| Unknown role callback | Log, scan for completions |
| Pipeline stall | Check missing tasks, report |
| Fast-advance orphan | Reset to pending, re-spawn |
