---
name: explore-auto
description: Exploratory UI design workflow - Generate and compare multiple style × layout combinations (3×3 matrix exploration)
usage: /workflow:ui-design:explore-auto [--prompt "<desc>"] [--images "<glob>"] [--targets "<list>"] [--target-type "page|component"] [--session <id>] [--style-variants <count>] [--layout-variants <count>] [--batch-plan]
argument-hint: "[--prompt \"Modern SaaS with 3 styles\"] [--images \"refs/*.png\"] [--targets \"dashboard,auth,navbar,hero\"] [--target-type \"auto\"] [--session WFS-xxx] [--style-variants 3] [--layout-variants 3]"
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

**Autonomous Flow**:
1. User triggers: `/workflow:ui-design:explore-auto [params]`
2. Phase 1 (style-extract) → Auto-continues
3. Phase 2 (style-consolidate) → Auto-continues
4. Phase 3 (ui-generate) → Auto-continues with unified target list
5. Phase 4 (design-update) → Auto-continues
6. Phase 5 (batch-plan, optional) → Reports completion

**Auto-Continue Mechanism**: TodoWrite tracks phase status. Upon completion, coordinator constructs next command and executes immediately. No user intervention required.

**Target Type Detection**: Automatically inferred from prompt/targets, or explicitly set via `--target-type`.

## Core Rules

1. **Start Immediately**: TodoWrite initialization → Phase 1 execution
2. **No Preliminary Validation**: Sub-commands handle their own validation
3. **Parse & Pass**: Extract data from each output for next phase
4. **Default to All**: When selecting variants/prototypes, use ALL generated items
5. **Track Progress**: Update TodoWrite after each phase

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
- **Phase 1**: `style_variants` style options
- **Phase 2**: `style_variants` independent design systems
- **Phase 3**: `style_variants × layout_variants × targets` prototypes
  - Pages: Full-page layouts with complete structure
  - Components: Isolated elements with minimal wrapper
  - Mixed: Combination based on intelligent detection

**Integrated vs. Standalone**:
- `--session` flag determines session integration or standalone execution

## 6-Phase Execution

### Phase 0a: Intelligent Prompt Parsing
```bash
# Extract variant counts from prompt if not explicitly provided
IF --prompt provided AND (NOT --style-variants OR NOT --layout-variants):
    # Parse: "3 style variants", "4 styles", "2 layout options", "3 layouts each"
    style_match = regex_search(prompt_text, r"(\d+)\s*(style\s*variants?|styles?)")
    layout_match = regex_search(prompt_text, r"(\d+)\s*(layout\s*(variants?|options?)|layouts?)")

    style_variants = style_match ? int(match[1]) : (--style-variants OR 3)
    layout_variants = layout_match ? int(match[1]) : (--layout-variants OR 3)
ELSE:
    style_variants = --style-variants OR 3
    layout_variants = --layout-variants OR 3

VALIDATE: 1 <= style_variants <= 5, 1 <= layout_variants <= 5
STORE: style_variants, layout_variants
```

### Phase 0b: Run Initialization & Directory Setup
```bash
# Generate run ID and determine base path
run_id = "run-$(date +%Y%m%d-%H%M%S)"

IF --session:
    base_path = ".workflow/WFS-{session_id}/design-${run_id}"
ELSE:
    base_path = ".workflow/.design/${run_id}"

# Create directories
Bash(mkdir -p "${base_path}/{style-extraction,style-consolidation,prototypes}")

# Initialize metadata
Write({base_path}/.run-metadata.json): {
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

STORE: run_id, base_path
```

