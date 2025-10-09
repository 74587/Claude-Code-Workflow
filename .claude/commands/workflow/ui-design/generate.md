---
name: generate
description: Generate UI prototypes in matrix mode (style × layout combinations) for pages or components
usage: /workflow:ui-design:generate [--targets "<list>"] [--target-type "page|component"] [--base-path <path>] [--session <id>] [--style-variants <count>] [--layout-variants <count>]
argument-hint: "[--targets \"dashboard,auth,navbar,hero\"] [--target-type \"page\"] [--base-path \".workflow/WFS-xxx/design-run-xxx\"] [--style-variants 3] [--layout-variants 3]"
examples:
  - /workflow:ui-design:generate --base-path ".workflow/WFS-auth/design-run-20250109-143022" --targets "dashboard,settings" --target-type "page" --style-variants 3 --layout-variants 3
  - /workflow:ui-design:generate --session WFS-auth --targets "home,pricing" --target-type "page" --style-variants 2 --layout-variants 2
  - /workflow:ui-design:generate --targets "navbar,hero,card" --target-type "component" --style-variants 3 --layout-variants 2
  - /workflow:ui-design:generate --base-path "./.workflow/.design/run-20250109-150533" --style-variants 3 --layout-variants 3
  - /workflow:ui-design:generate --pages "home,dashboard" --style-variants 2 --layout-variants 2  # Legacy syntax
executor: → @ui-design-agent
allowed-tools: TodoWrite(*), Read(*), Write(*), Task(ui-design-agent), Bash(*)
---

# UI Generation Command (Matrix Mode)

**Executor**: → @ui-design-agent
**Parallel Generation**: Phase 2a → @ui-design-agent (L×T tasks)

## Overview
Generate production-ready UI prototypes (HTML/CSS) in `style × layout` matrix mode, strictly adhering to consolidated design tokens from separate style design systems. Supports both full-page layouts and isolated component generation.

## Core Philosophy
- **Unified Generation**: Single mode generating `style_variants × layout_variants × targets` prototypes
- **Target Types**: Supports pages (full layouts) and components (isolated UI elements)
- **Agent-Driven**: Uses `Task(ui-design-agent)` for parallel generation
- **Token-Driven**: All styles reference per-style design-tokens.json; no hardcoded values
- **Production-Ready**: Semantic HTML5, ARIA attributes, responsive design
- **Template-Based**: Decouples HTML structure from CSS styling for optimal performance
- **Adaptive Wrapper**: Full-page structure for pages, minimal wrapper for components

## Execution Protocol

### Phase 0: Load Layout Strategies

```bash
# Determine base path first (using same logic as Phase 1)
IF --base-path provided:
    base_path = {provided_base_path}
ELSE IF --session provided:
    # Find latest design run in session
    base_path = find_latest_path_matching(".workflow/WFS-{session}/design-*")
ELSE:
    base_path = find_latest_path_matching(".workflow/.design/*")

# Load layout strategies from consolidation output
layout_strategies_path = "{base_path}/style-consolidation/layout-strategies.json"
VERIFY: exists(layout_strategies_path), "Layout strategies not found. Run /workflow:ui-design:consolidate first."

layout_strategies = Read(layout_strategies_path)
layout_variants = layout_strategies.layout_variants_count

REPORT: "📐 Loaded {layout_variants} layout strategies:"
FOR strategy IN layout_strategies.strategies:
    REPORT: "  - {strategy.name}: {strategy.description}"

# Override layout_variants if --layout-variants is provided (for manual runs)
IF --layout-variants provided:
    WARN: "Overriding layout strategies count from {layout_variants} to {provided_count}"
    layout_variants = {provided_count}
    VALIDATE: 1 <= layout_variants <= len(layout_strategies.strategies)
    # Trim strategies to match count
    layout_strategies.strategies = layout_strategies.strategies[0:layout_variants]
```

### Phase 1: Path Resolution & Context Loading

