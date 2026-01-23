# action-init

初始化编排会话

```javascript
const timestamp = Date.now();
const workDir = `.workflow/.ccw-coordinator/${timestamp}`;

Bash(`mkdir -p "${workDir}"`);

const state = {
  session_id: `coord-${timestamp}`,
  status: 'running',
  started_at: new Date().toISOString(),
  command_chain: [],
  current_command_index: 0,
  execution_results: [],
  confirmed: false,
  error_count: 0
};

Write(`${workDir}/state.json`, JSON.stringify(state, null, 2));

console.log(`会话已初始化: ${workDir}`);
```
