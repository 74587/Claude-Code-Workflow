# Phase 1: Lite Plan

## Overview

Serial lightweight planning with CLI-powered exploration and search verification. Produces `.task/TASK-*.json` (one file per task) compatible with `collaborative-plan-with-file` output format, consumable by `unified-execute-with-file`.

**Core capabilities:**
- Intelligent task analysis with automatic exploration detection
- Serial CLI exploration (ccw cli, default gemini / fallback claude) per angle
- Search verification after each CLI exploration (ACE search, Grep, Glob)
- Interactive clarification after exploration to gather missing information
- Direct planning by Claude (all complexity levels, no agent delegation)
- Unified multi-file task output (`.task/TASK-*.json`) with convergence criteria

## Parameters

| Parameter | Description |
|-----------|-------------|
| `-y`, `--yes` | Skip all confirmations (auto mode) |
| `-e`, `--explore` | Force code exploration phase (overrides auto-detection) |
| `<task-description>` | Task description or path to .md file (required) |

## Output Artifacts

| Artifact | Description |
|----------|-------------|
| `exploration-{angle}.md` | Per-angle CLI exploration results (verified) |
| `explorations-manifest.json` | Index of all exploration files |
| `exploration-notes.md` | Synthesized exploration notes (all angles combined) |
| `requirement-analysis.json` | Complexity assessment and session metadata |
| `.task/TASK-*.json` | Multi-file task output (one JSON file per task) |
| `plan.md` | Human-readable summary with execution command |

**Output Directory**: `{projectRoot}/.workflow/.lite-plan/{session-id}/`

## Auto Mode Defaults

When `--yes` or `-y` flag is used:
- **Clarification Questions**: Skipped (no clarification phase)
- **Plan Confirmation**: Auto-selected "Allow"

**Flag Parsing**:
```javascript
const autoYes = $ARGUMENTS.includes('--yes') || $ARGUMENTS.includes('-y')
const forceExplore = $ARGUMENTS.includes('--explore') || $ARGUMENTS.includes('-e')
```

## Execution Process

```
Phase 1: Task Analysis & Exploration
   ├─ Parse input (description or .md file)
   ├─ Intelligent complexity assessment (Low/Medium/High)
   ├─ Exploration decision (auto-detect or --explore flag)
   └─ Decision:
      ├─ needsExploration=true → Serial CLI exploration (1-4 angles)
      │   └─ For each angle: CLI call → Search verification → Save results
      └─ needsExploration=false → Skip to Phase 2/3

Phase 2: Clarification (optional, multi-round)
   ├─ Extract clarification needs from exploration results
   ├─ Deduplicate similar questions
   └─ ASK_USER (max 4 questions per round, multiple rounds)

Phase 3: Planning → .task/*.json (NO CODE EXECUTION)
   ├─ Load exploration notes + clarifications + project context
   ├─ Direct Claude planning (following unified task JSON schema)
   ├─ Generate .task/TASK-*.json (one file per task)
   └─ Generate plan.md (human-readable summary)

Phase 4: Confirmation
   ├─ Display plan summary (tasks, complexity, dependencies)
   └─ ASK_USER: Allow / Modify / Cancel

Phase 5: Handoff
   └─ → unified-execute-with-file with .task/ directory
```

## Implementation

### Phase 1: Serial CLI Exploration with Search Verification

#### Session Setup (MANDATORY)

##### Step 0: Determine Project Root

检测项目根目录，确保 `.workflow/` 产物位置正确：

```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
```

优先通过 git 获取仓库根目录；非 git 项目回退到 `pwd` 取当前绝对路径。
存储为 `{projectRoot}`，后续所有 `.workflow/` 路径必须以此为前缀。

##### Step 1: Generate Session ID

Generate session ID and create session folder:

- **Session ID format**: `{task-slug}-{YYYY-MM-DD}`
  - `task-slug`: lowercase task description, non-alphanumeric replaced with `-`, max 40 chars
  - Date: UTC+8 (China Standard Time), format `2025-11-29`
  - Example: `implement-jwt-refresh-2025-11-29`
