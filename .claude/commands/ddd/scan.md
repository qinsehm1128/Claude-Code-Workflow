---
name: scan
description: Scan existing codebase to build document index without specs. Analyzes code structure, infers features, discovers components, and reverse-engineers project knowledge graph.
argument-hint: "[-y|--yes] [--from-scratch] [--scope <dir>] \"optional project description\""
allowed-tools: TodoWrite(*), Agent(*), AskUserQuestion(*), Read(*), Grep(*), Glob(*), Bash(*), Edit(*), Write(*), mcp__ace-tool__search_context(*)
---

## Auto Mode

When `--yes` or `-y`: Auto-confirm feature groupings, component naming, skip interactive review.

# DDD Scan Command (/ddd:scan)

## Purpose

For **existing projects without specifications**: analyze codebase to construct the document index by reverse-engineering project structure. This is the code-first entry point — no spec-generator required.

```
Codebase → Components → Features (inferred) → Requirements (inferred) → doc-index.json
```

## When to Use

- Existing project, no spec-generator outputs
- Want to start using doc-driven workflow on a legacy codebase
- Quick project mapping for onboarding or audit

## Prerequisite

- A codebase must exist (src/, lib/, app/, or similar source directories)
- Git repository recommended (for action history seeding)

## Storage Location

```
.workflow/.doc-index/
├── doc-index.json              ← Central index (primary output)
├── feature-maps/               ← Inferred feature documentation
│   ├── _index.md
│   └── {feature-slug}.md
├── tech-registry/              ← Discovered component documentation
│   ├── _index.md
│   └── {component-slug}.md
└── action-logs/                ← Git history seeds
    ├── _index.md
    └── {act-hash}.md
```

## Phase 1: Project Structure Analysis

### 1.1 Framework & Stack Detection

```bash
ccw cli -p "PURPOSE: Analyze project structure, tech stack, and architecture for documentation indexing.
TASK:
• Detect language/framework from manifest files (package.json, go.mod, Cargo.toml, requirements.txt, etc.)
• Map directory structure: source dirs, test dirs, config dirs, entry points
• Identify architectural pattern: monolith, microservices, monorepo, library, CLI tool
• Detect key dependencies and their roles (ORM, HTTP framework, auth library, etc.)
• List all major source directories with brief purpose description
MODE: analysis
CONTEXT: @**/*
EXPECTED: JSON with: {
  project_name, language, framework, architecture_pattern,
  source_dirs: [{ path, purpose, file_count }],
  dependencies: [{ name, role }],
  entry_points: [{ path, description }]
}
CONSTRAINTS: Prioritize source directories | Ignore node_modules, dist, build, vendor" --tool gemini --mode analysis
```

### 1.2 Merge with project-tech.json

If `.workflow/project-tech.json` exists, merge to reduce redundant analysis.

## Phase 2: Component Discovery

### 2.1 Deep Module Scan

```bash
ccw cli -p "PURPOSE: Discover all significant code components/modules for documentation indexing.
TASK:
• For each source directory, identify distinct modules/components
• For each component extract:
  - Name (class name, module name, or logical group)
  - Type: service | controller | model | util | hook | route | config | middleware | component
  - File paths (primary file + related files)
  - Exported symbols (public API: classes, functions, types, constants)
  - Internal dependencies: what other modules it imports from within the project
  - Responsibility: one-line description of what it does
• Group small utility files under parent module when they share domain
MODE: analysis
CONTEXT: @{source_dirs from Phase 1}
EXPECTED: JSON array: [{ name, type, files, symbols, depends_on, responsibility }]
CONSTRAINTS: Focus on business logic | Min threshold: components with 2+ exports or clear domain purpose | Group utilities under parent domain" --tool gemini --mode analysis
```

### 2.2 Generate Component IDs

For each discovered component:
- ID: `tech-{kebab-case-name}` (e.g., `tech-auth-service`, `tech-user-model`)
- Validate uniqueness, append counter on collision

### 2.3 Build Dependency Graph

From `depends_on` fields, construct internal dependency edges:
```
tech-auth-service → tech-user-model
tech-auth-service → tech-jwt-util
tech-order-controller → tech-auth-service
```

