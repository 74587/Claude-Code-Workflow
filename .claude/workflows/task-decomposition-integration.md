# Task Decomposition Integration Principles

## Overview


This document defines authoritative complexity thresholds, decomposition triggers, and decision trees for workflow complexity classification.

## Standardized Complexity Thresholds

### Simple Workflows (<5 tasks)
**Criteria**: Tasks < 5 AND modules ≤ 3 AND effort ≤ 4h
**Structure**: Minimal structure with basic task tracking
**Documents**: IMPL_PLAN.md only, no TODO_LIST.md
**Task Files**: impl-*.json (single level)

### Medium Workflows (5-15 tasks)  
**Criteria**: Tasks 5-15 OR modules > 3 OR effort > 4h OR complex dependencies
**Structure**: Enhanced structure with progress tracking
**Documents**: IMPL_PLAN.md + TODO_LIST.md (auto-triggered)
**Task Files**: impl-*.*.json (up to 2 levels)

### Complex Workflows (>15 tasks)
**Criteria**: Tasks > 15 OR modules > 5 OR effort > 2 days OR multi-repository
**Structure**: Complete structure with comprehensive documentation
**Documents**: IMPL_PLAN.md + TODO_LIST.md + expanded documentation
**Task Files**: impl-*.*.*.json (up to 3 levels maximum)

## Complexity Decision Tree

### Classification Algorithm
```
START: Analyze Workflow Requirements
    ↓
Count Tasks → Is Task Count < 5?
    ↓ YES              ↓ NO
Count Modules    Count Modules → > 5?
    ↓                    ↓ YES
≤ 3 Modules?        COMPLEX
    ↓ YES              ↓ NO
Estimate Effort   Estimate Effort → > 2 days?
    ↓                    ↓ YES
≤ 4 hours?         COMPLEX
    ↓ YES              ↓ NO
SIMPLE           Check Dependencies → Multi-repo?
                       ↓ YES              ↓ NO
                    COMPLEX           MEDIUM
```

### Decision Matrix

| **Factor** | **Simple** | **Medium** | **Complex** |
|------------|------------|------------|-------------|
| Task Count | < 5 | 5-15 | > 15 |
| Module Count | ≤ 3 | 4-5 | > 5 |
| Effort Estimate | ≤ 4h | 4h-2d | > 2d |
| Dependencies | Simple | Complex | Multi-repo |
| Repository Scope | Single | Single | Multiple |

### Threshold Priority
1. **Task Count**: Primary factor (most reliable predictor)
2. **Module Count**: Secondary factor (scope indicator)
3. **Effort Estimate**: Tertiary factor (complexity indicator)
4. **Dependencies**: Override factor (can force higher complexity)

## Automatic Document Generation Rules

### Generation Matrix
| **Complexity** | **IMPL_PLAN.md** | **TODO_LIST.md** | **Task Hierarchy** | **Structure** |
|----------------|------------------|------------------|-------------------|---------------|
| Simple | Always | No | 1 level | Minimal |
| Medium | Always | Auto-trigger | 2 levels | Enhanced |
| Complex | Always | Always | 3 levels | Complete |

### Auto-trigger Conditions
**TODO_LIST.md Generation** (Medium workflows):
- Tasks ≥ 5 OR modules > 3 OR effort > 4h OR dependencies complex

**Enhanced Structure** (Medium workflows):
- Progress tracking with hierarchical task breakdown
- Cross-references between planning and implementation
- Summary generation for major tasks

**Complete Structure** (Complex workflows):
- Comprehensive documentation suite
- Multi-level task decomposition
- Full progress monitoring and audit trail

## Task System Integration

### Hierarchical Task Schema
**Maximum Depth**: 3 levels (impl-N.M.P)
**Task File Structure**: Complexity determines maximum hierarchy depth

### Progress Calculation Rules
**Simple**: Linear progress through main tasks
**Medium**: Weighted progress with subtask consideration  
**Complex**: Hierarchical progress with multi-level rollup

## Implementation Integration Rules

### Decomposition Triggers
**Automatic Decomposition Required When**:
- Task count exceeds complexity threshold (5+ for medium, 15+ for complex)
- Cross-module changes affect >3 modules
- Architecture pattern changes required
- Multi-repository impacts detected
- Complex interdependencies identified

### Direct Execution Conditions
**Skip Decomposition For**:
- Single module updates with clear boundaries
- Simple documentation changes  
- Isolated bug fixes affecting <3 files
- Clear, well-defined maintenance tasks



## Validation Rules

### Complexity Classification Validation
1. **Threshold Verification**: Ensure task count, module count, and effort estimates align
2. **Override Checks**: Verify dependency complexity doesn't require higher classification  
3. **Consistency Validation**: Confirm file structure matches complexity level
4. **Progress Calculation**: Validate progress tracking matches hierarchy depth

### Quality Assurance
- Decomposition depth must not exceed 3 levels (impl-N.M.P maximum)
- Task hierarchy must be consistent across JSON files and TODO_LIST.md
- Complexity classification must align with document generation rules
- Auto-trigger conditions must be properly evaluated and documented

---

**System ensures**: Consistent complexity classification with appropriate decomposition and structure scaling