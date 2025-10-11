---
name: imitate-auto
description: High-speed multi-page UI replication with batch screenshot and optional token refinement
argument-hint: --url-map "<map>" [--capture-mode <batch|deep>] [--depth <1-5>] [--session <id>] [--refine-tokens] [--prompt "<desc>"]
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
4. Phase 2: Style extraction (visual tokens) → **WAIT for completion** → Auto-continues
5. Phase 2.5: Layout extraction (structure templates) → **WAIT for completion** → Auto-continues
6. Phase 3: Token processing (conditional consolidate) → **WAIT for completion** → Auto-continues
7. Phase 4: Batch UI assembly → **WAIT for completion** → Auto-continues
8. Phase 5: Design system integration → Reports completion

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

- `--refine-tokens` (Optional, default: false): Enable full token refinement
  - `false` (default): Fast path, skip consolidate (~30-60s faster)
  - `true`: Production quality, execute full consolidate (philosophy-driven refinement)

- `--prompt "<desc>"` (Optional): Style extraction guidance
  - Influences extract command analysis focus
  - Example: `"Focus on dark mode"`, `"Emphasize minimalist design"`

## Execution Modes

**Capture Modes**:
- **Batch Mode** (default): Multi-URL screenshot capture for fast replication
  - Uses `/workflow:ui-design:capture` for parallel screenshot capture
  - Optimized for replicating multiple pages efficiently
- **Deep Mode**: Single-URL layer exploration for detailed analysis
  - Uses `/workflow:ui-design:explore-layers` for interactive depth traversal
  - Captures page layers at different depths (1-5)
  - Only processes first URL from url-map

**Token Processing Modes**:
- **Fast-Track** (default): Skip consolidate, use proposed tokens directly (~2s)
  - Best for rapid prototyping and testing
  - Tokens may lack philosophy-driven refinement
- **Production** (--refine-tokens): Full consolidate with WCAG validation (~60s)
  - Philosophy-driven token refinement
  - Complete accessibility validation
  - Production-ready design system

**Session Integration**:
- `--session` flag determines session integration or standalone execution
- Integrated: Design system automatically added to session artifacts
- Standalone: Output in `.workflow/.design/{run_id}/`

## 6-Phase Execution

### Phase 0: Initialization and Target Parsing

```bash
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "🚀 UI Design Imitate-Auto"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Constants
DEPTH_NAMES = {
    1: "Page level",
    2: "Element level",
    3: "Interaction level",
    4: "Embedded level",
    5: "Shadow DOM"
}

# Generate run ID
run_id = "run-$(date +%Y%m%d-%H%M%S)"

# Determine base path and session mode
IF --session:
    session_id = {provided_session}
    base_path = ".workflow/WFS-{session_id}/design-{run_id}"
    session_mode = "integrated"
    REPORT: "Mode: Integrated (Session: {session_id})"
ELSE:
    session_id = null
    base_path = ".workflow/.design/{run_id}"
    session_mode = "standalone"
    REPORT: "Mode: Standalone"

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
refine_tokens_mode = --refine-tokens OR false

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
        "refine_tokens": refine_tokens_mode,
        "prompt": --prompt OR null
    },
    "targets": target_names,
    "status": "in_progress"
}

Write("{base_path}/.run-metadata.json", JSON.stringify(metadata, null, 2))

REPORT: ""
REPORT: "Configuration:"
REPORT: "  Capture mode: {capture_mode}"
IF capture_mode == "deep":
    REPORT: "    Depth level: {depth} ({DEPTH_NAMES[depth]})"
    REPORT: "    Target: '{primary_target}' ({url_map[primary_target]})"
ELSE:
    REPORT: "    Targets: {len(target_names)} pages"
    REPORT: "    Primary source: '{primary_target}' ({url_map[primary_target]})"
    REPORT: "    All targets: {', '.join(target_names)}"
REPORT: "  Token refinement: {refine_tokens_mode ? 'Enabled (production quality)' : 'Disabled (fast-track)'}"
IF --prompt:
    REPORT: "  Prompt guidance: \"{--prompt}\""
REPORT: ""

# Initialize TodoWrite
TodoWrite({todos: [
  {content: "Initialize and parse url-map", status: "completed", activeForm: "Initializing"},
  {content: capture_mode == "batch" ? f"Batch screenshot capture ({len(target_names)} targets)" : f"Deep exploration (depth {depth})", status: "pending", activeForm: "Capturing screenshots"},
  {content: "Extract style (visual tokens)", status: "pending", activeForm: "Extracting style"},
  {content: "Extract layout (structure templates)", status: "pending", activeForm: "Extracting layout"},
  {content: refine_tokens_mode ? "Refine design tokens via consolidate" : "Fast token adaptation (skip consolidate)", status: "pending", activeForm: "Processing tokens"},
  {content: f"Assemble UI for {len(target_names)} targets", status: "pending", activeForm: "Assembling UI"},
  {content: session_id ? "Integrate design system" : "Standalone completion", status: "pending", activeForm: "Completing"}
]})
```

