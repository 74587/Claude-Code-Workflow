---
name: analyze-with-file
description: Interactive collaborative analysis with documented discussions, parallel subagent exploration, and evolving understanding. Parallel analysis for Codex.
argument-hint: "TOPIC=\"<question or topic>\" [--depth=quick|standard|deep] [--continue]"
---

# Codex Analyze-With-File Workflow

## Quick Start

Interactive collaborative analysis workflow with **documented discussion process**. Records understanding evolution, facilitates multi-round Q&A, and uses **parallel subagent exploration** for deep analysis.

**Core workflow**: Topic → Parallel Explore → Discuss → Document → Refine → Conclude → (Optional) Quick Execute

## Overview

This workflow enables iterative exploration and refinement of complex topics through parallel-capable phases:

1. **Topic Understanding** - Parse the topic and identify analysis dimensions
2. **Parallel Exploration** - Gather codebase context via parallel subagents (up to 4)
3. **Interactive Discussion** - Multi-round Q&A with user feedback and direction adjustments
4. **Synthesis & Conclusion** - Consolidate insights and generate actionable recommendations
5. **Quick Execute** *(Optional)* - Convert conclusions to plan.json and execute serially with logging

The key innovation is **documented discussion timeline** that captures the evolution of understanding across all phases, enabling users to track how insights develop and assumptions are corrected.

**Codex-Specific Features**:
- Parallel subagent execution via `spawn_agent` + batch `wait({ ids: [...] })`
- Role loading via path (agent reads `~/.codex/agents/*.md` itself)
- Deep interaction with `send_input` for multi-round within single agent
- Explicit lifecycle management with `close_agent`

## Analysis Flow

```
Session Detection
   ├─ Check if analysis session exists for topic
   ├─ EXISTS + discussion.md → Continue mode
   └─ NOT_FOUND → New session mode

Phase 1: Topic Understanding
   ├─ Parse topic/question
   ├─ Identify analysis dimensions (architecture, implementation, performance, security, concept, comparison, decision)
   ├─ Initial scoping with user (focus areas, perspectives, analysis depth)
   └─ Initialize discussion.md

Phase 2: Parallel Exploration (Subagent Execution)
   ├─ Determine exploration mode (single vs multi-perspective)
   ├─ Parallel: spawn_agent × N (up to 4 perspectives)
   ├─ Batch wait: wait({ ids: [agent1, agent2, ...] })
   ├─ Aggregate findings from all perspectives
   ├─ Synthesize convergent/conflicting themes (if multi-perspective)
   └─ Write explorations.json or perspectives.json

Phase 3: Interactive Discussion (Multi-Round)
   ├─ Present exploration findings to user
   ├─ Gather user feedback (deepen, adjust direction, ask questions, complete)
   ├─ Execute targeted analysis via send_input or new subagent
   ├─ Update discussion.md with each round
   └─ Repeat until clarity achieved (max 5 rounds)

Phase 4: Synthesis & Conclusion
   ├─ Consolidate all insights and discussion rounds
   ├─ Generate final conclusions with recommendations
   ├─ Update discussion.md with synthesis
   └─ Offer follow-up options (quick execute, create issue, generate task, export report)

Phase 5: Quick Execute (Optional - user selects "简要执行")
   ├─ Convert conclusions.recommendations → quick-plan.json
   ├─ Present plan for user confirmation
   ├─ Serial task execution via CLI (no agent exploration)
   ├─ Record each task result to execution-log.md
   └─ Report completion summary with statistics
```

## Output Structure

```
{projectRoot}/.workflow/.analysis/ANL-{slug}-{date}/
├── discussion.md                # ⭐ Evolution of understanding & discussions
├── exploration-codebase.json    # Phase 2: Codebase context (single perspective)
├── explorations/                # Phase 2: Multi-perspective explorations (if selected)
│   ├── technical.json
│   ├── architectural.json
│   └── ...
├── explorations.json            # Phase 2: Single perspective findings
├── perspectives.json            # Phase 2: Multi-perspective findings with synthesis
├── conclusions.json             # Phase 4: Final synthesis with recommendations
├── quick-plan.json              # Phase 5: Executable task plan (if quick execute)
└── execution-log.md             # Phase 5: Execution history (if quick execute)
```

## Output Artifacts

### Phase 1: Topic Understanding

| Artifact | Purpose |
|----------|---------|
| `discussion.md` | Initialized with session metadata and initial questions |
| Session variables | Topic slug, dimensions, focus areas, perspectives, analysis depth |

### Phase 2: Parallel Exploration

| Artifact | Purpose |
|----------|---------|
| `exploration-codebase.json` | Single perspective: Codebase context (relevant files, patterns, constraints) |
| `explorations/*.json` | Multi-perspective: Individual exploration results per perspective |
| `explorations.json` | Single perspective: Aggregated findings |
| `perspectives.json` | Multi-perspective: Findings with synthesis (convergent/conflicting themes) |
| Updated `discussion.md` | Round 1: Exploration results and initial analysis |

