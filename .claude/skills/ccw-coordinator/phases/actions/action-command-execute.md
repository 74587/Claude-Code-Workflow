# action-command-execute

依次执行命令链，智能生成 ccw cli 提示词

## 命令注册表集成

```javascript
// 从 ./tools/command-registry.cjs 按需提取命令元数据
const CommandRegistry = require('./tools/command-registry.cjs');
const registry = new CommandRegistry();

// 只提取当前任务链中的命令
const commandNames = command_chain.map(cmd => cmd.command);
const commandMeta = registry.getCommands(commandNames);
```

## 提示词生成策略

```javascript
function generatePrompt(cmd, state, commandMeta) {
  const { task_description, execution_results } = state;

  // 获取命令元数据（从已提取的 commandMeta）
  const cmdInfo = commandMeta[cmd.command];

  // 提取前序产物信息
  const previousOutputs = execution_results
    .filter(r => r.status === 'success')
    .map(r => {
      const summary = r.summary;
      if (summary?.session) {
        return `- ${r.command}: ${summary.session} (${summary.files?.join(', ') || '完成'})`;
      }
      return `- ${r.command}: 已完成`;
    })
    .join('\n');

  // 根据命令类型构建提示词
  let prompt = `任务: ${task_description}\n`;

  if (previousOutputs) {
    prompt += `\n前序完成:\n${previousOutputs}\n`;
  }

  // 添加命令元数据上下文
  if (cmdInfo) {
    prompt += `\n命令: ${cmd.command}`;
    if (cmdInfo.argumentHint) {
      prompt += ` ${cmdInfo.argumentHint}`;
    }
  }

  return prompt;
}
```

## 执行逻辑

```javascript
for (let i = current_command_index; i < command_chain.length; i++) {
  const cmd = command_chain[i];

  console.log(`[${i+1}/${command_chain.length}] 执行: ${cmd.command}`);

  // 生成智能提示词
  const prompt = generatePrompt(cmd, state, commandMeta);

  try {
    // 使用 ccw cli 执行（添加 -y 参数跳过确认）
    const result = Bash(`ccw cli -p "${prompt.replace(/"/g, '\\"')}" ${cmd.command} -y`, {
      run_in_background: true
    });

    execution_results.push({
      command: cmd.command,
      status: result.exit_code === 0 ? 'success' : 'failed',
      exit_code: result.exit_code,
      output: result.stdout,
      summary: extractSummary(result.stdout)  // 提取关键产物
    });

    command_chain[i].status = 'completed';
    current_command_index = i + 1;

  } catch (error) {
    error_count++;
    command_chain[i].status = 'failed';

    if (error_count >= 3) break;

    const action = await AskUserQuestion({
      options: ['重试', '跳过', '中止']
    });

    if (action === '重试') i--;
    if (action === '中止') break;
  }

  updateState({ command_chain, execution_results, current_command_index, error_count });
}
```

## 产物提取

```javascript
function extractSummary(output) {
  // 从输出提取关键产物信息
  // 例如: 会话ID, 文件路径, 任务完成状态等
  const sessionMatch = output.match(/WFS-\w+-\d+/);
  const fileMatch = output.match(/\.workflow\/[^\s]+/g);

  return {
    session: sessionMatch?.[0],
    files: fileMatch || [],
    timestamp: new Date().toISOString()
  };
}
```

## 状态更新

- execution_results (包含 summary 产物信息)
- command_chain[].status
- current_command_index
