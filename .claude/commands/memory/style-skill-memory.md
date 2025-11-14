---
name: style-skill-memory
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

**Key Features**:
- Extracts primary design references (colors, typography, spacing, etc.)
- Provides dynamic adjustment guidelines for design tokens
- Progressive loading structure for efficient token usage
- Interactive preview showcase

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
  {"content": "Read package data and extract design references", "status": "pending", "activeForm": "Reading package data"},
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
  {"content": "Read package data and extract design references", "status": "in_progress", "activeForm": "Reading package data"}
]
```

---

### Phase 2: Read Package Data & Extract Design References

**Purpose**: Extract package information and primary design references for SKILL description generation

**Step 1: Count Components**

```bash
bash(jq '.layout_templates | length' .workflow/reference_style/${package_name}/layout-templates.json 2>/dev/null || echo 0)
```

Store result as `component_count`

**Step 2: Extract Component Types and Classification**

```bash
# Extract component names from layout templates
bash(jq -r '.layout_templates | keys[]' .workflow/reference_style/${package_name}/layout-templates.json 2>/dev/null | head -10)

# Count universal vs specialized components
bash(jq '[.layout_templates[] | select(.component_type == "universal")] | length' .workflow/reference_style/${package_name}/layout-templates.json 2>/dev/null || echo 0)
bash(jq '[.layout_templates[] | select(.component_type == "specialized")] | length' .workflow/reference_style/${package_name}/layout-templates.json 2>/dev/null || echo 0)

# Extract universal component names only
bash(jq -r '.layout_templates | to_entries | map(select(.value.component_type == "universal")) | .[].key' .workflow/reference_style/${package_name}/layout-templates.json 2>/dev/null | head -10)
```

Store as:
- `COMPONENT_TYPES`: List of available component types (all)
- `UNIVERSAL_COUNT`: Number of universal (reusable) components
- `SPECIALIZED_COUNT`: Number of specialized (project-specific) components
- `UNIVERSAL_COMPONENTS`: List of universal component names

**Step 3: Read Design Tokens**

```bash
Read(file_path=".workflow/reference_style/${package_name}/design-tokens.json")
```

**Extract Primary Design References**:

**Colors** (top 3-5 most important):
```bash
bash(jq -r '.colors | to_entries | .[0:5] | .[] | "\(.key): \(.value)"' .workflow/reference_style/${package_name}/design-tokens.json 2>/dev/null | head -5)
```

**Typography** (heading and body fonts):
```bash
bash(jq -r '.typography | to_entries | select(.key | contains("family")) | .[] | "\(.key): \(.value)"' .workflow/reference_style/${package_name}/design-tokens.json 2>/dev/null)
```

**Spacing Scale** (base spacing values):
```bash
bash(jq -r '.spacing | to_entries | .[0:5] | .[] | "\(.key): \(.value)"' .workflow/reference_style/${package_name}/design-tokens.json 2>/dev/null)
```

**Border Radius** (base radius values):
```bash
bash(jq -r '.border_radius | to_entries | .[] | "\(.key): \(.value)"' .workflow/reference_style/${package_name}/design-tokens.json 2>/dev/null)
```

**Shadows** (elevation levels):
```bash
bash(jq -r '.shadows | to_entries | .[0:3] | .[] | "\(.key): \(.value)"' .workflow/reference_style/${package_name}/design-tokens.json 2>/dev/null)
```

Store extracted references as:
- `PRIMARY_COLORS`: List of primary color tokens
- `TYPOGRAPHY_FONTS`: Font family tokens
- `SPACING_SCALE`: Base spacing values
- `BORDER_RADIUS`: Radius values
- `SHADOWS`: Shadow definitions

**Step 4: Read Animation Tokens (if available)**

```bash
# Check if animation tokens exist
bash(test -f .workflow/reference_style/${package_name}/animation-tokens.json && echo "available" || echo "not_available")
```

If available, extract:
```bash
Read(file_path=".workflow/reference_style/${package_name}/animation-tokens.json")

