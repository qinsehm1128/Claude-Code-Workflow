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

### Phase 1: Requirement Clarification

Parse `$ARGUMENTS` to extract `--team-name` and task description.

```javascript
const args = "$ARGUMENTS"
const teamNameMatch = args.match(/--team-name[=\s]+([\w-]+)/)
const teamName = teamNameMatch ? teamNameMatch[1] : `lifecycle-${Date.now().toString(36)}`
const taskDescription = args.replace(/--team-name[=\s]+[\w-]+/, '').replace(/--role[=\s]+\w+/, '').trim()
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

### Phase 2: Create Team + Spawn Workers

```javascript
TeamCreate({ team_name: teamName })

// Session setup
const topicSlug = taskDescription.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40)
const dateStr = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().substring(0, 10)
const specSessionFolder = `.workflow/.spec-team/${topicSlug}-${dateStr}`
const implSessionFolder = `.workflow/.team-plan/${topicSlug}-${dateStr}`

if (mode === 'spec-only' || mode === 'full-lifecycle') {
  Bash(`mkdir -p ${specSessionFolder}/discussions`)
}
if (mode === 'impl-only' || mode === 'full-lifecycle') {
  Bash(`mkdir -p ${implSessionFolder}`)
}
```

**Conditional spawn based on mode** (see SKILL.md Coordinator Spawn Template for full prompts):

| Mode | Spawned Workers |
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
TaskCreate({ subject: "RESEARCH-001: 主题发现与上下文研究", description: `${taskDescription}\n\nSession: ${specSessionFolder}\n输出: ${specSessionFolder}/spec-config.json + discovery-context.json`, activeForm: "研究中" })
TaskUpdate({ taskId: researchId, owner: "analyst" })

// DISCUSS-001: 范围讨论 (blockedBy RESEARCH-001)
TaskCreate({ subject: "DISCUSS-001: 研究结果讨论 - 范围确认与方向调整", description: `讨论 RESEARCH-001 的发现结果\n\nSession: ${specSessionFolder}\n输入: ${specSessionFolder}/discovery-context.json\n输出: ${specSessionFolder}/discussions/discuss-001-scope.md\n\n讨论维度: 范围确认、方向调整、风险预判、探索缺口`, activeForm: "讨论范围中" })
TaskUpdate({ taskId: discuss1Id, owner: "discussant", addBlockedBy: [researchId] })

// DRAFT-001: Product Brief (blockedBy DISCUSS-001)
TaskCreate({ subject: "DRAFT-001: 撰写 Product Brief", description: `基于研究和讨论共识撰写产品简报\n\nSession: ${specSessionFolder}\n输入: discovery-context.json + discuss-001-scope.md\n输出: ${specSessionFolder}/product-brief.md\n\n使用多视角分析: 产品/技术/用户`, activeForm: "撰写 Brief 中" })
TaskUpdate({ taskId: draft1Id, owner: "writer", addBlockedBy: [discuss1Id] })

// DISCUSS-002: Brief 评审 (blockedBy DRAFT-001)
TaskCreate({ subject: "DISCUSS-002: Product Brief 多视角评审", description: `评审 Product Brief 文档\n\nSession: ${specSessionFolder}\n输入: ${specSessionFolder}/product-brief.md\n输出: ${specSessionFolder}/discussions/discuss-002-brief.md\n\n讨论维度: 产品定位、目标用户、成功指标、竞品差异`, activeForm: "评审 Brief 中" })
TaskUpdate({ taskId: discuss2Id, owner: "discussant", addBlockedBy: [draft1Id] })

// DRAFT-002: Requirements/PRD (blockedBy DISCUSS-002)
TaskCreate({ subject: "DRAFT-002: 撰写 Requirements/PRD", description: `基于 Brief 和讨论反馈撰写需求文档\n\nSession: ${specSessionFolder}\n输入: product-brief.md + discuss-002-brief.md\n输出: ${specSessionFolder}/requirements/\n\n包含: 功能需求(REQ-*) + 非功能需求(NFR-*) + MoSCoW 优先级`, activeForm: "撰写 PRD 中" })
TaskUpdate({ taskId: draft2Id, owner: "writer", addBlockedBy: [discuss2Id] })

// DISCUSS-003: 需求完整性 (blockedBy DRAFT-002)
TaskCreate({ subject: "DISCUSS-003: 需求完整性与优先级讨论", description: `讨论 PRD 需求完整性\n\nSession: ${specSessionFolder}\n输入: ${specSessionFolder}/requirements/_index.md\n输出: ${specSessionFolder}/discussions/discuss-003-requirements.md\n\n讨论维度: 需求遗漏、MoSCoW合理性、验收标准可测性、非功能需求充分性`, activeForm: "讨论需求中" })
TaskUpdate({ taskId: discuss3Id, owner: "discussant", addBlockedBy: [draft2Id] })

// DRAFT-003: Architecture (blockedBy DISCUSS-003)
TaskCreate({ subject: "DRAFT-003: 撰写 Architecture Document", description: `基于需求和讨论反馈撰写架构文档\n\nSession: ${specSessionFolder}\n输入: requirements/ + discuss-003-requirements.md\n输出: ${specSessionFolder}/architecture/\n\n包含: 架构风格 + 组件图 + 技术选型 + ADR-* + 数据模型`, activeForm: "撰写架构中" })
TaskUpdate({ taskId: draft3Id, owner: "writer", addBlockedBy: [discuss3Id] })

// DISCUSS-004: 技术可行性 (blockedBy DRAFT-003)
TaskCreate({ subject: "DISCUSS-004: 架构决策与技术可行性讨论", description: `讨论架构设计合理性\n\nSession: ${specSessionFolder}\n输入: ${specSessionFolder}/architecture/_index.md\n输出: ${specSessionFolder}/discussions/discuss-004-architecture.md\n\n讨论维度: 技术选型风险、可扩展性、安全架构、ADR替代方案`, activeForm: "讨论架构中" })
TaskUpdate({ taskId: discuss4Id, owner: "discussant", addBlockedBy: [draft3Id] })

// DRAFT-004: Epics & Stories (blockedBy DISCUSS-004)
TaskCreate({ subject: "DRAFT-004: 撰写 Epics & Stories", description: `基于架构和讨论反馈撰写史诗和用户故事\n\nSession: ${specSessionFolder}\n输入: architecture/ + discuss-004-architecture.md\n输出: ${specSessionFolder}/epics/\n\n包含: EPIC-* + STORY-* + 依赖图 + MVP定义 + 执行顺序`, activeForm: "撰写 Epics 中" })
TaskUpdate({ taskId: draft4Id, owner: "writer", addBlockedBy: [discuss4Id] })

// DISCUSS-005: 执行就绪 (blockedBy DRAFT-004)
TaskCreate({ subject: "DISCUSS-005: 执行计划与MVP范围讨论", description: `讨论执行计划就绪性\n\nSession: ${specSessionFolder}\n输入: ${specSessionFolder}/epics/_index.md\n输出: ${specSessionFolder}/discussions/discuss-005-epics.md\n\n讨论维度: Epic粒度、故事估算、MVP范围、执行顺序、依赖风险`, activeForm: "讨论执行计划中" })
TaskUpdate({ taskId: discuss5Id, owner: "discussant", addBlockedBy: [draft4Id] })

// QUALITY-001: Readiness Check (blockedBy DISCUSS-005)
TaskCreate({ subject: "QUALITY-001: 规格就绪度检查", description: `全文档交叉验证和质量评分\n\nSession: ${specSessionFolder}\n输入: 全部文档\n输出: ${specSessionFolder}/readiness-report.md + spec-summary.md\n\n评分维度: 完整性(25%) + 一致性(25%) + 可追溯性(25%) + 深度(25%)`, activeForm: "质量检查中" })
TaskUpdate({ taskId: qualityId, owner: "reviewer", addBlockedBy: [discuss5Id] })

// DISCUSS-006: 最终签收 (blockedBy QUALITY-001)
TaskCreate({ subject: "DISCUSS-006: 最终签收与交付确认", description: `最终讨论和签收\n\nSession: ${specSessionFolder}\n输入: ${specSessionFolder}/readiness-report.md\n输出: ${specSessionFolder}/discussions/discuss-006-final.md\n\n讨论维度: 质量报告审查、遗留问题处理、交付确认、下一步建议`, activeForm: "最终签收讨论中" })
TaskUpdate({ taskId: discuss6Id, owner: "discussant", addBlockedBy: [qualityId] })
```

