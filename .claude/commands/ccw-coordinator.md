---
name: ccw-coordinator
description: Command orchestration tool - analyze requirements, recommend chain, execute sequentially with state persistence
argument-hint: "[task description]"
allowed-tools: Task(*), AskUserQuestion(*), Read(*), Write(*), Bash(*), Glob(*), Grep(*)
---

# CCW Coordinator Command

Interactive orchestration tool: analyze task → discover commands → recommend chain → execute sequentially → track state.

**Execution Model**: Pseudocode guidance. Claude intelligently executes each phase based on context.

## 3-Phase Workflow

### Phase 1: Analyze Requirements

Parse task to extract: goal, scope, constraints, complexity, and task type.

```javascript
function analyzeRequirements(taskDescription) {
  return {
    goal: extractMainGoal(taskDescription),           // e.g., "Implement user registration"
    scope: extractScope(taskDescription),             // e.g., ["auth", "user_management"]
    constraints: extractConstraints(taskDescription), // e.g., ["no breaking changes"]
    complexity: determineComplexity(taskDescription), // 'simple' | 'medium' | 'complex'
    task_type: detectTaskType(taskDescription)        // See task type patterns below
  };
}

// Task Type Detection Patterns
function detectTaskType(text) {
  // Priority order (first match wins)
  if (/fix|bug|error|crash|fail|debug|diagnose/.test(text)) return 'bugfix';
  if (/tdd|test-driven|先写测试|test first/.test(text)) return 'tdd';
  if (/测试失败|test fail|fix test|failing test/.test(text)) return 'test-fix';
  if (/generate test|写测试|add test|补充测试/.test(text)) return 'test-gen';
  if (/review|审查|code review/.test(text)) return 'review';
  if (/不确定|explore|研究|what if|brainstorm|权衡/.test(text)) return 'brainstorm';
  if (/多视角|比较方案|cross-verify|multi-cli/.test(text)) return 'multi-cli';
  return 'feature';  // Default
}

// Complexity Assessment
function determineComplexity(text) {
  let score = 0;
  if (/refactor|重构|migrate|迁移|architect|架构|system|系统/.test(text)) score += 2;
  if (/multiple|多个|across|跨|all|所有|entire|整个/.test(text)) score += 2;
  if (/integrate|集成|api|database|数据库/.test(text)) score += 1;
  if (/security|安全|performance|性能|scale|扩展/.test(text)) score += 1;
  return score >= 4 ? 'complex' : score >= 2 ? 'medium' : 'simple';
}
```

**Display to user**:
```
Analysis Complete:
  Goal: [extracted goal]
  Scope: [identified areas]
  Constraints: [identified constraints]
  Complexity: [level]
  Task Type: [detected type]
```

### Phase 2: Discover Commands & Recommend Chain

Dynamic command chain assembly using port-based matching.

#### Command Port Definition

Each command has input/output ports (tags) for pipeline composition:

