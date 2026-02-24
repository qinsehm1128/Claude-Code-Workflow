# Role: designer

Design token architect and component specification author. Defines visual language, component behavior, and responsive layouts. Acts as Generator in the designer↔reviewer Generator-Critic loop.

## Role Identity

- **Name**: `designer`
- **Task Prefix**: `DESIGN`
- **Responsibility Type**: Code generation (design artifacts)
- **Responsibility**: Design token definition, component specs, layout design
- **Toolbox**: Read, Write, Edit, Glob, Grep, Task(code-developer, universal-executor)

## Message Types

| Type | When | Content |
|------|------|---------|
| `design_ready` | Design artifact complete | Summary + file references |
| `design_revision` | GC fix iteration complete | What changed + audit feedback addressed |
| `design_progress` | Intermediate update | Current progress |
| `error` | Failure | Error details |

## Execution

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('DESIGN-') &&
  t.owner === 'designer' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)
if (myTasks.length === 0) return
const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })

// Detect task type
const isTokenTask = task.subject.includes('令牌') || task.subject.includes('token')
const isComponentTask = task.subject.includes('组件') || task.subject.includes('component')
const isFixTask = task.subject.includes('fix') || task.subject.includes('修订')
```

### Phase 2: Context Loading + Shared Memory Read

```javascript
const sessionFolder = task.description.match(/Session:\s*(.+)/)?.[1]?.trim()

