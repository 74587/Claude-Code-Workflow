---
name: update-memory-full
description: Complete project-wide CLAUDE.md documentation update
argument-hint: "[--tool gemini|qwen|codex] [--path <directory>]"
---

# Full Documentation Update (/update-memory-full)

## Coordinator Role

**This command orchestrates project-wide CLAUDE.md updates** using depth-parallel execution strategy with intelligent complexity detection.

**Execution Model**:

1. **Initial Analysis**: Cache git changes, discover module structure
2. **Complexity Detection**: Analyze module count, determine strategy
3. **Plan Presentation**: Show user exactly what will be updated
4. **Depth-Parallel Execution**: Update modules by depth (highest to lowest)
5. **Safety Verification**: Ensure only CLAUDE.md files modified

**Tool Selection**:
- `--tool gemini` (default): Documentation generation, pattern recognition
- `--tool qwen`: Architecture analysis, system design docs
- `--tool codex`: Implementation validation, code quality analysis

**Path Parameter**:
- `--path <directory>` (optional): Target specific directory for updates
- If not specified: Updates entire project from current directory
- If specified: Changes to target directory before discovery

## Core Rules

1. **Analyze First**: Run git cache and module discovery before any updates
2. **Scope Control**: Use --path to target specific directories, default is entire project
3. **Wait for Approval**: Present plan, no execution without user confirmation
4. **Depth-Parallel**: Same depth runs parallel (max 4 jobs), different depths sequential
5. **Safety Check**: Verify only CLAUDE.md files modified, revert if source files touched
6. **Independent Commands**: Each update is a separate bash() call
7. **No Background Bash Tool**: Never use `run_in_background` parameter in bash() calls; use shell `&` for parallelism

## Execution Workflow

### Phase 1: Discovery & Analysis

**Cache git changes:**
```bash
bash(git add -A 2>/dev/null || true)
```

**Get module structure:**

*If no --path parameter:*
```bash
bash(~/.claude/scripts/get_modules_by_depth.sh list)
```

*If --path parameter specified:*
```bash
bash(cd <target-path> && ~/.claude/scripts/get_modules_by_depth.sh list)
```

**Example with path:**
```bash
# Update only .claude directory
bash(cd .claude && ~/.claude/scripts/get_modules_by_depth.sh list)

# Update specific feature directory
bash(cd src/features/auth && ~/.claude/scripts/get_modules_by_depth.sh list)
```

**Parse Output**:
- Extract module paths from `depth:N|path:<PATH>|...` format
- Count total modules
- Identify which modules have/need CLAUDE.md

**Example output:**
```
depth:5|path:./.claude/workflows/cli-templates/prompts/analysis|files:5|has_claude:no
depth:4|path:./.claude/commands/cli/mode|files:3|has_claude:no
depth:3|path:./.claude/commands/cli|files:6|has_claude:no
depth:0|path:.|files:14|has_claude:yes
```

**Validation**:
- If --path specified, directory exists and is accessible
- Module list contains depth and path information
- At least one module exists
- All paths are relative to target directory (if --path used)

---

### Phase 2: Plan Presentation

**Decision Logic**:
- **Simple projects (≤20 modules)**: Present plan to user, wait for approval
- **Complex projects (>20 modules)**: Delegate to memory-bridge agent

**Plan format:**
```
📋 Update Plan:
  Tool: gemini
  Total modules: 31

  NEW CLAUDE.md files (30):
    - ./.claude/workflows/cli-templates/prompts/analysis/CLAUDE.md
    - ./.claude/commands/cli/mode/CLAUDE.md
    - ... (28 more)

  UPDATE existing CLAUDE.md files (1):
    - ./CLAUDE.md

  ⚠️ Confirm execution? (y/n)
```

**User Confirmation Required**: No execution without explicit approval

---

### Phase 3: Depth-Parallel Execution

**Pattern**: Process highest depth first, parallel within depth, sequential across depths.

**Command structure:**
```bash
bash(cd <module-path> && ~/.claude/scripts/update_module_claude.sh "." "full" "<tool>" &)
```

**Example - Depth 5 (8 modules):**
```bash
bash(cd ./.claude/workflows/cli-templates/prompts/analysis && ~/.claude/scripts/update_module_claude.sh "." "full" "gemini" &)
```
```bash
bash(cd ./.claude/workflows/cli-templates/prompts/development && ~/.claude/scripts/update_module_claude.sh "." "full" "gemini" &)
```
```bash
bash(cd ./.claude/workflows/cli-templates/prompts/documentation && ~/.claude/scripts/update_module_claude.sh "." "full" "gemini" &)
```
```bash
bash(cd ./.claude/workflows/cli-templates/prompts/implementation && ~/.claude/scripts/update_module_claude.sh "." "full" "gemini" &)
```

*Wait for depth 5 completion...*

**Example - Depth 4 (7 modules):**
```bash
bash(cd ./.claude/commands/cli/mode && ~/.claude/scripts/update_module_claude.sh "." "full" "gemini" &)
```
```bash
bash(cd ./.claude/commands/workflow/brainstorm && ~/.claude/scripts/update_module_claude.sh "." "full" "gemini" &)
```