## Phase 3: Feature Inference

**Key step: group components into logical features without formal specs.**

### 3.1 Inference Strategy (priority order)

```
Strategy 1 — Directory grouping:
  src/auth/**       → feat-auth
  src/orders/**     → feat-orders
  src/payments/**   → feat-payments

Strategy 2 — Route/endpoint grouping (web apps):
  /api/users/*      → feat-user-management
  /api/orders/*     → feat-order-management

Strategy 3 — Dependency clustering:
  Components that heavily import each other → same feature

Strategy 4 — Domain keyword extraction:
  Class names + file names → domain terms → feature names
```

### 3.2 Gemini Feature Synthesis

```bash
ccw cli -p "PURPOSE: Infer high-level features from discovered code components. This project has no formal specification.
TASK:
Given these discovered components:
{component list from Phase 2: names, types, files, responsibilities, dependencies}

• Group them into logical features (3-10 features for a typical project)
• For each feature:
  - name: human-readable (Chinese OK)
  - component_ids: which components belong
  - description: what the feature does (inferred from code)
  - inferred_requirements: what this feature needs to accomplish (1-3 per feature)
  - status: 'implemented' (code complete) or 'partial' (incomplete patterns)
  - tags: search keywords
• Identify cross-cutting concerns (logging, auth middleware, error handling) as separate features
MODE: analysis
CONTEXT: {component list JSON}
EXPECTED: JSON: { features: [{ name, description, component_ids, inferred_requirements: [{ id, title }], status, tags }] }
CONSTRAINTS: Every component must belong to at least 1 feature | Prefer fewer broad features over many narrow ones" --tool gemini --mode analysis
```

### 3.3 Interactive Feature Review (unless -y)

Present inferred features to user:
- Allow renaming, merging, splitting
- Allow reassigning components between features
- Confirm final feature list

## Phase 4: Implicit Requirement & Architecture Extraction

### 4.1 Inferred Requirements

For each feature, generate lightweight requirement entries from its components:

```
Feature: feat-auth (User Authentication)
  → IREQ-001: "Users can log in with email and password"     (from LoginController)
  → IREQ-002: "JWT tokens for session management"            (from AuthMiddleware + jwt dep)
  → IREQ-003: "Password reset via email"                     (from PasswordResetService)
```

**ID Convention**: `IREQ-NNN` — distinguishes inferred from formal `REQ-NNN`.

### 4.2 Inferred Architecture Decisions

Detect patterns from code + dependencies:

```
Express.js + JWT middleware    → IADR-001: "REST API with JWT authentication"
Prisma ORM + PostgreSQL        → IADR-002: "PostgreSQL via Prisma ORM"
React + Redux                  → IADR-003: "React frontend with Redux state"
```

**ID Convention**: `IADR-NNN` — distinguishes inferred from formal `ADR-NNN`.

### 4.3 Glossary Generation

Extract domain terms from:
- Class/function names (CamelCase → terms)
- Key business terms in comments and strings
- Framework-specific terminology

Write to `.workflow/.doc-index/glossary.json`.

## Phase 5: Git History Seeds

```bash
git log --oneline --since="3 months ago" --no-merges --format="%H|%s|%ai" | head -30
```

For each significant commit:
- Match changed files to discovered components
- Create action entry with `type: "historical"`

## Phase 6: Assemble doc-index.json

Write the index with code-first markers:

