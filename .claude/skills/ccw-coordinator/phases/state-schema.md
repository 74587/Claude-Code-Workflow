# State Schema

```typescript
interface State {
  session_id: string;
  status: 'pending' | 'running' | 'executing' | 'completed' | 'aborted';
  started_at: string;
  task_description: string;  // 用户任务描述
  command_chain: Command[];
  current_command_index: number;
  execution_results: ExecutionResult[];
  confirmed: boolean;
  error_count: number;
}

interface Command {
  id: string;
  order: number;
  command: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: ExecutionResult;
}

interface ExecutionResult {
  command: string;
  status: 'success' | 'failed';
  exit_code: number;
  output?: string;
  summary?: {  // 提取的关键产物
    session?: string;
    files?: string[];
    timestamp: string;
  };
}
```

## 状态转移

```
pending → running → executing → completed
         ↓        ↓
      (abort)  (error → abort)
```

## 初始化

```javascript
{
  session_id: generateId(),
  status: 'pending',
  started_at: new Date().toISOString(),
  task_description: '',  // 从用户输入获取
  command_chain: [],
  current_command_index: 0,
  execution_results: [],
  confirmed: false,
  error_count: 0
}
```

## 更新

- 添加命令: `command_chain.push(cmd)`
- 确认执行: `confirmed = true, status = 'executing'`
- 记录执行: `execution_results.push(...), current_command_index++`
- 错误计数: `error_count++`
