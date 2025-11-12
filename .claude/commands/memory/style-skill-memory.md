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

Use Write tool to generate SKILL.md with the following complete content:

```markdown
---
name: style-{package_name}
description: {intelligent description from Step 2}
---

# {Package Name} Style SKILL Package

## Documentation: `../../../.workflow/reference_style/{package_name}/`

## Package Overview

**Project-independent style reference package** extracted from codebase with reusable design patterns, tokens, and interactive preview.

**Package Details**:
- Package: {package_name}
- Layout Templates: {component_count} total
  - **Universal Components**: {universal_count} (reusable, project-independent)
  - **Specialized Components**: {specialized_count} (project-specific, excluded from reference)
- Universal Component Types: {comma-separated list of UNIVERSAL_COMPONENTS}
- Files: {file_count}
- Animation Tokens: {has_animations ? "✓ Available" : "Not available"}

**⚠️ IMPORTANT - Project Independence**:
This SKILL package represents a **pure style system** independent of any specific project implementation:
- **Universal components** are generic, reusable patterns (buttons, inputs, cards, navigation)
- **Specialized components** are project-specific implementations (excluded from this reference)
- All design tokens and layout patterns are extracted for **reference purposes only**
- Adapt and customize these references based on your project's specific requirements

---

## ⚡ Primary Design References

**IMPORTANT**: These are **reference values** extracted from the codebase. They should be **dynamically adjusted** based on your specific design needs, not treated as fixed constraints.

### 🎨 Colors

{FOR each color in PRIMARY_COLORS:
  - **{color.key}**: `{color.value}`
}

**Usage Guidelines**:
- These colors establish the foundation of the design system
- Adjust saturation, lightness, or hue based on:
  - Brand requirements and accessibility needs
  - Context (light/dark mode, high-contrast themes)
  - User feedback and A/B testing results
- Use color theory principles to maintain harmony when modifying

### 📝 Typography

{FOR each font in TYPOGRAPHY_FONTS:
  - **{font.key}**: `{font.value}`
}

**Usage Guidelines**:
- Font families can be substituted based on:
  - Brand identity and design language
  - Performance requirements (web fonts vs. system fonts)
  - Accessibility and readability considerations
  - Platform-specific availability
- Maintain hierarchy and scale relationships when changing fonts

### 📏 Spacing Scale

{FOR each spacing in SPACING_SCALE:
  - **{spacing.key}**: `{spacing.value}`
}

**Usage Guidelines**:
- Spacing values form a consistent rhythm system
- Adjust scale based on:
  - Target device (mobile vs. desktop vs. tablet)
  - Content density requirements
  - Component-specific needs (compact vs. comfortable layouts)
- Maintain proportional relationships when scaling

### 🔲 Border Radius

{FOR each radius in BORDER_RADIUS:
  - **{radius.key}**: `{radius.value}`
}

**Usage Guidelines**:
- Border radius affects visual softness and modernity
- Adjust based on:
  - Design aesthetic (sharp vs. rounded vs. pill-shaped)
  - Component type (buttons, cards, inputs have different needs)
  - Platform conventions (iOS vs. Android vs. Web)

### 🌫️ Shadows

{FOR each shadow in SHADOWS:
  - **{shadow.key}**: `{shadow.value}`
}

**Usage Guidelines**:
- Shadows create elevation and depth perception
- Adjust based on:
  - Material design depth levels
  - Light/dark mode contexts
  - Performance considerations (complex shadows impact rendering)
  - Visual hierarchy needs

{IF HAS_ANIMATIONS:
### ⏱️ Animation & Timing

**Durations**:
{FOR each duration in ANIMATION_DURATIONS:
  - **{duration.key}**: `{duration.value}`
}

**Easing Functions**:
{FOR each easing in EASING_FUNCTIONS:
  - **{easing.key}**: `{easing.value}`
}

**Usage Guidelines**:
- Animation timing affects perceived responsiveness and polish
- Adjust based on:
  - User expectations and platform conventions
  - Accessibility preferences (reduced motion)
  - Animation type (micro-interactions vs. page transitions)
  - Performance constraints (mobile vs. desktop)
}

---

## 🎯 Design Adaptation Strategies

### When to Adjust Design References

**Brand Alignment**:
- Modify colors to match brand identity and guidelines
- Adjust typography to reflect brand personality
- Tune spacing and radius to align with brand aesthetic

**Accessibility Requirements**:
- Increase color contrast ratios for WCAG compliance
- Adjust font sizes and spacing for readability
- Modify animation durations for reduced-motion preferences

**Platform Optimization**:
- Adapt spacing for mobile touch targets (min 44x44px)
- Adjust shadows and radius for platform conventions
- Optimize animation performance for target devices

**Context-Specific Needs**:
- Dark mode: Adjust colors, shadows, and contrasts
- High-density displays: Fine-tune spacing and sizing
- Responsive design: Scale tokens across breakpoints

### How to Apply Adjustments

1. **Identify Need**: Determine which tokens need adjustment based on your specific requirements
2. **Maintain Relationships**: Preserve proportional relationships between related tokens
3. **Test Thoroughly**: Validate changes across components and use cases
4. **Document Changes**: Track modifications and rationale for team alignment
5. **Iterate**: Refine based on user feedback and testing results

---

## Progressive Loading

### Level 0: Design Tokens (~5K tokens)

Essential design token system for consistent styling.

**Files**:
- [Design Tokens](../../../.workflow/reference_style/{package_name}/design-tokens.json) - Colors, typography, spacing, shadows, borders

**Use when**: Quick token reference, applying consistent styles, color/typography queries

---

### Level 1: Universal Layout Templates (~12K tokens)

**Project-independent** component layout patterns for reusable UI elements.

**Files**:
- Level 0 files
- [Layout Templates](../../../.workflow/reference_style/{package_name}/layout-templates.json) - Component structures with HTML/CSS patterns

**⚠️ Reference Strategy**:
- **Only reference components with `component_type: "universal"`** - these are reusable, project-independent patterns
- **Ignore components with `component_type: "specialized"`** - these are project-specific implementations
- Universal components include: buttons, inputs, forms, cards, navigation, modals, etc.
- Use universal patterns as **reference templates** to adapt for your specific project needs

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
- Load Level 1 for universal layout templates
- **Only reference components with `component_type: "universal"`** in layout-templates.json
- Apply design tokens from design-tokens.json
- Adapt patterns to your project's specific requirements

**Ensuring Style Consistency**:
- Load Level 0 for design tokens
- Use design-tokens.json for colors, typography, spacing
- Check preview.html for visual reference (universal components only)

**Analyzing Component Patterns**:
- Load Level 2 for complete analysis
- Review layout-templates.json for component architecture
- **Filter for `component_type: "universal"` to exclude project-specific implementations**
- Check preview.html for implementation examples

**Animation Development**:
- Load Level 2 for animation tokens (if available)
- Reference animation-tokens.json for durations and easing
- Apply consistent timing and transitions

**⚠️ Critical Usage Rule**:
This is a **project-independent style reference system**. When working with layout-templates.json:
- **USE**: Components marked `component_type: "universal"` as reusable reference patterns
- **IGNORE**: Components marked `component_type: "specialized"` (project-specific implementations)
- **ADAPT**: All patterns should be customized for your specific project needs

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
  {"content": "Read package data and extract design references", "status": "completed", "activeForm": "Reading package data"},
  {"content": "Generate SKILL.md with progressive loading", "status": "completed", "activeForm": "Generating SKILL.md"}
]
```

