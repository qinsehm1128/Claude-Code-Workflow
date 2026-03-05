# Product Brief Template

> 用途: 产品简介文档模板，用于 spec-generator Phase 2 输出

## 模板

```markdown
# {Product Name} - Product Brief

> **Generated**: {YYYY-MM-DD}
> **Source**: spec-generator Phase 2
> **Session**: {session-id}

## One-Liner

**简短描述** — 详细说明

## Problem Statement

### Pain Points

| Pain Point | Current State | Impact | Solution |
|------------|---------------|--------|----------|
| Pain Point 1 | 当前问题描述 | 影响程度 | 解决方案概述 |
| Pain Point 2 | 当前问题描述 | 影响程度 | 解决方案概述 |
| Pain Point 3 | 当前问题描述 | 影响程度 | 解决方案概述 |

## Target Audience

### Primary Users

| User Type | Description | Key Needs |
|-----------|-------------|-----------|
| 用户类型1 | 描述 | 核心需求 |
| 用户类型2 | 描述 | 核心需求 |

### Secondary Users

| User Type | Description | Key Needs |
|-----------|-------------|-----------|
| 用户类型 | 描述 | 核心需求 |

## Solution Overview

### Core Value Proposition

一句话描述核心价值主张

### Key Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Feature 1 | 功能描述 | Must/Should/Could |
| Feature 2 | 功能描述 | Must/Should/Could |
| Feature 3 | 功能描述 | Must/Should/Could |

## MoSCoW Analysis

| Category | Features | Rationale |
|----------|----------|-----------|
| **Must Have** | Feature 1, Feature 2 | 核心功能，必须实现 |
| **Should Have** | Feature 3, Feature 4 | 重要功能，尽快实现 |
| **Could Have** | Feature 5 | 有价值的功能，时间允许时实现 |
| **Won't Have** | Feature 6 | 明确不实现的功能 |

## Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| 指标1 | 目标值 | 测量方法 |
| 指标2 | 目标值 | 测量方法 |
| 指标3 | 目标值 | 测量方法 |

## Feasibility Assessment

### Technical Feasibility

- **技术栈**: {技术栈选择}
- **复杂度**: {高/中/低}
- **风险**: {主要技术风险}

### Resource Requirements

| Resource | Estimate | Notes |
|----------|----------|-------|
| 开发时间 | {estimate} | |
| 测试时间 | {estimate} | |
| 其他资源 | {estimate} | |

## Next Steps

1. [ ] Review and approve Product Brief
2. [ ] Proceed to Requirements (PRD) phase
3. [ ] Conduct technical feasibility study

## References

- [Discovery Context](../discovery-context.json)
- [Session Config](../spec-config.json)
```

## 使用说明

1. **触发**: spec-generator Phase 2
2. **输入**: Phase 1 Discovery 结果 + 多 CLI 分析结果
3. **输出**: product-brief.md
4. **验证**: 确保所有必需字段填充完整

---

## 示例

### 简化示例

```markdown
# Real-Time Collaboration Platform - Product Brief

> **Generated**: 2026-03-01
> **Session**: SPEC-rtc-platform-2026-03-01

## One-Liner

**实时协作平台** — 让团队成员能够同时编辑文档并进行实时沟通

## Problem Statement

### Pain Points

| Pain Point | Current State | Impact | Solution |
|------------|---------------|--------|----------|
| 版本冲突 | 多人编辑同一文件时产生冲突 | 降低效率 | OT 算法自动合并 |
| 沟通割裂 | 编辑和沟通在不同工具间切换 | 上下文丢失 | 内嵌即时通讯 |
| 状态不明 | 不知道谁在编辑什么 | 协作混乱 | 实时光标显示 |

## Target Audience

### Primary Users

| User Type | Description | Key Needs |
|-----------|-------------|-----------|
| 内容团队 | 需要协作编辑文档的团队 | 实时同步、冲突解决 |
| 开发团队 | 需要协作编写代码的团队 | 代码合并、审查 |

## MoSCoW Analysis

| Category | Features | Rationale |
|----------|----------|-----------|
| **Must Have** | 实时编辑、冲突解决、用户在线状态 | 核心功能 |
| **Should Have** | 评论系统、版本历史、权限管理 | 重要功能 |
| **Could Have** | AI 辅助编辑、模板系统 | 增值功能 |
| **Won't Have** | 视频通话（使用现有工具） | 非核心 |

## Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| 冲突自动解决率 | >95% | 系统日志统计 |
| 实时延迟 | <200ms | 性能监控 |
| 用户活跃度 | 日活 >1000 | 分析平台 |
```
