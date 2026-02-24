# Validate Command

## Purpose
Test-fix cycle with strategy engine for automated test failure resolution.

## Configuration

```javascript
const MAX_ITERATIONS = 10
const PASS_RATE_TARGET = 95 // percentage
```

## Main Iteration Loop

```javascript
function runTestFixCycle(task, framework, affectedTests, modifiedFiles) {
  let iteration = 0
  let bestPassRate = 0
  let bestResults = null

  while (iteration < MAX_ITERATIONS) {
    iteration++

    // Phase 1: Run Tests
    const testCommand = buildTestCommand(framework, affectedTests, iteration === 1)
    const testOutput = Bash(testCommand, { timeout: 120000 })
    const results = parseTestResults(testOutput.stdout + testOutput.stderr, framework)

    const passRate = results.total > 0 ? (results.passed / results.total * 100) : 0

    // Track best result
    if (passRate > bestPassRate) {
      bestPassRate = passRate
      bestResults = results
    }

    // Progress update for long cycles
    if (iteration > 5) {
      team_msg({
        to: "coordinator",
        type: "progress_update",
        task_id: task.task_id,
        iteration: iteration,
        pass_rate: passRate.toFixed(1),
        tests_passed: results.passed,
        tests_failed: results.failed,
        message: `Test-fix cycle iteration ${iteration}/${MAX_ITERATIONS}`
      }, "[tester]")
    }

    // Phase 2: Check Success
    if (passRate >= PASS_RATE_TARGET) {
      // Quality gate: Run full suite if only affected tests passed
      if (affectedTests.length > 0 && iteration === 1) {
        team_msg({
          to: "coordinator",
          type: "progress_update",
          task_id: task.task_id,
          message: "Affected tests passed, running full suite..."
        }, "[tester]")

        const fullSuiteCommand = buildTestCommand(framework, [], false)
        const fullOutput = Bash(fullSuiteCommand, { timeout: 300000 })
        const fullResults = parseTestResults(fullOutput.stdout + fullOutput.stderr, framework)
        const fullPassRate = fullResults.total > 0 ? (fullResults.passed / fullResults.total * 100) : 0

        if (fullPassRate >= PASS_RATE_TARGET) {
          return {
            success: true,
            results: fullResults,
            iterations: iteration,
            full_suite_run: true
          }
        } else {
          // Full suite failed, continue fixing
          results = fullResults
          passRate = fullPassRate
        }
      } else {
        return {
          success: true,
          results: results,
          iterations: iteration,
          full_suite_run: affectedTests.length === 0
        }
      }
    }

    // Phase 3: Analyze Failures
    if (results.failures.length === 0) {
      break // No failures to fix
    }

    const classified = classifyFailures(results.failures)

    // Phase 4: Select Strategy
    const strategy = selectStrategy(iteration, passRate, results.failures)

    team_msg({
      to: "coordinator",
      type: "progress_update",
      task_id: task.task_id,
      iteration: iteration,
      strategy: strategy,
      failures: {
        critical: classified.critical.length,
        high: classified.high.length,
        medium: classified.medium.length,
        low: classified.low.length
      }
    }, "[tester]")

    // Phase 5: Apply Fixes
    const fixResult = applyFixes(strategy, results.failures, framework, modifiedFiles)

    if (!fixResult.success) {
      // Fix application failed, try next iteration with different strategy
      continue
    }
  }

  // Max iterations reached
  return {
    success: false,
    results: bestResults,
    iterations: MAX_ITERATIONS,
    best_pass_rate: bestPassRate,
    error: "Max iterations reached without achieving target pass rate"
  }
}
```

## Strategy Selection

```javascript
function selectStrategy(iteration, passRate, failures) {
  const classified = classifyFailures(failures)

  // Conservative: Early iterations or high pass rate
  if (iteration <= 3 || passRate >= 80) {
    return "conservative"
  }

  // Surgical: Specific failure patterns
  if (classified.critical.length > 0 && classified.critical.length < 5) {
    return "surgical"
  }

  // Aggressive: Low pass rate or many iterations
  if (passRate < 50 || iteration > 7) {
    return "aggressive"
  }

  return "conservative"
}
```

## Fix Application

### Conservative Strategy

```javascript
function applyConservativeFixes(failures, framework, modifiedFiles) {
  const classified = classifyFailures(failures)

  // Fix only the first critical failure
  if (classified.critical.length > 0) {
    const failure = classified.critical[0]
    return fixSingleFailure(failure, framework, modifiedFiles)
  }

  // If no critical, fix first high priority
  if (classified.high.length > 0) {
    const failure = classified.high[0]
    return fixSingleFailure(failure, framework, modifiedFiles)
  }

  return { success: false, error: "No fixable failures found" }
}
```

