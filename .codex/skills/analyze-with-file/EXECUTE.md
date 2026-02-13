# Analyze Quick Execute

> **Trigger**: User selects "Quick Execute" after Phase 4 completion
> **Prerequisites**: `conclusions.json` + `explorations.json`/`perspectives.json` already exist
> **Core Principle**: No additional exploration — analysis phase has already gathered sufficient context. No CLI delegation — execute tasks directly inline.

## Execution Flow

```
conclusions.json → .task/*.json → User Confirmation → Direct Inline Execution → execution.md + execution-events.md
```

---

## Step 1: Generate .task/*.json

Convert `conclusions.json` recommendations directly into individual task JSON files. Each file is a self-contained task with convergence criteria, compatible with `unified-execute-with-file`.

**Schema**: `cat ~/.ccw/workflows/cli-templates/schemas/task-schema.json`

**Conversion Logic**:

```javascript
const conclusions = JSON.parse(Read(`${sessionFolder}/conclusions.json`))
const explorations = file_exists(`${sessionFolder}/explorations.json`)
  ? JSON.parse(Read(`${sessionFolder}/explorations.json`))
  : file_exists(`${sessionFolder}/perspectives.json`)
    ? JSON.parse(Read(`${sessionFolder}/perspectives.json`))
    : null

const tasks = conclusions.recommendations.map((rec, index) => ({
  id: `TASK-${String(index + 1).padStart(3, '0')}`,
  title: rec.action,
  description: rec.rationale,
  type: inferTaskType(rec),  // fix | refactor | feature | enhancement | testing
  priority: rec.priority,    // high | medium | low
  effort: inferEffort(rec),  // small | medium | large
  files: extractFilesFromEvidence(rec, explorations).map(f => ({
    path: f,
    action: 'modify'        // modify | create | delete
  })),
  depends_on: [],            // Serial by default; add dependencies if task ordering matters
  convergence: {
    criteria: generateCriteria(rec),       // Testable conditions
    verification: generateVerification(rec), // Executable command or steps
    definition_of_done: generateDoD(rec)    // Business language
  },
  evidence: rec.evidence || [],
  source: {
    tool: 'analyze-with-file',
    session_id: sessionId,
    original_id: `TASK-${String(index + 1).padStart(3, '0')}`
  }
}))

// Write each task as individual JSON file
Bash(`mkdir -p ${sessionFolder}/.task`)
tasks.forEach(task => {
  Write(`${sessionFolder}/.task/${task.id}.json`, JSON.stringify(task, null, 2))
})
```

**Task Type Inference**:

| Recommendation Pattern | Inferred Type |
|------------------------|---------------|
| "fix", "resolve", "repair" | `fix` |
| "refactor", "restructure", "extract" | `refactor` |
| "add", "implement", "create" | `feature` |
| "improve", "optimize", "enhance" | `enhancement` |
| "test", "coverage", "validate" | `testing` |

**File Extraction Logic**:
- Parse evidence from `explorations.json` or `perspectives.json`
- Match recommendation action keywords to `relevant_files`
- If no specific files found, use pattern matching from findings
- Return file paths as strings (converted to `{path, action}` objects in the task)

**Effort Inference**:

| Signal | Effort |
|--------|--------|
| Priority high + multiple files | `large` |
| Priority medium or 1-2 files | `medium` |
| Priority low or single file | `small` |

**Convergence Generation**:

Each task's `convergence` must satisfy quality standards (same as req-plan-with-file):

| Field | Requirement | Bad Example | Good Example |
|-------|-------------|-------------|--------------|
| `criteria[]` | **Testable** — assertions or manual steps | `"Code works"` | `"Function returns correct result for edge cases [], null, undefined"` |
| `verification` | **Executable** — command or explicit steps | `"Check it"` | `"jest --testPathPattern=auth.test.ts && npx tsc --noEmit"` |
| `definition_of_done` | **Business language** | `"No errors"` | `"Authentication flow handles all user-facing error scenarios gracefully"` |

