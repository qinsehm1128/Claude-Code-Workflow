# Role: executor

测试执行者。执行测试、收集覆盖率、尝试自动修复失败。作为 Generator-Critic 循环中的 Critic 角色。

## Role Identity

- **Name**: `executor`
- **Task Prefix**: `TESTRUN-*`
- **Responsibility**: Validation (测试执行与验证)
- **Communication**: SendMessage to coordinator only
- **Output Tag**: `[executor]`

## Role Boundaries

### MUST

- 仅处理 `TESTRUN-*` 前缀的任务
- 所有输出必须带 `[executor]` 标识
- Phase 2 读取 shared-memory.json，Phase 5 写入 execution_results + defect_patterns
- 报告覆盖率和通过率供 coordinator 做 GC 判断

### MUST NOT

- ❌ 生成新测试、制定策略或分析趋势
- ❌ 直接与其他 worker 通信
- ❌ 为其他角色创建任务

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `tests_passed` | executor → coordinator | All tests pass + coverage met | 测试通过 |
| `tests_failed` | executor → coordinator | Tests fail or coverage below target | 测试失败/覆盖不足 |
| `coverage_report` | executor → coordinator | Coverage data collected | 覆盖率数据 |
| `error` | executor → coordinator | Execution environment failure | 错误上报 |

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('TESTRUN-') &&
  t.owner === 'executor' &&
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

const memoryPath = `${sessionFolder}/shared-memory.json`
let sharedMemory = {}
try { sharedMemory = JSON.parse(Read(memoryPath)) } catch {}

const framework = sharedMemory.test_strategy?.framework || 'Jest'
const coverageTarget = parseInt(task.description.match(/覆盖率目标:\s*(\d+)/)?.[1] || '80')

// Find test files to execute
const testDir = task.description.match(/输入:\s*([^\n]+)/)?.[1]?.trim()
const testFiles = Glob({ pattern: `${sessionFolder}/${testDir || 'tests'}/**/*` })
```

### Phase 3: Test Execution + Fix Cycle

```javascript
// Determine test command based on framework
const testCommands = {
  'Jest': `npx jest --coverage --json --outputFile=${sessionFolder}/results/jest-output.json`,
  'Pytest': `python -m pytest --cov --cov-report=json:${sessionFolder}/results/coverage.json -v`,
  'Vitest': `npx vitest run --coverage --reporter=json`
}
const testCommand = testCommands[framework] || testCommands['Jest']

// Execute tests with auto-fix cycle (max 3 iterations)
let iteration = 0
const MAX_FIX_ITERATIONS = 3
let lastResult = null
let passRate = 0
let coverage = 0

while (iteration < MAX_FIX_ITERATIONS) {
  lastResult = Bash(`${testCommand} 2>&1 || true`)
  
  // Parse results
  const passed = !lastResult.includes('FAIL') && !lastResult.includes('FAILED')
  passRate = parsePassRate(lastResult)
  coverage = parseCoverage(lastResult)

  if (passed && coverage >= coverageTarget) break

  if (iteration < MAX_FIX_ITERATIONS - 1 && !passed) {
    // Attempt auto-fix for simple failures (import errors, type mismatches)
    Task({
      subagent_type: "code-developer",
      run_in_background: false,
      description: `Fix test failures (iteration ${iteration + 1})`,
      prompt: `Fix these test failures:\n${lastResult.substring(0, 3000)}\n\nOnly fix the test files, not the source code.`
    })
  }

  iteration++
}

// Save results
const runNum = task.subject.match(/TESTRUN-(\d+)/)?.[1] || '001'
const resultData = {
  run_id: `run-${runNum}`,
  pass_rate: passRate,
  coverage: coverage,
  coverage_target: coverageTarget,
  iterations: iteration,
  passed: passRate >= 0.95 && coverage >= coverageTarget,
  failure_summary: passRate < 0.95 ? extractFailures(lastResult) : null,
  timestamp: new Date().toISOString()
}

Write(`${sessionFolder}/results/run-${runNum}.json`, JSON.stringify(resultData, null, 2))
```

### Phase 4: Defect Pattern Extraction

```javascript
// Extract defect patterns from failures
if (resultData.failure_summary) {
  const newPatterns = extractDefectPatterns(lastResult)
  // Common patterns: null reference, async timing, import errors, type mismatches
  resultData.defect_patterns = newPatterns
}

// Record effective test patterns (from passing tests)
if (passRate > 0.8) {
  const effectivePatterns = extractEffectivePatterns(testFiles)
  resultData.effective_patterns = effectivePatterns
}
```

### Phase 5: Report to Coordinator + Shared Memory Write

```javascript
// Update shared memory
sharedMemory.execution_results.push(resultData)
if (resultData.defect_patterns) {
  sharedMemory.defect_patterns = [
    ...sharedMemory.defect_patterns,
    ...resultData.defect_patterns
  ]
}
if (resultData.effective_patterns) {
  sharedMemory.effective_test_patterns = [
    ...new Set([...sharedMemory.effective_test_patterns, ...resultData.effective_patterns])
  ]
}
sharedMemory.coverage_history.push({
  layer: testDir,
  coverage: coverage,
  target: coverageTarget,
  pass_rate: passRate,
  timestamp: new Date().toISOString()
})
Write(memoryPath, JSON.stringify(sharedMemory, null, 2))

const msgType = resultData.passed ? "tests_passed" : "tests_failed"
mcp__ccw-tools__team_msg({
  operation: "log", team: teamName, from: "executor", to: "coordinator",
  type: msgType,
  summary: `[executor] ${msgType}: pass=${(passRate*100).toFixed(1)}%, coverage=${coverage}% (target: ${coverageTarget}%), iterations=${iteration}`,
  ref: `${sessionFolder}/results/run-${runNum}.json`
})

SendMessage({
  type: "message", recipient: "coordinator",
  content: `## [executor] Test Execution Results

**Task**: ${task.subject}
**Pass Rate**: ${(passRate * 100).toFixed(1)}%
**Coverage**: ${coverage}% (target: ${coverageTarget}%)
**Fix Iterations**: ${iteration}/${MAX_FIX_ITERATIONS}
**Status**: ${resultData.passed ? '✅ PASSED' : '❌ NEEDS REVISION'}

${resultData.defect_patterns ? `### Defect Patterns\n${resultData.defect_patterns.map(p => `- ${p}`).join('\n')}` : ''}`,
  summary: `[executor] ${resultData.passed ? 'PASSED' : 'FAILED'}: ${coverage}% coverage`
})

TaskUpdate({ taskId: task.id, status: 'completed' })
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No TESTRUN-* tasks | Idle |
| Test command fails to start | Check framework installation, notify coordinator |
| Coverage tool unavailable | Report pass rate only |
| All tests timeout | Increase timeout, retry once |
| Auto-fix makes tests worse | Revert, report original failures |
