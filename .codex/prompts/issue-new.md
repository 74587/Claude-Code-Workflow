---
description: Create structured issue from GitHub URL or text description
argument-hint: "<github-url | text-description> [--priority 1-5]"
---

# Issue New (Codex Version)

## Goal

Create a new issue from a GitHub URL or text description. Detect input clarity and ask clarifying questions only when necessary. Register the issue for planning.

**Core Principle**: Requirement Clarity Detection → Ask only when needed

```
Clear Input (GitHub URL, structured text)  → Direct creation
Unclear Input (vague description)          → Minimal clarifying questions
```

## Issue Structure

```typescript
interface Issue {
  id: string;                    // GH-123 or ISS-YYYYMMDD-HHMMSS
  title: string;
  status: 'registered' | 'planned' | 'queued' | 'in_progress' | 'completed' | 'failed';
  priority: number;              // 1 (critical) to 5 (low)
  context: string;               // Problem description
  source: 'github' | 'text' | 'discovery';
  source_url?: string;
  labels?: string[];
  
  // GitHub binding (for non-GitHub sources that publish to GitHub)
  github_url?: string;
  github_number?: number;
  
  // Optional structured fields
  expected_behavior?: string;
  actual_behavior?: string;
  affected_components?: string[];
  
  // Solution binding
  bound_solution_id: string | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}
```

## Inputs

- **GitHub URL**: `https://github.com/owner/repo/issues/123` or `#123`
- **Text description**: Natural language description
- **Priority flag**: `--priority 1-5` (optional, default: 3)

## Output Requirements

**Create Issue via CLI** (preferred method):
```bash
# Pipe input (recommended for complex JSON)
echo '{"title":"...", "context":"...", "priority":3}' | ccw issue create

# Returns created issue JSON
{"id":"ISS-20251229-001","title":"...","status":"registered",...}
```

**Return Summary:**
```json
{
  "created": true,
  "id": "ISS-20251229-001",
  "title": "Login fails with special chars",
  "source": "text",
  "github_published": false,
  "next_step": "/issue:plan ISS-20251229-001"
}
```

## Workflow

### Step 1: Analyze Input Clarity

Parse and detect input type:

```javascript
// Detection patterns
const isGitHubUrl = input.match(/github\.com\/[\w-]+\/[\w-]+\/issues\/\d+/);
const isGitHubShort = input.match(/^#(\d+)$/);
const hasStructure = input.match(/(expected|actual|affects|steps):/i);

// Clarity score: 0-3
let clarityScore = 0;
if (isGitHubUrl || isGitHubShort) clarityScore = 3;  // GitHub = fully clear
else if (hasStructure) clarityScore = 2;             // Structured text = clear
else if (input.length > 50) clarityScore = 1;        // Long text = somewhat clear
else clarityScore = 0;                               // Vague
```

### Step 2: Extract Issue Data

**For GitHub URL/Short:**

```bash
# Fetch issue details via gh CLI
gh issue view <issue-ref> --json number,title,body,labels,url

# Parse response
{
  "id": "GH-123",
  "title": "...",
  "source": "github",
  "source_url": "https://github.com/...",
  "labels": ["bug", "priority:high"],
  "context": "..."
}
```

**For Text Description:**

```javascript
// Generate issue ID
const id = `ISS-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`;

// Parse structured fields if present
const expected = text.match(/expected:?\s*([^.]+)/i);
const actual = text.match(/actual:?\s*([^.]+)/i);
const affects = text.match(/affects?:?\s*([^.]+)/i);

// Build issue data
{
  "id": id,
  "title": text.split(/[.\n]/)[0].substring(0, 60),
  "source": "text",
  "context": text.substring(0, 500),
  "expected_behavior": expected?.[1]?.trim(),
  "actual_behavior": actual?.[1]?.trim()
}
```

### Step 3: Context Hint (Conditional)

For medium clarity (score 1-2) without affected components:

```bash
# Use rg to find potentially related files
rg -l "<keyword>" --type ts | head -5
```

Add discovered files to `affected_components` (max 3 files).

**Note**: Skip this for GitHub issues (already have context) and vague inputs (needs clarification first).

### Step 4: Clarification (Only if Unclear)

**Only for clarity score < 2:**

Present a prompt asking for more details:

```
Input unclear. Please describe:
- What is the issue about?
- Where does it occur?
- What is the expected behavior?
```

Wait for user response, then update issue data.

### Step 5: GitHub Publishing Decision

For non-GitHub sources, determine if user wants to publish to GitHub:

```
Would you like to publish this issue to GitHub?
1. Yes, publish to GitHub (create issue and link it)
2. No, keep local only (store without GitHub sync)
```

### Step 6: Create Issue

**Create via CLI:**

```bash
# Build issue JSON
ISSUE_JSON='{"title":"...","context":"...","priority":3,"source":"text"}'

# Create issue (auto-generates ID)
echo "${ISSUE_JSON}" | ccw issue create
```

**If publishing to GitHub:**

```bash
# Create on GitHub first
GH_URL=$(gh issue create --title "..." --body "..." | grep -oE 'https://github.com/[^ ]+')
GH_NUMBER=$(echo $GH_URL | grep -oE '/issues/([0-9]+)$' | grep -oE '[0-9]+')

# Update local issue with binding
ccw issue update ${ISSUE_ID} --github-url "${GH_URL}" --github-number ${GH_NUMBER}
```

### Step 7: Output Result

```markdown
## Issue Created

**ID**: ISS-20251229-001
**Title**: Login fails with special chars
**Source**: text
**Priority**: 2 (High)

**Context**:
500 error when password contains quotes

**Affected Components**:
- src/auth/login.ts
- src/utils/validation.ts

**GitHub**: Not published (local only)

**Next Step**: `/issue:plan ISS-20251229-001`
```

## Quality Checklist

Before completing, verify:

- [ ] Issue ID generated correctly (GH-xxx or ISS-YYYYMMDD-HHMMSS)
- [ ] Title extracted (max 60 chars)
- [ ] Context captured (problem description)
- [ ] Priority assigned (1-5)
- [ ] Status set to `registered`
- [ ] Created via `ccw issue create` CLI command

## Error Handling

| Situation | Action |
|-----------|--------|
| GitHub URL not accessible | Report error, suggest text input |
| gh CLI not available | Fall back to text-based creation |
| Empty input | Prompt for description |
| Very vague input | Ask clarifying questions |
| Issue already exists | Report duplicate, show existing |

## Examples

### Clear Input (No Questions)

```bash
# GitHub URL
codex -p "@.codex/prompts/issue-new.md https://github.com/org/repo/issues/42"
# → Fetches, parses, creates immediately

# Structured text
codex -p "@.codex/prompts/issue-new.md 'Login fails with special chars. Expected: success. Actual: 500'"
# → Parses structure, creates immediately
```

### Vague Input (Clarification)

```bash
codex -p "@.codex/prompts/issue-new.md 'auth broken'"
# → Asks: "Please describe the issue in more detail"
# → User provides details
# → Creates issue
```

## Start Execution

Parse input and detect clarity:

```bash
# Get input from arguments
INPUT="${1}"

# Detect if GitHub URL
if echo "${INPUT}" | grep -qE 'github\.com/.*/issues/[0-9]+'; then
  echo "GitHub URL detected - fetching issue..."
  gh issue view "${INPUT}" --json number,title,body,labels,url
else
  echo "Text input detected - analyzing clarity..."
  # Continue with text parsing
fi
```

Then follow the workflow based on detected input type.
