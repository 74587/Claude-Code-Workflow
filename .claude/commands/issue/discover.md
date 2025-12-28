---
name: issue:discover
description: Discover potential issues from multiple perspectives (bug, UX, test, quality, security, performance, maintainability, best-practices) using CLI explore. Supports Exa external research for security and best-practices perspectives.
argument-hint: "<path-pattern> [--perspectives=bug,ux,...] [--external]"
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*), Task(*), AskUserQuestion(*), Glob(*), Grep(*)
---

# Issue Discovery Command

## Quick Start

```bash
# Discover issues in specific module (interactive perspective selection)
/issue:discover src/auth/**

# Discover with specific perspectives
/issue:discover src/payment/** --perspectives=bug,security,test

# Discover with external research for all perspectives
/issue:discover src/api/** --external

# Discover in multiple modules
/issue:discover src/auth/**,src/payment/**
```

**Discovery Scope**: Specified modules/files only
**Output Directory**: `.workflow/issues/discoveries/{discovery-id}/`
**Available Perspectives**: bug, ux, test, quality, security, performance, maintainability, best-practices
**Exa Integration**: Auto-enabled for security and best-practices perspectives
**CLI Tools**: Gemini → Qwen → Codex (fallback chain)

## What & Why

### Core Concept
Multi-perspective issue discovery orchestrator that explores code from different angles to identify potential bugs, UX improvements, test gaps, and other actionable items. Unlike code review (which assesses existing code quality), discovery focuses on **finding opportunities for improvement and potential problems**.

**vs Code Review**:
- **Code Review** (`review-module-cycle`): Evaluates code quality against standards
- **Issue Discovery** (`issue:discover`): Finds actionable issues, bugs, and improvement opportunities

### Value Proposition
1. **Proactive Issue Detection**: Find problems before they become bugs
2. **Multi-Perspective Analysis**: Each perspective surfaces different types of issues
3. **External Benchmarking**: Compare against industry best practices via Exa
4. **Direct Issue Integration**: Discoveries can be exported to issue tracker
5. **Dashboard Management**: View, filter, and export discoveries via CCW dashboard

## How It Works

### Execution Flow

```
Phase 1: Discovery & Initialization
   └─ Parse target pattern, create session, initialize output structure

Phase 2: Interactive Perspective Selection
   └─ AskUserQuestion for perspective selection (or use --perspectives)

Phase 3: Parallel Perspective Analysis
   ├─ Launch N @cli-explore-agent instances (one per perspective)
   ├─ Security & Best-Practices auto-trigger Exa research
   ├─ Generate perspective JSON + markdown reports
   └─ Update discovery-progress.json

Phase 4: Aggregation & Prioritization
   ├─ Load all perspective JSON files
   ├─ Merge findings, deduplicate by file+line
   ├─ Calculate priority scores based on impact/urgency
   └─ Generate candidate issue list

Phase 5: Issue Generation
   ├─ Convert high-priority discoveries to issue format
   ├─ Write to discovery-issues.jsonl (preview)
   └─ Generate summary report
```

## Perspectives

### Available Perspectives

| Perspective | Focus | Categories | Exa |
|-------------|-------|------------|-----|
| **bug** | Potential Bugs | edge-case, null-check, resource-leak, race-condition, boundary, exception-handling | - |
| **ux** | User Experience | error-message, loading-state, feedback, accessibility, interaction, consistency | - |
| **test** | Test Coverage | missing-test, edge-case-test, integration-gap, coverage-hole, assertion-quality | - |
| **quality** | Code Quality | complexity, duplication, naming, documentation, code-smell, readability | - |
| **security** | Security Issues | injection, auth, encryption, input-validation, data-exposure, access-control | ✓ |
| **performance** | Performance | n-plus-one, memory-usage, caching, algorithm, blocking-operation, resource | - |
| **maintainability** | Maintainability | coupling, cohesion, tech-debt, extensibility, module-boundary, interface-design | - |
| **best-practices** | Best Practices | convention, pattern, framework-usage, anti-pattern, industry-standard | ✓ |

### Interactive Perspective Selection

When no `--perspectives` flag is provided, the command uses AskUserQuestion:

