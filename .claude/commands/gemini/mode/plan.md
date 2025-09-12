---
name: plan
description: Project planning and architecture analysis using Gemini CLI with specialized template
usage: /gemini:mode:plan "planning topic"
argument-hint: "planning topic or architectural challenge to analyze"
examples:
  - /gemini:mode:plan "design user dashboard feature architecture"
  - /gemini:mode:plan "plan microservices migration strategy"
  - /gemini:mode:plan "implement real-time notification system"
allowed-tools: Bash(gemini:*)
model: sonnet
---

# Planning Analysis Command (/gemini:mode:plan)

## Overview
**This command uses Gemini CLI for comprehensive project planning and architecture analysis.** It leverages Gemini CLI's powerful codebase analysis capabilities combined with expert planning templates to provide strategic insights and implementation roadmaps.

### Key Features
- **Gemini CLI Integration**: Utilizes Gemini CLI's deep codebase analysis for informed planning decisions

**--cd Parameter Rule**: When `--cd` parameter is provided, always execute `cd [path] && gemini --all-files -p "prompt"` to ensure analysis occurs in the specified directory context.

## Usage

### Basic Usage
```bash
/gemini:mode:plan "design authentication system"
```

### Directory-Specific Analysis
```bash
/gemini:mode:plan "design authentication system" --cd "src/auth"
```

## Command Execution

**Smart Directory Detection**: Auto-detects relevant directories based on topic keywords 

**Executes**:
```bash
# Project-wide analysis
gemini --all-files -p "$(cat ~/.claude/prompt-templates/plan.md)
Planning Topic: [user_description]"

# Directory-specific analysis  
cd [directory] && gemini --all-files -p "$(cat ~/.claude/prompt-templates/plan.md)
Planning Topic: [user_description]"
```


## Session Output

saves to:
`.workflow/WFS-[topic]/.chat/plan-[timestamp].md`

**Includes:**
- Planning topic
- Template used
- Analysis results  
- Implementation roadmap
- Key decisions