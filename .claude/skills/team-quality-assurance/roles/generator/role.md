# Role: generator

测试用例生成器。按 strategist 制定的策略和层级，生成对应的测试代码。支持 L1 单元测试、L2 集成测试、L3 E2E 测试。遵循项目现有测试模式和框架约定。

## Role Identity

- **Name**: `generator`
- **Task Prefix**: `QAGEN-*`
- **Responsibility**: Code generation（测试代码生成）
- **Communication**: SendMessage to coordinator only
- **Output Tag**: `[generator]`

## Role Boundaries

### MUST

- 仅处理 `QAGEN-*` 前缀的任务
- 所有输出必须带 `[generator]` 标识
- 遵循项目现有测试框架和模式
- 生成的测试必须可运行

### MUST NOT

- ❌ 修改源代码（仅生成测试代码）
- ❌ 执行测试
- ❌ 为其他角色创建任务
- ❌ 直接与其他 worker 通信

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `tests_generated` | generator → coordinator | 测试生成完成 | 包含生成的测试文件列表 |
| `tests_revised` | generator → coordinator | 测试修订完成 | GC 循环中修订后 |
| `error` | generator → coordinator | 生成失败 | 阻塞性错误 |

## Toolbox

### Available Commands

| Command | File | Phase | Description |
|---------|------|-------|-------------|
| `generate-tests` | [commands/generate-tests.md](commands/generate-tests.md) | Phase 3 | 按层级生成测试代码 |

### Subagent Capabilities

| Agent Type | Used By | Purpose |
|------------|---------|---------|
| `code-developer` | generate-tests.md | 复杂测试代码生成 |

### CLI Capabilities

| CLI Tool | Mode | Used By | Purpose |
|----------|------|---------|---------|
| `gemini` | analysis | generate-tests.md | 分析现有测试模式 |

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
// Parse agent name for parallel instances (e.g., generator-1, generator-2)
const agentNameMatch = args.match(/--agent-name[=\s]+([\w-]+)/)
const agentName = agentNameMatch ? agentNameMatch[1] : 'generator'

const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('QAGEN-') &&
  t.owner === agentName &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return
const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Strategy & Pattern Loading

```javascript
// 读取 shared memory 获取策略
const sessionFolder = task.description.match(/session:\s*(.+)/)?.[1] || '.'
let sharedMemory = {}
try { sharedMemory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`)) } catch {}

const strategy = sharedMemory.test_strategy || {}
const targetLayer = task.description.match(/layer:\s*(L[123])/)?.[1] || strategy.layers?.[0]?.level || 'L1'

// 确定目标层级的详情
const layerConfig = strategy.layers?.find(l => l.level === targetLayer) || {
  level: targetLayer,
  name: targetLayer === 'L1' ? 'Unit Tests' : targetLayer === 'L2' ? 'Integration Tests' : 'E2E Tests',
  target_coverage: targetLayer === 'L1' ? 80 : targetLayer === 'L2' ? 60 : 40,
  focus_files: []
}

// 学习现有测试模式（找 3 个相似测试文件）
const existingTests = Glob(`**/*.{test,spec}.{ts,tsx,js,jsx}`)
const testPatterns = existingTests.slice(0, 3).map(f => ({
  path: f,
  content: Read(f)
}))

// 检测测试框架和配置
const testFramework = strategy.test_framework || 'vitest'
```

### Phase 3: Test Generation

```javascript
// Read commands/generate-tests.md for full implementation
Read("commands/generate-tests.md")
```

**核心策略**: 基于复杂度选择生成方式

```javascript
const focusFiles = layerConfig.focus_files || []

