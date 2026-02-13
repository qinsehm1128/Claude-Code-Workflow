# Role File Template

Template for generating per-role execution detail files in `roles/{role-name}.md`.

## Purpose

| Phase | Usage |
|-------|-------|
| Phase 0 | Read to understand role file structure |
| Phase 3 | Apply with role-specific content |

---

## Template

```markdown
# Role: {{role_name}}

{{role_description}}

## Role Identity

- **Name**: `{{role_name}}`
- **Task Prefix**: `{{task_prefix}}-*`
- **Responsibility**: {{responsibility_type}}
- **Communication**: SendMessage to coordinator only

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
{{#each message_types}}
| `{{this.type}}` | {{../role_name}} → coordinator | {{this.trigger}} | {{this.description}} |
{{/each}}

## Execution (5-Phase)

### Phase 1: Task Discovery

\`\`\`javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('{{task_prefix}}-') &&
  t.owner === '{{role_name}}' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
\`\`\`

### Phase 2: {{phase2_name}}

{{phase2_content}}

### Phase 3: {{phase3_name}}

{{phase3_content}}

### Phase 4: {{phase4_name}}

{{phase4_content}}

### Phase 5: Report to Coordinator

\`\`\`javascript
// Log message before SendMessage
mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "{{role_name}}",
  to: "coordinator",
  type: "{{primary_message_type}}",
  summary: \`{{task_prefix}} complete: \${task.subject}\`
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: \`## {{display_name}} Results

**Task**: \${task.subject}
**Status**: \${resultStatus}

### Summary
\${resultSummary}

### Details
\${resultDetails}\`,
  summary: \`{{task_prefix}} complete\`
})

// Mark task completed
TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next task
const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('{{task_prefix}}-') &&
  t.owner === '{{role_name}}' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (nextTasks.length > 0) {
  // Continue with next task → back to Phase 1
}
\`\`\`

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No {{task_prefix}}-* tasks available | Idle, wait for coordinator assignment |
| Context/Plan file not found | Notify coordinator, request location |
{{#if adaptive_routing}}
| Sub-agent failure | Retry once, then fallback to direct execution |
{{/if}}
| Critical issue beyond scope | SendMessage fix_required to coordinator |
| Unexpected error | Log error via team_msg, report to coordinator |
```

---

## Template Sections by Responsibility Type

### Read-only analysis

**Phase 2: Context Loading**
```javascript
// Load plan for criteria reference
const planPathMatch = task.description.match(/\.workflow\/\.team-plan\/[^\s]+\/plan\.json/)
let plan = null
if (planPathMatch) {
  try { plan = JSON.parse(Read(planPathMatch[0])) } catch {}
}

// Get changed files
const changedFiles = Bash(`git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached`)
  .split('\n').filter(Boolean)

// Read file contents for analysis
const fileContents = {}
for (const file of changedFiles.slice(0, 20)) {
  try { fileContents[file] = Read(file) } catch {}
}
```

**Phase 3: Analysis Execution**
```javascript
// Core analysis logic
// Customize per specific analysis domain
```

**Phase 4: Finding Summary**
```javascript
// Classify findings by severity
const findings = {
  critical: [],
  high: [],
  medium: [],
  low: []
}
```

### Code generation

**Phase 2: Task & Plan Loading**
```javascript
const planPathMatch = task.description.match(/\.workflow\/\.team-plan\/[^\s]+\/plan\.json/)
if (!planPathMatch) {
  SendMessage({ type: "message", recipient: "coordinator",
    content: `Cannot find plan.json in ${task.subject}`, summary: "Plan not found" })
  return
}
const plan = JSON.parse(Read(planPathMatch[0]))
const planTasks = plan.task_ids.map(id =>
  JSON.parse(Read(`${planPathMatch[0].replace('plan.json', '')}.task/${id}.json`))
)
```

**Phase 3: Code Implementation**
```javascript
// Complexity-adaptive execution
if (complexity === 'Low') {
  // Direct file editing
} else {
  Task({
    subagent_type: "code-developer",
    run_in_background: false,
    description: "Implement plan tasks",
    prompt: `...`
  })
}
```

