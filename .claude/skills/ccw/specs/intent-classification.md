# Intent Classification Specification

CCW 意图分类规范：定义如何从用户输入识别任务意图并选择最优工作流。

## Classification Hierarchy

```
Intent Classification
├── Priority 1: Explicit Commands
│   └── /workflow:*, /issue:*, /memory:*, /task:*
├── Priority 2: Bug Keywords
│   ├── Hotfix: urgent + bug keywords
│   └── Standard: bug keywords only
├── Priority 3: Issue Batch
│   └── Multiple + fix keywords
├── Priority 4: Exploration
│   └── Uncertainty keywords
├── Priority 5: UI/Design
│   └── Visual/component keywords
└── Priority 6: Complexity Fallback
    ├── High → Coupled
    ├── Medium → Rapid
    └── Low → Rapid
```

## Keyword Patterns

### Bug Detection

```javascript
const BUG_PATTERNS = {
  core: /\b(fix|bug|error|issue|crash|broken|fail|wrong|incorrect|修复|报错|错误|问题|异常|崩溃|失败)\b/i,
  
  urgency: /\b(hotfix|urgent|production|critical|emergency|asap|immediately|紧急|生产|线上|马上|立即)\b/i,
  
  symptoms: /\b(not working|doesn't work|can't|cannot|won't|stopped|stopped working|无法|不能|不工作)\b/i,
  
  errors: /\b(\d{3}\s*error|exception|stack\s*trace|undefined|null\s*pointer|timeout)\b/i
}

function detectBug(text) {
  const isBug = BUG_PATTERNS.core.test(text) || BUG_PATTERNS.symptoms.test(text)
  const isUrgent = BUG_PATTERNS.urgency.test(text)
  const hasError = BUG_PATTERNS.errors.test(text)
  
  if (!isBug && !hasError) return null
  
  return {
    type: 'bugfix',
    mode: isUrgent ? 'hotfix' : 'standard',
    confidence: (isBug && hasError) ? 'high' : 'medium'
  }
}
```

### Issue Batch Detection

```javascript
const ISSUE_PATTERNS = {
  batch: /\b(issues?|batch|queue|multiple|several|all|多个|批量|一系列|所有|这些)\b/i,
  action: /\b(fix|resolve|handle|process|处理|解决|修复)\b/i,
  source: /\b(github|jira|linear|backlog|todo|待办)\b/i
}

function detectIssueBatch(text) {
  const hasBatch = ISSUE_PATTERNS.batch.test(text)
  const hasAction = ISSUE_PATTERNS.action.test(text)
  const hasSource = ISSUE_PATTERNS.source.test(text)
  
  if (hasBatch && hasAction) {
    return {
      type: 'issue',
      confidence: hasSource ? 'high' : 'medium'
    }
  }
  return null
}
```

### Exploration Detection

```javascript
const EXPLORATION_PATTERNS = {
  uncertainty: /\b(不确定|不知道|not sure|unsure|how to|怎么|如何|what if|should i|could i|是否应该)\b/i,
  
  exploration: /\b(explore|research|investigate|分析|研究|调研|评估|探索|了解)\b/i,
  
  options: /\b(options|alternatives|approaches|方案|选择|方向|可能性)\b/i,
  
  questions: /\b(what|which|how|why|什么|哪个|怎样|为什么)\b.*\?/i
}

function detectExploration(text) {
  const hasUncertainty = EXPLORATION_PATTERNS.uncertainty.test(text)
  const hasExploration = EXPLORATION_PATTERNS.exploration.test(text)
  const hasOptions = EXPLORATION_PATTERNS.options.test(text)
  const hasQuestion = EXPLORATION_PATTERNS.questions.test(text)
  
  const score = [hasUncertainty, hasExploration, hasOptions, hasQuestion].filter(Boolean).length
  
  if (score >= 2 || hasUncertainty) {
    return {
      type: 'exploration',
      confidence: score >= 3 ? 'high' : 'medium'
    }
  }
  return null
}
```

### UI/Design Detection

```javascript
const UI_PATTERNS = {
  components: /\b(ui|界面|component|组件|button|按钮|form|表单|modal|弹窗|dialog|对话框)\b/i,
  
  design: /\b(design|设计|style|样式|layout|布局|theme|主题|color|颜色)\b/i,
  
  visual: /\b(visual|视觉|animation|动画|responsive|响应式|mobile|移动端)\b/i,
  
  frontend: /\b(frontend|前端|react|vue|angular|css|html|page|页面)\b/i
}

function detectUI(text) {
  const hasComponents = UI_PATTERNS.components.test(text)
  const hasDesign = UI_PATTERNS.design.test(text)
  const hasVisual = UI_PATTERNS.visual.test(text)
  const hasFrontend = UI_PATTERNS.frontend.test(text)
  
  const score = [hasComponents, hasDesign, hasVisual, hasFrontend].filter(Boolean).length
  
  if (score >= 2) {
    return {
      type: 'ui',
      hasReference: /参考|reference|based on|像|like|模仿|imitate/.test(text),
      confidence: score >= 3 ? 'high' : 'medium'
    }
  }
  return null
}
```

## Complexity Assessment

### Indicators

