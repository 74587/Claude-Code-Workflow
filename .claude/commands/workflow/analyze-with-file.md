---
name: analyze-with-file
description: Interactive collaborative analysis with documented discussions, CLI-assisted exploration, and evolving understanding
argument-hint: "[-y|--yes] [-c|--continue] \"topic or question\""
allowed-tools: TodoWrite(*), Agent(*), AskUserQuestion(*), Read(*), Grep(*), Glob(*), Bash(*), Edit(*), Write(*)
---

## Auto Mode

When `--yes` or `-y`: Auto-confirm exploration decisions, use recommended analysis angles.

# Workflow Analyze Command

**Context Source**: cli-explore-agent + Gemini/Codex analysis
**Output Directory**: `.workflow/.analysis/{session-id}/`
**Core Innovation**: Documented discussion timeline with evolving understanding

## Output Artifacts

| Phase | Artifact | Description |
|-------|----------|-------------|
| 1 | `discussion.md` | Initialized with TOC, Current Understanding block, timeline, metadata |
| 1 | Session variables | Dimensions, focus areas, analysis depth |
| 2 | `exploration-codebase.json` | Single codebase context from cli-explore-agent |
| 2 | `explorations/*.json` | Multi-perspective codebase explorations (parallel, up to 4) |
| 2 | `explorations.json` | Single perspective aggregated findings |
| 2 | `perspectives.json` | Multi-perspective findings (up to 4) with synthesis |
| 2 | Updated `discussion.md` | Round 1 + Initial Intent Coverage Check + Current Understanding replaced |
| 3 | Updated `discussion.md` | Round 2-N: feedback, insights, narrative synthesis; TOC + Current Understanding updated each round |
| 4 | `conclusions.json` | Final synthesis with recommendations (incl. steps[] + review_status) |
| 4 | Final `discussion.md` | Complete analysis with conclusions, recommendation review summary, intent coverage matrix |

### Decision Recording Protocol

**CRITICAL**: Record immediately when any of these occur:

| Trigger | What to Record | Target Section |
|---------|---------------|----------------|
| **Direction choice** | What chosen, why, alternatives discarded | `#### Decision Log` |
| **Key finding** | Content, impact scope, confidence level, hypothesis impact | `#### Key Findings` |
| **Assumption change** | Old → new understanding, reason, impact | `#### Corrected Assumptions` |
| **User feedback** | Input, rationale for adoption/adjustment | `#### User Input` |
| **Disagreement & trade-off** | Conflicting views, trade-off basis, final choice | `#### Decision Log` |
| **Scope adjustment** | Before/after scope, trigger reason | `#### Decision Log` |

**Decision Record Format**:
```markdown
> **Decision**: [Description]
> - **Context**: [Trigger]
> - **Options considered**: [Alternatives]
> - **Chosen**: [Approach] — **Reason**: [Rationale]
> - **Rejected**: [Why other options were discarded]
> - **Impact**: [Effect on analysis]
```

**Key Finding Record Format**:
```markdown
> **Finding**: [Content]
> - **Confidence**: [High/Medium/Low] — **Why**: [Evidence basis]
> - **Hypothesis Impact**: [Confirms/Refutes/Modifies] hypothesis "[name]"
> - **Scope**: [What areas this affects]
```

**Principles**: Immediacy (record as-it-happens), Completeness (context+options+chosen+reason+rejected), Traceability (later phases trace back), Depth (capture reasoning, not just outcomes)

## Implementation

### Session Initialization

1. Extract topic/question from `$ARGUMENTS`
2. Generate session ID: `ANL-{slug}-{date}` (slug: lowercase alphanumeric+Chinese, max 40 chars; date: YYYY-MM-DD UTC+8)
3. Define session folder: `.workflow/.analysis/{session-id}`
4. Parse options: `-c`/`--continue` for continuation, `-y`/`--yes` for auto-approval
5. Auto-detect: If session folder + discussion.md exist → continue mode
6. Create directory structure

**Session Variables**: `sessionId`, `sessionFolder`, `autoMode` (boolean), `mode` (new|continue)

### Phase 1: Topic Understanding

1. **Parse Topic & Identify Dimensions** — Match keywords against Analysis Dimensions table
2. **Initial Scoping** (if new session + not auto mode):
   - **Focus**: Multi-select from Dimension-Direction Mapping directions
   - **Perspectives**: Multi-select up to 4 (see Analysis Perspectives), default: single comprehensive
   - **Depth**: Quick Overview (10-15min) / Standard (30-60min) / Deep Dive (1-2hr)
