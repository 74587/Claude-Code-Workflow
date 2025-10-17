---
name: imitate-auto
description: High-speed multi-page UI replication with batch screenshot capture
argument-hint: --url-map "<map>" [--capture-mode <batch|deep>] [--depth <1-5>] [--session <id>] [--prompt "<desc>"]
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Write(*), Bash(*)
---

# UI Design Imitate-Auto Workflow Command

## Overview & Execution Model

**Fully autonomous replication orchestrator**: Efficiently replicate multiple web pages through sequential execution from screenshot capture to design integration.

**Dual Capture Strategy**: Supports two capture modes for different use cases:
- **Batch Mode** (default): Fast multi-URL screenshot capture via `/workflow:ui-design:capture`
- **Deep Mode**: Interactive layer exploration for single URL via `/workflow:ui-design:explore-layers`

**Autonomous Flow** (⚠️ CONTINUOUS EXECUTION - DO NOT STOP):
1. User triggers: `/workflow:ui-design:imitate-auto --url-map "..."`
2. Phase 0: Initialize and parse parameters
3. Phase 1: Screenshot capture (batch or deep mode) → **WAIT for completion** → Auto-continues
4. Phase 2: Style extraction (complete design systems) → **WAIT for completion** → Auto-continues
5. Phase 2.3: Animation extraction (CSS auto mode) → **WAIT for completion** → Auto-continues
6. Phase 2.5: Layout extraction (structure templates) → **WAIT for completion** → Auto-continues
7. Phase 3: Batch UI assembly → **WAIT for completion** → Auto-continues
8. Phase 4: Design system integration → Reports completion

**Phase Transition Mechanism**:
- `SlashCommand` is BLOCKING - execution pauses until completion
- Upon each phase completion: Automatically process output and execute next phase
- No user interaction required after initial parameter parsing

**Auto-Continue Mechanism**: TodoWrite tracks phase status. Upon each phase completion, you MUST immediately construct and execute the next phase command. No user intervention required. The workflow is NOT complete until reaching Phase 5.

## Core Rules

1. **Start Immediately**: TodoWrite initialization → Phase 1 execution
2. **No Preliminary Validation**: Sub-commands handle their own validation
3. **Parse & Pass**: Extract data from each output for next phase
4. **Track Progress**: Update TodoWrite after each phase
5. **⚠️ CRITICAL: DO NOT STOP** - This is a continuous multi-phase workflow. After each SlashCommand completes, you MUST wait for completion, then immediately execute the next phase. Workflow is NOT complete until Phase 5.

## Parameter Requirements

**Required Parameters**:
- `--url-map "<map>"`: Target page mapping
  - Format: `"target1:url1, target2:url2, ..."`
  - Example: `"home:https://linear.app, pricing:https://linear.app/pricing"`
  - First target serves as primary style source

**Optional Parameters**:
- `--capture-mode <batch|deep>` (Optional, default: batch): Screenshot capture strategy
  - `batch` (default): Multi-URL fast batch capture via `/workflow:ui-design:capture`
  - `deep`: Single-URL interactive depth exploration via `/workflow:ui-design:explore-layers`
  - **Note**: `deep` mode only uses first URL from url-map

- `--depth <1-5>` (Optional, default: 3): Capture depth for deep mode
  - `1`: Page level (full-page screenshot)
  - `2`: Element level (+ key components)
  - `3`: Interaction level (+ modals, dropdowns)
  - `4`: Embedded level (+ iframes)
  - `5`: Shadow DOM (+ web components)
  - **Only applies when** `--capture-mode deep`

- `--session <id>` (Optional): Workflow session ID
  - Integrate into existing session (`.workflow/WFS-{session}/`)
  - Enable automatic design system integration (Phase 5)
  - If not provided: standalone mode (`.workflow/.design/`)

- `--prompt "<desc>"` (Optional): Style extraction guidance
  - Influences extract command analysis focus
  - Example: `"Focus on dark mode"`, `"Emphasize minimalist design"`
  - **Note**: Design systems are now production-ready by default (no separate consolidate step)

