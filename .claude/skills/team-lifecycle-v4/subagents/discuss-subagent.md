# Discuss Subagent

Lightweight multi-perspective critique engine. Called inline by produce roles (analyst, writer, reviewer) instead of as a separate team member. Eliminates spawn overhead while preserving multi-CLI analysis quality.

## Design Rationale

In v3, `discussant` was a full team role requiring: agent spawn -> Skill load -> Phase 1 task discovery -> Phase 2-4 work -> Phase 5 report + callback. For what is essentially "run CLI analyses + synthesize", the framework overhead exceeded actual work time.

In v4, discuss is a **subagent call** from within the producing role, reducing each discuss round from ~60-90s overhead to ~5s overhead.

## Invocation

Called by produce roles after artifact creation:

```
Task({
  subagent_type: "cli-discuss-agent",
  run_in_background: false,
  description: "Discuss <round-id>",
  prompt: `## Multi-Perspective Critique: <round-id>

### Input
- Artifact: <artifact-path>
- Round: <round-id>
- Perspectives: <perspective-list>
- Session: <session-folder>
- Discovery Context: <session-folder>/spec/discovery-context.json (for coverage perspective)

### Perspective Routing

| Perspective | CLI Tool | Role | Focus Areas |
|-------------|----------|------|-------------|
| Product | gemini | Product Manager | Market fit, user value, business viability |
| Technical | codex | Tech Lead | Feasibility, tech debt, performance, security |
| Quality | claude | QA Lead | Completeness, testability, consistency |
| Risk | gemini | Risk Analyst | Risk identification, dependencies, failure modes |
| Coverage | gemini | Requirements Analyst | Requirement completeness vs discovery-context |

### Execution Steps
1. Read artifact from <artifact-path>
2. For each perspective, launch CLI analysis in background:
   Bash(command="ccw cli -p 'PURPOSE: Analyze from <role> perspective for <round-id>
   TASK: <focus-areas>
   MODE: analysis
   CONTEXT: Artifact content below
   EXPECTED: JSON with strengths[], weaknesses[], suggestions[], rating (1-5)
   CONSTRAINTS: Output valid JSON only

   Artifact:
   <artifact-content>' --tool <cli-tool> --mode analysis", run_in_background=true)
3. Wait for all CLI results
4. Divergence detection:
   - Coverage gap: missing_requirements non-empty -> High severity
   - High risk: risk_level is high or critical -> High severity
   - Low rating: any perspective rating <= 2 -> Medium severity
   - Rating spread: max - min >= 3 -> Medium severity
5. Consensus determination:
   - No high-severity divergences AND average rating >= 3.0 -> consensus_reached
   - Otherwise -> consensus_blocked
6. Synthesize:
   - Convergent themes (agreed by 2+ perspectives)
   - Divergent views (conflicting assessments)
   - Coverage gaps
   - Action items from suggestions
7. Write discussion record to: <session-folder>/discussions/<round-id>-discussion.md

### Discussion Record Format
# Discussion Record: <round-id>

**Artifact**: <artifact-path>
**Perspectives**: <list>
**Consensus**: reached / blocked
**Average Rating**: <avg>/5

## Convergent Themes
- <theme>

## Divergent Views
- **<topic>** (<severity>): <description>

## Action Items
1. <item>

## Ratings
| Perspective | Rating |
|-------------|--------|
| <name> | <n>/5 |

### Return Value
Return a summary string with:
- Verdict: consensus_reached or consensus_blocked
- Average rating
- Key action items (top 3)
- Discussion record path

### Error Handling
- Single CLI fails -> fallback to direct Claude analysis for that perspective
- All CLI fail -> generate basic discussion from direct artifact reading
- Artifact not found -> return error immediately`
})
```

## Round Configuration

| Round | Artifact | Perspectives | Calling Role |
|-------|----------|-------------|-------------|
| DISCUSS-001 | spec/discovery-context.json | product, risk, coverage | analyst |
| DISCUSS-002 | spec/product-brief.md | product, technical, quality, coverage | writer |
| DISCUSS-003 | spec/requirements/_index.md | quality, product, coverage | writer |
| DISCUSS-004 | spec/architecture/_index.md | technical, risk | writer |
| DISCUSS-005 | spec/epics/_index.md | product, technical, quality, coverage | writer |
| DISCUSS-006 | spec/readiness-report.md | all 5 | reviewer |

## Integration with Calling Role

The calling role is responsible for:

1. **Before calling**: Complete primary artifact output
2. **Calling**: Invoke discuss subagent with correct round config
3. **After calling**:
   - Include discuss verdict in Phase 5 report
   - If `consensus_blocked` with high-severity divergences -> flag in SendMessage to coordinator
   - Discussion record is written by the subagent, no further action needed

## Comparison with v3

| Aspect | v3 (discussant role) | v4 (discuss subagent) |
|--------|---------------------|----------------------|
| Spawn | Full general-purpose agent | Inline subagent call |
| Skill load | Reads SKILL.md + role.md | None (prompt contains all logic) |
| Task discovery | TaskList + TaskGet + TaskUpdate | None (called with context) |
| Report overhead | team_msg + SendMessage + TaskUpdate | Return value to caller |
| Total overhead | ~25-45s framework | ~5s call overhead |
| Pipeline beat | 1 beat per discuss round | 0 additional beats |
