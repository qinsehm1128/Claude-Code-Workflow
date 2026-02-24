# Command: scan-debt

> 多维度 CLI Fan-out 技术债务扫描。从代码质量、架构、测试、依赖、文档 5 个维度并行分析代码，发现技术债务。

## When to Use

- Phase 3 of Scanner
- 需要对代码库进行多维度技术债务扫描
- 复杂度为 Medium 或 High 时使用 CLI Fan-out

**Trigger conditions**:
- TDSCAN-* 任务进入 Phase 3
- 复杂度评估为 Medium/High
- 需要深度分析超出 ACE 搜索能力

## Strategy

### Delegation Mode

**Mode**: CLI Fan-out
**CLI Tool**: `gemini` (primary)
**CLI Mode**: `analysis`
**Parallel Dimensions**: 3-5（根据复杂度）

### Decision Logic

```javascript
// 复杂度决定扫描策略
if (complexity === 'Low') {
  // ACE 搜索 + Grep 内联分析（不使用 CLI）
  mode = 'inline'
} else if (complexity === 'Medium') {
  // CLI Fan-out: 3 个核心维度
  mode = 'cli-fanout'
  activeDimensions = ['code', 'testing', 'dependency']
} else {
  // CLI Fan-out: 所有 5 个维度
  mode = 'cli-fanout'
  activeDimensions = dimensions
}
```

## Execution Steps

### Step 1: Context Preparation

```javascript
// 确定扫描范围
const projectRoot = Bash(`git rev-parse --show-toplevel 2>/dev/null || pwd`).trim()
const scanScope = task.description.match(/scope:\s*(.+)/)?.[1] || '**/*'

// 获取变更文件用于聚焦扫描
const changedFiles = Bash(`git diff --name-only HEAD~10 2>/dev/null || echo ""`)
  .split('\n').filter(Boolean)

// 构建文件上下文
const fileContext = changedFiles.length > 0
  ? changedFiles.map(f => `@${f}`).join(' ')
  : `@${scanScope}`
```

### Step 2: Execute Strategy

```javascript
if (mode === 'inline') {
  // 快速内联扫描
  const aceResults = mcp__ace-tool__search_context({
    project_root_path: projectRoot,
    query: "code smells, TODO/FIXME, deprecated APIs, complex functions, dead code, missing tests, circular imports"
  })
  // 解析 ACE 结果并分类到维度
} else {
  // CLI Fan-out: 每个维度一个 CLI 调用
  const dimensionPrompts = {
    'code': `PURPOSE: Identify code quality debt - complexity, duplication, code smells
TASK: • Find functions with cyclomatic complexity > 10 • Detect code duplication (>20 lines) • Identify code smells (God class, long method, feature envy) • Find TODO/FIXME/HACK comments • Detect dead code and unused exports
MODE: analysis
CONTEXT: ${fileContext}
EXPECTED: List of findings with severity (critical/high/medium/low), file:line, description, estimated fix effort (small/medium/large)
CONSTRAINTS: Focus on actionable items, skip generated code`,

    'architecture': `PURPOSE: Identify architecture debt - coupling, circular dependencies, layering violations
TASK: • Detect circular dependencies between modules • Find tight coupling between components • Identify layering violations (e.g., UI importing DB) • Check for God modules with too many responsibilities • Find missing abstraction layers
MODE: analysis
CONTEXT: ${fileContext}
EXPECTED: Architecture debt findings with severity, affected modules, dependency graph issues
CONSTRAINTS: Focus on structural issues, not style`,

    'testing': `PURPOSE: Identify testing debt - coverage gaps, test quality, missing test types
TASK: • Find modules without any test files • Identify complex logic without test coverage • Check for test anti-patterns (flaky tests, hardcoded values) • Find missing edge case tests • Detect test files that import from test utilities incorrectly
MODE: analysis
CONTEXT: ${fileContext}
EXPECTED: Testing debt findings with severity, affected files, missing test type (unit/integration/e2e)
CONSTRAINTS: Focus on high-risk untested code paths`,

    'dependency': `PURPOSE: Identify dependency debt - outdated packages, vulnerabilities, unnecessary deps
TASK: • Find outdated major-version dependencies • Identify known vulnerability packages • Detect unused dependencies • Find duplicate functionality from different packages • Check for pinned vs range versions
MODE: analysis
CONTEXT: @package.json @package-lock.json @requirements.txt @go.mod @pom.xml
EXPECTED: Dependency debt with severity, package name, current vs latest version, CVE references
CONSTRAINTS: Focus on security and compatibility risks`,

    'documentation': `PURPOSE: Identify documentation debt - missing docs, stale docs, undocumented APIs
TASK: • Find public APIs without JSDoc/docstrings • Identify README files that are outdated • Check for missing architecture documentation • Find configuration options without documentation • Detect stale comments that don't match code
MODE: analysis
CONTEXT: ${fileContext}
EXPECTED: Documentation debt with severity, file:line, type (missing/stale/incomplete)
CONSTRAINTS: Focus on public interfaces and critical paths`
  }

  for (const dimension of activeDimensions) {
    const prompt = dimensionPrompts[dimension]
    if (!prompt) continue

    Bash(`ccw cli -p "${prompt}" --tool gemini --mode analysis --rule analysis-analyze-code-patterns`, {
      run_in_background: true
    })
  }

  // 等待所有 CLI 完成（hook 回调通知）
}
```

### Step 3: Result Processing

```javascript
// 聚合所有维度的结果
const allFindings = []

// 从 CLI 输出解析结果
for (const dimension of activeDimensions) {
  const findings = parseCliOutput(cliResults[dimension])
  for (const finding of findings) {
    finding.dimension = dimension
    allFindings.push(finding)
  }
}

// 去重：相同 file:line 的发现合并
function deduplicateFindings(findings) {
  const seen = new Set()
  const unique = []
  for (const f of findings) {
    const key = `${f.file}:${f.line}:${f.dimension}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(f)
    }
  }
  return unique
}

const deduped = deduplicateFindings(allFindings)

// 按严重性排序
deduped.sort((a, b) => {
  const order = { critical: 0, high: 1, medium: 2, low: 3 }
  return (order[a.severity] || 3) - (order[b.severity] || 3)
})
```

## Output Format

```
## Debt Scan Results

### Dimensions Scanned: [list]
### Complexity: [Low|Medium|High]

### Findings by Dimension
#### Code Quality ([count])
- [file:line] [severity] - [description]

#### Architecture ([count])
- [module] [severity] - [description]

#### Testing ([count])
- [file:line] [severity] - [description]

#### Dependency ([count])
- [package] [severity] - [description]

#### Documentation ([count])
- [file:line] [severity] - [description]

### Total Debt Items: [count]
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| CLI tool unavailable | Fall back to ACE search + Grep inline analysis |
| CLI returns empty for a dimension | Note incomplete dimension, continue others |
| Too many findings (>100) | Prioritize critical/high, summarize medium/low |
| Timeout on CLI call | Use partial results, note incomplete dimensions |
| Agent/CLI failure | Retry once, then fallback to inline execution |
| Timeout (>5 min per dimension) | Report partial results, notify scanner |
