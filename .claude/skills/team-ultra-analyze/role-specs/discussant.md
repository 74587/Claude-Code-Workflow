---
prefix: DISCUSS
inner_loop: false
subagents: [cli-explore-agent]
message_types:
  success: discussion_processed
  error: error
---

# Discussant

Process analysis results and user feedback. Execute direction adjustments, deep-dive explorations, or targeted Q&A based on discussion type. Update discussion timeline.

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Task description | From task subject/description | Yes |
| Session path | Extracted from task description | Yes |
| Analysis results | `<session>/analyses/*.json` | Yes |
| Exploration results | `<session>/explorations/*.json` | No |

1. Extract session path, topic, round, discussion type, user feedback:

| Field | Pattern | Default |
|-------|---------|---------|
| sessionFolder | `session:\s*(.+)` | required |
| topic | `topic:\s*(.+)` | required |
| round | `round:\s*(\d+)` | 1 |
| discussType | `type:\s*(.+)` | "initial" |
| userFeedback | `user_feedback:\s*(.+)` | empty |

2. Read all analysis and exploration results
3. Aggregate current findings, insights, open questions

## Phase 3: Discussion Processing

Select strategy by discussion type:

| Type | Mode | Description |
|------|------|-------------|
| initial | inline | Aggregate all analyses: convergent themes, conflicts, top discussion points |
| deepen | subagent | Spawn cli-explore-agent to investigate open questions deeper |
| direction-adjusted | cli | Re-analyze via `ccw cli` from adjusted perspective |
| specific-questions | subagent | Targeted exploration answering user questions |

**initial**: Cross-perspective summary -- identify convergent themes, conflicting views, top 5 discussion points and open questions from all analyses.

**deepen**: Spawn cli-explore-agent focused on open questions and uncertain insights:
```
Task({
  subagent_type: "cli-explore-agent",
  run_in_background: false,
  prompt: "Focus on open questions: <questions>. Find evidence for uncertain insights. Write to: <session>/discussions/deepen-<num>.json"
})
```

**direction-adjusted**: CLI re-analysis from adjusted focus:
```
ccw cli -p "Re-analyze '<topic>' with adjusted focus on '<userFeedback>'" --tool gemini --mode analysis
```

**specific-questions**: Spawn cli-explore-agent targeting user's questions:
```
Task({ subagent_type: "cli-explore-agent", prompt: "Answer: <userFeedback>. Write to: <session>/discussions/questions-<num>.json" })
```

## Phase 4: Update Discussion Timeline

1. Write round content to `<session>/discussions/discussion-round-<num>.json`:
```json
{
  "round": 1, "type": "initial", "user_feedback": "...",
  "updated_understanding": { "confirmed": [], "corrected": [], "new_insights": [] },
  "new_findings": [], "new_questions": [], "timestamp": "..."
}
```

2. Append round section to `<session>/discussion.md`:
```markdown
### Round <N> - Discussion (<timestamp>)
#### Type: <discussType>
#### User Input: <userFeedback or "(Initial discussion round)">
#### Updated Understanding
**Confirmed**: <list> | **Corrected**: <list> | **New Insights**: <list>
#### New Findings / Open Questions
```

Update `<session>/wisdom/.msg/meta.json` under `discussant` namespace:
- Read existing -> merge `{ "discussant": { round, type, new_insight_count, corrected_count } }` -> write back
