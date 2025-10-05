---
name: ui-generate
description: Generate UI prototypes using consolidated design tokens with optional style overrides
usage: /workflow:design:ui-generate --session <session_id> --pages "<page_list>" [--variants <count>] [--style-overrides "<path_or_json>"]
argument-hint: "--session WFS-session-id --pages \"dashboard,auth\" [--variants 2] [--style-overrides \"overrides.json\"]"
examples:
  - /workflow:design:ui-generate --session WFS-auth --pages "login,register"
  - /workflow:design:ui-generate --session WFS-dashboard --pages "dashboard" --variants 3 --style-overrides "overrides.json"
allowed-tools: TodoWrite(*), Read(*), Write(*), Bash(*)
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

### Phase 4: Generate Preview Enhancement Files
**Direct Execution**: Create preview index and comparison view

```bash
# Generate preview index page
Write(.workflow/WFS-{session}/.design/prototypes/index.html):
  - List all generated prototypes with thumbnails
  - Quick navigation to individual variants
  - Metadata: page name, variant count, generation timestamp
  - Direct links to HTML files

# Generate side-by-side comparison view
Write(.workflow/WFS-{session}/.design/prototypes/compare.html):
  - Iframe-based comparison for all variants of same page
  - Responsive viewport toggles (mobile, tablet, desktop)
  - Synchronized scrolling option
  - Variant labels and quick switching

# Generate preview server instructions
Write(.workflow/WFS-{session}/.design/prototypes/PREVIEW.md):
  - How to open files directly in browser
  - Local server setup commands (Python, Node.js, PHP)
  - Port and access instructions
  - Browser compatibility notes
```

**Output**:
- `index.html`: Master index page for all prototypes
- `compare.html`: Side-by-side comparison view
- `PREVIEW.md`: Preview instructions and server setup guide

### Phase 5: Gemini Variant Suggestions (Optional)
**Conditional Execution**: Only if --variants > 1

```bash
IF variants_count > 1:
  bash(cd .workflow/WFS-{session}/.design/prototypes && \
    ~/.claude/scripts/gemini-wrapper -p "
    PURPOSE: Generate semantic layout variation rationale
    TASK: Analyze synthesis-specification.md and explain {variants_count} layout approaches
    MODE: analysis
    CONTEXT: @{../../.brainstorming/synthesis-specification.md,../../.brainstorming/ui-designer/analysis.md}
    EXPECTED: variant-suggestions.md with layout rationale for each variant
    RULES: Focus on information hierarchy, component composition, user flow emphasis, layout patterns
    ")
```

**Output**: `variant-suggestions.md` with Gemini's layout rationale

### Phase 6: TodoWrite Integration
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
      content: "Generate preview enhancement files (index, compare, instructions)",
      status: "completed",
      activeForm: "Generating preview files"
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
├── index.html                     # 🆕 Preview index page (master navigation)
├── compare.html                   # 🆕 Side-by-side comparison view
├── PREVIEW.md                     # 🆕 Preview instructions and server setup
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

