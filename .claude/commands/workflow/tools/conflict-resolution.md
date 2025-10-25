---
name: conflict-resolution
description: Detect and resolve conflicts between plan and existing codebase using CLI-powered analysis
argument-hint: "--session WFS-session-id --context path/to/context-package.json"
examples:
  - /workflow:tools:conflict-resolution --session WFS-auth --context .workflow/WFS-auth/.process/context-package.json
  - /workflow:tools:conflict-resolution --session WFS-payment --context .workflow/WFS-payment/.process/context-package.json
---

# Conflict Resolution Command

## Purpose
Analyzes conflicts between implementation plans and existing codebase, generating multiple resolution strategies.

**Scope**: Detection and strategy generation only - NO code modification or task creation.

**Trigger**: Auto-executes in `/workflow:plan` Phase 3 when `conflict_risk ≥ medium`.

## Core Responsibilities

| Responsibility | Description |
|---------------|-------------|
| **Detect Conflicts** | Analyze plan vs existing code inconsistencies |
| **Generate Strategies** | Provide 2-4 resolution options per conflict |
| **CLI Analysis** | Use Gemini/Qwen (Claude fallback) |
| **User Decision** | Present options, never auto-apply |
| **Single Output** | `CONFLICT_RESOLUTION.md` with findings |

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

  ## Analysis Steps

  ### 1. Load Context
  - Read existing files from conflict_detection.existing_files
  - Load plan from .workflow/{session_id}/.process/context-package.json
  - Extract role analyses and requirements

  ### 2. Execute CLI Analysis

  Primary (Gemini):
  cd {project_root} && gemini -p "
  PURPOSE: Detect conflicts between plan and codebase
  TASK:
  • Compare architectures
  • Identify breaking API changes
  • Detect data model incompatibilities
  • Assess dependency conflicts
  MODE: analysis
  CONTEXT: @{existing_files} @.workflow/{session_id}/**/*
  EXPECTED: Conflict list with severity ratings
  RULES: Focus on breaking changes and migration needs
  "

  Fallback: Qwen (same prompt) → Claude (manual analysis)

  ### 3. Generate Strategies (2-4 per conflict)

  Template per conflict:
  - Severity: Critical/High/Medium
  - Category: Architecture/API/Data/Dependency
  - Affected files + impact
  - Options with pros/cons, effort, risk
  - Recommended strategy + rationale

  ### 4. Return Structured Conflict Data

  ⚠️ DO NOT generate CONFLICT_RESOLUTION.md file

  Return JSON format for programmatic processing:

  \`\`\`json
  {
    "conflicts": [
      {
        "id": "CON-001",
        "brief": "一行中文冲突摘要",
        "severity": "Critical|High|Medium",
        "category": "Architecture|API|Data|Dependency",
        "affected_files": [
          ".workflow/{session}/.brainstorm/guidance-specification.md",
          ".workflow/{session}/.brainstorm/system-architect/analysis.md"
        ],
        "description": "详细描述冲突 - 什么不兼容",
        "impact": {
          "scope": "影响的模块/组件",
          "compatibility": "Yes|No|Partial",
          "migration_required": true|false,
          "estimated_effort": "人天估计"
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
            "modifications": [
              {
                "file": ".workflow/{session}/.brainstorm/guidance-specification.md",
                "section": "## 2. System Architect Decisions",
                "change_type": "update",
                "old_content": "原始内容片段（用于定位）",
                "new_content": "修改后的内容",
                "rationale": "为什么这样改"
              },
              {
                "file": ".workflow/{session}/.brainstorm/system-architect/analysis.md",
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
        "recommended": 0
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

  Quality Standards:
  - Each strategy must have actionable modifications
  - old_content must be precise enough for Edit tool matching
  - new_content preserves markdown formatting and structure
  - Recommended strategy (index) based on lowest complexity + risk
`)
```

**Agent Internal Flow**:
```
1. Load context package
2. Check conflict_risk (exit if none/low)
3. Read existing files + plan artifacts
4. Run CLI analysis (Gemini→Qwen→Claude)
5. Parse conflict findings
6. Generate 2-4 strategies per conflict with modifications
7. Return JSON to stdout (NOT file write)
8. Return execution log path
```

### Phase 3: User Confirmation via Text Interaction

**Command parses agent JSON output and presents conflicts to user via text**:

```javascript
// 1. Parse agent JSON output
const conflictData = JSON.parse(agentOutput);
const conflicts = conflictData.conflicts; // No 4-conflict limit

// 2. Format conflicts as text output (max 10 per round)
const batchSize = 10;
const batches = chunkArray(conflicts, batchSize);