```javascript
// Port labels represent data types flowing through the pipeline
const commandPorts = {
  'lite-plan': {
    name: 'lite-plan',
    input: ['requirement'],                    // 输入端口：需求
    output: ['plan'],                           // 输出端口：计划
    tags: ['planning']
  },
  'lite-execute': {
    name: 'lite-execute',
    input: ['plan'],                            // 输入端口：计划
    output: ['code'],                           // 输出端口：代码
    tags: ['execution']
  },
  'plan': {
    name: 'plan',
    input: ['requirement'],
    output: ['detailed-plan'],
    tags: ['planning']
  },
  'execute': {
    name: 'execute',
    input: ['detailed-plan'],                   // 从 plan 的输出匹配
    output: ['code'],
    tags: ['execution']
  },
  'test-cycle-execute': {
    name: 'test-cycle-execute',
    input: ['code'],                            // 输入端口：代码
    output: ['test-passed'],                    // 输出端口：测试通过
    tags: ['testing']
  },
  'tdd-plan': {
    name: 'tdd-plan',
    input: ['requirement'],
    output: ['tdd-tasks'],                      // TDD 任务
    tags: ['planning', 'tdd']
  },
  'execute': {
    name: 'execute',
    input: ['tdd-tasks'],
    output: ['code'],
    tags: ['execution']
  },
  'tdd-verify': {
    name: 'tdd-verify',
    input: ['code'],
    output: ['tdd-verified'],
    tags: ['testing']
  },
  'lite-fix': {
    name: 'lite-fix',
    input: ['bug-report'],                      // 输入端口：bug 报告
    output: ['fixed-code'],                     // 输出端口：修复后的代码
    tags: ['bugfix']
  },
  'debug': {
    name: 'debug',
    input: ['bug-report'],
    output: ['debug-log'],
    tags: ['bugfix']
  },
  'test-gen': {
    name: 'test-gen',
    input: ['code', 'session'],                 // 可接受代码或会话
    output: ['tests'],
    tags: ['testing']
  },
  'test-fix-gen': {
    name: 'test-fix-gen',
    input: ['failing-tests', 'session'],
    output: ['test-tasks'],
    tags: ['testing']
  },
  'review': {
    name: 'review',
    input: ['code', 'session'],
    output: ['review-findings'],
    tags: ['review']
  },
  'review-fix': {
    name: 'review-fix',
    input: ['review-findings'],
    output: ['fixed-code'],
    tags: ['review']
  },
  'brainstorm:auto-parallel': {
    name: 'brainstorm:auto-parallel',
    input: ['exploration-topic'],               // 输入端口：探索主题
    output: ['brainstorm-analysis'],
    tags: ['brainstorm']
  },
  'multi-cli-plan': {
    name: 'multi-cli-plan',
    input: ['requirement'],
    output: ['comparison-plan'],                // 对比分析计划
    tags: ['planning', 'multi-cli']
  },
  'plan-verify': {
    name: 'plan-verify',
    input: ['detailed-plan'],
    output: ['verified-plan'],
    tags: ['planning']
  },
  'review-session-cycle': {
    name: 'review-session-cycle',
    input: ['code'],
    output: ['review-verified'],
    tags: ['review']
  }
};
```

#### Recommendation Algorithm

```javascript
async function recommendCommandChain(analysis) {
  // Step 1: 根据任务类型确定起始端口和目标端口
  const { inputPort, outputPort } = determinePortFlow(analysis.task_type, analysis.constraints);

  // Step 2: Claude 根据命令端口定义和任务特征，智能选择命令序列
  // 优先级：简单任务 → lite-* 命令，复杂任务 → 完整命令，特殊约束 → 调整流程
  const chain = selectChainByPorts(inputPort, outputPort, analysis);

  return chain;
}

// 任务类型对应的端口流
function determinePortFlow(taskType, constraints) {
  const flows = {
    'bugfix':     { inputPort: 'bug-report', outputPort: constraints?.includes('skip-tests') ? 'fixed-code' : 'test-passed' },
    'tdd':        { inputPort: 'requirement', outputPort: 'tdd-verified' },
    'test-fix':   { inputPort: 'failing-tests', outputPort: 'test-passed' },
    'test-gen':   { inputPort: 'code', outputPort: 'test-passed' },
    'review':     { inputPort: 'code', outputPort: 'review-verified' },
    'brainstorm': { inputPort: 'exploration-topic', outputPort: 'test-passed' },
    'multi-cli':  { inputPort: 'requirement', outputPort: 'test-passed' },
    'feature':    { inputPort: 'requirement', outputPort: constraints?.includes('skip-tests') ? 'code' : 'test-passed' }
  };
  return flows[taskType] || flows['feature'];
}

// Claude 根据端口流选择命令链
function selectChainByPorts(inputPort, outputPort, analysis) {
  // 参考下面的命令端口定义表和执行示例，Claude 智能选择合适的命令序列
  // 返回值示例: [lite-plan, lite-execute, test-cycle-execute]
}
```

#### Display to User

```
Recommended Command Chain:

Pipeline (管道视图):
需求 → lite-plan → 计划 → lite-execute → 代码 → test-cycle-execute → 测试通过

Commands (命令列表):
1. /workflow:lite-plan
2. /workflow:lite-execute
3. /workflow:test-cycle-execute

Proceed? [Confirm / Show Details / Adjust / Cancel]
```

### Phase 2b: Get User Confirmation

```javascript
async function getUserConfirmation(chain) {
  const response = await AskUserQuestion({
    questions: [{
      question: 'Proceed with this command chain?',
      header: 'Confirm',
      options: [
        { label: 'Confirm and execute', description: 'Proceed with commands' },
        { label: 'Show details', description: 'View each command' },
        { label: 'Adjust chain', description: 'Remove or reorder' },
        { label: 'Cancel', description: 'Abort' }
      ]
    }]
  });

  if (response.confirm === 'Cancel') throw new Error('Cancelled');
  if (response.confirm === 'Show details') {
    displayCommandDetails(chain);
    return getUserConfirmation(chain);
  }
  if (response.confirm === 'Adjust chain') {
    return await adjustChain(chain);
  }
  return chain;
}
```

