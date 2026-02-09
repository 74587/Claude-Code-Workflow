---
name: review
description: Team reviewer - 代码质量/安全/架构审查、需求验证、发现报告给coordinator
argument-hint: ""
allowed-tools: SendMessage(*), TaskUpdate(*), TaskList(*), TaskGet(*), TodoWrite(*), Read(*), Bash(*), Glob(*), Grep(*), Task(*)
group: team
---

# Team Review Command (/team:review)

## Overview

Team reviewer role command. Operates as a teammate within an Agent Team (typically handled by the tester), responsible for multi-dimensional code review and requirement verification. Reports findings to the coordinator with severity classification.

**Core capabilities:**
- Task discovery from shared team task list (REVIEW-* tasks)
- Multi-dimensional review: quality, security, architecture, requirement verification
- Pattern-based security scanning with Grep
- Acceptance criteria verification against plan
- Severity-classified findings (critical/high/medium/low)
- Optional CLI-assisted deep analysis (Gemini/Qwen)

## Role Definition

**Name**: `tester` (same teammate handles both TEST and REVIEW tasks)
**Responsibility**: Review code changes → Verify requirements → Report findings
**Communication**: SendMessage to coordinator only

## 消息总线

每次 SendMessage **前**，必须调用 `mcp__ccw-tools__team_msg` 记录消息：

```javascript
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "tester", to: "coordinator", type: "<type>", summary: "<摘要>" })
```

### 支持的 Message Types

| Type | 方向 | 触发时机 | 说明 |
|------|------|----------|------|
| `review_result` | tester → coordinator | 审查完成 | 附带 verdict（APPROVE/CONDITIONAL/BLOCK）和发现统计 |
| `fix_required` | tester → coordinator | 发现 critical issues | 需要创建 IMPL-fix 任务给 executor |
| `error` | tester → coordinator | 审查无法完成 | Plan 缺失、变更文件无法读取等 |

### 调用示例

```javascript
// 审查通过
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "tester", to: "coordinator", type: "review_result", summary: "REVIEW-001: APPROVE, 2 medium + 1 low findings", data: { verdict: "APPROVE", critical: 0, high: 0, medium: 2, low: 1 } })

// 审查有条件通过
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "tester", to: "coordinator", type: "review_result", summary: "REVIEW-001: CONDITIONAL, 4 high severity findings需关注", data: { verdict: "CONDITIONAL", critical: 0, high: 4, medium: 3, low: 2 } })

// 发现 critical 问题
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "tester", to: "coordinator", type: "fix_required", summary: "发现eval()使用和硬编码密码, 需立即修复", data: { critical: 2, details: ["eval() in auth.ts:42", "hardcoded password in config.ts:15"] } })

// 错误上报
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "tester", to: "coordinator", type: "error", summary: "plan.json未找到, 无法进行需求验证" })
```

## Execution Process

```
Phase 1: Task Discovery
   ├─ TaskList to find unblocked REVIEW-* tasks assigned to me
   ├─ TaskGet to read full task details
   └─ TaskUpdate to mark in_progress

Phase 2: Review Context Loading
   ├─ Read plan.json (requirements + acceptance criteria)
   ├─ git diff to get changed files
   ├─ Read test results (if available)
   └─ Read changed file contents

Phase 3: Multi-Dimensional Review
   ├─ Quality: code style, maintainability, @ts-ignore/any usage
   ├─ Security: eval/exec/innerHTML/hardcoded secrets (Grep patterns)
   ├─ Architecture: layering compliance, modularity, tech debt
   ├─ Requirement Verification: plan acceptance criteria vs implementation
   └─ Optional: CLI deep analysis (Gemini for security, Qwen for architecture)

Phase 4: Finding Summary
   ├─ Classify by severity: critical/high/medium/low
   ├─ Generate actionable recommendations
   └─ Determine overall verdict

Phase 5: Report to Coordinator
   ├─ SendMessage with review findings
   ├─ No critical issues → mark REVIEW task completed
   └─ Critical issues → flag for immediate attention
```

## Implementation

### Phase 1: Task Discovery

```javascript
// Find my assigned REVIEW tasks
const tasks = TaskList()
const myReviewTasks = tasks.filter(t =>
  t.subject.startsWith('REVIEW-') &&
  t.owner === 'tester' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myReviewTasks.length === 0) return // idle

const task = TaskGet({ taskId: myReviewTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Review Context Loading

```javascript
// Load plan for acceptance criteria
const planPathMatch = task.description.match(/\.workflow\/\.team-plan\/[^\s]+\/plan\.json/)
let plan = null
if (planPathMatch) {
  try { plan = JSON.parse(Read(planPathMatch[0])) } catch {}
}

// Get changed files via git
const changedFiles = Bash(`git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached`)
  .split('\n')
  .filter(f => f.trim() && !f.startsWith('.'))

