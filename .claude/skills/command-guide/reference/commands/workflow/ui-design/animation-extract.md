---
name: animation-extract
description: Extract animation and transition patterns from URLs, CSS, or interactive questioning for design system documentation
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

### Step 2: Generate Animation Questions (Main Flow)

```bash
# If extraction failed or insufficient, use interactive questioning
IF extraction_insufficient OR extraction_mode == "interactive":
    REPORT: "🤔 Interactive animation specification mode"
    REPORT: "   Context: {has_design_context ? 'Aligning with design tokens' : 'Standalone animation system'}"
    REPORT: "   Focus: {focus_types}"

    # Determine question categories based on focus_types
    question_categories = []
    IF "all" IN focus_types OR "transitions" IN focus_types:
        question_categories.append("timing_scale")
        question_categories.append("easing_philosophy")

    IF "all" IN focus_types OR "interactions" IN focus_types OR "hover" IN focus_types:
        question_categories.append("button_interactions")
        question_categories.append("card_interactions")
        question_categories.append("input_interactions")

    IF "all" IN focus_types OR "page" IN focus_types:
        question_categories.append("page_transitions")

    IF "all" IN focus_types OR "loading" IN focus_types:
        question_categories.append("loading_states")

    IF "all" IN focus_types OR "scroll" IN focus_types:
        question_categories.append("scroll_animations")
```

### Step 3: Output Questions in Text Format (Main Flow)

