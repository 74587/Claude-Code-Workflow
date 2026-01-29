---
name: merge-plans-with-file
description: Merge multiple planning/brainstorm/analysis outputs, resolve conflicts, and synthesize unified plan. Designed for multi-team input aggregation and final plan crystallization
argument-hint: "[-y|--yes] [-r|--rule consensus|priority|hierarchy] \"plan or topic name\""
allowed-tools: TodoWrite(*), Task(*), AskUserQuestion(*), Read(*), Grep(*), Glob(*), Bash(*), Edit(*), Write(*)
---

## Auto Mode

When `--yes` or `-y`: Auto-resolve conflicts using specified rule (consensus/priority/hierarchy), minimal user prompts.

# Workflow Merge-Plans-With-File Command (/workflow:merge-plans-with-file)

## Overview

Plan aggregation and conflict resolution workflow. Takes multiple planning artifacts (brainstorm conclusions, analysis recommendations, quick-plans, implementation plans) and synthesizes them into a unified, conflict-resolved execution plan.

**Core workflow**: Load Sources → Parse Plans → Conflict Analysis → Arbitration → Unified Plan

**Key features**:
- **Multi-Source Support**: Brainstorm, analysis, quick-plan, IMPL_PLAN, task JSONs
- **Parallel Conflict Detection**: Identify all contradictions across input plans
- **Conflict Resolution**: Consensus, priority-based, or hierarchical resolution modes
- **Unified Synthesis**: Single authoritative plan from multiple perspectives
- **Decision Tracking**: Full audit trail of conflicts and resolutions
- **Resumable**: Save intermediate states, refine resolutions

## Usage

```bash
/workflow:merge-plans-with-file [FLAGS] <PLAN_NAME_OR_PATTERN>

# Flags
-y, --yes              Auto-resolve conflicts using rule, skip confirmations
-r, --rule <rule>      Conflict resolution rule: consensus (default) | priority | hierarchy
-o, --output <path>    Output directory (default: .workflow/.merged/{name})

# Arguments
<plan-name-or-pattern> Plan name or glob pattern to identify input files/sessions
                       Examples: "auth-module", "*.analysis-*.json", "PLAN-*"

# Examples
/workflow:merge-plans-with-file "authentication"                      # Auto-detect all auth-related plans
/workflow:merge-plans-with-file -y -r priority "payment-system"      # Auto-resolve with priority rule
/workflow:merge-plans-with-file -r hierarchy "feature-complete"      # Use hierarchy rule (requires user ranking)
```

## Execution Process

```
Discovery & Loading:
   ├─ Search for planning artifacts matching pattern
   ├─ Load all synthesis.json, conclusions.json, IMPL_PLAN.md
   ├─ Parse each into normalized task/plan structure
   └─ Validate data completeness

Session Initialization:
   ├─ Create .workflow/.merged/{sessionId}/
   ├─ Initialize merge.md with plan summary
   ├─ Index all source plans
   └─ Extract planning metadata and constraints

Phase 1: Plan Normalization
   ├─ Convert all formats to common task representation
   ├─ Extract tasks, dependencies, effort, risks
   ├─ Identify plan scope and boundaries
   ├─ Validate no duplicate tasks
   └─ Aggregate recommendations from each plan

Phase 2: Conflict Detection (Parallel)
   ├─ Architecture conflicts: different design approaches
   ├─ Task conflicts: overlapping responsibilities or different priorities
   ├─ Effort conflicts: vastly different estimates
   ├─ Risk assessment conflicts: different risk levels
   ├─ Scope conflicts: different feature inclusions
   └─ Generate conflict matrix with severity levels

Phase 3: Consensus Building / Arbitration
   ├─ For each conflict, analyze source rationale
   ├─ Apply resolution rule (consensus/priority/hierarchy)
   ├─ Escalate unresolvable conflicts to user (unless --yes)
   ├─ Document decision rationale
   └─ Generate resolutions.json

Phase 4: Plan Synthesis
   ├─ Merge task lists (remove duplicates, combine insights)
   ├─ Integrate dependencies from all sources
   ├─ Consolidate effort and risk estimates
   ├─ Generate unified execution sequence
   ├─ Create final unified plan
   └─ Output ready for execution

Output:
   ├─ .workflow/.merged/{sessionId}/merge.md (merge process & decisions)
   ├─ .workflow/.merged/{sessionId}/source-index.json (input sources)
   ├─ .workflow/.merged/{sessionId}/conflicts.json (conflict matrix)
   ├─ .workflow/.merged/{sessionId}/resolutions.json (how conflicts were resolved)
   ├─ .workflow/.merged/{sessionId}/unified-plan.json (final merged plan)
   └─ .workflow/.merged/{sessionId}/unified-plan.md (execution-ready markdown)
```

