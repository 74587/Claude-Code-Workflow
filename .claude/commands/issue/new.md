---
name: new
description: Create structured issue from GitHub URL or text description
argument-hint: "<github-url | text-description> [--priority 1-5]"
allowed-tools: TodoWrite(*), Bash(*), Read(*), AskUserQuestion(*), mcp__ace-tool__search_context(*)
---

# Issue New Command (/issue:new)

## Core Principle

**Requirement Clarity Detection** → Ask only when needed

```
Clear Input (GitHub URL, structured text)  → Direct creation
Unclear Input (vague description)          → Minimal clarifying questions
```

## Quick Reference

```bash
# Clear inputs - direct creation
/issue:new https://github.com/owner/repo/issues/123
/issue:new "Login fails with special chars. Expected: success. Actual: 500 error"

# Vague input - will ask clarifying questions
/issue:new "something wrong with auth"
```

## Implementation

### Phase 1: Input Analysis & Clarity Detection

```javascript
const input = userInput.trim();
const flags = parseFlags(userInput);  // --priority

// Detect input type and clarity
const isGitHubUrl = input.match(/github\.com\/[\w-]+\/[\w-]+\/issues\/\d+/);
const isGitHubShort = input.match(/^#(\d+)$/);
const hasStructure = input.match(/(expected|actual|affects|steps):/i);

// Clarity score: 0-3
let clarityScore = 0;
if (isGitHubUrl || isGitHubShort) clarityScore = 3;  // GitHub = fully clear
else if (hasStructure) clarityScore = 2;             // Structured text = clear
else if (input.length > 50) clarityScore = 1;        // Long text = somewhat clear
else clarityScore = 0;                               // Vague

let issueData = {};
```

### Phase 2: Data Extraction (GitHub or Text)

```javascript
if (isGitHubUrl || isGitHubShort) {
  // GitHub - fetch via gh CLI
  const result = Bash(`gh issue view ${extractIssueRef(input)} --json number,title,body,labels,url`);
  const gh = JSON.parse(result);
  issueData = {
    id: `GH-${gh.number}`,
    title: gh.title,
    source: 'github',
    source_url: gh.url,
    labels: gh.labels.map(l => l.name),
    problem_statement: gh.body?.substring(0, 500) || gh.title,
    ...parseMarkdownBody(gh.body)
  };
} else {
  // Text description
  issueData = {
    id: `ISS-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`,
    source: 'text',
    ...parseTextDescription(input)
  };
}
```

### Phase 3: Smart Context Discovery (ACE)

```javascript
// Use ACE to find affected components if not specified
if (!issueData.affected_components?.length && issueData.problem_statement) {
  const keywords = extractKeywords(issueData.problem_statement);

  if (keywords.length > 0) {
    const aceResult = mcp__ace-tool__search_context({
      project_root_path: process.cwd(),
      query: `Find code related to: ${keywords.join(', ')}`
    });

    // Extract file paths from ACE results
    issueData.affected_components = aceResult.files?.slice(0, 5) || [];
    issueData.extended_context = { ace_suggestions: aceResult.summary };
  }
}
```

### Phase 4: Conditional Clarification (Only if Unclear)

```javascript
// ONLY ask questions if clarity is low
if (clarityScore < 2) {
  const missingFields = [];

  if (!issueData.title || issueData.title.length < 10) {
    missingFields.push('title');
  }
  if (!issueData.problem_statement || issueData.problem_statement.length < 20) {
    missingFields.push('problem');
  }

  if (missingFields.length > 0) {
    const answer = AskUserQuestion({
      questions: [{
        question: `Input unclear. What is the issue about?`,
        header: 'Clarify',
        multiSelect: false,
        options: [
          { label: 'Bug fix', description: 'Something is broken' },
          { label: 'New feature', description: 'Add new functionality' },
          { label: 'Improvement', description: 'Enhance existing feature' },
          { label: 'Other', description: 'Provide more details' }
        ]
      }]
    });

    // Use answer to enrich issue data
    if (answer.customText) {
      issueData.problem_statement = answer.customText;
      issueData.title = answer.customText.split('.')[0].substring(0, 60);
    }
  }
}
```

### Phase 5: Auto-Detect Lifecycle (No Questions)

```javascript
// Smart defaults based on affected files - NO USER QUESTIONS
function detectLifecycle(components) {
  const hasTests = components.some(c => c.includes('test') || c.includes('spec'));
  const hasApi = components.some(c => c.includes('api') || c.includes('route'));
  const hasUi = components.some(c => c.includes('component') || c.match(/\.(tsx|jsx)$/));

  return {
    test_strategy: hasTests ? 'unit' : (hasApi ? 'integration' : 'auto'),
    regression_scope: 'affected',
    acceptance_type: 'automated',
    commit_strategy: 'per-task'
  };
}

issueData.lifecycle_requirements = detectLifecycle(issueData.affected_components || []);
```

