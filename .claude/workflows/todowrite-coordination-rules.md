# TodoWrite-Workflow Coordination Rules

## Overview


This document defines the complete coordination system between Claude's TodoWrite tool and the workflow persistence layer (TODO_LIST.md and JSON task files).

## TodoWrite Tool Architecture

### Tool Purpose and Scope
**TodoWrite Tool**:
- Claude's internal task coordination interface
- Real-time progress tracking during active sessions
- Agent coordination and status management
- Immediate task visibility for execution context

**NOT for**:
- Long-term task persistence (that's JSON task files)
- Cross-session task continuity (that's TODO_LIST.md)
- Historical task audit trails (that's workflow summaries)

## Core Coordination Principles

### Execution Order Rules
1. **Create TodoWrite FIRST** - Before any agent coordination begins
2. **Real-time Updates** - Agents update todo status during execution
3. **Progress Tracking** - Maintain visible workflow state throughout
4. **Single Active Rule** - Only one todo in_progress at any time
5. **Completion Gates** - Mark completed only when truly finished
6. **Persistence Sync** - TodoWrite changes trigger workflow file updates
