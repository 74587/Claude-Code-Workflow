---
name: update
description: Update brainstorming artifacts with finalized design system references
usage: /workflow:ui-design:update --session <session_id> [--selected-prototypes "<list>"]
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
CHECK: .workflow/.active-* marker files; VALIDATE: session_id matches active session

# Verify design artifacts in latest design run
latest_design = find_latest_path_matching(".workflow/WFS-{session}/design-*")

# Detect design system structure (unified vs separate)
IF exists({latest_design}/style-consolidation/design-tokens.json):
    design_system_mode = "unified"; design_tokens_path = "style-consolidation/design-tokens.json"; style_guide_path = "style-consolidation/style-guide.md"
ELSE IF exists({latest_design}/style-consolidation/style-1/design-tokens.json):
    design_system_mode = "separate"; design_tokens_path = "style-consolidation/style-1/design-tokens.json"; style_guide_path = "style-consolidation/style-1/style-guide.md"
ELSE:
    ERROR: "No design tokens found. Run /workflow:ui-design:consolidate first"

VERIFY: {latest_design}/{design_tokens_path}, {latest_design}/{style_guide_path}, {latest_design}/prototypes/*.html

REPORT: "📋 Design system mode: {design_system_mode} | Tokens: {design_tokens_path}"

# Prototype selection
selected_list = --selected-prototypes ? parse_comma_separated(--selected-prototypes) : Glob({latest_design}/prototypes/*.html)
VALIDATE: Specified prototypes exist IF --selected-prototypes

REPORT: "Found {count} design artifacts, {prototype_count} prototypes"
```

### Phase 2: Load Target Artifacts Only

**What to Load**: Only the files we need to **update**, not the design files we're referencing.

```bash
# Load target brainstorming artifacts (files to be updated)
Read(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md)
IF exists(.workflow/WFS-{session}/.brainstorming/ui-designer/analysis.md): Read(analysis.md)

# Optional: Read prototype notes for descriptions (minimal context)
FOR each selected_prototype IN selected_list:
    Read({latest_design}/prototypes/{selected_prototype}-notes.md)  # Extract: layout_strategy, page_name only

# Note: Do NOT read design-tokens.json, style-guide.md, or prototype HTML. Only verify existence and generate @ references.
```

### Phase 3: Update Synthesis Specification

Update `.brainstorming/synthesis-specification.md` with design system references.

**Target Section**: `## UI/UX Guidelines`

**Content Template**:
```markdown
## UI/UX Guidelines

### Design System Reference
**Finalized Design Tokens**: @../design-{run_id}/{design_tokens_path}
**Style Guide**: @../design-{run_id}/{style_guide_path}
**Design System Mode**: {design_system_mode}

### Implementation Requirements
**Token Adherence**: All UI implementations MUST use design token CSS custom properties
**Accessibility**: WCAG AA compliance validated in design-tokens.json
**Responsive**: Mobile-first design using token-based breakpoints
**Component Patterns**: Follow patterns documented in style-guide.md

### Reference Prototypes
{FOR each selected_prototype:
- **{page_name}**: @../design-{run_id}/prototypes/{prototype}.html | Layout: {layout_strategy from notes}
}

### Design System Assets
```json
{"design_tokens": "design-{run_id}/{design_tokens_path}", "style_guide": "design-{run_id}/{style_guide_path}", "design_system_mode": "{design_system_mode}", "prototypes": [{FOR each: "design-{run_id}/prototypes/{prototype}.html"}]}
```
```

**Implementation**:
```bash
# Option 1: Edit existing section
Edit(file_path=".workflow/WFS-{session}/.brainstorming/synthesis-specification.md",
     old_string="## UI/UX Guidelines\n[existing content]",
     new_string="## UI/UX Guidelines\n\n[new design reference content]")

# Option 2: Append if section doesn't exist
IF section not found:
    Edit(file_path="...", old_string="[end of document]", new_string="\n\n## UI/UX Guidelines\n\n[new design reference content]")
```

### Phase 4: Update UI Designer Style Guide

Create or update `.brainstorming/ui-designer/style-guide.md`:

```markdown
# UI Designer Style Guide

## Design System Integration
This style guide references the finalized design system from the design refinement phase.

**Design Tokens**: @../../design-{run_id}/{design_tokens_path}
**Style Guide**: @../../design-{run_id}/{style_guide_path}
**Design System Mode**: {design_system_mode}

## Implementation Guidelines
1. **Use CSS Custom Properties**: All styles reference design tokens
2. **Follow Semantic HTML**: Use HTML5 semantic elements
3. **Maintain Accessibility**: WCAG AA compliance required
4. **Responsive Design**: Mobile-first with token-based breakpoints

## Reference Prototypes
{FOR each selected_prototype:
- **{page_name}**: @../../design-{run_id}/prototypes/{prototype}.html
}

## Token System
For complete token definitions and usage examples, see:
- Design Tokens: @../../design-{run_id}/{design_tokens_path}
- Style Guide: @../../design-{run_id}/{style_guide_path}

---
*Auto-generated by /workflow:ui-design:update | Last updated: {timestamp}*
```

**Implementation**:
```bash
Write(file_path=".workflow/WFS-{session}/.brainstorming/ui-designer/style-guide.md",
      content="[generated content with @ references]")
```

### Phase 5: Completion

```javascript
TodoWrite({todos: [
  {content: "Validate session and design system artifacts", status: "completed", activeForm: "Validating artifacts"},
  {content: "Load target brainstorming artifacts", status: "completed", activeForm: "Loading target files"},
  {content: "Update synthesis-specification.md with design references", status: "completed", activeForm: "Updating synthesis spec"},
  {content: "Create/update ui-designer/style-guide.md", status: "completed", activeForm: "Updating UI designer guide"}
]});
```

**Completion Message**:
```
✅ Design system references updated for session: WFS-{session}

Updated artifacts:
✓ synthesis-specification.md - UI/UX Guidelines section with @ references
✓ ui-designer/style-guide.md - Design system reference guide

Design system assets ready for /workflow:plan:
- design-tokens.json | style-guide.md | {prototype_count} reference prototypes

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

**@ Reference Format** (synthesis-specification.md):
```
@../design-{run_id}/style-consolidation/design-tokens.json
@../design-{run_id}/style-consolidation/style-guide.md
@../design-{run_id}/prototypes/{prototype}.html
```

**@ Reference Format** (ui-designer/style-guide.md):
```
@../../design-{run_id}/style-consolidation/design-tokens.json
@../../design-{run_id}/style-consolidation/style-guide.md
@../../design-{run_id}/prototypes/{prototype}.html
```

## Integration with /workflow:plan

After this update, `/workflow:plan` will discover design assets through:

**Phase 3: Intelligent Analysis** (`/workflow:tools:concept-enhanced`)
- Reads synthesis-specification.md → Discovers @ references → Includes design system context in ANALYSIS_RESULTS.md

**Phase 4: Task Generation** (`/workflow:tools:task-generate`)
- Reads ANALYSIS_RESULTS.md → Discovers design assets → Includes design system paths in task JSON files

**Example Task JSON** (generated by task-generate):
```json
{
  "task_id": "IMPL-001",
  "context": {
    "design_system": {
      "tokens": "design-{run_id}/style-consolidation/design-tokens.json",
      "style_guide": "design-{run_id}/style-consolidation/style-guide.md",
      "prototypes": ["design-{run_id}/prototypes/dashboard-variant-1.html"]
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

1. **Reference-Only Updates**: Uses @ notation for file references, no content duplication, lightweight and maintainable
2. **Main Claude Direct Execution**: No Agent handoff (preserves context), simple reference generation, reliable path resolution
3. **Plan-Ready Output**: `/workflow:plan` Phase 3 can discover design system, task generation includes design asset paths, clear integration points
4. **Minimal Reading**: Only reads target files to update, verifies design file existence (no content reading), optional prototype notes for descriptions
5. **Flexible Prototype Selection**: Auto-select all prototypes (default), manual selection via --selected-prototypes parameter, validates existence

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
