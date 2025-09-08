---
name: update-memory
description: Intelligent CLAUDE.md documentation system with context-aware updates
usage: /update-memory [mode]
argument-hint: [related|full]
examples:
  - /update-memory                    # Default: related mode (context-based)
  - /update-memory related            # Update only context-related modules
  - /update-memory full               # Full project documentation update
---

### 🚀 Command Overview: `/update-memory`

-   **Type**: Hierarchical Documentation Management System
-   **Purpose**: To maintain `CLAUDE.md` documentation using intelligent context detection and automatic task partitioning.
-   **Key Features**: Context-aware updates, strict hierarchy preservation, automatic scaling of execution strategy, and direct file modification via `Gemini --yolo`.

### ⚙️ Processing Modes

-   **related (Default)**
    -   **Scope**: Updates only context-related modules based on recent changes (git diff, recent edits).
    -   **Action**: Updates affected module `CLAUDE.md` files, their parent hierarchy, and the root `CLAUDE.md`.
    -   **Use Case**: Ideal for daily development, feature updates, and bug fixes.
-   **full**
    -   **Scope**: Executes a complete, project-wide documentation update.
    -   **Action**: Analyzes the entire project and updates all `CLAUDE.md` files at every hierarchy level.
    -   **Use Case**: Best for major refactoring, project initialization, or periodic maintenance.

### 🧠 Core Execution Logic: Automatic Strategy Selection

The command automatically selects an execution strategy based on project complexity. This logic applies to both `related` and `full` modes.

```pseudo
FUNCTION select_execution_strategy(mode):
  // Step 1: Analyze project scale
  file_count = count_source_code_files()

  // Step 2: Determine execution strategy based on file count
  IF file_count < 50:
    // This action corresponds to the "Small Project" templates.
    EXECUTE_STRATEGY("Single Gemini Execution")
  ELSE IF file_count < 200:
    // This action corresponds to the "Medium Project" templates.
    EXECUTE_STRATEGY("Parallel Shell Execution")
  ELSE:
    // This action corresponds to the "Large Project" template.
    EXECUTE_STRATEGY("Multi-Agent Coordination")
END FUNCTION
```

### 🔍 Context Detection Logic (`related` Mode)

This describes how the command identifies which files need updating in `related` mode.

```pseudo
FUNCTION detect_affected_modules():
  // Priority 1: Check for staged or recent git changes.
  changed_files = get_git_diff_or_status()

  // Priority 2: If no git changes, find recently edited files as a fallback.
  IF changed_files is empty:
    changed_files = find_recently_modified_source_files(limit=10)
  
  // Convert file paths into a unique list of parent directories.
  affected_modules = extract_unique_directories_from(changed_files)

  RETURN affected_modules
END FUNCTION
```

### 📝 Template: Small Project (`related` Mode Update)

This template is executed when the project is small and the mode is `related`.

```bash
# Single comprehensive analysis
gemini --all-files --yolo -p "@{changed_files} @{affected_module/CLAUDE.md} @{CLAUDE.md}
Analyze recent changes and update only affected CLAUDE.md files:

1. Module-level update:
   - Focus on changed patterns and implementations
   - Follow Layer 3/4 hierarchy rules
   - Avoid duplicating parent content

2. Root-level update:
   - Reflect only significant architectural changes
   - Maintain high-level project perspective
   - Reference but don't duplicate module details
 
Only update files that are actually affected by the changes."
```

### 📝 Template: Medium/Large Project (`related` Mode Update)

This template is executed for medium or large projects in `related` mode.

```bash
# Step-by-step layered update

# Update affected modules first
for module in $affected_modules; do
    echo "Updating module: $module"
    gemini --all-files --yolo -p "@{$module/**/*} @{$module/CLAUDE.md}
    Update $module/CLAUDE.md based on recent changes:
    - Analyze what specifically changed in this module
    - Update implementation patterns that were modified
    - Follow Layer 3 hierarchy rules (module-specific focus)
    - Do not include project overview or domain-wide patterns
    - Only document what changed or was impacted"
done

# Update parent domain if structure changed
parent_domains=$(echo "$affected_modules" | xargs dirname | sort -u)
for domain in $parent_domains; do
    if [ -f "$domain/CLAUDE.md" ]; then
        echo "Checking domain impact: $domain"
        gemini --all-files --yolo -p "@{$domain/*/CLAUDE.md} @{$domain/CLAUDE.md}
        Review if domain-level documentation needs updates:
        - Check if module organization changed
        - Update integration patterns if affected
        - Follow Layer 2 hierarchy rules (domain focus)
        - Only update if there are actual structural changes
        - Do not duplicate module details"
    fi
done

# Finally, update root if significant changes
echo "Updating root documentation"
gemini --all-files --yolo -p "@{changed_files} @{*/CLAUDE.md} @{CLAUDE.md}
Review and update root CLAUDE.md only if changes affect:
- Project architecture or technology stack
- Major feature additions
- Development workflow changes

Follow Layer 1 hierarchy rules:
- Maintain high-level project perspective
- Only reference architectural impacts
- Do not duplicate domain or module content"
```

