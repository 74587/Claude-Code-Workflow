---
name: spec-writer
description: Team spec writer - 产品简报/需求文档/架构文档/史诗故事撰写、模板驱动文档生成
argument-hint: ""
allowed-tools: SendMessage(*), TaskUpdate(*), TaskList(*), TaskGet(*), TodoWrite(*), Read(*), Write(*), Edit(*), Bash(*), Glob(*), Grep(*), Task(*)
group: team
---

# Team Spec Writer Command (/team:spec-writer)

## Overview

Team spec-writer role command. Operates as a teammate within a Spec Team, responsible for generating all specification documents. Maps to spec-generator Phases 2-5 (Product Brief, Requirements, Architecture, Epics & Stories).

**Core capabilities:**
- Task discovery from shared team task list (DRAFT-* tasks)
- Complexity-adaptive writing (Low → direct, Medium/High → multi-CLI analysis)
- Multi-perspective document generation (产品/技术/用户 parallel analysis)
- Template-driven output following spec-generator document standards
- Discussion feedback incorporation for iterative refinement

## Role Definition

**Name**: `spec-writer`
**Responsibility**: Load Context → Generate Document → Incorporate Feedback → Report
**Communication**: SendMessage to coordinator only

## 消息总线

每次 SendMessage **前**，必须调用 `mcp__ccw-tools__team_msg` 记录消息：

```javascript
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "spec-writer", to: "coordinator", type: "<type>", summary: "<摘要>", ref: "<文件路径>" })
```

### 支持的 Message Types

| Type | 方向 | 触发时机 | 说明 |
|------|------|----------|------|
| `draft_ready` | spec-writer → coordinator | 文档撰写完成 | 附带文档路径和类型 |
| `draft_revision` | spec-writer → coordinator | 文档修订后重新提交 | 说明修改内容 |
| `impl_progress` | spec-writer → coordinator | 长时间撰写进展 | 多文档阶段进度 |
| `error` | spec-writer → coordinator | 遇到不可恢复错误 | 模板缺失、上下文不足等 |

### 调用示例

```javascript
// 文档就绪
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "spec-writer", to: "coordinator", type: "draft_ready", summary: "Product Brief 完成: 8个章节, 3视角合成", ref: ".workflow/.spec-team/session/product-brief.md" })

// 文档修订
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "spec-writer", to: "coordinator", type: "draft_revision", summary: "PRD 已按讨论反馈修订: 新增2个NFR, 调整3个优先级" })

// 错误上报
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "spec-writer", to: "coordinator", type: "error", summary: "缺少 discovery-context.json, 无法生成 Product Brief" })
```

## Execution Process

```
Phase 1: Task Discovery
   ├─ TaskList to find unblocked DRAFT-* tasks
   ├─ TaskGet to read full task details
   └─ TaskUpdate to mark in_progress

Phase 2: Context & Discussion Loading
   ├─ Read session config (spec-config.json)
   ├─ Read relevant prior documents and discussion records
   ├─ Determine document type from task subject (Brief/PRD/Architecture/Epics)
   └─ Load discussion feedback (discuss-*.md)

Phase 3: Document Generation (type-specific)
   ├─ DRAFT-001: Product Brief (multi-CLI parallel analysis)
   ├─ DRAFT-002: Requirements/PRD (functional + non-functional + MoSCoW)
   ├─ DRAFT-003: Architecture (ADRs + tech stack + diagrams)
   └─ DRAFT-004: Epics & Stories (decomposition + dependencies + MVP)

Phase 4: Self-Validation
   ├─ Check all template sections populated
   ├─ Verify cross-references to prior documents
   └─ Validate YAML frontmatter completeness

Phase 5: Report to Coordinator
   ├─ team_msg log + SendMessage document summary
   ├─ TaskUpdate completed
   └─ Check for next DRAFT-* task
```

## Implementation

### Phase 1: Task Discovery

```javascript
// Find assigned DRAFT-* tasks
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('DRAFT-') &&
  t.owner === 'spec-writer' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Context & Discussion Loading

```javascript
// Extract session folder from task description
const sessionMatch = task.description.match(/Session:\s*(.+)/)
const sessionFolder = sessionMatch ? sessionMatch[1].trim() : ''

// Load session config
let specConfig = null
try { specConfig = JSON.parse(Read(`${sessionFolder}/spec-config.json`)) } catch {}

