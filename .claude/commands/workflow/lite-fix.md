---
name: lite-fix
description: Lightweight bug diagnosis and fix workflow with fast-track verification and optional hotfix mode for production incidents
argument-hint: "[--critical|--hotfix] [--incident ID] \"bug description or issue reference\""
allowed-tools: TodoWrite(*), Task(*), SlashCommand(*), AskUserQuestion(*), Read(*), Bash(*)
---

# Workflow Lite-Fix Command (/workflow:lite-fix)

## Overview

Fast-track bug fixing workflow optimized for quick diagnosis, targeted fixes, and streamlined verification. Supports both regular bug fixes and critical production hotfixes with appropriate process adaptations.

**Core capabilities:**
- Rapid root cause diagnosis with intelligent code search
- Impact scope assessment (affected users, data, systems)
- Fix strategy selection (immediate patch vs comprehensive refactor)
- Risk-aware verification (smoke tests for hotfix, full suite for regular)
- Automatic hotfix branch management
- Follow-up task generation for comprehensive fixes

## Usage

### Command Syntax
```bash
/workflow:lite-fix [FLAGS] <BUG_DESCRIPTION>

# Flags
--critical, -c             Critical bug requiring fast-track process
--hotfix, -h               Production hotfix mode (creates hotfix branch)
--incident <ID>            Associate with incident tracking ID

# Arguments
<bug-description>          Bug description or issue reference (required)
```

### Severity Modes

**Regular Mode** (default):
- Full diagnosis and exploration
- Comprehensive test verification
- Standard branch workflow
- Time budget: 2-4 hours

**Critical Mode** (`--critical`):
- Focused diagnosis (skip deep exploration)
- Smoke test verification
- Expedited review process
- Time budget: 30-60 minutes

**Hotfix Mode** (`--hotfix`):
- Minimal diagnosis (known issue)
- Production-grade smoke tests
- Hotfix branch from production tag
- Follow-up task auto-generated
- Time budget: 15-30 minutes

### Input Requirements

**Bug Description Formats**:
```bash
# Natural language
/workflow:lite-fix "用户登录失败，提示token已过期"

# Issue reference
/workflow:lite-fix "Fix #1234: Payment processing timeout"

# Incident reference (critical)
/workflow:lite-fix --critical --incident INC-2024-1015 "支付网关5xx错误"

# Production hotfix
/workflow:lite-fix --hotfix "修复内存泄漏导致服务崩溃"
```

## Execution Process

### Workflow Overview

```
Bug Input → Diagnosis (Phase 1) → Impact Assessment (Phase 2)
        ↓
    Fix Planning (Phase 3) → Verification Strategy (Phase 4)
        ↓
    User Confirmation → Execution (Phase 5) → Monitoring (Phase 6)
```

### Phase Summary

| Phase | Regular | Critical | Hotfix | Skippable |
|-------|---------|----------|--------|-----------|
| 1. Diagnosis & Root Cause | Full (30min) | Focused (10min) | Minimal (5min) | ❌ |
| 2. Impact Assessment | Comprehensive | Targeted | Critical path | ❌ |
| 3. Fix Planning | Multiple options | Single best | Surgical fix | ❌ |
| 4. Verification Strategy | Full test suite | Key scenarios | Smoke tests | ❌ |
| 5. User Confirmation | 4-dimension | 3-dimension | 2-dimension | ❌ |
| 6. Execution & Monitoring | Standard | Expedited | Real-time | Via lite-execute |

---

## Detailed Phase Execution

### Phase 1: Diagnosis & Root Cause Analysis

**Goal**: Identify root cause and affected code paths

**Step 1.1: Parse Bug Description**

Extract structured information:
```javascript
{
  symptom: "用户登录失败",
  error_message: "token已过期",
  affected_feature: "authentication",
  keywords: ["login", "token", "expire", "authentication"]
}
```

**Step 1.2: Code Search Strategy**

Execution depends on severity mode:

**Regular Mode** - Comprehensive search:
```javascript
Task(
  subagent_type="cli-explore-agent",
  description="Diagnose authentication token expiration",
  prompt=`
  Bug Symptom: ${bug_description}

  Execute diagnostic search:
  1. Search error message: Grep "${error_message}" --output_mode content
  2. Find token validation logic: Glob "**/auth/**/*.{ts,js}"
  3. Trace token expiration handling: Search "token" AND "expire"
  4. Check recent changes: git log --since="1 week ago" --grep="auth|token"

  Analyze and return:
  - Root cause hypothesis (file:line)
  - Affected code paths
  - Recent changes correlation
  - Edge cases and reproduction steps

  Time limit: 20 minutes
  `
)
```

**Critical Mode** - Focused search:
```javascript
// Skip cli-explore-agent, use direct targeted searches
Bash(commands=[
  "grep -r '${error_message}' src/ --include='*.ts' -n | head -10",
  "git log --oneline --since='1 week ago' --all -- '*auth*' | head -5",
  "git blame ${suspected_file}"
])
```

**Hotfix Mode** - Minimal search (assume known issue):
```javascript
// User provides suspected file/function, skip exploration
Read(suspected_file)
```

**Step 1.3: Root Cause Determination**

Output structured diagnosis:
```javascript
{
  root_cause: {
    file: "src/auth/tokenValidator.ts",
    line_range: "45-52",
    issue: "Token expiration check uses wrong timestamp comparison",
    introduced_by: "commit abc123 on 2024-10-15"
  },
  reproduction_steps: [
    "Login with valid credentials",
    "Wait 15 minutes (half of token TTL)",
    "Attempt protected route access",
    "Observe premature expiration error"
  ],
  affected_scope: {
    users: "All authenticated users",
    features: ["login", "API access", "session management"],
    data_risk: "none"
  }
}
```

**Progress Tracking**:
```json
[
  {"content": "Parse bug description and extract keywords", "status": "completed", "activeForm": "Parsing bug"},
  {"content": "Execute code search for root cause", "status": "completed", "activeForm": "Searching code"},
  {"content": "Determine root cause and affected scope", "status": "completed", "activeForm": "Analyzing root cause"},
  {"content": "Phase 2: Impact assessment", "status": "in_progress", "activeForm": "Assessing impact"}
]
```

---

### Phase 2: Impact Assessment

**Goal**: Quantify blast radius and risk level

**Step 2.1: User Impact Analysis**

```javascript
{
  affected_users: {
    count: "100% of active users (est. 5000)",
    severity: "high",
    workaround: "Re-login required (poor UX)"
  },
  affected_features: [
    {
      feature: "API authentication",
      criticality: "critical",
      degradation: "complete_failure"
    },
    {
      feature: "Session management",
      criticality: "high",
      degradation: "partial_failure"
    }
  ]
}
```

**Step 2.2: Data & System Risk**

```javascript
{
  data_risk: {
    corruption: "none",
    loss: "none",
    exposure: "none"
  },
  system_risk: {
    availability: "degraded_30%",
    cascading_failures: "possible_logout_storm",
    rollback_complexity: "low"
  },
  business_impact: {
    revenue: "medium",
    reputation: "high",
    sla_breach: "yes"
  }
}
```

**Step 2.3: Risk Score Calculation**

```javascript
risk_score = (user_impact × 0.4) + (system_risk × 0.3) + (business_impact × 0.3)

// Example:
// user_impact=8, system_risk=6, business_impact=7
// risk_score = 8×0.4 + 6×0.3 + 7×0.3 = 7.1 (HIGH)

if (risk_score >= 8.0) severity = "critical"
else if (risk_score >= 5.0) severity = "high"
else if (risk_score >= 3.0) severity = "medium"
else severity = "low"
```

**Output to User**:
```markdown
## Impact Assessment

**Risk Level**: HIGH (7.1/10)

**Affected Users**: ~5000 active users (100%)
**Feature Impact**:
  - 🔴 API authentication: Complete failure
  - 🟡 Session management: Partial failure

**Business Impact**:
  - Revenue: Medium
  - Reputation: High
  - SLA: Breached

**Recommended Severity**: --critical flag suggested
```

