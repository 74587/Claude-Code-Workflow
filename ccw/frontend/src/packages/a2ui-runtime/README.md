# A2UI Runtime

A lightweight, framework-agnostic runtime for rendering A2UI (AI-to-UI) surfaces in React applications.

## Overview

A2UI Runtime enables AI agents to generate and update interactive UI components dynamically through a structured protocol. Based on Google's A2UI specification, this runtime provides:

- **Dynamic Surface Rendering**: Create and update UI components in real-time
- **Component Registry**: Extensible system for custom component renderers
- **Type Safety**: Full TypeScript support with Zod validation
- **State Management**: Built-in state binding and action handling
- **Protocol Validation**: Parse and validate A2UI surface updates

## Installation

Located at `src/packages/a2ui-runtime/`, this runtime is included as part of the CCW frontend codebase.

## Core Components

### 1. A2UIParser

Parse and validate A2UI surface updates from JSON.

```typescript
import { a2uiParser } from '@/packages/a2ui-runtime/core';

// Parse JSON string
const surfaceUpdate = a2uiParser.parse(jsonString);

// Validate object
const isValid = a2uiParser.validate(surfaceUpdate);

// Safe parse with result
const result = a2uiParser.safeParse(jsonString);
if (result.success) {
  console.log(result.data);
}
```

### 2. A2UIComponentRegistry

Register and manage component renderers.

```typescript
import { a2uiRegistry } from '@/packages/a2ui-runtime/core';
import { CustomRenderer } from './renderers/CustomRenderer';

// Register a component
a2uiRegistry.register('CustomComponent', CustomRenderer);

// Check if registered
if (a2uiRegistry.has('CustomComponent')) {
  const renderer = a2uiRegistry.get('CustomComponent');
}

// Get all registered types
const types = a2uiRegistry.getRegisteredTypes();
```

### 3. A2UIRenderer

Render A2UI surfaces as React components.

```typescript
import { A2UIRenderer } from '@/packages/a2ui-runtime/renderer';

function MyComponent() {
  const [surface, setSurface] = useState<SurfaceUpdate | null>(null);

  const handleAction = async (actionId: string, params: Record<string, unknown>) => {
    console.log(`Action: ${actionId}`, params);
    // Send action back to AI agent
  };

  return surface ? (
    <A2UIRenderer
      surface={surface}
      onAction={handleAction}
      className="my-surface"
    />
  ) : null;
}
```

## Built-in Components

### Standard Components

| Component | Props | Description |
|-----------|-------|-------------|
| `Text` | `text`, `usageHint` | Text with semantic hint (h1-h6, p, span, code, small) |
| `Button` | `onClick`, `content`, `variant`, `disabled` | Button with variants (primary, secondary, destructive, ghost, outline) |
| `Dropdown` | `options`, `selectedValue`, `onChange`, `placeholder` | Select dropdown with options |
| `TextField` | `value`, `onChange`, `placeholder`, `type` | Text input (text, email, password, number, url) |
| `TextArea` | `value`, `onChange`, `placeholder`, `rows` | Multi-line text input |
| `Checkbox` | `checked`, `onChange`, `label` | Checkbox with label |
| `Progress` | `value`, `max` | Progress bar |
| `Card` | `title`, `description`, `content` | Container with title and nested content |

### Custom Components

| Component | Props | Description |
|-----------|-------|-------------|
| `CLIOutput` | `output`, `language`, `streaming`, `maxLines` | CLI output with syntax highlighting |
| `DateTimeInput` | `value`, `onChange`, `placeholder`, `includeTime` | Date/time picker input |

## A2UI Protocol

### Surface Update Structure

```typescript
interface SurfaceUpdate {
  surfaceId: string;
  components: SurfaceComponent[];
  initialState?: Record<string, unknown>;
}

interface SurfaceComponent {
  id: string;
  component: A2UIComponent;
}
```

### Component Types

