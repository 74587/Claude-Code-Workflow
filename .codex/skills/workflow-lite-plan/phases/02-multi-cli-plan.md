# Phase 2: Multi-CLI Plan

## Auto Mode

When `--yes` or `-y`: Auto-approve plan, use recommended solution and execution method (Agent, Skip review).

## Overview

Multi-CLI collaborative planning with ACE context gathering and iterative cross-verification. Uses cli-discuss-agent for Gemini+Codex+Claude analysis to converge on optimal execution plan.

## Quick Start

**Parameters**:
- `<task-description>` (required): Task description
- `--max-rounds` (optional): Maximum discussion rounds (default: 3)
- `--tools` (optional): CLI tools for analysis (default: gemini,codex)
- `--mode` (optional): Execution mode: parallel or serial

**Context Source**: ACE semantic search + Multi-CLI analysis
**Output Directory**: `.workflow/.multi-cli-plan/{session-id}/`
**Default Max Rounds**: 3 (convergence may complete earlier)
**CLI Tools**: @cli-discuss-agent (analysis), @cli-lite-planning-agent (plan generation)
**Execution**: Auto-hands off to Phase 4: Lite Execute (phases/04-lite-execute.md) after plan approval

## What & Why

### Core Concept

Multi-CLI collaborative planning with **three-phase architecture**: ACE context gathering → Iterative multi-CLI discussion → Plan generation. Orchestrator delegates analysis to agents, only handles user decisions and session management.

**Process**:
- **Phase 1**: ACE semantic search gathers codebase context
- **Phase 2**: cli-discuss-agent orchestrates Gemini/Codex/Claude for cross-verified analysis
- **Phase 3-5**: User decision → Plan generation → Execution handoff

**vs Single-CLI Planning**:
- **Single**: One model perspective, potential blind spots
- **Multi-CLI**: Cross-verification catches inconsistencies, builds consensus on solutions

### Value Proposition

1. **Multi-Perspective Analysis**: Gemini + Codex + Claude analyze from different angles
2. **Cross-Verification**: Identify agreements/disagreements, build confidence
3. **User-Driven Decisions**: Every round ends with user decision point
4. **Iterative Convergence**: Progressive refinement until consensus reached

### Orchestrator Boundary (CRITICAL)

- **ONLY command** for multi-CLI collaborative planning
- Manages: Session state, user decisions, agent delegation, phase transitions
- Delegates: CLI execution to @cli-discuss-agent, plan generation to @cli-lite-planning-agent

### Execution Flow

```
Phase 1: Context Gathering
   └─ ACE semantic search, extract keywords, build context package

Phase 2: Multi-CLI Discussion (Iterative, via @cli-discuss-agent)
   ├─ Round N: Agent executes Gemini + Codex + Claude
   ├─ Cross-verify findings, synthesize solutions
   ├─ Write synthesis.json to rounds/{N}/
   └─ Loop until convergence or max rounds

Phase 3: Present Options
   └─ Display solutions with trade-offs from agent output

Phase 4: User Decision
   ├─ Select solution approach
   ├─ Select execution method (Agent/Codex/Auto)
   ├─ Select code review tool (Skip/Gemini/Codex/Agent)
   └─ Route:
      ├─ Approve → Phase 5
      ├─ Need More Analysis → Return to Phase 2
      └─ Cancel → Save session

Phase 5: Plan Generation & Execution Handoff
   ├─ Generate plan.json (via @cli-lite-planning-agent)
   ├─ Build executionContext with user selections
   └─ Hand off to Phase 4: Lite Execute (phases/04-lite-execute.md) --in-memory
```

### Agent Roles

| Agent | Responsibility |
|-------|---------------|
| **Orchestrator** | Session management, ACE context, user decisions, phase transitions, executionContext assembly |
| **@cli-discuss-agent** | Multi-CLI execution (Gemini/Codex/Claude), cross-verification, solution synthesis, synthesis.json output |
| **@cli-lite-planning-agent** | Task decomposition, plan.json generation following schema |

