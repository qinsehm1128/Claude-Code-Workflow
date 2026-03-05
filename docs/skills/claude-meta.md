# Claude Skills - Meta-Skills

## One-Liner

**Meta-Skills is a tool system for creating and managing other skills** — Through specification generation, skill generation, command generation, and help system, it enables sustainable development of the skill ecosystem.

## Pain Points Solved

| Pain Point | Current State | Claude Code Workflow Solution |
|------------|---------------|----------------------|
| **Complex skill creation** | Manual skill structure and file creation | Automated skill generation |
| **Missing specifications** | Project specs scattered everywhere | Unified specification generation system |
| **Difficult command discovery** | Hard to find appropriate commands | Intelligent command recommendation and search |
| **Tedious skill tuning** | Skill optimization lacks guidance | Automated diagnosis and tuning |

## Skills List

| Skill | Function | Trigger |
|-------|----------|---------|
| `spec-generator` | Specification generator (6-stage document chain) | `/spec-generator <idea>` |
| `brainstorm` | Brainstorming (multi-role parallel analysis) | `/brainstorm <topic>` |
| `skill-generator` | Skill generator (meta-skill) | `/skill-generator` |
| `skill-tuning` | Skill tuning diagnosis | `/skill-tuning <skill-name>` |
| `command-generator` | Command generator | `/command-generator` |
| `ccw-help` | CCW command help system | `/ccw-help` |
| `issue-manage` | Issue management | `/issue-manage` |

## Skills Details

### spec-generator

**One-Liner**: Specification generator — 6-stage document chain generates complete specification package (product brief, PRD, architecture, Epics)

**Trigger**:
```shell
/spec-generator <idea>
/spec-generator --continue        # Resume from checkpoint
/spec-generator -y <idea>        # Auto mode
```

**Features**:
- 6-stage document chain: Discovery → Requirements expansion → Product brief → PRD → Architecture → Epics → Readiness check
- Multi-perspective analysis: CLI tools (Gemini/Codex/Claude) provide product, technical, user perspectives
- Interactive defaults: Each stage provides user confirmation points; `-y` flag enables full auto mode
- Recoverable sessions: `spec-config.json` tracks completed stages; `-c` flag resumes from checkpoint
- Documentation only: No code generation or execution — clean handoff to existing execution workflows

**Architecture Overview**:
```plaintext
Phase 0:   Specification Study (Read specs/ + templates/ - mandatory prerequisite)
           |
Phase 1:   Discovery               -> spec-config.json + discovery-context.json
           |
Phase 1.5: Req Expansion           -> refined-requirements.json (interactive discussion + CLI gap analysis)
           |                           (-y auto mode: auto-expansion, skip interaction)
Phase 2:   Product Brief            -> product-brief.md  (multi-CLI parallel analysis)
           |
Phase 3:   Requirements (PRD)      -> requirements/  (_index.md + REQ-*.md + NFR-*.md)
           |
Phase 4:   Architecture            -> architecture/  (_index.md + ADR-*.md, multi-CLI review)
           |
Phase 5:   Epics & Stories         -> epics/  (_index.md + EPIC-*.md)
           |
Phase 6:   Readiness Check         -> readiness-report.md + spec-summary.md
           |
           Handoff to execution workflows
```

**⚠️ Mandatory Prerequisites**:

> **Do not skip**: Before executing any operations, you **must** completely read the following documents.

**Specification Documents** (required):
| Document | Purpose | Priority |
|----------|---------|----------|
| [specs/document-standards.md](specs/document-standards.md) | Document format, frontmatter, naming conventions | **P0 - Read before execution** |
| [specs/quality-gates.md](specs/quality-gates.md) | Quality gate standards and scoring per stage | **P0 - Read before execution** |

**Template Files** (read before generation):
| Document | Purpose |
|----------|---------|
| [templates/product-brief.md](templates/product-brief.md) | Product brief document template |
| [templates/requirements-prd.md](templates/requirements-prd.md) | PRD document template |
| [templates/architecture-doc.md](templates/architecture-doc.md) | Architecture document template |
| [templates/epics-template.md](templates/epics-template.md) | Epic/Story document template |

