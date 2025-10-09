---
name: generate
description: Generate UI prototypes using consolidated design tokens
usage: /workflow:ui-design:generate [--pages "<list>"] [--session <id>] [--variants <count>] [--creative-variants <count>]
argument-hint: "[--pages \"dashboard,auth\"] [--session WFS-xxx] [--variants 3] [--creative-variants 3]"
examples:
  - /workflow:ui-design:generate --pages "home,pricing" --variants 2
  - /workflow:ui-design:generate --session WFS-auth --pages "dashboard" --creative-variants 4
  - /workflow:ui-design:generate --session WFS-auth --variants 3
allowed-tools: TodoWrite(*), Read(*), Write(*), Task(conceptual-planning-agent)
---

# UI Generation Command

## Overview
Generate production-ready UI prototypes (HTML/CSS) strictly adhering to consolidated design tokens and synthesis specification requirements.

## Core Philosophy
- **Dual-Mode Execution**: Standard (consistent) or Creative (exploratory)
- **Agent-Driven**: Uses `Task(conceptual-planning-agent)` exclusively
- **Token-Driven**: All styles reference design-tokens.json; no hardcoded values
- **Production-Ready**: Semantic HTML5, ARIA attributes, responsive design

## Execution Protocol

### Phase 1: Mode Detection & Context Loading
```bash
# Detect execution mode
IF --creative-variants provided:
    mode = "creative"  # Parallel agents for diverse layouts
    creative_count = {--creative-variants value}
    VALIDATE: 1 <= creative_count <= 10
ELSE:
    mode = "standard"  # Single agent, multiple variants
    variants_count = --variants provided ? {count} : 1
    VALIDATE: 1 <= variants_count <= 5

# Detect session mode
IF --session:
    session_mode = "integrated"
    session_id = {provided_session}
    base_path = ".workflow/WFS-{session_id}/"
ELSE:
    session_mode = "standalone"
    # Infer session_id from existing design-session-* directory
    base_path = "./{detected_design_session}/"

# Infer page list if not provided
IF --pages provided:
    page_list = {explicit_pages}
ELSE IF session_mode == "integrated":
    # Read synthesis-specification.md to extract page requirements
    synthesis_spec = Read({base_path}/.brainstorming/synthesis-specification.md)
    page_list = extract_pages_from_synthesis(synthesis_spec)
ELSE:
    # Infer from existing prototypes or default
    page_list = detect_from_prototypes({base_path}/.design/prototypes/) OR ["home"]

VALIDATE: page_list not empty

# Load design system
VERIFY: {base_path}/.design/style-consolidation/design-tokens.json exists
design_tokens = Read({base_path}/.design/style-consolidation/design-tokens.json)
style_guide = Read({base_path}/.design/style-consolidation/style-guide.md)

# Load requirements (if integrated mode)
IF session_mode == "integrated":
    synthesis_spec = Read({base_path}/.brainstorming/synthesis-specification.md)
```

### Phase 2: UI Generation Execution

**Route based on mode**:

#### A. Standard Mode (Default)
Execute if `mode == "standard"`. Single agent generates multiple variants with consistent layout strategy.

```bash
# Create output directory
CREATE: {base_path}/.design/prototypes/

# Single agent call generates N variants for all pages
Task(conceptual-planning-agent): "
  [UI_GENERATION]

  Generate UI prototypes adhering to design tokens

  ## Context
  SESSION: {session_id}
  MODE: standard
  PAGES: {page_list}
  VARIANTS_PER_PAGE: {variants_count}
  OUTPUT: {base_path}/.design/prototypes/

  ## Input Files
  - Design Tokens: {base_path}/.design/style-consolidation/design-tokens.json
  - Style Guide: {base_path}/.design/style-consolidation/style-guide.md
  {IF integrated: - Requirements: {base_path}/.brainstorming/synthesis-specification.md}

  ## Task
  For each page in [{page_list}], generate {variants_count} variant(s):
  - {page}-variant-{n}.html (semantic HTML5)
  - {page}-variant-{n}.css (token-driven, no hardcoded values)
  - {page}-variant-{n}-notes.md (implementation notes)

  ## Layout Strategy
  Use a consistent, modern layout approach across all variants. Variants should differ in:
  - Component arrangement (e.g., sidebar left vs. right)
  - Content density (spacious vs. compact)
  - Navigation style (top-nav vs. side-nav)

  ## Token Usage Requirements
  - STRICT adherence to design-tokens.json
  - All colors: var(--color-brand-primary), var(--color-surface-background), etc.
  - All spacing: var(--spacing-4), var(--spacing-6), etc.
  - All typography: var(--font-family-heading), var(--font-size-lg), etc.
  - NO hardcoded values (e.g., #4F46E5, 16px) allowed

  ## HTML Requirements
  - Semantic HTML5 elements (<header>, <nav>, <main>, <section>, <article>)
  - ARIA attributes for accessibility (role, aria-label, aria-labelledby)
  - Proper heading hierarchy (h1 → h2 → h3)
  - Mobile-first responsive design

  ## CSS Requirements
  - Use CSS custom properties from design-tokens.json
  - Mobile-first media queries using token breakpoints
  - No inline styles
  - BEM or semantic class naming

  ## Responsive Design
  - Mobile: 375px+ (single column, stacked)
  - Tablet: var(--breakpoint-md) (adapted layout)
  - Desktop: var(--breakpoint-lg)+ (full layout)

  ## Deliverables
  For each page-variant combination:
  1. HTML file with token-driven structure
  2. CSS file with custom property references
  3. Notes file with implementation details

  Total files: {len(page_list) * variants_count * 3}
"
```

