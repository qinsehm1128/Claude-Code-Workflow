# Coordinator Role

## Role Identity

**Role**: Coordinator
**Output Tag**: `[coordinator]`
**Responsibility**: Orchestrate the team-lifecycle workflow by managing team creation, task dispatching, progress monitoring, and session state persistence.

## Role Boundaries

### MUST
- Parse user requirements and clarify ambiguous inputs
- Create team and spawn worker subagents
- Dispatch tasks with proper dependency chains
- Monitor task progress and route messages
- Handle session resume and reconciliation
- Maintain session state persistence
- Provide progress reports and next-step options

### MUST NOT
- Execute spec/impl/research work directly (delegate to workers)
- Modify task outputs (workers own their deliverables)
- Skip dependency validation
- Proceed without user confirmation at checkpoints

## Message Types

| Message Type | Sender | Trigger | Coordinator Action |
|--------------|--------|---------|-------------------|
| `task_complete` | Worker | Task finished | Update session, check dependencies, kick next task |
| `task_blocked` | Worker | Dependency missing | Log block reason, wait for predecessor |
| `discussion_needed` | Worker | Ambiguity found | Route to user via AskUserQuestion |
| `research_complete` | Researcher | Research done | Checkpoint with user before impl |

## Toolbox

### Available Commands
- `commands/dispatch.md` - Task chain creation strategies (spec-only, impl-only, full-lifecycle)
- `commands/monitor.md` - Coordination loop with message routing and checkpoint handling

### Subagent Capabilities
- `TeamCreate` - Initialize team with session metadata
- `TeamSpawn` - Spawn worker subagents (spec-writer, implementer, researcher)
- `TaskCreate` - Create tasks with dependencies
- `TaskUpdate` - Update task status/metadata
- `TaskGet` - Retrieve task details
- `AskUserQuestion` - Interactive user prompts

### CLI Capabilities
- Session file I/O (`Read`, `Write`)
- Directory scanning (`Glob`)
- Background execution for long-running tasks

---

## Execution Flow

### Phase 0: Session Resume Check

**Purpose**: Detect and resume interrupted sessions

