# Role Directory Guide

This directory contains all agent role specifications for Team Lifecycle v3.

## Directory Structure

```
roles/
├── README.md                    # This file
├── coordinator/                 # Orchestrator agent
│   ├── role.md                 # Coordinator specification
│   └── commands/               # User command handlers
│       ├── dispatch.md
│       └── monitor.md
├── pipeline/                    # Core pipeline roles (always present)
│   ├── analyst.md              # Research and discovery
│   ├── writer.md               # Document drafting
│   ├── planner.md              # Implementation planning
│   ├── executor.md             # Code implementation
│   ├── tester.md               # Test generation
│   ├── reviewer.md             # Quality review
│   ├── architect.md            # Architecture design (consulting)
│   ├── fe-developer.md         # Frontend development (consulting)
│   └── fe-qa.md                # Frontend QA (consulting)
└── specialists/                 # Specialist roles (dynamically injected)
    ├── orchestrator.role.md    # Multi-module coordination
    ├── security-expert.role.md # Security analysis
    ├── performance-optimizer.role.md # Performance optimization
    ├── data-engineer.role.md   # Data pipeline work
    ├── devops-engineer.role.md # DevOps and deployment
    └── ml-engineer.role.md     # ML/AI implementation
```

## Role Types

### Coordinator (Orchestrator)

**Location**: `coordinator/`

**Purpose**: Manages workflow orchestration, task dependencies, role injection, and artifact registry.

**Key Responsibilities**:
- Parse user requests and clarify requirements
- Create and manage team sessions
- Analyze complexity and inject specialist roles
- Create task chains with dependencies
- Spawn workers and handle callbacks
- Validate artifacts and advance pipeline
- Display checkpoints and handle user commands

**Always Present**: Yes

**Spawned By**: Skill invocation

### Pipeline Roles (Core Team)

**Location**: `pipeline/`

**Purpose**: Execute standard development workflow tasks.

**Always Present**: Yes (based on pipeline selection)

**Spawned By**: Coordinator

#### Core Pipeline Roles

| Role | File | Purpose | Task Prefix |
|------|------|---------|-------------|
| analyst | `analyst.md` | Research and discovery | RESEARCH-* |
| writer | `writer.md` | Document drafting | DRAFT-* |
| planner | `planner.md` | Implementation planning | PLAN-* |
| executor | `executor.md` | Code implementation | IMPL-* |
| tester | `tester.md` | Test generation and execution | TEST-* |
| reviewer | `reviewer.md` | Quality review and improvement | REVIEW-*, QUALITY-*, IMPROVE-* |

#### Consulting Roles

| Role | File | Purpose | Task Prefix | Injection Trigger |
|------|------|---------|-------------|-------------------|
| architect | `architect.md` | Architecture design | ARCH-* | High complexity |
| fe-developer | `fe-developer.md` | Frontend development | DEV-FE-* | Frontend tasks |
| fe-qa | `fe-qa.md` | Frontend QA | QA-FE-* | Frontend tasks |

### Specialist Roles (Dynamic Injection)

**Location**: `specialists/`

**Purpose**: Provide expert capabilities for specific domains.

**Always Present**: No (injected based on task analysis)

**Spawned By**: Coordinator (after complexity/keyword analysis)

| Role | File | Purpose | Task Prefix | Injection Trigger |
|------|------|---------|-------------|-------------------|
| orchestrator | `orchestrator.role.md` | Multi-module coordination | ORCH-* | Medium/High complexity |
| security-expert | `security-expert.role.md` | Security analysis and audit | SECURITY-* | Keywords: security, vulnerability, OWASP, auth |
| performance-optimizer | `performance-optimizer.role.md` | Performance optimization | PERF-* | Keywords: performance, optimization, bottleneck |
| data-engineer | `data-engineer.role.md` | Data pipeline work | DATA-* | Keywords: data, pipeline, ETL, schema |
| devops-engineer | `devops-engineer.role.md` | DevOps and deployment | DEVOPS-* | Keywords: devops, CI/CD, deployment, docker |
| ml-engineer | `ml-engineer.role.md` | ML/AI implementation | ML-* | Keywords: ML, model, training, inference |

