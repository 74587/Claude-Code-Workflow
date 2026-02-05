# Phase 3: Conflict Resolution

Detect and resolve conflicts between plan and existing codebase using CLI-powered analysis with Gemini/Qwen.

## Objective

- Analyze conflicts between plan and existing code, **including module scenario uniqueness detection**
- Generate multiple resolution strategies with **iterative clarification until boundaries are clear**
- Apply selected modifications to brainstorm artifacts

**Scope**: Detection and strategy generation only - NO code modification or task creation.

**Trigger**: Auto-executes when `conflict_risk >= medium`.

## Auto Mode

When `--yes` or `-y`: Auto-select recommended strategy for each conflict, skip clarification questions.

## Core Responsibilities

| Responsibility | Description |
|---------------|-------------|
| **Detect Conflicts** | Analyze plan vs existing code inconsistencies |
| **Scenario Uniqueness** | Search and compare new modules with existing modules for functional overlaps |
| **Generate Strategies** | Provide 2-4 resolution options per conflict |
| **Iterative Clarification** | Ask unlimited questions until scenario boundaries are clear and unique |
| **Agent Re-analysis** | Dynamically update strategies based on user clarifications |
| **CLI Analysis** | Use Gemini/Qwen (Claude fallback) |
| **User Decision** | Present options ONE BY ONE, never auto-apply |
| **Direct Text Output** | Output questions via text directly, NEVER use bash echo/printf |
| **Structured Data** | JSON output for programmatic processing, NO file generation |

## Conflict Categories

### 1. Architecture Conflicts
- Incompatible design patterns
- Module structure changes
- Pattern migration requirements

### 2. API Conflicts
- Breaking contract changes
- Signature modifications
- Public interface impacts

### 3. Data Model Conflicts
- Schema modifications
- Type breaking changes
- Data migration needs

### 4. Dependency Conflicts
- Version incompatibilities
- Setup conflicts
- Breaking updates

### 5. Module Scenario Overlap
- Functional overlap between new and existing modules
- Scenario boundary ambiguity
- Duplicate responsibility detection
- Module merge/split decisions
- **Requires iterative clarification until uniqueness confirmed**

## Execution Process

```
Input Parsing:
   ├─ Parse flags: --session, --context
   └─ Validation: Both REQUIRED, conflict_risk >= medium

Phase 1: Validation
   ├─ Step 1: Verify session directory exists
   ├─ Step 2: Load context-package.json
   ├─ Step 3: Check conflict_risk (skip if none/low)
   └─ Step 4: Prepare agent task prompt

Phase 2: CLI-Powered Analysis (Agent)
   ├─ Execute Gemini analysis (Qwen fallback)
   ├─ Detect conflicts including ModuleOverlap category
   └─ Generate 2-4 strategies per conflict with modifications

Phase 3: Iterative User Interaction
   └─ FOR each conflict (one by one):
      ├─ Display conflict with overlap_analysis (if ModuleOverlap)
      ├─ Display strategies (2-4 + custom option)
      ├─ User selects strategy
      └─ IF clarification_needed:
         ├─ Collect answers
         ├─ Agent re-analysis
         └─ Loop until uniqueness_confirmed (max 10 rounds)

Phase 4: Apply Modifications
   ├─ Step 1: Extract modifications from resolved strategies
   ├─ Step 2: Apply using Edit tool
   ├─ Step 3: Update context-package.json (mark resolved)
   └─ Step 4: Output custom conflict summary (if any)
```

## Execution Flow

### Phase 1: Validation
```
1. Verify session directory exists
2. Load context-package.json
3. Check conflict_risk (skip if none/low)
4. Prepare agent task prompt
```

### Phase 2: CLI-Powered Analysis

