---
name: consolidate
description: Consolidate style variants into unified design system using Claude's synthesis
usage: /workflow:ui-design:consolidate --session <session_id> [--variants "<ids>"]
argument-hint: "--session WFS-session-id [--variants \"variant-1,variant-3\"]"
examples:
  - /workflow:ui-design:consolidate --session WFS-auth --variants "variant-1,variant-2,variant-3"
  - /workflow:ui-design:consolidate --session WFS-dashboard --variants "variant-1,variant-3"
allowed-tools: TodoWrite(*), Read(*), Write(*)
---

# Style Consolidation Command

## Overview
Consolidate user-selected style variants into a unified, production-ready design system using Claude's native synthesis capabilities. Merges token proposals from multiple style cards into a cohesive design language.

## Core Philosophy
- **Claude-Native**: 100% Claude-driven consolidation, no external tools
- **Token Merging**: Combines `proposed_tokens` from selected variants
- **Intelligent Synthesis**: Resolves conflicts, ensures consistency
- **Production-Ready**: Complete design system with documentation

## Execution Protocol

### Phase 1: Session & Variant Loading
```bash
# Validate session and load style cards
IF --session:
    session_id = {provided_session}
    base_path = ".workflow/WFS-{session_id}/"
ELSE:
    ERROR: "Must provide --session parameter"

# Verify extraction output exists
VERIFY: {base_path}/.design/style-extraction/style-cards.json exists

# Load style cards
style_cards = Read({base_path}/.design/style-extraction/style-cards.json)
```

### Phase 2: Variant Selection
```bash
# Parse variant selection
IF --variants provided:
    variant_ids = parse_csv({--variants value})
    VALIDATE: All variant_ids exist in style_cards.style_cards[]
ELSE:
    # Auto-select all variants when called from /workflow:ui-design:auto
    variant_ids = extract_all_ids(style_cards.style_cards)

# Extract selected variants
selected_variants = []
FOR each id IN variant_ids:
    variant = find_variant_by_id(style_cards, id)
    selected_variants.push(variant)

VERIFY: selected_variants.length > 0
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

### Phase 4: Unified Design System Synthesis (Claude)
This is a single-pass synthesis that replaces all external tool calls.

**Synthesis Prompt Template**:
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
2. **Resolve Conflicts**: When variants disagree (e.g., different primary colors), choose the most appropriate value or create a balanced compromise
3. **Maintain Completeness**: Ensure all token categories are present (colors, typography, spacing, etc.)
4. **Semantic Naming**: Use clear, semantic names (e.g., "brand-primary" not "color-1")
5. **Accessibility**: Validate WCAG AA contrast ratios (4.5:1 text, 3:1 UI)
6. **OKLCH Format**: All colors must use oklch(L C H / A) format
7. **Design Philosophy**: Synthesize a unified philosophy statement from variant descriptions

OUTPUT: Generate the following files as JSON/Markdown:

FILE 1: design-tokens.json
{
  "colors": {
    "brand": {
      "primary": "oklch(...)",
      "secondary": "oklch(...)",
      "accent": "oklch(...)"
    },
    "surface": {
      "background": "oklch(...)",
      "elevated": "oklch(...)",
      "overlay": "oklch(...)"
    },
    "semantic": {
      "success": "oklch(...)",
      "warning": "oklch(...)",
      "error": "oklch(...)",
      "info": "oklch(...)"
    },
    "text": {
      "primary": "oklch(...)",
      "secondary": "oklch(...)",
      "tertiary": "oklch(...)",
      "inverse": "oklch(...)"
    },
    "border": {
      "default": "oklch(...)",
      "strong": "oklch(...)",
      "subtle": "oklch(...)"
    }
  },
  "typography": {
    "font_family": { "heading": "...", "body": "...", "mono": "..." },
    "font_size": { "xs": "...", ..., "4xl": "..." },
    "font_weight": { "normal": "...", "medium": "...", "semibold": "...", "bold": "..." },
    "line_height": { "tight": "...", "normal": "...", "relaxed": "..." },
    "letter_spacing": { "tight": "...", "normal": "...", "wide": "..." }
  },
  "spacing": { "0": "0", "1": "0.25rem", ..., "24": "6rem" },
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

### Surface Colors
{List all surface colors with usage}

### Semantic Colors
{List semantic colors with accessibility notes}

### Text Colors
{List text colors with contrast ratios}

## Typography
### Font Families
{List font families with fallbacks}

### Type Scale
{Show scale with examples}

### Usage Examples
```css
.heading-primary {
  font-family: var(--font-family-heading);
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
}
```

## Spacing System
{Describe spacing scale and usage patterns}

## Component Guidelines
### Buttons
{Token-based button styling examples}

### Cards
{Token-based card styling examples}

### Forms
{Token-based form styling examples}

## Accessibility
- All text meets WCAG AA (4.5:1 minimum)
- UI components meet WCAG AA (3:1 minimum)
- Focus indicators are clearly visible

FILE 3: tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '{value}',
          secondary: '{value}',
          accent: '{value}'
        },
        // ... all color tokens
      },
      fontFamily: {
        heading: [{fonts}],
        body: [{fonts}],
        mono: [{fonts}]
      },
      fontSize: {
        // ... all size tokens
      },
      spacing: {
        // ... all spacing tokens
      },
      borderRadius: {
        // ... all radius tokens
      },
      boxShadow: {
        // ... all shadow tokens
      },
      screens: {
        // ... all breakpoint tokens
      }
    }
  }
}

FILE 4: validation-report.json
{
  "session_id": "{session_id}",
  "consolidated_variants": {variant_ids},
  "timestamp": "{ISO timestamp}",
  "validation_results": {
    "colors": {
      "total": {count},
      "wcag_aa_compliant": {count},
      "warnings": [{any contrast issues}]
    },
    "typography": {
      "font_families": {count},
      "scale_sizes": {count}
    },
    "spacing": {
      "scale_values": {count}
    },
    "accessibility": {
      "status": "pass|warnings",
      "issues": [{list any issues}]
    },
    "completeness": {
      "required_categories": ["colors", "typography", "spacing", "border_radius", "shadows", "breakpoints"],
      "present_categories": [{list}],
      "missing_categories": [{list if any}]
    }
  }
}

RESPONSE FORMAT:
Provide each file's content in clearly labeled sections:

===== design-tokens.json =====
{JSON content}

===== style-guide.md =====
{Markdown content}

===== tailwind.config.js =====
{JavaScript content}

===== validation-report.json =====
{JSON content}
```

