---
name: new
description: Create structured issue from GitHub URL or text description, extracting key elements into issues.jsonl
argument-hint: "<github-url | text-description> [--priority 1-5] [--labels label1,label2]"
allowed-tools: TodoWrite(*), Bash(*), Read(*), Write(*), WebFetch(*), AskUserQuestion(*)
---

# Issue New Command (/issue:new)

## Overview

Creates a new structured issue from either:
1. **GitHub Issue URL** - Fetches and parses issue content via `gh` CLI
2. **Text Description** - Parses natural language into structured fields

Outputs a well-formed issue entry to `.workflow/issues/issues.jsonl`.

## Issue Structure (Closed-Loop)

```typescript
interface Issue {
  id: string;                    // GH-123 or ISS-YYYYMMDD-HHMMSS
  title: string;                 // Issue title (clear, concise)
  status: 'registered';          // Initial status
  priority: number;              // 1 (critical) to 5 (low)
  context: string;               // Problem description
  source: 'github' | 'text';     // Input source type
  source_url?: string;           // GitHub URL if applicable
  labels?: string[];             // Categorization labels

  // Structured extraction
  problem_statement: string;     // What is the problem?
  expected_behavior?: string;    // What should happen?
  actual_behavior?: string;      // What actually happens?
  affected_components?: string[];// Files/modules affected
  reproduction_steps?: string[]; // Steps to reproduce

  // Closed-loop requirements (guide plan generation)
  lifecycle_requirements: {
    test_strategy: 'unit' | 'integration' | 'e2e' | 'manual' | 'auto';
    regression_scope: 'affected' | 'related' | 'full';  // Which tests to run
    acceptance_type: 'automated' | 'manual' | 'both';   // How to verify
    commit_strategy: 'per-task' | 'squash' | 'atomic';  // Commit granularity
  };

  // Metadata
  bound_solution_id: null;
  solution_count: 0;
  created_at: string;
  updated_at: string;
}
```

## Task Lifecycle (Each Task is Closed-Loop)

When `/issue:plan` generates tasks, each task MUST include:

```typescript
interface SolutionTask {
  id: string;
  title: string;
  scope: string;
  action: string;

  // Phase 1: Implementation
  implementation: string[];     // Step-by-step implementation
  modification_points: { file: string; target: string; change: string }[];

  // Phase 2: Testing
  test: {
    unit?: string[];            // Unit test requirements
    integration?: string[];     // Integration test requirements
    commands?: string[];        // Test commands to run
    coverage_target?: number;   // Minimum coverage %
  };

  // Phase 3: Regression
  regression: string[];         // Regression check commands/points

  // Phase 4: Acceptance
  acceptance: {
    criteria: string[];         // Testable acceptance criteria
    verification: string[];     // How to verify each criterion
    manual_checks?: string[];   // Manual verification if needed
  };

  // Phase 5: Commit
  commit: {
    type: 'feat' | 'fix' | 'refactor' | 'test' | 'docs' | 'chore';
    scope: string;              // e.g., "auth", "api"
    message_template: string;   // Commit message template
    breaking?: boolean;
  };

  depends_on: string[];
  executor: 'codex' | 'gemini' | 'agent' | 'auto';
}
```

## Usage

```bash
# From GitHub URL
/issue:new https://github.com/owner/repo/issues/123

# From text description
/issue:new "Login fails when password contains special characters. Expected: successful login. Actual: 500 error. Affects src/auth/*"

# With options
/issue:new <url-or-text> --priority 2 --labels "bug,auth"
```

## Implementation

### Phase 1: Input Detection

```javascript
const input = userInput.trim();
const flags = parseFlags(userInput);  // --priority, --labels

// Detect input type
const isGitHubUrl = input.match(/github\.com\/[\w-]+\/[\w-]+\/issues\/\d+/);
const isGitHubShort = input.match(/^#(\d+)$/);  // #123 format

let issueData = {};

if (isGitHubUrl || isGitHubShort) {
  // GitHub issue - fetch via gh CLI
  issueData = await fetchGitHubIssue(input);
} else {
  // Text description - parse structure
  issueData = await parseTextDescription(input);
}
```

