---
name: lite-fix
description: Lightweight bug diagnosis and fix workflow with intelligent severity assessment and optional hotfix mode for production incidents
argument-hint: "[--hotfix] \"bug description or issue reference\""
allowed-tools: TodoWrite(*), Task(*), SlashCommand(*), AskUserQuestion(*), Read(*), Bash(*)
---

# Workflow Lite-Fix Command (/workflow:lite-fix)

## Overview

Fast-track bug fixing workflow optimized for quick diagnosis, targeted fixes, and streamlined verification. Automatically adjusts process complexity based on impact assessment.

**Core capabilities:**
- Rapid root cause diagnosis with intelligent code search
- Automatic severity assessment and adaptive workflow
- Fix strategy selection (immediate patch vs comprehensive refactor)
- Risk-aware verification (smoke tests to full suite)
- Optional hotfix mode for production incidents with branch management
- Automatic follow-up task generation for hotfixes

## Usage

### Command Syntax
```bash
/workflow:lite-fix [FLAGS] <BUG_DESCRIPTION>

# Flags
--hotfix, -h               Production hotfix mode (creates hotfix branch, auto follow-up)

# Arguments
<bug-description>          Bug description or issue reference (required)
```

### Modes

| Mode | Time Budget | Use Case | Workflow Characteristics |
|------|-------------|----------|--------------------------|
| **Default** | Auto-adapt (15min-4h) | All standard bugs | Intelligent severity assessment + adaptive process |
| **Hotfix** (`--hotfix`) | 15-30 min | Production outage | Minimal diagnosis + hotfix branch + auto follow-up |

### Examples

```bash
# Default mode: Automatically adjusts based on impact
/workflow:lite-fix "User avatar upload fails with 413 error"
/workflow:lite-fix "Shopping cart randomly loses items at checkout"

# Hotfix mode: Production incident
/workflow:lite-fix --hotfix "Payment gateway 5xx errors"
```

## Execution Process

### Workflow Overview

```
Bug Input → Diagnosis (Phase 1) → Impact Assessment (Phase 2)
        ↓
    Severity Auto-Detection → Fix Planning (Phase 3)
        ↓
    Verification Strategy (Phase 4) → User Confirmation (Phase 5) → Execution (Phase 6)
```

### Phase Summary

| Phase | Default Mode | Hotfix Mode |
|-------|--------------|-------------|
| 1. Diagnosis | Adaptive search depth | Minimal (known issue) |
| 2. Impact Assessment | Full risk scoring | Critical path only |
| 3. Fix Planning | Strategy options based on complexity | Single surgical fix |
| 4. Verification | Test level matches risk score | Smoke tests only |
| 5. User Confirmation | 3 dimensions | 2 dimensions |
| 6. Execution | Via lite-execute | Via lite-execute + monitoring |

---

## Detailed Phase Execution

### Phase 1: Diagnosis & Root Cause Analysis

**Goal**: Identify root cause and affected code paths

**Execution Strategy**:

**Default Mode** - Adaptive search:
- **High confidence keywords** (e.g., specific error messages): Direct grep search (5min)
- **Medium confidence**: cli-explore-agent with focused search (10-15min)
- **Low confidence** (vague symptoms): cli-explore-agent with broad search (20min)

```javascript
// Confidence-based strategy selection
if (has_specific_error_message || has_file_path_hint) {
  // Quick targeted search
  grep -r '${error_message}' src/ --include='*.ts' -n | head -10
  git log --oneline --since='1 week ago' -- '*affected*'
} else {
  // Deep exploration
  Task(subagent_type="cli-explore-agent", prompt=`
    Bug: ${bug_description}
    Execute diagnostic search:
    1. Search error patterns and similar issues
    2. Trace execution path in affected modules
    3. Check recent changes
    Return: Root cause hypothesis, affected paths, reproduction steps
  `)
}
```

**Hotfix Mode** - Minimal search:
```bash
Read(suspected_file)  # User typically knows the file
git blame ${suspected_file}
```

**Output Structure**:
```javascript
{
  root_cause: {
    file: "src/auth/tokenValidator.ts",
    line_range: "45-52",
    issue: "Token expiration check uses wrong comparison",
    introduced_by: "commit abc123"
  },
  reproduction_steps: ["Login", "Wait 15min", "Access protected route"],
  affected_scope: {
    users: "All authenticated users",
    features: ["login", "API access"],
    data_risk: "none"
  }
}
```

**TodoWrite**: Mark Phase 1 completed, Phase 2 in_progress

---

### Phase 2: Impact Assessment & Severity Auto-Detection

**Goal**: Quantify blast radius and auto-determine severity

