# Role Analysis Reviewer Agent

Validates role analysis outputs against role-specific templates and quality standards.

## Objective

Ensure role analysis documents meet SPEC.md-level precision and completeness.

## Input

- Role name (e.g., system-architect, product-manager)
- Role analysis document path (e.g., `.brainstorming/system-architect/analysis.md`)
- Role template path (e.g., `templates/role-templates/system-architect-template.md`)

## Validation Rules

### For system-architect

**MUST have (blocking)**:
- [ ] Data Model section with at least 1 entity definition
- [ ] Entity table with fields: name, type, constraint, description
- [ ] State Machine section with at least 1 lifecycle diagram
- [ ] State transition table with: from, event, to, side effects
- [ ] Error Handling Strategy section
- [ ] Observability Requirements section with at least 3 metrics

**SHOULD have (warning)**:
- [ ] Data Model with 3-5 entities
- [ ] Relationships defined between entities
- [ ] Indexes specified for entities
- [ ] State Machine with error recovery paths
- [ ] Circuit Breaker configuration
- [ ] Health check endpoints defined

**Quality checks**:
- [ ] All constraints use RFC 2119 keywords
- [ ] State diagram is valid ASCII art
- [ ] Metrics have type (Counter/Gauge/Histogram) specified
- [ ] Error handling has timeout values
- [ ] No generic placeholders like "[TODO]" or "[TBD]"

## Output

JSON validation report:

```json
{
  "role": "system-architect",
  "document": ".brainstorming/system-architect/analysis.md",
  "validation": {
    "must_pass": true/false,
    "should_pass": true/false,
    "checks": {
      "data_model_present": true,
      "entity_count": 3,
      "state_machine_present": true,
      "error_handling_present": true,
      "observability_present": true,
      "metrics_count": 5,
      "rfc_keywords_count": 12
    },
    "issues": [
      {
        "severity": "error",
        "section": "Data Model",
        "message": "Entity 'User' missing 'Relationships' subsection"
      },
      {
        "severity": "warning",
        "section": "Observability",
        "message": "Only 3 metrics defined, recommend at least 5"
      }
    ]
  },
  "score": 8.5,
  "recommendation": "Pass with minor improvements"
}
```

## Execution

```javascript
Bash({
  command: `ccw cli -p "Validate role analysis document against template.

ROLE: ${roleName}
DOCUMENT: ${analysisDoc}
TEMPLATE: ${roleTemplate}

VALIDATION RULES:
${validationRules}

OUTPUT: JSON validation report with must_pass, should_pass, checks, issues, score, recommendation
" --tool gemini --mode analysis`,
  run_in_background: true
});
```
