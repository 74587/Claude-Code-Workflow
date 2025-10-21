---
name: update-full
description: Complete project-wide CLAUDE.md documentation update with agent-based parallel execution and tool fallback
argument-hint: "[--tool gemini|qwen|codex] [--path <directory>]"
---

# Full Documentation Update (/memory:update-full)

## Overview

Orchestrates project-wide CLAUDE.md updates using batched agent execution with automatic tool fallback (gemini→qwen→codex).

**Parameters**:
- `--tool <gemini|qwen|codex>`: Primary tool (default: gemini)
- `--path <directory>`: Target specific directory (default: entire project)

**Execution Flow**:
1. Discovery & Analysis → 2. Plan Presentation → 3. Batched Agent Execution → 4. Safety Verification

## Core Rules

1. **Analyze First**: Git cache + module discovery before updates
2. **Wait for Approval**: Present plan, no execution without user confirmation
3. **Execution Strategy**:
   - <20 modules: Direct parallel execution (max 4 concurrent per depth, no agent overhead)
   - ≥20 modules: Agent batch processing (4 modules/agent, 73% overhead reduction)
4. **Tool Fallback**: Auto-retry with fallback tools on failure
5. **Depth Sequential**: Process depths N→0, parallel batches within depth (both modes)
6. **Safety Check**: Verify only CLAUDE.md files modified

## Tool Fallback Hierarchy

```javascript
--tool gemini  →  [gemini, qwen, codex]  // default
--tool qwen    →  [qwen, gemini, codex]
--tool codex   →  [codex, gemini, qwen]
```

**Trigger**: Non-zero exit code from update script

## Phase 1: Discovery & Analysis

```bash
# Cache git changes
bash(git add -A 2>/dev/null || true)

# Get module structure
bash(~/.claude/scripts/get_modules_by_depth.sh list)
# OR with --path
bash(cd <target-path> && ~/.claude/scripts/get_modules_by_depth.sh list)
```

**Parse output** `depth:N|path:<PATH>|...` to extract module paths and count.

**Smart filter**: Auto-detect and skip tests/build/config/docs based on project tech stack (Node.js/Python/Go/Rust/etc).

## Phase 2: Plan Presentation

**Present filtered plan**:
```
Update Plan:
  Tool: gemini (fallback: qwen → codex)
  Total: 7 modules
  Execution: Direct sequential (< 20 modules threshold)

  Will update:
  - ./core/interfaces (12 files) - depth 2
  - ./core (22 files) - depth 1
  - ./models (9 files) - depth 1
  - ./parametric (6 files) - depth 1
  - ./results (7 files) - depth 1
  - ./utils (12 files) - depth 1
  - . (5 files) - depth 0

  Auto-skipped (15 paths):
  - Tests: ./tests, **/*_test.py (8 paths)
  - Build: __pycache__, dist, *.egg-info (5 paths)
  - Config: setup.py, requirements.txt (2 paths)

  Execution order (by depth):
  1. Depth 2: ./core/interfaces
  2. Depth 1: ./core, ./models, ./parametric, ./results, ./utils
  3. Depth 0: .

  Estimated time: ~5-10 minutes

  Confirm execution? (y/n)
```

**For ≥20 modules**:
```
Update Plan:
  Tool: gemini (fallback: qwen → codex)
  Total: 31 modules
  Execution: Agent batch processing (4 modules/agent)

  Will update:
  - ./src/features/auth (12 files)
  - ./.claude/commands/cli (6 files)
  - ./src/utils (8 files)
  ...

  Auto-skipped (45 paths):
  - Tests: ./tests, ./src/**/*.test.ts (18 paths)
  - Config: package.json, tsconfig.json, vite.config.ts (12 paths)
  - Build: ./dist, ./node_modules, ./.next (8 paths)
  - Docs: ./README.md, ./docs (5 paths)
  - Other: .git, .vscode, coverage (2 paths)

  Agent allocation:
  - Depth 5 (8 modules): 2 agents [4, 4]
  - Depth 4 (7 modules): 2 agents [4, 3]
  - Depth 3 (6 modules): 2 agents [3, 3]

  Estimated time: ~15-25 minutes

  Confirm execution? (y/n)
```

