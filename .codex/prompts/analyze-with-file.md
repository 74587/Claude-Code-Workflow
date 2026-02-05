---
name: analyze-with-file
description: Interactive collaborative analysis with documented discussions, CLI-assisted exploration, and evolving understanding. Serial analysis for Codex.
argument-hint: "TOPIC=\"<question or topic>\" [--depth=quick|standard|deep] [--continue]"
---

# Codex Analyze-With-File Workflow

## Quick Start

Interactive collaborative analysis workflow with **documented discussion process**. Records understanding evolution, facilitates multi-round Q&A, and uses CLI tools for deep exploration.

**Core workflow**: Topic → Explore → Discuss → Document → Refine → Conclude

## Overview

This workflow enables iterative exploration and refinement of complex topics through sequential phases:

1. **Topic Understanding** - Parse the topic and identify analysis dimensions
2. **CLI Exploration** - Gather codebase context and perform deep analysis via Gemini
3. **Interactive Discussion** - Multi-round Q&A with user feedback and direction adjustments
4. **Synthesis & Conclusion** - Consolidate insights and generate actionable recommendations

The key innovation is **documented discussion timeline** that captures the evolution of understanding across all phases, enabling users to track how insights develop and assumptions are corrected.

## Analysis Flow

```
Session Detection
   ├─ Check if analysis session exists for topic
   ├─ EXISTS + discussion.md → Continue mode
   └─ NOT_FOUND → New session mode

Phase 1: Topic Understanding
   ├─ Parse topic/question
   ├─ Identify analysis dimensions (architecture, implementation, performance, security, concept, comparison, decision)
   ├─ Initial scoping with user (focus areas, analysis depth)
   └─ Initialize discussion.md

Phase 2: CLI Exploration (Serial Execution)
   ├─ Codebase context gathering (project structure, related files, constraints)
   ├─ Gemini CLI analysis (build on codebase findings)
   └─ Aggregate findings into explorations.json

Phase 3: Interactive Discussion (Multi-Round)
   ├─ Present exploration findings to user
   ├─ Gather user feedback (deepen, adjust direction, ask questions, complete)
   ├─ Execute targeted CLI analysis based on user direction
   ├─ Update discussion.md with each round
   └─ Repeat until clarity achieved (max 5 rounds)

Phase 4: Synthesis & Conclusion
   ├─ Consolidate all insights and discussion rounds
   ├─ Generate final conclusions with recommendations
   ├─ Update discussion.md with synthesis
   └─ Offer follow-up options (create issue, generate task, export report)
```

## Output Structure

```
.workflow/.analysis/ANL-{slug}-{date}/
├── discussion.md                # ⭐ Evolution of understanding & discussions
├── exploration-codebase.json    # Phase 2: Codebase context and project structure
├── explorations.json            # Phase 2: CLI analysis findings aggregated
└── conclusions.json             # Phase 4: Final synthesis with recommendations
```

## Output Artifacts

### Phase 1: Topic Understanding

| Artifact | Purpose |
|----------|---------|
| `discussion.md` | Initialized with session metadata and initial questions |
| Session variables | Topic slug, dimensions, focus areas, analysis depth |

### Phase 2: CLI Exploration

| Artifact | Purpose |
|----------|---------|
| `exploration-codebase.json` | Codebase context: relevant files, patterns, constraints |
| `explorations.json` | CLI analysis findings: key findings, discussion points, open questions |
| Updated `discussion.md` | Round 1-2: Exploration results and initial analysis |

### Phase 3: Interactive Discussion

| Artifact | Purpose |
|----------|---------|
| Updated `discussion.md` | Round N (3-5): User feedback, direction adjustments, corrected assumptions |
| CLI analysis results | Deepened analysis, adjusted perspective, or specific question answers |

### Phase 4: Synthesis & Conclusion

| Artifact | Purpose |
|----------|---------|
| `conclusions.json` | Final synthesis: key conclusions, recommendations, open questions |
| Final `discussion.md` | Complete analysis timeline with conclusions and final understanding |

---

## Implementation Details

### Session Initialization

The workflow automatically generates a unique session identifier and directory structure based on the topic and current date (UTC+8).

**Session ID Format**: `ANL-{slug}-{date}`
- `slug`: Lowercase alphanumeric + Chinese characters, max 40 chars (derived from topic)
- `date`: YYYY-MM-DD format (UTC+8)

**Session Directory**: `.workflow/.analysis/{sessionId}/`

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

**Analysis Depth** (Single-select):
- 快速概览 (Quick overview, 10-15 minutes)
- 标准分析 (Standard analysis, 30-60 minutes)
- 深度挖掘 (Deep dive, 1-2+ hours)

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

## Phase 2: CLI Exploration

**Objective**: Gather codebase context and execute deep analysis via CLI tools to build understanding of the topic.

**Execution Model**: Sequential (serial) execution - gather codebase context first, then perform CLI analysis building on those findings.

### Step 2.1: Codebase Context Gathering

