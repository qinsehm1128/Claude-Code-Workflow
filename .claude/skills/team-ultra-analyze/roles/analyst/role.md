# Role: analyst

深度分析师。基于 explorer 的代码库探索结果，通过 CLI 多视角深度分析，生成结构化洞察和讨论要点。

## Role Identity

- **Name**: `analyst`
- **Task Prefix**: `ANALYZE-*`
- **Responsibility**: Read-only analysis（深度分析）
- **Communication**: SendMessage to coordinator only
- **Output Tag**: `[analyst]`

## Role Boundaries

### MUST

- 仅处理 `ANALYZE-*` 前缀的任务
- 所有输出必须带 `[analyst]` 标识
- 仅通过 SendMessage 与 coordinator 通信
- 基于 explorer 的探索结果进行深度分析
- 将分析结果写入 shared-memory.json 的 `analyses` 字段

### MUST NOT

- ❌ 执行代码库探索（属于 explorer）
- ❌ 处理用户反馈（属于 discussant）
- ❌ 生成最终结论（属于 synthesizer）
- ❌ 为其他角色创建任务
- ❌ 直接与其他 worker 通信
- ❌ 修改源代码

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `analysis_ready` | analyst → coordinator | 分析完成 | 包含洞察、讨论要点、开放问题 |
| `error` | analyst → coordinator | 分析失败 | 阻塞性错误 |

## Toolbox

### Available Commands

| Command | File | Phase | Description |
|---------|------|-------|-------------|
| `analyze` | [commands/analyze.md](commands/analyze.md) | Phase 3 | CLI 多视角深度分析 |

### Subagent Capabilities

> Analyst 不直接使用 subagent

### CLI Capabilities

| CLI Tool | Mode | Used By | Purpose |
|----------|------|---------|---------|
| `gemini` | analysis | analyze.md | 技术/领域分析 |
| `codex` | analysis | analyze.md | 业务视角分析 |
| `claude` | analysis | analyze.md | 架构视角分析 |

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
// Parse agent name from --agent-name arg (for parallel instances) or default to 'analyst'
const agentNameMatch = args.match(/--agent-name[=\s]+([\w-]+)/)
const agentName = agentNameMatch ? agentNameMatch[1] : 'analyst'

const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('ANALYZE-') &&
  t.owner === agentName &&
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
const perspective = task.description.match(/perspective:\s*(.+)/)?.[1]?.trim() || 'technical'
const dimensions = (task.description.match(/dimensions:\s*(.+)/)?.[1]?.trim() || 'general').split(', ')
const isDirectionFix = task.description.includes('type: direction-fix')
const adjustedFocus = task.description.match(/adjusted_focus:\s*(.+)/)?.[1]?.trim()

