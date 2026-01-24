---
name: ccw
description: Main workflow orchestrator - analyze intent, select workflow, execute command chain in main process
argument-hint: "\"task description\""
allowed-tools: SlashCommand(*), TodoWrite(*), AskUserQuestion(*), Read(*), Grep(*), Glob(*)
---

# CCW Command - Main Workflow Orchestrator

Main process workflow orchestrator: intent analysis → workflow selection → command chain execution.

**Execution Model**: Execute command chain directly in main process using SlashCommand.

## 5-Phase Workflow

### Phase 1: Analyze Intent

Analyze user input to extract task intent and characteristics.

```javascript
function analyzeIntent(input) {
  return {
    goal: extractGoal(input),                    // Main objective
    scope: extractScope(input),                  // Affected scope
    constraints: extractConstraints(input),      // Constraints
    task_type: detectTaskType(input),            // Task type
    complexity: assessComplexity(input),         // Complexity level
    clarity_score: calculateClarity(input)       // Requirement clarity (0-3)
  };
}

// Task type detection (priority order)
function detectTaskType(text) {
  if (/urgent|production|critical/.test(text) && /fix|bug/.test(text)) return 'bugfix-hotfix';
  if (/fix|bug|error|crash|fail|debug/.test(text)) return 'bugfix';
  if (/issues?|batch/.test(text) && /fix|resolve/.test(text)) return 'issue-batch';
  if (/uncertain|explore|research|what if/.test(text)) return 'exploration';
  if (/multi-perspective|compare|cross-verify/.test(text)) return 'multi-perspective';
  if (/quick|simple|small/.test(text) && /feature|function/.test(text)) return 'quick-task';
  if (/ui|design|component|style/.test(text)) return 'ui-design';
  if (/tdd|test-driven|test first/.test(text)) return 'tdd';
  if (/test fail|fix test|failing test/.test(text)) return 'test-fix';
  if (/review|code review/.test(text)) return 'review';
  if (/docs|documentation|readme/.test(text)) return 'documentation';
  return 'feature';
}

// Complexity assessment
function assessComplexity(text) {
  let score = 0;
  if (/refactor|migrate|architect|system/.test(text)) score += 2;
  if (/multiple|across|all|entire/.test(text)) score += 2;
  if (/integrate|api|database/.test(text)) score += 1;
  if (/security|performance|scale/.test(text)) score += 1;
  return score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
}

// Requirement clarity calculation
function calculateClarity(text) {
  let score = 0;
  if (/create|fix|refactor|optimize|analyze/.test(text)) score += 0.5;  // Has action
  if (/\.(ts|js|py|java|go|md)/.test(text)) score += 0.5;               // Has file path
  if (/for|because|to achieve/.test(text)) score += 0.5;                // Has goal
  if (/must|should|no|without/.test(text)) score += 0.5;                // Has constraints
  if (/uncertain|maybe|how to/.test(text)) score -= 0.5;                // Has uncertainty
  return Math.max(0, Math.min(3, score));
}
```

**Display to user**:
```
Intent Analysis:
  Type: [task_type]
  Goal: [goal]
  Complexity: [complexity]
  Clarity: [clarity_score]/3
```

---

### Phase 1.5: Requirement Clarification (if needed)

When clarity_score < 2, clarify requirements through questions.

