---
name: workflow:ui-design:codify-style
description: Orchestrator to extract styles from code and generate shareable reference package with preview
argument-hint: "[--source <path>] [--package-name <name>] [--css \"<glob>\"] [--scss \"<glob>\"] [--js \"<glob>\"] [--html \"<glob>\"] [--style-files \"<glob>\"] [--output-dir <path>]"
allowed-tools: SlashCommand,Bash,Read,TodoWrite
auto-continue: true
---

# UI Design: Codify Style (Orchestrator)

## Overview

**Pure Orchestrator**: Coordinates style extraction and reference package generation workflow.

**Role**: Does NOT directly execute agent tasks. Delegates to specialized commands:
1. `/workflow:ui-design:import-from-code` - Extract styles from code
2. `/workflow:ui-design:reference-page-generator` - Generate reference package with preview

**Output**: Shareable, versioned style reference package at `.workflow/reference_style/{package-name}/`

## Auto-Continue Workflow

This command runs **fully autonomously** once triggered. Each phase completes and automatically triggers the next phase without user interaction.

## Core Rules

1. **Start Immediately**: First action is TodoWrite initialization, second action is Phase 1 execution
2. **No Task JSON**: This command does not create task JSON files - delegates to sub-commands
3. **Parse Every Output**: Extract required data from each command output (design run path, session ID)
4. **Auto-Continue**: After completing each phase, update TodoWrite and immediately execute next phase
5. **Track Progress**: Update TodoWrite after EVERY phase completion before starting next phase

---

## Usage

### Command Syntax

```bash
/workflow:ui-design:codify-style [FLAGS]

# Flags
--source <path>         Source code directory to analyze (required)
--package-name <name>   Name for the style reference package (required)
--css "<glob>"          CSS file glob pattern (optional)
--scss "<glob>"         SCSS file glob pattern (optional)
--js "<glob>"           JavaScript file glob pattern (optional)
--html "<glob>"         HTML file glob pattern (optional)
--style-files "<glob>"  Universal style file glob (optional)
--output-dir <path>     Output directory (default: .workflow/reference_style)
--overwrite             Overwrite existing package without prompting (optional)
```

### Usage Examples

```bash
# Basic usage - analyze entire src directory
/workflow:ui-design:codify-style --source ./src --package-name main-app-style-v1

# Specific directories
/workflow:ui-design:codify-style --source ./app --package-name design-system-v2 --css "styles/**/*.scss" --js "theme/*.js"

# Tailwind config extraction
/workflow:ui-design:codify-style --source ./ --package-name tailwind-theme-v1 --js "tailwind.config.js"

# Custom output directory
/workflow:ui-design:codify-style --source ./src --package-name component-lib-v1 --output-dir ./style-references
```

---

## 4-Phase Execution

### Phase 1: Prepare Arguments

**Goal**: Parse command arguments and prepare session

**TodoWrite** (First Action):
```json
[
  {"content": "Parse arguments and prepare session", "status": "in_progress", "activeForm": "Parsing arguments"},
  {"content": "Call import-from-code to extract styles", "status": "pending", "activeForm": "Extracting styles"},
  {"content": "Generate reference pages and documentation", "status": "pending", "activeForm": "Generating reference"},
  {"content": "Cleanup temporary files", "status": "pending", "activeForm": "Cleanup"}
]
```

**Step 1: Validate Required Parameters**

```bash
bash(test)
```

Operations:
```javascript
// Validate required parameters
if (!source || !package_name) {
  error("ERROR: --source and --package-name are required")
  error("USAGE: /workflow:ui-design:codify-style --source <path> --package-name <name>")
  exit(1)
}

// Validate package name format (lowercase, alphanumeric, hyphens only)
if (!package_name.match(/^[a-z0-9][a-z0-9-]*$/)) {
  error("ERROR: Invalid package name. Use lowercase, alphanumeric, and hyphens only.")
  error("EXAMPLE: main-app-style-v1")
  exit(1)
}
```

