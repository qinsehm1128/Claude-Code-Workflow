# Settings

## One-Liner

**The Settings page provides a unified interface for managing application preferences, CLI tools, feature flags, and data management.**

---

## Pain Points Solved

| Pain Point | Current State | Settings Solution |
|------------|---------------|-------------------|
| **Scattered configuration** | Settings in multiple files | Centralized UI for all settings |
| **No tool management** | Edit config files manually | Enable/disable tools from UI |
| **Feature flags hidden** | Need to know config keys | Visual toggle switches |
| **No export/import** | Manual backup/restore | One-click export/import |
| **Unclear CCW status** | Can't tell if installed | Installation status indicator |

---

## Page Overview

**Location**: `ccw/frontend/src/pages/SettingsPage.tsx`

**Purpose**: Application settings and configuration with CLI tools management.

**Access**: Navigation → Settings

### Layout

```
+--------------------------------------------------------------------------+
|  Settings Title                                                            |
+--------------------------------------------------------------------------+
|  [Theme & Appearance v]                                                    |
|  [Language v]                                                             |
|  [Notifications v]                                                        |
|  [Advanced v]                                                             |
|  [CLI Tools v]                                                           |
|  [Data Management v]                                                      |
+--------------------------------------------------------------------------+
|  (Each section expands/capses to show settings)                            |
+--------------------------------------------------------------------------+
```

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Collapsible Sections** | Expand/collapse setting categories |
| **Theme Selection** | Choose light/dark theme |
| **Language Switcher** | Select UI language |
| **Notification Preferences** | Configure notification settings |
| **Feature Flags** | Toggle experimental features |
| **CLI Tools Management** | Enable/disable tools, select default |
| **Data Management** | Export/import settings, reset to defaults |
| **CCW Installation Status** | View and manage CCW installation |

---

## Settings Categories

### Theme & Appearance

| Setting | Options | Description |
|---------|---------|-------------|
| **Theme** | Light, Dark, Auto | Select color theme |
| **Font Size** | Small, Medium, Large | Adjust UI text size |

### Language

| Setting | Options | Description |
|---------|---------|-------------|
| **Interface Language** | English, Chinese | Select UI language |

### Notifications

| Setting | Options | Description |
|---------|---------|-------------|
| **Enable Notifications** | Toggle | Show desktop notifications |
| **Sound Effects** | Toggle | Play sounds for actions |

### Advanced

| Setting | Options | Description |
|---------|---------|-------------|
| **Chinese Response** | Toggle | Enable Chinese language responses |
| **Windows Platform** | Toggle | Enable Windows-specific features |
| **Codex CLI Enhancement** | Toggle | Enhanced Codex CLI integration |

### CLI Tools

| Tool | Status | Models | Tags |
|------|--------|--------|------|
| **Gemini** | Toggle | gemini-2.5-flash, gemini-2.5-pro | analysis, debug |
| **Qwen** | Toggle | coder-model | - |
| **Codex** | Toggle | gpt-5.2 | - |
| **Claude** | Toggle | sonnet, haiku | - |
| **OpenCode** | Toggle | opencode/glm-4.7-free | - |

### Default Tool Selection

Choose which CLI tool to use by default for operations.

---

## Usage Guide

### Basic Workflow

1. **Browse Settings**: Click section headers to expand/collapse
2. **Modify Settings**: Change values using toggles, dropdowns, or inputs
3. **Enable/Disable Tools**: Use toggle switches in CLI Tools section
4. **Set Default Tool**: Select from dropdown
5. **Export Settings**: Click Export to download settings file
6. **Import Settings**: Click Import to upload settings file
7. **Reset**: Click Reset to Defaults to restore defaults

### Key Interactions

| Interaction | How to Use |
|-------------|------------|
| **Expand section** | Click section header to expand/collapse |
| **Toggle setting** | Click toggle switch to enable/disable |
| **Select option** | Use dropdown to select from options |
| **Export settings** | Click Export button, saves to file |
| **Import settings** | Click Import button, select file to upload |
| **Reset defaults** | Click Reset to Defaults, confirm in dialog |

### CCW Installation

The CCW (Code Canvas Workflow) installation status is displayed with:
- **Status Indicator**: Shows if CCW is installed
- **Version**: Current CCW version
- **Install Button**: Click to install or upgrade CCW

---

## Configuration

### Settings Persistence

Settings are stored in:
- **Global**: `~/.claude/settings.json`
- **Project**: `.claude/settings.json`
- **Local**: `.claude/settings.local.json` (highest priority)

### Feature Flags

```json
{
  "featureFlags": {
    "chineseResponse": true,
    "windowsPlatform": false,
    "codexCliEnhancement": true,
    "dashboardQueuePanelEnabled": true,
    "dashboardInspectorEnabled": true,
    "dashboardExecutionMonitorEnabled": true
  }
}
```

### CLI Tools Configuration

```json
{
  "cliTools": {
    "gemini": { "enabled": true },
    "qwen": { "enabled": true },
    "codex": { "enabled": true },
    "claude": { "enabled": true },
    "opencode": { "enabled": true }
  },
  "defaultCliTool": "gemini"
}
```

---

## Related Links

- [API Settings](/features/api-settings) - API endpoint configuration
- [CLI Call](/features/cli) - Command line invocation
- [Extensions](/features/extensions) - Skills, commands, rules management
- [System Settings](/features/system-settings) - Hooks, agents, MCP configuration