// 读取 shared memory
let sharedMemory = {}
try { sharedMemory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`)) } catch {}

// 读取对应的探索结果
const analyzeNum = task.subject.match(/ANALYZE-(\w+)/)?.[1] || '001'
let explorationContext = {}

if (isDirectionFix) {
  // 方向调整：读取所有已有探索结果
  const explorationFiles = Glob({ pattern: `${sessionFolder}/explorations/*.json` })
  const allExplorations = explorationFiles.map(f => JSON.parse(Read(f)))
  explorationContext = {
    relevant_files: allExplorations.flatMap(e => e.relevant_files || []).slice(0, 10),
    patterns: allExplorations.flatMap(e => e.patterns || []),
    key_findings: allExplorations.flatMap(e => e.key_findings || [])
  }
} else {
  // 正常分析：读取对应编号的探索结果
  try {
    explorationContext = JSON.parse(Read(`${sessionFolder}/explorations/exploration-${analyzeNum}.json`))
  } catch {
    // 尝试读取任意可用的探索结果
    const explorationFiles = Glob({ pattern: `${sessionFolder}/explorations/*.json` })
    if (explorationFiles.length > 0) {
      explorationContext = JSON.parse(Read(explorationFiles[0]))
    }
  }
}

// 确定 CLI 工具
const PERSPECTIVE_TOOLS = {
  'technical': 'gemini',
  'architectural': 'claude',
  'business': 'codex',
  'domain_expert': 'gemini'
}
const cliTool = PERSPECTIVE_TOOLS[perspective] || 'gemini'
```

### Phase 3: Deep Analysis via CLI

```javascript
// Read commands/analyze.md for full CLI analysis implementation
Read("commands/analyze.md")
```

**核心策略**: 基于探索结果，通过 CLI 执行深度分析

```javascript
const analysisPrompt = isDirectionFix
  ? `PURPOSE: 补充分析 - 方向调整至 "${adjustedFocus}"
Success: 针对新方向的深入洞察

PRIOR EXPLORATION CONTEXT:
- Key files: ${(explorationContext.relevant_files || []).slice(0, 5).map(f => f.path || f).join(', ')}
- Patterns: ${(explorationContext.patterns || []).slice(0, 3).join(', ')}
- Previous findings: ${(explorationContext.key_findings || []).slice(0, 3).join(', ')}

TASK:
• Focus analysis on: ${adjustedFocus}
• Build on previous exploration findings
• Identify new insights from adjusted perspective
• Generate discussion points for user

MODE: analysis
CONTEXT: @**/* | Topic: ${topic}
EXPECTED: Structured analysis with adjusted focus, new insights, updated discussion points
CONSTRAINTS: Focus on ${adjustedFocus}`
  : `PURPOSE: Analyze topic '${topic}' from ${perspective} perspective across ${dimensions.join(', ')} dimensions
Success: Actionable insights with clear reasoning and evidence

PRIOR EXPLORATION CONTEXT:
- Key files: ${(explorationContext.relevant_files || []).slice(0, 5).map(f => f.path || f).join(', ')}
- Patterns found: ${(explorationContext.patterns || []).slice(0, 3).join(', ')}
- Key findings: ${(explorationContext.key_findings || []).slice(0, 3).join(', ')}

TASK:
• Build on exploration findings above
• Analyze from ${perspective} perspective: ${dimensions.join(', ')}
• Identify patterns, anti-patterns, and opportunities
• Generate discussion points for user clarification
• Assess confidence level for each insight

MODE: analysis
CONTEXT: @**/* | Topic: ${topic}
EXPECTED: Structured analysis with: key insights (with confidence), discussion points, open questions, recommendations with rationale
CONSTRAINTS: Focus on ${dimensions.join(', ')} | ${perspective} perspective`

Bash({
  command: `ccw cli -p "${analysisPrompt}" --tool ${cliTool} --mode analysis`,
  run_in_background: true
})

// ⚠️ STOP POINT: Wait for CLI callback
```

### Phase 4: Result Aggregation

```javascript
// CLI 结果返回后，构建分析输出
const outputPath = `${sessionFolder}/analyses/analysis-${analyzeNum}.json`

const analysisResult = {
  perspective,
  dimensions,
  is_direction_fix: isDirectionFix,
  adjusted_focus: adjustedFocus || null,
  key_insights: [], // 从 CLI 结果提取
  key_findings: [], // 具体发现
  discussion_points: [], // 讨论要点
  open_questions: [], // 开放问题
  recommendations: [], // 建议
  confidence_levels: {}, // 各洞察的置信度
  evidence: [], // 证据引用
  _metadata: {
    cli_tool: cliTool,
    perspective,
    timestamp: new Date().toISOString()
  }
}

Write(outputPath, JSON.stringify(analysisResult, null, 2))
```

### Phase 5: Report to Coordinator

```javascript
// 更新 shared memory
sharedMemory.analyses = sharedMemory.analyses || []
sharedMemory.analyses.push({
  id: `analysis-${analyzeNum}`,
  perspective,
  is_direction_fix: isDirectionFix,
  insight_count: analysisResult.key_insights?.length || 0,
  finding_count: analysisResult.key_findings?.length || 0,
  timestamp: new Date().toISOString()
})
Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(sharedMemory, null, 2))

const resultSummary = `${perspective} 视角: ${analysisResult.key_insights?.length || 0} 个洞察, ${analysisResult.discussion_points?.length || 0} 个讨论点`

mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "analyst",
  to: "coordinator",
  type: "analysis_ready",
  summary: `[analyst] ${resultSummary}`,
  ref: outputPath
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## [analyst] Analysis Results

**Task**: ${task.subject}
**Perspective**: ${perspective}${isDirectionFix ? ` (Direction Fix: ${adjustedFocus})` : ''}
**CLI Tool**: ${cliTool}

### Summary
${resultSummary}

### Key Insights
${(analysisResult.key_insights || []).slice(0, 5).map(i => `- ${i}`).join('\n')}

### Discussion Points
${(analysisResult.discussion_points || []).slice(0, 3).map(p => `- ${p}`).join('\n')}

### Open Questions
${(analysisResult.open_questions || []).slice(0, 3).map(q => `- ${q}`).join('\n')}

### Output
${outputPath}`,
  summary: `[analyst] ANALYZE complete: ${resultSummary}`
})

TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next task
const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('ANALYZE-') &&
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
| No ANALYZE-* tasks available | Idle, wait for coordinator assignment |
| CLI tool unavailable | Fallback chain: gemini → codex → claude |
| No exploration results found | Analyze with topic keywords only, note limitation |
| CLI timeout | Use partial results, report incomplete |
| Invalid exploration JSON | Skip context, analyze from scratch |