## Core Responsibilities

### Phase 1: Context Gathering

**Session Initialization**:
```javascript
const sessionId = `MCP-${taskSlug}-${date}`
const sessionFolder = `.workflow/.multi-cli-plan/${sessionId}`
Bash(`mkdir -p ${sessionFolder}/rounds`)
```

**ACE Context Queries**:
```javascript
const aceQueries = [
  `Project architecture related to ${keywords}`,
  `Existing implementations of ${keywords[0]}`,
  `Code patterns for ${keywords} features`,
  `Integration points for ${keywords[0]}`
]
// Execute via mcp__ace-tool__search_context
```

**Context Package** (passed to agent):
- `relevant_files[]` - Files identified by ACE
- `detected_patterns[]` - Code patterns found
- `architecture_insights` - Structure understanding

### Phase 2: Agent Delegation

**Core Principle**: Orchestrator only delegates and reads output - NO direct CLI execution.

**⚠️ CRITICAL - CLI EXECUTION REQUIREMENT**:
- **MUST** execute CLI calls via `Bash` with `run_in_background: true`
- **MUST** wait for hook callback to receive complete results
- **MUST NOT** proceed with next phase until CLI execution fully completes
- Do NOT use `TaskOutput` polling during CLI execution - wait passively for results
- Minimize scope: Proceed only when 100% result available

**Agent Invocation** (Codex subagent pattern):
```javascript
// Step 1: Create discussion agent
const discussAgentId = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/cli-discuss-agent.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

## Input Context
- task_description: ${taskDescription}
- round_number: ${currentRound}
- session: { id: "${sessionId}", folder: "${sessionFolder}" }
- ace_context: ${JSON.stringify(contextPackage)}
- previous_rounds: ${JSON.stringify(analysisResults)}
- user_feedback: ${userFeedback || 'None'}
- cli_config: { tools: ["gemini", "codex"], mode: "parallel", fallback_chain: ["gemini", "codex", "claude"] }

## Execution Process
1. Parse input context (handle JSON strings)
2. Check if ACE supplementary search needed
3. Build CLI prompts with context
4. Execute CLIs (parallel or serial per cli_config.mode)
5. Parse CLI outputs, handle failures with fallback
6. Perform cross-verification between CLI results
7. Synthesize solutions, calculate scores
8. Calculate convergence, generate clarification questions
9. Write synthesis.json

## Output
Write: ${sessionFolder}/rounds/${currentRound}/synthesis.json

## Completion Checklist
- [ ] All configured CLI tools executed (or fallback triggered)
- [ ] Cross-verification completed with agreements/disagreements
- [ ] 2-3 solutions generated with file:line references
- [ ] Convergence score calculated (0.0-1.0)
- [ ] synthesis.json written with all Primary Fields
`
})

// Step 2: Wait for discussion completion
const discussResult = wait({
  ids: [discussAgentId],
  timeout_ms: 600000  // 10 minutes
})

