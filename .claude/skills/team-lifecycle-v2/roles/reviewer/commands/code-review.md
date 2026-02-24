# Code Review Command

## Purpose
4-dimension code review analyzing quality, security, architecture, and requirements compliance.

## Review Dimensions

### 1. Quality Review

```javascript
function reviewQuality(files, gitDiff) {
  const issues = {
    critical: [],
    high: [],
    medium: [],
    low: []
  }

  for (const file of files) {
    const content = file.content
    const lines = content.split("\n")

    // Check for @ts-ignore / @ts-expect-error
    lines.forEach((line, idx) => {
      if (line.includes("@ts-ignore") || line.includes("@ts-expect-error")) {
        const nextLine = lines[idx + 1] || ""
        const hasJustification = line.includes("//") && line.split("//")[1].trim().length > 10

        if (!hasJustification) {
          issues.high.push({
            file: file.path,
            line: idx + 1,
            type: "ts-ignore-without-justification",
            message: "TypeScript error suppression without explanation",
            code: line.trim()
          })
        }
      }
    })

    // Check for 'any' type usage
    const anyMatches = Grep("\\bany\\b", { path: file.path, "-n": true })
    if (anyMatches) {
      anyMatches.forEach(match => {
        // Exclude comments and type definitions that are intentionally generic
        if (!match.line.includes("//") && !match.line.includes("Generic")) {
          issues.high.push({
            file: file.path,
            line: match.lineNumber,
            type: "any-type-usage",
            message: "Using 'any' type reduces type safety",
            code: match.line.trim()
          })
        }
      })
    }

    // Check for console.log in production code
    const consoleMatches = Grep("console\\.(log|debug|info)", { path: file.path, "-n": true })
    if (consoleMatches && !file.path.includes("test")) {
      consoleMatches.forEach(match => {
        issues.high.push({
          file: file.path,
          line: match.lineNumber,
          type: "console-log",
          message: "Console statements should be removed from production code",
          code: match.line.trim()
        })
      })
    }

    // Check for empty catch blocks
    const emptyCatchRegex = /catch\s*\([^)]*\)\s*\{\s*\}/g
    let match
    while ((match = emptyCatchRegex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split("\n").length
      issues.critical.push({
        file: file.path,
        line: lineNumber,
        type: "empty-catch",
        message: "Empty catch block silently swallows errors",
        code: match[0]
      })
    }

    // Check for magic numbers
    const magicNumberRegex = /(?<![a-zA-Z0-9_])((?!0|1|2|10|100|1000)\d{2,})(?![a-zA-Z0-9_])/g
    while ((match = magicNumberRegex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split("\n").length
      const line = lines[lineNumber - 1]

      // Exclude if in comment or constant definition
      if (!line.includes("//") && !line.includes("const") && !line.includes("=")) {
        issues.medium.push({
          file: file.path,
          line: lineNumber,
          type: "magic-number",
          message: "Magic number should be extracted to named constant",
          code: line.trim()
        })
      }
    }

    // Check for duplicate code (simple heuristic: identical lines)
    const lineHashes = new Map()
    lines.forEach((line, idx) => {
      const trimmed = line.trim()
      if (trimmed.length > 30 && !trimmed.startsWith("//")) {
        if (!lineHashes.has(trimmed)) {
          lineHashes.set(trimmed, [])
        }
        lineHashes.get(trimmed).push(idx + 1)
      }
    })

    lineHashes.forEach((occurrences, line) => {
      if (occurrences.length > 2) {
        issues.medium.push({
          file: file.path,
          line: occurrences[0],
          type: "duplicate-code",
          message: `Duplicate code found at lines: ${occurrences.join(", ")}`,
          code: line
        })
      }
    })
  }

  return issues
}
```

### 2. Security Review

