---
name: extract
description: Extract design style from reference images or text prompts using Claude's analysis
usage: /workflow:ui-design:extract [--base-path <path>] [--session <id>] [--images "<glob>"] [--prompt "<desc>"] [--variants <count>]
argument-hint: "[--base-path \".workflow/WFS-xxx/design-run-xxx\"] [--session WFS-xxx] [--images \"refs/*.png\"] [--prompt \"Modern minimalist\"] [--variants 3]"
parameters:
  - name: --mode
    type: string
    enum: [imitate, explore, auto]
    default: auto
    description: "Extraction mode: 'imitate' (high-fidelity single style, skip divergence), 'explore' (multi-variant with contrast analysis), 'auto' (detect from --variants: 1=imitate, 2+=explore)"
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
IF --images AND --prompt: input_mode = "hybrid"  # Text guides image analysis
ELSE IF --images: input_mode = "image"
ELSE IF --prompt: input_mode = "text"
ELSE: ERROR: "Must provide --images or --prompt"

# Determine base path (PRIORITY: --base-path > --session > standalone)
IF --base-path:
    base_path = {provided_base_path}; session_mode = "integrated"
    session_id = base_path matches ".workflow/WFS-*/design-*" ? extract_session_id(base_path) : "standalone"
ELSE:
    run_id = "run-" + timestamp()
    IF --session:
        session_mode = "integrated"; session_id = {provided_session}
        base_path = ".workflow/WFS-{session_id}/design-{run_id}/"
    ELSE:
        session_mode = "standalone"; base_path = ".workflow/.design/{run_id}/"

# Set variant count
variants_count = --variants OR 1; VALIDATE: 1 <= variants_count <= 5
```

### Phase 1: Input Loading & Validation

```bash
# Expand and validate inputs
IF input_mode IN ["image", "hybrid"]:
    expanded_images = Glob({--images pattern}); VERIFY: expanded_images.length > 0
    FOR each image: image_data[i] = Read({image_path})

IF input_mode IN ["text", "hybrid"]:
    VALIDATE: --prompt is non-empty; prompt_guidance = {--prompt value}

CREATE: {base_path}/style-extraction/
```

### Phase 0.5: AI-Driven Design Space Divergence

```bash
# Determine extraction mode
extraction_mode = --mode OR "auto"
IF extraction_mode == "auto":
    extraction_mode = (variants_count == 1) ? "imitate" : "explore"
    REPORT: "🔍 Auto-detected mode: {extraction_mode} (variants_count={variants_count})"

# Skip divergence analysis for imitate mode
IF extraction_mode == "imitate":
    REPORT: "🎯 IMITATE MODE: High-fidelity single style extraction"
    REPORT: "   → Skipping design space divergence analysis"
    REPORT: "   → Proceeding to Phase 2 for direct style synthesis"
    design_space_analysis = null
    # Skip to Phase 2
    GOTO Phase 2

# Step 1: Load project context (explore mode only)
project_context = ""
IF exists({base_path}/.brainstorming/synthesis-specification.md):
    project_context = Read(synthesis-specification.md)
ELSE IF exists({base_path}/.brainstorming/ui-designer/analysis.md):
    project_context = Read(ui-designer/analysis.md)

REPORT: "🎨 EXPLORE MODE: Analyzing design space to generate maximally contrasting directions..."

# Step 2: AI-driven divergent direction generation
divergence_prompt = """
Analyze user requirements and generate {variants_count} MAXIMALLY CONTRASTING design directions.

USER INPUT:
{IF prompt_guidance: Prompt: "{prompt_guidance}"}
{IF project_context: Project Context Summary: {extract_key_points(project_context, max_lines=10)}}
{IF images: Reference Images: {image_count} images will be analyzed in next phase}

DESIGN ATTRIBUTE SPACE (maximize contrast):
- Color Saturation: [monochrome, muted, moderate, vibrant, hypersaturated]
- Visual Weight: [minimal, light, balanced, bold, heavy]
- Formality: [playful, casual, professional, formal, luxury]
- Organic vs Geometric: [organic/fluid, soft, balanced, geometric, brutalist]
- Innovation: [timeless, modern, contemporary, trendy, experimental]
- Density: [spacious, airy, balanced, compact, dense]

TASK:
1. Identify design space center point from user requirements
2. Generate {variants_count} directions that:
   - Are MAXIMALLY DISTANT from each other in attribute space
   - Each occupies a distinct region/quadrant of the design spectrum
   - Together provide diverse aesthetic options
   - Are contextually appropriate for project type
   - Have clear, memorable philosophical differences
3. For each direction, generate:
   - Specific search keywords for MCP research (3-5 keywords)
   - Anti-keywords to avoid (2-3 keywords)
   - Clear rationale explaining contrast with other variants

OUTPUT FORMAT: Valid JSON only, no markdown:
{"design_space_center": {attributes}, "divergent_directions": [
  {"id": "variant-1", "philosophy_name": "Brief name 2-3 words",
   "design_attributes": {attribute_scores}, "search_keywords": [...],
   "anti_keywords": [...], "rationale": "..."}
], "contrast_verification": {"min_pairwise_distance": "0.75", "strategy": "..."}}

RULES: Output ONLY valid JSON, maximize inter-variant distance, ensure each variant
occupies distinct aesthetic region, avoid overlapping attributes
"""

