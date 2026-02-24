# Role: coordinator

Team lifecycle coordinator. Orchestrates the full pipeline across three modes: spec-only, impl-only, and full-lifecycle. Handles requirement clarification, team creation, task chain management, cross-phase coordination, and result reporting.

## Role Identity

- **Name**: `coordinator`
- **Task Prefix**: N/A (coordinator creates tasks, doesn't receive them)
- **Responsibility**: Orchestration
- **Communication**: SendMessage to all teammates

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `plan_approved` | coordinator → planner | Plan reviewed and accepted | Planner can mark task completed |
| `plan_revision` | coordinator → planner | Plan needs changes | Feedback with required changes |
| `task_unblocked` | coordinator → any | Dependency resolved | Notify worker of available task |
| `fix_required` | coordinator → executor/writer | Review/Quality found issues | Create fix task |
| `error` | coordinator → all | Critical system error | Escalation to user |
| `shutdown` | coordinator → all | Team being dissolved | Clean shutdown signal |

## Execution

### Phase 0: Session Resume Check

Before any new session setup, check if resuming an existing session:

```javascript
const args = "$ARGUMENTS"
const isResume = /--resume|--continue/.test(args)

if (isResume) {
  // Scan for active/paused sessions
  const sessionDirs = Glob({ pattern: '.workflow/.team/TLS-*/team-session.json' })
  const resumable = sessionDirs.map(f => {
    try {
      const session = JSON.parse(Read(f))
      if (session.status === 'active' || session.status === 'paused') return session
    } catch {}
    return null
  }).filter(Boolean)

  if (resumable.length === 0) {
    // No resumable sessions → fall through to Phase 1
  } else if (resumable.length === 1) {
    var resumedSession = resumable[0]
  } else {
    // Multiple matches → user selects
    AskUserQuestion({
      questions: [{
        question: "检测到多个可恢复的会话，请选择：",
        header: "Resume",
        multiSelect: false,
        options: resumable.slice(0, 4).map(s => ({
          label: s.session_id,
          description: `${s.topic} (${s.current_phase}, ${s.status})`
        }))
      }]
    })
    var resumedSession = resumable.find(s => s.session_id === userChoice)
  }

  if (resumedSession) {
    // Restore session state
    const teamName = resumedSession.team_name
    const mode = resumedSession.mode
    const sessionFolder = `.workflow/.team/${resumedSession.session_id}`
    const taskDescription = resumedSession.topic
    const executionMethod = resumedSession.user_preferences?.execution_method || 'Auto'
    const codeReviewTool = resumedSession.user_preferences?.code_review || 'Skip'

    // ============================================================
    // Pipeline Constants
    // ============================================================
    const SPEC_CHAIN = [
      'RESEARCH-001', 'DISCUSS-001', 'DRAFT-001', 'DISCUSS-002',
      'DRAFT-002', 'DISCUSS-003', 'DRAFT-003', 'DISCUSS-004',
      'DRAFT-004', 'DISCUSS-005', 'QUALITY-001', 'DISCUSS-006'
    ]
    const IMPL_CHAIN = ['PLAN-001', 'IMPL-001', 'TEST-001', 'REVIEW-001']

    // Task metadata: prefix → { subject, owner, description template, activeForm }
    const TASK_METADATA = {
      'RESEARCH-001': { owner: 'analyst', subject: 'RESEARCH-001: 主题发现与上下文研究', activeForm: '研究中',
        desc: () => `${taskDescription}\n\nSession: ${sessionFolder}\n输出: ${sessionFolder}/spec/spec-config.json + spec/discovery-context.json` },
      'DISCUSS-001': { owner: 'discussant', subject: 'DISCUSS-001: 研究结果讨论 - 范围确认与方向调整', activeForm: '讨论范围中',
        desc: () => `讨论 RESEARCH-001 的发现结果\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/spec/discovery-context.json\n输出: ${sessionFolder}/discussions/discuss-001-scope.md` },
      'DRAFT-001': { owner: 'writer', subject: 'DRAFT-001: 撰写 Product Brief', activeForm: '撰写 Brief 中',
        desc: () => `基于研究和讨论共识撰写产品简报\n\nSession: ${sessionFolder}\n输入: discovery-context.json + discuss-001-scope.md\n输出: ${sessionFolder}/spec/product-brief.md` },
      'DISCUSS-002': { owner: 'discussant', subject: 'DISCUSS-002: Product Brief 多视角评审', activeForm: '评审 Brief 中',
        desc: () => `评审 Product Brief 文档\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/spec/product-brief.md\n输出: ${sessionFolder}/discussions/discuss-002-brief.md` },
      'DRAFT-002': { owner: 'writer', subject: 'DRAFT-002: 撰写 Requirements/PRD', activeForm: '撰写 PRD 中',
        desc: () => `基于 Brief 和讨论反馈撰写需求文档\n\nSession: ${sessionFolder}\n输入: product-brief.md + discuss-002-brief.md\n输出: ${sessionFolder}/spec/requirements/` },
      'DISCUSS-003': { owner: 'discussant', subject: 'DISCUSS-003: 需求完整性与优先级讨论', activeForm: '讨论需求中',
        desc: () => `讨论 PRD 需求完整性\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/spec/requirements/_index.md\n输出: ${sessionFolder}/discussions/discuss-003-requirements.md` },
      'DRAFT-003': { owner: 'writer', subject: 'DRAFT-003: 撰写 Architecture Document', activeForm: '撰写架构中',
        desc: () => `基于需求和讨论反馈撰写架构文档\n\nSession: ${sessionFolder}\n输入: requirements/ + discuss-003-requirements.md\n输出: ${sessionFolder}/spec/architecture/` },
      'DISCUSS-004': { owner: 'discussant', subject: 'DISCUSS-004: 架构决策与技术可行性讨论', activeForm: '讨论架构中',
        desc: () => `讨论架构设计合理性\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/spec/architecture/_index.md\n输出: ${sessionFolder}/discussions/discuss-004-architecture.md` },
      'DRAFT-004': { owner: 'writer', subject: 'DRAFT-004: 撰写 Epics & Stories', activeForm: '撰写 Epics 中',
        desc: () => `基于架构和讨论反馈撰写史诗和用户故事\n\nSession: ${sessionFolder}\n输入: architecture/ + discuss-004-architecture.md\n输出: ${sessionFolder}/spec/epics/` },
      'DISCUSS-005': { owner: 'discussant', subject: 'DISCUSS-005: 执行计划与MVP范围讨论', activeForm: '讨论执行计划中',
        desc: () => `讨论执行计划就绪性\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/spec/epics/_index.md\n输出: ${sessionFolder}/discussions/discuss-005-epics.md` },
      'QUALITY-001': { owner: 'reviewer', subject: 'QUALITY-001: 规格就绪度检查', activeForm: '质量检查中',
        desc: () => `全文档交叉验证和质量评分\n\nSession: ${sessionFolder}\n输入: 全部文档\n输出: ${sessionFolder}/spec/readiness-report.md + spec/spec-summary.md` },
      'DISCUSS-006': { owner: 'discussant', subject: 'DISCUSS-006: 最终签收与交付确认', activeForm: '最终签收讨论中',
        desc: () => `最终讨论和签收\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/spec/readiness-report.md\n输出: ${sessionFolder}/discussions/discuss-006-final.md` },
      'PLAN-001': { owner: 'planner', subject: 'PLAN-001: 探索和规划实现', activeForm: '规划中',
        desc: () => `${taskDescription}\n\nSession: ${sessionFolder}\n写入: ${sessionFolder}/plan/` },
      'IMPL-001': { owner: 'executor', subject: 'IMPL-001: 实现已批准的计划', activeForm: '实现中',
        desc: () => `${taskDescription}\n\nSession: ${sessionFolder}\nPlan: ${sessionFolder}/plan/plan.json\nexecution_method: ${executionMethod}\ncode_review: ${codeReviewTool}` },
      'TEST-001': { owner: 'tester', subject: 'TEST-001: 测试修复循环', activeForm: '测试中',
        desc: () => taskDescription },
      'REVIEW-001': { owner: 'reviewer', subject: 'REVIEW-001: 代码审查与需求验证', activeForm: '审查中',
        desc: () => `${taskDescription}\n\nSession: ${sessionFolder}\nPlan: ${sessionFolder}/plan/plan.json` }
    }

    // Pipeline dependency: prefix → predecessor prefix (special: TEST-001 & REVIEW-001 both depend on IMPL-001)
    function getPredecessor(prefix, pipeline) {
      if (prefix === 'TEST-001' || prefix === 'REVIEW-001') return 'IMPL-001'
      const idx = pipeline.indexOf(prefix)
      return idx > 0 ? pipeline[idx - 1] : null
    }

    // ============================================================
    // Step 1: Audit TaskList — 审计当前任务清单状态
    // ============================================================
    const allTasks = TaskList()
    const pipeline = mode === 'spec-only' ? SPEC_CHAIN
      : mode === 'impl-only' ? IMPL_CHAIN
      : [...SPEC_CHAIN, ...IMPL_CHAIN]
    const sessionCompleted = new Set(resumedSession.completed_tasks || [])

    // Build prefix → task mapping from existing TaskList
    const existingByPrefix = {}
    allTasks.forEach(t => {
      const prefixMatch = t.subject.match(/^([A-Z]+-\d+)/)
      if (prefixMatch) existingByPrefix[prefixMatch[1]] = t
    })

    // ============================================================
    // Step 2: Reconcile — 同步 session 与 TaskList 状态
    // ============================================================
    const reconciledCompleted = new Set(sessionCompleted)
    const statusFixes = []

    for (const prefix of pipeline) {
      const existing = existingByPrefix[prefix]
      if (!existing) continue

      // Case A: session 记录已完成，但 TaskList 状态不是 completed → 修正 TaskList
      if (sessionCompleted.has(prefix) && existing.status !== 'completed') {
        TaskUpdate({ taskId: existing.id, status: 'completed' })
        statusFixes.push(`${prefix}: ${existing.status} → completed (sync from session)`)
      }

      // Case B: TaskList 已 completed，但 session 未记录 → 补录 session
      if (existing.status === 'completed' && !sessionCompleted.has(prefix)) {
        reconciledCompleted.add(prefix)
        statusFixes.push(`${prefix}: completed (sync to session)`)
      }

      // Case C: TaskList 是 in_progress（暂停时可能中断）→ 重置为 pending
      if (existing.status === 'in_progress' && !sessionCompleted.has(prefix)) {
        TaskUpdate({ taskId: existing.id, status: 'pending' })
        statusFixes.push(`${prefix}: in_progress → pending (reset for retry)`)
      }
    }

    // Update session with reconciled completed_tasks
    resumedSession.completed_tasks = [...reconciledCompleted]

    // ============================================================
    // Step 3: Determine remaining pipeline — 确定剩余任务顺序
    // ============================================================
    const remainingPipeline = pipeline.filter(p => !reconciledCompleted.has(p))

    // ============================================================
    // Step 4: Rebuild team + Spawn workers — 重建团队
    // ============================================================
    TeamCreate({ team_name: teamName })

    // Determine which worker roles are needed based on remaining tasks
    const neededRoles = new Set()
    remainingPipeline.forEach(prefix => {
      const meta = TASK_METADATA[prefix]
      if (meta) neededRoles.add(meta.owner)
    })

    // Spawn only needed workers using Phase 4 Stop-Wait pattern (see SKILL.md Coordinator Spawn Template)
    // Workers are spawned per-stage via Task(run_in_background: false) in Phase 4 coordination loop.
    // neededRoles is used to determine which workers will be spawned on-demand.
    neededRoles.forEach(role => {
      // → Worker prompt template in SKILL.md (spawned per-stage in Phase 4, not pre-spawned here)
    })

    // ============================================================
    // Step 5: Create missing tasks with correct dependencies
    // ============================================================
    // In a new conversation, TaskList is EMPTY — all remaining tasks must be created.
    // In a same-conversation resume, some tasks may already exist.
    const missingPrefixes = remainingPipeline.filter(p => !existingByPrefix[p])

    for (const prefix of missingPrefixes) {
      const meta = TASK_METADATA[prefix]
      if (!meta) continue

      // Create task
      const newTask = TaskCreate({
        subject: meta.subject,
        description: meta.desc(),
        activeForm: meta.activeForm
      })
      TaskUpdate({ taskId: newTask.id, owner: meta.owner })

      // Register in existingByPrefix for dependency wiring
      existingByPrefix[prefix] = { id: newTask.id, status: 'pending', blockedBy: [] }

      // Wire dependency: find predecessor
      const predPrefix = getPredecessor(prefix, pipeline)
      if (predPrefix && !reconciledCompleted.has(predPrefix)) {
        const predTask = existingByPrefix[predPrefix]
        if (predTask) {
          TaskUpdate({ taskId: newTask.id, addBlockedBy: [predTask.id] })
        }
      }

      statusFixes.push(`${prefix}: created (missing in TaskList)`)
    }

    // ============================================================
    // Step 6: Verify dependency chain integrity for existing tasks
    // ============================================================
    for (const prefix of remainingPipeline) {
      // Skip tasks we just created (already wired)
      if (missingPrefixes.includes(prefix)) continue
      const task = existingByPrefix[prefix]
      if (!task || task.status === 'completed') continue

      const predPrefix = getPredecessor(prefix, pipeline)
      if (!predPrefix || reconciledCompleted.has(predPrefix)) continue

      const predTask = existingByPrefix[predPrefix]
      if (predTask && task.blockedBy && !task.blockedBy.includes(predTask.id)) {
        TaskUpdate({ taskId: task.id, addBlockedBy: [predTask.id] })
        statusFixes.push(`${prefix}: added missing blockedBy → ${predPrefix}`)
      }
    }

    // ============================================================
    // Step 7: Update session file — 写入恢复状态
    // ============================================================
    resumedSession.status = 'active'
    resumedSession.resumed_at = new Date().toISOString()
    resumedSession.updated_at = new Date().toISOString()
    if (remainingPipeline.length > 0) {
      const firstRemaining = remainingPipeline[0]
      if (/^(RESEARCH|DISCUSS|DRAFT|QUALITY)/.test(firstRemaining)) {
        resumedSession.current_phase = 'spec'
      } else if (firstRemaining.startsWith('PLAN')) {
        resumedSession.current_phase = 'plan'
      } else {
        resumedSession.current_phase = 'impl'
      }
    }
    Write(`${sessionFolder}/team-session.json`, JSON.stringify(resumedSession, null, 2))

    // ============================================================
    // Step 8: Report reconciliation — 输出恢复摘要
    // ============================================================
    // Output to user:
    // - Session: {session_id} resumed
    // - Completed: {reconciledCompleted.size}/{pipeline.length} tasks
    // - Remaining: {remainingPipeline.join(' → ')}
    // - Status fixes: {statusFixes.length} corrections applied
    // - Next task: {remainingPipeline[0]}
    // - Workers spawned: {[...neededRoles].join(', ')}

    // ============================================================
    // Step 9: Kick — 通知首个可执行任务的 worker 启动
    // ============================================================
    // 解决 resume 后的死锁：coordinator 等 worker 消息 ↔ worker 等任务
    // 找到第一个 pending + blockedBy 为空的任务，向其 owner 发送 task_unblocked
    const firstActionable = remainingPipeline.find(prefix => {
      const task = existingByPrefix[prefix]
      return task && task.status === 'pending' && (!task.blockedBy || task.blockedBy.length === 0)
    })

    if (firstActionable) {
      const meta = TASK_METADATA[firstActionable]
      mcp__ccw-tools__team_msg({
        operation: "log", team: teamName,
        from: "coordinator", to: meta.owner,
        type: "task_unblocked",
        summary: `Resume: ${firstActionable} is ready for execution`
      })
      SendMessage({
        type: "message",
        recipient: meta.owner,
        content: `Session 已恢复。你的任务 ${firstActionable} 已就绪，请立即执行 TaskList 检查并开始工作。`,
        summary: `Resume kick: ${firstActionable}`
      })
    }

    // → Skip to Phase 4 coordination loop
  }
}
```

### Phase 1: Requirement Clarification

Parse `$ARGUMENTS` to extract `--team-name` and task description.

```javascript
const args = "$ARGUMENTS"
const teamNameMatch = args.match(/--team-name[=\s]+([\w-]+)/)
const teamName = teamNameMatch ? teamNameMatch[1] : `lifecycle-${Date.now().toString(36)}`
const taskDescription = args.replace(/--team-name[=\s]+[\w-]+/, '').replace(/--role[=\s]+\w+/, '').replace(/--resume|--continue/, '').trim()
```

Use AskUserQuestion to collect mode and constraints:

```javascript
AskUserQuestion({
  questions: [
    {
      question: "选择工作模式：",
      header: "Mode",
      multiSelect: false,
      options: [
        { label: "spec-only", description: "仅生成规格文档（研究→讨论→撰写→质量检查）" },
        { label: "impl-only", description: "仅实现代码（规划→实现→测试+审查）" },
        { label: "full-lifecycle", description: "完整生命周期（规格→实现→测试+审查）" }
      ]
    },
    {
      question: "MVP 范围：",
      header: "Scope",
      multiSelect: false,
      options: [
        { label: "最小可行", description: "核心功能优先" },
        { label: "功能完整", description: "覆盖主要用例" },
        { label: "全面实现", description: "包含边缘场景和优化" }
      ]
    }
  ]
})

// Spec/Full 模式追加收集
if (mode === 'spec-only' || mode === 'full-lifecycle') {
  AskUserQuestion({
    questions: [
      {
        question: "重点领域：",
        header: "Focus",
        multiSelect: false,
        options: [
          { label: "产品定义", description: "聚焦用户需求和产品定位" },
          { label: "技术架构", description: "聚焦技术选型和系统设计" },
          { label: "全面规格", description: "均衡覆盖产品+技术" }
        ]
      },
      {
        question: "讨论深度：",
        header: "Depth",
        multiSelect: false,
        options: [
          { label: "快速共识", description: "每轮讨论简短聚焦，快速推进" },
          { label: "深度讨论", description: "每轮多视角深入分析" },
          { label: "全面辩论", description: "4个维度全覆盖，严格共识门控" }
        ]
      }
    ]
  })
}
```

Simple tasks can skip clarification.

#### Execution Method Selection (impl/full-lifecycle modes)

When mode includes implementation, select execution backend before team creation:

```javascript
if (mode === 'impl-only' || mode === 'full-lifecycle') {
  const execSelection = AskUserQuestion({
    questions: [
      {
        question: "选择代码执行方式:",
        header: "Execution",
        multiSelect: false,
        options: [
          { label: "Agent", description: "code-developer agent（同步，适合简单任务）" },
          { label: "Codex", description: "Codex CLI（后台，适合复杂任务）" },
          { label: "Gemini", description: "Gemini CLI（后台，适合分析类任务）" },
          { label: "Auto", description: "根据任务复杂度自动选择（默认）" }
        ]
      },
      {
        question: "实现后是否进行代码审查?",
        header: "Code Review",
        multiSelect: false,
        options: [
          { label: "Skip", description: "不审查（Reviewer 角色独立负责）" },
          { label: "Gemini Review", description: "Gemini CLI 审查" },
          { label: "Codex Review", description: "Git-aware review（--uncommitted）" }
        ]
      }
    ]
  })

  var executionMethod = execSelection.Execution || 'Auto'
  var codeReviewTool = execSelection['Code Review'] || 'Skip'
}
```

### Phase 2: Create Team + Initialize Session

```javascript
TeamCreate({ team_name: teamName })

// Unified session setup
const topicSlug = taskDescription.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40)
const dateStr = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().substring(0, 10)
const sessionId = `TLS-${topicSlug}-${dateStr}`
const sessionFolder = `.workflow/.team/${sessionId}`

// Create unified directory structure
if (mode === 'spec-only' || mode === 'full-lifecycle') {
  Bash(`mkdir -p "${sessionFolder}/spec" "${sessionFolder}/discussions"`)
}
if (mode === 'impl-only' || mode === 'full-lifecycle') {
  Bash(`mkdir -p "${sessionFolder}/plan"`)
}

// Create team-session.json
const teamSession = {
  session_id: sessionId,
  team_name: teamName,
  topic: taskDescription,
  mode: mode,
  status: "active",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  paused_at: null,
  resumed_at: null,
  completed_at: null,
  current_phase: mode === 'impl-only' ? 'plan' : 'spec',
  completed_tasks: [],
  pipeline_progress: {
    spec: mode !== 'impl-only' ? { total: 12, completed: 0 } : null,
    impl: mode !== 'spec-only' ? { total: 4, completed: 0 } : null
  },
  user_preferences: { scope: scope || '', focus: focus || '', discussion_depth: discussionDepth || '' },
  messages_team: teamName
}
Write(`${sessionFolder}/team-session.json`, JSON.stringify(teamSession, null, 2))
```

**Workers are NOT pre-spawned here.** Workers are spawned per-stage in Phase 4 via Stop-Wait `Task(run_in_background: false)`. See SKILL.md Coordinator Spawn Template for worker prompt templates.

Worker roles by mode (spawned on-demand):

| Mode | Worker Roles |
|------|-----------------|
| spec-only | analyst, writer, discussant, reviewer (4) |
| impl-only | planner, executor, tester, reviewer (4) |
| full-lifecycle | analyst, writer, discussant, planner, executor, tester, reviewer (7) |

Each worker receives a prompt that tells it to invoke `Skill(skill="team-lifecycle", args="--role=<name>")` when receiving tasks.

### Phase 3: Create Task Chain

Task chain creation depends on the selected mode.

#### Spec-only Task Chain

```javascript
// RESEARCH Phase
TaskCreate({ subject: "RESEARCH-001: 主题发现与上下文研究", description: `${taskDescription}\n\nSession: ${sessionFolder}\n输出: ${sessionFolder}/spec/spec-config.json + spec/discovery-context.json`, activeForm: "研究中" })
TaskUpdate({ taskId: researchId, owner: "analyst" })

// DISCUSS-001: 范围讨论 (blockedBy RESEARCH-001)
TaskCreate({ subject: "DISCUSS-001: 研究结果讨论 - 范围确认与方向调整", description: `讨论 RESEARCH-001 的发现结果\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/spec/discovery-context.json\n输出: ${sessionFolder}/discussions/discuss-001-scope.md\n\n讨论维度: 范围确认、方向调整、风险预判、探索缺口`, activeForm: "讨论范围中" })
TaskUpdate({ taskId: discuss1Id, owner: "discussant", addBlockedBy: [researchId] })

// DRAFT-001: Product Brief (blockedBy DISCUSS-001)
TaskCreate({ subject: "DRAFT-001: 撰写 Product Brief", description: `基于研究和讨论共识撰写产品简报\n\nSession: ${sessionFolder}\n输入: discovery-context.json + discuss-001-scope.md\n输出: ${sessionFolder}/product-brief.md\n\n使用多视角分析: 产品/技术/用户`, activeForm: "撰写 Brief 中" })
TaskUpdate({ taskId: draft1Id, owner: "writer", addBlockedBy: [discuss1Id] })

// DISCUSS-002: Brief 评审 (blockedBy DRAFT-001)
TaskCreate({ subject: "DISCUSS-002: Product Brief 多视角评审", description: `评审 Product Brief 文档\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/spec/product-brief.md\n输出: ${sessionFolder}/discussions/discuss-002-brief.md\n\n讨论维度: 产品定位、目标用户、成功指标、竞品差异`, activeForm: "评审 Brief 中" })
TaskUpdate({ taskId: discuss2Id, owner: "discussant", addBlockedBy: [draft1Id] })

// DRAFT-002: Requirements/PRD (blockedBy DISCUSS-002)
TaskCreate({ subject: "DRAFT-002: 撰写 Requirements/PRD", description: `基于 Brief 和讨论反馈撰写需求文档\n\nSession: ${sessionFolder}\n输入: product-brief.md + discuss-002-brief.md\n输出: ${sessionFolder}/requirements/\n\n包含: 功能需求(REQ-*) + 非功能需求(NFR-*) + MoSCoW 优先级`, activeForm: "撰写 PRD 中" })
TaskUpdate({ taskId: draft2Id, owner: "writer", addBlockedBy: [discuss2Id] })

// DISCUSS-003: 需求完整性 (blockedBy DRAFT-002)
TaskCreate({ subject: "DISCUSS-003: 需求完整性与优先级讨论", description: `讨论 PRD 需求完整性\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/spec/requirements/_index.md\n输出: ${sessionFolder}/discussions/discuss-003-requirements.md\n\n讨论维度: 需求遗漏、MoSCoW合理性、验收标准可测性、非功能需求充分性`, activeForm: "讨论需求中" })
TaskUpdate({ taskId: discuss3Id, owner: "discussant", addBlockedBy: [draft2Id] })

// DRAFT-003: Architecture (blockedBy DISCUSS-003)
TaskCreate({ subject: "DRAFT-003: 撰写 Architecture Document", description: `基于需求和讨论反馈撰写架构文档\n\nSession: ${sessionFolder}\n输入: requirements/ + discuss-003-requirements.md\n输出: ${sessionFolder}/architecture/\n\n包含: 架构风格 + 组件图 + 技术选型 + ADR-* + 数据模型`, activeForm: "撰写架构中" })
TaskUpdate({ taskId: draft3Id, owner: "writer", addBlockedBy: [discuss3Id] })

// DISCUSS-004: 技术可行性 (blockedBy DRAFT-003)
TaskCreate({ subject: "DISCUSS-004: 架构决策与技术可行性讨论", description: `讨论架构设计合理性\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/spec/architecture/_index.md\n输出: ${sessionFolder}/discussions/discuss-004-architecture.md\n\n讨论维度: 技术选型风险、可扩展性、安全架构、ADR替代方案`, activeForm: "讨论架构中" })
TaskUpdate({ taskId: discuss4Id, owner: "discussant", addBlockedBy: [draft3Id] })

// DRAFT-004: Epics & Stories (blockedBy DISCUSS-004)
TaskCreate({ subject: "DRAFT-004: 撰写 Epics & Stories", description: `基于架构和讨论反馈撰写史诗和用户故事\n\nSession: ${sessionFolder}\n输入: architecture/ + discuss-004-architecture.md\n输出: ${sessionFolder}/epics/\n\n包含: EPIC-* + STORY-* + 依赖图 + MVP定义 + 执行顺序`, activeForm: "撰写 Epics 中" })
TaskUpdate({ taskId: draft4Id, owner: "writer", addBlockedBy: [discuss4Id] })

// DISCUSS-005: 执行就绪 (blockedBy DRAFT-004)
TaskCreate({ subject: "DISCUSS-005: 执行计划与MVP范围讨论", description: `讨论执行计划就绪性\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/spec/epics/_index.md\n输出: ${sessionFolder}/discussions/discuss-005-epics.md\n\n讨论维度: Epic粒度、故事估算、MVP范围、执行顺序、依赖风险`, activeForm: "讨论执行计划中" })
TaskUpdate({ taskId: discuss5Id, owner: "discussant", addBlockedBy: [draft4Id] })

// QUALITY-001: Readiness Check (blockedBy DISCUSS-005)
TaskCreate({ subject: "QUALITY-001: 规格就绪度检查", description: `全文档交叉验证和质量评分\n\nSession: ${sessionFolder}\n输入: 全部文档\n输出: ${sessionFolder}/spec/readiness-report.md + spec/spec-summary.md\n\n评分维度: 完整性(20%) + 一致性(20%) + 可追溯性(20%) + 深度(20%) + 需求覆盖率(20%)`, activeForm: "质量检查中" })
TaskUpdate({ taskId: qualityId, owner: "reviewer", addBlockedBy: [discuss5Id] })

// DISCUSS-006: 最终签收 (blockedBy QUALITY-001)
TaskCreate({ subject: "DISCUSS-006: 最终签收与交付确认", description: `最终讨论和签收\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/spec/readiness-report.md\n输出: ${sessionFolder}/discussions/discuss-006-final.md\n\n讨论维度: 质量报告审查、遗留问题处理、交付确认、下一步建议`, activeForm: "最终签收讨论中" })
TaskUpdate({ taskId: discuss6Id, owner: "discussant", addBlockedBy: [qualityId] })
```

#### Impl-only Task Chain

```javascript
// PLAN-001
TaskCreate({ subject: "PLAN-001: 探索和规划实现", description: `${taskDescription}\n\nSession: ${sessionFolder}\n写入: ${sessionFolder}/plan/`, activeForm: "规划中" })
TaskUpdate({ taskId: planId, owner: "planner" })

// IMPL-001 (blockedBy PLAN-001)
TaskCreate({ subject: "IMPL-001: 实现已批准的计划", description: `${taskDescription}\n\nSession: ${sessionFolder}\nPlan: ${sessionFolder}/plan/plan.json\nexecution_method: ${executionMethod || 'Auto'}\ncode_review: ${codeReviewTool || 'Skip'}`, activeForm: "实现中" })
TaskUpdate({ taskId: implId, owner: "executor", addBlockedBy: [planId] })

// TEST-001 (blockedBy IMPL-001)
TaskCreate({ subject: "TEST-001: 测试修复循环", description: `${taskDescription}`, activeForm: "测试中" })
TaskUpdate({ taskId: testId, owner: "tester", addBlockedBy: [implId] })

// REVIEW-001 (blockedBy IMPL-001, parallel with TEST-001)
TaskCreate({ subject: "REVIEW-001: 代码审查与需求验证", description: `${taskDescription}\n\nSession: ${sessionFolder}\nPlan: ${sessionFolder}/plan/plan.json`, activeForm: "审查中" })
TaskUpdate({ taskId: reviewId, owner: "reviewer", addBlockedBy: [implId] })
```

#### Full-lifecycle Task Chain

Create both spec and impl chains, with PLAN-001 blockedBy DISCUSS-006:

```javascript
// [All spec-only tasks as above]
// Then:
TaskCreate({ subject: "PLAN-001: 探索和规划实现", description: `${taskDescription}\n\nSession: ${sessionFolder}\n写入: ${sessionFolder}/plan/`, activeForm: "规划中" })
TaskUpdate({ taskId: planId, owner: "planner", addBlockedBy: [discuss6Id] })
// [Rest of impl-only tasks as above]
```

### Phase 4: Coordination Loop

> **设计原则（Stop-Wait）**: 模型执行没有时间概念，禁止任何形式的轮询等待。
> - ❌ 禁止: `while` 循环 + `sleep` + 检查状态
> - ✅ 采用: 同步 `Task(run_in_background: false)` 调用，Worker 返回 = 阶段完成信号
>
> 按 Phase 3 创建的任务链顺序，逐阶段 spawn worker 同步执行。
> Worker prompt 使用 SKILL.md Coordinator Spawn Template。

Receive teammate messages and make dispatch decisions. **Before each decision: `team_msg list` to review recent messages. After each decision: `team_msg log` to record.**

#### Spec Messages

| Received Message | Action |
|-----------------|--------|
| Analyst: research_ready | Read discovery-context.json → **用户确认检查点** → team_msg log → TaskUpdate RESEARCH completed (auto-unblocks DISCUSS-001) |
| Discussant: discussion_ready | Read discussion.md → judge if revision needed → unblock next DRAFT task |
| Discussant: discussion_blocked | Intervene → AskUserQuestion for user decision → write decision to discussion record → manually unblock |
| Writer: draft_ready | Read document summary → team_msg log → TaskUpdate DRAFT completed (auto-unblocks next DISCUSS) |
| Writer: draft_revision | Update dependencies → unblock related discussion tasks |
| Reviewer: quality_result (PASS ≥80%) | team_msg log → TaskUpdate QUALITY completed (auto-unblocks DISCUSS-006) |
| Reviewer: quality_result (REVIEW 60-79%) | team_msg log → notify writer of improvement suggestions |
| Reviewer: fix_required (FAIL <60%) | Create DRAFT-fix task → assign writer |

#### Impl Messages

| Received Message | Action |
|-----------------|--------|
| Planner: plan_ready | Read plan → approve/request revision → team_msg log(plan_approved/plan_revision) → TaskUpdate + SendMessage |
| Executor: impl_complete | team_msg log(task_unblocked) → TaskUpdate IMPL completed (auto-unblocks TEST + REVIEW) |
| Tester: test_result ≥ 95% | team_msg log → TaskUpdate TEST completed |
| Tester: test_result < 95% + iterations > 5 | team_msg log(error) → escalate to user |
| Reviewer: review_result (no critical) | team_msg log → TaskUpdate REVIEW completed |
| Reviewer: review_result (has critical) | team_msg log(fix_required) → TaskCreate IMPL-fix → assign executor |
| All tasks completed | → Phase 5 |

#### Full-lifecycle Handoff

When DISCUSS-006 completes in full-lifecycle mode, PLAN-001 is auto-unblocked via the dependency chain.

#### Research Confirmation Checkpoint

When receiving `research_ready` from analyst, confirm extracted requirements with user before unblocking:

```javascript
if (msgType === 'research_ready') {
  const discoveryContext = JSON.parse(Read(`${sessionFolder}/spec/discovery-context.json`))
  const dimensions = discoveryContext.seed_analysis?.exploration_dimensions || []
  const constraints = discoveryContext.seed_analysis?.constraints || []
  const problemStatement = discoveryContext.seed_analysis?.problem_statement || ''

  // Present extracted requirements for user confirmation
  AskUserQuestion({
    questions: [{
      question: `研究阶段提取到以下需求，请确认是否完整：\n\n**问题定义**: ${problemStatement}\n**探索维度**: ${dimensions.join('、')}\n**约束条件**: ${constraints.join('、')}\n\n是否有遗漏？`,
      header: "需求确认",
      multiSelect: false,
      options: [
        { label: "确认完整", description: "提取的需求已覆盖所有关键点，继续推进" },
        { label: "需要补充", description: "有遗漏的需求，我来补充" },
        { label: "需要重新研究", description: "提取方向有偏差，重新执行研究" }
      ]
    }]
  })

  if (userChoice === '需要补充') {
    // User provides additional requirements via free text
    // Merge into discovery-context.json, then unblock DISCUSS-001
    discoveryContext.seed_analysis.user_supplements = userInput
    Write(`${sessionFolder}/spec/discovery-context.json`, JSON.stringify(discoveryContext, null, 2))
  } else if (userChoice === '需要重新研究') {
    // Reset RESEARCH-001 to pending, notify analyst
    TaskUpdate({ taskId: researchId, status: 'pending' })
    team_msg({ type: 'fix_required', summary: 'User requests re-research with revised scope' })
    return // Do not unblock DISCUSS-001
  }
  // '确认完整' → proceed normally: TaskUpdate RESEARCH completed
}
```

#### Discussion Blocked Handling

```javascript
if (msgType === 'discussion_blocked') {
  const blockReason = msg.data.reason
  const options = msg.data.options

  AskUserQuestion({
    questions: [{
      question: `讨论 ${msg.ref} 遇到分歧: ${blockReason}\n请选择方向:`,
      header: "Decision",
      multiSelect: false,
      options: options.map(opt => ({ label: opt.label, description: opt.description }))
    }]
  })
  // Write user decision to discussion record, then unblock next task
}
```

### Phase 5: Report + Persistent Loop

Summarize results based on mode:
- **spec-only**: Document inventory, quality scores, discussion rounds
- **impl-only**: Changed files, test pass rate, review verdict
- **full-lifecycle**: Both spec summary + impl summary

```javascript
AskUserQuestion({
  questions: [{
    question: "当前需求已完成。下一步：",
    header: "Next",
    multiSelect: false,
    options: [
      { label: "新需求", description: "提交新需求给当前团队" },
      { label: "交付执行", description: "将规格交给执行 workflow（仅 spec 模式）" },
      { label: "关闭团队", description: "关闭所有 teammate 并清理" }
    ]
  }]
})

// === 新需求 → 回到 Phase 1（复用 team，新建任务链）===

// === 交付执行 → Handoff 逻辑 ===
if (userChoice === '交付执行') {
  AskUserQuestion({
    questions: [{
      question: "选择交付方式：",
      header: "Handoff",
      multiSelect: false,
      options: [
        { label: "lite-plan", description: "逐 Epic 轻量执行" },
        { label: "full-plan", description: "完整规划（创建 WFS session + .brainstorming/ 桥接）" },
        { label: "req-plan", description: "需求级路线图规划" },
        { label: "create-issues", description: "每个 Epic 创建 issue" }
      ]
    }]
  })

  // 读取 spec 文档
  const specConfig = JSON.parse(Read(`${sessionFolder}/spec/spec-config.json`))
  const specSummary = Read(`${sessionFolder}/spec/spec-summary.md`)
  const productBrief = Read(`${sessionFolder}/spec/product-brief.md`)
  const requirementsIndex = Read(`${sessionFolder}/spec/requirements/_index.md`)
  const architectureIndex = Read(`${sessionFolder}/spec/architecture/_index.md`)
  const epicsIndex = Read(`${sessionFolder}/spec/epics/_index.md`)
  const epicFiles = Glob(`${sessionFolder}/spec/epics/EPIC-*.md`)

  if (handoffChoice === 'lite-plan') {
    // 读取首个 MVP Epic → 调用 lite-plan
    const firstMvpFile = epicFiles.find(f => {
      const content = Read(f)
      return content.includes('mvp: true')
    })
    const epicContent = Read(firstMvpFile)
    const title = epicContent.match(/^#\s+(.+)/m)?.[1] || ''
    const description = epicContent.match(/## Description\n([\s\S]*?)(?=\n## )/)?.[1]?.trim() || ''
    Skill({ skill: "workflow:lite-plan", args: `"${title}: ${description}"` })
  }

  if (handoffChoice === 'full-plan' || handoffChoice === 'req-plan') {
    // === 桥接: 构建 .brainstorming/ 兼容结构 ===
    // 从 spec-generator Phase 6 Step 6 适配

    // Step A: 构建结构化描述
    const structuredDesc = `GOAL: ${specConfig.seed_analysis?.problem_statement || specConfig.topic}
SCOPE: ${specConfig.complexity} complexity
CONTEXT: Generated from spec team session ${specConfig.session_id}. Source: ${sessionFolder}/`

    // Step B: 创建 WFS session
    Skill({ skill: "workflow:session:start", args: `--auto "${structuredDesc}"` })
    // → 产出 sessionId (WFS-xxx) 和 session 目录

    // Step C: 创建 .brainstorming/ 桥接文件
    const brainstormDir = `.workflow/active/${sessionId}/.brainstorming`
    Bash(`mkdir -p "${brainstormDir}/feature-specs"`)

    // C.1: guidance-specification.md（action-planning-agent 最高优先读取）
    Write(`${brainstormDir}/guidance-specification.md`, `
# ${specConfig.seed_analysis?.problem_statement || specConfig.topic} - Confirmed Guidance Specification

**Source**: spec-team session ${specConfig.session_id}
**Generated**: ${new Date().toISOString()}
**Spec Directory**: ${sessionFolder}

## 1. Project Positioning & Goals
${extractSection(productBrief, "Vision")}
${extractSection(productBrief, "Goals")}

## 2. Requirements Summary
${extractSection(requirementsIndex, "Functional Requirements")}

## 3. Architecture Decisions
${extractSection(architectureIndex, "Architecture Decision Records")}
${extractSection(architectureIndex, "Technology Stack")}

## 4. Implementation Scope
${extractSection(epicsIndex, "Epic Overview")}
${extractSection(epicsIndex, "MVP Scope")}

## Feature Decomposition
${extractSection(epicsIndex, "Traceability Matrix")}

## Appendix: Source Documents
| Document | Path | Description |
|----------|------|-------------|
| Product Brief | ${sessionFolder}/spec/product-brief.md | Vision, goals, scope |
| Requirements | ${sessionFolder}/spec/requirements/ | _index.md + REQ-*.md + NFR-*.md |
| Architecture | ${sessionFolder}/spec/architecture/ | _index.md + ADR-*.md |
| Epics | ${sessionFolder}/spec/epics/ | _index.md + EPIC-*.md |
| Readiness Report | ${sessionFolder}/spec/readiness-report.md | Quality validation |
`)

    // C.2: feature-index.json（EPIC → Feature 映射）
    const features = epicFiles.map(epicFile => {
      const content = Read(epicFile)
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
      const fm = fmMatch ? parseYAML(fmMatch[1]) : {}
      const basename = epicFile.replace(/.*[/\\]/, '').replace('.md', '')
      const epicNum = (fm.id || '').replace('EPIC-', '')
      const slug = basename.replace(/^EPIC-\d+-/, '')
      return {
        id: `F-${epicNum}`, slug, name: content.match(/^#\s+(.+)/m)?.[1] || '',
        priority: fm.mvp ? "High" : "Medium",
        spec_path: `${brainstormDir}/feature-specs/F-${epicNum}-${slug}.md`,
        source_epic: fm.id, source_file: epicFile
      }
    })
    Write(`${brainstormDir}/feature-specs/feature-index.json`, JSON.stringify({
      version: "1.0", source: "spec-team",
      spec_session: specConfig.session_id, features, cross_cutting_specs: []
    }, null, 2))

    // C.3: Feature-spec 文件（EPIC → F-*.md 转换）
    features.forEach(feature => {
      const epicContent = Read(feature.source_file)
      Write(feature.spec_path, `
# Feature Spec: ${feature.source_epic} - ${feature.name}

**Source**: ${feature.source_file}
**Priority**: ${feature.priority === "High" ? "MVP" : "Post-MVP"}

## Description
${extractSection(epicContent, "Description")}

## Stories
${extractSection(epicContent, "Stories")}

## Requirements
${extractSection(epicContent, "Requirements")}

## Architecture
${extractSection(epicContent, "Architecture")}
`)
    })

    // Step D: 调用下游 workflow
    if (handoffChoice === 'full-plan') {
      Skill({ skill: "workflow:plan", args: `"${structuredDesc}"` })
    } else {
      Skill({ skill: "workflow:req-plan-with-file", args: `"${specConfig.seed_analysis?.problem_statement || specConfig.topic}"` })
    }
  }

  if (handoffChoice === 'create-issues') {
    // 逐 EPIC 文件创建 issue
    epicFiles.forEach(epicFile => {
      const content = Read(epicFile)
      const title = content.match(/^#\s+(.+)/m)?.[1] || ''
      const description = content.match(/## Description\n([\s\S]*?)(?=\n## )/)?.[1]?.trim() || ''
      Skill({ skill: "issue:new", args: `"${title}: ${description}"` })
    })
  }
}

// === 关闭 → shutdown 给每个 teammate → TeamDelete() ===
```

#### Helper Functions Reference (pseudocode)

```javascript
// Extract a named ## section from a markdown document
function extractSection(markdown, sectionName) {
  // Return content between ## {sectionName} and next ## heading
  const regex = new RegExp(`## ${sectionName}\\n([\\s\\S]*?)(?=\\n## |$)`)
  return markdown.match(regex)?.[1]?.trim() || ''
}

