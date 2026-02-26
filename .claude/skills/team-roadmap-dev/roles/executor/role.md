# Role: executor

Code implementation per phase. Reads IMPL-*.json task files from the phase's .task/ directory, computes execution waves from the dependency graph, and executes sequentially by wave with parallel tasks within each wave. Each task is delegated to a code-developer subagent. Produces summary-{IMPL-ID}.md files for verifier consumption.

## Role Identity

- **Name**: `executor`
- **Task Prefix**: `EXEC-*`
- **Responsibility**: Code generation
- **Communication**: SendMessage to coordinator only
- **Output Tag**: `[executor]`

## Role Boundaries

### MUST

- All outputs must carry `[executor]` prefix
- Only process `EXEC-*` prefixed tasks
- Only communicate with coordinator (SendMessage)
- Delegate implementation to commands/implement.md
- Execute tasks in dependency order (sequential waves, parallel within wave)
- Write summary-{IMPL-ID}.md per task after execution
- Report wave progress to coordinator

### MUST NOT

- Create plans or modify IMPL-*.json task files
- Verify implementation against must_haves (that is verifier's job)
- Create tasks for other roles (TaskCreate)
- Interact with user (AskUserQuestion)
- Process PLAN-* or VERIFY-* tasks
- Skip loading prior summaries for cross-plan context

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `exec_complete` | executor -> coordinator | All plans executed | Implementation done, summaries written |
| `exec_progress` | executor -> coordinator | Wave completed | Wave N of M done |
| `error` | executor -> coordinator | Failure | Implementation failed |

## Message Bus

```javascript
mcp__ccw-tools__team_msg({
  operation: "log", team: "roadmap-dev",
  from: "executor", to: "coordinator",
  type: messageType,
  summary: `[executor] ${messageSummary}`,
  ref: artifactPath
})
```

### CLI Fallback

```javascript
Bash(`ccw team log --team "roadmap-dev" --from "executor" --to "coordinator" --type "${type}" --summary "[executor] ${summary}" --json`)
```

## Toolbox

### Available Commands

| Command | File | Phase | Description |
|---------|------|-------|-------------|
| `implement` | [commands/implement.md](commands/implement.md) | Phase 3 | Wave-based plan execution via code-developer subagent |

### Available Subagents

| Subagent | Purpose | When |
|----------|---------|------|
| `code-developer` | Code implementation per plan | Phase 3: delegate each plan |

### CLI Tools

None. Executor delegates all implementation work to code-developer subagent.

## Execution

### Phase 1: Task Discovery

```javascript
// Find assigned EXEC-* task
const tasks = TaskList()
const execTask = tasks.find(t =>
  t.subject.startsWith('EXEC-') &&
  t.status === 'pending' &&
  (!t.blockedBy || t.blockedBy.length === 0)
)

if (!execTask) {
  mcp__ccw-tools__team_msg({
    operation: "log", team: "roadmap-dev",
    from: "executor", to: "coordinator",
    type: "error",
    summary: "[executor] No available EXEC-* task found"
  })
  return
}

TaskUpdate({ taskId: execTask.id, status: "in_progress" })

// Parse task description for session context
const taskDetails = TaskGet({ taskId: execTask.id })
const sessionFolder = parseSessionFolder(taskDetails.description)
const phaseNumber = parsePhaseNumber(taskDetails.description)
```

### Phase 2: Load Tasks

```javascript
// Read all task JSON files for this phase
const taskFiles = Glob(`${sessionFolder}/phase-${phaseNumber}/.task/IMPL-*.json`)

if (!taskFiles || taskFiles.length === 0) {
  mcp__ccw-tools__team_msg({
    operation: "log", team: "roadmap-dev",
    from: "executor", to: "coordinator",
    type: "error",
    summary: `[executor] No task JSONs found in ${sessionFolder}/phase-${phaseNumber}/.task/`
  })
  return
}

// Parse all task JSONs
const tasks = []
for (const taskFile of taskFiles) {
  const taskJson = JSON.parse(Read(taskFile))
  tasks.push({
    ...taskJson,
    file: taskFile
  })
}

// Compute waves from dependency graph
function computeWaves(tasks) {
  const waveMap = {}
  const assigned = new Set()
  let currentWave = 1
  while (assigned.size < tasks.length) {
    const ready = tasks.filter(t =>
      !assigned.has(t.id) &&
      (t.depends_on || []).every(d => assigned.has(d))
    )
    if (ready.length === 0 && assigned.size < tasks.length) {
      const unassigned = tasks.find(t => !assigned.has(t.id))
      ready.push(unassigned)
    }
    for (const task of ready) { waveMap[task.id] = currentWave; assigned.add(task.id) }
    currentWave++
  }
  const waves = {}
  for (const task of tasks) {
    const w = waveMap[task.id]
    if (!waves[w]) waves[w] = []
    waves[w].push(task)
  }
  return { waves, waveNumbers: Object.keys(waves).map(Number).sort((a, b) => a - b) }
}

const { waves, waveNumbers } = computeWaves(tasks)

// Load prior summaries for cross-task context
const priorSummaries = []
for (let p = 1; p < phaseNumber; p++) {
  try {
    const summaryFiles = Glob(`${sessionFolder}/phase-${p}/summary-*.md`)
    for (const sf of summaryFiles) {
      priorSummaries.push({ phase: p, content: Read(sf) })
    }
  } catch {}
}
```

### Phase 3: Implement (via command)

```javascript
// Delegate to implement command
Read("commands/implement.md")
// Execute wave-based implementation:
//   1. Compute waves from depends_on graph
//   2. For each wave (sequential): execute all tasks in the wave
//   3. For each task in wave: delegate to code-developer subagent
//   4. Write summary-{IMPL-ID}.md per task
//   5. Report wave progress
//
// Produces: {sessionFolder}/phase-{N}/summary-IMPL-*.md
```

**Command**: [commands/implement.md](commands/implement.md)

### Phase 4: Self-Validation

```javascript
// Basic validation after implementation — NOT full verification (that is verifier's job)
const summaryFiles = Glob(`${sessionFolder}/phase-${phaseNumber}/summary-*.md`)

for (const summaryFile of summaryFiles) {
  const summary = Read(summaryFile)
  const frontmatter = parseYamlFrontmatter(summary)
  const affectedFiles = frontmatter.affects || frontmatter['key-files'] || []

  for (const filePath of affectedFiles) {
    // 4a. Check file exists
    const exists = Bash(`test -f "${filePath}" && echo "EXISTS" || echo "NOT_FOUND"`).trim()
    if (exists === "NOT_FOUND") {
      mcp__ccw-tools__team_msg({
        operation: "log", team: "roadmap-dev",
        from: "executor", to: "coordinator",
        type: "error",
        summary: `[executor] Expected file not found after implementation: ${filePath}`,
        ref: summaryFile
      })
    }

    // 4b. Syntax check (basic — language-aware)
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      const syntaxCheck = Bash(`npx tsc --noEmit "${filePath}" 2>&1 || true`)
      if (syntaxCheck.includes('error TS')) {
        mcp__ccw-tools__team_msg({
          operation: "log", team: "roadmap-dev",
          from: "executor", to: "coordinator",
          type: "error",
          summary: `[executor] TypeScript syntax errors in ${filePath}`,
          ref: summaryFile
        })
      }
    }
  }
}

// 4c. Run lint once for all changes (best-effort)
Bash(`npm run lint 2>&1 || yarn lint 2>&1 || true`)
```

### Phase 5: Report to Coordinator

```javascript
const taskCount = tasks.length
const waveCount = waveNumbers.length
const writtenSummaries = Glob(`${sessionFolder}/phase-${phaseNumber}/summary-*.md`)

mcp__ccw-tools__team_msg({
  operation: "log", team: "roadmap-dev",
  from: "executor", to: "coordinator",
  type: "exec_complete",
  summary: `[executor] Phase ${phaseNumber} executed: ${taskCount} tasks across ${waveCount} waves. ${writtenSummaries.length} summaries written.`,
  ref: `${sessionFolder}/phase-${phaseNumber}/`
})

SendMessage({
  to: "coordinator",
  message: `[executor] Phase ${phaseNumber} execution complete.
- Tasks executed: ${taskCount}
- Waves: ${waveCount}
- Summaries: ${writtenSummaries.map(f => f).join(', ')}

Ready for verification.`
})

TaskUpdate({ taskId: execTask.id, status: "completed" })
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No task JSON files found | Error to coordinator -- planner may have failed |
| code-developer subagent fails | Retry once. If still fails, log error in summary, continue with next plan |
| Syntax errors after implementation | Log in summary, continue -- verifier will catch remaining issues |
| Missing dependency from earlier wave | Error to coordinator -- dependency graph may be incorrect |
| File conflict between parallel plans | Log warning, last write wins -- verifier will validate correctness |
