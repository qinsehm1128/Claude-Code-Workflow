# Codex Skills 总览

## 一句话定位

**Codex Skills 是 Codex 模型的专用技能系统** — 通过生命周期类、工作流类和专项类技能，实现多代理并行开发和协作分析。

## vs Claude Skills 对比

| 维度 | Claude Skills | Codex Skills |
|------|--------------|-------------|
| **模型** | Claude 模型 | Codex 模型 |
| **架构** | team-worker agent 架构 | spawn-wait-close 代理模式 |
| **子代理** | discuss/explore 子代理（内联调用） | discuss/explore 子代理（独立调用） |
| **协调器** | 内置协调器 + 动态角色 | 主流程内联编排 |
| **状态管理** | team-session.json | state 文件 |
| **缓存** | explorations/cache-index.json | shared discoveries.ndjson |

## Skills 类别

| 类别 | 文档 | 说明 |
|------|------|------|
| **生命周期** | [lifecycle.md](./codex-lifecycle.md) | 全生命周期编排 |
| **工作流** | [workflow.md](./codex-workflow.md) | 并行开发和协作工作流 |
| **专项** | [specialized.md](./codex-specialized.md) | 专项技能 |

## 核心概念速览

| 概念 | 说明 | 位置/命令 |
| --- | --- | --- |
| **team-lifecycle** | 全生命周期编排器 | `/team-lifecycle` |
| **parallel-dev-cycle** | 并行开发循环 | `/parallel-dev-cycle` |
| **analyze-with-file** | 协作分析 | `/analyze-with-file` |
| **brainstorm-with-file** | 头脑风暴 | `/brainstorm-with-file` |
| **debug-with-file** | 假设驱动调试 | `/debug-with-file` |

## 生命周期 Skills

### team-lifecycle

**一句话定位**: 全生命周期编排器 — 规范/实现/测试的 spawn-wait-close 流水线

**触发**:
```shell
/team-lifecycle <task-description>
```

**功能**:
- 5 阶段流水线：需求澄清 → 会话初始化 → 任务链创建 → 流水线协调 → 完成报告
- **Inline discuss**: 生产角色（analyst, writer, reviewer）内联调用 discuss 子代理，将规范流水线从 12 拍减少到 6 拍
- **Shared explore cache**: 所有代理共享集中式 `explorations/` 目录，消除重复代码库探索
- **Fast-advance spawning**: 代理完成后立即派生下一个线性后继者
- **Consensus severity routing**: 讨论结果通过 HIGH/MEDIUM/LOW 严重程度路由

**代理注册表**:
| 代理 | 角色 | 模式 |
|------|------|------|
| analyst | 种子分析、上下文收集、DISCUSS-001 | 2.8 Inline Subagent |
| writer | 文档生成、DISCUSS-002 到 DISCUSS-005 | 2.8 Inline Subagent |
| planner | 多角度探索、计划生成 | 2.9 Cached Exploration |
| executor | 代码实现 | 2.1 Standard |
| tester | 测试修复循环 | 2.3 Deep Interaction |
| reviewer | 代码审查 + 规范质量、DISCUSS-006 | 2.8 Inline Subagent |
| architect | 架构咨询（按需） | 2.1 Standard |
| fe-developer | 前端实现 | 2.1 Standard |
| fe-qa | 前端 QA、GC 循环 | 2.3 Deep Interaction |

**流水线定义**:
```plaintext
Spec-only (6 beats):
  RESEARCH-001(+D1) → DRAFT-001(+D2) → DRAFT-002(+D3) → DRAFT-003(+D4) → DRAFT-004(+D5) → QUALITY-001(+D6)

Impl-only (3 beats):
  PLAN-001 → IMPL-001 → TEST-001 || REVIEW-001

Full-lifecycle (9 beats):
  [Spec pipeline] → PLAN-001 → IMPL-001 → TEST-001 || REVIEW-001
```

**Beat Cycle**:
```plaintext
event (phase advance / user resume)
      ↓
  [Orchestrator]
      +-- read state file
      +-- find ready tasks
      +-- spawn agent(s)
      +-- wait(agent_ids, timeout)
      +-- process results
      +-- update state file
      +-- close completed agents
      +-- fast-advance: spawn next
      +-- yield (wait for next event)
```

**会话目录**:
```plaintext
.workflow/.team/TLS-<slug>-<date>/
├── team-session.json           # 流水线状态
├── spec/                       # 规范产物
├── discussions/                # 讨论记录
├── explorations/               # 共享探索缓存
├── architecture/               # 架构评估
├── analysis/                   # 分析师设计情报
├── qa/                         # QA 审计报告
└── wisdom/                     # 跨任务知识积累
```

---

### parallel-dev-cycle

**一句话定位**: 多代理并行开发循环 — 需求分析、探索规划、代码开发、验证

