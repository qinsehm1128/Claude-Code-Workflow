---
name: req-plan-with-file
description: Requirement-level progressive roadmap planning with JSONL output. Decomposes requirements into convergent layers (MVP→iterations) or topologically-sorted task sequences, each with testable completion criteria.
argument-hint: "[-y|--yes] [-c|--continue] [-m|--mode progressive|direct|auto] \"requirement description\""
allowed-tools: TodoWrite(*), Task(*), AskUserQuestion(*), Read(*), Grep(*), Glob(*), Bash(*), Edit(*), Write(*)
---

## Auto Mode

When `--yes` or `-y`: Auto-confirm strategy selection, use recommended mode, skip interactive validation rounds.

# Workflow Req-Plan Command (/workflow:req-plan-with-file)

## Quick Start

```bash
# Basic usage
/workflow:req-plan-with-file "Implement user authentication system with OAuth and 2FA"

# With mode selection
/workflow:req-plan-with-file -m progressive "Build real-time notification system"   # Layered MVP→iterations
/workflow:req-plan-with-file -m direct "Refactor payment module"                   # Topologically-sorted task sequence
/workflow:req-plan-with-file -m auto "Add data export feature"                     # Auto-select strategy

# Continue existing session
/workflow:req-plan-with-file --continue "user authentication system"

# Auto mode
/workflow:req-plan-with-file -y "Implement caching layer"
```

**Context Source**: cli-explore-agent (optional) + requirement analysis
**Output Directory**: `.workflow/.req-plan/{session-id}/`
**Core Innovation**: JSONL roadmap where each record is self-contained + has convergence criteria, independently executable via lite-plan

## Overview

Requirement-level layered roadmap planning command. Decomposes a requirement into **convergent layers or task sequences**, each record containing explicit completion criteria (convergence), independently executable via `lite-plan`.

**Dual Modes**:
- **Progressive**: Layered MVP→iterations, suitable for high-uncertainty requirements (validate first, then refine)
- **Direct**: Topologically-sorted task sequence, suitable for low-uncertainty requirements (clear tasks, directly ordered)
- **Auto**: Automatically selects based on uncertainty level

**Core Workflow**: Requirement Understanding → Strategy Selection → Context Collection (optional) → Decomposition → Validation → Output

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    REQ-PLAN ROADMAP WORKFLOW                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Phase 1: Requirement Understanding & Strategy Selection                 │
│     ├─ Parse requirement: goal / constraints / stakeholders              │
│     ├─ Assess uncertainty level                                          │
│     │   ├─ High uncertainty → recommend progressive                      │
│     │   └─ Low uncertainty  → recommend direct                           │
│     ├─ User confirms strategy (-m skips, -y auto-selects recommended)    │
│     └─ Initialize strategy-assessment.json + roadmap.md skeleton         │
│                                                                          │
│  Phase 2: Context Collection (Optional)                                  │
│     ├─ Detect codebase: package.json / go.mod / src / ...                │
│     ├─ Has codebase → cli-explore-agent explores relevant modules        │
│     └─ No codebase  → skip, pure requirement decomposition               │
│                                                                          │
│  Phase 3: Decomposition Execution (cli-roadmap-plan-agent)               │
│     ├─ Progressive: define 2-4 layers, each with full convergence        │
│     ├─ Direct: vertical slicing + topological sort, each with convergence│
│     └─ Generate roadmap.jsonl (one self-contained record per line)        │
│                                                                          │
│  Phase 4: Interactive Validation & Final Output                          │
│     ├─ Display decomposition results (tabular + convergence criteria)    │
│     ├─ User feedback loop (up to 5 rounds)                               │
│     ├─ Generate final roadmap.md                                         │
│     └─ Next steps: layer-by-layer lite-plan / create issue / export      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Output