## Execution Modes

**Capture Modes**:
- **Batch Mode** (default): Multi-URL screenshot capture for fast replication
  - Uses `/workflow:ui-design:capture` for parallel screenshot capture
  - Optimized for replicating multiple pages efficiently
- **Deep Mode**: Single-URL layer exploration for detailed analysis
  - Uses `/workflow:ui-design:explore-layers` for interactive depth traversal
  - Captures page layers at different depths (1-5)
  - Only processes first URL from url-map

**Token Processing**:
- **Direct Generation**: Complete design systems generated in style-extract phase
  - Production-ready design-tokens.json with WCAG compliance
  - Complete style-guide.md documentation
  - No separate consolidation step required (~30-60s faster)

**Session Integration**:
- `--session` flag determines session integration or standalone execution
- Integrated: Design system automatically added to session artifacts
- Standalone: Output in `.workflow/.design/{run_id}/`

## 6-Phase Execution

### Phase 0: Initialization and Target Parsing

```bash
# Generate run ID
run_id = "run-$(date +%Y%m%d-%H%M%S)"

# Determine base path and session mode
IF --session:
    session_id = {provided_session}
    base_path = ".workflow/WFS-{session_id}/design-{run_id}"
    session_mode = "integrated"
ELSE:
    session_id = null
    base_path = ".workflow/.design/{run_id}"
    session_mode = "standalone"

# Create base directory
Bash(mkdir -p "{base_path}")

# Parse url-map
url_map_string = {--url-map}
VALIDATE: url_map_string is not empty, "--url-map parameter is required"

# Parse target:url pairs
url_map = {}  # {target_name: url}
target_names = []

FOR pair IN split(url_map_string, ","):
    pair = pair.strip()

    IF ":" NOT IN pair:
        ERROR: "Invalid url-map format: '{pair}'"
        ERROR: "Expected format: 'target:url'"
        ERROR: "Example: 'home:https://example.com, pricing:https://example.com/pricing'"
        EXIT 1

    target, url = pair.split(":", 1)
    target = target.strip().lower().replace(" ", "-")
    url = url.strip()

    url_map[target] = url
    target_names.append(target)

VALIDATE: len(target_names) > 0, "url-map must contain at least one target:url pair"

primary_target = target_names[0]  # First target as primary style source

# Parse capture mode
capture_mode = --capture-mode OR "batch"
depth = int(--depth OR 3)

# Validate capture mode
IF capture_mode NOT IN ["batch", "deep"]:
    ERROR: "Invalid --capture-mode: {capture_mode}"
    ERROR: "Valid options: batch, deep"
    EXIT 1

# Validate depth (only for deep mode)
IF capture_mode == "deep":
    IF depth NOT IN [1, 2, 3, 4, 5]:
        ERROR: "Invalid --depth: {depth}"
        ERROR: "Valid range: 1-5"
        EXIT 1

    # Warn if multiple URLs in deep mode
    IF len(target_names) > 1:
        WARN: "⚠️ Deep mode only uses first URL: '{primary_target}'"
        WARN: "   Other URLs will be ignored: {', '.join(target_names[1:])}"
        WARN: "   For multi-URL, use --capture-mode batch"

# Write metadata
metadata = {
    "workflow": "imitate-auto",
    "run_id": run_id,
    "session_id": session_id,
    "timestamp": current_timestamp(),
    "parameters": {
        "url_map": url_map,
        "capture_mode": capture_mode,
        "depth": depth IF capture_mode == "deep" ELSE null,
        "prompt": --prompt OR null
    },
    "targets": target_names,
    "status": "in_progress"
}

Write("{base_path}/.run-metadata.json", JSON.stringify(metadata, null, 2))

# Initialize TodoWrite
TodoWrite({todos: [
  {content: "Initialize and parse url-map", status: "completed", activeForm: "Initializing"},
  {content: capture_mode == "batch" ? f"Batch screenshot capture ({len(target_names)} targets)" : f"Deep exploration (depth {depth})", status: "pending", activeForm: "Capturing screenshots"},
  {content: "Extract style (complete design systems)", status: "pending", activeForm: "Extracting style"},
  {content: "Extract animation (CSS auto mode)", status: "pending", activeForm: "Extracting animation"},
  {content: "Extract layout (structure templates)", status: "pending", activeForm: "Extracting layout"},
  {content: f"Assemble UI for {len(target_names)} targets", status: "pending", activeForm: "Assembling UI"},
  {content: session_id ? "Integrate design system" : "Standalone completion", status: "pending", activeForm: "Completing"}
]})
```

