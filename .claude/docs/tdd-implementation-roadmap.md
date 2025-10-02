# TDD Workflow Implementation Roadmap

## Overview
This roadmap outlines the implementation steps for the TDD workflow system, organized by priority and dependencies.

## Phase 1: Core TDD Task Generation (Foundation)

### Priority: HIGH
### Dependencies: None
### Estimated Effort: Medium

#### 1.1 Create task-generate-tdd Command
**File**: `.claude/commands/workflow/tools/task-generate-tdd.md`

**Implementation Steps**:
1. Copy structure from `task-generate.md`
2. Add TDD-specific Gemini prompt for task breakdown
3. Implement Red-Green-Refactor task chain generation logic
4. Add `meta.tdd_phase` field to task JSONs
5. Implement dependency enforcement (TEST → IMPL → REFACTOR)
6. Generate TDD_PLAN.md alongside IMPL_PLAN.md

**Key Features**:
- Gemini-based TDD task analysis
- Automatic chain creation for each feature
- Validation of TDD structure
- Support for both manual and agent modes

**Testing**:
- Test with single feature
- Test with multiple features
- Verify dependency chains
- Validate JSON schema compliance

---

## Phase 2: TDD Planning Orchestrator

### Priority: HIGH
### Dependencies: Phase 1
### Estimated Effort: Medium

#### 2.1 Create tdd-plan Command
**File**: `.claude/commands/workflow/tdd-plan.md`

**Implementation Steps**:
1. Copy orchestrator pattern from `plan.md`
2. Modify Phase 4 to call `task-generate-tdd` instead of `task-generate`
3. Add Phase 5 for TDD structure validation
4. Update structured input format to include TEST_FOCUS
5. Customize TodoWrite pattern for TDD phases
6. Design TDD-specific output summary

**Key Features**:
- 5-phase orchestration (adds validation phase)
- Reuses existing session:start, context-gather, concept-enhanced
- TDD-specific task generation in Phase 4
- Structure validation in Phase 5
- Clear TDD chain summary in output

**Testing**:
- End-to-end TDD workflow creation
- Verify all phases execute correctly
- Validate generated task structure
- Test with different input formats

---

## Phase 3: TDD Coverage Analysis Tool

### Priority: MEDIUM
### Dependencies: Phase 1
### Estimated Effort: Small

#### 3.1 Create tdd-coverage-analysis Command
**File**: `.claude/commands/workflow/tools/tdd-coverage-analysis.md`

**Implementation Steps**:
1. Create command specification
2. Implement test task extraction logic
3. Add test execution wrapper
4. Implement coverage data parsing
5. Add TDD cycle verification logic
6. Generate analysis report

**Key Features**:
- Extract test files from TEST tasks
- Run test suite with coverage
- Verify Red-Green-Refactor cycle
- Generate coverage metrics
- Identify gaps in TDD process

**Testing**:
- Test with completed TDD workflow
- Verify coverage data accuracy
- Test cycle verification logic
- Validate report generation

---

## Phase 4: TDD Verification Orchestrator

### Priority: MEDIUM
### Dependencies: Phase 1, Phase 3
### Estimated Effort: Medium

#### 4.1 Create tdd-verify Command
**File**: `.claude/commands/workflow/tdd-verify.md`

**Implementation Steps**:
1. Create 4-phase orchestrator structure
2. Implement session discovery logic
3. Add task chain validation
4. Integrate tdd-coverage-analysis
5. Add Gemini compliance report generation
6. Design verification output summary

**Key Features**:
- Automatic session detection
- Task chain structure validation
- Test execution analysis
- Compliance scoring
- Detailed quality recommendations
- Clear verification summary

**Testing**:
- Test with complete TDD workflow
- Test with incomplete workflow
- Verify compliance scoring
- Test report generation

---

## Phase 5: TDD Templates and Documentation

### Priority: MEDIUM
### Dependencies: Phases 1-4
### Estimated Effort: Small

#### 5.1 Create TDD Prompt Templates
**Files**:
- `.claude/workflows/cli-templates/prompts/development/tdd-test.txt`
- `.claude/workflows/cli-templates/prompts/development/tdd-impl.txt`
- `.claude/workflows/cli-templates/prompts/development/tdd-refactor.txt`

**Implementation Steps**:
1. Design test-writing template (Red phase)
2. Design implementation template (Green phase)
3. Design refactoring template (Refactor phase)
4. Include TDD best practices
5. Add specific acceptance criteria

