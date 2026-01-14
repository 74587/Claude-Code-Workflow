# Action: Analyze Requirements

将用户问题描述拆解为多个分析维度，匹配 Spec，评估覆盖度，检测歧义。

## Purpose

- 将单一用户描述拆解为多个独立关注维度
- 为每个维度匹配 problem-taxonomy（检测）+ tuning-strategies（修复）
- 以"有修复策略"为标准判断是否满足需求
- 检测歧义并在必要时请求用户澄清

## Preconditions

- [ ] `state.status === 'running'`
- [ ] `state.target_skill !== null`
- [ ] `state.completed_actions.includes('action-init')`
- [ ] `!state.completed_actions.includes('action-analyze-requirements')`

## Execution

### Phase 1: 维度拆解 (Gemini CLI)

调用 Gemini 对用户描述进行语义分析，拆解为独立维度：

```javascript
async function analyzeDimensions(state, workDir) {
  const prompt = `
PURPOSE: 分析用户问题描述，拆解为独立的关注维度
TASK:
• 识别用户描述中的多个关注点（每个关注点应该是独立的、可单独分析的）
• 为每个关注点提取关键词（中英文均可）
• 推断可能的问题类别：
  - context_explosion: 上下文/Token 相关
  - memory_loss: 遗忘/约束丢失相关
  - dataflow_break: 状态/数据流相关
  - agent_failure: Agent/子任务相关
  - prompt_quality: 提示词/输出质量相关
  - architecture: 架构/结构相关
  - performance: 性能/效率相关
  - error_handling: 错误/异常处理相关
  - output_quality: 输出质量/验证相关
  - user_experience: 交互/体验相关
• 评估推断置信度 (0-1)

INPUT:
User description: ${state.user_issue_description}
Target skill: ${state.target_skill.name}
Skill structure: ${JSON.stringify(state.target_skill.phases)}

MODE: analysis
CONTEXT: @specs/problem-taxonomy.md @specs/dimension-mapping.md
EXPECTED: JSON (不要包含 markdown 代码块标记)
{
  "dimensions": [
    {
      "id": "DIM-001",
      "description": "关注点的简短描述",
      "keywords": ["关键词1", "关键词2"],
      "inferred_category": "问题类别",
      "confidence": 0.85,
      "reasoning": "推断理由"
    }
  ],
  "analysis_notes": "整体分析说明"
}
RULES: 
- 每个维度必须独立，不重叠
- 低于 0.5 置信度的推断应标注需要澄清
- 如果用户描述非常模糊，至少提取一个 "general" 维度
`;

  const cliCommand = `ccw cli -p "${escapeForShell(prompt)}" --tool gemini --mode analysis --cd "${state.target_skill.path}"`;
  
  console.log('Phase 1: 执行 Gemini 维度拆解分析...');
  
  const result = Bash({
    command: cliCommand,
    run_in_background: true,
    timeout: 300000
  });
  
  return result;
}
```

### Phase 2: Spec 匹配

基于 `specs/dimension-mapping.md` 规则为每个维度匹配检测模式和修复策略：

