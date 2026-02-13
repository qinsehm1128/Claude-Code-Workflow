# Collaboration Patterns Specification

> 10 种团队协作模式，每种具备：收敛性、完整流程、反馈控制

---

## Pattern Standard Structure

每种协作模式遵循统一规范：

```
┌─────────────────────────────────────────┐
│  Entry Condition   (何时启用)            │
├─────────────────────────────────────────┤
│  Roles Required    (需要哪些角色)        │
├─────────────────────────────────────────┤
│  Workflow          (完整执行流程)         │
├─────────────────────────────────────────┤
│  Convergence       (收敛条件)            │
│  ├─ Success Gate   (成功判定)            │
│  ├─ Max Iterations (最大迭代)            │
│  └─ Timeout        (超时处理)            │
├─────────────────────────────────────────┤
│  Feedback Loop     (反馈控制)            │
│  ├─ Signal         (反馈信号)            │
│  ├─ Handler        (处理逻辑)            │
│  └─ Correction     (纠正动作)            │
├─────────────────────────────────────────┤
│  Fallback          (降级策略)            │
└─────────────────────────────────────────┘
```

---

## CP-1: Linear Pipeline (线性流水线)

### Description

最基础的协作模式。任务沿固定顺序在角色间传递，每个阶段有明确的入口和出口条件。上一阶段的输出是下一阶段的输入。

### Entry Condition

- 任务具有清晰的阶段划分（规划 → 实现 → 验证）
- 各阶段之间有天然的依赖关系
- 适用于大多数标准特性开发

### Roles Required

`coordinator` → `planner` → `executor` → `tester`

### Workflow

```
         ┌──────────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐
需求 ──→ │ PLAN     │──→ │ IMPL     │──→ │ TEST      │──→ │ REPORT   │
         │ planner  │    │ executor │    │ + REVIEW  │    │ coord.   │
         └────┬─────┘    └────┬─────┘    └─────┬─────┘    └──────────┘
              │               │                │
              ▼               ▼                ▼
         plan.json       code changes     test results
                                          review findings
```

```javascript
// Coordinator creates task chain
TaskCreate({ subject: "PLAN-001", owner: "planner" })
TaskCreate({ subject: "IMPL-001", owner: "executor", addBlockedBy: [planId] })
TaskCreate({ subject: "TEST-001", owner: "tester", addBlockedBy: [implId] })
TaskCreate({ subject: "REVIEW-001", owner: "tester", addBlockedBy: [implId] })
```

### Convergence

| Element | Value |
|---------|-------|
| **Success Gate** | 所有阶段任务状态 = `completed` |
| **Max Iterations** | 每阶段 1 次（若失败触发 Review-Fix Cycle） |
| **Timeout** | 无显式超时，每阶段内部有各自收敛机制 |

### Feedback Loop

```
┌─ Stage Transition Feedback ─────────────────────────┐
│                                                      │
│  Plan rejected?  → planner revises → resubmit       │
│  Impl has errors? → executor self-validates → fix    │
│  Tests fail?     → tester fix cycle → retry          │
│  Review blocks?  → create IMPL-fix → executor fixes  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Signal**: 下一阶段的 reject/fail message
**Handler**: Coordinator 路由消息回上一阶段
**Correction**: 上一阶段 agent 修订并重新提交

### Fallback

- Plan 拒绝 3+ 次 → Coordinator 自行规划
- Test 达不到 95% 超过 5 次迭代 → 上报用户
- Review 发现 critical → 创建 IMPL-fix 任务

### Implementation Reference

当前 `coordinate.md` 即采用此模式。

---

## CP-2: Review-Fix Cycle (审查修复循环)

### Description

两个角色之间的迭代改进循环。一个角色产出工作成果，另一个角色审查，发现问题后退回修复，直到达到质量门控。这是软件开发中 code review 的自然映射。

### Entry Condition

- 工作产出需要质量验证（代码实现、计划、文档）
- 存在明确的质量标准（pass rate、severity threshold、acceptance criteria）
- 需要多轮迭代才能达到质量要求

### Roles Required

`producer` (executor/planner) ↔ `reviewer` (tester/reviewer)

### Workflow

```
         ┌─────────┐              ┌──────────┐
         │Producer │              │Reviewer  │
         │         │──(1)产出───→│          │
         │         │              │          │
         │         │←─(2)反馈────│          │
         │         │              │          │
         │         │──(3)修订───→│          │
         │         │              │          │
         │  ...    │   ...循环    │  ...     │
         │         │              │          │
         └─────────┘              └──────────┘
              │                        │
              ▼                        ▼
        final artifact           APPROVE verdict
```

```javascript
// Coordinator orchestrates review-fix cycle
function reviewFixCycle(producerRole, reviewerRole, maxIterations) {
  let iteration = 0
  let verdict = 'PENDING'

  while (iteration < maxIterations && verdict !== 'APPROVE') {
    iteration++

    // Step 1: Producer delivers (or revises)
    if (iteration === 1) {
      // Wait for initial delivery
      // msg type: impl_complete / plan_ready
    } else {
      // Wait for revision
      // msg type: impl_complete (revision)
    }

    // Step 2: Reviewer examines
    // Creates REVIEW task, waits for review_result

    // Step 3: Check verdict
    verdict = reviewResult.data.verdict // APPROVE | CONDITIONAL | BLOCK

    if (verdict === 'BLOCK') {
      // Step 4: Create fix task for producer
      TaskCreate({
        subject: `IMPL-fix-${iteration}`,
        description: `Fix issues: ${reviewResult.data.findings}`,
        owner: producerRole
      })
      // Send feedback to producer
      team_msg({ type: "fix_required", data: { iteration, findings: reviewResult.data.findings } })
    }
  }

  return { verdict, iterations: iteration }
}
```

### Convergence

| Element | Value |
|---------|-------|
| **Success Gate** | Reviewer verdict = `APPROVE` 或 `CONDITIONAL`（无 critical findings） |
| **Max Iterations** | 5 轮（可配置）。Producer 修复 → Reviewer 再审 = 1 轮 |
| **Timeout** | 单轮超时 = 阶段超时（由各角色内部控制） |

### Feedback Loop

```
Signal:    review_result { verdict: "BLOCK", findings: [...] }
           ↓
