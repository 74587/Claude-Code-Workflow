# Requirement Analysis Specification

结构化需求分析规范：将用户输入分解为可操作的维度。

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Requirement Analysis Pipeline                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Step 1: Clarity Assessment                                       │
│  ├─ Score: 0-3 (0=模糊, 1=基本, 2=清晰, 3=详细)                   │
│  ├─ Missing dimensions detection                                  │
│  └─ Trigger clarification if score < 2                            │
│                                                                   │
│  Step 2: Dimension Extraction                                     │
│  ├─ WHAT: 要做什么 (功能/修复/优化)                               │
│  ├─ WHERE: 在哪里做 (文件/模块/系统)                              │
│  ├─ WHY: 为什么做 (目标/动机)                                     │
│  ├─ HOW: 怎么做 (约束/偏好)                                       │
│  └─ WHEN: 时间/优先级约束                                         │
│                                                                   │
│  Step 3: Validation                                               │
│  ├─ Check dimension completeness                                  │
│  ├─ Detect conflicts                                              │
│  └─ Generate structured requirement object                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Clarity Scoring

| Score | Level | Description | Action |
|-------|-------|-------------|--------|
| 0 | 模糊 | 无法理解用户意图 | 必须澄清 |
| 1 | 基本 | 知道做什么，缺少细节 | 建议澄清 |
| 2 | 清晰 | 意图和范围明确 | 可直接执行 |
| 3 | 详细 | 所有维度都已指定 | 直接执行 |

### Clarity Indicators

```javascript
const clarityIndicators = {
  // Score +1 for each present
  positive: [
    /具体|specific|明确/i,           // Explicit intent
    /在\s*[\w\/]+\s*(文件|模块|目录)/i, // Location specified
    /使用|用|采用|通过/i,            // Method specified
    /因为|为了|目的是/i,             // Reason given
    /不要|避免|禁止/i,               // Constraints given
  ],
  
  // Score -1 for each present
  negative: [
    /不知道|不确定|maybe|可能/i,     // Uncertainty
    /怎么办|如何|what should/i,     // Seeking guidance
    /帮我|help me/i,                // Generic help
  ]
}
```

## Dimension Schema

```typescript
interface RequirementDimensions {
  // WHAT dimension
  what: {
    action: 'create' | 'fix' | 'refactor' | 'optimize' | 'analyze' | 'review';
    target: string;           // What to act on
    description: string;      // Brief description
  };
  
  // WHERE dimension
  where: {
    scope: 'file' | 'module' | 'system' | 'unknown';
    paths?: string[];         // Specific paths mentioned
    patterns?: string[];      // File patterns mentioned
  };
  
  // WHY dimension
  why: {
    goal?: string;            // End goal
    motivation?: string;      // Why now
    success_criteria?: string; // How to know done
  };
  
  // HOW dimension
  how: {
    constraints?: string[];   // Must/Must not
    preferences?: string[];   // Should/Should not
    approach?: string;        // Suggested approach
  };
  
  // Metadata
  clarity_score: 0 | 1 | 2 | 3;
  missing_dimensions: string[];
  confidence: number;         // 0.0 - 1.0
}
```

## Extraction Rules

### WHAT Extraction

```javascript
const whatPatterns = {
  create: /创建|新增|添加|实现|生成|create|add|implement|generate/i,
  fix: /修复|修正|解决|fix|repair|resolve|debug/i,
  refactor: /重构|优化结构|重写|refactor|restructure|rewrite/i,
  optimize: /优化|提升|改进|性能|optimize|improve|enhance|performance/i,
  analyze: /分析|理解|探索|研究|analyze|understand|explore|research/i,
  review: /审查|检查|评估|review|check|assess|audit/i
}
```

### WHERE Extraction

```javascript
const wherePatterns = {
  file: /(\S+\.(ts|js|py|md|json|yaml|yml))/g,
  module: /(src\/\S+|lib\/\S+|packages\/\S+)/g,
  directory: /(\/[\w\-\.\/]+)/g
}
```

### Constraint Extraction

```javascript
const constraintPatterns = {
  must: /必须|一定要|需要|must|required|need to/i,
  must_not: /不要|禁止|不能|避免|must not|don't|avoid/i,
  should: /应该|最好|建议|should|prefer|recommend/i,
  should_not: /不应该|不建议|尽量不|should not|better not/i
}
```

## Clarification Flow

当 clarity_score < 2 时触发澄清流程：

```javascript
function generateClarificationQuestions(dimensions) {
  const questions = []
  
  if (!dimensions.what.target) {
    questions.push({
      question: "你想要对什么进行操作?",
      header: "目标",
      options: [
        { label: "文件/代码", description: "修改特定文件或代码" },
        { label: "功能/模块", description: "处理整个功能模块" },
        { label: "系统/架构", description: "系统级变更" }
      ]
    })
  }
  
  if (!dimensions.where.paths?.length && dimensions.where.scope === 'unknown') {
    questions.push({
      question: "你想在哪里进行这个操作?",
      header: "位置",
      options: [
        { label: "让我指定", description: "我会提供具体路径" },
        { label: "自动发现", description: "分析代码库后推荐" },
        { label: "全局", description: "整个项目范围" }
      ]
    })
  }
  
  if (!dimensions.why.goal) {
    questions.push({
      question: "这个操作的目标是什么?",
      header: "目标",
      options: [
        { label: "修复问题", description: "解决已知Bug或错误" },
        { label: "新增功能", description: "添加新的能力" },
        { label: "改进质量", description: "提升性能/可维护性" },
        { label: "其他", description: "其他目标" }
      ]
    })
  }
  
  return questions
}
```

## Integration with Orchestrator

```javascript
// In orchestrator.md Phase 1: Input Analysis
function analyzeRequirement(userInput) {
  // Step 1: Extract dimensions
  const dimensions = extractDimensions(userInput)
  
  // Step 2: Calculate clarity score
  dimensions.clarity_score = calculateClarityScore(userInput, dimensions)
  
  // Step 3: Identify missing dimensions
  dimensions.missing_dimensions = identifyMissing(dimensions)
  
  return dimensions
}

// In Phase 1.5: After CLI Classification
function shouldClarify(dimensions, intent) {
  // Clarify if:
  // 1. Clarity score < 2
  // 2. High complexity with missing dimensions
  // 3. Ambiguous intent
  return (
    dimensions.clarity_score < 2 ||
    (intent.complexity === 'high' && dimensions.missing_dimensions.length > 0)
  )
}
```

## Output Format

分析完成后输出结构化需求摘要：

```markdown
### Requirement Analysis

**Input**: [Original user input]

**Dimensions**:
| Dimension | Value | Source |
|-----------|-------|--------|
| WHAT | [action] [target] | extracted/inferred |
| WHERE | [scope]: [paths] | extracted/unknown |
| WHY | [goal] | extracted/missing |
| HOW | [constraints] | extracted/none |

**Clarity**: [score]/3 - [level description]
**Missing**: [list of missing dimensions]
**Action**: [proceed/clarify/confirm]
```
