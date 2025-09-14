---
name: plan-deep
description: Deep technical planning with Gemini CLI analysis and action-planning-agent
usage: /workflow:plan-deep <task_description>
argument-hint: "task description" | requirements.md
examples:
  - /workflow:plan-deep "Refactor authentication system to use JWT"
  - /workflow:plan-deep "Implement real-time notifications across modules"
  - /workflow:plan-deep requirements.md
---

# Workflow Plan Deep Command (/workflow:plan-deep)

## Overview
Creates comprehensive implementation plans through deep codebase analysis using Gemini CLI and the action-planning-agent. This command enforces multi-dimensional context gathering before planning, ensuring technical decisions are grounded in actual codebase understanding.

## Key Differentiators

### vs /workflow:plan
| Feature | /workflow:plan | /workflow:plan-deep |
|---------|---------------|-------------------|
| **Analysis Depth** | Basic requirements extraction | Deep codebase analysis |
| **Gemini CLI** | Optional | **Mandatory (via agent)** |
| **Context Scope** | Current input only | Multi-dimensional analysis |
| **Agent Used** | None (direct processing) | action-planning-agent |
| **Output Detail** | Standard IMPL_PLAN | Enhanced hierarchical plan |
| **Best For** | Quick planning | Complex technical tasks |

## When to Use This Command

### Ideal Scenarios
- **Cross-module refactoring** requiring understanding of multiple components
- **Architecture changes** affecting system-wide patterns
- **Complex feature implementation** spanning >3 modules
- **Performance optimization** requiring deep code analysis
- **Security enhancements** needing comprehensive vulnerability assessment
- **Technical debt resolution** with broad impact

### Not Recommended For
- Simple, single-file changes
- Documentation updates
- Configuration adjustments
- Tasks with clear, limited scope

## Execution Flow

### 1. Input Processing
```
Input Analysis:
├── Validate input clarity (reject vague descriptions)
├── Parse task description or file
├── Extract key technical terms
├── Identify potential affected domains
└── Prepare context for agent
```

**Clarity Requirements**:
- **Minimum specificity**: Must include clear technical goal and affected components
- **Auto-rejection**: Vague inputs like "optimize system", "refactor code", "improve performance" without context
- **Response**: `❌ Input too vague. Deep planning requires specific technical objectives and component scope.`

### 2. Agent Invocation with Deep Analysis Flag
The command invokes action-planning-agent with special parameters that **enforce** Gemini CLI analysis.

### 3. Agent Processing (Delegated to action-planning-agent)

**Agent Execution Flow**:
```
Agent receives DEEP_ANALYSIS_REQUIRED flag
├── Executes 4-dimension Gemini CLI analysis in parallel:
│   ├── Architecture Analysis (patterns, components)
│   ├── Code Pattern Analysis (conventions, standards)
│   ├── Impact Analysis (affected modules, dependencies)
│   └── Testing Requirements (coverage, patterns)
├── Consolidates Gemini results into gemini-analysis.md
├── Creates workflow session directory
├── Generates hierarchical IMPL_PLAN.md
├── Creates TODO_LIST.md for tracking
└── Saves all outputs to .workflow/WFS-[session-id]/
```
```markdown
Task(action-planning-agent):
  description: "Deep technical planning with mandatory codebase analysis"
  prompt: |
    Create implementation plan for: [task_description]
    
    EXECUTION MODE: DEEP_ANALYSIS_REQUIRED
    
    MANDATORY REQUIREMENTS:
    - Execute comprehensive Gemini CLI analysis (4 dimensions)
    - Skip PRD processing (no PRD provided)
    - Skip session inheritance (standalone planning)
    - Force GEMINI_CLI_REQUIRED flag = true
    - Set analysis_source = "gemini" (深度分析固定值)
    - Generate hierarchical task decomposition (max 2 levels: impl-N.M)
    - Create detailed IMPL_PLAN.md with subtasks
    - Generate TODO_LIST.md for tracking
    
    GEMINI ANALYSIS DIMENSIONS (execute in parallel):
    1. Architecture Analysis - design patterns, component relationships
    2. Code Pattern Analysis - conventions, error handling, validation
    3. Impact Analysis - affected modules, breaking changes
    4. Testing Requirements - coverage needs, test patterns
    
    FOCUS: Technical implementation based on deep codebase understanding
```