**Agent Delegation**:
```javascript
Task(subagent_type="cli-execution-agent", run_in_background=false, prompt=`
  ## Context
  - Session: {session_id}
  - Risk: {conflict_risk}
  - Files: {existing_files_list}

  ## Exploration Context (from context-package.exploration_results)
  - Exploration Count: ${contextPackage.exploration_results?.exploration_count || 0}
  - Angles Analyzed: ${JSON.stringify(contextPackage.exploration_results?.angles || [])}
  - Pre-identified Conflict Indicators: ${JSON.stringify(contextPackage.exploration_results?.aggregated_insights?.conflict_indicators || [])}
  - Critical Files: ${JSON.stringify(contextPackage.exploration_results?.aggregated_insights?.critical_files?.map(f => f.path) || [])}
  - All Patterns: ${JSON.stringify(contextPackage.exploration_results?.aggregated_insights?.all_patterns || [])}
  - All Integration Points: ${JSON.stringify(contextPackage.exploration_results?.aggregated_insights?.all_integration_points || [])}

  ## Analysis Steps

  ### 0. Load Output Schema (MANDATORY)
  Execute: cat ~/.claude/workflows/cli-templates/schemas/conflict-resolution-schema.json

  ### 1. Load Context
  - Read existing files from conflict_detection.existing_files
  - Load plan from .workflow/active/{session_id}/.process/context-package.json
  - Load exploration_results and use aggregated_insights for enhanced analysis
  - Extract role analyses and requirements

  ### 2. Execute CLI Analysis (Enhanced with Exploration + Scenario Uniqueness)

  Primary (Gemini):
  ccw cli -p "
  PURPOSE: Detect conflicts between plan and codebase, using exploration insights
  TASK:
  • **Review pre-identified conflict_indicators from exploration results**
  • Compare architectures (use exploration key_patterns)
  • Identify breaking API changes
  • Detect data model incompatibilities
  • Assess dependency conflicts
  • **Analyze module scenario uniqueness**
    - Use exploration integration_points for precise locations
    - Cross-validate with exploration critical_files
    - Generate clarification questions for boundary definition
  MODE: analysis
  CONTEXT: @**/*.ts @**/*.js @**/*.tsx @**/*.jsx @.workflow/active/{session_id}/**/*
  EXPECTED: Conflict list with severity ratings, including:
    - Validation of exploration conflict_indicators
    - ModuleOverlap conflicts with overlap_analysis
    - Targeted clarification questions
  CONSTRAINTS: Focus on breaking changes, migration needs, and functional overlaps | Prioritize exploration-identified conflicts | analysis=READ-ONLY
  " --tool gemini --mode analysis --rule analysis-code-patterns --cd {project_root}

  Fallback: Qwen (same prompt) → Claude (manual analysis)

  ### 3. Generate Strategies (2-4 per conflict)

  Template per conflict:
  - Severity: Critical/High/Medium
  - Category: Architecture/API/Data/Dependency/ModuleOverlap
  - Affected files + impact
  - **For ModuleOverlap**: Include overlap_analysis with existing modules and scenarios
  - Options with pros/cons, effort, risk
  - **For ModuleOverlap strategies**: Add clarification_needed questions for boundary definition
  - Recommended strategy + rationale

  ### 4. Return Structured Conflict Data

  ⚠️ Output to conflict-resolution.json (generated in Phase 4)

  **Schema Reference**: Execute \`cat ~/.claude/workflows/cli-templates/schemas/conflict-resolution-schema.json\` to get full schema

  Return JSON following the schema above. Key requirements:
  - Minimum 2 strategies per conflict, max 4
  - All text in Chinese for user-facing fields (brief, name, pros, cons, modification_suggestions)
  - modifications.old_content: 20-100 chars for unique Edit tool matching
  - modifications.new_content: preserves markdown formatting
  - modification_suggestions: 2-5 actionable suggestions for custom handling

  ### 5. Planning Notes Record (REQUIRED)
  After analysis complete, append a brief execution record to planning-notes.md:

  **File**: .workflow/active/{session_id}/planning-notes.md
  **Location**: Under "## Conflict Decisions (Phase 3)" section
  **Format**:
  \`\`\`
  ### [Conflict-Resolution Agent] YYYY-MM-DD
  - **Note**: [brief summary of conflict types, resolution strategies, key decisions]
  \`\`\`
`)
```

### Phase 3: User Interaction Loop

```javascript
const autoYes = $ARGUMENTS.includes('--yes') || $ARGUMENTS.includes('-y')

