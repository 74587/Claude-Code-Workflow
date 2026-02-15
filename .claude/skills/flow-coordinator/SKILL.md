---
name: flow-coordinator
description: Template-driven workflow coordinator with minimal state tracking. Executes command chains from workflow templates OR unified PromptTemplate workflows. Supports slash-command and DAG-based execution. Triggers on "flow-coordinator", "workflow template", "orchestrate".
allowed-tools: Task, AskUserQuestion, Read, Write, Bash, Glob, Grep
---

# Flow Coordinator

Lightweight workflow coordinator supporting two workflow formats:
1. **Legacy Templates**: Command chains with slash-command execution
2. **Unified Workflows**: DAG-based PromptTemplate nodes (spec: `spec/unified-workflow-spec.md`)

## Specification Reference

- **Unified Workflow Spec**: @spec/unified-workflow-spec.md
- **Demo Workflow**: `ccw/data/flows/demo-unified-workflow.json`

## Architecture

```
User Task → Detect Format → Select Workflow → Init Status → Execute → Complete
                │                                              │
                ├─ Legacy Template                             │
                │   └─ Sequential cmd execution                │
                │                                              │
                └─ Unified Workflow                            │
                    └─ DAG traversal with contextRefs          │
                                                               │
     └──────────────── Resume (from status.json) ──────────────┘

Execution Modes:
  ├─ analysis     → Read-only, CLI --mode analysis
  ├─ write        → File changes, CLI --mode write
  ├─ mainprocess  → Blocking, synchronous
  └─ async        → Background, ccw cli
```

## Core Concepts

**Dual Format Support**:
- Legacy: `templates/*.json` with `cmd`, `args`, `execution`
- Unified: `ccw/data/flows/*.json` with `nodes`, `edges`, `contextRefs`

**Unified PromptTemplate Model**: All workflow steps are natural language instructions with:
- `instruction`: What to execute (natural language)
- `slashCommand`: Optional slash command name (e.g., "workflow:plan")
- `slashArgs`: Optional arguments for slash command (supports {{variable}})
- `outputName`: Name for output reference
- `contextRefs`: References to previous step outputs
- `tool`: Optional CLI tool (gemini/qwen/codex/claude)
- `mode`: Execution mode (analysis/write/mainprocess/async)

**DAG Execution**: Unified workflows execute as directed acyclic graphs with parallel branches and conditional edges.

**Dynamic Discovery**: Both formats discovered at runtime via Glob.

---

## Execution Flow

```javascript
async function execute(task) {
  // 1. Discover and select template
  const templates = await discoverTemplates();
  const template = await selectTemplate(templates);

  // 2. Init status
  const sessionId = `fc-${timestamp()}`;
  const statusPath = `.workflow/.flow-coordinator/${sessionId}/status.json`;
  const status = initStatus(template, task);
  write(statusPath, JSON.stringify(status, null, 2));

  // 3. Execute steps based on execution config
  await executeSteps(status, statusPath);
}

async function executeSteps(status, statusPath) {
  for (let i = status.current; i < status.steps.length; i++) {
    const step = status.steps[i];
    status.current = i;

    // Execute based on step mode (all steps use slash-command type)
    const execConfig = step.execution || { type: 'slash-command', mode: 'mainprocess' };

    if (execConfig.mode === 'async') {
      // Async execution - stop and wait for hook callback
      await executeSlashCommandAsync(step, status, statusPath);
      break;
    } else {
      // Mainprocess execution - continue immediately
      await executeSlashCommandSync(step, status);
      step.status = 'done';
      write(statusPath, JSON.stringify(status, null, 2));
    }
  }

  // All steps complete
  if (status.current >= status.steps.length) {
    status.complete = true;
    write(statusPath, JSON.stringify(status, null, 2));
  }
}
```

---

## Unified Workflow Execution

For workflows using the unified PromptTemplate format (`ccw/data/flows/*.json`):

