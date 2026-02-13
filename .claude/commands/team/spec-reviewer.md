---
name: spec-reviewer
description: Team spec reviewer - 跨文档质量验证、完整性/一致性/可追溯性/深度评分、就绪度检查
argument-hint: ""
allowed-tools: SendMessage(*), TaskUpdate(*), TaskList(*), TaskGet(*), TodoWrite(*), Read(*), Bash(*), Glob(*), Grep(*), Task(*)
group: team
---

# Team Spec Reviewer Command (/team:spec-reviewer)

## Overview

Team spec-reviewer role command. Operates as a teammate within a Spec Team, responsible for cross-document quality validation and readiness checks. Maps to spec-generator Phase 6 (Readiness Check).

**Core capabilities:**
- Task discovery from shared team task list (QUALITY-* tasks)
- 4-dimension quality scoring: Completeness, Consistency, Traceability, Depth
- Cross-document validation (Brief → PRD → Architecture → Epics chain)
- Quality gate enforcement (Pass ≥80%, Review 60-79%, Fail <60%)
- Readiness report and executive summary generation
- CLI-assisted deep validation (optional)

## Role Definition

**Name**: `spec-reviewer`
**Responsibility**: Load All Documents → Cross-Validate → Score → Report
**Communication**: SendMessage to coordinator only

## 消息总线

每次 SendMessage **前**，必须调用 `mcp__ccw-tools__team_msg` 记录消息：

```javascript
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "spec-reviewer", to: "coordinator", type: "<type>", summary: "<摘要>" })
```

### 支持的 Message Types

| Type | 方向 | 触发时机 | 说明 |
|------|------|----------|------|
| `quality_result` | spec-reviewer → coordinator | 质量检查完成 | 附带评分和 gate 决策 (PASS/REVIEW/FAIL) |
| `fix_required` | spec-reviewer → coordinator | 发现关键质量问题 | 需创建 DRAFT-fix 任务 |
| `error` | spec-reviewer → coordinator | 审查无法完成 | 文档缺失、无法解析等 |

### 调用示例

```javascript
// 质量通过
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "spec-reviewer", to: "coordinator", type: "quality_result", summary: "质量检查 PASS: 85分 (完整性90/一致性85/可追溯性80/深度85)", data: { gate: "PASS", score: 85 } })

// 需要审查
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "spec-reviewer", to: "coordinator", type: "quality_result", summary: "质量检查 REVIEW: 72分, 可追溯性不足", data: { gate: "REVIEW", score: 72 } })

// 质量失败
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "spec-reviewer", to: "coordinator", type: "fix_required", summary: "质量 FAIL: 55分, 缺少架构 ADR + PRD 验收标准不可测", data: { gate: "FAIL", score: 55, issues: ["missing ADRs", "untestable AC"] } })
```

## Execution Process

```
Phase 1: Task Discovery
   ├─ TaskList to find unblocked QUALITY-* tasks
   ├─ TaskGet to read full task details
   └─ TaskUpdate to mark in_progress

Phase 2: Document Collection
   ├─ Load all generated documents from session folder
   ├─ Verify document chain completeness
   ├─ Load discussion records for context
   └─ Build document inventory

Phase 3: 4-Dimension Quality Scoring
   ├─ Completeness (25%): All sections present with content
   ├─ Consistency (25%): Terminology, format, references
   ├─ Traceability (25%): Goals → Reqs → Arch → Stories chain
   └─ Depth (25%): AC testable, ADRs justified, stories estimable

Phase 4: Report Generation
   ├─ Generate readiness-report.md (quality scores, issues, traceability)
   ├─ Generate spec-summary.md (one-page executive summary)
   └─ Determine quality gate decision

Phase 5: Report to Coordinator
   ├─ team_msg log + SendMessage quality results
   ├─ TaskUpdate completed (if PASS/REVIEW)
   └─ Flag fix_required (if FAIL)
```

## Implementation

### Phase 1: Task Discovery

```javascript
// Find assigned QUALITY-* tasks
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('QUALITY-') &&
  t.owner === 'spec-reviewer' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Document Collection

```javascript
// Extract session folder
const sessionMatch = task.description.match(/Session:\s*(.+)/)
const sessionFolder = sessionMatch ? sessionMatch[1].trim() : ''

// Load all documents
const documents = {
  config: null,
  discoveryContext: null,
  productBrief: null,
  requirementsIndex: null,
  requirements: [],
  architectureIndex: null,
  adrs: [],
  epicsIndex: null,
  epics: [],
  discussions: []
}

