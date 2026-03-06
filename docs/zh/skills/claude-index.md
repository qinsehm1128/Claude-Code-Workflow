# Claude Skills 总览

## 一句话定位

**Claude Skills 是 VS Code 扩展的 AI 技能系统** — 通过团队协作、工作流、记忆管理、代码审查和元技能五大类别，实现从规范到实现到测试到审查的完整开发流程自动化。

## vs 传统方法对比

| 维度 | 传统方式 | **Claude Code Workflow** |
| --- | --- | --- |
| 任务编排 | 手动管理 | 自动流水线编排 |
| AI 模型 | 单一模型 | 多模型并行协作 |
| 代码审查 | 手动审查 | 6 维度自动审查 |
| 知识管理 | 随会话丢失 | 跨会话持久化 |
| 开发流程 | 人工驱动 | AI 驱动自动化 |

## Skills 类别

| 类别 | 文档 | 说明 |
|------|------|------|
| **团队协作** | [collaboration.md](./claude-collaboration.md) | 多角色协同工作编排系统 |
| **工作流** | [workflow.md](./claude-workflow.md) | 任务编排和执行流水线 |
| **记忆管理** | [memory.md](./claude-memory.md) | 跨会话知识持久化 |
| **代码审查** | [review.md](./claude-review.md) | 多维度代码质量分析 |
| **元技能** | [meta.md](./claude-meta.md) | 创建和管理其他技能 |

## 核心概念速览

| 概念 | 说明 | 位置/命令 |
| --- | --- | --- |
| **team-coordinate** | 通用团队协调器（动态角色） | `/team-coordinate` |
| **team-lifecycle** | 全生命周期团队 | `/team-lifecycle` |
| **team-planex** | 边规划边执行团队 | `/team-planex` |
| **workflow-plan** | 统一规划技能 | `/workflow-plan` |
| **workflow-execute** | 代理协调执行 | `/workflow-execute` |
| **memory-capture** | 记忆捕获 | `/memory-capture` |
| **review-code** | 多维度代码审查 | `/review-code` |
| **brainstorm** | 头脑风暴 | `/brainstorm` |
| **spec-generator** | 规范生成器 | `/spec-generator` |
| **ccw-help** | 命令帮助系统 | `/ccw-help` |

## 团队协作 Skills

### 团队架构模型

Claude Code Workflow 支持两种团队架构模型：

1. **team-coordinate** (通用协调器)
   - 只有 coordinator 是内置的
   - 所有工作者角色都是运行时动态生成
   - 支持任意任务类型的动态团队

2. **team-lifecycle** (全生命周期团队)
   - 基于 team-worker agent 架构
   - 所有工作者共享同一代理定义
   - 角色特定的 Phase 2-4 从 markdown 规范加载

### 团队类型对比

| 团队类型 | 角色 | 用途 |
|---------|------|------|
| **team-coordinate** | coordinator + 动态角色 | 通用任务编排 |
| **team-lifecycle** | 9 种预定义角色 | 规范→实现→测试→审查 |
| **team-planex** | planner + executor | 边规划边执行 |
| **team-review** | coordinator + scanner + reviewer + fixer | 代码审查和修复 |
| **team-testing** | coordinator + strategist + generator + executor + analyst | 测试覆盖 |

## 工作流 Skills

### 工作流级别

| 级别 | 名称 | 工作流 | 适用场景 |
|------|------|--------|----------|
| Level 1 | Lite-Lite-Lite | lite-plan | 超简单快速任务 |
| Level 2 | Rapid | plan → execute | Bug 修复、简单功能 |
| Level 2.5 | Rapid-to-Issue | plan → issue:new | 从快速规划到 Issue |
| Level 3 | Coupled | plan → execute | 复杂功能（规划+执行+审查+测试） |
| Level 4 | Full | brainstorm → plan → execute | 探索性任务 |
| With-File | 文档化探索 | analyze/brainstorm/debug-with-file | 多 CLI 协作分析 |

### 工作流选择指南

```
任务复杂度
    ↓
┌───┴────┬────────────┬─────────────┐
│        │            │             │
简单    中等        复杂        探索性
│        │            │             │
↓        ↓            ↓             ↓
lite-plan  plan         plan         brainstorm
          ↓            ↓             ↓
       execute     brainstorm     plan
                     ↓             ↓
                  plan         execute
                     ↓
                  execute
```

## 记忆管理 Skills

### Memory 类型

| 类型 | 格式 | 用途 |
|------|------|------|
| **会话压缩** | 结构化文本 | 长对话后的完整上下文保存 |
| **快速笔记** | 带 tags 的笔记 | 快速记录想法和洞察 |

