---
name: shared-template-system
description: Unified template directory structure and organization for Gemini and Codex CLI integration
type: system-architecture
---

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