**Output Structure**:
```plaintext
.workflow/.spec/SPEC-{slug}-{YYYY-MM-DD}/
├── spec-config.json              # Session config + stage status
├── discovery-context.json        # Codebase exploration results (optional)
├── refined-requirements.json     # Phase 1.5: Post-discussion confirmed requirements
├── product-brief.md              # Phase 2: Product brief
├── requirements/                 # Phase 3: Detailed PRD (directory)
│   ├── _index.md                 #   Summary, MoSCoW table, traceability, links
│   ├── REQ-NNN-{slug}.md         #   Single functional requirement
│   └── NFR-{type}-NNN-{slug}.md  #   Single non-functional requirement
├── architecture/                 # Phase 4: Architecture decisions (directory)
│   ├── _index.md                 #   Summary, components, tech stack, links
│   └── ADR-NNN-{slug}.md         #   Single architecture decision record
├── epics/                        # Phase 5: Epic/Story breakdown (directory)
│   ├── _index.md                 #   Epic table, dependency graph, MVP scope
│   └── EPIC-NNN-{slug}.md        #   Single Epic with Stories
├── readiness-report.md           # Phase 6: Quality report
└── spec-summary.md               # Phase 6: One-page executive summary
```

**Handoff Options** (after Phase 6 completion):
| Option | Description |
|--------|-------------|
| `lite-plan` | Extract first MVP Epic description → direct text input |
| `plan` / `req-plan` | Create WFS session + .brainstorming/ bridge file |
| `issue:new` | Create Issue for each Epic |

---

### brainstorm

**One-Liner**: Brainstorming — Interactive framework generation, multi-role parallel analysis, and cross-role synthesis

**Trigger**:
```shell
/brainstorm <topic>
/brainstorm --count 3 "Build platform"
/brainstorm -y "GOAL: Build SCOPE: Users" --count 5
/brainstorm system-architect --session WFS-xxx
```

**Features**:
- Dual-mode routing: Interactive mode selection, supports parameter auto-detection
- **Auto mode**: Phase 2 (artifacts) → Phase 3 (N×Role parallel) → Phase 4 (synthesis)
- **Single Role mode**: Phase 3 (1×Role analysis)
- Progressive phase loading: Phase files loaded on-demand via `Ref:` markers
- Session continuity: All phases share session state via workflow-session.json

**Architecture Overview**:
```
┌─────────────────────────────────────────────────────────────┐
│                    /brainstorm                                │
│         Unified Entry Point + Interactive Routing             │
└───────────────────────┬─────────────────────────────────────┘
                        │
              ┌─────────┴─────────┐
              ↓                   ↓
    ┌─────────────────┐  ┌──────────────────┐
    │   Auto Mode     │  │ Single Role Mode │
    │                 │  │                  │
    └────────┬────────┘  └────────┬─────────┘
             │                    │
    ┌────────┼────────┐          │
    ↓        ↓        ↓          ↓
 Phase 2  Phase 3  Phase 4    Phase 3
Artifacts  N×Role  Synthesis  1×Role
 (7 steps) Analysis  (8 steps) Analysis
           parallel             (4 steps)
```

**Available Roles**:
| Role ID | Title | Focus Areas |
|---------|-------|-------------|
| `data-architect` | Data Architect | Data models, storage strategy, data flow |
| `product-manager` | Product Manager | Product strategy, roadmap, priorities |
| `product-owner` | Product Owner | Backlog management, user stories, acceptance criteria |
| `scrum-master` | Scrum Master | Process facilitation, impediment removal |
| `subject-matter-expert` | Subject Matter Expert | Domain knowledge, business rules, compliance |
| `system-architect` | System Architect | Technical architecture, scalability, integration |
| `test-strategist` | Test Strategist | Test strategy, quality assurance |
| `ui-designer` | UI Designer | Visual design, prototypes, design system |
| `ux-expert` | UX Expert | User research, information architecture, journeys |

**Output Structure**:
```plaintext
.workflow/active/WFS-{topic}/
├── workflow-session.json              # Session metadata
├── .process/
│   └── context-package.json           # Phase 0 output (auto mode)
└── .brainstorming/
    ├── guidance-specification.md      # Framework (Phase 2, auto mode)
    ├── feature-index.json             # Feature index (Phase 4, auto mode)
    ├── synthesis-changelog.md         # Synthesis decision audit trail (Phase 4, auto mode)
    ├── feature-specs/                 # Feature specifications (Phase 4, auto mode)
    │   ├── F-001-{slug}.md
    │   └── F-00N-{slug}.md
    ├── {role}/                        # Role analysis (immutable after Phase 3)
    │   ├── {role}-context.md          # Interactive Q&A responses
    │   ├── analysis.md                # Main/index document
    │   ├── analysis-cross-cutting.md  # Cross-functional
    │   └── analysis-F-{id}-{slug}.md  # Per-feature
    └── synthesis-specification.md     # Synthesis (Phase 4, non-feature mode)
```

