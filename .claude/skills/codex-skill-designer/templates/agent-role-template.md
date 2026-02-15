# Agent Role Template

Template for generating per-agent role definition files.

## Purpose

| Phase | Usage |
|-------|-------|
| Phase 0 | Read to understand agent role file structure |
| Phase 3 | Apply with agent-specific content |

---

## Template

```markdown
---
name: {{agent_name}}
description: |
  {{description}}
color: {{color}}
skill: {{parent_skill_name}}
---

# {{agent_display_name}}

{{description_paragraph}}

## Core Capabilities

{{#each capabilities}}
{{@index}}. **{{this.name}}**: {{this.description}}
{{/each}}

## Execution Process

### Step 1: Context Loading

**MANDATORY**: Execute these steps FIRST before any other action.

1. Read this role definition file (already done if you're reading this)
2. Read: `.workflow/project-tech.json` — understand project technology stack
3. Read: `.workflow/project-guidelines.json` — understand project conventions
4. Parse the TASK ASSIGNMENT from the spawn message for:
   - **Goal**: What to achieve
   - **Scope**: What's allowed and forbidden
   - **Context**: Relevant background information
   - **Deliverables**: Expected output format
   - **Quality bar**: Success criteria

### Step 2: {{primary_action_name}}

{{primary_action_detail}}

\`\`\`javascript
// {{primary_action_description}}
{{primary_action_code}}
\`\`\`

### Step 3: {{secondary_action_name}}

{{secondary_action_detail}}

\`\`\`javascript
// {{secondary_action_description}}
{{secondary_action_code}}
\`\`\`

### Step 4: Output Delivery

Produce structured output following this EXACT template:

\`\`\`text
Summary:
- One-sentence completion summary

Findings:
- Finding 1: [specific description with file:line references]
- Finding 2: [specific description]

Proposed changes:
- File: [path/to/file]
- Change: [specific modification description]
- Risk: [low/medium/high] - [impact description]

Tests:
- Test cases: [list of needed test cases]
- Commands: [test commands to verify]

Open questions:
1. [Question needing clarification, if any]
2. [Question needing clarification, if any]
\`\`\`

**Important**: If there are open questions that block progress, prepend output with:
\`\`\`
CLARIFICATION_NEEDED:
Q1: [question] | Options: [A, B, C] | Recommended: [A]
Q2: [question] | Options: [A, B] | Recommended: [B]
\`\`\`

## Key Reminders

**ALWAYS**:
- Read role definition file as FIRST action (Step 1)
- Follow structured output template EXACTLY
- Stay within the assigned Scope boundaries
- Include file:line references in Findings
- Report open questions via CLARIFICATION_NEEDED format
- Provide actionable, specific deliverables

**NEVER**:
- Modify files outside the assigned Scope
- Skip context loading (Step 1)
- Produce unstructured or free-form output
- Make assumptions about unclear requirements (ask instead)
- Exceed the defined Quality bar without explicit approval
- Ignore the Goal/Scope/Deliverables from TASK ASSIGNMENT

## Error Handling

| Scenario | Action |
|----------|--------|
| Cannot access required file | Report in Open questions, continue with available data |
| Task scope unclear | Output CLARIFICATION_NEEDED, provide best-effort findings |
| Unexpected error | Report error details in Summary, include partial results |
| Quality bar not achievable | Report gap in Summary, explain constraints |
```

---

## Template Variants by Responsibility Type

### Exploration Agent

**Step 2**: Codebase Discovery
```javascript
// Search for relevant code patterns
const files = Glob("src/**/*.{ts,js,tsx,jsx}")
const matches = Grep(targetPattern, files)
// Trace call chains, identify entry points
```

**Step 3**: Pattern Analysis
```javascript
// Analyze discovered patterns
// Cross-reference with project conventions
// Identify similar implementations
```

### Implementation Agent

**Step 2**: Code Implementation
```javascript
// Implement changes according to plan
// Follow existing code patterns
// Maintain backward compatibility
```

**Step 3**: Self-Validation
```javascript
// Run relevant tests
// Check for syntax/type errors
// Verify changes match acceptance criteria
```

### Analysis Agent

**Step 2**: Multi-Dimensional Analysis
```javascript
// Analyze from assigned perspective (security/perf/quality/etc.)
// Collect evidence with file:line references
// Classify findings by severity
```

**Step 3**: Recommendation Generation
```javascript
// Propose fixes for each finding
// Assess risk and effort
// Prioritize by impact
```

### Testing Agent

**Step 2**: Test Design
```javascript
// Identify test scenarios from requirements
// Design test cases with expected results
// Map to test frameworks
```

**Step 3**: Test Execution & Validation
```javascript
// Run tests
// Collect pass/fail results
// Iterate on failures
```

---

## Variable Reference

| Variable | Source | Description |
|----------|--------|-------------|
| `{{agent_name}}` | config.name | Agent identifier (lowercase, hyphenated) |
| `{{agent_display_name}}` | Derived from name | Human-readable title |
| `{{description}}` | config.description | Short description (1-3 lines) |
| `{{description_paragraph}}` | config.description | Full paragraph description |
| `{{color}}` | Auto-assigned | Terminal color for output |
| `{{parent_skill_name}}` | codexSkillConfig.name | Parent skill identifier |
| `{{capabilities}}` | Inferred from responsibility | Array of capability objects |
| `{{primary_action_name}}` | Derived from responsibility | Step 2 title |
| `{{primary_action_detail}}` | Generated or from source | Step 2 content |
| `{{secondary_action_name}}` | Derived from responsibility | Step 3 title |
| `{{secondary_action_detail}}` | Generated or from source | Step 3 content |