```javascript
// Quality validation before writing
const vaguePatterns = /正常|正确|好|可以|没问题|works|fine|good|correct/i
tasks.forEach(task => {
  task.convergence.criteria.forEach((criterion, i) => {
    if (vaguePatterns.test(criterion) && criterion.length < 15) {
      // Auto-fix: replace with specific condition from rec.evidence
    }
  })
  const technicalPatterns = /compile|build|lint|npm|npx|jest|tsc|eslint/i
  if (technicalPatterns.test(task.convergence.definition_of_done)) {
    // Auto-fix: rewrite in business language
  }
})
```

**Output**: `${sessionFolder}/.task/TASK-*.json`

**Task JSON Schema** (one file per task, e.g. `.task/TASK-001.json`):

```json
{
  "id": "TASK-001",
  "title": "Fix authentication token refresh",
  "description": "Token refresh fails silently when...",
  "type": "fix",
  "priority": "high",
  "effort": "large",
  "files": [
    { "path": "src/auth/token.ts", "action": "modify" },
    { "path": "src/middleware/auth.ts", "action": "modify" }
  ],
  "depends_on": [],
  "convergence": {
    "criteria": [
      "Token refresh returns new valid token",
      "Expired token triggers refresh automatically",
      "Failed refresh redirects to login"
    ],
    "verification": "jest --testPathPattern=token.test.ts",
    "definition_of_done": "Users remain logged in across token expiration without manual re-login"
  },
  "evidence": [],
  "source": {
    "tool": "analyze-with-file",
    "session_id": "ANL-xxx",
    "original_id": "TASK-001"
  }
}
```

---

## Step 2: Pre-Execution Analysis

Validate feasibility before starting execution. Reference: unified-execute-with-file Phase 2.

##### Step 2.1: Build Execution Order

