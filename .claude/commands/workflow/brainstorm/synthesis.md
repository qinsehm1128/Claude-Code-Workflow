---
name: synthesis
description: Clarify and refine role analyses through intelligent Q&A and targeted updates with synthesis agent
argument-hint: "[-y|--yes] [optional: --session session-id]"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*), Read(*), Write(*), Edit(*), Glob(*), AskUserQuestion(*)
---

## Auto Mode

When `--yes` or `-y`: Auto-select all enhancements, skip clarification questions, use default answers.

## Overview

Eight-phase workflow to eliminate ambiguities, enhance conceptual depth, and generate per-feature specifications:

**Phase 1-2**: Session detection → File discovery → Path preparation
**Phase 3A**: Cross-role analysis agent → Generate recommendations + feature_conflict_map
**Phase 4**: User selects enhancements → User answers clarifications (via AskUserQuestion)
**Phase 5**: Parallel update agents (one per role)
**Phase 6**: Parallel feature spec generation (one agent per feature) [feature_mode only]
**Phase 6.5**: Feature index generation (feature-index.json) [feature_mode only]
**Phase 7**: Context package update → Metadata update → Completion report

All user interactions use AskUserQuestion tool (max 4 questions per call, multi-round).

**Document Flow**:
- Input: `[role]/analysis.md` (index files), `guidance-specification.md`, session metadata
- Output: Updated `[role]/analysis*.md` with Enhancements + Clarifications sections
- Output (feature_mode): `feature-specs/F-{id}-{slug}.md` per feature + `feature-index.json`

---

## Quick Reference

### Phase Summary

| Phase | Goal | Executor | Output |
|-------|------|----------|--------|
| 1 | Session detection | Main flow | session_id, brainstorm_dir |
| 2 | File discovery | Main flow | role_analysis_paths |
| 3A | Cross-role analysis | Agent | enhancement_recommendations, feature_conflict_map |
| 4 | User interaction | Main flow + AskUserQuestion | update_plan |
| 5 | Document updates | Parallel agents | Updated analysis*.md |
| 6 | Feature spec generation | Parallel agents | feature-specs/F-{id}-{slug}.md [feature_mode] |
| 6.5 | Feature index generation | Main flow | feature-index.json [feature_mode] |
| 7 | Finalization | Main flow | context-package.json, report |

### AskUserQuestion Pattern

```javascript
// Enhancement selection (multi-select)
AskUserQuestion({
  questions: [{
    question: "请选择要应用的改进建议",
    header: "改进选择",
    multiSelect: true,
    options: [
      { label: "EP-001: API Contract", description: "添加详细的请求/响应 schema 定义" },
      { label: "EP-002: User Intent", description: "明确用户需求优先级和验收标准" }
    ]
  }]
})

// Clarification questions (single-select, multi-round)
AskUserQuestion({
  questions: [
    {
      question: "MVP 阶段的核心目标是什么？",
      header: "用户意图",
      multiSelect: false,
      options: [
        { label: "快速验证", description: "最小功能集，快速上线获取反馈" },
        { label: "技术壁垒", description: "完善架构，为长期发展打基础" },
        { label: "功能完整", description: "覆盖所有规划功能，延迟上线" }
      ]
    }
  ]
})
```

---

## Task Tracking

```json
[
  {"content": "Detect session and validate analyses", "status": "pending", "activeForm": "Detecting session"},
  {"content": "Discover role analysis file paths", "status": "pending", "activeForm": "Discovering paths"},
  {"content": "Execute analysis agent (cross-role analysis + feature conflict map)", "status": "pending", "activeForm": "Executing analysis"},
  {"content": "Present enhancements via AskUserQuestion", "status": "pending", "activeForm": "Selecting enhancements"},
  {"content": "Clarification questions via AskUserQuestion", "status": "pending", "activeForm": "Clarifying"},
  {"content": "Execute parallel update agents", "status": "pending", "activeForm": "Updating documents"},
  {"content": "Generate parallel feature specs (feature_mode only)", "status": "pending", "activeForm": "Generating feature specs"},
  {"content": "Generate feature-index.json (feature_mode only)", "status": "pending", "activeForm": "Building feature index"},
  {"content": "Update context package and metadata", "status": "pending", "activeForm": "Finalizing"}
]
```

