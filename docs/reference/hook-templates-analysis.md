# Hook 模板分析报告

> 基于 Claude Code 官方 Hook 规范对 `ccw/frontend` 前端实现的检查

---

## 概要

| 检查项 | 状态 | 严重级别 |
|--------|------|----------|
| 触发器类型支持 | 12/18 支持 | ⚠️ 缺失 6 种 |
| 命令结构格式 | 不合规 | 🔴 CRITICAL |
| 输入读取方式 | 不合规 | 🔴 CRITICAL |
| Bash 脚本跨平台 | 不兼容 | 🟠 ERROR |
| JSON 决策输出 | 合规 | ✅ 正确 |
| Matcher 格式 | 部分问题 | ⚠️ WARNING |

---

## 1. CRITICAL 问题

### 1.1 命令结构：`command` + `args` 数组格式

**官方规范**：使用单一 `command` 字符串
```json
{
  "type": "command",
  "command": "bash .claude/hooks/validate.sh",
  "timeout": 30
}
```

**当前实现**：使用 `command` + `args` 数组
```typescript
command: 'node',
args: ['-e', 'const cp=require("child_process");...']
```

**影响文件**：
- `HookQuickTemplates.tsx` 第 77-229 行（所有 16 个模板）
- `HookWizard.tsx` 第 87-148 行（HOOK_TEMPLATES 对象）

**修复方案**：
```typescript
// 错误格式
command: 'node',
args: ['-e', 'script...']

// 正确格式
command: "node -e 'script...'"
```

---

### 1.2 输入读取：`process.env.HOOK_INPUT` vs stdin

**官方规范**：Hook 输入通过 **stdin** 传入 JSON
```
输入：JSON 通过 stdin 传入
```

**当前实现**：使用环境变量
```javascript
const p=JSON.parse(process.env.HOOK_INPUT||"{}");
```

**影响位置**：
- `HookQuickTemplates.tsx`: 第 93, 120, 133, 146, 172, 184, 228 行

**修复方案**：
```javascript
// Node.js 内联脚本
const fs=require('fs');const p=JSON.parse(fs.readFileSync(0,'utf8')||"{}");

// Bash 脚本
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command')
```

---

## 2. ERROR 问题

### 2.1 Bash 脚本在 Windows 上失败

**问题**：`HookWizard.tsx` 中所有 `danger-*` 模板使用 `bash -c`：
```typescript
command: 'bash',
args: ['-c', 'INPUT=$(cat); CMD=$(echo "$INPUT" | jq -r ...']
```

**失败原因**：
1. Windows 默认没有 `bash`（需要 WSL 或 Git Bash）
2. 使用 Unix 命令：`cat`, `jq`, `grep -qiE`
3. 使用 Unix shell 语法：`$(...)`, `if; then; fi`

**影响模板**：
- `danger-bash-confirm` (第 106-112 行)
- `danger-file-protection` (第 113-119 行)
- `danger-git-destructive` (第 120-126 行)
- `danger-network-confirm` (第 127-133 行)
- `danger-system-paths` (第 134-140 行)
- `danger-permission-change` (第 141-147 行)

**修复方案**：
1. 使用 `node -e` 替代 `bash -c`（跨平台）
2. 或提供 PowerShell 版本的检测脚本
3. 或在运行时检测平台并选择对应脚本

---

### 2.2 平台检测使用浏览器 UA

**问题**：`convertToClaudeCodeFormat` 函数（第 185 行）
```javascript
const isWindows = typeof navigator !== 'undefined' && navigator.userAgent.includes('Win');
```

**错误场景**：用户在 Mac 浏览器中配置，但 Hook 在远程 Windows 机器执行

**修复方案**：从后端 API 获取实际执行平台信息

---

## 3. WARNING 问题

### 3.1 无效 MCP Matcher 格式

**位置**：`HookQuickTemplates.tsx` 第 224 行
```typescript
matcher: 'core_memory'
```

**官方规范**：MCP 工具命名格式 `mcp__<server>__<tool>`
```typescript
// 正确格式
matcher: 'mcp__ccw-tools__core_memory'
```

---

### 3.2 空 Matcher 滥用

**位置**：`HookWizard.tsx` 第 90, 96, 102 行

空 matcher `''` 是有效的，但意味着 Hook 会对该事件类型的所有工具触发。对于 `Stop` 事件没有问题，但需要确认是否为预期行为。

---

### 3.3 引号转义脆弱

**位置**：`HookWizard.tsx` 第 173, 187-191 行

当前转义逻辑：
```javascript
// bash 脚本
const escapedScript = script.replace(/'/g, "'\\''");

// Windows node 脚本
const escapedScript = script.replace(/"/g, '\\"');
```

**问题**：对于包含反引号、`$()`、嵌套引号的复杂脚本可能失败

---

### 3.4 Exit Code 2 未使用

**官方规范**：exit code 2 用于阻止操作并显示反馈

**当前状态**：仅 `block-sensitive-files` 模板使用 `process.exit(2)`，其他 `danger-*` 模板通过 JSON 输出 `permissionDecision` 但未配合 exit code

