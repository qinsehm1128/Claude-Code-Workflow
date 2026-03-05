# Codex Skills - 生命周期类

## 一句话定位

**生命周期类 Codex Skills 是全生命周期编排系统** — 通过 team-lifecycle 和 parallel-dev-cycle 实现从规范到实现到测试到审查的完整开发流程自动化。

## vs 传统方法对比

| 维度 | 传统方式 | **Codex Skills** |
| --- | --- | --- |
| 流水线编排 | 手动任务管理 | 自动 spawn-wait-close 流水线 |
| 代理通信 | 直接通信 | 子代理内联调用 |
| 代码库探索 | 重复探索 | 共享缓存系统 |
| 协调开销 | 每步协调 | Fast-advance 线性跳过 |

## Skills 列表

| Skill | 功能 | 触发方式 |
| --- | --- | --- |
| `team-lifecycle` | 全生命周期编排器 | `/team-lifecycle <task>` |
| `parallel-dev-cycle` | 多代理并行开发循环 | `/parallel-dev-cycle TASK="..."` |

## Skills 详解

### team-lifecycle

**一句话定位**: 全生命周期编排器 — 规范/实现/测试的 spawn-wait-close 流水线

**架构概览**:
```
+-------------------------------------------------------------+
|  Team Lifecycle Orchestrator                                  |
|  Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5         |
|  Require    Init       Dispatch   Coordinate   Report         |
+----------+------------------------------------------------+--+
           |
     +-----+------+----------+-----------+-----------+
     v            v          v           v           v
+---------+ +---------+ +---------+ +---------+ +---------+
| Phase 1 | | Phase 2 | | Phase 3 | | Phase 4 | | Phase 5 |
| Require | | Init    | | Dispatch| | Coord   | | Report  |
+---------+ +---------+ +---------+ +---------+ +---------+
     |            |          |          |||          |
  params       session     tasks     agents      summary
                                    /  |  \
                              spawn  wait  close
                              /        |        \
                       +------+   +-------+   +--------+
                       |agent1|   |agent2 |   |agent N |
                       +------+   +-------+   +--------+
                          |           |            |
                     (may call discuss/explore subagents internally)
```

**关键设计原则**:

1. **Inline discuss subagent**: 生产角色（analyst, writer, reviewer）内联调用 discuss 子代理，将规范流水线从 12 拍减少到 6 拍
2. **Shared explore cache**: 所有代理共享集中式 `explorations/` 目录，消除重复代码库探索
3. **Fast-advance spawning**: 代理完成后立即派生下一个线性后继者
4. **Consensus severity routing**: 讨论结果通过 HIGH/MEDIUM/LOW 严重程度路由
5. **Beat model**: 每个流水线步骤是一拍 — 派生代理、等待结果、处理输出、派生下一个

**代理注册表**:
| 代理 | 角色文件 | 职责 | 模式 |
|------|----------|------|------|
| analyst | ~/.codex/agents/analyst.md | 种子分析、上下文收集、DISCUSS-001 | 2.8 Inline Subagent |
| writer | ~/.codex/agents/writer.md | 文档生成、DISCUSS-002 到 DISCUSS-005 | 2.8 Inline Subagent |
| planner | ~/.codex/agents/planner.md | 多角度探索、计划生成 | 2.9 Cached Exploration |
| executor | ~/.codex/agents/executor.md | 代码实现 | 2.1 Standard |
| tester | ~/.codex/agents/tester.md | 测试修复循环 | 2.3 Deep Interaction |
| reviewer | ~/.codex/agents/reviewer.md | 代码审查 + 规范质量、DISCUSS-006 | 2.8 Inline Subagent |
| architect | ~/.codex/agents/architect.md | 架构咨询（按需） | 2.1 Standard |
| fe-developer | ~/.codex/agents/fe-developer.md | 前端实现 | 2.1 Standard |
| fe-qa | ~/.codex/agents/fe-qa.md | 前端 QA、GC 循环 | 2.3 Deep Interaction |

**子代理注册表**:
| 子代理 | 代理文件 | 可调用者 | 用途 |
|--------|----------|----------|------|
| discuss | ~/.codex/agents/discuss-agent.md | analyst, writer, reviewer | 通过 CLI 工具进行多视角批判 |
| explore | ~/.codex/agents/explore-agent.md | analyst, planner, 任意代理 | 带共享缓存的代码库探索 |