```markdown
# Generate and output structured questions
REPORT: ""
REPORT: "===== 动画规格交互式配置 ====="
REPORT: ""

question_number = 1
questions_output = []

# Q1: Timing Scale (if included)
IF "timing_scale" IN question_categories:
    REPORT: "【问题{question_number} - 时间尺度】您的设计需要什么样的过渡速度？"
    REPORT: "a) 快速敏捷"
    REPORT: "   说明：100-200ms 过渡，适合工具型应用和即时反馈场景"
    REPORT: "b) 平衡适中"
    REPORT: "   说明：200-400ms 过渡，通用选择，符合多数用户预期"
    REPORT: "c) 流畅舒缓"
    REPORT: "   说明：400-600ms 过渡，适合品牌展示和沉浸式体验"
    REPORT: "d) 自定义"
    REPORT: "   说明：需要指定具体数值和使用场景"
    REPORT: ""
    questions_output.append({id: question_number, category: "timing_scale", options: ["a", "b", "c", "d"]})
    question_number += 1

# Q2: Easing Philosophy (if included)
IF "easing_philosophy" IN question_categories:
    REPORT: "【问题{question_number} - 缓动风格】哪种缓动曲线符合您的品牌调性？"
    REPORT: "a) 线性匀速"
    REPORT: "   说明：恒定速度，技术感和精确性，适合数据可视化"
    REPORT: "b) 快入慢出"
    REPORT: "   说明：快速启动自然减速，最接近物理世界，通用推荐"
    REPORT: "c) 慢入慢出"
    REPORT: "   说明：平滑对称，精致优雅，适合高端品牌"
    REPORT: "d) 弹性效果"
    REPORT: "   说明：Spring/Bounce 回弹，活泼现代，适合互动性强的应用"
    REPORT: ""
    questions_output.append({id: question_number, category: "easing_philosophy", options: ["a", "b", "c", "d"]})
    question_number += 1

# Q3-5: Interaction Animations (button, card, input - if included)
IF "button_interactions" IN question_categories:
    REPORT: "【问题{question_number} - 按钮交互】按钮悬停/点击时如何反馈？"
    REPORT: "a) 微妙变化"
    REPORT: "   说明：仅颜色/透明度变化，适合简约设计"
    REPORT: "b) 抬升效果"
    REPORT: "   说明：轻微缩放+阴影加深，增强物理感知"
    REPORT: "c) 滑动移位"
    REPORT: "   说明：Transform translateY，视觉引导明显"
    REPORT: "d) 无动画"
    REPORT: "   说明：静态交互，性能优先或特定品牌要求"
    REPORT: ""
    questions_output.append({id: question_number, category: "button_interactions", options: ["a", "b", "c", "d"]})
    question_number += 1

IF "card_interactions" IN question_categories:
    REPORT: "【问题{question_number} - 卡片交互】卡片悬停时的动画效果？"
    REPORT: "a) 阴影加深"
    REPORT: "   说明：Box-shadow 变化，层次感增强"
    REPORT: "b) 上浮效果"
    REPORT: "   说明：Transform translateY(-4px)，明显的空间层次"
    REPORT: "c) 缩放放大"
    REPORT: "   说明：Scale(1.02)，突出焦点内容"
    REPORT: "d) 无动画"
    REPORT: "   说明：静态卡片，性能或设计考量"
    REPORT: ""
    questions_output.append({id: question_number, category: "card_interactions", options: ["a", "b", "c", "d"]})
    question_number += 1

IF "input_interactions" IN question_categories:
    REPORT: "【问题{question_number} - 表单交互】输入框是否需要微交互反馈？"
    REPORT: "a) 聚焦动画"
    REPORT: "   说明：边框/阴影过渡，清晰的状态指示"
    REPORT: "b) 错误抖动"
    REPORT: "   说明：水平shake动画，错误提示更明显"
    REPORT: "c) 成功勾选"
    REPORT: "   说明：Checkmark 动画，完成反馈"
    REPORT: "d) 全部包含"
    REPORT: "   说明：聚焦+错误+成功的完整反馈体系"
    REPORT: "e) 无微交互"
    REPORT: "   说明：标准表单，无额外动画"
    REPORT: ""
    questions_output.append({id: question_number, category: "input_interactions", options: ["a", "b", "c", "d", "e"]})
    question_number += 1

# Q6: Page Transitions (if included)
IF "page_transitions" IN question_categories:
    REPORT: "【问题{question_number} - 页面过渡】页面/路由切换是否需要过渡动画？"
    REPORT: "a) 淡入淡出"
    REPORT: "   说明：Crossfade 效果，平滑过渡不突兀"
    REPORT: "b) 滑动切换"
    REPORT: "   说明：Swipe left/right，方向性导航"
    REPORT: "c) 缩放过渡"
    REPORT: "   说明：Scale in/out，空间层次感"
    REPORT: "d) 无过渡"
    REPORT: "   说明：即时切换，性能优先"
    REPORT: ""
    questions_output.append({id: question_number, category: "page_transitions", options: ["a", "b", "c", "d"]})
    question_number += 1

# Q7: Loading States (if included)
IF "loading_states" IN question_categories:
    REPORT: "【问题{question_number} - 加载状态】加载时使用何种动画风格？"
    REPORT: "a) 旋转加载器"
    REPORT: "   说明：Spinner 圆形旋转，通用加载指示"
    REPORT: "b) 脉冲闪烁"
    REPORT: "   说明：Opacity pulse，轻量级反馈"
    REPORT: "c) 骨架屏"
    REPORT: "   说明：Shimmer effect，内容占位预览"
    REPORT: "d) 进度条"
    REPORT: "   说明：Linear fill，进度量化展示"
    REPORT: ""
    questions_output.append({id: question_number, category: "loading_states", options: ["a", "b", "c", "d"]})
    question_number += 1

# Q8: Scroll Animations (if included)
IF "scroll_animations" IN question_categories:
    REPORT: "【问题{question_number} - 滚动动画】元素是否在滚动时触发动画？"
    REPORT: "a) 淡入出现"
    REPORT: "   说明：Opacity 0→1，渐进式内容呈现"
    REPORT: "b) 上滑出现"
    REPORT: "   说明：TranslateY + fade，方向性引导"
    REPORT: "c) 缩放淡入"
    REPORT: "   说明：Scale 0.9→1 + fade，聚焦效果"
    REPORT: "d) 交错延迟"
    REPORT: "   说明：Stagger 序列动画，列表渐次呈现"
    REPORT: "e) 无滚动动画"
    REPORT: "   说明：静态内容，性能或可访问性考量"
    REPORT: ""
    questions_output.append({id: question_number, category: "scroll_animations", options: ["a", "b", "c", "d", "e"]})
    question_number += 1

REPORT: "支持格式："
REPORT: "- 空格分隔：1a 2b 3c"
REPORT: "- 逗号分隔：1a,2b,3c"
REPORT: "- 自由组合：1a 2b,3c"
REPORT: ""
REPORT: "请输入您的选择："
```

### Step 4: Wait for User Input (Main Flow)

```javascript
# Wait for user input
user_raw_input = WAIT_FOR_USER_INPUT()

# Store raw input for debugging
REPORT: "收到输入: {user_raw_input}"
```

### Step 5: Parse User Answers (Main Flow)

