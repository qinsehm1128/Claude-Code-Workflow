# Claude Skills - 工作流类

## 一句话定位

**工作流类 Skills 是任务编排和执行的流水线系统** — 从规划到执行到验证的全流程自动化工作流。

## 解决的痛点

| 痛点 | 现状 | Claude Code Workflow 方案 |
| --- | --- | --- |
| **手动任务拆解** | 人工分解任务，容易遗漏 | 自动化任务生成和依赖管理 |
| **执行状态分散** | 各工具独立，状态不统一 | 统一会话管理、TodoWrite 追踪 |
| **中断恢复困难** | 任务中断后难以恢复 | 会话持久化、断点续传 |
| **质量验证缺失** | 完成后无质量检查 | 内置质量关卡、验证报告 |

## Skills 列表

| Skill | 功能 | 触发方式 |
| --- | --- | --- |
| `workflow-plan` | 统一规划技能（4 阶段工作流） | `/workflow-plan` |
| `workflow-execute` | 代理协调执行 | `/workflow-execute` |
| `workflow-lite-plan` | 轻量级快速规划 | `/workflow-lite-plan` |
| `workflow-multi-cli-plan` | 多 CLI 协作规划 | `/workflow-multi-cli-plan` |
| `workflow-tdd-plan` | TDD 工作流 | `/workflow-tdd-plan` |
| `workflow-test-fix` | 测试修复工作流 | `/workflow-test-fix` |
| `workflow-skill-designer` | Skill 设计工作流 | `/workflow-skill-designer` |

## Skills 详解

### workflow-plan

**一句话定位**: 统一规划技能 — 4 阶段工作流、计划验证、交互式重规划

**触发**:
```shell
/workflow-plan <task-description>
/workflow-plan-verify --session <session-id>
/workflow:replan --session <session-id> [task-id] "requirements"
```

**功能**:
- 4 阶段工作流：会话发现 → 上下文收集 → 冲突解决 → 任务生成
- 计划验证（Phase 5）：只读验证 + 质量关卡
- 交互式重规划（Phase 6）：边界澄清 → 影响分析 → 备份 → 应用 → 验证

**模式检测**:
```javascript
// Skill 触发器决定模式
skillName === 'workflow-plan-verify' → 'verify'
skillName === 'workflow:replan' → 'replan'
default → 'plan'
```

**核心规则**:
1. **纯协调器**: SKILL.md 只路由和协调，执行细节在阶段文件中
2. **渐进式阶段加载**: 仅在阶段即将执行时读取阶段文档
3. **多模式路由**: 单一技能通过模式检测处理 plan/verify/replan
4. **任务附加模型**: 子命令任务被附加，顺序执行，然后折叠
5. **自动继续**: 每个阶段完成后自动执行下一个待处理阶段
6. **累积状态**: planning-notes.md 跨阶段携带上下文用于 N+1 决策

**计划模式数据流**:
```plaintext
用户输入（任务描述）
    ↓
[转换为结构化格式]
    ↓ 结构化描述:
    ↓   GOAL: [目标]
    ↓   SCOPE: [范围]
    ↓   CONTEXT: [背景]
    ↓
Phase 1: session:start --auto "structured-description"
    ↓ 输出: sessionId
    ↓ 写入: planning-notes.md (用户意图部分)
    ↓
Phase 2: context-gather --session sessionId "structured-description"
    ↓ 输入: sessionId + 结构化描述
    ↓ 输出: contextPath + conflictRisk
    ↓ 更新: planning-notes.md
    ↓
Phase 3: conflict-resolution [条件: conflictRisk ≥ medium]
    ↓ 输入: sessionId + contextPath + conflictRisk
    ↓ 输出: 修改后的头脑风暴产物
    ↓ 跳过如果 conflictRisk 是 none/low → 直接进入 Phase 4
    ↓
Phase 4: task-generate-agent --session sessionId
    ↓ 输入: sessionId + planning-notes.md + context-package.json
    ↓ 输出: IMPL_PLAN.md, task JSONs, TODO_LIST.md
    ↓
计划确认（用户决策门）:
    ├─ "验证计划质量"（推荐）→ Phase 5
    ├─ "开始执行" → Skill(skill="workflow-execute")
    └─ "仅审查状态" → 内联展示会话状态
```

