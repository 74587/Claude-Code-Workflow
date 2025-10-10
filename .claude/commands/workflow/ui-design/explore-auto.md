---
name: explore-auto
description: Exploratory UI design workflow - Generate and compare multiple style × layout combinations (3×3 matrix exploration)
usage: /workflow:ui-design:explore-auto [--prompt "<desc>"] [--images "<glob>"] [--targets "<list>"] [--target-type "page|component"] [--session <id>] [--style-variants <count>] [--layout-variants <count>] [--batch-plan]
examples:
  - /workflow:ui-design:explore-auto --prompt "Generate 3 style variants for modern blog: home, article, author"
  - /workflow:ui-design:explore-auto --prompt "SaaS dashboard and settings with 2 layout options"
  - /workflow:ui-design:explore-auto --images "refs/*.png" --prompt "E-commerce: home, product, cart" --style-variants 3 --layout-variants 3
  - /workflow:ui-design:explore-auto --session WFS-auth --images "refs/*.png"
  - /workflow:ui-design:explore-auto --targets "navbar,hero" --target-type "component" --prompt "Compare 3 navigation bar designs" --style-variants 3 --layout-variants 2
  - /workflow:ui-design:explore-auto --targets "card,form,button" --images "refs/*.png" --style-variants 2 --layout-variants 3
  - /workflow:ui-design:explore-auto --targets "home,dashboard" --target-type "page"
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*), Glob(*), Write(*), Task(conceptual-planning-agent)
---

# UI Design Auto Workflow Command

## Overview & Execution Model

**Fully autonomous orchestrator**: Executes all design phases sequentially from style extraction to design integration, with optional batch planning.

**Unified Target System**: Generates `style_variants × layout_variants × targets` prototypes, where targets can be:
- **Pages** (full-page layouts): home, dashboard, settings, etc.
- **Components** (isolated UI elements): navbar, card, hero, form, etc.
- **Mixed**: Can combine both in a single workflow

**Autonomous Flow** (⚠️ CONTINUOUS EXECUTION - DO NOT STOP):
1. User triggers: `/workflow:ui-design:explore-auto [params]`
2. Phase 1 (style-extract) → **WAIT for completion** → Auto-continues
3. Phase 2 (style-consolidate) → **WAIT for completion** → Auto-continues
4. Phase 3 (ui-generate) → **WAIT for completion** → Auto-continues with unified target list
5. Phase 4 (design-update) → **WAIT for completion** → Auto-continues
6. Phase 5 (batch-plan, optional) → Reports completion

**Auto-Continue Mechanism**: TodoWrite tracks phase status. Upon each phase completion, you MUST immediately construct and execute the next phase command. No user intervention required. The workflow is NOT complete until reaching Phase 4 (or Phase 5 if --batch-plan).

**Target Type Detection**: Automatically inferred from prompt/targets, or explicitly set via `--target-type`.

## Core Rules

1. **Start Immediately**: TodoWrite initialization → Phase 1 execution
2. **No Preliminary Validation**: Sub-commands handle their own validation
3. **Parse & Pass**: Extract data from each output for next phase
4. **Default to All**: When selecting variants/prototypes, use ALL generated items
5. **Track Progress**: Update TodoWrite after each phase
6. **⚠️ CRITICAL: DO NOT STOP** - This is a continuous multi-phase workflow. After each SlashCommand completes, you MUST wait for completion, then immediately execute the next phase. Workflow is NOT complete until Phase 4 (or Phase 5 if --batch-plan).

## Parameter Requirements

**Optional Parameters** (all have smart defaults):
- `--targets "<list>"`: Comma-separated targets (pages/components) to generate (inferred from prompt/session if omitted)
- `--target-type "page|component|auto"`: Explicitly set target type (default: `auto` - intelligent detection)
- `--session <id>`: Workflow session ID (standalone mode if omitted)
- `--images "<glob>"`: Reference image paths (default: `design-refs/*`)
- `--prompt "<description>"`: Design style and target description
- `--style-variants <count>`: Style variants (default: inferred from prompt or 3, range: 1-5)
- `--layout-variants <count>`: Layout variants per style (default: inferred or 3, range: 1-5)
- `--batch-plan`: Auto-generate implementation tasks after design-update