```javascript
async function clarifyRequirements(analysis) {
  if (analysis.clarity_score >= 2) return analysis;

  const questions = generateClarificationQuestions(analysis);
  const answers = await AskUserQuestion({ questions });

  // Update analysis based on user answers
  return updateAnalysis(analysis, answers);
}

function generateClarificationQuestions(analysis) {
  const questions = [];

  if (!analysis.goal) {
    questions.push({
      question: "What is the main goal of this task?",
      header: "Goal",
      options: [
        { label: "Create new feature", description: "Implement new functionality" },
        { label: "Fix issue", description: "Fix bugs or errors" },
        { label: "Optimize/Improve", description: "Refactor or performance optimization" },
        { label: "Analyze/Research", description: "Explore or analyze code" }
      ],
      multiSelect: false
    });
  }

  if (!analysis.scope || analysis.scope.length === 0) {
    questions.push({
      question: "What is the scope of this task?",
      header: "Scope",
      options: [
        { label: "Single file", description: "Modify single file" },
        { label: "Single module", description: "One functional module" },
        { label: "Multiple modules", description: "Cross-module changes" },
        { label: "Entire system", description: "System-level changes" }
      ],
      multiSelect: false
    });
  }

  if (!analysis.constraints || analysis.constraints.length === 0) {
    questions.push({
      question: "Any special requirements or constraints?",
      header: "Constraints",
      options: [
        { label: "No constraints", description: "No special requirements" },
        { label: "Backward compatible", description: "Maintain compatibility" },
        { label: "Skip tests", description: "No test execution needed" },
        { label: "Urgent hotfix", description: "Production issue" }
      ],
      multiSelect: true
    });
  }

  return questions;
}
```

---

### Phase 2: Select Workflow & Build Command Chain

Select workflow level and build command chain based on intent analysis.

```javascript
function selectWorkflow(analysis) {
  const { task_type, complexity, constraints } = analysis;

  // Level mapping
  const levelMap = {
    'bugfix-hotfix':     { level: 2, flow: 'bugfix.hotfix' },
    'bugfix':            { level: 2, flow: 'bugfix.standard' },
    'issue-batch':       { level: 'Issue', flow: 'issue' },
    'exploration':       { level: 4, flow: 'full' },
    'multi-perspective': { level: 2, flow: 'multi-cli-plan' },
    'quick-task':        { level: 1, flow: 'lite-lite-lite' },
    'ui-design':         { level: complexity === 'high' ? 4 : 3, flow: 'ui' },
    'tdd':               { level: 3, flow: 'tdd' },
    'test-fix':          { level: 3, flow: 'test-fix-gen' },
    'review':            { level: 3, flow: 'review-fix' },
    'documentation':     { level: 2, flow: 'docs' },
    'feature':           { level: complexity === 'high' ? 3 : 2, flow: complexity === 'high' ? 'coupled' : 'rapid' }
  };

  const selected = levelMap[task_type] || levelMap['feature'];
  
  return buildCommandChain(selected, analysis);
}

// Build command chain (port-based matching)
function buildCommandChain(workflow, analysis) {
  const chains = {
    // Level 1 - Rapid
    'lite-lite-lite': [
      { cmd: '/workflow:lite-lite-lite', args: `"${analysis.goal}"` }
    ],

    // Level 2 - Lightweight
    'rapid': [
      { cmd: '/workflow:lite-plan', args: `"${analysis.goal}"` },
      { cmd: '/workflow:lite-execute', args: '--in-memory' },
      ...(analysis.constraints?.includes('skip-tests') ? [] : [
        { cmd: '/workflow:test-cycle-execute', args: '' }
      ])
    ],

    'bugfix.standard': [
      { cmd: '/workflow:lite-fix', args: `"${analysis.goal}"` },
      ...(analysis.constraints?.includes('skip-tests') ? [] : [
        { cmd: '/workflow:test-cycle-execute', args: '' }
      ])
    ],

    'bugfix.hotfix': [
      { cmd: '/workflow:lite-fix', args: `--hotfix "${analysis.goal}"` }
    ],

    'multi-cli-plan': [
      { cmd: '/workflow:multi-cli-plan', args: `"${analysis.goal}"` },
      { cmd: '/workflow:lite-execute', args: '--in-memory' },
      ...(analysis.constraints?.includes('skip-tests') ? [] : [
        { cmd: '/workflow:test-cycle-execute', args: '' }
      ])
    ],

    'docs': [
      { cmd: '/workflow:lite-plan', args: `"${analysis.goal}"` },
      { cmd: '/workflow:lite-execute', args: '--in-memory' }
    ],

    // Level 3 - Standard
    'coupled': [
      { cmd: '/workflow:plan', args: `"${analysis.goal}"` },
      { cmd: '/workflow:plan-verify', args: '' },
      { cmd: '/workflow:execute', args: '' },
      { cmd: '/workflow:review-session-cycle', args: '' },
      ...(analysis.constraints?.includes('skip-tests') ? [] : [
        { cmd: '/workflow:test-cycle-execute', args: '' }
      ])
    ],

    'tdd': [
      { cmd: '/workflow:tdd-plan', args: `"${analysis.goal}"` },
      { cmd: '/workflow:execute', args: '' },
      { cmd: '/workflow:tdd-verify', args: '' }
    ],

    'test-fix-gen': [
      { cmd: '/workflow:test-fix-gen', args: `"${analysis.goal}"` },
      { cmd: '/workflow:test-cycle-execute', args: '' }
    ],

    'review-fix': [
      { cmd: '/workflow:review', args: '' },
      { cmd: '/workflow:review-fix', args: '' },
      { cmd: '/workflow:test-cycle-execute', args: '' }
    ],

    'ui': [
      { cmd: '/workflow:ui-design:explore-auto', args: `"${analysis.goal}"` },
      { cmd: '/workflow:plan', args: '' },
      { cmd: '/workflow:execute', args: '' }
    ],

    // Level 4 - Brainstorm
    'full': [
      { cmd: '/workflow:brainstorm:auto-parallel', args: `"${analysis.goal}"` },
      { cmd: '/workflow:plan', args: '' },
      { cmd: '/workflow:plan-verify', args: '' },
      { cmd: '/workflow:execute', args: '' },
      { cmd: '/workflow:test-cycle-execute', args: '' }
    ],

    // Issue Workflow
    'issue': [
      { cmd: '/issue:discover', args: '' },
      { cmd: '/issue:plan', args: '--all-pending' },
      { cmd: '/issue:queue', args: '' },
      { cmd: '/issue:execute', args: '' }
    ]
  };

  return chains[workflow.flow] || chains['rapid'];
}
```

