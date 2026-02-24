# Analyze Task Generation Spec

> **Purpose**: Quality standards for converting `conclusions.json` recommendations into `.task/*.json` files.
> **Consumer**: Phase 5 of `analyze-with-file` workflow.
> **Execution**: Handled by `unified-execute-with-file` — this document covers generation only.

---

## Task Generation Flow

```
conclusions.json ──┐
                   ├── resolveTargetFiles() ──┐
codebaseContext ───┘                          ├── .task/TASK-001.json
                                              ├── .task/TASK-002.json
explorations.json ── enrichContext() ─────────┘
```

**Input artifacts** (all from session folder):

| Artifact | Required | Provides |
|----------|----------|----------|
| `conclusions.json` | Yes | `recommendations[]` with action, rationale, priority, target_files, changes, implementation_hints, evidence_refs |
| `exploration-codebase.json` | No | `relevant_files[]`, `patterns[]`, `constraints[]`, `integration_points[]` — primary source for file resolution |
| `explorations.json` | No | `sources[]`, `key_findings[]` — fallback for file resolution |
| `perspectives.json` | No | Multi-perspective findings — alternative to explorations.json |

---

## File Resolution Algorithm

Target files are resolved with a 3-priority fallback chain:

```javascript
function resolveTargetFiles(rec, codebaseContext, explorations) {
  // Priority 1: Explicit target_files from recommendations (Phase 4 enriched)
  if (rec.target_files?.length) {
    return rec.target_files.map(path => ({
      path,
      action: 'modify',
      target: null,
      changes: rec.changes || []
    }))
  }

  // Priority 2: Match from exploration-codebase.json relevant_files
  if (codebaseContext?.relevant_files?.length) {
    const keywords = extractKeywords(rec.action + ' ' + rec.rationale)
    const matched = codebaseContext.relevant_files.filter(f =>
      keywords.some(kw =>
        f.path.toLowerCase().includes(kw) ||
        f.summary?.toLowerCase().includes(kw) ||
        f.relevance?.toLowerCase().includes(kw)
      )
    )
    if (matched.length) {
      return matched.map(f => ({
        path: f.path,
        action: 'modify',
        target: null,
        changes: rec.changes || []
      }))
    }
  }

  // Priority 3: Match from explorations.json sources
  if (explorations?.sources?.length) {
    const actionVerb = rec.action.split(' ')[0].toLowerCase()
    const matched = explorations.sources.filter(s =>
      s.summary?.toLowerCase().includes(actionVerb) ||
      s.file?.includes(actionVerb)
    )
    if (matched.length) {
      return matched.map(s => ({
        path: s.file,
        action: 'modify',
        target: null,
        changes: []
      }))
    }
  }

  // Fallback: empty array — task relies on description + implementation for guidance
  return []
}

function extractKeywords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !['the', 'and', 'for', 'with', 'from', 'that', 'this'].includes(w))
}
```

---

## Task Type Inference

| Recommendation Pattern | Inferred Type |
|------------------------|---------------|
| fix, resolve, repair, patch, correct | `fix` |
| refactor, restructure, extract, reorganize, decouple | `refactor` |
| add, implement, create, build, introduce | `feature` |
| improve, optimize, enhance, upgrade, streamline | `enhancement` |
| test, coverage, validate, verify, assert | `testing` |

```javascript
function inferTaskType(rec) {
  const text = (rec.action + ' ' + rec.rationale).toLowerCase()
  const patterns = [
    { type: 'fix',         keywords: ['fix', 'resolve', 'repair', 'patch', 'correct', 'bug'] },
    { type: 'refactor',    keywords: ['refactor', 'restructure', 'extract', 'reorganize', 'decouple'] },
    { type: 'feature',     keywords: ['add', 'implement', 'create', 'build', 'introduce'] },
    { type: 'enhancement', keywords: ['improve', 'optimize', 'enhance', 'upgrade', 'streamline'] },
    { type: 'testing',     keywords: ['test', 'coverage', 'validate', 'verify', 'assert'] }
  ]
  for (const p of patterns) {
    if (p.keywords.some(kw => text.includes(kw))) return p.type
  }
  return 'enhancement'  // safe default
}
```

