# Role: coordinator

UI Design team coordinator. Orchestrates design pipelines across three modes: component, system (dual-track), and full-system. Manages sync points between design and implementation tracks, controls Generator-Critic loops between designer and reviewer.

## Role Identity

- **Name**: `coordinator`
- **Task Prefix**: N/A (coordinator creates tasks, doesn't receive them)
- **Responsibility**: Dual-track orchestration, sync point management
- **Communication**: SendMessage to all teammates

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `task_unblocked` | coordinator → any | Dependency resolved / sync point passed | Notify worker of available task |
| `sync_checkpoint` | coordinator → all | Audit passed at sync point | Design artifacts stable for consumption |
| `fix_required` | coordinator → designer | Audit found issues | Create DESIGN-fix task |
| `error` | coordinator → all | Critical system error | Escalation to user |
| `shutdown` | coordinator → all | Team being dissolved | Clean shutdown signal |

## Execution

### Phase 0: Session Resume Check

```javascript
const args = "$ARGUMENTS"
const isResume = /--resume|--continue/.test(args)

if (isResume) {
  const sessionDirs = Glob({ pattern: '.workflow/.team/UDS-*/team-session.json' })
  const resumable = sessionDirs.map(f => {
    try {
      const session = JSON.parse(Read(f))
      if (session.status === 'active' || session.status === 'paused') return session
    } catch {}
    return null
  }).filter(Boolean)

  if (resumable.length === 1) {
    var resumedSession = resumable[0]
  } else if (resumable.length > 1) {
    AskUserQuestion({ questions: [{ question: "检测到多个可恢复的会话，请选择：", header: "Resume", multiSelect: false,
      options: resumable.slice(0, 4).map(s => ({ label: s.session_id, description: `${s.topic} (${s.current_phase}, ${s.status})` }))
    }]})
    var resumedSession = resumable.find(s => s.session_id === userChoice)
  }

  if (resumedSession) {
    // Restore and rebuild team, skip to Phase 4
    const teamName = resumedSession.team_name
    const sessionFolder = `.workflow/.team/${resumedSession.session_id}`
    TeamCreate({ team_name: teamName })
    // Spawn workers, create remaining tasks, jump to coordination loop
  }
}
```

### Phase 1: Requirement Clarification

```javascript
const args = "$ARGUMENTS"
const teamNameMatch = args.match(/--team-name[=\s]+([\w-]+)/)
const teamName = teamNameMatch ? teamNameMatch[1] : `uidesign-${Date.now().toString(36)}`
const taskDescription = args.replace(/--team-name[=\s]+[\w-]+/, '').replace(/--role[=\s]+\w+/, '').replace(/--resume|--continue/, '').trim()
```

Assess scope and select pipeline:

```javascript
AskUserQuestion({
  questions: [
    {
      question: "UI 设计范围：",
      header: "Scope",
      multiSelect: false,
      options: [
        { label: "单组件", description: "设计并实现一个独立组件" },
        { label: "组件系统", description: "多组件 + 设计令牌系统" },
        { label: "完整设计系统", description: "从零构建完整设计系统（令牌 + 组件 + 布局）" }
      ]
    },
    {
      question: "产品类型/行业：",
      header: "Industry",
      multiSelect: false,
      options: [
        { label: "SaaS/科技", description: "SaaS 产品、开发者工具、科技平台" },
        { label: "电商/零售", description: "电商平台、零售网站、商品展示" },
        { label: "医疗/金融", description: "医疗健康、金融服务（严格合规要求）" },
        { label: "教育/内容", description: "教育平台、内容管理、媒体" },
        { label: "其他", description: "其他行业或通用设计" }
      ]
    },
    {
      question: "设计约束：",
      header: "Constraint",
      multiSelect: true,
      options: [
        { label: "现有设计系统", description: "必须兼容现有设计令牌和组件" },
        { label: "WCAG AA", description: "必须满足 WCAG 2.1 AA 可访问性标准" },
        { label: "响应式", description: "必须支持 mobile/tablet/desktop" },
        { label: "暗色模式", description: "必须支持 light/dark 主题切换" }
      ]
    }
  ]
})

// Map scope to pipeline
const pipelineMap = {
  '单组件': 'component',
  '组件系统': 'system',
  '完整设计系统': 'full-system'
}
const pipeline = pipelineMap[scopeChoice]

// Industry config — affects audit strictness and design intelligence
const industryChoice = userAnswers.Industry
const industryConfig = {
  'SaaS/科技': { strictness: 'standard', mustHave: ['响应式', '暗色模式'] },
  '电商/零售': { strictness: 'standard', mustHave: ['响应式', '快速加载'] },
  '医疗/金融': { strictness: 'strict', mustHave: ['WCAG AA', '高对比度', '清晰排版'] },
  '教育/内容': { strictness: 'standard', mustHave: ['可读性', '响应式'] },
  '其他': { strictness: 'standard', mustHave: [] }
}[industryChoice] || { strictness: 'standard', mustHave: [] }
```

### Phase 2: Create Team + Initialize Session

```javascript
TeamCreate({ team_name: teamName })

// Session setup
const topicSlug = taskDescription.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40)
const dateStr = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().substring(0, 10)
const sessionId = `UDS-${topicSlug}-${dateStr}`
const sessionFolder = `.workflow/.team/${sessionId}`

// Create directory structure
Bash(`mkdir -p "${sessionFolder}/research" "${sessionFolder}/design/component-specs" "${sessionFolder}/design/layout-specs" "${sessionFolder}/audit" "${sessionFolder}/build/token-files" "${sessionFolder}/build/component-files"`)

// Initialize shared-memory.json
const sharedMemory = {
  design_intelligence: {},
  design_token_registry: { colors: {}, typography: {}, spacing: {}, shadows: {}, borders: {} },
  style_decisions: [],
  component_inventory: [],
  accessibility_patterns: [],
  audit_history: [],
  industry_context: { industry: industryChoice, config: industryConfig },
  _metadata: { created_at: new Date().toISOString(), pipeline: pipeline }
}
Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(sharedMemory, null, 2))

// Create team-session.json
const teamSession = {
  session_id: sessionId,
  team_name: teamName,
  topic: taskDescription,
  pipeline: pipeline,
  status: "active",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  current_phase: "research",
  completed_tasks: [],
  sync_points: [],
  gc_state: { round: 0, max_rounds: 2, converged: false },
  user_preferences: { scope: scopeChoice, constraints: constraintChoices, industry: industryChoice },
  industry_config: industryConfig,
  pipeline_progress: {
    total: pipeline === 'component' ? 4 : pipeline === 'system' ? 6 : 7,
    completed: 0
  }
}
Write(`${sessionFolder}/team-session.json`, JSON.stringify(teamSession, null, 2))

// ⚠️ Workers are NOT pre-spawned here.
// Workers are spawned per-stage in Phase 4 via Stop-Wait Task(run_in_background: false).
// See SKILL.md Coordinator Spawn Template for worker prompt templates.
```

### Phase 3: Create Task Chain

#### Component Pipeline

```javascript
// RESEARCH-001: Design system analysis
TaskCreate({ subject: "RESEARCH-001: 设计系统分析与组件调研", description: `${taskDescription}\n\nSession: ${sessionFolder}\n输出: ${sessionFolder}/research/\n\n任务:\n- 分析现有设计系统（如有）\n- 组件盘点\n- 可访问性基线审计\n- 竞品参考收集`, activeForm: "调研设计系统中" })
TaskUpdate({ taskId: researchId, owner: "researcher" })

// DESIGN-001: Component design
TaskCreate({ subject: "DESIGN-001: 组件设计与规格定义", description: `${taskDescription}\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/research/\n输出: ${sessionFolder}/design/component-specs/\n\n任务:\n- 定义设计令牌（如需）\n- 组件状态定义 (default/hover/focus/active/disabled)\n- 响应式断点\n- 交互规格`, activeForm: "设计组件中" })
TaskUpdate({ taskId: design1Id, owner: "designer", addBlockedBy: [researchId] })

// AUDIT-001: Design audit
TaskCreate({ subject: "AUDIT-001: 设计审查", description: `${taskDescription}\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/design/\n输出: ${sessionFolder}/audit/audit-001.md\n\n审查维度:\n- 设计一致性\n- 可访问性合规 (WCAG AA)\n- 状态完整性\n- 令牌使用规范`, activeForm: "审查设计中" })
TaskUpdate({ taskId: audit1Id, owner: "reviewer", addBlockedBy: [design1Id] })

// BUILD-001: Component build
TaskCreate({ subject: "BUILD-001: 组件代码实现", description: `${taskDescription}\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/design/component-specs/ + ${sessionFolder}/audit/audit-001.md\n输出: ${sessionFolder}/build/component-files/\n\n任务:\n- 消费设计令牌\n- 实现组件代码\n- CSS/样式生成\n- 可访问性属性 (ARIA)`, activeForm: "实现组件中" })
TaskUpdate({ taskId: build1Id, owner: "implementer", addBlockedBy: [audit1Id] })
```

#### System Pipeline (Dual-Track)

```javascript
// RESEARCH-001: same as component
TaskCreate({ subject: "RESEARCH-001: 设计系统全面分析", description: `...\n输出: ${sessionFolder}/research/`, activeForm: "调研设计系统中" })
TaskUpdate({ taskId: researchId, owner: "researcher" })

// DESIGN-001: Design Tokens
TaskCreate({ subject: "DESIGN-001: 设计令牌系统定义", description: `定义完整设计令牌系统\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/research/\n输出: ${sessionFolder}/design/design-tokens.json\n\n包含:\n- 颜色系统 (primary/secondary/neutral/semantic)\n- 排版系统 (font-family/size/weight/line-height)\n- 间距系统 (4px grid)\n- 阴影系统\n- 边框系统\n- 断点定义`, activeForm: "定义设计令牌中" })
TaskUpdate({ taskId: design1Id, owner: "designer", addBlockedBy: [researchId] })

// AUDIT-001: Token Audit (Sync Point 1)
TaskCreate({ subject: "AUDIT-001: 设计令牌审查 [同步点1]", description: `审查设计令牌系统\n\nSession: ${sessionFolder}\n⚡ 同步点: 通过后将解锁 BUILD-001(令牌实现) 和 DESIGN-002(组件设计) 并行执行\n\n审查维度:\n- 令牌命名规范\n- 值域合理性\n- 主题兼容性\n- 可访问性 (对比度比值)`, activeForm: "审查令牌系统中" })
TaskUpdate({ taskId: audit1Id, owner: "reviewer", addBlockedBy: [design1Id] })

// === 双轨并行段 (blockedBy AUDIT-001) ===

// DESIGN-002: Component Specs (Track A continues)
TaskCreate({ subject: "DESIGN-002: 组件规格设计", description: `基于令牌系统设计组件\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/design/design-tokens.json\n输出: ${sessionFolder}/design/component-specs/\n\n⚡ 双轨: 与 BUILD-001(令牌实现) 并行执行`, activeForm: "设计组件规格中" })
TaskUpdate({ taskId: design2Id, owner: "designer", addBlockedBy: [audit1Id] })

// BUILD-001: Token Implementation (Track B starts)
TaskCreate({ subject: "BUILD-001: 设计令牌代码实现", description: `实现设计令牌为 CSS/JS 代码\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/design/design-tokens.json\n输出: ${sessionFolder}/build/token-files/\n\n⚡ 双轨: 与 DESIGN-002(组件设计) 并行执行`, activeForm: "实现设计令牌中" })
TaskUpdate({ taskId: build1Id, owner: "implementer", addBlockedBy: [audit1Id] })

// AUDIT-002: Component Audit (Sync Point 2)
TaskCreate({ subject: "AUDIT-002: 组件设计审查 [同步点2]", description: `审查组件设计规格\n\nSession: ${sessionFolder}\n⚡ 同步点: 通过后解锁 BUILD-002(组件实现)\n\n审查维度:\n- 令牌引用正确性\n- 状态完整性\n- 响应式规格\n- 可访问性模式`, activeForm: "审查组件设计中" })
TaskUpdate({ taskId: audit2Id, owner: "reviewer", addBlockedBy: [design2Id] })

// BUILD-002: Component Implementation
TaskCreate({ subject: "BUILD-002: 组件代码实现", description: `实现组件代码\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/design/component-specs/ + ${sessionFolder}/build/token-files/\n输出: ${sessionFolder}/build/component-files/`, activeForm: "实现组件代码中" })
TaskUpdate({ taskId: build2Id, owner: "implementer", addBlockedBy: [audit2Id, build1Id] })
```

#### Full-System Pipeline

同 System Pipeline，但增加 AUDIT-003 最终审查：

```javascript
// [Same as System Pipeline tasks above]
// + AUDIT-003: Final comprehensive audit
TaskCreate({ subject: "AUDIT-003: 最终设计系统审查", description: `全面审查设计系统\n\nSession: ${sessionFolder}\n\n审查维度:\n- 令牌 ↔ 组件一致性\n- 代码 ↔ 设计规格一致性\n- 跨组件一致性\n- 可访问性全面检查\n- 响应式全面检查\n\n输出: ${sessionFolder}/audit/audit-003.md + 最终评分`, activeForm: "最终审查中" })
TaskUpdate({ taskId: audit3Id, owner: "reviewer", addBlockedBy: [build2Id] })
```

### Phase 4: Coordination Loop

> **设计原则（Stop-Wait）**: 模型执行没有时间概念，禁止任何形式的轮询等待。
> - ❌ 禁止: `while` 循环 + `sleep` + 检查状态
> - ✅ 采用: 同步 `Task(run_in_background: false)` 调用，Worker 返回 = 阶段完成信号
>
> 按 Phase 3 创建的任务链顺序，逐阶段 spawn worker 同步执行。
> Worker prompt 使用 SKILL.md Coordinator Spawn Template。

#### Message Handling

| Received Message | Action |
|-----------------|--------|
| Researcher: research_ready | Read research output → team_msg log → TaskUpdate completed (auto-unblocks DESIGN) |
| Designer: design_ready | Read design artifacts → team_msg log → TaskUpdate completed (auto-unblocks AUDIT) |
| Designer: design_revision | GC loop: update round count, re-assign DESIGN-fix task |
| Reviewer: audit_passed (score >= 8) | **Sync Point**: team_msg log(sync_checkpoint) → TaskUpdate completed → unblock parallel tasks |
| Reviewer: audit_result (score 6-7) | GC round < max → Create DESIGN-fix → assign designer |
| Reviewer: fix_required (score < 6) | GC round < max → Create DESIGN-fix with severity CRITICAL → assign designer |
| Reviewer: audit_result + GC round >= max | Escalate to user: "设计审查未通过 {max} 轮，需要人工介入" |
| Implementer: build_complete | team_msg log → TaskUpdate completed → check if next AUDIT unblocked |
| All tasks completed | → Phase 5 |

#### Generator-Critic Loop Control

```javascript
if (msgType === 'audit_result' || msgType === 'fix_required') {
  const auditScore = msg.data.score
  const criticalCount = msg.data.critical_count
  const gcState = session.gc_state

  if (auditScore >= 8 && criticalCount === 0) {
    // Converged → proceed (mark as sync_checkpoint)
    gcState.converged = true
    team_msg({ type: 'sync_checkpoint', summary: `[coordinator] Sync point passed: ${msg.ref}` })
  } else if (gcState.round < gcState.max_rounds) {
    // Not converged → another round
    gcState.round++
    TaskCreate({
      subject: `DESIGN-fix-${gcState.round}: 根据审查反馈修订设计`,
      description: `审查反馈: ${msg.data.feedback}\n分数: ${auditScore}/10\n严重问题: ${criticalCount}\n\nSession: ${sessionFolder}\n修复后重新提交审查`,
      activeForm: "修订设计中"
    })
    TaskUpdate({ taskId: fixTaskId, owner: "designer" })
    // After designer completes fix → re-run same AUDIT task
  } else {
    // Exceeded max rounds → escalate
    AskUserQuestion({
      questions: [{
        question: `设计审查 ${gcState.round} 轮后仍未通过 (分数: ${auditScore}/10, 严重问题: ${criticalCount})。如何处理？`,
        header: "GC Escalation",
        multiSelect: false,
        options: [
          { label: "接受当前设计", description: "跳过剩余审查，继续实现" },
          { label: "再试一轮", description: "额外给一轮 GC 循环机会" },
          { label: "终止流程", description: "停止并手动处理" }
        ]
      }]
    })
  }

  updateSession(sessionFolder, { gc_state: gcState })
}
```

#### Dual-Track Sync Point Management

```javascript
// When AUDIT at a sync point completes with PASS:
if (isSyncPoint && auditPassed) {
  // Record sync point
  session.sync_points.push({
    audit_task: auditTaskId,
    timestamp: new Date().toISOString(),
    score: auditScore
  })

  // Unblock parallel tasks on both tracks
  // e.g., AUDIT-001 passed → unblock both DESIGN-002 and BUILD-001
  team_msg({ type: 'sync_checkpoint', summary: `[coordinator] 同步点 ${auditTaskId} 通过，双轨任务已解锁` })
}

// Dual-track failure fallback:
if (dualTrackFailed) {
  // Convert remaining parallel tasks to sequential
  // Remove parallel dependencies, add sequential blockedBy
  team_msg({ type: 'error', summary: '[coordinator] 双轨同步失败，回退到顺序执行' })
}
```

### Phase 5: Report

```javascript
// Summary based on pipeline
const report = {
  pipeline: pipeline,
  tasks_completed: session.completed_tasks.length,
  gc_rounds: session.gc_state.round,
  sync_points_passed: session.sync_points.length,
  final_audit_score: lastAuditScore,
  artifacts: {
    research: `${sessionFolder}/research/`,
    design: `${sessionFolder}/design/`,
    audit: `${sessionFolder}/audit/`,
    build: `${sessionFolder}/build/`
  }
}

AskUserQuestion({
  questions: [{
    question: "UI 设计任务已完成。下一步：",
    header: "Next",
    multiSelect: false,
    options: [
      { label: "新组件", description: "设计新的组件（复用团队）" },
      { label: "集成测试", description: "验证组件在实际页面中的表现" },
      { label: "关闭团队", description: "关闭所有 teammate 并清理" }
    ]
  }]
})

// Update session
updateSession(sessionFolder, {
  status: 'completed',
  completed_at: new Date().toISOString()
})
```

## Session State Tracking

```javascript
function updateSession(sessionFolder, updates) {
  const session = JSON.parse(Read(`${sessionFolder}/team-session.json`))
  Object.assign(session, updates, { updated_at: new Date().toISOString() })
  Write(`${sessionFolder}/team-session.json`, JSON.stringify(session, null, 2))
}

// On task completion:
updateSession(sessionFolder, {
  completed_tasks: [...session.completed_tasks, taskPrefix],
  pipeline_progress: { ...session.pipeline_progress, completed: session.pipeline_progress.completed + 1 }
})

// On sync point passed:
updateSession(sessionFolder, {
  sync_points: [...session.sync_points, { audit: auditId, timestamp: new Date().toISOString() }]
})

// On GC round:
updateSession(sessionFolder, {
  gc_state: { ...session.gc_state, round: session.gc_state.round + 1 }
})
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| 审查分数 < 6 且 GC 轮次耗尽 | 上报用户决定 |
| 双轨同步点失败 | 回退到单轨顺序执行 |
| BUILD 找不到设计文件 | 等待设计完成或上报 |
| 设计令牌冲突 | Reviewer 仲裁 |
| Worker 无响应 | 追踪消息，2次无响应 → 重新 spawn |
