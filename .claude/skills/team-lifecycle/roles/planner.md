# Role: planner

Multi-angle code exploration and structured implementation planning. Submits plans to the coordinator for approval.

## Role Identity

- **Name**: `planner`
- **Task Prefix**: `PLAN-*`
- **Responsibility**: Code exploration → Implementation planning → Coordinator approval
- **Communication**: SendMessage to coordinator only

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `plan_ready` | planner → coordinator | Plan generation complete | With plan.json path and task count summary |
| `plan_revision` | planner → coordinator | Plan revised and resubmitted | Describes changes made |
| `impl_progress` | planner → coordinator | Exploration phase progress | Optional, for long explorations |
| `error` | planner → coordinator | Unrecoverable error | Exploration failure, schema missing, etc. |

## Message Bus

Before every `SendMessage`, MUST call `mcp__ccw-tools__team_msg` to log:

```javascript
// Plan ready
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "planner", to: "coordinator", type: "plan_ready", summary: "Plan ready: 3 tasks, Medium complexity", ref: `${sessionFolder}/plan/plan.json` })

// Plan revision
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "planner", to: "coordinator", type: "plan_revision", summary: "Split task-2 into two subtasks per feedback" })

// Error report
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "planner", to: "coordinator", type: "error", summary: "plan-overview-base-schema.json not found, using default structure" })
```

### CLI Fallback

When `mcp__ccw-tools__team_msg` MCP is unavailable:

```javascript
Bash(`ccw team log --team "${teamName}" --from "planner" --to "coordinator" --type "plan_ready" --summary "Plan ready: 3 tasks" --ref "${sessionFolder}/plan/plan.json" --json`)
```

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('PLAN-') &&
  t.owner === 'planner' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 1.5: Load Spec Context (Full-Lifecycle Mode)

```javascript
// Extract session folder from task description (set by coordinator)
const sessionMatch = task.description.match(/Session:\s*(.+)/)
const sessionFolder = sessionMatch ? sessionMatch[1].trim() : `.workflow/.team/default`
const planDir = `${sessionFolder}/plan`
Bash(`mkdir -p ${planDir}`)

// Check if spec directory exists (full-lifecycle mode)
const specDir = `${sessionFolder}/spec`
let specContext = null
try {
  const reqIndex = Read(`${specDir}/requirements/_index.md`)
  const archIndex = Read(`${specDir}/architecture/_index.md`)
  const epicsIndex = Read(`${specDir}/epics/_index.md`)
  const specConfig = JSON.parse(Read(`${specDir}/spec-config.json`))
  specContext = { reqIndex, archIndex, epicsIndex, specConfig }
} catch { /* impl-only mode has no spec */ }
```

### Phase 2: Multi-Angle Exploration

```javascript

// Complexity assessment
function assessComplexity(desc) {
  let score = 0
  if (/refactor|architect|restructure|模块|系统/.test(desc)) score += 2
  if (/multiple|多个|across|跨/.test(desc)) score += 2
  if (/integrate|集成|api|database/.test(desc)) score += 1
  if (/security|安全|performance|性能/.test(desc)) score += 1
  return score >= 4 ? 'High' : score >= 2 ? 'Medium' : 'Low'
}

const complexity = assessComplexity(task.description)

// Angle selection based on task type
const ANGLE_PRESETS = {
  architecture: ['architecture', 'dependencies', 'modularity', 'integration-points'],
  security: ['security', 'auth-patterns', 'dataflow', 'validation'],
  performance: ['performance', 'bottlenecks', 'caching', 'data-access'],
  bugfix: ['error-handling', 'dataflow', 'state-management', 'edge-cases'],
  feature: ['patterns', 'integration-points', 'testing', 'dependencies']
}

function selectAngles(desc, count) {
  const text = desc.toLowerCase()
  let preset = 'feature'
  if (/refactor|architect|restructure|modular/.test(text)) preset = 'architecture'
  else if (/security|auth|permission|access/.test(text)) preset = 'security'
  else if (/performance|slow|optimi|cache/.test(text)) preset = 'performance'
  else if (/fix|bug|error|issue|broken/.test(text)) preset = 'bugfix'
  return ANGLE_PRESETS[preset].slice(0, count)
}

const angleCount = complexity === 'High' ? 4 : (complexity === 'Medium' ? 3 : 1)
const selectedAngles = selectAngles(task.description, angleCount)

// Execute exploration
if (complexity === 'Low') {
  // Direct exploration via semantic search
  const results = mcp__ace-tool__search_context({
    project_root_path: projectRoot,
    query: task.description
  })
  Write(`${planDir}/exploration-${selectedAngles[0]}.json`, JSON.stringify({
    project_structure: "...",
    relevant_files: [],
    patterns: [],
    dependencies: [],
    integration_points: [],
    constraints: [],
    clarification_needs: [],
    _metadata: { exploration_angle: selectedAngles[0] }
  }, null, 2))
} else {
  // Launch parallel cli-explore-agent for each angle
  selectedAngles.forEach((angle, index) => {
    Task({
      subagent_type: "cli-explore-agent",
      run_in_background: false,
      description: `Explore: ${angle}`,
      prompt: `
## Task Objective
Execute **${angle}** exploration for task planning context.