**流水线定义**:
```
Spec-only (6 beats):
  RESEARCH-001(+D1) → DRAFT-001(+D2) → DRAFT-002(+D3) → DRAFT-003(+D4) → DRAFT-004(+D5) → QUALITY-001(+D6)

Impl-only (3 beats):
  PLAN-001 → IMPL-001 → TEST-001 || REVIEW-001

Full-lifecycle (9 beats):
  [Spec pipeline] → PLAN-001 → IMPL-001 → TEST-001 || REVIEW-001
```

**Beat Cycle**:
```
event (phase advance / user resume)
      ↓
  [Orchestrator]
      +-- read state file
      +-- find ready tasks
      +-- spawn agent(s)
      +-- wait(agent_ids, timeout)
      +-- process results (consensus routing, artifacts)
      +-- update state file
      +-- close completed agents
      +-- fast-advance: immediately spawn next if linear successor
      +-- yield (wait for next event or user command)
```

**Fast-Advance 决策表**:
| 条件 | 动作 |
|------|------|
| 1 个就绪任务、简单线性后继、无检查点 | 立即 `spawn_agent` 下一个任务（fast-advance） |
| 多个就绪任务（并行窗口） | 批量派生所有就绪任务，然后 `wait` 所有 |
| 无就绪任务、其他代理正在运行 | Yield，等待这些代理完成 |
| 无就绪任务、无运行中 | 流水线完成，进入 Phase 5 |
| 检查点任务完成（如 QUALITY-001） | 暂停，输出检查点消息，等待用户 |

**共识严重程度路由**:
| 判定 | 严重程度 | 编排器动作 |
|------|----------|-----------|
| consensus_reached | - | 正常进行，fast-advance 到下一个任务 |
| consensus_blocked | LOW | 带 notes 视为 reached，正常进行 |
| consensus_blocked | MEDIUM | 记录警告到 `wisdom/issues.md`，在下个任务上下文中包含分歧，继续 |
| consensus_blocked | HIGH | 创建修订任务 或暂停等待用户 |
| consensus_blocked | HIGH (DISCUSS-006) | 始终暂停等待用户决策（最终签署门） |

**修订任务创建** (HIGH 严重程度，非 DISCUSS-006):
```javascript
const revisionTask = {
  id: "<original-task-id>-R1",
  owner: "<same-agent-role>",
  blocked_by: [],
  description: "Revision of <original-task-id>: address consensus-blocked divergences.\n"
    + "Session: <session-dir>\n"
    + "Original artifact: <artifact-path>\n"
    + "Divergences: <divergence-details>\n"
    + "Action items: <action-items-from-discuss>\n"
    + "InlineDiscuss: <same-round-id>",
  status: "pending",
  is_revision: true
}
```

**会话目录结构**:
```
.workflow/.team/TLS-<slug>-<date>/
├── team-session.json           # 流水线状态（替换 TaskCreate/TaskList）
├── spec/                       # 规范产物
│   ├── spec-config.json
│   ├── discovery-context.json
│   ├── product-brief.md
│   ├── requirements/
│   ├── architecture/
│   ├── epics/
│   ├── readiness-report.md
│   └── spec-summary.md
├── discussions/                # 讨论记录（由 discuss 子代理写入）
├── plan/                       # 计划产物
│   ├── plan.json
│   └── tasks/                  # 详细任务规范
├── explorations/               # 共享探索缓存
│   ├── cache-index.json        # { angle -> file_path }
│   └── explore-<angle>.json
├── architecture/               # 架构师评估 + design-tokens.json
├── analysis/                   # 分析师 design-intelligence.json（UI 模式）
├── qa/                         # QA 审计报告
├── wisdom/                     # 跨任务知识积累
│   ├── learnings.md            # 模式和洞察
│   ├── decisions.md            # 架构和设计决策
│   ├── conventions.md          # 代码库约定
│   └── issues.md               # 已知风险和问题
└── shared-memory.json          # 跨代理状态
```

