---
name: ui-generate
description: Generate UI prototypes using consolidated design tokens and synthesis specification
usage: /workflow:design:ui-generate --session <session_id> --pages "<page_list>" [--variants <count>]
argument-hint: "--session WFS-session-id --pages \"dashboard,auth,settings\" [--variants 2]"
examples:
  - /workflow:design:ui-generate --session WFS-auth --pages "login,register"
  - /workflow:design:ui-generate --session WFS-dashboard --pages "dashboard" --variants 3
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*), Read(*), Write(*), Bash(*)
---

# UI Generation Command

## Overview
Generate production-ready UI prototypes (HTML/CSS) strictly adhering to consolidated design tokens and synthesis specification requirements.

## Core Philosophy
- **Token-Driven**: All styles reference design-tokens.json, no hardcoded values
- **Specification-Aligned**: UI structure follows synthesis-specification.md requirements
- **Codex Primary**: Code generation with strict token enforcement
- **Gemini Variants**: Optional semantic layout variations
- **Production-Ready**: Clean HTML5, semantic markup, accessibility attributes

## Execution Protocol

### Phase 1: Session & Requirements Loading
```bash
# Validate session and load design system
CHECK: .workflow/.active-* marker files
VALIDATE: session_id matches active session
VERIFY: .design/style-consolidation/design-tokens.json exists
PARSE: --pages parameter to page list
SET: variants_count = --variants || 1
```

### Phase 2: Context Gathering
**Load comprehensive context for UI generation**

```bash
LOAD: design-tokens.json (style system)
LOAD: style-guide.md (usage guidelines)
LOAD: synthesis-specification.md (functional requirements)
LOAD: ui-designer/analysis.md (UX guidelines, optional)
PARSE: page_requirements for each page in --pages list
```

### Phase 3: Codex UI Generation (Primary)
**Agent Invocation**: Task(conceptual-planning-agent) with Codex capabilities

```bash
Task(conceptual-planning-agent): "
[FLOW_CONTROL]

Generate production-ready UI prototypes with strict design token adherence

## Context Loading
ASSIGNED_TASK: ui-prototype-generation
OUTPUT_LOCATION: .workflow/WFS-{session}/.design/prototypes/
TARGET_PAGES: {page_list}
VARIANTS_PER_PAGE: {variants_count}

## Flow Control Steps
1. **load_design_system**
   - Action: Load finalized design tokens and style guide
   - Commands:
     - Read(.workflow/WFS-{session}/.design/style-consolidation/design-tokens.json)
     - Read(.workflow/WFS-{session}/.design/style-consolidation/style-guide.md)
     - Read(.workflow/WFS-{session}/.design/style-consolidation/tailwind.config.js)
   - Output: design_system

2. **load_requirements**
   - Action: Load functional and UX requirements
   - Commands:
     - Read(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md)
     - Read(.workflow/WFS-{session}/.brainstorming/ui-designer/analysis.md) [optional]
   - Output: requirements_context

3. **generate_ui_prototypes_codex**
   - Action: Generate HTML/CSS prototypes with strict token enforcement
   - Command: bash(codex -C .workflow/WFS-{session}/.design/prototypes --full-auto exec \"
     PURPOSE: Generate production-ready UI prototypes adhering to design tokens
     TASK: Create HTML/CSS prototypes for pages: {page_list} with {variants_count} variant(s) each
     MODE: auto
     CONTEXT: @{../style-consolidation/design-tokens.json,../style-consolidation/style-guide.md,../../.brainstorming/synthesis-specification.md,../../../../CLAUDE.md}
     EXPECTED:
     For each page, generate {variants_count} variant(s):
     1. {page}-variant-{n}.html - Complete HTML structure
     2. {page}-variant-{n}.css - CSS using design token custom properties
     3. {page}-variant-{n}-notes.md - Implementation notes and token usage

     RULES:
     - ALL styles MUST reference design token CSS custom properties (--color-brand-primary, --spacing-4, etc.)
     - NO hardcoded colors, spacing, or typography values
     - Use semantic HTML5 elements (header, nav, main, section, article, footer)
     - Include ARIA labels and accessibility attributes (role, aria-label, aria-describedby)
     - Implement responsive design using token-based breakpoints
     - Follow component patterns from style-guide.md
     - Include placeholder content matching page purpose
     - Variants explore different layouts while maintaining token consistency
     - Generate CSS custom properties mapping in each CSS file
     \" --skip-git-repo-check -s danger-full-access)
   - Output: {page}-variant-{n}.html, {page}-variant-{n}.css, {page}-variant-{n}-notes.md

## Generation Requirements

**Token Adherence**:
- Use CSS custom properties for all design values
- Reference design-tokens.json for property definitions
- Example: `color: var(--color-brand-primary);`
- Example: `padding: var(--spacing-4) var(--spacing-6);`
- Example: `font-size: var(--font-size-lg);`

**Semantic HTML**:
```html
<header role=\"banner\">
  <nav role=\"navigation\" aria-label=\"Main navigation\">
    <!-- Navigation items -->
  </nav>
</header>
<main role=\"main\">
  <section aria-labelledby=\"section-heading\">
    <h2 id=\"section-heading\">Section Title</h2>
    <!-- Content -->
  </section>
</main>
<footer role=\"contentinfo\">
  <!-- Footer content -->
