---
name: memory:style-skill-memory
description: Generate SKILL memory package from style reference for easy loading and consistent design system usage
argument-hint: "[package-name] [--regenerate]"
allowed-tools: Bash,Read,Write,TodoWrite
auto-continue: true
---

# Memory: Style SKILL Memory Generator

## Overview

**Purpose**: Convert style reference package into SKILL memory for easy loading and context management.

**Input**: Style reference package at `.workflow/reference_style/{package-name}/`

**Output**: SKILL memory index at `.claude/skills/style-{package-name}/SKILL.md`

**Use Case**: Load design system context when working with UI components, analyzing design patterns, or implementing style guidelines.

---

## Usage

### Command Syntax

```bash
/memory:style-skill-memory [package-name] [--regenerate]

# Arguments
package-name    Style reference package name (required)
--regenerate    Force regenerate SKILL.md even if it exists (optional)
```

### Usage Examples

```bash
# Generate SKILL memory for package
/memory:style-skill-memory main-app-style-v1

# Regenerate SKILL memory
/memory:style-skill-memory main-app-style-v1 --regenerate

# Package name from current directory or default
/memory:style-skill-memory
```

---

## Execution Process

### Phase 1: Validate Package

**Purpose**: Check if style reference package exists

**TodoWrite** (First Action):
```json
[
  {"content": "Validate style reference package", "status": "in_progress", "activeForm": "Validating package"},
  {"content": "Read package data and count components", "status": "pending", "activeForm": "Reading package data"},
  {"content": "Generate SKILL.md with progressive loading", "status": "pending", "activeForm": "Generating SKILL.md"}
]
```

**Step 1: Parse Package Name**

```bash
# Get package name from argument or auto-detect
bash(echo "${package_name}" || basename "$(pwd)" | sed 's/^style-//')
```

Store result as `package_name`

**Step 2: Validate Package Exists**

```bash
bash(test -d .workflow/reference_style/${package_name} && echo "exists" || echo "missing")
```

**Error Handling**:
```javascript
if (package_not_exists) {
  error("ERROR: Style reference package not found: ${package_name}")
  error("HINT: Run '/workflow:ui-design:codify-style' first to create package")
  error("Available packages:")
  bash(ls -1 .workflow/reference_style/ 2>/dev/null || echo "  (none)")
  exit(1)
}
```

**Step 3: Check SKILL Already Exists**

```bash
bash(test -f .claude/skills/style-${package_name}/SKILL.md && echo "exists" || echo "missing")
```

**Decision Logic**:
```javascript
if (skill_exists && !regenerate_flag) {
  echo("SKILL memory already exists for: ${package_name}")
  echo("Use --regenerate to force regeneration")
  exit(0)
}

if (regenerate_flag && skill_exists) {
  echo("Regenerating SKILL memory for: ${package_name}")
}
```

**Summary Variables**:
- `PACKAGE_NAME`: Style reference package name
- `PACKAGE_DIR`: `.workflow/reference_style/${package_name}`
- `SKILL_DIR`: `.claude/skills/style-${package_name}`
- `REGENERATE`: `true` if --regenerate flag, `false` otherwise

**TodoWrite Update**:
```json
[
  {"content": "Validate style reference package", "status": "completed", "activeForm": "Validating package"},
  {"content": "Read package data and count components", "status": "in_progress", "activeForm": "Reading package data"}
]
```

**Next Action**: Continue to Phase 2

---

### Phase 2: Read Package Data

**Purpose**: Extract package information for SKILL description generation

**Step 1: Count Components**

```bash
bash(jq '.layout_templates | length' .workflow/reference_style/${package_name}/layout-templates.json 2>/dev/null || echo 0)
```

Store result as `component_count`

**Step 2: Read Design Tokens Summary**

```bash
Read(file_path=".workflow/reference_style/${package_name}/design-tokens.json")
```

**Extract Information**:
- Available token categories (colors, typography, spacing, etc.)
- Token count per category

**Step 3: Check Available Files**

```bash
bash(cd .workflow/reference_style/${package_name} && ls -1 *.json *.html *.css 2>/dev/null | wc -l)
```

Store result as `file_count`

**Step 4: Check Optional Animation Tokens**

```bash
bash(test -f .workflow/reference_style/${package_name}/animation-tokens.json && echo "available" || echo "not_available")
```

Store result as `has_animations`