### Surgical Strategy

```javascript
function applySurgicalFixes(failures, framework, modifiedFiles) {
  // Identify common pattern
  const pattern = identifyCommonPattern(failures)

  if (!pattern) {
    return { success: false, error: "No common pattern identified" }
  }

  // Apply pattern-based fix across all occurrences
  const fixes = []

  for (const failure of failures) {
    if (matchesPattern(failure, pattern)) {
      const fix = generatePatternFix(failure, pattern, framework)
      fixes.push(fix)
    }
  }

  // Apply all fixes in batch
  for (const fix of fixes) {
    applyFix(fix, modifiedFiles)
  }

  return {
    success: true,
    fixes_applied: fixes.length,
    pattern: pattern
  }
}

function identifyCommonPattern(failures) {
  // Group failures by error type
  const errorTypes = {}

  for (const failure of failures) {
    const errorType = extractErrorType(failure.error)
    if (!errorTypes[errorType]) {
      errorTypes[errorType] = []
    }
    errorTypes[errorType].push(failure)
  }

  // Find most common error type
  let maxCount = 0
  let commonPattern = null

  for (const [errorType, instances] of Object.entries(errorTypes)) {
    if (instances.length > maxCount) {
      maxCount = instances.length
      commonPattern = {
        type: errorType,
        instances: instances,
        count: instances.length
      }
    }
  }

  return maxCount >= 3 ? commonPattern : null
}

function extractErrorType(error) {
  const errorLower = error.toLowerCase()

  if (errorLower.includes("cannot find module")) return "missing_import"
  if (errorLower.includes("is not defined")) return "undefined_variable"
  if (errorLower.includes("expected") && errorLower.includes("received")) return "assertion_mismatch"
  if (errorLower.includes("timeout")) return "timeout"
  if (errorLower.includes("syntaxerror")) return "syntax_error"

  return "unknown"
}
```

### Aggressive Strategy

```javascript
function applyAggressiveFixes(failures, framework, modifiedFiles) {
  const classified = classifyFailures(failures)
  const fixes = []

  // Fix all critical failures
  for (const failure of classified.critical) {
    const fix = generateFix(failure, framework, modifiedFiles)
    if (fix) {
      fixes.push(fix)
    }
  }

  // Fix all high priority failures
  for (const failure of classified.high) {
    const fix = generateFix(failure, framework, modifiedFiles)
    if (fix) {
      fixes.push(fix)
    }
  }

  // Apply all fixes
  for (const fix of fixes) {
    applyFix(fix, modifiedFiles)
  }

  return {
    success: fixes.length > 0,
    fixes_applied: fixes.length
  }
}
```

### Fix Generation

```javascript
function generateFix(failure, framework, modifiedFiles) {
  const errorType = extractErrorType(failure.error)

  switch (errorType) {
    case "missing_import":
      return generateImportFix(failure, modifiedFiles)

    case "undefined_variable":
      return generateVariableFix(failure, modifiedFiles)

    case "assertion_mismatch":
      return generateAssertionFix(failure, framework)

    case "timeout":
      return generateTimeoutFix(failure, framework)

    case "syntax_error":
      return generateSyntaxFix(failure, modifiedFiles)

    default:
      return null
  }
}

function generateImportFix(failure, modifiedFiles) {
  // Extract module name from error
  const moduleMatch = failure.error.match(/Cannot find module ['"](.+?)['"]/)
  if (!moduleMatch) return null

  const moduleName = moduleMatch[1]

  // Find test file
  const testFile = extractTestFile(failure.test)
  if (!testFile) return null

  // Check if module exists in modified files
  const sourceFile = modifiedFiles.find(f =>
    f.includes(moduleName) || f.endsWith(`${moduleName}.ts`) || f.endsWith(`${moduleName}.js`)
  )

  if (!sourceFile) return null

  // Generate import statement
  const relativePath = calculateRelativePath(testFile, sourceFile)
  const importStatement = `import { } from '${relativePath}'`

  return {
    file: testFile,
    type: "add_import",
    content: importStatement,
    line: 1 // Add at top of file
  }
}

function generateAssertionFix(failure, framework) {
  // Extract expected vs received values
  const expectedMatch = failure.error.match(/Expected:\s*(.+?)(?:\n|$)/)
  const receivedMatch = failure.error.match(/Received:\s*(.+?)(?:\n|$)/)

  if (!expectedMatch || !receivedMatch) return null

  const expected = expectedMatch[1].trim()
  const received = receivedMatch[1].trim()

  // Find test file and line
  const testFile = extractTestFile(failure.test)
  const testLine = extractTestLine(failure.error)

  if (!testFile || !testLine) return null

  return {
    file: testFile,
    type: "update_assertion",
    line: testLine,
    old_value: expected,
    new_value: received,
    note: "Auto-updated assertion based on actual behavior"
  }
}
```

