---
name: verify
description: Cross-validate action plans using gemini and codex analysis before execution
usage: /workflow:verify
argument-hint: none
examples:
  - /workflow:verify
allowed-tools: Task(*), TodoWrite(*), Read(*), Write(*), Edit(*), Bash(*), Glob(*)
---

# Workflow Verify Command

## Overview
Cross-validates existing workflow plans using gemini and codex analysis to ensure plan quality, feasibility, and completeness before execution. **Works between `/workflow:plan` and `/workflow:execute`** to catch potential issues early and suggest improvements.

## Core Responsibilities
- **Session Discovery**: Identify active workflow sessions with completed plans
- **Dual Analysis**: Independent gemini and codex plan evaluation
- **Cross-Validation**: Compare analyses to identify consensus and conflicts
- **Modification Suggestions**: Generate actionable improvement recommendations
- **User Approval**: Interactive approval process for suggested changes
- **Plan Updates**: Apply approved modifications to workflow documents

## Execution Philosophy
- **Quality Assurance**: Comprehensive plan validation before implementation
- **Dual Perspective**: Technical feasibility (codex) + strategic assessment (gemini)
- **User Control**: All modifications require explicit user approval
- **Non-Destructive**: Original plans preserved with versioned updates
- **Context-Rich**: Full workflow context provided to both analysis tools

## Core Workflow

### Verification Process
The command performs comprehensive cross-validation through:

**0. Session Management** ⚠️ FIRST STEP
- **Active session detection**: Check `.workflow/.active-*` markers
- **Session validation**: Ensure session has completed IMPL_PLAN.md
- **Plan readiness check**: Verify tasks exist in `.task/` directory
- **Context availability**: Confirm analysis artifacts are present

**1. Context Preparation & Analysis Setup**
- **Plan context loading**: Load IMPL_PLAN.md, task definitions, and analysis results
- **Documentation gathering**: Collect relevant CLAUDE.md, README.md, and workflow docs
- **Dependency mapping**: Analyze task relationships and constraints
- **Validation criteria setup**: Establish evaluation framework

**2. Parallel Dual Analysis** ⚠️ CRITICAL ARCHITECTURE
- **Gemini Analysis**: Strategic and architectural plan evaluation
- **Codex Analysis**: Technical feasibility and implementation assessment
- **Independent execution**: Both tools analyze simultaneously with full context
- **Comprehensive evaluation**: Each tool evaluates different aspects

**3. Cross-Validation & Synthesis**
- **Consensus identification**: Areas where both analyses agree
- **Conflict analysis**: Discrepancies between gemini and codex evaluations
- **Risk assessment**: Combined evaluation of potential issues
- **Improvement opportunities**: Synthesized recommendations

**4. Interactive Approval Process**
- **Results presentation**: Clear display of findings and suggestions
- **User decision points**: Approval/rejection of each modification category
- **Selective application**: User controls which changes to implement
- **Confirmation workflow**: Multi-step approval for significant changes

## Implementation Standards

### Dual Analysis Architecture ⚠️ CRITICAL
Both tools receive identical context but focus on different validation aspects:

```json
{
  "gemini_analysis": {
    "focus": "strategic_validation",
    "aspects": [
      "architectural_soundness",
      "task_decomposition_logic",
      "dependency_coherence",
      "business_alignment",
      "risk_identification"
    ],
    "context_sources": [
      "IMPL_PLAN.md",
      ".process/ANALYSIS_RESULTS.md",
      "CLAUDE.md",
      ".workflow/docs/"
    ]
  },
  "codex_analysis": {
    "focus": "technical_feasibility",
    "aspects": [
      "implementation_complexity",
      "technical_dependencies",
      "code_structure_assessment",
      "testing_completeness",
      "execution_readiness"
    ],
    "context_sources": [
      ".task/*.json",
      "target_files from flow_control",
      "existing codebase patterns",
      "technical documentation"
    ]
  }
}
```

### Analysis Execution Pattern

**Gemini Strategic Analysis**:
```bash
~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Strategic validation of workflow implementation plan
TASK: Evaluate plan architecture, task decomposition, and business alignment
CONTEXT: @{.workflow/WFS-*/IMPL_PLAN.md,.workflow/WFS-*/.process/ANALYSIS_RESULTS.md,CLAUDE.md}
EXPECTED: Strategic assessment with architectural recommendations
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/verification/gemini-strategic.txt) | Focus on strategic soundness and risk identification
"
```

