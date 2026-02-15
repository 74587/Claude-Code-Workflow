---
name: ccw-debug
description: Debug coordinator - analyze issue, select debug strategy, execute debug workflow in main process
argument-hint: "[--mode cli|debug|test|bidirectional] [--yes|-y] \"bug description\""
allowed-tools: Skill(*), TodoWrite(*), AskUserQuestion(*), Read(*), Bash(*)
---

# CCW-Debug Command - Debug Coordinator

Debug orchestrator: issue analysis → strategy selection → debug execution.

## Skill 映射

| Skill | 包含操作 |
|-------|---------|
| `workflow-test-fix` | test-fix-gen, test-cycle-execute |

独立命令：workflow:debug-with-file

## Core Concept: Debug Units (调试单元)

**Definition**: Debug commands grouped into logical units for different root cause strategies.

**Debug Units**:

| Unit Type | Pattern | Example |
|-----------|---------|---------|
| **Quick Diagnosis** | CLI analysis only | cli → recommendation |
| **Hypothesis-Driven** | Debug exploration | debug-with-file → apply fix |
| **Test-Driven** | Test generation/iteration | test-fix-gen → test-cycle-execute |
| **Convergence** | Parallel debug + test | debug + test (parallel) |

**Atomic Rules**:
1. CLI mode: Analysis only, recommendation for user action
2. Debug/Test modes: Full cycle (analysis → fix → validate)
3. Bidirectional mode: Parallel execution, merge findings

## Execution Model

**Synchronous (Main Process)**: Debug commands execute via Skill, blocking until complete.

```
User Input → Analyze Issue → Select Strategy → [Confirm] → Execute Debug
                                                              ↓
                                                    Skill (blocking)
                                                              ↓
                                                    Update TodoWrite
                                                              ↓
                                                    Generate Fix/Report
```

## 5-Phase Workflow

### Phase 1: Analyze Issue

**Input** → Extract (description, symptoms) → Assess (error_type, clarity, complexity, scope) → **Analysis**

| Field | Values |
|-------|--------|
| error_type | syntax \| logic \| async \| integration \| unknown |
| clarity | 0-3 (≥2 = clear) |
| complexity | low \| medium \| high |
| scope | single-module \| cross-module \| system |

#### Mode Detection (Priority Order)

```
Input Keywords                              → Mode
─────────────────────────────────────────────────────────
quick|fast|immediate|recommendation|suggest → cli
test|fail|coverage|pass                     → test
multiple|system|distributed|concurrent      → bidirectional
(default)                                   → debug
```

**Output**: `IssueType: [type] | Clarity: [clarity]/3 | Complexity: [complexity] | RecommendedMode: [mode]`

---

### Phase 1.5: Issue Clarification (if clarity < 2)

```
Analysis → Check clarity ≥ 2?
           ↓
       YES → Continue to Phase 2
           ↓
        NO → Ask Questions → Update Analysis
```

**Questions Asked**: Error Symptoms, When It Occurs, Affected Components, Reproducibility

---

### Phase 2: Select Debug Strategy & Build Command Chain

```
Analysis → Detect Mode (keywords) → Build Command Chain → Debug Workflow
```

#### Command Chain Mapping

| Mode | Command Chain | Execution |
|------|---------------|-----------|
| **cli** | ccw cli --mode analysis --rule analysis-diagnose-bug-root-cause | Analysis only |
| **debug** | debug-with-file → test-fix-gen → test-cycle-execute | Sequential |
| **test** | test-fix-gen → test-cycle-execute | Sequential |
| **bidirectional** | (debug-with-file ∥ test-fix-gen ∥ test-cycle-execute) → merge-findings | Parallel → Merge |

**Note**: `∥` = parallel execution

**Output**: `Mode: [mode] | Strategy: [strategy] | Commands: [1. /cmd1 2. /cmd2]`

---

### Phase 3: User Confirmation

