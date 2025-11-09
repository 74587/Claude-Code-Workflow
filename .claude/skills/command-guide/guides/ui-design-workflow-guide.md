# UI Design Workflow Guide

## Overview

The UI Design Workflow System is a comprehensive suite of 11 autonomous commands designed to transform intent (prompts), references (images/URLs), or existing code into functional, production-ready UI prototypes. It employs a **Separation of Concerns** architecture, treating Style (visual tokens), Structure (layout templates), and Motion (animation tokens) as independent, mix-and-match components.

## Command Taxonomy

### 1. Orchestrators (High-Level Workflows)

These commands automate end-to-end processes by chaining specialized sub-commands.

- **`/workflow:ui-design:explore-auto`**: For creating *new* designs. Generates multiple style and layout variants from a prompt to explore design directions.
- **`/workflow:ui-design:imitate-auto`**: For *replicating* existing designs. High-fidelity cloning of target URLs into a reusable design system.
- **`/workflow:ui-design:batch-generate`**: For rapid, high-volume prototype generation based on established design tokens.

### 2. Core Extractors (Specialized Analysis)

Agents dedicated to analyzing specific aspects of design.

- **`/workflow:ui-design:style-extract`**: Extracts visual tokens (colors, typography, spacing, shadows) into `design-tokens.json`.
- **`/workflow:ui-design:layout-extract`**: Extracts DOM structure and CSS layout rules into `layout-templates.json`.
- **`/workflow:ui-design:animation-extract`**: Extracts motion patterns into `animation-tokens.json`.

### 3. Input & Capture Utilities

Tools for gathering raw data for analysis.

- **`/workflow:ui-design:capture`**: High-speed batch screenshot capture for multiple URLs.
- **`/workflow:ui-design:explore-layers`**: Interactive, depth-controlled capture (e.g., capturing modals, dropdowns, shadow DOM).
- **`/workflow:ui-design:import-from-code`**: Bootstraps a design system by analyzing existing CSS/JS/HTML files.

### 4. Assemblers & Integrators

Tools for combining components and integrating results.

- **`/workflow:ui-design:generate`**: Pure assembler that combines Layout Templates + Design Tokens into HTML/CSS prototypes.
- **`/workflow:ui-design:update`**: Synchronizes generated design artifacts with the main project session for implementation planning.

---

## Common Workflow Patterns

### Workflow A: Exploratory Design (New Concepts)

**Goal:** Create multiple design options for a new project from a text description.

**Primary Command:** `explore-auto`

**Steps:**

1. **Initiate**: User runs `/workflow:ui-design:explore-auto --prompt "Modern fintech dashboard" --style-variants 3`
2. **Style Extraction**: System generates 3 distinct visual design systems based on the prompt.
3. **Layout Extraction**: System researches and generates responsive layout templates for a dashboard.
4. **Assembly**: System generates a matrix of prototypes (3 styles × 1 layout = 3 prototypes).
5. **Review**: User views `compare.html` to select the best direction.

**Example (Non-Interactive - Default):**

```bash
/workflow:ui-design:explore-auto \
  --prompt "Modern SaaS landing page with hero, features, pricing sections" \
  --style-variants 3 \
  --layout-variants 2 \
  --session WFS-001
```

**Output:**
- `design-tokens-v1.json`, `design-tokens-v2.json`, `design-tokens-v3.json` (3 style variants)
- `layout-templates-v1.json`, `layout-templates-v2.json` (2 layout variants)
- 6 HTML prototypes (3 × 2 combinations)
- `compare.html` for side-by-side comparison

**Example (Interactive Mode):**

```bash
/workflow:ui-design:explore-auto \
  --prompt "Modern SaaS landing page with hero, features, pricing sections" \
  --style-variants 5 \
  --layout-variants 4 \
  --interactive \
  --session WFS-001
```

**Interactive Flow:**
1. System generates 5 style concepts
2. **User selects** 2-3 preferred styles (multi-select)
3. System generates 4 layout concepts
4. **User selects** 2 preferred layouts (multi-select)
5. System generates only 4-6 final prototypes (selected combinations)