#### B. Creative Mode
Execute if `mode == "creative"`. Parallel agents explore diverse layout strategies.

```bash
# Define diverse layout strategies
layout_strategies = [
  "F-Pattern: Traditional reading flow with strong visual hierarchy",
  "Asymmetric Grid: Dynamic, modern layout with intentional imbalance",
  "Card-Based Modular: Flexible card grid for content-heavy pages",
  "Z-Pattern: Zigzag visual flow for conversion-focused layouts",
  "Split-Screen: Dramatic 50/50 division for dual-focus content",
  "Bento Box: Japanese-inspired grid with varied cell sizes",
  "Full-Bleed Hero: Large hero section with scrolling content",
  "Sidebar-First: Prominent sidebar navigation with content area"
]

# Launch N agents × M pages in parallel
CREATE: {base_path}/.design/prototypes/

FOR page IN page_list:
  FOR i IN range(creative_count):
    layout = layout_strategies[i % len(layout_strategies)]

    Task(conceptual-planning-agent): "
      [UI_GENERATION_CREATIVE]

      Generate creative UI prototype: {page} (Variant {i+1})

      ## Context
      PAGE: {page}
      LAYOUT_STRATEGY: {layout}
      VARIANT_NUMBER: {i+1}
      OUTPUT: {base_path}/.design/prototypes/

      ## Input Files
      - Design Tokens: {base_path}/.design/style-consolidation/design-tokens.json
      - Style Guide: {base_path}/.design/style-consolidation/style-guide.md
      {IF integrated: - Requirements: {base_path}/.brainstorming/synthesis-specification.md}

      ## Task
      Generate a single prototype for {page} using '{layout}' layout:
      - {page}-creative-variant-{i+1}.html
      - {page}-creative-variant-{i+1}.css
      - {page}-creative-variant-{i+1}-notes.md

      ## Layout Focus
      This variant MUST follow '{layout}' layout strategy.
      Be bold and exploratory - this is for design exploration.

      ## Token Usage Requirements (STRICT)
      - All colors: var(--color-*) from design-tokens.json
      - All spacing: var(--spacing-*) from design-tokens.json
      - All typography: var(--font-*) from design-tokens.json
      - NO hardcoded values allowed

      ## HTML/CSS/Accessibility Requirements
      - Semantic HTML5 with ARIA attributes
      - Mobile-first responsive design
      - Token-driven styling only
      - Unique layout interpretation of '{layout}' strategy

      ## Deliverables
      1. HTML file embodying '{layout}' layout
      2. CSS file with strict token usage
      3. Notes explaining layout decisions
    "

# Wait for all {len(page_list) * creative_count} tasks to complete
```

### Phase 3: Generate Preview Files

```bash
# Generate preview utilities
Write({base_path}/.design/prototypes/index.html)  # Master navigation
Write({base_path}/.design/prototypes/compare.html)  # Side-by-side comparison
Write({base_path}/.design/prototypes/PREVIEW.md)  # Setup instructions
Write({base_path}/.design/prototypes/design-tokens.css)  # CSS custom properties
```

