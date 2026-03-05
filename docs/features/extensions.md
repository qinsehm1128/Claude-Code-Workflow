# Extensions

## One-Liner

**Extensions management provides unified interfaces for configuring and managing skills, commands, rules, MCP servers, and hooks across project and user scopes.**

---

## Pain Points Solved

| Pain Point | Current State | Extensions Solution |
|------------|---------------|---------------------|
| **Scattered management** | Edit config files manually | Dedicated pages for each extension type |
| **Scope confusion** | Global vs project unclear | Location tabs (project/user/hub) |
| **No templates** | Create from scratch | Quick templates and wizards |
| **Hard to discover** | Unknown extensions | Skill Hub, recommended MCPs |
| **No cross-CLI sync** | Separate configs | Cross-CLI sync panel |

---

## Skills Manager

### Page Overview

**Location**: `ccw/frontend/src/pages/SkillsManagerPage.tsx`

**Purpose**: Browse, enable/disable, and manage skill packages with CLI mode toggle.

**Access**: Navigation → Skills

### Features

| Feature | Description |
|---------|-------------|
| **Location Tabs** | Project, User, Hub tabs |
| **CLI Mode Toggle** | Switch between Claude and Codex CLI modes |
| **Stats Cards** | Total, Enabled, Disabled, Categories count |
| **Filters** | Search, category, source, enabled status |
| **Skill Grid** | Visual card grid with toggle, click details, delete |
| **Skill Hub** | Remote/Local/Installed skills with install/uninstall |
| **Detail Panel** | Slide-over panel with full skill details |
| **Create Dialog** | Install new skills from source |

### Skill Sources

| Source | Description |
|--------|-------------|
| **Builtin** | Built-in skills provided by CCW |
| **Custom** | User-created custom skills |
| **Community** | Community-contributed skills |

---

## Commands Manager

### Page Overview

**Location**: `ccw/frontend/src/pages/CommandsManagerPage.tsx`

**Purpose**: Manage slash commands with group-based organization.

**Access**: Navigation → Commands

### Features

| Feature | Description |
|---------|-------------|
| **Location Tabs** | Project, User tabs |
| **Stats Cards** | Total, Enabled, Disabled counts |
| **Search** | Filter by command name |
| **Group Accordion** | Commands organized by group (cli, workflow, etc.) |
| **Toggle Commands** | Enable/disable individual commands |
| **Toggle Groups** | Enable/disable all commands in a group |
| **Expand/Collapse All** | Bulk expand or collapse all groups |
| **Show Disabled** | Toggle visibility of disabled commands |
| **Create Dialog** | Create new custom commands |

### Command Groups

| Group | Description |
|-------|-------------|
| **cli** | CLI-related commands |
| **workflow** | Workflow and session commands |
| **terminal** | Terminal management commands |

---

## Rules Manager

### Page Overview

**Location**: `ccw/frontend/src/pages/RulesManagerPage.tsx`

**Purpose**: Manage rules with full CRUD operations and category filtering.

**Access**: Navigation → Rules

### Features

| Feature | Description |
|---------|-------------|
| **Location Tabs** | All, Project, User tabs |
| **Status Filter** | All, Enabled, Disabled |
| **Category Filter** | Filter by rule category |
| **Search** | Filter by name, description, category |
| **Active Filters Display** | Visual filter badges with remove |
| **Rules Grid** | Card grid with edit, delete, toggle actions |
| **CRUD Dialogs** | Create, edit, delete rule with confirmation |
| **Empty States** | Context-sensitive empty states |

### Rule Categories

Common rule categories include:
- **Validation** - Input and data validation
- **Transformation** - Data transformation rules
- **Routing** - Request routing logic
- **Security** - Security and access control
- **Custom** - User-defined categories

---

## MCP Manager

### Page Overview

**Location**: `ccw/frontend/src/pages/McpManagerPage.tsx`