// Determine document type from task subject
const docType = task.subject.includes('Product Brief') ? 'product-brief'
  : task.subject.includes('Requirements') || task.subject.includes('PRD') ? 'requirements'
  : task.subject.includes('Architecture') ? 'architecture'
  : task.subject.includes('Epics') ? 'epics'
  : 'unknown'

// Load discussion feedback (from preceding DISCUSS task)
const discussionFiles = {
  'product-brief': 'discussions/discuss-001-scope.md',
  'requirements': 'discussions/discuss-002-brief.md',
  'architecture': 'discussions/discuss-003-requirements.md',
  'epics': 'discussions/discuss-004-architecture.md'
}
let discussionFeedback = null
try {
  discussionFeedback = Read(`${sessionFolder}/${discussionFiles[docType]}`)
} catch {}

// Load prior documents
const priorDocs = {}
if (docType !== 'product-brief') {
  try { priorDocs.discoveryContext = Read(`${sessionFolder}/discovery-context.json`) } catch {}
}
if (docType === 'requirements' || docType === 'architecture' || docType === 'epics') {
  try { priorDocs.productBrief = Read(`${sessionFolder}/product-brief.md`) } catch {}
}
if (docType === 'architecture' || docType === 'epics') {
  try { priorDocs.requirementsIndex = Read(`${sessionFolder}/requirements/_index.md`) } catch {}
}
if (docType === 'epics') {
  try { priorDocs.architectureIndex = Read(`${sessionFolder}/architecture/_index.md`) } catch {}
}
```

### Phase 3: Document Generation

```javascript
// Route to specific generation logic based on document type
switch (docType) {
  case 'product-brief':
    await generateProductBrief(sessionFolder, specConfig, discussionFeedback)
    break
  case 'requirements':
    await generateRequirements(sessionFolder, specConfig, priorDocs, discussionFeedback)
    break
  case 'architecture':
    await generateArchitecture(sessionFolder, specConfig, priorDocs, discussionFeedback)
    break
  case 'epics':
    await generateEpics(sessionFolder, specConfig, priorDocs, discussionFeedback)
    break
}
```

#### DRAFT-001: Product Brief (Multi-Perspective Analysis)

```javascript
async function generateProductBrief(sessionFolder, config, discussionFeedback) {
  const discoveryContext = JSON.parse(Read(`${sessionFolder}/discovery-context.json`))
  const topic = config?.topic || discoveryContext.seed_analysis.problem_statement

  // 进展通知
  mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "spec-writer", to: "coordinator", type: "impl_progress", summary: "开始 Product Brief 多视角分析 (1/3)" })

  // Launch 3 parallel CLI analyses for multi-perspective synthesis
  // 1. Product perspective (Gemini)
  Bash({
    command: `ccw cli -p "PURPOSE: Analyze from PRODUCT perspective for specification.
TASK: • Market fit analysis • Value proposition • Success criteria • Competitive landscape
TOPIC: ${topic}
CONTEXT: Discovery findings: ${JSON.stringify(discoveryContext.seed_analysis)}
${discussionFeedback ? `DISCUSSION FEEDBACK: ${discussionFeedback}` : ''}
EXPECTED: Structured product analysis (vision, problem, goals, scope, constraints)
CONSTRAINTS: Focus on product strategy" --tool gemini --mode analysis`,
    run_in_background: true
  })

  // 2. Technical perspective (Codex)
  Bash({
    command: `ccw cli -p "PURPOSE: Analyze from TECHNICAL perspective for specification.
TASK: • Technical feasibility • Architecture constraints • Tech stack recommendations • Implementation risks
TOPIC: ${topic}
CONTEXT: Discovery findings: ${JSON.stringify(discoveryContext.seed_analysis)}
${discoveryContext.codebase_context ? `CODEBASE: ${JSON.stringify(discoveryContext.codebase_context)}` : ''}
EXPECTED: Technical feasibility assessment
CONSTRAINTS: Focus on engineering perspective" --tool codex --mode analysis`,
    run_in_background: true
  })

  // 3. User perspective (Claude)
  Bash({
    command: `ccw cli -p "PURPOSE: Analyze from USER perspective for specification.
TASK: • User personas • User journeys • UX considerations • Accessibility needs
TOPIC: ${topic}
CONTEXT: Target users: ${JSON.stringify(discoveryContext.seed_analysis.target_users)}
EXPECTED: User experience analysis (personas, journeys, pain points)
CONSTRAINTS: Focus on end-user perspective" --tool claude --mode analysis`,
    run_in_background: true
  })

  // Wait for all 3 analyses to complete, then synthesize

  // Generate product-brief.md with YAML frontmatter
  const brief = `---
session_id: ${config.session_id}
phase: 2
document_type: product-brief
status: draft
generated_at: ${new Date().toISOString()}
version: 1
dependencies:
  - discovery-context.json
  - discuss-001-scope.md
---

# Product Brief: ${topic}

## Vision
${productPerspective.vision}

## Problem Statement
${discoveryContext.seed_analysis.problem_statement}

## Target Users
${personas.map(p => `### ${p.name}\n- **Role**: ${p.role}\n- **Pain Points**: ${p.painPoints}\n- **Goals**: ${p.goals}`).join('\n\n')}

