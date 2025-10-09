---
name: auto
description: Fully autonomous UI design workflow with style extraction, consolidation, prototype generation (3×3 matrix), and design system integration
usage: /workflow:ui-design:auto [--prompt "<desc>"] [--images "<glob>"] [--pages "<list>"] [--session <id>] [--style-variants <count>] [--layout-variants <count>] [--batch-plan]
argument-hint: "[--prompt \"Modern SaaS with 3 styles\"] [--images \"refs/*.png\"] [--pages \"dashboard,auth\"] [--session WFS-xxx] [--style-variants 3] [--layout-variants 3]"
examples:
  - /workflow:ui-design:auto --prompt "Generate 3 style variants for modern blog: home, article, author"
  - /workflow:ui-design:auto --prompt "SaaS dashboard and settings with 2 layout options"
  - /workflow:ui-design:auto --images "refs/*.png" --prompt "E-commerce: home, product, cart" --style-variants 3 --layout-variants 3
  - /workflow:ui-design:auto --session WFS-auth --images "refs/*.png"
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*), Glob(*), Write(*), Task(conceptual-planning-agent)
---

# UI Design Auto Workflow Command

## Overview
Fully autonomous UI design workflow: style extraction → consolidation → UI generation → design update → optional batch planning. This command orchestrates the entire design process without user intervention.

## Coordinator Role
**Fully autonomous orchestrator**: Executes all phases sequentially, parsing outputs from one phase to construct the inputs for the next. Supports both standard sequential mode and parallel creative mode for generating diverse design variants.

## Execution Model - Autonomous Workflow

This workflow runs **fully autonomously** from start to finish:

1. **User triggers**: `/workflow:ui-design:auto --session WFS-xxx --images "refs/*.png" --pages "dashboard,auth" [--batch-plan]`
2. **Phase 1 executes** (style-extract) → Auto-continues
3. **Phase 2 executes** (style-consolidate) → Auto-continues
4. **Phase 3 executes** (ui-generate) → Auto-continues
5. **Phase 4 executes** (design-update) → Auto-continues
6. **Phase 5 executes** (batch-plan, optional) → Reports task files

**Auto-Continue Mechanism**:
- The workflow uses `TodoWrite` to track the state of each phase
- Upon successful completion of a phase, the coordinator immediately constructs and executes the command for the next phase
- This pattern ensures a seamless flow

## Core Rules

1. **Start Immediately**: First action is `TodoWrite` initialization, second action is Phase 1 command execution
2. **No Preliminary Analysis**: Do not read files or validate before Phase 1 (sub-commands handle their own validation)
3. **Parse Every Output**: Extract required data from each command's output for the next phase
4. **Auto-Continue**: After each phase, automatically proceed to the next without pausing
5. **Track Progress**: Update `TodoWrite` after every phase completion
6. **Default to All**: When selecting variants or prototypes for the next phase, the autonomous workflow defaults to using **all** generated items

## Parameter Requirements

**Optional Parameters** (all have smart defaults):
- `--pages "<page_list>"`: Pages to generate (if omitted, inferred from prompt/session)
- `--session <session_id>`: Workflow session ID (if omitted, runs in standalone mode)
- `--images "<glob_pattern>"`: Reference image paths (default: `design-refs/*`)
- `--prompt "<description>"`: Text description of design style and pages (supports intelligent parsing)
- `--style-variants <count>`: Number of style variants to generate (default: inferred from prompt or 3, range: 1-5)
- `--layout-variants <count>`: Number of layout variants per style (default: inferred from prompt or 3, range: 1-5)
- `--batch-plan`: Auto-generate implementation tasks after design-update (integrated mode only)

**Input Source Rules**:
- Must provide at least one of: `--images` or `--prompt`
- Both can be combined for guided style analysis

**Intelligent Prompt Parsing**:
The workflow extracts variant counts from natural language:
- "Generate **3 style variants**" → `--style-variants 3`
- "**2 layout options**" → `--layout-variants 2`
- "Create **4 styles** with **2 layouts each**" → `--style-variants 4 --layout-variants 2`
- Explicit flags override prompt inference

## Execution Modes

