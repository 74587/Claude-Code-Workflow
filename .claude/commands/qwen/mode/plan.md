---
name: plan
description: Project planning and architecture analysis using qwen CLI with specialized template
usage: /qwen:mode:plan "planning topic"
argument-hint: "planning topic or architectural challenge to analyze"
examples:
  - /qwen:mode:plan "design user dashboard feature architecture"
  - /qwen:mode:plan "plan microservices migration strategy"
  - /qwen:mode:plan "implement real-time notification system"
allowed-tools: Bash(qwen:*)
model: sonnet
---

# Planning Analysis Command (/qwen:mode:plan)

## Overview
**This command uses qwen CLI for comprehensive project planning and architecture analysis.** It leverages qwen CLI's powerful codebase analysis capabilities combined with expert planning templates to provide strategic insights and implementation roadmaps.

### Key Features
- **qwen CLI Integration**: Utilizes qwen CLI's deep codebase analysis for informed planning decisions

**--cd Parameter Rule**: When `--cd` parameter is provided, always execute `cd "[path]" && qwen --all-files -p "prompt"` to ensure analysis occurs in the specified directory context.

## Usage

### Basic Usage
```bash
/qwen:mode:plan "design authentication system"
```

### Directory-Specific Analysis
```bash
/qwen:mode:plan "design authentication system" --cd "src/auth"
```

## Command Execution

**Smart Directory Detection**: Auto-detects relevant directories based on topic keywords 

**Executes**:
```bash
# Project-wide analysis
qwen --all-files -p "$(cat ~/.claude/prompt-templates/plan.md)
Planning Topic: [user_description]"

# Directory-specific analysis  
cd "[directory]" && qwen --all-files -p "$(cat ~/.claude/prompt-templates/plan.md)
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