# action-command-build

调整命令链顺序或删除命令

## 流程

1. 显示当前命令链
2. 让用户调整（重新排序、删除）
3. 确认执行

## 伪代码

```javascript
// 显示链
console.log('命令链:');
state.command_chain.forEach((cmd, i) => {
  console.log(`${i+1}. ${cmd.command}`);
});

// 询问用户
const action = await AskUserQuestion({
  options: [
    '继续执行',
    '删除命令',
    '重新排序',
    '返回选择'
  ]
});

// 处理用户操作
if (action === '继续执行') {
  updateState({confirmed: true, status: 'executing'});
}
// ... 其他操作
```

## 状态更新

- command_chain (可能修改)
- confirmed = true 时状态转为 executing