### Phase 3: Execute Sequential Command Chain

```javascript
async function executeCommandChain(chain, analysis) {
  const sessionId = `ccw-coord-${Date.now()}`;
  const stateDir = `.workflow/.ccw-coordinator/${sessionId}`;
  Bash(`mkdir -p "${stateDir}"`);

  const state = {
    session_id: sessionId,
    status: 'running',
    created_at: new Date().toISOString(),
    analysis: analysis,
    command_chain: chain,
    execution_results: [],
    prompts_used: []
  };

  for (let i = 0; i < chain.length; i++) {
    const cmd = chain[i];
    console.log(`[${i+1}/${chain.length}] ${cmd.command}`);

    // Assemble prompt with previous results
    const prompt = `Task: ${analysis.goal}\n`;
    if (state.execution_results.length > 0) {
      prompt += '\nPrevious results:\n';
      state.execution_results.forEach(r => {
        if (r.session_id) {
          prompt += `- ${r.command}: ${r.session_id} (${r.artifacts?.join(', ') || 'completed'})\n`;
        }
      });
    }
    prompt += `\n${formatCommand(cmd, state.execution_results, analysis)}\n`;

    // Execute via ccw cli
    try {
      const result = Bash(
        `ccw cli -p "${escapePrompt(prompt)}" --tool claude --mode write -y`,
        { run_in_background: true }
      );
      const parsed = parseOutput(result.stdout);

      // Record result
      state.execution_results.push({
        index: i,
        command: cmd.command,
        status: 'completed',
        session_id: parsed.sessionId,
        artifacts: parsed.artifacts,
        timestamp: new Date().toISOString()
      });

      console.log(`✓ ${parsed.sessionId}\n`);

    } catch (error) {
      const action = await AskUserQuestion({
        questions: [{
          question: `${cmd.command} failed. What to do?`,
          header: 'Error',
          options: [
            { label: 'Retry', description: 'Try again' },
            { label: 'Skip', description: 'Continue' },
            { label: 'Abort', description: 'Stop' }
          ]
        }]
      });

      if (action.error === 'retry') {
        i--;
      } else if (action.error === 'abort') {
        state.status = 'failed';
        break;
      }
    }

    // Save state after each command
    Write(`${stateDir}/state.json`, JSON.stringify(state, null, 2));
  }

  state.status = 'completed';
  state.updated_at = new Date().toISOString();
  Write(`${stateDir}/state.json`, JSON.stringify(state, null, 2));

  return state;
}

// Smart parameter assembly
function formatCommand(cmd, previousResults, analysis) {
  let line = cmd.command + ' --yes';
  const name = cmd.name;

  // Planning commands - take task description
  if (['lite-plan', 'plan', 'tdd-plan', 'multi-cli-plan'].includes(name)) {
    line += ` "${analysis.goal}"`;

  // Lite execution - use --in-memory if plan exists
  } else if (name === 'lite-execute') {
    const hasPlan = previousResults.some(r => r.command.includes('plan'));
    line += hasPlan ? ' --in-memory' : ` "${analysis.goal}"`;

  // Standard execution - resume from planning session
  } else if (name === 'execute') {
    const plan = previousResults.find(r => r.command.includes('plan'));
    if (plan?.session_id) line += ` --resume-session="${plan.session_id}"`;

  // Bug fix commands - take bug description
  } else if (['lite-fix', 'debug'].includes(name)) {
    line += ` "${analysis.goal}"`;

  // Brainstorm - take topic description
  } else if (name === 'brainstorm:auto-parallel' || name === 'auto-parallel') {
    line += ` "${analysis.goal}"`;

  // Test generation from session - needs source session
  } else if (name === 'test-gen') {
    const impl = previousResults.find(r =>
      r.command.includes('execute') || r.command.includes('lite-execute')
    );
    if (impl?.session_id) line += ` "${impl.session_id}"`;
    else line += ` "${analysis.goal}"`;

  // Test fix generation - session or description
  } else if (name === 'test-fix-gen') {
    const latest = previousResults.filter(r => r.session_id).pop();
    if (latest?.session_id) line += ` "${latest.session_id}"`;
    else line += ` "${analysis.goal}"`;

  // Review commands - take session or use latest
  } else if (name === 'review') {
    const latest = previousResults.filter(r => r.session_id).pop();
    if (latest?.session_id) line += ` --session="${latest.session_id}"`;

  // Review fix - takes session from review
  } else if (name === 'review-fix') {
    const review = previousResults.find(r => r.command.includes('review'));
    const latest = review || previousResults.filter(r => r.session_id).pop();
    if (latest?.session_id) line += ` --session="${latest.session_id}"`;

  // TDD verify - takes execution session
  } else if (name === 'tdd-verify') {
    const exec = previousResults.find(r => r.command.includes('execute'));
    if (exec?.session_id) line += ` --session="${exec.session_id}"`;

  // Session-based commands (test-cycle, review-session, plan-verify)
  } else if (name.includes('test') || name.includes('review') || name.includes('verify')) {
    const latest = previousResults.filter(r => r.session_id).pop();
    if (latest?.session_id) line += ` --session="${latest.session_id}"`;
  }

  return line;
}

// Parse command output
function parseOutput(output) {
  const sessionMatch = output.match(/WFS-[\w-]+/);
  const artifacts = [];
  output.matchAll(/\.workflow\/[^\s]+/g).forEach(m => artifacts.push(m[0]));
  return { sessionId: sessionMatch?.[0] || null, artifacts };
}
```