**Step 2: Check Package Overwrite Protection**

```bash
bash(test -d ${output_dir:-".workflow/reference_style"}/${package_name} && echo "exists" || echo "not_exists")
```

**Overwrite Protection Logic**:
```javascript
// Check if package already exists
if (package_exists && !overwrite_flag) {
  error("ERROR: Package '${package_name}' already exists at ${output_dir}/${package_name}")
  error("HINT: To overwrite, use --overwrite flag")
  error("HINT: Or choose a different package name")
  error("Existing package contents:")
  bash(ls -1 ${output_dir}/${package_name}/ 2>/dev/null | head -10)
  exit(1)
}

if (overwrite_flag && package_exists) {
  echo("WARNING: Overwriting existing package: ${package_name}")
}
```

**Step 3: Create Temporary Session**

```bash
bash(mkdir -p .workflow && echo "WFS-codify-$(date +%Y%m%d-%H%M%S)")
```

Store result as `temp_session_id`

**Step 4: Create Temporary Design Run**

```bash
bash(mkdir -p .workflow/${temp_session_id} && echo "design-run-$(date +%Y%m%d-%H%M%S)")
```

Store result as `temp_design_run_id`

**Step 5: Prepare Full Design Run Path**

```bash
bash(cd .workflow/${temp_session_id} && mkdir -p ${temp_design_run_id} && pwd)/${temp_design_run_id}
```

Store result as `design_run_path`

**Summary Variables**:
- `SOURCE`: User-provided source path
- `PACKAGE_NAME`: User-provided package name
- `OUTPUT_DIR`: `.workflow/reference_style` (default) or user-specified
- `OVERWRITE`: `true` if --overwrite flag, `false` otherwise
- `CSS`: CSS glob pattern (optional)
- `SCSS`: SCSS glob pattern (optional)
- `JS`: JS glob pattern (optional)
- `HTML`: HTML glob pattern (optional)
- `STYLE_FILES`: Universal style files glob (optional)
- `TEMP_SESSION_ID`: `WFS-codify-{timestamp}`
- `TEMP_DESIGN_RUN_ID`: `design-run-{timestamp}`
- `DESIGN_RUN_PATH`: `.workflow/{temp_session_id}/{temp_design_run_id}`

**TodoWrite Update**:
```json
[
  {"content": "Parse arguments and prepare session", "status": "completed", "activeForm": "Parsing arguments"},
  {"content": "Call import-from-code to extract styles", "status": "in_progress", "activeForm": "Extracting styles"}
]
```

**Next Action**: Display preparation results → Continue to Phase 2

---

### Phase 2: Call import-from-code

**Goal**: Extract styles from source code using import-from-code command

**Command Construction**:

Build command string with all parameters:
```javascript
let cmd = `/workflow:ui-design:import-from-code --design-id ${temp_design_run_id} --source ${source}`;

// Add optional glob patterns if provided
if (css) cmd += ` --css "${css}"`;
if (scss) cmd += ` --scss "${scss}"`;
if (js) cmd += ` --js "${js}"`;
if (html) cmd += ` --html "${html}"`;
if (style_files) cmd += ` --style-files "${style_files}"`;
```

**Execute Command**:

```bash
SlashCommand(command="${cmd}")
```

**Example Commands**:
```bash
# Basic
/workflow:ui-design:import-from-code --design-id design-run-20250111-123456 --source ./src

# With glob patterns
/workflow:ui-design:import-from-code --design-id design-run-20250111-123456 --source ./src --css "theme/*.css" --js "theme/*.js"

# With style-files
/workflow:ui-design:import-from-code --design-id design-run-20250111-123456 --source ./src --style-files "**/theme.*"
```

**Parse Output**:

The import-from-code command will output design run path. Extract it if needed, or use the pre-constructed path from Phase 1.

