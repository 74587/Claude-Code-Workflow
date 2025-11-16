---
name: lite-plan
description: Lightweight interactive planning and execution workflow with in-memory planning, code exploration, and immediate execution after user confirmation
argument-hint: "[--tool claude|gemini|qwen|codex] [-e|--explore] \"task description\"|file.md"
allowed-tools: TodoWrite(*), Task(*), Bash(*), AskUserQuestion(*)
timeout: 180000
color: cyan
---

# Workflow Lite-Plan Command (/workflow:lite-plan)

## Overview

Intelligent lightweight planning and execution command with dynamic workflow adaptation based on task complexity.

## Core Functionality

- **Intelligent Task Analysis**: Automatically determines if exploration/planning agents are needed
- **Dynamic Exploration**: Calls cli-explore-agent only when task requires codebase understanding
- **Interactive Clarification**: Asks follow-up questions after exploration to gather missing information
- **Adaptive Planning**:
  - Simple tasks: Direct planning by current Claude
  - Complex tasks: Delegates to cli-planning-agent for detailed breakdown
- **Two-Step Confirmation**: First display complete plan as text, then collect three-dimensional input (task approval + execution method + code review tool)
- **Direct Execution**: Immediate dispatch to selected execution method (agent/codex/auto)
- **Live Progress Tracking**: Real-time TodoWrite updates at execution call level ([Agent-1], [Codex-1], etc.) during execution
- **Optional Code Review**: Post-execution quality analysis with gemini/agent or custom tools via "Other" option (e.g., qwen, codex)


## Usage

### Command Syntax
```bash
/workflow:lite-plan [FLAGS] <TASK_DESCRIPTION>

# Flags
-e, --explore              Force code exploration phase (overrides auto-detection logic)

# Arguments
<task-description>         Task description or path to .md file (required)
```


## Execution Process

### Workflow Overview

```
User Input ("/workflow:lite-plan \"task\"")
    |
    v
[Phase 1] Task Analysis & Exploration Decision (10-20 seconds)
    -> Analyze task description
    -> Decision: Need exploration? (Yes/No)
    -> If Yes: Launch cli-explore-agent
    -> Output: exploration findings (if performed)
    |
    v
[Phase 2] Clarification (Optional, user interaction)
    -> If exploration revealed ambiguities or missing info
    -> AskUserQuestion: Gather clarifications
    -> Update task context with user responses
    -> If no clarification needed: Skip to Phase 3
    |
    v
[Phase 3] Complexity Assessment & Planning (20-60 seconds)
    -> Assess task complexity (Low/Medium/High)
    -> Decision: Planning strategy
       - Low: Direct planning (current Claude)
       - Medium/High: Delegate to cli-planning-agent
    -> Output: Task breakdown with execution approach
    |
    v
[Phase 4] Task Confirmation & Execution Selection (User interaction)
    -> Step 4.1: Output complete plan as text to user
    -> Step 4.2: AskUserQuestion with three dimensions
       1. Confirm task: Allow/Modify/Cancel (multi-select, can supplement via Other)
       2. Execution method: Agent/Codex/Auto (single-select, auto: simple→agent, complex→codex)
       3. Code review: Skip/Gemini/Agent/Other (single-select, can specify custom tool via Other)
    -> Process selections and proceed to Phase 5
    -> If cancel: Exit
    |
    v
[Phase 5] Execution & Progress Tracking
    -> Create TodoWrite execution call list (grouped tasks)
    -> Launch selected execution (agent or CLI)
    -> Track execution call progress with TodoWrite updates
    -> Real-time call status displayed to user (e.g., "[Agent-1] (Task A + Task B)")
    -> If code review enabled: Run selected CLI analysis
    |
    v
Execution Complete
```

### Task Management Pattern

- TodoWrite creates execution call list before execution starts (Phase 5)
- Execution calls ([Agent-1], [Codex-1], etc.) marked as in_progress/completed during execution
- Each execution call handles multiple related tasks
- Real-time progress updates visible at call level (not individual task level)
- No intermediate file artifacts generated

## Detailed Phase Execution

### Phase 1: Task Analysis & Exploration Decision

**Operations**:
- Analyze task description to determine if code exploration is needed
- Decision logic:
  ```javascript
  needsExploration = (
    flags.includes('--explore') || flags.includes('-e') ||  // Force exploration if flag present
    (
      task.mentions_specific_files ||
      task.requires_codebase_context ||
      task.needs_architecture_understanding ||
      task.modifies_existing_code
    )
  )
  ```

