# Spec 规范系统

## 一句话定位

**Spec 规范系统是项目约束的自动注入机制** — 通过 YAML 前置元数据定义的规范文档，在 AI 会话开始时自动加载相关约束，让 AI 遵守项目编码规范和架构要求。

## 解决的痛点

| 痛点 | 现状 | Spec 规范系统方案 |
| --- | --- | --- |
| **AI 不遵守规范** | CLAUDE.md 写了规范，AI 经常忽略 | 规范按 `readMode: required` 自动强制加载 |
| **规范难以维护** | 所有约束堆在一个文件里 | 按维度 (specs/personal) 和类别 (exploration/planning/execution) 分离 |
| **规范加载不智能** | 每次会话都要手动复制粘贴 | 根据用户 Prompt 关键词自动匹配相关规范 |
| **规范粒度太粗** | 只能全项目或全无 | 支持分类 (general/exploration/planning/execution) 按需加载 |

## 核心概念速览

| 概念 | 说明 | 位置/命令 |
| --- | --- | --- |
| **Dimension (维度)** | 规范所属的分类空间 | `specs` (项目规范) / `personal` (个人偏好) |
| **Category (类别)** | 工作流阶段分类 | `general` / `exploration` / `planning` / `execution` |
| **readMode (读取模式)** | 加载策略 | `required` (强制加载) / `optional` (关键词匹配时加载) |
| **priority (优先级)** | 规范展示顺序 | `critical` / `high` / `medium` / `low` |
| **keywords (关键词)** | 用于自动匹配的标签 | YAML 数组，与用户 Prompt 关键词取交集 |
| **Spec Index** | 规范索引缓存 | `.ccw/.spec-index/{dimension}.index.json` |

## Spec 文件结构

### 规范文件模板

```markdown
---
title: "文档标题"
dimension: "specs"           # 规范维度: specs | personal
category: "general"          # 工作流类别: general | exploration | planning | execution
keywords:
  - keyword1
  - keyword2
readMode: "required"        # 读取模式: required | optional
priority: "high"            # 优先级: critical | high | medium | low
---

# 规范内容（Markdown 正文）

这里是规范的具体内容...
```

### 规范目录结构

```
.cw/
├── specs/                    # 项目规范（维度：specs）
│   ├── coding-conventions.md
│   ├── architecture-constraints.md
│   └── api-design-guidelines.md
├── personal/                 # 个人偏好（维度：personal）
│   ├── coding-style.md
│   └── review-preferences.md
└── .spec-index/             # 索引缓存（自动生成）
    ├── specs.index.json
    └── personal.index.json
```

## 使用场景

| 场景 | 说明 | 配置示例 |
| --- | --- | --- |
| **编码规范** | 强制 AI 遵守项目代码风格 | `dimension: specs`, `readMode: required` |
| **架构约束** | 定义模块边界和依赖规则 | `dimension: specs`, `category: planning` |
| **API 设计** | 规范 API 设计原则 | `dimension: specs`, `keywords: [api, rest, graphql]` |
| **个人偏好** | 个人的代码风格偏好 | `dimension: personal`, `readMode: optional` |

## 操作步骤

### 初始化 Spec 系统

```bash
# 在项目根目录初始化规范系统
ccw spec init
```

**输出**:
```bash
Initializing spec system...

Directories created:
  + .cw/specs/
  + .cw/personal/
  + .cw/.spec-index/

Seed files created:
  + .cw/specs/coding-conventions.md
  + .cw/specs/architecture-constraints.md
```

### 创建规范文件

```bash
# 手动创建规范文件
cat > .cw/specs/api-design.md << 'EOF'
---
title: "API Design Guidelines"
dimension: "specs"
category: "planning"
keywords:
  - api
  - rest
  - endpoint
  - http
readMode: "optional"
priority: "high"
---

# API 设计规范

## RESTful 约定
- 使用名词表示资源
- 使用 HTTP 方法表示操作
- 统一错误响应格式

## 命名约定
- 路径使用 kebab-case
- 查询参数使用 camelCase
EOF
```

### 加载规范

**CLI 模式**（查看规范内容）:

```bash
# 列出所有规范
ccw spec list

# 按维度列出
ccw spec list --dimension specs

# 加载特定类别的规范
ccw spec load --category planning

# 按关键词加载规范
ccw spec load --keywords "api rest"

# 重建索引缓存
ccw spec rebuild
```

**Hook 模式**（自动注入到 AI 上下文）:

在 `settings.json` 中配置 hook:

```json
{
  "hooks": {
    "prePrompt": [
      {
        "type": "command",
        "command": "ccw",
        "args": ["spec", "load", "--stdin"]
      }
    ]
  }
}
```

## 配置说明

### YAML 前置元数据字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | string | 是 | 规范文档标题 |
| `dimension` | string | 是 | 维度：`specs` 或 `personal` |
| `category` | string | 否 | 类别：`general` / `exploration` / `planning` / `execution` |
| `keywords` | string[] | 是 | 关键词列表，用于自动匹配 |
| `readMode` | string | 是 | `required`（强制）或 `optional`（可选） |
| `priority` | string | 否 | 优先级：`critical` / `high` / `medium` / `low` |

### 类别 (category) 说明

| 类别 | 加载时机 | 适用场景 |
| --- | --- | --- |
| `general` | 始终加载（当 readMode=required） | 通用规范，如编码风格、命名约定 |
| `exploration` | 探索阶段 | 架构探索、技术选型指南 |
| `planning` | 规划阶段 | 设计模式、模块划分原则 |
| `execution` | 执行阶段 | 具体实现规范、测试要求 |

## 规范加载机制

### 加载流程

```
┌─────────────────────────────────────────────────────────────┐
│                    Spec 加载流程                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 用户输入 Prompt                                         │
│           │                                                 │
│           ▼                                                 │
│  2. 关键词提取 (extractKeywords)                            │
│           │                                                 │
│           ▼                                                 │
│  3. 读取索引缓存 (getDimensionIndex)                        │
│           │                                                 │
│           ▼                                                 │
│  4. 过滤规范 (filterSpecs)                                  │
│     ├─ required: 全部加载                                   │
│     └─ optional: 关键词匹配时加载                           │
│           │                                                 │
│           ▼                                                 │
│  5. 加载内容 (loadSpecContent)                              │
│           │                                                 │
│           ▼                                                 │
│  6. 按优先级合并 (mergeByPriority)                          │
│           │                                                 │
│           ▼                                                 │
│  7. 格式化输出 (CLI markdown / Hook JSON)                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 关键词匹配规则

- **英文关键词**: 转小写，移除停用词，取长度 >= 3 的词
- **中文关键词**: 提取连续 CJK 字符序列
- **匹配逻辑**: 用户关键词与规范关键词取交集，有交集即匹配

### 优先级合并顺序

```
critical > high > medium > low
```

同优先级内按 `dimension` 优先级：`specs` > `personal`

## 常见问题

### Q1: 规范文件修改后没有生效？

A: 规范内容通过索引缓存加载，修改后需要重建索引：

```bash
ccw spec rebuild
```

### Q2: 如何调试规范加载过程？

A: 使用 `--debug` 参数查看加载详情：

```bash
ccw spec load --keywords "auth" --debug
```

输出示例：
```
[specs] scanned=5 required=2 matched=1
Loaded: coding-conventions (required)
Loaded: auth-security (matched: auth)
Total: scanned=10 loaded=3
```

### Q3: required 和 optional 的区别？

A:
- `required`: 无论用户输入什么，都会加载（适用于通用规范）
- `optional`: 只有当用户 Prompt 包含匹配关键词时才加载（适用于特定场景规范）

### Q4: 个人偏好和项目规范冲突怎么办？

A: 优先级顺序为 `specs` > `personal`。项目规范会覆盖个人偏好。

## 相关功能

- [Memory 记忆系统](./memory.md) — 跨会话知识持久化
- [CLI 调用系统](./cli.md) — ccw spec 命令
- [系统设置](./system-settings.md) — Hook 配置

## 进阶阅读

- 规范索引实现: `ccw/src/tools/spec-index-builder.ts`
- 规范加载器: `ccw/src/tools/spec-loader.ts`
- 关键词提取: `ccw/src/tools/spec-keyword-extractor.ts`
- Dashboard Spec 管理: `ccw/frontend/src/pages/SpecsSettingsPage.tsx`