**Progress Tracking**: Mark Phase 2 completed, Phase 3 in_progress

---

### Phase 3: Fix Planning & Strategy Selection

**Goal**: Generate fix options with trade-off analysis

**Step 3.1: Generate Fix Strategies**

Produce 1-3 fix strategies based on complexity:

**Regular Bug** (1-3 strategies):
```javascript
[
  {
    strategy: "immediate_patch",
    description: "Fix timestamp comparison logic",
    files: ["src/auth/tokenValidator.ts:45-52"],
    estimated_time: "15 minutes",
    risk: "low",
    pros: ["Quick fix", "Minimal code change"],
    cons: ["Doesn't address underlying token refresh issue"]
  },
  {
    strategy: "comprehensive_refactor",
    description: "Refactor token validation with proper refresh logic",
    files: ["src/auth/tokenValidator.ts", "src/auth/refreshToken.ts"],
    estimated_time: "2 hours",
    risk: "medium",
    pros: ["Addresses root cause", "Improves token handling"],
    cons: ["Longer implementation", "More testing needed"]
  }
]
```

**Critical/Hotfix** (1 strategy only):
```javascript
[
  {
    strategy: "surgical_fix",
    description: "Minimal change to fix timestamp comparison",
    files: ["src/auth/tokenValidator.ts:47"],
    change: "Replace currentTime > expiryTime with currentTime >= expiryTime",
    estimated_time: "5 minutes",
    risk: "minimal",
    test_strategy: "smoke_test_login_flow"
  }
]
```

**Step 3.2: Adaptive Planning**

Determine planning strategy based on complexity:

```javascript
complexity = assessComplexity(fix_strategies)

if (complexity === "low" || mode === "hotfix") {
  // Direct planning by Claude
  plan = generateSimplePlan(selected_strategy)
} else if (complexity === "medium") {
  // Use cli-lite-planning-agent
  plan = Task(subagent_type="cli-lite-planning-agent", ...)
} else {
  // Suggest full workflow
  suggestCommand("/workflow:plan --mode bugfix")
}
```

**Step 3.3: Generate Fix Plan**

Output structured plan:
```javascript
{
  summary: "Fix timestamp comparison in token validation",
  approach: "Update comparison operator to handle edge case",
  tasks: [
    {
      title: "Fix token expiration comparison",
      file: "src/auth/tokenValidator.ts",
      action: "Update",
      description: "Change line 47 comparison from > to >=",
      implementation: [
        "Locate validateToken function (line 45)",
        "Update comparison: currentTime >= expiryTime",
        "Add comment explaining edge case handling"
      ],
      verification: [
        "Manual test: Login and wait at boundary timestamp",
        "Run auth integration tests",
        "Check no regression in token refresh flow"
      ]
    }
  ],
  estimated_time: "30 minutes",
  recommended_execution: "Agent"
}
```

**Progress Tracking**: Mark Phase 3 completed, Phase 4 in_progress

---

### Phase 4: Verification Strategy

**Goal**: Define appropriate testing approach based on severity

**Verification Levels**:

| Mode | Test Scope | Duration | Pass Criteria |
|------|------------|----------|---------------|
| **Regular** | Full test suite | 10-20 min | All tests pass |
| **Critical** | Key scenarios | 5-10 min | Critical paths pass |
| **Hotfix** | Smoke tests | 2-5 min | No regressions in core flow |

**Step 4.1: Select Test Strategy**

```javascript
if (mode === "hotfix") {
  test_strategy = {
    type: "smoke_tests",
    tests: [
      "Login with valid credentials",
      "Access protected route",
      "Token refresh at boundary",
      "Logout successfully"
    ],
    automation: "npx jest auth.smoke.test.ts",
    manual_verification: "Production-like staging test"
  }
} else if (mode === "critical") {
  test_strategy = {
    type: "focused_integration",
    tests: [
      "auth.integration.test.ts",
      "session.test.ts"
    ],
    skip: ["e2e tests", "performance tests"]
  }
} else {
  test_strategy = {
    type: "comprehensive",
    tests: "npm test",
    coverage_threshold: "no_decrease"
  }
}
```

