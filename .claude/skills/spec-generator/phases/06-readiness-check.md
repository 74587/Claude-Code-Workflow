# Phase 6: Readiness Check

Validate the complete specification package, generate quality report and executive summary, provide execution handoff options.

## Objective

- Cross-document validation: completeness, consistency, traceability, depth
- Generate quality scores per dimension
- Produce readiness-report.md with issue list and traceability matrix
- Produce spec-summary.md as one-page executive summary
- Update all document frontmatter to `status: complete`
- Present handoff options to execution workflows

## Input

- All Phase 2-5 outputs: `product-brief.md`, `requirements.md`, `architecture.md`, `epics.md`
- Config: `{workDir}/spec-config.json`
- Reference: `specs/quality-gates.md`

## Execution Steps

### Step 1: Load All Documents

```javascript
const specConfig = JSON.parse(Read(`${workDir}/spec-config.json`));
const productBrief = Read(`${workDir}/product-brief.md`);
const requirements = Read(`${workDir}/requirements.md`);
const architecture = Read(`${workDir}/architecture.md`);
const epics = Read(`${workDir}/epics.md`);
const qualityGates = Read('specs/quality-gates.md');
```

### Step 2: Cross-Document Validation via Gemini CLI

```javascript
Bash({
  command: `ccw cli -p "PURPOSE: Validate specification package for completeness, consistency, traceability, and depth.
Success: Comprehensive quality report with scores, issues, and traceability matrix.

DOCUMENTS TO VALIDATE:

=== PRODUCT BRIEF ===
${productBrief.slice(0, 3000)}

=== REQUIREMENTS ===
${requirements.slice(0, 4000)}

=== ARCHITECTURE ===
${architecture.slice(0, 3000)}

=== EPICS ===
${epics.slice(0, 3000)}

QUALITY CRITERIA (from quality-gates.md):
${qualityGates.slice(0, 2000)}

TASK:
Perform 4-dimension validation:

1. COMPLETENESS (25%):
   - All required sections present in each document?
   - All template fields filled with substantive content?
   - Score 0-100 with specific gaps listed

2. CONSISTENCY (25%):
   - Terminology uniform across documents?
   - User personas consistent?
   - Scope consistent (PRD does not exceed brief)?
   - Tech stack references match between architecture and epics?
   - Score 0-100 with inconsistencies listed

3. TRACEABILITY (25%):
   - Every goal has >= 1 requirement?
   - Every Must requirement has architecture coverage?
   - Every Must requirement appears in >= 1 story?
   - ADR choices reflected in epics?
   - Build traceability matrix: Goal -> Requirement -> Architecture -> Epic/Story
   - Score 0-100 with orphan items listed

4. DEPTH (25%):
   - Acceptance criteria specific and testable?
   - Architecture decisions justified with alternatives?
   - Stories estimable by dev team?
   - Score 0-100 with vague areas listed

ALSO:
- List all issues found, classified as Error/Warning/Info
- Generate overall weighted score
- Determine gate: Pass (>=80) / Review (60-79) / Fail (<60)

MODE: analysis
EXPECTED: JSON-compatible output with: dimension scores, overall score, gate, issues list (severity + description + location), traceability matrix
CONSTRAINTS: Be thorough but fair. Focus on actionable issues.
" --tool gemini --mode analysis`,
  run_in_background: true
});

// Wait for CLI result
```

### Step 3: Generate readiness-report.md

```javascript
const frontmatterReport = `---
session_id: ${specConfig.session_id}
phase: 6
document_type: readiness-report
status: complete
generated_at: ${new Date().toISOString()}
stepsCompleted: ["load-all", "cross-validation", "scoring", "report-generation"]
version: 1
dependencies:
  - product-brief.md
  - requirements.md
  - architecture.md
  - epics.md
---`;

