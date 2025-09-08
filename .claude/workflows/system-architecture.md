# Workflow System Architecture

## Core Philosophy

### Document-State Separation
**"Documents store plans, JSON manages state"**

- **Markdown Files** → Planning, requirements, task structure, implementation strategies
- **JSON Files** → Execution state, progress tracking, session metadata, dynamic changes
- **JSON-Only Data Model** → Single source of truth for all task state and workflow coordination

### Progressive Complexity
**"Minimal overhead → comprehensive structure"**

- **Simple** → Lightweight JSON + optional docs
- **Medium** → Structured planning + conditional documents  
- **Complex** → Complete document suite + full coordination

### Session-First Architecture
**"All commands check active session for context"**

All workflow operations inherit from active session context through `.active-[session-name]` marker file system for seamless workflow integration.

## System Components

### Session Management
**Marker File System**: Ultra-simple active tracking using `.workflow/.active-[session-name]`

- **Multi-Session Architecture**: Supports concurrent sessions with single active session pattern
- **Command Pre-execution Protocol**: All commands automatically detect active session through marker file
- **State Management**: Individual session state with phase-aware progress tracking

**Technical Details**: @./session-management-principles.md

### Data Model System  
**JSON-Only Architecture**: Single source of truth with on-demand document generation

- **Task Definitions**: JSON files contain all task data with hierarchical structure
- **No Synchronization**: Documents generated on-demand from JSON, no bidirectional sync
- **State Coordination**: Real-time coordination through JSON task files only

**Technical Details**: @./data-model.md

### File Structure System
**Progressive Structure**: Scales from minimal structure for simple tasks to comprehensive organization for complex workflows

- **Complexity Levels**: Three levels (0-2) with automatic structure generation based on task count and scope
- **Standard Templates**: Consistent directory layouts and file naming across all complexity levels

**Technical Details**: @./file-structure-standards.md

### Agent Orchestration
**Context-Driven Coordination**: Gemini context analysis mandatory before agent execution

- **Gemini Context Analysis**: MANDATORY context gathering before any agent execution
- **Dynamic Agent Selection**: Choose agents based on discovered context and patterns
- **Cross-Agent Context Sharing**: Maintain shared context state across all agents

**Technical Details**: @./agent-orchestration-patterns.md

## Architectural Principles

### Fundamental Design Patterns

#### Session-First Architecture
- All workflow operations inherit from active session context
- Multi-session support with single active session pattern
- Context switching preserves complete state

#### Hierarchical Task Management
- JSON-based task definitions with up to 3 levels of decomposition
- Progress tracking with dependency management
- JSON-only data model eliminates synchronization issues

#### Complexity-Driven Structure
- File structure scales automatically with task complexity
- Document generation triggered by complexity thresholds
- Progressive enhancement without breaking simple workflows

#### Real-time Coordination
- TodoWrite tool provides immediate task visibility
- JSON task files maintain cross-session continuity
- Agent coordination through unified JSON interface

## Quality Assurance Principles

### Data Integrity
- Single source of truth: JSON task files
- Automatic validation and consistency checks
- Error recovery with graceful degradation

### Performance Guidelines
- Lazy loading of complex structures
- Minimal overhead for simple workflows
- Real-time updates without blocking operations

### Extensibility Rules
- Plugin architecture for specialized agents
- Template-based document generation
- Configurable complexity thresholds

## Implementation Flow

**Workflow Phases**: Session initialization → [Optional brainstorming] → Planning → Implementation → Review
**Progressive Complexity**: Structure and documentation automatically scale with task complexity
**Cross-Integration**: Real-time coordination across all system components through JSON-only data model

## Command Integration

### Embedded Workflow Logic
**Workflow Commands**: Session management, planning, and implementation with embedded document generation
**Task Commands**: Task creation, breakdown, execution, and status with automatic JSON coordination
**Manual Tools**: Maintenance operations for edge cases and manual intervention

## Architecture Integration

This document provides the technical architecture framework. For complete system documentation, see:

**📋 Complete Documentation**:
- **Session Management**: @./session-management-principles.md
- **Data Model**: @./data-model.md  
- **Complexity Rules**: @./complexity-rules.md
- **File Structure**: @./file-structure-standards.md
- **Agent Orchestration**: @./agent-orchestration-patterns.md
- **Brainstorming Integration**: @./brainstorming-principles.md

---

**Architecture ensures**: Consistent scalable workflow management with JSON-only data model, marker file sessions, and progressive complexity scaling from simple tasks → comprehensive project coordination