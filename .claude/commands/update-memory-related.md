---
name: update-memory-related
description: Context-aware CLAUDE.md documentation updates based on recent changes
argument-hint: "[--tool gemini|qwen|codex]"
---

### 🚀 Command Overview: `/update-memory-related`

Context-aware documentation update for modules affected by recent changes.

**Tool Selection**:
- **Gemini (default)**: Documentation generation, pattern recognition, architecture review
- **Qwen**: Architecture analysis, system design documentation
- **Codex**: Implementation validation, code quality analysis


### 📝 Execution Template

```bash
#!/bin/bash
# Context-aware CLAUDE.md documentation update

# Step 1: Parse tool selection (default: gemini)
tool="gemini"
[[ "$*" == *"--tool qwen"* ]] && tool="qwen"
[[ "$*" == *"--tool codex"* ]] && tool="codex"

# Step 2: Code Index refresh and architecture analysis
mcp__code-index__refresh_index()
mcp__code-index__search_code_advanced(pattern="class|function|interface", file_pattern="**/*.{ts,js,py}")

# Step 3: Detect changed modules (before staging)
changed=$(Bash(~/.claude/scripts/detect_changed_modules.sh list))

# Step 4: Cache git changes (protect current state)
Bash(git add -A 2>/dev/null || true)

# Step 5: Use detected changes or fallback
if [ -z "$changed" ]; then
    changed=$(Bash(~/.claude/scripts/get_modules_by_depth.sh list | head -10))
fi
count=$(echo "$changed" | wc -l)

# Step 6: Analysis handover → Model takes control
# BASH_EXECUTION_STOPS → MODEL_ANALYSIS_BEGINS

# Pseudocode flow:
# IF (change_count > 15 OR complex_changes_detected):
#     → Task "Complex project related update" subagent_type: "memory-bridge"
# ELSE:
#     → Present plan and WAIT FOR USER APPROVAL before execution
#
# Pass tool parameter to update_module_claude.sh: "$tool"
```

### 🧠 Model Analysis Phase

After the bash script completes change detection, the model takes control to:

1. **Analyze Changes**: Review change count and complexity  
2. **Parse CLAUDE.md Status**: Extract which changed modules have/need CLAUDE.md files
3. **Choose Strategy**: 
   - Simple changes: Present execution plan with CLAUDE.md paths to user
   - Complex changes: Delegate to memory-bridge agent
4. **Present Detailed Plan**: Show user exactly which CLAUDE.md files will be created/updated for changed modules
5. **⚠️ CRITICAL: WAIT FOR USER APPROVAL**: No execution without explicit user consent

### 📋 Execution Strategies

**For Simple Changes (≤15 modules):**

Model will present detailed plan for affected modules:
```
📋 Related Update Plan:
  Tool: [gemini|qwen|codex] (from --tool parameter)

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
        Bash(~/.claude/scripts/update_module_claude.sh "$module" "related" "$tool" &)
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
Bash(git diff --stat)
```

**For Complex Changes (>15 modules):**

The model will delegate to the memory-bridge agent with structured context:

```javascript
Task "Complex project related update"
subagent_type: "memory-bridge"
prompt: `
CONTEXT:
- Total modules: ${change_count}
- Tool: ${tool}  // from --tool parameter, default: gemini
- Mode: related
- Changed modules detected via: detect_changed_modules.sh
- Existing CLAUDE.md: ${existing_count}
- New CLAUDE.md needed: ${new_count}

MODULE LIST:
${changed_modules_output}  // Full output from detect_changed_modules.sh list

REQUIREMENTS:
1. Use TodoWrite to track each depth level before execution
2. Process depths sequentially (deepest→shallowest), max 4 parallel jobs per depth
3. Command format: update_module_claude.sh "<path>" "related" "${tool}" &
4. Extract exact path from "depth:N|path:<PATH>|..." format
5. Verify all ${change_count} modules are processed
6. Run safety check after completion
7. Display git diff --stat

Execute depth-parallel updates for changed modules only.
`
```

**Agent receives complete context:**
- Changed module count and tool selection
- Full structured module list (changed only)
- Clear execution requirements with "related" mode
- Path extraction format
- Success criteria


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