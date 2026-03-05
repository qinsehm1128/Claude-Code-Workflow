# CodexLens 代码索引

## 一句话定位

**CodexLens 是语义代码搜索引擎** — 基于向量嵌入和 LSP 集成，让 AI 理解代码语义而非仅匹配关键词，支持混合检索和实时引用分析。

## 解决的痛点

| 痛点 | 现状 | CodexLens 方案 |
| --- | --- | --- |
| **搜索不精确** | 关键词搜不到语义相关代码 | 向量嵌入语义搜索 |
| **无上下文** | 搜索结果缺少调用上下文 | LSP 引用链分析 |
| **类型信息缺失** | 不知道符号的定义和引用 | 全局符号索引 |
| **跨文件关联弱** | 看不到模块间依赖关系 | 图扩展搜索 |
| **搜索速度慢** | 大项目搜索响应慢 | HNSW 近似最近邻 |

## 核心概念速览

| 概念 | 说明 | 位置/命令 |
| --- | --- | --- |
| **索引 (Index)** | 代码向量化存储 | `~/.codexlens/indexes/{project}/` |
| **混合检索 (Hybrid)** | 向量 + 关键词 + 结构 | `HybridSearchEngine` |
| **级联搜索 (Cascade)** | 多阶段优化搜索 | `cascade_search()` |
| **全局符号索引** | 跨项目符号数据库 | `GlobalSymbolIndex` |
| **LSP 集成** | 编辑器功能增强 | `codexlens lsp` |
| **嵌入器 (Embedder)** | 向量生成引擎 | `qwen3-embedding-sf` via LiteLLM |

## 使用场景

| 场景 | 搜索方式 | 示例 |
| --- | --- | --- |
| **查找函数** | 语义搜索 | "如何验证用户身份" → `authenticate()` |
| **查找用法** | 引用搜索 | 找到 `Token` 类的所有引用 |
| **查找依赖** | 图扩展 | 找到调用 `AuthService` 的所有模块 |
| **代码审查** | 关键词 + 向量 | "安全问题" → 搜索 `auth`, `password`, `encrypt` |
| **重构支持** | 符号索引 | 找到接口的所有实现 |

## 操作步骤

### 初始化索引

```bash
# 初始化项目索引
codexlens init /path/to/project

# 更新索引（增量）
codexlens update /path/to/project

# 清理索引
codexlens clean /path/to/project
```

### 语义搜索

```bash
# 基础语义搜索
codexlens search "如何验证用户身份"

# 指定项目路径
codexlens search --path /path/to/project "authentication flow"

# 设置结果数量
codexlens search --limit 10 "API endpoint design"

# 纯向量搜索（语义最强）
codexlens search --pure-vector "database connection pool"

# 启用 LSP 图扩展
codexlens search --enable-lsp-graph "auth service"
```

### 级联搜索

```bash
# 二进制级联（默认，最快）
codexlens cascade "auth" --strategy binary

# 二进制 + 重排（平衡）
codexlens cascade "auth" --strategy binary_rerank

# 密集 + 重排（质量最高）
codexlens cascade "auth" --strategy dense_rerank

# 四阶段管道（完整）
codexlens cascade "auth" --strategy staged
```

### LSP 服务器

```bash
# 启动 LSP 服务器
codexlens lsp start /path/to/project

# 查看状态
codexlens lsp status

# 停止服务器
codexlens lsp stop
```

### 向量嵌入

```bash
# 生成嵌入
codexlens embeddings generate /path/to/project

# 使用集中式元数据存储（推荐）
codexlens embeddings generate --centralized /path/to/project

# 检查嵌入状态
codexlens embeddings status /path/to/project

# 删除嵌入
codexlens embeddings delete /path/to/project
```

## 配置说明

### 搜索策略对比

| 策略 | 速度 | 质量 | 适用场景 |
| --- | --- | --- | --- |
| `binary` | 最快 | 中等 | 快速查找，代码意图明确 |
| `binary_rerank` | 快 | 高 | 平衡速度和质量（推荐） |
| `dense_rerank` | 中 | 很高 | 复杂查询，语义模糊 |
| `staged` | 慢 | 最高 | 深度分析，需要上下文 |
| `hybrid` | 中 | 高 | 综合检索（RRF 融合） |

### 融合权重配置

```python
weights = {
    "vector": 0.5,        # 向量相似度权重
    "structural": 0.3,    # 结构相似度权重
    "keyword": 0.2        # 关键词匹配权重
}
```

### 嵌入配置

```python
# codexlens/config.py
embedding_backend = "litellm"      # 嵌入后端
embedding_model = "qwen3-embedding-sf"  # 嵌入模型
embedding_use_gpu = True           # 使用 GPU 加速
chunk_size = 500                   # 分块大小
chunk_overlap = 50                 # 分块重叠
```

## 索引结构

### 目录结构