**Codex Technical Analysis**:
```bash
codex --full-auto exec "
PURPOSE: Technical feasibility assessment of workflow implementation plan
TASK: Evaluate implementation complexity, dependencies, and execution readiness
CONTEXT: @{.workflow/WFS-*/.task/*.json,CLAUDE.md,README.md} Target files and flow control definitions
EXPECTED: Technical assessment with implementation recommendations
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/verification/codex-technical.txt) | Focus on technical feasibility and code quality
" -s danger-full-access
```

**Cross-Validation Analysis**:
```bash
~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Cross-validate and synthesize strategic and technical assessments
TASK: Compare analyses, resolve conflicts, and generate integrated recommendations
CONTEXT: @{.workflow/WFS-*/.verification/gemini-analysis.md,.workflow/WFS-*/.verification/codex-analysis.md}
EXPECTED: Synthesized recommendations with user approval framework
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/verification/cross-validation.txt) | Focus on balanced integration and user decision points
"
```

### Cross-Validation Matrix

**Validation Categories**:
1. **Task Decomposition**: Is breakdown logical and complete?
2. **Dependency Management**: Are task relationships correctly modeled?
3. **Implementation Scope**: Is each task appropriately sized?
4. **Technical Feasibility**: Are implementation approaches viable?
5. **Context Completeness**: Do tasks have adequate context?
6. **Testing Coverage**: Are testing requirements sufficient?
7. **Documentation Quality**: Are requirements clear and complete?

**Consensus Analysis**:
- **Agreement Areas**: Both tools identify same strengths/issues
- **Divergent Views**: Different perspectives requiring user decision
- **Risk Levels**: Combined assessment of implementation risks
- **Priority Recommendations**: Most critical improvements identified

### User Approval Workflow

**Interactive Approval Process**:
1. **Results Presentation**: Show analysis summary and key findings
2. **Category-based Approval**: Present modifications grouped by type
3. **Impact Assessment**: Explain consequences of each change
4. **Selective Implementation**: User chooses which changes to apply
5. **Confirmation Steps**: Final review before plan modification

**Step-by-Step User Interaction**:

**Step 1: Present Analysis Summary**
```
## Verification Results for WFS-[session-name]

### Analysis Summary
- **Gemini Strategic Grade**: B+ (Strong architecture, minor business alignment issues)
- **Codex Technical Grade**: A- (High implementation feasibility, good code structure)
- **Combined Risk Level**: Medium (Dependency complexity, timeline concerns)
- **Overall Recommendation**: Proceed with modifications

### Key Findings
✅ **Strengths Identified**: Task decomposition logical, technical approach sound
⚠️ **Areas for Improvement**: Missing error handling, unclear success criteria
❌ **Critical Issues**: Circular dependency in IMPL-3 → IMPL-1 chain
```

**Step 2: Category-based Modification Approval**
```bash
# Interactive prompts for each category
echo "Review the following modification categories:"
echo ""
echo "=== CRITICAL CHANGES (Must be addressed) ==="
read -p "1. Fix circular dependency IMPL-3 → IMPL-1? [Y/n]: " fix_dependency
read -p "2. Add missing error handling context to IMPL-2? [Y/n]: " add_error_handling

echo ""
echo "=== IMPORTANT IMPROVEMENTS (Recommended) ==="
read -p "3. Merge granular tasks IMPL-1.1 + IMPL-1.2? [Y/n]: " merge_tasks
read -p "4. Enhance success criteria for IMPL-4? [Y/n]: " enhance_criteria

echo ""
echo "=== OPTIONAL ENHANCEMENTS (Nice to have) ==="
read -p "5. Add API documentation task? [y/N]: " add_docs_task
read -p "6. Include performance testing in IMPL-3? [y/N]: " add_perf_tests
```

**Step 3: Impact Assessment Display**
For each approved change, show detailed impact:
```
Change: Merge tasks IMPL-1.1 + IMPL-1.2
Impact:
- Files affected: .task/IMPL-1.1.json, .task/IMPL-1.2.json → .task/IMPL-1.json
- Dependencies: IMPL-2.depends_on changes from ["IMPL-1.1", "IMPL-1.2"] to ["IMPL-1"]
- Estimated time: Reduces from 8h to 6h (reduced coordination overhead)
- Risk: Low (combining related functionality)
```

