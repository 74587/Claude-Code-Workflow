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

| Mode | Time Budget |适用场景 | 流程特点 |
|------|-------------|---------|---------|
| **Regular** (default) | 2-4 hours | 非阻塞bug，<20%用户影响 | 完整诊断 + 全量测试 |
| **Critical** (`--critical`) | 30-60 min | 核心功能受损，20-50%用户影响 | 聚焦诊断 + 关键测试 |
| **Hotfix** (`--hotfix`) | 15-30 min | 生产故障，100%用户影响 | 最小诊断 + Smoke测试 + 自动跟进 |

### Examples

```bash
# Regular mode: 一般bug修复
/workflow:lite-fix "用户头像上传失败，返回413错误"

# Critical mode: 紧急但非致命
/workflow:lite-fix --critical "购物车结算时随机丢失商品"

# Hotfix mode: 生产环境故障
/workflow:lite-fix --hotfix --incident INC-2024-1015 "支付网关5xx错误"
```

## Execution Process

### Workflow Overview

```
Bug Input → Diagnosis (Phase 1) → Impact Assessment (Phase 2)
        ↓
    Fix Planning (Phase 3) → Verification Strategy (Phase 4)
        ↓
    User Confirmation (Phase 5) → Execution (Phase 6)
```

### Phase Summary

| Phase | Regular | Critical | Hotfix |
|-------|---------|----------|--------|
| 1. Diagnosis | Full (cli-explore-agent) | Focused (direct grep) | Minimal (known issue) |
| 2. Impact | Comprehensive | Targeted | Critical path only |
| 3. Planning | Multiple strategies | Single best | Surgical fix |
| 4. Verification | Full test suite | Key scenarios | Smoke tests |
| 5. Confirmation | 4 dimensions | 3 dimensions | 2 dimensions |
| 6. Execution | Via lite-execute | Via lite-execute | Via lite-execute + monitoring |

---

## Detailed Phase Execution

### Phase 1: Diagnosis & Root Cause Analysis

**Goal**: Identify root cause and affected code paths

**Execution Strategy by Mode**:

**Regular Mode** - Comprehensive search:
```javascript
Task(
  subagent_type="cli-explore-agent",
  prompt=`
  Bug: ${bug_description}

  Execute diagnostic search:
  1. Search error message: Grep "${error}" --output_mode content
  2. Find related code: Glob "**/affected-module/**/*.{ts,js}"
  3. Trace execution path
  4. Check recent changes: git log --since="1 week ago"

  Return: Root cause hypothesis, affected paths, reproduction steps
  Time limit: 20 minutes
  `
)
```

**Critical Mode** - Direct targeted search:
```bash
grep -r '${error_message}' src/ --include='*.ts' -n | head -10
git log --oneline --since='1 week ago' -- '*affected*' | head -5
git blame ${suspected_file}
```

**Hotfix Mode** - Minimal search (assume known issue):
```bash
Read(suspected_file)  # User provides file path
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

### Phase 2: Impact Assessment

**Goal**: Quantify blast radius and risk level

**Risk Score Calculation**:
```javascript
risk_score = (user_impact × 0.4) + (system_risk × 0.3) + (business_impact × 0.3)