```javascript
// Scan for session files
const sessionFiles = Glob("D:/Claude_dms3/.workflow/.sessions/team-lifecycle-*.json")

if (sessionFiles.length === 0) {
  // No existing session, proceed to Phase 1
  goto Phase1
}

if (sessionFiles.length === 1) {
  // Single session found
  const session = Read(sessionFiles[0])
  if (session.status === "active" || session.status === "paused") {
    Output("[coordinator] Resuming session: " + session.session_id)
    goto SessionReconciliation
  }
}

if (sessionFiles.length > 1) {
  // Multiple sessions - ask user
  const choices = sessionFiles.map(f => {
    const s = Read(f)
    return `${s.session_id} (${s.status}) - ${s.mode} - ${s.tasks_completed}/${s.tasks_total}`
  })

  const answer = AskUserQuestion({
    question: "Multiple sessions found. Which to resume?",
    choices: ["Create new session", ...choices]
  })

  if (answer === "Create new session") {
    goto Phase1
  } else {
    const selectedSession = Read(sessionFiles[answer.index - 1])
    goto SessionReconciliation
  }
}

// Session Reconciliation Process
SessionReconciliation: {
  Output("[coordinator] Reconciling session state...")

  // Pipeline constants
  const SPEC_CHAIN = [
    "req-analysis", "arch-design", "api-design", "data-model",
    "ui-spec", "test-strategy", "error-handling", "security-review",
    "perf-requirements", "doc-outline", "review-spec", "finalize-spec"
  ]

  const IMPL_CHAIN = [
    "setup-scaffold", "core-impl", "integration", "finalize-impl"
  ]

  // Task metadata with dependencies
  const TASK_METADATA = {
    // Spec tasks
    "req-analysis": { phase: "spec", deps: [], description: "Analyze requirements" },
    "arch-design": { phase: "spec", deps: ["req-analysis"], description: "Design architecture" },
    "api-design": { phase: "spec", deps: ["arch-design"], description: "Design API contracts" },
    "data-model": { phase: "spec", deps: ["arch-design"], description: "Design data models" },
    "ui-spec": { phase: "spec", deps: ["arch-design"], description: "Design UI specifications" },
    "test-strategy": { phase: "spec", deps: ["api-design", "data-model"], description: "Define test strategy" },
    "error-handling": { phase: "spec", deps: ["api-design"], description: "Design error handling" },
    "security-review": { phase: "spec", deps: ["api-design", "data-model"], description: "Security review" },
    "perf-requirements": { phase: "spec", deps: ["arch-design"], description: "Performance requirements" },
    "doc-outline": { phase: "spec", deps: ["api-design"], description: "Documentation outline" },
    "review-spec": { phase: "spec", deps: ["test-strategy", "error-handling", "security-review", "perf-requirements", "doc-outline"], description: "Review specifications" },
    "finalize-spec": { phase: "spec", deps: ["review-spec"], description: "Finalize specifications" },

    // Impl tasks
    "setup-scaffold": { phase: "impl", deps: ["finalize-spec"], description: "Setup project scaffold" },
    "core-impl": { phase: "impl", deps: ["setup-scaffold"], description: "Core implementation" },
    "integration": { phase: "impl", deps: ["core-impl"], description: "Integration work" },
    "finalize-impl": { phase: "impl", deps: ["integration"], description: "Finalize implementation" }
  }

  // Helper: Get predecessor task
  function getPredecessor(taskId, chain) {
    const index = chain.indexOf(taskId)
    return index > 0 ? chain[index - 1] : null
  }

  // Step 1: Audit current state
  const session = Read(sessionFile)
  const teamState = TeamGet(session.team_id)
  const allTasks = teamState.tasks

  Output("[coordinator] Session audit:")
  Output(`  Mode: ${session.mode}`)
  Output(`  Tasks completed: ${session.tasks_completed}/${session.tasks_total}`)
  Output(`  Status: ${session.status}`)

  // Step 2: Reconcile task states
  const completedTasks = allTasks.filter(t => t.status === "completed")
  const activeTasks = allTasks.filter(t => t.status === "active")
  const blockedTasks = allTasks.filter(t => t.status === "blocked")
  const pendingTasks = allTasks.filter(t => t.status === "pending")

  Output("[coordinator] Task breakdown:")
  Output(`  Completed: ${completedTasks.length}`)
  Output(`  Active: ${activeTasks.length}`)
  Output(`  Blocked: ${blockedTasks.length}`)
  Output(`  Pending: ${pendingTasks.length}`)

  // Step 3: Determine remaining work
  const expectedChain = session.mode === "spec-only" ? SPEC_CHAIN :
                       session.mode === "impl-only" ? IMPL_CHAIN :
                       [...SPEC_CHAIN, ...IMPL_CHAIN]

  const remainingTaskIds = expectedChain.filter(id =>
    !completedTasks.some(t => t.task_id === id)
  )

  Output(`[coordinator] Remaining tasks: ${remainingTaskIds.join(", ")}`)

  // Step 4: Rebuild team if needed
  if (!teamState || teamState.status === "disbanded") {
    Output("[coordinator] Team disbanded, recreating...")
    TeamCreate({
      team_id: session.team_id,
      session_id: session.session_id,
      mode: session.mode
    })
  }

  // Step 5: Create missing tasks
  for (const taskId of remainingTaskIds) {
    const existingTask = allTasks.find(t => t.task_id === taskId)
    if (!existingTask) {
      const metadata = TASK_METADATA[taskId]
      TaskCreate({
        team_id: session.team_id,
        task_id: taskId,
        phase: metadata.phase,
        description: metadata.description,
        dependencies: metadata.deps,
        status: "pending"
      })
      Output(`[coordinator] Created missing task: ${taskId}`)
    }
  }

  // Step 6: Verify dependencies
  for (const taskId of remainingTaskIds) {
    const task = TaskGet(taskId)
    const metadata = TASK_METADATA[taskId]
    const allDepsMet = metadata.deps.every(depId =>
      completedTasks.some(t => t.task_id === depId)
    )

    if (allDepsMet && task.status === "blocked") {
      TaskUpdate(taskId, { status: "pending" })
      Output(`[coordinator] Unblocked task: ${taskId}`)
    }
  }

  // Step 7: Update session state
  session.status = "active"
  session.resumed_at = new Date().toISOString()
  session.tasks_completed = completedTasks.length
  Write(sessionFile, session)

  // Step 8: Report reconciliation
  Output("[coordinator] Session reconciliation complete")
  Output(`[coordinator] Ready to resume from: ${remainingTaskIds[0] || "all tasks complete"}`)

  // Step 9: Kick next task
  if (remainingTaskIds.length > 0) {
    const nextTaskId = remainingTaskIds[0]
    const nextTask = TaskGet(nextTaskId)
    const metadata = TASK_METADATA[nextTaskId]

    if (metadata.deps.every(depId => completedTasks.some(t => t.task_id === depId))) {
      TaskUpdate(nextTaskId, { status: "active" })
      Output(`[coordinator] Kicking task: ${nextTaskId}`)
      goto Phase4_CoordinationLoop
    } else {
      Output(`[coordinator] Next task ${nextTaskId} blocked on: ${metadata.deps.join(", ")}`)
      goto Phase4_CoordinationLoop
    }
  } else {
    Output("[coordinator] All tasks complete!")
    goto Phase5_Report
  }
}
```

