---
name: generate-v2
description: Generate UI prototypes using target-style-centric batch generation
usage: /workflow:ui-design:generate-v2 [--targets "<list>"] [--target-type "page|component"] [--base-path <path>] [--session <id>] [--style-variants <count>] [--layout-variants <count>]
examples:
  - /workflow:ui-design:generate-v2 --session WFS-auth --targets "dashboard,settings" --style-variants 3 --layout-variants 3
  - /workflow:ui-design:generate-v2 --base-path ".workflow/WFS-auth/design-run-20250109-143022" --targets "home,pricing"
  - /workflow:ui-design:generate-v2 --targets "navbar,hero,card" --target-type "component" --style-variants 2 --layout-variants 2
allowed-tools: TodoWrite(*), Read(*), Write(*), Task(ui-design-agent), Bash(*)
---

# UI Generation Command (Target-Style-Centric Architecture)

**Executor**: → @ui-design-agent
**Parallel Generation**: Phase 2 → @ui-design-agent (T×S tasks, each handling L layouts)

## Overview
Generate production-ready UI prototypes (HTML/CSS) using **target-style-centric batch generation**. Each agent handles all layout variants for one target × one style combination, ensuring component isolation and focused generation.

## Core Philosophy
- **Target-Style-Centric**: Each of T×S agents generates L layouts for one target × one style
- **Component Isolation**: Tasks completely independent, preventing cross-component interference
- **Style-Aware Structure**: HTML DOM adapts based on design_attributes (density, visual_weight, etc.)
- **Performance Optimized**: T×S agent calls with highly focused scope per agent
- **Layout Inspiration**: Simple text-based research replaces complex JSON planning
- **Self-Contained CSS**: Agent reads design-tokens.json and creates independent CSS (no token.css reference)
- **Production-Ready**: Semantic HTML5, ARIA attributes, responsive design

## Execution Protocol

### Phase 1: Path Resolution & Context Loading
```bash
# 1. Determine base path
IF --base-path: base_path = {provided_base_path}
ELSE IF --session: base_path = find_latest_path_matching(".workflow/WFS-{session}/design-*")
ELSE: base_path = find_latest_path_matching(".workflow/.design/*")

# 2. Determine style variant count and layout variant count
style_variants = --style-variants OR auto_detect_from_consolidation()
layout_variants = --layout-variants OR 3
VALIDATE: 1 <= style_variants <= 5
VALIDATE: 1 <= layout_variants <= 5

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

# 6. Load design space analysis (for style-aware generation)
design_space_path = "{base_path}/style-extraction/design-space-analysis.json"
IF exists(design_space_path):
    design_space_analysis = Read(design_space_path)
    REPORT: "📊 Loaded design space analysis with style attributes"
ELSE:
    WARN: "⚠️ No design space analysis found - will use basic style generation"
    design_space_analysis = null

# 7. Load requirements (if integrated mode)
IF --session:
    synthesis_spec = Read(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md)
ELSE:
    synthesis_spec = null
```

### Phase 1.2: Token源智能检测