```json
{
  "version": "1.0",
  "project": "{project-name}",
  "build_path": "code-first",
  "spec_session": null,
  "last_updated": "ISO8601",
  "glossary": [...],
  "features": [{
    "id": "feat-{slug}",
    "name": "Feature Name",
    "epicId": null,
    "status": "implemented|partial",
    "docPath": "feature-maps/{slug}.md",
    "requirementIds": ["IREQ-NNN"],
    "tags": ["tag"]
  }],
  "requirements": [{
    "id": "IREQ-NNN",
    "title": "Inferred requirement",
    "source": "inferred",
    "priority": "inferred",
    "sourcePath": null,
    "techComponentIds": ["tech-{slug}"],
    "featureId": "feat-{slug}"
  }],
  "technicalComponents": [{
    "id": "tech-{slug}",
    "name": "ComponentName",
    "type": "service|controller|model|...",
    "responsibility": "One-line description",
    "adrId": "IADR-NNN|null",
    "docPath": "tech-registry/{slug}.md",
    "codeLocations": [{ "path": "src/...", "symbols": [...] }],
    "dependsOn": ["tech-{other}"],
    "featureIds": ["feat-{slug}"],
    "actionIds": []
  }],
  "architectureDecisions": [{
    "id": "IADR-NNN",
    "title": "Inferred decision",
    "source": "inferred",
    "sourcePath": null,
    "componentIds": ["tech-{slug}"]
  }],
  "actions": [{
    "id": "act-{short-hash}",
    "description": "Commit message",
    "type": "historical",
    "status": "historical",
    "affectedComponents": ["tech-{slug}"],
    "relatedCommit": "full-hash",
    "timestamp": "ISO8601"
  }],
  "freshness": {
    "thresholds": { "warning": 0.3, "stale": 0.7 },
    "weights": { "time": 0.1, "churn": 0.4, "symbol": 0.5 },
    "time_decay_k": 0.05,
    "auto_regenerate": false
  },
  "deepwiki_feature_to_symbol_index": {}
}
```

## Phase 7: Layer-Based Document Generation (TASK-004)

**Generation Strategy**: Layer 3 → Layer 2 → Layer 1 (bottom-up, following memory-manage pattern)

### 7.1 Layer Definition

| Layer | Content | Generation Order | Dependencies |
|-------|---------|------------------|--------------|
| **Layer 3** | Component docs (`tech-registry/{slug}.md`) | First | Source code only |
| **Layer 2** | Feature docs (`feature-maps/{slug}.md`) | Second | Layer 3 component docs |
| **Layer 1** | Index docs (`README.md`, `ARCHITECTURE.md`, `_index.md`) | Third | Layer 2 feature docs |

### 7.2 Layer 3: Component Documentation

For each component in `technicalComponents[]`:

```bash
ccw cli -p "PURPOSE: Generate component documentation for {component.name}
TASK:
• Document component purpose and responsibility
• List exported symbols (classes, functions, types)
• Document dependencies (internal and external)
• Include code examples for key APIs
• Document integration points with other components
MODE: write
CONTEXT: @{component.codeLocations[].path}
EXPECTED: Markdown file with: Overview, API Reference, Dependencies, Usage Examples
CONSTRAINTS: Focus on public API | Include type signatures
" --tool gemini --mode write --cd .workflow/.doc-index/tech-registry/
```

Output: `.workflow/.doc-index/tech-registry/{component-slug}.md`

Add layer metadata to generated doc:
```markdown
---
layer: 3
component_id: tech-auth-service
generated_at: ISO8601
---
```

### 7.3 Layer 2: Feature Documentation

For each feature in `features[]`:

```bash
ccw cli -p "PURPOSE: Generate feature documentation for {feature.name}
TASK:
• Describe feature purpose and business value
• List requirements (from requirementIds)
• Document components involved (from techComponentIds)
• Include architecture decisions (from adrIds)
• Provide integration guide
MODE: write
CONTEXT: @.workflow/.doc-index/tech-registry/{related-components}.md
EXPECTED: Markdown file with: Overview, Requirements, Components, Architecture, Integration
CONSTRAINTS: Reference Layer 3 component docs | Business-focused language
" --tool gemini --mode write --cd .workflow/.doc-index/feature-maps/
```

Output: `.workflow/.doc-index/feature-maps/{feature-slug}.md`

Add layer metadata:
```markdown
---
layer: 2
feature_id: feat-auth
depends_on_layer3: [tech-auth-service, tech-user-model]
generated_at: ISO8601
---
```

### 7.4 Layer 1: Index Documentation

Generate top-level overview documents:

1. **README.md** - Project overview with navigation
2. **ARCHITECTURE.md** - System architecture overview
3. **feature-maps/_index.md** - Feature catalog
4. **tech-registry/_index.md** - Component catalog
5. **sessions/_index.md** - Planning sessions index

