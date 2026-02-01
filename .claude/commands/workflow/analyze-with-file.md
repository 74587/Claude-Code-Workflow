---
name: analyze-with-file
description: Interactive collaborative analysis with documented discussions, CLI-assisted exploration, and evolving understanding
argument-hint: "[-y|--yes] [-c|--continue] \"topic or question\""
allowed-tools: TodoWrite(*), Task(*), AskUserQuestion(*), Read(*), Grep(*), Glob(*), Bash(*), Edit(*), Write(*)
---

## Auto Mode

When `--yes` or `-y`: Auto-confirm exploration decisions, use recommended analysis angles.

# Workflow Analyze Command

## Quick Start

```bash
# Basic usage
/workflow:analyze-with-file "如何优化这个项目的认证架构"

# With options
/workflow:analyze-with-file --continue "认证架构"    # Continue existing session
/workflow:analyze-with-file -y "性能瓶颈分析"        # Auto mode
```

**Context Source**: cli-explore-agent + Gemini/Codex analysis
**Output Directory**: `.workflow/.analysis/{session-id}/`
**Core Innovation**: Documented discussion timeline with evolving understanding

## Output Artifacts

### Phase 1: Topic Understanding

| Artifact | Description |
|----------|-------------|
| `discussion.md` | Evolution of understanding & discussions (initialized) |
| Session variables | Dimensions, focus areas, analysis depth |

### Phase 2: CLI Exploration

| Artifact | Description |
|----------|-------------|
| `exploration-codebase.json` | Codebase context from cli-explore-agent |
| `explorations.json` | Aggregated CLI findings (Gemini/Codex) |
| Updated `discussion.md` | Round 1 with exploration results |

### Phase 3: Interactive Discussion

| Artifact | Description |
|----------|-------------|
| Updated `discussion.md` | Round 2-N with user feedback and insights |
| Corrected assumptions | Tracked in discussion timeline |

### Phase 4: Synthesis & Conclusion

| Artifact | Description |
|----------|-------------|
| `conclusions.json` | Final synthesis with recommendations |
| Final `discussion.md` | ⭐ Complete analysis with conclusions |

## Overview

Interactive collaborative analysis workflow with **documented discussion process**. Records understanding evolution, facilitates multi-round Q&A, and uses CLI tools for deep exploration.

**Core workflow**: Topic → Explore → Discuss → Document → Refine → Conclude

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    INTERACTIVE ANALYSIS WORKFLOW                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Phase 1: Topic Understanding                                            │
│     ├─ Parse topic/question                                              │
│     ├─ Identify analysis dimensions (architecture, performance, etc.)    │
│     ├─ Initial scoping with user                                         │
│     └─ Initialize discussion.md                                          │
│                                                                          │
│  Phase 2: CLI Exploration                                                │
│     ├─ cli-explore-agent: Codebase context (FIRST)                       │
│     ├─ Gemini/Codex: Deep analysis (AFTER exploration)                   │
│     ├─ Aggregate findings                                                │
│     └─ Update discussion.md with Round 1                                 │
│                                                                          │
│  Phase 3: Interactive Discussion (Multi-Round)                           │
│     ├─ Present exploration findings                                      │
│     ├─ Facilitate Q&A with user                                          │
│     ├─ Capture user insights and corrections                             │
│     ├─ Actions: Deepen | Adjust direction | Answer questions             │
│     ├─ Update discussion.md with each round                              │
│     └─ Repeat until clarity achieved (max 5 rounds)                      │
│                                                                          │
│  Phase 4: Synthesis & Conclusion                                         │
│     ├─ Consolidate all insights                                          │
│     ├─ Generate conclusions with recommendations                         │
│     ├─ Update discussion.md with final synthesis                         │
│     └─ Offer follow-up options (issue/task/report)                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Output Structure

```
.workflow/.analysis/ANL-{slug}-{date}/
├── discussion.md              # ⭐ Evolution of understanding & discussions
├── exploration-codebase.json  # Phase 2: Codebase context
├── explorations.json          # Phase 2: Aggregated CLI findings
└── conclusions.json           # Phase 4: Final synthesis
```

## Implementation

### Session Initialization

**Objective**: Create session context and directory structure for analysis.

**Required Actions**:
1. Extract topic/question from `$ARGUMENTS`
2. Generate session ID: `ANL-{slug}-{date}`
   - slug: lowercase, alphanumeric + Chinese, max 40 chars
   - date: YYYY-MM-DD (UTC+8)
3. Define session folder: `.workflow/.analysis/{session-id}`
4. Parse command options:
   - `-c` or `--continue` for session continuation
   - `-y` or `--yes` for auto-approval mode
