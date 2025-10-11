---
name: batch-generate
description: Batch generate UI prototypes based on prompt and style/layout information from other commands
usage: /workflow:ui-design:batch-generate --prompt "<description>" [--base-path <path>] [--session <id>] [--targets "<list>"] [--target-type "page|component"] [--style-variants <count>] [--layout-variants <count>]
examples:
  - /workflow:ui-design:batch-generate --prompt "Create modern dashboard with cards and charts" --style-variants 3 --layout-variants 2
  - /workflow:ui-design:batch-generate --prompt "E-commerce product listing page" --base-path ".workflow/.design/run-20250110-120000"
  - /workflow:ui-design:batch-generate --prompt "Generate auth pages: login, signup, reset password" --session WFS-auth
  - /workflow:ui-design:batch-generate --prompt "Create navbar, hero, and footer components" --target-type "component" --targets "navbar,hero,footer"
allowed-tools: TodoWrite(*), Read(*), Write(*), Task(ui-design-agent), Bash(*), Glob(*), mcp__exa__web_search_exa(*)
---

# Batch Generate UI Prototypes Command

**Executor**: Main orchestrator → @ui-design-agent (T×S parallel tasks)

## Overview

Batch generate production-ready UI prototypes (HTML/CSS) based on user prompt and existing style/layout information. This command intelligently discovers available design tokens and generates prototypes using **Target-Style-Centric** architecture for optimal component isolation.

## Core Philosophy

- **Prompt-Driven Generation**: User describes what to build, command infers targets and requirements
- **Smart Token Discovery**: Auto-detects consolidated or proposed tokens from previous commands
- **Target-Style-Centric**: Each of T×S agents generates L layouts for one target × one style
- **Parallel Batch Execution**: Automatic task batching with max 6 concurrent agents for optimal throughput
- **Progress Tracking**: TodoWrite shows batch-by-batch progress with clear visibility
- **Component Isolation**: Tasks completely independent, preventing cross-component interference
- **Style-Aware Structure**: HTML DOM adapts based on design_attributes (if available)
- **Flexible Integration**: Works with consolidate, extract, or other workflow outputs
- **Production-Ready**: Semantic HTML5, ARIA attributes, responsive design
- **Scalable**: Handles 1-30+ tasks efficiently with automatic batching

## Input Parameters

### Required Parameters

**--prompt** `"<description>"`
- User's description of what to generate
- Used to infer targets, understand requirements, and guide generation
- Examples:
  - `"Create dashboard with metrics cards and charts"`
  - `"Generate authentication pages: login and signup"`
  - `"Build navbar, hero section, and footer components"`

### Optional Parameters

**--base-path** `<path>`
- Path to design run directory containing style information
- If omitted: Auto-detects latest design run from `.workflow/.design/*` or session directory
- Example: `.workflow/WFS-auth/design-run-20250110-120000`

**--session** `<id>`
- Workflow session ID (e.g., `WFS-auth`)
- If provided: Searches for design runs in `.workflow/WFS-{session}/design-*`
- Enables integration with session brainstorming artifacts

**--targets** `"<list>"`
- Comma-separated list of targets to generate
- If omitted: Extracted from prompt using intelligent parsing
- Examples: `"home,dashboard,settings"` or `"navbar,hero,card"`

**--target-type** `"page|component"`
- Type of targets to generate
- `page`: Full-page layouts with complete structure
- `component`: Isolated UI elements with minimal wrapper
- If omitted: Auto-detected from target names

**--style-variants** `<count>`
- Number of style variants to generate (1-5)
- If omitted: Auto-detected from available style directories
- Default: All available styles in consolidation or extraction directory

**--layout-variants** `<count>`
- Number of layout variants per target × style (1-5)
- If omitted: Default = 3
- Each layout should be structurally different

## Execution Protocol

### Phase 0: Initialization

```javascript
TodoWrite({todos: [
  {content: "Initialize and parse user prompt", status: "in_progress", activeForm: "Initializing"},
  {content: "Load style information and validate token sources", status: "pending", activeForm: "Loading styles"},
  {content: "Gather layout inspiration via MCP search", status: "pending", activeForm: "Gathering inspiration"},
  {content: "Launch T×S target-style agents for batch generation", status: "pending", activeForm: "Generating prototypes"},
  {content: "Verify all generated files", status: "pending", activeForm: "Verifying files"},
  {content: "Generate comparison files (compare.html, index.html)", status: "pending", activeForm: "Generating previews"}
]});
```

