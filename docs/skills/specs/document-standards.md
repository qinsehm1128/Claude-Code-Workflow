# Document Standards

> 本文档定义 CCW Skills 生态系统中所有文档的格式规范、frontmatter 要求、命名约定和结构标准。

## 概述

本规范确保 CCW Skills 文档的一致性、可维护性和可扩展性。所有文档（包括 Skill 文档、规格文档、模板文档）都应遵循此规范。

## Frontmatter 标准

### 必需字段

所有文档必须包含以下 frontmatter：

```yaml
---
title: "文档标题"
description: "简短描述（一句话）"
version: "1.0.0"
last_updated: "YYYY-MM-DD"
tags: ["tag1", "tag2"]
category: "specification|template|reference"
---
```

### 可选字段

```yaml
---
author: "作者名称"
status: "draft|stable|deprecated"
related_docs:
  - "path/to/related-doc.md"
  - "path/to/another-doc.md"
cli_support:
  - "claude"
  - "codex"
  - "both"
---
```

## 文件命名约定

### 规格文档 (specs/)

| 模式 | 示例 | 用途 |
|------|------|------|
| `{domain}-standards.md` | `quality-standards.md` | 质量标准 |
| `{domain}-gates.md` | `quality-gates.md` | 质量门禁 |
| `{domain}-dimensions.md` | `review-dimensions.md` | 审查维度 |
| `{domain}-classification.md` | `issue-classification.md` | 分类标准 |
| `{domain}-spec.md` | `reference-docs-spec.md` | 参考规范 |

### 模板文档 (templates/)

| 模式 | 示例 | 用途 |
|------|------|------|
| `{document-type}.md` | `product-brief.md` | 产品简介模板 |
| `{workflow-type}.md` | `sequential-phase.md` | 工作流阶段模板 |
| `{output-type}.md` | `review-report.md` | 输出报告模板 |

### Skill 文档

| 模式 | 示例 | 用途 |
|------|------|------|
| `claude-{category}.md` | `claude-meta.md` | Claude 专属技能 |
| `codex-{category}.md` | `codex-workflow.md` | Codex 专属技能 |
| `{concept}.md` | `core-skills.md` | 通用概念文档 |

## 文档结构标准

### 标准章节结构

```markdown
# 标题

> 概述/简介（一句话说明）

## One-Liner

**简短描述** — 详细说明

## Pain Points Solved

| Pain Point | Current State | Solution |
|------------|---------------|----------|
| 问题 | 当前状态 | 解决方案 |

## Skills List / 功能列表

| Skill | Function | Trigger |
|-------|----------|---------|
| 技能名 | 功能描述 | 触发命令 |

## Skills Details / 详细说明

### skill-name

**One-Liner**: 简短描述

**Trigger**:
```shell
/example command
```

**Features**:
- 特性1
- 特性2

**Architecture Overview**:
```plaintext
架构图或流程图
```

## Related Commands / 相关命令

## Best Practices / 最佳实践

## Usage Examples / 使用示例

```bash
# 示例命令
/example usage
```
```

### 规格文档结构

```markdown
# {规范名称}

> 本文档定义 {用途}

## 概述

简要说明规范的目的和范围。

## 规范内容

### {分类1}

| 项目 | 标准 | 说明 |
|------|------|------|
| 项目1 | 标准描述 | 详细说明 |

### {分类2}

...

## 参考

- [相关文档链接](relative/path.md)
- [外部参考](https://example.com)
```

### 模板文档结构

```markdown
# {模板名称}

> 用途: {描述}

## 模板

\`\`\`markdown
{模板内容}
\`\`\`

## 使用说明

1. 步骤1
2. 步骤2
3. 步骤3

## 示例

### 示例标题

\`\`\`markdown
{示例填充内容}
\`\`\`
```

## 格式规范

### 标题层级

| 级别 | 用途 | 示例 |
|------|------|------|
| H1 (#) | 文档标题，每文档仅一次 | `# Document Title` |
| H2 (##) | 主要章节 | `## Overview` |
| H3 (###) | 子章节 | `### Section Name` |
| H4 (####) | 细节说明 | `#### Details` |

### 代码块

| 语言 | 用途 |
|------|------|
| `shell` / `bash` | 命令行示例 |
| `markdown` | Markdown 模板 |
| `plaintext` | 架构图/流程图 |
| `typescript` / `python` | 代码示例 |

### 表格

- 列对齐: 默认左对齐
- 表头: 必须包含
- 说明列: 必要时添加

### 引用块

| 类型 | 语法 | 用途 |
|------|------|------|
| 警告 | `> **⚠️ Warning**: ` | 重要提醒 |
| 注意 | `> **Note**: ` | 补充说明 |
| 不可跳过 | `> **Do not skip**: ` | 必读内容 |
| 概述 | `> 简短描述` | 章节概述 |

## 版本控制

### 版本号格式

```
major.minor.patch
```

- **major**: 重大结构变更
- **minor**: 新增章节或字段
- **patch**: 小修小补

### 更新日志

在文档末尾添加变更记录：

```markdown
## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-01 | Initial version |
| 1.1.0 | 2026-03-15 | Added new section |
```

## 参考

- [CCW Skills Design Spec](../_shared/SKILL-DESIGN-SPEC.md)
- [Markdown Guide](https://www.markdownguide.org/)
- [VitePress Documentation](https://vitepress.dev/)
