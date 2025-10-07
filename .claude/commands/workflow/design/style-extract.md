---
name: style-extract
description: Extract design style from reference images or text prompts using triple vision analysis or agent mode
usage: /workflow:design:style-extract [--session <id>] [--images "<glob>"] [--prompt "<desc>"] [--variants <count>] [--use-agent]
argument-hint: "[--session WFS-xxx] [--images \"refs/*.png\"] [--prompt \"Modern minimalist\"] [--variants 3] [--use-agent]"
examples:
  - /workflow:design:style-extract --images "design-refs/*.png" --variants 3
  - /workflow:design:style-extract --prompt "Modern minimalist blog, dark theme" --variants 3 --use-agent
  - /workflow:design:style-extract --session WFS-auth --images "refs/*.png" --prompt "Linear.app style" --variants 2
allowed-tools: TodoWrite(*), Read(*), Write(*), Bash(*), Glob(*), Task(conceptual-planning-agent)
---

# Style Extraction Command

## Overview
Extract design style elements from reference images using triple vision analysis: Claude Code's native vision, Gemini Vision for semantic understanding, and Codex for structured token generation.

## Core Philosophy
- **Dual Mode Support**: Conventional triple vision OR agent-driven creative exploration
- **Flexible Input**: Images, text prompts, or both combined
- **Variant Control**: Generate N style cards based on `--variants` parameter (default: 3)
- **Consensus Synthesis**: Multi-source analysis for quality assurance
- **Style Card Output**: Reusable design direction cards for consolidation phase

## Execution Protocol

### Phase 0: Mode & Parameter Detection
```bash
# Detect execution mode
IF --use-agent:
    mode = "agent"  # Agent-driven creative exploration
ELSE:
    mode = "conventional"  # Triple vision analysis

# Detect input source
IF --images AND --prompt:
    input_mode = "hybrid"  # Text guides image analysis
ELSE IF --images:
    input_mode = "image"
ELSE IF --prompt:
    input_mode = "text"
ELSE:
    ERROR: "Must provide --images or --prompt"

# Detect session mode
IF --session:
    session_mode = "integrated"
    session_id = {provided_session}
    base_path = ".workflow/WFS-{session_id}/"
ELSE:
    session_mode = "standalone"
    session_id = "design-session-" + timestamp()
    base_path = "./{session_id}/"

# Set variant count
variants_count = --variants provided ? {count} : 3
VALIDATE: 1 <= variants_count <= 5
```

### Phase 1: Input Validation & Preparation
```bash
# Validate and prepare inputs based on input_mode
IF input_mode IN ["image", "hybrid"]:
    EXPAND: --images glob pattern to concrete paths
    VERIFY: at least one image file exists

IF input_mode IN ["text", "hybrid"]:
    VALIDATE: --prompt is non-empty string

# Create session directory structure
CREATE: {base_path}/.design/style-extraction/
```

### Phase 2: Style Extraction Execution

**Route based on mode**:

#### A. Conventional Mode (Triple Vision)
Execute if `mode == "conventional"`

**Step 1**: Claude Code initial analysis
```bash
IF input_mode IN ["image", "hybrid"]:
    FOR each image IN expanded_image_paths:
        Read({image_path})  # Claude analyzes visuals
ELSE IF input_mode == "text":
    # Analyze text prompt for design keywords
    keywords = extract_design_keywords({prompt_text})

Write({base_path}/.design/style-extraction/claude_analysis.json)
```

**Step 2**: Gemini deep semantic analysis
```bash
context_arg = ""
IF input_mode IN ["image", "hybrid"]:
    context_arg += "@{image_paths}"
IF input_mode IN ["text", "hybrid"]:
    guidance = "GUIDED BY PROMPT: '{prompt_text}'"

bash(cd {base_path}/.design/style-extraction && \
  ~/.claude/scripts/gemini-wrapper --approval-mode yolo -p "
    PURPOSE: Extract design semantics {guidance}
    TASK: Generate {variants_count} distinct style directions
    MODE: write
    CONTEXT: {context_arg}
    EXPECTED: {variants_count} style analysis variants in JSON
    RULES: OKLCH colors, semantic naming, explore diverse themes
  ")
```

**Step 3**: Codex structured token generation
```bash
bash(codex -C {base_path}/.design/style-extraction --full-auto exec "
  PURPOSE: Convert semantic analysis to structured tokens
  TASK: Generate design-tokens.json and {variants_count} style-cards
  MODE: auto
  CONTEXT: @{claude_analysis.json,gemini output}
  EXPECTED: design-tokens.json, style-cards.json with {variants_count} variants
  RULES: OKLCH format, rem spacing, semantic names
" --skip-git-repo-check -s danger-full-access)
```