```bash
REPORT: "🔍 Phase 1.2: Detecting token sources for {style_variants} style(s)..."

token_sources = {}  # {style_id: {path: str, quality: str, source: str}}
consolidated_count = 0
proposed_count = 0

FOR style_id IN range(1, style_variants + 1):
    # 优先级1：Consolidated tokens（完整refinement from consolidate command）
    consolidated_path = "{base_path}/style-consolidation/style-{style_id}/design-tokens.json"

    IF exists(consolidated_path):
        token_sources[style_id] = {
            "path": consolidated_path,
            "quality": "consolidated",
            "source": "consolidate command"
        }
        consolidated_count += 1
        REPORT: "  ✓ Style-{style_id}: Using consolidated tokens (production-ready)"
        CONTINUE

    # 优先级2：Proposed tokens from style-cards.json（fast-track from extract command）
    style_cards_path = "{base_path}/style-extraction/style-cards.json"

    IF exists(style_cards_path):
        # 读取style-cards.json
        style_cards_data = Read(style_cards_path)

        # 验证variant index有效
        IF style_id <= len(style_cards_data.style_cards):
            variant_index = style_id - 1
            variant = style_cards_data.style_cards[variant_index]
            proposed_tokens = variant.proposed_tokens

            # 创建临时consolidation目录（兼容现有逻辑）
            temp_consolidation_dir = "{base_path}/style-consolidation/style-{style_id}"
            Bash(mkdir -p "{temp_consolidation_dir}")

            # 写入proposed tokens（Fast Token Adaptation）
            temp_tokens_path = "{temp_consolidation_dir}/design-tokens.json"
            Write(temp_tokens_path, JSON.stringify(proposed_tokens, null, 2))

            # 创建简化style guide（可选but recommended）
            simple_guide_content = f"""# Design System: {variant.name}

## Design Philosophy
{variant.design_philosophy}

## Description
{variant.description}

## Design Tokens
Complete token specification in `design-tokens.json`.

**Note**: Using proposed tokens from extraction phase (fast-track mode).
For production-ready refinement with philosophy-driven token generation, run `/workflow:ui-design:consolidate` first.

## Color Preview
- Primary: {variant.preview.primary if variant.preview else "N/A"}
- Background: {variant.preview.background if variant.preview else "N/A"}

## Typography Preview
- Heading Font: {variant.preview.font_heading if variant.preview else "N/A"}
- Border Radius: {variant.preview.border_radius if variant.preview else "N/A"}
"""

            Write("{temp_consolidation_dir}/style-guide.md", simple_guide_content)

            token_sources[style_id] = {
                "path": temp_tokens_path,
                "quality": "proposed",
                "source": "extract command (fast adaptation)"
            }
            proposed_count += 1

            REPORT: "  ✓ Style-{style_id}: Using proposed tokens (fast-track)"
            REPORT: "     Source: {variant.name} from style-cards.json"
            WARN: "     ⚠️ Tokens not refined - for production quality, run consolidate first"
            CONTINUE
        ELSE:
            ERROR: "style-cards.json exists but does not contain variant {style_id}"
            ERROR: "  style-cards.json has {len(style_cards_data.style_cards)} variants, but requested style-{style_id}"
            SUGGEST: "  Reduce --style-variants to {len(style_cards_data.style_cards)} or run extract with more variants"
            EXIT 1

    # 优先级3：错误处理（无可用token源）
    ERROR: "No token source found for style-{style_id}"
    ERROR: "  Expected either:"
    ERROR: "    1. {consolidated_path} (from /workflow:ui-design:consolidate)"
    ERROR: "    2. {style_cards_path} (from /workflow:ui-design:extract)"
    ERROR: ""
    SUGGEST: "Run one of the following commands first:"
    SUGGEST: "  - /workflow:ui-design:extract --base-path \"{base_path}\" --images \"refs/*.png\" --variants {style_variants}"
    SUGGEST: "  - /workflow:ui-design:consolidate --base-path \"{base_path}\" --variants {style_variants}"
    EXIT 1

# 汇总报告Token sources
REPORT: ""
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "📊 Token Source Summary:"
REPORT: "  Total style variants: {style_variants}"
REPORT: "  Consolidated (production-ready): {consolidated_count}/{style_variants}"
REPORT: "  Proposed (fast-track): {proposed_count}/{style_variants}"

IF proposed_count > 0:
    REPORT: ""
    REPORT: "💡 Production Quality Tip:"
    REPORT: "   Fast-track mode is active for {proposed_count} style(s) using proposed tokens."
    REPORT: "   For production-ready quality with philosophy-driven refinement:"
    REPORT: "   /workflow:ui-design:consolidate --base-path \"{base_path}\" --variants {style_variants}"
    REPORT: ""
    REPORT: "   Benefits of consolidate:"
    REPORT: "   • Philosophy-driven token refinement"
    REPORT: "   • WCAG AA accessibility validation"
    REPORT: "   • Complete design system documentation"
    REPORT: "   • Token gap filling and consistency checks"

REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Store token_sources for use in Phase 2
STORE: token_sources, consolidated_count, proposed_count
```