**Decision logic**:
- User confirms "y": Proceed with execution
- User declines "n": Abort, no changes
- <20 modules: Direct execution (Phase 3A)
- ≥20 modules: Agent batch execution (Phase 3B)

## Phase 3A: Direct Execution (<20 modules)

**Strategy**: Parallel execution within depth (max 4 concurrent), no agent overhead, tool fallback per module.

```javascript
let modules_by_depth = group_by_depth(module_list);
let tool_order = construct_tool_order(primary_tool);

for (let depth of sorted_depths.reverse()) {  // N → 0
  let modules = modules_by_depth[depth];
  let batches = batch_modules(modules, 4);  // Split into groups of 4

  for (let batch of batches) {
    // Execute batch in parallel (max 4 concurrent)
    let parallel_tasks = batch.map(module => {
      return async () => {
        let success = false;
        for (let tool of tool_order) {
          let exit_code = bash(cd ${module.path} && ~/.claude/scripts/update_module_claude.sh "." "${tool}");
          if (exit_code === 0) {
            report("${module.path} updated with ${tool}");
            success = true;
            break;
          }
        }
        if (!success) {
          report("FAILED: ${module.path} failed all tools");
        }
      };
    });

    await Promise.all(parallel_tasks.map(task => task()));  // Run batch in parallel
  }
}
```

**Example execution (7 modules)**:
```bash
# Depth 2 (1 module)
bash(cd ./core/interfaces && ~/.claude/scripts/update_module_claude.sh "." "gemini")
# → Success with gemini

# Depth 1 (5 modules → 2 batches: [4, 1])
# Batch 1 (4 modules in parallel):
bash(cd ./core && ~/.claude/scripts/update_module_claude.sh "." "gemini") &
bash(cd ./models && ~/.claude/scripts/update_module_claude.sh "." "gemini") &
bash(cd ./parametric && ~/.claude/scripts/update_module_claude.sh "." "gemini") &
bash(cd ./results && ~/.claude/scripts/update_module_claude.sh "." "gemini") &
wait  # Wait for batch 1 to complete

# Batch 2 (1 module):
bash(cd ./utils && ~/.claude/scripts/update_module_claude.sh "." "gemini")
# → Success with gemini

# Depth 0 (1 module)
bash(cd . && ~/.claude/scripts/update_module_claude.sh "." "gemini")
# → Success with gemini
```

**Benefits**:
- No agent startup overhead
- Parallel execution within depth (max 4 concurrent)
- Tool fallback still applies per module
- Faster for small projects (<20 modules)
- Same batching strategy as Phase 3B but without agent layer

---

## Phase 3B: Agent Batch Execution (≥20 modules)

### Batching Strategy

```javascript
// Batch modules into groups of 4
function batch_modules(modules, batch_size = 4) {
  let batches = [];
  for (let i = 0; i < modules.length; i += batch_size) {
    batches.push(modules.slice(i, i + batch_size));
  }
  return batches;
}
// Examples: 10→[4,4,2] | 8→[4,4] | 3→[3]
```

### Coordinator Orchestration

```javascript
let modules_by_depth = group_by_depth(module_list);
let tool_order = construct_tool_order(primary_tool);

for (let depth of sorted_depths.reverse()) {  // N → 0
  let batches = batch_modules(modules_by_depth[depth], 4);
  let worker_tasks = [];

  for (let batch of batches) {
    worker_tasks.push(
      Task(
        subagent_type="memory-bridge",
        description=`Update ${batch.length} modules at depth ${depth}`,
        prompt=generate_batch_worker_prompt(batch, tool_order)
      )
    );
  }

  await parallel_execute(worker_tasks);  // Batches run in parallel
}
```

### Batch Worker Prompt Template