**Step 4.2: Branching Strategy**

```javascript
if (mode === "hotfix") {
  branch_strategy = {
    type: "hotfix_branch",
    base: "production_tag_v2.3.1",
    name: "hotfix/token-validation-fix",
    merge_target: ["main", "production"],
    tag_after_merge: "v2.3.2"
  }
} else {
  branch_strategy = {
    type: "feature_branch",
    base: "main",
    name: "fix/token-expiration-edge-case",
    merge_target: "main"
  }
}
```

**Progress Tracking**: Mark Phase 4 completed, Phase 5 in_progress

---

### Phase 5: User Confirmation & Execution Selection

**Multi-Dimension Confirmation**

Number of dimensions varies by severity:

**Regular Mode** (4 dimensions):
```javascript
AskUserQuestion({
  questions: [
    {
      question: `**Fix Strategy**: ${plan.summary}

**Estimated Time**: ${plan.estimated_time}
**Risk**: ${plan.risk}

Confirm fix approach?`,
      header: "Fix Confirmation",
      multiSelect: false,
      options: [
        { label: "Proceed", description: "Execute as planned" },
        { label: "Modify", description: "Adjust strategy first" },
        { label: "Escalate", description: "Use full /workflow:plan" }
      ]
    },
    {
      question: "Select execution method:",
      header: "Execution",
      options: [
        { label: "Agent", description: "@code-developer autonomous" },
        { label: "CLI Tool", description: "Codex/Gemini execution" },
        { label: "Manual", description: "Provide plan only" }
      ]
    },
    {
      question: "Verification level:",
      header: "Testing",
      options: [
        { label: "Full Suite", description: "Run all tests (safer)" },
        { label: "Focused", description: "Affected tests only (faster)" },
        { label: "Smoke Only", description: "Critical path only (fastest)" }
      ]
    },
    {
      question: "Post-fix review:",
      header: "Code Review",
      options: [
        { label: "Gemini", description: "AI review for quality" },
        { label: "Skip", description: "Trust automated tests" }
      ]
    }
  ]
})
```

**Critical Mode** (3 dimensions - skip detailed review):
```javascript
// Skip dimension 4 (code review), auto-apply "Skip"
```

**Hotfix Mode** (2 dimensions - minimal confirmation):
```javascript
AskUserQuestion({
  questions: [
    {
      question: "Confirm hotfix deployment:",
      options: [
        { label: "Deploy", description: "Apply fix to production" },
        { label: "Stage First", description: "Test in staging" },
        { label: "Abort", description: "Cancel hotfix" }
      ]
    },
    {
      question: "Post-deployment monitoring:",
      options: [
        { label: "Real-time", description: "Monitor for 15 minutes" },
        { label: "Passive", description: "Rely on alerts" }
      ]
    }
  ]
})
```

**Step 5.2: Export Enhanced Task JSON** (optional)

If user confirms "Proceed":
```javascript
if (user_wants_json_export) {
  timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  taskId = `BUGFIX-${timestamp}`
  filename = `.workflow/lite-fixes/${taskId}.json`

  Write(filename, {
    id: taskId,
    title: bug_description,
    status: "pending",
    meta: {
      type: "bugfix",
      severity: mode,
      incident_id: incident_id || null,
      created_at: timestamp
    },
    context: {
      requirements: [plan.summary],
      root_cause: diagnosis.root_cause,
      affected_scope: impact_assessment,
      focus_paths: plan.tasks.flatMap(t => t.file),
      acceptance: plan.tasks.flatMap(t => t.verification)
    },
    flow_control: {
      pre_analysis: [
        {
          step: "reproduce_bug",
          action: "Verify bug reproduction",
          commands: diagnosis.reproduction_steps.map(step => `# ${step}`)
        }
      ],
      implementation_approach: plan.tasks.map((task, i) => ({
        step: i + 1,
        title: task.title,
        description: task.description,
        modification_points: task.implementation,
        verification: task.verification,
        depends_on: i === 0 ? [] : [i]
      })),
      target_files: plan.tasks.map(t => t.file)
    }
  })
}
```

**Progress Tracking**: Mark Phase 5 completed, Phase 6 in_progress

---

### Phase 6: Execution Dispatch & Follow-up

**Step 6.1: Dispatch to lite-execute**

Store execution context and invoke lite-execute:

```javascript
executionContext = {
  mode: "bugfix",
  severity: mode, // "regular" | "critical" | "hotfix"
  planObject: plan,
  diagnosisContext: diagnosis,
  impactContext: impact_assessment,
  verificationStrategy: test_strategy,
  branchStrategy: branch_strategy,
  executionMethod: user_selection.execution_method,
  monitoringLevel: user_selection.monitoring
}