### Phase 1.5: Target Layout Inspiration
```bash
REPORT: "💡 Gathering layout inspiration for {len(target_list)} targets..."

CREATE: {base_path}/prototypes/_inspirations/

# For each target, gather layout inspiration via MCP search
FOR target IN target_list:
    REPORT: "  Researching '{target}' ({target_type}) layout patterns..."

    # MCP search for layout patterns
    search_query = f"common {target} {target_type} layout patterns variations best practices"
    search_results = mcp__exa__web_search_exa(
        query=search_query,
        numResults=5
    )

    # Extract key layout patterns from search results
    inspiration_content = f"""Layout Inspiration for '{target}' ({target_type})
Generated: {current_timestamp()}
Search Query: {search_query}

## Layout Patterns Identified

From web research, {layout_variants} distinct layout approaches:

Layout 1: [First structural pattern identified from search]
- Key characteristics: ...
- Structure approach: ...

Layout 2: [Second structural pattern]
- Key characteristics: ...
- Structure approach: ...

Layout 3: [Third structural pattern]
- Key characteristics: ...
- Structure approach: ...

## Reference Links
{format_search_results_urls(search_results)}

## Implementation Notes
- Each layout should be STRUCTURALLY DIFFERENT (not just CSS variations)
- Consider {target_type}-specific patterns (navigation, content areas, interactions)
- Adapt structure based on design_attributes in Phase 2
"""

    # Write simple inspiration file
    inspiration_file = f"{base_path}/prototypes/_inspirations/{target}-layout-ideas.txt"
    Write(inspiration_file, inspiration_content)

    REPORT: f"   ✓ Created: {target}-layout-ideas.txt"

REPORT: f"✅ Phase 1.5 complete: Gathered inspiration for {len(target_list)} targets"
```

### Phase 2: Target-Style-Centric Batch Generation

**Strategy**: T×S target-style-centric agents, each generating L layouts for one target × one style.
**Performance**: T×S agent calls with component isolation