</footer>
```

**Accessibility Requirements**:
- Proper heading hierarchy (h1 → h2 → h3)
- Alt text for images
- ARIA labels for interactive elements
- Keyboard navigation support
- Focus indicators using token colors
- Sufficient color contrast (validated against tokens)

**Responsive Design**:
- Mobile-first approach
- Token-based breakpoints (e.g., --breakpoint-md: 768px)
- Flexible layouts using CSS Grid or Flexbox
- Responsive typography using clamp() with token values

## Expected Deliverables
For each page in {page_list}:
1. **{page}-variant-{n}.html**: Complete HTML prototype
2. **{page}-variant-{n}.css**: Token-driven CSS
3. **{page}-variant-{n}-notes.md**: Implementation notes
"
```

### Phase 4: Gemini Variant Suggestions (Optional)
**Conditional Execution**: Only if --variants > 1

```bash
IF variants_count > 1:
  Task(conceptual-planning-agent): "
  Generate semantic layout variation suggestions using Gemini

  TASK: Analyze synthesis-specification.md and suggest {variants_count} layout approaches
  CONTEXT: synthesis-specification.md, ui-designer/analysis.md
  OUTPUT: variant-suggestions.md with layout rationale for each variant

  Use Gemini to explore:
  - Different information hierarchy approaches
  - Alternative component compositions
  - Varied user flow emphasis
  - Diverse layout patterns (sidebar, top-nav, card-grid, list-detail)
  "
```

### Phase 5: TodoWrite Integration
```javascript
TodoWrite({
  todos: [
    {
      content: "Validate session and load design system",
      status: "completed",
      activeForm: "Loading design system"
    },
    {
      content: "Load functional requirements and UX guidelines",
      status: "completed",
      activeForm: "Loading requirements"
    },
    {
      content: "Generate UI prototypes using Codex with token enforcement",
      status: "completed",
      activeForm: "Generating UI prototypes"
    },
    {
      content: "Generate layout variant suggestions using Gemini (optional)",
      status: "completed",
      activeForm: "Generating variant suggestions"
    },
    {
      content: "Create implementation notes for each prototype",
      status: "completed",
      activeForm: "Creating implementation notes"
    }
  ]
});
```

## Output Structure

```
.workflow/WFS-{session}/.design/prototypes/
├── dashboard-variant-1.html
├── dashboard-variant-1.css
├── dashboard-variant-1-notes.md
├── dashboard-variant-2.html (if --variants 2)
├── dashboard-variant-2.css
├── dashboard-variant-2-notes.md
├── auth-variant-1.html
├── auth-variant-1.css
├── auth-variant-1-notes.md
├── design-tokens.css              # CSS custom properties from design-tokens.json
└── variant-suggestions.md         # Gemini layout rationale (if variants > 1)
```

### HTML Prototype Example
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - Variant 1</title>
  <link rel="stylesheet" href="design-tokens.css">
  <link rel="stylesheet" href="dashboard-variant-1.css">
</head>
<body>
  <header role="banner" class="header">
    <nav role="navigation" aria-label="Main navigation" class="nav">
      <!-- Token-based navigation -->
    </nav>
  </header>
  <main role="main" class="main">
    <section aria-labelledby="dashboard-heading" class="dashboard-section">
      <h1 id="dashboard-heading" class="heading-primary">Dashboard</h1>
      <!-- Content using design tokens -->
    </section>
  </main>
  <footer role="contentinfo" class="footer">
    <!-- Footer content -->
  </footer>
</body>
</html>
```

### CSS Example
```css
/* Design Tokens (auto-generated from design-tokens.json) */
:root {
  --color-brand-primary: oklch(0.45 0.20 270 / 1);
  --color-surface-background: oklch(0.98 0.01 270 / 1);
  --spacing-4: 1rem;
  --spacing-6: 1.5rem;
  --font-size-lg: 1.125rem;
  --border-radius-md: 0.5rem;
  --shadow-md: 0 4px 6px oklch(0.00 0.00 0 / 0.07);
}

/* Component Styles (using tokens) */
.header {
  background-color: var(--color-surface-elevated);
  padding: var(--spacing-4) var(--spacing-6);
  box-shadow: var(--shadow-md);
}

.heading-primary {
  font-size: var(--font-size-3xl);
  color: var(--color-brand-primary);
  margin-bottom: var(--spacing-6);
}
```

## Error Handling
- **No design tokens found**: Run `/workflow:design:style-consolidate` first
- **Invalid page names**: List available pages from synthesis-specification.md
- **Codex generation errors**: Retry with simplified requirements, report warnings
- **Token reference errors**: Validate all CSS against design-tokens.json

## Quality Checks
After generation, verify:
- [ ] All CSS values reference design token custom properties
- [ ] No hardcoded colors, spacing, or typography
- [ ] Semantic HTML structure
- [ ] Accessibility attributes present
- [ ] Responsive design implemented
- [ ] Token-driven styling consistent across variants

## Integration Points
- **Input**: design-tokens.json, style-guide.md, synthesis-specification.md
- **Output**: HTML/CSS prototypes for `/workflow:design:design-update`
- **Context**: ui-designer/analysis.md for UX guidance

## Next Steps
After successful generation:
```
UI prototypes generated for session: WFS-{session}
Pages: {page_list}
Variants per page: {variants_count}

Generated files:
- {count} HTML prototypes
- {count} CSS files (token-driven)
- {count} implementation notes

Review prototypes and select preferred variants:
Location: .workflow/WFS-{session}/.design/prototypes/

Next: /workflow:design:design-update --session WFS-{session}
```