**Core Rules**:
1. **Start with mode detection**: First action is Phase 1 (parse params + detect mode)
2. **Interactive routing**: If mode cannot be determined from params, ASK user
3. **No pre-analysis**: Do not analyze topic before Phase 2
4. **Parse every output**: Extract required data from each stage
5. **Auto-continue via TodoList**: Check TodoList status to auto-execute next pending stage
6. **Parallel execution**: Auto mode Phase 3 simultaneously appends multiple agent tasks for concurrent execution

---

### skill-generator

**One-Liner**: Skill generator — Meta-skill for creating new Claude Code Skills

**Trigger**:
```shell
/skill-generator
/create skill
/new skill
```

**Features**:
- Meta-skill for creating new Claude Code Skills
- Configurable execution modes: Sequential (fixed order) or Autonomous (stateless auto-selection)
- Use cases: Skill scaffolding, Skill creation, building new workflows

**Execution Modes**:
| Mode | Description | Use Case |
|------|-------------|----------|
| **Sequential** | Traditional linear execution, stages execute in numerical prefix order | Pipeline tasks, strong dependencies, fixed outputs |
| **Autonomous** | Intelligent routing, dynamically selects execution path | Interactive tasks, no strong dependencies, dynamic response |

**Phase 0**: **Mandatory Prerequisite** — Specification study (must complete before continuing)

**⚠️ Mandatory Prerequisites**:

> **Do not skip**: Before executing any operations, you **must** completely read the following documents.

**Core Specifications** (required):
| Document | Purpose | Priority |
|----------|---------|----------|
| [_shared/SKILL-DESIGN-SPEC.md](./_shared/SKILL-DESIGN-SPEC.md) | General design spec — Defines structure, naming, quality standards for all Skills | **P0 - Critical** |
| [specs/reference-docs-spec.md](specs/reference-docs-spec.md) | Reference doc generation spec — Ensures generated Skills have appropriate stage-based reference docs | **P0 - Critical** |

**Template Files** (read before generation):
| Document | Purpose |
|----------|---------|
| [templates/skill-md.md](templates/skill-md.md) | SKILL.md entry file template |
| [templates/sequential-phase.md](templates/sequential-phase.md) | Sequential stage template |
| [templates/autonomous-orchestrator.md](templates/autonomous-orchestrator.md) | Autonomous orchestrator template |
| [templates/autonomous-action.md](templates/autonomous-action.md) | Autonomous action template |

**Execution Flow**:
```plaintext
Phase 0: Specification Study (Mandatory)
   - Read: ../_shared/SKILL-DESIGN-SPEC.md
   - Read: All templates/*.md files
   - Understand: Structure rules, naming conventions, quality standards

Phase 1: Requirement Discovery
   - AskUserQuestion to collect requirements
   - Generate: skill-config.json

Phase 2: Structure Generation
   - Bash: mkdir -p directory structure
   - Write: SKILL.md

Phase 3: Phase/Action Generation (mode dependent)
   - Sequential → Generate phases/*.md
   - Autonomous → Generate orchestrator + actions/*.md

Phase 4: Specifications and Templates
   - Generate: domain specs, templates

Phase 5: Verification and Documentation
   - Verify: Completeness check
   - Generate: README.md, validation-report.json
```

**Output Structure** (Sequential):
```plaintext
.claude/skills/{skill-name}/
├── SKILL.md                        # Entry file
├── phases/
│   ├── _orchestrator.md            # Declarative orchestrator
│   ├── workflow.json               # Workflow definition
│   ├── 01-{step-one}.md           # Phase 1
│   ├── 02-{step-two}.md           # Phase 2
│   └── 03-{step-three}.md         # Phase 3
├── specs/
│   ├── {skill-name}-requirements.md
│   └── quality-standards.md
├── templates/
│   └── agent-base.md
├── scripts/
└── README.md
```