// Step 3: Close discussion agent
close_agent({ id: discussAgentId })
```

**Read Agent Output**:
```javascript
const synthesis = JSON.parse(Read(`${sessionFolder}/rounds/${round}/synthesis.json`))
// Access top-level fields: solutions, convergence, cross_verification, clarification_questions
```

**Convergence Decision**:
```javascript
if (synthesis.convergence.recommendation === 'converged') {
  // Proceed to Phase 3
} else if (synthesis.convergence.recommendation === 'user_input_needed') {
  // Collect user feedback, return to Phase 2
} else {
  // Continue to next round if new_insights && round < maxRounds
}
```

### Phase 3: Present Options

**Display from Agent Output** (no processing):
```javascript
console.log(`
## Solution Options

${synthesis.solutions.map((s, i) => `
**Option ${i+1}: ${s.name}**
Source: ${s.source_cli.join(' + ')}
Effort: ${s.effort} | Risk: ${s.risk}

Pros: ${s.pros.join(', ')}
Cons: ${s.cons.join(', ')}

Files: ${s.affected_files.slice(0,3).map(f => `${f.file}:${f.line}`).join(', ')}
`).join('\n')}

## Cross-Verification
Agreements: ${synthesis.cross_verification.agreements.length}
Disagreements: ${synthesis.cross_verification.disagreements.length}
`)
```

### Phase 4: User Decision

**Decision Options**:
```javascript
AskUserQuestion({
  questions: [
    {
      question: "Which solution approach?",
      header: "Solution",
      multiSelect: false,
      options: solutions.map((s, i) => ({
        label: `Option ${i+1}: ${s.name}`,
        description: `${s.effort} effort, ${s.risk} risk`
      })).concat([
        { label: "Need More Analysis", description: "Return to Phase 2" }
      ])
    },
    {
      question: "Execution method:",
      header: "Execution",
      multiSelect: false,
      options: [
        { label: "Agent", description: "@code-developer agent" },
        { label: "Codex", description: "codex CLI tool" },
        { label: "Auto", description: "Auto-select based on complexity" }
      ]
    },
    {
      question: "Code review after execution?",
      header: "Review",
      multiSelect: false,
      options: [
        { label: "Skip", description: "No review" },
        { label: "Gemini Review", description: "Gemini CLI tool" },
        { label: "Codex Review", description: "codex review --uncommitted" },
        { label: "Agent Review", description: "Current agent review" }
      ]
    }
  ]
})
```

**Routing**:
- Approve + execution method → Phase 5
- Need More Analysis → Phase 2 with feedback
- Cancel → Save session for resumption

### Phase 5: Plan Generation & Execution Handoff

**Step 1: Build Context-Package** (Orchestrator responsibility):
```javascript
// Extract key information from user decision and synthesis
const contextPackage = {
  // Core solution details
  solution: {
    name: selectedSolution.name,
    source_cli: selectedSolution.source_cli,
    feasibility: selectedSolution.feasibility,
    effort: selectedSolution.effort,
    risk: selectedSolution.risk,
    summary: selectedSolution.summary
  },
  // Implementation plan (tasks, flow, milestones)
  implementation_plan: selectedSolution.implementation_plan,
  // Dependencies
  dependencies: selectedSolution.dependencies || { internal: [], external: [] },
  // Technical concerns
  technical_concerns: selectedSolution.technical_concerns || [],
  // Consensus from cross-verification
  consensus: {
    agreements: synthesis.cross_verification.agreements,
    resolved_conflicts: synthesis.cross_verification.resolution
  },
  // User constraints (from Phase 4 feedback)
  constraints: userConstraints || [],
  // Task context
  task_description: taskDescription,
  session_id: sessionId
}

// Write context-package for traceability
Write(`${sessionFolder}/context-package.json`, JSON.stringify(contextPackage, null, 2))
```

**Step 2: Invoke Planning Agent** (Codex subagent pattern):
```javascript
// Step 1: Create planning agent
const planningAgentId = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/cli-lite-planning-agent.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

## Schema Reference
Execute: cat ~/.claude/workflows/cli-templates/schemas/plan-json-schema.json

## Context-Package (from orchestrator)
${JSON.stringify(contextPackage, null, 2)}

## Execution Process
1. Read plan-json-schema.json for output structure
2. Read project-tech.json and project-guidelines.json
3. Parse context-package fields:
   - solution: name, feasibility, summary
   - implementation_plan: tasks[], execution_flow, milestones
   - dependencies: internal[], external[]
   - technical_concerns: risks/blockers
   - consensus: agreements, resolved_conflicts
   - constraints: user requirements
4. Use implementation_plan.tasks[] as task foundation
5. Preserve task dependencies (depends_on) and execution_flow
6. Expand tasks with detailed acceptance criteria
7. Generate plan.json following schema exactly