**Step 4: Modification Confirmation**
```bash
echo "Summary of approved changes:"
echo "✓ Fix circular dependency IMPL-3 → IMPL-1"
echo "✓ Add error handling context to IMPL-2"
echo "✓ Merge tasks IMPL-1.1 + IMPL-1.2"
echo "✗ Enhance success criteria for IMPL-4 (user declined)"
echo ""
read -p "Apply these modifications to the workflow plan? [Y/n]: " final_approval

if [[ "$final_approval" =~ ^[Yy]$ ]] || [[ -z "$final_approval" ]]; then
  echo "Creating backups and applying modifications..."
else
  echo "Modifications cancelled. Original plan preserved."
fi
```

**Approval Categories**:
```markdown
## Verification Results Summary

### ✅ Consensus Recommendations (Both gemini and codex agree)
- [ ] **Task Decomposition**: Merge IMPL-1.1 and IMPL-1.2 (too granular)
- [ ] **Dependencies**: Add missing dependency IMPL-3 → IMPL-4
- [ ] **Context**: Enhance context.requirements for IMPL-2

### ⚠️ Conflicting Assessments (gemini vs codex differ)
- [ ] **Scope**: gemini suggests splitting IMPL-5, codex suggests keeping merged
- [ ] **Testing**: gemini prioritizes integration tests, codex emphasizes unit tests

### 🔍 Individual Tool Recommendations
#### Gemini (Strategic)
- [ ] **Architecture**: Consider API versioning strategy
- [ ] **Risk**: Add rollback plan for database migrations

#### Codex (Technical)
- [ ] **Implementation**: Use existing auth patterns in /src/auth/
- [ ] **Dependencies**: Update package.json dependencies first
```

## Document Generation & Modification

**Verification Workflow**: Analysis → Cross-Validation → User Approval → Plan Updates → Versioning

**Always Created**:
- **VERIFICATION_RESULTS.md**: Complete analysis results and recommendations
- **verification-session.json**: Analysis metadata and user decisions
- **PLAN_MODIFICATIONS.md**: Record of approved changes