```bash
# 1. Determine base path
IF --base-path provided:
    base_path = {provided_base_path}
ELSE IF --session provided:
    # Find latest design run in session
    base_path = find_latest_path_matching(".workflow/WFS-{session}/design-*")
ELSE:
    base_path = find_latest_design_session(".workflow/.scratchpad/")

# 2. Determine style variant count (layout_variants already loaded in Phase 0)
style_variants = --style-variants OR 3  # Default to 3

VALIDATE: 1 <= style_variants <= 5

# Note: layout_variants is loaded from layout-strategies.json in Phase 0

# 3. Enhanced target list parsing with type detection
target_list = []
target_type = "page"  # Default to page for backward compatibility

# Priority 1: Unified --targets parameter
IF --targets provided:
    raw_targets = {--targets value}
    # Split by comma, semicolon, or Chinese comma
    target_list = split_and_clean(raw_targets, delimiters=[",", ";", "、"])
    # Clean: strip whitespace, lowercase, replace spaces with hyphens
    target_list = [t.strip().lower().replace(" ", "-") for t in target_list if t.strip()]

    # Get target type
    IF --target-type provided:
        target_type = {--target-type value}
    ELSE:
        # Auto-detect from target names (use same logic as explore-auto)
        target_type = detect_target_type(target_list)

    REPORT: "🎯 Using provided targets ({target_type}): {', '.join(target_list)}"

# Priority 2: Legacy --pages parameter (backward compatibility)
ELSE IF --pages provided:
    raw_targets = {--pages value}
    target_list = split_and_clean(raw_targets, delimiters=[",", ";", "、"])
    target_list = [t.strip().lower().replace(" ", "-") for t in target_list if t.strip()]
    target_type = "page"
    REPORT: "📋 Using provided pages (legacy): {', '.join(target_list)}"

# Priority 3: Extract from synthesis-specification.md
ELSE IF --session:
    synthesis_spec = Read(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md)
    target_list = extract_targets_from_synthesis(synthesis_spec)
    target_type = "page"  # Synthesis typically defines pages
    REPORT: "📋 Extracted from synthesis: {', '.join(target_list)}"

# Priority 4: Detect from existing prototypes or default
ELSE:
    target_list = detect_from_prototypes({base_path}/prototypes/) OR ["home"]
    target_type = "page"
    REPORT: "📋 Detected/default targets: {', '.join(target_list)}"

# 4. Validate target names
validated_targets = [t for t in target_list if regex_match(t, r"^[a-z0-9][a-z0-9_-]*$")]
invalid_targets = [t for t in target_list if t not in validated_targets]

IF invalid_targets:
    REPORT: "⚠️ Skipped invalid target names: {', '.join(invalid_targets)}"

VALIDATE: validated_targets not empty, "No valid targets found"
target_list = validated_targets

# Store for later use
STORE: target_list = target_list
STORE: target_type = target_type

# 5. Verify design systems exist
FOR style_id IN range(1, style_variants + 1):
    VERIFY: {base_path}/style-consolidation/style-{style_id}/design-tokens.json exists
    VERIFY: {base_path}/style-consolidation/style-{style_id}/style-guide.md exists

# 6. Load requirements (if integrated mode)
IF --session:
    synthesis_spec = Read(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md)
```

### Phase 1.5: Implementation Pattern Research (Exa MCP)

```bash
# Step 1: Extract project context and technology preferences
project_context = ""
tech_stack_hints = []

IF --session:
    # Load brainstorming artifacts to understand tech requirements
    IF exists(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md):
        project_context = Read(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md)
        tech_stack_hints = extract_tech_stack(project_context)  # e.g., "React", "Vue", "vanilla JS"

    IF exists(.workflow/WFS-{session}/.brainstorming/system-architect/analysis.md):
        arch_context = Read(.workflow/WFS-{session}/.brainstorming/system-architect/analysis.md)
        tech_stack_hints.extend(extract_tech_stack(arch_context))

# Step 2: Extract page types and requirements
page_types = classify_pages(page_list)  # e.g., "dashboard", "auth", "settings"
layout_names = [s.name for s in layout_strategies.strategies]

REPORT: "🔍 Researching modern UI implementation patterns..."

# Step 3: Multi-dimensional implementation research using Exa MCP
exa_queries = {
    "component_patterns": f"modern UI component implementation patterns {' '.join(tech_stack_hints)} 2024 2025",
    "responsive_design": f"responsive web design best practices mobile-first {' '.join(page_types)} 2024",
    "accessibility": f"web accessibility ARIA attributes implementation WCAG 2.2 {' '.join(page_types)}",
    "html_semantics": f"semantic HTML5 structure best practices {' '.join(page_types)} modern",
    "css_architecture": f"CSS architecture design tokens custom properties BEM {' '.join(tech_stack_hints)}"
}

implementation_research = {}
FOR category, query IN exa_queries.items():
    REPORT: f"   Searching {category}..."
    implementation_research[category] = mcp__exa__get_code_context_exa(
        query=query,
        tokensNum="dynamic"
    )

REPORT: "✅ Implementation research complete:"
REPORT: "   - Component patterns and best practices"
REPORT: "   - Responsive design strategies"
REPORT: "   - Accessibility implementation guides"
REPORT: "   - Semantic HTML structures"
REPORT: "   - CSS architecture patterns"
```

### Phase 1.8: Token Variable Name Extraction

