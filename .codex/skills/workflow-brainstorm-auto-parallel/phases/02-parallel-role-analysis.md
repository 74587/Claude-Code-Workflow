## Overview

**Unified command for generating and updating role-specific analysis** with interactive context gathering, framework alignment, and incremental update support. Replaces 9 individual role commands with single parameterized workflow.

### Core Function
- **Multi-Role Support**: Single command supports all 9 brainstorming roles
- **Interactive Context**: Dynamic question generation based on role and framework
- **Incremental Updates**: Merge new insights into existing analyses
- **Framework Alignment**: Address guidance-specification.md discussion points
- **Agent Delegation**: Use conceptual-planning-agent with role-specific templates
- **Explicit Lifecycle**: Manage subagent creation, waiting, and cleanup

### Supported Roles

| Role ID | Title | Focus Area | Context Questions |
|---------|-------|------------|-------------------|
| `ux-expert` | UX专家 | User research, information architecture, user journey | 4 |
| `ui-designer` | UI设计师 | Visual design, high-fidelity mockups, design systems | 4 |
| `system-architect` | 系统架构师 | Technical architecture, scalability, integration patterns | 5 |
| `product-manager` | 产品经理 | Product strategy, roadmap, prioritization | 4 |
| `product-owner` | 产品负责人 | Backlog management, user stories, acceptance criteria | 4 |
| `scrum-master` | 敏捷教练 | Process facilitation, impediment removal, team dynamics | 3 |
| `subject-matter-expert` | 领域专家 | Domain knowledge, business rules, compliance | 4 |
| `data-architect` | 数据架构师 | Data models, storage strategies, data flow | 5 |
| `api-designer` | API设计师 | API contracts, versioning, integration patterns | 4 |

---

## Usage

```bash
# Generate new analysis with interactive context
role-analysis ux-expert

# Generate with existing framework + context questions
role-analysis system-architect --session WFS-xxx --include-questions

# Update existing analysis (incremental merge)
role-analysis ui-designer --session WFS-xxx --update

# Quick generation (skip interactive context)
role-analysis product-manager --session WFS-xxx --skip-questions
```

---

## Execution Protocol

### Phase 1: Detection & Validation

**Step 1.1: Role Validation**
```bash
VALIDATE role_name IN [
  ux-expert, ui-designer, system-architect, product-manager,
  product-owner, scrum-master, subject-matter-expert,
  data-architect, api-designer
]
IF invalid:
  ERROR: "Unknown role: {role_name}. Use one of: ux-expert, ui-designer, ..."
  EXIT
```

**Step 1.2: Session Detection**
```bash
IF --session PROVIDED:
  session_id = --session
  brainstorm_dir = .workflow/active/{session_id}/.brainstorming/
ELSE:
  FIND .workflow/active/WFS-*/
  IF multiple:
    PROMPT user to select
  ELSE IF single:
    USE existing
  ELSE:
    ERROR: "No active session. Run Phase 1 (artifacts) first"
    EXIT

VALIDATE brainstorm_dir EXISTS
```

**Step 1.3: Framework Detection**
```bash
framework_file = {brainstorm_dir}/guidance-specification.md
IF framework_file EXISTS:
  framework_mode = true
  LOAD framework_content
ELSE:
  WARN: "No framework found - will create standalone analysis"
  framework_mode = false
```

**Step 1.4: Update Mode Detection**
```bash
existing_analysis = {brainstorm_dir}/{role_name}/analysis*.md
IF --update FLAG OR existing_analysis EXISTS:
  update_mode = true
  IF --update NOT PROVIDED:
    ASK: "Analysis exists. Update or regenerate?"
    OPTIONS: ["Incremental update", "Full regenerate", "Cancel"]
ELSE:
  update_mode = false
```

### Phase 2: Interactive Context Gathering

**Trigger Conditions**:
- Default: Always ask unless `--skip-questions` provided
- `--include-questions`: Force context gathering even if analysis exists
- `--skip-questions`: Skip all interactive questions

