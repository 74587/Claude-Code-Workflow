---
name: test-gen
description: Generate comprehensive test workflow based on completed implementation tasks
usage: /workflow:test-gen [session-id]
argument-hint: "WFS-session-id"
examples:
  - /workflow:test-gen
  - /workflow:test-gen WFS-user-auth
---

# Workflow Test Generation Command

## Overview
Automatically generates comprehensive test workflows based on completed implementation tasks. **Creates dedicated test session with full test coverage planning**, including unit tests, integration tests, and validation workflows that mirror the implementation structure.

## Core Rules
**Analyze completed implementation workflows to generate comprehensive test coverage workflows.**
**Create dedicated test session with systematic test task decomposition following implementation patterns.**

## Core Responsibilities
- **Implementation Analysis**: Analyze completed tasks and their deliverables
- **Test Coverage Planning**: Generate comprehensive test strategies for all implementations
- **Test Workflow Creation**: Create structured test session following workflow architecture
- **Task Decomposition**: Break down test requirements into executable test tasks
- **Dependency Mapping**: Establish test dependencies based on implementation relationships
- **Agent Assignment**: Assign appropriate test agents for different test types

## Execution Philosophy
- **Coverage-driven**: Ensure all implemented features have corresponding tests
- **Implementation-aware**: Tests reflect actual implementation patterns and dependencies
- **Systematic approach**: Follow established workflow patterns for test planning
- **Agent-optimized**: Assign specialized agents for different test types
- **Continuous validation**: Include ongoing test execution and maintenance tasks

## Test Generation Lifecycle

### Phase 1: Implementation Discovery
1. **Session Analysis**: Identify active or recently completed implementation session
2. **Task Analysis**: Parse completed IMPL-* tasks and their deliverables
3. **Code Analysis**: Examine implemented files and functionality
4. **Pattern Recognition**: Identify testing requirements from implementation patterns

### Phase 2: Test Strategy Planning
1. **Coverage Mapping**: Map implementation components to test requirements
2. **Test Type Classification**: Categorize tests (unit, integration, e2e, performance)
3. **Dependency Analysis**: Establish test execution dependencies
4. **Tool Selection**: Choose appropriate testing frameworks and tools

### Phase 3: Test Workflow Creation
1. **Session Creation**: Create dedicated test session `WFS-test-[base-session]`
2. **Plan Generation**: Create TEST_PLAN.md with comprehensive test strategy
3. **Task Decomposition**: Generate TEST-* task definitions following workflow patterns
4. **Agent Assignment**: Assign specialized test agents for execution

### Phase 4: Test Session Setup
1. **Structure Creation**: Establish test workflow directory structure
2. **Context Preparation**: Link test tasks to implementation context
3. **Flow Control Setup**: Configure test execution flow and dependencies
4. **Documentation Generation**: Create test documentation and tracking files

## Test Discovery & Analysis Process

### Implementation Analysis
```
├── Load completed implementation session
├── Analyze IMPL_PLAN.md and completed tasks
├── Scan .summaries/ for implementation deliverables
├── Examine target_files from task definitions
├── Identify implemented features and components
├── Map code coverage requirements
└── Generate test coverage matrix
```

### Test Pattern Recognition
```
Implementation Pattern → Test Pattern
├── API endpoints → API testing + contract testing
├── Database models → Data validation + migration testing
├── UI components → Component testing + user workflow testing
├── Business logic → Unit testing + integration testing
├── Authentication → Security testing + access control testing
├── Configuration → Environment testing + deployment testing
└── Performance critical → Load testing + performance testing
```

## Test Workflow Structure