5. Auto-detect mode: If session folder + discussion.md exist → continue mode
6. Create directory structure: `{session-folder}/`

**Session Variables**:
- `sessionId`: Unique session identifier
- `sessionFolder`: Base directory for all artifacts
- `autoMode`: Boolean for auto-confirmation
- `mode`: new | continue

### Phase 1: Topic Understanding

**Objective**: Analyze topic, identify dimensions, gather user input, initialize discussion.md.

**Prerequisites**:
- Session initialized with valid sessionId and sessionFolder
- Topic/question available from $ARGUMENTS

**Workflow Steps**:

1. **Parse Topic & Identify Dimensions**
   - Match topic keywords against ANALYSIS_DIMENSIONS
   - Identify relevant dimensions: architecture, implementation, performance, security, concept, comparison, decision
   - Default to "general" if no match

2. **Initial Scoping** (if new session + not auto mode)
   - **Focus**: Multi-select from code implementation, architecture design, best practices, problem diagnosis
   - **Depth**: Single-select from Quick Overview (10-15min) / Standard Analysis (30-60min) / Deep Dive (1-2hr)

3. **Initialize discussion.md**
   - Create discussion.md with session metadata
   - Add user context: focus areas, analysis depth
   - Add initial understanding: dimensions, scope, key questions
   - Create empty sections for discussion timeline

**Success Criteria**:
- Session folder created with discussion.md initialized
- Analysis dimensions identified
- User preferences captured (focus, depth)

### Phase 2: CLI Exploration

**Objective**: Gather codebase context, then execute deep analysis via CLI tools.

**Prerequisites**:
- Phase 1 completed successfully
- discussion.md initialized
- Dimensions identified

**Workflow Steps**:

1. **Primary Codebase Exploration via cli-explore-agent** (⚠️ FIRST)
   - Agent type: `cli-explore-agent`
   - Execution mode: synchronous (run_in_background: false)
   - **Tasks**:
     - Run: `ccw tool exec get_modules_by_depth '{}'`
     - Execute searches based on topic keywords
     - Read: `.workflow/project-tech.json` if exists
   - **Output**: `{sessionFolder}/exploration-codebase.json`
     - relevant_files: [{path, relevance, rationale}]
     - patterns: []
     - key_findings: []
     - questions_for_user: []
   - **Purpose**: Enrich CLI prompts with codebase context

**Agent Call Example**:
```javascript
Task({
  subagent_type: "cli-explore-agent",
  run_in_background: false,
  description: `Explore codebase: ${topicSlug}`,
  prompt: `
## Analysis Context
Topic: ${topic_or_question}
Dimensions: ${dimensions.join(', ')}
Session: ${sessionFolder}

## MANDATORY FIRST STEPS
1. Run: ccw tool exec get_modules_by_depth '{}'
2. Execute relevant searches based on topic keywords
3. Read: .workflow/project-tech.json (if exists)

## Exploration Focus
${dimensions.map(d => `- ${d}: Identify relevant code patterns and structures`).join('\n')}

## Output
Write findings to: ${sessionFolder}/exploration-codebase.json

Schema:
{
  "relevant_files": [{"path": "...", "relevance": "high|medium|low", "rationale": "..."}],
  "patterns": [],
  "key_findings": [],
  "questions_for_user": [],
  "_metadata": { "exploration_type": "codebase", "timestamp": "..." }
}
`
})
```

2. **CLI Deep Analysis** (⚠️ AFTER exploration)
   - Launch Gemini CLI with analysis mode
   - **Shared context**: Include exploration-codebase.json findings in prompt
   - **Execution**: Bash with run_in_background: true, wait for results
   - **Output**: Analysis findings with insights and discussion points

**CLI Call Example**:
```javascript
Bash({
  command: `ccw cli -p "
PURPOSE: Analyze topic '${topic_or_question}' from ${dimensions.join(', ')} perspectives
Success: Actionable insights with clear reasoning

PRIOR EXPLORATION CONTEXT:
- Key files: ${explorationResults.relevant_files.slice(0,5).map(f => f.path).join(', ')}
- Patterns found: ${explorationResults.patterns.slice(0,3).join(', ')}
- Key findings: ${explorationResults.key_findings.slice(0,3).join(', ')}

TASK:
• Build on exploration findings above
• Analyze common patterns and anti-patterns
• Highlight potential issues or opportunities
• Generate discussion points for user clarification

MODE: analysis

