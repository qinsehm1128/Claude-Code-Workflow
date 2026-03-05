# Codex Skills - 工作流类

## 一句话定位

**工作流类 Codex Skills 是协作分析和并行开发工作流系统** — 通过文档化讨论、多视角分析和协作规划实现高效的团队协作。

## 解决的痛点

| 痛点 | 现状 | Codex Skills 方案 |
| --- | --- | --- |
| **讨论过程丢失** | 讨论结果只保存结论 | 文档化讨论时间线 |
| **探索重复** | 每次分析重复探索代码库 | 共享发现板 |
| **调试盲目** | 缺少假设验证机制 | 假设驱动调试 |
| **协作割裂** | 各角色独立工作 | 多视角并行分析 |

## Skills 列表

| Skill | 功能 | 触发方式 |
| --- | --- | --- |
| `analyze-with-file` | 协作分析（4 视角） | `/analyze-with-file TOPIC="..."` |
| `brainstorm-with-file` | 头脑风暴（4 视角） | `/brainstorm-with-file TOPIC="..."` |
| `debug-with-file` | 假设驱动调试 | `/debug-with-file BUG="..."` |
| `collaborative-plan-with-file` | 协作规划 | `/collaborative-plan-with-file <task>` |
| `unified-execute-with-file` | 通用执行引擎 | `/unified-execute-with-file <session>` |
| `roadmap-with-file` | 需求路线图 | `/roadmap-with-file <requirements>` |
| `review-cycle` | 审查循环 | `/review-cycle <target>` |
| `workflow-test-fix-cycle` | 测试修复工作流 | `/workflow-test-fix-cycle <tests>` |

## Skills 详解

### analyze-with-file

**一句话定位**: 协作分析 — 文档化讨论、内联探索、理解演进的交互式分析

**核心工作流**:
```
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
| **方向选择** | 选择内容、原因、替代方案 | `#### Decision Log` |
| **关键发现** | 发现内容、影响范围、置信度 | `#### Key Findings` |
| **假设变更** | 旧假设 → 新理解、原因、影响 | `#### Corrected Assumptions` |
| **用户反馈** | 用户原始输入、采用/调整原因 | `#### User Input` |

**分析视角** (串行、内联):
| 视角 | CLI 工具 | 角色 | 关注领域 |
|------|----------|------|----------|
| Product | gemini | 产品经理 | 市场契合度、用户价值、业务可行性 |
| Technical | codex | 技术主管 | 可行性、技术债务、性能、安全 |
| Quality | claude | QA 主管 | 完整性、可测试性、一致性 |
| Risk | gemini | 风险分析师 | 风险识别、依赖、失败模式 |

**会话文件夹结构**:
```
{projectRoot}/.workflow/.analyze/ANL-{slug}-{date}/
├── discussion.md               # 讨论时间线 + 理解演进
├── explorations/               # 代码库探索报告
│   ├── exploration-summary.md
│   ├── relevant-files.md
│   └── patterns.md
└── conclusion.md               # 最终结论 + Quick execute 任务
```

**执行流程**:
```
Phase 1: Topic Analysis
    ├─ 检测深度模式 (quick/standard/deep)
    ├─ 会话检测: {projectRoot}/.workflow/.analyze/ANL-{slug}-{date}/
    └─ 输出: sessionId, depth, continueMode

Phase 2: Exploration
    ├─ 检测上下文: discovery-context.json, prep-package.json
    ├─ 代码库探索: Glob + Read + Grep 工具
    ├─ 写入: explorations/exploration-summary.md
    └─ 输出: explorationResults

Phase 3: Discussion (Multiple Rounds)
    ├─ 初始化: discussion.md (Section: Exploration Summary)
    ├─ Round 1: 基于 explorationResults 生成初始分析
    ├─ 迭代: 用户反馈 → 修正理解 → 更新 discussion.md
    └─ 每轮更新: Decision Log, Key Findings, Current Understanding

Phase 4: Refinement
    ├─ 合并: explorations/ 内容合并到 discussion.md
    ├─ 检查: 所有关键点已记录
    └─ 输出: refinedDiscussion

Phase 5: Conclusion
    ├─ 生成: conclusion.md (Executive Summary, Findings, Recommendations)
    └─ Quick Execute (可选): 生成可执行任务

Phase 6: (可选) Quick Execute
    ├─ 转换结论为: 任务 JSON 或 plan file
    └─ 调用: workflow-execute 或直接执行
```

**深度模式**:
| 模式 | 探索范围 | 分析轮次 |
|------|----------|----------|
| quick | 基础搜索，10 文件 | 1 轮 |
| standard | 标准探索，30 文件 | 2-3 轮 |
| deep | 深度探索，100+ 文件 | 3-5 轮 |

---

### brainstorm-with-file

**一句话定位**: 多视角头脑风暴 — 4 视角（Product、Technical、Risk、User）并行分析

**关键特性**:
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

**输出格式**:
```
## 一致性判定
状态: <consensus_reached | consensus_blocked>
平均评分: <N>/5
收敛点: <list>
分歧点: <list>

## 可行性建议
推荐: <proceed | proceed-with-caution | revise | reject>
理由: <reasoning>
行动项: <action items>
```

---

### debug-with-file

**一句话定位**: 假设驱动调试 — 文档化探索、理解演进、分析辅助修正

**核心工作流**:
```
Explore → Document → Log → Analyze → Correct Understanding → Fix → Verify
```

