# Codex MCP 安装测试指南

## 测试准备

### 前置条件
1. 确保 CCW Dashboard 正在运行
2. 打开浏览器访问 Dashboard 界面
3. 导航到 "MCP 管理" 页面

### 测试环境
- **Codex 配置文件**: `~/.codex/config.toml`
- **Claude 配置文件**: `~/.claude.json`
- **Dashboard URL**: `http://localhost:3000`

---

## 测试场景 1: Codex MCP 新建安装

### 测试步骤

1. **切换到 Codex 模式**
   - 点击页面顶部的 "Codex" 按钮（橙色高亮）
   - 确认右侧显示配置文件路径：`~/.codex/config.toml`

2. **查看 CCW Tools MCP 卡片**
   - ✅ 验证卡片有橙色边框 (`border-orange-500`)
   - ✅ 验证图标背景是橙色 (`bg-orange-500`)
   - ✅ 验证图标颜色是白色
   - ✅ 验证"Available"徽章是橙色
   - ✅ 验证"Core only"/"All"按钮是橙色

3. **选择工具并安装**
   - 勾选需要的工具（例如：所有核心工具）
   - 点击橙色的"Install"按钮
   - **预期结果**:
     - 屏幕底部中央显示 Toast 消息
     - Toast 消息内容：`"CCW Tools installed to Codex (X tools)"` (X 为选择的工具数量)
     - Toast 消息类型：绿色成功提示
     - Toast 显示时间：3.5秒
     - 卡片状态更新为"已安装"（绿色对勾徽章）
     - 安装按钮文字变为"Update"

4. **验证安装结果**
   - 打开 `~/.codex/config.toml` 文件
   - 确认存在 `[mcp_servers.ccw-tools]` 配置块
   - 示例配置：
     ```toml
     [mcp_servers.ccw-tools]
     command = "npx"
     args = ["-y", "ccw-mcp"]
     env = { CCW_ENABLED_TOOLS = "write_file,edit_file,codex_lens,smart_search" }
     ```

### 测试数据记录

| 测试项 | 预期结果 | 实际结果 | 状态 |
|--------|----------|----------|------|
| 卡片样式（橙色边框） | ✅ | _待填写_ | ⬜ |
| 图标样式（橙色背景） | ✅ | _待填写_ | ⬜ |
| Toast 消息显示 | ✅ 3.5秒 | _待填写_ | ⬜ |
| Toast 消息内容 | "CCW Tools installed to Codex (X tools)" | _待填写_ | ⬜ |
| config.toml 文件创建 | ✅ | _待填写_ | ⬜ |
| MCP 服务器配置正确 | ✅ | _待填写_ | ⬜ |

---

## 测试场景 2: 从 Claude MCP 复制到 Codex

### 测试步骤

1. **前置准备：在 Claude 模式下创建 MCP 服务器**
   - 切换到 "Claude" 模式
   - 在"全局可用 MCP"区域点击"+ New Global Server"
   - 创建测试服务器：
     - **名称**: `test-mcp-server`
     - **命令**: `npx`
     - **参数**: `-y @modelcontextprotocol/server-filesystem /tmp`
   - 点击"Create"按钮
   - 确认服务器出现在"全局可用 MCP"列表中

2. **切换到 Codex 模式**
   - 点击顶部的 "Codex" 按钮
   - 向下滚动到"Copy Claude Servers to Codex"区域

3. **找到测试服务器**
   - 在列表中找到 `test-mcp-server`
   - 卡片应该显示：
     - 蓝色"Claude"徽章
     - 虚线边框（表示可复制）
     - 橙色"→ Codex"按钮

4. **执行复制操作**
   - 点击橙色的"→ Codex"按钮
   - **预期结果**:
     - Toast 消息显示：`"Codex MCP server 'test-mcp-server' added"` (中文：`"Codex MCP 服务器 'test-mcp-server' 已添加"`)
     - Toast 类型：绿色成功提示
     - Toast 显示时间：3.5秒
     - 卡片出现绿色"Already added"徽章
     - "→ Codex"按钮消失
     - 服务器出现在"Codex Global Servers"区域

5. **验证复制结果**
   - 检查 `~/.codex/config.toml` 文件
   - 确认存在 `[mcp_servers.test-mcp-server]` 配置块
   - 示例配置：
     ```toml
     [mcp_servers.test-mcp-server]
     command = "npx"
     args = ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
     ```

### 测试数据记录

| 测试项 | 预期结果 | 实际结果 | 状态 |
|--------|----------|----------|------|
| Claude 服务器创建 | ✅ | _待填写_ | ⬜ |
| 复制区域显示服务器 | ✅ | _待填写_ | ⬜ |
| Toast 消息显示 | ✅ 3.5秒 | _待填写_ | ⬜ |
| Toast 消息内容 | "Codex MCP server 'test-mcp-server' added" | _待填写_ | ⬜ |
| config.toml 配置正确 | ✅ | _待填写_ | ⬜ |
| 卡片状态更新 | "Already added"徽章 | _待填写_ | ⬜ |
| Codex区域显示服务器 | ✅ | _待填写_ | ⬜ |

---

## 测试场景 3: 从其他项目复制到 Codex

### 测试步骤

1. **前置准备：在其他项目中创建 MCP 服务器**
   - 假设你有另一个项目（例如：`/path/to/other-project`）
   - 在该项目的 `.claude.json` 或 `.mcp.json` 中添加 MCP 服务器配置
   - 或在 Dashboard 中为该项目创建 MCP 服务器

2. **切换回当前项目**
   - 在 Dashboard 左上角切换到当前测试项目
   - 切换到 "Codex" 模式

