---
name: generate
description: Generate UI prototypes in matrix mode (style × layout combinations)
usage: /workflow:ui-design:generate [--pages "<list>"] [--base-path <path>] [--session <id>] [--style-variants <count>] [--layout-variants <count>]
argument-hint: "[--pages \"dashboard,auth\"] [--base-path \".workflow/WFS-xxx/runs/run-xxx/.design\"] [--style-variants 3] [--layout-variants 3]"
examples:
  - /workflow:ui-design:generate --base-path ".workflow/WFS-auth/runs/run-xxx/.design" --pages "dashboard,settings" --style-variants 3 --layout-variants 3
  - /workflow:ui-design:generate --session WFS-auth --pages "home,pricing" --style-variants 2 --layout-variants 2
  - /workflow:ui-design:generate --base-path "./design-session-xxx/.design" --style-variants 3 --layout-variants 3
allowed-tools: TodoWrite(*), Read(*), Write(*), Task(conceptual-planning-agent), Bash(*)
---

# UI Generation Command (Matrix Mode)

## Overview
Generate production-ready UI prototypes (HTML/CSS) in `style × layout` matrix mode, strictly adhering to consolidated design tokens from separate style design systems.

## Core Philosophy
- **Matrix-Only**: Single mode generating `style_variants × layout_variants × pages` prototypes
- **Agent-Driven**: Uses `Task(conceptual-planning-agent)` for parallel generation
- **Token-Driven**: All styles reference per-style design-tokens.json; no hardcoded values
- **Production-Ready**: Semantic HTML5, ARIA attributes, responsive design

## Execution Protocol

### Phase 1: Path Resolution & Context Loading (Enhanced)
```bash
# Determine base path
IF --base-path provided:
    base_path = {provided_base_path}  # e.g., ".workflow/WFS-xxx/runs/run-xxx/.design"
ELSE IF --session provided:
    session_id = {provided_session}
    base_path = ".workflow/WFS-{session_id}/latest/.design"  # Use latest run
ELSE:
    # Standalone mode: search for most recent design-session in scratchpad
    base_path = find_latest_design_session(".workflow/.scratchpad/")

# Determine style and layout variant counts
style_variants = --style-variants OR 3  # Default to 3
layout_variants = --layout-variants OR 3  # Default to 3

VALIDATE: 1 <= style_variants <= 5
VALIDATE: 1 <= layout_variants <= 5

# Enhanced page list parsing
page_list = []
page_source = "none"

# Priority 1: Explicit --pages parameter (with robust parsing)
IF --pages provided:
    # Enhanced parsing: handle spaces, multiple delimiters
    raw_pages = {--pages value}

    # Split by comma, semicolon, or Chinese comma, then clean
    page_list = split_and_clean(raw_pages, delimiters=[",", ";", "、"])

    # Clean each page name: strip whitespace, convert to lowercase
    page_list = [p.strip().lower().replace(" ", "-") for p in page_list if p.strip()]

    page_source = "explicit_parameter"
    REPORT: "📋 Using provided pages: {', '.join(page_list)}"

# Priority 2: Extract from synthesis-specification.md
ELSE IF --session:
    # Read synthesis-specification.md to extract page requirements
    synthesis_spec = Read(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md)
    page_list = extract_pages_from_synthesis(synthesis_spec)
    page_source = "synthesis_specification"
    REPORT: "📋 Extracted pages from synthesis: {', '.join(page_list)}"

# Priority 3: Detect from existing prototypes
ELSE:
    # Infer from existing prototypes or default
    page_list = detect_from_prototypes({base_path}/prototypes/)
    IF page_list:
        page_source = "existing_prototypes"
        REPORT: "📋 Detected pages from existing prototypes: {', '.join(page_list)}"
    ELSE:
        page_list = ["home"]
        page_source = "default"
        REPORT: "⚠️ No pages found, using default: 'home'"

# Validation: ensure page names are valid
validated_pages = []
invalid_pages = []
FOR page IN page_list:
    # Validate format: must start with letter/number, can contain alphanumeric, hyphens, underscores
    IF regex_match(page, r"^[a-z0-9][a-z0-9_-]*$"):
        validated_pages.append(page)
    ELSE:
        invalid_pages.append(page)

IF invalid_pages:
    REPORT: "⚠️ Skipped invalid page names: {', '.join(invalid_pages)}"
    REPORT: "   Valid format: lowercase, alphanumeric, hyphens, underscores"

VALIDATE: validated_pages not empty, "No valid pages found"

# Use validated list
page_list = validated_pages
REPORT: "✅ Final page list ({len(page_list)}): {', '.join(page_list)}"

# Verify design systems exist for all styles
FOR style_id IN range(1, style_variants + 1):
    VERIFY: {base_path}/style-consolidation/style-{style_id}/design-tokens.json exists
    VERIFY: {base_path}/style-consolidation/style-{style_id}/style-guide.md exists

# Load requirements (if integrated mode)
IF --session:
    synthesis_spec = Read(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md)
```

