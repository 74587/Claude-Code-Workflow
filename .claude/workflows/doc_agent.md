# Documentation Agent

## Agent Overview
Specialized agent for hierarchical documentation generation with bottom-up analysis approach.

## Core Capabilities
- **Modular Analysis**: Analyze individual modules and components
- **Hierarchical Synthesis**: Build documentation from modules to system level
- **Multi-tool Integration**: Combine Agent tasks, CLI tools, and direct analysis
- **Progress Tracking**: Use TodoWrite throughout the documentation process

## Analysis Strategy

### Two-Level Hierarchy
1. **Level 1 (Module)**: Individual component/module documentation
2. **Level 2 (System)**: Integrated system-wide documentation

### Bottom-Up Process
1. **Module Discovery**: Identify all modules/components in the system
2. **Module Analysis**: Deep dive into each module individually
3. **Module Documentation**: Generate detailed module docs
4. **Integration Analysis**: Analyze relationships between modules
5. **System Synthesis**: Create unified system documentation

## Tool Selection Strategy

### For Module Analysis (Simple, focused scope)
- **CLI Tools**: Direct Gemini/Codex commands for individual modules
- **File Patterns**: Focused file sets per module
- **Fast Processing**: Quick analysis of contained scope

### For System Integration (Complex, multi-module)
- **Agent Tasks**: Complex analysis requiring multiple tools
- **Cross-module Analysis**: Relationship mapping between modules
- **Synthesis Tasks**: Combining multiple module analyses

## Documentation Structure

### Module Level (Level 1)
```
.workflow/docs/modules/
├── [module-name]/
│   ├── overview.md        # Module overview
│   ├── api.md            # Module APIs
│   ├── dependencies.md   # Module dependencies
│   └── examples.md       # Usage examples
```

### System Level (Level 2)
```
.workflow/docs/
├── README.md             # Complete system overview
├── architecture/
│   ├── system-design.md  # High-level architecture
│   ├── module-map.md     # Module relationships
│   ├── data-flow.md      # System data flow
│   └── tech-stack.md     # Technology decisions
└── api/
    ├── unified-api.md    # Complete API documentation
    └── openapi.yaml      # OpenAPI specification
```

## Process Flow Templates

### Phase 1: Module Discovery & Todo Setup
```json
{
  "step": "module_discovery",
  "method": "cli",
  "command": "find src/ -type d -name '*' | grep -v node_modules | head -20",
  "purpose": "Identify all modules for documentation",
  "todo_action": "create_module_todos"
}
```

### Phase 2: Module Analysis (Parallel)
```json
{
  "step": "module_analysis",
  "method": "cli_parallel",
  "pattern": "per_module",
  "command_template": "~/.claude/scripts/gemini-wrapper -p 'ANALYZE_MODULE: {module_path}'",
  "purpose": "Analyze each module individually",
  "todo_action": "track_module_progress"
}
```

### Phase 3: Module Documentation (Parallel)
```json
{
  "step": "module_documentation",
  "method": "cli_parallel",
  "pattern": "per_module",
  "command_template": "codex --full-auto exec 'DOCUMENT_MODULE: {module_path}' -s danger-full-access",
  "purpose": "Generate documentation for each module",
  "todo_action": "mark_module_complete"
}
```

### Phase 4: System Integration (Agent)
```json
{
  "step": "system_integration",
  "method": "agent",
  "agent_type": "general-purpose",
  "purpose": "Analyze cross-module relationships and create system view",
  "todo_action": "track_integration_progress"
}
```

### Phase 5: System Documentation (Agent)
```json
{
  "step": "system_documentation",
  "method": "agent",
  "agent_type": "general-purpose",
  "purpose": "Generate unified system documentation",
  "todo_action": "mark_system_complete"
}
```

## CLI Command Templates

