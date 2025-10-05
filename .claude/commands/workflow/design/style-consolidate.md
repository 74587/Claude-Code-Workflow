---
name: style-consolidate
description: Consolidate user-selected style variants into unified design system
usage: /workflow:design:style-consolidate --session <session_id> [--interactive] [--variants "<ids>"]
argument-hint: "--session WFS-session-id [--interactive] [--variants \"variant-1,variant-3\"]"
examples:
  - /workflow:design:style-consolidate --session WFS-auth --interactive
  - /workflow:design:style-consolidate --session WFS-dashboard --variants "variant-1,variant-3"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*), Read(*), Write(*), Bash(*)
---

# Style Consolidation Command

## Overview
Consolidate user-selected style variants into a unified, production-ready design system with validated CSS tokens and comprehensive style guide.

## Core Philosophy
- **User-Driven Selection**: Interactive mode for visual style card selection
- **Gemini Clustering**: Semantic naming and style philosophy consolidation
- **Codex Validation**: Token consistency, coverage, and accessibility checks
- **Design System Output**: production-ready tokens + comprehensive style guide

## Execution Protocol

### Phase 1: Session & Style Cards Loading
```bash
# Validate session and load extracted style cards
CHECK: .workflow/.active-* marker files
VALIDATE: session_id matches active session
VERIFY: .design/style-extraction/style-cards.json exists
LOAD: style-cards.json for user selection
```

### Phase 2: User Selection (Interactive Mode)
**Interactive Mode**: `--interactive` flag enables visual selection interface

```bash
IF --interactive:
    DISPLAY: Style card previews with descriptions
    PROMPT: "Select preferred style variants (comma-separated IDs):"
    COLLECT: user_selection (e.g., "variant-1,variant-3")
ELSE IF --variants provided:
    PARSE: variant IDs from --variants flag
ELSE:
    ERROR: "Must provide either --interactive or --variants parameter"
```

### Phase 3: Gemini Style Philosophy Consolidation
**Agent Invocation**: Task(conceptual-planning-agent) with Gemini capabilities

```bash
Task(conceptual-planning-agent): "
[FLOW_CONTROL]

Consolidate selected style variants into unified design philosophy

## Context Loading
ASSIGNED_TASK: style-consolidation
OUTPUT_LOCATION: .workflow/WFS-{session}/.design/style-consolidation/
SELECTED_VARIANTS: {user_selected_variant_ids}

## Flow Control Steps
1. **load_selected_variants**
   - Action: Load user-selected style card data
   - Command: Read(.workflow/WFS-{session}/.design/style-extraction/style-cards.json)
   - Filter: Extract only selected variant IDs
   - Output: selected_style_data

2. **load_design_context**
   - Action: Load brainstorming design context
   - Command: Read(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md) || Read(.workflow/WFS-{session}/.brainstorming/ui-designer/analysis.md)
   - Output: design_context
   - Optional: true

3. **consolidate_style_philosophy_gemini**
   - Action: Synthesize unified style philosophy and semantic naming
   - Command: bash(cd .workflow/WFS-{session} && ~/.claude/scripts/gemini-wrapper --approval-mode yolo -p \"
     PURPOSE: Synthesize unified design philosophy from selected style variants
     TASK: Create coherent style narrative, consolidate naming conventions, define design principles
     MODE: write
     CONTEXT: @{.design/style-extraction/style-cards.json,.brainstorming/synthesis-specification.md}
     EXPECTED:
     1. Unified design philosophy statement
     2. Consolidated semantic naming for colors (e.g., 'brand-primary', 'surface-elevated')
     3. Typography scale rationale
     4. Spacing system principles
     5. Component design guidelines
     RULES: Ensure consistency, maintain accessibility mindset, align with brainstorming synthesis
     \")
   - Output: style-philosophy.md

## Consolidation Requirements
**Design Philosophy**: Clear statement of visual design principles
**Semantic Naming**: User-centric token names (not generic color-1, color-2)
**Accessibility**: Ensure WCAG AA contrast ratios for text colors
**Consistency**: Unified token naming conventions across all categories

## Expected Deliverables
1. **style-philosophy.md**: Design philosophy and naming rationale
"
```