```bash
ccw cli -p "PURPOSE: Generate project overview documentation
TASK:
• Create README.md with project summary and navigation
• Create ARCHITECTURE.md with system design overview
• Create _index.md files for feature-maps and tech-registry
• Include links to all Layer 2 feature docs
MODE: write
CONTEXT: @.workflow/.doc-index/feature-maps/*.md @.workflow/.doc-index/tech-registry/*.md @.workflow/.doc-index/doc-index.json
EXPECTED: Overview documents with navigation links
CONSTRAINTS: High-level only | Link to Layer 2 docs for details
" --tool gemini --mode write --cd .workflow/.doc-index/
```

Add layer metadata:
```markdown
---
layer: 1
depends_on_layer2: [feat-auth, feat-orders]
generated_at: ISO8601
---
```

## Phase 8: Project Overview Documentation (TASK-005)

Generate standard overview documents as entry points for navigation.

### 8.1 README.md Template

```bash
ccw cli -p "PURPOSE: Generate project README with overview and navigation
TASK:
• Project summary and purpose
• Quick start guide
• Navigation to features, components, and architecture
• Link to doc-index.json
MODE: write
CONTEXT: @.workflow/.doc-index/doc-index.json @.workflow/.doc-index/feature-maps/_index.md
EXPECTED: README.md with: Overview, Quick Start, Navigation, Links
CONSTRAINTS: High-level only | Entry point for new developers
" --tool gemini --mode write --cd .workflow/.doc-index/
```

Output: `.workflow/.doc-index/README.md`

### 8.2 ARCHITECTURE.md Template

```bash
ccw cli -p "PURPOSE: Generate architecture overview document
TASK:
• System design overview
• Component relationships and dependencies
• Key architecture decisions (from ADRs)
• Technology stack
MODE: write
CONTEXT: @.workflow/.doc-index/doc-index.json @.workflow/.doc-index/tech-registry/*.md
EXPECTED: ARCHITECTURE.md with: System Design, Component Diagram, ADRs, Tech Stack
CONSTRAINTS: Architecture-focused | Reference component docs for details
" --tool gemini --mode write --cd .workflow/.doc-index/
```

Output: `.workflow/.doc-index/ARCHITECTURE.md`

### 8.3 sessions/_index.md Template

```bash
ccw cli -p "PURPOSE: Generate planning sessions index
TASK:
• List all planning session folders chronologically
• Link to each session's plan.json
• Show session status and task count
MODE: write
CONTEXT: @.workflow/.doc-index/planning/*/plan.json
EXPECTED: sessions/_index.md with: Session List, Links, Status
CONSTRAINTS: Chronological order | Link to session folders
" --tool gemini --mode write --cd .workflow/.doc-index/sessions/
```

Output: `.workflow/.doc-index/sessions/_index.md`

### 8.4 Update ddd:sync for Overview Docs

Add to Phase 4 (Refresh Documents):
- If Layer 2 changed significantly → regenerate README.md and ARCHITECTURE.md
- If new planning session created → update sessions/_index.md

## Phase 9: Schema Versioning (TASK-006)

### 9.1 Add schema_version to doc-index.json

Update Phase 6 doc-index.json generation to include:

```json
{
  "schema_version": "1.0",
  "version": "1.0",
  "project": "{project-name}",
  ...
}
```

### 9.2 Create SCHEMA.md

```bash
ccw cli -p "PURPOSE: Document doc-index.json schema structure and versioning
TASK:
• Document current schema structure (all fields)
• Define versioning policy (semver: major.minor)
• Document migration protocol for version upgrades
• Provide examples for each schema section
MODE: write
CONTEXT: @.workflow/.doc-index/doc-index.json
EXPECTED: SCHEMA.md with: Schema Structure, Versioning Policy, Migration Protocol, Examples
CONSTRAINTS: Complete field documentation | Clear migration steps
" --tool gemini --mode write --cd .workflow/.doc-index/
```

Output: `.workflow/.doc-index/SCHEMA.md`

### 9.3 Version Check Logic

