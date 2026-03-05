# Codex Skills - 专项类

## 一句话定位

**专项类 Codex Skills 是特定领域的专用工具集** — 通过代码清理、数据管道、内存管理、CLI 工具和 Issue 发现等专项技能，解决特定领域的特定问题。

## Skills 列表

| Skill | 功能 | 触发方式 |
| --- | --- | --- |
| `clean` | 智能代码清理 | `/clean <target>` |
| `csv-wave-pipeline` | CSV 波处理管道 | `/csv-wave-pipeline <csv-file>` |
| `memory-compact` | Memory 压缩 | `/memory-compact` |
| `ccw-cli-tools` | CLI 工具执行规范 | `/ccw-cli-tools <command>` |
| `issue-discover` | Issue 发现 | `/issue-discover <context>` |

## Skills 详解

### clean

**一句话定位**: 智能代码清理 — 自动化代码清理、格式化、死代码移除

**功能**:
- 自动化代码清理
- 代码格式化
- 死代码移除
- 导入排序
- 注释整理

**清理类型**:
| 类型 | 说明 |
|------|------|
| **格式化** | 代码格式统一 |
| **死代码** | 移除未使用的代码 |
| **导入** | 排序和移除未使用导入 |
| **注释** | 整理和移除过时注释 |
| **命名** | 统一命名约定 |

**使用示例**:
```bash
# 清理当前目录
/clean .

# 清理特定目录
/clean src/

# 只格式化
/clean --format-only src/

# 只移除死代码
/clean --dead-code-only src/
```

---

### csv-wave-pipeline

**一句话定位**: CSV 波处理管道 — CSV 数据处理、波次处理、数据转换和导出

**功能**:
- CSV 数据读取和解析
- 波次处理（分批处理大数据）
- 数据转换和验证
- 导出为多种格式

**处理流程**:
```
读取 CSV → 验证数据 → 波次处理 → 转换数据 → 导出结果
```

**输出格式**:
| 格式 | 说明 |
|------|------|
| CSV | 标准 CSV 格式 |
| JSON | JSON 数组 |
| NDJSON | NDJSON（每行一个 JSON） |
| Excel | Excel 文件 |

**使用示例**:
```bash
# 处理 CSV
/csv-wave-pipeline data.csv

# 指定输出格式
/csv-wave-pipeline data.csv --output-format=json

# 指定波次大小
/csv-wave-pipeline data.csv --batch-size=1000
```

---

### memory-compact

**一句话定位**: Memory 压缩（Codex 版本） — Memory 压缩和合并、清理冗余数据、优化存储

**功能**:
- Memory 压缩和合并
- 清理冗余数据
- 优化存储
- 生成 Memory 摘要

**压缩类型**:
| 类型 | 说明 |
|------|------|
| **合并** | 合并相似条目 |
| **去重** | 移除重复条目 |
| **归档** | 归档旧条目 |
| **摘要** | 生成摘要 |

**使用示例**:
```bash
# 压缩 Memory
/memory-compact

# 合并相似条目
/memory-compact --merge

# 生成摘要
/memory-compact --summary
```

---

### ccw-cli-tools

**一句话定位**: CLI 工具执行规范 — CLI 工具标准化执行、参数规范、输出格式统一

**功能**:
- CLI 工具标准化执行
- 参数规范
- 输出格式统一
- 错误处理

**支持的 CLI 工具**:
| 工具 | 说明 |
|------|------|
| gemini | Gemini CLI |
| codex | Codex CLI |
| claude | Claude CLI |
| qwen | Qwen CLI |

**执行规范**:
```javascript
{
  "tool": "gemini",
  "mode": "write",
  "prompt": "...",
  "context": "...",
  "output": "..."
}
```

**使用示例**:
```bash
# 执行 CLI 工具
/ccw-cli-tools --tool=gemini --mode=write "Implement feature"

# 批量执行
/ccw-cli-tools --batch tasks.json
```

---

### issue-discover

**一句话定位**: Issue 发现 — 从上下文发现 Issue、Issue 分类、优先级评估

**功能**:
- 从上下文发现 Issue
- Issue 分类
- 优先级评估
- 生成 Issue 报告

**Issue 类型**:
| 类型 | 说明 |
|------|------|
| **Bug** | 缺陷或错误 |
| **Feature** | 新功能请求 |
| **Improvement** | 改进建议 |
| **Task** | 任务 |
| **Documentation** | 文档问题 |

**优先级评估**:
| 优先级 | 标准 |
|--------|------|
| **Critical** | 阻塞性问题 |
| **High** | 重要问题 |
| **Medium** | 一般问题 |
| **Low** | 低优先级 |

**使用示例**:
```bash
# 从代码库发现 Issue
/issue-discover src/

# 从文档发现 Issue
/issue-discover docs/

# 从测试结果发现 Issue
/issue-discover test-results/
```

## 相关命令

- [Codex Skills - 生命周期](./codex-lifecycle.md)
- [Codex Skills - 工作流](./codex-workflow.md)
- [Claude Skills - 元技能](./claude-meta.md)

## 最佳实践

1. **代码清理**: 定期使用 `clean` 清理代码
2. **数据处理**: 使用 `csv-wave-pipeline` 处理大数据
3. **Memory 管理**: 定期使用 `memory-compact` 优化 Memory
4. **CLI 工具**: 使用 `ccw-cli-tools` 标准化 CLI 执行
5. **Issue 发现**: 使用 `issue-discover` 发现和分类 Issue

## 使用示例

```bash
# 清理代码
/clean src/

# 处理 CSV
/csv-wave-pipeline data.csv --output-format=json

# 压缩 Memory
/memory-compact --merge

# 执行 CLI 工具
/ccw-cli-tools --tool=gemini "Analyze code"

# 发现 Issue
/issue-discover src/
```