## Goals & Success Metrics
${productPerspective.goals}

## Scope
### In Scope
${productPerspective.inScope}

### Out of Scope
${productPerspective.outOfScope}

## Technical Feasibility
${technicalPerspective.summary}

## User Experience Considerations
${userPerspective.summary}

## Multi-Perspective Synthesis
### Convergent Themes
${synthesis.convergent}

### Divergent Views
${synthesis.divergent}

### Discussion Feedback Integration
${discussionFeedback ? discussionFeedback.summary : 'N/A (first draft)'}

## Constraints
${discoveryContext.seed_analysis.constraints.map(c => `- ${c}`).join('\n')}

## Open Questions
${openQuestions.map(q => `- ${q}`).join('\n')}
`
  Write(`${sessionFolder}/product-brief.md`, brief)
}
```

#### DRAFT-002: Requirements/PRD

```javascript
async function generateRequirements(sessionFolder, config, priorDocs, discussionFeedback) {
  // Use Gemini CLI to expand requirements from product brief
  Bash({
    command: `ccw cli -p "PURPOSE: Generate functional and non-functional requirements from Product Brief.
TASK:
• Extract functional requirements (REQ-NNN format) with user stories and acceptance criteria
• Generate non-functional requirements (NFR-{type}-NNN) for Performance/Security/Scalability/Usability
• Apply MoSCoW prioritization (Must/Should/Could/Won't)
• Create traceability matrix to Product Brief goals
CONTEXT: Product Brief: ${priorDocs.productBrief}
${discussionFeedback ? `DISCUSSION FEEDBACK: ${discussionFeedback}` : ''}
EXPECTED: Structured requirements list in JSON
CONSTRAINTS: Each requirement needs ID, title, user story, 2-4 acceptance criteria" --tool gemini --mode analysis`,
    run_in_background: true
  })

  // Generate requirements/ directory structure
  Bash(`mkdir -p ${sessionFolder}/requirements`)

  // Write _index.md + individual REQ-*.md + NFR-*.md files
  // Following spec-generator templates/requirements-prd.md format
}
```

#### DRAFT-003: Architecture

```javascript
async function generateArchitecture(sessionFolder, config, priorDocs, discussionFeedback) {
  // Generate architecture via Gemini
  Bash({
    command: `ccw cli -p "PURPOSE: Design system architecture based on requirements.
TASK:
• Select architecture style with justification
• Define core components and responsibilities
• Create component interaction diagram (Mermaid)
• Choose tech stack (languages, frameworks, databases, infrastructure)
• Generate 2-4 ADRs with alternatives and pros/cons
• Design data model (Mermaid erDiagram)
• Define security architecture
CONTEXT: Requirements: ${priorDocs.requirementsIndex}
Product Brief: ${priorDocs.productBrief}
${discussionFeedback ? `DISCUSSION FEEDBACK: ${discussionFeedback}` : ''}
EXPECTED: Complete architecture document
CONSTRAINTS: Include ADRs with alternatives" --tool gemini --mode analysis`,
    run_in_background: true
  })

  // Challenge architecture via Codex
  Bash({
    command: `ccw cli -p "PURPOSE: Challenge and review proposed architecture.
TASK: • Review ADR alternatives • Identify bottlenecks • Assess security gaps • Rate quality (1-5)
CONTEXT: [architecture output from above]
EXPECTED: Architecture review with ratings" --tool codex --mode analysis`,
    run_in_background: true
  })

  // Generate architecture/ directory
  Bash(`mkdir -p ${sessionFolder}/architecture`)

  // Write _index.md + ADR-*.md files
}
```

#### DRAFT-004: Epics & Stories

```javascript
async function generateEpics(sessionFolder, config, priorDocs, discussionFeedback) {
  // Decompose via Gemini
  Bash({
    command: `ccw cli -p "PURPOSE: Decompose requirements into Epics and Stories.
TASK:
• Group 3-7 logical Epics by domain or user journey
• Generate 2-5 Stories per Epic (user story format)
• Create cross-Epic dependency map (Mermaid)
• Define MVP scope with done criteria
• Recommend execution order
CONTEXT: Requirements: ${priorDocs.requirementsIndex}
Architecture: ${priorDocs.architectureIndex}
Product Brief: ${priorDocs.productBrief}
${discussionFeedback ? `DISCUSSION FEEDBACK: ${discussionFeedback}` : ''}
EXPECTED: Epic/Story decomposition with dependencies
CONSTRAINTS: Each story needs AC, size estimate (S/M/L/XL), requirement tracing" --tool gemini --mode analysis`,
    run_in_background: true
  })

  // Generate epics/ directory
  Bash(`mkdir -p ${sessionFolder}/epics`)

  // Write _index.md + EPIC-*.md files
}
```

### Phase 4: Self-Validation

```javascript
// Validate generated document
const validationChecks = {
  has_frontmatter: false,
  sections_complete: false,
  cross_references: false,
  discussion_integrated: false
}