### Matrix Mode (Default and Only)
- Generates `style_variants × layout_variants × pages` prototypes in 3×3 matrix pattern
- **Phase 1 (Style Extraction)**: Generates `style_variants` style options
- **Phase 2 (Style Consolidation)**: Creates `style_variants` independent design systems
- **Phase 3 (Matrix Generation)**: Generates `style_variants × layout_variants` prototypes per page
- This is the only supported mode - focused on systematic design exploration

### Integrated vs. Standalone Mode
- `--session` flag determines if the workflow is integrated with a larger session or runs standalone

## 6-Phase Execution

### Phase 0a: Intelligent Prompt Parsing
```bash
# Extract variant counts from prompt if not explicitly provided
IF --prompt provided AND (NOT --style-variants OR NOT --layout-variants):
    prompt_text = {--prompt value}

    # Parse style variants: "3 style variants", "generate 4 styles", etc.
    style_match = regex_search(prompt_text, r"(\d+)\s*(style\s*variants?|styles?)")
    IF style_match AND NOT --style-variants:
        style_variants = int(style_match.group(1))
    ELSE:
        style_variants = --style-variants OR 3  # Default to 3

    # Parse layout variants: "2 layout options", "3 layouts each", etc.
    layout_match = regex_search(prompt_text, r"(\d+)\s*(layout\s*(variants?|options?)|layouts?)")
    IF layout_match AND NOT --layout-variants:
        layout_variants = int(layout_match.group(1))
    ELSE:
        layout_variants = --layout-variants OR 3  # Default to 3
ELSE:
    style_variants = --style-variants OR 3
    layout_variants = --layout-variants OR 3

VALIDATE: 1 <= style_variants <= 5
VALIDATE: 1 <= layout_variants <= 5

STORE: style_variants, layout_variants  # For Phase 1 and Phase 3
```

### Phase 0b: Run Initialization & Directory Setup
```bash
# Generate run ID with timestamp
run_id = "run-$(date +%Y%m%d-%H%M%S)"

# Determine base path
IF --session:
    session_id = {provided_session}
    base_path = ".workflow/WFS-{session_id}/runs/${run_id}"
ELSE:
    # Standalone mode: use scratchpad
    session_id = "design-session-$(date +%Y%m%d-%H%M%S)"
    base_path = ".workflow/.scratchpad/${session_id}/runs/${run_id}"

# Create run directory structure
Bash(mkdir -p "${base_path}/.design/style-extraction")
Bash(mkdir -p "${base_path}/.design/style-consolidation")
Bash(mkdir -p "${base_path}/.design/prototypes")

# Initialize run metadata
Write({base_path}/.run-metadata.json):
{
  "run_id": "${run_id}",
  "session_id": "${session_id}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "workflow": "ui-design:auto",
  "parameters": {
    "style_variants": ${style_variants},
    "layout_variants": ${layout_variants},
    "pages": "${inferred_page_list}",
    "prompt": "${prompt_text}",
    "images": "${images_pattern}"
  },
  "status": "in_progress"
}

# Update "latest" symlink (Windows-compatible)
IF --session:
    Bash(cd ".workflow/WFS-{session_id}" && rm -rf latest && mklink /D latest "runs/${run_id}")
ELSE:
    # Standalone mode: create symlink in scratchpad session dir
    Bash(cd ".workflow/.scratchpad/${session_id}" && rm -rf latest && mklink /D latest "runs/${run_id}")

STORE: run_id, base_path  # Use throughout workflow
```

### Phase 0c: Page Inference
```bash
# Infer page list if not explicitly provided
IF --pages provided:
    page_list = parse_csv({--pages value})
ELSE IF --prompt provided:
    # Extract page names from prompt (e.g., "blog with home, article, author pages")
    page_list = extract_pages_from_prompt({--prompt value})
ELSE IF --session AND exists(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md):
    synthesis = Read(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md)
    page_list = extract_pages_from_synthesis(synthesis)
ELSE:
    page_list = ["home"]  # Default fallback

STORE: inferred_page_list = page_list  # For Phase 3
```

### Phase 1: Style Extraction
**Command Construction**:
```bash
images_flag = --images present ? "--images \"{image_glob}\"" : ""
prompt_flag = --prompt present ? "--prompt \"{prompt_text}\"" : ""

# Use run-scoped base path
run_base_flag = "--base-path \"{base_path}/.design\""

# Use style_variants from Phase 0a
command = "/workflow:ui-design:extract {run_base_flag} {images_flag} {prompt_flag} --variants {style_variants}"
SlashCommand(command=command)
```
**Auto-Continue**: On completion, proceeds to Phase 2

