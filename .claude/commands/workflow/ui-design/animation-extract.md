---
name: animation-extract
description: Extract animation and transition patterns from URLs, CSS, or interactive questioning for design system documentation
argument-hint: "[--design-id <id>] [--session <id>] [--urls "<list>"] [--focus "<types>"] [--interactive]"
allowed-tools: TodoWrite(*), Read(*), Write(*), Glob(*), Bash(*), AskUserQuestion(*), Task(ui-design-agent), mcp__chrome-devtools__navigate_page(*), mcp__chrome-devtools__evaluate_script(*)
---

# Animation Extraction Command

## Overview

Extract animation and transition patterns from URLs or interactive questioning using AI analysis. Directly generates production-ready animation systems with complete `animation-tokens.json` and `animation-guide.md`.

**Strategy**: AI-Driven Animation Specification with Visual Previews

- **CSS Extraction**: Automatic CSS animation/transition extraction from URLs via Chrome DevTools
- **Question Generation**: Agent generates context-aware specification questions with visual previews
- **Visual Previews**: Timeline representations, easing curve ASCII art, and animation sequence diagrams
- **Flexible Input**: URLs for CSS extraction, or standalone question-based specification
- **Optional Interaction**: User answers questions only when `--interactive` flag present
- **Production-Ready**: CSS var() format, WCAG-compliant, semantic naming
- **Default Behavior**: Non-interactive mode uses CSS data + best practices

## Phase 0: Setup & Input Validation

### Step 1: Detect Input Mode & Base Path

```bash
# Detect input source
# Priority: --urls → CSS extraction available | no --urls → question-only mode

# Parse URLs if provided (format: "target:url,target:url,...")
IF --urls:
    url_list = []
    FOR pair IN split(--urls, ","):
        IF ":" IN pair:
            target, url = pair.split(":", 1)
            url_list.append({target: target.strip(), url: url.strip()})
        ELSE:
            # Single URL without target
            url_list.append({target: "page", url: pair.strip()})

    has_urls = true
    primary_url = url_list[0].url
ELSE:
    has_urls = false

# Parse animation focus (if provided)
IF --focus:
    focus_types = split(--focus, ",")  # e.g., "transitions,hover,scroll"
ELSE:
    focus_types = ["all"]  # Extract all animation types

# Check interactive mode flag
interactive_mode = --interactive OR false

# Determine base path with priority: --design-id > --session > auto-detect
if [ -n "$DESIGN_ID" ]; then
  # Exact match by design ID
  relative_path=$(find .workflow -name "${DESIGN_ID}" -type d -print -quit)
elif [ -n "$SESSION_ID" ]; then
  # Latest in session
  relative_path=$(find .workflow/WFS-$SESSION_ID -name "design-run-*" -type d -printf "%T@ %p\n" 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2)
else
  # Latest globally
  relative_path=$(find .workflow -name "design-run-*" -type d -printf "%T@ %p\n" 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2)
fi

# Validate and convert to absolute path
if [ -z "$relative_path" ] || [ ! -d "$relative_path" ]; then
  echo "❌ ERROR: Design run not found"
  echo "💡 HINT: Run '/workflow:ui-design:list' to see available design runs"
  exit 1
fi

base_path=$(cd "$relative_path" && pwd)
bash(echo "✓ Base path: $base_path")
```

### Step 2: Extract Computed Animations (URL Mode - Auto-Trigger)

```bash
# AUTO-TRIGGER: If URLs are available (from --urls parameter), automatically extract real CSS values
# This provides accurate animation data to supplement specification

IF has_urls AND mcp_chrome_devtools_available:
    REPORT: "🔍 Auto-triggering URL mode: Extracting computed animations from --urls parameter"
    REPORT: "   URL: {primary_url}"

    # Read extraction script
    script_content = Read(~/.claude/scripts/extract-animations.js)

    bash(mkdir -p {base_path}/.intermediates/animation-analysis)

    # For each URL:
    FOR url_info IN url_list:
        target = url_info.target
        url = url_info.url

        REPORT: "   Processing: {target} ({url})"

        # Open page in Chrome DevTools
        mcp__chrome-devtools__navigate_page(url=url)

        # Wait for page to fully load and animations to initialize
        bash(sleep 2)

        # Execute extraction script directly
        result = mcp__chrome-devtools__evaluate_script(function=script_content)

        # Save computed animations to intermediates directory
        Write({base_path}/.intermediates/animation-analysis/animations-{target}.json, result)

        REPORT: "   ✅ Extracted: {result.summary.total_animations} animations, {result.summary.total_transitions} transitions"

    animations_extracted = true
    REPORT: "   ✅ Computed animations extracted and saved"
ELSE IF has_urls AND NOT mcp_chrome_devtools_available:
    animations_extracted = false
    REPORT: "⚠️ Chrome DevTools MCP not available, falling back to specification mode"
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

### Step 3: Load Design Tokens Context

```bash
# Load existing design tokens for duration/easing alignment
IF exists({base_path}/style-extraction/style-1/design-tokens.json):
    design_tokens = Read({base_path}/style-extraction/style-1/design-tokens.json)
    has_design_context = true
