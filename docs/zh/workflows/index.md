# 工作流系统

CCW 的 4 级工作流系统编排从需求到部署代码的整个开发生命周期。

## 工作流级别

```text
Level 1: 规范
    ↓
Level 2: 规划
    ↓
Level 3: 实现
    ↓
Level 4: 验证
```

## Level 1: 规范

定义要构建的内容和原因。

**活动:**
- 需求收集
- 用户故事创建
- 验收标准定义
- 风险评估

**输出:**
- 产品简报
- 需求文档 (PRD)
- 架构设计
- Epics 和 Stories

**代理:** analyst, writer

## Level 2: 规划

定义如何构建。

**活动:**
- 技术规划
- 任务分解
- 依赖映射
- 资源估算

**输出:**
- 实现计划
- 任务定义
- 依赖图
- 风险缓解

**代理:** planner, architect

## Level 3: 实现

构建解决方案。

**活动:**
- 代码实现
- 单元测试
- 文档
- 代码审查

**输出:**
- 源代码
- 测试
- 文档
- 构建产物

**代理:** executor, code-developer

## Level 4: 验证

确保质量。

**活动:**
- 集成测试
- QA 测试
- 性能测试
- 安全审查

**输出:**
- 测试报告
- QA 发现
- 审查反馈
- 部署就绪性

**代理:** tester, reviewer

## 完整工作流示例

```bash
# Level 1: 规范
Skill(skill="team-lifecycle-v4", args="构建用户身份验证系统")
# => 创建 RESEARCH-001, DRAFT-001/002/003/004, QUALITY-001

# Level 2: 规划 (QUALITY-001 后自动触发)
# => 创建 PLAN-001 及任务分解

# Level 3: 实现 (PLAN-001 后自动触发)
# => 执行 IMPL-001 及代码生成

# Level 4: 验证 (IMPL-001 后自动触发)
# => 运行 TEST-001 和 REVIEW-001
```

## 工作流可视化

```text
┌─────────────────────────────────────────────────────────────┐
│                    工作流编排                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [RESEARCH-001]   产品发现                                   │
│       ↓                                                       │
│  [DRAFT-001]      产品简报                                   │
│       ↓                                                       │
│  [DRAFT-002]      需求 (PRD)                                │
│       ↓                                                       │
│  [DRAFT-003]      架构设计                                   │
│       ↓                                                       │
│  [DRAFT-004]      Epics 和 Stories                          │
│       ↓                                                       │
│  [QUALITY-001]    规范质量检查 ◄── 检查点                   │
│       ↓                  ↓                                   │
│  [PLAN-001]       实现计划                                   │
│       ↓                                                       │
│  [IMPL-001]       代码实现                                   │
│       ↓                                                       │
│  [TEST-001] ───┐                                            │
│                ├──► [REVIEW-001] ◄── 最终关卡               │
│  [REVIEW-001] ─┘                                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 检查点

### 规范检查点 (QUALITY-001 后)

在实现前暂停以供用户确认。

**验证:**
- 所有需求已记录
- 架构已批准
- 风险已评估
- 验收标准已定义

### 最终关卡 (REVIEW-001 后)

部署前的最终质量关卡。

**验证:**
- 所有测试通过
- 关键问题已解决
- 文档完整
- 性能可接受

## 自定义工作流

为您的团队定义自定义工作流:

```yaml
# .ccw/workflows/my-workflow.yaml
name: "功能开发"
levels:
  - name: "discovery"
    agent: "analyst"
    tasks: ["research", "user-stories"]
  - name: "design"
    agent: "architect"
    tasks: ["api-design", "database-schema"]
  - name: "build"
    agent: "executor"
    tasks: ["implementation", "unit-tests"]
  - name: "verify"
    agent: "tester"
    tasks: ["integration-tests", "e2e-tests"]
```

::: info 另请参阅
- [4 级系统](./4-level.md) - 详细工作流说明
- [最佳实践](./best-practices.md) - 工作流优化技巧
:::
