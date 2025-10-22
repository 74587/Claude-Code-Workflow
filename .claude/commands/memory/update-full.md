---
name: update-full
description: Complete project-wide CLAUDE.md documentation update with agent-based parallel execution and tool fallback
argument-hint: "[--tool gemini|qwen|codex] [--path <directory>] [--strategy single-layer|multi-layer]"
---

# Full Documentation Update (/memory:update-full)

## Overview

Orchestrates project-wide CLAUDE.md updates using batched agent execution with automatic tool fallback (gemini→qwen→codex) and 3-layer architecture support.

**Parameters**:
- `--tool <gemini|qwen|codex>`: Primary tool (default: gemini)
- `--path <directory>`: Target specific directory (default: entire project)
- `--strategy <single-layer|multi-layer>`: Update strategy (default: single-layer)

**Execution Flow**:
1. Discovery & Analysis → 2. Plan Presentation → 3. Batched Agent Execution → 4. Safety Verification

## 3-Layer Architecture

**Layer Definition**:
- **Layer 3 (Bottom/Deepest)**: depth ≥ 3 - Use multi-layer strategy (generate CLAUDE.md for all subdirectories)
- **Layer 2 (Middle)**: depth 1-2 - Use single-layer strategy (aggregate from children)
- **Layer 1 (Top)**: depth 0 - Use single-layer strategy (aggregate from children)

**Update Direction**: Layer 3 → Layer 2 → Layer 1 (bottom-up)

## Update Strategies

### Strategy 1: single-layer (For Layers 1-2)

**Use Case**: Upper layers that aggregate from existing child CLAUDE.md files

**Context Configuration**:
- **Layer 2** (depth 1-2): `@*/CLAUDE.md @*.{ts,tsx,js,jsx,py,sh,md,json,yaml,yml}` - Direct children CLAUDE.md + current layer code
- **Layer 1** (depth 0): `@*/CLAUDE.md @*.{ts,tsx,js,jsx,py,sh,md,json,yaml,yml}` - Direct children CLAUDE.md + current layer code

**Benefits**:
- Minimal context consumption
- Clear layer separation
- Each layer reads only immediate children summaries
- Ideal for structured projects with defined hierarchy

**Example Execution Flow**:
```
src/auth/handlers/ (depth 3) - MULTI-LAYER STRATEGY
  CONTEXT: @**/* (all files in handlers/ and subdirs)
  GENERATES: ./CLAUDE.md + CLAUDE.md in each subdir with files
  ↓
src/auth/ (depth 2) - SINGLE-LAYER STRATEGY
  CONTEXT: @*/CLAUDE.md @*.ts (handlers/CLAUDE.md, middleware/CLAUDE.md, index.ts)
  GENERATES: ./CLAUDE.md only
  ↓
src/ (depth 1) - SINGLE-LAYER STRATEGY
  CONTEXT: @*/CLAUDE.md (auth/CLAUDE.md, utils/CLAUDE.md)
  GENERATES: ./CLAUDE.md only
  ↓
./ (depth 0) - SINGLE-LAYER STRATEGY
  CONTEXT: @*/CLAUDE.md (src/CLAUDE.md, tests/CLAUDE.md)
  GENERATES: ./CLAUDE.md only
```

### Strategy 2: multi-layer (For Layer 3 only)

**Use Case**: Deepest layer with unstructured files, initial documentation generation

**Context Configuration**:
- **Layer 3** (depth ≥3): `@**/*` - All files in current directory and generate CLAUDE.md for each subdirectory

**Benefits**:
- Handles unstructured file layouts
- Generates documentation for all directories with files
- Creates the foundation layer for upper layers to reference
- Ideal for leaf directories that haven't been documented yet

**Example Execution Flow**:
```
src/auth/handlers/ (depth 3) - MULTI-LAYER STRATEGY
  CONTEXT: @**/* (all files: login.ts, logout.ts, validation/)
  GENERATES: ./CLAUDE.md + validation/CLAUDE.md (if validation/ has files)
```

### Strategy Selection Guidelines

**Strategy Assignment by Layer**:

| Layer | Depth | Strategy | Purpose |
|-------|-------|----------|---------|
| Layer 3 (Deepest) | ≥3 | multi-layer | Generate docs for unstructured directories |
| Layer 2 (Middle) | 1-2 | single-layer | Aggregate from children + current code |
| Layer 1 (Top) | 0 | single-layer | Aggregate from children + current code |

**Layer 3 Processing**:
- Use multi-layer strategy to handle unstructured file layouts
- Generate CLAUDE.md for each directory containing files
- Create foundation for upper layers to reference