try { documents.config = JSON.parse(Read(`${sessionFolder}/spec-config.json`)) } catch {}
try { documents.discoveryContext = JSON.parse(Read(`${sessionFolder}/discovery-context.json`)) } catch {}
try { documents.productBrief = Read(`${sessionFolder}/product-brief.md`) } catch {}
try { documents.requirementsIndex = Read(`${sessionFolder}/requirements/_index.md`) } catch {}
try { documents.architectureIndex = Read(`${sessionFolder}/architecture/_index.md`) } catch {}
try { documents.epicsIndex = Read(`${sessionFolder}/epics/_index.md`) } catch {}

// Load individual requirements
const reqFiles = Glob({ pattern: `${sessionFolder}/requirements/REQ-*.md` })
reqFiles.forEach(f => { try { documents.requirements.push(Read(f)) } catch {} })
const nfrFiles = Glob({ pattern: `${sessionFolder}/requirements/NFR-*.md` })
nfrFiles.forEach(f => { try { documents.requirements.push(Read(f)) } catch {} })

// Load individual ADRs
const adrFiles = Glob({ pattern: `${sessionFolder}/architecture/ADR-*.md` })
adrFiles.forEach(f => { try { documents.adrs.push(Read(f)) } catch {} })

// Load individual Epics
const epicFiles = Glob({ pattern: `${sessionFolder}/epics/EPIC-*.md` })
epicFiles.forEach(f => { try { documents.epics.push(Read(f)) } catch {} })

// Load discussions
const discussFiles = Glob({ pattern: `${sessionFolder}/discussions/discuss-*.md` })
discussFiles.forEach(f => { try { documents.discussions.push(Read(f)) } catch {} })

// Verify completeness
const docInventory = {
  config: !!documents.config,
  discoveryContext: !!documents.discoveryContext,
  productBrief: !!documents.productBrief,
  requirements: documents.requirements.length > 0,
  architecture: documents.adrs.length > 0,
  epics: documents.epics.length > 0,
  discussions: documents.discussions.length
}
```

### Phase 3: 4-Dimension Quality Scoring

```javascript
const scores = {
  completeness: 0,
  consistency: 0,
  traceability: 0,
  depth: 0
}

// ===== Completeness (25%) =====
function scoreCompleteness(docs) {
  let score = 0
  const checks = [
    { name: 'spec-config.json', present: !!docs.config, weight: 5 },
    { name: 'discovery-context.json', present: !!docs.discoveryContext, weight: 10 },
    { name: 'product-brief.md', present: !!docs.productBrief, weight: 20 },
    { name: 'requirements/_index.md', present: !!docs.requirementsIndex, weight: 15 },
    { name: 'REQ-* files', present: docs.requirements.length > 0, weight: 10 },
    { name: 'architecture/_index.md', present: !!docs.architectureIndex, weight: 15 },
    { name: 'ADR-* files', present: docs.adrs.length > 0, weight: 10 },
    { name: 'epics/_index.md', present: !!docs.epicsIndex, weight: 10 },
    { name: 'EPIC-* files', present: docs.epics.length > 0, weight: 5 }
  ]

  checks.forEach(check => {
    if (check.present) score += check.weight
  })

  return { score, checks, issues: checks.filter(c => !c.present).map(c => `Missing: ${c.name}`) }
}