**Decision Criteria**:

| Task Type | Needs Exploration | Reason |
|-----------|-------------------|--------|
| Any task with `-e` or `--explore` flag | **Yes (forced)** | **Flag overrides auto-detection logic** |
| "Implement new feature X" | Maybe | Depends on integration with existing code |
| "Refactor module Y" | Yes | Needs understanding of current implementation |
| "Add tests for Z" | Yes | Needs to understand code structure |
| "Create new standalone utility" | No | Self-contained, no existing code context |
| "Update documentation" | No | Doesn't require code exploration |
| "Fix bug in function F" | Yes | Needs to understand implementation |

**If Exploration Needed**:
- Launch cli-explore-agent with task-specific focus
- Agent call format:
  ```javascript
  Task(
    subagent_type="cli-explore-agent",
    description="Analyze codebase for task context",
    prompt=`
    Task: ${task_description}

    Analyze and return the following information in structured format:
    1. Project Structure: Overall architecture and module organization
    2. Relevant Files: List of files that will be affected by this task (with paths)
    3. Current Implementation Patterns: Existing code patterns, conventions, and styles
    4. Dependencies: External dependencies and internal module dependencies
    5. Integration Points: Where this task connects with existing code
    6. Architecture Constraints: Technical limitations or requirements
    7. Clarification Needs: Ambiguities or missing information requiring user input

    Time Limit: 60 seconds

    Output Format: Return a JSON-like structured object with the above fields populated.
    Include specific file paths, pattern examples, and clear questions for clarifications.
    `
  )
  ```

**Expected Return Structure**:
```javascript
explorationContext = {
  project_structure: "Description of overall architecture",
  relevant_files: ["src/auth/service.ts", "src/middleware/auth.ts", ...],
  patterns: "Description of existing patterns (e.g., 'Uses dependency injection pattern', 'React hooks convention')",
  dependencies: "List of dependencies and integration points",
  integration_points: "Where this connects with existing code",
  constraints: "Technical constraints (e.g., 'Must use existing auth library', 'No breaking changes')",
  clarification_needs: [
    {
      question: "Which authentication method to use?",
      context: "Found both JWT and Session patterns",
      options: ["JWT tokens", "Session-based", "Hybrid approach"]
    },
    // ... more clarification questions
  ]
}
```

**Output Processing**:
- Store exploration findings in `explorationContext`
- Extract `clarification_needs` array from exploration results
- Set `needsClarification = (clarification_needs.length > 0)`
- Use clarification_needs to generate Phase 2 questions

**Progress Tracking**:
- Mark Phase 1 as completed
- If needsClarification: Mark Phase 2 as in_progress
- Else: Skip to Phase 3

**Expected Duration**: 10-20 seconds (analysis) + 30-60 seconds (exploration if needed)

---

### Phase 2: Clarification (Optional)

**Skip Condition**: Only run if Phase 1 set `needsClarification = true`

**Operations**:
- Review `explorationContext.clarification_needs` from Phase 1
- Generate AskUserQuestion based on exploration findings
- Focus on ambiguities that affect implementation approach

**AskUserQuestion Call** (simplified reference):
```javascript
// Use clarification_needs from exploration to build questions
AskUserQuestion({
  questions: explorationContext.clarification_needs.map(need => ({
    question: `${need.context}\n\n${need.question}`,
    header: "Clarification",
    multiSelect: false,
    options: need.options.map(opt => ({
      label: opt,
      description: `Use ${opt} approach`
    }))
  }))
})
```

**Output Processing**:
- Collect user responses and store in `clarificationContext`
- Format: `{ question_id: selected_answer, ... }`
- This context will be passed to Phase 3 planning

**Progress Tracking**:
- Mark Phase 2 as completed
- Mark Phase 3 as in_progress

**Expected Duration**: User-dependent (typically 30-60 seconds)

---

### Phase 3: Complexity Assessment & Planning

**Operations**:
- Assess task complexity based on multiple factors
- Select appropriate planning strategy
- Generate task breakdown using selected method

