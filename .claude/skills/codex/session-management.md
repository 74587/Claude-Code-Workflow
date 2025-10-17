# Codex Session Management

## Overview

Codex supports session continuity for multi-task development workflows. Sessions maintain context across related tasks, enabling efficient multi-step implementations without repeating context.

## Core Concepts

### Session Types

**New Session** - Establishes fresh context:
```bash
codex -C directory --full-auto exec "task" --skip-git-repo-check -s danger-full-access
```

**Resume Session** - Continues with previous context:
```bash
codex --full-auto exec "task" resume --last --skip-git-repo-check -s danger-full-access
```

**Interactive Resume** - Picker or direct resume:
```bash
codex resume          # Show session picker
codex resume --last   # Resume most recent
```

## Session Resume Patterns

### Multi-Task Development Pattern

**Pattern Overview**:
1. First task: establish session with `-C`
2. Subsequent tasks: continue with `resume --last`
3. Related tasks: maintain context continuity
4. Unrelated tasks: start new session

**Example - Authentication Feature**:
```bash
# Task 1: Establish session - Implement auth module
codex -C project --full-auto exec "
PURPOSE: Implement user authentication
TASK: Create JWT-based authentication system
MODE: auto
CONTEXT: @{src/auth/**/*} Database schema from session memory
EXPECTED: Complete auth module with middleware
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt) | Follow security best practices
" --skip-git-repo-check -s danger-full-access

# Task 2: Continue session - Add JWT validation
codex --full-auto exec "
PURPOSE: Enhance authentication security
TASK: Add JWT token validation and refresh logic
MODE: auto
CONTEXT: Previous auth implementation from current session
EXPECTED: JWT validation middleware and token refresh endpoints
RULES: Follow JWT best practices, maintain session context
" resume --last --skip-git-repo-check -s danger-full-access

# Task 3: Continue session - Generate tests
codex --full-auto exec "
PURPOSE: Increase test coverage
TASK: Generate comprehensive tests for auth module
MODE: write
CONTEXT: Auth implementation from current session
EXPECTED: Complete test suite with 80%+ coverage
RULES: Use Jest, follow existing patterns
" resume --last --skip-git-repo-check -s danger-full-access
```

### Auto-Resume Decision Tree

```
Is current task related to previous Codex task?
├─ YES → Does it extend/enhance previous implementation?
│  ├─ YES → Use `resume --last`
│  └─ NO → Check if it requires previous context
│     ├─ YES → Use `resume --last`
│     └─ NO → Start new session
└─ NO → Is this first Codex task in conversation?
   ├─ YES → Start new session
   └─ NO → Different module/feature area?
      ├─ YES → Start new session
      └─ NO → Check conversation memory for recent Codex execution
         ├─ FOUND → Use `resume --last`
         └─ NOT FOUND → Start new session
```

## Auto-Resume Decision Rules

### Use `resume --last` When

**Related Work**:
- Current task extends previous Codex task
- Current task enhances previous implementation
- Current task fixes issues in previous work

**Example**:
```bash
# First: Implement feature
codex -C src --full-auto exec "Implement user profile" ...

# Later: Add validation to same feature
codex --full-auto exec "Add profile validation" resume --last ...
```

**Multi-Step Workflow**:
- Part of implement → enhance → test cycle
- Sequential improvements
- Incremental feature development

**Example**:
```bash
# Step 1: Basic implementation
codex -C src --full-auto exec "Create API endpoint" ...

# Step 2: Add error handling
codex --full-auto exec "Add error handling to endpoint" resume --last ...

# Step 3: Add tests
codex --full-auto exec "Generate endpoint tests" resume --last ...
```

**Context Dependency**:
- Requires understanding of previous implementation
- Builds on previous work
- References previous changes

**Example**:
```bash
# First: Database schema
codex -C db --full-auto exec "Create user table" ...

# Later: API using that schema
codex --full-auto exec "Create API for user table" resume --last ...
```

**Session Memory Indicates Recent Work**:
- Conversation history shows recent Codex execution
- Working on same module/feature
- Continuing interrupted work

