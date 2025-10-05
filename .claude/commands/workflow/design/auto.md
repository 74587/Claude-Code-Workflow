---
name: auto
description: Orchestrate complete UI design refinement workflow from style extraction to brainstorming integration
usage: /workflow:design:auto --session <session_id> --images "<glob>" --pages "<list>" [--interactive] [--variants <count>]
argument-hint: "--session WFS-session-id --images \"refs/*.png\" --pages \"dashboard,auth\" [--interactive] [--variants 2]"
examples:
  - /workflow:design:auto --session WFS-auth --images "design-refs/*.png" --pages "login,register" --interactive
  - /workflow:design:auto --session WFS-dashboard --images "refs/*.jpg" --pages "dashboard" --variants 3
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*)
---

# UI Design Auto Workflow Command

## Overview
Complete autonomous orchestration of UI design refinement workflow: style extraction → consolidation → UI generation → brainstorming integration.

## Coordinator Role
**Pure orchestrator following /workflow:plan pattern**: Execute 4 design commands in sequence with TodoWrite-driven auto-continuation, no user intervention required.

## Execution Model - Auto-Continue Workflow

This workflow runs **fully autonomously** once triggered:

1. **User triggers**: `/workflow:design:auto --session WFS-xxx --images "refs/*.png" --pages "dashboard,auth"`
2. **Phase 1 executes** (style-extract) → Reports output → Auto-continues
3. **Phase 2 executes** (style-consolidate) → Reports output → Auto-continues
4. **Phase 3 executes** (ui-generate) → Reports output → Auto-continues
5. **Phase 4 executes** (design-update) → Reports final summary

**Auto-Continue Mechanism**:
- TodoWrite tracks current phase status
- After each phase completion, automatically executes next pending phase
- **No user action required** - workflow runs end-to-end autonomously
- Progress updates shown at each phase for visibility

## Core Rules

1. **Start Immediately**: First action is TodoWrite initialization, second action is Phase 1 command execution
2. **No Preliminary Analysis**: Do not read files or validate before Phase 1 (commands handle their own validation)
3. **Parse Every Output**: Extract required data from each command's output for next phase
4. **Auto-Continue via TodoWrite**: Check TodoWrite status to execute next pending phase automatically
5. **Track Progress**: Update TodoWrite after every phase completion

## Parameter Requirements

**Required Parameters**:
- `--session <session_id>`: Active workflow session ID
- `--images "<glob_pattern>"`: Reference image paths for style extraction
- `--pages "<page_list>"`: Comma-separated list of pages to generate

**Optional Parameters**:
- `--interactive`: Enable interactive style variant selection (default: auto-select first variant)
- `--variants <count>`: Number of UI variants per page (default: 1)

## 4-Phase Execution

### Phase 1: Style Extraction
**Command**: `SlashCommand(command="/workflow:design:style-extract --session {session_id} --images \"{image_glob}\"")`

**Parse Output**:
- Verify: `.design/style-extraction/style-cards.json` created
- Extract: `style_cards_count` from output message

**Validation**:
- Style cards successfully generated
- At least one style variant available

**TodoWrite**: Mark phase 1 completed, phase 2 in_progress

**After Phase 1**: Report to user, auto-continue to Phase 2

```
Phase 1 Complete: Style Extraction
Style cards generated: {count}
Location: .workflow/WFS-{session}/.design/style-extraction/

Continuing to Phase 2: Style Consolidation...
```

---

### Phase 2: Style Consolidation
**Command Construction**:

```bash
IF --interactive flag present:
    command = "/workflow:design:style-consolidate --session {session_id} --interactive"
ELSE:
    # Auto-select first variant
    command = "/workflow:design:style-consolidate --session {session_id} --variants \"variant-1\""
```

**Command**: `SlashCommand(command="{constructed_command}")`

**Parse Output**:
- Verify: `.design/style-consolidation/design-tokens.json` created
- Extract: `token_count`, `validation_status` from output message