### Phase 0c: Unified Target Inference with Intelligent Type Detection
```bash
target_list = []
target_type = "auto"  # auto, page, component
target_source = "none"

# Step 1: Handle legacy parameters (backward compatibility)
IF --pages provided:
    target_list = split_and_clean(--pages, delimiters=[",", ";", "、"])
    target_type = "page"
    target_source = "explicit_legacy"
    REPORT: "📋 Using explicitly provided pages (legacy): {', '.join(target_list)}"
ELSE IF --components provided:
    target_list = split_and_clean(--components, delimiters=[",", ";", "、"])
    target_type = "component"
    target_source = "explicit_legacy"
    REPORT: "🧩 Using explicitly provided components (legacy): {', '.join(target_list)}"

# Step 2: Handle unified --targets parameter
ELSE IF --targets provided:
    target_list = split_and_clean(--targets, delimiters=[",", ";", "、"])
    target_source = "explicit"

    # Override type if explicitly set
    IF --target-type provided AND --target-type != "auto":
        target_type = --target-type
        REPORT: "🎯 Using explicitly provided targets with type '{target_type}': {', '.join(target_list)}"
    ELSE:
        # Intelligent type detection
        target_type = detect_target_type(target_list)
        REPORT: "🎯 Using explicitly provided targets (detected type: {target_type}): {', '.join(target_list)}"

# Step 3: Dynamic prompt analysis
ELSE IF --prompt provided:
    REPORT: "🔍 Analyzing prompt to identify targets..."

    # Internal Claude analysis
    analysis_prompt = """
    Analyze the UI design request and identify targets (pages or components) with their types.

    Request: "{prompt_text}"

    Output JSON:
    {
      "targets": [
        {"name": "normalized-name", "type": "page|component", "purpose": "description", "priority": "high|medium|low"}
      ],
      "primary_type": "page|component|mixed",
      "shared_elements": ["header", "footer"],
      "context": "application context description"
    }

    Rules:
    - Normalize to URL-friendly (lowercase, hyphens, no spaces)
    - Detect type: page (full layouts like home, dashboard) vs component (UI elements like navbar, card)
    - Consolidate synonyms (homepage → home, navigation → navbar)
    - Common pages: home, dashboard, settings, profile, login, signup
    - Common components: navbar, header, hero, card, form, button, modal, footer
    - If prompt mentions "page", "screen", "view" → type: page
    - If prompt mentions "component", "element", "widget" → type: component
    """

    target_structure = analyze_prompt_structure(analysis_prompt, prompt_text)
    target_list = extract_target_names_from_structure(target_structure)
    target_type = target_structure.primary_type OR detect_target_type(target_list)
    target_source = "prompt_analysis"

    IF target_list:
        REPORT: "🎯 Identified targets from prompt (type: {target_type}):"
        FOR target IN target_structure.targets:
            icon = "📄" IF target.type == "page" ELSE "🧩"
            REPORT: "   {icon} {target.name}: {target.purpose} [{target.priority}]"
        IF target_structure.shared_elements:
            REPORT: "🔧 Shared elements: {', '.join(shared_elements)}"

# Step 4: Extract from synthesis-specification.md (for session mode)
ELSE IF --session AND exists(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md):
    synthesis = Read(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md)
    target_list = extract_targets_from_synthesis(synthesis)  # Returns pages by default
    target_type = "page"
    target_source = "synthesis"
    REPORT: "📋 Extracted from synthesis: {', '.join(target_list)}"

# Step 5: Fallback default
IF NOT target_list:
    target_list = ["home"]
    target_type = "page"
    target_source = "default"
    REPORT: "⚠️ No targets identified, using default: 'home' (page)"

# Validate and clean target names
validated_targets = []
invalid_targets = []
FOR target IN target_list:
    cleaned = target.strip().lower().replace(" ", "-")
    IF regex_match(cleaned, r"^[a-z0-9][a-z0-9_-]*$"):
        validated_targets.append(cleaned)
    ELSE:
        invalid_targets.append(target)

IF invalid_targets:
    REPORT: "⚠️ Skipped invalid: {', '.join(invalid_targets)}"

IF NOT validated_targets:
    validated_targets = ["home"]
    target_type = "page"
    REPORT: "⚠️ All invalid, using default: 'home'"

# Override target type if explicitly set
IF --target-type provided AND --target-type != "auto":
    target_type = --target-type
    REPORT: "🔧 Target type overridden to: {target_type}"

# Interactive confirmation
type_emoji = "📄" IF target_type == "page" ELSE ("🧩" IF target_type == "component" ELSE "🎯")
type_label = "PAGES" IF target_type == "page" ELSE ("COMPONENTS" IF target_type == "component" ELSE "TARGETS")

REPORT: ""
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "{type_emoji} {type_label} CONFIRMATION"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "Type: {target_type}"
REPORT: "Source: {target_source}"
REPORT: "Targets ({len(validated_targets)}): {', '.join(validated_targets)}"
REPORT: ""
REPORT: "Options:"
REPORT: "  • 'continue/yes' - proceed"
REPORT: "  • 'targets: item1,item2' - replace list"
REPORT: "  • 'skip: item-name' - remove targets"
REPORT: "  • 'add: item-name' - add targets"
REPORT: "  • 'type: page|component' - change type"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

user_input = WAIT_FOR_USER_INPUT()

# Process input
IF user_input MATCHES r"^(continue|yes|ok|proceed)$":
    REPORT: "✅ Proceeding with {len(validated_targets)} {target_type}(s): {', '.join(validated_targets)}"
ELSE IF user_input MATCHES r"^targets:\s*(.+)$":
    new_targets = split_and_clean(extract_after("targets:"), [",", ";"])
    validated_targets = [t.strip().lower().replace(" ", "-") for t in new_targets if t.strip()]
    REPORT: "✅ Updated: {', '.join(validated_targets)}"
ELSE IF user_input MATCHES r"^skip:\s*(.+)$":
    to_skip = [t.strip().lower() for t in extract_after("skip:").split(",")]
    validated_targets = [t for t in validated_targets if t not in to_skip]
    REPORT: "✅ Removed: {', '.join(to_skip)}, Final: {', '.join(validated_targets)}"
ELSE IF user_input MATCHES r"^add:\s*(.+)$":
    to_add = [t.strip().lower().replace(" ", "-") for t in extract_after("add:").split(",") if t.strip()]
    validated_targets.extend(to_add)
    validated_targets = list(dict.fromkeys(validated_targets))  # Remove duplicates
    REPORT: "✅ Added: {', '.join(to_add)}, Final: {', '.join(validated_targets)}"
ELSE IF user_input MATCHES r"^type:\s*(page|component)$":
    target_type = extract_after("type:").strip()
    REPORT: "✅ Type changed to: {target_type}"
ELSE:
    REPORT: "⚠️ Invalid input, proceeding with: {', '.join(validated_targets)}"

IF NOT validated_targets:
    validated_targets = ["home"]
    target_type = "page"

STORE: inferred_target_list = validated_targets
STORE: target_type = target_type
STORE: target_inference_source = target_source
STORE: target_structure_data = target_structure IF exists(target_structure) ELSE {}
```

