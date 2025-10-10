---
name: generate
description: Generate UI prototypes in matrix mode (style × layout combinations) for pages or components
usage: /workflow:ui-design:generate [--targets "<list>"] [--target-type "page|component"] [--base-path <path>] [--session <id>] [--style-variants <count>] [--layout-variants <count>]
argument-hint: "[--targets \"dashboard,auth,navbar,hero\"] [--target-type \"page\"] [--base-path \".workflow/WFS-xxx/design-run-xxx\"] [--style-variants 3] [--layout-variants 3]"
parameters:
  - name: --style-variants
    type: number
    default: 3
    description: "Number of style variants to generate prototypes for (1-5). Auto-validates against actual style-* directories. ⚠️ Recommend omitting to use auto-detection."
  - name: --layout-variants
    type: number
    default: auto-detected from layout-strategies.json
    description: "Number of layout variants. Default: loaded from consolidation output. Can override for manual testing."
  - name: --targets
    type: string
    description: "Comma-separated list of targets (pages or components) to generate"
  - name: --target-type
    type: string
    default: page
    description: "Type of targets: 'page' (full layout) or 'component' (isolated element)"
examples:
  - /workflow:ui-design:generate --base-path ".workflow/WFS-auth/design-run-20250109-143022" --targets "dashboard,settings" --target-type "page" --style-variants 3 --layout-variants 3
  - /workflow:ui-design:generate --session WFS-auth --targets "home,pricing" --target-type "page" --style-variants 2 --layout-variants 2
  - /workflow:ui-design:generate --base-path "./.workflow/.design/run-20250109-150533"  # ✅ Recommended: auto-detect variants
  - /workflow:ui-design:generate --targets "navbar,hero,card" --target-type "component" --style-variants 3 --layout-variants 2
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

### Phase 1: Path Resolution & Context Loading

```bash
# 1. Determine base path
IF --base-path: base_path = {provided_base_path}
ELSE IF --session: base_path = find_latest_path_matching(".workflow/WFS-{session}/design-*")
ELSE: base_path = find_latest_path_matching(".workflow/.design/*")

# 2. Determine style variant count and layout variant count
style_variants = --style-variants OR 3; VALIDATE: 1 <= style_variants <= 5
layout_variants = --layout-variants OR 3; VALIDATE: 1 <= layout_variants <= 5

# Validate against actual style directories
actual_style_count = count_directories({base_path}/style-consolidation/style-*)

IF actual_style_count == 0:
    ERROR: "No style directories found"; SUGGEST: "Run /workflow:ui-design:consolidate first"; EXIT 1

IF style_variants > actual_style_count:
    WARN: "⚠️ Requested {style_variants}, but only {actual_style_count} exist"
    REPORT: "   Available styles: {list_directories}"; style_variants = actual_style_count

REPORT: "✅ Validated style variants: {style_variants}"

# 3. Enhanced target list parsing with type detection
target_list = []; target_type = "page"  # Default

# Priority 1: Unified --targets parameter
IF --targets:
    raw_targets = {--targets value}
    target_list = split_and_clean(raw_targets, delimiters=[",", ";", "、"])
    target_list = [t.strip().lower().replace(" ", "-") for t in target_list if t.strip()]

    target_type = --target-type provided ? {--target-type} : detect_target_type(target_list)
    REPORT: "🎯 Using provided targets ({target_type}): {', '.join(target_list)}"

# Priority 2: Legacy --pages parameter
ELSE IF --pages:
    raw_targets = {--pages value}
    target_list = split_and_clean(raw_targets, delimiters=[",", ";", "、"])
    target_list = [t.strip().lower().replace(" ", "-") for t in target_list if t.strip()]
    target_type = "page"
    REPORT: "📋 Using provided pages (legacy): {', '.join(target_list)}"

# Priority 3: Extract from synthesis-specification.md
ELSE IF --session:
    synthesis_spec = Read(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md)
    target_list = extract_targets_from_synthesis(synthesis_spec); target_type = "page"
    REPORT: "📋 Extracted from synthesis: {', '.join(target_list)}"

# Priority 4: Detect from existing prototypes or default
ELSE:
    target_list = detect_from_prototypes({base_path}/prototypes/) OR ["home"]; target_type = "page"
    REPORT: "📋 Detected/default targets: {', '.join(target_list)}"

# 4. Validate target names
validated_targets = [t for t in target_list if regex_match(t, r"^[a-z0-9][a-z0-9_-]*$")]
invalid_targets = [t for t in target_list if t not in validated_targets]

IF invalid_targets: REPORT: "⚠️ Skipped invalid target names: {', '.join(invalid_targets)}"
VALIDATE: validated_targets not empty, "No valid targets found"
target_list = validated_targets

STORE: target_list, target_type

# 5. Verify design systems exist
FOR style_id IN range(1, style_variants + 1):
    VERIFY: exists({base_path}/style-consolidation/style-{style_id}/design-tokens.json)
    VERIFY: exists({base_path}/style-consolidation/style-{style_id}/style-guide.md)

# 6. Load requirements (if integrated mode)
IF --session: synthesis_spec = Read(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md)
```

