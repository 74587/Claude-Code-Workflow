---
name: workflow:ui-design:codify-style
description: Orchestrator to extract styles from code and generate shareable reference package with preview (automatic file discovery)
argument-hint: "<path> [--package-name <name>] [--output-dir <path>] [--overwrite]"
allowed-tools: SlashCommand,Bash,Read,TodoWrite
auto-continue: true
---

# UI Design: Codify Style (Orchestrator)

## Overview & Execution Model

**Fully autonomous orchestrator**: Coordinates style extraction from codebase and generates shareable reference packages.

**Pure Orchestrator Pattern**: Does NOT directly execute agent tasks. Delegates to specialized commands:
1. `/workflow:ui-design:import-from-code` - Extract styles from source code
2. `/workflow:ui-design:reference-page-generator` - Generate versioned reference package with interactive preview

**Output**: Shareable, versioned style reference package at `.workflow/reference_style/{package-name}/`

**Autonomous Flow** (⚠️ CONTINUOUS EXECUTION - DO NOT STOP):
1. User triggers: `/workflow:ui-design:codify-style <path> --package-name <name>`
2. Phase 0: Parameter validation & preparation → **IMMEDIATELY triggers Phase 1**
3. Phase 1 (import-from-code) → **Execute phase (blocks until finished)** → Auto-continues to Phase 2
4. Phase 2 (reference-page-generator) → **Execute phase (blocks until finished)** → Auto-continues to Phase 3
5. Phase 3 (cleanup & verification) → Reports completion

**Phase Transition Mechanism**:
- **Phase 0 (Validation)**: Validate parameters, prepare workspace → IMMEDIATELY triggers Phase 1
- **Phase 1-3 (Autonomous)**: `SlashCommand` is BLOCKING - execution pauses until the command finishes
- When each phase finishes executing: Automatically process output and execute next phase
- No user interaction required after initial command

**Auto-Continue Mechanism**: TodoWrite tracks phase status. When each phase finishes executing, you MUST immediately construct and execute the next phase command. No user intervention required. The workflow is NOT complete until reaching Phase 3.

## Core Rules

1. **Start Immediately**: TodoWrite initialization → Phase 0 validation → Phase 1 execution
2. **No Task JSON**: This command does not create task JSON files - pure orchestrator pattern
3. **Parse & Pass**: Extract required data from each command output (design run path, metadata)
4. **Intelligent Validation**: Smart parameter validation with user-friendly error messages
5. **Safety First**: Package overwrite protection, existence checks, fallback error handling
6. **Track Progress**: Update TodoWrite after EVERY phase completion before starting next phase
7. **⚠️ CRITICAL: DO NOT STOP** - This is a continuous multi-phase workflow. Each SlashCommand execution blocks until finished, then you MUST immediately execute the next phase. Workflow is NOT complete until Phase 3.

---

## Usage

### Command Syntax

```bash
/workflow:ui-design:codify-style <path> [OPTIONS]

# Required
<path>                  Source code directory to analyze

# Optional
--package-name <name>   Custom name for the style reference package
                        (default: auto-generated from directory name)
--output-dir <path>     Output directory (default: .workflow/reference_style)
--overwrite             Overwrite existing package without prompting
```

**Note**: File discovery is fully automatic. The command will scan the source directory and find all style-related files (CSS, SCSS, JS, HTML) automatically.

### Usage Examples

```bash
# Simplest usage - single path parameter
/workflow:ui-design:codify-style ./src
# Auto-generates package name: "src-style-v1"
# Auto-discovers all style files in ./src

# With custom package name
/workflow:ui-design:codify-style ./app --package-name design-system-v2

# Root directory analysis (e.g., for Tailwind config)
/workflow:ui-design:codify-style ./ --package-name tailwind-theme-v1

# Custom output directory
/workflow:ui-design:codify-style ./src --package-name component-lib-v1 --output-dir ./style-references

# Overwrite existing package
/workflow:ui-design:codify-style ./src --overwrite
```

---

## 4-Phase Execution

### Phase 0: Intelligent Parameter Validation & Session Preparation

**Goal**: Validate parameters, check safety constraints, prepare session, and get user confirmation