**Base Path Resolution**:
```bash
# Priority 1: Explicit --base-path
IF --base-path:
    base_path = {provided_base_path}
    VERIFY: exists(base_path), "Base path does not exist"

# Priority 2: Session-based discovery
ELSE IF --session:
    candidate_paths = Glob(".workflow/WFS-{session}/design-*")
    candidate_paths.sort_by_modification_time(descending)
    base_path = candidate_paths[0]
    VERIFY: base_path, "No design runs found for session {session}"
    REPORT: "📁 Auto-detected session design run: {base_path}"

# Priority 3: Latest design run
ELSE:
    candidate_paths = Glob(".workflow/.design/run-*")
    candidate_paths.sort_by_modification_time(descending)
    base_path = candidate_paths[0]
    VERIFY: base_path, "No design runs found. Run extract or consolidate first."
    REPORT: "📁 Auto-detected latest design run: {base_path}"

STORE: base_path
```

**Target Extraction from Prompt**:
```bash
# Use intelligent parsing to extract targets from prompt
prompt_text = --prompt

# Example patterns:
# "Create dashboard with cards" → ["dashboard"]
# "Generate login, signup, and reset password pages" → ["login", "signup", "reset-password"]
# "Build navbar, hero, footer components" → ["navbar", "hero", "footer"]

# If --targets explicitly provided, use those instead
IF --targets:
    target_list = split_and_clean(--targets, delimiters=[",", ";", "、"])
    REPORT: "🎯 Using explicit targets: {', '.join(target_list)}"
ELSE:
    # Parse targets from prompt using pattern matching
    target_list = extract_targets_from_prompt(prompt_text)
    REPORT: "🎯 Extracted targets from prompt: {', '.join(target_list)}"

    # Fallback if extraction fails
    IF NOT target_list:
        target_list = ["home"]
        REPORT: "⚠️ Could not extract targets, defaulting to: ['home']"

# Validate target names
validated_targets = [t for t in target_list if regex_match(t, r"^[a-z0-9][a-z0-9_-]*$")]
invalid_targets = [t for t in target_list if t not in validated_targets]

IF invalid_targets:
    REPORT: "⚠️ Skipped invalid target names: {', '.join(invalid_targets)}"

VALIDATE: validated_targets not empty, "No valid targets found"
target_list = validated_targets

# Auto-detect target type if not provided
IF --target-type:
    target_type = --target-type
ELSE:
    target_type = detect_target_type(target_list)
    REPORT: "🔍 Auto-detected target type: {target_type}"

STORE: target_list, target_type
```

### Phase 1: Token Source Discovery & Context Loading

```bash
REPORT: "📊 Phase 1: Discovering token sources..."

# Determine style variant count
style_variants = --style-variants OR auto_detect_from_directories()
layout_variants = --layout-variants OR 3

VALIDATE: 1 <= style_variants <= 5, "Style variants must be between 1-5"
VALIDATE: 1 <= layout_variants <= 5, "Layout variants must be between 1-5"

# Smart token source detection (same logic as generate-v2.md Phase 1.2)
token_sources = {}
consolidated_count = 0
proposed_count = 0

FOR style_id IN range(1, style_variants + 1):
    # Priority 1: Consolidated tokens
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

    # Priority 2: Proposed tokens from style-cards.json
    style_cards_path = "{base_path}/style-extraction/style-cards.json"

    IF exists(style_cards_path):
        style_cards_data = Read(style_cards_path)

        IF style_id <= len(style_cards_data.style_cards):
            variant_index = style_id - 1
            variant = style_cards_data.style_cards[variant_index]
            proposed_tokens = variant.proposed_tokens

            # Create temp consolidation directory
            temp_consolidation_dir = "{base_path}/style-consolidation/style-{style_id}"
            Bash(mkdir -p "{temp_consolidation_dir}")

            # Write proposed tokens (Fast Token Adaptation)
            temp_tokens_path = "{temp_consolidation_dir}/design-tokens.json"
            Write(temp_tokens_path, JSON.stringify(proposed_tokens, null, 2))

            # Create simplified style guide
            simple_guide_content = f"""# Design System: {variant.name}

## Design Philosophy
{variant.design_philosophy}

## Description
{variant.description}

## Design Tokens
Complete token specification in `design-tokens.json`.

**Note**: Using proposed tokens from extraction phase (fast-track mode).
For production-ready refinement, run `/workflow:ui-design:consolidate` first.
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
            SUGGEST: "Reduce --style-variants to {len(style_cards_data.style_cards)} or run extract with more variants"
            EXIT 1

    # Priority 3: Error - no token source found
    ERROR: "No token source found for style-{style_id}"
    ERROR: "  Expected either:"
    ERROR: "    1. {consolidated_path} (from /workflow:ui-design:consolidate)"
    ERROR: "    2. {style_cards_path} (from /workflow:ui-design:extract)"
    SUGGEST: "Run one of the following commands first:"
    SUGGEST: "  - /workflow:ui-design:extract --base-path \"{base_path}\" --images \"refs/*.png\" --variants {style_variants}"
    SUGGEST: "  - /workflow:ui-design:consolidate --base-path \"{base_path}\" --variants {style_variants}"
    EXIT 1

# Summary report
REPORT: ""
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "📊 Token Source Summary:"
REPORT: "  Total style variants: {style_variants}"
REPORT: "  Consolidated (production-ready): {consolidated_count}/{style_variants}"
REPORT: "  Proposed (fast-track): {proposed_count}/{style_variants}"

IF proposed_count > 0:
    REPORT: ""
    REPORT: "💡 Production Quality Tip:"
    REPORT: "   Fast-track mode is active for {proposed_count} style(s)."
    REPORT: "   For production-ready quality with philosophy-driven refinement:"
    REPORT: "   /workflow:ui-design:consolidate --base-path \"{base_path}\" --variants {style_variants}"

REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Load design space analysis (if available)
design_space_path = "{base_path}/style-extraction/design-space-analysis.json"
IF exists(design_space_path):
    design_space_analysis = Read(design_space_path)
    REPORT: "📊 Loaded design space analysis with style attributes"
ELSE:
    design_space_analysis = null
    REPORT: "ℹ️ No design space analysis found - will use basic style generation"

STORE: token_sources, design_space_analysis, style_variants, layout_variants

TodoWrite: Mark "Load style information" as completed, "Gather layout inspiration" as in_progress
```