**Risk Score Calculation**:
```javascript
risk_score = (user_impact × 0.4) + (system_risk × 0.3) + (business_impact × 0.3)

// Auto-severity mapping
if (risk_score >= 8.0) severity = "critical"
else if (risk_score >= 5.0) severity = "high"
else if (risk_score >= 3.0) severity = "medium"
else severity = "low"

// Workflow adaptation
if (severity >= "high") {
  diagnosis_depth = "focused"
  test_strategy = "smoke_and_critical"
  review_optional = true
} else {
  diagnosis_depth = "comprehensive"
  test_strategy = "full_suite"
  review_optional = false
}
```

**Assessment Output**:
```javascript
{
  affected_users: {
    count: "5000 active users (100%)",
    severity: "high"
  },
  system_risk: {
    availability: "degraded_30%",
    cascading_failures: "possible_logout_storm"
  },
  business_impact: {
    revenue: "medium",
    reputation: "high",
    sla_breach: "yes"
  },
  risk_score: 7.1,
  severity: "high",
  workflow_adaptation: {
    test_strategy: "focused_integration",
    review_required: false,
    time_budget: "1_hour"
  }
}
```

**Hotfix Mode**: Skip detailed assessment, assume critical

**TodoWrite**: Mark Phase 2 completed, Phase 3 in_progress

---

### Phase 3: Fix Planning & Strategy Selection

**Goal**: Generate fix options with trade-off analysis

**Strategy Generation**:

**Default Mode** - Complexity-adaptive:
- **Low risk score (<5.0)**: Generate 2-3 strategy options for user selection
- **High risk score (≥5.0)**: Generate single best strategy for speed

```javascript
strategies = generateFixStrategies(root_cause, risk_score)

if (risk_score >= 5.0 || mode === "hotfix") {
  // Single best strategy
  return strategies[0]  // Fastest viable fix
} else {
  // Multiple options with trade-offs
  return strategies  // Let user choose
}
```

**Example Strategies**:
```javascript
// Low risk: Multiple options
[
  {
    strategy: "immediate_patch",
    description: "Fix comparison operator",
    estimated_time: "15 minutes",
    risk: "low",
    pros: ["Quick fix"],
    cons: ["Doesn't address underlying issue"]
  },
  {
    strategy: "comprehensive_fix",
    description: "Refactor token validation logic",
    estimated_time: "2 hours",
    risk: "medium",
    pros: ["Addresses root cause"],
    cons: ["Longer implementation"]
  }
]

// High risk or hotfix: Single option
{
  strategy: "surgical_fix",
  description: "Minimal change to fix comparison",
  files: ["src/auth/tokenValidator.ts:47"],
  estimated_time: "5 minutes",
  risk: "minimal"
}
```

**Complexity Assessment**:
```javascript
if (complexity === "high" && risk_score < 5.0) {
  suggestCommand("/workflow:plan --mode bugfix")
  return  // Escalate to full planning
}
```

**TodoWrite**: Mark Phase 3 completed, Phase 4 in_progress

---

### Phase 4: Verification Strategy

**Goal**: Define testing approach based on severity

**Adaptive Test Strategy**:

| Risk Score | Test Scope | Duration | Automation |
|------------|------------|----------|------------|
| **< 3.0** (Low) | Full test suite | 15-20 min | `npm test` |
| **3.0-5.0** (Medium) | Focused integration | 8-12 min | `npm test -- affected-module.test.ts` |
| **5.0-8.0** (High) | Smoke + critical | 5-8 min | `npm test -- critical.smoke.test.ts` |
| **≥ 8.0** (Critical) | Smoke only | 2-5 min | `npm test -- smoke.test.ts` |
| **Hotfix** | Production smoke | 2-3 min | `npm test -- production.smoke.test.ts` |

**Branch Strategy**:

**Default Mode**:
```javascript
{
  type: "feature_branch",
  base: "main",
  name: "fix/token-expiration-edge-case",
  merge_target: "main"
}
```

**Hotfix Mode**:
```javascript
{
  type: "hotfix_branch",
  base: "production_tag_v2.3.1",  // ⚠️ From production tag
  name: "hotfix/token-validation-fix",
  merge_target: ["main", "production"]  // Dual merge
}
```

**TodoWrite**: Mark Phase 4 completed, Phase 5 in_progress

---

### Phase 5: User Confirmation & Execution Selection

**Adaptive Confirmation Dimensions**:

**Default Mode** - 3 dimensions (adapted by risk score):

