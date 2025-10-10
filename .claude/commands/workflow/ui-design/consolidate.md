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
  - name: --session
    type: string
    description: "Workflow session ID (e.g., WFS-auth). Finds latest design run in session directory."
  - name: --base-path
    type: string
    description: "Custom base path for input/output. Overrides --session if provided."
examples:
  - /workflow:ui-design:consolidate --base-path ".workflow/WFS-auth/design-run-20250109-143022" --variants 3
  - /workflow:ui-design:consolidate --session WFS-auth --variants 2
  - /workflow:ui-design:consolidate --base-path "./.workflow/.design/run-20250109-150533"  # Uses all variants
  - /workflow:ui-design:consolidate --session WFS-auth  # Process all variants from extraction
allowed-tools: TodoWrite(*), Read(*), Write(*), Bash(*), Task(*)
---

# Design System Consolidation Command

## Overview
Consolidate user-selected style variants into **independent production-ready design systems**. This command serves as the **Style Planning Phase**, focusing exclusively on design tokens and style guides for the subsequent generation phase.

## Core Philosophy
- **Style System Focus**: Exclusively handles design system consolidation
- **Agent-Driven**: Uses ui-design-agent for multi-file generation efficiency
- **Separate Design Systems**: Generates N independent design systems (one per variant)
- **Token Refinement**: Refines `proposed_tokens` from each variant into complete systems
- **Intelligent Synthesis**: Ensures completeness and consistency
- **Production-Ready**: Complete design system(s) with documentation
- **Matrix-Ready**: Provides style variants for style × layout matrix exploration in generate phase

## Execution Protocol

### Phase 1: Path Resolution & Variant Loading

```bash
# Determine base path
IF --base-path: base_path = {provided_base_path}
ELSE IF --session: base_path = find_latest_path_matching(".workflow/WFS-{session}/design-*")
ELSE: base_path = find_latest_path_matching(".workflow/.design/*")

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
IF --variants:
    variants_count = {provided_count}
    VALIDATE: 1 <= variants_count <= total_variants
ELSE:
    variants_count = total_variants

# Select first N variants
selected_variants = style_cards.style_cards[0:variants_count]
VERIFY: selected_variants.length > 0

REPORT: "📦 Generating {variants_count} independent design systems"
```

### Phase 3: Load Design Context (Optional)

```bash
# Load brainstorming context if available
design_context = ""
IF exists({base_path}/.brainstorming/synthesis-specification.md):
    design_context = Read(synthesis-specification.md)
ELSE IF exists({base_path}/.brainstorming/ui-designer/analysis.md):
    design_context = Read(ui-designer/analysis.md)

# Load design space analysis from extraction phase
design_space_analysis = {}
design_space_path = "{base_path}/style-extraction/design-space-analysis.json"
IF exists(design_space_path):
    design_space_analysis = Read(design_space_path)
    REPORT: "📊 Loaded design space analysis with {len(design_space_analysis.divergent_directions)} variant directions"
ELSE:
    REPORT: "⚠️ No design space analysis found - trend research will be skipped"
```

### Phase 4: Design System Synthesis (Agent Execution)