### Phase 2: Layout Inspiration Gathering

```bash
REPORT: "💡 Phase 2: Gathering layout inspiration for {len(target_list)} targets..."

CREATE: {base_path}/prototypes/_inspirations/

# For each target, gather layout inspiration via MCP search
FOR target IN target_list:
    REPORT: "  Researching '{target}' ({target_type}) layout patterns..."

    # Construct search query based on prompt and target
    search_query = f"common {target} {target_type} layout patterns variations best practices"

    # Use MCP web search for layout inspiration
    search_results = mcp__exa__web_search_exa(
        query=search_query,
        numResults=5
    )

    # Generate inspiration content
    inspiration_content = f"""Layout Inspiration for '{target}' ({target_type})
Generated: {current_timestamp()}
Search Query: {search_query}

## User Requirements
{extract_relevant_context_from_prompt(prompt_text, target)}

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
- Adapt structure based on design_attributes in Phase 3
- Follow user requirements from prompt: {extract_relevant_requirements(prompt_text, target)}
"""

    # Write inspiration file
    inspiration_file = f"{base_path}/prototypes/_inspirations/{target}-layout-ideas.txt"
    Write(inspiration_file, inspiration_content)

    REPORT: f"   ✓ Created: {target}-layout-ideas.txt"

REPORT: f"✅ Phase 2 complete: Gathered inspiration for {len(target_list)} targets"

TodoWrite: Mark "Gather layout inspiration" as completed, "Launch agents" as in_progress
```

### Phase 3: Target-Style-Centric Batch Generation with Parallel Control