3. **查看"其他项目可用"区域**
   - 向下滚动到最底部的"Available from Other Projects"区域
   - 应该看到来自其他项目的 MCP 服务器
   - 卡片显示：
     - 服务器名称
     - 蓝色"Claude"徽章
     - 项目来源标签（例如：`other-project`）
     - 橙色"Install to Codex"按钮

4. **执行安装操作**
   - 点击橙色的"Install to Codex"按钮
   - **预期结果**:
     - Toast 消息显示成功信息
     - Toast 显示时间：3.5秒
     - 服务器出现在"Codex Global Servers"区域
     - 原卡片显示"Already added"徽章

5. **验证安装结果**
   - 检查 `~/.codex/config.toml` 文件
   - 确认新服务器配置正确

### 测试数据记录

| 测试项 | 预期结果 | 实际结果 | 状态 |
|--------|----------|----------|------|
| 其他项目服务器显示 | ✅ | _待填写_ | ⬜ |
| Toast 消息显示 | ✅ 3.5秒 | _待填写_ | ⬜ |
| Toast 消息内容 | 成功消息 | _待填写_ | ⬜ |
| config.toml 配置正确 | ✅ | _待填写_ | ⬜ |
| Codex区域显示服务器 | ✅ | _待填写_ | ⬜ |

---

## 故障排查

### Toast 消息不显示

**可能原因**:
1. Toast 容器 CSS 被覆盖
2. JavaScript 错误阻止了消息显示

**排查步骤**:
1. 打开浏览器开发者工具（F12）
2. 切换到 Console 标签页
3. 执行安装操作
4. 查看是否有错误信息
5. 检查 Network 标签页，确认 API 请求成功（状态码 200）

### config.toml 未创建

**可能原因**:
1. 文件权限问题
2. 后端 API 错误

**排查步骤**:
1. 检查 `~/.codex` 目录是否存在
2. 检查该目录的读写权限
3. 查看 CCW Dashboard 后端日志
4. 检查 API 响应：
   ```bash
   # 在浏览器开发者工具 Network 标签页查看
   # POST /api/codex-mcp-add
   # 响应应该是: {"success": true}
   ```

### 服务器配置格式不正确

**可能原因**:
1. Claude 格式到 Codex 格式转换错误
2. 特殊字段未正确处理

**排查步骤**:
1. 对比 Claude 和 Codex 配置格式
2. 检查转换逻辑（`addCodexMcpServer` 函数）
3. 验证 TOML 序列化正确性

---

## 成功标准

所有测试场景通过以下标准：

✅ **UI 样式正确**
- Claude 模式：CCW Tools 卡片使用橙色样式
- Codex 模式：CCW Tools 卡片使用橙色样式
- 按钮颜色和边框符合设计规范

✅ **Toast 反馈完整**
- 安装成功时显示成功 Toast
- Toast 消息内容准确（包含服务器名称）
- Toast 显示时间为 3.5秒
- Toast 类型正确（success/error）

✅ **配置文件正确**
- `~/.codex/config.toml` 创建成功
- MCP 服务器配置格式正确
- 配置内容与源配置匹配

✅ **UI 状态同步**
- 安装后卡片状态更新
- 服务器出现在正确的区域
- 徽章显示正确

---

## 测试报告模板

### 测试信息
- **测试日期**: _____
- **测试人员**: _____
- **CCW 版本**: _____
- **浏览器**: _____

### 测试结果总结

| 测试场景 | 通过 | 失败 | 备注 |
|----------|------|------|------|
| Codex MCP 新建安装 | ⬜ | ⬜ | |
| 从 Claude MCP 复制到 Codex | ⬜ | ⬜ | |
| 从其他项目复制到 Codex | ⬜ | ⬜ | |

### 发现的问题

1. **问题描述**: _____
   - **严重程度**: Critical / High / Medium / Low
   - **复现步骤**: _____
   - **预期结果**: _____
   - **实际结果**: _____
   - **截图/日志**: _____

### 改进建议

_____

---

## 附录：功能实现细节

### Toast 消息机制

**实现位置**:
- `ccw/frontend/src/hooks/useToast.ts` (React)
- 显示时间：3500ms (3.5秒)
- 淡出动画：300ms

**Toast 类型**:
- `success`: 绿色背景 (`hsl(142 76% 36%)`)
- `error`: 红色背景 (`hsl(0 72% 51%)`)
- `info`: 主色调背景
- `warning`: 橙色背景 (`hsl(38 92% 50%)`)

### Codex MCP 安装流程

1. **前端调用**: `copyClaudeServerToCodex(serverName, serverConfig)`
2. **API 端点**: `POST /api/codex-mcp-add`
3. **后端处理**: `addCodexMcpServer(serverName, serverConfig)`
4. **配置写入**: 序列化为 TOML 格式并写入 `~/.codex/config.toml`
5. **响应返回**: `{success: true}` 或 `{error: "错误消息"}`
6. **前端更新**: 
   - 重新加载 MCP 配置
   - 重新渲染 UI
   - 显示 Toast 消息

### 格式转换规则

**Claude 格式** → **Codex 格式**:
- `command` → `command` (保持不变)
- `args` → `args` (保持不变)
- `env` → `env` (保持不变)
- `cwd` → `cwd` (可选)
- `url` → `url` (HTTP 服务器)
- `enabled` → `enabled` (默认 true)

---

## 联系支持

如果遇到问题，请提供以下信息：
1. 测试场景编号
2. 浏览器开发者工具的 Console 输出
3. Network 标签页的 API 请求/响应详情
4. `~/.codex/config.toml` 文件内容（如果存在）
5. CCW Dashboard 后端日志
