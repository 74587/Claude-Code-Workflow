# CCW Coordinator Tools

## command-registry.cjs

命令注册表工具：获取和提取命令元数据。

### 功能

- **按需提取**: 只提取指定命令的完整信息（name, description, argumentHint, allowedTools 等）
- **全量获取**: 获取所有命令的名称和描述（快速查询）
- **自动查找**: 从全局 `.claude/commands/workflow` 目录读取（项目相对路径 > 用户 home）
- **缓存机制**: 避免重复读取文件

### 编程接口

```javascript
const CommandRegistry = require('./tools/command-registry.cjs');
const registry = new CommandRegistry();

// 1. 获取所有命令的名称和描述（快速）
const allCommands = registry.getAllCommandsSummary();
// {
//   "/workflow:lite-plan": {
//     name: 'lite-plan',
//     description: '轻量级规划...'
//   },
//   "/workflow:lite-execute": { ... }
// }

// 2. 按需提取指定命令的完整信息
const commands = registry.getCommands([
  '/workflow:lite-plan',
  '/workflow:lite-execute'
]);
// {
//   "/workflow:lite-plan": {
//     name: 'lite-plan',
//     description: '...',
//     argumentHint: '[-e|--explore] "task description"',
//     allowedTools: [...],
//     filePath: '...'
//   },
//   ...
// }
```

### 命令行接口

```bash
# 获取所有命令的名称和描述
node .claude/skills/ccw-coordinator/tools/command-registry.cjs
node .claude/skills/ccw-coordinator/tools/command-registry.cjs --all

# 输出: 23 个命令的简明列表 (name + description)
```

```bash
# 按需提取指定命令的完整信息
node .claude/skills/ccw-coordinator/tools/command-registry.cjs lite-plan lite-execute

# 输出: 完整信息 (name, description, argumentHint, allowedTools, filePath)
```

### 集成用途

在 `action-command-execute` 中使用：

```javascript
// 1. 初始化时只提取任务链中的命令（完整信息）
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



