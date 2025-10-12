---
name: update-memory-full
description: Complete project-wide CLAUDE.md documentation update
argument-hint: "[--tool gemini|qwen|codex]"
---

### 🚀 Command Overview: `/update-memory-full`

Complete project-wide documentation update using depth-parallel execution.

**Tool Selection**:
- **Gemini (default)**: Documentation generation, pattern recognition, architecture review
- **Qwen**: Architecture analysis, system design documentation
- **Codex**: Implementation validation, code quality analysis

### 📝 Execution Template

```bash
#!/bin/bash
# Complete project-wide CLAUDE.md documentation update

# Step 1: Parse tool selection (default: gemini)
tool="gemini"
[[ "$*" == *"--tool qwen"* ]] && tool="qwen"
[[ "$*" == *"--tool codex"* ]] && tool="codex"

# Step 2: Code Index architecture analysis
mcp__code-index__search_code_advanced(pattern="class|function|interface", file_pattern="**/*.{ts,js,py}")
mcp__code-index__find_files(pattern="**/*.{md,json,yaml,yml}")

# Step 3: Cache git changes
Bash(git add -A 2>/dev/null || true)

# Step 4: Get and display project structure
modules=$(Bash(~/.claude/scripts/get_modules_by_depth.sh list))
count=$(echo "$modules" | wc -l)

# Step 5: Analysis handover → Model takes control
# BASH_EXECUTION_STOPS → MODEL_ANALYSIS_BEGINS

# Pseudocode flow:
# IF (module_count > 20 OR complex_project_detected):
#     → Task "Complex project full update" subagent_type: "memory-bridge"
# ELSE:
#     → Present plan and WAIT FOR USER APPROVAL before execution
#
# Pass tool parameter to update_module_claude.sh: "$tool"
```

### 🧠 Model Analysis Phase

After the bash script completes the initial analysis, the model takes control to:

1. **Analyze Complexity**: Review module count and project context
2. **Parse CLAUDE.md Status**: Extract which modules have/need CLAUDE.md files
3. **Choose Strategy**:
   - Simple projects: Present execution plan with CLAUDE.md paths to user
   - Complex projects: Delegate to memory-bridge agent
4. **Present Detailed Plan**: Show user exactly which CLAUDE.md files will be created/updated
5. **⚠️ CRITICAL: WAIT FOR USER APPROVAL**: No execution without explicit user consent

### 📋 Execution Strategies

**For Simple Projects (≤20 modules):**

Model will present detailed plan:
```
📋 Update Plan:
  Tool: [gemini|qwen|codex] (from --tool parameter)

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
        Bash(~/.claude/scripts/update_module_claude.sh "$module" "full" "$tool" &)
    wait_all_jobs()

# Step 6: Safety check and restore staging state
non_claude=$(Bash(git diff --cached --name-only | grep -v "CLAUDE.md" || true))
if [ -n "$non_claude" ]; then
    Bash(git restore --staged .)
    echo "⚠️ Warning: Non-CLAUDE.md files were modified, staging reverted"
    echo "Modified files: $non_claude"
else
    echo "✅ Only CLAUDE.md files modified, staging preserved"
fi

# Step 7: Display changes → Final status
Bash(git status --short)
```

**For Complex Projects (>20 modules):**

The model will delegate to the memory-bridge agent with structured context:

```javascript
Task "Complex project full update"
subagent_type: "memory-bridge"
prompt: `
CONTEXT:
- Total modules: ${module_count}
- Tool: ${tool}  // from --tool parameter, default: gemini
- Mode: full
- Existing CLAUDE.md: ${existing_count}
- New CLAUDE.md needed: ${new_count}

MODULE LIST:
${modules_output}  // Full output from get_modules_by_depth.sh list

REQUIREMENTS:
1. Use TodoWrite to track each depth level before execution
2. Process depths 5→0 sequentially, max 4 parallel jobs per depth
3. Command format: update_module_claude.sh "<path>" "full" "${tool}" &
4. Extract exact path from "depth:N|path:<PATH>|..." format
5. Verify all ${module_count} modules are processed
6. Run safety check after completion
7. Display git status

Execute depth-parallel updates for all modules.
`
```

**Agent receives complete context:**
- Module count and tool selection
- Full structured module list
- Clear execution requirements
- Path extraction format
- Success criteria


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
- **Git Integration**: Auto-cache changes before, safety check and show status after
- **Safety Protection**: Automatic detection and revert of unintended source code modifications
- **Module Detection**: Uses get_modules_by_depth.sh for structure discovery
- **User Confirmation**: Clear plan presentation with approval step
- **CLAUDE.md Only**: Only updates documentation, never source code