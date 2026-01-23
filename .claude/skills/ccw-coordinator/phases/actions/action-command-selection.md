# action-command-selection

## 流程

1. 问用户任务
2. Claude推荐命令链
3. 用户确认/手动选择
4. 添加到command_chain

## 伪代码

```javascript
// 1. 获取用户任务描述
const taskInput = await AskUserQuestion({
  question: '请描述您的任务',
  options: [
    { label: '手动选择命令', value: 'manual' }
  ]
});

// 保存任务描述到状态
updateState({ task_description: taskInput.text || taskInput.value });

// 2. 若用户描述任务，Claude推荐
if (taskInput.text) {
  console.log('推荐: ', recommendChain(taskInput.text));
  const confirm = await AskUserQuestion({
    question: '是否使用推荐链？',
    options: ['使用推荐', '调整', '手动选择']
  });
  if (confirm === '使用推荐') {
    addCommandsToChain(recommendedChain);
    updateState({ confirmed: true });
    return;
  }
}

// 3. 手动选择
const commands = loadCommandLibrary();
const selected = await AskUserQuestion(commands);
addToChain(selected);
```

## 状态更新

- task_description = 用户任务描述
- command_chain.push(newCommand)
- 如果用户确认: confirmed = true
