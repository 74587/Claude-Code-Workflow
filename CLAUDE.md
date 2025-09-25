# Development Guidelines

## Overview

This document defines project-specific coding standards and development principles.
### CLI Tool Context Protocols
For all CLI tool usage, command syntax, and integration guidelines:
- **Intelligent Context Strategy**: @~/.claude/workflows/intelligent-tools-strategy.md
- **Context Search Commands**: @~/.claude/workflows/context-search-strategy.md

**Context Requirements**:
- Identify 3+ existing similar patterns before implementation
- Map dependencies and integration points
- Understand testing framework and coding conventions


## Philosophy

### Core Beliefs

- **Incremental progress over big bangs** - Small changes that compile and pass tests
- **Learning from existing code** - Study and plan before implementing
- **Pragmatic over dogmatic** - Adapt to project reality
- **Clear intent over clever code** - Be boring and obvious
- **Simple solutions over complex architectures** - Avoid over-engineering and premature optimization
- **Follow existing code style** - Match import patterns, naming conventions, and formatting of existing codebase

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

**ALWAYS**:
- Plan complex tasks thoroughly before implementation
- Generate task decomposition for multi-module work (>3 modules or >5 subtasks)
- Track progress using TODO checklists for complex tasks
- Validate planning documents before starting development
- Commit working code incrementally
- Update plan documentation and progress tracking as you go
- Learn from existing implementations
- Stop after 3 failed attempts and reassess


#### **Content Uniqueness Rules**

- **Each layer owns its abstraction level** - no content sharing between layers
- **Reference, don't duplicate** - point to other layers, never copy content
- **Maintain perspective** - each layer sees the system at its appropriate scale
- **Avoid implementation creep** - higher layers stay architectural

