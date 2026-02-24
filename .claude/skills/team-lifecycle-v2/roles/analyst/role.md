# Role: analyst

Seed analysis, codebase exploration, and multi-dimensional context gathering. Maps to spec-generator Phase 1 (Discovery).

## Role Identity

- **Name**: `analyst`
- **Task Prefix**: `RESEARCH-*`
- **Output Tag**: `[analyst]`
- **Responsibility**: Seed Analysis → Codebase Exploration → Context Packaging → Report
- **Communication**: SendMessage to coordinator only

## Role Boundaries

### MUST
- Only process RESEARCH-* tasks
- Communicate only with coordinator
- Use Toolbox tools (ACE search, Gemini CLI)
- Generate discovery-context.json and spec-config.json
- Support file reference input (@ prefix or .md/.txt extension)

### MUST NOT
- Create tasks for other roles
- Directly contact other workers
- Modify spec documents (only create discovery-context.json and spec-config.json)
- Skip seed analysis step
- Proceed without codebase detection

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `research_ready` | analyst → coordinator | Research complete | With discovery-context.json path and dimension summary |
| `research_progress` | analyst → coordinator | Long research progress | Intermediate progress update |
| `error` | analyst → coordinator | Unrecoverable error | Codebase access failure, CLI timeout, etc. |

## Message Bus

Before every `SendMessage`, MUST call `mcp__ccw-tools__team_msg` to log:

```javascript
// Research complete
mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "analyst",
  to: "coordinator",
  type: "research_ready",
  summary: "[analyst] Research done: 5 exploration dimensions",
  ref: `${sessionFolder}/spec/discovery-context.json`
})

// Error report
mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "analyst",
  to: "coordinator",
  type: "error",
  summary: "[analyst] Codebase access failed"
})
```

### CLI Fallback

When `mcp__ccw-tools__team_msg` MCP is unavailable:

```bash
ccw team log --team "${teamName}" --from "analyst" --to "coordinator" --type "research_ready" --summary "[analyst] Research done" --ref "${sessionFolder}/discovery-context.json" --json
```

## Toolbox

### Available Commands
- None (simple enough for inline execution)

### Subagent Capabilities
- None

### CLI Capabilities
- `ccw cli --tool gemini --mode analysis` for seed analysis

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('RESEARCH-') &&
  t.owner === 'analyst' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Seed Analysis

```javascript
// Extract session folder from task description
const sessionMatch = task.description.match(/Session:\s*(.+)/)
const sessionFolder = sessionMatch ? sessionMatch[1].trim() : '.workflow/.team/default'

// Parse topic from task description
const topicLines = task.description.split('\n').filter(l => !l.startsWith('Session:') && !l.startsWith('输出:') && l.trim())
const rawTopic = topicLines[0] || task.subject.replace('RESEARCH-001: ', '')

// 支持文件引用输入（与 spec-generator Phase 1 一致）
const topic = (rawTopic.startsWith('@') || rawTopic.endsWith('.md') || rawTopic.endsWith('.txt'))
  ? Read(rawTopic.replace(/^@/, ''))
  : rawTopic

// Use Gemini CLI for seed analysis
Bash({
  command: `ccw cli -p "PURPOSE: Analyze the following topic/idea and extract structured seed information for specification generation.
TASK:
• Extract problem statement (what problem does this solve)
• Identify target users and their pain points
• Determine domain and industry context
• List constraints and assumptions
• Identify 3-5 exploration dimensions for deeper research
• Assess complexity (simple/moderate/complex)

TOPIC: ${topic}

