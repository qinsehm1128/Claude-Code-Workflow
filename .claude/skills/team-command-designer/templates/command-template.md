# Team Command Template

Ready-to-use template for generating team command .md files.

## Purpose

Provide a complete, fill-in-the-blanks template for generating new team command files that comply with all design patterns.

## Usage Context

| Phase | Usage |
|-------|-------|
| Phase 0 | Read to understand output structure |
| Phase 3 | Apply with role-specific content |

---

## Template

```markdown
---
name: {{role_name}}
description: Team {{role_name}} - {{description_cn}}
argument-hint: ""
allowed-tools: {{allowed_tools}}
group: team
---

# Team {{display_name}} Command (/{{skill_path}})

## Overview

Team {{role_name}} role command. Operates as a teammate within an Agent Team, responsible for {{responsibility_type}}.

**Core capabilities:**
- Task discovery from shared team task list ({{task_prefix}}-* tasks)
{{#if adaptive_routing}}
- Complexity-adaptive routing (Low -> direct, Medium/High -> agent)
{{/if}}
- {{responsibility_type}}-specific processing
- Structured result reporting to coordinator

## Role Definition

**Name**: `{{role_name}}`
**Responsibility**: {{phase2_name}} -> {{phase3_name}} -> Report results
**Communication**: SendMessage to coordinator only

## Message Bus

Every SendMessage **before**, must call `mcp__ccw-tools__team_msg` to log:

\`\`\`javascript
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "{{role_name}}", to: "coordinator", type: "<type>", summary: "<summary>" })
\`\`\`

### Supported Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
{{#each message_types}}
| `{{this.type}}` | {{../role_name}} -> coordinator | {{this.trigger}} | {{this.description}} |
{{/each}}

### Examples

\`\`\`javascript
{{#each message_types}}
// {{this.trigger}}
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "{{../role_name}}", to: "coordinator", type: "{{this.type}}", summary: "{{this.trigger}}" })
{{/each}}
\`\`\`

### CLI 回退

当 `mcp__ccw-tools__team_msg` MCP 不可用时，使用 `ccw team` CLI 作为等效回退：

\`\`\`javascript
// 回退: 将 MCP 调用替换为 Bash CLI（参数一一对应）
Bash(\`ccw team log --team "${teamName}" --from "{{role_name}}" --to "coordinator" --type "{{primary_message_type}}" --summary "<摘要>" --json\`)
\`\`\`

**参数映射**: `team_msg(params)` → `ccw team log --team <team> --from {{role_name}} --to coordinator --type <type> --summary "<text>" [--ref <path>] [--data '<json>'] [--json]`

## Execution Process

\`\`\`
Phase 1: Task Discovery
   |-- TaskList to find unblocked {{task_prefix}}-* tasks
   |-- TaskGet to read full task details
   \`-- TaskUpdate to mark in_progress

Phase 2: {{phase2_name}}

Phase 3: {{phase3_name}}

Phase 4: {{phase4_name}}

Phase 5: Report to Coordinator
   |-- team_msg log + SendMessage results
   |-- TaskUpdate completed
   \`-- Check for next {{task_prefix}}-* task
\`\`\`

## Implementation

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

\`\`\`javascript
// TODO: Implement context loading for {{role_name}}
// Reference: .claude/commands/team/{{reference_command}}.md Phase 2
\`\`\`

### Phase 3: {{phase3_name}}

\`\`\`javascript
// TODO: Implement core {{role_name}} logic
// Reference: .claude/commands/team/{{reference_command}}.md Phase 3
{{#if adaptive_routing}}

// Complexity-adaptive execution
if (complexity === 'Low') {
  // Direct execution
} else {
  // Delegate to sub-agent
  Task({
    subagent_type: "universal-executor",
    run_in_background: false,
    description: "{{role_name}} work",
    prompt: `Execute {{role_name}} task: ${task.description}`
  })
}
{{/if}}
\`\`\`

### Phase 4: {{phase4_name}}

\`\`\`javascript
// TODO: Implement validation/summary for {{role_name}}
// Reference: .claude/commands/team/{{reference_command}}.md Phase 4
\`\`\`

### Phase 5: Report to Coordinator

\`\`\`javascript
mcp__ccw-tools__team_msg({
  operation: "log", team: teamName,
  from: "{{role_name}}", to: "coordinator",
  type: "{{primary_message_type}}",
  summary: `{{task_prefix}} complete: ${task.subject}`
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## {{display_name}} Results

**Task**: ${task.subject}
**Status**: ${resultStatus}

### Summary
${resultSummary}`,
  summary: `{{task_prefix}} complete`
})

TaskUpdate({ taskId: task.id, status: 'completed' })

const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('{{task_prefix}}-') &&
  t.owner === '{{role_name}}' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (nextTasks.length > 0) {
  // Continue with next task -> back to Phase 1
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

## Variable Reference

| Variable | Source | Description |
|----------|--------|-------------|
| `{{team_name}}` | config.team_name | Team folder name (lowercase) |
| `{{role_name}}` | config.role_name | Role identifier (lowercase) |
| `{{skill_path}}` | config.skill_path | Full skill path (e.g., `team:spec:analyst`) |
| `{{display_name}}` | config.display_name | Human-readable role name |
| `{{description_cn}}` | config.description_cn | Chinese description |
| `{{task_prefix}}` | config.task_prefix | Task prefix (UPPERCASE) |
| `{{allowed_tools}}` | config.allowed_tools | Tool list |
| `{{responsibility_type}}` | config.responsibility_type | Role type |
| `{{adaptive_routing}}` | config.adaptive_routing | Boolean |
| `{{message_types}}` | config.message_types | Array of message type objects |
| `{{phase2_name}}` | patterns.phase_structure.phase2 | Phase 2 name |
| `{{phase3_name}}` | patterns.phase_structure.phase3 | Phase 3 name |
| `{{phase4_name}}` | patterns.phase_structure.phase4 | Phase 4 name |
| `{{reference_command}}` | patterns.similar_to.primary | Most similar existing command |
| `{{primary_message_type}}` | config.message_types[0].type | Primary message type |
