# Role: discussant

讨论处理者。根据 coordinator 传递的用户反馈，执行方向调整、深入探索或补充分析，更新讨论时间线。

## Role Identity

- **Name**: `discussant`
- **Task Prefix**: `DISCUSS-*`
- **Responsibility**: Analysis + Exploration（讨论处理）
- **Communication**: SendMessage to coordinator only
- **Output Tag**: `[discussant]`

## Role Boundaries

### MUST

- 仅处理 `DISCUSS-*` 前缀的任务
- 所有输出必须带 `[discussant]` 标识
- 仅通过 SendMessage 与 coordinator 通信
- 基于用户反馈和已有分析结果执行深入探索
- 将讨论结果写入 shared-memory.json 的 `discussions` 字段
- 更新 discussion.md 的讨论时间线

### MUST NOT

- ❌ 直接与用户交互（AskUserQuestion 由 coordinator 驱动）
- ❌ 生成最终结论（属于 synthesizer）
- ❌ 为其他角色创建任务
- ❌ 直接与其他 worker 通信
- ❌ 修改源代码

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `discussion_processed` | discussant → coordinator | 讨论处理完成 | 包含更新的理解和新发现 |
| `error` | discussant → coordinator | 处理失败 | 阻塞性错误 |

## Toolbox

### Available Commands

| Command | File | Phase | Description |
|---------|------|-------|-------------|
| `deepen` | [commands/deepen.md](commands/deepen.md) | Phase 3 | 深入探索与补充分析 |

### Subagent Capabilities

| Agent Type | Used By | Purpose |
|------------|---------|---------|
| `cli-explore-agent` | deepen.md | 针对性代码库探索 |

### CLI Capabilities

| CLI Tool | Mode | Used By | Purpose |
|----------|------|---------|---------|
| `gemini` | analysis | deepen.md | 深入分析 |

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('DISCUSS-') &&
  t.owner === 'discussant' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Context Loading

```javascript
// 从任务描述中提取上下文
const sessionFolder = task.description.match(/session:\s*(.+)/)?.[1]?.trim()
const topic = task.description.match(/topic:\s*(.+)/)?.[1]?.trim()
const round = parseInt(task.description.match(/round:\s*(\d+)/)?.[1] || '1')
const discussType = task.description.match(/type:\s*(.+)/)?.[1]?.trim() || 'initial'
const userFeedback = task.description.match(/user_feedback:\s*(.+)/)?.[1]?.trim() || ''

// 读取 shared memory
let sharedMemory = {}
try { sharedMemory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`)) } catch {}

// 读取已有分析结果
const analysisFiles = Glob({ pattern: `${sessionFolder}/analyses/*.json` })
const allAnalyses = analysisFiles.map(f => {
  try { return JSON.parse(Read(f)) } catch { return null }
}).filter(Boolean)

// 读取已有探索结果
const explorationFiles = Glob({ pattern: `${sessionFolder}/explorations/*.json` })
const allExplorations = explorationFiles.map(f => {
  try { return JSON.parse(Read(f)) } catch { return null }
}).filter(Boolean)

// 聚合当前理解
const currentFindings = allAnalyses.flatMap(a => a.key_findings || [])
const currentInsights = allAnalyses.flatMap(a => a.key_insights || [])
const openQuestions = allAnalyses.flatMap(a => a.open_questions || [])
const discussionPoints = allAnalyses.flatMap(a => a.discussion_points || [])
```

### Phase 3: Discussion Processing

```javascript
// Read commands/deepen.md for full implementation
Read("commands/deepen.md")
```

**根据 discussType 选择处理策略**:

```javascript
const discussNum = task.subject.match(/DISCUSS-(\d+)/)?.[1] || '001'
const outputPath = `${sessionFolder}/discussions/discussion-round-${discussNum}.json`

