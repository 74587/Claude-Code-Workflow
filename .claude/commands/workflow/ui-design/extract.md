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
- **Flexible Input**: Images, text prompts, or both (hybrid mode)
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

# Detect session mode and generate run ID
run_id = "run-" + timestamp()

IF --session:
    session_mode = "integrated"
    session_id = {provided_session}
    base_path = ".workflow/WFS-{session_id}/design-{run_id}/"
ELSE:
    session_mode = "standalone"
    base_path = ".workflow/.design/{run_id}/"

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
CREATE: {base_path}/style-extraction/
```

### Phase 1.5: Design Trend Research (Exa MCP)

```bash
# Step 1: Load project context to inform search queries
project_context = ""
IF exists({base_path}/.brainstorming/synthesis-specification.md):
    project_context = Read({base_path}/.brainstorming/synthesis-specification.md)
ELSE IF exists({base_path}/.brainstorming/ui-designer/analysis.md):
    project_context = Read({base_path}/.brainstorming/ui-designer/analysis.md)

# Extract hints from context and prompt
search_hints = []
IF prompt_guidance:
    search_hints.append(extract_design_keywords(prompt_guidance))  # e.g., "minimalist", "dark theme", "Linear.app"
IF project_context:
    search_hints.append(extract_project_type(project_context))     # e.g., "dashboard", "SaaS", "blog"

# Step 2: Search for design trends using Exa MCP
REPORT: "🔍 Researching modern design trends and color theory..."

# Build comprehensive search query
exa_queries = [
    "modern UI design color palettes trends 2024 2025 {search_hints}",
    "typography web design best practices system fonts {search_hints}",
    "design system color theory accessibility WCAG {search_hints}",
    "UI spacing rhythm layout patterns {search_hints}"
]

design_trends = {}
FOR query IN exa_queries:
    category = identify_category(query)  # "colors", "typography", "layout", "accessibility"
    design_trends[category] = mcp__exa__get_code_context_exa(
        query=query,
        tokensNum="dynamic"
    )

REPORT: "✅ Design research complete. Found trends for: colors, typography, layout, accessibility"
```

### Phase 2: Unified Style Analysis (Claude with Design Trends)

This is a single-pass analysis that replaces all external tool calls.

**Analysis Prompt Template**:
```
Analyze the following design references and generate {variants_count} distinct design style proposals informed by current design trends.

INPUT MODE: {input_mode}

{IF input_mode IN ["image", "hybrid"]}
VISUAL REFERENCES: {list of loaded images}
Identify: color palettes, typography patterns, spacing rhythms, visual hierarchy, component styles
{ENDIF}

{IF input_mode IN ["text", "hybrid"]}
TEXT GUIDANCE: "{prompt_guidance}"
Use this to guide the aesthetic direction and feature requirements
{ENDIF}

DESIGN TRENDS RESEARCH (from web, 2024-2025):

COLOR TRENDS:
{design_trends.colors}

TYPOGRAPHY TRENDS:
{design_trends.typography}

LAYOUT PATTERNS:
{design_trends.layout}

ACCESSIBILITY GUIDELINES:
{design_trends.accessibility}