**Step 2.1: Load Role Configuration**
```javascript
const roleConfig = {
  'ux-expert': {
    title: 'UX专家',
    focus_area: 'User research, information architecture, user journey',
    question_categories: ['User Intent', 'Requirements', 'UX'],
    question_count: 4,
    template: '~/.codex/workflows/cli-templates/planning-roles/ux-expert.md'
  },
  'ui-designer': {
    title: 'UI设计师',
    focus_area: 'Visual design, high-fidelity mockups, design systems',
    question_categories: ['Requirements', 'UX', 'Feasibility'],
    question_count: 4,
    template: '~/.codex/workflows/cli-templates/planning-roles/ui-designer.md'
  },
  'system-architect': {
    title: '系统架构师',
    focus_area: 'Technical architecture, scalability, integration patterns',
    question_categories: ['Scale & Performance', 'Technical Constraints', 'Architecture Complexity', 'Non-Functional Requirements'],
    question_count: 5,
    template: '~/.codex/workflows/cli-templates/planning-roles/system-architect.md'
  },
  'product-manager': {
    title: '产品经理',
    focus_area: 'Product strategy, roadmap, prioritization',
    question_categories: ['User Intent', 'Requirements', 'Process'],
    question_count: 4,
    template: '~/.codex/workflows/cli-templates/planning-roles/product-manager.md'
  },
  'product-owner': {
    title: '产品负责人',
    focus_area: 'Backlog management, user stories, acceptance criteria',
    question_categories: ['Requirements', 'Decisions', 'Process'],
    question_count: 4,
    template: '~/.codex/workflows/cli-templates/planning-roles/product-owner.md'
  },
  'scrum-master': {
    title: '敏捷教练',
    focus_area: 'Process facilitation, impediment removal, team dynamics',
    question_categories: ['Process', 'Risk', 'Decisions'],
    question_count: 3,
    template: '~/.codex/workflows/cli-templates/planning-roles/scrum-master.md'
  },
  'subject-matter-expert': {
    title: '领域专家',
    focus_area: 'Domain knowledge, business rules, compliance',
    question_categories: ['Requirements', 'Feasibility', 'Terminology'],
    question_count: 4,
    template: '~/.codex/workflows/cli-templates/planning-roles/subject-matter-expert.md'
  },
  'data-architect': {
    title: '数据架构师',
    focus_area: 'Data models, storage strategies, data flow',
    question_categories: ['Architecture', 'Scale & Performance', 'Technical Constraints', 'Feasibility'],
    question_count: 5,
    template: '~/.codex/workflows/cli-templates/planning-roles/data-architect.md'
  },
  'api-designer': {
    title: 'API设计师',
    focus_area: 'API contracts, versioning, integration patterns',
    question_categories: ['Architecture', 'Requirements', 'Feasibility', 'Decisions'],
    question_count: 4,
    template: '~/.codex/workflows/cli-templates/planning-roles/api-designer.md'
  }
};

config = roleConfig[role_name];
```

**Step 2.2: Generate Role-Specific Questions**

**9-Category Taxonomy**:

| Category | Focus | Example Question Pattern |
|----------|-------|--------------------------|
| User Intent | 用户目标 | "该分析的核心目标是什么？" |
| Requirements | 需求细化 | "需求的优先级如何排序？" |
| Architecture | 架构决策 | "技术栈的选择考量？" |
| UX | 用户体验 | "交互复杂度的取舍？" |
| Feasibility | 可行性 | "资源约束下的实现范围？" |
| Risk | 风险管理 | "风险容忍度是多少？" |
| Process | 流程规范 | "开发迭代的节奏？" |
| Decisions | 决策确认 | "冲突的解决方案？" |
| Terminology | 术语统一 | "统一使用哪个术语？" |
| Scale & Performance | 性能扩展 | "预期的负载和性能要求？" |
| Technical Constraints | 技术约束 | "现有技术栈的限制？" |
| Architecture Complexity | 架构复杂度 | "架构的复杂度权衡？" |
| Non-Functional Requirements | 非功能需求 | "可用性和可维护性要求？" |

**Question Generation Algorithm**:
```javascript
async function generateQuestions(role_name, framework_content) {
  const config = roleConfig[role_name];
  const questions = [];

  // Parse framework for keywords
  const keywords = extractKeywords(framework_content);

  // Generate category-specific questions
  for (const category of config.question_categories) {
    const question = generateCategoryQuestion(category, keywords, role_name);
    questions.push(question);
  }

  return questions.slice(0, config.question_count);
}
```