### Preview Index Page Template (index.html)
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UI Prototypes Preview - WFS-{session}</title>
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
    .actions { margin-top: 2rem; padding: 1rem; background: #f3f4f6; border-radius: 0.5rem; }
    .actions a { margin-right: 1rem; color: #2563eb; }
  </style>
</head>
<body>
  <h1>🎨 UI Prototypes Preview</h1>
  <p><strong>Session:</strong> WFS-{session} | <strong>Generated:</strong> {timestamp}</p>

  <div class="actions">
    <a href="compare.html">📊 Compare All Variants</a>
    <a href="PREVIEW.md">📖 Preview Instructions</a>
  </div>

  <div class="prototype-grid">
    <!-- Auto-generated for each page-variant -->
    <div class="prototype-card">
      <h3>Dashboard - Variant 1</h3>
      <div class="meta">Generated: {timestamp}</div>
      <a href="dashboard-variant-1.html" target="_blank">View Prototype →</a>
      <a href="dashboard-variant-1-notes.md">Implementation Notes</a>
    </div>
  </div>
</body>
</html>
```

### Comparison View Template (compare.html)
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Side-by-Side Comparison - WFS-{session}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui; }
    .header { background: #1f2937; color: white; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
    .controls { display: flex; gap: 1rem; align-items: center; }
    select, button { padding: 0.5rem 1rem; border-radius: 0.25rem; border: 1px solid #d1d5db; background: white; cursor: pointer; }
    button:hover { background: #f3f4f6; }
    .comparison-container { display: flex; height: calc(100vh - 60px); }
    .variant-panel { flex: 1; border-right: 2px solid #e5e7eb; position: relative; }
    .variant-panel:last-child { border-right: none; }
    .variant-label { position: absolute; top: 0; left: 0; right: 0; background: rgba(37,99,235,0.9); color: white; padding: 0.5rem; text-align: center; z-index: 10; font-weight: 600; }
    iframe { width: 100%; height: 100%; border: none; padding-top: 2.5rem; }
    .viewport-toggle { display: flex; gap: 0.5rem; }
    .viewport-btn { padding: 0.25rem 0.75rem; font-size: 0.875rem; }
    .viewport-btn.active { background: #2563eb; color: white; border-color: #2563eb; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Side-by-Side Comparison</h1>
    <div class="controls">
      <div class="viewport-toggle">
        <button class="viewport-btn active" data-width="100%">Desktop</button>
        <button class="viewport-btn" data-width="768px">Tablet</button>
        <button class="viewport-btn" data-width="375px">Mobile</button>
      </div>
      <select id="page-select">
        <option value="dashboard">Dashboard</option>
        <option value="auth">Auth</option>
      </select>
      <label><input type="checkbox" id="sync-scroll"> Sync Scroll</label>
      <a href="index.html" style="color: white;">← Back to Index</a>
    </div>
  </div>

  <div class="comparison-container">
    <div class="variant-panel">
      <div class="variant-label">Variant 1</div>
      <iframe id="frame1" src="dashboard-variant-1.html"></iframe>
    </div>
    <div class="variant-panel">
      <div class="variant-label">Variant 2</div>
      <iframe id="frame2" src="dashboard-variant-2.html"></iframe>
    </div>
  </div>

  <script>
    // Viewport switching
    document.querySelectorAll('.viewport-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.viewport-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const width = btn.dataset.width;
        document.querySelectorAll('iframe').forEach(frame => {
          frame.style.width = width;
          frame.style.margin = width === '100%' ? '0' : '0 auto';
        });
      });
    });

    // Synchronized scrolling
    const syncCheckbox = document.getElementById('sync-scroll');
    const frames = [document.getElementById('frame1'), document.getElementById('frame2')];

    syncCheckbox.addEventListener('change', () => {
      if (syncCheckbox.checked) {
        frames.forEach(frame => {
          frame.contentWindow.addEventListener('scroll', () => {
            const scrollTop = frame.contentWindow.scrollY;
            frames.forEach(f => {
              if (f !== frame) f.contentWindow.scrollTo(0, scrollTop);
            });
          });
        });
      }
    });

    // Page switching
    document.getElementById('page-select').addEventListener('change', (e) => {
      const page = e.target.value;
      document.getElementById('frame1').src = `${page}-variant-1.html`;
      document.getElementById('frame2').src = `${page}-variant-2.html`;
    });
  </script>
</body>
</html>
```

### Preview Instructions Template (PREVIEW.md)
```markdown
# UI Prototypes Preview Guide

## Session Information
- **Session ID**: WFS-{session}
- **Generated**: {timestamp}
- **Pages**: {page_list}
- **Variants per page**: {variants_count}

## Quick Preview Options

### Option 1: Direct Browser Opening (Simplest)
1. Navigate to `.workflow/WFS-{session}/.design/prototypes/`
2. Double-click `index.html` to open the preview index
3. Click any prototype link to view in browser

### Option 2: Local Development Server (Recommended)

#### Python (Built-in)
```bash
cd .workflow/WFS-{session}/.design/prototypes
python -m http.server 8080
# Visit: http://localhost:8080
```

#### Node.js (npx)
```bash
cd .workflow/WFS-{session}/.design/prototypes
npx http-server -p 8080
# Visit: http://localhost:8080
```

#### PHP (Built-in)
```bash
cd .workflow/WFS-{session}/.design/prototypes
php -S localhost:8080
# Visit: http://localhost:8080
```

#### VS Code Live Server
1. Install "Live Server" extension
2. Right-click `index.html`
3. Select "Open with Live Server"

## Preview Features

### Index Page (`index.html`)
- **Master navigation** for all prototypes
- **Quick links** to individual variants
- **Metadata display**: timestamps, page info
- **Direct access** to implementation notes

### Comparison View (`compare.html`)
- **Side-by-side** variant comparison
- **Viewport toggles**: Desktop (100%), Tablet (768px), Mobile (375px)
- **Synchronized scrolling** option
- **Page switching** dropdown
- **Real-time** comparison

## Browser Compatibility
- ✅ Chrome/Edge (Recommended)
- ✅ Firefox
- ✅ Safari
- ⚠️ Some CSS features may require modern browsers (OKLCH colors)

## Files Overview
```
prototypes/
├── index.html          ← Start here
├── compare.html        ← Side-by-side comparison
├── PREVIEW.md          ← This file
├── {page}-variant-{n}.html  ← Individual prototypes
├── {page}-variant-{n}.css   ← Styles (token-driven)
├── design-tokens.css   ← CSS custom properties
└── {page}-variant-{n}-notes.md  ← Implementation guidance
```

## Next Steps
1. **Review prototypes**: Open index.html
2. **Compare variants**: Use compare.html for side-by-side view
3. **Select preferred**: Note variant IDs for design-update command
4. **Continue workflow**: Run design-update with selected prototypes

## Troubleshooting

**Styles not loading?**
- Ensure `design-tokens.css` is in the same directory
- Check browser console for CSS errors
- Verify file paths in HTML `<link>` tags

**OKLCH colors not displaying?**
- Use Chrome/Edge 111+ or Firefox 113+
- Fallback colors should work in older browsers

**Local server CORS issues?**
- Use one of the recommended local servers
- Avoid opening HTML files with `file://` protocol for best results
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
✅ UI prototypes generated for session: WFS-{session}
Pages: {page_list}
Variants per page: {variants_count}

Generated files:
- {count} HTML prototypes (complete, standalone)
- {count} CSS files (token-driven)
- {count} implementation notes
- 🆕 index.html (preview navigation)
- 🆕 compare.html (side-by-side comparison)
- 🆕 PREVIEW.md (preview instructions)

📂 Location: .workflow/WFS-{session}/.design/prototypes/

🌐 Preview Options:
1. Quick: Open index.html in browser
2. Full: Start local server and visit http://localhost:8080
   - Python: cd prototypes && python -m http.server 8080
   - Node.js: cd prototypes && npx http-server -p 8080

📊 Compare Variants:
- Open compare.html for side-by-side view
- Toggle viewports: Desktop / Tablet / Mobile
- Switch between pages dynamically
- Synchronized scrolling option

Review prototypes and select preferred variants, then run:
/workflow:design:design-update --session WFS-{session} --selected-prototypes "{page-variant-ids}"

Example:
/workflow:design:design-update --session WFS-{session} --selected-prototypes "dashboard-variant-1,auth-variant-2"
```