# Execute AI analysis
divergent_directions = parse_json(Claude_Native_Analysis(divergence_prompt))

REPORT: "✅ Generated {variants_count} contrasting design directions:"
FOR direction IN divergent_directions.divergent_directions:
    REPORT: "  - {direction.philosophy_name}: {direction.rationale}"

design_space_analysis = divergent_directions

# Step 3: Save design space analysis for consolidation phase
Write({file_path: "{base_path}/style-extraction/design-space-analysis.json",
       content: JSON.stringify(design_space_analysis, null, 2)})
REPORT: "💾 Saved design space analysis to design-space-analysis.json"
```

### Phase 2: Variant-Specific Style Synthesis (Claude Native Analysis)

**Analysis Prompt Template**:
```
Generate {variants_count} design style proposals{IF extraction_mode == "explore": , each guided by its pre-analyzed design direction}.

INPUT MODE: {input_mode}
{IF input_mode IN ["image", "hybrid"]: VISUAL REFERENCES: {list of loaded images}}
{IF input_mode IN ["text", "hybrid"]: TEXT GUIDANCE: "{prompt_guidance}"}

{IF extraction_mode == "explore":
DESIGN SPACE ANALYSIS: {design_space_analysis summary}

VARIANT-SPECIFIC DESIGN DIRECTIONS:
{FOR each direction IN design_space_analysis.divergent_directions:
---
VARIANT: {direction.id} | PHILOSOPHY: {direction.philosophy_name}
DESIGN ATTRIBUTES: {direction.design_attributes}
SEARCH KEYWORDS: {direction.search_keywords}
ANTI-PATTERNS (avoid): {direction.anti_keywords}
RATIONALE: {direction.rationale}
---}
}

TASK: Generate {variants_count} design style variant{IF variants_count > 1: s} where {IF extraction_mode == "explore": EACH variant}:
{IF extraction_mode == "explore":
1. Strictly follows its pre-defined design philosophy and attributes
2. Maintains maximum contrast with other variants' attributes
3. Incorporates its design direction and avoids its anti-patterns
}
{IF extraction_mode == "imitate":
1. Provides high-fidelity replication of reference design
2. Focuses on accurate extraction of visual characteristics
}
4. Uses OKLCH color space for all color values
5. Includes complete, production-ready design token proposals
6. Applies WCAG AA accessibility guidelines (4.5:1 text, 3:1 UI)

{IF extraction_mode == "explore":
CRITICAL RULES FOR CONTRAST:
- Variant-1 should feel completely different from Variant-2/3
- Use each variant's specific attribute scores (e.g., "monochrome" vs "vibrant")
- Each variant should embody its unique design direction
- If Variant-1 is "minimal/geometric", Variant-2 must be "bold/organic" or similar contrast
}

OUTPUT FORMAT: JSON matching this structure:
{"extraction_metadata": {"session_id": "...", "input_mode": "...", "timestamp": "...", "variants_count": N},
 "style_cards": [
   {"id": "variant-1", "name": "Concise Style Name (2-3 words)", "description": "2-3 sentences",
    "design_philosophy": "Core design principles",
    "preview": {"primary": "oklch(...)", "background": "oklch(...)", "font_heading": "...", "border_radius": "..."},
    "proposed_tokens": {
      "colors": {"brand": {...}, "surface": {...}, "semantic": {...}, "text": {...}, "border": {...}},
      "typography": {"font_family": {...}, "font_size": {...}, "font_weight": {...}, "line_height": {...}, "letter_spacing": {...}},
      "spacing": {"0": "0", ..., "24": "6rem"},
      "border_radius": {"none": "0", ..., "full": "9999px"},
      "shadows": {"sm": "...", ..., "xl": "..."},
      "breakpoints": {"sm": "640px", ..., "2xl": "1536px"}
    }}
   // Repeat for ALL {variants_count} variants
 ]}

