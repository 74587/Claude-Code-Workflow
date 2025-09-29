---
name: test-gen
description: Generate comprehensive test workflow based on completed implementation tasks
usage: /workflow:test-gen [session-id]
argument-hint: "WFS-session-id"
examples:
  - /workflow:test-gen
  - /workflow:test-gen WFS-user-auth
---

# Workflow Test Generation Command

## Overview
Analyzes completed implementation sessions and generates comprehensive test requirements, then calls workflow:plan to create test workflow.

## Usage
```bash
/workflow:test-gen                # Auto-detect active session
/workflow:test-gen WFS-session-id # Analyze specific session
```

## Dynamic Session ID Resolution

The `${SESSION_ID}` variable is dynamically resolved based on:

1. **Command argument**: If session-id provided as argument, use it directly
2. **Auto-detection**: If no argument, detect from active session markers
3. **Format**: Always in format `WFS-session-name`

```bash
# Example resolution logic:
# If argument provided: SESSION_ID = "WFS-user-auth"
# If no argument: SESSION_ID = $(find .workflow/ -name '.active-*' | head -1 | sed 's/.*active-//')
```

## Implementation Flow

### Step 1: Identify Target Session
```bash
# Auto-detect active session (if no session-id provided)
find .workflow/ -name '.active-*' | head -1 | sed 's/.*active-//'

# Use provided session-id or detected session-id
# SESSION_ID = provided argument OR detected active session
```

### Step 2: Get Session Start Time
```bash
cat .workflow/WFS-${SESSION_ID}/workflow-session.json | jq -r .created_at
```

### Step 3: Git Change Analysis (using session start time)
```bash
git log --since="$(cat .workflow/WFS-${SESSION_ID}/workflow-session.json | jq -r .created_at)" --name-only --pretty=format: | sort -u | grep -v '^$'
```

### Step 4: Filter Code Files
```bash
git log --since="$(cat .workflow/WFS-${SESSION_ID}/workflow-session.json | jq -r .created_at)" --name-only --pretty=format: | sort -u | grep -E '\.(js|ts|jsx|tsx|py|java|go|rs)$'
```

### Step 5: Load Session Context
```bash
cat .workflow/WFS-${SESSION_ID}/.summaries/IMPL-*-summary.md 2>/dev/null
```

### Step 6: Extract Focus Paths
```bash
find .workflow/WFS-${SESSION_ID}/.task/ -name '*.json' -exec jq -r '.context.focus_paths[]?' {} \;
```

### Step 7: Gemini Analysis and Planning Document Generation
```bash
cd project-root && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Analyze implementation and generate comprehensive test planning document
TASK: Review changed files and implementation context to create detailed test planning document
CONTEXT: Changed files: [changed_files], Implementation summaries: [impl_summaries], Focus paths: [focus_paths]
EXPECTED: Complete test planning document including:
- Test strategy analysis
- Critical test scenarios identification
- Edge cases and error conditions
- Test priority matrix
- Resource requirements
- Implementation approach recommendations
- Specific test cases with acceptance criteria
RULES: Generate structured markdown document suitable for workflow planning. Focus on actionable test requirements based on actual implementation changes.
" > .workflow/WFS-${SESSION_ID}/.process/GEMINI_TEST_PLAN.md
```

### Step 8: Generate Combined Test Requirements Document
```bash
mkdir -p .workflow/WFS-${SESSION_ID}/.process
```

```bash
cat > .workflow/WFS-${SESSION_ID}/.process/TEST_REQUIREMENTS.md << 'EOF'
# Test Requirements Summary for WFS-${SESSION_ID}

## Analysis Data Sources
- Git change analysis results
- Implementation summaries and context
- Gemini-generated test planning document

## Reference Documents
- Detailed test plan: GEMINI_TEST_PLAN.md
- Implementation context: IMPL-*-summary.md files

## Integration Note
This document combines analysis data with Gemini-generated planning document for comprehensive test workflow generation.
EOF
```

### Step 9: Call Workflow Plan with Gemini Planning Document
```bash
/workflow:plan .workflow/WFS-${SESSION_ID}/.process/GEMINI_TEST_PLAN.md
```

## Simple Bash Commands

### Basic Operations
- **Find active session**: `find .workflow/ -name '.active-*'`
- **Get git changes**: `git log --since='date' --name-only`
- **Filter code files**: `grep -E '\.(js|ts|py)$'`
- **Load summaries**: `cat .workflow/WFS-*/summaries/*.md`
- **Extract JSON data**: `jq -r '.context.focus_paths[]'`
- **Create directory**: `mkdir -p .workflow/session/.process`
- **Write file**: `cat > file << 'EOF'`

### Gemini CLI Integration
- **Planning command**: `~/.claude/scripts/gemini-wrapper -p "prompt" > GEMINI_TEST_PLAN.md`
- **Context loading**: Include changed files and implementation context
- **Document generation**: Creates comprehensive test planning document
- **Direct handoff**: Pass Gemini planning document to workflow:plan

## No Complex Logic
- No variables or functions
- No conditional statements
- No loops or complex pipes
- Direct bash commands only
- Gemini CLI for intelligent analysis

## Related Commands
- `/workflow:plan` - Called to generate test workflow
- `/workflow:execute` - Executes generated test tasks
- `/workflow:status` - Shows test workflow progress