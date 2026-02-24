---
name: team-tech-debt
description: Unified team skill for tech debt identification and cleanup. All roles invoke this skill with --role arg for role-specific execution. Triggers on "team tech-debt", "tech debt cleanup", "技术债务".
allowed-tools: TeamCreate(*), TeamDelete(*), SendMessage(*), TaskCreate(*), TaskUpdate(*), TaskList(*), TaskGet(*), Task(*), AskUserQuestion(*), Read(*), Write(*), Edit(*), Bash(*), Glob(*), Grep(*)
---

# Team Tech Debt

技术债务识别与清理团队。融合"债务扫描"、"量化评估"、"治理规划"、"清理执行"、"验证回归"五大能力域，形成"扫描→评估→规划→清理→验证"闭环。通过 Scanner 多维度扫描、Executor-Validator 修复验证循环、共享债务清单数据库，实现渐进式技术债务治理。所有成员通过 `--role=xxx` 路由到角色执行逻辑。

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│  Skill(skill="team-tech-debt", args="--role=xxx")         │
└────────────────────────┬─────────────────────────────────┘
                         │ Role Router
    ┌────────┬───────────┼───────────┬──────────┬──────────┐
    ↓        ↓           ↓           ↓          ↓          ↓
┌────────┐┌────────┐┌──────────┐┌─────────┐┌────────┐┌─────────┐
│coordi- ││scanner ││assessor  ││planner  ││executor││validator│
│nator   ││TDSCAN-*││TDEVAL-*  ││TDPLAN-* ││TDFIX-* ││TDVAL-*  │
│ roles/ ││ roles/ ││ roles/   ││ roles/  ││ roles/ ││ roles/  │
└────────┘└────────┘└──────────┘└─────────┘└────────┘└─────────┘
```

## Command Architecture

```
roles/
├── coordinator/
│   ├── role.md              # Pipeline 编排（模式选择、任务分发、监控）
│   └── commands/
│       ├── dispatch.md      # 任务链创建
│       └── monitor.md       # 进度监控
├── scanner/
│   ├── role.md              # 多维度技术债务扫描
│   └── commands/
│       └── scan-debt.md     # 多维度 CLI Fan-out 扫描
├── assessor/
│   ├── role.md              # 量化评估与优先级排序
│   └── commands/
│       └── evaluate.md      # 影响/成本矩阵评估
├── planner/
│   ├── role.md              # 治理方案规划
│   └── commands/
│       └── create-plan.md   # 分阶段治理方案生成
├── executor/
│   ├── role.md              # 债务清理执行
│   └── commands/
│       └── remediate.md     # 重构/清理/更新执行
└── validator/
    ├── role.md              # 清理结果验证
    └── commands/
        └── verify.md        # 回归测试与质量验证