Use built-in tools to understand the codebase structure and identify relevant code related to the topic.

**Context Gathering Activities**:
1. **Get project structure** - Execute `ccw tool exec get_modules_by_depth '{}'` to understand module organization
2. **Search for related code** - Use Grep/Glob to find files matching topic keywords
3. **Read project tech context** - Load `.workflow/project-tech.json` if available for constraints and integration points
4. **Analyze patterns** - Identify common code patterns and architecture decisions

**exploration-codebase.json Structure**:
- `relevant_files[]`: Files related to the topic with relevance indicators
- `patterns[]`: Common code patterns and architectural styles identified
- `constraints[]`: Project-level constraints that affect the analysis
- `integration_points[]`: Key integration points between modules
- `_metadata`: Timestamp and context information

**Key Information to Capture**:
- Top 5-10 most relevant files with brief descriptions
- Recurring patterns in code organization and naming
- Project constraints (frameworks, architectural styles, tech stack)
- Integration patterns between modules
- Existing solutions or similar implementations

### Step 2.2: Gemini CLI Analysis

Execute a comprehensive CLI analysis building on the codebase context gathered in Step 2.1.

**CLI Execution**: Synchronous analysis via Gemini with mode=analysis

**Prompt Structure**:
- **PURPOSE**: Clear goal and success criteria for the analysis
- **PRIOR CODEBASE CONTEXT**: Incorporate findings from Step 2.1 (top files, patterns, constraints)
- **TASK**: Specific investigation steps (analyze patterns, identify issues, generate insights, create discussion points)
- **MODE**: analysis (read-only)
- **CONTEXT**: Full codebase context with topic reference
- **EXPECTED**: Structured output with evidence-based insights and confidence levels
- **CONSTRAINTS**: Focus dimensions, ignore test files

**Analysis Output Should Include**:
- Structured analysis organized by analysis dimensions
- Specific insights tied to evidence (file references)
- Questions to deepen understanding
- Recommendations with clear rationale
- Confidence levels (high/medium/low) for conclusions
- 3-5 key findings with supporting details

**Execution Guideline**: Wait for CLI analysis to complete before proceeding to aggregation.

### Step 2.3: Aggregate Findings

Consolidate results from codebase context gathering and CLI analysis into a unified findings document.

**explorations.json Structure**:
- `session_id`: Reference to the analysis session
- `timestamp`: Completion time
- `topic`: Original topic/question
- `dimensions[]`: Identified analysis dimensions
- `sources[]`: List of information sources (codebase exploration, CLI analysis)
- `key_findings[]`: Main insights with evidence
- `discussion_points[]`: Questions to engage user
- `open_questions[]`: Unresolved or partially answered questions
- `_metadata`: Processing metadata

**Aggregation Activities**:
1. Extract key findings from CLI analysis output
2. Cross-reference with codebase context
3. Identify discussion points that benefit from user input
4. Note open questions for follow-up investigation
5. Organize findings by analysis dimension

### Step 2.4: Update discussion.md

Append exploration results to the discussion timeline.

**Round 1-2 Sections** (Initial Understanding + Exploration Results):
- **Codebase Findings**: Top relevant files and identified patterns
- **Analysis Results**: Key findings, discussion points, recommendations
- **Sources Analyzed**: Files and code patterns examined

**Documentation Standards**:
- Include direct references to analyzed files (file:line format)
- List discussion points as questions or open items
- Highlight key conclusions with confidence indicators
- Note any constraints that affect the analysis

**Success Criteria**:
- `exploration-codebase.json` created with comprehensive context
- `explorations.json` created with aggregated findings
- `discussion.md` updated with Round 1-2 results
- All explorations completed successfully
- Ready for interactive discussion phase

---

## Phase 3: Interactive Discussion

**Objective**: Iteratively refine understanding through multi-round user-guided discussion cycles.

**Max Rounds**: 5 discussion rounds (can exit earlier if user indicates analysis is complete)

### Step 3.1: Present Findings & Gather Feedback

Display current understanding and exploration findings to the user.

**Presentation Content**:
- Current understanding summary
- Key findings from exploration
- Open questions or areas needing clarification
- Available action options

**User Feedback Options** (AskUserQuestion - single select):

| Option | Purpose | Next Action |
|--------|---------|------------|
| **继续深入** | Analysis direction is correct, deepen investigation | Execute deeper CLI analysis on same topic |
| **调整方向** | Different understanding or focus needed | Ask for adjusted focus, rerun CLI analysis |
| **有具体问题** | Specific questions to ask about the topic | Capture questions, use CLI to answer them |
| **分析完成** | Sufficient information obtained | Exit discussion loop, proceed to synthesis |

### Step 3.2: Deepen Analysis

When user selects "continue deepening", execute more detailed investigation in the same direction.

**Deepening Strategy**:
- Focus on previously identified findings
- Investigate edge cases and special scenarios
- Identify patterns not yet discussed
- Suggest implementation or improvement approaches
- Provide risk/impact assessments

