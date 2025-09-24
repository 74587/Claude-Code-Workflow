---
name: gemini-init
description: Initialize Gemini CLI configuration with .gemini config and .geminiignore based on workspace analysis
usage: /workflow:gemini-init [--output=<path>] [--preview]
argument-hint: [optional: output path, preview flag]
examples:
  - /workflow:gemini-init
  - /workflow:gemini-init --output=.config/
  - /workflow:gemini-init --preview
---

# Gemini Initialization Command

## Overview
Initializes Gemini CLI configuration for the workspace by:
1. Analyzing current workspace using `get_modules_by_depth.sh` to identify technology stacks
2. Generating `.geminiignore` file with filtering rules optimized for detected technologies
3. Creating `.gemini` configuration file with contextfilename and other settings

## Core Functionality

### Configuration Generation
1. **Workspace Analysis**: Runs `get_modules_by_depth.sh` to analyze project structure
2. **Technology Stack Detection**: Identifies tech stacks based on file extensions, directories, and configuration files
3. **Gemini Config Creation**: Generates `.gemini` file with contextfilename and workspace-specific settings
4. **Ignore Rules Generation**: Creates `.geminiignore` file with filtering patterns for detected technologies

### Generated Files

#### .gemini Configuration File
Contains Gemini CLI contextfilename setting:
```json
{
  "contextfilename": "CLAUDE.md"
}
```

#### .geminiignore Filter File
Uses gitignore syntax to filter files from Gemini CLI analysis

### Supported Technology Stacks

#### Frontend Technologies
- **React/Next.js**: Ignores build artifacts, .next/, node_modules
- **Vue/Nuxt**: Ignores .nuxt/, dist/, .cache/
- **Angular**: Ignores dist/, .angular/, node_modules
- **Webpack/Vite**: Ignores build outputs, cache directories

#### Backend Technologies
- **Node.js**: Ignores node_modules, package-lock.json, npm-debug.log
- **Python**: Ignores __pycache__, .venv, *.pyc, .pytest_cache
- **Java**: Ignores target/, .gradle/, *.class, .mvn/
- **Go**: Ignores vendor/, *.exe, go.sum (when appropriate)
- **C#/.NET**: Ignores bin/, obj/, *.dll, *.pdb

#### Database & Infrastructure
- **Docker**: Ignores .dockerignore, docker-compose.override.yml
- **Kubernetes**: Ignores *.secret.yaml, helm charts temp files
- **Database**: Ignores *.db, *.sqlite, database dumps

### Generated Rules Structure

#### Base Rules (Always Included)
```
# Version Control
.git/
.svn/
.hg/

# OS Files
.DS_Store
Thumbs.db
*.tmp
*.swp

# IDE Files
.vscode/
.idea/
.vs/

# Logs
*.log
logs/
```

#### Technology-Specific Rules
Rules are added based on detected technologies:

**Node.js Projects** (package.json detected):
```
# Node.js
node_modules/
npm-debug.log*
.npm/
.yarn/
package-lock.json
yarn.lock
.pnpm-store/
```

**Python Projects** (requirements.txt, setup.py, pyproject.toml detected):
```
# Python
__pycache__/
*.py[cod]
.venv/
venv/
.pytest_cache/
.coverage
htmlcov/
```

**Java Projects** (pom.xml, build.gradle detected):
```
# Java
target/
.gradle/
*.class
*.jar
*.war
.mvn/
```

## Command Options

### Basic Usage
```bash
/workflow:gemini-init
```
- Analyzes workspace and generates `.gemini` and `.geminiignore` in current directory
- Creates backup of existing files if present
- Sets contextfilename to "CLAUDE.md" by default

### Preview Mode
```bash
/workflow:gemini-init --preview
```
- Shows what would be generated without creating files
- Displays detected technologies, configuration, and ignore rules

### Custom Output Path
```bash
/workflow:gemini-init --output=.config/
```
- Generates files in specified directory
- Creates directories if they don't exist

## Implementation Process

