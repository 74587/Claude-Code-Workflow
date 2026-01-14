# CCW Orchestrator

无状态编排器：分析输入 → 选择工作流链 → TODO 跟踪执行

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│  CCW Orchestrator (CLI-Enhanced + Requirement Analysis)         │
├────────────────────────────────────────────────────────────────┤
│  Phase 1   │ Input Analysis (rule-based, fast path)            │
│  Phase 1.5 │ CLI Classification (semantic, smart path)         │
│  Phase 1.75│ Requirement Clarification (clarity < 2)           │
│  Phase 2   │ Chain Selection (intent → workflow)               │
│  Phase 2.5 │ CLI Action Planning (high complexity)             │
│  Phase 3   │ User Confirmation (optional)                      │
│  Phase 4   │ TODO Tracking Setup                                │
│  Phase 5   │ Execution Loop                                     │
└────────────────────────────────────────────────────────────────┘
```

**References**: 
- [specs/requirement-analysis.md](../specs/requirement-analysis.md) - Dimension extraction & clarity scoring
- [specs/output-templates.md](../specs/output-templates.md) - Standardized output templates

## CLI Enhancement Config

| Feature | Trigger | Default Tool |
|---------|---------|--------------|
| Classification | matchCount < 2 OR complexity = high OR input > 100 chars | gemini |
| Action Planning | complexity = high OR steps >= 3 OR input > 200 chars | gemini |

Settings in `index/intent-rules.json`. Fallback: gemini → qwen → rule-based.

---

## Core Helpers

```javascript
// === Pattern Matching ===
const matchesAny = (text, patterns) => 
  Array.isArray(patterns) && patterns.some(p => text.toLowerCase().includes(p.toLowerCase()))

// === CLI Execution Helper ===
async function executeCli(prompt, config, purpose) {
  const tool = config.default_tool || 'gemini'
  const timeout = config.timeout_ms || 60000
  
  try {
    const escaped = prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n')
    const result = Bash({
      command: `ccw cli -p "${escaped}" --tool ${tool} --mode analysis`,
      run_in_background: false,
      timeout
    })
    
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in CLI response')
    return JSON.parse(jsonMatch[0])
  } catch (error) {
    console.log(`> CLI ${purpose} failed: ${error.message}, falling back`)
    return null
  }
}

// === TODO Tracking Helpers ===
function updateTodos(todos, updates) {
  TodoWrite({ todos: todos.map((t, i) => updates[i] ? { ...t, ...updates[i] } : t) })
}

function formatDuration(ms) { return (ms / 1000).toFixed(1) }
function timestamp() { return new Date().toLocaleTimeString() }
```

---

## Phase 1: Input Analysis

```javascript
const intentRules = JSON.parse(Read('.claude/skills/ccw/index/intent-rules.json'))
const chains = JSON.parse(Read('.claude/skills/ccw/index/workflow-chains.json'))

function analyzeInput(userInput) {
  const input = userInput.trim()
  
  // Explicit command passthrough
  if (input.match(/^\/(?:workflow|issue|memory|task):/)) {
    return { type: 'explicit', command: input, passthrough: true }
  }
  
  return {
    type: 'natural',
    text: input,
    intent: classifyIntent(input, intentRules.intent_patterns),
    complexity: assessComplexity(input, intentRules.complexity_indicators),
    toolPreference: detectToolPreference(input, intentRules.cli_tool_triggers),
    passthrough: false
  }
}

function classifyIntent(text, patterns) {
  const sorted = Object.entries(patterns).sort((a, b) => a[1].priority - b[1].priority)
  
  for (const [intentType, config] of sorted) {
    // Handle variants (bugfix, ui, docs)
    if (config.variants) {
      for (const [variant, vc] of Object.entries(config.variants)) {
        const vPatterns = vc.patterns || vc.triggers || []
        if (matchesAny(text, vPatterns)) {
          if (intentType === 'bugfix') {
            if (matchesAny(text, config.variants.standard?.patterns || []))
              return { type: intentType, variant, workflow: vc.workflow }
          } else {
            return { type: intentType, variant, workflow: vc.workflow }
          }
        }
      }
      if (config.variants.standard && matchesAny(text, config.variants.standard.patterns))
        return { type: intentType, variant: 'standard', workflow: config.variants.standard.workflow }
    }
    
    // Simple patterns
    if (config.patterns && !config.require_both && matchesAny(text, config.patterns))
      return { type: intentType, workflow: config.workflow }
    
    // Dual-pattern (issue_batch)
    if (config.require_both && config.patterns) {
      if (matchesAny(text, config.patterns.batch_keywords) && matchesAny(text, config.patterns.action_keywords))
        return { type: intentType, workflow: config.workflow }
    }
  }
  return { type: 'feature' }
}