### Phase 3: Interactive Discussion

| Artifact | Purpose |
|----------|---------|
| Updated `discussion.md` | Round N (2-5): User feedback, direction adjustments, corrected assumptions |
| Subagent analysis results | Deepened analysis, adjusted perspective, or specific question answers |

### Phase 4: Synthesis & Conclusion

| Artifact | Purpose |
|----------|---------|
| `conclusions.json` | Final synthesis: key conclusions, recommendations, open questions |
| Final `discussion.md` | Complete analysis timeline with conclusions and final understanding |

### Phase 5: Quick Execute (Optional)

| Artifact | Purpose |
|----------|---------|
| `quick-plan.json` | Executable task plan converted from recommendations |
| `execution-log.md` | Unified execution history with task results and statistics |

---

## Implementation Details

### Session Initialization

##### Step 0: Determine Project Root

检测项目根目录，确保 `.workflow/` 产物位置正确：

```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
```

优先通过 git 获取仓库根目录；非 git 项目回退到 `pwd` 取当前绝对路径。
存储为 `{projectRoot}`，后续所有 `.workflow/` 路径必须以此为前缀。

The workflow automatically generates a unique session identifier and directory structure based on the topic and current date (UTC+8).

**Session ID Format**: `ANL-{slug}-{date}`
- `slug`: Lowercase alphanumeric + Chinese characters, max 40 chars (derived from topic)
- `date`: YYYY-MM-DD format (UTC+8)

**Session Directory**: `{projectRoot}/.workflow/.analysis/{sessionId}/`

**Auto-Detection**: If session folder exists with discussion.md, automatically enters continue mode. Otherwise, creates new session.

**Session Variables**:
- `sessionId`: Unique identifier
- `sessionFolder`: Base directory for artifacts
- `mode`: "new" or "continue"
- `dimensions`: Analysis focus areas
- `focusAreas`: User-selected focus areas
- `analysisDepth`: quick|standard|deep

---

## Phase 1: Topic Understanding

**Objective**: Parse the topic, identify relevant analysis dimensions, scope the analysis with user input, and initialize the discussion document.

### Step 1.1: Parse Topic & Identify Dimensions

The workflow analyzes the topic text against predefined analysis dimensions to determine relevant focus areas.

**Analysis Dimensions and Keywords**:

| Dimension | Keywords |
|-----------|----------|
| architecture | 架构, architecture, design, structure, 设计, pattern |
| implementation | 实现, implement, code, coding, 代码, logic |
| performance | 性能, performance, optimize, bottleneck, 优化, speed |
| security | 安全, security, auth, permission, 权限, vulnerability |
| concept | 概念, concept, theory, principle, 原理, understand |
| comparison | 比较, compare, vs, difference, 区别, versus |
| decision | 决策, decision, choice, tradeoff, 选择, trade-off |

**Matching Logic**: Compare topic text against keyword lists. If multiple dimensions match, include all. If none match, default to "architecture" and "implementation".

### Step 1.2: Initial Scoping (New Session Only)

For new analysis sessions, gather user preferences before exploration:

**Focus Areas** (Multi-select):
- 代码实现 (Implementation details)
- 架构设计 (Architecture design)
- 最佳实践 (Best practices)
- 问题诊断 (Problem diagnosis)

**Analysis Perspectives** (Multi-select, max 4 for parallel exploration):
- 技术视角 (Technical - implementation patterns, code structure)
- 架构视角 (Architectural - system design, component interactions)
- 安全视角 (Security - vulnerabilities, access control)
- 性能视角 (Performance - bottlenecks, optimization)

**Selection Note**: Single perspective = 1 subagent. Multiple perspectives = parallel subagents (up to 4).

**Analysis Depth** (Single-select):
- 快速概览 (Quick overview, 10-15 minutes, 1 agent)
- 标准分析 (Standard analysis, 30-60 minutes, 1-2 agents)
- 深度挖掘 (Deep dive, 1-2+ hours, up to 4 parallel agents)

### Step 1.3: Initialize discussion.md

Create the main discussion document with session metadata, context, and placeholder sections.

**discussion.md Structure**:
- **Header**: Session ID, topic, start time, identified dimensions
- **Analysis Context**: User-selected focus areas, depth level, scope
- **Initial Questions**: Key questions to guide the analysis
- **Discussion Timeline**: Round-by-round findings and insights
- **Current Understanding**: To be populated after exploration

**Key Features**:
- Serves as the primary artifact throughout the workflow
- Captures all rounds of discussion and findings
- Documents assumption corrections and insight evolution
- Enables session continuity across multiple interactions

**Success Criteria**:
- Session folder created successfully
- discussion.md initialized with all metadata
- Analysis dimensions identified
- User preferences captured

---

## Phase 2: Parallel Exploration

**Objective**: Gather codebase context and execute deep analysis via parallel subagents to build understanding of the topic.

**Execution Model**: Parallel subagent execution - spawn multiple agents for different perspectives, batch wait for all results, then aggregate.

