---
name: team-iterdev
description: Unified team skill for iterative development team. All roles invoke this skill with --role arg for role-specific execution. Triggers on "team iterdev".
allowed-tools: TeamCreate(*), TeamDelete(*), SendMessage(*), TaskCreate(*), TaskUpdate(*), TaskList(*), TaskGet(*), Task(*), AskUserQuestion(*), Read(*), Write(*), Edit(*), Bash(*), Glob(*), Grep(*)
---

# Team IterDev

持续迭代开发团队技能。通过 Generator-Critic 循环（developer↔reviewer，最多3轮）、任务账本（task-ledger.json）实时进度追踪、共享记忆（Sprint间学习）和动态管道选择，实现增量交付开发。所有团队成员通过 `--role=xxx` 路由。

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│  Skill(skill="team-iterdev", args="--role=xxx")   │
└───────────────────┬──────────────────────────────┘
                    │ Role Router
    ┌───────────┬───┼───────────┬───────────┐
    ↓           ↓   ↓           ↓           ↓
┌──────────┐┌─────────┐┌─────────┐┌──────┐┌────────┐
│coordinator││architect││developer││tester││reviewer│
│ roles/   ││ roles/  ││ roles/  ││roles/││ roles/ │
└──────────┘└─────────┘└─────────┘└──────┘└────────┘
```

## Role Router

### Input Parsing

```javascript
const args = "$ARGUMENTS"
const roleMatch = args.match(/--role[=\s]+(\w+)/)

if (!roleMatch) {
  throw new Error("Missing --role argument. Available roles: coordinator, architect, developer, tester, reviewer")
}

const role = roleMatch[1]
const teamName = args.match(/--team[=\s]+([\w-]+)/)?.[1] || "iterdev"
```

### Role Dispatch

```javascript
const VALID_ROLES = {
  "coordinator": { file: "roles/coordinator.md", prefix: null },
  "architect":   { file: "roles/architect.md",   prefix: "DESIGN" },
  "developer":   { file: "roles/developer.md",   prefix: "DEV" },
  "tester":      { file: "roles/tester.md",      prefix: "VERIFY" },
  "reviewer":    { file: "roles/reviewer.md",    prefix: "REVIEW" }
}

if (!VALID_ROLES[role]) {
  throw new Error(`Unknown role: ${role}. Available: ${Object.keys(VALID_ROLES).join(', ')}`)
}

