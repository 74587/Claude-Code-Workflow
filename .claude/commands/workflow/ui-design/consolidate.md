---
name: consolidate
description: Consolidate style variants into independent design systems and plan layout strategies
usage: /workflow:ui-design:consolidate [--base-path <path>] [--session <id>] [--variants <count>] [--layout-variants <count>]
examples:
  - /workflow:ui-design:consolidate --base-path ".workflow/WFS-auth/design-run-20250109-143022" --variants 3
  - /workflow:ui-design:consolidate --session WFS-auth --variants 2
  - /workflow:ui-design:consolidate --base-path "./.workflow/.design/run-20250109-150533"  # Uses all variants
  - /workflow:ui-design:consolidate --session WFS-auth  # Process all variants from extraction
allowed-tools: TodoWrite(*), Read(*), Write(*), Bash(*), Task(*)
---

# Design System Consolidation Command

## Overview
Consolidate user-selected style variants into **independent production-ready design systems**. This command serves as the **Style Refinement Phase**, transforming raw token proposals from `extract` into finalized, production-ready design tokens and style guides for the subsequent generation phase.

## Core Philosophy
- **Style System Focus**: Exclusively handles design system consolidation
- **System Refinement, Not Generation**: Consumes proposed tokens from `extract` to create finalized design systems; does NOT generate UI prototypes or CSS stylesheets (that's generate's job)
- **Agent-Driven**: Uses ui-design-agent for multi-file generation efficiency
- **Separate Design Systems**: Generates N independent design systems (one per variant)
- **Token Refinement**: Refines `proposed_tokens` from each variant into complete, production-ready systems
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

### Phase 1.1: Memory Check (Skip if Already Consolidated)

```bash
# Check if style-1/design-tokens.json exists in memory
IF exists("{base_path}/style-consolidation/style-1/design-tokens.json"):
    REPORT: "✅ Design system consolidation already complete (found in memory)"
    REPORT: "   Skipping: Phase 2-6 (Variant Selection, Design Context Loading, Design System Synthesis, Agent Verification, Completion)"
    EXIT 0
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
    REPORT: "⚠️ No design space analysis found - will refine tokens from proposed_tokens only"
```

### Phase 4: Design System Synthesis (Agent Execution)