### Phase 4: Codex Token Validation & Finalization
**Agent Invocation**: Task(conceptual-planning-agent) with Codex capabilities

```bash
Task(conceptual-planning-agent): "
[FLOW_CONTROL]

Validate and finalize production-ready design tokens

## Context Loading
INPUT_PHILOSOPHY: .workflow/WFS-{session}/.design/style-consolidation/style-philosophy.md
INPUT_TOKENS: .workflow/WFS-{session}/.design/style-extraction/design-tokens.json
SELECTED_VARIANTS: {user_selected_variant_ids}
OUTPUT_LOCATION: .workflow/WFS-{session}/.design/style-consolidation/

## Flow Control Steps
1. **load_consolidation_inputs**
   - Action: Load style philosophy and extracted tokens
   - Commands:
     - Read(.workflow/WFS-{session}/.design/style-consolidation/style-philosophy.md)
     - Read(.workflow/WFS-{session}/.design/style-extraction/design-tokens.json)
     - Read(.workflow/WFS-{session}/.design/style-extraction/style-cards.json)
   - Output: consolidation_inputs

2. **validate_and_finalize_tokens_codex**
   - Action: Merge selected variants, validate consistency, generate final tokens
   - Command: bash(codex -C .workflow/WFS-{session}/.design/style-consolidation --full-auto exec \"
     PURPOSE: Finalize production-ready design tokens with validation
     TASK: Merge selected variant tokens, validate consistency, check accessibility, generate final design system
     MODE: auto
     CONTEXT: @{style-philosophy.md,../style-extraction/design-tokens.json,../style-extraction/style-cards.json,../../../CLAUDE.md}
     EXPECTED:
     1. design-tokens.json - Final validated CSS token definitions
     2. tailwind.config.js - Complete Tailwind configuration
     3. style-guide.md - Comprehensive design system documentation
     4. validation-report.json - Token consistency and accessibility audit
     RULES:
     - Use semantic names from style-philosophy.md
     - Validate WCAG AA contrast ratios (4.5:1 for text, 3:1 for UI)
     - Ensure complete token coverage (colors, typography, spacing, shadows, borders)
     - Generate CSS custom properties and Tailwind theme extension
     - Include usage examples in style-guide.md
     \" --skip-git-repo-check -s danger-full-access)
   - Output: design-tokens.json, tailwind.config.js, style-guide.md, validation-report.json

## Validation Requirements
**Consistency Checks**:
- All color tokens use OKLCH format
- Spacing scale follows consistent ratio (e.g., 1.5x or 2x progression)
- Typography scale includes appropriate line-heights
- All tokens have semantic names

**Accessibility Checks**:
- Text colors meet WCAG AA contrast (4.5:1)
- UI component colors meet WCAG AA contrast (3:1)
- Focus indicators have sufficient visibility
- Color is not sole differentiator

**Coverage Checks**:
- Primary, secondary, accent color families
- Surface colors (background, elevated, sunken)
- Semantic colors (success, warning, error, info)
- Typography scale (xs to 4xl)
- Spacing scale (0.25rem to 6rem)
- Border radius options
- Shadow layers

## Expected Deliverables
1. **design-tokens.json**: Production-ready CSS token definitions
2. **tailwind.config.js**: Complete Tailwind theme configuration
3. **style-guide.md**: Design system documentation with usage examples
4. **validation-report.json**: Validation audit results
"
```

### Phase 5: TodoWrite Integration
```javascript
TodoWrite({
  todos: [
    {
      content: "Load session and style cards from extraction phase",
      status: "completed",
      activeForm: "Loading style cards"
    },
    {
      content: "Collect user style variant selection (interactive or CLI)",
      status: "completed",
      activeForm: "Collecting user selection"
    },
    {
      content: "Consolidate style philosophy using Gemini",
      status: "completed",
      activeForm: "Consolidating style philosophy"
    },
    {
      content: "Validate and finalize tokens using Codex",
      status: "completed",
      activeForm: "Validating and finalizing tokens"
    },
    {
      content: "Generate design system documentation",
      status: "completed",
      activeForm: "Generating design system docs"
    }
  ]
});
```

