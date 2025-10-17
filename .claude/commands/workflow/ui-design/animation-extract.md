---
name: animation-extract
description: Extract animation and transition patterns from URLs, CSS, or interactive questioning
argument-hint: "[--base-path <path>] [--session <id>] [--urls "<list>"] [--mode <auto|interactive>] [--focus "<types>"]"
allowed-tools: TodoWrite(*), Read(*), Write(*), Glob(*), Bash(*), Task(ui-design-agent), mcp__chrome-devtools__navigate_page(*), mcp__chrome-devtools__evaluate_script(*)
---

# Animation Extraction Command

## Overview

Extract animation and transition patterns from web pages using CSS extraction, visual analysis, or interactive questioning. This command generates production-ready animation tokens and guidelines that integrate with design systems.

**Strategy**: Hybrid Extraction with Interactive Fallback

- **Auto Mode (Priority 1)**: Extract from CSS via Chrome DevTools when URLs provided
- **Visual Mode (Priority 2)**: Analyze screenshots for motion cues (blur, position changes)
- **Interactive Mode (Priority 3)**: Guided questioning when extraction insufficient
- **Output**: `animation-tokens.json` + `animation-guide.md`

## Phase 0: Setup & Input Validation

### Step 1: Detect Input Mode & Base Path

```bash
# Detect input source
# Priority: --urls → url mode | --mode interactive → question mode

# Parse URLs if provided (format: "target:url,target:url,...")
IF --urls:
    url_list = []
    FOR pair IN split(--urls, ","):
        IF ":" IN pair:
            target, url = pair.split(":", 1)
            url_list.append({target: target.strip(), url: url.strip()})
        ELSE:
            url_list.append({target: "page", url: pair.strip()})

    has_urls = true
    primary_url = url_list[0].url
ELSE:
    has_urls = false

# Determine extraction mode
extraction_mode = --mode OR (has_urls ? "auto" : "interactive")

# Parse animation focus (if provided)
IF --focus:
    focus_types = split(--focus, ",")  # e.g., "transitions,hover,scroll"
ELSE:
    focus_types = ["all"]  # Extract all animation types

# Determine base path
bash(find .workflow -type d -name "design-*" | head -1)  # Auto-detect
# OR use --base-path / --session parameters
```

### Step 2: Load Design Tokens Context

```bash
# Load existing design tokens for duration/easing alignment
IF exists({base_path}/style-extraction/style-1/design-tokens.json):
    design_tokens = Read({base_path}/style-extraction/style-1/design-tokens.json)
    has_design_context = true
ELSE:
    has_design_context = false
    WARN: "⚠️ No design tokens found - animation tokens will use standalone values"

# Create output directory
bash(mkdir -p {base_path}/animation-extraction)
bash(mkdir -p {base_path}/.intermediates/animation-analysis)
```

---

**Phase 0 Output**: `extraction_mode`, `base_path`, `has_urls`, `url_list[]`, `focus_types[]`, `has_design_context`

## Phase 1: CSS Animation Extraction (Auto Mode - URL Required)

### Step 1: Check Extraction Mode

```bash
# extraction_mode == "interactive" → skip to Phase 2
# extraction_mode == "auto" AND has_urls → execute this phase
```

**If interactive mode**: Skip to Phase 2

### Step 2: Extract Computed Animations (Auto-Trigger)

```bash
# AUTO-TRIGGER: If URLs are available, automatically extract CSS animations/transitions

IF has_urls AND mcp_chrome_devtools_available:
    REPORT: "🔍 Auto-triggering URL mode: Extracting CSS animations and transitions"

    # Read extraction script
    script_content = Read(~/.claude/scripts/extract-animations.js)

    # For each URL:
    FOR url_info IN url_list:
        target = url_info.target
        url = url_info.url

        REPORT: "   Processing: {target} ({url})"

        # Open page in Chrome DevTools
        mcp__chrome-devtools__navigate_page(url=url)

        # Wait for page to fully load and animations to initialize
        bash(sleep 2)

        # Execute extraction script
        result = mcp__chrome-devtools__evaluate_script(function=script_content)

        # Save raw animation data
        Write({base_path}/.intermediates/animation-analysis/animations-{target}.json, result)

        REPORT: "   ✅ Extracted: {result.summary.total_animations} animations, {result.summary.total_transitions} transitions"

    animations_extracted = true
    REPORT: "   ✅ CSS animation extraction complete"
ELSE IF has_urls AND NOT mcp_chrome_devtools_available:
    animations_extracted = false
    REPORT: "⚠️ Chrome DevTools MCP not available"
    REPORT: "   Falling back to interactive mode for animation guidance"
ELSE:
    animations_extracted = false
```