### Phase 2: Optimized Matrix UI Generation (Layered, Template-Based)

**Strategy**: Decouple HTML structure from CSS styling to eliminate redundancy.
- **Layer 1**: Generate `L × P` layout templates (HTML structure + structural CSS)
- **Layer 2**: Instantiate `S × L × P` final prototypes via fast file operations

**Performance**: Reduces core generation tasks from `O(S×L×P)` to `O(L×P)` — **`S` times faster**

---

#### Phase 2a: Layout Template Generation (Parallel Agent Execution)

Generate style-agnostic layout templates for each `{page} × {layout}` combination.
Total agent tasks: `layout_variants × len(page_list)`

```bash
# Create template directory
CREATE: {base_path}/prototypes/_templates/
CREATE: {base_path}/prototypes/

# Launch layout_variants × page_list parallel tasks
FOR layout_id IN range(1, layout_variants + 1):
    FOR page IN page_list:
        Task(conceptual-planning-agent): "
          [UI_LAYOUT_TEMPLATE_GENERATION]

          Generate a **style-agnostic** layout template for a specific page and layout strategy.

          ## Context
          LAYOUT_ID: {layout_id}
          PAGE: {page}
          BASE_PATH: {base_path}
          {IF --session: - Requirements: .workflow/WFS-{session}/.brainstorming/synthesis-specification.md}

          ## Task
          Generate TWO files that work together as a reusable template:

          **File 1**: `{page}-layout-{layout_id}.html`
          - Semantic HTML5 structure WITHOUT any style-specific values
          - Use placeholder links for stylesheets:
            ```html
            <link rel=\"stylesheet\" href=\"{{STRUCTURAL_CSS}}\">
            <link rel=\"stylesheet\" href=\"{{TOKEN_CSS}}\">
            ```
          - Include all semantic elements, ARIA attributes, and responsive structure
          - NO inline styles, NO hardcoded colors/fonts/spacing

          **File 2**: `{page}-layout-{layout_id}.css`
          - Structural CSS rules using CSS variable references
          - ALL values MUST use `var()` functions (e.g., `background-color: var(--color-surface-background);`)
          - NO hardcoded values (e.g., #4F46E5, 16px, Arial)
          - BEM or semantic class naming
          - Mobile-first responsive design using token-based breakpoints

          ## Layout Diversity Strategy
          You are responsible for Layout {layout_id}. Apply this strategy CONSISTENTLY to all styles in your batch.

          {IF layout_id == 1}
          **Layout 1: Classic Hierarchy**
          - Traditional F-pattern reading flow
          - Top navigation with sidebar
          - Card-based content sections
          {ELSE IF layout_id == 2}
          **Layout 2: Modern Asymmetric**
          - Z-pattern visual flow
          - Split-screen hero sections
          - Grid-based modular content
          {ELSE IF layout_id == 3}
          **Layout 3: Minimal Focus**
          - Centered single-column content
          - Floating navigation
          - Generous whitespace and breathing room
          {ELSE}
          **Layout {layout_id}: Custom Variant**
          - Develop a unique and consistent layout structure different from the standard three
          {ENDIF}

          Adapt this strategy to each page's purpose while maintaining layout consistency.

          ## Token Usage Requirements (STRICT)
          - For each style, load design tokens from its specific file: {base_path}/style-consolidation/style-{style_id}/design-tokens.json
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
          - Link to design-tokens.css: <link rel=\"stylesheet\" href=\"../../design-tokens.css\">
          - Use CSS custom properties from design-tokens.json
          - Mobile-first media queries using token breakpoints
          - No inline styles
          - BEM or semantic class naming

          ## Responsive Design
          - Mobile: 375px+ (single column, stacked)
          - Tablet: var(--breakpoint-md) (adapted layout)
          - Desktop: var(--breakpoint-lg)+ (full layout)

          ## Output Location
          {base_path}/prototypes/_templates/

          ## Deliverables
          TWO template files for the '{page}-layout-{layout_id}' combination:
          1. `{page}-layout-{layout_id}.html` - Reusable HTML structure with CSS placeholders
          2. `{page}-layout-{layout_id}.css` - Structural CSS using var() for all values

          IMPORTANT: These templates will be reused across ALL styles, so they must be
          completely style-agnostic (no hardcoded colors, fonts, or spacing).
        "

# Wait for all {layout_variants × len(page_list)} parallel tasks to complete
# Generated templates: L × P (significantly fewer than the old S × L × P approach)
REPORT: "✅ Phase 2a complete: Generated {layout_variants * len(page_list)} layout templates"
```

