# Gemini Core Analysis Templates

**Comprehensive templates for core codebase analysis using Gemini CLI.**

## Overview

This document provides core analysis templates for pattern detection, architecture analysis, security assessment, performance optimization, feature tracing, quality analysis, dependencies review, and migration planning.

## Pattern Analysis

### Template Structure
```bash
gemini --all-files -p "@{file_patterns} @{claude_context}

Context: Pattern analysis targeting @{file_patterns}
Guidelines: Include CLAUDE.md standards from @{claude_context}

Analyze this codebase and identify all {target} patterns.
Focus on:
1. Implementation patterns in specified files
2. Compliance with project guidelines from CLAUDE.md
3. Best practices and anti-patterns
4. Usage frequency and distribution across modules
5. Specific examples with file:line references

Include concrete recommendations based on existing patterns."
```

### Intelligent Usage Examples
```python
# Simple pattern detection
def pattern_analysis(user_input):
    context = build_intelligent_context(
        user_input="React hooks usage patterns",
        analysis_type="pattern",
        domains=['frontend', 'state'],
        tech_stack=['React', 'TypeScript']
    )
    
    return f"""
    gemini --all-files -p "@{{**/*.{{jsx,tsx,js,ts}}}} @{{**/hooks/**/*,**/context/**/*}} 
    @{{CLAUDE.md,frontend/CLAUDE.md,react/CLAUDE.md}}
    
    Analyze React hooks patterns in this codebase:
    - Custom hooks implementation and naming conventions
    - useState/useEffect usage patterns and dependencies
    - Context providers and consumers
    - Hook composition and reusability
    - Performance considerations and optimization
    - Compliance with React best practices
    - Project-specific patterns from CLAUDE.md
    
    Focus on TypeScript implementations and provide specific file:line examples."
    """
```

## Architecture Analysis

### Template Structure
```bash
gemini --all-files -p "@{module_patterns} @{claude_context}

Context: System architecture analysis at @{module_patterns}
Project structure: @{structure_patterns}
Guidelines: @{claude_context}

Examine the {target} in this application.
Analyze:
1. Component hierarchy and module organization
2. Data flow and state management patterns
3. Dependency relationships and coupling
4. Architectural patterns and design decisions
5. Integration points and boundaries

Map findings to specific files and provide architecture insights."
```

### Intelligent Usage Examples
```python
# Microservices architecture analysis
def architecture_analysis(user_input):
    context = build_intelligent_context(
        user_input="microservices communication patterns",
        analysis_type="architecture", 
        domains=['api', 'backend'],
        tech_stack=['Node.js', 'Docker']
    )
    
    return f"""
    gemini --all-files -p "@{{**/services/**/*,**/api/**/*,**/gateway/**/*}} 
    @{{docker-compose*.yml,**/Dockerfile,**/*.proto}}
    @{{CLAUDE.md,architecture/CLAUDE.md,services/CLAUDE.md}}
    
    Analyze microservices architecture:
    - Service boundaries and single responsibilities
    - Inter-service communication patterns (REST, gRPC, events)
    - API gateway configuration and routing
    - Service discovery and load balancing
    - Data consistency and transaction boundaries
    - Deployment and orchestration patterns
    - Compliance with architectural guidelines
    
    Include service dependency graph and communication flow diagrams."
    """
```

## Security Analysis

### Template Structure
```bash
gemini --all-files -p "@{security_patterns} @{auth_patterns} @{config_patterns}

Context: Security analysis scope @{security_patterns}
Auth modules: @{auth_patterns}
Config files: @{config_patterns}
Guidelines: Security standards from @{claude_context}

Scan for {target} security vulnerabilities.
Check:
1. Authentication and authorization implementations
2. Input validation and sanitization
3. Sensitive data handling and encryption
4. Security headers and configurations
5. Third-party dependency vulnerabilities

Provide OWASP-aligned findings with severity levels and remediation steps."
```

### Intelligent Usage Examples
```python
# OAuth2 security analysis
def security_analysis(user_input):
    context = build_intelligent_context(
        user_input="OAuth2 authentication vulnerabilities",
        analysis_type="security",
        domains=['auth', 'security'],
        tech_stack=['Node.js', 'JWT']
    )
    
    return f"""
    gemini --all-files -p "@{{**/auth/**/*,**/oauth/**/*,**/middleware/*auth*}} 
    @{{**/config/**/*,.env*,**/*.pem,**/*.key}}
    @{{CLAUDE.md,security/CLAUDE.md,auth/CLAUDE.md}}
    
    Analyze OAuth2 authentication security:
    - Authorization code flow implementation
    - Token storage and handling security
    - Client authentication and PKCE implementation
    - Scope validation and privilege escalation risks
    - JWT token signature verification
    - Refresh token rotation and revocation
    - CSRF and state parameter validation
    - Redirect URI validation
    
    Apply OWASP OAuth2 Security Cheat Sheet standards and provide specific vulnerability findings."
    """
```

