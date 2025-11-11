---
name: workflow:ui-design:reference-page-generator
description: Generate multi-component reference pages and documentation from design run extraction
argument-hint: "[--design-run <path>] [--package-name <name>] [--output-dir <path>]"
allowed-tools: Read,Write,Bash,Task,TodoWrite
auto-continue: true
---

# UI Design: Reference Page Generator

## Overview

Converts design run extraction results into shareable, versioned reference package with:
- Interactive multi-component preview (preview.html + preview.css)
- Component pattern extraction (component-patterns.json)
- Package metadata and documentation (metadata.json + README.md)

**Role**: Takes existing design run (from `import-from-code` or other extraction commands) and enhances it with component analysis, preview generation, and packaging.

## Usage

### Command Syntax

```bash
/workflow:ui-design:reference-page-generator [FLAGS]

# Flags
--design-run <path>      Design run directory path (required)
--package-name <name>    Package name for reference (required)
--output-dir <path>      Output directory (default: .workflow/reference_style)
```

### Usage Examples

```bash
# Basic usage
/workflow:ui-design:reference-page-generator --design-run .workflow/WFS-123/design-run-456 --package-name main-app-style-v1

# Custom output directory
/workflow:ui-design:reference-page-generator --design-run .workflow/WFS-123/design-run-456 --package-name main-app-style-v1 --output-dir ./style-references
```

---

## Execution Process

### Phase 0: Setup & Validation

**Purpose**: Validate inputs, prepare output directory

**Operations**:

```bash
# 1. Validate required parameters
if [ -z "$design_run" ] || [ -z "$package_name" ]; then
  echo "ERROR: --design-run and --package-name are required"
  echo "USAGE: /workflow:ui-design:reference-page-generator --design-run <path> --package-name <name>"
  exit 1
fi

# 2. Validate package name format (lowercase, alphanumeric, hyphens only)
if ! [[ "$package_name" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "ERROR: Invalid package name. Use lowercase, alphanumeric, and hyphens only."
  echo "EXAMPLE: main-app-style-v1"
  exit 1
fi

# 3. Validate design run exists
if [ ! -d "$design_run" ]; then
  echo "ERROR: Design run not found: $design_run"
  echo "HINT: Run '/workflow:ui-design:import-from-code' first to create design run"
  exit 1
fi

# 4. Check required extraction files exist
required_files=(
  "$design_run/style-extraction/style-1/design-tokens.json"
)

for file in "${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    echo "ERROR: Required file not found: $file"
    echo "HINT: Ensure design run has style extraction results"
    exit 1
  fi
done

# 5. Setup output directory and validate
output_dir="${output_dir:-.workflow/reference_style}"
package_dir="${output_dir}/${package_name}"

# Check if package directory exists and is not empty
if [ -d "$package_dir" ] && [ "$(ls -A $package_dir 2>/dev/null)" ]; then
  # Directory exists - check if it's a valid package or just a directory
  if [ -f "$package_dir/metadata.json" ]; then
    # Valid package - safe to overwrite
    existing_version=$(jq -r '.version // "unknown"' "$package_dir/metadata.json" 2>/dev/null || echo "unknown")
    echo "INFO: Overwriting existing package '$package_name' (version: $existing_version)"
  else
    # Directory exists but not a valid package
    echo "ERROR: Directory '$package_dir' exists but is not a valid package"
    echo "Use a different package name or remove the directory manually"
    exit 1
  fi
fi

mkdir -p "$package_dir"

echo "[Phase 0] Setup Complete"
echo "  Design Run: $design_run"
echo "  Package: $package_name"
echo "  Output: $package_dir"
```

<!-- TodoWrite: Initialize todo list -->