---

#### Phase 2b: Prototype Instantiation (Fast File Operations)

Create final `S × L × P` prototypes by copying templates and injecting style-specific CSS links.
This phase uses **fast file operations** instead of expensive Agent calls.

```bash
REPORT: "🚀 Phase 2b: Instantiating prototypes from templates..."

# Ensure design tokens are converted to CSS for each style
FOR style_id IN range(1, style_variants + 1):
    tokens_json = Read({base_path}/style-consolidation/style-{style_id}/design-tokens.json)
    tokens_css = convert_json_to_css_variables(tokens_json)

    # Write tokens.css for this style
    Write({base_path}/style-consolidation/style-{style_id}/tokens.css, tokens_css)

# Instantiate S × L × P final prototypes via file copying and placeholder replacement
Bash(
  cd {base_path}/prototypes/

  # For each style, layout, and page combination...
  for s in $(seq 1 {style_variants}); do
    for l in $(seq 1 {layout_variants}); do
      for p in {' '.join(page_list)}; do

        # Define file names
        TEMPLATE_HTML="_templates/${p}-layout-${l}.html"
        STRUCTURAL_CSS="./_templates/${p}-layout-${l}.css"
        TOKEN_CSS="../../style-consolidation/style-${s}/tokens.css"
        OUTPUT_HTML="${p}-style-${s}-layout-${l}.html"

        # 1. Copy the HTML template
        cp "${TEMPLATE_HTML}" "${OUTPUT_HTML}"

        # 2. Replace CSS placeholders with actual paths
        # Using | delimiter for sed to handle paths with slashes
        sed -i "s|{{STRUCTURAL_CSS}}|${STRUCTURAL_CSS}|g" "${OUTPUT_HTML}"
        sed -i "s|{{TOKEN_CSS}}|${TOKEN_CSS}|g" "${OUTPUT_HTML}"

        # 3. Create implementation notes file
        cat > "${p}-style-${s}-layout-${l}-notes.md" <<EOF
# Implementation Notes: ${p}-style-${s}-layout-${l}

## Generation Details
- **Template**: ${TEMPLATE_HTML}
- **Structural CSS**: ${STRUCTURAL_CSS}
- **Style Tokens**: ${TOKEN_CSS}
- **Layout Strategy**: Layout ${l}
- **Style Variant**: Style ${s}

## Template Reuse
This prototype was generated from a shared layout template to ensure consistency
across all style variants. The HTML structure is identical for all ${p}-layout-${l}
prototypes, with only the design tokens (colors, fonts, spacing) varying.

## Design System Reference
Refer to \`../../style-consolidation/style-${s}/style-guide.md\` for:
- Design philosophy
- Token usage guidelines
- Component patterns
- Accessibility requirements

## Customization
To modify this prototype:
1. Edit the layout template: \`${TEMPLATE_HTML}\` (affects all styles)
2. Edit the structural CSS: \`${STRUCTURAL_CSS}\` (affects all styles)
3. Edit design tokens: \`${TOKEN_CSS}\` (affects only this style variant)

EOF
      done
    done
  done
)

REPORT: "✅ Phase 2b complete: Instantiated {style_variants * layout_variants * len(page_list)} final prototypes"
REPORT: "   Performance: {style_variants}× faster than original approach"
```

