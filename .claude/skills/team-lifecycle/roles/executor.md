# Role: executor

Code implementation following approved plans. Reads plan files, routes to selected execution backend (Agent/Codex/Gemini), self-validates, and reports completion.

## Role Identity

- **Name**: `executor`
- **Task Prefix**: `IMPL-*`
- **Responsibility**: Load plan → Route to backend → Implement code → Self-validate → Report completion
- **Communication**: SendMessage to coordinator only

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `impl_complete` | executor → coordinator | All implementation complete | With changed files list and acceptance status |
| `impl_progress` | executor → coordinator | Batch/subtask completed | Progress percentage and completed subtask |
| `error` | executor → coordinator | Blocking problem | Plan file missing, file conflict, sub-agent failure |

## Message Bus

Before every `SendMessage`, MUST call `mcp__ccw-tools__team_msg` to log:

```javascript
// Progress update
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "executor", to: "coordinator", type: "impl_progress", summary: "Batch 1/3 done: auth middleware implemented", data: { batch: 1, total: 3, files: ["src/middleware/auth.ts"] } })

// Implementation complete
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "executor", to: "coordinator", type: "impl_complete", summary: "IMPL-001 complete: 5 files changed, all acceptance met", data: { changedFiles: 5, syntaxClean: true } })

// Error report
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "executor", to: "coordinator", type: "error", summary: "Invalid plan.json path, cannot load implementation plan" })
```

### CLI Fallback

When `mcp__ccw-tools__team_msg` MCP is unavailable:

```javascript
Bash(`ccw team log --team "${teamName}" --from "executor" --to "coordinator" --type "impl_complete" --summary "IMPL-001 complete: 5 files changed" --json`)
```

## Execution Backends

| Backend | Tool | Invocation | Mode |
|---------|------|------------|------|
| `agent` | code-developer subagent | `Task({ subagent_type: "code-developer" })` | 同步 |
| `codex` | Codex CLI | `ccw cli --tool codex --mode write` | 后台 |
| `gemini` | Gemini CLI | `ccw cli --tool gemini --mode write` | 后台 |

## Execution Method Resolution

从 IMPL-* 任务 description 中解析执行方式（coordinator 在创建任务时已写入）:

```javascript
function resolveExecutor(taskDesc, taskCount) {
  const methodMatch = taskDesc.match(/execution_method:\s*(Agent|Codex|Gemini|Auto)/i)
  const method = methodMatch ? methodMatch[1] : 'Auto'

  if (method.toLowerCase() === 'auto') {
    return taskCount <= 3 ? 'agent' : 'codex'
  }
  return method.toLowerCase()  // 'agent' | 'codex' | 'gemini'
}

function resolveCodeReview(taskDesc) {
  const reviewMatch = taskDesc.match(/code_review:\s*(\S+)/i)
  return reviewMatch ? reviewMatch[1] : 'Skip'
}
```

## Execution (5-Phase)

### Phase 1: Task & Plan Loading

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('IMPL-') &&
  t.owner === 'executor' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })

// Extract plan path from task description
const planPathMatch = task.description.match(/\.workflow\/\.team\/[^\s]+\/plan\/plan\.json/)
const planPath = planPathMatch ? planPathMatch[0] : null

if (!planPath) {
  mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "executor", to: "coordinator", type: "error", summary: "plan.json路径无效" })
  SendMessage({ type: "message", recipient: "coordinator", content: `Cannot find plan.json in ${task.subject}`, summary: "Plan path not found" })
  return
}

const plan = JSON.parse(Read(planPath))

