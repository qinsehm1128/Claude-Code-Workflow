# Review Prompts

## One-Liner

**Review prompts are standardized templates for code review** — multi-dimensional code quality checks ensuring code meets best practices.

## Review Dimensions

| Dimension | Check Items | Severity |
|-----------|-------------|----------|
| **Correctness** | Logic errors, boundary conditions, type safety | Critical |
| **Security** | Injection vulnerabilities, authentication, input validation | Critical |
| **Performance** | Algorithm complexity, N+1 queries, caching opportunities | High |
| **Maintainability** | SOLID principles, code duplication, naming conventions | Medium |
| **Documentation** | Comment completeness, README updates | Low |

## codex-review

**Function**: Interactive code review using Codex CLI via ccw endpoint, supporting configurable review targets, models, and custom instructions.

**Syntax**:
```bash
/cli:codex-review [--uncommitted|--base <branch>|--commit <sha>] [--model <model>] [--title <title>] [prompt]
```

**Parameters**:
- `--uncommitted`: Review staged, unstaged, and untracked changes
- `--base <branch>`: Compare changes with base branch
- `--commit <sha>`: Review changes introduced by specific commit
- `--model <model>`: Override default model (gpt-5.2, o3, gpt-4.1, o4-mini)
- `--title <title>`: Optional commit title for review summary

**Note**: Target flags and prompt are mutually exclusive (see constraints section)

### Review Focus Selection

| Focus | Template | Key Checks |
|-------|----------|------------|
| **Comprehensive Review** | Universal template | Correctness, style, bugs, documentation |
| **Security Focus** | Security template | Injection, authentication, validation, exposure |
| **Performance Focus** | Performance template | Complexity, memory, queries, caching |
| **Code Quality** | Quality template | SOLID, duplication, naming, tests |

### Prompt Templates

#### Comprehensive Review Template

```
PURPOSE: Comprehensive code review to identify issues, improve quality, and ensure best practices; success = actionable feedback and clear priorities
TASK: • Review code correctness and logic errors • Check coding standards and consistency • Identify potential bugs and edge cases • Evaluate documentation completeness
MODE: review
CONTEXT: {target description} | Memory: Project conventions from CLAUDE.md
EXPECTED: Structured review report with: severity levels (Critical/High/Medium/Low), file:line references, specific improvement suggestions, priority rankings
CONSTRAINTS: Focus on actionable feedback
```

#### Security Focus Template

```
PURPOSE: Security-focused code review to identify vulnerabilities and security risks; success = all security issues documented with fixes
TASK: • Scan for injection vulnerabilities (SQL, XSS, command) • Check authentication and authorization logic • Evaluate input validation and sanitization • Identify sensitive data exposure risks
MODE: review
CONTEXT: {target description} | Memory: Security best practices, OWASP Top 10
EXPECTED: Security report with: vulnerability classification, applicable CVE references, fix code snippets, risk severity matrix
CONSTRAINTS: Security-first analysis | Flag all potential vulnerabilities
```

#### Performance Focus Template

```
PURPOSE: Performance-focused code review to identify bottlenecks and optimization opportunities; success = measurable improvement suggestions
TASK: • Analyze algorithm complexity (Big-O) • Identify memory allocation issues • Check N+1 queries and blocking operations • Evaluate caching opportunities
MODE: review
CONTEXT: {target description} | Memory: Performance patterns and anti-patterns
EXPECTED: Performance report with: complexity analysis, bottleneck identification, optimization suggestions with expected impact, benchmark recommendations
CONSTRAINTS: Performance optimization focus
```

#### Code Quality Template

```
PURPOSE: Code quality review to improve maintainability and readability; success = cleaner, more maintainable code
TASK: • Evaluate SOLID principles compliance • Identify code duplication and abstraction opportunities • Review naming conventions and clarity • Evaluate test coverage impact
MODE: review
CONTEXT: {target description} | Memory: Project coding standards
EXPECTED: Quality report with: principle violations, refactoring suggestions, naming improvements, maintainability score
CONSTRAINTS: Code quality and maintainability focus
```

### Usage Examples

#### Direct Execution (No Interaction)

```bash
# Review uncommitted changes with default settings
/cli:codex-review --uncommitted

# Compare with main branch
/cli:codex-review --base main

# Review specific commit
/cli:codex-review --commit abc123

# Use custom model
/cli:codex-review --uncommitted --model o3

# Security focus review
/cli:codex-review --uncommitted security

# Full options
/cli:codex-review --base main --model o3 --title "Authentication feature" security
```

#### Interactive Mode

```bash
# Start interactive selection (guided flow)
/cli:codex-review
```

### Constraints and Validation

**Important**: Target flags and prompt are mutually exclusive

Codex CLI has a constraint that target flags (`--uncommitted`, `--base`, `--commit`) cannot be used with the `[PROMPT]` positional parameter:

```
error: the argument '--uncommitted' cannot be used with '[PROMPT]'
error: the argument '--base <BRANCH>' cannot be used with '[PROMPT]'
error: the argument '--commit <SHA>' cannot be used with '[PROMPT]'
```

**Valid Combinations**:

| Command | Result |
|---------|--------|
| `codex review "focus on security"` | ✓ Custom prompt, reviews uncommitted (default) |
| `codex review --uncommitted` | ✓ No prompt, uses default review |
| `codex review --base main` | ✓ No prompt, uses default review |
| `codex review --commit abc123` | ✓ No prompt, uses default review |
| `codex review --uncommitted "prompt"` | ✗ Invalid - mutually exclusive |
| `codex review --base main "prompt"` | ✗ Invalid - mutually exclusive |
| `codex review --commit abc123 "prompt"` | ✗ Invalid - mutually exclusive |

**Valid Examples**:
```bash
# ✓ Valid: Prompt only (defaults to reviewing uncommitted)
ccw cli -p "focus on security" --tool codex --mode review

# ✓ Valid: Target flags only (no prompt)
ccw cli --tool codex --mode review --uncommitted
ccw cli --tool codex --mode review --base main
ccw cli --tool codex --mode review --commit abc123

# ✗ Invalid: Target flags with prompt (will fail)
ccw cli -p "review this" --tool codex --mode review --uncommitted
```

## Focus Area Mapping

| User Selection | Prompt Focus | Key Checks |
|----------------|--------------|------------|
| Comprehensive Review | Comprehensive | Correctness, style, bugs, documentation |
| Security Focus | Security-first | Injection, authentication, validation, exposure |
| Performance Focus | Optimization | Complexity, memory, queries, caching |
| Code Quality | Maintainability | SOLID, duplication, naming, tests |

## Error Handling

### No Changes to Review

```
No changes found for review target. Suggestions:
- For --uncommitted: Make some code changes first
- For --base: Ensure branch exists and has diverged
- For --commit: Verify commit SHA exists
```

### Invalid Branch

```bash
# Show available branches
git branch -a --list | head -20
```

### Invalid Commit

```bash
# Show recent commits
git log --oneline -10
```

## Related Documentation

- [Prep Prompts](./prep.md)
- [CLI Tool Commands](../claude/cli.md)
- [Code Review](../../features/spec)
