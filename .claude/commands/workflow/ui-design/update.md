---
name: update
description: Update brainstorming artifacts with finalized design system references
usage: /workflow:ui-design:update --session <session_id> [--selected-prototypes "<list>"]
argument-hint: "--session WFS-session-id [--selected-prototypes \"dashboard-variant-1,auth-variant-2\"]"
examples:
  - /workflow:ui-design:update --session WFS-auth
  - /workflow:ui-design:update --session WFS-dashboard --selected-prototypes "dashboard-variant-1"
allowed-tools: Read(*), Write(*), Edit(*), TodoWrite(*), Glob(*), Bash(*)
---

# Design Update Command

## Overview
Synchronize finalized design system references to brainstorming artifacts, preparing them for `/workflow:plan` consumption. This command updates **references only** (via @ notation), not content duplication.

## Core Philosophy
- **Reference-Only Updates**: Use @ references, no content duplication
- **Main Claude Execution**: Direct updates by main Claude (no Agent handoff)
- **Synthesis Alignment**: Update synthesis-specification.md UI/UX Guidelines section
- **Plan-Ready Output**: Ensure design artifacts discoverable by task-generate
- **Minimal Reading**: Verify file existence, don't read design content

## Execution Protocol

### Phase 1: Session & Artifact Validation

```bash
# Validate session
CHECK: .workflow/.active-* marker files
VALIDATE: session_id matches active session

# Verify required design artifacts exist (file existence check only)
VERIFY:
- .design/style-consolidation/design-tokens.json
- .design/style-consolidation/style-guide.md
- .design/style-consolidation/tailwind.config.js
- .design/prototypes/*.html (at least one prototype)

# Prototype selection
IF --selected-prototypes provided:
    VALIDATE: Specified prototypes exist
    selected_list = parse_comma_separated(--selected-prototypes)
ELSE:
    AUTO-SELECT: Use all generated prototypes
    selected_list = Glob(.design/prototypes/*.html)

REPORT: "Found {count} design artifacts, {prototype_count} prototypes"
```

### Phase 2: Load Target Artifacts Only

**What to Load**: Only the files we need to **update**, not the design files we're referencing.

```bash
# Load target brainstorming artifacts (files to be updated)
Read(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md)
Read(.workflow/WFS-{session}/.brainstorming/ui-designer/analysis.md) [if exists]

# Optional: Read prototype notes for descriptions (minimal context)
FOR each selected_prototype IN selected_list:
    Read(.workflow/WFS-{session}/.design/prototypes/{selected_prototype}-notes.md)
    # Extract: layout_strategy, page_name only
```

**Note**: We do **NOT** read design-tokens.json, style-guide.md, or prototype HTML. We only verify they exist and generate @ references to them.

### Phase 3: Update Synthesis Specification

Update `.brainstorming/synthesis-specification.md` with design system references.

**Target Section**: `## UI/UX Guidelines`

**Content Template**:
```markdown
## UI/UX Guidelines

### Design System Reference
**Finalized Design Tokens**: @../.design/style-consolidation/design-tokens.json
**Style Guide**: @../.design/style-consolidation/style-guide.md
**Tailwind Configuration**: @../.design/style-consolidation/tailwind.config.js

### Implementation Requirements
**Token Adherence**: All UI implementations MUST use design token CSS custom properties
**Accessibility**: WCAG AA compliance validated in design-tokens.json
**Responsive**: Mobile-first design using token-based breakpoints
**Component Patterns**: Follow patterns documented in style-guide.md

### Reference Prototypes
{FOR each selected_prototype:
- **{page_name}**: @../.design/prototypes/{prototype}.html
  - Layout: {layout_strategy from notes}
}

### Design System Assets
```json
{
  "design_tokens": ".design/style-consolidation/design-tokens.json",
  "style_guide": ".design/style-consolidation/style-guide.md",
  "tailwind_config": ".design/style-consolidation/tailwind.config.js",
  "prototypes": [
    {FOR each: ".design/prototypes/{prototype}.html"}
  ]
}
```
```

**Implementation**:
```bash
# Option 1: Edit existing section
Edit(
  file_path=".workflow/WFS-{session}/.brainstorming/synthesis-specification.md",
  old_string="## UI/UX Guidelines\n[existing content]",
  new_string="## UI/UX Guidelines\n\n[new design reference content]"
)

# Option 2: Append if section doesn't exist
IF section not found:
    Edit(
      file_path=".workflow/WFS-{session}/.brainstorming/synthesis-specification.md",
      old_string="[end of document]",
      new_string="\n\n## UI/UX Guidelines\n\n[new design reference content]"
    )
```

### Phase 4: Update UI Designer Style Guide

Create or update `.brainstorming/ui-designer/style-guide.md`:

```markdown
# UI Designer Style Guide

## Design System Integration
This style guide references the finalized design system from the design refinement phase.

**Design Tokens**: @../../.design/style-consolidation/design-tokens.json
**Style Guide**: @../../.design/style-consolidation/style-guide.md
**Tailwind Config**: @../../.design/style-consolidation/tailwind.config.js

## Implementation Guidelines
1. **Use CSS Custom Properties**: All styles reference design tokens
2. **Follow Semantic HTML**: Use HTML5 semantic elements
3. **Maintain Accessibility**: WCAG AA compliance required
4. **Responsive Design**: Mobile-first with token-based breakpoints

## Reference Prototypes
{FOR each selected_prototype:
- **{page_name}**: @../../.design/prototypes/{prototype}.html
}

## Token System
For complete token definitions and usage examples, see:
- Design Tokens: @../../.design/style-consolidation/design-tokens.json
- Style Guide: @../../.design/style-consolidation/style-guide.md

---
*Auto-generated by /workflow:ui-design:update*
*Last updated: {timestamp}*
```