// Report content from CLI validation output:
// - Quality Score Summary (4 dimensions + overall)
// - Gate Decision (Pass/Review/Fail)
// - Issue List (grouped by severity: Error, Warning, Info)
// - Traceability Matrix (Goal -> Req -> Arch -> Epic/Story)
// - Recommendations for improvement

Write(`${workDir}/readiness-report.md`, `${frontmatterReport}\n\n${reportContent}`);
```

### Step 4: Generate spec-summary.md

```javascript
const frontmatterSummary = `---
session_id: ${specConfig.session_id}
phase: 6
document_type: spec-summary
status: complete
generated_at: ${new Date().toISOString()}
stepsCompleted: ["synthesis"]
version: 1
dependencies:
  - product-brief.md
  - requirements.md
  - architecture.md
  - epics.md
  - readiness-report.md
---`;

// One-page executive summary:
// - Product Name & Vision (from product-brief.md)
// - Problem & Target Users (from product-brief.md)
// - Key Requirements count (Must/Should/Could from requirements.md)
// - Architecture Style & Tech Stack (from architecture.md)
// - Epic Overview (count, MVP scope from epics.md)
// - Quality Score (from readiness-report.md)
// - Recommended Next Step
// - File manifest with links

Write(`${workDir}/spec-summary.md`, `${frontmatterSummary}\n\n${summaryContent}`);
```

### Step 5: Update All Document Status

```javascript
// Update frontmatter status to 'complete' in all documents
const docs = ['product-brief.md', 'requirements.md', 'architecture.md', 'epics.md'];
for (const doc of docs) {
  const content = Read(`${workDir}/${doc}`);
  const updated = content.replace(/status: draft/, 'status: complete');
  Write(`${workDir}/${doc}`, updated);
}

// Update spec-config.json
specConfig.phasesCompleted.push({
  phase: 6,
  name: "readiness-check",
  output_file: "readiness-report.md",
  completed_at: new Date().toISOString()
});
Write(`${workDir}/spec-config.json`, JSON.stringify(specConfig, null, 2));
```

### Step 6: Handoff Options

```javascript
AskUserQuestion({
  questions: [
    {
      question: "Specification package is complete. What would you like to do next?",
      header: "Next Step",
      multiSelect: false,
      options: [
        {
          label: "Execute via lite-plan",
          description: "Start implementing with /workflow:lite-plan, one Epic at a time"
        },
        {
          label: "Create roadmap",
          description: "Generate execution roadmap with /workflow:req-plan-with-file"
        },
        {
          label: "Full planning",
          description: "Detailed planning with /workflow:plan for the full scope"
        },
        {
          label: "Create Issues",
          description: "Generate issues for each Epic via /issue:new"
        }
      ]
    }
  ]
});

// Based on user selection, execute the corresponding handoff:

if (selection === "Execute via lite-plan") {
  // lite-plan accepts a text description directly
  const epicsContent = Read(`${workDir}/epics.md`);
  // Extract first MVP Epic's title + description as task input
  const firstEpic = extractFirstMvpEpicDescription(epicsContent);
  Skill(skill="workflow:lite-plan", args=`"${firstEpic}"`)
}

