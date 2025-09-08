# Agent Orchestration Patterns

## Core Agent Coordination Features

- **Gemini Context Analysis**: MANDATORY context gathering before any agent execution
- **Context-Driven Coordination**: Agents work with comprehensive codebase understanding
- **Dynamic Agent Selection**: Choose agents based on discovered context and patterns
- **Continuous Context Updates**: Refine understanding throughout agent execution  
- **Cross-Agent Context Sharing**: Maintain shared context state across all agents
- **Pattern-Aware Execution**: Leverage discovered patterns for optimal implementation
- **Quality Gates**: Each Agent validates input and ensures output standards
- **Error Recovery**: Graceful handling of Agent coordination failures

## Workflow Implementation Patterns

### Simple Workflow Pattern
```pseudocode
Flow: Gemini Context Analysis → TodoWrite Creation → Context-Aware Implementation → Review

1. MANDATORY Gemini Context Analysis:
   - Analyze target files and immediate dependencies
   - Discover existing patterns and conventions
   - Identify utilities and libraries to use
   - Generate context package for agents

2. TodoWrite Creation (Context-informed):
   - "Execute Gemini context analysis"
   - "Implement solution following discovered patterns"
   - "Review against codebase standards" 
   - "Complete task with context validation"

3. Context-Aware Implementation:
   Task(code-developer): Implementation with Gemini context package
   Input: CONTEXT_PACKAGE, PATTERNS_DISCOVERED, CONVENTIONS_IDENTIFIED
   Output: SUMMARY, FILES_MODIFIED, TESTS, VERIFICATION
   
4. Context-Aware Review:
   Task(code-review-agent): Review with codebase standards context
   Input: CONTEXT_PACKAGE, IMPLEMENTATION_RESULTS
   Output: STATUS, SCORE, ISSUES, RECOMMENDATIONS

Resume Support: Load todos + full context state from checkpoint
```

### Medium Workflow Pattern
```pseudocode
Flow: Comprehensive Gemini Analysis → TodoWrite → Multi-Context Implementation → Review

1. MANDATORY Comprehensive Gemini Context Analysis:
   - Analyze feature area and related components
   - Discover cross-file patterns and architectural decisions
   - Identify integration points and dependencies
   - Generate comprehensive context packages for multiple agents

2. TodoWrite Creation (Context-driven, 5-7 todos):
   - "Execute comprehensive Gemini context analysis"
   - "Coordinate multi-agent implementation with shared context"
   - "Implement following discovered architectural patterns"
   - "Validate against existing system patterns", "Review", "Complete"

3. Multi-Context Implementation:
   Task(code-developer): Implementation with comprehensive context
   Input: CONTEXT_PACKAGES, ARCHITECTURAL_PATTERNS, INTEGRATION_POINTS
   Update context as new patterns discovered
   
4. Context-Aware Review:
   Task(code-review-agent): Comprehensive review with system context
   Input: FULL_CONTEXT_STATE, IMPLEMENTATION_RESULTS, PATTERN_COMPLIANCE
   Verify against discovered architectural patterns

Resume Support: Full context state + pattern discovery restoration
```

### Complex Workflow Pattern
```pseudocode
Flow: Deep Gemini Analysis → TodoWrite → Orchestrated Multi-Agent → Review → Iterate (max 2)

1. MANDATORY Deep Gemini Context Analysis:
   - System-wide architectural understanding
   - Deep pattern analysis across entire codebase
   - Integration complexity assessment
   - Multi-agent coordination requirements discovery
   - Risk pattern identification

2. TodoWrite Creation (Context-orchestrated, 7-10 todos):
   - "Execute deep system-wide Gemini analysis"
   - "Orchestrate multi-agent coordination with shared context"
   - "Implement with continuous context refinement"
   - "Validate against system architectural patterns", "Review", "Iterate", "Complete"

3. Orchestrated Multi-Agent Implementation:
   Multiple specialized agents with shared deep context
   Input: SYSTEM_CONTEXT, ARCHITECTURAL_PATTERNS, RISK_ASSESSMENT
   Continuous Gemini context updates throughout execution
   Cross-agent context synchronization
   
4. Deep Context Review & Iteration Loop (max 2 iterations):
   Task(code-review-agent): Production-ready review with full system context
   If CRITICAL_ISSUES found: Re-analyze context and coordinate fixes
   Continue until no critical issues or max iterations reached

Context Validation: Verify deep context analysis maintained throughout
Resume Support: Full context state + iteration tracking + cross-agent coordination
```

## Workflow Characteristics by Pattern

| Pattern | Context Analysis | Agent Coordination | Iteration Strategy |
|---------|------------------|--------------------|--------------------|
| **Complex** | Deep system-wide Gemini analysis | Multi-agent orchestration with shared context | Multiple rounds with context refinement |
| **Medium** | Comprehensive multi-file analysis | Context-driven coordination | Single thorough pass with pattern validation |  
| **Simple** | Focused file-level analysis | Direct context-aware execution | Quick context validation |

## Context-Driven Task Invocation Examples

```bash
# Gemini Context Analysis (Always First)
gemini "Analyze authentication patterns in codebase - identify existing implementations, 
        conventions, utilities, and integration patterns"

# Context-Aware Research Task  
Task(subagent_type="general-purpose", 
     prompt="Research authentication patterns in codebase",
     context="[GEMINI_CONTEXT_PACKAGE]")

# Context-Informed Implementation Task
Task(subagent_type="code-developer", 
     prompt="Implement email validation function following discovered patterns",
     context="PATTERNS: [pattern_list], UTILITIES: [util_list], CONVENTIONS: [conv_list]")

# Context-Driven Review Task
Task(subagent_type="code-review-agent",
     prompt="Review authentication service against codebase standards and patterns",
     context="STANDARDS: [discovered_standards], PATTERNS: [existing_patterns]")

# Cross-Agent Context Sharing
Task(subagent_type="code-developer",
     prompt="Coordinate with previous agent results using shared context",
     context="PREVIOUS_CONTEXT: [agent_context], SHARED_STATE: [context_state]")
```

## Gemini Context Integration Points

### Pre-Agent Context Gathering
```bash
# Always execute before agent coordination
gemini "Comprehensive analysis for [task] - discover patterns, conventions, and optimal approach"
```

### During-Agent Context Updates
```bash
# Continuous context refinement
gemini "Update context understanding based on agent discoveries in [area]"
```

### Cross-Agent Context Synchronization  
```bash
# Ensure context consistency across agents
gemini "Synchronize context between [agent1] and [agent2] work on [feature]"
```