Read(VALID_ROLES[role].file)
```

### Available Roles

| Role | Task Prefix | Responsibility | Role File |
|------|-------------|----------------|-----------|
| `coordinator` | N/A | Sprint规划、积压管理、任务账本维护 | [roles/coordinator.md](roles/coordinator.md) |
| `architect` | DESIGN-* | 技术设计、任务分解、架构决策 | [roles/architect.md](roles/architect.md) |
| `developer` | DEV-* | 代码实现、增量交付 | [roles/developer.md](roles/developer.md) |
| `tester` | VERIFY-* | 测试执行、修复循环、回归检测 | [roles/tester.md](roles/tester.md) |
| `reviewer` | REVIEW-* | 代码审查、质量评分、改进建议 | [roles/reviewer.md](roles/reviewer.md) |

## Shared Infrastructure

### Role Isolation Rules

#### Output Tagging（强制）

```javascript
SendMessage({ content: `## [${role}] ...`, summary: `[${role}] ...` })
mcp__ccw-tools__team_msg({ summary: `[${role}] ...` })
```

#### Coordinator 隔离

| 允许 | 禁止 |
|------|------|
| Sprint 规划 (AskUserQuestion) | ❌ 直接编写代码 |
| 创建任务链 (TaskCreate) | ❌ 直接执行测试/审查 |
| 维护任务账本 (task-ledger.json) | ❌ 调用 code-developer 等实现类 subagent |
| 监控进度 | ❌ 绕过 worker 自行完成 |

#### Worker 隔离

| 允许 | 禁止 |
|------|------|
| 处理自己前缀的任务 | ❌ 处理其他角色前缀的任务 |
| 读写 shared-memory.json (自己的字段) | ❌ 为其他角色创建任务 |
| SendMessage 给 coordinator | ❌ 直接与其他 worker 通信 |

### Team Configuration

```javascript
const TEAM_CONFIG = {
  name: "iterdev",
  sessionDir: ".workflow/.team/IDS-{slug}-{date}/",
  sharedMemory: "shared-memory.json",
  taskLedger: "task-ledger.json"
}
```

### Task Ledger (创新模式 — 任务账本)

实时追踪所有 Sprint 任务进度：

```javascript
// task-ledger.json structure
{
  "sprint_id": "sprint-1",
  "sprint_goal": "...",
  "tasks": [
    {
      "id": "DEV-001",
      "title": "...",
      "owner": "developer",
      "status": "completed",         // pending | in_progress | completed | blocked
      "started_at": "...",
      "completed_at": "...",
      "gc_rounds": 0,                // Generator-Critic iterations
      "review_score": null,           // reviewer 评分
      "test_pass_rate": null,         // tester 通过率
      // === Phase 1 扩展字段 ===
      "conflict_info": {              // 冲突处理
        "status": "none",             // none | detected | resolved
        "conflicting_files": [],      // 冲突文件列表
        "resolution_strategy": null,  // manual | auto_merge | abort
        "resolved_by_task_id": null   // 解决此冲突的任务ID
      },
      "rollback_info": {              // 回滚策略
        "snapshot_id": null,          // 可回滚的快照ID
        "rollback_procedure": null,   // 回滚操作说明或脚本路径
        "last_successful_state_id": null  // 上一个成功状态ID
      },
      // === Phase 2 扩展字段 ===
      "external_dependencies": [      // 外部依赖管理
        {
          "name": "string",           // 依赖名称
          "version_range": "string",  // 期望版本范围
          "actual_version": "string", // 实际使用的版本
          "source": "string",         // 来源 (npm, maven, git)
          "status": "ok"              // ok | mismatch | missing
        }
      ]
    }
  ],
  "metrics": {
    "total": 5,
    "completed": 3,
    "in_progress": 1,
    "blocked": 0,
    "velocity": 3                     // tasks completed this sprint
  }
}