SlashCommand("/workflow:lite-execute --in-memory --mode bugfix")
```

**Step 6.2: Hotfix Follow-up Tasks** (auto-generated if hotfix mode)

```javascript
if (mode === "hotfix") {
  follow_up_tasks = [
    {
      id: `FOLLOWUP-${taskId}-comprehensive`,
      title: "Comprehensive fix for token validation",
      description: "Replace quick hotfix with proper solution",
      priority: "high",
      due_date: "within_3_days",
      tasks: [
        "Refactor token validation logic",
        "Add comprehensive test coverage",
        "Update documentation"
      ]
    },
    {
      id: `FOLLOWUP-${taskId}-postmortem`,
      title: "Incident postmortem",
      description: "Root cause analysis and prevention",
      priority: "medium",
      due_date: "within_1_week",
      deliverables: [
        "Timeline of events",
        "Root cause analysis",
        "Prevention measures"
      ]
    }
  ]

  Write(`.workflow/lite-fixes/${taskId}-followup.json`, follow_up_tasks)

  console.log(`
  ⚠️ Hotfix applied. Follow-up tasks generated:
  1. Comprehensive fix: ${follow_up_tasks[0].id}
  2. Postmortem: ${follow_up_tasks[1].id}

  Review tasks: cat .workflow/lite-fixes/${taskId}-followup.json
  `)
}
```

**Step 6.3: Monitoring Setup** (if real-time selected)

```javascript
if (user_selection.monitoring === "real-time") {
  console.log(`
  📊 Real-time Monitoring Active (15 minutes)

  Metrics to watch:
  - Error rate: /metrics/errors?filter=auth
  - Login success rate: /metrics/login_success
  - Token validation latency: /metrics/auth_latency

  Auto-rollback triggers:
  - Error rate > 5%
  - Login success < 95%
  - P95 latency > 500ms

  Dashboard: https://monitoring.example.com/hotfix-${taskId}
  `)

  // Optional: Set up automated monitoring (if integrated)
  Bash(`
    ./scripts/monitor-deployment.sh \
      --duration 15m \
      --metrics error_rate,login_success,auth_latency \
      --alert-threshold error_rate:5%,login_success:95% \
      --rollback-on-threshold
  `)
}
```

**Progress Tracking**: Mark Phase 6 completed, lite-execute continues

---

## Data Structures

### diagnosisContext

```javascript
{
  symptom: string,                      // Original bug description
  error_message: string | null,         // Extracted error message
  keywords: string[],                   // Search keywords
  root_cause: {
    file: string,                       // File path
    line_range: string,                 // e.g., "45-52"
    issue: string,                      // Root cause description
    introduced_by: string               // git blame info
  },
  reproduction_steps: string[],         // How to reproduce
  affected_scope: {
    users: string,                      // Impact description
    features: string[],                 // Affected features
    data_risk: "none" | "low" | "medium" | "high"
  }
}
```

### impactContext

```javascript
{
  affected_users: {
    count: string,
    severity: "low" | "medium" | "high" | "critical",
    workaround: string | null
  },
  affected_features: [{
    feature: string,
    criticality: "low" | "medium" | "high" | "critical",
    degradation: "none" | "partial_failure" | "complete_failure"
  }],
  risk_score: number,                   // 0-10
  severity: "low" | "medium" | "high" | "critical"
}
```

### fixPlan

```javascript
{
  strategy: "immediate_patch" | "comprehensive_refactor" | "surgical_fix",
  summary: string,                      // 1-2 sentence overview
  approach: string,                     // High-level strategy
  tasks: [{
    title: string,
    file: string,
    action: "Update" | "Create" | "Delete",
    description: string,
    implementation: string[],            // Step-by-step
    verification: string[]               // Test steps
  }],
  estimated_time: string,
  risk: "minimal" | "low" | "medium" | "high",
  recommended_execution: "Agent" | "CLI" | "Manual"
}
```

### executionContext

Passed to lite-execute:

```javascript
{
  mode: "bugfix",
  severity: "regular" | "critical" | "hotfix",
  planObject: fixPlan,
  diagnosisContext: diagnosisContext,
  impactContext: impactContext,
  verificationStrategy: {
    type: "smoke_tests" | "focused_integration" | "comprehensive",
    tests: string[] | string,
    automation: string | null
  },
  branchStrategy: {
    type: "hotfix_branch" | "feature_branch",
    base: string,
    name: string,
    merge_target: string[]
  },
  executionMethod: "Agent" | "CLI" | "Manual",
  monitoringLevel: "real-time" | "passive"
}
```

---

## Best Practices

### 1. Severity Selection

**Use Regular Mode when:**
- Bug is not blocking critical functionality
- Have time for comprehensive testing
- Want to explore multiple fix strategies
- Can afford 2-4 hour fix cycle

**Use Critical Mode when:**
- Bug affects significant user base (>20%)
- Features degraded but not completely broken
- Need fix within 1 hour
- Have clear reproduction steps

**Use Hotfix Mode when:**
- Production is down or critically degraded
- Revenue/reputation at immediate risk
- SLA breach occurring
- Need fix within 30 minutes
- Issue is well-understood (skip exploration)

### 2. Branching Best Practices

**Hotfix Branching**:
```bash
# Correct: Branch from production tag
git checkout -b hotfix/fix-name v2.3.1

