---
name: conflict-resolution
description: Detect and resolve conflicts between plan and existing codebase using CLI-powered analysis
argument-hint: "--session WFS-session-id --context path/to/context-package.json"
examples:
  - /workflow:tools:conflict-resolution --session WFS-auth --context .workflow/WFS-auth/.process/context-package.json
  - /workflow:tools:conflict-resolution --session WFS-payment --context .workflow/WFS-payment/.process/context-package.json
---

# Conflict Resolution Command (/workflow:tools:conflict-resolution)

## Overview
Analyzes potential conflicts between implementation plan and existing codebase, generating multiple resolution strategies for user selection.

**Trigger Condition**: Only execute when context-package.json indicates conflict_risk is "medium" or "high"

**Scope**: Conflict detection and resolution strategy generation only. Does NOT modify code or generate tasks.

**Usage**: Automatically triggered in `/workflow:plan` Phase 3 when conflict risk detected.

## Core Philosophy & Responsibilities
- **Conflict Detection**: Analyze plan vs existing code architecture inconsistencies
- **Multi-Strategy Generation**: Generate 2-4 resolution options per conflict
- **CLI-Powered Analysis**: Use Gemini/Qwen/Codex for deep code analysis
- **Graceful Fallback**: Use Claude analysis if CLI tools unavailable
- **User Decision**: Present strategies for user selection, never auto-apply
- **Single Output**: Generate CONFLICT_RESOLUTION.md with findings and options

## Conflict Detection Categories

**Architecture Conflicts**:
- New architecture incompatible with existing patterns
- Module structure changes affecting existing components
- Design pattern migrations required

**API & Interface Conflicts**:
- Breaking changes to existing API contracts
- Function signature modifications
- Public interface changes affecting dependents

**Data Model Conflicts**:
- Database schema modifications
- Data type changes breaking compatibility
- Migration requirements for existing data

**Dependency Conflicts**:
- Version conflicts with existing dependencies
- New dependencies incompatible with current setup
- Breaking changes in dependency updates

## Execution Lifecycle

### Phase 1: Validation & Trigger Check
1. **Session Validation**: Verify `.workflow/{session_id}/` exists
2. **Context Package Loading**: Read and parse context-package.json
3. **Conflict Risk Check**:
   ```javascript
   if (context_package.conflict_detection.conflict_risk in ["none", "low"]) {
     SKIP: "No significant conflicts detected"
     EXIT
   }
   ```
4. **Agent Preparation**: Prepare agent task prompt with conflict analysis requirements

### Phase 2: Agent-Delegated Conflict Analysis

**Agent Invocation**:
```javascript
Task(
  subagent_type="cli-execution-agent",
  description="Detect and analyze code conflicts",
  prompt=`
## Execution Context

**Session ID**: {session_id}
**Mode**: Conflict Detection and Resolution Strategy Generation
**Conflict Risk**: {conflict_risk}

## Input Context

**Context Package**: {context_path}
**Existing Files**: {existing_files_list}
**Affected Modules**: {affected_modules}

## Analysis Task

### Step 1: Load Existing Codebase Context
1. **Load Existing Files** (from context package existing_files)
   - Read all files listed in conflict_detection.existing_files
   - Analyze current architecture patterns
   - Identify current API contracts and interfaces