**TodoWrite** (First Action):
```json
[
  {"content": "Validate parameters and prepare session", "status": "in_progress", "activeForm": "Validating parameters"},
  {"content": "Extract styles from source code", "status": "pending", "activeForm": "Extracting styles"},
  {"content": "Generate reference package with preview", "status": "pending", "activeForm": "Generating reference"},
  {"content": "Cleanup and verify package", "status": "pending", "activeForm": "Cleanup and verification"}
]
```

**Step 0a: Parse and Validate Required Parameters**

```bash
# Parse positional path parameter (first non-flag argument)
source_path = FIRST_POSITIONAL_ARG

# Validate source path
IF NOT source_path:
    REPORT: "❌ ERROR: Missing required parameter: <path>"
    REPORT: "USAGE: /workflow:ui-design:codify-style <path> [OPTIONS]"
    REPORT: "EXAMPLE: /workflow:ui-design:codify-style ./src"
    REPORT: "EXAMPLE: /workflow:ui-design:codify-style ./app --package-name design-system-v2"
    EXIT 1

# Validate source path existence
TRY:
    source_exists = Bash(test -d "${source_path}" && echo "exists" || echo "not_exists")
    IF source_exists != "exists":
        REPORT: "❌ ERROR: Source directory not found: ${source_path}"
        REPORT: "Please provide a valid directory path."
        EXIT 1
CATCH error:
    REPORT: "❌ ERROR: Cannot validate source path: ${error}"
    EXIT 1

source = source_path
STORE: source

# Auto-generate package name if not provided
IF NOT --package-name:
    # Extract directory name from path
    dir_name = Bash(basename "${source}")
    # Normalize to package name format (lowercase, replace special chars with hyphens)
    normalized_name = dir_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    # Add version suffix
    package_name = "${normalized_name}-style-v1"

    ELSE:
    package_name = --package-name

    # Validate custom package name format (lowercase, alphanumeric, hyphens only)
    IF NOT package_name MATCHES /^[a-z0-9][a-z0-9-]*$/:
        REPORT: "❌ ERROR: Invalid package name format: ${package_name}"
        REPORT: "Requirements:"
        REPORT: "  • Must start with lowercase letter or number"
        REPORT: "  • Only lowercase letters, numbers, and hyphens allowed"
        REPORT: "  • No spaces or special characters"
        REPORT: "EXAMPLES: main-app-style-v1, design-system-v2, component-lib-v1"
        EXIT 1

STORE: package_name, output_dir (default: ".workflow/reference_style"), overwrite_flag
```

**Step 0b: Intelligent Package Safety Check**

```bash
# Set default output directory
output_dir = --output-dir OR ".workflow/reference_style"
package_path = "${output_dir}/${package_name}"

TRY:
    package_exists = Bash(test -d "${package_path}" && echo "exists" || echo "not_exists")

    IF package_exists == "exists":
        IF NOT --overwrite:
            REPORT: "❌ ERROR: Package '${package_name}' already exists at ${package_path}/"
            REPORT: "Use --overwrite flag to replace, or choose a different package name"
            EXIT 1
        ELSE:
            REPORT: "⚠️  Overwriting existing package: ${package_name}"

CATCH error:
    REPORT: "⚠️  Warning: Cannot check package existence: ${error}"
    REPORT: "Continuing with package creation..."
```

**Step 0c: Session Preparation**

```bash
# Create temporary session for processing
TRY:
    temp_session_id = Bash(mkdir -p .workflow && echo "WFS-codify-$(date +%Y%m%d-%H%M%S)")
    temp_design_run_id = Bash(mkdir -p .workflow/${temp_session_id} && echo "design-run-$(date +%Y%m%d-%H%M%S)")

    # Create design run directory and get absolute path
    Bash(mkdir -p .workflow/${temp_session_id}/${temp_design_run_id})
    design_run_path = Bash(cd .workflow/${temp_session_id}/${temp_design_run_id} && pwd)

CATCH error:
    REPORT: "❌ ERROR: Failed to create temporary workspace: ${error}"
    EXIT 1

STORE: temp_session_id, temp_design_run_id, design_run_path
```