---

## Execution Phases

### Phase 1: Discovery & Validation

1. **Detect Session**: Use `--session` parameter or find `.workflow/active/WFS-*`
2. **Validate Files**:
   - `guidance-specification.md` (optional, warn if missing)
   - `*/analysis*.md` (required, error if empty)
3. **Load User Intent**: Extract from `workflow-session.json`
4. **Detect Feature Mode**: Check if role analyses use feature-point organization
   ```javascript
   // Feature mode is active when:
   // 1. guidance-specification.md contains Feature Decomposition table
   // 2. Role directories contain analysis-F-{id}-*.md files
   const has_feature_decomposition = guidanceSpecContent &&
     guidanceSpecContent.includes('Feature Decomposition');
   const has_feature_subdocs = Glob(`${brainstorm_dir}/*/analysis-F-*-*.md`).length > 0;
   const feature_mode = has_feature_decomposition && has_feature_subdocs;

   // Extract feature_list from guidance-spec if feature_mode
   if (feature_mode) {
     feature_list = extractFeatureDecompositionTable(guidanceSpecContent);
     // feature_list: [{id, slug, description, roles, priority}, ...]
   }
   ```

### Phase 2: Role Discovery & Path Preparation

**Main flow prepares file paths for Agent**:

1. **Discover Analysis Files**:
   - Glob: `.workflow/active/WFS-{session}/.brainstorming/*/analysis*.md`
   - Supports: analysis.md + analysis-{slug}.md (max 5)

2. **Extract Role Information**:
   - `role_analysis_paths`: Relative paths
   - `participating_roles`: Role names from directories

3. **Pass to Agent**: session_id, brainstorm_dir, role_analysis_paths, participating_roles

### Phase 3A: Analysis & Enhancement Agent

**Agent executes cross-role analysis**:

**Input Optimization (feature_mode)**: When feature_mode is active, only read `{role}/analysis.md` index files (NOT sub-documents like `analysis-F-{id}-*.md` or `analysis-cross-cutting.md`). This reduces input tokens from ~39K to ~4.5K while preserving the role perspective overview, feature point index, and cross-cutting summary needed for conflict detection.

**Input (fallback mode)**: When feature_mode is NOT active, read all `{role}/analysis*.md` files as before.

```javascript
// Prepare input paths based on mode
const analysis_input_paths = feature_mode
  ? participating_roles.map(r => `${brainstorm_dir}/${r}/analysis.md`)  // Index files only (~4.5K total)
  : role_analysis_paths;  // All analysis files (fallback)