TASK: Generate {variants_count} design style variants that:
1. Each have a distinct visual identity and design philosophy
2. Incorporate modern design trends from the research above (2024-2025)
3. Balance trend awareness with timeless design principles
4. Use OKLCH color space for all color values
5. Include complete, production-ready design token proposals
6. Are semantically organized (brand, surface, semantic colors)
7. Apply current accessibility best practices from WCAG guidelines

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
        "primary": "oklch(...)",
        "background": "oklch(...)",
        "font_heading": "Font name, fallbacks",
        "border_radius": "value"
      },
      "proposed_tokens": {
        "colors": {
          "brand": { "primary": "oklch(...)", "secondary": "oklch(...)", "accent": "oklch(...)" },
          "surface": { "background": "oklch(...)", "elevated": "oklch(...)", "overlay": "oklch(...)" },
          "semantic": { "success": "oklch(...)", "warning": "oklch(...)", "error": "oklch(...)", "info": "oklch(...)" },
          "text": { "primary": "oklch(...)", "secondary": "oklch(...)", "tertiary": "oklch(...)", "inverse": "oklch(...)" },
          "border": { "default": "oklch(...)", "strong": "oklch(...)", "subtle": "oklch(...)" }
        },
        "typography": {
          "font_family": { "heading": "...", "body": "...", "mono": "..." },
          "font_size": { "xs": "...", "sm": "...", "base": "...", "lg": "...", "xl": "...", "2xl": "...", "3xl": "...", "4xl": "..." },
          "font_weight": { "normal": "400", "medium": "500", "semibold": "600", "bold": "700" },
          "line_height": { "tight": "1.25", "normal": "1.5", "relaxed": "1.75" },
          "letter_spacing": { "tight": "-0.025em", "normal": "0", "wide": "0.025em" }
        },
        "spacing": { "0": "0", "1": "0.25rem", "2": "0.5rem", ..., "24": "6rem" },
        "border_radius": { "none": "0", "sm": "0.25rem", ..., "full": "9999px" },
        "shadows": { "sm": "...", "md": "...", "lg": "...", "xl": "..." },
        "breakpoints": { "sm": "640px", "md": "768px", "lg": "1024px", "xl": "1280px", "2xl": "1536px" }
      }
    },
    // Repeat for variants_count total
  ]
}

RULES:
- Each variant must be distinct in visual character
- Incorporate insights from DESIGN TRENDS RESEARCH into color, typography, and spacing choices
- Balance modern trends with timeless design principles
- All colors MUST use OKLCH format: oklch(L C H / A)
- Token structures must be complete and production-ready
- Use semantic naming throughout (e.g., "brand-primary" not "color-1")
- Ensure accessibility (WCAG AA contrast ratios: 4.5:1 text, 3:1 UI) using guidelines from research
- Apply modern typography trends (variable fonts, system font stacks, optical sizing)
- Include complete token categories for each variant
- Reference specific trends or patterns from the research when making design decisions
```

### Phase 3: Parse & Write Output

```bash
# Parse Claude's JSON response
style_cards_data = parse_json(claude_response)

