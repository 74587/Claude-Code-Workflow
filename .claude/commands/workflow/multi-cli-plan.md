---
name: workflow:multi-cli-plan
description: Multi-CLI collaborative planning workflow with ACE context gathering and iterative cross-verification. Uses cli-discuss-agent for Gemini+Codex+Claude analysis to converge on optimal execution plan.
argument-hint: "<task description> [--max-rounds=3] [--tools=gemini,codex] [--mode=parallel|serial]"
allowed-tools: TodoWrite(*), Task(*), AskUserQuestion(*), Read(*), Bash(*), Write(*), mcp__ace-tool__search_context(*)
---

# Multi-CLI Collaborative Planning Command

## Quick Start

```bash
# Basic usage
/workflow:multi-cli-plan "Implement user authentication"

# With options
/workflow:multi-cli-plan "Add dark mode support" --max-rounds=3
/workflow:multi-cli-plan "Refactor payment module" --tools=gemini,codex,claude
/workflow:multi-cli-plan "Fix memory leak" --mode=serial

# Resume session
/workflow:lite-execute --session=MCP-xxx
```

**Context Source**: ACE semantic search + Multi-CLI analysis
**Output Directory**: `.workflow/.multi-cli-plan/{session-id}/`
**Default Max Rounds**: 3 (convergence may complete earlier)
**CLI Tools**: @cli-discuss-agent (analysis), @cli-lite-planning-agent (plan generation)

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
   ├─ Approve solution → Phase 5
   ├─ Need clarification → Return to Phase 2
   └─ Change direction → Reset with feedback

Phase 5: Plan Generation (via @cli-lite-planning-agent)
   ├─ Generate IMPL_PLAN.md + plan.json
   └─ Hand off to /workflow:lite-execute
```

### Agent Roles

| Agent | Responsibility |
|-------|---------------|
| **Orchestrator** | Session management, ACE context, user decisions, phase transitions |
| **@cli-discuss-agent** | Multi-CLI execution (Gemini/Codex/Claude), cross-verification, solution synthesis, synthesis.json output |
| **@cli-lite-planning-agent** | Task decomposition, IMPL_PLAN.md + plan.json generation |

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

**Agent Invocation**:
```javascript
Task({
  subagent_type: "cli-discuss-agent",
  run_in_background: false,
  description: `Discussion round ${currentRound}`,
  prompt: `
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
  questions: [{
    question: "Which solution approach?",
    header: "Solution",
    options: solutions.map((s, i) => ({
      label: `Option ${i+1}: ${s.name}`,
      description: `${s.effort} effort, ${s.risk} risk`
    })).concat([
      { label: "Need More Analysis", description: "Return to Phase 2" }
    ])
  }]
})
```

**Routing**:
- Approve → Phase 5
- Need More Analysis → Phase 2 with feedback
- Add constraints → Collect details, then Phase 5

### Phase 5: Plan Generation

**Invoke Planning Agent**:
```javascript
Task({
  subagent_type: "cli-lite-planning-agent",
  run_in_background: false,
  description: "Generate implementation plan",
  prompt: `
## Schema Reference
Execute: cat ~/.claude/workflows/cli-templates/schemas/plan-json-schema.json

## Selected Solution
${JSON.stringify(selectedSolution)}

## Analysis Consensus
${synthesis.cross_verification.agreements.join('\n')}

## Execution Process
1. Read plan-json-schema.json for output structure
2. Read project-tech.json and project-guidelines.json
3. Decompose solution into 2-7 tasks (group by feature, not file)
4. Assign dependencies and execution groups
5. Generate IMPL_PLAN.md with step-by-step documentation
6. Generate plan.json following schema exactly

## Output
- ${sessionFolder}/IMPL_PLAN.md
- ${sessionFolder}/plan.json

## Completion Checklist
- [ ] IMPL_PLAN.md written with complete documentation
- [ ] plan.json follows schema exactly
- [ ] All affected files have line numbers
- [ ] Tasks grouped by feature (not one per file)
- [ ] Acceptance criteria are testable
`
})
```

**Hand off to Execution**:
```javascript
if (userConfirms) {
  SlashCommand("/workflow:lite-execute --in-memory")
}
```

## Output File Structure

```
.workflow/.multi-cli-plan/{MCP-task-slug-YYYY-MM-DD}/
├── session-state.json          # Session tracking (orchestrator)
├── rounds/
│   ├── 1/synthesis.json        # Round 1 analysis (cli-discuss-agent)
│   ├── 2/synthesis.json        # Round 2 analysis (cli-discuss-agent)
│   └── .../
├── IMPL_PLAN.md                # Documentation (cli-lite-planning-agent)
└── plan.json                   # Structured plan (cli-lite-planning-agent)
```

**File Producers**:

| File | Producer | Content |
|------|----------|---------|
| `session-state.json` | Orchestrator | Session metadata, rounds, decisions |
| `rounds/*/synthesis.json` | cli-discuss-agent | Solutions, convergence, cross-verification |
| `IMPL_PLAN.md` | cli-lite-planning-agent | Human-readable plan |
| `plan.json` | cli-lite-planning-agent | Structured tasks for execution |

## synthesis.json Schema

**Primary Fields** (orchestrator reads these):
```json
{
  "round": 1,
  "solutions": [{
    "name": "Solution Name",
    "description": "What this does",
    "source_cli": ["gemini", "codex"],
    "pros": [], "cons": [],
    "effort": "low|medium|high",
    "risk": "low|medium|high",
    "affected_files": [{"file": "path", "line": 10, "reason": "why"}]
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

**Extended Fields** (for visualization): `metadata`, `discussionTopic`, `relatedFiles`, `planning`, `decision`, `decisionRecords`

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

## Related Commands

```bash
# Resume saved session
/workflow:lite-execute --session=MCP-xxx

# Simpler single-round planning
/workflow:lite-plan "task description"

# Issue-driven discovery
/issue:discover-by-prompt "find issues"

# View session files
cat .workflow/.multi-cli-plan/{session-id}/IMPL_PLAN.md
cat .workflow/.multi-cli-plan/{session-id}/rounds/1/synthesis.json
```
