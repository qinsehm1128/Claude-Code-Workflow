# Workflow Examples

This page provides practical examples of CCW workflow artifacts with sensitive information redacted.

<div v-pre>

## Example 1: Lite Plan Output

### plan.json
This is an output from `workflow-lite-plan` command.

```json
{
  "title": "Add user authentication with OAuth2",
  "description": "Implement OAuth2 authentication with GitHub provider",
  "entryPoint": "/api/auth/oauth2/callback",
  "outputPath": "src/auth/oauth2/callback.ts",
  "tasks": [
    {
      "id": "TASK-001",
      "title": "Define OAuth2 types",
      "description": "Create TypeScript interfaces",
      "type": "new file",
      "file_path": "src/types/oauth2.ts",
      "priority": 1,
      "dependencies": []
    },
    {
      "id": "TASK-002",
      "title": "Implement GitHub provider",
      "description": "Implement GitHubProvider class",
      "type": "new file",
      "file_path": "src/providers/github.ts",
      "priority": 2,
      "dependencies": ["TASK-001"]
    },
    {
      "id": "TASK-003",
      "title": "Create auth routes",
      "description": "Set up Express routes",
      "type": "new file",
      "file_path": "src/routes/auth.ts",
      "priority": 3,
      "dependencies": ["TASK-001", "TASK-002"]
    }
  ],
  "generatedAt": "2026-02-28T10:30:00",
  "version": "1.0.0"
}
```

### Execution Steps

```javascript
// Execute the plan
Skill(skill="workflow-execute", args="--session WFS-001")
```

---

## Example 2: Team Session Output

### team-session.json
This is an output from `team-coordinate` with a team of specialists.

```json
{
  "session_id": "TLS-frontend-team-2026-02-27",
  "team_name": "creative-spark",
  "mode": "full-lifecycle-fe",
  "scope": "Build React dashboard with real-time visualization",
  "requirements": {
    "location": "~/projects/dashboard",
    "features": [
      "Responsive grid layout",
      "Interactive charts with D3.js",
      "Real-time data via WebSocket",
      "Dark mode support",
      "Accessibility compliance"
    ]
  },
  "status": "completed",
  "created_at": "2026-02-27",
  "completed_at": "2026-02-28",
  "tasks_total": 12,
  "tasks_completed": 12,
  "members": [
    {
      "name": "architect",
      "type": "team-worker",
      "role_spec": ".claude/skills/team-lifecycle/role-specs/architect.md"
    },
    {
      "name": "frontend-dev",
      "type": "team-worker",
      "role_spec": ".claude/skills/team-lifecycle/role-specs/frontend-dev.md"
    },
    {
      "name": "backend-dev",
      "type": "team-worker",
      "role_spec": ".claude/skills/team-lifecycle/role-specs/backend-dev.md"
    },
    {
      "name": "qa-engineer",
      "type": "team-worker",
      "role_spec": ".claude/skills/team-lifecycle/role-specs/qa.md"
    }
  ],
  "deliverables": [
    {
      "type": "code",
      "path": "~/projects/dashboard/src/",
      "description": "Complete dashboard implementation"
    },
    {
      "type": "documentation",
      "path": "~/projects/dashboard/README.md",
      "description": "Setup and usage guide"
    }
  ]
}
```

---

## Example 3: Memory Capture Output

### memory.json
This is an output from `memory:capture` command.

```json
{
  "id": "CMEM-20260228-001",
  "type": "core_memory",
  "source_type": "workflow",
  "source_id": "WFS-dashboard-001",
  "content": "Dashboard Implementation Insights",
  "key_learnings": [
    {
      "topic": "WebSocket Integration",
      "challenge": "Connection drops during high traffic",
      "solution": "Implemented exponential backoff with reconnection",
      "benefit": "99.9% uptime achieved"
    },
    {
      "topic": "D3.js Performance",
      "challenge": "5000+ data points caused lag",
      "solution": "Switched to SVG rendering with virtual scrolling",
      "benefit": "60% performance improvement"
    }
  ],
  "code_pattern": "useWebSocket hook for real-time data"
}
```

---

## Example 4: CLI Analysis Output

### analysis-result.json
This is an output from `ccw cli` with `--tool gemini`.

```json
{
  "summary": "Code quality analysis for authentication module",
  "tool": "gemini",
  "timestamp": "2026-02-27T14:30:00",
  "findings": [
    {
      "severity": "high",
      "category": "security",
      "title": "Missing CSRF token validation",
      "file": "src/routes/auth.ts",
      "line": 45,
      "description": "OAuth2 callback missing CSRF token validation",
      "recommendation": "Add CSRF token validation in validateCSRFToken method"
    },
    {
      "severity": "medium",
      "category": "performance",
      "title": "Inefficient user profile query",
      "file": "src/models/user.ts",
      "line": 78,
      "description": "Query fetches all fields including unused ones",
      "recommendation": "Select only necessary fields"
    },
    {
      "severity": "low",
      "category": "style",
      "title": "Inconsistent error handling",
      "file": "src/providers/github.ts",
      "line": 89,
      "description": "Error messages vary in format",
      "recommendation": "Standardize error codes"
    }
  ],
  "recommendations": [
    "Immediate: Add CSRF token validation",
    "Short-term: Optimize database queries",
    "Optional: Standardize error handling"
  ]
}
```