```bash
REPORT: "🎨 Phase 3: Launching {len(target_list)}×{style_variants}={len(target_list) * style_variants} target-style agents..."
REPORT: "   Each agent generates {layout_variants} layouts for one target × one style"

CREATE: {base_path}/prototypes/

# ===== PARALLEL EXECUTION CONTROL =====
# Maximum concurrent agents: 6
MAX_PARALLEL_AGENTS = 6

# Build complete task list (T×S combinations)
all_tasks = []
FOR target IN target_list:
    FOR style_id IN range(1, style_variants + 1):
        all_tasks.append({
            "target": target,
            "style_id": style_id,
            "task_id": f"{target}-style-{style_id}"
        })

total_tasks = len(all_tasks)
total_batches = ceil(total_tasks / MAX_PARALLEL_AGENTS)

REPORT: ""
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "📊 Batch Execution Plan:"
REPORT: "  Total tasks: {total_tasks} (T={len(target_list)} × S={style_variants})"
REPORT: "  Max parallel: {MAX_PARALLEL_AGENTS} agents"
REPORT: "  Total batches: {total_batches}"
REPORT: "  Tasks per batch: ~{min(MAX_PARALLEL_AGENTS, total_tasks)}"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: ""

# Initialize TodoWrite with batch tracking
batch_todos = []
FOR batch_num IN range(1, total_batches + 1):
    start_idx = (batch_num - 1) * MAX_PARALLEL_AGENTS
    end_idx = min(batch_num * MAX_PARALLEL_AGENTS, total_tasks)
    batch_size = end_idx - start_idx
    batch_tasks = all_tasks[start_idx:end_idx]
    task_ids = [task["task_id"] for task in batch_tasks]

    batch_todos.append({
        "content": f"Batch {batch_num}/{total_batches}: Generate {batch_size} target-style combinations ({', '.join(task_ids[:3])}{'...' if batch_size > 3 else ''})",
        "status": "pending" if batch_num > 1 else "in_progress",
        "activeForm": f"Generating batch {batch_num}/{total_batches} ({batch_size} tasks)"
    })

TodoWrite({todos: batch_todos})

# ===== BATCH EXECUTION LOOP =====
FOR batch_num IN range(1, total_batches + 1):
    start_idx = (batch_num - 1) * MAX_PARALLEL_AGENTS
    end_idx = min(batch_num * MAX_PARALLEL_AGENTS, total_tasks)
    batch_tasks = all_tasks[start_idx:end_idx]
    batch_size = len(batch_tasks)

    REPORT: ""
    REPORT: f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    REPORT: f"🚀 Starting Batch {batch_num}/{total_batches}"
    REPORT: f"   Tasks: {start_idx + 1}-{end_idx} of {total_tasks}"
    REPORT: f"   Parallel agents: {batch_size}"
    REPORT: f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Launch all tasks in this batch in parallel (single message with multiple Task calls)
    FOR task_info IN batch_tasks:
        target = task_info["target"]
        style_id = task_info["style_id"]

        # Load layout inspiration for this target
        inspiration_path = f"{base_path}/prototypes/_inspirations/{target}-layout-ideas.txt"

        # Load style-specific context
        style_tokens_path = token_sources[style_id]["path"]
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

        # Extract relevant requirements from prompt for this target
        target_requirements = extract_relevant_context_from_prompt(prompt_text, target)

        REPORT: f"   → Launching: {target} × Style-{style_id} ({philosophy_name})"

        Task(ui-design-agent): """
          [TARGET_STYLE_UI_GENERATION_FROM_PROMPT]

          ## 🎯 Mission
          Generate {layout_variants} layout variants for: {target} × Style-{style_id} ({philosophy_name})
          Output: {layout_variants × 2} files ({layout_variants} HTML + {layout_variants} CSS)

          ## 📝 User Requirements (from prompt)
          {target_requirements}

          **Original Prompt**: {prompt_text}

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

          **1. Understand User Requirements**
          - Review original prompt: {prompt_text}
          - Focus on requirements for: {target}
          - Understand functional and visual expectations

          **2. Read Inspiration**
          - Load: {inspiration_path}
          - Apply layout N pattern
          - Adapt based on user requirements

          **3. Read Design Tokens**
          - Load: {style_tokens_path}
          - Parse JSON structure and extract all design token values
          - Understand token categories: colors, typography, spacing, shadows, borders, etc.

          **4. Generate HTML Structure**
          - Complete HTML5 document (<!DOCTYPE>, <html>, <head>, <body>)
          - Semantic elements: <header>, <nav>, <main>, <section>, <article>, <footer>
          - ARIA attributes: aria-label, role, aria-labelledby
          - Responsive meta: <meta name="viewport" content="width=device-width, initial-scale=1">
          - Include CSS reference: <link rel="stylesheet" href="{target}-style-{style_id}-layout-N.css">

          {IF design_attributes:
          **⚠️ Adapt DOM based on design_attributes:**
          - density='spacious' → Flatter hierarchy
          - density='compact' → Deeper nesting
          - visual_weight='heavy' → Extra wrapper divs for layered effects
          - visual_weight='minimal' → Direct structure, minimal wrappers
          }

          **5. Generate Self-Contained CSS**
          ⚠️ Use design token values DIRECTLY - create complete, independent CSS

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
          }

          **CSS Structure**:
          - Complete styling: colors, typography, layout, spacing, effects
          - Responsive design: Mobile-first with breakpoint-based @media
          - Self-contained: No external dependencies or var() references

          **6. Write Files IMMEDIATELY**
          - Output paths:
            - HTML: {base_path}/prototypes/{target}-style-{style_id}-layout-N.html
            - CSS: {base_path}/prototypes/{target}-style-{style_id}-layout-N.css
          - Write after generating each layout (do NOT accumulate)
          - Do NOT return content as text

          ## ✅ Success Criteria
          - [ ] Generated exactly {layout_variants × 2} files
          - [ ] All HTML includes correct CSS file reference
          - [ ] All CSS uses design token values directly (self-contained)
          - [ ] HTML structure follows user requirements from prompt
          - [ ] {IF design_attributes: 'HTML structure adapts to design_attributes' ELSE: 'HTML follows layout inspiration'}
          - [ ] Layouts are structurally distinct (different grids/regions)
          - [ ] Files written to filesystem (not returned as text)

          ## 📋 Completion
          Report: "✅ {target} × Style-{style_id} ({philosophy_name}): {layout_variants × 2} files created"
        """

    # Wait for batch completion
    REPORT: ""
    REPORT: f"⏳ Batch {batch_num}/{total_batches}: Waiting for {batch_size} agents to complete..."

    # Update TodoWrite: Mark current batch as completed, next batch as in_progress
    updated_todos = []
    FOR i IN range(1, total_batches + 1):
        IF i < batch_num:
            updated_todos.append({**batch_todos[i-1], "status": "completed"})
        ELSE IF i == batch_num:
            updated_todos.append({**batch_todos[i-1], "status": "completed"})
        ELSE IF i == batch_num + 1:
            updated_todos.append({**batch_todos[i-1], "status": "in_progress"})
        ELSE:
            updated_todos.append({**batch_todos[i-1], "status": "pending"})

    TodoWrite({todos: updated_todos})

    REPORT: f"✅ Batch {batch_num}/{total_batches} complete"

REPORT: ""
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "✅ All Batches Complete!"
REPORT: f"   Total agents executed: {total_tasks}"
REPORT: f"   Expected total files: {style_variants × layout_variants × len(target_list) × 2}"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

### Phase 4: File Verification

```bash
REPORT: "📝 Phase 4: Verifying target-style generation..."

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
                VALIDATE: f'href="{css_file}"' in html_content, f"Missing CSS reference in: {html_file}"
                VALIDATE: len(css_content) > 100, f"CSS file too small: {css_file}"

                agent_files_found += 2
                total_found += 2

                REPORT: f"   ✓ {html_file} + {css_file}"
            ELSE:
                ERROR: f"   ✗ Missing files: {target}-style-{style_id}-layout-{layout_id}.*"

        REPORT: f"  {target} × style-{style_id}: {agent_files_found}/{layout_variants * 2} files verified"

