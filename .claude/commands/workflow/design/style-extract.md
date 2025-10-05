---
name: style-extract
description: Extract design style from reference images using Gemini Vision and Codex
usage: /workflow:design:style-extract --session <session_id> --images "<glob_pattern>"
argument-hint: "--session WFS-session-id --images \"path/to/*.png\""
examples:
  - /workflow:design:style-extract --session WFS-auth --images "design-refs/*.png"
  - /workflow:design:style-extract --session WFS-dashboard --images "refs/dashboard-*.jpg"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*), Read(*), Write(*), Bash(*), Glob(*)
---

# Style Extraction Command

## Overview
Extract design style elements from reference images using a hybrid approach: Gemini Vision for semantic understanding and Codex for structured CSS token generation.

## Core Philosophy
- **Visual Semantic Understanding**: Gemini Vision analyzes design style, typography, and composition
- **Structured Token Generation**: Codex converts semantic analysis to OKLCH + CSS variables + Tailwind config
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

### Phase 2: Gemini Vision Analysis
**Agent Invocation**: Task(conceptual-planning-agent) with Gemini Vision capability

```bash
Task(conceptual-planning-agent): "
[FLOW_CONTROL]

Extract visual design semantics from reference images

## Context Loading
ASSIGNED_TASK: style-extraction
OUTPUT_LOCATION: .workflow/WFS-{session}/.design/style-extraction/
IMAGE_INPUTS: {expanded_image_paths}

## Flow Control Steps
1. **load_images_gemini**
   - Action: Analyze reference images using Gemini Vision
   - Command: bash(cd .workflow/WFS-{session} && ~/.claude/scripts/gemini-wrapper --approval-mode yolo -p \"
     PURPOSE: Extract design style semantics from reference images
     TASK: Analyze color palettes, typography, spacing, layout principles, component styles
     MODE: write
     CONTEXT: @{../../{image_paths}}
     EXPECTED: JSON with semantic style description (colors with names, font characteristics, spacing scale, design philosophy)
     RULES: Focus on extracting semantic meaning, not exact pixel values
     \")
   - Output: semantic_style_analysis.json

2. **load_session_context**
   - Action: Load brainstorming context for style alignment
   - Command: Read(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md) || Read(.workflow/WFS-{session}/.brainstorming/ui-designer/analysis.md)
   - Output: design_context
   - Optional: true

## Analysis Requirements
**Semantic Extraction**: Identify design philosophy (minimalist, brutalist, neumorphic, etc.)
**Color System**: Extract primary, secondary, accent colors with semantic names
**Typography**: Font families, weights, scale (headings, body, small)
**Spacing**: Identify spacing scale patterns
**Components**: Border radius, shadows, button styles, card styles

## Expected Deliverables
1. **semantic_style_analysis.json**: Gemini Vision analysis results
"
```

### Phase 3: Codex Structured Token Generation
**Agent Invocation**: Task(conceptual-planning-agent) with Codex capabilities

```bash
Task(conceptual-planning-agent): "
[FLOW_CONTROL]

Convert semantic style analysis to structured CSS tokens

## Context Loading
INPUT_ANALYSIS: .workflow/WFS-{session}/.design/style-extraction/semantic_style_analysis.json
OUTPUT_LOCATION: .workflow/WFS-{session}/.design/style-extraction/
TECH_STACK_CONTEXT: CLAUDE.md, .claude/workflows/cli-templates/tech-stacks/*.md

## Flow Control Steps
1. **load_semantic_analysis**
   - Action: Read Gemini Vision analysis
   - Command: Read(.workflow/WFS-{session}/.design/style-extraction/semantic_style_analysis.json)
   - Output: semantic_analysis

2. **generate_css_tokens_codex**
   - Action: Convert semantic analysis to structured CSS tokens
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
