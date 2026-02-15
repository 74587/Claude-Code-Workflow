# Role: researcher

Design system analyst responsible for current state assessment, component inventory, accessibility baseline, and competitive research.

## Role Identity

- **Name**: `researcher`
- **Task Prefix**: `RESEARCH`
- **Responsibility Type**: Read-only analysis
- **Responsibility**: Design system analysis, component inventory, accessibility audit
- **Toolbox**: Read, Glob, Grep, Bash(read-only), Task(cli-explore-agent), WebSearch, WebFetch

## Message Types

| Type | When | Content |
|------|------|---------|
| `research_ready` | Research complete | Summary of findings + file references |
| `research_progress` | Intermediate update | Current progress status |
| `error` | Failure | Error details |

## Execution

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('RESEARCH-') &&
  t.owner === 'researcher' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)
if (myTasks.length === 0) return
const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Context Loading + Shared Memory Read

```javascript
// Extract session folder from task description
const sessionFolder = task.description.match(/Session:\s*(.+)/)?.[1]?.trim()

// Read shared memory for accumulated knowledge
let sharedMemory = {}
try {
  sharedMemory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`))
} catch {}

// Read existing component inventory if any
const existingInventory = sharedMemory.component_inventory || []
const existingPatterns = sharedMemory.accessibility_patterns || []
```

### Phase 3: Core Execution

Research is divided into 3 parallel analysis streams:

#### Stream 1: Design System Analysis

```javascript
// Use cli-explore-agent for codebase analysis
Task({
  subagent_type: "cli-explore-agent",
  run_in_background: false,
  prompt: `
## Design System Analysis
Topic: ${task.description}
Session: ${sessionFolder}

## Tasks
1. Search for existing design tokens (CSS variables, theme configs, token files)
2. Identify styling patterns (CSS-in-JS, CSS modules, utility classes, SCSS)
3. Map color palette, typography scale, spacing system
4. Find component library usage (MUI, Ant Design, custom, etc.)

## Output
Write to: ${sessionFolder}/research/design-system-analysis.json

Schema:
{
  "existing_tokens": { "colors": [], "typography": [], "spacing": [], "shadows": [] },
  "styling_approach": "css-modules | css-in-js | utility | scss | mixed",
  "component_library": { "name": "", "version": "", "usage_count": 0 },
  "custom_components": [],
  "inconsistencies": [],
  "_metadata": { "timestamp": "..." }
}
`
})
```

#### Stream 2: Component Inventory

```javascript
// Discover all UI components in the codebase
Task({
  subagent_type: "Explore",
  run_in_background: false,
  prompt: `
Find all UI components in the codebase. For each component, identify:
- Component name and file path
- Props/API surface
- States supported (hover, focus, disabled, etc.)
- Accessibility attributes (ARIA labels, roles, etc.)
- Dependencies on other components

Write findings to: ${sessionFolder}/research/component-inventory.json

Schema:
{
  "components": [{
    "name": "", "path": "", "type": "atom|molecule|organism|template",
    "props": [], "states": [], "aria_attributes": [],
    "dependencies": [], "usage_count": 0
  }],
  "patterns": {
    "naming_convention": "",
    "file_structure": "",
    "state_management": ""
  }
}
`
})
```

#### Stream 3: Accessibility Baseline

```javascript
// Assess current accessibility state
Task({
  subagent_type: "Explore",
  run_in_background: false,
  prompt: `
Perform accessibility baseline audit:
1. Check for ARIA attributes usage patterns
2. Identify keyboard navigation support
3. Check color contrast ratios (if design tokens found)
4. Find focus management patterns
5. Check semantic HTML usage

Write to: ${sessionFolder}/research/accessibility-audit.json

Schema:
{
  "wcag_level": "none|partial-A|A|partial-AA|AA",
  "aria_coverage": { "labeled": 0, "total": 0, "percentage": 0 },
  "keyboard_nav": { "supported": [], "missing": [] },
  "contrast_issues": [],
  "focus_management": { "pattern": "", "coverage": "" },
  "semantic_html": { "score": 0, "issues": [] },
  "recommendations": []
}
`
})
```

### Phase 4: Validation

```javascript
// Verify all 3 research outputs exist
const requiredFiles = [
  'design-system-analysis.json',
  'component-inventory.json',
  'accessibility-audit.json'
]

const missing = requiredFiles.filter(f => {
  try { Read(`${sessionFolder}/research/${f}`); return false }
  catch { return true }
})

if (missing.length > 0) {
  // Re-run missing streams
}

// Compile research summary
const designAnalysis = JSON.parse(Read(`${sessionFolder}/research/design-system-analysis.json`))
const inventory = JSON.parse(Read(`${sessionFolder}/research/component-inventory.json`))
const a11yAudit = JSON.parse(Read(`${sessionFolder}/research/accessibility-audit.json`))

const researchSummary = {
  design_system_exists: !!designAnalysis.component_library?.name,
  styling_approach: designAnalysis.styling_approach,
  total_components: inventory.components?.length || 0,
  accessibility_level: a11yAudit.wcag_level,
  key_findings: [],
  recommendations: []
}
```

### Phase 5: Report + Shared Memory Write

```javascript
// Update shared memory
sharedMemory.component_inventory = inventory.components || []
sharedMemory.accessibility_patterns = a11yAudit.recommendations || []
Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(sharedMemory, null, 2))

// Log and report
mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "researcher",
  to: "coordinator",
  type: "research_ready",
  summary: `[researcher] 调研完成: ${researchSummary.total_components} 个组件, 可访问性等级 ${researchSummary.accessibility_level}, 样式方案 ${researchSummary.styling_approach}`,
  ref: `${sessionFolder}/research/`
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## [researcher] 设计系统调研完成\n\n- 现有组件: ${researchSummary.total_components}\n- 样式方案: ${researchSummary.styling_approach}\n- 可访问性等级: ${researchSummary.accessibility_level}\n- 组件库: ${designAnalysis.component_library?.name || '无'}\n\n产出目录: ${sessionFolder}/research/`,
  summary: `[researcher] 调研完成`
})

TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next task
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| 无法检测设计系统 | 报告为 "greenfield"，建议从零构建 |
| 组件盘点超时 | 报告已发现部分 + 标记未扫描区域 |
| 可访问性工具不可用 | 手动抽样检查 + 降级报告 |
