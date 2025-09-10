---
name: auto
description: Full autonomous development mode with intelligent template selection and execution
usage: /codex:mode:auto "description of development task"
argument-hint: "description of what you want to develop or implement"
examples:
  - /codex:mode:auto "create user authentication system with JWT"
  - /codex:mode:auto "build real-time chat application with React"
  - /codex:mode:auto "implement payment processing with Stripe integration"
  - /codex:mode:auto "develop REST API with user management features"
allowed-tools: Bash(ls:*), Bash(codex:*)
model: sonnet
---

# Full Auto Development Mode (/codex:mode:auto)

## Overview
Leverages Codex's `--full-auto` mode for autonomous development with intelligent template selection and comprehensive context gathering.

**Process**: Analyze Input → Select Templates → Gather Context → Execute Autonomous Development

⚠️ **Critical Feature**: Uses `codex --full-auto` for maximum autonomous capability with mandatory `@` pattern requirements.

## Usage

### Autonomous Development Examples
```bash
# Complete application development
/codex:mode:auto "create todo application with React and TypeScript"

# Feature implementation
/codex:mode:auto "implement user authentication with JWT and refresh tokens"

# System integration
/codex:mode:auto "add payment processing with Stripe to existing e-commerce system"

# Architecture implementation
/codex:mode:auto "build microservices API with user management and notification system"
```

## Template Selection Logic

### Dynamic Template Discovery
**Templates auto-discovered from**: `~/.claude/workflows/cli-templates/prompts/`

Templates are dynamically read from development-focused directories:
- `development/` - Feature implementation, component creation, refactoring
- `automation/` - Project scaffolding, migration, deployment
- `analysis/` - Architecture analysis, pattern detection
- `integration/` - API design, database operations

### Template Metadata Parsing

Each template contains YAML frontmatter with:
```yaml
---
name: template-name
description: Template purpose description
category: development|automation|analysis|integration
keywords: [keyword1, keyword2, keyword3]
development_type: feature|component|refactor|debug|testing
---
```

**Auto-selection based on:**
- **Development keywords**: Matches user input against development-specific keywords
- **Template type**: Direct matching for development types
- **Architecture patterns**: Semantic matching for system design
- **Technology stack**: Framework and library detection

## Command Execution

### Step 1: Template Discovery
```bash
# Dynamically discover development templates
cd ~/.claude/workflows/cli-templates/prompts && echo "Discovering development templates..." && for dir in development automation analysis integration; do if [ -d "$dir" ]; then echo "=== $dir templates ==="; for template_file in "$dir"/*.txt; do if [ -f "$template_file" ]; then echo "Template: $(basename "$template_file")"; head -10 "$template_file" 2>/dev/null | grep -E "^(name|description|keywords):" || echo "No metadata"; echo; fi; done; fi; done
```

### Step 2: Dynamic Template Analysis & Selection
```pseudo
FUNCTION select_development_template(user_input):
  template_dirs = ["development", "automation", "analysis", "integration"]
  template_metadata = {}
  
  # Parse all development templates for metadata
  FOR each dir in template_dirs:
    templates = list_files("~/.claude/workflows/cli-templates/prompts/" + dir + "/*.txt")
    FOR each template_file in templates:
      content = read_file(template_file)
      yaml_front = extract_yaml_frontmatter(content)
      template_metadata[template_file] = {
        "name": yaml_front.name,
        "description": yaml_front.description,
        "keywords": yaml_front.keywords || [],
        "category": yaml_front.category || dir,
        "development_type": yaml_front.development_type || "general"
      }
  
  input_lower = user_input.toLowerCase()
  best_match = null
  highest_score = 0
  
  # Score each template against user input
  FOR each template, metadata in template_metadata:
    score = 0
    
    # Development keyword matching (highest weight)
    development_keywords = ["implement", "create", "build", "develop", "add", "generate"]
    FOR each dev_keyword in development_keywords:
      IF input_lower.contains(dev_keyword):
        score += 5
    
    # Template-specific keyword matching
    FOR each keyword in metadata.keywords:
      IF input_lower.contains(keyword.toLowerCase()):
        score += 3
    
    # Development type matching
    IF input_lower.contains(metadata.development_type.toLowerCase()):
      score += 4
    
    # Technology stack detection
    tech_keywords = ["react", "vue", "angular", "node", "express", "api", "database", "auth"]
    FOR each tech in tech_keywords:
      IF input_lower.contains(tech):
        score += 2
    
    IF score > highest_score:
      highest_score = score
      best_match = template
  
  # Default to feature.txt for development tasks
  RETURN best_match || "development/feature.txt"
END FUNCTION
```

### Step 3: Execute with Full Auto Mode
```bash
# Autonomous development execution with comprehensive context
codex --full-auto "@{**/*} @{CLAUDE.md,**/*CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/[selected_template])

Development Task: [user_input]

Autonomous Implementation Requirements:
- Complete feature development
- Code generation with best practices
- Automatic testing integration
- Documentation updates
- Error handling and validation"
```

