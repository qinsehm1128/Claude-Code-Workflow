# Monitor Pipeline

Event-driven pipeline coordination. Beat model: coordinator wake -> process -> spawn -> STOP.

## Constants

- SPAWN_MODE: background
- ONE_STEP_PER_INVOCATION: true
- FAST_ADVANCE_AWARE: true
- WORKER_AGENT: team-worker

## Handler Router

| Source | Handler |
|--------|---------|
| Message contains [role-name] | handleCallback |
| "capability_gap" | handleAdapt |
| "check" or "status" | handleCheck |
| "resume" or "continue" | handleResume |
| All tasks completed | handleComplete |
| Default | handleSpawnNext |

## handleCallback

Worker completed. Process and advance.

1. Find matching worker by role in message
2. Check if progress update (inner loop) or final completion
3. Progress -> update session state, STOP
4. Completion -> mark task done, remove from active_workers
5. Check for checkpoints:
   - QUALITY-001 -> display quality gate, pause for user commands
   - PLAN-001 -> read plan.json complexity, create dynamic IMPL tasks per specs/pipelines.md routing
6. -> handleSpawnNext

## handleCheck

Read-only status report, then STOP.

Output:
```
[coordinator] Pipeline Status
[coordinator] Progress: <done>/<total> (<pct>%)
[coordinator] Active: <workers with elapsed time>
[coordinator] Ready: <pending tasks with resolved deps>
[coordinator] Commands: 'resume' to advance | 'check' to refresh
```

## handleResume

1. No active workers -> handleSpawnNext
2. Has active -> check each status
   - completed -> mark done
   - in_progress -> still running
3. Some completed -> handleSpawnNext
4. All running -> report status, STOP

## handleSpawnNext

Find ready tasks, spawn workers, STOP.

1. Collect: completedSubjects, inProgressSubjects, readySubjects
2. No ready + work in progress -> report waiting, STOP
3. No ready + nothing in progress -> handleComplete
4. Has ready -> for each:
   a. Check if inner loop role with active worker -> skip (worker picks up)
   b. TaskUpdate -> in_progress
   c. team_msg log -> task_unblocked
   d. Spawn team-worker (see SKILL.md Spawn Template)
   e. Add to active_workers
5. Update session, output summary, STOP

## handleComplete

Pipeline done. Generate report and completion action.

1. Generate summary (deliverables, stats, discussions)
2. Read session.completion_action:
   - interactive -> AskUserQuestion (Archive/Keep/Export)
   - auto_archive -> Archive & Clean (status=completed, TeamDelete)
   - auto_keep -> Keep Active (status=paused)

## handleAdapt

Capability gap reported mid-pipeline.

1. Parse gap description
2. Check if existing role covers it -> redirect
3. Role count < 5 -> generate dynamic role-spec in <session>/role-specs/
4. Create new task, spawn worker
5. Role count >= 5 -> merge or pause

## Fast-Advance Reconciliation

On every coordinator wake:
1. Read team_msg entries with type="fast_advance"
2. Sync active_workers with spawned successors
3. No duplicate spawns