# Write single output file
Write({
  file_path: "{base_path}/style-extraction/style-cards.json",
  content: style_cards_data
})
```

### Phase 4: Completion

```javascript
TodoWrite({
  todos: [
    {content: "Validate inputs and create directories", status: "completed", activeForm: "Validating inputs"},
    {content: "Research modern design trends with Exa MCP", status: "completed", activeForm: "Researching design trends"},
    {content: "Analyze design references with Claude", status: "completed", activeForm: "Analyzing design"},
    {content: `Generate ${variants_count} style cards with token proposals`, status: "completed", activeForm: "Generating style cards"}
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

📂 Output: {base_path}/style-extraction/style-cards.json

Next: /workflow:ui-design:consolidate --session {session_id} --variants {variants_count}

Note: When called from /workflow:ui-design:auto, consolidation is triggered automatically.
```

## Output Structure

```
.workflow/WFS-{session}/design-{run_id}/style-extraction/
└── style-cards.json    # Single comprehensive output

OR (standalone mode):

.workflow/.design/{run_id}/style-extraction/
└── style-cards.json    # Single comprehensive output
```

### style-cards.json Format

Complete structure with example values:

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
      "description": "Clean, high-contrast design with bold typography and ample whitespace. Focuses on content clarity with minimal visual noise.",
      "design_philosophy": "Less is more - prioritize content clarity and visual breathing room over decorative elements",
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
    },
    {
      "id": "variant-2",
      "name": "Bold Vibrant",
      "description": "High-energy design with saturated colors and strong visual hierarchy. Creates excitement and demands attention.",
      "design_philosophy": "Make a statement - use color and contrast to create memorable, energetic experiences",
      "preview": {
        "primary": "oklch(0.50 0.25 330 / 1)",
        "background": "oklch(0.15 0.02 270 / 1)",
        "font_heading": "Poppins, system-ui, sans-serif",
        "border_radius": "0.75rem"
      },
      "proposed_tokens": {
        "colors": {
          "brand": {
            "primary": "oklch(0.50 0.25 330 / 1)",
            "secondary": "oklch(0.65 0.22 60 / 1)",
            "accent": "oklch(0.70 0.20 180 / 1)"
          },
          "surface": {
            "background": "oklch(0.15 0.02 270 / 1)",
            "elevated": "oklch(0.20 0.02 270 / 1)",
            "overlay": "oklch(0.25 0.02 270 / 1)"
          },
          "semantic": {
            "success": "oklch(0.65 0.18 140 / 1)",
            "warning": "oklch(0.70 0.15 80 / 1)",
            "error": "oklch(0.60 0.25 25 / 1)",
            "info": "oklch(0.60 0.20 250 / 1)"
          },
          "text": {
            "primary": "oklch(0.95 0.01 270 / 1)",
            "secondary": "oklch(0.75 0.01 270 / 1)",
            "tertiary": "oklch(0.60 0.01 270 / 1)",
            "inverse": "oklch(0.20 0.01 270 / 1)"
          },
          "border": {
            "default": "oklch(0.35 0.02 270 / 1)",
            "strong": "oklch(0.50 0.02 270 / 1)",
            "subtle": "oklch(0.25 0.02 270 / 1)"
          }
        },
        "typography": {
          "font_family": {
            "heading": "Poppins, system-ui, sans-serif",
            "body": "Open Sans, system-ui, sans-serif",
            "mono": "Fira Code, Consolas, monospace"
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
          "sm": "0 1px 2px oklch(0.00 0.00 0 / 0.10)",
          "md": "0 4px 6px oklch(0.00 0.00 0 / 0.15)",
          "lg": "0 10px 15px oklch(0.00 0.00 0 / 0.20)",
          "xl": "0 20px 25px oklch(0.00 0.00 0 / 0.25)"
        },
        "breakpoints": {
          "sm": "640px",
          "md": "768px",
          "lg": "1024px",
          "xl": "1280px",
          "2xl": "1536px"
        }
      }
    },
    {
      "id": "variant-3",
      "name": "Elegant Serif",
      "description": "Sophisticated design with serif typography and refined color palette. Conveys professionalism and timeless quality.",
      "design_philosophy": "Timeless elegance - combine classical typography with modern layout principles",
      "preview": {
        "primary": "oklch(0.35 0.08 280 / 1)",
        "background": "oklch(0.96 0.01 60 / 1)",
        "font_heading": "Playfair Display, Georgia, serif",
        "border_radius": "0.25rem"
      },
      "proposed_tokens": {
        "colors": {
          "brand": {
            "primary": "oklch(0.35 0.08 280 / 1)",
            "secondary": "oklch(0.50 0.10 320 / 1)",
            "accent": "oklch(0.65 0.12 40 / 1)"
          },
          "surface": {
            "background": "oklch(0.96 0.01 60 / 1)",
            "elevated": "oklch(1.00 0.00 0 / 1)",
            "overlay": "oklch(0.94 0.01 60 / 1)"
          },
          "semantic": {
            "success": "oklch(0.55 0.12 145 / 1)",
            "warning": "oklch(0.70 0.10 85 / 1)",
            "error": "oklch(0.50 0.18 30 / 1)",
            "info": "oklch(0.50 0.15 255 / 1)"
          },
          "text": {
            "primary": "oklch(0.25 0.01 280 / 1)",
            "secondary": "oklch(0.50 0.01 280 / 1)",
            "tertiary": "oklch(0.65 0.01 280 / 1)",
            "inverse": "oklch(0.95 0.01 60 / 1)"
          },
          "border": {
            "default": "oklch(0.82 0.01 60 / 1)",
            "strong": "oklch(0.65 0.01 60 / 1)",
            "subtle": "oklch(0.90 0.01 60 / 1)"
          }
        },
        "typography": {
          "font_family": {
            "heading": "Playfair Display, Georgia, serif",
            "body": "Source Sans Pro, system-ui, sans-serif",
            "mono": "Source Code Pro, Consolas, monospace"
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
          "sm": "0 1px 2px oklch(0.00 0.00 0 / 0.03)",
          "md": "0 4px 6px oklch(0.00 0.00 0 / 0.05)",
          "lg": "0 10px 15px oklch(0.00 0.00 0 / 0.08)",
          "xl": "0 20px 25px oklch(0.00 0.00 0 / 0.12)"
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
```

**Key Points**:
- Each variant has complete, independent token proposals
- All colors use OKLCH format for perceptual uniformity
- Token structures are production-ready (no placeholders)
- Variants have distinct visual identities and philosophies

## Error Handling

- **No images found**: Report glob pattern and suggest corrections (e.g., "Pattern '*.png' matched 0 files in current directory")
- **Invalid prompt**: Require non-empty string for text mode
- **Claude JSON parsing error**: Retry with stricter format instructions and explicit structure requirements
- **Invalid session**: Create standalone session automatically in `.workflow/.scratchpad/`
- **Invalid variant count**: Clamp to 1-5 range and warn user

## Key Features

1. **Trend-Aware Style Generation** 🆕
   - Uses Exa MCP to research current design trends (2024-2025)
   - Searches for color theory, typography trends, layout patterns, and accessibility guidelines
   - Generates style variants informed by modern best practices
   - Balances innovation with timeless design principles

2. **Zero External Dependencies for Analysis**
   - No `gemini-wrapper`, no `codex` for style synthesis - pure Claude
   - Single-pass comprehensive analysis with trend integration

3. **Streamlined Output**
   - Single file (`style-cards.json`) vs. multiple scattered files
   - Eliminates `semantic_style_analysis.json`, `design-tokens.json`, `tailwind-tokens.js` clutter
   - Each variant contains complete token proposals embedded

4. **Flexible Input Modes**
   - Image-only: Analyze visual references
   - Text-only: Generate from descriptions
   - Hybrid: Text guides image analysis
   - All modes enhanced with web-based design research

5. **Context-Aware Research**
   - Extracts design keywords from user prompts (e.g., "minimalist", "Linear.app")
   - Considers project type from brainstorming artifacts
   - Customizes search queries based on project context

6. **Reproducible Structure**
   - Same inputs = same output structure
   - Deterministic JSON schema
   - Content informed by current design trends

7. **Production-Ready Tokens**
   - Complete design system proposals per variant
   - OKLCH color format for accessibility
   - Semantic naming conventions
   - WCAG AA accessibility considerations from latest guidelines
   - Modern typography trends (variable fonts, system stacks)

8. **Workflow Integration**
   - Integrated mode: Works within existing workflow sessions
   - Standalone mode: Auto-creates session in scratchpad
   - Context-aware: Can reference synthesis-specification.md or ui-designer/analysis.md

## Integration Points

- **Input**: Reference images (PNG, JPG, WebP) via glob patterns, or text prompts
- **Output**: `style-cards.json` for `/workflow:ui-design:consolidate`
- **Context**: Optional brainstorming artifacts (`synthesis-specification.md`, `ui-designer/analysis.md`)
- **Auto Integration**: Automatically triggered by `/workflow:ui-design:auto` workflow
- **Next Step**: `/workflow:ui-design:consolidate --session {session_id} --variants {count}` (or `--keep-separate` for matrix mode)
