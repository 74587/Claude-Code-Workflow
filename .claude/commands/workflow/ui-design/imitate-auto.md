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

## Overview & Philosophy

**Fast-track UI imitation workflow**: Replicates a single design style from reference source (URL or images), bypassing exploration and consolidation phases for maximum speed (~2-3× faster than explore-auto).

**Core Philosophy**:
- **Imitation over Exploration**: Focus on replicating specific design, not generating variants
- **Single Mode**: Always 1 style × 1 layout × N pages
- **Speed Optimized**: Bypasses `consolidate` step via direct token extraction
- **Reference-Driven**: Requires URL or images as primary input
- **Auto-Screenshot**: Supports Playwright/Chrome with manual upload fallback

**Streamlined Flow**:
1. User triggers → Phase 0 (initialization) → Phase 0.5 (screenshot capture) → Phase 1 (style extraction) → Phase 2 (token adaptation) → Phase 3 (prototype generation) → Phase 4 (integration) → Complete

**Performance**: ~2-3× faster than explore-auto for single-style scenarios

**Ideal For**: MVP development, high-fidelity prototyping, design replication, studying successful patterns
**Not For**: Design exploration, generating multiple alternatives, novel design creation

## Core Rules

1. **Start Immediately**: TodoWrite initialization → Phase 0 execution
2. **No Multi-Variant**: Always 1 style × 1 layout × N pages
3. **Reference Required**: Must provide `--url` OR `--images`
4. **Auto-Continue**: Automatic phase progression without pausing
5. **Track Progress**: Update TodoWrite after each phase

## Parameter Requirements

**Required** (at least one):
- `--url "<url>"`: Website URL to imitate (e.g., "https://linear.app")
- `--images "<glob>"`: Local reference images (e.g., "refs/*.png")

**Optional**:
- `--pages "<list>"`: Pages to generate (default: "home")
- `--session <id>"`: Workflow session ID (standalone if omitted)
- `--prompt "<desc>"`: Additional design guidance (e.g., "Focus on dark mode")

**Not Supported**:
- `--style-variants`: Always 1 (single style)
- `--layout-variants`: Always 1 (single layout)
- `--batch-plan`: Not supported in imitate mode

## 5-Phase Execution

### Phase 0: Simplified Initialization
```bash
# Generate run ID and determine base path
run_id = "run-$(date +%Y%m%d-%H%M%S)"

IF --session:
    base_path = ".workflow/WFS-{session_id}/design-${run_id}"
ELSE:
    base_path = ".workflow/.design/${run_id}"

# Create directories (simpler than explore-auto)
Bash(mkdir -p "${base_path}/{style-extraction,style-consolidation/style-1,prototypes}")

# Initialize metadata
Write({base_path}/.run-metadata.json): {
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
    page_list = split_and_clean({--pages value}, [",", ";", "、"])
    page_list = [p.strip().lower().replace(" ", "-") for p in page_list if p.strip()]
    page_source = "explicit"
ELSE IF --prompt provided:
    # Extract from prompt: "for dashboard and settings" or "pages: home, about"
    page_list = extract_pages_from_prompt(prompt_text)
    page_source = "prompt_inferred"
    IF NOT page_list:
        page_list = ["home"]
ELSE:
    page_list = ["home"]
    page_source = "default"

# Validate page names
validated_pages = []
FOR page IN page_list:
    cleaned = page.strip().lower().replace(" ", "-")
    IF regex_match(cleaned, r"^[a-z0-9][a-z0-9_-]*$"):
        validated_pages.append(cleaned)

IF NOT validated_pages:
    validated_pages = ["home"]

REPORT: "📋 Imitate mode: {len(validated_pages)} pages with single style"
REPORT: "   Pages: {', '.join(validated_pages)}"
REPORT: "   Reference: {url_value OR images_pattern}"

STORE: run_id, base_path, inferred_page_list = validated_pages
```

---

### Phase 0.5: URL Screenshot Capture (Auto-Fallback)

**Condition**: Only if `--url` provided