```bash
REPORT: "🤖 Using agent for separate design system generation..."

# Create output directories
Bash(mkdir -p "{base_path}/style-consolidation/style-{{1..{variants_count}}}")

# Prepare agent task prompt
agent_task_prompt = """
Generate {variants_count} independent production-ready design systems with external trend research and WRITE them to the file system.

## Context
SESSION: {session_id}
MODE: Separate design system generation with MCP trend research
BASE_PATH: {base_path}
VARIANTS TO PROCESS: {variants_count}

## Variant Data
{FOR each variant IN selected_variants:
  ---
  Variant ID: {variant.id} | Name: {variant.name}
  Description: {variant.description}
  Design Philosophy: {variant.design_philosophy}
  Proposed Tokens: {JSON.stringify(variant.proposed_tokens, null, 2)}
  ---
}

{IF design_context: DESIGN CONTEXT (from brainstorming): {design_context}}

{IF design_space_analysis:
## Design Space Analysis (for MCP Research)
{JSON.stringify(design_space_analysis, null, 2)}

Note: Each variant has search_keywords and anti_keywords for trend research.
}

## Task
For EACH variant (1 to {variants_count}):
1. **Perform Variant-Specific Trend Research** (if design space analysis available)
2. **Refine design tokens** using research insights
3. **Generate and WRITE 2 files** to the file system

## Step 1: Variant-Specific Trend Research (MCP)

IF design_space_analysis is provided, FOR EACH variant:

1. **Extract Research Parameters** from design space analysis:
   - philosophy_name: The variant's design philosophy
   - search_keywords: Keywords for trend research
   - anti_keywords: Patterns to avoid

2. **Build Variant-Specific Queries**:
   ```javascript
   queries = [
     `{philosophy_name} UI design color palettes {search_keywords[:3]} 2024 2025`,
     `{philosophy_name} typography trends {search_keywords[:3]} web design 2024`,
     `{philosophy_name} layout patterns {search_keywords[:3]} design systems 2024`,
     `design systems {philosophy_name} NOT {anti_keywords[:2]}`
   ]
   ```

3. **Execute MCP Searches**:
   ```javascript
   trend_research = {
     colors: mcp__exa__get_code_context_exa(query=queries[0], tokensNum=2000),
     typography: mcp__exa__get_code_context_exa(query=queries[1], tokensNum=2000),
     layout: mcp__exa__get_code_context_exa(query=queries[2], tokensNum=2000),
     contrast: mcp__exa__get_code_context_exa(query=queries[3], tokensNum=2000)
   }
   ```

4. **Shared Accessibility Research** (execute once, apply to all variants):
   ```javascript
   accessibility_guidelines = mcp__exa__get_code_context_exa(
     query="WCAG 2.2 accessibility color contrast ARIA best practices 2024",
     tokensNum=1500
   )
   ```

5. **Use Research Results** to inform token refinement:
   - Color token refinement guided by `trend_research.colors`
   - Typography refinement guided by `trend_research.typography`
   - Layout spacing informed by `trend_research.layout`
   - Contrast validation using `trend_research.contrast` and `accessibility_guidelines`

IF design_space_analysis is NOT provided:
- Skip trend research
- Refine tokens based solely on variant's existing philosophy and proposed tokens

## Step 2: Refinement Rules (apply to each variant)
1. **Complete Token Coverage**: Ensure all categories present (colors, typography, spacing, etc.)
2. **Fill Gaps**: Generate missing tokens based on variant's philosophy and trend research
3. **Maintain Style Identity**: Preserve unique characteristics from proposed tokens
4. **Semantic Naming**: Use clear names (e.g., "brand-primary" not "color-1")
5. **Accessibility**: Validate WCAG AA contrast using accessibility guidelines (4.5:1 text, 3:1 UI)
6. **OKLCH Format**: All colors use oklch(L C H / A) format
7. **Design Philosophy**: Expand variant's design philosophy using trend insights
8. **Trend Integration**: Incorporate modern trends from MCP research while maintaining variant identity

## Step 3: File Write Instructions
For EACH variant {variant_id} (1 to {variants_count}), WRITE these 2 files:

### File 1: Design Tokens
**Path**: {base_path}/style-consolidation/style-{variant_id}/design-tokens.json
**Content**: Complete design token JSON with structure:
```json
{
  "colors": {
    "brand": {"primary": "oklch(...)", "secondary": "oklch(...)", "accent": "oklch(...)"},
    "surface": {"background": "oklch(...)", "elevated": "oklch(...)", "overlay": "oklch(...)"},
    "semantic": {"success": "oklch(...)", "warning": "oklch(...)", "error": "oklch(...)", "info": "oklch(...)"},
    "text": {"primary": "oklch(...)", "secondary": "oklch(...)", "tertiary": "oklch(...)", "inverse": "oklch(...)"},
    "border": {"default": "oklch(...)", "strong": "oklch(...)", "subtle": "oklch(...)"}
  },
  "typography": {"font_family": {...}, "font_size": {...}, "font_weight": {...}, "line_height": {...}, "letter_spacing": {...}},
  "spacing": {"0": "0", "1": "0.25rem", ..., "24": "6rem"},
  "border_radius": {"none": "0", "sm": "0.25rem", ..., "full": "9999px"},
  "shadows": {"sm": "...", "md": "...", "lg": "...", "xl": "..."},
  "breakpoints": {"sm": "640px", ..., "2xl": "1536px"}
}
```

### File 2: Style Guide
**Path**: {base_path}/style-consolidation/style-{variant_id}/style-guide.md
**Content**: Markdown documentation with structure:
```markdown
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
```

## Write Operation Instructions
- Use Write() tool for each file with the absolute paths provided above
- Verify each write operation succeeds
- Report completion with file paths and sizes
- DO NOT return file contents as text

## Example Write Operations
```javascript
// For variant 1
Write("{base_path}/style-consolidation/style-1/design-tokens.json", JSON.stringify(tokens, null, 2))
Write("{base_path}/style-consolidation/style-1/style-guide.md", guide_content)