**修复**：在输出 deny 决策后应使用 `exit 2`
```bash
echo '{"hookSpecificOutput":{...}}' && exit 0  # 当前
echo '{"hookSpecificOutput":{...}}' && exit 2  # 应改为 exit 2 以阻止
```

---

## 4. 触发器类型支持情况

### 4.1 完整支持表

| 触发器 | 代码支持 | UI 过滤器 | 状态 |
|--------|----------|-----------|------|
| SessionStart | ✅ | ✅ | 完整 |
| SessionEnd | ✅ | ❌ | 代码有，UI 无 |
| UserPromptSubmit | ✅ | ✅ | 完整 |
| PreToolUse | ✅ | ✅ | 完整 |
| PostToolUse | ✅ | ✅ | 完整 |
| PostToolUseFailure | ✅ | ❌ | 代码有，UI 无 |
| PermissionRequest | ✅ | ❌ | 代码有，UI 无 |
| Notification | ✅ | ❌ | 代码有，UI 无 |
| Stop | ✅ | ✅ | 完整 |
| SubagentStart | ✅ | ❌ | 代码有，UI 无 |
| SubagentStop | ✅ | ❌ | 代码有，UI 无 |
| PreCompact | ✅ | ❌ | 代码有，UI 无 |
| **TeammateIdle** | ❌ | ❌ | **缺失** |
| **TaskCompleted** | ❌ | ❌ | **缺失** |
| **ConfigChange** | ❌ | ❌ | **缺失** |
| **WorktreeCreate** | ❌ | ❌ | **缺失** |
| **WorktreeRemove** | ❌ | ❌ | **缺失** |

### 4.2 需要添加的触发器

**缺失的 6 种触发器**：
1. `TeammateIdle` - 团队成员空闲时触发
2. `TaskCompleted` - 任务标记完成时触发
3. `ConfigChange` - 配置文件外部修改时触发
4. `WorktreeCreate` - 工作树创建时触发
5. `WorktreeRemove` - 工作树移除时触发

---

## 5. 正确实现的部分

| 项目 | 状态 | 说明 |
|------|------|------|
| 触发器类型名称 | ✅ | 使用的触发器名称符合官方规范 |
| Matcher 正则语法 | ✅ | `Write\|Edit`、`Bash` 等格式正确 |
| Timeout 单位转换 | ✅ | 毫秒→秒转换正确 |
| JSON 决策输出格式 | ✅ | `hookSpecificOutput` 结构符合规范 |
| Bash stdin 读取 | ✅ | `INPUT=$(cat)` 方式正确 |

---

## 6. 修复优先级

### P0 - 必须立即修复 ✅ 已修复
1. **命令格式**：将 `command` + `args` 合并为单一字符串
2. **输入读取**：将 `process.env.HOOK_INPUT` 改为 stdin 读取

### P1 - 尽快修复 ✅ 已修复
3. **Windows 兼容**：将 `bash -c` 脚本改为 `node -e` 或提供 PowerShell 版本
4. **Exit code 2**：在 deny 场景使用正确的 exit code

### P2 - 后续优化
5. **缺失触发器**：添加 6 种缺失的触发器类型支持
6. **UI 过滤器**：将所有支持的触发器添加到过滤器
7. **MCP Matcher**：修正 `core_memory` 为 `mcp__ccw-tools__core_memory` ✅ 已修复
8. **平台检测**：从后端获取实际执行平台

---

## 7. 已完成的修复

### 7.1 后端修复

**文件**: `ccw/src/core/routes/system-routes.ts`
- `installRecommendedHook` 函数 (第 216-231 行)
- 修复：使用官方嵌套格式 `{ matcher: '', hooks: [{ type: 'command', command: '...', timeout: 5 }] }`
- 修复：timeout 从毫秒改为秒

**文件**: `ccw/src/core/routes/hooks-routes.ts`
- 新增 `normalizeHookFormat` 函数
- 自动将旧格式转换为新格式
- 自动将 timeout 从毫秒转换为秒

### 7.2 前端修复

**文件**: `ccw/frontend/src/components/hook/HookQuickTemplates.tsx`
- 所有模板从 `process.env.HOOK_INPUT` 改为 `fs.readFileSync(0, 'utf8')`
- 修复 `memory-sync-dashboard` 的 matcher: `core_memory` → `mcp__ccw-tools__core_memory`

**文件**: `ccw/frontend/src/components/hook/HookWizard.tsx`
- `skill-context-keyword` 和 `skill-context-auto` 模板修复 stdin 读取
- `danger-file-protection` 和 `danger-system-paths` 的 deny 决策使用 exit 2

---

## 7. 文件位置参考

| 文件 | 主要问题 |
|------|----------|
| `src/components/hook/HookQuickTemplates.tsx` | 命令格式、输入读取、MCP matcher |
| `src/components/hook/HookWizard.tsx` | Bash 跨平台、命令格式、平台检测 |
| `src/pages/HookManagerPage.tsx` | 缺失触发器类型、UI 过滤器不完整 |
| `src/components/hook/HookCard.tsx` | HookTriggerType 类型定义不完整 |
