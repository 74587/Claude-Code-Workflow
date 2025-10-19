---
name: auto-parallel
description: Parallel brainstorming automation with dynamic role selection and concurrent execution
argument-hint: "topic or challenge description" [--count N]
allowed-tools: SlashCommand(*), Task(*), TodoWrite(*), Read(*), Write(*), Bash(*), Glob(*)
---

# Workflow Brainstorm Parallel Auto Command

## Usage
```bash
/workflow:brainstorm:auto-parallel "<topic>" [--count N]
```

**Recommended Structured Format**:
```bash
/workflow:brainstorm:auto-parallel "GOAL: [objective] SCOPE: [boundaries] CONTEXT: [background]" [--count N]
```

**Parameters**:
- `topic` (required): Topic or challenge description (structured format recommended)
- `--count N` (optional): Number of roles to auto-select (default: 3, max: 9)

**⚠️ User Intent Preservation**: Topic description is stored in session metadata as authoritative reference throughout entire brainstorming workflow and plan generation.

## Role Selection Logic
- **Technical & Architecture**: `architecture|system|performance|database|security` → system-architect, data-architect, security-expert, subject-matter-expert
- **API & Backend**: `api|endpoint|rest|graphql|backend|interface|contract|service` → api-designer, system-architect, data-architect
- **Product & UX**: `user|ui|ux|interface|design|product|feature|experience` → ui-designer, user-researcher, product-manager, ux-expert, product-owner
- **Business & Process**: `business|process|workflow|cost|innovation|testing` → business-analyst, innovation-lead, test-strategist
- **Agile & Delivery**: `agile|sprint|scrum|team|collaboration|delivery` → scrum-master, product-owner
- **Domain Expertise**: `domain|standard|compliance|expertise|regulation` → subject-matter-expert
- **Multi-role**: Complex topics automatically select N complementary roles (N specified by --count, default 3)
- **Default**: `product-manager` if no clear match
- **Count Parameter**: `--count N` determines number of roles to auto-select (default: 3, max: 9)

**Template Loading**: `bash($(cat "~/.claude/workflows/cli-templates/planning-roles/<role-name>.md"))`
**Template Source**: `.claude/workflows/cli-templates/planning-roles/`
**Available Roles**: api-designer, data-architect, product-manager, product-owner, scrum-master, subject-matter-expert, system-architect, test-strategist, ui-designer, ux-expert

**Example**:
```bash
bash($(cat "~/.claude/workflows/cli-templates/planning-roles/system-architect.md"))
bash($(cat "~/.claude/workflows/cli-templates/planning-roles/ui-designer.md"))
```

## Core Workflow

### Structured Topic Processing → Role Analysis → Synthesis
The command follows a structured three-phase approach with dedicated document types:

**Phase 1: Framework Generation** ⚠️ COMMAND EXECUTION
- **Role selection**: Auto-select N roles based on topic keywords and --count parameter (default: 3, see Role Selection Logic)
- **Call artifacts command**: Execute `/workflow:brainstorm:artifacts "{topic}" --roles "{role1,role2,...,roleN}"` using SlashCommand tool
- **Role-specific framework**: Generate framework with sections tailored to selected roles
- **⚠️ User intent storage**: Topic saved in workflow-session.json as primary reference for all downstream phases

**Phase 2: Role Analysis Execution** ⚠️ PARALLEL AGENT ANALYSIS
- **Parallel execution**: Multiple roles execute simultaneously for faster completion
- **Independent agents**: Each role gets dedicated conceptual-planning-agent running in parallel
- **Shared framework**: All roles reference the same topic framework for consistency
- **Concurrent generation**: Role-specific analysis documents generated simultaneously
- **Progress tracking**: Parallel agents update progress independently

**Phase 3: Synthesis Generation** ⚠️ COMMAND EXECUTION
- **Call synthesis command**: Execute `/workflow:brainstorm:synthesis` using SlashCommand tool
- **⚠️ User intent injection**: Synthesis loads original topic from session metadata as highest priority reference
- **Intent alignment**: Synthesis validates all role insights against user's original objectives

## Implementation Standards

### Simplified Command Orchestration ⚠️ STREAMLINED
Auto command coordinates independent specialized commands:

**Command Sequence**:
1. **Role Selection**: Auto-select N relevant roles based on topic keywords and --count parameter (default: 3)
2. **Generate Role-Specific Framework**: Use SlashCommand to execute `/workflow:brainstorm:artifacts "{topic}" --roles "{role1,role2,...,roleN}"` (stores user intent in session)
3. **Parallel Role Analysis**: Execute selected role agents in parallel, each reading their specific framework section
4. **Generate Synthesis**: Use SlashCommand to execute `/workflow:brainstorm:synthesis` (loads user intent from session as primary reference)

**SlashCommand Integration**:
1. **artifacts command**: Called via SlashCommand tool with `--roles` parameter for role-specific framework generation
2. **role agents**: Each agent reads its dedicated section in the role-specific framework
3. **synthesis command**: Called via SlashCommand tool for final integration with role-targeted insights
4. **Command coordination**: SlashCommand handles execution and validation

**Role Selection Logic**:
- **Technical**: `architecture|system|performance|database` → system-architect, data-architect, subject-matter-expert
- **API & Backend**: `api|endpoint|rest|graphql|backend|interface|contract|service` → api-designer, system-architect, data-architect
- **Product & UX**: `user|ui|ux|interface|design|product|feature|experience` → ui-designer, ux-expert, product-manager, product-owner
- **Agile & Delivery**: `agile|sprint|scrum|team|collaboration|delivery` → scrum-master, product-owner
- **Domain Expertise**: `domain|standard|compliance|expertise|regulation` → subject-matter-expert
- **Auto-select**: N most relevant roles based on topic analysis (N from --count parameter, default: 3)

### Parameter Parsing

**Count Parameter Handling**:
```bash
# Parse --count parameter from user input
IF user_input CONTAINS "--count":
    EXTRACT count_value FROM "--count N" pattern
    IF count_value > 9:
        count_value = 9  # Cap at maximum 9 roles
    END IF
ELSE:
    count_value = 3  # Default to 3 roles
END IF
```

**Role Selection with Count**:
1. **Analyze topic keywords**: Identify relevant role categories
2. **Rank roles by relevance**: Score based on keyword matches
3. **Select top N roles**: Pick N most relevant roles (N = count_value)
4. **Ensure diversity**: Balance across different expertise areas
5. **Minimum guarantee**: Always include at least one role (default to product-manager if no matches)

### Simplified Processing Standards

**Core Principles**:
1. **Minimal preprocessing** - Only workflow-session.json and basic role selection
2. **Agent autonomy** - Agents handle their own context and validation
3. **Parallel execution** - Multiple agents can work simultaneously
4. **Post-processing synthesis** - Integration happens after agent completion
5. **TodoWrite control** - Progress tracking throughout all phases

**Implementation Rules**:
- **Role count**: N roles auto-selected based on --count parameter (default: 3, max: 9) and keyword mapping
- **No upfront validation**: Agents handle their own context requirements
- **Parallel execution**: Each agent operates concurrently without dependencies
- **Synthesis at end**: Integration only after all agents complete

**Agent Self-Management** (Agents decide their own approach):
- **Context gathering**: Agents determine what questions to ask
- **Template usage**: Agents load and apply their own role templates
- **Analysis depth**: Agents determine appropriate level of detail
- **Documentation**: Agents create their own file structure and content

### Session Management ⚠️ CRITICAL
- **⚡ FIRST ACTION**: Check for all `.workflow/.active-*` markers before role processing
- **Multiple sessions support**: Different Claude instances can have different active brainstorming sessions
- **User selection**: If multiple active sessions found, prompt user to select which one to work with
- **Auto-session creation**: `WFS-[topic-slug]` only if no active session exists
- **Session continuity**: MUST use selected active session for all role processing
- **Context preservation**: Each role's context and agent output stored in session directory
- **Session isolation**: Each session maintains independent brainstorming state and role assignments

## Document Generation

**Command Coordination Workflow**: artifacts → parallel role analysis → synthesis

**Output Structure**: Coordinated commands generate framework, role analyses, and synthesis documents as defined in their respective command specifications.


## Agent Prompt Templates

### Task Agent Invocation Template


