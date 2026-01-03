# CCW Orchestrator

无状态编排器：分析输入 → 选择工作流链 → TODO 跟踪执行

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  CCW Orchestrator                                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Phase 1: Input Analysis                                          │
│  ├─ Parse input (natural language / explicit command)            │
│  ├─ Classify intent (bugfix / feature / issue / ui / docs)       │
│  └─ Assess complexity (low / medium / high)                      │
│                                                                   │
│  Phase 2: Chain Selection                                         │
│  ├─ Load index/workflow-chains.json                              │
│  ├─ Match intent → chain(s)                                       │
│  ├─ Filter by complexity                                          │
│  └─ Select optimal chain                                          │
│                                                                   │
│  Phase 3: User Confirmation (optional)                            │
│  ├─ Display selected chain and steps                              │
│  └─ Allow modification or manual selection                        │
│                                                                   │
│  Phase 4: TODO Tracking Setup                                     │
│  ├─ Create TodoWrite with chain steps                             │
│  └─ Mark first step as in_progress                                │
│                                                                   │
│  Phase 5: Execution Loop                                          │
│  ├─ Execute current step (SlashCommand)                           │
│  ├─ Update TODO status (completed)                                │
│  ├─ Check auto_continue flag                                      │
│  └─ Proceed to next step or wait for user                         │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Implementation

### Phase 1: Input Analysis

```javascript
// Load external configuration (externalized for flexibility)
const intentRules = JSON.parse(Read('.claude/skills/ccw/index/intent-rules.json'))
const capabilities = JSON.parse(Read('.claude/skills/ccw/index/command-capabilities.json'))

function analyzeInput(userInput) {
  const input = userInput.trim()

  // Check for explicit command passthrough
  if (input.match(/^\/(?:workflow|issue|memory|task):/)) {
    return { type: 'explicit', command: input, passthrough: true }
  }

  // Classify intent using external rules
  const intent = classifyIntent(input, intentRules.intent_patterns)

  // Assess complexity using external indicators
  const complexity = assessComplexity(input, intentRules.complexity_indicators)

  // Detect tool preferences using external triggers
  const toolPreference = detectToolPreference(input, intentRules.cli_tool_triggers)

  return {
    type: 'natural',
    text: input,
    intent,
    complexity,
    toolPreference,
    passthrough: false
  }
}

function classifyIntent(text, patterns) {
  // Sort by priority
  const sorted = Object.entries(patterns)
    .sort((a, b) => a[1].priority - b[1].priority)

  for (const [intentType, config] of sorted) {
    // Handle variants (bugfix, ui, docs)
    if (config.variants) {
      for (const [variant, variantConfig] of Object.entries(config.variants)) {
        const variantPatterns = variantConfig.patterns || variantConfig.triggers || []
        if (matchesAnyPattern(text, variantPatterns)) {
          // For bugfix, check if standard patterns also match
          if (intentType === 'bugfix') {
            const standardMatch = matchesAnyPattern(text, config.variants.standard?.patterns || [])
            if (standardMatch) {
              return { type: intentType, variant, workflow: variantConfig.workflow }
            }
          } else {
            return { type: intentType, variant, workflow: variantConfig.workflow }
          }
        }
      }
      // Check default variant
      if (config.variants.standard) {
        if (matchesAnyPattern(text, config.variants.standard.patterns)) {
          return { type: intentType, variant: 'standard', workflow: config.variants.standard.workflow }
        }
      }
    }

    // Handle simple patterns (exploration, tdd, review)
    if (config.patterns && !config.require_both) {
      if (matchesAnyPattern(text, config.patterns)) {
        return { type: intentType, workflow: config.workflow }
      }
    }

    // Handle dual-pattern matching (issue_batch)
    if (config.require_both && config.patterns) {
      const matchBatch = matchesAnyPattern(text, config.patterns.batch_keywords)
      const matchAction = matchesAnyPattern(text, config.patterns.action_keywords)
      if (matchBatch && matchAction) {
        return { type: intentType, workflow: config.workflow }
      }
    }
  }

  // Default to feature
  return { type: 'feature' }
}

function matchesAnyPattern(text, patterns) {
  if (!Array.isArray(patterns)) return false
  const lowerText = text.toLowerCase()
  return patterns.some(p => lowerText.includes(p.toLowerCase()))
}

function assessComplexity(text, indicators) {
  let score = 0

  for (const [level, config] of Object.entries(indicators)) {
    if (config.patterns) {
      for (const [category, patternConfig] of Object.entries(config.patterns)) {
        if (matchesAnyPattern(text, patternConfig.keywords)) {
          score += patternConfig.weight || 1
        }
      }
    }
  }

  if (score >= indicators.high.score_threshold) return 'high'
  if (score >= indicators.medium.score_threshold) return 'medium'
  return 'low'
}

function detectToolPreference(text, triggers) {
  for (const [tool, config] of Object.entries(triggers)) {
    // Check explicit triggers
    if (matchesAnyPattern(text, config.explicit)) return tool
    // Check semantic triggers
    if (matchesAnyPattern(text, config.semantic)) return tool
  }
  return null
}
```