**Final Action**: Report completion summary to user

---

## Completion Message

Display extracted primary design references to user:

```
✅ SKILL memory generated successfully!

Package: {package_name}
SKILL Location: .claude/skills/style-{package_name}/SKILL.md

📦 Package Details:
- Layout Templates: {component_count} total
  - Universal (reusable): {universal_count}
  - Specialized (project-specific): {specialized_count}
- Universal Component Types: {show first 5 UNIVERSAL_COMPONENTS, then "+ X more"}
- Files: {file_count}
- Animation Tokens: {has_animations ? "✓ Available" : "Not available"}

🎨 Primary Design References Extracted:
{IF PRIMARY_COLORS exists:
Colors:
  {show first 3 PRIMARY_COLORS with key: value}
  {if more than 3: + X more colors}
}

{IF TYPOGRAPHY_FONTS exists:
Typography:
  {show all TYPOGRAPHY_FONTS}
}

{IF SPACING_SCALE exists:
Spacing Scale:
  {show first 3 SPACING_SCALE items}
  {if more than 3: + X more spacing tokens}
}

{IF BORDER_RADIUS exists:
Border Radius:
  {show all BORDER_RADIUS}
}

{IF HAS_ANIMATIONS:
Animation:
  Durations: {count ANIMATION_DURATIONS} tokens
  Easing: {count EASING_FUNCTIONS} functions
}

⚡ Progressive Loading Levels:
- Level 0: Design Tokens (~5K tokens)
- Level 1: Tokens + Layout Templates (~12K tokens)
- Level 2: Complete System (~20K tokens)

💡 Usage:
Load design system context when working with:
- UI component implementation
- Layout pattern analysis
- Design token application
- Style consistency validation

⚠️ IMPORTANT - Project Independence:
This is a **project-independent style reference system**:
- Only use universal components (component_type: "universal") as reference patterns
- Ignore specialized components (component_type: "specialized") - they are project-specific
- The extracted design references are REFERENCE VALUES, not fixed constraints
- Dynamically adjust colors, spacing, typography, and other tokens based on:
  - Brand requirements and accessibility needs
  - Platform-specific conventions and optimizations
  - Context (light/dark mode, responsive breakpoints)
  - User feedback and testing results

See SKILL.md for detailed adjustment guidelines and component filtering instructions.

🎯 Preview:
Open interactive showcase:
  file://{absolute_path}/.workflow/reference_style/{package_name}/preview.html

📋 Next Steps:
1. Load appropriate level based on your task context
2. Review Primary Design References section for key design tokens
3. Apply design tokens with dynamic adjustments as needed
4. Reference layout-templates.json for component structures
5. Use Design Adaptation Strategies when modifying tokens
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
3. **Extract Primary References**: Always extract and display key design values (colors, typography, spacing, border radius, shadows, animations)
4. **Include Adjustment Guidance**: Provide clear guidelines on when and how to dynamically adjust design tokens
5. **Progressive Loading**: Always include all 3 levels (0-2) with clear token estimates
6. **Intelligent Description**: Extract component count and key features from metadata

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
- Colors: Primary, secondary, accent colors (top 3-5)
- Typography: Font families for headings and body text
- Spacing Scale: Base spacing values (xs, sm, md, lg, xl)
- Border Radius: All radius tokens
- Shadows: Shadow definitions (top 3 elevation levels)

**Component Classification Extraction** (from layout-templates.json):
- Universal Count: Number of components with `component_type: "universal"`
- Specialized Count: Number of components with `component_type: "specialized"`
- Universal Component Names: List of universal component names (first 10)

**Optional Data Extraction** (from animation-tokens.json if available):
- Animation Durations: All duration tokens
- Easing Functions: Top 3 easing functions

**Extraction Format**:
Use `jq` to extract tokens from JSON files. Each token should include key and value.
For component classification, filter by `component_type` field.

### Dynamic Adjustment Guidelines

**Include in SKILL.md**:
1. **Usage Guidelines per Category**: Specific guidance for each token category
2. **Adjustment Strategies**: When to adjust design references
3. **Practical Examples**: Context-specific adaptation scenarios
4. **Best Practices**: How to maintain design system coherence while adjusting

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

- **Project Independence**: Clear separation between universal (reusable) and specialized (project-specific) components
- **Component Filtering**: Automatic classification helps identify which patterns are truly reusable
- **Fast Context Loading**: Progressive levels for efficient token usage
- **Primary Design References**: Extracted key design values (colors, typography, spacing, etc.) displayed prominently
- **Dynamic Adjustment Guidance**: Clear instructions on when and how to adjust design tokens
- **Intelligent Triggering**: Keywords optimize SKILL activation
- **Complete Reference**: All package files accessible through SKILL
- **Easy Regeneration**: Simple --regenerate flag for updates
- **Clear Structure**: Organized levels by use case with component type filtering
- **Practical Usage Guidelines**: Context-specific adjustment strategies and component selection criteria

---

## Architecture

```
style-skill-memory
  ├─ Phase 1: Validate
  │   ├─ Parse package name from argument or auto-detect
  │   ├─ Check package exists in .workflow/reference_style/
  │   └─ Check if SKILL already exists (skip if exists and no --regenerate)
  │
  ├─ Phase 2: Read Package Data & Extract Primary References
  │   ├─ Count components from layout-templates.json
  │   ├─ Extract component types list
  │   ├─ Extract primary colors from design-tokens.json (top 3-5)
  │   ├─ Extract typography (font families)
  │   ├─ Extract spacing scale (base values)
  │   ├─ Extract border radius tokens
  │   ├─ Extract shadow definitions (top 3)
  │   ├─ Extract animation tokens (if available)
  │   └─ Count total files in package
  │
  └─ Phase 3: Generate SKILL.md
      ├─ Create SKILL directory
      ├─ Generate intelligent description with keywords
      ├─ Write SKILL.md with complete structure:
      │   ├─ Package Overview
      │   ├─ Primary Design References
      │   │   ├─ Colors with usage guidelines
      │   │   ├─ Typography with usage guidelines
      │   │   ├─ Spacing with usage guidelines
      │   │   ├─ Border Radius with usage guidelines
      │   │   ├─ Shadows with usage guidelines
      │   │   └─ Animation & Timing (if available)
      │   ├─ Design Adaptation Strategies
      │   │   ├─ When to adjust design references
      │   │   └─ How to apply adjustments
      │   ├─ Progressive Loading (3 levels)
      │   ├─ Interactive Preview
      │   ├─ Usage Guidelines
      │   ├─ Package Structure
      │   ├─ Regeneration
      │   └─ Related Commands
      ├─ Verify SKILL.md created successfully
      └─ Display completion message with extracted design references

Data Flow:
  design-tokens.json → jq extraction → PRIMARY_COLORS, TYPOGRAPHY_FONTS,
                                       SPACING_SCALE, BORDER_RADIUS, SHADOWS
  animation-tokens.json → jq extraction → ANIMATION_DURATIONS, EASING_FUNCTIONS
  layout-templates.json → jq extraction → COMPONENT_COUNT, UNIVERSAL_COUNT,
                                         SPECIALIZED_COUNT, UNIVERSAL_COMPONENTS
                       → component_type filtering → Universal vs Specialized classification

  Extracted data → SKILL.md generation → Primary Design References section
                                      → Component Classification section
                                      → Dynamic Adjustment Guidelines
                                      → Project Independence warnings
                                      → Completion message display
```
