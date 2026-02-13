# Phase 1: Session Initialization

Create or resume a development loop, initialize state file and directory structure.

## Objective

- Parse user arguments (TASK, --loop-id, --auto)
- Create new loop with unique ID OR resume existing loop
- Initialize directory structure for progress files
- Create master state file
- Output: loopId, state, progressDir

## Execution

### Step 0: Determine Project Root

```javascript
// Step 0: Determine Project Root
const projectRoot = Bash('git rev-parse --show-toplevel 2>/dev/null || pwd').trim()
```

### Step 1.1: Parse Arguments & Load Prep Package

```javascript
const { loopId: existingLoopId, task, mode = 'interactive' } = options

// Validate mutual exclusivity
if (!existingLoopId && !task) {
  console.error('Either --loop-id or task description is required')
  return { status: 'error', message: 'Missing loopId or task' }
}

// Determine mode
const executionMode = options['--auto'] ? 'auto' : 'interactive'

// ── Prep Package: Detect → Validate → Consume ──
let prepPackage = null
let prepTasks = null
const prepPath = `${projectRoot}/.workflow/.loop/prep-package.json`

if (fs.existsSync(prepPath)) {
  const raw = JSON.parse(Read(prepPath))
  const checks = validateLoopPrepPackage(raw, projectRoot)

  if (checks.valid) {
    prepPackage = raw

    // Load pre-built tasks
    const taskDir = `${projectRoot}/.workflow/.loop/.task`
    prepTasks = loadPrepTasks(taskDir)

    if (prepTasks && prepTasks.length > 0) {
      console.log(`✓ Prep package loaded: ${prepTasks.length} tasks from ${prepPackage.source.tool}`)
      console.log(`  Checks passed: ${checks.passed.join(', ')}`)
    } else {
      console.warn(`Warning: Prep tasks directory empty or invalid, falling back to default INIT`)
      prepPackage = null
      prepTasks = null
    }
  } else {
    console.warn(`⚠ Prep package found but failed validation:`)
    checks.failures.forEach(f => console.warn(`  ✗ ${f}`))
    console.warn(`  → Falling back to default behavior (prep-package ignored)`)
    prepPackage = null
  }
}

/**
 * Validate prep-package.json integrity before consumption.
 * Returns { valid: bool, passed: string[], failures: string[] }
 */
function validateLoopPrepPackage(prep, projectRoot) {
  const passed = []
  const failures = []

  // Check 1: prep_status must be "ready"
  if (prep.prep_status === 'ready') {
    passed.push('status=ready')
  } else {
    failures.push(`prep_status is "${prep.prep_status}", expected "ready"`)
  }

  // Check 2: target_skill must match
  if (prep.target_skill === 'ccw-loop') {
    passed.push('target_skill match')
  } else {
    failures.push(`target_skill is "${prep.target_skill}", expected "ccw-loop"`)
  }

  // Check 3: project_root must match current project
  if (prep.environment?.project_root === projectRoot) {
    passed.push('project_root match')
  } else {
    failures.push(`project_root mismatch: prep="${prep.environment?.project_root}", current="${projectRoot}"`)
  }

  // Check 4: generated_at must be within 24 hours
  const generatedAt = new Date(prep.generated_at)
  const hoursSince = (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60)
  if (hoursSince <= 24) {
    passed.push(`age=${Math.round(hoursSince)}h`)
  } else {
    failures.push(`prep-package is ${Math.round(hoursSince)}h old (max 24h), may be stale`)
  }

  // Check 5: .task/ directory must exist with task files
  const taskDir = `${projectRoot}/.workflow/.loop/.task`
  const taskFiles = Glob(`${taskDir}/*.json`)
  if (fs.existsSync(taskDir) && taskFiles.length > 0) {
    passed.push(`.task/ exists (${taskFiles.length} files)`)
  } else {
    failures.push('.task/ directory not found or empty')
  }

  // Check 6: task count > 0
  if ((prep.tasks?.total || 0) > 0) {
    passed.push(`tasks=${prep.tasks.total}`)
  } else {
    failures.push('task count is 0')
  }

  return {
    valid: failures.length === 0,
    passed,
    failures
  }
}

/**
 * Load pre-built tasks from .task/*.json directory.
 * Returns array of task objects or null on failure.
 */
