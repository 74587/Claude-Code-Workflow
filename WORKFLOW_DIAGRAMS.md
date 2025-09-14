# Claude Code Workflow (CCW) - Enhanced Workflow Diagrams

Based on comprehensive analysis of changes since v1.0, this document provides detailed mermaid diagrams illustrating the CCW architecture and execution flows.

## 1. System Architecture Overview

```mermaid
graph TB
    subgraph "CLI Interface Layer"
        CLI[CLI Commands]
        GEM[Gemini CLI]
        COD[Codex CLI]
        WRAPPER[Gemini Wrapper]
    end

    subgraph "Session Management"
        MARKER[".active-session marker"]
        SESSION["workflow-session.json"]
        WDIR[".workflow/ directories"]
    end

    subgraph "Task System"
        TASK_JSON[".task/impl-*.json"]
        HIERARCHY["Task Hierarchy (max 2 levels)"]
        STATUS["Task Status Management"]
    end

    subgraph "Agent Orchestration"
        PLAN_AGENT[Conceptual Planning Agent]
        ACTION_AGENT[Action Planning Agent]
        CODE_AGENT[Code Developer]
        REVIEW_AGENT[Code Review Agent]
        MEMORY_AGENT[Memory Gemini Bridge]
    end

    subgraph "Template System"
        ANALYSIS_TMPL[Analysis Templates]
        DEV_TMPL[Development Templates]
        PLAN_TMPL[Planning Templates]
        REVIEW_TMPL[Review Templates]
    end

    subgraph "Output Generation"
        TODO_MD["TODO_LIST.md"]
        IMPL_MD["IMPL_PLAN.md"]
        SUMMARY[".summaries/"]
        CHAT[".chat/ sessions"]
    end

    CLI --> GEM
    CLI --> COD
    CLI --> WRAPPER
    WRAPPER --> GEM

    GEM --> PLAN_AGENT
    COD --> CODE_AGENT

    PLAN_AGENT --> TASK_JSON
    ACTION_AGENT --> TASK_JSON
    CODE_AGENT --> TASK_JSON

    TASK_JSON --> HIERARCHY
    HIERARCHY --> STATUS

    SESSION --> MARKER
    MARKER --> WDIR

    ANALYSIS_TMPL --> GEM
    DEV_TMPL --> COD
    PLAN_TMPL --> PLAN_AGENT

    TASK_JSON --> TODO_MD
    TASK_JSON --> IMPL_MD
    STATUS --> SUMMARY
    GEM --> CHAT
    COD --> CHAT
```

## 2. Command Execution Flow

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant GeminiWrapper as Gemini Wrapper
    participant GeminiCLI as Gemini CLI
    participant CodexCLI as Codex CLI
    participant Agent
    participant TaskSystem as Task System
    participant FileSystem as File System

    User->>CLI: Command Request
    CLI->>CLI: Parse Command Type

    alt Analysis Task
        CLI->>GeminiWrapper: Analysis Request
        GeminiWrapper->>GeminiWrapper: Check Token Limit
        GeminiWrapper->>GeminiWrapper: Set Approval Mode
        GeminiWrapper->>GeminiCLI: Execute Analysis
        GeminiCLI->>FileSystem: Read Codebase
        GeminiCLI->>Agent: Route to Planning Agent
    else Development Task
        CLI->>CodexCLI: Development Request
        CodexCLI->>Agent: Route to Code Agent
    end

    Agent->>TaskSystem: Create/Update Tasks
    TaskSystem->>FileSystem: Save task JSON
    Agent->>Agent: Execute Task Logic
    Agent->>FileSystem: Apply Changes
    Agent->>TaskSystem: Update Task Status
    TaskSystem->>FileSystem: Regenerate Markdown Views
    Agent->>CLI: Return Results
    CLI->>User: Display Results
