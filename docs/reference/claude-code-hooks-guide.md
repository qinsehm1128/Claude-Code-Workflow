# Claude Code Hooks 设计指南（参考文档）

> 基于 2026 年最新官方文档整理，涵盖 18 种 Hook 事件、4 种 Handler 类型

---

## 目录

1. [概念概述](#1-概念概述)
2. [Hook 事件类型（18 种）](#2-hook-事件类型)
3. [配置格式与位置](#3-配置格式与位置)
4. [匹配器规则（Matcher）](#4-匹配器规则)
5. [Handler 类型（4 种）](#5-handler-类型)
6. [环境变量](#6-环境变量)
7. [输入/输出 JSON 格式](#7-输入输出-json-格式)
8. [响应决策控制](#8-响应决策控制)
9. [实用模式与示例](#9-实用模式与示例)
10. [高级特性](#10-高级特性)
11. [故障排除](#11-故障排除)

---

## 1. 概念概述

Hooks 是用户定义的自动化机制，在 Claude Code 生命周期的特定节点自动执行。类似 Git Hooks，但作用于 AI 辅助开发流程。

**核心区别**：

| 机制 | 作用 | 执行保证 |
|------|------|----------|
| **CLAUDE.md** | 引导 Claude 的行为偏好 | 建议性，Claude 可能不遵守 |
| **Hooks** | 强制执行确定性规则 | 确定性，100% 执行 |
| **Skills** | 可复用的指令集 | 按需触发 |
| **Subagents** | 复杂委托任务 | 隔离上下文 |

**适用场景**：文件保护、代码格式化、危险操作拦截、审计日志、桌面通知、上下文注入等。

---

## 2. Hook 事件类型

共 18 种事件，按生命周期分组：

### 会话生命周期

| 事件 | 触发时机 | Matcher 匹配字段 |
|------|----------|------------------|
| `SessionStart` | 会话启动或恢复 | `startup` / `resume` / `clear` / `compact` |
| `SessionEnd` | 会话终止 | `clear` / `logout` / `prompt_input_exit` / `bypass_permissions_disabled` |
| `PreCompact` | 上下文压缩前 | `manual` / `auto` |
| `ConfigChange` | 配置文件外部修改 | `user_settings` / `project_settings` / `local_settings` / `policy_settings` / `skills` |

### 用户交互

| 事件 | 触发时机 | Matcher 匹配字段 |
|------|----------|------------------|
| `UserPromptSubmit` | 用户提交提示词后（处理前）| 无（始终触发）|
| `Notification` | Claude 需要用户注意 | `permission_prompt` / `idle_prompt` / `auth_success` / `elicitation_dialog` |

### 工具执行

| 事件 | 触发时机 | Matcher 匹配字段 |
|------|----------|------------------|
| `PreToolUse` | 工具执行前 | 工具名：`Bash` / `Edit` / `Write` / `Read` / `mcp__.*` |
| `PostToolUse` | 工具执行成功后 | 同上 |
| `PostToolUseFailure` | 工具执行失败后 | 同上 |
| `PermissionRequest` | 权限确认弹窗时 | 同上 |

### Agent 与任务

| 事件 | 触发时机 | Matcher 匹配字段 |
|------|----------|------------------|
| `SubagentStart` | 子代理启动 | Agent 类型：`Bash` / `Explore` / `Plan` / 自定义名 |
| `SubagentStop` | 子代理完成 | 同上 |
| `TeammateIdle` | 团队成员空闲 | 无 |
| `TaskCompleted` | 任务标记完成 | 无 |
| `Stop` | Claude 完成回复 | 无 |

### Worktree

| 事件 | 触发时机 | Matcher 匹配字段 |
|------|----------|------------------|
| `WorktreeCreate` | 工作树创建 | 无 |
| `WorktreeRemove` | 工作树移除 | 无 |

---

## 3. 配置格式与位置

### 配置结构

```json
{
  "hooks": {
    "EventName": [
      {
        "matcher": "regex_pattern",
        "hooks": [
          {
            "type": "command",
            "command": "shell command here",
            "timeout": 30,
            "async": false
          }
        ]
      }
    ]
  },
  "disableAllHooks": false,
  "allowedHttpHookUrls": ["https://hooks.example.com/*"],
  "httpHookAllowedEnvVars": ["MY_TOKEN"]
}
```

### 配置位置与优先级

| 位置 | 作用域 | 可提交 Git | 优先级 |
|------|--------|-----------|--------|
| `~/.claude/settings.json` | 全局（所有项目）| 否 | 最低 (5) |
| `.claude/settings.json` | 单项目 | 是 | 中 (4) |
| `.claude/settings.local.json` | 单项目（本地）| 否（gitignore）| 高 (3) |
| 托管策略设置 | 组织级 | 管理员控制 | 最高 (1) |
| Plugin `hooks/hooks.json` | 插件启用时 | 随插件 | N/A |
| Skill/Agent frontmatter | 组件活跃时 | 随文件 | N/A |

### 配置方式

- **交互式**：在 Claude Code 中输入 `/hooks`
- **手动编辑**：直接修改 settings.json
- **插件**：在 Plugin manifest 中包含 `hooks/hooks.json`

---

## 4. 匹配器规则

Matcher 是正则表达式，根据事件类型匹配不同字段。

### 匹配示例

```json
// 精确匹配单个工具
"matcher": "Bash"

// 匹配多个工具（正则 OR）
"matcher": "Edit|Write"

// 匹配所有 MCP 工具
"matcher": "mcp__.*"

// 匹配特定 MCP 服务器的工具
"matcher": "mcp__github__.*"

// 空匹配器 = 始终触发
"matcher": ""
```

### MCP 工具命名规范

```
mcp__<server_name>__<tool_name>

示例：
- mcp__github__search_repositories
- mcp__filesystem__read_file
- mcp__ace-tool__search_context
```

---

## 5. Handler 类型

### 四种 Handler

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| `command` | 本地 Shell 命令 | 最常用：验证、格式化、通知 |
| `http` | POST 到 HTTP 端点 | 外部服务、团队审计 |
| `prompt` | 单轮 LLM 评估 | 是/否判断、模糊决策 |
| `agent` | 多轮子代理（有工具访问权限）| 复杂验证、文件检查 |

### command 类型

```json
{
  "type": "command",
  "command": "bash .claude/hooks/validate.sh",
  "timeout": 30,
  "async": false
}
```

执行特点：
- **输入**：JSON 通过 stdin 传入
- **输出**：exit code + stdout/stderr
- **工作目录**：会话的当前目录
- **去重**：相同命令只执行一次
- **并行**：同一事件的多个 Hook 并行运行
- **超时**：默认 10 分钟

### http 类型

```json
{
  "type": "http",
  "url": "https://hooks.company.com/claude-events",
  "headers": {
    "Authorization": "Bearer $HOOK_TOKEN"
  },
  "allowedEnvVars": ["HOOK_TOKEN"],
  "timeout": 15
}
```

- 仅 `allowedEnvVars` 中的变量会被解析
- 需在 `allowedHttpHookUrls` 中预先授权 URL

### prompt 类型

```json
{
  "type": "prompt",
  "prompt": "检查此操作是否安全。返回 {\"ok\": true} 或 {\"ok\": false, \"reason\": \"...\"}",
  "model": "haiku"
}
```

### agent 类型

```json
{
  "type": "agent",
  "prompt": "验证所有单元测试通过: $ARGUMENTS",
  "timeout": 120,
  "model": "opus"
}
```

---

## 6. 环境变量

### Hook 脚本可用变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `CLAUDE_PROJECT_DIR` | 项目根目录绝对路径 | `/Users/user/myproject` |
| `CLAUDE_CODE_REMOTE` | 是否远程模式 | `true` / `false` |
| `CLAUDE_ENV_FILE` | 设置会话环境变量的文件路径 | `/tmp/claude-env-xyz` |
| `CLAUDE_SESSION_ID` | 当前会话唯一 ID | `abc123def456` |
| `CLAUDE_FILE_PATHS` | 文件相关 Hook 的文件路径 | `/path/to/file.ts` |

### 在 SessionStart 中设置环境变量

```bash
#!/bin/bash
# 追加到 CLAUDE_ENV_FILE 为会话设置变量
echo 'export NODE_ENV=production' >> "$CLAUDE_ENV_FILE"
echo 'export DEBUG=1' >> "$CLAUDE_ENV_FILE"
```

### Shell Profile 注意事项

Hooks 在非交互式 Shell 中运行，但会 source `~/.zshrc` 或 `~/.bashrc`。若 Profile 中有无条件 `echo`，会污染 JSON 输出：

```bash
# 修复方式：包裹在交互式检测中
if [[ $- == *i* ]]; then
  echo "Shell ready"  # 仅交互式 Shell 执行
fi
```

---

## 7. 输入/输出 JSON 格式

### 通用输入字段（所有事件）

```json
{
  "session_id": "abc123",
  "cwd": "/Users/sarah/myproject",
  "hook_event_name": "PreToolUse",
  "timestamp": "2026-02-27T14:30:00Z"
}
```

### 各事件输入示例

**PreToolUse（Bash）：**
```json
{
  "session_id": "abc123",
  "cwd": "/Users/sarah/myproject",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test"
  }
}
```

**PreToolUse（Edit）：**
```json
{
  "hook_event_name": "PreToolUse",
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "/project/src/app.ts",
    "old_string": "const x = 1;",
    "new_string": "const x = 2;"
  }
}
```

**UserPromptSubmit：**
```json
{
  "hook_event_name": "UserPromptSubmit",
  "prompt": "Fix the authentication bug"
}
```

**PostToolUse：**
```json
{
  "hook_event_name": "PostToolUse",
  "tool_name": "Edit",
  "tool_input": { "file_path": "src/app.ts" },
  "tool_response": "File edited successfully"
}
```

**SessionStart：**
```json
{
  "hook_event_name": "SessionStart",
  "source": "resume",
  "cwd": "/path/to/project"
}
```

**SessionEnd：**
```json
{
  "hook_event_name": "SessionEnd",
  "exit_reason": "clear",
  "duration_seconds": 1234
}
```

**Notification：**
```json
{
  "hook_event_name": "Notification",
  "notification_type": "permission_prompt",
  "message": "Claude Code needs your attention"
}
```

---

## 8. 响应决策控制

### Exit Code 含义

| Code | 含义 | 行为 |
|------|------|------|
| **0** | 成功 | 操作继续。stdout 解析为 JSON 决策 |
| **2** | 阻止 | 操作被阻止。stderr 作为反馈发送给 Claude |
| **其他** | 部分失败 | 操作继续。stderr 仅在 verbose 模式记录 |

### PreToolUse 决策

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "命令安全，自动放行",
    "updatedInput": {
      "command": "rg pattern ."
    }
  }
}
```

| 决策值 | 效果 |
|--------|------|
| `"allow"` | 绕过权限系统，直接执行 |
| `"deny"` | 阻止工具，将原因反馈给 Claude |
| `"ask"` | 向用户显示权限确认弹窗 |

`updatedInput` 可选字段：可修改工具的输入参数（如将 `grep` 替换为 `rg`）。

### PostToolUse / Stop 决策

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "decision": "block",
    "reason": "代码需要审查后才能继续"
  }
}
```

### PermissionRequest 决策

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "approve"
    }
  }
}
```

### TaskCompleted 决策

```json
{
  "hookSpecificOutput": {
    "hookEventName": "TaskCompleted",
    "decision": "block",
    "reason": "任务缺少必要的测试"
  }
}
```

### SessionStart / UserPromptSubmit 输出

```bash
#!/bin/bash
# stdout 内容会注入到 Claude 的上下文中
echo "提醒：使用 Bun 而非 npm。当前冲刺：auth 重构。"
exit 0
```

---

## 9. 实用模式与示例

### 模式 1：阻止危险操作

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/validate-bash.sh"
          }
        ]
      }
    ]
  }
}
```

**validate-bash.sh：**
```bash
#!/bin/bash
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command')

# 阻止危险命令
DANGEROUS_PATTERNS=("rm -rf" "git push --force" "git reset --hard" "DROP TABLE" "mkfs")
for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if [[ "$CMD" == *"$pattern"* ]]; then
    echo "Blocked: 检测到危险命令 '$pattern'" >&2
    exit 2
  fi
done
exit 0
```

### 模式 2：编辑后自动格式化

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write"
          }
        ]
      }
    ]
  }
}
```

### 模式 3：桌面通知

**macOS：**
```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Claude 需要你的注意\" with title \"Claude Code\"'"
          }
        ]
      }
    ]
  }
}
```

**Windows（PowerShell）：**
```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -Command \"[System.Windows.Forms.MessageBox]::Show('Claude needs attention')\""
          }
        ]
      }
    ]
  }
}
```

### 模式 4：保护文件不被修改

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/protect-files.sh"
          }
        ]
      }
    ]
  }
}
```