```
.workflow/.req-plan/RPLAN-{slug}-{YYYY-MM-DD}/
├── roadmap.md                    # ⭐ Human-readable roadmap
├── roadmap.jsonl                 # ⭐ Machine-readable, one self-contained record per line (with convergence)
├── strategy-assessment.json      # Strategy assessment result
└── exploration-codebase.json     # Codebase context (optional)
```

| File | Phase | Description |
|------|-------|-------------|
| `strategy-assessment.json` | 1 | Uncertainty analysis + mode recommendation + extracted goal/constraints/stakeholders |
| `roadmap.md` (skeleton) | 1 | Initial skeleton with placeholders, finalized in Phase 4 |
| `exploration-codebase.json` | 2 | Codebase context: relevant modules, patterns, integration points (only when codebase exists) |
| `roadmap.jsonl` | 3 | One self-contained JSON record per line with convergence criteria |
| `roadmap.md` (final) | 4 | Human-readable roadmap with tabular display + convergence details, revised per user feedback |

**roadmap.md template**:

```markdown
# Requirement Roadmap

**Session**: RPLAN-{slug}-{date}
**Requirement**: {requirement}
**Strategy**: {progressive|direct}
**Generated**: {timestamp}

## Strategy Assessment
- Uncertainty level: {high|medium|low}
- Decomposition mode: {progressive|direct}
- Assessment basis: {factors summary}

## Roadmap
{Tabular display of layers/tasks}

## Convergence Criteria Details
{Expanded convergence for each layer/task}

## Risks
{Aggregated risks}

## Next Steps
{Execution guidance}
```

## Configuration

| Flag | Default | Description |
|------|---------|-------------|
| `-y, --yes` | false | Auto-confirm all decisions |
| `-c, --continue` | false | Continue existing session |
| `-m, --mode` | auto | Decomposition strategy: progressive / direct / auto |

**Session ID format**: `RPLAN-{slug}-{YYYY-MM-DD}`
- slug: lowercase, alphanumeric + CJK characters, max 40 chars
- date: YYYY-MM-DD (UTC+8)
- Auto-detect continue: session folder + roadmap.jsonl exists → continue mode

## JSONL Schema Design

### Convergence Criteria (convergence field)

Each JSONL record's `convergence` object contains three levels:

| Field | Purpose | Requirement |
|-------|---------|-------------|
| `criteria[]` | List of checkable specific conditions | **Testable** (can be written as assertions or manual steps) |
| `verification` | How to verify these conditions | **Executable** (command, script, or explicit steps) |
| `definition_of_done` | One-sentence completion definition | **Business language** (non-technical person can judge) |

### Progressive Mode

Each line = one layer. Layer naming convention:

| Layer | Name | Typical Goal |
|-------|------|--------------|
| L0 | MVP | Minimum viable closed loop, core path works end-to-end |
| L1 | Usable | Key user paths refined, basic error handling |
| L2 | Refined | Edge case handling, performance optimization, security hardening |
| L3 | Optimized | Advanced features, observability, operations support |

**Schema**: `id, name, goal, scope[], excludes[], convergence{}, risks[], effort, depends_on[]`

```jsonl
{"id":"L0","name":"MVP","goal":"Minimum viable closed loop","scope":["User registration and login","Basic CRUD"],"excludes":["OAuth","2FA"],"convergence":{"criteria":["End-to-end register→login→operate flow works","Core API returns correct responses"],"verification":"curl/Postman manual testing or smoke test script","definition_of_done":"New user can complete the full flow of register→login→perform one core operation"},"risks":[{"description":"JWT library selection needs validation","probability":"Medium","impact":"Medium","mitigation":"N/A"}],"effort":"medium","depends_on":[]}
{"id":"L1","name":"Usable","goal":"Complete key user paths","scope":["Password reset","Input validation","Error messages"],"excludes":["Audit logs","Rate limiting"],"convergence":{"criteria":["All form fields have frontend+backend validation","Password reset email can be sent and reset completed","Error scenarios show user-friendly messages"],"verification":"Unit tests cover validation logic + manual test of reset flow","definition_of_done":"Users have a clear recovery path when encountering input errors or forgotten passwords"},"risks":[],"effort":"medium","depends_on":["L0"]}
```