### 📝 Template: Small Project (`full` Mode Update)

This template is executed when the project is small and the mode is `full`.

```bash
# Single comprehensive analysis with hierarchy awareness
gemini --all-files --yolo -p "@{**/*} @{**/*CLAUDE.md}
Perform complete project analysis and update all CLAUDE.md files with strict hierarchy:

1. Root CLAUDE.md (Layer 1):
   - Project overview, architecture, technology stack
   - Development guidelines and workflow
   - Do NOT include implementation details

2. Domain CLAUDE.md (Layer 2):
   - Domain architecture and module organization
   - Inter-module communication patterns
   - Do NOT duplicate project overview or module internals

3. Module CLAUDE.md (Layer 3):
   - Module-specific patterns and internal architecture
   - API contracts and dependencies
   - Do NOT duplicate domain patterns or project overview

4. Sub-module CLAUDE.md (Layer 4):
   - Implementation specifics and configuration
   - Usage examples and performance notes
   - Do NOT duplicate higher-level architecture

Ensure each layer maintains its proper abstraction level without content duplication."
```

### 📝 Template: Medium Project (`full` Mode Update)

This template is executed when the project is medium-sized and the mode is `full`.

```bash
# Dependency-aware parallel execution

echo "🏗️ Layer 1: Foundation modules (parallel)"
(
  gemini --all-files --yolo -p "@{src/utils/**/*} @{src/utils/CLAUDE.md}
  Update utilities documentation (Layer 3 focus):
  - Utility patterns and helper functions
  - Module internal organization
  - Avoid project/domain overview" &

  gemini --all-files --yolo -p "@{src/types/**/*} @{src/types/CLAUDE.md}
  Update types documentation (Layer 3 focus):
  - Type definitions and interface patterns
  - Type architecture within module
  - Avoid project/domain overview" &

  gemini --all-files --yolo -p "@{src/core/**/*} @{src/core/CLAUDE.md}
  Update core documentation (Layer 3 focus):
  - Core module patterns and initialization
  - Internal system architecture
  - Avoid project/domain overview" &
  wait
)

echo "🏭 Layer 2: Business modules (parallel, with foundation context)"
(
  gemini --all-files --yolo -p "@{src/api/**/*} @{src/core/CLAUDE.md,src/types/CLAUDE.md} @{src/api/CLAUDE.md}
  Update API documentation with foundation context (Layer 3 focus):
  - API architecture and endpoint patterns
  - Integration with core and types modules
  - Module-specific implementation details
  - Avoid duplicating foundation or project content" &

  gemini --all-files --yolo -p "@{src/services/**/*} @{src/utils/CLAUDE.md} @{src/services/CLAUDE.md}
  Update services documentation with utils context (Layer 3 focus):
  - Service layer patterns and business logic
  - Integration with utility modules
  - Module internal architecture
  - Avoid duplicating utils or project content" &
  wait
)

echo "🎨 Layer 3: Application modules (parallel, with business context)"
(
  gemini --all-files --yolo -p "@{src/components/**/*} @{src/api/CLAUDE.md} @{src/components/CLAUDE.md}
  Update components documentation with API context (Layer 3 focus):
  - Component architecture and patterns
  - API integration approaches
  - Module-specific UI patterns
  - Avoid duplicating API or project content" &

  gemini --all-files --yolo -p "@{src/pages/**/*} @{src/services/CLAUDE.md} @{src/pages/CLAUDE.md}
  Update pages documentation with services context (Layer 3 focus):
  - Page structure and routing patterns
  - Service utilization approaches
  - Module-specific page architecture
  - Avoid duplicating services or project content" &
  wait
)

echo "📋 Layer 4: Domain integration"
gemini --all-files --yolo -p "@{src/*/CLAUDE.md} @{src/CLAUDE.md}
Update src domain documentation (Layer 2 focus):
- Synthesize module organization and relationships
- Domain-wide architecture patterns
- Inter-module communication strategies
- Do NOT duplicate module implementation details
- Do NOT duplicate project overview content"

echo "🎯 Layer 5: Root integration"
gemini --all-files --yolo -p "@{*/CLAUDE.md} @{CLAUDE.md}
Update root documentation (Layer 1 focus):
- High-level project architecture and overview
- Technology stack summary and decisions
- Development workflow and guidelines
- Do NOT duplicate domain-specific content
- Do NOT include implementation details"
```

