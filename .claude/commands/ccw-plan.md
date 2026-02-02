---
name: ccw-plan
description: Planning coordinator - analyze requirements, select planning strategy, execute planning workflow in main process
argument-hint: "[--mode lite|multi-cli|full|plan-verify|replan|cli|issue|rapid-to-issue|brainstorm-with-file|analyze-with-file] [--yes|-y] \"task description\""
allowed-tools: Skill(*), TodoWrite(*), AskUserQuestion(*), Read(*), Grep(*), Glob(*)
---

# CCW-Plan Command - Planning Coordinator

Planning orchestrator: requirement analysis → strategy selection → planning execution.

## Core Concept: Planning Units (规划单元)

**Definition**: Planning commands are grouped into logical units based on verification requirements and collaboration strategies.

**Planning Units**:

| Unit Type | Pattern | Example |
|-----------|---------|---------|
| **Quick Planning** | plan-cmd (no verify) | lite-plan |
| **Verified Planning** | plan-cmd → verify-cmd | plan → plan-verify |
| **Collaborative Planning** | multi-cli-plan (implicit verify) | multi-cli-plan |
| **With-File Planning** | brainstorm-with-file or analyze-with-file | brainstorm + plan options |
| **CLI-Assisted Planning** | ccw cli (analysis) → recommendations | quick analysis + decision |
| **Issue Workflow Planning** | plan → issue workflow (discover/queue/execute) | rapid-to-issue bridge |

**Atomic Rules**:
1. Lite mode: No verification (fast iteration)
2. Plan-verify mode: Mandatory quality gate
3. Multi-cli/Full mode: Optional verification (via --skip-verify flag)
4. With-File modes: Self-contained iteration with built-in post-completion options
5. CLI mode: Quick analysis, user-driven decisions
6. Issue modes: Planning integrated into issue workflow lifecycle

## Execution Model

**Synchronous (Main Process)**: Planning commands execute via Skill, blocking until complete.

```
User Input → Analyze Requirements → Select Strategy → [Confirm] → Execute Planning
                                                                    ↓
                                                          Skill (blocking)
                                                                    ↓
                                                          Update TodoWrite
                                                                    ↓
                                                          Generate Artifacts
```

## 5-Phase Workflow

### Phase 1: Analyze Requirements

**Input** → Extract (goal, scope, constraints) → Assess (complexity, clarity, criticality) → **Analysis**

| Field | Values |
|-------|--------|
| complexity | low \| medium \| high |
| clarity | 0-3 (≥2 = clear) |
| criticality | normal \| high \| critical |
| scope | single-module \| cross-module \| system \| batch-issues |

**Output**: `Type: [task_type] | Goal: [goal] | Complexity: [complexity] | Clarity: [clarity]/3 | Criticality: [criticality]`

---

### Phase 1.5: Requirement Clarification (if clarity < 2)

```
Analysis → Check clarity ≥ 2?
           ↓
       YES → Continue to Phase 2
           ↓
        NO → Ask Questions → Update Analysis
```

**Questions Asked**: Goal (Create/Fix/Optimize/Analyze), Scope (Single file/Module/Cross-module/System), Constraints (Backward compat/Skip tests/Urgent hotfix)

---

### Phase 2: Select Planning Strategy & Build Command Chain

```
Analysis → Detect Mode (keywords) → Build Command Chain → Planning Workflow
```

#### Mode Detection (Priority Order)

```
Input Keywords                                              → Mode
───────────────────────────────────────────────────────────────────────────────
quick|fast|immediate|recommendation|suggest                → cli
issues?|batch|issue workflow|structured workflow|queue     → issue
issue transition|rapid.*issue|plan.*issue|convert.*issue   → rapid-to-issue
brainstorm|ideation|头脑风暴|创意|发散思维|multi-perspective  → brainstorm-with-file
analyze.*document|explore.*concept|collaborative analysis  → analyze-with-file
production|critical|payment|auth                           → plan-verify
adjust|modify|change plan                                  → replan
uncertain|explore                                          → full
complex|multiple module|integrate                          → multi-cli
(default)                                                  → lite
```

#### Command Chain Mapping