# Extract primary animation values
bash(jq -r '.duration | to_entries | .[] | "\(.key): \(.value)"' .workflow/reference_style/${package_name}/animation-tokens.json 2>/dev/null)
bash(jq -r '.easing | to_entries | .[0:3] | .[] | "\(.key): \(.value)"' .workflow/reference_style/${package_name}/animation-tokens.json 2>/dev/null)
```

Store as:
- `ANIMATION_DURATIONS`: Animation duration tokens
- `EASING_FUNCTIONS`: Easing function tokens

**Step 5: Count Files**

```bash
bash(cd .workflow/reference_style/${package_name} && ls -1 *.json *.html *.css 2>/dev/null | wc -l)
```

Store result as `file_count`

**Summary Data Collected**:
- `COMPONENT_COUNT`: Number of components in layout templates
- `UNIVERSAL_COUNT`: Number of universal (reusable) components
- `SPECIALIZED_COUNT`: Number of specialized (project-specific) components
- `COMPONENT_TYPES`: List of component types (first 10)
- `UNIVERSAL_COMPONENTS`: List of universal component names (first 10)
- `FILE_COUNT`: Total files in package
- `HAS_ANIMATIONS`: Whether animation tokens are available
- `PRIMARY_COLORS`: Primary color tokens with values
- `TYPOGRAPHY_FONTS`: Font family tokens
- `SPACING_SCALE`: Base spacing scale
- `BORDER_RADIUS`: Border radius values
- `SHADOWS`: Shadow definitions
- `ANIMATION_DURATIONS`: Animation durations (if available)
- `EASING_FUNCTIONS`: Easing functions (if available)

**TodoWrite Update**:
```json
[
  {"content": "Read package data and extract design references", "status": "completed", "activeForm": "Reading package data"},
  {"content": "Generate SKILL.md with progressive loading", "status": "in_progress", "activeForm": "Generating SKILL.md"}
]
```

---

### Phase 3: Generate SKILL.md

**Purpose**: Create SKILL memory index with progressive loading structure and design references

**Step 1: Create SKILL Directory**

```bash
bash(mkdir -p .claude/skills/style-${package_name})
```

**Step 2: Generate Intelligent Description**

**Format**:
```
{package_name} project-independent design system with {universal_count} universal layout templates and interactive preview (located at .workflow/reference_style/{package_name}). Load when working with reusable UI components, design tokens, layout patterns, or implementing visual consistency. Excludes {specialized_count} project-specific components.
```

**Key Elements**:
- **Universal Count**: Emphasize available reusable layout templates
- **Project Independence**: Clearly state project-independent nature
- **Specialized Exclusion**: Mention excluded project-specific components
- **Path Reference**: Precise package location
- **Trigger Keywords**: reusable UI components, design tokens, layout patterns, visual consistency
- **Action Coverage**: working with, analyzing, implementing

**Example**:
```
main-app-style-v1 project-independent design system with 5 universal layout templates and interactive preview (located at .workflow/reference_style/main-app-style-v1). Load when working with reusable UI components, design tokens, layout patterns, or implementing visual consistency. Excludes 3 project-specific components.
```

**Step 3: Write SKILL.md**

Use Write tool to generate SKILL.md with the following optimized content:

```markdown
---
name: style-{package_name}
description: {intelligent description from Step 2}
---

# {Package Name} Style SKILL Package

## Package Overview

**Location**: `../../../.workflow/reference_style/{package_name}/`

**Package Details**:
- Package: {package_name}
- Layout Templates: {component_count} total
  - **Universal Components**: {universal_count} (reusable, project-independent)
  - **Specialized Components**: {specialized_count} (project-specific, excluded)
- Universal Component Types: {comma-separated list of UNIVERSAL_COMPONENTS}
- Animation Tokens: {has_animations ? "✓ Available" : "Not available"}
- Preview: `../../../.workflow/reference_style/{package_name}/preview.html`

---

## ⚡ Core Rules

1. **Project-Independent Reference**: This is a style reference system. All patterns and tokens are adaptable starting points, not fixed constraints.

2. **Universal Components Only**: When using `layout-templates.json`, **ONLY** reference components where `component_type: "universal"`. **IGNORE** `component_type: "specialized"`.

3. **Token Adaptation**: Adjust design tokens (colors, spacing, typography, shadows, etc.) based on:
   - Brand requirements and identity
   - Accessibility standards (WCAG compliance, readability)
   - Platform conventions (mobile/desktop, iOS/Android/Web)
   - Context needs (light/dark mode, responsive breakpoints)

---

## 🎨 Primary Design References

**IMPORTANT**: Reference values extracted from codebase. Dynamically adjust based on specific design needs.

### Colors

{FOR each color in PRIMARY_COLORS:
  - **{color.key}**: `{color.value}`
}

### Typography

{FOR each font in TYPOGRAPHY_FONTS:
  - **{font.key}**: `{font.value}`
}

### Spacing Scale

{FOR each spacing in SPACING_SCALE:
  - **{spacing.key}**: `{spacing.value}`
}

### Border Radius

