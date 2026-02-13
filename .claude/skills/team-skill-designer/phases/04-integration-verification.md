# Phase 4: Integration Verification

Verify the generated skill package is internally consistent.

## Objective

- Verify SKILL.md role router references match actual role files
- Verify task prefixes are unique across all roles
- Verify message types are consistent
- Verify coordinator spawn template uses correct skill invocation
- Generate integration-report.json

## Input

- Dependency: `{workDir}/preview/` directory (Phase 3)
- Reference: `team-config.json` (Phase 1)

## Execution Steps

### Step 1: Load Generated Files

```javascript
const config = JSON.parse(Read(`${workDir}/team-config.json`))
const previewDir = `${workDir}/preview`
const skillMd = Read(`${previewDir}/SKILL.md`)

const roleFiles = {}
for (const role of config.roles) {
  try {
    roleFiles[role.name] = Read(`${previewDir}/roles/${role.name}.md`)
  } catch {
    roleFiles[role.name] = null
  }
}
```

### Step 2: Role Router Consistency

```javascript
const routerChecks = config.roles.map(role => {
  const hasRouterEntry = skillMd.includes(`"${role.name}"`)
  const hasRoleFile = roleFiles[role.name] !== null
  const hasRoleLink = skillMd.includes(`roles/${role.name}.md`)

  return {
    role: role.name,
    router_entry: hasRouterEntry,
    file_exists: hasRoleFile,
    link_valid: hasRoleLink,
    status: (hasRouterEntry && hasRoleFile && hasRoleLink) ? 'PASS' : 'FAIL'
  }
})
```

### Step 3: Task Prefix Uniqueness

```javascript
const prefixes = config.worker_roles.map(r => r.task_prefix)
const uniquePrefixes = [...new Set(prefixes)]
const prefixCheck = {
  prefixes: prefixes,
  unique: uniquePrefixes,
  duplicates: prefixes.filter((p, i) => prefixes.indexOf(p) !== i),
  status: prefixes.length === uniquePrefixes.length ? 'PASS' : 'FAIL'
}
```

### Step 4: Message Type Consistency

```javascript
const msgChecks = config.worker_roles.map(role => {
  const roleFile = roleFiles[role.name] || ''
  const typesInConfig = role.message_types.map(mt => mt.type)
  const typesInFile = typesInConfig.filter(t => roleFile.includes(t))

  return {
    role: role.name,
    configured: typesInConfig,
    present_in_file: typesInFile,
    missing: typesInConfig.filter(t => !typesInFile.includes(t)),
    status: typesInFile.length === typesInConfig.length ? 'PASS' : 'WARN'
  }
})
```

### Step 5: Spawn Template Verification

```javascript
const spawnChecks = config.worker_roles.map(role => {
  const hasSpawn = skillMd.includes(`name: "${role.name}"`)
  const hasSkillCall = skillMd.includes(`Skill(skill="${config.skill_name}", args="--role=${role.name}")`)
  const hasTaskPrefix = skillMd.includes(`${role.task_prefix}-*`)

  return {
    role: role.name,
    spawn_present: hasSpawn,
    skill_call_correct: hasSkillCall,
    prefix_in_prompt: hasTaskPrefix,
    status: (hasSpawn && hasSkillCall && hasTaskPrefix) ? 'PASS' : 'FAIL'
  }
})
```

### Step 6: Role File Pattern Compliance

```javascript
const patternChecks = Object.entries(roleFiles).map(([name, content]) => {
  if (!content) return { role: name, status: 'MISSING' }

  const checks = {
    has_role_identity: /## Role Identity/.test(content),
    has_5_phases: /Phase 1/.test(content) && /Phase 5/.test(content),
    has_task_lifecycle: /TaskList/.test(content) && /TaskGet/.test(content) && /TaskUpdate/.test(content),
    has_message_bus: /team_msg/.test(content),
    has_send_message: /SendMessage/.test(content),
    has_error_handling: /## Error Handling/.test(content)
  }

  const passCount = Object.values(checks).filter(Boolean).length
  return {
    role: name,
    checks: checks,
    pass_count: passCount,
    total: Object.keys(checks).length,
    status: passCount === Object.keys(checks).length ? 'PASS' : 'PARTIAL'
  }
})
```

### Step 7: Generate Report

```javascript
const overallStatus = [
  ...routerChecks.map(c => c.status),
  prefixCheck.status,
  ...spawnChecks.map(c => c.status),
  ...patternChecks.map(c => c.status)
].every(s => s === 'PASS') ? 'PASS' : 'NEEDS_ATTENTION'

const report = {
  team_name: config.team_name,
  skill_name: config.skill_name,
  checks: {
    router_consistency: routerChecks,
    prefix_uniqueness: prefixCheck,
    message_types: msgChecks,
    spawn_template: spawnChecks,
    pattern_compliance: patternChecks
  },
  overall: overallStatus,
  file_count: {
    skill_md: 1,
    role_files: Object.keys(roleFiles).length,
    total: 1 + Object.keys(roleFiles).length + 1  // SKILL.md + roles + config
  }
}

Write(`${workDir}/integration-report.json`, JSON.stringify(report, null, 2))
```

## Output

- **File**: `integration-report.json`
- **Format**: JSON
- **Location**: `{workDir}/integration-report.json`

## Quality Checklist

- [ ] Every role in config has a router entry in SKILL.md
- [ ] Every role has a file in roles/
- [ ] Task prefixes are unique
- [ ] Spawn template uses correct `Skill(skill="...", args="--role=...")`
- [ ] All role files have 5-phase structure
- [ ] All role files have message bus integration

## Next Phase

-> [Phase 5: Validation](05-validation.md)