function loadPrepTasks(taskDir) {
  if (!fs.existsSync(taskDir)) return null

  const taskFiles = Glob(`${taskDir}/*.json`).sort()
  const tasks = []

  for (const filePath of taskFiles) {
    try {
      const content = Read(filePath)
      const task = JSON.parse(content)
      if (task.id && task.description) {
        tasks.push(task)
      }
    } catch (e) {
      console.warn(`Warning: Skipping invalid task file ${filePath}: ${e.message}`)
    }
  }

  return tasks.length > 0 ? tasks : null
}
```

### Step 1.2: Utility Functions

```javascript
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

function readLoopState(loopId) {
  const stateFile = `${projectRoot}/.workflow/.loop/${loopId}.json`
  if (!fs.existsSync(stateFile)) {
    return null
  }
  return JSON.parse(Read(stateFile))
}
```

### Step 1.3: New Loop Creation

When `TASK` is provided (no `--loop-id`):

```javascript
// Generate unique loop ID
const timestamp = getUtc8ISOString().replace(/[-:]/g, '').split('.')[0]
const random = Math.random().toString(36).substring(2, 10)
const loopId = `loop-v2-${timestamp}-${random}`

console.log(`Creating new loop: ${loopId}`)
```

#### Create Directory Structure

```bash
mkdir -p ${projectRoot}/.workflow/.loop/${loopId}.progress
```

#### Initialize State File

```javascript
function createLoopState(loopId, taskDescription) {
  const stateFile = `${projectRoot}/.workflow/.loop/${loopId}.json`
  const now = getUtc8ISOString()

  const state = {
    // API compatible fields
    loop_id: loopId,
    title: taskDescription.substring(0, 100),
    description: taskDescription,
    max_iterations: prepPackage?.auto_loop?.max_iterations || 10,
    status: 'running',
    current_iteration: 0,
    created_at: now,
    updated_at: now,

    // Skill extension fields
    // When prep tasks available, pre-populate skill_state instead of null
    skill_state: prepTasks ? {
      current_action: 'init',
      last_action: null,
      completed_actions: [],
      mode: executionMode,

      develop: {
        total: prepTasks.length,
        completed: 0,
        current_task: null,
        tasks: prepTasks,
        last_progress_at: null
      },

      debug: {
        active_bug: null,
        hypotheses_count: 0,
        hypotheses: [],
        confirmed_hypothesis: null,
        iteration: 0,
        last_analysis_at: null
      },

      validate: {
        pass_rate: 0,
        coverage: 0,
        test_results: [],
        passed: false,
        failed_tests: [],
        last_run_at: null
      },

      errors: []
    } : null,

    // Prep package metadata (for traceability)
    prep_source: prepPackage?.source || null
  }

  Write(stateFile, JSON.stringify(state, null, 2))
  return state
}
```

### Step 1.4: Resume Existing Loop

When `--loop-id` is provided:

```javascript
const loopId = existingLoopId
const state = readLoopState(loopId)

if (!state) {
  console.error(`Loop not found: ${loopId}`)
  return { status: 'error', message: 'Loop not found' }
}

console.log(`Resuming loop: ${loopId}`)
console.log(`Status: ${state.status}`)
```

### Step 1.5: Control Signal Check

Before proceeding, verify loop status allows continuation:

```javascript
function checkControlSignals(loopId) {
  const state = readLoopState(loopId)

  switch (state?.status) {
    case 'paused':
      return { continue: false, action: 'pause_exit' }
    case 'failed':
      return { continue: false, action: 'stop_exit' }
    case 'running':
      return { continue: true, action: 'continue' }
    default:
      return { continue: false, action: 'stop_exit' }
  }
}
```

## Output

- **Variable**: `loopId` - Unique loop identifier
- **Variable**: `state` - Initialized or resumed loop state object
- **Variable**: `progressDir` - `${projectRoot}/.workflow/.loop/${loopId}.progress`
- **Variable**: `mode` - `'interactive'` or `'auto'`
- **TodoWrite**: Mark Phase 1 completed, Phase 2 in_progress

## Next Phase

Return to orchestrator, then auto-continue to [Phase 2: Orchestration Loop](02-orchestration-loop.md).