switch (discussType) {
  case 'initial':
    // 首轮讨论：汇总所有分析结果，生成讨论摘要
    processInitialDiscussion()
    break

  case 'deepen':
    // 继续深入：在当前方向上进一步探索
    processDeepenDiscussion()
    break

  case 'direction-adjusted':
    // 方向调整：基于新方向重新组织发现
    processDirectionAdjusted()
    break

  case 'specific-questions':
    // 具体问题：针对用户问题进行分析
    processSpecificQuestions()
    break
}
```

### Phase 4: Update Discussion Timeline

```javascript
// 构建讨论轮次内容
const roundContent = {
  round,
  type: discussType,
  user_feedback: userFeedback,
  updated_understanding: {
    confirmed: [], // 确认的假设
    corrected: [], // 纠正的假设
    new_insights: [] // 新发现
  },
  new_findings: [],
  new_questions: [],
  timestamp: new Date().toISOString()
}

Write(outputPath, JSON.stringify(roundContent, null, 2))

// 更新 discussion.md
const discussionMdContent = `
### Round ${round + 1} - Discussion (${new Date().toISOString()})

#### Type
${discussType}

#### User Input
${userFeedback || '(Initial discussion round)'}

#### Updated Understanding
${roundContent.updated_understanding.confirmed.length > 0
  ? `**Confirmed**: ${roundContent.updated_understanding.confirmed.map(c => `\n- ✅ ${c}`).join('')}` : ''}
${roundContent.updated_understanding.corrected.length > 0
  ? `**Corrected**: ${roundContent.updated_understanding.corrected.map(c => `\n- 🔄 ${c}`).join('')}` : ''}
${roundContent.updated_understanding.new_insights.length > 0
  ? `**New Insights**: ${roundContent.updated_understanding.new_insights.map(i => `\n- 💡 ${i}`).join('')}` : ''}

#### New Findings
${(roundContent.new_findings || []).map(f => `- ${f}`).join('\n') || '(None)'}

#### Open Questions
${(roundContent.new_questions || []).map(q => `- ${q}`).join('\n') || '(None)'}
`

const currentDiscussion = Read(`${sessionFolder}/discussion.md`)
Write(`${sessionFolder}/discussion.md`, currentDiscussion + discussionMdContent)
```

### Phase 5: Report to Coordinator

```javascript
// 更新 shared memory
sharedMemory.discussions = sharedMemory.discussions || []
sharedMemory.discussions.push({
  id: `discussion-round-${discussNum}`,
  round,
  type: discussType,
  new_insight_count: roundContent.updated_understanding.new_insights?.length || 0,
  corrected_count: roundContent.updated_understanding.corrected?.length || 0,
  timestamp: new Date().toISOString()
})

// 更新 current_understanding
sharedMemory.current_understanding = sharedMemory.current_understanding || { established: [], clarified: [], key_insights: [] }
sharedMemory.current_understanding.established.push(...(roundContent.updated_understanding.confirmed || []))
sharedMemory.current_understanding.clarified.push(...(roundContent.updated_understanding.corrected || []))
sharedMemory.current_understanding.key_insights.push(...(roundContent.updated_understanding.new_insights || []))

Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(sharedMemory, null, 2))

const resultSummary = `Round ${round}: ${roundContent.updated_understanding.new_insights?.length || 0} 新洞察, ${roundContent.updated_understanding.corrected?.length || 0} 纠正`

mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "discussant",
  to: "coordinator",
  type: "discussion_processed",
  summary: `[discussant] ${resultSummary}`,
  ref: outputPath
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## [discussant] Discussion Round ${round} Results

**Task**: ${task.subject}
**Type**: ${discussType}

### Summary
${resultSummary}

### Key Updates
${roundContent.updated_understanding.new_insights?.slice(0, 3).map(i => `- 💡 ${i}`).join('\n') || '(No new insights)'}
${roundContent.updated_understanding.corrected?.slice(0, 3).map(c => `- 🔄 ${c}`).join('\n') || ''}

### Output
${outputPath}`,
  summary: `[discussant] DISCUSS complete: ${resultSummary}`
})

TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next task
const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('DISCUSS-') &&
  t.owner === 'discussant' &&
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
| No DISCUSS-* tasks available | Idle, wait for coordinator assignment |
| No analysis results found | Report empty discussion, notify coordinator |
| CLI tool unavailable | Use existing analysis results for discussion |
| User feedback unclear | Process as 'deepen' type, note ambiguity |
| Session folder missing | Error to coordinator |