// Coordinator updates ledger at each task transition
function updateLedger(sessionFolder, taskId, updates) {
  const ledger = JSON.parse(Read(`${sessionFolder}/task-ledger.json`))
  const task = ledger.tasks.find(t => t.id === taskId)
  if (task) Object.assign(task, updates)
  // Recalculate metrics
  ledger.metrics.completed = ledger.tasks.filter(t => t.status === 'completed').length
  ledger.metrics.in_progress = ledger.tasks.filter(t => t.status === 'in_progress').length
  Write(`${sessionFolder}/task-ledger.json`, JSON.stringify(ledger, null, 2))
}
```

### Shared Memory (Sprint间学习)

```javascript
// shared-memory.json — accumulated across sprints
{
  "sprint_history": [
    {
      "sprint_id": "sprint-1",
      "what_worked": ["..."],
      "what_failed": ["..."],
      "patterns_learned": ["..."]
    }
  ],
  "architecture_decisions": [],
  "implementation_context": [],
  "review_feedback_trends": [],
  // === Phase 1 扩展字段 ===
  "resource_locks": {                  // 并发控制：资源锁定状态
    // "{resource_id}": {
    //   "locked_by_task_id": "DEV-001",
    //   "timestamp": "2026-02-23T10:00:00Z",
    //   "holder_role": "developer"
    // }
  },
  // === Phase 2 扩展字段 ===
  "task_checkpoints": {                // 状态恢复：任务检查点
    // "{task_id}": [
    //   { "timestamp": "...", "state_data_pointer": "..." }
    // ]
  },
  // === Phase 3 扩展字段 ===
  "user_feedback_items": [             // 用户反馈循环
    // {
    //   "feedback_id": "FB-xxx",
    //   "source_task_id": "DEV-001",
    //   "description": "string",
    //   "severity": "medium",          // low | medium | high | critical
    //   "status": "new",               // new | reviewed | addressed | closed
    //   "timestamp": "...",
    //   "category": "general"          // general | ux | performance | bug | feature
    // }
  ],
  "tech_debt_items": [                 // 技术债务追踪
    // {
    //   "debt_id": "TD-xxx",
    //   "category": "code",            // code | design | test | documentation
    //   "source_task_id": "DEV-001",
    //   "description": "string",
    //   "severity": "medium",
    //   "detection_date": "...",
    //   "owner": "developer",
    //   "resolution_plan": "string",
    //   "estimated_effort": "medium",  // small | medium | large
    //   "priority": "medium",
    //   "status": "open",              // open | in_progress | resolved | deferred
    //   "related_files": []
    // }
  ]
}
```

#### Resource Lock Protocol (并发控制)

```javascript
// Coordinator 资源锁定服务
function acquireLock(sessionFolder, resourceId, taskId, role) {
  const memory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`))
  const lock = memory.resource_locks[resourceId]

  if (lock && lock.locked_by_task_id !== taskId) {
    // 资源已被锁定
    return { success: false, lockedBy: lock.locked_by_task_id }
  }

  // 获取锁
  memory.resource_locks[resourceId] = {
    locked_by_task_id: taskId,
    timestamp: new Date().toISOString(),
    holder_role: role
  }
  Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(memory, null, 2))

  // 发送锁定消息
  mcp__ccw-tools__team_msg({
    operation: "log", team: teamName, from: role, to: "coordinator",
    type: "resource_locked", summary: `[${role}] Resource locked: ${resourceId}`, ref: taskId
  })
  return { success: true }
}

function releaseLock(sessionFolder, resourceId, taskId) {
  const memory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`))
  const lock = memory.resource_locks[resourceId]

  if (lock && lock.locked_by_task_id === taskId) {
    delete memory.resource_locks[resourceId]
    Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(memory, null, 2))

    mcp__ccw-tools__team_msg({
      operation: "log", team: teamName, from: "coordinator", to: "all",
      type: "resource_unlocked", summary: `[coordinator] Resource unlocked: ${resourceId}`, ref: taskId
    })
  }
}
```

### Message Bus

```javascript
mcp__ccw-tools__team_msg({
  operation: "log", team: teamName, from: role, to: "coordinator",
  type: "<type>", summary: `[${role}] <summary>`, ref: "<file_path>"
})
```

| Role | Types |
|------|-------|
| coordinator | `sprint_started`, `gc_loop_trigger`, `sprint_complete`, `task_unblocked`, `error`, `shutdown`, **`conflict_detected`**, **`conflict_resolved`**, **`resource_locked`**, **`resource_unlocked`**, **`resource_contention`**, **`rollback_initiated`**, **`rollback_completed`**, **`rollback_failed`** |
| architect | `design_ready`, `design_revision`, `error` |
| developer | `dev_complete`, `dev_progress`, `error` |
| tester | `verify_passed`, `verify_failed`, `fix_required`, `error` |
| reviewer | `review_passed`, `review_revision`, `review_critical`, `error` |

**Phase 1 新增消息类型说明**:
- `conflict_detected`: 任务间检测到冲突时发送
- `conflict_resolved`: 冲突被解决时发送
- `resource_locked`: 共享资源被锁定时发送
- `resource_unlocked`: 共享资源被释放时发送
- `resource_contention`: 任务尝试获取已锁定资源时发送
- `rollback_initiated`: 触发回滚操作时发送
- `rollback_completed`: 回滚成功完成时发送
- `rollback_failed`: 回滚操作失败时发送

**Phase 2 新增消息类型说明**:
- `dependency_mismatch`: 依赖版本不匹配时发送
- `dependency_update_needed`: 外部依赖有重要更新时发送
- `context_checkpoint_saved`: 任务上下文检查点保存时发送
- `context_restored`: 从检查点恢复上下文时发送

**Phase 3 新增消息类型说明**:
- `user_feedback_received`: 接收到用户反馈时发送
- `tech_debt_identified`: 识别到技术债务时发送

### CLI Fallback

```javascript
Bash(`ccw team log --team "${teamName}" --from "${role}" --to "coordinator" --type "<type>" --summary "<summary>" --json`)
```

### Task Lifecycle (All Worker Roles)

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith(`${VALID_ROLES[role].prefix}-`) &&
  t.owner === role && t.status === 'pending' && t.blockedBy.length === 0
)
if (myTasks.length === 0) return
const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
// Phase 2-4: Role-specific
// Phase 5: Report + Loop
```