```javascript
async function executeUnifiedWorkflow(workflow, task) {
  // 1. Initialize execution state
  const sessionId = `ufc-${timestamp()}`;
  const statusPath = `.workflow/.flow-coordinator/${sessionId}/status.json`;
  const state = {
    id: sessionId,
    workflow: workflow.id,
    goal: task,
    nodeStates: {},  // nodeId -> { status, result, error }
    outputs: {},     // outputName -> result
    complete: false
  };

  // 2. Topological sort for execution order
  const executionOrder = topologicalSort(workflow.nodes, workflow.edges);

  // 3. Execute nodes respecting DAG dependencies
  await executeDAG(workflow, executionOrder, state, statusPath);
}

async function executeDAG(workflow, order, state, statusPath) {
  for (const nodeId of order) {
    const node = workflow.nodes.find(n => n.id === nodeId);
    const data = node.data;

    // Check if all dependencies are satisfied
    if (!areDependenciesSatisfied(nodeId, workflow.edges, state)) {
      continue; // Will be executed when dependencies complete
    }

    // Build instruction from slashCommand or raw instruction
    let instruction = buildNodeInstruction(data, state.outputs);

    // Execute based on mode
    state.nodeStates[nodeId] = { status: 'running' };
    write(statusPath, JSON.stringify(state, null, 2));

    const result = await executeNode(instruction, data.tool, data.mode);

    // Store output for downstream nodes
    state.nodeStates[nodeId] = { status: 'completed', result };
    if (data.outputName) {
      state.outputs[data.outputName] = result;
    }
    write(statusPath, JSON.stringify(state, null, 2));
  }

  state.complete = true;
  write(statusPath, JSON.stringify(state, null, 2));
}

/**
 * Build node instruction from slashCommand or raw instruction
 * Handles slashCommand/slashArgs fields from frontend orchestrator
 */
function buildNodeInstruction(data, outputs) {
  const refs = data.contextRefs || [];

  // If slashCommand is set, construct instruction from it
  if (data.slashCommand) {
    // Resolve variables in slashArgs
    const args = data.slashArgs
      ? resolveContextRefs(data.slashArgs, refs, outputs)
      : '';

    // Build slash command instruction
    let instruction = `/${data.slashCommand}${args ? ' ' + args : ''}`;

    // Append additional instruction if provided
    if (data.instruction) {
      const additionalInstruction = resolveContextRefs(data.instruction, refs, outputs);
      instruction = `${instruction}\n\n${additionalInstruction}`;
    }

    return instruction;
  }

  // Fallback: use raw instruction with context refs resolved
  return resolveContextRefs(data.instruction || '', refs, outputs);
}

function resolveContextRefs(instruction, refs, outputs) {
  let resolved = instruction;
  for (const ref of refs) {
    const value = outputs[ref];
    const placeholder = `{{${ref}}}`;
    resolved = resolved.replace(new RegExp(placeholder, 'g'),
      typeof value === 'object' ? JSON.stringify(value) : String(value));
  }
  return resolved;
}

async function executeNode(instruction, tool, mode) {
  // Build CLI command based on tool and mode
  const cliTool = tool || 'gemini';
  const cliMode = mode === 'write' ? 'write' : 'analysis';

  if (mode === 'async') {
    // Background execution
    return Bash(
      `ccw cli -p "${escapePrompt(instruction)}" --tool ${cliTool} --mode ${cliMode}`,
      { run_in_background: true }
    );
  } else {
    // Synchronous execution
    return Bash(
      `ccw cli -p "${escapePrompt(instruction)}" --tool ${cliTool} --mode ${cliMode}`
    );
  }
}
```

### Unified Workflow Discovery

```javascript
async function discoverUnifiedWorkflows() {
  const files = Glob('*.json', { path: 'ccw/data/flows/' });

  const workflows = [];
  for (const file of files) {
    const content = JSON.parse(Read(file));
    // Detect unified format by checking for 'nodes' array
    if (content.nodes && Array.isArray(content.nodes)) {
      workflows.push({
        id: content.id,
        name: content.name,
        description: content.description,
        nodeCount: content.nodes.length,
        format: 'unified',
        file: file
      });
    }
  }
  return workflows;
}
```