**Validation**:
- Design tokens finalized
- Validation report shows no critical errors

**TodoWrite**: Mark phase 2 completed, phase 3 in_progress

**After Phase 2**: Report to user, auto-continue to Phase 3

```
Phase 2 Complete: Style Consolidation
Design tokens: {count}
Validation: {pass|warnings}
Location: .workflow/WFS-{session}/.design/style-consolidation/

Continuing to Phase 3: UI Generation...
```

---

### Phase 3: UI Generation
**Command Construction**:

```bash
variants_flag = --variants present ? "--variants {variants_count}" : ""
command = "/workflow:design:ui-generate --session {session_id} --pages \"{page_list}\" {variants_flag}"
```

**Command**: `SlashCommand(command="{constructed_command}")`

**Parse Output**:
- Verify: `.design/prototypes/*.html` files created
- Extract: `prototype_count`, `page_list` from output message

**Validation**:
- All requested pages generated
- HTML and CSS files present for each variant

**TodoWrite**: Mark phase 3 completed, phase 4 in_progress

**After Phase 3**: Report to user, auto-continue to Phase 4

```
Phase 3 Complete: UI Generation
Prototypes generated: {count}
Pages: {page_list}
Location: .workflow/WFS-{session}/.design/prototypes/

Continuing to Phase 4: Design System Integration...
```

---

### Phase 4: Design System Integration
**Command**: `SlashCommand(command="/workflow:design:design-update --session {session_id}")`

**Parse Output**:
- Verify: `synthesis-specification.md` updated
- Verify: `ui-designer/style-guide.md` created/updated

**Validation**:
- Brainstorming artifacts successfully updated
- Design system references integrated

**TodoWrite**: Mark phase 4 completed

**Return to User**:
```
UI Design Refinement Complete for session: WFS-{session}

Design System Summary:
- Tokens: {token_count} (OKLCH-based)
- Prototypes: {prototype_count} ({page_list})
- Validation: {pass|warnings}

Updated Artifacts:
✓ synthesis-specification.md (UI/UX Guidelines section)
✓ ui-designer/style-guide.md (comprehensive style guide)
✓ Design tokens ready for task generation

Location: .workflow/WFS-{session}/.design/

Next Steps:
1. Review prototypes: .workflow/WFS-{session}/.design/prototypes/
2. Continue to planning: /workflow:plan [--agent] "<task description>"
   (The plan phase will automatically discover and utilize the design system)
```

## TodoWrite Pattern

```javascript
// Initialize (before Phase 1)
TodoWrite({todos: [
  {"content": "Execute style extraction from reference images", "status": "in_progress", "activeForm": "Executing style extraction"},
  {"content": "Execute style consolidation and token validation", "status": "pending", "activeForm": "Executing style consolidation"},
  {"content": "Execute UI prototype generation", "status": "pending", "activeForm": "Executing UI generation"},
  {"content": "Execute design system integration to brainstorming", "status": "pending", "activeForm": "Executing design system integration"}
]})

// After Phase 1
TodoWrite({todos: [
  {"content": "Execute style extraction from reference images", "status": "completed", "activeForm": "Executing style extraction"},
  {"content": "Execute style consolidation and token validation", "status": "in_progress", "activeForm": "Executing style consolidation"},
  {"content": "Execute UI prototype generation", "status": "pending", "activeForm": "Executing UI generation"},
  {"content": "Execute design system integration to brainstorming", "status": "pending", "activeForm": "Executing design system integration"}
]})

// Continue pattern for Phase 2, 3, 4...
```

## Parameter Processing

### Session Validation
```bash
# Verify active session
CHECK: .workflow/.active-* marker files
VERIFY: session_id parameter matches active session
IF mismatch:
    ERROR: "Session {session_id} is not active. Active session: {active_session_id}"
```

### Image Glob Expansion
```bash
# Expand glob pattern
expanded_paths = bash(ls {image_glob})
IF no files found:
    ERROR: "No images found matching pattern: {image_glob}"
VALIDATE: All files are image formats (.png, .jpg, .jpeg, .webp)
```