## Three-Pipeline Architecture

```
Patch (简单修复):
  DEV-001 → VERIFY-001

Sprint (标准特性):
  DESIGN-001 → DEV-001 → [VERIFY-001 + REVIEW-001](parallel)

Multi-Sprint (大型特性):
  Sprint 1: DESIGN-001 → DEV-001 → DEV-002(incremental) → VERIFY-001 → DEV-fix → REVIEW-001
  Sprint 2: DESIGN-002(refined) → DEV-003 → VERIFY-002 → REVIEW-002
  ...
```

### Generator-Critic Loop

developer ↔ reviewer 循环，最多3轮：

```
DEV → REVIEW → (if review.critical_count > 0 || review.score < 7)
              → DEV-fix → REVIEW-2 → (if still issues) → DEV-fix-2 → REVIEW-3
              → (max 3 rounds, then accept with warning)
```

### Multi-Sprint Dynamic Downgrade

```javascript
// If Sprint N is progressing well, downgrade Sprint N+1 complexity
if (sprintMetrics.velocity >= expectedVelocity && sprintMetrics.review_avg >= 8) {
  // Next sprint: skip detailed design, use simplified pipeline
  nextPipeline = 'sprint' // downgrade from multi-sprint
}
```

## Unified Session Directory

```
.workflow/.team/IDS-{slug}-{YYYY-MM-DD}/
├── team-session.json
├── shared-memory.json          # Sprint间学习: what_worked / what_failed / patterns_learned
├── task-ledger.json            # 实时任务进度账本
├── design/                     # Architect output
│   ├── design-001.md
│   └── task-breakdown.json
├── code/                       # Developer tracking
│   └── dev-log.md
├── verify/                     # Tester output
│   └── verify-001.json
└── review/                     # Reviewer output
    └── review-001.md
```

## Coordinator Spawn Template

```javascript
TeamCreate({ team_name: teamName })

// Architect
Task({
  subagent_type: "general-purpose",
  team_name: teamName,
  name: "architect",
  prompt: `你是 team "${teamName}" 的 ARCHITECT。
当你收到 DESIGN-* 任务时，调用 Skill(skill="team-iterdev", args="--role=architect") 执行。
当前需求: ${taskDescription}
约束: ${constraints}

## 角色准则（强制）
- 你只能处理 DESIGN-* 前缀的任务
- 所有输出必须带 [architect] 标识前缀
- 仅与 coordinator 通信

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录。

工作流程:
1. TaskList → 找到 DESIGN-* 任务
2. Skill(skill="team-iterdev", args="--role=architect") 执行
3. team_msg log + SendMessage
4. TaskUpdate completed → 检查下一个任务`
})

// Developer
Task({
  subagent_type: "general-purpose",
  team_name: teamName,
  name: "developer",
  prompt: `你是 team "${teamName}" 的 DEVELOPER。