### Do NOT Use `resume --last` When

**First Task in Conversation**:
```bash
# Always start fresh
codex -C project --full-auto exec "New feature" ...
```

**New Independent Task**:
```bash
# Unrelated to previous work
codex -C different-module --full-auto exec "Different feature" ...
```

**Different Module/Feature Area**:
```bash
# First: Auth module
codex -C src/auth --full-auto exec "Auth implementation" ...

# Later: Payment module (NEW SESSION)
codex -C src/payment --full-auto exec "Payment implementation" ...
```

**No Recent Codex Task**:
```bash
# No Codex work in conversation history
codex -C project --full-auto exec "Fresh start" ...
```

## Session Continuity Best Practices

### Context References

**Use Session Context**:
```bash
codex --full-auto exec "
PURPOSE: Enhance previous implementation
TASK: Add caching to API endpoints
MODE: auto
CONTEXT: Previous API implementation from current session
EXPECTED: Cached endpoints with Redis integration
RULES: Maintain existing patterns
" resume --last --skip-git-repo-check -s danger-full-access
```

**Combine with File Patterns**:
```bash
codex --full-auto exec "
PURPOSE: Extend authentication
TASK: Add OAuth2 support
MODE: auto
CONTEXT: @{src/auth/**/*} Previous JWT implementation
EXPECTED: OAuth2 integration with existing auth
RULES: Maintain backward compatibility
" resume --last --skip-git-repo-check -s danger-full-access
```

### Multi-Phase Development

**Phase 1: Core Implementation**:
```bash
codex -C src/features --full-auto exec "
PURPOSE: New feature foundation
TASK: Implement core feature logic
MODE: auto
CONTEXT: @{src/core/**/*}
EXPECTED: Feature foundation with basic functionality
RULES: Follow existing patterns
" --skip-git-repo-check -s danger-full-access
```

**Phase 2: Enhancement** (resume session):
```bash
codex --full-auto exec "
PURPOSE: Feature enhancement
TASK: Add validation and error handling
MODE: auto
CONTEXT: Previous core implementation
EXPECTED: Robust feature with validation
RULES: Handle edge cases
" resume --last --skip-git-repo-check -s danger-full-access
```

**Phase 3: Testing** (resume session):
```bash
codex --full-auto exec "
PURPOSE: Test coverage
TASK: Generate comprehensive tests
MODE: write
CONTEXT: Previous implementation with validations
EXPECTED: Test suite with 90%+ coverage
RULES: Test edge cases and error paths
" resume --last --skip-git-repo-check -s danger-full-access
```

**Phase 4: Documentation** (resume session):
```bash
codex --full-auto exec "
PURPOSE: Feature documentation
TASK: Generate API documentation and usage examples
MODE: write
CONTEXT: Complete implementation with tests
EXPECTED: Comprehensive documentation
RULES: Include code examples
" resume --last --skip-git-repo-check -s danger-full-access
```

## Interactive Session Management

### Session Picker

```bash
# Show all available sessions
codex resume

# User selects from list:
# 1. Feature X implementation (2024-10-17 14:30)
# 2. Bug fix Y (2024-10-17 13:15)
# 3. Test generation Z (2024-10-17 12:00)
```

### Direct Resume

```bash
# Resume most recent session immediately
codex resume --last

# Continue work without picker
```

## Session Context Optimization

### Effective Context References

**Good - Specific and Relevant**:
```bash
CONTEXT: @{src/auth/**/*} Previous JWT implementation, session management patterns
```

**Better - Combines Session and Files**:
```bash
CONTEXT: Previous auth implementation from current session, @{src/auth/**/*,src/middleware/**/*}
```

**Best - Precise and Memory-Aware**:
```bash
CONTEXT: JWT middleware from previous task, @{src/auth/jwt.ts,src/auth/middleware.ts} Token validation patterns
```

### Context Continuity Patterns

**Reference Previous Work**:
```bash
CONTEXT: Previous implementation of user registration
TASK: Add email verification to registration flow
```