```javascript
dimensions = [
  {
    question: "Confirm fix approach?",
    options: ["Proceed", "Modify", "Escalate to /workflow:plan"]
  },
  {
    question: "Execution method:",
    options: ["Agent", "CLI Tool (Codex/Gemini)", "Manual (plan only)"]
  },
  {
    question: "Verification level:",
    options: adaptedByRiskScore()  // Auto-suggest based on Phase 2
  }
]

// If risk_score >= 5.0, auto-skip code review dimension
// If risk_score < 5.0, add optional code review dimension
if (risk_score < 5.0) {
  dimensions.push({
    question: "Post-fix review:",
    options: ["Gemini", "Skip"]
  })
}
```

**Hotfix Mode** - 2 dimensions (minimal):
```javascript
[
  {
    question: "Confirm hotfix deployment:",
    options: ["Deploy", "Stage First", "Abort"]
  },
  {
    question: "Post-deployment monitoring:",
    options: ["Real-time (15 min)", "Passive (alerts only)"]
  }
]
```

**TodoWrite**: Mark Phase 5 completed, Phase 6 in_progress

---

### Phase 6: Execution Dispatch & Follow-up

**Dispatch to lite-execute**:

```javascript
executionContext = {
  mode: "bugfix",
  severity: auto_detected_severity,  // From Phase 2
  planObject: plan,
  diagnosisContext: diagnosis,
  impactContext: impact_assessment,
  verificationStrategy: test_strategy,
  branchStrategy: branch_strategy,
  executionMethod: user_selection.execution_method
}

SlashCommand("/workflow:lite-execute --in-memory --mode bugfix")
```

**Hotfix Auto Follow-up**:

```javascript
if (mode === "hotfix") {
  follow_up_tasks = [
    {
      id: `FOLLOWUP-${taskId}-comprehensive`,
      title: "Replace hotfix with comprehensive fix",
      priority: "high",
      due_date: "within_3_days",
      description: "Refactor quick hotfix into proper solution with full test coverage"
    },
    {
      id: `FOLLOWUP-${taskId}-postmortem`,
      title: "Incident postmortem",
      priority: "medium",
      due_date: "within_1_week",
      sections: ["Timeline", "Root cause", "Prevention measures"]
    }
  ]

  Write(`.workflow/lite-fixes/${taskId}-followup.json`, follow_up_tasks)

  console.log(`
  ⚠️ Hotfix follow-up tasks generated:
  - Comprehensive fix: ${follow_up_tasks[0].id} (due in 3 days)
  - Postmortem: ${follow_up_tasks[1].id} (due in 1 week)
  `)
}
```

**TodoWrite**: Mark Phase 6 completed

---

## Data Structures

### diagnosisContext
```javascript
{
  symptom: string,
  error_message: string | null,
  keywords: string[],
  confidence_level: "high" | "medium" | "low",  // Search confidence
  root_cause: {
    file: string,
    line_range: string,
    issue: string,
    introduced_by: string
  },
  reproduction_steps: string[],
  affected_scope: {...}
}
```

### impactContext
```javascript
{
  affected_users: { count: string, severity: string },
  system_risk: { availability: string, cascading_failures: string },
  business_impact: { revenue: string, reputation: string, sla_breach: string },
  risk_score: number,  // 0-10
  severity: "low" | "medium" | "high" | "critical",
  workflow_adaptation: {
    diagnosis_depth: string,
    test_strategy: string,
    review_optional: boolean,
    time_budget: string
  }
}
```

### fixPlan
```javascript
{
  strategy: string,
  summary: string,
  tasks: [{
    title: string,
    file: string,
    action: "Update" | "Create" | "Delete",
    implementation: string[],
    verification: string[]
  }],
  estimated_time: string,
  recommended_execution: "Agent" | "CLI" | "Manual"
}
```

---

## Best Practices

### When to Use Default Mode

**Use for all standard bugs:**
- Automatically adapts to severity (no manual mode selection needed)
- Risk score determines workflow complexity
- Handles 90% of bug fixing scenarios

**Typical scenarios:**
- UI bugs, logic errors, edge cases
- Performance issues (non-critical)
- Integration failures
- Data validation bugs

### When to Use Hotfix Mode

**Only use for production incidents:**
- Production is down or critically degraded
- Revenue/reputation at immediate risk
- SLA breach occurring
- Issue is well-understood (minimal diagnosis needed)

**Hotfix characteristics:**
- Creates hotfix branch from production tag
- Minimal diagnosis (assumes known issue)
- Smoke tests only
- Auto-generates follow-up tasks
- Requires incident tracking

### Branching Strategy

**Default Mode (feature branch)**:
```bash
# Standard feature branch workflow
git checkout -b fix/issue-description main
# ... implement fix
git checkout main && git merge fix/issue-description
```