**Constraints**: 2-4 layers, L0 must be a self-contained closed loop with no dependencies, each feature belongs to exactly ONE layer (no scope overlap).

### Direct Mode

Each line = one task. Task type convention:

| Type | Use Case |
|------|----------|
| infrastructure | Data models, configuration, scaffolding |
| feature | API, UI, business logic implementation |
| enhancement | Validation, error handling, edge cases |
| testing | Unit tests, integration tests, E2E |

**Schema**: `id, title, type, scope, inputs[], outputs[], convergence{}, depends_on[], parallel_group`

```jsonl
{"id":"T1","title":"Establish data model","type":"infrastructure","scope":"DB schema + TypeScript types","inputs":[],"outputs":["schema.prisma","types/user.ts"],"convergence":{"criteria":["Migration executes without errors","TypeScript types compile successfully","Fields cover all business entities"],"verification":"npx prisma migrate dev && npx tsc --noEmit","definition_of_done":"Database schema migrates correctly, type definitions can be referenced by other modules"},"depends_on":[],"parallel_group":1}
{"id":"T2","title":"Implement core API","type":"feature","scope":"CRUD endpoints for User","inputs":["schema.prisma","types/user.ts"],"outputs":["routes/user.ts","controllers/user.ts"],"convergence":{"criteria":["GET/POST/PUT/DELETE return correct status codes","Request/response conforms to schema","No N+1 queries"],"verification":"jest --testPathPattern=user.test.ts","definition_of_done":"All User CRUD endpoints pass integration tests"},"depends_on":["T1"],"parallel_group":2}
```

**Constraints**: Inputs must come from preceding task outputs or existing resources, tasks in same parallel_group must be truly independent, no circular dependencies.

## Implementation

### Session Initialization

**Objective**: Create session context and directory structure.

```javascript
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

// Parse flags
const autoYes = $ARGUMENTS.includes('--yes') || $ARGUMENTS.includes('-y')
const continueMode = $ARGUMENTS.includes('--continue') || $ARGUMENTS.includes('-c')
const modeMatch = $ARGUMENTS.match(/(?:--mode|-m)\s+(progressive|direct|auto)/)
const requestedMode = modeMatch ? modeMatch[1] : 'auto'

// Clean requirement text (remove flags)
const requirement = $ARGUMENTS
  .replace(/--yes|-y|--continue|-c|--mode\s+\w+|-m\s+\w+/g, '')
  .trim()

const slug = requirement.toLowerCase()
  .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
  .substring(0, 40)
const dateStr = getUtc8ISOString().substring(0, 10)
const sessionId = `RPLAN-${slug}-${dateStr}`
const sessionFolder = `.workflow/.req-plan/${sessionId}`

// Auto-detect continue: session folder + roadmap.jsonl exists → continue mode
Bash(`mkdir -p ${sessionFolder}`)
```

### Phase 1: Requirement Understanding & Strategy Selection

**Objective**: Parse requirement, assess uncertainty, select decomposition strategy.

**Prerequisites**: Session initialized, requirement description available.

**Steps**:

1. **Parse Requirement**
   - Extract core goal (what to achieve)
   - Identify constraints (tech stack, timeline, compatibility, etc.)
   - Identify stakeholders (users, admins, developers, etc.)
   - Identify keywords to determine domain

2. **Assess Uncertainty Level**

   ```javascript
   const uncertaintyFactors = {
     scope_clarity: 'low|medium|high',
     technical_risk: 'low|medium|high',
     dependency_unknown: 'low|medium|high',
     domain_familiarity: 'low|medium|high',
     requirement_stability: 'low|medium|high'
   }
   // high uncertainty (>=3 high) → progressive
   // low uncertainty (>=3 low)  → direct
   // otherwise → ask user preference
   ```

