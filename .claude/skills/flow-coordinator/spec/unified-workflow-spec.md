# Unified Workflow Specification v1.0

> Standard format for PromptTemplate-based workflow definitions

## Overview

This specification defines the JSON schema for unified workflows where **all nodes are prompt templates** with natural language instructions. This replaces the previous multi-type node system with a single, flexible model.

**Design Philosophy**: Every workflow step is a natural language instruction that can optionally specify execution tool and mode. Data flows through named outputs referenced by subsequent steps.

---

## Schema Definition

### Root Object: `Flow`

```typescript
interface Flow {
  id: string;                    // Unique identifier (kebab-case)
  name: string;                  // Display name
  description?: string;          // Human-readable description
  version: number;               // Schema version (currently 1)
  created_at: string;            // ISO 8601 timestamp
  updated_at: string;            // ISO 8601 timestamp
  nodes: FlowNode[];             // Workflow steps
  edges: FlowEdge[];             // Step connections (DAG)
  variables: Record<string, unknown>;  // Global workflow variables
  metadata: FlowMetadata;        // Classification and source info
}
```

### FlowNode

```typescript
interface FlowNode {
  id: string;                    // Unique node ID
  type: 'prompt-template';       // Always 'prompt-template'
  position: { x: number; y: number };  // Canvas position
  data: PromptTemplateNodeData;  // Node configuration
}
```

### PromptTemplateNodeData

```typescript
interface PromptTemplateNodeData {
  // === Required ===
  label: string;                 // Display label in editor
  instruction: string;           // Natural language instruction

  // === Data Flow ===
  outputName?: string;           // Name for output reference
  contextRefs?: string[];        // References to previous outputs

  // === Execution Config ===
  tool?: CliTool;                // 'gemini' | 'qwen' | 'codex' | 'claude'
  mode?: ExecutionMode;          // 'analysis' | 'write' | 'mainprocess' | 'async'

  // === Runtime State (populated during execution) ===
  executionStatus?: ExecutionStatus;
  executionError?: string;
  executionResult?: unknown;
}
```

### FlowEdge

```typescript
interface FlowEdge {
  id: string;                    // Unique edge ID
  source: string;                // Source node ID
  target: string;                // Target node ID
  type?: string;                 // Edge type (default: 'default')
  data?: {
    label?: string;              // Edge label (e.g., 'parallel')
    condition?: string;          // Conditional expression
  };
}
```

### FlowMetadata

```typescript
interface FlowMetadata {
  source?: 'template' | 'custom' | 'imported';
  tags?: string[];
  category?: string;
}
```

---

## Instruction Syntax

### Context References

Use `{{outputName}}` syntax to reference outputs from previous steps:

```
Analyze {{requirements_analysis}} and create implementation plan.
```

### Nested Property Access

```
If {{ci_report.status}} === 'failed', stop execution.
```

### Multiple References

```
Combine {{lint_result}}, {{typecheck_result}}, and {{test_result}} into report.
```

---

## Execution Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| `analysis` | Read-only, no file changes | Code review, exploration |
| `write` | Can create/modify/delete files | Implementation, fixes |
| `mainprocess` | Blocking, synchronous | Interactive steps |
| `async` | Background, non-blocking | Long-running tasks |

---

## DAG Execution Semantics

### Sequential Execution

Nodes with single input edge execute after predecessor completes.

```
[A] ──▶ [B] ──▶ [C]
```

### Parallel Execution

Multiple edges from same source trigger parallel execution:

```
      ┌──▶ [B]
[A] ──┤
      └──▶ [C]
```

### Merge Point

Node with multiple input edges waits for all predecessors:

```
[B] ──┐
      ├──▶ [D]
[C] ──┘
```

### Conditional Branching

Edge `data.condition` specifies branch condition:

```json
{
  "id": "e-decision-success",
  "source": "decision",
  "target": "notify-success",
  "data": { "condition": "decision.result === 'pass'" }
}
```