**Complexity Assessment Factors**:
```javascript
complexityScore = {
  file_count: exploration.files_to_modify.length,
  integration_points: exploration.dependencies.length,
  architecture_changes: exploration.requires_architecture_change,
  technology_stack: exploration.unfamiliar_technologies.length,
  task_scope: (task.estimated_steps > 5),
  cross_cutting_concerns: exploration.affects_multiple_modules
}

// Calculate complexity
if (complexityScore < 3) complexity = "Low"
else if (complexityScore < 6) complexity = "Medium"
else complexity = "High"
```

**Complexity Levels**:

| Level | Characteristics | Planning Strategy |
|-------|----------------|-------------------|
| Low | 1-2 files, simple changes, clear requirements | Direct planning (current Claude) |
| Medium | 3-5 files, moderate integration, some ambiguity | Delegate to cli-planning-agent |
| High | 6+ files, complex architecture, high uncertainty | Delegate to cli-planning-agent with detailed analysis |

**Planning Execution**:

**Option A: Direct Planning (Low Complexity)**

Current Claude generates plan directly following these guidelines:
- **Summary**: 2-3 sentence overview of the implementation
- **Approach**: High-level implementation strategy
- **Task Breakdown**: 3-5 specific, actionable tasks with file paths
- **Estimated Time**: Total implementation time estimate
- **Recommended Execution**: "Agent" (for Low complexity tasks)

**Option B: Agent-Based Planning (Medium/High Complexity)**

Delegate to cli-planning-agent with detailed requirements:
```javascript
Task(
  subagent_type="cli-planning-agent",
  description="Generate detailed implementation plan",
  prompt=`
  Task: ${task_description}
  Exploration Context: ${JSON.stringify(explorationContext, null, 2)}
  User Clarifications: ${JSON.stringify(clarificationContext, null, 2) || "None provided"}
  Complexity Level: ${complexity}

  Generate a detailed implementation plan with the following components:

  1. Summary: 2-3 sentence overview of the implementation
  2. Approach: High-level implementation strategy
  3. Task Breakdown: 5-10 specific, actionable tasks
     - Each task should specify: What to do, Which files to modify/create, Dependencies on other tasks (if any)
  4. Task Dependencies & Parallelization:
     - Identify independent tasks that can run in parallel (no shared file conflicts or logical dependencies)
     - Group tasks by execution order: parallel groups can execute simultaneously, sequential groups must wait for previous completion
     - Format: "Group 1 (parallel): Task 1, Task 2 | Group 2 (parallel): Task 3, Task 4 | Task 5 (depends on all)"
  5. Risks: Potential issues and mitigation strategies (for Medium/High complexity)
  6. Estimated Time: Total implementation time estimate
  7. Recommended Execution: "Agent" or "Codex" based on task complexity

  Ensure tasks are specific, with file paths and clear acceptance criteria.
  `
)
```

**Expected Return Structure (Both Options)**:
```javascript
planObject = {
  summary: string,              // 2-3 sentence overview
  approach: string,             // High-level implementation strategy
  tasks: string[],              // 3-5 tasks (Low) or 5-10 tasks (Medium/High) with file paths
  dependencies: string[],       // Task execution order: parallel groups and sequential dependencies (Medium/High only)
  risks: string[],              // Potential issues and mitigation strategies (Medium/High only)
  estimated_time: string,       // Total implementation time estimate
  recommended_execution: string, // "Agent" (Low) or "Codex" (Medium/High)
  complexity: string            // "Low" | "Medium" | "High"
}
```

**Progress Tracking**:
- Mark Phase 3 as completed
- Mark Phase 4 as in_progress

**Expected Duration**:
- Low complexity: 20-30 seconds (direct)
- Medium/High complexity: 40-60 seconds (agent-based)

---

### Phase 4: Task Confirmation & Execution Selection

**User Interaction Flow**: Two-step confirmation process

**Step 4.1: Display Plan Summary**

First, output the complete plan to the user as regular text:

```
## Implementation Plan

**Summary**: ${planObject.summary}

**Approach**: ${planObject.approach}

**Task Breakdown**:
${planObject.tasks.map((t, i) => `${i+1}. ${t}`).join('\n')}

${planObject.dependencies ? `\n**Dependencies**:\n${planObject.dependencies.join('\n')}` : ''}

${planObject.risks ? `\n**Risks**:\n${planObject.risks.join('\n')}` : ''}

**Complexity**: ${planObject.complexity}
**Estimated Time**: ${planObject.estimated_time}
**Recommended Execution**: ${planObject.recommended_execution}
```

**Step 4.2: Collect User Confirmation**

