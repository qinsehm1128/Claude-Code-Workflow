# Implement Command

## Purpose
Multi-backend code implementation with progress tracking and batch execution support.

## Execution Paths

### Path 1: Simple Task + Agent Backend (Direct Edit)

**Criteria**:
```javascript
function isSimpleTask(task) {
  return task.description.length < 200 &&
         !task.description.includes("refactor") &&
         !task.description.includes("architecture") &&
         !task.description.includes("multiple files")
}
```

**Execution**:
```javascript
if (isSimpleTask(task) && executor === "agent") {
  // Direct file edit without subagent overhead
  const targetFile = task.metadata?.target_file
  if (targetFile) {
    const content = Read(targetFile)
    const prompt = buildExecutionPrompt(task, plan, [task])

    // Apply edit directly
    Edit(targetFile, oldContent, newContent)

    return {
      success: true,
      files_modified: [targetFile],
      method: "direct_edit"
    }
  }
}
```

### Path 2: Agent Backend (code-developer subagent)

**Execution**:
```javascript
if (executor === "agent") {
  const prompt = buildExecutionPrompt(task, plan, [task])

  const result = Subagent({
    type: "code-developer",
    prompt: prompt,
    run_in_background: false // Synchronous execution
  })

  return {
    success: result.success,
    files_modified: result.files_modified || [],
    method: "subagent"
  }
}
```

### Path 3: Codex Backend (CLI)

**Execution**:
```javascript
if (executor === "codex") {
  const prompt = buildExecutionPrompt(task, plan, [task])

  team_msg({
    to: "coordinator",
    type: "progress_update",
    task_id: task.task_id,
    status: "executing_codex",
    message: "Starting Codex implementation..."
  }, "[executor]")

  const result = Bash(
    `ccw cli -p "${escapePrompt(prompt)}" --tool codex --mode write --cd ${task.metadata?.working_dir || "."}`,
    { run_in_background: true, timeout: 300000 }
  )

  // Wait for CLI completion via hook callback
  return {
    success: true,
    files_modified: [], // Will be detected by git diff
    method: "codex_cli"
  }
}
```

### Path 4: Gemini Backend (CLI)

**Execution**:
```javascript
if (executor === "gemini") {
  const prompt = buildExecutionPrompt(task, plan, [task])

  team_msg({
    to: "coordinator",
    type: "progress_update",
    task_id: task.task_id,
    status: "executing_gemini",
    message: "Starting Gemini implementation..."
  }, "[executor]")

  const result = Bash(
    `ccw cli -p "${escapePrompt(prompt)}" --tool gemini --mode write --cd ${task.metadata?.working_dir || "."}`,
    { run_in_background: true, timeout: 300000 }
  )

  // Wait for CLI completion via hook callback
  return {
    success: true,
    files_modified: [], // Will be detected by git diff
    method: "gemini_cli"
  }
}
```

## Prompt Building

### Single Task Prompt

```javascript
function buildExecutionPrompt(task, plan, tasks) {
  const context = extractContextFromPlan(plan, task)

  return `
# Implementation Task: ${task.task_id}

## Task Description
${task.description}

## Acceptance Criteria
${task.acceptance_criteria?.map((c, i) => `${i + 1}. ${c}`).join("\n") || "None specified"}

## Context from Plan
${context}

## Files to Modify
${task.metadata?.target_files?.join("\n") || "Auto-detect based on task"}

## Constraints
- Follow existing code style and patterns
- Preserve backward compatibility
- Add appropriate error handling
- Include inline comments for complex logic
- Update related tests if applicable

## Expected Output
- Modified files with implementation
- Brief summary of changes made
- Any assumptions or decisions made during implementation
`.trim()
}
```

### Batch Task Prompt

```javascript
function buildBatchPrompt(tasks, plan) {
  const taskDescriptions = tasks.map((task, i) => `
### Task ${i + 1}: ${task.task_id}
**Description**: ${task.description}
**Acceptance Criteria**:
${task.acceptance_criteria?.map((c, j) => `  ${j + 1}. ${c}`).join("\n") || "  None specified"}
**Target Files**: ${task.metadata?.target_files?.join(", ") || "Auto-detect"}
  `).join("\n")

  return `
# Batch Implementation: ${tasks.length} Tasks

## Tasks to Implement
${taskDescriptions}