# Wrong: Branch from main (may include unreleased code)
git checkout -b hotfix/fix-name main
```

**Merge Strategy**:
```bash
# Hotfix merges to both main and production
git checkout main && git merge hotfix/fix-name
git checkout production && git merge hotfix/fix-name
git tag v2.3.2
```

### 3. Verification Strategies

**Smoke Tests** (Hotfix):
- Login flow
- Critical user journey
- Core API endpoints
- Data integrity spot check

**Focused Integration** (Critical):
- All tests in affected module
- Integration tests with dependencies
- Regression tests for similar bugs

**Comprehensive** (Regular):
- Full test suite
- Coverage delta check
- Manual exploratory testing

### 4. Follow-up Task Management

**Always create follow-up tasks for hotfixes**:
- ✅ Comprehensive fix (within 3 days)
- ✅ Test coverage improvement
- ✅ Monitoring/alerting enhancements
- ✅ Documentation updates
- ✅ Postmortem (if critical)

**Track technical debt**:
```javascript
{
  debt_type: "quick_hotfix",
  paydown_by: "2024-10-30",
  cost_of_delay: "Increased fragility in auth module"
}
```

---

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Root cause not found | Insufficient search | Expand search scope or escalate to /workflow:plan |
| Reproduction fails | Stale bug or environment issue | Verify environment, request updated reproduction steps |
| Multiple potential causes | Complex interaction | Use /cli:discuss-plan for multi-model analysis |
| Fix too complex for lite-fix | High-risk refactor needed | Suggest /workflow:plan --mode refactor |
| Hotfix verification fails | Insufficient smoke tests | Add critical test case or downgrade to critical mode |
| Branch conflict | Concurrent changes | Rebase or merge main, re-run diagnosis |

---

## Examples

### Example 1: Regular Bug Fix

```bash
/workflow:lite-fix "用户头像上传失败，返回413错误"
```

**Phase 1**: Diagnosis finds file size limit configuration issue
**Phase 2**: Impact - affects 10% users, medium severity
**Phase 3**: Two strategies - increase limit (quick) vs implement chunked upload (robust)
**Phase 4**: User selects quick fix
**Phase 5**: Confirmation - Agent execution, focused tests
**Result**: Fix in 45 minutes, full test coverage

---

### Example 2: Critical Production Bug

```bash
/workflow:lite-fix --critical "购物车结算时随机丢失商品"
```

**Phase 1**: Fast diagnosis - race condition in cart update
**Phase 2**: Impact - 30% checkout failures, high revenue impact
**Phase 3**: Single strategy - add pessimistic locking
**Phase 4**: Smoke tests + manual verification
**Phase 5**: User confirms, Codex execution
**Result**: Fix in 30 minutes, deployed to staging first

---

### Example 3: Production Hotfix

```bash
/workflow:lite-fix --hotfix --incident INC-2024-1015 "支付接口5xx错误，API密钥过期"
```

**Phase 1**: Minimal diagnosis (known issue - expired credentials)
**Phase 2**: Impact - 100% payment failures, critical
**Phase 3**: Single surgical fix - rotate API key
**Phase 4**: Hotfix branch from v2.3.1 tag
**Phase 5**: Deploy confirmation, real-time monitoring
**Phase 6**: Follow-up tasks generated automatically
**Result**: Fix in 15 minutes, monitoring for 15 minutes post-deploy

**Follow-up Tasks**:
```json
[
  {
    "id": "FOLLOWUP-rotation-automation",
    "title": "Automate API key rotation",
    "due": "3 days"
  },
  {
    "id": "FOLLOWUP-monitoring",
    "title": "Add expiry monitoring alert",
    "due": "1 week"
  }
]
```

---

### Example 4: Complex Bug Escalation

```bash
/workflow:lite-fix "性能下降，数据库查询超时"
```

**Phase 1**: Diagnosis reveals multiple N+1 queries and missing indexes
**Phase 3**: Complexity assessment - too complex for lite-fix
**Recommendation**:
```
⚠️ This bug requires comprehensive refactoring.