**Key API Pattern**:
```
spawn_agent × N → wait({ ids: [...] }) → aggregate → close_agent × N
```

### Step 2.1: Determine Exploration Mode

Based on user's perspective selection in Phase 1, choose exploration mode:

| Mode | Condition | Subagents | Output |
|------|-----------|-----------|--------|
| Single | Default or 1 perspective selected | 1 agent | `exploration-codebase.json`, `explorations.json` |
| Multi-perspective | 2-4 perspectives selected | 2-4 agents | `explorations/*.json`, `perspectives.json` |

### Step 2.2: Parallel Subagent Exploration

**⚠️ IMPORTANT**: Role files are NOT read by main process. Pass path in message, agent reads itself.

**Single Perspective Exploration**:

```javascript
// spawn_agent with role path (agent reads itself)
const explorationAgent = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/cli-explore-agent.md (MUST read first)
2. Read: ${projectRoot}/.workflow/project-tech.json
3. Read: ${projectRoot}/.workflow/project-guidelines.json

---

## Analysis Context
Topic: ${topic_or_question}
Dimensions: ${dimensions.join(', ')}
Session: ${sessionFolder}

## Exploration Tasks
1. Run: ccw tool exec get_modules_by_depth '{}'
2. Execute relevant searches based on topic keywords
3. Analyze identified files for patterns and constraints

## Deliverables
Write findings to: ${sessionFolder}/exploration-codebase.json

Schema: {relevant_files, patterns, constraints, integration_points, key_findings, _metadata}

## Success Criteria
- [ ] Role definition read
- [ ] At least 5 relevant files identified
- [ ] Patterns and constraints documented
- [ ] JSON output follows schema
`
})

// Wait for single agent
const result = wait({ ids: [explorationAgent], timeout_ms: 600000 })

// Clean up
close_agent({ id: explorationAgent })
```

**Multi-Perspective Parallel Exploration** (up to 4 agents):

```javascript
// Define perspectives based on user selection
const selectedPerspectives = [
  { name: 'technical', focus: 'Implementation patterns and code structure' },
  { name: 'architectural', focus: 'System design and component interactions' },
  { name: 'security', focus: 'Security patterns and vulnerabilities' },
  { name: 'performance', focus: 'Performance bottlenecks and optimization' }
].slice(0, userSelectedCount)  // Max 4