**Benefits:**
- Reduces unnecessary generation (from 20 to 4-6 prototypes)
- Focuses resources on preferred design directions
- Saves 70-80% computation time
- Better exploration quality

---

### Workflow B: Design Replication (Imitation)

**Goal:** Create a design system and prototypes based on existing reference sites.

**Primary Command:** `imitate-auto`

**Steps:**

1. **Initiate**: User runs `/workflow:ui-design:imitate-auto --url-map "home:https://example.com, pricing:https://example.com/pricing"`
2. **Capture**: System screenshots all provided URLs.
3. **Extraction**: System extracts a unified design system (style, layout, animation) from the primary URL.
4. **Assembly**: System recreates all target pages using the extracted system.

**Example:**

```bash
/workflow:ui-design:imitate-auto \
  --url-map "landing:https://stripe.com, pricing:https://stripe.com/pricing, docs:https://stripe.com/docs" \
  --capture-mode batch \
  --session WFS-002
```

**Output:**
- Screenshots of all URLs
- `design-tokens.json` (unified style system)
- `layout-templates.json` (page structures)
- 3 HTML prototypes matching the captured pages

---

### Workflow C: Code-First Bootstrap

**Goal:** Create a design system from an existing codebase.

**Primary Command:** `import-from-code`

**Steps:**

1. **Initiate**: User runs `/workflow:ui-design:import-from-code --base-path ./src`
2. **Analysis**: Parallel agents analyze CSS, JS, and HTML to find tokens, layouts, and animations.
3. **Reporting**: Generates completeness reports and initial token files.
4. **Supplement (Optional)**: Run `style-extract` or `layout-extract` to fill gaps identified in the reports.

**Example:**

```bash
/workflow:ui-design:import-from-code \
  --base-path ./src/components \
  --session WFS-003
```

**Output:**
- `design-tokens.json` (extracted from CSS variables, theme files)
- `layout-templates.json` (extracted from component structures)
- `completeness-report.md` (gaps and recommendations)
- `import-summary.json` (statistics and findings)

---

### Workflow D: Batch Generation (High Volume)

**Goal:** Generate multiple UI prototypes based on established design tokens.

**Primary Command:** `batch-generate`

**Steps:**

1. **Prerequisites**: Have `design-tokens.json` ready (from previous extraction or manual creation)
2. **Initiate**: User runs `/workflow:ui-design:batch-generate --targets "dashboard,settings,profile" --style-variants 2`
3. **Parallel Generation**: System generates all targets in parallel, applying style variants
4. **Review**: User reviews generated prototypes

**Example:**

```bash
/workflow:ui-design:batch-generate \
  --targets "login-page,dashboard,settings,profile,notifications" \
  --target-type page \
  --style-variants 2 \
  --device-type responsive \
  --session WFS-004
```

**Output:**
- 10 HTML prototypes (5 targets × 2 styles)
- All using the same design system for consistency

---

## Architecture & Best Practices

### Separation of Concerns

**Always keep design tokens separate from layout templates:**

- `design-tokens.json` (Style) - Colors, typography, spacing, shadows
- `layout-templates.json` (Structure) - DOM hierarchy, CSS layout rules
- `animation-tokens.json` (Motion) - Transitions, keyframes, timing functions

**Benefits:**
- Instant re-theming by swapping design tokens
- Layout reuse across different visual styles
- Independent evolution of style and structure

### Token-First CSS

Generated CSS should primarily use CSS custom properties:

```css
/* Good - Token-based */
.button {
  background: var(--color-primary);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
}

/* Avoid - Hardcoded */
.button {
  background: #3b82f6;
  padding: 16px;
  border-radius: 8px;
}
```

### Style-Centric Batching

For high-volume generation:
- Group tasks by style to minimize context switching
- Use `batch-generate` with multiple targets
- Reuse existing layout inspirations