## Core Rules

1. **Analyze First**: Git cache + module discovery before updates
2. **Wait for Approval**: Present plan, no execution without user confirmation
3. **Execution Strategy**:
   - <20 modules: Direct parallel execution (max 4 concurrent per layer, no agent overhead)
   - ≥20 modules: Agent batch processing (4 modules/agent, 73% overhead reduction)
4. **Tool Fallback**: Auto-retry with fallback tools on failure
5. **Layer Sequential**: Process layers 3→2→1 (bottom-up), parallel batches within layer
6. **Safety Check**: Verify only CLAUDE.md files modified
7. **Strategy Parameter**: Pass `--strategy` to update script for correct context selection
8. **Layer-based Grouping**: Group modules by LAYER (not depth) for execution

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
  Strategy: recursive-read
  Total: 7 modules
  Execution: Direct sequential (< 20 modules threshold)

  Will update:
  - ./core/interfaces (12 files) - depth 2 [Layer 2]
  - ./core (22 files) - depth 1 [Layer 2]
  - ./models (9 files) - depth 1 [Layer 2]
  - ./parametric (6 files) - depth 1 [Layer 2]
  - ./results (7 files) - depth 1 [Layer 2]
  - ./utils (12 files) - depth 1 [Layer 2]
  - . (5 files) - depth 0 [Layer 1]

  Context Strategy:
  - Layer 2 (depth 1-2): @*/CLAUDE.md + current code files
  - Layer 1 (depth 0): @*/CLAUDE.md + current code files

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
  Strategy: multi-layer
  Total: 31 modules
  Execution: Agent batch processing (4 modules/agent)

  Will update:
  - ./src/features/auth (12 files) - depth 3 [Layer 3]
  - ./.claude/commands/cli (6 files) - depth 3 [Layer 3]
  - ./src/utils (8 files) - depth 2 [Layer 2]
  ...

  Context Strategy:
  - Layer 3 (depth ≥3): @**/* (all files)
  - Layer 2 (depth 1-2): @**/CLAUDE.md + @**/* (all CLAUDE.md + all files)
  - Layer 1 (depth 0): @**/CLAUDE.md + @**/* (all CLAUDE.md + all files)

  Auto-skipped (45 paths):
  - Tests: ./tests, ./src/**/*.test.ts (18 paths)
  - Config: package.json, tsconfig.json, vite.config.ts (12 paths)
  - Build: ./dist, ./node_modules, ./.next (8 paths)
  - Docs: ./README.md, ./docs (5 paths)
  - Other: .git, .vscode, coverage (2 paths)

  Agent allocation (by LAYER):
  - Layer 3 (14 modules, depth ≥3): 4 agents [4, 4, 4, 2]
  - Layer 2 (15 modules, depth 1-2): 4 agents [4, 4, 4, 3]
  - Layer 1 (2 modules, depth 0): 1 agent [2]

  Estimated time: ~15-25 minutes

  Confirm execution? (y/n)
```

**Decision logic**:
- User confirms "y": Proceed with execution
- User declines "n": Abort, no changes
- <20 modules: Direct execution (Phase 3A)
- ≥20 modules: Agent batch execution (Phase 3B)

## Phase 3A: Direct Execution (<20 modules)

**Strategy**: Parallel execution within layer (max 4 concurrent), no agent overhead, tool fallback per module.

```javascript
// Group modules by LAYER (not depth)
function group_by_layer(modules) {
  let layers = {
    3: [],  // Layer 3: depth ≥3
    2: [],  // Layer 2: depth 1-2
    1: []   // Layer 1: depth 0
  };

  modules.forEach(module => {
    if (module.depth >= 3) {
      layers[3].push(module);
    } else if (module.depth >= 1) {
      layers[2].push(module);
    } else {
      layers[1].push(module);
    }
  });

  return layers;
}

let modules_by_layer = group_by_layer(module_list);
let tool_order = construct_tool_order(primary_tool);
let strategy = get_strategy_parameter(); // single-layer or multi-layer