```
PURPOSE: Update CLAUDE.md for assigned modules with tool fallback

TASK:
Update documentation for the following modules. For each module, try tools in order until success.

MODULES:
{{module_path_1}}
{{module_path_2}}
{{module_path_3}}
{{module_path_4}}

TOOLS (try in order):
1. {{tool_1}}
2. {{tool_2}}
3. {{tool_3}}

EXECUTION:
For each module above:
  1. cd "{{module_path}}"
  2. Try tool 1:
     bash(cd "{{module_path}}" && ~/.claude/scripts/update_module_claude.sh "." "{{tool_1}}")
     → Success: Report " {{module_path}} updated with {{tool_1}}", proceed to next module
     → Failure: Try tool 2
  3. Try tool 2:
     bash(cd "{{module_path}}" && ~/.claude/scripts/update_module_claude.sh "." "{{tool_2}}")
     → Success: Report " {{module_path}} updated with {{tool_2}}", proceed to next module
     → Failure: Try tool 3
  4. Try tool 3:
     bash(cd "{{module_path}}" && ~/.claude/scripts/update_module_claude.sh "." "{{tool_3}}")
     → Success: Report " {{module_path}} updated with {{tool_3}}", proceed to next module
     → Failure: Report "FAILED: {{module_path}} failed all tools", proceed to next module

REPORTING:
Report final summary with:
- Total processed: X modules
- Successful: Y modules
- Failed: Z modules
- Tool usage: {{tool_1}}:X, {{tool_2}}:Y, {{tool_3}}:Z
- Detailed results for each module
```

### Example Execution

**Depth 5 (8 modules → 2 batches)**:
```javascript
Task(subagent_type="memory-bridge", batch=[mod1, mod2, mod3, mod4])  // Agent 1
Task(subagent_type="memory-bridge", batch=[mod5, mod6, mod7, mod8])  // Agent 2
// Both run in parallel
```

**Benefits**:
- 8 modules → 2 agents (75% reduction)
- Parallel batches, sequential within batch
- Each module gets full fallback chain

## Phase 4: Safety Verification

```bash
# Check only CLAUDE.md modified
bash(git diff --cached --name-only | grep -v "CLAUDE.md" || echo "Only CLAUDE.md files modified")

# Display status
bash(git status --short)
```

**Aggregate results**:
```
Update Summary:
  Total: 31 | Success: 29 | Failed: 2

  Tool usage:
  - gemini: 25 modules
  - qwen: 4 modules (fallback)
  - codex: 0 modules

  Failed: FAILED: path1, path2
```

## Execution Summary

**Module Count Threshold**:
- **<20 modules**: Coordinator executes Phase 3A (Direct Execution)
- **≥20 modules**: Coordinator executes Phase 3B (Agent Batch Execution)

**Agent Hierarchy** (for ≥20 modules):
- **Coordinator**: Handles batch division, spawns worker agents per depth
- **Worker Agents**: Each processes 4 modules with tool fallback

## Error Handling

**Batch Worker**:
- Tool fallback per module (auto-retry)
- Batch isolation (failures don't propagate)
- Clear per-module status reporting

**Coordinator**:
- Invalid path: Abort with error
- User decline: No execution
- Safety check fail: Auto-revert staging
- Partial failures: Continue execution, report failed modules

**Fallback Triggers**:
- Non-zero exit code
- Script timeout
- Unexpected output

## Tool Reference

| Tool   | Best For                       | Fallback To    |
|--------|--------------------------------|----------------|
| gemini | Documentation, patterns        | qwen → codex   |
| qwen   | Architecture, system design    | gemini → codex |
| codex  | Implementation, code quality   | gemini → qwen  |

## Path Parameter Examples

```bash
# Full project update
/memory:update-full

# Target specific directory
/memory:update-full --path .claude
/memory:update-full --path src/features/auth

# Combine with tool selection
/memory:update-full --path .claude --tool qwen
```

## Key Advantages

**Efficiency**: 30 modules → 8 agents (73% reduction)
**Resilience**: 3-tier fallback per module
**Performance**: Parallel batches, no concurrency limits
**Observability**: Per-module tool usage, batch-level metrics

## Coordinator Checklist

- Parse `--tool` (default: gemini) and `--path` (default: current dir)
- Git cache + module discovery
- **Smart filter modules** (auto-detect tech stack, skip tests/build/config/docs)
- Construct tool fallback order
- **Present filtered plan** with execution strategy (<20: direct, ≥20: agent batch)
- **Wait for y/n confirmation**
- Determine execution mode:
  - **<20 modules**: Direct execution (Phase 3A)
    - For each depth (N→0): Sequential module updates with tool fallback
  - **≥20 modules**: Agent batch execution (Phase 3B)
    - For each depth (N→0): Batch modules (4 per batch), spawn batch workers in parallel
- Wait for depth/batch completion
- Aggregate results
- Safety check (only CLAUDE.md modified)
- Display git status + summary