### Phase 1: Screenshot Capture (Dual Mode)

```bash
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "🚀 Phase 1: Screenshot Capture"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

IF capture_mode == "batch":
    # Mode A: Batch Multi-URL Capture
    url_map_command_string = ",".join([f"{name}:{url}" for name, url in url_map.items()])
    capture_command = f"/workflow:ui-design:capture --base-path \"{base_path}\" --url-map \"{url_map_command_string}\""

    TRY:
        SlashCommand(capture_command)
    CATCH error:
        ERROR: "Batch capture failed: {error}"
        ERROR: "Cannot proceed without screenshots"
        EXIT 1

    # Verify batch capture results
    screenshot_metadata_path = "{base_path}/screenshots/capture-metadata.json"

    IF NOT exists(screenshot_metadata_path):
        ERROR: "capture command did not generate metadata file"
        ERROR: "Expected: {screenshot_metadata_path}"
        EXIT 1

    screenshot_metadata = Read(screenshot_metadata_path)
    captured_count = screenshot_metadata.total_captured
    total_requested = screenshot_metadata.total_requested
    missing_count = total_requested - captured_count

    IF missing_count > 0:
        missing_targets = [s.target for s in screenshot_metadata.screenshots if not s.captured]
        WARN: "⚠️ Missing {missing_count} screenshots: {', '.join(missing_targets)}"

    IF captured_count == 0:
        ERROR: "No screenshots captured - cannot proceed"
        EXIT 1

ELSE:  # capture_mode == "deep"
    # Mode B: Deep Interactive Layer Exploration
    primary_url = url_map[primary_target]
    explore_command = f"/workflow:ui-design:explore-layers --url \"{primary_url}\" --depth {depth} --base-path \"{base_path}\""

    TRY:
        SlashCommand(explore_command)
    CATCH error:
        ERROR: "Deep exploration failed: {error}"
        ERROR: "Cannot proceed without screenshots"
        EXIT 1

    # Verify deep exploration results
    layer_map_path = "{base_path}/screenshots/layer-map.json"

    IF NOT exists(layer_map_path):
        ERROR: "explore-layers did not generate layer-map.json"
        ERROR: "Expected: {layer_map_path}"
        EXIT 1

    layer_map = Read(layer_map_path)
    captured_count = layer_map.summary.total_captures
    total_requested = captured_count  # For consistency with batch mode

TodoWrite(mark_completed: f"Batch screenshot capture ({len(target_names)} targets)" IF capture_mode == "batch" ELSE f"Deep exploration (depth {depth})",
          mark_in_progress: "Extract style (visual tokens)")
```

### Phase 2: Style Extraction (Visual Tokens)

