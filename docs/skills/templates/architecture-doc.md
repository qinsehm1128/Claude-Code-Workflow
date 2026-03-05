# Architecture Doc Template

> 用途: 架构文档模板，用于 spec-generator Phase 4 输出

## 模板

### _index.md 模板

```markdown
# Architecture - Index

> **Product**: {Product Name}
> **Generated**: {YYYY-MM-DD}
> **Session**: {session-id}

## Overview

架构概述（2-3 段）

## Architecture Principles

1. **Principle 1**: Description
2. **Principle 2**: Description
3. **Principle 3**: Description

## System Architecture

### High-Level Architecture

```plaintext
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  Web UI  │  │  Mobile  │  │   API    │      │
│  └──────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│                  Backend Layer                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Gateway  │  │ Services │  │  Events  │      │
│  └──────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│                  Data Layer                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  | Database │  │   Cache  │  │  Storage │      │
│  └──────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────┘
```

## Components

| Component | Responsibility | Technology |
|-----------|----------------|------------|
| Component 1 | 描述 | 技术栈 |
| Component 2 | 描述 | 技术栈 |
| Component 3 | 描述 | 技术栈 |

## Technology Stack

### Frontend

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | {framework} | 选择理由 |
| State | {state lib} | 选择理由 |
| UI | {ui lib} | 选择理由 |

### Backend

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Runtime | {runtime} | 选择理由 |
| Framework | {framework} | 选择理由 |
| Database | {database} | 选择理由 |

## Architecture Decisions

详见各 ADR 文档：
- [ADR-001-{title}](./ADR-001-{slug}.md)
- [ADR-002-{title}](./ADR-002-{slug}.md)

## Requirements Traceability

| Requirement | ADR | Component |
|-------------|-----|-----------|
| REQ-001 | ADR-001 | Service A |
| REQ-002 | ADR-002 | Service B |

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | YYYY-MM-DD | Initial version |
```

---

### ADR-*.md 模板

```markdown
# ADR-{NNN}: {Decision Title}

> **Status**: {Accepted|Deprecated|Superseded}
> **Date**: {YYYY-MM-DD}
> **Decision Type**: {Technical|Process|Architecture}

## Context

描述背景和问题：
- 当前状况
- 需要解决的问题
- 约束条件

## Decision

**决策内容**: 一句话概括

详细说明决策内容

### Options Considered

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Option 1 | 优点 | 缺点 | No |
| Option 2 | 优点 | 缺点 | **Yes** |
| Option 3 | 优点 | 缺点 | No |

### Rationale

选择此方案的原因：
1. Reason 1
2. Reason 2
3. Reason 3

## Consequences

### Positive

- Benefit 1
- Benefit 2

### Negative

- Risk 1
- Risk 2

### Mitigation

如何缓解负面影响

## Related Requirements

| Requirement | Relation |
|-------------|----------|
| REQ-001 | Enables |
| NFR-PERF-001 | Addresses |

## Alternatives Considered

1. Alternative 1: Description - Rejected because...
2. Alternative 2: Description - Rejected because...

## References

- [Related Doc](path)
- [External Reference](url)
```

## 使用说明

1. **触发**: spec-generator Phase 4
2. **输入**: Phase 3 Requirements (PRD)
3. **输出**: architecture/ 目录，包含 _index.md 和所有 ADR 文件
4. **验证**: 确保追溯链接有效

---

## 示例

### 简化示例 - ADR-001.md

```markdown
# ADR-001: Use Operational Transformation for Real-Time Sync

> **Status**: Accepted
> **Date**: 2026-03-01
> **Decision Type**: Technical

## Context

实时协作平台需要支持多用户同时编辑同一文档。
- 简单的"最后写入胜出"策略会导致数据丢失
- 需要自动解决编辑冲突
- 网络延迟和离线编辑需要支持

## Decision

**决策内容**: 使用 Operational Transformation (OT) 算法实现实时同步

OT 通过转换操作序列来解决冲突，确保最终一致性。

### Options Considered

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Last Write Wins | 简单 | 数据丢失 | No |
| OT (Yjs) | 成熟方案 | 复杂度高 | **Yes** |
| CRDT | 理论优雅 | 性能开销 | No |

### Rationale

1. **成熟度**: Yjs 是成熟的 OT 实现，被广泛应用
2. **性能**: OT 比 CRDT 性能更好，适合文档编辑场景
3. **社区**: 活跃的社区支持和丰富的集成

## Consequences

### Positive

- 自动解决冲突，无需用户干预
- 支持离线编辑，重连后自动同步
- 低延迟，良好的用户体验

### Negative

- 实现复杂，学习曲线陡峭
- 需要维护操作历史，内存开销

### Mitigation

- 使用成熟的 Yjs 库，降低实现复杂度
- 实现历史压缩策略，控制内存使用

## Related Requirements

| Requirement | Relation |
|-------------|----------|
| REQ-001 | Enables |
| NFR-PERF-001 | Addresses |
```