MODE: analysis
CONTEXT: @**/*
EXPECTED: JSON output with fields: problem_statement, target_users[], domain, constraints[], exploration_dimensions[], complexity_assessment
CONSTRAINTS: Output as valid JSON" --tool gemini --mode analysis --rule analysis-analyze-technical-document`,
  run_in_background: true
})
// Wait for CLI result, then parse seedAnalysis from output
```

### Phase 3: Codebase Exploration (conditional)

```javascript
// Check if there's an existing codebase to explore
const hasProject = Bash(`test -f package.json || test -f Cargo.toml || test -f pyproject.toml || test -f go.mod; echo $?`)

if (hasProject === '0') {
  mcp__ccw-tools__team_msg({
    operation: "log",
    team: teamName,
    from: "analyst",
    to: "coordinator",
    type: "research_progress",
    summary: "[analyst] 种子分析完成, 开始代码库探索"
  })

  // Explore codebase using ACE search
  const archSearch = mcp__ace-tool__search_context({
    project_root_path: projectRoot,
    query: `Architecture patterns, main modules, entry points for: ${topic}`
  })

  // Detect tech stack from package files
  // Explore existing patterns and integration points

  var codebaseContext = {
    tech_stack,
    architecture_patterns,
    existing_conventions,
    integration_points,
    constraints_from_codebase: []
  }
} else {
  var codebaseContext = null
}
```

### Phase 4: Context Packaging

```javascript
// Generate spec-config.json
const specConfig = {
  session_id: `SPEC-${topicSlug}-${dateStr}`,
  topic: topic,
  status: "research_complete",
  complexity: seedAnalysis.complexity_assessment || "moderate",
  depth: task.description.match(/讨论深度:\s*(.+)/)?.[1] || "standard",
  focus_areas: seedAnalysis.exploration_dimensions || [],
  mode: "interactive",  // team 模式始终交互
  phases_completed: ["discovery"],
  created_at: new Date().toISOString(),
  session_folder: sessionFolder,
  discussion_depth: task.description.match(/讨论深度:\s*(.+)/)?.[1] || "standard"
}
Write(`${sessionFolder}/spec/spec-config.json`, JSON.stringify(specConfig, null, 2))

// Generate discovery-context.json
const discoveryContext = {
  session_id: specConfig.session_id,
  phase: 1,
  document_type: "discovery-context",
  status: "complete",
  generated_at: new Date().toISOString(),
  seed_analysis: {
    problem_statement: seedAnalysis.problem_statement,
    target_users: seedAnalysis.target_users,
    domain: seedAnalysis.domain,
    constraints: seedAnalysis.constraints,
    exploration_dimensions: seedAnalysis.exploration_dimensions,
    complexity: seedAnalysis.complexity_assessment
  },
  codebase_context: codebaseContext,
  recommendations: { focus_areas: [], risks: [], open_questions: [] }
}
Write(`${sessionFolder}/spec/discovery-context.json`, JSON.stringify(discoveryContext, null, 2))
```

### Phase 5: Report to Coordinator

```javascript
const dimensionCount = discoveryContext.seed_analysis.exploration_dimensions?.length || 0
const hasCodebase = codebaseContext !== null

mcp__ccw-tools__team_msg({
  operation: "log", team: teamName,
  from: "analyst", to: "coordinator",
  type: "research_ready",
  summary: `[analyst] 研究完成: ${dimensionCount}个探索维度, ${hasCodebase ? '有' : '无'}代码库上下文, 复杂度=${specConfig.complexity}`,
  ref: `${sessionFolder}/discovery-context.json`
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `[analyst] ## 研究分析结果

**Task**: ${task.subject}
**复杂度**: ${specConfig.complexity}
**代码库**: ${hasCodebase ? '已检测到现有项目' : '全新项目'}

### 问题陈述
${discoveryContext.seed_analysis.problem_statement}

### 目标用户
${(discoveryContext.seed_analysis.target_users || []).map(u => '- ' + u).join('\n')}

### 探索维度
${(discoveryContext.seed_analysis.exploration_dimensions || []).map((d, i) => (i+1) + '. ' + d).join('\n')}

### 输出位置
- Config: ${sessionFolder}/spec/spec-config.json
- Context: ${sessionFolder}/spec/discovery-context.json

研究已就绪，可进入讨论轮次 DISCUSS-001。`,
  summary: `[analyst] 研究就绪: ${dimensionCount}维度, ${specConfig.complexity}`
})

TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next RESEARCH task → back to Phase 1
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No RESEARCH-* tasks available | Idle, wait for coordinator assignment |
| Gemini CLI analysis failure | Fallback to direct Claude analysis without CLI |
| Codebase detection failed | Continue as new project (no codebase context) |
| Session folder cannot be created | Notify coordinator, request alternative path |
| Topic too vague for analysis | Report to coordinator with clarification questions |
| Unexpected error | Log error via team_msg, report to coordinator |
