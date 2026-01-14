# CCW Orchestrator

无状态编排器：分析输入 → 选择工作流链 → TODO 跟踪执行

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  CCW Orchestrator (CLI-Enhanced + Requirement Analysis)           │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Phase 1: Input Analysis (Rule-Based, Fast Path)                  │
│  ├─ Parse input (natural language / explicit command)            │
│  ├─ Classify intent (bugfix / feature / issue / ui / docs)       │
│  ├─ Assess complexity (low / medium / high)                      │
│  └─ Extract requirement dimensions (WHAT/WHERE/WHY/HOW)          │
│                                                                   │
│  Phase 1.5: CLI-Assisted Classification (Smart Path)             │
│  ├─ Trigger: low match count / high complexity / long input      │
│  ├─ Use Gemini CLI for semantic intent understanding             │
│  ├─ Get confidence score and reasoning                           │
│  └─ Fallback to rule-based if CLI fails                          │
│                                                                   │
│  Phase 1.75: Requirement Clarification (NEW)                      │
│  ├─ Calculate clarity score (0-3)                                 │
│  ├─ Trigger: clarity_score < 2 OR missing critical dimensions    │
│  ├─ Generate targeted clarification questions                     │
│  └─ Refine requirement dimensions with user input                 │
│                                                                   │
│  Phase 2: Chain Selection                                         │
│  ├─ Load index/workflow-chains.json                              │
│  ├─ Match intent → chain(s)                                       │
│  ├─ Filter by complexity                                          │
│  └─ Select optimal chain                                          │
│                                                                   │
│  Phase 2.5: CLI-Assisted Action Planning (Optimization)          │
│  ├─ Trigger: high complexity / many steps / long request         │
│  ├─ Use Gemini CLI to optimize execution strategy                │
│  ├─ Suggest step modifications or CLI injections                 │
│  └─ Identify risks and provide mitigations                       │
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

## Requirement Analysis Integration

See [specs/requirement-analysis.md](../specs/requirement-analysis.md) for full specification.

### Clarity Scoring

| Score | Level | Action |
|-------|-------|--------|
| 0 | 模糊 | 必须澄清 |
| 1 | 基本 | 建议澄清 |
| 2 | 清晰 | 可直接执行 |
| 3 | 详细 | 直接执行 |

### Dimension Extraction

```javascript
// Extract requirement dimensions during Phase 1
function extractDimensions(input) {
  return {
    what: extractWhat(input),     // Action + Target
    where: extractWhere(input),   // Scope + Paths
    why: extractWhy(input),       // Goal + Motivation
    how: extractHow(input),       // Constraints + Preferences
    clarity_score: 0,             // Calculated later
    missing_dimensions: []        // Identified later
  }
}
```

## Output Templates Integration

See [specs/output-templates.md](../specs/output-templates.md) for full specification.

All output uses standardized templates for consistency:
- Classification Summary
- Requirement Analysis
- Planning Summary
- Execution Progress
- Workflow Complete

## CLI Enhancement Features

### Trigger Conditions

| Feature | Trigger Condition | Default Tool |
|---------|------------------|--------------|
| CLI Classification | matchCount < 2 OR complexity = high OR input > 100 chars | gemini |
| CLI Action Planning | complexity = high OR steps >= 3 OR input > 200 chars | gemini |

### Fallback Behavior

- **Classification**: If CLI fails, falls back to rule-based classification
- **Action Planning**: If CLI fails, uses default chain without optimization
- **Tool Fallback**: Primary tool (gemini) -> Secondary tool (qwen)

### Configuration

All CLI enhancement settings are in `index/intent-rules.json`:

```json
{
  "cli_classification": {
    "enabled": true,
    "trigger_conditions": { ... },
    "default_tool": "gemini",
    "fallback_tool": "qwen"
  },
  "cli_action_planning": {
    "enabled": true,
    "trigger_conditions": { ... },
    "allow_step_modification": true
  }
}
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

// Calculate match count for confidence assessment
function calculateMatchCount(text, patterns) {
  let count = 0
  for (const [intentType, config] of Object.entries(patterns)) {
    if (config.variants) {
      for (const [variant, variantConfig] of Object.entries(config.variants)) {
        const variantPatterns = variantConfig.patterns || variantConfig.triggers || []
        if (matchesAnyPattern(text, variantPatterns)) count++
      }
    }
    if (config.patterns && !config.require_both) {
      if (matchesAnyPattern(text, config.patterns)) count++
    }
  }
  return count
}
```