Task(conceptual-planning-agent, `
## Agent Mission
Analyze role documents, identify conflicts/gaps, generate enhancement recommendations.
${feature_mode ? 'Additionally, generate feature_conflict_map for per-feature consensus/conflicts across roles.' : ''}

## Input
- brainstorm_dir: ${brainstorm_dir}
- analysis_input_paths: ${analysis_input_paths}
- participating_roles: ${participating_roles}
- feature_mode: ${feature_mode}
${feature_mode ? `- guidance_spec_path: ${brainstorm_dir}/guidance-specification.md (read Feature Decomposition section only)` : ''}

## Flow Control Steps
1. load_session_metadata → Read workflow-session.json
2. load_role_analyses → Read analysis files from analysis_input_paths
   ${feature_mode ? '(INDEX files only - each ~500-800 words with role overview, feature index table, cross-cutting summary)' : '(All analysis files)'}
${feature_mode ? `3. load_feature_decomposition → Read Feature Decomposition table from guidance-specification.md
4. cross_role_analysis → Identify consensus, conflicts, gaps, ambiguities
5. generate_feature_conflict_map → For each feature in Feature Decomposition, extract per-feature consensus/conflicts/cross-references from role index summaries
6. generate_recommendations → Format as EP-001, EP-002, ...` : `3. cross_role_analysis → Identify consensus, conflicts, gaps, ambiguities
4. generate_recommendations → Format as EP-001, EP-002, ...`}

## Output Format

### enhancement_recommendations (always)
[
  {
    "id": "EP-001",
    "title": "API Contract Specification",
    "affected_roles": ["system-architect", "api-designer"],
    "category": "Architecture",
    "current_state": "High-level API descriptions",
    "enhancement": "Add detailed contract definitions",
    "rationale": "Enables precise implementation",
    "priority": "High"
  }
]

${feature_mode ? `### feature_conflict_map (feature_mode only)
Bridge artifact from Phase 3A to Phase 6. One entry per feature from Feature Decomposition.

{
  "F-001": {
    "consensus": [
      "All roles agree on real-time sync via WebSocket",
      "Event-driven architecture preferred"
    ],
    "conflicts": [
      {
        "topic": "State management approach",
        "views": {
          "system-architect": "Server-authoritative with CRDT",
          "ux-expert": "Optimistic local-first updates",
          "data-architect": "Event-sourced append-only log"
        },
        "resolution": "Hybrid: optimistic local with server reconciliation via CRDT"
      }
    ],
    "cross_refs": [
      "F-003 (offline-mode) depends on sync conflict resolution strategy",
      "analysis-cross-cutting.md#shared-patterns references this feature"
    ]
  },
  "F-002": { ... }
}

**feature_conflict_map Rules**:
- One entry per feature ID from guidance-specification.md Feature Decomposition
- consensus[]: Statements where 2+ roles explicitly agree (extracted from index summaries)
- conflicts[]: Disagreements with topic, per-role positions, and suggested resolution
- cross_refs[]: References to other features or cross-cutting docs that relate to this feature
- If a feature has no conflicts, set conflicts to empty array (consensus-only is valid)
- Keep each entry concise: aim for 100-200 words per feature

**Resolution Quality Requirements** (每条 conflict 的 resolution 必须满足):
1. **Actionable**: resolution 必须是可直接执行的技术方案，而非模糊描述。Bad: "需要权衡" → Good: "采用 JWT 无状态认证，RefreshToken 存 HttpOnly Cookie"
2. **Justified**: 说明为什么选择该方案而非其他。格式: "[方案] because [原因]，tradeoff: [代价]"
3. **Scoped**: 明确 resolution 的适用范围。如果仅适用于特定场景，标注 "Applies when: [条件]"
4. **Resolution Confidence**: 每条 conflict 标注置信度
   - `[RESOLVED]`: Phase 3A 从角色分析中找到明确共识或用户已决策 → Phase 6 直接采用
   - `[SUGGESTED]`: Phase 3A 基于角色分析推荐方案，但未被用户显式确认 → Phase 6 采用但标注来源
   - `[UNRESOLVED]`: 角色之间存在根本分歧且无法从现有信息推导 → Phase 6 标注 [DECISION NEEDED]，列出所有选项供 plan 阶段决策

**conflict entry 增强 schema**:
```json
{
  "topic": "State management approach",
  "views": {
    "system-architect": "Server-authoritative with CRDT",
    "ux-expert": "Optimistic local-first updates"
  },
  "resolution": "Hybrid: optimistic local with server reconciliation via CRDT because balances UX responsiveness with data consistency, tradeoff: increased client complexity",
  "confidence": "[RESOLVED]",
  "applies_when": "Online mode with collaborative editing"
}
```
` : ''}
`)
```

**Phase 3A Output Storage**:
```javascript
// Store enhancement_recommendations for Phase 4
const enhancement_recommendations = agent_output.enhancement_recommendations;

// Store feature_conflict_map for Phase 6 (feature_mode only)
const feature_conflict_map = feature_mode ? agent_output.feature_conflict_map : null;
```
```

### Phase 4: User Interaction

**All interactions via AskUserQuestion (Chinese questions)**

#### Step 1: Enhancement Selection

```javascript
// If enhancements > 4, split into multiple rounds
const enhancements = [...]; // from Phase 3A
const BATCH_SIZE = 4;

for (let i = 0; i < enhancements.length; i += BATCH_SIZE) {
  const batch = enhancements.slice(i, i + BATCH_SIZE);

  AskUserQuestion({
    questions: [{
      question: `请选择要应用的改进建议 (第${Math.floor(i/BATCH_SIZE)+1}轮)`,
      header: "改进选择",
      multiSelect: true,
      options: batch.map(ep => ({
        label: `${ep.id}: ${ep.title}`,
        description: `影响: ${ep.affected_roles.join(', ')} | ${ep.enhancement}`
      }))
    }]
  })

  // Store selections before next round
}

// User can also skip: provide "跳过" option
```

