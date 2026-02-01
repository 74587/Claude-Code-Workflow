---
description: Serial collaborative planning with Plan Note - Single-agent sequential task generation, unified plan-note.md, conflict detection. Codex-optimized.
argument-hint: "TASK=\"<description>\" [--max-domains=5] [--focus=<domain>]"
---

# Codex Collaborative-Plan-With-File Prompt

## Overview

Serial collaborative planning workflow using **Plan Note** architecture:

1. **Understanding**: Analyze requirements and identify 2-5 sub-domains
2. **Sequential Planning**: Process each sub-domain sequentially, generating plan.json + updating plan-note.md
3. **Conflict Detection**: Scan plan-note.md for conflicts
4. **Completion**: Generate executable plan.md summary

**Note**: Codex does not support parallel agent execution. All domains processed serially.

## Target Task

**$TASK**

**Parameters**:
- `--max-domains`: Maximum sub-domains to identify (default: 5)
- `--focus`: Focus specific domain (optional)

## Execution Process

```
Session Detection:
   ├─ Check if planning session exists for task
   ├─ EXISTS + plan-note.md exists → Continue mode
   └─ NOT_FOUND → New session mode

Phase 1: Understanding & Template Creation
   ├─ Analyze task description (Glob/Grep/Bash)
   ├─ Identify 2-5 sub-domains
   ├─ Create plan-note.md template
   └─ Generate requirement-analysis.json

Phase 2: Sequential Sub-Domain Planning (Serial)
   ├─ For each sub-domain (LOOP):
   │  ├─ Gemini CLI: Generate detailed plan
   │  ├─ Extract task summary
   │  └─ Update plan-note.md section
   └─ Complete all domains sequentially

Phase 3: Conflict Detection
   ├─ Parse plan-note.md
   ├─ Extract all tasks from all sections
   ├─ Detect file/dependency/strategy conflicts
   └─ Update conflict markers in plan-note.md

Phase 4: Completion
   ├─ Generate conflicts.json
   ├─ Generate plan.md summary
   └─ Ready for execution

Output:
   ├─ .workflow/.planning/{slug}-{date}/plan-note.md (executable)
   ├─ .workflow/.planning/{slug}-{date}/requirement-analysis.json (metadata)
   ├─ .workflow/.planning/{slug}-{date}/conflicts.json (conflict report)
   ├─ .workflow/.planning/{slug}-{date}/plan.md (human-readable)
   └─ .workflow/.planning/{slug}-{date}/agents/{domain}/plan.json (detailed)
```

## Output Structure

```
.workflow/.planning/CPLAN-{slug}-{date}/
├── plan-note.md                  # ⭐ Core: Requirements + Tasks + Conflicts
├── requirement-analysis.json     # Phase 1: Sub-domain assignments
├── agents/                       # Phase 2: Per-domain plans (serial)
│   ├── {domain-1}/
│   │   └── plan.json            # Detailed plan
│   ├── {domain-2}/
│   │   └── plan.json
│   └── ...
├── conflicts.json                # Phase 3: Conflict report
└── plan.md                       # Phase 4: Human-readable summary
```

---

## Implementation Details

### Session Setup

```javascript
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

const taskSlug = "$TASK".toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').substring(0, 30)
const dateStr = getUtc8ISOString().substring(0, 10)

const sessionId = `CPLAN-${taskSlug}-${dateStr}`
const sessionFolder = `.workflow/.planning/${sessionId}`
const planNotePath = `${sessionFolder}/plan-note.md`
const requirementsPath = `${sessionFolder}/requirement-analysis.json`
const conflictsPath = `${sessionFolder}/conflicts.json`
const planPath = `${sessionFolder}/plan.md`

// Auto-detect mode
const sessionExists = fs.existsSync(sessionFolder)
const hasPlanNote = sessionExists && fs.existsSync(planNotePath)
const mode = hasPlanNote ? 'continue' : 'new'

if (!sessionExists) {
  bash(`mkdir -p ${sessionFolder}/agents`)
}
```

---

### Phase 1: Understanding & Template Creation

#### Step 1.1: Analyze Task Description

Use built-in tools (no agent):

```javascript
// 1. Extract task keywords
const taskKeywords = extractKeywords("$TASK")

// 2. Identify sub-domains via analysis
// Example: "Implement real-time notification system"
// → Domains: [Backend API, Frontend UI, Notification Service, Data Storage, Testing]

const subDomains = identifySubDomains("$TASK", {
  maxDomains: 5,  // --max-domains parameter
  keywords: taskKeywords
})

// 3. Estimate scope
const complexity = assessComplexity("$TASK")
```

#### Step 1.2: Create plan-note.md Template

Generate structured template:

```markdown
---
session_id: ${sessionId}
original_requirement: |
  $TASK
created_at: ${getUtc8ISOString()}
complexity: ${complexity}
sub_domains: ${subDomains.map(d => d.name).join(', ')}
status: in_progress
---

# 协作规划

**Session ID**: ${sessionId}
**任务**: $TASK
**复杂度**: ${complexity}
**创建时间**: ${getUtc8ISOString()}

---

## 需求理解

### 核心目标
${extractObjectives("$TASK")}

### 关键要点
${extractKeyPoints("$TASK")}

### 约束条件
${extractConstraints("$TASK")}

### 拆分策略
${subDomains.length} 个子领域:
${subDomains.map((d, i) => `${i+1}. **${d.name}**: ${d.description}`).join('\n')}

---

## 任务池 - ${subDomains[0].name}
*(TASK-001 ~ TASK-100)*

*待由规划流程填充*

---

## 任务池 - ${subDomains[1].name}
*(TASK-101 ~ TASK-200)*

*待由规划流程填充*

---

## 依赖关系

*所有子域规划完成后自动生成*

---

## 冲突标记

*冲突检测阶段生成*

---

## 上下文证据 - ${subDomains[0].name}

*相关文件、现有模式、约束等*

---

## 上下文证据 - ${subDomains[1].name}

*相关文件、现有模式、约束等*

---
```

#### Step 1.3: Generate requirement-analysis.json

```javascript
const requirements = {
  session_id: sessionId,
  original_requirement: "$TASK",
  complexity: complexity,
  sub_domains: subDomains.map((domain, index) => ({
    focus_area: domain.name,
    description: domain.description,
    task_id_range: [index * 100 + 1, (index + 1) * 100],
    estimated_effort: domain.effort,
    dependencies: domain.dependencies || []
  })),
  total_domains: subDomains.length
}

Write(requirementsPath, JSON.stringify(requirements, null, 2))
```

---

### Phase 2: Sequential Sub-Domain Planning

#### Step 2.1: Plan Each Domain Sequentially

```javascript
for (let i = 0; i < subDomains.length; i++) {
  const domain = subDomains[i]
  const domainFolder = `${sessionFolder}/agents/${domain.slug}`
  const domainPlanPath = `${domainFolder}/plan.json`
  
  console.log(`Planning Domain ${i+1}/${subDomains.length}: ${domain.name}`)

  // Execute Gemini CLI for this domain
  // ⏳ Wait for completion before proceeding to next domain
}
```

#### Step 2.2: CLI Planning for Current Domain

**CLI Call** (synchronous):
```bash
ccw cli -p "
PURPOSE: Generate detailed implementation plan for domain '${domain.name}' in task: $TASK
Success: Comprehensive task breakdown with clear dependencies and effort estimates

DOMAIN CONTEXT:
- Focus Area: ${domain.name}
- Description: ${domain.description}
- Task ID Range: ${domain.task_id_range[0]}-${domain.task_id_range[1]}
- Related Domains: ${relatedDomains.join(', ')}

PRIOR DOMAINS (if any):
${completedDomains.map(d => `- ${d.name}: ${completedTaskCount} tasks`).join('\n')}

TASK:
• Analyze ${domain.name} in detail
• Identify all necessary tasks (use TASK-ID range: ${domain.task_id_range[0]}-${domain.task_id_range[1]})
• Define task dependencies and order
• Estimate effort and complexity for each task
• Identify file modifications needed
• Assess conflict risks with other domains

MODE: analysis

CONTEXT: @**/*

EXPECTED:
JSON output with:
- tasks[]: {id, title, description, complexity, depends_on[], files_to_modify[], conflict_risk}
- summary: Overview of domain plan
- interdependencies: Links to other domains
- total_effort: Estimated effort points

OUTPUT FORMAT: Structured JSON
" --tool gemini --mode analysis
```

#### Step 2.3: Parse and Update plan-note.md

After CLI completes for each domain:

```javascript
// Parse CLI output
const planJson = parseCLIOutput(cliResult)

// Save detailed plan
Write(domainPlanPath, JSON.stringify(planJson, null, 2))

// Extract task summary
const taskSummary = planJson.tasks.map((t, idx) => `
### TASK-${t.id}: ${t.title} [${domain.slug}]

**状态**: 规划中
**复杂度**: ${t.complexity}
**依赖**: ${t.depends_on.length > 0 ? t.depends_on.map(d => `TASK-${d}`).join(', ') : 'None'}
**范围**: ${t.description}

**修改点**:
${t.files_to_modify.map(f => `- \`${f.path}:${f.line_range}\`: ${f.summary}`).join('\n')}

**冲突风险**: ${t.conflict_risk}
`).join('\n')

// Update plan-note.md
updatePlanNoteSection(
  planNotePath,
  `## 任务池 - ${domain.name}`,
  taskSummary
)

// Extract evidence
const evidence = `
**相关文件**:
${planJson.related_files.map(f => `- ${f.path}: ${f.relevance}`).join('\n')}

**现有模式**:
${planJson.existing_patterns.map(p => `- ${p}`).join('\n')}

**约束**:
${planJson.constraints.map(c => `- ${c}`).join('\n')}
`

