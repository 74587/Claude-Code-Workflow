---
name: update-memory-full
description: Complete project-wide CLAUDE.md documentation update
usage: /update-memory-full
examples:
  - /update-memory-full                      # Full project documentation update
---

### 🚀 Command Overview: `/update-memory-full`

Complete project-wide documentation update using depth-parallel execution.

### 📝 Execution Template

```bash
#!/bin/bash
# Complete project-wide CLAUDE.md documentation update

# Step 1: Cache git changes
Bash(git add -A 2>/dev/null || true)

# Step 2: Get and display project structure
modules=$(Bash(~/.claude/scripts/get_modules_by_depth.sh list))
count=$(echo "$modules" | wc -l)

# Step 3: Analysis handover → Model takes control
# BASH_EXECUTION_STOPS → MODEL_ANALYSIS_BEGINS

# Pseudocode flow:
# IF (module_count > 20 OR complex_project_detected):
#     → Task "Complex project full update" subagent_type: "memory-gemini-bridge"
# ELSE:
#     → Present plan and WAIT FOR USER APPROVAL before execution
```

### 🧠 Model Analysis Phase

After the bash script completes the initial analysis, the model takes control to:

1. **Analyze Complexity**: Review module count and project context
2. **Parse CLAUDE.md Status**: Extract which modules have/need CLAUDE.md files
3. **Choose Strategy**: 
   - Simple projects: Present execution plan with CLAUDE.md paths to user
   - Complex projects: Delegate to memory-gemini-bridge agent
4. **Present Detailed Plan**: Show user exactly which CLAUDE.md files will be created/updated
5. **⚠️ CRITICAL: WAIT FOR USER APPROVAL**: No execution without explicit user consent

### 📋 Execution Strategies

**For Simple Projects (≤20 modules):**

Model will present detailed plan:
```
📋 Update Plan:
  NEW CLAUDE.md files (X):
    - ./src/components/CLAUDE.md
    - ./src/services/CLAUDE.md
  
  UPDATE existing CLAUDE.md files (Y):
    - ./CLAUDE.md
    - ./src/CLAUDE.md
    - ./tests/CLAUDE.md

  Total: N CLAUDE.md files will be processed
  
  ⚠️ Confirm execution? (y/n)
```

```pseudo
# ⚠️ MANDATORY: User confirmation → MUST await explicit approval  
IF user_explicitly_confirms():
    continue_execution()
ELSE:
    abort_execution()

# Step 4: Organize modules by depth → Prepare execution
depth_modules = organize_by_depth(modules)

# Step 5: Execute depth-parallel updates → Process by depth
FOR depth FROM max_depth DOWN TO 0:
    FOR each module IN depth_modules[depth]:
        WHILE active_jobs >= 4: wait(0.1)
        Bash(~/.claude/scripts/update_module_claude.sh "$module" "full" &)
    wait_all_jobs()

# Step 6: Display changes → Final status
Bash(git status --short)
```

**For Complex Projects (>20 modules):**
The model will delegate to the memory-gemini-bridge agent using the Task tool:
```
Task "Complex project full update"
prompt: "Execute full documentation update for [count] modules using depth-parallel execution"
subagent_type: "memory-gemini-bridge"
```


### 📚 Usage Examples

```bash
# Complete project documentation refresh
/update-memory-full

# After major architectural changes
/update-memory-full
```

### ✨ Features

- **Separated Commands**: Each bash operation is a discrete, trackable step
- **Intelligent Complexity Detection**: Model analyzes project context for optimal strategy
- **Depth-Parallel Execution**: Same depth modules run in parallel, depths run sequentially
- **Git Integration**: Auto-cache changes before, show status after
- **Module Detection**: Uses get_modules_by_depth.sh for structure discovery
- **User Confirmation**: Clear plan presentation with approval step
- **CLAUDE.md Only**: Only updates documentation, never source code