### Format Detection

```javascript
function detectWorkflowFormat(content) {
  if (content.nodes && content.edges) {
    return 'unified';  // PromptTemplate DAG format
  }
  if (content.steps && content.steps[0]?.cmd) {
    return 'legacy';   // Command chain format
  }
  throw new Error('Unknown workflow format');
}
```

---

## Legacy Template Discovery

**Dynamic query** - never hardcode template list:

```javascript
async function discoverTemplates() {
  // Discover all JSON templates
  const files = Glob('*.json', { path: 'templates/' });

  // Parse each template
  const templates = [];
  for (const file of files) {
    const content = JSON.parse(Read(file));
    templates.push({
      name: content.name,
      description: content.description,
      steps: content.steps.map(s => s.cmd).join(' → '),
      file: file
    });
  }

  return templates;
}
```

---

## Template Selection

User chooses from discovered templates:

```javascript
async function selectTemplate(templates) {
  // Build options from discovered templates
  const options = templates.slice(0, 4).map(t => ({
    label: t.name,
    description: t.steps
  }));

  const response = await AskUserQuestion({
    questions: [{
      question: 'Select workflow template:',
      header: 'Template',
      options: options,
      multiSelect: false
    }]
  });

  // Handle "Other" - show remaining templates or custom input
  if (response.template === 'Other') {
    return await selectFromRemainingTemplates(templates.slice(4));
  }

  return templates.find(t => t.name === response.template);
}
```

---

## Status Schema

**Creation**: Copy template JSON → Update `id`, `template`, `goal`, set all steps `status: "pending"`

**Location**: `.workflow/.flow-coordinator/{session-id}/status.json`

**Core Fields**:
- `id`: Session ID (fc-YYYYMMDD-HHMMSS)
- `template`: Template name
- `goal`: User task description
- `current`: Current step index
- `steps[]`: Step array from template (with runtime `status`, `session`, `taskId`)
- `complete`: All steps done?

**Step Status**: `pending` → `running` → `done` | `failed` | `skipped`

---

## Extended Template Schema

**Templates stored in**: `templates/*.json` (discovered at runtime via Glob)

**TemplateStep Fields**:
- `cmd`: Skill name or command path (e.g., `workflow-lite-plan`, `workflow:debug-with-file`, `issue:discover`)
- `route?`: Sub-mode for multi-mode Skills (e.g., `lite-execute`, `plan-verify`, `test-cycle-execute`)
- `args?`: Arguments with `{{goal}}` and `{{prev}}` placeholders
- `unit?`: Minimum execution unit name (groups related commands)
- `optional?`: Can be skipped by user
- `execution`: Type and mode configuration
  - `type`: Always `'slash-command'` (invoked via Skill tool)
  - `mode`: `'mainprocess'` (blocking) or `'async'` (background)
- `contextHint?`: Natural language guidance for context assembly

**cmd 命名规则**:
- **Skills（已迁移）**: 使用连字符格式 Skill 名称，如 `workflow-lite-plan`、`review-cycle`
- **Commands（仍存在）**: 使用冒号格式命令路径，如 `workflow:brainstorm-with-file`、`issue:discover`

**route 字段**:
多模式 Skill 通过 `route` 区分子模式。同一 Skill 的不同步骤共享 `cmd`，通过 `route` 路由：
| Skill | 默认模式 (无 route) | route 值 |
|-------|-------------------|----------|
| `workflow-lite-plan` | lite-plan | `lite-execute` |
| `workflow-plan` | plan | `plan-verify`, `replan` |
| `workflow-test-fix` | test-fix-gen | `test-cycle-execute` |
| `workflow-tdd` | tdd-plan | `tdd-verify` |
| `review-cycle` | - | `session`, `module`, `fix` |

**Template Example**:
```json
{
  "name": "rapid",
  "steps": [
    {
      "cmd": "workflow-lite-plan",
      "args": "\"{{goal}}\"",
      "unit": "quick-implementation",
      "execution": { "type": "slash-command", "mode": "mainprocess" },
      "contextHint": "Create lightweight implementation plan"
    },
    {
      "cmd": "workflow-lite-plan",
      "route": "lite-execute",
      "args": "--in-memory",
      "unit": "quick-implementation",
      "execution": { "type": "slash-command", "mode": "async" },
      "contextHint": "Execute plan from previous step"
    }
  ]
}
```