**Summary Data**:
- `COMPONENT_COUNT`: Number of components in layout templates
- `FILE_COUNT`: Total files in package
- `HAS_ANIMATIONS`: Whether animation tokens are available

**TodoWrite Update**:
```json
[
  {"content": "Read package data and count components", "status": "completed", "activeForm": "Reading package data"},
  {"content": "Generate SKILL.md with progressive loading", "status": "in_progress", "activeForm": "Generating SKILL.md"}
]
```

**Next Action**: Continue to Phase 3

---

### Phase 3: Generate SKILL.md

**Purpose**: Create SKILL memory index with progressive loading structure

**Step 1: Create SKILL Directory**

```bash
bash(mkdir -p .claude/skills/style-${package_name})
```

**Step 2: Generate Intelligent Description**

**Format**:
```
{package_name} design system with {component_count} layout templates and interactive preview (located at .workflow/reference_style/{package_name}). Load when working with UI components, design tokens, layout patterns, analyzing component structures, or implementing visual consistency.
```

**Key Elements**:
- **Component Count**: Emphasize available layout templates
- **Path Reference**: Precise package location
- **Trigger Keywords**: UI components, design tokens, layout patterns, component structures
- **Action Coverage**: working with, analyzing, implementing

**Example**:
```
main-app-style-v1 design system with 8 layout templates and interactive preview (located at .workflow/reference_style/main-app-style-v1). Load when working with UI components, design tokens, layout patterns, analyzing component structures, or implementing visual consistency.
```

**Step 3: Write SKILL.md** (Use Write tool)

```markdown
---
name: style-{package_name}
description: {intelligent description from Step 2}
---

# {Package Name} Style SKILL Package

## Documentation: `../../../.workflow/reference_style/{package_name}/`

## Package Overview

Style reference package extracted from codebase with layout templates, design tokens, and interactive preview.

**Package Details**:
- Package: {package_name}
- Layout Templates: {component_count}
- Files: {file_count}
- Animation Tokens: {has_animations ? "✓ Available" : "Not available"}

## Progressive Loading

### Level 0: Design Tokens (~5K tokens)

Essential design token system for consistent styling.

**Files**:
- [Design Tokens](../../../.workflow/reference_style/{package_name}/design-tokens.json) - Colors, typography, spacing, shadows, borders

**Use when**: Quick token reference, applying consistent styles, color/typography queries

---

### Level 1: Layout Templates (~12K tokens)

Component layout patterns extracted from codebase.

**Files**:
- Level 0 files
- [Layout Templates](../../../.workflow/reference_style/{package_name}/layout-templates.json) - Component structures with HTML/CSS patterns

**Use when**: Building components, understanding component architecture, implementing layouts

---

### Level 2: Complete System (~20K tokens)

Full design system with animations and interactive preview.

**Files**:
- All Level 1 files
- [Animation Tokens](../../../.workflow/reference_style/{package_name}/animation-tokens.json) - Animation durations, easing, transitions _(if available)_
- [Preview HTML](../../../.workflow/reference_style/{package_name}/preview.html) - Interactive showcase (reference only)
- [Preview CSS](../../../.workflow/reference_style/{package_name}/preview.css) - Showcase styling (reference only)

**Use when**: Comprehensive analysis, animation development, complete design system understanding

---

## Interactive Preview

**Location**: `.workflow/reference_style/{package_name}/preview.html`

**View in Browser**:
```bash
cd .workflow/reference_style/{package_name}
python -m http.server 8080
# Open http://localhost:8080/preview.html
```

**Features**:
- Color palette swatches with values
- Typography scale and combinations
- All components with variants and states
- Spacing, radius, shadow visual examples
- Interactive state demonstrations
- Usage code snippets

---

## Usage Guidelines

### Loading Levels

**Level 0** (5K): Design tokens only
```
Load Level 0 for design token reference
```

**Level 1** (12K): Tokens + layout templates
```
Load Level 1 for layout templates and design tokens
```

**Level 2** (20K): Complete system with animations and preview
```
Load Level 2 for complete design system with preview reference
```

### Common Use Cases

**Implementing UI Components**:
- Load Level 1 for layout templates
- Reference layout-templates.json for component structures
- Apply design tokens from design-tokens.json

**Ensuring Style Consistency**:
- Load Level 0 for design tokens
- Use design-tokens.json for colors, typography, spacing
- Check preview.html for visual reference

**Analyzing Component Patterns**:
- Load Level 2 for complete analysis
- Review layout-templates.json for component architecture
- Check preview.html for implementation examples

**Animation Development**:
- Load Level 2 for animation tokens (if available)
- Reference animation-tokens.json for durations and easing
- Apply consistent timing and transitions

---

## Package Structure

```
.workflow/reference_style/{package_name}/
├── layout-templates.json   # Layout templates from codebase
├── design-tokens.json     # Design token system
├── animation-tokens.json  # Animation tokens (optional)
├── preview.html          # Interactive showcase
└── preview.css           # Showcase styling
```

---

## Regeneration

To update this SKILL memory after package changes:

```bash
/memory:style-skill-memory {package_name} --regenerate
```

---

## Related Commands

**Generate Package**:
```bash
/workflow:ui-design:codify-style --source ./src --package-name {package_name}
```

**Update Package**:
Re-run codify-style with same package name to update extraction.
```

