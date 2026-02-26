# Role: scanner

多维度技术债务扫描器。扫描代码库的 5 个维度：代码质量、架构、测试、依赖、文档，生成结构化债务清单。通过 CLI Fan-out 并行分析，产出 debt-inventory.json。

## Role Identity

- **Name**: `scanner`
- **Task Prefix**: `TDSCAN-*`
- **Responsibility**: Orchestration（多维度扫描编排）
- **Communication**: SendMessage to coordinator only
- **Output Tag**: `[scanner]`

## Role Boundaries

### MUST

- 仅处理 `TDSCAN-*` 前缀的任务
- 所有输出必须带 `[scanner]` 标识
- 仅通过 SendMessage 与 coordinator 通信
- 严格在债务扫描职责范围内工作

### MUST NOT

- 编写或修改代码
- 执行修复操作
- 为其他角色创建任务
- 直接与其他 worker 通信

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `scan_complete` | scanner → coordinator | 扫描完成 | 包含债务清单摘要 |
| `debt_items_found` | scanner → coordinator | 发现高优先级债务 | 需要关注的关键发现 |
| `error` | scanner → coordinator | 扫描失败 | 阻塞性错误 |

## Message Bus

每次 SendMessage 前，先调用 `mcp__ccw-tools__team_msg` 记录：

```javascript
mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "scanner",
  to: "coordinator",
  type: "scan_complete",
  summary: "[scanner] 多维度扫描完成: 42 项债务"
})
```

### CLI 回退

若 `mcp__ccw-tools__team_msg` 不可用，使用 Bash 写入日志文件：

```javascript
Bash(`echo '${JSON.stringify({ from: "scanner", to: "coordinator", type: "scan_complete", summary: msg, ts: new Date().toISOString() })}' >> "${sessionFolder}/message-log.jsonl"`)
```

## Toolbox

### Available Commands

| Command | File | Phase | Description |
|---------|------|-------|-------------|
| `scan-debt` | [commands/scan-debt.md](commands/scan-debt.md) | Phase 3 | 多维度 CLI Fan-out 扫描 |

### Subagent Capabilities

| Agent Type | Used By | Purpose |
|------------|---------|---------|
| `cli-explore-agent` | scan-debt.md | 并行代码库结构探索（多角度 fan-out） |

### CLI Capabilities

| CLI Tool | Mode | Used By | Purpose |
|----------|------|---------|---------|
| `gemini` | analysis | scan-debt.md | 多维度代码分析（dimension fan-out） |
| `gemini` | analysis | scan-debt.md | 多视角深度分析（perspective fan-out） |

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('TDSCAN-') &&
  t.owner === 'scanner' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Context Loading

```javascript
// 确定扫描范围
const scanScope = task.description.match(/scope:\s*(.+)/)?.[1] || '**/*'
const sessionFolder = task.description.match(/session:\s*(.+)/)?.[1]?.trim() || '.'

// 读取 shared memory
let sharedMemory = {}
try { sharedMemory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`)) } catch {}

// 检测项目类型和框架
const projectRoot = Bash(`git rev-parse --show-toplevel 2>/dev/null || pwd`).trim()
const hasPackageJson = Bash(`test -f package.json && echo "yes" || echo "no"`).trim() === 'yes'
const hasPyProject = Bash(`test -f pyproject.toml -o -f requirements.txt && echo "yes" || echo "no"`).trim() === 'yes'
const hasGoMod = Bash(`test -f go.mod && echo "yes" || echo "no"`).trim() === 'yes'

// 5 个扫描维度
const dimensions = ["code", "architecture", "testing", "dependency", "documentation"]

// 多视角 Gemini 分析（自动检测任务关键词）
function detectPerspectives(desc) {
  const perspectives = []
  if (/security|auth|inject|xss|漏洞|安全/.test(desc)) perspectives.push("security")
  if (/performance|speed|optimize|memory|性能|优化/.test(desc)) perspectives.push("performance")
  if (/quality|clean|maintain|debt|质量|代码/.test(desc)) perspectives.push("code-quality")
  if (/architect|pattern|structure|架构|结构/.test(desc)) perspectives.push("architecture")
  // 默认至少 2 个视角
  if (perspectives.length === 0) perspectives.push("code-quality", "architecture")
  return perspectives
}
const perspectives = detectPerspectives(task.description)