#### Step 2: Clarification Questions

```javascript
// Generate questions based on 9-category taxonomy scan
// Categories: User Intent, Requirements, Architecture, UX, Feasibility, Risk, Process, Decisions, Terminology

const clarifications = [...]; // from analysis
const BATCH_SIZE = 4;

for (let i = 0; i < clarifications.length; i += BATCH_SIZE) {
  const batch = clarifications.slice(i, i + BATCH_SIZE);
  const currentRound = Math.floor(i / BATCH_SIZE) + 1;
  const totalRounds = Math.ceil(clarifications.length / BATCH_SIZE);

  AskUserQuestion({
    questions: batch.map(q => ({
      question: q.question,
      header: q.category.substring(0, 12),
      multiSelect: false,
      options: q.options.map(opt => ({
        label: opt.label,
        description: opt.description
      }))
    }))
  })

  // Store answers before next round
}
```

### Question Guidelines

**Target**: 开发者（理解技术但需要从用户需求出发）

**Question Structure**: `[跨角色分析发现] + [需要澄清的决策点]`
**Option Structure**: `标签：[具体方案] + 说明：[业务影响] + [技术权衡]`

**9-Category Taxonomy**:

| Category | Focus | Example Question Pattern |
|----------|-------|--------------------------|
| User Intent | 用户目标 | "MVP阶段核心目标？" + 验证/壁垒/完整性 |
| Requirements | 需求细化 | "功能优先级如何排序？" + 核心/增强/可选 |
| Architecture | 架构决策 | "技术栈选择考量？" + 熟悉度/先进性/成熟度 |
| UX | 用户体验 | "交互复杂度取舍？" + 简洁/丰富/渐进 |
| Feasibility | 可行性 | "资源约束下的范围？" + 最小/标准/完整 |
| Risk | 风险管理 | "风险容忍度？" + 保守/平衡/激进 |
| Process | 流程规范 | "迭代节奏？" + 快速/稳定/灵活 |
| Decisions | 决策确认 | "冲突解决方案？" + 方案A/方案B/折中 |
| Terminology | 术语统一 | "统一使用哪个术语？" + 术语A/术语B |

**Quality Rules**:

**MUST Include**:
- ✅ All questions in Chinese (用中文提问)
- ✅ 基于跨角色分析的具体发现
- ✅ 选项包含业务影响说明
- ✅ 解决实际的模糊点或冲突

**MUST Avoid**:
- ❌ 与角色分析无关的通用问题
- ❌ 重复已在 artifacts 阶段确认的内容
- ❌ 过于细节的实现级问题

#### Step 3: Build Update Plan

```javascript
update_plan = {
  "role1": {
    "enhancements": ["EP-001", "EP-003"],
    "clarifications": [
      {"question": "...", "answer": "...", "category": "..."}
    ]
  },
  "role2": {
    "enhancements": ["EP-002"],
    "clarifications": [...]
  }
}
```

### Phase 5: Parallel Document Update Agents

**Execute in parallel** (one agent per role):

```javascript
// Single message with multiple Task calls for parallelism
Task(conceptual-planning-agent, `
## Agent Mission
Apply enhancements and clarifications to ${role} analysis

## Input
- role: ${role}
- analysis_path: ${brainstorm_dir}/${role}/analysis.md
- enhancements: ${role_enhancements}
- clarifications: ${role_clarifications}
- original_user_intent: ${intent}

## Flow Control Steps
1. load_current_analysis → Read analysis file
2. add_clarifications_section → Insert Q&A section
3. apply_enhancements → Integrate into relevant sections
4. resolve_contradictions → Remove conflicts
5. enforce_terminology → Align terminology
6. validate_intent → Verify alignment with user intent
7. write_updated_file → Save changes

## Output
Updated ${role}/analysis.md
`)
```

**Agent Characteristics**:
- **Isolation**: Each agent updates exactly ONE role (parallel safe)
- **Dependencies**: Zero cross-agent dependencies
- **Validation**: All updates must align with original_user_intent

