# Phase 1: Requirements Collection

Collect team definition, role definition, capabilities, and communication patterns for the new team command.

## Objective

- Determine team name (folder name)
- Determine role name and responsibilities
- Define task prefix and communication patterns
- Select required tools and capabilities
- Generate role-config.json

## Input

- Dependency: User request (`$ARGUMENTS` or interactive input)
- Specification: `specs/team-design-patterns.md` (read in Phase 0)

## Execution Steps

### Step 1: Team & Role Basic Information

```javascript
const teamInfo = await AskUserQuestion({
  questions: [
    {
      question: "What is the team name? (lowercase, used as folder name under .claude/commands/team/{team-name}/)",
      header: "Team Name",
      multiSelect: false,
      options: [
        { label: "Custom team", description: "Enter a custom team name" },
        { label: "spec", description: "Specification documentation team" },
        { label: "security", description: "Security audit and compliance team" },
        { label: "devops", description: "Deployment and operations team" }
      ]
    },
    {
      question: "What is the role name for this teammate? (lowercase, e.g., 'analyzer', 'deployer')",
      header: "Role Name",
      multiSelect: false,
      options: [
        { label: "Custom role", description: "Enter a custom role name" },
        { label: "coordinator", description: "Team coordinator / orchestrator" },
        { label: "analyzer", description: "Code/data analysis specialist" },
        { label: "deployer", description: "Deployment and release management" }
      ]
    },
    {
      question: "What is the primary responsibility type?",
      header: "Responsibility",
      multiSelect: false,
      options: [
        { label: "Read-only analysis", description: "Analyze, review, report (no file modification)" },
        { label: "Code generation", description: "Write/modify code files" },
        { label: "Orchestration", description: "Coordinate sub-tasks and agents" },
        { label: "Validation", description: "Test, verify, audit" }
      ]
    }
  ]
});
```

### Step 2: Task Configuration

```javascript
const taskConfig = await AskUserQuestion({
  questions: [
    {
      question: "What task prefix should this role use? (UPPERCASE, unique, e.g., 'ANALYZE', 'DEPLOY')",
      header: "Task Prefix",
      multiSelect: false,
      options: [
        { label: "Custom prefix", description: "Enter a unique task prefix" },
        { label: "ANALYZE", description: "For analysis tasks (ANALYZE-001)" },
        { label: "DEPLOY", description: "For deployment tasks (DEPLOY-001)" },
        { label: "DOC", description: "For documentation tasks (DOC-001)" }
      ]
    },
    {
      question: "Where does this role fit in the task chain?",
      header: "Chain Position",
      multiSelect: false,
      options: [
        { label: "After PLAN (parallel with IMPL)", description: "Runs alongside implementation" },
        { label: "After IMPL (parallel with TEST/REVIEW)", description: "Post-implementation validation" },
        { label: "After TEST+REVIEW (final stage)", description: "Final processing before completion" },
        { label: "Independent (coordinator-triggered)", description: "No dependency on other tasks" }
      ]
    }
  ]
});
```

### Step 3: Capability Selection

```javascript
const capabilities = await AskUserQuestion({
  questions: [
    {
      question: "What capabilities does this role need?",
      header: "Capabilities",
      multiSelect: true,
      options: [
        { label: "File modification (Write/Edit)", description: "Can create and modify files" },
        { label: "Sub-agent delegation (Task)", description: "Can spawn sub-agents for complex work" },
        { label: "CLI tool invocation", description: "Can invoke ccw cli tools (gemini/qwen/codex)" },
        { label: "User interaction (AskUserQuestion)", description: "Can ask user questions during execution" }
      ]
    },
    {
      question: "Does this role need complexity-adaptive routing?",
      header: "Adaptive",
      multiSelect: false,
      options: [
        { label: "Yes (Recommended)", description: "Low=direct, Medium/High=agent delegation" },
        { label: "No", description: "Always use the same execution path" }
      ]
    }
  ]
});
```

### Step 4: Message Types Definition