## Essential Codex Auto Patterns

**Required File Patterns** (Comprehensive context for autonomous development):
```bash
@{**/*}                    # All files for full context understanding
@{src/**/*}               # Source code for pattern detection
@{package.json,*.config.*} # Configuration and dependencies
@{CLAUDE.md,**/*CLAUDE.md} # Project guidelines and standards
@{test/**/*,**/*.test.*}   # Existing tests for pattern matching
@{docs/**/*,README.*}      # Documentation for context
```

## Development Template Categories

### Feature Development Templates
- **feature.txt**: Complete feature implementation with integration
- **component.txt**: Reusable component creation with props and state
- **refactor.txt**: Code improvement and optimization

### Automation Templates  
- **scaffold.txt**: Project structure and boilerplate generation
- **migration.txt**: System upgrades and data migrations
- **deployment.txt**: CI/CD and deployment automation

### Analysis Templates (for context)
- **architecture.txt**: System structure understanding
- **pattern.txt**: Code pattern detection for consistency
- **security.txt**: Security analysis for safe development

### Integration Templates
- **api-design.txt**: RESTful API development
- **database.txt**: Database schema and operations

## Options

| Option | Purpose |
|--------|---------|
| `--list-templates` | Show available development templates and exit |
| `--template <name>` | Force specific template (overrides auto-selection) |
| `--debug` | Show template selection reasoning and context patterns |
| `--save-session` | Save complete development session to workflow |
| `--no-auto` | Use `codex exec` instead of `--full-auto` mode |

### Manual Template Override
```bash
# Force specific development template
/codex:mode:auto "user authentication" --template component.txt
/codex:mode:auto "fix login issues" --template debugging.txt
```

### Development Template Listing
```bash
# List all available development templates
/codex:mode:auto --list-templates
# Output:
# Development templates in ~/.claude/workflows/cli-templates/prompts/:
# - development/feature.txt (Complete feature implementation) [Keywords: implement, feature, integration]
# - development/component.txt (Reusable component creation) [Keywords: component, react, vue]
# - automation/scaffold.txt (Project structure generation) [Keywords: scaffold, setup, boilerplate]
# - [any-new-template].txt (Auto-discovered from any category)
```

## Auto-Selection Examples

### Development Task Detection
```bash
# Feature development → development/feature.txt
"implement user dashboard with analytics charts" 

# Component creation → development/component.txt
"create reusable button component with multiple variants"

# System architecture → automation/scaffold.txt
"build complete e-commerce platform with React and Node.js"

# API development → integration/api-design.txt
"develop REST API for user management with authentication"

# Performance optimization → development/refactor.txt
"optimize React application performance and bundle size"
```

## Autonomous Development Workflow

### Full Context Gathering
1. **Project Analysis**: `@{**/*}` provides complete codebase context
2. **Pattern Detection**: Understands existing code patterns and conventions
3. **Dependency Analysis**: Reviews package.json and configuration files
4. **Test Pattern Recognition**: Follows existing test structures

### Intelligent Implementation
1. **Architecture Decisions**: Makes informed choices based on existing patterns
2. **Code Generation**: Creates code matching project style and conventions
3. **Integration**: Ensures new code integrates seamlessly with existing system
4. **Quality Assurance**: Includes error handling, validation, and testing

### Autonomous Features
- **Smart File Creation**: Creates necessary files and directories
- **Dependency Management**: Adds required packages automatically
- **Test Generation**: Creates comprehensive test suites
- **Documentation Updates**: Updates relevant documentation files
- **Configuration Updates**: Modifies config files as needed

## Session Integration

When `--save-session` used, saves to:
`.workflow/WFS-[topic]/.chat/auto-[template]-[timestamp].md`

**Session includes:**
- Original development request
- Template selection reasoning
- Complete context patterns used
- Autonomous development results
- Files created/modified
- Integration guidance

## Performance Features

- **Parallel Context Loading**: Loads multiple file patterns simultaneously  
- **Smart Caching**: Caches template selections for similar requests
- **Progressive Development**: Builds features incrementally with validation
- **Rollback Capability**: Can revert changes if issues detected

## Codex vs Gemini Auto Mode

| Feature | Codex Auto | Gemini Auto |
|---------|------------|-------------|
| Primary Purpose | Autonomous development | Analysis and planning |
| File Loading | `@{**/*}` required | `--all-files` available |
| Output | Complete implementations | Analysis and recommendations |
| Template Focus | Development-oriented | Analysis-oriented |
| Execution Mode | `--full-auto` autonomous | Interactive guidance |

This command maximizes Codex's autonomous development capabilities while ensuring comprehensive context and intelligent template selection for optimal results.