### Phase 6: Parallel Feature Spec Generation [feature_mode only]

**Skip condition**: If `feature_mode` is false (no feature list in guidance-spec, or role analyses were not organized by feature points), skip Phase 6 and Phase 6.5 entirely. Proceed directly to Phase 7.

**Purpose**: Generate one consolidated feature specification per feature by aggregating all role perspectives. Each agent reads the detailed per-feature sub-documents from all roles, applies the conflict map from Phase 3A, and produces a unified spec.

#### Step 1: Prepare Feature Spec Directory

```javascript
// Create feature-specs directory
const feature_specs_dir = `${brainstorm_dir}/feature-specs`;
// Ensure directory exists (create if not)
```

#### Step 2: Build Per-Feature Input Bundles

```javascript
// For each feature in feature_list (from guidance-spec Feature Decomposition)
const feature_bundles = feature_list.map(feature => {
  const fid = feature.id;     // e.g., "F-001"
  const slug = feature.slug;  // e.g., "real-time-sync"

  // Collect per-feature analysis files from all roles
  const role_analysis_files = participating_roles
    .map(role => `${brainstorm_dir}/${role}/analysis-${fid}-${slug}.md`)
    .filter(path => fileExists(path));  // Only existing files

  return {
    feature_id: fid,
    feature_slug: slug,
    feature_name: feature.description,
    feature_priority: feature.priority,
    conflict_map_entry: feature_conflict_map[fid],  // From Phase 3A
    role_analysis_files: role_analysis_files,
    contributing_roles: role_analysis_files.map(f => extractRoleName(f)),
    output_path: `${feature_specs_dir}/${fid}-${slug}.md`
  };
});
```

#### Step 3: Execute Parallel Feature Spec Agents

**Execute in parallel** (one agent per feature, mirrors Phase 5 pattern):

```javascript
// Single message with multiple Task calls for parallelism
// Each agent generates ONE feature spec document

// For each feature bundle:
Task(conceptual-planning-agent, `
## Agent Mission
Generate consolidated feature specification for ${feature.feature_id}: ${feature.feature_name}
by aggregating all role-specific analyses with conflict resolution.

## Input
- feature_id: ${feature.feature_id}
- feature_slug: ${feature.feature_slug}
- feature_name: ${feature.feature_name}
- feature_priority: ${feature.feature_priority}
- role_analysis_files: ${feature.role_analysis_files}
- conflict_map_entry: ${JSON.stringify(feature.conflict_map_entry)}
- output_path: ${feature.output_path}
- guidance_spec_feature_section: (Feature Decomposition row for this feature from guidance-specification.md)

## Flow Control Steps
1. load_role_analyses → Read all role-specific analysis files for this feature
   (Each file ~1500-2000 words, total ~6.5K words for 3-4 roles)
2. apply_conflict_map → Use conflict_map_entry to identify resolved/unresolved conflicts
3. four_layer_aggregation → Apply aggregation rules (see below)
4. generate_feature_spec → Write consolidated spec using template (see below)
5. write_output → Save to output_path

## Four-Layer Aggregation Rules

### Layer 1: Direct Reference
- Quote role analyses directly when consensus exists (from conflict_map.consensus)
- Format: "[Role] recommends: [direct quote]"
- Use for undisputed technical recommendations

### Layer 2: Structured Extraction
- Extract and organize key information from each role into unified structure
- Merge complementary perspectives (e.g., UX user flows + architect data flows)
- De-duplicate overlapping content across roles

### Layer 3: Conflict Distillation
- For each conflict in conflict_map_entry.conflicts, handle by confidence level:
  - **[RESOLVED]**: State the resolution directly as a design decision. Format: "**Decision**: [resolution]. **Rationale**: [from conflict.resolution]. **Trade-off**: [tradeoff]."
  - **[SUGGESTED]**: Adopt the suggested resolution but mark source. Format: "**Recommended**: [resolution] (suggested by Phase 3A cross-role analysis). **Rationale**: [reason]. **Alternative**: [strongest competing view]."
  - **[UNRESOLVED]**: Do NOT pick a side. Present all options neutrally for downstream decision. Format: "**[DECISION NEEDED]**: [topic]. **Options**: [role1: approach1] vs [role2: approach2]. **Evaluation**: [pros/cons of each]. **Impact if deferred**: [consequence of not deciding]."
