# Phase 3: Skill Package Generation

Generate the unified team skill package: SKILL.md (role router) + roles/*.md (per-role execution).

## Objective

- Generate SKILL.md with role router and shared infrastructure
- Generate roles/coordinator.md
- Generate roles/{worker-role}.md for each worker role
- Generate specs/team-config.json
- All files written to preview directory first

## Input

- Dependency: `team-config.json` (Phase 1), `pattern-analysis.json` (Phase 2)
- Templates: `templates/skill-router-template.md`, `templates/role-template.md`
- Reference: existing team commands (read in Phase 0)

## Execution Steps

### Step 1: Load Inputs

```javascript
const config = JSON.parse(Read(`${workDir}/team-config.json`))
const analysis = JSON.parse(Read(`${workDir}/pattern-analysis.json`))
const routerTemplate = Read(`${skillDir}/templates/skill-router-template.md`)
const roleTemplate = Read(`${skillDir}/templates/role-template.md`)

// Create preview directory
const previewDir = `${workDir}/preview`
Bash(`mkdir -p "${previewDir}/roles" "${previewDir}/specs"`)
```

### Step 2: Generate SKILL.md (Role Router)

This is the unified entry point. All roles invoke this skill with `--role=xxx`.

```javascript
const rolesTable = config.roles.map(r =>
  `| \`${r.name}\` | ${r.task_prefix || 'N/A'} | ${r.description} | [roles/${r.name}.md](roles/${r.name}.md) |`
).join('\n')

const roleDispatchEntries = config.roles.map(r =>
  `  "${r.name}": { file: "roles/${r.name}.md", prefix: "${r.task_prefix || 'N/A'}" }`
).join(',\n')

const messageBusTable = config.worker_roles.map(r =>
  `| ${r.name} | ${r.message_types.map(mt => '\`' + mt.type + '\`').join(', ')} |`
).join('\n')

const spawnBlocks = config.worker_roles.map(r => `
// ${r.display_name}
Task({
  subagent_type: "general-purpose",
  team_name: teamName,
  name: "${r.name}",
  prompt: \`你是 team "\${teamName}" 的 ${r.name_upper}。

当你收到 ${r.task_prefix}-* 任务时，调用 Skill(skill="${config.skill_name}", args="--role=${r.name}") 执行。

当前需求: \${taskDescription}
约束: \${constraints}

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录：
mcp__ccw-tools__team_msg({ operation: "log", team: "\${teamName}", from: "${r.name}", to: "coordinator", type: "<type>", summary: "<摘要>" })

工作流程:
1. TaskList → 找到 ${r.task_prefix}-* 任务
2. Skill(skill="${config.skill_name}", args="--role=${r.name}") 执行
3. team_msg log + SendMessage 结果给 coordinator
4. TaskUpdate completed → 检查下一个任务\`
})`).join('\n')

const skillMd = `---
name: ${config.skill_name}
description: Unified team skill for ${config.team_name} team. All roles invoke this skill with --role arg. Triggers on "team ${config.team_name}".
allowed-tools: ${config.all_roles_tools_union}
---

# Team ${config.team_display_name}

Unified team skill. All team members invoke this skill with \`--role=xxx\` for role-specific execution.

## Architecture Overview

\`\`\`
┌───────────────────────────────────────────┐
│  Skill(skill="${config.skill_name}")       │
│  args="--role=xxx"                        │
└───────────────┬───────────────────────────┘
                │ Role Router
    ┌───────────┼${'───────────┬'.repeat(Math.min(config.roles.length - 1, 3))}
    ${config.roles.map(r => `↓           `).join('').trim()}
${config.roles.map(r => `┌──────────┐ `).join('').trim()}
${config.roles.map(r => `│${r.name.padEnd(10)}│ `).join('').trim()}
${config.roles.map(r => `│ roles/   │ `).join('').trim()}
${config.roles.map(r => `└──────────┘ `).join('').trim()}
\`\`\`

## Role Router

### Input Parsing

Parse \`$ARGUMENTS\` to extract \`--role\`:

\`\`\`javascript
const args = "$ARGUMENTS"
const roleMatch = args.match(/--role[=\\s]+(\\w+)/)

if (!roleMatch) {
  throw new Error("Missing --role argument. Available roles: ${config.role_list}")
}

const role = roleMatch[1]
const teamName = "${config.team_name}"
\`\`\`

### Role Dispatch

\`\`\`javascript
const VALID_ROLES = {
${roleDispatchEntries}
}

if (!VALID_ROLES[role]) {
  throw new Error(\\\`Unknown role: \\\${role}. Available: \\\${Object.keys(VALID_ROLES).join(', ')}\\\`)
}

// Read and execute role-specific logic
Read(VALID_ROLES[role].file)
// → Execute the 5-phase process defined in that file
\`\`\`

### Available Roles

| Role | Task Prefix | Responsibility | Role File |
|------|-------------|----------------|-----------|
${rolesTable}

## Shared Infrastructure

### Team Configuration

\`\`\`javascript
const TEAM_CONFIG = {
  name: "${config.team_name}",
  sessionDir: ".workflow/.team-plan/${config.team_name}/",
  msgDir: ".workflow/.team-msg/${config.team_name}/"
}
\`\`\`

### Message Bus (All Roles)

Every SendMessage **before**, must call \`mcp__ccw-tools__team_msg\`:

\`\`\`javascript
mcp__ccw-tools__team_msg({
  operation: "log",
  team: "${config.team_name}",
  from: role,
  to: "coordinator",
  type: "<type>",
  summary: "<summary>"
})
\`\`\`

**Message types by role**:

| Role | Types |
|------|-------|
${messageBusTable}

### CLI 回退

\`\`\`javascript
Bash(\\\`ccw team log --team "${config.team_name}" --from "\\\${role}" --to "coordinator" --type "<type>" --summary "<摘要>" --json\\\`)
\`\`\`

### Task Lifecycle (All Roles)

\`\`\`javascript
// Phase 1: Discovery
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith(\\\`\\\${VALID_ROLES[role].prefix}-\\\`) &&
  t.owner === role &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)
if (myTasks.length === 0) return
const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })

// Phase 2-4: Role-specific (see roles/{role}.md)

// Phase 5: Report + Loop
TaskUpdate({ taskId: task.id, status: 'completed' })
\`\`\`

## Pipeline

\`\`\`
${config.pipeline.diagram}
\`\`\`

## Coordinator Spawn Template

\`\`\`javascript
TeamCreate({ team_name: "${config.team_name}" })
${spawnBlocks}
\`\`\`

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Unknown --role value | Error with available role list |
| Missing --role arg | Error with usage hint |
| Role file not found | Error with expected path |
`

Write(`${previewDir}/SKILL.md`, skillMd)
```

### Step 3: Generate Coordinator Role File

```javascript
const taskChainCode = config.pipeline.stages.map((stage, i) => {
  const blockedByIds = stage.blockedBy.map(dep => {
    const depIdx = config.pipeline.stages.findIndex(s => s.name === dep)
    return `\${task${depIdx}Id}`
  })

  return `TaskCreate({ subject: "${stage.name}-001: ${stage.role} work", description: \`\${taskDescription}\`, activeForm: "${stage.name}进行中" })
TaskUpdate({ taskId: task${i}Id, owner: "${stage.role}"${blockedByIds.length > 0 ? `, addBlockedBy: [${blockedByIds.join(', ')}]` : ''} })`
}).join('\n\n')

const coordinationHandlers = config.worker_roles.map(r => {
  const resultType = r.message_types.find(mt => !mt.type.includes('error') && !mt.type.includes('progress'))
  return `| ${r.name_upper}: ${resultType?.trigger || 'work complete'} | team_msg log → TaskUpdate ${r.task_prefix} completed → check next |`
}).join('\n')

const coordinatorMd = `# Role: coordinator

Team coordinator. Orchestrates pipeline: requirement clarification → team creation → task chain → dispatch → monitoring → reporting.

## Role Identity

- **Name**: \`coordinator\`
- **Task Prefix**: N/A (creates tasks, doesn't receive them)
- **Responsibility**: Orchestration
- **Communication**: SendMessage to all teammates

## Message Types

| Type | Direction | Trigger |
|------|-----------|---------|
| \`plan_approved\` | coordinator → planner | Plan approved |
| \`plan_revision\` | coordinator → planner | Revision requested |
| \`task_unblocked\` | coordinator → worker | Task dependency met |
| \`shutdown\` | coordinator → all | Team shutdown |
| \`error\` | coordinator → user | Coordination error |

## Execution

### Phase 1: Requirement Clarification

Parse \`$ARGUMENTS\` for task description. Use AskUserQuestion for:
- MVP scope (minimal / full / comprehensive)
- Key constraints (backward compatible / follow patterns / test coverage)

Simple tasks can skip clarification.

### Phase 2: Create Team + Spawn Teammates

\`\`\`javascript
TeamCreate({ team_name: "${config.team_name}" })

${spawnBlocks}
\`\`\`

### Phase 3: Create Task Chain

\`\`\`javascript
${taskChainCode}
\`\`\`

### Phase 4: Coordination Loop

Receive teammate messages, dispatch based on content.
**Before each decision**: \`team_msg list\` to check recent messages.
**After each decision**: \`team_msg log\` to record.

| Received Message | Action |
|-----------------|--------|
${coordinationHandlers}
| Worker: error | Assess severity → retry or escalate to user |
| All tasks completed | → Phase 5 |

### Phase 5: Report + Persist

Summarize changes, test results, review findings.

\`\`\`javascript
AskUserQuestion({
  questions: [{
    question: "当前需求已完成。下一步：",
    header: "Next",
    multiSelect: false,
    options: [
      { label: "新需求", description: "提交新需求给当前团队" },
      { label: "关闭团队", description: "关闭所有 teammate 并清理" }
    ]
  }]
})
// 新需求 → 回到 Phase 1
// 关闭 → shutdown → TeamDelete()
\`\`\`

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Teammate unresponsive | Send follow-up, 2x → respawn |
| Plan rejected 3+ times | Coordinator self-plans |
| Test stuck >5 iterations | Escalate to user |
| Review finds critical | Create fix task for executor |
`

Write(`${previewDir}/roles/coordinator.md`, coordinatorMd)
```

### Step 4: Generate Worker Role Files

For each worker role, generate a complete role file with 5-phase execution.

```javascript
for (const role of config.worker_roles) {
  const ra = analysis.role_analysis.find(r => r.role_name === role.name)

  // Phase 2 content based on responsibility type
  const phase2Content = {
    "Read-only analysis": `\`\`\`javascript
// Load plan for criteria reference
const planPathMatch = task.description.match(/\\.workflow\\/\\.team-plan\\/[^\\s]+\\/plan\\.json/)
let plan = null
if (planPathMatch) {
  try { plan = JSON.parse(Read(planPathMatch[0])) } catch {}
}

// Get changed files
const changedFiles = Bash(\`git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached\`)
  .split('\\n').filter(Boolean)

// Read file contents for analysis
const fileContents = {}
for (const file of changedFiles.slice(0, 20)) {
  try { fileContents[file] = Read(file) } catch {}
}
\`\`\``,

    "Code generation": `\`\`\`javascript
// Extract plan path from task description
const planPathMatch = task.description.match(/\\.workflow\\/\\.team-plan\\/[^\\s]+\\/plan\\.json/)
if (!planPathMatch) {
  mcp__ccw-tools__team_msg({ operation: "log", team: "${config.team_name}", from: "${role.name}", to: "coordinator", type: "error", summary: "plan.json路径无效" })
  SendMessage({ type: "message", recipient: "coordinator", content: \`Cannot find plan.json in \${task.subject}\`, summary: "Plan not found" })
  return
}

const plan = JSON.parse(Read(planPathMatch[0]))
const planTasks = plan.task_ids.map(id =>
  JSON.parse(Read(\`\${planPathMatch[0].replace('plan.json', '')}.task/\${id}.json\`))
)
\`\`\``,

    "Orchestration": `\`\`\`javascript
function assessComplexity(desc) {
  let score = 0
  if (/refactor|architect|restructure|module|system/.test(desc)) score += 2
  if (/multiple|across|cross/.test(desc)) score += 2
  if (/integrate|api|database/.test(desc)) score += 1
  if (/security|performance/.test(desc)) score += 1
  return score >= 4 ? 'High' : score >= 2 ? 'Medium' : 'Low'
}

const complexity = assessComplexity(task.description)
\`\`\``,

    "Validation": `\`\`\`javascript
// Detect changed files for validation scope
const changedFiles = Bash(\`git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached\`)
  .split('\\n').filter(Boolean)
\`\`\``
  }

  // Phase 3 content based on responsibility type
  const phase3Content = {
    "Read-only analysis": `\`\`\`javascript
// Core analysis logic
// Reference: .claude/commands/team/${ra.similar_to.primary}.md Phase 3

// Analyze each file
for (const [file, content] of Object.entries(fileContents)) {
  // Domain-specific analysis
}
\`\`\``,

    "Code generation": `\`\`\`javascript
// Reference: .claude/commands/team/${ra.similar_to.primary}.md Phase 3

${role.adaptive_routing ? `// Complexity-adaptive execution
if (planTasks.length <= 2) {
  // Direct file editing
  for (const pt of planTasks) {
    for (const f of (pt.files || [])) {
      const content = Read(f.path)
      Edit({ file_path: f.path, old_string: "...", new_string: "..." })
    }
  }
} else {
  // Delegate to code-developer sub-agent
  Task({
    subagent_type: "code-developer",
    run_in_background: false,
    description: \`Implement \${planTasks.length} tasks\`,
    prompt: \`## Goal
\${plan.summary}

## Tasks
\${planTasks.map(t => \`### \${t.title}\\n\${t.description}\`).join('\\n\\n')}

Complete each task according to its convergence criteria.\`
  })
}` : `// Direct execution
for (const pt of planTasks) {
  for (const f of (pt.files || [])) {
    const content = Read(f.path)
    Edit({ file_path: f.path, old_string: "...", new_string: "..." })
  }
}`}
\`\`\``,

    "Orchestration": `\`\`\`javascript
// Reference: .claude/commands/team/${ra.similar_to.primary}.md Phase 3

${role.adaptive_routing ? `if (complexity === 'Low') {
  // Direct execution with mcp__ace-tool__search_context + Grep/Glob
} else {
  // Launch sub-agents for complex work
  Task({
    subagent_type: "universal-executor",
    run_in_background: false,
    description: "${role.name} orchestration",
    prompt: \`Execute ${role.name} work for: \${task.description}\`
  })
}` : `// Direct orchestration`}
\`\`\``,

    "Validation": `\`\`\`javascript
// Reference: .claude/commands/team/${ra.similar_to.primary}.md Phase 3

let iteration = 0
const MAX_ITERATIONS = 5
while (iteration < MAX_ITERATIONS) {
  // Run validation
  const result = Bash(\`npm test 2>&1 || true\`)
  const passed = !result.includes('FAIL')

  if (passed) break

  // Attempt fix
  iteration++
  if (iteration < MAX_ITERATIONS) {
    // Auto-fix or delegate
  }
}
\`\`\``
  }

  // Phase 4 content
  const phase4Content = {
    "Read-only analysis": `\`\`\`javascript
// Classify findings by severity
const findings = { critical: [], high: [], medium: [], low: [] }
// ... populate findings from Phase 3 analysis
\`\`\``,

    "Code generation": `\`\`\`javascript
// Self-validation
const syntaxResult = Bash(\`tsc --noEmit 2>&1 || true\`)
const hasSyntaxErrors = syntaxResult.includes('error TS')
if (hasSyntaxErrors) {
  // Attempt auto-fix
}
\`\`\``,

    "Orchestration": `\`\`\`javascript
// Aggregate results from sub-agents
const aggregated = {
  // Merge findings, results, outputs
}
\`\`\``,

    "Validation": `\`\`\`javascript
// Analyze results
const resultSummary = {
  iterations: iteration,
  passed: iteration < MAX_ITERATIONS,
  // Coverage, pass rate, etc.
}
\`\`\``
  }

  const msgTypesTable = role.message_types.map(mt =>
    `| \`${mt.type}\` | ${role.name} → coordinator | ${mt.trigger} |`
  ).join('\n')

  const primaryMsgType = role.message_types.find(mt => !mt.type.includes('error') && !mt.type.includes('progress'))?.type || `${role.name}_complete`

  const roleMd = `# Role: ${role.name}

${role.description}

## Role Identity

- **Name**: \`${role.name}\`
- **Task Prefix**: \`${role.task_prefix}-*\`
- **Responsibility**: ${role.responsibility_type}
- **Communication**: SendMessage to coordinator only

## Message Types

| Type | Direction | Trigger |
|------|-----------|---------|
${msgTypesTable}

## Execution (5-Phase)

### Phase 1: Task Discovery

\`\`\`javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('${role.task_prefix}-') &&
  t.owner === '${role.name}' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
\`\`\`

### Phase 2: ${ra.phase_structure.phase2}

${phase2Content[role.responsibility_type]}

### Phase 3: ${ra.phase_structure.phase3}

${phase3Content[role.responsibility_type]}

### Phase 4: ${ra.phase_structure.phase4}

${phase4Content[role.responsibility_type]}

### Phase 5: Report to Coordinator

\`\`\`javascript
mcp__ccw-tools__team_msg({
  operation: "log",
  team: "${config.team_name}",
  from: "${role.name}",
  to: "coordinator",
  type: "${primaryMsgType}",
  summary: \`${role.task_prefix} complete: \${task.subject}\`
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: \`## ${role.display_name} Results

**Task**: \${task.subject}
**Status**: \${resultStatus}

### Summary
\${resultSummary}

### Details
\${resultDetails}\`,
  summary: \`${role.task_prefix} complete\`
})

TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next task
const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('${role.task_prefix}-') &&
  t.owner === '${role.name}' &&
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
| No ${role.task_prefix}-* tasks available | Idle, wait for coordinator |
| Context/Plan file not found | Notify coordinator |
${role.adaptive_routing ? '| Sub-agent failure | Retry once, fallback to direct |\n' : ''}| Critical issue beyond scope | SendMessage fix_required |
| Unexpected error | Log via team_msg, report |
`

  Write(`${previewDir}/roles/${role.name}.md`, roleMd)
}
```

### Step 5: Generate specs/team-config.json

```javascript
Write(`${previewDir}/specs/team-config.json`, JSON.stringify({
  team_name: config.team_name,
  skill_name: config.skill_name,
  pipeline_type: config.pipeline_type,
  pipeline: config.pipeline,
  roles: config.roles.map(r => ({
    name: r.name,
    task_prefix: r.task_prefix,
    responsibility_type: r.responsibility_type,
    description: r.description
  })),
  collaboration_patterns: analysis.collaboration_patterns,
  generated_at: new Date().toISOString()
}, null, 2))
```

## Output

- **Directory**: `{workDir}/preview/`
- **Files**:
  - `preview/SKILL.md` - Role router + shared infrastructure
  - `preview/roles/coordinator.md` - Coordinator execution
  - `preview/roles/{role}.md` - Per-worker role execution
  - `preview/specs/team-config.json` - Team configuration

## Quality Checklist

- [ ] SKILL.md contains role router with all roles
- [ ] SKILL.md contains shared infrastructure (message bus, task lifecycle)
- [ ] SKILL.md contains coordinator spawn template
- [ ] Every role has a file in roles/
- [ ] Every role file has 5-phase execution
- [ ] Every role file has message types table
- [ ] Every role file has error handling
- [ ] team-config.json is valid JSON

## Next Phase

-> [Phase 4: Integration Verification](04-integration-verification.md)
