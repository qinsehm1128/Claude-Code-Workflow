# Phase 3: Command Generation

Generate the team command .md file using template and pattern analysis results.

## Objective

- Apply command template with role-specific content
- Generate complete YAML front matter
- Generate message bus section
- Generate 5-phase implementation with code
- Generate error handling table
- Output final command file

## Input

- Dependency: `role-config.json` (Phase 1), `applicable-patterns.json` (Phase 2)
- Template: `templates/command-template.md`

## Execution Steps

### Step 1: Load Inputs

```javascript
const config = JSON.parse(Read(`${workDir}/role-config.json`))
const patterns = JSON.parse(Read(`${workDir}/applicable-patterns.json`))
const template = Read(`${skillDir}/templates/command-template.md`)

// Read most similar command for code reference
// Note: reference may be in a folder (e.g. .claude/commands/team/folder/cmd.md) if config.output_folder is set
const refCommand = Read(`.claude/commands/team/${patterns.similar_to.primary}.md`)
```

### Step 2: Generate YAML Front Matter

```javascript
const frontMatter = `---
name: ${config.role_name}
description: ${config.description_cn}
argument-hint: ""
allowed-tools: ${config.allowed_tools.join(', ')}
group: team
---`
```

### Step 3: Generate Message Bus Section

```javascript
const messageBusSection = `## Message Bus

Every SendMessage **before**, must call \`mcp__ccw-tools__team_msg\` to log:

\`\`\`javascript
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "${config.role_name}", to: "coordinator", type: "<type>", summary: "<summary>" })
\`\`\`

### Supported Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
${config.message_types.map(mt =>
  `| \`${mt.type}\` | ${config.role_name} -> coordinator | ${mt.trigger} | ${mt.description || mt.trigger} |`
).join('\n')}

### Examples

\`\`\`javascript
${config.message_types.filter(mt => mt.type !== 'error').map(mt =>
  `// ${mt.trigger}
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "${config.role_name}", to: "coordinator", type: "${mt.type}", summary: "${mt.trigger}" })`
).join('\n\n')}
\`\`\`

### CLI 回退

当 \`mcp__ccw-tools__team_msg\` MCP 不可用时，使用 \`ccw team\` CLI 作为等效回退：

\\\`\\\`\\\`javascript
// 回退: 将 MCP 调用替换为 Bash CLI（参数一一对应）
Bash(\\\`ccw team log --team "\${teamName}" --from "${config.role_name}" --to "coordinator" --type "${config.message_types[0]?.type || 'result'}" --summary "<摘要>" --json\\\`)
\\\`\\\`\\\`

**参数映射**: \`team_msg(params)\` → \`ccw team log --team <team> --from ${config.role_name} --to coordinator --type <type> --summary "<text>" [--ref <path>] [--data '<json>'] [--json]\``
```

### Step 4: Generate Phase Implementations

```javascript
// Phase 1: Task Discovery (standard for all roles)
const phase1 = `### Phase 1: Task Discovery

\`\`\`javascript
// Find assigned ${config.task_prefix}-* tasks
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('${config.task_prefix}-') &&
  t.owner === '${config.role_name}' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
\`\`\``

// Phase 2: Context Loading (adapted by responsibility type)
const phase2Templates = {
  "Read-only analysis": `### Phase 2: Context Loading

\`\`\`javascript
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

  "Code generation": `### Phase 2: Task & Plan Loading

\`\`\`javascript
// Extract plan path from task description
const planPathMatch = task.description.match(/\\.workflow\\/\\.team-plan\\/[^\\s]+\\/plan\\.json/)
if (!planPathMatch) {
  SendMessage({ type: "message", recipient: "coordinator",
    content: \`Cannot find plan.json path in task \${task.subject}\`,
    summary: "Plan path not found" })
  return
}

const plan = JSON.parse(Read(planPathMatch[0]))
// Load task files from .task/ directory
const planTasks = plan.task_ids.map(id =>
  JSON.parse(Read(\`\${planPathMatch[0].replace('plan.json', '')}.task/\${id}.json\`))
)
\`\`\``,

  "Orchestration": `### Phase 2: Context & Complexity Assessment

\`\`\`javascript
// Assess task complexity
function assessComplexity(desc) {
  let score = 0
  if (/refactor|architect|restructure|module|system/.test(desc)) score += 2
  if (/multiple|across|cross/.test(desc)) score += 2
  if (/integrate|api|database/.test(desc)) score += 1
  if (/security|performance/.test(desc)) score += 1
  return score >= 4 ? 'High' : score >= 2 ? 'Medium' : 'Low'
}

const complexity = assessComplexity(task.description)

// Load related context
const projectTech = Bash(\`test -f .workflow/project-tech.json && cat .workflow/project-tech.json || echo "{}"\`)
\`\`\``,

  "Validation": `### Phase 2: Environment Detection

\`\`\`javascript
// Detect relevant tools/frameworks
// (customize based on specific validation domain)
const changedFiles = Bash(\`git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached\`)
  .split('\\n').filter(Boolean)

// Load context based on validation type
\`\`\``
}

