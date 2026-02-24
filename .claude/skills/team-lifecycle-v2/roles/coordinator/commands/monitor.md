# Monitor Command - Coordination Loop

**Purpose**: Monitor task progress, route messages, and handle checkpoints

**Invoked by**: Coordinator role.md Phase 4

**Output Tag**: `[coordinator]`

---

## Coordination Loop

> **设计原则**: 模型执行没有时间概念，禁止任何形式的轮询等待。
> 使用同步 `Task(run_in_background: false)` 调用作为等待机制。
> Worker 返回 = 阶段完成信号（天然回调），无需 sleep 轮询。

```javascript
Output("[coordinator] Entering coordination loop (Stop-Wait mode)...")

// Sequentially execute each task by spawning its worker
const allTasks = TaskList()
const pendingTasks = allTasks.filter(t => t.status !== 'completed' && t.assigned_to !== 'coordinator')

for (const task of pendingTasks) {
  // Check if all dependencies are met
  const allDepsMet = (task.dependencies || []).every(depId => {
    const dep = TaskGet(depId)
    return dep.status === "completed"
  })

  if (!allDepsMet) {
    Output(`[coordinator] Task ${task.task_id} blocked by dependencies, skipping`)
    continue
  }

  Output(`[coordinator] Starting task: ${task.task_id} (assigned to: ${task.assigned_to})`)

  // Mark as active
  TaskUpdate(task.task_id, {
    status: "active",
    started_at: new Date().toISOString()
  })

  // Spawn worker — blocks until worker returns (Stop-Wait)
  Task({
    subagent_type: "general-purpose",
    prompt: `Execute task ${task.task_id}: ${task.description}
Assigned role: ${task.assigned_to}
When complete, mark TaskUpdate(${task.task_id}, { status: "completed" })`,
    run_in_background: false
  })

  // Worker returned — check status
  const completedTask = TaskGet(task.task_id)
  Output(`[coordinator] Task ${task.task_id} status: ${completedTask.status}`)

  if (completedTask.status === "completed") {
    handleTaskComplete({ task_id: task.task_id, output: completedTask.output })
  }

  // Update session progress
  const session = Read(sessionFile)
  const allTasksNow = TaskList()
  session.tasks_completed = allTasksNow.filter(t => t.status === "completed").length
  Write(sessionFile, session)

  // Check if all tasks complete
  const remaining = allTasksNow.filter(t => t.status !== "completed" && t.assigned_to !== 'coordinator')
  if (remaining.length === 0) {
    Output("[coordinator] All tasks completed!")
    break
  }
}

Output("[coordinator] Coordination loop complete")
```

---

## Message Handlers

### handleTaskComplete

```javascript
function handleTaskComplete(message) {
  const taskId = message.task_id
  const task = TaskGet(taskId)

  Output(`[coordinator] Task completed: ${taskId}`)

  // Mark task as completed
  TaskUpdate(taskId, {
    status: "completed",
    completed_at: new Date().toISOString(),
    output: message.output
  })

  // Save output to file if provided
  if (message.output_content) {
    const outputFile = `D:/Claude_dms3/.workflow/.sessions/${session.session_id}/${taskId}-output.md`
    Write(outputFile, message.output_content)
    TaskUpdate(taskId, { output_file: outputFile })
    Output(`[coordinator] Output saved: ${outputFile}`)
  }

  // Check for dependent tasks
  const dependentTasks = allTasks.filter(t =>
    t.dependencies.includes(taskId) && t.status === "blocked"
  )

  Output(`[coordinator] Checking ${dependentTasks.length} dependent tasks`)

  for (const depTask of dependentTasks) {
    // Check if all dependencies are met
    const allDepsMet = depTask.dependencies.every(depId => {
      const dep = TaskGet(depId)
      return dep.status === "completed"
    })

    if (allDepsMet) {
      Output(`[coordinator] Unblocking task: ${depTask.task_id}`)
      TaskUpdate(depTask.task_id, { status: "pending" })

      // Activate task if sequential mode or if parallel mode
      if (requirements.executionMethod === "sequential") {
        // Only activate one task at a time
        const activeTasks = allTasks.filter(t => t.status === "active")
        if (activeTasks.length === 0) {
          kickTask(depTask.task_id)
        }
      } else {
        // Parallel mode: activate immediately
        kickTask(depTask.task_id)
      }
    }
  }

  // Special checkpoint: Research complete before implementation
  if (taskId === "finalize-spec" && requirements.mode === "full-lifecycle") {
    Output("[coordinator] Spec phase complete. Checkpoint before implementation.")
    checkpointPending = true
    handleSpecCompleteCheckpoint()
  }
}

function kickTask(taskId) {
  TaskUpdate(taskId, { status: "active", started_at: new Date().toISOString() })
  Output(`[coordinator] Kicked task: ${taskId}`)

  // Notify assigned worker
  const task = TaskGet(taskId)
  TeamSendMessage({
    team_id: session.team_id,
    recipient: task.assigned_to,
    type: "task_assigned",
    task_id: taskId
  })
}
```

---

### handleTaskBlocked

