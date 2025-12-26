# Phase 2: Project Exploration

Launch parallel exploration agents based on report type.

## Execution

### Step 1: Map Exploration Angles

```javascript
const angleMapping = {
  architecture: ["Layer Structure", "Module Dependencies", "Entry Points", "Data Flow"],
  design: ["Design Patterns", "Class Relationships", "Interface Contracts", "State Management"],
  methods: ["Core Algorithms", "Critical Paths", "Public APIs", "Complex Logic"],
  comprehensive: ["Layer Structure", "Design Patterns", "Core Algorithms", "Data Flow"]
};

const angles = angleMapping[config.type];
```

### Step 2: Launch Parallel Agents

For each angle, launch an exploration agent:

```javascript
Task({
  subagent_type: "cli-explore-agent",
  description: `Explore: ${angle}`,
  prompt: `
## Exploration Objective
Execute **${angle}** exploration for project analysis report.

## Context
- **Angle**: ${angle}
- **Report Type**: ${config.type}
- **Depth**: ${config.depth}
- **Scope**: ${config.scope}

## Exploration Protocol
1. Structural Discovery (get_modules_by_depth, rg, glob)
2. Pattern Recognition (conventions, naming, organization)
3. Relationship Mapping (dependencies, integration points)

## Output Format
{
  "angle": "${angle}",
  "findings": {
    "structure": [...],
    "patterns": [...],
    "relationships": [...],
    "key_files": [{path, relevance, rationale}]
  },
  "insights": [...]
}
`
})
```

### Step 3: Aggregate Results

Merge all exploration results into unified findings:

```javascript
const aggregatedFindings = {
  structure: [],      // from all angles
  patterns: [],       // from all angles  
  relationships: [],  // from all angles
  key_files: [],      // deduplicated
  insights: []        // prioritized
};
```

## Output

Save exploration results to `exploration-{angle}.json` files.
