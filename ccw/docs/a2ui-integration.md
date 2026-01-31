# A2UI Integration Guide for CCW Developers

This guide explains how to integrate and extend the A2UI (AI-to-UI) system in the CCW application.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [WebSocket Integration](#websocket-integration)
3. [Notification System](#notification-system)
4. [Creating Custom Components](#creating-custom-components)
5. [Backend Tool Integration](#backend-tool-integration)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         CCW Frontend                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────┐      ┌─────────────────┐              │
│  │ WebSocket      │─────▶│ A2UI Parser     │              │
│  │ Handler        │      │ (validation)    │              │
│  └────────────────┘      └────────┬────────┘              │
│                                   │                         │
│                                   ▼                         │
│  ┌────────────────┐      ┌─────────────────┐              │
│  │ Notification   │◀─────│ A2UI Component   │              │
│  │ Store          │      │ Registry         │              │
│  └────────────────┘      └────────┬────────┘              │
│                                   │                         │
│                                   ▼                         │
│  ┌────────────────┐      ┌─────────────────┐              │
│  │ UI Components  │◀─────│ A2UI Renderer   │              │
│  │ (Dialogs,      │      │ (React)          │              │
│  │  Panels)       │      └─────────────────┘              │
│  └────────────────┘                                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         CCW Backend                          │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────────┐      ┌─────────────────┐              │
│  │ MCP Tools      │─────▶│ A2UI Types      │              │
│  │ (ask_question, │      │ (Zod schemas)    │              │
│  │  etc.)         │      └─────────────────┘              │
│  └────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
```

## WebSocket Integration

### Message Flow

The A2UI system uses WebSocket messages for bidirectional communication:

#### Frontend to Backend (Actions)

```typescript
// Send action via WebSocket
const sendA2UIAction = (
  actionId: string,
  surfaceId: string,
  parameters: Record<string, unknown>
) => {
  const event = new CustomEvent('a2ui-action', {
    detail: {
      type: 'a2ui-action',
      actionId,
      surfaceId,
      parameters,
    },
  });
  window.dispatchEvent(event);
  
  // WebSocket handler picks up this event
};
```

#### Backend to Frontend (Surface Updates)

```typescript
// WebSocket message handler processes incoming messages
interface A2UISurfaceMessage {
  type: 'a2ui-surface';
  surfaceId: string;
  title?: string;
  surface: SurfaceUpdate;
}

// In useWebSocket hook
useEffect(() => {
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    
    if (message.type === 'a2ui-surface') {
      // Add to notification store
      addA2UINotification(message.surface, message.title);
    }
  });
}, [ws]);
```

## Notification System

### A2UI Notifications

A2UI surfaces appear as notifications in the notification panel:

```typescript
// Add A2UI notification
import { useNotificationStore } from '@/stores/notificationStore';

const { addA2UINotification } = useNotificationStore();

addA2UINotification(surfaceUpdate, 'Notification Title');
```

### State Management

A2UI state is managed through the notification store:

```typescript
// Update A2UI state
updateA2UIState(surfaceId, {
  counter: 5,
  userInput: 'value',
});
```

### Ask Question Dialog

The `ask_question` tool uses a dedicated dialog:

```typescript
// Set current question (triggered by WebSocket)
setCurrentQuestion({
  surfaceId: 'question-123',
  title: 'Confirmation Required',
  questions: [
    {
      id: 'q1',
      type: 'confirm',
      question: 'Do you want to continue?',
      required: true,
    },
  ],
});

// Dialog renders automatically
// {currentQuestion && <AskQuestionDialog payload={currentQuestion} />}
```

## Creating Custom Components

### Step 1: Create Component Renderer

Create file: `src/packages/a2ui-runtime/renderer/components/A2UICustom.tsx`

```typescript
import React, { useState, useCallback } from 'react';
import type { ComponentRenderer } from '../../core/A2UIComponentRegistry';
import { resolveTextContent } from '../A2UIRenderer';

// Define component config interface (for TypeScript)
interface CustomComponentConfig {
  title: { literalString: string } | { path: string };
  dataSource: { literalString: string } | { path: string };
  onRefresh: { actionId: string; parameters?: Record<string, unknown> };
}

export const A2UICustom: ComponentRenderer = ({ 
  component, 
  state, 
  onAction, 
  resolveBinding 
}) => {
  const customComp = component as { Custom: CustomComponentConfig };
  const { Custom: config } = customComp;

  // Resolve title (literal or binding)
  const title = resolveTextContent(config.title, resolveBinding);
  
  // Resolve data source
  const dataSource = resolveTextContent(config.dataSource, resolveBinding);

  // Local state
  const [isLoading, setIsLoading] = useState(false);

  // Handle refresh action
  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    onAction(config.onRefresh.actionId, {
      ...config.onRefresh.parameters,
      dataSource,
    });
    // Reset loading after action (implementation dependent)
    setTimeout(() => setIsLoading(false), 1000);
  }, [onAction, config.onRefresh, dataSource]);

  return (
    <div className="a2ui-custom p-4 border rounded-md">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <div className="text-sm">
        Data source: {dataSource}
      </div>
      <button
        onClick={handleRefresh}
        disabled={isLoading}
        className="mt-2 px-3 py-1 bg-primary text-primary-foreground rounded"
      >
        {isLoading ? 'Loading...' : 'Refresh'}
      </button>
    </div>
  );
};
```

### Step 2: Register Component

Update: `src/packages/a2ui-runtime/renderer/components/registry.ts`

```typescript
import { A2UICustom } from './A2UICustom';