### Generated Test Session Structure
```
.workflow/WFS-test-[base-session]/
├── TEST_PLAN.md                 # Comprehensive test planning document
├── TODO_LIST.md                 # Test execution progress tracking
├── .process/
│   ├── TEST_ANALYSIS.md         # Test coverage analysis results
│   └── COVERAGE_MATRIX.md       # Implementation-to-test mapping
├── .task/
│   ├── TEST-001.json           # Unit test tasks
│   ├── TEST-002.json           # Integration test tasks
│   ├── TEST-003.json           # E2E test tasks
│   └── TEST-004.json           # Performance test tasks
├── .summaries/                  # Test execution summaries
└── .context/
    ├── impl-context.md         # Implementation context reference
    └── test-fixtures.md        # Test data and fixture planning
```

## Test Task Types & Agent Assignment

### Task Categories
1. **Unit Tests** (`TEST-U-*`)
   - **Agent**: `code-review-test-agent`
   - **Scope**: Individual function/method testing
   - **Dependencies**: Implementation files

2. **Integration Tests** (`TEST-I-*`)
   - **Agent**: `code-review-test-agent`
   - **Scope**: Component interaction testing
   - **Dependencies**: Unit tests completion

3. **End-to-End Tests** (`TEST-E-*`)
   - **Agent**: `general-purpose`
   - **Scope**: User workflow and system testing
   - **Dependencies**: Integration tests completion

4. **Performance Tests** (`TEST-P-*`)
   - **Agent**: `code-developer`
   - **Scope**: Load, stress, and performance validation
   - **Dependencies**: E2E tests completion

5. **Security Tests** (`TEST-S-*`)
   - **Agent**: `code-review-test-agent`
   - **Scope**: Security validation and vulnerability testing
   - **Dependencies**: Implementation completion

6. **Documentation Tests** (`TEST-D-*`)
   - **Agent**: `doc-generator`
   - **Scope**: Documentation validation and example testing
   - **Dependencies**: Feature tests completion

## Test Task JSON Schema

Each test task follows the 5-field workflow architecture with test-specific extensions:

### Basic Test Task Structure
```json
{
  "id": "TEST-U-001",
  "title": "Unit tests for authentication service",
  "status": "pending",
  "meta": {
    "type": "unit-test",
    "agent": "code-review-test-agent",
    "test_framework": "jest",
    "coverage_target": "90%",
    "impl_reference": "IMPL-001"
  },
  "context": {
    "requirements": "Test all authentication service functions with edge cases",
    "focus_paths": ["src/auth/", "tests/unit/auth/"],
    "acceptance": [
      "All auth service functions tested",
      "Edge cases covered",
      "90% code coverage achieved",
      "Tests pass in CI/CD pipeline"
    ],
    "depends_on": [],
    "impl_context": "IMPL-001-summary.md",
    "test_data": "auth-test-fixtures.json"
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_impl_context",
        "action": "Load implementation context and deliverables",
        "command": "bash(cat .workflow/WFS-[base-session]/.summaries/IMPL-001-summary.md)",
        "output_to": "impl_context"
      },
      {
        "step": "analyze_test_coverage",
        "action": "Analyze existing test coverage and gaps",
        "command": "bash(find src/auth/ -name '*.js' -o -name '*.ts' | head -20)",
        "output_to": "coverage_analysis"
      }
    ],
    "implementation_approach": "test-driven",
    "target_files": [
      "tests/unit/auth/auth-service.test.js",
      "tests/unit/auth/auth-utils.test.js",
      "tests/fixtures/auth-test-data.json"
    ]
  }
}
```

## Test Context Management

### Implementation Context Integration
Test tasks automatically inherit context from corresponding implementation tasks:

```json
"context": {
  "impl_reference": "IMPL-001",
  "impl_summary": ".workflow/WFS-[base-session]/.summaries/IMPL-001-summary.md",
  "impl_files": ["src/auth/service.js", "src/auth/middleware.js"],
  "test_requirements": "derived from implementation acceptance criteria",
  "coverage_requirements": "90% line coverage, 80% branch coverage"
}
```

