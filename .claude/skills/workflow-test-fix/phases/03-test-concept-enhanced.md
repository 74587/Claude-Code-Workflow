# Phase 3: Test Concept Enhanced (test-concept-enhanced)

Analyze test requirements with Gemini using progressive L0-L3 test layers.

## Objective

- Use Gemini to analyze coverage gaps
- Detect project type and apply appropriate test templates
- Generate multi-layered test requirements (L0-L3)
- Scan for AI code issues

## Execution

### Step 1.3: Test Generation Analysis

```
Skill(skill="workflow:tools:test-concept-enhanced", args="--session [testSessionId] --context [contextPath]")
```

**Input**:
- `testSessionId` from Phase 1
- `contextPath` from Phase 2

**Expected Behavior**:
- Use Gemini to analyze coverage gaps
- Detect project type and apply appropriate test templates
- Generate **multi-layered test requirements** (L0-L3)
- Scan for AI code issues
- Generate `TEST_ANALYSIS_RESULTS.md`

**Output**: `.workflow/[testSessionId]/.process/TEST_ANALYSIS_RESULTS.md`

**Validation** - TEST_ANALYSIS_RESULTS.md must include:
- Project Type Detection (with confidence)
- Coverage Assessment (current vs target)
- Test Framework & Conventions
- Multi-Layered Test Plan (L0-L3)
- AI Issue Scan Results
- Test Requirements by File (with layer annotations)
- Quality Assurance Criteria
- Success Criteria

**Note**: Detailed specifications for project types, L0-L3 layers, and AI issue detection are defined in `/workflow:tools:test-concept-enhanced`.

## Output

- **File**: `.workflow/[testSessionId]/.process/TEST_ANALYSIS_RESULTS.md`

## Next Phase

Continue to [Phase 4: Test Task Generate](04-test-task-generate.md).