export function registerBuiltInComponents(): void {
  // ... existing registrations
  
  // Register custom component
  a2uiRegistry.register('Custom', A2UICustom);
}
```

### Step 3: Export Component

Update: `src/packages/a2ui-runtime/renderer/components/index.ts`

```typescript
export * from './A2UICustom';
```

### Step 4: Add Type Definition (Optional)

Update: `src/packages/a2ui-runtime/core/A2UITypes.ts`

```typescript
// Add schema
export const CustomComponentSchema = z.object({
  Custom: z.object({
    title: TextContentSchema,
    dataSource: TextContentSchema,
    onRefresh: ActionSchema,
    description: z.string().optional(),
  }),
});

// Add to ComponentSchema union
export const ComponentSchema: z.ZodType<
  | z.infer<typeof TextComponentSchema>
  | z.infer<typeof ButtonComponentSchema>
  // ... other components
  | z.infer<typeof CustomComponentSchema>
> = z.union([
  // ... existing schemas
  CustomComponentSchema,
]);

// Add to TypeScript type
export type CustomComponent = z.infer<typeof CustomComponentSchema>;
export type A2UIComponent = z.infer<typeof ComponentSchema>;

// Add to discriminated union
export type A2UIComponentType =
  | 'Text' | 'Button' | // ... existing types
  | 'Custom';
```

## Backend Tool Integration

### Creating an A2UI Tool

Create file: `src/tools/my-a2ui-tool.ts`

```typescript
import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import type { SurfaceUpdate } from '../core/a2ui/A2UITypes.js';

// Generate A2UI surface for your tool
function generateSurface(params: MyToolParams): {
  surfaceUpdate: SurfaceUpdate;
} {
  const components: unknown[] = [
    {
      id: 'title',
      component: {
        Text: {
          text: { literalString: params.title || 'My Tool' },
          usageHint: 'h3',
        },
      },
    },
    // Add more components...
  ];

  return {
    surfaceUpdate: {
      surfaceId: `my-tool-${Date.now()}`,
      components,
      initialState: {
        toolName: 'my-tool',
        timestamp: Date.now(),
      },
    },
  };
}

