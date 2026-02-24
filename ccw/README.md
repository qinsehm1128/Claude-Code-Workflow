# CCW - Claude Code Workflow CLI

[![Version](https://img.shields.io/badge/version-v6.3.19-blue.svg)](https://github.com/catlog22/Claude-Code-Workflow/releases)

A powerful command-line tool for managing Claude Code Workflow with native CodexLens code intelligence, multi-model CLI orchestration, and interactive dashboard.

## What's New in v6.3

### Hook System Integration
- **Soft Enforcement Stop Hook**: Never blocks - injects continuation messages for active workflows/modes
- **Mode System**: Keyword-based mode activation with exclusive mode conflict detection
- **Checkpoint/Recovery**: Automatic state preservation before context compaction
- **PreCompact Hook**: Creates checkpoints with mutex to prevent concurrent operations

## Installation

```bash
# Install globally
npm install -g ccw

# Or install from local source
cd path/to/ccw
npm install
npm link
```

## Usage

### View Dashboard

```bash
# Open workflow dashboard in browser
ccw view

# Specify project path
ccw view -p /path/to/project

# Generate dashboard without opening browser
ccw view --no-browser

# Custom output path
ccw view -o report.html
```

## Features

### 🔍 Native CodexLens (v6.3)
- **Full-Text Search (FTS)**: SQLite-based fast keyword search with symbol extraction
- **Semantic Search**: Dense embedding-based similarity search with vector store
- **Hybrid Search**: RRF (Reciprocal Rank Fusion) combining FTS and semantic results
- **Cross-Encoder Reranking**: Second-stage reranker for improved result relevance
- **HNSW Index**: Approximate Nearest Neighbor index for significantly faster vector search
- **Dynamic Batch Processing**: Intelligent batch size calculation for embedding generation
- **Workspace Index Status**: Real-time index status monitoring and management

### 💻 CLI Tools Integration
- **Multi-Model Support**: Execute prompts with Gemini, Qwen, Codex, Claude, or OpenCode
- **CLI Wrapper Endpoints**: Custom API endpoints with tool calling support
- **Smart Content Formatter**: Intelligent output formatting with structured IR
- **Session Resume**: Resume from last session or merge multiple sessions
- **SQLite History**: Persistent execution history with conversation tracking
- **Custom IDs**: Support for custom execution IDs and multi-turn conversations
- **Preload Service**: Optimized data fetching with caching for faster responses

### 🧠 Core Memory & Clustering
- **Session Clustering**: Intelligent grouping of related sessions
- **Cluster Visualization**: Interactive display with Cytoscape.js
- **Cluster Management**: Delete, merge, and deduplicate operations

### 🖥️ Dashboard Views
- **Workflow Dashboard**: Active/archived sessions with task progress
- **CodexLens Manager**: Index management with real-time progress bar
- **Core Memory**: Session clustering visualization
- **CLAUDE.md Manager**: File tree viewer for configuration
- **Skills Manager**: View and manage Claude Code skills
- **Graph Explorer**: Interactive code relationship visualization
- **MCP Manager**: Configure and monitor MCP servers
- **Hook Manager**: Manage Claude Code hooks
- **Help View**: Internationalized help documentation

### Review Integration
- **Code Review Findings**: View results from `review-module-cycle`
- **Severity Distribution**: Critical/High/Medium/Low finding counts
- **Dimension Analysis**: Findings by review dimension (Security, Architecture, Quality, etc.)
- **Tabbed Interface**: Switch between Workflow and Reviews tabs

### Hook System
- **Soft Enforcement Stop Hook**: Never blocks stops - injects continuation messages instead
- **Mode System**: Keyword-based mode activation (`autopilot`, `ultrawork`, `swarm`, etc.)
- **Checkpoint/Recovery**: Automatic state preservation before context compaction
- **PreCompact Hook**: Creates checkpoints with mutex to prevent concurrent operations
- **Exclusive Mode Detection**: Prevents conflicting modes from running concurrently

## Quick Start with Hooks

```bash
# Configure hooks in .claude/settings.json
{
  "hooks": {
    "PreCompact": [
      {
        "name": "Create Checkpoint",
        "command": "ccw hook precompact --stdin",
        "enabled": true
      }
    ],
    "Stop": [
      {
        "name": "Soft Enforcement Stop",
        "command": "ccw hook stop --stdin",
        "enabled": true
      }
    ]
  }
}

# Use mode keywords in prompts
"use autopilot to implement the feature"
"run ultrawork on this task"
"cancelomc"  # Stops active modes
```

See [docs/hooks-integration.md](docs/hooks-integration.md) for full documentation.

## Dashboard Data Sources

The CLI reads data from the `.workflow/` directory structure:

```
.workflow/
├── active/
│   └── WFS-{session-id}/
│       ├── workflow-session.json    # Session metadata
│       ├── .task/
│       │   └── IMPL-*.json          # Task definitions
│       └── .review/
│           ├── review-progress.json # Review progress
│           └── dimensions/
│               └── *.json           # Dimension findings
└── archives/
    └── WFS-{session-id}/            # Archived sessions
```

## Bundled Templates

The CLI includes bundled dashboard templates:
- `workflow-dashboard.html` - Workflow session and task visualization
- `review-cycle-dashboard.html` - Code review findings display

No external template installation required - templates are included in the npm package.

## Requirements

- Node.js >= 16.0.0
- npm or yarn

## Integration with Claude Code Workflow

This CLI is a standalone tool that works with the Claude Code Workflow system:

1. **Install CCW CLI** (via npm)
   - `npm install -g ccw`
   - Provides `ccw view` command for dashboard viewing
   - Templates are bundled - no additional installation required

2. **Optional: Install Claude Code Workflow** (via `Install-Claude.ps1`)
   - Provides workflow commands, agents, and automation
   - CCW will automatically detect and display workflow sessions

## Options

| Option | Description |
|--------|-------------|
| `-p, --path <path>` | Path to project directory (default: current directory) |
| `--no-browser` | Generate dashboard without opening browser |
| `-o, --output <file>` | Custom output path for HTML file |
| `-V, --version` | Display version number |
| `-h, --help` | Display help information |

## Development

```bash
# Clone and install dependencies
git clone <repo-url>
cd ccw
npm install

# Link for local testing
npm link

# Test the CLI
ccw view -p /path/to/test/project
```

## License

MIT
