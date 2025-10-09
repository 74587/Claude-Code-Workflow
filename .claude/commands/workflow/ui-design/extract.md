---
name: extract
description: Extract design style from reference images or text prompts using Claude's analysis
usage: /workflow:ui-design:extract [--base-path <path>] [--session <id>] [--images "<glob>"] [--prompt "<desc>"] [--variants <count>]
argument-hint: "[--base-path \".workflow/WFS-xxx/design-run-xxx\"] [--session WFS-xxx] [--images \"refs/*.png\"] [--prompt \"Modern minimalist\"] [--variants 3]"
parameters:
  - name: --variants
    type: number
    default: 1
    description: "Number of design variants to extract (1-5). Each variant will be maximally contrasting. Generates style-cards.json with variant-N IDs."
  - name: --images
    type: string
    description: "Glob pattern for reference images (e.g., 'refs/*.png'). Supports PNG, JPG, WebP."
  - name: --prompt
    type: string
    description: "Text description of desired style (e.g., 'Modern minimalist blog'). Can be combined with --images."
  - name: --session
    type: string
    description: "Workflow session ID (e.g., WFS-auth). Creates design run in session directory."
  - name: --base-path
    type: string
    description: "Custom base path for output. Overrides --session if provided."
examples:
  - /workflow:ui-design:extract --images "design-refs/*.png" --variants 3
  - /workflow:ui-design:extract --prompt "Modern minimalist blog, dark theme" --variants 3
  - /workflow:ui-design:extract --session WFS-auth --images "refs/*.png" --prompt "Linear.app style" --variants 2
  - /workflow:ui-design:extract --base-path ".workflow/WFS-auth/design-run-20250109-143022" --images "refs/*.png" --variants 3
  - /workflow:ui-design:extract --prompt "Bold vibrant" --variants 1  # Single variant (default)
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

# Determine base path (PRIORITY: --base-path > --session > standalone)
IF --base-path provided:
    base_path = {provided_base_path}
    session_mode = "integrated"  # Assume integrated if path is passed
    # Extract session_id if possible from path pattern
    IF base_path matches ".workflow/WFS-*/design-*":
        session_id = extract_from_path(base_path, pattern="WFS-([^/]+)")
    ELSE:
        session_id = "standalone"
ELSE:
    # Generate a new run_id and base_path only if not provided
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

### Phase 0.5: AI-Driven Design Space Divergence