```
~/.codexlens/
├── indexes/                       # 索引存储
│   └── {project_hash}/
│       └── codex-lens/
│           ├── _index.db          # 主索引数据库
│           ├── _vectors_meta.db   # 向量元数据（集中式）
│           ├── _vectors/          # HNSW 向量索引
│           │   ├── dir1/
│           │   │   └── hnsw_index.bin
│           │   └── dir2/
│           │       └── hnsw_index.bin
│           └── _symbols.db        # 全局符号索引
├── venv/                          # Python 虚拟环境
└── config.yaml                    # 全局配置
```

### 数据库结构

**_index.db** (主索引):
- `chunks`: 代码块表
- `files`: 文件表
- `symbols`: 符号表
- `relationships`: 关系表

**_vectors_meta.db** (向量元数据):
- `chunk_metadata`: 向量块元数据
- `embedding_stats`: 嵌入统计

**_symbols.db** (全局符号):
- `global_symbols`: 跨项目符号
- `symbol_references`: 符号引用

## 搜索流程

### 混合检索流程

```
┌─────────────────────────────────────────────────────────────┐
│                    混合检索流程                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 查询分析                                                │
│     └─ 检测意图: KEYWORD / SEMANTIC / MIXED                │
│                                                             │
│  2. 并行检索                                                │
│     ├─ 精确关键词 (BM25)                                    │
│     ├─ 模糊关键词 (Fuzzy)                                   │
│     └─ 向量相似度 (HNSW ANN)                                │
│                                                             │
│  3. 结果融合 (RRF)                                          │
│     └─ Reciprocal Rank Fusion                              │
│                                                             │
│  4. (可选) LSP 图扩展                                       │
│     └─ 扩展引用链                                           │
│                                                             │
│  5. 重排序                                                  │
│     └─ Cross-encoder / 规则调整                             │
│                                                             │
│  6. 返回结果                                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 级联搜索流程

```
┌─────────────────────────────────────────────────────────────┐
│                    级联搜索流程                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Stage 1: 粗检索 (Coarse Retrieval)                         │
│     ├─ 二进制哈希快速筛选                                   │
│     └─ 返回 top-k 候选 (k=100)                              │
│                           │                                 │
│                           ▼                                 │
│  Stage 2: 精排序 (Fine Reranking)                           │
│     ├─ 密集向量重算相似度                                    │
│     ├─ (可选) Cross-encoder 重排                            │
│     └─ 返回 top-k 结果 (k=20)                               │
│                           │                                 │
│                           ▼                                 │
│  Stage 3: LSP 扩展 (Graph Expansion, staged 策略)           │
│     ├─ 查找符号引用                                         │
│     ├─ 扩展调用链                                           │
│     └─ 聚合去重                                             │
│                           │                                 │
│                           ▼                                 │
│  Stage 4: 聚类 (Clustering, staged 策略)                    │
│     └─ 按文件/模块聚类结果                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## LSP 集成

### 支持的 LSP 功能

| 功能 | 说明 | 命令 |
| --- | --- | --- |
| **跳转到定义** | 跳转到符号定义 | `textDocument/definition` |
| **查找引用** | 查找所有引用 | `textDocument/references` |
| **自动完成** | 代码补全 | `textDocument/completion` |
| **悬停提示** | 显示类型和文档 | `textDocument/hover` |
| **工作区符号** | 搜索所有符号 | `workspace/symbol` |

### 启动 LSP 服务器

```bash
# CLI 启动
codexlens lsp start /path/to/project

# VS Code 集成
# 在 settings.json 中配置:
{
  "codexlens.enabled": true,
  "codexlens.lsp.port": 4389
}
```

## 常见问题

### Q1: 索引速度慢怎么办？

A: 优化策略：
- 使用 GPU 加速 (`embedding_use_gpu = True`)
- 减少分块大小 (`chunk_size = 300`)
- 限制索引范围（排除 `node_modules/`, `dist/` 等）

### Q2: 搜索结果不准确？

A: 调整搜索策略：
- 使用 `dense_rerank` 或 `staged` 策略
- 调整融合权重 (`--vector-weight`, `--structural-weight`)
- 使用纯向量搜索 (`--pure-vector`)

### Q3: LSP 功能不工作？

A: 检查：
```bash
# 检查 LSP 状态
codexlens lsp status

# 查看日志
codexlens lsp start --verbose /path/to/project
```

### Q4: 内存占用过高？

A: 优化配置：
- 减少并发索引数
- 使用增量更新 (`codexlens update`)
- 清理旧索引 (`codexlens clean`)

## 相关功能

- [Memory 记忆系统](./memory.md) — 向量嵌入共享
- [CLI 调用系统](./cli.md) — ccw search 命令
- [Dashboard 面板](./dashboard.md) — 搜索可视化

## 进阶阅读

- 搜索引擎: `codex-lens/src/codexlens/search/`
- 混合检索: `codex-lens/src/codexlens/search/hybrid_search.py`
- 级联搜索: `codex-lens/src/codexlens/search/chain_search.py`
- LSP 服务器: `codex-lens/src/codexlens/lsp/server.py`
- 嵌入器: `codex-lens/src/codexlens/semantic/`
