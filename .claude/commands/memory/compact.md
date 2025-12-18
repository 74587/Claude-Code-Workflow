---
name: compact
description: Compact current session memory into structured text for session recovery, extracting objective/plan/files/decisions/constraints/state, and save via MCP core_memory tool
argument-hint: "[optional: session description]"
allowed-tools: mcp__ccw-tools__core_memory(*), Read(*)
examples:
  - /memory:compact
  - /memory:compact "completed core-memory module"
---

# Memory Compact Command (/memory:compact)

## 1. Overview

The `memory:compact` command **compresses current session working memory** into structured text optimized for **session recovery**, extracts critical information, and saves it to persistent storage via MCP `core_memory` tool.

**Core Philosophy**:
- **Session Recovery First**: Capture everything needed to resume work seamlessly
- **Minimize Re-exploration**: Include file paths, decisions, and state to avoid redundant analysis
- **Preserve Train of Thought**: Keep notes and hypotheses for complex debugging
- **Actionable State**: Record last action result and known issues

## 2. Parameters

- `"session description"` (Optional): Session description to supplement objective
  - Example: "completed core-memory module"
  - Example: "debugging JWT refresh - suspected memory leak"

## 3. Structured Output Format

```markdown
## Objective
[High-level goal - the "North Star" of this session]

## Plan
- [x] [Completed step]
- [x] [Completed step]
- [ ] [Pending step]

## Active Files
- path/to/file1.ts (role: main implementation)
- path/to/file2.ts (role: tests)

## Last Action
[Last significant action and its result/status]

## Decisions
- [Decision]: [Reasoning]
- [Decision]: [Reasoning]

## Constraints
- [User-specified limitation or preference]

## Dependencies
- [Added/changed packages or environment requirements]

## Known Issues
- [Deferred bug or edge case]

## Changes Made
- [Completed modification]

## Pending
- [Next step] or (none)

## Notes
[Unstructured thoughts, hypotheses, debugging trails]
```

## 4. Field Definitions

| Field | Purpose | Recovery Value |
|-------|---------|----------------|
| **Objective** | Ultimate goal of the session | Prevents losing track of broader feature |
| **Plan** | Steps with status markers | Avoids re-planning or repeating steps |
| **Active Files** | Working set of files | Eliminates re-exploration of codebase |
| **Last Action** | Final tool output/status | Immediate state awareness (success/failure) |
| **Decisions** | Architectural choices + reasoning | Prevents re-litigating settled decisions |
| **Constraints** | User-imposed limitations | Maintains personalized coding style |
| **Dependencies** | Package/environment changes | Prevents missing dependency errors |
| **Known Issues** | Deferred bugs/edge cases | Ensures issues aren't forgotten |
| **Changes Made** | Completed modifications | Clear record of what was done |
| **Pending** | Next steps | Immediate action items |
| **Notes** | Hypotheses, debugging trails | Preserves "train of thought" |

## 5. Execution Flow

### Step 1: Analyze Current Session

Extract the following from conversation history:

```javascript
const sessionAnalysis = {
  objective: "",       // High-level goal (1-2 sentences)
  plan: [],            // Steps with status: {step, status: 'done'|'pending'}
  activeFiles: [],     // {path, role} - working set
  lastAction: "",      // Last significant action + result
  decisions: [],       // {decision, reasoning}
  constraints: [],     // User-specified limitations
  dependencies: [],    // Added/changed packages
  knownIssues: [],     // Deferred bugs
  changesMade: [],     // Completed modifications
  pending: [],         // Next steps
  notes: ""            // Unstructured thoughts
}
```

### Step 2: Generate Structured Text

```javascript
const structuredText = `## Objective
${sessionAnalysis.objective}

## Plan
${sessionAnalysis.plan.map(p =>
  `- [${p.status === 'done' ? 'x' : ' '}] ${p.step}`
).join('\n')}

## Active Files
${sessionAnalysis.activeFiles.map(f => `- ${f.path} (${f.role})`).join('\n')}

## Last Action
${sessionAnalysis.lastAction}

## Decisions
${sessionAnalysis.decisions.map(d => `- ${d.decision}: ${d.reasoning}`).join('\n') || '(none)'}

## Constraints
${sessionAnalysis.constraints.map(c => `- ${c}`).join('\n') || '(none)'}

## Dependencies
${sessionAnalysis.dependencies.map(d => `- ${d}`).join('\n') || '(none)'}

## Known Issues
${sessionAnalysis.knownIssues.map(i => `- ${i}`).join('\n') || '(none)'}

## Changes Made
${sessionAnalysis.changesMade.map(c => `- ${c}`).join('\n')}