```bash
# Step 1: Load project context to inform design space analysis
project_context = ""
IF exists({base_path}/.brainstorming/synthesis-specification.md):
    project_context = Read({base_path}/.brainstorming/synthesis-specification.md)
ELSE IF exists({base_path}/.brainstorming/ui-designer/analysis.md):
    project_context = Read({base_path}/.brainstorming/ui-designer/analysis.md)

REPORT: "🎨 Analyzing design space to generate maximally contrasting directions..."

# Step 2: AI-driven divergent direction generation
divergence_prompt = """
Analyze the user's design requirements and generate {variants_count} MAXIMALLY CONTRASTING design directions.

USER INPUT:
{IF prompt_guidance}
Prompt: "{prompt_guidance}"
{ENDIF}

{IF project_context}
Project Context Summary:
{extract_key_points(project_context, max_lines=10)}
{ENDIF}

{IF images}
Reference Images: {image_count} images will be analyzed in next phase
{ENDIF}

DESIGN ATTRIBUTE SPACE (use to maximize contrast):
- Color Saturation: [monochrome, muted, moderate, vibrant, hypersaturated]
- Visual Weight: [minimal, light, balanced, bold, heavy]
- Formality: [playful, casual, professional, formal, luxury]
- Organic vs Geometric: [organic/fluid, soft, balanced, geometric, brutalist]
- Innovation: [timeless, modern, contemporary, trendy, experimental]
- Density: [spacious, airy, balanced, compact, dense]

TASK:
1. Identify the design space center point from user requirements
2. Generate {variants_count} design directions that:
   - Are MAXIMALLY DISTANT from each other in attribute space
   - Each occupies a distinct region/quadrant of the design spectrum
   - Together provide diverse aesthetic options for the user
   - Are contextually appropriate for the project type
   - Have clear, memorable philosophical differences

3. For each direction, generate:
   - Specific search keywords for MCP research (3-5 keywords)
   - Anti-keywords to avoid (2-3 keywords that would reduce contrast)
   - Clear rationale explaining why this contrasts with other variants

OUTPUT FORMAT: Valid JSON only, no markdown:
{
  "design_space_center": {
    "color_saturation": "moderate",
    "visual_weight": "balanced",
    "formality": "professional",
    "organic_geometric": "balanced",
    "innovation": "contemporary",
    "density": "balanced"
  },
  "divergent_directions": [
    {
      "id": "variant-1",
      "philosophy_name": "Brief name 2-3 words (e.g., 'Minimal Brutalist')",
      "design_attributes": {
        "color_saturation": "monochrome",
        "visual_weight": "minimal",
        "formality": "professional",
        "organic_geometric": "brutalist",
        "innovation": "timeless",
        "density": "spacious"
      },
      "search_keywords": ["minimal", "brutalist", "monochrome", "geometric", "Swiss design"],
      "anti_keywords": ["decorative", "colorful", "organic"],
      "rationale": "Extreme minimalism with geometric rigor, contrasts with any ornamental or colorful approaches"
    }
    // ... {variants_count} total directions
  ],
  "contrast_verification": {
    "min_pairwise_distance": "0.75",
    "strategy": "Brief explanation of how maximum contrast was achieved"
  }
}

RULES:
- Output ONLY valid JSON, no markdown code blocks or explanations
- Maximize inter-variant distance in attribute space
- Ensure each variant occupies a distinct aesthetic region
- Avoid overlapping attribute combinations
- All directions must be contextually appropriate for: {project_context or "general web UI"}
- Philosophy names should be memorable and evocative
- Search keywords should be specific and actionable for web research
"""

# Execute AI analysis
divergence_response = Claude_Native_Analysis(divergence_prompt)
divergent_directions = parse_json(divergence_response)

REPORT: "✅ Generated {variants_count} contrasting design directions:"
FOR direction IN divergent_directions.divergent_directions:
    REPORT: "  - {direction.philosophy_name}: {direction.rationale}"

# Store divergent directions for next phase
design_space_analysis = divergent_directions
```

### Phase 1.5: Variant-Specific Design Trend Research (Exa MCP)

```bash
# Step 1: Execute independent MCP research for each variant
REPORT: "🔍 Researching design trends for each variant independently..."

design_trends = {}

FOR direction IN design_space_analysis.divergent_directions:
    variant_id = direction.id
    philosophy = direction.philosophy_name
    keywords = direction.search_keywords
    anti_keywords = direction.anti_keywords

    REPORT: "  → Researching {philosophy} ({variant_id})..."

    # Build variant-specific search queries
    variant_queries = [
        # Colors: philosophy-specific palette trends
        f"{philosophy} UI design color palettes {' '.join(keywords[:3])} 2024 2025",

        # Typography: philosophy-specific font trends
        f"{philosophy} typography trends {' '.join(keywords[:3])} web design 2024",

        # Layout: philosophy-specific patterns
        f"{philosophy} layout patterns {' '.join(keywords[:3])} design systems 2024",

        # Contrast query: emphasize differentiation
        f"design systems {philosophy} NOT {' NOT '.join(anti_keywords[:2])}"
    ]

    # Execute MCP searches for this variant
    design_trends[variant_id] = {
        "philosophy": philosophy,
        "attributes": direction.design_attributes,
        "keywords": keywords,
        "anti_keywords": anti_keywords,
        "research": {}
    }

    FOR query IN variant_queries:
        category = identify_category(query)  # "colors", "typography", "layout", "contrast"
        design_trends[variant_id].research[category] = mcp__exa__get_code_context_exa(
            query=query,
            tokensNum=2000  # Increased for more detailed guidance
        )

    REPORT: "    ✅ {philosophy} research complete"

# Step 2: Gather shared accessibility guidelines (all variants)
REPORT: "  → Researching universal accessibility guidelines..."
shared_accessibility = mcp__exa__get_code_context_exa(
    query="WCAG 2.2 accessibility color contrast ARIA best practices 2024",
    tokensNum=1500
)

REPORT: "✅ All variant-specific design research complete"
```

### Phase 2: Variant-Specific Style Synthesis (Claude with Divergent Research)