**Summary Variables**:
- `SOURCE`: Validated source directory path
- `PACKAGE_NAME`: Validated package name (lowercase, alphanumeric, hyphens)
- `PACKAGE_PATH`: Full output path `${output_dir}/${package_name}`
- `OUTPUT_DIR`: `.workflow/reference_style` (default) or user-specified
- `OVERWRITE`: `true` if --overwrite flag present
- `CSS/SCSS/JS/HTML/STYLE_FILES`: Optional glob patterns
- `TEMP_SESSION_ID`: `WFS-codify-{timestamp}`
- `TEMP_DESIGN_RUN_ID`: `design-run-{timestamp}`
- `DESIGN_RUN_PATH`: Absolute path to temporary workspace

**TodoWrite Update**:
```json
[
  {"content": "Validate parameters and prepare session", "status": "completed", "activeForm": "Validating parameters"},
  {"content": "Extract styles from source code", "status": "in_progress", "activeForm": "Extracting styles"}
]
```

**Next Action**: Validation complete → **IMMEDIATELY execute Phase 1** (auto-continue)

---

### Phase 1: Style Extraction from Source Code

**Goal**: Extract design tokens, style patterns, and component styles from codebase

**Command Construction**:

```bash
# Build command with required parameters only
command = "/workflow:ui-design:import-from-code" +
          " --design-id \"${temp_design_run_id}\"" +
          " --source \"${source}\""
```

**Execute Command**:

```bash
TRY:
    SlashCommand(command)

    # Verify extraction outputs
    tokens_path = "${design_run_path}/style-extraction/style-1/design-tokens.json"
    guide_path = "${design_run_path}/style-extraction/style-1/style-guide.md"

    tokens_exists = Bash(test -f "${tokens_path}" && echo "exists" || echo "missing")
    guide_exists = Bash(test -f "${guide_path}" && echo "exists" || echo "missing")

    IF tokens_exists != "exists" OR guide_exists != "exists":
        REPORT: "⚠️  WARNING: Expected extraction files not found"
        REPORT: "Continuing with available outputs..."

CATCH error:
    REPORT: "❌ ERROR: Style extraction failed"
    REPORT: "Error: ${error}"
    REPORT: "Possible cause: Source directory contains no style files"
    Bash(rm -rf .workflow/${temp_session_id})
    EXIT 1
```

**Example Command**:
```bash
# Automatic file discovery
/workflow:ui-design:import-from-code --design-id design-run-20250111-123456 --source ./src
```

**Completion Criteria**:
- ✅ `import-from-code` command executed successfully
- ✅ Design run created at `${design_run_path}`
- ✅ Required files exist:
  - `design-tokens.json` - Complete design token system
  - `style-guide.md` - Style documentation
- ⭕ Optional files:
  - `animation-tokens.json` - Animation specifications
  - `component-patterns.json` - Component catalog

**TodoWrite Update**:
```json
[
  {"content": "Validate parameters and prepare session", "status": "completed", "activeForm": "Validating parameters"},
  {"content": "Extract styles from source code", "status": "completed", "activeForm": "Extracting styles"},
  {"content": "Generate reference package with preview", "status": "in_progress", "activeForm": "Generating reference"}
]
```

**Next Action**: Extraction verified → **IMMEDIATELY execute Phase 2** (auto-continue)
**⚠️ CRITICAL**: SlashCommand blocks until import-from-code finishes. When it returns, IMMEDIATELY update TodoWrite and execute Phase 2.

---

### Phase 2: Reference Package Generation

**Goal**: Generate shareable reference package with interactive preview and documentation

**Command Construction**:

```bash
command = "/workflow:ui-design:reference-page-generator " +
          "--design-run \"${design_run_path}\" " +
          "--package-name \"${package_name}\" " +
          "--output-dir \"${output_dir}\""
```

**Execute Command**:

```bash
TRY:
    SlashCommand(command)

    # Verify package outputs
    required_files = [
        "design-tokens.json",
        "component-patterns.json",
        "preview.html",
        "preview.css",
        "metadata.json",
        "README.md"
    ]

    missing_files = []
    FOR file IN required_files:
        file_path = "${package_path}/${file}"
        exists = Bash(test -f "${file_path}" && echo "exists" || echo "missing")
        IF exists != "exists":
            missing_files.append(file)

    IF missing_files.length > 0:
        REPORT: "⚠️  WARNING: Some expected files are missing"
        REPORT: "Package may be incomplete. Continuing with cleanup..."

CATCH error:
    REPORT: "❌ ERROR: Reference package generation failed"
    REPORT: "Error: ${error}"
    Bash(rm -rf .workflow/${temp_session_id})
    EXIT 1
```