After displaying the plan, collect three inputs via AskUserQuestion:

**Operations**:
- Collect three inputs:
  1. Task confirmation (multi-select: Allow/Modify/Cancel + optional supplements via "Other")
  2. Execution method (single-select: Agent/Codex/Auto)
     - Agent: Execute with @code-developer
     - Codex: Execute with codex CLI tool
     - Auto: Simple tasks (Low complexity) → Agent, Complex tasks (Medium/High) → Codex
  3. Code review tool (single-select: Skip/Gemini/Agent + custom tools via "Other")
     - Gemini Review: Use gemini CLI for code analysis
     - Agent Review: Use @code-reviewer agent
     - Other: Specify custom tool (e.g., "qwen", "codex") via text input
- Support plan supplements and custom tool specification via "Other" input

**Three Questions in Single AskUserQuestion Call**:
- Question 1: Task confirmation (multi-select: Allow/Modify/Cancel)
- Question 2: Execution method selection (single-select: Agent/Codex/Auto)
- Question 3: Code review tool selection (single-select: Skip/Gemini/Agent, custom via "Other")

**AskUserQuestion Call**:
```javascript
AskUserQuestion({
  questions: [
    {
      question: `**Plan Summary**: ${planObject.summary}

**Tasks**: ${planObject.tasks.length} tasks | **Complexity**: ${planObject.complexity} | **Estimated Time**: ${planObject.estimated_time}

Confirm this plan? (Multi-select enabled - you can select multiple options and add supplements via "Other")`,
      header: "Confirm Plan",
      multiSelect: true,
      options: [
        { label: "Allow", description: "Proceed with plan as-is" },
        { label: "Modify", description: "Adjust plan before execution" },
        { label: "Cancel", description: "Abort workflow" }
      ]
    },
    {
      question: `Select execution method:`,
      header: "Execution",
      multiSelect: false,
      options: [
        { label: "Agent", description: "Execute with @code-developer agent" },
        { label: "Codex", description: "Execute with codex CLI tool" },
        { label: "Auto", description: `Auto-select: ${planObject.complexity === 'Low' ? 'Agent (Low complexity)' : 'Codex (Medium/High complexity)'}` }
      ]
    },
    {
      question: `Enable code review after execution?

(You can specify other tools like "qwen" or "codex" via "Other" option)`,
      header: "Code Review",
      multiSelect: false,
      options: [
        { label: "Gemini Review", description: "Review with Gemini CLI tool (gemini-2.5-pro)" },
        { label: "Agent Review", description: "Review with @code-reviewer agent" },
        { label: "Skip", description: "No review needed" }
      ]
    }
  ]
})
```

**Decision Flow**:
```
Task Confirmation (Multi-select):
  ├─ Allow (+ optional supplements in Other) → Proceed to Execution Method Selection
  ├─ Modify (+ optional supplements in Other) → Re-run Phase 3 with modifications
  └─ Cancel → Exit (no execution)

Execution Method Selection (Single-select):
  ├─ Agent → Launch @code-developer agent
  ├─ Codex → Execute with codex CLI tool
  └─ Auto → Automatic selection:
      ├─ If complexity = Low → Launch @code-developer agent
      └─ If complexity = Medium/High → Execute with codex CLI tool

Code Review Selection (after execution):
  ├─ Skip → Skip review, workflow complete
  ├─ Gemini Review → Run gemini code analysis (gemini-2.5-pro)
  ├─ Agent Review → Current Claude agent review
  └─ Other → Specify custom tool (e.g., "qwen", "codex") via text input
```

**Progress Tracking**:
- Mark Phase 4 as completed
- Mark Phase 5 as in_progress

**Expected Duration**: User-dependent (1-3 minutes typical)

---

### Phase 5: Execution & Progress Tracking

**Operations**:
- Create TodoWrite execution call list (grouped tasks by dependencies)
- Launch selected execution method (agent or CLI)
- Track execution call progress with real-time TodoWrite updates (not individual tasks)
- Display execution status to user

**Step 5.1: Create TodoWrite Execution List**

**Before execution starts**, initialize tracking variables and create execution call list:
```javascript
// Initialize result tracking for multi-execution scenarios
previousExecutionResults = []
```

