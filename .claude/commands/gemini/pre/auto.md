---
name: auto
description: Auto-select and execute appropriate template based on user input analysis
usage: /gemini:pre:auto "description of task or problem"
argument-hint: "description of what you want to analyze or plan"
examples:
  - /gemini:pre:auto "authentication system keeps crashing during login"
  - /gemini:pre:auto "design a real-time notification architecture"
  - /gemini:pre:auto "database connection errors in production"
  - /gemini:pre:auto "plan user dashboard with analytics features"
allowed-tools: Bash(ls:*), Bash(gemini:*)
model: sonnet
---

# Auto Template Selection (/gemini:pre:auto)

## Overview
Automatically analyzes user input to select the most appropriate template and execute Gemini CLI with optimal context.

**Process**: List Templates → Analyze Input → Select Template → Execute with Context

## Usage

### Auto-Detection Examples
```bash
# Bug-related keywords → selects bug-fix.md
/gemini:pre:auto "React component not rendering after state update"

# Planning keywords → selects plan.md  
/gemini:pre:auto "design microservices architecture for user management"

# Error/crash keywords → selects bug-fix.md
/gemini:pre:auto "API timeout errors in production environment"

# Architecture/design keywords → selects plan.md
/gemini:pre:auto "implement real-time chat system architecture"
```

## Template Selection Logic

### Dynamic Template Discovery
**Templates auto-discovered from**: `~/.claude/prompt-templates/`

Templates are dynamically read from the directory, including their metadata (name, description, keywords) from the YAML frontmatter.

### Template Metadata Parsing

Each template contains YAML frontmatter with:
```yaml
---
name: template-name
description: Template purpose description
category: template-category
keywords: [keyword1, keyword2, keyword3]
---
```

**Auto-selection based on:**
- **Template keywords**: Matches user input against template-defined keywords
- **Template name**: Direct name matching (e.g., "bug-fix" matches bug-related queries)  
- **Template description**: Semantic matching against description text

## Command Execution

### Step 1: Template Discovery
```bash
# Dynamically discover all templates and extract YAML frontmatter
cd ~/.claude/prompt-templates && echo "Discovering templates..." && for template_file in *.md; do echo "=== $template_file ==="; head -6 "$template_file" 2>/dev/null || echo "Error reading $template_file"; echo; done
```

### Step 2: Dynamic Template Analysis & Selection
```pseudo
FUNCTION select_template(user_input):
  templates = list_directory("~/.claude/prompt-templates/")
  template_metadata = {}
  
  # Parse all templates for metadata
  FOR each template_file in templates:
    content = read_file(template_file)
    yaml_front = extract_yaml_frontmatter(content)
    template_metadata[template_file] = {
      "name": yaml_front.name,
      "description": yaml_front.description, 
      "keywords": yaml_front.keywords || [],
      "category": yaml_front.category || "general"
    }
  
  input_lower = user_input.toLowerCase()
  best_match = null
  highest_score = 0
  
  # Score each template against user input
  FOR each template, metadata in template_metadata:
    score = 0
    
    # Keyword matching (highest weight)
    FOR each keyword in metadata.keywords:
      IF input_lower.contains(keyword.toLowerCase()):
        score += 3
    
    # Template name matching
    IF input_lower.contains(metadata.name.toLowerCase()):
      score += 2
    
    # Description semantic matching  
    FOR each word in metadata.description.split():
      IF input_lower.contains(word.toLowerCase()) AND word.length > 3:
        score += 1
    
    IF score > highest_score:
      highest_score = score
      best_match = template
  
  # Default to first template if no matches
  RETURN best_match || templates[0]
END FUNCTION
```

### Step 3: Execute with Dynamically Selected Template
```bash
# Dynamic execution with selected template
gemini --all-files -p "$(cat ~/.claude/prompt-templates/[selected_template])

Context: @{CLAUDE.md,**/*CLAUDE.md}

User Input: [user_input]"
```

**Template selection is completely dynamic** - any new templates added to the directory will be automatically discovered and available for selection based on their YAML frontmatter.

## Options

| Option | Purpose |
|--------|---------|
| `--list-templates` | Show available templates and exit |
| `--template <name>` | Force specific template (overrides auto-selection) |
| `--debug` | Show template selection reasoning |
| `--save-session` | Save results to workflow session |

### Manual Template Override
```bash
# Force specific template
/gemini:pre:auto "user authentication" --template bug-fix.md
/gemini:pre:auto "fix login issues" --template plan.md
```

### Dynamic Template Listing
```bash
# List all dynamically discovered templates
/gemini:pre:auto --list-templates
# Output:
# Dynamically discovered templates in ~/.claude/prompt-templates/:
# - bug-fix.md (用于定位bug并提供修改建议) [Keywords: 规划, bug, 修改方案]
# - plan.md (软件架构规划和技术实现计划分析模板) [Keywords: 规划, 架构, 实现计划, 技术设计, 修改方案]
# - [any-new-template].md (Auto-discovered description) [Keywords: auto-parsed]
```

**Complete template discovery** - new templates are automatically detected and their metadata parsed from YAML frontmatter.

## Auto-Selection Examples

### Dynamic Selection Examples
```bash
# Selection based on template keywords and metadata
"login system crashes on startup" → Matches template with keywords: [bug, 修改方案]
"design user dashboard with analytics" → Matches template with keywords: [规划, 架构, 技术设计]  
"database timeout errors in production" → Matches template with keywords: [bug, 修改方案]
"implement real-time notification system" → Matches template with keywords: [规划, 实现计划, 技术设计]

# Any new templates added will be automatically matched
"[user input]" → Dynamically matches against all template keywords and descriptions
```


## Session Integration

When `--save-session` used, saves to:
`.workflow/WFS-[topic]/.chat/auto-[template]-[timestamp].md`

**Session includes:**
- Original user input
- Template selection reasoning
- Template used
- Complete analysis results

This command streamlines template usage by automatically detecting user intent and selecting the optimal template for analysis.