## State File Structure

**Location**: `.workflow/.ccw-coordinator/{session_id}/state.json`

```json
{
  "session_id": "ccw-coord-20250124-143025",
  "status": "running|completed|failed",
  "created_at": "2025-01-24T14:30:25Z",
  "updated_at": "2025-01-24T14:35:45Z",
  "analysis": {
    "goal": "Implement user registration",
    "scope": ["authentication", "user_management"],
    "constraints": ["no breaking changes"],
    "complexity": "medium"
  },
  "command_chain": [
    {
      "index": 0,
      "command": "/workflow:plan",
      "name": "plan",
      "description": "Detailed planning",
      "argumentHint": "[--explore] \"task\"",
      "status": "completed"
    },
    {
      "index": 1,
      "command": "/workflow:execute",
      "name": "execute",
      "description": "Execute with state resume",
      "argumentHint": "[--resume-session=\"WFS-xxx\"]",
      "status": "completed"
    },
    {
      "index": 2,
      "command": "/workflow:test-cycle-execute",
      "name": "test-cycle-execute",
      "status": "pending"
    }
  ],
  "execution_results": [
    {
      "index": 0,
      "command": "/workflow:plan",
      "status": "completed",
      "session_id": "WFS-plan-20250124",
      "artifacts": ["IMPL_PLAN.md", "exploration-architecture.json"],
      "timestamp": "2025-01-24T14:30:45Z"
    },
    {
      "index": 1,
      "command": "/workflow:execute",
      "status": "completed",
      "session_id": "WFS-execute-20250124",
      "artifacts": ["src/features/auth/**", "src/db/migrations/**"],
      "timestamp": "2025-01-24T14:32:15Z"
    }
  ],
  "prompts_used": [
    {
      "index": 0,
      "command": "/workflow:plan",
      "prompt": "Task: Implement user registration...\n\n/workflow:plan --yes \"Implement user registration...\""
    },
    {
      "index": 1,
      "command": "/workflow:execute",
      "prompt": "Task: Implement user registration...\n\nPrevious results:\n- /workflow:plan: WFS-plan-20250124 (IMPL_PLAN.md)\n\n/workflow:execute --yes --resume-session=\"WFS-plan-20250124\""
    }
  ]
}
```

## CommandRegistry Integration

Sole CCW tool for command discovery:

```javascript
import { CommandRegistry } from 'ccw/tools/command-registry';

const registry = new CommandRegistry();

// Get all commands
const allCommands = registry.getAllCommandsSummary();
// Map<"/workflow:lite-plan" => {name, description}>

// Get categorized
const byCategory = registry.getAllCommandsByCategory();
// {planning, execution, testing, review, other}

// Get single command metadata
const cmd = registry.getCommand('lite-plan');
// {name, command, description, argumentHint, allowedTools, filePath}
```

## Execution Examples

### Simple Feature
```
Goal: Add API endpoint for user profile
Scope: [api]
Complexity: simple
Constraints: []
Task Type: feature

Pipeline:
需求 → lite-plan → 计划 → lite-execute → 代码 → test-cycle-execute → 测试通过

Chain:
1. /workflow:lite-plan --yes "Add API endpoint..."
2. /workflow:lite-execute --yes --in-memory
3. /workflow:test-cycle-execute --yes --session="WFS-xxx"
```

