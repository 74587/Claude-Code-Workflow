# Output Templates Specification

CCW 标准输出格式模板，确保一致的用户体验。

## Template Categories

| Category | Usage | Key Elements |
|----------|-------|--------------|
| Classification | Intent/complexity output | Intent, Complexity, Source |
| Planning | Chain selection output | Chain, Steps, Estimated time |
| Clarification | User interaction | Questions, Options, Context |
| Execution | Progress updates | Step, Status, Progress bar |
| Summary | Final results | Completed, Duration, Artifacts |

## Classification Output Template

```markdown
### Classification Summary

- **Source**: [Rule-Based|CLI-Assisted] ([confidence]% confidence)
- **Intent**: [intent_type] ([variant])
- **Complexity**: [low|medium|high]
- **Reasoning**: [brief explanation]

**Recommended Workflow**: [chain_name]
```

### Example

```markdown
### Classification Summary

- **Source**: CLI-Assisted (85% confidence)
- **Intent**: feature (implementation)
- **Complexity**: medium
- **Reasoning**: Request involves creating new functionality with moderate scope

**Recommended Workflow**: lite-plan → lite-execute
```

## Requirement Analysis Template

```markdown
### Requirement Analysis

**Input**: [truncated user input...]

| Dimension | Value | Status |
|-----------|-------|--------|
| WHAT | [action] [target] | ✓ extracted |
| WHERE | [scope]: [paths] | ✓ extracted |
| WHY | [goal] | ⚠ inferred |
| HOW | [constraints] | ✗ missing |

**Clarity Score**: [score]/3 ([level])
**Action**: [proceed|clarify|confirm]
```

## Planning Output Template

```markdown
### Workflow Planning

**Selected Chain**: [chain_name] ([chain_id])
**Description**: [chain_description]
**Complexity**: [chain_complexity]
**Estimated Time**: [estimated_time]

**Execution Steps**:
| # | Command | Auto | Description |
|---|---------|------|-------------|
| 1 | [command] | [Y/N] | [step description] |
| 2 | [command] | [Y/N] | [step description] |

**Risks**: [identified risks or "None identified"]
**Suggestions**: [optimization suggestions or "N/A"]
```

## Clarification Output Template

```markdown
### Clarification Needed

Your request needs more detail. Please help me understand:

**Missing Information**:
- [ ] [dimension]: [what's needed]

**Questions**:
[AskUserQuestion widget renders here]
```

## Execution Progress Template

```markdown
### Execution Progress

**Workflow**: [chain_name]
**Status**: [step N of M]

[████████░░░░░░░░] 50% (2/4 steps)

**Current Step**: [current command]
**Completed**:
- ✓ [step 1 command]
- ✓ [step 2 command]

**Pending**:
- ○ [step 3 command]
- ○ [step 4 command]
```

## Summary Output Template

```markdown
### Workflow Complete

**Chain**: [chain_name]
**Duration**: [elapsed time]
**Steps**: [completed]/[total]

**Results**:
| Step | Status | Notes |
|------|--------|-------|
| [command] | ✓ | [result notes] |

**Artifacts Generated**:
- [artifact path]

**Next Actions** (optional):
- [suggested follow-up]
```

## Error Output Template

```markdown
### Workflow Error

**Step**: [failed step command]
**Error**: [error message]

**Possible Causes**:
- [cause 1]
- [cause 2]

**Suggested Actions**:
1. [action 1]
2. [action 2]

Type `retry` to retry or `abort` to stop.
```

## Issue Workflow Templates

### Issue Discovery Output

```markdown
### Issue Discovery

**Perspectives Analyzed**: [list of perspectives]
**Issues Found**: [count]

| ID | Type | Severity | Location | Description |
|----|------|----------|----------|-------------|
| [ISS-xxx] | [type] | [severity] | [file:line] | [brief] |

**Recommended Next Step**: `/issue:new` or `/issue:plan`
```

### Issue Queue Output

```markdown
### Execution Queue

**Queue ID**: [QUE-xxx]
**Total Solutions**: [count]
**Execution Groups**: [count]

**Queue Structure**:
```
[P1] Parallel Group (2 solutions)
  ├─ SOL-001: [description]
  └─ SOL-002: [description]
     ↓
[S1] Sequential (depends on P1)
  └─ SOL-003: [description]
```

**Conflicts Detected**: [count] ([severity level])
```

### Issue Execution Progress

```markdown
### Issue Execution

**Queue**: [QUE-xxx]
**Progress**: [completed]/[total] solutions

[████████░░░░░░░░] 50%

**Current Group**: [P1|S1|...]
**Executing**: [SOL-xxx] - [description]

**Completed**:
- ✓ SOL-001: [result]
- ✓ SOL-002: [result]

**ETA**: [estimated time remaining]
```

## Implementation Guide

```javascript
// Template rendering function
function renderTemplate(templateType, data) {
  const templates = {
    classification: renderClassification,
    requirement: renderRequirement,
    planning: renderPlanning,
    clarification: renderClarification,
    execution: renderExecution,
    summary: renderSummary,
    error: renderError
  }
  
  return templates[templateType](data)
}

// Example: Classification template
function renderClassification(data) {
  return `### Classification Summary

- **Source**: ${data.source} ${data.confidence ? `(${Math.round(data.confidence * 100)}% confidence)` : ''}
- **Intent**: ${data.intent.type}${data.intent.variant ? ` (${data.intent.variant})` : ''}
- **Complexity**: ${data.complexity}
${data.reasoning ? `- **Reasoning**: ${data.reasoning}` : ''}

**Recommended Workflow**: ${data.workflow}`
}

// Progress bar helper
function renderProgressBar(completed, total, width = 16) {
  const filled = Math.round((completed / total) * width)
  const empty = width - filled
  const percentage = Math.round((completed / total) * 100)
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage}% (${completed}/${total})`
}
```

## Consistency Rules

1. **Headers**: Always use `###` for section headers
2. **Tables**: Use markdown tables for structured data
3. **Status Icons**: ✓ (done), ○ (pending), ⚠ (warning), ✗ (error)
4. **Progress**: Always show percentage and fraction
5. **Timing**: Show elapsed time in human-readable format
6. **Paths**: Show relative paths when possible
