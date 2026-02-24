# CodexLens 配置说明

## 目录结构

```
~/.codexlens/                    # 全局数据目录
├── .env                         # 全局 API 配置 (新增)
├── settings.json                # 运行时设置
├── embedding_lock.json          # 模型锁定文件
├── registry.db                  # 项目注册表
├── indexes/                     # 集中式索引存储
└── venv/                        # Python 虚拟环境

project/
├── .codexlens/                  # 工作区本地目录
│   ├── .env                     # 工作区 API 配置 (覆盖全局)
│   ├── index.db                 # 项目索引数据库
│   ├── cache/                   # 缓存目录
│   └── .gitignore               # 排除敏感文件
└── .env                         # 项目根目录配置
```

## 配置优先级

配置加载顺序 (后者覆盖前者):

| 优先级 | 位置 | 说明 |
|--------|------|------|
| 1 (最低) | `~/.codexlens/.env` | 全局默认配置 |
| 2 | `project/.env` | 项目根目录配置 |
| 3 | `project/.codexlens/.env` | 工作区本地配置 |
| 4 (最高) | 环境变量 | Shell 环境变量 |

## 环境变量

### Embedding 配置

用于 `litellm` 后端的嵌入向量服务:

```bash
# API 密钥
EMBEDDING_API_KEY=your-api-key

# API 基础 URL
EMBEDDING_API_BASE=https://api.example.com/v1

# 嵌入模型名称
EMBEDDING_MODEL=text-embedding-3-small
```

**支持的提供商示例**:

| 提供商 | API Base | 模型示例 |
|--------|----------|----------|
| OpenAI | `https://api.openai.com/v1` | `text-embedding-3-small` |
| ModelScope | `https://api-inference.modelscope.cn/v1` | `Qwen/Qwen3-Embedding-8B` |
| Azure | `https://your-resource.openai.azure.com` | `text-embedding-ada-002` |

### LiteLLM 配置

用于 LLM 功能 (重排序、语义分析等):

```bash
# API 密钥
LITELLM_API_KEY=your-api-key

# API 基础 URL
LITELLM_API_BASE=https://api.example.com/v1

# 模型名称
LITELLM_MODEL=gpt-4o-mini
```

### Reranker 配置

用于搜索结果重排序 (可选):

```bash
# API 密钥
RERANKER_API_KEY=your-api-key

# API 基础 URL
RERANKER_API_BASE=https://api.siliconflow.cn

# 提供商: siliconflow, cohere, jina
RERANKER_PROVIDER=siliconflow

# 重排序模型
RERANKER_MODEL=BAAI/bge-reranker-v2-m3
```

### 通用配置

```bash
# 自定义数据目录 (默认: ~/.codexlens)
CODEXLENS_DATA_DIR=~/.codexlens

# 启用调试模式
CODEXLENS_DEBUG=false
```

## settings.json

运行时设置保存在 `~/.codexlens/settings.json`:

```json
{
  "embedding": {
    "backend": "litellm",
    "model": "Qwen/Qwen3-Embedding-8B",
    "use_gpu": false,
    "endpoints": [
      {
        "model": "Qwen/Qwen3-Embedding-8B",
        "api_key": "${EMBEDDING_API_KEY}",
        "api_base": "${EMBEDDING_API_BASE}",
        "weight": 1.0
      }
    ],
    "strategy": "latency_aware",
    "cooldown": 60.0
  },
  "llm": {
    "enabled": true,
    "tool": "gemini",
    "timeout_ms": 300000,
    "batch_size": 5
  },
  "parsing": {
    "use_astgrep": false
  },
  "indexing": {
    "static_graph_enabled": false,
    "static_graph_relationship_types": ["imports", "inherits"]
  }
}
```

### Embedding 设置

| 字段 | 类型 | 说明 |
|------|------|------|
| `backend` | string | `fastembed` (本地) 或 `litellm` (API) |
| `model` | string | 模型名称或配置文件 |
| `use_gpu` | bool | GPU 加速 (仅 fastembed) |
| `endpoints` | array | 多端点配置 (仅 litellm) |
| `strategy` | string | 负载均衡策略 |
| `cooldown` | float | 限流冷却时间 (秒) |

**Embedding Backend 对比**:

| 特性 | fastembed | litellm |
|------|-----------|---------|
| 运行方式 | 本地 ONNX | API 调用 |
| 依赖 | 本地模型文件 | API 密钥 |
| 速度 | 快 (本地) | 取决于网络 |
| 模型选择 | 预定义配置文件 | 任意 API 模型 |
| GPU 支持 | 是 | N/A |

**负载均衡策略**:

| 策略 | 说明 |
|------|------|
| `round_robin` | 轮询分配 |
| `latency_aware` | 延迟感知 (推荐) |
| `weighted_random` | 加权随机 |

### LLM 设置

| 字段 | 类型 | 说明 |
|------|------|------|
| `enabled` | bool | 启用 LLM 功能 |
| `tool` | string | LLM 工具 (`gemini`, `codex`) |
| `timeout_ms` | int | 超时时间 (毫秒) |
| `batch_size` | int | 批处理大小 |

### Parsing 设置

| 字段 | 类型 | 说明 |
|------|------|------|
| `use_astgrep` | bool | 优先使用 ast-grep 解析关系（实验性；当前主要用于 Python relationships） |

### Indexing 设置（静态图）

| 字段 | 类型 | 说明 |
|------|------|------|
| `static_graph_enabled` | bool | 索引时将 relationships 写入全局 `global_relationships`，用于搜索阶段静态图扩展 |
| `static_graph_relationship_types` | array | 允许持久化的关系类型：`imports` / `inherits` / `calls` |

**CLI 覆盖（单次运行，不写入 settings.json）**:

```bash
# 索引时启用静态图 relationships + 使用 ast-grep（如果可用）
codexlens index init --use-astgrep --static-graph --static-graph-types imports,inherits,calls
```

**Search staged 静态图扩展（高级）**:

```bash
codexlens search --cascade-strategy staged --staged-stage2-mode static_global_graph
```

## FastEmbed 模型配置文件

使用 `fastembed` 后端时的预定义模型:

| 配置文件 | 模型 | 维度 | 大小 |
|----------|------|------|------|
| `fast` | BAAI/bge-small-en-v1.5 | 384 | 80MB |
| `base` | BAAI/bge-base-en-v1.5 | 768 | 220MB |
| `code` | jinaai/jina-embeddings-v2-base-code | 768 | 150MB |
| `minilm` | sentence-transformers/all-MiniLM-L6-v2 | 384 | 90MB |
| `multilingual` | intfloat/multilingual-e5-large | 1024 | 1000MB |
| `balanced` | mixedbread-ai/mxbai-embed-large-v1 | 1024 | 600MB |

## 快速开始

### 1. 使用全局配置

创建 `~/.codexlens/.env`:

```bash
# 复制示例配置
cp codex-lens/.env.example ~/.codexlens/.env

# 编辑配置
nano ~/.codexlens/.env
```

### 2. 使用本地嵌入 (fastembed)

```bash
# 初始化索引 (使用 code 配置文件)
codexlens init --backend fastembed --model code

# 或使用多语言模型
codexlens init --backend fastembed --model multilingual
```

### 3. 使用 API 嵌入 (litellm)

```bash
# 设置环境变量
export EMBEDDING_API_KEY=your-key
export EMBEDDING_API_BASE=https://api.example.com/v1
export EMBEDDING_MODEL=text-embedding-3-small

# 初始化索引
codexlens init --backend litellm --model text-embedding-3-small
```

### 4. 验证配置

```bash
# 检查配置加载
codexlens config show

# 测试嵌入
codexlens test-embedding "Hello World"
```

## 故障排除

### 配置未加载

检查文件权限和路径:

```bash
ls -la ~/.codexlens/.env
cat ~/.codexlens/.env
```

### API 错误

1. 验证 API 密钥有效性
2. 检查 API Base URL 是否正确
3. 确认模型名称匹配提供商支持的模型

### 模型不兼容

如果更换嵌入模型，需要重建索引:

```bash
# 删除旧索引
rm -rf project/.codexlens/

# 重新初始化
codexlens init --backend litellm --model new-model
```

## 相关文件

| 文件 | 说明 |
|------|------|
| `src/codexlens/config.py` | 配置类定义 |
| `src/codexlens/env_config.py` | 环境变量加载 |
| `src/codexlens/cli/model_manager.py` | FastEmbed 模型管理 |
| `src/codexlens/semantic/factory.py` | Embedder 工厂 |