IF total_found == total_expected:
    REPORT: f"✅ Phase 4 complete: Verified all {total_expected} files"
ELSE:
    ERROR: f"⚠️ Only {total_found}/{total_expected} files found - some agents may have failed"
    ERROR: "Review agent output logs for errors"

TodoWrite: Mark "Verify files" as completed, "Generate previews" as in_progress
```

### Phase 5: Comparison File Generation

```bash
REPORT: "🌐 Phase 5: Generating comparison files..."

prototypes_dir = f"{base_path}/prototypes"

# Use script to generate preview files (same as generate-v2.md)
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
    REPORT: "✅ Phase 5 complete: All preview files generated"
ELSE:
    WARN: "⚠️ Some preview files missing - script may need attention"

TodoWrite: Mark all todos as completed
```

### Phase 6: Completion

```javascript
TodoWrite({todos: [
  {content: "Initialize and parse user prompt", status: "completed", activeForm: "Initializing"},
  {content: "Load style information and validate token sources", status: "completed", activeForm: "Loading styles"},
  {content: "Gather layout inspiration via MCP search", status: "completed", activeForm: "Gathering inspiration"},
  {content: `Launch ${target_list.length}×${style_variants}=${target_list.length * style_variants} target-style agents`, status: "completed", activeForm: "Generating prototypes"},
  {content: `Verify ${style_variants * layout_variants * target_list.length * 2} generated files`, status: "completed", activeForm: "Verifying files"},
  {content: "Generate comparison files (compare.html, index.html)", status: "completed", activeForm: "Generating previews"}
]});
```

**Completion Message**:
```
✅ Batch UI Generation Complete!

User Prompt: {prompt_text}

Configuration:
- Style Variants: {style_variants}
- Layout Variants: {layout_variants}
- Target Type: {target_type_icon} {target_type}
- Targets: {', '.join(target_list)}
- Total Prototypes: {style_variants * layout_variants * len(target_list)}

Agent Execution:
✅ Target-style agents: T×S = {len(target_list)}×{style_variants} = {len(target_list) * style_variants} agents
✅ Each agent handles: L = {layout_variants} layouts for one target
✅ Component isolation: Tasks completely independent

