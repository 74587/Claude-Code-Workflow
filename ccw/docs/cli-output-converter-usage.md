# CLI Output Converter Usage Guide

## Overview

The CLI Output Converter provides a unified Intermediate Representation (IR) layer for CLI tool output, enabling clean separation between output parsing and consumption scenarios.

## Architecture

```
┌─────────────────┐
│  CLI Tool       │
│  (stdout/stderr)│
└────────┬────────┘
         │ Buffer chunks
         ▼
┌─────────────────┐
│ Output Parser   │
│ (text/json-lines)│
└────────┬────────┘
         │ CliOutputUnit[]
         ▼
┌─────────────────────────────────────┐
│  Intermediate Representation (IR)  │
│  - type: stdout|stderr|thought|...  │
│  - content: string | object         │
│  - timestamp: ISO 8601              │
└────┬────────────────────────────┬───┘
     │                            │
     ▼                            ▼
┌─────────────┐            ┌─────────────┐
│   Storage   │            │    View     │
│   (SQLite)  │            │  (Dashboard)│
└─────────────┘            └─────────────┘
                                 │
                                 ▼
                           ┌─────────────┐
                           │   Resume    │
                           │  (Flatten)  │
                           └─────────────┘
```

## Basic Usage

### 1. Creating Parsers

```typescript
import { createOutputParser } from './cli-output-converter.js';

// For plain text output (e.g., Gemini/Qwen plain mode)
const textParser = createOutputParser('text');

// For JSON Lines output (e.g., Codex JSONL format)
const jsonParser = createOutputParser('json-lines');
```

### 2. Parsing Stream Chunks

```typescript
import { spawn } from 'child_process';
import { createOutputParser } from './cli-output-converter.js';

const parser = createOutputParser('json-lines');
const allUnits: CliOutputUnit[] = [];

const child = spawn('codex', ['run', 'task']);

child.stdout.on('data', (chunk: Buffer) => {
  const units = parser.parse(chunk, 'stdout');
  allUnits.push(...units);

  // Real-time processing
  for (const unit of units) {
    console.log(`[${unit.type}] ${unit.content}`);
  }
});

child.stderr.on('data', (chunk: Buffer) => {
  const units = parser.parse(chunk, 'stderr');
  allUnits.push(...units);
});

child.on('close', () => {
  // Flush remaining buffer
  const remaining = parser.flush();
  allUnits.push(...remaining);

  // Save to storage
  saveToDatabase(allUnits);
});
```

### 3. Integration with CLI Executor

```typescript
// In cli-executor-core.ts
import { createOutputParser, type CliOutputUnit } from './cli-output-converter.js';

async function executeCliTool(params: CliParams) {
  const parser = createOutputParser(params.format === 'json-lines' ? 'json-lines' : 'text');
  const structuredOutput: CliOutputUnit[] = [];

  child.stdout.on('data', (data) => {
    const text = data.toString();
    stdout += text;

    // Parse into IR
    const units = parser.parse(data, 'stdout');
    structuredOutput.push(...units);

    // Existing streaming logic
    if (onOutput) {
      onOutput({ type: 'stdout', data: text });
    }
  });

  child.on('close', () => {
    // Flush parser
    structuredOutput.push(...parser.flush());

    // Create turn with structured output
    const newTurn: ConversationTurn = {
      turn: turnNumber,
      timestamp: new Date().toISOString(),
      prompt,
      duration_ms,
      status,
      exit_code: code,
      output: {
        stdout: stdout.substring(0, 10240),
        stderr: stderr.substring(0, 2048),
        truncated: stdout.length > 10240 || stderr.length > 2048,
        cached: shouldCache,
        stdout_full: shouldCache ? stdout : undefined,
        stderr_full: shouldCache ? stderr : undefined,
        structured: structuredOutput.length > 0 ? structuredOutput : undefined
      }
    };
  });
}
```

## Scenario-Specific Usage

### Scenario 1: View (Dashboard Display)

```typescript
// In dashboard rendering logic
import { type CliOutputUnit } from '../tools/cli-output-converter.js';

function renderOutputUnits(units: CliOutputUnit[]) {
  return units.map(unit => {
    switch (unit.type) {
      case 'thought':
        return `<div class="thought">${unit.content}</div>`;
      case 'code':
        return `<pre><code>${unit.content}</code></pre>`;
      case 'file_diff':
        return renderDiff(unit.content);
      case 'progress':
        return renderProgress(unit.content);
      default:
        return `<div class="output">${unit.content}</div>`;
    }
  }).join('\n');
}
```

### Scenario 2: Storage (Backward Compatible)

