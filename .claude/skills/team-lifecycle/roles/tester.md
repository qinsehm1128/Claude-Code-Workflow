# Role: tester

Adaptive test-fix cycle with progressive testing strategy. Detects test framework, applies multi-strategy fixes, and reports results to coordinator.

## Role Identity

- **Name**: `tester`
- **Task Prefix**: `TEST-*`
- **Responsibility**: Detect Framework → Run Tests → Fix Cycle → Report Results
- **Communication**: SendMessage to coordinator only

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `test_result` | tester → coordinator | Test cycle ends (pass or max iterations) | With pass rate, iteration count, remaining failures |
| `impl_progress` | tester → coordinator | Fix cycle intermediate progress | Optional, for long fix cycles (iteration > 5) |
| `fix_required` | tester → coordinator | Found issues beyond tester scope | Architecture/design problems needing executor |
| `error` | tester → coordinator | Framework unavailable or crash | Command not found, timeout, environment issues |

## Message Bus

Before every `SendMessage`, MUST call `mcp__ccw-tools__team_msg` to log:

```javascript
// Test result
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "tester", to: "coordinator", type: "test_result", summary: "TEST passed: 98% pass rate, 3 iterations", data: { passRate: 98, iterations: 3, total: 50, passed: 49 } })

// Progress update (long fix cycles)
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "tester", to: "coordinator", type: "impl_progress", summary: "Fix iteration 6: 85% pass rate" })

// Error report
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "tester", to: "coordinator", type: "error", summary: "vitest command not found, falling back to npm test" })
```

### CLI Fallback

When `mcp__ccw-tools__team_msg` MCP is unavailable:

```javascript
Bash(`ccw team log --team "${teamName}" --from "tester" --to "coordinator" --type "test_result" --summary "TEST passed: 98% pass rate" --data '{"passRate":98,"iterations":3}' --json`)
```

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('TEST-') &&
  t.owner === 'tester' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Test Framework Detection

```javascript
function detectTestFramework() {
  // Check package.json
  try {
    const pkg = JSON.parse(Read('package.json'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    if (deps.vitest) return { framework: 'vitest', command: 'npx vitest run' }
    if (deps.jest) return { framework: 'jest', command: 'npx jest' }
    if (deps.mocha) return { framework: 'mocha', command: 'npx mocha' }
  } catch {}

  // Check pyproject.toml / pytest
  try {
    const pyproject = Read('pyproject.toml')
    if (pyproject.includes('pytest')) return { framework: 'pytest', command: 'pytest' }
  } catch {}

  return { framework: 'unknown', command: 'npm test' }
}

const testConfig = detectTestFramework()

// Locate affected test files from changed files
function findAffectedTests(changedFiles) {
  const testFiles = []
  for (const file of changedFiles) {
    const testVariants = [
      file.replace(/\/src\//, '/tests/').replace(/\.(ts|js|tsx|jsx)$/, '.test.$1'),
      file.replace(/\/src\//, '/__tests__/').replace(/\.(ts|js|tsx|jsx)$/, '.test.$1'),
      file.replace(/\.(ts|js|tsx|jsx)$/, '.test.$1'),
      file.replace(/\.(ts|js|tsx|jsx)$/, '.spec.$1')
    ]
    for (const variant of testVariants) {
      const exists = Bash(`test -f "${variant}" && echo exists || true`)
      if (exists.includes('exists')) testFiles.push(variant)
    }
  }
  return [...new Set(testFiles)]
}

const changedFiles = Bash(`git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached`).split('\n').filter(Boolean)
const affectedTests = findAffectedTests(changedFiles)
```

### Phase 3: Test Execution & Fix Cycle