Token Quality:
✅ Token Quality: {consolidated_count} consolidated, {proposed_count} proposed
{IF proposed_count > 0:
   ℹ️ Fast-track mode active: {proposed_count} style(s) using proposed tokens
   💡 For production quality: /workflow:ui-design:consolidate --base-path "{base_path}" --variants {style_variants}
}

Output Files:
- Layout Inspirations: {len(target_list)} text files
- HTML Prototypes: {style_variants * layout_variants * len(target_list)} files
- CSS Files: {style_variants * layout_variants * len(target_list)} files
- Preview Files: compare.html, index.html, PREVIEW.md

Generated Structure:
📂 {base_path}/prototypes/
├── _inspirations/
│   └── {target}-layout-ideas.txt ({len(target_list)} files)
├── {target}-style-{s}-layout-{l}.html ({style_variants * layout_variants * len(target_list)} prototypes)
├── {target}-style-{s}-layout-{l}.css
├── compare.html (interactive S×L×T matrix)
├── index.html (quick navigation)
└── PREVIEW.md (usage instructions)

🌐 Interactive Preview:
1. Matrix View: Open {base_path}/prototypes/compare.html (recommended)
2. Quick Index: Open {base_path}/prototypes/index.html
3. Instructions: See {base_path}/prototypes/PREVIEW.md

{IF design_space_analysis:
🎨 Style-Aware Generation Active:
Each style's prototypes use structure adapted to design_attributes
}

Next Steps:
- Review prototypes in compare.html
- Select best combinations
- Integrate with /workflow:ui-design:update (if using session)

**Dynamic Values**: target_type_icon: "📄" for page, "🧩" for component
```

## Output Structure

```
{base_path}/prototypes/
├── _inspirations/                                 # Layout inspiration
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
- **No design systems found**: Error - Run extract or consolidate first
- **Invalid target names**: Warn and filter invalid targets
- **Missing prompt**: Error - Prompt is required for this command
- **No valid targets extracted**: Error with suggestion to use --targets explicitly

### Phase-Specific Errors
- **Token source not found**: Error with suggestions to run extract or consolidate
- **MCP search failure**: Retry with fallback query, continue with basic inspiration
- **Agent execution errors**: Report which target × style agent failed
- **File verification failure**: List missing files and suggest re-run

### Recovery Strategies
- **Partial generation**: If some agents succeed, you still have those prototypes
- **Re-run specific combination**: Can target failed combinations specifically
- **Missing design_attributes**: Generation works without them - just less style-aware

## Key Features

1. **🎯 Prompt-Driven**: User describes what to build, command handles the rest
2. **🔍 Smart Discovery**: Auto-detects available styles and tokens
3. **🚀 Target-Style-Centric**: Each agent handles L layouts for one target × one style
4. **🎨 Style-Aware**: HTML adapts based on design_attributes (if available)
5. **💡 Layout Inspiration**: MCP-powered research for each target
6. **⚡ Component Isolation**: Tasks completely independent
7. **🌐 Interactive Preview**: Full-featured compare.html matrix view
8. **✅ Production-Ready**: Semantic HTML5, ARIA, responsive design

## Integration Points

- **Input**: Prompt + existing style information (consolidated or proposed)
- **Output**: S×L×T HTML/CSS prototypes with comparison UI
- **Compatible With**: extract, consolidate, explore-auto, imitate-auto outputs
- **Session Integration**: Works with workflow session brainstorming

## Example Usage

### Example 1: From Prompt with Auto-Detection
```bash
/workflow:ui-design:batch-generate --prompt "Create modern dashboard with metric cards and charts"

# Auto-detects:
# - Latest design run
# - Available styles (3 consolidated styles found)
# - Targets from prompt: ["dashboard"]
# - Target type: page

# Execution:
# - Total tasks: 3 (T=1 × S=3)
# - Batch plan: 1 batch with 3 parallel agents
# - Output: 3 styles × 3 layouts × 1 target = 9 prototypes
```

### Example 2: Explicit Targets (Single Batch)
```bash
/workflow:ui-design:batch-generate \
  --prompt "Build authentication flow" \
  --targets "login,signup,reset-password" \
  --session WFS-auth

# Uses session's latest design run
# Execution:
# - Total tasks: 9 (T=3 × S=3)
# - Batch plan: 2 batches
#   - Batch 1: 6 parallel agents (login-style-1..3, signup-style-1..2)
#   - Batch 2: 3 parallel agents (signup-style-3, reset-password-style-1..2)
# - Output: 3 styles × 3 layouts × 3 targets = 27 prototypes
```