**TodoWrite**:
```json
[
  {"content": "Phase 0: 验证和准备", "status": "completed", "activeForm": "验证参数"},
  {"content": "Phase 1: 组件模式提取", "status": "in_progress", "activeForm": "提取组件模式"},
  {"content": "Phase 2: 生成预览页面", "status": "pending", "activeForm": "生成预览"},
  {"content": "Phase 3: 生成元数据和文档", "status": "pending", "activeForm": "生成文档"}
]
```

---

### Phase 1: Component Pattern Extraction

**Purpose**: Run Component Agent to extract UI component patterns from design run

**Agent Task**:

```javascript
Task(ui-design-agent): `
  [COMPONENT_PATTERNS_EXTRACTION]
  Extract reusable UI component patterns from design run extraction results

  MODE: component-analysis | DESIGN_RUN: ${design_run} | OUTPUT: ${package_dir}

  ## Input Files

  **Design Run Path**: ${design_run}

  You can read ALL files in the design run directory:
  - style-extraction/style-1/design-tokens.json
  - animation-extraction/animation-tokens.json (if exists)
  - layout-extraction/layout-templates.json (if exists)
  - Source code files referenced in extraction metadata

  ## Extraction Strategy

  **Component Identification**:
  1. Scan design tokens for component-level styles (component_styles in design-tokens.json)
  2. Review layout templates for component structures
  3. Identify common UI component patterns (button, input, card, modal, badge, alert, etc.)
  4. Extract DOM structure for each component
  5. Identify CSS class patterns and variants
  6. Map component states (default, hover, active, disabled, focus, error, success)

  ## Output Requirements

  Generate 1 file: ${package_dir}/component-patterns.json

  ### component-patterns.json Structure:
  {
    "extraction_metadata": {
      "package_name": "${package_name}",
      "source_design_run": "${design_run}",
      "extraction_time": "ISO8601 timestamp",
      "files_analyzed": {
        "design_tokens": "path/to/design-tokens.json",
        "animation_tokens": "path/to/animation-tokens.json (if exists)",
        "layout_templates": "path/to/layout-templates.json (if exists)"
      },
      "component_count": 8
    },
    "components": {
      "button": {
        "base_structure": {
          "tag": "button",
          "base_classes": ["btn"],
          "attributes": {
            "type": "button",
            "role": "button"
          }
        },
        "variants": {
          "primary": {
            "classes": ["btn-primary"],
            "description": "Main call-to-action button",
            "style_tokens": {
              "background": "var(--color-brand-primary)",
              "color": "var(--color-text-inverse)",
              "padding": "var(--spacing-3) var(--spacing-6)",
              "border_radius": "var(--border-radius-md)"
            }
          },
          "secondary": {
            "classes": ["btn-secondary"],
            "description": "Secondary action button",
            "style_tokens": {
              "background": "var(--color-surface-elevated)",
              "color": "var(--color-text-primary)",
              "border": "1px solid var(--color-border-default)"
            }
          }
        },
        "sizes": {
          "sm": {"classes": ["btn-sm"]},
          "base": {"classes": []},
          "lg": {"classes": ["btn-lg"]}
        },
        "states": {
          "default": {"classes": []},
          "hover": {"pseudo": ":hover"},
          "active": {"pseudo": ":active"},
          "disabled": {"attribute": "disabled", "classes": ["btn-disabled"]}
        },
        "usage_examples": [
          "<button class=\"btn btn-primary\">Primary</button>",
          "<button class=\"btn btn-secondary btn-lg\">Large Secondary</button>"
        ]
      },
      "input": {
        "base_structure": {
          "tag": "input",
          "base_classes": ["input"],
          "attributes": {"type": "text"}
        },
        "variants": {
          "default": {
            "classes": ["input-default"],
            "description": "Standard text input",
            "style_tokens": {
              "border": "1px solid var(--color-border-default)",
              "padding": "var(--spacing-3)",
              "border_radius": "var(--border-radius-md)"
            }
          }
        },
        "states": {
          "default": {"classes": []},
          "focus": {"pseudo": ":focus"},
          "error": {"classes": ["input-error"]},
          "disabled": {"attribute": "disabled"}
        },
        "usage_examples": [
          "<input class=\"input input-default\" type=\"text\" placeholder=\"Enter text\">"
        ]
      },
      "card": {
        "base_structure": {
          "tag": "div",
          "base_classes": ["card"],
          "children": [
            {"tag": "div", "classes": ["card-header"], "optional": true},
            {"tag": "div", "classes": ["card-body"]},
            {"tag": "div", "classes": ["card-footer"], "optional": true}
          ]
        },
        "variants": {
          "default": {
            "classes": ["card-default"],
            "description": "Standard elevated card",
            "style_tokens": {
              "background": "var(--color-surface-elevated)",
              "padding": "var(--spacing-6)",
              "border_radius": "var(--border-radius-lg)",
              "box_shadow": "var(--shadow-md)"
            }
          }
        },
        "usage_examples": [
          "<div class=\"card card-default\"><div class=\"card-body\">Content</div></div>"
        ]
      }
    }
  }

  ## Completeness Criteria
  - Extract at least 5 core component types (button, input, card, badge, alert, etc.)
  - Include all variants and states for each component
  - Provide usage examples for each component
  - Map style tokens to component styles

  ## Critical Requirements
  - ✅ Read design run extraction files using Read() tool
  - ✅ Cross-reference design tokens with component styles
  - ✅ Generate comprehensive component patterns catalog
  - ✅ Use Write() to save: ${package_dir}/component-patterns.json
  - ❌ NO external research or MCP calls