FOR each conflict:
  round = 0, clarified = false, userClarifications = []

  WHILE (!clarified && round++ < 10):
    // 1. Display conflict info (text output for context)
    displayConflictSummary(conflict)  // id, brief, severity, overlap_analysis if ModuleOverlap

    // 2. Strategy selection
    if (autoYes) {
      console.log(`[--yes] Auto-selecting recommended strategy`)
      selectedStrategy = conflict.strategies[conflict.recommended || 0]
      clarified = true  // Skip clarification loop
    } else {
      AskUserQuestion({
      questions: [{
        question: formatStrategiesForDisplay(conflict.strategies),
        header: "策略选择",
        multiSelect: false,
        options: [
          ...conflict.strategies.map((s, i) => ({
            label: `${s.name}${i === conflict.recommended ? ' (推荐)' : ''}`,
            description: `${s.complexity}复杂度 | ${s.risk}风险${s.clarification_needed?.length ? ' | ⚠️需澄清' : ''}`
          })),
          { label: "自定义修改", description: `建议: ${conflict.modification_suggestions?.slice(0,2).join('; ')}` }
        ]
      }]
      })

      // 3. Handle selection
      if (userChoice === "自定义修改") {
        customConflicts.push({ id, brief, category, suggestions, overlap_analysis })
        break
      }

      selectedStrategy = findStrategyByName(userChoice)
    }

    // 4. Clarification (if needed) - batched max 4 per call
    if (!autoYes && selectedStrategy.clarification_needed?.length > 0) {
      for (batch of chunk(selectedStrategy.clarification_needed, 4)) {
        AskUserQuestion({
          questions: batch.map((q, i) => ({
            question: q, header: `澄清${i+1}`, multiSelect: false,
            options: [{ label: "详细说明", description: "提供答案" }]
          }))
        })
        userClarifications.push(...collectAnswers(batch))
      }

      // 5. Agent re-analysis
      reanalysisResult = Task({
        subagent_type: "cli-execution-agent",
        run_in_background: false,
        prompt: `Conflict: ${conflict.id}, Strategy: ${selectedStrategy.name}
User Clarifications: ${JSON.stringify(userClarifications)}
Output: { uniqueness_confirmed, rationale, updated_strategy, remaining_questions }`
      })

      if (reanalysisResult.uniqueness_confirmed) {
        selectedStrategy = { ...reanalysisResult.updated_strategy, clarifications: userClarifications }
        clarified = true
      } else {
        selectedStrategy.clarification_needed = reanalysisResult.remaining_questions
      }
    } else {
      clarified = true
    }

    if (clarified) resolvedConflicts.push({ conflict, strategy: selectedStrategy })
  END WHILE
END FOR

selectedStrategies = resolvedConflicts.map(r => ({
  conflict_id: r.conflict.id, strategy: r.strategy, clarifications: r.strategy.clarifications || []
}))
```

**Key Points**:
- AskUserQuestion: max 4 questions/call, batch if more
- Strategy options: 2-4 strategies + "自定义修改"
- Clarification loop: max 10 rounds, agent判断 uniqueness_confirmed
- Custom conflicts: 记录 overlap_analysis 供后续手动处理

### Phase 4: Apply Modifications

```javascript
// 1. Extract modifications from resolved strategies
const modifications = [];
selectedStrategies.forEach(item => {
  if (item.strategy && item.strategy.modifications) {
    modifications.push(...item.strategy.modifications.map(mod => ({
      ...mod,
      conflict_id: item.conflict_id,
      clarifications: item.clarifications
    })));
  }
});

console.log(`\n正在应用 ${modifications.length} 个修改...`);

// 2. Apply each modification using Edit tool (with fallback to context-package.json)
const appliedModifications = [];
const failedModifications = [];
const fallbackConstraints = [];  // For files that don't exist

