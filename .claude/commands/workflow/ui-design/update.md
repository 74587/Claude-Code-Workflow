---
name: update
description: Update brainstorming artifacts with finalized design system
usage: /workflow:ui-design:update --session <session_id> [--selected-prototypes "<list>"]
argument-hint: "--session WFS-session-id [--selected-prototypes \"dashboard-variant-1,auth-variant-2\"]"
examples:
  - /workflow:ui-design:update --session WFS-auth
  - /workflow:ui-design:update --session WFS-dashboard --selected-prototypes "dashboard-variant-1"
allowed-tools: Read(*), Write(*), TodoWrite(*), Glob(*), Bash(*)
---

# Design Update Command

## Overview
Synchronize finalized design system (tokens, style guide, selected prototypes) back to brainstorming artifacts, preparing for `/workflow:plan` phase consumption.

## Core Philosophy
- **Main Claude Execution**: Direct updates by main Claude (avoid Agent context loss, following synthesis pattern)
- **Reference-Based Integration**: Use @ references, not content duplication
- **Synthesis Alignment**: Update synthesis-specification.md UI/UX Guidelines section
- **UI Designer Sync**: Mirror design system to ui-designer/style-guide.md
- **Plan-Ready Output**: Ensure design artifacts discoverable by task-generate

## Execution Protocol

### Phase 1: Session & Design System Validation
```bash
# Validate session and verify design system completeness
CHECK: .workflow/.active-* marker files
VALIDATE: session_id matches active session

VERIFY required artifacts:
- .design/style-consolidation/design-tokens.json
- .design/style-consolidation/style-guide.md
- .design/style-consolidation/tailwind.config.js
- .design/prototypes/*.html (at least one prototype)

IF --selected-prototypes provided:
    VALIDATE: Specified prototypes exist
ELSE:
    AUTO-SELECT: Use all generated prototypes
```

### Phase 2: Load Design System Context
**Direct Claude Code Execution** (no Agent invocation)

```bash
# Load all design system artifacts
Read(.workflow/WFS-{session}/.design/style-consolidation/design-tokens.json)
Read(.workflow/WFS-{session}/.design/style-consolidation/style-guide.md)
Read(.workflow/WFS-{session}/.design/style-consolidation/tailwind.config.js)
Read(.workflow/WFS-{session}/.design/style-consolidation/validation-report.json)

# Load selected prototype files
FOR each selected_prototype IN selected_prototypes:
    Read(.workflow/WFS-{session}/.design/prototypes/{selected_prototype}.html)
    Read(.workflow/WFS-{session}/.design/prototypes/{selected_prototype}-notes.md)

# Load target brainstorming artifacts
Read(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md)
Read(.workflow/WFS-{session}/.brainstorming/ui-designer/analysis.md) [if exists]
```

### Phase 3: Update Synthesis Specification
**Direct Write by Main Claude**

Update `.brainstorming/synthesis-specification.md`:

```markdown
## UI/UX Guidelines

### Design System Reference
**Finalized Design Tokens**: @../.design/style-consolidation/design-tokens.json
**Style Guide**: @../.design/style-consolidation/style-guide.md
**Tailwind Configuration**: @../.design/style-consolidation/tailwind.config.js

### Design Philosophy
[Extract philosophy section from style-guide.md]

### Token System Overview
**Colors**: OKLCH-based color system with semantic naming
- Brand: primary, secondary, accent
- Surface: background, elevated, sunken
- Semantic: success, warning, error, info

**Typography**: {font_family_count} font families, {scale_count}-step scale
- Heading: {heading_font}
- Body: {body_font}
- Monospace: {mono_font}

**Spacing**: {scale_count}-step scale ({min}rem to {max}rem)

**Components**: Border radius, shadows, and component tokens defined

### Implementation Requirements
**Token Adherence**: All UI implementations MUST use design token CSS custom properties
**Accessibility**: WCAG AA compliance validated in design-tokens.json
**Responsive**: Mobile-first design using token-based breakpoints
**Component Patterns**: Follow patterns documented in style-guide.md

### Reference Prototypes
[For each selected prototype:]
- **{page_name}**: @../.design/prototypes/{prototype}.html
  - Layout: {layout_description from notes}
  - Components: {component_list from notes}
  - Token Usage: {token_usage_summary from notes}

### Design System Assets (for task-generate consumption)
```json
{
  "design_tokens": ".design/style-consolidation/design-tokens.json",
  "style_guide": ".design/style-consolidation/style-guide.md",
  "tailwind_config": ".design/style-consolidation/tailwind.config.js",
  "prototypes": [
    ".design/prototypes/{prototype-1}.html",
    ".design/prototypes/{prototype-2}.html"
  ]
}
```
```