---

## Execution Implementation

### Mainprocess Mode (Blocking)

```javascript
async function executeSlashCommandSync(step, status) {
  // Build Skill invocation args
  const args = buildSkillArgs(step, status);

  // Invoke via Skill tool: step.cmd is skill name or command path
  const result = await Skill({ skill: step.cmd, args: args });

  step.session = result.session_id;
  step.status = 'done';
  return result;
}
```

### Async Mode (Background)

```javascript
async function executeSlashCommandAsync(step, status, statusPath) {
  // Build prompt for ccw cli: /<cmd> [--route <route>] args + context
  const prompt = buildCommandPrompt(step, status);

  step.status = 'running';
  write(statusPath, JSON.stringify(status, null, 2));

  // Execute via ccw cli in background
  const taskId = Bash(
    `ccw cli -p "${escapePrompt(prompt)}" --tool claude --mode write`,
    { run_in_background: true }
  ).task_id;

  step.taskId = taskId;
  write(statusPath, JSON.stringify(status, null, 2));

  console.log(`Executing: ${step.cmd}${step.route ? ' --route ' + step.route : ''} (async)`);
  console.log(`Resume: /flow-coordinator --resume ${status.id}`);
}
```

---

## Prompt Building

Prompts are built in format: `/<cmd> [--route <route>] -y args` + context

```javascript
function buildCommandPrompt(step, status) {
  // step.cmd is skill name or command path
  let prompt = `/${step.cmd}`;

  // Add route for multi-mode Skills
  if (step.route) {
    prompt += ` --route ${step.route}`;
  }

  prompt += ' -y';

  // Add arguments (with placeholder replacement)
  if (step.args) {
    const args = step.args
      .replace('{{goal}}', status.goal)
      .replace('{{prev}}', getPreviousSessionId(status));
    prompt += ` ${args}`;
  }

  // Add context based on contextHint
  if (step.contextHint) {
    const context = buildContextFromHint(step.contextHint, status);
    prompt += `\n\nContext:\n${context}`;
  } else {
    // Default context: previous session IDs
    const previousContext = collectPreviousResults(status);
    if (previousContext) {
      prompt += `\n\nPrevious results:\n${previousContext}`;
    }
  }

  return prompt;
}

/**
 * Build args for Skill() invocation (mainprocess mode)
 */
function buildSkillArgs(step, status) {
  let args = '';

  // Add route for multi-mode Skills
  if (step.route) {
    args += `--route ${step.route} `;
  }

  args += '-y';

  // Add step arguments
  if (step.args) {
    const resolvedArgs = step.args
      .replace('{{goal}}', status.goal)
      .replace('{{prev}}', getPreviousSessionId(status));
    args += ` ${resolvedArgs}`;
  }

  return args;
}

function buildContextFromHint(hint, status) {
  // Parse contextHint instruction and build context accordingly
  return parseAndBuildContext(hint, status);
}
```

### Example Prompt Output

```
/workflow-lite-plan -y "Implement user registration"

Context:
Task: Implement user registration
Previous results:
- None (first step)
```

```
/workflow-lite-plan --route lite-execute -y --in-memory

Context:
Task: Implement user registration
Previous results:
- lite-plan: WFS-plan-20250130 (planning-context.md)
```

---

## User Interaction

### Step 1: Select Template

```
Select workflow template:

○ rapid      lite-plan → lite-execute → test-cycle-execute
○ coupled    plan → plan-verify → execute → review → test
○ bugfix     lite-plan --bugfix → lite-execute → test-cycle-execute
○ tdd        tdd-plan → execute → tdd-verify
○ Other      (more templates or custom)
```

### Step 2: Review Execution Plan

