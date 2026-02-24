# Command: Generate Document

Multi-CLI document generation for 4 document types: Product Brief, Requirements/PRD, Architecture, Epics & Stories.

## Pre-Steps (All Document Types)

```javascript
// 1. Load document standards
const docStandards = Read('../../specs/document-standards.md')

// 2. Load appropriate template
const templateMap = {
  'product-brief': '../../templates/product-brief.md',
  'requirements': '../../templates/requirements-prd.md',
  'architecture': '../../templates/architecture-doc.md',
  'epics': '../../templates/epics-template.md'
}
const template = Read(templateMap[docType])

// 3. Build shared context
const seedAnalysis = specConfig?.seed_analysis ||
  (priorDocs.discoveryContext ? JSON.parse(priorDocs.discoveryContext).seed_analysis : {})

const sharedContext = `
SEED: ${specConfig?.topic || ''}
PROBLEM: ${seedAnalysis.problem_statement || ''}
TARGET USERS: ${(seedAnalysis.target_users || []).join(', ')}
DOMAIN: ${seedAnalysis.domain || ''}
CONSTRAINTS: ${(seedAnalysis.constraints || []).join(', ')}
FOCUS AREAS: ${(specConfig?.focus_areas || []).join(', ')}
${priorDocs.discoveryContext ? `
CODEBASE CONTEXT:
- Existing patterns: ${JSON.parse(priorDocs.discoveryContext).existing_patterns?.slice(0,5).join(', ') || 'none'}
- Tech stack: ${JSON.stringify(JSON.parse(priorDocs.discoveryContext).tech_stack || {})}
` : ''}`

// 4. Route to specific document type
```

## DRAFT-001: Product Brief

3-way parallel CLI analysis (product/technical/user perspectives), then synthesize.

```javascript
if (docType === 'product-brief') {
  // === Parallel CLI Analysis ===

  // Product Perspective (Gemini)
  Bash({
    command: `ccw cli -p "PURPOSE: Product analysis for specification - identify market fit, user value, and success criteria.
Success: Clear vision, measurable goals, competitive positioning.

${sharedContext}

TASK:
- Define product vision (1-3 sentences, aspirational)
- Analyze market/competitive landscape
- Define 3-5 measurable success metrics
- Identify scope boundaries (in-scope vs out-of-scope)
- Assess user value proposition
- List assumptions that need validation

