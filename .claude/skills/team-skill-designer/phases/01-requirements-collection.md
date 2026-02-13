# Phase 1: Requirements Collection (Batch Mode)

Collect team definition and ALL role definitions in one pass.

## Objective

- Determine team name and display name
- Collect ALL roles (coordinator + workers) in batch
- For each role: name, responsibility, task prefix, capabilities
- Define pipeline (task chain order)
- Generate team-config.json

## Input

- User request (`$ARGUMENTS` or interactive input)
- Specification: `specs/team-design-patterns.md` (read in Phase 0)

## Execution Steps

### Step 1: Team Basic Information

```javascript
const teamInfo = await AskUserQuestion({
  questions: [
    {
      question: "团队名称是什么？（小写，用作 skill 文件夹名：.claude/skills/team-{name}/）",
      header: "Team Name",
      multiSelect: false,
      options: [
        { label: "自定义", description: "输入自定义团队名称" },
        { label: "dev", description: "开发团队（plan/execute/test/review）" },
        { label: "spec", description: "规格文档团队（analyst/writer/reviewer/discuss）" },
        { label: "security", description: "安全审计团队" }
      ]
    },
    {
      question: "团队使用什么 pipeline 模型？",
      header: "Pipeline",
      multiSelect: false,
      options: [
        { label: "Standard (Recommended)", description: "PLAN → IMPL → TEST + REVIEW（标准开发流水线）" },
        { label: "Document Chain", description: "RESEARCH → DRAFT → DISCUSS → REVIEW（文档工作流）" },
        { label: "Custom", description: "自定义 pipeline" }
      ]
    }
  ]
})
```

### Step 2: Role Definitions (Batch)

```javascript
// Always include coordinator
const roles = [{
  name: "coordinator",
  responsibility_type: "Orchestration",
  task_prefix: null,  // coordinator creates tasks, doesn't receive them
  description: "Pipeline orchestration, team lifecycle, cross-stage coordination"
}]

// Collect worker roles based on pipeline model
const pipelineType = teamInfo["Pipeline"]

if (pipelineType.includes("Standard")) {
  // Pre-fill standard development roles
  roles.push(
    { name: "planner", responsibility_type: "Orchestration", task_prefix: "PLAN", description: "Code exploration and implementation planning" },
    { name: "executor", responsibility_type: "Code generation", task_prefix: "IMPL", description: "Code implementation following approved plan" },
    { name: "tester", responsibility_type: "Validation", task_prefix: "TEST", description: "Test execution and fix cycles" },
    { name: "reviewer", responsibility_type: "Read-only analysis", task_prefix: "REVIEW", description: "Multi-dimensional code review" }
  )
} else if (pipelineType.includes("Document")) {
  roles.push(
    { name: "analyst", responsibility_type: "Orchestration", task_prefix: "RESEARCH", description: "Seed analysis, codebase exploration, context collection" },
    { name: "writer", responsibility_type: "Code generation", task_prefix: "DRAFT", description: "Document drafting following templates" },
    { name: "reviewer", responsibility_type: "Read-only analysis", task_prefix: "QUALITY", description: "Cross-document quality verification" },
    { name: "discuss", responsibility_type: "Orchestration", task_prefix: "DISCUSS", description: "Structured team discussion and consensus building" }
  )
} else {
  // Custom: ask user for each role
}
```

### Step 3: Role Customization (Interactive)

```javascript
// Allow user to customize pre-filled roles
const customization = await AskUserQuestion({
  questions: [
    {
      question: "是否需要自定义角色？（默认角色已根据 pipeline 预填充）",
      header: "Customize",
      multiSelect: false,
      options: [
        { label: "使用默认 (Recommended)", description: "直接使用预填充的角色定义" },
        { label: "添加角色", description: "在默认基础上添加新角色" },
        { label: "修改角色", description: "修改默认角色定义" },
        { label: "从零开始", description: "清空默认，逐个定义角色" }
      ]
    }
  ]
})

if (customization["Customize"].includes("添加角色")) {
  const newRole = await AskUserQuestion({
    questions: [
      {
        question: "新角色名称？（小写）",
        header: "Role Name",
        multiSelect: false,
        options: [
          { label: "自定义", description: "输入自定义角色名" },
          { label: "deployer", description: "部署和发布管理" },
          { label: "documenter", description: "文档生成" },
          { label: "monitor", description: "监控和告警" }
        ]
      },
      {
        question: "角色职责类型？",
        header: "Type",
        multiSelect: false,
        options: [
          { label: "Read-only analysis", description: "分析/审查/报告（不修改文件）" },
          { label: "Code generation", description: "写/改代码文件" },
          { label: "Orchestration", description: "协调子任务和 agent" },
          { label: "Validation", description: "测试/验证/审计" }
        ]
      }
    ]
  })
  // Add to roles array
}
```

### Step 4: Capability Selection (Per Role)

