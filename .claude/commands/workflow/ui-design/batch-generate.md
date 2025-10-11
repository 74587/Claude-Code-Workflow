---
name: batch-generate
description: Prompt-driven batch UI generation using target-style-centric parallel execution
usage: /workflow:ui-design:batch-generate --prompt "<description>" [--targets "<list>"] [--target-type "page|component"] [--device-type "desktop|mobile|tablet|responsive"] [--base-path <path>] [--session <id>] [--style-variants <count>] [--layout-variants <count>]
examples:
  - /workflow:ui-design:batch-generate --prompt "Dashboard with metrics cards" --style-variants 3
  - /workflow:ui-design:batch-generate --prompt "Auth pages: login, signup" --session WFS-auth
  - /workflow:ui-design:batch-generate --prompt "Navbar, hero, footer components" --target-type component
  - /workflow:ui-design:batch-generate --prompt "Mobile e-commerce app" --device-type mobile
allowed-tools: TodoWrite(*), Read(*), Write(*), Task(ui-design-agent), Bash(*), mcp__exa__web_search_exa(*)
---

# Batch Generate UI Prototypes (/workflow:ui-design:batch-generate)

## Overview
Prompt-driven UI generation with intelligent target extraction and **target-style-centric batch execution**. Each agent handles all layouts for one target × style combination.

**Strategy**: Prompt → Targets → Batched Generation
- **Prompt-driven**: Describe what to build, command extracts targets
- **Agent scope**: Each of `T × S` agents generates `L` layouts
- **Parallel batching**: Max 6 concurrent agents for optimal throughput
- **Component isolation**: Complete task independence
- **Style-aware**: HTML adapts to design_attributes
- **Self-contained CSS**: Direct token values (no var() refs)

**Supports**: Pages (full layouts) and components (isolated elements)

## Phase 1: Setup & Validation

### Step 1: Parse Prompt & Resolve Configuration
```bash
# Parse required parameters
prompt_text = --prompt
device_type = --device-type OR "responsive"

# Extract targets from prompt
IF --targets:
    target_list = split_and_clean(--targets)
ELSE:
    target_list = extract_targets_from_prompt(prompt_text)  # See helpers
    IF NOT target_list: target_list = ["home"]  # Fallback

# Detect target type
target_type = --target-type OR detect_target_type(target_list)

# Resolve base path
IF --base-path:
    base_path = --base-path
ELSE IF --session:
    bash(find .workflow/WFS-{session} -type d -name "design-*" -printf "%T@ %p\n" | sort -nr | head -1 | cut -d' ' -f2)
ELSE:
    bash(find .workflow -type d -name "design-*" -printf "%T@ %p\n" | sort -nr | head -1 | cut -d' ' -f2)

# Get variant counts
style_variants = --style-variants OR bash(ls {base_path}/style-consolidation/style-* -d | wc -l)
layout_variants = --layout-variants OR 3
```

**Output**: `base_path`, `target_list[]`, `target_type`, `device_type`, `style_variants`, `layout_variants`

### Step 2: Detect Token Sources
```bash
# Check consolidated (priority 1) or proposed (priority 2)
bash(test -f {base_path}/style-consolidation/style-1/design-tokens.json && echo "consolidated")
# OR
bash(test -f {base_path}/style-extraction/style-cards.json && echo "proposed")

# If proposed: Create temp consolidation dirs + write tokens
FOR style_id IN 1..style_variants:
    bash(mkdir -p {base_path}/style-consolidation/style-{style_id})
    Write({base_path}/style-consolidation/style-{style_id}/design-tokens.json, proposed_tokens)

# Load design space analysis (optional)
IF exists({base_path}/style-extraction/design-space-analysis.json):
    design_space_analysis = Read({base_path}/style-extraction/design-space-analysis.json)
```

**Output**: `token_sources{}`, `consolidated_count`, `proposed_count`, `design_space_analysis`

### Step 3: Gather Layout Inspiration
```bash
bash(mkdir -p {base_path}/prototypes/_inspirations)

# For each target: Research via MCP
FOR target IN target_list:
    search_query = "{target} {target_type} layout patterns variations"
    mcp__exa__web_search_exa(query=search_query, numResults=5)

    # Extract context from prompt for this target
    target_requirements = extract_relevant_context_from_prompt(prompt_text, target)

    # Write simple inspiration file
    Write({base_path}/prototypes/_inspirations/{target}-layout-ideas.txt, inspiration_content)
```