modifications.forEach((mod, idx) => {
  try {
    console.log(`[${idx + 1}/${modifications.length}] 修改 ${mod.file}...`);

    // Check if target file exists (brainstorm files may not exist in lite workflow)
    if (!file_exists(mod.file)) {
      console.log(`  ⚠️ 文件不存在，写入 context-package.json 作为约束`);
      fallbackConstraints.push({
        source: "conflict-resolution",
        conflict_id: mod.conflict_id,
        target_file: mod.file,
        section: mod.section,
        change_type: mod.change_type,
        content: mod.new_content,
        rationale: mod.rationale
      });
      return;  // Skip to next modification
    }

    if (mod.change_type === "update") {
      Edit({
        file_path: mod.file,
        old_string: mod.old_content,
        new_string: mod.new_content
      });
    } else if (mod.change_type === "add") {
      // Handle addition - append or insert based on section
      const fileContent = Read(mod.file);
      const updated = insertContentAfterSection(fileContent, mod.section, mod.new_content);
      Write(mod.file, updated);
    } else if (mod.change_type === "remove") {
      Edit({
        file_path: mod.file,
        old_string: mod.old_content,
        new_string: ""
      });
    }

    appliedModifications.push(mod);
    console.log(`  ✓ 成功`);
  } catch (error) {
    console.log(`  ✗ 失败: ${error.message}`);
    failedModifications.push({ ...mod, error: error.message });
  }
});

// 2b. Generate conflict-resolution.json output file
const resolutionOutput = {
  session_id: sessionId,
  resolved_at: new Date().toISOString(),
  summary: {
    total_conflicts: conflicts.length,
    resolved_with_strategy: selectedStrategies.length,
    custom_handling: customConflicts.length,
    fallback_constraints: fallbackConstraints.length
  },
  resolved_conflicts: selectedStrategies.map(s => ({
    conflict_id: s.conflict_id,
    strategy_name: s.strategy.name,
    strategy_approach: s.strategy.approach,
    clarifications: s.clarifications || [],
    modifications_applied: s.strategy.modifications?.filter(m =>
      appliedModifications.some(am => am.conflict_id === s.conflict_id)
    ) || []
  })),
  custom_conflicts: customConflicts.map(c => ({
    id: c.id,
    brief: c.brief,
    category: c.category,
    suggestions: c.suggestions,
    overlap_analysis: c.overlap_analysis || null
  })),
  planning_constraints: fallbackConstraints,  // Constraints for files that don't exist
  failed_modifications: failedModifications
};

const resolutionPath = `.workflow/active/${sessionId}/.process/conflict-resolution.json`;
Write(resolutionPath, JSON.stringify(resolutionOutput, null, 2));

// 3. Update context-package.json with resolution details (reference to JSON file)
const contextPackage = JSON.parse(Read(contextPath));
contextPackage.conflict_detection.conflict_risk = "resolved";
contextPackage.conflict_detection.resolution_file = resolutionPath;  // Reference to detailed JSON
contextPackage.conflict_detection.resolved_conflicts = selectedStrategies.map(s => s.conflict_id);
contextPackage.conflict_detection.custom_conflicts = customConflicts.map(c => c.id);
contextPackage.conflict_detection.resolved_at = new Date().toISOString();
Write(contextPath, JSON.stringify(contextPackage, null, 2));

// 4. Output custom conflict summary with overlap analysis (if any)
if (customConflicts.length > 0) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`需要自定义处理的冲突 (${customConflicts.length})`);
  console.log(`${'='.repeat(60)}\n`);

  customConflicts.forEach(conflict => {
    console.log(`【${conflict.category}】${conflict.id}: ${conflict.brief}`);

    // Show overlap analysis for ModuleOverlap conflicts
    if (conflict.category === 'ModuleOverlap' && conflict.overlap_analysis) {
      console.log(`\n场景重叠信息:`);
      console.log(`  新模块: ${conflict.overlap_analysis.new_module.name}`);
      console.log(`  场景: ${conflict.overlap_analysis.new_module.scenarios.join(', ')}`);
      console.log(`\n  与以下模块重叠:`);
      conflict.overlap_analysis.existing_modules.forEach(mod => {
        console.log(`    - ${mod.name} (${mod.file})`);
        console.log(`      重叠场景: ${mod.overlap_scenarios.join(', ')}`);
      });
    }

    console.log(`\n修改建议:`);
    conflict.suggestions.forEach(suggestion => {
      console.log(`  - ${suggestion}`);
    });
    console.log();
  });
}