---

## Example: Minimal Workflow

```json
{
  "id": "simple-analysis",
  "name": "Simple Analysis",
  "version": 1,
  "created_at": "2026-02-04T00:00:00.000Z",
  "updated_at": "2026-02-04T00:00:00.000Z",
  "nodes": [
    {
      "id": "analyze",
      "type": "prompt-template",
      "position": { "x": 100, "y": 100 },
      "data": {
        "label": "Analyze Code",
        "instruction": "Analyze the authentication module for security issues.",
        "outputName": "analysis",
        "tool": "gemini",
        "mode": "analysis"
      }
    },
    {
      "id": "report",
      "type": "prompt-template",
      "position": { "x": 100, "y": 250 },
      "data": {
        "label": "Generate Report",
        "instruction": "Based on {{analysis}}, generate a security report with recommendations.",
        "outputName": "report",
        "contextRefs": ["analysis"]
      }
    }
  ],
  "edges": [
    { "id": "e1", "source": "analyze", "target": "report" }
  ],
  "variables": {},
  "metadata": { "source": "custom", "tags": ["security"] }
}
```

---

## Example: Parallel with Merge

```json
{
  "nodes": [
    {
      "id": "start",
      "type": "prompt-template",
      "position": { "x": 200, "y": 50 },
      "data": {
        "label": "Prepare",
        "instruction": "Set up build environment",
        "outputName": "env"
      }
    },
    {
      "id": "lint",
      "type": "prompt-template",
      "position": { "x": 100, "y": 200 },
      "data": {
        "label": "Lint",
        "instruction": "Run linter checks",
        "outputName": "lint_result",
        "tool": "codex",
        "mode": "analysis",
        "contextRefs": ["env"]
      }
    },
    {
      "id": "test",
      "type": "prompt-template",
      "position": { "x": 300, "y": 200 },
      "data": {
        "label": "Test",
        "instruction": "Run unit tests",
        "outputName": "test_result",
        "tool": "codex",
        "mode": "analysis",
        "contextRefs": ["env"]
      }
    },
    {
      "id": "merge",
      "type": "prompt-template",
      "position": { "x": 200, "y": 350 },
      "data": {
        "label": "Merge Results",
        "instruction": "Combine {{lint_result}} and {{test_result}} into CI report",
        "outputName": "ci_report",
        "contextRefs": ["lint_result", "test_result"]
      }
    }
  ],
  "edges": [
    { "id": "e1", "source": "start", "target": "lint", "data": { "label": "parallel" } },
    { "id": "e2", "source": "start", "target": "test", "data": { "label": "parallel" } },
    { "id": "e3", "source": "lint", "target": "merge" },
    { "id": "e4", "source": "test", "target": "merge" }
  ]
}
```

---

## Migration from Old Format

### Old Template Step

```json
{
  "cmd": "/workflow:lite-plan",
  "args": "\"{{goal}}\"",
  "execution": { "type": "slash-command", "mode": "mainprocess" }
}
```

### New PromptTemplate Node

```json
{
  "id": "plan",
  "type": "prompt-template",
  "data": {
    "label": "Create Plan",
    "instruction": "Execute /workflow:lite-plan for: {{goal}}",
    "outputName": "plan_result",
    "mode": "mainprocess"
  }
}
```

---

## Validation Rules

1. **Unique IDs**: All node and edge IDs must be unique within the flow
2. **Valid References**: `contextRefs` must reference existing `outputName` values
3. **DAG Structure**: No circular dependencies allowed
4. **Required Fields**: `id`, `name`, `version`, `nodes`, `edges` are required
5. **Node Type**: All nodes must have `type: 'prompt-template'`

---

## File Location

Workflow files stored in: `ccw/data/flows/*.json`

Template discovery: `Glob('*.json', { path: 'ccw/data/flows/' })`