**Legacy Parameters** (maintained for backward compatibility):
- `--pages "<list>"`: Alias for `--targets` with `--target-type page`
- `--components "<list>"`: Alias for `--targets` with `--target-type component`

**Input Rules**:
- Must provide at least one: `--images` or `--prompt` or `--targets`
- Multiple parameters can be combined for guided analysis
- If `--targets` not provided, intelligently inferred from prompt/session

**Supported Target Types**:
- **Pages** (full layouts): home, dashboard, settings, profile, login, etc.
- **Components** (UI elements):
  - Navigation: navbar, header, menu, breadcrumb, tabs, sidebar
  - Content: hero, card, list, table, grid, timeline
  - Input: form, search, filter, input-group
  - Feedback: modal, alert, toast, badge, progress
  - Media: gallery, carousel, video-player, image-card
  - Other: footer, pagination, dropdown, tooltip, avatar

**Intelligent Prompt Parsing**: Extracts variant counts from natural language:
- "Generate **3 style variants**" → `--style-variants 3`
- "**2 layout options**" → `--layout-variants 2`
- "Create **4 styles** with **2 layouts each**" → `--style-variants 4 --layout-variants 2`
- Explicit flags override prompt inference

## Execution Modes

**Matrix Mode** (unified):
- Generates `style_variants × layout_variants × targets` prototypes
- **Phase 1**: `style_variants` style options (extract)
- **Phase 2**: `style_variants` independent design systems (consolidate)
- **Phase 3**: Layout planning + UI generation (generate)
  - Sub-phase 1: `targets × layout_variants` target-specific layout plans
  - Sub-phase 2: `layout_variants × targets` HTML/CSS templates
  - Sub-phase 3: `style_variants × layout_variants × targets` final prototypes
  - Pages: Full-page layouts with complete structure
  - Components: Isolated elements with minimal wrapper
  - Mixed: Combination based on intelligent detection

**Integrated vs. Standalone**:
- `--session` flag determines session integration or standalone execution

## 6-Phase Execution

### Phase 0a: Intelligent Prompt Parsing
```bash
# Parse variant counts from prompt or use explicit/default values
IF --prompt AND (NOT --style-variants OR NOT --layout-variants):
    style_variants = regex_extract(prompt, r"(\d+)\s*style") OR --style-variants OR 3
    layout_variants = regex_extract(prompt, r"(\d+)\s*layout") OR --layout-variants OR 3
ELSE:
    style_variants = --style-variants OR 3
    layout_variants = --layout-variants OR 3

VALIDATE: 1 <= style_variants <= 5, 1 <= layout_variants <= 5
```

### Phase 0b: Run Initialization & Directory Setup
```bash
run_id = "run-$(date +%Y%m%d-%H%M%S)"
base_path = --session ? ".workflow/WFS-{session}/design-${run_id}" : ".workflow/.design/${run_id}"

Bash(mkdir -p "${base_path}/{style-extraction,style-consolidation,prototypes}")

Write({base_path}/.run-metadata.json): {
  "run_id": "${run_id}", "session_id": "${session_id}", "timestamp": "...",
  "workflow": "ui-design:auto",
  "parameters": { "style_variants": ${style_variants}, "layout_variants": ${layout_variants},
                  "targets": "${inferred_target_list}", "target_type": "${target_type}",
                  "prompt": "${prompt_text}", "images": "${images_pattern}" },
  "status": "in_progress"
}
```