```javascript
function matchSpecs(dimensions) {
  // 加载映射规则
  const mappingRules = loadMappingRules();
  
  return dimensions.map(dim => {
    // 匹配 taxonomy pattern
    const taxonomyMatch = findTaxonomyMatch(dim.inferred_category, mappingRules);
    
    // 匹配 strategy
    const strategyMatch = findStrategyMatch(dim.inferred_category, mappingRules);
    
    // 判断是否满足（核心标准：有修复策略）
    const hasFix = strategyMatch !== null && strategyMatch.strategies.length > 0;
    
    return {
      dimension_id: dim.id,
      taxonomy_match: taxonomyMatch,
      strategy_match: strategyMatch,
      has_fix: hasFix,
      needs_gemini_analysis: taxonomyMatch === null  // 无内置检测时需要 Gemini 深度分析
    };
  });
}

function findTaxonomyMatch(category, rules) {
  const patternMapping = {
    'context_explosion': { category: 'context_explosion', pattern_ids: ['CTX-001', 'CTX-002', 'CTX-003', 'CTX-004', 'CTX-005'], severity_hint: 'high' },
    'memory_loss': { category: 'memory_loss', pattern_ids: ['MEM-001', 'MEM-002', 'MEM-003', 'MEM-004', 'MEM-005'], severity_hint: 'high' },
    'dataflow_break': { category: 'dataflow_break', pattern_ids: ['DF-001', 'DF-002', 'DF-003', 'DF-004', 'DF-005'], severity_hint: 'critical' },
    'agent_failure': { category: 'agent_failure', pattern_ids: ['AGT-001', 'AGT-002', 'AGT-003', 'AGT-004', 'AGT-005', 'AGT-006'], severity_hint: 'high' },
    'performance': { category: 'performance', pattern_ids: ['CTX-001', 'CTX-003'], severity_hint: 'medium' },
    'error_handling': { category: 'error_handling', pattern_ids: ['AGT-001', 'AGT-002'], severity_hint: 'medium' }
  };
  
  return patternMapping[category] || null;
}

function findStrategyMatch(category, rules) {
  const strategyMapping = {
    'context_explosion': { strategies: ['sliding_window', 'path_reference', 'context_summarization', 'structured_state'], risk_levels: ['low', 'low', 'low', 'medium'] },
    'memory_loss': { strategies: ['constraint_injection', 'state_constraints_field', 'checkpoint_restore', 'goal_embedding'], risk_levels: ['low', 'low', 'low', 'medium'] },
    'dataflow_break': { strategies: ['state_centralization', 'schema_enforcement', 'field_normalization'], risk_levels: ['medium', 'low', 'low'] },
    'agent_failure': { strategies: ['error_wrapping', 'result_validation', 'flatten_nesting'], risk_levels: ['low', 'low', 'medium'] },
    'prompt_quality': { strategies: ['structured_prompt', 'output_schema', 'grounding_context', 'format_enforcement'], risk_levels: ['low', 'low', 'medium', 'low'] },
    'architecture': { strategies: ['phase_decomposition', 'interface_contracts', 'plugin_architecture'], risk_levels: ['medium', 'medium', 'high'] },
    'performance': { strategies: ['token_budgeting', 'parallel_execution', 'result_caching', 'lazy_loading'], risk_levels: ['low', 'low', 'low', 'low'] },
    'error_handling': { strategies: ['graceful_degradation', 'error_propagation', 'structured_logging'], risk_levels: ['low', 'low', 'low'] },
    'output_quality': { strategies: ['quality_gates', 'output_validation', 'template_enforcement'], risk_levels: ['low', 'low', 'low'] },
    'user_experience': { strategies: ['progress_tracking', 'status_communication', 'interactive_checkpoints'], risk_levels: ['low', 'low', 'low'] }
  };
  
  // Fallback to custom
  return strategyMapping[category] || { strategies: ['custom'], risk_levels: ['medium'] };
}
```

### Phase 3: 覆盖度评估

评估所有维度的 Spec 覆盖情况：

```javascript
function evaluateCoverage(specMatches) {
  const total = specMatches.length;
  const withDetection = specMatches.filter(m => m.taxonomy_match !== null).length;
  const withFix = specMatches.filter(m => m.has_fix).length;
  
  const rate = total > 0 ? Math.round((withFix / total) * 100) : 0;
  
  let status;
  if (rate >= 80) {
    status = 'satisfied';
  } else if (rate >= 50) {
    status = 'partial';
  } else {
    status = 'unsatisfied';
  }
  
  return {
    total_dimensions: total,
    with_detection: withDetection,
    with_fix_strategy: withFix,
    coverage_rate: rate,
    status: status
  };
}
```

### Phase 4: 歧义检测

识别需要用户澄清的歧义点：