// Parallel spawn - all agents start immediately
const agentIds = selectedPerspectives.map(perspective => {
  return spawn_agent({
    message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/cli-explore-agent.md (MUST read first)
2. Read: ${projectRoot}/.workflow/project-tech.json
3. Read: ${projectRoot}/.workflow/project-guidelines.json

---

## Analysis Context
Topic: ${topic_or_question}
Perspective: ${perspective.name} - ${perspective.focus}
Session: ${sessionFolder}

## Perspective-Specific Exploration
Focus on ${perspective.focus} aspects of the topic.

## Exploration Tasks
1. Run: ccw tool exec get_modules_by_depth '{}'
2. Execute searches focused on ${perspective.name} patterns
3. Identify ${perspective.name}-specific findings

## Deliverables
Write findings to: ${sessionFolder}/explorations/${perspective.name}.json

Schema: {
  perspective: "${perspective.name}",
  relevant_files, patterns, key_findings,
  perspective_insights, open_questions,
  _metadata
}

## Success Criteria
- [ ] Role definition read
- [ ] Perspective-specific insights identified
- [ ] At least 3 relevant findings
- [ ] JSON output follows schema
`
  })
})

// Batch wait - TRUE PARALLELISM (key Codex advantage)
const results = wait({
  ids: agentIds,
  timeout_ms: 600000  // 10 minutes for all
})

// Handle timeout
if (results.timed_out) {
  // Some agents may still be running
  // Decide: continue waiting or use completed results
}

// Collect results from all perspectives
const completedFindings = {}
agentIds.forEach((agentId, index) => {
  const perspective = selectedPerspectives[index]
  if (results.status[agentId].completed) {
    completedFindings[perspective.name] = results.status[agentId].completed
  }
})

// Batch cleanup
agentIds.forEach(id => close_agent({ id }))
```

### Step 2.3: Aggregate Findings

**Single Perspective Aggregation**:

Create `explorations.json` from single agent output:
- Extract key findings from exploration-codebase.json
- Organize by analysis dimensions
- Generate discussion points and open questions

**Multi-Perspective Synthesis**:

Create `perspectives.json` from parallel agent outputs:

```javascript
const synthesis = {
  session_id: sessionId,
  timestamp: new Date().toISOString(),
  topic: topic_or_question,
  dimensions: dimensions,

  // Individual perspective findings
  perspectives: selectedPerspectives.map(p => ({
    name: p.name,
    findings: completedFindings[p.name]?.key_findings || [],
    insights: completedFindings[p.name]?.perspective_insights || [],
    questions: completedFindings[p.name]?.open_questions || []
  })),

  // Cross-perspective synthesis
  synthesis: {
    convergent_themes: extractConvergentThemes(completedFindings),
    conflicting_views: extractConflicts(completedFindings),
    unique_contributions: extractUniqueInsights(completedFindings)
  },

  // Aggregated for discussion
  aggregated_findings: mergeAllFindings(completedFindings),
  discussion_points: generateDiscussionPoints(completedFindings),
  open_questions: mergeOpenQuestions(completedFindings)
}
```

**perspectives.json Schema**:
- `session_id`: Session identifier
- `timestamp`: Completion time
- `topic`: Original topic/question
- `dimensions[]`: Analysis dimensions
- `perspectives[]`: [{name, findings, insights, questions}]
- `synthesis`: {convergent_themes, conflicting_views, unique_contributions}
- `aggregated_findings[]`: Main insights across all perspectives
- `discussion_points[]`: Questions for user engagement
- `open_questions[]`: Unresolved questions

### Step 2.4: Update discussion.md

Append Round 1 with exploration results.

**Single Perspective Round 1**:
- Sources analyzed (files, patterns)
- Key findings with evidence
- Discussion points for user
- Open questions

**Multi-Perspective Round 1**:
- Per-perspective summary (brief)
- Synthesis section:
  - Convergent themes (what all perspectives agree on)
  - Conflicting views (where perspectives differ)
  - Unique contributions (insights from specific perspectives)
- Discussion points
- Open questions

**Success Criteria**:
- All subagents spawned and completed (or timeout handled)
- `exploration-codebase.json` OR `explorations/*.json` created
- `explorations.json` OR `perspectives.json` created with aggregated findings
- `discussion.md` updated with Round 1 results
- All agents closed properly
- Ready for interactive discussion phase

---

## Phase 3: Interactive Discussion

**Objective**: Iteratively refine understanding through multi-round user-guided discussion cycles.

**Max Rounds**: 5 discussion rounds (can exit earlier if user indicates analysis is complete)

**Execution Model**: Use `send_input` for deep interaction within same agent context, or spawn new agent for significantly different analysis angles.

### Step 3.1: Present Findings & Gather Feedback

Display current understanding and exploration findings to the user.

**Presentation Content**:
- Current understanding summary
- Key findings from exploration
- Open questions or areas needing clarification
- Available action options

**User Feedback Options** (ASK_USER - single select):

| Option | Purpose | Next Action |
|--------|---------|------------|
| **继续深入** | Analysis direction is correct, deepen investigation | `send_input` to existing agent OR spawn new deepening agent |
| **调整方向** | Different understanding or focus needed | Spawn new agent with adjusted focus |
| **有具体问题** | Specific questions to ask about the topic | `send_input` with specific questions OR spawn Q&A agent |
| **分析完成** | Sufficient information obtained | Exit discussion loop, proceed to synthesis |

### Step 3.2: Deepen Analysis (via send_input or new agent)

When user selects "continue deepening", execute more detailed investigation.

**Option A: send_input to Existing Agent** (preferred if agent still active)

```javascript
// Continue with existing agent context (if not closed)
send_input({
  id: explorationAgent,
  message: `
## CONTINUATION: Deepen Analysis

Based on your initial exploration, the user wants deeper investigation.

## Focus Areas for Deepening
${previousFindings.discussion_points.map(p => `- ${p}`).join('\n')}

## Additional Tasks
1. Investigate edge cases and special scenarios
2. Identify patterns not yet discussed
3. Suggest implementation or improvement approaches
4. Provide risk/impact assessments

## Deliverables
Append to: ${sessionFolder}/explorations.json (add "deepening_round_N" section)

## Success Criteria
- [ ] Prior findings expanded with specifics
- [ ] Corner cases and limitations identified
- [ ] Concrete improvement strategies proposed
`
})

const deepenResult = wait({ ids: [explorationAgent], timeout_ms: 600000 })
```

**Option B: Spawn New Deepening Agent** (if prior agent closed)

```javascript
const deepeningAgent = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/cli-explore-agent.md (MUST read first)
2. Read: ${sessionFolder}/explorations.json (prior findings)
3. Read: ${projectRoot}/.workflow/project-tech.json

---

## Context
Topic: ${topic_or_question}
Prior Findings Summary: ${previousFindings.key_findings.slice(0,3).join('; ')}

## Deepening Task
Expand on prior findings with more detailed investigation.

## Focus Areas
${previousFindings.discussion_points.map(p => `- ${p}`).join('\n')}

## Deliverables
Update: ${sessionFolder}/explorations.json (add deepening insights)
`
})

const result = wait({ ids: [deepeningAgent], timeout_ms: 600000 })
close_agent({ id: deepeningAgent })
```

### Step 3.3: Adjust Direction (new agent)

When user indicates a different focus is needed, spawn new agent with adjusted perspective.

**Direction Adjustment Process**:
1. Ask user for adjusted focus area (via ASK_USER)
2. Spawn new agent with different dimension/perspective
3. Compare new insights with prior analysis
4. Identify what was missed and why

```javascript
// Spawn agent with adjusted focus
const adjustedAgent = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/cli-explore-agent.md (MUST read first)
2. Read: ${sessionFolder}/explorations.json (prior findings)
3. Read: ${projectRoot}/.workflow/project-tech.json

---

## Context
Topic: ${topic_or_question}
Previous Focus: ${previousDimensions.join(', ')}
**New Focus**: ${userAdjustedFocus}

## Adjusted Analysis Task
Analyze the topic from ${userAdjustedFocus} perspective.

## Tasks
1. Identify gaps in prior analysis
2. Generate insights specific to new focus
3. Cross-reference with prior findings
4. Explain what was missed and why

## Deliverables
Update: ${sessionFolder}/explorations.json (add adjusted_direction section)
`
})

const result = wait({ ids: [adjustedAgent], timeout_ms: 600000 })
close_agent({ id: adjustedAgent })
```

### Step 3.4: Answer Specific Questions (send_input preferred)

When user has specific questions, address them directly.

**Preferred: send_input to Active Agent**

```javascript
// Capture user questions first
const userQuestions = ASK_USER([{
  id: "user_questions", type: "input",
  prompt: "What specific questions do you have?",
  options: [/* predefined + custom */]
}])  // BLOCKS (wait for user response)

// Send questions to active agent
send_input({
  id: activeAgent,
  message: `
## USER QUESTIONS

Please answer the following questions based on your analysis:

${userQuestions.map((q, i) => `Q${i+1}: ${q}`).join('\n\n')}

## Requirements
- Answer each question directly and clearly
- Provide evidence and file references
- Rate confidence for each answer (high/medium/low)
- Suggest related investigation areas
`
})

const answerResult = wait({ ids: [activeAgent], timeout_ms: 300000 })
```

**Alternative: Spawn Q&A Agent**

```javascript
const qaAgent = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/cli-explore-agent.md (MUST read first)
2. Read: ${sessionFolder}/explorations.json (context)

---

## Q&A Task
Answer user's specific questions:

${userQuestions.map((q, i) => `Q${i+1}: ${q}`).join('\n\n')}

## Requirements
- Evidence-based answers with file references
- Confidence rating for each answer
- Suggest related investigation areas

## Deliverables
Append to: ${sessionFolder}/explorations.json (add qa_round_N section)
`
})