## Implementation

### Phase 1: Plan Discovery & Loading

```javascript
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

// Parse arguments
const planPattern = "$PLAN_NAME_OR_PATTERN"
const resolutionRule = $ARGUMENTS.match(/--rule\s+(\w+)/)?.[1] || 'consensus'
const isAutoMode = $ARGUMENTS.includes('--yes') || $ARGUMENTS.includes('-y')

// Generate session ID
const mergeSlug = planPattern.toLowerCase()
  .replace(/[*?]/g, '-')
  .replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, '-')
  .substring(0, 30)
const dateStr = getUtc8ISOString().substring(0, 10)
const sessionId = `MERGE-${mergeSlug}-${dateStr}`
const sessionFolder = `.workflow/.merged/${sessionId}`

bash(`mkdir -p ${sessionFolder}`)

// Discover all relevant planning artifacts
const discoveryPaths = [
  `.workflow/.brainstorm/*/${planPattern}*/synthesis.json`,
  `.workflow/.analysis/*/${planPattern}*/conclusions.json`,
  `.workflow/.planning/*/${planPattern}*/synthesis.json`,
  `.workflow/.plan/${planPattern}*IMPL_PLAN.md`,
  `.workflow/*/${planPattern}*.json`
]

const sourcePlans = []

for (const pattern of discoveryPaths) {
  const matches = glob(pattern)
  for (const path of matches) {
    try {
      const content = Read(path)
      const plan = parsePlanFile(path, content)
      if (plan && plan.tasks?.length > 0) {
        sourcePlans.push({
          source_path: path,
          source_type: identifySourceType(path),
          plan: plan,
          loaded_at: getUtc8ISOString()
        })
      }
    } catch (e) {
      console.warn(`Failed to load plan from ${path}: ${e.message}`)
    }
  }
}

if (sourcePlans.length === 0) {
  console.error(`
## Error: No Plans Found

Pattern: ${planPattern}
Searched locations:
${discoveryPaths.join('\n')}

Available plans in .workflow/:
`)
  bash(`find .workflow -name "*.json" -o -name "*PLAN.md" | head -20`)
  return { status: 'error', message: 'No plans found' }
}

console.log(`
## Plans Discovered

Total: ${sourcePlans.length}
${sourcePlans.map(sp => `- ${sp.source_type}: ${sp.source_path}`).join('\n')}
`)
```

---

### Phase 2: Plan Normalization

```javascript
// Normalize all plans to common format
const normalizedPlans = sourcePlans.map((sourcePlan, idx) => {
  const plan = sourcePlan.plan
  const tasks = plan.tasks || []

  return {
    index: idx,
    source: sourcePlan.source_path,
    source_type: sourcePlan.source_type,

    metadata: {
      title: plan.title || `Plan ${idx + 1}`,
      topic: plan.topic || plan.planning_topic || 'unknown',
      timestamp: plan.completed || plan.timestamp || sourcePlan.loaded_at,
      source_ideas: plan.top_ideas?.length || 0,
      complexity: plan.complexity_level || 'unknown'
    },

    // Normalized tasks
    tasks: tasks.map(task => ({
      id: task.id || `T${idx}-${task.title?.substring(0, 20)}`,
      title: task.title || task.content,
      description: task.description || '',
      type: task.type || inferType(task),
      priority: task.priority || 'normal',

      // Effort estimation
      effort: {
        estimated: task.estimated_duration || task.effort_estimate || 'unknown',
        from_plan: idx
      },

      // Risk assessment
      risk: {
        level: task.risk_level || 'medium',
        from_plan: idx
      },

      // Dependencies
      dependencies: task.dependencies || [],

      // Source tracking
      source_plan_index: idx,
      original_id: task.id,

      // Quality tracking
      success_criteria: task.success_criteria || [],
      challenges: task.challenges || []
    }))
  }
})

// Save source index
const sourceIndex = {
  session_id: sessionId,
  merge_timestamp: getUtc8ISOString(),
  pattern: planPattern,
  total_source_plans: sourcePlans.length,

  sources: normalizedPlans.map(p => ({
    index: p.index,
    source_path: p.source,
    source_type: p.source_type,
    topic: p.metadata.topic,
    task_count: p.tasks.length
  }))
}

Write(`${sessionFolder}/source-index.json`, JSON.stringify(sourceIndex, null, 2))
```

---

### Phase 3: Conflict Detection

```javascript
// Detect conflicts across plans
const conflictDetector = {
  // Architecture conflicts
  architectureConflicts: [],

  // Task conflicts (duplicates, different scope)
  taskConflicts: [],

  // Effort conflicts
  effortConflicts: [],

  // Risk assessment conflicts
  riskConflicts: [],

  // Scope conflicts
  scopeConflicts: [],

  // Priority conflicts
  priorityConflicts: []
}

// Algorithm 1: Detect similar tasks across plans
const allTasks = normalizedPlans.flatMap(p => p.tasks)
const taskGroups = groupSimilarTasks(allTasks)

for (const group of taskGroups) {
  if (group.tasks.length > 1) {
    // Same task appears in multiple plans
    const efforts = group.tasks.map(t => t.effort.estimated)
    const effortVariance = calculateVariance(efforts)

    if (effortVariance > 0.5) {
      // Significant difference in effort estimates
      conflictDetector.effortConflicts.push({
        task_group: group.title,
        conflicting_tasks: group.tasks.map((t, i) => ({
          id: t.id,
          from_plan: t.source_plan_index,
          effort: t.effort.estimated
        })),
        variance: effortVariance,
        severity: 'high'
      })
    }

    // Check for scope differences
    const scopeDifferences = analyzeScopeDifferences(group.tasks)
    if (scopeDifferences.length > 0) {
      conflictDetector.taskConflicts.push({
        task_group: group.title,
        scope_differences: scopeDifferences,
        severity: 'medium'
      })
    }
  }
}

// Algorithm 2: Architecture conflicts
const architectures = normalizedPlans.map(p => p.metadata.complexity)
if (new Set(architectures).size > 1) {
  conflictDetector.architectureConflicts.push({
    different_approaches: true,
    complexity_levels: architectures.map((a, i) => ({
      plan: i,
      complexity: a
    })),
    severity: 'high'
  })
}

// Algorithm 3: Risk assessment conflicts
const riskLevels = allTasks.map(t => ({ task: t.id, risk: t.risk.level }))
const taskRisks = {}
for (const tr of riskLevels) {
  if (!taskRisks[tr.task]) taskRisks[tr.task] = []
  taskRisks[tr.task].push(tr.risk)
}

for (const [task, risks] of Object.entries(taskRisks)) {
  if (new Set(risks).size > 1) {
    conflictDetector.riskConflicts.push({
      task: task,
      conflicting_risk_levels: risks,
      severity: 'medium'
    })
  }
}

// Save conflicts
Write(`${sessionFolder}/conflicts.json`, JSON.stringify(conflictDetector, null, 2))
```

---

### Phase 4: Conflict Resolution

```javascript
// Resolve conflicts based on selected rule
const resolutions = {
  resolution_rule: resolutionRule,
  timestamp: getUtc8ISOString(),

  effort_resolutions: [],
  architecture_resolutions: [],
  risk_resolutions: [],
  scope_resolutions: [],
  priority_resolutions: []
}

// Resolution Strategy 1: Consensus
if (resolutionRule === 'consensus') {
  for (const conflict of conflictDetector.effortConflicts) {
    // Use median or average
    const efforts = conflict.conflicting_tasks.map(t => parseEffort(t.effort))
    const resolved_effort = calculateMedian(efforts)

    resolutions.effort_resolutions.push({
      conflict: conflict.task_group,
      original_estimates: efforts,
      resolved_estimate: resolved_effort,
      method: 'consensus-median',
      rationale: 'Used median of all estimates'
    })
  }
}

// Resolution Strategy 2: Priority-Based
else if (resolutionRule === 'priority') {
  // Use the plan from highest priority source (first or most recent)
  for (const conflict of conflictDetector.effortConflicts) {
    const highestPriority = conflict.conflicting_tasks[0] // First plan has priority

    resolutions.effort_resolutions.push({
      conflict: conflict.task_group,
      conflicting_estimates: conflict.conflicting_tasks.map(t => t.effort),
      resolved_estimate: highestPriority.effort,
      selected_from_plan: highestPriority.from_plan,
      method: 'priority-based',
      rationale: `Selected estimate from plan ${highestPriority.from_plan} (highest priority)`
    })
  }
}

// Resolution Strategy 3: Hierarchy (requires user ranking)
else if (resolutionRule === 'hierarchy') {
  if (!isAutoMode) {
    // Ask user to rank plan importance
    const planRanking = AskUserQuestion({
      questions: [{
        question: "请按重要性排序这些规划(从最重要到最不重要):",
        header: "Plan Ranking",
        multiSelect: false,
        options: normalizedPlans.slice(0, 5).map(p => ({
          label: `Plan ${p.index}: ${p.metadata.title.substring(0, 40)}`,
          description: `${p.tasks.length} tasks, complexity: ${p.metadata.complexity}`
        }))
      }]
    })

    // Apply hierarchy
    const hierarchy = extractHierarchy(planRanking)
    for (const conflict of conflictDetector.effortConflicts) {
      const topPriorityTask = conflict.conflicting_tasks
        .sort((a, b) => hierarchy[a.from_plan] - hierarchy[b.from_plan])[0]

      resolutions.effort_resolutions.push({
        conflict: conflict.task_group,
        resolved_estimate: topPriorityTask.effort,
        selected_from_plan: topPriorityTask.from_plan,
        method: 'hierarchy-based',
        rationale: `Selected from highest-ranked plan`
      })
    }
  }
}

Write(`${sessionFolder}/resolutions.json`, JSON.stringify(resolutions, null, 2))
```

---

### Phase 5: Plan Synthesis

```javascript
// Merge all tasks into unified plan
const unifiedTasks = []
const processedTaskIds = new Set()

for (const task of allTasks) {
  const taskKey = generateTaskKey(task)

  if (processedTaskIds.has(taskKey)) {
    // Task already added, skip
    continue
  }

  processedTaskIds.add(taskKey)

  // Apply resolution if this task has conflicts
  let resolvedTask = { ...task }

  const effortResolution = resolutions.effort_resolutions
    .find(r => r.conflict === taskKey)
  if (effortResolution) {
    resolvedTask.effort.estimated = effortResolution.resolved_estimate
    resolvedTask.effort.resolution_method = effortResolution.method
  }

  unifiedTasks.push({
    id: taskKey,
    title: task.title,
    description: task.description,
    type: task.type,
    priority: task.priority,

    effort: resolvedTask.effort,
    risk: task.risk,
    dependencies: task.dependencies,

    success_criteria: [...new Set([
      ...task.success_criteria,
      ...findRelatedTasks(task, allTasks)
        .flatMap(t => t.success_criteria)
    ])],

    challenges: [...new Set([
      ...task.challenges,
      ...findRelatedTasks(task, allTasks)
        .flatMap(t => t.challenges)
    ])],

    source_plans: [
      ...new Set(allTasks
        .filter(t => generateTaskKey(t) === taskKey)
        .map(t => t.source_plan_index))
    ]
  })
}

// Generate execution sequence
const executionSequence = topologicalSort(unifiedTasks)
const criticalPath = identifyCriticalPath(unifiedTasks, executionSequence)

// Final unified plan
const unifiedPlan = {
  session_id: sessionId,
  merge_timestamp: getUtc8ISOString(),

  summary: {
    total_source_plans: normalizedPlans.length,
    original_tasks_total: allTasks.length,
    merged_tasks: unifiedTasks.length,
    conflicts_resolved: Object.values(conflictDetector).flat().length,
    resolution_rule: resolutionRule
  },

  merged_metadata: {
    topics: [...new Set(normalizedPlans.map(p => p.metadata.topic))],
    average_complexity: calculateAverage(normalizedPlans.map(p => parseComplexity(p.metadata.complexity))),
    combined_scope: estimateScope(unifiedTasks)
  },

  tasks: unifiedTasks,

  execution_sequence: executionSequence,
  critical_path: criticalPath,

  risks: aggregateRisks(unifiedTasks),
  success_criteria: aggregateSuccessCriteria(unifiedTasks),

  audit_trail: {
    source_plans: normalizedPlans.length,
    conflicts_detected: Object.values(conflictDetector).flat().length,
    conflicts_resolved: Object.values(resolutions).flat().length,
    resolution_method: resolutionRule
  }
}

Write(`${sessionFolder}/unified-plan.json`, JSON.stringify(unifiedPlan, null, 2))
```

---

### Phase 6: Generate Execution Plan

```markdown
# Merged Planning Session

**Session ID**: ${sessionId}
**Pattern**: ${planPattern}
**Created**: ${getUtc8ISOString()}

---

## Merge Summary

**Source Plans**: ${unifiedPlan.summary.total_source_plans}
**Original Tasks**: ${unifiedPlan.summary.original_tasks_total}
**Merged Tasks**: ${unifiedPlan.summary.merged_tasks}
**Tasks Deduplicated**: ${unifiedPlan.summary.original_tasks_total - unifiedPlan.summary.merged_tasks}
**Conflicts Resolved**: ${unifiedPlan.summary.conflicts_resolved}

**Resolution Method**: ${unifiedPlan.summary.resolution_rule}

---

## Merged Plan Overview

**Topics**: ${unifiedPlan.merged_metadata.topics.join(', ')}
**Combined Complexity**: ${unifiedPlan.merged_metadata.average_complexity}
**Total Scope**: ${unifiedPlan.merged_metadata.combined_scope}

---

## Unified Task List

${unifiedPlan.tasks.map((task, i) => `
${i+1}. **${task.id}: ${task.title}**
   - Type: ${task.type}
   - Effort: ${task.effort.estimated}
   - Risk: ${task.risk.level}
   - Source Plans: ${task.source_plans.join(', ')}
   - ${task.description}
`).join('\n')}

---

## Execution Sequence

**Critical Path**: ${unifiedPlan.critical_path.join(' → ')}

**Execution Order**:
${unifiedPlan.execution_sequence.map((id, i) => `${i+1}. ${id}`).join('\n')}

---

## Conflict Resolution Report

**Total Conflicts**: ${unifiedPlan.summary.conflicts_resolved}

**Resolved Conflicts**:
${Object.entries(resolutions).flatMap(([key, items]) =>
  items.slice(0, 3).map((item, i) => `
- ${key.replace('_', ' ')}: ${item.rationale || item.method}
`)
).join('\n')}

**Full Report**: See \`conflicts.json\` and \`resolutions.json\`

---

## Risks & Considerations

**Aggregated Risks**:
${unifiedPlan.risks.slice(0, 5).map(r => `- **${r.title}**: ${r.mitigation}`).join('\n')}

**Combined Success Criteria**:
${unifiedPlan.success_criteria.slice(0, 5).map(c => `- ${c}`).join('\n')}

---

## Next Steps

### Option 1: Direct Execution
Execute merged plan with unified-execute-with-file:
\`\`\`
/workflow:unified-execute-with-file -p ${sessionFolder}/unified-plan.json
\`\`\`

### Option 2: Detailed Planning
Create detailed IMPL_PLAN from merged plan:
\`\`\`
/workflow:plan "Based on merged plan from $(echo ${planPattern})"
\`\`\`

### Option 3: Review Conflicts
Review detailed conflict analysis:
\`\`\`
cat ${sessionFolder}/resolutions.json
\`\`\`

---

## Artifacts

- **source-index.json** - All input plans and sources
- **conflicts.json** - Conflict detection results
- **resolutions.json** - How each conflict was resolved
- **unified-plan.json** - Merged plan data structure (for execution)
- **unified-plan.md** - This document (human-readable)
```

---

## Session Folder Structure

```
.workflow/.merged/{sessionId}/
├── merge.md              # Merge process and decisions
├── source-index.json     # All input plan sources
├── conflicts.json        # Detected conflicts
├── resolutions.json      # Conflict resolutions applied
├── unified-plan.json     # Merged plan (machine-parseable, for execution)
└── unified-plan.md       # Execution-ready plan (human-readable)
```

---

## Resolution Rules

### Rule 1: Consensus (default)
- Use median or average of conflicting estimates
- Good for: Multiple similar perspectives
- Tradeoff: May miss important minority viewpoints

### Rule 2: Priority-Based
- First plan has highest priority, subsequent plans are fallback
- Good for: Clear ranking of plan sources
- Tradeoff: Discards valuable alternative perspectives

### Rule 3: Hierarchy
- User explicitly ranks importance of each plan
- Good for: Mixed-source plans (engineering + product + leadership)
- Tradeoff: Requires user input

---

## Input Format Support

| Source Type | Detection | Parsing | Notes |
|-------------|-----------|---------|-------|
| **Brainstorm** | `.brainstorm/*/synthesis.json` | Top ideas → tasks | Ideas converted to work items |
| **Analysis** | `.analysis/*/conclusions.json` | Recommendations → tasks | Recommendations prioritized |
| **Quick-Plan** | `.planning/*/synthesis.json` | Direct task list | Already normalized |
| **IMPL_PLAN** | `*IMPL_PLAN.md` | Markdown → tasks | Parsed from markdown structure |
| **Task JSON** | `.json` with `tasks` key | Direct mapping | Requires standard schema |

---

## Error Handling

| Situation | Action |
|-----------|--------|
| No plans found | Suggest search terms, list available plans |
| Incompatible formats | Skip unsupported format, continue with others |
| Circular dependencies | Alert user, suggest manual review |
| Unresolvable conflicts | Require user decision (unless --yes + conflict rule) |
| Contradictory recommendations | Document both options for user consideration |

---

## Usage Patterns

### Pattern 1: Merge Multiple Brainstorms

```bash
/workflow:merge-plans-with-file "authentication" -y -r consensus
# → Finds all brainstorm sessions with "auth"
# → Merges top ideas into unified task list
# → Uses consensus method for conflicts
```

### Pattern 2: Synthesize Team Input

```bash
/workflow:merge-plans-with-file "payment-integration" -r hierarchy
# → Loads plans from different team members
# → Asks for ranking by importance
# → Applies hierarchy-based conflict resolution
```

### Pattern 3: Bridge Planning Phases

```bash
/workflow:merge-plans-with-file "user-auth" -f analysis
# → Takes analysis conclusions
# → Merges with existing quick-plans
# → Produces execution-ready plan
```

---

## Advanced: Custom Conflict Resolution

For complex conflict scenarios, create custom resolution script:

```
.workflow/.merged/{sessionId}/
└── custom-resolutions.js  (optional)
    - Define custom conflict resolution logic
    - Applied after automatic resolution
    - Override specific decisions