**Completion Criteria**:
- `import-from-code` command executed successfully
- Design run created at `${design_run_path}`
- Style extraction files exist:
  - `${design_run_path}/style-extraction/style-1/design-tokens.json`
  - `${design_run_path}/style-extraction/style-1/style-guide.md`
  - `${design_run_path}/animation-extraction/` (optional)

**TodoWrite Update**:
```json
[
  {"content": "Call import-from-code to extract styles", "status": "completed", "activeForm": "Extracting styles"},
  {"content": "Generate reference pages and documentation", "status": "in_progress", "activeForm": "Generating reference"}
]
```

**Next Action**: Display extraction results → Auto-continue to Phase 3

---

### Phase 3: Generate Reference Package

**Goal**: Generate reference pages and package documentation

**Command**:

```bash
SlashCommand(command="/workflow:ui-design:reference-page-generator --design-run ${design_run_path} --package-name ${package_name} --output-dir ${output_dir}")
```

**Example**:
```bash
/workflow:ui-design:reference-page-generator --design-run .workflow/WFS-codify-20250111-123456/design-run-20250111-123456 --package-name main-app-style-v1 --output-dir .workflow/reference_style
```

**Completion Criteria**:
- `reference-page-generator` command executed successfully
- Reference package created at `${output_dir}/${package_name}/`
- Required files exist:
  - `design-tokens.json`
  - `component-patterns.json`
  - `preview.html`
  - `preview.css`
  - `metadata.json`
  - `README.md`

**TodoWrite Update**:
```json
[
  {"content": "Generate reference pages and documentation", "status": "completed", "activeForm": "Generating reference"},
  {"content": "Cleanup temporary files", "status": "in_progress", "activeForm": "Cleanup"}
]
```

**Next Action**: Display generation results → Auto-continue to Phase 4

---

### Phase 4: Cleanup & Report

**Goal**: Clean up temporary design run and report completion

**Step 1: Cleanup Temporary Design Run** (Optional)

```bash
bash(rm -rf .workflow/${temp_session_id})
```

Note: Temporary design run is removed as reference package has all needed files.

**Step 2: Verify Package**

```bash
bash(test -d ${output_dir}/${package_name} && echo "exists" || echo "missing")
```

**Step 3: Count Components**

```bash
bash(jq -r '.extraction_metadata.component_count // 0' ${output_dir}/${package_name}/component-patterns.json 2>/dev/null || echo 0)
```

**Fallback** (if jq not available):
```bash
bash(grep -c '"button"\|"input"\|"card"\|"badge"\|"alert"' ${output_dir}/${package_name}/component-patterns.json 2>/dev/null || echo 0)
```

**TodoWrite Update**:
```json
[
  {"content": "Parse arguments and prepare session", "status": "completed", "activeForm": "Parsing arguments"},
  {"content": "Call import-from-code to extract styles", "status": "completed", "activeForm": "Extracting styles"},
  {"content": "Generate reference pages and documentation", "status": "completed", "activeForm": "Generating reference"},
  {"content": "Cleanup temporary files", "status": "completed", "activeForm": "Cleanup"}
]
```

**Final Action**: Report completion summary to user

---

## Completion Message

```
✅ Style reference package codified successfully!

Package: {package_name}
Location: {output_dir}/{package_name}/

Generated Files:
✓ design-tokens.json       Complete design token system
✓ style-guide.md          Detailed style guide
✓ component-patterns.json  Component catalog ({component_count} components)
✓ preview.html            Interactive multi-component showcase
✓ preview.css             Showcase styling
✓ animation-tokens.json   Animation tokens {if exists: "✓" else: "○ (not found)"}
✓ metadata.json           Package metadata
✓ README.md               Package documentation

Source Analysis:
- Source path: {source}
- Extraction complete via import-from-code

Preview Package:
Open the interactive showcase:
  file://{absolute_path_to_package}/preview.html

Or use a local server:
  cd {output_dir}/{package_name}
  python -m http.server 8080
  # Then open http://localhost:8080/preview.html

Next Steps:
1. Review preview.html to verify extracted components
2. Generate SKILL memory: /memory:style-skill-memory {package_name}
3. Use package as design reference in future workflows

Cleanup:
✓ Temporary design run removed (all files copied to reference package)
```