```bash
# Load design-tokens.json from style-1 to extract exact variable names
# This ensures template generation uses correct token names
REPORT: "📋 Extracting design token variable names..."

tokens_json_path = "{base_path}/style-consolidation/style-1/design-tokens.json"
VERIFY: exists(tokens_json_path), "Design tokens not found. Run /workflow:ui-design:consolidate first."

design_tokens = Read(tokens_json_path)

# Extract all available token categories and variable names
token_reference = {
  "colors": {
    "brand": list(design_tokens.colors.brand.keys()),  # e.g., ["primary", "secondary", "accent"]
    "surface": list(design_tokens.colors.surface.keys()),  # e.g., ["background", "elevated", "overlay"]
    "semantic": list(design_tokens.colors.semantic.keys()),  # e.g., ["success", "warning", "error", "info"]
    "text": list(design_tokens.colors.text.keys()),  # e.g., ["primary", "secondary", "tertiary", "inverse"]
    "border": list(design_tokens.colors.border.keys())  # e.g., ["default", "strong", "subtle"]
  },
  "typography": {
    "font_family": list(design_tokens.typography.font_family.keys()),  # e.g., ["heading", "body", "mono"]
    "font_size": list(design_tokens.typography.font_size.keys()),  # e.g., ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl"]
    "font_weight": list(design_tokens.typography.font_weight.keys()),  # e.g., ["normal", "medium", "semibold", "bold"]
    "line_height": list(design_tokens.typography.line_height.keys()),  # e.g., ["tight", "normal", "relaxed"]
    "letter_spacing": list(design_tokens.typography.letter_spacing.keys())  # e.g., ["tight", "normal", "wide"]
  },
  "spacing": list(design_tokens.spacing.keys()),  # e.g., ["0", "1", "2", ..., "24"]
  "border_radius": list(design_tokens.border_radius.keys()),  # e.g., ["none", "sm", "md", "lg", "xl", "full"]
  "shadows": list(design_tokens.shadows.keys()),  # e.g., ["sm", "md", "lg", "xl"]
  "breakpoints": list(design_tokens.breakpoints.keys())  # e.g., ["sm", "md", "lg", "xl", "2xl"]
}

# Generate complete variable name lists for Agent prompt
color_vars = []
FOR category IN ["brand", "surface", "semantic", "text", "border"]:
    FOR key IN token_reference.colors[category]:
        color_vars.append(f"--color-{category}-{key}")

typography_vars = []
FOR category IN ["font_family", "font_size", "font_weight", "line_height", "letter_spacing"]:
    prefix = "--" + category.replace("_", "-")
    FOR key IN token_reference.typography[category]:
        typography_vars.append(f"{prefix}-{key}")

spacing_vars = [f"--spacing-{key}" for key in token_reference.spacing]
radius_vars = [f"--border-radius-{key}" for key in token_reference.border_radius]
shadow_vars = [f"--shadow-{key}" for key in token_reference.shadows]
breakpoint_vars = [f"--breakpoint-{key}" for key in token_reference.breakpoints]

all_token_vars = color_vars + typography_vars + spacing_vars + radius_vars + shadow_vars + breakpoint_vars

REPORT: f"✅ Extracted {len(all_token_vars)} design token variables from design-tokens.json"
REPORT: f"   - Color variables: {len(color_vars)}"
REPORT: f"   - Typography variables: {len(typography_vars)}"
REPORT: f"   - Spacing variables: {len(spacing_vars)}"
REPORT: f"   - Other variables: {len(radius_vars) + len(shadow_vars) + len(breakpoint_vars)}"
```

### Phase 2: Optimized Matrix UI Generation

**Strategy**: Two-layer generation reduces complexity from `O(S×L×P)` to `O(L×P)`, achieving **`S` times faster** performance.

- **Layer 1**: Generate `L × P` layout templates (HTML structure + structural CSS) with modern best practices
- **Layer 2**: Instantiate `S × L × P` final prototypes via fast file operations

#### Phase 2a: Layout Template Generation (Research-Informed)

**Parallel Executor**: → @ui-design-agent

Generate style-agnostic layout templates for each `{page} × {layout}` combination.
Total agent tasks: `layout_variants × len(page_list)`

