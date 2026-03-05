# Reference Docs Spec

> 本文档定义 Skill 参考文档的生成规范和结构要求。

## 概述

参考文档是 Skill 的重要组成部分，为使用者和维护者提供清晰的指导。本规范确保所有 Skill 生成规范一致的参考文档。

## 参考文档类型

| 类型 | 用途 | 位置 |
|------|------|------|
| SKILL.md | 入口文件，总览和快速开始 | 技能根目录 |
| README.md | 详细文档，面向使用者 | 技能根目录 |
| Phase 文档 | 各阶段执行说明 | phases/ 目录 |
| 规格文档 | 领域规范和质量标准 | specs/ 目录 |
| 模板文档 | 输出模板和格式 | templates/ 目录 |

---

## SKILL.md 规范

### 必需章节

```markdown
# {Skill Name}

> One-liner 描述

## One-Liner

**简短描述** — 详细说明

## Pain Points Solved

| Pain Point | Current State | Solution |
|------------|---------------|----------|
| 问题1 | 当前状态 | 解决方案 |
| 问题2 | 当前状态 | 解决方案 |

## Skills List / 功能列表

| Skill | Function | Trigger |
|-------|----------|---------|
| 子技能1 | 功能描述 | 触发命令 |
| 子技能2 | 功能描述 | 触发命令 |

## Skills Details / 详细说明

### 子技能名

**One-Liner**: 一句话描述

**Trigger**:
```shell
/trigger-command <args>
```

**Features**:
- 特性1
- 特性2

**Architecture Overview**:
```plaintext
架构图/流程图
```

**Execution Flow**:
```plaintext
Phase 1: 描述
  → Action 1
  → Action 2

Phase 2: 描述
  → Action 1
  → Action 2
```

**Output Structure**:
```plaintext
输出目录结构
```

## Related Commands / 相关命令

- [相关命令链接](path)

## Best Practices / 最佳实践

1. 实践1
2. 实践2

## Usage Examples / 使用示例

```bash
# 示例1
/command args

# 示例2
/command --flag args
```
```

---

## README.md 规范

### 结构要求

```markdown
# {Skill Name}

详细标题和徽章

## 概述

详细描述技能的用途和价值

## 功能特性

- 特性1
- 特性2

## 安装配置

配置步骤

## 使用指南

详细使用说明

## 输出说明

输出内容和格式

## 故障排除

常见问题和解决方案

## 贡献指南

如何贡献

## 许可证

许可证信息
```

---

## Phase 文档规范

### Phase 文件命名

```
phases/
├── _orchestrator.md        # 编排器（可选）
├── workflow.json           # 工作流定义（可选）
├── 01-{phase-name}.md      # Phase 1
├── 02-{phase-name}.md      # Phase 2
└── 03-{phase-name}.md      # Phase 3
```

### Phase 内容结构

```markdown
# Phase {N}: {Phase Name}

## 目标

简要说明本阶段目标

## 前置条件

- 条件1
- 条件2

## 执行步骤

### 步骤 1: {步骤名称}

**操作**: 具体操作描述

**输入**: 输入说明

**输出**: 输出说明

**验证**: 如何验证完成

### 步骤 2: ...

## 输出

本阶段产生的输出文件和数据

## 质量检查

- [ ] 检查项1
- [ ] 检查项2

## 阶段完成标准

满足以下条件视为阶段完成：
1. 标准1
2. 标准2
```

---

## Orchestrator 文档规范

### 编排器结构

```markdown
# Orchestrator

## 工作流类型

{Sequential|Autonomous}

## 状态定义

| 状态 | 描述 | 触发条件 |
|------|------|---------|
| state1 | 描述 | 触发条件 |
| state2 | 描述 | 触发条件 |

## 动作定义

| 动作 | 描述 | 前置状态 | 后置状态 |
|------|------|---------|---------|
| action1 | 描述 | state1 | state2 |
| action2 | 描述 | state2 | state3 |

## 路由逻辑

```typescript
// 伪代码描述状态转换
if (condition) {
  return nextAction;
}
```

## 错误处理

- 错误情况1 → 处理方式
- 错误情况2 → 处理方式
```

---

## Action 文档规范

### Action 结构

```markdown
# {Action Name}

## 描述

详细描述动作的功能

## 输入参数

| 参数 | 类型 | 描述 | 必需 |
|------|------|------|------|
| param1 | type | 描述 | 是 |
| param2 | type | 描述 | 否 |

## 输出

| 字段 | 类型 | 描述 |
|------|------|------|
| field1 | type | 描述 |
| field2 | type | 描述 |

## 执行逻辑

1. 步骤1
2. 步骤2
3. 步骤3

## 错误处理

| 错误 | 处理 |
|------|------|
| error1 | 处理方式 |

## 示例

```typescript
// 示例代码
```
```

---

## 文档生成模板

### 使用模板的好处

- **一致性**: 所有 Skill 文档格式统一
- **完整性**: 确保所有必需章节都包含
- **可维护性**: 模板更新自动同步到所有文档

### 模板文件位置

```
docs/skills/templates/
├── skill-md.md                  # SKILL.md 模板
├── sequential-phase.md          # 顺序阶段模板
├── autonomous-orchestrator.md   # 自主编排模板
├── autonomous-action.md         # 自主行动模板
└── review-report.md            # 审查报告模板
```

---

## 文档质量检查

### 自动检查

```bash
# 使用 markdownlint
markdownlint **/*.md

# 检查链接
markdown-link-check **/*.md

# 检查拼写
cspell **/*.md
```

### 手动检查清单

- [ ] 所有章节完整
- [ ] 代码示例正确
- [ ] 链接有效
- [ ] 格式一致
- [ ] 语法正确
- [ ] 无拼写错误

---

## 参考

- [Document Standards](document-standards.md)
- [SKILL-DESIGN-SPEC](../_shared/SKILL-DESIGN-SPEC.md)