---

## Execution Flow Diagram

```
User triggers: /workflow:ui-design:codify-style --source ./src --package-name my-style-v1
  ↓
[TodoWrite] Initialize 4 phases (Phase 1 = in_progress)
  ↓
[Execute] Phase 1: Parse arguments, create temp session/design run
  ↓
[TodoWrite] Phase 1 = completed, Phase 2 = in_progress
  ↓
[Execute] Phase 2: SlashCommand(/workflow:ui-design:import-from-code ...)
  ↓
[TodoWrite] Phase 2 = completed, Phase 3 = in_progress
  ↓
[Execute] Phase 3: SlashCommand(/workflow:ui-design:reference-page-generator ...)
  ↓
[TodoWrite] Phase 3 = completed, Phase 4 = in_progress
  ↓
[Execute] Phase 4: Cleanup temp files, verify package
  ↓
[TodoWrite] Phase 4 = completed
  ↓
[Report] Display completion summary
```

---

## Error Handling

### Common Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| Missing --source or --package-name | Required parameters not provided | Provide both flags |
| Invalid package name | Contains uppercase, special chars | Use lowercase, alphanumeric, hyphens only |
| import-from-code failed | Source path invalid or no files found | Verify source path, check glob patterns |
| reference-page-generator failed | Design run incomplete | Check import-from-code output, verify extraction files |
| Package verification failed | Output directory creation failed | Check file permissions |

### Error Recovery

- If Phase 2 fails: Cleanup temporary session and report error
- If Phase 3 fails: Keep design run for debugging, report error
- User can manually inspect `${design_run_path}` if needed

---

## Implementation Details

### Critical Rules

1. **No User Prompts Between Phases**: Never ask user questions or wait for input between phases
2. **Immediate Phase Transition**: After TodoWrite update, immediately execute next phase command
3. **Status-Driven Execution**: Check TodoList status after each phase
4. **Phase Completion Pattern**:
   ```
   Phase N completes → Update TodoWrite (N=completed, N+1=in_progress) → Execute Phase N+1
   ```

### Parameter Pass-Through

All glob parameters are passed through to `import-from-code`:
- `--css` → passed to import-from-code
- `--scss` → passed to import-from-code
- `--js` → passed to import-from-code
- `--html` → passed to import-from-code
- `--style-files` → passed to import-from-code

### Output Directory Structure

```
.workflow/
├── reference_style/              # Default output directory
│   └── {package-name}/
│       ├── design-tokens.json
│       ├── style-guide.md
│       ├── component-patterns.json
│       ├── animation-tokens.json (optional)
│       ├── preview.html
│       ├── preview.css
│       ├── metadata.json
│       └── README.md
│
└── WFS-codify-{timestamp}/       # Temporary session (cleaned up)
    └── design-run-{timestamp}/   # Temporary design run (cleaned up)
```

---

## Benefits

- **Pure Orchestrator**: No direct agent execution, delegates to specialized commands
- **Auto-Continue**: Autonomous 4-phase execution without user interaction
- **Code Reuse**: Leverages existing `import-from-code` command
- **Clean Separation**: Each command has single responsibility
- **Easy Maintenance**: Changes to sub-commands automatically apply
- **Flexible**: Supports all import-from-code glob parameters

## Architecture

```
codify-style (orchestrator)
  ├─ Phase 1: Prepare (bash commands, parameter validation)
  ├─ Phase 2: /workflow:ui-design:import-from-code (style extraction)
  ├─ Phase 3: /workflow:ui-design:reference-page-generator (reference package)
  └─ Phase 4: Cleanup (remove temp files, report)

No task JSON created by this command
All extraction delegated to import-from-code
All packaging delegated to reference-page-generator
```
