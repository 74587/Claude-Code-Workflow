---
name: ccw-coordinator
description: Command orchestration tool - analyze requirements, recommend chain, execute sequentially with state persistence
argument-hint: "[task description]"
allowed-tools: Task(*), AskUserQuestion(*), Read(*), Write(*), Bash(*), Glob(*), Grep(*)
---

# CCW Coordinator Command

Interactive orchestration tool: analyze task → discover commands → recommend chain → execute sequentially → track state.

**Execution Model**: Pseudocode guidance. Claude intelligently executes each phase based on context.

## Core Concept: Minimum Execution Units (最小执行单元)

### What is a Minimum Execution Unit?

**Definition**: A set of commands that must execute together as an atomic group to achieve a meaningful workflow milestone. Splitting these commands breaks the logical flow and creates incomplete states.

**Why This Matters**:
- **Prevents Incomplete States**: Avoid stopping after task generation without execution
- **User Experience**: User gets complete results, not intermediate artifacts requiring manual follow-up
- **Workflow Integrity**: Maintains logical coherence of multi-step operations

### Minimum Execution Units

**Planning + Execution Units** (规划+执行单元):

| Unit Name | Commands | Purpose | Output |
|-----------|----------|---------|--------|
| **Quick Implementation** | lite-plan → lite-execute | Lightweight plan and immediate execution | Working code |
| **Multi-CLI Planning** | multi-cli-plan → lite-execute | Multi-perspective analysis and execution | Working code |
| **Bug Fix** | lite-fix → lite-execute | Quick bug diagnosis and fix execution | Fixed code |
| **Full Planning + Execution** | plan → execute | Detailed planning and execution | Working code |
| **Verified Planning + Execution** | plan → plan-verify → execute | Planning with verification and execution | Working code |
| **Replanning + Execution** | replan → execute | Update plan and execute changes | Working code |
| **TDD Planning + Execution** | tdd-plan → execute | Test-driven development planning and execution | Working code |
| **Test Generation + Execution** | test-gen → execute | Generate test suite and execute | Generated tests |

**Testing Units** (测试单元):

| Unit Name | Commands | Purpose | Output |
|-----------|----------|---------|--------|
| **Test Validation** | test-fix-gen → test-cycle-execute | Generate test tasks and execute test-fix cycle | Tests passed |

**Review Units** (审查单元):

| Unit Name | Commands | Purpose | Output |
|-----------|----------|---------|--------|
| **Code Review (Session)** | review-session-cycle → review-fix | Complete review cycle and apply fixes | Fixed code |
| **Code Review (Module)** | review-module-cycle → review-fix | Module review cycle and apply fixes | Fixed code |

### Command-to-Unit Mapping (命令与最小单元的映射)

| Command | Can Precede | Atomic Units |
|---------|-----------|--------------|
| lite-plan | lite-execute | Quick Implementation |
| multi-cli-plan | lite-execute | Multi-CLI Planning |
| lite-fix | lite-execute | Bug Fix |
| plan | plan-verify, execute | Full Planning + Execution, Verified Planning + Execution |
| plan-verify | execute | Verified Planning + Execution |
| replan | execute | Replanning + Execution |
| test-gen | execute | Test Generation + Execution |
| tdd-plan | execute | TDD Planning + Execution |
| review-session-cycle | review-fix | Code Review (Session) |
| review-module-cycle | review-fix | Code Review (Module) |
| test-fix-gen | test-cycle-execute | Test Validation |

### Atomic Group Rules

1. **Never Split Units**: Coordinator must recommend complete units, not partial chains
2. **Multi-Unit Participation**: Some commands can participate in multiple units (e.g., plan → execute or plan → plan-verify → execute)
3. **User Override**: User can explicitly request partial execution (advanced mode)
4. **Visualization**: Pipeline view shows unit boundaries with `【 】` markers
5. **Validation**: Before execution, verify all unit commands are included