### Phase 0c: Unified Target Inference with Intelligent Type Detection
```bash
# Priority: --pages/--components (legacy) → --targets → --prompt analysis → synthesis → default
target_list = []; target_type = "auto"; target_source = "none"

# Step 1-2: Explicit parameters (legacy or unified)
IF --pages: target_list = split(--pages); target_type = "page"; target_source = "explicit_legacy"
ELSE IF --components: target_list = split(--components); target_type = "component"; target_source = "explicit_legacy"
ELSE IF --targets:
    target_list = split(--targets); target_source = "explicit"
    target_type = --target-type != "auto" ? --target-type : detect_target_type(target_list)

# Step 3: Prompt analysis (Claude internal analysis)
ELSE IF --prompt:
    analysis_result = analyze_prompt("{prompt_text}")  # Extract targets, types, purpose
    target_list = analysis_result.targets
    target_type = analysis_result.primary_type OR detect_target_type(target_list)
    target_source = "prompt_analysis"

# Step 4: Session synthesis
ELSE IF --session AND exists(synthesis-specification.md):
    target_list = extract_targets_from_synthesis(); target_type = "page"; target_source = "synthesis"

# Step 5: Fallback
IF NOT target_list: target_list = ["home"]; target_type = "page"; target_source = "default"

# Validate and clean
validated_targets = [normalize(t) for t in target_list if is_valid(t)]
IF NOT validated_targets: validated_targets = ["home"]; target_type = "page"
IF --target-type != "auto": target_type = --target-type

# Interactive confirmation
DISPLAY_CONFIRMATION(target_type, target_source, validated_targets):
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  "{emoji} {LABEL} CONFIRMATION"
  "Type: {target_type} | Source: {target_source}"
  "Targets ({count}): {', '.join(validated_targets)}"
  "Options: 'continue/yes' | 'targets: a,b' | 'skip: x' | 'add: y' | 'type: page|component'"
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

user_input = WAIT_FOR_USER_INPUT()

# Process user modifications
MATCH user_input:
  "continue|yes|ok" → proceed
  "targets: ..." → validated_targets = parse_new_list()
  "skip: ..." → validated_targets = remove_items()
  "add: ..." → validated_targets = add_items()
  "type: ..." → target_type = extract_type()
  default → proceed with current list

STORE: inferred_target_list, target_type, target_inference_source
```

**Helper Function: detect_target_type()**
```bash
detect_target_type(target_list):
    page_keywords = ["home", "dashboard", "settings", "profile", "login", "signup", "auth", ...]
    component_keywords = ["navbar", "header", "footer", "hero", "card", "button", "form", ...]

    page_matches = count_matches(target_list, page_keywords + ["page", "screen", "view"])
    component_matches = count_matches(target_list, component_keywords + ["component", "widget"])

    RETURN "component" IF component_matches > page_matches ELSE "page"
```

### Phase 1: Style Extraction
```bash
command = "/workflow:ui-design:extract --base-path \"{base_path}\" " +
          (--images ? "--images \"{images}\" " : "") +
          (--prompt ? "--prompt \"{prompt}\" " : "") +
          "--variants {style_variants} --mode explore"
SlashCommand(command)

# WAIT for extract command to complete, then IMMEDIATELY continue to Phase 2
# DO NOT STOP - Phase 2 must execute automatically
```

### Phase 2: Style Consolidation
```bash
command = "/workflow:ui-design:consolidate --base-path \"{base_path}\" " +
          "--variants {style_variants}"
SlashCommand(command)

# WAIT for consolidate command to complete, then IMMEDIATELY continue to Phase 3
# DO NOT STOP - Phase 3 must execute automatically
# Output: style_variants independent design systems (design tokens and style guides)
```

### Phase 3: Matrix UI Generation (with Layout Planning)
```bash
targets_string = ",".join(inferred_target_list)
command = "/workflow:ui-design:generate --base-path \"{base_path}\" " +
          "--targets \"{targets_string}\" --target-type \"{target_type}\" " +
          "--style-variants {style_variants} --layout-variants {layout_variants}"

total = style_variants × layout_variants × len(inferred_target_list)
REPORT: "🚀 Phase 3: {type_icon} {targets_string} | Matrix: {s}×{l}×{n} = {total} prototypes"
REPORT: "   → Layout planning: {len(inferred_target_list)}×{layout_variants} target-specific layouts"

SlashCommand(command)

# WAIT for generate command to complete, then IMMEDIATELY continue to Phase 4
# DO NOT STOP - Phase 4 must execute automatically
# Output:
# - {target}-layout-{l}.json (target-specific layout plans)
# - {target}-style-{s}-layout-{l}.html (final prototypes)
# - compare.html (matrix view)
```