**Purpose**: Manage MCP (Model Context Protocol) servers with template library and cross-CLI sync.

**Access**: Navigation → MCP

### Features

| Feature | Description |
|---------|-------------|
| **Main Tabs** | Templates, Servers, Cross-CLI tabs |
| **CLI Mode Toggle** | Switch between Claude and Codex modes |
| **Stats Cards** | Total, Enabled, Global, Project counts |
| **Server Cards** | Expandable cards with toggle, edit, delete, save as template |
| **CCW Tools MCP** | Special card for CCW Tools configuration |
| **Templates** | Recommended MCPs and custom templates |
| **Cross-CLI Sync** | Sync MCP servers between Claude and Codex |
| **Scope Filter** | All, Global, Project filter |
| **Conflict Detection** | Warn about scope conflicts |

### MCP Server Configuration

Each MCP server has:
- **Name** - Server identifier
- **Command** - Executable command
- **Args** - Command arguments array
- **Env** - Environment variables object
- **Scope** - Global or Project
- **Enabled** - Enable/disable toggle

### MCP Scopes

| Scope | Description |
|-------|-------------|
| **Global** | Available across all projects |
| **Project** | Available only for current project |

---

## Hook Manager

### Page Overview

**Location**: `ccw/frontend/src/pages/HookManagerPage.tsx`

**Purpose**: Manage CLI hooks with trigger type organization and wizard creation.

**Access**: Navigation → Hooks

### Features

| Feature | Description |
|---------|-------------|
| **Trigger Filters** | Filter by hook trigger type |
| **Stats Badges** | Enabled/Total count per trigger |
| **Search** | Filter by name, description, command |
| **Hook Cards** | Expandable cards with toggle, edit, delete |
| **Quick Templates** | Pre-built hook templates for quick install |
| **Wizard Launchers** | Guided creation for common hook patterns |
| **Create Dialog** | Manual hook creation form |

### Hook Trigger Types

| Trigger | Description |
|---------|-------------|
| **SessionStart** | When a session starts |
| **UserPromptSubmit** | When user submits a prompt |
| **PreToolUse** | Before tool execution |
| **PostToolUse** | After tool execution |
| **PostToolUseFailure** | After tool execution failure |
| **Stop** | When session stops |
| **Notification** | On notifications |
| **SubagentStart** | When subagent starts |
| **SubagentStop** | When subagent stops |
| **PreCompact** | Before context compaction |
| **SessionEnd** | When session ends |
| **PermissionRequest** | On permission requests |

### Hook Wizards

| Wizard | Description |
|--------|-------------|
| **Memory Update** | Auto-update memory after sessions |
| **Danger Protection** | Prevent dangerous operations |
| **Skill Context** | Auto-inject skill context |

---

## Components Reference

### Main Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `SkillsManagerPage` | `@/pages/SkillsManagerPage.tsx` | Skills management |
| `CommandsManagerPage` | `@/pages/CommandsManagerPage.tsx` | Commands management |
| `RulesManagerPage` | `@/pages/RulesManagerPage.tsx` | Rules management |
| `McpManagerPage` | `@/pages/McpManagerPage.tsx` | MCP servers management |
| `HookManagerPage` | `@/pages/HookManagerPage.tsx` | Hooks management |

### Shared Components

| Component | Purpose |
|-----------|---------|
| `SkillCard` / `SkillHubCard` | Skill display with actions |
| `CommandGroupAccordion` | Command group with accordion |
| `RuleCard` | Rule display with actions |
| `McpServerCard` / `CodexMcpEditableCard` | MCP server display |
| `HookCard` | Hook display with expand/collapse |
| `TabsNavigation` | Tab switcher |
| `CliModeToggle` | CLI mode badge switcher |

---

## Related Links

- [Settings](/features/settings) - Application configuration
- [System Settings](/features/system-settings) - Global system settings
- [CLI Tools](/features/cli) - CLI tool configuration
