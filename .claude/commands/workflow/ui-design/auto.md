---
name: auto
description: Fully autonomous UI design workflow with style extraction, consolidation, prototype generation, and design system integration
usage: /workflow:ui-design:auto [--prompt "<desc>"] [--images "<glob>"] [--pages "<list>"] [--session <id>] [--variants <count>] [--creative-variants <count>] [--batch-plan]
argument-hint: "[--prompt \"Modern SaaS\"] [--images \"refs/*.png\"] [--pages \"dashboard,auth\"] [--session WFS-xxx] [--variants 3] [--creative-variants 3]"
examples:
  - /workflow:ui-design:auto --prompt "Modern blog with home, article and author pages, dark theme"
  - /workflow:ui-design:auto --prompt "SaaS dashboard and settings" --variants 3 --creative-variants 3
  - /workflow:ui-design:auto --images "refs/*.png" --prompt "E-commerce site: home, product, cart"
  - /workflow:ui-design:auto --session WFS-auth --images "refs/*.png" --variants 2
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*), Glob(*), Task(conceptual-planning-agent)
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
- `--prompt "<description>"`: Text description of design style and pages
- `--variants <count>`: Number of style variants (Phase 1) or UI variants (Phase 3, standard mode) to generate (default: 1, range: 1-5)
- `--creative-variants <count>`: Number of **parallel agents** to launch for creative UI generation (Phase 3 only). This enables Creative Mode for layout exploration
- `--batch-plan`: Auto-generate implementation tasks after design-update (integrated mode only)

**Input Source Rules**:
- Must provide at least one of: `--images` or `--prompt`
- Both can be combined for guided style analysis

## Execution Modes

### Standard Mode (Default)
- Executes all phases sequentially
- **Phase 1 (Style Extraction)**: Generates multiple style options using the `--variants` parameter in a single execution
- **Phase 3 (UI Generation)**: Generates multiple UI prototypes using the `--variants` parameter in a single execution

### Creative Mode (with `--creative-variants`)
- Triggered by the `--creative-variants` parameter for **Phase 3 (UI Generation) only**
- Launches multiple, parallel `Task(conceptual-planning-agent)` instances to explore diverse UI layouts
- Each agent generates a single prototype for a single page, resulting in `N pages * M creative-variants` total prototypes
- This mode is ideal for initial UI exploration where a wide range of layout ideas is desired

### Integrated vs. Standalone Mode
- `--session` flag determines if the workflow is integrated with a larger session or runs standalone

## 5-Phase Execution

### Phase 0: Page Inference
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
session_flag = --session present ? "--session {session_id}" : ""

# Phase 1 always runs sequentially, using --variants to generate multiple style options
# --creative-variants does not apply to this phase
variants_flag = --variants present ? "--variants {variants_count}" : "--variants 1"
command = "/workflow:ui-design:extract {session_flag} {images_flag} {prompt_flag} {variants_flag}"
SlashCommand(command=command)
```
**Auto-Continue**: On completion, proceeds to Phase 2

---

### Phase 2: Style Consolidation (Auto-Triggered)
**Action**: Consolidates all style variants generated in Phase 1

**Command Construction**:
```bash
session_flag = --session present ? "--session {session_id}" : ""
# The --variants flag will list ALL variants from Phase 1 (auto-select all)
variants_list = get_all_variant_ids_from_phase_1_output()

command = "/workflow:ui-design:consolidate {session_flag} --variants \"{variants_list}\""
```
**Command**: `SlashCommand(command=command)`
**Note**: In auto mode, ALL style variants are consolidated automatically without user selection
**Auto-Continue**: On completion, proceeds to Phase 3

---

### Phase 3: UI Generation (Auto-Triggered)
**Action**: Generates UI prototypes based on the consolidated design system

**Command Construction**:
```bash
session_flag = --session present ? "--session {session_id}" : ""
pages_flag = "--pages \"{inferred_page_list}\" "

IF --creative-variants provided:
    # Creative Mode: Launch N agents × M pages in parallel for diverse layouts
    command = "/workflow:ui-design:generate {session_flag} {pages_flag}--creative-variants {creative_variants_count}"
ELSE:
    # Standard Mode: Single execution generating N variants for all pages
    variants_flag = --variants present ? "--variants {variants_count}" : "--variants 1"
    command = "/workflow:ui-design:generate {session_flag} {pages_flag}{variants_flag}"
```
**Command**: `SlashCommand(command=command)`
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

### Example 1: Text Prompt Only (Standalone)
```bash
/workflow:ui-design:auto --prompt "Modern minimalist blog with home, article, and author pages"

# Executes:
# 1. /workflow:ui-design:extract --prompt "..." --variants 1
# 2. /workflow:ui-design:consolidate --variants "variant-1"
# 3. /workflow:ui-design:generate --pages "home,article,author" --variants 1
# 4. /workflow:ui-design:update
```

### Example 2: Images + Prompt + Session (Integrated)
```bash
/workflow:ui-design:auto --session WFS-ecommerce --images "refs/*.png" --prompt "E-commerce with minimalist aesthetic" --variants 3

# Executes:
# 1. /workflow:ui-design:extract --session WFS-ecommerce --images "refs/*.png" --prompt "..." --variants 3
# 2. /workflow:ui-design:consolidate --session WFS-ecommerce --variants "variant-1,variant-2,variant-3"
# 3. /workflow:ui-design:generate --session WFS-ecommerce --pages "{inferred_from_synthesis}" --variants 1
# 4. /workflow:ui-design:update --session WFS-ecommerce
```

### Example 3: Creative Mode with Batch Planning
```bash
/workflow:ui-design:auto --session WFS-saas --prompt "SaaS dashboard and settings" --variants 2 --creative-variants 4 --batch-plan

# Executes:
# 1. /workflow:ui-design:extract --session WFS-saas --prompt "..." --variants 2
# 2. /workflow:ui-design:consolidate --session WFS-saas --variants "variant-1,variant-2"
# 3. /workflow:ui-design:generate --session WFS-saas --pages "dashboard,settings" --creative-variants 4
#    (launches 8 parallel agents: 2 pages × 4 creative variants)
# 4. /workflow:ui-design:update --session WFS-saas
# 5. /workflow:plan --agent "Implement dashboard page..."
#    /workflow:plan --agent "Implement settings page..."
```

## Final Completion Message

```
✅ UI Design Auto Workflow Complete!

Session: {session_id or "standalone"}
Mode: {standard|creative}
Input: {images and/or prompt summary}

Phase 1 - Style Extraction: {variants_count} style variants
Phase 2 - Style Consolidation: Unified design system
Phase 3 - UI Generation: {total_prototypes} prototypes ({mode} mode)
Phase 4 - Design Update: Brainstorming artifacts updated
{IF batch-plan: Phase 5 - Task Generation: {task_count} implementation tasks created}

📂 Design System: {base_path}/.design/
📂 Prototypes: {base_path}/.design/prototypes/
🌐 Preview: Open {base_path}/.design/prototypes/index.html

{IF batch-plan:
📋 Implementation Tasks: .workflow/WFS-{session}/.task/
Next: /workflow:execute to begin implementation
}
{ELSE:
Next Steps:
1. Preview prototypes in browser
2. Select preferred designs
3. Run /workflow:plan to create implementation tasks
}
```
