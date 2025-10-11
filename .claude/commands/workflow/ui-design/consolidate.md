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
Consolidate style variants into independent production-ready design systems. Refines raw token proposals from `style-extract` into finalized design tokens and style guides.

**Strategy**: Philosophy-Driven Refinement
- **Agent-Driven**: Uses ui-design-agent for N variant generation
- **Token Refinement**: Transforms proposed_tokens into complete systems
- **Production-Ready**: design-tokens.json + style-guide.md per variant
- **Matrix-Ready**: Provides style variants for generate phase

## Phase 1: Setup & Validation

### Step 1: Resolve Base Path & Load Style Cards
```bash
# Determine base path
bash(find .workflow -type d -name "design-*" | head -1)  # Auto-detect
# OR use --base-path / --session parameters

# Load style cards
bash(cat {base_path}/style-extraction/style-cards.json)
```

### Step 2: Memory Check (Skip if Already Done)
```bash
# Check if already consolidated
bash(test -f {base_path}/style-consolidation/style-1/design-tokens.json && echo "exists")
```

**If exists**: Skip to completion message

### Step 3: Select Variants
```bash
# Determine variant count (default: all from style-cards.json)
bash(cat style-cards.json | grep -c "\"id\": \"variant-")

# Validate variant count
# Priority: --variants parameter → total_variants from style-cards.json
```

**Output**: `variants_count`, `selected_variants[]`

### Step 4: Load Design Context (Optional)
```bash
# Load brainstorming context
bash(test -f {base_path}/.brainstorming/synthesis-specification.md && cat it)

# Load design space analysis
bash(test -f {base_path}/style-extraction/design-space-analysis.json && cat it)
```

**Output**: `design_context`, `design_space_analysis`

## Phase 2: Design System Synthesis (Agent)

**Executor**: `Task(ui-design-agent)` for all variants

### Step 1: Create Output Directories
```bash
bash(mkdir -p {base_path}/style-consolidation/style-{{1..{variants_count}}})
```

### Step 2: Launch Agent Task
For all variants (1 to {variants_count}):
```javascript
Task(ui-design-agent): `
  [DESIGN_TOKEN_GENERATION_TASK]
  Generate {variants_count} independent design systems using philosophy-driven refinement

  SESSION: {session_id} | MODE: Philosophy-driven refinement | BASE_PATH: {base_path}

  CRITICAL PATH: Use loop index (N) for directories: style-1/, style-2/, ..., style-N/

  VARIANT DATA:
  {FOR each variant with index N:
    VARIANT INDEX: {N} | ID: {variant.id} | NAME: {variant.name}
    Design Philosophy: {variant.design_philosophy}
    Proposed Tokens: {variant.proposed_tokens}
    {IF design_space_analysis: Design Attributes: {attributes}, Anti-keywords: {anti_keywords}}
  }

  ## 参考
  - Style cards: Each variant's proposed_tokens and design_philosophy
  - Design space analysis: design_attributes (saturation, weight, formality, organic/geometric, innovation, density)
  - Anti-keywords: Explicit constraints to avoid
  - WCAG AA: 4.5:1 text, 3:1 UI (use built-in AI knowledge)

  ## 生成
  For EACH variant (use loop index N for paths):
  1. {base_path}/style-consolidation/style-{N}/design-tokens.json
     - Complete token structure: colors, typography, spacing, border_radius, shadows, breakpoints
     - All colors in OKLCH format
     - Apply design_attributes to token values (saturation→chroma, density→spacing, etc.)

  2. {base_path}/style-consolidation/style-{N}/style-guide.md
     - Expanded design philosophy
     - Complete color system with accessibility notes
     - Typography documentation
     - Usage guidelines

  ## 注意
  - ✅ Use Write() tool immediately for each file
  - ✅ Use loop index N for directory names: style-1/, style-2/, etc.
  - ❌ DO NOT use variant.id in paths (metadata only)
  - ❌ NO external research or MCP calls (pure AI refinement)
  - Apply philosophy-driven refinement: design_attributes guide token values
  - Maintain divergence: Use anti_keywords to prevent variant convergence
  - Complete each variant's files before moving to next variant