**Step 2.3: Multi-Round Question Execution**

```javascript
const BATCH_SIZE = 4;
const user_context = {};

for (let i = 0; i < questions.length; i += BATCH_SIZE) {
  const batch = questions.slice(i, i + BATCH_SIZE);
  const currentRound = Math.floor(i / BATCH_SIZE) + 1;
  const totalRounds = Math.ceil(questions.length / BATCH_SIZE);

  console.log(`\n[Round ${currentRound}/${totalRounds}] ${config.title} 上下文询问\n`);

  ASK_USER(batch.map(q => ({
    id: q.category.substring(0, 12), type: "select",
    prompt: q.question,
    options: q.options.map(opt => ({
      label: opt.label,
      description: opt.description
    }))
  })));  // BLOCKS (wait for user response)

  // Store responses before next round
  for (const answer of responses) {
    user_context[answer.question] = {
      answer: answer.selected,
      category: answer.category,
      timestamp: new Date().toISOString()
    };
  }
}

// Save context to file
Write(
  `${brainstorm_dir}/${role_name}/${role_name}-context.md`,
  formatUserContext(user_context)
);
```

**Question Quality Rules**:

**MUST Include**:
- ✅ All questions in Chinese (用中文提问)
- ✅ 业务场景作为问题前提
- ✅ 技术选项的业务影响说明
- ✅ 量化指标和约束条件

**MUST Avoid**:
- ❌ 纯技术选型无业务上下文
- ❌ 过度抽象的通用问题
- ❌ 脱离框架的重复询问

### Phase 3: Agent Execution

**Step 3.1: Load Session Metadata**
```bash
session_metadata = Read(.workflow/active/{session_id}/workflow-session.json)
original_topic = session_metadata.topic
selected_roles = session_metadata.selected_roles
```

**Step 3.2: Prepare Agent Context**
```javascript
const agentContext = {
  role_name: role_name,
  role_config: roleConfig[role_name],
  output_location: `${brainstorm_dir}/${role_name}/`,
  framework_mode: framework_mode,
  framework_path: framework_mode ? `${brainstorm_dir}/guidance-specification.md` : null,
  update_mode: update_mode,
  user_context: user_context,
  original_topic: original_topic,
  session_id: session_id
};
```

**Step 3.3: Execute Conceptual Planning Agent**

**Framework-Based Analysis** (when guidance-specification.md exists):
```javascript
// Spawn conceptual-planning-agent
const roleAgentId = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/conceptual-planning-agent.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

[FLOW_CONTROL]

Execute ${role_name} analysis for existing topic framework

## Context Loading
ASSIGNED_ROLE: ${role_name}
OUTPUT_LOCATION: ${agentContext.output_location}
ANALYSIS_MODE: ${framework_mode ? "framework_based" : "standalone"}
UPDATE_MODE: ${update_mode}

## Flow Control Steps
1. **load_topic_framework**
   - Action: Load structured topic discussion framework
   - Command: Read(${agentContext.framework_path})
   - Output: topic_framework_content

2. **load_role_template**
   - Action: Load ${role_name} planning template
   - Command: Read(${roleConfig[role_name].template})
   - Output: role_template_guidelines

3. **load_session_metadata**
   - Action: Load session metadata and user intent
   - Command: Read(.workflow/active/${session_id}/workflow-session.json)
   - Output: session_context

4. **load_user_context** (if exists)
   - Action: Load interactive context responses
   - Command: Read(${brainstorm_dir}/${role_name}/${role_name}-context.md)
   - Output: user_context_answers

5. **${update_mode ? 'load_existing_analysis' : 'skip'}**
   ${update_mode ? `
   - Action: Load existing analysis for incremental update
   - Command: Read(${brainstorm_dir}/${role_name}/analysis.md)
   - Output: existing_analysis_content
   ` : ''}

## Analysis Requirements
**Primary Reference**: Original user prompt from workflow-session.json is authoritative
**Framework Source**: Address all discussion points in guidance-specification.md from ${role_name} perspective
**User Context Integration**: Incorporate interactive Q&A responses into analysis
**Role Focus**: ${roleConfig[role_name].focus_area}
**Template Integration**: Apply role template guidelines within framework structure

## Expected Deliverables
1. **analysis.md** (main document, optionally with analysis-{slug}.md sub-documents)
2. **Framework Reference**: @../guidance-specification.md (if framework_mode)
3. **User Context Reference**: @./${role_name}-context.md (if user context exists)
4. **User Intent Alignment**: Validate against session_context

## Update Requirements (if UPDATE_MODE)
- **Preserve Structure**: Maintain existing analysis structure
- **Add "Clarifications" Section**: Document new user context with timestamp
- **Merge Insights**: Integrate new perspectives without removing existing content
- **Resolve Conflicts**: If new context contradicts existing analysis, document both and recommend resolution

## Completion Criteria
- Address each discussion point from guidance-specification.md with ${role_name} expertise
- Provide actionable recommendations from ${role_name} perspective within analysis files
- All output files MUST start with "analysis" prefix (no recommendations.md or other naming)
- Reference framework document using @ notation for integration
- Update workflow-session.json with completion status
`
});

