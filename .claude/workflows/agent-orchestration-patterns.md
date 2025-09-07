# Agent Orchestration Patterns

## Core Agent Coordination Features

- **Context Preservation**: Maintain original task context throughout Agent chain
- **Quality Gates**: Each Agent validates input and ensures output standards
- **Adaptive Complexity**: Workflow depth matches task complexity requirements
- **Iterative Improvement**: Complex workflows include multiple review-fix cycles
- **Structured Output**: Standardized Agent output formats ensure reliable coordination
- **Error Recovery**: Graceful handling of Agent coordination failures

## Workflow Implementation Patterns

### Simple Workflow Pattern
```pseudocode
Flow: TodoWrite Creation → Context → Implementation → Review

1. MANDATORY TodoWrite Creation:
   - "Gather context for implementation"
   - "Implement solution"
   - "Review and validate code" 
   - "Complete task"

2. Implementation Checkpoint:
   Task(code-developer): Direct implementation
   Output: SUMMARY, FILES_MODIFIED, TESTS, VERIFICATION
   
3. Review Checkpoint:
   Task(code-review-agent): Quick quality review
   Output: STATUS, SCORE, ISSUES, RECOMMENDATIONS

Resume Support: Load todos + context from checkpoint
```

### Medium Workflow Pattern
```pseudocode
Flow: TodoWrite → Planning → Implementation → Review

1. MANDATORY TodoWrite Creation (5-7 todos):
   - "Create implementation plan"
   - "Gather context", "Implement with tests"
   - "Validate", "Review", "Complete"

2. Planning Checkpoint:
   Task(planning-agent): Create plan
   Trigger decomposition if >3 modules or >5 subtasks
   Output: PLAN_SUMMARY, STEPS, SUCCESS_CRITERIA
   
3. Implementation Checkpoint:
   Task(code-developer): Follow plan
   Update TODO_CHECKLIST.md if decomposition exists
   
4. Review Checkpoint:
   Task(code-review-agent): Comprehensive review
   Verify against plan and decomposition

Resume Support: Full state restoration at each checkpoint
```

### Complex Workflow Pattern
```pseudocode
Flow: TodoWrite → Planning → Implementation → Review → Iterate (max 2)

1. MANDATORY TodoWrite Creation (7-10 todos):
   - "Create detailed plan", "Generate decomposition docs"
   - "Gather context", "Implement with testing"
   - "Validate criteria", "Review", "Iterate", "Complete"

2. Planning Checkpoint:
   Task(planning-agent): MANDATORY task decomposition
   Generate: IMPL_PLAN.md (enhanced structure), TODO_LIST.md
   Include risk assessment and quality gates
   
3. Implementation Checkpoint:
   Task(code-developer): Follow hierarchical breakdown
   Update TODO_CHECKLIST.md for each subtask completion
   
4. Review & Iteration Loop (max 2 iterations):
   Task(code-review-agent): Production-ready review
   If CRITICAL_ISSUES found: Task(code-developer) fixes issues
   Continue until no critical issues or max iterations reached

Document Validation: Verify decomposition docs generated
Resume Support: Full state + iteration tracking
```

## Workflow Characteristics by Pattern

| Pattern | Agent Chain | Quality Focus | Iteration Strategy |
|---------|-------------|---------------|--------------------|
| **Complex** | Full 3-stage + iterations | Production-ready quality | Multiple rounds until perfect |
| **Medium** | Full 3-stage single-pass | Comprehensive quality | Single thorough review |  
| **Simple** | 2-stage direct | Basic quality | Quick validation |

## Task Invocation Examples

```bash
# Research Task
Task(subagent_type="general-purpose", 
     prompt="Research authentication patterns in codebase")

# Planning Task  
Task(subagent_type="planning-agent",
     prompt="Plan OAuth2 implementation across API, middleware, and UI")

# Implementation Task
Task(subagent_type="code-developer", 
     prompt="Implement email validation function with tests")

# Review Task
Task(subagent_type="code-review-agent",
     prompt="Review recently implemented authentication service")
```