```bash
Task(subagent_type="conceptual-planning-agent",
     prompt="Execute brainstorming analysis: {role-name} perspective for {topic}

     ## Role Assignment
     **ASSIGNED_ROLE**: {role-name}
     **TOPIC**: {user-provided-topic}
     **OUTPUT_LOCATION**: .workflow/WFS-{topic}/.brainstorming/{role}/

     ## Execution Instructions
     [FLOW_CONTROL]

     ### Flow Control Steps
     **AGENT RESPONSIBILITY**: Execute these pre_analysis steps sequentially with context accumulation:

     1. **load_topic_framework**
        - Action: Load structured topic discussion framework
        - Command: bash(cat .workflow/WFS-{topic}/.brainstorming/topic-framework.md 2>/dev/null || echo 'Topic framework not found')
        - Output: topic_framework

     2. **load_role_template**
        - Action: Load {role-name} planning template
        - Command: bash($(cat "~/.claude/workflows/cli-templates/planning-roles/{role}.md"))
        - Output: role_template

     3. **load_session_metadata**
        - Action: Load session metadata and original user intent
        - Command: bash(cat .workflow/WFS-{topic}/workflow-session.json 2>/dev/null || echo '{}')
        - Output: session_metadata (contains original user prompt in 'project' or 'description' field)

     ### Implementation Context
     **⚠️ User Intent Authority**: Original user prompt from session_metadata.project is PRIMARY reference
     **Topic Framework**: Use loaded topic-framework.md for structured analysis
     **Role Focus**: {role-name} domain expertise and perspective aligned with user intent
     **Analysis Type**: Address framework discussion points from role perspective, filtered by user objectives
     **Template Framework**: Combine role template with topic framework structure
     **Structured Approach**: Create analysis.md addressing all topic framework points relevant to user's goals

     ### Session Context
     **Workflow Directory**: .workflow/WFS-{topic}/.brainstorming/
     **Output Directory**: .workflow/WFS-{topic}/.brainstorming/{role}/
     **Session JSON**: .workflow/WFS-{topic}/workflow-session.json

     ### Dependencies & Context
     **Topic**: {user-provided-topic}
     **Role Template**: "~/.claude/workflows/cli-templates/planning-roles/{role}.md"
     **User Requirements**: To be gathered through interactive questioning

     ## Completion Requirements
     1. Execute all flow control steps in sequence (load topic framework, role template, session metadata with user intent)
     2. **⚠️ User Intent Alignment**: Validate analysis aligns with original user objectives from session_metadata
     3. **Address Topic Framework**: Respond to all discussion points in topic-framework.md from role perspective
     4. **Filter by User Goals**: Prioritize insights directly relevant to user's stated objectives
     5. Apply role template guidelines within topic framework structure
     6. Generate structured role analysis addressing framework points aligned with user intent
     7. Create single comprehensive deliverable in OUTPUT_LOCATION:
        - analysis.md (structured analysis addressing all topic framework points with role-specific insights filtered by user goals)
     8. Include framework reference: @../topic-framework.md in analysis.md
     9. Update workflow-session.json with completion status",
     description="Execute {role-name} brainstorming analysis")
```

### Parallel Role Agent调用示例
```bash
# Execute N roles in parallel using single message with multiple Task calls
# (N determined by --count parameter, default 3, shown below with 3 roles as example)

Task(subagent_type="conceptual-planning-agent",
     prompt="Execute brainstorming analysis: {role-1} perspective for {topic}...",
     description="Execute {role-1} brainstorming analysis")

Task(subagent_type="conceptual-planning-agent",
     prompt="Execute brainstorming analysis: {role-2} perspective for {topic}...",
     description="Execute {role-2} brainstorming analysis")

Task(subagent_type="conceptual-planning-agent",
     prompt="Execute brainstorming analysis: {role-3} perspective for {topic}...",
     description="Execute {role-3} brainstorming analysis")

# ... repeat for remaining N-3 roles if --count > 3
```

### Direct Synthesis Process (Command-Driven)
**Synthesis execution**: Use SlashCommand to execute `/workflow:brainstorm:synthesis` after role completion


## TodoWrite Control Flow ⚠️ CRITICAL

### Workflow Progress Tracking
**MANDATORY**: Use Claude Code's built-in TodoWrite tool throughout entire brainstorming workflow:

```javascript
// Phase 1: Create initial todo list for command-coordinated brainstorming workflow
TodoWrite({
  todos: [
    {
      content: "Initialize brainstorming session and detect active sessions",
      status: "pending",
      activeForm: "Initializing brainstorming session"
    },
    {
      content: "Parse --count parameter and select N roles based on topic keyword analysis",
      status: "pending",
      activeForm: "Parsing parameters and selecting roles for brainstorming"
    },
    {
      content: "Execute artifacts command with selected roles for role-specific framework",
      status: "pending",
      activeForm: "Generating role-specific topic framework"
    },
    {
      content: "Execute [role-1] analysis [conceptual-planning-agent] [FLOW_CONTROL] addressing framework",
      status: "pending",
      activeForm: "Executing [role-1] structured framework analysis"
    },
    {
      content: "Execute [role-2] analysis [conceptual-planning-agent] [FLOW_CONTROL] addressing framework",
      status: "pending",
      activeForm: "Executing [role-2] structured framework analysis"
    },
    // ... repeat for N roles (N determined by --count parameter, default 3)
    {
      content: "Execute [role-N] analysis [conceptual-planning-agent] [FLOW_CONTROL] addressing framework",
      status: "pending",
      activeForm: "Executing [role-N] structured framework analysis"
    },
    {
      content: "Execute synthesis command using SlashCommand for final integration",
      status: "pending",
      activeForm: "Executing synthesis command for integrated analysis"
    }
  ]
});

// Phase 2: Update status as workflow progresses - ONLY ONE task should be in_progress at a time
TodoWrite({
  todos: [
    {
      content: "Initialize brainstorming session and detect active sessions",
      status: "completed",  // Mark completed preprocessing
      activeForm: "Initializing brainstorming session"
    },
    {
      content: "Select roles for topic analysis and create workflow-session.json",
      status: "in_progress",  // Mark current task as in_progress
      activeForm: "Selecting roles and creating session metadata"
    },
    // ... other tasks remain pending
  ]
});

// Phase 3: Parallel agent execution tracking (N roles, N from --count parameter)
TodoWrite({
  todos: [
    // ... previous completed tasks
    {
      content: "Execute [role-1] analysis [conceptual-planning-agent] [FLOW_CONTROL]",
      status: "in_progress",  // Executing in parallel
      activeForm: "Executing [role-1] brainstorming analysis"
    },
    {
      content: "Execute [role-2] analysis [conceptual-planning-agent] [FLOW_CONTROL]",
      status: "in_progress",  // Executing in parallel
      activeForm: "Executing [role-2] brainstorming analysis"
    },
    // ... repeat for remaining N-2 roles
    {
      content: "Execute [role-N] analysis [conceptual-planning-agent] [FLOW_CONTROL]",
      status: "in_progress",  // Executing in parallel
      activeForm: "Executing [role-N] brainstorming analysis"
    }
  ]
});
```

**TodoWrite Integration Rules**:
1. **Create initial todos**: All workflow phases at start
2. **Mark in_progress**: Multiple parallel tasks can be in_progress simultaneously
3. **Update immediately**: After each task completion
4. **Track agent execution**: Include [agent-type] and [FLOW_CONTROL] markers for parallel agents
5. **Final synthesis**: Mark synthesis as in_progress only after all parallel agents complete

## Reference Information

### Structured Processing Schema
Each role processing follows structured framework pattern:
- **topic_framework**: Structured discussion framework document
- **role**: Selected planning role name with framework reference
- **agent**: Dedicated conceptual-planning-agent instance
- **structured_analysis**: Agent addresses all framework discussion points
- **output**: Role-specific analysis.md addressing topic framework structure

### File Structure Reference
**Architecture**: @~/.claude/workflows/workflow-architecture.md
**Role Templates**: @~/.claude/workflows/cli-templates/planning-roles/

### Execution Integration
Command coordination model: artifacts command → parallel role analysis → synthesis command


## Error Handling
- **Role selection failure**: Default to `product-manager` with explanation
- **Agent execution failure**: Agent-specific retry with minimal dependencies
- **Template loading issues**: Agent handles graceful degradation
- **Synthesis conflicts**: Synthesis agent highlights disagreements without resolution

## Quality Standards

### Agent Autonomy Excellence
- **Single role focus**: Each agent handles exactly one role independently
- **Self-contained execution**: Agent manages own context, validation, and output
- **Parallel processing**: Multiple agents can execute simultaneously
- **Complete ownership**: Agent produces entire role-specific analysis package

### Minimal Coordination Excellence
- **Lightweight handoff**: Only topic and role assignment provided
- **Agent self-management**: Agents handle their own workflow and validation
- **Concurrent operation**: No inter-agent dependencies enabling parallel execution
- **Reference-based synthesis**: Post-processing integration without content duplication
- **TodoWrite orchestration**: Progress tracking and workflow control throughout entire process
