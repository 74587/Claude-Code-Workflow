---
name: explore-auto
description: Exploratory UI design workflow - Generate and compare multiple style × layout combinations for pages OR components (3×3 matrix exploration)
usage: /workflow:ui-design:explore-auto [--prompt "<desc>"] [--images "<glob>"] [--pages "<list>" | --components "<list>"] [--session <id>] [--style-variants <count>] [--layout-variants <count>] [--batch-plan]
argument-hint: "[--prompt \"Modern SaaS with 3 styles\"] [--images \"refs/*.png\"] [--pages \"dashboard,auth\" | --components \"navbar,hero,card\"] [--session WFS-xxx] [--style-variants 3] [--layout-variants 3]"
examples:
  - /workflow:ui-design:explore-auto --prompt "Generate 3 style variants for modern blog: home, article, author"
  - /workflow:ui-design:explore-auto --prompt "SaaS dashboard and settings with 2 layout options"
  - /workflow:ui-design:explore-auto --images "refs/*.png" --prompt "E-commerce: home, product, cart" --style-variants 3 --layout-variants 3
  - /workflow:ui-design:explore-auto --session WFS-auth --images "refs/*.png"
  - /workflow:ui-design:explore-auto --components "navbar,hero" --prompt "Compare 3 navigation bar designs" --style-variants 3 --layout-variants 2
  - /workflow:ui-design:explore-auto --components "card,form" --images "refs/*.png" --style-variants 2 --layout-variants 3
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*), Glob(*), Write(*), Task(conceptual-planning-agent)
---

# UI Design Auto Workflow Command

## Overview & Execution Model

**Fully autonomous orchestrator**: Executes all design phases sequentially from style extraction to design integration, with optional batch planning. Supports two exploration modes:

**Exploration Modes**:
- **Page Mode** (default): Generates `style_variants × layout_variants × pages` full-page prototypes
- **Component Mode**: Generates `style_variants × layout_variants × components` isolated component prototypes

**Autonomous Flow**:
1. User triggers: `/workflow:ui-design:explore-auto [params]`
2. Phase 1 (style-extract) → Auto-continues
3. Phase 2 (style-consolidate) → Auto-continues
4. Phase 3 (ui-generate) → Auto-continues with appropriate mode
5. Phase 4 (design-update) → Auto-continues
6. Phase 5 (batch-plan, optional) → Reports completion

**Auto-Continue Mechanism**: TodoWrite tracks phase status. Upon completion, coordinator constructs next command and executes immediately. No user intervention required.

**Mode Selection**: Determined by `--pages` vs `--components` parameter (mutually exclusive).

## Core Rules

1. **Start Immediately**: TodoWrite initialization → Phase 1 execution
2. **No Preliminary Validation**: Sub-commands handle their own validation
3. **Parse & Pass**: Extract data from each output for next phase
4. **Default to All**: When selecting variants/prototypes, use ALL generated items
5. **Track Progress**: Update TodoWrite after each phase

## Parameter Requirements

**Optional Parameters** (all have smart defaults):
- `--pages "<list>"`: Pages to generate (inferred from prompt/session if omitted) - **Page Mode**
- `--components "<list>"`: Components to generate (inferred from prompt if omitted) - **Component Mode**
- `--session <id>`: Workflow session ID (standalone mode if omitted)
- `--images "<glob>"`: Reference image paths (default: `design-refs/*`)
- `--prompt "<description>"`: Design style and pages/components description
- `--style-variants <count>`: Style variants (default: inferred from prompt or 3, range: 1-5)
- `--layout-variants <count>`: Layout variants per style (default: inferred or 3, range: 1-5)
- `--batch-plan`: Auto-generate implementation tasks after design-update

**Input Rules**:
- Must provide at least one: `--images` or `--prompt`
- Both can be combined for guided analysis
- `--pages` and `--components` are **mutually exclusive**
- Default mode: **Page Mode** if neither specified

**Supported Component Types**:
- **Navigation**: navbar, header, menu, breadcrumb, tabs, sidebar
- **Content**: hero, card, list, table, grid, timeline
- **Input**: form, search, filter, input-group
- **Feedback**: modal, alert, toast, badge, progress
- **Media**: gallery, carousel, video-player, image-card
- **Other**: footer, pagination, dropdown, tooltip, avatar

**Intelligent Prompt Parsing**: Extracts variant counts from natural language:
- "Generate **3 style variants**" → `--style-variants 3`
- "**2 layout options**" → `--layout-variants 2`
- "Create **4 styles** with **2 layouts each**" → `--style-variants 4 --layout-variants 2`
- Explicit flags override prompt inference