```javascript
// For each worker role, determine capabilities
for (const role of roles.filter(r => r.name !== 'coordinator')) {
  // Infer capabilities from responsibility type
  const baseTools = ["SendMessage(*)", "TaskUpdate(*)", "TaskList(*)", "TaskGet(*)", "TodoWrite(*)", "Read(*)", "Bash(*)", "Glob(*)", "Grep(*)"]

  if (role.responsibility_type === "Code generation") {
    role.allowed_tools = [...baseTools, "Write(*)", "Edit(*)", "Task(*)"]
    role.adaptive_routing = true
  } else if (role.responsibility_type === "Orchestration") {
    role.allowed_tools = [...baseTools, "Write(*)", "Task(*)"]
    role.adaptive_routing = true
  } else if (role.responsibility_type === "Validation") {
    role.allowed_tools = [...baseTools, "Write(*)", "Edit(*)", "Task(*)"]
    role.adaptive_routing = false
  } else {
    // Read-only analysis
    role.allowed_tools = [...baseTools, "Task(*)"]
    role.adaptive_routing = false
  }

  // Infer message types
  const roleMsgTypes = {
    "Read-only analysis": [
      { type: `${role.name}_result`, trigger: "Analysis complete" },
      { type: "error", trigger: "Blocking error" }
    ],
    "Code generation": [
      { type: `${role.name}_complete`, trigger: "Generation complete" },
      { type: `${role.name}_progress`, trigger: "Batch progress" },
      { type: "error", trigger: "Blocking error" }
    ],
    "Orchestration": [
      { type: `${role.name}_ready`, trigger: "Results ready" },
      { type: `${role.name}_progress`, trigger: "Progress update" },
      { type: "error", trigger: "Blocking error" }
    ],
    "Validation": [
      { type: `${role.name}_result`, trigger: "Validation complete" },
      { type: "fix_required", trigger: "Critical issues found" },
      { type: "error", trigger: "Blocking error" }
    ]
  }
  role.message_types = roleMsgTypes[role.responsibility_type] || []
}

// Coordinator special config
roles[0].allowed_tools = [
  "TeamCreate(*)", "TeamDelete(*)", "SendMessage(*)",
  "TaskCreate(*)", "TaskUpdate(*)", "TaskList(*)", "TaskGet(*)",
  "Task(*)", "AskUserQuestion(*)", "TodoWrite(*)",
  "Read(*)", "Bash(*)", "Glob(*)", "Grep(*)"
]
roles[0].message_types = [
  { type: "plan_approved", trigger: "Plan approved" },
  { type: "plan_revision", trigger: "Revision requested" },
  { type: "task_unblocked", trigger: "Task unblocked" },
  { type: "shutdown", trigger: "Team shutdown" },
  { type: "error", trigger: "Coordination error" }
]
```

### Step 5: Pipeline Definition

```javascript
// Build pipeline from roles and their task chain positions
function buildPipeline(roles, pipelineType) {
  if (pipelineType.includes("Standard")) {
    return {
      stages: [
        { name: "PLAN", role: "planner", blockedBy: [] },
        { name: "IMPL", role: "executor", blockedBy: ["PLAN"] },
        { name: "TEST", role: "tester", blockedBy: ["IMPL"] },
        { name: "REVIEW", role: "reviewer", blockedBy: ["IMPL"] }
      ],
      diagram: "需求 → [PLAN: planner] → coordinator 审批 → [IMPL: executor] → [TEST + REVIEW: tester/reviewer] → 汇报"
    }
  }
  if (pipelineType.includes("Document")) {
    return {
      stages: [
        { name: "RESEARCH", role: "analyst", blockedBy: [] },
        { name: "DISCUSS-scope", role: "discuss", blockedBy: ["RESEARCH"] },
        { name: "DRAFT", role: "writer", blockedBy: ["DISCUSS-scope"] },
        { name: "DISCUSS-eval", role: "discuss", blockedBy: ["DRAFT"] },
        { name: "QUALITY", role: "reviewer", blockedBy: ["DRAFT"] }
      ],
      diagram: "RESEARCH → DISCUSS → DRAFT → DISCUSS → QUALITY → Deliver"
    }
  }
  // Custom pipeline
  return { stages: [], diagram: "Custom pipeline" }
}

const pipeline = buildPipeline(roles, pipelineType)
```

### Step 6: Generate Configuration

```javascript
const teamName = teamInfo["Team Name"] === "自定义"
  ? teamInfo["Team Name_other"]
  : teamInfo["Team Name"]

const config = {
  team_name: teamName,
  team_display_name: teamName.charAt(0).toUpperCase() + teamName.slice(1),
  skill_name: `team-${teamName}`,
  skill_path: `.claude/skills/team-${teamName}/`,
  pipeline_type: pipelineType,
  pipeline: pipeline,
  roles: roles.map(r => ({
    ...r,
    display_name: `${teamName} ${r.name}`,
    name_upper: r.name.toUpperCase()
  })),
  worker_roles: roles.filter(r => r.name !== 'coordinator').map(r => ({
    ...r,
    display_name: `${teamName} ${r.name}`,
    name_upper: r.name.toUpperCase()
  })),
  all_roles_tools_union: [...new Set(roles.flatMap(r => r.allowed_tools))].join(', '),
  role_list: roles.map(r => r.name).join(', ')
}

Write(`${workDir}/team-config.json`, JSON.stringify(config, null, 2))
```

## Output

- **File**: `team-config.json`
- **Format**: JSON
- **Location**: `{workDir}/team-config.json`

## Quality Checklist

- [ ] Team name is lowercase, valid as folder/skill name
- [ ] Coordinator is always included
- [ ] At least 2 worker roles defined
- [ ] Task prefixes are UPPERCASE and unique across roles
- [ ] Pipeline stages reference valid roles
- [ ] All roles have message types defined
- [ ] Allowed tools include minimum set per role

## Next Phase

-> [Phase 2: Pattern Analysis](02-pattern-analysis.md)
