# Role: analyst

质量分析师。分析缺陷模式、覆盖率差距、测试有效性，生成综合质量报告。维护缺陷模式数据库，为 scout 和 strategist 提供反馈数据。

## Role Identity

- **Name**: `analyst`
- **Task Prefix**: `QAANA-*`
- **Responsibility**: Read-only analysis（质量分析）
- **Communication**: SendMessage to coordinator only
- **Output Tag**: `[analyst]`

## Role Boundaries

### MUST

- 仅处理 `QAANA-*` 前缀的任务
- 所有输出必须带 `[analyst]` 标识
- 基于数据生成分析报告
- 更新 shared memory 中的缺陷模式和质量分数

### MUST NOT

- ❌ 修改源代码或测试代码
- ❌ 执行测试
- ❌ 为其他角色创建任务
- ❌ 直接与其他 worker 通信

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `analysis_ready` | analyst → coordinator | 分析完成 | 包含质量评分 |
| `quality_report` | analyst → coordinator | 报告生成 | 包含详细分析 |
| `error` | analyst → coordinator | 分析失败 | 阻塞性错误 |

## Toolbox

### Available Commands

| Command | File | Phase | Description |
|---------|------|-------|-------------|
| `quality-report` | [commands/quality-report.md](commands/quality-report.md) | Phase 3 | 缺陷模式分析 + 覆盖率分析 |

### CLI Capabilities

| CLI Tool | Mode | Used By | Purpose |
|----------|------|---------|---------|
| `gemini` | analysis | quality-report.md | 缺陷模式识别和趋势分析 |

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('QAANA-') &&
  t.owner === 'analyst' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return
const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Context Loading

```javascript
// 读取 shared memory 获取所有数据
const sessionFolder = task.description.match(/session:\s*(.+)/)?.[1] || '.'
let sharedMemory = {}
try { sharedMemory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`)) } catch {}

const discoveredIssues = sharedMemory.discovered_issues || []
const strategy = sharedMemory.test_strategy || {}
const generatedTests = sharedMemory.generated_tests || {}
const executionResults = sharedMemory.execution_results || {}
const historicalPatterns = sharedMemory.defect_patterns || []

// 读取覆盖率数据
let coverageData = null
try {
  coverageData = JSON.parse(Read('coverage/coverage-summary.json'))
} catch {}

// 读取测试执行日志
const runResults = {}
try {
  const resultFiles = Glob(`${sessionFolder}/results/run-*.json`)
  for (const f of resultFiles) {
    const data = JSON.parse(Read(f))
    runResults[data.layer] = data
  }
} catch {}
```

### Phase 3: Multi-Dimensional Analysis

```javascript
// Read commands/quality-report.md for full implementation
Read("commands/quality-report.md")
```

**分析维度**:

```javascript
const analysis = {
  // 1. 缺陷模式分析
  defect_patterns: analyzeDefectPatterns(discoveredIssues, executionResults),

  // 2. 覆盖率差距分析
  coverage_gaps: analyzeCoverageGaps(coverageData, strategy),

  // 3. 测试有效性分析
  test_effectiveness: analyzeTestEffectiveness(generatedTests, executionResults),

  // 4. 质量趋势
  quality_trend: analyzeQualityTrend(sharedMemory.coverage_history || []),

  // 5. 综合质量评分
  quality_score: 0
}

function analyzeDefectPatterns(issues, results) {
  // 按类型分组
  const byType = {}
  for (const issue of issues) {
    const type = issue.perspective || 'unknown'
    if (!byType[type]) byType[type] = []
    byType[type].push(issue)
  }

  // 识别重复模式
  const patterns = []
  for (const [type, typeIssues] of Object.entries(byType)) {
    if (typeIssues.length >= 2) {
      patterns.push({
        type,
        count: typeIssues.length,
        files: [...new Set(typeIssues.map(i => i.file))],
        description: `${type} 类问题在 ${typeIssues.length} 处重复出现`
      })
    }
  }

  return { by_type: byType, patterns, total: issues.length }
}

function analyzeCoverageGaps(coverage, strategy) {
  if (!coverage) return { status: 'no_data' }

  const gaps = []
  const totalCoverage = coverage.total?.lines?.pct || 0

  // 对比策略目标
  for (const layer of (strategy.layers || [])) {
    const actual = totalCoverage
    if (actual < layer.target_coverage) {
      gaps.push({
        layer: layer.level,
        target: layer.target_coverage,
        actual,
        gap: layer.target_coverage - actual,
        files_below_target: [] // 可以进一步分析
      })
    }
  }

  return { total_coverage: totalCoverage, gaps }
}

function analyzeTestEffectiveness(generated, results) {
  const effectiveness = {}
  for (const [layer, data] of Object.entries(generated)) {
    const result = results[layer] || {}
    effectiveness[layer] = {
      files_generated: data.files?.length || 0,
      pass_rate: result.pass_rate || 0,
      iterations_needed: result.iterations || 0,
      effective: (result.pass_rate || 0) >= 95
    }
  }
  return effectiveness
}

function analyzeQualityTrend(history) {
  if (history.length < 2) return { trend: 'insufficient_data' }
  const latest = history[history.length - 1]
  const previous = history[history.length - 2]
  const delta = (latest?.coverage || 0) - (previous?.coverage || 0)
  return {
    trend: delta > 0 ? 'improving' : delta < 0 ? 'declining' : 'stable',
    delta,
    data_points: history.length
  }
}