### 📝 Template: Large Project (`full` Mode Update)

This YAML-based plan is used for large projects in `full` mode, coordinating multiple agents.

```yaml
# Multi-agent coordination for complex projects
Main Coordinator Agent:
  description: "Coordinate full documentation update"
  subagent_type: "memory-gemini-bridge"
  prompt: |
    Execute large project full documentation update:
  
    1. Analyze project structure:
       gemini --all-files -p "@{**/*} Identify major domains, complexity, and module relationships"
  
    2. Launch parallel domain agents:
       - Each agent handles one domain (frontend, backend, infrastructure)
       - Each agent follows hierarchy rules strictly
       - Each agent avoids content duplication
  
    3. Final integration:
       gemini --all-files --yolo -p "@{*/CLAUDE.md} @{CLAUDE.md}
       Update root with Layer 1 focus only:
       - Project overview and architecture
       - Technology stack decisions
       - Development workflow
       - Do NOT duplicate domain details"

Frontend Domain Agent:
  prompt: |
    Update frontend domain with hierarchy awareness:
  
    1. Module updates (Layer 3):
       gemini --all-files --yolo -p "@{src/components/**/*} @{src/components/CLAUDE.md}
       Component-specific patterns and architecture"
     
       gemini --all-files --yolo -p "@{src/pages/**/*} @{src/pages/CLAUDE.md}
       Page-specific patterns and routing"
  
    2. Domain integration (Layer 2):
       gemini --all-files --yolo -p "@{src/frontend/*/CLAUDE.md} @{src/frontend/CLAUDE.md}
       Frontend domain architecture, module relationships
       Do NOT duplicate component details or project overview"

Backend Domain Agent:
  prompt: |
    Update backend domain with hierarchy awareness:
  
    1. Module updates (Layer 3):
       gemini --all-files --yolo -p "@{src/api/**/*} @{src/api/CLAUDE.md}
       API-specific patterns and endpoints"
     
       gemini --all-files --yolo -p "@{src/services/**/*} @{src/services/CLAUDE.md}
       Service-specific business logic and patterns"
  
    2. Domain integration (Layer 2):
       gemini --all-files --yolo -p "@{src/backend/*/CLAUDE.md} @{src/backend/CLAUDE.md}
       Backend domain architecture, service relationships
       Do NOT duplicate service details or project overview"
```

### 📈 Performance Characteristics

| Mode      | Small Project (<50 files) | Medium Project (50-200 files) | Large Project (>200 files) |
| :-------- | :------------------------ | :---------------------------- | :------------------------- |
| **related** | <1 minute                 | 1-3 minutes                   | 3-5 minutes                |
| **full**    | 1-2 minutes               | 3-5 minutes                   | 10-15 minutes              |

### 📚 Usage Examples

```bash
# Daily development (automatically detects what you've been working on)
/update-memory

# After working in a specific module, explicitly run related mode
cd src/api && /update-memory related

# Weekly full refresh for project-wide consistency
/update-memory full

# Intelligently update based on a large refactoring commit
git add -A && git commit -m "Major refactoring"
/update-memory related
```

### ✨ Key Features

-   **Context Intelligence**: Automatically detects which modules need updating based on recent changes.
-   **Hierarchy Preservation**: Enforces strict content boundaries between documentation layers to prevent duplication.
-   **Smart Partitioning**: Dynamically scales its execution strategy (single, parallel, multi-agent) based on project size.
-   **Zero Configuration**: Works out-of-the-box with intelligent defaults for context detection and execution.

### 📝 Best Practices

-   Use `related` mode for daily development; it's fast and focused.
-   Run `full` mode weekly or after major architectural changes to ensure consistency.
-   Trust the hierarchy; let each `CLAUDE.md` file serve its specific layer of abstraction.
-   Allow the automatic context detection to guide updates rather than manually specifying files.