## Execution Modes

**Matrix Mode** (default and only):
- Generates `style_variants × layout_variants × pages` prototypes
- **Phase 1**: `style_variants` style options
- **Phase 2**: `style_variants` independent design systems
- **Phase 3**: `style_variants × layout_variants` prototypes per page

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

### Phase 0c: Enhanced Page Inference with Dynamic Analysis
```bash
page_list = []
page_source = "none"

# Priority 1: Explicit --pages parameter
IF --pages provided:
    raw_pages = {--pages value}
    # Split by comma/semicolon/Chinese comma, clean and normalize
    page_list = split_and_clean(raw_pages, delimiters=[",", ";", "、"])
    page_list = [p.strip().lower().replace(" ", "-") for p in page_list if p.strip()]
    page_source = "explicit"
    REPORT: "📋 Using explicitly provided pages: {', '.join(page_list)}"

# Priority 2: Dynamic prompt decomposition (Claude analysis)
ELSE IF --prompt provided:
    REPORT: "🔍 Analyzing prompt to identify pages..."

    # Internal Claude analysis
    analysis_prompt = """
    Analyze the UI design request and identify all distinct pages/screens.

    Request: "{prompt_text}"

    Output JSON:
    {
      "pages": [{"name": "page-name", "purpose": "description", "priority": "high|medium|low"}],
      "shared_components": ["header", "footer"],
      "navigation_structure": {"primary": ["home"], "secondary": ["settings"]}
    }

    Rules:
    - Normalize to URL-friendly (lowercase, hyphens, no spaces)
    - Consolidate synonyms (homepage → home, user-profile → profile)
    - Identify hierarchical relationships
    - Prioritize by user intent
    - Common patterns: home, dashboard, settings, profile, login, signup
    """

    page_structure = analyze_prompt_structure(analysis_prompt, prompt_text)
    page_list = extract_page_names_from_structure(page_structure)
    page_source = "prompt_analysis"

    IF page_list:
        REPORT: "📋 Identified pages from prompt:"
        FOR page IN page_structure.pages:
            REPORT: "   • {page.name}: {page.purpose} [{page.priority}]"
        IF page_structure.shared_components:
            REPORT: "🔧 Shared components: {', '.join(shared_components)}"

# Priority 3: Extract from synthesis-specification.md
ELSE IF --session AND exists(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md):
    synthesis = Read(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md)
    page_list = extract_pages_from_synthesis(synthesis)
    page_source = "synthesis"
    REPORT: "📋 Extracted from synthesis: {', '.join(page_list)}"

# Priority 4: Fallback default
IF NOT page_list:
    page_list = ["home"]
    page_source = "default"
    REPORT: "⚠️ No pages identified, using default: 'home'"

# Validate page names
validated_pages = []
invalid_pages = []
FOR page IN page_list:
    cleaned = page.strip().lower().replace(" ", "-")
    IF regex_match(cleaned, r"^[a-z0-9][a-z0-9_-]*$"):
        validated_pages.append(cleaned)
    ELSE:
        invalid_pages.append(page)

IF invalid_pages:
    REPORT: "⚠️ Skipped invalid: {', '.join(invalid_pages)}"

IF NOT validated_pages:
    validated_pages = ["home"]
    REPORT: "⚠️ All invalid, using default: 'home'"

# Interactive confirmation
REPORT: ""
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "📌 PAGE LIST CONFIRMATION"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "Source: {page_source}"
REPORT: "Pages ({len(validated_pages)}): {', '.join(validated_pages)}"
REPORT: ""
REPORT: "Options:"
REPORT: "  • 'continue/yes' - proceed"
REPORT: "  • 'pages: page1,page2' - replace list"
REPORT: "  • 'skip: page-name' - remove pages"
REPORT: "  • 'add: page-name' - add pages"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

user_input = WAIT_FOR_USER_INPUT()

# Process input
IF user_input MATCHES r"^(continue|yes|ok|proceed)$":
    REPORT: "✅ Proceeding with: {', '.join(validated_pages)}"
ELSE IF user_input MATCHES r"^pages:\s*(.+)$":
    new_pages = split_and_clean(extract_after("pages:"), [",", ";"])
    validated_pages = [p.strip().lower().replace(" ", "-") for p in new_pages if p.strip()]
    REPORT: "✅ Updated: {', '.join(validated_pages)}"
ELSE IF user_input MATCHES r"^skip:\s*(.+)$":
    to_skip = [p.strip().lower() for p in extract_after("skip:").split(",")]
    validated_pages = [p for p in validated_pages if p not in to_skip]
    REPORT: "✅ Removed: {', '.join(to_skip)}, Final: {', '.join(validated_pages)}"
ELSE IF user_input MATCHES r"^add:\s*(.+)$":
    to_add = [p.strip().lower().replace(" ", "-") for p in extract_after("add:").split(",") if p.strip()]
    validated_pages.extend(to_add)
    validated_pages = list(dict.fromkeys(validated_pages))  # Remove duplicates
    REPORT: "✅ Added: {', '.join(to_add)}, Final: {', '.join(validated_pages)}"
ELSE:
    REPORT: "⚠️ Invalid input, proceeding with: {', '.join(validated_pages)}"

IF NOT validated_pages:
    validated_pages = ["home"]

STORE: inferred_page_list = validated_pages
STORE: page_inference_source = page_source
STORE: page_structure_data = page_structure
STORE: exploration_mode = "page"
```

