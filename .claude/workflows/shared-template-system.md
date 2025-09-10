---
name: shared-template-system
description: Unified template directory structure and organization for Gemini and Codex CLI integration
type: system-architecture
---

# 🗂️ Shared Template System

## Overview

This document defines the unified template system shared between Gemini (analysis) and Codex (development) CLI tools. The template system provides standardized, reusable prompts for common software development and analysis tasks.

## 📁 Template Directory Structure

Templates are shared between gemini and codex. This structure can be located at either `~/.claude/workflows/cli-templates/` (global) or `./.claude/workflows/cli-templates/` (project-specific).

```
~/.claude/workflows/cli-templates/
├── prompts/
│   ├── analysis/       # Code analysis templates (Gemini primary, Codex compatible)
│   │   ├── pattern.txt      # ✨ Implementation patterns & conventions
│   │   ├── architecture.txt # 🏗️ System architecture & dependencies
│   │   ├── security.txt     # 🔒 Security vulnerabilities & protection
│   │   ├── performance.txt  # ⚡ Performance bottlenecks & optimization
│   │   └── quality.txt      # 📊 Code quality & maintainability
│   ├── development/    # Automated development templates (Codex primary)
│   │   ├── feature.txt      # 🔧 Feature implementation & integration
│   │   ├── component.txt    # 🧩 Component design & development
│   │   ├── refactor.txt     # 🔄 Code refactoring & optimization
│   │   ├── testing.txt      # 🧪 Test generation & validation
│   │   └── debugging.txt    # 🐛 Bug analysis & resolution
│   ├── planning/       # Planning templates (Cross-tool)
│   │   ├── task-breakdown.txt # 📋 Task decomposition & dependencies
│   │   └── migration.txt      # 🚀 System migration & modernization
│   ├── automation/     # Autonomous workflow templates (Codex primary)
│   │   ├── scaffold.txt     # 🏗️ Project scaffolding & setup
│   │   ├── migration.txt    # 🚀 Automated migration & upgrades
│   │   └── deployment.txt   # 🚢 CI/CD & deployment automation
│   ├── review/         # Review templates (Cross-tool)
│   │   └── code-review.txt    # ✅ Comprehensive review checklist
│   ├── integration/    # Cross-system templates (Codex primary)
│   │   ├── api-design.txt   # 🌐 API design & implementation
│   │   └── database.txt     # 🗄️ Database schema & operations
│   └── dms/           # DMS-specific templates (Project-specific)
│       └── hierarchy-analysis.txt # 📚 Documentation structure optimization
└── commands/          # Command examples and patterns
```

## 📊 Template Categories

### Analysis Templates (`analysis/`)
**Primary Tool**: Gemini | **Compatibility**: Codex
- Focus on understanding, investigating, and analyzing existing code
- Used for codebase learning, pattern recognition, and architectural analysis
- Compatible with both tools but optimized for Gemini's analysis capabilities

### Development Templates (`development/`)
**Primary Tool**: Codex | **Compatibility**: Gemini
- Focus on creating, modifying, and implementing code
- Used for feature development, refactoring, and code generation
- Optimized for Codex's autonomous development capabilities

### Planning Templates (`planning/`)
**Primary Tool**: Both | **Cross-tool Compatibility**
- Focus on strategic planning and architectural decisions
- Used for task decomposition, migration planning, and system design
- Equally effective with both Gemini and Codex

### Automation Templates (`automation/`)
**Primary Tool**: Codex | **Limited Gemini Use**
- Focus on automated workflows and system setup
- Used for scaffolding, deployment, and infrastructure automation
- Specifically designed for Codex's autonomous capabilities

### Review Templates (`review/`)
**Primary Tool**: Both | **Cross-tool Compatibility**
- Focus on quality assurance and validation
- Used for code review, testing validation, and release readiness
- Effective for both analysis (Gemini) and implementation validation (Codex)

### Integration Templates (`integration/`)
**Primary Tool**: Codex | **Gemini Analysis Support**
- Focus on system integration and cross-service development
- Used for API development, database operations, and service integration
- Codex implements, Gemini can analyze existing integrations

## 🧭 Template Selection Guide