All components use a discriminated union structure:

```typescript
// Text Component
{
  Text: {
    text: { literalString: "Hello" } | { path: "state.key" };
    usageHint?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span" | "code" | "small";
  };
}

// Button Component
{
  Button: {
    onClick: { actionId: "submit", parameters?: {} };
    content: A2UIComponent; // Nested component (usually Text)
    variant?: "primary" | "secondary" | "destructive" | "ghost" | "outline";
    disabled?: { literalBoolean: true } | { path: "state.disabled" };
  };
}
```

### Content Bindings

Values can be literal or bound to state:

```typescript
// Literal string
{ literalString: "Hello, World!" }

// Bound to state
{ path: "user.name" }
```

### Actions

Actions are triggered by user interactions:

```typescript
{
  actionId: "save-form",
  parameters: {
    formId: "contact-form",
    validate: true
  }
}
```

## Creating Custom Components

### 1. Define the Renderer

```typescript
import type { ComponentRenderer } from '@/packages/a2ui-runtime/core/A2UIComponentRegistry';
import type { A2UIComponent } from '@/packages/a2ui-runtime/core/A2UITypes';

interface CustomComponentConfig {
  title: { literalString: string } | { path: string };
  items: Array<{ label: string; value: string }>;
  onSelect: { actionId: string; parameters?: Record<string, unknown> };
}

export const CustomRenderer: ComponentRenderer = ({ 
  component, 
  state, 
  onAction, 
  resolveBinding 
}) => {
  const customComp = component as { Custom: CustomComponentConfig };
  const { Custom: config } = customComp;

  const handleSelect = (value: string) => {
    onAction(config.onSelect.actionId, {
      ...config.onSelect.parameters,
      selectedValue: value,
    });
  };

  return (
    <div className="custom-component">
      {/* Your rendering logic */}
    </div>
  );
};
```

### 2. Register the Component

```typescript
import { a2uiRegistry } from '@/packages/a2ui-runtime/core/A2UIComponentRegistry';
import { CustomRenderer } from './CustomRenderer';

a2uiRegistry.register('Custom', CustomRenderer);
```

### 3. Add Type Definition (Optional)

For type safety, extend the A2UI types:

```typescript
// In A2UITypes.ts
export const CustomComponentSchema = z.object({
  Custom: z.object({
    title: TextContentSchema,
    items: z.array(z.object({
      label: z.string(),
      value: z.string(),
    })),
    onSelect: ActionSchema,
  }),
});

// Add to ComponentSchema union
export const ComponentSchema = z.union([
  // ... existing components
  CustomComponentSchema,
]);

// Add to A2UIComponentType
export type A2UIComponentType =
  | 'Text' | 'Button' | // ... existing types
  | 'Custom';
```

## Usage Examples

### Rendering a Simple Form

```typescript
const formSurface: SurfaceUpdate = {
  surfaceId: 'contact-form',
  components: [
    {
      id: 'title',
      component: {
        Text: {
          text: { literalString: 'Contact Form' },
          usageHint: 'h2',
        },
      },
    },
    {
      id: 'name',
      component: {
        TextField: {
          value: { literalString: '' },
          onChange: { actionId: 'update-name', parameters: { field: 'name' } },
          placeholder: 'Your Name',
          type: 'text',
        },
      },
    },
    {
      id: 'email',
      component: {
        TextField: {
          value: { literalString: '' },
          onChange: { actionId: 'update-email', parameters: { field: 'email' } },
          placeholder: 'your@email.com',
          type: 'email',
        },
      },
    },
    {
      id: 'submit',
      component: {
        Button: {
          onClick: { actionId: 'submit-form' },
          content: { Text: { text: { literalString: 'Submit' } } },
          variant: 'primary',
        },
      },
    },
  ],
  initialState: {
    name: '',
    email: '',
  },
};

function ContactForm() {
  const [surface] = useState(formSurface);

  const handleAction = async (actionId: string, params: any) => {
    if (actionId === 'submit-form') {
      // Submit logic
    } else {
      // Update local state
      console.log(`${actionId}:`, params);
    }
  };

  return <A2UIRenderer surface={surface} onAction={handleAction} />;
}
```

