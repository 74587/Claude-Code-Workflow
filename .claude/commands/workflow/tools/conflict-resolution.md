---
name: conflict-resolution
description: Detect and resolve conflicts between plan and existing codebase using CLI-powered analysis with Gemini/Qwen
argument-hint: "--session WFS-session-id --context path/to/context-package.json"
examples:
  - /workflow:tools:conflict-resolution --session WFS-auth --context .workflow/active/WFS-auth/.process/context-package.json
  - /workflow:tools:conflict-resolution --session WFS-payment --context .workflow/active/WFS-payment/.process/context-package.json
---

# Conflict Resolution Command

## Purpose
Analyzes conflicts between implementation plans and existing codebase, **including module scenario uniqueness detection**, generating multiple resolution strategies with **iterative clarification until boundaries are clear**.

**Scope**: Detection and strategy generation only - NO code modification or task creation.

**Trigger**: Auto-executes in `/workflow:plan` Phase 3 when `conflict_risk ≥ medium`.

## Core Responsibilities

| Responsibility | Description |
|---------------|-------------|
| **Detect Conflicts** | Analyze plan vs existing code inconsistencies |
| **Scenario Uniqueness** | **NEW**: Search and compare new modules with existing modules for functional overlaps |
| **Generate Strategies** | Provide 2-4 resolution options per conflict |
| **Iterative Clarification** | **NEW**: Ask unlimited questions until scenario boundaries are clear and unique |
| **Agent Re-analysis** | **NEW**: Dynamically update strategies based on user clarifications |
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
- **NEW**: Functional overlap between new and existing modules
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
Task(subagent_type="cli-execution-agent", prompt=`
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

  ### 1. Load Context
  - Read existing files from conflict_detection.existing_files
  - Load plan from .workflow/active/{session_id}/.process/context-package.json
  - **NEW**: Load exploration_results and use aggregated_insights for enhanced analysis
  - Extract role analyses and requirements

  ### 2. Execute CLI Analysis (Enhanced with Exploration + Scenario Uniqueness)

  Primary (Gemini):
  ccw cli exec "
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
  RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/02-analyze-code-patterns.txt) | Focus on breaking changes, migration needs, and functional overlaps | Prioritize exploration-identified conflicts | analysis=READ-ONLY
  " --tool gemini --mode analysis --cd {project_root}

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

  Return JSON format for programmatic processing:

  \`\`\`json
  {
    "conflicts": [
      {
        "id": "CON-001",
        "brief": "一行中文冲突摘要",
        "severity": "Critical|High|Medium",
        "category": "Architecture|API|Data|Dependency|ModuleOverlap",
        "affected_files": [
          ".workflow/active/{session}/.brainstorm/guidance-specification.md",
          ".workflow/active/{session}/.brainstorm/system-architect/analysis.md"
        ],
        "description": "详细描述冲突 - 什么不兼容",
        "impact": {
          "scope": "影响的模块/组件",
          "compatibility": "Yes|No|Partial",
          "migration_required": true|false,
          "estimated_effort": "人天估计"
        },
        "overlap_analysis": {
          "// NOTE": "仅当 category=ModuleOverlap 时需要此字段",
          "new_module": {
            "name": "新模块名称",
            "scenarios": ["场景1", "场景2", "场景3"],
            "responsibilities": "职责描述"
          },
          "existing_modules": [
            {
              "file": "src/existing/module.ts",
              "name": "现有模块名称",
              "scenarios": ["场景A", "场景B"],
              "overlap_scenarios": ["重叠场景1", "重叠场景2"],
              "responsibilities": "现有模块职责"
            }
          ]
        },
        "strategies": [
          {
            "name": "策略名称（中文）",
            "approach": "实现方法简述",
            "complexity": "Low|Medium|High",
            "risk": "Low|Medium|High",
            "effort": "时间估计",
            "pros": ["优点1", "优点2"],
            "cons": ["缺点1", "缺点2"],
            "clarification_needed": [
              "// NOTE: 仅当需要用户进一步澄清时需要此字段（尤其是 ModuleOverlap）",
              "新模块的核心职责边界是什么？",
              "如何与现有模块 X 协作？",
              "哪些场景应该由新模块处理？"
            ],
            "modifications": [
              {
                "file": ".workflow/active/{session}/.brainstorm/guidance-specification.md",
                "section": "## 2. System Architect Decisions",
                "change_type": "update",
                "old_content": "原始内容片段（用于定位）",
                "new_content": "修改后的内容",
                "rationale": "为什么这样改"
              },
              {
                "file": ".workflow/active/{session}/.brainstorm/system-architect/analysis.md",
                "section": "## Design Decisions",
                "change_type": "update",
                "old_content": "原始内容片段",
                "new_content": "修改后的内容",
                "rationale": "修改理由"
              }
            ]
          },
          {
            "name": "策略2名称",
            "approach": "...",
            "complexity": "Medium",
            "risk": "Low",
            "effort": "1-2天",
            "pros": ["优点"],
            "cons": ["缺点"],
            "modifications": [...]
          }
        ],
        "recommended": 0,
        "modification_suggestions": [
          "建议1：具体的修改方向或注意事项",
          "建议2：可能需要考虑的边界情况",
          "建议3：相关的最佳实践或模式"
        ]
      }
    ],
    "summary": {
      "total": 2,
      "critical": 1,
      "high": 1,
      "medium": 0
    }
  }
  \`\`\`

  ⚠️ CRITICAL Requirements for modifications field:
  - old_content: Must be exact text from target file (20-100 chars for unique match)
  - new_content: Complete replacement text (maintains formatting)
  - change_type: "update" (replace), "add" (insert), "remove" (delete)
  - file: Full path relative to project root
  - section: Markdown heading for context (helps locate position)
  - Minimum 2 strategies per conflict, max 4
  - All text in Chinese for user-facing fields (brief, name, pros, cons)
  - modification_suggestions: 2-5 actionable suggestions for custom handling (Chinese)

  Quality Standards:
  - Each strategy must have actionable modifications
  - old_content must be precise enough for Edit tool matching
  - new_content preserves markdown formatting and structure
  - Recommended strategy (index) based on lowest complexity + risk
  - modification_suggestions must be specific, actionable, and context-aware
  - Each suggestion should address a specific aspect (compatibility, migration, testing, etc.)
`)
```

**Agent Internal Flow** (Enhanced):
```
1. Load context package
2. Check conflict_risk (exit if none/low)
3. Read existing files + plan artifacts
4. Run CLI analysis (Gemini→Qwen→Claude) with enhanced tasks:
   - Standard conflict detection (Architecture/API/Data/Dependency)
   - **NEW: Module scenario uniqueness detection**
     * Extract new module functionality from plan
     * Search all existing modules with similar keywords/functionality
     * Compare scenario coverage and responsibilities
     * Identify functional overlaps and boundary ambiguities
     * Generate ModuleOverlap conflicts with overlap_analysis