```bash
REPORT: "🎨 Phase 2: Launching {len(target_list)}×{style_variants}={len(target_list) * style_variants} target-style agents..."
REPORT: "   Each agent generates {layout_variants} layouts for one component"

CREATE: {base_path}/prototypes/

# Launch ONE agent task PER TARGET × STYLE combination (parallel execution)
FOR target IN target_list:
    # Load layout inspiration for this target
    inspiration_path = f"{base_path}/prototypes/_inspirations/{target}-layout-ideas.txt"

    FOR style_id IN range(1, style_variants + 1):
        # Load style-specific context
        style_tokens_path = f"{base_path}/style-consolidation/style-{style_id}/design-tokens.json"
        style_guide_path = f"{base_path}/style-consolidation/style-{style_id}/style-guide.md"

        # Extract design attributes for this style (if available)
        IF design_space_analysis AND style_id <= len(design_space_analysis.divergent_directions):
            design_attributes = design_space_analysis.divergent_directions[style_id - 1]
            philosophy_name = design_attributes.philosophy_name
            attributes_summary = JSON.stringify({
                density: design_attributes.design_attributes.density,
                visual_weight: design_attributes.design_attributes.visual_weight,
                formality: design_attributes.design_attributes.formality,
                organic_vs_geometric: design_attributes.design_attributes.organic_vs_geometric,
                innovation: design_attributes.design_attributes.innovation
            })
        ELSE:
            design_attributes = null
            philosophy_name = f"Style {style_id}"
            attributes_summary = "No design attributes available"

        Task(ui-design-agent): """
          [TARGET_STYLE_UI_GENERATION]

          ## 🎯 Mission
          Generate {layout_variants} layout variants for: {target} × Style-{style_id} ({philosophy_name})
          Output: {layout_variants × 2} files ({layout_variants} HTML + {layout_variants} CSS)

          ## 🎨 Style Context
          PHILOSOPHY: {philosophy_name}
          {IF design_attributes:
          DESIGN_ATTRIBUTES: {attributes_summary}
          Key impacts:
          - density → DOM nesting depth, whitespace scale
          - visual_weight → wrapper layers, border/shadow strength
          - formality → semantic structure choices
          - organic_vs_geometric → alignment, edge treatment
          - innovation → layout adventurousness
          }

          ## 📂 Input Resources
          **Design System**:
          - Design Tokens (JSON): {style_tokens_path}
          - Style Guide: {style_guide_path}

          **Layout Inspiration**: {inspiration_path}
          Contains {layout_variants} distinct structural patterns

          **Target**: {target} ({target_type})

          ## 🔄 Generation Steps (for each layout 1..{layout_variants})

          **1. Read Inspiration**
          - Load: {inspiration_path}
          - Apply layout N pattern

          **2. Read Design Tokens**
          - Load: {style_tokens_path}
          - Parse JSON structure and extract all design token values
          - Understand token categories: colors, typography, spacing, shadows, borders, etc.

          **3. Generate HTML Structure**
          - Complete HTML5 document (<!DOCTYPE>, <html>, <head>, <body>)
          - Semantic elements: <header>, <nav>, <main>, <section>, <article>, <footer>
          - ARIA attributes: aria-label, role, aria-labelledby
          - Responsive meta: <meta name="viewport" content="width=device-width, initial-scale=1">
          - Include CSS reference: <link rel="stylesheet" href="{target}-style-{style_id}-layout-N.css">
          - Example: For dashboard-style-1-layout-2.html, use <link rel="stylesheet" href="dashboard-style-1-layout-2.css">

          {IF design_attributes:
          **⚠️ Adapt DOM based on design_attributes:**
          - density='spacious' → Flatter hierarchy
            Example: <main><section class="card"></section></main>
          - density='compact' → Deeper nesting
            Example: <main><div class="grid"><div class="card-wrapper"><section></section></div></div></main>
          - visual_weight='heavy' → Extra wrapper divs for layered effects
            Example: <div class="border-container"><div class="content-wrapper">...</div></div>
          - visual_weight='minimal' → Direct structure, minimal wrappers
            Example: <section class="card">...</section>
          - organic_vs_geometric → Affects alignment patterns and edge structure
          }

          **4. Generate Self-Contained CSS**
          ⚠️ Use design token values DIRECTLY from step 2 - create complete, independent CSS

          **Required Token Usage** (from design-tokens.json):
          - Colors: Use color values for backgrounds, text, borders
          - Typography: Use font-family, font-size, font-weight, line-height values
          - Spacing: Use spacing scale for margins, padding, gaps
          - Borders: Use border-radius, border-width values
          - Shadows: Use box-shadow values
          - Breakpoints: Use breakpoint values for @media queries

          {IF design_attributes:
          **Apply design_attributes to token selection:**
          - density='spacious' → Select larger spacing tokens
          - density='compact' → Select smaller spacing tokens
          - visual_weight='heavy' → Use stronger shadows, add borders
          - visual_weight='minimal' → Use subtle/no shadows
          - formality → Affects typography choices and structure
          - organic_vs_geometric → Affects border-radius and alignment
          }

          **CSS Structure**:
          - Complete styling: colors, typography, layout, spacing, effects
          - Responsive design: Mobile-first with breakpoint-based @media
          - Self-contained: No external dependencies or var() references

          **5. Write Files IMMEDIATELY**
          - Output paths:
            - HTML: {base_path}/prototypes/{target}-style-{style_id}-layout-N.html
            - CSS: {base_path}/prototypes/{target}-style-{style_id}-layout-N.css
          - Write after generating each layout (do NOT accumulate)
          - Do NOT return content as text

          ## ✅ Success Criteria
          - [ ] Generated exactly {layout_variants × 2} files
          - [ ] All HTML includes correct CSS file reference (matching filename pattern)
          - [ ] All CSS uses design token values directly (self-contained, no var() references)
          - [ ] CSS fully embodies the style's design tokens (colors, typography, spacing, effects)
          - [ ] {IF design_attributes: 'HTML structure adapts to design_attributes' ELSE: 'HTML follows layout inspiration'}
          - [ ] Layouts are structurally distinct (different grids/regions, not just CSS tweaks)
          - [ ] Files written to filesystem (not returned as text)

          ## 📋 Completion
          Report: "✅ {target} × Style-{style_id} ({philosophy_name}): {layout_variants × 2} files created"
        """

REPORT: "⏳ Phase 2: Waiting for {len(target_list) * style_variants} target-style agents to complete..."
REPORT: "   Expected total files: {style_variants × layout_variants × len(target_list) × 2}"
```

