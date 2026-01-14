# State Schema

Defines the state structure for skill-tuning orchestrator.

## State Structure

```typescript
interface TuningState {
  // === Core Status ===
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string;           // ISO timestamp
  updated_at: string;           // ISO timestamp

  // === Target Skill Info ===
  target_skill: {
    name: string;               // e.g., "software-manual"
    path: string;               // e.g., ".claude/skills/software-manual"
    execution_mode: 'sequential' | 'autonomous';
    phases: string[];           // List of phase files
    specs: string[];            // List of spec files
  };

  // === User Input ===
  user_issue_description: string;  // User's problem description
  focus_areas: string[];           // User-specified focus (optional)

  // === Diagnosis Results ===
  diagnosis: {
    context: DiagnosisResult | null;
    memory: DiagnosisResult | null;
    dataflow: DiagnosisResult | null;
    agent: DiagnosisResult | null;
  };

  // === Issues Found ===
  issues: Issue[];
  issues_by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };

  // === Fix Management ===
  proposed_fixes: Fix[];
  applied_fixes: AppliedFix[];
  pending_fixes: string[];      // Fix IDs pending application

  // === Iteration Control ===
  iteration_count: number;
  max_iterations: number;       // Default: 5

  // === Quality Metrics ===
  quality_score: number;        // 0-100
  quality_gate: 'pass' | 'review' | 'fail';

  // === Orchestrator State ===
  completed_actions: string[];
  current_action: string | null;
  action_history: ActionHistoryEntry[];

  // === Error Handling ===
  errors: ErrorEntry[];
  error_count: number;
  max_errors: number;           // Default: 3

  // === Output Paths ===
  work_dir: string;
  backup_dir: string;
}

interface DiagnosisResult {
  status: 'completed' | 'skipped' | 'failed';
  issues_found: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'none';
  execution_time_ms: number;
  details: {
    patterns_checked: string[];
    patterns_matched: string[];
    evidence: Evidence[];
    recommendations: string[];
  };
}

interface Evidence {
  file: string;
  line?: number;
  pattern: string;
  context: string;
  severity: string;
}

interface Issue {
  id: string;                   // e.g., "ISS-001"
  type: 'context_explosion' | 'memory_loss' | 'dataflow_break' | 'agent_failure';
  severity: 'critical' | 'high' | 'medium' | 'low';
  priority: number;             // 1 = highest
  location: {
    file: string;
    line_start?: number;
    line_end?: number;
    phase?: string;
  };
  description: string;
  evidence: string[];
  root_cause: string;
  impact: string;
  suggested_fix: string;
  related_issues: string[];     // Issue IDs
}

interface Fix {
  id: string;                   // e.g., "FIX-001"
  issue_ids: string[];          // Issues this fix addresses
  strategy: FixStrategy;
  description: string;
  rationale: string;
  changes: FileChange[];
  risk: 'low' | 'medium' | 'high';
  estimated_impact: string;
  verification_steps: string[];
}

type FixStrategy =
  | 'context_summarization'     // Add context compression
  | 'sliding_window'            // Implement sliding context window
  | 'structured_state'          // Convert to structured state passing
  | 'constraint_injection'      // Add constraint propagation
  | 'checkpoint_restore'        // Add checkpointing mechanism
  | 'schema_enforcement'        // Add data contract validation
  | 'orchestrator_refactor'     // Refactor agent coordination
  | 'state_centralization'      // Centralize state management
  | 'custom';                   // Custom fix

interface FileChange {
  file: string;
  action: 'create' | 'modify' | 'delete';
  old_content?: string;
  new_content?: string;
  diff?: string;
}

interface AppliedFix {
  fix_id: string;
  applied_at: string;
  success: boolean;
  backup_path: string;
  verification_result: 'pass' | 'fail' | 'pending';
  rollback_available: boolean;
}

interface ActionHistoryEntry {
  action: string;
  started_at: string;
  completed_at: string;
  result: 'success' | 'failure' | 'skipped';
  output_files: string[];
}

interface ErrorEntry {
  action: string;
  message: string;
  timestamp: string;
  recoverable: boolean;
}
```

## Initial State Template

```json
{
  "status": "pending",
  "started_at": null,
  "updated_at": null,
  "target_skill": {
    "name": null,
    "path": null,
    "execution_mode": null,
    "phases": [],
    "specs": []
  },
  "user_issue_description": "",
  "focus_areas": [],
  "diagnosis": {
    "context": null,
    "memory": null,
    "dataflow": null,
    "agent": null
  },
  "issues": [],
  "issues_by_severity": {
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0
  },
  "proposed_fixes": [],
  "applied_fixes": [],
  "pending_fixes": [],
  "iteration_count": 0,
  "max_iterations": 5,
  "quality_score": 0,
  "quality_gate": "fail",
  "completed_actions": [],
  "current_action": null,
  "action_history": [],
  "errors": [],
  "error_count": 0,
  "max_errors": 3,
  "work_dir": null,
  "backup_dir": null
}
```

## State Transition Diagram

```
                         ┌─────────────┐
                         │   pending   │
                         └──────┬──────┘
                                │ action-init
                                ↓
                         ┌─────────────┐
              ┌──────────│   running   │──────────┐
              │          └──────┬──────┘          │
              │                 │                 │
    diagnosis │    ┌────────────┼────────────┐    │ error_count >= 3
    actions   │    │            │            │    │
              │    ↓            ↓            ↓    │
              │ context     memory      dataflow  │
              │    │            │            │    │
              │    └────────────┼────────────┘    │
              │                 │                 │
              │                 ↓                 │
              │          action-verify            │
              │                 │                 │
              │     ┌───────────┼───────────┐     │
              │     │           │           │     │
              │     ↓           ↓           ↓     │
              │  quality    iterate      apply    │
              │  gate=pass  (< max)       fix     │
              │     │           │           │     │
              │     │           └───────────┘     │
              │     ↓                             ↓
              │ ┌─────────────┐           ┌─────────────┐
              └→│  completed  │           │   failed    │
                └─────────────┘           └─────────────┘
```

## State Update Rules

### Atomicity
All state updates must be atomic - read current state, apply changes, write entire state.

### Immutability
Never mutate state in place. Always create new state object with changes.

### Validation
Before writing state, validate against schema to prevent corruption.

### Timestamps
Always update `updated_at` on every state change.

```javascript
function updateState(workDir, updates) {
  const currentState = JSON.parse(Read(`${workDir}/state.json`));

  const newState = {
    ...currentState,
    ...updates,
    updated_at: new Date().toISOString()
  };

  // Validate before write
  if (!validateState(newState)) {
    throw new Error('Invalid state update');
  }

  Write(`${workDir}/state.json`, JSON.stringify(newState, null, 2));
  return newState;
}
```