```javascript
# Intelligent input parsing (support multiple formats)
answers = {}

# Parse input using intelligent matching
# Support formats: "1a 2b 3c", "1a,2b,3c", "1a 2b,3c"
parsed_responses = PARSE_USER_INPUT(user_raw_input, questions_output)

# Validate parsing
IF parsed_responses.is_valid:
    # Map question numbers to categories
    FOR response IN parsed_responses.answers:
        question_id = response.question_id
        selected_option = response.option

        # Find category for this question
        FOR question IN questions_output:
            IF question.id == question_id:
                category = question.category
                answers[category] = selected_option
                REPORT: "✅ 问题{question_id} ({category}): 选择 {selected_option}"
                break
ELSE:
    REPORT: "❌ 输入格式无法识别，请参考格式示例重新输入："
    REPORT: "   示例：1a 2b 3c 4d"
    # Return to Step 3 for re-input
    GOTO Step 3
```

### Step 6: Write Animation Specification (Main Flow)

```javascript
# Map user choices to specification structure
specification = {
    "metadata": {
        "source": "interactive",
        "timestamp": NOW(),
        "focus_types": focus_types,
        "has_design_context": has_design_context
    },
    "timing_scale": MAP_TIMING_SCALE(answers.timing_scale),
    "easing_philosophy": MAP_EASING_PHILOSOPHY(answers.easing_philosophy),
    "interactions": {
        "button": MAP_BUTTON_INTERACTION(answers.button_interactions),
        "card": MAP_CARD_INTERACTION(answers.card_interactions),
        "input": MAP_INPUT_INTERACTION(answers.input_interactions)
    },
    "page_transitions": MAP_PAGE_TRANSITIONS(answers.page_transitions),
    "loading_animations": MAP_LOADING_STATES(answers.loading_states),
    "scroll_animations": MAP_SCROLL_ANIMATIONS(answers.scroll_animations)
}

# Mapping functions (inline logic)
FUNCTION MAP_TIMING_SCALE(option):
    SWITCH option:
        CASE "a": RETURN {scale: "fast", base_duration: "150ms", range: "100-200ms"}
        CASE "b": RETURN {scale: "balanced", base_duration: "300ms", range: "200-400ms"}
        CASE "c": RETURN {scale: "smooth", base_duration: "500ms", range: "400-600ms"}
        CASE "d": RETURN {scale: "custom", base_duration: "300ms", note: "User to provide values"}

FUNCTION MAP_EASING_PHILOSOPHY(option):
    SWITCH option:
        CASE "a": RETURN {style: "linear", curve: "linear"}
        CASE "b": RETURN {style: "ease-out", curve: "cubic-bezier(0, 0, 0.2, 1)"}
        CASE "c": RETURN {style: "ease-in-out", curve: "cubic-bezier(0.4, 0, 0.2, 1)"}
        CASE "d": RETURN {style: "spring", curve: "cubic-bezier(0.34, 1.56, 0.64, 1)"}

FUNCTION MAP_BUTTON_INTERACTION(option):
    SWITCH option:
        CASE "a": RETURN {type: "subtle", properties: ["color", "background-color", "opacity"]}
        CASE "b": RETURN {type: "lift", properties: ["transform", "box-shadow"], transform: "scale(1.02)"}
        CASE "c": RETURN {type: "slide", properties: ["transform"], transform: "translateY(-2px)"}
        CASE "d": RETURN {type: "none", properties: []}

FUNCTION MAP_CARD_INTERACTION(option):
    SWITCH option:
        CASE "a": RETURN {type: "shadow", properties: ["box-shadow"]}
        CASE "b": RETURN {type: "float", properties: ["transform", "box-shadow"], transform: "translateY(-4px)"}
        CASE "c": RETURN {type: "scale", properties: ["transform"], transform: "scale(1.02)"}
        CASE "d": RETURN {type: "none", properties: []}

FUNCTION MAP_INPUT_INTERACTION(option):
    SWITCH option:
        CASE "a": RETURN {enabled: ["focus"], focus: {properties: ["border-color", "box-shadow"]}}
        CASE "b": RETURN {enabled: ["error"], error: {animation: "shake", keyframes: "translateX"}}
        CASE "c": RETURN {enabled: ["success"], success: {animation: "checkmark", keyframes: "draw"}}
        CASE "d": RETURN {enabled: ["focus", "error", "success"]}
        CASE "e": RETURN {enabled: []}

FUNCTION MAP_PAGE_TRANSITIONS(option):
    SWITCH option:
        CASE "a": RETURN {enabled: true, style: "fade", animation: "fadeIn/fadeOut"}
        CASE "b": RETURN {enabled: true, style: "slide", animation: "slideLeft/slideRight"}
        CASE "c": RETURN {enabled: true, style: "zoom", animation: "zoomIn/zoomOut"}
        CASE "d": RETURN {enabled: false}

FUNCTION MAP_LOADING_STATES(option):
    SWITCH option:
        CASE "a": RETURN {style: "spinner", animation: "rotate", keyframes: "360deg"}
        CASE "b": RETURN {style: "pulse", animation: "pulse", keyframes: "opacity"}
        CASE "c": RETURN {style: "skeleton", animation: "shimmer", keyframes: "gradient-shift"}
        CASE "d": RETURN {style: "progress", animation: "fill", keyframes: "width"}

FUNCTION MAP_SCROLL_ANIMATIONS(option):
    SWITCH option:
        CASE "a": RETURN {enabled: true, style: "fade", animation: "fadeIn"}
        CASE "b": RETURN {enabled: true, style: "slideUp", animation: "slideUp", transform: "translateY(20px)"}
        CASE "c": RETURN {enabled: true, style: "scaleIn", animation: "scaleIn", transform: "scale(0.9)"}
        CASE "d": RETURN {enabled: true, style: "stagger", animation: "fadeIn", stagger_delay: "100ms"}
        CASE "e": RETURN {enabled: false}

# Write specification file
output_path = "{base_path}/.intermediates/animation-analysis/animation-specification.json"
Write(output_path, JSON.stringify(specification, indent=2))

REPORT: "✅ Animation specification saved to {output_path}"
REPORT: "   Proceeding to token synthesis..."
```