```javascript
const taskFiles = Glob(`${sessionFolder}/.task/*.json`)
const tasks = taskFiles.map(f => JSON.parse(Read(f)))

// 1. Dependency validation
const taskIds = new Set(tasks.map(t => t.id))
const errors = []
tasks.forEach(task => {
  task.depends_on.forEach(dep => {
    if (!taskIds.has(dep)) errors.push(`${task.id}: depends on unknown task ${dep}`)
  })
})

// 2. Circular dependency detection
function detectCycles(tasks) {
  const graph = new Map(tasks.map(t => [t.id, t.depends_on]))
  const visited = new Set(), inStack = new Set(), cycles = []
  function dfs(node, path) {
    if (inStack.has(node)) { cycles.push([...path, node].join(' → ')); return }
    if (visited.has(node)) return
    visited.add(node); inStack.add(node)
    ;(graph.get(node) || []).forEach(dep => dfs(dep, [...path, node]))
    inStack.delete(node)
  }
  tasks.forEach(t => { if (!visited.has(t.id)) dfs(t.id, []) })
  return cycles
}
const cycles = detectCycles(tasks)
if (cycles.length) errors.push(`Circular dependencies: ${cycles.join('; ')}`)

// 3. Topological sort for execution order
function topoSort(tasks) {
  const inDegree = new Map(tasks.map(t => [t.id, 0]))
  tasks.forEach(t => t.depends_on.forEach(dep => {
    inDegree.set(dep, (inDegree.get(dep) || 0))  // ensure dep exists
    inDegree.set(t.id, inDegree.get(t.id) + 1)
  }))
  const queue = tasks.filter(t => inDegree.get(t.id) === 0).map(t => t.id)
  const order = []
  while (queue.length) {
    const id = queue.shift()
    order.push(id)
    tasks.forEach(t => {
      if (t.depends_on.includes(id)) {
        inDegree.set(t.id, inDegree.get(t.id) - 1)
        if (inDegree.get(t.id) === 0) queue.push(t.id)
      }
    })
  }
  return order
}
const executionOrder = topoSort(tasks)
```

##### Step 2.2: Analyze File Conflicts

```javascript
// Check files modified by multiple tasks
const fileTaskMap = new Map()  // file → [taskIds]
tasks.forEach(task => {
  (task.files || []).forEach(f => {
    if (!fileTaskMap.has(f.path)) fileTaskMap.set(f.path, [])
    fileTaskMap.get(f.path).push(task.id)
  })
})

const conflicts = []
fileTaskMap.forEach((taskIds, file) => {
  if (taskIds.length > 1) {
    conflicts.push({ file, tasks: taskIds, resolution: "Execute in dependency order" })
  }
})

// Check file existence
const missingFiles = []
tasks.forEach(task => {
  (task.files || []).forEach(f => {
    if (f.action !== 'create' && !file_exists(f.path)) {
      missingFiles.push({ file: f.path, task: task.id, action: "Will be created" })
    }
  })
})
```

---

## Step 3: Initialize Execution Artifacts

Create `execution.md` and `execution-events.md` before starting.

##### Step 3.1: Generate execution.md

```javascript
const executionMd = `# Execution Overview

## Session Info
- **Session ID**: ${sessionId}
- **Plan Source**: .task/*.json (from analysis conclusions)
- **Started**: ${getUtc8ISOString()}
- **Total Tasks**: ${tasks.length}
- **Execution Mode**: Direct inline (serial)

## Source Analysis
- **Conclusions**: ${sessionFolder}/conclusions.json
- **Explorations**: ${explorations ? 'Available' : 'N/A'}
- **Key Conclusions**: ${conclusions.key_conclusions.length} items

## Task Overview

| # | ID | Title | Type | Priority | Dependencies | Status |
|---|-----|-------|------|----------|--------------|--------|
${tasks.map((t, i) => `| ${i+1} | ${t.id} | ${t.title} | ${t.type} | ${t.priority} | ${t.depends_on.join(', ') || '-'} | pending |`).join('\n')}

## Pre-Execution Analysis

### File Conflicts
${conflicts.length
  ? conflicts.map(c => `- **${c.file}**: modified by ${c.tasks.join(', ')} → ${c.resolution}`).join('\n')
  : 'No file conflicts detected'}

### Missing Files
${missingFiles.length
  ? missingFiles.map(f => `- **${f.file}** (${f.task}): ${f.action}`).join('\n')
  : 'All target files exist'}

### Dependency Validation
${errors.length ? errors.map(e => `- ⚠ ${e}`).join('\n') : 'No dependency issues'}

### Execution Order
${executionOrder.map((id, i) => `${i+1}. ${id}`).join('\n')}

## Execution Timeline
> Updated as tasks complete

## Execution Summary
> Updated after all tasks complete
`
Write(`${sessionFolder}/execution.md`, executionMd)
```

##### Step 3.2: Initialize execution-events.md

```javascript
const eventsHeader = `# Execution Events

**Session**: ${sessionId}
**Started**: ${getUtc8ISOString()}
**Source**: .task/*.json

---

`
Write(`${sessionFolder}/execution-events.md`, eventsHeader)
```

---

## Step 4: User Confirmation

Present generated plan for user approval before execution.

**Confirmation Display**:
- Total tasks to execute
- Task list with IDs, titles, types, priorities
- Files to be modified
- File conflicts and dependency warnings (if any)
- Execution order

```javascript
if (!autoYes) {
  const confirmation = AskUserQuestion({
    questions: [{
      question: `Execute ${tasks.length} tasks directly?\n\nTasks:\n${tasks.map(t =>
        `  ${t.id}: ${t.title} (${t.priority})`).join('\n')}\n\nExecution: Direct inline, serial`,
      header: "Confirm",
      multiSelect: false,
      options: [
        { label: "Start Execution", description: "Execute all tasks serially" },
        { label: "Adjust Tasks", description: "Modify, reorder, or remove tasks" },
        { label: "Cancel", description: "Cancel execution, keep .task/" }
      ]
    }]
  })
  // "Adjust Tasks": display task list, user deselects/reorders, regenerate .task/*.json
  // "Cancel": end workflow, keep artifacts
}
```

---

## Step 5: Direct Inline Execution

Execute tasks one by one directly using tools (Read, Edit, Write, Grep, Glob, Bash). **No CLI delegation** — main process handles all modifications.

### Execution Loop

```
For each taskId in executionOrder:
  ├─ Load task from .task/{taskId}.json
  ├─ Check dependencies satisfied (all deps completed)
  ├─ Record START event to execution-events.md
  ├─ Execute task directly:
  │   ├─ Read target files
  │   ├─ Analyze what changes are needed (using task.description + task.context)
  │   ├─ Apply modifications (Edit/Write)
  │   ├─ Verify convergence criteria
  │   └─ Capture files_modified list
  ├─ Record COMPLETE/FAIL event to execution-events.md
  ├─ Update execution.md task status
  ├─ Auto-commit if enabled
  └─ Continue to next task (or pause on failure)
```

##### Step 5.1: Task Execution

For each task, execute directly using the AI's own tools:

```javascript
for (const taskId of executionOrder) {
  const task = tasks.find(t => t.id === taskId)
  const startTime = getUtc8ISOString()

  // 1. Check dependencies
  const unmetDeps = task.depends_on.filter(dep => !completedTasks.has(dep))
  if (unmetDeps.length) {
    recordEvent(task, 'BLOCKED', `Unmet dependencies: ${unmetDeps.join(', ')}`)
    continue
  }

  // 2. Record START event
  appendToEvents(`## ${getUtc8ISOString()} — ${task.id}: ${task.title}

**Type**: ${task.type} | **Priority**: ${task.priority}
**Status**: ⏳ IN PROGRESS
**Files**: ${(task.files || []).map(f => f.path).join(', ')}
**Description**: ${task.description}

### Execution Log
`)

  // 3. Execute task directly
  //    - Read each file in task.files (if specified)
  //    - Analyze what changes satisfy task.description + task.convergence.criteria
  //    - If task.files has detailed changes, use them as guidance
  //    - Apply changes using Edit (preferred) or Write (for new files)
  //    - Use Grep/Glob for discovery if needed
  //    - Use Bash for build/test verification commands

  // 4. Verify convergence
  //    - Run task.convergence.verification (if it's a command)
  //    - Check each criterion in task.convergence.criteria
  //    - Record verification results

  const endTime = getUtc8ISOString()
  const filesModified = getModifiedFiles()  // from git status or execution tracking

  // 5. Record completion event
  appendToEvents(`
**Status**: ✅ COMPLETED
**Duration**: ${calculateDuration(startTime, endTime)}
**Files Modified**: ${filesModified.join(', ')}

#### Changes Summary
${changeSummary}

#### Convergence Verification
${task.convergence.criteria.map((c, i) => `- [${verified[i] ? 'x' : ' '}] ${c}`).join('\n')}
- **Verification**: ${verificationResult}
- **Definition of Done**: ${task.convergence.definition_of_done}

---
`)

  // 6. Update execution.md task status
  updateTaskStatus(task.id, 'completed', filesModified, changeSummary)

  completedTasks.add(task.id)
}
```

##### Step 5.2: Failure Handling

When a task fails during execution:

```javascript
// On task failure:
appendToEvents(`
**Status**: ❌ FAILED
**Duration**: ${calculateDuration(startTime, endTime)}
**Error**: ${errorMessage}

#### Failure Details
${failureDetails}

#### Attempted Changes
${attemptedChanges}

---
`)

updateTaskStatus(task.id, 'failed', [], errorMessage)
failedTasks.add(task.id)

// Set _execution state
task._execution = {
  status: 'failed', executed_at: getUtc8ISOString(),
  result: { success: false, error: errorMessage, files_modified: [] }
}

// Ask user how to proceed
if (!autoYes) {
  const decision = AskUserQuestion({
    questions: [{
      question: `Task ${task.id} failed: ${errorMessage}\nHow to proceed?`,
      header: "Failure",
      multiSelect: false,
      options: [
        { label: "Skip & Continue", description: "Skip this task, continue with next" },
        { label: "Retry", description: "Retry this task" },
        { label: "Abort", description: "Stop execution, keep progress" }
      ]
    }]
  })
}
```

##### Step 5.3: Auto-Commit (if enabled)

After each successful task, optionally commit changes:

```javascript
if (autoCommit && task._execution?.status === 'completed') {
  // 1. Stage modified files
  Bash(`git add ${filesModified.join(' ')}`)

  // 2. Generate conventional commit message
  const commitType = {
    fix: 'fix', refactor: 'refactor', feature: 'feat',
    enhancement: 'feat', testing: 'test'
  }[task.type] || 'chore'

  const scope = inferScope(filesModified)  // e.g., "auth", "user", "api"

  // 3. Commit
  Bash(`git commit -m "${commitType}(${scope}): ${task.title}\n\nTask: ${task.id}\nSource: ${sessionId}"`)

  appendToEvents(`**Commit**: \`${commitType}(${scope}): ${task.title}\`\n`)
}
```

---

## Step 6: Finalize Execution Artifacts

##### Step 6.1: Update execution.md Summary

After all tasks complete, append final summary to `execution.md`:

```javascript
const summary = `
## Execution Summary

- **Completed**: ${getUtc8ISOString()}
- **Total Tasks**: ${tasks.length}
- **Succeeded**: ${completedTasks.size}
- **Failed**: ${failedTasks.size}
- **Skipped**: ${skippedTasks.size}
- **Success Rate**: ${Math.round(completedTasks.size / tasks.length * 100)}%

### Task Results

| ID | Title | Status | Files Modified |
|----|-------|--------|----------------|
${tasks.map(t => `| ${t.id} | ${t.title} | ${t._execution?.status || 'pending'} | ${(t._execution?.result?.files_modified || []).join(', ') || '-'} |`).join('\n')}

${failedTasks.size > 0 ? `### Failed Tasks Requiring Attention

${[...failedTasks].map(id => {
  const t = tasks.find(t => t.id === id)
  return `- **${t.id}**: ${t.title} — ${t._execution?.result?.error || 'Unknown error'}`
}).join('\n')}
` : ''}
### Artifacts
- **Execution Plan**: ${sessionFolder}/.task/
- **Execution Overview**: ${sessionFolder}/execution.md
- **Execution Events**: ${sessionFolder}/execution-events.md
`
// Append summary to execution.md
```

##### Step 6.2: Finalize execution-events.md

Append session footer:

```javascript
appendToEvents(`
---

# Session Summary

- **Session**: ${sessionId}
- **Completed**: ${getUtc8ISOString()}
- **Tasks**: ${completedTasks.size} completed, ${failedTasks.size} failed, ${skippedTasks.size} skipped
- **Total Events**: ${totalEvents}
`)
```

##### Step 6.3: Update .task/*.json

Write back `_execution` state to each task file:

```javascript
tasks.forEach(task => {
  const updatedTask = {
    ...task,
    status: task._status,                // "completed" | "failed" | "skipped" | "pending"
    executed_at: task._executed_at,       // ISO timestamp
    result: {
      success: task._status === 'completed',
      files_modified: task._result?.files_modified || [],
      summary: task._result?.summary || '',
      error: task._result?.error || null,
      convergence_verified: task._result?.convergence_verified || []
    }
  }
  Write(`${sessionFolder}/.task/${task.id}.json`, JSON.stringify(updatedTask, null, 2))
})
```

---

## Step 7: Completion & Follow-up

Present final execution results and offer next actions.

```javascript
// Display: session ID, statistics, failed tasks (if any), artifact paths

if (!autoYes) {
  AskUserQuestion({
    questions: [{
      question: `Execution complete: ${completedTasks.size}/${tasks.length} succeeded.\nNext step:`,
      header: "Post-Execute",
      multiSelect: false,
      options: [
        { label: "Retry Failed", description: `Re-execute ${failedTasks.size} failed tasks` },
        { label: "View Events", description: "Display execution-events.md" },
        { label: "Create Issue", description: "Create issue from failed tasks" },
        { label: "Done", description: "End workflow" }
      ]
    }]
  })
}
```

| Selection | Action |
|-----------|--------|
| Retry Failed | Filter tasks with status "failed", re-execute in order, append retry events |
| View Events | Display execution-events.md content |
| Create Issue | `Skill(skill="issue:new", args="...")` from failed task details |
| Done | Display artifact paths, end workflow |

**Retry Logic**:
- Filter tasks with `_execution.status === 'failed'`
- Re-execute in original dependency order
- Append retry events to execution-events.md with `[RETRY]` prefix
- Update execution.md and .task/*.json

---

## Output Structure

When Quick Execute is activated, session folder expands with:

```
{projectRoot}/.workflow/.analysis/ANL-{slug}-{date}/
├── ...                          # Phase 1-4 artifacts
├── .task/                       # Individual task JSON files (one per task, with convergence + source)
│   ├── TASK-001.json
│   ├── TASK-002.json
│   └── ...
├── execution.md                 # Plan overview + task table + execution summary
└── execution-events.md          # ⭐ Unified event log (all task executions with details)
```

| File | Purpose |
|------|---------|
| `.task/*.json` | Individual task files from conclusions, each with convergence criteria and source provenance |
| `execution.md` | Overview: plan source, task table, pre-execution analysis, execution timeline, final summary |
| `execution-events.md` | Chronological event stream: task start/complete/fail with details, changes, verification results |

---

## execution-events.md Template

```markdown
# Execution Events

**Session**: ANL-xxx-2025-01-21
**Started**: 2025-01-21T10:00:00+08:00
**Source**: .task/*.json

---

## 2025-01-21T10:01:00+08:00 — TASK-001: Fix authentication token refresh

**Type**: fix | **Priority**: high
**Status**: ⏳ IN PROGRESS
**Files**: src/auth/token.ts, src/middleware/auth.ts
**Description**: Token refresh fails silently when...

### Execution Log
- Read src/auth/token.ts (245 lines)
- Found issue at line 89: missing await on refreshToken()
- Applied fix: added await keyword
- Read src/middleware/auth.ts (120 lines)
- Updated error handler at line 45

**Status**: ✅ COMPLETED
**Duration**: 45s
**Files Modified**: src/auth/token.ts, src/middleware/auth.ts

#### Changes Summary
- Added `await` to `refreshToken()` call in token.ts:89
- Updated error handler to propagate refresh failures in auth.ts:45

#### Convergence Verification
- [x] Token refresh returns new valid token
- [x] Expired token triggers refresh automatically
- [x] Failed refresh redirects to login
- **Verification**: jest --testPathPattern=token.test.ts → PASS
- **Definition of Done**: Users remain logged in across token expiration without manual re-login

**Commit**: `fix(auth): Fix authentication token refresh`

---

## 2025-01-21T10:02:30+08:00 — TASK-002: Add input validation

**Type**: enhancement | **Priority**: medium
**Status**: ⏳ IN PROGRESS
...

---

# Session Summary

- **Session**: ANL-xxx-2025-01-21
- **Completed**: 2025-01-21T10:05:00+08:00
- **Tasks**: 2 completed, 0 failed, 0 skipped
- **Total Events**: 2
```

---

## Error Handling

| Situation | Action | Recovery |
|-----------|--------|----------|
| Task execution fails | Record failure in execution-events.md, ask user | Retry, skip, or abort |
| Verification command fails | Mark criterion as unverified, continue | Note in events, manual check needed |
| No recommendations in conclusions | Cannot generate .task/*.json | Inform user, suggest lite-plan |
| File conflict during execution | Document in execution-events.md | Resolve in dependency order |
| Circular dependencies detected | Stop, report error | Fix dependencies in .task/*.json |
| All tasks fail | Record all failures, suggest analysis review | Re-run analysis or manual intervention |
| Missing target file | Attempt to create if task.type is "feature" | Log as warning for other types |

---

## Success Criteria

- `.task/*.json` generated with convergence criteria and source provenance per task
- `execution.md` contains plan overview, task table, pre-execution analysis, final summary
- `execution-events.md` contains chronological event stream with convergence verification
- All tasks executed (or explicitly skipped) via direct inline execution
- Each task's convergence criteria checked and recorded
- `_execution` state written back to .task/*.json after completion
- User informed of results and next steps
