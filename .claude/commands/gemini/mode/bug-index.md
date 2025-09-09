---
name: bug-index
description: Bug analysis and fix suggestions using specialized template
usage: /gemini:mode:bug-index "bug description"
argument-hint: "description of the bug or error you're experiencing"
examples:
  - /gemini:mode:bug-index "authentication null pointer error in login flow"
  - /gemini:mode:bug-index "React component not re-rendering after state change"
  - /gemini:mode:bug-index "database connection timeout in production"
allowed-tools: Bash(gemini:*)
model: sonnet
---

# Bug Analysis Command (/gemini:mode:bug-index)

## Overview
Systematic bug analysis and fix suggestions using expert diagnostic template.

## Usage

### Basic Bug Analysis
```bash
/gemini:mode:bug-index "authentication error during login"
```

### With All Files Context
```bash
/gemini:mode:bug-index "React state not updating" --all-files
```

### Save to Workflow Session
```bash
/gemini:mode:bug-index "API timeout issues" --save-session
```

## Command Execution

**Template Used**: `~/.claude/prompt-templates/bug-fix.md`

**Executes**:
```bash
gemini --all-files -p "$(cat ~/.claude/prompt-templates/bug-fix.md)

Context: @{CLAUDE.md,**/*CLAUDE.md}

Bug Description: [user_description]"
```

## Analysis Focus

The bug-fix template provides:
- **Root Cause Analysis**: Systematic investigation
- **Code Path Tracing**: Following execution flow  
- **Targeted Solutions**: Specific, minimal fixes
- **Impact Assessment**: Understanding side effects

## Options

| Option | Purpose |
|--------|---------|
| `--all-files` | Include entire codebase for analysis |
| `--save-session` | Save analysis to workflow session |

## Session Output

When `--save-session` used, saves to:
`.workflow/WFS-[topic]/.chat/bug-index-[timestamp].md`

**Includes:**
- Bug description
- Template used  
- Analysis results
- Recommended actions