当你收到 DEV-* 任务时，调用 Skill(skill="team-iterdev", args="--role=developer") 执行。
当前需求: ${taskDescription}

## 角色准则（强制）
- 你只能处理 DEV-* 前缀的任务
- 所有输出必须带 [developer] 标识前缀

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录。

工作流程:
1. TaskList → 找到 DEV-* 任务
2. Skill(skill="team-iterdev", args="--role=developer") 执行
3. team_msg log + SendMessage
4. TaskUpdate completed → 检查下一个任务`
})

// Tester
Task({
  subagent_type: "general-purpose",
  team_name: teamName,
  name: "tester",
  prompt: `你是 team "${teamName}" 的 TESTER。
当你收到 VERIFY-* 任务时，调用 Skill(skill="team-iterdev", args="--role=tester") 执行。
当前需求: ${taskDescription}

## 角色准则（强制）
- 你只能处理 VERIFY-* 前缀的任务
- 所有输出必须带 [tester] 标识前缀

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录。

工作流程:
1. TaskList → 找到 VERIFY-* 任务
2. Skill(skill="team-iterdev", args="--role=tester") 执行
3. team_msg log + SendMessage
4. TaskUpdate completed → 检查下一个任务`
})

// Reviewer
Task({
  subagent_type: "general-purpose",
  team_name: teamName,
  name: "reviewer",
  prompt: `你是 team "${teamName}" 的 REVIEWER。
当你收到 REVIEW-* 任务时，调用 Skill(skill="team-iterdev", args="--role=reviewer") 执行。
当前需求: ${taskDescription}

## 角色准则（强制）
- 你只能处理 REVIEW-* 前缀的任务
- 所有输出必须带 [reviewer] 标识前缀

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录。