**Helper Function: detect_target_type()**
```bash
detect_target_type(target_list):
    # Common page keywords
    page_keywords = ["home", "dashboard", "settings", "profile", "login", "signup", "auth",
                     "landing", "about", "contact", "pricing", "account", "admin"]

    # Common component keywords
    component_keywords = ["navbar", "header", "footer", "hero", "card", "button", "form",
                          "modal", "alert", "toast", "menu", "sidebar", "breadcrumb", "tabs",
                          "table", "list", "grid", "carousel", "gallery", "search", "filter"]

    page_matches = 0
    component_matches = 0

    FOR target IN target_list:
        IF target IN page_keywords:
            page_matches += 1
        ELSE IF target IN component_keywords:
            component_matches += 1
        ELSE IF contains_keyword(target, ["page", "screen", "view"]):
            page_matches += 1
        ELSE IF contains_keyword(target, ["component", "widget", "element"]):
            component_matches += 1

    # Decision logic
    IF component_matches > page_matches:
        RETURN "component"
    ELSE IF page_matches > 0 OR len(target_list) == 0:
        RETURN "page"
    ELSE:
        # Ambiguous - default to page
        RETURN "page"
```

### Phase 1: Style Extraction
**Command**:
```bash
images_flag = --images present ? "--images \"{image_glob}\"" : ""
prompt_flag = --prompt present ? "--prompt \"{prompt_text}\"" : ""
run_base_flag = "--base-path \"{base_path}\""

command = "/workflow:ui-design:extract {run_base_flag} {images_flag} {prompt_flag} --variants {style_variants}"
SlashCommand(command)
```
**Auto-Continue**: On completion → Phase 2

---

### Phase 2: Style Consolidation (Separate Design Systems)
**Command**:
```bash
run_base_flag = "--base-path \"{base_path}\""

# Consolidate generates independent design systems by default
# IMPORTANT: Pass --layout-variants to ensure correct number of layout strategies are generated
command = "/workflow:ui-design:consolidate {run_base_flag} --variants {style_variants} --layout-variants {layout_variants}"
SlashCommand(command)
```
**Result**: Generates `style_variants` independent design systems:
- `style-consolidation/style-1/design-tokens.json`
- `style-consolidation/style-{N}/design-tokens.json`

**Auto-Continue**: On completion → Phase 3

---