```bash
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "🚀 Phase 2: Style Extraction"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Use all screenshots as input to extract single design system
IF capture_mode == "batch":
    images_glob = f"{base_path}/screenshots/*.{{png,jpg,jpeg,webp}}"
ELSE:  # deep mode
    images_glob = f"{base_path}/screenshots/**/*.{{png,jpg,jpeg,webp}}"

# Build extraction prompt
IF --prompt:
    user_guidance = {--prompt}
    extraction_prompt = f"Extract visual style tokens from '{primary_target}'. User guidance: {user_guidance}"
ELSE:
    extraction_prompt = f"Extract visual style tokens from '{primary_target}' with consistency across all pages."

# Build url-map string for style-extract (enables computed styles extraction)
url_map_for_extract = ",".join([f"{name}:{url}" for name, url in url_map.items()])

# Call style-extract command (imitate mode, automatically uses single variant)
# Pass --urls to enable auto-trigger of computed styles extraction
extract_command = f"/workflow:ui-design:style-extract --base-path \"{base_path}\" --images \"{images_glob}\" --urls \"{url_map_for_extract}\" --prompt \"{extraction_prompt}\" --mode imitate"

TRY:
    SlashCommand(extract_command)
CATCH error:
    ERROR: "Style extraction failed: {error}"
    ERROR: "Cannot proceed without visual tokens"
    EXIT 1

# Verify extraction results
design_tokens_path = "{base_path}/style-extraction/style-1/design-tokens.json"
style_guide_path = "{base_path}/style-extraction/style-1/style-guide.md"

IF NOT exists(design_tokens_path) OR NOT exists(style_guide_path):
    ERROR: "style-extract did not generate required files"
    EXIT 1

TodoWrite(mark_completed: "Extract style (complete design systems)",
          mark_in_progress: "Extract animation (CSS auto mode)")
```

### Phase 2.3: Animation Extraction (CSS Auto Mode)

```bash
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "🚀 Phase 2.3: Animation Extraction"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Build URL list for animation-extract (auto mode for CSS extraction)
url_map_for_animation = ",".join([f"{target}:{url}" for target, url in url_map.items()])

# Call animation-extract command (auto mode for CSS animation extraction)
# Pass --urls to auto-trigger CSS animation/transition extraction via Chrome DevTools
animation_extract_command = f"/workflow:ui-design:animation-extract --base-path \"{base_path}\" --urls \"{url_map_for_animation}\" --mode auto"

TRY:
    SlashCommand(animation_extract_command)
CATCH error:
    ERROR: "Animation extraction failed: {error}"
    ERROR: "Cannot proceed without animation tokens"
    EXIT 1

# Verify animation extraction results
animation_tokens_path = "{base_path}/animation-extraction/animation-tokens.json"
animation_guide_path = "{base_path}/animation-extraction/animation-guide.md"

IF NOT exists(animation_tokens_path) OR NOT exists(animation_guide_path):
    ERROR: "animation-extract did not generate required files"
    EXIT 1

TodoWrite(mark_completed: "Extract animation (CSS auto mode)",
          mark_in_progress: "Extract layout (structure templates)")
```

### Phase 2.5: Layout Extraction (Structure Templates)

```bash
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "🚀 Phase 2.5: Layout Extraction"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Build URL map for layout-extract
url_map_for_layout = ",".join([f"{target}:{url}" for target, url in url_map.items()])

# Call layout-extract command (imitate mode for structure replication)
# Pass --urls to enable auto-trigger of DOM structure extraction
layout_extract_command = f"/workflow:ui-design:layout-extract --base-path \"{base_path}\" --images \"{images_glob}\" --urls \"{url_map_for_layout}\" --targets \"{','.join(target_names)}\" --mode imitate"

TRY:
    SlashCommand(layout_extract_command)
CATCH error:
    ERROR: "Layout extraction failed: {error}"
    ERROR: "Cannot proceed without layout templates"
    EXIT 1

# Verify layout extraction results
layout_templates_path = "{base_path}/layout-extraction/layout-templates.json"

IF NOT exists(layout_templates_path):
    ERROR: "layout-extract did not generate layout-templates.json"
    EXIT 1

TodoWrite(mark_completed: "Extract layout (structure templates)",
          mark_in_progress: f"Assemble UI for {len(target_names)} targets")
```

### Phase 3: Batch UI Assembly