2. **Load Plan Requirements** (from session context)
   - Read .workflow/{session_id}/.brainstorming/*/analysis.md (if exists)
   - Extract requirements and design decisions
   - Identify planned changes

### Step 2: CLI-Powered Conflict Analysis
Execute conflict analysis using CLI tools:

**Primary Tool - Gemini Analysis**:
\`\`\`bash
cd {project_root} && gemini -p "
PURPOSE: Analyze conflicts between plan and existing code
TASK:
• Compare existing architecture with planned changes
• Identify API contract breaking changes
• Detect data model incompatibilities
• Assess dependency conflicts
MODE: analysis
CONTEXT: @{existing_files_pattern} @.workflow/{session_id}/**/*
EXPECTED: Conflict list with severity and affected areas
RULES: Focus on breaking changes and migration complexity
"
\`\`\`

**Fallback - Qwen Analysis** (if Gemini unavailable):
Same prompt structure, replace 'gemini' with 'qwen'

**Fallback - Claude Analysis** (if CLI unavailable):
- Manual file reading and comparison
- Pattern matching for common conflict types
- Heuristic-based conflict detection

### Step 3: Generate Resolution Strategies
For each detected conflict, generate 2-4 resolution options:

**Strategy Template**:
```markdown
### Conflict: {conflict_name}
**Severity**: Critical | High | Medium
**Category**: Architecture | API | Data Model | Dependency
**Affected Files**: {file_list}
**Impact**: {impact_description}

#### Option 1: {strategy_name}
**Approach**: {brief_description}
**Pros**:
- {advantage_1}
- {advantage_2}
**Cons**:
- {disadvantage_1}
- {disadvantage_2}
**Effort**: Low | Medium | High
**Risk**: Low | Medium | High

#### Option 2: {strategy_name}
...

**Recommended**: Option {N} - {rationale}
```

### Step 4: Generate CONFLICT_RESOLUTION.md
Create comprehensive conflict resolution document:

**Output Location**: \`.workflow/{session_id}/.process/CONFLICT_RESOLUTION.md\`

**Required Structure**:
1. **Executive Summary**: Total conflicts, severity distribution, overall risk
2. **Conflict Analysis**: Detailed per-conflict analysis with categories
3. **Resolution Strategies**: Multiple options per conflict with pros/cons
4. **Recommended Actions**: Prioritized recommendations with rationale
5. **Migration Considerations**: Data/API migration requirements if any

### Output Requirements

**Quality Standards**:
- Minimum 2 resolution options per conflict
- Clear pros/cons for each strategy
- Effort and risk estimates included
- Recommended strategy with clear rationale
- Actionable migration steps if required

## Output
Generate CONFLICT_RESOLUTION.md and report completion status:
- Conflicts detected: {count}
- Severity distribution: Critical: {N}, High: {N}, Medium: {N}
- Resolution strategies: {total_options}
- Output location: .workflow/{session_id}/.process/CONFLICT_RESOLUTION.md
\`
)
```

**Agent Execution Flow** (Internal to cli-execution-agent):
1. Parse session ID and context path, load context-package.json
2. Check conflict_risk, exit if none/low
3. Load existing codebase files from conflict_detection.existing_files
4. Load plan requirements from session brainstorming artifacts
5. Execute CLI tool analysis (Gemini/Qwen/Claude fallback)
6. Parse conflict findings from CLI output
7. Generate resolution strategies (2-4 options per conflict)
8. Create CONFLICT_RESOLUTION.md with structured findings
9. Verify output file exists at correct path
10. Return execution log path

**Command Execution**: Launch agent via Task tool, wait for completion

### Phase 3: Output Validation
1. **File Verification**: Confirm `.workflow/{session_id}/.process/CONFLICT_RESOLUTION.md` exists
2. **Content Validation**: Verify required sections present
3. **Strategy Quality**: Ensure minimum 2 options per conflict
4. **Agent Log**: Retrieve agent execution log from `.workflow/{session_id}/.chat/`
5. **Success Criteria**: File exists, contains all required sections, strategies actionable

## CONFLICT_RESOLUTION.md Format

**Template Reference**: Resolution document focuses on **conflict identification, impact analysis, and strategic options** (NOT implementation).

### Required Structure