*Continue for remaining depths (3 → 2 → 1 → 0)...*

**Execution Rules**:
- Each command is separate bash() call
- Up to 4 concurrent jobs per depth
- Wait for all jobs in current depth before proceeding
- Extract path from `depth:N|path:<PATH>|...` format
- All paths relative to target directory (current dir or --path value)

**Path Context**:
- Without --path: Paths relative to current directory
- With --path: Paths relative to specified target directory
- Module discovery runs in target directory context

---

### Phase 4: Safety Verification

**Check modified files:**
```bash
bash(git diff --cached --name-only | grep -v "CLAUDE.md" || echo "✅ Only CLAUDE.md files modified")
```

**Expected output:**
```
✅ Only CLAUDE.md files modified
```

**If non-CLAUDE.md files detected:**
```
⚠️ Warning: Non-CLAUDE.md files were modified
Modified files: src/index.ts, package.json
→ Run: git restore --staged .
```

**Display final status:**
```bash
bash(git status --short)
```

**Example output:**
```
A  .claude/workflows/cli-templates/prompts/analysis/CLAUDE.md
A  .claude/commands/cli/mode/CLAUDE.md
M  CLAUDE.md
... (30 more files)
```

## Command Pattern Reference

**Single module update:**
```bash
bash(cd <module-path> && ~/.claude/scripts/update_module_claude.sh "." "full" "<tool>" &)
```

**Components**:
- `cd <module-path>` - Navigate to module (from `path:` field)
- `&&` - Ensure cd succeeds
- `update_module_claude.sh` - Update script
- `"."` - Current directory
- `"full"` - Full update mode
- `"<tool>"` - gemini/qwen/codex
- `&` - Background execution

**Path extraction:**
```bash
# From: depth:5|path:./src/auth|files:10|has_claude:no
# Extract: ./src/auth
# Command: bash(cd ./src/auth && ~/.claude/scripts/update_module_claude.sh "." "full" "gemini" &)
```

## Complex Projects Strategy

For projects >20 modules, delegate to memory-bridge agent:

```javascript
Task(
  subagent_type="memory-bridge",
  description="Complex project full update",
  prompt=`
CONTEXT:
- Total modules: ${module_count}
- Tool: ${tool}
- Mode: full

MODULE LIST:
${modules_output}

REQUIREMENTS:
1. Use TodoWrite to track each depth level
2. Process depths N→0 sequentially, max 4 parallel per depth
3. Command: cd "<path>" && update_module_claude.sh "." "full" "${tool}" &
4. Extract path from "depth:N|path:<PATH>|..." format
5. Verify all modules processed
6. Run safety check
7. Display git status
`
)
```

## Error Handling

- **Invalid path parameter**: Report error if --path directory doesn't exist, abort execution
- **Module discovery failure**: Report error, abort execution
- **User declines approval**: Abort execution, no changes made
- **Safety check failure**: Automatic staging revert, report modified files
- **Update script failure**: Report failed modules, continue with remaining

## Coordinator Checklist

✅ Parse `--tool` parameter (default: gemini)
✅ Parse `--path` parameter (optional, default: current directory)
✅ Execute git cache in current directory
✅ Execute module discovery (with cd if --path specified)
✅ Parse module list, count total modules
✅ Determine strategy based on module count (≤20 vs >20)
✅ Present plan with exact file paths
✅ **Wait for user confirmation** (simple projects only)
✅ Organize modules by depth
✅ For each depth (highest to lowest):
  - Launch up to 5 parallel updates
  - Wait for depth completion
  - Proceed to next depth
✅ Run safety check after all updates
✅ Display git status
✅ Report completion summary



## Tool Parameter Reference

**Gemini** (default):
- Best for: Documentation generation, pattern recognition, architecture review
- Context window: Large, handles complex codebases
- Output style: Comprehensive, detailed explanations

**Qwen**:
- Best for: Architecture analysis, system design documentation
- Context window: Large, similar to Gemini
- Output style: Structured, systematic analysis

**Codex**:
- Best for: Implementation validation, code quality analysis
- Capabilities: Mathematical reasoning, autonomous development
- Output style: Technical, implementation-focused

## Path Parameter Reference

**Use Cases**:

**Update configuration directory only:**
```bash
/update-memory-full --path .claude
```
- Updates only .claude directory and subdirectories
- Useful after workflow or command modifications
- Faster than full project update

**Update specific feature module:**
```bash
/update-memory-full --path src/features/auth
```
- Updates authentication feature and sub-modules
- Ideal for feature-specific documentation
- Isolates scope for targeted updates

**Update nested structure:**
```bash
/update-memory-full --path .claude/workflows/cli-templates
```
- Updates deeply nested directory tree
- Maintains relative path structure in output
- All module paths relative to specified directory

**Best Practices**:
- Use `--path` when working on specific features/modules
- Omit `--path` for project-wide architectural changes
- Combine with `--tool` for specialized documentation needs
- Verify directory exists before execution (automatic validation)