CONTEXT: @**/* | Topic: ${topic_or_question}

EXPECTED:
- Structured analysis with clear sections
- Specific insights tied to evidence
- Questions to deepen understanding
- Recommendations with rationale

CONSTRAINTS: Focus on ${dimensions.join(', ')}
" --tool gemini --mode analysis`,
  run_in_background: true
})

// ⚠️ STOP POINT: Wait for hook callback to receive results before continuing
```

3. **Aggregate Findings**
   - Consolidate codebase and CLI findings
   - Extract key findings, discussion points, open questions
   - Write to explorations.json

4. **Update discussion.md**
   - Append Round 1 section with exploration results
   - Include sources analyzed, key findings, discussion points, open questions

**explorations.json Schema**:
- `session_id`: Session identifier
- `timestamp`: Exploration completion time
- `topic`: Original topic/question
- `dimensions[]`: Analysis dimensions
- `sources[]`: {type, file/summary}
- `key_findings[]`: Main insights
- `discussion_points[]`: Questions for user
- `open_questions[]`: Unresolved questions

**Success Criteria**:
- exploration-codebase.json created with codebase context
- explorations.json created with aggregated findings
- discussion.md updated with Round 1 results
- All CLI calls completed successfully

### Phase 3: Interactive Discussion

**Objective**: Iteratively refine understanding through user-guided discussion cycles.

**Prerequisites**:
- Phase 2 completed successfully
- explorations.json contains initial findings
- discussion.md has Round 1 results

**Workflow Steps**:

1. **Present Findings**
   - Display current findings from explorations.json
   - Show key points for user input

2. **Gather User Feedback** (AskUserQuestion)
   - **Question**: Feedback on current analysis
   - **Options** (single-select):
     - **同意，继续深入**: Analysis direction correct, deepen exploration
     - **需要调整方向**: Different understanding or focus
     - **分析完成**: Sufficient information obtained
     - **有具体问题**: Specific questions to ask

3. **Process User Response**

   **Agree, Deepen**:
   - Continue analysis in current direction
   - Use CLI for deeper exploration

   **Adjust Direction**:
   - AskUserQuestion for adjusted focus (code details / architecture / best practices)
   - Launch new CLI exploration with adjusted scope

   **Specific Questions**:
   - Capture user questions
   - Use CLI or direct analysis to answer
   - Document Q&A in discussion.md

   **Complete**:
   - Exit discussion loop, proceed to Phase 4

4. **Update discussion.md**
   - Append Round N section with:
     - User input summary
     - Direction adjustment (if any)
     - User questions & answers (if any)
     - Updated understanding
     - Corrected assumptions
     - New insights

5. **Repeat or Converge**
   - Continue loop (max 5 rounds) or exit to Phase 4

**Discussion Actions**:

| User Choice | Action | Tool | Description |
|-------------|--------|------|-------------|
| Deepen | Continue current direction | Gemini CLI | Deeper analysis in same focus |
| Adjust | Change analysis angle | Selected CLI | New exploration with adjusted scope |
| Questions | Answer specific questions | CLI or analysis | Address user inquiries |
| Complete | Exit discussion loop | - | Proceed to synthesis |

**Success Criteria**:
- User feedback processed for each round
- discussion.md updated with all discussion rounds
- Assumptions corrected and documented
- Exit condition reached (user selects "完成" or max rounds)

### Phase 4: Synthesis & Conclusion

**Objective**: Consolidate insights, generate conclusions, offer next steps.

**Prerequisites**:
- Phase 3 completed successfully
- Multiple rounds of discussion documented
- User ready to conclude

**Workflow Steps**:

1. **Consolidate Insights**
   - Extract all findings from discussion timeline
   - **Key conclusions**: Main points with evidence and confidence levels (high/medium/low)
   - **Recommendations**: Action items with rationale and priority (high/medium/low)
   - **Open questions**: Remaining unresolved questions
   - **Follow-up suggestions**: Issue/task creation suggestions
   - Write to conclusions.json

2. **Final discussion.md Update**
   - Append conclusions section:
     - **Summary**: High-level overview
     - **Key Conclusions**: Ranked with evidence and confidence
     - **Recommendations**: Prioritized action items
     - **Remaining Questions**: Unresolved items
   - Update "Current Understanding (Final)":
     - **What We Established**: Confirmed points
     - **What Was Clarified/Corrected**: Important corrections
     - **Key Insights**: Valuable learnings
   - Add session statistics: rounds, duration, sources, artifacts

3. **Post-Completion Options** (AskUserQuestion)
   - **创建Issue**: Launch issue:new with conclusions
   - **生成任务**: Launch workflow:lite-plan for implementation
   - **导出报告**: Generate standalone analysis report
   - **完成**: No further action

**conclusions.json Schema**:
- `session_id`: Session identifier
- `topic`: Original topic/question
- `completed`: Completion timestamp
- `total_rounds`: Number of discussion rounds
- `summary`: Executive summary
- `key_conclusions[]`: {point, evidence, confidence}
- `recommendations[]`: {action, rationale, priority}
- `open_questions[]`: Unresolved questions
- `follow_up_suggestions[]`: {type, summary}

**Success Criteria**:
- conclusions.json created with final synthesis
- discussion.md finalized with conclusions
- User offered next step options
- Session complete

## Configuration

### Analysis Dimensions

Dimensions matched against topic keywords to identify focus areas:

| Dimension | Keywords |
|-----------|----------|
| architecture | 架构, architecture, design, structure, 设计 |
| implementation | 实现, implement, code, coding, 代码 |
| performance | 性能, performance, optimize, bottleneck, 优化 |
| security | 安全, security, auth, permission, 权限 |
| concept | 概念, concept, theory, principle, 原理 |
| comparison | 比较, compare, vs, difference, 区别 |
| decision | 决策, decision, choice, tradeoff, 选择 |

### Consolidation Rules

When updating "Current Understanding":

| Rule | Description |
|------|-------------|
| Promote confirmed insights | Move validated findings to "What We Established" |
| Track corrections | Keep important wrong→right transformations |
| Focus on current state | What do we know NOW |
| Avoid timeline repetition | Don't copy discussion details |
| Preserve key learnings | Keep insights valuable for future reference |

**Example**:

❌ **Bad (cluttered)**:
```markdown
## Current Understanding
In round 1 we discussed X, then in round 2 user said Y...
```

✅ **Good (consolidated)**:
```markdown
## Current Understanding

### What We Established
- The authentication flow uses JWT with refresh tokens
- Rate limiting is implemented at API gateway level

### What Was Clarified
- ~~Assumed Redis for sessions~~ → Actually uses database-backed sessions

### Key Insights
- Current architecture supports horizontal scaling
```

## Error Handling

| Error | Resolution |
|-------|------------|
| cli-explore-agent fails | Continue with available context, note limitation |
| CLI timeout | Retry with shorter prompt, or skip perspective |
| User timeout in discussion | Save state, show resume command |
| Max rounds reached | Force synthesis, offer continuation option |
| No relevant findings | Broaden search, ask user for clarification |
| Session folder conflict | Append timestamp suffix |
| Gemini unavailable | Fallback to Codex or manual analysis |

## Best Practices

1. **Clear Topic Definition**: Detailed topics → better dimension identification
2. **Review discussion.md**: Check understanding evolution before conclusions
3. **Embrace Corrections**: Track wrong→right transformations as learnings
4. **Document Evolution**: discussion.md captures full thinking process
5. **Use Continue Mode**: Resume sessions to build on previous analysis

## Templates

### Discussion Document Structure

**discussion.md** contains:
- **Header**: Session metadata (ID, topic, started, dimensions)
- **User Context**: Focus areas, analysis depth
- **Discussion Timeline**: Round-by-round findings
  - Round 1: Initial Understanding + Exploration Results
  - Round 2-N: User feedback, adjusted understanding, corrections, new insights
- **Conclusions**: Summary, key conclusions, recommendations
- **Current Understanding (Final)**: Consolidated insights
- **Session Statistics**: Rounds, duration, sources, artifacts

Example sections:

```markdown
### Round 2 - Discussion (timestamp)

#### User Input
User agrees with current direction, wants deeper code analysis

#### Updated Understanding
- Identified session management uses database-backed approach
- Rate limiting applied at gateway, not application level

#### Corrected Assumptions
- ~~Assumed Redis for sessions~~ → Database-backed sessions
  - Reason: User clarified architecture decision

#### New Insights
- Current design allows horizontal scaling without session affinity
```

## Usage Recommendations

**Use `/workflow:analyze-with-file` when:**
- Exploring a complex topic collaboratively
- Need documented discussion trail
- Decision-making requires multiple perspectives
- Want to iterate on understanding with user input
- Building shared understanding before implementation

**Use `/workflow:debug-with-file` when:**
- Diagnosing specific bugs
- Need hypothesis-driven investigation
- Focus on evidence and verification

**Use `/workflow:brainstorm-with-file` when:**
- Generating new ideas or solutions
- Need creative exploration
- Want divergent thinking before convergence

**Use `/workflow:lite-plan` when:**
- Ready to implement (past analysis phase)
- Need structured task breakdown
- Focus on execution planning

---

**Now execute analyze-with-file for**: $ARGUMENTS
