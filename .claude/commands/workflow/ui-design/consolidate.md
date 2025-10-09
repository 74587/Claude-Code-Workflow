---
name: consolidate
description: Consolidate style variants into unified or separate design systems and plan layout strategies
usage: /workflow:ui-design:consolidate [--base-path <path>] [--session <id>] [--variants <count>] [--keep-separate] [--layout-variants <count>]
argument-hint: "[--base-path \".workflow/WFS-xxx/design-run-xxx\"] [--variants 3] [--keep-separate] [--layout-variants 3]"
examples:
  - /workflow:ui-design:consolidate --base-path ".workflow/WFS-auth/design-run-20250109-143022" --variants 3 --keep-separate --layout-variants 3
  - /workflow:ui-design:consolidate --session WFS-auth --variants 2 --layout-variants 2
  - /workflow:ui-design:consolidate --base-path "./.workflow/.design/run-20250109-150533" --layout-variants 3
allowed-tools: TodoWrite(*), Read(*), Write(*), Bash(*)
---

# Design System Consolidation & Layout Planning Command

## Overview
Consolidate user-selected style variants into unified or separate production-ready design systems AND plan layout strategies for UI generation. This command serves as the **Design Planning Phase**, producing all strategic decisions needed for the subsequent generation phase.

## Core Philosophy
- **Design Planning Hub**: Centralizes both style consolidation and layout strategy planning
- **Claude-Native**: 100% Claude-driven consolidation, no external tools
- **Token Merging**: Combines `proposed_tokens` from selected variants
- **Layout Strategy Definition**: Plans and documents layout variants for generation
- **Intelligent Synthesis**: Resolves conflicts, ensures consistency
- **Production-Ready**: Complete design system(s) with documentation
- **Dual Mode**: Unified (1 merged system) or Separate (N independent systems)

## Execution Protocol

### 🔄 Common Phases (All Modes)

These phases are executed identically regardless of consolidation mode.

#### Phase 1: Path Resolution & Variant Loading

```bash
# Determine base path
IF --base-path provided:
    base_path = {provided_base_path}
ELSE IF --session provided:
    # Find latest design run in session
    base_path = find_latest_path_matching(".workflow/WFS-{session}/design-*")
ELSE:
    base_path = find_latest_path_matching(".workflow/.design/*")

# Verify extraction output exists
style_cards_path = "{base_path}/style-extraction/style-cards.json"
VERIFY: exists(style_cards_path)

# Load style cards
style_cards = Read(style_cards_path)
total_variants = len(style_cards.style_cards)
```

#### Phase 2: Variant Selection & Mode Determination

```bash
# Determine how many variants to consolidate
IF --variants provided:
    variants_count = {provided_count}
    VALIDATE: 1 <= variants_count <= total_variants
ELSE:
    variants_count = total_variants

# Select first N variants
selected_variants = style_cards.style_cards[0:variants_count]
VERIFY: selected_variants.length > 0

# Determine consolidation mode
IF --keep-separate provided:
    consolidation_mode = "separate"  # Generate N independent design systems
    REPORT: "Mode: Separate - generating {variants_count} independent design systems"
ELSE:
    consolidation_mode = "unified"   # Merge into 1 design system
    REPORT: "Mode: Unified - merging {variants_count} variants into one design system"
```

#### Phase 2.5: Layout Strategy Planning (Dynamic Generation)