**Execution**:
```bash
IF --url provided:
    REPORT: "📸 Phase 0.5: Capturing screenshots..."
    screenshot_dir = "{base_path}/screenshots"
    Bash(mkdir -p "{screenshot_dir}")

    screenshot_success = false
    screenshot_files = []

    # Method 1: Playwright CLI (preferred)
    TRY:
        REPORT: "   Attempting Playwright..."
        Bash(npx playwright screenshot "{url_value}" "{screenshot_dir}/full-page.png" --full-page --timeout 30000)
        screenshot_files.append("{screenshot_dir}/full-page.png")
        screenshot_success = true
        REPORT: "   ✅ Playwright screenshot captured"
    CATCH:
        REPORT: "   ⚠️ Playwright failed"

    # Method 2: Chrome DevTools (fallback)
    IF NOT screenshot_success:
        TRY:
            REPORT: "   Attempting Chrome headless..."
            Bash(google-chrome --headless --disable-gpu --screenshot="{screenshot_dir}/full-page.png" --window-size=1920,1080 "{url_value}")
            screenshot_files.append("{screenshot_dir}/full-page.png")
            screenshot_success = true
            REPORT: "   ✅ Chrome screenshot captured"
        CATCH:
            REPORT: "   ⚠️ Chrome failed"

    # Manual upload fallback
    IF NOT screenshot_success:
        REPORT: ""
        REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        REPORT: "⚠️  AUTOMATED SCREENSHOT FAILED"
        REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        REPORT: "Unable to capture: {url_value}"
        REPORT: ""
        REPORT: "Manual screenshot required:"
        REPORT: "  1. Visit: {url_value}"
        REPORT: "  2. Take full-page screenshot"
        REPORT: "  3. Save to: {screenshot_dir}/"
        REPORT: ""
        REPORT: "Options:"
        REPORT: "  • 'ready' - screenshot saved"
        REPORT: "  • 'skip' - use URL analysis only"
        REPORT: "  • 'abort' - cancel workflow"
        REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        user_response = WAIT_FOR_USER_INPUT()

        IF user_response MATCHES r"^(ready|done|ok)$":
            screenshot_files = Glob("{screenshot_dir}/*.{png,jpg,jpeg}")
            IF screenshot_files:
                screenshot_success = true
                REPORT: "✅ Manual screenshot detected"
            ELSE:
                REPORT: "❌ No screenshot found, using URL analysis only"
        ELSE IF user_response MATCHES r"^skip$":
            REPORT: "⏭️  Skipping screenshot, using URL analysis"
        ELSE IF user_response MATCHES r"^abort$":
            ERROR: "Workflow aborted by user"
            EXIT
        ELSE:
            REPORT: "⚠️ Invalid input, proceeding with URL analysis"

    # Store results
    IF screenshot_success:
        STORE: screenshot_mode = "with_screenshots", screenshot_paths = screenshot_files
        REPORT: "✅ Screenshot capture complete: {len(screenshot_files)} image(s)"
    ELSE:
        STORE: screenshot_mode = "url_only", screenshot_paths = []
        REPORT: "ℹ️  Proceeding with URL analysis only"
ELSE:
    STORE: screenshot_mode = "manual_images", screenshot_paths = []
    REPORT: "ℹ️  Using provided images (--images parameter)"
```

**Auto-Continue**: On completion → Phase 1

---

### Phase 1: Single Style Extraction

**Command**:
```bash
# Determine input based on screenshot capture
IF screenshot_mode == "with_screenshots":
    screenshot_glob = "{base_path}/screenshots/*.{png,jpg,jpeg}"
    images_flag = "--images \"{screenshot_glob}\""
    url_flag = ""
    source_desc = "captured screenshots from {url_value}"
ELSE IF screenshot_mode == "url_only":
    url_flag = "--url \"{url_value}\""
    images_flag = ""
    source_desc = "URL analysis of {url_value}"
ELSE IF screenshot_mode == "manual_images":
    images_flag = --images present ? "--images \"{image_glob}\"" : ""
    url_flag = ""
    source_desc = "user-provided images"

prompt_flag = --prompt present ? "--prompt \"{prompt_text}\"" : ""
run_base_flag = "--base-path \"{base_path}\""

# Construct optimized extraction prompt
enhanced_prompt = "Extract a single, high-fidelity design system that accurately imitates the visual style from {source_desc}. {prompt_text}"

# Force single variant
command = "/workflow:ui-design:extract {run_base_flag} {url_flag} {images_flag} --prompt \"{enhanced_prompt}\" --variants 1"

REPORT: "🚀 Phase 1: Style Extraction"
REPORT: "   Source: {source_desc}"
REPORT: "   Mode: Single style (imitation-optimized)"

SlashCommand(command)
```
**Auto-Continue**: On completion → Phase 2

---

### Phase 2: Fast Token Adaptation (Bypass Consolidate)

**Action**: Direct extraction of design tokens, bypassing heavy `consolidate` step

**Execution**:
```bash
REPORT: "🚀 Phase 2: Fast token adaptation (bypassing consolidate)"

# Read single style card
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

**Key Colors**:
- Primary: {design_tokens.colors.brand.primary}
- Background: {design_tokens.colors.surface.background}
- Text: {design_tokens.colors.text.primary}

**Typography**:
- Heading: {design_tokens.typography.font_family.heading}
- Body: {design_tokens.typography.font_family.body}

**Spacing Scale**: {design_tokens.spacing.keys().length} values

*Note: Generated in imitate mode for fast replication.*

REPORT: "✅ Tokens extracted and formatted"
REPORT: "   Style: {style_name}"
REPORT: "   Bypassed consolidate for {performance_gain}× speed"
```

