---
name: imitate-auto
description: Imitation-focused UI design workflow - Rapidly replicate a single design style from URL or images (skip exploration, direct to implementation)
usage: /workflow:ui-design:imitate-auto [--url "<url>"] [--images "<glob>"] [--prompt "<desc>"] [--pages "<list>"] [--session <id>]
argument-hint: "[--url \"https://example.com\"] [--images \"refs/*.png\"] [--prompt \"Imitate dark mode style\"] [--pages \"dashboard,settings\"]"
examples:
  - /workflow:ui-design:imitate-auto --url "https://linear.app" --pages "home,features,pricing"
  - /workflow:ui-design:imitate-auto --images "refs/design.png" --prompt "Imitate this minimalist design for dashboard and settings"
  - /workflow:ui-design:imitate-auto --url "https://stripe.com" --session WFS-payment
  - /workflow:ui-design:imitate-auto --images "refs/*.png" --pages "home"
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*), Glob(*), Write(*)
---

# UI Design Imitate-Auto Workflow Command

## Overview
Fast-track UI design workflow optimized for **imitating a single design style** from a reference source (URL or images). This command skips the exploration and consolidation phases, directly generating production-ready prototypes based on the provided reference.

## Core Philosophy
- **Imitation over Exploration**: Focus on replicating a specific design, not generating variants
- **Single Style**: Always generates one design system (no style matrix)
- **Single Layout**: Generates one layout per page (no layout exploration)
- **Speed Optimized**: Skips `consolidate` step, uses direct token extraction
- **Reference-Driven**: Requires URL or images as primary input source

## Execution Model - Streamlined Workflow

This workflow is optimized for speed and simplicity:

1. **User triggers**: `/workflow:ui-design:imitate-auto --url "..." --pages "..."`
2. **Phase 0 executes** (simplified initialization) → Auto-continues
3. **Phase 0.5 executes** (URL screenshot capture with auto-fallback) → Auto-continues
4. **Phase 1 executes** (single style extraction, forced --variants 1) → Auto-continues
5. **Phase 2 executes** (fast token adaptation, bypasses consolidate) → Auto-continues
6. **Phase 3 executes** (single prototype generation, forced 1×1 mode) → Auto-continues
7. **Phase 4 executes** (design integration) → Complete

**Performance**: ~2-3× faster than `explore-auto` for single-style scenarios
**Screenshot Automation**: Supports Playwright and Chrome DevTools with manual upload fallback

## Core Rules

1. **Start Immediately**: First action is `TodoWrite` initialization, second action is Phase 0 execution
2. **No Multi-Variant**: Always generates exactly 1 style × 1 layout × N pages
3. **Reference Required**: Must provide `--url` OR `--images` (at least one)
4. **Auto-Continue**: After each phase, automatically proceed to the next without pausing
5. **Track Progress**: Update `TodoWrite` after every phase completion

## Parameter Requirements

**Required Parameters** (at least one):
- `--url "<url>"`: Website URL to imitate (e.g., "https://linear.app")
- `--images "<glob_pattern>"`: Local reference images (e.g., "refs/*.png")

**Optional Parameters**:
- `--pages "<page_list>"`: Pages to generate (default: "home")
- `--session <session_id>"`: Workflow session ID for integration (optional, standalone if omitted)
- `--prompt "<description>"`: Additional design guidance (e.g., "Focus on dark mode", "Imitate card-based layout")

**Removed Parameters** (not supported):
- `--style-variants`: Always 1 (single style focus)
- `--layout-variants`: Always 1 (single layout focus)
- `--batch-plan`: Not supported in imitate mode

## 5-Phase Execution

### Phase 0: Simplified Initialization