### Memory 存储

```
memory/
├── MEMORY.md           # 主记忆文件（行数限制）
├── debugging.md        # 调试模式和洞察
├── patterns.md         # 代码模式和约定
├── conventions.md      # 项目约定
└── [topic].md         # 其他主题文件
```

## 代码审查 Skills

### 审查维度

| 维度 | 检查点 | 工具 |
|------|--------|------|
| **Correctness** | 逻辑正确性、边界条件 | review-code |
| **Readability** | 命名、函数长度、注释 | review-code |
| **Performance** | 算法复杂度、I/O 优化 | review-code |
| **Security** | 注入、敏感信息 | review-code |
| **Testing** | 测试充分性 | review-code |
| **Architecture** | 设计模式、分层 | review-code |

### 问题严重程度

| 级别 | 前缀 | 描述 | 所需操作 |
|------|------|------|----------|
| Critical | [C] | 阻塞性问题 | 合并前必须修复 |
| High | [H] | 重要问题 | 应该修复 |
| Medium | [M] | 建议改进 | 考虑修复 |
| Low | [L] | 可选优化 | 有则更好 |
| Info | [I] | 信息性建议 | 仅供参考 |

## 元技能

### 元技能列表

| 技能 | 功能 | 用途 |
|------|------|------|
| **spec-generator** | 6 阶段规范生成 | 产品简报、PRD、架构、Epics |
| **brainstorm** | 多角色并行分析 | 多视角头脑风暴 |
| **skill-generator** | Skill 创建 | 生成新的 Claude Skills |
| **skill-tuning** | Skill 调优 | 诊断和优化 |
| **ccw-help** | 命令帮助 | 搜索、推荐、文档 |
| **command-generator** | 命令生成 | 生成 Claude 命令 |
| **issue-manage** | Issue 管理 | Issue 创建和状态管理 |

## 快速开始

### 1. 选择团队类型

```bash
# 通用任务
/team-coordinate "Build user authentication system"

# 完整功能开发
/team-lifecycle "Create REST API for user management"

# Issue 批处理
/team-planex ISS-20260215-001 ISS-20260215-002

# 代码审查
/team-review src/auth/**
```

### 2. 选择工作流

```bash
# 快速任务
/workflow-lite-plan "Fix login bug"

# 完整开发
/workflow-plan "Add user notifications"
/workflow-execute

# TDD 开发
/workflow-tdd-plan "Implement payment processing"
```

### 3. 使用记忆管理

```bash
# 压缩会话
/memory-capture compact

# 快速笔记
/memory-capture tip "Use Redis for rate limiting" --tag config
```

### 4. 代码审查

```bash
# 完整审查（6 维度）
/review-code src/auth/**

# 审查特定维度
/review-code --dimensions=sec,perf src/api/
```

### 5. 元技能

```bash
# 生成规范
/spec-generator "Build real-time collaboration platform"

# 头脑风暴
/brainstorm "Design payment system" --count 3

# 获取帮助
/ccw "Add JWT authentication"
```

## 最佳实践

1. **团队选择**:
   - 通用任务 → `team-coordinate`
   - 完整功能 → `team-lifecycle`
   - Issue 批处理 → `team-planex`
   - 代码审查 → `team-review`
   - 测试覆盖 → `team-testing`

2. **工作流选择**:
   - 超简单 → `workflow-lite-plan`
   - 复杂功能 → `workflow-plan` → `workflow-execute`
   - TDD → `workflow-tdd-plan`
   - 测试修复 → `workflow-test-fix`

3. **记忆管理**:
   - 长对话后使用 `memory-capture compact`
   - 快速记录想法使用 `memory-capture tip`
   - 定期使用 `memory-manage full` 合并和压缩

4. **代码审查**:
   - 执行审查前完整阅读规范文档
   - 使用 `--dimensions` 指定关注维度
   - 先快速扫描识别高风险，再深入审查

5. **元技能**:
   - 使用 `spec-generator` 生成完整规范包
   - 使用 `brainstorm` 获得多视角分析
   - 使用 `ccw-help` 查找合适的命令

## 相关文档

- [Claude Commands](../commands/claude/)
- [Codex Skills](./codex-index.md)
- [功能文档](../features/spec)

## 统计数据

| 类别 | 数量 |
|------|------|
| 团队协作 Skills | 5 |
| 工作流 Skills | 8 |
| 记忆管理 Skills | 2 |
| 代码审查 Skills | 2 |
| 元技能 | 7 |
| **总计** | **24+** |