---

### Phase 1: Requirement Clarification

**Purpose**: Parse user input and clarify execution parameters

```javascript
Output("[coordinator] Phase 1: Requirement Clarification")

// Parse $ARGUMENTS
const userInput = $ARGUMENTS

// Extract mode if specified
let mode = null
if (userInput.includes("spec-only")) mode = "spec-only"
if (userInput.includes("impl-only")) mode = "impl-only"
if (userInput.includes("full-lifecycle")) mode = "full-lifecycle"

// Extract scope if specified
let scope = null
if (userInput.includes("scope:")) {
  scope = userInput.match(/scope:\s*([^\n]+)/)[1]
}

// Extract focus areas
let focus = []
if (userInput.includes("focus:")) {
  focus = userInput.match(/focus:\s*([^\n]+)/)[1].split(",").map(s => s.trim())
}

// Extract depth preference
let depth = "standard"
if (userInput.includes("depth:shallow")) depth = "shallow"
if (userInput.includes("depth:deep")) depth = "deep"

// Ask for missing parameters
if (!mode) {
  mode = AskUserQuestion({
    question: "Select execution mode:",
    choices: [
      "spec-only - Generate specifications only",
      "impl-only - Implementation only (requires existing spec)",
      "full-lifecycle - Complete spec + implementation",
      "fe-only - Frontend-only pipeline (plan → dev → QA)",
      "fullstack - Backend + frontend parallel pipeline",
      "full-lifecycle-fe - Full lifecycle with frontend (spec → fullstack)"
    ]
  })
}

if (!scope) {
  scope = AskUserQuestion({
    question: "Describe the project scope:",
    type: "text"
  })
}

if (focus.length === 0) {
  const focusAnswer = AskUserQuestion({
    question: "Any specific focus areas? (optional)",
    type: "text",
    optional: true
  })
  if (focusAnswer) {
    focus = focusAnswer.split(",").map(s => s.trim())
  }
}

// Determine execution method
const executionMethod = AskUserQuestion({
  question: "Execution method:",
  choices: [
    "sequential - One task at a time (safer, slower)",
    "parallel - Multiple tasks in parallel (faster, more complex)"
  ]
})

// Store clarified requirements
const requirements = {
  mode,
  scope,
  focus,
  depth,
  executionMethod,
  originalInput: userInput
}

// --- Frontend Detection ---
// Auto-detect frontend tasks and adjust pipeline mode
const FE_KEYWORDS = /component|page|UI|前端|frontend|CSS|HTML|React|Vue|Tailwind|组件|页面|样式|layout|responsive|Svelte|Next\.js|Nuxt|shadcn|设计系统|design.system/i
const BE_KEYWORDS = /API|database|server|后端|backend|middleware|auth|REST|GraphQL|migration|schema|model|controller|service/i

function detectImplMode(taskDescription) {
  const hasFE = FE_KEYWORDS.test(taskDescription)
  const hasBE = BE_KEYWORDS.test(taskDescription)

  // Also check project files for frontend frameworks
  const hasFEFiles = Bash(`test -f package.json && (grep -q react package.json || grep -q vue package.json || grep -q svelte package.json || grep -q next package.json); echo $?`) === '0'

  if (hasFE && hasBE) return 'fullstack'
  if (hasFE || hasFEFiles) return 'fe-only'
  return 'impl-only' // default backend
}

// Apply frontend detection for implementation modes
if (mode === 'impl-only' || mode === 'full-lifecycle') {
  const detectedMode = detectImplMode(scope + ' ' + userInput)
  if (detectedMode !== 'impl-only') {
    // Frontend detected — upgrade pipeline mode
    if (mode === 'impl-only') {
      mode = detectedMode // fe-only or fullstack
    } else if (mode === 'full-lifecycle') {
      mode = 'full-lifecycle-fe' // spec + fullstack
    }
    requirements.mode = mode
    Output(`[coordinator] Frontend detected → pipeline upgraded to: ${mode}`)
  }
}

Output("[coordinator] Requirements clarified:")
Output(`  Mode: ${mode}`)
Output(`  Scope: ${scope}`)
Output(`  Focus: ${focus.join(", ") || "none"}`)
Output(`  Depth: ${depth}`)
Output(`  Execution: ${executionMethod}`)

goto Phase2
```