**Auto-Continue**: On completion → Phase 3

---

### Phase 3: Single Prototype Generation

**Command**:
```bash
run_base_flag = "--base-path \"{base_path}\""
pages_string = ",".join(inferred_page_list)
pages_flag = "--pages \"{pages_string}\""

# Force 1×1 mode
command = "/workflow:ui-design:generate {run_base_flag} {pages_flag} --style-variants 1 --layout-variants 1"

REPORT: "🚀 Phase 3: Generating {len(inferred_page_list)} prototype(s)"
REPORT: "   Mode: 1×1 (imitation-optimized)"

SlashCommand(command)
```

**Result**:
- Prototypes: `{page}-style-1-layout-1.html`
- Total: `len(inferred_page_list)`

**Auto-Continue**: On completion → Phase 4

---

### Phase 4: Design System Integration

**Command**:
```bash
IF --session:
    session_flag = "--session {session_id}"
    command = "/workflow:ui-design:update {session_flag}"
    SlashCommand(command)
ELSE:
    REPORT: "ℹ️ Standalone mode: Skipping integration"
    REPORT: "   Prototypes at: {base_path}/prototypes/"
```

**Completion**: Workflow complete

## TodoWrite Pattern

```javascript
// Initialize
TodoWrite({todos: [
  {"content": "Initialize run directory and infer pages", "status": "in_progress", "activeForm": "Initializing"},
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
- **Screenshot capture failure**:
  - Tries 2 methods: Playwright → Chrome DevTools
  - Falls back to manual upload: user uploads screenshot, skips, or aborts
  - Gracefully handles missing Playwright/Chrome
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
| **Output** | Matrix (S×L×P) | Direct (1×1×P) |
| **Phases** | 6 phases | 5 phases |

**Performance Benefits**:
1. **Skipped consolidate**: Saves ~30-60s (most expensive phase)
2. **Single variant**: Reduces extraction complexity
3. **Direct token mapping**: Simple file ops vs AI synthesis
4. **Streamlined decisions**: No variant selection/confirmation

## Example Execution Flows

### Example 1: URL with Auto-Screenshot
```bash
/workflow:ui-design:imitate-auto --url "https://linear.app" --pages "home,features,pricing"

# Flow:
# 0. Init: 3 pages identified
# 0.5. Screenshot: Playwright captures linear.app
# 1. Extract: Single style from screenshot
# 2. Adapt: Direct tokens (~2s vs consolidate's ~45s)
# 3. Generate: 3 prototypes
# 4. Complete
# Time: ~2-3 min (vs 5-7 min with explore-auto)
```

### Example 2: Images with Guidance
```bash
/workflow:ui-design:imitate-auto --images "refs/dark-theme.png" --prompt "Focus on dark mode" --pages "dashboard"

# Flow: 0 → 0.5 (skip) → 1 → 2 → 3 → 4
# Output: dashboard-style-1-layout-1.html
```

### Example 3: URL with Manual Screenshot
```bash
/workflow:ui-design:imitate-auto --url "https://stripe.com/pricing" --pages "pricing"

# 0.5. Screenshot:
#      ⚠️ Playwright failed → Chrome failed
#      📸 User prompted for manual upload
#      User saves screenshot → types 'ready' → ✅ continues
#      OR types 'skip' → ⚠️ uses URL analysis only
# Continues: 1 → 2 → 3 → 4
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
  {IF success: ✅ Captured via {method}}
  {ELSE: ⚠️ URL analysis only}
Phase 1 - Style Extraction: Single style extracted
Phase 2 - Token Adaptation: Bypassed consolidate (⚡ {time_saved}s saved)
Phase 3 - Prototype Generation: {page_count} prototypes created
Phase 4 - Design Integration: {integrated OR "Standalone mode"}

📂 Output: {base_path}/
  ├── style-extraction/style-cards.json (1 style card)
  ├── style-consolidation/style-1/ (design tokens)
  └── prototypes/ ({page_count} HTML/CSS files)

🌐 Preview: {base_path}/prototypes/index.html

Performance:
- Design system: ~{time}s (vs ~{consolidate_time}s with consolidate)
- Total workflow: ~{total_time}s
- Speed improvement: ~{improvement}× faster than explore-auto

{IF session:
Next: /workflow:plan to create implementation tasks
}
{ELSE:
Prototypes ready: {base_path}/prototypes/
}
```
