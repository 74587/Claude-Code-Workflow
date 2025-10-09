---
name: consolidate
description: Consolidate style variants into independent design systems and plan layout strategies
usage: /workflow:ui-design:consolidate [--base-path <path>] [--session <id>] [--variants <count>] [--layout-variants <count>]
argument-hint: "[--base-path \".workflow/WFS-xxx/design-run-xxx\"] [--variants 3] [--layout-variants 3]"
parameters:
  - name: --variants
    type: number
    default: all available variants from style-cards.json
    description: "Number of style variants to consolidate (1-N). Processes first N variants from style-cards.json. Creates style-N directories."
  - name: --layout-variants
    type: number
    default: 3
    description: "Number of layout strategies to generate (1-5). Creates dynamic layout plans based on project context and modern trends."
  - name: --session
    type: string
    description: "Workflow session ID (e.g., WFS-auth). Finds latest design run in session directory."
  - name: --base-path
    type: string
    description: "Custom base path for input/output. Overrides --session if provided."
examples:
  - /workflow:ui-design:consolidate --base-path ".workflow/WFS-auth/design-run-20250109-143022" --variants 3 --layout-variants 3
  - /workflow:ui-design:consolidate --session WFS-auth --variants 2 --layout-variants 2
  - /workflow:ui-design:consolidate --base-path "./.workflow/.design/run-20250109-150533"  # Uses all variants, default 3 layouts
  - /workflow:ui-design:consolidate --session WFS-auth --layout-variants 2  # Process all variants from extraction
allowed-tools: TodoWrite(*), Read(*), Write(*), Bash(*), Task(*)
---

# Design System Consolidation & Layout Planning Command

## Overview
Consolidate user-selected style variants into **independent production-ready design systems** AND plan layout strategies for UI generation. This command serves as the **Design Planning Phase**, producing all strategic decisions needed for the subsequent generation phase.

## Core Philosophy
- **Design Planning Hub**: Centralizes both style consolidation and layout strategy planning
- **Agent-Driven**: Uses ui-design-agent for multi-file generation efficiency
- **Separate Design Systems**: Generates N independent design systems (one per variant)
- **Token Refinement**: Refines `proposed_tokens` from each variant into complete systems
- **Layout Strategy Definition**: Plans and documents layout variants for generation
- **Intelligent Synthesis**: Ensures completeness and consistency
- **Production-Ready**: Complete design system(s) with documentation
- **Matrix-Ready**: Supports style × layout matrix exploration in generate phase

## Execution Protocol

### Phase 1: Path Resolution & Variant Loading

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

### Phase 2: Variant Selection

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

REPORT: "📦 Generating {variants_count} independent design systems"
```

### Phase 2.5: Layout Strategy Planning (Dynamic Generation)

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

### Phase 3: Load Design Context (Optional)

```bash
# Load brainstorming context if available
design_context = ""
IF exists({base_path}/.brainstorming/synthesis-specification.md):
    design_context = Read({base_path}/.brainstorming/synthesis-specification.md)
ELSE IF exists({base_path}/.brainstorming/ui-designer/analysis.md):
    design_context = Read({base_path}/.brainstorming/ui-designer/analysis.md)
```

### Phase 4: Design System Synthesis (Agent Execution)

```bash
REPORT: "🤖 Using agent for separate design system generation..."