Add to ddd:plan and ddd:sync Phase 1:

```javascript
const docIndex = JSON.parse(Read('.workflow/.doc-index/doc-index.json'));
const schemaVersion = docIndex.schema_version || '0.0'; // Default for legacy

if (schemaVersion !== '1.0') {
  console.warn(`Schema version mismatch: found ${schemaVersion}, expected 1.0`);
  console.warn('Consider running schema migration or regenerating doc-index');
}
```

### 9.4 Versioning Policy

**Semantic Versioning**:
- **Major** (X.0): Breaking changes (field removal, type changes, incompatible structure)
- **Minor** (X.Y): Non-breaking additions (new optional fields, new sections)

**Migration Protocol**:
1. Detect version mismatch in ddd:plan/ddd:sync
2. Log warning with migration instructions
3. Provide migration script or regeneration option
4. Update schema_version after successful migration

## Phase 6.5: Build DeepWiki Feature-to-Symbol Index

If DeepWiki is available (`.codexlens/deepwiki_index.db` exists):

1. Collect all `codeLocations[].path` from `technicalComponents[]`
2. Query DeepWiki: `POST /api/deepwiki/symbols-for-paths { paths: [...] }`
3. Build `deepwiki_feature_to_symbol_index` by traversing:
   `feature → requirementIds → techComponentIds → codeLocations → symbols`

```json
"deepwiki_feature_to_symbol_index": {
  "feat-auth": [
    "deepwiki:symbol:src/auth/jwt.ts#L30-L55",
    "deepwiki:symbol:src/models/user.ts#L12-L40"
  ]
}
```

**Symbol URN format**: `deepwiki:symbol:<file_path>#L<start>-L<end>`

**Graceful degradation**: If DeepWiki is unavailable, set `deepwiki_feature_to_symbol_index: {}` and log warning.

## Phase 7: Generate Documents

### 7.1 Feature Maps

For each feature → `feature-maps/{slug}.md`:
- Frontmatter with id, name, status, inferred requirements, components, tags
- Sections: Overview, Inferred Requirements, Technical Components, Dependencies, Change History
- Mark inferred content: `> Inferred from code analysis`

### 7.2 Tech Registry

For each component → `tech-registry/{slug}.md`:
- Frontmatter with id, name, type, code_locations, depends_on
- Sections: Responsibility, Code Locations, Related Features, Dependencies (in/out)

### 7.3 Index Documents

- `feature-maps/_index.md` — feature table
- `tech-registry/_index.md` — component table
- `action-logs/_index.md` — recent git history table

## Phase 8: Validation & Report

```
Scan Report

Project: {name} ({language}/{framework})
Architecture: {pattern}
Source dirs: {N}

Discovered:
  Components: {N} ({by type breakdown})
  Features: {N} (inferred)
  Requirements: {N} (IREQ, inferred)
  Architecture Decisions: {N} (IADR, inferred)
  Historical Actions: {N} (from git)

Coverage:
  Components → Features: {%}
  Dependencies mapped: {%}

Recommendations:
  - Run /spec-generator to formalize {N} inferred requirements
  - {N} components have unclear responsibility — review tech-registry docs
  - Use /ddd:plan to start planning tasks with this index
```

## Flags

| Flag | Effect |
|------|--------|
| `-y, --yes` | Auto-confirm all decisions |
| `--from-scratch` | Delete existing index and rebuild |
| `--scope <dir>` | Limit scan to specific directory (e.g., `--scope src/auth`) |

## Upgrade Path: scan → spec

When a scanned project later runs `spec-generator` + `/ddd:index-build`:
- `/ddd:index-build` detects existing code-first index
- Merges: `IREQ-NNN` → `REQ-NNN`, `IADR-NNN` → `ADR-NNN` where content overlaps
- Updates `build_path` to `"spec-first"`
- Preserves all `tech-*` and `feat-*` entries (updates links only)

## Integration Points

- **Input from**: Codebase, git history, `project-tech.json`
- **Output to**: `ddd:plan`, `ddd:sync`, `ddd:update`, `ddd:index-build` (upgrade)
- **Standalone**: Can be used independently on any project