Create execution call list (not individual tasks):
```javascript
// Group tasks based on dependencies and execution strategy
// Each execution call handles multiple related tasks
executionCalls = groupTasksByExecution(planObject.tasks, planObject.dependencies).map((call, index) => ({
  ...call,
  id: `[${call.method}-${index+1}]`  // Store ID for result collection
}))

TodoWrite({
  todos: executionCalls.map(call => ({
    content: `${call.id} (${call.taskSummary})`,
    status: "pending",
    activeForm: `Executing ${call.id} (${call.taskSummary})`
  }))
})
```

**Example Execution List**:
```
[ ] [Agent-1] (Implement auth service + Create JWT utilities)
[ ] [Agent-2] (Add middleware + Update routes)
[ ] [Codex-1] (Add integration tests for auth flow)
```

**Task Grouping Logic**:
- Parallel tasks → Single execution call
- Sequential tasks → Separate execution calls
- Complex tasks → May split into multiple calls based on file scope

**Step 5.2: Launch Execution**

**IMPORTANT**: CLI execution MUST run in foreground (no background execution)

**Execution Loop**:
```javascript
// Execute each call in the execution list sequentially
for (currentIndex = 0; currentIndex < executionCalls.length; currentIndex++) {
  const currentCall = executionCalls[currentIndex]

  // Update TodoWrite: mark current call as in_progress
  // Launch execution with previousExecutionResults context
  // After completion, collect result and add to previousExecutionResults
  // Update TodoWrite: mark current call as completed
}
```

Based on user selection in Phase 4, execute appropriate method:
- **Agent**: Launch @code-developer agent
- **Codex**: Execute with codex CLI tool
- **Auto**: Automatic selection based on complexity
  - Low complexity → Agent execution
  - Medium/High complexity → Codex execution

#### Option A: Direct Execution with Agent

**Operations**:
- Launch @code-developer agent with full plan context
- Agent receives exploration findings, clarifications, and task breakdown
- **For subsequent executions**: Include previous execution results to maintain context continuity
- Agent call format:
  ```javascript
  Task(
    subagent_type="code-developer",
    description="Implement planned tasks with progress tracking",
    prompt=`
    Implement the following tasks with TodoWrite progress updates:

    Summary: ${planObject.summary}

    Task Breakdown:
    ${planObject.tasks.map((t, i) => `${i+1}. ${t}`).join('\n')}

    ${planObject.dependencies ? `\nTask Dependencies:\n${planObject.dependencies.join('\n')}` : ''}

    ${previousExecutionResults ? `\n## Previous Execution Results\n${previousExecutionResults.map(result => `
[${result.executionId}] ${result.status}
Tasks handled: ${result.tasksSummary}
Completion status: ${result.completionSummary}
Key outputs: ${result.keyOutputs || 'See git diff for details'}
${result.notes ? `Notes: ${result.notes}` : ''}
    `).join('\n---\n')}` : ''}

    Implementation Approach:
    ${planObject.approach}

    Code Context:
    ${explorationContext || "No exploration performed"}

    ${clarificationContext ? `\nClarifications:\n${clarificationContext}` : ''}

    ${planObject.risks ? `\nRisks to Consider:\n${planObject.risks.join('\n')}` : ''}

    IMPORTANT Instructions:
    - **Context Continuity**: Review previous execution results above to understand what's already completed
    - **Build on Previous Work**: Ensure your work integrates with previously completed tasks
    - **Avoid Duplication**: Don't redo tasks that are already completed in previous executions
    - **Parallel Execution**: Identify independent tasks from dependencies field and execute them in parallel using multiple tool calls in a single message
    - **Dependency Respect**: Sequential tasks must wait for dependent tasks to complete before starting
    - **Intelligent Grouping**: Analyze task dependencies to determine parallel groups - tasks with no file conflicts or logical dependencies can run simultaneously
    - Test functionality as you go
    - Handle risks proactively

    Note: This agent call handles multiple tasks. TodoWrite tracking is managed at call level by orchestrator.
    `
  )
  ```

**Agent Responsibilities**:
- Each agent call handles multiple tasks (grouped by dependencies)
- Agent updates TodoWrite at **call level** (not individual task level)
- Mark execution call as in_progress when starting, completed when all assigned tasks finished

**Execution Result Collection** (for multi-execution scenarios):
- After each execution completes, collect result summary:
  ```javascript
  executionResult = {
    executionId: executionCalls[currentIndex].id, // e.g., "[Agent-1]", "[Codex-1]" from Step 5.1 TodoWrite list
    status: "completed" or "partial" or "failed",
    tasksSummary: "Brief description of tasks handled",
    completionSummary: "What was completed",
    keyOutputs: "Files created/modified, key changes",
    notes: "Any important context for next execution"
  }
  previousExecutionResults.push(executionResult)
  ```