```bash
# Determine layout variants count
IF --layout-variants provided:
    layout_variants = {provided_count}
    VALIDATE: 1 <= layout_variants <= 5
ELSE:
    layout_variants = 3  # Default to 3 layout strategies

REPORT: "📐 Planning {layout_variants} layout strategies (dynamic generation)"

# Step 1: Gather project context for layout planning
project_context = ""
IF exists({base_path}/.brainstorming/synthesis-specification.md):
    project_context = Read({base_path}/.brainstorming/synthesis-specification.md)
ELSE IF exists({base_path}/.brainstorming/ui-designer/analysis.md):
    project_context = Read({base_path}/.brainstorming/ui-designer/analysis.md)

# Extract project type and requirements from context
project_hints = extract_project_type(project_context)  # e.g., "dashboard", "marketing site", "SaaS platform"

# Step 2: Search for current UI/UX layout trends using Exa MCP
REPORT: "🔍 Searching for modern UI layout patterns..."
exa_query = "modern web UI layout patterns design systems {project_hints} 2024 2025"
layout_trends = mcp__exa__get_code_context_exa(
  query=exa_query,
  tokensNum="dynamic"
)

# Step 3: Generate layout strategies dynamically with Claude
REPORT: "🎨 Generating {layout_variants} custom layout strategies..."

layout_synthesis_prompt = """
Generate EXACTLY {layout_variants} distinct, modern UI layout strategies for this project.

PROJECT CONTEXT:
{project_context}

CURRENT LAYOUT TRENDS (from web research):
{layout_trends}

REQUIREMENTS:
1. Generate EXACTLY {layout_variants} unique layout strategies (not more, not less)
2. Each layout must be unique and serve different use cases
3. Consider modern design trends from 2024-2025
4. Align with project type: {project_hints}
5. Balance innovation with usability
6. Cover diverse layout paradigms (grid-based, asymmetric, minimal, single-column, sidebar-based, etc.)

OUTPUT FORMAT (JSON):
You MUST generate {layout_variants} strategy objects in the "strategies" array.

Example for layout_variants=3:
{
  "layout_variants_count": 3,
  "strategies": [
    {
      "id": "layout-1",
      "name": "Grid Dashboard",
      "description": "Traditional grid-based layout with sidebar navigation. Clear visual hierarchy with card-based content areas. Ideal for data-heavy dashboards."
    },
    {
      "id": "layout-2",
      "name": "Asymmetric Flow",
      "description": "Dynamic asymmetric layout with floating content blocks. Natural reading flow with varied content widths. Perfect for content-focused applications."
    },
    {
      "id": "layout-3",
      "name": "Minimal Centered",
      "description": "Clean centered layout with generous whitespace. Single-column focus with subtle hierarchy. Best for documentation or blog-style interfaces."
    }
  ]
}

IMPORTANT:
- The "strategies" array MUST contain EXACTLY {layout_variants} objects
- Each strategy must have sequential IDs: "layout-1", "layout-2", ..., "layout-{layout_variants}"
- Each strategy name must be concise (max 3 words)
- Each description must be detailed (2-3 sentences covering structure, hierarchy, use cases)

RESPONSE FORMAT:
Provide ONLY the JSON object, no additional text before or after.

===== layout-strategies.json =====
{JSON content}
"""

# Execute synthesis
claude_response = synthesize_with_claude(layout_synthesis_prompt)
layout_strategies = parse_json_response(claude_response)

# Step 4: Write layout strategies to file
Write({base_path}/style-consolidation/layout-strategies.json, JSON.stringify(layout_strategies, null, 2))

REPORT: "✅ Layout strategies defined: {[s.name for s in layout_strategies.strategies]}"
```

#### Phase 3: Load Design Context (Optional)

```bash
# Load brainstorming context if available
design_context = ""
IF exists({base_path}/.brainstorming/synthesis-specification.md):
    design_context = Read({base_path}/.brainstorming/synthesis-specification.md)
ELSE IF exists({base_path}/.brainstorming/ui-designer/analysis.md):
    design_context = Read({base_path}/.brainstorming/ui-designer/analysis.md)
```

---

### 🔀 Mode-Specific Phases

**Execution branches based on `consolidation_mode`:**

#### Branch A: Unified Mode

**When**: `consolidation_mode == "unified"` (default)

**Goal**: Merge all selected variants into a single, cohesive design system.