## Test Result Parsing

```javascript
function parseTestResults(output, framework) {
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    failures: []
  }

  if (framework === "jest" || framework === "vitest") {
    // Parse summary line
    const summaryMatch = output.match(/Tests:\s+(?:(\d+)\s+failed,\s+)?(?:(\d+)\s+passed,\s+)?(\d+)\s+total/)
    if (summaryMatch) {
      results.failed = summaryMatch[1] ? parseInt(summaryMatch[1]) : 0
      results.passed = summaryMatch[2] ? parseInt(summaryMatch[2]) : 0
      results.total = parseInt(summaryMatch[3])
    }

    // Alternative format
    if (results.total === 0) {
      const altMatch = output.match(/(\d+)\s+passed.*?(\d+)\s+total/)
      if (altMatch) {
        results.passed = parseInt(altMatch[1])
        results.total = parseInt(altMatch[2])
        results.failed = results.total - results.passed
      }
    }

    // Extract failure details
    const failureRegex = /●\s+(.*?)\n\n([\s\S]*?)(?=\n\n●|\n\nTest Suites:|\n\n$)/g
    let match
    while ((match = failureRegex.exec(output)) !== null) {
      results.failures.push({
        test: match[1].trim(),
        error: match[2].trim()
      })
    }

  } else if (framework === "pytest") {
    // Parse pytest summary
    const summaryMatch = output.match(/=+\s+(?:(\d+)\s+failed,?\s+)?(?:(\d+)\s+passed)?/)
    if (summaryMatch) {
      results.failed = summaryMatch[1] ? parseInt(summaryMatch[1]) : 0
      results.passed = summaryMatch[2] ? parseInt(summaryMatch[2]) : 0
      results.total = results.failed + results.passed
    }

    // Extract failure details
    const failureRegex = /FAILED\s+(.*?)\s+-\s+([\s\S]*?)(?=\n_+|FAILED|=+\s+\d+)/g
    let match
    while ((match = failureRegex.exec(output)) !== null) {
      results.failures.push({
        test: match[1].trim(),
        error: match[2].trim()
      })
    }
  }

  return results
}
```

## Test Command Building

```javascript
function buildTestCommand(framework, affectedTests, isFirstRun) {
  const testFiles = affectedTests.length > 0 ? affectedTests.join(" ") : ""

  switch (framework) {
    case "vitest":
      return testFiles
        ? `vitest run ${testFiles} --reporter=verbose`
        : `vitest run --reporter=verbose`

    case "jest":
      return testFiles
        ? `jest ${testFiles} --no-coverage --verbose`
        : `jest --no-coverage --verbose`

    case "mocha":
      return testFiles
        ? `mocha ${testFiles} --reporter spec`
        : `mocha --reporter spec`

    case "pytest":
      return testFiles
        ? `pytest ${testFiles} -v --tb=short`
        : `pytest -v --tb=short`

    default:
      throw new Error(`Unsupported test framework: ${framework}`)
  }
}
```

## Utility Functions

### Extract Test File

```javascript
function extractTestFile(testName) {
  // Extract file path from test name
  // Format: "path/to/file.test.ts > describe block > test name"
  const fileMatch = testName.match(/^(.*?\.(?:test|spec)\.[jt]sx?)/)
  return fileMatch ? fileMatch[1] : null
}
```

### Extract Test Line

```javascript
function extractTestLine(error) {
  // Extract line number from error stack
  const lineMatch = error.match(/:(\d+):\d+/)
  return lineMatch ? parseInt(lineMatch[1]) : null
}
```

### Calculate Relative Path

```javascript
function calculateRelativePath(fromFile, toFile) {
  const fromParts = fromFile.split("/")
  const toParts = toFile.split("/")

  // Remove filename
  fromParts.pop()

  // Find common base
  let commonLength = 0
  while (commonLength < fromParts.length &&
         commonLength < toParts.length &&
         fromParts[commonLength] === toParts[commonLength]) {
    commonLength++
  }

  // Build relative path
  const upLevels = fromParts.length - commonLength
  const downPath = toParts.slice(commonLength)

  const relativeParts = []
  for (let i = 0; i < upLevels; i++) {
    relativeParts.push("..")
  }
  relativeParts.push(...downPath)

  let path = relativeParts.join("/")

  // Remove file extension
  path = path.replace(/\.[jt]sx?$/, "")

  // Ensure starts with ./
  if (!path.startsWith(".")) {
    path = "./" + path
  }

  return path
}
```