---

### ccw-help

**One-Liner**: CCW command help system — Command search, recommendations, documentation viewing

**Trigger**:
```shell
/ccw-help
/ccw "task description"          # Auto-select workflow and execute
/ccw-help search <keyword>       # Search commands
/ccw-help next <command>         # Get next step suggestions
```

**Features**:
- Command search, recommendations, documentation viewing
- Automatic workflow orchestration
- Beginner onboarding guidance

**Operation Modes**:
| Mode | Trigger | Description |
|------|---------|-------------|
| **Command Search** | "search commands", "find command" | Query command.json, filter relevant commands |
| **Smart Recommendations** | "next steps", "what's next" | Query flow.next_steps |
| **Documentation** | "how to use", "how to use" | Read source files, provide context examples |
| **Beginner Onboarding** | "beginner", "getting started" | Query essential_commands |
| **CCW Command Orchestration** | "ccw ", "auto workflow" | Analyze intent, auto-select workflow |
| **Issue Reporting** | "ccw-issue", "report bug" | Collect context, generate issue template |

**Supported Workflows**:
- **Level 1** (Lite-Lite-Lite): Super simple quick tasks
- **Level 2** (Rapid/Hotfix): Bug fixes, simple features, documentation
- **Level 2.5** (Rapid-to-Issue): Bridge from rapid planning to Issue workflow
- **Level 3** (Coupled): Complex features (plan, execute, review, test)
- **Level 3 Variants**: TDD, Test-fix, Review, UI design workflows
- **Level 4** (Full): Exploratory tasks (brainstorm)
- **With-File Workflows**: Documented exploration (multi-CLI collaboration)
- **Issue Workflow**: Batch Issue discovery, planning, queuing, execution

**Slash Commands**:
```bash
/ccw "task description"          # Auto-select workflow and execute
/ccw-help                        # Help entry
/ccw-help search <keyword>       # Search commands
/ccw-help next <command>         # Next step suggestions
/ccw-issue                       # Issue report
```

**CCW Command Examples**:
```bash
/ccw "Add user authentication"     # → auto-select level 2-3
/ccw "Fix memory leak"             # → auto-select bugfix
/ccw "Implement with TDD"          # → detect TDD workflow
/ccw "brainstorm: User notification system"  # → detect brainstorm
```

**Statistics**:
- **Commands**: 50+
- **Agents**: 16
- **Workflows**: 6 main levels + 3 with-file variants
- **Essential**: 10 core commands

---

### skill-tuning

**One-Liner**: Skill tuning diagnosis — Automated diagnosis and optimization recommendations

**Trigger**:
```shell
/skill-tuning <skill-name>
```

**Features**:
- Diagnose Skill issues
- Provide optimization recommendations
- Apply optimizations
- Verify improvements

**Diagnosis Flow**:
```plaintext
Analyze Skill → Identify issues → Generate recommendations → Apply optimizations → Verify effects
```

---

### command-generator

**One-Liner**: Command generator — Generate Claude commands

**Trigger**:
```shell
/command-generator
```

**Features**:
- Generate commands based on requirements
- Follow command specifications
- Generate command documentation

---

### issue-manage

**One-Liner**: Issue management — Issue creation, updates, status management

**Trigger**:
```shell
/issue-manage
/issue:new
```

**Features**:
- Issue creation
- Issue status management
- Issue associations and dependencies

## Related Commands

- [Claude Commands - CLI](../commands/claude/cli.md)
- [CCW CLI Tools](../features/cli.md)

## Best Practices

1. **Specification generation**: Use `spec-generator` to generate complete specification package, then handoff to execution workflows
2. **Brainstorming**: Use `brainstorm` for multi-role analysis to get comprehensive perspectives
3. **Skill creation**: Use `skill-generator` to create specification-compliant Skills
4. **Command help**: Use `ccw-help` to find commands and workflows
5. **Continuous tuning**: Use `skill-tuning` to regularly optimize Skill performance

## Usage Examples

```bash
# Generate product specification
/spec-generator "Build real-time collaboration platform"

# Brainstorm
/brainstorm "Design payment system" --count 3
/brainstorm system-architect --session WFS-xxx

# Create new Skill
/skill-generator

# Get help
/ccw "Add JWT authentication"
/ccw-help search "review"

# Manage Issues
/issue-manage
```
