# Requirements PRD Template

> 用途: 产品需求文档模板，用于 spec-generator Phase 3 输出

## 模板

### _index.md 模板

```markdown
# Requirements (PRD) - Index

> **Product**: {Product Name}
> **Generated**: {YYYY-MM-DD}
> **Session**: {session-id}

## Overview

产品需求概述（2-3 段）

## Requirements Summary

| Category | Count | Status |
|----------|-------|--------|
| Functional Requirements | {N} | |
| Non-Functional Requirements | {N} | |

## MoSCoW Summary

| Category | Count | Items |
|----------|-------|-------|
| Must | {N} | REQ-001, REQ-002, ... |
| Should | {N} | REQ-003, REQ-004, ... |
| Could | {N} | REQ-005, ... |

## Requirements Traceability

### From Product Brief

| Brief Feature | Requirement(s) |
|---------------|----------------|
| Feature 1 | REQ-001, REQ-002 |
| Feature 2 | REQ-003 |

### To Architecture

| Requirement | ADR |
|-------------|-----|
| REQ-001 | ADR-001 |
| REQ-002 | ADR-002 |

## Functional Requirements

详见各需求文档：
- [REQ-001-{title}](./REQ-001-{slug}.md)
- [REQ-002-{title}](./REQ-002-{slug}.md)

## Non-Functional Requirements

详见各 NFR 文档：
- [NFR-PERF-001](./NFR-PERF-001.md)
- [NFR-SEC-001](./NFR-SEC-001.md)

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | YYYY-MM-DD | Initial version |
```

---

### REQ-*.md 模板

```markdown
# REQ-{NNN}: {Requirement Title}

> **Type**: Functional Requirement
> **Priority**: {Must|Should|Could}
> **Status**: {Draft|Approved|Implemented}
> **Created**: {YYYY-MM-DD}

## Description

详细描述需求内容

## User Story

**As a** {user type},
**I want** {action/feature},
**So that** {benefit/value}.

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Functional Specifications

### Input

| Input | Type | Description | Validation |
|-------|------|-------------|------------|
| input1 | type | 描述 | 验证规则 |

### Output

| Output | Type | Description |
|--------|------|-------------|
| output1 | type | 描述 |

### Business Rules

1. Rule 1
2. Rule 2

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| REQ-XXX | Functional | |
| NFR-XXX | Non-Functional | |

## References

- [Product Brief](../product-brief.md) - Related Feature
- [ADR-XXX](../architecture/ADR-XXX.md) - Technical Decision
```

---

### NFR-*.md 模板

```markdown
# NFR-{TYPE}-{NNN}: {Non-Functional Requirement Title}

> **Type**: {Performance|Security|Scalability|Reliability|Usability}
> **Priority**: {Must|Should|Could}
> **Status**: {Draft|Approved}
> **Created**: {YYYY-MM-DD}

## Description

详细描述非功能需求

## Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| metric1 | value | 测量方法 |
| metric2 | value | 测量方法 |

## Specifications

### {Type} Requirements

1. Requirement 1
2. Requirement 2

### Testing Strategy

- Test 1: Description
- Test 2: Description

## Related Requirements

| Requirement | Relation |
|-------------|----------|
| REQ-001 | Impacts |
| REQ-002 | Enables |
```

## 使用说明

1. **触发**: spec-generator Phase 3
2. **输入**: Phase 2 Product Brief
3. **输出**: requirements/ 目录，包含 _index.md 和所有需求文件
4. **验证**: 确保追溯链接有效

---

## 示例

### 简化示例 - _index.md

```markdown
# Requirements (PRD) - Index

> **Product**: Real-Time Collaboration Platform
> **Generated**: 2026-03-01
> **Session**: SPEC-rtc-platform-2026-03-01

## Overview

本文档包含实时协作平台的完整需求规格说明。

## Requirements Summary

| Category | Count | Status |
|----------|-------|--------|
| Functional Requirements | 8 | Draft |
| Non-Functional Requirements | 3 | Draft |

## MoSCoW Summary

| Category | Count | Items |
|----------|-------|-------|
| Must | 4 | REQ-001, REQ-002, REQ-003, REQ-004 |
| Should | 3 | REQ-005, REQ-006, REQ-007 |
| Could | 1 | REQ-008 |
```

### 简化示例 - REQ-001.md

```markdown
# REQ-001: Real-Time Document Sync

> **Type**: Functional Requirement
> **Priority**: Must
> **Status**: Draft
> **Created**: 2026-03-01

## Description

用户编辑文档时，更改应实时同步到所有协作者

## User Story

**As a** content editor,
**I want** to see others' changes in real-time,
**So that** we can collaborate without conflicts.

## Acceptance Criteria

- [ ] Changes sync within 200ms
- [ ] Multiple users can edit simultaneously
- [ ] Conflicts are auto-resolved using OT algorithm
- [ ] User cursors are visible to others

## Functional Specifications

### Input

| Input | Type | Description | Validation |
|-------|------|-------------|------------|
| document_id | string | Document identifier | Required, valid UUID |
| operations | array | OT operations | Required, non-empty |

### Output

| Output | Type | Description |
|--------|------|-------------|
| status | string | "synced" or "conflict" |
| merged_ops | array | Merged operations |

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| NFR-PERF-001 | Performance | |
| ADR-001 | OT Algorithm Choice | |
```