**Phase 4: Self-Validation**
```javascript
const syntaxResult = Bash(`tsc --noEmit 2>&1 || true`)
const hasSyntaxErrors = syntaxResult.includes('error TS')
```

### Orchestration

**Phase 2: Context & Complexity Assessment**
```javascript
function assessComplexity(desc) {
  let score = 0
  if (/refactor|architect|restructure|module|system/.test(desc)) score += 2
  if (/multiple|across|cross/.test(desc)) score += 2
  if (/integrate|api|database/.test(desc)) score += 1
  if (/security|performance/.test(desc)) score += 1
  return score >= 4 ? 'High' : score >= 2 ? 'Medium' : 'Low'
}
const complexity = assessComplexity(task.description)
```

**Phase 3: Orchestrated Execution**
```javascript
// Launch parallel sub-agents or sequential stages
```

**Phase 4: Result Aggregation**
```javascript
// Merge and summarize sub-agent results
```

### Validation

**Phase 2: Environment Detection**
```javascript
const changedFiles = Bash(`git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached`)
  .split('\n').filter(Boolean)
```

**Phase 3: Execution & Fix Cycle**
```javascript
// Run validation, collect failures, attempt fixes, re-validate
let iteration = 0
const MAX_ITERATIONS = 5
while (iteration < MAX_ITERATIONS) {
  const result = runValidation()
  if (result.passRate >= 0.95) break
  applyFixes(result.failures)
  iteration++
}
```

**Phase 4: Result Analysis**
```javascript
// Analyze pass/fail patterns, coverage gaps
```

---

## Coordinator Role Template

The coordinator role is special and always generated. Its template differs from worker roles:

```markdown
# Role: coordinator

Team coordinator. Orchestrates the pipeline: requirement clarification → task chain creation → dispatch → monitoring → reporting.

## Role Identity

- **Name**: `coordinator`
- **Task Prefix**: N/A (coordinator creates tasks, doesn't receive them)
- **Responsibility**: Orchestration
- **Communication**: SendMessage to all teammates

## Execution

### Phase 1: Requirement Clarification

Parse $ARGUMENTS, use AskUserQuestion for MVP scope and constraints.

### Phase 2: Create Team + Spawn Teammates

\`\`\`javascript
TeamCreate({ team_name: teamName })

// Spawn each worker role
{{#each worker_roles}}
Task({
  subagent_type: "general-purpose",
  team_name: teamName,
  name: "{{this.name}}",
  prompt: \`...Skill(skill="team-{{team_name}}", args="--role={{this.name}}")...\`
})
{{/each}}
\`\`\`

### Phase 3: Create Task Chain

\`\`\`javascript
{{task_chain_creation_code}}
\`\`\`

### Phase 4: Coordination Loop

| Received Message | Action |
|-----------------|--------|
{{#each coordination_handlers}}
| {{this.trigger}} | {{this.action}} |
{{/each}}

### Phase 5: Report + Persist

Summarize results. AskUserQuestion for next requirement or shutdown.
```

---

## Variable Reference

| Variable | Source | Description |
|----------|--------|-------------|
| `{{role_name}}` | config.role_name | Role identifier |
| `{{task_prefix}}` | config.task_prefix | UPPERCASE task prefix |
| `{{responsibility_type}}` | config.responsibility_type | Role type |
| `{{display_name}}` | config.display_name | Human-readable |
| `{{phase2_name}}` | patterns.phase_structure.phase2 | Phase 2 label |
| `{{phase3_name}}` | patterns.phase_structure.phase3 | Phase 3 label |
| `{{phase4_name}}` | patterns.phase_structure.phase4 | Phase 4 label |
| `{{phase2_content}}` | Generated from responsibility template | Phase 2 code |
| `{{phase3_content}}` | Generated from responsibility template | Phase 3 code |
| `{{phase4_content}}` | Generated from responsibility template | Phase 4 code |
| `{{message_types}}` | config.message_types | Array of message types |
| `{{primary_message_type}}` | config.message_types[0].type | Primary type |
| `{{adaptive_routing}}` | config.adaptive_routing | Boolean |