**Hotfix Mode (dual merge)**:
```bash
# ✅ Correct: Branch from production tag
git checkout -b hotfix/fix-name v2.3.1

# Merge to both targets
git checkout main && git merge hotfix/fix-name
git checkout production && git merge hotfix/fix-name
git tag v2.3.2

# ❌ Wrong: Branch from main
git checkout -b hotfix/fix-name main  # Contains unreleased code!
```

---

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Root cause unclear | Vague symptoms | Extend diagnosis time or use /cli:mode:bug-diagnosis |
| Multiple potential causes | Complex interaction | Use /cli:discuss-plan for analysis |
| Fix too complex | High-risk refactor | Escalate to /workflow:plan --mode bugfix |
| High risk score but unsure | Uncertain severity | Default mode will adapt, proceed normally |

---

## Output Routing

**Lite-fix directory**:
```
.workflow/lite-fixes/
├── BUGFIX-2024-10-20T14-30-00.json          # Task JSON
├── BUGFIX-2024-10-20T14-30-00-followup.json # Follow-up (hotfix only)
└── diagnosis-cache/                          # Cached diagnoses
    └── ${bug_hash}.json
```

**Session-based** (if active session):
```
.workflow/active/WFS-feature/
├── .bugfixes/
│   ├── BUGFIX-001.json
│   └── BUGFIX-001-followup.json
└── .summaries/
    └── BUGFIX-001-summary.md
```

---

## Advanced Features

### 1. Intelligent Diagnosis Caching

Reuse diagnosis for similar bugs:
```javascript
cache_key = hash(bug_keywords + recent_changes_hash)
if (cache_exists && cache_age < 7_days && similarity > 0.8) {
  diagnosis = load_from_cache()
  console.log("Using cached diagnosis (similar issue found)")
}
```

### 2. Auto-Severity Suggestion

Detect urgency from keywords:
```javascript
urgency_keywords = ["production", "down", "outage", "critical", "urgent"]
if (bug_description.includes(urgency_keywords) && !mode_specified) {
  console.log("💡 Tip: Consider --hotfix flag for production issues")
}
```

### 3. Adaptive Workflow Intelligence

Real-time workflow adjustment:
```javascript
// During Phase 2, if risk score suddenly increases
if (new_risk_score > initial_estimate * 1.5) {
  console.log("⚠️ Severity increased, adjusting workflow...")
  test_strategy = "more_comprehensive"
  review_required = true
}
```

---

## Related Commands

**Diagnostic Commands**:
- `/cli:mode:bug-diagnosis` - Detailed root cause analysis (use before lite-fix if unclear)

**Fix Execution**:
- `/workflow:lite-execute --in-memory` - Execute fix plan (automatically called)

**Planning Commands**:
- `/workflow:plan --mode bugfix` - Complex bugs requiring comprehensive planning

**Review Commands**:
- `/workflow:review --type quality` - Post-fix quality review

---

## Comparison with Other Commands

| Command | Use Case | Modes | Adaptation | Output |
|---------|----------|-------|------------|--------|
| `/workflow:lite-fix` | Bug fixes | 2 (default + hotfix) | Auto-adaptive | In-memory + JSON |
| `/workflow:lite-plan` | New features | 1 + explore flag | Manual | In-memory + JSON |
| `/workflow:plan` | Complex features | Multiple | Manual | Persistent session |
| `/cli:mode:bug-diagnosis` | Analysis only | 1 | N/A | Report only |

---

## Quality Gates

**Before execution** (auto-checked):
- [ ] Root cause identified (>70% confidence for default, >90% for hotfix)
- [ ] Impact scope defined
- [ ] Fix strategy reviewed
- [ ] Verification plan matches risk level

**Hotfix-specific**:
- [ ] Production tag identified
- [ ] Rollback plan documented
- [ ] Follow-up tasks generated
- [ ] Monitoring configured

---

## When to Use lite-fix

✅ **Perfect for:**
- Any bug with clear symptoms
- Localized fixes (1-5 files)
- Known technology stack
- Time-sensitive but not catastrophic (default mode adapts)
- Production incidents (use --hotfix)

❌ **Not suitable for:**
- Root cause completely unclear → use `/cli:mode:bug-diagnosis` first
- Requires architectural changes → use `/workflow:plan`
- Complex legacy code without tests → use `/workflow:plan --legacy-refactor`
- Performance deep-dive → use `/workflow:plan --performance-optimization`
- Data migration → use `/workflow:plan --data-migration`

---

**Last Updated**: 2025-11-20
**Version**: 2.0.0
**Status**: Design Document (Simplified)