updatePlanNoteSection(
  planNotePath,
  `## 上下文证据 - ${domain.name}`,
  evidence
)
```

#### Step 2.4: Process All Domains

```javascript
const completedDomains = []

for (const domain of subDomains) {
  // Step 2.2: CLI call (synchronous)
  const cliResult = executeCLI(domain)
  
  // Step 2.3: Parse and update
  updatePlanNoteFromCLI(domain, cliResult)
  
  completedDomains.push(domain)
  console.log(`✅ Completed: ${domain.name}`)
}
```

---

### Phase 3: Conflict Detection

#### Step 3.1: Parse plan-note.md

```javascript
const planContent = Read(planNotePath)
const sections = parsePlanNoteSections(planContent)
const allTasks = []

// Extract tasks from all domains
for (const section of sections) {
  if (section.heading.includes('任务池')) {
    const tasks = extractTasks(section.content)
    allTasks.push(...tasks)
  }
}
```

#### Step 3.2: Detect Conflicts

```javascript
const conflicts = []

// 1. File conflicts
const fileMap = new Map()
for (const task of allTasks) {
  for (const file of task.files_to_modify) {
    const key = `${file.path}:${file.line_range}`
    if (!fileMap.has(key)) fileMap.set(key, [])
    fileMap.get(key).push(task)
  }
}

for (const [location, tasks] of fileMap.entries()) {
  if (tasks.length > 1) {
    const agents = new Set(tasks.map(t => t.domain))
    if (agents.size > 1) {
      conflicts.push({
        type: 'file_conflict',
        severity: 'high',
        location: location,
        tasks_involved: tasks.map(t => t.id),
        agents_involved: Array.from(agents),
        description: `Multiple domains modifying: ${location}`,
        suggested_resolution: 'Coordinate modification order'
      })
    }
  }
}

// 2. Dependency cycles
const depGraph = buildDependencyGraph(allTasks)
const cycles = detectCycles(depGraph)
for (const cycle of cycles) {
  conflicts.push({
    type: 'dependency_cycle',
    severity: 'critical',
    tasks_involved: cycle,
    description: `Circular dependency: ${cycle.join(' → ')}`,
    suggested_resolution: 'Remove or reorganize dependencies'
  })
}

// Write conflicts.json
Write(conflictsPath, JSON.stringify({
  detected_at: getUtc8ISOString(),
  total_conflicts: conflicts.length,
  conflicts: conflicts
}, null, 2))
```

#### Step 3.3: Update plan-note.md

```javascript
const conflictMarkdown = generateConflictMarkdown(conflicts)

updatePlanNoteSection(
  planNotePath,
  '## 冲突标记',
  conflictMarkdown
)
```

---

### Phase 4: Completion

#### Step 4.1: Generate plan.md

```markdown
# 实现计划

**Session**: ${sessionId}
**任务**: $TASK
**创建**: ${getUtc8ISOString()}

---

## 需求

${copySection(planNotePath, '## 需求理解')}

---

## 子领域拆分

${subDomains.map((domain, i) => `
### ${i+1}. ${domain.name}
- **描述**: ${domain.description}
- **任务范围**: TASK-${domain.task_id_range[0]} ~ TASK-${domain.task_id_range[1]}
- **预估工作量**: ${domain.effort}
`).join('\n')}

---

## 任务概览

${allTasks.map(t => `
### ${t.id}: ${t.title}
- **复杂度**: ${t.complexity}
- **依赖**: ${t.depends_on.length > 0 ? t.depends_on.join(', ') : 'None'}
- **文件**: ${t.files_to_modify.map(f => f.path).join(', ')}
`).join('\n')}

---

## 冲突报告

${conflicts.length > 0 
  ? `检测到 ${conflicts.length} 个冲突:\n${copySection(planNotePath, '## 冲突标记')}`
  : '✅ 无冲突检测到'}

---

## 执行指令

\`\`\`bash
/workflow:unified-execute-with-file ${planPath}
\`\`\`
```

#### Step 4.2: Write Summary

```javascript
Write(planPath, planMarkdown)
```

---

## Configuration

### Sub-Domain Identification

Common domain patterns:
- Backend API: "服务", "后端", "API", "接口"
- Frontend: "界面", "前端", "UI", "视图"
- Database: "数据", "存储", "数据库", "持久化"
- Testing: "测试", "验证", "QA"
- Infrastructure: "部署", "基础", "运维", "配置"

---

## Error Handling

| Error | Resolution |
|-------|------------|
| CLI timeout | Retry with shorter prompt |
| No tasks generated | Review domain description, retry |
| Section not found | Recreate section in plan-note.md |
| Conflict detection fails | Continue with empty conflicts |

---

## Best Practices

1. **Clear Task Description**: Detailed requirements → better sub-domains
2. **Review plan-note.md**: Check before moving to next phase
3. **Resolve Conflicts**: Address before execution
4. **Inspect Details**: Review agents/{domain}/plan.json for specifics

---

**Now execute collaborative-plan-with-file for**: $TASK