ELSE:
    has_design_context = false
    REPORT: "ℹ️ No design tokens found - animation tokens will use standalone values"

# Create output directory
bash(mkdir -p {base_path}/animation-extraction)
```

### Step 4: Memory Check

```bash
# Check if output already exists
bash(test -f {base_path}/animation-extraction/animation-tokens.json && echo "exists")
IF exists: SKIP to completion
```

---

**Phase 0 Output**: `input_mode`, `base_path`, `has_urls`, `url_list[]`, `focus_types[]`, `has_design_context`, `interactive_mode`, `animations_extracted`

## Phase 1: Animation Specification Generation

### Step 1: Load Project Context

```bash
# Load brainstorming context if available
bash(test -f {base_path}/.brainstorming/role-analysis.md && cat it)

# Load extracted animations if available
IF animations_extracted:
    FOR target IN url_list:
        extracted_data = Read({base_path}/.intermediates/animation-analysis/animations-{target.target}.json)
```

### Step 2: Generate Animation Specification Options (Agent Task 1)

**Executor**: `Task(ui-design-agent)`

Launch agent to generate animation specification options with previews:

```javascript
Task(ui-design-agent): `
  [ANIMATION_SPECIFICATION_GENERATION_TASK]
  Generate context-aware animation specification questions

  SESSION: {session_id} | MODE: explore | BASE_PATH: {base_path}

  ## Input Analysis
  - Focus types: {focus_types.join(", ")}
  - Design context: {has_design_context ? "Available" : "None"}
  - Extracted animations: {animations_extracted ? "Available" : "None"}
  ${animations_extracted ? "- CSS Data: Read from .intermediates/animation-analysis/animations-*.json" : ""}

  ## Analysis Rules
  - Analyze CSS extraction data (if available) to inform question generation
  - Generate questions covering timing, easing, interactions, and motion patterns
  - Based on focus_types, include relevant categories:
    * "all" or "transitions": timing_scale, easing_philosophy
    * "all" or "interactions" or "hover": button_interactions, card_interactions, input_interactions
    * "all" or "page": page_transitions
    * "all" or "loading": loading_states
    * "all" or "scroll": scroll_animations

  ## Generate Questions
  For each applicable category, create question with:
  1. **Category ID** (e.g., "timing_scale", "button_interactions")
  2. **Question text** (in Chinese, clear and concise)
  3. **Options** (2-5 options per question):
     - Option key (a, b, c, d, e)
     - Option label (brief description)
     - Option details (detailed explanation with technical specs)
     - Technical specs (duration values, easing curves, transform values)
     - Visual preview (timeline representation or easing curve ASCII art)

  ## Output
  Write single JSON file: {base_path}/.intermediates/animation-analysis/analysis-options.json

  Use schema:
  {
    "metadata": {
      "generated_at": "<timestamp>",
      "focus_types": [...],
      "total_questions": <count>,
      "has_css_data": <boolean>
    },
    "specification_options": [
      {
        "id": 1,
        "category": "timing_scale",
        "question": "您的设计需要什么样的过渡速度？",
        "options": [
          {
            "key": "a",
            "label": "快速敏捷",
            "details": "100-200ms 过渡，适合工具型应用和即时反馈场景",
            "duration_values": {"fast": "100ms", "normal": "150ms", "slow": "200ms"},
            "visual_preview": {
              "timeline": "0ms ━━━━━━━━━━ 150ms",
              "description": "快速完成，几乎瞬时反馈"
            }
          },
          ...
        ]
      },
      {
        "id": 2,
        "category": "easing_philosophy",
        "question": "您偏好什么样的动画缓动曲线？",
        "options": [
          {
            "key": "a",
            "label": "自然缓动",
            "details": "标准 ease-out，模拟自然减速",
            "easing_curves": {
              "ease-in": "cubic-bezier(0.4, 0, 1, 1)",
              "ease-out": "cubic-bezier(0, 0, 0.2, 1)",
              "ease-in-out": "cubic-bezier(0.4, 0, 0.2, 1)"
            },
            "visual_preview": {
              "curve_art": "│      ╱─\n│    ╱\n│  ╱\n│╱\n└─────",
              "description": "快速启动，平滑减速"
            }
          },
          ...
        ]
      },
      ...
    ]
  }

  CRITICAL: Use Write() tool immediately after generating complete JSON
`
```

### Step 3: Verify Options File Created

```bash
bash(test -f {base_path}/.intermediates/animation-analysis/analysis-options.json && echo "created")

