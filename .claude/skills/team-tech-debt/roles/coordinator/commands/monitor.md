# Command: Monitor

Handle all coordinator monitoring events: worker callbacks, status checks, pipeline advancement, fix-verify loops, and completion.

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
| `[scanner]` or task ID `TDSCAN-*` | scanner |
| `[assessor]` or task ID `TDEVAL-*` | assessor |
| `[planner]` or task ID `TDPLAN-*` | planner |
| `[executor]` or task ID `TDFIX-*` | executor |
| `[validator]` or task ID `TDVAL-*` | validator |

### Pipeline Stage Order

```
TDSCAN -> TDEVAL -> TDPLAN -> TDFIX -> TDVAL
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

4. **Plan Approval Gate** (when planner TDPLAN completes):

Before advancing to TDFIX, present the remediation plan to the user for approval.

```
// Read the generated plan
planContent = Read(<session>/plan/remediation-plan.md)
  || Read(<session>/plan/remediation-plan.json)

AskUserQuestion({
  questions: [{
    question: "Remediation plan generated. Review and decide:",
    header: "Plan Review",
    multiSelect: false,
    options: [
      { label: "Approve", description: "Proceed with fix execution" },
      { label: "Revise", description: "Re-run planner with feedback" },
      { label: "Abort", description: "Stop pipeline, no fixes applied" }
    ]
  }]
})
```

| Decision | Action |
|----------|--------|
| Approve | Proceed to handleSpawnNext (TDFIX becomes ready) |
| Revise | Create TDPLAN-revised task, proceed to handleSpawnNext |
| Abort | Log shutdown, transition to handleComplete |

5. **GC Loop Check** (when validator TDVAL completes):

Read `<session>/.msg/meta.json` for validation results.

| Condition | Action |
|-----------|--------|
| No regressions found | Proceed to handleSpawnNext (pipeline complete) |
| Regressions found AND gc_rounds < 3 | Create fix-verify tasks, increment gc_rounds |
| Regressions found AND gc_rounds >= 3 | Accept current state, proceed to handleComplete |

**Fix-Verify Task Creation** (when regressions detected):

```
TaskCreate({
  subject: "TDFIX-fix-<round>",
  description: "PURPOSE: Fix regressions found by validator | Success: All regressions resolved
TASK:
  - Load validation report with regression details
  - Apply targeted fixes for each regression
  - Re-validate fixes locally before completion
CONTEXT:
  - Session: <session-folder>
  - Upstream artifacts: <session>/.msg/meta.json
EXPECTED: Fixed source files | Regressions resolved
CONSTRAINTS: Targeted fixes only | Do not introduce new regressions",
  blockedBy: [],
  status: "pending"
})

TaskCreate({
  subject: "TDVAL-recheck-<round>",
  description: "PURPOSE: Re-validate after regression fixes | Success: Zero regressions
TASK:
  - Run full validation suite on fixed code
  - Compare debt scores before and after
  - Report regression status
CONTEXT:
  - Session: <session-folder>
EXPECTED: Validation results with regression count
CONSTRAINTS: Read-only validation",
  blockedBy: ["TDFIX-fix-<round>"],
  status: "pending"
})
```

6. Proceed to handleSpawnNext

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
  'TDSCAN': { role: 'scanner' },
  'TDEVAL': { role: 'assessor' },
  'TDPLAN': { role: 'planner' },
  'TDFIX':  { role: 'executor' },
  'TDVAL':  { role: 'validator' }
}
```

5. Spawn team-worker (one at a time for sequential pipeline):

```
Agent({
  subagent_type: "team-worker",
  description: "Spawn <role> worker for <task-id>",
  team_name: "tech-debt",
  name: "<role>",
  run_in_background: true,
  prompt: `## Role Assignment
role: <role>
role_spec: .claude/skills/team-tech-debt/role-specs/<role>.md
session: <session-folder>
session_id: <session-id>
team_name: tech-debt
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
  [DONE]  TDSCAN-001  (scanner)    -> scan complete
  [DONE]  TDEVAL-001  (assessor)   -> assessment ready
  [DONE]  TDPLAN-001  (planner)    -> plan approved
  [RUN]   TDFIX-001   (executor)   -> fixing...
  [WAIT]  TDVAL-001   (validator)  -> blocked by TDFIX-001

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

1. Verify all tasks (including any fix-verify tasks) have status "completed"
2. If any tasks not completed, return to handleSpawnNext
3. If all completed:
   - Read final state from `<session>/.msg/meta.json`
   - Compile summary: total tasks, completed, gc_rounds, debt_score_before, debt_score_after
   - If worktree exists and validation passed: commit changes, create PR, cleanup worktree
   - Transition to coordinator Phase 5

## Phase 4: State Persistence

After every handler execution:

1. Update session.json with current state (active tasks, gc_rounds, last event)
2. Verify task list consistency
3. STOP and wait for next event