### Phase 1: Screenshot Capture (Dual Mode)

```bash
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: f"🚀 Phase 1: Screenshot Capture ({capture_mode} mode)"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

IF capture_mode == "batch":
    # Mode A: Batch Multi-URL Capture
    REPORT: "Using batch capture for multiple URLs..."

    # Build url-map string for capture command
    url_map_command_string = ",".join([f"{name}:{url}" for name, url in url_map.items()])

    # Call capture command
    capture_command = f"/workflow:ui-design:capture --base-path \"{base_path}\" --url-map \"{url_map_command_string}\""

    REPORT: f"  Command: {capture_command}"
    REPORT: f"  Targets: {len(target_names)}"

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

    REPORT: ""
    REPORT: "✅ Batch capture complete:"
    REPORT: "   Captured: {captured_count}/{total_requested} screenshots ({(captured_count/total_requested*100):.1f}%)"

    IF missing_count > 0:
        missing_targets = [s.target for s in screenshot_metadata.screenshots if not s.captured]
        WARN: "   ⚠️ Missing {missing_count} screenshots: {', '.join(missing_targets)}"
        WARN: "   Proceeding with available screenshots for extract phase"

    # If all screenshots failed, terminate
    IF captured_count == 0:
        ERROR: "No screenshots captured - cannot proceed"
        ERROR: "Please check URLs and tool availability"
        EXIT 1

ELSE:  # capture_mode == "deep"
    # Mode B: Deep Interactive Layer Exploration
    REPORT: "Using deep exploration for single URL..."

    primary_url = url_map[primary_target]

    # Call explore-layers command
    explore_command = f"/workflow:ui-design:explore-layers --url \"{primary_url}\" --depth {depth} --base-path \"{base_path}\""

    REPORT: f"  Command: {explore_command}"
    REPORT: f"  URL: {primary_url}"
    REPORT: f"  Depth: {depth} ({DEPTH_NAMES[depth]})"

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
    total_layers = len(layer_map.layers)
    captured_count = layer_map.summary.total_captures

    REPORT: ""
    REPORT: "✅ Deep exploration complete:"
    REPORT: "   Layers: {total_layers} (depth 1-{depth})"
    REPORT: "   Captures: {captured_count} screenshots"
    REPORT: "   Total size: {layer_map.summary.total_size_kb:.1f} KB"

    # Count actual images for extract phase
    total_requested = captured_count  # For consistency with batch mode

TodoWrite(mark_completed: f"Batch screenshot capture ({len(target_names)} targets)" IF capture_mode == "batch" ELSE f"Deep exploration (depth {depth})",
          mark_in_progress: "Extract style (visual tokens)")
```

### Phase 2: Style Extraction (Visual Tokens)