`
```

<!-- TodoWrite: Mark Phase 1 complete, start Phase 2 -->

**TodoWrite**:
```json
[
  {"content": "Phase 1: 组件模式提取", "status": "completed", "activeForm": "提取组件模式"},
  {"content": "Phase 2: 生成预览页面", "status": "in_progress", "activeForm": "生成预览"}
]
```

---

### Phase 2: Preview Generation

**Purpose**: Generate interactive multi-component preview (preview.html + preview.css)

**Agent Task**:

```javascript
Task(ui-design-agent): `
  [PREVIEW_SHOWCASE_GENERATION]
  Generate interactive multi-component showcase panel for reference package

  PACKAGE_DIR: ${package_dir} | PACKAGE_NAME: ${package_name}

  ## Input Files (MUST READ ALL)

  1. ${package_dir}/component-patterns.json (component patterns - REQUIRED)
  2. ${design_run}/style-extraction/style-1/design-tokens.json (design tokens - REQUIRED)
  3. ${design_run}/animation-extraction/animation-tokens.json (optional, if exists)

  ## Generation Task

  Create interactive showcase with these sections:

  ### Section 1: Colors
  - Display all color categories as color swatches
  - Show hex/rgb values
  - Group by: brand, semantic, surface, text, border

  ### Section 2: Typography
  - Display typography scale (font sizes, weights)
  - Show typography combinations if available
  - Include font family examples

  ### Section 3: Components
  - Render all components from component-patterns.json
  - Display all variants side-by-side
  - Show all states (default, hover, active, disabled, focus, error)
  - Include usage code snippets in <details> tags

  ### Section 4: Spacing & Layout
  - Visual spacing scale
  - Border radius examples
  - Shadow depth examples

  ### Section 5: Animations (if available)
  - Animation duration examples
  - Easing function demonstrations

  ## Output Requirements

  Generate 2 files:
  1. ${package_dir}/preview.html
  2. ${package_dir}/preview.css

  ### preview.html Structure:
  - Complete standalone HTML file
  - Responsive design with mobile-first approach
  - Sticky navigation for sections
  - Interactive state demonstrations
  - Code snippets in collapsible <details> elements
  - Footer with package metadata

  ### preview.css Structure:
  - CSS Custom Properties from design-tokens.json
  - Typography combination classes
  - Component classes from component-patterns.json
  - Preview page layout styles
  - Interactive demo styles

  ## Critical Requirements
  - ✅ Read ALL input files (component-patterns.json, design-tokens.json, animation-tokens.json if exists)
  - ✅ Generate complete, interactive showcase HTML
  - ✅ All CSS uses var() references to design tokens
  - ✅ Display ALL components from component-patterns.json
  - ✅ Display ALL variants and states for each component
  - ✅ Include usage code snippets
  - ✅ Use Write() to save both files:
    - ${package_dir}/preview.html
    - ${package_dir}/preview.css
  - ❌ NO external research or MCP calls
