# Implementation Details

Detailed implementation logic for command-guide skill operation modes.

## Architecture Overview

```
User Query
    ↓
Intent Recognition
    ↓
Mode Selection (1 of 5)
    ↓
Index/File Query
    ↓
Response Formation
    ↓
User Output + Recommendations
```

---

## Intent Recognition

### Step 1: Parse User Input

Analyze query for trigger keywords and patterns:

```javascript
function recognizeIntent(userQuery) {
  const query = userQuery.toLowerCase();

  // Mode 5: Issue Reporting (highest priority)
  if (query.includes('ccw-issue') || query.includes('ccw-help') ||
      query.match(/报告.*bug/) || query.includes('功能建议')) {
    return 'ISSUE_REPORTING';
  }

  // Mode 1: Command Search
  if (query.includes('搜索') || query.includes('find') ||
      query.includes('search') || query.match(/.*相关.*命令/)) {
    return 'COMMAND_SEARCH';
  }

  // Mode 2: Recommendations
  if (query.includes('下一步') || query.includes("what's next") ||
      query.includes('推荐') || query.match(/after.*\/\w+:\w+/)) {
    return 'RECOMMENDATIONS';
  }

  // Mode 3: Documentation
  if (query.includes('参数') || query.includes('怎么用') ||
      query.includes('如何使用') || query.match(/\/\w+:\w+.*详情/)) {
    return 'DOCUMENTATION';
  }

  // Mode 4: Onboarding
  if (query.includes('新手') || query.includes('入门') ||
      query.includes('getting started') || query.includes('常用命令')) {
    return 'ONBOARDING';
  }

  // Default: Ask for clarification
  return 'CLARIFY';
}
```

---

## Mode 1: Command Search 🔍

### Trigger Analysis

**Keywords**: 搜索, find, search, [topic] 相关命令

**Examples**:
- "搜索 planning 命令"
- "find commands for testing"
- "实现相关的命令有哪些"

### Processing Flow

```
1. Extract Search Parameters
   ↓
2. Determine Search Type
   ├─ Keyword Search (in name/description)
   ├─ Category Search (workflow/cli/memory/task)
   └─ Use-Case Search (planning/implementation/testing)
   ↓
3. Query Appropriate Index
   ├─ Keyword → all-commands.json
   ├─ Category → by-category.json
   └─ Use-Case → by-use-case.json
   ↓
4. Filter and Rank Results
   ↓
5. Format Response
   ├─ List matching commands
   ├─ Show key metadata (name, description, args)
   └─ Suggest related commands
```

### Implementation

```javascript
async function searchCommands(query, searchType) {
  let results = [];

  switch (searchType) {
    case 'keyword':
      // Load all-commands.json
      const allCommands = await readIndex('all-commands.json');
      results = allCommands.filter(cmd =>
        cmd.name.toLowerCase().includes(query.toLowerCase()) ||
        cmd.description.toLowerCase().includes(query.toLowerCase())
      );
      break;

    case 'category':
      // Load by-category.json
      const byCategory = await readIndex('by-category.json');
      const category = extractCategory(query); // e.g., "workflow"
      results = flattenCategory(byCategory[category]);
      break;

    case 'use-case':
      // Load by-use-case.json
      const byUseCase = await readIndex('by-use-case.json');
      const useCase = extractUseCase(query); // e.g., "planning"
      results = byUseCase[useCase] || [];
      break;
  }

  // Rank by relevance
  results = rankResults(results, query);

  // Add related commands
  results = await enrichWithRelated(results);

  return results;
}
```

---

## Mode 2: Smart Recommendations 🤖

### Trigger Analysis

**Keywords**: 下一步, what's next, 推荐, after [command]

**Examples**:
- "执行完 /workflow:plan 后做什么？"
- "What's next after planning?"
- "推荐下一个命令"

### Processing Flow

```
1. Extract Context
   ├─ Current/Last Command
   ├─ Workflow State
   └─ User's Current Task
   ↓
2. Query Relationships
   └─ Load command-relationships.json
   ↓
3. Find Next Steps
   ├─ Check next_steps array
   ├─ Consider prerequisites
   └─ Check related_commands
   ↓
4. Generate Recommendations
   ├─ Primary recommendation (most common next step)
   ├─ Alternative options
   └─ Rationale for each
   ↓
5. Add Workflow Context
   └─ Link to workflow-patterns.md
```