**Implementation**:
```bash
Write(
  file_path=".workflow/WFS-{session}/.brainstorming/ui-designer/style-guide.md",
  content="[generated content with @ references]"
)
```

### Phase 5: Completion

```javascript
TodoWrite({
  todos: [
    {content: "Validate session and design system artifacts", status: "completed", activeForm: "Validating artifacts"},
    {content: "Load target brainstorming artifacts", status: "completed", activeForm: "Loading target files"},
    {content: "Update synthesis-specification.md with design references", status: "completed", activeForm: "Updating synthesis spec"},
    {content: "Create/update ui-designer/style-guide.md", status: "completed", activeForm: "Updating UI designer guide"}
  ]
});
```

**Completion Message**:
```
✅ Design system references updated for session: WFS-{session}

Updated artifacts:
✓ synthesis-specification.md - UI/UX Guidelines section with @ references
✓ ui-designer/style-guide.md - Design system reference guide

Design system assets ready for /workflow:plan:
- design-tokens.json
- style-guide.md
- tailwind.config.js
- {prototype_count} reference prototypes

Next: /workflow:plan [--agent] "<task description>"
      The plan phase will automatically discover and utilize the design system.
```

## Output Structure

**Updated Files**:
```
.workflow/WFS-{session}/.brainstorming/
├── synthesis-specification.md       # Updated with UI/UX Guidelines section
└── ui-designer/
    └── style-guide.md               # New or updated design reference guide
```

**@ Reference Format** (used in synthesis-specification.md):
```
@../.design/style-consolidation/design-tokens.json
@../.design/style-consolidation/style-guide.md
@../.design/style-consolidation/tailwind.config.js
@../.design/prototypes/{prototype}.html
```

**@ Reference Format** (used in ui-designer/style-guide.md):
```
@../../.design/style-consolidation/design-tokens.json
@../../.design/style-consolidation/style-guide.md
@../../.design/style-consolidation/tailwind.config.js
@../../.design/prototypes/{prototype}.html
```

## Integration with /workflow:plan

After this update, `/workflow:plan` will discover design assets through:

**Phase 3: Intelligent Analysis** (`/workflow:tools:concept-enhanced`)
- Reads synthesis-specification.md
- Discovers @ references to design system files
- Includes design system context in ANALYSIS_RESULTS.md

**Phase 4: Task Generation** (`/workflow:tools:task-generate`)
- Reads ANALYSIS_RESULTS.md
- Discovers design assets from synthesis-specification.md
- Includes design system paths in task JSON files

**Example Task JSON** (generated by task-generate):
```json
{
  "task_id": "IMPL-001",
  "context": {
    "design_system": {
      "tokens": ".design/style-consolidation/design-tokens.json",
      "style_guide": ".design/style-consolidation/style-guide.md",
      "prototypes": [".design/prototypes/dashboard-variant-1.html"]
    }
  }
}
```

## Error Handling

- **Missing design artifacts**: Error with message "Run /workflow:ui-design:consolidate and /workflow:ui-design:generate first"
- **synthesis-specification.md not found**: Warning, create minimal version with just UI/UX Guidelines
- **ui-designer/ directory missing**: Create directory and file
- **Edit conflicts**: Preserve existing content, append or replace only UI/UX Guidelines section
- **Invalid prototype names**: Skip invalid entries, continue with valid ones

## Validation Checks

After update, verify:
- [ ] synthesis-specification.md contains UI/UX Guidelines section
- [ ] UI/UX Guidelines include @ references (not content duplication)
- [ ] ui-designer/style-guide.md created or updated
- [ ] All @ referenced files exist and are accessible
- [ ] @ reference paths are relative and correct

## Key Features

1. **Reference-Only Updates**
   - Uses @ notation for file references
   - No content duplication between design and brainstorming spaces
   - Lightweight, maintainable approach

2. **Main Claude Direct Execution**
   - No Agent handoff (preserves context)
   - Simple reference generation (no complex synthesis)
   - Reliable path resolution

3. **Plan-Ready Output**
   - `/workflow:plan` Phase 3 can discover design system
   - Task generation includes design asset paths
   - Clear integration points for implementation tasks

4. **Minimal Reading**
   - Only reads target files to update (synthesis-specification.md, ui-designer/analysis.md)
   - Verifies design file existence (no content reading)
   - Optional: reads prototype notes for descriptions

5. **Flexible Prototype Selection**
   - Auto-select all prototypes (default)
   - Manual selection via --selected-prototypes parameter
   - Validates prototype existence before referencing

## Integration Points

- **Input**: Design system artifacts from `/workflow:ui-design:consolidate` and `/workflow:ui-design:generate`
- **Output**: Updated synthesis-specification.md, ui-designer/style-guide.md with @ references
- **Next Phase**: `/workflow:plan` discovers and utilizes design system through @ references
- **Auto Integration**: Automatically triggered by `/workflow:ui-design:auto` workflow

## Why Main Claude Execution?

This command is executed directly by main Claude (not delegated to an Agent) because:

1. **Simple Reference Generation**: Only generating file paths, not complex synthesis
2. **Context Preservation**: Main Claude has full session and conversation context
3. **Minimal Transformation**: Primarily updating references, not analyzing content
4. **Path Resolution**: Requires precise relative path calculation
5. **Edit Operations**: Better error recovery for Edit conflicts
6. **Synthesis Pattern**: Follows same direct-execution pattern as other reference updates

This ensures reliable, lightweight integration without Agent handoff overhead.
