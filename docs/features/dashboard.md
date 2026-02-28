# Dashboard Panel

## One-Liner

**The Dashboard is a VS Code webview-based management interface** — Provides visual access to project configuration, specs, memory, and settings through an intuitive GUI.

---

## Pain Points Solved

| Pain Point | Current State | Dashboard Solution |
|------------|---------------|-------------------|
| **Config complexity** | JSON files hard to edit | Visual form-based editing |
| **No overview** | Can't see project state at a glance | Unified dashboard view |
| **Scattered settings** | Settings in multiple files | Centralized management |
| **No visual feedback** | CLI only, no UI | Interactive webview |

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Project Overview** | Tech stack, dependencies, status |
| **Spec Manager** | View and edit specification files |
| **Memory Viewer** | Browse persistent memories |
| **API Settings** | Configure AI model endpoints |
| **System Settings** | Global and project settings |

---

## Access

Open via VS Code command palette:
```
CCW: Open Dashboard
```

Or via CLI:
```bash
ccw view
```

---

## Dashboard Sections

### 1. Project Overview
- Technology stack detection
- Dependency status
- Workflow session status

### 2. Spec Manager
- List all specs
- Edit spec content
- Enable/disable specs

### 3. Memory Viewer
- Browse memory entries
- Search memories
- Export/import

### 4. API Settings
- Configure API keys
- Set model endpoints
- Manage rate limits

### 5. System Settings
- Global configuration
- Project overrides
- Hook management

---

## Related Links

- [API Settings](/features/api-settings) - API configuration
- [System Settings](/features/system-settings) - System configuration
- [Spec System](/features/spec) - Specification management