```typescript
// In cli-history-store.ts
function saveConversation(conversation: ConversationRecord) {
  for (const turn of conversation.turns) {
    // Save traditional fields
    db.run(`
      INSERT INTO turns (stdout, stderr, truncated, ...)
      VALUES (?, ?, ?, ...)
    `, turn.output.stdout, turn.output.stderr, turn.output.truncated);

    // Optionally save structured output
    if (turn.output.structured) {
      db.run(`
        INSERT INTO turn_structured_output (turn_id, units)
        VALUES (?, ?)
      `, turnId, JSON.stringify(turn.output.structured));
    }
  }
}
```

### Scenario 3: Resume (Context Concatenation)

```typescript
// In resume-strategy.ts or cli-prompt-builder.ts
import { flattenOutputUnits } from './cli-output-converter.js';

function buildContextFromTurns(turns: ConversationTurn[]): string {
  const lines: string[] = [];

  for (const turn of turns) {
    lines.push(`USER: ${turn.prompt}`);

    // Use structured output if available
    if (turn.output.structured) {
      const assistantText = flattenOutputUnits(turn.output.structured, {
        excludeTypes: ['metadata', 'system'],  // Skip noise
        includeTypes: ['stdout', 'thought', 'code']  // Keep meaningful content
      });
      lines.push(`ASSISTANT: ${assistantText}`);
    } else {
      // Fallback to plain stdout
      lines.push(`ASSISTANT: ${turn.output.stdout}`);
    }
  }

  return lines.join('\n\n');
}
```

## Advanced Features

### Filtering by Type

```typescript
import { flattenOutputUnits, extractContent } from './cli-output-converter.js';

// Extract only AI thoughts for analysis
const thoughts = extractContent(units, 'thought');

// Get only code blocks
const codeBlocks = extractContent(units, 'code');

// Create clean context (exclude system noise)
const cleanContext = flattenOutputUnits(units, {
  excludeTypes: ['metadata', 'system', 'progress']
});
```

### Analytics

```typescript
import { getOutputStats } from './cli-output-converter.js';

const stats = getOutputStats(units);
console.log(`Total units: ${stats.total}`);
console.log(`Thoughts: ${stats.byType.thought || 0}`);
console.log(`Code blocks: ${stats.byType.code || 0}`);
console.log(`Duration: ${stats.firstTimestamp} - ${stats.lastTimestamp}`);
```

### Custom Processing

```typescript
function processUnits(units: CliOutputUnit[]) {
  for (const unit of units) {
    switch (unit.type) {
      case 'file_diff':
        // Apply diff to file system
        applyDiff(unit.content.path, unit.content.diff);
        break;
      case 'progress':
        // Update progress bar
        updateProgress(unit.content.progress, unit.content.total);
        break;
      case 'thought':
        // Log reasoning
        logThought(unit.content);
        break;
    }
  }
}
```

## Type Reference

### CliOutputUnitType

```typescript
type CliOutputUnitType =
  | 'stdout'      // Standard output text
  | 'stderr'      // Standard error text
  | 'thought'     // AI reasoning/thinking
  | 'code'        // Code block content
  | 'file_diff'   // File modification diff
  | 'progress'    // Progress updates
  | 'metadata'    // Session/execution metadata
  | 'system';     // System events/messages
```

### CliOutputUnit

```typescript
interface CliOutputUnit<T = any> {
  type: CliOutputUnitType;
  content: T;          // string for text types, object for structured types
  timestamp: string;   // ISO 8601 format
}
```

## Migration Path

### Phase 1: Optional Enhancement (Current)
- Add `structured` field to `ConversationTurn.output`
- Populate during parsing (optional)
- Existing code ignores it (backward compatible)

### Phase 2: View Integration
- Dashboard uses `structured` when available
- Falls back to plain `stdout` when not present
- Better rendering for thoughts, code, diffs

### Phase 3: Resume Optimization
- Resume logic prefers `structured` for cleaner context
- Filters out noise (metadata, system events)
- Reduces token usage while preserving semantics

### Phase 4: Full Adoption
- All CLI tools use converters
- Storage optimized for structured data
- Analytics and insights from IR layer

## Best Practices

1. **Always flush the parser** when stream ends to capture incomplete lines
2. **Filter by type** for Resume scenarios to reduce token usage
3. **Use structured content** when available for better display
4. **Keep backward compatibility** by making `structured` optional
5. **Handle missing fields** gracefully (not all tools output JSON)
6. **Validate JSON** before parsing to avoid crashes

## Future Enhancements

1. **Streaming transformers** - Apply transformations during parsing
2. **Custom type mappers** - Register custom JSON-to-IR mappings
3. **Compression** - Store structured output more efficiently
4. **Semantic search** - Index thoughts and code separately
5. **Diff viewer** - Interactive file_diff rendering
6. **Progress tracking** - Aggregate progress events across tools