if (selection === "Full planning" || selection === "Create roadmap") {
  // === Bridge: Build brainstorm_artifacts compatible structure ===
  // This enables workflow:plan's context-search-agent to discover spec artifacts
  // via the standard .brainstorming/ directory convention.

  // Step A: Read all spec documents
  const specSummary = Read(`${workDir}/spec-summary.md`);
  const productBrief = Read(`${workDir}/product-brief.md`);
  const requirements = Read(`${workDir}/requirements.md`);
  const architecture = Read(`${workDir}/architecture.md`);
  const epics = Read(`${workDir}/epics.md`);

  // Step B: Build structured description from spec-summary
  const structuredDesc = `GOAL: ${extractGoal(specSummary)}
SCOPE: ${extractScope(specSummary)}
CONTEXT: Generated from spec session ${specConfig.session_id}. Source: ${workDir}/`;

  // Step C: Create WFS session (provides session directory + .brainstorming/)
  Skill(skill="workflow:session:start", args=`--auto "${structuredDesc}"`)
  // → Produces sessionId (WFS-xxx) and session directory at .workflow/active/{sessionId}/

  // Step D: Create .brainstorming/ bridge files
  const brainstormDir = `.workflow/active/${sessionId}/.brainstorming`;
  Bash(`mkdir -p "${brainstormDir}/feature-specs"`);

  // D.1: guidance-specification.md (highest priority - action-planning-agent reads first)
  // Synthesized from spec-summary + product-brief key decisions + architecture decisions
  Write(`${brainstormDir}/guidance-specification.md`, `
# ${specConfig.seed_analysis.problem_statement} - Confirmed Guidance Specification

**Source**: spec-generator session ${specConfig.session_id}
**Generated**: ${new Date().toISOString()}
**Spec Directory**: ${workDir}

## 1. Project Positioning & Goals
${extractSection(productBrief, "Vision")}
${extractSection(productBrief, "Goals")}

## 2. Requirements Summary
${extractSection(requirements, "Requirement Summary")}

## 3. Architecture Decisions
${extractSection(architecture, "Architecture Decision Records")}
${extractSection(architecture, "Technology Stack")}

## 4. Implementation Scope
${extractSection(epics, "Epic Overview")}
${extractSection(epics, "MVP Scope")}

## Feature Decomposition
${extractFeatureTable(epics)}

## Appendix: Source Documents
| Document | Path | Description |
|----------|------|-------------|
| Product Brief | ${workDir}/product-brief.md | Vision, goals, scope |
| Requirements | ${workDir}/requirements.md | Functional + non-functional requirements |
| Architecture | ${workDir}/architecture.md | ADRs, tech stack, components |
| Epics | ${workDir}/epics.md | Epic/Story breakdown |
| Readiness Report | ${workDir}/readiness-report.md | Quality validation |
`);

  // D.2: feature-index.json (each Epic mapped to a Feature)
  // Path: feature-specs/feature-index.json (matches context-search-agent discovery at line 344)
  const epicsList = parseEpics(epics); // Extract: id, slug, name, description, mvp, stories[]
  const featureIndex = {
    version: "1.0",
    source: "spec-generator",
    spec_session: specConfig.session_id,
    features: epicsList.map(epic => ({
      id: `F-${epic.id.replace('EPIC-', '')}`,
      slug: epic.slug,
      name: epic.name,
      description: epic.description,
      priority: epic.mvp ? "High" : "Medium",
      spec_path: `${brainstormDir}/feature-specs/F-${epic.id.replace('EPIC-','')}-${epic.slug}.md`,
      source_epic: epic.id,
      stories: epic.stories
    })),
    cross_cutting_specs: []
  };
  Write(`${brainstormDir}/feature-specs/feature-index.json`, JSON.stringify(featureIndex, null, 2));

  // D.3: Individual feature-spec files (one per Epic)
  // Filename pattern: F-{num}-{slug}.md (matches context-search-agent glob F-*-*.md)
  epicsList.forEach(epic => {
    const epicDetail = extractEpicDetail(epics, epic.id);
    const relatedReqs = extractRelatedRequirements(requirements, epic.id);
    Write(`${brainstormDir}/feature-specs/F-${epic.id.replace('EPIC-','')}-${epic.slug}.md`, `
# Feature Spec: ${epic.id} - ${epic.name}

**Source**: ${workDir}/epics.md
**Priority**: ${epic.mvp ? "MVP" : "Post-MVP"}
**Related Requirements**: ${relatedReqs.join(', ')}

## Scope
${epicDetail.scope}

## Stories
${epicDetail.stories.map(s => `- ${s.id}: ${s.title} (${s.estimate})`).join('\n')}

## Acceptance Criteria
${epicDetail.acceptanceCriteria}

## Architecture Notes
${extractArchitectureNotes(architecture, epic.id)}
`);
  });

  // Step E: Invoke downstream workflow
  // context-search-agent will auto-discover .brainstorming/ files
  // → context-package.json.brainstorm_artifacts populated
  // → action-planning-agent loads guidance_specification (priority 1) + feature_index (priority 2)
  if (selection === "Full planning") {
    Skill(skill="workflow:plan", args=`"${structuredDesc}"`)
  } else {
    Skill(skill="workflow:req-plan-with-file", args=`"${extractGoal(specSummary)}"`)
  }
}