Suggested workflow:
1. Use /workflow:plan --performance-optimization "优化数据库查询性能"
2. Or: Use /cli:discuss-plan --topic "Database performance issues"

Lite-fix is designed for targeted fixes. This requires:
- Multiple file changes
- Schema migrations
- Load testing verification

Proceeding with lite-fix may result in incomplete fix.
```

**User Decision**: Escalate to /workflow:plan

---

## Comparison with Other Commands

| Command | Use Case | Time Budget | Test Coverage | Output |
|---------|----------|-------------|---------------|--------|
| `/workflow:lite-fix` | Bug fixes (regular to critical) | 15min - 4hrs | Smoke to full | In-memory + optional JSON |
| `/workflow:lite-plan` | New features (simple to medium) | 1-6 hrs | Full suite | In-memory + optional JSON |
| `/workflow:plan` | Complex features/refactors | 1-5 days | Comprehensive | Persistent session |
| `/cli:mode:bug-diagnosis` | Analysis only (no fix) | 10-30 min | N/A | Diagnostic report |
| `/cli:execute` | Direct implementation | Variable | Depends on prompt | Code changes |

---

## Integration with Existing Workflows

### Escalation Path

```
lite-fix → (too complex) → /workflow:plan --mode bugfix
lite-fix → (needs discussion) → /cli:discuss-plan
lite-fix → (needs perf analysis) → /workflow:plan --performance-optimization
```

### Complementary Commands

**Before lite-fix**:
```bash
# Optional: Preliminary diagnosis
/cli:mode:bug-diagnosis "describe issue"

# Then proceed with fix
/workflow:lite-fix "same issue description"
```

**After lite-fix**:
```bash
# Review fix quality
/workflow:review --type security