---

### Phase 2: Style Consolidation with Separation (Auto-Triggered)
**Action**: Consolidates each style variant into separate design systems for matrix generation

**Command Construction**:
```bash
# Use run-scoped base path and keep styles separate
run_base_flag = "--base-path \"{base_path}/.design\""

# Use count-based parameter (automatically uses all style_variants)
command = "/workflow:ui-design:consolidate {run_base_flag} --variants {style_variants} --keep-separate"
```
**Command**: `SlashCommand(command=command)`
**Result**: Generates `style_variants` independent design systems:
- `.design/style-consolidation/style-1/design-tokens.json`
- `.design/style-consolidation/style-2/design-tokens.json`
- `.design/style-consolidation/style-3/design-tokens.json`

**Auto-Continue**: On completion, proceeds to Phase 3

---

### Phase 3: Matrix UI Generation (Auto-Triggered)
**Action**: Generates `style_variants × layout_variants × pages` prototypes using matrix mode

**Command Construction**:
```bash
run_base_flag = "--base-path \"{base_path}/.design\""
pages_flag = "--pages \"{inferred_page_list}\""

# Matrix mode is default in generate.md, no mode flag needed
command = "/workflow:ui-design:generate {run_base_flag} {pages_flag} --style-variants {style_variants} --layout-variants {layout_variants}"
SlashCommand(command=command)
```

**Result**: Generates `style_variants × layout_variants × pages` prototypes:
- File naming: `{page}-style-{s}-layout-{l}.html`
- Total prototypes: `style_variants * layout_variants * len(inferred_page_list)`
- Matrix visualization: `compare.html` with interactive 3×3 grid

**Auto-Continue**: On completion, proceeds to Phase 4

---

### Phase 4: Design System Integration (Auto-Triggered)
**Action**: Integrates all generated prototypes and the design system into the brainstorming artifacts

**Command Construction**:
```bash
session_flag = --session present ? "--session {session_id}" : ""
# --selected-prototypes is omitted to default to ALL generated prototypes
command = "/workflow:ui-design:update {session_flag}"
```
**Command**: `SlashCommand(command=command)`
**Auto-Continue**: If `--batch-plan` is present, proceeds to Phase 5. Otherwise, the workflow completes

---

### Phase 5: Batch Task Generation (Optional, Auto-Triggered)
**Condition**: Only executes if `--batch-plan` flag is present

**Execution**:
```bash
FOR each page IN inferred_page_list:
  SlashCommand(command="/workflow:plan --agent \"Implement {page} page based on design system\"")
```
**Completion**: The workflow is now complete

## TodoWrite Pattern (Autonomous)

```javascript
// Initialize (before Phase 1)
TodoWrite({todos: [
  {"content": "Execute style extraction", "status": "in_progress", "activeForm": "Executing style extraction"},
  {"content": "Execute style consolidation", "status": "pending", "activeForm": "Executing style consolidation"},
  {"content": "Execute UI prototype generation", "status": "pending", "activeForm": "Executing UI generation"},
  {"content": "Execute design system integration", "status": "pending", "activeForm": "Executing design system integration"}
]})

// After Phase 1 completes, before Phase 2 starts
TodoWrite({todos: [
  {"content": "Execute style extraction", "status": "completed", "activeForm": "Executing style extraction"},
  {"content": "Execute style consolidation", "status": "in_progress", "activeForm": "Executing style consolidation"},
  // ... rest are pending
]})

// After Phase 2 completes, before Phase 3 starts
TodoWrite({todos: [
  {"content": "Execute style extraction", "status": "completed"},
  {"content": "Execute style consolidation", "status": "completed", "activeForm": "Executing style consolidation"},
  {"content": "Execute UI prototype generation", "status": "in_progress", "activeForm": "Executing UI generation"},
  // ... rest are pending
]})

// This pattern continues until all phases are complete
```

## Error Handling

- **Phase Execution Failures**: The workflow will halt, keeping the failed phase `in_progress`. It will report the error and provide recovery instructions, suggesting a manual command execution with corrected parameters
- **Default Behavior**: In case of ambiguity (e.g., which variants to select), the system defaults to selecting ALL available items to ensure the workflow can proceed autonomously

## Key Improvements Over Previous Version

