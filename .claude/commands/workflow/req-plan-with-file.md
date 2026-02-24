---
name: req-plan-with-file
description: Requirement-level progressive roadmap planning with issue creation. Decomposes requirements into convergent layers or task sequences, creates issues via ccw issue create, and generates roadmap.md for human review. Issues stored in .workflow/issues/issues.jsonl (single source of truth).
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
**Core Innovation**: Requirement decomposition → issue creation via `ccw issue create`. Issues stored in `.workflow/issues/issues.jsonl` (single source of truth). Wave/dependency info embedded in issue tags (`wave-N`) and `extended_context.notes.depends_on_issues`. team-planex consumes issues directly by ID or tag query.

## Overview

Requirement-level layered roadmap planning command. Decomposes a requirement into **convergent layers or task sequences**, creates issues via `ccw issue create`. Issues are the single source of truth in `.workflow/issues/issues.jsonl`; wave and dependency info is embedded in issue tags and `extended_context.notes`.

**Dual Modes**:
- **Progressive**: Layered MVP→iterations, suitable for high-uncertainty requirements (validate first, then refine)
- **Direct**: Topologically-sorted task sequence, suitable for low-uncertainty requirements (clear tasks, directly ordered)
- **Auto**: Automatically selects based on uncertainty level

**Core Workflow**: Requirement Understanding → Strategy Selection → Context Collection (optional) → Decomposition + Issue Creation → Validation → team-planex Handoff

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
│  Phase 3: Decomposition & Issue Creation (cli-roadmap-plan-agent)        │
│     ├─ Progressive: define 2-4 layers, each with full convergence        │
│     ├─ Direct: vertical slicing + topological sort, each with convergence│
│     ├─ Create issues via ccw issue create (ISS-xxx IDs)                  │
│     └─ Generate roadmap.md (with issue ID references)                    │
│                                                                          │
│  Phase 4: Validation & team-planex Handoff                               │
│     ├─ Display decomposition results (tabular + convergence criteria)    │
│     ├─ User feedback loop (up to 5 rounds)                               │
│     └─ Next steps: team-planex full execution / wave-by-wave / view      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Output

```
.workflow/.req-plan/RPLAN-{slug}-{YYYY-MM-DD}/
├── roadmap.md                    # Human-readable roadmap with issue ID references
├── strategy-assessment.json      # Strategy assessment result
└── exploration-codebase.json     # Codebase context (optional)
```

| File | Phase | Description |
|------|-------|-------------|
| `strategy-assessment.json` | 1 | Uncertainty analysis + mode recommendation + extracted goal/constraints/stakeholders |
| `roadmap.md` (skeleton) | 1 | Initial skeleton with placeholders, finalized in Phase 3 |
| `exploration-codebase.json` | 2 | Codebase context: relevant modules, patterns, integration points (only when codebase exists) |
| `roadmap.md` (final) | 3 | Human-readable roadmap with issue ID references, convergence details, team-planex execution guide |

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
- Auto-detect continue: session folder + roadmap.md exists → continue mode

## JSONL Schema Design

### Issue Format

Each line in `issues.jsonl` follows the standard `issues-jsonl-schema.json` (see `.ccw/workflows/cli-templates/schemas/issues-jsonl-schema.json`).

**Key fields per issue**:

| Field | Source | Description |
|-------|--------|-------------|
| `id` | `ccw issue create` | Formal ISS-YYYYMMDD-NNN ID |
| `title` | Layer/task mapping | `[LayerName] goal` or `[TaskType] title` |
| `context` | Convergence fields | Markdown with goal, scope, convergence criteria, verification, DoD |
| `priority` | Effort mapping | small→4, medium→3, large→2 |
| `source` | Fixed | `"text"` |
| `tags` | Auto-generated | `["req-plan", mode, name/type, "wave-N"]` |
| `extended_context.notes` | Metadata JSON | session, strategy, original_id, wave, depends_on_issues |
| `lifecycle_requirements` | Fixed | test_strategy, regression_scope, acceptance_type, commit_strategy |

### Convergence Criteria (in issue context)

Each issue's `context` field contains convergence information:

| Section | Purpose | Requirement |
|---------|---------|-------------|
| `## Convergence Criteria` | List of checkable specific conditions | **Testable** (can be written as assertions or manual steps) |
| `## Verification` | How to verify these conditions | **Executable** (command, script, or explicit steps) |
| `## Definition of Done` | One-sentence completion definition | **Business language** (non-technical person can judge) |

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

// Auto-detect continue: session folder + roadmap.md exists → continue mode
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

### Phase 3: Decomposition & Issue Creation

**Objective**: Execute requirement decomposition via `cli-roadmap-plan-agent`, creating issues and generating roadmap.md.

**Prerequisites**: Phase 1, Phase 2 complete. Strategy selected. Context collected (if applicable).