## Role Specification Format

All role specifications follow this structure:

```markdown
---
role: <role-name>
type: <coordinator|pipeline|specialist>
task_prefix: <TASK-PREFIX>
priority: <P0|P1|P2>
injection_trigger: <always|complexity|keywords>
---

# Role: <Role Name>

## Purpose

Brief description of role purpose.

## Responsibilities

- Responsibility 1
- Responsibility 2

## Phase Execution

### Phase 1: Task Discovery
...

### Phase 2: Context Gathering
...

### Phase 3: Domain Work
...

### Phase 4: Artifact Generation
...

### Phase 5: Reporting
...

## Tools & Capabilities

- Tool 1
- Tool 2

## Artifact Contract

Expected artifacts and manifest schema.
```

## Worker Execution Model

All workers (pipeline and specialist roles) follow the **5-phase execution model**:

1. **Phase 1: Task Discovery** - Read task metadata, understand requirements
2. **Phase 2: Context Gathering** - Discover upstream artifacts, gather context
3. **Phase 3: Domain Work** - Execute role-specific work
4. **Phase 4: Artifact Generation** - Generate deliverables with manifest
5. **Phase 5: Reporting** - Report completion to coordinator

## CLI Tool Integration

Workers can use CLI tools for complex analysis:

| Capability | CLI Command | Used By |
|------------|-------------|---------|
| Codebase exploration | `ccw cli --tool gemini --mode analysis` | analyst, planner, architect |
| Multi-perspective critique | `ccw cli --tool gemini --mode analysis` (parallel) | analyst, writer, reviewer |
| Document generation | `ccw cli --tool gemini --mode write` | writer |

**Note**: Workers CANNOT spawn utility members (explorer, discussant). Only the coordinator can spawn utility members.

## Utility Members (Coordinator-Only)

Utility members are NOT roles but specialized subagents that can only be spawned by the coordinator:

| Utility | Purpose | Callable By |
|---------|---------|-------------|
| explorer | Parallel multi-angle exploration | Coordinator only |
| discussant | Aggregate multi-CLI critique | Coordinator only |
| doc-generator | Template-based doc generation | Coordinator only |

**Location**: `../subagents/` (not in roles directory)

## Adding New Roles

To add a new specialist role:

1. Create role specification file in `specialists/` directory
2. Follow the role specification format
3. Define injection trigger (keywords or complexity)
4. Update `../specs/team-config.json` role registry
5. Update coordinator's role injection logic
6. Test with sample task descriptions

## Role Selection Logic

### Pipeline Selection

Coordinator selects pipeline based on user requirements:

- **Spec-only**: Documentation, requirements, design work
- **Impl-only**: Quick implementations with clear requirements
- **Full-lifecycle**: Complete feature development

### Specialist Injection

Coordinator analyzes task description for:

1. **Keywords**: Specific domain terms (security, performance, data, etc.)
2. **Complexity**: Module count, dependency depth
3. **Explicit requests**: User mentions specific expertise needed

### Conditional Routing

PLAN-001 assesses complexity and routes to appropriate implementation strategy:

- **Low complexity** → Direct implementation (executor only)
- **Medium complexity** → Orchestrated implementation (orchestrator + parallel executors)
- **High complexity** → Architecture + orchestrated implementation (architect + orchestrator + parallel executors)

## Reference Documents

For detailed information, see:

- [../specs/core-concepts.md](../specs/core-concepts.md) - Foundational principles
- [../specs/execution-flow.md](../specs/execution-flow.md) - Execution walkthrough
- [../specs/artifact-contract-spec.md](../specs/artifact-contract-spec.md) - Artifact manifest specification
- [coordinator/role.md](coordinator/role.md) - Coordinator specification