**Phase 4A: Unified Design System Synthesis**
```
Create a unified, production-ready design system by consolidating the following style variants.

SESSION: {session_id}
SELECTED VARIANTS: {variant_ids}

VARIANT DATA:
{FOR each variant IN selected_variants:
  ---
  Variant ID: {variant.id}
  Name: {variant.name}
  Description: {variant.description}
  Design Philosophy: {variant.design_philosophy}

  Proposed Tokens:
  {JSON.stringify(variant.proposed_tokens, null, 2)}
  ---
}

{IF design_context:
DESIGN CONTEXT (from brainstorming):
{design_context}
}

TASK: Consolidate these {selected_variants.length} style variant(s) into a single, cohesive design system.

CONSOLIDATION RULES:
1. **Merge Token Proposals**: Combine all `proposed_tokens` into one unified system
2. **Resolve Conflicts**: When variants disagree, choose the most appropriate value or create a balanced compromise
3. **Maintain Completeness**: Ensure all token categories are present (colors, typography, spacing, etc.)
4. **Semantic Naming**: Use clear, semantic names (e.g., "brand-primary" not "color-1")
5. **Accessibility**: Validate WCAG AA contrast ratios (4.5:1 text, 3:1 UI)
6. **OKLCH Format**: All colors must use oklch(L C H / A) format
7. **Design Philosophy**: Synthesize a unified philosophy statement from variant descriptions

OUTPUT: Generate the following files:

FILE 1: design-tokens.json
{
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

FILE 2: style-guide.md
# Design System Style Guide

## Design Philosophy
{Synthesized philosophy from all variants}

## Color System
### Brand Colors
- **Primary**: {value} - {usage description}
- **Secondary**: {value} - {usage description}
- **Accent**: {value} - {usage description}

### Surface Colors, Semantic Colors, Text Colors, Border Colors
{List all with usage and accessibility notes}

## Typography
### Font Families, Type Scale, Usage Examples
{Complete typography documentation}

## Spacing System, Component Guidelines
{Spacing patterns and component token examples}

## Accessibility
- All text meets WCAG AA (4.5:1 minimum)
- UI components meet WCAG AA (3:1 minimum)
- Focus indicators are clearly visible

FILE 3: consolidation-report.json
{
  "session_id": "{session_id}",
  "consolidation_mode": "unified",
  "timestamp": "{ISO timestamp}",
  "style_systems": {
    "consolidated_variants": {variant_ids},
    "variant_count": {selected_variants.length},
    "validation_results": {
      "colors": { "total": {count}, "wcag_aa_compliant": {count}, "warnings": [{issues}] },
      "typography": { "font_families": {count}, "scale_sizes": {count} },
      "spacing": { "scale_values": {count} },
      "accessibility": { "status": "pass|warnings", "issues": [{list}] },
      "completeness": {
        "required_categories": ["colors", "typography", "spacing", "border_radius", "shadows", "breakpoints"],
        "present_categories": [{list}],
        "missing_categories": [{list if any}]
      }
    }
  },
  "layout_strategies": {
    "count": {layout_variants},
    "strategies": {READ from layout-strategies.json}
  }
}

RESPONSE FORMAT:
Provide each file's content in clearly labeled sections:

===== design-tokens.json =====
{JSON content}

===== style-guide.md =====
{Markdown content}

===== consolidation-report.json =====
{JSON content}
```

**Phase 5A: Unified Output**

```bash
# Parse Claude's response
CREATE: {base_path}/style-consolidation/
parsed_output = parse_claude_response(claude_response)

Write({base_path}/style-consolidation/design-tokens.json, parsed_output.design_tokens)
Write({base_path}/style-consolidation/style-guide.md, parsed_output.style_guide)
Write({base_path}/style-consolidation/consolidation-report.json, parsed_output.consolidation_report)
```

**Output Structure**:
```
{base_path}/style-consolidation/
├── design-tokens.json           # Merged token definitions
├── style-guide.md               # Comprehensive design documentation
├── layout-strategies.json       # Layout variant definitions
└── consolidation-report.json    # Unified validation & planning report
```

---

#### Branch B: Separate Mode

**When**: `consolidation_mode == "separate"` (--keep-separate flag)

**Goal**: Generate N independent design systems, each refining one style variant.

**Phase 4B: Separate Design System Synthesis**