### Phase 3: Matrix UI Generation (Unified)
**Command**:
```bash
run_base_flag = "--base-path \"{base_path}\""

# Build unified targets string
targets_string = ",".join(inferred_target_list)
VERIFY: targets_string matches r"^[a-z0-9_-]+(,[a-z0-9_-]+)*$"

# Prepare command with unified parameters
targets_flag = "--targets \"{targets_string}\""
type_flag = "--target-type \"{target_type}\""

command = "/workflow:ui-design:generate {run_base_flag} {targets_flag} {type_flag} --style-variants {style_variants} --layout-variants {layout_variants}"

total_prototypes = style_variants * layout_variants * len(inferred_target_list)

# Report based on type
IF target_type == "page":
    type_icon = "📄"
    type_label = "Pages"
    context_note = "Full-page layouts"
ELSE IF target_type == "component":
    type_icon = "🧩"
    type_label = "Components"
    context_note = "Isolated elements with minimal wrapper"
ELSE:
    type_icon = "🎯"
    type_label = "Targets"
    context_note = "Mixed pages and components"

REPORT: "🚀 Phase 3: Matrix UI Generation"
REPORT: "   {type_icon} {type_label}: {targets_string}"
REPORT: "   Matrix: {style_variants}×{layout_variants}"
REPORT: "   Total: {total_prototypes} prototypes"
REPORT: "   Context: {context_note}"

SlashCommand(command)
```

**Result**:
- File naming: `{target}-style-{s}-layout-{l}.html`
- Total: `style_variants × layout_variants × targets`
- Matrix view: `compare.html` with interactive grid
- Rendering: Full-page for pages, minimal wrapper for components

**Auto-Continue**: On completion → Phase 4

---

### Phase 4: Design System Integration
**Command**:
```bash
session_flag = --session present ? "--session {session_id}" : ""

# Omit --selected-prototypes to use ALL generated prototypes
command = "/workflow:ui-design:update {session_flag}"
SlashCommand(command)
```
**Auto-Continue**: If `--batch-plan` present → Phase 5, else complete

---

### Phase 5: Batch Task Generation (Optional)
**Condition**: Only if `--batch-plan` flag present

**Execution**:
```bash
FOR target IN inferred_target_list:
    IF target_type == "page":
        SlashCommand("/workflow:plan --agent \"Implement {target} page based on design system\"")
    ELSE IF target_type == "component":
        SlashCommand("/workflow:plan --agent \"Implement {target} component based on design system\"")
    ELSE:
        SlashCommand("/workflow:plan --agent \"Implement {target} based on design system\"")
```
**Completion**: Workflow complete

## TodoWrite Pattern

```javascript
// Initialize
TodoWrite({todos: [
  {"content": "Execute style extraction", "status": "in_progress", "activeForm": "Executing style extraction"},
  {"content": "Execute style consolidation", "status": "pending", "activeForm": "Executing style consolidation"},
  {"content": "Execute UI prototype generation", "status": "pending", "activeForm": "Executing UI generation"},
  {"content": "Execute design system integration", "status": "pending", "activeForm": "Executing design system integration"}
]})

// After each phase: Mark current completed, next in_progress, rest pending
// Phase 1 done → Phase 2 in_progress
// Phase 2 done → Phase 3 in_progress
// ... continues until all completed
```

## Error Handling

- **Phase Failures**: Workflow halts, keeps failed phase `in_progress`, reports error with recovery instructions
- **Ambiguity**: Defaults to ALL available items (variants/prototypes) to ensure autonomous continuation

## Key Features & Workflow Position

**Core Improvements**:
- **Zero External Dependencies**: Pure Claude + agents, no CLI tools
- **Streamlined Commands**: Unified patterns, no tool-specific flags
- **Reproducible Flow**: Deterministic phase dependencies
- **Intelligent Parsing**: Natural language → variant counts, pages
- **Run Isolation**: Each execution in timestamped run directory

**Workflow Bridge**: Connects brainstorming (`synthesis-specification.md`) → design phase → planning (`/workflow:plan`) in fully automated fashion with matrix-based design exploration.

## Example Execution Flows

### Example 1: Default 3×3 Matrix (Page Mode - Prompt Inference)
```bash
/workflow:ui-design:explore-auto --prompt "Modern minimalist blog with home, article, and author pages"

# Auto-detected type: page
# Inferred: 3 style variants, 3 layout variants (default)
# Targets: home, article, author
# Total: 27 full-page prototypes (3×3×3)
```

### Example 2: Custom 2×2 Matrix with Session
```bash
/workflow:ui-design:explore-auto --session WFS-ecommerce --images "refs/*.png" --style-variants 2 --layout-variants 2

# Auto-detected from session synthesis
# Total: 2×2×N prototypes (N from inference)
```