- The `executionId` comes from the execution call ID created in Step 5.1 (format: `[Method-Index]`)
- Pass `previousExecutionResults` to subsequent executions for context continuity

#### Option B: CLI Execution (Codex)

**Operations**:
- Build codex CLI command with comprehensive context
- **For subsequent executions**: Include previous execution results summary
- Execute codex tool with write permissions
- Monitor CLI output and update TodoWrite based on progress indicators
- Parse CLI completion signals to mark tasks as done

**Command Format (Codex)** - Single execution with full context:
```bash
codex --full-auto exec "
TASK: ${planObject.summary}

## Task Breakdown
${planObject.tasks.map((t, i) => `${i+1}. ${t}`).join('\n')}

${planObject.dependencies ? `\n## Task Dependencies\n${planObject.dependencies.join('\n')}` : ''}

${previousExecutionResults ? `\n## Previous Execution Results\n${previousExecutionResults.map(result => `
[${result.executionId}] ${result.status}
Tasks: ${result.tasksSummary}
Status: ${result.completionSummary}
Outputs: ${result.keyOutputs || 'See git diff'}
${result.notes ? `Notes: ${result.notes}` : ''}
`).join('\n---\n')}

IMPORTANT: Review previous results above. Build on completed work. Avoid duplication.
` : ''}

## Implementation Approach
${planObject.approach}

## Code Context from Exploration
${explorationContext ? `
Project Structure: ${explorationContext.project_structure || 'Standard structure'}
Relevant Files: ${explorationContext.relevant_files?.join(', ') || 'TBD'}
Current Patterns: ${explorationContext.patterns || 'Follow existing conventions'}
Integration Points: ${explorationContext.dependencies || 'None specified'}
Constraints: ${explorationContext.constraints || 'None'}
` : 'No prior exploration - analyze codebase as needed'}

${clarificationContext ? `\n## User Clarifications\n${Object.entries(clarificationContext).map(([q, a]) => `${q}: ${a}`).join('\n')}` : ''}

${planObject.risks ? `\n## Risks to Handle\n${planObject.risks.join('\n')}` : ''}

## Execution Instructions
- Review previous execution results for context continuity
- Build on previous work, don't duplicate completed tasks
- Complete all assigned tasks in single execution
- Test functionality as you implement
- Handle identified risks proactively

Complexity: ${planObject.complexity}
" --skip-git-repo-check -s danger-full-access
```

**Note**: Avoid `resume --last` unless task is exceptionally complex or hits timeout. Optimize task breakdown for full completion in single execution.

**Execution Result Collection** (for multi-execution scenarios):
- After CLI execution completes, analyze output and collect result summary
- Extract key information: modified files, completion status, important notes
- Store in `previousExecutionResults` array for subsequent executions
- Result structure same as Agent execution (see Option A above)

**Execution with Progress Tracking**:
```javascript
// Launch CLI in foreground (NOT background)
bash_result = Bash(
  command=cli_command,
  timeout=600000  // 10 minutes
)

// Update TodoWrite when CLI execution call completes
// Mark execution call (e.g., "[Codex-1]") as completed when CLI finishes
// One CLI call may handle multiple tasks - track at call level, not task level
```

**CLI Progress Monitoring**:
- Monitor CLI execution at **call level** (not individual task level)
- Update TodoWrite when CLI execution call completes (all assigned tasks done)
- Provide real-time visibility of execution call progress to user

**Step 5.3: Track Execution Progress**

Track **agent/CLI call level** (not individual tasks):

**Real-time TodoWrite Updates**:
```javascript
// When execution call starts
TodoWrite({
  todos: [
    { content: "[Agent-1] (Implement auth service + Create JWT utilities)", status: "in_progress", activeForm: "Executing [Agent-1] (Implement auth service + Create JWT utilities)" },
    { content: "[Agent-2] (Add middleware + Update routes)", status: "pending", activeForm: "Executing [Agent-2] (Add middleware + Update routes)" },
    { content: "[Codex-1] (Add integration tests)", status: "pending", activeForm: "Executing [Codex-1] (Add integration tests)" }
  ]
})