- For each conflict regardless of confidence:
  - Present all role positions concisely (who said what)
  - Document trade-offs of the chosen or suggested approach
  - If `applies_when` is set, note the scope limitation
- **Unresolved conflict escalation**: If a feature has 2+ [UNRESOLVED] conflicts, add a prominent warning at the top of Section 2: "⚠ This feature has N unresolved design decisions. Plan stage must resolve before task generation."

### Layer 4: Cross-Feature Annotation
- For each cross_ref in conflict_map_entry.cross_refs:
  - Add explicit dependency notes with feature IDs
  - Document integration points with other features
  - Note shared constraints or patterns

## Feature Spec Template (7 Sections, target 1500-2500 words)

The output MUST follow this template:

---
# Feature Spec: ${feature.feature_id} - ${feature.feature_name}

**Priority**: ${feature.feature_priority}
**Contributing Roles**: [list of roles that analyzed this feature]
**Status**: Draft (from synthesis)

## 1. Requirements Summary
[Consolidated requirements from all role perspectives]
- Functional requirements (from product-manager, product-owner)
- User experience requirements (from ux-expert, ui-designer)
- Technical requirements (from system-architect, data-architect, api-designer)
- Domain requirements (from subject-matter-expert)

## 2. Design Decisions [CORE SECTION]
[Key architectural and design decisions with rationale]
For each decision:
- **Decision**: [What was decided]
- **Context**: [Why this decision was needed]
- **Options Considered**: [Alternatives from different roles]
- **Chosen Approach**: [Selected option with rationale]
- **Trade-offs**: [What we gain vs. what we sacrifice]
- **Source**: [Which role(s) drove this decision]

## 3. Interface Contract
[API endpoints, data models, component interfaces]
- External interfaces (API contracts from api-designer)
- Internal interfaces (component boundaries from system-architect)
- Data interfaces (schemas from data-architect)
- User interfaces (interaction patterns from ux-expert/ui-designer)

## 4. Constraints & Risks
[Technical constraints, business risks, mitigation strategies]
- Performance constraints (from system-architect)
- Data constraints (from data-architect)
- UX constraints (from ux-expert)
- Business/domain constraints (from subject-matter-expert)
- Risk mitigation strategies (from scrum-master)

## 5. Acceptance Criteria
[Testable criteria for feature completion]
- Functional acceptance (from product-owner user stories)
- Performance acceptance (from system-architect NFRs)
- UX acceptance (from ux-expert usability criteria)
- Data integrity acceptance (from data-architect)

## 6. Detailed Analysis References
[Pointers back to role-specific analysis documents]
- @../{role}/analysis-${feature.feature_id}-${feature.feature_slug}.md for each contributing role
- @../guidance-specification.md#feature-decomposition

## 7. Cross-Feature Dependencies
[Dependencies on and from other features]
- **Depends on**: [Feature IDs this feature requires]
- **Required by**: [Feature IDs that depend on this feature]
- **Shared patterns**: References to analysis-cross-cutting.md patterns
- **Integration points**: [Specific interfaces between features]
---

## Completion Criteria
- All 7 sections populated with aggregated content
- Section 2 (Design Decisions) is the most detailed section (40%+ of word count)
- All conflicts from conflict_map_entry addressed with resolutions
- Cross-feature dependencies explicitly documented
- Word count between 1500-2500
- No placeholder text (TODO/TBD) except [DECISION NEEDED] for genuinely unresolved items
`)
```

**Agent Characteristics (Phase 6)**:
- **Isolation**: Each agent processes exactly ONE feature (parallel safe)
- **Dependencies**: Requires Phase 3A feature_conflict_map and Phase 5 updated role analyses
- **Input budget**: ~6.5K words per agent (3-4 role sub-docs + conflict map entry)
- **Output budget**: 1500-2500 words per feature spec

### Phase 6.5: Feature Index Generation [feature_mode only]

**Skip condition**: Same as Phase 6 - skip if `feature_mode` is false.

