# Development Guidelines

## Overview

This document defines project-specific coding standards and development principles.

## Philosophy

### Core Beliefs

- **Incremental progress over big bangs** - Small changes that compile and pass tests
- **Learning from existing code** - Study and plan before implementing  
- **Pragmatic over dogmatic** - Adapt to project reality
- **Clear intent over clever code** - Be boring and obvious

### Simplicity Means

- Single responsibility per function/class
- Avoid premature abstractions
- No clever tricks - choose the boring solution
- If you need to explain it, it's too complex


## Code Quality Standards

### Code Style

- **Consistent formatting** - Follow project's established formatting rules
- **Meaningful names** - Variables and functions should be self-documenting
- **Small functions** - Each function should do one thing well
- **Clear structure** - Logical organization of code modules

### Testing Standards

- **Test coverage** - Aim for high test coverage on critical paths
- **Test readability** - Tests should serve as documentation
- **Edge cases** - Consider boundary conditions and error states
- **Test isolation** - Tests should be independent and repeatable


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


### Gemini Context Protocol
For all Gemini CLI usage, command syntax, and integration guidelines:
@~/.claude/workflows/gemini-unified.md


#### **Content Uniqueness Rules**

- **Each layer owns its abstraction level** - no content sharing between layers
- **Reference, don't duplicate** - point to other layers, never copy content
- **Maintain perspective** - each layer sees the system at its appropriate scale
- **Avoid implementation creep** - higher layers stay architectural

#### **Update Strategy**

- **Related Mode**: Update only affected modules + parent hierarchy propagation
- **Full Mode**: Complete hierarchy refresh with strict layer boundaries
- **Context Intelligence**: Automatic detection of what needs updating


#### **Quality Assurance**

- **Layer Validation**: Each CLAUDE.md must stay within its layer's purpose
- **Duplication Detection**: Cross-reference content to prevent overlap
- **Hierarchy Consistency**: Parent layers reflect child changes appropriately
- **Content Relevance**: Regular cleanup of outdated or irrelevant content