```javascript
function handleTaskBlocked(message) {
  const taskId = message.task_id
  const reason = message.reason

  Output(`[coordinator] Task blocked: ${taskId}`)
  Output(`[coordinator] Reason: ${reason}`)

  // Mark task as blocked
  TaskUpdate(taskId, {
    status: "blocked",
    block_reason: reason
  })

  // Check if block reason is dependency-related
  if (reason.includes("dependency")) {
    Output("[coordinator] Dependency block detected. Waiting for predecessor tasks.")
    // Normal dependency block - no action needed
    return
  }

  // Check if block reason is ambiguity-related
  if (reason.includes("ambiguous") || reason.includes("unclear")) {
    Output("[coordinator] Ambiguity detected. Routing to researcher.")
    handleAmbiguityBlock(taskId, reason)
    return
  }

  // Unknown block reason - escalate to user
  Output("[coordinator] Unknown block reason. Escalating to user.")
  const userDecision = AskUserQuestion({
    question: `Task ${taskId} is blocked: ${reason}. How to proceed?`,
    choices: [
      "retry - Retry the task",
      "skip - Skip this task",
      "abort - Abort entire workflow",
      "manual - Provide manual input"
    ]
  })

  switch (userDecision) {
    case "retry":
      TaskUpdate(taskId, { status: "pending" })
      kickTask(taskId)
      break

    case "skip":
      TaskUpdate(taskId, { status: "skipped" })
      Output(`[coordinator] Task ${taskId} skipped by user`)
      break

    case "abort":
      Output("[coordinator] Workflow aborted by user")
      loopActive = false
      break

    case "manual":
      const manualInput = AskUserQuestion({
        question: `Provide manual input for task ${taskId}:`,
        type: "text"
      })
      TaskUpdate(taskId, {
        status: "completed",
        output: manualInput,
        completed_by: "user"
      })
      Output(`[coordinator] Task ${taskId} completed with manual input`)
      break
  }
}

function handleAmbiguityBlock(taskId, reason) {
  // Create research task
  const researchTaskId = `research-${taskId}-${Date.now()}`

  TaskCreate({
    team_id: session.team_id,
    task_id: researchTaskId,
    assigned_to: "researcher",
    phase: "research",
    description: `Research ambiguity in ${taskId}: ${reason}`,
    dependencies: [],
    input: {
      blocked_task: taskId,
      ambiguity: reason
    },
    status: "active"
  })

  Output(`[coordinator] Created research task: ${researchTaskId}`)

  // Notify researcher
  TeamSendMessage({
    team_id: session.team_id,
    recipient: "researcher",
    type: "research_requested",
    task_id: researchTaskId,
    context: {
      blocked_task: taskId,
      reason: reason
    }
  })
}
```

---

### handleDiscussionNeeded

```javascript
function handleDiscussionNeeded(message) {
  const taskId = message.task_id
  const question = message.question
  const context = message.context

  Output(`[coordinator] Discussion needed for task: ${taskId}`)
  Output(`[coordinator] Question: ${question}`)

  // Route to user
  const userResponse = AskUserQuestion({
    question: `Task ${taskId} needs clarification:\n\n${question}\n\nContext: ${context}`,
    type: "text"
  })

  // Send response back to worker
  TeamSendMessage({
    team_id: session.team_id,
    recipient: message.sender,
    type: "discussion_response",
    task_id: taskId,
    response: userResponse
  })

  Output(`[coordinator] User response sent to ${message.sender}`)
}
```

---

### handleResearchComplete

```javascript
function handleResearchComplete(message) {
  const researchTaskId = message.task_id
  const findings = message.findings
  const blockedTaskId = message.blocked_task

  Output(`[coordinator] Research complete: ${researchTaskId}`)
  Output(`[coordinator] Findings: ${findings}`)

  // Mark research task as completed
  TaskUpdate(researchTaskId, {
    status: "completed",
    output: findings
  })

  // Unblock original task
  const blockedTask = TaskGet(blockedTaskId)
  if (blockedTask.status === "blocked") {
    TaskUpdate(blockedTaskId, {
      status: "pending",
      research_findings: findings
    })

    Output(`[coordinator] Unblocked task: ${blockedTaskId}`)

    // Kick task if ready
    const allDepsMet = blockedTask.dependencies.every(depId => {
      const dep = TaskGet(depId)
      return dep.status === "completed"
    })

    if (allDepsMet) {
      kickTask(blockedTaskId)
    }
  }
}
```

---

## Checkpoint Handlers

### handleSpecCompleteCheckpoint