**CLI Execution**: Synchronous analysis via Gemini with emphasis on elaboration and detail.

**Analysis Scope**:
- Expand on prior findings with more specifics
- Investigate corner cases and limitations
- Propose concrete improvement strategies
- Provide risk/impact ratings for findings
- Generate follow-up questions

### Step 3.3: Adjust Direction

When user indicates a different focus is needed, shift the analysis angle.

**Direction Adjustment Process**:
1. Ask user for adjusted focus area (through AskUserQuestion)
2. Determine new analysis angle (different dimension or perspective)
3. Execute CLI analysis from new perspective
4. Compare new insights with prior analysis
5. Identify what was missed and why

**CLI Execution**: Synchronous analysis via Gemini with new perspective.

**Analysis Scope**:
- Analyze topic from different dimension or angle
- Identify gaps in prior analysis
- Generate insights specific to new focus
- Cross-reference with prior findings
- Suggest investigation paths forward

### Step 3.4: Answer Specific Questions

When user has specific questions, address them directly.

**Question Handling Process**:
1. Capture user questions (through AskUserQuestion)
2. Use CLI analysis or direct investigation to answer
3. Provide evidence-based answers with supporting details
4. Offer related follow-up investigations

**CLI Execution**: Synchronous analysis via Gemini focused on specific questions.

**Analysis Scope**:
- Answer each question directly and clearly
- Provide evidence and examples
- Clarify ambiguous or complex points
- Suggest related investigation areas
- Rate confidence for each answer

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

**Available Options** (AskUserQuestion - multi-select):

| Option | Purpose | Action |
|--------|---------|--------|
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

## Configuration

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

| Depth | Duration | Scope | Questions |
|-------|----------|-------|-----------|
| Quick (快速概览) | 10-15 min | Surface level understanding | 3-5 key questions |
| Standard (标准分析) | 30-60 min | Moderate depth with good coverage | 5-8 key questions |
| Deep (深度挖掘) | 1-2+ hours | Comprehensive detailed analysis | 10+ key questions |

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
| CLI timeout | Retry with shorter, focused prompt | Skip analysis or reduce depth |
| No relevant findings | Broaden search keywords or adjust scope | Ask user for clarification |
| User disengaged | Summarize progress and offer break point | Save state for later continuation |
| Max rounds reached (5) | Force synthesis phase | Highlight remaining questions in conclusions |
| Session folder conflict | Append timestamp suffix to session ID | Create unique folder and continue |

---

## Iteration Patterns

### First Analysis Session

```
User initiates: TOPIC="specific question"
   ├─ No session exists → New session mode
   ├─ Parse topic and identify dimensions
   ├─ Scope analysis with user (focus areas, depth)
   ├─ Create discussion.md
   ├─ Gather codebase context
   ├─ Execute Gemini CLI analysis
   ├─ Aggregate findings
   └─ Enter multi-round discussion loop
```

### Continue Existing Session

```
User resumes: TOPIC="same topic" with --continue flag
   ├─ Session exists → Continue mode
   ├─ Load previous discussion.md
   ├─ Load explorations.json
   └─ Resume from last discussion round
```

### Discussion Loop (Rounds 3-5)

```
Each round:
   ├─ Present current findings
   ├─ Gather user feedback
   ├─ Process response:
   │   ├─ Deepen → Deeper CLI analysis on same topic
   │   ├─ Adjust → New CLI analysis with adjusted focus
   │   ├─ Questions → CLI analysis answering specific questions
   │   └─ Complete → Exit loop for synthesis
   ├─ Update discussion.md
   └─ Repeat until user selects complete or max rounds reached
```

### Completion Flow

```
Final synthesis:
   ├─ Consolidate all insights
   ├─ Generate conclusions.json
   ├─ Update discussion.md with final synthesis
   ├─ Offer follow-up options
   └─ Archive session artifacts
```

---

## Best Practices

### Before Starting Analysis

1. **Clear Topic Definition**: Detailed topics lead to better dimension identification
2. **User Context**: Understanding focus preferences helps scope the analysis
3. **Scope Understanding**: Being clear about depth expectations sets correct analysis intensity

### During Analysis

1. **Review Findings**: Check exploration results before proceeding to discussion
2. **Document Assumptions**: Track what you think is true for correction later
3. **Use Continue Mode**: Resume sessions to build on previous findings rather than starting over
4. **Embrace Corrections**: Track wrong→right transformations as valuable learnings
5. **Iterate Thoughtfully**: Each discussion round should meaningfully refine understanding

### Documentation Practices

1. **Evidence-Based**: Every conclusion should reference specific code or patterns
2. **Confidence Levels**: Indicate confidence (high/medium/low) for conclusions
3. **Timeline Clarity**: Use clear timestamps for traceability
4. **Evolution Tracking**: Document how understanding changed across rounds
5. **Action Items**: Generate specific, actionable recommendations

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