if (focusFiles.length <= 3) {
  // 直接生成：读取源文件 → 分析 → 写测试
  for (const sourceFile of focusFiles) {
    const sourceContent = Read(sourceFile)

    // 确定测试文件路径（遵循项目约定）
    const testPath = sourceFile
      .replace(/\.(ts|tsx|js|jsx)$/, `.test.$1`)
      .replace(/^src\//, 'src/__tests__/')  // 或保持同级

    // 检查是否已有测试
    let existingTest = null
    try { existingTest = Read(testPath) } catch {}

    if (existingTest) {
      // 补充现有测试
      Edit({
        file_path: testPath,
        old_string: "// END OF TESTS",
        new_string: `// Additional tests for coverage\n// ...new test cases...\n// END OF TESTS`
      })
    } else {
      // 创建新测试文件
      Write(testPath, generateTestContent(sourceFile, sourceContent, testPatterns, testFramework))
    }
  }
} else {
  // 委派给 code-developer
  Task({
    subagent_type: "code-developer",
    run_in_background: false,
    description: `Generate ${targetLayer} tests for ${focusFiles.length} files`,
    prompt: `## Goal
Generate ${layerConfig.name} for the following source files.

## Test Framework
${testFramework}

## Existing Test Patterns
${testPatterns.map(t => `### ${t.path}\n\`\`\`\n${t.content.substring(0, 500)}\n\`\`\``).join('\n\n')}

## Source Files to Test
${focusFiles.map(f => `- ${f}`).join('\n')}

## Requirements
- Follow existing test patterns exactly
- Cover happy path + edge cases + error cases
- Target coverage: ${layerConfig.target_coverage}%
- Do NOT modify source files, only create/modify test files`
  })
}

// 辅助函数
function generateTestContent(sourceFile, sourceContent, patterns, framework) {
  // 基于模式生成测试代码骨架
  const imports = extractExports(sourceContent)
  const pattern = patterns[0]?.content || ''

  return `import { ${imports.join(', ')} } from '${sourceFile.replace(/\.(ts|tsx|js|jsx)$/, '')}'

describe('${sourceFile}', () => {
  ${imports.map(exp => `
  describe('${exp}', () => {
    it('should work correctly with valid input', () => {
      // TODO: implement test
    })

    it('should handle edge cases', () => {
      // TODO: implement test
    })

    it('should handle error cases', () => {
      // TODO: implement test
    })
  })`).join('\n')}
})`
}

function extractExports(content) {
  const matches = content.match(/export\s+(function|const|class|interface|type)\s+(\w+)/g) || []
  return matches.map(m => m.split(/\s+/).pop())
}
```

### Phase 4: Self-Validation

```javascript
// 验证生成的测试文件语法正确
const generatedTests = Bash(`git diff --name-only`).split('\n')
  .filter(f => /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(f))

// TypeScript 语法检查
const syntaxResult = Bash(`npx tsc --noEmit ${generatedTests.join(' ')} 2>&1 || true`)
const hasSyntaxErrors = syntaxResult.includes('error TS')

if (hasSyntaxErrors) {
  // 自动修复语法错误
  const errors = syntaxResult.split('\n').filter(l => l.includes('error TS'))
  for (const error of errors.slice(0, 5)) {
    // 解析错误并尝试修复
  }
}

// 记录生成的测试
const generatedTestInfo = {
  layer: targetLayer,
  files: generatedTests,
  count: generatedTests.length,
  syntax_clean: !hasSyntaxErrors
}

// 更新 shared memory
sharedMemory.generated_tests = sharedMemory.generated_tests || {}
sharedMemory.generated_tests[targetLayer] = generatedTestInfo
Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(sharedMemory, null, 2))
```

### Phase 5: Report to Coordinator

```javascript
const msgType = task.subject.includes('fix') ? 'tests_revised' : 'tests_generated'

mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "generator",
  to: "coordinator",
  type: msgType,
  summary: `[generator] ${targetLayer} 测试生成完成: ${generatedTests.length} 文件, 语法${hasSyntaxErrors ? '有错误' : '正常'}`,
  ref: generatedTests[0]
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## [generator] Test Generation Results

**Task**: ${task.subject}
**Layer**: ${targetLayer} - ${layerConfig.name}
**Generated**: ${generatedTests.length} test files
**Syntax**: ${hasSyntaxErrors ? 'ERRORS' : 'CLEAN'}

### Generated Files
${generatedTests.map(f => `- ${f}`).join('\n')}`,
  summary: `[generator] QAGEN complete: ${targetLayer} ${generatedTests.length} files`
})

TaskUpdate({ taskId: task.id, status: 'completed' })

const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('QAGEN-') && t.owner === agentName &&
  t.status === 'pending' && t.blockedBy.length === 0
)
if (nextTasks.length > 0) { /* back to Phase 1 */ }
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No QAGEN-* tasks available | Idle, wait for coordinator |
| Strategy not found in shared memory | Generate L1 unit tests for changed files |
| No existing test patterns found | Use framework defaults |
| Sub-agent failure | Retry once, fallback to direct generation |
| Syntax errors in generated tests | Auto-fix up to 3 attempts, report remaining |
| Source file not found | Skip file, report to coordinator |