`
```

**Output**: Agent generates `variants_count × 2` files

## Phase 3: Verify Output

### Step 1: Check Files Created
```bash
# Verify all design systems created
bash(ls {base_path}/style-consolidation/style-*/design-tokens.json | wc -l)

# Validate structure
bash(cat {base_path}/style-consolidation/style-1/design-tokens.json | grep -q "colors" && echo "valid")
```

### Step 2: Verify File Sizes
```bash
bash(ls -lh {base_path}/style-consolidation/style-1/)
```

**Output**: `variants_count × 2` files verified

## Completion

### Todo Update
```javascript
TodoWrite({todos: [
  {content: "Setup and load style cards", status: "completed", activeForm: "Loading style cards"},
  {content: "Select variants and load context", status: "completed", activeForm: "Loading context"},
  {content: "Generate design systems (agent)", status: "completed", activeForm: "Generating systems"},
  {content: "Verify output files", status: "completed", activeForm: "Verifying files"}
]});
```

### Output Message
```
✅ Design system consolidation complete!

Configuration:
- Session: {session_id}
- Variants: {variants_count}
- Philosophy-driven refinement (zero MCP calls)

Generated Files:
{base_path}/style-consolidation/
├── style-1/ (design-tokens.json, style-guide.md)
├── style-2/ (same structure)
└── style-{variants_count}/ (same structure)

Next: /workflow:ui-design:generate --session {session_id} --style-variants {variants_count} --targets "dashboard,auth"
```

## Simple Bash Commands

### Path Operations
```bash
# Find design directory
bash(find .workflow -type d -name "design-*" | head -1)

# Load style cards
bash(cat {base_path}/style-extraction/style-cards.json)

# Count variants
bash(cat style-cards.json | grep -c "\"id\": \"variant-")
```

### Validation Commands
```bash
# Check if already consolidated
bash(test -f {base_path}/style-consolidation/style-1/design-tokens.json && echo "exists")

# Verify output
bash(ls {base_path}/style-consolidation/style-*/design-tokens.json | wc -l)

# Validate structure
bash(cat design-tokens.json | grep -q "colors" && echo "valid")
```

### File Operations
```bash
# Create directories
bash(mkdir -p {base_path}/style-consolidation/style-{{1..3}})

# Check file sizes
bash(ls -lh {base_path}/style-consolidation/style-1/)
```

## Output Structure

```
{base_path}/
└── style-consolidation/
    ├── style-1/
    │   ├── design-tokens.json
    │   └── style-guide.md
    ├── style-2/
    │   ├── design-tokens.json
    │   └── style-guide.md
    └── style-N/ (same structure)
```

## design-tokens.json Format

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

**Requirements**: OKLCH colors, complete coverage, semantic naming

## Error Handling

### Common Errors
```
ERROR: No style cards found
→ Run /workflow:ui-design:style-extract first

ERROR: Invalid variant count
→ List available count, auto-select all

ERROR: Agent file creation failed
→ Check agent output, verify Write() operations
```

## Key Features

- **Philosophy-Driven Refinement** - Pure AI token refinement using design_attributes
- **Agent-Driven** - Uses ui-design-agent for multi-file generation
- **Separate Design Systems** - N independent systems (one per variant)
- **Production-Ready** - WCAG AA compliant, OKLCH colors, semantic naming
- **Zero MCP Calls** - Faster execution, better divergence preservation

## Integration

**Input**: `style-cards.json` from `/workflow:ui-design:style-extract`
**Output**: `style-consolidation/style-{N}/` for each variant
**Next**: `/workflow:ui-design:generate --style-variants N`

**Note**: After consolidate, use `/workflow:ui-design:layout-extract` to generate layout templates before running generate.