**protect-files.sh：**
```bash
#!/bin/bash
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

PROTECTED=(".env" "package-lock.json" ".git/" "credentials")

for pattern in "${PROTECTED[@]}"; do
  if [[ "$FILE" == *"$pattern"* ]]; then
    echo "Blocked: $FILE 匹配保护规则 '$pattern'" >&2
    exit 2
  fi
done
exit 0
```

### 模式 5：审计日志

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "http",
            "url": "https://audit.company.com/claude-events",
            "headers": {
              "Authorization": "Bearer $AUDIT_TOKEN"
            },
            "allowedEnvVars": ["AUDIT_TOKEN"],
            "async": true
          }
        ]
      }
    ]
  }
}
```

### 模式 6：压缩后重新注入上下文

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "cat .claude/context-reminder.txt"
          }
        ]
      }
    ]
  }
}
```

### 模式 7：自动放行安全命令

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/auto-approve-safe.sh"
          }
        ]
      }
    ]
  }
}
```

**auto-approve-safe.sh：**
```bash
#!/bin/bash
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command')

SAFE_PREFIXES=("npm test" "npm run lint" "npx prettier" "git status" "git log" "git diff" "ls " "cat ")
for prefix in "${SAFE_PREFIXES[@]}"; do
  if [[ "$CMD" == "$prefix"* ]]; then
    echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","permissionDecisionReason":"Safe command auto-approved"}}'
    exit 0
  fi