## Effort Inference

| Signal | Effort |
|--------|--------|
| priority=high AND files >= 3 | `large` |
| priority=high OR files=2 | `medium` |
| priority=medium AND files <= 1 | `medium` |
| priority=low OR single file | `small` |

```javascript
function inferEffort(rec) {
  const fileCount = rec.target_files?.length || 0
  if (rec.priority === 'high' && fileCount >= 3) return 'large'
  if (rec.priority === 'high' || fileCount >= 2) return 'medium'
  if (rec.priority === 'low' || fileCount <= 1) return 'small'
  return 'medium'
}
```

---

## Convergence Quality Validation

Every task's `convergence` MUST pass quality gates before writing to disk.

### Quality Rules

| Field | Requirement | Validation |
|-------|-------------|------------|
| `criteria[]` | **Testable** — assertions or concrete manual steps | Reject vague patterns; each criterion must reference observable behavior |
| `verification` | **Executable** — shell command or explicit step sequence | Must contain a runnable command or step-by-step verification procedure |
| `definition_of_done` | **Business language** — non-technical stakeholder can judge | Must NOT contain technical commands (jest, tsc, npm, build) |

### Vague Pattern Detection

```javascript
const VAGUE_PATTERNS = /正常|正确|好|可以|没问题|works|fine|good|correct|properly|as expected/i
const TECHNICAL_IN_DOD = /compile|build|lint|npm|npx|jest|tsc|eslint|cargo|pytest|go test/i

function validateConvergenceQuality(tasks) {
  const issues = []
  tasks.forEach(task => {
    // Rule 1: No vague criteria
    task.convergence.criteria.forEach((c, i) => {
      if (VAGUE_PATTERNS.test(c) && c.length < 20) {
        issues.push({
          task: task.id, field: `criteria[${i}]`,
          problem: 'Vague criterion', value: c,
          fix: 'Replace with specific observable condition from evidence'
        })
      }
    })

    // Rule 2: Verification should be executable
    if (task.convergence.verification && task.convergence.verification.length < 5) {
      issues.push({
        task: task.id, field: 'verification',
        problem: 'Too short to be executable', value: task.convergence.verification,
        fix: 'Provide shell command or numbered step sequence'
      })
    }

    // Rule 3: DoD should be business language
    if (TECHNICAL_IN_DOD.test(task.convergence.definition_of_done)) {
      issues.push({
        task: task.id, field: 'definition_of_done',
        problem: 'Contains technical commands', value: task.convergence.definition_of_done,
        fix: 'Rewrite in business language describing user/system outcome'
      })
    }

    // Rule 4: files[].changes should not be empty when files exist
    task.files?.forEach((f, i) => {
      if (f.action === 'modify' && (!f.changes || f.changes.length === 0) && !f.change) {
        issues.push({
          task: task.id, field: `files[${i}].changes`,
          problem: 'No change description for modify action', value: f.path,
          fix: 'Describe what specifically changes in this file'
        })
      }
    })

    // Rule 5: implementation steps should exist
    if (!task.implementation || task.implementation.length === 0) {
      issues.push({
        task: task.id, field: 'implementation',
        problem: 'No implementation steps',
        fix: 'Add at least one step describing how to realize this task'
      })
    }
  })

  // Auto-fix where possible, log remaining issues
  issues.forEach(issue => {
    // Attempt auto-fix based on available evidence
    // If unfixable, log warning — task still generated but flagged
  })
  return issues
}
```

### Good vs Bad Examples

**Criteria**:

| Bad | Good |
|-----|------|
| `"Code works correctly"` | `"refreshToken() returns a new JWT with >0 expiry when called with expired token"` |
| `"No errors"` | `"Error handler at auth.ts:45 returns 401 status with { error: 'token_expired' } body"` |
| `"Performance is good"` | `"API response time < 200ms at p95 for /api/users endpoint under 100 concurrent requests"` |