**Output**: `T` inspiration text files

## Phase 2: Target-Style-Centric Batch Generation (Agent)

**Executor**: `Task(ui-design-agent)` × `T × S` tasks in **batched parallel** (max 6 concurrent)

### Step 1: Calculate Batch Execution Plan
```bash
bash(mkdir -p {base_path}/prototypes)

# Build task list: T × S combinations
MAX_PARALLEL = 6
total_tasks = T × S
total_batches = ceil(total_tasks / MAX_PARALLEL)

# Initialize batch tracking
TodoWrite({todos: [
  {content: "Batch 1/{batches}: Generate 6 tasks", status: "in_progress"},
  {content: "Batch 2/{batches}: Generate 6 tasks", status: "pending"},
  ...
]})
```

### Step 2: Launch Batched Agent Tasks
For each batch (up to 6 parallel tasks):
```javascript
Task(ui-design-agent): `
  [TARGET_STYLE_UI_GENERATION_FROM_PROMPT]
  🎯 ONE component: {target} × Style-{style_id} ({philosophy_name})
  Generate: {layout_variants} × 2 files (HTML + CSS per layout)

  PROMPT CONTEXT: {target_requirements}  # Extracted from original prompt
  TARGET: {target} | TYPE: {target_type} | STYLE: {style_id}/{style_variants}
  BASE_PATH: {base_path}
  DEVICE: {device_type}
  ${design_attributes ? "DESIGN_ATTRIBUTES: " + JSON.stringify(design_attributes) : ""}

  ## Reference
  - Layout inspiration: Read("{base_path}/prototypes/_inspirations/{target}-layout-ideas.txt")
  - Design tokens: Read("{base_path}/style-consolidation/style-{style_id}/design-tokens.json")
    Parse ALL token values (colors, typography, spacing, borders, shadows, breakpoints)
  ${design_attributes ? "- Adapt DOM to: density, visual_weight, formality, organic_vs_geometric" : ""}

  ## Generation
  For EACH layout (1 to {layout_variants}):

  1. HTML: {base_path}/prototypes/{target}-style-{style_id}-layout-N.html
     - Complete HTML5: <!DOCTYPE>, <head>, <body>
     - CSS ref: <link href="{target}-style-{style_id}-layout-N.css">
     - Semantic: <header>, <nav>, <main>, <footer>
     - A11y: ARIA labels, landmarks, responsive meta
     - Viewport: <meta name="viewport" content="width=device-width, initial-scale=1.0">
     - Follow user requirements from prompt
     ${design_attributes ? `
     - DOM adaptation:
       * density='spacious' → flatter hierarchy
       * density='compact' → deeper nesting
       * visual_weight='heavy' → extra wrappers
       * visual_weight='minimal' → direct structure` : ""}
     - Device-specific: Optimize for {device_type}

  2. CSS: {base_path}/prototypes/{target}-style-{style_id}-layout-N.css
     - Self-contained: Direct token VALUES (no var())
     - Use tokens: colors, fonts, spacing, borders, shadows
     - Device-optimized: {device_type} styles
     ${device_type === 'responsive' ? '- Responsive: Mobile-first @media' : '- Fixed: ' + device_type}
     ${design_attributes ? `
     - Token selection: density → spacing, visual_weight → shadows` : ""}

  ## Notes
  - ✅ Token VALUES directly from design-tokens.json
  - ✅ Follow prompt requirements for {target}
  - ✅ Optimize for {device_type}
  - ❌ NO var() refs, NO external deps
  - Layouts structurally DISTINCT
  - Write files IMMEDIATELY (per layout)
  - CSS filename MUST match HTML <link href>
`

# After each batch completes
TodoWrite: Mark batch completed, next batch in_progress
```

## Phase 3: Verify & Generate Previews

### Step 1: Verify Generated Files
```bash
# Count expected vs found
bash(ls {base_path}/prototypes/{target}-style-*-layout-*.html | wc -l)
# Expected: S × L × T × 2

# Validate samples
Read({base_path}/prototypes/{target}-style-{style_id}-layout-{layout_id}.html)
# Check: <!DOCTYPE html>, correct CSS href, sufficient CSS length
```

**Output**: `S × L × T × 2` files verified

### Step 2: Run Preview Generation Script
```bash
bash(~/.claude/scripts/ui-generate-preview.sh "{base_path}/prototypes")
```