```

**设计原则**: role.md 保留 Phase 1（Task Discovery）和 Phase 5（Report）内联。Phase 2-4 根据复杂度决定内联或委派到 `commands/*.md`。

## Role Router

### Input Parsing

Parse `$ARGUMENTS` to extract `--role` and optional `--agent-name`:

```javascript
const args = "$ARGUMENTS"
const roleMatch = args.match(/--role[=\s]+(\w+)/)
const teamName = args.match(/--team[=\s]+([\w-]+)/)?.[1] || "tech-debt"

if (!roleMatch) {
  // No --role: Orchestration Mode → auto route to coordinator
  // See "Orchestration Mode" section below
}

const role = roleMatch ? roleMatch[1] : "coordinator"
const agentName = args.match(/--agent-name[=\s]+([\w-]+)/)?.[1] || role
```

### Role Dispatch

```javascript
const VALID_ROLES = {
  "coordinator": { file: "roles/coordinator/role.md", prefix: null },
  "scanner":     { file: "roles/scanner/role.md",     prefix: "TDSCAN" },
  "assessor":    { file: "roles/assessor/role.md",    prefix: "TDEVAL" },
  "planner":     { file: "roles/planner/role.md",     prefix: "TDPLAN" },
  "executor":    { file: "roles/executor/role.md",     prefix: "TDFIX" },
  "validator":   { file: "roles/validator/role.md",    prefix: "TDVAL" }
}

if (!VALID_ROLES[role]) {
  throw new Error(`Unknown role: ${role}. Available: ${Object.keys(VALID_ROLES).join(', ')}`)
}

// Read and execute role-specific logic
Read(VALID_ROLES[role].file)
// → Execute the 5-phase process defined in that file
```

### Orchestration Mode（无参数触发）

当不带 `--role` 调用时，自动进入 coordinator 编排模式。

**触发方式**:

```javascript
// 用户调用（无 --role）— 自动路由到 coordinator
Skill(skill="team-tech-debt", args="扫描并清理项目中的技术债务")

// 等价于
Skill(skill="team-tech-debt", args="--role=coordinator 扫描并清理项目中的技术债务")
```

**完整调用链**:

```
用户: Skill(args="任务描述")
  │
  ├─ SKILL.md: 无 --role → Orchestration Mode → 读取 coordinator role.md
  │
  ├─ coordinator Phase 2: TeamCreate + spawn workers
  │   每个 worker prompt 中包含 Skill(args="--role=xxx") 回调
  │
  ├─ coordinator Phase 3: dispatch 任务链
  │
  ├─ worker 收到任务 → Skill(args="--role=xxx") → SKILL.md Role Router → role.md
  │   每个 worker 自动获取:
  │   ├─ 角色定义 (role.md: identity, boundaries, message types)
  │   ├─ 可用命令 (commands/*.md)
  │   └─ 执行逻辑 (5-phase process)
  │
  └─ coordinator Phase 4-5: 监控 → 结果汇报
```

### Available Roles

| Role | Task Prefix | Responsibility | Role File |
|------|-------------|----------------|-----------|
| `coordinator` | N/A | Pipeline 编排、模式选择、质量门控 | [roles/coordinator/role.md](roles/coordinator/role.md) |
| `scanner` | TDSCAN-* | 多维度技术债务扫描 | [roles/scanner/role.md](roles/scanner/role.md) |
| `assessor` | TDEVAL-* | 量化评估与优先级排序 | [roles/assessor/role.md](roles/assessor/role.md) |
| `planner` | TDPLAN-* | 分阶段治理方案规划 | [roles/planner/role.md](roles/planner/role.md) |
| `executor` | TDFIX-* | 重构/清理/更新执行 | [roles/executor/role.md](roles/executor/role.md) |
| `validator` | TDVAL-* | 回归测试与质量验证 | [roles/validator/role.md](roles/validator/role.md) |

## Shared Infrastructure

> 以下为编排级概览。具体实现代码（Message Bus、Task Lifecycle、工具方法）在各 role.md 中自包含。

### Team Configuration

```javascript
const TEAM_CONFIG = {
  name: "tech-debt",
  sessionDir: ".workflow/.team/TD-{slug}-{date}/",
  sharedMemory: "shared-memory.json",
  debtDimensions: ["code", "architecture", "testing", "dependency", "documentation"],
  priorityMatrix: {
    highImpact_lowCost: "立即修复 (Quick Win)",
    highImpact_highCost: "战略规划 (Strategic)",
    lowImpact_lowCost: "待办处理 (Backlog)",
    lowImpact_highCost: "暂缓接受 (Defer)"
  }
}
```

### Role Isolation Rules

**核心原则**: 每个角色仅能执行自己职责范围内的工作。

#### Output Tagging（强制）

所有角色的输出必须带 `[role_name]` 标识前缀。

#### Coordinator 隔离

| 允许 | 禁止 |
|------|------|
| 需求澄清 (AskUserQuestion) | ❌ 直接扫描代码 |
| 创建任务链 (TaskCreate) | ❌ 直接执行重构或清理 |
| 模式选择 + 质量门控 | ❌ 直接评估或规划 |
| 监控进度 (消息总线) | ❌ 绕过 worker 自行完成 |

#### Worker 隔离

| 允许 | 禁止 |
|------|------|
| 处理自己前缀的任务 | ❌ 处理其他角色前缀的任务 |
| 读写 shared-memory.json (自己的字段) | ❌ 为其他角色创建任务 |
| SendMessage 给 coordinator | ❌ 直接与其他 worker 通信 |

## Three-Mode Pipeline Architecture

```
Scan Mode (仅扫描评估):
  TDSCAN-001(多维度扫描) → TDEVAL-001(量化评估) → 报告

Remediate Mode (完整闭环):
  TDSCAN-001(扫描) → TDEVAL-001(评估) → TDPLAN-001(规划) → TDFIX-001(修复) → TDVAL-001(验证)

Targeted Mode (定向修复):
  TDPLAN-001(规划) → TDFIX-001(修复) → TDVAL-001(验证)
```

### Mode Auto-Detection

```javascript
function detectMode(args, taskDescription) {
  if (/--mode[=\s]+(scan|remediate|targeted)/.test(args)) {
    return args.match(/--mode[=\s]+(\w+)/)[1]
  }
  if (/扫描|scan|审计|audit|评估|assess/.test(taskDescription)) return 'scan'
  if (/定向|targeted|指定|specific|修复.*已知/.test(taskDescription)) return 'targeted'
  return 'remediate'
}
```

### Fix-Verify Loop

```
TDFIX → TDVAL → (if regression or quality drop) → TDFIX-fix → TDVAL-2
                  (if all pass) → report
```

## Unified Session Directory

```
.workflow/.team/TD-{slug}-{YYYY-MM-DD}/
├── team-session.json
├── shared-memory.json          # 债务清单 / 评估矩阵 / 治理方案 / 修复结果 / 验证结果
├── scan/                       # Scanner output
│   └── debt-inventory.json
├── assessment/                 # Assessor output
│   └── priority-matrix.json
├── plan/                       # Planner output
│   └── remediation-plan.md
├── fixes/                      # Executor output
│   └── fix-log.json
└── validation/                 # Validator output
    └── validation-report.json
```

## Coordinator Spawn Template

> **注意**: 以下模板作为 worker prompt 参考。在 Stop-Wait 策略下，coordinator 不再在 Phase 2 预先 spawn 所有 worker。
> 而是在 Phase 4 (monitor) 中，按 pipeline 阶段逐个 spawn worker（同步阻塞 `Task(run_in_background: false)`），
> worker 返回即阶段完成。详见 `roles/coordinator/commands/monitor.md`。

```javascript
TeamCreate({ team_name: teamName })

// Worker 按需 spawn（monitor.md Phase 4 调用）
// 以下为各角色的 prompt 模板参考：
```

### Scanner Prompt Template
```javascript
Task({
  subagent_type: "general-purpose",
  prompt: `你是 team "${teamName}" 的 SCANNER。

## ⚠️ 首要指令（MUST）
你的所有工作必须通过调用 Skill 获取角色定义后执行，禁止自行发挥：
Skill(skill="team-tech-debt", args="--role=scanner")
此调用会加载你的角色定义（role.md）、可用命令（commands/*.md）和完整执行逻辑。

当前需求: ${taskDescription}
约束: ${constraints}

## 角色准则（强制）
- 你只能处理 TDSCAN-* 前缀的任务，不得执行其他角色的工作
- 所有输出（SendMessage、team_msg）必须带 [scanner] 标识前缀
- 仅与 coordinator 通信，不得直接联系其他 worker
- 不得使用 TaskCreate 为其他角色创建任务

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录。

## 工作流程（严格按顺序）
1. 调用 Skill(skill="team-tech-debt", args="--role=scanner") 获取角色定义和执行逻辑
2. 按 role.md 中的 5-Phase 流程执行（TaskList → 找到 TDSCAN-* 任务 → 执行 → 汇报）
3. team_msg log + SendMessage 结果给 coordinator（带 [scanner] 标识）
4. TaskUpdate completed → 检查下一个任务 → 回到步骤 1`,
  run_in_background: false  // 同步阻塞
})
```

### Assessor Prompt Template
```javascript
Task({
  subagent_type: "general-purpose",
  prompt: `你是 team "${teamName}" 的 ASSESSOR。

## ⚠️ 首要指令（MUST）
Skill(skill="team-tech-debt", args="--role=assessor")

当前需求: ${taskDescription}
约束: ${constraints}

## 角色准则（强制）
- 你只能处理 TDEVAL-* 前缀的任务
- 所有输出必须带 [assessor] 标识前缀
- 仅与 coordinator 通信

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录。

## 工作流程
1. Skill(skill="team-tech-debt", args="--role=assessor") 获取角色定义
2. TaskList → 找到 TDEVAL-* 任务 → 执行 → 汇报
3. team_msg log + SendMessage 结果给 coordinator
4. TaskUpdate completed`,
  run_in_background: false
})
```

### Planner Prompt Template
```javascript
Task({
  subagent_type: "general-purpose",
  prompt: `你是 team "${teamName}" 的 PLANNER。

## ⚠️ 首要指令（MUST）
Skill(skill="team-tech-debt", args="--role=planner")

当前需求: ${taskDescription}
约束: ${constraints}

## 角色准则（强制）
- 你只能处理 TDPLAN-* 前缀的任务
- 所有输出必须带 [planner] 标识前缀
- 仅与 coordinator 通信

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录。

## 工作流程
1. Skill(skill="team-tech-debt", args="--role=planner") 获取角色定义
2. TaskList → 找到 TDPLAN-* 任务 → 执行 → 汇报
3. team_msg log + SendMessage 结果给 coordinator
4. TaskUpdate completed`,
  run_in_background: false
})
```

### Executor Prompt Template
```javascript
Task({
  subagent_type: "general-purpose",
  prompt: `你是 team "${teamName}" 的 EXECUTOR。

## ⚠️ 首要指令（MUST）
Skill(skill="team-tech-debt", args="--role=executor")

当前需求: ${taskDescription}
约束: ${constraints}

## 角色准则（强制）
- 你只能处理 TDFIX-* 前缀的任务
- 所有输出必须带 [executor] 标识前缀
- 仅与 coordinator 通信

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录。

## 工作流程
1. Skill(skill="team-tech-debt", args="--role=executor") 获取角色定义
2. TaskList → 找到 TDFIX-* 任务 → 执行 → 汇报
3. team_msg log + SendMessage 结果给 coordinator
4. TaskUpdate completed`,
  run_in_background: false
})
```

### Validator Prompt Template
```javascript
Task({
  subagent_type: "general-purpose",
  prompt: `你是 team "${teamName}" 的 VALIDATOR。

## ⚠️ 首要指令（MUST）
Skill(skill="team-tech-debt", args="--role=validator")

当前需求: ${taskDescription}
约束: ${constraints}

## 角色准则（强制）
- 你只能处理 TDVAL-* 前缀的任务
- 所有输出必须带 [validator] 标识前缀
- 仅与 coordinator 通信

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录。

## 工作流程
1. Skill(skill="team-tech-debt", args="--role=validator") 获取角色定义
2. TaskList → 找到 TDVAL-* 任务 → 执行 → 汇报
3. team_msg log + SendMessage 结果给 coordinator
4. TaskUpdate completed`,
  run_in_background: false
})
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Unknown --role value | Error with available role list |
| Missing --role arg | Orchestration Mode → auto route to coordinator |
| Role file not found | Error with expected path (roles/{name}/role.md) |
| Command file not found | Fall back to inline execution in role.md |
| Task prefix conflict | Log warning, proceed |
| Scanner finds no debt | Report clean codebase, skip to summary |
| Fix introduces regression | Trigger Fix-Verify loop (max 3 iterations) |
| Validation repeatedly fails | Escalate to user with diagnosis |