**Extraction Script Reference**: `~/.claude/scripts/extract-animations.js`

**Usage**: Read the script file and use content directly in `mcp__chrome-devtools__evaluate_script()`

**Script returns**:
- `metadata`: Extraction timestamp, URL, method
- `transitions`: Array of transition definitions (property, duration, easing, delay)
- `animations`: Array of keyframe animations (name, duration, easing, keyframes)
- `transforms`: Common transform patterns
- `summary`: Statistics (total_animations, total_transitions, unique_easings)

**Benefits**:
- ✅ Real animation values from production sites
- ✅ Captures all CSS transitions and @keyframes rules
- ✅ Identifies common easing functions and durations
- ✅ Maps animations to element selectors

---

**Phase 1 Output**: `animations-{target}.json` (intermediate files)

## Phase 2: Interactive Animation Specification (Interactive/Fallback Mode)

### Step 1: Check if Extraction Sufficient

```bash
# If animations extracted from CSS, check coverage
IF animations_extracted:
    total_animations = sum([data.summary.total_animations for data in all_extracted])
    total_transitions = sum([data.summary.total_transitions for data in all_extracted])

    # If sufficient data found, skip interactive mode
    IF total_animations >= 3 OR total_transitions >= 5:
        REPORT: "✅ Sufficient animation data extracted from CSS"
        SKIP to Phase 3
    ELSE:
        REPORT: "⚠️ Limited animation data found - launching interactive mode"
        extraction_insufficient = true
ELSE:
    extraction_insufficient = true
```

### Step 2: Interactive Question Workflow (Agent)

```bash
# If extraction failed or insufficient, use interactive questioning
IF extraction_insufficient OR extraction_mode == "interactive":
    REPORT: "🤔 Launching interactive animation specification mode"

    # Launch ui-design-agent for interactive questioning
    Task(ui-design-agent): `
      [ANIMATION_SPECIFICATION_TASK]
      Guide user through animation design decisions via structured questions

      SESSION: {session_id} | MODE: interactive | BASE_PATH: {base_path}

      ## Context
      - Design tokens available: {has_design_context}
      - Focus areas: {focus_types}
      - Extracted data: {animations_extracted ? "Partial CSS data available" : "No CSS data"}

      ## Interactive Workflow

      For each animation category, ASK user and WAIT for response:

      ### 1. Transition Duration Scale
      QUESTION: "What timing scale feels right for your design?"
      OPTIONS:
        - "Fast & Snappy" (100-200ms transitions)
        - "Balanced" (200-400ms transitions)
        - "Smooth & Deliberate" (400-600ms transitions)
        - "Custom" (specify values)

      ### 2. Easing Philosophy
      QUESTION: "What easing style matches your brand?"
      OPTIONS:
        - "Linear" (constant speed, technical feel)
        - "Ease-Out" (fast start, natural feel)
        - "Ease-In-Out" (balanced, polished feel)
        - "Spring/Bounce" (playful, modern feel)
        - "Custom" (specify cubic-bezier)

      ### 3. Common Interactions (Ask for each)
      FOR interaction IN ["button-hover", "link-hover", "card-hover", "modal-open", "dropdown-toggle"]:
        QUESTION: "How should {interaction} animate?"
        OPTIONS:
          - "Subtle" (color/opacity change only)
          - "Lift" (scale + shadow increase)
          - "Slide" (transform translateY)
          - "Fade" (opacity transition)
          - "None" (no animation)
          - "Custom" (describe behavior)

      ### 4. Page Transitions
      QUESTION: "Should page/route changes have animations?"
      IF YES:
        ASK: "What style?"
        OPTIONS:
          - "Fade" (crossfade between views)
          - "Slide" (swipe left/right)
          - "Zoom" (scale in/out)
          - "None"

      ### 5. Loading States
      QUESTION: "What loading animation style?"
      OPTIONS:
        - "Spinner" (rotating circle)
        - "Pulse" (opacity pulse)
        - "Skeleton" (shimmer effect)
        - "Progress Bar" (linear fill)
        - "Custom" (describe)

      ### 6. Micro-interactions
      QUESTION: "Should form inputs have micro-interactions?"
      IF YES:
        ASK: "What interactions?"
        OPTIONS:
          - "Focus state animation" (border/shadow transition)
          - "Error shake" (horizontal shake on error)
          - "Success check" (checkmark animation)
          - "All of the above"

      ### 7. Scroll Animations
      QUESTION: "Should elements animate on scroll?"
      IF YES:
        ASK: "What scroll animation style?"
        OPTIONS:
          - "Fade In" (opacity 0→1)
          - "Slide Up" (translateY + fade)
          - "Scale In" (scale 0.9→1 + fade)
          - "Stagger" (sequential delays)
          - "None"

      ## Output Generation

      Based on user responses, generate structured data:

      1. Create animation-specification.json with user choices:
         - timing_scale (fast/balanced/slow/custom)
         - easing_philosophy (linear/ease-out/ease-in-out/spring)
         - interactions: {interaction_name: {type, properties, timing}}
         - page_transitions: {enabled, style, duration}
         - loading_animations: {style, duration}
         - scroll_animations: {enabled, style, stagger_delay}

      2. Write to {base_path}/.intermediates/animation-analysis/animation-specification.json

      ## Critical Requirements
      - ✅ Use Write() tool immediately for specification file
      - ✅ Wait for user response after EACH question before proceeding
      - ✅ Validate responses and ask for clarification if needed
      - ✅ Provide sensible defaults if user skips questions
      - ❌ NO external research or MCP calls
    `
```