### Phase 1: Workspace Analysis
1. Execute `get_modules_by_depth.sh json` to get structured project data
2. Parse JSON output to identify directories and files
3. Scan for technology indicators:
   - Configuration files (package.json, requirements.txt, etc.)
   - Directory patterns (src/, tests/, etc.)
   - File extensions (.js, .py, .java, etc.)
4. Detect project name from directory name or package.json

### Phase 2: Technology Detection
```bash
# Technology detection logic
detect_nodejs() {
    [ -f "package.json" ] || find . -name "package.json" -not -path "*/node_modules/*" | head -1
}

detect_python() {
    [ -f "requirements.txt" ] || [ -f "setup.py" ] || [ -f "pyproject.toml" ] || \
    find . -name "*.py" -not -path "*/__pycache__/*" | head -1
}

detect_java() {
    [ -f "pom.xml" ] || [ -f "build.gradle" ] || \
    find . -name "*.java" | head -1
}
```

### Phase 3: Configuration Generation
1. **Gemini Config (.gemini)**:
   - Generate simple JSON config with contextfilename setting
   - Set contextfilename to "CLAUDE.md" by default

### Phase 4: Ignore Rules Generation
1. Start with base rules (always included)
2. Add technology-specific rules based on detection
3. Add workspace-specific patterns if found
4. Sort and deduplicate rules

### Phase 5: File Creation
1. **Generate .gemini config**: Write JSON configuration file
2. **Generate .geminiignore**: Create organized ignore file with sections
3. **Create backups**: Backup existing files if present
4. **Validate**: Check generated files are valid

## Generated File Format

```
# .geminiignore
# Generated by Claude Code workflow:gemini-ignore command
# Creation date: 2024-01-15 10:30:00
# Detected technologies: Node.js, Python, Docker
#
# This file uses gitignore syntax to filter files for Gemini CLI analysis
# Edit this file to customize filtering rules for your project

# ============================================================================
# Base Rules (Always Applied)
# ============================================================================

# Version Control
.git/
.svn/
.hg/

# ============================================================================
# Node.js (Detected: package.json found)
# ============================================================================

node_modules/
npm-debug.log*
.npm/
yarn-error.log
package-lock.json

# ============================================================================
# Python (Detected: requirements.txt, *.py files found)
# ============================================================================

__pycache__/
*.py[cod]
.venv/
.pytest_cache/
.coverage

# ============================================================================
# Docker (Detected: Dockerfile found)
# ============================================================================

.dockerignore
docker-compose.override.yml

# ============================================================================
# Custom Rules (Add your project-specific rules below)
# ============================================================================

```

## Error Handling

### Missing Dependencies
- If `get_modules_by_depth.sh` not found, show error with path to script
- Gracefully handle cases where script fails

### Write Permissions
- Check write permissions before attempting file creation
- Show clear error message if cannot write to target location

### Backup Existing Files
- If `.geminiignore` exists, create backup as `.geminiignore.backup`
- Include timestamp in backup filename

## Integration Points

### Workflow Commands
- **After `/workflow:plan`**: Suggest running gemini-ignore for better analysis
- **Before analysis**: Recommend updating ignore patterns for cleaner results

### CLI Tool Integration
- Automatically update when new technologies detected
- Integrate with `intelligent-tools-strategy.md` recommendations

## Usage Examples

### Basic Project Setup
```bash
# New project - initialize Gemini configuration
/workflow:gemini-init

# Preview what would be generated
/workflow:gemini-init --preview

# Generate in subdirectory
/workflow:gemini-init --output=.config/
```

### Technology Migration
```bash
# After adding new tech stack (e.g., Docker)
/workflow:gemini-init  # Regenerates both config and ignore files with new rules

# Check what changed
/workflow:gemini-init --preview  # Compare with existing configuration
```

## Key Benefits

- **Automatic Detection**: No manual configuration needed
- **Technology Aware**: Rules adapted to actual project stack
- **Maintainable**: Clear sections for easy customization
- **Consistent**: Follows gitignore syntax standards
- **Safe**: Creates backups of existing files