---
name: bug-index
description: Bug analysis, debugging, and automated fix implementation using Codex
usage: /codex:mode:bug-index "bug description"
argument-hint: "description of the bug or error you're experiencing"
examples:
  - /codex:mode:bug-index "authentication null pointer error in login flow"
  - /codex:mode:bug-index "React component not re-rendering after state change"
  - /codex:mode:bug-index "database connection timeout in production"
  - /codex:mode:bug-index "API endpoints returning 500 errors randomly"
allowed-tools: Bash(codex:*)
model: sonnet
---

# Bug Analysis & Fix Command (/codex:mode:bug-index)

## Overview
Systematic bug analysis, debugging, and automated fix implementation using expert diagnostic templates with Codex CLI.

**Core Guidelines**: @~/.claude/workflows/tools-implementation-guide.md

⚠️ **Critical Difference**: Codex has **NO `--all-files` flag** - you MUST use `@` patterns to reference files.

**Enhancement over Gemini**: Codex can **analyze AND implement fixes**, not just provide recommendations.

## Usage

### Basic Bug Analysis & Fix
```bash
/codex:mode:bug-index "authentication error during login"
```
**Executes**: `codex --full-auto exec "@{**/*auth*,**/*login*} @{CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/development/debugging.txt)" -s danger-full-access`

### Comprehensive Bug Investigation
```bash
/codex:mode:bug-index "React state not updating in dashboard"
```
**Executes**: `codex --full-auto exec "@{src/**/*.{jsx,tsx},**/*dashboard*} @{CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/development/debugging.txt)" -s danger-full-access`

### Production Error Analysis
```bash
/codex:mode:bug-index "API timeout issues in production environment"
```
**Executes**: `codex --full-auto exec "@{**/api/**/*,*.config.*} @{CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/development/debugging.txt)" -s danger-full-access`

## Codex-Specific Debugging Patterns

**Essential File Patterns** (Required for effective debugging):
```bash
@{**/*error*,**/*bug*}     # Error-related files
@{src/**/*}               # Source code for bug analysis
@{**/logs/**/*}           # Log files for error traces
@{test/**/*,**/*.test.*}   # Tests to understand expected behavior
@{CLAUDE.md,**/*CLAUDE.md} # Project guidelines
@{*.config.*,package.json} # Configuration for environment issues
```

## Command Execution

**Debugging Template Used**: `~/.claude/workflows/cli-templates/prompts/development/debugging.txt`

**Executes**:
```bash
codex exec "@{inferred_bug_patterns} @{CLAUDE.md,**/*CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/development/debugging.txt)

Context: Comprehensive codebase analysis for bug investigation
Bug Description: [user_description]
Fix Implementation: Provide working code solutions" -s danger-full-access
```

## Bug Pattern Inference

**Auto-detects relevant files based on bug description:**

| Bug Keywords | Inferred Patterns | Focus Area |
|-------------|------------------|------------|
| "auth", "login", "token" | `@{**/*auth*,**/*user*,**/*login*}` | Authentication code |
| "React", "component", "render" | `@{src/**/*.{jsx,tsx}}` | React components |
| "API", "endpoint", "server" | `@{**/api/**/*,**/routes/**/*}` | Backend code |
| "database", "db", "query" | `@{**/models/**/*,**/db/**/*}` | Database code |
| "timeout", "connection" | `@{*.config.*,**/*config*}` | Configuration issues |
| "test", "spec" | `@{test/**/*,**/*.test.*}` | Test-related bugs |
| "build", "compile" | `@{*.config.*,package.json,webpack.*}` | Build issues |
| "style", "css", "layout" | `@{**/*.{css,scss,sass}}` | Styling bugs |

## Analysis & Fix Focus

### Comprehensive Bug Analysis Provides:
- **Root Cause Analysis**: Systematic investigation with file:line references
- **Code Path Tracing**: Following execution flow through the codebase
- **Error Pattern Detection**: Identifying similar issues across the codebase
- **Context Understanding**: Leveraging existing code patterns
- **Impact Assessment**: Understanding potential side effects of fixes

### Codex Enhancement - Automated Fixes:
- **Working Code Solutions**: Actual implementation fixes
- **Multiple Fix Options**: Different approaches with trade-offs
- **Test Case Generation**: Tests to prevent regression
- **Configuration Updates**: Environment and config fixes
- **Documentation Updates**: Updated comments and documentation

## Debugging Templates & Approaches

### Error Investigation
```bash
# Uses: debugging.txt template for systematic analysis
/codex:mode:bug-index "null pointer exception in user service"
# Provides: Stack trace analysis, variable state inspection, fix implementation
```

