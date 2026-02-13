# Phase 4: Integration Verification

Verify the generated command integrates correctly with the existing team system.

## Objective

- Verify consistency with coordinate.md spawn patterns
- Check message type compatibility
- Verify task prefix uniqueness
- Ensure allowed-tools are sufficient
- Generate integration-report.json

## Input

- Dependency: `{role-name}.md` (Phase 3), `role-config.json` (Phase 1)
- Reference: `.claude/commands/team/coordinate.md`

## Execution Steps

### Step 1: Load Generated Command and Config

```javascript
const config = JSON.parse(Read(`${workDir}/role-config.json`))
const generatedCommand = Read(`${workDir}/${config.role_name}.md`)
const coordinateCmd = Read(`.claude/commands/team/coordinate.md`)
```

### Step 2: Check Task Prefix Uniqueness

```javascript
// Extract existing prefixes from coordinate.md
const existingPrefixes = ['PLAN', 'IMPL', 'TEST', 'REVIEW']

// Also scan all team command files for prefixes
const teamFiles = Glob('.claude/commands/team/**/*.md')
for (const file of teamFiles) {
  const content = Read(file)
  const prefixMatch = content.match(/startsWith\('([A-Z]+)-'\)/)
  if (prefixMatch && !existingPrefixes.includes(prefixMatch[1])) {
    existingPrefixes.push(prefixMatch[1])
  }
}

const prefixConflict = existingPrefixes.includes(config.task_prefix)

const prefixCheck = {
  status: prefixConflict ? 'FAIL' : 'PASS',
  existing: existingPrefixes,
  new_prefix: config.task_prefix,
  message: prefixConflict
    ? `Prefix ${config.task_prefix} conflicts with existing: ${existingPrefixes.join(', ')}`
    : `Prefix ${config.task_prefix} is unique`
}
```

### Step 3: Verify Spawn Pattern Compatibility

```javascript
// Check that the generated command can be spawned by coordinate.md
const spawnCheck = {
  has_skill_invocation: generatedCommand.includes('Skill(skill="team:'),
  has_task_lifecycle: generatedCommand.includes('TaskList') &&
                     generatedCommand.includes('TaskGet') &&
                     generatedCommand.includes('TaskUpdate'),
  has_message_bus: generatedCommand.includes('mcp__ccw-tools__team_msg'),
  has_send_message: generatedCommand.includes('SendMessage'),
  has_group_team: generatedCommand.includes('group: team')
}

const spawnCompatible = Object.values(spawnCheck).every(v => v)
```

### Step 4: Verify Message Type Compatibility

```javascript
// Extract all message types used in coordinate.md handlers
const coordinateTypes = coordinateCmd.match(/type:\s*["']([^"']+)["']/g)
  ?.map(m => m.match(/["']([^"']+)["']/)[1]) || []

// Check new message types don't conflict
const msgTypeCheck = {
  coordinator_knows: coordinateTypes,
  new_types: config.message_types.map(mt => mt.type),
  conflicts: config.message_types
    .filter(mt => coordinateTypes.includes(mt.type))
    .map(mt => mt.type),
  recommendation: "Add new message types to coordinate.md handler table"
}
```

### Step 5: Verify Allowed-Tools Sufficiency

```javascript
const requiredTools = ['SendMessage', 'TaskUpdate', 'TaskList', 'TaskGet']
const missingTools = requiredTools.filter(tool =>
  !config.allowed_tools.some(at => at.includes(tool))
)

const toolCheck = {
  status: missingTools.length === 0 ? 'PASS' : 'FAIL',
  required: requiredTools,
  configured: config.allowed_tools,
  missing: missingTools
}
```

### Step 6: Verify Chain Position Integration

```javascript
// Check coordinate.md has or can add the task chain
const chainCheck = {
  position: config.chain_position,
  existing_chain: "PLAN-001 -> IMPL-001 -> TEST-001 + REVIEW-001",
  integration_needed: true,
  suggestion: generateChainSuggestion(config)
}

function generateChainSuggestion(config) {
  const pos = config.chain_position
  if (pos.includes("After PLAN")) {
    return `PLAN-001 -> IMPL-001 + ${config.task_prefix}-001 -> TEST-001 + REVIEW-001`
  }
  if (pos.includes("After IMPL")) {
    return `PLAN-001 -> IMPL-001 -> TEST-001 + REVIEW-001 + ${config.task_prefix}-001`
  }
  if (pos.includes("After TEST")) {
    return `PLAN-001 -> IMPL-001 -> TEST-001 + REVIEW-001 -> ${config.task_prefix}-001`
  }
  return `PLAN-001 -> IMPL-001 -> TEST-001 + REVIEW-001 (+ ${config.task_prefix}-001 independent)`
}
```

### Step 7: Generate Coordinator Spawn Snippet

```javascript
// Generate the spawn code that should be added to coordinate.md
const spawnSnippet = `// ${config.display_name}
Task({
  subagent_type: "general-purpose",
  team_name: teamName,
  name: "${config.role_name}",
  prompt: \`You are team "\${teamName}" ${config.role_name.toUpperCase()}.

When you receive ${config.task_prefix}-* tasks, call Skill(skill="${config.skill_path}") to execute.

Current requirement: \${taskDescription}
Constraints: \${constraints}

## Message Bus (Required)
Before each SendMessage, call mcp__ccw-tools__team_msg:
mcp__ccw-tools__team_msg({ operation: "log", team: "\${teamName}", from: "${config.role_name}", to: "coordinator", type: "<type>", summary: "<summary>" })

Workflow:
1. TaskList -> find ${config.task_prefix}-* tasks assigned to you
2. Skill(skill="${config.skill_path}") to execute
3. team_msg log + SendMessage results to coordinator
4. TaskUpdate completed -> check next task\`
})`
```

```javascript
// Skill path: ${config.skill_path}  (e.g., team:spec:analyst)
// Folder: ${config.output_folder}   (e.g., .claude/commands/team/spec)
```

### Step 8: Generate Integration Report

```javascript
const report = {
  role_name: config.role_name,
  checks: {
    prefix_unique: prefixCheck,
    spawn_compatible: { status: spawnCompatible ? 'PASS' : 'FAIL', details: spawnCheck },
    message_types: msgTypeCheck,
    tools_sufficient: toolCheck,
    chain_integration: chainCheck
  },
  overall: (prefixCheck.status === 'PASS' &&
            spawnCompatible &&
            toolCheck.status === 'PASS') ? 'PASS' : 'NEEDS_ATTENTION',
  destination: `${config.output_folder}/${config.output_file}`,
  coordinator_updates: {
    spawn_snippet: spawnSnippet,
    task_chain: chainCheck.suggestion,
    handler_additions: config.message_types.map(mt => ({
      type: mt.type,
      action: `Handle ${mt.trigger}`
    }))
  }
}

Write(`${workDir}/integration-report.json`, JSON.stringify(report, null, 2))
```

## Output

- **File**: `integration-report.json`
- **Format**: JSON
- **Location**: `{workDir}/integration-report.json`

## Quality Checklist

- [ ] Task prefix does not conflict with existing prefixes
- [ ] Spawn pattern compatible with coordinate.md
- [ ] All required tools are in allowed-tools
- [ ] Message types documented
- [ ] Chain position has integration suggestion
- [ ] Coordinator spawn snippet is ready to copy

## Next Phase

-> [Phase 5: Validation](05-validation.md)