done
exit 0  # 非安全命令走正常权限流程
```

### 模式 8：工具输入修改（grep → rg）

```bash
#!/bin/bash
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command')

if [[ "$CMD" == grep* ]]; then
  MODIFIED=$(echo "$CMD" | sed 's/^grep/rg/')
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"allow\",\"updatedInput\":{\"command\":\"$MODIFIED\"}}}"
  exit 0
fi
exit 0
```

---

## 10. 高级特性

### 异步 Hook

```json
{
  "type": "command",
  "command": "node background-task.js",
  "async": true,
  "timeout": 30
}
```

- 异步执行，不阻塞 Claude
- 完成后若返回包含 `systemMessage` 或 `additionalContext` 的 JSON，会在下一轮传递给 Claude

### HTTP Hook 安全配置

```json
{
  "allowedHttpHookUrls": ["https://hooks.example.com/*"],
  "httpHookAllowedEnvVars": ["HOOK_TOKEN", "HOOK_SECRET"],
  "allowManagedHooksOnly": false
}
```

### Stop Hook 防循环

```json
{
  "hook_event_name": "Stop",
  "stop_hook_active": true  // 此字段为 true 时表示当前在 Stop Hook 链中
}
```

Hook 脚本应检查此字段避免无限循环：

```bash
#!/bin/bash
INPUT=$(cat)
ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
if [[ "$ACTIVE" == "true" ]]; then
  exit 0  # 已在 Stop Hook 链中，不再触发
