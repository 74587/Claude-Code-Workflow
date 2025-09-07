# Gemini DMS Analysis Templates

**Specialized templates for Distributed Memory System (DMS) analysis and documentation hierarchy optimization.**

## Overview

This document provides DMS-specific analysis templates for architecture analysis, complexity assessment, content strategy, module analysis, and cross-module coordination for intelligent documentation hierarchy management.

## DMS Architecture Analysis

### Template Structure
```bash
gemini --all-files -p "@{project_patterns} @{module_patterns}

Context: DMS architecture analysis for @{project_patterns}
Module structure: @{module_patterns}
Guidelines: Project standards from @{claude_context}

Analyze {target} hierarchical documentation structure:
1. Project complexity assessment (file count, LOC, tech stack diversity)
2. Module responsibility boundaries and architectural patterns
3. Cross-module dependencies and integration points
4. Technology stack analysis and framework usage patterns
5. Content hierarchy strategy (depth 0-2 classification)

Provide intelligent classification recommendations with hierarchy mapping."
```

### Intelligent Usage Examples
```python
# Project structure analysis for DMS hierarchy
def dms_architecture_analysis(target_path):
    context = build_intelligent_context(
        user_input=f"DMS architecture analysis for {target_path}",
        analysis_type="architecture",
        domains=['dms', 'documentation'],
        tech_stack=detect_project_tech_stack(target_path)
    )
    
    return f"""
    gemini --all-files -p "@{{{target_path}/**/*}} @{{**/*CLAUDE.md}}
    @{{CLAUDE.md,**/*CLAUDE.md,.claude/*/CLAUDE.md}}
    
    Analyze project structure for DMS hierarchy optimization:
    - Project complexity: file count, lines of code, technology diversity
    - Module boundaries: logical groupings, responsibility separation  
    - Cross-dependencies: integration patterns, shared utilities
    - Documentation needs: complexity-based hierarchy requirements
    - Content differentiation: level-specific focus areas
    - Classification thresholds: >3 files or >300 LOC triggers
    
    Provide smart hierarchy recommendations with classification rationale."
    """
```

## DMS Complexity Assessment

### Template Structure
```bash
gemini --all-files -p "@{assessment_patterns} @{technology_patterns}

Context: DMS complexity assessment at @{assessment_patterns}
Technology stack: @{technology_patterns}  
Guidelines: Classification rules from @{claude_context}

Evaluate {target} for intelligent DMS classification:
1. File count analysis and logical grouping assessment
2. Lines of code distribution and complexity indicators
3. Technology stack diversity and integration complexity
4. Cross-module dependencies and architectural coupling
5. Documentation requirements based on complexity metrics

Provide classification recommendations with threshold justification."
```

### Intelligent Usage Examples
```python
# Project complexity evaluation for smart classification
def dms_complexity_assessment(project_scope):
    context = build_intelligent_context(
        user_input=f"Complexity assessment for {project_scope}",
        analysis_type="quality",
        domains=['dms', 'classification'],
        project_info=analyze_project_structure(project_scope)
    )
    
    return f"""
    gemini --all-files -p "@{{{project_scope}}} @{{package*.json,requirements.txt,pom.xml}}
    @{{CLAUDE.md,**/CLAUDE.md}}
    
    Assess project complexity for DMS classification:
    - Single-file detection: 1-2 files → consolidated documentation
    - Simple project: 3-10 files, <800 LOC → minimal hierarchy  
    - Medium project: 11-100 files, 800-3000 LOC → selective hierarchy
    - Complex project: >100 files, >3000 LOC → full hierarchy
    - Technology stack: framework diversity impact on documentation needs
    - Integration complexity: cross-module dependency analysis
    
    Recommend optimal DMS structure with classification thresholds."
    """
```

## DMS Content Strategy

### Template Structure
```bash
gemini --all-files -p "@{content_patterns} @{reference_patterns}

Context: DMS content strategy for @{content_patterns}
Reference patterns: @{reference_patterns}
Guidelines: Content standards from @{claude_context}

Develop {target} content differentiation strategy:
1. Level-specific content focus and responsibility boundaries  
2. Content hierarchy optimization and redundancy elimination
3. Implementation pattern identification and documentation priorities
4. Cross-level content flow and reference strategies
5. Quality standards and actionable guideline emphasis

Provide content strategy with level-specific focus areas."
```

### Intelligent Usage Examples
```python
# Content strategy for hierarchical documentation
def dms_content_strategy(hierarchy_levels):
    context = build_intelligent_context(
        user_input=f"Content strategy for {len(hierarchy_levels)} levels",
        analysis_type="quality",
        domains=['dms', 'content', 'hierarchy'],
        levels_info=hierarchy_levels
    )
    
    return f"""
    gemini --all-files -p "@{{**/*.{{js,ts,jsx,tsx,py,java}}}} @{{**/CLAUDE.md}}
    @{{CLAUDE.md,.claude/*/CLAUDE.md}}
    
    Develop content differentiation strategy:
    - Depth 0 (Project): Architecture, tech stack, global standards
    - Depth 1 (Module): Module patterns, integration, responsibilities
    - Depth 2 (Implementation): Details, gotchas, specific guidelines
    - Content consolidation: Merge depth 3+ content into depth 2
    - Redundancy elimination: Unique focus per level
    - Non-obvious priority: Essential decisions, actionable patterns
    
    Provide level-specific content guidelines with focus differentiation."
    """
```