# Complete session (if session-based)
/workflow:session:complete
```

---

## File Structure

### Output Locations

**Lite-fix directory**:
```
.workflow/lite-fixes/
├── BUGFIX-2024-10-20T14-30-00.json          # Bug fix task JSON
├── BUGFIX-2024-10-20T14-30-00-followup.json # Follow-up tasks (hotfix only)
└── diagnosis-cache/                          # Cached diagnosis results
    └── auth-token-expiration-hash.json
```

**Session-based** (if active session exists):
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

### 1. Diagnosis Caching

Speed up repeated diagnoses of similar issues:

```javascript
// Generate diagnosis cache key
cache_key = hash(bug_keywords + recent_changes_hash)
cache_path = `.workflow/lite-fixes/diagnosis-cache/${cache_key}.json`

if (file_exists(cache_path) && cache_age < 1_week) {
  diagnosis = Read(cache_path)
  console.log("Using cached diagnosis (similar issue found)")
} else {
  diagnosis = performDiagnosis()
  Write(cache_path, diagnosis)
}
```

### 2. Automatic Severity Detection

Auto-suggest severity flag based on keywords:

```javascript
if (bug_description.includes("production|down|critical|outage")) {
  suggested_flag = "--critical"
} else if (bug_description.includes("hotfix|urgent|5xx|incident")) {
  suggested_flag = "--hotfix"
}

if (suggested_flag && !user_provided_flag) {
  console.log(`💡 Suggestion: Consider using ${suggested_flag} flag`)
}
```

### 3. Rollback Plan Generation

Auto-generate rollback instructions for hotfixes:

```javascript
rollback_plan = {
  method: "git_revert",
  commands: [
    `git revert ${commit_sha}`,
    `git push origin hotfix/${branch_name}`,
    `# Re-deploy previous version v2.3.1`
  ],
  estimated_time: "5 minutes",
  risk: "low"
}

Write(`.workflow/lite-fixes/${taskId}-rollback.sh`, rollback_plan.commands.join('\n'))
```

---

## Related Commands

**Diagnostic Commands**:
- `/cli:mode:bug-diagnosis` - Root cause analysis only
- `/cli:mode:code-analysis` - Execution path tracing

**Fix Execution Commands**:
- `/workflow:lite-execute --in-memory` - Execute fix plan (called by lite-fix)
- `/cli:execute` - Direct fix implementation
- `/cli:codex-execute` - Multi-stage fix with Codex

**Planning Commands**:
- `/workflow:plan --mode bugfix` - Complex bug requiring comprehensive planning
- `/workflow:plan --performance-optimization` - Performance-related bugs
- `/cli:discuss-plan` - Multi-model collaborative analysis for unclear bugs

**Review Commands**:
- `/workflow:review --type quality` - Post-fix code review
- `/workflow:review --type security` - Security validation after fix

**Session Management**:
- `/workflow:session:start` - Start tracked session for bug fixes
- `/workflow:session:complete` - Complete bug fix session

---

## Governance & Best Practices

### When to Use lite-fix

✅ **Good fit**:
- Clear bug symptom with reproducible steps
- Localized fix (1-3 files)
- Established codebase with tests
- Time-sensitive but not catastrophic
- Known technology stack

❌ **Poor fit**:
- Root cause unclear (use /cli:mode:bug-diagnosis first)
- Requires architectural changes (use /workflow:plan)
- No existing tests and complex legacy code (use /workflow:plan --legacy-refactor)
- Performance investigation needed (use /workflow:plan --performance-optimization)
- Data corruption/migration required (use /workflow:plan --data-migration)

### Quality Gates

**Before proceeding to execution**:
- [ ] Root cause identified with >80% confidence
- [ ] Impact scope clearly defined
- [ ] Fix strategy reviewed and approved
- [ ] Verification plan adequate for risk level
- [ ] Branch strategy appropriate for severity

**Hotfix-specific gates**:
- [ ] Incident ticket created and linked
- [ ] Incident commander approval obtained
- [ ] Rollback plan documented
- [ ] Follow-up tasks generated
- [ ] Post-deployment monitoring configured

---

**Last Updated**: 2025-11-20
**Version**: 1.0.0
**Status**: Design Document (Implementation Pending)