### Complex Feature with Verification
```
Goal: Implement OAuth2 authentication system
Scope: [auth, database, api, frontend]
Complexity: complex
Constraints: [no breaking changes]
Task Type: feature

Pipeline:
需求 → plan → 详细计划 → plan-verify → 验证计划 → execute → 代码
     → review-session-cycle → 审查通过 → test-cycle-execute → 测试通过

Chain:
1. /workflow:plan --yes "Implement OAuth2..."
2. /workflow:plan-verify --yes --session="WFS-xxx"
3. /workflow:execute --yes --resume-session="WFS-xxx"
4. /workflow:review-session-cycle --yes --session="WFS-xxx"
5. /workflow:test-cycle-execute --yes --session="WFS-xxx"
```

### Quick Bug Fix
```
Goal: Fix login timeout issue
Scope: [auth]
Complexity: simple
Constraints: [urgent]
Task Type: bugfix

Pipeline:
Bug报告 → lite-fix → 修复代码 → test-cycle-execute → 测试通过

Chain:
1. /workflow:lite-fix --yes "Fix login timeout..."
2. /workflow:test-cycle-execute --yes --session="WFS-xxx"
```

### Skip Tests
```
Goal: Update documentation
Scope: [docs]
Complexity: simple
Constraints: [skip-tests]
Task Type: feature

Pipeline:
需求 → lite-plan → 计划 → lite-execute → 代码

Chain:
1. /workflow:lite-plan --yes "Update documentation..."
2. /workflow:lite-execute --yes --in-memory
```

### TDD Workflow
```
Goal: Implement user authentication with test-first approach
Scope: [auth]
Complexity: medium
Constraints: [test-driven]
Task Type: tdd

Pipeline:
需求 → tdd-plan → TDD任务 → execute → 代码 → tdd-verify → TDD验证通过

Chain:
1. /workflow:tdd-plan --yes "Implement user authentication..."
2. /workflow:execute --yes --resume-session="WFS-xxx"
3. /workflow:tdd-verify --yes --session="WFS-xxx"
```

### Debug Workflow
```
Goal: Fix memory leak in WebSocket handler
Scope: [websocket]
Complexity: medium
Constraints: [production-issue]
Task Type: bugfix

Pipeline (快速修复):
Bug报告 → lite-fix → 修复代码 → test-cycle-execute → 测试通过

Pipeline (系统调试):
Bug报告 → debug → 调试日志 → 分析定位 → 修复

Chain:
1. /workflow:lite-fix --yes "Fix memory leak in WebSocket..."
2. /workflow:test-cycle-execute --yes --session="WFS-xxx"

OR (for hypothesis-driven debugging):
1. /workflow:debug --yes "Memory leak in WebSocket handler..."
```

### Test Fix Workflow
```
Goal: Fix failing authentication tests
Scope: [auth, tests]
Complexity: simple
Constraints: []
Task Type: test-fix

Pipeline:
失败测试 → test-fix-gen → 测试任务 → test-cycle-execute → 测试通过

Chain:
1. /workflow:test-fix-gen --yes "WFS-auth-impl-001"
2. /workflow:test-cycle-execute --yes --session="WFS-test-xxx"
```

### Test Generation from Implementation
```
Goal: Generate tests for completed user registration feature
Scope: [auth, tests]
Complexity: medium
Constraints: []
Task Type: test-gen

Pipeline:
代码 → test-gen → 测试 → test-cycle-execute → 测试通过

Chain:
1. /workflow:test-gen --yes "WFS-registration-20250124"
2. /workflow:test-cycle-execute --yes --session="WFS-test-xxx"
```

### Review + Fix Workflow
```
Goal: Code review of payment module
Scope: [payment]
Complexity: medium
Constraints: []
Task Type: review

Pipeline:
代码 → review → 审查发现 → review-fix → 修复代码 → test-cycle-execute → 测试通过

Chain:
1. /workflow:review --yes --session="WFS-payment-impl"
2. /workflow:review-fix --yes --session="WFS-payment-impl"
3. /workflow:test-cycle-execute --yes --session="WFS-payment-impl"
```