`
```

<!-- TodoWrite: Mark Phase 2 complete, start Phase 3 -->

**TodoWrite**:
```json
[
  {"content": "Phase 2: 生成预览页面", "status": "completed", "activeForm": "生成预览"},
  {"content": "Phase 3: 生成元数据和文档", "status": "in_progress", "activeForm": "生成文档"}
]
```

---

### Phase 3: Metadata & Documentation Generation

**Purpose**: Create package metadata and documentation

**Operations**:

```bash
echo "[Phase 3] Generating package metadata and documentation"

# 1. Copy design tokens to package directory
cp "${design_run}/style-extraction/style-1/design-tokens.json" "${package_dir}/design-tokens.json"
cp "${design_run}/style-extraction/style-1/style-guide.md" "${package_dir}/style-guide.md" 2>/dev/null || true

# 2. Copy animation tokens if exists
if [ -f "${design_run}/animation-extraction/animation-tokens.json" ]; then
  cp "${design_run}/animation-extraction/animation-tokens.json" "${package_dir}/animation-tokens.json"
fi

# 3. Get Git information (if in git repo)
git_commit=""
git_repo=""
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  git_commit=$(git rev-parse HEAD 2>/dev/null || echo "")
  git_repo=$(git config --get remote.origin.url 2>/dev/null || echo "")
fi

# 4. Get source path from design run metadata
source_path=$(grep -Po '"extraction_source":\s*"\K[^"]+' "${design_run}/style-extraction/style-1/design-tokens.json" 2>/dev/null || echo "code_import")

# 5. Generate metadata.json
cat > "${package_dir}/metadata.json" <<EOF
{
  "packageName": "${package_name}",
  "version": "1.0.0",
  "generatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date)",
  "source": {
    "type": "git",
    "repository": "${git_repo}",
    "commit": "${git_commit}",
    "design_run": "${design_run}"
  },
  "description": "Style reference package extracted from design run",
  "files": {
    "design_tokens": "design-tokens.json",
    "style_guide": "style-guide.md",
    "component_patterns": "component-patterns.json",
    "animation_tokens": "animation-tokens.json",
    "preview_html": "preview.html",
    "preview_css": "preview.css"
  },
  "usage": {
    "command": "/workflow:ui-design:codify-style --package-name ${package_name}",
    "skill_memory": "/memory:style-skill-memory ${package_name}",
    "description": "Reference this package for consistent design system usage"
  }
}
EOF

echo "  ✓ metadata.json created"

# 6. Generate README.md
cat > "${package_dir}/README.md" <<'EOFREADME'
# ${package_name}

Style reference package with interactive component preview.

## Contents

- **design-tokens.json**: Complete design token system
- **style-guide.md**: Detailed style guide documentation
- **component-patterns.json**: Reusable component patterns
- **preview.html**: Interactive component showcase
- **preview.css**: Showcase styling
- **animation-tokens.json**: Animation tokens (if available)
- **metadata.json**: Package metadata

## Usage

### Preview Package

Open `preview.html` in a browser to view the interactive component showcase.

```bash
# Using local server
cd ${package_dir}
python -m http.server 8080
# Then open http://localhost:8080/preview.html
```

### Use in Workflow

Reference this package in UI design workflows or generate SKILL memory:

```bash
# Generate SKILL memory for easy loading
/memory:style-skill-memory ${package_name}
```

## Package Information

- **Generated**: $(date)
- **Source**: Design run extraction
- **Version**: 1.0.0

## Component Catalog

See `component-patterns.json` for complete component catalog with variants, states, and usage examples.

## Design Tokens

All design tokens are available as CSS custom properties. See `design-tokens.json` for complete token reference.

EOFREADME

echo "  ✓ README.md created"

# 7. Verify all files exist
echo "[Phase 3] Verifying package files"

required_files=(
  "design-tokens.json"
  "component-patterns.json"
  "preview.html"
  "preview.css"
  "metadata.json"
  "README.md"
)

missing_files=()
for file in "${required_files[@]}"; do
  if [ ! -f "${package_dir}/${file}" ]; then
    missing_files+=("$file")
  fi
done

if [ ${#missing_files[@]} -gt 0 ]; then
  echo "  ❌ ERROR: Missing required files: ${missing_files[*]}"
  exit 1
fi

echo "  ✓ All required files present"

# 8. Count component patterns (use jq for reliable parsing)
component_count=$(jq -r '.extraction_metadata.component_count // 0' "${package_dir}/component-patterns.json" 2>/dev/null || grep -c '"button"\|"input"\|"card"\|"badge"\|"alert"' "${package_dir}/component-patterns.json" 2>/dev/null || echo 0)

echo "  ✓ Package complete with ${component_count} components"
```