const result = wait({ ids: [qaAgent], timeout_ms: 300000 })
close_agent({ id: qaAgent })
```

### Step 3.5: Document Each Round

Update discussion.md with results from each discussion round.

**Round N Sections** (Rounds 3-5):

| Section | Content |
|---------|---------|
| User Direction | Action taken (deepen/adjust/questions) and focus area |
| Analysis Results | Key findings, insights, next steps |
| Insights | New learnings or clarifications from this round |
| Corrected Assumptions | Important wrong→right transformations with explanation |
| Open Items | Remaining questions or areas for future investigation |

**Documentation Standards**:
- Clear timestamps for each round
- Evidence-based findings with file references
- Explicit tracking of assumption corrections
- Organized by analysis dimension
- Links between rounds showing understanding evolution

**Consolidation Rules**:
- Promote confirmed insights to "What We Established"
- Track important corrections as learnings
- Focus on current understanding, not timeline details
- Avoid repeating discussion details
- Highlight key insights for future reference

**Success Criteria**:
- User feedback processed for each round
- `discussion.md` updated with all rounds
- Assumptions documented and corrected
- Exit condition reached (user selects complete or max rounds reached)

---

## Phase 4: Synthesis & Conclusion

**Objective**: Consolidate insights from all discussion rounds, generate final conclusions and recommendations, and offer next steps.

### Step 4.1: Consolidate Insights

Extract and synthesize all findings from the discussion timeline into coherent conclusions and recommendations.

**Consolidation Activities**:
1. Review all discussion rounds and accumulated findings
2. Identify confirmed conclusions with evidence
3. Extract actionable recommendations with rationale
4. Note remaining open questions
5. Generate follow-up suggestions

**conclusions.json Structure**:

| Field | Purpose |
|-------|---------|
| `session_id` | Reference to analysis session |
| `topic` | Original topic/question |
| `completed` | Completion timestamp |
| `total_rounds` | Number of discussion rounds |
| `summary` | Executive summary of analysis |
| `key_conclusions[]` | Main conclusions with evidence and confidence |
| `recommendations[]` | Actionable recommendations with rationale and priority |
| `open_questions[]` | Unresolved questions for future investigation |
| `follow_up_suggestions[]` | Suggested next steps (issue/task/research) |

**Key Conclusions Format**:
- `point`: Clear statement of the conclusion
- `evidence`: Supporting evidence or code references
- `confidence`: high|medium|low confidence level

**Recommendations Format**:
- `action`: Specific recommended action
- `rationale`: Reasoning and benefits
- `priority`: high|medium|low priority

### Step 4.2: Final discussion.md Update

Append conclusions section and finalize the understanding document.

**Synthesis & Conclusions Section**:
- **Executive Summary**: Overview of analysis findings
- **Key Conclusions**: Ranked by confidence level with supporting evidence
- **Recommendations**: Prioritized action items with rationale
- **Remaining Open Questions**: Unresolved items for future work

**Current Understanding (Final) Section**:

| Subsection | Content |
|------------|---------|
| What We Established | Confirmed points and validated findings |
| What Was Clarified | Important corrections (~~wrong→right~~) |
| Key Insights | Valuable learnings for future reference |

**Session Statistics**:
- Total discussion rounds completed
- Key findings identified
- Analysis dimensions covered
- Artifacts generated

**Documentation Standards**:
- Clear evidence for conclusions
- Actionable, specific recommendations
- Organized by priority and confidence
- Links to relevant code or discussions

### Step 4.3: Post-Completion Options

Offer user follow-up actions based on analysis results.

**Available Options** (ASK_USER - multi-select):

| Option | Purpose | Action |
|--------|---------|--------|
| **简要执行** | Quick execute from analysis | Jump to Phase 5: Generate quick-plan.json and execute serially |
| **创建Issue** | Create actionable issue from findings | Launch `issue:new` with conclusions summary |
| **生成任务** | Generate implementation task | Launch `workflow:lite-plan` for task breakdown |
| **导出报告** | Generate standalone analysis report | Create formatted report document |
| **完成** | No further action | End workflow |

**Success Criteria**:
- `conclusions.json` created with complete synthesis
- `discussion.md` finalized with all conclusions
- User offered meaningful next step options
- Session complete and all artifacts available

---

## Phase 5: Quick Execute (简要执行)

**Objective**: Convert analysis conclusions directly into executable tasks and run them serially without additional exploration.

**Trigger**: User selects "简要执行" in Phase 4 post-completion options.

**Key Principle**: **No additional agent exploration** - analysis phase has already collected all necessary context.

**详细规范**: 📖 [EXECUTE.md](./EXECUTE.md)

**Flow Summary**:
```
conclusions.json → quick-plan.json → 用户确认 → 串行CLI执行 → execution-log.md
```

**Steps**:
1. **Generate quick-plan.json** - Convert `conclusions.recommendations` to executable tasks
2. **User Confirmation** - Present plan, user approves / adjusts / cancels
3. **Serial Execution** - Execute tasks via CLI `--mode write`, one at a time
4. **Record Log** - Each task result appended to `execution-log.md`
5. **Update Plan** - Update `quick-plan.json` with execution statuses
6. **Completion** - Report statistics, offer retry/view log/create issue

**Output**:
- `${sessionFolder}/quick-plan.json` - Executable task plan with statuses
- `${sessionFolder}/execution-log.md` - Unified execution history

---

## Configuration

### Analysis Perspectives

Optional multi-perspective parallel exploration (single perspective is default, max 4):

| Perspective | Role File | Focus | Best For |
|------------|-----------|-------|----------|
| **Technical** | `~/.codex/agents/cli-explore-agent.md` | Implementation, code patterns, technical feasibility | Understanding how and technical details |
| **Architectural** | `~/.codex/agents/cli-explore-agent.md` | System design, scalability, component interactions | Understanding structure and organization |
| **Security** | `~/.codex/agents/cli-explore-agent.md` | Security patterns, vulnerabilities, access control | Identifying security risks |
| **Performance** | `~/.codex/agents/cli-explore-agent.md` | Bottlenecks, optimization, resource utilization | Finding performance issues |

**Selection**: User can multi-select up to 4 perspectives in Phase 1, or default to single comprehensive view.

**Subagent Assignment**: Each perspective gets its own subagent for true parallel exploration.

### Analysis Dimensions Reference

Dimensions guide the scope and focus of analysis:

| Dimension | Description | Best For |
|-----------|-------------|----------|
| architecture | System design, component interactions, design patterns | Understanding structure and organization |
| implementation | Code patterns, implementation details, algorithms | Understanding how things work technically |
| performance | Bottlenecks, optimization opportunities, resource usage | Finding and fixing performance issues |
| security | Vulnerabilities, authentication, access control | Identifying and addressing security risks |
| concept | Foundational ideas, principles, theory | Understanding fundamental mechanisms |
| comparison | Comparing solutions, evaluating alternatives | Making informed technology or approach choices |
| decision | Trade-offs, impact analysis, decision rationale | Understanding why decisions were made |

### Analysis Depth Levels

| Depth | Duration | Scope | Subagents |
|-------|----------|-------|-----------|
| Quick (快速概览) | 10-15 min | Surface level understanding | 1 agent, short timeout |
| Standard (标准分析) | 30-60 min | Moderate depth with good coverage | 1-2 agents |
| Deep (深度挖掘) | 1-2+ hours | Comprehensive detailed analysis | Up to 4 parallel agents |

### Focus Areas

Common focus areas that guide the analysis direction:

| Focus | Description |
|-------|-------------|
| 代码实现 | Implementation details, code patterns, algorithms |
| 架构设计 | System design, component structure, design patterns |
| 最佳实践 | Industry standards, recommended approaches, patterns |
| 问题诊断 | Identifying root causes, finding issues, debugging |

---

## Error Handling & Recovery

| Situation | Action | Recovery |
|-----------|--------|----------|
| **Subagent timeout** | Check `results.timed_out`, continue `wait()` or use partial results | Reduce scope, spawn single agent instead of parallel |
| **Agent closed prematurely** | Cannot recover closed agent | Spawn new agent with prior context from explorations.json |
| **Parallel agent partial failure** | Some agents complete, some fail | Use completed results, note gaps in synthesis |
| **send_input to closed agent** | Error: agent not found | Spawn new agent with prior findings as context |
| **No relevant findings** | Broaden search keywords or adjust scope | Ask user for clarification |
| **User disengaged** | Summarize progress and offer break point | Save state, keep agents alive for resume |
| **Max rounds reached (5)** | Force synthesis phase | Highlight remaining questions in conclusions |
| **Session folder conflict** | Append timestamp suffix to session ID | Create unique folder and continue |
| **Quick execute: task fails** | Record failure in execution-log.md, ask user | Retry, skip, or abort remaining tasks |
| **Quick execute: CLI timeout** | Mark task as failed with timeout reason | User can retry or skip |
| **Quick execute: no recommendations** | Cannot generate quick-plan.json | Inform user, suggest using lite-plan instead |

### Codex-Specific Error Patterns

```javascript
// Safe parallel execution with error handling
try {
  const agentIds = perspectives.map(p => spawn_agent({ message: buildPrompt(p) }))

  const results = wait({ ids: agentIds, timeout_ms: 600000 })

  if (results.timed_out) {
    // Handle partial completion
    const completed = agentIds.filter(id => results.status[id].completed)
    const pending = agentIds.filter(id => !results.status[id].completed)

    // Option 1: Continue waiting for pending
    // const moreResults = wait({ ids: pending, timeout_ms: 300000 })

    // Option 2: Use partial results
    // processPartialResults(completed, results)
  }

  // Process all results
  processResults(agentIds, results)

} finally {
  // ALWAYS cleanup, even on errors
  agentIds.forEach(id => {
    try { close_agent({ id }) } catch (e) { /* ignore */ }
  })
}
```

---

## Iteration Patterns

### First Analysis Session (Parallel Mode)

```
User initiates: TOPIC="specific question"
   ├─ No session exists → New session mode
   ├─ Parse topic and identify dimensions
   ├─ Scope analysis with user (focus areas, perspectives, depth)
   ├─ Create discussion.md
   │
   ├─ Determine exploration mode:
   │   ├─ Single perspective → 1 subagent
   │   └─ Multi-perspective → 2-4 parallel subagents
   │
   ├─ Execute parallel exploration:
   │   ├─ spawn_agent × N (perspectives)
   │   ├─ wait({ ids: [...] })  ← TRUE PARALLELISM
   │   └─ close_agent × N
   │
   ├─ Aggregate findings (+ synthesis if multi-perspective)
   └─ Enter multi-round discussion loop