### Brainstorm Workflow (Uncertain Requirements)
```
Goal: Explore solutions for real-time notification system
Scope: [notifications, architecture]
Complexity: complex
Constraints: []
Task Type: brainstorm

Pipeline:
探索主题 → brainstorm:auto-parallel → 分析结果 → plan → 详细计划
     → plan-verify → 验证计划 → execute → 代码 → test-cycle-execute → 测试通过

Chain:
1. /workflow:brainstorm:auto-parallel --yes "Explore solutions for real-time..."
2. /workflow:plan --yes "Implement chosen notification approach..."
3. /workflow:plan-verify --yes --session="WFS-xxx"
4. /workflow:execute --yes --resume-session="WFS-xxx"
5. /workflow:test-cycle-execute --yes --session="WFS-xxx"
```

### Multi-CLI Plan (Multi-Perspective Analysis)
```
Goal: Compare microservices vs monolith architecture
Scope: [architecture]
Complexity: complex
Constraints: []
Task Type: multi-cli

Pipeline:
需求 → multi-cli-plan → 对比计划 → lite-execute → 代码 → test-cycle-execute → 测试通过

Chain:
1. /workflow:multi-cli-plan --yes "Compare microservices vs monolith..."
2. /workflow:lite-execute --yes --in-memory
3. /workflow:test-cycle-execute --yes --session="WFS-xxx"
```

## Execution Flow

```javascript
// Main entry point
async function ccwCoordinator(taskDescription) {
  // Phase 1
  const analysis = await analyzeRequirements(taskDescription);

  // Phase 2
  const chain = await recommendCommandChain(analysis);
  const confirmedChain = await getUserConfirmation(chain);

  // Phase 3
  const state = await executeCommandChain(confirmedChain, analysis);

  console.log(`✅ Complete! Session: ${state.session_id}`);
  console.log(`State: .workflow/.ccw-coordinator/${state.session_id}/state.json`);
}
```

## Key Design Principles

1. **No Fixed Logic** - Claude intelligently decides based on analysis
2. **Dynamic Discovery** - CommandRegistry retrieves available commands
3. **Smart Parameters** - Command args assembled based on previous results
4. **Full State Tracking** - All execution recorded to state.json
5. **User Control** - Confirmation + error handling with user choice
6. **Context Passing** - Each prompt includes previous results
7. **Resumable** - Can load state.json to continue

## Available Commands

All from `~/.claude/commands/workflow/`:

**Planning**: lite-plan, plan, multi-cli-plan, plan-verify, tdd-plan
**Execution**: lite-execute, execute, develop-with-file
**Testing**: test-cycle-execute, test-gen, test-fix-gen, tdd-verify
**Review**: review, review-session-cycle, review-module-cycle, review-fix
**Bug Fixes**: lite-fix, debug, debug-with-file
**Brainstorming**: brainstorm:auto-parallel, brainstorm:artifacts, brainstorm:synthesis
**Design**: ui-design:*, animation-extract, layout-extract, style-extract, codify-style
**Session Management**: session:start, session:resume, session:complete, session:solidify, session:list
**Tools**: context-gather, test-context-gather, task-generate, conflict-resolution, action-plan-verify
**Utility**: clean, init, replan

### Task Type Routing (Pipeline View)

| Task Type | Pipeline |
|-----------|----------|
| **feature** (simple) | 需求 → lite-plan → 计划 → lite-execute → 代码 → test-cycle-execute → 测试通过 |
| **feature** (complex) | 需求 → plan → 详细计划 → plan-verify → 验证计划 → execute → 代码 → review-session-cycle → 审查通过 → test-cycle-execute → 测试通过 |
| **bugfix** | Bug报告 → lite-fix → 修复代码 → test-cycle-execute → 测试通过 |
| **tdd** | 需求 → tdd-plan → TDD任务 → execute → 代码 → tdd-verify → TDD验证通过 |
| **test-fix** | 失败测试 → test-fix-gen → 测试任务 → test-cycle-execute → 测试通过 |
| **test-gen** | 代码 → test-gen → 测试 → test-cycle-execute → 测试通过 |
| **review** | 代码 → review → 审查发现 → review-fix → 修复代码 → test-cycle-execute → 测试通过 |
| **brainstorm** | 探索主题 → brainstorm:auto-parallel → 分析结果 → plan → 详细计划 → execute → 代码 → test-cycle-execute → 测试通过 |
| **multi-cli** | 需求 → multi-cli-plan → 对比计划 → lite-execute → 代码 → test-cycle-execute → 测试通过 |

Use `CommandRegistry.getAllCommandsSummary()` to discover all commands dynamically.