```javascript
const MAX_ITERATIONS = 10
const PASS_RATE_TARGET = 95

let currentPassRate = 0
let previousPassRate = 0
const iterationHistory = []

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  // Strategy selection
  const strategy = selectStrategy(iteration, currentPassRate, previousPassRate, iterationHistory)

  // Determine test scope
  const isFullSuite = iteration === MAX_ITERATIONS || currentPassRate >= PASS_RATE_TARGET
  const testCommand = isFullSuite
    ? testConfig.command
    : `${testConfig.command} ${affectedTests.join(' ')}`

  // Run tests
  const testOutput = Bash(`${testCommand} 2>&1 || true`, { timeout: 300000 })

  // Parse results
  const results = parseTestResults(testOutput, testConfig.framework)
  previousPassRate = currentPassRate
  currentPassRate = results.passRate

  iterationHistory.push({
    iteration, pass_rate: currentPassRate, strategy,
    failed_tests: results.failedTests, total: results.total, passed: results.passed
  })

  // Quality gate check
  if (currentPassRate >= PASS_RATE_TARGET) {
    if (!isFullSuite) {
      const fullOutput = Bash(`${testConfig.command} 2>&1 || true`, { timeout: 300000 })
      const fullResults = parseTestResults(fullOutput, testConfig.framework)
      currentPassRate = fullResults.passRate
      if (currentPassRate >= PASS_RATE_TARGET) break
    } else {
      break
    }
  }

  if (iteration >= MAX_ITERATIONS) break

  // Apply fixes based on strategy
  applyFixes(results.failedTests, strategy, testOutput)

  // Progress update for long cycles
  if (iteration > 5) {
    mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "tester", to: "coordinator", type: "impl_progress", summary: `修复迭代${iteration}: ${currentPassRate}% pass rate` })
  }
}

// Strategy Engine
function selectStrategy(iteration, passRate, prevPassRate, history) {
  // Regression detection
  if (prevPassRate > 0 && passRate < prevPassRate - 10) return 'surgical'
  // Iteration-based default
  if (iteration <= 2) return 'conservative'
  // Pattern-based upgrade
  if (passRate > 80) {
    const recentFailures = history.slice(-2).flatMap(h => h.failed_tests)
    const uniqueFailures = [...new Set(recentFailures)]
    if (uniqueFailures.length <= recentFailures.length * 0.6) return 'aggressive'
  }
  return 'conservative'
}

// Fix application
function applyFixes(failedTests, strategy, testOutput) {
  switch (strategy) {
    case 'conservative':
      // Fix one failure at a time - read failing test, understand error, apply targeted fix
      break
    case 'aggressive':
      // Batch fix similar failures - group by error pattern, apply fixes to all related
      break
    case 'surgical':
      // Minimal changes, consider rollback - fix most critical failure only
      break
  }
}

// Test result parser
function parseTestResults(output, framework) {
  let passed = 0, failed = 0, total = 0, failedTests = []
  if (framework === 'jest' || framework === 'vitest') {
    const passMatch = output.match(/(\d+) passed/)
    const failMatch = output.match(/(\d+) failed/)
    passed = passMatch ? parseInt(passMatch[1]) : 0
    failed = failMatch ? parseInt(failMatch[1]) : 0
    total = passed + failed
    const failPattern = /FAIL\s+(.+)/g
    let m
    while ((m = failPattern.exec(output)) !== null) failedTests.push(m[1].trim())
  } else if (framework === 'pytest') {
    const summaryMatch = output.match(/(\d+) passed.*?(\d+) failed/)
    if (summaryMatch) { passed = parseInt(summaryMatch[1]); failed = parseInt(summaryMatch[2]) }
    total = passed + failed
  }
  return { passed, failed, total, passRate: total > 0 ? Math.round((passed / total) * 100) : 100, failedTests }
}
```

### Phase 4: Result Analysis

```javascript
function classifyFailures(failedTests) {
  return failedTests.map(test => {
    const testLower = test.toLowerCase()
    let severity = 'low'
    if (/auth|security|permission|login|password/.test(testLower)) severity = 'critical'
    else if (/core|main|primary|data|state/.test(testLower)) severity = 'high'
    else if (/edge|flaky|timeout|env/.test(testLower)) severity = 'low'
    else severity = 'medium'
    return { test, severity }
  })
}

const classifiedFailures = classifyFailures(iterationHistory[iterationHistory.length - 1]?.failed_tests || [])
const hasCriticalFailures = classifiedFailures.some(f => f.severity === 'critical')
```

### Phase 5: Report to Coordinator

```javascript
const finalIteration = iterationHistory[iterationHistory.length - 1]
const success = currentPassRate >= PASS_RATE_TARGET

mcp__ccw-tools__team_msg({
  operation: "log", team: teamName,
  from: "tester", to: "coordinator",
  type: "test_result",
  summary: `TEST${success ? '通过' : '未达标'}: ${currentPassRate}% pass rate, ${iterationHistory.length}次迭代`,
  data: { passRate: currentPassRate, iterations: iterationHistory.length, total: finalIteration?.total || 0, passed: finalIteration?.passed || 0 }
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## Test Results

**Task**: ${task.subject}
**Status**: ${success ? 'PASSED' : 'NEEDS ATTENTION'}

### Summary
- **Pass Rate**: ${currentPassRate}% (target: ${PASS_RATE_TARGET}%)
- **Iterations**: ${iterationHistory.length}/${MAX_ITERATIONS}
- **Total Tests**: ${finalIteration?.total || 0}
- **Passed**: ${finalIteration?.passed || 0}
- **Failed**: ${finalIteration?.total - finalIteration?.passed || 0}

### Strategy History
${iterationHistory.map(h => `- Iteration ${h.iteration}: ${h.strategy} → ${h.pass_rate}%`).join('\n')}

${!success ? `### Remaining Failures
${classifiedFailures.map(f => `- [${f.severity.toUpperCase()}] ${f.test}`).join('\n')}

${hasCriticalFailures ? '**CRITICAL failures detected - immediate attention required**' : ''}` : '### All tests passing'}`,
  summary: `Tests: ${currentPassRate}% pass rate (${iterationHistory.length} iterations)`
})

if (success) {
  TaskUpdate({ taskId: task.id, status: 'completed' })
} else {
  // Keep in_progress, coordinator decides next steps
}

// Check for next TEST task → back to Phase 1
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No TEST-* tasks available | Idle, wait for coordinator assignment |
| Test command not found | Detect framework, try alternatives (npm test, pytest, etc.) |
| Test execution timeout | Reduce test scope, retry with affected tests only |
| Regression detected (pass rate drops > 10%) | Switch to surgical strategy, consider rollback |
| Stuck tests (same failure 3+ iterations) | Report to coordinator, suggest different approach |
| Max iterations reached < 95% | Report failure details, let coordinator decide |
| No test files found | Report to coordinator, suggest test generation needed |
| Unexpected error | Log error via team_msg, report to coordinator |
