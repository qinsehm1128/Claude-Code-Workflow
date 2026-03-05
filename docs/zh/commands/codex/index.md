# Codex Prompts

## 一句话定位

**Codex Prompts 是 Codex CLI 使用的提示模板系统** — 标准化的提示格式确保一致的代码质量和审查效果。

## 核心概念速览

| 概念 | 说明 | 用途 |
| --- | --- | --- |
| **Prep 提示** | 项目上下文准备提示 | 分析项目结构、提取相关文件 |
| **Review 提示** | 代码审查提示 | 多维度代码质量检查 |

## Prompt 列表

### Prep 系列

| 提示 | 功能 | 用途 |
| --- | --- | --- |
| [`memory:prepare`](./prep.md#memory-prepare) | 项目上下文准备 | 为任务准备结构化项目上下文 |

### Review 系列

| 提示 | 功能 | 用途 |
| --- | --- | --- |
| [`codex-review`](./review.md#codex-review) | 交互式代码审查 | 使用 Codex CLI 进行代码审查 |

## Prompt 模板格式

所有 Codex Prompts 遵循标准 CCW CLI 提示模板：

```
PURPOSE: [目标] + [原因] + [成功标准] + [约束/范围]
TASK: • [步骤 1] • [步骤 2] • [步骤 3]
MODE: review
CONTEXT: [审查目标描述] | Memory: [相关上下文]
EXPECTED: [交付格式] + [质量标准]
CONSTRAINTS: [关注约束]
```

## 字段说明

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| **PURPOSE** | 目的和原因 | "识别安全漏洞，确保代码安全" |
| **TASK** | 具体步骤 | "• 扫描注入漏洞 • 检查认证逻辑" |
| **MODE** | 执行模式 | analysis, write, review |
| **CONTEXT** | 上下文信息 | "@CLAUDE.md @src/auth/**" |
| **EXPECTED** | 输出格式 | "结构化报告，包含严重程度级别" |
| **CONSTRAINTS** | 约束条件 | "关注可操作的建议" |

## 相关文档

- [Claude Commands](../claude/)
- [CLI 调用系统](../../features/cli.md)
- [代码审查](../../features/spec)
