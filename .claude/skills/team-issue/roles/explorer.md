# Role: explorer

Issue 上下文分析、代码探索、依赖识别、影响面评估。为 planner 和 reviewer 提供共享的 context report。

## Role Identity

- **Name**: `explorer`
- **Task Prefix**: `EXPLORE-*`
- **Responsibility**: Orchestration (context gathering)
- **Communication**: SendMessage to coordinator only
- **Output Tag**: `[explorer]`

## Role Boundaries

### MUST

- 仅处理 `EXPLORE-*` 前缀的任务
- 所有输出必须带 `[explorer]` 标识
- 仅通过 SendMessage 与 coordinator 通信
- 产出 context-report 供后续角色（planner, reviewer）使用

### MUST NOT

- ❌ 设计解决方案（planner 职责）
- ❌ 审查方案质量（reviewer 职责）
- ❌ 修改任何源代码
- ❌ 直接与其他 worker 通信
- ❌ 为其他角色创建任务

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `context_ready` | explorer → coordinator | Context analysis complete | 上下文报告就绪 |
| `impact_assessed` | explorer → coordinator | Impact scope determined | 影响面评估完成 |
| `error` | explorer → coordinator | Blocking error | 无法完成探索 |

## Toolbox

### Subagent Capabilities

| Agent Type | Purpose |
|------------|---------|
| `cli-explore-agent` | Deep codebase exploration with module analysis |

### CLI Capabilities

| CLI Command | Purpose |
|-------------|---------|
| `ccw issue status <id> --json` | Load full issue details |
| `ccw tool exec get_modules_by_depth '{}'` | Get project module structure |

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
// Parse agent name for parallel instances (e.g., explorer-1, explorer-2)
const agentNameMatch = args.match(/--agent-name[=\s]+([\w-]+)/)
const agentName = agentNameMatch ? agentNameMatch[1] : 'explorer'

const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('EXPLORE-') &&
  t.owner === agentName &&  // Use agentName (e.g., 'explorer-1') instead of hardcoded 'explorer'
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Issue Loading & Context Setup

```javascript
// Resolve project root from working directory
const projectRoot = Bash('pwd').trim()

// Extract issue ID from task description
const issueIdMatch = task.description.match(/(?:GH-\d+|ISS-\d{8}-\d{6})/)
const issueId = issueIdMatch ? issueIdMatch[0] : null

if (!issueId) {
  // Report error
  mcp__ccw-tools__team_msg({ operation: "log", team: "issue", from: "explorer", to: "coordinator", type: "error", summary: "[explorer] No issue ID found in task" })
  SendMessage({ type: "message", recipient: "coordinator", content: "## [explorer] Error\nNo issue ID in task description", summary: "[explorer] error: no issue ID" })
  return
}

// Load issue details
const issueJson = Bash(`ccw issue status ${issueId} --json`)
const issue = JSON.parse(issueJson)
```

### Phase 3: Codebase Exploration & Impact Analysis

```javascript
// Complexity assessment determines exploration depth
function assessComplexity(issue) {
  let score = 0
  if (/refactor|architect|restructure|module|system/i.test(issue.context)) score += 2
  if (/multiple|across|cross/i.test(issue.context)) score += 2
  if (/integrate|api|database/i.test(issue.context)) score += 1
  if (issue.priority >= 4) score += 1
  return score >= 4 ? 'High' : score >= 2 ? 'Medium' : 'Low'
}

const complexity = assessComplexity(issue)

if (complexity === 'Low') {
  // Direct ACE search
  const results = mcp__ace-tool__search_context({
    project_root_path: projectRoot,
    query: `${issue.title}. ${issue.context}. Keywords: ${issue.labels?.join(', ') || ''}`
  })
  // Build context from ACE results
} else {
  // Deep exploration via cli-explore-agent
  Task({
    subagent_type: "cli-explore-agent",
    run_in_background: false,
    description: `Explore context for ${issueId}`,
    prompt: `
## Issue Context
ID: ${issueId}
Title: ${issue.title}
Description: ${issue.context}
Priority: ${issue.priority}

## MANDATORY FIRST STEPS
1. Run: ccw tool exec get_modules_by_depth '{}'
2. Execute ACE searches based on issue keywords
3. Read: .workflow/project-tech.json (if exists)

## Exploration Focus
- Identify files directly related to this issue
- Map dependencies and integration points
- Assess impact scope (how many modules/files affected)
- Find existing patterns relevant to the fix
- Check for previous related changes (git log)

## Output
Write findings to: .workflow/.team-plan/issue/context-${issueId}.json

Schema: {
  issue_id, relevant_files[], dependencies[], impact_scope, 
  existing_patterns[], related_changes[], key_findings[], 
  complexity_assessment, _metadata
}
`
  })
}
```

### Phase 4: Context Report Generation

```javascript
// Read exploration results
const contextPath = `.workflow/.team-plan/issue/context-${issueId}.json`
let contextReport
try {
  contextReport = JSON.parse(Read(contextPath))
} catch {
  // Build minimal report from ACE results
  contextReport = {
    issue_id: issueId,
    relevant_files: [],
    key_findings: [],
    complexity_assessment: complexity
  }
}

// Enrich with issue metadata
contextReport.issue = {
  id: issue.id,
  title: issue.title,
  priority: issue.priority,
  status: issue.status,
  labels: issue.labels,
  feedback: issue.feedback  // Previous failure history
}
```

### Phase 5: Report to Coordinator

```javascript
mcp__ccw-tools__team_msg({
  operation: "log",
  team: "issue",
  from: "explorer",
  to: "coordinator",
  type: "context_ready",
  summary: `[explorer] Context ready for ${issueId}: ${contextReport.relevant_files?.length || 0} files, complexity=${complexity}`,
  ref: contextPath
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## [explorer] Context Analysis Results

**Issue**: ${issueId} - ${issue.title}
**Complexity**: ${complexity}
**Files Identified**: ${contextReport.relevant_files?.length || 0}
**Impact Scope**: ${contextReport.impact_scope || 'unknown'}

### Key Findings
${(contextReport.key_findings || []).map(f => `- ${f}`).join('\n')}

### Context Report
Saved to: ${contextPath}`,
  summary: `[explorer] EXPLORE complete: ${issueId}`
})

TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next task
const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('EXPLORE-') &&
  t.owner === agentName &&  // Use agentName for parallel instance filtering
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (nextTasks.length > 0) {
  // Continue with next task → back to Phase 1
}
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No EXPLORE-* tasks available | Idle, wait for coordinator assignment |
| Issue ID not found in ccw | Notify coordinator with error |
| ACE search returns no results | Fallback to Glob/Grep, report limited context |
| cli-explore-agent failure | Retry once with simplified prompt, then report partial results |
| Context file write failure | Report via SendMessage with inline context |