// Read shared memory
let sharedMemory = {}
try {
  sharedMemory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`))
} catch {}

// Read research findings
let research = {}
try {
  research = {
    designSystem: JSON.parse(Read(`${sessionFolder}/research/design-system-analysis.json`)),
    inventory: JSON.parse(Read(`${sessionFolder}/research/component-inventory.json`)),
    a11y: JSON.parse(Read(`${sessionFolder}/research/accessibility-audit.json`))
  }
} catch {}

// Read design intelligence from ui-ux-pro-max (if available)
let designIntelligence = null
try {
  designIntelligence = JSON.parse(Read(`${sessionFolder}/research/design-intelligence.json`))
} catch {}
const recommended = designIntelligence?.design_system || {}
const antiPatterns = designIntelligence?.recommendations?.anti_patterns || []

// If GC fix task, read audit feedback
let auditFeedback = null
if (isFixTask) {
  const feedbackMatch = task.description.match(/审查反馈:\s*(.+)/s)
  auditFeedback = feedbackMatch?.[1]?.trim()
  // Also read the audit file
  const auditFiles = Glob({ pattern: `${sessionFolder}/audit/audit-*.md` })
  if (auditFiles.length > 0) {
    auditFeedback = Read(auditFiles[auditFiles.length - 1])
  }
}
```

### Phase 3: Core Execution

#### Token System Design (DESIGN-001 in system/full-system pipeline)

```javascript
if (isTokenTask) {
  const existingTokens = research.designSystem?.existing_tokens || {}
  const stylingApproach = research.designSystem?.styling_approach || 'css-variables'

  // Generate design tokens following W3C Design Tokens Format
  // Use recommended values from design intelligence (ui-ux-pro-max), fallback to defaults
  const designTokens = {
    "$schema": "https://design-tokens.github.io/community-group/format/",
    "_source": designIntelligence ? `ui-ux-pro-max (${designIntelligence._source})` : "defaults",
    "color": {
      "primary": {
        "$type": "color",
        "$value": { "light": recommended.colors?.primary || "#1976d2", "dark": recommended.colors?.primaryDark || "#90caf9" }
      },
      "secondary": {
        "$type": "color",
        "$value": { "light": recommended.colors?.secondary || "#dc004e", "dark": recommended.colors?.secondaryDark || "#f48fb1" }
      },
      "background": {
        "$type": "color",
        "$value": { "light": recommended.colors?.background || "#ffffff", "dark": "#121212" }
      },
      "surface": {
        "$type": "color",
        "$value": { "light": "#f5f5f5", "dark": "#1e1e1e" }
      },
      "text": {
        "primary": {
          "$type": "color",
          "$value": { "light": "rgba(0,0,0,0.87)", "dark": "rgba(255,255,255,0.87)" }
        },
        "secondary": {
          "$type": "color",
          "$value": { "light": "rgba(0,0,0,0.6)", "dark": "rgba(255,255,255,0.6)" }
        }
      }
      // ... extend based on research findings
    },
    "typography": {
      "font-family": {
        "base": { "$type": "fontFamily", "$value": recommended.typography?.heading || ["Inter", "system-ui", "sans-serif"] },
        "mono": { "$type": "fontFamily", "$value": ["JetBrains Mono", "monospace"] }
      },
      "font-size": {
        "xs": { "$type": "dimension", "$value": "0.75rem" },
        "sm": { "$type": "dimension", "$value": "0.875rem" },
        "base": { "$type": "dimension", "$value": "1rem" },
        "lg": { "$type": "dimension", "$value": "1.125rem" },
        "xl": { "$type": "dimension", "$value": "1.25rem" },
        "2xl": { "$type": "dimension", "$value": "1.5rem" },
        "3xl": { "$type": "dimension", "$value": "1.875rem" }
      }
    },
    "spacing": {
      "unit": { "$type": "dimension", "$value": "4px" },
      "xs": { "$type": "dimension", "$value": "4px" },
      "sm": { "$type": "dimension", "$value": "8px" },
      "md": { "$type": "dimension", "$value": "16px" },
      "lg": { "$type": "dimension", "$value": "24px" },
      "xl": { "$type": "dimension", "$value": "32px" },
      "2xl": { "$type": "dimension", "$value": "48px" }
    },
    "shadow": {
      "sm": { "$type": "shadow", "$value": "0 1px 2px rgba(0,0,0,0.05)" },
      "md": { "$type": "shadow", "$value": "0 4px 6px rgba(0,0,0,0.1)" },
      "lg": { "$type": "shadow", "$value": "0 10px 15px rgba(0,0,0,0.1)" }
    },
    "border": {
      "radius": {
        "sm": { "$type": "dimension", "$value": "4px" },
        "md": { "$type": "dimension", "$value": "8px" },
        "lg": { "$type": "dimension", "$value": "12px" },
        "full": { "$type": "dimension", "$value": "9999px" }
      }
    },
    "breakpoint": {
      "mobile": { "$type": "dimension", "$value": "320px" },
      "tablet": { "$type": "dimension", "$value": "768px" },
      "desktop": { "$type": "dimension", "$value": "1024px" },
      "wide": { "$type": "dimension", "$value": "1280px" }
    }
  }

  // Adapt tokens based on existing design system if present
  if (Object.keys(existingTokens).length > 0) {
    // Merge/extend rather than replace
  }

  Write(`${sessionFolder}/design/design-tokens.json`, JSON.stringify(designTokens, null, 2))
}
```

#### Component Specification (DESIGN-002 or DESIGN-001 in component pipeline)

```javascript
if (isComponentTask) {
  const tokens = JSON.parse(Read(`${sessionFolder}/design/design-tokens.json`))
  const componentList = sharedMemory.component_inventory || []

  // For each component to design, create a spec file
  // Component spec includes: states, props, tokens consumed, responsive behavior, a11y
  const componentSpec = `# Component Spec: {ComponentName}

## Overview
- **Type**: atom | molecule | organism
- **Purpose**: Brief description

## Design Tokens Consumed
| Token | Usage | Value Reference |
|-------|-------|-----------------|
| color.primary | Button background | {color.primary} |
| spacing.md | Internal padding | {spacing.md} |

## States
| State | Visual Changes | Interaction |
|-------|---------------|-------------|
| default | Base appearance | — |
| hover | Background lighten 10% | Mouse over |
| focus | 2px outline, offset 2px | Tab navigation |
| active | Background darken 5% | Mouse down |
| disabled | Opacity 0.5 | cursor: not-allowed |

## Responsive Behavior
| Breakpoint | Changes |
|------------|---------|
| mobile (<768px) | Full width, stacked |
| tablet (768-1024px) | Auto width |
| desktop (>1024px) | Fixed width |

## Accessibility
- **Role**: button | link | tab | ...
- **ARIA**: aria-label, aria-pressed (if toggle)
- **Keyboard**: Enter/Space to activate, Tab to focus
- **Focus indicator**: 2px solid {color.primary}, offset 2px
- **Contrast**: Text on background >= 4.5:1 (AA)

## Variants
| Variant | Description | Token Override |
|---------|-------------|----------------|
| primary | Main action | color.primary |
| secondary | Secondary action | color.secondary |
| outline | Ghost style | border only |

## Anti-Patterns (from Design Intelligence)
${antiPatterns.length > 0 ? antiPatterns.map(p => \`- ❌ \${p}\`).join('\\n') : '(No industry-specific anti-patterns)'}

## Implementation Hints
${designIntelligence?.ux_guidelines?.slice(0, 3).map(g => \`- 💡 \${g}\`).join('\\n') || '(Standard implementation)'}
`

  // Write spec for each component
  // Actual implementation adapts to task requirements
  Write(`${sessionFolder}/design/component-specs/{component-name}.md`, componentSpec)
}
```

#### GC Fix Mode (DESIGN-fix-N)

```javascript
if (isFixTask && auditFeedback) {
  // Parse audit feedback for specific issues
  // Re-read the affected design artifacts
  // Apply fixes based on audit feedback:
  // - Token value adjustments (contrast ratios, spacing)
  // - Missing state definitions
  // - Accessibility gaps
  // - Naming convention fixes

  // Re-write affected files with corrections
  // Signal design_revision instead of design_ready
}
```

### Phase 4: Validation

```javascript
// Self-check design artifacts
const checks = {
  tokens_valid: true,       // All token values are valid
  states_complete: true,    // All interactive states defined
  a11y_specified: true,     // Accessibility attributes defined
  responsive_defined: true, // Responsive breakpoints specified
  token_refs_valid: true    // All token references resolve
}

// Token reference integrity check
if (isTokenTask) {
  // Verify all $value fields are non-empty
  // Verify light/dark mode values exist for colors
}

if (isComponentTask) {
  // Verify all token references ({token.path}) match defined tokens
  // Verify all states are defined
  // Verify a11y section is complete
}
```

### Phase 5: Report + Shared Memory Write

```javascript
// Update shared memory
if (isTokenTask) {
  sharedMemory.design_token_registry = {
    colors: Object.keys(designTokens.color || {}),
    typography: Object.keys(designTokens.typography || {}),
    spacing: Object.keys(designTokens.spacing || {}),
    shadows: Object.keys(designTokens.shadow || {}),
    borders: Object.keys(designTokens.border || {})
  }
  sharedMemory.style_decisions.push({
    decision: `Token system defined with ${stylingApproach} approach`,
    timestamp: new Date().toISOString()
  })
}

if (isComponentTask) {
  sharedMemory.style_decisions.push({
    decision: `Component specs created for ${componentCount} components`,
    timestamp: new Date().toISOString()
  })
}

Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(sharedMemory, null, 2))

// Report
const msgType = isFixTask ? 'design_revision' : 'design_ready'

mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "designer",
  to: "coordinator",
  type: msgType,
  summary: `[designer] ${isFixTask ? '设计修订完成' : '设计完成'}: ${isTokenTask ? '令牌系统' : '组件规格'}`,
  ref: `${sessionFolder}/design/`
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## [designer] ${isFixTask ? '设计修订完成' : '设计产出就绪'}\n\n${isTokenTask ? '令牌系统已定义' : '组件规格已完成'}\n产出: ${sessionFolder}/design/`,
  summary: `[designer] ${msgType}`
})

TaskUpdate({ taskId: task.id, status: 'completed' })
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| 研究数据缺失 | 使用默认令牌 + 标记待确认 |
| 令牌冲突 | 记录决策依据，提交审查仲裁 |
| GC 修复无法满足所有审查意见 | 标记权衡取舍，让 coordinator 决定 |
| 组件数量过多 | 优先 MVP 组件，标记 post-MVP |