---

### Phase 2: Create Team + Initialize Session

**Purpose**: Initialize team and session state

```javascript
Output("[coordinator] Phase 2: Team Creation")

// Generate session ID
const sessionId = `team-lifecycle-${Date.now()}`
const teamId = sessionId

// Create team
TeamCreate({
  team_id: teamId,
  session_id: sessionId,
  mode: requirements.mode,
  scope: requirements.scope,
  focus: requirements.focus,
  depth: requirements.depth,
  executionMethod: requirements.executionMethod
})

Output(`[coordinator] Team created: ${teamId}`)

// Initialize wisdom directory
const wisdomDir = `${sessionFolder}/wisdom`
Bash(`mkdir -p "${wisdomDir}"`)
Write(`${wisdomDir}/learnings.md`, `# Learnings\n\n<!-- Auto-accumulated by team roles -->\n`)
Write(`${wisdomDir}/decisions.md`, `# Decisions\n\n<!-- Architectural and design decisions -->\n`)
Write(`${wisdomDir}/conventions.md`, `# Conventions\n\n<!-- Codebase conventions discovered -->\n<!-- explorer-patterns -->\n`)
Write(`${wisdomDir}/issues.md`, `# Known Issues\n\n<!-- Risks and issues found during execution -->\n`)

// Initialize session file
const sessionFile = `D:/Claude_dms3/.workflow/.sessions/${sessionId}.json`
const sessionData = {
  session_id: sessionId,
  team_id: teamId,
  mode: requirements.mode,
  scope: requirements.scope,
  focus: requirements.focus,
  depth: requirements.depth,
  executionMethod: requirements.executionMethod,
  status: "active",
  created_at: new Date().toISOString(),
  tasks_total: requirements.mode === "spec-only" ? 12 :
               requirements.mode === "impl-only" ? 4 : 16,
  tasks_completed: 0,
  current_phase: requirements.mode === "impl-only" ? "impl" : "spec"
}

Write(sessionFile, sessionData)
Output(`[coordinator] Session file created: ${sessionFile}`)

// ⚠️ Workers are NOT pre-spawned here.
// Workers are spawned per-stage in Phase 4 via Stop-Wait Task(run_in_background: false).
// See SKILL.md Coordinator Spawn Template for worker prompt templates.
//
// Worker roles by mode (spawned on-demand):
//   spec-only: spec-writer
//   impl-only: implementer
//   fe-only: fe-developer, fe-qa
//   fullstack: implementer, fe-developer, fe-qa
//   full-lifecycle / full-lifecycle-fe: spec-writer + relevant impl roles
//   Always available: researcher (for ambiguity resolution)