Handler:   Coordinator 解析 findings，按 severity 分类
           ↓
Correction: 创建 IMPL-fix 任务，附带 findings 明细
            Producer 收到任务 → 读取 findings → 修复 → 重新提交
           ↓
Loop:      Reviewer 再次审查修订后的产出
```

**反馈信号结构**:
```javascript
{
  verdict: "APPROVE" | "CONDITIONAL" | "BLOCK",
  findings: {
    critical: [{ file, line, description, suggestion }],
    high: [...],
    medium: [...],
    low: [...]
  },
  iteration: 2,
  delta: "+3 fixed, -1 new issue"  // 对比上一轮的变化
}
```

### Fallback

| Condition | Action |
|-----------|--------|
| 达到 max iterations 仍 BLOCK | 上报用户，附带全部 findings 历史 |
| Reviewer 发现 Producer 无法修复的设计问题 | 升级到 CP-5 Escalation，或回退到 CP-1 重新规划 |
| 连续 2 轮 findings 不减少（无改善） | 中断循环，上报用户请求介入 |

---

## CP-3: Parallel Fan-out/Fan-in (并行扇出扇入)

### Description

Coordinator 将同一任务或同一类任务广播给多个 agent 并行执行，收集所有结果后聚合。适用于需要多角度分析、分片处理、或冗余验证的场景。

### Entry Condition

- 任务可分解为独立的并行子任务
- 需要多角度/多维度分析（如安全 + 性能 + 架构审查）
- 大型任务需要分片并行处理

### Roles Required

`coordinator` → `worker-1, worker-2, ... worker-N` → `coordinator` (aggregation)

### Workflow

```
                    ┌─ worker-1 ─┐
                    │  角度 A     │───┐
         broadcast  ├─ worker-2 ─┤   │  aggregate
coord ──────────────┤  角度 B     │───┼──── coord
                    ├─ worker-3 ─┤   │
                    │  角度 C     │───┘
                    └────────────┘
```

```javascript
// Phase 1: Fan-out - broadcast tasks
const workerTasks = angles.map((angle, i) => {
  const taskId = TaskCreate({
    subject: `ANALYZE-${i+1}: ${angle} analysis`,
    description: `Analyze from ${angle} perspective: ${requirement}`,
    owner: `worker-${i+1}`,
    activeForm: `Analyzing ${angle}`
  })
  return taskId
})

// Phase 2: Wait for all workers (or quorum + timeout)
function waitForCompletion(taskIds, quorumRatio = 1.0, timeoutMs = 300000) {
  const startTime = Date.now()
  const quorumCount = Math.ceil(taskIds.length * quorumRatio)
  let completedCount = 0

  while (completedCount < quorumCount) {
    if (Date.now() - startTime > timeoutMs) break
    const tasks = TaskList()
    completedCount = taskIds.filter(id =>
      tasks.find(t => t.id === id && t.status === 'completed')
    ).length
    // Wait...
  }

  return { completed: completedCount, total: taskIds.length, timedOut: completedCount < quorumCount }
}

// Phase 3: Fan-in - aggregate results
function aggregateResults(taskIds) {
  const results = taskIds.map(id => {
    const task = TaskGet({ taskId: id })
    return { angle: task.subject, result: task.metadata?.result }
  })

  // Conflict detection
  const conflicts = detectConflicts(results)

  return {
    results,
    conflicts,
    consensus: conflicts.length === 0,
    summary: synthesize(results)
  }
}
```

### Convergence

| Element | Value |
|---------|-------|
| **Success Gate** | 所有 worker 完成（或达到 quorum 比例，默认 100%） |
| **Max Iterations** | 1 轮扇出（若聚合后有冲突，可触发 CP-4 Consensus） |
| **Timeout** | 可配置，默认 5 分钟。超时后用已完成的结果聚合 |

### Feedback Loop

```
Signal:    每个 worker 的 {角度}_result message
           ↓
Handler:   Coordinator 收集所有结果
           ↓
Aggregate: 合并结果 + 冲突检测
           ├─ 无冲突 → 直接合成最终结果
           └─ 有冲突 → 升级到 CP-4 Consensus Gate
```

**聚合策略**:
- **Union（并集）**: 合并所有发现（适用于安全审查 - 不遗漏任何 finding）
- **Intersection（交集）**: 只保留多个 worker 共同发现的问题（适用于降噪）
- **Weighted（加权）**: 按 worker 的专业权重合并（适用于多专家评审）

### Fallback

| Condition | Action |
|-----------|--------|
| Worker 超时未完成 | 用已完成的 worker 结果聚合，标注缺失角度 |
| Worker 返回错误 | 跳过该 worker，用 N-1 结果聚合 |
| 聚合结果有冲突 | 触发 CP-4 Consensus Gate 解决分歧 |

---

## CP-4: Consensus Gate (共识门控)

### Description

在做出重要决策前，要求多个 agent 投票表达意见，只有达到 quorum 才能通过。模拟软件开发中的 Design Review、Architecture Decision Record (ADR) 的决策流程。

### Entry Condition

- 架构决策（选择技术方案 A vs B vs C）
- 安全决策（是否可接受某个风险）
- 影响面大的重构（需要多方确认）
- CP-3 扇出结果有冲突需要裁决

### Roles Required

`proposer` → `voter-1, voter-2, ... voter-N` → `coordinator` (tally)

### Workflow

```
                    ┌─ voter-1 ─────────────┐
                    │ APPROVE + rationale    │
         proposal   ├─ voter-2 ─────────────┤   tally