```javascript
function reviewSecurity(files) {
  const issues = {
    critical: [],
    high: [],
    medium: [],
    low: []
  }

  for (const file of files) {
    const content = file.content

    // Check for eval/exec usage
    const evalMatches = Grep("\\b(eval|exec|Function\\(|setTimeout\\(.*string|setInterval\\(.*string)\\b", {
      path: file.path,
      "-n": true
    })
    if (evalMatches) {
      evalMatches.forEach(match => {
        issues.high.push({
          file: file.path,
          line: match.lineNumber,
          type: "dangerous-eval",
          message: "eval/exec usage can lead to code injection vulnerabilities",
          code: match.line.trim()
        })
      })
    }

    // Check for innerHTML/dangerouslySetInnerHTML
    const innerHTMLMatches = Grep("(innerHTML|dangerouslySetInnerHTML)", {
      path: file.path,
      "-n": true
    })
    if (innerHTMLMatches) {
      innerHTMLMatches.forEach(match => {
        issues.high.push({
          file: file.path,
          line: match.lineNumber,
          type: "xss-risk",
          message: "Direct HTML injection can lead to XSS vulnerabilities",
          code: match.line.trim()
        })
      })
    }

    // Check for hardcoded secrets
    const secretPatterns = [
      /api[_-]?key\s*=\s*['"][^'"]{20,}['"]/i,
      /password\s*=\s*['"][^'"]+['"]/i,
      /secret\s*=\s*['"][^'"]{20,}['"]/i,
      /token\s*=\s*['"][^'"]{20,}['"]/i,
      /aws[_-]?access[_-]?key/i,
      /private[_-]?key\s*=\s*['"][^'"]+['"]/i
    ]

    secretPatterns.forEach(pattern => {
      const matches = content.match(new RegExp(pattern, "gm"))
      if (matches) {
        matches.forEach(match => {
          const lineNumber = content.substring(0, content.indexOf(match)).split("\n").length
          issues.critical.push({
            file: file.path,
            line: lineNumber,
            type: "hardcoded-secret",
            message: "Hardcoded secrets should be moved to environment variables",
            code: match.replace(/['"][^'"]+['"]/, "'***'") // Redact secret
          })
        })
      }
    })

    // Check for SQL injection vectors
    const sqlInjectionMatches = Grep("(query|execute)\\s*\\(.*\\+.*\\)", {
      path: file.path,
      "-n": true
    })
    if (sqlInjectionMatches) {
      sqlInjectionMatches.forEach(match => {
        if (!match.line.includes("//") && !match.line.includes("prepared")) {
          issues.critical.push({
            file: file.path,
            line: match.lineNumber,
            type: "sql-injection",
            message: "String concatenation in SQL queries can lead to SQL injection",
            code: match.line.trim()
          })
        }
      })
    }

    // Check for insecure random
    const insecureRandomMatches = Grep("Math\\.random\\(\\)", {
      path: file.path,
      "-n": true
    })
    if (insecureRandomMatches) {
      insecureRandomMatches.forEach(match => {
        // Check if used for security purposes
        const context = content.substring(
          Math.max(0, content.indexOf(match.line) - 200),
          content.indexOf(match.line) + 200
        )
        if (context.match(/token|key|secret|password|session/i)) {
          issues.medium.push({
            file: file.path,
            line: match.lineNumber,
            type: "insecure-random",
            message: "Math.random() is not cryptographically secure, use crypto.randomBytes()",
            code: match.line.trim()
          })
        }
      })
    }

    // Check for missing input validation
    const functionMatches = Grep("(function|const.*=.*\\(|async.*\\()", {
      path: file.path,
      "-n": true
    })
    if (functionMatches) {
      functionMatches.forEach(match => {
        // Simple heuristic: check if function has parameters but no validation
        if (match.line.includes("(") && !match.line.includes("()")) {
          const nextLines = content.split("\n").slice(match.lineNumber, match.lineNumber + 5).join("\n")
          const hasValidation = nextLines.match(/if\s*\(|throw|assert|validate|check/)

          if (!hasValidation && !match.line.includes("test") && !match.line.includes("mock")) {
            issues.low.push({
              file: file.path,
              line: match.lineNumber,
              type: "missing-validation",
              message: "Function parameters should be validated",
              code: match.line.trim()
            })
          }
        }
      })
    }
  }

  return issues
}
```

### 3. Architecture Review