### Phase 0d: Component Inference (Component Mode Only)
```bash
component_list = []
component_source = "none"
exploration_mode = "page"  # Default

# Determine exploration mode
IF --components provided:
    exploration_mode = "component"
    raw_components = {--components value}
    # Split and clean
    component_list = split_and_clean(raw_components, delimiters=[",", ";", "、"])
    component_list = [c.strip().lower().replace(" ", "-") for c in component_list if c.strip()]
    component_source = "explicit"
    REPORT: "🧩 Using explicitly provided components: {', '.join(component_list)}"

# Component inference from prompt (if no --pages and no --components)
ELSE IF --prompt provided AND NOT --pages:
    REPORT: "🔍 Analyzing prompt to identify components..."

    # Internal Claude analysis for components
    analysis_prompt = """
    Analyze the UI design request and identify component-level design elements.

    Request: "{prompt_text}"

    Output JSON:
    {
      "components": [
        {"name": "component-type", "purpose": "description", "variants": ["variant1", "variant2"]}
      ],
      "component_context": "page or section where components appear",
      "interaction_patterns": ["hover", "click", "scroll"]
    }

    Component Categories:
    - Navigation: navbar, header, menu, breadcrumb, tabs, sidebar
    - Content: hero, card, list, table, grid, timeline
    - Input: form, search, filter, input-group
    - Feedback: modal, alert, toast, badge, progress
    - Media: gallery, carousel, video-player, image-card
    - Other: footer, pagination, dropdown, tooltip, avatar

    Rules:
    - Normalize to lowercase with hyphens
    - Be specific (e.g., "navbar" not "navigation")
    - Include interaction context
    """

    component_structure = analyze_prompt_structure(analysis_prompt, prompt_text)

    # Check if prompt is component-focused
    IF component_structure.components AND len(component_structure.components) > 0:
        component_list = extract_component_names_from_structure(component_structure)
        component_source = "prompt_analysis"
        exploration_mode = "component"

        REPORT: "🧩 Identified components from prompt:"
        FOR comp IN component_structure.components:
            REPORT: "   • {comp.name}: {comp.purpose}"
        IF component_structure.interaction_patterns:
            REPORT: "🎯 Interaction patterns: {', '.join(interaction_patterns)}"

# Validate component names
IF exploration_mode == "component":
    validated_components = []
    invalid_components = []
    FOR comp IN component_list:
        cleaned = comp.strip().lower().replace(" ", "-")
        IF regex_match(cleaned, r"^[a-z0-9][a-z0-9_-]*$"):
            validated_components.append(cleaned)
        ELSE:
            invalid_components.append(comp)

    IF invalid_components:
        REPORT: "⚠️ Skipped invalid: {', '.join(invalid_components)}"

    IF NOT validated_components:
        # Fallback to page mode with default page
        exploration_mode = "page"
        inferred_page_list = ["home"]
        REPORT: "⚠️ No valid components, switching to page mode: 'home'"
    ELSE:
        # Interactive confirmation for components
        REPORT: ""
        REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        REPORT: "🧩 COMPONENT LIST CONFIRMATION"
        REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        REPORT: "Mode: Component Exploration"
        REPORT: "Source: {component_source}"
        REPORT: "Components ({len(validated_components)}): {', '.join(validated_components)}"
        REPORT: ""
        REPORT: "Options:"
        REPORT: "  • 'continue/yes' - proceed"
        REPORT: "  • 'components: comp1,comp2' - replace list"
        REPORT: "  • 'skip: comp-name' - remove components"
        REPORT: "  • 'add: comp-name' - add components"
        REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        user_input = WAIT_FOR_USER_INPUT()

        # Process input
        IF user_input MATCHES r"^(continue|yes|ok|proceed)$":
            REPORT: "✅ Proceeding with: {', '.join(validated_components)}"
        ELSE IF user_input MATCHES r"^components:\s*(.+)$":
            new_comps = split_and_clean(extract_after("components:"), [",", ";"])
            validated_components = [c.strip().lower().replace(" ", "-") for c in new_comps if c.strip()]
            REPORT: "✅ Updated: {', '.join(validated_components)}"
        ELSE IF user_input MATCHES r"^skip:\s*(.+)$":
            to_skip = [c.strip().lower() for c in extract_after("skip:").split(",")]
            validated_components = [c for c in validated_components if c not in to_skip]
            REPORT: "✅ Removed: {', '.join(to_skip)}, Final: {', '.join(validated_components)}"
        ELSE IF user_input MATCHES r"^add:\s*(.+)$":
            to_add = [c.strip().lower().replace(" ", "-") for c in extract_after("add:").split(",") if c.strip()]
            validated_components.extend(to_add)
            validated_components = list(dict.fromkeys(validated_components))  # Remove duplicates
            REPORT: "✅ Added: {', '.join(to_add)}, Final: {', '.join(validated_components)}"
        ELSE:
            REPORT: "⚠️ Invalid input, proceeding with: {', '.join(validated_components)}"

        IF NOT validated_components:
            # Fallback to page mode
            exploration_mode = "page"
            inferred_page_list = ["home"]
            REPORT: "⚠️ No components, switching to page mode: 'home'"

STORE: inferred_component_list = validated_components IF exploration_mode == "component" ELSE []
STORE: component_inference_source = component_source
STORE: component_structure_data = component_structure IF exploration_mode == "component" ELSE {}
STORE: exploration_mode = exploration_mode  # "page" or "component"
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

### Phase 3: Matrix UI Generation (Mode-Aware)
**Command**:
```bash
run_base_flag = "--base-path \"{base_path}\""