3. **Initialize discussion.md** — Structure includes:
   - **Dynamic TOC** (top of file, updated after each round/phase): `## Table of Contents` with links to major sections
   - **Current Understanding** (replaceable block, overwritten each round — NOT appended): `## Current Understanding` initialized as "To be populated after exploration"
   - Session metadata, user context, initial questions, empty discussion timeline, initial dimension selection rationale
4. **Record Phase 1 Decisions** — Dimension selection reasoning, depth rationale, any user adjustments

**Success**: Session folder + discussion.md created, dimensions identified, preferences captured, decisions recorded

### Phase 2: CLI Exploration

Codebase exploration FIRST, then CLI analysis.

**Step 1: Codebase Exploration** (cli-explore-agent, parallel up to 6)

- **Single**: General codebase analysis → `{sessionFolder}/exploration-codebase.json`
- **Multi-perspective**: Parallel per-perspective → `{sessionFolder}/explorations/{perspective}.json`
- **Common tasks**: `ccw tool exec get_modules_by_depth '{}'`, keyword searches, read `.workflow/project-tech.json`

```javascript
// Template for cli-explore-agent (single or per-perspective)
Agent({
  subagent_type: "cli-explore-agent",
  run_in_background: false,
  description: `Explore codebase: ${topicSlug}`,
  prompt: `
## Analysis Context
Topic: ${topic_or_question}
Dimensions: ${dimensions.join(', ')}
// For multi-perspective, add: Perspective: ${perspective.name} - ${perspective.focus}
Session: ${sessionFolder}

## MANDATORY FIRST STEPS
1. Run: ccw tool exec get_modules_by_depth '{}'
2. Read: .workflow/project-tech.json (if exists)

## Layered Exploration (MUST follow all 3 layers)

### Layer 1 — Module Discovery (Breadth)
- Search by topic keywords, identify ALL relevant files
- Map module boundaries and entry points → relevant_files[] with annotations

### Layer 2 — Structure Tracing (Depth)
- Top 3-5 key files: trace call chains 2-3 levels deep
- Identify data flow paths and dependencies → call_chains[], data_flows[]

### Layer 3 — Code Anchor Extraction (Detail)
- Each key finding: extract code snippet (20-50 lines) with file:line
- Annotate WHY this matters → code_anchors[]

## Output
Write to: ${sessionFolder}/exploration-codebase.json
// Multi-perspective: ${sessionFolder}/explorations/${perspective.name}.json

Schema: {relevant_files, patterns, key_findings, code_anchors: [{file, lines, snippet, significance}], call_chains: [{entry, chain, files}], questions_for_user, _metadata}
`
})
```

**Step 2: CLI Analysis** (AFTER exploration)

- **Single**: Comprehensive CLI analysis with exploration context
- **Multi (up to 4)**: Parallel CLI calls per perspective
- Execution: `Bash` with `run_in_background: true`

```javascript
// Build shared exploration context for CLI prompts
const explorationContext = `
PRIOR EXPLORATION CONTEXT:
- Key files: ${explorationResults.relevant_files.slice(0,5).map(f => f.path).join(', ')}
- Patterns: ${explorationResults.patterns.slice(0,3).join(', ')}
- Findings: ${explorationResults.key_findings.slice(0,3).join(', ')}
- Code anchors:
${(explorationResults.code_anchors || []).slice(0,5).map(a => `  [${a.file}:${a.lines}] ${a.significance}\n  \`\`\`\n  ${a.snippet}\n  \`\`\``).join('\n')}
- Call chains: ${(explorationResults.call_chains || []).slice(0,3).map(c => `${c.entry} → ${c.chain.join(' → ')}`).join('; ')}`

// Single perspective (for multi: loop selectedPerspectives with perspective.purpose/tasks/constraints)
Bash({
  command: `ccw cli -p "
PURPOSE: Analyze '${topic_or_question}' from ${dimensions.join(', ')} perspectives
Success: Actionable insights with clear reasoning

${explorationContext}

TASK:
• Build on exploration findings — reference specific code anchors
• Analyze common patterns and anti-patterns with code evidence
• Highlight potential issues/opportunities with file:line references
• Generate discussion points for user clarification