// Read changed file contents for review
const fileContents = {}
for (const file of changedFiles.slice(0, 20)) { // limit to 20 files
  try { fileContents[file] = Read(file) } catch {}
}

// Load test results if available
let testResults = null
const testSummary = tasks.find(t => t.subject.startsWith('TEST-') && t.status === 'completed')
```

### Phase 3: Multi-Dimensional Review

```javascript
const findings = {
  critical: [],
  high: [],
  medium: [],
  low: []
}

// --- Quality Review ---
function reviewQuality(files) {
  const issues = []

  // Check for @ts-ignore, @ts-expect-error, any type
  const tsIgnore = Grep({ pattern: '@ts-ignore|@ts-expect-error', glob: '*.{ts,tsx}', output_mode: 'content' })
  if (tsIgnore) issues.push({ type: 'quality', detail: '@ts-ignore/@ts-expect-error usage detected', severity: 'medium' })

  const anyType = Grep({ pattern: ': any[^A-Z]|as any', glob: '*.{ts,tsx}', output_mode: 'content' })
  if (anyType) issues.push({ type: 'quality', detail: 'Untyped `any` usage detected', severity: 'medium' })

  // Check for console.log left in production code
  const consoleLogs = Grep({ pattern: 'console\\.log', glob: '*.{ts,tsx,js,jsx}', path: 'src/', output_mode: 'content' })
  if (consoleLogs) issues.push({ type: 'quality', detail: 'console.log found in source code', severity: 'low' })

  // Check for empty catch blocks
  const emptyCatch = Grep({ pattern: 'catch\\s*\\([^)]*\\)\\s*\\{\\s*\\}', glob: '*.{ts,tsx,js,jsx}', output_mode: 'content', multiline: true })
  if (emptyCatch) issues.push({ type: 'quality', detail: 'Empty catch blocks detected', severity: 'high' })

  return issues
}

// --- Security Review ---
function reviewSecurity(files) {
  const issues = []

  // Dangerous functions
  const dangerousFns = Grep({ pattern: '\\beval\\b|\\bexec\\b|innerHTML|dangerouslySetInnerHTML', glob: '*.{ts,tsx,js,jsx}', output_mode: 'content' })
  if (dangerousFns) issues.push({ type: 'security', detail: 'Dangerous function usage: eval/exec/innerHTML', severity: 'critical' })

  // Hardcoded secrets
  const secrets = Grep({ pattern: 'password\\s*=\\s*["\']|secret\\s*=\\s*["\']|api_key\\s*=\\s*["\']', glob: '*.{ts,tsx,js,jsx,py}', output_mode: 'content', '-i': true })
  if (secrets) issues.push({ type: 'security', detail: 'Hardcoded secrets/passwords detected', severity: 'critical' })

  // SQL injection risk
  const sqlInjection = Grep({ pattern: 'query\\s*\\(\\s*`|execute\\s*\\(\\s*`|\\$\\{.*\\}.*(?:SELECT|INSERT|UPDATE|DELETE)', glob: '*.{ts,js,py}', output_mode: 'content', '-i': true })
  if (sqlInjection) issues.push({ type: 'security', detail: 'Potential SQL injection via template literals', severity: 'critical' })

  // XSS via user input
  const xssRisk = Grep({ pattern: 'document\\.write|window\\.location\\s*=', glob: '*.{ts,tsx,js,jsx}', output_mode: 'content' })
  if (xssRisk) issues.push({ type: 'security', detail: 'Potential XSS vectors detected', severity: 'high' })

  return issues
}

// --- Architecture Review ---
function reviewArchitecture(files) {
  const issues = []

  // Circular dependency indicators
  // Check for imports that may create cycles
  for (const [file, content] of Object.entries(fileContents)) {
    const imports = content.match(/from\s+['"]([^'"]+)['"]/g) || []
    // Basic heuristic: component importing from parent directory
    const parentImports = imports.filter(i => i.includes('../..'))
    if (parentImports.length > 2) {
      issues.push({ type: 'architecture', detail: `${file}: excessive parent directory imports (possible layering violation)`, severity: 'medium' })
    }
  }

  // Large file detection
  for (const [file, content] of Object.entries(fileContents)) {
    const lines = content.split('\n').length
    if (lines > 500) {
      issues.push({ type: 'architecture', detail: `${file}: ${lines} lines - consider splitting`, severity: 'low' })
    }
  }

  return issues
}

// --- Requirement Verification ---
function verifyRequirements(plan) {
  const issues = []
  if (!plan) {
    issues.push({ type: 'requirement', detail: 'No plan found for requirement verification', severity: 'medium' })
    return issues
  }

  for (const planTask of plan.tasks) {
    for (const criterion of (planTask.acceptance || [])) {
      // Check if criterion appears to be met
      // This is a heuristic check - look for relevant code in changed files
      const keywords = criterion.toLowerCase().split(/\s+/).filter(w => w.length > 4)
      const hasEvidence = keywords.some(kw =>
        Object.values(fileContents).some(content => content.toLowerCase().includes(kw))
      )

      if (!hasEvidence) {
        issues.push({
          type: 'requirement',
          detail: `Acceptance criterion may not be met: "${criterion}" (task: ${planTask.title})`,
          severity: 'high'
        })
      }
    }
  }

  return issues
}

