---
name: ui-generate
description: Generate UI prototypes using consolidated design tokens with conventional or agent mode
usage: /workflow:design:ui-generate --pages "<list>" [--session <id>] [--variants <count>] [--use-agent]
argument-hint: "--pages \"dashboard,auth\" [--session WFS-xxx] [--variants 3] [--use-agent]"
examples:
  - /workflow:design:ui-generate --pages "login,register" --variants 2
  - /workflow:design:ui-generate --session WFS-auth --pages "dashboard" --variants 3 --use-agent
  - /workflow:design:ui-generate --pages "home,pricing" --variants 2
allowed-tools: TodoWrite(*), Read(*), Write(*), Bash(*), Task(conceptual-planning-agent)
---

# UI Generation Command

## Overview
Generate production-ready UI prototypes (HTML/CSS) strictly adhering to consolidated design tokens and synthesis specification requirements.

## Core Philosophy
- **Dual Mode**: Conventional (Codex primary) OR agent-driven (creative layouts)
- **Token-Driven**: All styles reference design-tokens.json, no hardcoded values
- **Variant Control**: Generate N prototypes per page based on `--variants` (default: 1)
- **Layout Diversity**: Agent mode explores structural variations (F-pattern, grid, asymmetric)
- **Production-Ready**: Semantic HTML5, ARIA attributes, responsive design

## Execution Protocol

### Phase 1: Mode Detection & Context Loading
```bash
# Detect execution mode
IF --use-agent:
    mode = "agent"  # Agent-driven creative layouts
ELSE:
    mode = "conventional"  # Codex primary generation

# Detect session mode
IF --session:
    session_mode = "integrated"
    session_id = {provided_session}
    base_path = ".workflow/WFS-{session_id}/"
ELSE:
    session_mode = "standalone"
    # Infer session_id from existing design-session-* directory
    base_path = "./{detected_design_session}/"

# Set parameters
PARSE: --pages to page_list[]
variants_count = --variants provided ? {count} : 1
VALIDATE: 1 <= variants_count <= 5

# Load design system
VERIFY: {base_path}/.design/style-consolidation/design-tokens.json exists
LOAD: design-tokens.json, style-guide.md, tailwind.config.js

# Load requirements (if integrated mode)
IF session_mode == "integrated":
    LOAD: {base_path}/.brainstorming/synthesis-specification.md
```

### Phase 2: UI Generation Execution

**Route based on mode**:

#### A. Conventional Mode (Codex Primary)
Execute if `mode == "conventional"`

```bash
# Single Codex call generates all variants for all pages
bash(codex -C {base_path}/.design/prototypes --full-auto exec "
  PURPOSE: Generate UI prototypes adhering to design tokens
  TASK: Create HTML/CSS for pages: {page_list} with {variants_count} variant(s) each
  MODE: auto
  CONTEXT: @{../style-consolidation/design-tokens.json,../style-consolidation/style-guide.md}
  EXPECTED:
  For each page, generate {variants_count} variant(s):
  - {page}-variant-{n}.html (semantic HTML5)
  - {page}-variant-{n}.css (token-driven, no hardcoded values)
  - {page}-variant-{n}-notes.md (implementation notes)

  RULES:
  - STRICT token adherence: var(--color-brand-primary), var(--spacing-4)
  - Semantic HTML5 + ARIA attributes
  - Responsive: mobile-first, token-based breakpoints
  - Variants differ in minor layout details
" --skip-git-repo-check -s danger-full-access)
```

#### B. Agent Mode (Creative Layouts)
Execute if `mode == "agent"`

**Agent-Driven Parallel Generation**:
```bash
# Define layout strategies for diversity
layouts = generate_layout_strategies(variants_count)
# Example: ["F-Pattern", "Asymmetric Grid", "Card-Based Modular"]

# Launch parallel agent tasks for each page-variant combination
FOR page IN page_list:
  FOR i IN range(variants_count):
    Task(conceptual-planning-agent): "
    [FLOW_CONTROL]

    Generate UI prototype: {page} using '{layouts[i]}' layout

    ## Context
    PAGE: {page}
    LAYOUT_STRATEGY: {layouts[i]}
    OUTPUT: {base_path}/.design/prototypes/

    ## Flow Steps
    1. **load_design_system**
       Read design-tokens.json and style-guide.md

    2. **load_requirements**
       IF session_mode == 'integrated':
           Read synthesis-specification.md for {page} requirements

    3. **generate_prototype_codex**
       Use Codex to generate HTML/CSS with layout focus:
       Layout: {layouts[i]}
       Token adherence: STRICT (all values from design-tokens)
       Output: {page}-variant-{i}.html/css/notes.md

    ## Rules
    - Layout must follow '{layouts[i]}' strategy
    - Examples:
      * F-Pattern: Content flows top→left→middle→bottom
      * Asymmetric Grid: Strong visual hierarchy, off-center
      * Card-Based: Modular components, flexible grid
    - STRICT token usage, semantic HTML, ARIA attributes
    "

Wait for all {len(page_list) * variants_count} tasks to complete
```

### Phase 3: Generate Preview Files

```bash
# Generate preview utilities
Write({base_path}/.design/prototypes/index.html)  # Master navigation
Write({base_path}/.design/prototypes/compare.html)  # Side-by-side comparison
Write({base_path}/.design/prototypes/PREVIEW.md)  # Setup instructions
```

### Phase 4: TodoWrite & Completion

```javascript
TodoWrite({
  todos: [
    {content: "Detect mode and load design system", status: "completed", activeForm: "Loading design system"},
    {content: "Generate {len(page_list) * variants_count} UI prototypes", status: "completed", activeForm: "Generating prototypes"},
    {content: "Generate preview files", status: "completed", activeForm: "Generating preview"}
  ]
});
```

**Completion Message**:
```
UI generation complete for session: {session_id}
Mode: {mode} | Pages: {page_list} | Variants: {variants_count}

Generated {len(page_list) * variants_count} prototypes:
{list_generated_files}

Location: {base_path}/.design/prototypes/

Preview: Open index.html or run: python -m http.server 8080

Next: /workflow:design:design-update --session {session_id} --selected-prototypes "{selected_ids}"
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