**Script generates**:
- `compare.html` (interactive matrix)
- `index.html` (navigation)
- `PREVIEW.md` (instructions)

### Step 3: Verify Preview Files
```bash
bash(ls {base_path}/prototypes/compare.html {base_path}/prototypes/index.html {base_path}/prototypes/PREVIEW.md)
```

**Output**: 3 preview files

## Completion

### Todo Update
```javascript
TodoWrite({todos: [
  {content: "Setup and parse prompt", status: "completed", activeForm: "Parsing prompt"},
  {content: "Detect token sources", status: "completed", activeForm: "Loading design systems"},
  {content: "Gather layout inspiration", status: "completed", activeForm: "Researching layouts"},
  {content: "Batch 1/{batches}: Generate 6 tasks", status: "completed", activeForm: "Generating batch 1"},
  ... (all batches completed)
  {content: "Verify files & generate previews", status: "completed", activeForm: "Creating previews"}
]});
```

### Output Message
```
✅ Prompt-driven batch UI generation complete!

Prompt: {prompt_text}

Configuration:
- Style Variants: {style_variants}
- Layout Variants: {layout_variants}
- Target Type: {target_type}
- Device Type: {device_type}
- Targets: {target_list} ({T} targets)
- Total Prototypes: {S × L × T}

Batch Execution:
- Total tasks: {T × S} (targets × styles)
- Batches: {batches} (max 6 parallel per batch)
- Agent scope: {L} layouts per target×style
- Component isolation: Complete task independence
- Device-specific: All layouts optimized for {device_type}

Quality:
- Style-aware: {design_space_analysis ? 'HTML adapts to design_attributes' : 'Standard structure'}
- CSS: Self-contained (direct token values, no var())
- Device-optimized: {device_type} layouts
- Tokens: {consolidated_count} consolidated, {proposed_count} proposed
{IF proposed_count > 0: '  💡 For production: /workflow:ui-design:consolidate'}

Generated Files:
{base_path}/prototypes/
├── _inspirations/ ({T} text files)
├── {target}-style-{s}-layout-{l}.html ({S×L×T} prototypes)
├── {target}-style-{s}-layout-{l}.css
├── compare.html (interactive matrix)
├── index.html (navigation)
└── PREVIEW.md (instructions)

Preview:
1. Open compare.html (recommended)
2. Open index.html
3. Read PREVIEW.md

Next: /workflow:ui-design:update
```

## Simple Bash Commands

### Path Operations
```bash
# Find design directory
bash(find .workflow -type d -name "design-*" -printf "%T@ %p\n" | sort -nr | head -1 | cut -d' ' -f2)

# Count style variants
bash(ls {base_path}/style-consolidation/style-* -d | wc -l)

# Check token sources
bash(test -f {base_path}/style-consolidation/style-1/design-tokens.json && echo "consolidated")
bash(test -f {base_path}/style-extraction/style-cards.json && echo "proposed")
```

### Validation Commands
```bash
# Count generated files
bash(ls {base_path}/prototypes/{target}-style-*-layout-*.html | wc -l)

# Verify preview
bash(test -f {base_path}/prototypes/compare.html && echo "exists")
```

### File Operations
```bash
# Create directories
bash(mkdir -p {base_path}/prototypes/_inspirations)

# Run preview script
bash(~/.claude/scripts/ui-generate-preview.sh "{base_path}/prototypes")
```

## Output Structure

```
{base_path}/
├── prototypes/
│   ├── _inspirations/
│   │   └── {target}-layout-ideas.txt  # Layout inspiration
│   ├── {target}-style-{s}-layout-{l}.html  # Final prototypes
│   ├── {target}-style-{s}-layout-{l}.css
│   ├── compare.html
│   ├── index.html
│   └── PREVIEW.md
└── style-consolidation/
    └── style-{s}/
        ├── design-tokens.json
        └── style-guide.md
```

## Error Handling

### Common Errors
```
ERROR: No token sources found
→ Run /workflow:ui-design:extract or /workflow:ui-design:consolidate

ERROR: No targets extracted from prompt
→ Use --targets explicitly or rephrase prompt

ERROR: MCP search failed
→ Check network, retry

ERROR: Batch {N} agent tasks failed
→ Check agent output, retry specific target×style combinations

ERROR: Script permission denied
→ chmod +x ~/.claude/scripts/ui-generate-preview.sh
```