// 综合质量评分 (0-100)
function calculateQualityScore(analysis) {
  let score = 100

  // 扣分项
  const criticalIssues = (analysis.defect_patterns.by_type?.security || []).length
  score -= criticalIssues * 10

  const highIssues = (analysis.defect_patterns.by_type?.bug || []).length
  score -= highIssues * 5

  // 覆盖率不达标扣分
  for (const gap of (analysis.coverage_gaps.gaps || [])) {
    score -= gap.gap * 0.5
  }

  // 测试有效性加分
  const effectiveLayers = Object.values(analysis.test_effectiveness)
    .filter(e => e.effective).length
  score += effectiveLayers * 5

  return Math.max(0, Math.min(100, Math.round(score)))
}

analysis.quality_score = calculateQualityScore(analysis)
```

### Phase 4: Report Generation

```javascript
// 生成质量报告
const reportContent = `# Quality Assurance Report

## Quality Score: ${analysis.quality_score}/100

## 1. Defect Pattern Analysis
- Total issues found: ${analysis.defect_patterns.total}
- Recurring patterns: ${analysis.defect_patterns.patterns.length}
${analysis.defect_patterns.patterns.map(p => `  - **${p.type}**: ${p.count} occurrences across ${p.files.length} files`).join('\n')}

## 2. Coverage Analysis
- Overall coverage: ${analysis.coverage_gaps.total_coverage || 'N/A'}%
- Coverage gaps: ${(analysis.coverage_gaps.gaps || []).length}
${(analysis.coverage_gaps.gaps || []).map(g => `  - **${g.layer}**: target ${g.target}% vs actual ${g.actual}% (gap: ${g.gap}%)`).join('\n')}

## 3. Test Effectiveness
${Object.entries(analysis.test_effectiveness).map(([layer, data]) =>
  `- **${layer}**: ${data.files_generated} files, pass rate ${data.pass_rate}%, ${data.iterations_needed} fix iterations`
).join('\n')}

## 4. Quality Trend
- Trend: ${analysis.quality_trend.trend}
${analysis.quality_trend.delta !== undefined ? `- Coverage change: ${analysis.quality_trend.delta > 0 ? '+' : ''}${analysis.quality_trend.delta}%` : ''}

## 5. Recommendations
${analysis.quality_score >= 80 ? '- Quality is GOOD. Continue with current testing strategy.' : ''}
${analysis.quality_score >= 60 && analysis.quality_score < 80 ? '- Quality needs IMPROVEMENT. Focus on coverage gaps and recurring patterns.' : ''}
${analysis.quality_score < 60 ? '- Quality is CONCERNING. Recommend deep scan and comprehensive test generation.' : ''}
${analysis.defect_patterns.patterns.length > 0 ? `- Address ${analysis.defect_patterns.patterns.length} recurring defect patterns` : ''}
${(analysis.coverage_gaps.gaps || []).length > 0 ? `- Close ${analysis.coverage_gaps.gaps.length} coverage gaps` : ''}
`

Bash(`mkdir -p "${sessionFolder}/analysis"`)
Write(`${sessionFolder}/analysis/quality-report.md`, reportContent)

// 更新 shared memory
sharedMemory.defect_patterns = analysis.defect_patterns.patterns
sharedMemory.quality_score = analysis.quality_score
sharedMemory.coverage_history = sharedMemory.coverage_history || []
sharedMemory.coverage_history.push({
  date: new Date().toISOString(),
  coverage: analysis.coverage_gaps.total_coverage || 0,
  quality_score: analysis.quality_score,
  issues: analysis.defect_patterns.total
})
Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(sharedMemory, null, 2))
```

### Phase 5: Report to Coordinator

```javascript
mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "analyst",
  to: "coordinator",
  type: "quality_report",
  summary: `[analyst] 质量评分: ${analysis.quality_score}/100, 缺陷模式: ${analysis.defect_patterns.patterns.length}, 覆盖率: ${analysis.coverage_gaps.total_coverage || 'N/A'}%`,
  ref: `${sessionFolder}/analysis/quality-report.md`
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## [analyst] Quality Analysis Results

**Task**: ${task.subject}
**Quality Score**: ${analysis.quality_score}/100
**Defect Patterns**: ${analysis.defect_patterns.patterns.length} recurring
**Coverage**: ${analysis.coverage_gaps.total_coverage || 'N/A'}%
**Trend**: ${analysis.quality_trend.trend}

### Report
${sessionFolder}/analysis/quality-report.md`,
  summary: `[analyst] QAANA complete: score ${analysis.quality_score}/100`
})

TaskUpdate({ taskId: task.id, status: 'completed' })

const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('QAANA-') && t.owner === 'analyst' &&
  t.status === 'pending' && t.blockedBy.length === 0
)
if (nextTasks.length > 0) { /* back to Phase 1 */ }
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No QAANA-* tasks available | Idle, wait for coordinator |
| Coverage data not found | Report quality score based on other dimensions |
| Shared memory empty | Generate minimal report with available data |
| No execution results | Analyze only scout findings and strategy coverage |
| CLI analysis fails | Fall back to inline pattern analysis |
| Critical issue beyond scope | SendMessage error to coordinator |
