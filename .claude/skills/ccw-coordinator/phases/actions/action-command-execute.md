# action-command-execute

循环执行命令链，通过 ccw cli 调用 Claude 执行每个命令。

## 核心原则

1. **仅支持 Claude**：所有执行通过 `ccw cli --tool claude` 调用
2. **命令在提示词中体现**：提示词直接包含完整的命令调用（如 `/workflow:lite-plan --yes "任务"`）
3. **智能参数组装**：根据命令的 `argument-hint` 组装正确的参数
4. **循环执行**：每次根据上次完成情况和下个命令参数组装提示词

## 命令注册表集成

```javascript
// 从 ./tools/command-registry.cjs 按需提取命令元数据
const CommandRegistry = require('./tools/command-registry.cjs');
const registry = new CommandRegistry();

// 只提取当前任务链中的命令
const commandNames = command_chain.map(cmd => cmd.command);
const commandMeta = registry.getCommands(commandNames);
```

## 参数组装逻辑

根据命令的 `argument-hint` 和执行上下文，智能组装命令行参数：

```javascript
function assembleCommandLine(cmd, state, commandMeta) {
  const cmdInfo = commandMeta[cmd.command];
  const { task_description, execution_results } = state;

  let commandLine = cmd.command;  // e.g., /workflow:lite-plan

  // 1. 添加 --yes 标志（跳过确认）
  commandLine += ' --yes';

  // 2. 根据命令类型添加特定参数
  const cmdName = cmd.command.split(':').pop();  // lite-plan, lite-execute, etc.

  switch (cmdName) {
    case 'lite-plan':
    case 'plan':
    case 'multi-cli-plan':
    case 'tdd-plan':
      // 规划命令：需要任务描述
      commandLine += ` "${task_description}"`;
      break;

    case 'lite-execute':
      // 执行命令：如果有前序规划产物，使用 --in-memory
      if (execution_results.some(r =>
        r.command.includes('plan') && r.status === 'success'
      )) {
        commandLine += ' --in-memory';
      } else {
        commandLine += ` "${task_description}"`;
      }
      break;

    case 'execute':
      // 标准执行：可能需要 --resume-session
      const planResult = execution_results.find(r =>
        r.command.includes('plan') && r.status === 'success'
      );
      if (planResult?.summary?.session) {
        commandLine += ` --resume-session="${planResult.summary.session}"`;
      }
      break;

    case 'lite-fix':
      // 修复命令：如果有 hotfix 标志
      if (cmd.hotfix) {
        commandLine += ' --hotfix';
      }
      commandLine += ` "${task_description}"`;
      break;

    case 'test-cycle-execute':
    case 'test-gen':
    case 'test-fix-gen':
      // 测试命令：使用前序会话
      const execResult = execution_results.find(r =>
        (r.command.includes('execute') || r.command.includes('fix')) &&
        r.status === 'success'
      );
      if (execResult?.summary?.session) {
        commandLine += ` --session="${execResult.summary.session}"`;
      }
      break;

    case 'review-session-cycle':
    case 'review-module-cycle':
    case 'review-fix':
      // 审查命令：使用前序会话
      const prevSession = execution_results
        .filter(r => r.status === 'success' && r.summary?.session)
        .pop()?.summary?.session;
      if (prevSession) {
        commandLine += ` --session="${prevSession}"`;
      }
      break;

    default:
      // 其他命令：尝试传递任务描述
      if (cmdInfo?.argumentHint?.includes('task') ||
          cmdInfo?.argumentHint?.includes('description')) {
        commandLine += ` "${task_description}"`;
      }
  }

  // 3. 添加用户自定义参数（如果有）
  if (cmd.customArgs) {
    commandLine += ` ${cmd.customArgs}`;
  }

  return commandLine;
}
```

## 提示词生成

提示词结构：任务描述 + 前序完成 + 完整命令行

```javascript
function generatePrompt(cmd, state, commandMeta) {
  const { task_description, execution_results } = state;

  // 1. 任务描述
  let prompt = `任务: ${task_description}\n`;

  // 2. 前序完成情况
  const successResults = execution_results.filter(r => r.status === 'success');
  if (successResults.length > 0) {
    const previousOutputs = successResults
      .map(r => {
        const summary = r.summary;
        if (summary?.session) {
          const files = summary.files?.length > 0
            ? summary.files.join(', ')
            : '完成';
          return `- ${r.command}: ${summary.session} (${files})`;
        }
        return `- ${r.command}: 已完成`;
      })
      .join('\n');

    prompt += `\n前序完成:\n${previousOutputs}\n`;
  }

  // 3. 组装完整命令行（关键）
  const commandLine = assembleCommandLine(cmd, state, commandMeta);
  prompt += `\n${commandLine}`;

  return prompt;
}
```

### 提示词示例

**第一个命令（lite-plan）**：
```
任务: 实现用户注册功能，包括邮箱验证和密码加密

/workflow:lite-plan --yes "实现用户注册功能，包括邮箱验证和密码加密"
```