This is a single-pass analysis that generates each variant based on its specific design direction and research.

**Analysis Prompt Template**:
```
Generate {variants_count} design style proposals, each guided by its pre-analyzed design direction and independent trend research.

INPUT MODE: {input_mode}

{IF input_mode IN ["image", "hybrid"]}
VISUAL REFERENCES: {list of loaded images}
Analyze these images through the lens of each variant's design philosophy
{ENDIF}

{IF input_mode IN ["text", "hybrid"]}
TEXT GUIDANCE: "{prompt_guidance}"
Apply this guidance while maintaining each variant's distinct aesthetic direction
{ENDIF}

DESIGN SPACE ANALYSIS:
{design_space_analysis summary}

VARIANT-SPECIFIC DESIGN DIRECTIONS AND RESEARCH:

{FOR each variant_id IN design_trends.keys()}
---
VARIANT: {variant_id}
PHILOSOPHY: {design_trends[variant_id].philosophy}
DESIGN ATTRIBUTES:
  - Color Saturation: {design_trends[variant_id].attributes.color_saturation}
  - Visual Weight: {design_trends[variant_id].attributes.visual_weight}
  - Formality: {design_trends[variant_id].attributes.formality}
  - Organic/Geometric: {design_trends[variant_id].attributes.organic_geometric}
  - Innovation: {design_trends[variant_id].attributes.innovation}
  - Density: {design_trends[variant_id].attributes.density}

SEARCH KEYWORDS: {', '.join(design_trends[variant_id].keywords)}
ANTI-PATTERNS (avoid): {', '.join(design_trends[variant_id].anti_keywords)}

TREND RESEARCH FOR THIS VARIANT:

Color Trends ({variant_id}):
{design_trends[variant_id].research.colors}

Typography Trends ({variant_id}):
{design_trends[variant_id].research.typography}

Layout Patterns ({variant_id}):
{design_trends[variant_id].research.layout}

Contrast Emphasis ({variant_id}):
{design_trends[variant_id].research.contrast}

---
{ENDFOR}

SHARED ACCESSIBILITY GUIDELINES (apply to all variants):
{shared_accessibility}

TASK: Generate {variants_count} design style variants where EACH variant:
1. Strictly follows its pre-defined design philosophy and attributes
2. Uses ONLY its variant-specific trend research for aesthetic decisions
3. Maintains maximum contrast with other variants' attributes
4. Incorporates its search keywords and avoids its anti-patterns
5. Uses OKLCH color space for all color values
6. Includes complete, production-ready design token proposals
7. Applies WCAG accessibility guidelines from shared research

CRITICAL RULES FOR CONTRAST:
- Variant-1 should feel completely different from Variant-2 and Variant-3
- Use each variant's specific attribute scores (e.g., "monochrome" vs "vibrant")
- Reference variant-specific research, NOT shared trends
- If Variant-1 is "minimal/geometric", Variant-2 must be "bold/organic" or similar contrast
- Each variant should be immediately distinguishable by visual inspection

OUTPUT FORMAT: JSON matching this structure (see full schema at end of prompt):
{
  "extraction_metadata": { "session_id": "...", "input_mode": "...", "timestamp": "...", "variants_count": N },
  "style_cards": [
    {
      "id": "variant-1",
      "name": "Concise Style Name (2-3 words)",
      "description": "2-3 sentence description",
      "design_philosophy": "Core design principles",
      "preview": { "primary": "oklch(...)", "background": "oklch(...)", "font_heading": "...", "border_radius": "..." },
      "proposed_tokens": {
        "colors": {
          "brand": { "primary": "oklch(...)", "secondary": "oklch(...)", "accent": "oklch(...)" },
          "surface": { "background": "oklch(...)", "elevated": "oklch(...)", "overlay": "oklch(...)" },
          "semantic": { "success": "oklch(...)", "warning": "oklch(...)", "error": "oklch(...)", "info": "oklch(...)" },
          "text": { "primary": "oklch(...)", "secondary": "oklch(...)", "tertiary": "oklch(...)", "inverse": "oklch(...)" },
          "border": { "default": "oklch(...)", "strong": "oklch(...)", "subtle": "oklch(...)" }
        },
        "typography": { "font_family": {...}, "font_size": {...}, "font_weight": {...}, "line_height": {...}, "letter_spacing": {...} },
        "spacing": { "0": "0", ..., "24": "6rem" },
        "border_radius": { "none": "0", ..., "full": "9999px" },
        "shadows": { "sm": "...", ..., "xl": "..." },
        "breakpoints": { "sm": "640px", ..., "2xl": "1536px" }
      }
    }
    // Repeat structure for ALL {variants_count} variants
  ]
}

RULES:
- Each variant must strictly adhere to its pre-defined design attributes
- Use ONLY variant-specific trend research (do NOT cross-pollinate research between variants)
- Maximize visual contrast between variants using their attribute differences
- All colors MUST use OKLCH format: oklch(L C H / A)
- Token structures must be complete and production-ready
- Use semantic naming throughout (e.g., "brand-primary" not "color-1")
- Ensure accessibility (WCAG AA contrast ratios: 4.5:1 text, 3:1 UI) using shared guidelines
- Apply typography trends from each variant's specific research
- Incorporate search keywords and actively avoid anti-patterns for each variant
- Each variant's philosophy_name should match the pre-analyzed name from design space analysis
- Reference specific trends from variant-specific research, not from other variants
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
    {content: "Analyze design space for maximum contrast", status: "completed", activeForm: "Analyzing design space"},
    {content: `Generate ${variants_count} divergent design directions`, status: "completed", activeForm: "Generating design directions"},
    {content: "Research variant-specific design trends with Exa MCP", status: "completed", activeForm: "Researching variant trends"},
    {content: "Synthesize style cards with independent research", status: "completed", activeForm: "Synthesizing style cards"},
    {content: `Generate ${variants_count} contrasting style variants`, status: "completed", activeForm: "Generating style variants"}
  ]
});
```

