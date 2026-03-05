# Claude Skills - 代码审查类

## 一句话定位

**代码审查类 Skills 是多维度代码质量分析系统** — 通过结构化审查维度和自动化检查发现代码问题并提供修复建议。

## 解决的痛点

| 痛点 | 现状 | Claude Code Workflow 方案 |
| --- | --- | --- |
| **审查维度不全** | 手动审查容易遗漏维度 | 6 维度自动审查 |
| **问题分类混乱** | 难以区分严重程度 | 结构化问题分类 |
| **修复建议模糊** | 缺少具体修复方案 | 可执行的修复建议 |
| **审查流程重复** | 每次审查重复相同步骤 | 自动化扫描和报告 |

## Skills 列表

| Skill | 功能 | 触发方式 |
| --- | --- | --- |
| `review-code` | 多维度代码审查（6 维度） | `/review-code <target>` |
| `review-cycle` | 代码审查和修复循环 | `/review-cycle <target>` |

## Skills 详解

### review-code

**一句话定位**: 多维度代码审查 — 分析正确性、可读性、性能、安全性、测试、架构六大维度

**触发**:
```
/review-code <target-path>
/review-code src/auth/**
/review-code --dimensions=sec,perf src/**
```

**功能**:
- 6 维度审查：正确性、可读性、性能、安全性、测试覆盖、架构一致性
- 分层执行：快速扫描识别高风险区域，深入审查聚焦关键问题
- 结构化报告：按严重程度分类，提供文件位置和修复建议
- 状态驱动：自主模式，根据审查进度动态选择下一步动作

**架构概览**:
```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ Phase 0: Specification Study (强制前置)                       │
│              → 阅读 specs/review-dimensions.md                   │
│              → 理解审查维度和问题分类标准                          │
└───────────────┬─────────────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────────────┐
│           Orchestrator (状态驱动决策)                             │
│           → 读取状态 → 选择审查动作 → 执行 → 更新状态              │
└───────────────┬─────────────────────────────────────────────────┘
                │
    ┌───────────┼───────────┬───────────┬───────────┐
    ↓           ↓           ↓           ↓           ↓
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Collect │ │ Quick   │ │ Deep    │ │ Report  │ │Complete │
│ Context │ │ Scan    │ │ Review  │ │ Generate│ │         │
└─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
     ↓           ↓           ↓           ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Review Dimensions                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │Correctness│ │Readability│ │Performance│ │ Security │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│  ┌──────────┐ ┌──────────┐                                       │
│  │ Testing  │ │Architecture│                                      │
│  └──────────┘ └──────────┘                                       │
└─────────────────────────────────────────────────────────────────┘
```

**⚠️ 强制前置条件**:

> **禁止跳过**: 在执行任何审查操作之前，**必须**完整阅读以下文档。

**规范文档**（必读）:
| 文档 | 用途 | 优先级 |
|------|------|--------|
| [specs/review-dimensions.md](/skills/specs/review-dimensions) | 审查维度定义和检查点 | **P0 - 最高** |
| [specs/issue-classification.md](/skills/specs/issue-classification) | 问题分类和严重程度标准 | **P0 - 最高** |
| [specs/quality-standards.md](/skills/specs/quality-standards) | 审查质量标准 | P1 |

**模板文件**（生成前必读）:
| 文档 | 用途 |
|------|------|
| [templates/review-report.md](/skills/templates/review-report) | 审查报告模板 |
| [templates/issue-template.md](/skills/templates/issue-template) | 问题记录模板 |

**执行流程**:
```
Phase 0: Specification Study (强制前置 - 禁止跳过)
  → Read: specs/review-dimensions.md
  → Read: specs/issue-classification.md
  → 理解审查标准和问题分类

Action: collect-context
  → 收集目标文件/目录
  → 识别技术栈和语言
  → Output: state.context

Action: quick-scan
  → 快速扫描整体结构
  → 识别高风险区域
  → Output: state.risk_areas, state.scan_summary

Action: deep-review (per dimension)
  → 逐维度深入审查
  → 记录发现的问题
  → Output: state.findings[]

Action: generate-report
  → 汇总所有发现
  → 生成结构化报告
  → Output: review-report.md

Action: complete
  → 保存最终状态
  → 输出审查摘要
```