For each variant, use this synthesis prompt:
```
Create a production-ready design system for the following style variant.

SESSION: {session_id}
VARIANT: {variant.id}

VARIANT DATA:
  Name: {variant.name}
  Description: {variant.description}
  Design Philosophy: {variant.design_philosophy}

  Proposed Tokens:
  {JSON.stringify(variant.proposed_tokens, null, 2)}

{IF design_context:
DESIGN CONTEXT (from brainstorming):
{design_context}
}

TASK: Refine this style variant into a complete, production-ready design system.

REFINEMENT RULES:
1. **Complete Token Coverage**: Ensure all categories are present (colors, typography, spacing, etc.)
2. **Fill Gaps**: If any tokens are missing, generate appropriate values based on the variant's philosophy
3. **Maintain Style Identity**: Preserve the unique characteristics of this variant
4. **Semantic Naming**: Use clear, semantic names (e.g., "brand-primary" not "color-1")
5. **Accessibility**: Validate WCAG AA contrast ratios (4.5:1 text, 3:1 UI)
6. **OKLCH Format**: All colors must use oklch(L C H / A) format
7. **Design Philosophy**: Expand and articulate the variant's design philosophy

OUTPUT: Generate 2 files (design-tokens.json, style-guide.md) - validation will be aggregated later

RESPONSE FORMAT:
Provide each file's content in clearly labeled sections:

===== design-tokens.json =====
{JSON content}

===== style-guide.md =====
{Markdown content}
```

**Phase 5B: Separate Output**
```bash
# Parse each variant's response
FOR variant_id IN range(1, variants_count + 1):
    CREATE: {base_path}/style-consolidation/style-{variant_id}/
    parsed_output = parse_claude_response(claude_responses[variant_id - 1])

    Write({base_path}/style-consolidation/style-{variant_id}/design-tokens.json, parsed_output.design_tokens)
    Write({base_path}/style-consolidation/style-{variant_id}/style-guide.md, parsed_output.style_guide)

# Generate unified consolidation report for all variants
consolidation_report = {
  "session_id": session_id,
  "consolidation_mode": "separate",
  "timestamp": ISO_timestamp,
  "style_systems": {
    "variant_count": variants_count,
    "variants": []
  },
  "layout_strategies": Read({base_path}/style-consolidation/layout-strategies.json)
}

# Aggregate validation data from all style variants
FOR variant_id IN range(1, variants_count + 1):
    design_tokens = Read({base_path}/style-consolidation/style-{variant_id}/design-tokens.json)
    validation_data = validate_design_tokens(design_tokens)
    consolidation_report.style_systems.variants.append({
      "id": "style-{variant_id}",
      "validation": validation_data
    })

Write({base_path}/style-consolidation/consolidation-report.json, JSON.stringify(consolidation_report, null, 2))
```

**Output Structure**:
```
{base_path}/style-consolidation/
├── style-1/
│   ├── design-tokens.json       # Style 1 tokens
│   └── style-guide.md           # Style 1 docs
├── style-2/
│   └── ... (same structure)
├── style-N/
│   └── ... (same structure)
├── layout-strategies.json       # Layout variant definitions
└── consolidation-report.json    # Unified validation for all styles + layout plan
```

---

### 🎯 Common Completion Phase

**Phase 6: Completion & Reporting** (executed after mode-specific phases)

```javascript
TodoWrite({
  todos: [
    {content: "Load session and style cards", status: "completed", activeForm: "Loading style cards"},
    {content: "Select variants and determine mode", status: "completed", activeForm: "Selecting variants"},
    {content: "Plan layout strategies", status: "completed", activeForm: "Planning layout strategies"},
    {content: "Load design context from brainstorming", status: "completed", activeForm: "Loading context"},
    {content: "Synthesize design system(s) with Claude", status: "completed", activeForm: "Synthesizing design system"},
    {content: "Write consolidated design system files", status: "completed", activeForm: "Writing output files"},
    {content: "Generate unified consolidation report", status: "completed", activeForm: "Generating report"}
  ]
});
```