proposer ─────────→ │ REJECT + rationale    │ ────→ coordinator
                    ├─ voter-3 ─────────────┤        │
                    │ APPROVE + conditions   │        ▼
                    └───────────────────────┘    decision
```

```javascript
// Phase 1: Proposal
const proposal = {
  id: `PROPOSAL-${Date.now()}`,
  title: "Adopt Strategy Pattern for payment gateway",
  options: [
    { id: "A", description: "Strategy Pattern with factory", pros: [...], cons: [...] },
    { id: "B", description: "Plugin architecture", pros: [...], cons: [...] }
  ],
  context: "Payment module needs multi-gateway support",
  deadline: Date.now() + 300000  // 5 min
}

// Phase 2: Broadcast proposal to voters
voters.forEach(voter => {
  SendMessage({
    recipient: voter,
    content: `## Proposal: ${proposal.title}\n${JSON.stringify(proposal)}`,
    summary: "Vote requested"
  })
})

// Phase 3: Collect votes
function collectVotes(proposalId, voterCount, quorum, deadline) {
  const votes = []
  while (votes.length < voterCount && Date.now() < deadline) {
    // Listen for vote messages
    const msgs = team_msg({ operation: "list", type: "vote" })
    const newVotes = msgs.filter(m =>
      m.data.proposalId === proposalId && !votes.find(v => v.from === m.from)
    )
    votes.push(...newVotes)

    // Check quorum
    if (votes.length >= quorum) break
  }
  return votes
}

// Phase 4: Tally and decide
function tallyVotes(votes, quorumRatio = 0.67) {
  const approvals = votes.filter(v => v.data.vote === 'APPROVE')
  const rejections = votes.filter(v => v.data.vote === 'REJECT')
  const conditions = votes.flatMap(v => v.data.conditions || [])

  const approvalRatio = approvals.length / votes.length
  const passed = approvalRatio >= quorumRatio

  return {
    passed,
    approvalRatio,
    approvals: approvals.length,
    rejections: rejections.length,
    conditions: [...new Set(conditions)],
    rationales: votes.map(v => ({ from: v.from, vote: v.data.vote, rationale: v.data.rationale }))
  }
}
```

### Convergence

| Element | Value |
|---------|-------|
| **Success Gate** | 赞成率 ≥ quorum（默认 2/3）且无 BLOCK 级别反对 |
| **Max Iterations** | 2 轮。第 1 轮未达 quorum → 修订提案 → 第 2 轮重投 |
| **Timeout** | 5 分钟。超时后以已收到的票数计算（≥ quorum 则通过） |

### Feedback Loop

```
Signal:    vote { vote: "REJECT", rationale: "...", conditions: [...] }
           ↓
Handler:   Coordinator 聚合所有反对意见和附加条件
           ↓
Correction: ├─ 未达 quorum → Proposer 修订提案，融合反对意见 → 重投
            ├─ 达到 quorum 但有 conditions → 记录 conditions 作为实施约束
            └─ 明确通过 → 执行决策
```

**投票格式**:
```javascript
team_msg({
  type: "vote",
  data: {
    proposalId: "PROPOSAL-xxx",
    vote: "APPROVE" | "REJECT" | "ABSTAIN",
    rationale: "选择方案A因为...",          // 必须提供理由
    conditions: ["需要增加向后兼容层"],       // 可选附加条件
    confidence: 0.85                        // 置信度 0-1
  }
})
```

### Fallback

| Condition | Action |
|-----------|--------|
| 2 轮都未达 quorum | 上报用户裁决 |
| 投票截止但票数不足（< N/2） | 延长截止时间 1 轮 |
| 全员 ABSTAIN | 由 Coordinator 做默认决策并记录 |

---

## CP-5: Escalation Chain (逐级升级)

### Description

当 agent 遇到无法自行解决的问题时，逐级升级到更高层级的处理能力。模拟软件开发中的 on-call escalation / tiered support。

### Entry Condition

- Agent 自修复失败（尝试 N 次后仍无法解决）
- 问题超出当前角色能力范围
- 需要更高权限或更广视角的决策

### Roles Required

`agent` → `specialist` → `coordinator` → `user`

### Workflow

```
Level 0          Level 1          Level 2          Level 3
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Agent    │────→│Specialist│────→│Coordinator│───→│ User     │
│ 自修复   │     │ 专家诊断 │     │ 全局视角  │     │ 人工裁决 │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │
     ▼                ▼                ▼                ▼
  retry 2x        CLI analysis    cross-team fix    manual fix
```

```javascript
// Escalation state machine
const ESCALATION_LEVELS = [
  {
    level: 0,
    name: "Self-repair",
    handler: "agent",
    maxAttempts: 2,
    actions: ["Retry with different approach", "Read more context", "Simplify approach"]
  },
  {
    level: 1,
    name: "Specialist diagnosis",
    handler: "specialist",
    maxAttempts: 1,
    actions: ["CLI analysis (gemini/qwen)", "Cross-file dependency trace", "Pattern matching"]
  },
  {
    level: 2,
    name: "Coordinator intervention",
    handler: "coordinator",
    maxAttempts: 1,
    actions: ["Reassign to different agent", "Modify task scope", "Create support task"]
  },
  {
    level: 3,
    name: "User escalation",
    handler: "user",
    maxAttempts: 1,
    actions: ["Present diagnosis chain", "Request manual guidance", "Offer options"]
  }
]