**Example Command**:
```bash
/workflow:ui-design:reference-page-generator \
  --design-run .workflow/WFS-codify-20250111-123456/design-run-20250111-123456 \
  --package-name main-app-style-v1 \
  --output-dir .workflow/reference_style
```

**Completion Criteria**:
- ✅ `reference-page-generator` executed successfully
- ✅ Reference package created at `${package_path}/`
- ✅ All required files present:
  - `design-tokens.json` - Complete design token system
  - `component-patterns.json` - Component catalog
  - `preview.html` - Interactive multi-component showcase
  - `preview.css` - Showcase styling
  - `metadata.json` - Package metadata and version info
  - `README.md` - Package documentation and usage guide
- ⭕ Optional files:
  - `animation-tokens.json` - Animation specifications (if available from extraction)

**TodoWrite Update**:
```json
[
  {"content": "Validate parameters and prepare session", "status": "completed", "activeForm": "Validating parameters"},
  {"content": "Extract styles from source code", "status": "completed", "activeForm": "Extracting styles"},
  {"content": "Generate reference package with preview", "status": "completed", "activeForm": "Generating reference"},
  {"content": "Cleanup and verify package", "status": "in_progress", "activeForm": "Cleanup and verification"}
]
```

**Next Action**: Package verified → **IMMEDIATELY execute Phase 3** (auto-continue)
**⚠️ CRITICAL**: SlashCommand blocks until reference-page-generator finishes. When it returns, IMMEDIATELY update TodoWrite and execute Phase 3.

---

### Phase 3: Cleanup & Verification

**Goal**: Clean up temporary workspace and report completion

**Operations**:

```bash
# Cleanup temporary workspace
TRY:
    Bash(rm -rf .workflow/${temp_session_id})
CATCH error:
    # Silent failure - not critical

# Quick verification
package_exists = Bash(test -d "${package_path}" && echo "exists" || echo "missing")

IF package_exists != "exists":
    REPORT: "❌ ERROR: Package generation failed - directory not found"
    EXIT 1

# Get absolute path and component count for final report
absolute_package_path = Bash(cd "${package_path}" && pwd 2>/dev/null || echo "${package_path}")
component_count = Bash(jq -r '.extraction_metadata.component_count // "unknown"' "${package_path}/component-patterns.json" 2>/dev/null || echo "unknown")
anim_exists = Bash(test -f "${package_path}/animation-tokens.json" && echo "✓" || echo "○")
```

**TodoWrite Update**:
```json
[
  {"content": "Validate parameters and prepare session", "status": "completed", "activeForm": "Validating parameters"},
  {"content": "Extract styles from source code", "status": "completed", "activeForm": "Extracting styles"},
  {"content": "Generate reference package with preview", "status": "completed", "activeForm": "Generating reference"},
  {"content": "Cleanup and verify package", "status": "completed", "activeForm": "Cleanup and verification"}
]
```

**Final Action**: Display completion summary to user

---

## Completion Message

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ STYLE REFERENCE PACKAGE GENERATED SUCCESSFULLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Package: {package_name}
📂 Location: {absolute_package_path}/
📄 Source: {source}

Generated Files:
  ✓ design-tokens.json       Design token system
  ✓ style-guide.md          Style documentation
  ✓ component-patterns.json  Component catalog ({component_count} components)
  ✓ preview.html            Interactive showcase
  ✓ preview.css             Showcase styling
  {anim_exists} animation-tokens.json   Animation tokens
  ✓ metadata.json           Package metadata
  ✓ README.md               Documentation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 Preview Package
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  file://{absolute_package_path}/preview.html

  Or use local server:
  cd {package_path} && python -m http.server 8080

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Next Steps
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Review preview.html to verify components and design tokens
2. Generate SKILL memory: /memory:style-skill-memory {package_name}
3. Use in workflows: /workflow:ui-design:explore-auto --prompt "Use {package_name} style"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## TodoWrite Pattern

