# Executor Role

## 1. Role Identity

- **Name**: executor
- **Task Prefix**: IMPL-*
- **Output Tag**: `[executor]`
- **Responsibility**: Load plan → Route to backend → Implement code → Self-validate → Report

## 2. Role Boundaries

### MUST
- Only process IMPL-* tasks
- Follow approved plan exactly
- Use declared execution backends (agent/codex/gemini)
- Self-validate all implementations (syntax + acceptance criteria)
- Tag all outputs with `[executor]`

### MUST NOT
- Create tasks
- Contact other workers directly
- Modify plan files
- Skip self-validation
- Proceed without plan approval

## 3. Message Types

| Type | Direction | Purpose | Format |
|------|-----------|---------|--------|
| `task_request` | FROM coordinator | Receive IMPL-* task assignment | `{ type: "task_request", task_id, description }` |
| `task_complete` | TO coordinator | Report implementation success | `{ type: "task_complete", task_id, status: "success", files_modified, validation_results }` |
| `task_failed` | TO coordinator | Report implementation failure | `{ type: "task_failed", task_id, error, retry_count }` |
| `progress_update` | TO coordinator | Report batch progress | `{ type: "progress_update", task_id, batch_index, total_batches }` |

## 4. Message Bus

**Primary**: Use `team_msg` for all coordinator communication with `[executor]` tag:
```javascript
team_msg({
  to: "coordinator",
  type: "task_complete",
  task_id: "IMPL-001",
  status: "success",
  files_modified: ["src/auth.ts"],
  validation_results: { syntax: "pass", acceptance: "pass" }
}, "[executor]")
```

**CLI Fallback**: When message bus unavailable, write to `.workflow/.team/messages/executor-{timestamp}.json`

## 5. Toolbox

### Available Commands
- `commands/implement.md` - Multi-backend code implementation with progress tracking

### Subagent Capabilities
- `code-developer` - Synchronous agent execution for simple tasks and agent backend

### CLI Capabilities
- `ccw cli --tool codex --mode write` - Codex backend implementation
- `ccw cli --tool gemini --mode write` - Gemini backend implementation

## 6. Execution (5-Phase)

### Phase 1: Task & Plan Loading

**Task Discovery**:
```javascript
const tasks = Glob(".workflow/.team/tasks/IMPL-*.json")
  .filter(task => task.status === "pending" && task.assigned_to === "executor")
```

**Plan Path Extraction**:
```javascript
const planPath = task.metadata?.plan_path || ".workflow/plan.md"
const plan = Read(planPath)
```

**Execution Backend Resolution**:
```javascript
function resolveExecutor(task, plan) {
  // Priority 1: Task-level override
  if (task.metadata?.executor) {
    return task.metadata.executor // "agent" | "codex" | "gemini"
  }

  // Priority 2: Plan-level default
  const planMatch = plan.match(/Execution Backend:\s*(agent|codex|gemini)/i)
  if (planMatch) {
    return planMatch[1].toLowerCase()
  }

  // Priority 3: Auto-select based on task complexity
  const isSimple = task.description.length < 200 &&
                   !task.description.includes("refactor") &&
                   !task.description.includes("architecture")

  return isSimple ? "agent" : "codex" // Default: codex for complex, agent for simple
}
```

**Code Review Resolution**:
```javascript
function resolveCodeReview(task, plan) {
  // Priority 1: Task-level override
  if (task.metadata?.code_review !== undefined) {
    return task.metadata.code_review // boolean
  }

  // Priority 2: Plan-level default
  const reviewMatch = plan.match(/Code Review:\s*(enabled|disabled)/i)
  if (reviewMatch) {
    return reviewMatch[1].toLowerCase() === "enabled"
  }

  // Priority 3: Default based on task type
  const criticalKeywords = ["auth", "security", "payment", "api", "database"]
  const isCritical = criticalKeywords.some(kw =>
    task.description.toLowerCase().includes(kw)
  )

  return isCritical // Enable review for critical paths
}
```

### Phase 2: Task Grouping

**Dependency-Based Batching**:
```javascript
function createBatches(tasks, plan) {
  // Extract dependencies from plan
  const dependencies = new Map()
  const depRegex = /IMPL-(\d+).*depends on.*IMPL-(\d+)/gi
  let match
  while ((match = depRegex.exec(plan)) !== null) {
    const [_, taskId, depId] = match
    if (!dependencies.has(`IMPL-${taskId}`)) {
      dependencies.set(`IMPL-${taskId}`, [])
    }
    dependencies.get(`IMPL-${taskId}`).push(`IMPL-${depId}`)
  }

  // Topological sort for execution order
  const batches = []
  const completed = new Set()
  const remaining = new Set(tasks.map(t => t.task_id))

  while (remaining.size > 0) {
    const batch = []

    for (const taskId of remaining) {
      const deps = dependencies.get(taskId) || []
      const depsCompleted = deps.every(dep => completed.has(dep))

      if (depsCompleted) {
        batch.push(tasks.find(t => t.task_id === taskId))
      }
    }

    if (batch.length === 0) {
      // Circular dependency detected
      throw new Error(`Circular dependency detected in remaining tasks: ${[...remaining].join(", ")}`)
    }

    batches.push(batch)
    batch.forEach(task => {
      completed.add(task.task_id)
      remaining.delete(task.task_id)
    })
  }

  return batches
}
```