5. Parse conflict findings (including ModuleOverlap category)
6. Generate 2-4 strategies per conflict:
   - Include modifications for each strategy
   - **For ModuleOverlap**: Add clarification_needed questions for boundary definition
7. Return JSON to stdout (NOT file write)
8. Return execution log path
```

### Phase 3: Iterative User Interaction with Clarification Loop

**Execution Flow**:
```
FOR each conflict (逐个处理，无数量限制):
  clarified = false
  round = 0
  userClarifications = []

  WHILE (!clarified && round < 10):
    round++

    // 1. Display conflict (包含所有关键字段)
    - category, id, brief, severity, description
    - IF ModuleOverlap: 展示 overlap_analysis
      * new_module: {name, scenarios, responsibilities}
      * existing_modules[]: {file, name, scenarios, overlap_scenarios, responsibilities}

    // 2. Display strategies (2-4个策略 + 自定义选项)
    - FOR each strategy: {name, approach, complexity, risk, effort, pros, cons}
      * IF clarification_needed: 展示待澄清问题列表
    - 自定义选项: {suggestions: modification_suggestions[]}

    // 3. User selects strategy
    userChoice = readInput()

    IF userChoice == "自定义":
      customConflicts.push({id, brief, category, suggestions, overlap_analysis})
      clarified = true
      BREAK

    selectedStrategy = strategies[userChoice]

    // 4. Clarification loop
    IF selectedStrategy.clarification_needed.length > 0:
      // 收集澄清答案
      FOR each question:
        answer = readInput()
        userClarifications.push({question, answer})

      // Agent 重新分析
      reanalysisResult = Task(cli-execution-agent, prompt={
        冲突信息: {id, brief, category, 策略}
        用户澄清: userClarifications[]
        场景分析: overlap_analysis (if ModuleOverlap)

        输出: {
          uniqueness_confirmed: bool,
          rationale: string,
          updated_strategy: {name, approach, complexity, risk, effort, modifications[]},
          remaining_questions: [] (如果仍有歧义)
        }
      })

      IF reanalysisResult.uniqueness_confirmed:
        selectedStrategy = updated_strategy
        selectedStrategy.clarifications = userClarifications
        clarified = true
      ELSE:
        // 更新澄清问题，继续下一轮
        selectedStrategy.clarification_needed = remaining_questions
    ELSE:
      clarified = true

    resolvedConflicts.push({conflict, strategy: selectedStrategy})
  END WHILE