IF exploration_mode == "page":
    # Page Mode: Generate full pages
    pages_string = ",".join(inferred_page_list)
    VERIFY: pages_string matches r"^[a-z0-9_-]+(,[a-z0-9_-]+)*$"

    pages_flag = "--pages \"{pages_string}\""
    command = "/workflow:ui-design:generate {run_base_flag} {pages_flag} --style-variants {style_variants} --layout-variants {layout_variants}"

    total_prototypes = style_variants * layout_variants * len(inferred_page_list)
    REPORT: "🚀 Phase 3: Matrix UI Generation (Page Mode)"
    REPORT: "   Pages: {pages_string}"
    REPORT: "   Matrix: {style_variants}×{layout_variants}"
    REPORT: "   Total: {total_prototypes} full-page prototypes"

ELSE IF exploration_mode == "component":
    # Component Mode: Generate isolated components
    components_string = ",".join(inferred_component_list)
    VERIFY: components_string matches r"^[a-z0-9_-]+(,[a-z0-9_-]+)*$"

    components_flag = "--components \"{components_string}\""
    command = "/workflow:ui-design:generate {run_base_flag} {components_flag} --style-variants {style_variants} --layout-variants {layout_variants}"

    total_prototypes = style_variants * layout_variants * len(inferred_component_list)
    REPORT: "🚀 Phase 3: Matrix UI Generation (Component Mode)"
    REPORT: "   Components: {components_string}"
    REPORT: "   Matrix: {style_variants}×{layout_variants}"
    REPORT: "   Total: {total_prototypes} component prototypes"
    REPORT: "   Context: Components displayed in minimal page wrapper"

SlashCommand(command)
```

**Result**:
- **Page Mode**: `{page}-style-{s}-layout-{l}.html`
- **Component Mode**: `{component}-style-{s}-layout-{l}.html`
- Total: `style_variants × layout_variants × (pages|components)`
- Matrix view: `compare.html` with interactive grid
- Component isolation: Minimal wrapper for focus on component design

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
FOR page IN inferred_page_list:
    SlashCommand("/workflow:plan --agent \"Implement {page} page based on design system\"")
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

# Mode: Page
# Inferred: 3 style variants, 3 layout variants (default)
# Pages: home, article, author
# Total: 27 full-page prototypes (3×3×3)
```

### Example 2: Custom 2×2 Matrix with Session (Page Mode)
```bash
/workflow:ui-design:explore-auto --session WFS-ecommerce --images "refs/*.png" --style-variants 2 --layout-variants 2

# Mode: Page
# Executes with session integration
# Total: 2×2×N prototypes (N from inference)
```

