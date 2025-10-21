# Development Guidelines

## Overview

This document defines project-specific coding standards and development principles.
### CLI Tool Context Protocols
For all CLI tool usage, command syntax, and integration guidelines:
- **MCP Tool Strategy**: @~/.claude/workflows/mcp-tool-strategy.md
- **Intelligent Context Strategy**: @~/.claude/workflows/intelligent-tools-strategy.md
- **Context Search Commands**: @~/.claude/workflows/context-search-strategy.md

**Context Requirements**:
- Identify 3+ existing similar patterns before implementation
- Map dependencies and integration points
- Understand testing framework and coding conventions


## Philosophy

### Core Beliefs

- **Pursue good taste** - Eliminate edge cases to make code logic natural and elegant
- **Embrace extreme simplicity** - Complexity is the root of all evil
- **Be pragmatic** - Code must solve real-world problems, not hypothetical ones
- **Data structures first** - Bad programmers worry about code; good programmers worry about data structures
- **Never break backward compatibility** - Existing functionality is sacred and inviolable
- **Incremental progress over big bangs** - Small changes that compile and pass tests
- **Learning from existing code** - Study and plan before implementing
- **Clear intent over clever code** - Be boring and obvious
- **Follow existing code style** - Match import patterns, naming conventions, and formatting of existing codebase
- **No unsolicited reports** - Task summaries can be performed internally, but NEVER generate additional reports, documentation files, or summary files without explicit user permission

### Simplicity Means

- Single responsibility per function/class
- Avoid premature abstractions
- No clever tricks - choose the boring solution
- If you need to explain it, it's too complex

## Project Integration

### Learning the Codebase

- Find 3 similar features/components
- Identify common patterns and conventions
- Use same libraries/utilities when possible
- Follow existing test patterns

### Tooling

- Use project's existing build system
- Use project's test framework  
- Use project's formatter/linter settings
- Don't introduce new tools without strong justification

## Important Reminders

**NEVER**:
- Make assumptions - verify with existing code
- Generate reports, summaries, or documentation files without explicit user request

**ALWAYS**:
- Plan complex tasks thoroughly before implementation
- Generate task decomposition for multi-module work (>3 modules or >5 subtasks)
- Track progress using TODO checklists for complex tasks
- Validate planning documents before starting development
- Commit working code incrementally
- Update plan documentation and progress tracking as you go
- Learn from existing implementations
- Stop after 3 failed attempts and reassess

## Platform-Specific Guidelines

### Windows Path Format Guidelines
- **MCP Tools**: Use double backslash `D:\\path\\file.txt` (MCP doesn't support POSIX `/d/path`)
- **Bash Commands**: Use forward slash `D:/path/file.txt` or POSIX `/d/path/file.txt`
- **Relative Paths**: No conversion needed `./src`, `../config`
- **Quick Ref**: `C:\Users` → MCP: `C:\\Users` | Bash: `/c/Users` or `C:/Users`

#### **Content Uniqueness Rules**

- **Each layer owns its abstraction level** - no content sharing between layers
- **Reference, don't duplicate** - point to other layers, never copy content
- **Maintain perspective** - each layer sees the system at its appropriate scale
- **Avoid implementation creep** - higher layers stay architectural