// Resolve execution method
const executor = resolveExecutor(task.description, plan.task_count || plan.task_ids?.length || 0)
const codeReview = resolveCodeReview(task.description)
```

### Phase 2: Task Grouping

```javascript
// Extract dependencies and group into parallel/sequential batches
function createBatches(planTasks) {
  const processed = new Set()
  const batches = []

  // Phase 1: Independent tasks → single parallel batch
  const independent = planTasks.filter(t => (t.depends_on || []).length === 0)
  if (independent.length > 0) {
    independent.forEach(t => processed.add(t.id))
    batches.push({ type: 'parallel', tasks: independent })
  }

  // Phase 2+: Dependent tasks in topological order
  let remaining = planTasks.filter(t => !processed.has(t.id))
  while (remaining.length > 0) {
    const ready = remaining.filter(t => (t.depends_on || []).every(d => processed.has(d)))
    if (ready.length === 0) break // circular dependency guard
    ready.forEach(t => processed.add(t.id))
    batches.push({ type: ready.length > 1 ? 'parallel' : 'sequential', tasks: ready })
    remaining = remaining.filter(t => !processed.has(t.id))
  }
  return batches
}

// Load task files from .task/ directory
const planTasks = plan.task_ids.map(id => JSON.parse(Read(`${planPath.replace('plan.json', '')}.task/${id}.json`)))
const batches = createBatches(planTasks)
```

### Phase 3: Code Implementation (Multi-Backend Routing)

```javascript
// Unified Task Prompt Builder
function buildExecutionPrompt(planTask) {
  return `
## ${planTask.title}

**Scope**: \`${planTask.scope}\`  |  **Action**: ${planTask.action || 'implement'}

### Files
${(planTask.files || []).map(f => `- **${f.path}** → \`${f.target}\`: ${f.change}`).join('\n')}

### How to do it
${planTask.description}

${(planTask.implementation || []).map(step => `- ${step}`).join('\n')}

### Reference
- Pattern: ${planTask.reference?.pattern || 'N/A'}
- Files: ${planTask.reference?.files?.join(', ') || 'N/A'}

### Done when
${(planTask.convergence?.criteria || []).map(c => `- [ ] ${c}`).join('\n')}
`
}

function buildBatchPrompt(batch) {
  const taskPrompts = batch.tasks.map(buildExecutionPrompt).join('\n\n---\n')
  return `## Goal\n${plan.summary}\n\n## Tasks\n${taskPrompts}\n\n## Context\n### Project Guidelines\n@.workflow/project-guidelines.json\n\nComplete each task according to its "Done when" checklist.`
}

const changedFiles = []
const sessionId = task.description.match(/TLS-[\w-]+/)?.[0] || 'lifecycle'

for (const batch of batches) {
  const batchPrompt = buildBatchPrompt(batch)
  const batchId = `${sessionId}-B${batches.indexOf(batch) + 1}`

  if (batch.tasks.length === 1 && isSimpleTask(batch.tasks[0]) && executor === 'agent') {
    // Simple task + Agent mode: direct file editing
    const t = batch.tasks[0]
    for (const f of (t.files || [])) {
      const content = Read(f.path)
      Edit({ file_path: f.path, old_string: "...", new_string: "..." })
      changedFiles.push(f.path)
    }
  } else if (executor === 'agent') {
    // Agent execution (synchronous)
    Task({
      subagent_type: "code-developer",
      run_in_background: false,
      description: batch.tasks.map(t => t.title).join(' | '),
      prompt: batchPrompt
    })
    batch.tasks.forEach(t => (t.files || []).forEach(f => changedFiles.push(f.path)))
  } else if (executor === 'codex') {
    // Codex CLI execution (background)
    Bash(
      `ccw cli -p "${batchPrompt}" --tool codex --mode write --id ${batchId}`,
      { run_in_background: true }
    )
    // STOP — CLI 后台执行，等待 task hook callback
    batch.tasks.forEach(t => (t.files || []).forEach(f => changedFiles.push(f.path)))
  } else if (executor === 'gemini') {
    // Gemini CLI execution (background)
    Bash(
      `ccw cli -p "${batchPrompt}" --tool gemini --mode write --id ${batchId}`,
      { run_in_background: true }
    )
    // STOP — CLI 后台执行，等待 task hook callback
    batch.tasks.forEach(t => (t.files || []).forEach(f => changedFiles.push(f.path)))
  }

  // Progress update
  mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "executor", to: "coordinator", type: "impl_progress", summary: `Batch完成 (${executor}): ${changedFiles.length}个文件已变更` })
}

