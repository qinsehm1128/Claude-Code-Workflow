# Claude Skills - 记忆管理类

## 一句话定位

**记忆管理类 Skills 是跨会话知识持久化系统** — 通过 Memory 压缩、Tips 记录和 Memory 更新实现 AI 记忆项目上下文。

## 解决的痛点

| 痛点 | 现状 | Claude Code Workflow 方案 |
| --- | --- | --- |
| **新会话失忆** | 每次对话需要重新解释项目背景 | Memory 持久化上下文 |
| **知识流失** | 有价值的洞察和决策随会话消失 | Memory 压缩和 Tips 记录 |
| **上下文窗口限制** | 长对话后上下文超出窗口 | Memory 提取和合并 |
| **知识检索困难** | 难以找到历史记录 | Memory 搜索和嵌入 |

## Skills 列表

| Skill | 功能 | 触发方式 |
| --- | --- | --- |
| `memory-capture` | 统一记忆捕获（会话压缩/快速笔记） | `/memory-capture` |
| `memory-manage` | Memory 更新（全量/关联/单条） | `/memory-manage` |

## Skills 详解

### memory-capture

**一句话定位**: 统一记忆捕获 — 会话压缩或快速笔记的双模式路由

**触发**:
```
/memory-capture                              # 交互选择模式
/memory-capture compact                      # 会话压缩模式
/memory-capture tip "Note content"           # 快速笔记模式
/memory-capture "Use Redis" --tag config     # 带标签笔记
```

**功能**:
- 双模式路由：自动检测用户意图，路由到压缩模式或笔记模式
- **Compact 模式**: 压缩完整会话记忆为结构化文本，用于会话恢复
- **Tips 模式**: 快速记录想法、片段、洞察

**架构概览**:
```
┌─────────────────────────────────────────────┐
│  Memory Capture (Router)                    │
│  → 解析输入 → 检测模式 → 路由到阶段         │
└───────────────┬─────────────────────────────┘
                │
        ┌───────┴───────┐
        ↓               ↓
  ┌───────────┐   ┌───────────┐
  │  Compact  │   │   Tips    │
  │  (Phase1) │   │  (Phase2) │
  │  Full     │   │  Quick    │
  │  Session  │   │  Note     │
  └─────┬─────┘   └─────┬─────┘
        │               │
        └───────┬───────┘
                ↓
        ┌───────────────┐
        │  core_memory  │
        │   (import)    │
        └───────────────┘
```

**自动路由规则**（优先级顺序）:
| 信号 | 路由 | 示例 |
|------|------|------|
| 关键词: compact, session, 压缩, recovery | → Compact | "压缩当前会话" |
| 关键词: tip, note, 记录, 快速 | → Tips | "记录一个想法" |
| 有 `--tag` 或 `--context` 标志 | → Tips | `"note content" --tag bug` |
| 短文本 (<100 字符) + 无会话关键词 | → Tips | "Remember to use Redis" |
| 模糊或无参数 | → **AskUserQuestion** | `/memory-capture` |

**Compact 模式**:
- 用途: 压缩当前完整会话记忆（用于会话恢复）
- 输入: 可选 `"session description"` 作为补充上下文
- 输出: 结构化文本 + Recovery ID
- 示例: `/memory-capture compact` 或 `/memory-capture "完成认证模块"`

**Tips 模式**:
- 用途: 快速记录一条笔记/想法/提示
- 输入:
  - 必需: `<note content>` - 笔记文本
  - 可选: `--tag <tag1,tag2>` 分类
  - 可选: `--context <context>` 关联代码/功能引用
- 输出: 确认 + ID + tags
- 示例: `/memory-capture tip "Use Redis for rate limiting" --tag config`

**核心规则**:
1. **单阶段执行**: 每次调用只执行一个阶段 — 不同时执行两个
2. **内容忠实**: 阶段文件包含完整执行细节 — 完全遵循
3. **绝对路径**: 输出中的所有文件路径必须是绝对路径
4. **无摘要**: Compact 模式保留完整计划 — 永不缩写
5. **速度优先**: Tips 模式应该快速 — 最小分析开销

---

### memory-manage

**一句话定位**: Memory 更新 — 全量/关联/单条更新模式

**触发**:
```
/memory-manage                               # 交互模式
/memory-manage full                          # 全量更新
/memory-manage related <query>               # 关联更新
/memory-manage single <id> <content>         # 单条更新
```

**功能**:
- 三种更新模式：全量更新、关联更新、单条更新
- Memory 搜索和嵌入
- Memory 合并和压缩

**更新模式**:
| 模式 | 触发 | 说明 |
|------|------|------|
| **full** | `full` 或 `-f` | 重新生成所有 Memory |
| **related** | `related <query>` 或 `-r <query>` | 更新与查询相关的 Memory |
| **single** | `single <id> <content>` 或 `-s <id> <content>` | 更新单条 Memory |

**Memory 存储**:
- 位置: `C:\Users\dyw\.claude\projects\D--ccw-doc2\memory\`
- 文件: MEMORY.md（主记忆文件，行数超过 200 后截断）
- 主题文件: 按主题组织的独立记忆文件

**Memory 类型**:
| 类型 | 格式 | 说明 |
|------|------|------|
| `CMEM-YYYYMMDD-HHMMSS` | 时间戳格式 | 带时间戳的持久记忆 |
| Topic files | `debugging.md`, `patterns.md` | 按主题组织的记忆 |

**核心规则**:
1. **优先更新**: 在现有记忆上更新，而非写入重复内容
2. **主题组织**: 创建按主题分类的独立记忆文件
3. **删除过时**: 删除最终被证明错误或过时的记忆条目
4. **会话特定**: 不保存会话特定上下文（当前任务、进行中工作、临时状态）

## 相关命令

- [Memory 功能文档](../features/memory.md)
- [CCW CLI Tools](../features/cli.md)

## 最佳实践

1. **会话压缩**: 长对话后使用 `memory-capture compact` 保存完整上下文
2. **快速笔记**: 使用 `memory-capture tip` 快速记录想法和洞察
3. **标签分类**: 使用 `--tag` 为笔记添加标签，便于后续检索
4. **Memory 搜索**: 使用 `memory-manage related <query>` 查找相关记忆
5. **定期合并**: 定期使用 `memory-manage full` 合并和压缩记忆

## Memory 文件结构

```
memory/
├── MEMORY.md                 # 主记忆文件（行数限制）
├── debugging.md              # 调试模式和洞察
├── patterns.md               # 代码模式和约定
├── conventions.md            # 项目约定
└── [topic].md               # 其他主题文件
```

## 使用示例

```bash
# 压缩当前会话
/memory-capture compact

# 快速记录一个想法
/memory-capture tip "Use Redis for rate limiting" --tag config

# 记录带上下文的笔记
/memory-capture "认证模块使用 JWT" --context "src/auth/"

# 更新相关记忆
/memory-manage related "认证"

# 全量更新记忆
/memory-manage full
```
