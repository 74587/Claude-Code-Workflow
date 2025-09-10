---
name: update-memory-related
description: Context-aware CLAUDE.md documentation updates based on recent changes
usage: /update-memory-related
examples:
  - /update-memory-related                    # Update documentation based on recent changes
---

### 🚀 Command Overview: `/update-memory-related`

Context-aware documentation update for modules affected by recent changes.


### 📝 Execution Template

```bash
#!/bin/bash
# Context-aware CLAUDE.md documentation update

# Step 1: Cache git changes
Bash(git add -A 2>/dev/null || true)

# Step 2: Detect changed modules  
changed=$(Bash(~/.claude/scripts/detect_changed_modules.sh list))
if [ -z "$changed" ]; then
    changed=$(Bash(~/.claude/scripts/get_modules_by_depth.sh list | head -10))
fi
count=$(echo "$changed" | wc -l)

# Step 3: Analysis handover → Model takes control  
# BASH_EXECUTION_STOPS → MODEL_ANALYSIS_BEGINS

# Pseudocode flow:
# IF (change_count > 15 OR complex_changes_detected):
#     → Task "Complex project related update" subagent_type: "memory-gemini-bridge"
# ELSE:
#     → Present plan and WAIT FOR USER APPROVAL before execution
```

### 🧠 Model Analysis Phase

After the bash script completes change detection, the model takes control to:

1. **Analyze Changes**: Review change count and complexity  
2. **Parse CLAUDE.md Status**: Extract which changed modules have/need CLAUDE.md files
3. **Choose Strategy**: 
   - Simple changes: Present execution plan with CLAUDE.md paths to user
   - Complex changes: Delegate to memory-gemini-bridge agent
4. **Present Detailed Plan**: Show user exactly which CLAUDE.md files will be created/updated for changed modules
5. **⚠️ CRITICAL: WAIT FOR USER APPROVAL**: No execution without explicit user consent

### 📋 Execution Strategies

**For Simple Changes (≤15 modules):**

Model will present detailed plan for affected modules:
```
📋 Related Update Plan:
  CHANGED modules affecting CLAUDE.md:
  
  NEW CLAUDE.md files (X):
    - ./src/api/auth/CLAUDE.md  [new module]
    - ./src/utils/helpers/CLAUDE.md  [new module]
  
  UPDATE existing CLAUDE.md files (Y):
    - ./src/api/CLAUDE.md  [parent of changed auth/]
    - ./src/CLAUDE.md  [root level]

  Total: N CLAUDE.md files will be processed for recent changes
  
  ⚠️ Confirm execution? (y/n)
```

```pseudo
# ⚠️ MANDATORY: User confirmation → MUST await explicit approval
IF user_explicitly_confirms():
    continue_execution()
ELSE:
    abort_execution()

# Step 4: Organize modules by depth → Prepare execution
depth_modules = organize_by_depth(changed_modules)

# Step 5: Execute depth-parallel updates → Process by depth
FOR depth FROM max_depth DOWN TO 0:
    FOR each module IN depth_modules[depth]:
        WHILE active_jobs >= 4: wait(0.1)
        Bash(~/.claude/scripts/update_module_claude.sh "$module" "related" &)
    wait_all_jobs()

# Step 6: Display changes → Final status
Bash(git diff --stat)
```

**For Complex Changes (>15 modules):**
The model will delegate to the memory-gemini-bridge agent using the Task tool:
```
Task "Complex project related update"
prompt: "Execute context-aware update for [count] changed modules using depth-parallel execution"
subagent_type: "memory-gemini-bridge"
```


### 📚 Usage Examples

```bash
# Daily development update
/update-memory-related

# After feature work
/update-memory-related
```

### ✨ Features

- **Separated Commands**: Each bash operation is a discrete, trackable step
- **Intelligent Change Analysis**: Model analyzes change complexity for optimal strategy
- **Change Detection**: Automatically finds affected modules using git diff
- **Depth-Parallel Execution**: Same depth modules run in parallel, depths run sequentially  
- **Git Integration**: Auto-cache changes, show diff statistics after
- **Fallback Mode**: Updates recent files when no git changes found
- **User Confirmation**: Clear plan presentation with approval step
- **CLAUDE.md Only**: Only updates documentation, never source code