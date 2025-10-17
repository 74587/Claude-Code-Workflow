---
name: explore-auto
description: Exploratory UI design workflow with style-centric batch generation
argument-hint: "[--prompt "<desc>"] [--images "<glob>"] [--targets "<list>"] [--target-type "page|component"] [--session <id>] [--style-variants <count>] [--layout-variants <count>] [--batch-plan]""
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
2. Phase 0c: Target confirmation → User confirms → **IMMEDIATELY triggers Phase 1**
3. Phase 1 (style-extract) → **WAIT for completion** → Auto-continues
4. Phase 2.3 (animation-extract, optional) → **WAIT for completion** → Auto-continues
5. Phase 2.5 (layout-extract) → **WAIT for completion** → Auto-continues
6. **Phase 3 (ui-assembly)** → **WAIT for completion** → Auto-continues
7. Phase 4 (design-update) → **WAIT for completion** → Auto-continues
8. Phase 5 (batch-plan, optional) → Reports completion

**Phase Transition Mechanism**:
- **Phase 0c (User Interaction)**: User confirms targets → IMMEDIATELY triggers Phase 1
- **Phase 1-5 (Autonomous)**: `SlashCommand` is BLOCKING - execution pauses until completion
- Upon each phase completion: Automatically process output and execute next phase
- No additional user interaction after Phase 0c confirmation

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
- `--device-type "desktop|mobile|tablet|responsive|auto"`: Device type for layout optimization (default: `auto` - intelligent detection)
  - **Desktop**: 1920×1080px - Mouse-driven, spacious layouts
  - **Mobile**: 375×812px - Touch-friendly, compact layouts
  - **Tablet**: 768×1024px - Hybrid touch/mouse layouts
  - **Responsive**: 1920×1080px base with mobile-first breakpoints
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

**Matrix Mode** (style-centric):
- Generates `style_variants × layout_variants × targets` prototypes
- **Phase 1**: `style_variants` complete design systems (extract)
- **Phase 2**: Layout templates extraction (layout-extract)
- **Phase 3**: Style-centric batch generation (generate)
  - Sub-phase 1: `targets × layout_variants` target-specific layout plans
  - **Sub-phase 2**: `S` style-centric agents (each handles `L×T` combinations)
  - Sub-phase 3: `style_variants × layout_variants × targets` final prototypes
  - Performance: Efficient parallel execution with S agents
  - Quality: HTML structure adapts to design_attributes
  - Pages: Full-page layouts with complete structure
  - Components: Isolated elements with minimal wrapper

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

### Phase 0a-2: Device Type Inference
```bash
# Device type inference
device_type = "auto"

# Step 1: Explicit parameter (highest priority)
IF --device-type AND --device-type != "auto":
    device_type = --device-type
    device_source = "explicit"
ELSE:
    # Step 2: Prompt analysis
    IF --prompt:
        device_keywords = {
            "desktop": ["desktop", "web", "laptop", "widescreen", "large screen"],
            "mobile": ["mobile", "phone", "smartphone", "ios", "android"],
            "tablet": ["tablet", "ipad", "medium screen"],
            "responsive": ["responsive", "adaptive", "multi-device", "cross-platform"]
        }
        detected_device = detect_device_from_prompt(--prompt, device_keywords)
        IF detected_device:
            device_type = detected_device
            device_source = "prompt_inference"

    # Step 3: Target type inference
    IF device_type == "auto":
        # Components are typically desktop-first, pages can vary
        device_type = target_type == "component" ? "desktop" : "responsive"
        device_source = "target_type_inference"

STORE: device_type, device_source
```

**Device Type Presets**:
- **Desktop**: 1920×1080px - Mouse-driven, spacious layouts
- **Mobile**: 375×812px - Touch-friendly, compact layouts
- **Tablet**: 768×1024px - Hybrid touch/mouse layouts
- **Responsive**: 1920×1080px base with mobile-first breakpoints