const phase2 = phase2Templates[config.responsibility_type]

// Phase 3: Core Work (role-specific, provides skeleton)
const phase3 = `### Phase 3: ${patterns.phase_structure.phase3}

\`\`\`javascript
// Core ${config.role_name} logic
// TODO: Implement based on role requirements
// Reference: .claude/commands/team/${patterns.similar_to.primary}.md Phase 3

${config.adaptive_routing ? `
// Complexity-adaptive execution
if (complexity === 'Low') {
  // Direct execution
} else {
  // Delegate to sub-agent
  Task({
    subagent_type: "universal-executor",
    run_in_background: false,
    description: "${config.role_name} work",
    prompt: \`
## Task
\${task.description}

## MANDATORY FIRST STEPS
1. Read: .workflow/project-tech.json (if exists)
2. Read: .workflow/project-guidelines.json (if exists)

## Expected Output
\${expectedFormat}
\`
  })
}` : `// Direct execution for all tasks`}
\`\`\``

// Phase 4: Validation/Summary
const phase4 = `### Phase 4: ${patterns.phase_structure.phase4}

\`\`\`javascript
// Validate/summarize results
// TODO: Implement based on role requirements
// Reference: .claude/commands/team/${patterns.similar_to.primary}.md Phase 4
\`\`\``

// Phase 5: Report + Loop (standard for all roles)
const phase5 = `### Phase 5: Report to Coordinator

\`\`\`javascript
// Log message before SendMessage
mcp__ccw-tools__team_msg({
  operation: "log", team: teamName,
  from: "${config.role_name}", to: "coordinator",
  type: "${config.message_types[0]?.type || config.role_name + '_complete'}",
  summary: \`${config.task_prefix} complete: \${task.subject}\`
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: \`## ${config.display_name} Results

**Task**: \${task.subject}
**Status**: \${resultStatus}

### Summary
\${resultSummary}

### Details
\${resultDetails}\`,
  summary: \`${config.task_prefix} complete\`
})

// Mark task completed
TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next task
const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('${config.task_prefix}-') &&
  t.owner === '${config.role_name}' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (nextTasks.length > 0) {
  // Continue with next task -> back to Phase 1
}
\`\`\``
```

### Step 5: Generate Error Handling Table

```javascript
const errorTable = `## Error Handling

| Scenario | Resolution |
|----------|------------|
| No ${config.task_prefix}-* tasks available | Idle, wait for coordinator assignment |
| Plan/Context file not found | Notify coordinator, request location |
${config.adaptive_routing ? '| Sub-agent failure | Retry once, then fallback to direct execution |\n' : ''}| Max iterations exceeded | Report to coordinator, suggest intervention |
| Critical issue beyond scope | SendMessage fix_required to coordinator |
| Unexpected error | Log error via team_msg, report to coordinator |`
```

### Step 6: Assemble Final Command File

```javascript
const commandContent = `${frontMatter}

# Team ${config.display_name} Command (/${config.skill_path})

## Overview

Team ${config.role_name} role command. Operates as a teammate within an Agent Team, responsible for ${config.responsibility_type.toLowerCase()}.

**Core capabilities:**
- Task discovery from shared team task list (${config.task_prefix}-* tasks)
${patterns.core_patterns.includes('pattern-5-complexity-adaptive') ? '- Complexity-adaptive routing (Low -> direct, Medium/High -> agent)\n' : ''}- ${config.responsibility_type}-specific processing
- Structured result reporting to coordinator

## Role Definition

**Name**: \`${config.role_name}\`
**Responsibility**: ${patterns.phase_structure.phase2} -> ${patterns.phase_structure.phase3} -> ${patterns.phase_structure.phase5}
**Communication**: SendMessage to coordinator only

${messageBusSection}

## Execution Process

\`\`\`
Phase 1: Task Discovery
   ├─ TaskList to find unblocked ${config.task_prefix}-* tasks
   ├─ TaskGet to read full task details
   └─ TaskUpdate to mark in_progress

Phase 2: ${patterns.phase_structure.phase2}

Phase 3: ${patterns.phase_structure.phase3}

Phase 4: ${patterns.phase_structure.phase4}

Phase 5: ${patterns.phase_structure.phase5}
   ├─ team_msg log + SendMessage results
   ├─ TaskUpdate completed
   └─ Check for next ${config.task_prefix}-* task
\`\`\`

## Implementation

${phase1}

${phase2}

${phase3}

${phase4}

${phase5}

${errorTable}
`

Write(`${workDir}/${config.role_name}.md`, commandContent)
```

## Output

- **File**: `{role-name}.md`
- **Format**: Markdown
- **Location**: `{workDir}/{role-name}.md`

## Quality Checklist

- [ ] YAML front matter includes all required fields
- [ ] `group: team` is present
- [ ] Message bus section has team_msg examples
- [ ] All 5 phases are present with implementation code
- [ ] Task lifecycle follows standard pattern
- [ ] Error handling table is present
- [ ] SendMessage always preceded by team_msg
- [ ] Role communicates only with coordinator

## Next Phase

-> [Phase 4: Integration Verification](04-integration-verification.md)