```

### Continue Existing Session

```
User resumes: TOPIC="same topic" with --continue flag
   ├─ Session exists → Continue mode
   ├─ Load previous discussion.md
   ├─ Load explorations.json or perspectives.json
   └─ Resume from last discussion round
```

### Discussion Loop (Rounds 2-5)

```
Each round:
   ├─ Present current findings
   ├─ Gather user feedback
   ├─ Process response:
   │   ├─ Deepen → send_input to active agent OR spawn deepening agent
   │   ├─ Adjust → spawn new agent with adjusted focus
   │   ├─ Questions → send_input with questions OR spawn Q&A agent
   │   └─ Complete → Exit loop for synthesis
   ├─ wait({ ids: [...] }) for result
   ├─ Update discussion.md
   └─ Repeat until user selects complete or max rounds reached
```

### Agent Lifecycle Management

```
Subagent lifecycle:
   ├─ spawn_agent({ message }) → Create with role path + task
   ├─ wait({ ids, timeout_ms }) → Get results (ONLY way to get output)
   ├─ send_input({ id, message }) → Continue interaction (if not closed)
   └─ close_agent({ id }) → Cleanup (MUST do, cannot recover)

Key rules:
   ├─ NEVER close before you're done with an agent
   ├─ ALWAYS use wait() to get results, NOT close_agent()
   ├─ Batch wait for parallel agents: wait({ ids: [a, b, c] })
   └─ Delay close_agent until all rounds complete (for send_input reuse)