# Prepare agent task prompt
agent_task_prompt = """
Generate {variants_count} independent production-ready design systems, one for each style variant.

SESSION: {session_id}
MODE: Separate design system generation

VARIANTS TO PROCESS: {variants_count}

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

TASK: For EACH variant, generate a complete, production-ready design system.

REFINEMENT RULES (apply to each variant):
1. **Complete Token Coverage**: Ensure all categories are present (colors, typography, spacing, etc.)
2. **Fill Gaps**: If any tokens are missing, generate appropriate values based on the variant's philosophy
3. **Maintain Style Identity**: Preserve the unique characteristics of this variant
4. **Semantic Naming**: Use clear, semantic names (e.g., "brand-primary" not "color-1")
5. **Accessibility**: Validate WCAG AA contrast ratios (4.5:1 text, 3:1 UI)
6. **OKLCH Format**: All colors must use oklch(L C H / A) format
7. **Design Philosophy**: Expand and articulate the variant's design philosophy

OUTPUT STRUCTURE: For each variant {variant_id} (1 to {variants_count}), generate 2 files:

FILE 1: style-{variant_id}/design-tokens.json
{
  "colors": {
    "brand": { "primary": "oklch(...)", "secondary": "oklch(...)", "accent": "oklch(...)" },
    "surface": { "background": "oklch(...)", "elevated": "oklch(...)", "overlay": "oklch(...)" },
    "semantic": { "success": "oklch(...)", "warning": "oklch(...)", "error": "oklch(...)", "info": "oklch(...)" },
    "text": { "primary": "oklch(...)", "secondary": "oklch(...)", "tertiary": "oklch(...)", "inverse": "oklch(...)" },
    "border": { "default": "oklch(...)", "strong": "oklch(...)", "subtle": "oklch(...)" }
  },
  "typography": { "font_family": {...}, "font_size": {...}, "font_weight": {...}, "line_height": {...}, "letter_spacing": {...} },
  "spacing": { "0": "0", "1": "0.25rem", ..., "24": "6rem" },
  "border_radius": { "none": "0", "sm": "0.25rem", ..., "full": "9999px" },
  "shadows": { "sm": "...", "md": "...", "lg": "...", "xl": "..." },
  "breakpoints": { "sm": "640px", ..., "2xl": "1536px" }
}

FILE 2: style-{variant_id}/style-guide.md
# Design System Style Guide - {variant.name}

## Design Philosophy
{Expanded variant philosophy}

## Color System
### Brand Colors, Surface Colors, Semantic Colors, Text Colors, Border Colors
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

RESPONSE FORMAT:
For each variant, provide clearly labeled sections:

===== style-1/design-tokens.json =====
{JSON content}

===== style-1/style-guide.md =====
{Markdown content}

===== style-2/design-tokens.json =====
{JSON content}

===== style-2/style-guide.md =====
{Markdown content}

... (repeat for all {variants_count} variants)

IMPORTANT:
- Generate files for ALL {variants_count} variants
- Use sequential IDs: style-1, style-2, ..., style-{variants_count}
- Each variant must be complete and independent
- Maintain consistent structure across all variants
"""

# Execute agent task
Task(
  subagent_type="ui-design-agent",
  description="Generate {variants_count} separate design systems",
  prompt=agent_task_prompt
)

REPORT: "✅ Agent task dispatched for {variants_count} design systems"
```

### Phase 5: Process Agent Results and Generate Report
```bash
REPORT: "📝 Processing agent output for {variants_count} design systems..."

# Parse agent's response - agent returns all files in labeled sections
agent_output = get_agent_response()

# Extract and write files for each variant
FOR variant_id IN range(1, variants_count + 1):
    CREATE: {base_path}/style-consolidation/style-{variant_id}/

    # Extract design tokens
    design_tokens_section = extract_section(agent_output, f"===== style-{variant_id}/design-tokens.json =====")
    design_tokens = parse_json(design_tokens_section)
    Write({base_path}/style-consolidation/style-{variant_id}/design-tokens.json, JSON.stringify(design_tokens, null, 2))

    # Extract style guide
    style_guide_section = extract_section(agent_output, f"===== style-{variant_id}/style-guide.md =====")
    Write({base_path}/style-consolidation/style-{variant_id}/style-guide.md, style_guide_section)

    REPORT: "  ✅ style-{variant_id}/ written"
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
└── layout-strategies.json       # Layout variant definitions
```

### Phase 6: Completion & Reporting

```javascript
TodoWrite({
  todos: [
    {content: "Load session and style cards", status: "completed", activeForm: "Loading style cards"},
    {content: "Select variants for consolidation", status: "completed", activeForm: "Selecting variants"},
    {content: "Plan layout strategies", status: "completed", activeForm: "Planning layout strategies"},
    {content: "Load design context from brainstorming", status: "completed", activeForm: "Loading context"},
    {content: "Generate design systems via agent", status: "completed", activeForm: "Generating design systems"},
    {content: "Process agent results and write files", status: "completed", activeForm: "Writing output files"}
  ]
});
```

**Completion Message**:
```
✅ Design consolidation & layout planning complete for session: {session_id}

