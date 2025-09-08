# Workflow Complexity Rules

## Overview

This document defines unified complexity classification rules across all workflow components, ensuring consistent thresholds and scaling behavior throughout the system.

## Complexity Classification

### Unified Thresholds
**Based on task count for consistent classification across all system components**

| Complexity | Task Count | Max Hierarchy Depth | File Structure Level |
|------------|------------|-------------------|-------------------|
| **Simple** | <5 tasks | 1 level (impl-N) | Level 0 - Minimal |
| **Medium** | 5-15 tasks | 2 levels (impl-N.M) | Level 1 - Enhanced |
| **Complex** | >15 tasks | 3 levels (impl-N.M.P) | Level 2 - Complete |

## Simple Workflows

### Characteristics
- **Direct implementation tasks** with clear, limited scope
- **Single-file or small-module changes**
- **Clear requirements** without complex dependencies
- **Atomic functionality** that can be implemented in one session

### System Behavior
- **File Structure**: Minimal directory structure (Level 0)
- **Task Hierarchy**: Single level only (impl-1, impl-2, etc.)
- **Documentation**: Basic IMPL_PLAN.md, no TODO_LIST.md
- **Agent Coordination**: Direct execution without complex orchestration

### Examples
- Bug fixes in existing functionality
- Small feature additions to existing modules  
- Documentation updates
- Configuration changes
- Simple utility functions

## Medium Workflows

### Characteristics  
- **Feature implementation** requiring task breakdown
- **Multiple file modifications** across related modules
- **Some integration requirements** with existing systems
- **Clear feature boundaries** with moderate complexity

### System Behavior
- **File Structure**: Enhanced directory structure (Level 1)
- **Task Hierarchy**: Two levels (impl-N.M format)
- **Documentation**: IMPL_PLAN.md + auto-triggered TODO_LIST.md
- **Agent Coordination**: Context-driven coordination with shared state

### Auto-trigger Conditions
TODO_LIST.md and enhanced structure triggered when:
- Task count > 5 OR
- Modules affected > 3 OR  
- Estimated effort > 4h OR
- Complex inter-module dependencies exist

### Examples
- New feature implementation within existing architecture
- API endpoint creation with frontend integration
- Database schema changes with application updates
- Authentication/authorization enhancements
- Performance optimization across multiple components

## Complex Workflows

### Characteristics
- **System-wide changes** requiring detailed decomposition
- **Architectural modifications** affecting multiple systems
- **Cross-team coordination** or external dependencies
- **High-risk changes** requiring extensive testing and review

### System Behavior
- **File Structure**: Complete directory structure (Level 2)
- **Task Hierarchy**: Three levels maximum (impl-N.M.P format)
- **Documentation**: Comprehensive planning + progress tracking + summaries
- **Agent Coordination**: Multi-agent orchestration with deep context analysis

### Examples
- New major feature development
- System architecture refactoring
- Third-party service integrations
- Security implementations (OAuth, encryption)
- Database migrations with application changes
- Multi-service deployments

## Complexity Assessment Rules

### Automatic Classification
**System evaluates tasks during creation and applies appropriate complexity level**

```pseudo
function classify_complexity(tasks, scope, dependencies):
    task_count = count(tasks)
    
    if task_count < 5 and scope.is_simple() and not dependencies.complex():
        return SIMPLE
    elif task_count <= 15 and scope.is_moderate():
        return MEDIUM
    else:
        return COMPLEX
```

### Upgrade Triggers
**Complexity can be upgraded during workflow execution**

- **Simple → Medium**: When subtasks are created or scope expands
- **Medium → Complex**: When task count exceeds 15 or deep hierarchy needed
- **No Downgrades**: Complexity level never decreases to prevent data loss

### Override Rules
**Manual complexity override allowed for edge cases**

- User can specify higher complexity at workflow creation
- System warnings issued for mismatched complexity/scope
- Cannot specify lower complexity than system assessment

## Component Integration

### File Structure Mapping
**Complexity directly determines file structure level**

| Complexity | Directory Structure | Required Files |
|------------|-------------------|---------------|
| Simple | Minimal (.task/, .summaries/) | workflow-session.json, IMPL_PLAN.md |
| Medium | Enhanced (+ TODO_LIST.md) | + Auto-generated progress tracking |
| Complex | Complete (+ comprehensive docs) | + Full documentation suite |

### Agent Orchestration Mapping
**Complexity determines agent coordination patterns**

| Complexity | Gemini Analysis | Agent Coordination | Review Process |
|------------|----------------|-------------------|---------------|
| Simple | Focused file-level | Direct context-aware execution | Quick validation |
| Medium | Comprehensive multi-file | Context-driven coordination | Thorough single-pass |
| Complex | Deep system-wide | Multi-agent orchestration | Multiple review iterations |

### Task Hierarchy Mapping
**Complexity enforces hierarchy depth limits**

- **Simple**: Single level (impl-N)
- **Medium**: Two levels (impl-N.M) 
- **Complex**: Three levels maximum (impl-N.M.P)

## Decision Tree

### Workflow Creation
```
Start: Analyze user requirements
│
├─ Task count < 5 AND single module AND clear scope?
│  └─ YES → SIMPLE workflow
│
├─ Task count ≤ 15 AND moderate scope AND some integration?
│  └─ YES → MEDIUM workflow  
│
└─ Task count > 15 OR system-wide OR high-risk?
   └─ YES → COMPLEX workflow
```

### Complexity Upgrade Assessment
```
During Execution: Monitor task growth
│
├─ Simple workflow + subtasks created?
│  └─ Upgrade to MEDIUM
│
├─ Medium workflow + task count > 15?
│  └─ Upgrade to COMPLEX
│
└─ Any workflow + architectural changes?
   └─ Consider upgrade to COMPLEX
```

## Quality Assurance

### Validation Rules
- Complexity level must match actual task count
- File structure must align with complexity level
- Agent coordination patterns must match complexity
- Documentation completeness must match complexity requirements

### Performance Monitoring
- Track completion times by complexity level
- Monitor accuracy of initial complexity assessments
- Adjust thresholds based on historical data
- Measure overhead costs of each complexity level

### Consistency Checks
- All system components use same complexity thresholds
- Cross-references between complexity-dependent files are valid
- Upgrade paths preserve existing work and structure
- No orphaned files after complexity changes

---

**System ensures**: Unified complexity classification across all workflow components with consistent scaling behavior and automatic optimization for task scope and system performance