# Gemini Intelligent Context System

**Smart context detection and file targeting system for Gemini CLI analysis.**

## Overview

The intelligent context system automatically resolves file paths and context based on user input, analysis type, and project structure detection, enabling precise and efficient codebase analysis.

## Smart Path Detection

### Technology Stack Detection

```python
def detect_technology_stack(project_path):
    """Detect technologies used in the project"""
    indicators = {
        'React': ['package.json contains react', '**/*.jsx', '**/*.tsx'],
        'Vue': ['package.json contains vue', '**/*.vue'],
        'Angular': ['angular.json', '**/*.component.ts'],
        'Node.js': ['package.json', 'server.js', 'app.js'],
        'Python': ['requirements.txt', '**/*.py', 'setup.py'],
        'Java': ['pom.xml', '**/*.java', 'build.gradle'],
        'TypeScript': ['tsconfig.json', '**/*.ts'],
        'Express': ['package.json contains express'],
        'FastAPI': ['**/*main.py', 'requirements.txt contains fastapi'],
        'Spring': ['pom.xml contains spring', '**/*Application.java']
    }
    return analyze_indicators(indicators, project_path)
```

### Project Structure Detection

```python
def detect_project_structure(project_path):
    """Identify common project patterns"""
    patterns = {
        'src_based': has_directory('src/'),
        'lib_based': has_directory('lib/'),
        'app_based': has_directory('app/'),
        'modules_based': has_directory('modules/'),
        'packages_based': has_directory('packages/'),
        'microservices': has_multiple_services(),
        'monorepo': has_workspaces_or_lerna()
    }
    return analyze_structure_patterns(patterns)
```

### Domain Context Detection

```python
def extract_domain_keywords(user_input):
    """Extract domain-specific keywords for smart targeting"""
    domain_mapping = {
        'auth': ['authentication', 'login', 'session', 'auth', 'oauth', 'jwt', 'token'],
        'api': ['api', 'endpoint', 'route', 'controller', 'service'],
        'frontend': ['component', 'ui', 'view', 'react', 'vue', 'angular'],
        'backend': ['server', 'backend', 'api', 'database', 'model'],
        'database': ['database', 'db', 'model', 'query', 'migration', 'schema'],
        'security': ['security', 'vulnerability', 'xss', 'csrf', 'injection'],
        'performance': ['performance', 'slow', 'optimization', 'bottleneck'],
        'testing': ['test', 'spec', 'mock', 'unit', 'integration', 'e2e'],
        'state': ['state', 'redux', 'context', 'store', 'vuex'],
        'config': ['config', 'environment', 'settings', 'env']
    }
    return match_domains(user_input.lower(), domain_mapping)
```

## Intelligent File Targeting

### Context-Aware Path Generation

| Domain Context | Generated File Patterns |
|----------------|------------------------|
| **Authentication** | `@{**/*auth*,**/*login*,**/*session*,**/middleware/*auth*,**/guards/**/*}` |
| **API Endpoints** | `@{**/api/**/*,**/routes/**/*,**/controllers/**/*,**/handlers/**/*}` |
| **Frontend Components** | `@{src/components/**/*,src/ui/**/*,src/views/**/*,components/**/*}` |
| **Database Layer** | `@{**/models/**/*,**/db/**/*,**/migrations/**/*,**/repositories/**/*}` |
| **State Management** | `@{**/store/**/*,**/redux/**/*,**/context/**/*,**/state/**/*}` |
| **Configuration** | `@{*.config.*,**/config/**/*,.env*,**/settings/**/*}` |
| **Testing** | `@{**/*.test.*,**/*.spec.*,**/test/**/*,**/spec/**/*,**/__tests__/**/*}` |
| **Security** | `@{**/*security*,**/*auth*,**/*crypto*,**/middleware/**/*}` |
| **Performance** | `@{**/core/**/*,**/services/**/*,**/utils/**/*,**/lib/**/*}` |

### Technology-Specific Extensions

```python
def get_tech_extensions(technology_stack):
    """Get relevant file extensions based on detected technologies"""
    extension_mapping = {
        'React': ['.jsx', '.tsx', '.js', '.ts'],
        'Vue': ['.vue', '.js', '.ts'], 
        'Angular': ['.component.ts', '.service.ts', '.module.ts'],
        'Node.js': ['.js', '.ts', '.mjs'],
        'Python': ['.py', '.pyx', '.pyi'],
        'Java': ['.java', '.kt', '.scala'],
        'TypeScript': ['.ts', '.tsx', '.d.ts'],
        'CSS': ['.css', '.scss', '.sass', '.less', '.styl']
    }
    return build_extension_patterns(technology_stack, extension_mapping)
```

