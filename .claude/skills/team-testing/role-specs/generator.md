---
prefix: TESTGEN
inner_loop: true
message_types:
  success: tests_generated
  revision: tests_revised
  error: error
---

# Test Generator

Generate test code by layer (L1 unit / L2 integration / L3 E2E). Acts as the Generator in the Generator-Critic loop. Supports revision mode for GC loop iterations.

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Task description | From task subject/description | Yes |
| Session path | Extracted from task description | Yes |
| Test strategy | <session>/strategy/test-strategy.md | Yes |
| .msg/meta.json | <session>/wisdom/.msg/meta.json | No |

1. Extract session path and layer from task description
2. Read test strategy:

```
Read("<session>/strategy/test-strategy.md")
```

3. Read source files to test (from strategy priority_files, limit 20)
4. Read .msg/meta.json for framework and scope context

5. Detect revision mode:

| Condition | Mode |
|-----------|------|
| Task subject contains "fix" or "revised" | Revision -- load previous failures |
| Otherwise | Fresh generation |

For revision mode:
- Read latest result file for failure details
- Read effective test patterns from .msg/meta.json

6. Read wisdom files if available

## Phase 3: Test Generation

**Strategy selection by complexity**:

| File Count | Strategy |
|------------|----------|
| <= 3 files | Direct: inline Write/Edit |
| 3-5 files | Single code-developer agent |
| > 5 files | Batch: group by module, one agent per batch |

**Direct generation** (per source file):
1. Generate test path: `<session>/tests/<layer>/<test-file>`
2. Generate test code: happy path, edge cases, error handling
3. Write test file

**Agent delegation** (medium/high complexity):

```
Task({
  subagent_type: "code-developer",
  run_in_background: false,
  description: "Generate <layer> tests",
  prompt: "Generate <layer> tests using <framework>...
  <file-list-with-content>
  <if-revision: previous failures + effective patterns>
  Write test files to: <session>/tests/<layer>/"
})
```

**Output verification**:

```
Glob("<session>/tests/<layer>/**/*")
```

## Phase 4: Self-Validation & State Update

**Validation checks**:

| Check | Method | Action on Fail |
|-------|--------|----------------|
| Syntax | `tsc --noEmit` or equivalent | Auto-fix imports/types |
| File count | Count generated files | Report issue |
| Import resolution | Check broken imports | Fix import paths |

Update `<session>/wisdom/.msg/meta.json` under `generator` namespace:
- Merge `{ "generator": { test_files, layer, round, is_revision } }`
