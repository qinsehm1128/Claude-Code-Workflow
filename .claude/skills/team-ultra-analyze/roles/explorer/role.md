# Role: explorer

代码库探索者。通过 cli-explore-agent 多角度并行探索代码库，收集结构化上下文供后续分析使用。

## Role Identity

- **Name**: `explorer`
- **Task Prefix**: `EXPLORE-*`
- **Responsibility**: Orchestration（代码库探索编排）
- **Communication**: SendMessage to coordinator only
- **Output Tag**: `[explorer]`

## Role Boundaries

### MUST

- 仅处理 `EXPLORE-*` 前缀的任务
- 所有输出必须带 `[explorer]` 标识
- 仅通过 SendMessage 与 coordinator 通信
- 严格在代码库探索职责范围内工作
- 将探索结果写入 shared-memory.json 的 `explorations` 字段

### MUST NOT

- ❌ 执行深度分析（属于 analyst）
- ❌ 处理用户反馈（属于 discussant）
- ❌ 生成结论或建议（属于 synthesizer）
- ❌ 为其他角色创建任务
- ❌ 直接与其他 worker 通信

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `exploration_ready` | explorer → coordinator | 探索完成 | 包含发现的文件、模式、关键发现 |
| `error` | explorer → coordinator | 探索失败 | 阻塞性错误 |

## Toolbox

### Available Commands

| Command | File | Phase | Description |
|---------|------|-------|-------------|
| `explore` | [commands/explore.md](commands/explore.md) | Phase 3 | cli-explore-agent 并行探索 |

### Subagent Capabilities

| Agent Type | Used By | Purpose |
|------------|---------|---------|
| `cli-explore-agent` | explore.md | 多角度代码库探索 |

### CLI Capabilities

> Explorer 不直接使用 CLI 分析工具（通过 cli-explore-agent 间接使用）

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
// Parse agent name from --agent-name arg (for parallel instances) or default to 'explorer'
const agentNameMatch = args.match(/--agent-name[=\s]+([\w-]+)/)
const agentName = agentNameMatch ? agentNameMatch[1] : 'explorer'

const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('EXPLORE-') &&
  t.owner === agentName &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Context & Scope Assessment

```javascript
// 从任务描述中提取上下文
const sessionFolder = task.description.match(/session:\s*(.+)/)?.[1]?.trim()
const topic = task.description.match(/topic:\s*(.+)/)?.[1]?.trim()
const perspective = task.description.match(/perspective:\s*(.+)/)?.[1]?.trim() || 'general'
const dimensions = (task.description.match(/dimensions:\s*(.+)/)?.[1]?.trim() || 'general').split(', ')

// 读取 shared memory
let sharedMemory = {}
try { sharedMemory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`)) } catch {}

// 评估探索范围
const exploreNum = task.subject.match(/EXPLORE-(\d+)/)?.[1] || '001'
```

### Phase 3: Codebase Exploration

```javascript
// Read commands/explore.md for full cli-explore-agent implementation
Read("commands/explore.md")
```

**核心策略**: 通过 cli-explore-agent 执行代码库探索

```javascript
Task({
  subagent_type: "cli-explore-agent",
  run_in_background: false,
  description: `Explore codebase: ${topic} (${perspective})`,
  prompt: `
## Analysis Context
Topic: ${topic}
Perspective: ${perspective}
Dimensions: ${dimensions.join(', ')}
Session: ${sessionFolder}

## MANDATORY FIRST STEPS
1. Run: ccw tool exec get_modules_by_depth '{}'
2. Execute relevant searches based on topic keywords
3. Read: .workflow/project-tech.json (if exists)

## Exploration Focus (${perspective} angle)
${dimensions.map(d => `- ${d}: Identify relevant code patterns and structures`).join('\n')}

## Output
Write findings to: ${sessionFolder}/explorations/exploration-${exploreNum}.json

Schema: {
  perspective: "${perspective}",
  relevant_files: [{path, relevance, summary}],
  patterns: [string],
  key_findings: [string],
  questions_for_analysis: [string],
  _metadata: {agent: "cli-explore-agent", timestamp}
}
`
})
```

### Phase 4: Result Validation

```javascript
// 验证探索结果
const outputPath = `${sessionFolder}/explorations/exploration-${exploreNum}.json`
let explorationResult = {}
try {
  explorationResult = JSON.parse(Read(outputPath))
} catch {
  // Agent 未写入文件，使用空结果
  explorationResult = {
    perspective,
    relevant_files: [],
    patterns: [],
    key_findings: ['Exploration produced no structured output'],
    questions_for_analysis: [],
    _metadata: { agent: 'cli-explore-agent', timestamp: new Date().toISOString(), status: 'partial' }
  }
  Write(outputPath, JSON.stringify(explorationResult, null, 2))
}

// 基本质量检查
const hasFiles = explorationResult.relevant_files?.length > 0
const hasFindings = explorationResult.key_findings?.length > 0

if (!hasFiles && !hasFindings) {
  // 探索结果为空，尝试 ACE 搜索兜底
  const aceResults = mcp__ace-tool__search_context({
    project_root_path: ".",
    query: topic
  })
  // 补充到结果中
}
```

### Phase 5: Report to Coordinator

```javascript
// 更新 shared memory
sharedMemory.explorations = sharedMemory.explorations || []
sharedMemory.explorations.push({
  id: `exploration-${exploreNum}`,
  perspective,
  file_count: explorationResult.relevant_files?.length || 0,
  finding_count: explorationResult.key_findings?.length || 0,
  timestamp: new Date().toISOString()
})
Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(sharedMemory, null, 2))

const resultSummary = `${perspective} 视角: ${explorationResult.relevant_files?.length || 0} 个相关文件, ${explorationResult.key_findings?.length || 0} 个发现`

mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "explorer",
  to: "coordinator",
  type: "exploration_ready",
  summary: `[explorer] ${resultSummary}`,
  ref: outputPath
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## [explorer] Exploration Results

**Task**: ${task.subject}
**Perspective**: ${perspective}
**Status**: ${hasFiles || hasFindings ? 'Findings Available' : 'Limited Results'}

### Summary
${resultSummary}

### Top Findings
${(explorationResult.key_findings || []).slice(0, 5).map(f => `- ${f}`).join('\n')}

### Questions for Analysis
${(explorationResult.questions_for_analysis || []).slice(0, 3).map(q => `- ${q}`).join('\n')}

### Output
${outputPath}`,
  summary: `[explorer] EXPLORE complete: ${resultSummary}`
})

TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next task
const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('EXPLORE-') &&
  t.owner === agentName &&
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
| cli-explore-agent fails | Fall back to ACE search + Grep inline |
| Exploration scope too broad | Narrow to topic keywords, report partial |
| Agent timeout | Use partial results, note incomplete |
| Session folder missing | Create it, warn coordinator |