## Output
- ${sessionFolder}/plan.json

## Completion Checklist
- [ ] plan.json preserves task dependencies from implementation_plan
- [ ] Task execution order follows execution_flow
- [ ] Key_points reflected in task descriptions
- [ ] User constraints applied to implementation
- [ ] Acceptance criteria are testable
- [ ] Schema fields match plan-json-schema.json exactly
`
})

// Step 2: Wait for planning completion
const planResult = wait({
  ids: [planningAgentId],
  timeout_ms: 900000  // 15 minutes
})

// Step 3: Close planning agent
close_agent({ id: planningAgentId })
```

**Step 3: Build executionContext**:
```javascript
// After plan.json is generated by cli-lite-planning-agent
const plan = JSON.parse(Read(`${sessionFolder}/plan.json`))

// Build executionContext (same structure as lite-plan)
executionContext = {
  planObject: plan,
  explorationsContext: null,  // Multi-CLI doesn't use exploration files
  explorationAngles: [],      // No exploration angles
  explorationManifest: null,  // No manifest
  clarificationContext: null,  // Store user feedback from Phase 2 if exists
  executionMethod: userSelection.execution_method,  // From Phase 4
  codeReviewTool: userSelection.code_review_tool,   // From Phase 4
  originalUserInput: taskDescription,

  // Optional: Task-level executor assignments
  executorAssignments: null,  // Could be enhanced in future

  session: {
    id: sessionId,
    folder: sessionFolder,
    artifacts: {
      explorations: [],  // No explorations in multi-CLI workflow
      explorations_manifest: null,
      plan: `${sessionFolder}/plan.json`,
      synthesis_rounds: Array.from({length: currentRound}, (_, i) =>
        `${sessionFolder}/rounds/${i+1}/synthesis.json`
      ),
      context_package: `${sessionFolder}/context-package.json`
    }
  }
}
```

**Step 4: Hand off to Execution**:
```javascript
// Hand off to Phase 4: Lite Execute (phases/04-lite-execute.md) with in-memory context
// executionContext is passed in-memory to the execution phase
```

## Output File Structure

```
.workflow/.multi-cli-plan/{MCP-task-slug-YYYY-MM-DD}/
├── session-state.json          # Session tracking (orchestrator)
├── rounds/
│   ├── 1/synthesis.json        # Round 1 analysis (cli-discuss-agent)
│   ├── 2/synthesis.json        # Round 2 analysis (cli-discuss-agent)
│   └── .../
├── context-package.json        # Extracted context for planning (orchestrator)
└── plan.json                   # Structured plan (cli-lite-planning-agent)
```

**File Producers**:

| File | Producer | Content |
|------|----------|---------|
| `session-state.json` | Orchestrator | Session metadata, rounds, decisions |
| `rounds/*/synthesis.json` | cli-discuss-agent | Solutions, convergence, cross-verification |
| `context-package.json` | Orchestrator | Extracted solution, dependencies, consensus for planning |
| `plan.json` | cli-lite-planning-agent | Structured tasks for lite-execute |

## synthesis.json Schema

```json
{
  "round": 1,
  "solutions": [{
    "name": "Solution Name",
    "source_cli": ["gemini", "codex"],
    "feasibility": 0.85,
    "effort": "low|medium|high",
    "risk": "low|medium|high",
    "summary": "Brief analysis summary",
    "implementation_plan": {
      "approach": "High-level technical approach",
      "tasks": [
        {"id": "T1", "name": "Task", "depends_on": [], "files": [], "key_point": "..."}
      ],
      "execution_flow": "T1 → T2 → T3",
      "milestones": ["Checkpoint 1", "Checkpoint 2"]
    },
    "dependencies": {"internal": [], "external": []},
    "technical_concerns": ["Risk 1", "Blocker 2"]
  }],
  "convergence": {
    "score": 0.85,
    "new_insights": false,
    "recommendation": "converged|continue|user_input_needed"
  },
  "cross_verification": {
    "agreements": [],
    "disagreements": [],
    "resolution": "..."
  },
  "clarification_questions": []
}
```