## Output Structure

```
.workflow/WFS-{session}/.design/style-consolidation/
├── style-philosophy.md          # Unified design philosophy (Gemini)
├── design-tokens.json           # Final validated CSS tokens (Codex)
├── tailwind.config.js           # Tailwind theme configuration (Codex)
├── style-guide.md               # Design system documentation (Codex)
└── validation-report.json       # Accessibility & consistency audit (Codex)
```

### design-tokens.json Format
```json
{
  "colors": {
    "brand": {
      "primary": "oklch(0.45 0.20 270 / 1)",
      "secondary": "oklch(0.60 0.15 200 / 1)",
      "accent": "oklch(0.65 0.18 30 / 1)"
    },
    "surface": {
      "background": "oklch(0.98 0.01 270 / 1)",
      "elevated": "oklch(1.00 0.00 0 / 1)",
      "sunken": "oklch(0.95 0.02 270 / 1)"
    },
    "semantic": {
      "success": "oklch(0.55 0.15 150 / 1)",
      "warning": "oklch(0.70 0.18 60 / 1)",
      "error": "oklch(0.50 0.20 20 / 1)",
      "info": "oklch(0.60 0.15 240 / 1)"
    }
  },
  "typography": {
    "font_family": {
      "heading": "Inter, system-ui, sans-serif",
      "body": "Inter, system-ui, sans-serif",
      "mono": "Fira Code, monospace"
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
    "line_height": {
      "tight": "1.25",
      "normal": "1.5",
      "relaxed": "1.75"
    }
  },
  "spacing": {
    "0": "0",
    "1": "0.25rem",
    "2": "0.5rem",
    "3": "0.75rem",
    "4": "1rem",
    "6": "1.5rem",
    "8": "2rem",
    "12": "3rem",
    "16": "4rem",
    "24": "6rem"
  },
  "border_radius": {
    "none": "0",
    "sm": "0.25rem",
    "md": "0.5rem",
    "lg": "0.75rem",
    "xl": "1rem",
    "2xl": "1.5rem",
    "full": "9999px"
  },
  "shadow": {
    "sm": "0 1px 2px oklch(0.00 0.00 0 / 0.05)",
    "md": "0 4px 6px oklch(0.00 0.00 0 / 0.07), 0 2px 4px oklch(0.00 0.00 0 / 0.06)",
    "lg": "0 10px 15px oklch(0.00 0.00 0 / 0.1), 0 4px 6px oklch(0.00 0.00 0 / 0.05)",
    "xl": "0 20px 25px oklch(0.00 0.00 0 / 0.15), 0 10px 10px oklch(0.00 0.00 0 / 0.04)"
  }
}
```

## Error Handling
- **No style cards found**: Run `/workflow:design:style-extract` first
- **Invalid variant IDs**: Display available IDs and prompt re-selection
- **Validation failures**: Report specific issues (contrast, coverage, consistency)
- **Gemini/Codex execution errors**: Retry with fallback to manual token editing

## Integration Points
- **Input**: style-cards.json from `/workflow:design:style-extract`
- **Output**: design-tokens.json for `/workflow:design:ui-generate`
- **Context**: synthesis-specification.md, ui-designer/analysis.md

## Next Steps
After successful consolidation:
```
Style consolidation complete for session: WFS-{session}
Design tokens validated and finalized

Validation summary:
- Colors: {count} (WCAG AA compliant: {pass_count}/{total_count})
- Typography: {scale_count} sizes
- Spacing: {scale_count} values
- Accessibility: {pass|warnings}

Next: /workflow:design:ui-generate --session WFS-{session} --pages "dashboard,auth"
```