### Phase 2.5: Verify Agent File Creation
```bash
REPORT: "📝 Phase 2.5: Verifying target-style generation..."

total_expected = style_variants × layout_variants × len(target_list) × 2
total_found = 0

FOR target IN target_list:
    FOR style_id IN range(1, style_variants + 1):
        agent_files_found = 0

        FOR layout_id IN range(1, layout_variants + 1):
            html_file = f"{target}-style-{style_id}-layout-{layout_id}.html"
            css_file = f"{target}-style-{style_id}-layout-{layout_id}.css"

            html_path = f"{base_path}/prototypes/{html_file}"
            css_path = f"{base_path}/prototypes/{css_file}"

            # Verify files exist
            IF exists(html_path) AND exists(css_path):
                # Validate content
                html_content = Read(html_path)
                css_content = Read(css_path)

                # Basic validation
                VALIDATE: "<!DOCTYPE html>" in html_content, f"Invalid HTML: {html_file}"
                VALIDATE: f'href="{css_file}"' in html_content, f"Missing or incorrect CSS reference in: {html_file}"
                VALIDATE: len(css_content) > 100, f"CSS file too small (likely incomplete): {css_file}"

                html_size = get_file_size(html_path)
                css_size = get_file_size(css_path)

                agent_files_found += 2
                total_found += 2

                REPORT: f"   ✓ {html_file} ({html_size} KB) + {css_file} ({css_size} KB)"
            ELSE:
                ERROR: f"   ✗ Missing files: {target}-style-{style_id}-layout-{layout_id}.*"

        REPORT: f"  {target} × style-{style_id}: {agent_files_found}/{layout_variants * 2} files verified"

IF total_found == total_expected:
    REPORT: f"✅ Phase 2.5 complete: Verified all {total_expected} files"
ELSE:
    ERROR: f"⚠️ Only {total_found}/{total_expected} files found - some agents may have failed"
```

### Phase 3: Generate Preview Files

```bash
REPORT: "🌐 Phase 3: Generating preview files..."

prototypes_dir = f"{base_path}/prototypes"

# Template-based preview generation script
# - Uses: ~/.claude/workflows/_template-compare-matrix.html
# - Auto-detects: S, L, T from file patterns
# - Generates: compare.html, index.html, PREVIEW.md
Bash(~/.claude/scripts/ui-generate-preview-v2.sh "{prototypes_dir}")

# Verify preview files generated
preview_files = [
    f"{base_path}/prototypes/compare.html",
    f"{base_path}/prototypes/index.html",
    f"{base_path}/prototypes/PREVIEW.md"
]

all_present = True
FOR file_path IN preview_files:
    IF exists(file_path):
        REPORT: f"   ✓ Generated: {basename(file_path)}"
    ELSE:
        WARN: f"   ✗ Missing: {basename(file_path)}"
        all_present = False

IF all_present:
    REPORT: "✅ Phase 3 complete: All preview files generated"
ELSE:
    WARN: "⚠️ Some preview files missing - script may need attention"
```

### Phase 4: Completion

```javascript
TodoWrite({todos: [
  {content: "Resolve paths and load design systems", status: "completed", activeForm: "Loading design systems"},
  {content: `Gather layout inspiration for ${target_list.length} targets`, status: "completed", activeForm: "Gathering inspiration"},
  {content: `Launch ${target_list.length}×${style_variants}=${target_list.length * style_variants} target-style agents (each handling ${layout_variants} layouts)`, status: "completed", activeForm: "Running target-style generation"},
  {content: `Verify ${style_variants * layout_variants * target_list.length * 2} generated files`, status: "completed", activeForm: "Verifying files"},
  {content: "Generate preview files (compare.html, index.html)", status: "completed", activeForm: "Generating previews"}
]});
```

**Completion Message**:
```
✅ Target-Style-Centric UI Generation Complete!

Architecture: Target-Style-Centric Batch Generation

Configuration:
- Style Variants: {style_variants}
- Layout Variants: {layout_variants} (inspiration-based)
- Target Type: {target_type_icon} {target_type}
- Targets: {target_list}
- Total Prototypes: {style_variants * layout_variants * len(target_list)}

Agent Execution:
✅ Target-style agents: T×S = {len(target_list)}×{style_variants} = {len(target_list) * style_variants} agents
✅ Each agent handles: L = {layout_variants} layouts for one component
✅ Component isolation: Tasks completely independent

Design Quality:
✅ Style-Aware Structure: {IF design_space_analysis: 'YES - HTML adapts to design_attributes' ELSE: 'Standard semantic structure'}
✅ Focused generation: Each agent handles single target × single style
✅ Self-Contained CSS: Direct design token usage (no var() dependencies)
✅ Token Quality: {consolidated_count} consolidated, {proposed_count} proposed
{IF proposed_count > 0:
   ℹ️ Fast-track mode active: {proposed_count} style(s) using proposed tokens
   💡 For production quality: /workflow:ui-design:consolidate --base-path "{base_path}" --variants {style_variants}
}

Output Files:
- Layout Inspirations: {len(target_list)} simple text files
- HTML Prototypes: {style_variants * layout_variants * len(target_list)} files
- CSS Files: {style_variants * layout_variants * len(target_list)} files
- Preview Files: compare.html, index.html, PREVIEW.md

Generated Structure:
📂 {base_path}/prototypes/
├── _inspirations/
│   └── {target}-layout-ideas.txt ({len(target_list)} inspiration files)
├── {target}-style-{s}-layout-{l}.html ({style_variants * layout_variants * len(target_list)} prototypes)
├── {target}-style-{s}-layout-{l}.css
├── compare.html (interactive S×L×T matrix)
├── index.html (quick navigation)
└── PREVIEW.md (usage instructions)

🌐 Interactive Preview:
1. Matrix View: Open compare.html (recommended)
2. Quick Index: Open index.html
3. Instructions: See PREVIEW.md

{IF design_space_analysis:
🎨 Style-Aware Generation Active:
Each style's prototypes use structure adapted to design_attributes:
- Density affects container nesting and whitespace
- Visual weight affects wrapper layers and border structure
- Same layout × same target × different style = DIFFERENT HTML trees!
}

Next: /workflow:ui-design:update {--session flag if applicable}

Note: When called from /workflow:ui-design:explore-auto, design-update is triggered automatically.

**Dynamic Values**: target_type_icon: "📄" for page, "🧩" for component
```