**Key Features**:
- Phase-specific guidance
- TDD best practices embedded
- Clear acceptance criteria
- Agent-friendly format

#### 5.2 Update Core Documentation
**Files to Update**:
- `.claude/workflows/workflow-architecture.md`
- `.claude/workflows/task-core.md`
- `README.md`

**Updates Required**:
1. Add TDD workflow section to architecture
2. Document `meta.tdd_phase` field in task-core
3. Add TDD usage examples to README
4. Create TDD workflow diagram
5. Add troubleshooting guide

---

## Phase 6: Integration and Polish

### Priority: LOW
### Dependencies: Phases 1-5
### Estimated Effort: Small

#### 6.1 Command Registry Updates
**Files**:
- `.claude/commands.json` (if exists)
- Slash command documentation

**Updates**:
1. Register new commands
2. Update command help text
3. Add command shortcuts
4. Update command examples

#### 6.2 Testing and Validation
**Activities**:
1. End-to-end integration testing
2. Performance testing
3. Error handling validation
4. Documentation review
5. User acceptance testing

---

## Implementation Priority Matrix

```
Priority | Phase | Component                    | Effort | Dependencies
---------|-------|------------------------------|--------|-------------
HIGH     | 1     | task-generate-tdd            | Medium | None
HIGH     | 2     | tdd-plan                     | Medium | Phase 1
MEDIUM   | 3     | tdd-coverage-analysis        | Small  | Phase 1
MEDIUM   | 4     | tdd-verify                   | Medium | Phase 1, 3
MEDIUM   | 5     | Templates & Documentation    | Small  | Phase 1-4
LOW      | 6     | Integration & Polish         | Small  | Phase 1-5
```

---

## Detailed Component Specifications

### Component 1: task-generate-tdd

**Inputs**:
- `--session <sessionId>`: Required session identifier
- `--agent`: Optional flag for agent mode
- ANALYSIS_RESULTS.md from session

**Outputs**:
- `TDD_PLAN.md`: TDD-specific implementation plan
- `IMPL_PLAN.md`: Standard implementation plan
- `TODO_LIST.md`: Task list with TDD phases
- `.task/TEST-*.json`: Test task files
- `.task/IMPL-*.json`: Implementation task files
- `.task/REFACTOR-*.json`: Refactoring task files

**Core Logic**:
```
1. Load ANALYSIS_RESULTS.md
2. Call Gemini to identify features and create TDD breakdown
3. For each feature:
   a. Create TEST task (Red phase)
   b. Create IMPL task with depends_on TEST (Green phase)
   c. Create REFACTOR task with depends_on IMPL (Refactor phase)
4. Validate chain structure
5. Generate TDD_PLAN.md
6. Generate IMPL_PLAN.md
7. Generate TODO_LIST.md
8. Return task count and chain summary
```

**Gemini Prompt Structure**:
```
PURPOSE: Generate TDD task breakdown with Red-Green-Refactor chains
TASK: Analyze ANALYSIS_RESULTS.md and create TDD-structured task breakdown
CONTEXT: @{.workflow/[sessionId]/ANALYSIS_RESULTS.md}
EXPECTED:
- Feature list with testable requirements
- Test cases for each feature (Red phase)
- Implementation requirements (Green phase)
- Refactoring opportunities (Refactor phase)
- Task dependencies and execution order
RULES: Each feature must have TEST → IMPL → REFACTOR chain. Output structured markdown.
```

**Validation Rules**:
- Each TEST task must have ID format `TEST-N.M`
- Each IMPL task must have `depends_on: ["TEST-N.M"]`
- Each REFACTOR task must have `depends_on: ["IMPL-N.M"]`
- All tasks must have `meta.tdd_phase` field
- Agent must be appropriate for phase

---

### Component 2: tdd-plan

**Inputs**:
- `<input>`: Feature description, file path, or issue ID
- `--agent`: Optional flag for agent mode

**Outputs**:
- Session summary with TDD chain information
- All standard workflow outputs
- TDD_PLAN.md

**Phase Breakdown**:

**Phase 1: Session Discovery** (Reused)
- Command: `/workflow:session:start --auto "TDD: ..."`
- Extract: sessionId

**Phase 2: Context Gathering** (Reused)
- Command: `/workflow:tools:context-gather --session sessionId ...`
- Extract: contextPath

**Phase 3: TDD Analysis** (Reused)
- Command: `/workflow:tools:concept-enhanced --session sessionId --context contextPath`
- Extract: ANALYSIS_RESULTS.md