### Flow Control for Test Execution
```json
"flow_control": {
  "pre_analysis": [
    {
      "step": "load_impl_deliverables",
      "action": "Load implementation files and analyze test requirements",
      "command": "~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Analyze implementation for test requirements TASK: Review [impl_files] and identify test cases CONTEXT: @{[impl_files]} EXPECTED: Comprehensive test case list RULES: Focus on edge cases and integration points\""
    },
    {
      "step": "setup_test_environment",
      "action": "Prepare test environment and fixtures",
      "command": "codex --full-auto exec \"Setup test environment for [test_framework] with fixtures for [feature_name]\" -s danger-full-access"
    }
  ]
}
```

## Session Management & Integration

### Test Session Creation Process
1. **Base Session Discovery**: Identify implementation session to test
2. **Test Session Creation**: Create `WFS-test-[base-session]` directory structure
3. **Context Linking**: Establish references to implementation context
4. **Active Marker**: Create `.active-test-[base-session]` marker for session management

### Integration with Execute Command
Test workflows integrate seamlessly with existing execute infrastructure:
- Use same TodoWrite progress tracking
- Follow same agent orchestration patterns
- Support same flow control mechanisms
- Maintain same session isolation and management

## Usage Examples

### Generate Tests for Completed Implementation
```bash
# After completing an implementation workflow
/workflow:execute  # Complete implementation tasks

# Generate comprehensive test workflow
/workflow:test-gen  # Auto-detects active session

# Execute test workflow
/workflow:execute  # Runs test tasks
```

### Generate Tests for Specific Session
```bash
# Generate tests for specific implementation session
/workflow:test-gen WFS-user-auth-system

# Check test workflow status
/workflow:status --session=WFS-test-user-auth-system

# Execute specific test category
/task:execute TEST-U-001  # Run unit tests
```

### Multi-Phase Test Generation
```bash
# Generate and execute tests in phases
/workflow:test-gen WFS-api-implementation
/task:execute TEST-U-*     # Unit tests first
/task:execute TEST-I-*     # Integration tests
/task:execute TEST-E-*     # E2E tests last
```

## Error Handling & Recovery

### Implementation Analysis Errors
| Error | Cause | Resolution |
|-------|-------|------------|
| No completed implementations | No IMPL-* tasks found | Complete implementation tasks first |
| Missing implementation context | Corrupted summaries | Regenerate summaries from task results |
| Invalid implementation files | File references broken | Update file paths and re-analyze |

### Test Generation Errors
| Error | Cause | Recovery Strategy |
|-------|-------|------------------|
| Test framework not detected | No testing setup found | Prompt for test framework selection |
| Insufficient implementation context | Missing implementation details | Request additional implementation documentation |
| Test session collision | Test session already exists | Merge or create versioned test session |

## Key Benefits

### Comprehensive Coverage
- **Implementation-driven**: Tests generated based on actual implementation patterns
- **Multi-layered**: Unit, integration, E2E, and specialized testing
- **Dependency-aware**: Test execution follows logical dependency chains
- **Agent-optimized**: Specialized agents for different test types

### Workflow Integration
- **Seamless execution**: Uses existing workflow infrastructure
- **Progress tracking**: Full TodoWrite integration for test progress
- **Context preservation**: Maintains links to implementation context
- **Session management**: Independent test sessions with proper isolation

### Maintenance & Evolution
- **Updateable**: Test workflows can evolve with implementation changes
- **Traceable**: Clear mapping from implementation to test requirements
- **Extensible**: Support for new test types and frameworks
- **Documentable**: Comprehensive test documentation and coverage reports

## Integration Points
- **Planning**: Integrates with `/workflow:plan` for test planning
- **Execution**: Uses `/workflow:execute` for test task execution
- **Status**: Works with `/workflow:status` for test progress tracking
- **Documentation**: Coordinates with `/workflow:docs` for test documentation
- **Review**: Supports `/workflow:review` for test validation and coverage analysis