### Phase 5: Parse & Write Output Files
```bash
# Parse Claude's response into separate files
CREATE: {base_path}/.design/style-consolidation/

# Extract and write each file
parsed_output = parse_claude_response(claude_response)

Write({
  file_path: "{base_path}/.design/style-consolidation/design-tokens.json",
  content: parsed_output.design_tokens
})

Write({
  file_path: "{base_path}/.design/style-consolidation/style-guide.md",
  content: parsed_output.style_guide
})

Write({
  file_path: "{base_path}/.design/style-consolidation/tailwind.config.js",
  content: parsed_output.tailwind_config
})

Write({
  file_path: "{base_path}/.design/style-consolidation/validation-report.json",
  content: parsed_output.validation_report
})
```

### Phase 6: TodoWrite & Completion
```javascript
TodoWrite({
  todos: [
    {content: "Load session and style cards", status: "completed", activeForm: "Loading style cards"},
    {content: "Select and validate variant IDs", status: "completed", activeForm: "Selecting variants"},
    {content: "Load design context from brainstorming", status: "completed", activeForm: "Loading context"},
    {content: "Synthesize unified design system with Claude", status: "completed", activeForm: "Synthesizing design system"},
    {content: "Write consolidated design system files", status: "completed", activeForm: "Writing output files"}
  ]
});
```

**Completion Message**:
```
✅ Style consolidation complete for session: {session_id}

Consolidated {selected_variants.length} variant(s):
{FOR each variant: - {variant.name} ({variant.id})}

Validation Summary:
- Colors: {total_colors} (WCAG AA: {compliant_count}/{total_colors})
- Typography: {scale_count} sizes
- Spacing: {scale_count} values
- Accessibility: {status}

📂 Output: {base_path}/.design/style-consolidation/
  ├── design-tokens.json        (Final token definitions)
  ├── style-guide.md             (Design system documentation)
  ├── tailwind.config.js         (Tailwind configuration)
  └── validation-report.json     (Validation audit)

Next: /workflow:ui-design:generate --session {session_id} --pages "dashboard,auth"

Note: When called from /workflow:ui-design:auto, UI generation is triggered automatically.
```

## Output Structure

```
.workflow/WFS-{session}/.design/style-consolidation/
├── design-tokens.json           # Final validated CSS tokens
├── style-guide.md               # Comprehensive design system documentation
├── tailwind.config.js           # Tailwind theme configuration
└── validation-report.json       # Validation audit results
```

### design-tokens.json Format
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
- **Invalid variant IDs**: List available IDs, auto-select all if called from auto workflow
- **Parsing errors**: Retry with stricter format instructions
- **Validation warnings**: Report but continue (non-blocking)

## Key Improvements Over Previous Version

1. **Zero External Dependencies**: No `gemini-wrapper`, no `codex` - pure Claude
2. **Direct Token Merging**: Reads `proposed_tokens` from style cards directly
3. **Single-Pass Synthesis**: One comprehensive prompt generates all outputs
4. **Reproducible**: Deterministic structure with clear consolidation rules
5. **Streamlined**: `Load → Synthesize → Write` (3 steps vs 7+ previously)

## Integration Points
- **Input**: `style-cards.json` from `/workflow:ui-design:extract` (with `proposed_tokens`)
- **Output**: `design-tokens.json` for `/workflow:ui-design:generate`
- **Context**: Optional `synthesis-specification.md` or `ui-designer/analysis.md`