// 5. Output failure summary (if any)
if (failedModifications.length > 0) {
  console.log(`\n⚠️ 部分修改失败 (${failedModifications.length}):`);
  failedModifications.forEach(mod => {
    console.log(`  - ${mod.file}: ${mod.error}`);
  });
}

// 6. Return summary
return {
  total_conflicts: conflicts.length,
  resolved_with_strategy: selectedStrategies.length,
  custom_handling: customConflicts.length,
  modifications_applied: appliedModifications.length,
  modifications_failed: failedModifications.length,
  modified_files: [...new Set(appliedModifications.map(m => m.file))],
  custom_conflicts: customConflicts,
  clarification_records: selectedStrategies.filter(s => s.clarifications.length > 0)
};
```

**Validation**:
```
✓ Agent returns valid JSON structure with ModuleOverlap conflicts
✓ Conflicts processed ONE BY ONE (not in batches)
✓ ModuleOverlap conflicts include overlap_analysis field
✓ Strategies with clarification_needed display questions
✓ User selections captured correctly per conflict
✓ Clarification loop continues until uniqueness confirmed
✓ Agent re-analysis returns uniqueness_confirmed and updated_strategy
✓ Maximum 10 rounds per conflict safety limit enforced
✓ Edit tool successfully applies modifications
✓ guidance-specification.md updated
✓ Role analyses (*.md) updated
✓ context-package.json marked as resolved with clarification records
✓ Custom conflicts display overlap_analysis for manual handling
✓ Agent log saved to .workflow/active/{session_id}/.chat/
```

## Output Format

### Primary Output: conflict-resolution.json

**Path**: `.workflow/active/{session_id}/.process/conflict-resolution.json`

**Schema**:
```json
{
  "session_id": "WFS-xxx",
  "resolved_at": "ISO timestamp",
  "summary": {
    "total_conflicts": 3,
    "resolved_with_strategy": 2,
    "custom_handling": 1,
    "fallback_constraints": 0
  },
  "resolved_conflicts": [
    {
      "conflict_id": "CON-001",
      "strategy_name": "策略名称",
      "strategy_approach": "实现方法",
      "clarifications": [],
      "modifications_applied": []
    }
  ],
  "custom_conflicts": [
    {
      "id": "CON-002",
      "brief": "冲突摘要",
      "category": "ModuleOverlap",
      "suggestions": ["建议1", "建议2"],
      "overlap_analysis": null
    }
  ],
  "planning_constraints": [],
  "failed_modifications": []
}
```

### Key Requirements

| Requirement | Details |
|------------|---------|
| **Conflict batching** | Max 10 conflicts per round (no total limit) |
| **Strategy count** | 2-4 strategies per conflict |
| **Modifications** | Each strategy includes file paths, old_content, new_content |
| **User-facing text** | Chinese (brief, strategy names, pros/cons) |
| **Technical fields** | English (severity, category, complexity, risk) |
| **old_content precision** | 20-100 chars for unique Edit tool matching |
| **File targets** | guidance-specification.md, role analyses (*.md) |

## Error Handling

### Recovery Strategy
```
1. Pre-check: Verify conflict_risk ≥ medium
2. Monitor: Track agent via Task tool
3. Validate: Parse agent JSON output
4. Recover:
   - Agent failure → check logs + report error
   - Invalid JSON → retry once with Claude fallback
   - CLI failure → fallback to Claude analysis
   - Edit tool failure → report affected files + rollback option
   - User cancels → mark as "unresolved", continue to task-generate