| Mode | Command Chain | Verification | Use Case |
|------|---------------|--------------|----------|
| **cli** | ccw cli --mode analysis --rule planning-* | None | Quick planning recommendation |
| **issue** | /issue:discover → /issue:plan → /issue:queue → /issue:execute | Optional | Batch issue planning & execution |
| **rapid-to-issue** | lite-plan → /issue:convert-to-plan → queue → execute | Optional | Quick planning → Issue workflow bridge |
| **brainstorm-with-file** | /workflow:brainstorm-with-file → (plan/issue options) | Self-contained | Multi-perspective ideation |
| **analyze-with-file** | /workflow:analyze-with-file → (plan/issue options) | Self-contained | Collaborative architecture analysis |
| **lite** | lite-plan | None | Fast simple planning |
| **multi-cli** | multi-cli-plan → [plan-verify] | Optional | Multi-model collaborative planning |
| **full** | brainstorm → plan → [plan-verify] | Optional | Comprehensive brainstorm + planning |
| **plan-verify** | plan → **plan-verify** | **Mandatory** | Production/critical features |
| **replan** | replan | None | Plan refinement/adjustment |

**Note**:
- `[ ]` = optional verification
- **bold** = mandatory quality gate
- With-File modes include built-in post-completion options to create plans/issues

**Output**: `Mode: [mode] | Strategy: [strategy] | Commands: [1. /cmd1 2. /cmd2]`

---

### Phase 3: User Confirmation

```
Planning Chain → Show Strategy → Ask User → User Decision:
- ✓ Confirm → Continue to Phase 4
- ⚙ Adjust → Change Mode (back to Phase 2)
- ✗ Cancel → Abort
```

---

### Phase 4: Setup TODO Tracking & Status File

```
Planning Chain → Create Session Dir → Initialize Tracking → Tracking State
```

**Session Structure**:
```
Session ID: CCWP-{goal-slug}-{date}
Session Dir: .workflow/.ccw-plan/{session_id}/

TodoWrite:
  CCWP:{mode}: [1/n] /command1  [in_progress]
  CCWP:{mode}: [2/n] /command2  [pending]
  ...

status.json:
  {
    "session_id": "CCWP-...",
    "mode": "plan-verify",
    "status": "running",
    "command_chain": [...],
    "quality_gate": "pending"  // plan-verify mode only
  }
```

**Output**:
- TODO: `-> CCWP:plan-verify: [1/2] /workflow:plan | ...`
- Status File: `.workflow/.ccw-plan/{session_id}/status.json`

---

### Phase 5: Execute Planning Chain

```
Start Command → Update status (running) → Execute via Skill → Result
```

#### For Plan-Verify Mode (Quality Gate)

```
Quality Gate → PASS → Mark completed → Next command
             ↓ FAIL (plan-verify mode)
             Ask User → Refine: replan + re-verify
                     → Override: continue anyway
                     → Abort: stop planning
```

#### Error Handling Pattern

```
Command Error → Update status (failed) → Ask User:
  - Retry → Re-execute (same index)
  - Skip → Continue next command
  - Abort → Stop execution
```

---

## Planning Pipeline Examples

| Input | Mode | Pipeline | Use Case |
|-------|------|----------|----------|
| "Quick: should we use OAuth2?" | cli | ccw cli --mode analysis → recommendation | Immediate planning advice |
| "Plan user login system" | lite | lite-plan | Fast simple planning |
| "Implement OAuth2 auth" | multi-cli | multi-cli-plan → [plan-verify] | Multi-model collaborative planning |
| "Design notification system" | full | brainstorm → plan → [plan-verify] | Comprehensive brainstorm + planning |
| "Payment processing (prod)" | plan-verify | plan → **plan-verify** | Production critical (mandatory gate) |
| "头脑风暴: 用户通知系统重新设计" | brainstorm-with-file | brainstorm-with-file → (plan/issue options) | Multi-perspective ideation |
| "协作分析: 认证架构设计决策" | analyze-with-file | analyze-with-file → (plan/issue options) | Collaborative analysis |
| "Batch plan: handle 10 pending issues" | issue | /issue:discover → plan → queue → execute | Batch issue planning |
| "Plan and create issues" | rapid-to-issue | lite-plan → convert-to-plan → queue → execute | Quick plan → Issue workflow |
| "Update existing plan" | replan | replan | Plan refinement/adjustment |

**Legend**:
- `[ ]` = optional verification
- **bold** = mandatory quality gate
- **With-File modes** include built-in post-completion options to create plans/issues

---

## State Management

### Dual Tracking System

**1. TodoWrite-Based Tracking** (UI Display):