<!-- TodoWrite: Mark all complete -->

**TodoWrite**:
```json
[
  {"content": "Phase 0: 验证和准备", "status": "completed", "activeForm": "验证参数"},
  {"content": "Phase 1: 组件模式提取", "status": "completed", "activeForm": "提取组件模式"},
  {"content": "Phase 2: 生成预览页面", "status": "completed", "activeForm": "生成预览"},
  {"content": "Phase 3: 生成元数据和文档", "status": "completed", "activeForm": "生成文档"}
]
```

---

## Output Structure

```
${output_dir}/
└── ${package_name}/
    ├── design-tokens.json        # Design token system (copied from design run)
    ├── style-guide.md           # Style guide (copied from design run)
    ├── component-patterns.json  # Component patterns (NEW)
    ├── animation-tokens.json    # Animation tokens (optional, copied from design run)
    ├── preview.html            # Interactive showcase (NEW)
    ├── preview.css             # Showcase styling (NEW)
    ├── metadata.json           # Package metadata (NEW)
    └── README.md               # Package documentation (NEW)
```

## Completion Message

```
✅ Reference package generated successfully!

Package: {package_name}
Location: {package_dir}

Generated Files:
✓ design-tokens.json       Design token system
✓ style-guide.md          Style guide documentation
✓ component-patterns.json  Component catalog ({component_count} components)
✓ preview.html            Interactive multi-component showcase
✓ preview.css             Showcase styling
✓ animation-tokens.json   Animation tokens {if exists: "✓" else: "○ (not found)"}
✓ metadata.json           Package metadata
✓ README.md               Package documentation

Preview Package:
Open the interactive showcase:
  file://{absolute_path_to_package_dir}/preview.html

Or use a local server:
  cd {package_dir}
  python -m http.server 8080
  # Then open http://localhost:8080/preview.html

Next Steps:
1. Review preview.html to verify components
2. Generate SKILL memory: /memory:style-skill-memory {package_name}
3. Use package as design reference in future workflows
```

## Error Handling

### Common Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| Missing --design-run or --package-name | Required parameters not provided | Provide both flags |
| Invalid package name | Contains uppercase, special chars | Use lowercase, alphanumeric, hyphens only |
| Design run not found | Incorrect path or design run doesn't exist | Verify design run path, run import-from-code first |
| Missing extraction files | Design run incomplete | Ensure design run has style-extraction results |
| Component extraction failed | No components found | Review design tokens for component_styles |
| Preview generation failed | Invalid design tokens | Check design-tokens.json format |

---