**Detection Keywords**:
- Prompt contains "mobile", "phone", "smartphone" → mobile
- Prompt contains "tablet", "ipad" → tablet
- Prompt contains "desktop", "web", "laptop" → desktop
- Prompt contains "responsive", "adaptive" → responsive
- Otherwise: Inferred from target type (components→desktop, pages→responsive)

### Phase 0b: Run Initialization & Directory Setup
```bash
run_id = "run-$(date +%Y%m%d-%H%M%S)"
base_path = --session ? ".workflow/WFS-{session}/design-${run_id}" : ".workflow/.design/${run_id}"

Bash(mkdir -p "${base_path}/{style-extraction,style-consolidation,prototypes}")

Write({base_path}/.run-metadata.json): {
  "run_id": "${run_id}", "session_id": "${session_id}", "timestamp": "...",
  "workflow": "ui-design:auto",
  "architecture": "style-centric-batch-generation",
  "parameters": { "style_variants": ${style_variants}, "layout_variants": ${layout_variants},
                  "targets": "${inferred_target_list}", "target_type": "${target_type}",
                  "prompt": "${prompt_text}", "images": "${images_pattern}",
                  "device_type": "${device_type}", "device_source": "${device_source}" },
  "status": "in_progress",
  "performance_mode": "optimized"
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
DISPLAY_CONFIRMATION(target_type, target_source, validated_targets, device_type, device_source):
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  "{emoji} {LABEL} CONFIRMATION (Style-Centric)"
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  "Type: {target_type} | Source: {target_source}"
  "Targets ({count}): {', '.join(validated_targets)}"
  "Device: {device_type} | Source: {device_source}"
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  "Performance: {style_variants} agent calls"
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  "Modification Options:"
  "  • 'continue/yes/ok' - Proceed with current configuration"
  "  • 'targets: a,b,c' - Replace target list"
  "  • 'skip: x,y' - Remove specific targets"
  "  • 'add: z' - Add new targets"
  "  • 'type: page|component' - Change target type"
  "  • 'device: desktop|mobile|tablet|responsive' - Change device type"
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

user_input = WAIT_FOR_USER_INPUT()

# Process user modifications
MATCH user_input:
  "continue|yes|ok" → proceed
  "targets: ..." → validated_targets = parse_new_list()
  "skip: ..." → validated_targets = remove_items()
  "add: ..." → validated_targets = add_items()
  "type: ..." → target_type = extract_type()
  "device: ..." → device_type = extract_device()
  default → proceed with current list

STORE: inferred_target_list, target_type, target_inference_source

# ⚠️ CRITICAL: User confirmation complete, IMMEDIATELY initialize TodoWrite and execute Phase 1
# This is the only user interaction point in the workflow
# After this point, all subsequent phases execute automatically without user intervention
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
command = "/workflow:ui-design:style-extract --base-path \"{base_path}\" " +
          (--images ? "--images \"{images}\" " : "") +
          (--prompt ? "--prompt \"{prompt}\" " : "") +
          "--mode explore --variants {style_variants}"
SlashCommand(command)

# Output: {style_variants} style cards with design_attributes
# SlashCommand blocks until phase complete
# Upon completion, IMMEDIATELY execute Phase 2.3 (auto-continue)
```

### Phase 2.3: Animation Extraction (Optional - Interactive Mode)
```bash
# Animation extraction for motion design patterns
REPORT: "🚀 Phase 2.3: Animation Extraction (interactive mode)"
REPORT: "   → Mode: Interactive specification"
REPORT: "   → Purpose: Define motion design patterns"

command = "/workflow:ui-design:animation-extract --base-path \"{base_path}\" --mode interactive"

SlashCommand(command)

# Output: animation-tokens.json + animation-guide.md
# SlashCommand blocks until phase complete
# Upon completion, IMMEDIATELY execute Phase 2.5 (auto-continue)
```