**Performance Comparison**:

| Metric | Before (S×L×P Agent calls) | After (L×P Agent calls + File Ops) |
|--------|----------------------------|-----------------------------------|
| Agent Tasks | `S × L × P` | `L × P` |
| Example (3×3×3) | 27 Agent calls | 9 Agent calls |
| Speed Improvement | Baseline | **3× faster** (S times) |
| Resource Usage | High (creative generation for each combo) | Optimized (creative only for templates) |
```

### Phase 3: Generate Preview Files

```bash
# Read matrix visualization template
template_content = Read("~/.claude/workflows/_template-compare-matrix.html")

# Prepare template variables
pages_json = JSON.stringify(page_list)
run_id = extract_run_id_from_base_path({base_path})

# Inject variables into template
injected_content = template_content
    .replace("{{run_id}}", run_id)
    .replace("{{style_variants}}", style_variants)
    .replace("{{layout_variants}}", layout_variants)
    .replace("{{pages_json}}", pages_json)

# Write interactive matrix comparison
Write({base_path}/prototypes/compare.html, injected_content)

# Generate design-tokens.css (unified CSS custom properties for all styles)
Write({base_path}/prototypes/design-tokens.css):
/* Auto-generated from all style design systems */
/* Note: Each prototype links to its specific style's tokens */

:root {
  /* Fallback tokens - each HTML file should link to its style-specific tokens */
  /* See style-consolidation/style-{n}/design-tokens.json for actual values */
}

