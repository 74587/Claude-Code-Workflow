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
  {"content": "Read package metadata and documentation", "status": "pending", "activeForm": "Reading metadata"},
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
  {"content": "Read package metadata and documentation", "status": "in_progress", "activeForm": "Reading metadata"}
]
```

**Next Action**: Continue to Phase 2

---

### Phase 2: Read Package Metadata

**Purpose**: Extract metadata and documentation for SKILL description generation

**Step 1: Read metadata.json**

```bash
Read(file_path=".workflow/reference_style/${package_name}/metadata.json")
```

**Extract Fields**:
- `packageName`
- `version`
- `generatedAt`
- `description`
- `source.design_run`
- `files` (count available files)

**Step 2: Read README.md**

```bash
Read(file_path=".workflow/reference_style/${package_name}/README.md")
```

**Extract Information**:
- Package overview
- Component catalog reference
- Design token categories

**Step 3: Count Components**

```bash
bash(test -f .workflow/reference_style/${package_name}/component-patterns.json && jq '.extraction_metadata.component_count' .workflow/reference_style/${package_name}/component-patterns.json 2>/dev/null || grep -c '"button"\|"input"\|"card"\|"badge"\|"alert"' .workflow/reference_style/${package_name}/component-patterns.json 2>/dev/null || echo 0)
```

Store result as `component_count`

**Step 4: Check Available Files**

```bash
bash(cd .workflow/reference_style/${package_name} && ls -1 *.json *.md *.html *.css 2>/dev/null | wc -l)
```

Store result as `file_count`

**Summary Data**:
- `COMPONENT_COUNT`: Number of components in catalog
- `FILE_COUNT`: Total files in package
- `VERSION`: Package version (from metadata.json)
- `DESCRIPTION`: Package description (from metadata.json)

**TodoWrite Update**:
```json
[
  {"content": "Read package metadata and documentation", "status": "completed", "activeForm": "Reading metadata"},
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
{Package Name} design system with {component_count} components and interactive preview (located at .workflow/reference_style/{package_name}). Load when working with UI components, design tokens, style guidelines, analyzing design patterns, or implementing visual consistency.
```

**Key Elements**:
- **Component Count**: Emphasize available component catalog
- **Path Reference**: Precise package location
- **Trigger Keywords**: UI components, design tokens, style guidelines, design patterns
- **Action Coverage**: working with, analyzing, implementing

**Example**:
```
main-app-style-v1 design system with 8 components and interactive preview (located at .workflow/reference_style/main-app-style-v1). Load when working with UI components, design tokens, style guidelines, analyzing design patterns, or implementing visual consistency.
```

**Step 3: Write SKILL.md** (Use Write tool)

```markdown
---
name: style-{package_name}
description: {intelligent description from Step 2}
version: {version from metadata.json}
---

# {Package Name} Style SKILL Package

## Documentation: `../../../.workflow/reference_style/{package_name}/`

## Package Overview

Style reference package with comprehensive design system documentation and interactive component preview.

**Package Details**:
- Package: {package_name}
- Version: {version}
- Components: {component_count}
- Files: {file_count}
- Generated: {generatedAt}

## Progressive Loading

### Level 0: Quick Start (~2K tokens)

Essential overview and package information.

**Files**:
- [README](../../../.workflow/reference_style/{package_name}/README.md) - Package overview and usage
- [Metadata](../../../.workflow/reference_style/{package_name}/metadata.json) - Source and package info

**Use when**: Quick reference, understanding package structure

---

### Level 1: Design Tokens (~8K tokens)

Complete design token system with style guidelines.

**Files**:
- [Design Tokens](../../../.workflow/reference_style/{package_name}/design-tokens.json) - Colors, typography, spacing, shadows
- [Style Guide](../../../.workflow/reference_style/{package_name}/style-guide.md) - Design philosophy and usage guidelines

**Use when**: Implementing UI, applying design tokens, style consistency

---

### Level 2: Components & Patterns (~15K tokens)

Full component catalog with patterns, variants, and states.

**Files**:
- Level 1 files
- [Component Patterns](../../../.workflow/reference_style/{package_name}/component-patterns.json) - Component catalog with DOM structures and CSS classes
- [Animation Tokens](../../../.workflow/reference_style/{package_name}/animation-tokens.json) - Animation durations, easing, transitions _(if available)_

**Use when**: Building components, implementing interactions, animation development

---

### Level 3: Complete Reference (~25K tokens)

Everything including interactive preview reference and full documentation.

**Files**:
- All Level 2 files
- [Preview HTML](../../../.workflow/reference_style/{package_name}/preview.html) - Interactive component showcase (reference only)
- [Preview CSS](../../../.workflow/reference_style/{package_name}/preview.css) - Showcase styling (reference only)

**Use when**: Comprehensive analysis, complete design system understanding, implementation validation

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

**Level 0** (2K): Quick reference when you need basic package info
```
Load Level 0 for package overview
```

**Level 1** (8K): Design token implementation
```
Load Level 1 for design tokens and style guide
```

**Level 2** (15K): Component development
```
Load Level 2 for component patterns and animations
```

**Level 3** (25K): Comprehensive understanding
```
Load Level 3 for complete design system reference
```

### Common Use Cases

**Implementing UI Components**:
- Load Level 2 for component patterns
- Reference component-patterns.json for DOM structure and CSS classes
- Apply design tokens from design-tokens.json

**Ensuring Style Consistency**:
- Load Level 1 for design tokens
- Use style-guide.md for design philosophy
- Check preview.html for visual reference

**Analyzing Design Patterns**:
- Load Level 3 for complete analysis
- Review component-patterns.json for architecture
- Check preview.html for implementation examples

**Animation Development**:
- Load Level 2 for animation tokens
- Reference animation-tokens.json for durations and easing
- Apply consistent timing and transitions

---

## Package Structure

```
.workflow/reference_style/{package_name}/
├── README.md                 # Package overview
├── metadata.json            # Package metadata
├── design-tokens.json       # Design token system
├── style-guide.md          # Style guide documentation
├── component-patterns.json # Component catalog
├── animation-tokens.json   # Animation tokens (optional)
├── preview.html           # Interactive showcase
└── preview.css            # Showcase styling
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
  {"content": "Read package metadata and documentation", "status": "completed", "activeForm": "Reading metadata"},
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
- Components: {component_count}
- Files: {file_count}
- Version: {version}

Progressive Loading Levels:
- Level 0: Quick Start (~2K tokens)
- Level 1: Design Tokens (~8K tokens)
- Level 2: Components & Patterns (~15K tokens)
- Level 3: Complete Reference (~25K tokens)

Usage:
Load design system context when working with:
- UI component implementation
- Design token application
- Style consistency validation
- Design pattern analysis

Preview:
Open interactive showcase:
  file://{absolute_path}/.workflow/reference_style/{package_name}/preview.html

Next Steps:
1. Load appropriate level based on your task
2. Reference component-patterns.json for implementation
3. Use design-tokens.json for consistent styling
```

---

## Error Handling

### Common Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| Package not found | Invalid package name or package doesn't exist | Run codify-style first to create package |
| SKILL already exists | SKILL.md already generated | Use --regenerate to force regeneration |
| Missing metadata.json | Incomplete package | Verify package integrity, re-run codify-style |
| Invalid metadata format | Corrupted metadata.json | Regenerate package with codify-style |

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
{package_name} design system with {component_count} components and interactive preview (located at .workflow/reference_style/{package_name}). Load when working with UI components, design tokens, style guidelines, analyzing design patterns, or implementing visual consistency.
```

**Required Elements**:
- Package name
- Component count
- Location (full path)
- Trigger keywords (UI components, design tokens, style guidelines, design patterns)
- Action verbs (working with, analyzing, implementing)

### Progressive Loading Structure

**Level 0** (~2K tokens):
- README.md
- metadata.json

**Level 1** (~8K tokens):
- Level 0 files
- design-tokens.json
- style-guide.md

**Level 2** (~15K tokens):
- Level 1 files
- component-patterns.json
- animation-tokens.json (if exists)

**Level 3** (~25K tokens):
- All files including preview.html/css

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
  ├─ Phase 2: Read Metadata (extract metadata.json, README.md, count components)
  └─ Phase 3: Generate SKILL.md (write SKILL with progressive loading)

No external commands called
Direct file reading and writing
Smart description generation from metadata
```