工作流程:
1. TaskList → 找到 REVIEW-* 任务
2. Skill(skill="team-iterdev", args="--role=reviewer") 执行
3. team_msg log + SendMessage
4. TaskUpdate completed → 检查下一个任务`
})
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Unknown --role value | Error with available role list |
| Missing --role arg | Error with usage hint |
| Role file not found | Error with expected path |
| GC loop exceeds 3 rounds | Accept with warning, record in shared memory |
| Sprint velocity drops below 50% | Coordinator alerts user, suggests scope reduction |
| Task ledger corrupted | Rebuild from TaskList state |
| **Phase 1 新增** | |
| Conflict detected | Update conflict_info, notify coordinator, create DEV-fix task |
| Resource lock timeout | Force release after 5min, notify holder and coordinator |
| Rollback requested | Validate snapshot_id, execute rollback_procedure, notify all |
| Deadlock detected | Abort youngest task, release its locks, notify coordinator |

## Phase 1: 冲突处理机制

### Conflict Detection (Coordinator)

```javascript
// 在 DEV 任务完成时检测冲突
function detectConflicts(sessionFolder, taskId, changedFiles) {
  const ledger = JSON.parse(Read(`${sessionFolder}/task-ledger.json`))
  const otherTasks = ledger.tasks.filter(t => t.id !== taskId && ['in_progress', 'completed'].includes(t.status))

  const conflicts = []
  for (const task of otherTasks) {
    // 检查文件重叠
    const taskFiles = task.changed_files || []
    const overlapping = changedFiles.filter(f => taskFiles.includes(f))
    if (overlapping.length > 0) {
      conflicts.push({ taskId: task.id, files: overlapping })
    }
  }

  if (conflicts.length > 0) {
    // 更新冲突信息
    const currentTask = ledger.tasks.find(t => t.id === taskId)
    currentTask.conflict_info = {
      status: "detected",
      conflicting_files: conflicts.flatMap(c => c.files),
      resolution_strategy: "manual",
      resolved_by_task_id: null
    }
    Write(`${sessionFolder}/task-ledger.json`, JSON.stringify(ledger, null, 2))

    // 发送冲突消息
    mcp__ccw-tools__team_msg({
      operation: "log", team: teamName, from: "coordinator", to: "all",
      type: "conflict_detected",
      summary: `[coordinator] Conflict detected: ${taskId} conflicts with ${conflicts.map(c => c.taskId).join(', ')}`,
      ref: taskId
    })
  }

  return conflicts
}
```

### Conflict Resolution (Coordinator)

```javascript
function resolveConflict(sessionFolder, taskId, strategy = "manual") {
  const ledger = JSON.parse(Read(`${sessionFolder}/task-ledger.json`))
  const task = ledger.tasks.find(t => t.id === taskId)

  if (task?.conflict_info?.status === "detected") {
    task.conflict_info.status = "resolved"
    task.conflict_info.resolution_strategy = strategy

    // 创建解决冲突的任务
    const fixTaskId = `${taskId}-fix-conflict`
    ledger.tasks.push({
      id: fixTaskId,
      title: `Resolve conflict for ${taskId}`,
      owner: "developer",
      status: "pending",
      started_at: null,
      completed_at: null,
      gc_rounds: 0,
      conflict_info: { ...task.conflict_info, resolved_by_task_id: fixTaskId }
    })

    Write(`${sessionFolder}/task-ledger.json`, JSON.stringify(ledger, null, 2))

    mcp__ccw-tools__team_msg({
      operation: "log", team: teamName, from: "coordinator", to: "developer",
      type: "conflict_resolved",
      summary: `[coordinator] Conflict resolution task created: ${fixTaskId}`,
      ref: fixTaskId
    })
  }
}
```

## Phase 1: 回滚策略

### Rollback Point Management (Coordinator)

```javascript
// 任务成功完成后记录回滚点
function createRollbackPoint(sessionFolder, taskId, stateData) {
  const ledger = JSON.parse(Read(`${sessionFolder}/task-ledger.json`))
  const task = ledger.tasks.find(t => t.id === taskId)

  if (task) {
    const snapshotId = `snapshot-${taskId}-${Date.now()}`
    task.rollback_info = {
      snapshot_id: snapshotId,
      rollback_procedure: stateData.procedure || "git revert HEAD",
      last_successful_state_id: snapshotId
    }
    Write(`${sessionFolder}/task-ledger.json`, JSON.stringify(ledger, null, 2))
  }
}

