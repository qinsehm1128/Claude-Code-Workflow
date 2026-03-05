# Memory 记忆系统

## 一句话定位

**Memory 记忆系统是跨会话知识持久化引擎** — 让 AI 记住项目架构、编码规范和过往决策，新会话自动继承上下文，避免重复解释项目背景。

## 解决的痛点

| 痛点 | 现状 | Memory 记忆系统方案 |
| --- | --- | --- |
| **AI 不理解项目** | 新会话要重新解释项目背景 | Memory 持久化项目上下文 |
| **决策丢失** | AI 的架构决策下次会话就忘了 | Memory 记录架构决策和设计模式 |
| **规范重复** | 每次都要强调编码规范 | CLAUDE.md 自动加载到 Memory |
| **搜索困难** | 找不到之前的讨论内容 | 向量搜索语义相关记忆 |

## 核心概念速览

| 概念 | 说明 | 命令/位置 |
| --- | --- | --- |
| **Core Memory** | 核心记忆，存储项目级知识 | `ccw core-memory` |
| **Memory ID** | 记忆唯一标识，格式 `CMEM-YYYYMMDD-HHMMSS` | 自动生成 |
| **Memory Cluster** | 记忆集群，相关记忆分组 | `.cw/memory/clusters/` |
| **Embedding** | 向量嵌入，支持语义搜索 | `core_memory(operation="embed")` |
| **Stage1 Output** | 会话原始输出，用于提取 | Memory V2 管道 |
| **Extraction Job** | 记忆提取任务，后台异步执行 | `ccw core-memory jobs` |

## 使用场景

| 场景 | 说明 | 操作 |
| --- | --- | --- |
| **架构决策** | 记录重要技术决策 | `core_memory(operation="import", text="决策内容")` |
| **编码规范** | 持久化 CLAUDE.md | 自动导入 |
| **设计模式** | 记录项目使用的设计模式 | 手动添加带标签的记忆 |
| **跨会话上下文** | 新会话加载项目记忆 | 自动加载（通过 hook） |

## 操作步骤

### Memory V2 管道

Memory V2 采用两阶段提取管道：

```
┌─────────────────────────────────────────────────────────────┐
│                   Memory V2 提取管道                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Phase 1: 会话结束后提取 (Rollout Extraction)               │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐ │
│  │ 会话结束    │ -> │ 压缩 Transcript│ -> │ Stage1 Output  │ │
│  └─────────────┘    └──────────────┘    └────────────────┘ │
│                           │                                 │
│                           ▼                                 │
│                    提取任务调度器                           │
│                           │                                 │
│  Phase 2: 后台合并 (Consolidation)                          │
│  ┌───────────────┐    ┌──────────────┐    ┌─────────────┐│
│  │ 多个 Stage1   │ -> │ LLM 合并提取  │ -> │ Core Memory  ││
│  └───────────────┘    └──────────────┘    └─────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 基础 Memory 操作

```bash
# 列出所有记忆
ccw core-memory list

# 列出特定标签的记忆
ccw core-memory list --tags "auth,api"

# 导入新记忆
ccw core-memory import --text "项目使用 JWT 进行身份验证，Token 有效期 24 小时"

# 导出记忆内容
ccw core-memory export --id CMEM-20240215-143000

# 生成 AI 摘要
ccw core-memory summary --id CMEM-20240215-143000 --tool gemini

# 搜索记忆（语义搜索）
ccw core-memory search --query "身份验证" --top-k 5

# 删除记忆
ccw core-memory delete --id CMEM-20240215-143000
```

### Memory 管理

```bash
# 查看提取任务状态
ccw core-memory jobs

# 查看特定类型的任务
ccw core-memory jobs --type phase1_extraction

# 按状态筛选
ccw core-memory jobs --status pending

# 手动触发提取
ccw core-memory extract --max-sessions 10

# 手动触发合并
ccw core-memory consolidate
```

### MCP 工具调用

在 Claude Code 中使用 MCP 工具：

```typescript
// 列出记忆
core_memory(operation="list")

// 带标签筛选
core_memory(operation="list", tags=["auth", "security"])

// 导入记忆
core_memory(operation="import", text="重要内容")

// 导出记忆
core_memory(operation="export", id="CMEM-xxx")

// 生成摘要
core_memory(operation="summary", id="CMEM-xxx", tool="gemini")

// 生成嵌入
core_memory(operation="embed", source_id="CMEM-xxx")

// 语义搜索
core_memory(operation="search", query="authentication", top_k=10, min_score=0.3)