### Phase 4: Design System Integration
```bash
command = "/workflow:ui-design:update" + (--session ? " --session {session_id}" : "")
SlashCommand(command)

# WAIT for update command to complete
# If --batch-plan flag present: IMMEDIATELY continue to Phase 5
# If no --batch-plan: Workflow complete, display final report
```

### Phase 5: Batch Task Generation (Optional)
```bash
IF --batch-plan:
    FOR target IN inferred_target_list:
        task_desc = "Implement {target} {target_type} based on design system"
        SlashCommand("/workflow:plan --agent \"{task_desc}\"")
```

## TodoWrite Pattern
```javascript
// Initialize at workflow start to track multi-phase execution
TodoWrite({todos: [
  {"content": "Execute style extraction", "status": "in_progress", "activeForm": "Executing..."},
  {"content": "Execute style consolidation", "status": "pending", "activeForm": "Executing..."},
  {"content": "Execute UI generation", "status": "pending", "activeForm": "Executing..."},
  {"content": "Execute design integration", "status": "pending", "activeForm": "Executing..."}
]})

// ⚠️ CRITICAL: After EACH phase completion, you MUST:
// 1. Update current phase: status → "completed"
// 2. Update next phase: status → "in_progress"
// 3. Continue to execute next phase immediately
// This ensures continuous workflow tracking and prevents premature stopping
```

## Key Features
- **Autonomous**: No user intervention required between phases
- **Intelligent**: Parses natural language, infers targets/types
- **Reproducible**: Deterministic flow with isolated run directories
- **Flexible**: Supports pages, components, or mixed targets

## Examples

### 1. Page Mode (Prompt Inference)
```bash
/workflow:ui-design:explore-auto --prompt "Modern blog: home, article, author"
# Result: 27 prototypes (3×3×3 - inferred defaults)
```

### 2. Custom Matrix with Session
```bash
/workflow:ui-design:explore-auto --session WFS-ecommerce --images "refs/*.png" --style-variants 2 --layout-variants 2
# Result: 2×2×N prototypes (targets from synthesis)
```

### 3. Component Mode
```bash
/workflow:ui-design:explore-auto --targets "navbar,hero" --target-type "component" --style-variants 3 --layout-variants 2
# Result: 12 prototypes (3×2×2 components with minimal wrapper)
```

### 4. Intelligent Parsing + Batch Planning
```bash
/workflow:ui-design:explore-auto --prompt "Create 4 styles with 2 layouts for dashboard and settings" --batch-plan
# Result: 16 prototypes (4×2×2) + auto-generated implementation tasks
```

### 5. Legacy Support
```bash
/workflow:ui-design:explore-auto --pages "home,dashboard,settings"
# Equivalent to: --targets "home,dashboard,settings" --target-type "page"
```

## Completion Output
```
✅ UI Design Explore-Auto Workflow Complete!

Run ID: {run_id} | Session: {session_id or "standalone"}
Type: {icon} {target_type} | Matrix: {s}×{l}×{n} = {total} prototypes

Phase 1: {s} style variants (extract)
Phase 2: {s} design systems (consolidate)
Phase 3: Layout planning + generation (generate)
  - {n}×{l} target-specific layout plans
  - {l}×{n} HTML/CSS templates
  - {s}×{l}×{n} = {total} final prototypes
Phase 4: Brainstorming artifacts updated
[Phase 5: {n} implementation tasks created]  # if --batch-plan

📂 {base_path}/
  ├── style-consolidation/  ({s} design systems)
  ├── prototypes/
  │   ├── _templates/       ({n}×{l} layout JSON + {l}×{n} HTML/CSS)
  │   └── ...               ({total} final prototypes)
  └── .run-metadata.json

🌐 Preview: {base_path}/prototypes/compare.html
  - Interactive {s}×{l} matrix view
  - Side-by-side comparison
  - Target-specific layouts per prototype

{icon} Targets: {', '.join(targets)} (type: {target_type})
  - Each target has {l} custom-designed layouts
  - Layout plans stored as structured JSON

Next: [/workflow:execute] OR [Open compare.html → Select → /workflow:plan]
```
