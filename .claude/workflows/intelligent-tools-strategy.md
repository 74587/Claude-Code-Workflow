---
name: intelligent-tools-strategy
description: Strategic decision framework for intelligent tool selection
type: strategic-guideline
---

# Intelligent Tools Selection Strategy

## ⚡ Core Framework

**Gemini**: Analysis, understanding, exploration & documentation
**Codex**: Development, implementation & automation

### Decision Principles
- **Use tools early and often** - Tools are faster, more thorough, and reliable than manual approaches
- **When in doubt, use both** - Parallel usage provides comprehensive coverage
- **Default to tools** - Use specialized tools for most coding tasks, no matter how small
- **Lower barriers** - Engage tools immediately when encountering any complexity

### Quick Decision Rules
1. **Exploring/Understanding?** → Start with Gemini
2. **Building/Fixing?** → Start with Codex
3. **Not sure?** → Use both in parallel
4. **Small task?** → Still use tools - they're faster than manual work

## 🎯 Tool Specifications

### Gemini (Analysis & Understanding)
**Command**: `~/.claude/scripts/gemini-wrapper -p "PURPOSE: [analysis goal] | TASK: [what to do] | EXPECTED: [expected results]"`

**Strengths**: Large context window, pattern recognition across modules

**Use Cases**:
- Any project analysis (≥5 files)
- Quick code exploration and familiarization
- Cross-module pattern detection and consistency checks
- Coding convention analysis and standardization
- Refactoring planning with dependency mapping
- Legacy code understanding and modernization paths
- API surface analysis and integration points
- Test coverage gaps and quality assessment
- Configuration file analysis and optimization
- Dependency audit and relationship mapping
- Code review preparation and checklist generation
- Documentation generation from existing code

### Codex (Development & Implementation)
**Command**: `codex --full-auto exec "PURPOSE: [development goal] | TASK: [what to implement] | EXPECTED: [expected code/features]" -s danger-full-access`

**Strengths**: Mathematical reasoning, autonomous development

**Use Cases**:
- Any feature development (simple to complex)
- Quick prototyping and proof-of-concepts
- Bug fixes and issue resolution
- Test generation and validation
- Code scaffolding and boilerplate creation
- Configuration setup and environment preparation
- Algorithm implementation and optimization
- Security vulnerability assessment and fixes
- Performance optimization and profiling
- Database schema design and migration
- API development and integration
- DevOps automation and deployment scripts
- Documentation automation and generation
- Code modernization and refactoring execution
- Dependency management and updates
- Build system optimization and tooling

### Structured Prompt Templates
```bash
# Gemini Analysis
~/.claude/scripts/gemini-wrapper -p "
PURPOSE: [clear analysis goal]
TASK: [specific analysis task]
EXPECTED: [expected output]
"

# Codex Development
codex --full-auto exec "
PURPOSE: [clear development goal]
TASK: [specific development task]
EXPECTED: [expected deliverables]
" -s danger-full-access
```

**Prompt Checklist**:
- [ ] **PURPOSE** - Clear goal and intent
- [ ] **TASK** - Specific execution task
- [ ] **EXPECTED** - Clear expected results

## 📊 Decision Matrix

| Task Category | Tool | Rationale | Frequency |
|--------------|------|-----------|-----------|
| **Understanding & Analysis** |
| Project Architecture | Gemini | Broad context across files | Weekly/Monthly |
| Code Exploration | Gemini | Quick module familiarization | Daily |
| Legacy Code Analysis | Gemini | Pattern recognition across systems | As needed |
| Dependency Mapping | Gemini | Cross-module relationship analysis | Sprint planning |
| Code Review Prep | Gemini | Comprehensive context understanding | Before reviews |
| **Development & Implementation** |
| Feature Development | Codex | Autonomous implementation capabilities | Daily |
| Bug Fixes | Codex | Targeted problem resolution | As issues arise |
| Prototyping | Codex | Rapid development and iteration | Weekly |
| Test Generation | Codex | Automated test creation | After feature work |
| Configuration Setup | Codex | Environment and tooling setup | Project setup |
| **Optimization & Maintenance** |
| Algorithm Optimization | Codex | Mathematical reasoning capabilities | Performance sprints |
| Security Analysis | Codex | Security knowledge and fixes | Security reviews |
| Performance Tuning | Codex | Mathematical optimization | Performance reviews |
| Code Modernization | Both | Gemini for planning, Codex for execution | Quarterly |
| **Documentation & Quality** |
| Documentation Generation | Both | Gemini for analysis, Codex for automation | Continuous |
| Coding Standards | Gemini | Pattern recognition and consistency | Code reviews |
| Test Coverage Analysis | Gemini | Cross-module test understanding | Sprint retrospectives |

## 📋 Workflow Integration

### Mandatory Planning Process
When planning any coding task, **ALWAYS** integrate CLI tools:

#### 1. Understanding Phase (Required)
- **Gemini Analysis**: Understand existing patterns, architecture, dependencies
- **Context Discovery**: Map related modules and integration points
- **Pattern Recognition**: Identify existing conventions and standards

#### 2. Development Strategy
- **Understanding/Analysis**: Gemini (primary), Codex (occasional)
- **Implementation**: Codex (occasional), manual development (primary)
- **Complex Tasks**: Both tools in sequence

#### 3. Workflow Pattern
```
Planning → Gemini Analysis → Manual Development → Codex Assistance (as needed)
```

### Tool Usage Guidelines

#### Gemini (Primary for Understanding)
- Always use for initial codebase analysis
- Pattern discovery and convention mapping
- Architecture understanding before implementation
- Dependency analysis and impact assessment
- Code review preparation

#### Codex (Occasional for Development)
- Selective use for complex algorithms
- Prototype generation for proof-of-concepts
- Boilerplate creation when patterns are clear
- Test generation and validation
- Performance optimization tasks

### Planning Checklist
For every development task:
- [ ] **Gemini analysis** completed for understanding
- [ ] **Existing patterns** identified and documented
- [ ] **Dependencies mapped** and integration points clear
- [ ] **CLI tool usage points** identified in workflow
- [ ] **Manual development approach** defined
- [ ] **Codex assistance triggers** identified (if applicable)

## 🚀 Usage Patterns

### Immediate Engagement Triggers
- **New codebase**: Use Gemini to understand structure before changes
- **Bug reports**: Use Codex to investigate and propose fixes
- **Feature requests**: Use Codex for rapid prototyping and implementation
- **Code reviews**: Use Gemini to prepare comprehensive analysis
- **Refactoring needs**: Use Gemini for impact analysis, Codex for execution

### Daily Integration Points
- **Morning standup prep**: Gemini for codebase overview
- **Sprint planning**: Both tools for effort estimation
- **Development tasks**: Codex for implementation
- **Testing**: Codex for test generation and coverage
- **Documentation**: Both tools for comprehensive docs

### Parallel Strategy
For complex projects requiring both broad context and deep analysis:
- **Gemini** for architectural understanding
- **Codex** for focused development tasks
- Run both via Task agents when comprehensive coverage needed

### Frequency Guidelines
- **Daily**: Use tools for routine development tasks
- **Immediate**: Engage tools at first sign of complexity
- **Continuous**: Integrate tools into regular workflow
- **Proactive**: Don't wait for problems - use tools preventively

## 🔗 Reference

**Complete syntax and usage patterns**: @~/.claude/workflows/tools-implementation-guide.md