### Performance Bug Analysis
```bash
# Uses: debugging.txt + performance.txt combination
/codex:mode:bug-index "slow database queries causing timeout"
# Provides: Query optimization, indexing suggestions, connection pool fixes
```

### Integration Bug Fixes
```bash
# Uses: debugging.txt + integration/api-design.txt
/codex:mode:bug-index "third-party API integration failing randomly"
# Provides: Error handling, retry logic, fallback implementations
```

## Options

| Option | Purpose |
|--------|---------|
| `--comprehensive` | Use `@{**/*}` for complete codebase analysis |
| `--save-session` | Save bug analysis and fixes to workflow session |
| `--implement-fix` | Auto-implement the recommended fix (default in Codex) |
| `--generate-tests` | Create tests to prevent regression |
| `--debug-mode` | Verbose debugging output with pattern explanations |

### Comprehensive Debugging
```bash
/codex:mode:bug-index "intermittent authentication failures" --comprehensive
# Uses: @{**/*} for complete system analysis
```

### Bug Fix with Testing
```bash
/codex:mode:bug-index "user registration validation errors" --generate-tests
# Provides: Bug fix + comprehensive test suite
```

## Session Output

When `--save-session` used, saves to:
`.workflow/WFS-[topic]/.chat/bug-index-[timestamp].md`

**Session includes:**
- Bug description and symptoms
- File patterns used for analysis
- Root cause analysis with evidence
- Implemented fix with code changes
- Test cases to prevent regression
- Monitoring and prevention recommendations

## Debugging Output Structure

### Bug Analysis Template Output:
```markdown
# Bug Analysis: [Description]

## Problem Investigation
- Symptoms and error messages
- Affected components and files
- Reproduction steps

## Root Cause Analysis
- Code path analysis with file:line references
- Variable states and data flow
- Configuration and environment factors

## Implemented Fixes
- Primary solution with code changes
- Alternative approaches considered
- Trade-offs and design decisions

## Testing & Validation
- Test cases to verify fix
- Regression prevention tests
- Performance impact assessment

## Monitoring & Prevention
- Error handling improvements
- Logging enhancements  
- Code quality improvements
```

## Context-Aware Bug Fixing

### Existing Pattern Integration
```bash
/codex:mode:bug-index "authentication middleware not working"
# Analyzes existing auth patterns in codebase
# Implements fix consistent with current architecture
# Updates related middleware to match patterns
```

### Technology Stack Compatibility
```bash
/codex:mode:bug-index "React hooks causing infinite renders"
# Reviews current React version and patterns
# Implements fix using appropriate hooks API
# Updates other components with similar issues
```

## Advanced Debugging Features

### Multi-File Bug Tracking
```bash
/codex:mode:bug-index "user data inconsistency between frontend and backend"
# Analyzes both frontend and backend code
# Identifies data flow discrepancies  
# Implements synchronized fixes across stack
```

### Production Issue Investigation
```bash
/codex:mode:bug-index "memory leak in production server"
# Reviews server code and configuration
# Analyzes log patterns and resource usage
# Implements monitoring and leak prevention
```

### Error Handling Enhancement
```bash
/codex:mode:bug-index "unhandled promise rejections causing crashes"
# Identifies all async operations without error handling
# Implements comprehensive error handling strategy
# Adds logging and monitoring for similar issues
```

## Bug Prevention Features

- **Pattern Analysis**: Identifies similar bugs across codebase
- **Code Quality Improvements**: Suggests structural improvements
- **Error Handling Enhancement**: Adds robust error handling
- **Test Coverage**: Creates tests to prevent similar issues
- **Documentation Updates**: Improves code documentation

## Codex vs Gemini Bug Analysis

| Feature | Codex Bug-Index | Gemini Bug-Index |
|---------|-----------------|------------------|
| File Context | `@` patterns **required** | `--all-files` available |
| Output | Analysis + working fixes | Analysis + recommendations |
| Implementation | Automatic code changes | Manual implementation needed |
| Testing | Auto-generates test cases | Suggests testing approach |
| Integration | Updates related code | Focuses on specific bug |

## Workflow Integration

### Bug Fixing Workflow
```bash
# 1. Analyze and fix the bug
/codex:mode:bug-index "user login failing with token errors"

# 2. Review the implemented changes
/workflow:review

# 3. Execute any additional tasks identified
/codex:execute "implement additional error handling for edge cases"
```

For detailed syntax, patterns, and advanced usage see:
**@~/.claude/workflows/tools-implementation-guide.md**