```markdown
# Conflict Resolution Report

**Session**: WFS-{session-id}
**Generated**: {timestamp}
**Conflict Risk**: {medium|high}
**Total Conflicts**: {count}

## Executive Summary

**Overall Assessment**: {summary_paragraph}

**Severity Distribution**:
- Critical: {count} - Blocking issues requiring immediate resolution
- High: {count} - Significant issues affecting core functionality
- Medium: {count} - Moderate issues with workarounds available

**Recommended Priority**: {conflict_id_1}, {conflict_id_2}, ...

---

## Conflict Analysis

### Conflict 1: {conflict_name}
**ID**: CON-001
**Severity**: Critical | High | Medium
**Category**: Architecture | API | Data Model | Dependency
**Affected Files**:
- {file_1}
- {file_2}

**Description**: {detailed_conflict_description}

**Impact Analysis**:
- **Scope**: {which_modules_affected}
- **Backward Compatibility**: {yes/no/partial}
- **Migration Required**: {yes/no}
- **Estimated Effort**: {person-days}

#### Resolution Strategies

##### Option 1: {strategy_name}
**Approach**: {implementation_approach}

**Pros**:
- {advantage_1}
- {advantage_2}

**Cons**:
- {disadvantage_1}
- {disadvantage_2}

**Implementation Complexity**: Low | Medium | High
**Risk Level**: Low | Medium | High
**Estimated Effort**: {time_estimate}

##### Option 2: {strategy_name}
...

**Recommended Strategy**: Option {N}
**Rationale**: {why_this_option_is_best}

---

## Recommended Actions

### Priority 1: Address Critical Conflicts
1. {conflict_id}: {brief_action} - {recommended_strategy}
2. ...

### Priority 2: Resolve High-Severity Issues
1. {conflict_id}: {brief_action} - {recommended_strategy}
2. ...

### Priority 3: Handle Medium Issues
1. {conflict_id}: {brief_action} - {recommended_strategy}
2. ...

## Migration Considerations

**Data Migration**:
- {migration_task_1}
- {migration_task_2}

**API Versioning**:
- {versioning_strategy}

**Rollback Strategy**:
- {rollback_plan}

---

## Next Steps

**Before Implementation**:
1. Review and select resolution strategies
2. Update IMPL_PLAN.md with conflict resolution decisions
3. Validate migration requirements

**Proceed to**:
- /workflow:plan continue → Proceed with task generation
```

### Content Focus
- ✅ Conflict detection with severity classification
- ✅ Multiple resolution strategies per conflict
- ✅ Pros/cons analysis for each strategy
- ✅ Effort and risk estimates
- ✅ Migration considerations
- ❌ Direct code changes or patches
- ❌ Implementation details (save for IMPL_PLAN)
- ❌ Task breakdowns (handled by task generation)

## Execution Management

### Error Handling & Recovery
1. **Pre-execution**: Verify conflict_risk warrants execution
2. **Agent Monitoring**: Track agent execution status via Task tool
3. **Validation**: Check CONFLICT_RESOLUTION.md generation on completion
4. **Error Recovery**:
   - Agent execution failure → report error, check agent logs
   - Missing output file → retry agent execution once
   - CLI tool failure → fallback to Claude analysis
5. **Graceful Degradation**: If all analysis methods fail, generate basic conflict report from heuristics

## Integration & Success Criteria

### Input/Output Interface
**Input**:
- `--session` (required): Session ID (e.g., WFS-auth)
- `--context` (required): Context package path
- Context package must have conflict_risk ≥ medium

**Output**:
- Single file: `CONFLICT_RESOLUTION.md` at `.workflow/{session_id}/.process/`
- No code modifications

### Quality & Success Validation
**Quality Checks**: Completeness, strategy diversity, actionability

**Success Criteria**:
- ✅ Conflict detection complete (all categories scanned)
- ✅ Minimum 2 resolution strategies per conflict
- ✅ Clear pros/cons for each strategy
- ✅ Effort and risk estimates provided
- ✅ Recommended strategy with rationale
- ✅ Migration considerations documented
- ✅ CLI-powered analysis (with fallback handling)
- ✅ Robust error handling (validation, retry, degradation)
- ✅ Agent execution log saved to session chat directory

## Related Commands
- `/context:gather` - Generates conflict_detection data required by this command
- `/workflow:plan` - Automatically calls this command when conflict_risk ≥ medium
- `/task:create` - Creates tasks based on selected resolution strategies
