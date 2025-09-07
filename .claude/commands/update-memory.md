---
name: update-memory
description: Distributed Memory System management with intelligent classification
usage: /update-memory [mode] [target]
argument-hint: [full|fast|deep] [path or scope]
examples:
  - /update-memory                    # Fast mode on current directory
  - /update-memory full               # Complete initialization
  - /update-memory fast src/api/      # Quick update on specific path
  - /update-memory deep auth-system   # Deep analysis on scope
---

### 🚀 **Command Overview: `/update-memory`**

-   **Type**: Distributed Memory System (DMS) Management.
-   **Purpose**: Manages a hierarchical `CLAUDE.md` documentation system using intelligent project classification and agent-based task integration.
-   **Features**: Supports multiple operation modes, automatic complexity detection, and parallel execution for high performance.

### ⚙️ **Processing Modes**

-   **`fast` (Default)**
    -   **Purpose**: Targeted content updates based on current context or a specific path.
    -   **Scope**: Single module or file, no cross-module analysis.
-   **`deep`**
    -   **Purpose**: Analyze relational impacts and update all associated files across modules.
    -   **Scope**: A specific feature or scope that touches multiple modules (e.g., `auth-system`).
-   **`full`**
    -   **Purpose**: Complete, project-wide documentation reconstruction and overhaul.
    -   **Scope**: The entire project, executed via modular, bottom-up task orchestration.

### 🤔 **When to Use Each Mode**

-   **⚡ Fast Mode**: Use for daily development, quick updates, and single-module changes or bug fixes.
-   **🔬 Deep Mode**: Use for multi-module features, integration work, or complex refactoring with cross-module impacts.
-   **🚀 Full Mode**: Use for new project setup, major architectural changes, or a comprehensive documentation overhaul.

### 🔄 **Mode-Specific Workflows**

-   **⚡ Fast Mode Flow**
    `Execute 3-step scan` -> `Identify target scope` -> `Invoke single agent` -> `Update specific CLAUDE.md` -> `Validate & cleanup`

-   **🔬 Deep Mode Flow**
    `Project structure scan` -> `Impact analysis` -> `Multi-module detection` -> `Decide on parallel execution` -> `Orchestrate agent(s)` -> `Synchronize updates` -> `Cross-module validation`

-   **🚀 Full Mode Flow**
    `Project analysis` -> `Module discovery` -> `Task decomposition & dependency sorting` -> `Create parallel batches` -> `Execute Batch 1 (Base modules)` -> `...` -> `Execute Batch N (Top-level)` -> `Invoke global summary agent` -> `Generate root CLAUDE.md`

### 🧠 **Parallel Execution Logic**

This describes the command's internal logic for selecting an execution strategy. It is handled automatically by `/update-memory`.

```pseudo
FUNCTION select_execution_strategy(project_structure):
  file_count = analyze_file_count(project_structure)
  module_count = analyze_module_count(project_structure)

  // Based on the 'Parallel Execution Decision Matrix'
  IF file_count < 20:
    RETURN "single_agent_fast_mode"
  ELSE IF file_count >= 20 AND file_count <= 100:
    RETURN "directory_based_parallel" // Use 2-3 agents
  ELSE IF file_count > 100 AND file_count <= 500:
    RETURN "hybrid_parallel" // Use 3-5 agents
  ELSE IF file_count > 500:
    RETURN "dependency_aware_batching" // Use 5+ agents
  END IF
END FUNCTION

FUNCTION orchestrate_full_mode(project_structure):
  // 1. Decompose project into modules and dependencies
  tasks = create_task_list(project_structure) // Corresponds to JSON Task Instructions

  // 2. Group tasks into batches for parallel execution
  batches = create_dependency_batches(tasks)

  // 3. Execute batches sequentially, with parallel agents within each batch
  FOR each batch in batches:
    // This action corresponds to the orchestration script example.
    // e.g., Task(memory-gemini-bridge, "task for module A") &
    execute_batch_in_parallel(batch) 
    wait_for_batch_completion() // Barrier synchronization

  // 4. Final summary step
  // e.g., Task(memory-gemini-bridge, "global_summary task")
  execute_global_summary_task()
END FUNCTION
```

### 📂 **Distributed Memory System (DMS) Structure**

The command assumes and manages a hierarchical `CLAUDE.md` file structure.

```
project/
├── CLAUDE.md                   # Project overview and architecture
├── src/                  
│   ├── CLAUDE.md              # Core implementation guidelines
│   ├── components/
│   │   └── CLAUDE.md          # Component-specific patterns
│   └── api/
│       └── CLAUDE.md          # API implementation details
├── tests/
│   └── CLAUDE.md              # Testing guidelines (if needed)
└── docs/
    └── CLAUDE.md              # Documentation standards (if needed)
```

### 📜 **Documentation Hierarchy Rules**

-   **Root Level (`./CLAUDE.md`):** Focus on project architecture, technology stack, and global standards.
-   **Module Level (`./src/CLAUDE.md`):** Focus on core implementation guidelines, module responsibilities, and patterns.
-   **Sub-Module Level (`./src/api/CLAUDE.md`):** Focus on detailed technical specifications and component-specific patterns.

### 🛠️ **Pre-defined Analysis Commands**

This 3-step script is used for initial project structure analysis.

```bash
# Step 1: Get project directory structure
tree -L 3 -d 2>/dev/null || find . -type d -maxdepth 3

# Step 2: Find existing CLAUDE.md files
find . -name "CLAUDE.md" -o -name "*CLAUDE.md" | sort

# Step 3: Generate context-aware file list (adapts to target scope)
# If target specified: focus on target-related files
# If no target: analyze current context and recent changes
find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.md" \) | head -50
```