# Quick validation
bash(cat {base_path}/.intermediates/animation-analysis/analysis-options.json | grep -q "specification_options" && echo "valid")
```

**Output**: `analysis-options.json` with animation specification questions

---

**Phase 1 Output**: `analysis-options.json` with generated specification questions

## Phase 1.5: User Confirmation (Optional - Triggered by --interactive)

**Purpose**: Allow user to answer animation specification questions before generating tokens

**Trigger Condition**: Execute this phase ONLY if `--interactive` flag is present

### Step 1: Check Interactive Flag

```bash
# Skip this entire phase if --interactive flag is not present
IF NOT --interactive:
    SKIP to Phase 2
    REPORT: "ℹ️ Non-interactive mode: Using CSS extraction + default animation preferences"

REPORT: "🎯 Interactive mode enabled: User answers required"
```

### Step 2: Load and Present Options

```bash
# Read options file
options = Read({base_path}/.intermediates/animation-analysis/analysis-options.json)

# Parse specification questions
specification_options = options.specification_options
```

### Step 3: Present Options to User

```
📋 Animation Specification Questions

We've generated {options.metadata.total_questions} questions to define your animation system.
Please answer each question to customize the animation behavior.

{FOR each question in specification_options:
  ═══════════════════════════════════════════════════
  Question {question.id}: {question.question}
  Category: {question.category}
  ═══════════════════════════════════════════════════

  {FOR each option in question.options:
    {option.key}) {option.label}
       {option.details}

       ${option.visual_preview ? "Preview:\n       " + option.visual_preview.timeline || option.visual_preview.curve_art || option.visual_preview.animation_sequence : ""}
       ${option.visual_preview ? "       " + option.visual_preview.description : ""}

       ${option.duration_values ? "Durations: " + JSON.stringify(option.duration_values) : ""}
       ${option.easing_curves ? "Easing: " + JSON.stringify(option.easing_curves) : ""}
       ${option.transform_value ? "Transform: " + option.transform_value : ""}
  }

  ═══════════════════════════════════════════════════
}
```

### Step 4: Capture User Selection

**Interaction Strategy**: If questions > 4 OR any question has > 3 options, use batch text format:

```
【问题[N] - [category]】[question_text]
[key]) [label]
   [details]
[key]) [label]
   [details]
...
请回答 (格式: 1a 2b 3c...)：

User input: "[N][key] [N][key] ..." → Parse answer pairs (single selection per question)
```

Otherwise, use `AskUserQuestion` below.

```javascript
// Use AskUserQuestion tool for each question (single selection)
user_answers = {}

FOR each question IN specification_options:
  AskUserQuestion({
    questions: [{
      question: question.question,
      header: question.category,
      multiSelect: false,  // Single selection per question
      options: [
        {FOR each option IN question.options:
          label: "{option.key}) {option.label}",
          description: option.details
        }
      ]
    }]
  })

  // Parse user response (single selection, e.g., "a) Fast & Snappy")
  selected_option_text = user_answer

  // Check for user cancellation
  IF selected_option_text == null:
      REPORT: "⚠️ User canceled selection. Using default animation preferences."
      EXIT Phase 1.5

  // Extract option key from selection text
  match = selected_option_text.match(/^([a-e])\)/)
  IF match:
      selected_key = match[1]
      user_answers[question.category] = selected_key
      REPORT: "✅ {question.category}: Selected option {selected_key}"
  ELSE:
      ERROR: "Invalid selection format. Expected 'a) ...' format"
      EXIT workflow