// For variant 2
Write("{base_path}/style-consolidation/style-2/design-tokens.json", JSON.stringify(tokens, null, 2))
Write("{base_path}/style-consolidation/style-2/style-guide.md", guide_content)
```

## Expected Final Report
Report which files were written and their sizes:
```
✅ Written: {base_path}/style-consolidation/style-1/design-tokens.json (12.5 KB)
✅ Written: {base_path}/style-consolidation/style-1/style-guide.md (8.3 KB)
✅ Written: {base_path}/style-consolidation/style-2/design-tokens.json (11.8 KB)
✅ Written: {base_path}/style-consolidation/style-2/style-guide.md (7.9 KB)
... (for all {variants_count} variants)
```

## Critical Requirements
- Generate files for ALL {variants_count} variants
- Use sequential IDs: style-1, style-2, ..., style-{variants_count}
- Each variant must be complete and independent
- Maintain consistent structure across all variants
- Write files directly using Write() tool - do NOT return contents as text
"""

# Execute agent task
Task(subagent_type="ui-design-agent", description="Generate {variants_count} separate design systems", prompt=agent_task_prompt)

REPORT: "✅ Agent task dispatched for {variants_count} design systems"
```

### Phase 5: Verify Agent File Creation
```bash
REPORT: "📝 Verifying agent file creation for {variants_count} design systems..."

# Verify each variant's files were created by agent
FOR variant_id IN range(1, variants_count + 1):
    tokens_path = "{base_path}/style-consolidation/style-{variant_id}/design-tokens.json"
    guide_path = "{base_path}/style-consolidation/style-{variant_id}/style-guide.md"

    # Verify files exist
    VERIFY: exists(tokens_path), "Design tokens not created by agent for style-{variant_id}"
    VERIFY: exists(guide_path), "Style guide not created by agent for style-{variant_id}"

    # Optional: Validate JSON structure
    TRY:
        tokens = Read(tokens_path)
        tokens_json = parse_json(tokens)
        VALIDATE: tokens_json.colors exists, "Missing colors in design-tokens.json"
        VALIDATE: tokens_json.typography exists, "Missing typography in design-tokens.json"
        VALIDATE: tokens_json.spacing exists, "Missing spacing in design-tokens.json"

        tokens_size = get_file_size(tokens_path)
        guide_size = get_file_size(guide_path)
        REPORT: "  ✅ style-{variant_id}/ verified ({tokens_size} KB tokens, {guide_size} KB guide)"
    CATCH error:
        ERROR: "Validation failed for style-{variant_id}: {error}"
        REPORT: "  ⚠️ Files exist but validation failed - review agent output"

REPORT: "✅ All {variants_count} design systems verified"
```

**Output Structure**:
```
{base_path}/style-consolidation/
├── style-1/ (design-tokens.json, style-guide.md)
├── style-2/ (same structure)
└── style-N/ (same structure)
```

### Phase 6: Completion & Reporting