### Implementation

```javascript
async function getRecommendations(currentCommand) {
  // Load relationships
  const relationships = await readIndex('command-relationships.json');

  // Get relationship data
  const cmdData = relationships[currentCommand];

  if (!cmdData) {
    return defaultRecommendations();
  }

  // Primary next steps
  const nextSteps = cmdData.next_steps || [];

  // Alternative related commands
  const alternatives = cmdData.related_commands || [];

  // Build recommendations
  const recommendations = {
    primary: await enrichCommand(nextSteps[0]),
    alternatives: await enrichCommands(alternatives),
    workflow_pattern: findWorkflowPattern(currentCommand),
    rationale: generateRationale(currentCommand, nextSteps[0])
  };

  return recommendations;
}
```

---

## Mode 3: Full Documentation 📖

### Trigger Analysis

**Keywords**: 参数, 怎么用, 如何使用, [command] 详情

**Examples**:
- "/workflow:plan 的参数是什么？"
- "如何使用 /cli:execute？"
- "task:create 详细文档"

### Processing Flow

```
1. Extract Command Name
   └─ Parse /workflow:plan or workflow:plan
   ↓
2. Locate in Index
   └─ Search all-commands.json
   ↓
3. Read Full Command File
   └─ Use file_path from index
   ↓
4. Extract Documentation
   ├─ Parameters section
   ├─ Arguments specification
   ├─ Examples section
   └─ Best practices
   ↓
5. Format Response
   ├─ Command overview
   ├─ Full parameter list
   ├─ Usage examples
   └─ Related commands
```

### Implementation

```javascript
async function getDocumentation(commandName) {
  // Normalize command name
  const normalized = normalizeCommandName(commandName);

  // Find in index
  const allCommands = await readIndex('all-commands.json');
  const command = allCommands.find(cmd => cmd.name === normalized);

  if (!command) {
    return { error: 'Command not found' };
  }

  // Read full command file
  const commandFilePath = path.join(
    '../commands',
    command.file_path
  );
  const fullDoc = await readCommandFile(commandFilePath);

  // Parse sections
  const documentation = {
    name: command.name,
    description: command.description,
    arguments: command.arguments,
    difficulty: command.difficulty,
    usage_scenario: command.usage_scenario,
    parameters: extractSection(fullDoc, '## Parameters'),
    examples: extractSection(fullDoc, '## Examples'),
    best_practices: extractSection(fullDoc, '## Best Practices'),
    related: await getRelatedCommands(command.name)
  };

  return documentation;
}
```

---

## Mode 4: Beginner Onboarding 🎓

### Trigger Analysis

**Keywords**: 新手, 入门, getting started, 常用命令, 如何开始

**Examples**:
- "我是新手，如何开始？"
- "getting started with workflows"
- "最常用的命令有哪些？"

### Processing Flow

```
1. Assess User Level
   └─ Identify as beginner
   ↓
2. Load Essential Commands
   └─ Read essential-commands.json
   ↓
3. Build Learning Path
   ├─ Step 1: Core commands (Top 5)
   ├─ Step 2: Basic workflow
   ├─ Step 3: Intermediate commands
   └─ Step 4: Advanced features
   ↓
4. Provide Resources
   ├─ Link to getting-started.md
   ├─ Link to workflow-patterns.md
   └─ Suggest first task
   ↓
5. Interactive Guidance
   └─ Offer to walk through first workflow
```

### Implementation