## Pending
${sessionAnalysis.pending.length > 0
  ? sessionAnalysis.pending.map(p => `- ${p}`).join('\n')
  : '(none)'}

## Notes
${sessionAnalysis.notes || '(none)'}`
```

### Step 3: Import to Core Memory via MCP

Use the MCP `core_memory` tool to save the structured text:

```javascript
mcp__ccw-tools__core_memory({
  operation: "import",
  text: structuredText
})
```

**Response Format**:
```json
{
  "operation": "import",
  "id": "CMEM-YYYYMMDD-HHMMSS",
  "message": "Created memory: CMEM-YYYYMMDD-HHMMSS"
}
```

### Step 4: Report Recovery ID

After successful import, **clearly display the Recovery ID** to the user:

```
╔══════════════════════════════════════════════════════════════╗
║  ✓ Session Memory Saved                                      ║
║                                                              ║
║  Recovery ID: CMEM-YYYYMMDD-HHMMSS                          ║
║                                                              ║
║  To restore this session in a new conversation:              ║
║  > Use MCP: core_memory(operation="export", id="<ID>")      ║
║  > Or CLI:  ccw core-memory export --id <ID>                ║
╚══════════════════════════════════════════════════════════════╝
```

## 6. Usage Example

```bash
/memory:compact
```

**Output**:
```markdown
## Objective
Add core-memory module to ccw for persistent memory management with knowledge graph visualization

## Plan
- [x] Create CoreMemoryStore with SQLite backend
- [x] Implement RESTful API routes (/api/core-memory/*)
- [x] Build frontend three-column view
- [x] Simplify CLI to 4 commands
- [x] Extend graph-explorer with data source switch

## Active Files
- ccw/src/core/core-memory-store.ts (storage layer)
- ccw/src/core/routes/core-memory-routes.ts (API)
- ccw/src/commands/core-memory.ts (CLI)
- ccw/src/templates/dashboard-js/views/core-memory.js (frontend)

## Last Action
TypeScript build succeeded with no errors

## Decisions
- Independent storage: Avoid conflicts with existing memory-store.ts
- Timestamp-based ID (CMEM-YYYYMMDD-HHMMSS): Human-readable and sortable
- Extend graph-explorer: Reuse existing Cytoscape infrastructure

## Constraints
- CLI must be simple: only list/import/export/summary commands
- Import/export use plain text, not files

## Dependencies
- No new packages added (uses existing better-sqlite3)

## Known Issues
- N+1 query in graph aggregation (acceptable for initial scale)

## Changes Made
- Created 4 new files (store, routes, CLI, frontend view)
- Modified server.ts, navigation.js, i18n.js
- Added /memory:compact slash command

## Pending
(none)

## Notes
User prefers minimal CLI design. Graph aggregation can be optimized with JOIN query if memory count grows.
```

**Result**:
```
╔══════════════════════════════════════════════════════════════╗
║  ✓ Session Memory Saved                                      ║
║                                                              ║
║  Recovery ID: CMEM-20251218-150322                          ║
║                                                              ║
║  To restore this session in a new conversation:              ║
║  > Use MCP: core_memory(operation="export", id="<ID>")      ║
║  > Or CLI:  ccw core-memory export --id <ID>                ║
╚══════════════════════════════════════════════════════════════╝
```

## 7. Recovery Usage

When starting a new session, load previous context using MCP tools:

```javascript
// List available memories
mcp__ccw-tools__core_memory({ operation: "list" })

// Export and read previous session
mcp__ccw-tools__core_memory({ operation: "export", id: "CMEM-20251218-150322" })

// Or generate AI summary for quick context
mcp__ccw-tools__core_memory({ operation: "summary", id: "CMEM-20251218-150322" })
```

Or via CLI:

```bash
ccw core-memory list
ccw core-memory export --id CMEM-20251218-150322
ccw core-memory summary --id CMEM-20251218-150322
```

## 8. Quality Checklist

Before generating:
- [ ] Objective clearly states the "North Star" goal
- [ ] Plan shows completion status with [x] / [ ] markers
- [ ] Active Files includes 3-8 core files with roles
- [ ] Last Action captures final state (success/failure)
- [ ] Decisions include reasoning, not just choices
- [ ] Known Issues separates deferred from forgotten bugs
- [ ] Notes preserve debugging hypotheses if any

## 9. Notes

- **Timing**: Execute at task completion or before context switch
- **Frequency**: Once per independent task or milestone
- **Recovery**: New session can immediately continue with full context
- **Knowledge Graph**: Entity relationships auto-extracted for visualization