```bash
# Generate run ID with timestamp
run_id = "run-$(date +%Y%m%d-%H%M%S)"

# Determine base path
IF --session:
    session_id = {provided_session}
    base_path = ".workflow/WFS-{session_id}/runs/${run_id}"
ELSE:
    # Standalone mode: use scratchpad
    session_id = "imitate-session-$(date +%Y%m%d-%H%M%S)"
    base_path = ".workflow/.scratchpad/${session_id}/runs/${run_id}"

# Create run directory structure (simpler than explore-auto)
Bash(mkdir -p "${base_path}/.design/style-extraction")
Bash(mkdir -p "${base_path}/.design/style-consolidation/style-1")
Bash(mkdir -p "${base_path}/.design/prototypes")

# Initialize run metadata
Write({base_path}/.run-metadata.json):
{
  "run_id": "${run_id}",
  "session_id": "${session_id}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "workflow": "ui-design:imitate-auto",
  "mode": "single_style_imitation",
  "parameters": {
    "url": "${url_value}",
    "images": "${images_pattern}",
    "pages": "${inferred_page_list}",
    "prompt": "${prompt_text}"
  },
  "status": "in_progress"
}

# Page inference (simplified, no interactive confirmation)
IF --pages provided:
    page_list = split_and_clean({--pages value}, delimiters=[",", ";", "、"])
    page_list = [p.strip().lower().replace(" ", "-") for p in page_list if p.strip()]
    page_source = "explicit"
ELSE IF --prompt provided:
    # Simple extraction from prompt
    # Look for patterns like "for dashboard and settings" or "pages: home, about"
    page_list = extract_pages_from_prompt(prompt_text)
    page_source = "prompt_inferred"
    IF NOT page_list:
        page_list = ["home"]
        page_source = "default"
ELSE:
    page_list = ["home"]
    page_source = "default"

# Validate page names
validated_pages = []
FOR page IN page_list:
    cleaned_page = page.strip().lower().replace(" ", "-")
    IF regex_match(cleaned_page, r"^[a-z0-9][a-z0-9_-]*$"):
        validated_pages.append(cleaned_page)

IF NOT validated_pages:
    validated_pages = ["home"]

REPORT: "📋 Imitate mode: Generating {len(validated_pages)} pages with single style"
REPORT: "   Pages: {', '.join(validated_pages)}"
REPORT: "   Reference: {url_value OR images_pattern}"

STORE: run_id, base_path, inferred_page_list = validated_pages
```

---

### Phase 0.5: URL Screenshot Capture (Auto-Fallback)

**Condition**: Only executes if `--url` is provided

**Purpose**: Automatically capture screenshots from the URL to ensure visual reference is available for style extraction. If automated capture fails, prompts user to provide manual screenshots.

**Execution**:
```bash
IF --url provided:
    REPORT: "📸 Phase 0.5: Capturing screenshots from URL..."

    # Create screenshots directory
    screenshot_dir = "{base_path}/.design/screenshots"
    Bash(mkdir -p "{screenshot_dir}")

    # Try automated screenshot methods
    screenshot_success = false
    screenshot_files = []

    # Method 1: Playwright CLI (preferred, if available)
    TRY:
        REPORT: "   Attempting Playwright screenshot..."
        Bash(
          npx playwright screenshot "{url_value}" "{screenshot_dir}/full-page.png" --full-page --timeout 30000
        )
        screenshot_files.append("{screenshot_dir}/full-page.png")
        screenshot_success = true
        REPORT: "   ✅ Playwright screenshot captured"
    CATCH:
        REPORT: "   ⚠️ Playwright not available or failed"

    # Method 2: Chrome DevTools Protocol (fallback)
    IF NOT screenshot_success:
        TRY:
            REPORT: "   Attempting Chrome headless screenshot..."
            Bash(
              google-chrome --headless --disable-gpu --screenshot="{screenshot_dir}/full-page.png" --window-size=1920,1080 "{url_value}"
            )
            screenshot_files.append("{screenshot_dir}/full-page.png")
            screenshot_success = true
            REPORT: "   ✅ Chrome headless screenshot captured"
        CATCH:
            REPORT: "   ⚠️ Chrome headless not available or failed"

    # If both automated methods fail, prompt user for manual screenshot
    IF NOT screenshot_success:
        REPORT: ""
        REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        REPORT: "⚠️  AUTOMATED SCREENSHOT FAILED"
        REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        REPORT: "Unable to automatically capture screenshot from: {url_value}"
        REPORT: ""
        REPORT: "Please provide a manual screenshot:"
        REPORT: "  1. Visit the URL in your browser: {url_value}"
        REPORT: "  2. Take a full-page screenshot"
        REPORT: "  3. Save it to: {screenshot_dir}/"
        REPORT: ""
        REPORT: "Options:"
        REPORT: "  • Type 'ready' when screenshot is saved"
        REPORT: "  • Type 'skip' to use URL analysis only (lower quality)"
        REPORT: "  • Type 'abort' to cancel the workflow"
        REPORT: ""
        REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        # Wait for user input
        user_response = WAIT_FOR_USER_INPUT()

        IF user_response MATCHES r"^(ready|done|ok)$":
            # Check if user provided screenshot
            screenshot_files = Glob("{screenshot_dir}/*.{png,jpg,jpeg}")
            IF screenshot_files:
                screenshot_success = true
                REPORT: "✅ Manual screenshot detected: {', '.join(screenshot_files)}"
            ELSE:
                REPORT: "❌ No screenshot found in {screenshot_dir}/"
                REPORT: "   Workflow will use URL analysis only (may result in lower quality)"
        ELSE IF user_response MATCHES r"^skip$":
            REPORT: "⏭️  Skipping screenshot, using URL analysis only"
            screenshot_success = false
        ELSE IF user_response MATCHES r"^abort$":
            ERROR: "Workflow aborted by user"
            EXIT
        ELSE:
            REPORT: "⚠️ Invalid input, proceeding with URL analysis only"
            screenshot_success = false

    # Store screenshot info for Phase 1
    IF screenshot_success:
        STORE: screenshot_mode = "with_screenshots"
        STORE: screenshot_paths = screenshot_files
        REPORT: "✅ Screenshot capture complete: {len(screenshot_files)} image(s)"
    ELSE:
        STORE: screenshot_mode = "url_only"
        STORE: screenshot_paths = []
        REPORT: "ℹ️  Proceeding with URL analysis only (no screenshots)"
ELSE:
    # No URL provided, must use --images
    STORE: screenshot_mode = "manual_images"
    STORE: screenshot_paths = []
    REPORT: "ℹ️  Using provided images (--images parameter)"
```