## Output Location
**Session Folder**: ${sessionFolder}
**Output File**: ${planDir}/exploration-${angle}.json

## Assigned Context
- **Exploration Angle**: ${angle}
- **Task Description**: ${task.description}
- **Spec Context**: ${specContext ? 'Available — use spec/requirements, spec/architecture, spec/epics for informed exploration' : 'Not available (impl-only mode)'}
- **Exploration Index**: ${index + 1} of ${selectedAngles.length}

## MANDATORY FIRST STEPS
1. Run: rg -l "{relevant_keyword}" --type ts (locate relevant files)
2. Execute: cat ~/.ccw/workflows/cli-templates/schemas/explore-json-schema.json (get output schema)
3. Read: .workflow/project-tech.json (if exists - technology stack)

## Expected Output
Write JSON to: ${planDir}/exploration-${angle}.json
Follow explore-json-schema.json structure with ${angle}-focused findings.

**MANDATORY**: Every file in relevant_files MUST have:
- **rationale** (required): Specific selection basis tied to ${angle} topic (>10 chars, not generic)
- **role** (required): modify_target|dependency|pattern_reference|test_target|type_definition|integration_point|config|context_only
- **discovery_source** (recommended): bash-scan|cli-analysis|ace-search|dependency-trace|manual
- **key_symbols** (recommended): Key functions/classes/types relevant to task
`
    })
  })
}

// Build explorations manifest
const explorationManifest = {
  session_id: `${taskSlug}-${dateStr}`,
  task_description: task.description,
  complexity: complexity,
  exploration_count: selectedAngles.length,
  explorations: selectedAngles.map(angle => ({
    angle: angle,
    file: `exploration-${angle}.json`,
    path: `${planDir}/exploration-${angle}.json`
  }))
}
Write(`${planDir}/explorations-manifest.json`, JSON.stringify(explorationManifest, null, 2))
```

### Phase 3: Plan Generation

```javascript
// Read schema reference
const schema = Bash(`cat ~/.ccw/workflows/cli-templates/schemas/plan-overview-base-schema.json`)

if (complexity === 'Low') {
  // Direct Claude planning
  Bash(`mkdir -p ${planDir}/.task`)
  // Generate plan.json + .task/TASK-*.json following schemas
} else {
  // Use cli-lite-planning-agent for Medium/High
  Task({
    subagent_type: "cli-lite-planning-agent",
    run_in_background: false,
    description: "Generate detailed implementation plan",
    prompt: `Generate implementation plan.
Output: ${planDir}/plan.json + ${planDir}/.task/TASK-*.json
Schema: cat ~/.ccw/workflows/cli-templates/schemas/plan-overview-base-schema.json
Task Description: ${task.description}
Explorations: ${explorationManifest}
Complexity: ${complexity}
${specContext ? `Spec Context:
- Requirements: ${specContext.reqIndex.substring(0, 500)}
- Architecture: ${specContext.archIndex.substring(0, 500)}
- Epics: ${specContext.epicsIndex.substring(0, 500)}
Reference REQ-* IDs, follow ADR decisions, reuse Epic/Story decomposition.` : ''}
Requirements: 2-7 tasks, each with id, title, files[].change, convergence.criteria, depends_on`
  })
}
```

### Phase 4: Submit for Approval

```javascript
const plan = JSON.parse(Read(`${planDir}/plan.json`))
const planTasks = plan.task_ids.map(id => JSON.parse(Read(`${planDir}/.task/${id}.json`)))
const taskCount = plan.task_count || plan.task_ids.length

mcp__ccw-tools__team_msg({
  operation: "log", team: teamName,
  from: "planner", to: "coordinator",
  type: "plan_ready",
  summary: `Plan就绪: ${taskCount}个task, ${complexity}复杂度`,
  ref: `${planDir}/plan.json`
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## Plan Ready for Review

**Task**: ${task.subject}
**Complexity**: ${complexity}
**Tasks**: ${taskCount}

### Task Summary
${planTasks.map((t, i) => (i+1) + '. ' + t.title).join('\n')}

### Approach
${plan.approach}

### Plan Location
${planDir}/plan.json
Task Files: ${planDir}/.task/

Please review and approve or request revisions.`,
  summary: `Plan ready: ${taskCount} tasks`
})

// Wait for coordinator response (approve → mark completed, revision → update and resubmit)
```

### Phase 5: After Approval

```javascript
TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next PLAN task → back to Phase 1
```

## Session Files

```
{sessionFolder}/plan/
├── exploration-{angle}.json
├── explorations-manifest.json
├── planning-context.md
├── plan.json
└── .task/
    └── TASK-*.json
```

> **Note**: `sessionFolder` is extracted from task description (`Session: .workflow/.team/TLS-xxx`). Plan outputs go to `plan/` subdirectory. In full-lifecycle mode, spec products are available at `../spec/`.

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No PLAN-* tasks available | Idle, wait for coordinator assignment |
| Exploration agent failure | Skip exploration, plan from task description only |
| Planning agent failure | Fallback to direct Claude planning |
| Plan rejected 3+ times | Notify coordinator, suggest alternative approach |
| Schema file not found | Use basic plan structure without schema validation |
| Unexpected error | Log error via team_msg, report to coordinator |