```javascript
AskUserQuestion({
  questions: [{
    question: "Select discovery perspectives (multi-select)",
    header: "Perspectives",
    multiSelect: true,
    options: [
      { label: "bug", description: "Potential bugs (edge cases, null checks, resource leaks)" },
      { label: "ux", description: "User experience (error messages, loading states, accessibility)" },
      { label: "test", description: "Test coverage (missing tests, edge cases, integration gaps)" },
      { label: "quality", description: "Code quality (complexity, duplication, naming)" },
      { label: "security", description: "Security issues (auto-enables Exa research)" },
      { label: "performance", description: "Performance (N+1 queries, memory, caching)" },
      { label: "maintainability", description: "Maintainability (coupling, tech debt, extensibility)" },
      { label: "best-practices", description: "Best practices (auto-enables Exa research)" }
    ]
  }]
})
```

**Recommended Combinations**:
- Quick scan: bug, test, quality
- Full analysis: all perspectives
- Security audit: security, bug, quality

## Core Responsibilities

### Orchestrator

**Phase 1: Discovery & Initialization**

```javascript
// Step 1: Parse target pattern and resolve files
const resolvedFiles = await expandGlobPattern(targetPattern);
if (resolvedFiles.length === 0) {
  throw new Error(`No files matched pattern: ${targetPattern}`);
}

// Step 2: Generate discovery ID
const discoveryId = `DSC-${formatDate(new Date(), 'YYYYMMDD-HHmmss')}`;

// Step 3: Create output directory
const outputDir = `.workflow/issues/discoveries/${discoveryId}`;
await mkdir(outputDir, { recursive: true });
await mkdir(`${outputDir}/perspectives`, { recursive: true });
await mkdir(`${outputDir}/reports`, { recursive: true });

// Step 4: Initialize discovery state
await writeJson(`${outputDir}/discovery-state.json`, {
  discovery_id: discoveryId,
  target_pattern: targetPattern,
  metadata: {
    created_at: new Date().toISOString(),
    resolved_files: resolvedFiles,
    perspectives: [],  // filled after selection
    external_research_enabled: false
  },
  phase: "initialization",
  perspectives_completed: [],
  total_findings: 0,
  priority_distribution: { critical: 0, high: 0, medium: 0, low: 0 },
  issues_generated: 0
});

// Step 5: Initialize progress tracking
await writeJson(`${outputDir}/discovery-progress.json`, {
  discovery_id: discoveryId,
  last_update: new Date().toISOString(),
  phase: "initialization",
  progress: {
    perspective_analysis: { total: 0, completed: 0, in_progress: 0, percent_complete: 0 },
    external_research: { enabled: false, completed: false },
    aggregation: { completed: false },
    issue_generation: { completed: false }
  },
  agent_status: []
});
```

**Phase 2: Perspective Selection**

```javascript
// Check for --perspectives flag
let selectedPerspectives = [];

if (args.perspectives) {
  selectedPerspectives = args.perspectives.split(',').map(p => p.trim());
} else {
  // Interactive selection via AskUserQuestion
  const response = await AskUserQuestion({
    questions: [{
      question: "Select discovery perspectives to analyze:",
      header: "Perspectives",
      multiSelect: true,
      options: PERSPECTIVE_OPTIONS
    }]
  });
  selectedPerspectives = parseSelectedPerspectives(response);
}

// Validate perspectives
const validPerspectives = ['bug', 'ux', 'test', 'quality', 'security', 'performance', 'maintainability', 'best-practices'];
for (const p of selectedPerspectives) {
  if (!validPerspectives.includes(p)) {
    throw new Error(`Invalid perspective: ${p}`);
  }
}

// Determine if Exa is needed
const exaEnabled = selectedPerspectives.includes('security') ||
                   selectedPerspectives.includes('best-practices') ||
                   args.external;

// Update state
await updateDiscoveryState(outputDir, {
  'metadata.perspectives': selectedPerspectives,
  'metadata.external_research_enabled': exaEnabled,
  phase: 'parallel'
});
```

**Phase 3: Parallel Perspective Analysis**

Launch N agents in parallel (one per selected perspective):