END FOR

// Build output
selectedStrategies = resolvedConflicts.map(r => ({
  conflict_id, strategy, clarifications[]
}))
```

**Key Data Structures**:

```javascript
// Custom conflict tracking
customConflicts[] = {
  id, brief, category,
  suggestions: modification_suggestions[],
  overlap_analysis: { new_module{}, existing_modules[] }  // ModuleOverlap only
}

// Agent re-analysis prompt output
{
  uniqueness_confirmed: bool,
  rationale: string,
  updated_strategy: {
    name, approach, complexity, risk, effort,
    modifications: [{file, section, change_type, old_content, new_content, rationale}]
  },
  remaining_questions: string[]
}
```

**Text Output Example** (展示关键字段):

```markdown
============================================================
冲突 1/3 - 第 1 轮
============================================================
【ModuleOverlap】CON-001: 新增用户认证服务与现有模块功能重叠
严重程度: High | 描述: 计划中的 UserAuthService 与现有 AuthManager 场景重叠

--- 场景重叠分析 ---
新模块: UserAuthService | 场景: 登录, Token验证, 权限, MFA
现有模块: AuthManager (src/auth/AuthManager.ts) | 重叠: 登录, Token验证

--- 解决策略 ---
1) 合并 (Low复杂度 | Low风险 | 2-3天)
   ⚠️ 需澄清: AuthManager是否能承担MFA？

2) 拆分边界 (Medium复杂度 | Medium风险 | 4-5天)
   ⚠️ 需澄清: 基础/高级认证边界? Token验证归谁?

3) 自定义修改
   建议: 评估扩展性; 策略模式分离; 定义接口边界

请选择 (1-3): > 2

--- 澄清问答 (第1轮) ---
Q: 基础/高级认证边界?
A: 基础=密码登录+token验证, 高级=MFA+OAuth+SSO

Q: Token验证归谁?
A: 统一由 AuthManager 负责

🔄 重新分析...
✅ 唯一性已确认 | 理由: 边界清晰 - AuthManager(基础+token), UserAuthService(MFA+OAuth+SSO)

============================================================
冲突 2/3 - 第 1 轮 [下一个冲突]
============================================================
```

**Loop Characteristics**: 逐个处理 | 无限轮次(max 10) | 动态问题生成 | Agent重新分析判断唯一性 | ModuleOverlap场景边界澄清

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
console.log(`\n📄 冲突解决结果已保存: ${resolutionPath}`);

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

### Secondary: Agent JSON Response (stdout)

**Focus**: Structured conflict data with actionable modifications for programmatic processing.

**Structure**: Defined in Phase 2, Step 4 (agent prompt)

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
- Requires: `conflict_risk ≥ medium`

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

