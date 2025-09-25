---
name: plan-precise
description: Precise path planning analysis for complex projects
usage: /qwen:mode:plan-precise "planning topic"
examples:
  - /qwen:mode:plan-precise "design authentication system"
  - /qwen:mode:plan-precise "refactor database layer architecture"
---

### 🚀 Command Overview: `/qwen:mode:plan-precise`

Precise path-based planning analysis using user-specified directories instead of --all-files.

### 📝 Execution Template

```pseudo
# Precise path planning with user-specified scope

PLANNING_TOPIC = user_argument
PATHS_FILE = "./planning-paths.txt"

# Step 1: Check paths file exists
IF not file_exists(PATHS_FILE):
    Write(PATHS_FILE, template_content)
    echo "📝 Created planning-paths.txt in project root"
    echo "Please edit file and add paths to analyze"
    # USER_INPUT: User edits planning-paths.txt and presses Enter
    wait_for_user_input()
ELSE:
    echo "📁 Using existing planning-paths.txt"
    echo "Current paths preview:"
    Bash(grep -v '^#' "$PATHS_FILE" | grep -v '^$' | head -5)
    # USER_INPUT: User confirms y/n
    user_confirm = prompt("Continue with these paths? (y/n): ")
    IF user_confirm != "y":
        echo "Please edit planning-paths.txt and retry"
        exit

# Step 2: Read and validate paths
paths_ref = Bash(.claude/scripts/read-paths.sh "$PATHS_FILE")

IF paths_ref is empty:
    echo "❌ No valid paths found in planning-paths.txt"
    echo "Please add at least one path and retry"
    exit

echo "🎯 Analysis paths: $paths_ref"
echo "📋 Planning topic: $PLANNING_TOPIC"

# BASH_EXECUTION_STOPS → MODEL_ANALYSIS_BEGINS
```

### 🧠 Model Analysis Phase

After bash script prepares paths, model takes control to:

1. **Present Configuration**: Show user the detected paths and analysis scope
2. **Request Confirmation**: Wait for explicit user approval  
3. **Execute Analysis**: Run qwen with precise path references

### 📋 Execution Flow

```pseudo
# Step 1: Present plan to user
PRESENT_PLAN:
  📋 Precise Path Planning Configuration:
  
  Topic: design authentication system
  Paths: src/auth/**/* src/middleware/auth* tests/auth/**/* config/auth.json
  qwen Reference: $(.claude/scripts/read-paths.sh ./planning-paths.txt)
  
  ⚠️ Continue with analysis? (y/n)

# Step 2: MANDATORY user confirmation  
IF user_confirms():
    # Step 3: Execute qwen analysis
    Bash(qwen -p "$(.claude/scripts/read-paths.sh ./planning-paths.txt) @{CLAUDE.md} $(cat ~/.claude/prompt-templates/plan.md)

Planning Topic: $PLANNING_TOPIC")
ELSE:
    abort_execution()
    echo "Edit planning-paths.txt and retry"
```

### ✨ Features

- **Root Level Config**: `./planning-paths.txt` in project root (no subdirectories)
- **Simple Workflow**: Check file → Present plan → Confirm → Execute  
- **Path Focused**: Only analyzes user-specified paths, not entire project
- **No Complexity**: No validation, suggestions, or result saving - just core function
- **Template Creation**: Auto-creates template file if missing

### 📚 Usage Examples

```bash
# Create analysis for authentication system
/qwen:mode:plan-precise "design authentication system"

# System creates planning-paths.txt (if needed)
# User edits: src/auth/**/* tests/auth/**/* config/auth.json  
# System confirms paths and executes analysis
```

### 🔍 Complete Execution Example

```bash
# 1. Command execution
$ /qwen:mode:plan-precise "design authentication system"

# 2. System output
📋 Precise Path Planning Configuration:

Topic: design authentication system
Paths: src/auth/**/* src/middleware/auth* tests/auth/**/* config/auth.json
qwen Reference: @{src/auth/**/*,src/middleware/auth*,tests/auth/**/*,config/auth.json}

⚠️ Continue with analysis? (y/n)

# 3. User confirms
$ y

# 4. Actual qwen command executed
$ qwen -p "$(.claude/scripts/read-paths.sh ./planning-paths.txt) @{CLAUDE.md} $(cat ~/.claude/prompt-templates/plan.md)

Planning Topic: design authentication system"
```

### 🔧 Path File Format

Simple text file in project root: `./planning-paths.txt`

```
# Comments start with #
src/auth/**/*
src/middleware/auth*  
tests/auth/**/*
config/auth.json
docs/auth/*.md
```