5. Degrade: If all fail, generate minimal conflict report and skip modifications
```

### Rollback Handling
```
If Edit tool fails mid-application:
1. Log all successfully applied modifications
2. Output rollback option via text interaction
3. If rollback selected: restore files from git or backups
4. If continue: mark partial resolution in context-package.json
```

## Integration

### Interface
**Input**:
- `--session` (required): WFS-{session-id}
- `--context` (required): context-package.json path
- Requires: `conflict_risk >= medium`

**Output**:
- Generated file:
  - `.workflow/active/{session_id}/.process/conflict-resolution.json` (primary output)
- Modified files (if exist):
  - `.workflow/active/{session_id}/.brainstorm/guidance-specification.md`
  - `.workflow/active/{session_id}/.brainstorm/{role}/analysis.md`
  - `.workflow/active/{session_id}/.process/context-package.json` (conflict_risk → resolved, resolution_file reference)

**User Interaction**:
- **Iterative conflict processing**: One conflict at a time, not in batches
- Each conflict: 2-4 strategy options + "自定义修改" option (with suggestions)
- **Clarification loop**: Unlimited questions per conflict until uniqueness confirmed (max 10 rounds)
- **ModuleOverlap conflicts**: Display overlap_analysis with existing modules
- **Agent re-analysis**: Dynamic strategy updates based on user clarifications

### Success Criteria
```
✓ CLI analysis returns valid JSON structure with ModuleOverlap category
✓ Agent performs scenario uniqueness detection (searches existing modules)
✓ Conflicts processed ONE BY ONE with iterative clarification
✓ Min 2 strategies per conflict with modifications
✓ ModuleOverlap conflicts include overlap_analysis with existing modules
✓ Strategies requiring clarification include clarification_needed questions
✓ Each conflict includes 2-5 modification_suggestions
✓ Text output displays conflict with overlap analysis (if ModuleOverlap)
✓ User selections captured per conflict
✓ Clarification loop continues until uniqueness confirmed (unlimited rounds, max 10)
✓ Agent re-analysis with user clarifications updates strategy
✓ Uniqueness confirmation based on clear scenario boundaries
✓ Edit tool applies modifications successfully
✓ Custom conflicts displayed with overlap_analysis for manual handling
✓ guidance-specification.md updated with resolved conflicts
✓ Role analyses (*.md) updated with resolved conflicts
✓ context-package.json marked as "resolved" with clarification records
✓ conflict-resolution.json generated with full resolution details
✓ Modification summary includes:
  - Total conflicts
  - Resolved with strategy (count)
  - Custom handling (count)
  - Clarification records
  - Overlap analysis for custom ModuleOverlap conflicts
✓ Agent log saved to .workflow/active/{session_id}/.chat/
✓ Error handling robust (validate/retry/degrade)
```

## Post-Phase Update

If Phase 3 was executed, update planning-notes.md:

```javascript
const conflictResPath = `.workflow/active/${sessionId}/.process/conflict-resolution.json`

if (file_exists(conflictResPath)) {
  const conflictRes = JSON.parse(Read(conflictResPath))
  const resolved = conflictRes.resolved_conflicts || []
  const planningConstraints = conflictRes.planning_constraints || []

  // Update Phase 3 section
  Edit(planningNotesPath, {
    old: '## Conflict Decisions (Phase 3)\n(To be filled if conflicts detected)',
    new: `## Conflict Decisions (Phase 3)

- **RESOLVED**: ${resolved.map(r => `${r.conflict_id} → ${r.strategy_name}`).join('; ') || 'None'}
- **CUSTOM_HANDLING**: ${conflictRes.custom_conflicts?.map(c => c.id).join(', ') || 'None'}
- **CONSTRAINTS**: ${planningConstraints.map(c => c.content).join('; ') || 'None'}`
  })

  // Append Phase 3 constraints to consolidated list
  if (planningConstraints.length > 0) {
    Edit(planningNotesPath, {
      old: '## Consolidated Constraints (Phase 4 Input)',
      new: `## Consolidated Constraints (Phase 4 Input)
${planningConstraints.map((c, i) => `${constraintCount + i + 1}. [Conflict] ${c.content}`).join('\n')}`
    })
  }
}
```

## Memory State Check

After Phase 3 completion, evaluate context window usage.
If memory usage is high (>120K tokens):

```javascript
Skill(skill="compact")
```

## Output

- **File**: `.workflow/active/{sessionId}/.process/conflict-resolution.json`
- **Modified files**: brainstorm artifacts (guidance-specification.md, role analyses)
- **Updated**: `context-package.json` with resolved conflict status

## Next Phase

Return to orchestrator, then auto-continue to [Phase 4: Task Generation](04-task-generation.md).