3. **Strategy Selection** (skip if `-m` already specified)

   ```javascript
   if (requestedMode !== 'auto') {
     selectedMode = requestedMode
   } else if (autoYes) {
     selectedMode = recommendedMode
   } else {
     AskUserQuestion({
       questions: [{
         question: `Decomposition strategy selection:\n\nUncertainty assessment: ${uncertaintyLevel}\nRecommended strategy: ${recommendedMode}\n\nSelect decomposition strategy:`,
         header: "Strategy",
         multiSelect: false,
         options: [
           {
             label: recommendedMode === 'progressive' ? "Progressive (Recommended)" : "Progressive",
             description: "Layered MVP→iterations, validate core first then refine progressively. Suitable for high-uncertainty requirements needing quick validation"
           },
           {
             label: recommendedMode === 'direct' ? "Direct (Recommended)" : "Direct",
             description: "Topologically-sorted task sequence with explicit dependencies. Suitable for clear requirements with confirmed technical approach"
           }
         ]
       }]
     })
   }
   ```

4. **Generate strategy-assessment.json**

   ```javascript
   const strategyAssessment = {
     session_id: sessionId,
     requirement: requirement,
     timestamp: getUtc8ISOString(),
     uncertainty_factors: uncertaintyFactors,
     uncertainty_level: uncertaintyLevel,  // 'high' | 'medium' | 'low'
     recommended_mode: recommendedMode,
     selected_mode: selectedMode,
     goal: extractedGoal,
     constraints: extractedConstraints,
     stakeholders: extractedStakeholders,
     domain_keywords: extractedKeywords
   }
   Write(`${sessionFolder}/strategy-assessment.json`, JSON.stringify(strategyAssessment, null, 2))
   ```

5. **Initialize roadmap.md skeleton** (placeholder sections, finalized in Phase 4)

   ```javascript
   const roadmapMdSkeleton = `# Requirement Roadmap

**Session**: ${sessionId}
**Requirement**: ${requirement}
**Strategy**: ${selectedMode}
**Status**: Planning
**Created**: ${getUtc8ISOString()}

## Strategy Assessment
- Uncertainty level: ${uncertaintyLevel}
- Decomposition mode: ${selectedMode}

## Roadmap
> To be populated after Phase 3 decomposition

## Convergence Criteria Details
> To be populated after Phase 3 decomposition

## Risk Items
> To be populated after Phase 3 decomposition

## Next Steps
> To be populated after Phase 4 validation
`
   Write(`${sessionFolder}/roadmap.md`, roadmapMdSkeleton)
   ```

**Success Criteria**:
- Requirement goal, constraints, stakeholders identified
- Uncertainty level assessed
- Strategy selected (progressive or direct)
- strategy-assessment.json generated
- roadmap.md skeleton initialized

### Phase 2: Context Collection (Optional)

**Objective**: If a codebase exists, collect relevant context to enhance decomposition quality.

**Prerequisites**: Phase 1 complete.

**Steps**:

1. **Detect Codebase**

   ```javascript
   const hasCodebase = Bash(`
     test -f package.json && echo "nodejs" ||
     test -f go.mod && echo "golang" ||
     test -f Cargo.toml && echo "rust" ||
     test -f pyproject.toml && echo "python" ||
     test -f pom.xml && echo "java" ||
     test -d src && echo "generic" ||
     echo "none"
   `).trim()
   ```