function escalate(issue, currentLevel) {
  const nextLevel = ESCALATION_LEVELS[currentLevel + 1]
  if (!nextLevel) {
    // Already at highest level, wait for user
    return { action: "wait", level: currentLevel }
  }

  team_msg({
    type: "escalate",
    data: {
      issue: issue.description,
      from_level: currentLevel,
      to_level: nextLevel.level,
      attempts_at_current: issue.attempts,
      diagnosis_chain: issue.diagnosisHistory  // 所有层级的诊断记录
    }
  })

  return { action: "escalate", nextHandler: nextLevel.handler, level: nextLevel.level }
}
```

### Convergence

| Element | Value |
|---------|-------|
| **Success Gate** | 问题在某个层级被解决（agent 报告 issue resolved） |
| **Max Iterations** | 每个层级有独立的 maxAttempts（L0: 2, L1: 1, L2: 1, L3: 1） |
| **Timeout** | L0-L2 无显式超时；L3 用户层需等待用户响应 |

### Feedback Loop

```
Signal:    escalate { issue, from_level, diagnosis_chain }
           ↓
Handler:   上级接收问题 + 下级的全部诊断历史
           ↓
Diagnosis: 上级基于更广视角/更强能力做出诊断
           ↓
Response:  ├─ 解决方案 → 传回原 agent 执行
           ├─ 重新定义问题 → 修改任务描述，agent 重试
           └─ 无法解决 → 继续升级到下一层
```

**诊断链结构** (每层追加):
```javascript
{
  diagnosisHistory: [
    { level: 0, agent: "executor", attempts: 2, diagnosis: "TypeScript类型不匹配", tried: ["修改类型定义", "添加类型断言"] },
    { level: 1, agent: "specialist", attempts: 1, diagnosis: "循环依赖导致类型无法推断", recommendation: "重构模块边界" },
    // ... 每层追加自己的诊断
  ]
}
```

### Fallback

| Condition | Action |
|-----------|--------|
| L3 用户无响应 | Agent 尝试最保守的方案继续，标记为 WORKAROUND |
| 诊断链显示根本问题（如架构缺陷） | 回退到 CP-1 重新规划 |
| 升级到 L1 后解决 | 将解决方案记录为 pattern，下次 L0 可直接处理 |

---

## CP-6: Incremental Delivery (增量交付)

### Description

将大型任务分解为小的增量，每个增量独立交付并验证后再进行下一个。模拟 CI/CD 中的小批量交付和渐进式部署。

### Entry Condition

- 大型特性（影响 > 10 个文件）
- 高风险变更（需要逐步验证）
- 用户要求渐进可见的进度

### Roles Required

`coordinator` → `executor` (increment) → `validator` (per-increment) → `coordinator` (gate)

### Workflow

```
         ┌─────────────────────────────────────────────────┐
         │  Increment 1    Increment 2    Increment N      │
         │  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
         │  │ Implement│  │ Implement│  │ Implement│      │
         │  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
         │       ▼             ▼             ▼             │
         │  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
         │  │ Validate │  │ Validate │  │ Validate │      │
         │  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
         │       ▼             ▼             ▼             │
         │  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
         │  │ Gate ✓   │  │ Gate ✓   │  │ Gate ✓   │      │
         │  └──────────┘  └──────────┘  └──────────┘      │
         └─────────────────────────────────────────────────┘
                                                     │
                                                     ▼
                                              Full validation
```

```javascript
// Coordinator splits plan into increments
function createIncrements(plan) {
  // Group tasks by dependency layers
  const layers = topologicalSort(plan.tasks)

  return layers.map((layer, i) => ({
    id: `INCREMENT-${i+1}`,
    tasks: layer,
    gate: {
      syntax_clean: true,
      no_regression: true,    // 已有测试不破坏
      increment_tests_pass: true  // 增量相关测试通过
    }
  }))
}

// Execute increment cycle
for (const increment of increments) {
  // Step 1: Executor implements increment
  TaskCreate({
    subject: `IMPL-inc-${increment.id}`,
    description: `Implement increment: ${increment.tasks.map(t => t.title).join(', ')}`,
    owner: "executor"
  })

  // Step 2: Wait for implementation
  // msg: increment_ready

  // Step 3: Validator checks increment gate
  const gateResult = validateIncrement(increment)

  // Step 4: Gate decision
  if (gateResult.passed) {
    team_msg({ type: "increment_ready", data: { increment: increment.id, status: "PASS" } })
    // Continue to next increment
  } else {
    // Feedback: which gate criteria failed
    team_msg({ type: "fix_required", data: {
      increment: increment.id,
      failed_gates: gateResult.failures,
      suggestion: gateResult.fix_suggestion
    }})
    // Executor fixes → re-validate (max 3 retries per increment)
  }
}

// Final: full validation after all increments
TaskCreate({ subject: "TEST-final", description: "Full test suite after all increments" })
```

### Convergence

| Element | Value |
|---------|-------|
| **Success Gate** | 所有增量通过各自的 gate + 最终全量验证通过 |
| **Max Iterations** | 每个增量最多 3 次重试，总增量数由 plan 决定 |
| **Timeout** | 单个增量超时 = 增量任务数 × 单任务超时 |

### Feedback Loop

```
Signal:    increment gate failure { failed_gates, affected_files }
           ↓
Handler:   Coordinator 定位失败的 gate 条件
           ↓
Correction: ├─ syntax_clean 失败 → Executor 修复语法
            ├─ no_regression 失败 → Executor 修复回归 + 回滚该增量
            └─ increment_tests 失败 → 触发 CP-2 Review-Fix Cycle
