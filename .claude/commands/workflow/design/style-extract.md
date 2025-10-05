---
name: style-extract
description: Extract design style from reference images using triple vision analysis (Claude Code + Gemini + Codex)
usage: /workflow:design:style-extract --session <session_id> --images "<glob_pattern>"
argument-hint: "--session WFS-session-id --images \"path/to/*.png\""
examples:
  - /workflow:design:style-extract --session WFS-auth --images "design-refs/*.png"
  - /workflow:design:style-extract --session WFS-dashboard --images "refs/dashboard-*.jpg"
allowed-tools: TodoWrite(*), Read(*), Write(*), Bash(*), Glob(*)
---

# Style Extraction Command

## Overview
Extract design style elements from reference images using triple vision analysis: Claude Code's native vision, Gemini Vision for semantic understanding, and Codex for structured token generation.

## Core Philosophy
- **Triple Vision Analysis**: Combine Claude Code, Gemini Vision, and Codex vision capabilities
- **Comprehensive Coverage**: Claude Code for quick analysis, Gemini for deep semantic understanding, Codex for structured output
- **Consensus-Based Extraction**: Synthesize results from all three sources
- **Style Card System**: Generate reusable style cards for consolidation phase
- **Multi-Image Support**: Process multiple reference images and extract common patterns

## Execution Protocol

### Phase 1: Session & Input Validation
```bash
# Validate session and locate images
CHECK: .workflow/.active-* marker files
VALIDATE: session_id matches active session
EXPAND: glob pattern to concrete image paths
VERIFY: at least one image file exists
```

### Phase 2: Claude Code Vision Analysis (Quick Initial Pass)
**Direct Execution**: Use Read tool with image paths

```bash
# Claude Code's native vision capability for quick initial analysis
FOR each image IN expanded_image_paths:
  Read({image_path})
  # Claude Code analyzes image and extracts basic patterns

# Write preliminary analysis
Write(.workflow/WFS-{session}/.design/style-extraction/claude_vision_analysis.json)
```

**Output**: `claude_vision_analysis.json` with Claude Code's initial observations

### Phase 3: Gemini Vision Analysis (Deep Semantic Understanding)
**Direct Bash Execution**: No agent wrapper

```bash
bash(cd .workflow/WFS-{session}/.design/style-extraction && \
  ~/.claude/scripts/gemini-wrapper --approval-mode yolo -p "
    PURPOSE: Extract deep design semantics from reference images
    TASK: Analyze color palettes, typography, spacing, layout principles, component styles, design philosophy
    MODE: write
    CONTEXT: @{../../{image_paths}}
    EXPECTED: JSON with comprehensive semantic style description (colors with names, font characteristics, spacing scale, design philosophy, UI patterns)
    RULES: Focus on extracting semantic meaning and design intent, not exact pixel values. Identify design system patterns.
  ")

# Output: gemini_vision_analysis.json
```

**Output**: `gemini_vision_analysis.json` with Gemini's deep semantic analysis

### Phase 4: Codex Vision Analysis (Structured Pattern Recognition)
**Direct Bash Execution**: Codex with -i parameter

```bash
bash(codex -C .workflow/WFS-{session}/.design/style-extraction --full-auto -i {image_paths} exec "
  PURPOSE: Analyze reference images for structured design patterns
  TASK: Extract color values, typography specs, spacing measurements, component patterns
  MODE: auto
  CONTEXT: Reference images provided via -i parameter
  EXPECTED: Structured JSON with precise design specifications
  RULES: Focus on measurable design attributes and component patterns
" --skip-git-repo-check -s danger-full-access)

# Output: codex_vision_analysis.json
```

**Output**: `codex_vision_analysis.json` with Codex's structured analysis

### Phase 5: Synthesis of Triple Vision Analysis
**Direct Execution**: Main Claude synthesizes all three analyses

```bash
# Read all three vision analysis results
Read(.workflow/WFS-{session}/.design/style-extraction/claude_vision_analysis.json)
Read(.workflow/WFS-{session}/.design/style-extraction/gemini_vision_analysis.json)
Read(.workflow/WFS-{session}/.design/style-extraction/codex_vision_analysis.json)

# Load optional session context
Read(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md) [optional]

# Synthesize consensus analysis
# Main Claude identifies common patterns, resolves conflicts, creates unified semantic analysis
Write(.workflow/WFS-{session}/.design/style-extraction/semantic_style_analysis.json)
```

**Synthesis Strategy**:
- **Color system**: Consensus from all three sources, prefer Codex for precise values
- **Typography**: Gemini for semantic understanding, Codex for measurements
- **Spacing**: Cross-validate across all three,identify consistent patterns
- **Design philosophy**: Weighted combination with Gemini having highest weight
- **Conflict resolution**: Majority vote or use context from synthesis-specification.md

**Output**: `semantic_style_analysis.json` - unified analysis synthesizing all three sources

### Phase 6: Structured Token Generation
**Direct Bash Execution**: Codex generates CSS tokens