- **Session Folder**: `{projectRoot}/.workflow/.lite-plan/{session-id}/`
- Create folder via `mkdir -p` and verify existence

#### Exploration Decision

Exploration is needed when **ANY** of these conditions are met:

- `--explore` / `-e` flag is set
- Task mentions specific files
- Task requires codebase context understanding
- Task needs architecture understanding
- Task modifies existing code

If none apply → skip to Phase 2 (Clarification) or Phase 3 (Planning).

**⚠️ Context Protection**: If file reading would exceed ≥50k chars → force CLI exploration to delegate context gathering.

#### Complexity Assessment

Analyze task complexity based on four dimensions:

| Dimension | Low | Medium | High |
|-----------|-----|--------|------|
| **Scope** | Single file, isolated | Multiple files, some dependencies | Cross-module, architectural |
| **Depth** | Surface change | Moderate structural impact | Architectural impact |
| **Risk** | Minimal | Moderate | High risk of breaking |
| **Dependencies** | None | Some interconnection | Highly interconnected |

#### Exploration Angle Selection

Angles are assigned based on task type keyword matching, then sliced by complexity:

| Task Type | Keywords | Angle Presets (priority order) |
|-----------|----------|-------------------------------|
| Architecture | refactor, architect, restructure, modular | architecture, dependencies, modularity, integration-points |
| Security | security, auth, permission, access | security, auth-patterns, dataflow, validation |
| Performance | performance, slow, optimi, cache | performance, bottlenecks, caching, data-access |
| Bugfix | fix, bug, error, issue, broken | error-handling, dataflow, state-management, edge-cases |
| Feature (default) | — | patterns, integration-points, testing, dependencies |

**Angle count by complexity**: Low → 1, Medium → 3, High → 4

Display exploration plan summary (complexity, selected angles) before starting.

#### Serial CLI Exploration Loop

For each selected exploration angle, execute the following three steps **serially**:

##### Step A: CLI Exploration Call

Execute `ccw cli` to explore codebase from the specific angle:

```bash
ccw cli -p "PURPOSE: Explore codebase from {angle} perspective for task planning context; success = actionable findings with file:line references verified against actual code
TASK: • Analyze project structure relevant to {angle} • Identify files and modules related to {angle} • Discover existing patterns and conventions for {angle} • Find integration points and dependencies (with file:line locations) • Identify constraints and risks from {angle} viewpoint • List questions needing user clarification
MODE: analysis
CONTEXT: @**/* | Memory: Task: {task_description}
EXPECTED: Structured analysis with sections: 1) Project structure overview 2) Relevant files with relevance assessment (high/medium/low) 3) Existing patterns (with code examples) 4) Dependencies 5) Integration points (file:line) 6) Constraints 7) Clarification questions
CONSTRAINTS: Focus on {angle} perspective | Analysis only | Include file:line references" --tool gemini --mode analysis --rule analysis-analyze-code-patterns
```

**CLI Tool Selection**:
- Default: `--tool gemini` (gemini-2.5-flash)
- Fallback: `--tool claude` (if gemini fails or is unavailable)

**Execution Mode**: `Bash({ command: "ccw cli ...", run_in_background: true })` → Wait for completion

##### Step B: Search Verification

After CLI exploration returns, verify key findings inline using search tools:

```
For each key finding from CLI result:
├─ Files mentioned → Glob to verify existence, Read to verify content
├─ Patterns mentioned → Grep to verify pattern presence in codebase
├─ Integration points → mcp__ace-tool__search_context to verify context accuracy
└─ Dependencies → Grep to verify import/export relationships

Verification rules:
├─ File exists? → Mark as ✅ verified
├─ File not found? → Mark as ⚠️ unverified, note in output
├─ Pattern confirmed? → Include with code reference
└─ Pattern not found? → Exclude or mark as uncertain
```

