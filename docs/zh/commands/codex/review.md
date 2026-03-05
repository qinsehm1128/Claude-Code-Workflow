# Review 提示

## 一句话定位

**Review 提示是代码审查的标准化模板** — 多维度代码质量检查，确保代码符合最佳实践。

## 审查维度

| 维度 | 检查项 | 严重程度 |
| --- | --- | --- |
| **正确性** | 逻辑错误、边界条件、类型安全 | Critical |
| **安全性** | 注入漏洞、认证、输入验证 | Critical |
| **性能** | 算法复杂度、N+1 查询、缓存机会 | High |
| **可维护性** | SOLID 原则、代码重复、命名规范 | Medium |
| **文档** | 注释完整性、README 更新 | Low |

## codex-review

**功能**: 使用 Codex CLI 通过 ccw 端点进行交互式代码审查，支持可配置的审查目标、模型和自定义指令。

**语法**:
```bash
/cli:codex-review [--uncommitted|--base <分支>|--commit <sha>] [--model <模型>] [--title <标题>] [提示]
```

**参数**:
- `--uncommitted`: 审查已暂存、未暂存和未跟踪的更改
- `--base <分支>`: 与基础分支比较更改
- `--commit <sha>`: 审查特定提交引入的更改
- `--model <模型>`: 覆盖默认模型（gpt-5.2, o3, gpt-4.1, o4-mini）
- `--title <标题>`: 审查摘要的可选提交标题

**注意**: 目标标志和提示互斥（见约束部分）

### 审查焦点选择

| 焦点 | 模板 | 关键检查 |
| --- | --- | --- |
| **综合审查** | 通用模板 | 正确性、风格、Bug、文档 |
| **安全焦点** | 安全模板 | 注入、认证、验证、暴露 |
| **性能焦点** | 性能模板 | 复杂度、内存、查询、缓存 |
| **代码质量** | 质量模板 | SOLID、重复、命名、测试 |

### 提示模板

#### 综合审查模板

```
PURPOSE: 综合代码审查以识别问题、改进质量并确保最佳实践；成功 = 可操作的反馈和清晰的优先级
TASK: • 审查代码正确性和逻辑错误 • 检查编码标准和一致性 • 识别潜在 Bug 和边界情况 • 评估文档完整性
MODE: review
CONTEXT: {目标描述} | Memory: 来自 CLAUDE.md 的项目约定
EXPECTED: 结构化审查报告，包含：严重程度级别（Critical/High/Medium/Low）、file:line 引用、具体改进建议、优先级排名
CONSTRAINTS: 关注可操作的反馈
```

#### 安全焦点模板

```
PURPOSE: 安全焦点代码审查以识别漏洞和安全风险；成功 = 所有安全问题记录有修复方案
TASK: • 扫描注入漏洞（SQL、XSS、命令） • 检查认证和授权逻辑 • 评估输入验证和清理 • 识别敏感数据暴露风险
MODE: review
CONTEXT: {目标描述} | Memory: 安全最佳实践、OWASP Top 10
EXPECTED: 安全报告，包含：漏洞分类、适用的 CVE 引用、修复代码片段、风险严重程度矩阵
CONSTRAINTS: 安全优先分析 | 标记所有潜在漏洞
```

#### 性能焦点模板

```
PURPOSE: 性能焦点代码审查以识别瓶颈和优化机会；成功 = 可衡量的改进建议
TASK: • 分析算法复杂度（Big-O） • 识别内存分配问题 • 检查 N+1 查询和阻塞操作 • 评估缓存机会
MODE: review
CONTEXT: {目标描述} | Memory: 性能模式和反模式
EXPECTED: 性能报告，包含：复杂度分析、瓶颈识别、优化建议及预期影响、基准建议
CONSTRAINTS: 性能优化焦点
```

#### 代码质量模板

```
PURPOSE: 代码质量审查以改进可维护性和可读性；成功 = 更清晰、更易维护的代码
TASK: • 评估 SOLID 原则遵守情况 • 识别代码重复和抽象机会 • 审查命名约定和清晰度 • 评估测试覆盖率影响
MODE: review
CONTEXT: {目标描述} | Memory: 项目编码标准
EXPECTED: 质量报告，包含：原则违规、重构建议、命名改进、可维护性评分
CONSTRAINTS: 代码质量和可维护性焦点
```

### 使用示例

#### 直接执行（无交互）

```bash
# 使用默认设置审查未提交的更改
/cli:codex-review --uncommitted

# 与主分支比较
/cli:codex-review --base main

# 审查特定提交
/cli:codex-review --commit abc123

# 使用自定义模型
/cli:codex-review --uncommitted --model o3

# 安全焦点审查
/cli:codex-review --uncommitted security

# 完整选项
/cli:codex-review --base main --model o3 --title "认证功能" security
```

#### 交互模式

```bash
# 启动交互式选择（引导流程）
/cli:codex-review
```

### 约束和验证

**重要**: 目标标志和提示互斥

Codex CLI 有一个约束，目标标志（`--uncommitted`, `--base`, `--commit`）不能与位置 `[PROMPT]` 参数一起使用：

```
error: the argument '--uncommitted' cannot be used with '[PROMPT]'
error: the argument '--base <BRANCH>' cannot be used with '[PROMPT]'
error: the argument '--commit <SHA>' cannot be used with '[PROMPT]'
```

**有效组合**:

| 命令 | 结果 |
| --- | --- |
| `codex review "关注安全"` | ✓ 自定义提示，审查未提交（默认） |
| `codex review --uncommitted` | ✓ 无提示，使用默认审查 |
| `codex review --base main` | ✓ 无提示，使用默认审查 |
| `codex review --commit abc123` | ✓ 无提示，使用默认审查 |
| `codex review --uncommitted "提示"` | ✗ 无效 - 互斥 |
| `codex review --base main "提示"` | ✗ 无效 - 互斥 |
| `codex review --commit abc123 "提示"` | ✗ 无效 - 互斥 |

**有效示例**:
```bash
# ✓ 有效: 仅提示（默认审查未提交）
ccw cli -p "关注安全" --tool codex --mode review

# ✓ 有效: 仅目标标志（无提示）
ccw cli --tool codex --mode review --uncommitted
ccw cli --tool codex --mode review --base main
ccw cli --tool codex --mode review --commit abc123

# ✗ 无效: 目标标志带提示（会失败）
ccw cli -p "审查这个" --tool codex --mode review --uncommitted
```

## 焦点区域映射

| 用户选择 | 提示焦点 | 关键检查 |
| --- | --- | --- |
| 综合审查 | 全面 | 正确性、风格、Bug、文档 |
| 安全焦点 | 安全优先 | 注入、认证、验证、暴露 |
| 性能焦点 | 优化 | 复杂度、内存、查询、缓存 |
| 代码质量 | 可维护性 | SOLID、重复、命名、测试 |

## 错误处理

### 无更改可审查

```
未找到审查目标的更改。建议：
- 对于 --uncommitted: 先进行一些代码更改
- 对于 --base: 确保分支存在并有分歧
- 对于 --commit: 验证提交 SHA 存在
```

### 无效分支

```bash
# 显示可用分支
git branch -a --list | head -20
```

### 无效提交

```bash
# 显示最近提交
git log --oneline -10
```

## 相关文档

- [Prep 提示](./prep.md)
- [CLI 工具命令](../claude/cli.md)
- [代码审查](../../features/spec)
