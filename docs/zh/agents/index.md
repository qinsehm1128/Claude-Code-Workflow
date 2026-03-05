# 代理

CCW 为不同的开发工作流提供专用代理。

## 什么是代理?

代理是具有特定专业知识和工具的专用 AI 助手，用于软件开发的各个方面。

## 内置代理

### 前端代理

专注于 Web 前端开发。

**专长:**
- React、Vue、Angular
- CSS/Tailwind/样式
- 状态管理
- 组件架构
- 使用 Jest/Vitest/Playwright 测试

```javascript
Task({
  subagent_type: "fe-developer",
  prompt: "创建响应式仪表板"
})
```

### 后端代理

处理服务器端开发。

**专长:**
- Node.js、Python、Go
- API 设计 (REST/GraphQL)
- 数据库设计
- 身份验证/授权
- 性能优化

```javascript
Task({
  subagent_type: "be-developer",
  prompt: "实现用户身份验证 API"
})
```

### 测试代理

专注于测试和质量保证。

**专长:**
- 单元测试
- 集成测试
- E2E 测试
- 测试驱动开发
- 覆盖率分析

```javascript
Task({
  subagent_type: "qa-agent",
  prompt: "为用户服务编写测试"
})
```

### 文档代理

创建和维护文档。

**专长:**
- API 文档
- 用户指南
- 技术写作
- 图表和可视化
- 文档即代码工作流

```javascript
Task({
  subagent_type: "doc-writer",
  prompt: "记录 REST API"
})
```

## 代理通信

代理可以相互通信和协调:

```javascript
// 代理发送消息
SendMessage({
  type: "message",
  recipient: "tester",
  content: "功能实现完成，准备测试"
})

// 代理通过系统接收消息
```

## 团队工作流

多个代理可以协同处理复杂任务:

```
[analyst] -> RESEARCH (需求分析)
    |
    v
[writer] -> DRAFT (规范创建)
    |
    v
[planner] -> PLAN (实现规划)
    |
    +--[executor] -> IMPL (代码实现)
    |               |
    |               v
    +-----------[tester] -> TEST (测试)
    |
    v
[reviewer] -> REVIEW (代码审查)
```

## 使用代理

### CLI 集成

```bash
# 使用前端代理
ccw agent run fe-developer "创建响应式导航栏"

# 使用后端代理
ccw agent run be-developer "实现 JWT 身份验证"
```

### 编程方式使用

```javascript
// 在后台派生代理
Task({
  subagent_type: "fe-developer",
  run_in_background: true,
  prompt: "实现用户仪表板"
})
```

### 配置

在 `~/.claude/agents/config.json` 中配置代理行为:

```json
{
  "agents": {
    "fe-developer": {
      "framework": "vue",
      "testing": "vitest",
      "styling": "tailwind"
    }
  }
}
```

::: info 另请参阅
- [技能](../skills/) - 可重用技能库
- [工作流](../workflows/) - 编排系统
:::