#### Impl-only Task Chain

```javascript
// PLAN-001
TaskCreate({ subject: "PLAN-001: 探索和规划实现", description: `${taskDescription}\n\n写入: ${implSessionFolder}/`, activeForm: "规划中" })
TaskUpdate({ taskId: planId, owner: "planner" })

// IMPL-001 (blockedBy PLAN-001)
TaskCreate({ subject: "IMPL-001: 实现已批准的计划", description: `${taskDescription}\n\nPlan: ${implSessionFolder}/plan.json`, activeForm: "实现中" })
TaskUpdate({ taskId: implId, owner: "executor", addBlockedBy: [planId] })

// TEST-001 (blockedBy IMPL-001)
TaskCreate({ subject: "TEST-001: 测试修复循环", description: `${taskDescription}`, activeForm: "测试中" })
TaskUpdate({ taskId: testId, owner: "tester", addBlockedBy: [implId] })

// REVIEW-001 (blockedBy IMPL-001, parallel with TEST-001)
TaskCreate({ subject: "REVIEW-001: 代码审查与需求验证", description: `${taskDescription}\n\nPlan: ${implSessionFolder}/plan.json`, activeForm: "审查中" })
TaskUpdate({ taskId: reviewId, owner: "reviewer", addBlockedBy: [implId] })
```

#### Full-lifecycle Task Chain

Create both spec and impl chains, with PLAN-001 blockedBy DISCUSS-006:

```javascript
// [All spec-only tasks as above]
// Then:
TaskCreate({ subject: "PLAN-001: 探索和规划实现", description: `${taskDescription}\n\nSpec: ${specSessionFolder}\n写入: ${implSessionFolder}/`, activeForm: "规划中" })
TaskUpdate({ taskId: planId, owner: "planner", addBlockedBy: [discuss6Id] })
// [Rest of impl-only tasks as above]
```

### Phase 4: Coordination Loop

Receive teammate messages and make dispatch decisions. **Before each decision: `team_msg list` to review recent messages. After each decision: `team_msg log` to record.**

#### Spec Messages

| Received Message | Action |
|-----------------|--------|
| Analyst: research_ready | Read discovery-context.json → team_msg log → TaskUpdate RESEARCH completed (auto-unblocks DISCUSS-001) |
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
// 新需求 → 回到 Phase 1（复用 team，新建任务链）
// 交付执行 → 提示可用的执行 workflow
// 关闭 → shutdown 给每个 teammate → TeamDelete()
```

## Session File Structure

```
# Spec session
.workflow/.spec-team/{topic-slug}-{YYYY-MM-DD}/
├── spec-config.json
├── discovery-context.json
├── product-brief.md
├── requirements/
├── architecture/
├── epics/
├── readiness-report.md
├── spec-summary.md
└── discussions/
    └── discuss-001..006.md

# Impl session
.workflow/.team-plan/{task-slug}-{YYYY-MM-DD}/
├── exploration-*.json
├── explorations-manifest.json
├── planning-context.md
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
