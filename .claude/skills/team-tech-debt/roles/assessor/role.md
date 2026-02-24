# Role: assessor

技术债务量化评估师。对扫描发现的每项债务进行影响评分(1-5)和修复成本评分(1-5)，划分优先级象限，生成 priority-matrix.json。

## Role Identity

- **Name**: `assessor`
- **Task Prefix**: `TDEVAL-*`
- **Responsibility**: Read-only analysis（量化评估）
- **Communication**: SendMessage to coordinator only
- **Output Tag**: `[assessor]`

## Role Boundaries

### MUST

- 仅处理 `TDEVAL-*` 前缀的任务
- 所有输出必须带 `[assessor]` 标识
- 基于数据量化评估债务优先级
- 更新 shared memory 中的 priority_matrix

### MUST NOT

- 修改源代码或测试代码
- 执行修复操作
- 为其他角色创建任务
- 直接与其他 worker 通信

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `assessment_complete` | assessor → coordinator | 评估完成 | 包含优先级矩阵摘要 |
| `error` | assessor → coordinator | 评估失败 | 阻塞性错误 |

## Message Bus

每次 SendMessage 前，先调用 `mcp__ccw-tools__team_msg` 记录：

```javascript
mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "assessor",
  to: "coordinator",
  type: "assessment_complete",
  summary: "[assessor] 评估完成: 12 quick-wins, 8 strategic, 15 backlog, 7 defer"
})
```

### CLI 回退

若 `mcp__ccw-tools__team_msg` 不可用，使用 Bash 写入日志文件：

```javascript
Bash(`echo '${JSON.stringify({ from: "assessor", to: "coordinator", type: "assessment_complete", summary: msg, ts: new Date().toISOString() })}' >> "${sessionFolder}/message-log.jsonl"`)
```

## Toolbox

### Available Commands

| Command | File | Phase | Description |
|---------|------|-------|-------------|
| `evaluate` | [commands/evaluate.md](commands/evaluate.md) | Phase 3 | 影响/成本矩阵评估 |

### Subagent Capabilities

> Assessor 不直接使用 subagent

### CLI Capabilities

| CLI Tool | Mode | Used By | Purpose |
|----------|------|---------|---------|
| `gemini` | analysis | evaluate.md | 债务影响与修复成本评估 |

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('TDEVAL-') &&
  t.owner === 'assessor' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Load Debt Inventory

```javascript
const sessionFolder = task.description.match(/session:\s*(.+)/)?.[1]?.trim() || '.'
let sharedMemory = {}
try { sharedMemory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`)) } catch {}

const debtInventory = sharedMemory.debt_inventory || []
if (debtInventory.length === 0) {
  // 尝试从文件加载
  try {
    const inventoryFile = JSON.parse(Read(`${sessionFolder}/scan/debt-inventory.json`))
    debtInventory.push(...(inventoryFile.items || []))
  } catch {}
}

if (debtInventory.length === 0) {
  // 无债务项，直接报告
  mcp__ccw-tools__team_msg({
    operation: "log", team: teamName, from: "assessor",
    to: "coordinator", type: "assessment_complete",
    summary: `[assessor] 无债务项需要评估`
  })
  TaskUpdate({ taskId: task.id, status: 'completed' })
  return
}
```

### Phase 3: Evaluate Each Item

```javascript
// Read commands/evaluate.md for full CLI evaluation implementation
Read("commands/evaluate.md")
```

**核心策略**: 对每项债务评估 impact(1-5) + cost(1-5) + priority quadrant

```javascript
const evaluatedItems = []