---

**Phase 2 Output**: `animation-specification.json` (user preferences)

## Phase 3: Animation Token Synthesis (Agent)

**Executor**: `Task(ui-design-agent)` for token generation

### Step 1: Load All Input Sources

```bash
# Gather all available animation data
extracted_animations = []
IF animations_extracted:
    FOR target IN target_list:
        IF exists({base_path}/.intermediates/animation-analysis/animations-{target}.json):
            extracted_animations.append(Read(file))

user_specification = null
IF exists({base_path}/.intermediates/animation-analysis/animation-specification.json):
    user_specification = Read(file)

design_tokens = null
IF has_design_context:
    design_tokens = Read({base_path}/style-extraction/style-1/design-tokens.json)
```

### Step 2: Launch Token Generation Task

```javascript
Task(ui-design-agent): `
  [ANIMATION_TOKEN_GENERATION_TASK]
  Synthesize all animation data into production-ready animation tokens

  SESSION: {session_id} | BASE_PATH: {base_path}

  ## Input Sources
  1. Extracted CSS Animations: {JSON.stringify(extracted_animations) OR "None"}
  2. User Specification: {JSON.stringify(user_specification) OR "None"}
  3. Design Tokens Context: {JSON.stringify(design_tokens) OR "None"}

  ## Synthesis Rules

  ### Priority System
  1. User specification (highest priority)
  2. Extracted CSS values (medium priority)
  3. Industry best practices (fallback)

  ### Duration Normalization
  - Analyze all extracted durations
  - Cluster into 3-5 semantic scales: instant, fast, normal, slow, very-slow
  - Align with design token spacing scale if available

  ### Easing Standardization
  - Identify common easing functions from extracted data
  - Map to semantic names: linear, ease-in, ease-out, ease-in-out, spring
  - Convert all cubic-bezier values to standard format

  ### Animation Categorization
  Organize into:
  - transitions: Property-specific transitions (color, transform, opacity)
  - keyframe_animations: Named @keyframe animations
  - interactions: Interaction-specific presets (hover, focus, active)
  - micro_interactions: Small feedback animations
  - page_transitions: Route/view change animations
  - scroll_animations: Scroll-triggered animations

  ## Generate Files

  ### 1. animation-tokens.json
  Complete animation token structure:

  {
    "duration": {
      "instant": "0ms",
      "fast": "150ms",
      "normal": "300ms",
      "slow": "500ms",
      "very-slow": "800ms"
    },
    "easing": {
      "linear": "linear",
      "ease-in": "cubic-bezier(0.4, 0, 1, 1)",
      "ease-out": "cubic-bezier(0, 0, 0.2, 1)",
      "ease-in-out": "cubic-bezier(0.4, 0, 0.2, 1)",
      "spring": "cubic-bezier(0.34, 1.56, 0.64, 1)"
    },
    "transitions": {
      "color": {
        "property": "color, background-color, border-color",
        "duration": "var(--duration-fast)",
        "easing": "var(--easing-ease-out)"
      },
      "transform": {
        "property": "transform",
        "duration": "var(--duration-normal)",
        "easing": "var(--easing-ease-out)"
      },
      "opacity": {
        "property": "opacity",
        "duration": "var(--duration-normal)",
        "easing": "var(--easing-ease-in-out)"
      }
    },
    "keyframes": {
      "fadeIn": {
        "0%": {"opacity": "0"},
        "100%": {"opacity": "1"}
      },
      "slideInUp": {
        "0%": {"transform": "translateY(20px)", "opacity": "0"},
        "100%": {"transform": "translateY(0)", "opacity": "1"}
      },
      "pulse": {
        "0%, 100%": {"opacity": "1"},
        "50%": {"opacity": "0.7"}
      }
    },
    "interactions": {
      "button-hover": {
        "properties": ["background-color", "transform"],
        "duration": "var(--duration-fast)",
        "easing": "var(--easing-ease-out)",
        "transform": "scale(1.02)"
      },
      "card-hover": {
        "properties": ["box-shadow", "transform"],
        "duration": "var(--duration-normal)",
        "easing": "var(--easing-ease-out)",
        "transform": "translateY(-4px)"
      }
    },
    "page_transitions": {
      "fade": {
        "duration": "var(--duration-normal)",
        "enter": "fadeIn",
        "exit": "fadeOut"
      }
    },
    "scroll_animations": {
      "default": {
        "animation": "fadeInUp",
        "duration": "var(--duration-slow)",
        "easing": "var(--easing-ease-out)",
        "threshold": "0.1",
        "stagger_delay": "100ms"
      }
    }
  }

  ### 2. animation-guide.md
  Comprehensive usage guide:
  - Animation philosophy and rationale
  - Duration scale explanation
  - Easing function usage guidelines
  - Interaction animation patterns
  - Implementation examples (CSS and JS)
  - Accessibility considerations (prefers-reduced-motion)
  - Performance best practices

  ## Critical Requirements
  - ✅ Use Write() tool immediately for both files
  - ✅ Ensure all tokens use CSS Custom Property format: var(--duration-fast)
  - ✅ Include prefers-reduced-motion media query guidance
  - ✅ Validate all cubic-bezier values are valid
  - ❌ NO external research or MCP calls
