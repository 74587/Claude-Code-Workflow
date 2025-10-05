---
name: auto
description: Orchestrate UI design refinement workflow with interactive checkpoints for user selection
usage: /workflow:design:auto --session <session_id> --images "<glob>" --pages "<list>" [--variants <count>] [--batch-plan]
argument-hint: "--session WFS-session-id --images \"refs/*.png\" --pages \"dashboard,auth\" [--variants 2] [--batch-plan]"
examples:
  - /workflow:design:auto --session WFS-auth --images "design-refs/*.png" --pages "login,register"
  - /workflow:design:auto --session WFS-dashboard --images "refs/*.jpg" --pages "dashboard" --variants 3 --batch-plan
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*), Glob(*)
---

# UI Design Auto Workflow Command

## Overview
Semi-autonomous UI design workflow with interactive checkpoints: style extraction → **user selection** → consolidation → UI generation → **user confirmation** → design update → optional batch planning.

## Coordinator Role
**Checkpoint-based orchestrator**: Execute Phase 1 automatically, pause for user style selection, execute Phase 3, pause for user prototype confirmation, complete with optional batch task generation.

## Execution Model - Checkpoint Workflow

This workflow runs **semi-autonomously** with user checkpoints:

1. **User triggers**: `/workflow:design:auto --session WFS-xxx --images "refs/*.png" --pages "dashboard,auth" [--batch-plan]`
2. **Phase 1 executes** (style-extract) → Reports style cards → **⏸️ PAUSE FOR USER SELECTION**
3. **User selects variants** → Runs `style-consolidate --variants "..."` → Auto-continues
4. **Phase 3 executes** (ui-generate) → Reports prototypes → **⏸️ PAUSE FOR USER CONFIRMATION**
5. **User confirms prototypes** → Runs `design-update --selected-prototypes "..."` → Auto-continues
6. **Phase 5 executes** (batch-plan, optional) → Reports task files

**Checkpoint Mechanism**:
- TodoWrite tracks current phase with "awaiting_user_confirmation" status
- System reports output location and exact command for next step
- User runs provided command to continue workflow
- Workflow resumes automatically after user input

## Core Rules

1. **Start Immediately**: First action is TodoWrite initialization, second action is Phase 1 command execution
2. **No Preliminary Analysis**: Do not read files or validate before Phase 1 (commands handle their own validation)
3. **Parse Every Output**: Extract required data from each command's output for next phase
4. **Pause at Checkpoints**: After Phase 1 and Phase 3, pause and prompt user with exact command to continue
5. **User-Driven Continuation**: Workflow resumes when user runs style-consolidate or design-update commands
6. **Track Progress**: Update TodoWrite after every phase completion and checkpoint

## Parameter Requirements

**Required Parameters**:
- `--session <session_id>`: Active workflow session ID
- `--images "<glob_pattern>"`: Reference image paths for style extraction
- `--pages "<page_list>"`: Comma-separated list of pages to generate

**Optional Parameters**:
- `--variants <count>`: Number of UI variants per page (default: 1)
- `--batch-plan`: Auto-generate implementation tasks for selected prototypes after design-update

## 5-Phase Execution

### Phase 1: Style Extraction
**Command**: `SlashCommand(command="/workflow:design:style-extract --session {session_id} --images \"{image_glob}\"")`

**Parse Output**:
- Verify: `.design/style-extraction/style-cards.json` created
- Extract: `style_cards_count` from output message
- List available style variant IDs

**Validation**:
- Style cards successfully generated
- At least one style variant available

**TodoWrite**: Mark phase 1 completed, mark checkpoint "awaiting_user_confirmation"

**⏸️ CHECKPOINT 1: Pause for User Style Selection**

```
Phase 1 Complete: Style Extraction
Style cards generated: {count}
Available variants: {variant_ids}
Location: .workflow/WFS-{session}/.design/style-extraction/

⏸️  USER SELECTION REQUIRED
Review style cards and select your preferred variants.
Then run:

/workflow:design:style-consolidate --session WFS-{session} --variants "{variant_ids}"

Example: /workflow:design:style-consolidate --session WFS-{session} --variants "variant-1,variant-3"
```

---

### Phase 2: Style Consolidation (User-Triggered)
**User Command**: `/workflow:design:style-consolidate --session {session_id} --variants "{selected_variants}"`

**After user runs command**:
- Workflow automatically continues to Phase 3
- Parse output: token_count, validation_status

**TodoWrite**: Mark phase 2 completed, phase 3 in_progress

**Output**:
```
Phase 2 Complete: Style Consolidation
Design tokens: {count}
Validation: {pass|warnings}
Location: .workflow/WFS-{session}/.design/style-consolidation/

Continuing to Phase 3: UI Generation...
```

---

### Phase 3: UI Generation (Auto-Triggered after Phase 2)
**Command Construction**:

```bash
variants_flag = --variants present ? "--variants {variants_count}" : ""
command = "/workflow:design:ui-generate --session {session_id} --pages \"{page_list}\" {variants_flag}"
```

**Command**: `SlashCommand(command="{constructed_command}")`

**Parse Output**:
- Verify: `.design/prototypes/*.html` files created
- Extract: `prototype_count`, `page_list`, `generated_files` list

**Validation**:
- All requested pages generated
- HTML and CSS files present for each variant

**TodoWrite**: Mark phase 3 completed, mark checkpoint "awaiting_user_confirmation"

**⏸️ CHECKPOINT 2: Pause for User Prototype Confirmation**

```
Phase 3 Complete: UI Generation
Prototypes generated: {count} ({page_list})
Generated files: {file_list}
Location: .workflow/WFS-{session}/.design/prototypes/

⏸️  USER CONFIRMATION REQUIRED
Review the generated prototypes and select your preferred variants.
Then run:

/workflow:design:design-update --session WFS-{session} --selected-prototypes "{prototype_ids}"

Example: /workflow:design:design-update --session WFS-{session} --selected-prototypes "dashboard-variant-1,auth-variant-2"

Or to use all generated prototypes:
/workflow:design:design-update --session WFS-{session}
```

---

### Phase 4: Design System Integration (User-Triggered)
**User Command**: `/workflow:design:design-update --session {session_id} [--selected-prototypes "{selected_prototypes}"]`

**After user runs command**:
- Workflow updates brainstorming artifacts
- If --batch-plan flag present, automatically continues to Phase 5

**Parse Output**:
- Verify: `synthesis-specification.md` updated
- Verify: `ui-designer/style-guide.md` created/updated

**TodoWrite**: Mark phase 4 completed

**Output** (if --batch-plan NOT present):
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

**Output** (if --batch-plan present):
```
Phase 4 Complete: Design System Integration
Updated Artifacts:
✓ synthesis-specification.md
✓ ui-designer/style-guide.md

Continuing to Phase 5: Batch Task Generation...
```

---

### Phase 5: Batch Task Generation (Optional, Auto-Triggered if --batch-plan)
**Condition**: Only executes if `--batch-plan` flag present

**Execution**:
```bash
FOR each page IN selected_prototypes_pages:
  SlashCommand(command="/workflow:plan --agent \"Implement {page} page based on design system\"")

  # Parse output task file location
  task_files.add(output_location)
```

**TodoWrite**: Mark phase 5 completed

**Return to User**:
```
Phase 5 Complete: Batch Task Generation
Tasks generated for: {page_count} pages

Generated task files:
{task_file_list}

Design workflow complete for session: WFS-{session}

Next: /workflow:execute
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