```

### Completion Flow

```
Final synthesis:
   ├─ Consolidate all insights from all rounds
   ├─ Generate conclusions.json
   ├─ Update discussion.md with final synthesis
   ├─ close_agent for any remaining active agents
   ├─ Offer follow-up options
   └─ Archive session artifacts
```

### Quick Execute Flow (Phase 5)

```
User selects "简要执行":
   ├─ Read conclusions.json + explorations.json/perspectives.json
   ├─ Convert recommendations → quick-plan.json
   │   └─ No agent exploration (context already gathered)
   ├─ Present plan to user for confirmation
   │   ├─ 开始执行 → proceed
   │   ├─ 调整任务 → modify and regenerate
   │   └─ 取消 → keep plan, exit
   │
   ├─ Serial task execution:
   │   ├─ TASK-001: CLI --mode write → record to execution-log.md
   │   ├─ TASK-002: CLI --mode write → record to execution-log.md
   │   └─ (repeat for all tasks)
   │
   ├─ Update quick-plan.json with statuses
   ├─ Finalize execution-log.md with summary
   └─ Offer post-execution options (retry/view log/create issue/done)
```

---

## Best Practices

### Core Principles

1. **Explicit user confirmation required before code modifications**: Any operation involving code changes (including but not limited to file creation, editing, or deletion) must first present the proposed changes to the user and obtain explicit approval before execution. The analysis phase is strictly read-only — no code modifications are permitted without user consent.

### Before Starting Analysis

1. **Clear Topic Definition**: Detailed topics lead to better dimension identification
2. **User Context**: Understanding focus preferences helps scope the analysis
3. **Perspective Selection**: Choose 2-4 perspectives for complex topics, single for focused queries
4. **Scope Understanding**: Being clear about depth expectations sets correct analysis intensity

### During Analysis

1. **Review Findings**: Check exploration results before proceeding to discussion
2. **Document Assumptions**: Track what you think is true for correction later
3. **Use Continue Mode**: Resume sessions to build on previous findings rather than starting over
4. **Embrace Corrections**: Track wrong→right transformations as valuable learnings
5. **Iterate Thoughtfully**: Each discussion round should meaningfully refine understanding

### Codex Subagent Best Practices

1. **Role Path, Not Content**: Pass `~/.codex/agents/*.md` path in message, let agent read itself
2. **Delay close_agent**: Keep agents active for `send_input` reuse during discussion rounds
3. **Batch wait**: Use `wait({ ids: [a, b, c] })` for parallel agents, not sequential waits
4. **Handle Timeouts**: Check `results.timed_out` and decide: continue waiting or use partial results
5. **Explicit Cleanup**: Always `close_agent` when done, even on errors (use try/finally pattern)
6. **send_input vs spawn**: Prefer `send_input` for same-context continuation, `spawn` for new angles

### Documentation Practices

1. **Evidence-Based**: Every conclusion should reference specific code or patterns
2. **Confidence Levels**: Indicate confidence (high/medium/low) for conclusions
3. **Timeline Clarity**: Use clear timestamps for traceability
4. **Evolution Tracking**: Document how understanding changed across rounds
5. **Action Items**: Generate specific, actionable recommendations
6. **Multi-Perspective Synthesis**: When using parallel perspectives, document convergent/conflicting themes

---

## Templates & Examples

### discussion.md Structure

The discussion.md file evolves through the analysis:

**Header Section**:
```
Session ID, topic, start time, identified dimensions
```

**Context Section**:
```
Focus areas selected by user, analysis depth, scope
```

**Discussion Timeline**:
```
Round 1: Initial understanding + exploration results
Round 2: Codebase findings + CLI analysis results
Round 3-5: User feedback + direction adjustments + new insights
```

**Conclusions Section**:
```
Executive summary, key conclusions, recommendations, open questions
```

**Final Understanding Section**:
```
What we established (confirmed points)
What was clarified (corrected assumptions)
Key insights (valuable learnings)
```

### Round Documentation Pattern

Each discussion round follows a consistent structure:

- **Round Header**: Number, timestamp, and action taken
- **User Input**: What the user indicated they wanted to focus on
- **Analysis Results**: New findings from this round's analysis
- **Insights**: Key learnings and clarifications
- **Corrected Assumptions**: Any wrong→right transformations
- **Next Steps**: Suggested investigation paths

---

## When to Use This Workflow

### Use analyze-with-file when:
- Exploring complex topics collaboratively with documented trail
- Need multi-round iterative refinement of understanding
- Decision-making requires exploring multiple perspectives
- Building shared understanding before implementation
- Want to document how understanding evolved

### Use Quick Execute (Phase 5) when:
- Analysis conclusions contain clear, actionable recommendations
- Context is already sufficient - no additional exploration needed
- Want a streamlined analyze → plan → execute pipeline in one session
- Tasks are relatively independent and can be executed serially

### Use direct execution when:
- Short, focused analysis tasks (single component)
- Clear, well-defined topics with limited scope
- Quick information gathering without iteration
- Quick follow-up to existing session

### Consider alternatives when:
- Specific bug diagnosis needed → use `workflow:debug-with-file`
- Generating new ideas/solutions → use `workflow:brainstorm-with-file`
- Complex planning with parallel perspectives → use `workflow:collaborative-plan-with-file`
- Ready to implement → use `workflow:lite-plan`

---

**Now execute the analyze-with-file workflow for topic**: $TOPIC