```javascript
function reviewArchitecture(files) {
  const issues = {
    critical: [],
    high: [],
    medium: [],
    low: []
  }

  for (const file of files) {
    const content = file.content
    const lines = content.split("\n")

    // Check for parent directory imports
    const importMatches = Grep("from\\s+['\"](\\.\\./)+", {
      path: file.path,
      "-n": true
    })
    if (importMatches) {
      importMatches.forEach(match => {
        const parentLevels = (match.line.match(/\.\.\//g) || []).length

        if (parentLevels > 2) {
          issues.high.push({
            file: file.path,
            line: match.lineNumber,
            type: "excessive-parent-imports",
            message: `Import traverses ${parentLevels} parent directories, consider restructuring`,
            code: match.line.trim()
          })
        } else if (parentLevels === 2) {
          issues.medium.push({
            file: file.path,
            line: match.lineNumber,
            type: "parent-imports",
            message: "Consider using absolute imports or restructuring modules",
            code: match.line.trim()
          })
        }
      })
    }

    // Check for large files
    const lineCount = lines.length
    if (lineCount > 500) {
      issues.medium.push({
        file: file.path,
        line: 1,
        type: "large-file",
        message: `File has ${lineCount} lines, consider splitting into smaller modules`,
        code: `Total lines: ${lineCount}`
      })
    }

    // Check for circular dependencies (simple heuristic)
    const imports = lines
      .filter(line => line.match(/^import.*from/))
      .map(line => {
        const match = line.match(/from\s+['"](.+?)['"]/)
        return match ? match[1] : null
      })
      .filter(Boolean)

    // Check if any imported file imports this file back
    for (const importPath of imports) {
      const resolvedPath = resolveImportPath(file.path, importPath)
      if (resolvedPath && Bash(`test -f ${resolvedPath}`).exitCode === 0) {
        const importedContent = Read(resolvedPath)
        const reverseImport = importedContent.includes(file.path.replace(/\.[jt]sx?$/, ""))

        if (reverseImport) {
          issues.critical.push({
            file: file.path,
            line: 1,
            type: "circular-dependency",
            message: `Circular dependency detected with ${resolvedPath}`,
            code: `${file.path} ↔ ${resolvedPath}`
          })
        }
      }
    }

    // Check for tight coupling (many imports from same module)
    const importCounts = {}
    imports.forEach(imp => {
      const baseModule = imp.split("/")[0]
      importCounts[baseModule] = (importCounts[baseModule] || 0) + 1
    })

    Object.entries(importCounts).forEach(([module, count]) => {
      if (count > 5) {
        issues.medium.push({
          file: file.path,
          line: 1,
          type: "tight-coupling",
          message: `File imports ${count} items from '${module}', consider facade pattern`,
          code: `Imports from ${module}: ${count}`
        })
      }
    })

    // Check for missing abstractions (long functions)
    const functionRegex = /(function|const.*=.*\(|async.*\()/g
    let match
    while ((match = functionRegex.exec(content)) !== null) {
      const startLine = content.substring(0, match.index).split("\n").length
      const functionBody = extractFunctionBody(content, match.index)
      const functionLines = functionBody.split("\n").length

      if (functionLines > 50) {
        issues.medium.push({
          file: file.path,
          line: startLine,
          type: "long-function",
          message: `Function has ${functionLines} lines, consider extracting smaller functions`,
          code: match[0].trim()
        })
      }
    }
  }

  return issues
}

function resolveImportPath(fromFile, importPath) {
  if (importPath.startsWith(".")) {
    const dir = fromFile.substring(0, fromFile.lastIndexOf("/"))
    const resolved = `${dir}/${importPath}`.replace(/\/\.\//g, "/")

    // Try with extensions
    for (const ext of [".ts", ".js", ".tsx", ".jsx"]) {
      if (Bash(`test -f ${resolved}${ext}`).exitCode === 0) {
        return `${resolved}${ext}`
      }
    }
  }
  return null
}

function extractFunctionBody(content, startIndex) {
  let braceCount = 0
  let inFunction = false
  let body = ""

  for (let i = startIndex; i < content.length; i++) {
    const char = content[i]

    if (char === "{") {
      braceCount++
      inFunction = true
    } else if (char === "}") {
      braceCount--
    }

    if (inFunction) {
      body += char
    }

    if (inFunction && braceCount === 0) {
      break
    }
  }

  return body
}
```

### 4. Requirements Verification

```javascript
function verifyRequirements(plan, files, gitDiff) {
  const issues = {
    critical: [],
    high: [],
    medium: [],
    low: []
  }

  // Extract acceptance criteria from plan
  const acceptanceCriteria = extractAcceptanceCriteria(plan)

  // Verify each criterion
  for (const criterion of acceptanceCriteria) {
    const verified = verifyCriterion(criterion, files, gitDiff)

    if (!verified.met) {
      issues.high.push({
        file: "plan",
        line: criterion.lineNumber,
        type: "unmet-acceptance-criteria",
        message: `Acceptance criterion not met: ${criterion.text}`,
        code: criterion.text
      })
    } else if (verified.partial) {
      issues.medium.push({
        file: "plan",
        line: criterion.lineNumber,
        type: "partial-acceptance-criteria",
        message: `Acceptance criterion partially met: ${criterion.text}`,
        code: criterion.text
      })
    }
  }

  // Check for missing error handling
  const errorHandlingRequired = plan.match(/error handling|exception|validation/i)
  if (errorHandlingRequired) {
    const hasErrorHandling = files.some(file =>
      file.content.match(/try\s*\{|catch\s*\(|throw\s+new|\.catch\(/)
    )

    if (!hasErrorHandling) {
      issues.high.push({
        file: "implementation",
        line: 1,
        type: "missing-error-handling",
        message: "Plan requires error handling but none found in implementation",
        code: "No try-catch or error handling detected"
      })
    }
  }

  // Check for missing tests
  const testingRequired = plan.match(/test|testing|coverage/i)
  if (testingRequired) {
    const hasTests = files.some(file =>
      file.path.match(/\.(test|spec)\.[jt]sx?$/)
    )

    if (!hasTests) {
      issues.medium.push({
        file: "implementation",
        line: 1,
        type: "missing-tests",
        message: "Plan requires tests but no test files found",
        code: "No test files detected"
      })
    }
  }

  return issues
}

function extractAcceptanceCriteria(plan) {
  const criteria = []
  const lines = plan.split("\n")

  let inAcceptanceSection = false
  lines.forEach((line, idx) => {
    if (line.match(/acceptance criteria/i)) {
      inAcceptanceSection = true
    } else if (line.match(/^##/)) {
      inAcceptanceSection = false
    } else if (inAcceptanceSection && line.match(/^[-*]\s+/)) {
      criteria.push({
        text: line.replace(/^[-*]\s+/, "").trim(),
        lineNumber: idx + 1
      })
    }
  })

  return criteria
}

function verifyCriterion(criterion, files, gitDiff) {
  // Extract keywords from criterion
  const keywords = criterion.text.toLowerCase().match(/\b\w{4,}\b/g) || []

  // Check if keywords appear in implementation
  let matchCount = 0
  for (const file of files) {
    const content = file.content.toLowerCase()
    for (const keyword of keywords) {
      if (content.includes(keyword)) {
        matchCount++
      }
    }
  }

  const matchRatio = matchCount / keywords.length

  return {
    met: matchRatio >= 0.7,
    partial: matchRatio >= 0.4 && matchRatio < 0.7,
    matchRatio: matchRatio
  }
}
```