```javascript
async function onboardBeginner() {
  // Load essential commands
  const essentialCommands = await readIndex('essential-commands.json');

  // Group by difficulty
  const beginner = essentialCommands.filter(cmd =>
    cmd.difficulty === 'Beginner' || cmd.difficulty === 'Intermediate'
  );

  // Create learning path
  const learningPath = {
    step1: {
      title: 'Core Commands (Start Here)',
      commands: beginner.slice(0, 5),
      guide: 'guides/getting-started.md'
    },
    step2: {
      title: 'Your First Workflow',
      pattern: 'Plan → Execute',
      commands: ['workflow:plan', 'workflow:execute'],
      guide: 'guides/workflow-patterns.md#basic-workflow'
    },
    step3: {
      title: 'Intermediate Skills',
      commands: beginner.slice(5, 10),
      guide: 'guides/workflow-patterns.md#common-patterns'
    }
  };

  // Resources
  const resources = {
    getting_started: 'guides/getting-started.md',
    workflow_patterns: 'guides/workflow-patterns.md',
    cli_tools: 'guides/cli-tools-guide.md',
    troubleshooting: 'guides/troubleshooting.md'
  };

  return {
    learning_path: learningPath,
    resources: resources,
    first_task: 'Try: /workflow:plan "create a simple feature"'
  };
}
```

---

## Mode 5: Issue Reporting 📝

### Trigger Analysis

**Keywords**: CCW-issue, CCW-help, 报告 bug, 功能建议, 问题咨询

**Examples**:
- "CCW-issue"
- "我要报告一个 bug"
- "CCW-help 有问题"
- "想提个功能建议"

### Processing Flow

```
1. Detect Issue Type
   └─ Use AskUserQuestion if unclear
   ↓
2. Select Template
   ├─ Bug → templates/issue-bug.md
   ├─ Feature → templates/issue-feature.md
   └─ Question → templates/issue-question.md
   ↓
3. Collect Information
   └─ Interactive Q&A
      ├─ Problem description
      ├─ Steps to reproduce (bug)
      ├─ Expected vs actual (bug)
      ├─ Use case (feature)
      └─ Context
   ↓
4. Generate Filled Template
   └─ Populate template with collected data
   ↓
5. Save or Display
   ├─ Save to templates/.generated/
   └─ Display for user to copy
```

### Implementation

```javascript
async function reportIssue(issueType) {
  // Determine type (bug/feature/question)
  if (!issueType) {
    issueType = await askUserQuestion({
      question: 'What type of issue would you like to report?',
      options: ['Bug Report', 'Feature Request', 'Question']
    });
  }

  // Select template
  const templatePath = {
    'bug': 'templates/issue-bug.md',
    'feature': 'templates/issue-feature.md',
    'question': 'templates/issue-question.md'
  }[issueType.toLowerCase()];

  const template = await readTemplate(templatePath);

  // Collect information
  const info = await collectIssueInfo(issueType);

  // Fill template
  const filledTemplate = fillTemplate(template, {
    ...info,
    timestamp: new Date().toISOString(),
    auto_context: gatherAutoContext()
  });

  // Save
  const outputPath = `templates/.generated/${issueType}-${Date.now()}.md`;
  await writeFile(outputPath, filledTemplate);

  return {
    template: filledTemplate,
    file_path: outputPath,
    instructions: 'Copy content to GitHub Issues or use: gh issue create -F ' + outputPath
  };
}
```

---

## Error Handling

### Not Found
```javascript
if (results.length === 0) {
  return {
    message: 'No commands found matching your query.',
    suggestions: [
      'Try broader keywords',
      'Browse by category: workflow, cli, memory, task',
      'View all commands: essential-commands.json',
      'Need help? Ask: "CCW-help"'
    ]
  };
}
```

### Ambiguous Intent
```javascript
if (intent === 'CLARIFY') {
  return await askUserQuestion({
    question: 'What would you like to do?',
    options: [
      'Search for commands',
      'Get recommendations for next steps',
      'View command documentation',
      'Learn how to get started',
      'Report an issue or get help'
    ]
  });
}
```

---

## Optimization Strategies

### Caching
```javascript
// Cache indexes in memory after first load
const indexCache = new Map();

async function readIndex(filename) {
  if (indexCache.has(filename)) {
    return indexCache.get(filename);
  }

  const data = await readFile(`index/${filename}`);
  const parsed = JSON.parse(data);
  indexCache.set(filename, parsed);
  return parsed;
}
```

### Lazy Loading
```javascript
// Only load full command files when needed
// Use index metadata for most queries
// Read command file only for Mode 3 (Documentation)
```

---

**Last Updated**: 2025-01-06