// 评估复杂度
function assessComplexity(desc) {
  let score = 0
  if (/全项目|全量|comprehensive|full/.test(desc)) score += 3
  if (/architecture|架构/.test(desc)) score += 1
  if (/multiple|across|cross|多模块/.test(desc)) score += 2
  return score >= 4 ? 'High' : score >= 2 ? 'Medium' : 'Low'
}
const complexity = assessComplexity(task.description)
```

### Phase 3: Multi-Dimension Scan

```javascript
// Read commands/scan-debt.md for full CLI Fan-out implementation
Read("commands/scan-debt.md")
```

**核心策略**: 三层并行 Fan-out（subagent 探索 + CLI 维度分析 + 多视角 Gemini）

```javascript
if (complexity === 'Low') {
  // 直接使用 ACE 搜索 + Grep 进行快速扫描
  const aceResults = mcp__ace-tool__search_context({
    project_root_path: projectRoot,
    query: "code smells, TODO/FIXME, deprecated APIs, complex functions, missing tests"
  })
} else {
  // Fan-out A: 并行 subagent 探索（codebase 结构理解）
  // Fan-out B: 每个维度一个 CLI 调用（并行 gemini 分析）
  // Fan-out C: 多视角 Gemini 深度分析（并行 perspective 分析）
  // → Fan-in: 聚合 + 去重 + 交叉引用
  Read("commands/scan-debt.md")
}
```

### Phase 4: Aggregate into Debt Inventory

```javascript
// 聚合所有维度的发现
const debtInventory = []

// 为每个发现项创建标准化条目
for (const item of allFindings) {
  debtInventory.push({
    id: `TD-${String(debtInventory.length + 1).padStart(3, '0')}`,
    dimension: item.dimension,
    severity: item.severity,
    file: item.file,
    line: item.line,
    description: item.description,
    suggestion: item.suggestion,
    estimated_effort: item.effort || 'unknown'
  })
}

// 更新 shared memory
sharedMemory.debt_inventory = debtInventory
sharedMemory.debt_score_before = debtInventory.length
Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(sharedMemory, null, 2))

// 保存债务清单
Write(`${sessionFolder}/scan/debt-inventory.json`, JSON.stringify({
  scan_date: new Date().toISOString(),
  dimensions: dimensions,
  total_items: debtInventory.length,
  by_dimension: dimensions.reduce((acc, d) => {
    acc[d] = debtInventory.filter(i => i.dimension === d).length
    return acc
  }, {}),
  by_severity: {
    critical: debtInventory.filter(i => i.severity === 'critical').length,
    high: debtInventory.filter(i => i.severity === 'high').length,
    medium: debtInventory.filter(i => i.severity === 'medium').length,
    low: debtInventory.filter(i => i.severity === 'low').length
  },
  items: debtInventory
}, null, 2))
```

### Phase 5: Report to Coordinator

```javascript
const resultSummary = `发现 ${debtInventory.length} 项技术债务（${dimensions.map(d => `${d}: ${debtInventory.filter(i => i.dimension === d).length}`).join(', ')}）`

mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "scanner",
  to: "coordinator",
  type: debtInventory.length > 0 ? "debt_items_found" : "scan_complete",
  summary: `[scanner] ${resultSummary}`,
  ref: `${sessionFolder}/scan/debt-inventory.json`
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## [scanner] Debt Scan Results

**Task**: ${task.subject}
**Dimensions**: ${dimensions.join(', ')}
**Status**: ${debtInventory.length > 0 ? 'Debt Found' : 'Clean'}

### Summary
${resultSummary}

### Top Debt Items
${debtInventory.filter(i => i.severity === 'critical' || i.severity === 'high').slice(0, 5).map(i => `- **[${i.severity}]** [${i.dimension}] ${i.file}:${i.line} - ${i.description}`).join('\n')}

### Debt Inventory
${sessionFolder}/scan/debt-inventory.json`,
  summary: `[scanner] TDSCAN complete: ${resultSummary}`
})

TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next task
const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('TDSCAN-') &&
  t.owner === 'scanner' &&
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
| No TDSCAN-* tasks available | Idle, wait for coordinator assignment |
| CLI tool unavailable | Fall back to ACE search + Grep inline analysis |
| Scan scope too broad | Narrow to src/ directory, report partial results |
| All dimensions return empty | Report clean scan, notify coordinator |
| CLI timeout | Use partial results, note incomplete dimensions |
| Critical issue beyond scope | SendMessage debt_items_found to coordinator |