**Completion Message**:
```
✅ Design consolidation & layout planning complete for session: {session_id}

Mode: {consolidation_mode}
Consolidated {selected_variants.length} style variant(s):
{FOR each variant: - {variant.name} ({variant.id})}

Layout Strategies Planned: {layout_variants}
{FOR each strategy: - Layout {strategy.id}: {strategy.name}}

{IF unified mode:
Validation Summary:
- Colors: {total_colors} (WCAG AA: {compliant_count}/{total_colors})
- Typography: {scale_count} sizes
- Spacing: {scale_count} values
- Accessibility: {status}

📂 Output: {base_path}/style-consolidation/
  ├── design-tokens.json
  ├── style-guide.md
  ├── layout-strategies.json          [NEW]
  └── consolidation-report.json       [NEW - replaces validation-report.json]
}

{IF separate mode:
Generated {variants_count} independent design systems:

📂 Output: {base_path}/style-consolidation/
├── style-1/ (design-tokens.json, style-guide.md)
├── style-2/ (same structure)
├── style-{variants_count}/ (same structure)
├── layout-strategies.json          [NEW]
└── consolidation-report.json       [NEW - unified report for all variants]
}

Next: /workflow:ui-design:generate --session {session_id} {IF separate: --style-variants {variants_count} --layout-variants {layout_variants}} --pages "dashboard,auth"

Note: When called from /workflow:ui-design:auto, UI generation is triggered automatically.
The generate command will now read layout strategies from layout-strategies.json.
```

## design-tokens.json Format

Complete token structure with OKLCH colors and semantic naming:

```json
{
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
```

## Error Handling

- **No style cards found**: Report error, suggest running `/workflow:ui-design:extract` first
- **Invalid variant count**: List available count, auto-select all if called from auto workflow
- **Parsing errors**: Retry with stricter format instructions
- **Validation warnings**: Report but continue (non-blocking)
- **Missing categories**: Claude will fill gaps based on design philosophy

## Key Features

1. **Zero External Dependencies for Style Consolidation**
   - No `gemini-wrapper`, no `codex` for style synthesis - pure Claude
   - Single-pass comprehensive prompt generates all outputs

2. **Dual Consolidation Modes**
   - Unified: Merge N variants → 1 design system (default)
   - Separate: Refine N variants → N independent systems (--keep-separate)

3. **Dynamic Layout Strategy Generation** 🆕
   - Uses Exa MCP to research current UI/UX layout trends (2024-2025)
   - Generates layout strategies based on project context and modern patterns
   - Adapts to project type (dashboard, marketing, SaaS, etc.)
   - Balances innovation with usability

4. **Direct Token Merging**
   - Reads `proposed_tokens` from style cards directly
   - Intelligent conflict resolution with clear rules

5. **Complete Design System Output**
   - design-tokens.json (CSS tokens)
   - style-guide.md (documentation)
   - layout-strategies.json (dynamic layout plans)
   - consolidation-report.json (quality audit & planning)

6. **Production-Ready Quality**
   - WCAG AA accessibility validation
   - OKLCH color format for perceptual uniformity
   - Semantic token naming
   - Complete token coverage

7. **Streamlined Workflow**
   - Common phases (setup, context, completion) shared across modes
   - Mode-specific synthesis clearly separated
   - Reproducible with deterministic structure
   - Context-aware (integrates brainstorming artifacts)

## Integration Points

- **Input**:
  - `style-cards.json` from `/workflow:ui-design:extract` (with `proposed_tokens`)
  - `--layout-variants` parameter (default: 3)
- **Output**:
  - Style Systems:
    - Unified: `style-consolidation/design-tokens.json` for `/workflow:ui-design:generate`
    - Separate: `style-consolidation/style-{n}/design-tokens.json` for matrix mode generation
  - Layout Planning: `layout-strategies.json` consumed by `/workflow:ui-design:generate`
  - Unified Reporting: `consolidation-report.json` for audit and validation
- **Context**: Optional `synthesis-specification.md` or `ui-designer/analysis.md`
- **Auto Integration**: Automatically triggered by `/workflow:ui-design:auto` workflow
- **Next Command**: `/workflow:ui-design:generate` reads both design tokens and layout strategies