### Input Quality Guidelines

**For Prompts:**
- Specify the desired *vibe* (e.g., "minimalist, high-contrast")
- Specify the *targets* (e.g., "dashboard, settings page")
- Include functional requirements (e.g., "responsive, mobile-first")

**For URL Mapping:**
- First URL is treated as primary source of truth
- Use descriptive keys in `--url-map`
- Ensure URLs are accessible (no authentication walls)

---

## Advanced Usage

### Multi-Session Workflows

You can run UI design workflows within an existing workflow session:

```bash
# 1. Start a workflow session
/workflow:session:start --new

# 2. Run exploratory design
/workflow:ui-design:explore-auto --prompt "E-commerce checkout flow" --session <session-id>

# 3. Update main session with design artifacts
/workflow:ui-design:update --session <session-id> --selected-prototypes "v1,v2"
```

### Combining Workflows

**Example: Imitation + Custom Variants**

```bash
# 1. Replicate existing design
/workflow:ui-design:imitate-auto --url-map "ref:https://example.com"

# 2. Generate additional variants with batch-generate
/workflow:ui-design:batch-generate --targets "new-page-1,new-page-2" --style-variants 1
```

### Deep Interactive Capture

For complex UIs with overlays, modals, or dynamic content:

```bash
/workflow:ui-design:explore-layers \
  --url https://complex-app.com \
  --depth 3 \
  --session WFS-005
```

---

## Troubleshooting

| Issue | Likely Cause | Resolution |
|-------|--------------|------------|
| **Missing Design Tokens** | `style-extract` failed or wasn't run | Run `/workflow:ui-design:style-extract` manually or check logs |
| **Inaccurate Layouts** | Complex DOM structure not captured | Use `--urls` in `layout-extract` for Chrome DevTools analysis |
| **Empty Screenshots** | Anti-bot measures or timeout | Use `explore-layers` interactive mode or increase timeout |
| **Generation Stalls** | Too many concurrent tasks | System defaults to max 6 parallel tasks; check resources |
| **Integration Failures** | Session ID mismatch or missing markers | Ensure `--session <id>` matches active workflow session |
| **Low Quality Tokens** | Insufficient reference material | Provide multiple reference images/URLs for better token extraction |
| **Inconsistent Styles** | Multiple token files without merge | Use single unified `design-tokens.json` or explicit variants |

---

## Command Reference Quick Links

### Orchestrators
- `/workflow:ui-design:explore-auto` - Create new designs from prompts
- `/workflow:ui-design:imitate-auto` - Replicate existing designs
- `/workflow:ui-design:batch-generate` - High-volume prototype generation

### Extractors
- `/workflow:ui-design:style-extract` - Extract visual design tokens
- `/workflow:ui-design:layout-extract` - Extract layout structures
- `/workflow:ui-design:animation-extract` - Extract motion patterns

### Utilities
- `/workflow:ui-design:capture` - Batch screenshot capture
- `/workflow:ui-design:explore-layers` - Interactive deep capture
- `/workflow:ui-design:import-from-code` - Bootstrap from existing code
- `/workflow:ui-design:generate` - Assemble prototypes from tokens
- `/workflow:ui-design:update` - Integrate with workflow sessions

---

## Performance Optimization

### Parallel Execution

The system is designed to run extraction phases in parallel:
- Animation and layout extraction can run concurrently
- Multiple target generation runs in parallel (default: max 6)
- Style variant generation is parallelized

### Reuse Intermediates

- `batch-generate` reuses existing layout inspirations
- Cached screenshots avoid redundant captures
- Token files can be versioned and reused

### Resource Management

- Each agent task consumes memory and CPU
- Monitor system resources with large batch operations
- Consider splitting large batches into smaller chunks

---

## Related Guides

- **Getting Started** - Basic workflow concepts
- **Workflow Patterns** - General workflow guidance
- **CLI Tools Guide** - CLI integration strategies
- **Troubleshooting** - Common issues and solutions
