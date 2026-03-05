# 高级技巧

## 一句话定位

**用自然语言驱动 AI 编排工具链** — 语义化 CLI 调用、多模型协作、智能记忆管理。

---

## 5.1 语义化工具调度

### 5.1.1 核心理念

CCW 的 CLI 工具是 **AI 自动调用的能力扩展**，用户只需用自然语言描述需求，AI 会自动选择并调用合适的工具。

::: tip 关键理解
- 用户说："用 Gemini 分析这段代码"
- AI 自动：调用 Gemini CLI + 应用分析规则 + 返回结果
- 用户无需关心 `ccw cli` 命令细节
:::

### 5.1.2 可用工具与能力

| 工具 | 擅长领域 | 典型触发词 |
| --- | --- | --- |
| **Gemini** | 深度分析、架构设计、Bug 诊断 | "用 Gemini 分析"、"深度理解" |
| **Qwen** | 代码生成、功能实现 | "让 Qwen 实现"、"代码生成" |
| **Codex** | 代码审查、Git 操作 | "用 Codex 审查"、"代码评审" |
| **OpenCode** | 开源多模型 | "用 OpenCode" |

### 5.1.3 语义触发示例

只需在对话中自然表达，AI 会自动调用对应工具：

| 目标 | 用户语义描述 | AI 自动执行 |
| :--- | :--- | :--- |
| **安全评估** | "用 Gemini 扫描认证模块的安全漏洞" | Gemini + 安全分析规则 |
| **代码实现** | "让 Qwen 帮我实现一个速率限制中间件" | Qwen + 功能实现规则 |
| **代码审查** | "用 Codex 审查这个 PR 的改动" | Codex + 审查规则 |
| **Bug 诊断** | "用 Gemini 分析这个内存泄漏的根因" | Gemini + 诊断规则 |

### 5.1.4 底层配置（可选了解）

AI 调用工具的配置文件位于 `~/.claude/cli-tools.json`：

```json
{
  "tools": {
    "gemini": {
      "enabled": true,
      "primaryModel": "gemini-2.5-flash",
      "tags": ["分析", "Debug"]
    },
    "qwen": {
      "enabled": true,
      "primaryModel": "coder-model",
      "tags": ["实现"]
    }
  }
}
```

::: info 说明
标签（tags）帮助 AI 根据任务类型自动选择最合适的工具。用户通常无需修改此配置。
:::

---

## 5.2 多模型协作

### 5.2.1 协作模式

通过语义描述，可以让多个 AI 模型协同工作：

| 模式 | 描述方式 | 适用场景 |
| --- | --- | --- |
| **协作型** | "让 Gemini 和 Codex 共同分析架构问题" | 多角度分析同一问题 |
| **流水线型** | "Gemini 设计方案，Qwen 实现，Codex 审查" | 分阶段完成复杂任务 |
| **迭代型** | "用 Gemini 诊断问题，Codex 修复，迭代直到通过测试" | Bug 修复循环 |
| **并行型** | "让 Gemini 和 Qwen 分别给出优化建议" | 对比不同方案 |

### 5.2.2 语义示例

**协作分析**
```
用户：让 Gemini 和 Codex 共同分析 src/auth 模块的安全性和性能问题
AI：[自动调用两个模型，综合分析结果]
```

**流水线开发**
```
用户：我需要实现一个 WebSocket 实时通知功能。
      请 Gemini 设计架构，Qwen 实现代码，最后用 Codex 审查。
AI：[依次调用三个模型，完成设计→实现→审查流程]
```

**迭代修复**
```
用户：测试失败了，用 Gemini 诊断原因，让 Qwen 修复，循环直到测试通过。
AI：[自动迭代诊断-修复流程，直到问题解决]
```

### 5.2.3 模型选择建议

| 任务类型 | 推荐模型 | 理由 |
| --- | --- | --- |
| **架构分析** | Gemini | 擅长深度理解和模式识别 |
| **Bug 诊断** | Gemini | 强大的根因分析能力 |
| **代码生成** | Qwen | 代码生成效率高 |
| **代码审查** | Codex | Git 集成好，审查格式标准 |
| **长文本处理** | Claude | 上下文窗口大 |

---

## 5.3 智能记忆管理

### 5.3.1 记忆系统概述

CCW 的记忆系统是 **AI 自主管理** 的知识库，包括：

