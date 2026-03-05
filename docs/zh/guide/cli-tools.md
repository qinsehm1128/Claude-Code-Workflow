# CLI 工具配置

为你的开发工作流配置和自定义 CCW CLI 工具。

## 配置文件

CCW CLI 工具在 `~/.claude/cli-tools.json` 中配置：

```json
{
  "version": "3.3.0",
  "tools": {
    "tool-id": {
      "enabled": true,
      "primaryModel": "model-name",
      "secondaryModel": "fallback-model",
      "tags": ["tag1", "tag2"],
      "type": "builtin | api-endpoint | cli-wrapper"
    }
  }
}
```

## 工具类型

### 内置工具

具有所有功能的完整工具：

```json
{
  "gemini": {
    "enabled": true,
    "primaryModel": "gemini-2.5-flash",
    "secondaryModel": "gemini-2.5-pro",
    "tags": ["analysis", "debug"],
    "type": "builtin"
  }
}
```

**功能**：分析 + 写入工具

### API 端点工具

用于专门任务的分析专用工具：

```json
{
  "custom-api": {
    "enabled": true,
    "primaryModel": "custom-model",
    "tags": ["specialized-analysis"],
    "type": "api-endpoint"
  }
}
```

**功能**：仅分析

## CLI 命令格式

### 通用模板

```bash
ccw cli -p "PURPOSE: [目标] + [原因] + [成功标准]
TASK: • [步骤 1] • [步骤 2] • [步骤 3]
MODE: [analysis|write|review]
CONTEXT: @[文件模式] | Memory: [上下文]
EXPECTED: [输出格式]
CONSTRAINTS: [约束]" --tool <tool-id> --mode <mode> --rule <template>
```

### 必需参数

| 参数 | 描述 | 选项 |
|-----------|-------------|---------|
| `--mode <mode>` | **必需** - 执行权限级别 | `analysis`（只读） \| `write`（创建/修改） \| `review`（git 感知审查） |
| `-p <prompt>` | **必需** - 带有结构化模板的任务提示 | - |

### 可选参数

| 参数 | 描述 | 示例 |
|-----------|-------------|---------|
| `--tool <tool>` | 显式工具选择 | `--tool gemini` |
| `--rule <template>` | 加载规则模板以生成结构化提示 | `--rule analysis-review-architecture` |
| `--resume [id]` | 恢复之前的会话 | `--resume` 或 `--resume session-id` |
| `--cd <path>` | 设置工作目录 | `--cd src/auth` |
| `--includeDirs <dirs>` | 包含额外目录（逗号分隔） | `--includeDirs ../shared,../types` |
| `--model <model>` | 覆盖工具的主要模型 | `--model gemini-2.5-pro` |

## 工具选择

### 基于标签的路由

根据任务要求选择工具：

```bash
# 带有 "analysis" 标签的任务路由到 gemini
ccw cli -p "PURPOSE: 调试认证问题
TASK: • 追踪认证流程 • 识别失败点
MODE: analysis" --tool gemini --mode analysis

# 无标签 - 使用第一个启用的工具
ccw cli -p "PURPOSE: 实现功能 X
TASK: • 创建组件 • 添加测试
MODE: write" --mode write
```

### 显式选择

覆盖自动选择：

```bash
ccw cli -p "任务描述" --tool codex --mode write
```

### 规则模板

自动加载结构化提示模板：

```bash
# 架构审查模板
ccw cli -p "分析系统架构" --mode analysis --rule analysis-review-architecture

# 功能实现模板
ccw cli -p "添加 OAuth2 认证" --mode write --rule development-implement-feature
```

## 模型配置

### 主要 vs 备用

```json
{
  "codex": {
    "primaryModel": "gpt-5.2",
    "secondaryModel": "gpt-5.2"
  }
}
```

- **primaryModel**：工具的默认模型
- **secondaryModel**：主要模型失败时的备用

### 可用模型

| 工具 | 可用模型 |
|------|------------------|
| gemini | gemini-3-pro-preview, gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash |
| codex | gpt-5.2 |
| claude | sonnet, haiku |
| qwen | coder-model |

## 工具标签

标签启用自动工具选择：

| 标签 | 用例 |
|-----|----------|
| analysis | 代码审查、架构分析 |
| debug | 错误诊断、故障排除 |
| implementation | 功能开发、代码生成 |
| documentation | 文档生成、技术写作 |
| testing | 测试生成、覆盖率分析 |

## 验证

要验证你的配置，直接检查配置文件：

```bash
cat ~/.claude/cli-tools.json
```

或测试工具可用性：

```bash
ccw cli -p "PURPOSE: 测试工具可用性
TASK: 验证工具是否工作
MODE: analysis" --mode analysis
```

## 故障排除

### 工具不可用

```bash
Error: Tool 'custom-tool' not found
```

**解决方案**：检查工具在配置中是否启用：

```json
{
  "custom-tool": {
    "enabled": true
  }
}
```

### 模型未找到

```bash
Error: Model 'invalid-model' not available
```

**解决方案**：使用可用模型列表中的有效模型名称。

::: info 另见
- [CLI 参考](../cli/commands.md) - CLI 用法
- [模式](#modes) - 执行模式
:::
