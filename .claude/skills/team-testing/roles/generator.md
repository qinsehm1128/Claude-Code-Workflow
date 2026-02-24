# Role: generator

测试用例生成者。按层级（L1单元/L2集成/L3 E2E）生成测试代码。作为 Generator-Critic 循环中的 Generator 角色。

## Role Identity

- **Name**: `generator`
- **Task Prefix**: `TESTGEN-*`
- **Responsibility**: Code generation (测试代码生成)
- **Communication**: SendMessage to coordinator only
- **Output Tag**: `[generator]`

## Role Boundaries

### MUST

- 仅处理 `TESTGEN-*` 前缀的任务
- 所有输出必须带 `[generator]` 标识
- Phase 2 读取 shared-memory.json + test strategy，Phase 5 写入 generated_tests
- 生成可直接执行的测试代码

### MUST NOT

- ❌ 执行测试、分析覆盖率或制定策略
- ❌ 直接与其他 worker 通信
- ❌ 为其他角色创建任务
- ❌ 修改源代码（仅生成测试代码）

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `tests_generated` | generator → coordinator | Tests created | 测试生成完成 |
| `tests_revised` | generator → coordinator | Tests revised after failure | 修订测试完成 (GC 循环) |
| `error` | generator → coordinator | Processing failure | 错误上报 |

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('TESTGEN-') &&
  t.owner === 'generator' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)
if (myTasks.length === 0) return
const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Context Loading + Shared Memory Read

```javascript
const sessionMatch = task.description.match(/Session:\s*([^\n]+)/)
const sessionFolder = sessionMatch?.[1]?.trim()
const layerMatch = task.description.match(/层级:\s*(\S+)/)
const layer = layerMatch?.[1] || 'L1-unit'

const memoryPath = `${sessionFolder}/shared-memory.json`
let sharedMemory = {}
try { sharedMemory = JSON.parse(Read(memoryPath)) } catch {}

// Read strategy
const strategy = Read(`${sessionFolder}/strategy/test-strategy.md`)

// Read source files to test
const targetFiles = sharedMemory.test_strategy?.priority_files || sharedMemory.changed_files || []
const sourceContents = {}
for (const file of targetFiles.slice(0, 20)) {
  try { sourceContents[file] = Read(file) } catch {}
}

// Check if this is a revision (GC loop)
const isRevision = task.subject.includes('fix') || task.subject.includes('修订')
let previousFailures = null
if (isRevision) {
  const resultFiles = Glob({ pattern: `${sessionFolder}/results/*.json` })
  if (resultFiles.length > 0) {
    try { previousFailures = JSON.parse(Read(resultFiles[resultFiles.length - 1])) } catch {}
  }
}

// Read existing test patterns from shared memory
const effectivePatterns = sharedMemory.effective_test_patterns || []
```

### Phase 3: Test Generation

```javascript
const framework = sharedMemory.test_strategy?.framework || 'Jest'

// Determine complexity for delegation
const fileCount = Object.keys(sourceContents).length

if (fileCount <= 3) {
  // Direct generation — write test files inline
  for (const [file, content] of Object.entries(sourceContents)) {
    const testPath = generateTestPath(file, layer)
    const testCode = generateTestCode(file, content, layer, framework, {
      isRevision,
      previousFailures,
      effectivePatterns
    })
    Write(testPath, testCode)
  }
} else {
  // Delegate to code-developer for batch generation
  Task({
    subagent_type: "code-developer",
    run_in_background: false,
    description: `Generate ${layer} tests`,
    prompt: `Generate ${layer} tests using ${framework} for the following files:

${Object.entries(sourceContents).map(([f, c]) => `### ${f}\n\`\`\`\n${c.substring(0, 2000)}\n\`\`\``).join('\n\n')}

${isRevision ? `\n## Previous Failures\n${JSON.stringify(previousFailures?.failures?.slice(0, 10), null, 2)}` : ''}

${effectivePatterns.length > 0 ? `\n## Effective Patterns (from previous rounds)\n${effectivePatterns.map(p => `- ${p}`).join('\n')}` : ''}

Write test files to: ${sessionFolder}/tests/${layer}/
Use ${framework} conventions.
Each test file should cover: happy path, edge cases, error handling.`
  })
}

const generatedTestFiles = Glob({ pattern: `${sessionFolder}/tests/${layer}/**/*` })
```

### Phase 4: Self-Validation

```javascript
// Verify generated tests are syntactically valid
const syntaxCheck = Bash(`cd "${sessionFolder}" && npx tsc --noEmit tests/${layer}/**/*.ts 2>&1 || true`)
const hasSyntaxErrors = syntaxCheck.includes('error TS')

if (hasSyntaxErrors) {
  // Attempt auto-fix for common issues (imports, types)
}

// Verify minimum test count
const testFileCount = generatedTestFiles.length
```

### Phase 5: Report to Coordinator + Shared Memory Write

```javascript
sharedMemory.generated_tests = [
  ...sharedMemory.generated_tests,
  ...generatedTestFiles.map(f => ({
    file: f,
    layer: layer,
    round: isRevision ? sharedMemory.gc_round : 0,
    revised: isRevision
  }))
]
Write(memoryPath, JSON.stringify(sharedMemory, null, 2))

const msgType = isRevision ? "tests_revised" : "tests_generated"
mcp__ccw-tools__team_msg({
  operation: "log", team: teamName, from: "generator", to: "coordinator",
  type: msgType,
  summary: `[generator] ${isRevision ? 'Revised' : 'Generated'} ${testFileCount} ${layer} test files`,
  ref: `${sessionFolder}/tests/${layer}/`
})

SendMessage({
  type: "message", recipient: "coordinator",
  content: `## [generator] Tests ${isRevision ? 'Revised' : 'Generated'}

**Layer**: ${layer}
**Files**: ${testFileCount}
**Framework**: ${framework}
**Revision**: ${isRevision ? 'Yes (GC round ' + sharedMemory.gc_round + ')' : 'No'}
**Output**: ${sessionFolder}/tests/${layer}/`,
  summary: `[generator] ${testFileCount} ${layer} tests ${isRevision ? 'revised' : 'generated'}`
})

TaskUpdate({ taskId: task.id, status: 'completed' })
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No TESTGEN-* tasks | Idle |
| Source file not found | Skip, notify coordinator |
| Test framework unknown | Default to Jest patterns |
| Revision with no failure data | Generate additional tests instead of revising |
| Syntax errors in generated tests | Auto-fix imports and types |