**Key Planning Fields**:

| Field | Purpose |
|-------|---------|
| `feasibility` | Viability score (0-1) |
| `implementation_plan.tasks[]` | Discrete tasks with dependencies |
| `implementation_plan.execution_flow` | Task sequence visualization |
| `implementation_plan.milestones` | Key checkpoints |
| `technical_concerns` | Risks and blockers |

**Note**: Solutions ranked by internal scoring (array order = priority)

## TodoWrite Structure

**Initialization**:
```javascript
TodoWrite({ todos: [
  { content: "Phase 1: Context Gathering", status: "in_progress", activeForm: "Gathering context" },
  { content: "Phase 2: Multi-CLI Discussion", status: "pending", activeForm: "Running discussion" },
  { content: "Phase 3: Present Options", status: "pending", activeForm: "Presenting options" },
  { content: "Phase 4: User Decision", status: "pending", activeForm: "Awaiting decision" },
  { content: "Phase 5: Plan Generation", status: "pending", activeForm: "Generating plan" }
]})
```

**During Discussion Rounds**:
```javascript
TodoWrite({ todos: [
  { content: "Phase 1: Context Gathering", status: "completed", activeForm: "Gathering context" },
  { content: "Phase 2: Multi-CLI Discussion", status: "in_progress", activeForm: "Running discussion" },
  { content: "  → Round 1: Initial analysis", status: "completed", activeForm: "Analyzing" },
  { content: "  → Round 2: Deep verification", status: "in_progress", activeForm: "Verifying" },
  { content: "Phase 3: Present Options", status: "pending", activeForm: "Presenting options" },
  // ...
]})
```

## Error Handling

| Error | Resolution |
|-------|------------|
| ACE search fails | Fall back to Glob/Grep for file discovery |
| Agent fails | Retry once, then present partial results |
| CLI timeout (in agent) | Agent uses fallback: gemini → codex → claude |
| No convergence | Present best options, flag uncertainty |
| synthesis.json parse error | Request agent retry |
| User cancels | Save session for later resumption |

## Configuration

| Flag | Default | Description |
|------|---------|-------------|
| `--max-rounds` | 3 | Maximum discussion rounds |
| `--tools` | gemini,codex | CLI tools for analysis |
| `--mode` | parallel | Execution mode: parallel or serial |
| `--auto-execute` | false | Auto-execute after approval |

## Best Practices

1. **Be Specific**: Detailed task descriptions improve ACE context quality
2. **Provide Feedback**: Use clarification rounds to refine requirements
3. **Trust Cross-Verification**: Multi-CLI consensus indicates high confidence
4. **Review Trade-offs**: Consider pros/cons before selecting solution
5. **Check synthesis.json**: Review agent output for detailed analysis
6. **Iterate When Needed**: Don't hesitate to request more analysis

## Related Phases

- Simpler single-round planning: [Phase 1: Lite Plan](01-lite-plan.md)
- Shared execution engine: [Phase 4: Lite Execute](04-lite-execute.md)
- Full planning workflow: [workflow-plan/SKILL.md](../../workflow-plan/SKILL.md)

---

## Post-Phase Update

After Phase 2 (Multi-CLI Plan) completes:
- **Output Created**: `executionContext` with plan.json, synthesis rounds, context-package, user selections
- **Session Artifacts**: All files in `.workflow/.multi-cli-plan/{session-id}/`
- **Next Action**: Auto-continue to [Phase 4: Lite Execute](04-lite-execute.md) with --in-memory
- **TodoWrite**: Mark "Multi-CLI Plan - Planning" as completed, start "Execution (Phase 4)"