REPORT: "✅ Collected {Object.keys(user_answers).length} animation preferences"
```

### Step 5: Update Options File with User Selection

```bash
# Update analysis-options.json with user selection (embedded)
options.user_selection = {
  "selected_at": "{current_timestamp}",
  "session_id": "{session_id}",
  "answers": user_answers  // {category: selected_key}
}

# Write updated file back
Write({base_path}/.intermediates/animation-analysis/analysis-options.json, JSON.stringify(options, indent=2))

# Verify
bash(test -f {base_path}/.intermediates/animation-analysis/analysis-options.json && echo "saved")
```

### Step 6: Confirmation Message

```
✅ Animation preferences recorded!

You selected:
{FOR each category, selected_key IN user_answers:
    question = find(specification_options, q => q.category == category)
    option = find(question.options, o => o.key == selected_key)
    • {category}: {option.label}
      ({option.details})
}

Proceeding to generate animation system with your preferences...
```

**Output**: Updated `analysis-options.json` with embedded `user_selection` field

## Phase 2: Animation System Generation (Agent Task 2)

**Executor**: `Task(ui-design-agent)` for animation token generation

### Step 1: Load User Selection or Use Defaults

```bash
# Read analysis-options.json which may contain user_selection
options = Read({base_path}/.intermediates/animation-analysis/analysis-options.json)
specification_options = options.specification_options

# Check if user_selection field exists (interactive mode)
IF options.user_selection AND options.user_selection.answers:
    # Interactive mode: Use user-selected preferences
    user_answers = options.user_selection.answers

    REPORT: "🎯 Interactive mode: Using user-selected animation preferences"
ELSE:
    # Non-interactive mode: Use defaults (first option for each question)
    user_answers = null

    REPORT: "ℹ️ Non-interactive mode: Using default animation preferences"

# Load extracted animations if available
extracted_animations = []
IF animations_extracted:
    FOR url_info IN url_list:
        target = url_info.target
        IF exists({base_path}/.intermediates/animation-analysis/animations-{target}.json):
            data = Read({base_path}/.intermediates/animation-analysis/animations-{target}.json)
            extracted_animations.push(data)
