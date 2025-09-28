---
name: bug-index
description: Bug analysis and fix suggestions using specialized template
usage: /qwen:mode:bug-index "bug description"
argument-hint: "description of the bug or error you're experiencing"
examples:
  - /qwen:mode:bug-index "authentication null pointer error in login flow"
  - /qwen:mode:bug-index "React component not re-rendering after state change"
  - /qwen:mode:bug-index "database connection timeout in production"
allowed-tools: Bash(qwen:*)
model: sonnet
---

# Bug Analysis Command (/qwen:mode:bug-index)

## Overview
Systematic bug analysis and fix suggestions using expert diagnostic template.

**Directory Analysis Rule**: Intelligent detection of directory context intent - automatically navigate to target directory when analysis scope is directory-specific.

**--cd Parameter Rule**: When `--cd` parameter is provided, always execute `cd "[path]" && qwen --all-files -p "prompt"` to ensure analysis occurs in the specified directory context.

## Usage

### Basic Bug Analysis
```bash
/qwen:mode:bug-index "authentication null pointer error"
```

### Bug Analysis with Directory Context
```bash
/qwen:mode:bug-index "authentication error" --cd "src/auth"
```


### Save to Workflow Session
```bash
/qwen:mode:bug-index "API timeout issues" --save-session
```

## Command Execution

**Template Used**: `~/.claude/prompt-templates/bug-fix.md`

**Executes**:
```bash
# Basic usage
qwen --all-files -p "$(cat ~/.claude/prompt-templates/bug-fix.md)

Bug Description: [user_description]"

# With --cd parameter
cd "[specified_directory]" && qwen --all-files -p "$(cat ~/.claude/prompt-templates/bug-fix.md)

Bug Description: [user_description]"
```

## Analysis Focus

The bug-fix template provides:
- **Root Cause Analysis**: Systematic investigation
- **Code Path Tracing**: Following execution flow  
- **Targeted Solutions**: Specific, minimal fixes
- **Impact Assessment**: Understanding side effects


## Session Output

saves to:
`.workflow/WFS-[topic]/.chat/bug-index-[timestamp].md`

**Includes:**
- Bug description
- Template used  
- Analysis results
- Recommended actions