### 4. Output Generation (by Agent)
The action-planning-agent generates in `.workflow/WFS-[session-id]/`:
- **IMPL_PLAN.md** - Hierarchical implementation plan with stages
- **TODO_LIST.md** - Unified hierarchical task tracking with ▸ container tasks and indented subtasks
- **.task/*.json** - Task definitions for complex projects
- **workflow-session.json** - Session tracking
- **gemini-analysis.md** - Consolidated Gemini analysis results

## Command Processing Logic

```python
def process_plan_deep_command(input):
    # Step 1: Parse input
    task_description = parse_input(input)
    
    # Step 2: Build agent prompt with deep analysis flag
    agent_prompt = f"""
    EXECUTION_MODE: DEEP_ANALYSIS_REQUIRED
    TASK: {task_description}
    
    MANDATORY FLAGS:
    - GEMINI_CLI_REQUIRED = true
    - analysis_source = "gemini" (固定设置)
    - FORCE_PARALLEL_ANALYSIS = true
    - SKIP_PRD = true
    - SKIP_SESSION_INHERITANCE = true
    
    Execute comprehensive Gemini CLI analysis before planning.
    """
    
    # Step 3: Invoke action-planning-agent
    # Agent will handle session creation and Gemini execution
    Task(
        subagent_type="action-planning-agent",
        description="Deep technical planning with mandatory analysis",
        prompt=agent_prompt
    )
    
    # Step 4: Agent handles all processing and outputs
    return "Agent executing deep analysis and planning..."
```

## Error Handling

### Common Issues and Solutions

**Input Processing Errors**
- **Vague text input**: Auto-reject without guidance
  - Rejected examples: "optimize system", "refactor code", "make it faster", "improve architecture"
  - Response: Direct rejection message, no further assistance

**Agent Execution Errors**
- Verify action-planning-agent availability
- Check for context size limits
- Agent handles Gemini CLI failures internally

**Gemini CLI Failures (handled by agent)**
- Agent falls back to file-pattern based analysis
- Agent retries with reduced scope automatically
- Agent alerts if critical analysis fails

**File Access Issues**
- Verify permissions for workflow directory
- Check file patterns for validity
- Alert on missing CLAUDE.md files

## Integration Points

### Related Commands
- `/workflow:plan` - Quick planning without deep analysis
- `/workflow:execute` - Execute generated plans
- `/workflow:review` - Review implementation progress
- `/context` - View generated planning documents

### Agent Dependencies
- **action-planning-agent** - Core planning engine
- **code-developer** - For execution phase
- **code-review-agent** - For quality checks

## Usage Examples

### Example 1: Cross-Module Refactoring
```bash
/workflow:plan-deep "Refactor user authentication to use JWT tokens across all services"
```
Generates comprehensive plan analyzing:
- Current auth implementation
- All affected services
- Migration strategy
- Testing requirements

### Example 2: Performance Optimization
```bash
/workflow:plan-deep "Optimize database query performance in reporting module"
```
Creates detailed plan including:
- Current query patterns analysis
- Bottleneck identification
- Optimization strategies
- Performance testing approach

### Example 3: Architecture Enhancement
```bash
/workflow:plan-deep "Implement event-driven architecture for order processing"
```
Produces hierarchical plan with:
- Current architecture assessment
- Event flow design
- Module integration points
- Staged migration approach

## Best Practices

1. **Use for Complex Tasks**: Reserve for tasks requiring deep understanding
2. **Provide Clear Descriptions**: Specific task descriptions yield better analysis
3. **Review Gemini Output**: Check analysis results for accuracy
4. **Iterate on Plans**: Refine based on initial analysis
5. **Track Progress**: Use generated TODO_LIST.md for execution

## Technical Notes

- **Agent-Driven Analysis**: action-planning-agent executes all Gemini CLI commands
- **Parallel Execution**: Agent runs 4 Gemini analyses concurrently for performance
- **Context Management**: Agent handles context size limits automatically
- **Structured Handoff**: Command passes DEEP_ANALYSIS_REQUIRED flag to agent
- **Session Management**: Agent creates and manages workflow session
- **Output Standards**: All documents follow established workflow formats

---

**System ensures**: Deep technical understanding before planning through mandatory Gemini CLI analysis and intelligent agent orchestration