1. **Zero External Dependencies**: Pure Claude + agents, no CLI tools
2. **Streamlined Commands**: Removed `--tool` parameter and all CLI tool flags
3. **Consistent Execution**: All sub-commands use unified patterns
4. **Reproducible**: Deterministic flow with clear phase dependencies
5. **Simpler**: Fewer moving parts, easier to understand and debug

## Workflow Position

The workflow acts as the bridge between brainstorming (`synthesis-specification.md`) and planning (`/workflow:plan`), providing this connection in a fully automated fashion with options for deep creative exploration through parallel agents.

## Example Execution Flows

### Example 1: Default 3×3 Matrix (Prompt Inference)
```bash
/workflow:ui-design:auto --prompt "Modern minimalist blog with home, article, and author pages"

# Inferred: 3 style variants, 3 layout variants (default)
# Executes:
# 1. /workflow:ui-design:extract --base-path ".../run-xxx/.design" --prompt "..." --variants 3
# 2. /workflow:ui-design:consolidate --base-path ".../run-xxx/.design" --variants 3 --keep-separate
# 3. /workflow:ui-design:generate --base-path ".../run-xxx/.design" --pages "home,article,author" --style-variants 3 --layout-variants 3
# 4. /workflow:ui-design:update
# Total: 27 prototypes (3 styles × 3 layouts × 3 pages)
```

### Example 2: Custom 2×2 Matrix with Explicit Parameters
```bash
/workflow:ui-design:auto --session WFS-ecommerce --images "refs/*.png" --prompt "E-commerce" --style-variants 2 --layout-variants 2

# Executes:
# 1. /workflow:ui-design:extract --base-path ".workflow/WFS-ecommerce/runs/run-xxx/.design" --images "refs/*.png" --variants 2
# 2. /workflow:ui-design:consolidate --base-path "..." --variants 2 --keep-separate
# 3. /workflow:ui-design:generate --base-path "..." --pages "{inferred}" --style-variants 2 --layout-variants 2
# 4. /workflow:ui-design:update --session WFS-ecommerce
# Total: 2×2×N prototypes
```

### Example 3: Intelligent Parsing with Batch Planning
```bash
/workflow:ui-design:auto --session WFS-saas --prompt "Create 4 styles with 2 layouts for SaaS dashboard and settings" --batch-plan

# Parsed: --style-variants 4, --layout-variants 2
# Executes:
# 1. /workflow:ui-design:extract --variants 4
# 2. /workflow:ui-design:consolidate --variants 4 --keep-separate
# 3. /workflow:ui-design:generate --pages "dashboard,settings" --style-variants 4 --layout-variants 2
#    (generates 16 prototypes: 4 styles × 2 layouts × 2 pages)
# 4. /workflow:ui-design:update --session WFS-saas
# 5. /workflow:plan --agent "Implement dashboard page..."
#    /workflow:plan --agent "Implement settings page..."
```

## Final Completion Message

```
✅ UI Design Auto Workflow Complete!

Run ID: {run_id}
Session: {session_id or "standalone"}
Matrix: {style_variants}×{layout_variants} ({total_prototypes} total prototypes)
Input: {images and/or prompt summary}

Phase 1 - Style Extraction: {style_variants} style variants
Phase 2 - Style Consolidation: {style_variants} independent design systems
Phase 3 - Matrix Generation: {style_variants}×{layout_variants}×{pages_count} = {total_prototypes} prototypes
Phase 4 - Design Update: Brainstorming artifacts updated
{IF batch-plan: Phase 5 - Task Generation: {task_count} implementation tasks created}

📂 Run Output: {base_path}/
  ├── .design/style-consolidation/  ({style_variants} design systems)
  ├── .design/prototypes/           ({total_prototypes} HTML/CSS files)
  └── .run-metadata.json            (run configuration)

🌐 Interactive Preview: {base_path}/.design/prototypes/compare.html
  - 3×3 matrix view with synchronized scrolling
  - Zoom controls and fullscreen mode
  - Selection export for implementation

{IF batch-plan:
📋 Implementation Tasks: .workflow/WFS-{session}/.task/
Next: /workflow:execute to begin implementation
}
{ELSE:
Next Steps:
1. Open compare.html to preview all variants
2. Select preferred style×layout combinations
3. Run /workflow:plan to create implementation tasks
}
```