## DMS Module Analysis

### Template Structure
```bash
gemini --all-files -p "@{module_patterns} @{integration_patterns}

Context: DMS module analysis for @{module_patterns}
Integration context: @{integration_patterns}
Guidelines: Module standards from @{claude_context}

Analyze {target} module-specific documentation needs:
1. Module responsibility boundaries and architectural role
2. Internal implementation patterns and conventions
3. External integration points and dependency management  
4. Module-specific quality standards and best practices
5. Documentation depth requirements based on complexity

Provide module documentation strategy with integration focus."
```

### Intelligent Usage Examples
```python
# Module-specific analysis for targeted documentation
def dms_module_analysis(module_path):
    context = build_intelligent_context(
        user_input=f"Module analysis for {module_path}",
        analysis_type="architecture",
        domains=['dms', 'module'],
        module_info=analyze_module_structure(module_path)
    )
    
    return f"""
    gemini --all-files -p "@{{{module_path}/**/*}} @{{**/*{module_path.split('/')[-1]}*}}
    @{{CLAUDE.md,{module_path}/CLAUDE.md}}
    
    Analyze module for documentation strategy:
    - Module boundaries: responsibility scope, architectural role
    - Implementation patterns: internal conventions, code organization
    - Integration points: external dependencies, API contracts  
    - Quality standards: module-specific testing, validation patterns
    - Complexity indicators: >3 files or >300 LOC → dedicated CLAUDE.md
    - Documentation depth: implementation details vs architectural overview
    
    Recommend module documentation approach with depth justification."
    """
```

## DMS Cross-Module Analysis

### Template Structure
```bash
gemini --all-files -p "@{cross_module_patterns} @{dependency_patterns}

Context: DMS cross-module analysis for @{cross_module_patterns}  
Dependencies: @{dependency_patterns}
Guidelines: Integration standards from @{claude_context}

Analyze {target} cross-module documentation requirements:
1. Inter-module dependency mapping and communication patterns
2. Shared utility identification and documentation consolidation  
3. Integration complexity assessment and documentation depth
4. Cross-cutting concern identification and hierarchy placement
5. Documentation coordination strategy across module boundaries

Provide cross-module documentation strategy with integration focus."
```

### Intelligent Usage Examples
```python
# Cross-module analysis for integration documentation
def dms_cross_module_analysis(affected_modules):
    context = build_intelligent_context(
        user_input=f"Cross-module analysis for {len(affected_modules)} modules",
        analysis_type="architecture", 
        domains=['dms', 'integration', 'modules'],
        modules_info=affected_modules
    )
    
    module_patterns = ','.join([f"{m}/**/*" for m in affected_modules])
    
    return f"""
    gemini --all-files -p "@{{{module_patterns}}} @{{**/shared/**/*,**/common/**/*}}
    @{{CLAUDE.md,**/CLAUDE.md}}
    
    Analyze cross-module integration for documentation:  
    - Dependency mapping: module interdependencies, communication flow
    - Shared patterns: common utilities, cross-cutting concerns
    - Integration complexity: >5 modules → enhanced coordination documentation
    - Documentation coordination: avoid redundancy across module boundaries
    - Hierarchy placement: integration patterns at appropriate depth levels
    - Reference strategies: cross-module links and shared guideline access
    
    Provide integration documentation strategy with coordination guidelines."
    """
```

## DMS Classification Matrix

### Project Complexity Thresholds

| Complexity Level | File Count | Lines of Code | Tech Stack | Hierarchy Strategy |
|------------------|------------|---------------|------------|-------------------|
| **Single File** | 1-2 files | <300 LOC | 1 technology | Consolidated docs |
| **Simple** | 3-10 files | 300-800 LOC | 1-2 technologies | Minimal hierarchy |
| **Medium** | 11-100 files | 800-3000 LOC | 2-3 technologies | Selective hierarchy |
| **Complex** | >100 files | >3000 LOC | >3 technologies | Full hierarchy |

### Documentation Depth Strategy

| Depth Level | Focus Areas | Content Types | Triggers |
|-------------|-------------|---------------|----------|
| **Depth 0 (Project)** | Architecture, global standards, tech stack overview | High-level patterns, system design | Always present |
| **Depth 1 (Module)** | Module patterns, integration points, responsibilities | Interface contracts, module APIs | >3 files or >300 LOC |
| **Depth 2 (Implementation)** | Implementation details, gotchas, specific guidelines | Code patterns, edge cases | Complex modules |

## Integration with Intelligent Context

All DMS templates integrate with @~/.claude/workflows/gemini-intelligent-context.md for:

- **Smart Project Classification** - Automatic complexity assessment based on project metrics
- **Module Boundary Detection** - Intelligent identification of logical module groupings
- **Hierarchy Optimization** - Content differentiation strategies across documentation levels
- **Cross-Module Coordination** - Integration pattern analysis for documentation coordination

## Template Usage Guidelines

1. **Assess Project Complexity First** - Use complexity assessment to determine appropriate hierarchy
2. **Apply Classification Thresholds** - Follow established metrics for documentation depth decisions
3. **Coordinate Across Modules** - Use cross-module analysis for integration documentation
4. **Optimize Content Differentiation** - Ensure unique focus areas for each hierarchy level
5. **Validate Documentation Strategy** - Check hierarchy alignment with project structure

These DMS-specific templates enable intelligent documentation hierarchy management and content optimization for distributed memory systems.