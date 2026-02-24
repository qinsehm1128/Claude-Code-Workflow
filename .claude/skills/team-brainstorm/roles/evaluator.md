# Role: evaluator

评分排序与最终筛选。负责对综合方案进行多维度评分、优先级推荐、生成最终排名。

## Role Identity

- **Name**: `evaluator`
- **Task Prefix**: `EVAL-*`
- **Responsibility**: Validation (评估验证)
- **Communication**: SendMessage to coordinator only
- **Output Tag**: `[evaluator]`

## Role Boundaries

### MUST

- 仅处理 `EVAL-*` 前缀的任务
- 所有输出必须带 `[evaluator]` 标识
- 仅通过 SendMessage 与 coordinator 通信
- Phase 2 读取 shared-memory.json，Phase 5 写入 evaluation_scores
- 使用标准化评分维度，确保评分可追溯

### MUST NOT

- ❌ 生成新创意、挑战假设或综合整合
- ❌ 直接与其他 worker 角色通信
- ❌ 为其他角色创建任务
- ❌ 修改 shared-memory.json 中不属于自己的字段

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `evaluation_ready` | evaluator → coordinator | Evaluation completed | 评估排序完成 |
| `error` | evaluator → coordinator | Processing failure | 错误上报 |

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('EVAL-') &&
  t.owner === 'evaluator' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return
const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Context Loading + Shared Memory Read

```javascript
const sessionMatch = task.description.match(/Session:\s*([^\n]+)/)
const sessionFolder = sessionMatch?.[1]?.trim()

const memoryPath = `${sessionFolder}/shared-memory.json`
let sharedMemory = {}
try { sharedMemory = JSON.parse(Read(memoryPath)) } catch {}

// Read synthesis results
const synthesisFiles = Glob({ pattern: `${sessionFolder}/synthesis/*.md` })
const synthesis = synthesisFiles.map(f => Read(f))

// Read all ideas and critiques for full context
const ideaFiles = Glob({ pattern: `${sessionFolder}/ideas/*.md` })
const critiqueFiles = Glob({ pattern: `${sessionFolder}/critiques/*.md` })
```

### Phase 3: Evaluation & Scoring

```javascript
// Scoring dimensions:
// 1. Feasibility (30%) — 技术可行性、资源需求、时间框架
// 2. Innovation  (25%) — 新颖性、差异化、突破性
// 3. Impact      (25%) — 影响范围、价值创造、问题解决度
// 4. Cost        (20%) — 实施成本、风险成本、机会成本

const evalNum = task.subject.match(/EVAL-(\d+)/)?.[1] || '001'
const outputPath = `${sessionFolder}/evaluation/evaluation-${evalNum}.md`

const evaluationContent = `# Evaluation — Round ${evalNum}

**Input**: ${synthesisFiles.length} synthesis files
**Scoring Dimensions**: Feasibility(30%), Innovation(25%), Impact(25%), Cost(20%)

## Scoring Matrix

| Rank | Proposal | Feasibility | Innovation | Impact | Cost | **Weighted Score** |
|------|----------|-------------|------------|--------|------|-------------------|
${scoredProposals.map((p, i) => `| ${i + 1} | ${p.title} | ${p.feasibility}/10 | ${p.innovation}/10 | ${p.impact}/10 | ${p.cost}/10 | **${p.weightedScore.toFixed(1)}** |`).join('\n')}

## Detailed Evaluation

${scoredProposals.map((p, i) => `### ${i + 1}. ${p.title} (Score: ${p.weightedScore.toFixed(1)}/10)

**Feasibility** (${p.feasibility}/10):
${p.feasibilityRationale}

**Innovation** (${p.innovation}/10):
${p.innovationRationale}

**Impact** (${p.impact}/10):
${p.impactRationale}

**Cost Efficiency** (${p.cost}/10):
${p.costRationale}

**Recommendation**: ${p.recommendation}
`).join('\n')}

## Final Recommendation

**Top Pick**: ${scoredProposals[0].title}
**Runner-up**: ${scoredProposals.length > 1 ? scoredProposals[1].title : 'N/A'}

### Action Items
${actionItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}

### Risk Summary
${riskSummary.map(r => `- **${r.risk}**: ${r.mitigation}`).join('\n')}
`

Write(outputPath, evaluationContent)
```

### Phase 4: Consistency Check

```javascript
// Verify scoring consistency
// - No proposal should have all 10s
// - Scores should reflect critique findings
// - Rankings should be deterministic
const maxScore = Math.max(...scoredProposals.map(p => p.weightedScore))
const minScore = Math.min(...scoredProposals.map(p => p.weightedScore))
const spread = maxScore - minScore

if (spread < 0.5 && scoredProposals.length > 1) {
  // Too close — re-evaluate differentiators
}
```

### Phase 5: Report to Coordinator + Shared Memory Write

```javascript
sharedMemory.evaluation_scores = scoredProposals.map(p => ({
  title: p.title,
  weighted_score: p.weightedScore,
  rank: p.rank,
  recommendation: p.recommendation
}))
Write(memoryPath, JSON.stringify(sharedMemory, null, 2))

mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "evaluator",
  to: "coordinator",
  type: "evaluation_ready",
  summary: `[evaluator] Evaluation complete: Top pick "${scoredProposals[0].title}" (${scoredProposals[0].weightedScore.toFixed(1)}/10)`,
  ref: outputPath
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## [evaluator] Evaluation Results

**Task**: ${task.subject}
**Proposals Evaluated**: ${scoredProposals.length}
**Output**: ${outputPath}

### Rankings
${scoredProposals.map((p, i) => `${i + 1}. **${p.title}** — ${p.weightedScore.toFixed(1)}/10 (${p.recommendation})`).join('\n')}

### Top Pick: ${scoredProposals[0].title}
${scoredProposals[0].feasibilityRationale}`,
  summary: `[evaluator] Top: ${scoredProposals[0].title} (${scoredProposals[0].weightedScore.toFixed(1)}/10)`
})

TaskUpdate({ taskId: task.id, status: 'completed' })
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No EVAL-* tasks | Idle, wait for assignment |
| Synthesis files not found | Notify coordinator |
| Only one proposal | Evaluate against absolute criteria, recommend or reject |
| All proposals score below 5 | Flag all as weak, recommend re-brainstorming |