```javascript
TodoWrite({todos: [
  {content: "Load session and style cards", status: "completed", activeForm: "Loading style cards"},
  {content: "Select variants for consolidation", status: "completed", activeForm: "Selecting variants"},
  {content: "Load design context and space analysis", status: "completed", activeForm: "Loading context"},
  {content: "Perform variant-specific trend research", status: "completed", activeForm: "Researching design trends"},
  {content: "Generate design systems via agent", status: "completed", activeForm: "Generating design systems"},
  {content: "Process agent results and write files", status: "completed", activeForm: "Writing output files"}
]});
```

**Completion Message**:
```
✅ Design system consolidation complete for session: {session_id}

{IF design_space_analysis:
🔍 Trend Research Performed:
- {variants_count} × 4 variant-specific MCP queries ({variants_count * 4} total)
- 1 shared accessibility research query
- Each variant refined with independent trend guidance
}

Generated {variants_count} independent design systems:
{FOR each variant: - {variant.name} ({variant.id})}

📂 Output: {base_path}/style-consolidation/
├── style-1/ (design-tokens.json, style-guide.md)
├── style-2/ (same structure)
└── style-{variants_count}/ (same structure)

Next: /workflow:ui-design:generate --session {session_id} --style-variants {variants_count} --targets "dashboard,auth" --layout-variants N

Note: When called from /workflow:ui-design:explore-auto, UI generation is triggered automatically.
Layout planning is now handled in the generate phase for each specific target.
```

## design-tokens.json Format

**Token structure** (all variants follow identical structure with different values):

```json
{
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
  "spacing": {"0": "0", "1": "0.25rem", ..., "24": "6rem"},
  "border_radius": {"none": "0", "sm": "0.25rem", ..., "full": "9999px"},
  "shadows": {"sm": "...", "md": "...", "lg": "...", "xl": "..."},
  "breakpoints": {"sm": "640px", "md": "768px", "lg": "1024px", "xl": "1280px", "2xl": "1536px"}
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

1. **Variant-Specific Trend Research** 🆕 - Agent performs independent MCP queries for each variant (4 queries per variant); Uses design space analysis keywords from extraction phase; Each variant researches its specific design philosophy; Shared accessibility research applied to all variants; Eliminates convergence by maintaining variant-specific research
2. **Agent-Driven Architecture** - Uses ui-design-agent for multi-file generation and MCP research; Parallel generation of N independent design systems with external trend integration; Structured output parsing with labeled sections; Agent handles both research and synthesis
3. **Separate Design Systems (Matrix-Ready)** - Generates N independent design systems (one per variant); Each variant maintains unique style identity enhanced by trend research; Provides style foundation for style × layout matrix exploration in generate phase
4. **Token Refinement with Trend Integration** 🆕 - Reads `proposed_tokens` from style cards; Loads design space analysis for research parameters; Agent performs MCP trend research per variant; Refines tokens using research insights while maintaining style identity
5. **Complete Design System Output** - design-tokens.json (CSS tokens per variant); style-guide.md (documentation per variant with trend insights)
6. **Production-Ready Quality** - WCAG AA accessibility validation with MCP research; OKLCH color format for perceptual uniformity; Semantic token naming; Complete token coverage; Modern trends integration
7. **Streamlined Workflow** - Sequential phases with clear responsibilities; Agent handles MCP research, token refinement, and file generation; Reproducible with deterministic structure; Context-aware (integrates brainstorming and design space analysis)
8. **Clear Separation of Concerns** - Consolidation focuses on style systems with trend research; Extraction focuses on Claude-native analysis; Layout planning delegated to generate phase for target-specific optimization

## Integration Points

- **Input**:
  - `style-cards.json` from `/workflow:ui-design:extract` (with `proposed_tokens`)
  - `design-space-analysis.json` from extraction phase (with search keywords for MCP research)
  - `--variants` parameter (default: all variants)
- **Output**: Style Systems: `style-consolidation/style-{n}/design-tokens.json` and `style-guide.md` for each variant (enhanced with trend research)
- **Context**: Optional `synthesis-specification.md` or `ui-designer/analysis.md`
- **Auto Integration**: Automatically triggered by `/workflow:ui-design:explore-auto` workflow
- **Next Command**: `/workflow:ui-design:generate --style-variants N --targets "..." --layout-variants M` performs target-specific layout planning