```

**增量进度追踪**:
```javascript
{
  total_increments: 4,
  completed: 2,
  current: 3,
  progress_percent: 50,
  gate_history: [
    { id: "INCREMENT-1", attempts: 1, status: "PASS" },
    { id: "INCREMENT-2", attempts: 2, status: "PASS" },
    { id: "INCREMENT-3", attempts: 1, status: "IN_PROGRESS" }
  ]
}
```

### Fallback

| Condition | Action |
|-----------|--------|
| 增量重试 3 次仍失败 | 回滚该增量代码，标记为 blocked，继续下一增量 |
| 超过半数增量被 blocked | 停止交付，上报用户评估是否重新规划 |
| 最终全量验证失败 | 识别失败增量组合，逐个回退定位 |

---

## CP-7: Swarming (群策攻关)

### Description

当流水线被一个问题阻塞时，暂停正常工作流，所有可用 agent 集中力量解决该问题。模拟敏捷开发中的 swarming / mob debugging。

### Entry Condition

- 关键任务被阻塞超过阈值时间
- Agent 自修复和 L1 升级都失败
- 问题影响多个下游任务

### Roles Required

`coordinator` (发起) → `all available agents` (协同) → `coordinator` (裁决)

### Workflow

```
       ┌───────────────────────────────────┐
       │         SWARM MODE ACTIVE         │
       │                                   │
       │   ┌────────┐  ┌────────┐         │
       │   │Agent A │  │Agent B │         │
       │   │诊断视角1│  │诊断视角2│         │
       │   └───┬────┘  └───┬────┘         │
       │       │            │              │
       │       ▼            ▼              │
       │   ┌─────────────────────┐         │
       │   │  Coordinator 汇总   │         │
       │   │  选择最佳诊断       │         │
       │   └─────────┬───────────┘         │
       │             ▼                     │
       │   ┌─────────────────────┐         │
       │   │  指定 Agent 执行修复 │         │
       │   └─────────────────────┘         │
       │                                   │
       └───────────────────────────────────┘
                      │
                      ▼
              Resume normal pipeline
```

```javascript
// Coordinator initiates swarm
function initiateSwarm(blockingIssue) {
  // Step 1: Pause all non-critical tasks
  const activeTasks = TaskList().filter(t => t.status === 'in_progress')
  activeTasks.forEach(t => {
    TaskUpdate({ taskId: t.id, metadata: { paused_for_swarm: true } })
  })

  // Step 2: Broadcast swarm request
  team_msg({
    type: "swarm_join",
    data: {
      issue: blockingIssue.description,
      affected_tasks: blockingIssue.blockedTasks,
      diagnosis_so_far: blockingIssue.diagnosisHistory,
      assignment: "All agents: diagnose from your expertise angle"
    }
  })

  // Step 3: Each agent analyzes from their perspective
  // planner: 架构视角诊断
  // executor: 实现细节诊断
  // tester: 测试/环境视角诊断

  // Step 4: Collect diagnoses (fan-in)
  // Uses CP-3 fan-in aggregation

  // Step 5: Coordinator selects best diagnosis + assigns fix
  const bestDiagnosis = selectBestDiagnosis(diagnoses)
  const fixer = selectBestFixer(bestDiagnosis, availableAgents)

  TaskCreate({
    subject: `SWARM-FIX: ${blockingIssue.summary}`,
    description: `Fix based on swarm diagnosis:\n${bestDiagnosis.detail}`,
    owner: fixer
  })

  // Step 6: Verify fix, resume pipeline
  // ... wait for fix completion ...

  // Step 7: Resume paused tasks
  activeTasks.forEach(t => {
    TaskUpdate({ taskId: t.id, metadata: { paused_for_swarm: null } })
  })
}
```

### Convergence

| Element | Value |
|---------|-------|
| **Success Gate** | 阻塞问题解决（相关测试通过 / 错误消失） |
| **Max Iterations** | 2 轮诊断。第 1 轮全员诊断 → 修复 → 若失败 → 第 2 轮聚焦诊断 |
| **Timeout** | 10 分钟。超时后以最佳可用诊断尝试修复 |

### Feedback Loop

```
Signal:    每个 agent 的 swarm_diagnosis { perspective, root_cause, confidence, fix_suggestion }
           ↓
Handler:   Coordinator 按 confidence 排序，合并互补的诊断
           ↓
Selection: 选择 confidence 最高且 fix_suggestion 最具体的方案
           ↓
Execution: 指定最合适的 agent 执行修复
           ↓
Verify:    修复后重新运行触发阻塞的场景
           ├─ 通过 → 恢复流水线
           └─ 失败 → 第 2 轮，排除已尝试方案
```

### Fallback

| Condition | Action |
|-----------|--------|
| 2 轮 swarm 未解决 | 升级到用户（CP-5 L3） |
| 修复引入新问题 | 回滚修复，尝试次优方案 |
| Agent 在 swarm 期间无响应 | 跳过该 agent，用其余 agent 的诊断 |

---

## CP-8: Consulting/Advisory (咨询顾问)

### Description

工作中的 agent 暂停当前任务，向拥有特定领域知识的 specialist 请求建议，获得建议后继续工作。不同于升级（CP-5），consulting 不转移问题所有权。

### Entry Condition

- Agent 遇到不熟悉的领域（如安全、性能优化、特定框架用法）
- 需要验证方案的正确性但不需要他人实现
- 需要领域最佳实践参考

### Roles Required

`requester` (任何工作中的 agent) → `consultant` (specialist agent) → `requester` (继续工作)

### Workflow

```
         requester                  consultant
         ┌──────────┐              ┌──────────┐
         │ Working  │              │ Idle     │
         │          │──(1)请求────→│          │
         │ Paused   │              │ 分析中   │
         │          │←─(2)建议────│          │
         │ Resume   │              │ Idle     │
         │ (应用建议)│              │          │
         └──────────┘              └──────────┘