RULES: {IF extraction_mode == "explore": Each variant must strictly adhere to pre-defined attributes; maximize visual contrast;}
{IF extraction_mode == "imitate": Focus on high-fidelity replication;}
all colors in OKLCH format; complete token structures; semantic naming;
WCAG AA accessibility (4.5:1 text, 3:1 UI)
```

### Phase 3: Parse & Write Output

```bash
style_cards_data = parse_json(claude_response)
Write({file_path: "{base_path}/style-extraction/style-cards.json", content: style_cards_data})
```

### Phase 4: Completion

```javascript
TodoWrite({todos: [
  {content: "Validate inputs and create directories", status: "completed", activeForm: "Validating inputs"},
  {content: extraction_mode == "explore" ? "Analyze design space for maximum contrast" : "Skip design space analysis (imitate mode)", status: "completed", activeForm: extraction_mode == "explore" ? "Analyzing design space" : "Skipping analysis"},
  {content: extraction_mode == "explore" ? `Generate ${variants_count} divergent design directions` : "Prepare for high-fidelity extraction", status: "completed", activeForm: extraction_mode == "explore" ? "Generating directions" : "Preparing extraction"},
  {content: extraction_mode == "explore" ? "Save design space analysis for consolidation" : "Skip design space output", status: "completed", activeForm: extraction_mode == "explore" ? "Saving design space analysis" : "Skipping output"},
  {content: `Generate ${variants_count} ${extraction_mode == "explore" ? "contrasting" : "high-fidelity"} style variant${variants_count > 1 ? "s" : ""}`, status: "completed", activeForm: "Generating variants"}
]});
```

**Completion Message**:
```
✅ Style extraction complete for session: {session_id}

Mode: {extraction_mode == "imitate" ? "🎯 IMITATE (high-fidelity)" : "🎨 EXPLORE (contrast analysis)"}
Input mode: {input_mode}
{IF image mode: Images analyzed: {count}}
{IF prompt mode: Prompt: "{truncated_prompt}"}

{IF extraction_mode == "explore":
🎨 Design Space Analysis:
- Generated {variants_count} MAXIMALLY CONTRASTING design directions
- Min pairwise contrast distance: {design_space_analysis.contrast_verification.min_pairwise_distance}
- Strategy: {design_space_analysis.contrast_verification.strategy}
}
{IF extraction_mode == "imitate":
🎯 Imitation Mode:
- High-fidelity single style extraction
- Design space divergence skipped for faster execution
}

Generated {variants_count} style variant{variants_count > 1 ? "s" : ""}:
{FOR each card: - {card.name} ({card.id}) - {card.design_philosophy}}

📂 Outputs:
- {base_path}/style-extraction/style-cards.json
{IF extraction_mode == "explore": - {base_path}/style-extraction/design-space-analysis.json}

Next: /workflow:ui-design:consolidate --session {session_id} --variants {variants_count} [--layout-variants <count>]

Note: When called from /workflow:ui-design:{extraction_mode == "imitate" ? "imitate" : "explore"}-auto, consolidation is triggered automatically.
```

## Output Structure

```
.workflow/WFS-{session}/design-{run_id}/style-extraction/
├── style-cards.json              # Complete style variants with token proposals
└── design-space-analysis.json    # Design directions (explore mode only)

OR (standalone mode):

