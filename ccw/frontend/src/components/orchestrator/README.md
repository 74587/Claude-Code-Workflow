# Orchestrator Components

## Tool Call Timeline Components

### Components

#### `ToolCallCard`
Expandable card displaying tool call details with status, output, and results.

**Props:**
- `toolCall`: `ToolCallExecution` - Tool call execution data
- `isExpanded`: `boolean` - Whether the card is expanded
- `onToggle`: `() => void` - Callback when toggle expand/collapse
- `className?`: `string` - Optional CSS class name

**Features:**
- Status icon (pending/executing/success/error/canceled)
- Kind icon (execute/patch/thinking/web_search/mcp_tool/file_operation)
- Duration display
- Expand/collapse animation
- stdout/stderr output with syntax highlighting
- Exit code badge
- Error message display
- Result display

#### `ToolCallsTimeline`
Vertical timeline displaying tool calls in chronological order.

**Props:**
- `toolCalls`: `ToolCallExecution[]` - Array of tool call executions
- `onToggleExpand`: `(callId: string) => void` - Callback when tool call toggled
- `className?`: `string` - Optional CSS class name

**Features:**
- Chronological sorting by start time
- Timeline dot with status color
- Auto-expand executing tool calls
- Auto-scroll to executing tool call
- Empty state with icon
- Summary statistics (total/success/error/running)
- Loading indicator when tools are executing

### Usage Example

```tsx
import { ToolCallsTimeline } from '@/components/orchestrator';
import { useExecutionStore } from '@/stores/executionStore';

function ToolCallsTab({ nodeId }: { nodeId: string }) {
  const toolCalls = useExecutionStore((state) =>
    state.getToolCallsForNode(nodeId)
  );
  const toggleToolCallExpanded = useExecutionStore(
    (state) => state.toggleToolCallExpanded
  );

  return (
    <div className="p-4">
      <ToolCallsTimeline
        toolCalls={toolCalls}
        onToggleExpand={(callId) => toggleToolCallExpanded(nodeId, callId)}
      />
    </div>
  );
}
```

### Integration with ExecutionStore

The components integrate with `executionStore` for state management:

```tsx
// Get tool calls for a node
const toolCalls = useExecutionStore((state) =>
  state.getToolCallsForNode(nodeId)
);

// Toggle expand state
const handleToggle = (callId: string) => {
  useExecutionStore.getState().toggleToolCallExpanded(nodeId, callId);
};
```

### Data Flow

```
WebSocket Message
    │
    ▼
useWebSocket (parsing)
    │
    ▼
executionStore.startToolCall()
    │
    ▼
ToolCallsTimeline (re-render)
    │
    ▼
ToolCallCard (display)
```

### Styling

Components use Tailwind CSS with the following conventions:
- `border-border` - Border color
- `bg-muted` - Muted background
- `text-destructive` - Error text color
- `text-green-500` - Success text color
- `text-primary` - Primary text color
- `animate-pulse` - Pulse animation for executing status