```bash
# Create directories
CREATE: {base_path}/prototypes/_templates/
CREATE: {base_path}/prototypes/

# Launch parallel template generation tasks → @ui-design-agent
FOR layout_id IN range(1, layout_variants + 1):
    FOR target IN target_list:
        Task(ui-design-agent): "
          [UI_LAYOUT_TEMPLATE_GENERATION]

          🚨 **CRITICAL: TARGET INDEPENDENCE REQUIREMENT** 🚨
          You are generating a template for EXACTLY ONE target: '{target}'.
          - Do NOT include content from other targets in the workflow
          - This template is for '{target}' ONLY - treat it as a standalone UI entity
          - Even if '{target}' might coexist with other targets in a final application,
            your task is to create an INDEPENDENT, REUSABLE template for '{target}' alone

          Generate a **style-agnostic** layout template for a specific {target_type} and layout strategy, informed by modern web development best practices.

          🎯 **CRITICAL REQUIREMENTS**:
          ✅ **ADAPTIVE**: Multi-device responsive design (mobile, tablet, desktop)
          ✅ **STYLE-SWITCHABLE**: Support runtime theme/style switching via CSS variables
          ✅ **TOKEN-DRIVEN**: 100% CSS variable usage, zero hardcoded values
          ✅ **INDEPENDENT**: Template for '{target}' only, no other targets included

          ## Context
          LAYOUT_ID: {layout_id}
          TARGET: {target}
          TARGET_TYPE: {target_type}
          BASE_PATH: {base_path}
          {IF --session: - Requirements: .workflow/WFS-{session}/.brainstorming/synthesis-specification.md}

          **Target Type Details**:
          {IF target_type == "page":
            - Type: Full-page layout
            - Wrapper: Complete HTML document structure with <html>, <head>, <body>
            - Navigation: Include header/navigation elements
            - Footer: Include page footer
            - Content: Complete page content structure
          }
          {ELSE IF target_type == "component":
            - Type: Isolated UI component
            - Wrapper: Minimal container for component demonstration
            - Navigation: Exclude header/footer (component-only)
            - Container: Simple wrapper (e.g., <div class="component-container">)
            - Content: Focus solely on the component design
          }

          ## Implementation Research (from web, 2024-2025)

          COMPONENT PATTERNS:
          {implementation_research.component_patterns}

          RESPONSIVE DESIGN:
          {implementation_research.responsive_design}

          ACCESSIBILITY GUIDELINES:
          {implementation_research.accessibility}

          HTML SEMANTICS:
          {implementation_research.html_semantics}

          CSS ARCHITECTURE:
          {implementation_research.css_architecture}

          ## Task
          Generate TWO files that work together as a reusable template, incorporating insights from the implementation research above:

          **File 1**: `{target}-layout-{layout_id}.html`
          - 🏗️ **SEMANTIC STRUCTURE**: HTML5 structure WITHOUT any style-specific values
          - {IF target_type == "page": "Complete HTML document with <html>, <head>, <body>" ELSE: "Minimal wrapper with component container only"}
          - 🔗 **DYNAMIC STYLING**: Use placeholder links for runtime style switching:
            ```html
            <link rel=\"stylesheet\" href=\"{{STRUCTURAL_CSS}}\">
            <link rel=\"stylesheet\" href=\"{{TOKEN_CSS}}\">
            ```
          - ♿ **ACCESSIBILITY**: All semantic elements, ARIA attributes, responsive structure
          - 🚫 **ZERO HARDCODING**: NO inline styles, NO hardcoded colors/fonts/spacing
          - 🎨 **STYLE-AGNOSTIC**: HTML structure must work with ANY design token set

          **File 2**: `{target}-layout-{layout_id}.css`
          - 🎨 **TOKEN-DRIVEN STYLING**: ALL values use `var()` for dynamic theme switching
          - 🔄 **RUNTIME SWITCHABLE**: `background-color: var(--color-surface-background);`
          - 🚫 **ZERO LITERALS**: NO hardcoded values (#4F46E5, 16px, Arial)
          - 📐 **SEMANTIC NAMING**: BEM or descriptive class naming
          - 📱 **MOBILE-FIRST**: Responsive design using token-based breakpoints
          - 💡 **VARIABLE REFERENCES**: Every visual property must use var(--token-name)
          - {IF target_type == "component": "Focus styles on component only, minimal global styles"}

          ## Layout Diversity Strategy
          Apply the following strategy from the planned layout strategies (loaded from layout-strategies.json):

          **Layout ID**: {layout_id}
          **Name**: {layout_strategies.strategies[layout_id - 1].name}
          **Description**: {layout_strategies.strategies[layout_id - 1].description}

          Apply this strategy CONSISTENTLY to all styles.

          ## Token Usage Requirements (STRICT - USE EXACT NAMES)

          **CRITICAL**: You MUST use ONLY the variable names listed below. These are extracted from design-tokens.json.
          DO NOT invent variable names like --color-background-base, --radius-md, --transition-base, etc.

          **Available Color Variables** ({len(color_vars)} total):
          {', '.join(color_vars[:10])}... ({len(color_vars) - 10} more)

          **Key Color Variables**:
          - Brand: --color-brand-primary, --color-brand-secondary, --color-brand-accent
          - Surface: --color-surface-background, --color-surface-elevated, --color-surface-overlay
          - Text: --color-text-primary, --color-text-secondary, --color-text-tertiary, --color-text-inverse
          - Border: --color-border-default, --color-border-strong, --color-border-subtle
          - Semantic: --color-semantic-success, --color-semantic-warning, --color-semantic-error, --color-semantic-info

          **Available Typography Variables** ({len(typography_vars)} total):
          {', '.join(typography_vars[:10])}... ({len(typography_vars) - 10} more)

          **Key Typography Variables**:
          - Families: --font-family-heading, --font-family-body, --font-family-mono
          - Sizes: --font-size-xs, --font-size-sm, --font-size-base, --font-size-lg, --font-size-xl, --font-size-2xl, --font-size-3xl, --font-size-4xl
          - Weights: --font-weight-normal, --font-weight-medium, --font-weight-semibold, --font-weight-bold
          - Line heights: --line-height-tight, --line-height-normal, --line-height-relaxed
          - Letter spacing: --letter-spacing-tight, --letter-spacing-normal, --letter-spacing-wide

          **Available Spacing Variables** ({len(spacing_vars)} total):
          {', '.join(spacing_vars)}

          **Available Border Radius Variables** ({len(radius_vars)} total):
          {', '.join(radius_vars)}

          **Available Shadow Variables** ({len(shadow_vars)} total):
          {', '.join(shadow_vars)}

          **Available Breakpoint Variables** ({len(breakpoint_vars)} total):
          {', '.join(breakpoint_vars)}

          **STRICT RULES**:
          1. Use ONLY the variables listed above - NO custom variable names
          2. If you need a value not in the list, use the closest semantic match
          3. For missing tokens (like transitions), use literal CSS values: `transition: all 0.2s ease;`
          4. NO hardcoded colors, fonts, or spacing (e.g., #4F46E5, 16px, Arial)
          5. All `var()` references must match exact variable names above

          ## HTML Requirements (Apply Modern Best Practices from Research)
          - 🏗️ **SEMANTIC STRUCTURE**: HTML5 elements (<header>, <nav>, <main>, <section>, <article>)
          - ♿ **ACCESSIBILITY**: ARIA attributes following WCAG 2.2 guidelines from research
          - 📋 **HEADING HIERARCHY**: Proper h1 → h2 → h3 structure
          - 📱 **RESPONSIVE MARKUP**: Mobile-first structure with adaptive containers
          - 🧩 **COMPONENT MODULARITY**: Reusable component structure from modern patterns
          - 🎨 **STYLE-AGNOSTIC**: NO hardcoded colors/fonts/spacing in HTML

          ## CSS Requirements (Apply Architecture Patterns from Research)
          - 🎨 **DYNAMIC THEMING**: 100% CSS custom properties (var()) for style switching
          - 📱 **ADAPTIVE LAYOUT**: Mobile-first media queries using token breakpoints
          - 🔄 **RUNTIME SWITCHABLE**: All visual styles via CSS variables only
          - 🚫 **NO HARDCODED VALUES**: Zero literal colors/fonts/spacing
          - 📐 **SEMANTIC CLASSES**: BEM or descriptive naming following CSS architecture
          - 🏛️ **MODERN PATTERNS**: Grid, flexbox, container queries for responsiveness
          - 💡 **TOKEN REFERENCES**: Every style property uses var(--token-name)

          ## Responsive Design
          - Mobile: 375px+ (single column, stacked)
          - Tablet: var(--breakpoint-md) (adapted layout)
          - Desktop: var(--breakpoint-lg)+ (full layout)

          ## Response Format
          **CRITICAL**: Provide clearly labeled sections for each file. **DO NOT include base path or attempt to write files**.
          The main command will handle file writing based on your labeled output.

          Format your response as:

          ===== {target}-layout-{layout_id}.html =====
          {Complete HTML content here}

          ===== {target}-layout-{layout_id}.css =====
          {Complete CSS content here}

          ## Deliverables
          TWO template files for the '{target}-layout-{layout_id}' combination:
          1. `{target}-layout-{layout_id}.html` - Reusable HTML structure with CSS placeholders
          2. `{target}-layout-{layout_id}.css` - Structural CSS using var() for all values

          🎯 **CRITICAL QUALITY GATES**:
          ✅ **ADAPTIVE**: Works on mobile (375px), tablet (768px), desktop (1024px+)
          ✅ **STYLE-SWITCHABLE**: Change {{TOKEN_CSS}} link → instant theme switching
          ✅ **TOKEN-ONLY**: 100% var() usage, inspectable with "Search for: #|px|rem" → 0 matches in values
          ✅ **REUSABLE**: Same HTML/CSS structure works for ALL style variants

          IMPORTANT: These templates will be reused across ALL styles, so they must be
          completely style-agnostic (no hardcoded colors, fonts, or spacing).

          **Wrapper Strategy**:
          {IF target_type == "page":
            Use complete HTML document structure with navigation and footer.
          }
          {ELSE IF target_type == "component":
            Use minimal wrapper:
            ```html
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset=\"UTF-8\">
              <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
              <title>{target} Component</title>
              {{STRUCTURAL_CSS}}
              {{TOKEN_CSS}}
            </head>
            <body>
              <div class=\"component-demo-container\">
                <!-- Component content here -->
              </div>
            </body>
            </html>
            ```
          }

          **Output Instructions**:
          - Return content using the labeled section format shown above
          - Do not include file paths in your response
          - The main command will extract sections and write files to: {base_path}/prototypes/_templates/
        "

REPORT: "⏳ Phase 2a: Waiting for agents to complete template generation..."
```