### Phase 2.5: Layout Extraction
```bash
targets_string = ",".join(inferred_target_list)
command = "/workflow:ui-design:layout-extract --base-path \"{base_path}\" " +
          (--images ? "--images \"{images}\" " : "") +
          (--prompt ? "--prompt \"{prompt}\" " : "") +
          "--targets \"{targets_string}\" " +
          "--mode explore --variants {layout_variants} " +
          "--device-type \"{device_type}\""

REPORT: "🚀 Phase 2.5: Layout Extraction (explore mode)"
REPORT: "   → Targets: {targets_string}"
REPORT: "   → Layout variants: {layout_variants}"
REPORT: "   → Device: {device_type}"

SlashCommand(command)

# Output: layout-templates.json with {targets × layout_variants} layout structures
# SlashCommand blocks until phase complete
# Upon completion, IMMEDIATELY execute Phase 3 (auto-continue)
```

### Phase 3: UI Assembly
```bash
command = "/workflow:ui-design:generate --base-path \"{base_path}\" " +
          "--style-variants {style_variants} --layout-variants {layout_variants}"

total = style_variants × layout_variants × len(inferred_target_list)

REPORT: "🚀 Phase 3: UI Assembly | Matrix: {s}×{l}×{n} = {total} prototypes"
REPORT: "   → Pure assembly: Combining layout templates + design tokens"
REPORT: "   → Device: {device_type} (from layout templates)"
REPORT: "   → Assembly tasks: {total} combinations"

SlashCommand(command)

# SlashCommand blocks until phase complete
# Upon completion, IMMEDIATELY execute Phase 4 (auto-continue)
# Output:
# - {target}-style-{s}-layout-{l}.html (assembled prototypes)
# - {target}-style-{s}-layout-{l}.css
# - compare.html (interactive matrix view)
# - PREVIEW.md (usage instructions)
```

### Phase 4: Design System Integration
```bash
command = "/workflow:ui-design:update" + (--session ? " --session {session_id}" : "")
SlashCommand(command)

# SlashCommand blocks until phase complete
# Upon completion:
#   - If --batch-plan flag present: IMMEDIATELY execute Phase 5 (auto-continue)
#   - If no --batch-plan: Workflow complete, display final report
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
// Initialize IMMEDIATELY after Phase 0c user confirmation to track multi-phase execution
TodoWrite({todos: [
  {"content": "Execute style extraction", "status": "in_progress", "activeForm": "Executing..."},
  {"content": "Execute layout extraction", "status": "pending", "activeForm": "Executing..."},
  {"content": "Execute UI assembly", "status": "pending", "activeForm": "Executing..."},
  {"content": "Execute design integration", "status": "pending", "activeForm": "Executing..."}
]})

// ⚠️ CRITICAL: After EACH SlashCommand completion (Phase 1-5), you MUST:
// 1. SlashCommand blocks and returns when phase is complete
// 2. Update current phase: status → "completed"
// 3. Update next phase: status → "in_progress"
// 4. IMMEDIATELY execute next phase SlashCommand (auto-continue)
// This ensures continuous workflow tracking and prevents premature stopping
```

## Key Features

- **🚀 Performance**: Style-centric batch generation with S agent calls
- **🎨 Style-Aware**: HTML structure adapts to design_attributes
- **✅ Perfect Consistency**: Each style by single agent
- **📦 Autonomous**: No user intervention required between phases
- **🧠 Intelligent**: Parses natural language, infers targets/types
- **🔄 Reproducible**: Deterministic flow with isolated run directories
- **🎯 Flexible**: Supports pages, components, or mixed targets

## Examples

### 1. Page Mode (Prompt Inference)
```bash
/workflow:ui-design:explore-auto --prompt "Modern blog: home, article, author"
# Result: 27 prototypes (3×3×3) - responsive layouts (default)
```

### 2. Mobile-First Design
```bash
/workflow:ui-design:explore-auto --prompt "Mobile shopping app: home, product, cart" --device-type mobile
# Result: 27 prototypes (3×3×3) - mobile layouts (375×812px)
```