**第二个命令（lite-execute）**：
```
任务: 实现用户注册功能，包括邮箱验证和密码加密

前序完成:
- /workflow:lite-plan: WFS-register-2025-01-24 (IMPL_PLAN.md, exploration-architecture.json)

/workflow:lite-execute --yes --in-memory
```

**第三个命令（test-cycle-execute）**：
```
任务: 实现用户注册功能，包括邮箱验证和密码加密

前序完成:
- /workflow:lite-plan: WFS-register-2025-01-24 (IMPL_PLAN.md)
- /workflow:lite-execute: WFS-register-2025-01-24 (完成)

/workflow:test-cycle-execute --yes --session="WFS-register-2025-01-24"
```

## 执行逻辑

```javascript
for (let i = current_command_index; i < command_chain.length; i++) {
  const cmd = command_chain[i];

  console.log(`[${i+1}/${command_chain.length}] 执行: ${cmd.command}`);

  // 1. 生成智能提示词
  const prompt = generatePrompt(cmd, state, commandMeta);

  // 2. 转义提示词中的特殊字符
  const escapedPrompt = prompt
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');

  try {
    // 3. 调用 ccw cli（仅支持 claude）
    const result = Bash(`ccw cli -p "${escapedPrompt}" --tool claude --mode write -y`, {
      run_in_background: true
    });

    // 4. 等待执行完成（通过 hook 回调）
    // ... 等待逻辑由调用者处理

    // 5. 解析输出，提取产物
    const summary = extractSummary(result.stdout);

    // 6. 记录执行结果
    execution_results.push({
      command: cmd.command,
      status: result.exit_code === 0 ? 'success' : 'failed',
      exit_code: result.exit_code,
      output: result.stdout,
      summary: summary
    });

    // 7. 更新命令状态
    command_chain[i].status = 'completed';
    current_command_index = i + 1;

  } catch (error) {
    error_count++;
    command_chain[i].status = 'failed';

    // 错误上限检查
    if (error_count >= 3) {
      console.log('连续错误超过3次，中止执行');
      break;
    }

    // 用户决策
    const action = await AskUserQuestion({
      questions: [{
        question: `命令 ${cmd.command} 执行失败，如何处理？`,
        header: "Error",
        multiSelect: false,
        options: [
          { label: "重试", description: "重新执行此命令" },
          { label: "跳过", description: "跳过此命令，继续下一个" },
          { label: "中止", description: "终止整个命令链" }
        ]
      }]
    });

    if (action.answers['Error'] === '重试') i--;
    if (action.answers['Error'] === '中止') break;
  }

  // 8. 持久化状态
  updateState({
    command_chain,
    execution_results,
    current_command_index,
    error_count
  });
}
```

## 产物提取

```javascript
function extractSummary(output) {
  // 从 ccw cli 输出提取关键产物信息

  // 1. 提取会话 ID (WFS-* 或其他格式)
  const sessionMatch = output.match(/WFS-[\w-]+/);

  // 2. 提取产物文件路径
  const fileMatches = output.match(/\.workflow\/[^\s\n\r"']+/g);

  // 3. 提取完成状态
  const isSuccess = /✓|completed|success|完成/i.test(output);

  return {
    session: sessionMatch?.[0] || null,
    files: fileMatches ? [...new Set(fileMatches)] : [],  // 去重
    status: isSuccess ? 'success' : 'unknown',
    timestamp: new Date().toISOString()
  };
}
```

## 状态更新

每次命令执行后立即更新 `state.json`：

```javascript
function updateState(updates) {
  const statePath = `${workDir}/state.json`;
  const currentState = JSON.parse(Read(statePath));

  const newState = {
    ...currentState,
    ...updates,
    updated_at: new Date().toISOString()
  };

  Write(statePath, JSON.stringify(newState, null, 2));
}
```

### 更新字段

| 字段 | 说明 |
|------|------|
| `execution_results` | 每个命令的执行结果（含 summary 产物信息） |
| `command_chain[].status` | 各命令状态（pending/in_progress/completed/failed） |
| `current_command_index` | 当前执行到的命令索引 |
| `error_count` | 连续错误计数 |

## 日志记录

每个命令执行详情保存到独立日志：

```javascript
function logCommandExecution(index, cmd, result, workDir) {
  const logPath = `${workDir}/commands/${String(index + 1).padStart(2, '0')}-${cmd.command.replace(/[/:]/g, '-')}.log`;

  const logContent = `
# Command Execution Log
Command: ${cmd.command}
Status: ${result.status}
Exit Code: ${result.exit_code}
Timestamp: ${new Date().toISOString()}

## Prompt
${result.prompt}

## Output
${result.output}

## Summary
Session: ${result.summary?.session || 'N/A'}
Files: ${result.summary?.files?.join(', ') || 'N/A'}
`;

  Write(logPath, logContent);
}
```