```bash
REPORT: "🤖 Using agent for separate design system generation..."

# Create output directories
Bash(mkdir -p "{base_path}/style-consolidation/style-{{1..{variants_count}}}")

# Prepare agent task prompt with clear task identifier
agent_task_prompt = """
[DESIGN_TOKEN_GENERATION_TASK]

CRITICAL: You MUST use Write() tool to create files. DO NOT return file contents as text.

## Task Summary
Generate {variants_count} independent design systems using philosophy-driven refinement and WRITE files directly (NO MCP calls).

## Context
SESSION: {session_id}
MODE: Separate design system generation with philosophy-driven refinement (NO MCP)
BASE_PATH: {base_path}
VARIANTS TO PROCESS: {variants_count}

## Variant Data

CRITICAL PATH MAPPING:
- Variant 1 (id: {variant.id}) → Output directory: style-1/
- Variant 2 (id: {variant.id}) → Output directory: style-2/
- Variant N (id: {variant.id}) → Output directory: style-N/

Use loop index (1-based) for directory names, NOT variant.id.

{FOR each variant IN selected_variants with index N (1-based):
  ---
  VARIANT INDEX: {N} (use this for directory: style-{N}/)
  Variant ID: {variant.id} (metadata only, DO NOT use in paths)
  Name: {variant.name}
  Description: {variant.description}
  Design Philosophy: {variant.design_philosophy}
  Proposed Tokens: {JSON.stringify(variant.proposed_tokens, null, 2)}
  ---
}

{IF design_context: DESIGN CONTEXT (from brainstorming): {design_context}}

{IF design_space_analysis:
## Design Space Analysis (for Philosophy-Driven Refinement)
{JSON.stringify(design_space_analysis, null, 2)}

Note: Each variant has design_attributes and anti_keywords for token refinement.
Use philosophy_name and design_attributes to guide token generation WITHOUT external research.
}

## Task
For EACH variant (1 to {variants_count}):
1. **Load variant's design philosophy and attributes** (from design_space_analysis)
2. **Refine design tokens** using philosophy-driven strategy (NO external research)
3. **Generate and WRITE 2 files** to the file system

## Step 1: Load Design Philosophy (No MCP Calls)

IF design_space_analysis is provided:
  FOR EACH variant:
    1. **Extract Design Direction**: Load philosophy_name, design_attributes, search_keywords, anti_keywords
    2. **Use as Refinement Guide**: Apply philosophy and attributes to token generation
    3. **Enforce Constraints**: Avoid characteristics listed in anti_keywords
    4. **Maintain Divergence**: Ensure tokens differ from other variants based on attributes

ELSE:
  Refine tokens based solely on variant's proposed_tokens and design_philosophy from style-cards.json

## Philosophy-Driven Refinement Strategy

**Core Principles**:
- Use variant's design_attributes as primary guide (color saturation, visual weight, formality, organic/geometric, innovation, density)
- Apply anti_keywords as explicit constraints during token selection
- Ensure WCAG AA accessibility using built-in AI knowledge (4.5:1 text, 3:1 UI)
- Preserve maximum contrast between variants from extraction phase

**Refinement Process** (Apply to each variant):
1. **Colors**: Generate palette based on saturation attribute
   - "monochrome" → low chroma values (oklch L 0.00-0.02 H)
   - "vibrant" → high chroma values (oklch L 0.20-0.30 H)
2. **Typography**: Select font families matching formality level
   - "playful" → rounded, friendly fonts
   - "luxury" → serif, elegant fonts
3. **Spacing**: Apply density attribute
   - "spacious" → larger spacing scale (e.g., "4": "1.5rem")
   - "compact" → smaller spacing scale (e.g., "4": "0.75rem")
4. **Shadows**: Match visual weight
   - "minimal" → subtle shadows with low opacity
   - "bold" → strong shadows with higher spread
5. **Border Radius**: Align with organic/geometric attribute
   - "organic" → larger radius values (xl: "1.5rem")
   - "brutalist" → minimal radius (xl: "0.125rem")
6. **Innovation**: Influence overall token adventurousness
   - "timeless" → conservative, proven values
   - "experimental" → unconventional token combinations

## Step 2: Refinement Rules (apply to each variant)
1. **Complete Token Coverage**: Ensure all categories present (colors, typography, spacing, etc.)
2. **Fill Gaps**: Generate missing tokens based on variant's philosophy and design_attributes
3. **Maintain Style Identity**: Preserve unique characteristics from proposed tokens
4. **Semantic Naming**: Use clear names (e.g., "brand-primary" not "color-1")
5. **Accessibility**: Validate WCAG AA contrast using built-in AI knowledge (4.5:1 text, 3:1 UI)
6. **OKLCH Format**: All colors use oklch(L C H / A) format
7. **Design Philosophy**: Expand variant's design philosophy based on its attributes
8. **Divergence Preservation**: Apply anti_keywords to prevent convergence with other variants

## Step 3: FILE WRITE OPERATIONS (CRITICAL)

**EXECUTION MODEL**: For EACH variant (1 to {variants_count}):
1. Load design philosophy and attributes
2. Refine tokens using philosophy-driven strategy
3. **IMMEDIATELY Write() files - DO NOT accumulate, DO NOT return as text**

### Required Write Operations Per Variant

For variant with loop index {N} (e.g., 1st variant = N=1, 2nd variant = N=2), execute these Write() operations:

#### Write Operation 1: Design Tokens
**Path**: `{base_path}/style-consolidation/style-{N}/design-tokens.json`
**Method**: `Write(path, JSON.stringify(tokens, null, 2))`
**Example**: For 1st variant → `{base_path}/style-consolidation/style-1/design-tokens.json`
**Content Structure**:
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

#### Write Operation 2: Style Guide
**Path**: `{base_path}/style-consolidation/style-{N}/style-guide.md`
**Method**: `Write(path, guide_markdown_content)`
**Example**: For 2nd variant → `{base_path}/style-consolidation/style-2/style-guide.md`
**Content Structure**:
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

### Execution Checklist (Per Variant)

For each variant from 1 to {variants_count} (use loop index N):
- [ ] Extract variant's philosophy, design_attributes, and anti_keywords
- [ ] Apply philosophy-driven refinement strategy to proposed_tokens
- [ ] Generate complete token set following refinement rules
- [ ] **EXECUTE**: `Write("{base_path}/style-consolidation/style-{N}/design-tokens.json", tokens_json)`
  - Example: 1st variant → `style-1/design-tokens.json`
- [ ] **EXECUTE**: `Write("{base_path}/style-consolidation/style-{N}/style-guide.md", guide_content)`
  - Example: 1st variant → `style-1/style-guide.md`
- [ ] Verify both files written successfully

### Verification After Each Write
```javascript
// Immediately after Write() for each file (use loop index N):
Bash(`ls -lh "{base_path}/style-consolidation/style-{N}/"`)
// Example: For 1st variant → ls -lh ".../style-1/"
// Confirm file exists and has reasonable size (>1KB)