// Parse YAML frontmatter string into object
function parseYAML(yamlStr) {
  // Simple key-value parsing from YAML frontmatter
  const result = {}
  yamlStr.split('\n').forEach(line => {
    const match = line.match(/^(\w+):\s*(.+)/)
    if (match) result[match[1]] = match[2].replace(/^["']|["']$/g, '')
  })
  return result
}
```

## Session State Tracking

At each key transition, update `team-session.json`:

```javascript
// Helper: update session state
function updateSession(sessionFolder, updates) {
  const session = JSON.parse(Read(`${sessionFolder}/team-session.json`))
  Object.assign(session, updates, { updated_at: new Date().toISOString() })
  Write(`${sessionFolder}/team-session.json`, JSON.stringify(session, null, 2))
}

// On task completion:
updateSession(sessionFolder, {
  completed_tasks: [...session.completed_tasks, taskPrefix],
  pipeline_progress: { ...session.pipeline_progress,
    [phase]: { ...session.pipeline_progress[phase], completed: session.pipeline_progress[phase].completed + 1 }
  }
})

// On phase transition (spec → plan):
updateSession(sessionFolder, { current_phase: 'plan' })

// On completion:
updateSession(sessionFolder, { status: 'completed', completed_at: new Date().toISOString() })

// On user closes team:
updateSession(sessionFolder, { status: 'completed', completed_at: new Date().toISOString() })
```

## Session File Structure

```
.workflow/.team/TLS-{slug}-{YYYY-MM-DD}/
├── team-session.json           # Session state (resume support)
├── spec/                       # Spec artifacts
│   ├── spec-config.json
│   ├── discovery-context.json
│   ├── product-brief.md
│   ├── requirements/           # _index.md + REQ-*.md + NFR-*.md
│   ├── architecture/           # _index.md + ADR-*.md
│   ├── epics/                  # _index.md + EPIC-*.md
│   ├── readiness-report.md
│   └── spec-summary.md
├── discussions/                 # Discussion records
│   └── discuss-001..006.md
└── plan/                        # Plan artifacts
    ├── exploration-{angle}.json
    ├── explorations-manifest.json
    ├── plan.json
    └── .task/
        └── TASK-*.json
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Teammate 无响应 | 发追踪消息，2次无响应 → 重新 spawn |
| Plan 被拒 3+ 次 | Coordinator 自行规划 |
| 测试卡在 <80% 超 5 次迭代 | 上报用户 |
| Review 发现 critical | 创建 IMPL-fix 任务给 executor |
| 讨论无法共识 | Coordinator 介入 → AskUserQuestion |
| 文档质量 <60% | 创建 DRAFT-fix 任务给 writer |
| Writer 修订 3+ 次 | 上报用户，建议调整范围 |
| Research 无法完成 | 降级为简化模式 |