### Example 3: Component Generation (Multiple Batches)
```bash
/workflow:ui-design:batch-generate \
  --prompt "Create reusable UI components" \
  --targets "navbar,hero,footer,card" \
  --target-type "component" \
  --layout-variants 2

# Execution:
# - Total tasks: 12 (T=4 × S=3)
# - Batch plan: 2 batches
#   - Batch 1: 6 parallel agents (navbar, hero, footer × style-1..2)
#   - Batch 2: 6 parallel agents (card × style-1..3, navbar × style-3...)
# - Output: 3 styles × 2 layouts × 4 components = 24 prototypes
```

### Example 4: Large Scale Generation (Multiple Batches)
```bash
/workflow:ui-design:batch-generate \
  --prompt "Build complete e-commerce site" \
  --targets "home,shop,product,cart,checkout,account,orders" \
  --base-path ".workflow/.design/run-20250110-120000" \
  --style-variants 4 \
  --layout-variants 2

# Uses specific design run with 4 styles
# Execution:
# - Total tasks: 28 (T=7 × S=4)
# - Batch plan: 5 batches (max 6 parallel per batch)
#   - Batch 1/5: 6 parallel agents (home-style-1..4, shop-style-1..2)
#   - Batch 2/5: 6 parallel agents (shop-style-3..4, product-style-1..4)
#   - Batch 3/5: 6 parallel agents (cart-style-1..4, checkout-style-1..2)
#   - Batch 4/5: 6 parallel agents (checkout-style-3..4, account-style-1..4)
#   - Batch 5/5: 4 parallel agents (orders-style-1..4)
# - Output: 4 styles × 2 layouts × 7 pages = 56 prototypes
#
# TodoWrite tracking shows:
# ✓ Batch 1/5: Generate 6 target-style combinations (home-style-1, home-style-2, home-style-3...)
# ✓ Batch 2/5: Generate 6 target-style combinations (shop-style-3, shop-style-4, product-style-1...)
# → Batch 3/5: Generate 6 target-style combinations (cart-style-1, cart-style-2, cart-style-3...)
# ⏳ Batch 4/5: Generate 6 target-style combinations (checkout-style-3, checkout-style-4...)
# ⏳ Batch 5/5: Generate 4 target-style combinations (orders-style-1, orders-style-2...)
```

### Example 5: Small Task (No Batching)
```bash
/workflow:ui-design:batch-generate \
  --prompt "E-commerce product listing page" \
  --base-path ".workflow/.design/run-20250110-120000" \
  --style-variants 2 \
  --layout-variants 3

# Uses specific design run
# Execution:
# - Total tasks: 2 (T=1 × S=2)
# - Batch plan: 1 batch with 2 parallel agents
# - Output: 2 styles × 3 layouts × 1 target = 6 prototypes
```

## Helper Functions

### extract_targets_from_prompt(prompt_text)
```python
def extract_targets_from_prompt(prompt_text):
    """Extract target names from user prompt using pattern matching."""

    # Common patterns:
    # "Create X and Y" → [X, Y]
    # "Generate X, Y, and Z pages" → [X, Y, Z]
    # "Build X for users" → [X]

    patterns = [
        r"(?:create|generate|build|design)\s+([a-z0-9_-]+(?:\s*,\s*[a-z0-9_-]+)*)",
        r"([a-z0-9_-]+(?:\s*and\s*[a-z0-9_-]+)+)",
        r"([a-z0-9_-]+)\s+(?:page|component|screen|view)"
    ]

    for pattern in patterns:
        matches = regex.findall(pattern, prompt_text.lower())
        if matches:
            # Clean and split
            targets = []
            for match in matches:
                targets.extend([t.strip() for t in re.split(r'[,;、and]', match)])
            return [normalize_target_name(t) for t in targets if t]

    return []

def normalize_target_name(name):
    """Normalize target name to valid format."""
    return name.strip().lower().replace(' ', '-').replace('_', '-')

def detect_target_type(target_list):
    """Auto-detect whether targets are pages or components."""
    page_keywords = ["home", "dashboard", "settings", "profile", "login",
                     "signup", "auth", "pricing", "about", "contact", "landing"]
    component_keywords = ["navbar", "header", "footer", "hero", "card",
                         "button", "form", "modal", "alert", "dropdown", "menu"]

    page_matches = sum(1 for t in target_list if any(k in t for k in page_keywords))
    component_matches = sum(1 for t in target_list if any(k in t for k in component_keywords))

    return "component" if component_matches > page_matches else "page"

def extract_relevant_context_from_prompt(prompt_text, target):
    """Extract requirements relevant to specific target from prompt."""
    # Simple sentence extraction based on target mention
    sentences = prompt_text.split('.')
    relevant = [s.strip() for s in sentences if target.lower() in s.lower()]

    if relevant:
        return '\n'.join(relevant)
    else:
        # Return full prompt if no specific mention
        return prompt_text
```