```bash
REPORT: ""
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "🚀 Phase 2: Extract Style (Visual Tokens)"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Use all screenshots as input to extract single design system
IF capture_mode == "batch":
    images_glob = f"{base_path}/screenshots/*.{{png,jpg,jpeg,webp}}"
ELSE:  # deep mode
    images_glob = f"{base_path}/screenshots/**/*.{{png,jpg,jpeg,webp}}"  # Include all depth directories

# Build extraction prompt
IF --prompt:
    user_guidance = {--prompt}
    extraction_prompt = f"Extract visual style tokens (colors, typography, spacing) from the '{primary_target}' page. Use other screenshots for consistency. User guidance: {user_guidance}"
ELSE:
    extraction_prompt = f"Extract visual style tokens (colors, typography, spacing) from the '{primary_target}' page. Use other screenshots for consistency across all pages."

# Call style-extract command (imitate mode, automatically uses single variant)
extract_command = f"/workflow:ui-design:style-extract --base-path \"{base_path}\" --images \"{images_glob}\" --prompt \"{extraction_prompt}\" --mode imitate"

REPORT: "Calling style-extract command..."
REPORT: f"  Mode: imitate (high-fidelity single style, auto variants=1)"
REPORT: f"  Primary source: '{primary_target}'"
REPORT: f"  Images: {images_glob}"

TRY:
    SlashCommand(extract_command)
CATCH error:
    ERROR: "Style extraction failed: {error}"
    ERROR: "Cannot proceed without visual tokens"
    EXIT 1

# style-extract outputs to: {base_path}/style-extraction/style-cards.json

# Verify extraction results
style_cards_path = "{base_path}/style-extraction/style-cards.json"

IF NOT exists(style_cards_path):
    ERROR: "style-extract command did not generate style-cards.json"
    ERROR: "Expected: {style_cards_path}"
    EXIT 1

style_cards = Read(style_cards_path)

IF len(style_cards.style_cards) != 1:
    ERROR: "Expected single variant in imitate mode, got {len(style_cards.style_cards)}"
    EXIT 1

extracted_style = style_cards.style_cards[0]

REPORT: ""
REPORT: "✅ Phase 2 complete:"
REPORT: "   Style: '{extracted_style.name}'"
REPORT: "   Philosophy: {extracted_style.design_philosophy}"
REPORT: "   Tokens: {count_tokens(extracted_style.proposed_tokens)} visual tokens"

TodoWrite(mark_completed: "Extract style (visual tokens)",
          mark_in_progress: "Extract layout (structure templates)")
```

### Phase 2.5: Layout Extraction (Structure Templates)

```bash
REPORT: ""
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "🚀 Phase 2.5: Extract Layout (Structure Templates)"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Reuse same screenshots for layout extraction
# Build URL map for layout-extract (uses first URL from each target)
url_map_for_layout = ",".join([f"{target}:{url}" for target, url in url_map.items()])

# Call layout-extract command (imitate mode for structure replication)
layout_extract_command = f"/workflow:ui-design:layout-extract --base-path \"{base_path}\" --images \"{images_glob}\" --targets \"{','.join(target_names)}\" --mode imitate"

REPORT: "Calling layout-extract command..."
REPORT: f"  Mode: imitate (high-fidelity structure replication)"
REPORT: f"  Targets: {', '.join(target_names)}"
REPORT: f"  Images: {images_glob}"

TRY:
    SlashCommand(layout_extract_command)
CATCH error:
    ERROR: "Layout extraction failed: {error}"
    ERROR: "Cannot proceed without layout templates"
    EXIT 1

# layout-extract outputs to: {base_path}/layout-extraction/layout-templates.json

# Verify layout extraction results
layout_templates_path = "{base_path}/layout-extraction/layout-templates.json"

IF NOT exists(layout_templates_path):
    ERROR: "layout-extract command did not generate layout-templates.json"
    ERROR: "Expected: {layout_templates_path}"
    EXIT 1

layout_templates = Read(layout_templates_path)
template_count = len(layout_templates.layout_templates)

REPORT: ""
REPORT: "✅ Phase 2.5 complete:"
REPORT: "   Templates: {template_count} layout structures"
REPORT: "   Targets: {', '.join(target_names)}"

TodoWrite(mark_completed: "Extract layout (structure templates)",
          mark_in_progress: refine_tokens_mode ? "Refine design tokens via consolidate" : "Fast token adaptation")
```

### Phase 3: Token Processing (Conditional Consolidate)