**Display to user**:
```
Selected Workflow: Level [X] - [flow_name]

Pipeline:
requirement -> lite-plan -> plan -> lite-execute -> code -> test-cycle-execute -> test-passed

Commands:
1. /workflow:lite-plan
2. /workflow:lite-execute
3. /workflow:test-cycle-execute

Proceed? [Confirm / Adjust / Cancel]
```

---

### Phase 3: User Confirmation (Optional)

Get user confirmation or adjust command chain.

```javascript
async function getUserConfirmation(chain, analysis) {
  const response = await AskUserQuestion({
    questions: [{
      question: "Execute this command chain?",
      header: "Confirm",
      options: [
        { label: "Confirm", description: "Start execution" },
        { label: "Adjust", description: "Modify commands" },
        { label: "Cancel", description: "Abort" }
      ],
      multiSelect: false
    }]
  });

  if (response.Confirm === "Cancel") {
    throw new Error("User cancelled");
  }

  if (response.Confirm === "Adjust") {
    return await adjustChain(chain);
  }

  return chain;
}

async function adjustChain(chain) {
  // Show current chain, allow user to remove or reorder
  const adjustOptions = chain.map((step, i) => ({
    label: `${i + 1}. ${step.cmd}`,
    description: step.args || "No arguments"
  }));

  const response = await AskUserQuestion({
    questions: [{
      question: "Select commands to keep (multi-select)",
      header: "Adjust",
      options: adjustOptions,
      multiSelect: true
    }]
  });

  // Rebuild chain based on user selection
  return rebuildChain(chain, response);
}
```

---

### Phase 4: Setup TODO Tracking

Initialize TodoWrite to track command execution progress.

```javascript
function setupTodoTracking(chain, workflow) {
  const todos = chain.map((step, i) => ({
    content: `CCW:${workflow}: [${i + 1}/${chain.length}] ${step.cmd}`,
    status: i === 0 ? 'in_progress' : 'pending',
    activeForm: `Executing ${step.cmd}`
  }));

  TodoWrite({ todos });
}
```

**Display to user**:
```
TODO Tracking Initialized:
-> CCW:rapid: [1/3] /workflow:lite-plan
   CCW:rapid: [2/3] /workflow:lite-execute
   CCW:rapid: [3/3] /workflow:test-cycle-execute
```

---

### Phase 5: Execute Command Chain

Execute commands sequentially, update TODO status.