{FOR each radius in BORDER_RADIUS:
  - **{radius.key}**: `{radius.value}`
}

### Shadows

{FOR each shadow in SHADOWS:
  - **{shadow.key}**: `{shadow.value}`
}

{IF HAS_ANIMATIONS:
### Animation & Timing

**Durations**:
{FOR each duration in ANIMATION_DURATIONS:
  - {duration.key}: `{duration.value}`
}

**Easing Functions**:
{FOR each easing in EASING_FUNCTIONS:
  - {easing.key}: `{easing.value}`
}
}

---

## Progressive Loading

### Level 0: Design Tokens (~5K tokens)

Essential design token system for consistent styling.

**Load Command**:
```bash
# Display design tokens
jq '.' .workflow/reference_style/{package_name}/design-tokens.json

# Extract specific categories
jq '.colors' .workflow/reference_style/{package_name}/design-tokens.json
jq '.typography' .workflow/reference_style/{package_name}/design-tokens.json
jq '.spacing' .workflow/reference_style/{package_name}/design-tokens.json
```

**Use when**: Quick token reference, applying consistent styles, color/typography queries

---

### Level 1: Universal Layout Templates (~12K tokens)

Project-independent component layout patterns for reusable UI elements.

**Load Command**:
```bash
# Load Level 0 + layout templates
jq '.' .workflow/reference_style/{package_name}/design-tokens.json
jq '.' .workflow/reference_style/{package_name}/layout-templates.json

# Filter universal components only
jq '.layout_templates | to_entries[] | select(.value.component_type == "universal")' \
  .workflow/reference_style/{package_name}/layout-templates.json

# List universal component names
jq -r '.layout_templates | to_entries[] | select(.value.component_type == "universal") | .key' \
  .workflow/reference_style/{package_name}/layout-templates.json

# Get specific universal component
jq '.layout_templates["button"] | select(.component_type == "universal")' \
  .workflow/reference_style/{package_name}/layout-templates.json
```

**Use when**: Building components, understanding component architecture, implementing layouts

---

### Level 2: Complete System (~20K tokens)

Full design system with animations and interactive preview.

**Load Command**:
```bash
# Load Level 1 + animation tokens + preview
jq '.' .workflow/reference_style/{package_name}/design-tokens.json
jq '.' .workflow/reference_style/{package_name}/layout-templates.json
jq '.' .workflow/reference_style/{package_name}/animation-tokens.json  # if available

# View interactive preview
cd .workflow/reference_style/{package_name}
python -m http.server 8080
# Open http://localhost:8080/preview.html
```

**Use when**: Comprehensive analysis, animation development, complete design system understanding

---

## Quick Reference

### Common Query Commands

**Count Components by Type**:
```bash
# Universal components
jq '[.layout_templates[] | select(.component_type == "universal")] | length' \
  .workflow/reference_style/{package_name}/layout-templates.json

# Specialized components
jq '[.layout_templates[] | select(.component_type == "specialized")] | length' \
  .workflow/reference_style/{package_name}/layout-templates.json
```

**Extract Color Palette**:
```bash
# All colors with values
jq -r '.colors | to_entries[] | "\(.key): \(.value)"' \
  .workflow/reference_style/{package_name}/design-tokens.json

# Primary colors only
jq -r '.colors | to_entries[] | select(.key | contains("Primary")) | "\(.key): \(.value)"' \
  .workflow/reference_style/{package_name}/design-tokens.json
```

**Find Specific Component**:
```bash
# Search by component name
jq '.layout_templates | keys[] | select(. | contains("button"))' \
  .workflow/reference_style/{package_name}/layout-templates.json

# Get component structure
jq '.layout_templates["card"]' \
  .workflow/reference_style/{package_name}/layout-templates.json
```

**Animation Tokens** (if available):
```bash
# List all durations
jq '.duration' .workflow/reference_style/{package_name}/animation-tokens.json

# List easing functions
jq '.easing' .workflow/reference_style/{package_name}/animation-tokens.json
```

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

## Regenerate

```bash
/memory:style-skill-memory {package_name} --regenerate
```
```

**Step 4: Verify SKILL.md Created**

```bash
bash(test -f .claude/skills/style-${package_name}/SKILL.md && echo "success" || echo "failed")
```

**TodoWrite Update**:
```json
[
  {"content": "Validate style reference package", "status": "completed", "activeForm": "Validating package"},
  {"content": "Read package data and extract design references", "status": "completed", "activeForm": "Reading package data"},
  {"content": "Generate SKILL.md with progressive loading", "status": "completed", "activeForm": "Generating SKILL.md"}
]
```

**Final Action**: Report completion summary to user

---

## Completion Message

Display concise completion summary to user:

```
✅ SKILL memory generated successfully!