for (const [batchIdx, batch] of batches.entries()) {
  const totalBatches = batches.length;

  // Output batch header
  console.log(`===== 冲突解决 (第 ${batchIdx + 1}/${totalBatches} 轮) =====\n`);

  // Output each conflict in batch
  batch.forEach((conflict, idx) => {
    const questionNum = batchIdx * batchSize + idx + 1;
    console.log(`【问题${questionNum} - ${conflict.category}】${conflict.id}: ${conflict.brief}`);

    conflict.strategies.forEach((strategy, sIdx) => {
      const optionLetter = String.fromCharCode(97 + sIdx); // a, b, c, ...
      console.log(`${optionLetter}) ${strategy.name}`);
      console.log(`   说明：${strategy.approach}`);
      console.log(`   复杂度: ${strategy.complexity} | 风险: ${strategy.risk} | 工作量: ${strategy.effort}`);
    });

    // Add skip option
    const skipLetter = String.fromCharCode(97 + conflict.strategies.length);
    console.log(`${skipLetter}) 跳过此冲突`);
    console.log(`   说明：稍后手动处理，不应用任何修改\n`);
  });

  console.log(`请回答 (格式: 1a 2b 3c...)：`);

  // Wait for user input
  const userInput = await readUserInput();

  // Parse answers
  const answers = parseUserAnswers(userInput, batch);
}

// 3. Build selected strategies
const selectedStrategies = answers.filter(a => !a.isSkip).map(a => a.strategy);
```

**Text Output Example**:
```markdown
===== 冲突解决 (第 1/1 轮) =====

【问题1 - 认证系统】CON-001: 现有认证系统与计划不兼容
a) 渐进式迁移
   说明：保留现有系统，逐步迁移到新方案
   复杂度: Medium | 风险: Low | 工作量: 3-5天
b) 完全重写
   说明：废弃旧系统，从零实现新认证
   复杂度: High | 风险: Medium | 工作量: 7-10天
c) 跳过此冲突
   说明：稍后手动处理，不应用任何修改

【问题2 - 数据库】CON-002: 数据库 schema 冲突
a) 添加迁移脚本
   说明：创建数据库迁移脚本处理 schema 变更
   复杂度: Low | 风险: Low | 工作量: 1-2天
b) 跳过此冲突
   说明：稍后手动处理，不应用任何修改

请回答 (格式: 1a 2b)：
```

**User Input Examples**:
- `1a 2a` → Conflict 1: 渐进式迁移, Conflict 2: 添加迁移脚本
- `1b 2b` → Conflict 1: 完全重写, Conflict 2: 跳过
- `1c 2c` → Both skipped

### Phase 4: Apply Modifications

```javascript
// 1. Extract modifications from selected strategies
const modifications = [];
selectedStrategies.forEach(strategy => {
  if (strategy !== "skip") {
    modifications.push(...strategy.modifications);
  }
});

// 2. Apply each modification using Edit tool
modifications.forEach(mod => {
  if (mod.change_type === "update") {
    Edit({
      file_path: mod.file,
      old_string: mod.old_content,
      new_string: mod.new_content
    });
  }
  // Handle "add" and "remove" similarly
});

// 3. Update context-package.json
const contextPackage = JSON.parse(Read(contextPath));
contextPackage.conflict_detection.conflict_risk = "resolved";
contextPackage.conflict_detection.resolved_conflicts = conflicts.map(c => c.id);
contextPackage.conflict_detection.resolved_at = new Date().toISOString();
Write(contextPath, JSON.stringify(contextPackage, null, 2));

// 4. Return summary
return {
  resolved: modifications.length,
  skipped: selectedStrategies.filter(s => s === "skip").length,
  modified_files: [...new Set(modifications.map(m => m.file))]
};
```

**Validation**:
```
✓ Agent returns valid JSON structure
✓ Text output displays all conflicts (max 10 per round)
✓ User selections captured correctly
✓ Edit tool successfully applies modifications
✓ guidance-specification.md updated
✓ Role analyses (*.md) updated
✓ context-package.json marked as resolved
✓ Agent log saved to .workflow/{session_id}/.chat/
```

## Output Format: Agent JSON Response

**Focus**: Structured conflict data with actionable modifications for programmatic processing.

**Format**: JSON to stdout (NO file generation)

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
- Modified files:
  - `.workflow/{session_id}/.brainstorm/guidance-specification.md`
  - `.workflow/{session_id}/.brainstorm/{role}/analysis.md`
  - `.workflow/{session_id}/.process/context-package.json` (conflict_risk → resolved)
- NO report file generation

**User Interaction**:
- Text-based strategy selection (max 10 conflicts per round)
- Each conflict: 2-4 strategy options + "跳过" option

### Success Criteria
```
✓ CLI analysis returns valid JSON structure
✓ Conflicts presented in batches (max 10 per round)
✓ Min 2 strategies per conflict with modifications
✓ Text output displays all conflicts correctly
✓ User selections captured and processed
✓ Edit tool applies modifications successfully
✓ guidance-specification.md updated with resolved conflicts
✓ Role analyses (*.md) updated with resolved conflicts
✓ context-package.json marked as "resolved"
✓ No CONFLICT_RESOLUTION.md file generated
✓ Modification summary returned to user
✓ Agent log saved to .workflow/{session_id}/.chat/
✓ Error handling robust (validate/retry/degrade)
```

## Related Commands
| Command | Relationship |
|---------|--------------|
| `/workflow:tools:context-gather` | Generates input conflict_detection data |
| `/workflow:plan` | Auto-triggers this when risk ≥ medium |
| `/workflow:tools:task-generate` | Uses resolved conflicts from updated brainstorm files |
| `/workflow:brainstorm:artifacts` | Generates guidance-specification.md (modified by this command) |