2. **Codebase Exploration** (only when hasCodebase !== 'none')

   ```javascript
   if (hasCodebase !== 'none') {
     Task({
       subagent_type: "cli-explore-agent",
       run_in_background: false,
       description: `Explore codebase: ${slug}`,
       prompt: `
   ## Exploration Context
   Requirement: ${requirement}
   Strategy: ${selectedMode}
   Project Type: ${hasCodebase}
   Session: ${sessionFolder}

   ## MANDATORY FIRST STEPS
   1. Run: ccw tool exec get_modules_by_depth '{}'
   2. Execute relevant searches based on requirement keywords
   3. Read: .workflow/project-tech.json (if exists)
   4. Read: .workflow/project-guidelines.json (if exists)

   ## Exploration Focus
   - Identify modules/components related to the requirement
   - Find existing patterns that should be followed
   - Locate integration points for new functionality
   - Assess current architecture constraints

   ## Output
   Write findings to: ${sessionFolder}/exploration-codebase.json

   Schema: {
     project_type: "${hasCodebase}",
     relevant_modules: [{name, path, relevance}],
     existing_patterns: [{pattern, files, description}],
     integration_points: [{location, description, risk}],
     architecture_constraints: [string],
     tech_stack: {languages, frameworks, tools},
     _metadata: {timestamp, exploration_scope}
   }
   `
     })
   }
   // No codebase → skip, proceed directly to Phase 3
   ```

**Success Criteria**:
- Codebase detection complete
- When codebase exists, exploration-codebase.json generated
- When no codebase, skipped and logged

### Phase 3: Decomposition Execution

**Objective**: Execute requirement decomposition via `cli-roadmap-plan-agent`, generating roadmap.jsonl + roadmap.md.

**Prerequisites**: Phase 1, Phase 2 complete. Strategy selected. Context collected (if applicable).

**Agent**: `cli-roadmap-plan-agent` (dedicated requirement roadmap planning agent, supports CLI-assisted decomposition + built-in quality checks)

**Steps**:

1. **Prepare Context**

   ```javascript
   const strategy = JSON.parse(Read(`${sessionFolder}/strategy-assessment.json`))
   let explorationContext = null
   if (file_exists(`${sessionFolder}/exploration-codebase.json`)) {
     explorationContext = JSON.parse(Read(`${sessionFolder}/exploration-codebase.json`))
   }
   ```

2. **Invoke cli-roadmap-plan-agent**

   The agent internally executes a 5-phase flow:
   - Phase 1: Context loading + requirement analysis
   - Phase 2: CLI-assisted decomposition (Gemini → Qwen → manual fallback)
   - Phase 3: Record enhancement + validation (schema compliance, dependency checks, convergence quality)
   - Phase 4: Generate roadmap.jsonl + roadmap.md
   - Phase 5: CLI decomposition quality check (**MANDATORY** - requirement coverage, convergence criteria quality, dependency correctness)

   ```javascript
   Task({
     subagent_type: "cli-roadmap-plan-agent",
     run_in_background: false,
     description: `Roadmap decomposition: ${slug}`,
     prompt: `
   ## Roadmap Decomposition Task

   ### Input Context
   - **Requirement**: ${requirement}
   - **Selected Mode**: ${selectedMode}
   - **Session ID**: ${sessionId}
   - **Session Folder**: ${sessionFolder}

   ### Strategy Assessment
   ${JSON.stringify(strategy, null, 2)}

   ### Codebase Context
   ${explorationContext
     ? `File: ${sessionFolder}/exploration-codebase.json\n${JSON.stringify(explorationContext, null, 2)}`
     : 'No codebase detected - pure requirement decomposition'}

   ### CLI Configuration
   - Primary tool: gemini
   - Fallback: qwen
   - Timeout: 60000ms

   ### Expected Output
   1. **${sessionFolder}/roadmap.jsonl** - One JSON record per line with convergence field
   2. **${sessionFolder}/roadmap.md** - Human-readable roadmap with tables and convergence details

   ### Mode-Specific Requirements

   ${selectedMode === 'progressive' ? `**Progressive Mode**:
   - 2-4 layers from MVP to full implementation
   - Each layer: id (L0-L3), name, goal, scope, excludes, convergence, risks, effort, depends_on
   - L0 (MVP) must be a self-contained closed loop with no dependencies
   - Scope: each feature belongs to exactly ONE layer (no overlap)
   - Layer names: MVP / Usable / Refined / Optimized` :

   `**Direct Mode**:
   - Topologically-sorted task sequence
   - Each task: id (T1-Tn), title, type, scope, inputs, outputs, convergence, depends_on, parallel_group
   - Inputs must come from preceding task outputs or existing resources
   - Tasks in same parallel_group must be truly independent`}

   ### Convergence Quality Requirements
   - criteria[]: MUST be testable (can write assertions or manual verification steps)
   - verification: MUST be executable (command, script, or explicit steps)
   - definition_of_done: MUST use business language (non-technical person can judge)

   ### Execution
   1. Analyze requirement and build decomposition context
   2. Execute CLI-assisted decomposition (Gemini, fallback Qwen)
   3. Parse output, validate records, enhance convergence quality
   4. Write roadmap.jsonl + roadmap.md
   5. Execute mandatory quality check (Phase 5)
   6. Return brief completion summary
   `
   })
   ```