.workflow/.design/{run_id}/style-extraction/
├── style-cards.json
└── design-space-analysis.json    # Only in explore mode
```

### style-cards.json Format

**Schema Structure**:

```json
{
  "extraction_metadata": {"session_id": "string", "input_mode": "image|text|hybrid",
                           "timestamp": "ISO 8601", "variants_count": "number"},
  "style_cards": [
    {
      "id": "variant-{n}", "name": "Concise Style Name (2-3 words)",
      "description": "2-3 sentence description of visual language and UX",
      "design_philosophy": "Core design principles for this variant",
      "preview": {"primary": "oklch(...)", "background": "oklch(...)",
                  "font_heading": "Font family, fallbacks", "border_radius": "value"},
      "proposed_tokens": {
        "colors": {
          "brand": {"primary": "oklch(...)", "secondary": "oklch(...)", "accent": "oklch(...)"},
          "surface": {"background": "oklch(...)", "elevated": "oklch(...)", "overlay": "oklch(...)"},
          "semantic": {"success": "oklch(...)", "warning": "oklch(...)", "error": "oklch(...)", "info": "oklch(...)"},
          "text": {"primary": "oklch(...)", "secondary": "oklch(...)", "tertiary": "oklch(...)", "inverse": "oklch(...)"},
          "border": {"default": "oklch(...)", "strong": "oklch(...)", "subtle": "oklch(...)"}
        },
        "typography": {
          "font_family": {"heading": "...", "body": "...", "mono": "..."},
          "font_size": {"xs": "...", "sm": "...", "base": "...", "lg": "...", "xl": "...", "2xl": "...", "3xl": "...", "4xl": "..."},
          "font_weight": {"normal": "400", "medium": "500", "semibold": "600", "bold": "700"},
          "line_height": {"tight": "1.25", "normal": "1.5", "relaxed": "1.75"},
          "letter_spacing": {"tight": "-0.025em", "normal": "0", "wide": "0.025em"}
        },
        "spacing": {"0": "0", "1": "0.25rem", "2": "0.5rem", "3": "0.75rem", "4": "1rem",
                    "5": "1.25rem", "6": "1.5rem", "8": "2rem", "10": "2.5rem", "12": "3rem",
                    "16": "4rem", "20": "5rem", "24": "6rem"},
        "border_radius": {"none": "0", "sm": "0.25rem", "md": "0.5rem", "lg": "0.75rem",
                          "xl": "1rem", "full": "9999px"},
        "shadows": {"sm": "0 1px 2px oklch(0.00 0.00 0 / 0.05)",
                    "md": "0 4px 6px oklch(0.00 0.00 0 / 0.07)",
                    "lg": "0 10px 15px oklch(0.00 0.00 0 / 0.10)",
                    "xl": "0 20px 25px oklch(0.00 0.00 0 / 0.15)"},
        "breakpoints": {"sm": "640px", "md": "768px", "lg": "1024px", "xl": "1280px", "2xl": "1536px"}
      }
    }
    // Repeat structure for variants_count total (variant-1, variant-2, ..., variant-n)
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

- **No images found**: Report glob pattern and suggest corrections
- **Invalid prompt**: Require non-empty string for text mode
- **Claude JSON parsing error**: Retry with stricter format instructions
- **Invalid session**: Create standalone session automatically in `.workflow/.scratchpad/`
- **Invalid variant count**: Clamp to 1-5 range and warn user

## Key Features

1. **🚀 AI-Driven Design Space Exploration** 🆕
   - Phase 0.5: AI analyzes requirements and generates MAXIMALLY CONTRASTING design directions
   - Uses 6-dimensional design attribute space (color saturation, visual weight, formality, organic/geometric, innovation, density)
   - Ensures each variant occupies a distinct region of the design spectrum
   - Generates search keywords and anti-patterns for each variant
   - Provides contrast verification with minimum pairwise distance metrics

2. **🎯 Variant-Specific Design Directions** 🆕
   - AI generates search keywords and anti-patterns for each variant
   - Each variant has distinct design philosophy (e.g., "minimal brutalist" vs "bold vibrant")
   - Philosophy-specific keywords guide synthesis
   - Design space analysis saved for consolidation phase
   - Trend research deferred to consolidation for better integration

3. **🔒 Maximum Contrast Guarantee**
   - AI-driven divergence ensures variants are maximally distant in attribute space
   - Each variant has distinct: philosophy, color saturation, visual weight, formality, etc.
   - Explicit anti-patterns prevent variants from borrowing each other's characteristics
   - Contrast verification built into design space analysis

4. **100% Claude-Native Analysis**
   - No external tools (gemini-wrapper, codex, or MCP) - pure Claude
   - Single-pass comprehensive analysis guided by design space analysis
   - Fast, deterministic style synthesis without external dependencies

5. **Streamlined Output**
   - Single file (`style-cards.json`) vs. multiple scattered files
   - Eliminates `semantic_style_analysis.json`, `design-tokens.json`, `tailwind-tokens.js` clutter
   - Each variant contains complete token proposals embedded

6. **Flexible Input Modes**
   - Image-only: Analyze visual references through each variant's philosophical lens
   - Text-only: Generate from descriptions with maximum divergence
   - Hybrid: Text guides image analysis while maintaining variant independence
   - All modes enhanced with AI-driven design space analysis

7. **Context-Aware & Dynamic**
   - Extracts design keywords from user prompts (e.g., "minimalist", "Linear.app")
   - Considers project type from brainstorming artifacts
   - Dynamically generates design directions based on project context
   - No hardcoded design philosophies - fully adaptive

8. **Production-Ready Token Proposals**
   - Complete design system proposals per variant
   - OKLCH color format for perceptual uniformity and accessibility
   - Semantic naming conventions
   - WCAG AA accessibility considerations built-in
   - Variant-specific token sets (not generic)

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