```bash
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "🚀 Phase 3: UI Assembly"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Call generate command (pure assembler - combines layout templates + design tokens)
generate_command = f"/workflow:ui-design:generate --base-path \"{base_path}\" --style-variants 1 --layout-variants 1"

TRY:
    SlashCommand(generate_command)
CATCH error:
    ERROR: "UI assembly failed: {error}"
    ERROR: "Layout templates or design tokens may be invalid"
    EXIT 1

# Verify assembly results
prototypes_dir = "{base_path}/prototypes"
generated_html_files = Glob(f"{prototypes_dir}/*-style-1-layout-1.html")
generated_count = len(generated_html_files)

IF generated_count < len(target_names):
    WARN: "⚠️ Expected {len(target_names)} prototypes, assembled {generated_count}"

TodoWrite(mark_completed: f"Assemble UI for {len(target_names)} targets",
          mark_in_progress: session_id ? "Integrate design system" : "Standalone completion")
```

### Phase 4: Design System Integration

```bash
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "🚀 Phase 4: Design System Integration"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

IF session_id:
    update_command = f"/workflow:ui-design:update --session {session_id}"

    TRY:
        SlashCommand(update_command)
    CATCH error:
        WARN: "⚠️ Design system integration failed: {error}"
        WARN: "Prototypes available at {base_path}/prototypes/"

# Update metadata
metadata = Read("{base_path}/.run-metadata.json")
metadata.status = "completed"
metadata.completion_time = current_timestamp()
metadata.outputs = {
    "screenshots": f"{base_path}/screenshots/",
    "style_system": f"{base_path}/style-extraction/style-1/",
    "prototypes": f"{base_path}/prototypes/",
    "captured_count": captured_count,
    "generated_count": generated_count
}
Write("{base_path}/.run-metadata.json", JSON.stringify(metadata, null, 2))

TodoWrite(mark_completed: session_id ? "Integrate design system" : "Standalone completion")

# Mark all phases complete
TodoWrite({todos: [
  {content: "Initialize and parse url-map", status: "completed", activeForm: "Initializing"},
  {content: capture_mode == "batch" ? f"Batch screenshot capture ({len(target_names)} targets)" : f"Deep exploration (depth {depth})", status: "completed", activeForm: "Capturing"},
  {content: "Extract style (complete design systems)", status: "completed", activeForm: "Extracting"},
  {content: "Extract animation (CSS auto mode)", status: "completed", activeForm: "Extracting animation"},
  {content: "Extract layout (structure templates)", status: "completed", activeForm: "Extracting layout"},
  {content: f"Assemble UI for {len(target_names)} targets", status: "completed", activeForm: "Assembling"},
  {content: session_id ? "Integrate design system" : "Standalone completion", status: "completed", activeForm: "Completing"}
]})
```

### Phase 6: Completion Report

**Completion Message**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ UI Design Imitate-Auto Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ 📊 Workflow Summary ━━━

Mode: {capture_mode == "batch" ? "Batch Multi-Page Replication" : f"Deep Interactive Exploration (depth {depth})"}
Session: {session_id or "standalone"}
Run ID: {run_id}

Phase 1 - Screenshot Capture: ✅ {IF capture_mode == "batch": f"{captured_count}/{total_requested} screenshots" ELSE: f"{captured_count} screenshots ({total_layers} layers)"}
  {IF capture_mode == "batch" AND captured_count < total_requested: f"⚠️ {total_requested - captured_count} missing" ELSE: "All targets captured"}

Phase 2 - Style Extraction: ✅ Production-ready design systems
  Output: style-extraction/style-1/ (design-tokens.json + style-guide.md)
  Quality: WCAG AA compliant, OKLCH colors

Phase 2.3 - Animation Extraction: ✅ CSS animations and transitions
  Output: animation-extraction/ (animation-tokens.json + animation-guide.md)
  Method: Auto-extracted from live URLs via Chrome DevTools

Phase 2.5 - Layout Extraction: ✅ Structure templates
  Templates: {template_count} layout structures

Phase 3 - UI Assembly: ✅ {generated_count} pages assembled
  Targets: {', '.join(target_names)}
  Configuration: 1 style × 1 layout × {generated_count} pages

