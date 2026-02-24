# Spec Quality Command

## Purpose
5-dimension spec quality check with readiness report generation and quality gate determination.

## Quality Dimensions

### 1. Completeness (Weight: 25%)

```javascript
function scoreCompleteness(specDocs) {
  const requiredSections = {
    "product-brief": [
      "Vision Statement",
      "Problem Statement",
      "Target Audience",
      "Success Metrics",
      "Constraints"
    ],
    "prd": [
      "Goals",
      "Requirements",
      "User Stories",
      "Acceptance Criteria",
      "Non-Functional Requirements"
    ],
    "architecture": [
      "System Overview",
      "Component Design",
      "Data Models",
      "API Specifications",
      "Technology Stack"
    ],
    "user-stories": [
      "Story List",
      "Acceptance Criteria",
      "Priority",
      "Estimation"
    ],
    "implementation-plan": [
      "Task Breakdown",
      "Dependencies",
      "Timeline",
      "Resource Allocation"
    ],
    "test-strategy": [
      "Test Scope",
      "Test Cases",
      "Coverage Goals",
      "Test Environment"
    ]
  }

  let totalScore = 0
  let totalWeight = 0
  const details = []

  for (const doc of specDocs) {
    const phase = doc.phase
    const expectedSections = requiredSections[phase] || []

    if (expectedSections.length === 0) continue

    let presentCount = 0
    let substantialCount = 0

    for (const section of expectedSections) {
      const sectionRegex = new RegExp(`##\\s+${section}`, "i")
      const sectionMatch = doc.content.match(sectionRegex)

      if (sectionMatch) {
        presentCount++

        // Check if section has substantial content (not just header)
        const sectionIndex = doc.content.indexOf(sectionMatch[0])
        const nextSectionIndex = doc.content.indexOf("\n##", sectionIndex + 1)
        const sectionContent = nextSectionIndex > -1
          ? doc.content.substring(sectionIndex, nextSectionIndex)
          : doc.content.substring(sectionIndex)

        // Substantial = more than 100 chars excluding header
        const contentWithoutHeader = sectionContent.replace(sectionRegex, "").trim()
        if (contentWithoutHeader.length > 100) {
          substantialCount++
        }
      }
    }

    const presentRatio = presentCount / expectedSections.length
    const substantialRatio = substantialCount / expectedSections.length

    // Score: 50% for presence, 50% for substance
    const docScore = (presentRatio * 50) + (substantialRatio * 50)

    totalScore += docScore
    totalWeight += 100

    details.push({
      phase: phase,
      score: docScore,
      present: presentCount,
      substantial: substantialCount,
      expected: expectedSections.length,
      missing: expectedSections.filter(s => !doc.content.match(new RegExp(`##\\s+${s}`, "i")))
    })
  }

  const overallScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0

  return {
    score: overallScore,
    weight: 25,
    weighted_score: overallScore * 0.25,
    details: details
  }
}
```

### 2. Consistency (Weight: 20%)

```javascript
function scoreConsistency(specDocs) {
  const issues = []

  // 1. Terminology consistency
  const terminologyMap = new Map()

  for (const doc of specDocs) {
    // Extract key terms (capitalized phrases, technical terms)
    const terms = doc.content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []

    terms.forEach(term => {
      const normalized = term.toLowerCase()
      if (!terminologyMap.has(normalized)) {
        terminologyMap.set(normalized, new Set())
      }
      terminologyMap.get(normalized).add(term)
    })
  }

  // Find inconsistent terminology (same concept, different casing/spelling)
  terminologyMap.forEach((variants, normalized) => {
    if (variants.size > 1) {
      issues.push({
        type: "terminology",
        severity: "medium",
        message: `Inconsistent terminology: ${[...variants].join(", ")}`,
        suggestion: `Standardize to one variant`
      })
    }
  })

  // 2. Format consistency
  const headerStyles = new Map()
  for (const doc of specDocs) {
    const headers = doc.content.match(/^#{1,6}\s+.+$/gm) || []
    headers.forEach(header => {
      const level = header.match(/^#+/)[0].length
      const style = header.includes("**") ? "bold" : "plain"
      const key = `level-${level}`

      if (!headerStyles.has(key)) {
        headerStyles.set(key, new Set())
      }
      headerStyles.get(key).add(style)
    })
  }

  headerStyles.forEach((styles, level) => {
    if (styles.size > 1) {
      issues.push({
        type: "format",
        severity: "low",
        message: `Inconsistent header style at ${level}: ${[...styles].join(", ")}`,
        suggestion: "Use consistent header formatting"
      })
    }
  })

  // 3. Reference consistency
  const references = new Map()
  for (const doc of specDocs) {
    // Extract references to other documents/sections
    const refs = doc.content.match(/\[.*?\]\(.*?\)/g) || []
    refs.forEach(ref => {
      const linkMatch = ref.match(/\((.*?)\)/)
      if (linkMatch) {
        const link = linkMatch[1]
        if (!references.has(link)) {
          references.set(link, [])
        }
        references.get(link).push(doc.phase)
      }
    })
  }

  // Check for broken references
  references.forEach((sources, link) => {
    if (link.startsWith("./") || link.startsWith("../")) {
      // Check if file exists
      const exists = Bash(`test -f ${link}`).exitCode === 0
      if (!exists) {
        issues.push({
          type: "reference",
          severity: "high",
          message: `Broken reference: ${link} (referenced in ${sources.join(", ")})`,
          suggestion: "Fix or remove broken reference"
        })
      }
    }
  })

  // 4. Naming convention consistency
  const namingPatterns = {
    camelCase: /\b[a-z]+(?:[A-Z][a-z]+)+\b/g,
    PascalCase: /\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g,
    snake_case: /\b[a-z]+(?:_[a-z]+)+\b/g,
    kebab_case: /\b[a-z]+(?:-[a-z]+)+\b/g
  }

  const namingCounts = {}
  for (const doc of specDocs) {
    Object.entries(namingPatterns).forEach(([pattern, regex]) => {
      const matches = doc.content.match(regex) || []
      namingCounts[pattern] = (namingCounts[pattern] || 0) + matches.length
    })
  }

  const dominantPattern = Object.entries(namingCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0]

  Object.entries(namingCounts).forEach(([pattern, count]) => {
    if (pattern !== dominantPattern && count > 10) {
      issues.push({
        type: "naming",
        severity: "low",
        message: `Mixed naming conventions: ${pattern} (${count} occurrences) vs ${dominantPattern}`,
        suggestion: `Standardize to ${dominantPattern}`
      })
    }
  })

  // Calculate score based on issues
  const severityWeights = { high: 10, medium: 5, low: 2 }
  const totalPenalty = issues.reduce((sum, issue) => sum + severityWeights[issue.severity], 0)
  const maxPenalty = 100 // Arbitrary max for normalization

  const score = Math.max(0, 100 - (totalPenalty / maxPenalty) * 100)

  return {
    score: score,
    weight: 20,
    weighted_score: score * 0.20,
    issues: issues,
    details: {
      terminology_issues: issues.filter(i => i.type === "terminology").length,
      format_issues: issues.filter(i => i.type === "format").length,
      reference_issues: issues.filter(i => i.type === "reference").length,
      naming_issues: issues.filter(i => i.type === "naming").length
    }
  }
}
```

### 3. Traceability (Weight: 25%)

```javascript
function scoreTraceability(specDocs) {
  const chains = []

  // Extract traceability elements
  const goals = extractElements(specDocs, "product-brief", /^[-*]\s+Goal:\s*(.+)$/gm)
  const requirements = extractElements(specDocs, "prd", /^[-*]\s+(?:REQ-\d+|Requirement):\s*(.+)$/gm)
  const components = extractElements(specDocs, "architecture", /^[-*]\s+(?:Component|Module):\s*(.+)$/gm)
  const stories = extractElements(specDocs, "user-stories", /^[-*]\s+(?:US-\d+|Story):\s*(.+)$/gm)

  // Build traceability chains: Goals → Requirements → Components → Stories
  for (const goal of goals) {
    const chain = {
      goal: goal.text,
      requirements: [],
      components: [],
      stories: [],
      complete: false
    }

    // Find requirements that reference this goal
    const goalKeywords = extractKeywords(goal.text)
    for (const req of requirements) {
      if (hasKeywordOverlap(req.text, goalKeywords, 0.3)) {
        chain.requirements.push(req.text)

        // Find components that implement this requirement
        const reqKeywords = extractKeywords(req.text)
        for (const comp of components) {
          if (hasKeywordOverlap(comp.text, reqKeywords, 0.3)) {
            chain.components.push(comp.text)
          }
        }

        // Find stories that implement this requirement
        for (const story of stories) {
          if (hasKeywordOverlap(story.text, reqKeywords, 0.3)) {
            chain.stories.push(story.text)
          }
        }
      }
    }

    // Check if chain is complete
    chain.complete = chain.requirements.length > 0 &&
                     chain.components.length > 0 &&
                     chain.stories.length > 0

    chains.push(chain)
  }

  // Calculate score
  const completeChains = chains.filter(c => c.complete).length
  const totalChains = chains.length
  const score = totalChains > 0 ? (completeChains / totalChains) * 100 : 0

  // Identify weak links
  const weakLinks = []
  chains.forEach((chain, idx) => {
    if (!chain.complete) {
      if (chain.requirements.length === 0) {
        weakLinks.push(`Goal ${idx + 1} has no linked requirements`)
      }
      if (chain.components.length === 0) {
        weakLinks.push(`Goal ${idx + 1} has no linked components`)
      }
      if (chain.stories.length === 0) {
        weakLinks.push(`Goal ${idx + 1} has no linked stories`)
      }
    }
  })

  return {
    score: score,
    weight: 25,
    weighted_score: score * 0.25,
    details: {
      total_chains: totalChains,
      complete_chains: completeChains,
      weak_links: weakLinks
    },
    chains: chains
  }
}

function extractElements(specDocs, phase, regex) {
  const elements = []
  const doc = specDocs.find(d => d.phase === phase)

  if (doc) {
    let match
    while ((match = regex.exec(doc.content)) !== null) {
      elements.push({
        text: match[1].trim(),
        phase: phase
      })
    }
  }

  return elements
}

function extractKeywords(text) {
  // Extract meaningful words (4+ chars, not common words)
  const commonWords = new Set(["that", "this", "with", "from", "have", "will", "should", "must", "can"])
  const words = text.toLowerCase().match(/\b\w{4,}\b/g) || []
  return words.filter(w => !commonWords.has(w))
}

function hasKeywordOverlap(text, keywords, threshold) {
  const textLower = text.toLowerCase()
  const matchCount = keywords.filter(kw => textLower.includes(kw)).length
  return matchCount / keywords.length >= threshold
}
```

### 4. Depth (Weight: 20%)

```javascript
function scoreDepth(specDocs) {
  const dimensions = []

  // 1. Acceptance Criteria Testability
  const acDoc = specDocs.find(d => d.phase === "prd" || d.phase === "user-stories")
  if (acDoc) {
    const acMatches = acDoc.content.match(/Acceptance Criteria:[\s\S]*?(?=\n##|\n\n[-*]|$)/gi) || []
    let testableCount = 0
    let totalCount = 0

    acMatches.forEach(section => {
      const criteria = section.match(/^[-*]\s+(.+)$/gm) || []
      totalCount += criteria.length

      criteria.forEach(criterion => {
        // Testable if contains measurable verbs or specific conditions
        const testablePatterns = [
          /\b(should|must|will)\s+(display|show|return|validate|check|verify|calculate|send|receive)\b/i,
          /\b(when|if|given)\b.*\b(then|should|must)\b/i,
          /\b\d+\b/, // Contains numbers (measurable)
          /\b(success|error|fail|pass)\b/i
        ]

        const isTestable = testablePatterns.some(pattern => pattern.test(criterion))
        if (isTestable) testableCount++
      })
    })

    const acScore = totalCount > 0 ? (testableCount / totalCount) * 100 : 0
    dimensions.push({
      name: "Acceptance Criteria Testability",
      score: acScore,
      testable: testableCount,
      total: totalCount
    })
  }

  // 2. ADR Justification
  const archDoc = specDocs.find(d => d.phase === "architecture")
  if (archDoc) {
    const adrMatches = archDoc.content.match(/##\s+(?:ADR|Decision)[\s\S]*?(?=\n##|$)/gi) || []
    let justifiedCount = 0
    let totalCount = adrMatches.length

    adrMatches.forEach(adr => {
      // Justified if contains rationale, alternatives, or consequences
      const hasJustification = adr.match(/\b(rationale|reason|because|alternative|consequence|trade-?off)\b/i)
      if (hasJustification) justifiedCount++
    })

    const adrScore = totalCount > 0 ? (justifiedCount / totalCount) * 100 : 100 // Default 100 if no ADRs
    dimensions.push({
      name: "ADR Justification",
      score: adrScore,
      justified: justifiedCount,
      total: totalCount
    })
  }

  // 3. User Stories Estimability
  const storiesDoc = specDocs.find(d => d.phase === "user-stories")
  if (storiesDoc) {
    const storyMatches = storiesDoc.content.match(/^[-*]\s+(?:US-\d+|Story)[\s\S]*?(?=\n[-*]|$)/gim) || []
    let estimableCount = 0
    let totalCount = storyMatches.length

    storyMatches.forEach(story => {
      // Estimable if has clear scope, AC, and no ambiguity
      const hasScope = story.match(/\b(as a|I want|so that)\b/i)
      const hasAC = story.match(/acceptance criteria/i)
      const hasEstimate = story.match(/\b(points?|hours?|days?|estimate)\b/i)

      if ((hasScope && hasAC) || hasEstimate) estimableCount++
    })

    const storiesScore = totalCount > 0 ? (estimableCount / totalCount) * 100 : 0
    dimensions.push({
      name: "User Stories Estimability",
      score: storiesScore,
      estimable: estimableCount,
      total: totalCount
    })
  }

  // 4. Technical Detail Sufficiency
  const techDocs = specDocs.filter(d => d.phase === "architecture" || d.phase === "implementation-plan")
  let detailScore = 0

  if (techDocs.length > 0) {
    const detailIndicators = [
      /```[\s\S]*?```/, // Code blocks
      /\b(API|endpoint|schema|model|interface|class|function)\b/i,
      /\b(GET|POST|PUT|DELETE|PATCH)\b/, // HTTP methods
      /\b(database|table|collection|index)\b/i,
      /\b(authentication|authorization|security)\b/i
    ]

    let indicatorCount = 0
    techDocs.forEach(doc => {
      detailIndicators.forEach(pattern => {
        if (pattern.test(doc.content)) indicatorCount++
      })
    })

    detailScore = Math.min(100, (indicatorCount / (detailIndicators.length * techDocs.length)) * 100)
    dimensions.push({
      name: "Technical Detail Sufficiency",
      score: detailScore,
      indicators_found: indicatorCount,
      indicators_expected: detailIndicators.length * techDocs.length
    })
  }

  // Calculate overall depth score
  const overallScore = dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length

  return {
    score: overallScore,
    weight: 20,
    weighted_score: overallScore * 0.20,
    dimensions: dimensions
  }
}
```

### 5. Requirement Coverage (Weight: 10%)

```javascript
function scoreRequirementCoverage(specDocs, originalRequirements) {
  // Extract original requirements from task description or initial brief
  const originalReqs = originalRequirements || extractOriginalRequirements(specDocs)

  if (originalReqs.length === 0) {
    return {
      score: 100, // No requirements to cover
      weight: 10,
      weighted_score: 10,
      details: {
        total: 0,
        covered: 0,
        uncovered: []
      }
    }
  }

  // Extract all requirements from spec documents
  const specReqs = []
  for (const doc of specDocs) {
    const reqMatches = doc.content.match(/^[-*]\s+(?:REQ-\d+|Requirement|Feature):\s*(.+)$/gm) || []
    reqMatches.forEach(match => {
      specReqs.push(match.replace(/^[-*]\s+(?:REQ-\d+|Requirement|Feature):\s*/, "").trim())
    })
  }

  // Map original requirements to spec requirements
  const coverage = []
  for (const origReq of originalReqs) {
    const keywords = extractKeywords(origReq)
    const covered = specReqs.some(specReq => hasKeywordOverlap(specReq, keywords, 0.4))

    coverage.push({
      requirement: origReq,
      covered: covered
    })
  }

  const coveredCount = coverage.filter(c => c.covered).length
  const score = (coveredCount / originalReqs.length) * 100

  return {
    score: score,
    weight: 10,
    weighted_score: score * 0.10,
    details: {
      total: originalReqs.length,
      covered: coveredCount,
      uncovered: coverage.filter(c => !c.covered).map(c => c.requirement)
    }
  }
}

function extractOriginalRequirements(specDocs) {
  // Try to find original requirements in product brief
  const briefDoc = specDocs.find(d => d.phase === "product-brief")
  if (!briefDoc) return []

  const reqSection = briefDoc.content.match(/##\s+(?:Requirements|Objectives)[\s\S]*?(?=\n##|$)/i)
  if (!reqSection) return []

  const reqs = reqSection[0].match(/^[-*]\s+(.+)$/gm) || []
  return reqs.map(r => r.replace(/^[-*]\s+/, "").trim())
}
```

## Quality Gate Determination

```javascript
function determineQualityGate(overallScore, coverageScore) {
  // PASS: Score ≥80% AND coverage ≥70%
  if (overallScore >= 80 && coverageScore >= 70) {
    return {
      gate: "PASS",
      message: "Specification meets quality standards and is ready for implementation",
      action: "Proceed to implementation phase"
    }
  }

  // FAIL: Score <60% OR coverage <50%
  if (overallScore < 60 || coverageScore < 50) {
    return {
      gate: "FAIL",
      message: "Specification requires major revisions before implementation",
      action: "Address critical gaps and resubmit for review"
    }
  }

  // REVIEW: Between PASS and FAIL
  return {
    gate: "REVIEW",
    message: "Specification needs improvements but may proceed with caution",
    action: "Address recommendations and consider re-review"
  }
}
```

## Readiness Report Generation

```javascript
function formatReadinessReport(report, specDocs) {
  const { overall_score, quality_gate, dimensions, phase_gates } = report

  let markdown = `# Specification Readiness Report\n\n`
  markdown += `**Generated**: ${new Date().toISOString()}\n\n`
  markdown += `**Overall Score**: ${overall_score.toFixed(1)}%\n\n`
  markdown += `**Quality Gate**: ${quality_gate.gate} - ${quality_gate.message}\n\n`
  markdown += `**Recommended Action**: ${quality_gate.action}\n\n`

  markdown += `---\n\n`

  markdown += `## Dimension Scores\n\n`
  markdown += `| Dimension | Score | Weight | Weighted Score |\n`
  markdown += `|-----------|-------|--------|----------------|\n`

  Object.entries(dimensions).forEach(([name, data]) => {
    markdown += `| ${name} | ${data.score.toFixed(1)}% | ${data.weight}% | ${data.weighted_score.toFixed(1)}% |\n`
  })

  markdown += `\n---\n\n`

  // Completeness Details
  markdown += `## Completeness Analysis\n\n`
  dimensions.completeness.details.forEach(detail => {
    markdown += `### ${detail.phase}\n`
    markdown += `- Score: ${detail.score.toFixed(1)}%\n`
    markdown += `- Sections Present: ${detail.present}/${detail.expected}\n`
    markdown += `- Substantial Content: ${detail.substantial}/${detail.expected}\n`
    if (detail.missing.length > 0) {
      markdown += `- Missing: ${detail.missing.join(", ")}\n`
    }
    markdown += `\n`
  })

  // Consistency Details
  markdown += `## Consistency Analysis\n\n`
  if (dimensions.consistency.issues.length > 0) {
    markdown += `**Issues Found**: ${dimensions.consistency.issues.length}\n\n`
    dimensions.consistency.issues.forEach(issue => {
      markdown += `- **${issue.severity.toUpperCase()}**: ${issue.message}\n`
      markdown += `  *Suggestion*: ${issue.suggestion}\n\n`
    })
  } else {
    markdown += `No consistency issues found.\n\n`
  }

  // Traceability Details
  markdown += `## Traceability Analysis\n\n`
  markdown += `- Complete Chains: ${dimensions.traceability.details.complete_chains}/${dimensions.traceability.details.total_chains}\n\n`
  if (dimensions.traceability.details.weak_links.length > 0) {
    markdown += `**Weak Links**:\n`
    dimensions.traceability.details.weak_links.forEach(link => {
      markdown += `- ${link}\n`
    })
    markdown += `\n`
  }

  // Depth Details
  markdown += `## Depth Analysis\n\n`
  dimensions.depth.dimensions.forEach(dim => {
    markdown += `### ${dim.name}\n`
    markdown += `- Score: ${dim.score.toFixed(1)}%\n`
    if (dim.testable !== undefined) {
      markdown += `- Testable: ${dim.testable}/${dim.total}\n`
    }
    if (dim.justified !== undefined) {
      markdown += `- Justified: ${dim.justified}/${dim.total}\n`
    }
    if (dim.estimable !== undefined) {
      markdown += `- Estimable: ${dim.estimable}/${dim.total}\n`
    }
    markdown += `\n`
  })

  // Coverage Details
  markdown += `## Requirement Coverage\n\n`
  markdown += `- Covered: ${dimensions.coverage.details.covered}/${dimensions.coverage.details.total}\n`
  if (dimensions.coverage.details.uncovered.length > 0) {
    markdown += `\n**Uncovered Requirements**:\n`
    dimensions.coverage.details.uncovered.forEach(req => {
      markdown += `- ${req}\n`
    })
  }
  markdown += `\n`

  // Phase Gates
  if (phase_gates) {
    markdown += `---\n\n`
    markdown += `## Phase-Level Quality Gates\n\n`
    Object.entries(phase_gates).forEach(([phase, gate]) => {
      markdown += `### ${phase}\n`
      markdown += `- Gate: ${gate.status}\n`
      markdown += `- Score: ${gate.score.toFixed(1)}%\n`
      if (gate.issues.length > 0) {
        markdown += `- Issues: ${gate.issues.join(", ")}\n`
      }
      markdown += `\n`
    })
  }

  return markdown
}
```

## Spec Summary Generation

```javascript
function formatSpecSummary(specDocs, report) {
  let markdown = `# Specification Summary\n\n`

  markdown += `**Overall Quality Score**: ${report.overall_score.toFixed(1)}%\n`
  markdown += `**Quality Gate**: ${report.quality_gate.gate}\n\n`

  markdown += `---\n\n`

  // Document Overview
  markdown += `## Documents Reviewed\n\n`
  specDocs.forEach(doc => {
    markdown += `### ${doc.phase}\n`
    markdown += `- Path: ${doc.path}\n`
    markdown += `- Size: ${doc.content.length} characters\n`

    // Extract key sections
    const sections = doc.content.match(/^##\s+(.+)$/gm) || []
    if (sections.length > 0) {
      markdown += `- Sections: ${sections.map(s => s.replace(/^##\s+/, "")).join(", ")}\n`
    }
    markdown += `\n`
  })

  markdown += `---\n\n`

  // Key Findings
  markdown += `## Key Findings\n\n`

  // Strengths
  const strengths = []
  Object.entries(report.dimensions).forEach(([name, data]) => {
    if (data.score >= 80) {
      strengths.push(`${name}: ${data.score.toFixed(1)}%`)
    }
  })

  if (strengths.length > 0) {
    markdown += `### Strengths\n`
    strengths.forEach(s => markdown += `- ${s}\n`)
    markdown += `\n`
  }

  // Areas for Improvement
  const improvements = []
  Object.entries(report.dimensions).forEach(([name, data]) => {
    if (data.score < 70) {
      improvements.push(`${name}: ${data.score.toFixed(1)}%`)
    }
  })

  if (improvements.length > 0) {
    markdown += `### Areas for Improvement\n`
    improvements.forEach(i => markdown += `- ${i}\n`)
    markdown += `\n`
  }

  // Recommendations
  if (report.recommendations && report.recommendations.length > 0) {
    markdown += `### Recommendations\n`
    report.recommendations.forEach((rec, i) => {
      markdown += `${i + 1}. ${rec}\n`
    })
    markdown += `\n`
  }

  return markdown
}
```

## Phase-Level Quality Gates

```javascript
function calculatePhaseGates(specDocs) {
  const gates = {}

  for (const doc of specDocs) {
    const phase = doc.phase
    const issues = []
    let score = 100

    // Check minimum content threshold
    if (doc.content.length < 500) {
      issues.push("Insufficient content")
      score -= 30
    }

    // Check for required sections (phase-specific)
    const requiredSections = getRequiredSections(phase)
    const missingSections = requiredSections.filter(section =>
      !doc.content.match(new RegExp(`##\\s+${section}`, "i"))
    )

    if (missingSections.length > 0) {
      issues.push(`Missing sections: ${missingSections.join(", ")}`)
      score -= missingSections.length * 15
    }

    // Determine gate status
    let status = "PASS"
    if (score < 60) status = "FAIL"
    else if (score < 80) status = "REVIEW"

    gates[phase] = {
      status: status,
      score: Math.max(0, score),
      issues: issues
    }
  }

  return gates
}

function getRequiredSections(phase) {
  const sectionMap = {
    "product-brief": ["Vision", "Problem", "Target Audience"],
    "prd": ["Goals", "Requirements", "User Stories"],
    "architecture": ["Overview", "Components", "Data Models"],
    "user-stories": ["Stories", "Acceptance Criteria"],
    "implementation-plan": ["Tasks", "Dependencies"],
    "test-strategy": ["Test Cases", "Coverage"]
  }

  return sectionMap[phase] || []
}
```