// When execution call completes
TodoWrite({
  todos: [
    { content: "[Agent-1] (Implement auth service + Create JWT utilities)", status: "completed", activeForm: "Executing [Agent-1] (Implement auth service + Create JWT utilities)" },
    { content: "[Agent-2] (Add middleware + Update routes)", status: "in_progress", activeForm: "Executing [Agent-2] (Add middleware + Update routes)" },
    { content: "[Codex-1] (Add integration tests)", status: "pending", activeForm: "Executing [Codex-1] (Add integration tests)" }
  ]
})
```

**User Visibility**:
- User sees **execution call progress** (not individual task progress)
- Current execution highlighted as "in_progress" (e.g., "[Agent-1] (Task A + Task B)")
- Completed executions marked with checkmark
- Pending executions remain unchecked
- Each execution shows **task summary** for context

**Progress Tracking**:
- Track agent/CLI call completion (not task completion)
- One execution call may handle multiple tasks simultaneously
- Mark Phase 5 as completed when all execution calls done

**Step 5.4: Code Review (Optional)**

**Skip Condition**: Only run if user selected review tool in Phase 4 (not "Skip")

**Operations**:
- If "Agent Review": Current agent performs direct code review analysis
- If "Gemini Review": Execute gemini CLI with code review analysis prompt
- If "Other" (custom tool specified): Execute specified CLI tool (e.g., qwen, codex)
- Review all modified files from execution
- Generate quality assessment and improvement recommendations

**Command Format**:
```bash
# Agent Review: Direct agent review (no CLI command needed)
# Uses analysis prompt and TodoWrite tools directly