// Severity mapping
if (risk_score >= 8.0) severity = "critical"
else if (risk_score >= 5.0) severity = "high"
else if (risk_score >= 3.0) severity = "medium"
else severity = "low"
```

**Assessment Output**:
```javascript
{
  affected_users: {
    count: "5000 active users (100%)",
    severity: "high",
    workaround: "Re-login required"
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
  severity: "high"
}
```

**Auto-Severity Suggestion**:
If `risk_score >= 8.0` and user didn't provide `--critical`, suggest:
```
💡 Suggestion: Consider using --critical flag (risk score: 8.2/10)
```

**TodoWrite**: Mark Phase 2 completed, Phase 3 in_progress

---

### Phase 3: Fix Planning & Strategy Selection

**Goal**: Generate fix options with trade-off analysis

**Strategy Generation by Mode**:

**Regular Mode** - Multiple strategies (1-3 options):
```javascript
[
  {
    strategy: "immediate_patch",
    description: "Fix comparison operator",
    files: ["src/auth/tokenValidator.ts:47"],
    estimated_time: "15 minutes",
    risk: "low",
    pros: ["Quick fix", "Minimal change"],
    cons: ["Doesn't address token refresh"]
  },
  {
    strategy: "comprehensive_refactor",
    description: "Refactor token validation with proper refresh",
    files: ["src/auth/tokenValidator.ts", "src/auth/refreshToken.ts"],
    estimated_time: "2 hours",
    risk: "medium",
    pros: ["Addresses root cause"],
    cons: ["Longer implementation"]
  }
]
```

**Critical/Hotfix Mode** - Single best strategy:
```javascript
{
  strategy: "surgical_fix",
  description: "Minimal change to fix comparison",
  files: ["src/auth/tokenValidator.ts:47"],
  change: "currentTime > expiryTime → currentTime >= expiryTime",
  estimated_time: "5 minutes",
  risk: "minimal"
}
```

**Complexity Assessment & Planning**:
```javascript
complexity = assessComplexity(fix_strategies)

if (complexity === "low" || mode === "hotfix") {
  plan = generateSimplePlan(selected_strategy)  // Direct by Claude
} else if (complexity === "medium") {
  plan = Task(subagent_type="cli-lite-planning-agent", ...)
} else {
  suggestCommand("/workflow:plan --mode bugfix")
}
```

**Plan Output**:
```javascript
{
  summary: "Fix timestamp comparison in token validation",
  approach: "Update comparison operator",
  tasks: [{
    title: "Fix token expiration comparison",
    file: "src/auth/tokenValidator.ts",
    action: "Update",
    implementation: ["Locate validateToken", "Update line 47", "Add comment"],
    verification: ["Manual test at boundary", "Run auth tests"]
  }],
  estimated_time: "30 minutes",
  recommended_execution: "Agent"
}
```

**TodoWrite**: Mark Phase 3 completed, Phase 4 in_progress

---

### Phase 4: Verification Strategy

**Goal**: Define testing approach based on severity

**Test Strategy Selection**:

| Mode | Test Scope | Duration | Automation |
|------|------------|----------|------------|
| **Regular** | Full test suite | 10-20 min | `npm test` |
| **Critical** | Focused integration | 5-10 min | `npm test -- auth.test.ts` |
| **Hotfix** | Smoke tests | 2-5 min | `npm test -- auth.smoke.test.ts` |

**Branch Strategy**:

**Regular/Critical**:
```javascript
{
  type: "feature_branch",
  base: "main",
  name: "fix/token-expiration-edge-case",
  merge_target: "main"
}
```

**Hotfix**:
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

**Multi-Dimension Confirmation**:

**Regular Mode** (4 dimensions):
```javascript
AskUserQuestion({
  questions: [
    {
      question: "Confirm fix approach?",
      header: "Fix Confirmation",
      options: [
        { label: "Proceed", description: "Execute as planned" },
        { label: "Modify", description: "Adjust strategy" },
        { label: "Escalate", description: "Use /workflow:plan" }
      ]
    },
    {
      question: "Execution method:",
      header: "Execution",
      options: [
        { label: "Agent", description: "@code-developer" },
        { label: "CLI Tool", description: "Codex/Gemini" },
        { label: "Manual", description: "Provide plan only" }
      ]
    },
    {
      question: "Verification level:",
      header: "Testing",
      options: [
        { label: "Full Suite", description: "All tests" },
        { label: "Focused", description: "Affected tests" },
        { label: "Smoke Only", description: "Critical path" }
      ]
    },
    {
      question: "Post-fix review:",
      header: "Code Review",
      options: [
        { label: "Gemini", description: "AI review" },
        { label: "Skip", description: "Trust tests" }
      ]
    }
  ]
})
```

**Critical Mode** (3 dimensions - skip code review)

**Hotfix Mode** (2 dimensions - minimal confirmation):
```javascript
AskUserQuestion({
  questions: [
    {
      question: "Confirm hotfix deployment:",
      options: [
        { label: "Deploy", description: "Apply to production" },
        { label: "Stage First", description: "Test in staging" },
        { label: "Abort", description: "Cancel" }
      ]
    },
    {
      question: "Post-deployment monitoring:",
      options: [
        { label: "Real-time", description: "Monitor 15 minutes" },
        { label: "Passive", description: "Rely on alerts" }
      ]
    }
  ]
})
```

**TodoWrite**: Mark Phase 5 completed, Phase 6 in_progress

---

### Phase 6: Execution Dispatch & Follow-up

**Step 6.1: Dispatch to lite-execute**

```javascript
executionContext = {
  mode: "bugfix",
  severity: mode,  // "regular" | "critical" | "hotfix"
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
      title: "Replace hotfix with comprehensive fix",
      priority: "high",
      due_date: "within_3_days"
    },
    {
      id: `FOLLOWUP-${taskId}-postmortem`,
      title: "Incident postmortem",
      priority: "medium",
      due_date: "within_1_week"
    }
  ]

  Write(`.workflow/lite-fixes/${taskId}-followup.json`, follow_up_tasks)
}
```

**Step 6.3: Real-time Monitoring** (if selected)

```javascript
if (user_selection.monitoring === "real-time") {
  console.log(`
  📊 Real-time Monitoring Active (15 minutes)

  Metrics:
  - Error rate: <5%
  - Login success: >95%
  - Auth latency: <500ms

  Auto-rollback: Enabled
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
  severity: "low" | "medium" | "high" | "critical"
}
```

### fixPlan
```javascript
{
  strategy: string,
  summary: string,
  approach: string,
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

### executionContext (passed to lite-execute)
```javascript
{
  mode: "bugfix",
  severity: "regular" | "critical" | "hotfix",
  planObject: fixPlan,
  diagnosisContext: diagnosisContext,
  impactContext: impactContext,
  verificationStrategy: {...},
  branchStrategy: {...},
  executionMethod: string,
  monitoringLevel: string
}
```

---

## Best Practices

### Severity Selection Guide

**Use Regular Mode when:**
- Bug is not blocking critical functionality
- Have time for comprehensive testing (2-4 hours)
- Want to explore multiple fix strategies
- Can afford full test suite run

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
- Issue is well-understood

### Branching Best Practices

**Hotfix Branching**:
```bash
# ✅ Correct: Branch from production tag
git checkout -b hotfix/fix-name v2.3.1

# ❌ Wrong: Branch from main (unreleased code)
git checkout -b hotfix/fix-name main
```

**Merge Strategy**:
```bash
# Hotfix merges to both targets
git checkout main && git merge hotfix/fix-name
git checkout production && git merge hotfix/fix-name
git tag v2.3.2
```

### Follow-up Task Management

**Always create follow-up for hotfixes**:
- ✅ Comprehensive fix (within 3 days)
- ✅ Test coverage improvement
- ✅ Monitoring/alerting enhancements
- ✅ Documentation updates
- ✅ Postmortem (if critical)

---

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Root cause not found | Insufficient search | Expand search or escalate to /workflow:plan |
| Reproduction fails | Stale bug or env issue | Verify environment, request updated steps |
| Multiple causes | Complex interaction | Use /cli:discuss-plan for analysis |
| Fix too complex | High-risk refactor | Suggest /workflow:plan --mode refactor |
| Verification fails | Insufficient tests | Add test cases or adjust mode |

---

## Output Routing

**Lite-fix directory**:
```
.workflow/lite-fixes/
├── BUGFIX-2024-10-20T14-30-00.json          # Bug fix task JSON
├── BUGFIX-2024-10-20T14-30-00-followup.json # Follow-up tasks (hotfix)
└── diagnosis-cache/                          # Cached diagnosis
    └── auth-token-hash.json
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

### 1. Diagnosis Caching

Speed up similar issues:
```javascript
cache_key = hash(bug_keywords + recent_changes_hash)
cache_path = `.workflow/lite-fixes/diagnosis-cache/${cache_key}.json`

if (cache_exists && cache_age < 1_week) {
  diagnosis = load_from_cache()
}
```

### 2. Auto-Severity Detection

```javascript
if (bug_description.includes("production|down|critical|outage")) {
  suggested_flag = "--critical"
} else if (bug_description.includes("hotfix|urgent|incident")) {
  suggested_flag = "--hotfix"
}
```

### 3. Rollback Plan (Hotfix)

```javascript
rollback_plan = {
  method: "git_revert",
  commands: [
    "git revert ${commit_sha}",
    "git push origin hotfix/${branch}",
    "# Re-deploy v2.3.1"
  ],
  estimated_time: "5 minutes"
}
```

---

## Related Commands

**Diagnostic Commands**:
- `/cli:mode:bug-diagnosis` - Root cause analysis only
- `/cli:mode:code-analysis` - Execution path tracing

**Fix Execution**:
- `/workflow:lite-execute --in-memory` - Execute fix plan (called by lite-fix)
- `/cli:execute` - Direct implementation
- `/cli:codex-execute` - Multi-stage fix

**Planning Commands**:
- `/workflow:plan --mode bugfix` - Complex bug requiring comprehensive planning
- `/cli:discuss-plan` - Multi-model collaborative analysis

**Review Commands**:
- `/workflow:review --type quality` - Post-fix code review
- `/workflow:review --type security` - Security validation

---

## Comparison with Other Commands

| Command | Use Case | Time | Output |
|---------|----------|------|--------|
| `/workflow:lite-fix` | Bug fixes (regular to critical) | 15min-4h | In-memory + JSON |
| `/workflow:lite-plan` | New features | 1-6h | In-memory + JSON |
| `/workflow:plan` | Complex features | 1-5 days | Persistent session |
| `/cli:mode:bug-diagnosis` | Analysis only | 10-30min | Diagnostic report |

---

## Quality Gates

**Before execution**:
- [ ] Root cause identified (>80% confidence)
- [ ] Impact scope clearly defined
- [ ] Fix strategy reviewed and approved
- [ ] Verification plan matches risk level
- [ ] Branch strategy appropriate

**Hotfix-specific**:
- [ ] Incident ticket linked
- [ ] Incident commander approval
- [ ] Rollback plan documented
- [ ] Follow-up tasks generated
- [ ] Monitoring configured

---

## When to Use lite-fix

✅ **Good fit**:
- Clear bug symptom with reproduction steps
- Localized fix (1-3 files)
- Time-sensitive but not catastrophic
- Known technology stack

❌ **Poor fit**:
- Root cause unclear → use `/cli:mode:bug-diagnosis` first
- Requires architectural changes → use `/workflow:plan`
- Complex legacy code → use `/workflow:plan --legacy-refactor`
- Performance investigation → use `/workflow:plan --performance-optimization`
- Data migration needed → use `/workflow:plan --data-migration`

---

**Last Updated**: 2025-11-20
**Version**: 1.0.0
**Status**: Design Document