// Execute all review dimensions
const qualityIssues = reviewQuality(changedFiles)
const securityIssues = reviewSecurity(changedFiles)
const architectureIssues = reviewArchitecture(changedFiles)
const requirementIssues = plan ? verifyRequirements(plan) : []

// Classify into severity buckets
const allIssues = [...qualityIssues, ...securityIssues, ...architectureIssues, ...requirementIssues]
allIssues.forEach(issue => {
  findings[issue.severity].push(issue)
})
```

### Phase 4: Finding Summary

```javascript
const totalIssues = Object.values(findings).flat().length
const hasCritical = findings.critical.length > 0

const verdict = hasCritical
  ? 'BLOCK - Critical issues must be resolved'
  : findings.high.length > 3
    ? 'CONDITIONAL - High severity issues should be addressed'
    : 'APPROVE - No blocking issues found'

const recommendations = []
if (hasCritical) {
  recommendations.push('Fix all critical security issues before merging')
}
if (findings.high.length > 0) {
  recommendations.push('Address high severity issues in a follow-up')
}
if (findings.medium.length > 3) {
  recommendations.push('Consider refactoring to reduce medium severity issues')
}
```

### Phase 5: Report to Coordinator

```javascript
SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## Code Review Report

**Task**: ${task.subject}
**Verdict**: ${verdict}
**Files Reviewed**: ${changedFiles.length}
**Total Findings**: ${totalIssues}

### Finding Summary
- Critical: ${findings.critical.length}
- High: ${findings.high.length}
- Medium: ${findings.medium.length}
- Low: ${findings.low.length}

${findings.critical.length > 0 ? `### Critical Issues
${findings.critical.map(f => `- [${f.type.toUpperCase()}] ${f.detail}`).join('\n')}
` : ''}
${findings.high.length > 0 ? `### High Severity
${findings.high.map(f => `- [${f.type.toUpperCase()}] ${f.detail}`).join('\n')}
` : ''}
${findings.medium.length > 0 ? `### Medium Severity
${findings.medium.map(f => `- [${f.type.toUpperCase()}] ${f.detail}`).join('\n')}
` : ''}
### Recommendations
${recommendations.map(r => `- ${r}`).join('\n')}

${plan ? `### Requirement Verification
${plan.tasks.map(t => `- **${t.title}**: ${requirementIssues.filter(i => i.detail.includes(t.title)).length === 0 ? 'Criteria met' : 'Needs verification'}`).join('\n')}
` : ''}`,
  summary: `Review: ${verdict.split(' - ')[0]} (${totalIssues} findings)`
})

// Mark task based on verdict
if (!hasCritical) {
  TaskUpdate({ taskId: task.id, status: 'completed' })
} else {
  // Keep in_progress, coordinator needs to create fix tasks
  SendMessage({
    type: "message",
    recipient: "coordinator",
    content: `Critical issues found in review. Recommend creating IMPL-fix tasks for executor to address: ${findings.critical.map(f => f.detail).join('; ')}`,
    summary: "Critical issues need fix tasks"
  })
}

// Check for next REVIEW task
const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('REVIEW-') &&
  t.owner === 'tester' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (nextTasks.length > 0) {
  // Continue with next task
}
```

## Optional: CLI Deep Analysis

For complex reviews, the tester can invoke CLI tools for deeper analysis:

```bash
# Security deep analysis (Gemini)
ccw cli -p "
PURPOSE: Deep security audit of implementation changes
TASK: Scan for OWASP Top 10 vulnerabilities, injection flaws, auth bypass vectors
CONTEXT: @src/**/*.{ts,tsx,js,jsx}
EXPECTED: Security findings with severity, file:line references, remediation
CONSTRAINTS: Focus on changed files only
" --tool gemini --mode analysis

# Architecture deep analysis (Qwen)
ccw cli -p "
PURPOSE: Architecture compliance review
TASK: Evaluate layering, modularity, separation of concerns
CONTEXT: @src/**/*
EXPECTED: Architecture assessment with recommendations
CONSTRAINTS: Focus on changed modules
" --tool qwen --mode analysis
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Plan file not found | Review without requirement verification, note in report |
| No changed files detected | Report to coordinator, may need manual file list |
| Grep pattern errors | Skip specific check, continue with remaining |
| CLI analysis timeout | Report partial results, note incomplete analysis |
| Too many files to review (> 50) | Focus on source files, skip generated/vendor files |
| Cannot determine file content | Skip file, note in report |
