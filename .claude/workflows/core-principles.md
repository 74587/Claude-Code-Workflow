# Workflow System Core Principles

## Architecture Philosophy

### Document-State Separation
**"Documents store plans, JSON manages state"**

- **Markdown Files** → Planning, requirements, task structure, implementation strategies
- **JSON Files** → Execution state, progress tracking, session metadata, dynamic changes
- **Auto-sync** → Bidirectional coordination with clear ownership rules

### Progressive Complexity
**"Minimal overhead → comprehensive structure"**

- **Simple** → Lightweight JSON + optional docs
- **Medium** → Structured planning + conditional documents  
- **Complex** → Complete document suite + full coordination

### Embedded Document Logic
**"No command dependencies for document operations"**

- **Built-in** → Document splitting internal to commands
- **Trigger-based** → Auto-splitting on complexity/task thresholds
- **Maintenance** → docs:manage for manual operations only

### Command Pre-execution Protocol
**"All commands check active session for context"**

Commands automatically discover and inherit context from active sessions for seamless workflow integration.

## Fundamental Design Patterns

### Session-First Architecture
- All workflow operations inherit from active session context
- Multi-session support with single active session pattern
- Context switching preserves complete state

### Hierarchical Task Management
- JSON-based task definitions with up to 3 levels of decomposition
- Bidirectional sync between task files and visualization
- Progress tracking with dependency management

### Complexity-Driven Structure
- File structure scales automatically with task complexity
- Document generation triggered by complexity thresholds
- Progressive enhancement without breaking simple workflows

### Real-time Coordination
- TodoWrite tool provides immediate task visibility
- Persistent TODO_LIST.md maintains cross-session continuity
- Agent coordination through unified task interface

## Quality Assurance Principles

### Data Integrity
- Single source of truth for each data type
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

---

**Core Philosophy**: Consistent scalable workflow management with simplicity for basic tasks → comprehensive structure for complex projects