### Phase 1.5: Target-Specific Layout Planning

```bash
REPORT: "📐 Planning {layout_variants} layout strategies for each target..."

CREATE: {base_path}/prototypes/_templates/

# For each target, plan its specific layouts
FOR target IN target_list:
    REPORT: "  Planning layouts for '{target}' ({target_type})..."

    FOR layout_id IN range(1, layout_variants + 1):
        Task(ui-design-agent): "
          [TARGET_LAYOUT_PLANNING]

          Generate a concrete, actionable layout plan for a specific target and WRITE it to the file system.

          ## Context
          TARGET: {target}
          TARGET_TYPE: {target_type}
          LAYOUT_ID: {layout_id}
          BASE_PATH: {base_path}
          {IF --session: PROJECT_REQUIREMENTS: Read(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md)}

          ## Task
          Research, design, and WRITE a modern, innovative layout plan specifically for '{target}'.

          ## Research Phase (Use MCP Tools)
          1. Search for modern {target_type} layout patterns:
             mcp__exa__get_code_context_exa(
               query=\"modern {target} {target_type} layout design patterns 2024 2025\",
               tokensNum=\"dynamic\"
             )
          2. Search for {target}-specific UI best practices

          ## Layout Planning Rules

          **For PAGES (target_type='page')**:
          - Define macro-layout: main regions (header, sidebar, main, footer)
          - Specify grid/flexbox structure for content organization
          - Define responsive breakpoints and behavior
          - Include navigation and page-level components

          **For COMPONENTS (target_type='component')**:
          - Define micro-layout: internal element arrangement
          - Specify alignment, spacing, and element sizing
          - Focus on component-specific structure (no header/footer)
          - Optimize for reusability and composition

          ## File Write Instructions
          Generate layout plan JSON and WRITE it using Write() tool:

          **Path**: {base_path}/prototypes/_templates/{target}-layout-{layout_id}.json

          **Content** - JSON with this EXACT structure:
          ```json
          {
            \"id\": \"layout-{layout_id}\",
            \"target\": \"{target}\",
            \"target_type\": \"{target_type}\",
            \"name\": \"Descriptive name (2-4 words)\",
            \"description\": \"Detailed description (2-3 sentences explaining structure, use cases, and unique aspects)\",
            \"structure\": {
              // For pages, include:
              \"type\": \"sidebar-main\" | \"centered\" | \"asymmetric\" | \"grid-dashboard\",
              \"regions\": [\"header\", \"sidebar\", \"main\", \"footer\"],
              \"grid\": {
                \"columns\": 12,
                \"rows\": \"auto\",
                \"gap\": \"var(--spacing-6)\"
              },
              \"sidebar\": {
                \"position\": \"left\" | \"right\",
                \"width\": \"250px\",
                \"fixed\": true,
                \"collapsible\": true
              },
              \"responsive\": {
                \"mobile\": {\"columns\": 1, \"sidebar\": \"hidden\"},
                \"tablet\": {\"columns\": 6, \"sidebar\": \"overlay\"},
                \"desktop\": {\"columns\": 12, \"sidebar\": \"fixed\"}
              },

              // For components, include:
              \"arrangement\": \"flex-column\" | \"flex-row\" | \"grid\",
              \"alignment\": \"center\" | \"start\" | \"end\" | \"stretch\",
              \"spacing\": \"compact\" | \"normal\" | \"relaxed\",
              \"element_order\": [\"icon\", \"title\", \"description\", \"action\"]
            },
            \"semantic_hints\": [
              \"dashboard\",
              \"data-visualization\",
              \"navigation-sidebar\",
              \"card-based\"
            ],
            \"accessibility_features\": [
              \"skip-navigation\",
              \"landmark-regions\",
              \"keyboard-navigation\",
              \"screen-reader-optimized\"
            ],
            \"research_references\": [
              \"URL or description of research source 1\",
              \"URL or description of research source 2\"
            ]
          }
          ```

          ## Write Operation Instructions
          - Use Write() tool with the absolute path provided above
          - Create directory if needed: Bash('mkdir -p {base_path}/prototypes/_templates')
          - Verify write operation succeeds

          ## Example Write Operation
          ```javascript
          Write(\"{base_path}/prototypes/_templates/{target}-layout-{layout_id}.json\", JSON.stringify(layout_plan, null, 2))
          ```

          ## Completion
          Report successful file creation with path confirmation.

          ## Critical Requirements
          - ✅ Layout plan is ONLY for '{target}' - tailor to this specific target's needs
          - ✅ Consider {target_type} type (page vs component) when designing structure
          - ✅ Research modern patterns using MCP tools before designing
          - ✅ Provide concrete, implementable structure (not abstract descriptions)
          - ✅ Different layout IDs should explore meaningfully different approaches
          - ✅ Use semantic naming and clear documentation
          - ✅ Write file directly using Write() tool - do NOT return contents as text
        "

# Wait for all agent tasks to complete
REPORT: "⏳ Waiting for layout planning agents to complete..."

# Verify agent created layout JSON files
REPORT: "📝 Verifying agent file creation..."

FOR target IN target_list:
    FOR layout_id IN range(1, layout_variants + 1):
        layout_json_label = f"{target}-layout-{layout_id}.json"
        json_path = f"{base_path}/prototypes/_templates/{layout_json_label}"

        # Verify file exists
        VERIFY: exists(json_path), f"Layout JSON not created by agent: {layout_json_label}"

        # Validate JSON structure
        TRY:
            layout_json_content = Read(json_path)
            layout_plan = JSON.parse(layout_json_content)

            # Validate required fields
            VALIDATE: layout_plan.id == f"layout-{layout_id}", f"Invalid layout ID in {layout_json_label}"
            VALIDATE: layout_plan.target == target, f"Invalid target in {layout_json_label}"
            VALIDATE: layout_plan.target_type == target_type, f"Invalid target_type in {layout_json_label}"
            VALIDATE: layout_plan.name exists, f"Missing 'name' field in {layout_json_label}"
            VALIDATE: layout_plan.structure exists, f"Missing 'structure' field in {layout_json_label}"

            file_size = get_file_size(json_path)
            REPORT: f"   ✓ Verified: {layout_json_label} - {layout_plan.name} ({file_size} KB)"
        CATCH error:
            ERROR: f"Validation failed for {layout_json_label}: {error}"
            REPORT: f"   ⚠️ File exists but validation failed - review agent output"

REPORT: f"✅ Phase 1.5 complete: Verified {len(target_list) × layout_variants} target-specific layout files"
```

### Phase 1.6: Token Variable Name Extraction

```bash
REPORT: "📋 Extracting design token variable names..."
tokens_json_path = "{base_path}/style-consolidation/style-1/design-tokens.json"
VERIFY: exists(tokens_json_path), "Design tokens not found. Run /workflow:ui-design:consolidate first."

design_tokens = Read(tokens_json_path)

# Extract all available token categories and variable names
token_reference = {
  "colors": {"brand": list(keys), "surface": list(keys), "semantic": list(keys), "text": list(keys), "border": list(keys)},
  "typography": {"font_family": list(keys), "font_size": list(keys), "font_weight": list(keys), "line_height": list(keys), "letter_spacing": list(keys)},
  "spacing": list(keys), "border_radius": list(keys), "shadows": list(keys), "breakpoints": list(keys)
}

# Generate complete variable name lists for Agent prompt
color_vars = []; FOR category, keys: FOR key: color_vars.append(f"--color-{category}-{key}")
typography_vars = []; FOR category, keys: FOR key: typography_vars.append(f"--{category.replace('_', '-')}-{key}")
spacing_vars = [f"--spacing-{key}" for key in token_reference.spacing]
radius_vars = [f"--border-radius-{key}" for key in token_reference.border_radius]
shadow_vars = [f"--shadow-{key}" for key in token_reference.shadows]
breakpoint_vars = [f"--breakpoint-{key}" for key in token_reference.breakpoints]

all_token_vars = color_vars + typography_vars + spacing_vars + radius_vars + shadow_vars + breakpoint_vars

REPORT: f"✅ Extracted {len(all_token_vars)} design token variables from design-tokens.json"
```

### Phase 2: Optimized Matrix UI Generation

**Strategy**: Two-layer generation reduces complexity from `O(S×L×T)` to `O(L×T)`, achieving **`S` times faster** performance.

- **Layer 1**: Generate `L × T` layout templates (HTML structure + structural CSS) by agent
- **Layer 2**: Instantiate `S × L × T` final prototypes via fast file operations

#### Phase 2a: Layout Template Generation

**Parallel Executor**: → @ui-design-agent

```bash
CREATE: {base_path}/prototypes/_templates/
CREATE: {base_path}/prototypes/

# Launch parallel template generation tasks → @ui-design-agent
# Total agent tasks: layout_variants × len(target_list)
FOR layout_id IN range(1, layout_variants + 1):
    FOR target IN target_list:
        # Read the target-specific layout plan
        layout_json_path = f"{base_path}/prototypes/_templates/{target}-layout-{layout_id}.json"
        layout_plan = Read(layout_json_path)

        Task(ui-design-agent): "
          [UI_LAYOUT_TEMPLATE_GENERATION]

          🚨 **CRITICAL: TARGET INDEPENDENCE REQUIREMENT** 🚨
          You are generating a template for EXACTLY ONE target: '{target}'.
          - Do NOT include content from other targets in the workflow
          - This template is for '{target}' ONLY - treat it as a standalone UI entity
          - Even if '{target}' might coexist with other targets in a final application,
            your task is to create an INDEPENDENT, REUSABLE template for '{target}' alone

          Generate a **style-agnostic** layout template for a specific {target_type} and layout strategy.

          🎯 **CRITICAL REQUIREMENTS**:
          ✅ **ADAPTIVE**: Multi-device responsive design (mobile, tablet, desktop)
          ✅ **STYLE-SWITCHABLE**: Support runtime theme/style switching via CSS variables
          ✅ **TOKEN-DRIVEN**: 100% CSS variable usage, zero hardcoded values
          ✅ **INDEPENDENT**: Template for '{target}' only, no other targets included
          ✅ **RESEARCH-INFORMED**: Use MCP tools to research modern UI patterns as needed

          ## Context
          LAYOUT_ID: {layout_id} | TARGET: {target} | TARGET_TYPE: {target_type}
          BASE_PATH: {base_path}
          {IF --session: Requirements: .workflow/WFS-{session}/.brainstorming/synthesis-specification.md}

          **Target Type Details**:
          {IF target_type == "page":
            - Type: Full-page layout | Wrapper: Complete HTML document (<html>, <head>, <body>)
            - Navigation: Include header/navigation | Footer: Include page footer
            - Content: Complete page content structure
          }
          {ELSE IF target_type == "component":
            - Type: Isolated UI component | Wrapper: Minimal container for demonstration
            - Navigation: Exclude header/footer | Container: Simple wrapper (e.g., <div class=\"component-container\">)
            - Content: Focus solely on component design
          }

          ## Task
          Generate TWO files that work together as a reusable template.

          ### File 1: HTML Template (`{target}-layout-{layout_id}.html`)

          **Structure Requirements**:
          - Semantic HTML5 elements with ARIA attributes
          - Complete {target_type} wrapper (full document for pages, minimal for components)
          - Zero hardcoded styles, colors, or spacing
          - Responsive structure ready for mobile/tablet/desktop

          **⚠️ CRITICAL: CSS Placeholder Links**

          You MUST include these EXACT placeholder links in the `<head>` section:

          ```html
          <link rel=\"stylesheet\" href=\"{{STRUCTURAL_CSS}}\">
          <link rel=\"stylesheet\" href=\"{{TOKEN_CSS}}\">
          ```

          **Placeholder Rules**:
          1. Use EXACTLY `{{STRUCTURAL_CSS}}` and `{{TOKEN_CSS}}` with double curly braces
          2. Place in `<head>` AFTER `<meta>` tags, BEFORE `</head>` closing tag
          3. DO NOT substitute with actual paths - the script handles this
          4. DO NOT add any other CSS `<link>` tags
          5. These enable runtime style switching for all variants

          **Complete HTML Template Examples**:

          {IF target_type == \"page\":
          ```html
          <!DOCTYPE html>
          <html lang=\"en\">
          <head>
            <meta charset=\"UTF-8\">
            <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
            <title>{target} - Layout {layout_id}</title>
            <link rel=\"stylesheet\" href=\"{{STRUCTURAL_CSS}}\">
            <link rel=\"stylesheet\" href=\"{{TOKEN_CSS}}\">
          </head>
          <body>
            <header><nav aria-label=\"Main navigation\"><!-- Nav content --></nav></header>
            <main><!-- Page content --></main>
            <footer><!-- Footer content --></footer>
          </body>
          </html>
          ```
          }

          {ELSE IF target_type == \"component\":
          ```html
          <!DOCTYPE html>
          <html lang=\"en\">
          <head>
            <meta charset=\"UTF-8\">
            <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
            <title>{target} Component - Layout {layout_id}</title>
            <link rel=\"stylesheet\" href=\"{{STRUCTURAL_CSS}}\">
            <link rel=\"stylesheet\" href=\"{{TOKEN_CSS}}\">
          </head>
          <body>
            <div class=\"component-container\">
              <!-- Component content only -->
            </div>
          </body>
          </html>
          ```
          }

          ### File 2: CSS Template (`{target}-layout-{layout_id}.css`)
          - 🎨 **TOKEN-DRIVEN STYLING**: ALL values use `var()` for dynamic theme switching
          - 🔄 **RUNTIME SWITCHABLE**: `background-color: var(--color-surface-background);`
          - 🚫 **ZERO LITERALS**: NO hardcoded values (#4F46E5, 16px, Arial)
          - 📐 **SEMANTIC NAMING**: BEM or descriptive class naming
          - 📱 **MOBILE-FIRST**: Responsive design using token-based breakpoints
          - {IF target_type == "component": "Focus styles on component only, minimal global styles"}

          ## Layout Plan (Target-Specific)
          Implement the following pre-defined layout plan for this target:

          **Layout JSON Path**: {layout_json_path}
          **Layout Plan**:
          ```json
          {JSON.stringify(layout_plan, null, 2)}
          ```

          **Critical**: Your job is to IMPLEMENT this exact layout plan, not to redesign it.
          - Follow the structure defined in the 'structure' field
          - Use semantic hints for appropriate HTML elements
          - Respect the target_type (page vs component) wrapper requirements
          - Apply the specified responsive behavior

          ## Token Usage Requirements (STRICT - USE EXACT NAMES)

          **CRITICAL**: You MUST use ONLY the variable names listed below.
          DO NOT invent variable names like --color-background-base, --radius-md, --transition-base, etc.

          **Available Variables** ({len(all_token_vars)} total):
          - Color variables ({len(color_vars)}): --color-brand-primary, --color-surface-background, --color-text-primary, etc.
          - Typography variables ({len(typography_vars)}): --font-family-heading, --font-size-base, --font-weight-bold, etc.
          - Spacing variables ({len(spacing_vars)}): --spacing-0, --spacing-1, ..., --spacing-24
          - Border radius ({len(radius_vars)}): --border-radius-none, --border-radius-sm, ..., --border-radius-full
          - Shadows ({len(shadow_vars)}): --shadow-sm, --shadow-md, --shadow-lg, --shadow-xl
          - Breakpoints ({len(breakpoint_vars)}): --breakpoint-sm, --breakpoint-md, --breakpoint-lg, etc.

          **STRICT RULES**:
          1. Use ONLY the variables listed above - NO custom variable names
          2. If you need a value not in the list, use the closest semantic match
          3. For missing tokens (like transitions), use literal CSS values: `transition: all 0.2s ease;`
          4. NO hardcoded colors, fonts, or spacing (e.g., #4F46E5, 16px, Arial)
          5. All `var()` references must match exact variable names above

          ## File Write Instructions
          Generate TWO template files and WRITE them using Write() tool:

          ### File 1: HTML Template
          **Path**: {base_path}/prototypes/_templates/{target}-layout-{layout_id}.html
          **Content**: Reusable HTML structure with CSS placeholders

          ### File 2: CSS Template
          **Path**: {base_path}/prototypes/_templates/{target}-layout-{layout_id}.css
          **Content**: Structural CSS using var() for all values

          ## Write Operation Instructions
          - Use Write() tool for both files with absolute paths provided above
          - Create directory if needed: Bash('mkdir -p {base_path}/prototypes/_templates')
          - Verify each write operation succeeds

          ## Example Write Operations
          ```javascript
          Write(\"{base_path}/prototypes/_templates/{target}-layout-{layout_id}.html\", html_content)
          Write(\"{base_path}/prototypes/_templates/{target}-layout-{layout_id}.css\", css_content)
          ```

          ## Completion
          Report successful file creation for both HTML and CSS templates with path confirmation.

          🎯 **CRITICAL QUALITY GATES**:
          ✅ **ADAPTIVE**: Works on mobile (375px), tablet (768px), desktop (1024px+)
          ✅ **STYLE-SWITCHABLE**: Change {{TOKEN_CSS}} link → instant theme switching
          ✅ **TOKEN-ONLY**: 100% var() usage, inspectable with \"Search for: #|px|rem\" → 0 matches in values
          ✅ **REUSABLE**: Same HTML/CSS structure works for ALL style variants
          ✅ **FILE-WRITTEN**: Files written directly to file system, not returned as text

          **Wrapper Strategy**:
          {IF target_type == "page": Use complete HTML document structure with navigation and footer.}
          {ELSE: Use minimal wrapper with component container only.}

          DO NOT return file contents as text - write them directly using Write() tool.
        "

REPORT: "⏳ Phase 2a: Waiting for agents to complete template generation..."
```

#### Phase 2a.5: Verify Agent Template File Creation

```bash
REPORT: "📝 Phase 2a.5: Verifying agent template file creation..."

# Verify each agent created template files
FOR layout_id IN range(1, layout_variants + 1):
    FOR target IN target_list:
        html_label = f"{target}-layout-{layout_id}.html"
        css_label = f"{target}-layout-{layout_id}.css"

        html_path = f"{base_path}/prototypes/_templates/{html_label}"
        css_path = f"{base_path}/prototypes/_templates/{css_label}"

        # Verify files exist
        VERIFY: exists(html_path), f"HTML template not created by agent: {html_label}"
        VERIFY: exists(css_path), f"CSS template not created by agent: {css_label}"

        # Validate content
        TRY:
            html_content = Read(html_path)
            css_content = Read(css_path)

            # Basic validation checks
            VALIDATE: len(html_content) > 100, f"HTML template too short: {html_label}"
            VALIDATE: len(css_content) > 50, f"CSS template too short: {css_label}"
            VALIDATE: "<!DOCTYPE html>" in html_content OR "<div" in html_content, f"Invalid HTML structure: {html_label}"
            VALIDATE: "var(--" in css_content, f"Missing CSS variables: {css_label}"

            html_size = get_file_size(html_path)
            css_size = get_file_size(css_path)
            REPORT: f"   ✓ Verified: {html_label} ({html_size} KB) + {css_label} ({css_size} KB)"
        CATCH error:
            ERROR: f"Validation failed for {target}-layout-{layout_id}: {error}"
            REPORT: f"   ⚠️ Files exist but validation failed - review agent output"

REPORT: "✅ Phase 2a.5 complete: Verified {layout_variants * len(target_list) * 2} template files"
```

#### Phase 2b: Prototype Instantiation

```bash
REPORT: "🚀 Phase 2b: Instantiating prototypes from templates..."

# Step 1: Convert design tokens to CSS for each style
REPORT: "   Converting design tokens to CSS variables..."

# Check for jq dependency
IF NOT command_exists("jq"):
    ERROR: "jq is not installed or not in PATH. The conversion script requires jq."
    REPORT: "Please install jq: macOS: brew install jq | Linux: apt-get install jq | Windows: https://stedolan.github.io/jq/download/"
    EXIT 1

# Convert design tokens to CSS for each style variant
FOR style_id IN range(1, style_variants + 1):
    tokens_json_path = "{base_path}/style-consolidation/style-${style_id}/design-tokens.json"
    tokens_css_path = "{base_path}/style-consolidation/style-${style_id}/tokens.css"
    script_path = "~/.claude/scripts/convert_tokens_to_css.sh"

    # Verify input file exists
    IF NOT exists(tokens_json_path): REPORT: "   ✗ ERROR: Input file not found"; CONTINUE

    # Execute conversion: cat input.json | script.sh > output.css
    Bash(cat "${tokens_json_path}" | "${script_path}" > "${tokens_css_path}")

    # Verify output was generated
    IF exit_code == 0 AND exists(tokens_css_path):
        REPORT: "   ✓ Generated tokens.css for style-${style_id}"
    ELSE:
        REPORT: "   ✗ ERROR: Failed to generate tokens.css for style-${style_id}"

# Step 2: Use ui-instantiate-prototypes.sh script for instantiation
prototypes_dir = "{base_path}/prototypes"; targets_csv = ','.join(target_list)
session_id = --session provided ? {session_id} : "standalone"

# Execute instantiation script with target type
Bash(~/.claude/scripts/ui-instantiate-prototypes.sh "{prototypes_dir}" --session-id "{session_id}" --mode "{target_type}")

# The script auto-detects: Targets, Style variants, Layout variants
# The script generates:
# 1. S × L × T HTML prototypes with CSS links
# 2. Implementation notes for each prototype
# 3. compare.html (interactive matrix)
# 4. index.html (navigation page)
# 5. PREVIEW.md (documentation)

REPORT: "✅ Phase 2b complete: Instantiated {style_variants * layout_variants * len(target_list)} final prototypes"
REPORT: "   Mode: {target_type} | Performance: {style_variants}× faster than original approach"
```

### Phase 3: Verify Preview Files

```bash
REPORT: "🔍 Phase 3: Verifying preview files..."

expected_files = ["{base_path}/prototypes/compare.html", "{base_path}/prototypes/index.html", "{base_path}/prototypes/PREVIEW.md"]

all_present = true
FOR file_path IN expected_files:
    IF exists(file_path): REPORT: "   ✓ Found: {basename(file_path)}"
    ELSE: REPORT: "   ✗ Missing: {basename(file_path)}"; all_present = false

IF all_present: REPORT: "✅ Phase 3 complete: All preview files verified"
ELSE: WARN: "⚠️ Some preview files missing - script may have failed"

# Optional: Generate fallback design-tokens.css for reference
fallback_css_path = "{base_path}/prototypes/design-tokens.css"
IF NOT exists(fallback_css_path):
    Write(fallback_css_path, "/* Auto-generated fallback CSS custom properties */\n/* See style-consolidation/style-{n}/tokens.css for actual values */")
    REPORT: "   ✓ Generated fallback design-tokens.css"
```

### Phase 3.5: Cross-Target Consistency Validation

**Condition**: Only executes if `len(target_list) > 1 AND target_type == "page"`

```bash
# Skip if single target or component mode
IF len(target_list) <= 1 OR target_type == "component": SKIP to Phase 4

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
          STYLE_ID: {style_id} | LAYOUT_ID: {layout_id} | TARGETS: {target_list} | TARGET_TYPE: {target_type}
          BASE_PATH: {base_path}

          ## Input Files
          FOR each target: {base_path}/prototypes/{target}-style-{style_id}-layout-{layout_id}.html/css

          ## Validation Tasks
          1. **Shared Component Consistency**: Check header/nav/footer structure matches
          2. **Token Usage Consistency**: Verify same design-tokens file, no hardcoded values
          3. **Accessibility Consistency**: ARIA attributes, heading hierarchy, landmark roles
          4. **Layout Strategy Adherence**: Layout-{layout_id} strategy applied consistently

          ## Output
          Generate consistency report markdown file at:
          {base_path}/prototypes/consistency-report-s{style_id}-l{layout_id}.md

          Include validation results, issues found, and recommendations.
          Focus on truly shared elements. Page-specific content variations are acceptable.
        "

# Aggregate consistency reports
Write({base_path}/prototypes/CONSISTENCY_SUMMARY.md):
# Multi-{target_type.capitalize()} Consistency Summary

## Validated Combinations
- Style Variants: {style_variants} | Layout Variants: {layout_variants}
- Total Reports: {style_variants * layout_variants}

## Report Files
{FOR s, l: - [Style {s} Layout {l}](./consistency-report-s{s}-l{l}.md)}

Run `/workflow:ui-design:update` once all issues are resolved.
```

### Phase 4: Completion

```javascript
TodoWrite({todos: [
  {content: "Resolve paths and load design systems", status: "completed", activeForm: "Loading design systems"},
  {content: `Plan ${target_list.length}×${layout_variants} target-specific layouts`, status: "completed", activeForm: "Planning layouts"},
  {content: "Extract design token variable names", status: "completed", activeForm: "Extracting token variables"},
  {content: `Generate ${layout_variants}×${target_list.length} layout templates using target-specific plans`, status: "completed", activeForm: "Generating templates"},
  {content: "Convert design tokens to CSS variables", status: "completed", activeForm: "Converting tokens"},
  {content: `Instantiate ${style_variants}×${layout_variants}×${target_list.length} prototypes using script`, status: "completed", activeForm: "Running script"},
  {content: "Verify preview files generation", status: "completed", activeForm: "Verifying files"}
]});
```

**Completion Message**:
```
✅ Optimized Matrix UI generation complete!

Configuration:
- Style Variants: {style_variants}
- Layout Variants: {layout_variants} (target-specific planning)
- Target Type: {target_type_icon} {target_type}
- Targets: {target_list}
- Total Prototypes: {style_variants * layout_variants * len(target_list)}
- Layout Plans: {len(target_list) × layout_variants} target-specific JSON files generated

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
│   ├── {target}-layout-{l}.json ({len(target_list) × layout_variants} layout plans)
│   ├── {target}-layout-{l}.html ({layout_variants * len(target_list)} HTML templates)
│   └── {target}-layout-{l}.css ({layout_variants * len(target_list)} CSS templates)
├── {target}-style-{s}-layout-{l}.html ({style_variants * layout_variants * len(target_list)} final prototypes)
├── {target}-style-{s}-layout-{l}-notes.md
├── compare.html (interactive matrix visualization)
└── index.html (quick navigation)

🌐 Interactive Preview:
1. Matrix View: Open compare.html (recommended)
2. Quick Index: Open index.html
3. Instructions: See PREVIEW.md

{IF target_type == "component": Note: Components are rendered with minimal wrapper for isolated comparison.}

Next: /workflow:ui-design:update {--session flag if applicable}

Note: When called from /workflow:ui-design:auto, design-update is triggered automatically.

**Dynamic Values**: target_type_icon: "📄" for page, "🧩" for component
```

## Output Structure

```
{base_path}/prototypes/
├── _templates/                            # Target-specific layout plans and templates
│   ├── {target}-layout-1.json            # Layout plan JSON (target-specific)
│   ├── {target}-layout-1.html            # Style-agnostic HTML structure
│   ├── {target}-layout-1.css             # Structural CSS with var() references
│   └── ... (T × L layout plans + templates)
├── compare.html                           # Interactive matrix visualization
├── index.html                             # Simple navigation page
├── PREVIEW.md                             # Preview instructions
├── design-tokens.css                      # CSS custom properties fallback
├── {target}-style-{s}-layout-{l}.html    # Final prototypes (copied from templates)
├── {target}-style-{s}-layout-{l}-notes.md  # Implementation notes
└── ... (S × L × T total final files)

{base_path}/style-consolidation/
├── style-1/ (design-tokens.json, tokens.css, style-guide.md)
├── style-2/ (same structure)
└── ...
```

## Error Handling

### Pre-execution Checks
- **No design systems found**: Error - Run `/workflow:ui-design:consolidate` first
- **Invalid target names**: Extract from synthesis-specification.md or error with validation message
- **Missing templates directory**: Auto-created in Phase 1.5
- **Unsupported target type**: Error if target_type not in ["page", "component"]
- **Layout planning failures**: Check Phase 1.5 agent outputs for errors

### Phase-Specific Errors
- **Agent execution errors (Phase 2a)**: Report details, suggest retry with specific phase
- **Token conversion errors (Phase 2b)**: Check design-tokens.json format, validate JSON schema
- **Script execution errors (Phase 2b)**: Check script exists, permissions, output for specific errors
- **Preview generation errors (Phase 3)**: Check script completed, verify template exists, review Phase 2b output

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

1. **Target-Specific Layout Planning** 🆕 - Each target gets custom-designed layouts; Agent researches modern patterns using MCP tools; Layout plans saved as structured JSON
2. **Unified Target Generation** - Supports both pages (full layouts) and components (isolated elements); Backward compatible with legacy `--pages` parameter
3. **Optimized Template-Based Architecture** - Generates `L × T` reusable templates plus `L × T` layout plans; **`S` times faster**
4. **Three-Layer Generation Strategy** - Layer 1: Layout planning (target-specific); Layer 2: Template generation (implements plans); Layer 3: Fast instantiation; Agent autonomously uses MCP tools
5. **Script-Based Instantiation (v3.0)** - Uses `ui-instantiate-prototypes.sh` for efficient file operations; Auto-detection; Robust error handling; Integrated preview generation; Supports both page and component modes
6. **Consistent Cross-Style Layouts** - Same layout structure applied uniformly; Easier to compare styles; Simplified maintenance
7. **Dynamic Style Injection** - CSS custom properties enable runtime style switching; Each style variant has its own `tokens.css` file
8. **Interactive Visualization** - Full-featured compare.html; Matrix grid view with synchronized scrolling; Enhanced index.html with statistics; Comprehensive PREVIEW.md
9. **Production-Ready Output** - Semantic HTML5 and ARIA attributes (WCAG 2.2); Mobile-first responsive design; Token-driven styling; Implementation notes

## Integration Points

- **Input**: Per-style `design-tokens.json` from `/workflow:ui-design:consolidate`; `--targets` and `--layout-variants` parameters; Optional: `synthesis-specification.md` for target requirements; Target type specification
- **Output**: Target-specific `layout-{n}.json` files; Matrix HTML/CSS prototypes for `/workflow:ui-design:update`
- **Template**: `~/.claude/workflows/_template-compare-matrix.html` (global)
- **Auto Integration**: Automatically triggered by `/workflow:ui-design:explore-auto` workflow
- **Key Change**: Layout planning moved from consolidate to generate phase; Each target gets custom-designed layouts
- **Backward Compatibility**: Legacy `--pages` parameter continues to work