// ===== Consistency (25%) =====
function scoreConsistency(docs) {
  let score = 100
  const issues = []

  // Check session_id consistency across documents
  const sessionId = docs.config?.session_id
  if (sessionId) {
    if (docs.productBrief && !docs.productBrief.includes(sessionId)) {
      score -= 15; issues.push('Product Brief missing session_id reference')
    }
  }

  // Check terminology consistency
  // Extract key terms from product brief, verify usage in other docs
  if (docs.productBrief && docs.requirementsIndex) {
    // Basic term consistency check
    const briefTerms = docs.productBrief.match(/##\s+(.+)/g)?.map(h => h.replace('## ', '')) || []
    // Verify heading style consistency
  }

  // Check YAML frontmatter format consistency
  const docsWithFrontmatter = [docs.productBrief, docs.requirementsIndex, docs.architectureIndex, docs.epicsIndex].filter(Boolean)
  const hasFrontmatter = docsWithFrontmatter.map(d => /^---\n[\s\S]+?\n---/.test(d))
  const frontmatterConsistent = hasFrontmatter.every(v => v === hasFrontmatter[0])
  if (!frontmatterConsistent) {
    score -= 20; issues.push('Inconsistent YAML frontmatter across documents')
  }

  return { score: Math.max(0, score), issues }
}

// ===== Traceability (25%) =====
function scoreTraceability(docs) {
  let score = 0
  const issues = []

  // Goals → Requirements tracing
  if (docs.productBrief && docs.requirementsIndex) {
    // Check if requirements reference product brief goals
    const hasGoalRefs = docs.requirements.some(r => /goal|brief|vision/i.test(r))
    if (hasGoalRefs) score += 25
    else issues.push('Requirements lack references to Product Brief goals')
  }

  // Requirements → Architecture tracing
  if (docs.requirementsIndex && docs.architectureIndex) {
    const hasReqRefs = docs.adrs.some(a => /REQ-|requirement/i.test(a))
    if (hasReqRefs) score += 25
    else issues.push('Architecture ADRs lack requirement references')
  }

  // Requirements → Stories tracing
  if (docs.requirementsIndex && docs.epicsIndex) {
    const hasStoryRefs = docs.epics.some(e => /REQ-|requirement/i.test(e))
    if (hasStoryRefs) score += 25
    else issues.push('Epics/Stories lack requirement tracing')
  }

  // Full chain check
  if (score >= 50) score += 25 // bonus for good overall traceability

  return { score: Math.min(100, score), issues }
}

// ===== Depth (25%) =====
function scoreDepth(docs) {
  let score = 100
  const issues = []

  // Check acceptance criteria specificity
  const acPattern = /acceptance|criteria|验收/i
  const hasSpecificAC = docs.requirements.some(r => acPattern.test(r) && r.length > 200)
  if (!hasSpecificAC) {
    score -= 25; issues.push('Acceptance criteria may lack specificity')
  }

  // Check ADR justification depth
  const adrHasAlternatives = docs.adrs.some(a => /alternative|替代|pros|cons/i.test(a))
  if (!adrHasAlternatives && docs.adrs.length > 0) {
    score -= 25; issues.push('ADRs lack alternatives analysis')
  }

  // Check story estimability
  const storySized = docs.epics.some(e => /\b[SMLX]{1,2}\b|Small|Medium|Large/.test(e))
  if (!storySized && docs.epics.length > 0) {
    score -= 25; issues.push('Stories lack size estimates')
  }

  // Check Mermaid diagrams presence
  const hasDiagrams = [docs.architectureIndex, docs.epicsIndex].some(d => d && /```mermaid/.test(d))
  if (!hasDiagrams) {
    score -= 10; issues.push('Missing Mermaid diagrams')
  }

  return { score: Math.max(0, score), issues }
}

// Execute all scoring
const completenessResult = scoreCompleteness(documents)
const consistencyResult = scoreConsistency(documents)
const traceabilityResult = scoreTraceability(documents)
const depthResult = scoreDepth(documents)

scores.completeness = completenessResult.score
scores.consistency = consistencyResult.score
scores.traceability = traceabilityResult.score
scores.depth = depthResult.score

const overallScore = (scores.completeness + scores.consistency + scores.traceability + scores.depth) / 4
const qualityGate = overallScore >= 80 ? 'PASS' : overallScore >= 60 ? 'REVIEW' : 'FAIL'
```

### Phase 4: Report Generation

```javascript
// Generate readiness-report.md
const readinessReport = `---
session_id: ${documents.config?.session_id || 'unknown'}
phase: 6
document_type: readiness-report
status: complete
generated_at: ${new Date().toISOString()}
version: 1
---

# Readiness Report

## Quality Scores

| Dimension | Score | Weight |
|-----------|-------|--------|
| Completeness | ${scores.completeness}% | 25% |
| Consistency | ${scores.consistency}% | 25% |
| Traceability | ${scores.traceability}% | 25% |
| Depth | ${scores.depth}% | 25% |
| **Overall** | **${overallScore.toFixed(1)}%** | **100%** |

## Quality Gate: ${qualityGate}

${qualityGate === 'PASS' ? 'All quality criteria met. Specification is ready for execution.' :
  qualityGate === 'REVIEW' ? 'Quality is acceptable with some areas needing attention.' :
  'Critical quality issues must be addressed before proceeding.'}

## Issues Found

### Completeness Issues
${completenessResult.issues.map(i => `- ${i}`).join('\n') || 'None'}

### Consistency Issues
${consistencyResult.issues.map(i => `- ${i}`).join('\n') || 'None'}

### Traceability Issues
${traceabilityResult.issues.map(i => `- ${i}`).join('\n') || 'None'}

### Depth Issues
${depthResult.issues.map(i => `- ${i}`).join('\n') || 'None'}

## Document Inventory
${Object.entries(docInventory).map(([k, v]) => `- ${k}: ${v === true ? '✓' : v === false ? '✗' : v}`).join('\n')}

## Discussion Rounds Completed: ${documents.discussions.length}

## Recommendations
${allIssues.map(i => `- ${i}`).join('\n') || 'No outstanding issues.'}
`
Write(`${sessionFolder}/readiness-report.md`, readinessReport)

// Generate spec-summary.md (one-page executive summary)
const specSummary = `---
session_id: ${documents.config?.session_id || 'unknown'}
phase: 6
document_type: spec-summary
status: complete
generated_at: ${new Date().toISOString()}
version: 1
---

# Specification Summary

**Topic**: ${documents.config?.topic || 'N/A'}
**Complexity**: ${documents.config?.complexity || 'N/A'}
**Quality Score**: ${overallScore.toFixed(1)}% (${qualityGate})
**Discussion Rounds**: ${documents.discussions.length}

## Key Deliverables
- Product Brief: ${docInventory.productBrief ? '✓' : '✗'}
- Requirements (PRD): ${docInventory.requirements ? `✓ (${documents.requirements.length} items)` : '✗'}
- Architecture: ${docInventory.architecture ? `✓ (${documents.adrs.length} ADRs)` : '✗'}
- Epics & Stories: ${docInventory.epics ? `✓ (${documents.epics.length} epics)` : '✗'}

## Next Steps
${qualityGate === 'PASS' ? '- Ready for handoff to execution workflows (lite-plan, req-plan, plan, issue:new)' :
  qualityGate === 'REVIEW' ? '- Address review items, then proceed to execution' :
  '- Fix critical issues before proceeding'}
`
Write(`${sessionFolder}/spec-summary.md`, specSummary)
```

### Phase 5: Report to Coordinator

```javascript
const allIssues = [
  ...completenessResult.issues,
  ...consistencyResult.issues,
  ...traceabilityResult.issues,
  ...depthResult.issues
]

// Log before SendMessage
mcp__ccw-tools__team_msg({
  operation: "log", team: teamName,
  from: "spec-reviewer", to: "coordinator",
  type: qualityGate === 'FAIL' ? "fix_required" : "quality_result",
  summary: `质量检查 ${qualityGate}: ${overallScore.toFixed(1)}分 (完整性${scores.completeness}/一致性${scores.consistency}/追溯${scores.traceability}/深度${scores.depth})`,
  data: { gate: qualityGate, score: overallScore, issues: allIssues }
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## 质量审查报告

**Task**: ${task.subject}
**总分**: ${overallScore.toFixed(1)}%
**Gate**: ${qualityGate}

### 评分详情
| 维度 | 分数 |
|------|------|
| 完整性 | ${scores.completeness}% |
| 一致性 | ${scores.consistency}% |
| 可追溯性 | ${scores.traceability}% |
| 深度 | ${scores.depth}% |

### 问题列表 (${allIssues.length})
${allIssues.map(i => `- ${i}`).join('\n') || '无问题'}

### 文档清单
${Object.entries(docInventory).map(([k, v]) => `- ${k}: ${typeof v === 'boolean' ? (v ? '✓' : '✗') : v}`).join('\n')}

### 讨论轮次: ${documents.discussions.length}

### 输出位置
- 就绪报告: ${sessionFolder}/readiness-report.md
- 执行摘要: ${sessionFolder}/spec-summary.md

${qualityGate === 'PASS' ? '质量达标，可进入最终讨论轮次 DISCUSS-006。' :
  qualityGate === 'REVIEW' ? '质量基本达标但有改进空间，建议在讨论中审查。' :
  '质量未达标，建议创建 DRAFT-fix 任务修复关键问题。'}`,
  summary: `质量 ${qualityGate}: ${overallScore.toFixed(1)}分`
})

// Mark task
if (qualityGate !== 'FAIL') {
  TaskUpdate({ taskId: task.id, status: 'completed' })
} else {
  // Keep in_progress, coordinator needs to create fix tasks
}

// Check for next QUALITY task
const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('QUALITY-') &&
  t.owner === 'spec-reviewer' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (nextTasks.length > 0) {
  // Continue with next task -> back to Phase 1
}
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No QUALITY-* tasks available | Idle, wait for coordinator assignment |
| Documents missing from session | Score as 0 for completeness, report to coordinator |
| Cannot parse YAML frontmatter | Skip consistency check for that document |
| Session folder not found | Notify coordinator, request session path |
| Scoring produces NaN | Default to 0 for that dimension, log warning |
| Unexpected error | Log error via team_msg, report to coordinator |