**Phase 4: TDD Task Generation** (New)
- Command: `/workflow:tools:task-generate-tdd --session sessionId [--agent]`
- Extract: Task count, chain count

**Phase 5: Structure Validation** (New)
- Internal validation
- Verify chain completeness
- Verify dependencies
- Extract: Validation status

**TodoWrite Pattern**:
```javascript
// Initialize
[
  {content: "Execute session discovery", status: "in_progress", activeForm: "Executing session discovery"},
  {content: "Execute context gathering", status: "pending", activeForm: "Executing context gathering"},
  {content: "Execute TDD analysis", status: "pending", activeForm: "Executing TDD analysis"},
  {content: "Execute TDD task generation", status: "pending", activeForm: "Executing TDD task generation"},
  {content: "Validate TDD structure", status: "pending", activeForm: "Validating TDD structure"}
]

// After each phase, update one to "completed", next to "in_progress"
```

**Output Template**:
```
TDD Planning complete for session: {sessionId}

Features analyzed: {count}
TDD chains generated: {count}
Total tasks: {count}

Structure:
- {Feature 1}: TEST-1.1 → IMPL-1.1 → REFACTOR-1.1
- {Feature 2}: TEST-2.1 → IMPL-2.1 → REFACTOR-2.1

Plans:
- Implementation: .workflow/{sessionId}/IMPL_PLAN.md
- TDD Structure: .workflow/{sessionId}/TDD_PLAN.md

Next: /workflow:execute or /workflow:tdd-verify
```

---

### Component 3: tdd-coverage-analysis

**Inputs**:
- `--session <sessionId>`: Required session identifier

**Outputs**:
- `.process/test-results.json`: Test execution results
- `.process/coverage-report.json`: Coverage metrics
- `.process/tdd-cycle-report.md`: TDD cycle verification

**Core Logic**:
```
1. Extract all TEST tasks from session
2. Identify test files from focus_paths
3. Run test suite with coverage
4. Parse coverage data
5. For each TDD chain:
   a. Verify TEST task created tests
   b. Verify IMPL task made tests pass
   c. Verify REFACTOR task maintained green tests
6. Generate cycle verification report
7. Return coverage metrics and cycle status
```

**Test Execution**:
```bash
npm test -- --coverage --json > .process/test-results.json
# or
pytest --cov --json-report > .process/test-results.json
```

**Cycle Verification Algorithm**:
```
For each chain (TEST-N.M, IMPL-N.M, REFACTOR-N.M):
  1. Read TEST-N.M-summary.md
     - Check: Tests were created
     - Check: Tests failed initially

  2. Read IMPL-N.M-summary.md
     - Check: Implementation was completed
     - Check: Tests now pass

  3. Read REFACTOR-N.M-summary.md
     - Check: Refactoring was completed
     - Check: Tests still pass

  If all checks pass: Chain is valid
  Else: Report missing steps
```

---

### Component 4: tdd-verify

**Inputs**:
- `[session-id]`: Optional session ID (auto-detect if not provided)

**Outputs**:
- Verification summary
- TDD_COMPLIANCE_REPORT.md

**Phase Breakdown**:

**Phase 1: Session Discovery**
```bash
# If session-id provided
sessionId = argument

# Else auto-detect
sessionId = $(find .workflow/ -name '.active-*' | head -1 | sed 's/.*active-//')
```

**Phase 2: Task Chain Validation**
```bash
# Load all task JSONs
tasks=$(find .workflow/${sessionId}/.task/ -name '*.json')

# For each TDD chain
for feature in features:
  verify_chain_exists(TEST-N.M, IMPL-N.M, REFACTOR-N.M)
  verify_dependencies(IMPL depends_on TEST, REFACTOR depends_on IMPL)
  verify_meta_fields(tdd_phase, agent)
```

**Phase 3: Test Execution Analysis**
```bash
/workflow:tools:tdd-coverage-analysis --session ${sessionId}
```

**Phase 4: Compliance Report**
```bash
cd project-root && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Generate TDD compliance report
TASK: Analyze TDD workflow execution and generate quality report
CONTEXT: @{.workflow/${sessionId}/.task/*.json,.workflow/${sessionId}/.summaries/*}
EXPECTED:
- TDD compliance score
- Chain completeness verification
- Test coverage analysis
- Quality recommendations
- Red-Green-Refactor cycle validation
RULES: Focus on TDD best practices and workflow adherence
" > .workflow/${sessionId}/TDD_COMPLIANCE_REPORT.md
```

