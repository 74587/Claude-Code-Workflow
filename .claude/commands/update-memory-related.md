---
name: update-memory-related
description: Context-aware CLAUDE.md documentation updates based on recent changes
argument-hint: "[--tool gemini|qwen|codex]"
---

# Related Documentation Update (/update-memory-related)

## Coordinator Role

**This command orchestrates context-aware CLAUDE.md updates** for modules affected by recent changes using intelligent change detection.

**Execution Model**:

1. **Change Detection**: Analyze git changes to identify affected modules
2. **Complexity Analysis**: Evaluate change count and determine strategy
3. **Plan Presentation**: Show user which modules need updates
4. **Depth-Parallel Execution**: Update affected modules by depth (highest to lowest)
5. **Safety Verification**: Ensure only CLAUDE.md files modified

**Tool Selection**:
- `--tool gemini` (default): Documentation generation, pattern recognition
- `--tool qwen`: Architecture analysis, system design docs
- `--tool codex`: Implementation validation, code quality analysis

## Core Rules

1. **Detect Changes First**: Use git diff to identify affected modules before updates
2. **Wait for Approval**: Present plan, no execution without user confirmation
3. **Related Mode**: Update only changed modules and their parent contexts
4. **Depth-Parallel**: Same depth runs parallel (max 4 jobs), different depths sequential
5. **Safety Check**: Verify only CLAUDE.md files modified, revert if source files touched
6. **No Background Bash Tool**: Never use `run_in_background` parameter in bash() calls; use shell `&` for parallelism

## Execution Workflow

### Phase 1: Change Detection & Analysis

**Refresh code index:**
```bash
bash(mcp__code-index__refresh_index)
```

**Detect changed modules:**
```bash
bash(~/.claude/scripts/detect_changed_modules.sh list)
```

**Cache git changes:**
```bash
bash(git add -A 2>/dev/null || true)
```

**Parse Output**:
- Extract changed module paths from `depth:N|path:<PATH>|...` format
- Count affected modules
- Identify which modules have/need CLAUDE.md updates

**Example output:**
```
depth:3|path:./src/api/auth|files:5|types:[ts]|has_claude:no|change:new
depth:2|path:./src/api|files:12|types:[ts]|has_claude:yes|change:modified
depth:1|path:./src|files:8|types:[ts]|has_claude:yes|change:parent
depth:0|path:.|files:14|has_claude:yes|change:parent
```

**Fallback behavior**:
- If no git changes detected, use recent modules (first 10 by depth)

**Validation**:
- Changed module list contains valid paths
- At least one affected module exists

---

### Phase 2: Plan Presentation

**Decision Logic**:
- **Simple changes (≤15 modules)**: Present plan to user, wait for approval
- **Complex changes (>15 modules)**: Delegate to memory-bridge agent

**Plan format:**
```
📋 Related Update Plan:
  Tool: gemini
  Changed modules: 4

  NEW CLAUDE.md files (1):
    - ./src/api/auth/CLAUDE.md [new module]

  UPDATE existing CLAUDE.md files (3):
    - ./src/api/CLAUDE.md [parent of changed auth/]
    - ./src/CLAUDE.md [parent context]
    - ./CLAUDE.md [root level]

  ⚠️ Confirm execution? (y/n)
```

**User Confirmation Required**: No execution without explicit approval

---

### Phase 3: Depth-Parallel Execution

**Pattern**: Process highest depth first, parallel within depth, sequential across depths.

**Command structure:**
```bash
bash(cd <module-path> && ~/.claude/scripts/update_module_claude.sh "." "related" "<tool>" &)
```

**Example - Depth 3 (new module):**
```bash
bash(cd ./src/api/auth && ~/.claude/scripts/update_module_claude.sh "." "related" "gemini" &)
```

*Wait for depth 3 completion...*

**Example - Depth 2 (modified parent):**
```bash
bash(cd ./src/api && ~/.claude/scripts/update_module_claude.sh "." "related" "gemini" &)
```

*Wait for depth 2 completion...*

**Example - Depth 1 & 0 (parent contexts):**
```bash
bash(cd ./src && ~/.claude/scripts/update_module_claude.sh "." "related" "gemini" &)
```
```bash
bash(cd . && ~/.claude/scripts/update_module_claude.sh "." "related" "gemini" &)
```

*Wait for all depths completion...*

**Execution Rules**:
- Each command is separate bash() call
- Up to 4 concurrent jobs per depth
- Wait for all jobs in current depth before proceeding
- Use "related" mode (not "full") for context-aware updates
- Extract path from `depth:N|path:<PATH>|...` format

