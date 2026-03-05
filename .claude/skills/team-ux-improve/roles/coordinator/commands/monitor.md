# Monitor Command

## Purpose

Handle worker callbacks, status checks, pipeline advancement, and completion detection.

---

## Handlers

### handleCallback

**Trigger**: Worker SendMessage with `[scanner]`, `[diagnoser]`, `[designer]`, `[implementer]`, or `[tester]` tag.

1. Parse worker role from message tag
2. Mark corresponding task as completed: `TaskUpdate({ taskId: <task-id>, status: "completed" })`
3. Log completion to message bus:
   ```
   team_msg(operation="log", session_id=<session-id>, from="coordinator",
            type="task_complete", data={ role: <role>, task_id: <task-id> })
   ```
4. Check if all tasks completed -> handleComplete
5. Otherwise -> handleSpawnNext

### handleCheck

**Trigger**: User "check" or "status" command.

1. Load TaskList
2. Build status graph:
   ```
   Pipeline Status:
   ✅ SCAN-001 (scanner) - completed
   ✅ DIAG-001 (diagnoser) - completed
   🔄 DESIGN-001 (designer) - in_progress
   ⏳ IMPL-001 (implementer) - pending [blocked by DESIGN-001]
   ⏳ TEST-001 (tester) - pending [blocked by IMPL-001]
   ```
3. Output status graph, do NOT advance pipeline
4. STOP

### handleResume

**Trigger**: User "resume" or "continue" command.

1. Load TaskList
2. Check for fast-advance orphans:
   - Tasks with status "in_progress" but no active worker
   - Reset orphans to "pending"
3. -> handleSpawnNext

### handleSpawnNext

**Trigger**: After handleCallback or handleResume.

1. Load TaskList
2. Find ready tasks:
   - status = "pending"
   - All blockedBy tasks have status "completed"
3. For each ready task:
   - Extract role from task owner
   - Extract inner_loop from task description metadata
   - Spawn team-worker agent:
     ```
     Agent({
       subagent_type: "team-worker",
       description: "Spawn <role> worker",
       team_name: "ux-improve",
       name: "<role>",
       run_in_background: true,
       prompt: `## Role Assignment
     role: <role>
     role_spec: .claude/skills/team-ux-improve/role-specs/<role>.md
     session: <session-folder>
     session_id: <session-id>
     team_name: ux-improve
     requirement: <task-description>
     inner_loop: <inner-loop-value>

     Read role_spec file to load Phase 2-4 domain instructions.
     Execute built-in Phase 1 -> role-spec Phase 2-4 -> built-in Phase 5.`
     })
     ```
4. STOP (wait for next callback)

### handleConsensus

**Trigger**: consensus_blocked message from worker.

Route by severity:

| Severity | Action |
|----------|--------|
| HIGH | Pause pipeline, AskUserQuestion for resolution |
| MEDIUM | Log warning, continue pipeline |
| LOW | Log info, continue pipeline |

### handleComplete

**Trigger**: All tasks have status "completed".

1. Verify all tasks completed via TaskList
2. Generate pipeline summary:
   - Total tasks: 5
   - Duration: <calculated>
   - Deliverables: list artifact paths
3. Execute completion action (see coordinator Phase 5)

---

## Fast-Advance Detection

When handleCallback detects a completed task:

| Condition | Action |
|-----------|--------|
| Exactly 1 ready successor, simple linear | Worker already fast-advanced, log sync |
| Multiple ready successors | Coordinator spawns all |
| No ready successors, all done | -> handleComplete |
| No ready successors, some pending | Wait (blocked tasks) |

---

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Worker callback with unknown role | Log warning, ignore |
| Task not found for callback | Log error, check TaskList |
| Spawn fails | Mark task as failed, log error, try next ready task |
| All tasks failed | Report failure, execute completion action |