# Generate simple index.html for quick navigation
Write({base_path}/prototypes/index.html):
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UI Prototypes - Matrix View</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      max-width: 800px;
      margin: 2rem auto;
      padding: 0 1rem;
    }
    h1 { color: #2563eb; }
    .info {
      background: #f3f4f6;
      padding: 1rem;
      border-radius: 0.5rem;
      margin: 1rem 0;
    }
    .cta {
      display: inline-block;
      background: #2563eb;
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      text-decoration: none;
      font-weight: 600;
      margin-top: 1rem;
    }
    .cta:hover { background: #1d4ed8; }
    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin: 1.5rem 0;
    }
    .stat {
      background: white;
      border: 1px solid #e5e7eb;
      padding: 1rem;
      border-radius: 0.5rem;
      text-align: center;
    }
    .stat-value {
      font-size: 2rem;
      font-weight: bold;
      color: #2563eb;
    }
    .stat-label {
      color: #6b7280;
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }
  </style>
</head>
<body>
  <h1>🎨 UI Prototype Matrix</h1>

  <div class="info">
    <p><strong>Matrix Configuration:</strong> {style_variants} styles × {layout_variants} layouts × {len(page_list)} pages</p>
    <p><strong>Total Prototypes:</strong> {style_variants * layout_variants * len(page_list)}</p>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-value">{style_variants}</div>
      <div class="stat-label">Style Variants</div>
    </div>
    <div class="stat">
      <div class="stat-value">{layout_variants}</div>
      <div class="stat-label">Layout Options</div>
    </div>
    <div class="stat">
      <div class="stat-value">{len(page_list)}</div>
      <div class="stat-label">Pages</div>
    </div>
  </div>

  <a href="compare.html" class="cta">🔍 Open Interactive Matrix Comparison →</a>

  <h2>Features</h2>
  <ul>
    <li>3×3 matrix grid view with synchronized scrolling</li>
    <li>Zoom controls (25%, 50%, 75%, 100%)</li>
    <li>Fullscreen mode for individual prototypes</li>
    <li>Selection system with export functionality</li>
    <li>Page switcher for multi-page comparison</li>
  </ul>

  <h2>Generated Pages</h2>
  <ul>
    {FOR page IN page_list:
      <li><strong>{page}</strong>: {style_variants × layout_variants} variants</li>
    }
  </ul>
</body>
</html>

# Generate PREVIEW.md with instructions
Write({base_path}/prototypes/PREVIEW.md):
# UI Prototype Preview Guide

## Quick Start
1. Open `compare.html` in a modern browser
2. Use the page selector to switch between pages
3. Interact with prototypes in the 3×3 matrix

## Matrix Configuration
- **Style Variants:** {style_variants}
- **Layout Options:** {layout_variants}
- **Pages:** {page_list}
- **Total Prototypes:** {style_variants * layout_variants * len(page_list)}

## File Naming Convention
`{page}-style-{s}-layout-{l}.html`

Example: `dashboard-style-1-layout-2.html`
- Page: dashboard
- Style: Design system 1
- Layout: Layout variant 2

## Interactive Features
- **Synchronized Scroll:** All prototypes scroll together
- **Zoom Controls:** Adjust viewport scale (25%-100%)
- **Fullscreen:** Click any prototype for detailed view
- **Selection:** Mark favorites for implementation
- **Export:** Save selections as JSON

## Design System References
Each prototype uses tokens from:
`../style-consolidation/style-{s}/design-tokens.json`

Refer to corresponding `style-guide.md` for design philosophy and usage guidelines.

## Next Steps
1. Review all variants in compare.html
2. Select preferred style×layout combinations
3. Export selections for implementation planning
4. Run `/workflow:ui-design:update` to integrate chosen designs
```

### Phase 3.5: Cross-Page Consistency Validation (Optional, Multi-Page Only)
**Condition**: Only executes if `len(page_list) > 1`

```bash
# Skip if only one page
IF len(page_list) <= 1:
    SKIP to Phase 4

# For multi-page workflows, validate cross-page consistency
FOR style_id IN range(1, style_variants + 1):
    FOR layout_id IN range(1, layout_variants + 1):
        # Generate consistency report for this style-layout combo across all pages
        Task(conceptual-planning-agent): "
          [CROSS_PAGE_CONSISTENCY_VALIDATION]

          Validate design consistency across multiple pages for Style-{style_id} Layout-{layout_id}

          ## Context
          STYLE_ID: {style_id}
          LAYOUT_ID: {layout_id}
          PAGES: {page_list}
          BASE_PATH: {base_path}

          ## Input Files
          FOR each page IN {page_list}:
              - {base_path}/prototypes/{page}-style-{style_id}-layout-{layout_id}.html
              - {base_path}/prototypes/{page}-style-{style_id}-layout-{layout_id}.css

          ## Validation Tasks
          1. **Shared Component Consistency**:
             - Check if header/navigation structure is identical across all pages
             - Verify footer content and styling matches
             - Confirm common UI elements (buttons, forms, cards) use same classes/styles

          2. **Token Usage Consistency**:
             - Verify all pages reference the same design-tokens file
             - Confirm CSS variable usage is consistent (no hardcoded values)
             - Check spacing, typography, and color token application

          3. **Accessibility Consistency**:
             - Validate ARIA attributes are used consistently
             - Check heading hierarchy (h1 unique per page, h2-h6 consistent)
             - Verify landmark roles are consistent

          4. **Layout Strategy Adherence**:
             - Confirm Layout-{layout_id} strategy is applied consistently to all pages
             - Check responsive breakpoints are identical
             - Verify grid/flex systems match across pages

          ## Output Format
          Generate a consistency report: {base_path}/prototypes/consistency-report-s{style_id}-l{layout_id}.md

          ```markdown
          # Cross-Page Consistency Report
          **Style**: {style_id} | **Layout**: {layout_id} | **Pages**: {', '.join(page_list)}

          ## ✅ Passed Checks
          - [List consistency checks that passed]

          ## ⚠️ Warnings
          - [List minor inconsistencies that should be reviewed]

          ## ❌ Issues
          - [List critical inconsistencies that must be fixed]

          ## Recommendations
          - [Suggestions for improving consistency]
          ```

          ## Severity Levels
          - **Critical**: Shared components have different structure/styling
          - **Warning**: Minor variations in spacing or naming
          - **Info**: Intentional page-specific adaptations

          IMPORTANT: Focus on truly shared elements (header, nav, footer). Page-specific content variations are expected and acceptable.
        "

# Aggregate all consistency reports
Write({base_path}/prototypes/CONSISTENCY_SUMMARY.md):
# Multi-Page Consistency Summary

This report summarizes consistency validation across all {len(page_list)} pages.

## Validated Combinations
- **Style Variants**: {style_variants}
- **Layout Variants**: {layout_variants}
- **Total Reports**: {style_variants * layout_variants}

## Report Files
{FOR s IN range(1, style_variants + 1):
  {FOR l IN range(1, layout_variants + 1):
    - [Style {s} Layout {l}](./consistency-report-s{s}-l{l}.md)
  }
}

## Quick Actions
1. Review all consistency reports
2. Fix critical issues before proceeding to implementation
3. Document intentional page-specific variations

Run `/workflow:ui-design:update` once all issues are resolved.
```

### Phase 4: TodoWrite & Completion

```javascript
TodoWrite({
  todos: [
    {content: "Resolve paths and load design systems", status: "completed", activeForm: "Loading design systems"},
    {content: `Generate ${layout_variants}×${page_list.length} layout templates (optimized)`, status: "completed", activeForm: "Generating layout templates"},
    {content: `Instantiate ${style_variants}×${layout_variants}×${page_list.length} final prototypes`, status: "completed", activeForm: "Instantiating prototypes"},
    {content: "Generate interactive preview files", status: "completed", activeForm: "Generating preview"}
  ]
});
```

**Completion Message**:
```
✅ Optimized Matrix UI generation complete!

Configuration:
- Style Variants: {style_variants}
- Layout Variants: {layout_variants}
- Pages: {page_list}
- Total Prototypes: {style_variants * layout_variants * len(page_list)}

Performance Metrics:
- Layout Templates Generated: {layout_variants * len(page_list)} (Agent tasks)
- Prototypes Instantiated: {style_variants * layout_variants * len(page_list)} (file operations)
- Speed Improvement: {style_variants}× faster than previous approach
- Resource Efficiency: {100 * (1 - 1/style_variants)}% reduction in Agent calls

Generated Structure:
📂 {base_path}/prototypes/
├── _templates/
│   ├── {page}-layout-{1..L}.html ({layout_variants * len(page_list)} templates)
│   └── {page}-layout-{1..L}.css ({layout_variants * len(page_list)} structural CSS)
├── {page}-style-{s}-layout-{l}.html ({style_variants * layout_variants * len(page_list)} final prototypes)
├── {page}-style-{s}-layout-{l}-notes.md
├── compare.html (interactive matrix visualization)
└── index.html (quick navigation)

🌐 Interactive Preview:
1. Matrix View: Open compare.html (recommended)
2. Quick Index: Open index.html
3. Instructions: See PREVIEW.md

Features:
- 3×3 matrix grid with synchronized scrolling
- Zoom controls and fullscreen mode
- Selection export for implementation
- Per-page comparison
- Template-based consistency across style variants

Technical Highlights:
- ✅ Decoupled HTML structure from CSS styling
- ✅ Reusable layout templates (affects all styles uniformly)
- ✅ Dynamic style injection via CSS custom properties
- ✅ Significantly reduced generation time

Next: /workflow:ui-design:update {--session flag if applicable}

Note: When called from /workflow:ui-design:auto, design-update is triggered automatically.
```

## Output Structure (Optimized, Template-Based)

```
{base_path}/prototypes/
├── _templates/                            # Reusable layout templates (NEW)
│   ├── {page}-layout-1.html              # Style-agnostic HTML structure
│   ├── {page}-layout-1.css               # Structural CSS with var() references
│   ├── {page}-layout-2.html
│   ├── {page}-layout-2.css
│   └── ... (L × P templates total)
├── compare.html                           # Interactive matrix visualization
├── index.html                             # Simple navigation page
├── PREVIEW.md                             # Preview instructions
├── design-tokens.css                      # CSS custom properties fallback
├── {page}-style-{s}-layout-{l}.html      # Final prototypes (copied from templates)
├── {page}-style-{s}-layout-{l}-notes.md  # Implementation notes (auto-generated)
└── ... (S × L × P total final files)

{base_path}/style-consolidation/
├── style-1/
│   ├── design-tokens.json
│   ├── tokens.css                         # NEW: CSS variables for style-1
│   └── style-guide.md
├── style-2/
│   ├── design-tokens.json
│   ├── tokens.css                         # NEW: CSS variables for style-2
│   └── style-guide.md
└── ...
```

## Error Handling
- **No design systems found**: Run `/workflow:ui-design:consolidate --keep-separate` first
- **Invalid page names**: Extract from synthesis-specification.md or error
- **Agent execution errors**: Report details, suggest retry
- **Missing template**: Provide fallback or error with template path

## Quality Checks
After generation, ensure:
- [ ] All CSS values reference design token custom properties
- [ ] No hardcoded colors, spacing, or typography
- [ ] Semantic HTML structure
- [ ] ARIA attributes present
- [ ] Responsive design implemented
- [ ] Mobile-first approach
- [ ] File naming follows `{page}-style-{s}-layout-{l}` convention
- [ ] compare.html loads correctly with all prototypes

## Key Features

1. **Optimized Template-Based Architecture** (NEW)
   - Decouples HTML structure from CSS styling
   - Generates `L × P` reusable templates instead of `S × L × P` unique files
   - **`S` times faster** than previous approach (typically 3× faster)

2. **Two-Layer Generation Strategy**
   - **Layer 1**: Agent-driven creative generation of layout templates
   - **Layer 2**: Fast file operations for prototype instantiation
   - Reduces expensive Agent calls by ~67% (for S=3)

3. **Consistent Cross-Style Layouts**
   - Same layout structure applied uniformly across all style variants
   - Easier to compare styles directly (HTML structure is identical)
   - Simplified maintenance (edit template once, affects all styles)

4. **Dynamic Style Injection**
   - CSS custom properties enable runtime style switching
   - Each style variant has its own `tokens.css` file
   - Clean separation of structure and aesthetics

5. **Interactive Visualization**
   - Full-featured compare.html from template
   - Matrix grid view with synchronized scrolling
   - Per-style design system references

6. **Production-Ready Output**
   - Semantic HTML5 and ARIA attributes
   - Mobile-first responsive design
   - Token-driven styling (no hardcoded values)

## Integration Points
- **Input**: Per-style design-tokens.json from `/workflow:ui-design:consolidate --keep-separate`
- **Output**: Matrix HTML/CSS prototypes for `/workflow:ui-design:update`
- **Template**: `~/.claude/workflows/_template-compare-matrix.html` (global)
- **Context**: synthesis-specification.md for page requirements (optional)
