---
name: extract
description: Extract design style from reference images or text prompts using Claude's analysis
usage: /workflow:ui-design:extract [--session <id>] [--images "<glob>"] [--prompt "<desc>"] [--variants <count>]
argument-hint: "[--session WFS-xxx] [--images \"refs/*.png\"] [--prompt \"Modern minimalist\"] [--variants 3]"
examples:
  - /workflow:ui-design:extract --images "design-refs/*.png" --variants 3
  - /workflow:ui-design:extract --prompt "Modern minimalist blog, dark theme" --variants 3
  - /workflow:ui-design:extract --session WFS-auth --images "refs/*.png" --prompt "Linear.app style" --variants 2
allowed-tools: TodoWrite(*), Read(*), Write(*), Glob(*)
---

# Style Extraction Command

## Overview
Extract design style elements from reference images or text prompts using Claude's built-in analysis capabilities. Generates a single, comprehensive `style-cards.json` file containing multiple design variants with complete token proposals.

## Core Philosophy
- **Claude-Native**: 100% Claude-driven analysis, no external tools
- **Single Output**: Only `style-cards.json` with embedded token proposals
- **Sequential Execution**: Generate multiple style variants in one pass
- **Flexible Input**: Images, text prompts, or both
- **Reproducible**: Deterministic output structure

## Execution Protocol

### Phase 0: Parameter Detection & Validation
```bash
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
variants_count = --variants provided ? {count} : 1
VALIDATE: 1 <= variants_count <= 5
```

### Phase 1: Input Loading & Validation
```bash
# Expand and validate inputs
IF input_mode IN ["image", "hybrid"]:
    expanded_images = Glob({--images pattern})
    VERIFY: expanded_images.length > 0
    FOR each image IN expanded_images:
        image_data[i] = Read({image_path})  # Load for analysis

IF input_mode IN ["text", "hybrid"]:
    VALIDATE: --prompt is non-empty string
    prompt_guidance = {--prompt value}

# Create output directory
CREATE: {base_path}/.design/style-extraction/
```

### Phase 2: Unified Style Analysis (Claude)
This is a single-pass analysis that replaces all external tool calls.

**Analysis Prompt Template**:
```
Analyze the following design references and generate {variants_count} distinct design style proposals.

INPUT MODE: {input_mode}

{IF input_mode IN ["image", "hybrid"]}
VISUAL REFERENCES: {list of loaded images}
Identify: color palettes, typography patterns, spacing rhythms, visual hierarchy, component styles
{ENDIF}

{IF input_mode IN ["text", "hybrid"]}
TEXT GUIDANCE: "{prompt_guidance}"
Use this to guide the aesthetic direction and feature requirements
{ENDIF}

TASK: Generate {variants_count} design style variants that:
1. Each have a distinct visual identity and design philosophy
2. Use OKLCH color space for all color values
3. Include complete, production-ready design token proposals
4. Are semantically organized (brand, surface, semantic colors)

OUTPUT FORMAT: JSON matching this exact structure:
{
  "extraction_metadata": {
    "session_id": "{session_id}",
    "input_mode": "{input_mode}",
    "timestamp": "{ISO timestamp}",
    "variants_count": {variants_count}
  },
  "style_cards": [
    {
      "id": "variant-1",
      "name": "Concise Style Name (e.g., Modern Minimalist)",
      "description": "2-3 sentence description of this style's visual language and user experience",
      "design_philosophy": "Core design principles for this variant",
      "preview": {
        "primary": "oklch(0.45 0.20 270 / 1)",
        "background": "oklch(0.98 0.01 270 / 1)",
        "font_heading": "Inter, system-ui, sans-serif",
        "border_radius": "0.5rem"
      },
      "proposed_tokens": {
        "colors": {
          "brand": {
            "primary": "oklch(0.45 0.20 270 / 1)",
            "secondary": "oklch(0.60 0.15 320 / 1)",
            "accent": "oklch(0.70 0.18 150 / 1)"
          },
          "surface": {
            "background": "oklch(0.98 0.01 270 / 1)",
            "elevated": "oklch(1.00 0.00 0 / 1)",
            "overlay": "oklch(0.95 0.01 270 / 1)"
          },
          "semantic": {
            "success": "oklch(0.60 0.15 142 / 1)",
            "warning": "oklch(0.75 0.12 85 / 1)",
            "error": "oklch(0.55 0.22 27 / 1)",
            "info": "oklch(0.55 0.18 252 / 1)"
          },
          "text": {
            "primary": "oklch(0.20 0.01 270 / 1)",
            "secondary": "oklch(0.45 0.01 270 / 1)",
            "tertiary": "oklch(0.60 0.01 270 / 1)",
            "inverse": "oklch(0.95 0.01 270 / 1)"
          },
          "border": {
            "default": "oklch(0.85 0.01 270 / 1)",
            "strong": "oklch(0.70 0.01 270 / 1)",
            "subtle": "oklch(0.92 0.01 270 / 1)"
          }
        },
        "typography": {
          "font_family": {
            "heading": "Inter, system-ui, sans-serif",
            "body": "Inter, system-ui, sans-serif",
            "mono": "JetBrains Mono, Consolas, monospace"
          },
          "font_size": {
            "xs": "0.75rem",
            "sm": "0.875rem",
            "base": "1rem",
            "lg": "1.125rem",
            "xl": "1.25rem",
            "2xl": "1.5rem",
            "3xl": "1.875rem",
            "4xl": "2.25rem"
          },
          "font_weight": {
            "normal": "400",
            "medium": "500",
            "semibold": "600",
            "bold": "700"
          },
          "line_height": {
            "tight": "1.25",
            "normal": "1.5",
            "relaxed": "1.75"
          },
          "letter_spacing": {
            "tight": "-0.025em",
            "normal": "0",
            "wide": "0.025em"
          }
        },
        "spacing": {
          "0": "0",
          "1": "0.25rem",
          "2": "0.5rem",
          "3": "0.75rem",
          "4": "1rem",
          "5": "1.25rem",
          "6": "1.5rem",
          "8": "2rem",
          "10": "2.5rem",
          "12": "3rem",
          "16": "4rem",
          "20": "5rem",
          "24": "6rem"
        },
        "border_radius": {
          "none": "0",
          "sm": "0.25rem",
          "md": "0.5rem",
          "lg": "0.75rem",
          "xl": "1rem",
          "full": "9999px"
        },
        "shadows": {
          "sm": "0 1px 2px oklch(0.00 0.00 0 / 0.05)",
          "md": "0 4px 6px oklch(0.00 0.00 0 / 0.07)",
          "lg": "0 10px 15px oklch(0.00 0.00 0 / 0.10)",
          "xl": "0 20px 25px oklch(0.00 0.00 0 / 0.15)"
        },
        "breakpoints": {
          "sm": "640px",
          "md": "768px",
          "lg": "1024px",
          "xl": "1280px",
          "2xl": "1536px"
        }
      }
    }
  ]
}

RULES:
- Each variant must be distinct in visual character
- All colors MUST use OKLCH format: oklch(L C H / A)
- Token structures must be complete and production-ready
- Use semantic naming throughout
- Ensure accessibility (contrast ratios, readable font sizes)
```