**Verification**:

| Bad | Good |
|-----|------|
| `"Check it"` | `"jest --testPathPattern=auth.test.ts && npx tsc --noEmit"` |
| `"Run tests"` | `"1. Run npm test -- --grep 'token refresh' 2. Verify no TypeScript errors with npx tsc --noEmit"` |

**Definition of Done**:

| Bad | Good |
|-----|------|
| `"jest passes"` | `"Users remain logged in across token expiration without manual re-login"` |
| `"No TypeScript errors"` | `"Authentication flow handles all user-facing error scenarios with clear error messages"` |

---

## Required Task Fields (analyze-with-file producer)

Per `task-schema.json` `_field_usage_by_producer`, the `analyze-with-file` producer MUST populate:

| Block | Fields | Required |
|-------|--------|----------|
| IDENTITY | `id`, `title`, `description` | Yes |
| CLASSIFICATION | `type`, `priority`, `effort` | Yes |
| DEPENDENCIES | `depends_on` | Yes (empty array if none) |
| CONVERGENCE | `convergence.criteria[]`, `convergence.verification`, `convergence.definition_of_done` | Yes |
| FILES | `files[].path`, `files[].action`, `files[].changes`/`files[].change` | Yes (if files identified) |
| IMPLEMENTATION | `implementation[]` with step + description | Yes |
| CONTEXT | `evidence`, `source.tool`, `source.session_id`, `source.original_id` | Yes |

### Task JSON Example

```json
{
  "id": "TASK-001",
  "title": "Fix authentication token refresh",
  "description": "Token refresh fails silently when JWT expires, causing users to be logged out unexpectedly",
  "type": "fix",
  "priority": "high",
  "effort": "medium",
  "files": [
    {
      "path": "src/auth/token.ts",
      "action": "modify",
      "target": "refreshToken",
      "changes": [
        "Add await to refreshToken() call at line 89",
        "Add error propagation for refresh failure"
      ],
      "change": "Add await to refreshToken() call and propagate errors"
    },
    {
      "path": "src/middleware/auth.ts",
      "action": "modify",
      "target": "authMiddleware",
      "changes": [
        "Update error handler at line 45 to distinguish refresh failures from auth failures"
      ],
      "change": "Update error handler to propagate refresh failures"
    }
  ],
  "depends_on": [],
  "convergence": {
    "criteria": [
      "refreshToken() returns new valid JWT when called with expired token",
      "Expired token triggers automatic refresh without user action",
      "Failed refresh returns 401 with { error: 'token_expired' } body"
    ],
    "verification": "jest --testPathPattern=token.test.ts && npx tsc --noEmit",
    "definition_of_done": "Users remain logged in across token expiration without manual re-login"
  },
  "implementation": [
    {
      "step": "1",
      "description": "Add await to refreshToken() call in token.ts",
      "actions": ["Read token.ts", "Add await keyword at line 89", "Verify async chain"]
    },
    {
      "step": "2",
      "description": "Update error handler in auth middleware",
      "actions": ["Read auth.ts", "Modify error handler at line 45", "Add refresh-specific error type"]
    }
  ],
  "evidence": ["src/auth/token.ts:89", "src/middleware/auth.ts:45"],
  "source": {
    "tool": "analyze-with-file",
    "session_id": "ANL-auth-token-refresh-2025-01-21",
    "original_id": "TASK-001"
  }
}
```

---

## Execution Delegation

After `.task/*.json` generation, execution is handled by `unified-execute-with-file`:

```bash
/codex:unified-execute-with-file PLAN="${sessionFolder}/.task/"
```

The execution engine provides:
- Pre-execution analysis (dependency validation, file conflicts, topological sort)
- Serial task execution with convergence verification
- Progress tracking via `execution.md` + `execution-events.md`
- Auto-commit per task (conventional commit format)
- Failure handling with retry/skip/abort options

**No inline execution logic in analyze-with-file** — single execution engine avoids duplication and ensures consistent behavior across all skill producers.