### Phase 1.5: CLI-Assisted Classification

For ambiguous or complex inputs, use CLI tools for semantic understanding.

```javascript
// CLI-assisted classification for ambiguous inputs
async function cliAssistedClassification(input, ruleBasedResult, intentRules) {
  const cliConfig = intentRules.cli_classification

  // Skip if CLI classification is disabled
  if (!cliConfig || !cliConfig.enabled) {
    return { ...ruleBasedResult, source: 'rules', matchCount: 0 }
  }

  // Calculate match count for confidence assessment
  const matchCount = calculateMatchCount(input, intentRules.intent_patterns)

  // Determine if CLI classification should be triggered
  const triggers = cliConfig.trigger_conditions
  const shouldUseCli =
    matchCount < triggers.low_match_count ||
    ruleBasedResult.complexity === triggers.complexity_trigger ||
    input.length > triggers.min_input_length ||
    matchesAnyPattern(input, triggers.ambiguous_patterns)

  if (!shouldUseCli) {
    return { ...ruleBasedResult, source: 'rules', matchCount }
  }

  console.log('### CLI-Assisted Intent Classification\n')
  console.log('> Using CLI for semantic understanding of ambiguous input...\n')

  // Build CLI prompt for intent classification
  const cliPrompt = `
PURPOSE: Classify user request intent and recommend optimal workflow
TASK:
- Analyze the semantic meaning of the user request
- Classify into one of: bugfix, feature, exploration, ui, issue, tdd, review, docs
- Assess complexity: low, medium, high
- Recommend workflow chain based on intent and complexity
- Provide confidence score (0-1)

MODE: analysis
CONTEXT: User request analysis for workflow orchestration
EXPECTED: JSON output with structure:
{
  "intent": {
    "type": "bugfix|feature|exploration|ui|issue|tdd|review|docs",
    "variant": "optional variant like hotfix, imitate, incremental",
    "confidence": 0.0-1.0,
    "reasoning": "brief explanation of classification"
  },
  "complexity": {
    "level": "low|medium|high",
    "factors": ["factor1", "factor2"],
    "confidence": 0.0-1.0
  },
  "recommended_workflow": {
    "chain_id": "rapid|full|coupled|bugfix|issue|tdd|ui|review-fix|docs",
    "reasoning": "why this workflow is optimal"
  },
  "tool_preference": {
    "suggested": "gemini|qwen|codex|null",
    "reasoning": "optional reasoning"
  }
}

USER REQUEST:
${input}

RULES: Output ONLY valid JSON without markdown code blocks. Be concise but accurate.
`

  // Select CLI tool (default or fallback)
  const tool = cliConfig.default_tool || 'gemini'
  const timeout = cliConfig.timeout_ms || 60000

  try {
    // Execute CLI call synchronously for classification
    const escapedPrompt = cliPrompt.replace(/"/g, '\\"').replace(/\n/g, '\\n')
    const cliResult = Bash({
      command: `ccw cli -p "${escapedPrompt}" --tool ${tool} --mode analysis`,
      run_in_background: false,
      timeout: timeout
    })

    // Parse CLI result - extract JSON from response
    const jsonMatch = cliResult.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in CLI response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    console.log(`
**CLI Classification Result**:
- **Intent**: ${parsed.intent.type}${parsed.intent.variant ? ` (${parsed.intent.variant})` : ''}
- **Complexity**: ${parsed.complexity.level}
- **Confidence**: ${(parsed.intent.confidence * 100).toFixed(0)}%
- **Reasoning**: ${parsed.intent.reasoning}
- **Recommended Chain**: ${parsed.recommended_workflow.chain_id}
`)

    return {
      type: 'natural',
      text: input,
      intent: {
        type: parsed.intent.type,
        variant: parsed.intent.variant,
        workflow: parsed.recommended_workflow.chain_id
      },
      complexity: parsed.complexity.level,
      toolPreference: parsed.tool_preference?.suggested || ruleBasedResult.toolPreference,
      confidence: parsed.intent.confidence,
      source: 'cli',
      cliReasoning: parsed.intent.reasoning,
      passthrough: false
    }
  } catch (error) {
    console.log(`> CLI classification failed: ${error.message}`)
    console.log('> Falling back to rule-based classification\n')

    // Try fallback tool if available
    if (cliConfig.fallback_tool && cliConfig.fallback_tool !== tool) {
      console.log(`> Attempting fallback with ${cliConfig.fallback_tool}...`)
      // Could recursively call with fallback tool, but for simplicity, just return rule-based
    }

    return { ...ruleBasedResult, source: 'rules', matchCount }
  }
}
```