// 执行回滚
function executeRollback(sessionFolder, taskId, reason) {
  const ledger = JSON.parse(Read(`${sessionFolder}/task-ledger.json`))
  const task = ledger.tasks.find(t => t.id === taskId)

  if (task?.rollback_info?.snapshot_id) {
    mcp__ccw-tools__team_msg({
      operation: "log", team: teamName, from: "coordinator", to: "all",
      type: "rollback_initiated",
      summary: `[coordinator] Rollback initiated for ${taskId}: ${reason}`,
      ref: task.rollback_info.snapshot_id
    })

    try {
      // 执行回滚操作
      Bash(task.rollback_info.rollback_procedure)

      mcp__ccw-tools__team_msg({
        operation: "log", team: teamName, from: "coordinator", to: "all",
        type: "rollback_completed",
        summary: `[coordinator] Rollback completed for ${taskId}`,
        ref: task.rollback_info.snapshot_id
      })
    } catch (error) {
      mcp__ccw-tools__team_msg({
        operation: "log", team: teamName, from: "coordinator", to: "all",
        type: "rollback_failed",
        summary: `[coordinator] Rollback failed for ${taskId}: ${error.message}`,
        ref: task.rollback_info.snapshot_id
      })
    }
  }
}
```

## Phase 2: 外部依赖管理

### Dependency Validation (Coordinator)

```javascript
// 任务启动前验证依赖
function validateDependencies(sessionFolder, taskId, dependencies) {
  const ledger = JSON.parse(Read(`${sessionFolder}/task-ledger.json`))
  const task = ledger.tasks.find(t => t.id === taskId)

  if (!task) return { valid: false, reason: 'Task not found' }

  task.external_dependencies = dependencies.map(dep => ({
    name: dep.name,
    version_range: dep.version_range,
    actual_version: null,
    source: dep.source || 'unknown',
    status: 'pending'
  }))

  const mismatches = []

  for (const dep of task.external_dependencies) {
    // 获取实际版本（示例：npm list, pip show）
    const actualVersion = getInstalledVersion(dep.name, dep.source)
    dep.actual_version = actualVersion

    if (!actualVersion) {
      dep.status = 'missing'
      mismatches.push({ name: dep.name, reason: 'Not installed' })
    } else if (!satisfiesVersion(actualVersion, dep.version_range)) {
      dep.status = 'mismatch'
      mismatches.push({ name: dep.name, reason: `Expected ${dep.version_range}, got ${actualVersion}` })
    } else {
      dep.status = 'ok'
    }
  }

  Write(`${sessionFolder}/task-ledger.json`, JSON.stringify(ledger, null, 2))

  if (mismatches.length > 0) {
    mcp__ccw-tools__team_msg({
      operation: "log", team: teamName, from: "coordinator", to: "all",
      type: "dependency_mismatch",
      summary: `[coordinator] Dependency mismatch for ${taskId}: ${mismatches.map(m => m.name).join(', ')}`,
      ref: taskId
    })
  }

  return { valid: mismatches.length === 0, mismatches }
}
```

## Phase 2: 状态恢复

### Checkpoint Management (Coordinator)

```javascript
// 保存任务检查点
function saveCheckpoint(sessionFolder, taskId, stateData) {
  const memory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`))

  if (!memory.task_checkpoints) {
    memory.task_checkpoints = {}
  }

  if (!memory.task_checkpoints[taskId]) {
    memory.task_checkpoints[taskId] = []
  }

  const checkpoint = {
    timestamp: new Date().toISOString(),
    state_data_pointer: stateData.pointer || `${sessionFolder}/checkpoints/${taskId}-${Date.now()}.json`
  }

  memory.task_checkpoints[taskId].unshift(checkpoint)

  // 保留最近 5 个检查点
  if (memory.task_checkpoints[taskId].length > 5) {
    memory.task_checkpoints[taskId] = memory.task_checkpoints[taskId].slice(0, 5)
  }

  Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(memory, null, 2))

  // 保存状态数据
  if (stateData.data) {
    Write(checkpoint.state_data_pointer, JSON.stringify(stateData.data, null, 2))
  }

  mcp__ccw-tools__team_msg({
    operation: "log", team: teamName, from: "coordinator", to: "all",
    type: "context_checkpoint_saved",
    summary: `[coordinator] Checkpoint saved for ${taskId}`,
    ref: checkpoint.state_data_pointer
  })

  return checkpoint
}

// 从检查点恢复
function restoreFromCheckpoint(sessionFolder, taskId) {
  const memory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`))

  if (!memory.task_checkpoints?.[taskId]?.length) {
    return { success: false, reason: 'No checkpoints available' }
  }

  const latestCheckpoint = memory.task_checkpoints[taskId][0]

  try {
    const stateData = JSON.parse(Read(latestCheckpoint.state_data_pointer))

    mcp__ccw-tools__team_msg({
      operation: "log", team: teamName, from: "coordinator", to: "all",
      type: "context_restored",
      summary: `[coordinator] Context restored for ${taskId} from ${latestCheckpoint.timestamp}`,
      ref: latestCheckpoint.state_data_pointer
    })

    return { success: true, stateData, checkpoint: latestCheckpoint }
  } catch (error) {
    return { success: false, reason: error.message }
  }
}
```

## Phase 3: 用户反馈循环

### Feedback Collection (Coordinator)

```javascript
// 接收并记录用户反馈
function receiveUserFeedback(sessionFolder, feedback) {
  const memory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`))

  if (!memory.user_feedback_items) {
    memory.user_feedback_items = []
  }

  const feedbackItem = {
    feedback_id: `FB-${Date.now().toString(36)}`,
    source_task_id: feedback.source_task_id || null,
    description: feedback.description,
    severity: feedback.severity || 'medium',  // low | medium | high | critical
    status: 'new',                            // new | reviewed | addressed | closed
    timestamp: new Date().toISOString(),
    category: feedback.category || 'general'  // general | ux | performance | bug | feature
  }

  memory.user_feedback_items.unshift(feedbackItem)

  // 保留最近 50 条反馈
  if (memory.user_feedback_items.length > 50) {
    memory.user_feedback_items = memory.user_feedback_items.slice(0, 50)
  }

  Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(memory, null, 2))

  mcp__ccw-tools__team_msg({
    operation: "log", team: teamName, from: "coordinator", to: "all",
    type: "user_feedback_received",
    summary: `[coordinator] User feedback received: ${feedbackItem.severity} - ${feedbackItem.description.substring(0, 50)}`,
    ref: feedbackItem.feedback_id
  })

  return feedbackItem
}

// 关联反馈到任务
function linkFeedbackToTask(sessionFolder, feedbackId, taskId) {
  const memory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`))
  const feedback = memory.user_feedback_items?.find(f => f.feedback_id === feedbackId)

  if (feedback) {
    feedback.source_task_id = taskId
    feedback.status = 'reviewed'
    Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(memory, null, 2))
  }
}
```

## Phase 3: 技术债务追踪

### Tech Debt Management (Coordinator)

```javascript
// 记录技术债务
function identifyTechDebt(sessionFolder, debt) {
  const memory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`))

  if (!memory.tech_debt_items) {
    memory.tech_debt_items = []
  }

  const debtItem = {
    debt_id: `TD-${Date.now().toString(36)}`,
    category: debt.category || 'code',           // code | design | test | documentation
    source_task_id: debt.source_task_id || null,
    description: debt.description,
    severity: debt.severity || 'medium',         // low | medium | high | critical
    detection_date: new Date().toISOString(),
    owner: debt.owner || null,                   // 角色或具体负责人
    resolution_plan: debt.resolution_plan || null,
    estimated_effort: debt.estimated_effort || null,  // small | medium | large
    priority: debt.priority || 'medium',         // low | medium | high
    status: 'open',                              // open | in_progress | resolved | deferred
    related_files: debt.related_files || []
  }

  memory.tech_debt_items.unshift(debtItem)

  Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(memory, null, 2))

  mcp__ccw-tools__team_msg({
    operation: "log", team: teamName, from: "coordinator", to: "all",
    type: "tech_debt_identified",
    summary: `[coordinator] Tech debt identified: ${debtItem.category} - ${debtItem.description.substring(0, 50)}`,
    ref: debtItem.debt_id
  })

  return debtItem
}

// 生成技术债务报告
function generateTechDebtReport(sessionFolder) {
  const memory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`))
  const debts = memory.tech_debt_items || []

  const report = {
    total: debts.length,
    by_severity: {
      critical: debts.filter(d => d.severity === 'critical').length,
      high: debts.filter(d => d.severity === 'high').length,
      medium: debts.filter(d => d.severity === 'medium').length,
      low: debts.filter(d => d.severity === 'low').length
    },
    by_category: {
      code: debts.filter(d => d.category === 'code').length,
      design: debts.filter(d => d.category === 'design').length,
      test: debts.filter(d => d.category === 'test').length,
      documentation: debts.filter(d => d.category === 'documentation').length
    },
    open_items: debts.filter(d => d.status === 'open'),
    in_progress_items: debts.filter(d => d.status === 'in_progress')
  }

  return report
}
```