```javascript
// Initialize IMMEDIATELY after user confirms in Phase 0 to track multi-phase execution
TodoWrite({todos: [
  {"content": "Validate parameters and prepare session", "status": "in_progress", "activeForm": "Validating parameters"},
  {"content": "Extract styles from source code", "status": "pending", "activeForm": "Extracting styles"},
  {"content": "Generate reference package with preview", "status": "pending", "activeForm": "Generating reference"},
  {"content": "Cleanup and verify package", "status": "pending", "activeForm": "Cleanup and verification"}
]})

// ⚠️ CRITICAL: When each phase finishes, you MUST:
// 1. SlashCommand blocks and returns when phase finishes executing
// 2. Update current phase: status → "completed"
// 3. Update next phase: status → "in_progress"
// 4. IMMEDIATELY execute next phase command (auto-continue)
// This ensures continuous workflow tracking and prevents premature stopping
```

---

## Execution Flow Diagram

```
User triggers: /workflow:ui-design:codify-style ./src --package-name my-style-v1
  ↓
[Phase 0] TodoWrite initialization (4 phases)
  ↓
[Phase 0] Parameter validation & preparation
  ├─ Parse positional path parameter
  ├─ Validate source directory exists
  ├─ Auto-generate or validate package name
  │  • If --package-name provided: validate format
  │  • If not provided: auto-generate from directory name
  ├─ Check package overwrite protection (fail if exists without --overwrite)
  ├─ Create temporary workspace
  └─ Display configuration summary
  ↓
[Phase 0 Complete] → TodoWrite(Phase 0 = completed, Phase 1 = in_progress)
  ↓ (IMMEDIATELY auto-continue)
[Phase 1] SlashCommand(/workflow:ui-design:import-from-code ...)
  ├─ Extract design tokens from source code
  ├─ Generate style guide
  ├─ Extract component patterns
  └─ Verify extraction outputs
  ↓ (blocks until finished)
[Phase 1 Complete] → TodoWrite(Phase 1 = completed, Phase 2 = in_progress)
  ↓ (IMMEDIATELY auto-continue)
[Phase 2] SlashCommand(/workflow:ui-design:reference-page-generator ...)
  ├─ Generate design-tokens.json
  ├─ Generate component-patterns.json
  ├─ Create preview.html + preview.css
  ├─ Generate metadata.json
  └─ Create README.md
  ↓ (blocks until finished)
[Phase 2 Complete] → TodoWrite(Phase 2 = completed, Phase 3 = in_progress)
  ↓ (IMMEDIATELY auto-continue)
[Phase 3] Cleanup & Verification
  ├─ Remove temporary workspace
  ├─ Verify package directory
  ├─ Extract component count
  └─ Display completion summary
  ↓
[Phase 3 Complete] → TodoWrite(Phase 3 = completed)
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

Only essential parameters are passed to `import-from-code`:
- `--design-id` → temporary design run ID (auto-generated)
- `--source` → user-specified source directory

File discovery is fully automatic - no glob patterns needed.

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

- **Simplified Interface**: Single path parameter with intelligent defaults
- **Auto-Generation**: Package names auto-generated from directory names
- **Automatic Discovery**: No need to specify file patterns - finds all style files automatically
- **Pure Orchestrator**: No direct agent execution, delegates to specialized commands
- **Auto-Continue**: Autonomous 4-phase execution without user interaction
- **Safety First**: Overwrite protection, validation checks, error handling
- **Code Reuse**: Leverages existing `import-from-code` and `reference-page-generator` commands
- **Clean Separation**: Each command has single responsibility
- **Easy Maintenance**: Changes to sub-commands automatically apply

## Architecture

```
codify-style (orchestrator - simplified interface)
  ├─ Phase 0: Intelligent Validation
  │   ├─ Parse positional path parameter
  │   ├─ Auto-generate package name (if not provided)
  │   ├─ Safety checks (overwrite protection)
  │   └─ User confirmation
  ├─ Phase 1: /workflow:ui-design:import-from-code (style extraction)
  │   ├─ Extract design tokens from source code
  │   ├─ Generate style guide
  │   └─ Extract component patterns
  ├─ Phase 2: /workflow:ui-design:reference-page-generator (reference package)
  │   ├─ Generate shareable package
  │   ├─ Create interactive preview
  │   └─ Generate documentation
  └─ Phase 3: Cleanup & Verification
      ├─ Remove temporary workspace
      ├─ Verify package integrity
      └─ Report completion

Design Principles:
✓ No task JSON created by this command
✓ All extraction delegated to import-from-code
✓ All packaging delegated to reference-page-generator
✓ Pure orchestration with intelligent defaults
✓ Single path parameter for maximum simplicity
```