```

### Step 2: Create Output Directory

```bash
# Create directory for animation system
bash(mkdir -p {base_path}/animation-extraction)
```

### Step 3: Launch Animation Generation Task

Generate animation system based on user preferences (or defaults) + CSS extraction:

```javascript
Task(ui-design-agent): `
  [ANIMATION_SYSTEM_GENERATION_TASK]
  Generate production-ready animation system based on user preferences and CSS extraction

  SESSION: {session_id} | BASE_PATH: {base_path}

  USER PREFERENCES:
  ${user_answers ? "- User Selection: " + JSON.stringify(user_answers) : "- Using Defaults: First option for each category"}
  ${user_answers ? "- Specification Options: Read from .intermediates/animation-analysis/analysis-options.json for detailed specs" : ""}

  ## Input Analysis
  - Interactive mode: {user_answers ? "Yes (user preferences available)" : "No (using defaults)"}
  - CSS extraction: {extracted_animations.length > 0 ? "Available" : "None"}
  ${extracted_animations.length > 0 ? "- CSS Data: " + JSON.stringify(extracted_animations) : ""}
  - Design context: {has_design_context ? "Available" : "None"}
  ${has_design_context ? "- Design Tokens: Read from style-extraction/style-1/design-tokens.json" : ""}

  ## Generation Rules
  ${user_answers ? `
  - Read analysis-options.json to get user_selection.answers
  - For each category in user_selection.answers, find the selected option
  - Use the selected option's technical specs (duration_values, easing_curves, transform_value, etc.)
  - Apply these specs to generate animation tokens
  ` : `
  - Use first option (key "a") from each question in specification_options as default
  - Extract technical specs from default options
  `}
  - Combine user preferences with CSS extraction data (if available)
  - Align with design tokens (spacing, colors) if available
  - All tokens use CSS Custom Property format: var(--duration-fast)
  - WCAG-compliant: Respect prefers-reduced-motion
  - Semantic naming for all animation values

  ## Synthesis Priority
  1. User answers from analysis-options.json user_selection field (highest priority)
  2. Extracted CSS values from animations-*.json (medium priority)
  3. Industry best practices (fallback)

  ## Duration Normalization
  - IF user_selection.answers.timing_scale EXISTS:
      Find selected option in specification_options
      Use option's duration_values for token generation
  - ELSE IF extracted CSS durations available:
      Cluster extracted durations into 3-5 semantic scales
  - ELSE:
      Use standard scale (instant:0ms, fast:150ms, normal:300ms, slow:500ms, very-slow:800ms)

  ## Easing Standardization
  - IF user_selection.answers.easing_philosophy EXISTS:
      Find selected option in specification_options
      Use option's easing_curves for token generation
  - ELSE IF extracted CSS easings available:
      Identify common easing functions from CSS
  - ELSE:
      Use standard easings (linear, ease-in, ease-out, ease-in-out, spring)

  ## Animation Categorization
  Organize into:
  - **duration**: Timing scale (instant, fast, normal, slow, very-slow)
  - **easing**: Easing functions (linear, ease-in, ease-out, ease-in-out, spring)
  - **transitions**: Property-specific transitions (color, transform, opacity, etc.)
  - **keyframes**: Named @keyframe animations (fadeIn, slideInUp, pulse, etc.)
  - **interactions**: Interaction-specific presets (button-hover, card-hover, input-focus, etc.)
  - **page_transitions**: Route/view change animations (if user enabled)
  - **scroll_animations**: Scroll-triggered animations (if user enabled)

  ## Generate Files

  ### 1. animation-tokens.json
  Complete animation token structure using var() references:

  {
    "duration": {
      "instant": "0ms",
      "fast": "150ms",      # From user_selection or CSS extraction or default
      "normal": "300ms",
      "slow": "500ms",
      "very-slow": "800ms"
    },
    "easing": {
      "linear": "linear",
      "ease-in": "cubic-bezier(0.4, 0, 1, 1)",
      "ease-out": "cubic-bezier(0, 0, 0.2, 1)",      # From user_selection or CSS extraction or default
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
      "fadeIn": {"0%": {"opacity": "0"}, "100%": {"opacity": "1"}},
      "slideInUp": {"0%": {"transform": "translateY(20px)", "opacity": "0"}, "100%": {"transform": "translateY(0)", "opacity": "1"}},
      "pulse": {"0%, 100%": {"opacity": "1"}, "50%": {"opacity": "0.7"}}
    },
    "interactions": {
      "button-hover": {
        # From user_selection.answers.button_interactions or CSS extraction or default
        "properties": ["background-color", "transform"],
        "duration": "var(--duration-fast)",
        "easing": "var(--easing-ease-out)",
        "transform": "scale(1.02)"
      },
      "card-hover": {
        # From user_selection.answers.card_interactions or CSS extraction or default
        "properties": ["box-shadow", "transform"],
        "duration": "var(--duration-normal)",
        "easing": "var(--easing-ease-out)",
        "transform": "translateY(-4px)"
      }
    },
    "page_transitions": {
      # IF user_selection.answers.page_transitions enabled
      "fade": {
        "duration": "var(--duration-normal)",
        "enter": "fadeIn",
        "exit": "fadeOut"
      }
    },
    "scroll_animations": {
      # IF user_selection.answers.scroll_animations enabled
      "default": {
        "animation": "fadeIn",
        "duration": "var(--duration-slow)",
        "easing": "var(--easing-ease-out)",
        "threshold": "0.1"
      }
    }
  }

  ### 2. animation-guide.md
  Comprehensive usage guide with sections:
  - **Animation Philosophy**: Rationale from user choices and CSS analysis
  - **Duration Scale**: Explanation of timing values and usage contexts
  - **Easing Functions**: When to use each easing curve
  - **Transition Presets**: Property-specific transition guidelines
  - **Keyframe Animations**: Available animations and use cases
  - **Interaction Patterns**: Button, card, input animation examples
  - **Page Transitions**: Route change animation implementation (if enabled)
  - **Scroll Animations**: Scroll-trigger setup and configuration (if enabled)
  - **Implementation Examples**: CSS and JavaScript code samples
  - **Accessibility**: prefers-reduced-motion media query setup
  - **Performance Best Practices**: Hardware acceleration, will-change usage

  ## Output File Paths
  - animation-tokens.json: {base_path}/animation-extraction/animation-tokens.json
  - animation-guide.md: {base_path}/animation-extraction/animation-guide.md

  ## Critical Requirements
  - ✅ Use Write() tool immediately for both files
  - ✅ All tokens use CSS Custom Property format: var(--duration-fast)
  - ✅ Include prefers-reduced-motion media query guidance
  - ✅ Validate all cubic-bezier values are valid (4 numbers between 0-1)
  - ${user_answers ? "✅ READ analysis-options.json for user_selection field" : "✅ Use first option from each question as default"}
  - ❌ NO user questions or interaction in this phase
  - ❌ NO external research or MCP calls
`
```

**Output**: Agent generates 2 files (animation-tokens.json, animation-guide.md)

## Phase 3: Verify Output

### Step 1: Check Files Created

```bash
# Verify animation system created
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
  {content: "CSS animation extraction (Phase 1)", status: "completed", activeForm: "Extracting from CSS"},
  {content: "Specification generation (Phase 1 - Agent)", status: "completed", activeForm: "Generating questions"},
  {content: "User confirmation (Phase 1.5 - Optional)", status: "completed", activeForm: "Collecting user answers"},
  {content: "Animation system generation (Phase 2 - Agent)", status: "completed", activeForm: "Generating animation system"},
  {content: "Verify output files (Phase 3)", status: "completed", activeForm: "Verifying files"}
]});
```

### Output Message

```
✅ Animation extraction complete!