**Purpose**: Collect all Phase 6 outputs and generate a structured `feature-index.json` for downstream consumption by action-planning-agent and code-developer.

#### Step 1: Collect Feature Spec Outputs

```javascript
// Read all generated feature spec files
const feature_spec_files = Glob(`${brainstorm_dir}/feature-specs/F-*-*.md`);

// Also collect cross-cutting spec paths
const cross_cutting_specs = participating_roles
  .map(role => `${brainstorm_dir}/${role}/analysis-cross-cutting.md`)
  .filter(path => fileExists(path));
```

#### Step 2: Generate feature-index.json

```javascript
const feature_index = {
  "version": "1.0",
  "generated_at": new Date().toISOString(),
  "session_id": session_id,
  "feature_mode": true,
  "features": feature_list.map(feature => {
    const fid = feature.id;
    const slug = feature.slug;
    const spec_path = `feature-specs/${fid}-${slug}.md`;
    const spec_exists = fileExists(`${brainstorm_dir}/${spec_path}`);

    // Extract contributing roles from the spec file header
    const contributing_roles = participating_roles.filter(role =>
      fileExists(`${brainstorm_dir}/${role}/analysis-${fid}-${slug}.md`)
    );

    // Extract cross-cutting references from conflict_map
    const cross_cutting_refs = feature_conflict_map[fid]
      ? feature_conflict_map[fid].cross_refs
      : [];

    return {
      "id": fid,
      "slug": slug,
      "name": feature.description,
      "priority": feature.priority,
      "spec_path": spec_exists ? spec_path : null,
      "contributing_roles": contributing_roles,
      "cross_cutting_refs": cross_cutting_refs
    };
  }),
  "cross_cutting_specs": cross_cutting_specs.map(path =>
    path.replace(brainstorm_dir + '/', '')  // Relative path
  )
};

Write(
  `${brainstorm_dir}/feature-index.json`,
  JSON.stringify(feature_index, null, 2)
);
```

#### feature-index.json Schema

```json
{
  "version": "1.0",
  "generated_at": "2026-02-11T10:00:00.000Z",
  "session_id": "WFS-xxx",
  "feature_mode": true,
  "features": [
    {
      "id": "F-001",
      "slug": "real-time-sync",
      "name": "Real-time collaborative synchronization",
      "priority": "High",
      "spec_path": "feature-specs/F-001-real-time-sync.md",
      "contributing_roles": ["system-architect", "ux-expert", "data-architect"],
      "cross_cutting_refs": ["F-003 offline-mode depends on sync strategy"]
    },
    {
      "id": "F-002",
      "slug": "user-permissions",
      "name": "Role-based user permissions and access control",
      "priority": "High",
      "spec_path": "feature-specs/F-002-user-permissions.md",
      "contributing_roles": ["system-architect", "product-manager", "subject-matter-expert"],
      "cross_cutting_refs": []
    }
  ],
  "cross_cutting_specs": [
    "system-architect/analysis-cross-cutting.md",
    "ux-expert/analysis-cross-cutting.md",
    "data-architect/analysis-cross-cutting.md"
  ]
}
```

**Consumers**: `action-planning-agent` reads feature-index.json to generate task JSONs with feature_spec references. `code-developer` loads individual feature specs (3-5K words) as implementation context.

### Phase 7: Finalization

#### Step 1: Update Context Package

```javascript
// Sync updated analyses to context-package.json
const context_pkg = Read(".workflow/active/WFS-{session}/.process/context-package.json")

// Update guidance-specification if exists
// Update synthesis-specification if exists
// Re-read all role analysis files
// Update metadata timestamps

// If feature_mode: add feature-index.json and feature-specs paths
if (feature_mode) {
  context_pkg.feature_index_path = `${brainstorm_dir}/feature-index.json`;
  context_pkg.feature_specs_dir = `${brainstorm_dir}/feature-specs/`;
  context_pkg.feature_mode = true;
}

Write(context_pkg_path, JSON.stringify(context_pkg))
```

#### Step 2: Update Session Metadata

