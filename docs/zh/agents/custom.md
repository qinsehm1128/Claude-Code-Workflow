# 自定义代理

创建和配置自定义 CCW 代理指南。

## 代理结构

```
~/.claude/agents/my-agent/
├── AGENT.md          # 代理定义
├── index.ts          # 代理逻辑
├── tools/            # 代理专用工具
└── examples/         # 使用示例
```

## 创建代理

### 1. 定义代理

创建 `AGENT.md`:

```markdown
---
name: my-agent
type: development
version: 1.0.0
capabilities: [react, typescript, testing]
---

# 我的自定义代理

专门用于 React 组件开发的 TypeScript 代理。

## 功能

- 使用 hooks 生成 React 组件
- TypeScript 类型定义
- Vitest 测试设置
- Tailwind CSS 样式

## 使用

\`\`\`javascript
Task({
  subagent_type: "my-agent",
  prompt: "创建用户配置文件组件"
})
\`\`\`
```

### 2. 实现代理逻辑

创建 `index.ts`:

```typescript
import type { AgentContext, AgentResult } from '@ccw/types'

export async function execute(
  prompt: string,
  context: AgentContext
): Promise<AgentResult> {
  // 分析请求
  const intent = analyzeIntent(prompt)

  // 根据意图执行
  switch (intent.type) {
    case 'generate-component':
      return await generateComponent(intent.options)
    case 'add-tests':
      return await addTests(intent.options)
    default:
      return await handleGeneral(prompt)
  }
}

function analyzeIntent(prompt: string) {
  // 从提示词解析用户意图
  // 返回结构化意图对象
}
```

## 代理功能

### 代码生成

```typescript
async function generateComponent(options: ComponentOptions) {
  return {
    files: [
      {
        path: 'src/components/UserProfile.tsx',
        content: generateReactComponent(options)
      },
      {
        path: 'src/components/UserProfile.test.tsx',
        content: generateTests(options)
      }
    ]
  }
}
```

### 分析

```typescript
async function analyzeCodebase(context: AgentContext) {
  const files = await context.filesystem.read('src/**/*.ts')
  const patterns = identifyPatterns(files)
  return {
    patterns,
    recommendations: generateRecommendations(patterns)
  }
}
```

### 测试

```typescript
async function generateTests(options: TestOptions) {
  return {
    framework: 'vitest',
    files: [
      {
        path: `${options.file}.test.ts`,
        content: generateTestCode(options)
      }
    ]
  }
}
```

## 代理工具

代理可以定义自定义工具:

```typescript
export const tools = {
  'my-tool': {
    description: '我的自定义工具',
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string' }
      }
    },
    execute: async (params) => {
      // 工具实现
    }
  }
}
```

## 代理通信

代理通过消息总线通信:

```typescript
// 向另一个代理发送消息
await context.messaging.send({
  to: 'tester',
  type: 'task-complete',
  data: { files: generatedFiles }
})

// 接收消息
context.messaging.on('task-complete', async (message) => {
  if (message.from === 'executor') {
    await startTesting(message.data.files)
  }
})
```

## 代理配置

在 `~/.claude/agents/config.json` 中配置代理:

```json
{
  "my-agent": {
    "enabled": true,
    "priority": 10,
    "capabilities": {
      "frameworks": ["react", "vue"],
      "languages": ["typescript", "javascript"],
      "tools": ["vitest", "playwright"]
    },
    "limits": {
      "maxFiles": 100,
      "maxSize": "10MB"
    }
  }
}
```

## 代理最佳实践

### 1. 明确目的

定义特定的、集中的功能:

```markdown
# 好: 专注
name: react-component-agent
purpose: 使用 TypeScript 生成 React 组件

# 坏: 太宽泛
name: fullstack-agent
purpose: 处理一切
```

### 2. 工具选择

为任务使用适当的工具:

```typescript
// 文件操作
context.filesystem.read(path)
context.filesystem.write(path, content)

// 代码分析
context.codebase.search(query)
context.codebase.analyze(pattern)

// 通信
context.messaging.send(to, type, data)
```

### 3. 错误处理

```typescript
try {
  const result = await executeTask(prompt)
  return { success: true, result }
} catch (error) {
  return {
    success: false,
    error: error.message,
    recovery: suggestRecovery(error)
  }
}
```

## 测试代理

```typescript
import { describe, it, expect } from 'vitest'
import { execute } from '../index'

describe('my-agent', () => {
  it('应该生成组件', async () => {
    const result = await execute(
      '创建 UserCard 组件',
      mockContext
    )
    expect(result.success).toBe(true)
    expect(result.files).toHaveLength(2) // 组件 + 测试
  })
})
```

::: info 另请参阅
- [内置代理](./builtin.md) - 预配置代理
- [代理概述](./index.md) - 代理系统介绍
:::