// 检查嵌入状态
core_memory(operation="embed_status")

// 触发提取
core_memory(operation="extract", max_sessions=10)

// 检查提取状态
core_memory(operation="extract_status")

// 触发合并
core_memory(operation="consolidate")

// 检查合并状态
core_memory(operation="consolidate_status")

// 列出任务
core_memory(operation="jobs", kind="extraction", status_filter="pending")
```

## 配置说明

### Memory V2 配置 (memory-v2-config.ts)

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `MAX_RAW_MEMORY_CHARS` | 300,000 | Stage1 原始记忆最大字符数 |
| `MAX_SUMMARY_CHARS` | 1,200 | 摘要最大字符数 |
| `MAX_ROLLOUT_BYTES_FOR_PROMPT` | 1,000,000 | 发送给 LLM 的最大字节数 |
| `MAX_RAW_MEMORIES_FOR_GLOBAL` | 64 | 合并时包含的原始记忆数量 |

### 存储路径

```
.cw/
├── memory/
│   ├── core-memory.db          # SQLite 数据库
│   ├── clusters/               # 记忆集群
│   └── embeddings/             # 向量嵌入
```

### Memory 数据结构

```typescript
interface CoreMemory {
  id: string;                // CMEM-YYYYMMDD-HHMMSS
  content: string;           // 记忆内容
  summary: string | null;    // AI 生成摘要
  raw_output?: string;       // 原始输出（V2）
  created_at: string;        // ISO timestamp
  updated_at: string;        // ISO timestamp
  archived: boolean;         // 是否归档
  metadata?: string;         // JSON 元数据
  tags?: string[];           // 标签数组
}
```

## Dashboard 中的 Memory 管理

### Core Memory 视图

Dashboard 提供 Memory 可视化管理界面：

```
┌─────────────────────────────────────────────────────────────┐
│                    Core Memory 视图                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ 记忆列表         │  │ 记忆详情/编辑    │                  │
│  │ - 搜索          │  │ - 内容显示       │                  │
│  │ - 标签筛选      │  │ - 标签管理       │                  │
│  │ - 排序          │  │ - 摘要生成       │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 提取任务状态                                          │  │
│  │ - Pending/Running/Done/Error 计数                    │  │
│  │ - 任务列表                                            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 操作功能

- **浏览记忆**: 分页列表，支持搜索和标签筛选
- **编辑记忆**: 直接修改内容，自动更新时间戳
- **生成摘要**: 一键调用 AI 生成摘要
- **管理标签**: 添加/删除标签
- **删除记忆**: 软删除（归档）或硬删除

## 常见问题

### Q1: Memory 和 CLAUDE.md 的区别？

A:
- **CLAUDE.md**: 静态配置文件，手动编写，每次会话完整加载
- **Memory**: 动态数据库，自动/手动积累，按需搜索和加载

### Q2: 如何让 AI 在新会话中自动加载 Memory？

A: 在 `settings.json` 中配置 hook：

```json
{
  "hooks": {
    "prePrompt": [
      {
        "type": "mcp",
        "server": "cw-tools",
        "tool": "core_memory",
        "args": {
          "operation": "search",
          "query": "{{userPrompt}}",
          "top_k": 5
        }
      }
    ]
  }
}
```

### Q3: Memory V2 管道何时触发？

A: 管道自动触发时机：
- **Phase 1**: 会话结束时自动提取（如果启用）
- **Phase 2**: 当 Stage1 outputs 数量达到阈值时自动合并

手动触发：
```bash
ccw core-memory extract
ccw core-memory consolidate
```

### Q4: 嵌入搜索需要什么条件？

A: 需要安装 CodexLens Python 环境：

```bash
# 检查嵌入状态
ccw core-memory embed-status

# 生成嵌入
ccw core-memory embed --source-id CMEM-xxx
```

## 相关功能

- [Spec 规范系统](./spec.md) — 规范自动注入
- [CLI 调用系统](./cli.md) — ccw core-memory 命令
- [CodexLens 代码索引](./codexlens.md) — 向量嵌入引擎

## 进阶阅读

- Memory 存储实现: `ccw/src/core/core-memory-store.ts`
- 提取管道: `ccw/src/core/memory-extraction-pipeline.ts`
- 任务调度器: `ccw/src/core/memory-job-scheduler.ts`
- 嵌入桥接: `ccw/src/core/memory-embedder-bridge.ts`
- MCP 工具: `ccw/src/tools/core-memory.ts`
