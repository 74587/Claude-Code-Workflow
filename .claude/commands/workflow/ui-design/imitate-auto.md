---
name: imitate-auto
description: Imitation-focused UI design workflow - Rapidly replicate a single design style from URL or images (skip exploration, direct to implementation)
usage: /workflow:ui-design:imitate-auto [--url "<url>"] [--images "<glob>"] [--prompt "<desc>"] [--targets "<list>"] [--target-type "page|component"] [--session <id>]
argument-hint: "[--url \"https://example.com\"] [--images \"refs/*.png\"] [--prompt \"Imitate dark mode style\"] [--targets \"dashboard,settings\"] [--target-type \"page\"]"
examples:
  - /workflow:ui-design:imitate-auto --url "https://linear.app" --targets "home,features,pricing"
  - /workflow:ui-design:imitate-auto --images "refs/design.png" --prompt "Imitate this minimalist design for dashboard and settings"
  - /workflow:ui-design:imitate-auto --url "https://stripe.com" --session WFS-payment
  - /workflow:ui-design:imitate-auto --images "refs/*.png" --targets "home"
  - /workflow:ui-design:imitate-auto --url "https://example.com" --targets "navbar,hero" --target-type "component"
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*), Glob(*), Write(*)
---

# UI Design Imitate-Auto Workflow Command

## Overview & Philosophy

**Fast-track UI imitation workflow**: Replicates a single design style from reference source (URL or images), bypassing exploration and consolidation phases for maximum speed (~2-3× faster than explore-auto).

**Core Philosophy**:
- **Imitation over Exploration**: Focus on replicating specific design, not generating variants
- **Single Mode**: Always 1 style × 1 layout × N targets
- **Speed Optimized**: Bypasses `consolidate` step via direct token extraction
- **Reference-Driven**: Requires URL or images as primary input
- **Auto-Screenshot**: Supports Playwright/Chrome with manual upload fallback

**Streamlined Flow**: Phase 0 (init) → 0.5 (screenshot) → 1 (extraction) → 2 (token adapt) → 3 (generate) → 4 (integrate)

**Performance**: ~2-3× faster than explore-auto for single-style scenarios

**Ideal For**: MVP development, high-fidelity prototyping, design replication, studying successful patterns

## Key Features

- **Fast-Track Imitation**: ~2-3× faster than explore-auto by bypassing consolidation phase
- **Reference-Driven**: Requires URL or images as primary design source for accurate replication
- **Auto-Screenshot Capability**: Intelligent fallback (Playwright → Chrome → Manual upload) for URL-based workflows
- **Single-Style Focus**: Always generates 1 style × 1 layout × N targets for streamlined execution
- **Consolidation Bypass**: Direct design token extraction saves 30-60s per workflow
- **Interactive Confirmation**: User validates inferred targets before execution to prevent mistakes
- **Flexible Target Types**: Supports both full-page layouts and isolated UI components

## Core Rules

1. **Start Immediately**: TodoWrite initialization → Phase 0 execution
2. **No Multi-Variant**: Always 1 style × 1 layout × N targets
3. **Reference Required**: Must provide `--url` OR `--images`
4. **Auto-Continue**: Automatic phase progression without pausing
5. **Track Progress**: Update TodoWrite after each phase

## Parameter Requirements

**Required Parameters** (at least one must be provided):
- `--url "<url>"`: Reference website URL for style imitation (supports auto-screenshot)
- `--images "<glob>"`: Reference image paths (e.g., `refs/*.png`, `design-refs/*.jpg`)

**Optional Parameters** (all have smart defaults):
- `--targets "<list>"`: Comma-separated targets (pages/components) to generate
  - Examples: `"home,dashboard"`, `"navbar,hero,card"`
  - If omitted: inferred from `--prompt` or defaults to `["home"]`
- `--target-type "page|component"`: Explicitly set target type
  - `page`: Full-page layouts with complete structure
  - `component`: Isolated UI elements with minimal wrapper
  - Default: intelligent detection based on target names