**Completion Message**:
```
✅ Style extraction complete for session: {session_id}

Input mode: {input_mode}
{IF image mode: Images analyzed: {count}}
{IF prompt mode: Prompt: "{truncated_prompt}"}

🎨 Design Space Analysis:
- Generated {variants_count} MAXIMALLY CONTRASTING design directions
- Min pairwise contrast distance: {design_space_analysis.contrast_verification.min_pairwise_distance}
- Strategy: {design_space_analysis.contrast_verification.strategy}

Generated {variants_count} style variant(s):
{FOR each card: - {card.name} ({card.id}) - {card.design_philosophy}}

🔍 Research performed:
- {variants_count} × 4 variant-specific MCP queries ({variants_count * 4} total)
- 1 shared accessibility research query
- Each variant has independent trend guidance

📂 Output: {base_path}/style-extraction/style-cards.json

Next: /workflow:ui-design:consolidate --session {session_id} --variants {variants_count} [--layout-variants <count>]

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

**Schema Structure**:

```json
{
  "extraction_metadata": {
    "session_id": "string",
    "input_mode": "image|text|hybrid",
    "timestamp": "ISO 8601 string",
    "variants_count": "number"
  },
  "style_cards": [
    {
      "id": "variant-{n}",
      "name": "Concise Style Name (2-3 words)",
      "description": "2-3 sentence description of visual language and UX",
      "design_philosophy": "Core design principles for this variant",
      "preview": {
        "primary": "oklch(...)",
        "background": "oklch(...)",
        "font_heading": "Font family, fallbacks",
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
        "border_radius": { "none": "0", "sm": "0.25rem", "md": "0.5rem", "lg": "0.75rem", "xl": "1rem", "full": "9999px" },
        "shadows": { "sm": "...", "md": "...", "lg": "...", "xl": "..." },
        "breakpoints": { "sm": "640px", "md": "768px", "lg": "1024px", "xl": "1280px", "2xl": "1536px" }
      }
    }
    // Repeat structure for variants_count total (variant-1, variant-2, ..., variant-n)
  ]
}
```

**Concrete Example (variant-1 only, others follow same structure)**:

```json
{
  "extraction_metadata": {
    "session_id": "WFS-auth",
    "input_mode": "hybrid",
    "timestamp": "2025-01-15T10:30:00Z",
    "variants_count": 3
  },
  "style_cards": [
    {
      "id": "variant-1",
      "name": "Minimal Brutalist",
      "description": "Stark geometric design with monochrome palette and sharp edges. Prioritizes function over decoration with extreme clarity.",
      "design_philosophy": "Form follows function - eliminate all non-essential visual elements",
      "preview": {
        "primary": "oklch(0.20 0.01 270 / 1)",
        "background": "oklch(0.98 0.00 0 / 1)",
        "font_heading": "Inter, system-ui, sans-serif",
        "border_radius": "0"
      },
      "proposed_tokens": {
        "colors": {
          "brand": {
            "primary": "oklch(0.20 0.01 270 / 1)",
            "secondary": "oklch(0.40 0.01 270 / 1)",
            "accent": "oklch(0.60 0.01 270 / 1)"
          },
          "surface": {
            "background": "oklch(0.98 0.00 0 / 1)",
            "elevated": "oklch(0.95 0.00 0 / 1)",
            "overlay": "oklch(0.90 0.00 0 / 1)"
          },
          "semantic": {
            "success": "oklch(0.30 0.01 270 / 1)",
            "warning": "oklch(0.30 0.01 270 / 1)",
            "error": "oklch(0.30 0.01 270 / 1)",
            "info": "oklch(0.30 0.01 270 / 1)"
          },
          "text": {
            "primary": "oklch(0.10 0.00 0 / 1)",
            "secondary": "oklch(0.40 0.00 0 / 1)",
            "tertiary": "oklch(0.60 0.00 0 / 1)",
            "inverse": "oklch(0.98 0.00 0 / 1)"
          },
          "border": {
            "default": "oklch(0.20 0.00 0 / 1)",
            "strong": "oklch(0.10 0.00 0 / 1)",
            "subtle": "oklch(0.85 0.00 0 / 1)"
          }
        },
        "typography": {
          "font_family": {
            "heading": "Inter, system-ui, sans-serif",
            "body": "Inter, system-ui, sans-serif",
            "mono": "JetBrains Mono, monospace"
          },
          "font_size": {
            "xs": "0.75rem", "sm": "0.875rem", "base": "1rem", "lg": "1.125rem",
            "xl": "1.25rem", "2xl": "1.5rem", "3xl": "1.875rem", "4xl": "2.25rem"
          },
          "font_weight": { "normal": "400", "medium": "500", "semibold": "600", "bold": "700" },
          "line_height": { "tight": "1.25", "normal": "1.5", "relaxed": "1.75" },
          "letter_spacing": { "tight": "-0.025em", "normal": "0", "wide": "0.025em" }
        },
        "spacing": {
          "0": "0", "1": "0.25rem", "2": "0.5rem", "3": "0.75rem", "4": "1rem",
          "5": "1.25rem", "6": "1.5rem", "8": "2rem", "10": "2.5rem", "12": "3rem",
          "16": "4rem", "20": "5rem", "24": "6rem"
        },
        "border_radius": {
          "none": "0", "sm": "0.25rem", "md": "0.5rem", "lg": "0.75rem", "xl": "1rem", "full": "9999px"
        },
        "shadows": {
          "sm": "0 1px 2px oklch(0.00 0.00 0 / 0.05)",
          "md": "0 4px 6px oklch(0.00 0.00 0 / 0.07)",
          "lg": "0 10px 15px oklch(0.00 0.00 0 / 0.10)",
          "xl": "0 20px 25px oklch(0.00 0.00 0 / 0.15)"
        },
        "breakpoints": {
          "sm": "640px", "md": "768px", "lg": "1024px", "xl": "1280px", "2xl": "1536px"
        }
      }
    },
    {
      "id": "variant-2",
      "name": "Bold Vibrant",
      "description": "High-energy design with saturated colors, dynamic typography, and strong contrast. (Full token structure same as variant-1)",
      "design_philosophy": "Make a statement - use color and energy to create memorable experiences",
      "preview": { "primary": "oklch(0.50 0.25 330 / 1)", "background": "oklch(0.15 0.02 270 / 1)", "..." },
      "proposed_tokens": { "...same structure as variant-1 with different values..." }
    },
    {
      "id": "variant-3",
      "name": "Organic Natural",
      "description": "Soft, rounded design with warm earth tones and fluid layouts. (Full token structure same as variant-1)",
      "design_philosophy": "Nature-inspired - embrace curves, warmth, and organic flow",
      "preview": { "primary": "oklch(0.55 0.15 60 / 1)", "background": "oklch(0.96 0.03 80 / 1)", "..." },
      "proposed_tokens": { "...same structure as variant-1 with different values..." }
    }
  ]
}
```

**Key Structural Requirements**:
- Each variant MUST have complete, independent token proposals (all categories present)
- All colors MUST use OKLCH format: `oklch(L C H / A)`
- Token keys MUST match exactly across all variants for consistency
- Variants differ in VALUES, not structure
- Production-ready: no placeholders or incomplete sections

## Error Handling

- **No images found**: Report glob pattern and suggest corrections (e.g., "Pattern '*.png' matched 0 files in current directory")
- **Invalid prompt**: Require non-empty string for text mode
- **Claude JSON parsing error**: Retry with stricter format instructions and explicit structure requirements
- **Invalid session**: Create standalone session automatically in `.workflow/.scratchpad/`
- **Invalid variant count**: Clamp to 1-5 range and warn user

## Key Features

1. **🚀 AI-Driven Design Space Exploration (Strategy A)** 🆕
   - **Phase 0.5**: AI analyzes requirements and generates MAXIMALLY CONTRASTING design directions
   - Uses 6-dimensional design attribute space (color saturation, visual weight, formality, organic/geometric, innovation, density)
   - Ensures each variant occupies a distinct region of the design spectrum
   - Generates search keywords and anti-patterns for each variant
   - Provides contrast verification with minimum pairwise distance metrics

2. **🎯 Variant-Specific Trend Research** 🆕
   - **Independent MCP queries** for each variant (4 queries per variant)
   - Each variant researches its specific design philosophy (e.g., "minimal brutalist" vs "bold vibrant")
   - Uses philosophy-specific keywords and avoids cross-contamination
   - Eliminates趋同性 (convergence) by preventing shared trend influence
   - Shared accessibility research applied to all variants

3. **🔒 Maximum Contrast Guarantee**
   - AI-driven divergence ensures variants are maximally distant in attribute space
   - Each variant has distinct: philosophy, color saturation, visual weight, formality, etc.
   - Explicit anti-patterns prevent variants from borrowing each other's characteristics
   - Contrast verification built into design space analysis

4. **Zero External Dependencies for Core Analysis**
   - No `gemini-wrapper`, no `codex` for style synthesis - pure Claude
   - Single-pass comprehensive analysis with variant-specific trend integration
   - Only uses Exa MCP for external trend research (not for synthesis)

5. **Streamlined Output**
   - Single file (`style-cards.json`) vs. multiple scattered files
   - Eliminates `semantic_style_analysis.json`, `design-tokens.json`, `tailwind-tokens.js` clutter
   - Each variant contains complete token proposals embedded

6. **Flexible Input Modes**
   - Image-only: Analyze visual references through each variant's philosophical lens
   - Text-only: Generate from descriptions with maximum divergence
   - Hybrid: Text guides image analysis while maintaining variant independence
   - All modes enhanced with variant-specific web research

7. **Context-Aware & Dynamic**
   - Extracts design keywords from user prompts (e.g., "minimalist", "Linear.app")
   - Considers project type from brainstorming artifacts
   - Dynamically generates design directions based on project context
   - No hardcoded design philosophies - fully adaptive

8. **Production-Ready Tokens**
   - Complete design system proposals per variant
   - OKLCH color format for perceptual uniformity and accessibility
   - Semantic naming conventions
   - WCAG AA accessibility considerations from shared research
   - Variant-specific typography trends (not generic)

9. **Workflow Integration**
   - Integrated mode: Works within existing workflow sessions
   - Standalone mode: Auto-creates session in scratchpad
   - Context-aware: Can reference synthesis-specification.md or ui-designer/analysis.md
   - Contrast metrics included in completion report

## Integration Points

- **Input**: Reference images (PNG, JPG, WebP) via glob patterns, or text prompts
- **Output**: `style-cards.json` for `/workflow:ui-design:consolidate`
- **Context**: Optional brainstorming artifacts (`synthesis-specification.md`, `ui-designer/analysis.md`)
- **Auto Integration**: Automatically triggered by `/workflow:ui-design:auto` workflow
- **Next Step**: `/workflow:ui-design:consolidate --session {session_id} --variants {count} [--layout-variants <count>]` (add `--keep-separate` for matrix mode)