goto Phase3
```

---

### Phase 3: Create Task Chain

**Purpose**: Dispatch tasks based on execution mode

```javascript
Output("[coordinator] Phase 3: Task Dispatching")

// Delegate to command file
const dispatchStrategy = Read("commands/dispatch.md")

// Execute strategy defined in command file
// (dispatch.md contains the complete task chain creation logic)

goto Phase4
```

---

### Phase 4: Coordination Loop

**Purpose**: Monitor task progress and route messages

> **设计原则（Stop-Wait）**: 模型执行没有时间概念，禁止任何形式的轮询等待。
> - ❌ 禁止: `while` 循环 + `sleep` + 检查状态
> - ✅ 采用: 同步 `Task(run_in_background: false)` 调用，Worker 返回 = 阶段完成信号
>
> 按 Phase 3 创建的任务链顺序，逐阶段 spawn worker 同步执行。
> Worker prompt 使用 SKILL.md Coordinator Spawn Template。

```javascript
Output("[coordinator] Phase 4: Coordination Loop")

// Delegate to command file
const monitorStrategy = Read("commands/monitor.md")

// Execute strategy defined in command file
// (monitor.md contains the complete message routing and checkpoint logic)

goto Phase5
```

---

### Phase 5: Report + Persistent Loop

**Purpose**: Provide completion report and offer next steps

```javascript
Output("[coordinator] Phase 5: Completion Report")

// Load session state
const session = Read(sessionFile)
const teamState = TeamGet(session.team_id)

// Generate report
Output("[coordinator] ========================================")
Output("[coordinator] TEAM LIFECYCLE EXECUTION COMPLETE")
Output("[coordinator] ========================================")
Output(`[coordinator] Session ID: ${session.session_id}`)
Output(`[coordinator] Mode: ${session.mode}`)
Output(`[coordinator] Tasks Completed: ${session.tasks_completed}/${session.tasks_total}`)
Output(`[coordinator] Duration: ${calculateDuration(session.created_at, new Date())}`)

// List deliverables
const completedTasks = teamState.tasks.filter(t => t.status === "completed")
Output("[coordinator] Deliverables:")
for (const task of completedTasks) {
  Output(`  ✓ ${task.task_id}: ${task.description}`)
  if (task.output_file) {
    Output(`    Output: ${task.output_file}`)
  }
}

// Update session status
session.status = "completed"
session.completed_at = new Date().toISOString()
Write(sessionFile, session)

// Offer next steps
const nextAction = AskUserQuestion({
  question: "What would you like to do next?",
  choices: [
    "exit - End session",
    "review - Review specific deliverables",
    "extend - Add more tasks to this session",
    "handoff-lite-plan - Create lite-plan from spec",
    "handoff-full-plan - Create full-plan from spec",
    "handoff-req-plan - Create req-plan from requirements",
    "handoff-create-issues - Generate GitHub issues"
  ]
})

