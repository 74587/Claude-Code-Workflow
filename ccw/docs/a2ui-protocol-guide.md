# A2UI Protocol Usage and Troubleshooting Guide

This guide provides comprehensive information about the A2UI protocol for AI agent developers using CCW.

## Table of Contents

1. [Protocol Overview](#protocol-overview)
2. [Surface Update Structure](#surface-update-structure)
3. [Component Reference](#component-reference)
4. [Action Handling](#action-handling)
5. [State Management](#state-management)
6. [Code Examples](#code-examples)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

## Protocol Overview

A2UI (AI-to-UI) is a protocol that enables AI agents to generate dynamic user interfaces through structured JSON messages. The protocol defines:

- **Surface Updates**: Complete UI descriptions that can be rendered
- **Components**: Reusable UI building blocks
- **Actions**: User interaction handlers
- **State**: Data binding and state management

### Message Flow

```
AI Agent ──(generates)──▶ A2UI Surface Update ──(WebSocket)──▶ Frontend
                                                          │
                                                          ▼
                                                    A2UI Parser
                                                          │
                                                          ▼
                                                    Component Registry
                                                          │
                                                          ▼
                                                    Rendered UI
                                                          │
                                                          ▼
                                                    User Interaction
                                                          │
                                                          ▼
                                                    Action Event ──(WebSocket)──▶ Backend
                                                                                   │
                                                                                   ▼
                                                                              AI Agent
```

## Surface Update Structure

### Basic Structure

```json
{
  "surfaceId": "unique-surface-identifier",
  "components": [
    {
      "id": "component-1",
      "component": {
        "ComponentType": {
          // Component-specific properties
        }
      }
    }
  ],
  "initialState": {
    "key": "value",
    "nested": {
      "data": true
    }
  }
}
```

### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `surfaceId` | string | Yes | Unique identifier for this surface |
| `components` | SurfaceComponent[] | Yes | Array of component definitions |
| `initialState` | Record<string, unknown> | No | Initial state for bindings |

## Component Reference

### Content Types

#### Literal String

Direct text value:

```json
{
  "literalString": "Hello, World!"
}
```

#### Binding

Reference to state value:

```json
{
  "path": "user.name"
}
```

### Standard Components

#### Text

Display text with semantic hints.

```json
{
  "Text": {
    "text": { "literalString": "Hello" },
    "usageHint": "h1"
  }
}
```

| Property | Type | Required | Values |
|----------|------|----------|--------|
| `text` | Content | Yes | Literal or binding |
| `usageHint` | string | No | h1, h2, h3, h4, h5, h6, p, span, code, small |

#### Button

Clickable button with nested content.

```json
{
  "Button": {
    "onClick": { "actionId": "submit", "parameters": { "formId": "login" } },
    "content": {
      "Text": { "text": { "literalString": "Submit" } }
    },
    "variant": "primary",
    "disabled": { "literalBoolean": false }
  }
}
```

| Property | Type | Required | Values |
|----------|------|----------|--------|
| `onClick` | Action | Yes | Action definition |
| `content` | Component | Yes | Nested component (usually Text) |
| `variant` | string | No | primary, secondary, destructive, ghost, outline |
| `disabled` | BooleanContent | No | Literal or binding |

#### Dropdown

Select dropdown with options.

```json
{
  "Dropdown": {
    "options": [
      { "label": { "literalString": "Option 1" }, "value": "opt1" },
      { "label": { "literalString": "Option 2" }, "value": "opt2" }
    ],
    "selectedValue": { "literalString": "opt1" },
    "onChange": { "actionId": "select-change" },
    "placeholder": "Select an option"
  }
}
```

#### TextField

Single-line text input.

```json
{
  "TextField": {
    "value": { "literalString": "Initial value" },
    "onChange": { "actionId": "input-change", "parameters": { "field": "username" } },
    "placeholder": "Enter username",
    "type": "text"
  }
}
```

| Property | Type | Required | Values |
|----------|------|----------|--------|
| `type` | string | No | text, email, password, number, url |

#### TextArea

Multi-line text input.

```json
{
  "TextArea": {
    "onChange": { "actionId": "textarea-change" },
    "placeholder": "Enter description",
    "rows": 5
  }
}
```

#### Checkbox

Boolean checkbox with label.

```json
{
  "Checkbox": {
    "checked": { "literalBoolean": true },
    "onChange": { "actionId": "checkbox-change" },
    "label": { "literalString": "Accept terms" }
  }
}
```

#### Progress

Progress bar indicator.

```json
{
  "Progress": {
    "value": { "literalNumber": 75 },
    "max": 100
  }
}
```

#### Card

Container with title and nested content.

```json
{
  "Card": {
    "title": { "literalString": "Card Title" },
    "description": { "literalString": "Card description" },
    "content": [
      {
        "id": "text-1",
        "component": {
          "Text": { "text": { "literalString": "Card content" } }
        }
      }
    ]
  }
}
```

### Custom Components

#### CLIOutput

Terminal-style output with syntax highlighting.

```json
{
  "CLIOutput": {
    "output": { "literalString": "$ npm install\nInstalling...\nDone!" },
    "language": "bash",
    "streaming": false,
    "maxLines": 100
  }
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `output` | Content | Yes | Text to display |
| `language` | string | No | bash, javascript, python, etc. |
| `streaming` | boolean | No | Show streaming indicator |
| `maxLines` | number | No | Limit output lines |

#### DateTimeInput

Date and time picker.

```json
{
  "DateTimeInput": {
    "value": { "literalString": "2024-01-15T10:30:00Z" },
    "onChange": { "actionId": "datetime-change" },
    "placeholder": "Select date and time",
    "includeTime": true,
    "minDate": { "literalString": "2024-01-01T00:00:00Z" },
    "maxDate": { "literalString": "2024-12-31T23:59:59Z" }
  }
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `includeTime` | boolean | No | Include time (default: true) |
| `minDate` | Content | No | Minimum selectable date |
| `maxDate` | Content | No | Maximum selectable date |

## Action Handling

### Action Structure

```json
{
  "actionId": "unique-action-id",
  "parameters": {
    "key1": "value1",
    "key2": 42
  }
}
```

### Action Flow

1. User interacts with component (click, type, select)
2. Component triggers `onAction` callback
3. Action sent via WebSocket to backend
4. Backend processes action and responds

### Action Response

Backend can respond with:

- **State Update**: Update component state
- **New Surface**: Replace or add components
- **Close Surface**: Dismiss notification/dialog

## State Management

### State Binding

Components can bind to state values:

```json
{
  "TextField": {
    "value": { "path": "form.username" },
    "onChange": { "actionId": "update-field" }
  }
}
```

### State Update

Backend sends state updates:

```json
{
  "type": "a2ui-state-update",
  "surfaceId": "form-surface",
  "updates": {
    "form": {
      "username": "newvalue",
      "email": "updated@example.com"
    }
  }
}
```

## Code Examples

### Example 1: Simple Form

```json
{
  "surfaceId": "login-form",
  "components": [
    {
      "id": "title",
      "component": {
        "Text": {
          "text": { "literalString": "Login" },
          "usageHint": "h2"
        }
      }
    },
    {
      "id": "username",
      "component": {
        "TextField": {
          "onChange": { "actionId": "field-change", "parameters": { "field": "username" } },
          "placeholder": "Username",
          "type": "text"
        }
      }
    },
    {
      "id": "password",
      "component": {
        "TextField": {
          "onChange": { "actionId": "field-change", "parameters": { "field": "password" } },
          "placeholder": "Password",
          "type": "password"
        }
      }
    },
    {
      "id": "submit",
      "component": {
        "Button": {
          "onClick": { "actionId": "login" },
          "content": {
            "Text": { "text": { "literalString": "Login" } }
          },
          "variant": "primary"
        }
      }
    }
  ],
  "initialState": {
    "username": "",
    "password": ""
  }
}
```

### Example 2: Data Display with Actions

```json
{
  "surfaceId": "user-list",
  "components": [
    {
      "id": "title",
      "component": {
        "Text": {
          "text": { "literalString": "Users" },
          "usageHint": "h3"
        }
      }
    },
    {
      "id": "user-card",
      "component": {
        "Card": {
          "title": { "path": "users.0.name" },
          "description": { "path": "users.0.email" },
          "content": [
            {
              "id": "edit-btn",
              "component": {
                "Button": {
                  "onClick": { "actionId": "edit-user", "parameters": { "userId": "1" } },
                  "content": { "Text": { "text": { "literalString": "Edit" } } },
                  "variant": "secondary"
                }
              }
            }
          ]
        }
      }
    }
  ],
  "initialState": {
    "users": [
      { "id": 1, "name": "Alice", "email": "alice@example.com" },
      { "id": 2, "name": "Bob", "email": "bob@example.com" }
    ]
  }
}
```

### Example 3: CLI Output with Progress

```json
{
  "surfaceId": "build-progress",
  "components": [
    {
      "id": "title",
      "component": {
        "Text": {
          "text": { "literalString": "Building Project" },
          "usageHint": "h3"
        }
      }
    },
    {
      "id": "progress",
      "component": {
        "Progress": {
          "value": { "path": "build.progress" },
          "max": 100
        }
      }
    },
    {
      "id": "output",
      "component": {
        "CLIOutput": {
          "output": { "path": "build.output" },
          "language": "bash",
          "streaming": { "path": "build.running" }
        }
      }
    }
  ],
  "initialState": {
    "build": {
      "progress": 45,
      "output": "$ npm run build\nBuilding module 1/3...",
      "running": true
    }
  }
}
```

## Troubleshooting

### Common Errors

#### Parse Errors

**Error**: `A2UI validation failed`

**Causes**:
- Invalid JSON structure
- Missing required fields
- Invalid component type
- Wrong data type for property

**Solution**:
```typescript
// Use safeParse to get detailed errors
const result = a2uiParser.safeParse(jsonString);
if (!result.success) {
  console.error('Validation errors:', result.error.errors);
}
```

#### Unknown Component Type

**Error**: `Unknown component type: XYZ`

**Causes**:
- Component not registered in registry
- Typo in component type name
- Custom component not exported

**Solution**:
```typescript
// Check registered components
console.log(a2uiRegistry.getRegisteredTypes());
// Should include: ['Text', 'Button', 'XYZ', ...]

// Register custom component
a2uiRegistry.register('XYZ', XYZRenderer);
```

#### State Binding Failures

**Error**: State not updating or showing undefined

**Causes**:
- Wrong binding path
- State not initialized
- Case-sensitive path mismatch

**Solution**:
```typescript
// Ensure state exists in initialState
initialState: {
  user: {
    name: "Alice"
  }
}

// Use correct binding path
{ "path": "user.name" }  // ✓
{ "path": "User.name" }  // ✗ (case mismatch)
```

### Debugging Tips

#### Enable Verbose Logging

```typescript
// In development
if (process.env.NODE_ENV === 'development') {
  (window as any).A2UI_DEBUG = true;
}
```

#### Inspect Component Props

```typescript
// Add logging in renderer
export const A2UICustom: ComponentRenderer = (props) => {
  console.log('[A2UICustom] Props:', props);
  // ... rest of implementation
};
```

#### Validate Before Sending

```typescript
// Backend: Validate before sending
const result = a2uiParser.safeParseObject(surfaceUpdate);
if (!result.success) {
  console.error('Invalid surface:', result.error);
  return;
}
// Safe to send
ws.send(JSON.stringify(surfaceUpdate));
```

### Performance Issues

#### Too Many Re-renders

**Symptoms**: UI lagging, high CPU usage

**Solutions**:
- Memoize expensive components
- Debounce rapid actions
- Limit component count per surface

```typescript
import { memo } from 'react';

export const ExpensiveComponent = memo<A2UIComponentType>(({ 
  component, state, onAction, resolveBinding 
}) => {
  // Component implementation
});
```

#### Large Output in CLIOutput

**Symptoms**: Page freeze with large CLI output

**Solutions**:
```json
{
  "CLIOutput": {
    "output": { "path": "output" },
    "maxLines": 1000
  }
}
```

## Best Practices

### 1. Component IDs

Use unique, descriptive IDs:

```json
{
  "id": "user-form-username",
  "component": { ... }
}
```

### 2. Surface IDs

Include timestamp for uniqueness:

```json
{
  "surfaceId": "form-1704067200000",
  "components": [...]
}
```

### 3. State Structure

Organize state logically:

```json
{
  "initialState": {
    "form": {
      "username": "",
      "email": ""
    },
    "ui": {
      "loading": false,
      "error": null
    }
  }
}
```

### 4. Error Handling

Always include error states:

```json
{
  "components": [
    {
      "id": "error-display",
      "component": {
        "Text": {
          "text": { "path": "ui.error" },
          "usageHint": "p"
        }
      }
    }
  ]
}
```

### 5. Progressive Enhancement

Start simple, add complexity:

```json
// Simple: Just text
{ "Text": { "text": { "literalString": "Status: OK" } } }

// Enhanced: Add status indicator
{
  "Card": {
    "title": { "literalString": "Status" },
    "content": [
      {
        "Text": { "text": { "literalString": "OK" } }
      },
      {
        "Progress": { "value": { "literalNumber": 100 } }
      }
    ]
  }
}
```

### 6. Accessibility

- Use semantic usageHint values (h1-h6, p)
- Provide labels for inputs
- Include descriptions for complex interactions

## Quick Reference

### Action IDs

Use descriptive, action-oriented IDs:

- `submit-form`, `cancel-action`, `delete-item`
- `refresh-data`, `load-more`, `sort-by-date`

### Binding Paths

Use dot notation for nested paths:

- `user.profile.name`
- `items.0.title`
- `form.settings.theme`

### Component Variants

| Variant | Use Case |
|---------|----------|
| primary | Main action, important |
| secondary | Alternative action |
| destructive | Dangerous actions (delete) |
| ghost | Subtle, unobtrusive |
| outline | Bordered, less emphasis |

### Language Values for CLIOutput

| Language | Use For |
|----------|---------|
| bash | Shell commands, terminal output |
| javascript | JS/TS code, console logs |
| python | Python code, error traces |
| text | Plain text, no highlighting |

## Support

For issues, questions, or contributions:

- Check existing [Issues](../../issues)
- Review [Integration Guide](./a2ui-integration.md)
- See [Component Examples](../../src/packages/a2ui-runtime/renderer/components/)