---

## Example 5: Issue Solution Output

### issue-solution.json
This is an output from `issue:execute` command.

```json
{
  "issue_id": "ISSUE-001",
  "title": "Memory leak in WebSocket connection handler",
  "status": "resolved",
  "priority": "high",
  "created_at": "2026-02-26",
  "resolved_at": "2026-02-26",
  "resolution": "Fixed by adding proper cleanup in onClose handler",
  "affected_files": ["src/services/websocket.ts"],
  "root_cause": "Event listeners not removed when connections close",
  "fix_steps": [
    {
      "step": 1,
      "description": "Add cleanup logic to onClose handler",
      "changes": [
        "Add connection.removeListener call",
        "Add connection.on close handler",
        "Add cleanup interval in constructor"
      ]
    },
    {
      "step": 2,
      "description": "Add unit test for cleanup logic",
      "changes": ["Add test case for event listener removal"]
    },
    {
      "step": 3,
      "description": "Update documentation",
      "changes": ["Add note about proper connection cleanup"]
    }
  ],
  "verifications": [
    {
      "type": "unit_test",
      "status": "passed",
      "details": "All listeners properly removed on close"
    },
    {
      "type": "integration_test",
      "status": "passed",
      "details": "No memory leaks after 1000 connections"
    }
  ]
}
```

---

## Example 6: Code Review Output

### review-report.md
This is an output from `review-code` skill.

```text
## Code Review Report

### Summary
- Review Type: 6-Dimensional code review
- Scope: All files changed in PR #42
- Timestamp: 2026-02-28

### 1. Correctness
| Aspect | Score | Issues |
|--------|-------|--------|
| Logic correctness | 9/10 | No issues |
| Edge case handling | 8/10 | 1 issue |

### 2. Security
| Aspect | Score | Issues |
|--------|-------|--------|
| Input validation | 10/10 | No issues |
| XSS prevention | 10/10 | No issues |
| CSRF protection | 10/10 | No issues |

### 3. Performance
| Aspect | Score | Issues |
|--------|-------|--------|
| Bundle size | 7/10 | 1 issue |
| Database queries | 6/10 | 2 issues |

### Overall Score: 8.4/10

### Recommendations
1. Performance: Review bundle size
2. Performance: Optimize database queries
3. Maintainability: Add JSDoc comments
```

---

## Example 7: Spec Document Output

### spec-section.md
This is an output from `spec-generator` skill.

```text
## API: User Authentication

### Endpoint: POST /api/auth/login
- Description: Authenticate user with email and password
- Request: { "email": "string", "password": "string" }
- Response: { "success": true, "token": "jwt_token", "user": {...} }

### Endpoint: POST /api/auth/oauth2/callback
- Description: Handle OAuth2 provider callback
- Request: { "code": "string", "provider": "string", "state": "string" }
- Response: { "success": true, "token": "jwt_token", "user": {...} }

### Endpoint: POST /api/auth/logout
- Description: Logout user and invalidate token
- Headers: Authorization: Bearer token
- Response: { "success": true, "message": "Logged out" }

### Error Codes
| Code | Description |
|------|-------------|
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 429 | Rate Limited |
| 500 | Server Error |
```

---

## Example 8: Skill Definition Output

### skill-definition.yaml
This is a skill file for creating new custom skills.

```yaml
name: api-documentation-generator
description: Generate API documentation from code annotations
version: 1.0.0
triggers:
  - generate api docs
  - create documentation
  - document api

phases:
  - name: Analyze Code
    description: Scan codebase for API endpoints
    tools:
      - glob
      - read_file
      - grep

  - name: Generate Documentation
    description: Create markdown files
    tools:
      - write_file

  - name: Review Output
    description: Validate documentation
    tools:
      - read_file
      - edit_file

output:
  format: markdown
  template: docs/api-template.md

examples:
  - input: "Generate docs for /api/auth endpoints"
    output: "Created auth-api.md with 5 endpoints"
```

</div>

---

## Using These Examples

To use these examples in your own projects:

1. **Copy the structure** that matches your needs
2. **Modify fields** to fit your requirements
3. **Remove sensitive information**
4. **Test the output** with `Skill(skill="workflow-execute")`

::: tip
These examples are generated by CCW workflow tools. Run relevant commands to generate similar outputs for your projects.
:::