### Phase 1.75: Requirement Clarification

当需求不够清晰时，主动向用户发起澄清。

```javascript
// Requirement clarification for ambiguous inputs
async function clarifyRequirement(analysis, dimensions) {
  // Skip if already clear
  if (dimensions.clarity_score >= 2) {
    return { needsClarification: false, dimensions }
  }

  // Skip for explicit commands
  if (analysis.passthrough) {
    return { needsClarification: false, dimensions }
  }

  console.log('### Requirement Clarification\n')
  console.log('> Your request needs more detail. Let me ask a few questions.\n')

  // Generate questions based on missing dimensions
  const questions = generateClarificationQuestions(dimensions)

  if (questions.length === 0) {
    return { needsClarification: false, dimensions }
  }

  // Display current understanding
  console.log(`
**Current Understanding**:
| Dimension | Value | Status |
|-----------|-------|--------|
| WHAT | ${dimensions.what.action || 'unknown'} ${dimensions.what.target || ''} | ${dimensions.what.target ? '✓' : '⚠'} |
| WHERE | ${dimensions.where.scope}: ${dimensions.where.paths?.join(', ') || 'unknown'} | ${dimensions.where.paths?.length ? '✓' : '⚠'} |
| WHY | ${dimensions.why.goal || 'not specified'} | ${dimensions.why.goal ? '✓' : '○'} |
| HOW | ${dimensions.how.constraints?.join(', ') || 'no constraints'} | ○ |