**Related Mode Behavior**:
- Updates module based on recent git changes
- Includes parent context for better documentation coherence
- More efficient than full updates for iterative development

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
Modified files: src/api/auth/index.ts, package.json
→ Run: git restore --staged .
```

**Display final statistics:**
```bash
bash(git diff --stat)
```

**Example output:**
```
.claude/workflows/cli-templates/prompts/analysis/CLAUDE.md | 45 +++++++++++++++++++++
src/api/CLAUDE.md                                          | 23 +++++++++--
src/CLAUDE.md                                              | 12 ++++--
CLAUDE.md                                                  | 8 ++--
4 files changed, 82 insertions(+), 6 deletions(-)
```

## Command Pattern Reference

**Single module update:**
```bash
bash(cd <module-path> && ~/.claude/scripts/update_module_claude.sh "." "related" "<tool>" &)
```

**Components**:
- `cd <module-path>` - Navigate to module (from `path:` field)
- `&&` - Ensure cd succeeds
- `update_module_claude.sh` - Update script
- `"."` - Current directory
- `"related"` - Related mode (context-aware, change-based)
- `"<tool>"` - gemini/qwen/codex
- `&` - Background execution

**Path extraction:**
```bash
# From: depth:3|path:./src/api/auth|files:5|change:new|has_claude:no
# Extract: ./src/api/auth
# Command: bash(cd ./src/api/auth && ~/.claude/scripts/update_module_claude.sh "." "related" "gemini" &)
```

**Mode comparison:**
- `"full"` - Complete module documentation regeneration
- `"related"` - Context-aware update based on recent changes (faster)

## Complex Changes Strategy

For changes affecting >15 modules, delegate to memory-bridge agent:

```javascript
Task(
  subagent_type="memory-bridge",
  description="Complex project related update",
  prompt=`
CONTEXT:
- Total modules: ${change_count}
- Tool: ${tool}
- Mode: related

MODULE LIST:
${changed_modules_output}

REQUIREMENTS:
1. Use TodoWrite to track each depth level
2. Process depths N→0 sequentially, max 4 parallel per depth
3. Command: cd "<path>" && update_module_claude.sh "." "related" "${tool}" &
4. Extract path from "depth:N|path:<PATH>|..." format
5. Verify all ${change_count} modules processed
6. Run safety check
7. Display git diff --stat
`
)
```

## Error Handling

- **No changes detected**: Use fallback mode (recent 10 modules)
- **Change detection failure**: Report error, abort execution
- **User declines approval**: Abort execution, no changes made
- **Safety check failure**: Automatic staging revert, report modified files
- **Update script failure**: Report failed modules, continue with remaining

## Coordinator Checklist

✅ Parse `--tool` parameter (default: gemini)
✅ Refresh code index for accurate change detection
✅ Detect changed modules via detect_changed_modules.sh
✅ Cache git changes to protect current state
✅ Parse changed module list, count affected modules
✅ Apply fallback if no changes detected (recent 10 modules)
✅ Determine strategy based on change count (≤15 vs >15)
✅ Present plan with exact file paths and change types
✅ **Wait for user confirmation** (simple changes only)
✅ Organize modules by depth
✅ For each depth (highest to lowest):
  - Launch up to 4 parallel updates with "related" mode
  - Wait for depth completion
  - Proceed to next depth
✅ Run safety check after all updates
✅ Display git diff statistics
✅ Report completion summary

## Usage Examples

```bash
# Daily development update (default: gemini)
/update-memory-related

# After feature work with specific tool
/update-memory-related --tool qwen

# Code quality review after implementation
/update-memory-related --tool codex
```

## Tool Parameter Reference

**Gemini** (default):
- Best for: Documentation generation, pattern recognition
- Use case: Daily development updates, feature documentation
- Output style: Comprehensive, contextual explanations

**Qwen**:
- Best for: Architecture analysis, system design
- Use case: Structural changes, API design updates
- Output style: Structured, systematic documentation

**Codex**:
- Best for: Implementation validation, code quality
- Use case: After implementation, refactoring work
- Output style: Technical, implementation-focused

## Comparison with Full Update

| Aspect | Related Update | Full Update |
|--------|----------------|-------------|
| **Scope** | Changed modules only | All project modules |
| **Speed** | Fast (minutes) | Slower (10-30 min) |
| **Use case** | Daily development | Major refactoring |
| **Mode** | `"related"` | `"full"` |
| **Trigger** | After commits | After major changes |
| **Complexity threshold** | ≤15 modules | ≤20 modules |