**TodoWrite 模式**:
- **任务附加**（阶段执行时）：子任务附加到协调器的 TodoWrite
- **任务折叠**（子任务完成后）：移除详细子任务，折叠为阶段摘要
- **持续执行**: 完成后自动进行到下一个待处理阶段

---

### workflow-execute

**一句话定位**: 代理协调执行 — 系统化任务发现、代理协调和状态跟踪

**触发**:
```shell
/workflow-execute
/workflow-execute --resume-session="WFS-auth"
/workflow-execute --yes
/workflow-execute -y --with-commit
```

**功能**:
- 会话发现：识别并选择活跃工作流会话
- 执行策略解析：从 IMPL_PLAN.md 提取执行模型
- TodoWrite 进度跟踪：整个工作流执行期间的实时进度跟踪
- 代理编排：协调具有完整上下文的专业代理
- 自主完成：执行所有任务直到工作流完成或达到阻塞状态

**自动模式默认值** (`--yes` 或 `-y`):
- **会话选择**: 自动选择第一个（最新）活跃会话
- **完成选择**: 自动完成会话（运行 `/workflow:session:complete --yes`）

**执行过程**:
```plaintext
Phase 1: 发现
   ├─ 计算活跃会话数
   └─ 决策:
      ├─ count=0 → 错误：无活跃会话
      ├─ count=1 → 自动选择会话 → Phase 2
      └─ count>1 → AskUserQuestion（最多 4 个选项）→ Phase 2

Phase 2: 规划文档验证
   ├─ 检查 IMPL_PLAN.md 存在
   ├─ 检查 TODO_LIST.md 存在
   └─ 验证 .task/ 包含 IMPL-*.json 文件

Phase 3: TodoWrite 生成
   ├─ 更新会话状态为 "active"
   ├─ 解析 TODO_LIST.md 获取任务状态
   ├─ 为整个工作流生成 TodoWrite
   └─ 准备会话上下文路径

Phase 4: 执行策略选择 & 任务执行
   ├─ Step 4A: 从 IMPL_PLAN.md 解析执行策略
   └─ Step 4B: 延迟加载执行任务
      └─ 循环:
         ├─ 从 TodoWrite 获取下一个 in_progress 任务
         ├─ 延迟加载任务 JSON
         ├─ 启动代理并传入任务上下文
         ├─ 标记任务完成
         ├─ [with-commit] 基于摘要提交更改
         └─ 前进到下一个任务

Phase 5: 完成
   ├─ 更新任务状态
   ├─ 生成摘要
   └─ AskUserQuestion: 选择下一步
```

**执行模型**:
| 模型 | 条件 | 模式 |
|------|------|------|
| Sequential | IMPL_PLAN 指定或无明确并行化指导 | 逐个执行 |
| Parallel | IMPL_PLAN 指定并行化机会 | 并行执行独立任务组 |
| Phased | IMPL_PLAN 指定阶段分解 | 按阶段执行，遵守阶段边界 |
| Intelligent Fallback | IMPL_PLAN 缺少执行策略细节 | 分析任务结构，应用智能默认值 |

**Lazy Loading 策略**:
- **TODO_LIST.md**: Phase 3 读取（任务元数据、状态、依赖）
- **IMPL_PLAN.md**: Phase 2 检查存在，Phase 4A 解析执行策略
- **Task JSONs**: 延迟加载 — 仅在任务即将执行时读取

**自动提交模式** (`--with-commit`):
```bash
# 1. 从 .summaries/{task-id}-summary.md 读取摘要
# 2. 从 "Files Modified" 部分提取文件
# 3. 提交: git add <files> && git commit -m "{type}: {title} - {summary}"
```