```javascript
// Infer message types from role type
const responsibilityType = roleInfo["Responsibility"]

const baseMessageTypes = [
  { type: "error", direction: "-> coordinator", trigger: "Blocking error" }
]

const roleMessageTypes = {
  "Read-only analysis": [
    { type: "{role}_result", direction: "-> coordinator", trigger: "Analysis complete" },
    { type: "{role}_progress", direction: "-> coordinator", trigger: "Long analysis progress" }
  ],
  "Code generation": [
    { type: "{role}_complete", direction: "-> coordinator", trigger: "Generation complete" },
    { type: "{role}_progress", direction: "-> coordinator", trigger: "Batch progress update" }
  ],
  "Orchestration": [
    { type: "{role}_ready", direction: "-> coordinator", trigger: "Sub-task results ready" },
    { type: "{role}_progress", direction: "-> coordinator", trigger: "Sub-task progress" }
  ],
  "Validation": [
    { type: "{role}_result", direction: "-> coordinator", trigger: "Validation complete" },
    { type: "fix_required", direction: "-> coordinator", trigger: "Critical issues found" }
  ]
}

const messageTypes = [
  ...baseMessageTypes,
  ...(roleMessageTypes[responsibilityType] || [])
]
```

### Step 5: Generate Configuration

```javascript
const teamName = teamInfo["Team Name"] === "Custom team"
  ? teamInfo["Team Name_other"]
  : teamInfo["Team Name"]

const roleName = teamInfo["Role Name"] === "Custom role"
  ? teamInfo["Role Name_other"]
  : teamInfo["Role Name"]

const taskPrefix = taskConfig["Task Prefix"] === "Custom prefix"
  ? taskConfig["Task Prefix_other"]
  : taskConfig["Task Prefix"]

// Build allowed-tools list
const baseTools = ["SendMessage(*)", "TaskUpdate(*)", "TaskList(*)", "TaskGet(*)", "TodoWrite(*)", "Read(*)", "Bash(*)", "Glob(*)", "Grep(*)"]
const selectedCapabilities = capabilities["Capabilities"] || []

if (selectedCapabilities.includes("File modification")) {
  baseTools.push("Write(*)", "Edit(*)")
}
if (selectedCapabilities.includes("Sub-agent delegation")) {
  baseTools.push("Task(*)")
}

const config = {
  team_name: teamName,
  role_name: roleName,
  display_name: `Team ${teamName} ${roleName}`,
  description_cn: `Team ${teamName} ${roleName} - ${teamInfo["Responsibility"]}`,
  responsibility_type: responsibilityType,
  task_prefix: taskPrefix.toUpperCase(),
  chain_position: taskConfig["Chain Position"],
  allowed_tools: baseTools,
  capabilities: selectedCapabilities,
  adaptive_routing: capabilities["Adaptive"].includes("Yes"),
  message_types: messageTypes.map(mt => ({
    ...mt,
    type: mt.type.replace('{role}', roleName)
  })),
  cli_integration: selectedCapabilities.includes("CLI tool invocation"),
  user_interaction: selectedCapabilities.includes("User interaction"),
  // Derived paths
  skill_path: `team:${teamName}:${roleName}`,          // e.g., team:spec:analyst
  output_folder: `.claude/commands/team/${teamName}`,   // e.g., .claude/commands/team/spec
  output_file: `${roleName}.md`                         // e.g., analyst.md
}

Write(`${workDir}/role-config.json`, JSON.stringify(config, null, 2))
```

## Output

- **File**: `role-config.json`
- **Format**: JSON
- **Location**: `{workDir}/role-config.json`

## Quality Checklist

- [ ] Team name is lowercase, valid as folder name
- [ ] Role name is lowercase, unique within the team folder
- [ ] Task prefix is UPPERCASE, unique (not PLAN/IMPL/TEST/REVIEW)
- [ ] Allowed tools include minimum set (SendMessage, TaskUpdate, TaskList, TaskGet)
- [ ] Message types follow naming convention
- [ ] Chain position is clearly defined
- [ ] Derived paths (skill_path, output_folder, output_file) are consistent

## Next Phase

-> [Phase 2: Pattern Analysis](02-pattern-analysis.md)
