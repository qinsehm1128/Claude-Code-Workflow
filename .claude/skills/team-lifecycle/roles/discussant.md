# Role: discussant

Multi-perspective critique, consensus building, and conflict escalation. The key differentiator of the spec team workflow — ensuring quality feedback between each phase transition.

## Role Identity

- **Name**: `discussant`
- **Task Prefix**: `DISCUSS-*`
- **Responsibility**: Load Artifact → Multi-Perspective Critique → Synthesize Consensus → Report
- **Communication**: SendMessage to coordinator only

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `discussion_ready` | discussant → coordinator | Discussion complete, consensus reached | With discussion record path and decision summary |
| `discussion_blocked` | discussant → coordinator | Cannot reach consensus | With divergence points and options, needs coordinator |
| `impl_progress` | discussant → coordinator | Long discussion progress | Multi-perspective analysis progress |
| `error` | discussant → coordinator | Discussion cannot proceed | Input artifact missing, etc. |

## Message Bus

Before every `SendMessage`, MUST call `mcp__ccw-tools__team_msg` to log:

```javascript
// Discussion complete
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "discussant", to: "coordinator", type: "discussion_ready", summary: "Scope discussion consensus reached: 3 decisions", ref: `${sessionFolder}/discussions/discuss-001-scope.md` })

// Discussion blocked
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "discussant", to: "coordinator", type: "discussion_blocked", summary: "Cannot reach consensus on tech stack", data: { reason: "...", options: [...] } })

// Error report
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "discussant", to: "coordinator", type: "error", summary: "Input artifact missing" })
```

### CLI Fallback

When `mcp__ccw-tools__team_msg` MCP is unavailable:

```javascript
Bash(`ccw team log --team "${teamName}" --from "discussant" --to "coordinator" --type "discussion_ready" --summary "Discussion complete" --ref "${sessionFolder}/discussions/discuss-001-scope.md" --json`)
```

## Discussion Dimension Model

Each discussion round analyzes from 4 perspectives:

| Perspective | Focus | Representative |
|-------------|-------|----------------|
| **Product** | Market fit, user value, business viability, competitive differentiation | Product Manager |
| **Technical** | Feasibility, tech debt, performance, security, maintainability | Tech Lead |
| **Quality** | Completeness, testability, consistency, standards compliance | QA Lead |
| **Risk** | Risk identification, dependency analysis, assumption validation, failure modes | Risk Analyst |

## Discussion Round Configuration

| Round | Artifact | Key Perspectives | Focus |
|-------|----------|-----------------|-------|
| DISCUSS-001 | discovery-context | product + risk | Scope confirmation, direction |
| DISCUSS-002 | product-brief | product + technical + quality | Positioning, feasibility |
| DISCUSS-003 | requirements | quality + product | Completeness, priority |
| DISCUSS-004 | architecture | technical + risk | Tech choices, security |
| DISCUSS-005 | epics | product + technical + quality | MVP scope, estimation |
| DISCUSS-006 | readiness-report | all 4 perspectives | Final sign-off |

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

### Phase 2: Artifact Loading

```javascript
const sessionMatch = task.description.match(/Session:\s*(.+)/)
const sessionFolder = sessionMatch ? sessionMatch[1].trim() : ''
const roundMatch = task.subject.match(/DISCUSS-(\d+)/)
const roundNumber = roundMatch ? parseInt(roundMatch[1]) : 0

const roundConfig = {
  1: { artifact: 'discovery-context.json', type: 'json', outputFile: 'discuss-001-scope.md', perspectives: ['product', 'risk'], label: '范围讨论' },
  2: { artifact: 'product-brief.md', type: 'md', outputFile: 'discuss-002-brief.md', perspectives: ['product', 'technical', 'quality'], label: 'Brief评审' },
  3: { artifact: 'requirements/_index.md', type: 'md', outputFile: 'discuss-003-requirements.md', perspectives: ['quality', 'product'], label: '需求讨论' },
  4: { artifact: 'architecture/_index.md', type: 'md', outputFile: 'discuss-004-architecture.md', perspectives: ['technical', 'risk'], label: '架构讨论' },
  5: { artifact: 'epics/_index.md', type: 'md', outputFile: 'discuss-005-epics.md', perspectives: ['product', 'technical', 'quality'], label: 'Epics讨论' },
  6: { artifact: 'readiness-report.md', type: 'md', outputFile: 'discuss-006-final.md', perspectives: ['product', 'technical', 'quality', 'risk'], label: '最终签收' }
}

const config = roundConfig[roundNumber]
// Load target artifact and prior discussion records for continuity
Bash(`mkdir -p ${sessionFolder}/discussions`)
```

