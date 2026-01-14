# Problem Taxonomy

Classification of skill execution issues with detection patterns and severity criteria.

## When to Use

| Phase | Usage | Section |
|-------|-------|---------|
| All Diagnosis Actions | Issue classification | All sections |
| action-propose-fixes | Strategy selection | Fix Mapping |
| action-generate-report | Severity assessment | Severity Criteria |

---

## Problem Categories

### 1. Context Explosion (P2)

**Definition**: Excessive token accumulation causing prompt size to grow unbounded.

**Root Causes**:
- Unbounded conversation history
- Full content passing instead of references
- Missing summarization mechanisms
- Agent returning full output instead of path+summary

**Detection Patterns**:

| Pattern ID | Regex/Check | Description |
|------------|-------------|-------------|
| CTX-001 | `/history\s*[.=].*push\|concat/` | History array growth |
| CTX-002 | `/JSON\.stringify\s*\(\s*state\s*\)/` | Full state serialization |
| CTX-003 | `/Read\([^)]+\)\s*[\+,]/` | Multiple file content concatenation |
| CTX-004 | `/return\s*\{[^}]*content:/` | Agent returning full content |
| CTX-005 | File length > 5000 chars without summarize | Long prompt without compression |

**Impact Levels**:
- **Critical**: Context exceeds model limit (128K tokens)
- **High**: Context > 50K tokens per iteration
- **Medium**: Context grows 10%+ per iteration
- **Low**: Potential for growth but currently manageable

---

### 2. Long-tail Forgetting (P3)

**Definition**: Loss of early instructions, constraints, or goals in long execution chains.

**Root Causes**:
- No explicit constraint propagation
- Reliance on implicit context
- Missing checkpoint/restore mechanisms
- State schema without requirements field

**Detection Patterns**:

| Pattern ID | Regex/Check | Description |
|------------|-------------|-------------|
| MEM-001 | Later phases missing constraint reference | Constraint not carried forward |
| MEM-002 | `/\[TASK\][^[]*(?!\[CONSTRAINTS\])/` | Task without constraints section |
| MEM-003 | Key phases without checkpoint | Missing state preservation |
| MEM-004 | State schema lacks `original_requirements` | No constraint persistence |
| MEM-005 | No verification phase | Output not checked against intent |

**Impact Levels**:
- **Critical**: Original goal completely lost
- **High**: Key constraints ignored in output
- **Medium**: Some requirements missing
- **Low**: Minor goal drift

---

### 3. Data Flow Disruption (P0)

**Definition**: Inconsistent state management causing data loss or corruption.

**Root Causes**:
- Multiple state storage locations
- Inconsistent field naming
- Missing schema validation
- Format transformation without normalization

**Detection Patterns**:

| Pattern ID | Regex/Check | Description |
|------------|-------------|-------------|
| DF-001 | Multiple state file writes | Scattered state storage |
| DF-002 | Same concept, different names | Field naming inconsistency |
| DF-003 | JSON.parse without validation | Missing schema validation |
| DF-004 | Files written but never read | Orphaned outputs |
| DF-005 | Autonomous skill without state-schema | Undefined state structure |

**Impact Levels**:
- **Critical**: Data loss or corruption
- **High**: State inconsistency between phases
- **Medium**: Potential for inconsistency
- **Low**: Minor naming inconsistencies

---

### 4. Agent Coordination Failure (P1)

**Definition**: Fragile agent call patterns causing cascading failures.

**Root Causes**:
- Missing error handling in Task calls
- No result validation
- Inconsistent agent configurations
- Deeply nested agent calls

**Detection Patterns**:

| Pattern ID | Regex/Check | Description |
|------------|-------------|-------------|
| AGT-001 | Task without try-catch | Missing error handling |
| AGT-002 | Result used without validation | No return value check |
| AGT-003 | > 3 different agent types | Agent type proliferation |
| AGT-004 | Nested Task in prompt | Agent calling agent |
| AGT-005 | Task used but not in allowed-tools | Tool declaration mismatch |
| AGT-006 | Multiple return formats | Inconsistent agent output |

**Impact Levels**:
- **Critical**: Workflow crash on agent failure
- **High**: Unpredictable agent behavior
- **Medium**: Occasional coordination issues
- **Low**: Minor inconsistencies

---

## Severity Criteria

### Global Severity Matrix

| Severity | Definition | Action Required |
|----------|------------|-----------------|
| **Critical** | Blocks execution or causes data loss | Immediate fix required |
| **High** | Significantly impacts reliability | Should fix before deployment |
| **Medium** | Affects quality or maintainability | Fix in next iteration |
| **Low** | Minor improvement opportunity | Optional fix |

### Severity Calculation

```javascript
function calculateIssueSeverity(issue) {
  const weights = {
    impact_on_execution: 40,  // Does it block workflow?
    data_integrity_risk: 30,  // Can it cause data loss?
    frequency: 20,            // How often does it occur?
    complexity_to_fix: 10     // How hard to fix?
  };

  let score = 0;

  // Impact on execution
  if (issue.blocks_execution) score += weights.impact_on_execution;
  else if (issue.degrades_execution) score += weights.impact_on_execution * 0.5;

  // Data integrity
  if (issue.causes_data_loss) score += weights.data_integrity_risk;
  else if (issue.causes_inconsistency) score += weights.data_integrity_risk * 0.5;

  // Frequency
  if (issue.occurs_every_run) score += weights.frequency;
  else if (issue.occurs_sometimes) score += weights.frequency * 0.5;

  // Complexity (inverse - easier to fix = higher priority)
  if (issue.fix_complexity === 'low') score += weights.complexity_to_fix;
  else if (issue.fix_complexity === 'medium') score += weights.complexity_to_fix * 0.5;

  // Map score to severity
  if (score >= 70) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}
```

---

## Fix Mapping

| Problem Type | Recommended Strategies | Priority Order |
|--------------|----------------------|----------------|
| Context Explosion | sliding_window, path_reference, context_summarization | 1, 2, 3 |
| Long-tail Forgetting | constraint_injection, state_constraints_field, checkpoint | 1, 2, 3 |
| Data Flow Disruption | state_centralization, schema_enforcement, field_normalization | 1, 2, 3 |
| Agent Coordination | error_wrapping, result_validation, flatten_nesting | 1, 2, 3 |

---

## Cross-Category Dependencies

Some issues may trigger others:

```
Context Explosion ──→ Long-tail Forgetting
     (Large context causes important info to be pushed out)

Data Flow Disruption ──→ Agent Coordination Failure
     (Inconsistent data causes agents to fail)

Agent Coordination Failure ──→ Context Explosion
     (Failed retries add to context)
```

When fixing, address in this order:
1. **P0 Data Flow** - Foundation for other fixes
2. **P1 Agent Coordination** - Stability
3. **P2 Context Explosion** - Efficiency
4. **P3 Long-tail Forgetting** - Quality
