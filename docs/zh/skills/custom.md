# 自定义技能开发

创建和部署自定义 CCW 技能指南。

## 技能结构

```
~/.claude/skills/my-skill/
├── SKILL.md          # 技能定义（必需）
├── index.ts          # 技能逻辑（可选）
├── examples/         # 使用示例
└── README.md         # 文档
```

## 创建技能

### 1. 定义技能元数据

创建带 YAML 前言的 `SKILL.md`：

```markdown
---
name: my-skill
description: My custom skill for X
version: 1.0.0
author: Your Name <email@example.com>
tags: [custom, automation, frontend]
category: development
---

# My Custom Skill

## What It Does
技能用途和功能的详细描述。

## Usage

\`\`\`javascript
Skill(skill="my-skill", args="your input here")
\`\`\`

## Examples

### Example 1: Basic Usage
\`\`\`javascript
Skill(skill="my-skill", args="create user form")
\`\`\`

### Example 2: With Options
\`\`\`javascript
Skill(skill="my-skill", args={
  component: "UserForm",
  typescript: true,
  styling: "tailwind"
})
\`\`\`
```

### 2. 实现技能逻辑（可选）

对于复杂技能，添加 `index.ts`：

```typescript
import type { SkillContext, SkillResult } from '@ccw/types'

interface MySkillOptions {
  component?: string
  typescript?: boolean
  styling?: 'css' | 'tailwind' | 'scss'
}

export async function execute(
  args: string | MySkillOptions,
  context: SkillContext
): Promise<SkillResult> {
  // 解析输入
  const options = typeof args === 'string'
    ? { component: args }
    : args

  // 执行技能逻辑
  const result = await generateComponent(options)

  return {
    success: true,
    output: result,
    metadata: {
      skill: 'my-skill',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    }
  }
}

async function generateComponent(options: MySkillOptions) {
  // 你的实现代码
  return `// Generated code`
}
```

## 技能类别

### 开发

- 组件生成器
- API 脚手架
- 数据库模式创建

### 文档

- API 文档生成
- README 创建
- Changelog 生成

### DevOps

- CI/CD 配置
- Dockerfile 生成
- Kubernetes 清单

### 测试

- 测试生成
- Mock 创建
- 覆盖率报告

## 技能最佳实践

### 1. 明确用途

```markdown
# 好的：清晰和具体
name: generate-react-component
description: 生成带 hooks 和 TypeScript 的 React 组件

# 坏的：模糊和通用
name: code-helper
description: 帮助编码
```

### 2. 类型安全

```typescript
// 定义清晰的接口
interface Options {
  name: string
  typescript?: boolean
  styling?: 'css' | 'tailwind'
}

// 验证输入
function validateOptions(options: any): Options {
  if (!options.name) {
    throw new Error('组件名称是必需的')
  }
  return options as Options
}
```

### 3. 错误处理

```typescript
try {
  const result = await generateComponent(options)
  return { success: true, output: result }
} catch (error) {
  return {
    success: false,
    error: error.message,
    suggestion: '确保组件名称有效'
  }
}
```

### 4. 文档

```markdown
## Usage

\`\`\`javascript
Skill(skill="my-skill", args="...")
\`\`\`

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| name | string | required | 组件名称 |
| typescript | boolean | true | 使用 TypeScript |

## Examples

更多示例参见 `examples/` 目录。
```

## 发布技能

### 私有技能

`~/.claude/skills/` 中的技能自动可用。

### 团队技能

通过 git 共享技能：

```bash
# 创建技能仓库
mkdir my-ccw-skills
cd my-ccw-skills
git init

# 添加技能
mkdir skills/skill-1
# ... 添加技能文件

# 与团队共享
git remote add origin <repo-url>
git push -u origin main
```

团队成员安装：

```bash
git clone <repo-url> ~/.claude/skills/team-skills
```

### 公共技能

发布到 npm：

```json
{
  "name": "ccw-skills-my-skill",
  "version": "1.0.0",
  "ccw": {
    "skills": ["my-skill"]
  }
}
```

## 测试技能

在 `tests/` 中创建测试：

```typescript
import { describe, it, expect } from 'vitest'
import { execute } from '../index'

describe('my-skill', () => {
  it('should generate component', async () => {
    const result = await execute('UserForm', {})
    expect(result.success).toBe(true)
    expect(result.output).toContain('UserForm')
  })
})
```

## 调试

启用调试日志：

```bash
export CCW_DEBUG=1
Skill(skill="my-skill", args="\"test input\"")
```

::: info 参见
- [核心技能](./core-skills.md) - 内置技能参考
- [技能库](./index.md) - 所有可用技能
:::