```javascript
// Launch agents in parallel
const agentPromises = selectedPerspectives.map(perspective =>
  Task({
    subagent_type: "cli-explore-agent",
    run_in_background: false,
    description: `Discover ${perspective} issues via Deep Scan`,
    prompt: buildPerspectivePrompt(perspective, discoveryId, resolvedFiles, outputDir)
  })
);

// For perspectives with Exa enabled, add external research
if (exaEnabled) {
  for (const perspective of ['security', 'best-practices']) {
    if (selectedPerspectives.includes(perspective)) {
      agentPromises.push(
        Task({
          subagent_type: "cli-explore-agent",
          run_in_background: false,
          description: `External research for ${perspective} via Exa`,
          prompt: buildExaResearchPrompt(perspective, projectTech, outputDir)
        })
      );
    }
  }
}

// Wait for all agents
const results = await Promise.all(agentPromises);
```

**Phase 4: Aggregation & Prioritization**

```javascript
// Load all perspective results
const allFindings = [];
for (const perspective of selectedPerspectives) {
  const jsonPath = `${outputDir}/perspectives/${perspective}.json`;
  if (await fileExists(jsonPath)) {
    const data = await readJson(jsonPath);
    allFindings.push(...data.findings.map(f => ({ ...f, perspective })));
  }
}

// Deduplicate by file+line
const uniqueFindings = deduplicateFindings(allFindings);

// Calculate priority scores
const prioritizedFindings = uniqueFindings.map(finding => ({
  ...finding,
  priority_score: calculatePriorityScore(finding)
})).sort((a, b) => b.priority_score - a.priority_score);

// Update state with aggregation results
await updateDiscoveryState(outputDir, {
  phase: 'aggregation',
  total_findings: prioritizedFindings.length,
  priority_distribution: countByPriority(prioritizedFindings)
});
```

**Phase 5: Issue Generation**

```javascript
// Filter high-priority findings for issue generation
const issueWorthy = prioritizedFindings.filter(f =>
  f.priority === 'critical' || f.priority === 'high' || f.priority_score >= 0.7
);

// Convert to issue format
const issues = issueWorthy.map((finding, idx) => ({
  id: `DSC-${String(idx + 1).padStart(3, '0')}`,
  title: finding.suggested_issue?.title || finding.title,
  status: 'discovered',
  priority: mapPriorityToNumber(finding.priority),
  source: 'discovery',
  source_discovery_id: discoveryId,
  perspective: finding.perspective,
  context: finding.description,
  labels: [finding.perspective, ...(finding.labels || [])],
  file: finding.file,
  line: finding.line,
  created_at: new Date().toISOString()
}));

// Write discovery issues (preview, not committed to main issues.jsonl)
await writeJsonl(`${outputDir}/discovery-issues.jsonl`, issues);

// Generate summary report
await generateSummaryReport(outputDir, prioritizedFindings, issues);

// Update final state
await updateDiscoveryState(outputDir, {
  phase: 'complete',
  issues_generated: issues.length
});

// Update index
await updateDiscoveryIndex(outputDir, discoveryId, {
  target_pattern: targetPattern,
  perspectives: selectedPerspectives,
  total_findings: prioritizedFindings.length,
  issues_generated: issues.length,
  completed_at: new Date().toISOString()
});
```

### Output File Structure

```
.workflow/issues/discoveries/
├── index.json                           # Discovery session index
└── {discovery-id}/
    ├── discovery-state.json             # State machine
    ├── discovery-progress.json          # Real-time progress (dashboard polling)
    ├── perspectives/
    │   ├── bug.json
    │   ├── ux.json
    │   ├── test.json
    │   ├── quality.json
    │   ├── security.json
    │   ├── performance.json
    │   ├── maintainability.json
    │   └── best-practices.json
    ├── external-research.json           # Exa research results
    ├── discovery-issues.jsonl           # Generated candidate issues
    └── reports/
        ├── summary.md
        ├── bug-report.md
        └── {perspective}-report.md
```

### Schema References

**External Schema Files** (agent MUST read and follow exactly):