```javascript
function detectAmbiguities(dimensions, specMatches) {
  const ambiguities = [];
  
  for (const dim of dimensions) {
    const match = specMatches.find(m => m.dimension_id === dim.id);
    
    // 检测1: 低置信度 (< 0.5)
    if (dim.confidence < 0.5) {
      ambiguities.push({
        dimension_id: dim.id,
        type: 'vague_description',
        description: `维度 "${dim.description}" 描述模糊，推断置信度低 (${dim.confidence})`,
        possible_interpretations: suggestInterpretations(dim),
        needs_clarification: true
      });
    }
    
    // 检测2: 无匹配类别
    if (!match || (!match.taxonomy_match && !match.strategy_match)) {
      ambiguities.push({
        dimension_id: dim.id,
        type: 'no_category_match',
        description: `维度 "${dim.description}" 无法匹配到已知问题类别`,
        possible_interpretations: ['custom'],
        needs_clarification: true
      });
    }
    
    // 检测3: 关键词冲突（可能属于多个类别）
    if (dim.keywords.length > 3 && hasConflictingKeywords(dim.keywords)) {
      ambiguities.push({
        dimension_id: dim.id,
        type: 'conflicting_keywords',
        description: `维度 "${dim.description}" 的关键词可能指向多个不同问题`,
        possible_interpretations: inferMultipleCategories(dim.keywords),
        needs_clarification: true
      });
    }
  }
  
  return ambiguities;
}

function suggestInterpretations(dim) {
  // 基于关键词推荐可能的解释
  const categories = [
    'context_explosion', 'memory_loss', 'dataflow_break', 'agent_failure',
    'prompt_quality', 'architecture', 'performance', 'error_handling'
  ];
  return categories.slice(0, 4);  // 返回最常见的 4 个作为选项
}

function hasConflictingKeywords(keywords) {
  // 检查关键词是否指向不同方向
  const categoryHints = keywords.map(k => getKeywordCategoryHint(k));
  const uniqueCategories = [...new Set(categoryHints.filter(c => c))];
  return uniqueCategories.length > 1;
}

function getKeywordCategoryHint(keyword) {
  const keywordMap = {
    '慢': 'performance', 'slow': 'performance',
    '遗忘': 'memory_loss', 'forget': 'memory_loss',
    '状态': 'dataflow_break', 'state': 'dataflow_break',
    'agent': 'agent_failure', '失败': 'agent_failure',
    'token': 'context_explosion', '上下文': 'context_explosion'
  };
  return keywordMap[keyword.toLowerCase()];
}
```

## User Interaction

如果检测到需要澄清的歧义，暂停并询问用户：

```javascript
async function handleAmbiguities(ambiguities, dimensions) {
  const needsClarification = ambiguities.filter(a => a.needs_clarification);
  
  if (needsClarification.length === 0) {
    return null;  // 无需澄清
  }
  
  const questions = needsClarification.slice(0, 4).map(a => {
    const dim = dimensions.find(d => d.id === a.dimension_id);
    
    return {
      question: `关于 "${dim.description}"，您具体指的是？`,
      header: a.dimension_id,
      options: a.possible_interpretations.map(interp => ({
        label: getCategoryLabel(interp),
        description: getCategoryDescription(interp)
      })),
      multiSelect: false
    };
  });
  
  return await AskUserQuestion({ questions });
}

function getCategoryLabel(category) {
  const labels = {
    'context_explosion': '上下文膨胀',
    'memory_loss': '指令遗忘',
    'dataflow_break': '数据流问题',
    'agent_failure': 'Agent 协调问题',
    'prompt_quality': '提示词质量',
    'architecture': '架构问题',
    'performance': '性能问题',
    'error_handling': '错误处理',
    'custom': '其他问题'
  };
  return labels[category] || category;
}

function getCategoryDescription(category) {
  const descriptions = {
    'context_explosion': 'Token 累积导致上下文过大',
    'memory_loss': '早期指令或约束在后期丢失',
    'dataflow_break': '状态数据在阶段间不一致',
    'agent_failure': '子 Agent 调用失败或结果异常',
    'prompt_quality': '提示词模糊导致输出不稳定',
    'architecture': '阶段划分或模块结构不合理',
    'performance': '执行慢或 Token 消耗高',
    'error_handling': '错误恢复机制不完善',
    'custom': '需要自定义分析的问题'
  };
  return descriptions[category] || '需要进一步分析';
}
```

