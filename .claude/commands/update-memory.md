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

### 🚀 **Command Overview: `/update-memory`**

-   **Type**: Hierarchical Documentation Management System
-   **Purpose**: Maintain CLAUDE.md documentation with intelligent context detection and automatic task partitioning
-   **Features**: Context-aware updates, hierarchical content management, automatic complexity detection, Gemini CLI with --yolo

### ⚙️ **Processing Modes**

#### **📍 Related Mode (Default)**
-   **Scope**: Updates only context-related modules based on recent changes
-   **Detection**: Analyzes git diff, recent edits, and current working context
-   **Updates**: Affected module CLAUDE.md files + parent hierarchy + root CLAUDE.md
-   **Use Case**: Daily development, feature updates, bug fixes

#### **🌐 Full Mode**
-   **Scope**: Complete project-wide documentation update
-   **Detection**: Analyzes entire project structure
-   **Updates**: All CLAUDE.md files at every hierarchy level
-   **Use Case**: Major refactoring, project initialization, periodic maintenance

### 📂 **CLAUDE.md Hierarchy Rules - Avoiding Content Duplication**

#### **Layer 1: Root Level (`./CLAUDE.md`)**
```yaml
Content Focus:
  - Project overview and purpose (high-level only)
  - Technology stack summary
  - Architecture decisions and principles
  - Development workflow overview
  - Quick start guide
  
Strictly Avoid:
  - Implementation details
  - Module-specific patterns
  - Code examples from specific modules
  - Domain internal architecture
```

#### **Layer 2: Domain Level (`./src/CLAUDE.md`, `./tests/CLAUDE.md`)**
```yaml
Content Focus:
  - Domain architecture and responsibilities
  - Module organization within domain
  - Inter-module communication patterns
  - Domain-specific conventions
  - Integration points with other domains
  
Strictly Avoid:
  - Duplicating root project overview
  - Component/function-level details
  - Specific implementation code
  - Module internal patterns
```

#### **Layer 3: Module Level (`./src/api/CLAUDE.md`, `./src/components/CLAUDE.md`)**
```yaml
Content Focus:
  - Module-specific implementation patterns
  - Internal architecture and design decisions
  - API contracts and interfaces
  - Module dependencies and relationships
  - Testing strategies for this module
  
Strictly Avoid:
  - Project overview content
  - Domain-wide architectural patterns
  - Detailed function documentation
  - Configuration specifics
```

#### **Layer 4: Sub-Module Level (`./src/api/auth/CLAUDE.md`)**
```yaml
Content Focus:
  - Detailed implementation specifics
  - Component/function documentation
  - Configuration details and examples
  - Usage examples and patterns
  - Performance considerations
  
Strictly Avoid:
  - Architecture decisions (belong in higher levels)
  - Module-level organizational patterns
  - Domain or project overview content
```

### 📊 **Automatic Complexity Detection & Task Partitioning**

Both modes automatically execute this logic:

```bash
# Internal complexity detection (executed by command)
detect_and_partition() {
    local mode=$1
    
    # Step 1: Analyze project scale
    local file_count=$(find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.java" -o -name "*.go" \) | wc -l)
    local module_count=$(find . -type d -name src -o -name lib -o -name app | wc -l)
    
    # Step 2: Determine execution strategy
    if [ $file_count -lt 50 ]; then
        echo "Small project: Single Gemini execution"
        execute_single_gemini $mode
    elif [ $file_count -lt 200 ]; then
        echo "Medium project: Parallel shell execution"
        execute_parallel_shell $mode
    else
        echo "Large project: Multi-agent coordination"
        execute_multi_agent $mode
    fi
}
```

### 🔄 **Related Mode: Context-Aware Updates**

#### **Step 1: Context Detection**
```bash
# Automatic context analysis
detect_changes() {
    # Priority 1: Git diff analysis
    changed_files=$(git diff --name-only HEAD~1 2>/dev/null || git status --porcelain | awk '{print $2}')
    
    # Priority 2: Current working directory
    if [ -z "$changed_files" ]; then
        changed_files=$(find . -maxdepth 3 -name "*.js" -o -name "*.ts" -o -name "*.py" | head -10)
    fi
    
    # Extract affected modules
    affected_modules=$(echo "$changed_files" | xargs dirname | sort -u)
    echo "Detected changes in: $affected_modules"
}
```

#### **Step 2: Layered Updates (Automatic Execution)**

##### **Small Project Related Update**
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

##### **Medium/Large Project Related Update**
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

### 🌐 **Full Mode: Complete Project Update**

#### **Small Project Full Update**
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

#### **Medium Project Full Update**
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

#### **Large Project Full Update**
```yaml
# Multi-agent coordination for complex projects
Main Coordinator Agent:
  description: "Coordinate full documentation update"
  subagent_type: "memory-gemini-bridge"
  prompt: |
    Execute large project full documentation update:
    
    1. Analyze project structure:
       gemini -p "@{**/*} Identify major domains, complexity, and module relationships"
    
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
       gemini -yolo -p "@{src/components/**/*} @{src/components/CLAUDE.md}
       Component-specific patterns and architecture"
       
       gemini -yolo -p "@{src/pages/**/*} @{src/pages/CLAUDE.md}
       Page-specific patterns and routing"
    
    2. Domain integration (Layer 2):
       gemini -yolo -p "@{src/frontend/*/CLAUDE.md} @{src/frontend/CLAUDE.md}
       Frontend domain architecture, module relationships
       Do NOT duplicate component details or project overview"

Backend Domain Agent:
  prompt: |
    Update backend domain with hierarchy awareness:
    
    1. Module updates (Layer 3):
       gemini -yolo -p "@{src/api/**/*} @{src/api/CLAUDE.md}
       API-specific patterns and endpoints"
       
       gemini -yolo -p "@{src/services/**/*} @{src/services/CLAUDE.md}
       Service-specific business logic and patterns"
    
    2. Domain integration (Layer 2):
       gemini -yolo -p "@{src/backend/*/CLAUDE.md} @{src/backend/CLAUDE.md}
       Backend domain architecture, service relationships
       Do NOT duplicate service details or project overview"
```

### 📈 **Performance Characteristics**

| Mode | Small Project (<10 files) | Medium Project (10-100 files) | Large Project (>100 files) |
|------|----------------------------|--------------------------------|----------------------------|
| **Related** | <1 minute | 1-3 minutes | 3-5 minutes |
| **Full** | 1-2 minutes | 3-5 minutes | 10-15 minutes |

### 🚀 **Usage Examples**

```bash
# Daily development (automatically detects what you've been working on)
/update-memory
# Updates only affected modules + parent hierarchy + root

# After working in specific module
cd src/api && /update-memory related
# Updates API module documentation and propagates changes up

# Weekly full refresh
/update-memory full
# Complete hierarchy update with automatic complexity detection

# After major refactoring
git add -A && git commit -m "Major refactoring"
/update-memory related
# Intelligently updates all affected areas based on git changes
```

### ✨ **Key Features**

1. **Context Intelligence**: Automatically detects what needs updating based on changes
2. **Hierarchy Preservation**: Strict content boundaries prevent duplication
3. **Smart Partitioning**: Automatically scales strategy based on project complexity
4. **Gemini -yolo**: Direct file modification for maximum efficiency
5. **Zero Configuration**: Works out of the box with intelligent defaults

### 📝 **Best Practices**

- **Use related mode** for daily development - fast and focused
- **Run full mode** weekly or after major changes for consistency
- **Trust the hierarchy** - each layer has its specific purpose
- **Let context detection work** - the command knows what changed
- **Review root CLAUDE.md** periodically as your project's overview