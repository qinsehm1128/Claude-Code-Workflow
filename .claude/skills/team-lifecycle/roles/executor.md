# Role: executor

Code implementation following approved plans. Reads plan files, implements changes, self-validates, and reports completion.

## Role Identity

- **Name**: `executor`
- **Task Prefix**: `IMPL-*`
- **Responsibility**: Load plan → Implement code → Self-validate → Report completion
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
const planPathMatch = task.description.match(/\.workflow\/\.team-plan\/[^\s]+\/plan\.json/)
const planPath = planPathMatch ? planPathMatch[0] : null

if (!planPath) {
  mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "executor", to: "coordinator", type: "error", summary: "plan.json路径无效" })
  SendMessage({ type: "message", recipient: "coordinator", content: `Cannot find plan.json in ${task.subject}`, summary: "Plan path not found" })
  return
}

const plan = JSON.parse(Read(planPath))
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

### Phase 3: Code Implementation

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

const changedFiles = []

for (const batch of batches) {
  if (batch.tasks.length === 1 && isSimpleTask(batch.tasks[0])) {
    // Simple task: direct file editing
    const t = batch.tasks[0]
    for (const f of (t.files || [])) {
      const content = Read(f.path)
      Edit({ file_path: f.path, old_string: "...", new_string: "..." })
      changedFiles.push(f.path)
    }
  } else {
    // Complex task(s): delegate to code-developer sub-agent
    const prompt = batch.tasks.map(buildExecutionPrompt).join('\n\n---\n')

    Task({
      subagent_type: "code-developer",
      run_in_background: false,
      description: batch.tasks.map(t => t.title).join(' | '),
      prompt: `## Goal\n${plan.summary}\n\n## Tasks\n${prompt}\n\n## Context\n### Project Guidelines\n@.workflow/project-guidelines.json\n\nComplete each task according to its "Done when" checklist.`
    })

    batch.tasks.forEach(t => (t.files || []).forEach(f => changedFiles.push(f.path)))
  }

  // Progress update
  mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "executor", to: "coordinator", type: "impl_progress", summary: `Batch完成: ${changedFiles.length}个文件已变更` })
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
```

### Phase 5: Report to Coordinator

```javascript
mcp__ccw-tools__team_msg({
  operation: "log", team: teamName,
  from: "executor", to: "coordinator",
  type: "impl_complete",
  summary: `IMPL完成: ${[...new Set(changedFiles)].length}个文件变更, syntax=${hasSyntaxErrors ? 'errors' : 'clean'}`
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## Implementation Complete

**Task**: ${task.subject}

### Changed Files
${[...new Set(changedFiles)].map(f => '- ' + f).join('\n')}

### Acceptance Criteria
${acceptanceStatus.map(t => '**' + t.title + '**: ' + (t.criteria.every(c => c.met) ? 'All met' : 'Partial')).join('\n')}

### Validation
- Syntax: ${hasSyntaxErrors ? 'Has errors (attempted fix)' : 'Clean'}
- Tests: ${testFiles.length > 0 ? 'Ran' : 'N/A'}

Implementation is ready for testing and review.`,
  summary: `IMPL complete: ${[...new Set(changedFiles)].length} files changed`
})

TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next IMPL task → back to Phase 1
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No IMPL-* tasks available | Idle, wait for coordinator assignment |
| Plan file not found | Notify coordinator, request plan location |
| Syntax errors after implementation | Attempt auto-fix, report remaining errors |
| Sub-agent failure | Retry once, then attempt direct implementation |
| File conflict / merge issue | Notify coordinator, request guidance |
| Test failures in self-validation | Report in completion message, let tester handle |
| Circular dependencies in plan | Execute in plan order, ignore dependency chain |
| Unexpected error | Log error via team_msg, report to coordinator |