```bash
REPORT: ""
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "🚀 Phase 3: Token Processing"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

IF refine_tokens_mode:
    # Path A: Full consolidate (production quality)
    REPORT: "🔧 Using full consolidate for production-ready tokens"
    REPORT: "   Benefits:"
    REPORT: "   • Philosophy-driven token refinement"
    REPORT: "   • WCAG AA accessibility validation"
    REPORT: "   • Complete design system documentation"
    REPORT: "   • Token gap filling and consistency checks"
    REPORT: ""

    consolidate_command = f"/workflow:ui-design:consolidate --base-path \"{base_path}\" --variants 1"

    REPORT: f"Calling consolidate command..."

    TRY:
        SlashCommand(consolidate_command)
    CATCH error:
        ERROR: "Token consolidation failed: {error}"
        ERROR: "Cannot proceed without refined tokens"
        EXIT 1

    # consolidate outputs to: {base_path}/style-consolidation/style-1/design-tokens.json
    tokens_path = "{base_path}/style-consolidation/style-1/design-tokens.json"

    IF NOT exists(tokens_path):
        ERROR: "consolidate command did not generate design-tokens.json"
        ERROR: "Expected: {tokens_path}"
        EXIT 1

    REPORT: ""
    REPORT: "✅ Full consolidate complete"
    REPORT: "   Output: style-consolidation/style-1/"
    REPORT: "   Quality: Production-ready"
    token_quality = "production-ready (consolidated)"
    time_spent_estimate = "~60s"

ELSE:
    # Path B: Fast Token Adaptation
    REPORT: "⚡ Fast token adaptation (skipping consolidate for speed)"
    REPORT: "   Note: Using proposed tokens from extraction phase"
    REPORT: "   For production quality, re-run with --refine-tokens flag"
    REPORT: ""

    # Directly copy proposed_tokens to consolidation directory
    style_cards = Read("{base_path}/style-extraction/style-cards.json")
    proposed_tokens = style_cards.style_cards[0].proposed_tokens

    # Create directory and write tokens
    consolidation_dir = "{base_path}/style-consolidation/style-1"
    Bash(mkdir -p "{consolidation_dir}")

    tokens_path = f"{consolidation_dir}/design-tokens.json"
    Write(tokens_path, JSON.stringify(proposed_tokens, null, 2))

    # Create simplified style guide
    variant = style_cards.style_cards[0]
    simple_guide = f"""# Design System: {variant.name}

## Design Philosophy
{variant.design_philosophy}

## Description
{variant.description}

## Design Tokens
All tokens in `design-tokens.json` follow OKLCH color space.

**Note**: Generated in fast-track imitate mode using proposed tokens from extraction.
For production-ready quality with philosophy-driven refinement, re-run with `--refine-tokens` flag.

## Color Preview
- Primary: {variant.preview.primary if variant.preview else "N/A"}
- Background: {variant.preview.background if variant.preview else "N/A"}

## Typography Preview
- Heading Font: {variant.preview.font_heading if variant.preview else "N/A"}

## Token Categories
{list_token_categories(proposed_tokens)}
"""

    Write(f"{consolidation_dir}/style-guide.md", simple_guide)

    REPORT: "✅ Fast adaptation complete (~2s vs ~60s with consolidate)"
    REPORT: "   Output: style-consolidation/style-1/"
    REPORT: "   Quality: Proposed (not refined)"
    REPORT: "   Time saved: ~30-60s"
    token_quality = "proposed (fast-track)"
    time_spent_estimate = "~2s"

REPORT: ""
REPORT: "Token processing summary:"
REPORT: "   Path: {refine_tokens_mode ? 'Full consolidate' : 'Fast adaptation'}"
REPORT: "   Quality: {token_quality}"
REPORT: "   Time: {time_spent_estimate}"

TodoWrite(mark_completed: refine_tokens_mode ? "Refine design tokens via consolidate" : "Fast token adaptation",
          mark_in_progress: f"Assemble UI for {len(target_names)} targets")
```

### Phase 4: Batch UI Assembly