**Auto-Continue**: On completion, proceeds to Phase 1

---

### Phase 1: Single Style Extraction

**Command Construction**:
```bash
# Determine input flags based on screenshot capture results
IF screenshot_mode == "with_screenshots":
    # Use captured screenshots instead of URL
    screenshot_glob = "{base_path}/.design/screenshots/*.{png,jpg,jpeg}"
    images_flag = "--images \"{screenshot_glob}\""
    url_flag = ""
    source_desc = "captured screenshots from {url_value}"
ELSE IF screenshot_mode == "url_only":
    # Use URL directly (Claude can analyze URLs)
    url_flag = "--url \"{url_value}\""
    images_flag = ""
    source_desc = "URL analysis of {url_value}"
ELSE IF screenshot_mode == "manual_images":
    # Use user-provided images
    images_flag = --images present ? "--images \"{image_glob}\"" : ""
    url_flag = ""
    source_desc = "user-provided images"
ELSE:
    # Fallback
    url_flag = --url present ? "--url \"{url_value}\"" : ""
    images_flag = --images present ? "--images \"{image_glob}\"" : ""
    source_desc = "provided references"

# Add user prompt if provided
prompt_flag = --prompt present ? "--prompt \"{prompt_text}\"" : ""

# Use run-scoped base path and FORCE --variants 1
run_base_flag = "--base-path \"{base_path}/.design\""

# Construct optimized extraction prompt for imitation
enhanced_prompt = "Extract a single, high-fidelity design system that accurately imitates the visual style from {source_desc}. {prompt_text}"

# Force single variant extraction
command = "/workflow:ui-design:extract {run_base_flag} {url_flag} {images_flag} --prompt \"{enhanced_prompt}\" --variants 1"

REPORT: "🚀 Executing Phase 1: Style Extraction"
REPORT: "   Source: {source_desc}"
REPORT: "   Mode: Single style (imitation-optimized)"

SlashCommand(command=command)
```
**Auto-Continue**: On completion, proceeds to Phase 2

---

### Phase 2: Fast Token Adaptation (Bypass Consolidate)

**Action**: Direct extraction of design tokens from the single style card, bypassing the heavy `consolidate` step