## Context from Plan
${extractContextFromPlan(plan, tasks[0])}

## Batch Execution Guidelines
- Implement tasks in the order listed
- Ensure each task's acceptance criteria are met
- Maintain consistency across all implementations
- Report any conflicts or dependencies discovered
- Follow existing code patterns and style

## Expected Output
- All tasks implemented successfully
- Summary of changes per task
- Any cross-task considerations or conflicts
`.trim()
}
```

### Context Extraction

```javascript
function extractContextFromPlan(plan, task) {
  // Extract relevant sections from plan
  const sections = []

  // Architecture context
  const archMatch = plan.match(/## Architecture[\s\S]*?(?=##|$)/)
  if (archMatch) {
    sections.push("### Architecture\n" + archMatch[0])
  }

  // Technical stack
  const techMatch = plan.match(/## Technical Stack[\s\S]*?(?=##|$)/)
  if (techMatch) {
    sections.push("### Technical Stack\n" + techMatch[0])
  }

  // Related tasks context
  const taskSection = plan.match(new RegExp(`${task.task_id}[\\s\\S]*?(?=IMPL-\\d+|$)`))
  if (taskSection) {
    sections.push("### Task Context\n" + taskSection[0])
  }

  return sections.join("\n\n") || "No additional context available"
}
```

## Progress Tracking

### Batch Progress Updates

```javascript
function reportBatchProgress(batchIndex, totalBatches, currentTask) {
  if (totalBatches > 1) {
    team_msg({
      to: "coordinator",
      type: "progress_update",
      batch_index: batchIndex + 1,
      total_batches: totalBatches,
      current_task: currentTask.task_id,
      message: `Processing batch ${batchIndex + 1}/${totalBatches}: ${currentTask.task_id}`
    }, "[executor]")
  }
}
```

### Long-Running Task Updates

```javascript
function reportLongRunningTask(task, elapsedSeconds) {
  if (elapsedSeconds > 60 && elapsedSeconds % 30 === 0) {
    team_msg({
      to: "coordinator",
      type: "progress_update",
      task_id: task.task_id,
      elapsed_seconds: elapsedSeconds,
      message: `Still processing ${task.task_id} (${elapsedSeconds}s elapsed)...`
    }, "[executor]")
  }
}
```

## Utility Functions

### Prompt Escaping

```javascript
function escapePrompt(prompt) {
  return prompt
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\$/g, "\\$")
}
```

### File Change Detection

```javascript
function detectModifiedFiles() {
  const gitDiff = Bash("git diff --name-only HEAD")
  return gitDiff.stdout.split("\n").filter(f => f.trim())
}
```

### Simple Task Detection

```javascript
function isSimpleTask(task) {
  const simpleIndicators = [
    task.description.length < 200,
    !task.description.toLowerCase().includes("refactor"),
    !task.description.toLowerCase().includes("architecture"),
    !task.description.toLowerCase().includes("multiple files"),
    !task.description.toLowerCase().includes("complex"),
    task.metadata?.target_files?.length === 1
  ]

  return simpleIndicators.filter(Boolean).length >= 4
}
```

## Error Recovery

### Retry Logic

```javascript
function executeWithRetry(task, executor, maxRetries = 3) {
  let attempt = 0
  let lastError = null

  while (attempt < maxRetries) {
    try {
      const result = executeTask(task, executor)
      if (result.success) {
        return result
      }
      lastError = result.error
    } catch (error) {
      lastError = error.message
    }

    attempt++
    if (attempt < maxRetries) {
      team_msg({
        to: "coordinator",
        type: "progress_update",
        task_id: task.task_id,
        message: `Retry attempt ${attempt}/${maxRetries} after error: ${lastError}`
      }, "[executor]")
    }
  }

  return {
    success: false,
    error: lastError,
    retry_count: maxRetries
  }
}
```

### Backend Fallback

```javascript
function executeWithFallback(task, primaryExecutor) {
  const result = executeTask(task, primaryExecutor)

  if (!result.success && primaryExecutor !== "agent") {
    team_msg({
      to: "coordinator",
      type: "progress_update",
      task_id: task.task_id,
      message: `${primaryExecutor} failed, falling back to agent backend...`
    }, "[executor]")

    return executeTask(task, "agent")
  }

  return result
}
```