#### Phase 2a.5: Process Agent Output and Write Template Files

**New Pattern**: Main command controls file paths; agents provide content.

```bash
REPORT: "📝 Phase 2a.5: Processing agent outputs and writing template files..."

# Helper function to extract labeled sections from agent output
extract_section(agent_output, section_label):
    # Find the section between ===== markers
    start_marker = f"===== {section_label} ====="
    lines = agent_output.split("\n")

    in_section = False
    section_content = []

    FOR line IN lines:
        IF line.strip() == start_marker:
            in_section = TRUE
            CONTINUE
        ELSE IF line.strip().startswith("=====") AND in_section:
            # Found next section, stop
            BREAK
        ELSE IF in_section:
            section_content.append(line)

    RETURN "\n".join(section_content).strip()

# Process each agent task result
FOR layout_id IN range(1, layout_variants + 1):
    FOR target IN target_list:
        # Get agent response for this target-layout combination
        agent_output = get_agent_response(layout_id, target)

        # Extract labeled sections
        html_label = f"{target}-layout-{layout_id}.html"
        css_label = f"{target}-layout-{layout_id}.css"

        html_content = extract_section(agent_output, html_label)
        css_content = extract_section(agent_output, css_label)

        # Verify content was extracted
        IF NOT html_content:
            ERROR: f"Failed to extract HTML content for {html_label} from agent output"
            REPORT: f"Agent output preview: {agent_output[:200]}..."
            CONTINUE

        IF NOT css_content:
            ERROR: f"Failed to extract CSS content for {css_label} from agent output"
            REPORT: f"Agent output preview: {agent_output[:200]}..."
            CONTINUE

        # Write files to correct location (controlled by main command)
        html_path = f"{base_path}/prototypes/_templates/{html_label}"
        css_path = f"{base_path}/prototypes/_templates/{css_label}"

        Write(html_path, html_content)
        Write(css_path, css_content)

        REPORT: f"   ✓ Written: {html_label} ({len(html_content)} chars)"
        REPORT: f"   ✓ Written: {css_label} ({len(css_content)} chars)"

REPORT: "✅ Phase 2a.5 complete: Wrote {layout_variants * len(target_list) * 2} template files"
REPORT: "   Strategy: Agent provides content, main command writes files"
```

#### Phase 2b: Prototype Instantiation

Create final `S × L × P` prototypes using the optimized `ui-instantiate-prototypes.sh` script.
Uses **fast file operations** and **auto-detection** for efficient generation.