**Auto-Created (if modifications approved)**:
- **IMPL_PLAN.md.backup**: Original plan backup before modifications
- **Updated task JSONs**: Modified .task/*.json files with improvements
- **MODIFICATION_LOG.md**: Detailed change log with timestamps

**Document Structure**:
```
.workflow/WFS-[topic]/.verification/
├── verification-session.json      # Analysis session metadata
├── VERIFICATION_RESULTS.md        # Complete analysis results
├── PLAN_MODIFICATIONS.md          # Approved changes record
├── gemini-analysis.md             # Gemini strategic analysis
├── codex-analysis.md              # Codex technical analysis
├── cross-validation-matrix.md     # Comparison analysis
└── backups/
    ├── IMPL_PLAN.md.backup        # Original plan backup
    └── task-backups/              # Original task JSON backups
```

### Modification Implementation

**Safe Modification Process**:
1. **Backup Creation**: Save original files before any changes
2. **Atomic Updates**: Apply all approved changes together
3. **Validation**: Verify modified plans are still valid
4. **Rollback Capability**: Easy restoration if issues arise

**Implementation Commands**:

**Step 1: Create Backups**
```bash
# Create backup directory with timestamp
backup_dir=".workflow/WFS-$session/.verification/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$backup_dir/task-backups"

# Backup main plan and task files
cp IMPL_PLAN.md "$backup_dir/IMPL_PLAN.md.backup"
cp -r .task/ "$backup_dir/task-backups/"

# Create backup manifest
echo "Backup created at $(date)" > "$backup_dir/backup-manifest.txt"
echo "Session: $session" >> "$backup_dir/backup-manifest.txt"
echo "Files backed up:" >> "$backup_dir/backup-manifest.txt"
ls -la IMPL_PLAN.md .task/*.json >> "$backup_dir/backup-manifest.txt"
```

**Step 2: Apply Approved Modifications**
```bash
# Example: Merge tasks IMPL-1.1 + IMPL-1.2
if [[ "$merge_tasks" =~ ^[Yy]$ ]]; then
  echo "Merging IMPL-1.1 and IMPL-1.2..."

  # Combine task contexts
  jq -s '
    {
      "id": "IMPL-1",
      "title": (.[0].title + " and " + .[1].title),
      "status": "pending",
      "meta": .[0].meta,
      "context": {
        "requirements": (.[0].context.requirements + " " + .[1].context.requirements),
        "focus_paths": (.[0].context.focus_paths + .[1].context.focus_paths | unique),
        "acceptance": (.[0].context.acceptance + .[1].context.acceptance),
        "depends_on": (.[0].context.depends_on + .[1].context.depends_on | unique)
      },
      "flow_control": {
        "target_files": (.[0].flow_control.target_files + .[1].flow_control.target_files | unique),
        "implementation_approach": .[0].flow_control.implementation_approach
      }
    }
  ' .task/IMPL-1.1.json .task/IMPL-1.2.json > .task/IMPL-1.json

  # Remove old task files
  rm .task/IMPL-1.1.json .task/IMPL-1.2.json

  # Update dependent tasks
  for task_file in .task/*.json; do
    jq '
      if .context.depends_on then
        .context.depends_on = [
          .context.depends_on[] |
          if . == "IMPL-1.1" or . == "IMPL-1.2" then "IMPL-1"
          else .
          end
        ] | unique
      else . end
    ' "$task_file" > "$task_file.tmp" && mv "$task_file.tmp" "$task_file"
  done
fi

# Example: Fix circular dependency
if [[ "$fix_dependency" =~ ^[Yy]$ ]]; then
  echo "Fixing circular dependency IMPL-3 → IMPL-1..."

  # Remove problematic dependency
  jq 'if .id == "IMPL-3" then .context.depends_on = (.context.depends_on - ["IMPL-1"]) else . end' \
    .task/IMPL-3.json > .task/IMPL-3.json.tmp && mv .task/IMPL-3.json.tmp .task/IMPL-3.json
fi

# Example: Add error handling context
if [[ "$add_error_handling" =~ ^[Yy]$ ]]; then
  echo "Adding error handling context to IMPL-2..."

  jq '.context.requirements += " Include comprehensive error handling and user feedback for all failure scenarios."' \
    .task/IMPL-2.json > .task/IMPL-2.json.tmp && mv .task/IMPL-2.json.tmp .task/IMPL-2.json
fi
```

**Step 3: Validation and Cleanup**
```bash
# Validate modified JSON files
echo "Validating modified task files..."
for task_file in .task/*.json; do
  if ! jq empty "$task_file" 2>/dev/null; then
    echo "ERROR: Invalid JSON in $task_file - restoring backup"
    cp "$backup_dir/task-backups/$(basename $task_file)" "$task_file"
  else
    echo "✓ $task_file is valid"
  fi
done

# Update IMPL_PLAN.md with modification summary
cat >> IMPL_PLAN.md << EOF

## Plan Verification and Modifications

**Verification Date**: $(date)
**Modifications Applied**:
$(if [[ "$merge_tasks" =~ ^[Yy]$ ]]; then echo "- Merged IMPL-1.1 and IMPL-1.2 for better cohesion"; fi)
$(if [[ "$fix_dependency" =~ ^[Yy]$ ]]; then echo "- Fixed circular dependency in IMPL-3"; fi)
$(if [[ "$add_error_handling" =~ ^[Yy]$ ]]; then echo "- Enhanced error handling requirements in IMPL-2"; fi)

**Backup Location**: $backup_dir
**Analysis Reports**: .verification/VERIFICATION_RESULTS.md
EOF

# Generate modification log
cat > .verification/MODIFICATION_LOG.md << EOF
# Plan Modification Log

## Session: $session
## Date: $(date)

### Applied Modifications
$(echo "Changes applied based on cross-validation analysis")

### Backup Information
- Backup Directory: $backup_dir
- Original Files: IMPL_PLAN.md, .task/*.json
- Restore Command: cp $backup_dir/* ./

### Validation Results
$(echo "All modified files validated successfully")
EOF

echo "Modifications applied successfully!"
echo "Backup created at: $backup_dir"
echo "Modification log: .verification/MODIFICATION_LOG.md"
```

**Change Categories & Implementation**:

**Task Modifications**:
- **Task Merging**: Combine related tasks with dependency updates
- **Task Splitting**: Divide complex tasks with new dependencies
- **Context Enhancement**: Add missing requirements or acceptance criteria
- **Dependency Updates**: Add/remove/modify depends_on relationships

**Plan Enhancements**:
- **Requirements Clarification**: Improve requirement definitions
- **Success Criteria**: Add measurable acceptance criteria
- **Risk Mitigation**: Add risk assessment and mitigation steps
- **Documentation Updates**: Enhance context and documentation

## Session Management ⚠️ CRITICAL
- **⚡ FIRST ACTION**: Check for all `.workflow/.active-*` markers
- **Plan validation**: Ensure active session has completed IMPL_PLAN.md
- **Task readiness**: Verify .task/ directory contains valid task definitions
- **Analysis prerequisites**: Confirm planning analysis artifacts exist
- **Context isolation**: Each session maintains independent verification state

## Error Handling & Recovery

### Verification Phase Errors
| Error | Cause | Resolution |
|-------|-------|------------|
| No active session | Missing `.active-*` markers | Run `/workflow:plan` first |
| Incomplete plan | Missing IMPL_PLAN.md | Complete planning phase |
| No task definitions | Empty .task/ directory | Regenerate tasks |
| Analysis tool failure | Tool execution error | Retry with fallback context |

### Recovery Procedures

**Session Recovery**:
```bash
# Validate session readiness
if [ ! -f ".workflow/$session/IMPL_PLAN.md" ]; then
  echo "Plan incomplete - run /workflow:plan first"
  exit 1
fi

# Check task definitions exist
if [ ! -d ".workflow/$session/.task/" ] || [ -z "$(ls .workflow/$session/.task/)" ]; then
  echo "No task definitions found - regenerate tasks"
  exit 1
fi
```

**Analysis Recovery**:
```bash
# Retry failed analysis with reduced context
if [ "$GEMINI_FAILED" = "true" ]; then
  echo "Retrying gemini analysis with minimal context..."
fi

# Use fallback analysis if tools unavailable
if [ "$TOOLS_UNAVAILABLE" = "true" ]; then
  echo "Using manual validation checklist..."
fi
```

## Usage Examples & Integration

### Complete Verification Workflow
```bash
# 1. After completing planning
/workflow:plan "Build authentication system"

# 2. Verify the plan before execution
/workflow:verify

# 3. Review and approve suggested modifications
# (Interactive prompts guide through approval process)

# 4. Execute verified plan
/workflow:execute
```

### Common Scenarios

#### Quick Verification Check
```bash
/workflow:verify --quick    # Basic validation without modifications
```

#### Re-verification After Changes
```bash
/workflow:verify --recheck  # Re-run after manual plan modifications
```

#### Verification with Custom Focus
```bash
/workflow:verify --focus=technical    # Emphasize technical analysis
/workflow:verify --focus=strategic    # Emphasize strategic analysis
```

### Integration Points
- **After Planning**: Use after `/workflow:plan` to validate created plans
- **Before Execution**: Use before `/workflow:execute` to ensure quality
- **Plan Iteration**: Use during iterative planning refinement
- **Quality Assurance**: Use as standard practice for complex workflows

### Key Benefits
- **Early Issue Detection**: Catch problems before implementation starts
- **Dual Perspective**: Both strategic and technical validation
- **Quality Assurance**: Systematic plan evaluation and improvement
- **Risk Mitigation**: Identify potential issues and dependencies
- **User Control**: All changes require explicit approval
- **Non-Destructive**: Original plans preserved with full rollback capability

## Quality Standards

### Analysis Excellence
- **Comprehensive Context**: Both tools receive complete workflow context
- **Independent Analysis**: Tools analyze separately to avoid bias
- **Focused Evaluation**: Each tool evaluates its domain expertise
- **Objective Assessment**: Clear criteria and measurable recommendations

### User Experience Excellence
- **Clear Presentation**: Results displayed in actionable format
- **Informed Decisions**: Impact assessment for all suggested changes
- **Selective Control**: Granular approval of individual modifications
- **Safe Operations**: Full backup and rollback capability
- **Transparent Process**: Complete audit trail of all changes