```bash
REPORT: ""
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "🚀 Phase 4: Batch UI Assembly"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Build targets string
targets_string = ",".join(target_names)

# Call generate command (now pure assembler - combines layout templates + design tokens)
generate_command = f"/workflow:ui-design:generate --base-path \"{base_path}\" --style-variants 1 --layout-variants 1"

REPORT: "Calling generate command (pure assembler)..."
REPORT: f"  Targets: {targets_string} (from layout templates)"
REPORT: f"  Configuration: 1 style × 1 layout × {len(target_names)} pages"
REPORT: f"  Inputs: layout-templates.json + design-tokens.json"

TRY:
    SlashCommand(generate_command)
CATCH error:
    ERROR: "UI assembly failed: {error}"
    ERROR: "Layout templates or design tokens may be invalid"
    EXIT 1

# generate outputs to: {base_path}/prototypes/{target}-style-1-layout-1.html

# Verify assembly results
prototypes_dir = "{base_path}/prototypes"
generated_html_files = Glob(f"{prototypes_dir}/*-style-1-layout-1.html")
generated_count = len(generated_html_files)

REPORT: ""
REPORT: "✅ Phase 4 complete:"
REPORT: "   Assembled: {generated_count} HTML prototypes"
REPORT: "   Targets: {', '.join(target_names)}"
REPORT: "   Output: {prototypes_dir}/"

IF generated_count < len(target_names):
    WARN: "   ⚠️ Expected {len(target_names)} prototypes, assembled {generated_count}"
    WARN: "   Some targets may have failed - check generate output"

TodoWrite(mark_completed: f"Assemble UI for {len(target_names)} targets",
          mark_in_progress: session_id ? "Integrate design system" : "Standalone completion")
```

### Phase 5: Design System Integration

