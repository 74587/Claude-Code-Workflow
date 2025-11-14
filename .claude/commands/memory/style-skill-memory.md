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
  {"content": "Read package data", "status": "pending", "activeForm": "Reading package data"},
  {"content": "Generate SKILL.md with design references", "status": "pending", "activeForm": "Generating SKILL.md"}
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

### Phase 2: Read Package Data

**Purpose**: Read all package files for SKILL description generation

**Step 1: Read All JSON Files**

```bash
# Read layout templates
Read(file_path=".workflow/reference_style/${package_name}/layout-templates.json")

# Read design tokens
Read(file_path=".workflow/reference_style/${package_name}/design-tokens.json")

# Read animation tokens (if exists)
bash(test -f .workflow/reference_style/${package_name}/animation-tokens.json && echo "exists" || echo "missing")
Read(file_path=".workflow/reference_style/${package_name}/animation-tokens.json")  # if exists
```

**Step 2: Extract Metadata & Analyze Design System**

**A. Extract Metadata for Description:**

```bash
# Count components and classify by type
bash(jq '.layout_templates | length' layout-templates.json)
bash(jq '[.layout_templates[] | select(.component_type == "universal")] | length' layout-templates.json)
bash(jq '[.layout_templates[] | select(.component_type == "specialized")] | length' layout-templates.json)
bash(jq -r '.layout_templates | to_entries[] | select(.value.component_type == "universal") | .key' layout-templates.json | head -5)
```

**B. Analyze Design System for Dynamic Principles:**

Analyze design-tokens.json to extract characteristics and patterns:

```bash
# Analyze color system characteristics
bash(jq '.colors | keys' design-tokens.json)  # Color token names (check for semantic naming)
bash(jq '.colors | to_entries[0:2] | map(.value)' design-tokens.json)  # Sample color values

# Detect spacing scale pattern
bash(jq '.spacing | to_entries | map(.value) | map(gsub("[^0-9.]"; "") | tonumber)' design-tokens.json)
# Analyze pattern: linear (4-8-12-16) vs geometric (4-8-16-32) vs custom

# Analyze typography characteristics
bash(jq '.typography | keys | map(select(contains("family") or contains("weight")))' design-tokens.json)
bash(jq '.typography | to_entries | map(select(.key | contains("size"))) | .[].value' design-tokens.json)  # Size values

# Analyze border radius style
bash(jq '.border_radius | to_entries | map(.value)' design-tokens.json)
# Check range: small values (sharp, modern) vs large values (rounded, friendly)

# Analyze shadow characteristics
bash(jq '.shadows | keys' design-tokens.json)  # Shadow naming (elevation levels)
bash(jq '.shadows | to_entries[0].value' design-tokens.json)  # Sample shadow definition

# Analyze animations (if available)
bash(jq '.duration | to_entries | map(.value)' animation-tokens.json)  # Duration range
bash(jq '.easing | keys' animation-tokens.json)  # Easing function variety
```

**Summary Variables**:
- `COMPONENT_COUNT`: Total components
- `UNIVERSAL_COUNT`: Universal components count
- `SPECIALIZED_COUNT`: Specialized components count
- `UNIVERSAL_COMPONENTS`: Universal component names (first 5 for description)
- `HAS_ANIMATIONS`: Whether animation-tokens.json exists
- `DESIGN_TOKENS_DATA`: Complete design-tokens.json content (from Read)
- `LAYOUT_TEMPLATES_DATA`: Complete layout-templates.json content (from Read)
- `ANIMATION_TOKENS_DATA`: Complete animation-tokens.json content (from Read, if available)
- **`DESIGN_ANALYSIS`**: Analysis results for dynamic principle generation:
  - `has_colors`: Colors exist (generate "Color System" principle)
  - `color_semantic`: Has semantic naming (primary/secondary/accent pattern)
  - `spacing_pattern`: Detected pattern type ("linear", "geometric", "custom")
  - `spacing_scale`: Actual scale values (e.g., [4, 8, 16, 32, 64])
  - `has_typography`: Typography system exists
  - `typography_hierarchy`: Has size scale for hierarchy
  - `has_radius`: Border radius exists
  - `radius_style`: Style characteristic ("sharp" <4px, "moderate" 4-8px, "rounded" >8px)
  - `has_shadows`: Shadow system exists
  - `shadow_pattern`: Elevation naming pattern
  - `has_animations`: Animation tokens exist
  - `animation_range`: Duration range (fast to slow)
  - `easing_variety`: Types of easing functions