```javascript
function handleSpecCompleteCheckpoint() {
  Output("[coordinator] ========================================")
  Output("[coordinator] SPEC PHASE COMPLETE - CHECKPOINT")
  Output("[coordinator] ========================================")

  // Load spec output
  const specOutput = Read(getTaskOutput("finalize-spec"))

  Output("[coordinator] Specification summary:")
  Output(specOutput.substring(0, 500) + "...") // Show first 500 chars

  // Ask user to review
  const userDecision = AskUserQuestion({
    question: "Spec phase complete. Review specifications before proceeding to implementation?",
    choices: [
      "proceed - Proceed to implementation",
      "review - Review full specifications",
      "revise - Revise specifications",
      "stop - Stop here (spec-only)"
    ]
  })

  switch (userDecision) {
    case "proceed":
      Output("[coordinator] Proceeding to implementation phase")
      checkpointPending = false
      // Kick first impl task
      kickTask("setup-scaffold")
      break

    case "review":
      Output("[coordinator] Full specification:")
      Output(specOutput)
      // Ask again after review
      handleSpecCompleteCheckpoint()
      break

    case "revise":
      const revisionScope = AskUserQuestion({
        question: "Which tasks need revision?",
        type: "text"
      })
      Output(`[coordinator] Revision requested: ${revisionScope}`)
      // Create revision tasks (implementation depends on revision scope)
      // For now, just log and ask to proceed
      handleSpecCompleteCheckpoint()
      break

    case "stop":
      Output("[coordinator] Stopping at spec phase (user request)")
      loopActive = false
      break
  }
}
```

---

## Message Routing Tables

### Spec Phase Messages

| Message Type | Sender | Trigger | Coordinator Action |
|--------------|--------|---------|-------------------|
| `task_complete` | spec-writer | Task finished | Update session, unblock dependents, kick next |
| `task_blocked` | spec-writer | Dependency missing | Log block, wait for predecessor |
| `discussion_needed` | spec-writer | Ambiguity found | Route to user via AskUserQuestion |
| `research_requested` | spec-writer | Need external info | Create research task, assign to researcher |
| `research_complete` | researcher | Research done | Unblock original task, kick if ready |

### Impl Phase Messages

| Message Type | Sender | Trigger | Coordinator Action |
|--------------|--------|---------|-------------------|
| `task_complete` | implementer | Task finished | Update session, unblock dependents, kick next |
| `task_blocked` | implementer | Dependency missing | Log block, wait for predecessor |
| `discussion_needed` | implementer | Ambiguity found | Route to user via AskUserQuestion |
| `spec_clarification` | implementer | Spec unclear | Route to spec-writer or user |
| `test_failed` | implementer | Tests failing | Log failure, ask user to debug or retry |

---

## Progress Tracking

```javascript
function logProgress() {
  const session = Read(sessionFile)
  const completedCount = session.tasks_completed
  const totalCount = session.tasks_total
  const percentage = Math.round((completedCount / totalCount) * 100)

  Output(`[coordinator] Progress: ${completedCount}/${totalCount} tasks (${percentage}%)`)

  // Log current phase
  const currentPhase = session.current_phase
  Output(`[coordinator] Current phase: ${currentPhase}`)

  // Log active tasks
  const activeTasks = allTasks.filter(t => t.status === "active")
  if (activeTasks.length > 0) {
    Output(`[coordinator] Active tasks: ${activeTasks.map(t => t.task_id).join(", ")}`)
  }

  // Log blocked tasks
  const blockedTasks = allTasks.filter(t => t.status === "blocked")
  if (blockedTasks.length > 0) {
    Output(`[coordinator] Blocked tasks: ${blockedTasks.map(t => t.task_id).join(", ")}`)
  }
}

// Call logProgress every 10 iterations
let iterationCount = 0
if (iterationCount % 10 === 0) {
  logProgress()
}
iterationCount++
```

---

## Error Recovery

### Task Timeout Handling

```javascript
function checkTaskTimeouts() {
  const now = new Date()
  const timeoutThreshold = 30 * 60 * 1000 // 30 minutes

  const activeTasks = allTasks.filter(t => t.status === "active")

  for (const task of activeTasks) {
    const startTime = new Date(task.started_at)
    const elapsed = now - startTime

    if (elapsed > timeoutThreshold) {
      Output(`[coordinator] Task timeout detected: ${task.task_id}`)
      Output(`[coordinator] Elapsed time: ${Math.round(elapsed / 60000)} minutes`)

      const userDecision = AskUserQuestion({
        question: `Task ${task.task_id} has been running for ${Math.round(elapsed / 60000)} minutes. Action?`,
        choices: [
          "wait - Continue waiting",
          "retry - Restart task",
          "skip - Skip task",
          "abort - Abort workflow"
        ]
      })

      switch (userDecision) {
        case "wait":
          // Reset timeout by updating started_at
          TaskUpdate(task.task_id, { started_at: new Date().toISOString() })
          break

        case "retry":
          TaskUpdate(task.task_id, { status: "pending" })
          kickTask(task.task_id)
          break

        case "skip":
          TaskUpdate(task.task_id, { status: "skipped" })
          break

        case "abort":
          loopActive = false
          break
      }
    }
  }
}

// Call checkTaskTimeouts every iteration
checkTaskTimeouts()
```

---

## Output Format

All outputs from this command use the `[coordinator]` tag:

```
[coordinator] Entering coordination loop...
[coordinator] Received message: task_complete from spec-writer
[coordinator] Task completed: req-analysis
[coordinator] Checking 1 dependent tasks
[coordinator] Unblocking task: arch-design
[coordinator] Kicked task: arch-design
[coordinator] Progress: 1/12 tasks (8%)
```
