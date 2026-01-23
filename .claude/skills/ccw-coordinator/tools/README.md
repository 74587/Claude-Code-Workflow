# CCW Coordinator Tools

## command-registry.js

命令注册表工具：按需查找并提取命令 YAML 头元数据。

### 功能

- **按需提取**: 只提取用户任务链中的命令（不是全量扫描）
- **自动查找**: 从全局 `.claude/commands/workflow` 目录读取（项目相对路径 > 用户 home）
- **解析 YAML 头**: 提取 name, description, argument-hint, allowed-tools
- **缓存机制**: 避免重复读取文件

### 编程接口

```javascript
const CommandRegistry = require('./tools/command-registry.js');
const registry = new CommandRegistry();

// 按需提取命令链中的命令元数据
const commandNames = ['/workflow:lite-plan', '/workflow:lite-execute'];
const commands = registry.getCommands(commandNames);

// 输出:
// {
//   "/workflow:lite-plan": {
//     name: 'lite-plan',
//     command: '/workflow:lite-plan',
//     description: '...',
//     argumentHint: '[-e|--explore] "task description"',
//     allowedTools: [...],
//     filePath: '...'
//   },
//   "/workflow:lite-execute": { ... }
// }
```

### 命令行接口

```bash
# 提取指定命令
node .claude/skills/ccw-coordinator/tools/command-registry.js lite-plan lite-execute

# 输出 JSON
node .claude/skills/ccw-coordinator/tools/command-registry.js /workflow:lite-plan
```

### 集成用途

在 `action-command-execute` 中使用：

```javascript
// 1. 只提取任务链中的命令
const commandNames = command_chain.map(cmd => cmd.command);
const commandMeta = registry.getCommands(commandNames);

// 2. 生成提示词时使用
function generatePrompt(cmd, state, commandMeta) {
  const cmdInfo = commandMeta[cmd.command];
  let prompt = `任务: ${state.task_description}\n`;

  if (cmdInfo?.argumentHint) {
    prompt += `命令: ${cmd.command} ${cmdInfo.argumentHint}`;
  }

  return prompt;
}
```

确保 `ccw cli -p "..."` 提示词包含准确的命令参数提示。

### 目录查找逻辑

自动查找顺序：
1. `.claude/commands/workflow` (相对于当前工作目录)
2. `~/.claude/commands/workflow` (用户 home 目录)