Generated {variants_count} independent design systems:
{FOR each variant: - {variant.name} ({variant.id})}

Layout Strategies Planned: {layout_variants}
{FOR each strategy: - Layout {strategy.id}: {strategy.name}}

📂 Output: {base_path}/style-consolidation/
├── style-1/ (design-tokens.json, style-guide.md)
├── style-2/ (same structure)
├── style-{variants_count}/ (same structure)
└── layout-strategies.json

Next: /workflow:ui-design:generate --session {session_id} --style-variants {variants_count} --layout-variants {layout_variants} --pages "dashboard,auth"

Note: When called from /workflow:ui-design:auto, UI generation is triggered automatically.
The generate command will read layout strategies from layout-strategies.json.
```

## design-tokens.json Format

**Token structure** (all variants follow identical structure with different values):

```json
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
  "spacing": { "0": "0", "1": "0.25rem", ..., "24": "6rem" },
  "border_radius": { "none": "0", "sm": "0.25rem", ..., "full": "9999px" },
  "shadows": { "sm": "...", "md": "...", "lg": "...", "xl": "..." },
  "breakpoints": { "sm": "640px", "md": "768px", "lg": "1024px", "xl": "1280px", "2xl": "1536px" }
}
```

**Requirements**: All colors in OKLCH format, complete token coverage, semantic naming

## Error Handling

- **No style cards found**: Report error, suggest running `/workflow:ui-design:extract` first
- **Invalid variant count**: List available count, auto-select all if called from auto workflow
- **Parsing errors**: Retry with stricter format instructions
- **Validation warnings**: Report but continue (non-blocking)
- **Missing categories**: Claude will fill gaps based on design philosophy

## Key Features

1. **Agent-Driven Architecture**
   - Uses ui-design-agent for multi-file generation efficiency
   - Parallel generation of N independent design systems
   - Structured output parsing with labeled sections

2. **Separate Design Systems (Matrix-Ready)**
   - Generates N independent design systems (one per variant)
   - Each variant maintains unique style identity
   - Enables style × layout matrix exploration in generate phase

3. **Dynamic Layout Strategy Generation** 🆕
   - Uses Exa MCP to research current UI/UX layout trends (2024-2025)
   - Generates layout strategies based on project context and modern patterns
   - Adapts to project type (dashboard, marketing, SaaS, etc.)
   - Balances innovation with usability

4. **Token Refinement**
   - Reads `proposed_tokens` from style cards directly
   - Agent refines each variant into complete design system
   - Fills gaps while maintaining style identity

5. **Complete Design System Output**
   - design-tokens.json (CSS tokens per variant)
   - style-guide.md (documentation per variant)
   - layout-strategies.json (dynamic layout plans)

6. **Production-Ready Quality**
   - WCAG AA accessibility validation
   - OKLCH color format for perceptual uniformity
   - Semantic token naming
   - Complete token coverage

7. **Streamlined Workflow**
   - Sequential phases with clear responsibilities
   - Agent handles complex multi-file generation
   - Reproducible with deterministic structure
   - Context-aware (integrates brainstorming artifacts)

## Integration Points

- **Input**:
  - `style-cards.json` from `/workflow:ui-design:extract` (with `proposed_tokens`)
  - `--variants` parameter (default: all variants)
  - `--layout-variants` parameter (default: 3)
- **Output**:
  - Style Systems: `style-consolidation/style-{n}/design-tokens.json` for matrix mode generation
  - Layout Planning: `layout-strategies.json` consumed by `/workflow:ui-design:generate`
- **Context**: Optional `synthesis-specification.md` or `ui-designer/analysis.md`
- **Auto Integration**: Automatically triggered by `/workflow:ui-design:auto` workflow
- **Next Command**: `/workflow:ui-design:generate --style-variants N --layout-variants M` reads design tokens and layout strategies