### Example 3: Component Mode - Navbar Design Comparison
```bash
/workflow:ui-design:explore-auto --components "navbar,hero" --prompt "Compare 3 navigation bar designs for SaaS product" --style-variants 3 --layout-variants 2

# Mode: Component
# Components: navbar, hero
# Matrix: 3 styles × 2 layouts
# Total: 12 component prototypes (3×2×2)
# Output: navbar-style-1-layout-1.html, navbar-style-1-layout-2.html, ...
```

### Example 4: Component Mode - Card & Form Exploration
```bash
/workflow:ui-design:explore-auto --components "card,form,button" --images "refs/*.png" --style-variants 2 --layout-variants 3

# Mode: Component
# Components: card, form, button
# Matrix: 2 styles × 3 layouts
# Total: 18 component prototypes (2×3×3)
# Context: Each component in minimal wrapper for isolated comparison
```

### Example 5: Intelligent Parsing + Batch Planning (Page Mode)
```bash
/workflow:ui-design:explore-auto --session WFS-saas --prompt "Create 4 styles with 2 layouts for SaaS dashboard and settings" --batch-plan

# Mode: Page
# Parsed: 4 styles, 2 layouts
# Pages: dashboard, settings
# Total: 16 full-page prototypes (4×2×2)
# Auto-generates implementation tasks for each page
```

### Example 6: Component Mode - Prompt-Inferred Components
```bash
/workflow:ui-design:explore-auto --prompt "Design exploration for pricing table and testimonial card components" --style-variants 3 --layout-variants 2

# Mode: Component (auto-detected from prompt)
# Inferred components: pricing-table, testimonial-card
# Matrix: 3 styles × 2 layouts
# Total: 12 component prototypes (3×2×2)
```

## Final Completion Message

**Page Mode**:
```
✅ UI Design Explore-Auto Workflow Complete! (Page Mode)

Run ID: {run_id}
Session: {session_id or "standalone"}
Mode: Full-Page Exploration
Matrix: {style_variants}×{layout_variants} ({total_prototypes} total prototypes)
Input: {images and/or prompt summary}

Phase 1 - Style Extraction: {style_variants} style variants
Phase 2 - Style Consolidation: {style_variants} independent design systems
Phase 3 - Matrix Generation: {style_variants}×{layout_variants}×{pages_count} = {total_prototypes} page prototypes
Phase 4 - Design Update: Brainstorming artifacts updated
{IF batch-plan: Phase 5 - Task Generation: {task_count} implementation tasks created}

📂 Run Output: {base_path}/
  ├── style-consolidation/  ({style_variants} design systems)
  ├── prototypes/           ({total_prototypes} HTML/CSS files)
  └── .run-metadata.json    (run configuration)

🌐 Interactive Preview: {base_path}/prototypes/compare.html
  - {style_variants}×{layout_variants} matrix view with synchronized scrolling
  - Zoom controls and fullscreen mode
  - Selection export for implementation

📄 Pages Explored: {', '.join(inferred_page_list)}

{IF batch-plan:
📋 Implementation Tasks: .workflow/WFS-{session}/.task/
Next: /workflow:execute to begin implementation
}
{ELSE:
Next Steps:
1. Open compare.html to preview all page variants
2. Select preferred style×layout combinations per page
3. Run /workflow:plan to create implementation tasks
}
```

**Component Mode**:
```
✅ UI Design Explore-Auto Workflow Complete! (Component Mode)

Run ID: {run_id}
Session: {session_id or "standalone"}
Mode: Component Exploration
Matrix: {style_variants}×{layout_variants} ({total_prototypes} total component prototypes)
Input: {images and/or prompt summary}

Phase 1 - Style Extraction: {style_variants} style variants
Phase 2 - Style Consolidation: {style_variants} independent design systems
Phase 3 - Matrix Generation: {style_variants}×{layout_variants}×{component_count} = {total_prototypes} component prototypes
Phase 4 - Design Update: Brainstorming artifacts updated

📂 Run Output: {base_path}/
  ├── style-consolidation/  ({style_variants} design systems)
  ├── prototypes/           ({total_prototypes} component HTML/CSS files)
  └── .run-metadata.json    (run configuration)

🌐 Interactive Preview: {base_path}/prototypes/compare.html
  - {style_variants}×{layout_variants} component matrix view
  - Isolated component rendering (minimal wrapper)
  - Side-by-side comparison for design decisions
  - Selection export for implementation

🧩 Components Explored: {', '.join(inferred_component_list)}

Next Steps:
1. Open compare.html to preview all component variants
2. Select preferred style×layout combinations per component
3. Extract selected components for integration into pages
4. Run /workflow:plan with component integration context
```
