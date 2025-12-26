# Phase 2: Deep Code Analysis

Launch 6 parallel agents for multi-dimensional code analysis.

## Execution

### Analysis Dimensions

| Agent | Dimension | Analysis Focus | Output Section |
|-------|-----------|----------------|----------------|
| 1 | architecture | 分层、模块、依赖 | Section 2 |
| 2 | functions | 功能、工作流、交互 | Section 3 |
| 3 | algorithms | 核心逻辑、复杂度、流程 | Section 4 |
| 4 | data_structures | 实体、属性、关系 | Section 5 |
| 5 | interfaces | API、参数、响应 | Section 6 |
| 6 | exceptions | 错误类型、处理、恢复 | Section 7 |

### Agent Prompts

**Architecture Analysis:**
```javascript
Task({
  subagent_type: "cli-explore-agent",
  prompt: `
## 分析目标
分析项目的系统架构，为"系统架构图"章节提供数据。

## 分析内容
1. 分层结构：识别代码的分层（Controller/Service/Repository）
2. 模块边界：各模块的职责范围和边界
3. 依赖关系：模块间的依赖方向和类型
4. 核心组件：系统的核心组件及其作用
5. 数据流向：数据在各层之间的流动路径

## 输出格式
{
  "layers": [{name, components, responsibility}],
  "modules": [{name, path, responsibility, dependencies}],
  "data_flow": [{from, to, data_type, description}],
  "core_components": [{name, type, responsibility}]
}
`
})
```

**Function Analysis:**
```javascript
prompt = `
## 分析目标
分析项目的功能模块，为"功能模块设计"章节提供数据。

## 输出格式
{
  "feature_list": [{id, name, description, module, entry_file}],
  "feature_groups": [{group_name, features: []}],
  "feature_hierarchy": {root: {children: [...]}},
  "interactions": [{caller, callee, trigger, description}],
  "key_workflows": [{name, steps: [], files_involved}]
}
`
```

**Algorithm Analysis:**
```javascript
prompt = `
## 分析目标
分析项目的核心算法和业务逻辑，为"核心算法与流程"章节提供数据。

## 输出格式
{
  "algorithms": [{
    name, file, line, description, complexity,
    inputs: [{name, type, description}],
    outputs: [{name, type, description}],
    steps: [{step_num, description, type, next, conditions}]
  }],
  "complex_functions": [{name, file, cyclomatic_complexity}]
}
`
```

**Data Structure Analysis:**
```javascript
prompt = `
## 分析目标
分析项目的数据结构，为"数据结构设计"章节提供数据。

## 输出格式
{
  "entities": [{
    name, file, type,
    properties: [{name, type, visibility, description}],
    methods: [{name, params, return_type, visibility}]
  }],
  "relationships": [{from, to, type, cardinality, description}],
  "enums": [{name, values: [{name, value, description}]}]
}
`
```

**Interface Analysis:**
```javascript
prompt = `
## 分析目标
分析项目的接口设计，为"接口设计"章节提供数据。

## 输出格式
{
  "apis": [{
    name, path, method, description,
    parameters: [{name, type, required, description}],
    response: {type, schema, description},
    category
  }],
  "protocols": [{name, type, description}]
}
`
```

**Exception Analysis:**
```javascript
prompt = `
## 分析目标
分析项目的异常处理机制，为"异常处理设计"章节提供数据。

## 输出格式
{
  "exception_types": [{name, parent, code, message, file}],
  "error_codes": [{code, message, severity, category}],
  "handling_patterns": [{pattern, locations: [], description}],
  "recovery_strategies": [{strategy, trigger, action, files}]
}
`
```

## Output

Save each analysis to `analysis-{dimension}.json`.