### Using CLIOutput Component

```typescript
const cliOutputSurface: SurfaceUpdate = {
  surfaceId: 'build-output',
  components: [
    {
      id: 'output',
      component: {
        CLIOutput: {
          output: { literalString: '$ npm run build\nBuilding...\nDone!' },
          language: 'bash',
          streaming: false,
        },
      },
    },
  ],
};
```

### Using DateTimeInput Component

```typescript
const datetimeSurface: SurfaceUpdate = {
  surfaceId: 'appointment-picker',
  components: [
    {
      id: 'datetime',
      component: {
        DateTimeInput: {
          value: { literalString: '2024-01-15T10:30:00Z' },
          onChange: { actionId: 'update-date' },
          placeholder: 'Select appointment time',
          includeTime: true,
        },
      },
    },
  ],
};
```

## State Management

### Binding Resolution

State is resolved through the `resolveBinding` function:

```typescript
// In your component renderer
const value = resolveBinding({ path: 'user.name' });
```

### State Updates

Send state updates through actions:

```typescript
const handleAction = (actionId: string, params: any) => {
  // Update local state
  setLocalState(prev => ({ ...prev, ...params }));
  
  // Send action to backend
  sendA2UIAction(actionId, surfaceId, params);
};
```

## API Reference

### A2UIParser

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `parse()` | `json: string` | `SurfaceUpdate` | Parse and validate JSON string |
| `parseObject()` | `data: unknown` | `SurfaceUpdate` | Validate object |
| `validate()` | `value: unknown` | `boolean` | Type guard check |
| `safeParse()` | `json: string` | `SafeParseResult` | Parse without throwing |
| `safeParseObject()` | `data: unknown` | `SafeParseResult` | Validate without throwing |
| `validateComponent()` | `component: unknown` | `boolean` | Check if valid component |

### A2UIComponentRegistry

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `register()` | `type, renderer` | `void` | Register component renderer |
| `unregister()` | `type` | `void` | Remove component renderer |
| `get()` | `type` | `ComponentRenderer \| undefined` | Get renderer |
| `has()` | `type` | `boolean` | Check if registered |
| `getRegisteredTypes()` | - | `A2UIComponentType[]` | List all types |
| `clear()` | - | `void` | Remove all renderers |
| `size` | - | `number` | Count of renderers |

## Error Handling

### A2UIParseError

Custom error class for parsing failures:

```typescript
import { A2UIParseError } from '@/packages/a2ui-runtime/core/A2UIParser';

try {
  a2uiParser.parse(invalidJson);
} catch (error) {
  if (error instanceof A2UIParseError) {
    console.error(error.message);
    console.error(error.getDetails()); // Detailed Zod errors
    console.error(error.originalError);
  }
}
```

## Best Practices

1. **Always validate surfaces** before rendering:
   ```typescript
   if (a2uiParser.validate(surfaceUpdate)) {
     return <A2UIRenderer surface={surfaceUpdate} onAction={handleAction} />;
   }
   ```

2. **Handle unknown components** gracefully:
   ```typescript
   const renderer = a2uiRegistry.get(componentType);
   if (!renderer) {
     return <FallbackComponent />;
   }
   ```

3. **Use TypeScript types** for type safety:
   ```typescript
   import type { SurfaceUpdate, A2UIComponent } from '@/packages/a2ui-runtime/core/A2UITypes';
   ```

4. **Clean up resources** when surfaces are removed:
   ```typescript
   useEffect(() => {
     return () => {
       // Cleanup timers, subscriptions, etc.
     };
   }, [surfaceId]);
   ```

## License

Part of the CCW project.