```

```javascript
// Requester sends consultation request
function requestConsultation(topic, context, urgency = 'normal') {
  team_msg({
    type: "consult_request",
    from: currentRole,
    to: "coordinator",  // coordinator routes to appropriate specialist
    data: {
      topic: topic,                  // "security", "performance", "database"
      question: context.question,    // 具体问题
      context: context.codeSnippet,  // 相关代码片段
      options: context.options,      // 可选方案（如果有）
      urgency: urgency               // "blocking" | "normal" | "low"
    }
  })
  // Pause current work, wait for response
}

// Coordinator routes to specialist
function routeConsultation(request) {
  const specialist = selectSpecialist(request.data.topic)
  // If no specialist agent exists, use CLI tool as specialist
  if (!specialist) {
    // Fallback: invoke CLI analysis
    Bash(`ccw cli -p "PURPOSE: Expert consultation on ${request.data.topic}
TASK: ${request.data.question}
CONTEXT: ${request.data.context}
EXPECTED: Actionable recommendation with confidence level
" --tool gemini --mode analysis`, { run_in_background: true })
  }
}

// Consultant provides advice
function provideAdvice(request) {
  team_msg({
    type: "consult_response",
    from: "consultant",
    to: request.from,
    data: {
      recommendation: "使用 bcrypt 而非 SHA-256 进行密码哈希",
      rationale: "bcrypt 内置 salt 和自适应计算成本...",
      confidence: 0.95,
      references: ["OWASP Password Storage Cheat Sheet"],
      caveats: ["需要增加 ~100ms 延迟"],
      alternative: "如果延迟敏感，可考虑 Argon2id"
    }
  })
}

// Requester applies advice
function applyAdvice(advice) {
  if (advice.data.confidence >= 0.8) {
    // Apply recommendation directly
    return { action: "apply", recommendation: advice.data.recommendation }
  } else {
    // Low confidence: request second opinion or escalate
    return { action: "second_opinion" }
  }
}
```

### Convergence

| Element | Value |
|---------|-------|
| **Success Gate** | 咨询回复 confidence ≥ 0.8 且 requester 成功应用建议 |
| **Max Iterations** | 1 次主咨询 + 1 次追问（如果首次回复不够清晰） |
| **Timeout** | blocking: 2 分钟, normal: 5 分钟, low: 无超时 |

### Feedback Loop

```
Signal:    consult_response { recommendation, confidence, caveats }
           ↓
Handler:   Requester 评估建议的适用性
           ├─ confidence ≥ 0.8 → 直接应用
           ├─ confidence < 0.8 → 追问一轮或请求 second opinion
           └─ 与当前方案冲突 → 上报 coordinator 裁决
           ↓
Correction: Requester 基于建议调整实现方案，继续原任务
```

### Fallback

| Condition | Action |
|-----------|--------|
| 无可用 specialist | 使用 CLI tool (gemini/qwen) 替代 |
| 咨询超时 | Requester 用自己的最佳判断继续，标注 unverified |
| 建议与当前设计冲突 | 上报 coordinator，触发 CP-4 Consensus |

---

## CP-9: Dual-Track (双轨并行)

### Description

两条工作轨道并行推进，在预定义的同步点（checkpoint）对齐。典型应用：设计与实现并行、前端与后端并行、功能开发与测试开发并行。

### Entry Condition

- 任务可分解为两条相对独立的工作流
- 两条轨道有明确的同步点（interface contract、API spec、schema）
- 并行执行能提升整体效率

### Roles Required

`coordinator` → `track-A` agent + `track-B` agent → `coordinator` (sync)

### Workflow

```
         Track A (Design/API)              Track B (Implementation)
         ┌────────────┐                    ┌────────────┐
         │ Phase A-1  │                    │ Phase B-1  │
         │ API 设计   │                    │ 脚手架搭建 │
         └─────┬──────┘                    └─────┬──────┘
               │                                 │
               ▼          ┌──────────┐           ▼
         ╔═══════════════╗│ SYNC-1  │╔═══════════════╗
         ║ checkpoint 1  ║│ 对齐接口 │║ checkpoint 1  ║
         ╚═══════════════╝└──────────┘╚═══════════════╝
               │                                 │
               ▼                                 ▼
         ┌────────────┐                    ┌────────────┐
         │ Phase A-2  │                    │ Phase B-2  │
         │ 详细设计   │                    │ 核心实现   │
         └─────┬──────┘                    └─────┬──────┘
               │                                 │
               ▼          ┌──────────┐           ▼
         ╔═══════════════╗│ SYNC-2  │╔═══════════════╗
         ║ checkpoint 2  ║│ 集成验证 │║ checkpoint 2  ║
         ╚═══════════════╝└──────────┘╚═══════════════╝
```

```javascript
// Coordinator defines sync points
const syncPoints = [
  {
    id: "SYNC-1",
    name: "Interface Contract",
    trackA_deliverable: "API schema / interface definitions",
    trackB_deliverable: "Scaffold with interface stubs",
    alignment_check: "Both tracks agree on interface signatures"
  },
  {
    id: "SYNC-2",
    name: "Integration Verification",
    trackA_deliverable: "Complete design + test specs",
    trackB_deliverable: "Core implementation",
    alignment_check: "Implementation passes design test specs"
  }
]