**Verification Checklist**:
- [ ] All mentioned files verified to exist
- [ ] Patterns described match actual code
- [ ] Integration points confirmed at correct file:line locations
- [ ] Dependencies are accurate (imports/exports verified)

##### Step C: Save Verified Exploration Results

Save verified exploration results as Markdown:

```markdown
# Exploration: {angle}

**Task**: {task_description}
**Timestamp**: {ISO timestamp}
**CLI Tool**: gemini / claude

---

## Findings

### Project Structure
{verified structure relevant to this angle}

### Relevant Files

| File | Relevance | Rationale | Verified |
|------|-----------|-----------|----------|
| `src/auth/login.ts` | high | Core authentication logic | ✅ |
| `src/middleware/auth.ts` | medium | Auth middleware chain | ✅ |

### Patterns
{verified patterns with actual code examples from codebase}

### Integration Points
{verified integration points with file:line references}

### Dependencies
{verified dependency relationships}

### Constraints
{angle-specific constraints discovered}

### Clarification Needs
{questions that need user input, with suggested options}
```

**Write**: `{sessionFolder}/exploration-{angle}.md`

#### Manifest Generation

After all angle explorations complete:

1. **Build manifest** — Create `explorations-manifest.json`:
   ```javascript
   {
     session_id: sessionId,
     task_description: taskDescription,
     timestamp: getUtc8ISOString(),
     complexity: complexity,
     exploration_count: selectedAngles.length,
     explorations: selectedAngles.map((angle, i) => ({
       angle: angle,
       file: `exploration-${angle}.md`,
       path: `${sessionFolder}/exploration-${angle}.md`,
       index: i
     }))
   }
   ```
2. **Write** — Save to `{sessionFolder}/explorations-manifest.json`

#### Generate Exploration Notes

Synthesize all exploration Markdown files into a unified notes document.

**Steps**:

1. **Load** all exploration Markdown files via manifest
2. **Extract core files** — Collect all "Relevant Files" tables, deduplicate by path, sort by relevance
3. **Build exploration notes** — 6-part Markdown document (structure below)
4. **Write** to `{sessionFolder}/exploration-notes.md`

**Exploration Notes Structure** (`exploration-notes.md`):

```markdown
# Exploration Notes: {task_description}

**Generated**: {timestamp}  |  **Complexity**: {complexity}
**Exploration Angles**: {angles}

---

## Part 1: Multi-Angle Exploration Summary
Per angle: Key Files (priority sorted), Code Patterns, Integration Points, Dependencies, Constraints

## Part 2: Core Files Index
Top 10 files across all angles, with cross-references and structural details

## Part 3: Architecture Reasoning
Synthesized architectural insights from all angles

## Part 4: Risks and Mitigations
Derived from explorations and core file analysis

## Part 5: Clarification Questions Summary
Aggregated from all exploration angles, deduplicated

## Part 6: Key Code Location Index

| Component | File Path | Key Lines | Purpose |
|-----------|-----------|-----------|---------|
```

---

### Phase 2: Clarification (Optional, Multi-Round)

**Skip Conditions**: No exploration performed OR clarification needs empty across all explorations

**⚠️ CRITICAL**: ASK_USER limits max 4 questions per call. **MUST execute multiple rounds** to exhaust all clarification needs — do NOT stop at round 1.

**Flow**:

```
1. Load all exploration Markdown files

2. Extract clarification needs
   └─ For each exploration → collect "Clarification Needs" section items

3. Deduplicate
   └─ Intelligent merge: identify similar intent across angles
      → combine options, consolidate context
      → produce unique-intent questions only

4. Route by mode:
   ├─ --yes mode → Skip all clarifications, log count, proceed to Phase 3
   └─ Interactive mode → Multi-round clarification:
      ├─ Batch size: 4 questions per round
      ├─ Per round: display "Round N/M", present via ASK_USER
      │   └─ Each question: [source_angle] question + context
      ├─ Store responses in clarificationContext after each round
      └─ Repeat until all questions exhausted
```

**Output**: `clarificationContext` (in-memory, keyed by question)

---

### Phase 3: Planning → .task/*.json