**Implementation**:
```bash
# Edit synthesis-specification.md
Edit(
  file_path=".workflow/WFS-{session}/.brainstorming/synthesis-specification.md",
  old_string="## UI/UX Guidelines\n[existing content or empty]",
  new_string="## UI/UX Guidelines\n\n[new design system content with @ references]"
)
```

### Phase 4: Update UI Designer Analysis
**Create or update** `.brainstorming/ui-designer/style-guide.md`:

```markdown
# UI Designer Style Guide

## Design System Integration
This style guide integrates the finalized design system from the design refinement phase.

**Source Design Tokens**: @../../.design/style-consolidation/design-tokens.json
**Source Style Guide**: @../../.design/style-consolidation/style-guide.md

## Design Philosophy
[Extract philosophy section from source style-guide.md]

## Design Tokens Reference
For complete token definitions, see: @../../.design/style-consolidation/design-tokens.json

### Color System
[Summary of color tokens]

### Typography System
[Summary of typography tokens]

### Spacing System
[Summary of spacing tokens]

### Component Tokens
[Summary of component tokens: border-radius, shadows]

## Component Patterns
[Reference to style-guide.md component patterns]

## Implementation Guidelines
1. **Use CSS Custom Properties**: All styles reference design tokens
2. **Follow Semantic HTML**: Use HTML5 semantic elements
3. **Maintain Accessibility**: WCAG AA compliance required
4. **Responsive Design**: Mobile-first with token-based breakpoints

## Reference Prototypes
[Links to selected prototypes with descriptions]

---
*Auto-generated by /workflow:design:design-update*
*Last updated: {timestamp}*
```

**Implementation**:
```bash
Write(
  file_path=".workflow/WFS-{session}/.brainstorming/ui-designer/style-guide.md",
  content="[generated style guide content with @ references]"
)
```

### Phase 5: Create Design System Symlinks (Optional)
**For easier task-generate discovery**

```bash
# Create read-only mirror of key design files in brainstorming space
bash(cd .workflow/WFS-{session}/.brainstorming && \
     ln -s ../.design/style-consolidation/design-tokens.json design-tokens.json && \
     ln -s ../.design/style-consolidation/style-guide.md design-style-guide.md)
```

### Phase 6: TodoWrite Integration
```javascript
TodoWrite({
  todos: [
    {
      content: "Validate session and design system completeness",
      status: "completed",
      activeForm: "Validating design system"
    },
    {
      content: "Load design tokens, style guide, and selected prototypes",
      status: "completed",
      activeForm: "Loading design artifacts"
    },
    {
      content: "Update synthesis-specification.md with design system references",
      status: "completed",
      activeForm: "Updating synthesis specification"
    },
    {
      content: "Create or update ui-designer/style-guide.md",
      status: "completed",
      activeForm: "Updating UI designer style guide"
    },
    {
      content: "Create design system symlinks for task-generate discovery",
      status: "completed",
      activeForm: "Creating artifact symlinks"
    }
  ]
});
```

## Output Structure