- `--session <id>`: Workflow session ID (e.g., `WFS-ecommerce`)
  - If provided: integrates with session brainstorming artifacts
  - If omitted: runs in standalone mode
- `--prompt "<description>"`: Design guidance and target hints
  - Used for target inference and style extraction refinement
  - Examples: `"Imitate dark mode for dashboard"`, `"Focus on minimalist design"`

**Legacy Parameters** (maintained for backward compatibility):
- `--pages "<list>"`: Alias for `--targets` with `--target-type page`

**Not Supported** (use `/workflow:ui-design:explore-auto` instead):
- `--style-variants`, `--layout-variants`, `--batch-plan`

**Input Rules**:
- Must provide at least one: `--url` OR `--images`
- Multiple parameters can be combined for guided imitation
- If `--targets` not provided, intelligently inferred from prompt or defaults to `["home"]`
- URL and images can be used together (screenshot + additional references)

**Supported Target Types**:
- **Pages** (full layouts): home, dashboard, settings, profile, login, pricing, etc.
- **Components** (UI elements):
  - Navigation: navbar, header, menu, sidebar, tabs
  - Content: hero, card, list, table, gallery
  - Input: form, search, filter, button
  - Feedback: modal, alert, toast, badge
  - Other: footer, dropdown, avatar, pagination

## 5-Phase Execution

### Phase 0: Simplified Initialization

```bash
run_id = "run-$(date +%Y%m%d-%H%M%S)"
base_path = --session ? ".workflow/WFS-{session}/design-${run_id}" : ".workflow/.design/${run_id}"

Bash(mkdir -p "${base_path}/{style-extraction,style-consolidation/style-1,prototypes}")

# Metadata
Write({base_path}/.run-metadata.json): {
  "run_id": "${run_id}", "session_id": "${session_id}", "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "workflow": "ui-design:imitate-auto", "mode": "single_style_imitation",
  "parameters": {"url": "${url_value}", "images": "${images_pattern}", "targets": "${target_list}", "prompt": "${prompt_text}"},
  "status": "in_progress"
}

# Unified target inference (no interactive confirmation)
target_list = []; target_type = "page"; target_source = "none"

# Priority: --pages (legacy) → --targets → --prompt → default
IF --pages: target_list = split(--pages); target_type = "page"; target_source = "explicit_legacy"
ELSE IF --targets:
    target_list = split(--targets)
    target_type = --target-type ? --target-type : detect_target_type(target_list)
    target_source = "explicit"
ELSE IF --prompt:
    target_list = extract_targets_from_prompt(prompt_text) OR ["home"]
    target_type = --target-type ? --target-type : detect_target_type(target_list)
    target_source = "prompt_inferred"
ELSE:
    target_list = ["home"]; target_type = "page"; target_source = "default"

# Validate and clean
validated_targets = [t.strip().lower().replace(" ", "-") for t in target_list if regex_match(t, r"^[a-z0-9][a-z0-9_-]*$")]
IF NOT validated_targets: validated_targets = ["home"]; target_type = "page"

type_emoji = "📄" IF target_type == "page" ELSE "🧩"
type_label = "pages" IF target_type == "page" ELSE "components"

# Interactive confirmation
DISPLAY_CONFIRMATION(target_type, target_source, validated_targets):
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  "⚡ IMITATE MODE CONFIRMATION"
  "Type: {target_type} | Source: {target_source}"
  "Targets ({count}): {', '.join(validated_targets)}"
  "Reference: {url_value OR images_pattern}"
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

REPORT: "✅ Confirmed: {len(validated_targets)} {type_label} with single style"
REPORT: "   {type_emoji} Targets: {', '.join(validated_targets)} | Type: {target_type} | Reference: {url_value OR images_pattern}"

STORE: run_id, base_path, inferred_target_list = validated_targets, target_type
```

