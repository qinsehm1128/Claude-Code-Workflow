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
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "planner", to: "coordinator", type: "plan_ready", summary: "Plan ready: 3 tasks, Medium complexity", ref: `${sessionFolder}/plan.json` })

// Plan revision
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "planner", to: "coordinator", type: "plan_revision", summary: "Split task-2 into two subtasks per feedback" })

// Error report
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "planner", to: "coordinator", type: "error", summary: "plan-overview-base-schema.json not found, using default structure" })
```

### CLI Fallback

When `mcp__ccw-tools__team_msg` MCP is unavailable:

```javascript
Bash(`ccw team log --team "${teamName}" --from "planner" --to "coordinator" --type "plan_ready" --summary "Plan ready: 3 tasks" --ref "${sessionFolder}/plan.json" --json`)
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

### Phase 2: Multi-Angle Exploration

```javascript
// Session setup
const taskSlug = task.subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40)
const dateStr = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().substring(0, 10)
const sessionFolder = `.workflow/.team-plan/${taskSlug}-${dateStr}`
Bash(`mkdir -p ${sessionFolder}`)

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
  Write(`${sessionFolder}/exploration-${selectedAngles[0]}.json`, JSON.stringify({
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
**Output File**: ${sessionFolder}/exploration-${angle}.json

## Assigned Context
- **Exploration Angle**: ${angle}
- **Task Description**: ${task.description}
- **Exploration Index**: ${index + 1} of ${selectedAngles.length}

## MANDATORY FIRST STEPS
1. Run: rg -l "{relevant_keyword}" --type ts (locate relevant files)
2. Execute: cat ~/.ccw/workflows/cli-templates/schemas/explore-json-schema.json (get output schema)
3. Read: .workflow/project-tech.json (if exists - technology stack)

## Expected Output
Write JSON to: ${sessionFolder}/exploration-${angle}.json
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
    path: `${sessionFolder}/exploration-${angle}.json`
  }))
}
Write(`${sessionFolder}/explorations-manifest.json`, JSON.stringify(explorationManifest, null, 2))
```

### Phase 3: Plan Generation

```javascript
// Read schema reference
const schema = Bash(`cat ~/.ccw/workflows/cli-templates/schemas/plan-overview-base-schema.json`)

if (complexity === 'Low') {
  // Direct Claude planning
  Bash(`mkdir -p ${sessionFolder}/.task`)
  // Generate plan.json + .task/TASK-*.json following schemas
} else {
  // Use cli-lite-planning-agent for Medium/High
  Task({
    subagent_type: "cli-lite-planning-agent",
    run_in_background: false,
    description: "Generate detailed implementation plan",
    prompt: `Generate implementation plan.
Output: ${sessionFolder}/plan.json + ${sessionFolder}/.task/TASK-*.json
Schema: cat ~/.ccw/workflows/cli-templates/schemas/plan-overview-base-schema.json
Task Description: ${task.description}
Explorations: ${explorationManifest}
Complexity: ${complexity}
Requirements: 2-7 tasks, each with id, title, files[].change, convergence.criteria, depends_on`
  })
}
```

### Phase 4: Submit for Approval

```javascript
const plan = JSON.parse(Read(`${sessionFolder}/plan.json`))
const planTasks = plan.task_ids.map(id => JSON.parse(Read(`${sessionFolder}/.task/${id}.json`)))
const taskCount = plan.task_count || plan.task_ids.length

mcp__ccw-tools__team_msg({
  operation: "log", team: teamName,
  from: "planner", to: "coordinator",
  type: "plan_ready",
  summary: `Plan就绪: ${taskCount}个task, ${complexity}复杂度`,
  ref: `${sessionFolder}/plan.json`
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
${sessionFolder}/plan.json
Task Files: ${sessionFolder}/.task/

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
.workflow/.team-plan/{task-slug}-{YYYY-MM-DD}/
├── exploration-{angle}.json
├── explorations-manifest.json
├── planning-context.md
├── plan.json
└── .task/
    └── TASK-*.json
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No PLAN-* tasks available | Idle, wait for coordinator assignment |
| Exploration agent failure | Skip exploration, plan from task description only |
| Planning agent failure | Fallback to direct Claude planning |
| Plan rejected 3+ times | Notify coordinator, suggest alternative approach |
| Schema file not found | Use basic plan structure without schema validation |
| Unexpected error | Log error via team_msg, report to coordinator |