```
// Plan-verify mode (mandatory quality gate)
CCWP:plan-verify: [1/2] /workflow:plan          [in_progress]
CCWP:plan-verify: [2/2] /workflow:plan-verify   [pending]

// CLI mode (quick recommendations)
CCWP:cli: [1/1] ccw cli --mode analysis         [in_progress]

// Issue mode (batch planning)
CCWP:issue: [1/4] /issue:discover               [in_progress]
CCWP:issue: [2/4] /issue:plan                   [pending]
CCWP:issue: [3/4] /issue:queue                  [pending]
CCWP:issue: [4/4] /issue:execute                [pending]

// Rapid-to-issue mode (planning → issue bridge)
CCWP:rapid-to-issue: [1/4] /workflow:lite-plan  [in_progress]
CCWP:rapid-to-issue: [2/4] /issue:convert-to-plan [pending]
CCWP:rapid-to-issue: [3/4] /issue:queue         [pending]
CCWP:rapid-to-issue: [4/4] /issue:execute       [pending]

// Brainstorm-with-file mode (self-contained)
CCWP:brainstorm-with-file: [1/1] /workflow:brainstorm-with-file [in_progress]

// Analyze-with-file mode (self-contained)
CCWP:analyze-with-file: [1/1] /workflow:analyze-with-file [in_progress]

// Lite mode (fast simple planning)
CCWP:lite: [1/1] /workflow:lite-plan            [in_progress]

// Multi-CLI mode (collaborative planning)
CCWP:multi-cli: [1/1] /workflow:multi-cli-plan  [in_progress]

// Full mode (brainstorm + planning with optional verification)
CCWP:full: [1/2] /workflow:brainstorm           [in_progress]
CCWP:full: [2/2] /workflow:plan                 [pending]
```

**2. Status.json Tracking**: Persistent state for planning monitoring.

**Location**: `.workflow/.ccw-plan/{session_id}/status.json`

**Structure**:
```json
{
  "session_id": "CCWP-oauth-auth-2025-02-02",
  "mode": "plan-verify",
  "status": "running|completed|failed",
  "created_at": "2025-02-02T10:00:00Z",
  "updated_at": "2025-02-02T10:05:00Z",
  "analysis": {
    "goal": "Implement OAuth2 authentication",
    "complexity": "high",
    "clarity_score": 2,
    "criticality": "high"
  },
  "command_chain": [
    { "index": 0, "command": "/workflow:plan", "mandatory": false, "status": "completed" },
    { "index": 1, "command": "/workflow:plan-verify", "mandatory": true, "status": "running" }
  ],
  "current_index": 1,
  "quality_gate": "pending|PASS|FAIL"
}
```

**Status Values**:
- `running`: Planning in progress
- `completed`: Planning finished successfully
- `failed`: Planning aborted or quality gate failed

**Quality Gate Values** (plan-verify mode only):
- `pending`: Verification not started
- `PASS`: Plan meets quality standards
- `FAIL`: Plan needs refinement

**Mode-Specific Fields**:
- **plan-verify**: `quality_gate` field (pending|PASS|FAIL)
- **cli**: No command_chain, stores CLI recommendations and user decision
- **issue**: includes issue discovery results and queue configuration
- **rapid-to-issue**: includes plan output and conversion to issue
- **with-file modes**: stores session artifacts and post-completion options
- **other modes**: basic command_chain tracking

---

## Extended Planning Modes

### CLI-Assisted Planning (cli mode)

```
Quick Input → ccw cli --mode analysis --rule planning-* → Recommendations → User Decision:
- ✓ Accept → Create lite-plan from recommendations
- ↗ Escalate → Switch to multi-cli or full mode
- ✗ Done → Stop (recommendation only)
```

**Use Cases**:
- Quick architecture decision questions
- Planning approach recommendations
- Pattern/library selection advice

**CLI Rules** (auto-selected based on context):
- `planning-plan-architecture-design` - Architecture decisions
- `planning-breakdown-task-steps` - Task decomposition
- `planning-design-component-spec` - Component specifications

---

### With-File Planning Workflows

**With-File workflows** provide documented exploration with multi-CLI collaboration, generating comprehensive session artifacts.

| Mode | Purpose | Key Features | Output Folder |
|------|---------|--------------|---------------|
| **brainstorm-with-file** | Multi-perspective ideation | Gemini/Codex/Claude perspectives, diverge-converge | `.workflow/.brainstorm/` |
| **analyze-with-file** | Collaborative architecture analysis | Multi-round Q&A, CLI exploration, documented discussions | `.workflow/.analysis/` |

**Detection Keywords**:
- **brainstorm-with-file**: 头脑风暴, 创意, 发散思维, multi-perspective, ideation
- **analyze-with-file**: 协作分析, 深度理解, collaborative analysis, explore concept