```
Debug Chain → Show Strategy → Ask User → User Decision:
- ✓ Confirm → Continue to Phase 4
- ⚙ Change Mode → Select Different Mode (back to Phase 2)
- ✗ Cancel → Abort
```

---

### Phase 4: Setup TODO Tracking & Status File

```
Debug Chain → Create Session Dir → Initialize Tracking → Tracking State
```

**Session Structure**:
```
Session ID: CCWD-{issue-slug}-{date}
Session Dir: .workflow/.ccw-debug/{session_id}/

TodoWrite:
  CCWD:{mode}: [1/n] /command1  [in_progress]
  CCWD:{mode}: [2/n] /command2  [pending]
  ...

status.json:
  {
    "session_id": "CCWD-...",
    "mode": "debug|cli|test|bidirectional",
    "status": "running",
    "parallel_execution": false|true,
    "issue": { description, error_type, clarity, complexity },
    "command_chain": [...],
    "findings": { debug, test, merged }
  }
```

**Output**:
- TODO: `-> CCWD:debug: [1/3] /workflow:debug-with-file | ...`
- Status File: `.workflow/.ccw-debug/{session_id}/status.json`

---

### Phase 5: Execute Debug Chain

#### For Bidirectional Mode (Parallel Execution)

```
Start Commands (parallel) → Execute debug-with-file ∥ test-fix-gen ∥ test-cycle-execute
                                             ↓
                         Collect Results → Merge Findings
                                             ↓
                         Update status.json (findings.merged)
                                             ↓
                         Mark completed
```

#### For Sequential Modes (cli, debug, test)

```
Start Command → Update status (running) → Execute via Skill → Result
                                                   ↓
                         CLI Mode? → YES → Ask Escalation → Escalate or Done
                                   → NO → Continue
                                                   ↓
                         Update status (completed) → Next Command
                                                   ↓
                         Error? → YES → Ask Action (Retry/Skip/Abort)
                               → NO → Continue
```

#### Error Handling Pattern

```
Command Error → Update status (failed) → Ask User:
  - Retry → Re-execute (same index)
  - Skip → Continue next command
  - Abort → Stop execution
```

#### CLI Mode Escalation

```
CLI Result → Findings.confidence?
              ↓
           High → Present findings → User decides:
                  • Done (end here)
                  • Escalate to debug mode
                  • Escalate to test mode
                  ↓
           Low → Recommend escalation
```

---

## Execution Flow Summary

```
User Input
    |
Phase 1: Analyze Issue
    |-- Extract: description, error_type, clarity, complexity, scope
    +-- If clarity < 2 -> Phase 1.5: Clarify Issue
    |
Phase 2: Select Debug Strategy & Build Chain
    |-- Detect mode: cli | debug | test | bidirectional
    |-- Build command chain based on mode
    |-- Parallel execution for bidirectional
    +-- Consider escalation points (cli → debug/test)
    |
Phase 3: User Confirmation (optional)
    |-- Show debug strategy
    +-- Allow mode change
    |
Phase 4: Setup TODO Tracking & Status File
    |-- Create todos with CCWD prefix
    +-- Initialize .workflow/.ccw-debug/{session_id}/status.json
    |
Phase 5: Execute Debug Chain
    |-- For sequential modes: execute commands in order
    |-- For bidirectional: execute debug + test in parallel
    |-- CLI mode: present findings, ask for escalation
    |-- Merge findings (bidirectional mode)
    +-- Update status and TODO
```

---

## Debug Pipeline Examples

| Issue | Mode | Pipeline |
|-------|------|----------|
| "Login timeout error (quick)" | cli | ccw cli → analysis → (escalate or done) |
| "User login fails intermittently" | debug | debug-with-file → test-gen → test-cycle |
| "Authentication tests failing" | test | test-fix-gen → test-cycle-execute |
| "Multi-module auth + db sync issue" | bidirectional | (debug ∥ test) → merge findings |

**Legend**: `∥` = parallel execution

---

## State Management

### Dual Tracking System