Package: {package_name}
SKILL Location: .claude/skills/style-{package_name}/SKILL.md

📦 Package Summary:
- Layout Templates: {component_count} total ({universal_count} universal, {specialized_count} specialized)
- Universal Components: {show first 5 UNIVERSAL_COMPONENTS, then "+ X more"}
- Animation Tokens: {has_animations ? "✓ Available" : "Not available"}

🎨 Primary Design References:
{IF PRIMARY_COLORS exists:
  - Colors: {show first 3 PRIMARY_COLORS keys only, then "+ X more"}
}
{IF TYPOGRAPHY_FONTS exists:
  - Typography: {show all TYPOGRAPHY_FONTS keys only}
}
{IF SPACING_SCALE exists:
  - Spacing Scale: {count SPACING_SCALE} tokens
}
{IF BORDER_RADIUS exists:
  - Border Radius: {count BORDER_RADIUS} tokens
}
{IF SHADOWS exists:
  - Shadows: {count SHADOWS} tokens
}
{IF HAS_ANIMATIONS:
  - Animation: {count ANIMATION_DURATIONS} durations, {count EASING_FUNCTIONS} easing functions
}

⚡ Progressive Loading:
- Level 0: Design Tokens (~5K) - Use jq commands for token queries
- Level 1: + Universal Layouts (~12K) - Filter component_type: "universal"
- Level 2: + Complete System (~20K) - Includes animations and preview

💡 Quick Start:
```bash
# List universal components
jq -r '.layout_templates | to_entries[] | select(.value.component_type == "universal") | .key' \
  .workflow/reference_style/{package_name}/layout-templates.json

# Extract colors
jq '.colors' .workflow/reference_style/{package_name}/design-tokens.json

# View preview
cd .workflow/reference_style/{package_name} && python -m http.server 8080
```

📋 Core Rules:
1. Project-Independent Reference - Tokens are adaptable starting points
2. Universal Components Only - Filter component_type: "universal"
3. Token Adaptation - Adjust for brand, accessibility, platform, context

See SKILL.md for detailed commands and usage examples.
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
3. **Extract Primary References**: Extract key design values (colors, typography, spacing, border radius, shadows, animations) with values only, no verbose guidelines
4. **Embed jq Commands**: Include bash/jq commands in SKILL.md for dynamic loading, not external scripts
5. **Progressive Loading**: Include all 3 levels (0-2) with specific jq commands for each level
6. **Intelligent Description**: Extract component count and key features from metadata
7. **Minimize Redundancy**: Single Core Rules section, no repeated warnings or usage guidelines

### SKILL Description Format

**Template**:
```
{package_name} project-independent design system with {universal_count} universal layout templates and interactive preview (located at .workflow/reference_style/{package_name}). Load when working with reusable UI components, design tokens, layout patterns, or implementing visual consistency. Excludes {specialized_count} project-specific components.
```

**Required Elements**:
- Package name
- Universal layout template count (emphasize reusability)
- Project independence statement
- Specialized component exclusion notice
- Location (full path)
- Trigger keywords (reusable UI components, design tokens, layout patterns, visual consistency)
- Action verbs (working with, analyzing, implementing)

### Primary Design References Extraction

**Required Data Extraction** (from design-tokens.json):
- Colors: Primary, secondary, accent colors (top 5)
- Typography: Font families for headings and body text
- Spacing Scale: Base spacing values (first 5)
- Border Radius: All radius tokens
- Shadows: Shadow definitions (top 3 elevation levels)

**Component Classification Extraction** (from layout-templates.json):
- Universal Count: Number of components with `component_type: "universal"`
- Specialized Count: Number of components with `component_type: "specialized"`
- Universal Component Names: List of universal component names (first 10)

**Optional Data Extraction** (from animation-tokens.json if available):
- Animation Durations: All duration tokens
- Easing Functions: All easing functions

**Extraction Format**:
Use `jq` to extract tokens from JSON files. Display key and value only, no verbose usage guidelines.
For component classification, filter by `component_type` field.

### Progressive Loading Structure with Embedded Commands

**Level 0** (~5K tokens):
- Embed jq commands to query design-tokens.json
- Commands for extracting colors, typography, spacing categories

**Level 1** (~12K tokens):
- Embed jq commands to filter universal components
- Commands for listing component names, getting specific components
- Include component_type filtering examples