## Output

### State Updates

```javascript
return {
  stateUpdates: {
    requirement_analysis: {
      status: ambiguities.some(a => a.needs_clarification) ? 'needs_clarification' : 'completed',
      analyzed_at: new Date().toISOString(),
      dimensions: dimensions,
      spec_matches: specMatches,
      coverage: coverageResult,
      ambiguities: ambiguities
    },
    // 根据分析结果自动优化 focus_areas
    focus_areas: deriveOptimalFocusAreas(specMatches)
  },
  outputFiles: [
    `${workDir}/requirement-analysis.json`,
    `${workDir}/requirement-analysis.md`
  ],
  summary: generateSummary(dimensions, coverageResult, ambiguities)
};

function deriveOptimalFocusAreas(specMatches) {
  const coreCategories = ['context', 'memory', 'dataflow', 'agent'];
  const matched = specMatches
    .filter(m => m.taxonomy_match !== null)
    .map(m => {
      // 映射到诊断 focus_area
      const category = m.taxonomy_match.category;
      if (category === 'context_explosion' || category === 'performance') return 'context';
      if (category === 'memory_loss') return 'memory';
      if (category === 'dataflow_break') return 'dataflow';
      if (category === 'agent_failure' || category === 'error_handling') return 'agent';
      return null;
    })
    .filter(f => f && coreCategories.includes(f));
  
  // 去重
  return [...new Set(matched)];
}

function generateSummary(dimensions, coverage, ambiguities) {
  const dimCount = dimensions.length;
  const coverageStatus = coverage.status;
  const ambiguityCount = ambiguities.filter(a => a.needs_clarification).length;
  
  let summary = `分析完成：${dimCount} 个维度`;
  summary += `，覆盖度 ${coverage.coverage_rate}% (${coverageStatus})`;
  
  if (ambiguityCount > 0) {
    summary += `，${ambiguityCount} 个歧义点待澄清`;
  }
  
  return summary;
}
```

### Output Files

#### requirement-analysis.json

```json
{
  "timestamp": "2024-01-01T00:00:00Z",
  "target_skill": "skill-name",
  "user_description": "原始用户描述",
  "dimensions": [...],
  "spec_matches": [...],
  "coverage": {...},
  "ambiguities": [...],
  "derived_focus_areas": [...]
}
```

#### requirement-analysis.md

```markdown
# 需求分析报告

## 用户描述
> ${user_issue_description}

## 维度拆解

| ID | 描述 | 类别 | 置信度 |
|----|------|------|--------|
| DIM-001 | ... | ... | 0.85 |

## Spec 匹配

| 维度 | 检测模式 | 修复策略 | 是否满足 |
|------|----------|----------|----------|
| DIM-001 | CTX-001,002 | sliding_window | ✓ |

## 覆盖度评估

- 总维度数: N
- 有检测手段: M
- 有修复策略: K (满足标准)
- 覆盖率: X%
- 状态: satisfied/partial/unsatisfied

## 歧义点

(如有)
```

## Error Handling

| Error | Recovery |
|-------|----------|
| Gemini CLI 超时 | 重试一次，仍失败则使用简化分析 |
| JSON 解析失败 | 尝试修复 JSON 或使用默认维度 |
| 无法匹配任何类别 | 全部归类为 custom，触发 Gemini 深度分析 |

## Next Actions

- 如果 `requirement_analysis.status === 'completed'`: 继续到 `action-diagnose-*`
- 如果 `requirement_analysis.status === 'needs_clarification'`: 等待用户澄清后重新执行
- 如果 `coverage.status === 'unsatisfied'`: 自动触发 `action-gemini-analysis` 进行深度分析