// Wait for agent completion
const roleResult = wait({
  ids: [roleAgentId],
  timeout_ms: 600000  // 10 minutes
});

// Check result and cleanup
if (roleResult.timed_out) {
  console.warn(`${role_name} analysis timed out`);
}

// Always close agent
close_agent({ id: roleAgentId });
```

### Phase 3 (Parallel Mode): Execute Multiple Roles Concurrently

**When called from auto-parallel orchestrator**, execute all selected roles in parallel:

```javascript
// Step 1: Spawn all role agents in parallel
const roleAgents = [];

selected_roles.forEach((role_name, index) => {
  const config = roleConfig[role_name];

  // For ui-designer, append style-skill if provided
  const styleContext = (role_name === 'ui-designer' && style_skill_package)
    ? `\n## Style Reference\n**Style SKILL Package**: .codex/skills/style-${style_skill_package}/\n**Load First**: Read SKILL.md from style package for design tokens`
    : '';

  const agentId = spawn_agent({
    message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/conceptual-planning-agent.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

## Task Objective
Execute **${role_name}** (${config.title}) analysis for brainstorming session.

## Assigned Context
- **Role**: ${role_name}
- **Role Focus**: ${config.focus_area}
- **Session ID**: ${session_id}
- **Framework Path**: ${brainstorm_dir}/guidance-specification.md
- **Output Location**: ${brainstorm_dir}/${role_name}/
- **Role Index**: ${index + 1} of ${selected_roles.length}
${styleContext}

## Analysis Requirements
**Primary Reference**: Original user prompt from workflow-session.json is authoritative
**Framework Source**: Address all discussion points in guidance-specification.md from ${role_name} perspective
**Role Focus**: ${config.focus_area}

## Expected Deliverables
1. **analysis.md** (main document)
2. **analysis-{slug}.md** (optional sub-documents, max 5)
3. **Framework Reference**: @../guidance-specification.md

## Completion Criteria
- Address each framework discussion point with ${role_name} expertise
- Provide actionable recommendations within analysis files
- All output files MUST start with "analysis" prefix
`
  });

  roleAgents.push({ agentId, role_name });
});

// Step 2: Batch wait for all agents
const agentIds = roleAgents.map(a => a.agentId);
const parallelResults = wait({
  ids: agentIds,
  timeout_ms: 900000  // 15 minutes for all agents
});

// Step 3: Process results and check completion
const completedRoles = [];
const failedRoles = [];

roleAgents.forEach(({ agentId, role_name }) => {
  if (parallelResults.status[agentId]?.completed) {
    completedRoles.push(role_name);
  } else {
    failedRoles.push(role_name);
  }
});

if (parallelResults.timed_out) {
  console.warn('Some role analyses timed out:', failedRoles);
}

// Step 4: Batch cleanup - IMPORTANT: always close all agents
roleAgents.forEach(({ agentId }) => {
  close_agent({ id: agentId });
});

console.log(`Completed: ${completedRoles.length}/${selected_roles.length} roles`);
console.log(`Completed roles: ${completedRoles.join(', ')}`);
if (failedRoles.length > 0) {
  console.warn(`Failed roles: ${failedRoles.join(', ')}`);
}
```

### Phase 4: Validation & Finalization

**Step 4.1: Validate Output**
```bash
VERIFY EXISTS: ${brainstorm_dir}/${role_name}/analysis.md
VERIFY CONTAINS: "@../guidance-specification.md" (if framework_mode)
IF user_context EXISTS:
  VERIFY CONTAINS: "@./${role_name}-context.md" OR "## Clarifications" section
```

**Step 4.2: Update Session Metadata**
```json
{
  "phases": {
    "BRAINSTORM": {
      "${role_name}": {
        "status": "${update_mode ? 'updated' : 'completed'}",
        "completed_at": "timestamp",
        "framework_addressed": true,
        "context_gathered": user_context ? true : false,
        "output_location": "${brainstorm_dir}/${role_name}/analysis.md",
        "update_history": [
          {
            "timestamp": "ISO8601",
            "mode": "${update_mode ? 'incremental' : 'initial'}",
            "context_questions": question_count
          }
        ]
      }
    }
  }
}
```

**Step 4.3: Completion Report**
```markdown
✅ ${roleConfig[role_name].title} Analysis Complete

**Output**: ${brainstorm_dir}/${role_name}/analysis.md
**Mode**: ${update_mode ? 'Incremental Update' : 'New Generation'}
**Framework**: ${framework_mode ? '✓ Aligned' : '✗ Standalone'}
**Context Questions**: ${question_count} answered

${update_mode ? '
**Changes**:
- Added "Clarifications" section with new user context
- Merged new insights into existing sections
- Resolved conflicts with framework alignment
' : ''}

**Next Steps**:
${selected_roles.length > 1 ? `
  - Continue with other roles: ${selected_roles.filter(r => r !== role_name).join(', ')}
  - Run synthesis: Phase 3 (synthesis integration)
` : `
  - Clarify insights: Phase 3 (synthesis integration)
  - Generate plan: workflow:plan --session ${session_id}
`}
```

---

## Output Structure

### Directory Layout

```
.workflow/active/WFS-{session}/.brainstorming/
├── guidance-specification.md          # Framework (if exists)
└── {role-name}/
    ├── {role-name}-context.md         # Interactive Q&A responses
    ├── analysis.md                    # Main analysis (REQUIRED)
    └── analysis-{slug}.md             # Section documents (optional, max 5)
```

### Analysis Document Structure (New Generation)

```markdown
# ${roleConfig[role_name].title} Analysis: [Topic from Framework]

## Framework Reference
**Topic Framework**: @../guidance-specification.md
**Role Focus**: ${roleConfig[role_name].focus_area}
**User Context**: @./${role_name}-context.md

## User Context Summary
**Context Gathered**: ${question_count} questions answered
**Categories**: ${question_categories.join(', ')}

${user_context ? formatContextSummary(user_context) : ''}

## Discussion Points Analysis
[Address each point from guidance-specification.md with ${role_name} expertise]

### Core Requirements (from framework)
[Role-specific perspective on requirements]

### Technical Considerations (from framework)
[Role-specific technical analysis]

### User Experience Factors (from framework)
[Role-specific UX considerations]

### Implementation Challenges (from framework)
[Role-specific challenges and solutions]

### Success Metrics (from framework)
[Role-specific metrics and KPIs]

## ${roleConfig[role_name].title} Specific Recommendations
[Role-specific actionable strategies]

---
*Generated by ${role_name} analysis addressing structured framework*
*Context gathered: ${new Date().toISOString()}*
```

### Analysis Document Structure (Incremental Update)

```markdown
# ${roleConfig[role_name].title} Analysis: [Topic]

## Framework Reference
[Existing content preserved]

## Clarifications
### Session ${new Date().toISOString().split('T')[0]}
${Object.entries(user_context).map(([q, a]) => `
- **Q**: ${q} (Category: ${a.category})
  **A**: ${a.answer}
`).join('\n')}

## User Context Summary
[Updated with new context]

## Discussion Points Analysis
[Existing content enhanced with new insights]

[Rest of sections updated based on clarifications]
```

---

## Integration with Other Phases

### Called By
- Auto-parallel orchestrator (Phase 2 - parallel role execution)
- Manual invocation for single-role analysis

### Spawns
- `conceptual-planning-agent` (via spawn_agent → wait → close_agent)

### Coordinates With
- Phase 1 (artifacts) - creates framework for role analysis
- Phase 3 (synthesis) - reads role analyses for integration

---

## Quality Assurance

### Required Analysis Elements
- [ ] Framework discussion points addressed (if framework_mode)
- [ ] User context integrated (if context gathered)
- [ ] Role template guidelines applied
- [ ] Output files follow naming convention (analysis*.md only)
- [ ] Framework reference using @ notation
- [ ] Session metadata updated

### Context Quality
- [ ] Questions in Chinese with business context
- [ ] Options include technical trade-offs
- [ ] Categories aligned with role focus
- [ ] No generic questions unrelated to framework

### Update Quality (if update_mode)
- [ ] "Clarifications" section added with timestamp
- [ ] New insights merged without content loss
- [ ] Conflicts documented and resolved
- [ ] Framework alignment maintained

### Agent Lifecycle Quality
- [ ] All spawn_agent have corresponding close_agent
- [ ] All wait calls have reasonable timeout
- [ ] Parallel agents use batch wait
- [ ] Error paths include agent cleanup

---

## Command Parameters

### Required Parameters
- `[role-name]`: Role identifier (ux-expert, ui-designer, system-architect, etc.)

### Optional Parameters
- `--session [session-id]`: Specify brainstorming session (auto-detect if omitted)
- `--update`: Force incremental update mode (auto-detect if analysis exists)
- `--include-questions`: Force context gathering even if analysis exists
- `--skip-questions`: Skip all interactive context gathering
- `--style-skill [package]`: For ui-designer only, load style SKILL package

### Parameter Combinations

| Scenario | Command | Behavior |
|----------|---------|----------|
| New analysis | `role-analysis ux-expert` | Generate + ask context questions |
| Quick generation | `role-analysis ux-expert --skip-questions` | Generate without context |
| Update existing | `role-analysis ux-expert --update` | Ask clarifications + merge |
| Force questions | `role-analysis ux-expert --include-questions` | Ask even if exists |
| Specific session | `role-analysis ux-expert --session WFS-xxx` | Target specific session |

---

## Error Handling

### Invalid Role Name
```
ERROR: Unknown role: "ui-expert"
Valid roles: ux-expert, ui-designer, system-architect, product-manager,
            product-owner, scrum-master, subject-matter-expert,
            data-architect, api-designer
```

### No Active Session
```
ERROR: No active brainstorming session found
Run: Phase 1 (artifacts) to create session
```

### Missing Framework (with warning)
```
WARN: No guidance-specification.md found
Generating standalone analysis without framework alignment
Recommend: Run Phase 1 (artifacts) first for better results
```

### Agent Execution Failure
```
ERROR: Conceptual planning agent failed
Check: ${brainstorm_dir}/${role_name}/error.log
Action: Retry with --skip-questions or check framework validity
```

### Agent Lifecycle Errors
```javascript
// Always ensure cleanup in error paths
try {
  const agentId = spawn_agent({ message: "..." });
  const result = wait({ ids: [agentId], timeout_ms: 600000 });
  // ... process result ...
  close_agent({ id: agentId });
} catch (error) {
  // Ensure cleanup even on error
  if (agentId) close_agent({ id: agentId });
  throw error;
}
```

---

## Reference Information

### Role Template Locations
- Templates: `~/.codex/workflows/cli-templates/planning-roles/`
- Format: `{role-name}.md` (e.g., `ux-expert.md`, `system-architect.md`)

### Context Package
- Location: `.workflow/active/WFS-{session}/.process/context-package.json`
- Used by: `context-search-agent` (Phase 0 of artifacts)
- Contains: Project context, tech stack, conflict risks

---

## Post-Phase Update

After Phase 2 completes:
- **Output Created**: `[role]/analysis*.md` for each selected role
- **Parallel Execution**: All N roles executed concurrently via spawn_agent + batch wait
- **Agent Cleanup**: All agents closed after wait completes
- **Next Action**: Auto-continue to Phase 3 (synthesis integration)
- **State Update**: Update workflow-session.json with role completion status