# Gemini Review / Custom Tool (qwen, codex, etc.): Execute analysis command
{selected_tool} -p "
PURPOSE: Code review for implemented changes
TASK: • Analyze code quality • Identify potential issues • Suggest improvements
MODE: analysis
CONTEXT: @**/* | Memory: Review changes from lite-plan execution
EXPECTED: Quality assessment with actionable recommendations
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/02-review-code-quality.txt) | Focus on recent changes | analysis=READ-ONLY
"
```

**Expected Duration**: Varies by task complexity and execution method
- Low complexity: 5-15 minutes
- Medium complexity: 15-45 minutes
- High complexity: 45-120 minutes
- Code review (if enabled): +2-5 minutes

---

## Best Practices

### Workflow Intelligence

1. **Dynamic Adaptation**: Workflow automatically adjusts based on task characteristics
   - Smart exploration: Only runs when task requires codebase context
   - Adaptive planning: Simple tasks get direct planning, complex tasks use specialized agent
   - Context-aware clarification: Only asks questions when truly needed
   - Reduces unnecessary steps while maintaining thoroughness
   - **Flag-Based Control**:
     - Use `-e` or `--explore` to force exploration when:
       - Task appears simple but you know it requires codebase context
       - Auto-detection might miss subtle integration points
       - You want comprehensive code understanding before planning

2. **Progressive Clarification**: Gather information at the right time
   - Phase 1: Explore codebase to understand current state
   - Phase 2: Ask clarifying questions based on exploration findings
   - Phase 3: Plan with complete context (task + exploration + clarifications)
   - Avoids premature assumptions and reduces rework

3. **Complexity-Aware Planning**: Planning strategy matches task complexity
   - Low complexity (1-2 files): Direct planning by current Claude (fast, 20-30s)
   - Medium complexity (3-5 files): CLI planning agent (detailed, 40-50s)
   - High complexity (6+ files): CLI planning agent with risk analysis (thorough, 50-60s)
   - Balances speed and thoroughness appropriately

4. **Two-Step Confirmation Process**: Clear plan presentation followed by comprehensive control
   - **Step 1**: Display complete plan as readable text output (not embedded in question)
     - Shows summary, approach, tasks, dependencies, risks, complexity, time estimate
     - Clear separation between plan content and user interaction
   - **Step 2**: Collect three-dimensional input via AskUserQuestion
     - First dimension: Confirm/Modify/Cancel plan (multi-select with supplement via "Other")
     - Second dimension: Execution method selection (Agent/Codex/Auto)
     - Third dimension: Code review tool selection (Skip/Gemini/Agent, custom via "Other")
   - Allows plan refinement without re-selecting execution method
   - Supports iterative planning with user feedback
   - Auto mode intelligently selects execution method based on complexity
   - Custom code review tools (qwen, codex, etc.) can be specified via "Other" option

### Task Management

1. **Live Progress Tracking**: TodoWrite provides real-time execution call visibility
   - Execution calls ([Agent-1], [Codex-1], etc.) created before execution starts
   - Updated in real-time as execution calls progress
   - User sees current execution call being worked on (e.g., "[Agent-1] (Task A + Task B)")
   - Each execution call shows task summary for context
   - Clear completion status at call level (not individual task level)

2. **Phase-Based Organization**: 5 distinct phases with clear transitions
   - Phase 1: Task Analysis & Exploration (automatic)
   - Phase 2: Clarification (conditional, interactive)
   - Phase 3: Planning (automatic, adaptive)
   - Phase 4: Confirmation (interactive, two-dimensional)
   - Phase 5: Execution & Tracking (automatic with live updates)

3. **Flexible Task Counts**: Task breakdown adapts to complexity
   - Low complexity: 3-5 tasks (focused)
   - Medium complexity: 5-7 tasks (detailed)
   - High complexity: 7-10 tasks (comprehensive)
   - Avoids artificial constraints while maintaining focus

4. **Dependency Tracking**: Medium/High complexity tasks include dependencies
   - Explicit task ordering when sequence matters
   - Parallel execution hints when tasks are independent
   - Risk flagging for complex interactions
   - Helps agent/CLI execute correctly

### Planning Standards

1. **Context-Rich Planning**: Plans include all relevant context
   - Exploration findings (code structure, patterns, constraints)
   - User clarifications (requirements, preferences, decisions)
   - Complexity assessment (risks, dependencies, time estimates)
   - Execution recommendations (Direct vs CLI, specific tool)

2. **Modification Support**: Plans can be iteratively refined
   - User can request plan modifications in Phase 4
   - Feedback incorporated into re-planning
   - No need to restart from scratch
   - Supports collaborative planning workflow

3. **No File Artifacts**: All planning stays in memory
   - Faster workflow without I/O overhead
   - Cleaner workspace
   - Plan context passed directly to execution
   - Reduces complexity and maintenance

## Error Handling

### Common Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| Phase 1 Exploration Failure | cli-explore-agent unavailable or timeout | Skip exploration, set `explorationContext = null`, log warning, continue to Phase 2/3 with task description only |
| Phase 2 Clarification Timeout | User no response > 5 minutes | Use exploration findings as-is without clarification, proceed to Phase 3 with warning |
| Phase 3 Planning Agent Failure | cli-planning-agent unavailable or timeout | Fallback to direct planning by current Claude (simplified plan), continue to Phase 4 |
| Phase 3 Planning Timeout | Planning takes > 90 seconds | Generate simplified direct plan, mark as "Quick Plan", continue to Phase 4 with reduced detail |
| Phase 4 Confirmation Timeout | User no response > 5 minutes | Save plan context to temporary var, display resume instructions, exit gracefully |
| Phase 4 Modification Loop | User requests modify > 3 times | Suggest breaking task into smaller pieces or using /workflow:plan for comprehensive planning |
| Phase 5 Codex Unavailable | Codex tool not installed | Show installation instructions, offer to re-select (Agent execution or Auto mode) |
| Phase 5 Execution Failure | Agent/Codex crashes or errors | Display error details, save partial progress from TodoWrite, suggest manual recovery or retry |

## Input/Output

### Input Requirements
- Task description: String or path to .md file (required)
  - Should be specific and concrete
  - Can include context about existing code or requirements
  - Examples:
    - "Implement user authentication with JWT tokens"
    - "Refactor logging module for better performance"
    - "Add unit tests for authentication service"
- Flags (optional):
  - `-e` or `--explore`: Force code exploration phase (overrides auto-detection)

### Output Format

**In-Memory Plan Object**:
```javascript
{
  summary: "2-3 sentence overview of implementation",
  approach: "High-level implementation strategy",
  tasks: [
    "Task 1: Specific action with file locations",
    "Task 2: Specific action with file locations",
    // ... 3-7 tasks total
  ],
  complexity: "Low|Medium|High",
  recommended_execution: "Agent|Codex",  // Based on complexity
  estimated_time: "X minutes"
}
```

**Execution Result**:
- Immediate dispatch to selected tool/agent with plan context
- No file artifacts generated during planning phase
- Execution starts immediately after user confirmation
- Tool/agent handles implementation and any necessary file operations