```bash
REPORT: "🚀 Phase 2b: Instantiating prototypes from templates..."

# Step 1: Convert design tokens to CSS for each style
REPORT: "   Converting design tokens to CSS variables..."

# Check for jq dependency (required by convert_tokens_to_css.sh)
IF NOT command_exists("jq"):
    ERROR: "jq is not installed or not in PATH. The conversion script requires jq."
    REPORT: "Please install jq:"
    REPORT: "  - macOS: brew install jq"
    REPORT: "  - Linux: apt-get install jq or yum install jq"
    REPORT: "  - Windows: Download from https://stedolan.github.io/jq/download/"
    EXIT 1

# Convert design tokens to CSS for each style variant
FOR style_id IN range(1, style_variants + 1):
    tokens_json_path = "{base_path}/style-consolidation/style-${style_id}/design-tokens.json"
    tokens_css_path = "{base_path}/style-consolidation/style-${style_id}/tokens.css"
    script_path = "~/.claude/scripts/convert_tokens_to_css.sh"

    # Verify input file exists
    IF NOT exists(tokens_json_path):
        REPORT: "   ✗ ERROR: Input file not found for style-${style_id}: ${tokens_json_path}"
        CONTINUE  # Skip this iteration, continue with next style

    # Execute conversion: cat input.json | script.sh > output.css
    Bash(cat "${tokens_json_path}" | "${script_path}" > "${tokens_css_path}")

    # Verify output was generated
    IF exit_code == 0 AND exists(tokens_css_path):
        REPORT: "   ✓ Generated tokens.css for style-${style_id}"
    ELSE:
        REPORT: "   ✗ ERROR: Failed to generate tokens.css for style-${style_id}"
        IF exit_code != 0:
            REPORT: "      Script exit code: ${exit_code}"
        IF NOT exists(tokens_css_path):
            REPORT: "      Output file not created at: ${tokens_css_path}"

# Step 2: Use ui-instantiate-prototypes.sh script for instantiation
# The script handles:
# - Template copying with placeholder replacement
# - Implementation notes generation
# - Preview files (compare.html, index.html, PREVIEW.md)
# - Auto-detection of configuration from directory structure

# Prepare script parameters
prototypes_dir = "{base_path}/prototypes"
targets_csv = ','.join(target_list)

# Determine session ID
IF --session provided:
    session_id = {session_id}
ELSE:
    session_id = "standalone"

# Execute instantiation script with target type
Bash(
  ~/.claude/scripts/ui-instantiate-prototypes.sh \
    "{prototypes_dir}" \
    --session-id "{session_id}" \
    --mode "{target_type}"
)

# The script auto-detects:
# - Targets from _templates/*.html files
# - Style variants from ../style-consolidation/style-* directories
# - Layout variants from _templates/*-layout-*.html pattern

# Script generates:
# 1. S × L × T HTML prototypes with CSS links (T = targets)
# 2. Implementation notes for each prototype
# 3. compare.html (interactive matrix)
# 4. index.html (navigation page)
# 5. PREVIEW.md (documentation)

REPORT: "✅ Phase 2b complete: Instantiated {style_variants * layout_variants * len(target_list)} final prototypes"
REPORT: "   Mode: {target_type}"
REPORT: "   Performance: {style_variants}× faster than original approach"
REPORT: "   Preview files generated: compare.html, index.html, PREVIEW.md"
```

**Performance Comparison**:

| Metric | Before (S×L×T Agent calls) | After (L×T Agent calls + File Ops) |
|--------|----------------------------|-----------------------------------|
| Agent Tasks | `S × L × T` | `L × T` |
| Example (3×3×3) | 27 Agent calls | 9 Agent calls |
| Speed Improvement | Baseline | **3× faster** (S times) |
| Resource Usage | High (creative generation for each combo) | Optimized (creative only for templates) |

*T = targets (pages or components)*

### Phase 3: Verify Preview Files

```bash
# Note: Preview files are now generated by ui-instantiate-prototypes.sh script
# This phase only verifies that all expected files were created

REPORT: "🔍 Phase 3: Verifying preview files..."

expected_files = [
    "{base_path}/prototypes/compare.html",
    "{base_path}/prototypes/index.html",
    "{base_path}/prototypes/PREVIEW.md"
]

all_present = true
FOR file_path IN expected_files:
    IF exists(file_path):
        REPORT: "   ✓ Found: {basename(file_path)}"
    ELSE:
        REPORT: "   ✗ Missing: {basename(file_path)}"
        all_present = false

IF all_present:
    REPORT: "✅ Phase 3 complete: All preview files verified"
ELSE:
    WARN: "⚠️ Some preview files missing - script may have failed"
    REPORT: "   Check Phase 2b output for errors"

# Optional: Generate fallback design-tokens.css for reference
fallback_css_path = "{base_path}/prototypes/design-tokens.css"
IF NOT exists(fallback_css_path):
    Write(fallback_css_path, """
/* Auto-generated fallback CSS custom properties */
/* Note: Each prototype links to its specific style's tokens.css */
/* See style-consolidation/style-{n}/tokens.css for actual values */

:root {
  /* This file serves as documentation only */
  /* Individual prototypes use style-specific tokens */
}
""")
    REPORT: "   ✓ Generated fallback design-tokens.css"
```

### Phase 3.5: Cross-Target Consistency Validation

**Condition**: Only executes if `len(target_list) > 1 AND target_type == "page"`
**Parallel Executor**: → @ui-design-agent