**Agent**: `cli-roadmap-plan-agent` (dedicated requirement roadmap planning agent, supports CLI-assisted decomposition + issue creation + built-in quality checks)

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
   - Phase 4: Issue creation + roadmap generation (ccw issue create → roadmap.md)
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

   ### Issue Creation
   - Use \`ccw issue create\` for each decomposed item
   - Issue format: issues-jsonl-schema (id, title, status, priority, context, source, tags, extended_context)
   - Update \`roadmap.md\` with issue ID references

   ### CLI Configuration
   - Primary tool: gemini
   - Fallback: qwen
   - Timeout: 60000ms

   ### Expected Output
   1. **${sessionFolder}/roadmap.md** - Human-readable roadmap with issue references
   2. Issues created in \`.workflow/issues/issues.jsonl\` via ccw issue create

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
   4. Create issues via ccw issue create, generate roadmap.md
   5. Execute mandatory quality check (Phase 5)
   6. Return brief completion summary
   `
   })
   ```

**Success Criteria**:
- Issues created via `ccw issue create`, each with formal ISS-xxx ID
- roadmap.md generated with issue ID references
- Agent's internal quality check passed
- No circular dependencies
- Progressive: 2-4 layers, no scope overlap
- Direct: tasks have explicit inputs/outputs, parallel_group assigned

### Phase 4: Validation & team-planex Handoff

**Objective**: Display decomposition results, collect user feedback, provide team-planex execution options.

**Prerequisites**: Phase 3 complete, issues created, roadmap.md generated.

**Steps**:

1. **Display Decomposition Results** (tabular format)

   ```javascript
   // Use issueIdMap from Phase 3 for display
   const issueIds = Object.values(issueIdMap)
   ```

   **Progressive Mode**:
   ```markdown
   ## Roadmap Overview

   | Wave | Issue ID | Name | Goal | Priority |
   |------|----------|------|------|----------|
   | 1 | ISS-xxx | MVP | ... | 2 |
   | 2 | ISS-yyy | Usable | ... | 3 |

   ### Convergence Criteria
   **Wave 1 - MVP (ISS-xxx)**:
   - Criteria: [criteria list]
   - Verification: [verification]
   - Definition of Done: [definition_of_done]
   ```

   **Direct Mode**:
   ```markdown
   ## Task Sequence

   | Wave | Issue ID | Title | Type | Dependencies |
   |------|----------|-------|------|--------------|
   | 1 | ISS-xxx | ... | infrastructure | - |
   | 2 | ISS-yyy | ... | feature | ISS-xxx |

   ### Convergence Criteria
   **Wave 1 - ISS-xxx**:
   - Criteria: [criteria list]
   - Verification: [verification]
   - Definition of Done: [definition_of_done]
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
             { label: "Approve", description: "Decomposition is reasonable, proceed to next steps" },
             { label: "Adjust Scope", description: "Some issue scopes need adjustment" },
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

3. **Post-Completion Options**

   ```javascript
   if (!autoYes) {
     AskUserQuestion({
       questions: [{
         question: `路线图已生成，${issueIds.length} 个 issues 已创建。下一步：`,
         header: "Next Step",
         multiSelect: false,
         options: [
           { label: "Execute with team-planex", description: `启动 team-planex 执行全部 ${issueIds.length} 个 issues` },
           { label: "Execute first wave", description: "仅执行 Wave 1（按 wave-1 tag 筛选）" },
           { label: "View issues", description: "查看已创建的 issue 详情" },
           { label: "Done", description: "保存路线图，稍后执行" }
         ]
       }]
     })
   }
   ```

   | Selection | Action |
   |-----------|--------|
   | Execute with team-planex | `Skill(skill="team-planex", args="${issueIds.join(' ')}")` |
   | Execute first wave | Filter issues by `wave-1` tag, pass to team-planex |
   | View issues | Display issues summary from `.workflow/issues/issues.jsonl` |
   | Done | Display file paths, end |

**Success Criteria**:
- User feedback processed (or skipped via autoYes)
- Post-completion options provided
- team-planex handoff available via issue IDs

## Error Handling

| Error | Resolution |
|-------|------------|
| cli-explore-agent failure | Skip code exploration, proceed with pure requirement decomposition |
| No codebase | Normal flow, skip Phase 2 |
| Circular dependency detected | Prompt user to adjust dependencies, re-decompose |
| User feedback timeout | Save current state, display `--continue` recovery command |
| Max feedback rounds reached | Use current version to generate final artifacts |
| Session folder conflict | Append timestamp suffix |

## Best Practices

1. **Clear requirement description**: Detailed description → more accurate uncertainty assessment and decomposition
2. **Validate MVP first**: In progressive mode, L0 should be the minimum verifiable closed loop
3. **Testable convergence**: criteria must be writable as assertions or manual steps; definition_of_done should be judgeable by non-technical stakeholders (see Convergence Criteria in JSONL Schema Design)
4. **Agent-First for Exploration**: Delegate codebase exploration to cli-explore-agent, do not analyze directly in main flow
5. **Incremental validation**: Use `--continue` to iterate on existing roadmaps
6. **team-planex integration**: Issues created follow standard issues-jsonl-schema, directly consumable by team-planex via issue IDs and tags


---

**Now execute req-plan-with-file for**: $ARGUMENTS