**关键增强**:
- **understanding.md**: 探索和学习的时间线
- **分析辅助修正**: 验证和修正假设
- **整合**: 简化已证明错误的理解，避免混乱
- **学习保留**: 保留从失败尝试中学到的内容

**会话文件夹结构**:
```
{projectRoot}/.workflow/.debug/DBG-{slug}-{date}/
├── debug.log           # NDJSON 日志（执行证据）
├── understanding.md    # 探索时间线 + 整合理解
└── hypotheses.json     # 假设历史（带判定）
```

**模式**:
| 模式 | 触发条件 | 行为 |
|------|----------|------|
| **Explore** | 无会话或无 understanding.md | 定位错误源，记录初始理解，生成假设，添加日志 |
| **Continue** | 会话存在但无 debug.log 内容 | 等待用户复现 |
| **Analyze** | debug.log 有内容 | 解析日志，评估假设，更新理解 |

**假设生成**:
基于错误模式生成针对性假设：

| 错误模式 | 假设类型 |
|----------|----------|
| not found / missing / undefined | data_mismatch |
| 0 / empty / zero / registered | logic_error |
| timeout / connection / sync | integration_issue |
| type / format / parse | type_mismatch |

**NDJSON 日志格式**:
```json
{"sid":"DBG-xxx-2025-01-21","hid":"H1","loc":"file.py:func:42","msg":"Check dict keys","data":{"keys":["a","b"],"target":"c","found":false},"ts":1734567890123}
```

**Understanding Document 模板**:
```markdown
# Understanding Document

**Session ID**: DBG-xxx-2025-01-21
**Bug Description**: [original description]
**Started**: 2025-01-21T10:00:00+08:00

---

## Exploration Timeline

### Iteration 1 - Initial Exploration (2025-01-21 10:00)

#### Current Understanding
...

#### Evidence from Code Search
...

#### Hypotheses Generated
...

---

## Current Consolidated Understanding

### What We Know
- [valid understanding points]

### What Was Disproven
- ~~[disproven assumptions]~~

### Current Investigation Focus
[current focus]
```

---

### collaborative-plan-with-file

**一句话定位**: 协作规划 — 多代理协作规划（替代 team-planex）

**功能**:
- 多代理协作规划
- planner 和 executor 并行工作
- 中间产物文件传递 solution

**Wave Pipeline** (逐 Issue 节拍):
```
Issue 1:  planner 规划 solution → 写中间产物 → 冲突检查 → 创建 EXEC-* → issue_ready
                ↓ (executor 立即开始)
Issue 2:  planner 规划 solution → 写中间产物 → 冲突检查 → 创建 EXEC-* → issue_ready
                ↓ (executor 并行消费)
Issue N:  ...
Final:    planner 发送 all_planned → executor 完成剩余 EXEC-* → 结束
```

---

### unified-execute-with-file

**一句话定位**: 通用执行引擎 — 替代 workflow-execute

**功能**:
- 通用执行引擎
- 支持多种任务类型
- 自动会话恢复

**会话发现**:
1. 计算 .workflow/active/ 中的活跃会话数
2. 决策:
   - count=0 → 错误：无活跃会话
   - count=1 → 自动选择会话
   - count>1 → AskUserQuestion（最多 4 个选项）

---

### roadmap-with-file

**一句话定位**: 需求路线图规划

**功能**:
- 需求到路线图的规划
- 优先级排序
- 里程碑定义

**输出结构**:
```
.workflow/.roadmap/{session-id}/
├── roadmap.md                 # 路线图文档
├── milestones.md              # 里程碑定义
└── priorities.json            # 优先级排序
```

---

### review-cycle

**一句话定位**: 审查循环（Codex 版本）

**功能**:
- 代码审查
- 修复循环
- 验证修复效果

**循环流程**:
```
审查代码 → 发现问题 → [有问题] → 修复代码 → 验证 → [仍有问题] → 修复代码
                          ↑______________|
```

---

### workflow-test-fix-cycle

**一句话定位**: 测试修复工作流

**功能**:
- 诊断测试失败原因
- 修复代码或测试
- 验证修复
- 循环直到通过

**流程**:
```
诊断失败 → 确定根因 → [代码问题] → 修复代码 → 验证
                          ↑___________|
```

## 相关命令

- [Codex Skills - 生命周期](./codex-lifecycle.md)
- [Codex Skills - 专项](./codex-specialized.md)
- [Claude Skills - 工作流](./claude-workflow.md)

## 最佳实践

1. **选择合适的工作流**:
   - 协作分析 → `analyze-with-file`
   - 头脑风暴 → `brainstorm-with-file`
   - 调试 → `debug-with-file`
   - 规划 → `collaborative-plan-with-file`

2. **文档化讨论**: 利用文档化讨论时间线，捕获理解演进

3. **决策记录**: 在关键点记录决策，保留决策历史

4. **假设驱动调试**: 使用假设驱动调试，系统化解决问题

5. **多视角分析**: 利用多视角并行分析，获得全面理解

## 使用示例

```bash
# 协作分析
/analyze-with-file TOPIC="How to optimize database queries?"

# 深度分析
/analyze-with-file TOPIC="Architecture for microservices" --depth=deep

# 头脑风暴
/brainstorm-with-file TOPIC="Design payment system"

# 调试
/debug-with-file BUG="System crashes intermittently"

# 协作规划
/collaborative-plan-with-file "Add user notifications"

# 测试修复
/workflow-test-fix-cycle "Unit tests failing"
```