```

## 3. Session Management Flow

```mermaid
stateDiagram-v2
    [*] --> SessionInit: Create New Session

    SessionInit --> CreateStructure: mkdir .workflow/WFS-session-name
    CreateStructure --> CreateJSON: Create workflow-session.json
    CreateJSON --> CreatePlan: Create IMPL_PLAN.md
    CreatePlan --> CreateTasks: Create .task/ directory
    CreateTasks --> SetActive: touch .active-session-name

    SetActive --> Active: Session Ready

    Active --> Paused: Switch to Another Session
    Active --> Working: Execute Tasks
    Active --> Completed: All Tasks Done

    Paused --> Active: Resume Session (set marker)
    Working --> Active: Task Complete
    Completed --> [*]: Archive Session

    state Working {
        [*] --> TaskExecution
        TaskExecution --> AgentProcessing
        AgentProcessing --> TaskUpdate
        TaskUpdate --> [*]
    }
```

## 4. Task Lifecycle Management

```mermaid
graph TD
    subgraph "Task Creation"
        REQ[Requirements] --> ANALYZE{Analysis Needed?}
        ANALYZE -->|Yes| GEMINI[Gemini Analysis]
        ANALYZE -->|No| DIRECT[Direct Creation]
        GEMINI --> CONTEXT[Extract Context]
        CONTEXT --> TASK_JSON[Create impl-*.json]
        DIRECT --> TASK_JSON
    end

    subgraph "Task Hierarchy"
        TASK_JSON --> SIMPLE{<5 Tasks?}
        SIMPLE -->|Yes| SINGLE[Single Level: impl-N]
        SIMPLE -->|No| MULTI[Two Levels: impl-N.M]

        SINGLE --> EXEC1[Direct Execution]
        MULTI --> DECOMP[Task Decomposition]
        DECOMP --> SUBTASKS[Create Subtasks]
        SUBTASKS --> EXEC2[Execute Leaf Tasks]
    end

    subgraph "Task Execution"
        EXEC1 --> AGENT_SELECT[Select Agent]
        EXEC2 --> AGENT_SELECT
        AGENT_SELECT --> PLAN_A[Planning Agent]
        AGENT_SELECT --> CODE_A[Code Agent]
        AGENT_SELECT --> REVIEW_A[Review Agent]

        PLAN_A --> UPDATE_STATUS[Update Status]
        CODE_A --> UPDATE_STATUS
        REVIEW_A --> UPDATE_STATUS

        UPDATE_STATUS --> COMPLETED{All Done?}
        COMPLETED -->|No| NEXT_TASK[Next Task]
        COMPLETED -->|Yes| SUMMARY[Generate Summary]

        NEXT_TASK --> AGENT_SELECT
        SUMMARY --> REGEN[Regenerate Views]
        REGEN --> DONE[Session Complete]
    end
```

## 5. CLI Tool Integration Architecture

```mermaid
graph TB
    subgraph "User Input Layer"
        CMD[User Commands]
        INTENT{Task Intent}
    end

    subgraph "CLI Routing Layer"
        DISPATCHER[Command Dispatcher]
        GEMINI_ROUTE[Gemini Route]
        CODEX_ROUTE[Codex Route]
    end

    subgraph "Gemini Analysis Path"
        WRAPPER[Gemini Wrapper]
        TOKEN_CHECK{Token Limit Check}
        APPROVAL_MODE[Set Approval Mode]
        GEMINI_EXEC[Gemini Execution]

        subgraph "Gemini Features"
            ALL_FILES[--all-files Mode]
            PATTERNS[@{pattern} Mode]
            TEMPLATES[Template Integration]
        end
    end

    subgraph "Codex Development Path"
        CODEX_EXEC[Codex --full-auto exec]
        AUTO_DISCOVERY[Automatic File Discovery]
        CONTEXT_AWARE[Context-Aware Execution]

        subgraph "Codex Features"
            EXPLICIT_PATTERNS[@{pattern} Control]
            AUTONOMOUS[Full Autonomous Mode]
            TEMPLATE_INTEGRATION[Template Support]
        end
    end

    subgraph "Backend Processing"
        FILE_ANALYSIS[File Analysis]
        CONTEXT_EXTRACTION[Context Extraction]
        CODE_GENERATION[Code Generation]
        VALIDATION[Validation & Testing]
    end

    subgraph "Output Layer"
        RESULTS[Command Results]
        ARTIFACTS[Generated Artifacts]
        DOCUMENTATION[Updated Documentation]
    end

    CMD --> INTENT
    INTENT -->|Analyze/Review/Understand| GEMINI_ROUTE
    INTENT -->|Implement/Build/Develop| CODEX_ROUTE

    GEMINI_ROUTE --> WRAPPER
    WRAPPER --> TOKEN_CHECK
    TOKEN_CHECK -->|<2M tokens| ALL_FILES
    TOKEN_CHECK -->|>2M tokens| PATTERNS
    ALL_FILES --> APPROVAL_MODE
    PATTERNS --> APPROVAL_MODE
    APPROVAL_MODE --> GEMINI_EXEC
    GEMINI_EXEC --> TEMPLATES

    CODEX_ROUTE --> CODEX_EXEC
    CODEX_EXEC --> AUTO_DISCOVERY
    AUTO_DISCOVERY --> CONTEXT_AWARE
    CONTEXT_AWARE --> AUTONOMOUS
    AUTONOMOUS --> TEMPLATE_INTEGRATION

    TEMPLATES --> FILE_ANALYSIS
    TEMPLATE_INTEGRATION --> FILE_ANALYSIS

    FILE_ANALYSIS --> CONTEXT_EXTRACTION
    CONTEXT_EXTRACTION --> CODE_GENERATION
    CODE_GENERATION --> VALIDATION
    VALIDATION --> RESULTS

    RESULTS --> ARTIFACTS
    ARTIFACTS --> DOCUMENTATION