### Phase 2: Chain Selection

```javascript
// Load workflow chains index
const chains = JSON.parse(Read('.claude/skills/ccw/index/workflow-chains.json'))

function selectChain(analysis) {
  const { intent, complexity } = analysis
  
  // Map intent type (from intent-rules.json) to chain ID (from workflow-chains.json)
  const chainMapping = {
    'bugfix': 'bugfix',
    'issue_batch': 'issue',       // intent-rules.json key → chains.json chain ID
    'exploration': 'full',
    'ui_design': 'ui',            // intent-rules.json key → chains.json chain ID
    'tdd': 'tdd',
    'review': 'review-fix',
    'documentation': 'docs',      // intent-rules.json key → chains.json chain ID
    'feature': null               // Use complexity fallback
  }
  
  let chainId = chainMapping[intent.type]
  
  // Fallback to complexity-based selection
  if (!chainId) {
    chainId = chains.chain_selection_rules.complexity_fallback[complexity]
  }
  
  const chain = chains.chains[chainId]
  
  // Handle variants
  let steps = chain.steps
  if (chain.variants) {
    const variant = intent.variant || Object.keys(chain.variants)[0]
    steps = chain.variants[variant].steps
  }
  
  return {
    id: chainId,
    name: chain.name,
    description: chain.description,
    steps,
    complexity: chain.complexity,
    estimated_time: chain.estimated_time
  }
}
```

### Phase 3: User Confirmation

```javascript
function confirmChain(selectedChain, analysis) {
  // Skip confirmation for simple chains
  if (selectedChain.steps.length <= 2 && analysis.complexity === 'low') {
    return selectedChain
  }
  
  console.log(`
## CCW Workflow Selection

**Task**: ${analysis.text.substring(0, 80)}...
**Intent**: ${analysis.intent.type}${analysis.intent.variant ? ` (${analysis.intent.variant})` : ''}
**Complexity**: ${analysis.complexity}

**Selected Chain**: ${selectedChain.name}
**Description**: ${selectedChain.description}
**Estimated Time**: ${selectedChain.estimated_time}

**Steps**:
${selectedChain.steps.map((s, i) => `${i + 1}. ${s.command}${s.optional ? ' (optional)' : ''}`).join('\n')}
`)
  
  const response = AskUserQuestion({
    questions: [{
      question: `Proceed with ${selectedChain.name}?`,
      header: "Confirm",
      multiSelect: false,
      options: [
        { label: "Proceed", description: `Execute ${selectedChain.steps.length} steps` },
        { label: "Rapid", description: "Use lite-plan → lite-execute" },
        { label: "Full", description: "Use brainstorm → plan → execute" },
        { label: "Manual", description: "Specify commands manually" }
      ]
    }]
  })
  
  // Handle alternative selection
  if (response.Confirm === 'Rapid') {
    return selectChain({ intent: { type: 'feature' }, complexity: 'low' })
  }
  if (response.Confirm === 'Full') {
    return chains.chains['full']
  }
  if (response.Confirm === 'Manual') {
    return null  // User will specify
  }
  
  return selectedChain
}
```

### Phase 4: TODO Tracking Setup

```javascript
function setupTodoTracking(chain, analysis) {
  const todos = chain.steps.map((step, index) => ({
    content: `[${index + 1}/${chain.steps.length}] ${step.command}`,
    status: index === 0 ? 'in_progress' : 'pending',
    activeForm: `Executing ${step.command}`
  }))
  
  // Add header todo
  todos.unshift({
    content: `CCW: ${chain.name} (${chain.steps.length} steps)`,
    status: 'in_progress',
    activeForm: `Running ${chain.name} workflow`
  })
  
  TodoWrite({ todos })
  
  return {
    chain,
    currentStep: 0,
    todos
  }
}
```

