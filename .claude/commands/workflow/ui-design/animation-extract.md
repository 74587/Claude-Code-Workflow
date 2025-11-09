---
name: animation-extract
description: Extract animation and transition patterns from URLs, CSS, or interactive questioning for design system documentation
argument-hint: "[--base-path <path>] [--session <id>] [--urls "<list>"] [--mode <auto|interactive>] [--focus "<types>"]"
allowed-tools: TodoWrite(*), Read(*), Write(*), Glob(*), Bash(*), AskUserQuestion(*), Task(ui-design-agent), mcp__chrome-devtools__navigate_page(*), mcp__chrome-devtools__evaluate_script(*)
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

# Determine base path (auto-detect and convert to absolute)
relative_path=$(find .workflow -type d -name "design-run-*" -printf "%T@ %p\n" 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2)
base_path=$(cd "$relative_path" && pwd)
bash(test -d "$base_path" && echo "✓ Base path: $base_path" || echo "✗ Path not found")
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

## Phase 2: Animation Question Generation (Agent Task 1)

### Step 1: Check if Extraction Sufficient

```bash
# If animations extracted from CSS, check coverage
IF animations_extracted:
    total_animations = sum([data.summary.total_animations for data in all_extracted])
    total_transitions = sum([data.summary.total_transitions for data in all_extracted])

    # If sufficient data found, skip interactive mode
    IF total_animations >= 3 OR total_transitions >= 5:
        REPORT: "✅ Sufficient animation data extracted from CSS"
        SKIP to Phase 4
    ELSE:
        REPORT: "⚠️ Limited animation data found - launching interactive mode"
        extraction_insufficient = true
ELSE:
    extraction_insufficient = true
```

### Step 2: Generate Animation Questions Using Agent

**Executor**: `Task(ui-design-agent)`

Launch agent to generate context-aware animation questions based on project needs:

```javascript
Task(ui-design-agent): `
  [ANIMATION_QUESTION_GENERATION_TASK]
  Generate contextual animation questions based on project context and focus types

  SESSION: {session_id} | MODE: interactive | BASE_PATH: {base_path}

  ## Context Analysis
  - Focus types: {focus_types}
  - Design context: {has_design_context}
  - Extracted animations: {animations_extracted ? "Available" : "None"}

  ## Question Categories to Consider
  Based on focus_types, include relevant categories:
  - "all" or "transitions": timing_scale, easing_philosophy
  - "all" or "interactions" or "hover": button_interactions, card_interactions, input_interactions
  - "all" or "page": page_transitions
  - "all" or "loading": loading_states
  - "all" or "scroll": scroll_animations

  ## Generate Question Structure
  For each applicable category, create question with:
  1. **Category ID** (e.g., "timing_scale", "button_interactions")
  2. **Question text** (in Chinese, clear and concise)
  3. **Options** (2-5 options per question):
     - Option key (a, b, c, d, e)
     - Option label (brief description)
     - Option details (detailed explanation with technical specs)
     - Recommended scenarios (when to use this option)

  ## Output
  Write single JSON file: {base_path}/.intermediates/animation-analysis/question-options.json

  Use schema:
  {
    "metadata": {
      "generated_at": "<timestamp>",
      "focus_types": ["..."],
      "total_questions": <count>
    },
    "questions": [
      {
        "id": 1,
        "category": "timing_scale",
        "question": "您的设计需要什么样的过渡速度？",
        "options": [
          {
            "key": "a",
            "label": "快速敏捷",
            "details": "100-200ms 过渡，适合工具型应用和即时反馈场景",
            "duration_range": "100-200ms"
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

### Step 3: Verify Question File Created

```bash
bash(test -f {base_path}/.intermediates/animation-analysis/question-options.json && echo "created")

# Quick validation
bash(cat {base_path}/.intermediates/animation-analysis/question-options.json | grep -q "questions" && echo "valid")
```

**Output**: `question-options.json` with context-aware questions

---

## Phase 3: Interactive Animation Specification (User Interaction)

### Step 1: Load Generated Questions

```bash
# Read generated questions from JSON file
question_data = Read({base_path}/.intermediates/animation-analysis/question-options.json)

REPORT: "🤔 Interactive animation specification mode"
REPORT: "   Context: {has_design_context ? 'Aligning with design tokens' : 'Standalone animation system'}"
REPORT: "   Questions: {question_data.metadata.total_questions} questions loaded"
REPORT: "   Focus: {question_data.metadata.focus_types}"
```

### Step 2: Present Questions to User

```markdown
# Display questions from loaded JSON
REPORT: ""
REPORT: "===== 动画规格交互式配置 ====="
REPORT: ""

FOR each question IN question_data.questions:
    REPORT: "【问题{question.id} - {question.category}】{question.question}"

    FOR each option IN question.options:
        REPORT: "{option.key}) {option.label}"
        REPORT: "   说明：{option.details}"

    REPORT: ""

REPORT: "支持格式："
REPORT: "- 空格分隔：1a 2b 3c"
REPORT: "- 逗号分隔：1a,2b,3c"
REPORT: "- 自由组合：1a 2b,3c"
REPORT: ""
REPORT: "请输入您的选择："
```

### Step 3: Wait for User Input (Main Flow)

```javascript
# Wait for user input
user_raw_input = WAIT_FOR_USER_INPUT()

# Store raw input for debugging
REPORT: "收到输入: {user_raw_input}"
```

### Step 4: Parse User Answers and Update JSON

```javascript
# Intelligent input parsing (support multiple formats)
answers = {}

# Parse input using intelligent matching
# Support formats: "1a 2b 3c", "1a,2b,3c", "1a 2b,3c"
parsed_responses = PARSE_USER_INPUT(user_raw_input, question_data.questions)

# Validate parsing
IF parsed_responses.is_valid:
    # Map question numbers to categories
    FOR response IN parsed_responses.answers:
        question_id = response.question_id
        selected_option = response.option

        # Find category for this question
        FOR question IN question_data.questions:
            IF question.id == question_id:
                category = question.category
                answers[category] = selected_option
                REPORT: "✅ 问题{question_id} ({category}): 选择 {selected_option}"
                break
ELSE:
    REPORT: "❌ 输入格式无法识别，请参考格式示例重新输入："
    REPORT: "   示例：1a 2b 3c 4d"
    # Return to Step 2 for re-input
    GOTO Step 2

// Update question-options.json with user selection
question_data.user_selection = {
  "selected_at": NOW(),
  "answers": answers
}

// Write updated file back
Write({base_path}/.intermediates/animation-analysis/question-options.json, JSON.stringify(question_data, indent=2))

REPORT: "✅ Updated question-options.json with user selection"
```

---

**Phase 3 Output**: Updated `question-options.json` with user answers embedded

## Phase 4: Animation Token Synthesis (Agent - No User Interaction)

**Executor**: `Task(ui-design-agent)` for token generation

**⚠️ CRITICAL**: This phase has NO user interaction. Agent only reads existing data and generates tokens.

### Step 1: Load All Input Sources

```bash
# Gather all available animation data
extracted_animations = []
IF animations_extracted:
    FOR target IN target_list:
        IF exists({base_path}/.intermediates/animation-analysis/animations-{target}.json):
            extracted_animations.append(Read(file))

# Read user answers from question-options.json
question_data = null
IF exists({base_path}/.intermediates/animation-analysis/question-options.json):
    question_data = Read({base_path}/.intermediates/animation-analysis/question-options.json)
    IF question_data.user_selection:
        REPORT: "✅ Loaded user answers from question-options.json"
    ELSE:
        REPORT: "⚠️ No user selection found in question-options.json"
        question_data = null
ELSE:
    REPORT: "⚠️ No question-options.json found - using extracted CSS only"

design_tokens = null
IF has_design_context:
    design_tokens = Read({base_path}/style-extraction/style-1/design-tokens.json)
```

### Step 2: Launch Token Generation Task (Pure Synthesis)

```javascript
Task(ui-design-agent): `
  [ANIMATION_TOKEN_GENERATION_TASK]
  Synthesize animation data into production-ready tokens - NO user interaction

  SESSION: {session_id} | BASE_PATH: {base_path}

  ## ⚠️ CRITICAL: Pure Synthesis Task
  - NO user questions or interaction
  - READ existing specification files ONLY
  - Generate tokens based on available data

  ## Input Sources (Read-Only)
  1. **Extracted CSS Animations** (if available):
     ${extracted_animations.length > 0 ? JSON.stringify(extracted_animations) : "None - skip CSS data"}

  2. **User Answers** (REQUIRED if Phase 2-3 ran):
     File: {base_path}/.intermediates/animation-analysis/question-options.json
     ${question_data ? "Status: ✅ Found - READ this file for user choices in user_selection field" : "Status: ⚠️ Not found - use CSS extraction only"}

  3. **Design Tokens Context** (for alignment):
     ${design_tokens ? JSON.stringify(design_tokens) : "None - standalone animation system"}

  ## Synthesis Rules

  ### Priority System
  1. User answers from question-options.json user_selection field (highest priority)
  2. Extracted CSS values from animations-*.json (medium priority)
  3. Industry best practices (fallback)

  ### Duration Normalization
  - IF question_data.user_selection.answers.timing_scale EXISTS:
      Map user's answer to duration scale using question_data.questions definitions
  - ELSE IF extracted CSS durations available:
      Cluster extracted durations into 3-5 semantic scales
  - ELSE:
      Use standard scale (instant:0ms, fast:150ms, normal:300ms, slow:500ms, very-slow:800ms)
  - Align with design token spacing scale if available

  ### Easing Standardization
  - IF question_data.user_selection.answers.easing_philosophy EXISTS:
      Map user's answer to easing curve using question_data.questions definitions
  - ELSE IF extracted CSS easings available:
      Identify common easing functions from CSS
  - ELSE:
      Use standard easings
  - Map to semantic names and convert to cubic-bezier format

  ### Animation Categorization
  Organize into:
  - **duration**: Timing scale (instant, fast, normal, slow, very-slow)
  - **easing**: Easing functions (linear, ease-in, ease-out, ease-in-out, spring)
  - **transitions**: Property-specific transitions (color, transform, opacity, etc.)
  - **keyframes**: Named @keyframe animations (fadeIn, slideInUp, pulse, etc.)
  - **interactions**: Interaction-specific presets (button-hover, card-hover, input-focus, etc.)
  - **page_transitions**: Route/view change animations (if user enabled)
  - **scroll_animations**: Scroll-triggered animations (if user enabled)

  ### User Answers Integration
  IF question_data.user_selection EXISTS:
    - Map user answers to token values using question definitions:
      * answers.timing_scale → duration values (use question options for specs)
      * answers.easing_philosophy → easing curves (use question options for specs)
      * answers.button_interactions → interactions.button-hover token
      * answers.card_interactions → interactions.card-hover token
      * answers.input_interactions → micro-interaction tokens
      * answers.page_transitions → page_transitions tokens
      * answers.loading_states → loading state tokens
      * answers.scroll_animations → scroll_animations tokens

  ## Generate Files

  ### 1. animation-tokens.json
  Complete animation token structure using var() references:

  {
    "duration": {
      "instant": "0ms",
      "fast": "150ms",      # Adjust based on user_specification.timing_scale
      "normal": "300ms",
      "slow": "500ms",
      "very-slow": "800ms"
    },
    "easing": {
      "linear": "linear",
      "ease-in": "cubic-bezier(0.4, 0, 1, 1)",
      "ease-out": "cubic-bezier(0, 0, 0.2, 1)",      # Adjust based on user_specification.easing_philosophy
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
      "pulse": {"0%, 100%": {"opacity": "1"}, "50%": {"opacity": "0.7"}},
      # Add more keyframes based on user_specification choices
    },
    "interactions": {
      "button-hover": {
        # Map from user_specification.interactions.button
        "properties": ["background-color", "transform"],
        "duration": "var(--duration-fast)",
        "easing": "var(--easing-ease-out)",
        "transform": "scale(1.02)"
      },
      "card-hover": {
        # Map from user_specification.interactions.card
        "properties": ["box-shadow", "transform"],
        "duration": "var(--duration-normal)",
        "easing": "var(--easing-ease-out)",
        "transform": "translateY(-4px)"
      }
      # Add input-focus, modal-open, dropdown-toggle based on user choices
    },
    "page_transitions": {
      # IF user_specification.page_transitions.enabled == true
      "fade": {
        "duration": "var(--duration-normal)",
        "enter": "fadeIn",
        "exit": "fadeOut"
      }
      # Add slide, zoom based on user_specification.page_transitions.style
    },
    "scroll_animations": {
      # IF user_specification.scroll_animations.enabled == true
      "default": {
        "animation": "fadeIn",  # From user_specification.scroll_animations.style
        "duration": "var(--duration-slow)",
        "easing": "var(--easing-ease-out)",
        "threshold": "0.1",
        "stagger_delay": "100ms"  # From user_specification if stagger chosen
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
  - ✅ READ question-options.json if it exists (from Phase 2-3)
  - ✅ Use Write() tool immediately for both files
  - ✅ All tokens use CSS Custom Property format: var(--duration-fast)
  - ✅ Include prefers-reduced-motion media query guidance
  - ✅ Validate all cubic-bezier values are valid (4 numbers between 0-1)
  - ❌ NO user questions or interaction in this phase
  - ❌ NO external research or MCP calls
`
```

---

**Phase 4 Output**: `animation-tokens.json` + `animation-guide.md`

## Phase 5: Verify Output

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
  {content: "Question generation (agent)", status: "completed", activeForm: "Generating questions"},
  {content: "Interactive specification (user input)", status: "completed", activeForm: "Collecting user answers"},
  {content: "Animation token synthesis (agent - no interaction)", status: "completed", activeForm: "Generating tokens via agent"},
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
  {IF question_data AND question_data.user_selection:
  - ✅ User answers via interactive mode (agent-generated questions)
  }
  {IF has_design_context:
  - ✅ Aligned with existing design tokens
  }

Generated Files:
{base_path}/animation-extraction/
├── animation-tokens.json      # Production-ready animation tokens
└── animation-guide.md          # Usage guidelines and examples

{IF animations_extracted OR question_data:
Intermediate Analysis:
{base_path}/.intermediates/animation-analysis/
{IF animations_extracted:
├── animations-*.json           # Extracted CSS data ({len(url_list)} files)
}
{IF question_data:
└── question-options.json       # Generated questions + user answers
}
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
│       ├── animations-{target}.json      # Extracted CSS (auto mode)
│       └── question-options.json         # Generated questions + user answers (interactive mode)
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
- **Agent-Generated Questions** - Context-aware questions generated by agent (Phase 2)
- **User Interaction** - User answers questions in main flow (Phase 3)
- **Intelligent Fallback** - Gracefully handles extraction failures
- **Context-Aware** - Aligns with existing design tokens
- **Production-Ready** - CSS var() format, accessibility support
- **Comprehensive Coverage** - Transitions, keyframes, interactions, scroll animations
- **Separated Concerns** - Question generation (Phase 2 agent) → User answers (Phase 3) → Token generation (Phase 4 agent)

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