Phase 4 - Integration: {IF session_id: "✅ Integrated into session" ELSE: "⏭️ Standalone mode"}

━━━ 📂 Output Structure ━━━

{base_path}/
├── screenshots/                    # {captured_count} screenshots
{IF capture_mode == "batch":
│   ├── {target1}.png
│   ├── {target2}.png
│   └── capture-metadata.json
ELSE:
│   ├── depth-1/
│   │   └── full-page.png
│   ├── depth-2/
│   │   └── {elements}.png
│   ├── depth-{depth}/
│   │   └── {layers}.png
│   └── layer-map.json
}
├── style-extraction/               # Production-ready design systems
│   └── style-1/
│       ├── design-tokens.json
│       └── style-guide.md
├── animation-extraction/           # CSS animations and transitions
│   ├── animation-tokens.json
│   └── animation-guide.md
├── layout-extraction/              # Structure templates
│   └── layout-templates.json
└── prototypes/                     # {generated_count} HTML/CSS files
    ├── {target1}-style-1-layout-1.html + .css
    ├── {target2}-style-1-layout-1.html + .css
    ├── compare.html                # Interactive preview
    └── index.html                  # Quick navigation

━━━ ⚡ Performance ━━━

Total workflow time: ~{estimate_total_time()} minutes
  Screenshot capture: ~{capture_time}
  Style extraction: ~{extract_time}
  Token processing: ~{token_processing_time}
  UI generation: ~{generate_time}

━━━ 🌐 Next Steps ━━━

1. Preview prototypes:
   • Interactive matrix: Open {base_path}/prototypes/compare.html
   • Quick navigation: Open {base_path}/prototypes/index.html