| Schema | Path | Purpose |
|--------|------|---------|
| **Discovery State** | `~/.claude/workflows/cli-templates/schemas/discovery-state-schema.json` | Session state machine |
| **Discovery Finding** | `~/.claude/workflows/cli-templates/schemas/discovery-finding-schema.json` | Perspective analysis results |

**Agent Schema Loading Protocol**:
```bash
# Agent MUST read schema before generating any JSON output
cat ~/.claude/workflows/cli-templates/schemas/discovery-finding-schema.json
```

### Agent Invocation Template

**Perspective Analysis Agent**:

```javascript
Task({
  subagent_type: "cli-explore-agent",
  run_in_background: false,
  description: `Discover ${perspective} issues via Deep Scan`,
  prompt: `
    ## Task Objective
    Discover potential ${perspective} issues in specified module files using Deep Scan mode (Bash + Gemini dual-source strategy)

    ## Analysis Mode
    Use **Deep Scan mode** for this discovery:
    - Phase 1: Bash structural scan for standard patterns
    - Phase 2: Gemini semantic analysis for ${perspective}-specific concerns
    - Phase 3: Synthesis with attribution

    ## MANDATORY FIRST STEPS
    1. Read discovery state: ${discoveryStateJsonPath}
    2. Get target files from discovery-state.json
    3. Validate file access: bash(ls -la ${targetFiles.join(' ')})
    4. **CRITICAL**: Read schema FIRST: cat ~/.claude/workflows/cli-templates/schemas/discovery-finding-schema.json
    5. Read: .workflow/project-tech.json (technology stack)

    ## Discovery Context
    - Discovery ID: ${discoveryId}
    - Perspective: ${perspective}
    - Target Pattern: ${targetPattern}
    - Resolved Files: ${resolvedFiles.length} files
    - Output Directory: ${outputDir}

    ## CLI Configuration
    - Tool Priority: gemini → qwen → codex
    - Mode: analysis (READ-ONLY for code analysis, WRITE for output files)
    - Context Pattern: ${targetFiles.map(f => `@${f}`).join(' ')}

    ## ⚠️ CRITICAL OUTPUT GUIDELINES

    **Agent MUST write JSON files directly - DO NOT return JSON to orchestrator**:

    1. **Schema Compliance**: Read and strictly follow discovery-finding-schema.json
       - All required fields MUST be present
       - Use exact enum values (lowercase priority: critical/high/medium/low)
       - ID format: dsc-{perspective}-{seq}-{uuid8}

    2. **Direct File Output**: Agent writes files using Write/mcp__ccw-tools__write_file:
       - JSON: ${outputDir}/perspectives/${perspective}.json
       - Report: ${outputDir}/reports/${perspective}-report.md
       - DO NOT return raw JSON in response - write to file

    3. **Validation Before Write**:
       - Validate JSON against schema structure
       - Ensure all findings have required fields
       - Verify file paths are relative to project root

    4. **Progress Update**: After writing, update discovery-progress.json:
       - Set perspective status to "completed"
       - Update findings_count
       - Update completed_at timestamp

    ## Expected Deliverables

    1. Perspective Results JSON: ${outputDir}/perspectives/${perspective}.json
       - Follow discovery-finding-schema.json exactly
       - Root structure MUST be object with findings array
       - Each finding MUST include: id, title, priority, category, description, file, line, snippet, suggested_issue, confidence

    2. Discovery Report: ${outputDir}/reports/${perspective}-report.md
       - Human-readable summary
       - Grouped by priority
       - Include file:line references

    ## Perspective-Specific Guidance
    ${getPerspectiveGuidance(perspective)}

    ## Success Criteria
    - [ ] Schema read and understood before analysis
    - [ ] All target files analyzed for ${perspective} concerns
    - [ ] JSON written directly to ${outputDir}/perspectives/${perspective}.json
    - [ ] Report written to ${outputDir}/reports/${perspective}-report.md
    - [ ] Each finding includes actionable suggested_issue
    - [ ] Priority assessment is accurate (lowercase enum values)
    - [ ] Recommendations are specific and implementable
    - [ ] discovery-progress.json updated with completion status
  `
})
```

**Exa Research Agent** (for security and best-practices):