**Note**: Analysis focuses on characteristics and patterns, not counts. Results guide which principles to include and what examples to show.

**TodoWrite Update**:
```json
[
  {"content": "Read package data", "status": "completed", "activeForm": "Reading package data"},
  {"content": "Generate SKILL.md with design references", "status": "in_progress", "activeForm": "Generating SKILL.md"}
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

Use Write tool to generate SKILL.md with the following optimized content.

**Data Sources**:
1. **Design Token Values**: Iterate directly from `DESIGN_TOKENS_DATA`, `LAYOUT_TEMPLATES_DATA`, `ANIMATION_TOKENS_DATA`
2. **Dynamic Principles**: Use `DESIGN_ANALYSIS` characteristics to generate context-specific principles:
   - If `has_colors`: Include "Color System" with semantic pattern and examples
   - If `spacing_pattern` detected: Include "Spatial Rhythm" with pattern type and scale
   - If `has_typography` with hierarchy: Include "Typographic System" with scale examples
   - If `has_radius`: Include "Shape Language" with style characteristic (sharp/moderate/rounded)
   - If `has_shadows`: Include "Depth & Elevation" with pattern explanation
   - If `has_animations`: Include "Motion & Timing" with duration range and easing variety
   - Always include: "Accessibility First" principle
3. **Examples**: Insert actual characteristics from analysis (e.g., `{radius_style}` → "moderate (4-8px, balanced approach)", `{spacing_pattern}` → "geometric progression (4→8→16→32)")

```markdown
---
name: style-{package_name}
description: {intelligent description from Step 2}
---

# {Package Name} Style SKILL Package

## Package Overview

**Base Location**: `.workflow/reference_style/{package_name}/`

**JSON Files**:
- **Design Tokens**: `.workflow/reference_style/{package_name}/design-tokens.json`
- **Layout Templates**: `.workflow/reference_style/{package_name}/layout-templates.json`
- **Animation Tokens**: `.workflow/reference_style/{package_name}/animation-tokens.json` {has_animations ? "(available)" : "(not available)"}

**Package Details**:
- Package: {package_name}
- Layout Templates: {component_count} total
  - **Universal Components**: {universal_count} (reusable, project-independent)
  - **Specialized Components**: {specialized_count} (project-specific, excluded)
- Universal Component Types: {comma-separated list of UNIVERSAL_COMPONENTS}
- Preview: `.workflow/reference_style/{package_name}/preview.html`

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

## 📖 How to Use This SKILL

### Quick Access Pattern

**This SKILL provides design references, NOT executable code.** To use the design system:

1. **Query JSON files with jq commands** (see [Quick Index](#-quick-index) for detailed commands)
2. **Extract relevant tokens** for your implementation
3. **Adapt values** based on your specific design needs

### Basic Usage Examples

```bash
# View all colors
jq '.colors' .workflow/reference_style/{package_name}/design-tokens.json

# List universal components
jq -r '.layout_templates | to_entries[] | select(.value.component_type == "universal") | .key' \
  .workflow/reference_style/{package_name}/layout-templates.json

# Get specific component structure
jq '.layout_templates["button"]' .workflow/reference_style/{package_name}/layout-templates.json
```

### Progressive Loading

- **Level 0** (~5K tokens): Quick token reference with `jq '.colors'`, `jq '.typography'`
- **Level 1** (~12K tokens): Component filtering with `select(.component_type == "universal")`
- **Level 2** (~20K tokens): Complex queries, animations, and preview

**See [Quick Index](#-quick-index) section below for comprehensive jq command guide.**

---

## 🎨 Style Understanding & Design References

**IMPORTANT**: Reference values extracted from codebase. Dynamically adjust based on specific design needs.

### Design Principles

**Dynamically generated based on design token characteristics:**

{ANALYZE design-tokens.json characteristics and generate context-specific principles:

IF has_colors:
**Color System**
- Semantic naming: {color_semantic ? "primary/secondary/accent hierarchy" : "descriptive names"}
- Use color intentionally to guide attention and convey meaning
- Maintain consistent color relationships for brand identity
- Ensure sufficient contrast ratios (WCAG AA/AAA) for accessibility

IF spacing_pattern detected:
**Spatial Rhythm**
- Scale pattern: {spacing_pattern} (e.g., "geometric: 4→8→16→32→64" or "linear: 4→8→12→16")
- Actual scale: {spacing_scale} creates consistent visual rhythm
- {spacing_pattern == "geometric" ? "Exponential growth provides clear hierarchy" : "Linear progression offers subtle gradations"}
- Apply systematically: smaller values for compact elements, larger for breathing room

IF has_typography with typography_hierarchy:
**Typographic System**
- Type scale establishes content hierarchy and readability
- Size progression: {typography_scale_example} (e.g., "12px→14px→16px→20px→24px")
- Use scale consistently: body text at base, headings at larger sizes
- Maintain adequate line-height for readability (1.4-1.6 for body text)

IF has_radius:
**Shape Language**
- Radius style: {radius_style} (e.g., "sharp <4px: modern, technical" or "rounded >8px: friendly, approachable")
- Creates visual personality: sharp = precision, rounded = warmth
- Apply consistently across similar elements (all cards, all buttons)
- Match to brand tone: corporate/technical = sharper, consumer/friendly = rounder

IF has_shadows:
**Depth & Elevation**
- Shadow pattern: {shadow_pattern} (e.g., "elevation-based: subtle→moderate→prominent")
- Use shadows to indicate interactivity and component importance
- Consistent application reinforces spatial relationships
- Subtle for static cards, prominent for floating/interactive elements

IF has_animations:
**Motion & Timing**
- Duration range: {animation_range} (e.g., "100ms (fast feedback) to 300ms (content transitions)")
- Easing variety: {easing_variety} (e.g., "ease-in-out for natural motion, ease-out for UI responses")
- Fast durations for immediate feedback, slower for spatial changes
- Consistent timing creates predictable, polished experience

ALWAYS include:
**Accessibility First**
- Minimum 4.5:1 contrast for text, 3:1 for UI components (WCAG AA)
- Touch targets ≥44px for mobile interaction
- Clear focus states for keyboard navigation
- Test with screen readers and keyboard-only navigation
}

---

### Design Token Values

#### Colors

{FOR each color in PRIMARY_COLORS:
  - **{color.key}**: `{color.value}`
}

#### Typography

{FOR each font in TYPOGRAPHY_FONTS:
  - **{font.key}**: `{font.value}`
}

#### Spacing Scale

{FOR each spacing in SPACING_SCALE:
  - **{spacing.key}**: `{spacing.value}`
}

#### Border Radius

{FOR each radius in BORDER_RADIUS:
  - **{radius.key}**: `{radius.value}`
}

#### Shadows

{FOR each shadow in SHADOWS:
  - **{shadow.key}**: `{shadow.value}`
}

{IF HAS_ANIMATIONS:
#### Animation & Timing

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

## 🔍 Quick Index

### Available JSON Fields

**High-level structure overview for quick understanding**

#### design-tokens.json
```
.colors             # Color palette (brand, semantic, surface, text, border)
.typography         # Font families, sizes, weights, line heights
.spacing            # Spacing scale (xs, sm, md, lg, xl, etc.)
.border_radius      # Border radius tokens (sm, md, lg, etc.)
.shadows            # Shadow definitions (elevation levels)
._metadata          # Usage recommendations and guidelines
  ├─ .usage_recommendations.typography
  ├─ .usage_recommendations.spacing
  └─ ...
```

#### layout-templates.json
```
.layout_templates                    # Component layout patterns
  ├─ .<component_name>
  │   ├─ .component_type            # "universal" or "specialized"
  │   ├─ .variants                  # Component variants array
  │   ├─ .usage_guide               # Usage guidelines
  │   │   ├─ .common_sizes
  │   │   ├─ .variant_recommendations
  │   │   ├─ .usage_context
  │   │   └─ .accessibility_tips
  │   └─ ...
```

#### animation-tokens.json (if available)
```
.duration           # Animation duration tokens
.easing            # Easing function tokens
```

---

### Progressive jq Usage Guide

#### 🔰 Level 0: Basic Queries (~5K tokens)

```bash
# View entire file
jq '.' <file>.json

# List top-level keys
jq 'keys' <file>.json

# Extract specific field
jq '.<field_name>' <file>.json
```

**Use when:** Quick reference, first-time exploration

---

#### 🎯 Level 1: Filter & Extract (~12K tokens)

```bash
# Count items
jq '.<field> | length' <file>.json

# Filter by condition
jq '[.<field>[] | select(.<key> == "<value>")]' <file>.json

# Extract names
jq -r '.<field> | to_entries[] | select(<condition>) | .key' <file>.json

# Formatted output
jq -r '.<field> | to_entries[] | "\(.key): \(.value)"' <file>.json
```

**Universal components filter:** `select(.component_type == "universal")`

**Use when:** Building components, filtering data

---

#### 🚀 Level 2: Combine & Transform (~20K tokens)

```bash
# Pattern search
jq '.<field> | keys[] | select(. | contains("<pattern>"))' <file>.json

# Regex match
jq -r '.<field> | to_entries[] | select(.key | test("<regex>"; "i"))' <file>.json

# Multi-file query
jq '.' file1.json && jq '.' file2.json

# Nested extraction
jq '.<field>["<name>"].<nested_field>' <file>.json

# Preview server
cd .workflow/reference_style/{package_name} && python -m http.server 8080
```

**Use when:** Complex queries, comprehensive analysis

---

### Common Query Cheatsheet

| Task | Pattern |
|------|---------|
| View field | `jq '.<field>' <file>.json` |
| List names | `jq -r '.<field> \| keys[]' <file>.json` |
| Count items | `jq '.<field> \| length' <file>.json` |
| Filter universal | `jq '[.<field>[] \| select(.component_type == "universal")]' <file>.json` |
| Preview | `cd .workflow/reference_style/{package_name} && python -m http.server 8080` |

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
  {"content": "Read package data", "status": "completed", "activeForm": "Reading package data"},
  {"content": "Generate SKILL.md with design references", "status": "completed", "activeForm": "Generating SKILL.md"}
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

⚡ Quick Index:
- Level 0: Basic Queries (~5K) - View structure, extract categories
- Level 1: Filter & Extract (~12K) - Filter universal components, format output
- Level 2: Combine & Transform (~20K) - Search patterns, combine queries, preview

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

### Design Token Display in SKILL.md

**No Pre-Extraction Required**: Design token values (colors, typography, spacing, etc.) are NOT extracted in Phase 2. Instead, they are directly accessed from the read file contents during SKILL.md generation in Phase 3.

**Display Strategy**:
- **Colors**: Iterate `DESIGN_TOKENS_DATA.colors` and display all key-value pairs
- **Typography**: Iterate `DESIGN_TOKENS_DATA.typography` and display all key-value pairs
- **Spacing**: Iterate `DESIGN_TOKENS_DATA.spacing` and display all key-value pairs
- **Border Radius**: Iterate `DESIGN_TOKENS_DATA.border_radius` and display all key-value pairs
- **Shadows**: Iterate `DESIGN_TOKENS_DATA.shadows` and display all key-value pairs
- **Animations** (if available): Iterate `ANIMATION_TOKENS_DATA.duration` and `ANIMATION_TOKENS_DATA.easing`

**Component Classification** (minimal extraction for description only):
- Universal Count: `jq '[.layout_templates[] | select(.component_type == "universal")] | length'`
- Specialized Count: `jq '[.layout_templates[] | select(.component_type == "specialized")] | length'`
- Universal Component Names: `jq -r '.layout_templates | to_entries[] | select(.value.component_type == "universal") | .key' | head -5`

**Benefit**: Eliminates 10+ separate jq extraction commands in Phase 2, simplifies data flow.

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
Package Overview (concise with JSON file paths)
Core Rules (3 rules, consolidated)
How to Use This SKILL (NEW - explains jq query approach with examples)
  ├─ Quick Access Pattern (3-step process)
  ├─ Basic Usage Examples (3 jq commands)
  └─ Progressive Loading overview
Style Understanding & Design References
  ├─ Design Principles (DYNAMIC - based on characteristics, not counts)
  │   ├─ Color System (if colors exist, show semantic pattern)
  │   ├─ Spatial Rhythm (if spacing exists, show pattern: linear/geometric + actual scale)
  │   ├─ Typographic System (if hierarchy exists, show size progression)
  │   ├─ Shape Language (if radius exists, show style: sharp/moderate/rounded)
  │   ├─ Depth & Elevation (if shadows exist, show elevation pattern)
  │   ├─ Motion & Timing (if animations exist, show duration range + easing)
  │   └─ Accessibility First (always included)
  └─ Design Token Values (colors, typography, spacing, radius, shadows, animations)
Quick Index
  ├─ Available JSON Fields (high-level structure)
  ├─ Progressive jq Usage Guide (Level 0-2, concise generic patterns)
  └─ Common Query Cheatsheet
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

- **Clear Usage Instructions**: New "How to Use This SKILL" section explains jq query approach with 3 concrete examples
- **Characteristic-Based Principles**: Generated from design token characteristics (patterns, styles, ranges), not counts
- **Smart Analysis**: jq analyzes semantic naming, spacing patterns (linear/geometric), radius style (sharp/rounded), shadow elevation, animation ranges
- **Meaningful Insights**: Focus on design implications (e.g., "rounded radius = friendly" vs "10 radius tokens")
- **Conditional Principles**: Only include relevant design aspects based on token existence and characteristics
- **JSON File Paths**: Package Overview clearly lists all JSON file locations
- **Read Once, Analyze Characteristics**: Complete files read once, then extract patterns with jq
- **Universal jq Patterns**: Generic patterns with placeholders for flexible querying
- **Progressive Loading Guide**: 3-level approach with token estimates and use cases
- **Component Filtering**: Clear universal/specialized distinction with filtering commands
- **Self-Contained**: All loading logic embedded, no external dependencies
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
  ├─ Phase 2: Read Package Data & Analyze Design System
  │   ├─ Read design-tokens.json (complete content)
  │   ├─ Read layout-templates.json (complete content)
  │   ├─ Read animation-tokens.json (if exists, complete content)
  │   ├─ Extract metadata for description (using jq):
  │   │   ├─ Component count
  │   │   ├─ Universal/specialized counts
  │   │   └─ Universal component names (first 5)
  │   └─ Analyze design system (using jq on read data):
  │       ├─ Color count and examples
  │       ├─ Spacing pattern detection (geometric progression)
  │       ├─ Typography system (fonts/weights count)
  │       ├─ Border radius count and examples
  │       ├─ Shadow levels count
  │       └─ Animation durations (if available)
  │
  └─ Phase 3: Generate Optimized SKILL.md
      ├─ Create SKILL directory
      ├─ Generate intelligent description with keywords
      ├─ Write SKILL.md with optimized structure:
      │   ├─ Package Overview (with JSON file paths)
      │   ├─ Core Rules (3 rules)
      │   ├─ How to Use This SKILL (NEW - jq query examples and loading guide)
      │   ├─ Style Understanding & Design References
      │   │   ├─ Design Principles (DYNAMIC - based on characteristics)
      │   │   │   ├─ Color System (if colors exist, with semantic pattern)
      │   │   │   ├─ Spatial Rhythm (if spacing exists, with pattern: linear/geometric)
      │   │   │   ├─ Typographic System (if typography hierarchy exists)
      │   │   │   ├─ Shape Language (if radius exists, with style: sharp/moderate/rounded)
      │   │   │   ├─ Depth & Elevation (if shadows exist, with elevation pattern)
      │   │   │   ├─ Motion & Timing (if animations exist, with duration range)
      │   │   │   └─ Accessibility First (always included)
      │   │   └─ Design Token Values (iterate from read data)
      │   ├─ Quick Index
      │   │   ├─ Available JSON Fields
      │   │   ├─ Progressive jq Usage Guide (Level 0-2)
      │   │   └─ Common Query Cheatsheet
      │   ├─ Package Structure
      │   └─ Regenerate command
      ├─ Verify SKILL.md created successfully
      └─ Display concise completion message

Data Flow:
  Read Files (Phase 2A):
    design-tokens.json → Read → DESIGN_TOKENS_DATA (complete JSON)
    layout-templates.json → Read → LAYOUT_TEMPLATES_DATA (complete JSON)
    animation-tokens.json → Read → ANIMATION_TOKENS_DATA (if available, complete JSON)

  Analysis with jq (Phase 2B - on read data):
    DESIGN_TOKENS_DATA → jq commands → DESIGN_ANALYSIS (characteristics):
      ├─ jq '.colors | keys' → color_semantic (check naming pattern)
      ├─ jq '.spacing | ... | map(tonumber)' → spacing_pattern (linear/geometric/custom)
      ├─ jq '.spacing | ...' → spacing_scale (actual values)
      ├─ jq '.typography | ...' → typography_hierarchy (size scale exists)
      ├─ jq '.border_radius | map(.value)' → radius_style (sharp/moderate/rounded)
      ├─ jq '.shadows | keys' → shadow_pattern (naming convention)
      └─ jq '.duration | map(.value)' → animation_range (if animations)

    LAYOUT_TEMPLATES_DATA → jq commands → Metadata:
      ├─ jq '.layout_templates | length' → COMPONENT_COUNT
      ├─ jq '[... | select(.component_type == "universal")]' → UNIVERSAL_COUNT
      └─ jq -r '... | .key' → UNIVERSAL_COMPONENTS (first 5)

  SKILL.md Generation (Phase 3 - uses both read data and analysis):
    DESIGN_ANALYSIS → Dynamic Principles (based on characteristics):
      ├─ IF has_colors → "Color System" (with semantic pattern)
      ├─ IF spacing_pattern detected → "Spatial Rhythm" (with pattern type & scale)
      ├─ IF has_typography_hierarchy → "Typographic System" (with scale examples)
      ├─ IF has_radius → "Shape Language" (with style: sharp/moderate/rounded)
      ├─ IF has_shadows → "Depth & Elevation" (with elevation pattern)
      ├─ IF has_animations → "Motion & Timing" (with duration range & easing)
      └─ ALWAYS → "Accessibility First"

    DESIGN_TOKENS_DATA → Direct Iteration → Design Token Values

    Final SKILL.md Structure:
      ├─ Package Overview (with JSON paths)
      ├─ Core Rules
      ├─ How to Use This SKILL (NEW - jq examples)
      ├─ Design Principles (DYNAMIC from DESIGN_ANALYSIS)
      ├─ Design Token Values (iterate from DESIGN_TOKENS_DATA)
      └─ Quick Index (fields + jq guide + cheatsheet)

Optimization Impact:
  ✅ Read once, analyze characteristics (Phase 2A: Read, Phase 2B: Extract patterns/styles)
  ✅ Usage rules included ("How to Use This SKILL" with jq examples)
  ✅ Characteristic-based principles (patterns, not counts: "geometric spacing" vs "8 spacing tokens")
  ✅ Meaningful insights (design implications: "sharp=modern" vs "radius count")
  ✅ Context-specific principles (6-7 based on actual characteristics)
  ✅ Direct iteration for token values (from DESIGN_TOKENS_DATA)
  ✅ Conditional principle inclusion (based on token existence & characteristics)
  ✅ Embedded jq for analysis (maintains clear command examples)
  ✅ Clear JSON file paths (Package Overview lists all locations)
  ✅ Self-contained loading (all logic in SKILL.md)
```