## Verdict Determination

```javascript
function determineVerdict(qualityIssues, securityIssues, architectureIssues, requirementIssues) {
  const allIssues = {
    critical: [
      ...qualityIssues.critical,
      ...securityIssues.critical,
      ...architectureIssues.critical,
      ...requirementIssues.critical
    ],
    high: [
      ...qualityIssues.high,
      ...securityIssues.high,
      ...architectureIssues.high,
      ...requirementIssues.high
    ],
    medium: [
      ...qualityIssues.medium,
      ...securityIssues.medium,
      ...architectureIssues.medium,
      ...requirementIssues.medium
    ],
    low: [
      ...qualityIssues.low,
      ...securityIssues.low,
      ...architectureIssues.low,
      ...requirementIssues.low
    ]
  }

  // BLOCK: Any critical issues
  if (allIssues.critical.length > 0) {
    return {
      verdict: "BLOCK",
      reason: `${allIssues.critical.length} critical issue(s) must be fixed`,
      blocking_issues: allIssues.critical
    }
  }

  // CONDITIONAL: High or medium issues
  if (allIssues.high.length > 0 || allIssues.medium.length > 0) {
    return {
      verdict: "CONDITIONAL",
      reason: `${allIssues.high.length} high and ${allIssues.medium.length} medium issue(s) should be addressed`,
      blocking_issues: []
    }
  }

  // APPROVE: Only low issues or none
  return {
    verdict: "APPROVE",
    reason: allIssues.low.length > 0
      ? `${allIssues.low.length} low-priority issue(s) noted`
      : "No issues found",
    blocking_issues: []
  }
}
```

## Report Formatting

```javascript
function formatCodeReviewReport(report) {
  const { verdict, dimensions, recommendations, blocking_issues } = report

  let markdown = `# Code Review Report\n\n`
  markdown += `**Verdict**: ${verdict}\n\n`

  if (blocking_issues.length > 0) {
    markdown += `## Blocking Issues\n\n`
    blocking_issues.forEach(issue => {
      markdown += `- **${issue.type}** (${issue.file}:${issue.line})\n`
      markdown += `  ${issue.message}\n`
      markdown += `  \`\`\`\n  ${issue.code}\n  \`\`\`\n\n`
    })
  }

  markdown += `## Review Dimensions\n\n`

  markdown += `### Quality Issues\n`
  markdown += formatIssuesByDimension(dimensions.quality)

  markdown += `### Security Issues\n`
  markdown += formatIssuesByDimension(dimensions.security)

  markdown += `### Architecture Issues\n`
  markdown += formatIssuesByDimension(dimensions.architecture)

  markdown += `### Requirements Issues\n`
  markdown += formatIssuesByDimension(dimensions.requirements)

  if (recommendations.length > 0) {
    markdown += `## Recommendations\n\n`
    recommendations.forEach((rec, i) => {
      markdown += `${i + 1}. ${rec}\n`
    })
  }

  return markdown
}

function formatIssuesByDimension(issues) {
  let markdown = ""

  const severities = ["critical", "high", "medium", "low"]
  severities.forEach(severity => {
    if (issues[severity].length > 0) {
      markdown += `\n**${severity.toUpperCase()}** (${issues[severity].length})\n\n`
      issues[severity].forEach(issue => {
        markdown += `- ${issue.message} (${issue.file}:${issue.line})\n`
        markdown += `  \`${issue.code}\`\n\n`
      })
    }
  })

  return markdown || "No issues found.\n\n"
}
```