**Updated Files**:
```
.workflow/WFS-{session}/.brainstorming/
├── synthesis-specification.md       # Updated with UI/UX Guidelines section
├── ui-designer/
│   └── style-guide.md               # New or updated comprehensive style guide
├── design-tokens.json               # Symlink to ../.design/style-consolidation/design-tokens.json
└── design-style-guide.md            # Symlink to ../.design/style-consolidation/style-guide.md
```

**Reference Structure** (@ references in synthesis-specification.md):
- `@../.design/style-consolidation/design-tokens.json`
- `@../.design/style-consolidation/style-guide.md`
- `@../.design/style-consolidation/tailwind.config.js`
- `@../.design/prototypes/{prototype}.html`

## Integration with task-generate

After this update, `/workflow:tools:task-generate` will discover:

**In context.artifacts**:
```json
{
  "artifacts": [
    {
      "type": "synthesis_specification",
      "path": ".brainstorming/synthesis-specification.md"
    },
    {
      "type": "design_tokens",
      "path": ".design/style-consolidation/design-tokens.json"
    },
    {
      "type": "style_guide",
      "path": ".design/style-consolidation/style-guide.md"
    },
    {
      "type": "tailwind_config",
      "path": ".design/style-consolidation/tailwind.config.js"
    },
    {
      "type": "ui_prototypes",
      "paths": [
        ".design/prototypes/dashboard-variant-1.html",
        ".design/prototypes/auth-variant-2.html"
      ]
    }
  ]
}
```

**In flow_control.pre_analysis** (for UI tasks):
```json
{
  "step": "load_design_tokens",
  "action": "Load design system tokens and style guide",
  "commands": [
    "bash(cat .workflow/WFS-{session}/.design/style-consolidation/design-tokens.json)",
    "bash(cat .workflow/WFS-{session}/.design/style-consolidation/style-guide.md)"
  ],
  "output_to": "design_system_context",
  "on_error": "warn"
}
```

## Error Handling
- **Missing design tokens**: Error, run `/workflow:ui-design:consolidate` first
- **Missing prototypes**: Error, run `/workflow:ui-design:generate` first
- **synthesis-specification.md not found**: Warning, create minimal version
- **Edit conflicts**: Preserve existing content, append design system section
- **Symlink failures**: Warning only, continue with @ references

## Validation Checks
After update, verify:
- [ ] synthesis-specification.md contains UI/UX Guidelines section
- [ ] UI/UX Guidelines include @ references to design system files
- [ ] ui-designer/style-guide.md created or updated
- [ ] design-tokens.json symlink created (if applicable)
- [ ] All referenced files exist and are readable

## Integration Points
- **Input**: design-tokens.json, style-guide.md, prototypes from design phase
- **Output**: Updated synthesis-specification.md, ui-designer/style-guide.md
- **Next Phase**: `/workflow:plan` can now discover and utilize design system

## Completion Message

```
Design system update complete for session: WFS-{session}

Updated artifacts:
✓ synthesis-specification.md - UI/UX Guidelines section added
✓ ui-designer/style-guide.md - Comprehensive style guide created
✓ Design system references: @ notation for all design files

Design system assets ready for task generation:
- design-tokens.json ({token_count} tokens)
- style-guide.md (comprehensive component patterns)
- tailwind.config.js (Tailwind theme extension)
- {prototype_count} reference prototypes

Next: /workflow:plan [--agent] "<task description>"
      The plan phase will automatically discover and utilize the design system.
```

## Main Claude Direct Execution Rationale

This command is executed directly by main Claude (not delegated to an Agent) because:

1. **Context Preservation**: Main Claude has full session context and conversation memory
2. **Integration Complexity**: Requires understanding multiple artifact relationships
3. **Reference Accuracy**: @ reference generation needs precise path resolution
4. **Synthesis Pattern**: Follows the same direct-execution pattern as `/workflow:brainstorm:synthesis`
5. **Minimal Transformation**: Primarily reference integration, not generative analysis
6. **Error Recovery**: Main Claude can better handle edit conflicts and missing files

This approach ensures reliable, context-aware integration without Agent handoff overhead.