### Phase 5: Execution Loop

```javascript
async function executeChain(execution, analysis) {
  const { chain, todos } = execution
  let currentStep = 0
  
  while (currentStep < chain.steps.length) {
    const step = chain.steps[currentStep]
    
    // Update TODO: mark current as in_progress
    const updatedTodos = todos.map((t, i) => ({
      ...t,
      status: i === 0 
        ? 'in_progress' 
        : i === currentStep + 1 
          ? 'in_progress' 
          : i <= currentStep 
            ? 'completed' 
            : 'pending'
    }))
    TodoWrite({ todos: updatedTodos })
    
    console.log(`\n### Step ${currentStep + 1}/${chain.steps.length}: ${step.command}\n`)
    
    // Check for confirmation requirement
    if (step.confirm_before) {
      const proceed = AskUserQuestion({
        questions: [{
          question: `Ready to execute ${step.command}?`,
          header: "Step",
          multiSelect: false,
          options: [
            { label: "Execute", description: "Run this step" },
            { label: "Skip", description: "Skip to next step" },
            { label: "Abort", description: "Stop workflow" }
          ]
        }]
      })
      
      if (proceed.Step === 'Skip') {
        currentStep++
        continue
      }
      if (proceed.Step === 'Abort') {
        break
      }
    }
    
    // Execute the command
    const args = analysis.text
    SlashCommand(step.command, { args })
    
    // Mark step as completed
    updatedTodos[currentStep + 1].status = 'completed'
    TodoWrite({ todos: updatedTodos })
    
    currentStep++
    
    // Check auto_continue
    if (!step.auto_continue && currentStep < chain.steps.length) {
      console.log(`
Step completed. Next: ${chain.steps[currentStep].command}
Type "continue" to proceed or specify different action.
`)
      // Wait for user input before continuing
      break
    }
  }
  
  // Final status
  if (currentStep >= chain.steps.length) {
    const finalTodos = todos.map(t => ({ ...t, status: 'completed' }))
    TodoWrite({ todos: finalTodos })
    
    console.log(`\n✓ ${chain.name} workflow completed (${chain.steps.length} steps)`)
  }
  
  return { completed: currentStep, total: chain.steps.length }
}
```

## Main Orchestration Entry

```javascript
async function ccwOrchestrate(userInput) {
  console.log('## CCW Orchestrator\n')
  
  // Phase 1: Analyze input
  const analysis = analyzeInput(userInput)
  
  // Handle explicit command passthrough
  if (analysis.passthrough) {
    console.log(`Direct command: ${analysis.command}`)
    return SlashCommand(analysis.command)
  }
  
  // Phase 2: Select chain
  const selectedChain = selectChain(analysis)
  
  // Phase 3: Confirm (for complex workflows)
  const confirmedChain = confirmChain(selectedChain, analysis)
  if (!confirmedChain) {
    console.log('Manual mode selected. Specify commands directly.')
    return
  }
  
  // Phase 4: Setup TODO tracking
  const execution = setupTodoTracking(confirmedChain, analysis)
  
  // Phase 5: Execute
  const result = await executeChain(execution, analysis)
  
  return result
}
```

## Decision Matrix

| Intent | Complexity | Chain | Steps |
|--------|------------|-------|-------|
| bugfix (standard) | * | bugfix | lite-fix |
| bugfix (hotfix) | * | bugfix | lite-fix --hotfix |
| issue | * | issue | plan → queue → execute |
| exploration | * | full | brainstorm → plan → execute |
| ui (explore) | * | ui | ui-design:explore → sync → plan → execute |
| ui (imitate) | * | ui | ui-design:imitate → sync → plan → execute |
| tdd | * | tdd | tdd-plan → execute → tdd-verify |
| review | * | review-fix | review-session-cycle → review-fix |
| docs | low | docs | update-related |
| docs | medium+ | docs | docs → execute |
| feature | low | rapid | lite-plan → lite-execute |
| feature | medium | coupled | plan → verify → execute |
| feature | high | full | brainstorm → plan → execute |

## Continuation Commands

After each step pause:

| User Input | Action |
|------------|--------|
| `continue` | Execute next step |
| `skip` | Skip current step |
| `abort` | Stop workflow |
| `/workflow:*` | Execute specific command |
| Natural language | Re-analyze and potentially switch chains |
