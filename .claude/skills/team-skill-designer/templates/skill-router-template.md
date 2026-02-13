# Skill Router Template

Template for the generated SKILL.md with role-based routing.

## Purpose

| Phase | Usage |
|-------|-------|
| Phase 0 | Read to understand generated SKILL.md structure |
| Phase 3 | Apply with team-specific content |

---

## Template

```markdown
---
name: team-{{team_name}}
description: Unified team skill for {{team_name}} team. All roles invoke this skill with --role arg for role-specific execution. Triggers on "team {{team_name}}".
allowed-tools: {{all_roles_tools_union}}
---

# Team {{team_display_name}}

Unified team skill. All team members invoke this skill with `--role=xxx` to route to role-specific execution.

## Architecture Overview

\`\`\`
┌───────────────────────────────────────────┐
│  Skill(skill="team-{{team_name}}")         │
│  args="--role=xxx"                        │
└───────────────┬───────────────────────────┘
                │ Role Router
    ┌───────────┼───────────┬───────────┐
    ↓           ↓           ↓           ↓
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│coordinator│ │{{role_1}}│ │{{role_2}}│ │{{role_3}}│
│ roles/   │ │ roles/   │ │ roles/   │ │ roles/   │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
\`\`\`

## Role Router

### Input Parsing

Parse `$ARGUMENTS` to extract `--role`:

\`\`\`javascript
const args = "$ARGUMENTS"
const roleMatch = args.match(/--role[=\s]+(\w+)/)

if (!roleMatch) {
  // ERROR: --role is required
  // This skill must be invoked with: Skill(skill="team-{{team_name}}", args="--role=xxx")
  throw new Error("Missing --role argument. Available roles: {{role_list}}")
}

const role = roleMatch[1]
const teamName = "{{team_name}}"
\`\`\`

### Role Dispatch

\`\`\`javascript
const VALID_ROLES = {
{{#each roles}}
  "{{this.name}}": { file: "roles/{{this.name}}.md", prefix: "{{this.task_prefix}}" },
{{/each}}
}

if (!VALID_ROLES[role]) {
  throw new Error(\`Unknown role: \${role}. Available: \${Object.keys(VALID_ROLES).join(', ')}\`)
}

// Read and execute role-specific logic
Read(VALID_ROLES[role].file)
// → Execute the 5-phase process defined in that file
\`\`\`

### Available Roles

| Role | Task Prefix | Responsibility | Role File |
|------|-------------|----------------|-----------|
{{#each roles}}
| `{{this.name}}` | {{this.task_prefix}}-* | {{this.responsibility}} | [roles/{{this.name}}.md](roles/{{this.name}}.md) |
{{/each}}

## Shared Infrastructure

### Team Configuration

\`\`\`javascript
const TEAM_CONFIG = {
  name: "{{team_name}}",
  sessionDir: ".workflow/.team-plan/{{team_name}}/",
  msgDir: ".workflow/.team-msg/{{team_name}}/",
  roles: {{roles_json}}
}
\`\`\`

### Message Bus (All Roles)

Every SendMessage **before**, must call `mcp__ccw-tools__team_msg` to log:

\`\`\`javascript
mcp__ccw-tools__team_msg({
  operation: "log",
  team: "{{team_name}}",
  from: role,          // current role name
  to: "coordinator",
  type: "<type>",
  summary: "<summary>",
  ref: "<file_path>"   // optional
})
\`\`\`

**Message types by role**:

| Role | Types |
|------|-------|
{{#each roles}}
| {{this.name}} | {{this.message_types_list}} |
{{/each}}

### CLI 回退

当 `mcp__ccw-tools__team_msg` MCP 不可用时：

\`\`\`javascript
Bash(\`ccw team log --team "{{team_name}}" --from "\${role}" --to "coordinator" --type "<type>" --summary "<摘要>" --json\`)
\`\`\`

### Task Lifecycle (All Roles)

\`\`\`javascript
// Standard task lifecycle every role follows
// Phase 1: Discovery
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith(\`\${VALID_ROLES[role].prefix}-\`) &&
  t.owner === role &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)
if (myTasks.length === 0) return // idle
const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })

// Phase 2-4: Role-specific (see roles/{role}.md)

// Phase 5: Report + Loop
mcp__ccw-tools__team_msg({ operation: "log", team: "{{team_name}}", from: role, to: "coordinator", type: "...", summary: "..." })
SendMessage({ type: "message", recipient: "coordinator", content: "...", summary: "..." })
TaskUpdate({ taskId: task.id, status: 'completed' })
// Check for next task → back to Phase 1
\`\`\`

## Pipeline

\`\`\`
{{pipeline_diagram}}
\`\`\`

## Coordinator Spawn Template

When coordinator creates teammates, use this pattern:

\`\`\`javascript
TeamCreate({ team_name: "{{team_name}}" })

{{#each worker_roles}}
// {{this.display_name}}
Task({
  subagent_type: "general-purpose",
  team_name: "{{../team_name}}",
  name: "{{this.name}}",
  prompt: \`你是 team "{{../team_name}}" 的 {{this.name_upper}}.

当你收到 {{this.task_prefix}}-* 任务时，调用 Skill(skill="team-{{../team_name}}", args="--role={{this.name}}") 执行。

当前需求: \${taskDescription}
约束: \${constraints}

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录。

工作流程:
1. TaskList → 找到 {{this.task_prefix}}-* 任务
2. Skill(skill="team-{{../team_name}}", args="--role={{this.name}}") 执行
3. team_msg log + SendMessage 结果给 coordinator
4. TaskUpdate completed → 检查下一个任务\`
})
{{/each}}
\`\`\`

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Unknown --role value | Error with available role list |
| Missing --role arg | Error with usage hint |
| Role file not found | Error with expected path |
| Task prefix conflict | Log warning, proceed |
```

---

## Variable Reference

| Variable | Source | Description |
|----------|--------|-------------|
| `{{team_name}}` | config.team_name | Team identifier (lowercase) |
| `{{team_display_name}}` | config.team_display_name | Human-readable team name |
| `{{all_roles_tools_union}}` | Union of all roles' allowed-tools | Combined tool list |
| `{{roles}}` | config.roles[] | Array of role definitions |
| `{{role_list}}` | Role names joined by comma | e.g., "coordinator, planner, executor" |
| `{{roles_json}}` | JSON.stringify(roles) | Roles as JSON |
| `{{pipeline_diagram}}` | Generated from task chain | ASCII pipeline |
| `{{worker_roles}}` | config.roles excluding coordinator | Non-coordinator roles |
| `{{role.name}}` | Per-role name | e.g., "planner" |
| `{{role.task_prefix}}` | Per-role task prefix | e.g., "PLAN" |
| `{{role.responsibility}}` | Per-role responsibility | e.g., "Code exploration and planning" |
| `{{role.message_types_list}}` | Per-role message types | e.g., "`plan_ready`, `error`" |