**触发**:
```shell
/parallel-dev-cycle TASK="Implement feature"
/parallel-dev-cycle --cycle-id=cycle-v1-20260122-abc123
/parallel-dev-cycle --auto TASK="Add OAuth"
```

**功能**:
- 4 个专业工作者：RA（需求）、EP（探索）、CD（开发）、VAS（验证）
- 主流程内联编排（无单独编排器代理）
- 每个代理维护一个主文档（每次迭代完全重写）+ 辅助日志（追加）
- 自动归档旧版本到 `history/` 目录

**工作者**:
| 工作者 | 主文档 | 辅助日志 |
|--------|--------|----------|
| RA | requirements.md | changes.log |
| EP | exploration.md, architecture.md, plan.json | changes.log |
| CD | implementation.md, issues.md | changes.log, debug-log.ndjson |
| VAS | summary.md, test-results.json | changes.log |

**共享发现板**:
- 所有代理共享实时发现板 `coordination/discoveries.ndjson`
- 代理在开始时读取，工作时追加发现
- 消除冗余代码库探索

**会话结构**:
```plaintext
{projectRoot}/.workflow/.cycle/
├── {cycleId}.json                     # 主状态文件
├── {cycleId}.progress/
│   ├── ra/                         # RA 代理产物
│   │   ├── requirements.md        # 当前版本（完全重写）
│   │   ├── changes.log           # NDJSON 完整历史（追加）
│   │   └── history/              # 归档快照
│   ├── ep/                         # EP 代理产物
│   ├── cd/                         # CD 代理产物
│   ├── vas/                        # VAS 代理产物
│   └── coordination/               # 协调数据
│       ├── discoveries.ndjson      # 共享发现板
│       ├── timeline.md             # 执行时间线
│       └── decisions.log            # 决策日志
```

**执行流程**:
```plaintext
Phase 1: 会话初始化
    ↓ cycleId, state, progressDir

Phase 2: 代理执行（并行）
    ├─ 派生 RA → EP → CD → VAS
    └─ 等待所有代理完成

Phase 3: 结果聚合 & 迭代
    ├─ 解析 PHASE_RESULT
    ├─ 检测问题（测试失败、阻塞）
    ├─ 有问题 AND 迭代 < 最大值？
    │   ├─ 是 → 发送反馈，循环回 Phase 2
    │   └─ 否 → 进入 Phase 4
    └─ 输出: parsedResults, iteration status

Phase 4: 完成和摘要
    ├─ 生成统一摘要报告
    ├─ 更新最终状态
    ├─ 关闭所有代理
    └─ 输出: 最终循环报告
```

**版本控制**:
- 1.0.0: 初始循环 → 1.x.0: 每次迭代（次要版本递增）
- 每次迭代: 归档旧版本 → 完全重写 → 追加 changes.log

## 工作流 Skills

### analyze-with-file

**一句话定位**: 协作分析 — 文档化讨论、内联探索、理解演进的交互式分析

**触发**:
```shell
/analyze-with-file TOPIC="<question>"
/analyze-with-file TOPIC="--depth=deep"
```

**核心工作流**:
```plaintext
Topic → Explore → Discuss → Document → Refine → Conclude → (Optional) Quick Execute
```

**关键特性**:
- **文档化讨论时间线**: 捕获跨所有阶段的理解演进
- **每个关键点决策记录**: 强制记录关键发现、方向变更、权衡
- **多视角分析**: 支持最多 4 个分析视角（串行、内联）
- **交互式讨论**: 多轮 Q&A，用户反馈和方向调整
- **Quick execute**: 将结论直接转换为可执行任务

**决策记录协议**:
| 触发 | 记录内容 | 目标部分 |
|------|----------|----------|
| 方向选择 | 选择内容、原因、替代方案 | `#### Decision Log` |
| 关键发现 | 发现内容、影响范围、置信度 | `#### Key Findings` |
| 假设变更 | 旧假设 → 新理解、原因、影响 | `#### Corrected Assumptions` |
| 用户反馈 | 用户原始输入、采用/调整原因 | `#### User Input` |

---

### brainstorm-with-file

**一句话定位**: 多视角头脑风暴 — 4 视角（Product、Technical、Risk、User）并行分析

**触发**:
```shell
/brainstorm-with-file TOPIC="<idea>"
```

**功能**:
- 4 视角并行分析：Product、Technical、Risk、User
- 一致性评分和收敛判定
- 可行性建议和行动项

**视角**:
| 视角 | 关注领域 |
|------|----------|
| **Product** | 市场契合度、用户价值、业务可行性 |
| **Technical** | 可行性、技术债务、性能、安全 |
| **Risk** | 风险识别、依赖、失败模式 |
| **User** | 可用性、用户体验、采用障碍 |