**Output Template**:
```
TDD Verification Report - Session: {sessionId}

## Chain Validation
{status} Feature 1: TEST-1.1 → IMPL-1.1 → REFACTOR-1.1 ({status})
{status} Feature 2: TEST-2.1 → IMPL-2.1 → REFACTOR-2.1 ({status})

## Test Execution
{status} All TEST tasks produced failing tests
{status} All IMPL tasks made tests pass
{status} All REFACTOR tasks maintained green tests

## Compliance Score: {score}/100

Detailed report: .workflow/{sessionId}/TDD_COMPLIANCE_REPORT.md

Recommendations:
{recommendations}
```

---

## File Structure Reference

```
.workflow/
└── WFS-{session-id}/
    ├── ANALYSIS_RESULTS.md          # From concept-enhanced
    ├── IMPL_PLAN.md                 # Standard plan
    ├── TDD_PLAN.md                  # TDD-specific plan ⭐ NEW
    ├── TODO_LIST.md                 # With TDD phase markers
    ├── TDD_COMPLIANCE_REPORT.md     # From tdd-verify ⭐ NEW
    │
    ├── .task/
    │   ├── TEST-1.1.json            # Red phase ⭐ NEW
    │   ├── IMPL-1.1.json            # Green phase (enhanced)
    │   ├── REFACTOR-1.1.json        # Refactor phase ⭐ NEW
    │   └── ...
    │
    ├── .summaries/
    │   ├── TEST-1.1-summary.md      # Test task summary
    │   ├── IMPL-1.1-summary.md      # Implementation summary
    │   ├── REFACTOR-1.1-summary.md  # Refactor summary
    │   └── ...
    │
    └── .process/
        ├── TDD_TASK_BREAKDOWN.md    # Gemini breakdown ⭐ NEW
        ├── test-results.json         # Test execution ⭐ NEW
        ├── coverage-report.json      # Coverage data ⭐ NEW
        └── tdd-cycle-report.md       # Cycle verification ⭐ NEW
```

---

## Implementation Order

### Week 1: Foundation
1. Create `task-generate-tdd.md` specification
2. Implement Gemini TDD breakdown logic
3. Implement task JSON generation with TDD chains
4. Test with simple single-feature workflow

### Week 2: Orchestration
1. Create `tdd-plan.md` specification
2. Implement 5-phase orchestrator
3. Integrate with task-generate-tdd
4. End-to-end testing

### Week 3: Verification
1. Create `tdd-coverage-analysis.md` specification
2. Implement test execution and cycle verification
3. Create `tdd-verify.md` specification
4. Implement verification orchestrator
5. Integration testing

### Week 4: Polish
1. Create TDD prompt templates
2. Update documentation
3. Create usage examples
4. Final integration testing
5. User acceptance testing

---

## Success Criteria

### Functional Requirements
- [ ] TDD workflows can be created from feature descriptions
- [ ] Task chains enforce Red-Green-Refactor order
- [ ] Dependencies prevent out-of-order execution
- [ ] Verification detects non-compliance
- [ ] Coverage analysis integrates with test tools
- [ ] Reports provide actionable insights

### Quality Requirements
- [ ] Commands follow existing architectural patterns
- [ ] Error handling is robust
- [ ] Documentation is complete
- [ ] Examples demonstrate common use cases
- [ ] Integration with existing workflow is seamless

### Performance Requirements
- [ ] TDD planning completes within 2 minutes
- [ ] Verification completes within 1 minute
- [ ] Gemini analysis stays within token limits
- [ ] Test execution doesn't timeout

---

## Risk Mitigation

### Risk 1: Test Framework Integration
**Mitigation**: Support multiple test frameworks (npm test, pytest, etc.) with configurable commands

### Risk 2: Gemini Token Limits
**Mitigation**: Use focused context in prompts, paginate large analysis

### Risk 3: Complex Dependencies
**Mitigation**: Thorough validation logic, clear error messages

### Risk 4: User Adoption
**Mitigation**: Clear documentation, simple examples, gradual rollout

---

## Next Steps

1. **Review Design**: Get feedback on architecture and specifications
2. **Create Prototype**: Implement Phase 1 (task-generate-tdd) as proof of concept
3. **Test Prototype**: Validate with real-world TDD workflow
4. **Iterate**: Refine based on testing feedback
5. **Full Implementation**: Complete remaining phases
6. **Documentation**: Create user guides and examples
7. **Release**: Roll out to users with migration guide