MODE: analysis
CONTEXT: @**/* | Topic: ${topic_or_question}
EXPECTED: Structured analysis with sections, insights tied to evidence, questions, recommendations
CONSTRAINTS: Focus on ${dimensions.join(', ')}
" --tool gemini --mode analysis`,
  run_in_background: true
})
// STOP: Wait for hook callback before continuing
// Multi-perspective: Same pattern per perspective with perspective.purpose/tasks/constraints/tool
```

**Step 3: Aggregate Findings**
- Consolidate explorations + CLI results
- Multi: Extract synthesis (convergent themes, conflicting views, unique contributions)
- Write to `explorations.json` (single) or `perspectives.json` (multi)

**Step 4: Update discussion.md** — Append Round 1 with sources, key findings, discussion points, open questions

**Step 5: Initial Intent Coverage Check** (FIRST check, before entering Phase 3):
- Re-read original "User Intent" / "Analysis Context" from discussion.md header
- Check each intent item against Round 1 findings: ✅ addressed / 🔄 in-progress / ❌ not yet touched
- Append initial Intent Coverage Check to discussion.md
- Present to user at beginning of Phase 3: "初始探索完成后，以下意图的覆盖情况：[list]。接下来的讨论将重点关注未覆盖的部分。"
- Purpose: Early course correction — catch drift before spending multiple interactive rounds

**explorations.json Schema** (single):
- `session_id`, `timestamp`, `topic`, `dimensions[]`
- `sources[]`: {type, file/summary}
- `key_findings[]`, `code_anchors[]`: {file, lines, snippet, significance}
- `call_chains[]`: {entry, chain, files}
- `discussion_points[]`, `open_questions[]`

**perspectives.json Schema** (multi — extends explorations.json):
- `perspectives[]`: [{name, tool, findings, insights, questions}]
- `synthesis`: {convergent_themes, conflicting_views, unique_contributions}
- code_anchors/call_chains include `perspective` field

**Success**: Exploration + CLI artifacts created, discussion.md Round 1, key findings and exploration decisions recorded

### Phase 3: Interactive Discussion

**Guideline**: Delegate complex tasks to agents (cli-explore-agent) or CLI calls. Avoid direct analysis in main process.

**Loop** (max 5 rounds):

1. **Current Understanding Summary** (Round >= 2, BEFORE presenting new findings):
   - Generate 1-2 sentence recap: "到目前为止，我们已确认 [established facts]。上一轮 [key action/direction]。现在，这是新一轮的发现："
   - Purpose: Reset context, prevent cognitive overload, make incremental progress visible

2. **Present Findings** from explorations.json

3. **Gather Feedback** (AskUserQuestion, single-select):
   - **同意，继续深入**: Direction correct, deepen
   - **同意，并建议下一步**: Agree with direction, but user has specific next step in mind
   - **需要调整方向**: Different focus
   - **分析完成**: Sufficient → exit to Phase 4
   - **有具体问题**: Specific questions

4. **Process Response** (always record user choice + impact to discussion.md):

   **Agree, Deepen** → Dynamically generate deepen directions from current analysis context:
   - Extract 2-3 context-driven options from: unresolved questions in explorations.json, low-confidence findings, unexplored dimensions, user-highlighted areas
   - Generate 1-2 heuristic options that break current frame: e.g., "compare with best practices in [related domain]", "analyze under extreme load scenarios", "review from security audit perspective", "explore simpler architectural alternatives"
   - Each option specifies: label, description, tool (cli-explore-agent for code-level / Gemini CLI for pattern-level), scope
   - AskUserQuestion with generated options (single-select)
   - Execute selected direction via corresponding tool
   - Merge new code_anchors/call_chains into existing results
   - Record confirmed assumptions + deepen angle

   **Agree, Suggest Next Step** → AskUserQuestion (free text: "请描述您希望下一步深入的方向") → Execute user's specific direction via cli-explore-agent or CLI → Record user-driven exploration rationale

   **Adjust Direction** → AskUserQuestion for new focus → new CLI exploration → Record Decision (old vs new direction, reason, impact)

   **Specific Questions** → Capture, answer via CLI/analysis, document Q&A → Record gaps revealed + new understanding

   **Complete** → Exit loop → Record why concluding

5. **Update discussion.md**:
   - **Append** Round N: user input, direction adjustment, Q&A, corrections, new insights
   - **Replace** `## Current Understanding` block with latest consolidated understanding (follow Consolidation Rules: promote confirmed, track corrections, focus on NOW)
   - **Update** `## Table of Contents` with links to new Round N sections

6. **Round Narrative Synthesis** (append to discussion.md after each round update):
   ```markdown
   ### Round N: Narrative Synthesis
   **起点**: 基于上一轮的 [conclusions/questions]，本轮从 [starting point] 切入。
   **关键进展**: [New findings] [confirmed/refuted/modified] 了之前关于 [hypothesis] 的理解。
   **决策影响**: 用户选择 [feedback type]，导致分析方向 [adjusted/deepened/maintained]。
   **当前理解**: 经过本轮，核心认知更新为 [updated understanding]。
   **遗留问题**: [remaining questions driving next round]
   ```

7. **Intent Drift Check** (every round >= 2):
   - Re-read original "User Intent" from discussion.md header
   - Check each item: addressed / in-progress / implicitly absorbed / not yet discussed
   ```markdown
   #### Intent Coverage Check
   - ✅ Intent 1: [addressed in Round N]
   - 🔄 Intent 2: [in-progress]
   - ⚠️ Intent 3: [implicitly absorbed by X — needs confirmation]
   - ❌ Intent 4: [not yet discussed]
   ```
   - If ❌ or ⚠️ items exist → **proactively surface** to user at start of next round: "以下原始意图尚未充分覆盖：[list]。是否需要调整优先级？"

**Success**: All rounds documented with narrative synthesis, assumptions corrected, all decisions recorded with rejection reasoning, direction changes with before/after

### Phase 4: Synthesis & Conclusion

1. **Intent Coverage Verification** (MANDATORY before synthesis):
   - Check each original intent: ✅ Addressed / 🔀 Transformed / ⚠️ Absorbed / ❌ Missed
   ```markdown
   ### Intent Coverage Matrix
   | # | Original Intent | Status | Where Addressed | Notes |
   |---|----------------|--------|-----------------|-------|
   | 1 | [intent] | ✅ Addressed | Round N, Conclusion #M | |
   | 2 | [intent] | 🔀 Transformed | Round N → M | Original: X → Final: Y |
   | 3 | [intent] | ❌ Missed | — | Reason |
   ```
   - **Gate**: ❌ Missed items must be either (a) addressed in additional round or (b) confirmed deferred by user
   - Add `intent_coverage[]` to conclusions.json

2. **Consolidate Insights**:
   - Compile Decision Trail from all phases
   - Key conclusions with evidence + confidence (high/medium/low)
   - Recommendations with rationale + priority (high/medium/low)
   - Open questions, follow-up suggestions
   - Decision summary linking conclusions back to decisions
   - Write to conclusions.json

3. **Final discussion.md Update**:
   - **Conclusions**: Summary, ranked key conclusions, prioritized recommendations, remaining questions
   - **Current Understanding (Final)**: What established, what clarified/corrected, key insights
   - **Decision Trail**: Critical decisions, direction changes timeline, trade-offs
   - Session statistics: rounds, duration, sources, artifacts, decision count

4. **Display Conclusions Summary** — Present to user:
   - **Analysis Report**: summary, key conclusions (numbered, with confidence), recommendations (numbered, with priority + rationale + steps)
   - Open questions if any
   - Link to full report: `{sessionFolder}/discussion.md`

5. **Interactive Recommendation Review** (skip in auto mode):

   Walk through each recommendation one-by-one for user confirmation:

   ```
   For each recommendation (ordered by priority high→medium→low):
     1. Present: action, rationale, priority, steps[] (numbered sub-steps)
     2. AskUserQuestion (single-select, header: "Rec #N"):
        - **确认**: Accept as-is → review_status = "accepted"
        - **修改**: User adjusts scope/steps → record modification → review_status = "modified"
        - **删除**: Not needed → record reason → review_status = "rejected"
        - **跳过逐条审议**: Accept all remaining as-is → break loop
     3. Record review decision to discussion.md Decision Log
     4. Update conclusions.json recommendation.review_status
   ```

   **After review loop**: Display summary of reviewed recommendations:
   - Accepted: N items | Modified: N items | Rejected: N items
   - Only accepted/modified recommendations proceed to next step

6. **Post-Completion Options** (analyze-with-file transitions based on user selection):

   > **WORKFLOW TRANSITION**: "执行任务" MUST invoke `Skill(skill="workflow-lite-plan")` — do NOT end without calling it.

   AskUserQuestion (single-select, header: "Next Step"):
   - **执行任务** (Recommended if high/medium priority recs exist): Launch workflow-lite-plan
   - **产出Issue**: Convert recommendations to issues via /issue:new
   - **完成**: No further action

   **Handle "产出Issue"**:
   1. For each recommendation in conclusions.recommendations (priority high/medium):
      - Build issue JSON: `{title, context: rec.action + rec.rationale, priority: rec.priority == 'high' ? 2 : 3, source: 'discovery', labels: dimensions}`
      - Create via pipe: `echo '<issue-json>' | ccw issue create`
   2. Display created issue IDs with next step hint: `/issue:plan <id>`

   **Handle "执行任务"** — MUST invoke Skill tool (do NOT just display a summary and stop):
   1. Build `taskDescription` from high/medium priority recommendations (fallback: summary)
   2. Assemble context: `## Prior Analysis ({sessionId})` + summary + key files (up to 8) + key findings (up to 5) from exploration-codebase.json
   3. **MANDATORY — Invoke Skill tool immediately** (this is the ONLY correct action, do NOT skip):
      ```javascript
      Skill({ skill: "workflow-lite-plan", args: `${taskDescription}\n\n${contextLines}` })
      ```
      If Skill invocation is omitted, the workflow is BROKEN — user selected "执行任务" specifically to launch lite-plan.
   4. After Skill invocation, analyze-with-file is complete — do not output any additional content

**conclusions.json Schema**:
- `session_id`, `topic`, `completed`, `total_rounds`, `summary`
- `key_conclusions[]`: {point, evidence, confidence, code_anchor_refs[]}
- `code_anchors[]`: {file, lines, snippet, significance}
- `recommendations[]`: {action, rationale, priority, steps[]: {description, target, verification}, review_status: accepted|modified|rejected|pending}
- `open_questions[]`, `follow_up_suggestions[]`: {type, summary}
- `decision_trail[]`: {round, decision, context, options_considered, chosen, rejected_reasons, reason, impact}
- `narrative_trail[]`: {round, starting_point, key_progress, hypothesis_impact, updated_understanding, remaining_questions}
- `intent_coverage[]`: {intent, status, where_addressed, notes}

**Success**: conclusions.json created, discussion.md finalized, Intent Coverage Matrix verified, complete decision trail documented

## Configuration

### Analysis Perspectives

| Perspective | Tool | Focus | Best For |
|------------|------|-------|----------|
| **Technical** | Gemini | Implementation, code patterns, feasibility | How + technical details |
| **Architectural** | Claude | System design, scalability, interactions | Structure + organization |
| **Business** | Codex | Value, ROI, stakeholder impact | Business implications |
| **Domain Expert** | Gemini | Domain patterns, best practices, standards | Industry knowledge |

User multi-selects up to 4 in Phase 1, default: single comprehensive view.

### Dimension-Direction Mapping

| Dimension | Possible Directions |
|-----------|-------------------|
| architecture | System Design, Component Interactions, Technology Choices, Integration Points, Design Patterns, Scalability |
| implementation | Code Structure, Details, Patterns, Error Handling, Testing, Algorithm Analysis |
| performance | Bottlenecks, Optimization, Resource Utilization, Caching, Concurrency |
| security | Vulnerabilities, Auth, Access Control, Data Protection, Input Validation |
| concept | Foundation, Core Mechanisms, Patterns, Theory, Trade-offs |
| comparison | Solution Comparison, Pros/Cons, Technology Evaluation, Approach Differences |
| decision | Criteria, Trade-off Analysis, Risk Assessment, Impact, Implementation Implications |

Present 2-3 top directions per dimension, allow multi-select + custom.

### Analysis Dimensions

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

| Rule | Description |
|------|-------------|
| Promote confirmed insights | Move validated findings to "What We Established" |
| Track corrections | Keep important wrong→right transformations |
| Focus on current state | What do we know NOW |
| Avoid timeline repetition | Don't copy discussion details |
| Preserve key learnings | Keep insights valuable for future reference |

## Error Handling

| Error | Resolution |
|-------|------------|
| cli-explore-agent fails | Continue with available context, note limitation |
| CLI timeout | Retry with shorter prompt, or skip perspective |
| User timeout | Save state, show resume command |
| Max rounds reached | Force synthesis, offer continuation |
| No relevant findings | Broaden search, ask user for clarification |
| Session folder conflict | Append timestamp suffix |
| Gemini unavailable | Fallback to Codex or manual analysis |

> **Lite-plan handoff**: Phase 4「执行任务」assembles analysis context as inline `## Prior Analysis` block, allowing lite-plan to skip redundant exploration.

---

**Now execute analyze-with-file for**: $ARGUMENTS