**Helper Function: detect_target_type()**
```bash
detect_target_type(target_list):
    page_keywords = ["home", "dashboard", "settings", "profile", "login", "signup", "auth", "pricing", "about", "contact", ...]
    component_keywords = ["navbar", "header", "footer", "hero", "card", "button", "form", "modal", "alert", "dropdown", ...]

    page_matches = count_matches(target_list, page_keywords + ["page", "screen", "view"])
    component_matches = count_matches(target_list, component_keywords + ["component", "widget", "element"])

    RETURN "component" IF component_matches > page_matches ELSE "page"
```

### Phase 0.5: URL Screenshot Capture (Auto-Fallback)

**Condition**: Only if `--url` provided

```bash
IF --url:
    screenshot_dir = "{base_path}/screenshots"; Bash(mkdir -p "{screenshot_dir}")
    screenshot_success = false; screenshot_files = []

    # Try Playwright → Chrome → Manual fallback
    TRY: Bash(npx playwright screenshot "{url_value}" "{screenshot_dir}/full-page.png" --full-page --timeout 30000)
         screenshot_files.append("{screenshot_dir}/full-page.png"); screenshot_success = true
         REPORT: "   ✅ Playwright screenshot captured"
    CATCH: REPORT: "   ⚠️ Playwright failed"

    IF NOT screenshot_success:
        TRY: Bash(google-chrome --headless --disable-gpu --screenshot="{screenshot_dir}/full-page.png" --window-size=1920,1080 "{url_value}")
             screenshot_files.append("{screenshot_dir}/full-page.png"); screenshot_success = true
             REPORT: "   ✅ Chrome screenshot captured"
        CATCH: REPORT: "   ⚠️ Chrome failed"

    # Manual upload fallback
    IF NOT screenshot_success:
        REPORT: "━━━ ⚠️ AUTOMATED SCREENSHOT FAILED ━━━"
        REPORT: "Unable to capture: {url_value}"
        REPORT: "Manual screenshot required:"
        REPORT: "  1. Visit: {url_value} | 2. Take full-page screenshot | 3. Save to: {screenshot_dir}/"
        REPORT: "Options: 'ready' (screenshot saved) | 'skip' (URL only) | 'abort' (cancel)"
        REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        user_response = WAIT_FOR_USER_INPUT()
        MATCH user_response:
          "ready|done|ok" → screenshot_files = Glob("{screenshot_dir}/*.{png,jpg,jpeg}");
                            IF screenshot_files: screenshot_success = true; REPORT: "✅ Manual screenshot detected"
                            ELSE: REPORT: "❌ No screenshot found, using URL analysis only"
          "skip" → REPORT: "⏭️ Skipping screenshot, using URL analysis"
          "abort" → ERROR: "Workflow aborted by user"; EXIT
          _ → REPORT: "⚠️ Invalid input, proceeding with URL analysis"

    # Store results
    STORE: screenshot_mode = screenshot_success ? "with_screenshots" : "url_only", screenshot_paths = screenshot_files
    REPORT: screenshot_success ? "✅ Screenshot capture complete: {len(screenshot_files)} image(s)" : "ℹ️ Proceeding with URL analysis only"
ELSE:
    STORE: screenshot_mode = "manual_images", screenshot_paths = []
    REPORT: "ℹ️ Using provided images (--images parameter)"
```

### Phase 1: Single Style Extraction

```bash
# Determine input based on screenshot capture
source_desc = screenshot_mode == "with_screenshots" ? "captured screenshots from {url_value}" :
              screenshot_mode == "url_only" ? "URL analysis of {url_value}" : "user-provided images"

images_flag = screenshot_mode == "with_screenshots" ? "--images \"{base_path}/screenshots/*.{png,jpg,jpeg}\"" :
              screenshot_mode == "manual_images" AND --images ? "--images \"{image_glob}\"" : ""

url_flag = screenshot_mode == "url_only" ? "--url \"{url_value}\"" : ""

# Construct optimized extraction prompt
enhanced_prompt = "Extract a single, high-fidelity design system that accurately imitates the visual style from {source_desc}. {prompt_text}"

# Force single variant
command = "/workflow:ui-design:extract --base-path \"{base_path}\" {url_flag} {images_flag} --prompt \"{enhanced_prompt}\" --variants 1"

REPORT: "🚀 Phase 1: Style Extraction | Source: {source_desc} | Mode: Single style (imitation-optimized)"

SlashCommand(command)  # → Phase 2
```