| 分类 | 用途 | 示例 |
| --- | --- | --- |
| **learnings** | 学习心得 | 新技术使用经验、最佳实践 |
| **decisions** | 架构决策 | 技术选型理由、设计权衡 |
| **conventions** | 编码规范 | 命名约定、代码风格 |
| **issues** | 已知问题 | Bug 记录、限制说明 |

### 5.3.2 记忆的自动使用

AI 在执行任务时会自动检索和应用相关记忆：

```
用户：帮我实现用户认证模块
AI：[自动检索记忆中的认证相关 decisions 和 conventions]
    根据之前的技术决策，我们使用 JWT + bcrypt 方案...
```

### 5.3.3 用户如何引导记忆

虽然 AI 自动管理记忆，但用户可以主动强化：

**明确要求记住**
```
用户：记住这个命名规范：所有 API 路由使用 kebab-case
AI：[将此规范存入 conventions 记忆]
```

**要求回顾决策**
```
用户：我们之前为什么选择 Redis 做缓存？
AI：[检索 decisions 记忆并回答]
```

**纠正错误记忆**
```
用户：之前的决定改了，我们现在用 PostgreSQL 代替 MongoDB
AI：[更新相关 decision 记忆]
```

### 5.3.4 记忆文件位置

- **全局记忆**: `~/.claude/projects/{project-name}/memory/`
- **项目记忆**: `.claude/memory/` 或 `MEMORY.md`

---

## 5.4 Hook 自动化

### 5.4.1 Hook 概念

Hook 是 AI 执行任务前后的自动化流程，用户无需手动触发：

| Hook 类型 | 触发时机 | 用途 |
| --- | --- | --- |
| **pre-command** | AI 思考前 | 加载项目规范、检索记忆 |
| **post-command** | AI 完成后 | 保存决策、更新索引 |
| **pre-commit** | Git 提交前 | 代码审查、规范检查 |

### 5.4.2 配置示例

在 `.claude/hooks.json` 中配置：

```json
{
  "pre-command": [
    {
      "name": "load-project-specs",
      "description": "加载项目规范",
      "command": "cat .workflow/specs/project-constraints.md"
    }
  ],
  "post-command": [
    {
      "name": "save-decisions",
      "description": "保存重要决策",
      "command": "ccw memory import \"{content}\""
    }
  ]
}
```

---

## 5.5 ACE 语义搜索

### 5.5.1 什么是 ACE

ACE (Augment Context Engine) 是 AI 的 **代码感知能力**，让 AI 能理解整个代码库的语义。

### 5.5.2 AI 如何使用 ACE

当用户提问时，AI 会自动使用 ACE 搜索相关代码：

```
用户：认证流程是怎么实现的？
AI：[通过 ACE 语义搜索 auth 相关代码]
    根据代码分析，认证流程是...
```

### 5.5.3 配置参考

| 配置方式 | 链接 |
| --- | --- |
| **官方文档** | [Augment MCP Documentation](https://docs.augmentcode.com/context-services/mcp/overview) |
| **代理工具** | [ace-tool (GitHub)](https://github.com/eastxiaodong/ace-tool) |

---

## 5.6 语义提示速查

### 常用语义模式

| 目标 | 语义描述示例 |
| --- | --- |
| **分析代码** | "用 Gemini 分析 src/auth 的架构设计" |
| **安全审计** | "用 Gemini 扫描安全漏洞，重点关注 OWASP Top 10" |
| **实现功能** | "让 Qwen 实现一个带缓存的用户仓库" |
| **代码审查** | "用 Codex 审查最近的改动" |
| **Bug 诊断** | "用 Gemini 分析这个内存泄漏的根因" |
| **多模型协作** | "Gemini 设计方案，Qwen 实现，Codex 审查" |
| **记住规范** | "记住：所有 API 使用 RESTful 风格" |
| **回顾决策** | "我们之前为什么选择这个技术栈？" |

### 协作模式速查

| 模式 | 语义示例 |
| --- | --- |
| **协作** | "让 Gemini 和 Codex 共同分析..." |
| **流水线** | "Gemini 设计，Qwen 实现，Codex 审查" |
| **迭代** | "诊断并修复，直到测试通过" |
| **并行** | "让多个模型分别给出建议" |

---

## 下一步

- [最佳实践](ch06-best-practices.md) — 团队协作规范、代码审查流程、文档维护策略