```javascript
const COMPLEXITY_INDICATORS = {
  high: {
    patterns: [
      /\b(refactor|重构|restructure|重新组织)\b/i,
      /\b(migrate|迁移|upgrade|升级|convert|转换)\b/i,
      /\b(architect|架构|system|系统|infrastructure|基础设施)\b/i,
      /\b(entire|整个|complete|完整|all\s+modules?|所有模块)\b/i,
      /\b(security|安全|scale|扩展|performance\s+critical|性能关键)\b/i,
      /\b(distributed|分布式|microservice|微服务|cluster|集群)\b/i
    ],
    weight: 2
  },
  
  medium: {
    patterns: [
      /\b(integrate|集成|connect|连接|link|链接)\b/i,
      /\b(api|database|数据库|service|服务|endpoint|接口)\b/i,
      /\b(test|测试|validate|验证|coverage|覆盖)\b/i,
      /\b(multiple\s+files?|多个文件|several\s+components?|几个组件)\b/i,
      /\b(authentication|认证|authorization|授权)\b/i
    ],
    weight: 1
  },
  
  low: {
    patterns: [
      /\b(add|添加|create|创建|simple|简单)\b/i,
      /\b(update|更新|modify|修改|change|改变)\b/i,
      /\b(single|单个|one|一个|small|小)\b/i,
      /\b(comment|注释|log|日志|print|打印)\b/i
    ],
    weight: -1
  }
}

function assessComplexity(text) {
  let score = 0
  
  for (const [level, config] of Object.entries(COMPLEXITY_INDICATORS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(text)) {
        score += config.weight
      }
    }
  }
  
  // File count indicator
  const fileMatches = text.match(/\b\d+\s*(files?|文件)/i)
  if (fileMatches) {
    const count = parseInt(fileMatches[0])
    if (count > 10) score += 2
    else if (count > 5) score += 1
  }
  
  // Module count indicator
  const moduleMatches = text.match(/\b\d+\s*(modules?|模块)/i)
  if (moduleMatches) {
    const count = parseInt(moduleMatches[0])
    if (count > 3) score += 2
    else if (count > 1) score += 1
  }
  
  if (score >= 4) return 'high'
  if (score >= 2) return 'medium'
  return 'low'
}
```

## Workflow Selection Matrix

| Intent | Complexity | Workflow | Commands |
|--------|------------|----------|----------|
| bugfix (hotfix) | * | bugfix | `lite-fix --hotfix` |
| bugfix (standard) | * | bugfix | `lite-fix` |
| issue | * | issue | `issue:plan → queue → execute` |
| exploration | * | full | `brainstorm → plan → execute` |
| ui (reference) | * | ui | `ui-design:imitate-auto → plan` |
| ui (explore) | * | ui | `ui-design:explore-auto → plan` |
| feature | high | coupled | `plan → verify → execute` |
| feature | medium | rapid | `lite-plan → lite-execute` |
| feature | low | rapid | `lite-plan → lite-execute` |

## Confidence Levels

| Level | Description | Action |
|-------|-------------|--------|
| **high** | Multiple strong indicators match | Direct dispatch |
| **medium** | Some indicators match | Confirm with user |
| **low** | Fallback classification | Always confirm |

## Tool Preference Detection

```javascript
const TOOL_PREFERENCES = {
  gemini: {
    pattern: /用\s*gemini|gemini\s*(分析|理解|设计)|让\s*gemini/i,
    capability: 'analysis'
  },
  qwen: {
    pattern: /用\s*qwen|qwen\s*(分析|评估)|让\s*qwen/i,
    capability: 'analysis'
  },
  codex: {
    pattern: /用\s*codex|codex\s*(实现|重构|修复)|让\s*codex/i,
    capability: 'implementation'
  }
}

function detectToolPreference(text) {
  for (const [tool, config] of Object.entries(TOOL_PREFERENCES)) {
    if (config.pattern.test(text)) {
      return { tool, capability: config.capability }
    }
  }
  return null
}
```

## Multi-Tool Collaboration Detection

```javascript
const COLLABORATION_PATTERNS = {
  sequential: /先.*(分析|理解).*然后.*(实现|重构)|分析.*后.*实现/i,
  parallel: /(同时|并行).*(分析|实现)|一边.*一边/i,
  hybrid: /(分析|设计).*和.*(实现|测试).*分开/i
}

function detectCollaboration(text) {
  if (COLLABORATION_PATTERNS.sequential.test(text)) {
    return { mode: 'sequential', description: 'Analysis first, then implementation' }
  }
  if (COLLABORATION_PATTERNS.parallel.test(text)) {
    return { mode: 'parallel', description: 'Concurrent analysis and implementation' }
  }
  if (COLLABORATION_PATTERNS.hybrid.test(text)) {
    return { mode: 'hybrid', description: 'Mixed parallel and sequential' }
  }
  return null
}
```

## Classification Pipeline

```javascript
function classify(userInput) {
  const text = userInput.trim()
  
  // Step 1: Check explicit commands
  if (/^\/(?:workflow|issue|memory|task):/.test(text)) {
    return { type: 'explicit', command: text }
  }
  
  // Step 2: Priority-based classification
  const bugResult = detectBug(text)
  if (bugResult) return bugResult
  
  const issueResult = detectIssueBatch(text)
  if (issueResult) return issueResult
  
  const explorationResult = detectExploration(text)
  if (explorationResult) return explorationResult
  
  const uiResult = detectUI(text)
  if (uiResult) return uiResult
  
  // Step 3: Complexity-based fallback
  const complexity = assessComplexity(text)
  return {
    type: 'feature',
    complexity,
    workflow: complexity === 'high' ? 'coupled' : 'rapid',
    confidence: 'low'
  }
}
```

## Examples

### Input → Classification

| Input | Classification | Workflow |
|-------|----------------|----------|
| "用户登录失败，401错误" | bugfix/standard | lite-fix |
| "紧急：支付网关挂了" | bugfix/hotfix | lite-fix --hotfix |
| "批量处理这些 GitHub issues" | issue | issue:plan → queue |
| "不确定要怎么设计缓存系统" | exploration | brainstorm → plan |
| "添加一个深色模式切换按钮" | ui | ui-design → plan |
| "重构整个认证模块" | feature/high | plan → verify |
| "添加用户头像功能" | feature/low | lite-plan |