// Process by LAYER (3 → 2 → 1), not by depth
for (let layer of [3, 2, 1]) {
  if (modules_by_layer[layer].length === 0) continue;

  let batches = batch_modules(modules_by_layer[layer], 4);  // Split into groups of 4

  for (let batch of batches) {
    // Execute batch in parallel (max 4 concurrent)
    let parallel_tasks = batch.map(module => {
      return async () => {
        let success = false;
        for (let tool of tool_order) {
          let exit_code = bash(cd ${module.path} && ~/.claude/scripts/update_module_claude.sh "${strategy}" "." "${tool}");
          if (exit_code === 0) {
            report("✅ ${module.path} (Layer ${layer}) updated with ${tool}");
            success = true;
            break;
          }
        }
        if (!success) {
          report("❌ FAILED: ${module.path} (Layer ${layer}) failed all tools");
        }
      };
    });

    await Promise.all(parallel_tasks.map(task => task()));  // Run batch in parallel
  }
}
```

**Example execution (7 modules, recursive-read)**:
```bash
# Layer 2 (1 module: depth 2)
bash(cd ./core/interfaces && ~/.claude/scripts/update_module_claude.sh "multi-layer" "." "gemini")
# → CONTEXT: @*/CLAUDE.md @*.ts @*.tsx... (direct children + current code)
# → Success with gemini

# Layer 2 (5 modules: depth 1 → 2 batches: [4, 1])
# Batch 1 (4 modules in parallel):
bash(cd ./core && ~/.claude/scripts/update_module_claude.sh "single-layer" "." "gemini") &
bash(cd ./models && ~/.claude/scripts/update_module_claude.sh "single-layer" "." "gemini") &
bash(cd ./parametric && ~/.claude/scripts/update_module_claude.sh "single-layer" "." "gemini") &
bash(cd ./results && ~/.claude/scripts/update_module_claude.sh "single-layer" "." "gemini") &
wait  # Wait for batch 1 to complete

# Batch 2 (1 module):
bash(cd ./utils && ~/.claude/scripts/update_module_claude.sh "single-layer" "." "gemini")
# → Success with gemini

# Layer 1 (1 module: depth 0)
bash(cd . && ~/.claude/scripts/update_module_claude.sh "single-layer" "." "gemini")
# → CONTEXT: @*/CLAUDE.md @*.ts... (direct children + current code)
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
// Group modules by LAYER (not depth)
function group_by_layer(modules) {
  let layers = {
    3: [],  // Layer 3: depth ≥3
    2: [],  // Layer 2: depth 1-2
    1: []   // Layer 1: depth 0
  };

  modules.forEach(module => {
    if (module.depth >= 3) {
      layers[3].push(module);
    } else if (module.depth >= 1) {
      layers[2].push(module);
    } else {
      layers[1].push(module);
    }
  });

  return layers;
}

let modules_by_layer = group_by_layer(module_list);
let tool_order = construct_tool_order(primary_tool);

// Process by LAYER (3 → 2 → 1), not by depth
for (let layer of [3, 2, 1]) {
  if (modules_by_layer[layer].length === 0) continue;

  let batches = batch_modules(modules_by_layer[layer], 4);
  let worker_tasks = [];

  for (let batch of batches) {
    worker_tasks.push(
      Task(
        subagent_type="memory-bridge",
        description=`Update ${batch.length} modules in Layer ${layer}`,
        prompt=generate_batch_worker_prompt(batch, tool_order, strategy, layer)
      )
    );
  }

  await parallel_execute(worker_tasks);  // Batches run in parallel within layer
}
```

### Batch Worker Prompt Template

```
PURPOSE: Update CLAUDE.md for assigned modules with tool fallback and 3-layer architecture

TASK:
Update documentation for the following modules. For each module, try tools in order until success.
Use the specified strategy for context selection.

STRATEGY: {{strategy}}  # single-layer or multi-layer

MODULES:
{{module_path_1}} (depth: {{depth_1}}, layer: {{layer_1}})
{{module_path_2}} (depth: {{depth_2}}, layer: {{layer_2}})
{{module_path_3}} (depth: {{depth_3}}, layer: {{layer_3}})
{{module_path_4}} (depth: {{depth_4}}, layer: {{layer_4}})

TOOLS (try in order):
1. {{tool_1}}
2. {{tool_2}}
3. {{tool_3}}

EXECUTION:
For each module above:
  1. cd "{{module_path}}"
  2. Try tool 1:
     bash(cd "{{module_path}}" && ~/.claude/scripts/update_module_claude.sh "{{strategy}}" "." "{{tool_1}}")
     → Success: Report "✅ {{module_path}} updated with {{tool_1}}", proceed to next module
     → Failure: Try tool 2
  3. Try tool 2:
     bash(cd "{{module_path}}" && ~/.claude/scripts/update_module_claude.sh "{{strategy}}" "." "{{tool_2}}")
     → Success: Report "✅ {{module_path}} updated with {{tool_2}}", proceed to next module
     → Failure: Try tool 3
  4. Try tool 3:
     bash(cd "{{module_path}}" && ~/.claude/scripts/update_module_claude.sh "{{strategy}}" "." "{{tool_3}}")
     → Success: Report "✅ {{module_path}} updated with {{tool_3}}", proceed to next module
     → Failure: Report "❌ FAILED: {{module_path}} failed all tools", proceed to next module