#### B. Agent Mode (Creative Exploration)
Execute if `mode == "agent"`

**Agent-Driven Parallel Generation**:
```bash
# Prepare base context
context_files = ""
IF input_mode IN ["image", "hybrid"]:
    context_files += "@{image_paths}"
IF session_mode == "integrated":
    context_files += "@{../../.brainstorming/synthesis-specification.md}"

# Define creative themes for diversity
themes = generate_creative_themes(variants_count)
# Example: ["Modern Minimalist", "Brutalist Tech", "Organic Warmth"]

# Launch parallel agent tasks
FOR i IN range(variants_count):
    Task(conceptual-planning-agent): "
    [FLOW_CONTROL]

    Generate unique design style variant: '{themes[i]}'

    ## Context
    INPUT_SOURCE: {input_mode}
    PROMPT_GUIDANCE: {prompt_text if present else 'derive from images'}
    THEME_FOCUS: {themes[i]}
    OUTPUT_LOCATION: {base_path}/.design/style-extraction/

    ## Flow Steps
    1. **analyze_input**
       IF input_mode IN ['image', 'hybrid']:
           Use Gemini Vision to analyze images with theme focus
       IF input_mode IN ['text', 'hybrid']:
           Use Gemini to expand prompt into detailed design philosophy

    2. **generate_tokens**
       Use Codex to create design-tokens subset for this variant
       Output: variant-{i}-tokens.json

    3. **create_style_card**
       Synthesize into style card with:
       - id: 'variant-{i}'
       - name: '{themes[i]}'
       - preview: key design token values
       Output: variant-{i}-card.json

    ## Rules
    - Focus on '{themes[i]}' aesthetic
    - OKLCH colors, rem spacing, semantic naming
    - Must be distinct from other variants
    "

# Consolidate parallel results
Wait for all {variants_count} tasks to complete
Consolidate variant-*-card.json → style-cards.json
Merge variant-*-tokens.json → design-tokens.json (include all variants)
```

**Output**: `style-cards.json` with {variants_count} creatively distinct variants

### Phase 3: TodoWrite & Completion

```javascript
TodoWrite({
  todos: [
    {content: "Detect mode and validate inputs", status: "completed", activeForm: "Detecting mode"},
    {content: "Execute style extraction (conventional/agent mode)", status: "completed", activeForm: "Extracting styles"},
    {content: "Generate {variants_count} style cards", status: "completed", activeForm: "Generating style cards"}
  ]
});
```

**Completion Message**:
```
Style extraction complete for session: {session_id}
Mode: {mode} | Input: {input_mode} | Variants: {variants_count}

Generated {variants_count} style cards:
{list_variant_names}

Location: {base_path}/.design/style-extraction/

Next: /workflow:design:style-consolidate --session {session_id} --variants "{selected_ids}"
```

## Output Structure

```
.workflow/WFS-{session}/.design/style-extraction/
├── semantic_style_analysis.json    # Gemini Vision semantic analysis
├── design-tokens.json              # Structured CSS tokens (OKLCH)
├── tailwind-tokens.js              # Tailwind config extension
└── style-cards.json                # Style variants for user selection
```

### style-cards.json Format
```json
{
  "style_cards": [
    {
      "id": "variant-1",
      "name": "Modern Minimalist",
      "description": "Clean, high contrast with bold typography",
      "preview": {
        "primary": "oklch(0.45 0.20 270 / 1)",
        "background": "oklch(0.98 0.01 270 / 1)",
        "font_heading": "Inter, system-ui, sans-serif",
        "border_radius": "0.5rem"
      }
    },
    {
      "id": "variant-2",
      "name": "Soft Neumorphic",
      "description": "Subtle shadows with gentle colors",
      "preview": {
        "primary": "oklch(0.60 0.10 200 / 1)",
        "background": "oklch(0.95 0.02 200 / 1)",
        "font_heading": "Poppins, sans-serif",
        "border_radius": "1rem"
      }
    }
  ]
}
```

## Error Handling
- **No images found**: Report error and suggest correct glob pattern
- **Gemini Vision failure**: Retry once, then fall back to manual style description
- **Codex token generation failure**: Use default token template and report warning
- **Invalid session**: Prompt user to start workflow session first

## Integration Points
- **Input**: Reference images (PNG, JPG, WebP)
- **Output**: Style cards for `/workflow:design:style-consolidate`
- **Context**: Optional synthesis-specification.md or ui-designer/analysis.md

## Next Steps
After successful extraction:
```
Style extraction complete for session: WFS-{session}
Style cards generated: {count}

Next: /workflow:design:style-consolidate --session WFS-{session} [--interactive]
```