## Dynamic Context Enhancement

### Smart Prompt Construction

```python
def build_intelligent_context(user_input, analysis_type, project_info):
    """Build context-aware Gemini CLI prompt"""
    
    # Step 1: Detect domains and technologies
    domains = extract_domain_keywords(user_input)
    tech_stack = project_info.technology_stack
    
    # Step 2: Generate smart file patterns
    file_patterns = generate_file_patterns(domains, tech_stack, analysis_type)
    
    # Step 3: Include relevant CLAUDE.md contexts
    claude_patterns = generate_claude_patterns(domains, project_info.structure)
    
    # Step 4: Build context-enriched prompt
    return construct_enhanced_prompt(
        base_prompt=user_input,
        file_patterns=file_patterns,
        claude_context=claude_patterns,
        analysis_focus=get_analysis_focus(analysis_type),
        tech_context=tech_stack
    )
```

### Context Validation and Fallbacks

```python
def validate_and_fallback_context(generated_patterns, project_path):
    """Ensure generated patterns match actual project structure"""
    validated_patterns = []
    
    for pattern in generated_patterns:
        if has_matching_files(pattern, project_path):
            validated_patterns.append(pattern)
        else:
            # Try fallback patterns
            fallback = generate_fallback_pattern(pattern, project_path)
            if fallback:
                validated_patterns.append(fallback)
    
    return validated_patterns or get_generic_patterns(project_path)
```

## Integration Patterns

### Command Integration Examples

```python
def gather_gemini_insights(user_input, base_enhancement):
    # Use intelligent context system
    context = build_intelligent_context(
        user_input=user_input,
        analysis_type=determine_analysis_type(base_enhancement),
        project_info=get_project_info()
    )
    
    # Select appropriate template
    template = select_template(base_enhancement.complexity, base_enhancement.domains)
    
    # Execute with enhanced context
    return execute_template(template, context)
```

### Agent Workflow Integration

```python
# Before agent execution, collect enhanced context
def collect_enhanced_gemini_context(task_description):
    domains = extract_domain_keywords(task_description)
    analysis_types = determine_required_analysis(domains)
    
    context_results = {}
    for analysis_type in analysis_types:
        # Use appropriate template file based on analysis type
        if analysis_type.startswith('dms'):
            template_path = f"workflows/gemini-dms-templates.md#{analysis_type}"
        elif analysis_type in ['planning-agent-context', 'code-developer-context', 'code-review-context', 'ui-design-context']:
            template_path = f"workflows/gemini-agent-templates.md#{analysis_type}"
        else:
            template_path = f"workflows/gemini-core-templates.md#{analysis_type}"
        
        context_results[analysis_type] = execute_template_by_reference(
            template_path, 
            task_description
        )
    
    return consolidate_context(context_results)
```

### Smart Template Selection

```python
def select_optimal_template(task_complexity, domains, tech_stack):
    template_matrix = {
        ('simple', ['frontend']): 'pattern-analysis',
        ('medium', ['frontend', 'api']): ['pattern-analysis', 'architecture-analysis'],
        ('complex', ['security', 'auth']): ['security-analysis', 'architecture-analysis', 'quality-analysis'],
        ('critical', ['payment', 'crypto']): ['security-analysis', 'performance-analysis', 'dependencies-analysis']
    }
    
    return template_matrix.get((task_complexity, sorted(domains)), ['pattern-analysis'])
```

## Usage Guidelines

### Performance Optimization

1. **Scope file patterns appropriately** - Too broad patterns slow analysis
2. **Use technology-specific extensions** - More precise targeting improves results
3. **Implement pattern validation** - Check patterns match files before execution
4. **Consider project size** - Large projects may need pattern chunking

### Maintenance

1. **Update templates regularly** - Keep pace with new technologies and patterns
2. **Validate anchor links** - Ensure cross-references remain accurate
3. **Test intelligent context** - Verify smart targeting works across project types
4. **Monitor template performance** - Track analysis quality and speed

This intelligent context system provides the foundation for all Gemini CLI analysis, ensuring efficient and precise codebase understanding across different commands and agents.