```javascript
async function executeCommandChain(chain, workflow, analysis) {
  let previousResult = null;

  for (let i = 0; i < chain.length; i++) {
    const step = chain[i];
    
    console.log(`\n[${i + 1}/${chain.length}] Executing: ${step.cmd}`);

    try {
      // Assemble full command
      const fullCommand = assembleCommand(step, previousResult, analysis);

      // Execute via SlashCommand (in main process)
      const result = await SlashCommand({
        command: fullCommand
      });

      // Record result
      previousResult = {
        command: step.cmd,
        success: true,
        output: result
      };

      // Update TODO status
      updateTodoStatus(i, chain.length, workflow, 'completed');

      console.log(`Done: ${step.cmd}`);

    } catch (error) {
      console.error(`Failed: ${step.cmd}: ${error.message}`);

      // Ask user how to handle error
      const action = await handleError(step, error, i, chain.length);

      if (action === 'retry') {
        i--;  // Retry current step
      } else if (action === 'abort') {
        console.log("Workflow aborted");
        return { success: false, error: error.message, completed: i };
      }
      // 'skip' - continue to next step
    }
  }

  console.log("\nWorkflow completed successfully!");
  return { success: true, completed: chain.length };
}

// Assemble command arguments
function assembleCommand(step, previousResult, analysis) {
  let command = step.cmd;

  // Dynamically assemble arguments based on command type
  if (step.args) {
    // Use existing arguments
    command += ` ${step.args}`;
  } else if (previousResult?.session_id) {
    // Use previous step's session
    command += ` --session="${previousResult.session_id}"`;
  } else if (previousResult?.plan_exists) {
    // execute command uses --resume-session
    if (step.cmd.includes('execute')) {
      command += ` --resume-session="${previousResult.session_id}"`;
    }
  }

  return command;
}

// Update TODO status
function updateTodoStatus(currentIndex, total, workflow, status) {
  const todos = getAllCurrentTodos();  // Get all current todos

  const updatedTodos = todos.map((todo, i) => {
    if (todo.content.startsWith(`CCW:${workflow}:`)) {
      const stepIndex = extractStepIndex(todo.content);
      if (stepIndex === currentIndex + 1) {
        return { ...todo, status };
      }
      if (stepIndex === currentIndex + 2 && status === 'completed') {
        return { ...todo, status: 'in_progress' };
      }
    }
    return todo;
  });

  TodoWrite({ todos: updatedTodos });
}

// Error handling
async function handleError(step, error, index, total) {
  const response = await AskUserQuestion({
    questions: [{
      question: `Command ${step.cmd} failed. How to proceed?`,
      header: "Error",
      options: [
        { label: "Retry", description: "Re-execute this command" },
        { label: "Skip", description: "Skip and continue next" },
        { label: "Abort", description: "Stop execution" }
      ],
      multiSelect: false
    }]
  });

  const actionMap = {
    "Retry": "retry",
    "Skip": "skip",
    "Abort": "abort"
  };

  return actionMap[response.Error] || "abort";
}
```

---

## Execution Flow Summary

```
User Input
    |
Phase 1: Analyze Intent
    |-- Extract: goal, scope, constraints, task_type, complexity, clarity
    +-- If clarity < 2 -> Phase 1.5: Clarify Requirements
    |
Phase 2: Select Workflow & Build Chain
    |-- Map task_type -> Level (1/2/3/4/Issue)
    |-- Select flow based on complexity
    +-- Build command chain (port-based)
    |
Phase 3: User Confirmation (optional)
    |-- Show pipeline visualization
    +-- Allow adjustment
    |
Phase 4: Setup TODO Tracking
    +-- Create todos with CCW prefix
    |
Phase 5: Execute Command Chain
    |-- For each command:
    |   |-- Assemble full command
    |   |-- Execute via SlashCommand
    |   |-- Update TODO status
    |   +-- Handle errors (retry/skip/abort)
    +-- Return workflow result
```

---

## Pipeline Examples