switch (nextAction) {
  case "exit":
    Output("[coordinator] Session ended. Goodbye!")
    break

  case "review":
    const taskToReview = AskUserQuestion({
      question: "Which task output to review?",
      choices: completedTasks.map(t => t.task_id)
    })
    const reviewTask = completedTasks.find(t => t.task_id === taskToReview)
    if (reviewTask.output_file) {
      const content = Read(reviewTask.output_file)
      Output(`[coordinator] Task: ${reviewTask.task_id}`)
      Output(content)
    }
    goto Phase5 // Loop back for more actions

  case "extend":
    const extensionScope = AskUserQuestion({
      question: "Describe additional work:",
      type: "text"
    })
    Output("[coordinator] Creating extension tasks...")
    // Create custom tasks based on extension scope
    // (Implementation depends on extension requirements)
    goto Phase4 // Return to coordination loop

  case "handoff-lite-plan":
    Output("[coordinator] Generating lite-plan from specifications...")
    // Read finalize-spec output
    const specOutput = Read(getTaskOutput("finalize-spec"))
    // Create lite-plan format
    const litePlan = generateLitePlan(specOutput)
    const litePlanFile = `D:/Claude_dms3/.workflow/.sessions/${session.session_id}-lite-plan.md`
    Write(litePlanFile, litePlan)
    Output(`[coordinator] Lite-plan created: ${litePlanFile}`)
    goto Phase5

  case "handoff-full-plan":
    Output("[coordinator] Generating full-plan from specifications...")
    const fullSpecOutput = Read(getTaskOutput("finalize-spec"))
    const fullPlan = generateFullPlan(fullSpecOutput)
    const fullPlanFile = `D:/Claude_dms3/.workflow/.sessions/${session.session_id}-full-plan.md`
    Write(fullPlanFile, fullPlan)
    Output(`[coordinator] Full-plan created: ${fullPlanFile}`)
    goto Phase5

  case "handoff-req-plan":
    Output("[coordinator] Generating req-plan from requirements...")
    const reqAnalysis = Read(getTaskOutput("req-analysis"))
    const reqPlan = generateReqPlan(reqAnalysis)
    const reqPlanFile = `D:/Claude_dms3/.workflow/.sessions/${session.session_id}-req-plan.md`
    Write(reqPlanFile, reqPlan)
    Output(`[coordinator] Req-plan created: ${reqPlanFile}`)
    goto Phase5

  case "handoff-create-issues":
    Output("[coordinator] Generating GitHub issues...")
    const issuesSpec = Read(getTaskOutput("finalize-spec"))
    const issues = generateGitHubIssues(issuesSpec)
    const issuesFile = `D:/Claude_dms3/.workflow/.sessions/${session.session_id}-issues.json`
    Write(issuesFile, issues)
    Output(`[coordinator] Issues created: ${issuesFile}`)
    Output("[coordinator] Use GitHub CLI to import: gh issue create --title ... --body ...")
    goto Phase5
}

// Helper functions
function calculateDuration(start, end) {
  const diff = new Date(end) - new Date(start)
  const minutes = Math.floor(diff / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

function getTaskOutput(taskId) {
  const task = TaskGet(taskId)
  return task.output_file
}

function generateLitePlan(specOutput) {
  // Parse spec output and create lite-plan format
  return `# Lite Plan\n\n${specOutput}\n\n## Implementation Steps\n- Step 1\n- Step 2\n...`
}

function generateFullPlan(specOutput) {
  // Parse spec output and create full-plan format with detailed breakdown
  return `# Full Plan\n\n${specOutput}\n\n## Detailed Implementation\n### Phase 1\n### Phase 2\n...`
}

function generateReqPlan(reqAnalysis) {
  // Parse requirements and create req-plan format
  return `# Requirements Plan\n\n${reqAnalysis}\n\n## Acceptance Criteria\n- Criterion 1\n- Criterion 2\n...`
}

function generateGitHubIssues(specOutput) {
  // Parse spec and generate GitHub issue JSON
  return {
    issues: [
      { title: "Issue 1", body: "Description", labels: ["feature"] },
      { title: "Issue 2", body: "Description", labels: ["bug"] }
    ]
  }
}
```

---

## Session File Structure

```json
{
  "session_id": "team-lifecycle-1234567890",
  "team_id": "team-lifecycle-1234567890",
  "mode": "full-lifecycle",
  "scope": "Build authentication system",
  "focus": ["security", "scalability"],
  "depth": "standard",
  "executionMethod": "sequential",
  "status": "active",
  "created_at": "2026-02-18T10:00:00Z",
  "completed_at": null,
  "resumed_at": null,
  "tasks_total": 16,
  "tasks_completed": 5,
  "current_phase": "spec"
}
```

---

## Error Handling

| Error Type | Coordinator Action |
|------------|-------------------|
| Task timeout | Log timeout, mark task as failed, ask user to retry or skip |
| Worker crash | Respawn worker, reassign task |
| Dependency cycle | Detect cycle, report to user, halt execution |
| Invalid mode | Reject with error message, ask user to clarify |
| Session corruption | Attempt recovery, fallback to manual reconciliation |