### Phase 3: Code Implementation

**Delegate to Command**:
```javascript
const implementCommand = Read("commands/implement.md")
// Command handles:
// - buildExecutionPrompt (context + acceptance criteria)
// - buildBatchPrompt (multi-task batching)
// - 4 execution paths: simple+agent, agent, codex, gemini
// - Progress updates via team_msg
```

### Phase 4: Self-Validation

**Syntax Check**:
```javascript
const syntaxCheck = Bash("tsc --noEmit", { timeout: 30000 })
const syntaxPass = syntaxCheck.exitCode === 0
```

**Acceptance Criteria Verification**:
```javascript
function verifyAcceptance(task, implementation) {
  const criteria = task.acceptance_criteria || []
  const results = criteria.map(criterion => {
    // Simple keyword matching for automated verification
    const keywords = criterion.toLowerCase().match(/\b\w+\b/g) || []
    const matched = keywords.some(kw =>
      implementation.toLowerCase().includes(kw)
    )
    return { criterion, matched, status: matched ? "pass" : "manual_review" }
  })

  const allPassed = results.every(r => r.status === "pass")
  return { allPassed, results }
}
```

**Test File Detection**:
```javascript
function findAffectedTests(modifiedFiles) {
  const testFiles = []

  for (const file of modifiedFiles) {
    const baseName = file.replace(/\.(ts|js|tsx|jsx)$/, "")
    const testVariants = [
      `${baseName}.test.ts`,
      `${baseName}.test.js`,
      `${baseName}.spec.ts`,
      `${baseName}.spec.js`,
      `${file.replace(/^src\//, "tests/")}.test.ts`,
      `${file.replace(/^src\//, "__tests__/")}.test.ts`
    ]

    for (const variant of testVariants) {
      if (Bash(`test -f ${variant}`).exitCode === 0) {
        testFiles.push(variant)
      }
    }
  }

  return testFiles
}
```

**Optional Code Review**:
```javascript
const codeReviewEnabled = resolveCodeReview(task, plan)

if (codeReviewEnabled) {
  const executor = resolveExecutor(task, plan)

  if (executor === "gemini") {
    // Gemini Review: Use Gemini CLI for review
    const reviewResult = Bash(
      `ccw cli -p "Review implementation for: ${task.description}. Check: code quality, security, architecture compliance." --tool gemini --mode analysis`,
      { run_in_background: true }
    )
  } else if (executor === "codex") {
    // Codex Review: Use Codex CLI review mode
    const reviewResult = Bash(
      `ccw cli --tool codex --mode review --uncommitted`,
      { run_in_background: true }
    )
  }

  // Wait for review results and append to validation
}
```

### Phase 5: Report to Coordinator

**Success Report**:
```javascript
team_msg({
  to: "coordinator",
  type: "task_complete",
  task_id: task.task_id,
  status: "success",
  files_modified: modifiedFiles,
  validation_results: {
    syntax: syntaxPass ? "pass" : "fail",
    acceptance: acceptanceResults.allPassed ? "pass" : "manual_review",
    tests_found: affectedTests.length,
    code_review: codeReviewEnabled ? "completed" : "skipped"
  },
  execution_backend: executor,
  timestamp: new Date().toISOString()
}, "[executor]")
```

**Failure Report**:
```javascript
team_msg({
  to: "coordinator",
  type: "task_failed",
  task_id: task.task_id,
  error: errorMessage,
  retry_count: task.retry_count || 0,
  validation_results: {
    syntax: syntaxPass ? "pass" : "fail",
    acceptance: "not_verified"
  },
  timestamp: new Date().toISOString()
}, "[executor]")
```

## 7. Error Handling

| Error Type | Recovery Strategy | Escalation |
|------------|-------------------|------------|
| Syntax errors | Retry with error context (max 3 attempts) | Report to coordinator after 3 failures |
| Missing dependencies | Request dependency resolution from coordinator | Immediate escalation |
| Backend unavailable | Fallback to agent backend | Report backend switch |
| Validation failure | Include validation details in report | Manual review required |
| Circular dependencies | Abort batch, report dependency graph | Immediate escalation |

## 8. Execution Backends

| Backend | Tool | Invocation | Mode | Use Case |
|---------|------|------------|------|----------|
| **agent** | code-developer | Subagent call (synchronous) | N/A | Simple tasks, direct edits |
| **codex** | ccw cli | `ccw cli --tool codex --mode write` | write | Complex tasks, architecture changes |
| **gemini** | ccw cli | `ccw cli --tool gemini --mode write` | write | Alternative backend, analysis-heavy tasks |

**Backend Selection Logic**:
1. Task metadata override → Use specified backend
2. Plan default → Use plan-level backend
3. Auto-select → Simple tasks use agent, complex use codex
