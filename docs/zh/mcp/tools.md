# MCP 工具参考

模型上下文协议 (MCP) 工具提供与外部系统和服务的增强集成。

## 什么是 MCP?

MCP 是一种协议，允许 CCW 通过标准化接口与外部工具、数据库和服务交互。

## 可用的 MCP 工具

### 文件操作

#### mcp__ccw-tools__read_file
读取支持分页的文件内容。

```json
{
  "name": "read_file",
  "parameters": {
    "path": "string (必需)",
    "offset": "number (可选)",
    "limit": "number (可选)"
  }
}
```

**用法:**
```javascript
read_file({ path: "src/index.ts" })
read_file({ path: "large-file.log", offset: 100, limit: 50 })
```

#### mcp__ccw-tools__write_file
写入或覆盖文件，支持目录创建。

```json
{
  "name": "write_file",
  "parameters": {
    "path": "string (必需)",
    "content": "string (必需)",
    "createDirectories": "boolean (默认: true)",
    "backup": "boolean (默认: false)"
  }
}
```

**用法:**
```javascript
write_file({
  path: "src/new-file.ts",
  content: "// TypeScript 代码在这里"
})
```

#### mcp__ccw-tools__edit_file
使用字符串替换或基于行的操作编辑文件。

```json
{
  "name": "edit_file",
  "parameters": {
    "path": "string (必需)",
    "mode": "update | line (默认: update)",
    "oldText": "string (更新模式)",
    "newText": "string (更新模式)",
    "line": "number (行模式)",
    "operation": "insert_before | insert_after | replace | delete (行模式)"
  }
}
```

**用法:**
```javascript
// 更新模式 - 字符串替换
edit_file({
  path: "config.json",
  oldText: '"version": "1.0.0"',
  newText: '"version": "2.0.0"'
})

// 行模式 - 在第 10 行后插入
edit_file({
  path: "index.ts",
  mode: "line",
  operation: "insert_after",
  line: 10,
  text: "// 新代码在这里"
})
```

### 搜索工具

#### mcp__ccw-tools__smart_search
统一搜索，支持内容搜索、文件发现和语义搜索。

```json
{
  "name": "smart_search",
  "parameters": {
    "action": "search | find_files | init | status",
    "query": "string (用于搜索)",
    "pattern": "glob 模式 (用于 find_files)",
    "mode": "fuzzy | semantic (默认: fuzzy)",
    "output_mode": "full | files_only | count",
    "maxResults": "number (默认: 20)"
  }
}
```

**用法:**
```javascript
// 模糊搜索 (默认)
smart_search({
  action: "search",
  query: "身份验证逻辑"
})

// 语义搜索
smart_search({
  action: "search",
  query: "如何处理错误",
  mode: "semantic"
})

// 按模式查找文件
smart_search({
  action: "find_files",
  pattern: "*.ts"
})
```

### 代码上下文

#### mcp__ace-tool__search_context
使用实时代码库索引的语义代码搜索。

```json
{
  "name": "search_context",
  "parameters": {
    "project_root_path": "string (必需)",
    "query": "string (必需)"
  }
}
```

**用法:**
```javascript
search_context({
  project_root_path: "/path/to/project",
  query: "用户身份验证在哪里处理?"
})
```

### 记忆工具

#### mcp__ccw-tools__core_memory
跨会话记忆管理，用于战略上下文。

```json
{
  "name": "core_memory",
  "parameters": {
    "operation": "list | import | export | summary | embed | search",
    "text": "string (用于导入)",
    "id": "string (用于导出/摘要)",
    "query": "string (用于搜索)"
  }
}
```

**用法:**
```javascript
// 列出所有记忆
core_memory({ operation: "list" })

// 导入新记忆
core_memory({
  operation: "import",
  text: "重要: 使用 JWT 进行身份验证"
})

// 搜索记忆
core_memory({
  operation: "search",
  query: "身份验证"
})
```

## MCP 配置

在 `~/.claude/mcp.json` 中配置 MCP 服务器:

```json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/path/to/allowed"]
    },
    "git": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-git"]
    }
  }
}
```

## 工具优先级

使用 CCW 时，遵循此工具选择优先级:

1. **MCP 工具** (最高优先级) - 用于代码搜索、文件操作
2. **内置工具** - 用于简单、直接的操作
3. **Shell 命令** - MCP 不可用时的回退

::: info 另请参阅
- [CLI 参考](../cli/commands.md) - CLI 工具使用
- [代理](../agents/) - 代理工具集成
:::