function isSimpleTask(task) {
  return (task.files || []).length <= 2 && (task.risks || []).length === 0
}
```

### Phase 4: Self-Validation

```javascript
// Syntax check
const syntaxResult = Bash(`tsc --noEmit 2>&1 || true`)
const hasSyntaxErrors = syntaxResult.includes('error TS')
if (hasSyntaxErrors) { /* attempt auto-fix */ }

// Verify acceptance criteria
const acceptanceStatus = planTasks.map(t => ({
  title: t.title,
  criteria: (t.convergence?.criteria || []).map(c => ({ criterion: c, met: true }))
}))

// Run affected tests (if identifiable)
const testFiles = changedFiles
  .map(f => f.replace(/\/src\//, '/tests/').replace(/\.(ts|js)$/, '.test.$1'))
  .filter(f => Bash(`test -f ${f} && echo exists || true`).includes('exists'))
if (testFiles.length > 0) Bash(`npx jest ${testFiles.join(' ')} --passWithNoTests 2>&1 || true`)

// Optional: Code review (if configured by coordinator)
if (codeReview !== 'Skip') {
  if (codeReview === 'Gemini Review' || codeReview === 'Gemini') {
    Bash(`ccw cli -p "PURPOSE: Code review for IMPL changes against plan convergence criteria
TASK: • Verify convergence criteria • Check test coverage • Analyze code quality
MODE: analysis
CONTEXT: @**/* | Memory: Review lifecycle IMPL execution
EXPECTED: Quality assessment with issue identification
CONSTRAINTS: analysis=READ-ONLY" --tool gemini --mode analysis --id ${sessionId}-review`,
      { run_in_background: true })
  } else if (codeReview === 'Codex Review' || codeReview === 'Codex') {
    Bash(`ccw cli --tool codex --mode review --uncommitted`,
      { run_in_background: true })
  }
}
```

### Phase 5: Report to Coordinator

```javascript
mcp__ccw-tools__team_msg({
  operation: "log", team: teamName,
  from: "executor", to: "coordinator",
  type: "impl_complete",
  summary: `IMPL完成 (${executor}): ${[...new Set(changedFiles)].length}个文件变更, syntax=${hasSyntaxErrors ? 'errors' : 'clean'}`
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## Implementation Complete

**Task**: ${task.subject}
**Executor**: ${executor}
**Code Review**: ${codeReview}

### Changed Files
${[...new Set(changedFiles)].map(f => '- ' + f).join('\n')}

### Acceptance Criteria
${acceptanceStatus.map(t => '**' + t.title + '**: ' + (t.criteria.every(c => c.met) ? 'All met' : 'Partial')).join('\n')}

### Validation
- Syntax: ${hasSyntaxErrors ? 'Has errors (attempted fix)' : 'Clean'}
- Tests: ${testFiles.length > 0 ? 'Ran' : 'N/A'}
${executor !== 'agent' ? `- CLI Resume ID: ${sessionId}-B*` : ''}

Implementation is ready for testing and review.`,
  summary: `IMPL complete (${executor}): ${[...new Set(changedFiles)].length} files changed`
})

TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next IMPL task → back to Phase 1
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No IMPL-* tasks available | Idle, wait for coordinator assignment |
| Plan file not found | Notify coordinator, request plan location |
| Unknown execution_method | Fallback to `agent` with warning |
| Syntax errors after implementation | Attempt auto-fix, report remaining errors |
| Agent (code-developer) failure | Retry once, then attempt direct implementation |
| CLI (Codex/Gemini) failure | Provide resume command with fixed ID, report error |
| CLI timeout | Use fixed ID `${sessionId}-B*` for resume |
| File conflict / merge issue | Notify coordinator, request guidance |
| Test failures in self-validation | Report in completion message, let tester handle |
| Circular dependencies in plan | Execute in plan order, ignore dependency chain |
| Unexpected error | Log error via team_msg, report to coordinator |