MODE: analysis
EXPECTED: Structured product analysis with: vision, goals with metrics, scope, competitive positioning, assumptions
CONSTRAINTS: Focus on 'what' and 'why', not 'how'
" --tool gemini --mode analysis`,
    run_in_background: true
  })

  // Technical Perspective (Codex)
  Bash({
    command: `ccw cli -p "PURPOSE: Technical feasibility analysis for specification - assess implementation viability and constraints.
Success: Clear technical constraints, integration complexity, technology recommendations.

${sharedContext}

TASK:
- Assess technical feasibility of the core concept
- Identify technical constraints and blockers
- Evaluate integration complexity with existing systems
- Recommend technology approach (high-level)
- Identify technical risks and dependencies
- Estimate complexity: simple/moderate/complex

MODE: analysis
EXPECTED: Technical analysis with: feasibility assessment, constraints, integration complexity, tech recommendations, risks
CONSTRAINTS: Focus on feasibility and constraints, not detailed architecture
" --tool codex --mode analysis`,
    run_in_background: true
  })

  // User Perspective (Claude)
  Bash({
    command: `ccw cli -p "PURPOSE: User experience analysis for specification - understand user journeys, pain points, and UX considerations.
Success: Clear user personas, journey maps, UX requirements.

${sharedContext}

TASK:
- Elaborate user personas with goals and frustrations
- Map primary user journey (happy path)
- Identify key pain points in current experience
- Define UX success criteria
- List accessibility and usability considerations
- Suggest interaction patterns

MODE: analysis
EXPECTED: User analysis with: personas, journey map, pain points, UX criteria, interaction recommendations
CONSTRAINTS: Focus on user needs and experience, not implementation
" --tool claude --mode analysis`,
    run_in_background: true
  })

  // STOP: Wait for all 3 CLI results

  // === Synthesize Three Perspectives ===
  const synthesis = {
    convergent_themes: [],  // Themes consistent across all three perspectives
    conflicts: [],           // Conflicting viewpoints
    product_insights: [],    // Unique product perspective insights
    technical_insights: [],  // Unique technical perspective insights
    user_insights: []        // Unique user perspective insights
  }

  // Parse CLI outputs and identify:
  // - Common themes mentioned by 2+ perspectives
  // - Conflicts (e.g., product wants feature X, technical says infeasible)
  // - Unique insights from each perspective

  // === Integrate Discussion Feedback ===
  if (discussionFeedback) {
    // Extract consensus and adjustments from discuss-001-scope.md
    // Merge discussion conclusions into synthesis
  }

  // === Generate Document from Template ===
  const frontmatter = `---
session_id: ${specConfig?.session_id || 'unknown'}
phase: 2
document_type: product-brief
status: draft
generated_at: ${new Date().toISOString()}
version: 1
dependencies:
  - spec-config.json
  - discovery-context.json
---`

  // Fill template sections:
  // - Vision (from product perspective + synthesis)
  // - Problem Statement (from seed analysis + user perspective)
  // - Target Users (from user perspective + personas)
  // - Goals (from product perspective + metrics)
  // - Scope (from product perspective + technical constraints)
  // - Success Criteria (from all three perspectives)
  // - Assumptions (from product + technical perspectives)

  const filledContent = fillTemplate(template, {
    vision: productPerspective.vision,
    problem: seedAnalysis.problem_statement,
    users: userPerspective.personas,
    goals: productPerspective.goals,
    scope: synthesis.scope_boundaries,
    success_criteria: synthesis.convergent_themes,
    assumptions: [...productPerspective.assumptions, ...technicalPerspective.assumptions]
  })

  Write(`${sessionFolder}/spec/product-brief.md`, `${frontmatter}\n\n${filledContent}`)

  return {
    outputPath: 'spec/product-brief.md',
    documentSummary: `Product Brief generated with ${synthesis.convergent_themes.length} convergent themes, ${synthesis.conflicts.length} conflicts resolved`
  }
}
```

## DRAFT-002: Requirements/PRD

Gemini CLI expansion to generate REQ-NNN and NFR-{type}-NNN files.

```javascript
if (docType === 'requirements') {
  // === Requirements Expansion CLI ===
  Bash({
    command: `ccw cli -p "PURPOSE: Generate detailed functional and non-functional requirements from product brief.
Success: Complete PRD with testable acceptance criteria for every requirement.

PRODUCT BRIEF CONTEXT:
${priorDocs.productBrief?.slice(0, 3000) || ''}

${sharedContext}

TASK:
- For each goal in the product brief, generate 3-7 functional requirements
- Each requirement must have:
  - Unique ID: REQ-NNN (zero-padded)
  - Clear title
  - Detailed description
  - User story: As a [persona], I want [action] so that [benefit]
  - 2-4 specific, testable acceptance criteria
- Generate non-functional requirements:
  - Performance (response times, throughput)
  - Security (authentication, authorization, data protection)
  - Scalability (user load, data volume)
  - Usability (accessibility, learnability)
- Assign MoSCoW priority: Must/Should/Could/Won't
- Output structure per requirement: ID, title, description, user_story, acceptance_criteria[], priority, traces

MODE: analysis
EXPECTED: Structured requirements with: ID, title, description, user story, acceptance criteria, priority, traceability to goals
CONSTRAINTS: Every requirement must be specific enough to estimate and test. No vague requirements.
" --tool gemini --mode analysis`,
    run_in_background: true
  })

  // Wait for CLI result

  // === Integrate Discussion Feedback ===
  if (discussionFeedback) {
    // Extract requirement adjustments from discuss-002-brief.md
    // Merge new/modified/deleted requirements
  }

  // === Generate requirements/ Directory ===
  Bash(`mkdir -p "${sessionFolder}/spec/requirements"`)

  const timestamp = new Date().toISOString()

  // Parse CLI output → funcReqs[], nfReqs[]
  const funcReqs = parseFunctionalRequirements(cliOutput)
  const nfReqs = parseNonFunctionalRequirements(cliOutput)

  // Write individual REQ-*.md files (one per functional requirement)
  funcReqs.forEach(req => {
    const reqFrontmatter = `---
id: REQ-${req.id}
title: "${req.title}"
priority: ${req.priority}
status: draft
traces:
  - product-brief.md
---`
    const reqContent = `${reqFrontmatter}

# REQ-${req.id}: ${req.title}

## Description
${req.description}

## User Story
${req.user_story}

## Acceptance Criteria
${req.acceptance_criteria.map((ac, i) => `${i+1}. ${ac}`).join('\n')}
`
    Write(`${sessionFolder}/spec/requirements/REQ-${req.id}-${req.slug}.md`, reqContent)
  })

  // Write individual NFR-*.md files
  nfReqs.forEach(nfr => {
    const nfrFrontmatter = `---
id: NFR-${nfr.type}-${nfr.id}
type: ${nfr.type}
title: "${nfr.title}"
status: draft
traces:
  - product-brief.md
---`
    const nfrContent = `${nfrFrontmatter}

# NFR-${nfr.type}-${nfr.id}: ${nfr.title}

## Requirement
${nfr.requirement}

## Metric & Target
${nfr.metric} — Target: ${nfr.target}
`
    Write(`${sessionFolder}/spec/requirements/NFR-${nfr.type}-${nfr.id}-${nfr.slug}.md`, nfrContent)
  })

  // Write _index.md (summary + links)
  const indexFrontmatter = `---
session_id: ${specConfig?.session_id || 'unknown'}
phase: 3
document_type: requirements-index
status: draft
generated_at: ${timestamp}
version: 1
dependencies:
  - product-brief.md
---`
  const indexContent = `${indexFrontmatter}

# Requirements (PRD)

## Summary
Total: ${funcReqs.length} functional + ${nfReqs.length} non-functional requirements

## Functional Requirements
| ID | Title | Priority | Status |
|----|-------|----------|--------|
${funcReqs.map(r => `| [REQ-${r.id}](REQ-${r.id}-${r.slug}.md) | ${r.title} | ${r.priority} | draft |`).join('\n')}

## Non-Functional Requirements
| ID | Type | Title |
|----|------|-------|
${nfReqs.map(n => `| [NFR-${n.type}-${n.id}](NFR-${n.type}-${n.id}-${n.slug}.md) | ${n.type} | ${n.title} |`).join('\n')}

## MoSCoW Summary
- **Must**: ${funcReqs.filter(r => r.priority === 'Must').length}
- **Should**: ${funcReqs.filter(r => r.priority === 'Should').length}
- **Could**: ${funcReqs.filter(r => r.priority === 'Could').length}
- **Won't**: ${funcReqs.filter(r => r.priority === "Won't").length}
`
  Write(`${sessionFolder}/spec/requirements/_index.md`, indexContent)

  return {
    outputPath: 'spec/requirements/_index.md',
    documentSummary: `Requirements generated: ${funcReqs.length} functional, ${nfReqs.length} non-functional`
  }
}
```

## DRAFT-003: Architecture

Two-stage CLI: Gemini architecture design + Codex architecture review.

```javascript
if (docType === 'architecture') {
  // === Stage 1: Architecture Design (Gemini) ===
  Bash({
    command: `ccw cli -p "PURPOSE: Generate technical architecture for the specified requirements.
Success: Complete component architecture, tech stack, and ADRs with justified decisions.

PRODUCT BRIEF (summary):
${priorDocs.productBrief?.slice(0, 3000) || ''}

REQUIREMENTS:
${priorDocs.requirementsIndex?.slice(0, 5000) || ''}

${sharedContext}

TASK:
- Define system architecture style (monolith, microservices, serverless, etc.) with justification
- Identify core components and their responsibilities
- Create component interaction diagram (Mermaid graph TD format)
- Specify technology stack: languages, frameworks, databases, infrastructure
- Generate 2-4 Architecture Decision Records (ADRs):
  - Each ADR: context, decision, 2-3 alternatives with pros/cons, consequences
  - Focus on: data storage, API design, authentication, key technical choices
- Define data model: key entities and relationships (Mermaid erDiagram format)
- Identify security architecture: auth, authorization, data protection
- List API endpoints (high-level)

MODE: analysis
EXPECTED: Complete architecture with: style justification, component diagram, tech stack table, ADRs, data model, security controls, API overview
CONSTRAINTS: Architecture must support all Must-have requirements. Prefer proven technologies.
" --tool gemini --mode analysis`,
    run_in_background: true
  })

  // Wait for Gemini result

  // === Stage 2: Architecture Review (Codex) ===
  Bash({
    command: `ccw cli -p "PURPOSE: Critical review of proposed architecture - identify weaknesses and risks.
Success: Actionable feedback with specific concerns and improvement suggestions.

PROPOSED ARCHITECTURE:
${geminiArchitectureOutput.slice(0, 5000)}

REQUIREMENTS CONTEXT:
${priorDocs.requirementsIndex?.slice(0, 2000) || ''}

TASK:
- Challenge each ADR: are the alternatives truly the best options?
- Identify scalability bottlenecks in the component design
- Assess security gaps: authentication, authorization, data protection
- Evaluate technology choices: maturity, community support, fit
- Check for over-engineering or under-engineering
- Verify architecture covers all Must-have requirements
- Rate overall architecture quality: 1-5 with justification

MODE: analysis
EXPECTED: Architecture review with: per-ADR feedback, scalability concerns, security gaps, technology risks, quality rating
CONSTRAINTS: Be genuinely critical, not just validating. Focus on actionable improvements.
" --tool codex --mode analysis`,
    run_in_background: true
  })

  // Wait for Codex result

  // === Integrate Discussion Feedback ===
  if (discussionFeedback) {
    // Extract architecture feedback from discuss-003-requirements.md
    // Merge into architecture design
  }

  // === Codebase Integration Mapping (conditional) ===
  let integrationMapping = null
  if (priorDocs.discoveryContext) {
    const dc = JSON.parse(priorDocs.discoveryContext)
    if (dc.relevant_files) {
      integrationMapping = dc.relevant_files.map(f => ({
        new_component: '...',
        existing_module: f.path,
        integration_type: 'Extend|Replace|New',
        notes: f.rationale
      }))
    }
  }

  // === Generate architecture/ Directory ===
  Bash(`mkdir -p "${sessionFolder}/spec/architecture"`)

  const timestamp = new Date().toISOString()
  const adrs = parseADRs(geminiArchitectureOutput, codexReviewOutput)

  // Write individual ADR-*.md files
  adrs.forEach(adr => {
    const adrFrontmatter = `---
id: ADR-${adr.id}
title: "${adr.title}"
status: draft
traces:
  - ../requirements/_index.md
---`
    const adrContent = `${adrFrontmatter}

# ADR-${adr.id}: ${adr.title}

## Context
${adr.context}

## Decision
${adr.decision}

## Alternatives
${adr.alternatives.map((alt, i) => `### Option ${i+1}: ${alt.name}\n- **Pros**: ${alt.pros.join(', ')}\n- **Cons**: ${alt.cons.join(', ')}`).join('\n\n')}

## Consequences
${adr.consequences}

## Review Feedback
${adr.reviewFeedback || 'N/A'}
`
    Write(`${sessionFolder}/spec/architecture/ADR-${adr.id}-${adr.slug}.md`, adrContent)
  })

  // Write _index.md (with Mermaid component diagram + ER diagram + links)
  const archIndexFrontmatter = `---
session_id: ${specConfig?.session_id || 'unknown'}
phase: 4
document_type: architecture-index
status: draft
generated_at: ${timestamp}
version: 1
dependencies:
  - ../product-brief.md
  - ../requirements/_index.md
---`

  const archIndexContent = `${archIndexFrontmatter}

# Architecture Document

## System Overview
${geminiArchitectureOutput.system_overview}

## Component Diagram
\`\`\`mermaid
${geminiArchitectureOutput.component_diagram}
\`\`\`

## Technology Stack
${geminiArchitectureOutput.tech_stack_table}

## Architecture Decision Records
| ID | Title | Status |
|----|-------|--------|
${adrs.map(a => `| [ADR-${a.id}](ADR-${a.id}-${a.slug}.md) | ${a.title} | draft |`).join('\n')}

## Data Model
\`\`\`mermaid
${geminiArchitectureOutput.data_model_diagram}
\`\`\`

## API Design
${geminiArchitectureOutput.api_overview}

## Security Controls
${geminiArchitectureOutput.security_controls}

## Review Summary
${codexReviewOutput.summary}
Quality Rating: ${codexReviewOutput.quality_rating}/5
`

  Write(`${sessionFolder}/spec/architecture/_index.md`, archIndexContent)

  return {
    outputPath: 'spec/architecture/_index.md',
    documentSummary: `Architecture generated with ${adrs.length} ADRs, quality rating ${codexReviewOutput.quality_rating}/5`
  }
}
```

## DRAFT-004: Epics & Stories

Gemini CLI decomposition to generate EPIC-*.md files.

```javascript
if (docType === 'epics') {
  // === Epic Decomposition CLI ===
  Bash({
    command: `ccw cli -p "PURPOSE: Decompose requirements into executable Epics and Stories for implementation planning.
Success: 3-7 Epics with prioritized Stories, dependency map, and MVP subset clearly defined.

PRODUCT BRIEF (summary):
${priorDocs.productBrief?.slice(0, 2000) || ''}

REQUIREMENTS:
${priorDocs.requirementsIndex?.slice(0, 5000) || ''}

ARCHITECTURE (summary):
${priorDocs.architectureIndex?.slice(0, 3000) || ''}

TASK:
- Group requirements into 3-7 logical Epics:
  - Each Epic: EPIC-NNN ID, title, description, priority (Must/Should/Could)
  - Group by functional domain or user journey stage
  - Tag MVP Epics (minimum set for initial release)
- For each Epic, generate 2-5 Stories:
  - Each Story: STORY-{EPIC}-NNN ID, title
  - User story format: As a [persona], I want [action] so that [benefit]
  - 2-4 acceptance criteria per story (testable)
  - Relative size estimate: S/M/L/XL
  - Trace to source requirement(s): REQ-NNN
- Create dependency map:
  - Cross-Epic dependencies (which Epics block others)
  - Mermaid graph LR format
  - Recommended execution order with rationale
- Define MVP:
  - Which Epics are in MVP
  - MVP definition of done (3-5 criteria)
  - What is explicitly deferred post-MVP

MODE: analysis
EXPECTED: Structured output with: Epic list (ID, title, priority, MVP flag), Stories per Epic (ID, user story, AC, size, trace), dependency Mermaid diagram, execution order, MVP definition
CONSTRAINTS: Every Must-have requirement must appear in at least one Story. Stories must be small enough to implement independently. Dependencies should be minimized across Epics.
" --tool gemini --mode analysis`,
    run_in_background: true
  })

  // Wait for CLI result

  // === Integrate Discussion Feedback ===
  if (discussionFeedback) {
    // Extract execution feedback from discuss-004-architecture.md
    // Adjust Epic granularity, MVP scope
  }

  // === Generate epics/ Directory ===
  Bash(`mkdir -p "${sessionFolder}/spec/epics"`)

  const timestamp = new Date().toISOString()
  const epicsList = parseEpics(cliOutput)

  // Write individual EPIC-*.md files (with stories)
  epicsList.forEach(epic => {
    const epicFrontmatter = `---
id: EPIC-${epic.id}
title: "${epic.title}"
priority: ${epic.priority}
mvp: ${epic.mvp}
size: ${epic.size}
requirements:
${epic.reqs.map(r => `  - ${r}`).join('\n')}
architecture:
${epic.adrs.map(a => `  - ${a}`).join('\n')}
dependencies:
${epic.deps.map(d => `  - ${d}`).join('\n')}
status: draft
---`
    const storiesContent = epic.stories.map(s => `### ${s.id}: ${s.title}

**User Story**: ${s.user_story}
**Size**: ${s.size}
**Traces**: ${s.traces.join(', ')}

**Acceptance Criteria**:
${s.acceptance_criteria.map((ac, i) => `${i+1}. ${ac}`).join('\n')}
`).join('\n')

    const epicContent = `${epicFrontmatter}

# EPIC-${epic.id}: ${epic.title}

## Description
${epic.description}

## Stories
${storiesContent}

## Requirements
${epic.reqs.map(r => `- [${r}](../requirements/${r}.md)`).join('\n')}

## Architecture
${epic.adrs.map(a => `- [${a}](../architecture/${a}.md)`).join('\n')}
`
    Write(`${sessionFolder}/spec/epics/EPIC-${epic.id}-${epic.slug}.md`, epicContent)
  })

  // Write _index.md (with Mermaid dependency diagram + MVP + links)
  const epicsIndexFrontmatter = `---
session_id: ${specConfig?.session_id || 'unknown'}
phase: 5
document_type: epics-index
status: draft
generated_at: ${timestamp}
version: 1
dependencies:
  - ../requirements/_index.md
  - ../architecture/_index.md
---`

  const epicsIndexContent = `${epicsIndexFrontmatter}

# Epics & Stories

## Epic Overview
| ID | Title | Priority | MVP | Size | Status |
|----|-------|----------|-----|------|--------|
${epicsList.map(e => `| [EPIC-${e.id}](EPIC-${e.id}-${e.slug}.md) | ${e.title} | ${e.priority} | ${e.mvp ? '✓' : ''} | ${e.size} | draft |`).join('\n')}

## Dependency Map
\`\`\`mermaid
${cliOutput.dependency_diagram}
\`\`\`

## Execution Order
${cliOutput.execution_order}

## MVP Scope
${cliOutput.mvp_definition}

### MVP Epics
${epicsList.filter(e => e.mvp).map(e => `- EPIC-${e.id}: ${e.title}`).join('\n')}

### Post-MVP
${epicsList.filter(e => !e.mvp).map(e => `- EPIC-${e.id}: ${e.title}`).join('\n')}

## Traceability Matrix
${generateTraceabilityMatrix(epicsList, funcReqs)}
`

  Write(`${sessionFolder}/spec/epics/_index.md`, epicsIndexContent)

  return {
    outputPath: 'spec/epics/_index.md',
    documentSummary: `Epics generated: ${epicsList.length} total, ${epicsList.filter(e => e.mvp).length} in MVP`
  }
}
```

## Helper Functions

```javascript
function parseFunctionalRequirements(cliOutput) {
  // Parse CLI JSON output to extract functional requirements
  // Returns: [{ id, title, description, user_story, acceptance_criteria[], priority, slug }]
}

function parseNonFunctionalRequirements(cliOutput) {
  // Parse CLI JSON output to extract non-functional requirements
  // Returns: [{ id, type, title, requirement, metric, target, slug }]
}

function parseADRs(geminiOutput, codexOutput) {
  // Parse architecture outputs to extract ADRs with review feedback
  // Returns: [{ id, title, context, decision, alternatives[], consequences, reviewFeedback, slug }]
}

function parseEpics(cliOutput) {
  // Parse CLI JSON output to extract Epics and Stories
  // Returns: [{ id, title, description, priority, mvp, size, stories[], reqs[], adrs[], deps[], slug }]
}

function fillTemplate(template, data) {
  // Fill template placeholders with data
  // Apply document-standards.md formatting rules
}

function generateTraceabilityMatrix(epics, requirements) {
  // Generate traceability matrix showing Epic → Requirement mappings
}
```