## Batch Execution Details

### Parallel Control

**Maximum Concurrent Agents**: 6 (hardcoded `MAX_PARALLEL_AGENTS`)

**Why 6?**
- Balances throughput with resource constraints
- Prevents overwhelming the system with too many parallel tasks
- Allows for reliable progress tracking with TodoWrite
- Optimal for most hardware configurations

**Task Distribution**:
```
Total Tasks (N) = Targets (T) × Style Variants (S)
Total Batches (B) = ceil(N / 6)

Examples:
- N=3  → B=1 (single batch: 3 parallel agents)
- N=9  → B=2 (batch 1: 6 agents, batch 2: 3 agents)
- N=18 → B=3 (batch 1: 6, batch 2: 6, batch 3: 6)
- N=28 → B=5 (batches of 6, 6, 6, 6, 4)
```

### TodoWrite Progress Tracking

Each batch is tracked as a separate todo item:

**Initial State** (for 28 tasks across 5 batches):
```javascript
[
  {content: "Batch 1/5: Generate 6 target-style combinations", status: "in_progress"},
  {content: "Batch 2/5: Generate 6 target-style combinations", status: "pending"},
  {content: "Batch 3/5: Generate 6 target-style combinations", status: "pending"},
  {content: "Batch 4/5: Generate 6 target-style combinations", status: "pending"},
  {content: "Batch 5/5: Generate 4 target-style combinations", status: "pending"}
]
```

**After Batch 1 completes**:
```javascript
[
  {content: "Batch 1/5: Generate 6 target-style combinations", status: "completed"},
  {content: "Batch 2/5: Generate 6 target-style combinations", status: "in_progress"},
  {content: "Batch 3/5: Generate 6 target-style combinations", status: "pending"},
  // ...
]
```

**Benefits**:
- Clear visibility of overall progress
- Easy to understand current execution state
- Helps estimate remaining time
- Allows for graceful interruption and resumption

### Performance Characteristics

**Execution Time Estimates** (approximate):

| Tasks | Batches | Est. Time | Parallel Efficiency |
|-------|---------|-----------|---------------------|
| 1-6   | 1       | 3-5 min   | 100% (no batching)  |
| 7-12  | 2       | 6-10 min  | ~85% (1 batch wait) |
| 13-18 | 3       | 9-15 min  | ~80% (2 batch waits)|
| 19-30 | 4-5     | 12-25 min | ~75% (3-4 waits)    |

**Factors affecting speed**:
- Layout variants per task (L): More layouts = longer per-task time
- Token quality: Consolidated tokens → better but slightly slower generation
- MCP search: Network latency for layout inspiration gathering
- Design attributes: Style-aware generation adds complexity

### Optimization Tips

**1. Reduce Total Tasks**:
```bash
# Instead of: 5 targets × 4 styles = 20 tasks (4 batches)
--targets "home,shop,product,cart,checkout" --style-variants 4

# Consider: 3 targets × 3 styles = 9 tasks (2 batches)
--targets "home,shop,product" --style-variants 3
```

**2. Adjust Layout Variants**:
```bash
# High exploration (slower): L=3 layouts per task
--layout-variants 3

# Faster iteration: L=2 layouts per task
--layout-variants 2

# Rapid prototyping: L=1 layout per task
--layout-variants 1
```

**3. Staged Generation**:
```bash
# Stage 1: Core pages first
/workflow:ui-design:batch-generate \
  --prompt "E-commerce core" \
  --targets "home,shop,product" \
  --style-variants 3

# Stage 2: Additional pages later
/workflow:ui-design:batch-generate \
  --prompt "E-commerce secondary" \
  --targets "cart,checkout,account" \
  --style-variants 3 \
  --base-path ".workflow/.design/run-20250110-120000"  # Same design run
```

## Notes

- **Prompt Quality**: Better prompts lead to better target extraction and generation
- **Token Sources**: Works with both consolidated (production) and proposed (fast-track) tokens
- **Layout Variants**: More variants = more diversity but longer generation time
- **Style Variants**: Limited by available styles in base path
- **Parallel Execution**: Automatic batching with max 6 concurrent agents
- **Progress Tracking**: TodoWrite shows batch-by-batch progress
- **Scalability**: Tested up to 30+ tasks (5+ batches) with reliable execution
- **MCP Dependency**: Requires MCP web search for layout inspiration gathering
- **Script Dependency**: Requires `~/.claude/scripts/ui-generate-preview-v2.sh` for preview generation