**Execution**:
```bash
REPORT: "🚀 Phase 2: Fast token adaptation (bypassing consolidate for speed)"

# Read the single style card from extraction output
style_cards = Read({base_path}/.design/style-extraction/style-cards.json)
style_card = style_cards.style_cards[0]  # Only one card in imitate mode

# Extract components
design_tokens = style_card.proposed_tokens
philosophy = style_card.design_philosophy
style_name = style_card.name

# Create minimal design system structure (generate needs this)
# Write design-tokens.json directly from proposed_tokens
Write({base_path}/.design/style-consolidation/style-1/design-tokens.json, JSON.stringify(design_tokens, null, 2))

# Create minimal style-guide.md (simpler than consolidate output)
Write({base_path}/.design/style-consolidation/style-1/style-guide.md):
# Design System: {style_name}

## Design Philosophy
{philosophy}

## Description
{style_card.description}

## Design Tokens
All design tokens are defined in `design-tokens.json` and follow the OKLCH color space standard.

**Key Colors**:
- Primary: {design_tokens.colors.brand.primary}
- Background: {design_tokens.colors.surface.background}
- Text: {design_tokens.colors.text.primary}

**Typography**:
- Heading Font: {design_tokens.typography.font_family.heading}
- Body Font: {design_tokens.typography.font_family.body}

**Spacing Scale**: {design_tokens.spacing.keys().length} values

**Note**: This design system was generated in imitate mode, optimized for fast replication of the reference source.

# Create minimal tailwind.config.js (optional, for convenience)
Write({base_path}/.design/style-consolidation/style-1/tailwind.config.js):
module.exports = {
  theme: {
    extend: {
      colors: ${JSON.stringify(design_tokens.colors, null, 6)},
      fontFamily: ${JSON.stringify(design_tokens.typography.font_family, null, 6)},
      spacing: ${JSON.stringify(design_tokens.spacing, null, 6)},
      borderRadius: ${JSON.stringify(design_tokens.border_radius, null, 6)},
    }
  }
}

REPORT: "✅ Design tokens extracted and formatted"
REPORT: "   Style: {style_name}"
REPORT: "   Bypassed consolidate step for {performance_gain}× speed improvement"
```

**Auto-Continue**: On completion, proceeds to Phase 3

---

### Phase 3: Single Prototype Generation

**Command Construction**:
```bash
run_base_flag = "--base-path \"{base_path}/.design\""
pages_string = ",".join(inferred_page_list)
pages_flag = "--pages \"{pages_string}\""

# Force single style and single layout
command = "/workflow:ui-design:generate {run_base_flag} {pages_flag} --style-variants 1 --layout-variants 1"

REPORT: "🚀 Executing Phase 3: Generating {len(inferred_page_list)} prototype(s)"
REPORT: "   Mode: Single style × Single layout (optimized for imitation)"

SlashCommand(command=command)
```

**Result**: Generates `1 × 1 × N` prototypes (where N = number of pages)
- File naming: `{page}-style-1-layout-1.html`
- Total prototypes: `len(inferred_page_list)`

**Auto-Continue**: On completion, proceeds to Phase 4

---

### Phase 4: Design System Integration

**Command Construction**:
```bash
IF --session:
    session_flag = "--session {session_id}"
    command = "/workflow:ui-design:update {session_flag}"
    SlashCommand(command=command)
ELSE:
    REPORT: "ℹ️ Standalone mode: Skipping design system integration (no session provided)"
    REPORT: "   Prototypes available at: {base_path}/.design/prototypes/"
```

**Completion**: Workflow is now complete

## TodoWrite Pattern

```javascript
// Initialize (before Phase 0)
TodoWrite({todos: [
  {"content": "Initialize run directory and infer pages", "status": "in_progress", "activeForm": "Initializing"},
  {"content": "Capture screenshots from URL (if provided)", "status": "pending", "activeForm": "Capturing screenshots"},
  {"content": "Extract single design style from reference", "status": "pending", "activeForm": "Extracting style"},
  {"content": "Adapt tokens (bypass consolidate)", "status": "pending", "activeForm": "Adapting tokens"},
  {"content": "Generate single-style prototypes", "status": "pending", "activeForm": "Generating prototypes"},
  {"content": "Integrate design system", "status": "pending", "activeForm": "Integrating design"}
]})

// Update after each phase...
```

## Error Handling

- **No reference source**: Error if neither `--url` nor `--images` provided
- **Screenshot capture failure**:
  - Tries 2 automated methods in sequence: Playwright → Chrome DevTools
  - Falls back to manual screenshot upload if both fail
  - User can choose: upload manual screenshot, skip screenshots, or abort
- **Invalid URL**: Report URL fetch failure, suggest using `--images` instead
- **Missing images**: Report glob pattern error, suggest checking file paths
- **Token extraction failure**: Fallback to a minimal default design system
- **Playwright/Chrome not installed**: Gracefully prompts user to upload manual screenshot

## Key Differences from explore-auto

| Aspect | explore-auto | imitate-auto |
|--------|--------------|--------------|
| **Purpose** | Explore multiple design options | Replicate specific design |
| **Input** | Optional URL/images | **Required** URL or images |
| **Variants** | 1-5 styles × 1-5 layouts | Always 1 × 1 (single) |
| **Consolidate** | Full consolidation with validation | **Bypassed** (direct token extraction) |
| **Speed** | Baseline | **~2-3× faster** |
| **Output** | Design matrix (S×L×P prototypes) | Direct prototypes (1×1×P) |
| **Use Case** | Design exploration, need options | Fast prototyping, have reference |