```

## 6. Agent Workflow Coordination

```mermaid
sequenceDiagram
    participant TaskSystem as Task System
    participant PlanningAgent as Conceptual Planning
    participant ActionAgent as Action Planning
    participant CodeAgent as Code Developer
    participant ReviewAgent as Code Review
    participant MemoryAgent as Memory Bridge

    TaskSystem->>PlanningAgent: New Complex Task
    PlanningAgent->>PlanningAgent: Strategic Analysis
    PlanningAgent->>ActionAgent: High-Level Plan

    ActionAgent->>ActionAgent: Break Down into Tasks
    ActionAgent->>TaskSystem: Create Task Hierarchy
    TaskSystem->>TaskSystem: Generate impl-*.json files

    loop For Each Implementation Task
        TaskSystem->>CodeAgent: Execute Task
        CodeAgent->>CodeAgent: Analyze Context
        CodeAgent->>CodeAgent: Generate Code
        CodeAgent->>TaskSystem: Update Status

        TaskSystem->>ReviewAgent: Review Code
        ReviewAgent->>ReviewAgent: Quality Check
        ReviewAgent->>ReviewAgent: Test Validation
        ReviewAgent->>TaskSystem: Approval/Feedback

        alt Code Needs Revision
            TaskSystem->>CodeAgent: Implement Changes
        else Code Approved
            TaskSystem->>TaskSystem: Mark Complete
        end
    end

    TaskSystem->>MemoryAgent: Update Documentation
    MemoryAgent->>MemoryAgent: Generate Summaries
    MemoryAgent->>MemoryAgent: Update README/Docs
    MemoryAgent->>TaskSystem: Documentation Complete
```

## 7. Template System Architecture

```mermaid
graph LR
    subgraph "Template Categories"
        ANALYSIS[Analysis Templates]
        DEVELOPMENT[Development Templates]
        PLANNING[Planning Templates]
        AUTOMATION[Automation Templates]
        REVIEW[Review Templates]
        INTEGRATION[Integration Templates]
    end

    subgraph "Template Files"
        ANALYSIS --> PATTERN[pattern.txt]
        ANALYSIS --> ARCH[architecture.txt]
        ANALYSIS --> SECURITY[security.txt]

        DEVELOPMENT --> FEATURE[feature.txt]
        DEVELOPMENT --> COMPONENT[component.txt]
        DEVELOPMENT --> REFACTOR[refactor.txt]

        PLANNING --> BREAKDOWN[task-breakdown.txt]
        PLANNING --> MIGRATION[migration.txt]

        AUTOMATION --> SCAFFOLD[scaffold.txt]
        AUTOMATION --> DEPLOY[deployment.txt]

        REVIEW --> CODE_REVIEW[code-review.txt]

        INTEGRATION --> API[api-design.txt]
        INTEGRATION --> DATABASE[database.txt]
    end

    subgraph "Usage Integration"
        CLI_GEMINI[Gemini CLI]
        CLI_CODEX[Codex CLI]
        AGENTS[Agent System]

        CLI_GEMINI --> ANALYSIS
        CLI_CODEX --> DEVELOPMENT
        CLI_CODEX --> AUTOMATION
        AGENTS --> PLANNING
        AGENTS --> REVIEW
        AGENTS --> INTEGRATION
    end

    subgraph "Template Resolution"
        CAT_CMD["$(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt)"]
        MULTI_TMPL[Multi-Template Composition]
        HEREDOC[HEREDOC Support]
    end

    PATTERN --> CAT_CMD
    FEATURE --> CAT_CMD
    BREAKDOWN --> CAT_CMD

    CAT_CMD --> MULTI_TMPL
    MULTI_TMPL --> HEREDOC
    HEREDOC --> CLI_GEMINI
    HEREDOC --> CLI_CODEX