```bash
bash(codex -C .workflow/WFS-{session}/.design/style-extraction --full-auto exec "
  PURPOSE: Convert synthesized semantic analysis to structured CSS design tokens
  TASK: Generate W3C-compliant design tokens, Tailwind config, and style card variants
  MODE: auto
  CONTEXT: @{semantic_style_analysis.json,../../../../CLAUDE.md}
  EXPECTED: design-tokens.json (OKLCH format), tailwind-tokens.js, style-cards.json (3 variants)
  RULES: $(cat ~/.claude/workflows/design-tokens-schema.md) | OKLCH colors, rem spacing, semantic naming
" --skip-git-repo-check -s danger-full-access)
```

**Output**:
- `design-tokens.json`: W3C-compliant tokens in OKLCH format
- `tailwind-tokens.js`: Tailwind theme extension
- `style-cards.json`: 3 style variant cards for user selection
   - Command: bash(codex -C .workflow/WFS-{session}/.design/style-extraction --full-auto exec \"
     PURPOSE: Generate structured CSS design tokens from semantic analysis
     TASK: Convert semantic color/typography/spacing to OKLCH CSS variables and Tailwind config
     MODE: auto
     CONTEXT: @{semantic_style_analysis.json,../../../../CLAUDE.md}
     EXPECTED:
     1. design-tokens.json with OKLCH color values, font stacks, spacing scale
     2. tailwind-tokens.js with Tailwind config extension
     3. style-cards.json with named style variants for user selection
     RULES: Use OKLCH for colors, rem for spacing, maintain semantic naming, generate 2-3 style card variants
     \" --skip-git-repo-check -s danger-full-access)
   - Output: design-tokens.json, tailwind-tokens.js, style-cards.json

## Token Requirements
**Color Format**: OKLCH with fallback (e.g., \"oklch(0.65 0.15 270 / 1)\")
**Spacing Scale**: rem-based (0.25rem, 0.5rem, 1rem, 1.5rem, 2rem, 3rem, 4rem, 6rem)
**Typography Scale**: rem-based with line-height (xs, sm, base, lg, xl, 2xl, 3xl, 4xl)
**Border Radius**: rem-based (none, sm, md, lg, xl, 2xl, full)
**Shadows**: Layered shadows with OKLCH colors

## Expected Deliverables
1. **design-tokens.json**: Structured CSS token definitions
2. **tailwind-tokens.js**: Tailwind configuration extension
3. **style-cards.json**: Multiple style variants for user selection
"
```

### Phase 4: TodoWrite Integration
```javascript
TodoWrite({
  todos: [
    {
      content: "Validate session and locate reference images",
      status: "completed",
      activeForm: "Validating session and images"
    },
    {
      content: "Extract visual semantics using Gemini Vision",
      status: "completed",
      activeForm: "Extracting visual semantics"
    },
    {
      content: "Generate structured CSS tokens using Codex",
      status: "completed",
      activeForm: "Generating CSS tokens"
    },
    {
      content: "Create style cards for consolidation phase",
      status: "completed",
      activeForm: "Creating style cards"
    }
  ]
});
```

## Output Structure

```
.workflow/WFS-{session}/.design/style-extraction/
├── semantic_style_analysis.json    # Gemini Vision semantic analysis
├── design-tokens.json              # Structured CSS tokens (OKLCH)
├── tailwind-tokens.js              # Tailwind config extension
└── style-cards.json                # Style variants for user selection
```

### style-cards.json Format
```json
{
  "style_cards": [
    {
      "id": "variant-1",
      "name": "Modern Minimalist",
      "description": "Clean, high contrast with bold typography",
      "preview": {
        "primary": "oklch(0.45 0.20 270 / 1)",
        "background": "oklch(0.98 0.01 270 / 1)",
        "font_heading": "Inter, system-ui, sans-serif",
        "border_radius": "0.5rem"
      }
    },
    {
      "id": "variant-2",
      "name": "Soft Neumorphic",
      "description": "Subtle shadows with gentle colors",
      "preview": {
        "primary": "oklch(0.60 0.10 200 / 1)",
        "background": "oklch(0.95 0.02 200 / 1)",
        "font_heading": "Poppins, sans-serif",
        "border_radius": "1rem"
      }
    }
  ]
}
```

## Error Handling
- **No images found**: Report error and suggest correct glob pattern
- **Gemini Vision failure**: Retry once, then fall back to manual style description
- **Codex token generation failure**: Use default token template and report warning
- **Invalid session**: Prompt user to start workflow session first

## Integration Points
- **Input**: Reference images (PNG, JPG, WebP)
- **Output**: Style cards for `/workflow:design:style-consolidate`
- **Context**: Optional synthesis-specification.md or ui-designer/analysis.md

## Next Steps
After successful extraction:
```
Style extraction complete for session: WFS-{session}
Style cards generated: {count}

Next: /workflow:design:style-consolidate --session WFS-{session} [--interactive]
```
