# Coordinator Components

## CoordinatorInputModal

Modal dialog for starting coordinator execution with task description and optional JSON parameters.

### Usage

```tsx
import { CoordinatorInputModal } from '@/components/coordinator';
import { useState } from 'react';

function MyComponent() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsModalOpen(true)}>
        Start Coordinator
      </Button>

      <CoordinatorInputModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
```

### Features

- **Task Description**: Required text area (10-2000 characters)
- **Parameters**: Optional JSON input
- **Validation**: Real-time validation for description length and JSON format
- **Loading State**: Displays loading indicator during submission
- **Error Handling**: Shows appropriate error messages
- **Internationalization**: Full i18n support (English/Chinese)
- **Notifications**: Success/error toasts via useNotifications hook

### API Integration

The component integrates with:
- **POST /api/coordinator/start**: Starts coordinator execution
- **coordinatorStore**: Updates Zustand store state
- **notificationStore**: Shows success/error notifications

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | `boolean` | Yes | Controls modal visibility |
| `onClose` | `() => void` | Yes | Callback when modal closes |

### Validation Rules

- **Task Description**:
  - Minimum length: 10 characters
  - Maximum length: 2000 characters
  - Required field

- **Parameters**:
  - Optional field
  - Must be valid JSON if provided

### Example Payload

```json
{
  "executionId": "exec-1738477200000-abc123def",
  "taskDescription": "Implement user authentication with JWT tokens",
  "parameters": {
    "timeout": 3600,
    "priority": "high"
  }
}
```

---

## Pipeline Timeline View Components

Horizontal scrolling timeline visualization for coordinator command pipeline execution.

### CoordinatorTimeline

Main timeline container that displays the command chain with auto-scrolling to active nodes.

#### Usage

```tsx
import { CoordinatorTimeline } from '@/components/coordinator';

function MyComponent() {
  const handleNodeClick = (nodeId: string) => {
    console.log('Node clicked:', nodeId);
  };

  return (
    <CoordinatorTimeline
      autoScroll={true}
      onNodeClick={handleNodeClick}
    />
  );
}
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `className` | `string` | No | - | Additional CSS classes |
| `autoScroll` | `boolean` | No | `true` | Auto-scroll to active/latest node |
| `onNodeClick` | `(nodeId: string) => void` | No | - | Callback when node is clicked |

#### Features

- **Horizontal Scrolling**: Smooth horizontal scroll with mouse wheel
- **Auto-scroll**: Automatically scrolls to the active or latest node
- **Empty State**: Shows helpful message when no nodes are present
- **Store Integration**: Uses `useCoordinatorStore` for state management

---

### TimelineNode

Individual node card displaying node status, timing, and expandable details.

#### Usage

```tsx
import { TimelineNode } from '@/components/coordinator';
import type { CommandNode } from '@/stores/coordinatorStore';

function MyComponent({ node }: { node: CommandNode }) {
  return (
    <TimelineNode
      node={node}
      isActive={true}
      onClick={() => console.log('Clicked:', node.id)}
    />
  );
}
```

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `node` | `CommandNode` | Yes | Node data from coordinator store |
| `isActive` | `boolean` | No | Whether this node is currently active |
| `onClick` | `() => void` | No | Callback when node is clicked |
| `className` | `string` | No | Additional CSS classes |

#### Features

- **Status Indicators**:
  - `completed`: Green checkmark icon
  - `failed`: Red X icon
  - `running`: Blue spinning loader
  - `pending`: Gray clock icon
  - `skipped`: Yellow X icon

- **Status Badges**:
  - Success (green)
  - Failed (red)
  - Running (blue)
  - Pending (gray outline)
  - Skipped (yellow)

- **Expandable Details**:
  - Error messages (red background)
  - Output text (scrollable pre)
  - Result JSON (formatted and scrollable)

- **Timing Information**:
  - Start time
  - Completion time
  - Duration calculation

- **Animations**:
  - Hover scale effect (scale-105)
  - Smooth transitions (300ms)
  - Active ring (ring-2 ring-primary)

---

### NodeConnector

Visual connector line between timeline nodes with status-based styling.

#### Usage

```tsx
import { NodeConnector } from '@/components/coordinator';

function MyComponent() {
  return (
    <div className="flex items-center">
      <TimelineNode node={node1} />
      <NodeConnector status="completed" />
      <TimelineNode node={node2} />
    </div>
  );
}
```

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `status` | `NodeExecutionStatus` | Yes | Status of the connected node |
| `className` | `string` | No | Additional CSS classes |

#### Status Colors

| Status | Color | Animation |
|--------|-------|-----------|
| `completed` | Green gradient | None |
| `failed` | Red gradient | None |
| `running` | Blue gradient | Pulse animation |
| `pending` | Gray gradient | None |
| `skipped` | Yellow gradient | None |

---

## Complete Example

```tsx
import { useState } from 'react';
import {
  CoordinatorInputModal,
  CoordinatorTimeline,
} from '@/components/coordinator';
import { Button } from '@/components/ui/Button';

function CoordinatorDashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleNodeClick = (nodeId: string) => {
    console.log('Node clicked:', nodeId);
    // Show node details panel, etc.
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b border-border p-4">
        <Button onClick={() => setIsModalOpen(true)}>
          New Execution
        </Button>
      </header>

      {/* Timeline */}
      <div className="flex-1 overflow-hidden">
        <CoordinatorTimeline
          autoScroll={true}
          onNodeClick={handleNodeClick}
        />
      </div>

      {/* Input Modal */}
      <CoordinatorInputModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
```

## Design Principles

- **Responsive**: Works on mobile and desktop
- **Dark Mode**: Full dark mode support via Tailwind CSS
- **Accessibility**: Proper ARIA labels and keyboard navigation
- **Performance**: Smooth 60fps animations
- **Mobile-first**: Touch-friendly interactions