**审查维度**:
| 维度 | 关注领域 | 关键检查 |
|------|----------|----------|
| **Correctness** | 逻辑正确性 | 边界条件、错误处理、null 检查 |
| **Readability** | 代码可读性 | 命名规范、函数长度、注释质量 |
| **Performance** | 性能效率 | 算法复杂度、I/O 优化、资源使用 |
| **Security** | 安全性 | 注入风险、敏感信息、权限控制 |
| **Testing** | 测试覆盖 | 测试充分性、边界覆盖、可维护性 |
| **Architecture** | 架构一致性 | 设计模式、分层结构、依赖管理 |

**问题严重程度**:
| 级别 | 前缀 | 描述 | 所需操作 |
|------|------|------|----------|
| **Critical** | [C] | 阻塞性问题，必须立即修复 | 合并前必须修复 |
| **High** | [H] | 重要问题，需要修复 | 应该修复 |
| **Medium** | [M] | 建议改进 | 考虑修复 |
| **Low** | [L] | 可选优化 | 有则更好 |
| **Info** | [I] | 信息性建议 | 仅供参考 |

**输出结构**:
```
.workflow/.scratchpad/review-code-{timestamp}/
├── state.json                    # 审查状态
├── context.json                  # 目标上下文
├── findings/                     # 问题发现
│   ├── correctness.json
│   ├── readability.json
│   ├── performance.json
│   ├── security.json
│   ├── testing.json
│   └── architecture.json
└── review-report.md              # 最终审查报告
```

---

### review-cycle

**一句话定位**: 代码审查和修复循环 — 审查代码、发现问题、修复验证的完整循环

**触发**:
```
/review-cycle <target-path>
/review-cycle --full <target-path>
```

**功能**:
- 审查代码发现问题
- 生成修复建议
- 执行修复
- 验证修复效果
- 循环直到通过

**循环流程**:
```
审查代码 → 发现问题 → [有问题] → 修复代码 → 验证 → [仍有问题] → 修复代码
                          ↑______________|
```

**使用场景**:
- PR 审查前自查
- 代码质量改进
- 重构验证
- 安全审计

## 相关命令

- [Claude Commands - Workflow](../commands/claude/workflow.md)
- [Team Review 团队协作](./claude-collaboration.md#team-review)

## 最佳实践

1. **完整阅读规范**: 执行审查前必须阅读 specs/ 下的规范文档
2. **多维度审查**: 使用 `--dimensions` 指定关注的维度，或使用默认全维度
3. **快速扫描**: 先用 quick-scan 识别高风险区域，再深入审查
4. **结构化报告**: 利用生成的 review-report.md 作为修复指南
5. **循环改进**: 使用 review-cycle 持续改进直到达到质量标准

## 使用示例

```bash
# 完整审查（6 维度）
/review-code src/auth/**

# 只审查安全性和性能
/review-code --dimensions=sec,perf src/api/

# 审查并修复循环
/review-cycle --full src/utils/

# 审查特定文件
/review-code src/components/Header.tsx
```

## 问题报告示例

```
### [C] SQL Injection Risk

**Location**: `src/auth/login.ts:45`

**Issue**: User input directly concatenated into SQL query without sanitization.

**Severity**: Critical - Must fix before merge

**Recommendation**:
```typescript
// Before (vulnerable):
const query = `SELECT * FROM users WHERE username='${username}'`;

// After (safe):
const query = 'SELECT * FROM users WHERE username = ?';
await db.query(query, [username]);
```

**Reference**: [specs/review-dimensions.md](/skills/specs/review-dimensions) - Security section
```