```json
{
  "phases": {
    "BRAINSTORM": {
      "status": "clarification_completed",
      "clarification_completed": true,
      "completed_at": "timestamp",
      "participating_roles": [...],
      "clarification_results": {
        "enhancements_applied": ["EP-001", "EP-002"],
        "questions_asked": 3,
        "categories_clarified": ["Architecture", "UX"],
        "roles_updated": ["role1", "role2"]
      },
      "feature_spec_results": {
        "feature_mode": true,
        "features_generated": ["F-001", "F-002", "F-003"],
        "feature_index_path": ".brainstorming/feature-index.json",
        "feature_specs_dir": ".brainstorming/feature-specs/",
        "conflict_map_generated": true
      },
      "quality_metrics": {
        "user_intent_alignment": "validated",
        "ambiguity_resolution": "complete",
        "terminology_consistency": "enforced"
      }
    }
  }
}
```

**Note**: `feature_spec_results` is only present when `feature_mode` is true. When `feature_mode` is false, this key is omitted entirely.

#### Step 3: Completion Report

```markdown
## Clarification Complete

**Enhancements Applied**: EP-001, EP-002, EP-003
**Questions Answered**: 3/5
**Roles Updated**: role1, role2, role3

### Feature Specs (feature_mode only)
**Feature Specs Generated**: F-001, F-002, F-003
**Feature Index**: .brainstorming/feature-index.json
**Spec Directory**: .brainstorming/feature-specs/

### Next Steps
PROCEED: `/workflow:plan --session WFS-{session-id}`
```

---

## Output

**Location (role analyses)**: `.workflow/active/WFS-{session}/.brainstorming/[role]/analysis*.md`
**Location (feature specs)**: `.workflow/active/WFS-{session}/.brainstorming/feature-specs/F-{id}-{slug}.md` [feature_mode]
**Location (feature index)**: `.workflow/active/WFS-{session}/.brainstorming/feature-index.json` [feature_mode]

**Updated Directory Structure** (feature_mode):
```
.workflow/active/WFS-{session}/.brainstorming/
├── guidance-specification.md
├── feature-index.json                    # Phase 6.5 output
├── feature-specs/                        # Phase 6 output directory
│   ├── F-001-{slug}.md                   # Consolidated feature spec (1500-2500 words)
│   ├── F-002-{slug}.md
│   └── F-00N-{slug}.md
├── {role-1}/
│   ├── analysis.md                       # Role overview index (read by Phase 3A)
│   ├── analysis-cross-cutting.md
│   ├── analysis-F-001-{slug}.md          # Per-feature detail (read by Phase 6)
│   └── analysis-F-002-{slug}.md
└── {role-N}/
    └── ...
```

**Updated Role Analysis Structure**:
```markdown
## Clarifications
### Session {date}
- **Q**: {question} (Category: {category})
  **A**: {answer}

## {Existing Sections}
{Refined content based on clarifications}
```

**Changes**:
- User intent validated/corrected
- Requirements more specific/measurable
- Architecture with rationale
- Ambiguities resolved, placeholders removed
- Consistent terminology
- Feature specs generated with cross-role conflict resolution [feature_mode]
- Feature index provides structured access for downstream consumers [feature_mode]

---

## Quality Checklist

**Content**:
- All role analyses loaded/analyzed
- Cross-role analysis (consensus, conflicts, gaps)
- 9-category ambiguity scan
- Questions prioritized

**Analysis**:
- User intent validated
- Cross-role synthesis complete
- Ambiguities resolved
- Terminology consistent

**Documents**:
- Clarifications section formatted
- Sections reflect answers
- No placeholders (TODO/TBD)
- Valid Markdown

**Feature Specs (feature_mode only)**:
- Phase 3A reads only analysis.md index files (not sub-documents), input token <= 5K words
- feature_conflict_map generated with consensus/conflicts/cross_refs per feature
- Phase 6 parallel agents defined: one per feature, input token <= 7K words each
- Feature spec template has 7 sections, Section 2 (Design Decisions) is core
- Four-layer aggregation rules applied (direct reference/structured extraction/conflict distillation/cross-feature annotation)
- Each feature spec is 1500-2500 words
- feature-index.json generated with features[] + cross_cutting_specs[]
- feature-specs/ directory created with F-{id}-{slug}.md files