**Level 2** (~20K tokens):
- Embed jq commands for animation-tokens.json
- Include preview server command
- Comprehensive query examples

### Optimized SKILL.md Structure

```
Package Overview (concise)
Core Rules (3 rules, consolidated from all previous warnings)
Primary Design References (values only, no usage guidelines)
Progressive Loading (with embedded jq commands per level)
Quick Reference (common query commands)
Package Structure
Regenerate command
```

**Removed Sections** (to eliminate redundancy):
- ❌ Usage Guidelines per token category
- ❌ Design Adaptation Strategies section
- ❌ Interactive Preview section (condensed into Level 2)
- ❌ Usage Guidelines section
- ❌ Related Commands section (condensed into Regenerate)
- ❌ All repeated Project Independence warnings

---

## Benefits

- **60%+ Content Reduction**: Optimized from ~870 to ~250 lines, eliminating all redundant content
- **No Content Overlap**: Single Core Rules section replaces 4+ repeated warnings
- **Embedded Commands**: jq commands in SKILL.md enable dynamic loading without external scripts
- **Package-Specific**: Each SKILL contains exact commands for its package structure
- **Fast Context Loading**: Progressive levels (5K/12K/20K tokens) with precise jq queries
- **Component Filtering**: Clear universal/specialized distinction with filtering commands
- **Primary Design References**: Key design values displayed without verbose usage guidelines
- **Self-Contained**: All loading logic embedded, no dependencies on external scripts
- **Intelligent Triggering**: Keywords optimize SKILL activation
- **Easy Regeneration**: Simple --regenerate flag for updates

---

## Architecture

```
style-skill-memory (Optimized)
  ├─ Phase 1: Validate
  │   ├─ Parse package name from argument or auto-detect
  │   ├─ Check package exists in .workflow/reference_style/
  │   └─ Check if SKILL already exists (skip if exists and no --regenerate)
  │
  ├─ Phase 2: Read Package Data & Extract Primary References
  │   ├─ Count components from layout-templates.json
  │   ├─ Extract universal/specialized counts (component_type filtering)
  │   ├─ Extract universal component names (first 10)
  │   ├─ Extract primary colors (top 5, key:value only)
  │   ├─ Extract typography (font families, key:value only)
  │   ├─ Extract spacing scale (first 5, key:value only)
  │   ├─ Extract border radius tokens (all, key:value only)
  │   ├─ Extract shadow definitions (top 3, key:value only)
  │   ├─ Extract animation tokens (if available, key:value only)
  │   └─ Count total files in package
  │
  └─ Phase 3: Generate Optimized SKILL.md
      ├─ Create SKILL directory
      ├─ Generate intelligent description with keywords
      ├─ Write SKILL.md with optimized structure:
      │   ├─ Package Overview (concise)
      │   ├─ Core Rules (3 rules, single consolidated section)
      │   ├─ Primary Design References (values only, no usage guidelines)
      │   ├─ Progressive Loading (3 levels with embedded jq commands)
      │   │   ├─ Level 0: jq commands for design-tokens.json
      │   │   ├─ Level 1: jq commands for universal component filtering
      │   │   └─ Level 2: jq commands for animation tokens + preview
      │   ├─ Quick Reference (common jq query commands)
      │   ├─ Package Structure
      │   └─ Regenerate command
      ├─ Verify SKILL.md created successfully
      └─ Display concise completion message

Data Flow:
  design-tokens.json → jq extraction → PRIMARY_COLORS, TYPOGRAPHY_FONTS,
                                       SPACING_SCALE, BORDER_RADIUS, SHADOWS
                                       (values only, no guidelines)
  animation-tokens.json → jq extraction → ANIMATION_DURATIONS, EASING_FUNCTIONS
                                         (if available)
  layout-templates.json → jq extraction → COMPONENT_COUNT, UNIVERSAL_COUNT,
                                         SPECIALIZED_COUNT, UNIVERSAL_COMPONENTS
                       → component_type filtering → Universal vs Specialized

  Extracted data → SKILL.md generation → Package Overview
                                      → Core Rules (consolidated warnings)
                                      → Primary Design References (concise)
                                      → Embedded jq commands (per level)
                                      → Quick Reference commands
                                      → Concise completion message

Optimization Impact:
  ✅ 60%+ content reduction (~870 → ~250 lines)
  ✅ Zero content overlap (1 Core Rules section vs 4+ repeated warnings)
  ✅ Embedded commands (no external script dependencies)
  ✅ Package-specific queries (exact paths in jq commands)
  ✅ Self-contained loading (all logic in SKILL.md)
```