```bash
# Skip if single target or component mode
IF len(target_list) <= 1 OR target_type == "component":
    SKIP to Phase 4

# For multi-page workflows, validate cross-page consistency → @ui-design-agent
FOR style_id IN range(1, style_variants + 1):
    FOR layout_id IN range(1, layout_variants + 1):
        Task(@ui-design-agent): "
          [CROSS_PAGE_CONSISTENCY_VALIDATION]

          Validate design consistency across multiple {target_type}s for Style-{style_id} Layout-{layout_id}

          🎯 **VALIDATION FOCUS**:
          ✅ **ADAPTIVE CONSISTENCY**: Same responsive behavior across all pages
          ✅ **STYLE-SWITCHING**: Verify token references enable uniform theme switching
          ✅ **CROSS-PAGE HARMONY**: Shared components use identical CSS variables

          ## Context
          STYLE_ID: {style_id}
          LAYOUT_ID: {layout_id}
          TARGETS: {target_list}
          TARGET_TYPE: {target_type}
          BASE_PATH: {base_path}

          ## Input Files
          FOR each target IN {target_list}:
              - {base_path}/prototypes/{target}-style-{style_id}-layout-{layout_id}.html
              - {base_path}/prototypes/{target}-style-{style_id}-layout-{layout_id}.css

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
          # Cross-{target_type.capitalize()} Consistency Report
          **Style**: {style_id} | **Layout**: {layout_id} | **Targets**: {', '.join(target_list)}

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

# Aggregate consistency reports
Write({base_path}/prototypes/CONSISTENCY_SUMMARY.md):
# Multi-{target_type.capitalize()} Consistency Summary

This report summarizes consistency validation across all {len(target_list)} {target_type}s.

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

### Phase 4: Completion

```javascript
TodoWrite({
  todos: [
    {content: "Load layout strategies from consolidation", status: "completed", activeForm: "Loading layout strategies"},
    {content: "Resolve paths and load design systems", status: "completed", activeForm: "Loading design systems"},
    {content: "Research modern UI implementation patterns with Exa MCP", status: "completed", activeForm: "Researching implementation patterns"},
    {content: `Generate ${layout_variants}×${target_list.length} layout templates using planned strategies`, status: "completed", activeForm: "Generating layout templates"},
    {content: "Convert design tokens to CSS variables", status: "completed", activeForm: "Converting tokens"},
    {content: `Instantiate ${style_variants}×${layout_variants}×${target_list.length} prototypes using script`, status: "completed", activeForm: "Running instantiation script"},
    {content: "Verify preview files generation", status: "completed", activeForm: "Verifying preview files"}
  ]
});
```

**Completion Message**:
```
✅ Optimized Matrix UI generation complete!

Configuration:
- Style Variants: {style_variants}
- Layout Variants: {layout_variants} (from layout-strategies.json)
- Layout Strategies: {[s.name for s in layout_strategies.strategies]}
- Target Type: {target_type_icon} {target_type}
- Targets: {target_list}
- Total Prototypes: {style_variants * layout_variants * len(target_list)}

Performance Metrics:
- Layout Templates Generated: {layout_variants * len(target_list)} (Agent tasks)
- Prototypes Instantiated: {style_variants * layout_variants * len(target_list)} (script-based)
- Preview Files: compare.html, index.html, PREVIEW.md (auto-generated)
- Speed Improvement: {style_variants}× faster than previous approach
- Resource Efficiency: {100 * (1 - 1/style_variants)}% reduction in Agent calls
- Script: ui-instantiate-prototypes.sh v3.0 with auto-detection

Generated Structure:
📂 {base_path}/prototypes/
├── _templates/
│   ├── {target}-layout-{1..L}.html ({layout_variants * len(target_list)} templates)
│   └── {target}-layout-{1..L}.css ({layout_variants * len(target_list)} structural CSS)
├── {target}-style-{s}-layout-{l}.html ({style_variants * layout_variants * len(target_list)} final prototypes)
├── {target}-style-{s}-layout-{l}-notes.md
├── compare.html (interactive matrix visualization)
└── index.html (quick navigation)

🌐 Interactive Preview:
1. Matrix View: Open compare.html (recommended)
2. Quick Index: Open index.html
3. Instructions: See PREVIEW.md

{IF target_type == "component":
Note: Components are rendered with minimal wrapper for isolated comparison.
}

Next: /workflow:ui-design:update {--session flag if applicable}

Note: When called from /workflow:ui-design:auto, design-update is triggered automatically.

**Dynamic Values**:
- target_type_icon: "📄" for page, "🧩" for component
```

## Output Structure

```
{base_path}/prototypes/
├── _templates/                            # Reusable layout templates
│   ├── {target}-layout-1.html            # Style-agnostic HTML structure
│   ├── {target}-layout-1.css             # Structural CSS with var() references
│   ├── {target}-layout-2.html
│   ├── {target}-layout-2.css
│   └── ... (L × T templates total, T=targets)
├── compare.html                           # Interactive matrix visualization
├── index.html                             # Simple navigation page
├── PREVIEW.md                             # Preview instructions
├── design-tokens.css                      # CSS custom properties fallback
├── {target}-style-{s}-layout-{l}.html    # Final prototypes (copied from templates)
├── {target}-style-{s}-layout-{l}-notes.md  # Implementation notes
└── ... (S × L × T total final files)

