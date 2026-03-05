# Epics Template

> 用途: Epic 和 Story 文档模板，用于 spec-generator Phase 5 输出

## 模板

### _index.md 模板

```markdown
# Epics - Index

> **Product**: {Product Name}
> **Generated**: {YYYY-MM-DD}
> **Session**: {session-id}

## Overview

Epic 概述（2-3 段）

## Epic Summary

| Epic | Title | Stories | Status | Priority |
|------|-------|---------|--------|----------|
| EPIC-001 | Epic 标题 | N stories | {Draft|Ready|In Progress} | {P0|P1|P2} |
| EPIC-002 | Epic 标题 | N stories | {Draft|Ready|In Progress} | {P0|P1|P2} |

## Dependency Graph

```plaintext
EPIC-001 (Foundation)
    │
    ├── EPIC-002 (Feature A)
    │       │
    │       └── EPIC-004 (Enhancement)
    │
    └── EPIC-003 (Feature B)
```

## MVP Scope

以下 Epic 属于 MVP:
- [ ] EPIC-001: {Epic title}
- [ ] EPIC-002: {Epic title}
- [ ] EPIC-003: {Epic title}

**Estimated MVP Duration**: {X weeks}

## Requirements Traceability

| Requirement | Epic(s) | Story Count |
|-------------|---------|-------------|
| REQ-001 | EPIC-001 | 3 |
| REQ-002 | EPIC-001, EPIC-002 | 5 |

## Architecture Traceability

| ADR | Epic(s) | Component |
|-----|---------|-----------|
| ADR-001 | EPIC-001 | Service A |
| ADR-002 | EPIC-002 | Service B |

## Epics

详见各 Epic 文档：
- [EPIC-001-{title}](./EPIC-001-{slug}.md)
- [EPIC-002-{title}](./EPIC-002-{slug}.md)

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | YYYY-MM-DD | Initial version |
```

---

### EPIC-*.md 模板

```markdown
# EPIC-{NNN}: {Epic Title}

> **Priority**: {P0|P1|P2|P3}
> **Status**: {Draft|Ready|In Progress|Done}
> **MVP**: {Yes|No}
> **Created**: {YYYY-MM-DD}

## Description

详细描述 Epic 的目标和范围

## Business Value

| Value | Description |
|-------|-------------|
| 业务价值1 | 描述 |
| 业务价值2 | 描述 |

## Related Requirements

| Requirement | Relation |
|-------------|----------|
| REQ-001 | Addresses |
| REQ-002 | Partially Addresses |

## Stories

| Story | Title | Points | Status |
|-------|-------|--------|--------|
| STORY-001 | Story 标题 | {points} | {Todo|In Progress|Done} |
| STORY-002 | Story 标题 | {points} | {Todo|In Progress|Done} |

### STORY-001: {Story Title}

**As a** {user type},
**I want** {action},
**So that** {benefit}.

**Acceptance Criteria**:
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

**Technical Notes**:
- Notes for developers
- API endpoints, data models, etc.

**Dependencies**:
- STORY-002 (must complete first)
- External dependency description

---

### STORY-002: {Story Title}

... (same structure)

## Dependencies

| Depends On | Type | Epic |
|------------|------|------|
| EPIC-XXX | Finish-to-Start | {epic title} |
| External API | External | {description} |

## Estimate

| Category | Estimate |
|----------|----------|
| Development | {X days} |
| Testing | {X days} |
| Documentation | {X days} |
| **Total** | **{X days}** |

## Definition of Done

- [ ] All stories completed and tested
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Acceptance criteria met
- [ ] No known bugs

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Risk 1 | High/Low | 缓解措施 |
| Risk 2 | High/Low | 缓解措施 |
```

## 使用说明

1. **触发**: spec-generator Phase 5
2. **输入**: Phase 4 Architecture
3. **输出**: epics/ 目录，包含 _index.md 和所有 Epic 文件
4. **验证**: 确保追溯链接有效

---

## 示例

### 简化示例 - _index.md

```markdown
# Epics - Index

> **Product**: Real-Time Collaboration Platform
> **Generated**: 2026-03-01
> **Session**: SPEC-rtc-platform-2026-03-01

## Overview

本文档定义实时协作平台的 Epic 和 Story 分解。

## Epic Summary

| Epic | Title | Stories | Status | Priority |
|------|-------|---------|--------|----------|
| EPIC-001 | Core Sync Engine | 4 | Ready | P0 |
| EPIC-002 | User Interface | 3 | Ready | P1 |
| EPIC-003 | Conflict Resolution | 2 | Draft | P0 |

## Dependency Graph

```plaintext
EPIC-001 (Core Sync Engine)
    │
    ├── EPIC-002 (User Interface)
    │
    └── EPIC-003 (Conflict Resolution)
```

## MVP Scope

以下 Epic 属于 MVP:
- [ ] EPIC-001: Core Sync Engine
- [ ] EPIC-002: User Interface

**Estimated MVP Duration**: 6 weeks
```

### 简化示例 - EPIC-001.md

```markdown
# EPIC-001: Core Sync Engine

> **Priority**: P0
> **Status**: Ready
> **MVP**: Yes
> **Created**: 2026-03-01

## Description

实现基于 OT 算法的实时文档同步引擎，支持多用户并发编辑。

## Business Value

| Value | Description |
|-------|-------------|
| 无缝协作 | 用户可同时编辑而无需担心冲突 |
| 数据安全 | 自动保存，防止数据丢失 |

## Related Requirements

| Requirement | Relation |
|-------------|----------|
| REQ-001 | Addresses |
| NFR-PERF-001 | Must satisfy |

## Stories

| Story | Title | Points | Status |
|-------|-------|--------|--------|
| STORY-001 | WebSocket Connection | 5 | Todo |
| STORY-002 | Operation Transformer | 8 | Todo |
| STORY-003 | State Persistence | 3 | Todo |
| STORY-004 | Conflict Resolution | 5 | Todo |

### STORY-001: WebSocket Connection

**As a** system,
**I want** to establish WebSocket connections,
**So that** clients can receive real-time updates.

**Acceptance Criteria**:
- [ ] Server accepts WebSocket connections
- [ ] Connection authentication implemented
- [ ] Reconnection logic handles network issues

**Technical Notes**:
- Use ws library for Node.js
- Implement JWT-based authentication
- Store active connections in memory

**Dependencies**:
- None

---

### STORY-002: Operation Transformer

**As a** system,
**I want** to transform concurrent operations,
**So that** conflicts are automatically resolved.

**Acceptance Criteria**:
- [ ] OT transform function implemented
- [ ] Handles insert and delete operations
- [ ] Maintains document consistency

**Technical Notes**:
- Use Yjs library for OT implementation
- Implement transform() function per OT spec

**Dependencies**:
- STORY-001 must complete first

## Estimate

| Category | Estimate |
|----------|----------|
| Development | 10 days |
| Testing | 5 days |
| Documentation | 2 days |
| **Total** | **17 days** |

## Definition of Done

- [ ] All stories completed and tested
- [ ] Unit tests coverage > 80%
- [ ] API documentation complete
- [ ] Performance benchmarks meet NFR-PERF-001
```