function assessComplexity(text, indicators) {
  let score = 0
  for (const [level, config] of Object.entries(indicators)) {
    if (config.patterns) {
      for (const [, pc] of Object.entries(config.patterns)) {
        if (matchesAny(text, pc.keywords)) score += pc.weight || 1
      }
    }
  }
  if (score >= indicators.high.score_threshold) return 'high'
  if (score >= indicators.medium.score_threshold) return 'medium'
  return 'low'
}

function detectToolPreference(text, triggers) {
  for (const [tool, config] of Object.entries(triggers)) {
    if (matchesAny(text, config.explicit) || matchesAny(text, config.semantic)) return tool
  }
  return null
}

function calculateMatchCount(text, patterns) {
  let count = 0
  for (const [, config] of Object.entries(patterns)) {
    if (config.variants) {
      for (const [, vc] of Object.entries(config.variants)) {
        if (matchesAny(text, vc.patterns || vc.triggers || [])) count++
      }
    }
    if (config.patterns && !config.require_both && matchesAny(text, config.patterns)) count++
  }
  return count
}
```

---

## Dimension Extraction (WHAT/WHERE/WHY/HOW)

```javascript
const PATTERNS = {
  actions: {
    create: /创建|新增|添加|实现|生成|create|add|implement|generate/i,
    fix: /修复|修正|解决|fix|repair|resolve|debug/i,
    refactor: /重构|优化结构|重写|refactor|restructure|rewrite/i,
    optimize: /优化|提升|改进|性能|optimize|improve|enhance|performance/i,
    analyze: /分析|理解|探索|研究|analyze|understand|explore|research/i,
    review: /审查|检查|评估|review|check|assess|audit/i
  },
  files: /(\S+\.(ts|js|py|md|json|yaml|yml|tsx|jsx|vue|css|scss))/g,
  modules: /(src\/\S+|lib\/\S+|packages\/\S+|components\/\S+)/g,
  dirs: /(\/[\w\-\.\/]+)/g,
  systemScope: /全局|全部|整个|all|entire|whole|系统/i,
  goal: /(?:为了|因为|目的是|to|for|because)\s+([^,，。]+)/i,
  motivation: /(?:需要|想要|希望|want|need|should)\s+([^,，。]+)/i,
  must: /(?:必须|一定要|需要|must|required)\s+([^,，。]+)/i,
  mustNot: /(?:不要|禁止|不能|避免|must not|don't|avoid)\s+([^,，。]+)/i,
  prefer: /(?:应该|最好|建议|should|prefer)\s+([^,，。]+)/i,
  unclear: /不知道|不确定|maybe|可能|how to|怎么/i,
  helpRequest: /帮我|help me|请问/i
}

function extractDimensions(input) {
  // WHAT
  let action = null
  for (const [key, pattern] of Object.entries(PATTERNS.actions)) {
    if (pattern.test(input)) { action = key; break }
  }
  const targetMatch = input.match(/(?:对|in|for|the)\s+([^\s,，。]+)/i)
  
  // WHERE
  const files = [...input.matchAll(PATTERNS.files)].map(m => m[1])
  const modules = [...input.matchAll(PATTERNS.modules)].map(m => m[1])
  const dirs = [...input.matchAll(PATTERNS.dirs)].map(m => m[1])
  const paths = [...new Set([...files, ...modules, ...dirs])]
  const scope = files.length > 0 ? 'file' : modules.length > 0 ? 'module' : PATTERNS.systemScope.test(input) ? 'system' : 'unknown'
  
  // WHY
  const goalMatch = input.match(PATTERNS.goal)
  const motivationMatch = input.match(PATTERNS.motivation)
  
  // HOW
  const constraints = []
  const mustMatch = input.match(PATTERNS.must)
  const mustNotMatch = input.match(PATTERNS.mustNot)
  if (mustMatch) constraints.push(mustMatch[1].trim())
  if (mustNotMatch) constraints.push('NOT: ' + mustNotMatch[1].trim())
  const prefMatch = input.match(PATTERNS.prefer)
  const preferences = prefMatch ? [prefMatch[1].trim()] : null

  return {
    what: { action, target: targetMatch?.[1] || null, description: input.substring(0, 100) },
    where: { scope, paths: paths.length > 0 ? paths : null, patterns: null },
    why: { goal: goalMatch?.[1]?.trim() || null, motivation: motivationMatch?.[1]?.trim() || null, success_criteria: null },
    how: { constraints: constraints.length > 0 ? constraints : null, preferences, approach: null },
    clarity_score: 0,
    missing_dimensions: []
  }
}

function calculateClarityScore(input, d) {
  let score = 0
  if (d.what.action) score += 0.5
  if (d.what.target) score += 0.5
  if (d.where.paths?.length > 0) score += 0.5
  if (d.where.scope !== 'unknown') score += 0.5
  if (d.why.goal) score += 0.5
  if (d.how.constraints?.length > 0) score += 0.5
  if (PATTERNS.unclear.test(input)) score -= 0.5
  if (PATTERNS.helpRequest.test(input)) score -= 0.5
  return Math.max(0, Math.min(3, Math.round(score)))
}

function identifyMissing(d) {
  const missing = []
  if (!d.what.target) missing.push('what.target')
  if (d.where.scope === 'unknown') missing.push('where.scope')
  return missing
}
```

---

## Phase 1.5: CLI-Assisted Classification

```javascript
async function cliAssistedClassification(input, ruleBasedResult, intentRules) {
  const cfg = intentRules.cli_classification
  if (!cfg?.enabled) return { ...ruleBasedResult, source: 'rules', matchCount: 0 }
  
  const matchCount = calculateMatchCount(input, intentRules.intent_patterns)
  const triggers = cfg.trigger_conditions
  const shouldUseCli = matchCount < triggers.low_match_count ||
    ruleBasedResult.complexity === triggers.complexity_trigger ||
    input.length > triggers.min_input_length ||
    matchesAny(input, triggers.ambiguous_patterns)
  
  if (!shouldUseCli) return { ...ruleBasedResult, source: 'rules', matchCount }
  
  console.log('### CLI-Assisted Intent Classification\n')
  
  const prompt = `
PURPOSE: Classify user request intent and recommend optimal workflow
TASK: Analyze semantic meaning, classify intent, assess complexity, recommend workflow
MODE: analysis
USER REQUEST: ${input}
EXPECTED: JSON { intent: { type, variant?, confidence, reasoning }, complexity: { level, factors, confidence }, recommended_workflow: { chain_id, reasoning }, tool_preference?: { suggested, reasoning } }
RULES: Output ONLY valid JSON. Types: bugfix|feature|exploration|ui|issue|tdd|review|docs. Chains: rapid|full|coupled|bugfix|issue|tdd|ui|review-fix|docs`

  const parsed = await executeCli(prompt, cfg, 'classification')
  if (!parsed) return { ...ruleBasedResult, source: 'rules', matchCount }
  
  console.log(`**CLI Result**: ${parsed.intent.type}${parsed.intent.variant ? ` (${parsed.intent.variant})` : ''} | ${parsed.complexity.level} | ${(parsed.intent.confidence * 100).toFixed(0)}% confidence`)
  
  return {
    type: 'natural', text: input,
    intent: { type: parsed.intent.type, variant: parsed.intent.variant, workflow: parsed.recommended_workflow.chain_id },
    complexity: parsed.complexity.level,
    toolPreference: parsed.tool_preference?.suggested || ruleBasedResult.toolPreference,
    confidence: parsed.intent.confidence,
    source: 'cli', cliReasoning: parsed.intent.reasoning, passthrough: false
  }
}
```

---

## Phase 1.75: Requirement Clarification

```javascript
async function clarifyRequirement(analysis, dimensions) {
  if (dimensions.clarity_score >= 2 || analysis.passthrough)
    return { needsClarification: false, dimensions }
  
  console.log('### Requirement Clarification\n')
  console.log(`**Clarity**: ${dimensions.clarity_score}/3 | WHAT: ${dimensions.what.action || '?'} | WHERE: ${dimensions.where.scope} | WHY: ${dimensions.why.goal || '?'}`)
  
  const questions = generateClarificationQuestions(dimensions)
  if (questions.length === 0) return { needsClarification: false, dimensions }
  
  const responses = AskUserQuestion({ questions: questions.slice(0, 4) })
  const refined = refineDimensions(dimensions, responses)
  refined.clarity_score = Math.min(3, dimensions.clarity_score + 1)
  
  return { needsClarification: false, dimensions: refined }
}

function generateClarificationQuestions(d) {
  const Q = []
  
  if (!d.what.target) Q.push({
    question: "你想要对什么进行操作?", header: "目标", multiSelect: false,
    options: [
      { label: "特定文件", description: "修改特定的文件或代码" },
      { label: "功能模块", description: "处理整个功能模块" },
      { label: "系统级", description: "架构或系统级变更" },
      { label: "让我指定", description: "我会提供具体说明" }
    ]
  })
  
  if (d.where.scope === 'unknown' && !d.where.paths?.length) Q.push({
    question: "操作的范围是什么?", header: "范围", multiSelect: false,
    options: [
      { label: "自动发现", description: "分析代码库后推荐相关位置" },
      { label: "当前目录", description: "只在当前工作目录" },
      { label: "全项目", description: "整个项目范围" },
      { label: "让我指定", description: "我会提供具体路径" }
    ]
  })
  
  if (!d.why.goal && d.what.action !== 'analyze') Q.push({
    question: "这个操作的主要目标是什么?", header: "目标类型", multiSelect: false,
    options: [
      { label: "修复问题", description: "解决已知的Bug或错误" },
      { label: "新增功能", description: "添加新的能力或特性" },
      { label: "改进质量", description: "提升性能、可维护性" },
      { label: "代码审查", description: "检查和评估代码" }
    ]
  })
  
  if (d.what.action === 'refactor' || d.what.action === 'create') Q.push({
    question: "有什么特殊要求或限制?", header: "约束", multiSelect: true,
    options: [
      { label: "保持兼容", description: "不破坏现有功能" },
      { label: "最小改动", description: "尽量少修改文件" },
      { label: "包含测试", description: "需要添加测试" },
      { label: "无特殊要求", description: "按最佳实践处理" }
    ]
  })
  
  return Q
}

function refineDimensions(d, responses) {
  const r = { ...d, what: { ...d.what }, where: { ...d.where }, why: { ...d.why }, how: { ...d.how } }
  
  const scopeMap = { '特定文件': 'file', '功能模块': 'module', '系统级': 'system', '全项目': 'system', '当前目录': 'module' }
  const goalMap = { '修复问题': 'fix bug', '新增功能': 'add feature', '改进质量': 'improve quality', '代码审查': 'code review' }
  
  if (responses['目标'] && scopeMap[responses['目标']]) r.where.scope = scopeMap[responses['目标']]
  if (responses['范围'] && scopeMap[responses['范围']]) r.where.scope = scopeMap[responses['范围']]
  if (responses['目标类型'] && goalMap[responses['目标类型']]) r.why.goal = goalMap[responses['目标类型']]
  if (responses['约束']) {
    const c = Array.isArray(responses['约束']) ? responses['约束'] : [responses['约束']]
    r.how.constraints = c.filter(x => x !== '无特殊要求')
  }
  
  r.missing_dimensions = identifyMissing(r)
  return r
}
```

---

## Phase 2: Chain Selection

```javascript
function selectChain(analysis) {
  const { intent, complexity } = analysis
  const chainMap = {
    bugfix: 'bugfix', issue_batch: 'issue', exploration: 'full', ui_design: 'ui',
    tdd: 'tdd', review: 'review-fix', documentation: 'docs', feature: null
  }
  
  let chainId = chainMap[intent.type] || chains.chain_selection_rules.complexity_fallback[complexity]
  const chain = chains.chains[chainId]
  let steps = chain.steps
  
  if (chain.variants) {
    const variant = intent.variant || Object.keys(chain.variants)[0]
    steps = chain.variants[variant].steps
  }
  
  return { id: chainId, name: chain.name, description: chain.description, steps, complexity: chain.complexity, estimated_time: chain.estimated_time }
}
```

---

## Phase 2.5: CLI-Assisted Action Planning

```javascript
async function cliAssistedPlanning(analysis, selectedChain, intentRules) {
  const cfg = intentRules.cli_action_planning
  if (!cfg?.enabled) return { useDefaultChain: true, chain: selectedChain }
  
  const triggers = cfg.trigger_conditions
  const shouldUseCli = analysis.complexity === triggers.complexity_threshold ||
    selectedChain.steps.length >= triggers.step_count_threshold ||
    (analysis.text?.length > 200)
  
  if (!shouldUseCli) return { useDefaultChain: true, chain: selectedChain }
  
  console.log('### CLI-Assisted Action Planning\n')
  
  const prompt = `
PURPOSE: Plan optimal workflow execution strategy
CONTEXT: Intent=${analysis.intent.type}, Complexity=${analysis.complexity}, Chain=${selectedChain.name}, Steps=${selectedChain.steps.map(s => s.command).join(',')}
USER REQUEST: ${analysis.text?.substring(0, 200) || 'N/A'}
EXPECTED: JSON { recommendation: "use_default|modify|upgrade", modified_steps?: [], cli_injections?: [], reasoning, risks?: [], suggestions?: [] }
RULES: Output ONLY valid JSON. If no modifications needed, use "use_default".`

  const parsed = await executeCli(prompt, cfg, 'planning')
  if (!parsed) return { useDefaultChain: true, chain: selectedChain, source: 'default' }
  
  console.log(`**Planning**: ${parsed.recommendation}${parsed.reasoning ? ` - ${parsed.reasoning}` : ''}`)
  
  if (parsed.recommendation === 'modify' && parsed.modified_steps?.length > 0 && cfg.allow_step_modification) {
    return {
      useDefaultChain: false,
      chain: { ...selectedChain, steps: parsed.modified_steps },
      reasoning: parsed.reasoning, risks: parsed.risks, cliInjections: parsed.cli_injections, source: 'cli-planned'
    }
  }
  
  return { useDefaultChain: true, chain: selectedChain, suggestions: parsed.suggestions, risks: parsed.risks, source: 'cli-reviewed' }
}
```

---

## Phase 3: User Confirmation

```javascript
function confirmChain(selectedChain, analysis) {
  if (selectedChain.steps.length <= 2 && analysis.complexity === 'low') return selectedChain
  
  console.log(`\n## CCW Workflow: ${selectedChain.name}\n**Intent**: ${analysis.intent.type} | **Complexity**: ${analysis.complexity}\n**Steps**: ${selectedChain.steps.map((s, i) => `${i + 1}. ${s.command}`).join(' → ')}`)
  
  const response = AskUserQuestion({
    questions: [{
      question: `Proceed with ${selectedChain.name}?`, header: "Confirm", multiSelect: false,
      options: [
        { label: "Proceed", description: `Execute ${selectedChain.steps.length} steps` },
        { label: "Rapid", description: "Use lite-plan → lite-execute" },
        { label: "Full", description: "Use brainstorm → plan → execute" },
        { label: "Manual", description: "Specify commands manually" }
      ]
    }]
  })
  
  if (response.Confirm === 'Rapid') return selectChain({ intent: { type: 'feature' }, complexity: 'low' })
  if (response.Confirm === 'Full') return chains.chains['full']
  if (response.Confirm === 'Manual') return null
  return selectedChain
}
```

---

## Phase 4: TODO Tracking Setup

```javascript
function setupTodoTracking(chain, analysis) {
  const todos = [
    { content: `CCW: ${chain.name} (${chain.steps.length} steps)`, status: 'in_progress', activeForm: `Running ${chain.name} workflow` },
    ...chain.steps.map((step, i) => ({
      content: `[${i + 1}/${chain.steps.length}] ${step.command}`,
      status: i === 0 ? 'in_progress' : 'pending',
      activeForm: `Executing ${step.command}`
    }))
  ]
  TodoWrite({ todos })
  return { chain, currentStep: 0, todos }
}

function trackCommandDispatch(command) {
  const name = command.split(' ')[0]
  const todos = [
    { content: `CCW: Direct Command Dispatch`, status: 'in_progress', activeForm: `Dispatching ${name}` },
    { content: `[${timestamp()}] ${command}`, status: 'in_progress', activeForm: `Executing ${name}` }
  ]
  TodoWrite({ todos })
  return { command, startTime: Date.now(), todos }
}

function markCommandResult(tracking, success, error) {
  const duration = formatDuration(Date.now() - tracking.startTime)
  const name = tracking.command.split(' ')[0]
  const icon = success ? '✓' : '✗'
  const suffix = success ? `(${duration}s)` : `(failed: ${error})`
  
  TodoWrite({ todos: [
    { content: `CCW: Direct Command Dispatch`, status: 'completed', activeForm: success ? `Completed ${name}` : 'Failed' },
    { content: `${icon} ${tracking.command} ${suffix}`, status: 'completed', activeForm: success ? `Completed ${name}` : 'Failed' }
  ]})
}
```

---

## Phase 5: Execution Loop

```javascript
async function executeChain(execution, analysis) {
  const { chain, todos } = execution
  let step = 0
  const timings = []
  
  while (step < chain.steps.length) {
    const s = chain.steps[step]
    const start = Date.now()
    
    // Update TODO: current step in_progress
    const updated = todos.map((t, i) => {
      if (i === 0) return { ...t, status: 'in_progress' }
      if (i === step + 1) return { ...t, status: 'in_progress', content: `[${step + 1}/${chain.steps.length}] ${s.command} (started ${timestamp()})` }
      if (i <= step) {
        const tm = timings[i - 1]
        return { ...t, status: 'completed', content: tm === 'skipped' ? `⊘ ${t.content}` : `✓ [${i}/${chain.steps.length}] ${chain.steps[i-1].command} (${tm}s)` }
      }
      return { ...t, status: 'pending' }
    })
    TodoWrite({ todos: updated })
    
    console.log(`\n### Step ${step + 1}/${chain.steps.length}: ${s.command}`)
    
    // Confirmation if required
    if (s.confirm_before) {
      const r = AskUserQuestion({
        questions: [{ question: `Execute ${s.command}?`, header: "Step", multiSelect: false,
          options: [{ label: "Execute", description: "Run" }, { label: "Skip", description: "Skip" }, { label: "Abort", description: "Stop" }] }]
      })
      if (r.Step === 'Skip') { timings.push('skipped'); step++; continue }
      if (r.Step === 'Abort') break
    }
    
    // Execute
    try {
      SlashCommand(s.command, { args: analysis.text })
      const duration = formatDuration(Date.now() - start)
      timings.push(duration)
      updated[step + 1] = { ...updated[step + 1], status: 'completed', content: `✓ [${step + 1}/${chain.steps.length}] ${s.command} (${duration}s)` }
      TodoWrite({ todos: updated })
      console.log(`> Completed (${duration}s)`)
    } catch (error) {
      updated[step + 1] = { ...updated[step + 1], status: 'completed', content: `✗ [${step + 1}/${chain.steps.length}] ${s.command} (failed)` }
      TodoWrite({ todos: updated })
      console.log(`> Failed: ${error.message}`)
      
      const r = AskUserQuestion({
        questions: [{ question: `Step failed. Proceed?`, header: "Error", multiSelect: false,
          options: [{ label: "Retry", description: "Retry" }, { label: "Skip", description: "Skip" }, { label: "Abort", description: "Stop" }] }]
      })
      if (r.Error === 'Retry') continue
      if (r.Error === 'Abort') break
    }
    
    step++
    
    // Check auto_continue
    if (!s.auto_continue && step < chain.steps.length) {
      console.log(`\nPaused. Next: ${chain.steps[step].command}. Type "continue" to proceed.`)
      break
    }
  }
  
  // Final status
  if (step >= chain.steps.length) {
    const total = timings.filter(t => t !== 'skipped').reduce((sum, t) => sum + parseFloat(t), 0).toFixed(1)
    const final = todos.map((t, i) => {
      if (i === 0) return { ...t, status: 'completed', content: `✓ CCW: ${chain.name} completed (${total}s)`, activeForm: 'Complete' }
      const tm = timings[i - 1]
      return { ...t, status: 'completed', content: tm === 'skipped' ? `⊘ [${i}/${chain.steps.length}] ${chain.steps[i-1].command}` : `✓ [${i}/${chain.steps.length}] ${chain.steps[i-1].command} (${tm}s)` }
    })
    TodoWrite({ todos: final })
    console.log(`\n✓ ${chain.name} completed (${chain.steps.length} steps, ${total}s)`)
  }
  
  return { completed: step, total: chain.steps.length, timings }
}
```

---

## Main Orchestration Entry

```javascript
async function ccwOrchestrate(userInput) {
  console.log('## CCW Orchestrator\n')
  
  // Phase 1: Input Analysis
  const ruleBasedAnalysis = analyzeInput(userInput)
  
  // Handle passthrough commands
  if (ruleBasedAnalysis.passthrough) {
    console.log(`Direct: ${ruleBasedAnalysis.command}`)
    const tracking = trackCommandDispatch(ruleBasedAnalysis.command)
    try {
      const result = SlashCommand(ruleBasedAnalysis.command)
      markCommandResult(tracking, true)
      return result
    } catch (error) {
      markCommandResult(tracking, false, error.message)
      throw error
    }
  }
  
  // Phase 1.5: CLI Classification
  const analysis = await cliAssistedClassification(userInput, ruleBasedAnalysis, intentRules)
  
  // Extract dimensions
  const dimensions = extractDimensions(userInput)
  dimensions.clarity_score = calculateClarityScore(userInput, dimensions)
  dimensions.missing_dimensions = identifyMissing(dimensions)
  
  console.log(`### Classification\n**Source**: ${analysis.source} | **Intent**: ${analysis.intent.type}${analysis.intent.variant ? ` (${analysis.intent.variant})` : ''} | **Complexity**: ${analysis.complexity} | **Clarity**: ${dimensions.clarity_score}/3`)
  
  // Phase 1.75: Clarification
  const { dimensions: refined } = await clarifyRequirement(analysis, dimensions)
  analysis.dimensions = refined
  
  // Phase 2: Chain Selection
  const selectedChain = selectChain(analysis)
  
  // Phase 2.5: CLI Planning
  const { chain: optimizedChain, source: planSource, reasoning, risks } = await cliAssistedPlanning(analysis, selectedChain, intentRules)
  if (planSource?.includes('cli')) console.log(`### Planning\n${reasoning || ''}${risks?.length ? ` | Risks: ${risks.join(', ')}` : ''}`)
  
  // Phase 3: Confirm
  const confirmedChain = confirmChain(optimizedChain, analysis)
  if (!confirmedChain) { console.log('Manual mode. Specify commands directly.'); return }
  
  // Phase 4: Setup TODO
  const execution = setupTodoTracking(confirmedChain, analysis)
  
  // Phase 5: Execute
  return await executeChain(execution, analysis)
}
```

---

## Decision Matrix

| Intent | Complexity | Chain | Steps |
|--------|------------|-------|-------|
| bugfix | * | bugfix | lite-fix |
| issue | * | issue | plan → queue → execute |
| exploration | * | full | brainstorm → plan → execute |
| ui | * | ui | ui-design → sync → plan → execute |
| tdd | * | tdd | tdd-plan → execute → tdd-verify |
| review | * | review-fix | review-session-cycle → review-fix |
| docs | low/medium+ | docs | update-related / docs → execute |
| feature | low/medium/high | rapid/coupled/full | lite-plan / plan → verify / brainstorm |

## Continuation Commands

| Input | Action |
|-------|--------|
| `continue` | Next step |
| `skip` | Skip current |
| `abort` | Stop workflow |
| `/workflow:*` | Specific command |
| Natural language | Re-analyze |
