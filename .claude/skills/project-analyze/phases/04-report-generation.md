# Phase 4: Report Generation

Assemble analysis and diagrams into structured Markdown report.

## Execution

### Step 1: Determine Report Sections

```javascript
const reportSections = {
  architecture: [
    "# Architecture Report",
    "## Executive Summary",
    "## System Overview",
    "## Layer Analysis",
    "## Module Dependencies",
    "## Data Flow",
    "## Entry Points & Critical Paths",
    "## Dependency Graph",
    "## Recommendations"
  ],
  design: [
    "# Design Report",
    "## Executive Summary",
    "## Design Patterns Used",
    "## Class Relationships",
    "## Interface Contracts",
    "## State Management",
    "## Component Diagrams",
    "## Design Recommendations"
  ],
  methods: [
    "# Key Methods Report",
    "## Executive Summary",
    "## Core Algorithms",
    "## Critical Code Paths",
    "## Public API Reference",
    "## Complex Logic Breakdown",
    "## Sequence Diagrams",
    "## Optimization Suggestions"
  ],
  comprehensive: [
    "# Comprehensive Project Analysis",
    "## Executive Summary",
    "## Architecture Overview",
    "## Design Patterns & Principles",
    "## Key Methods & Algorithms",
    "## System Diagrams",
    "## Recommendations & Next Steps"
  ]
};

const sections = reportSections[config.type];
```

### Step 2: Generate Report Content

```javascript
let report = '';

for (const section of sections) {
  report += section + '\n\n';
  
  // Add section content from analysis
  const sectionContent = generateSectionContent(section, deepAnalysis);
  report += sectionContent + '\n\n';
  
  // Embed relevant diagrams
  const relatedDiagrams = findRelatedDiagrams(section, diagrams);
  for (const diagram of relatedDiagrams) {
    report += `\`\`\`mermaid\n${Read(diagram.path)}\n\`\`\`\n\n`;
  }
}
```

### Step 3: Add Code References

Format all code references as `file:line`:

```javascript
// Example: src/auth/login.ts:42
const codeRef = `${finding.file}:${finding.line}`;
```

### Step 4: Write Report

```javascript
const reportFileName = `${config.type.toUpperCase()}-REPORT.md`;
Write(`${outputDir}/${reportFileName}`, report);
```

## Output

Generate `{TYPE}-REPORT.md` in output directory.
