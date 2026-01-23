# action-complete

生成执行报告

```javascript
const success = execution_results.filter(r => r.status === 'success').length;
const failed = execution_results.filter(r => r.status === 'failed').length;
const duration = Date.now() - new Date(started_at).getTime();

const report = `
# 执行报告

- 会话: ${session_id}
- 耗时: ${Math.round(duration/1000)}s
- 成功: ${success}
- 失败: ${failed}

## 命令详情

${command_chain.map((c, i) => `${i+1}. ${c.command} - ${c.status}`).join('\n')}
`;

Write(`${workDir}/final-report.md`, report);
updateState({ status: 'completed' });
```
