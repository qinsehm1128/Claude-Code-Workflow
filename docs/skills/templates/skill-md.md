# SKILL.md Template

> 用途: Skill 入口文档模板 (SKILL.md)，用于 skill-generator

## 模板

```markdown
# {Skill Name}

> **Type**: {Sequential|Autonomous}
> **Version**: {1.0.0}
> **Status**: {Stable|Experimental}
> **Category**: {Team|Workflow|Standalone|Specialized}

## One-Liner

**简短描述** — 详细说明

## Pain Points Solved

| Pain Point | Current State | {Skill Name} Solution |
|------------|---------------|----------------------|
| Pain Point 1 | 当前问题描述 | 解决方案描述 |
| Pain Point 2 | 当前问题描述 | 解决方案描述 |
| Pain Point 3 | 当前问题描述 | 解决方案描述 |

## Skills List / 功能列表

| Skill / Phase | Function | Trigger |
|---------------|----------|---------|
| {sub-skill-1} | 功能描述 | 触发命令 |
| {sub-skill-2} | 功能描述 | 触发命令 |

## Skills Details / 详细说明

### {Sub-Skill Name}

**One-Liner**: 一句话描述

**Trigger**:
```shell
/trigger-command <args>
/trigger-command --flag <value>
```

**Features**:
- Feature 1
- Feature 2
- Feature 3

**Architecture Overview**:
```plaintext
┌─────────────────────────────────────────────────┐
│              {Skill Name} Architecture          │
│                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│  │ Phase 1  │ -> │ Phase 2  │ -> │ Phase 3  │ │
│  │ {Desc}   │    │ {Desc}   │    │ {Desc}   │ │
│  └──────────┘    └──────────┘    └──────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

**⚠️ Mandatory Prerequisites**:

> **Do not skip**: Before executing any operations, you **must** completely read the following documents.

**Specification Documents** (required):
| Document | Purpose | Priority |
|----------|---------|----------|
| [specs/{doc-name}.md](specs/{doc-name}.md) | Description | **P0 - Highest** |

**Template Files** (read before generation):
| Document | Purpose |
|----------|---------|
| [templates/{template}.md](templates/{template}.md) | Template description |

**Execution Flow**:
```plaintext
Phase 1: {Phase Name}
  -> Action 1: Description
  -> Action 2: Description
  -> Output: {output description}

Phase 2: {Phase Name}
  -> Action 1: Description
  -> Action 2: Description
  -> Output: {output description}

Phase 3: {Phase Name}
  -> Action 1: Description
  -> Output: {output description}
```

**Output Structure**:
```plaintext
{output-directory}/
├── file1.md                    # Description
├── file2.md                    # Description
└── subdirectory/               # Description
    ├── file3.md
    └── file4.md
```

---

### {Another Sub-Skill}

**One-Liner**: 一句话描述

**Trigger**:
```shell
/trigger-command <args>
```

**Features**:
- Feature 1
- Feature 2

**Use Cases**:
- Use case 1
- Use case 2

## Related Commands

- [Related Command 1](../commands/claude/{command}.md)
- [Related Command 2](../commands/claude/{command}.md)

## Best Practices

1. **Practice 1**: Description
2. **Practice 2**: Description
3. **Practice 3**: Description

## Usage Examples

```bash
# Example 1: Description
/trigger-command <args>

# Example 2: Description
/trigger-command --flag <args>

# Example 3: Description
/trigger-command sub-command <args>
```

## Output Example

```
### Example Output Title

**Location**: `file/path:line`

**Issue**: Description of the finding

**Severity**: {Critical|High|Medium|Low}

**Recommendation**:
```typescript
// Before (problematic)
const code = "problematic code";

// After (fixed)
const code = "fixed code";
```

**Reference**: [specs/reference.md](specs/reference.md) - Section name
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Problem 1 | Solution 1 |
| Problem 2 | Solution 2 |
| Problem 3 | Solution 3 |

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | YYYY-MM-DD | Initial release |
```

## 使用说明

1. **触发**: skill-generator Phase 2
2. **输入**: Phase 1 skill-config.json
3. **输出**: SKILL.md
4. **验证**: 确保所有链接有效，所有章节完整

---

## 示例

### 简化示例

```markdown
# Review Code

> **Type**: Autonomous
> **Version**: 1.0.0
> **Status**: Stable
> **Category**: Specialized

## One-Liner

**多维度代码审查** — 通过 6 个维度自动分析代码质量并提供修复建议

## Pain Points Solved

| Pain Point | Current State | Review Code Solution |
|------------|---------------|----------------------|
| 审查维度不全 | 手动审查容易遗漏 | 6 维度自动审查 |
| 问题分类混乱 | 难以区分严重性 | 结构化问题分类 |
| 修复建议模糊 | 缺乏具体方案 | 可执行的修复建议 |

## Skills List

| Skill | Function | Trigger |
|-------|----------|---------|
| review-code | 6 维度代码审查 | `/review-code <target>` |
| review-cycle | 审查和修复循环 | `/review-cycle <target>` |

## Skills Details

### review-code

**One-Liner**: 6 维度代码审查

**Trigger**:
```shell
/review-code src/**
/review-code --dimensions=sec,perf src/
```

**Features**:
- 6 维度审查：正确性、可读性、性能、安全、测试、架构
- 快速扫描识别高风险区域
- 深度审查聚焦关键问题
- 结构化报告分级输出

**Execution Flow**:
```plaintext
Phase 0: Specification Study (Mandatory)
  -> Read specs/review-dimensions.md
  -> Read specs/issue-classification.md

Phase 1: Collect Context
  -> Scan target files
  -> Identify tech stack
  -> Output: state.context

Phase 2: Quick Scan
  -> Identify high-risk areas
  -> Output: state.risk_areas

Phase 3: Deep Review (per dimension)
  -> Analyze each dimension
  -> Record findings
  -> Output: state.findings[]

Phase 4: Generate Report
  -> Aggregate findings
  -> Generate review-report.md
```

## Best Practices

1. **完整阅读规范**: 执行前必须阅读 specs/ 文档
2. **快速扫描先行**: 先识别高风险，再深度审查
3. **结构化报告**: 使用生成的报告作为修复指南
```