---

### debug-with-file

**一句话定位**: 假设驱动调试 — 文档化探索、理解演进、分析辅助修正

**触发**:
```shell
/debug-with-file BUG="<bug description>"
```

**核心工作流**:
```plaintext
Explore → Document → Log → Analyze → Correct Understanding → Fix → Verify
```

**关键增强**:
- **understanding.md**: 探索和学习的时间线
- **分析辅助修正**: 验证和修正假设
- **整合**: 简化已证明错误的理解，避免混乱
- **学习保留**: 保留从失败尝试中学到的内容

**会话文件夹结构**:
```plaintext
{projectRoot}/.workflow/.debug/DBG-{slug}-{date}/
├── debug.log           # NDJSON 日志（执行证据）
├── understanding.md    # 探索时间线 + 整合理解
└── hypotheses.json     # 假设历史（带判定）
```

**模式**:
| 模式 | 触发条件 |
|------|----------|
| **Explore** | 无会话或无 understanding.md |
| **Continue** | 会话存在但无 debug.log 内容 |
| **Analyze** | debug.log 有内容 |

---

### collaborative-plan-with-file

**一句话定位**: 协作规划 — 多代理协作规划（替代 team-planex）

**触发**:
```shell
/collaborative-plan-with-file <task>
```

**功能**:
- 多代理协作规划
- planner 和 executor 并行工作
- 中间产物文件传递 solution

---

### unified-execute-with-file

**一句话定位**: 通用执行引擎 — 替代 workflow-execute

**触发**:
```shell
/unified-execute-with-file <session>
```

**功能**:
- 通用执行引擎
- 支持多种任务类型
- 自动会话恢复

---

### roadmap-with-file

**一句话定位**: 需求路线图规划

**触发**:
```shell
/roadmap-with-file <requirements>
```

**功能**:
- 需求到路线图的规划
- 优先级排序
- 里程碑定义

---

### review-cycle

**一句话定位**: 审查循环（Codex 版本）

**触发**:
```shell
/review-cycle <target>
```

**功能**:
- 代码审查
- 修复循环
- 验证修复效果

---

### workflow-test-fix-cycle

**一句话定位**: 测试修复工作流

**触发**:
```shell
/workflow-test-fix-cycle <failing-tests>
```

**功能**:
- 诊断测试失败原因
- 修复代码或测试
- 验证修复
- 循环直到通过

## 专项 Skills

### clean

**一句话定位**: 智能代码清理

**触发**:
```shell
/clean <target>
```

**功能**:
- 自动化代码清理
- 代码格式化
- 死代码移除

---

### csv-wave-pipeline

**一句话定位**: CSV 波处理管道

**触发**:
```shell
/csv-wave-pipeline <csv-file>
```

**功能**:
- CSV 数据处理
- 波次处理
- 数据转换和导出

---

### memory-compact

**一句话定位**: Memory 压缩（Codex 版本）

**触发**:
```shell
/memory-compact
```

**功能**:
- Memory 压缩和合并
- 清理冗余数据
- 优化存储

---

### ccw-cli-tools

**一句话定位**: CLI 工具执行规范

**触发**:
```shell
/ccw-cli-tools <command>
```

**功能**:
- CLI 工具标准化执行
- 参数规范
- 输出格式统一

---

### issue-discover

**一句话定位**: Issue 发现

**触发**:
```shell
/issue-discover <context>
```

**功能**:
- 从上下文发现 Issue
- Issue 分类
- 优先级评估

## 相关文档

- [Claude Skills](./claude-index.md)
- [功能文档](../features/spec)

## 最佳实践

1. **选择合适的团队类型**:
   - 完整生命周期 → `team-lifecycle`
   - 并行开发 → `parallel-dev-cycle`
   - 协作分析 → `analyze-with-file`

2. **利用 Inline Discuss**: 生产角色内联调用 discuss 子代理，减少编排开销

3. **共享缓存**: 利用共享探索缓存，避免重复代码库探索

4. **Fast-Advance**: 线性后继任务自动跳过编排器，提高效率

5. **Consensus Routing**: 理解不同严重程度的共识路由行为

## 使用示例

```bash
# 全生命周期开发
/team-lifecycle "Build user authentication API"

# 并行开发
/parallel-dev-cycle TASK="Implement notifications"

# 协作分析
/analyze-with-file TOPIC="How to optimize database queries?"

# 头脑风暴
/brainstorm-with-file TOPIC="Design payment system"

# 调试
/debug-with-file BUG="System crashes intermittently"

# 测试修复
/workflow-test-fix-cycle "Unit tests failing"
```

## 统计数据

| 类别 | 数量 |
|------|------|
| 生命周期 | 2 |
| 工作流 | 8 |
| 专项 | 6 |
| **总计** | **16+** |