`
```

---

**Phase 3 Output**: `animation-tokens.json` + `animation-guide.md`

## Phase 4: Verify Output

### Step 1: Check Files Created

```bash
# Verify animation tokens created
bash(test -f {base_path}/animation-extraction/animation-tokens.json && echo "exists")
bash(test -f {base_path}/animation-extraction/animation-guide.md && echo "exists")

# Validate structure
bash(cat {base_path}/animation-extraction/animation-tokens.json | grep -q "duration" && echo "valid")
bash(cat {base_path}/animation-extraction/animation-tokens.json | grep -q "easing" && echo "valid")
```

### Step 2: Verify File Sizes

```bash
bash(ls -lh {base_path}/animation-extraction/)
```

**Output**: 2 files verified (animation-tokens.json, animation-guide.md)

## Completion

### Todo Update

```javascript
TodoWrite({todos: [
  {content: "Setup and input validation", status: "completed", activeForm: "Validating inputs"},
  {content: "CSS animation extraction (auto mode)", status: "completed", activeForm: "Extracting from CSS"},
  {content: "Interactive specification (fallback)", status: "completed", activeForm: "Collecting user input"},
  {content: "Animation token synthesis (agent)", status: "completed", activeForm: "Generating tokens"},
  {content: "Verify output files", status: "completed", activeForm: "Verifying files"}
]});
```

### Output Message

```
✅ Animation extraction complete!

Configuration:
- Session: {session_id}
- Extraction Mode: {extraction_mode} (auto/interactive)
- Input Sources:
  {IF animations_extracted:
  - ✅ CSS extracted from {len(url_list)} URL(s)
  }
  {IF user_specification:
  - ✅ User specification via interactive mode
  }
  {IF has_design_context:
  - ✅ Aligned with existing design tokens
  }

Generated Files:
{base_path}/animation-extraction/
├── animation-tokens.json      # Production-ready animation tokens
└── animation-guide.md          # Usage guidelines and examples

{IF animations_extracted:
Intermediate Analysis:
{base_path}/.intermediates/animation-analysis/
├── animations-*.json           # Extracted CSS data ({len(url_list)} files)
}
{IF user_specification:
└── animation-specification.json # User preferences
}

Extracted Data Summary:
- Duration scales: {duration_count} values
- Easing functions: {easing_count} types
- Interaction presets: {interaction_count} patterns
- Keyframe animations: {keyframe_count} animations

Next: Animation tokens ready for integration
  • style-extract/layout-extract can reference animation tokens
  • generate command will include animation CSS
  • Tokens use var() format for easy customization
```