### Phase 2: GitHub Issue Fetching

```javascript
async function fetchGitHubIssue(urlOrNumber) {
  let issueRef;
  
  if (urlOrNumber.startsWith('http')) {
    // Extract owner/repo/number from URL
    const match = urlOrNumber.match(/github\.com\/([\w-]+)\/([\w-]+)\/issues\/(\d+)/);
    if (!match) throw new Error('Invalid GitHub URL');
    issueRef = `${match[1]}/${match[2]}#${match[3]}`;
  } else {
    // #123 format - use current repo
    issueRef = urlOrNumber.replace('#', '');
  }
  
  // Fetch via gh CLI
  const result = Bash(`gh issue view ${issueRef} --json number,title,body,labels,state,url`);
  const ghIssue = JSON.parse(result);
  
  // Parse body for structure
  const parsed = parseIssueBody(ghIssue.body);
  
  return {
    id: `GH-${ghIssue.number}`,
    title: ghIssue.title,
    source: 'github',
    source_url: ghIssue.url,
    labels: ghIssue.labels.map(l => l.name),
    context: ghIssue.body,
    ...parsed
  };
}

function parseIssueBody(body) {
  // Extract structured sections from markdown body
  const sections = {};
  
  // Problem/Description
  const problemMatch = body.match(/##?\s*(problem|description|issue)[:\s]*([\s\S]*?)(?=##|$)/i);
  if (problemMatch) sections.problem_statement = problemMatch[2].trim();
  
  // Expected behavior
  const expectedMatch = body.match(/##?\s*(expected|should)[:\s]*([\s\S]*?)(?=##|$)/i);
  if (expectedMatch) sections.expected_behavior = expectedMatch[2].trim();
  
  // Actual behavior
  const actualMatch = body.match(/##?\s*(actual|current)[:\s]*([\s\S]*?)(?=##|$)/i);
  if (actualMatch) sections.actual_behavior = actualMatch[2].trim();
  
  // Steps to reproduce
  const stepsMatch = body.match(/##?\s*(steps|reproduce)[:\s]*([\s\S]*?)(?=##|$)/i);
  if (stepsMatch) {
    const stepsText = stepsMatch[2].trim();
    sections.reproduction_steps = stepsText
      .split('\n')
      .filter(line => line.match(/^\s*[\d\-\*]/))
      .map(line => line.replace(/^\s*[\d\.\-\*]\s*/, '').trim());
  }
  
  // Affected components (from file references)
  const fileMatches = body.match(/`[^`]*\.(ts|js|tsx|jsx|py|go|rs)[^`]*`/g);
  if (fileMatches) {
    sections.affected_components = [...new Set(fileMatches.map(f => f.replace(/`/g, '')))];
  }
  
  // Fallback: use entire body as problem statement
  if (!sections.problem_statement) {
    sections.problem_statement = body.substring(0, 500);
  }
  
  return sections;
}
```

### Phase 3: Text Description Parsing

```javascript
async function parseTextDescription(text) {
  // Generate unique ID
  const id = `ISS-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`;
  
  // Extract structured elements using patterns
  const result = {
    id,
    source: 'text',
    title: '',
    problem_statement: '',
    expected_behavior: null,
    actual_behavior: null,
    affected_components: [],
    reproduction_steps: []
  };
  
  // Pattern: "Title. Description. Expected: X. Actual: Y. Affects: files"
  const sentences = text.split(/\.(?=\s|$)/);
  
  // First sentence as title
  result.title = sentences[0]?.trim() || 'Untitled Issue';
  
  // Look for keywords
  for (const sentence of sentences) {
    const s = sentence.trim();
    
    if (s.match(/^expected:?\s*/i)) {
      result.expected_behavior = s.replace(/^expected:?\s*/i, '');
    } else if (s.match(/^actual:?\s*/i)) {
      result.actual_behavior = s.replace(/^actual:?\s*/i, '');
    } else if (s.match(/^affects?:?\s*/i)) {
      const components = s.replace(/^affects?:?\s*/i, '').split(/[,\s]+/);
      result.affected_components = components.filter(c => c.includes('/') || c.includes('.'));
    } else if (s.match(/^steps?:?\s*/i)) {
      result.reproduction_steps = s.replace(/^steps?:?\s*/i, '').split(/[,;]/);
    } else if (!result.problem_statement && s.length > 10) {
      result.problem_statement = s;
    }
  }
  
  // Fallback problem statement
  if (!result.problem_statement) {
    result.problem_statement = text.substring(0, 300);
  }
  
  return result;
}
```

### Phase 4: Lifecycle Configuration

```javascript
// Ask for lifecycle requirements (or use smart defaults)
const lifecycleAnswer = AskUserQuestion({
  questions: [
    {
      question: 'Test strategy for this issue?',
      header: 'Test',
      multiSelect: false,
      options: [
        { label: 'auto', description: 'Auto-detect based on affected files (Recommended)' },
        { label: 'unit', description: 'Unit tests only' },
        { label: 'integration', description: 'Integration tests' },
        { label: 'e2e', description: 'End-to-end tests' },
        { label: 'manual', description: 'Manual testing only' }
      ]
    },
    {
      question: 'Regression scope?',
      header: 'Regression',
      multiSelect: false,
      options: [
        { label: 'affected', description: 'Only affected module tests (Recommended)' },
        { label: 'related', description: 'Affected + dependent modules' },
        { label: 'full', description: 'Full test suite' }
      ]
    },
    {
      question: 'Commit strategy?',
      header: 'Commit',
      multiSelect: false,
      options: [
        { label: 'per-task', description: 'One commit per task (Recommended)' },
        { label: 'atomic', description: 'Single commit for entire issue' },
        { label: 'squash', description: 'Squash at the end' }
      ]
    }
  ]
});

const lifecycle = {
  test_strategy: lifecycleAnswer.test || 'auto',
  regression_scope: lifecycleAnswer.regression || 'affected',
  acceptance_type: 'automated',
  commit_strategy: lifecycleAnswer.commit || 'per-task'
};

issueData.lifecycle_requirements = lifecycle;
```

### Phase 5: User Confirmation

```javascript
// Show parsed data and ask for confirmation
console.log(`
## Parsed Issue

**ID**: ${issueData.id}
**Title**: ${issueData.title}
**Source**: ${issueData.source}${issueData.source_url ? ` (${issueData.source_url})` : ''}

### Problem Statement
${issueData.problem_statement}

${issueData.expected_behavior ? `### Expected Behavior\n${issueData.expected_behavior}\n` : ''}
${issueData.actual_behavior ? `### Actual Behavior\n${issueData.actual_behavior}\n` : ''}
${issueData.affected_components?.length ? `### Affected Components\n${issueData.affected_components.map(c => `- ${c}`).join('\n')}\n` : ''}
${issueData.reproduction_steps?.length ? `### Reproduction Steps\n${issueData.reproduction_steps.map((s, i) => `${i+1}. ${s}`).join('\n')}\n` : ''}

### Lifecycle Configuration
- **Test Strategy**: ${lifecycle.test_strategy}
- **Regression Scope**: ${lifecycle.regression_scope}
- **Commit Strategy**: ${lifecycle.commit_strategy}
`);

// Ask user to confirm or edit
const answer = AskUserQuestion({
  questions: [{
    question: 'Create this issue?',
    header: 'Confirm',
    multiSelect: false,
    options: [
      { label: 'Create', description: 'Save issue to issues.jsonl' },
      { label: 'Edit Title', description: 'Modify the issue title' },
      { label: 'Edit Priority', description: 'Change priority (1-5)' },
      { label: 'Cancel', description: 'Discard and exit' }
    ]
  }]
});

if (answer.includes('Cancel')) {
  console.log('Issue creation cancelled.');
  return;
}

if (answer.includes('Edit Title')) {
  const titleAnswer = AskUserQuestion({
    questions: [{
      question: 'Enter new title:',
      header: 'Title',
      multiSelect: false,
      options: [
        { label: issueData.title.substring(0, 40), description: 'Keep current' }
      ]
    }]
  });
  // Handle custom input via "Other"
  if (titleAnswer.customText) {
    issueData.title = titleAnswer.customText;
  }
}
```

### Phase 6: Write to JSONL

```javascript
// Construct final issue object
const priority = flags.priority ? parseInt(flags.priority) : 3;
const labels = flags.labels ? flags.labels.split(',').map(l => l.trim()) : [];

const newIssue = {
  id: issueData.id,
  title: issueData.title,
  status: 'registered',
  priority,
  context: issueData.problem_statement,
  source: issueData.source,
  source_url: issueData.source_url || null,
  labels: [...(issueData.labels || []), ...labels],

  // Structured fields
  problem_statement: issueData.problem_statement,
  expected_behavior: issueData.expected_behavior || null,
  actual_behavior: issueData.actual_behavior || null,
  affected_components: issueData.affected_components || [],
  reproduction_steps: issueData.reproduction_steps || [],

  // Closed-loop lifecycle requirements
  lifecycle_requirements: issueData.lifecycle_requirements || {
    test_strategy: 'auto',
    regression_scope: 'affected',
    acceptance_type: 'automated',
    commit_strategy: 'per-task'
  },

  // Metadata
  bound_solution_id: null,
  solution_count: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Ensure directory exists
Bash('mkdir -p .workflow/issues');

// Append to issues.jsonl
const issuesPath = '.workflow/issues/issues.jsonl';
Bash(`echo '${JSON.stringify(newIssue)}' >> "${issuesPath}"`);

console.log(`
## Issue Created

**ID**: ${newIssue.id}
**Title**: ${newIssue.title}
**Priority**: ${newIssue.priority}
**Labels**: ${newIssue.labels.join(', ') || 'none'}
**Source**: ${newIssue.source}

### Next Steps
1. Plan solution: \`/issue:plan ${newIssue.id}\`
2. View details: \`ccw issue status ${newIssue.id}\`
3. Manage issues: \`/issue:manage\`
`);
```

## Examples

### GitHub Issue

```bash
/issue:new https://github.com/myorg/myrepo/issues/42 --priority 2

# Output:
## Issue Created
**ID**: GH-42
**Title**: Fix memory leak in WebSocket handler
**Priority**: 2
**Labels**: bug, performance
**Source**: github (https://github.com/myorg/myrepo/issues/42)
```

### Text Description

```bash
/issue:new "API rate limiting not working. Expected: 429 after 100 requests. Actual: No limit. Affects src/middleware/rate-limit.ts"

# Output:
## Issue Created
**ID**: ISS-20251227-142530
**Title**: API rate limiting not working
**Priority**: 3
**Labels**: none
**Source**: text
```

## Error Handling

| Error | Resolution |
|-------|------------|
| Invalid GitHub URL | Show format hint, ask for correction |
| gh CLI not available | Fall back to WebFetch for public issues |
| Empty description | Prompt user for required fields |
| Duplicate issue ID | Auto-increment or suggest merge |
| Parse failure | Show raw input, ask for manual structuring |

## Related Commands

- `/issue:plan` - Plan solution for issue
- `/issue:manage` - Interactive issue management
- `ccw issue list` - List all issues
- `ccw issue status <id>` - View issue details
