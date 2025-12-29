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

## Issue Structure (Simplified)

```typescript
interface Issue {
  id: string;                    // GH-123 or ISS-YYYYMMDD-HHMMSS
  title: string;
  status: 'registered' | 'planned' | 'queued' | 'in_progress' | 'completed' | 'failed';
  priority: number;              // 1 (critical) to 5 (low)
  context: string;               // Problem description (single source of truth)
  source: 'github' | 'text' | 'discovery';
  source_url?: string;
  labels?: string[];

  // Optional structured fields
  expected_behavior?: string;
  actual_behavior?: string;
  affected_components?: string[];

  // Feedback history (failures + human clarifications)
  feedback?: {
    type: 'failure' | 'clarification' | 'rejection';
    stage: string;               // new/plan/execute
    content: string;
    created_at: string;
  }[];

  // Solution binding
  bound_solution_id: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}
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
    context: gh.body?.substring(0, 500) || gh.title,
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

### Phase 3: Lightweight Context Hint (Conditional)

```javascript
// ACE search ONLY for medium clarity (1-2) AND missing components
// Skip for: GitHub (has context), vague (needs clarification first)
// Note: Deep exploration happens in /issue:plan, this is just a quick hint

if (clarityScore >= 1 && clarityScore <= 2 && !issueData.affected_components?.length) {
  const keywords = extractKeywords(issueData.context);

  if (keywords.length >= 2) {
    try {
      const aceResult = mcp__ace-tool__search_context({
        project_root_path: process.cwd(),
        query: keywords.slice(0, 3).join(' ')
      });
      issueData.affected_components = aceResult.files?.slice(0, 3) || [];
    } catch {
      // ACE failure is non-blocking
    }
  }
}
```

### Phase 4: Conditional Clarification (Only if Unclear)

```javascript
// ONLY ask questions if clarity is low - simple open-ended prompt
if (clarityScore < 2 && (!issueData.context || issueData.context.length < 20)) {
  const answer = AskUserQuestion({
    questions: [{
      question: 'Please describe the issue in more detail:',
      header: 'Clarify',
      multiSelect: false,
      options: [
        { label: 'Provide details', description: 'Describe what, where, and expected behavior' }
      ]
    }]
  });

  // Use custom text input (via "Other")
  if (answer.customText) {
    issueData.context = answer.customText;
    issueData.title = answer.customText.split(/[.\n]/)[0].substring(0, 60);
    issueData.feedback = [{
      type: 'clarification',
      stage: 'new',
      content: answer.customText,
      created_at: new Date().toISOString()
    }];
  }
}
```

### Phase 5: Create Issue

**Summary Display:**
- Show ID, title, source, affected files (if any)

**Confirmation** (only for vague inputs, clarityScore < 2):
- Use `AskUserQuestion` to confirm before creation

**Issue Creation** (via CLI endpoint):
```bash
ccw issue create --data '{"title":"...", "context":"...", "priority":3, ...}'
```

**CLI Endpoint Features:**
| Feature | Description |
|---------|-------------|
| Auto-increment ID | `ISS-YYYYMMDD-NNN` (e.g., `ISS-20251229-001`) |
| Trailing newline | Proper JSONL format, no corruption |
| JSON output | Returns created issue with all fields |

**Example:**
```bash
# Create issue via CLI
ccw issue create --data '{
  "title": "Login fails with special chars",
  "context": "500 error when password contains quotes",
  "priority": 2,
  "source": "text",
  "expected_behavior": "Login succeeds",
  "actual_behavior": "500 Internal Server Error"
}'

# Output (JSON)
{
  "id": "ISS-20251229-001",
  "title": "Login fails with special chars",
  "status": "registered",
  ...
}
```

**Completion:**
- Display created issue ID
- Show next step: `/issue:plan <id>`

## Execution Flow

```
Phase 1: Input Analysis
   └─ Detect clarity score (GitHub URL? Structured text? Keywords?)

Phase 2: Data Extraction (branched by clarity)
   ┌────────────┬─────────────────┬──────────────┐
   │  Score 3   │   Score 1-2     │   Score 0    │
   │  GitHub    │   Text + ACE    │   Vague      │
   ├────────────┼─────────────────┼──────────────┤
   │  gh CLI    │  Parse struct   │ AskQuestion  │
   │  → parse   │  + quick hint   │ (1 question) │
   │            │  (3 files max)  │  → feedback  │
   └────────────┴─────────────────┴──────────────┘

Phase 3: Create Issue
   ├─ Score ≥ 2: Direct creation
   └─ Score < 2: Confirm first → Create

Note: Deep exploration & lifecycle deferred to /issue:plan
```

## Helper Functions

```javascript
function extractKeywords(text) {
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'not', 'with']);
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 3 && !stopWords.has(w))
    .slice(0, 5);
}

function parseTextDescription(text) {
  const result = { title: '', context: '' };
  const sentences = text.split(/\.(?=\s|$)/);

  result.title = sentences[0]?.trim().substring(0, 60) || 'Untitled';
  result.context = text.substring(0, 500);

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

  const problem = body.match(/##?\s*(problem|description)[:\s]*([\s\S]*?)(?=##|$)/i);
  const expected = body.match(/##?\s*expected[:\s]*([\s\S]*?)(?=##|$)/i);
  const actual = body.match(/##?\s*actual[:\s]*([\s\S]*?)(?=##|$)/i);

  if (problem) result.context = problem[2].trim().substring(0, 500);
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
# → User provides details → saved to feedback[]
# → Creates issue
```

## Related Commands

- `/issue:plan` - Plan solution for issue
- `/issue:manage` - Interactive issue management