**Clarity Score**: ${dimensions.clarity_score}/3
`)

  // Ask user for clarification (max 4 questions)
  const responses = AskUserQuestion({
    questions: questions.slice(0, 4)
  })

  // Refine dimensions with user responses
  const refinedDimensions = refineDimensions(dimensions, responses)
  refinedDimensions.clarity_score = Math.min(3, dimensions.clarity_score + 1)

  console.log('> Requirements clarified. Proceeding with workflow selection.\n')

  return { needsClarification: false, dimensions: refinedDimensions }
}

// Generate clarification questions based on missing info
function generateClarificationQuestions(dimensions) {
  const questions = []

  // WHAT: If target is unclear
  if (!dimensions.what.target) {
    questions.push({
      question: "你想要对什么进行操作?",
      header: "目标",
      multiSelect: false,
      options: [
        { label: "特定文件", description: "修改特定的文件或代码" },
        { label: "功能模块", description: "处理整个功能模块" },
        { label: "系统级", description: "架构或系统级变更" },
        { label: "让我指定", description: "我会提供具体说明" }
      ]
    })
  }

  // WHERE: If scope is unknown
  if (dimensions.where.scope === 'unknown' && !dimensions.where.paths?.length) {
    questions.push({
      question: "操作的范围是什么?",
      header: "范围",
      multiSelect: false,
      options: [
        { label: "自动发现", description: "分析代码库后推荐相关位置" },
        { label: "当前目录", description: "只在当前工作目录" },
        { label: "全项目", description: "整个项目范围" },
        { label: "让我指定", description: "我会提供具体路径" }
      ]
    })
  }

  // WHY: If goal is unclear for complex tasks
  if (!dimensions.why.goal && dimensions.what.action !== 'analyze') {
    questions.push({
      question: "这个操作的主要目标是什么?",
      header: "目标",
      multiSelect: false,
      options: [
        { label: "修复问题", description: "解决已知的Bug或错误" },
        { label: "新增功能", description: "添加新的能力或特性" },
        { label: "改进质量", description: "提升性能、可维护性" },
        { label: "代码审查", description: "检查和评估代码" }
      ]
    })
  }

  // HOW: If constraints matter for the task
  if (dimensions.what.action === 'refactor' || dimensions.what.action === 'create') {
    questions.push({
      question: "有什么特殊要求或限制?",
      header: "约束",
      multiSelect: true,
      options: [
        { label: "保持兼容", description: "不破坏现有功能" },
        { label: "最小改动", description: "尽量少修改文件" },
        { label: "包含测试", description: "需要添加测试" },
        { label: "无特殊要求", description: "按最佳实践处理" }
      ]
    })
  }

  return questions
}

// Refine dimensions based on user responses
function refineDimensions(dimensions, responses) {
  const refined = { ...dimensions }

  // Apply user selections to dimensions
  if (responses['目标']) {
    if (responses['目标'] === '特定文件') {
      refined.where.scope = 'file'
    } else if (responses['目标'] === '功能模块') {
      refined.where.scope = 'module'
    } else if (responses['目标'] === '系统级') {
      refined.where.scope = 'system'
    }
  }

  if (responses['范围']) {
    if (responses['范围'] === '全项目') {
      refined.where.scope = 'system'
    } else if (responses['范围'] === '当前目录') {
      refined.where.scope = 'module'
    }
  }

  if (responses['目标']) {
    const goalMapping = {
      '修复问题': 'fix bug',
      '新增功能': 'add feature',
      '改进质量': 'improve quality',
      '代码审查': 'code review'
    }
    refined.why.goal = goalMapping[responses['目标']] || responses['目标']
  }

  if (responses['约束']) {
    const constraints = Array.isArray(responses['约束']) ? responses['约束'] : [responses['约束']]
    refined.how.constraints = constraints.filter(c => c !== '无特殊要求')
  }

  // Update missing dimensions
  refined.missing_dimensions = identifyMissing(refined)

  return refined
}

// Identify still-missing dimensions
function identifyMissing(dimensions) {
  const missing = []
  if (!dimensions.what.target) missing.push('what.target')
  if (dimensions.where.scope === 'unknown') missing.push('where.scope')
  // why and how are optional
  return missing
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

### Phase 2.5: CLI-Assisted Action Planning

For high complexity tasks, use CLI to plan optimal execution strategy.

```javascript
// CLI-assisted action planning for complex tasks
async function cliAssistedPlanning(analysis, selectedChain, intentRules) {
  const planConfig = intentRules.cli_action_planning

  // Skip if action planning is disabled
  if (!planConfig || !planConfig.enabled) {
    return { useDefaultChain: true, chain: selectedChain }
  }

  // Determine if CLI planning should be triggered
  const triggers = planConfig.trigger_conditions
  const shouldUseCli =
    analysis.complexity === triggers.complexity_threshold ||
    selectedChain.steps.length >= triggers.step_count_threshold ||
    (analysis.text && analysis.text.length > 200)

  if (!shouldUseCli) {
    return { useDefaultChain: true, chain: selectedChain }
  }

  console.log('### CLI-Assisted Action Planning\n')
  console.log('> Using CLI to optimize execution strategy for complex task...\n')

  // Build CLI prompt for action planning
  const planningPrompt = `
PURPOSE: Plan optimal workflow execution strategy for complex task
TASK:
- Review the selected workflow chain and its steps
- Consider task complexity, dependencies, and potential risks
- Suggest step modifications, additions, or reordering if beneficial
- Identify potential risks and provide mitigations
- Recommend CLI tool injection points for efficiency

MODE: analysis
CONTEXT:
- User Intent: ${analysis.intent.type}${analysis.intent.variant ? ` (${analysis.intent.variant})` : ''}
- Complexity: ${analysis.complexity}
- Selected Chain: ${selectedChain.name}
- Current Steps: ${selectedChain.steps.map((s, i) => `${i + 1}. ${s.command}`).join(', ')}
- User Request: ${analysis.text ? analysis.text.substring(0, 200) : 'N/A'}

EXPECTED: JSON output with structure:
{
  "recommendation": "use_default|modify|upgrade",
  "modified_steps": [
    { "command": "/workflow:xxx", "optional": false, "auto_continue": true, "reason": "why this step" }
  ],
  "cli_injections": [
    { "before_step": 1, "tool": "gemini", "mode": "analysis", "purpose": "pre-analysis" }
  ],
  "reasoning": "explanation of recommendations",
  "risks": ["risk1", "risk2"],
  "mitigations": ["mitigation1", "mitigation2"],
  "suggestions": ["suggestion1", "suggestion2"]
}

RULES: Output ONLY valid JSON. If no modifications needed, set recommendation to "use_default" and leave modified_steps empty.
`

  const tool = planConfig.default_tool || 'gemini'
  const timeout = planConfig.timeout_ms || 60000

  try {
    const escapedPrompt = planningPrompt.replace(/"/g, '\\"').replace(/\n/g, '\\n')
    const cliResult = Bash({
      command: `ccw cli -p "${escapedPrompt}" --tool ${tool} --mode analysis`,
      run_in_background: false,
      timeout: timeout
    })

    // Parse CLI result
    const jsonMatch = cliResult.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in CLI response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Display planning results
    console.log(`
**CLI Planning Result**:
- **Recommendation**: ${parsed.recommendation}
- **Reasoning**: ${parsed.reasoning}
${parsed.risks && parsed.risks.length > 0 ? `- **Risks**: ${parsed.risks.join(', ')}` : ''}
${parsed.suggestions && parsed.suggestions.length > 0 ? `- **Suggestions**: ${parsed.suggestions.join(', ')}` : ''}
`)

    // Handle step modification
    if (parsed.recommendation === 'modify' && parsed.modified_steps && parsed.modified_steps.length > 0) {
      if (planConfig.allow_step_modification) {
        console.log('> Applying modified execution plan\n')
        return {
          useDefaultChain: false,
          chain: {
            ...selectedChain,
            steps: parsed.modified_steps
          },
          reasoning: parsed.reasoning,
          risks: parsed.risks,
          cliInjections: parsed.cli_injections,
          source: 'cli-planned'
        }
      } else {
        console.log('> Step modification disabled, using default chain with suggestions\n')
      }
    }

    // Handle upgrade recommendation
    if (parsed.recommendation === 'upgrade') {
      console.log('> CLI recommends upgrading to a more comprehensive workflow\n')
      // Could select a more complex chain here
    }

    return {
      useDefaultChain: true,
      chain: selectedChain,
      suggestions: parsed.suggestions,
      risks: parsed.risks,
      cliInjections: parsed.cli_injections,
      source: 'cli-reviewed'
    }
  } catch (error) {
    console.log(`> CLI planning failed: ${error.message}`)
    console.log('> Using default chain without optimization\n')

    return { useDefaultChain: true, chain: selectedChain, source: 'default' }
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

  // Phase 1: Analyze input (rule-based, fast path)
  const ruleBasedAnalysis = analyzeInput(userInput)

  // Handle explicit command passthrough
  if (ruleBasedAnalysis.passthrough) {
    console.log(`Direct command: ${ruleBasedAnalysis.command}`)
    return SlashCommand(ruleBasedAnalysis.command)
  }

  // Phase 1.5: CLI-Assisted Classification (smart path for ambiguous inputs)
  const analysis = await cliAssistedClassification(userInput, ruleBasedAnalysis, intentRules)

  // Display classification source
  if (analysis.source === 'cli') {
    console.log(`
### Classification Summary
- **Source**: CLI-Assisted (${analysis.confidence ? (analysis.confidence * 100).toFixed(0) + '% confidence' : 'semantic analysis'})
- **Intent**: ${analysis.intent.type}${analysis.intent.variant ? ` (${analysis.intent.variant})` : ''}
- **Complexity**: ${analysis.complexity}
${analysis.cliReasoning ? `- **Reasoning**: ${analysis.cliReasoning}` : ''}
`)
  } else {
    console.log(`
### Classification Summary
- **Source**: Rule-Based (fast path)
- **Intent**: ${analysis.intent.type}${analysis.intent.variant ? ` (${analysis.intent.variant})` : ''}
- **Complexity**: ${analysis.complexity}
`)
  }

  // Phase 2: Select chain
  const selectedChain = selectChain(analysis)

  // Phase 2.5: CLI-Assisted Action Planning (for high complexity)
  const planningResult = await cliAssistedPlanning(analysis, selectedChain, intentRules)
  const optimizedChain = planningResult.chain

  // Display planning result if CLI was used
  if (planningResult.source === 'cli-planned' || planningResult.source === 'cli-reviewed') {
    console.log(`
### Planning Summary
- **Source**: CLI-Assisted
${planningResult.reasoning ? `- **Reasoning**: ${planningResult.reasoning}` : ''}
${planningResult.risks && planningResult.risks.length > 0 ? `- **Identified Risks**: ${planningResult.risks.join(', ')}` : ''}
${planningResult.suggestions && planningResult.suggestions.length > 0 ? `- **Suggestions**: ${planningResult.suggestions.join(', ')}` : ''}
`)
  }

  // Phase 3: Confirm (for complex workflows)
  const confirmedChain = confirmChain(optimizedChain, analysis)
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