// Phase execution with sync barriers
for (const sync of syncPoints) {
  // Launch both tracks in parallel
  const trackATask = TaskCreate({
    subject: `TRACK-A-${sync.id}: ${sync.trackA_deliverable}`,
    owner: "track-a-agent"
  })
  const trackBTask = TaskCreate({
    subject: `TRACK-B-${sync.id}: ${sync.trackB_deliverable}`,
    owner: "track-b-agent"
  })

  // Wait for both tracks to reach sync point
  waitForBoth(trackATask, trackBTask)

  // Sync point: alignment check
  const aligned = checkAlignment(sync.alignment_check, trackAResult, trackBResult)

  if (!aligned) {
    // Misalignment detected → correction
    team_msg({ type: "sync_checkpoint", data: {
      sync_id: sync.id,
      status: "MISALIGNED",
      trackA_state: trackAResult.summary,
      trackB_state: trackBResult.summary,
      conflicts: aligned.conflicts
    }})
    // Coordinator mediates: which track adjusts?
    resolveAlignment(aligned.conflicts, trackATask, trackBTask)
  } else {
    team_msg({ type: "sync_checkpoint", data: { sync_id: sync.id, status: "ALIGNED" } })
  }
}
```

### Convergence

| Element | Value |
|---------|-------|
| **Success Gate** | 所有 sync point 对齐 + 最终集成验证通过 |
| **Max Iterations** | 每个 sync point 最多 2 次对齐尝试 |
| **Timeout** | 先到达 sync point 的 track 等待另一个 track，超时 5 分钟 |

### Feedback Loop

```
Signal:    sync_checkpoint { status: "MISALIGNED", conflicts }
           ↓
Handler:   Coordinator 分析冲突来源
           ├─ Track A 的设计不合理 → 要求 Track A 调整设计
           ├─ Track B 偏离了接口约定 → 要求 Track B 重新对齐
           └─ 双方都有偏差 → 协商折中方案
           ↓
Correction: 被要求调整的 track agent 收到 fix 描述
            → 调整产出 → 重新到达 sync point
```

### Fallback

| Condition | Action |
|-----------|--------|
| 一条 track 完全阻塞 | 另一条 track 暂停等待，触发 CP-7 Swarming 解决阻塞 |
| Sync 对齐 2 次失败 | 降级为 CP-1 Linear Pipeline（顺序执行） |
| 两条 track 差距过大（一快一慢） | 快 track 预做下一阶段，慢 track 加速 |

---

## CP-10: Post-Mortem (复盘回顾)

### Description

任务完成后，对整个执行过程进行结构化回顾，提取经验教训和改进建议。这些知识可以反馈到项目的 CLAUDE.md 或 core memory 中，提升未来任务的执行质量。

### Entry Condition

- 团队完成一个完整任务周期后（所有 task completed）
- 任务执行过程中出现显著问题（多次失败、多次升级）
- 用户主动请求回顾

### Roles Required

`coordinator` (发起 + 汇总) → `all agents` (提供各自视角) → `coordinator` (文档化)

### Workflow

```
         ┌──────────────────────────────────────────┐
         │           POST-MORTEM PHASE              │
         │                                          │
         │  1. Coordinator 收集执行数据              │
         │     ├─ 任务链完成情况                     │
         │     ├─ 消息总线历史                       │
         │     └─ 迭代/升级/失败记录                  │
         │                                          │
         │  2. 每个 Agent 提交回顾                    │
         │     ├─ Planner: 规划准确度                 │
         │     ├─ Executor: 实现障碍                  │
         │     └─ Tester: 质量发现                   │
         │                                          │
         │  3. Coordinator 汇总                      │
         │     ├─ 成功因素                           │
         │     ├─ 改进点                             │
         │     └─ 行动建议                           │
         │                                          │
         │  4. 输出到 memory / CLAUDE.md             │
         └──────────────────────────────────────────┘
```

```javascript
// Coordinator initiates post-mortem
function conductPostMortem(teamName) {
  // Step 1: Collect execution data
  const messages = team_msg({ operation: "list", team: teamName })
  const tasks = TaskList()
  const completedTasks = tasks.filter(t => t.status === 'completed')
  const failedTasks = tasks.filter(t => t.status === 'in_progress' && t.metadata?.stuck)

  const executionData = {
    total_tasks: tasks.length,
    completed: completedTasks.length,
    total_messages: messages.length,
    escalations: messages.filter(m => m.type === 'escalate').length,
    fix_cycles: messages.filter(m => m.type === 'fix_required').length,
    errors: messages.filter(m => m.type === 'error').length
  }

  // Step 2: Request agent retrospectives (Fan-out)
  // Each agent answers: What went well? What was difficult? What should change?
  agents.forEach(agent => {
    SendMessage({
      recipient: agent.name,
      content: `## Post-Mortem Request
请回顾本次任务，回答:
1. **顺利**: 哪些方面执行顺利？
2. **困难**: 遇到了什么障碍？
3. **建议**: 下次如何改进？
4. **模式**: 发现了什么可复用的模式？`,
      summary: "Post-mortem request"
    })
  })

  // Step 3: Aggregate findings
  // Collect retro_finding messages from all agents
  const findings = collectFindings(agents)

  // Step 4: Generate structured post-mortem report
  const report = {
    team: teamName,
    timestamp: new Date().toISOString(),
    execution_summary: executionData,
    what_went_well: findings.flatMap(f => f.went_well),
    what_was_difficult: findings.flatMap(f => f.difficult),
    improvement_actions: findings.flatMap(f => f.suggestions),
    reusable_patterns: findings.flatMap(f => f.patterns),
    recommendations: generateRecommendations(executionData, findings)
  }

  // Step 5: Persist learnings
  // Option A: Write to session artifacts
  Write(`${sessionFolder}/post-mortem.json`, JSON.stringify(report, null, 2))

  // Option B: Import to core memory (if significant)
  if (report.reusable_patterns.length > 0) {
    mcp__ccw-tools__core_memory({
      operation: "import",
      text: `Team ${teamName} post-mortem: ${report.reusable_patterns.join('; ')}`
    })
  }

  return report
}
```

### Convergence

| Element | Value |
|---------|-------|
| **Success Gate** | 所有 agent 提交回顾 + 报告生成完毕 |
| **Max Iterations** | 1 轮（回顾是单次活动） |
| **Timeout** | Agent 回顾提交超时 3 分钟，超时则仅用已收到的回顾 |

### Feedback Loop

```
Signal:    retro_finding { went_well, difficult, suggestions, patterns }
           ↓