// Execute tool
export async function execute(params: MyToolParams): Promise<ToolResult> {
  try {
    // Generate surface
    const { surfaceUpdate } = generateSurface(params);

    // TODO: Send surface via WebSocket to frontend
    // For now, return surface in result
    return {
      success: true,
      result: {
        surfaceId: surfaceUpdate.surfaceId,
        surface: surfaceUpdate,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Tool schema
export const schema: ToolSchema = {
  name: 'my_a2ui_tool',
  description: 'Description of what your tool does',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Title for the A2UI surface' },
      // Add more properties...
    },
    required: ['title'],
  },
};
```

### Handling Actions from Frontend

Create handler in backend:

```typescript
// In WebSocket handler or tool manager
function handleA2UIAction(
  actionId: string,
  surfaceId: string,
  parameters: Record<string, unknown>
): void {
  // Find pending question or surface
  const pending = pendingSurfaces.get(surfaceId);
  
  if (!pending) {
    console.warn(`No surface found for ID: ${surfaceId}`);
    return;
  }

  // Process action based on actionId
  switch (actionId) {
    case 'confirm':
      // Handle confirmation
      pending.resolve({
        success: true,
        surfaceId,
        cancelled: false,
        answers: [parameters],
        timestamp: new Date().toISOString(),
      });
      break;
      
    case 'cancel':
      // Handle cancellation
      pending.resolve({
        success: false,
        surfaceId,
        cancelled: true,
        answers: [],
        timestamp: new Date().toISOString(),
        error: 'User cancelled',
      });
      break;
      
    default:
      // Handle custom actions
      console.log(`Action ${actionId} with params:`, parameters);
  }
  
  // Clean up
  pendingSurfaces.delete(surfaceId);
}
```

## Testing

### Unit Tests

Test component renderers:

```typescript
// src/packages/a2ui-runtime/__tests__/components/A2UICustom.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { A2UICustom } from '../A2UICustom';
import type { A2UIComponent } from '@/packages/a2ui-runtime/core/A2UITypes';

describe('A2UICustom', () => {
  it('should render with title', () => {
    const component: A2UIComponent = {
      Custom: {
        title: { literalString: 'Test Title' },
        dataSource: { literalString: 'test-source' },
        onRefresh: { actionId: 'refresh' },
      },
    };

    const props = {
      component,
      state: {},
      onAction: vi.fn(),
      resolveBinding: vi.fn(),
    };

    render(<A2UICustom {...props} />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });
});
```

### E2E Tests

Test A2UI flow in browser:

```typescript
// tests/e2e/my-a2ui-tool.spec.ts
import { test, expect } from '@playwright/test';

test('My A2UI Tool E2E', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  // Simulate WebSocket message
  await page.evaluate(() => {
    const event = new CustomEvent('ws-message', {
      detail: {
        type: 'a2ui-surface',
        surfaceId: 'test-custom',
        title: 'Custom Tool',
        surface: {
          surfaceId: 'test-custom',
          components: [
            {
              id: 'custom',
              component: {
                Custom: {
                  title: { literalString: 'Test Custom' },
                  dataSource: { literalString: 'data' },
                  onRefresh: { actionId: 'refresh' },
                },
              },
            },
          ],
          initialState: {},
        },
      },
    });
    window.dispatchEvent(event);
  });

  // Verify rendering
  await expect(page.getByText('Test Custom')).toBeVisible();
  await expect(page.getByText('Data source: data')).toBeVisible();
});
```

## Troubleshooting

### Common Issues

#### 1. Component Not Rendering

**Symptoms**: A2UI surface received but component not visible

**Solutions**:
- Verify component is registered in registry
- Check console for warnings about unknown component types
- Ensure component returns valid JSX

```typescript
// Debug: Check if registered
console.log(a2uiRegistry.getRegisteredTypes());
// Should include your component type
```

#### 2. State Not Updating

**Symptoms**: State changes not reflected in UI

**Solutions**:
- Verify binding path matches state key
- Check `resolveBinding` implementation
- Ensure `updateA2UIState` is called with correct surfaceId

```typescript
// Debug: Log state changes
const handleAction = (actionId: string, params: any) => {
  console.log('Action:', actionId, 'Params:', params);
  onAction(actionId, params);
};
```

#### 3. Actions Not Being Sent

**Symptoms**: Clicking buttons doesn't trigger backend action

**Solutions**:
- Check WebSocket connection status
- Verify action event listener is attached
- Ensure actionId matches backend handler

```typescript
// Debug: Monitor a2ui-action events
window.addEventListener('a2ui-action', (e) => {
  console.log('A2UI Action:', (e as CustomEvent).detail);
});
```

#### 4. Parse Errors

**Symptoms**: Surface updates fail validation

**Solutions**:
- Validate JSON structure against A2UI spec
- Check Zod error details
- Use `safeParse` for debugging

```typescript
// Debug: Safe parse with details
const result = a2uiParser.safeParse(jsonString);
if (!result.success) {
  console.error('Parse error:', result.error);
  // Get detailed Zod errors
}
```

### Development Tools

#### React DevTools

Inspect A2UI component hierarchy:

```typescript
// Add data attributes for debugging
<div data-a2ui-component="Custom" data-surface-id={surfaceId}>
  {/* component content */}
</div>
```

#### Logging

Enable verbose logging in development:

```typescript
// In development mode
if (process.env.NODE_ENV === 'development') {
  console.log('[A2UI] Rendering component:', componentType);
  console.log('[A2UI] Surface:', surface);
  console.log('[A2UI] State:', state);
}
```

### Performance Considerations

1. **Lazy Load Components**: For complex custom components, use React.lazy

2. **Debounce Actions**: Prevent rapid action firing

```typescript
import { debounce } from 'lodash-es';

const debouncedAction = debounce(onAction, 300);
```

3. **Memoize Renders**: Use React.memo for expensive components

```typescript
export const A2UICustom = React.memo<ComponentRenderer>(({ /* ... */ }) => {
  // component implementation
});
```

## Additional Resources

- [A2UI Runtime README](./a2ui-runtime/README.md)
- [A2UI Protocol Usage](./a2ui-integration.md#protocol-usage)
- [Component Examples](./a2ui-integration.md#examples)

For questions or issues, please refer to the main CCW documentation.