**IMPORTANT**: Phase 3 is **planning only** — NO code execution. All implementation happens via unified-execute-with-file.

#### Step 3.1: Gather Planning Context

1. **Read** all exploration Markdown files and `exploration-notes.md`
2. **Read** `{projectRoot}/.workflow/project-tech.json` (if exists)
3. **Read** `{projectRoot}/.workflow/project-guidelines.json` (if exists)
4. **Collect** clarificationContext (if any)

#### Step 3.2: Generate requirement-analysis.json

```javascript
Write(`${sessionFolder}/requirement-analysis.json`, JSON.stringify({
  session_id: sessionId,
  original_requirement: taskDescription,
  complexity: complexity,
  exploration_angles: selectedAngles,
  total_explorations: selectedAngles.length,
  timestamp: getUtc8ISOString()
}, null, 2))
```

#### Step 3.3: Generate .task/*.json

Direct Claude planning — synthesize exploration findings and clarifications into individual task JSON files:

**Task Grouping Rules**:
1. **Group by feature**: All changes for one feature = one task (even if 3-5 files)
2. **Group by context**: Tasks with similar context or related functional changes can be grouped
3. **Minimize task count**: Simple, related tasks grouped together (target 2-7 tasks)
4. **Substantial tasks**: Each task should represent meaningful work
5. **True dependencies only**: Only use depends_on when Task B cannot start without Task A's output
6. **Prefer parallel**: Most tasks should be independent (no depends_on)

**Unified Task JSON Format** (one JSON file per task, stored in `.task/` directory):

```javascript
{
  id: "TASK-001",                        // Padded 3-digit ID
  title: "...",
  description: "...",                    // Scope/goal + implementation approach
  type: "feature",                       // feature|infrastructure|enhancement|fix|refactor|testing
  priority: "medium",                    // high|medium|low
  effort: "medium",                      // small|medium|large
  scope: "...",                          // Brief scope description
  depends_on: [],                        // TASK-xxx references (empty if independent)
  convergence: {
    criteria: [                          // Testable conditions (2-5 items)
      "File src/auth/login.ts exports authenticateUser function",
      "Unit test covers both success and failure paths"
    ],
    verification: "npm test -- --grep auth",  // Executable command or manual steps
    definition_of_done: "Users can log in with JWT tokens and receive refresh tokens"
  },
  files: [                               // Files to modify (from exploration findings)
    {
      path: "src/auth/login.ts",
      action: "modify",                  // modify|create|delete
      changes: ["Add JWT token generation", "Add refresh token logic"],
      conflict_risk: "low"               // low|medium|high
    }
  ],
  source: {
    tool: "workflow-lite-plan-execute",
    session_id: sessionId,
    original_id: "TASK-001"
  }
}
```