**Success Criteria**:
- roadmap.jsonl generated, each line independently JSON.parse-able
- roadmap.md generated (follows template in Output section)
- Each record contains convergence (criteria + verification + definition_of_done)
- Agent's internal quality check passed
- No circular dependencies
- Progressive: 2-4 layers, no scope overlap
- Direct: tasks have explicit inputs/outputs, parallel_group assigned

### Phase 4: Interactive Validation & Final Output

**Objective**: Display decomposition results, collect user feedback, generate final artifacts.

**Prerequisites**: Phase 3 complete, roadmap.jsonl generated.

**Steps**:

1. **Display Decomposition Results** (tabular format)

   **Progressive Mode**:
   ```markdown
   ## Roadmap Overview

   | Layer | Name | Goal | Scope | Effort | Dependencies |
   |-------|------|------|-------|--------|--------------|
   | L0 | MVP | ... | ... | medium | - |
   | L1 | Usable | ... | ... | medium | L0 |

   ### Convergence Criteria
   **L0 - MVP**:
   - ✅ Criteria: [criteria list]
   - 🔍 Verification: [verification]
   - 🎯 Definition of Done: [definition_of_done]
   ```

   **Direct Mode**:
   ```markdown
   ## Task Sequence

   | Group | ID | Title | Type | Dependencies |
   |-------|----|-------|------|--------------|
   | 1 | T1 | ... | infrastructure | - |
   | 2 | T2 | ... | feature | T1 |

   ### Convergence Criteria
   **T1 - Establish Data Model**:
   - ✅ Criteria: [criteria list]
   - 🔍 Verification: [verification]
   - 🎯 Definition of Done: [definition_of_done]
   ```

2. **User Feedback Loop** (up to 5 rounds, skipped when autoYes)

   ```javascript
   if (!autoYes) {
     let round = 0
     let continueLoop = true

     while (continueLoop && round < 5) {
       round++
       const feedback = AskUserQuestion({
         questions: [{
           question: `Roadmap validation (round ${round}):\nAny feedback on the current decomposition?`,
           header: "Feedback",
           multiSelect: false,
           options: [
             { label: "Approve", description: "Decomposition is reasonable, generate final artifacts" },
             { label: "Adjust Scope", description: "Some layer/task scopes need adjustment" },
             { label: "Modify Convergence", description: "Convergence criteria are not specific or testable enough" },
             { label: "Re-decompose", description: "Overall strategy or layering approach needs change" }
           ]
         }]
       })

       if (feedback === 'Approve') {
         continueLoop = false
       } else {
         // Handle adjustment based on feedback type
         // After adjustment, re-display and return to loop top
       }
     }
   }
   ```