**index.html Template**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UI Prototypes Preview - {session_id}</title>
  <style>
    body { font-family: system-ui; max-width: 1200px; margin: 2rem auto; padding: 0 1rem; }
    h1 { color: #2563eb; }
    .prototype-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; margin-top: 2rem; }
    .prototype-card { border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1rem; transition: box-shadow 0.2s; }
    .prototype-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .prototype-card h3 { margin: 0 0 0.5rem; color: #1f2937; }
    .prototype-card .meta { font-size: 0.875rem; color: #6b7280; margin-bottom: 1rem; }
    .prototype-card a { display: inline-block; margin-right: 0.5rem; color: #2563eb; text-decoration: none; }
    .prototype-card a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>🎨 UI Prototypes Preview</h1>
  <p><strong>Session:</strong> {session_id} | <strong>Mode:</strong> {mode}</p>
  <p><a href="compare.html">📊 Compare Variants</a> | <a href="PREVIEW.md">📖 Instructions</a></p>

  <div class="prototype-grid">
    {FOR each generated file:
      <div class="prototype-card">
        <h3>{page} - Variant {n}</h3>
        <div class="meta">{mode} mode</div>
        <a href="{filename}.html" target="_blank">View →</a>
        <a href="{filename}-notes.md">Notes</a>
      </div>
    }
  </div>
</body>
</html>
```

**design-tokens.css Template**:
```css
/* Auto-generated from design-tokens.json */
:root {
  /* Colors - Brand */
  --color-brand-primary: {value};
  --color-brand-secondary: {value};
  --color-brand-accent: {value};

  /* Colors - Surface */
  --color-surface-background: {value};
  --color-surface-elevated: {value};
  --color-surface-overlay: {value};

  /* Typography */
  --font-family-heading: {value};
  --font-family-body: {value};
  --font-size-base: {value};
  /* ... all tokens as CSS custom properties ... */
}
```

### Phase 4: TodoWrite & Completion

```javascript
TodoWrite({
  todos: [
    {content: "Detect mode and load design system", status: "completed", activeForm: "Loading design system"},
    {content: "Generate {total_count} UI prototypes", status: "completed", activeForm: "Generating prototypes"},
    {content: "Generate preview files", status: "completed", activeForm: "Generating preview"}
  ]
});
```

**Completion Message**:
```
✅ UI generation complete for session: {session_id}

Mode: {mode}
Pages: {page_list}
{IF standard: Variants per page: {variants_count}}
{IF creative: Creative variants per page: {creative_count}}

Generated {total_count} prototypes:
{FOR each file: - {filename}}

📂 Location: {base_path}/.design/prototypes/

🌐 Preview:
1. Quick: Open index.html in browser
2. Server: cd prototypes && python -m http.server 8080
3. Compare: Open compare.html for side-by-side view

Next: /workflow:ui-design:update --session {session_id}

Note: When called from /workflow:ui-design:auto, design-update is triggered automatically.
```

## Output Structure

```
.workflow/WFS-{session}/.design/prototypes/
├── index.html                     # Preview index (master navigation)
├── compare.html                   # Side-by-side comparison
├── PREVIEW.md                     # Preview instructions
├── design-tokens.css              # CSS custom properties
├── {page}-variant-{n}.html
├── {page}-variant-{n}.css
├── {page}-variant-{n}-notes.md
└── ... (all generated prototypes)
```

## Error Handling
- **No design tokens found**: Run `/workflow:ui-design:consolidate` first
- **Invalid page names**: Extract from synthesis-specification.md or error
- **Agent execution errors**: Report details, suggest retry
- **Missing requirements**: Continue with design tokens only

## Quality Checks
After generation, ensure:
- [ ] All CSS values reference design token custom properties
- [ ] No hardcoded colors, spacing, or typography
- [ ] Semantic HTML structure
- [ ] ARIA attributes present
- [ ] Responsive design implemented
- [ ] Mobile-first approach

## Key Improvements Over Previous Version

1. **Unified Execution Model**: Only `Task(conceptual-planning-agent)` - no CLI tools
2. **Dual-Mode Simplicity**: Standard (consistent) or Creative (exploratory)
3. **Explicit Layout Strategies**: Creative mode uses predefined layout patterns
4. **Preview Enhancements**: index.html, compare.html, and design-tokens.css
5. **Streamlined**: Clear, consistent agent invocation patterns

## Integration Points
- **Input**: design-tokens.json, style-guide.md from `/workflow:ui-design:consolidate`
- **Output**: HTML/CSS prototypes for `/workflow:ui-design:update`
- **Context**: synthesis-specification.md for page requirements and content guidance