```

## 8. Complexity Management System

```mermaid
flowchart TD
    INPUT[Task Input] --> ASSESS{Assess Complexity}

    ASSESS -->|<5 tasks| SIMPLE[Simple Workflow]
    ASSESS -->|5-15 tasks| MEDIUM[Medium Workflow]
    ASSESS -->|>15 tasks| COMPLEX[Complex Workflow]

    subgraph "Simple Workflow"
        SIMPLE_STRUCT[Single-Level: impl-N]
        SIMPLE_EXEC[Direct Execution]
        SIMPLE_MIN[Minimal Overhead]

        SIMPLE --> SIMPLE_STRUCT
        SIMPLE_STRUCT --> SIMPLE_EXEC
        SIMPLE_EXEC --> SIMPLE_MIN
    end

    subgraph "Medium Workflow"
        MEDIUM_STRUCT[Two-Level: impl-N.M]
        MEDIUM_PROGRESS[Progress Tracking]
        MEDIUM_DOCS[Auto Documentation]

        MEDIUM --> MEDIUM_STRUCT
        MEDIUM_STRUCT --> MEDIUM_PROGRESS
        MEDIUM_PROGRESS --> MEDIUM_DOCS
    end

    subgraph "Complex Workflow"
        COMPLEX_STRUCT[Deep Hierarchy]
        COMPLEX_ORCHESTRATION[Multi-Agent Orchestration]
        COMPLEX_COORD[Full Coordination]

        COMPLEX --> COMPLEX_STRUCT
        COMPLEX_STRUCT --> COMPLEX_ORCHESTRATION
        COMPLEX_ORCHESTRATION --> COMPLEX_COORD
    end

    subgraph "Dynamic Adaptation"
        RUNTIME_UPGRADE[Runtime Complexity Upgrade]
        SATURATION_CONTROL[Task Saturation Control]
        INTELLIGENT_DECOMP[Intelligent Decomposition]
    end

    SIMPLE_MIN --> RUNTIME_UPGRADE
    MEDIUM_DOCS --> RUNTIME_UPGRADE
    COMPLEX_COORD --> SATURATION_CONTROL
    SATURATION_CONTROL --> INTELLIGENT_DECOMP
```

## Key Architectural Changes Since v1.0

### Major Enhancements:
1. **Intelligent Task Saturation Control**: Prevents overwhelming agents with too many simultaneous tasks
2. **Gemini Wrapper Intelligence**: Automatic token management and approval mode detection
3. **Path-Specific Analysis**: Task-specific path management for precise CLI analysis
4. **Template System Integration**: Unified template system across all CLI tools
5. **Session Context Passing**: Proper context management for agent coordination
6. **On-Demand File Creation**: Improved performance through lazy initialization
7. **Enhanced Error Handling**: Comprehensive error logging and recovery
8. **Codex Full-Auto Mode**: Maximum autonomous development capabilities
9. **Cross-Tool Template Compatibility**: Seamless template sharing between Gemini and Codex

### Performance Improvements:
- 10-minute execution timeout for complex operations
- Sub-millisecond JSON query performance
- Atomic session switching with zero overhead
- Intelligent file discovery reducing context switching