**状态文件模式** (team-session.json):
```json
{
  "session_id": "TLS-<slug>-<date>",
  "mode": "<spec-only | impl-only | full-lifecycle | fe-only | fullstack | full-lifecycle-fe>",
  "scope": "<project description>",
  "status": "<active | paused | completed>",
  "started_at": "<ISO8601>",
  "updated_at": "<ISO8601>",
  "tasks_total": 0,
  "tasks_completed": 0,
  "pipeline": [
    {
      "id": "RESEARCH-001",
      "owner": "analyst",
      "status": "pending | in_progress | completed | failed",
      "blocked_by": [],
      "description": "...",
      "inline_discuss": "DISCUSS-001",
      "agent_id": null,
      "artifact_path": null,
      "discuss_verdict": null,
      "discuss_severity": null,
      "started_at": null,
      "completed_at": null,
      "revision_of": null,
      "revision_count": 0
    }
  ],
  "active_agents": [],
  "completed_tasks": [],
  "revision_chains": {},
  "wisdom_entries": [],
  "checkpoints_hit": [],
  "gc_loop_count": 0
}
```

**用户命令**:
| 命令 | 动作 |
|------|------|
| `check` / `status` | 输出执行状态图（只读，无推进） |
| `resume` / `continue` | 检查代理状态，推进流水线 |
| 新会话请求 | Phase 0 检测，进入正常 Phase 1-5 流程 |

**状态图输出格式**:
```
[orchestrator] Pipeline Status
[orchestrator] Mode: <mode> | Progress: <completed>/<total> (<percent>%)

[orchestrator] Execution Graph:
  Spec Phase:
    [V RESEARCH-001(+D1)] -> [V DRAFT-001(+D2)] -> [>>> DRAFT-002(+D3)]
    -> [o DRAFT-003(+D4)] -> [o DRAFT-004(+D5)] -> [o QUALITY-001(+D6)]

  V=completed  >>>=running  o=pending  .=not created

[orchestrator] Active Agents:
  > <task-id> (<agent-role>) - running <elapsed>

[orchestrator] Commands: 'resume' to advance | 'check' to refresh
```

---

### parallel-dev-cycle

**一句话定位**: 多代理并行开发循环 — 需求分析、探索规划、代码开发、验证

**架构概览**:
```
┌─────────────────────────────────────────────────────────────┐
│                    User Input (Task)                        │
└────────────────────────────┬────────────────────────────────┘
                             │
                             v
              ┌──────────────────────────────┐
              │  Main Flow (Inline Orchestration)  │
              │  Phase 1 → 2 → 3 → 4              │
              └──────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        v                    v                    v
    ┌────────┐         ┌────────┐         ┌────────┐
    │  RA    │         │  EP    │         │  CD    │
    │Agent   │         │Agent   │         │Agent   │
    └────────┘         └────────┘         └────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                             v
                         ┌────────┐
                         │  VAS   │
                         │ Agent  │
                         └────────┘
                             │
                             v
              ┌──────────────────────────────┐
              │    Summary Report            │
              │  & Markdown Docs             │
              └──────────────────────────────┘
```

**关键设计原则**:

1. **主文档 + 辅助日志**: 每个代理维护一个主文档（每次迭代完全重写）和辅助日志（追加）
2. **基于版本的覆盖**: 主文档每次迭代完全重写；日志仅追加
3. **自动归档**: 旧主文档版本自动归档到 `history/` 目录
4. **完整审计跟踪**: Changes.log (NDJSON) 保留所有更改历史
5. **并行协调**: 四个代理同时启动；通过共享状态和内联主流程协调
6. **文件引用**: 使用短文件路径而非内容传递
7. **自我增强**: RA 代理基于上下文主动扩展需求
8. **共享发现板**: 所有代理通过 `discoveries.ndjson` 共享探索发现

**工作者**:
| 工作者 | 主文档（每次迭代重写） | 追加日志 |
|--------|------------------------|----------|
| **RA** | requirements.md | changes.log |
| **EP** | exploration.md, architecture.md, plan.json | changes.log |
| **CD** | implementation.md, issues.md | changes.log, debug-log.ndjson |
| **VAS** | summary.md, test-results.json | changes.log |

**共享发现板**:
- 所有代理共享实时发现板 `coordination/discoveries.ndjson`
- 代理在开始时读取，工作时追加发现
- 消除冗余代码库探索