```
Template: coupled
Steps:
  1. workflow-plan (mainprocess)
  2. workflow-plan --route plan-verify (mainprocess)
  3. workflow-execute (async)
  4. review-cycle --route session (mainprocess)
  5. review-cycle --route fix (mainprocess)
  6. workflow-test-fix (mainprocess)
  7. workflow-test-fix --route test-cycle-execute (async)

Proceed? [Confirm / Cancel]
```

---

## Resume Capability

```javascript
async function resume(sessionId) {
  const statusPath = `.workflow/.flow-coordinator/${sessionId}/status.json`;
  const status = JSON.parse(Read(statusPath));

  // Find first incomplete step
  status.current = status.steps.findIndex(s => s.status !== 'done');
  if (status.current === -1) {
    console.log('All steps complete');
    return;
  }

  // Continue executing steps
  await executeSteps(status, statusPath);
}
```

---

## Available Templates

Templates discovered from `templates/*.json`:

| Template | Use Case | Steps |
|----------|----------|-------|
| rapid | Simple feature | workflow-lite-plan → workflow-lite-plan[lite-execute] → workflow-test-fix → workflow-test-fix[test-cycle-execute] |
| coupled | Complex feature | workflow-plan → workflow-plan[plan-verify] → workflow-execute → review-cycle[session] → review-cycle[fix] → workflow-test-fix → workflow-test-fix[test-cycle-execute] |
| bugfix | Bug fix | workflow-lite-plan --bugfix → workflow-lite-plan[lite-execute] → workflow-test-fix → workflow-test-fix[test-cycle-execute] |
| bugfix-hotfix | Urgent hotfix | workflow-lite-plan --hotfix |
| tdd | Test-driven | workflow-tdd → workflow-execute → workflow-tdd[tdd-verify] |
| test-fix | Fix failing tests | workflow-test-fix → workflow-test-fix[test-cycle-execute] |
| review | Code review | review-cycle[session] → review-cycle[fix] → workflow-test-fix → workflow-test-fix[test-cycle-execute] |
| multi-cli-plan | Multi-perspective planning | workflow-multi-cli-plan → workflow-lite-plan[lite-execute] → workflow-test-fix → workflow-test-fix[test-cycle-execute] |
| full | Complete workflow | brainstorm → workflow-plan → workflow-plan[plan-verify] → workflow-execute → workflow-test-fix → workflow-test-fix[test-cycle-execute] |
| docs | Documentation | workflow-lite-plan → workflow-lite-plan[lite-execute] |
| brainstorm | Exploration | workflow:brainstorm-with-file |
| debug | Debug with docs | workflow:debug-with-file |
| analyze | Collaborative analysis | workflow:analyze-with-file |
| issue | Issue workflow | issue:discover → issue:plan → issue:queue → issue:execute |
| rapid-to-issue | Plan to issue bridge | workflow-lite-plan → issue:convert-to-plan → issue:queue → issue:execute |
| brainstorm-to-issue | Brainstorm to issue | issue:from-brainstorm → issue:queue → issue:execute |

**注**: `[route]` 表示该步骤使用 `route` 字段路由到多模式 Skill 的特定子模式。

---

## Design Principles

1. **Minimal fields**: Only essential tracking data
2. **Flat structure**: No nested objects beyond steps array
3. **Step-level execution**: Each step defines how it's executed
4. **Resumable**: Any step can be resumed from status
5. **Human readable**: Clear JSON format

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| spec/unified-workflow-spec.md | Unified PromptTemplate workflow specification |
| ccw/data/flows/*.json | Unified workflows (DAG format, dynamic discovery) |
| templates/*.json | Legacy workflow templates (command chain format) |

### Demo Workflows (Unified Format)

| File | Description | Nodes |
|------|-------------|-------|
| `demo-unified-workflow.json` | Auth implementation | 7 nodes: Analyze → Plan → Implement → Review → Tests → Report |
| `parallel-ci-workflow.json` | CI/CD pipeline | 8 nodes: Parallel checks → Merge → Conditional notify |
| `simple-analysis-workflow.json` | Analysis pipeline | 3 nodes: Explore → Analyze → Report |