### Phase 2: Fast Token Adaptation (Bypass Consolidate)

```bash
REPORT: "🚀 Phase 2: Fast token adaptation (bypassing consolidate)"

style_cards = Read({base_path}/style-extraction/style-cards.json)
style_card = style_cards.style_cards[0]

design_tokens = style_card.proposed_tokens
philosophy = style_card.design_philosophy
style_name = style_card.name

# Write design-tokens.json directly
Write({base_path}/style-consolidation/style-1/design-tokens.json, JSON.stringify(design_tokens, null, 2))

# Create minimal style-guide.md
Write({base_path}/style-consolidation/style-1/style-guide.md):
# Design System: {style_name}

## Design Philosophy
{philosophy}

## Description
{style_card.description}

## Design Tokens
All tokens in `design-tokens.json` follow OKLCH color space.

**Key Colors**: Primary: {design_tokens.colors.brand.primary} | Background: {design_tokens.colors.surface.background} | Text: {design_tokens.colors.text.primary}

**Typography**: Heading: {design_tokens.typography.font_family.heading} | Body: {design_tokens.typography.font_family.body}

**Spacing Scale**: {design_tokens.spacing.keys().length} values

*Note: Generated in imitate mode for fast replication.*

REPORT: "✅ Tokens extracted and formatted | Style: {style_name} | Bypassed consolidate for {performance_gain}× speed"
```

### Phase 3: Single Prototype Generation

```bash
targets_string = ",".join(inferred_target_list)
type_emoji = "📄" IF target_type == "page" ELSE "🧩"
type_label = "page(s)" IF target_type == "page" ELSE "component(s)"

command = "/workflow:ui-design:generate --base-path \"{base_path}\" --targets \"{targets_string}\" --target-type \"{target_type}\" --style-variants 1 --layout-variants 1"

REPORT: "🚀 Phase 3: Generating {len(inferred_target_list)} {type_label}"
REPORT: "   {type_emoji} Targets: {targets_string} | Mode: 1×1 (imitation-optimized)"

SlashCommand(command)  # → Phase 4

# Output: Prototypes: {target}-style-1-layout-1.html, Total: len(inferred_target_list), Type: {target_type}
```

### Phase 4: Design System Integration

```bash
IF --session:
    SlashCommand("/workflow:ui-design:update --session {session_id}")  # → Complete
ELSE:
    REPORT: "ℹ️ Standalone mode: Skipping integration | Prototypes at: {base_path}/prototypes/"
    # → Complete (standalone)
```

## TodoWrite Pattern

```javascript
// Initialize
TodoWrite({todos: [
  {"content": "Initialize run directory and infer targets", "status": "in_progress", "activeForm": "Initializing"},
  {"content": "Capture screenshots from URL (if provided)", "status": "pending", "activeForm": "Capturing screenshots"},
  {"content": "Extract single design style from reference", "status": "pending", "activeForm": "Extracting style"},
  {"content": "Adapt tokens (bypass consolidate)", "status": "pending", "activeForm": "Adapting tokens"},
  {"content": "Generate single-style prototypes", "status": "pending", "activeForm": "Generating prototypes"},
  {"content": "Integrate design system", "status": "pending", "activeForm": "Integrating design"}
]})

// Update after each phase: Mark current completed, next in_progress
```

## Error Handling

