# Phase 3: Deep Analysis

Execute deep analysis using Gemini CLI with exploration context.

## Execution

### Step 1: Prepare CLI Prompt

```bash
ccw cli -p "
PURPOSE: Generate ${type} analysis report for project
TASK: 
  • Analyze project structure and patterns from ${type} perspective
  • Focus on: ${focus_areas}
  • Depth level: ${depth}
  • Key files: ${key_files}
MODE: analysis
CONTEXT: @**/* | Exploration results
EXPECTED: 
  - Structured analysis
  - Code references (file:line format)
  - Mermaid diagram data
  - Actionable insights
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md)
" --tool gemini --mode analysis
```

### Step 2: Parse Analysis Results

Extract structured data from CLI response:

```javascript
const deepAnalysis = {
  findings: [],           // Analyzed findings with confidence scores
  patterns: [],           // Identified patterns with consistency scores
  dependencies: [],       // Dependency relationships
  recommendations: [],    // Prioritized recommendations
  sections: [],           // Report section data
  diagram_data: {}        // Data for diagram generation
};
```

### Step 3: Validate Analysis Quality

Check analysis completeness:

```javascript
const qualityChecks = {
  has_executive_summary: Boolean,
  focus_areas_covered: config.focus_areas.every(area => analysis.covers(area)),
  code_references_valid: analysis.references.every(ref => fileExists(ref)),
  insights_actionable: analysis.insights.filter(i => i.actionable).length > 0
};
```

## Output

Save analysis results to `deep-analysis.json`.