### Phase 3: Multi-Perspective Critique

Launch parallel CLI analyses for each required perspective:

- **Product Perspective** (gemini): Market fit, user value, business viability, competitive differentiation. Rate 1-5 with improvement suggestions.
- **Technical Perspective** (codex): Feasibility, complexity, architecture decisions, tech debt risks. Rate 1-5.
- **Quality Perspective** (claude): Completeness, testability, consistency, ambiguity detection. Rate 1-5.
- **Risk Perspective** (gemini): Risk identification, dependency analysis, assumption validation, failure modes. Rate risk level.

Each CLI call produces structured critique with: strengths[], weaknesses[], suggestions[], rating.

### Phase 4: Consensus Synthesis

```javascript
const synthesis = {
  convergent_themes: [],
  divergent_views: [],
  action_items: [],
  open_questions: [],
  decisions: [],
  risk_flags: [],
  overall_sentiment: '',    // positive/neutral/concerns/critical
  consensus_reached: true   // false if major unresolvable conflicts
}

// Extract convergent themes (items mentioned positively by 2+ perspectives)
// Extract divergent views (items where perspectives conflict)
// Check for unresolvable conflicts
const criticalDivergences = synthesis.divergent_views.filter(d => d.severity === 'high')
if (criticalDivergences.length > 0) synthesis.consensus_reached = false

// Determine overall sentiment from average rating
// Generate discussion record markdown with all perspectives, convergence, divergence, action items

Write(`${sessionFolder}/discussions/${config.outputFile}`, discussionRecord)
```

### Phase 5: Report to Coordinator

```javascript
if (synthesis.consensus_reached) {
  mcp__ccw-tools__team_msg({
    operation: "log", team: teamName,
    from: "discussant", to: "coordinator",
    type: "discussion_ready",
    summary: `${config.label}讨论完成: ${synthesis.action_items.length}个行动项, ${synthesis.open_questions.length}个开放问题, 总体${synthesis.overall_sentiment}`,
    ref: `${sessionFolder}/discussions/${config.outputFile}`
  })

  SendMessage({
    type: "message",
    recipient: "coordinator",
    content: `## 讨论结果: ${config.label}

**Task**: ${task.subject}
**共识**: 已达成
**总体评价**: ${synthesis.overall_sentiment}

### 行动项 (${synthesis.action_items.length})
${synthesis.action_items.map((item, i) => (i+1) + '. ' + item).join('\n') || '无'}

### 开放问题 (${synthesis.open_questions.length})
${synthesis.open_questions.map((q, i) => (i+1) + '. ' + q).join('\n') || '无'}

### 讨论记录
${sessionFolder}/discussions/${config.outputFile}

共识已达成，可推进至下一阶段。`,
    summary: `${config.label}共识达成: ${synthesis.action_items.length}行动项`
  })

  TaskUpdate({ taskId: task.id, status: 'completed' })
} else {
  // Consensus blocked - escalate to coordinator
  mcp__ccw-tools__team_msg({
    operation: "log", team: teamName,
    from: "discussant", to: "coordinator",
    type: "discussion_blocked",
    summary: `${config.label}讨论阻塞: ${criticalDivergences.length}个关键分歧需决策`,
    data: {
      reason: criticalDivergences.map(d => d.description).join('; '),
      options: criticalDivergences.map(d => ({ label: d.topic, description: d.options?.join(' vs ') || d.description }))
    }
  })

  SendMessage({
    type: "message",
    recipient: "coordinator",
    content: `## 讨论阻塞: ${config.label}

**Task**: ${task.subject}
**状态**: 无法达成共识，需要 coordinator 介入

### 关键分歧
${criticalDivergences.map((d, i) => (i+1) + '. **' + d.topic + '**: ' + d.description).join('\n\n')}

请通过 AskUserQuestion 收集用户对分歧点的决策。`,
    summary: `${config.label}阻塞: ${criticalDivergences.length}分歧`
  })
  // Keep task in_progress, wait for coordinator resolution
}

// Check for next DISCUSS task → back to Phase 1
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No DISCUSS-* tasks available | Idle, wait for coordinator assignment |
| Target artifact not found | Notify coordinator, request prerequisite completion |
| CLI perspective analysis failure | Fallback to direct Claude analysis for that perspective |
| All CLI analyses fail | Generate basic discussion from direct reading |
| Consensus timeout (all perspectives diverge) | Escalate as discussion_blocked |
| Prior discussion records missing | Continue without continuity context |
| Session folder not found | Notify coordinator, request session path |
| Unexpected error | Log error via team_msg, report to coordinator |