- **No reference source**: Error if neither `--url` nor `--images` provided
- **Screenshot capture failure**: Tries Playwright → Chrome → Manual upload (user uploads, skips, or aborts); gracefully handles missing tools
- **Invalid URL/images**: Report error, suggest alternative input
- **Token extraction failure**: Fallback to minimal default design system

## Performance Comparison

| Aspect | explore-auto | imitate-auto |
|--------|--------------|--------------|
| **Purpose** | Design exploration | Design replication |
| **Input** | Optional URL/images | **Required** URL or images |
| **Variants** | 1-5 styles × 1-5 layouts | Always 1 × 1 |
| **Consolidate** | Full consolidation | **Bypassed** (direct tokens) |
| **Speed** | Baseline | **~2-3× faster** |
| **Output** | Matrix (S×L×T) | Direct (1×1×T) |

**Performance Benefits**: Skipped consolidate (~30-60s saved), single variant, direct token mapping, streamlined decisions

## Example Execution Flows

### Example 1: URL with Auto-Screenshot (Pages)
```bash
/workflow:ui-design:imitate-auto --url "https://linear.app" --targets "home,features,pricing"

# Flow: 0 (3 pages) → 0.5 (Playwright captures) → 1 (single style) → 2 (direct tokens ~2s vs ~45s) → 3 (3 prototypes) → 4
# Time: ~2-3 min (vs 5-7 min with explore-auto)
```

### Example 2: Images with Guidance (Page Mode)
```bash
/workflow:ui-design:imitate-auto --images "refs/dark-theme.png" --prompt "Focus on dark mode" --targets "dashboard"

# Flow: 0 → 0.5 (skip) → 1 → 2 → 3 → 4
# Output: dashboard-style-1-layout-1.html | Type: page (full-page layout)
```

### Example 3: Component Mode
```bash
/workflow:ui-design:imitate-auto --url "https://example.com" --targets "navbar,hero,card" --target-type "component"

# Flow: 0 → 0.5 → 1 → 2 → 3 → 4
# Output: navbar/hero/card-style-1-layout-1.html | Type: component (minimal wrapper)
```

### Example 4: URL with Manual Screenshot
```bash
/workflow:ui-design:imitate-auto --url "https://stripe.com/pricing" --targets "pricing"

# 0.5: Playwright failed → Chrome failed → User prompted → types 'ready' → ✅ continues OR 'skip' → ⚠️ URL only
# Continues: 1 → 2 → 3 → 4
```

## Completion Output

```
✅ UI Design Imitation Complete!

Mode: Single Style Replication | Run ID: {run_id} | Session: {session_id or "standalone"} | Reference: {url OR images} | Type: {type_emoji} {type_label}

Phase 0 - Initialization: {target_count} {target_type}(s) prepared
Phase 0.5 - Screenshot Capture: {screenshot_status}
  {IF success: ✅ Captured via {method} | ELSE: ⚠️ URL analysis only}
Phase 1 - Style Extraction: Single style extracted
Phase 2 - Token Adaptation: Bypassed consolidate (⚡ {time_saved}s saved)
Phase 3 - Prototype Generation: {target_count} {target_type} prototypes created
Phase 4 - Design Integration: {integrated OR "Standalone mode"}

📂 Output: {base_path}/
  ├── style-extraction/style-cards.json (1 style card)
  ├── style-consolidation/style-1/ (design tokens)
  └── prototypes/ ({target_count} HTML/CSS files)

🌐 Preview: {base_path}/prototypes/index.html

{type_emoji} Targets: {', '.join(inferred_target_list)} | Type: {target_type}
  Context: {IF target_type == "page": "Full-page layouts" ELSE: "Isolated components with minimal wrapper"}

Performance:
- Design system: ~{time}s (vs ~{consolidate_time}s with consolidate)
- Total workflow: ~{total_time}s
- Speed improvement: ~{improvement}× faster than explore-auto

{IF session: Next: /workflow:plan to create implementation tasks | ELSE: Prototypes ready: {base_path}/prototypes/}
```