3. **Finalize roadmap.md** (populate template from Output section with actual data)

   ```javascript
   const roadmapMd = `
   # Requirement Roadmap

   **Session**: ${sessionId}
   **Requirement**: ${requirement}
   **Strategy**: ${selectedMode}
   **Generated**: ${getUtc8ISOString()}

   ## Strategy Assessment
   - Uncertainty level: ${strategy.uncertainty_level}
   - Decomposition mode: ${selectedMode}

   ## Roadmap
   ${generateRoadmapTable(items, selectedMode)}

   ## Convergence Criteria Details
   ${items.map(item => generateConvergenceSection(item, selectedMode)).join('\n\n')}

   ## Risk Items
   ${generateRiskSection(items)}

   ## Next Steps
   Each layer/task can be executed independently:
   \`\`\`bash
   /workflow:lite-plan "${items[0].name || items[0].title}: ${items[0].scope}"
   \`\`\`
   Roadmap JSONL file: \`${sessionFolder}/roadmap.jsonl\`
   `
   Write(`${sessionFolder}/roadmap.md`, roadmapMd)
   ```

4. **Post-Completion Options**

   ```javascript
   if (!autoYes) {
     AskUserQuestion({
       questions: [{
         question: "Roadmap generated. Next step:",
         header: "Next Step",
         multiSelect: false,
         options: [
           { label: "Execute First Layer", description: `Launch lite-plan to execute ${items[0].id}` },
           { label: "Create Issue", description: "Create GitHub Issue based on roadmap" },
           { label: "Export Report", description: "Generate standalone shareable roadmap report" },
           { label: "Done", description: "Save roadmap only, execute later" }
         ]
       }]
     })
   }
   ```

   | Selection | Action |
   |-----------|--------|
   | Execute First Layer | `Skill(skill="workflow:lite-plan", args="${firstItem.scope}")` |
   | Create Issue | `Skill(skill="issue:new", args="...")` |
   | Export Report | Copy roadmap.md + roadmap.jsonl to user-specified location, or generate standalone HTML/Markdown report |
   | Done | Display roadmap file paths, end |

**Success Criteria**:
- User feedback processed (or skipped via autoYes)
- roadmap.md finalized
- roadmap.jsonl final version updated
- Post-completion options provided

## Error Handling

| Error | Resolution |
|-------|------------|
| cli-explore-agent failure | Skip code exploration, proceed with pure requirement decomposition |
| No codebase | Normal flow, skip Phase 2 |
| Circular dependency detected | Prompt user to adjust dependencies, re-decompose |
| User feedback timeout | Save current state, display `--continue` recovery command |
| Max feedback rounds reached | Use current version to generate final artifacts |
| Session folder conflict | Append timestamp suffix |
| JSONL format error | Validate line by line, report problematic lines and fix |

## Best Practices

1. **Clear requirement description**: Detailed description → more accurate uncertainty assessment and decomposition
2. **Validate MVP first**: In progressive mode, L0 should be the minimum verifiable closed loop
3. **Testable convergence**: criteria must be writable as assertions or manual steps; definition_of_done should be judgeable by non-technical stakeholders (see Convergence Criteria in JSONL Schema Design)
4. **Agent-First for Exploration**: Delegate codebase exploration to cli-explore-agent, do not analyze directly in main flow
5. **Incremental validation**: Use `--continue` to iterate on existing roadmaps
6. **Independently executable**: Each JSONL record should be independently passable to lite-plan for execution

## Usage Recommendations

**Use `/workflow:req-plan-with-file` when:**
- You need to decompose a large requirement into a progressively executable roadmap
- Unsure where to start, need an MVP strategy
- Need to generate a trackable task sequence for the team
- Requirement involves multiple stages or iterations

**Use `/workflow:lite-plan` when:**
- You have a clear single task to execute
- The requirement is already a layer/task from the roadmap
- No layered planning needed

**Use `/workflow:collaborative-plan-with-file` when:**
- A single complex task needs multi-agent parallel planning
- Need to analyze the same task from multiple domain perspectives

**Use `/workflow:analyze-with-file` when:**
- Need in-depth analysis of a technical problem
- Not about planning execution, but understanding and discussion

---

**Now execute req-plan-with-file for**: $ARGUMENTS
