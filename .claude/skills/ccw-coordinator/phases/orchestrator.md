# Orchestrator

状态驱动编排：读状态 → 选动作 → 执行 → 更新状态

## 决策逻辑

```javascript
function selectNextAction(state) {
  if (['completed', 'aborted'].includes(state.status)) return null;
  if (state.error_count >= 3) return 'action-abort';

  switch (state.status) {
    case 'pending':
      return 'action-init';
    case 'running':
      return state.confirmed && state.command_chain.length > 0
        ? 'action-command-execute'
        : 'action-command-selection';
    case 'executing':
      const pending = state.command_chain.filter(c => c.status === 'pending');
      return pending.length === 0 ? 'action-complete' : 'action-command-execute';
    default:
      return 'action-abort';
  }
}
```

## 执行循环

```javascript
const timestamp = Date.now();
const workDir = `.workflow/.ccw-coordinator/${timestamp}`;
Bash(`mkdir -p "${workDir}"`);

const state = {
  session_id: `coord-${timestamp}`,
  status: 'pending',
  started_at: new Date().toISOString(),
  task_description: '',  // 从 action-command-selection 获取
  command_chain: [],
  current_command_index: 0,
  execution_results: [],
  confirmed: false,
  error_count: 0
};
Write(`${workDir}/state.json`, JSON.stringify(state, null, 2));

let iterations = 0;
while (iterations < 50) {
  const state = JSON.parse(Read(`${workDir}/state.json`));
  const nextAction = selectNextAction(state);
  if (!nextAction) break;

  console.log(`[${nextAction}]`);
  // 执行 phases/actions/{nextAction}.md

  iterations++;
}
```