### For Analysis Tasks (Gemini Primary)
| Task Type | Template | Purpose | Tool Recommendation |
|-----------|----------|---------|-------------------|
| Understand Existing Code | `analysis/pattern.txt` | Codebase learning, onboarding | Gemini |
| Security Review | `analysis/security.txt` | Security audits, vulnerability assessment | Gemini |
| Performance Analysis | `analysis/performance.txt` | Bottleneck investigation | Gemini |
| Code Quality Assessment | `analysis/quality.txt` | Technical debt, maintainability review | Gemini |
| Architecture Review | `analysis/architecture.txt` | System design analysis | Gemini |

### For Development Tasks (Codex Primary)
| Task Type | Template | Purpose | Tool Recommendation |
|-----------|----------|---------|-------------------|
| Build New Feature | `development/feature.txt` | End-to-end feature development | Codex |
| Create Component | `development/component.txt` | Reusable component development | Codex |
| Refactor Code | `development/refactor.txt` | Code improvement & optimization | Codex |
| Generate Tests | `development/testing.txt` | Comprehensive test coverage | Codex |
| Debug Issues | `development/debugging.txt` | Problem analysis & resolution | Codex |

### For Planning Tasks (Cross-tool)
| Task Type | Template | Purpose | Tool Recommendation |
|-----------|----------|---------|-------------------|
| Plan New Features | `planning/task-breakdown.txt` | Feature development planning | Both |
| System Modernization | `planning/migration.txt` | Tech upgrades, architectural changes | Both |
| Pre-Release Review | `review/code-review.txt` | Release readiness checks | Both |

### For Automation Tasks (Codex Specialized)
| Task Type | Template | Purpose | Tool Recommendation |
|-----------|----------|---------|-------------------|
| Scaffold Project | `automation/scaffold.txt` | Project structure creation | Codex |
| Automate Migration | `automation/migration.txt` | Automated system upgrades | Codex |
| Setup Deployment | `automation/deployment.txt` | CI/CD pipeline automation | Codex |

## 🔄 Template Usage Patterns

### Gemini Template Usage
```bash
# Analysis template usage
gemini --all-files -p "@{src/**/*} @{CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)"

# Multi-template composition
gemini -p "@{src/**/*} @{CLAUDE.md} 
$(cat ~/.claude/workflows/cli-templates/prompts/analysis/security.txt)

Additional Performance Focus:
$(cat ~/.claude/workflows/cli-templates/prompts/analysis/performance.txt)"
```

### Codex Template Usage
```bash
# Development template usage
codex exec "@{src/**/*,CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt)"

# Multi-template composition
codex exec "@{**/*,CLAUDE.md} 
$(cat ~/.claude/workflows/cli-templates/prompts/development/component.txt)

Security Integration:
$(cat ~/.claude/workflows/cli-templates/prompts/analysis/security.txt)"
```

## 📝 Template Maintenance Guidelines

### Template Creation
1. **Single Responsibility**: Each template should focus on one specific task type
2. **Tool Compatibility**: Consider both Gemini and Codex usage patterns
3. **Clear Instructions**: Include specific output requirements and format expectations
4. **Reusability**: Write templates that work across different project types

### Template Organization
1. **Consistent Naming**: Use descriptive, consistent file naming conventions
2. **Category Separation**: Keep templates in appropriate category directories
3. **Documentation**: Include inline comments explaining template purpose and usage
4. **Version Control**: Track template changes and maintain backwards compatibility

### Cross-Tool Compatibility
1. **Analysis Templates**: Should work with both Gemini's `--all-files` and Codex's `@{}` patterns
2. **Development Templates**: Should provide clear implementation guidance for Codex while remaining analyzable by Gemini
3. **Shared Context**: Ensure templates reference `CLAUDE.md` and common project structures

## 🎯 Best Practices

### Template Selection
- **Start with Primary Tool**: Use the tool most suited for the template's primary purpose
- **Complement with Secondary**: Use the other tool for validation and cross-verification
- **Combine When Needed**: Use multi-template composition for complex tasks

### Template Customization
- **Project-Specific Templates**: Create in `./.claude/workflows/cli-templates/` for project-specific needs
- **Global Templates**: Maintain in `~/.claude/workflows/cli-templates/` for reusable patterns
- **Template Inheritance**: Build on existing templates rather than creating from scratch

### Quality Assurance
- **Test Both Tools**: Verify templates work effectively with both Gemini and Codex
- **Validate Output**: Ensure templates produce consistent, high-quality results
- **Regular Updates**: Keep templates current with evolving development practices

---

This shared template system enables consistent, high-quality interactions with both Gemini (analysis) and Codex (development) CLI tools while maintaining clear separation of concerns and optimal tool utilization.