### Module Analysis Template
```bash
~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Analyze individual module for documentation
TASK: Deep analysis of module structure, APIs, and dependencies
CONTEXT: @{{{module_path}}/**/*}
EXPECTED: Module analysis for documentation generation

MODULE ANALYSIS RULES:
1. Module Scope Definition:
   - Identify module boundaries and entry points
   - Map internal file organization
   - Extract module's primary purpose and responsibilities

2. API Surface Analysis:
   - Identify exported functions, classes, and interfaces
   - Document public API contracts
   - Map input/output types and parameters

3. Dependency Analysis:
   - Extract internal dependencies within module
   - Identify external dependencies from other modules
   - Map configuration and environment dependencies

4. Usage Pattern Analysis:
   - Find example usage within codebase
   - Identify common patterns and utilities
   - Document error handling approaches

OUTPUT FORMAT:
- Module overview with clear scope definition
- API documentation with types and examples
- Dependency map with clear relationships
- Usage examples from actual codebase
" -t 1200000
```

### Module Documentation Template
```bash
codex --full-auto exec "
PURPOSE: Generate comprehensive module documentation
TASK: Create detailed documentation for analyzed module
CONTEXT: Module analysis results from Gemini
EXPECTED: Complete module documentation in .workflow/docs/modules/{module_name}/

DOCUMENTATION GENERATION RULES:
1. Create module directory structure
2. Generate overview.md with module purpose and architecture
3. Create api.md with detailed API documentation
4. Generate dependencies.md with dependency analysis
5. Create examples.md with practical usage examples
6. Ensure consistent formatting and cross-references
" -s danger-full-access -t 1200000
```

## Agent Task Templates

### System Integration Agent Task
```json
{
  "description": "Analyze cross-module relationships",
  "prompt": "You are analyzing a software system to understand relationships between modules. Your task is to:\n\n1. Read all module documentation from .workflow/docs/modules/\n2. Identify integration points and data flow between modules\n3. Map system-wide architecture patterns\n4. Create unified view of system structure\n\nAnalyze the modules and create:\n- Module relationship map\n- System data flow documentation\n- Integration points analysis\n- Architecture pattern identification\n\nUse TodoWrite to track your progress through the analysis.",
  "subagent_type": "general-purpose"
}
```

### System Documentation Agent Task
```json
{
  "description": "Generate unified system documentation",
  "prompt": "You are creating comprehensive system documentation based on module analyses. Your task is to:\n\n1. Synthesize information from .workflow/docs/modules/ \n2. Create unified system architecture documentation\n3. Generate complete API documentation\n4. Create system overview and navigation\n\nGenerate:\n- README.md with system overview\n- architecture/ directory with system design docs\n- api/ directory with unified API documentation\n- Cross-references between all documentation\n\nUse TodoWrite to track documentation generation progress.",
  "subagent_type": "general-purpose"
}
```

## Progress Tracking Templates

### Module Todo Structure
```json
{
  "content": "Analyze {module_name} module",
  "activeForm": "Analyzing {module_name} module",
  "status": "pending"
}
```

### Integration Todo Structure
```json
{
  "content": "Integrate module analyses into system view",
  "activeForm": "Integrating module analyses",
  "status": "pending"
}
```

### Documentation Todo Structure
```json
{
  "content": "Generate unified system documentation",
  "activeForm": "Generating system documentation",
  "status": "pending"
}
```

## Error Handling & Recovery

### Module Analysis Failures
- Skip failed modules with warning
- Continue with successful modules
- Retry failed modules with different approach

### Integration Failures
- Fall back to manual integration
- Use partial results where available
- Generate documentation with known limitations

### Documentation Generation Failures
- Generate partial documentation
- Include clear indicators of incomplete sections
- Provide recovery instructions

## Quality Assurance

### Module Documentation Quality
- Verify all modules have complete documentation
- Check API documentation completeness
- Validate examples and cross-references

### System Documentation Quality
- Ensure module integration is complete
- Verify system overview accuracy
- Check documentation navigation and links