### 3. Desktop Application
```bash
/workflow:ui-design:explore-auto --targets "dashboard,analytics,settings" --device-type desktop --style-variants 2 --layout-variants 2
# Result: 12 prototypes (2×2×3) - desktop layouts (1920×1080px)
```

### 4. Tablet Interface
```bash
/workflow:ui-design:explore-auto --prompt "Educational app for tablets" --device-type tablet --targets "courses,lessons,profile"
# Result: 27 prototypes (3×3×3) - tablet layouts (768×1024px)
```

### 5. Custom Matrix with Session
```bash
/workflow:ui-design:explore-auto --session WFS-ecommerce --images "refs/*.png" --style-variants 2 --layout-variants 2
# Result: 2×2×N prototypes - device type inferred from session
```

### 6. Component Mode (Desktop)
```bash
/workflow:ui-design:explore-auto --targets "navbar,hero" --target-type "component" --device-type desktop --style-variants 3 --layout-variants 2
# Result: 12 prototypes (3×2×2) - desktop components
```

### 7. Intelligent Parsing + Batch Planning
```bash
/workflow:ui-design:explore-auto --prompt "Create 4 styles with 2 layouts for mobile dashboard and settings" --batch-plan
# Result: 16 prototypes (4×2×2) + auto-generated tasks - mobile-optimized (inferred from prompt)
```

### 8. Large Scale Responsive
```bash
/workflow:ui-design:explore-auto --targets "home,dashboard,settings,profile" --device-type responsive --style-variants 3 --layout-variants 3
# Result: 36 prototypes (3×3×4) - responsive layouts
```

## Completion Output
```
✅ UI Design Explore-Auto Workflow Complete!

Architecture: Style-Centric Batch Generation
Run ID: {run_id} | Session: {session_id or "standalone"}
Type: {icon} {target_type} | Device: {device_type} | Matrix: {s}×{l}×{n} = {total} prototypes

Phase 1: {s} complete design systems (style-extract)
Phase 2: {n×l} layout templates (layout-extract explore mode)
  - Device: {device_type} layouts
  - {n} targets × {l} layout variants = {n×l} structural templates
Phase 3: UI Assembly (generate)
  - Pure assembly: layout templates + design tokens
  - {s}×{l}×{n} = {total} final prototypes
Phase 4: Brainstorming artifacts updated
[Phase 5: {n} implementation tasks created]  # if --batch-plan

Assembly Process:
✅ Separation of Concerns: Layout (structure) + Style (tokens) kept separate
✅ Layout Extraction: {n×l} reusable structural templates
✅ Pure Assembly: No design decisions in generate phase
✅ Device-Optimized: Layouts designed for {device_type}

Design Quality:
✅ Token-Driven Styling: 100% var() usage
✅ Structural Variety: {l} distinct layouts per target
✅ Style Variety: {s} independent design systems
✅ Device-Optimized: Layouts designed for {device_type}

📂 {base_path}/
  ├── .intermediates/          (Intermediate analysis files)
  │   ├── style-analysis/      (computed-styles.json, design-space-analysis.json)
  │   └── layout-analysis/     (dom-structure-*.json, inspirations/*.txt)
  ├── style-extraction/        ({s} complete design systems)
  ├── layout-extraction/       ({n×l} layout templates + layout-space-analysis.json)
  ├── prototypes/              ({total} assembled prototypes)
  └── .run-metadata.json       (includes device type)

🌐 Preview: {base_path}/prototypes/compare.html
  - Interactive {s}×{l} matrix view
  - Side-by-side comparison
  - Target-specific layouts with style-aware structure
  - Toggle between {n} targets

{icon} Targets: {', '.join(targets)} (type: {target_type})
  - Each target has {l} custom-designed layouts
  - Each style × target × layout has unique HTML structure (not just CSS!)
  - Layout plans stored as structured JSON
  - Optimized for {device_type} viewing

Next: [/workflow:execute] OR [Open compare.html → Select → /workflow:plan]
```