### Page List Parsing
```bash
# Parse comma-separated page list
pages = split(page_list, ",")
TRIM: whitespace from each page name
VALIDATE: page_list not empty
```

## Data Flow

```
User Input
  ├── session_id
  ├── image_glob → expanded_image_paths
  ├── page_list → parsed_pages[]
  ├── --interactive → interactive_mode (bool)
  └── --variants → variants_count (int)
    ↓
Phase 1: style-extract
  Input: session_id, expanded_image_paths
  Output: style-cards.json
    ↓
Phase 2: style-consolidate
  Input: session_id, interactive_mode | auto-select
  Output: design-tokens.json, style-guide.md, tailwind.config.js
    ↓
Phase 3: ui-generate
  Input: session_id, parsed_pages[], variants_count
  Output: {page}-variant-{n}.html/css for each page
    ↓
Phase 4: design-update
  Input: session_id
  Output: Updated synthesis-specification.md, ui-designer/style-guide.md
    ↓
Return summary to user
```

## Error Handling

**Phase Execution Failures**:
- **Keep phase `in_progress`**: Do not proceed to next phase
- **Report error to user**: Include specific failure message from command
- **Provide recovery instructions**: Suggest manual command execution with corrected parameters

**Common Errors**:
1. **Session not found**: Verify session exists and is active
2. **No images found**: Check image glob pattern and file paths
3. **Style extraction failed**: Retry with different images or manual style description
4. **Consolidation validation errors**: Review validation-report.json and address token issues
5. **UI generation failed**: Check synthesis-specification.md for requirements clarity
6. **Integration conflicts**: Review synthesis-specification.md edit conflicts

## Workflow Position

**In Complete Development Flow**:
```
/workflow:brainstorm:auto-parallel "{topic}"
    ↓ Generates synthesis-specification.md (WHAT)
    ↓
/workflow:design:auto --session WFS-xxx --images "refs/*.png" --pages "dashboard,auth"
    ↓ Refines visual design (WHAT → Visual Spec)
    ↓
/workflow:plan [--agent] "{task description}"
    ↓ Generates task breakdown (HOW)
    ↓
/workflow:execute
    ↓ Implements tasks with design system
```

**Key Benefits**:
1. **Visual Validation**: Users confirm design before implementation
2. **Token Enforcement**: Implementation strictly follows design system
3. **Accessibility**: WCAG AA validated at design phase
4. **Consistency**: Single source of truth for visual design

## Coordinator Checklist

✅ Initialize TodoWrite before any command execution
✅ Validate session parameter before Phase 1
✅ Expand image glob to concrete paths
✅ Parse page list to array
✅ Execute Phase 1 immediately (no preliminary analysis)
✅ Parse style card count from Phase 1 output
✅ Construct Phase 2 command based on --interactive flag
✅ Parse token count and validation status from Phase 2
✅ Construct Phase 3 command with variants parameter
✅ Parse prototype count from Phase 3 output
✅ Execute Phase 4 design system integration
✅ Verify all artifacts updated successfully
✅ Update TodoWrite after each phase
✅ After each phase, automatically continue to next phase based on TodoWrite status

## Integration Notes

**Seamless Workflow Transition**:
- Design phase is **optional but recommended** for UI-heavy projects
- Can be skipped entirely if visual design is not critical
- Brainstorming → Plan flow still works without design phase
- Design artifacts automatically discovered by task-generate if present

**Use Cases**:
- **Use design workflow**: User-facing applications, design systems, brand-critical UIs
- **Skip design workflow**: Backend APIs, CLI tools, prototypes, MVPs

**Artifact Discovery**:
- `task-generate` automatically detects `.design/` directory
- If present, adds design system to task context.artifacts
- UI tasks automatically include `load_design_tokens` in flow_control

This design ensures backward compatibility while enabling powerful visual design workflows when needed.