### Simple Feature (Level 2 - Rapid)
```
Input: "Add user profile API endpoint"

Analysis:
  Type: feature
  Complexity: low
  Level: 2

Pipeline:
requirement -> lite-plan -> plan -> lite-execute -> code -> test-cycle-execute -> test-passed

Execution:
1. SlashCommand("/workflow:lite-plan \"Add user profile API endpoint\"")
2. SlashCommand("/workflow:lite-execute --in-memory")
3. SlashCommand("/workflow:test-cycle-execute")
```

### Bug Fix (Level 2 - Bugfix)
```
Input: "Fix login timeout issue"

Analysis:
  Type: bugfix
  Complexity: low
  Level: 2

Pipeline:
bug-report -> lite-fix -> fixed-code -> test-cycle-execute -> test-passed

Execution:
1. SlashCommand("/workflow:lite-fix \"Fix login timeout issue\"")
2. SlashCommand("/workflow:test-cycle-execute")
```

### Complex Feature (Level 3 - Coupled)
```
Input: "Implement OAuth2 authentication system"

Analysis:
  Type: feature
  Complexity: high
  Level: 3

Pipeline:
requirement -> plan -> detailed-plan -> plan-verify -> verified-plan -> execute -> code
     -> review-session-cycle -> review-passed -> test-cycle-execute -> test-passed

Execution:
1. SlashCommand("/workflow:plan \"Implement OAuth2...\"")
2. SlashCommand("/workflow:plan-verify")
3. SlashCommand("/workflow:execute")
4. SlashCommand("/workflow:review-session-cycle")
5. SlashCommand("/workflow:test-cycle-execute")
```

### TDD Workflow (Level 3)
```
Input: "Implement authentication with TDD"

Analysis:
  Type: tdd
  Complexity: medium
  Level: 3

Pipeline:
requirement -> tdd-plan -> tdd-tasks -> execute -> code -> tdd-verify -> tdd-verified

Execution:
1. SlashCommand("/workflow:tdd-plan \"Implement authentication...\"")
2. SlashCommand("/workflow:execute")
3. SlashCommand("/workflow:tdd-verify")
```

### Exploration (Level 4 - Brainstorm)
```
Input: "Uncertain about real-time notification architecture"

Analysis:
  Type: exploration
  Clarity: 1.5 -> needs clarification
  Level: 4

Pipeline:
exploration-topic -> brainstorm:auto-parallel -> analysis -> plan -> detailed-plan
     -> execute -> code -> test-cycle-execute -> test-passed

Execution:
1. SlashCommand("/workflow:brainstorm:auto-parallel \"Real-time notification...\"")
2. SlashCommand("/workflow:plan")
3. SlashCommand("/workflow:plan-verify")
4. SlashCommand("/workflow:execute")
5. SlashCommand("/workflow:test-cycle-execute")
```

---

## Key Design Principles

1. **Main Process Execution** - Use SlashCommand in main process, no external CLI
2. **Intent-Driven** - Auto-select workflow based on task intent
3. **Port-Based Chaining** - Build command chain using port matching
4. **Progressive Clarification** - Low clarity triggers clarification phase
5. **TODO Tracking** - Use CCW prefix to isolate workflow todos
6. **Error Resilient** - Support retry/skip/abort error handling
7. **User Control** - Optional user confirmation at each phase

---

## Difference from ccw-coordinator

| Aspect | ccw | ccw-coordinator |
|--------|-----|-----------------|
| **Execution** | SlashCommand (main process) | Bash + ccw cli (external) |
| **Workflow Selection** | Auto by intent | Manual chain building |
| **Intent Analysis** | 5-phase with clarity check | 3-phase requirement analysis |
| **Error Handling** | Interactive retry/skip/abort | Retry/skip/abort via AskUser |
| **State Tracking** | TodoWrite only | state.json + TodoWrite |
| **Use Case** | Auto workflow selection | Manual command orchestration |

---

## Usage

```bash
# Auto-select workflow
ccw "Add user authentication"

# Complex requirement (triggers clarification)
ccw "Optimize system performance"

# Bug fix
ccw "Fix memory leak in WebSocket handler"

# TDD development
ccw "Implement user registration with TDD"

# Exploratory task
ccw "Uncertain about architecture for real-time notifications"
```
