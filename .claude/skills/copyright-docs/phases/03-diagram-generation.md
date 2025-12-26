# Phase 3: Mermaid Diagram Generation

Generate Mermaid diagrams for each document section.

> **Reference**: See [mermaid-utils.md](../../_shared/mermaid-utils.md) for utility functions.

## Execution

### Diagram Mapping

| Section | Diagram Type | Format | File |
|---------|--------------|--------|------|
| 2. 系统架构图 | Architecture | graph TD | architecture.mmd |
| 3. 功能模块设计 | Function Tree | flowchart TD | functions.mmd |
| 4. 核心算法与流程 | Algorithm Flow | flowchart TD | algorithm-*.mmd |
| 5. 数据结构设计 | Class Diagram | classDiagram | class-diagram.mmd |
| 6. 接口设计 | Sequence | sequenceDiagram | sequence-*.mmd |
| 7. 异常处理设计 | Error Flow | flowchart TD | exception-flow.mmd |

### Section 2: System Architecture

```javascript
function generateArchitectureDiagram(analysis) {
  let mermaid = 'graph TD\n';

  for (const layer of analysis.layers) {
    mermaid += `    subgraph ${sanitizeId(layer.name)}["${escapeLabel(layer.name)}"]\n`;
    for (const comp of layer.components) {
      mermaid += `        ${sanitizeId(comp)}["${escapeLabel(comp)}"]\n`;
    }
    mermaid += '    end\n';
  }

  for (const flow of analysis.data_flow) {
    mermaid += `    ${sanitizeId(flow.from)} -->|"${escapeLabel(flow.description)}"| ${sanitizeId(flow.to)}\n`;
  }

  return mermaid;
}
```

### Section 3: Function Modules

```javascript
function generateFunctionDiagram(analysis, softwareName) {
  let mermaid = 'flowchart TD\n';
  mermaid += `    ROOT["${escapeLabel(softwareName)}"]\n`;

  for (const group of analysis.feature_groups) {
    mermaid += `    subgraph ${sanitizeId(group.group_name)}["${escapeLabel(group.group_name)}"]\n`;
    for (const feature of group.features) {
      mermaid += `        ${sanitizeId(feature.id)}["${escapeLabel(feature.name)}"]\n`;
    }
    mermaid += '    end\n';
    mermaid += `    ROOT --> ${sanitizeId(group.group_name)}\n`;
  }

  return mermaid;
}
```

### Section 4: Algorithm Flowchart (with branches)

```javascript
// Uses generateAlgorithmFlowchart from _shared/mermaid-utils.md
// Supports: type (process/decision/io), next, conditions

const flowchart = generateAlgorithmFlowchart({
  name: algorithm.name,
  inputs: algorithm.inputs,
  outputs: algorithm.outputs,
  steps: algorithm.steps  // Each step can have type, next, conditions
});
```

### Section 5: Class Diagram

```javascript
function generateClassDiagram(analysis) {
  let mermaid = 'classDiagram\n';

  for (const entity of analysis.entities) {
    mermaid += `    class ${sanitizeId(entity.name)} {\n`;
    for (const prop of entity.properties) {
      const vis = {public: '+', private: '-', protected: '#'}[prop.visibility] || '+';
      mermaid += `        ${vis}${sanitizeType(prop.type)} ${prop.name}\n`;
    }
    for (const method of entity.methods) {
      const vis = {public: '+', private: '-', protected: '#'}[method.visibility] || '+';
      mermaid += `        ${vis}${method.name}(${method.params}) ${sanitizeType(method.return_type)}\n`;
    }
    mermaid += '    }\n';
  }

  const arrows = {
    inheritance: '--|>',
    composition: '*--',
    aggregation: 'o--',
    association: '-->'
  };

  for (const rel of analysis.relationships) {
    const arrow = arrows[rel.type] || '-->';
    mermaid += `    ${sanitizeId(rel.from)} ${arrow} ${sanitizeId(rel.to)} : ${escapeLabel(rel.description)}\n`;
  }

  return mermaid;
}
```

### Section 6: Sequence Diagram

```javascript
function generateSequenceDiagram(scenario) {
  let mermaid = 'sequenceDiagram\n';

  for (const actor of scenario.actors) {
    mermaid += `    participant ${sanitizeId(actor.id)} as ${escapeLabel(actor.name)}\n`;
  }

  for (const msg of scenario.messages) {
    const arrow = msg.type === 'async' ? '-)' : '->>';
    mermaid += `    ${sanitizeId(msg.from)}${arrow}${sanitizeId(msg.to)}: ${escapeLabel(msg.description)}\n`;
  }

  return mermaid;
}
```

### Validation

```javascript
// Validate all generated diagrams
const results = validateDiagramDirectory(`${outputDir}/diagrams`);
const failed = results.filter(r => !r.valid);

if (failed.length > 0) {
  // Regenerate failed diagrams with stricter escaping
  for (const f of failed) {
    regenerateWithFixes(f.file, f.issues);
  }
}
```

## Output

Save diagrams to `diagrams/` with `manifest.json`.