```bash
REPORT: ""
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "🚀 Phase 5: Design System Integration"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

IF session_id:
    REPORT: "Integrating design system into session {session_id}..."

    update_command = f"/workflow:ui-design:update --session {session_id}"

    TRY:
        SlashCommand(update_command)
    CATCH error:
        WARN: "Design system integration failed: {error}"
        WARN: "Prototypes are still available at {base_path}/prototypes/"
        # Don't terminate, prototypes already generated

    REPORT: "✅ Design system integrated into session {session_id}"
ELSE:
    REPORT: "ℹ️ Standalone mode: Skipping integration"
    REPORT: "   Prototypes available at: {base_path}/prototypes/"
    REPORT: "   To integrate later:"
    REPORT: "   1. Create a workflow session"
    REPORT: "   2. Copy design-tokens.json to session artifacts"

# Update metadata
metadata = Read("{base_path}/.run-metadata.json")
metadata.status = "completed"
metadata.completion_time = current_timestamp()
metadata.outputs = {
    "screenshots": f"{base_path}/screenshots/",
    "style_system": f"{base_path}/style-consolidation/style-1/",
    "prototypes": f"{base_path}/prototypes/",
    "token_quality": token_quality,
    "captured_count": captured_count,
    "generated_count": generated_count
}
Write("{base_path}/.run-metadata.json", JSON.stringify(metadata, null, 2))

TodoWrite(mark_completed: session_id ? "Integrate design system" : "Standalone completion")

# Mark all phases complete
TodoWrite({todos: [
  {content: "Initialize and parse url-map", status: "completed", activeForm: "Initializing"},
  {content: capture_mode == "batch" ? f"Batch screenshot capture ({len(target_names)} targets)" : f"Deep exploration (depth {depth})", status: "completed", activeForm: "Capturing"},
  {content: "Extract unified design system", status: "completed", activeForm: "Extracting"},
  {content: refine_tokens_mode ? "Refine design tokens via consolidate" : "Fast token adaptation", status: "completed", activeForm: "Processing"},
  {content: f"Generate UI for {len(target_names)} targets", status: "completed", activeForm: "Generating"},
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

Phase 2 - Style Extraction: ✅ Single unified design system
  Style: {extracted_style.name}
  Philosophy: {extracted_style.design_philosophy[:80]}...

Phase 3 - Token Processing: ✅ {token_quality}
  {IF refine_tokens_mode:
    "Full consolidate (~60s)"
    "Quality: Production-ready with philosophy-driven refinement"
  ELSE:
    "Fast adaptation (~2s, saved ~30-60s)"
    "Quality: Proposed tokens (for production, use --refine-tokens)"
  }

Phase 4 - UI Generation: ✅ {generated_count} pages generated
  Targets: {', '.join(target_names)}
  Configuration: 1 style × 1 layout × {generated_count} pages

Phase 5 - Integration: {IF session_id: "✅ Integrated into session" ELSE: "⏭️ Standalone mode"}

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
├── style-extraction/               # Design analysis
│   └── style-cards.json
├── style-consolidation/            # {token_quality}
│   └── style-1/
│       ├── design-tokens.json
│       └── style-guide.md
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

{IF NOT refine_tokens_mode:
💡 Production Quality Tip:
   Fast-track mode used proposed tokens for speed.
   For production-ready quality with full token refinement:
   /workflow:ui-design:imitate-auto --url-map "{url_map_command_string}" --refine-tokens {f"--session {session_id}" if session_id else ""}
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## TodoWrite Pattern

```javascript
// Initialize IMMEDIATELY at start of Phase 0 to track multi-phase execution
TodoWrite({todos: [
  {content: "Initialize and parse url-map", status: "in_progress", activeForm: "Initializing"},
  {content: "Batch screenshot capture", status: "pending", activeForm: "Capturing screenshots"},
  {content: "Extract unified design system", status: "pending", activeForm: "Extracting style"},
  {content: refine_tokens ? "Refine tokens via consolidate" : "Fast token adaptation", status: "pending", activeForm: "Processing tokens"},
  {content: "Generate UI for all targets", status: "pending", activeForm: "Generating UI"},
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
- **⚡ Fast-Track Option**: Skip consolidate for 30-60s time savings
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

### 2. Production-Ready with Session
```bash
/workflow:ui-design:imitate-auto --session WFS-payment --url-map "pricing:https://stripe.com/pricing" --refine-tokens
# Result: 1 prototype with production tokens, integrated into session
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

- **Input**: `--url-map` (multiple target:url pairs) + optional `--capture-mode`, `--depth`, `--session`, `--refine-tokens`, `--prompt`
- **Output**: Complete design system in `{base_path}/` (screenshots, style-extraction, style-consolidation, prototypes)
- **Sub-commands Called**:
  1. Phase 1 (conditional):
     - `--capture-mode batch`: `/workflow:ui-design:capture` (multi-URL batch)
     - `--capture-mode deep`: `/workflow:ui-design:explore-layers` (single-URL depth exploration)
  2. `/workflow:ui-design:extract` (Phase 2)
  3. `/workflow:ui-design:consolidate` (Phase 3, conditional)
  4. `/workflow:ui-design:generate` (Phase 4)
  5. `/workflow:ui-design:update` (Phase 5, if --session)

## Completion Output

```
✅ UI Design Imitate-Auto Workflow Complete!

Mode: {capture_mode} | Session: {session_id or "standalone"}
Run ID: {run_id}

Phase 1 - Screenshot Capture: ✅ {captured_count} screenshots
Phase 2 - Style Extraction: ✅ Single unified design system
Phase 3 - Token Processing: ✅ {token_quality}
Phase 4 - UI Generation: ✅ {generated_count} pages generated
Phase 5 - Integration: {IF session_id: "✅ Integrated" ELSE: "⏭️ Standalone"}

Design Quality:
✅ High-Fidelity Replication: Accurate style from primary target
✅ Token-Driven Styling: 100% var() usage
✅ {IF refine_tokens: "Production-Ready: WCAG validated" ELSE: "Fast-Track: Proposed tokens"}

📂 {base_path}/
  ├── screenshots/                  # {captured_count} screenshots
  ├── style-extraction/             # Design analysis
  ├── style-consolidation/          # {token_quality}
  └── prototypes/                   # {generated_count} HTML/CSS files

🌐 Preview: {base_path}/prototypes/compare.html
  - Interactive preview
  - Side-by-side comparison
  - {generated_count} replicated pages

Next: [/workflow:execute] OR [Open compare.html → /workflow:plan]
```