---

### workflow-lite-plan

**一句话定位**: 轻量级快速规划 — 超简单任务的快速规划和执行

**触发**:
```shell
/workflow-lite-plan <simple-task>
```

**功能**:
- 用于 Level 1 (Lite-Lite-Lite) 工作流
- 超简单快速任务的最小规划开销
- 直接文本输入，无需复杂分析

**适用场景**:
- 小 bug 修复
- 简单文档更新
- 配置调整
- 单函数修改

---

### workflow-multi-cli-plan

**一句话定位**: 多 CLI 协作规划 — 多个 CLI 工具协作的分析和规划

**触发**:
```shell
/workflow-multi-cli-plan <task>
```

**功能**:
- 调用多个 CLI 工具（Gemini、Codex、Claude）并行分析
- 综合多个视角的输入
- 生成综合规划

**使用场景**:
- 需要多视角分析的任务
- 复杂架构决策
- 跨领域问题

---

### workflow-tdd-plan

**一句话定位**: TDD 工作流 — 测试驱动的开发流程

**触发**:
```shell
/workflow-tdd <feature-description>
```

**功能**:
- 先编写测试
- 实现功能
- 运行测试验证
- 循环直到通过

**流水线**:
```plaintext
规划测试 → 编写测试 → [失败] → 实现功能 → [通过] → 完成
                    ↑___________|
```

---

### workflow-test-fix

**一句话定位**: 测试修复工作流 — 失败测试的诊断和修复

**触发**:
```shell
/workflow:test-fix <failing-tests>
```

**功能**:
- 诊断测试失败原因
- 修复代码或测试
- 验证修复
- 循环直到通过

**流水线**:
```plaintext
诊断失败 → 确定根因 → [代码问题] → 修复代码 → 验证
                          ↑___________|
```

---

### workflow-skill-designer

**一句话定位**: Skill 设计工作流 — 创建新的 Claude Code Skills

**触发**:
```shell
/workflow:skill-designer <skill-idea>
```

**功能**:
- 需求发现
- 结构生成
- 阶段/动作生成
- 规范和模板生成
- 验证和文档

**输出结构**:
```plaintext
.claude/skills/{skill-name}/
├── SKILL.md              # 入口文件
├── phases/
│   ├── orchestrator.md   # 编排器
│   └── actions/          # 动作文件
├── specs/                # 规范文档
├── templates/            # 模板文件
└── README.md
```

---

### workflow-wave-plan

**一句话定位**: Wave 批处理规划 — 批量 Issue 的并行处理规划

**触发**:
```shell
/workflow:wave-plan <issue-list>
```

**功能**:
- 批量 Issue 分析
- 并行化机会识别
- Wave 调度（逐批处理）
- 执行队列生成

**Wave 模型**:
```plaintext
Wave 1: Issue 1-5 → 并行规划 → 并行执行
Wave 2: Issue 6-10 → 并行规划 → 并行执行
...
```

## 相关命令

- [Claude Commands - Workflow](../commands/claude/workflow.md)
- [Claude Skills - 团队协作](./claude-collaboration.md)

## 最佳实践

1. **选择合适的工作流**:
   - 超简单任务 → `workflow-lite-plan`
   - 复杂功能 → `workflow-plan` → `workflow-execute`
   - TDD 开发 → `workflow-tdd-plan`
   - 测试修复 → `workflow-test-fix`
   - Skill 创建 → `workflow-skill-designer`

2. **利用自动模式**: 使用 `--yes` 或 `-y` 跳过交互式确认，使用默认值

3. **会话管理**: 所有工作流支持会话持久化，可中断恢复

4. **TodoWrite 追踪**: 利用 TodoWrite 实时查看工作流执行进度

5. **Lazy Loading**: 任务 JSON 延迟加载，仅在执行时读取，提高性能