---

**Phase 2 Output**: `animation-specification.json` (user preferences)

## Phase 3: Animation Token Synthesis (Agent - No User Interaction)

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

user_specification = null
IF exists({base_path}/.intermediates/animation-analysis/animation-specification.json):
    user_specification = Read(file)
    REPORT: "✅ Loaded user specification from Phase 2"
ELSE:
    REPORT: "⚠️ No user specification found - using extracted CSS only"

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

  2. **User Specification** (REQUIRED if Phase 2 ran):
     File: {base_path}/.intermediates/animation-analysis/animation-specification.json
     ${user_specification ? "Status: ✅ Found - READ this file for user choices" : "Status: ⚠️ Not found - use CSS extraction only"}

  3. **Design Tokens Context** (for alignment):
     ${design_tokens ? JSON.stringify(design_tokens) : "None - standalone animation system"}

  ## Synthesis Rules

  ### Priority System
  1. User specification from animation-specification.json (highest priority)
  2. Extracted CSS values from animations-*.json (medium priority)
  3. Industry best practices (fallback)

  ### Duration Normalization
  - IF user_specification.timing_scale EXISTS:
      Use user's chosen scale (fast/balanced/smooth/custom)
  - ELSE IF extracted CSS durations available:
      Cluster extracted durations into 3-5 semantic scales
  - ELSE:
      Use standard scale (instant:0ms, fast:150ms, normal:300ms, slow:500ms, very-slow:800ms)
  - Align with design token spacing scale if available

  ### Easing Standardization
  - IF user_specification.easing_philosophy EXISTS:
      Use user's chosen philosophy (linear/ease-out/ease-in-out/spring)
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

  ### User Specification Integration
  IF user_specification EXISTS:
    - Map user choices to token values:
      * timing_scale → duration values
      * easing_philosophy → easing curves
      * interactions.button → interactions.button-hover token
      * interactions.card → interactions.card-hover token
      * interactions.input → micro-interaction tokens
      * page_transitions → page_transitions tokens
      * loading_animations → loading state tokens
      * scroll_animations → scroll_animations tokens

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
  - ✅ READ animation-specification.json if it exists (from Phase 2)
  - ✅ Use Write() tool immediately for both files
  - ✅ All tokens use CSS Custom Property format: var(--duration-fast)
  - ✅ Include prefers-reduced-motion media query guidance
  - ✅ Validate all cubic-bezier values are valid (4 numbers between 0-1)
  - ❌ NO user questions or interaction in this phase
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
  {content: "Interactive specification (main flow)", status: "completed", activeForm: "Collecting user input in main flow"},
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
  {IF user_specification:
  - ✅ User specification via interactive mode (main flow)
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
- **Main Flow Interaction** - User questions in main flow, agent only for token synthesis
- **Intelligent Fallback** - Gracefully handles extraction failures
- **Context-Aware** - Aligns with existing design tokens
- **Production-Ready** - CSS var() format, accessibility support
- **Comprehensive Coverage** - Transitions, keyframes, interactions, scroll animations
- **Separated Concerns** - User decisions (Phase 2 main flow) → Token generation (Phase 3 agent)

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