**Write .task/*.json**:
```javascript
// Create .task/ directory
Bash(`mkdir -p ${sessionFolder}/.task`)

// Write each task as an individual JSON file
tasks.forEach(task => {
  Write(`${sessionFolder}/.task/${task.id}.json`, JSON.stringify(task, null, 2))
})
```

#### Step 3.4: Generate plan.md

Create human-readable summary:

```javascript
const planMd = `# Lite Plan

**Session**: ${sessionId}
**Requirement**: ${taskDescription}
**Created**: ${getUtc8ISOString()}
**Complexity**: ${complexity}
**Exploration Angles**: ${selectedAngles.join(', ')}

## 需求理解

${requirementUnderstanding}

## 任务概览

| # | ID | Title | Type | Priority | Effort | Dependencies |
|---|-----|-------|------|----------|--------|--------------|
${tasks.map((t, i) => `| ${i+1} | ${t.id} | ${t.title} | ${t.type} | ${t.priority} | ${t.effort} | ${t.depends_on.join(', ') || '-'} |`).join('\n')}

## 任务详情

${tasks.map(t => `### ${t.id}: ${t.title}
- **范围**: ${t.scope}
- **修改文件**: ${t.files.map(f => \`\\\`${f.path}\\\` (${f.action})\`).join(', ')}
- **收敛标准**:
${t.convergence.criteria.map(c => \`  - ${c}\`).join('\n')}
- **验证方式**: ${t.convergence.verification}
- **完成定义**: ${t.convergence.definition_of_done}
`).join('\n')}

## 执行

\`\`\`bash
$unified-execute-with-file PLAN="${sessionFolder}/.task/"
\`\`\`

**Session artifacts**: \`${sessionFolder}/\`
`
Write(`${sessionFolder}/plan.md`, planMd)
```

---

### Phase 4: Task Confirmation

#### Step 4.1: Display Plan

Read `{sessionFolder}/.task/` directory and display summary:

- **Summary**: Overall approach (from requirement understanding)
- **Tasks**: Numbered list with ID, title, type, effort
- **Complexity**: Assessment result
- **Total tasks**: Count
- **Dependencies**: Graph overview

#### Step 4.2: Collect Confirmation

**Route by mode**:

```
├─ --yes mode → Auto-confirm:
│   └─ Confirmation: "Allow"
│
└─ Interactive mode → ASK_USER:
    └─ Confirm plan? ({N} tasks, {complexity})
        ├─ Allow (proceed as-is)
        ├─ Modify (adjust before execution)
        └─ Cancel (abort workflow)
```

**Output**: `userSelection` — `{ confirmation: "Allow" | "Modify" | "Cancel" }`

**Modify Loop**: If "Modify" selected, display current `.task/*.json` content, accept user edits (max 3 rounds), regenerate plan.md, re-confirm.

---

### Phase 5: Handoff to Execution

**CRITICAL**: lite-plan NEVER executes code directly. ALL execution goes through unified-execute-with-file.

→ Hand off to Phase 2: `phases/02-lite-execute.md` which invokes `unified-execute-with-file`

## Session Folder Structure

```
{projectRoot}/.workflow/.lite-plan/{session-id}/
├── exploration-{angle1}.md            # CLI exploration angle 1
├── exploration-{angle2}.md            # CLI exploration angle 2
├── exploration-{angle3}.md            # (if applicable)
├── exploration-{angle4}.md            # (if applicable)
├── explorations-manifest.json         # Exploration index
├── exploration-notes.md               # Synthesized exploration notes
├── requirement-analysis.json          # Complexity assessment
├── .task/                             # ⭐ Task JSON files (one per task)
│   ├── TASK-001.json
│   ├── TASK-002.json
│   └── ...
└── plan.md                            # Human-readable summary
```

**Example**:
```
{projectRoot}/.workflow/.lite-plan/implement-jwt-refresh-2025-11-25/
├── exploration-patterns.md
├── exploration-integration-points.md
├── exploration-testing.md
├── explorations-manifest.json
├── exploration-notes.md
├── requirement-analysis.json
├── .task/
│   ├── TASK-001.json
│   ├── TASK-002.json
│   └── ...
└── plan.md
```

## Error Handling

| Error | Resolution |
|-------|------------|
| CLI exploration failure | Skip angle, continue with remaining; fallback gemini → claude |
| CLI tool unavailable | Try fallback tool; if all fail, proceed without exploration |
| Search verification failure | Note unverified findings, continue with caution marker |
| Planning failure | Display error, offer retry |
| Clarification timeout | Use exploration findings as-is |
| Confirmation timeout | Save artifacts, display resume instructions |
| Modify loop > 3 times | Suggest using full planning workflow (workflow-plan-execute/SKILL.md) |

---

## Post-Phase Update

After Phase 1 (Lite Plan) completes:
- **Output Created**: `.task/TASK-*.json` + `plan.md` + exploration artifacts in session folder
- **Session Artifacts**: All files in `{projectRoot}/.workflow/.lite-plan/{session-id}/`
- **Next Action**: Auto-continue to [Phase 2: Execution Handoff](02-lite-execute.md)
- **TodoWrite**: Mark "Lite Plan - Planning" as completed, start "Execution (unified-execute)"