CONTEXT SELECTION (automated by script):
- Layer 3 (depth ≥3): @**/* (all files)
- Layer 2 (depth 1-2):
  * recursive-read: @*/CLAUDE.md + current code files
  * multi-layer: @**/CLAUDE.md + @**/*
- Layer 1 (depth 0):
  * recursive-read: @*/CLAUDE.md + current code files
  * multi-layer: @**/CLAUDE.md + @**/*

REPORTING:
Report final summary with:
- Total processed: X modules
- Successful: Y modules
- Failed: Z modules
- Tool usage: {{tool_1}}:X, {{tool_2}}:Y, {{tool_3}}:Z
- Detailed results for each module with layer information
```

### Example Execution

**Layer-based allocation (31 modules total)**:
```javascript
// Layer 3: 14 modules (depth ≥3) → 4 agents
Task(subagent_type="memory-bridge", batch=[mod1, mod2, mod3, mod4])  // Agent 1
Task(subagent_type="memory-bridge", batch=[mod5, mod6, mod7, mod8])  // Agent 2
Task(subagent_type="memory-bridge", batch=[mod9, mod10, mod11, mod12])  // Agent 3
Task(subagent_type="memory-bridge", batch=[mod13, mod14])  // Agent 4
// All 4 agents run in parallel

// Layer 2: 15 modules (depth 1-2) → 4 agents
Task(subagent_type="memory-bridge", batch=[mod15, mod16, mod17, mod18])  // Agent 5
Task(subagent_type="memory-bridge", batch=[mod19, mod20, mod21, mod22])  // Agent 6
Task(subagent_type="memory-bridge", batch=[mod23, mod24, mod25, mod26])  // Agent 7
Task(subagent_type="memory-bridge", batch=[mod27, mod28, mod29])  // Agent 8
// All 4 agents run in parallel

// Layer 1: 2 modules (depth 0) → 1 agent
Task(subagent_type="memory-bridge", batch=[mod30, mod31])  // Agent 9
```

**Benefits**:
- 31 modules → 9 agents (71% reduction from sequential)
- Parallel execution within each layer
- Each module gets full fallback chain
- Layer isolation ensures proper dependency order

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
# Full project update with default strategy (single-layer)
/memory:update-full

# Full project update with multi-layer strategy
/memory:update-full --strategy multi-layer

# Target specific directory with single-layer
/memory:update-full --path .claude --strategy single-layer
/memory:update-full --path src/features/auth

# Combine all parameters
/memory:update-full --path .claude --tool qwen --strategy multi-layer

# Strategy selection based on project size
/memory:update-full --strategy single-layer  # Large projects (>50 modules)
/memory:update-full --strategy multi-layer       # Small projects (<20 modules)
```

## Key Advantages

**Efficiency**: 30 modules → 8 agents (73% reduction)
**Resilience**: 3-tier fallback per module
**Performance**: Parallel batches, no concurrency limits
**Observability**: Per-module tool usage, batch-level metrics

## Coordinator Checklist

- Parse `--tool` (default: gemini), `--path` (default: current dir), and `--strategy` (default: recursive-read)
- Git cache + module discovery
- **Smart filter modules** (auto-detect tech stack, skip tests/build/config/docs)
- **Group modules by LAYER** (not depth):
  - Layer 3: depth ≥3
  - Layer 2: depth 1-2
  - Layer 1: depth 0
- Construct tool fallback order
- **Determine strategy** based on project size or user specification:
  - <20 modules: Use depth-based strategy assignment (multi-layer for depth ≥3, single-layer for depth 0-2)
  - ≥20 modules: Use depth-based strategy assignment (multi-layer for depth ≥3, single-layer for depth 0-2)
- **Present filtered plan** with:
  - Execution strategy (<20: direct, ≥20: agent batch)
  - Layer groupings (not depth groupings)
  - Context strategy per layer
  - Agent allocation by LAYER
- **Wait for y/n confirmation**
- Determine execution mode:
  - **<20 modules**: Direct execution (Phase 3A)
    - For each layer (3→2→1): Parallel module updates within layer (max 4 concurrent) with tool fallback and strategy parameter
  - **≥20 modules**: Agent batch execution (Phase 3B)
    - For each layer (3→2→1): Batch modules (4 per batch), spawn batch workers in parallel with strategy parameter
- Wait for layer completion before moving to next layer
- Aggregate results
- Safety check (only CLAUDE.md modified)
- Display git status + summary with layer statistics