## Performance Analysis

### Template Structure
```bash
gemini --all-files -p "@{performance_patterns} @{core_patterns}

Context: Performance analysis at @{performance_patterns}
Core modules: @{core_patterns}
Guidelines: Performance standards from @{claude_context}

Analyze {target} performance issues.
Examine:
1. Expensive operations and computational complexity
2. Memory usage and potential leaks
3. Database query efficiency and N+1 problems
4. Network requests and data transfer optimization
5. Rendering performance and re-render cycles

Include performance metrics and optimization recommendations."
```

### Intelligent Usage Examples
```python
# React rendering performance analysis
def performance_analysis(user_input):
    context = build_intelligent_context(
        user_input="React component rendering performance",
        analysis_type="performance",
        domains=['frontend', 'performance'],
        tech_stack=['React', 'TypeScript']
    )
    
    return f"""
    gemini --all-files -p "@{{src/components/**/*.{{jsx,tsx}},src/hooks/**/*}} 
    @{{**/context/**/*,**/store/**/*}}
    @{{CLAUDE.md,performance/CLAUDE.md,react/CLAUDE.md}}
    
    Analyze React rendering performance issues:
    - Component re-render cycles and unnecessary renders
    - useMemo/useCallback optimization opportunities
    - Context provider optimization and value memoization
    - Large list virtualization needs
    - Bundle splitting and lazy loading opportunities
    - State update batching and scheduling
    - Memory leaks in useEffect cleanup
    - Performance impact of prop drilling
    
    Include React DevTools Profiler insights and specific optimization recommendations."
    """
```

## Feature Tracing

### Template Structure
```bash
gemini --all-files -p "@{feature_patterns} @{related_patterns}

Context: Feature implementation at @{feature_patterns}
Related modules: @{related_patterns}
Guidelines: Feature standards from @{claude_context}

Trace the implementation of {target} throughout this codebase.
Map:
1. Entry points (UI components, API endpoints)
2. Business logic and data processing
3. Database models and queries
4. State management and data flow
5. Integration points with other features

Show complete feature flow with file:line references."
```

### Intelligent Usage Examples
```python
# Payment processing feature trace
def feature_tracing(user_input):
    context = build_intelligent_context(
        user_input="payment processing system",
        analysis_type="feature",
        domains=['api', 'database', 'frontend'],
        tech_stack=['Node.js', 'React', 'PostgreSQL']
    )
    
    return f"""
    gemini --all-files -p "@{{**/payment/**/*,**/billing/**/*,**/stripe/**/*}} 
    @{{**/models/*payment*,**/models/*order*,**/api/*payment*}}
    @{{src/components/*payment*,src/pages/*checkout*}}
    @{{CLAUDE.md,payment/CLAUDE.md,api/CLAUDE.md}}
    
    Trace complete payment processing implementation:
    - Frontend: Payment forms, checkout flow, success/error handling
    - API: Payment endpoints, validation, webhook handling
    - Business Logic: Payment calculation, tax, discounts, refunds
    - Database: Payment models, transaction records, audit logs
    - Integration: Stripe/PayPal integration, notification systems
    - Security: PCI compliance, data encryption, fraud detection
    - Error Handling: Payment failures, retry logic, recovery flows
    
    Map the entire payment flow from UI interaction to database persistence."
    """
```

## Quality Analysis

### Template Structure
```bash
gemini --all-files -p "@{quality_patterns} @{test_patterns}

Context: Code quality assessment at @{quality_patterns}
Test coverage: @{test_patterns}
Guidelines: Quality standards from @{claude_context}

Examine {target} in this codebase.
Assess:
1. Code consistency and style compliance
2. Error handling and edge case coverage
3. Testing coverage and quality
4. Documentation completeness
5. Maintainability and refactoring opportunities

Provide actionable quality improvement recommendations with priorities."
```

### Intelligent Usage Examples
```python
# TypeScript code quality analysis
def quality_analysis(user_input):
    context = build_intelligent_context(
        user_input="TypeScript code quality and consistency",
        analysis_type="quality",
        domains=['frontend', 'testing'],
        tech_stack=['TypeScript', 'React', 'Jest']
    )
    
    return f"""
    gemini --all-files -p "@{{**/*.{{ts,tsx}},src/**/*}} 
    @{{**/*.test.{{ts,tsx}},**/*.spec.{{ts,tsx}}}}
    @{{CLAUDE.md,typescript/CLAUDE.md,testing/CLAUDE.md}}
    
    Analyze TypeScript code quality:
    - Type safety: any usage, strict mode compliance, type assertions
    - Interface design: proper abstractions, generic usage, utility types
    - Error handling: proper error types, exception handling patterns
    - Code consistency: naming conventions, file organization, imports
    - Testing quality: type-safe tests, mock implementations, coverage
    - Documentation: TSDoc comments, README updates, type exports
    - Performance: bundle analysis, tree-shaking optimization
    - Maintainability: code duplication, complexity metrics
    
    Prioritize recommendations by impact and provide specific file:line examples."
    """
```

