# Command: Multi-Perspective Critique

Phase 3 of discussant execution - launch parallel CLI analyses for each required perspective.

## Overview

This command executes multi-perspective critique by routing to specialized CLI tools based on perspective type. Each perspective produces structured critique with strengths, weaknesses, suggestions, and ratings.

## Perspective Definitions

### 1. Product Perspective (gemini)

**Focus**: Market fit, user value, business viability, competitive differentiation

**CLI Tool**: gemini

**Output Structure**:
```json
{
  "perspective": "product",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "suggestions": ["string"],
  "rating": 1-5
}
```

**Prompt Template**:
```
Analyze from Product Manager perspective:
- Market fit and user value proposition
- Business viability and ROI potential
- Competitive differentiation
- User experience and adoption barriers

Artifact: {artifactContent}

Output JSON with: strengths[], weaknesses[], suggestions[], rating (1-5)
```

### 2. Technical Perspective (codex)

**Focus**: Feasibility, tech debt, performance, security, maintainability

**CLI Tool**: codex

**Output Structure**:
```json
{
  "perspective": "technical",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "suggestions": ["string"],
  "rating": 1-5
}
```

**Prompt Template**:
```
Analyze from Tech Lead perspective:
- Technical feasibility and implementation complexity
- Architecture decisions and tech debt implications
- Performance and scalability considerations
- Security vulnerabilities and risks
- Code maintainability and extensibility

Artifact: {artifactContent}

Output JSON with: strengths[], weaknesses[], suggestions[], rating (1-5)
```

### 3. Quality Perspective (claude)

**Focus**: Completeness, testability, consistency, standards compliance

**CLI Tool**: claude

**Output Structure**:
```json
{
  "perspective": "quality",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "suggestions": ["string"],
  "rating": 1-5
}
```

**Prompt Template**:
```
Analyze from QA Lead perspective:
- Specification completeness and clarity
- Testability and test coverage potential
- Consistency across requirements/design
- Standards compliance (coding, documentation, accessibility)
- Ambiguity detection and edge case coverage

Artifact: {artifactContent}

Output JSON with: strengths[], weaknesses[], suggestions[], rating (1-5)
```

### 4. Risk Perspective (gemini)

**Focus**: Risk identification, dependency analysis, assumption validation, failure modes

**CLI Tool**: gemini

**Output Structure**:
```json
{
  "perspective": "risk",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "suggestions": ["string"],
  "rating": 1-5,
  "risk_level": "low|medium|high|critical"
}
```

**Prompt Template**:
```
Analyze from Risk Analyst perspective:
- Risk identification (technical, business, operational)
- Dependency analysis and external risks
- Assumption validation and hidden dependencies
- Failure modes and mitigation strategies
- Timeline and resource risks

Artifact: {artifactContent}

Output JSON with: strengths[], weaknesses[], suggestions[], rating (1-5), risk_level
```

### 5. Coverage Perspective (gemini)

**Focus**: Requirement completeness vs original intent, scope drift, gap detection

**CLI Tool**: gemini

**Output Structure**:
```json
{
  "perspective": "coverage",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "suggestions": ["string"],
  "rating": 1-5,
  "covered_requirements": ["REQ-ID"],
  "partial_requirements": ["REQ-ID"],
  "missing_requirements": ["REQ-ID"],
  "scope_creep": ["description"]
}
```

**Prompt Template**:
```
Analyze from Requirements Analyst perspective:
- Compare current artifact against original requirements in discovery-context.json
- Identify covered requirements (fully addressed)
- Identify partial requirements (partially addressed)
- Identify missing requirements (not addressed)
- Detect scope creep (new items not in original requirements)

Original Requirements: {discoveryContext}
Current Artifact: {artifactContent}

Output JSON with:
- strengths[], weaknesses[], suggestions[], rating (1-5)
- covered_requirements[] (REQ-IDs fully addressed)
- partial_requirements[] (REQ-IDs partially addressed)
- missing_requirements[] (REQ-IDs not addressed) ← CRITICAL if non-empty
- scope_creep[] (new items not in original requirements)
```

## Execution Pattern

### Parallel CLI Execution

```javascript
// Load artifact content
const artifactPath = `${sessionFolder}/${config.artifact}`
const artifactContent = config.type === 'json'
  ? JSON.parse(Read(artifactPath))
  : Read(artifactPath)

// Load discovery context for coverage perspective
let discoveryContext = null
try {
  discoveryContext = JSON.parse(Read(`${sessionFolder}/spec/discovery-context.json`))
} catch { /* may not exist in early rounds */ }

// Launch parallel CLI analyses
const perspectiveResults = []

for (const perspective of config.perspectives) {
  let cliTool, prompt

  switch(perspective) {
    case 'product':
      cliTool = 'gemini'
      prompt = `Analyze from Product Manager perspective:
- Market fit and user value proposition
- Business viability and ROI potential
- Competitive differentiation
- User experience and adoption barriers

Artifact:
${JSON.stringify(artifactContent, null, 2)}

Output JSON with: strengths[], weaknesses[], suggestions[], rating (1-5)`
      break

    case 'technical':
      cliTool = 'codex'
      prompt = `Analyze from Tech Lead perspective:
- Technical feasibility and implementation complexity
- Architecture decisions and tech debt implications
- Performance and scalability considerations
- Security vulnerabilities and risks
- Code maintainability and extensibility