Configuration:
- Session: {session_id}
- Interactive Mode: {interactive_mode ? "Enabled (user preferences collected)" : "Disabled (default preferences)"}
- Input Sources:
  {IF animations_extracted:
  - ✅ CSS extracted from {len(url_list)} URL(s)
  }
  {IF interactive_mode AND options.user_selection:
  - ✅ User preferences collected via interactive mode
  }
  {IF NOT interactive_mode:
  - ℹ️ Using default animation preferences (no user interaction)
  }
  {IF has_design_context:
  - ✅ Aligned with existing design tokens
  }

Generated Files:
{base_path}/animation-extraction/
├── animation-tokens.json      # Production-ready animation tokens
└── animation-guide.md          # Usage guidelines and examples

{IF animations_extracted OR options.user_selection:
Intermediate Analysis:
{base_path}/.intermediates/animation-analysis/
{IF animations_extracted:
├── animations-*.json           # Extracted CSS data ({len(url_list)} files)
}
├── analysis-options.json       # Generated questions{options.user_selection ? " + user answers" : ""}
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
bash(find .workflow -type d -name "design-run-*" | head -1)

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
│       ├── animations-{target}.json      # Extracted CSS (URL mode only)
│       └── analysis-options.json         # Generated questions + user answers (embedded)
└── animation-extraction/            # Final animation system
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
→ Provide --urls for CSS extraction or use --interactive for specification

ERROR: Chrome DevTools unavailable
→ Automatically falls back to specification mode

ERROR: Invalid cubic-bezier values
→ Validates and corrects to nearest standard easing
```

### Recovery Strategies

- **CSS extraction failure**: Falls back to specification mode
- **Partial extraction**: Supplements with default values
- **Invalid data**: Validates and uses fallback values

## Key Features

- **Auto-Trigger CSS Extraction** - Automatically extracts animations when --urls provided (Phase 0)
- **Agent-Generated Questions** - Context-aware specification questions with visual previews (Phase 1)
- **Visual Previews** - Timeline representations, easing curve ASCII art, and animation sequences for each option
- **Optional User Interaction** - User answers questions only when `--interactive` flag present (Phase 1.5)
- **Non-Interactive Mode** - Default behavior uses CSS data + best practices (no user questions)
- **Hybrid Strategy** - Combines CSS extraction with user preferences (when interactive)
- **Intelligent Fallback** - Gracefully handles extraction failures
- **Context-Aware** - Aligns with existing design tokens
- **Production-Ready** - CSS var() format, accessibility support
- **Comprehensive Coverage** - Transitions, keyframes, interactions, scroll animations
- **Clear Phase Separation** - Question generation (Agent) → User confirmation (Optional) → Token synthesis (Agent)