**发现类型**:
| 类型 | 去重键 | 写入者 | 读取者 |
|------|--------|--------|--------|
| `tech_stack` | singleton | RA | EP, CD, VAS |
| `project_config` | `data.path` | RA | EP, CD |
| `existing_feature` | `data.name` | RA, EP | CD |
| `architecture` | singleton | EP | CD, VAS |
| `code_pattern` | `data.name` | EP, CD | CD, VAS |
| `integration_point` | `data.file` | EP | CD |
| `test_command` | singleton | CD, VAS | VAS, CD |
| `blocker` | `data.issue` | 任意 | 全部 |

**执行流程**:
```
Phase 1: 会话初始化
    ├─ 创建新循环 OR 恢复现有循环
    ├─ 初始化状态文件和目录结构
    └─ 输出: cycleId, state, progressDir

Phase 2: 代理执行（并行）
    ├─ 附加任务: 派生 RA → 派生 EP → 派生 CD → 派生 VAS → 等待所有
    ├─ 并行派生 RA, EP, CD, VAS 代理
    ├─ 等待所有代理完成（带超时处理）
    └─ 输出: agentOutputs (4 个代理结果)

Phase 3: 结果聚合 & 迭代
    ├─ 从每个代理解析 PHASE_RESULT
    ├─ 检测问题（测试失败、阻塞）
    ├─ 决策: 发现问题 AND 迭代 < 最大值？
    │   ├─ 是 → 通过 send_input 发送反馈，循环回 Phase 2
    │   └─ 否 → 进入 Phase 4
    └─ 输出: parsedResults, 迭代状态

Phase 4: 完成和摘要
    ├─ 生成统一摘要报告
    ├─ 更新最终状态
    ├─ 关闭所有代理
    └─ 输出: 最终循环报告和继续说明
```

**会话结构**:
```
{projectRoot}/.workflow/.cycle/
├── {cycleId}.json                     # 主状态文件
├── {cycleId}.progress/
│   ├── ra/                         # RA 代理产物
│   │   ├── requirements.md        # 当前版本（完全重写）
│   │   ├── changes.log           # NDJSON 完整历史（追加）
│   │   └── history/              # 归档快照
│   ├── ep/                         # EP 代理产物
│   │   ├── exploration.md        # 代码库探索报告
│   │   ├── architecture.md       # 架构设计
│   │   ├── plan.json             # 结构化任务列表（当前版本）
│   │   ├── changes.log           # NDJSON 完整历史
│   │   └── history/
│   ├── cd/                         # CD 代理产物
│   │   ├── implementation.md     # 当前版本
│   │   ├── debug-log.ndjson      # 调试假设跟踪
│   │   ├── changes.log           # NDJSON 完整历史
│   │   └── history/
│   ├── vas/                        # VAS 代理产物
│   │   ├── summary.md            # 当前版本
│   │   ├── changes.log           # NDJSON 完整历史
│   │   └── history/
│   └── coordination/               # 协调数据
│       ├── discoveries.ndjson      # 共享发现板（所有代理追加）
│       ├── timeline.md             # 执行时间线
│       └── decisions.log            # 决策日志
```

**版本控制**:
- 1.0.0: 初始循环 → 1.x.0: 每次迭代（次要版本递增）
- 每次迭代: 归档旧版本 → 完全重写 → 追加 changes.log

## 相关命令

- [Codex Skills - 工作流](./codex-workflow.md)
- [Codex Skills - 专项](./codex-specialized.md)
- [Claude Skills - 团队协作](./claude-collaboration.md)

## 最佳实践

1. **选择合适的团队类型**:
   - 完整功能开发 → `team-lifecycle`
   - 并行开发循环 → `parallel-dev-cycle`

2. **利用 Inline Discuss**: 生产角色内联调用 discuss 子代理，减少编排开销

3. **共享缓存**: 利用共享探索缓存，避免重复代码库探索

4. **Fast-Advance**: 线性后继任务自动跳过编排器，提高效率

5. **共识路由**: 理解不同严重程度的共识路由行为

## 使用示例

```bash
# 全生命周期开发
/team-lifecycle "Build user authentication API"

# 规范流水线
/team-lifecycle --mode=spec-only "Design payment system"

# 并行开发
/parallel-dev-cycle TASK="Implement notifications"

# 继续循环
/parallel-dev-cycle --cycle-id=cycle-v1-20260122-abc123

# 自动模式
/parallel-dev-cycle --auto TASK="Add OAuth"
```