**1. TodoWrite-Based Tracking** (UI Display):

```
// Initial state (debug mode)
CCWD:debug: [1/3] /workflow:debug-with-file  [in_progress]
CCWD:debug: [2/3] /workflow:test-fix-gen     [pending]
CCWD:debug: [3/3] /workflow:test-cycle-execute [pending]

// CLI mode: only 1 command
CCWD:cli: [1/1] ccw cli --mode analysis      [in_progress]

// Bidirectional mode
CCWD:bidirectional: [1/3] /workflow:debug-with-file [in_progress] ∥
CCWD:bidirectional: [2/3] /workflow:test-fix-gen    [in_progress] ∥
CCWD:bidirectional: [3/3] /workflow:test-cycle-execute [in_progress]
CCWD:bidirectional: [4/4] merge-findings           [pending]
```

**2. Status.json Tracking**: Persistent state for debug monitoring.

**Location**: `.workflow/.ccw-debug/{session_id}/status.json`

**Structure**:
```json
{
  "session_id": "CCWD-auth-timeout-2025-02-02",
  "mode": "debug",
  "status": "running|completed|failed",
  "parallel_execution": false,
  "created_at": "2025-02-02T10:00:00Z",
  "updated_at": "2025-02-02T10:05:00Z",
  "issue": {
    "description": "User login timeout after 30 seconds",
    "error_type": "async",
    "clarity": 3,
    "complexity": "medium"
  },
  "command_chain": [
    { "index": 0, "command": "/workflow:debug-with-file", "unit": "sequential", "status": "completed" },
    { "index": 1, "command": "/workflow:test-fix-gen", "unit": "sequential", "status": "in_progress" },
    { "index": 2, "command": "/workflow:test-cycle-execute", "unit": "sequential", "status": "pending" }
  ],
  "current_index": 1,
  "findings": {
    "debug": { "root_cause": "...", "confidence": "high" },
    "test": { "failure_pattern": "..." },
    "merged": null
  }
}
```

**Status Values**:
- `running`: Debug workflow in progress
- `completed`: Debug finished, fix applied
- `failed`: Debug aborted or unfixable

**Mode-Specific Fields**:
- `cli` mode: No findings field (recommendation-only)
- `debug`/`test`: Single finding source
- `bidirectional`: All three findings + merged result

---

## Key Design Principles

1. **Issue-Focused** - Diagnose root cause, not symptoms
2. **Mode-Driven** - 4 debug strategies for different issues
3. **Parallel Capability** - Bidirectional mode for complex systems
4. **Escalation Support** - CLI → debug/test mode progression
5. **Quick Diagnosis** - CLI mode for immediate recommendations
6. **TODO Tracking** - Use CCWD prefix to isolate debug todos
7. **Finding Convergence** - Merge parallel results for consensus
---

## Usage

```bash
# Auto-select mode
/ccw-debug "Login failed: token validation error"

# Explicit mode selection
/ccw-debug --mode cli "Quick diagnosis: API 500 error"
/ccw-debug --mode debug "User profile sync intermittent failure"
/ccw-debug --mode test "Permission check failing"
/ccw-debug --mode bidirectional "Multi-module auth + cache sync issue"

# Auto mode (skip confirmations)
/ccw-debug --yes "Production hotfix: database connection timeout"

# Resume or escalate from previous session
/ccw-debug --mode debug --source-session CCWD-login-timeout-2025-01-27
```

---

## Mode Selection Decision Tree

```
User calls: /ccw-debug "issue description"

├─ Keywords: "quick", "fast", "recommendation"
│  └─ Mode: CLI (2-5 min analysis, optional escalation)
│
├─ Keywords: "test", "fail", "coverage"
│  └─ Mode: Test (automated iteration, ≥95% pass)
│
├─ Keywords: "multiple", "system", "distributed"
│  └─ Mode: Bidirectional (parallel debug + test)
│
└─ Default → Debug (full hypothesis-driven workflow)
```
