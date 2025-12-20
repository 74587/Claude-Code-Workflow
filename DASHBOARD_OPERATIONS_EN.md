# CCW Dashboard Operations Guide

**Version**: 6.2.0
**Updated**: 2025-12-20

This document provides detailed step-by-step operation instructions for each CCW Dashboard view.

---

## Table of Contents

1. [Home Overview Operations](#1-home-overview-operations)
2. [Session Detail Operations](#2-session-detail-operations)
3. [CLI Manager Operations](#3-cli-manager-operations)
4. [Core Memory Operations](#4-core-memory-operations)
5. [MCP Server Management Operations](#5-mcp-server-management-operations)
6. [Hook Manager Operations](#6-hook-manager-operations)
7. [Skills Manager Operations](#7-skills-manager-operations)
8. [CodexLens Index Management Operations](#8-codexlens-index-management-operations)

---

## 1. Home Overview Operations

### 1.1 Entry Point
- Displayed automatically after Dashboard launch
- Click **"Overview"** in the sidebar navigation

### 1.2 Project Switching
1. Click the **Project Path Selector** in the top action bar
2. Select from recent projects dropdown, or click **"Browse..."** to select a new project
3. System automatically loads the new project data

### 1.3 Data Refresh
- Click the **Refresh Button** (🔄) in the top action bar
- Or wait for WebSocket automatic push updates

### 1.4 Active Session Carousel
- Auto-rotates through currently active workflow sessions
- Click a session card to enter session details

### 1.5 Statistics Cards
Displays the following statistics:
- Total sessions
- Active sessions
- Archived sessions
- Task completion rate

---

## 2. Session Detail Operations

### 2.1 Entry Point
- Click a session card from the home page
- Click from sidebar **"Sessions"** > **"All/Active/Archived"** list

### 2.2 Session List Operations

| Operation | Steps |
|-----------|-------|
| Filter sessions | Click **"All/Active/Archived"** tabs to switch |
| Search sessions | Enter session ID or description in search box |
| View details | Click session row to expand details |

### 2.3 Session Detail Panel

#### Basic Information Area
- Session ID, creation time, status
- Session description and objectives

#### Task List Area
| Operation | Description |
|-----------|-------------|
| View tasks | Tasks displayed as list with status icons |
| Expand task | Click task row to view detailed information |
| Task status | 🔵 Pending / 🟡 In Progress / 🟢 Completed / 🔴 Failed |

#### Action Buttons
| Button | Function |
|--------|----------|
| **Archive** | Mark session as archived |
| **Delete** | Delete session (requires confirmation) |
| **Export** | Export session data as JSON |

### 2.4 Task Drawer

Detail drawer opened after clicking a task:

| Area | Content |
|------|---------|
| Header | Task title, status badge |
| Context | Related files list, dependencies |
| Execution log | Real-time execution output (WebSocket push) |
| Actions | Retry, Skip, Mark complete |

---

## 3. CLI Manager Operations

### 3.1 Entry Point
Sidebar **"Project"** > **"Status"**

### 3.2 CLI Tool Status Panel

#### Tool Status Cards
Each tool (Gemini/Qwen/Codex) displays:
- Installation status: ✅ Installed / ❌ Not installed
- Version information
- Default model configuration

#### Set Default Tool
1. Click **"Set as Default"** button on tool card
2. Confirm selection

#### Model Configuration
1. Click **"Configure"** button
2. In the modal dialog, set:
   - Primary Model
   - Fallback Model
3. Click **"Save"**

### 3.3 Install/Uninstall Wizard

#### Install Tool
1. Click **"Install"** button on uninstalled tool
2. Follow wizard steps:
   - Confirm system requirements
   - Enter API key (if required)
   - Select installation options
3. Wait for installation to complete

#### Uninstall Tool
1. Click **"Uninstall"** button on installed tool
2. Confirm uninstall operation
3. Wait for uninstall to complete

### 3.4 Execution History

Sidebar **"Project"** > **"History"**

| Operation | Description |
|-----------|-------------|
| View records | List displays execution time, tool, prompt summary |
| Expand details | Click record to view full input/output |
| Resume session | Click **"Continue"** button to resume with `--resume` |
| Copy command | Click **"Copy"** icon to copy execution command |

---

## 4. Core Memory Operations

### 4.1 Entry Point
Sidebar **"Memory"** > **"Core Memory"**

### 4.2 Memory List View

#### View Memories
- Memory entries displayed as cards
- Includes: title, summary, tags, creation time

#### Create Memory
1. Click **"+ New Memory"** button
2. Fill in the form:
   | Field | Description |
   |-------|-------------|
   | Title | Memory title (required) |
   | Content | Memory body (Markdown supported) |
   | Tags | Category tags (comma-separated) |
   | Priority | High/Medium/Low |
3. Click **"Save"**

#### Edit Memory
1. Click **"Edit"** icon on memory card
2. Modify content
3. Click **"Save"**

#### Archive/Delete
- **Archive**: Click **"Archive"** icon, memory moves to archive list
- **Delete**: Click **"Delete"** icon, confirm for permanent deletion

### 4.3 Cluster View

Switch to **"Clusters"** tab

#### View Clusters
- Auto-clustered session groups displayed
- Each cluster shows: name, member count, creation time

#### Auto Clustering
1. Click **"Auto Cluster"** button
2. Set parameters:
   | Parameter | Description |
   |-----------|-------------|
   | Similarity Threshold | 0.0-1.0, default 0.7 |
   | Minimum Members | Minimum sessions per cluster |
3. Click **"Execute"**
4. Wait for clustering to complete

#### Cluster Management
| Operation | Steps |
|-----------|-------|
| View members | Click cluster card to expand member list |
| Rename | Click cluster name to edit |
| Merge clusters | Select multiple clusters, click **"Merge"** |
| Delete cluster | Click **"Delete"** icon (members not deleted) |

### 4.4 Embedding Management

#### View Embedding Status
- Shows count of memories with generated embeddings
- Shows count of memories pending embedding

#### Generate Embeddings
1. Click **"Generate Embeddings"** button
2. Select scope:
   - All unembedded
   - Selected memories
3. Wait for generation to complete (progress bar displayed)

---

## 5. MCP Server Management Operations

### 5.1 Entry Point
Sidebar **"Config"** > **"MCP Servers"**

### 5.2 Server List

#### View Servers
- List displays configured servers
- Each row shows: name, type, status, config source

#### Status Indicators
- 🟢 Running
- 🔴 Stopped
- 🟡 Starting

### 5.3 Create Server

#### Manual Creation
1. Click **"+ Add Server"** button
2. Fill in the form:
   | Field | Description |
   |-------|-------------|
   | Name | Server identifier (required) |
   | Command | Start command (e.g., `node`) |
   | Arguments | Command arguments array |
   | Environment Variables | KEY=VALUE format |
   | Config Scope | Project / Global |
3. Click **"Save"**

#### Install from Template
1. Click **"Templates"** tab
2. Browse available templates
3. Click template's **"Install"** button
4. Confirm or modify configuration
5. Click **"Confirm Install"**

### 5.4 Edit/Delete

| Operation | Steps |
|-----------|-------|
| Edit | Click **"Edit"** icon → Modify config → Save |
| Delete | Click **"Delete"** icon → Confirm deletion |
| Enable/Disable | Toggle status switch |

### 5.5 Configuration File Locations

| Scope | File Path |
|-------|-----------|
| Project | `.mcp.json` |
| Global | `~/.claude/settings.json` |

---

## 6. Hook Manager Operations

### 6.1 Entry Point
Sidebar **"Config"** > **"Hooks"**

### 6.2 Hook List

#### View by Type
- **PreToolUse**: Triggered before tool use
- **PostToolUse**: Triggered after tool use
- **Notification**: Notification hooks

#### List Information
Each hook displays: name, type, matching tool, command summary

### 6.3 Create Hook

#### Wizard Mode
1. Click **"+ Add Hook"** button
2. Select hook type
3. Fill in configuration:
   | Field | Description |
   |-------|-------------|
   | Name | Hook identifier |
   | Matcher | Tool name to match (supports wildcard `*`) |
   | Command | Shell command to execute |
   | Timeout | Command timeout (milliseconds) |
   | Scope | Project / Global |
4. Click **"Save"**

#### Create from Template
1. Click **"Templates"** tab
2. Select preset template (e.g., format check, security scan)
3. Click **"Use Template"**
4. Modify configuration as needed
5. Click **"Save"**

### 6.4 Edit/Delete

| Operation | Steps |
|-----------|-------|
| Edit | Click hook row → Modify config → Save |
| Delete | Click **"Delete"** icon → Confirm |
| Enable/Disable | Toggle status switch |

### 6.5 Configuration File Locations

| Scope | File Path |
|-------|-----------|
| Project | `.claude/settings.local.json` |
| Global | `~/.claude/settings.json` |

---

## 7. Skills Manager Operations

### 7.1 Entry Point
Sidebar **"Memory"** > **"Skills"**

### 7.2 Skills List

#### Category View
- **Project Skills**: Skills in `./.claude/skills/` directory
- **User Skills**: Skills in `~/.claude/skills/` directory

#### Skill Card Information
- Skill name
- Description
- Version number
- Tool count
- Support file count

### 7.3 View Skill Details

1. Click skill card
2. Detail panel displays:
   - Full description
   - Included tools list
   - Support files list
   - Dependency information

### 7.4 Create Skill

#### Import from Folder
1. Click **"+ Import Skill"** button
2. Select directory containing skill files
3. Confirm skill information
4. Click **"Import"**

#### Generate via CLI
1. Click **"+ Generate Skill"** button
2. Enter skill description
3. Select generation options:
   - Target directory (Project/User)
   - Included capabilities
4. Click **"Generate"**
5. Wait for AI generation to complete

### 7.5 Delete Skill

1. Click **"Delete"** icon on skill card
2. Confirm delete operation
3. Skill files will be removed

---

## 8. CodexLens Index Management Operations

### 8.1 Entry Point
Sidebar **"Project"** > **"Status"** → CodexLens panel

### 8.2 Index Status

#### Status Indicators
| Status | Description |
|--------|-------------|
| ✅ Indexed | Project has established index |
| ⚠️ Outdated | Index needs update |
| ❌ Not indexed | Project has no index |

#### Index Statistics
- Total index size
- Project count
- Vector index count
- FTS index count

### 8.3 Initialize Index

1. Click **"Initialize Index"** button
2. Select index mode:
   | Mode | Description |
   |------|-------------|
   | FTS | Full-text search, fast |
   | Vector | Semantic search, requires embedding model |
   | Hybrid | FTS + Vector, full features |
3. Select languages/file types to index
4. Click **"Start Indexing"**
5. View progress bar and real-time logs

### 8.4 Clean Index

#### Clean Current Project
1. Click **"Clean Project Index"** button
2. Confirm operation
3. Current project index is deleted

#### Clean All Indexes
1. Click **"Clean All Indexes"** button
2. Enter confirmation text
3. All indexes are deleted

### 8.5 Semantic Dependency Management

#### Check Status
- Shows Python environment status
- Shows installed dependency packages

#### Install Dependencies
1. Click **"Install Semantic Dependencies"** button
2. Wait for installation to complete
3. View installation logs

### 8.6 Embedding Model Management

#### View Models
- Lists available embedding models
- Shows downloaded/not downloaded status

#### Download Model
1. Click **"Download"** button on undownloaded model
2. Wait for download to complete
3. Model available for vector indexing

#### Delete Model
1. Click **"Delete"** button on downloaded model
2. Confirm deletion
3. Model files are removed

### 8.7 Test Search

1. Enter search query in test area
2. Select search mode:
   - `auto`: Auto select
   - `hybrid`: Hybrid search
   - `exact`: Exact match
   - `ripgrep`: Text search
3. Click **"Search"**
4. View search results

---

## Common Operations

### Keyboard Shortcuts

| Shortcut | Function |
|----------|----------|
| `Escape` | Close modal/sidebar |
| `Ctrl+R` / `Cmd+R` | Refresh data |

### Theme & Language Switching

| Operation | Location |
|-----------|----------|
| Switch theme | Sun/moon icon in top action bar |
| Switch language | EN/ZH button in top action bar |

### Error Handling

| Error Type | Resolution |
|------------|------------|
| Network error | Check connection, click refresh to retry |
| Permission error | Check file/directory permissions |
| Validation error | Check required form fields |
| Timeout error | Increase timeout settings or batch operations |

### WebSocket Connection

- **Auto reconnect**: Automatically attempts reconnection after disconnect
- **Heartbeat keepalive**: Periodic heartbeat to maintain connection
- **Status indicator**: Connection status shown in footer

---

## Related Documentation

- [DASHBOARD_GUIDE.md](DASHBOARD_GUIDE.md) - Dashboard User Guide
- [COMMAND_REFERENCE.md](COMMAND_REFERENCE.md) - Command Reference
- [GETTING_STARTED.md](GETTING_STARTED.md) - Getting Started Guide

---

**CCW Dashboard** - Claude Code Workflow Visual Control Center Operations Manual