**Characteristics**:
1. **Self-Contained**: Each workflow handles its own iteration loop
2. **Documented Process**: Creates evolving documents (brainstorm.md, discussion.md)
3. **Multi-CLI**: Uses Gemini/Codex/Claude for different perspectives
4. **Built-in Post-Completion**: Offers follow-up options (create plan, create issue, deep dive)

---

### Issue Workflow Integration

| Mode | Purpose | Command Chain | Typical Use |
|------|---------|---------------|-------------|
| **issue** | Batch issue planning | discover → plan → queue → execute | Multiple issues in codebase |
| **rapid-to-issue** | Quick plan → Issue workflow | lite-plan → convert-to-plan → queue → execute | Fast iteration → structured execution |

**Issue Workflow Bridge**:
```
lite-plan (in-memory) → /issue:convert-to-plan → Creates issue JSON
                                                      ↓
                                        /issue:queue → Form execution queue
                                                      ↓
                                        /issue:execute → DAG-based parallel execution
```

**When to use Issue Workflow**:
- Need structured multi-stage execution (queue-based)
- Want parallel DAG execution
- Multiple related changes as individual commits
- Converting brainstorm/plan output to executable tasks

---

## Key Design Principles

1. **Planning-Focused** - Pure planning coordination, no execution
2. **Mode-Driven** - 10 planning modes for different needs (lite/multi-cli/full/plan-verify/replan + cli/issue/rapid-to-issue/brainstorm-with-file/analyze-with-file)
3. **CLI Integration** - Quick analysis for immediate recommendations
4. **With-File Support** - Multi-CLI collaboration with documented artifacts
5. **Issue Workflow Bridge** - Seamless transition from planning to structured execution
6. **Quality Gates** - Mandatory verification for production features
7. **Flexible Verification** - Optional for exploration, mandatory for critical features
8. **Progressive Clarification** - Low clarity triggers requirement questions
9. **TODO Tracking** - Use CCWP prefix to isolate planning todos
10. **Handoff Ready** - Generates artifacts ready for execution phase

---

## Usage

```bash
# Auto-select mode (keyword-based detection)
/ccw-plan "Add user authentication"

# Standard planning modes
/ccw-plan --mode lite "Add logout endpoint"
/ccw-plan --mode multi-cli "Implement OAuth2"
/ccw-plan --mode full "Design notification system"
/ccw-plan --mode plan-verify "Payment processing (production)"
/ccw-plan --mode replan --session WFS-auth-2025-01-28

# CLI-assisted planning (quick recommendations)
/ccw-plan --mode cli "Quick: should we use OAuth2 or JWT?"
/ccw-plan --mode cli "Which state management pattern for React app?"

# With-File workflows (multi-CLI collaboration)
/ccw-plan --mode brainstorm-with-file "头脑风暴: 用户通知系统重新设计"
/ccw-plan --mode analyze-with-file "协作分析: 认证架构的设计决策"

# Issue workflow integration
/ccw-plan --mode issue "Batch plan: handle all pending security issues"
/ccw-plan --mode rapid-to-issue "Plan user profile feature and create issue"

# Auto mode (skip confirmations)
/ccw-plan --yes "Quick feature: user profile endpoint"
```

---

## Mode Selection Decision Tree

```
User calls: /ccw-plan "task description"

├─ Keywords: "quick", "fast", "recommendation"
│  └─ Mode: CLI (quick analysis → recommendations)
│
├─ Keywords: "issue", "batch", "queue"
│  └─ Mode: Issue (batch planning → execution queue)
│
├─ Keywords: "plan.*issue", "rapid.*issue"
│  └─ Mode: Rapid-to-Issue (lite-plan → issue bridge)
│
├─ Keywords: "头脑风暴", "brainstorm", "ideation"
│  └─ Mode: Brainstorm-with-file (multi-CLI ideation)
│
├─ Keywords: "协作分析", "analyze.*document"
│  └─ Mode: Analyze-with-file (collaborative analysis)
│
├─ Keywords: "production", "critical", "payment"
│  └─ Mode: Plan-Verify (mandatory quality gate)
│
├─ Keywords: "adjust", "modify", "change plan"
│  └─ Mode: Replan (refine existing plan)
│
├─ Keywords: "uncertain", "explore"
│  └─ Mode: Full (brainstorm → plan → [verify])
│
├─ Keywords: "complex", "multiple module"
│  └─ Mode: Multi-CLI (collaborative planning)
│
└─ Default → Lite (fast simple planning)
```