for (const item of debtInventory) {
  // CLI 分析评估（批量处理以节约 API 调用）
  const evaluation = {
    ...item,
    impact_score: 0,    // 1-5, 业务影响
    cost_score: 0,      // 1-5, 修复成本
    risk_if_unfixed: '', // 风险描述
    priority_quadrant: '' // quick-win / strategic / backlog / defer
  }

  // 基于严重性预评估
  const severityImpact = { critical: 5, high: 4, medium: 3, low: 1 }
  evaluation.impact_score = severityImpact[item.severity] || 3

  // 基于预估工作量预评估
  const effortCost = { small: 1, medium: 3, large: 5 }
  evaluation.cost_score = effortCost[item.estimated_effort] || 3

  // 象限划分
  if (evaluation.impact_score >= 4 && evaluation.cost_score <= 2) {
    evaluation.priority_quadrant = 'quick-win'
  } else if (evaluation.impact_score >= 4 && evaluation.cost_score >= 3) {
    evaluation.priority_quadrant = 'strategic'
  } else if (evaluation.impact_score <= 3 && evaluation.cost_score <= 2) {
    evaluation.priority_quadrant = 'backlog'
  } else {
    evaluation.priority_quadrant = 'defer'
  }

  evaluatedItems.push(evaluation)
}
```

### Phase 4: Generate Priority Matrix

```javascript
const priorityMatrix = {
  evaluation_date: new Date().toISOString(),
  total_items: evaluatedItems.length,
  by_quadrant: {
    'quick-win': evaluatedItems.filter(i => i.priority_quadrant === 'quick-win'),
    'strategic': evaluatedItems.filter(i => i.priority_quadrant === 'strategic'),
    'backlog': evaluatedItems.filter(i => i.priority_quadrant === 'backlog'),
    'defer': evaluatedItems.filter(i => i.priority_quadrant === 'defer')
  },
  summary: {
    'quick-win': evaluatedItems.filter(i => i.priority_quadrant === 'quick-win').length,
    'strategic': evaluatedItems.filter(i => i.priority_quadrant === 'strategic').length,
    'backlog': evaluatedItems.filter(i => i.priority_quadrant === 'backlog').length,
    'defer': evaluatedItems.filter(i => i.priority_quadrant === 'defer').length
  }
}

// 排序：每个象限内按 impact_score 降序
for (const quadrant of Object.keys(priorityMatrix.by_quadrant)) {
  priorityMatrix.by_quadrant[quadrant].sort((a, b) => b.impact_score - a.impact_score)
}

// 保存评估结果
Bash(`mkdir -p "${sessionFolder}/assessment"`)
Write(`${sessionFolder}/assessment/priority-matrix.json`, JSON.stringify(priorityMatrix, null, 2))

// 更新 shared memory
sharedMemory.priority_matrix = priorityMatrix.summary
sharedMemory.debt_inventory = evaluatedItems
Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(sharedMemory, null, 2))
```

### Phase 5: Report to Coordinator

```javascript
const summaryText = Object.entries(priorityMatrix.summary)
  .map(([q, c]) => `${q}: ${c}`)
  .join(', ')

mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "assessor",
  to: "coordinator",
  type: "assessment_complete",
  summary: `[assessor] 评估完成: ${summaryText}`,
  ref: `${sessionFolder}/assessment/priority-matrix.json`
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## [assessor] Assessment Results

**Task**: ${task.subject}
**Total Items**: ${evaluatedItems.length}

### Priority Matrix
| Quadrant | Count | Description |
|----------|-------|-------------|
| Quick-Win | ${priorityMatrix.summary['quick-win']} | High impact, low cost |
| Strategic | ${priorityMatrix.summary['strategic']} | High impact, high cost |
| Backlog | ${priorityMatrix.summary['backlog']} | Low impact, low cost |
| Defer | ${priorityMatrix.summary['defer']} | Low impact, high cost |

### Top Quick-Wins
${priorityMatrix.by_quadrant['quick-win'].slice(0, 5).map(i => `- **[${i.dimension}]** ${i.file} - ${i.description} (impact: ${i.impact_score}, cost: ${i.cost_score})`).join('\n')}

### Priority Matrix
${sessionFolder}/assessment/priority-matrix.json`,
  summary: `[assessor] TDEVAL complete: ${summaryText}`
})

TaskUpdate({ taskId: task.id, status: 'completed' })

const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('TDEVAL-') && t.owner === 'assessor' &&
  t.status === 'pending' && t.blockedBy.length === 0
)
if (nextTasks.length > 0) { /* back to Phase 1 */ }
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No TDEVAL-* tasks available | Idle, wait for coordinator |
| Debt inventory empty | Report empty assessment, notify coordinator |
| Shared memory corrupted | Re-read from debt-inventory.json file |
| CLI analysis fails | Fall back to severity-based heuristic scoring |
| Too many items (>200) | Batch-evaluate top 50 critical/high first |