{IF session_id:
2. Create implementation tasks:
   /workflow:plan --session {session_id}

3. Generate tests (if needed):
   /workflow:test-gen {session_id}
ELSE:
2. To integrate into a workflow session:
   • Create session: /workflow:session:start
   • Copy design-tokens.json to session artifacts

3. Explore prototypes in {base_path}/prototypes/ directory
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## TodoWrite Pattern

```javascript
// Initialize IMMEDIATELY at start of Phase 0 to track multi-phase execution
TodoWrite({todos: [
  {content: "Initialize and parse url-map", status: "in_progress", activeForm: "Initializing"},
  {content: "Batch screenshot capture", status: "pending", activeForm: "Capturing screenshots"},
  {content: "Extract style (complete design systems)", status: "pending", activeForm: "Extracting style"},
  {content: "Extract layout (structure templates)", status: "pending", activeForm: "Extracting layout"},
  {content: "Assemble UI for all targets", status: "pending", activeForm: "Assembling UI"},
  {content: "Integrate design system", status: "pending", activeForm: "Integrating"}
]})

// ⚠️ CRITICAL: After EACH SlashCommand completion (Phase 1-5), you MUST:
// 1. SlashCommand blocks and returns when phase is complete
// 2. Update current phase: status → "completed"
// 3. Update next phase: status → "in_progress"
// 4. IMMEDIATELY execute next phase SlashCommand (auto-continue)
// This ensures continuous workflow tracking and prevents premature stopping
```

## Error Handling

### Pre-execution Checks
- **url-map format validation**: Clear error message with format example
- **Empty url-map**: Error and exit
- **Invalid target names**: Regex validation with suggestions

### Phase-Specific Errors
- **Screenshot capture failure (Phase 1)**:
  - If total_captured == 0: Terminate workflow
  - If partial failure: Warn but continue with available screenshots

- **Style extraction failure (Phase 2)**:
  - If extract fails: Terminate with clear error
  - If style-cards.json missing: Terminate with debugging info

- **Token processing failure (Phase 3)**:
  - Consolidate mode: Terminate if consolidate fails
  - Fast mode: Validate proposed_tokens exist before copying

- **UI generation failure (Phase 4)**:
  - If generate fails: Terminate with error
  - If generated_count < target_count: Warn but proceed

- **Integration failure (Phase 5)**:
  - Non-blocking: Warn but don't terminate
  - Prototypes already available

### Recovery Strategies
- **Partial screenshot failure**: Continue with available screenshots, list missing in warning
- **Generate failure**: Report specific target failures, user can re-generate individually
- **Integration failure**: Prototypes still usable, can integrate manually


## Key Features

- **🚀 Dual Capture**: Batch mode for speed, deep mode for detail
- **⚡ Production-Ready**: Complete design systems generated directly (~30-60s faster)
- **🎨 High-Fidelity**: Single unified design system from primary target
- **📦 Autonomous**: No user intervention required between phases
- **🔄 Reproducible**: Deterministic flow with isolated run directories
- **🎯 Flexible**: Standalone or session-integrated modes

## Examples

### 1. Basic Multi-Page Replication
```bash
/workflow:ui-design:imitate-auto --url-map "home:https://linear.app, features:https://linear.app/features"
# Result: 2 prototypes with fast-track tokens
```

### 2. Session Integration
```bash
/workflow:ui-design:imitate-auto --session WFS-payment --url-map "pricing:https://stripe.com/pricing"
# Result: 1 prototype with production-ready design system, integrated into session
```

### 3. Deep Exploration Mode
```bash
/workflow:ui-design:imitate-auto --url-map "app:https://app.com" --capture-mode deep --depth 3
# Result: Interactive layer capture + prototype
```

### 4. Guided Style Extraction
```bash
/workflow:ui-design:imitate-auto --url-map "home:https://example.com, about:https://example.com/about" --prompt "Focus on minimalist design"
# Result: 2 prototypes with minimalist style focus
```

## Integration Points

- **Input**: `--url-map` (multiple target:url pairs) + optional `--capture-mode`, `--depth`, `--session`, `--prompt`
- **Output**: Complete design system in `{base_path}/` (screenshots, style-extraction, layout-extraction, prototypes)
- **Sub-commands Called**:
  1. Phase 1 (conditional):
     - `--capture-mode batch`: `/workflow:ui-design:capture` (multi-URL batch)
     - `--capture-mode deep`: `/workflow:ui-design:explore-layers` (single-URL depth exploration)
  2. `/workflow:ui-design:style-extract` (Phase 2 - complete design systems)
  3. `/workflow:ui-design:animation-extract` (Phase 2.3 - CSS animations and transitions)
  4. `/workflow:ui-design:layout-extract` (Phase 2.5 - structure templates)
  5. `/workflow:ui-design:generate` (Phase 3 - pure assembly)
  6. `/workflow:ui-design:update` (Phase 4, if --session)

## Completion Output

```
✅ UI Design Imitate-Auto Workflow Complete!

Mode: {capture_mode} | Session: {session_id or "standalone"}
Run ID: {run_id}

Phase 1 - Screenshot Capture: ✅ {captured_count} screenshots
Phase 2 - Style Extraction: ✅ Production-ready design systems
Phase 2.5 - Layout Extraction: ✅ Structure templates
Phase 3 - UI Assembly: ✅ {generated_count} pages assembled
Phase 4 - Integration: {IF session_id: "✅ Integrated" ELSE: "⏭️ Standalone"}

Design Quality:
✅ High-Fidelity Replication: Accurate style from primary target
✅ Token-Driven Styling: 100% var() usage
✅ Production-Ready: WCAG AA compliant, OKLCH colors

📂 {base_path}/
  ├── screenshots/                  # {captured_count} screenshots
  ├── style-extraction/style-1/     # Production-ready design system
  ├── layout-extraction/            # Structure templates
  └── prototypes/                   # {generated_count} HTML/CSS files

🌐 Preview: {base_path}/prototypes/compare.html
  - Interactive preview
  - Side-by-side comparison
  - {generated_count} replicated pages

Next: [/workflow:execute] OR [Open compare.html → /workflow:plan]
```