### Example 3: Unified - Navbar Design Comparison
```bash
/workflow:ui-design:explore-auto --targets "navbar,hero" --target-type "component" --prompt "Compare 3 navigation bar designs for SaaS product" --style-variants 3 --layout-variants 2

# Explicit type: component
# Targets: navbar, hero
# Matrix: 3 styles × 2 layouts
# Total: 12 component prototypes (3×2×2)
# Output: navbar-style-1-layout-1.html, navbar-style-1-layout-2.html, ...
```

### Example 4: Unified - Card & Form Exploration
```bash
/workflow:ui-design:explore-auto --targets "card,form,button" --images "refs/*.png" --style-variants 2 --layout-variants 3

# Auto-detected type: component (based on keywords)
# Targets: card, form, button
# Matrix: 2 styles × 3 layouts
# Total: 18 component prototypes (2×3×3)
# Context: Each component in minimal wrapper for isolated comparison
```

### Example 5: Intelligent Parsing + Batch Planning
```bash
/workflow:ui-design:explore-auto --session WFS-saas --prompt "Create 4 styles with 2 layouts for SaaS dashboard and settings" --batch-plan

# Auto-detected type: page
# Parsed: 4 styles, 2 layouts
# Targets: dashboard, settings
# Total: 16 full-page prototypes (4×2×2)
# Auto-generates implementation tasks for each target
```

### Example 6: Auto-Detected Components from Prompt
```bash
/workflow:ui-design:explore-auto --prompt "Design exploration for pricing table and testimonial card components" --style-variants 3 --layout-variants 2

# Auto-detected type: component (keyword: "components")
# Inferred targets: pricing-table, testimonial-card
# Matrix: 3 styles × 2 layouts
# Total: 12 component prototypes (3×2×2)
```

### Example 7: Legacy Parameter Support
```bash
# Using legacy --pages parameter (backward compatible)
/workflow:ui-design:explore-auto --pages "home,dashboard,settings"

# Equivalent to: --targets "home,dashboard,settings" --target-type "page"
```

### Example 8: Mixed Mode (Future Enhancement)
```bash
/workflow:ui-design:explore-auto --targets "home,dashboard,navbar,hero,card" --target-type "auto"

# Auto-detection: home, dashboard → page; navbar, hero, card → component
# Generates appropriate wrapper for each target type
# Future: Support per-target type specification
```

## Final Completion Message

**Unified Template**:
```
✅ UI Design Explore-Auto Workflow Complete!

Run ID: {run_id}
Session: {session_id or "standalone"}
Type: {target_type_icon} {target_type_label}
Matrix: {style_variants}×{layout_variants} ({total_prototypes} total prototypes)
Input: {images and/or prompt summary}

Phase 1 - Style Extraction: {style_variants} style variants
Phase 2 - Style Consolidation: {style_variants} independent design systems
Phase 3 - Matrix Generation: {style_variants}×{layout_variants}×{target_count} = {total_prototypes} prototypes
Phase 4 - Design Update: Brainstorming artifacts updated
{IF batch-plan: Phase 5 - Task Generation: {task_count} implementation tasks created}

📂 Run Output: {base_path}/
  ├── style-consolidation/  ({style_variants} design systems)
  ├── prototypes/           ({total_prototypes} HTML/CSS files)
  └── .run-metadata.json    (run configuration)

🌐 Interactive Preview: {base_path}/prototypes/compare.html
  - {style_variants}×{layout_variants} matrix view with synchronized scrolling
  - {IF target_type == "component": "Isolated rendering with minimal wrapper" ELSE: "Full-page layouts"}
  - Side-by-side comparison for design decisions
  - Selection export for implementation

{target_type_icon} Targets Explored: {', '.join(inferred_target_list)}
  Type: {target_type}
  Context: {IF target_type == "page": "Full-page layouts" ELSE IF target_type == "component": "Isolated UI elements" ELSE: "Mixed targets"}

{IF batch-plan:
📋 Implementation Tasks: .workflow/WFS-{session}/.task/
Next: /workflow:execute to begin implementation
}
{ELSE:
Next Steps:
1. Open compare.html to preview all variants
2. Select preferred style×layout combinations per target
3. Run /workflow:plan to create implementation tasks
{IF target_type == "component": "4. Integrate selected components into pages"}
}
```

**Dynamic Values**:
- `target_type_icon`: "📄" for page, "🧩" for component, "🎯" for mixed/auto
- `target_type_label`: "Pages" for page, "Components" for component, "Targets" for mixed/auto
- `target_count`: `len(inferred_target_list)`
- All other placeholders are resolved from stored phase data