## Simple Bash Commands

### Path Operations

```bash
# Find design directory
bash(find .workflow -type d -name "design-*" | head -1)

# Create output directories
bash(mkdir -p {base_path}/animation-extraction)
bash(mkdir -p {base_path}/.intermediates/animation-analysis)
```

### Validation Commands

```bash
# Check if already extracted
bash(test -f {base_path}/animation-extraction/animation-tokens.json && echo "exists")

# Validate JSON structure
bash(cat {base_path}/animation-extraction/animation-tokens.json | grep -q "duration" && echo "valid")

# Count animation types
bash(cat animation-tokens.json | grep -c "\"keyframes\":")
```

### File Operations

```bash
# Load design tokens context
bash(test -f {base_path}/style-extraction/style-1/design-tokens.json && cat it)

# Verify output
bash(ls {base_path}/animation-extraction/)
```

## Output Structure

```
{base_path}/
├── .intermediates/                  # Intermediate analysis files
│   └── animation-analysis/
│       ├── animations-{target}.json      # Extracted CSS (auto mode)
│       └── animation-specification.json  # User input (interactive mode)
└── animation-extraction/            # Final animation tokens
    ├── animation-tokens.json        # Production-ready animation tokens
    └── animation-guide.md            # Usage guide and examples
```

## animation-tokens.json Format

```json
{
  "duration": {
    "instant": "0ms",
    "fast": "150ms",
    "normal": "300ms",
    "slow": "500ms",
    "very-slow": "800ms"
  },
  "easing": {
    "linear": "linear",
    "ease-in": "cubic-bezier(0.4, 0, 1, 1)",
    "ease-out": "cubic-bezier(0, 0, 0.2, 1)",
    "ease-in-out": "cubic-bezier(0.4, 0, 0.2, 1)",
    "spring": "cubic-bezier(0.34, 1.56, 0.64, 1)"
  },
  "transitions": {
    "color": {"property": "...", "duration": "var(--duration-fast)", "easing": "..."},
    "transform": {"property": "...", "duration": "...", "easing": "..."}
  },
  "keyframes": {
    "fadeIn": {"0%": {...}, "100%": {...}},
    "slideInUp": {...}
  },
  "interactions": {
    "button-hover": {"properties": [...], "duration": "...", "transform": "..."},
    "card-hover": {...}
  },
  "page_transitions": {...},
  "scroll_animations": {...}
}
```

**Requirements**: CSS var() format, valid cubic-bezier values, prefers-reduced-motion support

## Error Handling

### Common Errors

```
ERROR: No URL or interactive mode specified
→ Provide --urls for auto mode or use --mode interactive

ERROR: Chrome DevTools unavailable
→ Automatically falls back to interactive mode

ERROR: Insufficient animation data extracted
→ Launches interactive mode for supplemental input

ERROR: Invalid cubic-bezier values
→ Validates and corrects to nearest standard easing
```

### Recovery Strategies

- **CSS extraction failure**: Falls back to interactive mode
- **Partial extraction**: Supplements with interactive questioning
- **Invalid data**: Validates and uses fallback values

## Key Features

- **Auto-Trigger CSS Extraction** - Automatically extracts animations when --urls provided
- **Hybrid Strategy** - Combines CSS extraction with interactive specification
- **Intelligent Fallback** - Gracefully handles extraction failures
- **Context-Aware** - Aligns with existing design tokens
- **Production-Ready** - CSS var() format, accessibility support
- **Comprehensive Coverage** - Transitions, keyframes, interactions, scroll animations
- **Agent-Driven** - Autonomous token generation with ui-design-agent

## Integration

**Workflow Position**: Between style extraction and layout extraction (or parallel)

**New Workflow**:
1. `/workflow:ui-design:style-extract` → `design-tokens.json` + `style-guide.md`
2. **`/workflow:ui-design:animation-extract`** → `animation-tokens.json` + `animation-guide.md` (NEW)
3. `/workflow:ui-design:layout-extract` → `layout-templates.json`
4. `/workflow:ui-design:generate`:
   - Reads: design-tokens.json + animation-tokens.json + layout-templates.json
   - Generates: Prototypes with animation CSS included

**Input**: URLs (auto mode) or interactive questioning
**Output**: `animation-tokens.json` + `animation-guide.md`
**Next**: `/workflow:ui-design:layout-extract` OR `/workflow:ui-design:generate`

**Note**: This command extracts motion design patterns (animations, transitions) to complement visual style tokens. Can run in parallel with layout-extract.