// Check YAML frontmatter
const docContent = Read(`${sessionFolder}/${outputPath}`)
validationChecks.has_frontmatter = /^---\n[\s\S]+?\n---/.test(docContent)

// Check required sections based on doc type
const requiredSections = {
  'product-brief': ['Vision', 'Problem Statement', 'Target Users', 'Goals', 'Scope'],
  'requirements': ['_index.md', 'REQ-'],
  'architecture': ['_index.md', 'ADR-'],
  'epics': ['_index.md', 'EPIC-']
}
// Verify all sections present

// Check cross-references to prior documents
validationChecks.cross_references = docContent.includes('session_id')

// Check discussion feedback integration
validationChecks.discussion_integrated = !discussionFeedback || docContent.includes('Discussion')

const allValid = Object.values(validationChecks).every(v => v)
```

### Phase 5: Report to Coordinator

```javascript
const docTypeLabel = {
  'product-brief': 'Product Brief',
  'requirements': 'Requirements/PRD',
  'architecture': 'Architecture Document',
  'epics': 'Epics & Stories'
}

// Log before SendMessage
mcp__ccw-tools__team_msg({
  operation: "log", team: teamName,
  from: "spec-writer", to: "coordinator",
  type: "draft_ready",
  summary: `${docTypeLabel[docType]} 完成: ${allValid ? '验证通过' : '部分验证失败'}`,
  ref: `${sessionFolder}/${outputPath}`
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## 文档撰写结果

**Task**: ${task.subject}
**文档类型**: ${docTypeLabel[docType]}
**验证状态**: ${allValid ? 'PASS' : 'PARTIAL'}

### 文档摘要
${documentSummary}

### 讨论反馈整合
${discussionFeedback ? '已整合前序讨论反馈' : '首次撰写（无前序讨论反馈）'}

### 自验证结果
${Object.entries(validationChecks).map(([k, v]) => `- ${k}: ${v ? '✓' : '✗'}`).join('\n')}

### 输出位置
${sessionFolder}/${outputPath}

文档已就绪，可进入讨论轮次。`,
  summary: `${docTypeLabel[docType]} 就绪`
})

// Mark task completed
TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next DRAFT task
const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('DRAFT-') &&
  t.owner === 'spec-writer' &&
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
| No DRAFT-* tasks available | Idle, wait for coordinator assignment |
| Prior document not found | Notify coordinator, request prerequisite |
| CLI analysis failure | Retry with fallback tool, then direct generation |
| Template sections incomplete | Generate best-effort, note gaps in report |
| Discussion feedback contradicts prior docs | Note conflict in document, flag for next discussion |
| Session folder missing | Notify coordinator, request session path |
| Unexpected error | Log error via team_msg, report to coordinator |