### Recovery Strategies
- **Partial success**: Keep successful target×style combinations
- **Missing design_attributes**: Works without (less style-aware)
- **Invalid tokens**: Validate design-tokens.json structure
- **Failed batch**: Re-run command, only failed combinations will retry

## Quality Checklist

- [ ] Prompt clearly describes targets
- [ ] CSS uses direct token values (no var())
- [ ] HTML adapts to design_attributes (if available)
- [ ] Semantic HTML5 structure
- [ ] ARIA attributes present
- [ ] Device-optimized layouts
- [ ] Layouts structurally distinct
- [ ] compare.html works

## Key Features

- **Prompt-Driven**: Describe what to build, command extracts targets
- **Target-Style-Centric**: `T×S` agents, each handles `L` layouts
- **Parallel Batching**: Max 6 concurrent agents with progress tracking
- **Component Isolation**: Complete task independence
- **Style-Aware**: HTML adapts to design_attributes
- **Self-Contained CSS**: Direct token values (no var())
- **Device-Specific**: Optimized for desktop/mobile/tablet/responsive
- **Inspiration-Based**: MCP-powered layout research
- **Production-Ready**: Semantic, accessible, responsive

## Integration

**Input**: Prompt, design-tokens.json, design-space-analysis.json (optional)
**Output**: S×L×T prototypes for `/workflow:ui-design:update`
**Compatible**: extract, consolidate, explore-auto, imitate-auto outputs

## Usage Examples

### Basic: Auto-detection
```bash
/workflow:ui-design:batch-generate \
  --prompt "Dashboard with metric cards and charts"

# Auto: latest design run, extracts "dashboard" target
# Output: S × L × 1 prototypes
```

### With Session
```bash
/workflow:ui-design:batch-generate \
  --prompt "Auth pages: login, signup, password reset" \
  --session WFS-auth

# Uses WFS-auth's design run
# Extracts: ["login", "signup", "password-reset"]
# Batches: 2 (if S=3: 9 tasks = 6+3)
# Output: S × L × 3 prototypes
```

### Components with Device Type
```bash
/workflow:ui-design:batch-generate \
  --prompt "Mobile UI components: navbar, card, footer" \
  --target-type component \
  --device-type mobile

# Mobile-optimized component generation
# Output: S × L × 3 prototypes
```

### Large Scale (Multi-batch)
```bash
/workflow:ui-design:batch-generate \
  --prompt "E-commerce site" \
  --targets "home,shop,product,cart,checkout" \
  --style-variants 4 \
  --layout-variants 2

# Tasks: 5 × 4 = 20 (4 batches: 6+6+6+2)
# Output: 4 × 2 × 5 = 40 prototypes
```

## Helper Functions Reference

### Target Extraction
```python
# extract_targets_from_prompt(prompt_text)
# Patterns: "Create X and Y", "Generate X, Y, Z pages", "Build X"
# Returns: ["x", "y", "z"] (normalized lowercase with hyphens)

# detect_target_type(target_list)
# Keywords: page (home, dashboard, login) vs component (navbar, card, button)
# Returns: "page" or "component"

# extract_relevant_context_from_prompt(prompt_text, target)
# Extracts sentences mentioning specific target
# Returns: Relevant context string
```

## Batch Execution Details

### Parallel Control
- **Max concurrent**: 6 agents per batch
- **Task distribution**: T × S tasks = ceil(T×S/6) batches
- **Progress tracking**: TodoWrite per-batch status
- **Examples**:
  - 3 tasks → 1 batch
  - 9 tasks → 2 batches (6+3)
  - 20 tasks → 4 batches (6+6+6+2)

### Performance
| Tasks | Batches | Est. Time | Efficiency |
|-------|---------|-----------|------------|
| 1-6   | 1       | 3-5 min   | 100%       |
| 7-12  | 2       | 6-10 min  | ~85%       |
| 13-18 | 3       | 9-15 min  | ~80%       |
| 19-30 | 4-5     | 12-25 min | ~75%       |

### Optimization Tips
1. **Reduce tasks**: Fewer targets or styles
2. **Adjust layouts**: L=2 instead of L=3 for faster iteration
3. **Stage generation**: Core pages first, secondary pages later

## Notes

- **Prompt quality**: Clear descriptions improve target extraction
- **Token sources**: Consolidated (production) or proposed (fast-track)
- **Batch parallelism**: Max 6 concurrent for stability
- **Scalability**: Tested up to 30+ tasks (5+ batches)
- **Dependencies**: MCP web search, ui-generate-preview.sh script