**Example Pipeline with Units**:
```
需求 → 【lite-plan → lite-execute】→ 代码 → 【test-fix-gen → test-cycle-execute】→ 测试通过
       └──── Quick Implementation ────┘         └────── Test Validation ──────┘
```

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
    tags: ['planning'],
    atomic_group: 'quick-implementation'       // 最小单元：与 lite-execute 绑定
  },
  'lite-execute': {
    name: 'lite-execute',
    input: ['plan', 'multi-cli-plan', 'lite-fix'], // 输入端口：可接受多种规划输出
    output: ['code'],                           // 输出端口：代码
    tags: ['execution'],
    atomic_groups: [                           // 可参与多个最小单元
      'quick-implementation',                  // lite-plan → lite-execute
      'multi-cli-planning',                    // multi-cli-plan → lite-execute
      'bug-fix'                                // lite-fix → lite-execute
    ]
  },
  'plan': {
    name: 'plan',
    input: ['requirement'],
    output: ['detailed-plan'],
    tags: ['planning'],
    atomic_groups: [                           // 可参与多个最小单元
      'full-planning-execution',               // plan → execute
      'verified-planning-execution'            // plan → plan-verify → execute
    ]
  },
  'plan-verify': {
    name: 'plan-verify',
    input: ['detailed-plan'],
    output: ['verified-plan'],
    tags: ['planning'],
    atomic_group: 'verified-planning-execution' // 最小单元：plan → plan-verify → execute
  },
  'replan': {
    name: 'replan',
    input: ['session', 'feedback'],             // 输入端口：会话或反馈
    output: ['replan'],                         // 输出端口：更新后的计划（供 execute 执行）
    tags: ['planning'],
    atomic_group: 'replanning-execution'       // 最小单元：与 execute 绑定
  },
  'execute': {
    name: 'execute',
    input: ['detailed-plan', 'verified-plan', 'replan', 'test-tasks', 'tdd-tasks'], // 可接受多种规划输出
    output: ['code'],
    tags: ['execution'],
    atomic_groups: [                           // 可参与多个最小单元
      'full-planning-execution',               // plan → execute
      'verified-planning-execution',           // plan → plan-verify → execute
      'replanning-execution',                  // replan → execute
      'test-generation-execution',             // test-gen → execute
      'tdd-planning-execution'                 // tdd-plan → execute
    ]
  },
  'test-cycle-execute': {
    name: 'test-cycle-execute',
    input: ['test-tasks'],                      // 输入端口：测试任务(需先test-fix-gen生成)
    output: ['test-passed'],                    // 输出端口：测试通过
    tags: ['testing'],
    atomic_group: 'test-validation',           // 最小单元：与 test-fix-gen 绑定
    note: '需要先执行test-fix-gen生成测试任务，再由此命令执行测试周期'
  },
  'tdd-plan': {
    name: 'tdd-plan',
    input: ['requirement'],
    output: ['tdd-tasks'],                      // TDD 任务（供 execute 执行）
    tags: ['planning', 'tdd'],
    atomic_group: 'tdd-planning-execution'     // 最小单元：与 execute 绑定
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
    output: ['lite-fix'],                       // 输出端口：修复计划（供 lite-execute 执行）
    tags: ['bugfix'],
    atomic_group: 'bug-fix'                    // 最小单元：与 lite-execute 绑定
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
    output: ['test-tasks'],                     // 输出测试任务(IMPL-001,IMPL-002)，供 execute 执行
    tags: ['testing'],
    atomic_group: 'test-generation-execution'  // 最小单元：与 execute 绑定
  },
  'test-fix-gen': {
    name: 'test-fix-gen',
    input: ['failing-tests', 'session'],
    output: ['test-tasks'],                     // 输出测试任务，针对特定问题生成测试并在测试中修正
    tags: ['testing'],
    atomic_group: 'test-validation',           // 最小单元：与 test-cycle-execute 绑定
    note: '生成测试任务供test-cycle-execute执行'
  },
  'review': {
    name: 'review',
    input: ['code', 'session'],
    output: ['review-findings'],
    tags: ['review']
  },
  'review-fix': {
    name: 'review-fix',
    input: ['review-findings', 'review-verified'],  // Accept output from review-session-cycle or review-module-cycle
    output: ['fixed-code'],
    tags: ['review'],
    atomic_group: 'code-review'                // 最小单元：与 review-session-cycle/review-module-cycle 绑定
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
    output: ['multi-cli-plan'],                 // 对比分析计划（供 lite-execute 执行）
    tags: ['planning', 'multi-cli'],
    atomic_group: 'multi-cli-planning'         // 最小单元：与 lite-execute 绑定
  },
  'plan-verify': {
    name: 'plan-verify',
    input: ['detailed-plan'],
    output: ['verified-plan'],
    tags: ['planning']
  },
  'review-session-cycle': {
    name: 'review-session-cycle',
    input: ['code', 'session'],                 // 可接受代码或会话
    output: ['review-verified'],                // 输出端口:审查通过
    tags: ['review'],
    atomic_group: 'code-review'                // 最小单元：与 review-fix 绑定
  },
  'review-module-cycle': {
    name: 'review-module-cycle',
    input: ['module-pattern'],                  // 输入端口:模块模式
    output: ['review-verified'],                // 输出端口:审查通过
    tags: ['review'],
    atomic_group: 'code-review'                // 最小单元：与 review-fix 绑定
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
    updated_at: new Date().toISOString(),
    analysis: analysis,
    command_chain: chain.map((cmd, idx) => ({ ...cmd, index: idx, status: 'pending' })),
    execution_results: [],
    prompts_used: []
  };

  // Save initial state immediately after confirmation
  Write(`${stateDir}/state.json`, JSON.stringify(state, null, 2));

  for (let i = 0; i < chain.length; i++) {
    const cmd = chain[i];
    console.log(`[${i+1}/${chain.length}] ${cmd.command}`);

    // Update command_chain status to running
    state.command_chain[i].status = 'running';
    state.updated_at = new Date().toISOString();
    Write(`${stateDir}/state.json`, JSON.stringify(state, null, 2));

    // Assemble prompt with previous results
    let prompt = `Task: ${analysis.goal}\n`;
    if (state.execution_results.length > 0) {
      prompt += '\nPrevious results:\n';
      state.execution_results.forEach(r => {
        if (r.session_id) {
          prompt += `- ${r.command}: ${r.session_id} (${r.artifacts?.join(', ') || 'completed'})\n`;
        }
      });
    }
    prompt += `\n${formatCommand(cmd, state.execution_results, analysis)}\n`;

    // Record prompt used
    state.prompts_used.push({
      index: i,
      command: cmd.command,
      prompt: prompt
    });

    // Execute CLI command in background and stop
    try {
      const taskId = Bash(
        `ccw cli -p "${escapePrompt(prompt)}" --tool claude --mode write -y`,
        { run_in_background: true }
      ).task_id;

      // Save checkpoint
      state.execution_results.push({
        index: i,
        command: cmd.command,
        status: 'in-progress',
        task_id: taskId,
        session_id: null,
        artifacts: [],
        timestamp: new Date().toISOString()
      });
      state.command_chain[i].status = 'running';
      state.updated_at = new Date().toISOString();
      Write(`${stateDir}/state.json`, JSON.stringify(state, null, 2));

      console.log(`[${i+1}/${chain.length}] ${cmd.command}\n`);
      break; // Stop, wait for hook callback

    } catch (error) {
      state.command_chain[i].status = 'failed';
      state.updated_at = new Date().toISOString();
      Write(`${stateDir}/state.json`, JSON.stringify(state, null, 2));

      const action = await AskUserQuestion({
        questions: [{
          question: `${cmd.command} failed to start: ${error.message}. What to do?`,
          header: 'Error',
          options: [
            { label: 'Retry', description: 'Try again' },
            { label: 'Skip', description: 'Continue next command' },
            { label: 'Abort', description: 'Stop execution' }
          ]
        }]
      });

      if (action.error === 'Retry') {
        state.command_chain[i].status = 'pending';
        state.execution_results.pop();
        i--;
      } else if (action.error === 'Skip') {
        state.execution_results[state.execution_results.length - 1].status = 'skipped';
      } else if (action.error === 'Abort') {
        state.status = 'failed';
        break;
      }
    }

    Write(`${stateDir}/state.json`, JSON.stringify(state, null, 2));
  }

  // Hook callbacks handle completion
  if (state.status !== 'failed') state.status = 'waiting';
  state.updated_at = new Date().toISOString();
  Write(`${stateDir}/state.json`, JSON.stringify(state, null, 2));

  console.log(`\n📋 Orchestrator paused: ${state.session_id}\n`);
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