**Build on Established Patterns**:
```bash
CONTEXT: Authentication patterns from session, existing middleware structure
TASK: Create authorization middleware following auth patterns
```

**Maintain Consistency**:
```bash
CONTEXT: API design from previous endpoints, established response format
TASK: Create new endpoint following existing design
```

## Common Session Patterns

### Feature Development Cycle

```bash
# 1. Implement → 2. Enhance → 3. Test → 4. Document

# Implement (start session)
codex -C src --full-auto exec "Implement feature" ...

# Enhance (resume)
codex --full-auto exec "Add validations" resume --last ...

# Test (resume)
codex --full-auto exec "Generate tests" resume --last ...

# Document (resume)
codex --full-auto exec "Write docs" resume --last ...
```

### Bug Fix Cycle

```bash
# 1. Identify → 2. Fix → 3. Test → 4. Verify

# Identify (start session)
codex -C src --full-auto exec "Analyze bug" ...

# Fix (resume)
codex --full-auto exec "Implement fix" resume --last ...

# Test (resume)
codex --full-auto exec "Add regression tests" resume --last ...

# Verify (resume)
codex --full-auto exec "Verify fix across codebase" resume --last ...
```

### Refactoring Cycle

```bash
# 1. Analyze → 2. Plan → 3. Refactor → 4. Test

# Analyze (start session)
codex -C src --full-auto exec "Analyze code for refactoring" ...

# Plan (resume)
codex --full-auto exec "Plan refactoring approach" resume --last ...

# Refactor (resume)
codex --full-auto exec "Execute refactoring" resume --last ...

# Test (resume)
codex --full-auto exec "Verify refactoring with tests" resume --last ...
```

## Session Memory Management

### What Gets Preserved

**Implementation Context**:
- Code changes made
- Files created/modified
- Patterns established
- Decisions made

**Design Context**:
- Architecture decisions
- Pattern choices
- Interface designs
- Integration points

**Problem Context**:
- Issues identified
- Solutions attempted
- Trade-offs considered
- Edge cases handled

### What Gets Lost

**Starting New Session**:
- Previous implementation details
- Design decisions
- Context from prior work

**When to Accept Context Loss**:
- Switching to unrelated module
- Starting independent feature
- Different problem domain
- Fresh approach needed

## Troubleshooting

### Session Not Found

**Symptom**: `resume --last` fails to find session

**Solutions**:
- Use `codex resume` to see available sessions
- Start new session if none relevant
- Check if previous task completed

### Wrong Session Resumed

**Symptom**: Resumed session from different feature

**Solutions**:
- Use `codex resume` for manual selection
- Check conversation history for last Codex task
- Start new session if incorrect context

### Context Mismatch

**Symptom**: Session context doesn't match current task

**Solutions**:
- Start new session for unrelated work
- Include explicit CONTEXT to override
- Use file patterns to focus context

## Advanced Patterns

### Parallel Session Management

```bash
# Feature A - Session 1
codex -C src/feature-a --full-auto exec "Implement A" ...

# Feature B - Session 2 (different session)
codex -C src/feature-b --full-auto exec "Implement B" ...

# Resume Feature A
codex --full-auto exec "Enhance A" resume --last ...
# Note: This resumes most recent (Feature B), not Feature A
# Use interactive picker: codex resume
```

### Session Branch Pattern

```bash
# Main implementation
codex -C src --full-auto exec "Main feature" ...

# Branch 1: Enhancement (resume)
codex --full-auto exec "Add feature X" resume --last ...

# Branch 2: Alternative approach (new session)
codex -C src --full-auto exec "Try approach Y" ...
```

### Session Merge Pattern

```bash
# Component A
codex -C src/components --full-auto exec "Create component A" ...

# Component B (new session)
codex -C src/components --full-auto exec "Create component B" ...

# Integration (new session, references both)
codex -C src --full-auto exec "
CONTEXT: Component A and B from previous work
TASK: Integrate components
" ...
```