Handler:   Coordinator 分类、去重、优先级排序
           ↓
Output:    ├─ 高价值 patterns → 写入 core memory / CLAUDE.md
           ├─ 改进建议 → 记录到项目 guidelines
           └─ 问题根因 → 作为下次任务的预防措施
```

**学习闭环**: Post-mortem 的输出反馈到未来任务的 Phase 2 Context Loading，实现持续改进。

### Fallback

| Condition | Action |
|-----------|--------|
| Agent 无法提供回顾（已关闭） | 从消息总线历史中提取该 agent 的执行数据 |
| 无显著 findings | 生成最小报告，不写入 core memory |
| 执行数据缺失 | 基于现有数据生成部分报告 |

---

## Pattern Composition (模式组合)

### 常见组合

协作模式可以组合使用，形成更复杂的工作流：

```
1. Standard Development (标准开发)
   CP-1 (Pipeline) + CP-2 (Review-Fix) + CP-10 (Post-Mortem)

2. High-Risk Feature (高风险特性)
   CP-4 (Consensus on design) → CP-6 (Incremental Delivery) → CP-2 (Review-Fix each increment)

3. Complex Investigation (复杂问题调查)
   CP-3 (Fan-out analysis) → CP-4 (Consensus on diagnosis) → CP-7 (Swarm if needed)

4. Parallel Development (并行开发)
   CP-9 (Dual-Track) + CP-2 (Review-Fix per track) + CP-10 (Post-Mortem)

5. Expert-Guided Development (专家指导开发)
   CP-8 (Consulting for design) → CP-1 (Pipeline implementation) → CP-2 (Review-Fix)
```

### 组合规则

1. **不可重入**: 同一时间只能有一个 CP-7 (Swarming) 实例
2. **可嵌套**: CP-6 的每个增量可以内部使用 CP-2
3. **可升级**: CP-2 内发现无法修复的问题可升级到 CP-5 或 CP-7
4. **可降级**: CP-9 对齐失败可降级到 CP-1
5. **CP-10 始终在最后**: Post-mortem 只在团队任务完成后执行

### State Machine (模式状态机)

```
                     ┌──────────────────────────────────────────┐
                     │            COORDINATOR FSM               │
                     │                                          │
   新需求 ────→ [PLAN] ──→ [EXECUTE] ──→ [VALIDATE] ──→ [DONE] │
                  │           │              │              │    │
                  │           │              │              │    │
                  ▼           ▼              ▼              ▼    │
              CP-4?       CP-6?          CP-2?          CP-10   │
              Consensus   Incremental    Review-Fix     Post-   │
              Gate        Delivery       Cycle          Mortem  │
                  │           │              │                   │
                  ▼           ▼              ▼                   │
              [blocked?]  [blocked?]     [blocked?]             │
                  │           │              │                   │
                  ▼           ▼              ▼                   │
              CP-5/CP-7   CP-5/CP-7      CP-5/CP-7             │
              Escalate    Escalate       Escalate               │
              /Swarm      /Swarm         /Swarm                 │
                     └──────────────────────────────────────────┘
```

---

## Coordinator Integration Guide

### Coordinator 如何选择协作模式

```javascript
// In coordinate.md Phase 1 (需求澄清) or Phase 4 (协调主循环)

function selectCollaborationPattern(context) {
  const { taskType, complexity, riskLevel, teamSize, hasExpert } = context

  // Rule-based selection
  const patterns = ['CP-1']  // CP-1 is always the base

  if (riskLevel === 'high') patterns.push('CP-4')       // Consensus for risky decisions
  if (complexity === 'High' && taskType === 'feature') patterns.push('CP-6')  // Incremental for large features
  if (taskType === 'review' || taskType === 'test') patterns.push('CP-2')     // Review-Fix for quality
  if (hasExpert && complexity !== 'Low') patterns.push('CP-8')                // Consulting for expertise
  patterns.push('CP-10')  // Post-mortem always included

  return patterns
}
```

### Coordinator 消息路由表（含协作模式）

| 消息类型 | 触发模式 | Coordinator 动作 |
|---------|---------|-----------------|
| `plan_ready` | CP-1 | 审批 plan → 通知 executor |
| `impl_complete` | CP-1/CP-6 | 解锁 TEST/REVIEW 或下一增量 |
| `review_result` (BLOCK) | CP-2 | 创建 fix 任务 → 启动 Review-Fix Cycle |
| `vote` | CP-4 | 收集投票 → 达到 quorum 则执行决策 |
| `escalate` | CP-5 | 路由到上一级处理者 |
| `increment_ready` | CP-6 | 验证增量 gate → 允许或拒绝 |
| `swarm_join` | CP-7 | 暂停其他任务 → 聚合诊断 |
| `consult_request` | CP-8 | 路由到 specialist 或 CLI tool |
| `sync_checkpoint` | CP-9 | 检查两条 track 对齐状态 |
| `retro_finding` | CP-10 | 收集回顾 → 生成报告 |