### Phase 3: Generate & Write Output
```bash
# Parse Claude's JSON response
style_cards_data = parse_json(claude_response)

# Write single output file
Write({
  file_path: "{base_path}/.design/style-extraction/style-cards.json",
  content: style_cards_data
})
```

### Phase 4: TodoWrite & Completion
```javascript
TodoWrite({
  todos: [
    {content: "Validate inputs and create directories", status: "completed", activeForm: "Validating inputs"},
    {content: "Analyze design references with Claude", status: "completed", activeForm: "Analyzing design"},
    {content: "Generate {variants_count} style cards with token proposals", status: "completed", activeForm: "Generating style cards"}
  ]
});
```

**Completion Message**:
```
✅ Style extraction complete for session: {session_id}

Input mode: {input_mode}
{IF image mode: Images analyzed: {count}}
{IF prompt mode: Prompt: "{truncated_prompt}"}

Generated {variants_count} style variant(s):
{FOR each card: - {card.name} ({card.id})}

📂 Output: {base_path}/.design/style-extraction/style-cards.json

Next: /workflow:ui-design:consolidate --session {session_id} --variants "{all_variant_ids}"

Note: When called from /workflow:ui-design:auto, consolidation is triggered automatically.
```

## Output Structure

```
.workflow/WFS-{session}/.design/style-extraction/
└── style-cards.json    # Single comprehensive output
```

### style-cards.json Format (Enhanced)
```json
{
  "extraction_metadata": {
    "session_id": "WFS-xxx or design-session-xxx",
    "input_mode": "image|text|hybrid",
    "timestamp": "2025-01-15T10:30:00Z",
    "variants_count": 3
  },
  "style_cards": [
    {
      "id": "variant-1",
      "name": "Modern Minimalist",
      "description": "Clean, high-contrast design with bold typography and ample whitespace",
      "design_philosophy": "Less is more - focus on content clarity and visual breathing room",
      "preview": {
        "primary": "oklch(0.45 0.20 270 / 1)",
        "background": "oklch(0.98 0.01 270 / 1)",
        "font_heading": "Inter, system-ui, sans-serif",
        "border_radius": "0.5rem"
      },
      "proposed_tokens": {
        "colors": { /* complete color system */ },
        "typography": { /* complete typography system */ },
        "spacing": { /* complete spacing scale */ },
        "border_radius": { /* border radius scale */ },
        "shadows": { /* shadow system */ },
        "breakpoints": { /* responsive breakpoints */ }
      }
    }
  ]
}
```

## Error Handling
- **No images found**: Report glob pattern and suggest corrections
- **Invalid prompt**: Require non-empty string for text mode
- **Claude JSON parsing error**: Retry with stricter format instructions
- **Invalid session**: Create standalone session automatically

## Key Improvements Over Previous Version

1. **Zero External Dependencies**: No `gemini-wrapper`, no `codex` - pure Claude
2. **Single Output File**: Eliminates `semantic_style_analysis.json`, `design-tokens.json`, `tailwind-tokens.js` clutter
3. **Complete Token Proposals**: Each style card contains a full design system proposal
4. **Reproducible**: Same inputs = same output structure (content may vary based on Claude model)
5. **Streamlined Flow**: `Input → Analysis → style-cards.json` (3 steps vs 7+ previously)

## Integration Points
- **Input**: Reference images (PNG, JPG, WebP) or text prompts
- **Output**: `style-cards.json` for `/workflow:ui-design:consolidate`
- **Context**: Optional `synthesis-specification.md` or `ui-designer/analysis.md` can guide prompts