// Hook callback: Called when background CLI completes
async function handleCliCompletion(sessionId, taskId, output) {
  const stateDir = `.workflow/.ccw-coordinator/${sessionId}`;
  const state = JSON.parse(Read(`${stateDir}/state.json`));

  const pendingIdx = state.execution_results.findIndex(r => r.task_id === taskId);
  if (pendingIdx === -1) {
    console.error(`Unknown task_id: ${taskId}`);
    return;
  }

  const parsed = parseOutput(output);
  const cmdIdx = state.execution_results[pendingIdx].index;

  // Update result
  state.execution_results[pendingIdx] = {
    ...state.execution_results[pendingIdx],
    status: parsed.sessionId ? 'completed' : 'failed',
    session_id: parsed.sessionId,
    artifacts: parsed.artifacts,
    completed_at: new Date().toISOString()
  };
  state.command_chain[cmdIdx].status = parsed.sessionId ? 'completed' : 'failed';
  state.updated_at = new Date().toISOString();
  Write(`${stateDir}/state.json`, JSON.stringify(state, null, 2));

  // Trigger next command or complete
  const nextIdx = cmdIdx + 1;
  if (nextIdx < state.command_chain.length) {
    await resumeChainExecution(sessionId, nextIdx);
  } else {
    state.status = 'completed';
    Write(`${stateDir}/state.json`, JSON.stringify(state, null, 2));
    console.log(`✅ Completed: ${sessionId}\n`);
  }
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
  "status": "running|waiting|completed|failed",
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
      "task_id": "task-001",
      "session_id": "WFS-plan-20250124",
      "artifacts": ["IMPL_PLAN.md", "exploration-architecture.json"],
      "timestamp": "2025-01-24T14:30:25Z",
      "completed_at": "2025-01-24T14:30:45Z"
    },
    {
      "index": 1,
      "command": "/workflow:execute",
      "status": "in-progress",
      "task_id": "task-002",
      "session_id": null,
      "artifacts": [],
      "timestamp": "2025-01-24T14:32:00Z",
      "completed_at": null
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

### Status Flow

```
running → waiting → [hook callback] → waiting → [hook callback] → completed
   ↓                                                                    ↑
failed ←────────────────────────────────────────────────────────────┘
```

**Status Values**:
- `running`: Orchestrator actively executing (launching CLI commands)
- `waiting`: Paused, waiting for hook callbacks to trigger continuation
- `completed`: All commands finished successfully
- `failed`: User aborted or unrecoverable error

### Field Descriptions

**execution_results[] fields**:
- `index`: Command position in chain (0-indexed)
- `command`: Full command string (e.g., `/workflow:plan`)
- `status`: `in-progress` | `completed` | `skipped` | `failed`
- `task_id`: Background task identifier (from Bash tool)
- `session_id`: Workflow session ID (e.g., `WFS-*`) or null if failed
- `artifacts`: Generated files/directories
- `timestamp`: Command start time (ISO 8601)
- `completed_at`: Command completion time or null if pending

**command_chain[] status values**:
- `pending`: Not started yet
- `running`: Currently executing
- `completed`: Successfully finished
- `failed`: Failed to execute

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

Pipeline (with Minimum Execution Units):
需求 →【lite-plan → lite-execute】→ 代码 →【test-fix-gen → test-cycle-execute】→ 测试通过

Chain:
# Unit 1: Quick Implementation
1. /workflow:lite-plan --yes "Add API endpoint..."
2. /workflow:lite-execute --yes --in-memory

# Unit 2: Test Validation
3. /workflow:test-fix-gen --yes --session="WFS-xxx"
4. /workflow:test-cycle-execute --yes --session="WFS-test-xxx"
```

### Complex Feature with Verification
```
Goal: Implement OAuth2 authentication system
Scope: [auth, database, api, frontend]
Complexity: complex
Constraints: [no breaking changes]
Task Type: feature

Pipeline (with Minimum Execution Units):
需求 →【plan → plan-verify】→ 验证计划 → execute → 代码
     →【review-session-cycle → review-fix】→ 修复代码
     →【test-fix-gen → test-cycle-execute】→ 测试通过

Chain:
# Unit 1: Full Planning (plan + plan-verify)
1. /workflow:plan --yes "Implement OAuth2..."
2. /workflow:plan-verify --yes --session="WFS-xxx"

# Execution phase
3. /workflow:execute --yes --resume-session="WFS-xxx"

# Unit 2: Code Review (review-session-cycle + review-fix)
4. /workflow:review-session-cycle --yes --session="WFS-xxx"
5. /workflow:review-fix --yes --session="WFS-xxx"

# Unit 3: Test Validation (test-fix-gen + test-cycle-execute)
6. /workflow:test-fix-gen --yes --session="WFS-xxx"
7. /workflow:test-cycle-execute --yes --session="WFS-test-xxx"
```

### Quick Bug Fix
```
Goal: Fix login timeout issue
Scope: [auth]
Complexity: simple
Constraints: [urgent]
Task Type: bugfix

Pipeline:
Bug报告 → lite-fix → 修复代码 → test-fix-gen → 测试任务 → test-cycle-execute → 测试通过

Chain:
1. /workflow:lite-fix --yes "Fix login timeout..."
2. /workflow:test-fix-gen --yes --session="WFS-xxx"
3. /workflow:test-cycle-execute --yes --session="WFS-test-xxx"
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
Goal: Generate comprehensive tests for completed user registration feature
Scope: [auth, tests]
Complexity: medium
Constraints: []
Task Type: test-gen

Pipeline (with Minimum Execution Units):
代码/会话 →【test-gen → execute】→ 测试通过

Chain:
# Unit: Test Generation (test-gen + execute)
1. /workflow:test-gen --yes "WFS-registration-20250124"
2. /workflow:execute --yes --session="WFS-test-registration"

Note: test-gen creates IMPL-001 (test generation) and IMPL-002 (test execution & fix)
      execute runs both tasks - this is a Minimum Execution Unit
```

### Review + Fix Workflow
```
Goal: Code review of payment module
Scope: [payment]
Complexity: medium
Constraints: []
Task Type: review

Pipeline (with Minimum Execution Units):
代码 →【review-session-cycle → review-fix】→ 修复代码
     →【test-fix-gen → test-cycle-execute】→ 测试通过

Chain:
# Unit 1: Code Review (review-session-cycle + review-fix)
1. /workflow:review-session-cycle --yes --session="WFS-payment-impl"
2. /workflow:review-fix --yes --session="WFS-payment-impl"

# Unit 2: Test Validation (test-fix-gen + test-cycle-execute)
3. /workflow:test-fix-gen --yes --session="WFS-payment-impl"
4. /workflow:test-cycle-execute --yes --session="WFS-test-payment-impl"
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
     → plan-verify → 验证计划 → execute → 代码 → test-fix-gen → 测试任务 → test-cycle-execute → 测试通过

Chain:
1. /workflow:brainstorm:auto-parallel --yes "Explore solutions for real-time..."
2. /workflow:plan --yes "Implement chosen notification approach..."
3. /workflow:plan-verify --yes --session="WFS-xxx"
4. /workflow:execute --yes --resume-session="WFS-xxx"
5. /workflow:test-fix-gen --yes --session="WFS-xxx"
6. /workflow:test-cycle-execute --yes --session="WFS-test-xxx"
```

### Multi-CLI Plan (Multi-Perspective Analysis)
```
Goal: Compare microservices vs monolith architecture
Scope: [architecture]
Complexity: complex
Constraints: []
Task Type: multi-cli

Pipeline:
需求 → multi-cli-plan → 对比计划 → lite-execute → 代码 → test-fix-gen → 测试任务 → test-cycle-execute → 测试通过

Chain:
1. /workflow:multi-cli-plan --yes "Compare microservices vs monolith..."
2. /workflow:lite-execute --yes --in-memory
3. /workflow:test-fix-gen --yes --session="WFS-xxx"
4. /workflow:test-cycle-execute --yes --session="WFS-test-xxx"
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
8. **Serial Blocking** - Commands execute one-by-one with hook-based continuation

## CLI Execution Model

**Serial Blocking**: Commands execute one-by-one. After launching CLI in background, orchestrator stops immediately and waits for hook callback.

```javascript
// Example: Execute command and stop
const taskId = Bash(`ccw cli -p "..." --tool claude --mode write -y`, { run_in_background: true }).task_id;
state.execution_results.push({ status: 'in-progress', task_id: taskId, ... });
Write(`${stateDir}/state.json`, JSON.stringify(state, null, 2));
break; // Stop, wait for hook callback

// Hook calls handleCliCompletion(sessionId, taskId, output) when done
// → Updates state → Triggers next command via resumeChainExecution()
```

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

### Testing Commands Distinction

| Command | Purpose | Output | Follow-up |
|---------|---------|--------|-----------|
| **test-gen** | 广泛测试示例生成并进行测试 | test-tasks (IMPL-001, IMPL-002) | `/workflow:execute` |
| **test-fix-gen** | 针对特定问题生成测试并在测试中修正 | test-tasks | `/workflow:test-cycle-execute` |
| **test-cycle-execute** | 执行测试周期（迭代测试和修复） | test-passed | N/A (终点) |

**流程说明**:
- **test-gen → execute**: 生成全面的测试套件，execute 执行生成和测试
- **test-fix-gen → test-cycle-execute**: 针对特定问题生成修复任务，test-cycle-execute 迭代测试和修复直到通过

### Task Type Routing (Pipeline View)

**Note**: `【 】` marks Minimum Execution Units (最小执行单元) - these commands must execute together.

| Task Type | Pipeline |
|-----------|----------|
| **feature** (simple) | 需求 →【lite-plan → lite-execute】→ 代码 →【test-fix-gen → test-cycle-execute】→ 测试通过 |
| **feature** (complex) | 需求 →【plan → plan-verify】→ 验证计划 → execute → 代码 →【review-session-cycle → review-fix】→ 修复代码 →【test-fix-gen → test-cycle-execute】→ 测试通过 |
| **bugfix** | Bug报告 → lite-fix → 修复代码 →【test-fix-gen → test-cycle-execute】→ 测试通过 |
| **tdd** | 需求 → tdd-plan → TDD任务 → execute → 代码 → tdd-verify → TDD验证通过 |
| **test-fix** | 失败测试 →【test-fix-gen → test-cycle-execute】→ 测试通过 |
| **test-gen** | 代码/会话 →【test-gen → execute】→ 测试通过 |
| **review** | 代码 →【review-session-cycle/review-module-cycle → review-fix】→ 修复代码 →【test-fix-gen → test-cycle-execute】→ 测试通过 |
| **brainstorm** | 探索主题 → brainstorm:auto-parallel → 分析结果 →【plan → plan-verify】→ 验证计划 → execute → 代码 →【test-fix-gen → test-cycle-execute】→ 测试通过 |
| **multi-cli** | 需求 → multi-cli-plan → 对比计划 → lite-execute → 代码 →【test-fix-gen → test-cycle-execute】→ 测试通过 |

Use `CommandRegistry.getAllCommandsSummary()` to discover all commands dynamically.