```javascript
Task({
  subagent_type: "cli-explore-agent",
  run_in_background: false,
  description: `External research for ${perspective} via Exa`,
  prompt: `
    ## Task Objective
    Research industry best practices and common patterns for ${perspective} using Exa search

    ## MANDATORY FIRST STEPS
    1. Read project tech stack: .workflow/project-tech.json
    2. Read external research schema structure (if exists)
    3. Identify key technologies (e.g., Node.js, React, Express)

    ## Research Steps
    1. Use Exa to search for:
       - "${technology} ${perspective} best practices 2025"
       - "${technology} common ${perspective} issues"
       - "${technology} ${perspective} checklist"
    2. Synthesize findings relevant to this project

    ## ⚠️ CRITICAL OUTPUT GUIDELINES

    **Agent MUST write files directly - DO NOT return content to orchestrator**:

    1. **Direct File Output**: Agent writes files using Write/mcp__ccw-tools__write_file:
       - JSON: ${outputDir}/external-research.json
       - Report: ${outputDir}/reports/${perspective}-external.md
       - DO NOT return raw content in response - write to file

    2. **JSON Structure for external-research.json**:
       \`\`\`json
       {
         "discovery_id": "${discoveryId}",
         "perspective": "${perspective}",
         "research_timestamp": "ISO8601",
         "sources": [
           { "title": "...", "url": "...", "relevance": "..." }
         ],
         "key_findings": [...],
         "gap_analysis": [...],
         "recommendations": [...]
       }
       \`\`\`

    3. **Progress Update**: After writing, update discovery-progress.json:
       - Set external_research.completed to true

    ## Expected Deliverables

    1. External Research JSON: ${outputDir}/external-research.json
       - Sources with URLs
       - Key findings
       - Relevance to current codebase

    2. Comparison report in ${outputDir}/reports/${perspective}-external.md
       - Industry standards vs current implementation
       - Gap analysis
       - Prioritized recommendations

    ## Success Criteria
    - [ ] At least 3 authoritative sources consulted
    - [ ] JSON written directly to ${outputDir}/external-research.json
    - [ ] Report written to ${outputDir}/reports/${perspective}-external.md
    - [ ] Findings are relevant to project's tech stack
    - [ ] Recommendations are actionable
    - [ ] discovery-progress.json updated
  `
})
```

### Perspective Guidance Reference

```javascript
function getPerspectiveGuidance(perspective) {
  const guidance = {
    bug: `
      Focus Areas:
      - Null/undefined checks before property access
      - Edge cases in conditionals (empty arrays, 0 values, empty strings)
      - Resource leaks (unclosed connections, streams, file handles)
      - Race conditions in async code
      - Boundary conditions (array indices, date ranges)
      - Exception handling gaps (missing try-catch, swallowed errors)

      Priority Criteria:
      - Critical: Data corruption, security bypass, system crash
      - High: Feature malfunction, data loss potential
      - Medium: Unexpected behavior in edge cases
      - Low: Minor inconsistencies, cosmetic issues
    `,
    ux: `
      Focus Areas:
      - Error messages (are they user-friendly and actionable?)
      - Loading states (are long operations indicated?)
      - Feedback (do users know their action succeeded?)
      - Accessibility (keyboard navigation, screen readers, color contrast)
      - Interaction patterns (consistent behavior across the app)
      - Form validation (immediate feedback, clear requirements)

      Priority Criteria:
      - Critical: Inaccessible features, misleading feedback
      - High: Confusing error messages, missing loading states
      - Medium: Inconsistent patterns, minor feedback issues
      - Low: Cosmetic improvements, nice-to-haves
    `,
    test: `
      Focus Areas:
      - Missing unit tests for public functions
      - Edge case coverage (null, empty, boundary values)
      - Integration test gaps (API endpoints, database operations)
      - Coverage holes in critical paths (auth, payment, data mutation)
      - Assertion quality (are tests actually verifying behavior?)
      - Test isolation (do tests depend on each other?)

      Priority Criteria:
      - Critical: No tests for security-critical code
      - High: Missing tests for core business logic
      - Medium: Edge cases not covered, weak assertions
      - Low: Minor coverage gaps, test organization issues
    `,
    quality: `
      Focus Areas:
      - Cyclomatic complexity (deeply nested conditionals)
      - Code duplication (copy-pasted logic)
      - Naming (unclear variable/function names)
      - Documentation (missing JSDoc for public APIs)
      - Code smells (long functions, large files, magic numbers)
      - Readability (overly clever code, unclear intent)

      Priority Criteria:
      - Critical: Unmaintainable complexity blocking changes
      - High: Significant duplication, confusing logic
      - Medium: Naming issues, missing documentation
      - Low: Minor refactoring opportunities
    `,
    security: `
      Focus Areas:
      - Input validation and sanitization
      - Authentication and authorization mechanisms
      - SQL/NoSQL injection vulnerabilities
      - XSS, CSRF vulnerabilities
      - Sensitive data exposure (logs, errors, responses)
      - Access control gaps

      Priority Criteria:
      - Critical: Authentication bypass, injection, RCE
      - High: Missing authorization, exposed secrets
      - Medium: Missing input validation, weak encryption
      - Low: Security headers, verbose errors
    `,
    performance: `
      Focus Areas:
      - N+1 query problems in ORM usage
      - Memory usage patterns (large objects, memory leaks)
      - Caching opportunities (repeated computations, API calls)
      - Algorithm efficiency (O(n²) where O(n log n) possible)
      - Blocking operations on main thread
      - Resource usage (CPU, network, disk I/O)

      Priority Criteria:
      - Critical: Memory leaks, blocking main thread
      - High: N+1 queries, inefficient algorithms in hot paths
      - Medium: Missing caching, suboptimal data structures
      - Low: Minor optimization opportunities
    `,
    maintainability: `
      Focus Areas:
      - Module coupling (tight dependencies between unrelated modules)
      - Interface design (unclear contracts, leaky abstractions)
      - Technical debt indicators (TODOs, FIXMEs, temporary solutions)
      - Extensibility (hard to add new features without touching core)
      - Module boundaries (unclear separation of responsibilities)
      - Configuration management (hardcoded values, environment handling)

      Priority Criteria:
      - Critical: Changes require touching unrelated code
      - High: Unclear module boundaries, significant tech debt
      - Medium: Minor coupling issues, configuration problems
      - Low: Refactoring opportunities, documentation gaps
    `,
    'best-practices': `
      Focus Areas:
      - Framework conventions (are we using the framework idiomatically?)
      - Language patterns (modern JS/TS features, async/await usage)
      - Anti-patterns (god objects, callback hell, mutation of shared state)
      - Deprecated API usage (using old APIs when new ones available)
      - Industry standards (OWASP for security, WCAG for accessibility)
      - Coding standards (consistent style, ESLint/Prettier compliance)

      Priority Criteria:
      - Critical: Anti-patterns causing bugs, deprecated security APIs
      - High: Major convention violations, poor patterns
      - Medium: Minor style issues, suboptimal patterns
      - Low: Cosmetic improvements
    `
  };

  return guidance[perspective] || 'General code discovery analysis';
}
```

## Dashboard Integration

### Viewing Discoveries

Open CCW dashboard to manage discoveries:

```bash
ccw view
```

Navigate to **Issues > Discovery** to:
- View all discovery sessions
- Filter findings by perspective and priority
- Preview finding details
- Select and export findings as issues
- Dismiss irrelevant findings

### Exporting to Issues

From the dashboard, select findings and click "Export as Issues" to:
1. Convert discoveries to standard issue format
2. Append to `.workflow/issues/issues.jsonl`
3. Set status to `registered`
4. Continue with `/issue:plan` workflow

## Related Commands

```bash
# After discovery, plan solutions for exported issues
/issue:plan DSC-001,DSC-002,DSC-003

# Or use interactive management
/issue:manage
```

## Best Practices

1. **Start Focused**: Begin with specific modules rather than entire codebase
2. **Use Quick Scan First**: Start with bug, test, quality for fast results
3. **Review Before Export**: Not all discoveries warrant issues - use dashboard to filter
4. **Combine Perspectives**: Run related perspectives together (e.g., security + bug)
5. **Enable Exa for New Tech**: When using unfamiliar frameworks, enable external research
