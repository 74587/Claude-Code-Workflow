---
name: plan
description: Project planning and architecture analysis using specialized template
usage: /gemini:pre:plan "planning topic"
argument-hint: "planning topic or architectural challenge to analyze"
examples:
  - /gemini:pre:plan "design user dashboard feature architecture"
  - /gemini:pre:plan "plan microservices migration strategy"
  - /gemini:pre:plan "implement real-time notification system"
allowed-tools: Bash(gemini:*)
model: sonnet
---

# Planning Analysis Command (/gemini:pre:plan)

## Overview
Comprehensive project planning and architecture analysis using expert planning template.

## Usage

### Basic Planning Analysis
```bash
/gemini:pre:plan "design authentication system"
```

### With All Files Context
```bash
/gemini:pre:plan "microservices migration" --all-files
```

### Save to Workflow Session
```bash
/gemini:pre:plan "real-time notifications" --save-session
```

## Command Execution

**Template Used**: `~/.claude/prompt-templates/plan.md`

**Executes**:
```bash
gemini --all-files -p "$(cat ~/.claude/prompt-templates/plan.md)

Context: @{CLAUDE.md,**/*CLAUDE.md}

Planning Topic: [user_description]"
```

## Planning Focus

The planning template provides:
- **Requirements Analysis**: Functional and non-functional requirements
- **Architecture Design**: System structure and interactions
- **Implementation Strategy**: Step-by-step development approach  
- **Risk Assessment**: Challenges and mitigation strategies
- **Resource Planning**: Time, effort, and technology needs

## Options

| Option | Purpose |
|--------|---------|
| `--all-files` | Include entire codebase for context |
| `--save-session` | Save analysis to workflow session |

## Session Output

When `--save-session` used, saves to:
`.workflow/WFS-[topic]/.chat/plan-[timestamp].md`

**Includes:**
- Planning topic
- Template used
- Analysis results  
- Implementation roadmap
- Key decisions