```

---

## Best Practices

1. **Before merging**:
   - Ensure all source plans have same quality level
   - Verify plans address same scope/topic
   - Document any special considerations

2. **During merging**:
   - Review conflict matrix (conflicts.json)
   - Understand resolution rationale (resolutions.json)
   - Challenge assumptions if results seem odd

3. **After merging**:
   - Validate unified plan makes sense
   - Review critical path
   - Ensure no important details lost
   - Execute or iterate if needed

---

## Integration with Other Workflows

```
Multiple Brainstorms / Analyses
   │
   ├─ brainstorm-with-file (session 1)
   ├─ brainstorm-with-file (session 2)
   ├─ analyze-with-file (session 3)
   │
   ▼
merge-plans-with-file  ◄──── This workflow
   │
   ▼
unified-plan.json
   │
   ├─ /workflow:unified-execute-with-file (direct execution)
   ├─ /workflow:plan (detailed planning)
   └─ /workflow:quick-plan-with-file (refinement)
```

---

## Comparison: When to Use Which Merge Rule

| Rule | Use When | Pros | Cons |
|------|----------|------|------|
| **Consensus** | Similar-quality inputs | Fair, balanced | May miss extremes |
| **Priority** | Clear hierarchy | Simple, predictable | May bias to first input |
| **Hierarchy** | Mixed stakeholders | Respects importance | Requires user ranking |

---

**Ready to execute**: Run `/workflow:merge-plans-with-file` to start merging plans!