Artifact:
${JSON.stringify(artifactContent, null, 2)}

Output JSON with: strengths[], weaknesses[], suggestions[], rating (1-5)`
      break

    case 'quality':
      cliTool = 'claude'
      prompt = `Analyze from QA Lead perspective:
- Specification completeness and clarity
- Testability and test coverage potential
- Consistency across requirements/design
- Standards compliance (coding, documentation, accessibility)
- Ambiguity detection and edge case coverage

Artifact:
${JSON.stringify(artifactContent, null, 2)}

Output JSON with: strengths[], weaknesses[], suggestions[], rating (1-5)`
      break

    case 'risk':
      cliTool = 'gemini'
      prompt = `Analyze from Risk Analyst perspective:
- Risk identification (technical, business, operational)
- Dependency analysis and external risks
- Assumption validation and hidden dependencies
- Failure modes and mitigation strategies
- Timeline and resource risks

Artifact:
${JSON.stringify(artifactContent, null, 2)}

Output JSON with: strengths[], weaknesses[], suggestions[], rating (1-5), risk_level`
      break

    case 'coverage':
      cliTool = 'gemini'
      prompt = `Analyze from Requirements Analyst perspective:
- Compare current artifact against original requirements in discovery-context.json
- Identify covered requirements (fully addressed)
- Identify partial requirements (partially addressed)
- Identify missing requirements (not addressed)
- Detect scope creep (new items not in original requirements)

Original Requirements:
${discoveryContext ? JSON.stringify(discoveryContext, null, 2) : 'Not available'}

Current Artifact:
${JSON.stringify(artifactContent, null, 2)}

Output JSON with:
- strengths[], weaknesses[], suggestions[], rating (1-5)
- covered_requirements[] (REQ-IDs fully addressed)
- partial_requirements[] (REQ-IDs partially addressed)
- missing_requirements[] (REQ-IDs not addressed) ← CRITICAL if non-empty
- scope_creep[] (new items not in original requirements)`
      break
  }

  // Execute CLI analysis (run_in_background: true per CLAUDE.md)
  Bash({
    command: `ccw cli -p "${prompt.replace(/"/g, '\\"')}" --tool ${cliTool} --mode analysis`,
    run_in_background: true,
    description: `[discussant] ${perspective} perspective analysis`
  })
}

// Wait for all CLI results via hook callbacks
// Results will be collected in perspectiveResults array
```

## Critical Divergence Detection

### Coverage Gap Detection

```javascript
const coverageResult = perspectiveResults.find(p => p.perspective === 'coverage')
if (coverageResult?.missing_requirements?.length > 0) {
  // Flag as critical divergence
  synthesis.divergent_views.push({
    topic: 'requirement_coverage_gap',
    description: `${coverageResult.missing_requirements.length} requirements from discovery-context not covered: ${coverageResult.missing_requirements.join(', ')}`,
    severity: 'high',
    source: 'coverage'
  })
}
```

### Risk Level Detection

```javascript
const riskResult = perspectiveResults.find(p => p.perspective === 'risk')
if (riskResult?.risk_level === 'high' || riskResult?.risk_level === 'critical') {
  synthesis.risk_flags.push({
    level: riskResult.risk_level,
    description: riskResult.weaknesses.join('; ')
  })
}
```

## Fallback Strategy

### CLI Failure Fallback

```javascript
// If CLI analysis fails for a perspective, fallback to direct Claude analysis
try {
  // CLI execution
  Bash({ command: `ccw cli -p "..." --tool ${cliTool} --mode analysis`, run_in_background: true })
} catch (error) {
  // Fallback: Direct Claude analysis
  const fallbackResult = {
    perspective: perspective,
    strengths: ["Direct analysis: ..."],
    weaknesses: ["Direct analysis: ..."],
    suggestions: ["Direct analysis: ..."],
    rating: 3,
    _fallback: true
  }
  perspectiveResults.push(fallbackResult)
}
```

### All CLI Failures

```javascript
if (perspectiveResults.every(r => r._fallback)) {
  // Generate basic discussion from direct reading
  const basicDiscussion = {
    convergent_themes: ["Basic analysis from direct reading"],
    divergent_views: [],
    action_items: ["Review artifact manually"],
    open_questions: [],
    decisions: [],
    risk_flags: [],
    overall_sentiment: 'neutral',
    consensus_reached: true,
    _basic_mode: true
  }
}
```

## Output Format

Each perspective produces:

```json
{
  "perspective": "product|technical|quality|risk|coverage",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "suggestions": ["string"],
  "rating": 1-5,

  // Risk perspective only
  "risk_level": "low|medium|high|critical",

  // Coverage perspective only
  "covered_requirements": ["REQ-ID"],
  "partial_requirements": ["REQ-ID"],
  "missing_requirements": ["REQ-ID"],
  "scope_creep": ["description"]
}
```

## Integration with Phase 4

Phase 4 (Consensus Synthesis) consumes `perspectiveResults` array to:
1. Extract convergent themes (2+ perspectives agree)
2. Extract divergent views (perspectives conflict)
3. Detect coverage gaps (missing_requirements non-empty)
4. Assess risk flags (high/critical risk_level)
5. Determine consensus_reached (true if no critical divergences)