### 📝 **Task Instructions Format (Full Mode)**

In `full` mode, the orchestrator generates tasks for agents in this JSON format.

```json
{
  "task_type": "module_update" | "global_summary",
  "target_module": "src/api" | "tests" | "root",
  "analysis_commands": [
    "find ./src/api -type f \\( -name '*.js' -o -name '*.ts' \\) | head -30",
    "find ./src/api -name 'CLAUDE.md'"
  ],
  "dependencies": ["src/utils", "src/core"],
  "priority": 1,
  "context": {
    "module_purpose": "API endpoint implementations",
    "existing_files": ["./src/api/CLAUDE.md"],
    "focus_areas": ["implementation patterns", "error handling", "integration points"]
  }
}
```

### 🤖 **Agent Integration Examples**

The `/update-memory` command orchestrates `memory-gemini-bridge` agents using tasks formatted like this.

#### **Single Agent (Fast/Deep Mode)**
```yaml
Task:
  description: "Module analysis with Gemini CLI"
  subagent_type: "memory-gemini-bridge"
  prompt: |
    Task Type: module_update
    Target Module: src/api/auth
  
    Analysis Commands:
    1. find ./src/api/auth -type f \( -name "*.js" -o -name "*.ts" \) | head -30
    2. cd src/api/auth && gemini --all-files -p "analyze authentication patterns"
    3. Generate module-level CLAUDE.md for auth subsystem
  
    Context:
    - Module Purpose: Authentication service implementation
    - Focus Areas: ["security patterns", "JWT handling", "middleware integration"]
    - Dependencies: ["src/utils", "src/core"]
  
    Success Criteria: Generate complete module CLAUDE.md with security patterns
```

#### **Multiple Parallel Agents (Full Mode)**
```yaml
# Agent 1: API Module
Task:
  description: "API Module Analysis"
  subagent_type: "memory-gemini-bridge"
  prompt: |
    Task Type: module_update
    Target Module: src/api
    Parallel Config: { batch_id: 1, partition_id: 1, max_concurrent: 3 }
    Generate: ./src/api/CLAUDE.md
    Sync Point: batch_complete

# Agent 2: Components Module (Parallel)
Task:
  description: "Components Module Analysis"
  subagent_type: "memory-gemini-bridge"
  prompt: |
    Task Type: module_update
    Target Module: src/components
    Parallel Config: { batch_id: 1, partition_id: 2, max_concurrent: 3 }
    Generate: ./src/components/CLAUDE.md
    Sync Point: batch_complete
```

#### **Global Summary Agent (Full Mode - Final Step)**
```yaml
Task:
  description: "Project Global Summary"
  subagent_type: "memory-gemini-bridge" 
  prompt: |
    Task Type: global_summary
    Wait For: All module updates complete (batch_complete barrier)
  
    Analysis Commands:
    1. find . -name "CLAUDE.md" | grep -E "(src|lib)/" | sort
    2. Read all module CLAUDE.md files
    3. gemini -p "@./src/*/CLAUDE.md synthesize project architecture"
  
    Generate: Root ./CLAUDE.md
```

### 🌐 **Advanced Parallel Execution Strategies**

The command auto-selects the optimal strategy. Below are the patterns it uses.

#### **Strategy 1: Directory-Based Partitioning**
-   **Best For**: Well-organized projects with clear module boundaries.
-   **Example Command**: `Agent-1: cd src/components && gemini --all-files -p "analyze React components"`

#### **Strategy 2: File Reference Partitioning**
-   **Best For**: Feature-based or cross-cutting concerns (e.g., authentication).
-   **Example Command**: `Agent-1: gemini -p "@src/**/*auth* analyze authentication patterns"`

#### **Strategy 3: Hybrid Approach**
-   **Best For**: Complex projects with mixed organization patterns.
-   **Example Command**: Mixes directory-based (`cd src/components`) and pattern-based (`@src/**/*{auth,security}*`) analysis.

#### **Strategy 4: Dependency-Aware Batching**
-   **Best For**: Large enterprise projects with complex interdependencies.
-   **Example Flow**:
    1.  **Batch 1**: Analyze foundation modules (e.g., `types`, `utils`). `wait`
    2.  **Batch 2**: Analyze service modules that depend on Batch 1 (e.g., `api`, `database`). `wait`
    3.  **Batch 3**: Analyze application modules that depend on Batch 2 (e.g., `components`).

| Strategy | Best For | Scaling | Complexity | Performance |
|---|---|---|---|---|
| Directory-Based | Modular projects | Excellent | Low | High |
| File Pattern | Feature-focused | Good | Medium | Medium |
| Hybrid | Mixed structures | Very Good | High | High |
| Dependency-Aware | Large enterprise | Excellent | Very High | Maximum |

### 🧹 **Automatic Content Management**

-   **Cleanup**: Removes duplicate content, outdated references, and deprecated patterns across the hierarchy.
-   **Validation**: Ensures content is relevant to the current state of the project.
-   **Focus**:
    -   **Fast Mode**: Quick relevance validation and dead reference removal.
    -   **Deep Mode**: Comprehensive redundancy elimination across affected modules.
    -   **Full Mode**: Complete project-wide cleanup and hierarchy optimization.

### ⏱️ **Performance & Time Investment**

-   **⚡ Fast Mode**: Minutes (Ideal for daily use).
-   **🔬 Deep Mode**: ~10-30 minutes with parallel execution.
-   **🚀 Full Mode**: ~30-45 minutes with parallel execution.
-   **Benefit**: Parallel execution provides a massive speedup, offsetting a small coordination overhead.