{base_path}/style-consolidation/
├── style-1/
│   ├── design-tokens.json
│   ├── tokens.css                         # CSS variables for style-1
│   └── style-guide.md
├── style-2/
│   ├── design-tokens.json
│   ├── tokens.css                         # CSS variables for style-2
│   └── style-guide.md
└── ...
```

## Error Handling

### Pre-execution Checks
- **Missing layout-strategies.json**: Error - Run `/workflow:ui-design:consolidate` first
- **No design systems found**: Error - Run `/workflow:ui-design:consolidate --keep-separate` first
- **Invalid target names**: Extract from synthesis-specification.md or error with validation message
- **Missing templates directory**: Verify Phase 2a completed successfully
- **Unsupported target type**: Error if target_type not in ["page", "component"]

### Phase-Specific Errors
- **Agent execution errors (Phase 2a)**: Report details, suggest retry with specific phase
- **Token conversion errors (Phase 2b)**: Check design-tokens.json format, validate JSON schema
- **Script execution errors (Phase 2b)**:
  - Check `ui-instantiate-prototypes.sh` exists at `~/.claude/scripts/`
  - Verify script has execute permissions (`chmod +x`)
  - Review script output for specific error messages
  - Check template files exist in `_templates/` directory
  - Verify style-consolidation directory structure
- **Preview generation errors (Phase 3)**:
  - Check script completed successfully
  - Verify `_template-compare-matrix.html` exists
  - Review Phase 2b output for warnings

### Recovery Strategies
- **Partial failure**: Script reports generated vs failed counts - review logs
- **Missing templates**: Indicates Phase 2a issue - regenerate templates
- **Auto-detection failures**: Use manual mode with explicit parameters
- **Permission errors**: Run `chmod +x ~/.claude/scripts/ui-instantiate-prototypes.sh`

## Quality Checks

After generation, ensure:
- [ ] All CSS values reference design token custom properties
- [ ] No hardcoded colors, spacing, or typography
- [ ] Semantic HTML structure with proper element hierarchy
- [ ] ARIA attributes present for accessibility
- [ ] Responsive design implemented with mobile-first approach
- [ ] File naming follows `{target}-style-{s}-layout-{l}` convention
- [ ] compare.html loads correctly with all prototypes
- [ ] Template files are reusable and style-agnostic
- [ ] Appropriate wrapper used (full-page for pages, minimal for components)

## Key Features

1. **Research-Informed Implementation** 🆕
   - Uses Exa MCP to research modern UI implementation patterns (2024-2025)
   - Searches for component patterns, responsive design, accessibility, HTML semantics, CSS architecture
   - Generates prototypes based on current web development best practices
   - Context-aware: extracts tech stack hints from project brainstorming artifacts
   - Multi-dimensional research: component, responsive, accessibility, semantic HTML, CSS patterns

2. **Unified Target Generation**
   - Supports both pages (full layouts) and components (isolated elements)
   - Intelligent wrapper selection based on target type
   - Backward compatible with legacy `--pages` parameter

3. **Optimized Template-Based Architecture**
   - Decouples HTML structure from CSS styling
   - Generates `L × T` reusable templates instead of `S × L × T` unique files (T=targets)
   - **`S` times faster** than previous approach (typically 3× faster for S=3)

4. **Two-Layer Generation Strategy**
   - Layer 1: Agent-driven creative generation of layout templates (informed by research)
   - Layer 2: Fast file operations for prototype instantiation (script-based)
   - Reduces expensive Agent calls by ~67% (for S=3)

5. **Script-Based Instantiation (v3.0)**
   - Uses `ui-instantiate-prototypes.sh` for efficient file operations
   - Auto-detection of configuration from directory structure
   - Robust error handling with detailed reporting
   - Generates implementation notes for each prototype
   - Integrated preview file generation
   - Supports both page and component modes

6. **Modern Best Practices Integration**
   - Component patterns from latest UI libraries and frameworks
   - WCAG 2.2 accessibility implementation
   - Modern responsive design (grid, flexbox, container queries)
   - Semantic HTML5 structure following current standards
   - CSS architecture patterns (BEM, design tokens, custom properties)

7. **Consistent Cross-Style Layouts**
   - Same layout structure applied uniformly across all style variants
   - Easier to compare styles directly (HTML structure is identical)
   - Simplified maintenance (edit template once, affects all styles)

8. **Dynamic Style Injection**
   - CSS custom properties enable runtime style switching
   - Each style variant has its own `tokens.css` file
   - Clean separation of structure and aesthetics

9. **Interactive Visualization**
   - Full-featured compare.html from template
   - Matrix grid view with synchronized scrolling
   - Enhanced index.html with statistics
   - Comprehensive PREVIEW.md documentation
   - Per-style design system references

10. **Production-Ready Output**
   - Semantic HTML5 and ARIA attributes (following latest guidelines)
   - Mobile-first responsive design (modern patterns)
   - Token-driven styling (no hardcoded values)
   - Implementation notes for each prototype

## Integration Points

- **Input**:
  - Per-style `design-tokens.json` from `/workflow:ui-design:consolidate --keep-separate`
  - **`layout-strategies.json`** from `/workflow:ui-design:consolidate` (defines layout variants)
  - Optional: `synthesis-specification.md` for target requirements
  - Target type specification (page or component)
- **Output**: Matrix HTML/CSS prototypes for `/workflow:ui-design:update`
- **Template**: `~/.claude/workflows/_template-compare-matrix.html` (global)
- **Auto Integration**: Automatically triggered by `/workflow:ui-design:auto` or `/workflow:ui-design:explore-auto` workflows
- **Key Change**: Unified target system supports both pages and components with appropriate wrapper selection
- **Backward Compatibility**: Legacy `--pages` parameter continues to work