fi
# ... 正常逻辑
```

---

## 11. 故障排除

| 问题 | 解决方案 |
|------|----------|
| Hook 未触发 | 检查 `/hooks` 菜单；验证 matcher 正则（区分大小写）；确认事件类型正确 |
| "command not found" | 使用绝对路径或 `$CLAUDE_PROJECT_DIR` |
| JSON 校验失败 | 修复 Shell Profile（无条件 echo）；包裹在 `if [[ $- == *i* ]]` 中 |
| Hook 超时 | 增加 `timeout` 字段（秒）；优化脚本性能 |
| Hook 错误显示 | 手动测试：`echo '{"tool_name":"Bash"}' \| ./hook.sh` |
| Stop Hook 死循环 | 检查 `stop_hook_active` 字段；为 true 时提前退出 |
| 异步输出丢失 | 确保 Hook 退出时输出包含 `additionalContext` 的有效 JSON |
| 权限不足 | 确保脚本有执行权限：`chmod +x .claude/hooks/*.sh` |

---

## 参考来源

- [Hooks Reference - Claude Code Docs](https://docs.anthropic.com/en/docs/claude-code/hooks)
- [Hooks Guide - Claude Code Docs](https://docs.anthropic.com/en/docs/claude-code/hooks-guide)
- [Settings Reference - Claude Code Docs](https://docs.anthropic.com/en/docs/claude-code/settings)
- [Claude Code Best Practices](https://docs.anthropic.com/en/docs/claude-code/best-practices)