**Step 4: Verify SKILL.md Created**

```bash
bash(test -f .claude/skills/style-${package_name}/SKILL.md && echo "success" || echo "failed")
```

**TodoWrite Update**:
```json
[
  {"content": "Validate style reference package", "status": "completed", "activeForm": "Validating package"},
  {"content": "Read package data and count components", "status": "completed", "activeForm": "Reading package data"},
  {"content": "Generate SKILL.md with progressive loading", "status": "completed", "activeForm": "Generating SKILL.md"}
]
```

**Final Action**: Report completion summary to user

---

## Completion Message

```
✅ SKILL memory generated successfully!

Package: {package_name}
SKILL Location: .claude/skills/style-{package_name}/SKILL.md

Package Details:
- Layout Templates: {component_count}
- Files: {file_count}
- Animation Tokens: {has_animations ? "✓ Available" : "Not available"}

Progressive Loading Levels:
- Level 0: Design Tokens (~5K tokens)
- Level 1: Tokens + Layout Templates (~12K tokens)
- Level 2: Complete System (~20K tokens)

Usage:
Load design system context when working with:
- UI component implementation
- Layout pattern analysis
- Design token application
- Style consistency validation

Preview:
Open interactive showcase:
  file://{absolute_path}/.workflow/reference_style/{package_name}/preview.html

Next Steps:
1. Load appropriate level based on your task
2. Reference layout-templates.json for component structures
3. Use design-tokens.json for consistent styling
```

---

## Error Handling

### Common Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| Package not found | Invalid package name or package doesn't exist | Run codify-style first to create package |
| SKILL already exists | SKILL.md already generated | Use --regenerate to force regeneration |
| Missing layout-templates.json | Incomplete package | Verify package integrity, re-run codify-style |
| Invalid JSON format | Corrupted package files | Regenerate package with codify-style |

---

## Implementation Details

### Critical Rules

1. **Check Before Generate**: Verify package exists before attempting SKILL generation
2. **Respect Existing SKILL**: Don't overwrite unless --regenerate flag provided
3. **Progressive Loading**: Always include all 4 levels (0-3) with clear token estimates
4. **Intelligent Description**: Extract component count and key features from metadata

### SKILL Description Format

**Template**:
```
{package_name} design system with {component_count} layout templates and interactive preview (located at .workflow/reference_style/{package_name}). Load when working with UI components, design tokens, layout patterns, analyzing component structures, or implementing visual consistency.
```

**Required Elements**:
- Package name
- Layout template count
- Location (full path)
- Trigger keywords (UI components, design tokens, layout patterns, component structures)
- Action verbs (working with, analyzing, implementing)

### Progressive Loading Structure

**Level 0** (~5K tokens):
- design-tokens.json

**Level 1** (~12K tokens):
- Level 0 files
- layout-templates.json

**Level 2** (~20K tokens):
- Level 1 files
- animation-tokens.json (if exists)
- preview.html
- preview.css

---

## Benefits

- **Fast Context Loading**: Progressive levels for efficient token usage
- **Intelligent Triggering**: Keywords optimize SKILL activation
- **Complete Reference**: All package files accessible through SKILL
- **Easy Regeneration**: Simple --regenerate flag for updates
- **Clear Structure**: Organized levels by use case

## Architecture

```
style-skill-memory
  ├─ Phase 1: Validate (check package exists, check SKILL exists)
  ├─ Phase 2: Read Package Data (count components from layout-templates.json, check animations)
  └─ Phase 3: Generate SKILL.md (write SKILL with progressive loading)

No external commands called
Direct file reading and writing
Smart description generation from package data
```