if (selection === "Create Issues") {
  // For each Epic, create an issue
  const epics = Read(`${workDir}/epics.md`);
  const epicsList = parseEpics(epics);
  epicsList.forEach(epic => {
    Skill(skill="issue:new", args=`"${epic.name}: ${epic.description}"`)
  });
}

// If user selects "Other": Export only or return to specific phase
```

#### Helper Functions Reference (pseudocode)

The following helper functions are used in the handoff bridge. They operate on the markdown content loaded from spec documents:

```javascript
// Extract the first MVP Epic's title + scope as a one-line task description
function extractFirstMvpEpicDescription(epicsContent) {
  // Find first Epic marked as MVP, return: "Epic Name - Brief scope description"
}

// Extract GOAL/SCOPE from spec-summary frontmatter or ## sections
function extractGoal(specSummary) { /* Return the Vision/Goal line */ }
function extractScope(specSummary) { /* Return the Scope/MVP boundary */ }

// Extract a named ## section from a markdown document
function extractSection(markdown, sectionName) {
  // Return content between ## {sectionName} and next ## heading
}

// Build a markdown table of Epics from epics.md
function extractFeatureTable(epicsContent) {
  // Return: | Epic ID | Name | Priority | Story Count |
}

// Parse epics.md into structured Epic objects
function parseEpics(epicsContent) {
  // Returns: [{ id, slug, name, description, mvp, stories[] }]
}

// Extract detailed Epic section (scope, stories, acceptance criteria)
function extractEpicDetail(epicsContent, epicId) {
  // Returns: { scope, stories[], acceptanceCriteria }
}

// Find requirements related to a specific Epic
function extractRelatedRequirements(requirementsContent, epicId) {
  // Returns: ["REQ-001", "REQ-003"] based on traceability references
}

// Extract architecture notes relevant to a specific Epic
function extractArchitectureNotes(architectureContent, epicId) {
  // Returns: relevant ADRs, component references, tech stack notes
}
```

## Output

- **File**: `readiness-report.md` - Quality validation report
- **File**: `spec-summary.md` - One-page executive summary
- **Format**: Markdown with YAML frontmatter

## Quality Checklist

- [ ] All 4 documents validated (product-brief, requirements, architecture, epics)
- [ ] All frontmatter parseable and valid
- [ ] Cross-references checked
- [ ] Overall quality score calculated
- [ ] No unresolved Error-severity issues
- [ ] Traceability matrix generated
- [ ] spec-summary.md created
- [ ] All document statuses updated to 'complete'
- [ ] Handoff options presented

## Completion

This is the final phase. The specification package is ready for execution handoff.

### Output Files Manifest

| File | Phase | Description |
|------|-------|-------------|
| `spec-config.json` | 1 | Session configuration and state |
| `discovery-context.json` | 1 | Codebase exploration (optional) |
| `product-brief.md` | 2 | Product brief with multi-perspective synthesis |
| `requirements.md` | 3 | Detailed PRD with MoSCoW priorities |
| `architecture.md` | 4 | Architecture decisions and component design |
| `epics.md` | 5 | Epic/Story breakdown with dependencies |
| `readiness-report.md` | 6 | Quality validation report |
| `spec-summary.md` | 6 | One-page executive summary |