## Output Structure

```
{base_path}/prototypes/
├── _inspirations/                                 # Layout inspiration only
│   └── {target}-layout-ideas.txt                 # Simple inspiration text
├── {target}-style-{s}-layout-{l}.html            # Final prototypes (S×L×T)
├── {target}-style-{s}-layout-{l}.css
├── compare.html                                   # Interactive matrix
├── index.html                                     # Navigation page
└── PREVIEW.md                                     # Instructions

{base_path}/style-consolidation/
├── style-1/ (design-tokens.json, style-guide.md)
├── style-2/ (same structure)
└── style-{S}/ (same structure)
```

## Error Handling

### Pre-execution Checks
- **No design systems found**: Error - Run `/workflow:ui-design:consolidate` first
- **Invalid target names**: Extract from synthesis-specification.md or error with validation message
- **Missing design-space-analysis.json**: WARN only - generation continues with basic structure
- **Unsupported target type**: Error if target_type not in ["page", "component"]

### Phase-Specific Errors
- **Agent execution errors (Phase 2)**: Report details, identify which target × style agent failed
- **Invalid design-tokens.json**: Check JSON format and structure
- **Missing files (Phase 2.5)**: Indicates agent failed to write - review agent output logs
- **MCP search errors (Phase 1.5)**: Check network connectivity, retry search
- **Preview generation errors (Phase 3)**: Check script exists, permissions

### Recovery Strategies
- **Partial generation**: If some target-style agents succeed, you still have those prototypes
- **Retry single combination**: Can re-run targeting failed target × style combination
- **Missing design_attributes**: Generation works without them - just less style-aware
- **Permission errors**: Run `chmod +x ~/.claude/scripts/ui-generate-preview-v2.sh`

## Key Features

1. **🚀 Target-Style-Centric Batch Generation**
   Each agent handles L layouts for one target × one style with component isolation

2. **🎯 Component Isolation**
   Tasks completely independent, preventing cross-component interference

3. **🎨 Style-Aware Structure Adaptation**
   HTML DOM adapts based on design_attributes (density, visual_weight, organic_vs_geometric)

4. **⚡ Performance Optimized**
   Parallel execution of T×S agents with highly focused scope per agent

5. **💡 Simplified Layout Inspiration**
   Simple text-based research replaces complex JSON planning

6. **🔧 Focused Agent Scope**
   Each agent generates only L layouts, reducing complexity and improving quality

7. **🎯 Self-Contained CSS Generation**
   Agents read design-tokens.json and create independent CSS with direct token values (no var() references)

8. **🌐 Interactive Visualization**
   Full-featured compare.html with matrix grid

9. **✅ Production-Ready Output**
   Semantic HTML5, ARIA attributes, WCAG 2.2 compliant

## Integration Points

- **Input**: Per-style design-tokens.json; design-space-analysis.json (optional); targets + layout-variants
- **Output**: S×L×T HTML/CSS prototypes with self-contained styling for `/workflow:ui-design:update`
- **Auto Integration**: Triggered by `/workflow:ui-design:explore-auto`
- **Backward Compatibility**: Works without design-space-analysis.json