## Expected Final Report

After completing all {variants_count} variants, report:
```
✅ Variant 1 ({variant_name}):
   - design-tokens.json: 12.5 KB | {token_count} tokens
   - style-guide.md: 8.3 KB
✅ Variant 2 ({variant_name}):
   - design-tokens.json: 11.8 KB | {token_count} tokens
   - style-guide.md: 7.9 KB
... (for all variants)

Summary: {variants_count} design systems generated with philosophy-driven refinement (zero MCP calls)
```

## KEY REMINDERS (CRITICAL)

**ALWAYS:**
- Use Write() tool for EVERY file - this is your PRIMARY responsibility
- Write files immediately after generating content for each variant
- Verify each Write() operation succeeds before proceeding
- Use loop index (N) for directory names: `{base_path}/style-consolidation/style-{N}/...`
  - 1st variant → `style-1/`, 2nd variant → `style-2/`, etc.
  - DO NOT use variant.id in paths (metadata only)
- Apply philosophy-driven refinement strategy for each variant
- Maintain variant divergence using design_attributes and anti_keywords
- Report completion with file paths and sizes

**NEVER:**
- Return file contents as text with labeled sections
- Accumulate all content and try to output at once
- Skip Write() operations and expect orchestrator to write files
- Use relative paths or modify provided paths
- Use external research or MCP calls (pure AI refinement only)
- Generate variant N+1 before completing variant N writes
"""

# Dispatch to ui-design-agent with task prompt
Task(subagent_type="ui-design-agent", description="Generate {variants_count} separate design systems", prompt=agent_task_prompt)

REPORT: "✅ Agent task dispatched for {variants_count} design systems"
```

### Phase 5: Verify Agent File Creation
```bash
REPORT: "📝 Verifying agent file creation for {variants_count} design systems..."

# Verify each variant's files were created by agent (use numeric index)
FOR N IN range(1, variants_count + 1):
    tokens_path = "{base_path}/style-consolidation/style-{N}/design-tokens.json"
    guide_path = "{base_path}/style-consolidation/style-{N}/style-guide.md"

    # Verify files exist
    VERIFY: exists(tokens_path), "Design tokens not created by agent for style-{N}"
    VERIFY: exists(guide_path), "Style guide not created by agent for style-{N}"

    # Optional: Validate JSON structure
    TRY:
        tokens = Read(tokens_path)
        tokens_json = parse_json(tokens)
        VALIDATE: tokens_json.colors exists, "Missing colors in design-tokens.json"
        VALIDATE: tokens_json.typography exists, "Missing typography in design-tokens.json"
        VALIDATE: tokens_json.spacing exists, "Missing spacing in design-tokens.json"

        tokens_size = get_file_size(tokens_path)
        guide_size = get_file_size(guide_path)
        REPORT: "  ✅ style-{N}/ verified ({tokens_size} KB tokens, {guide_size} KB guide)"
    CATCH error:
        ERROR: "Validation failed for style-{N}: {error}"
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
  {content: "Apply philosophy-driven refinement", status: "completed", activeForm: "Refining design tokens"},
  {content: "Generate design systems via agent", status: "completed", activeForm: "Generating design systems"},
  {content: "Process agent results and write files", status: "completed", activeForm: "Writing output files"}
]});
```

**Completion Message**:
```
✅ Design system consolidation complete for session: {session_id}

{IF design_space_analysis:
🎨 Philosophy-Driven Refinement:
- {variants_count} design systems generated from AI-analyzed philosophies
- Zero MCP calls (pure AI token refinement)
- Divergence preserved from extraction phase design_attributes
- Each variant maintains unique style identity via anti_keywords
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

1. **Philosophy-Driven Refinement** - Pure AI token refinement based on design_space_analysis from extraction phase; Uses variant-specific philosophies and design_attributes as refinement rules; Preserves maximum contrast without external trend pollution; Zero MCP calls = faster execution + better divergence preservation
2. **Agent-Driven Architecture** - Uses ui-design-agent for multi-file generation; Processes N variants with philosophy-guided synthesis; Structured output with deterministic token generation; Agent applies design attributes directly to token values
3. **Separate Design Systems (Matrix-Ready)** - Generates N independent design systems (one per variant); Each variant maintains unique style identity from extraction phase; Provides style foundation for style × layout matrix exploration in generate phase
4. **Token Refinement with AI Guidance** - Reads `proposed_tokens` from style cards; Loads design_space_analysis for philosophy and attributes; Applies attributes to token generation (saturation → chroma, density → spacing, etc.); Refines tokens while maintaining variant divergence through anti_keywords
5. **Complete Design System Output** - design-tokens.json (CSS tokens per variant); style-guide.md (documentation per variant with philosophy explanation)
6. **Production-Ready Quality** - WCAG AA accessibility validation using built-in AI knowledge (4.5:1 text, 3:1 UI); OKLCH color format for perceptual uniformity; Semantic token naming; Complete token coverage
7. **Streamlined Workflow** - Sequential phases with clear responsibilities; Agent handles philosophy-driven token refinement and file generation; Reproducible with deterministic structure; Context-aware (integrates brainstorming and design space analysis); ~30-60s faster without MCP overhead
8. **Divergence Preservation** - Strictly follows design_space_analysis constraints from extraction; Applies anti_keywords to prevent variant convergence; Maintains maximum variant contrast through attribute-driven generation; No external research = pure philosophical consistency

## Integration Points

- **Input**:
  - `style-cards.json` from `/workflow:ui-design:extract` (with `proposed_tokens`)
  - `design-space-analysis.json` from extraction phase (with philosophy and design_attributes)
  - `--variants` parameter (default: all variants)
- **Output**: Style Systems: `style-consolidation/style-{N}/design-tokens.json` and `style-guide.md` for each variant (refined with philosophy-driven approach), where N is the variant index (1, 2, 3...)
- **Context**: Optional `synthesis-specification.md` or `ui-designer/analysis.md`
- **Auto Integration**: Automatically triggered by `/workflow:ui-design:explore-auto` workflow
- **Next Command**: `/workflow:ui-design:generate --style-variants N --targets "..." --layout-variants M` performs target-specific layout planning