## Performance Benefits

1. **Skipped consolidate**: Saves ~30-60s per run (most expensive phase)
2. **Single variant**: Reduces extraction complexity
3. **Direct token mapping**: Simple file operations vs AI synthesis
4. **Streamlined decisions**: No variant selection or confirmation needed

## Workflow Position

This workflow is ideal for:
- **MVP Development**: Quickly create UI based on a competitor or design reference
- **High-Fidelity Prototyping**: Convert designs to code rapidly
- **Design Replication**: Imitate specific visual styles from existing sites
- **Learning**: Study and recreate successful design patterns

**NOT ideal for**:
- Generating multiple design alternatives
- Design exploration without clear reference
- Creating completely novel designs

## Example Execution Flows

### Example 1: Imitate from URL (with Auto-Screenshot)
```bash
/workflow:ui-design:imitate-auto --url "https://linear.app" --pages "home,features,pricing"

# Execution:
# 0. Initialize: 3 pages identified
# 0.5. Screenshot: Playwright captures full-page screenshot of linear.app
# 1. Extract: Single style from captured screenshot
# 2. Adapt: Direct token extraction (~2s vs consolidate's ~45s)
# 3. Generate: 3 prototypes (home, features, pricing)
# 4. Complete

# Total time: ~2-3 minutes (vs 5-7 minutes with explore-auto)
# Screenshot: Automatically saved to .design/screenshots/
```

### Example 2: Imitate from Images with Guidance
```bash
/workflow:ui-design:imitate-auto --images "refs/dark-theme.png" --prompt "Focus on dark mode color palette" --pages "dashboard"

# Execution:
# 0. Initialize: 1 page (dashboard)
# 0.5. Screenshot: Skipped (using provided images)
# 1. Extract: Single style from image, dark mode emphasis
# 2. Adapt: Direct token extraction
# 3. Generate: 1 prototype (dashboard-style-1-layout-1.html)
# 4. Complete (standalone mode, no integration)
```

### Example 3: URL with Manual Screenshot Upload
```bash
/workflow:ui-design:imitate-auto --url "https://stripe.com/pricing" --pages "pricing"

# Execution:
# 0. Initialize: 1 page (pricing)
# 0.5. Screenshot:
#      ⚠️ Playwright not available
#      ⚠️ Chrome headless not available
#      📸 Prompting user to upload manual screenshot...
#
#      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#      ⚠️  AUTOMATED SCREENSHOT FAILED
#      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#      Please provide a manual screenshot:
#        1. Visit: https://stripe.com/pricing
#        2. Take a full-page screenshot
#        3. Save to: .design/screenshots/
#
#      Options:
#        • Type 'ready' when screenshot is saved
#        • Type 'skip' to use URL analysis only
#        • Type 'abort' to cancel
#
#      User saves screenshot and types 'ready' → ✅ Workflow continues
#      OR
#      User types 'skip' → ⚠️ Uses URL analysis only
# 1. Extract: Single style from screenshot or URL
# 2. Adapt: Direct token extraction
# 3. Generate: 1 prototype
# 4. Complete
```

## Final Completion Message

```
✅ UI Design Imitation Complete!

Mode: Single Style Replication
Run ID: {run_id}
Session: {session_id or "standalone"}
Reference: {url OR images}

Phase 0 - Initialization: {page_count} pages prepared
Phase 0.5 - Screenshot Capture: {screenshot_status}
  {IF screenshot_success: ✅ Screenshot captured via {method} (Playwright/Chrome/Manual)}
  {ELSE: ⚠️ Using URL analysis only}
Phase 1 - Style Extraction: Single design style extracted
Phase 2 - Token Adaptation: Bypassed consolidate (⚡ {time_saved}s saved)
Phase 3 - Prototype Generation: {page_count} prototypes created
Phase 4 - Design Integration: {integrated OR "Standalone mode - No integration"}

📂 Output: {base_path}/.design/
  ├── style-extraction/style-cards.json (1 style card)
  ├── style-consolidation/style-1/ (design tokens)
  └── prototypes/ ({page_count} HTML/CSS files)

🌐 Preview: Open {base_path}/.design/prototypes/index.html

Performance:
- Design system creation: ~{time}s (vs ~{consolidate_time}s with consolidate)
- Total workflow time: ~{total_time}s
- Speed improvement: ~{improvement}× faster than explore-auto

{IF session mode:
Next: /workflow:plan to create implementation tasks
}
{ELSE:
Prototypes ready for direct use at: {base_path}/.design/prototypes/
}
```