## Dependencies Analysis

### Template Structure
```bash
gemini --all-files -p "@{dependency_patterns} @{package_patterns}

Context: Dependency analysis at @{dependency_patterns}
Package files: @{package_patterns}
Guidelines: Dependency standards from @{claude_context}

Analyze {target} in this project.
Review:
1. Third-party library usage and necessity
2. Version consistency and update availability
3. Security vulnerabilities in dependencies
4. Bundle size impact and optimization opportunities
5. Licensing compatibility and compliance

Show dependency graph with recommendations for optimization."
```

### Intelligent Usage Examples
```python
# Node.js dependencies security analysis
def dependencies_analysis(user_input):
    context = build_intelligent_context(
        user_input="Node.js dependencies security vulnerabilities",
        analysis_type="dependencies",
        domains=['security', 'config'],
        tech_stack=['Node.js', 'npm']
    )
    
    return f"""
    gemini --all-files -p "@{{package*.json,yarn.lock,pnpm-lock.yaml}} 
    @{{**/node_modules/**/package.json}} @{{.npmrc,.yarnrc*}}
    @{{CLAUDE.md,security/CLAUDE.md,dependencies/CLAUDE.md}}
    
    Analyze Node.js dependencies for security issues:
    - Vulnerability scanning: known CVEs, security advisories
    - Outdated packages: major version gaps, EOL dependencies
    - License compliance: GPL conflicts, commercial restrictions
    - Bundle impact: largest dependencies, tree-shaking opportunities
    - Maintenance status: abandoned packages, low activity projects
    - Alternative recommendations: lighter alternatives, native implementations
    - Development vs production: devDependency misclassification
    - Version pinning: semantic versioning strategy, lock file consistency
    
    Provide dependency upgrade roadmap with security priority rankings."
    """
```

## Migration Analysis

### Template Structure
```bash
gemini --all-files -p "@{migration_patterns} @{legacy_patterns}

Context: Migration analysis at @{migration_patterns}
Legacy code: @{legacy_patterns}
Guidelines: Migration standards from @{claude_context}

Identify {target} that could benefit from modernization.
Find:
1. Outdated patterns and deprecated APIs
2. Performance inefficiencies and technical debt
3. Security vulnerabilities in legacy code
4. Opportunities for newer language features
5. Framework upgrade paths and compatibility

Provide prioritized migration roadmap with risk assessment."
```

### Intelligent Usage Examples
```python
# React class to hooks migration analysis
def migration_analysis(user_input):
    context = build_intelligent_context(
        user_input="React class components to hooks migration",
        analysis_type="migration",
        domains=['frontend'],
        tech_stack=['React', 'JavaScript', 'TypeScript']
    )
    
    return f"""
    gemini --all-files -p "@{{src/components/**/*.{{jsx,js}},src/containers/**/*}} 
    @{{**/legacy/**/*,**/deprecated/**/*}}
    @{{CLAUDE.md,react/CLAUDE.md,migration/CLAUDE.md}}
    
    Analyze React class components for hooks migration:
    - Class components: lifecycle methods, state usage, refs
    - HOC patterns: higher-order components vs custom hooks
    - Render props: render prop patterns vs hook alternatives
    - Legacy context: old context API vs useContext
    - Performance: shouldComponentUpdate vs React.memo
    - Testing: enzyme vs testing-library compatibility
    - Bundle size: potential size reduction after migration
    - Breaking changes: prop types, default props handling
    
    Provide migration priority matrix based on complexity and benefit."
    """
```

## Template Usage Guidelines

1. **Always use intelligent context** - Let the system generate smart file patterns
2. **Reference specific sections** - Use anchor links for modular access
3. **Validate generated patterns** - Ensure patterns match actual project structure
4. **Combine templates strategically** - Use multiple templates for comprehensive analysis
5. **Cache context results** - Reuse context analysis across multiple templates

## Integration with Intelligent Context

All templates integrate with @~/.claude/workflows/gemini-intelligent-context.md for:

- **Smart Path Detection** - Automatic file targeting based on analysis type
- **Technology Stack Detection** - Framework and language-specific optimizations
- **Domain Context Mapping** - Intelligent domain-specific pattern matching
- **Dynamic Prompt Enhancement** - Context-aware prompt construction

For complete context detection algorithms and intelligent file targeting, see the dedicated intelligent context documentation.