### Phase 6: Create Issue (Minimal Confirmation)

```javascript
// Show summary and create
console.log(`
## Creating Issue

**ID**: ${issueData.id}
**Title**: ${issueData.title}
**Source**: ${issueData.source}
${issueData.affected_components?.length ? `**Files**: ${issueData.affected_components.slice(0, 3).join(', ')}` : ''}
`);

// Quick confirm only for vague inputs
let proceed = true;
if (clarityScore < 2) {
  const confirm = AskUserQuestion({
    questions: [{
      question: 'Create this issue?',
      header: 'Confirm',
      multiSelect: false,
      options: [
        { label: 'Create', description: 'Save to issues.jsonl (Recommended)' },
        { label: 'Cancel', description: 'Discard' }
      ]
    }]
  });
  proceed = !confirm.includes('Cancel');
}

if (proceed) {
  // Construct and save
  const newIssue = {
    id: issueData.id,
    title: issueData.title || 'Untitled Issue',
    status: 'registered',
    priority: flags.priority ? parseInt(flags.priority) : 3,
    context: issueData.problem_statement,
    source: issueData.source,
    source_url: issueData.source_url || null,
    labels: issueData.labels || [],
    problem_statement: issueData.problem_statement,
    expected_behavior: issueData.expected_behavior || null,
    actual_behavior: issueData.actual_behavior || null,
    affected_components: issueData.affected_components || [],
    extended_context: issueData.extended_context || null,
    lifecycle_requirements: issueData.lifecycle_requirements,
    bound_solution_id: null,
    solution_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  Bash('mkdir -p .workflow/issues');
  const jsonLine = JSON.stringify(newIssue).replace(/'/g, "'\\''");
  Bash(`echo '${jsonLine}' >> .workflow/issues/issues.jsonl`);

  console.log(`✓ Issue ${newIssue.id} created. Next: /issue:plan ${newIssue.id}`);
}
```

## Decision Flow

```
┌─────────────────────────────────────────────────────────┐
│                   /issue:new <input>                    │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Clarity Detection    │
              │   (GitHub? Structure?) │
              └────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
      [Score 3]       [Score 1-2]      [Score 0]
      GitHub URL    Structured Text   Vague Input
           │               │               │
           ▼               ▼               ▼
        Parse           Parse         AskUserQuestion
        Direct         + ACE           (1 question)
           │               │               │
           └───────────────┼───────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Auto-detect Lifecycle │
              │    (NO questions)      │
              └────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │      Create Issue      │
              │  (confirm only if <2)  │
              └────────────────────────┘
```

## Helper Functions

```javascript
function extractKeywords(text) {
  // Extract meaningful keywords for ACE search
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'not', 'with']);
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 3 && !stopWords.has(w))
    .slice(0, 5);
}

function parseTextDescription(text) {
  const result = { title: '', problem_statement: '' };
  const sentences = text.split(/\.(?=\s|$)/);

  result.title = sentences[0]?.trim().substring(0, 60) || 'Untitled';
  result.problem_statement = text.substring(0, 500);

  // Extract structured fields if present
  const expected = text.match(/expected:?\s*([^.]+)/i);
  const actual = text.match(/actual:?\s*([^.]+)/i);
  const affects = text.match(/affects?:?\s*([^.]+)/i);

  if (expected) result.expected_behavior = expected[1].trim();
  if (actual) result.actual_behavior = actual[1].trim();
  if (affects) {
    result.affected_components = affects[1].split(/[,\s]+/).filter(c => c.includes('/') || c.includes('.'));
  }

  return result;
}

function parseMarkdownBody(body) {
  if (!body) return {};
  const result = {};

  // Extract sections
  const problem = body.match(/##?\s*(problem|description)[:\s]*([\s\S]*?)(?=##|$)/i);
  const expected = body.match(/##?\s*expected[:\s]*([\s\S]*?)(?=##|$)/i);
  const actual = body.match(/##?\s*actual[:\s]*([\s\S]*?)(?=##|$)/i);

  if (problem) result.problem_statement = problem[2].trim().substring(0, 500);
  if (expected) result.expected_behavior = expected[2].trim();
  if (actual) result.actual_behavior = actual[2].trim();

  return result;
}
```

## Examples

### Clear Input (No Questions)

```bash
/issue:new https://github.com/org/repo/issues/42
# → Fetches, parses, creates immediately

/issue:new "Login fails with special chars. Expected: success. Actual: 500"
# → Parses structure, creates immediately
```

### Vague Input (1 Question)

```bash
/issue:new "auth broken"
# → Asks: "Input unclear. What is the issue about?"
# → User selects "Bug fix" or provides details
# → Creates issue
```

## Related Commands

- `/issue:plan` - Plan solution for issue
- `/issue:manage` - Interactive issue management
