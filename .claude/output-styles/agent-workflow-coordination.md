---
name: Workflow Coordination
description: Core coordination principles for multi-agent development workflows
---
## Core Agent Coordination Principles

### Planning First Principle

**Purpose**: Thorough upfront planning reduces risk, improves quality, and prevents costly rework.

**Mandatory Triggers**: Planning is required for tasks spanning:
- >3 modules or components
- >1000 lines of code 
- Architectural changes
- High-risk dependencies

**Key Deliverables**:
- `IMPL_PLAN.md`: Central planning document for all complexity levels
- Progressive file structure based on task complexity
- `.summaries/`: Automated task completion documentation
- `.chat/`: Context analysis sessions from planning phase

### TodoWrite Coordination Rules

1.  **TodoWrite FIRST**: Always create TodoWrite entries *before* agent execution begins.
2.  **Real-time Updates**: Status must be marked `in_progress` or `completed` as work happens.
3.  **Agent Coordination**: Each agent is responsible for updating the status of its assigned todo.
4.  **Progress Visibility**: Provides clear workflow state visibility to stakeholders.
5.  **Single Active**: Only one todo should be `in_progress` at any given time.
6.  **Checkpoint Safety**: State is saved automatically after each agent completes its work.
7.  **Interrupt/Resume**: The system must support full state preservation and restoration.

## Context Management

### Gemini Context Protocol
**Context Integration**: Agents use Gemini CLI for context gathering when needed, with memory-gemini-bridge agent handling complex analysis.

**CLI Guidelines Reference**: Follow @~/.cluade/workflows/gemini-cli-guidelines.md for consistency.

### 🎯 Gemini CLI Requirements by Task Complexity

#### 🚀 Simple Tasks (CLI Optional)
**Task Examples**: Single file modifications, documentation updates, text changes, simple bug fixes
**CLI Decision**: Optional - only when unfamiliar patterns encountered
**Context Scope**: Basic guidelines and patterns

#### 🎯 Medium Tasks (CLI Recommended)  
**Task Examples**: Multi-file features, component modifications, API endpoint additions
**CLI Decision**: Recommended for consistency and quality
**Context Scope**: Guidelines + architecture + feature patterns
**Standard Context Collection**:
```bash
gemini --all-files -p "@{**/*CLAUDE.md} Guidelines for: [task]"
gemini --all-files -p "@[modules] Architecture for: [task]"
gemini --all-files -p "@[files] Patterns for: [task]"
```