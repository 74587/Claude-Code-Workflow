---
name: gemini-unified
description: Consolidated Gemini CLI guidelines - core rules, syntax, patterns, templates, and best practices
type: technical-guideline
---

# Unified Gemini CLI Guidelines

## 🚀 Core Rules

### When to Trigger
- **Semantic Intent**: User asks to "analyze with Gemini", "get context", or "understand codebase"
- **Context Need**: Task requires understanding multiple files or relationships
- **Complex Analysis**: Problem exceeds single-file scope

### Primary Use Cases
- Project context acquisition and codebase understanding
- Pattern detection and architectural analysis
- Standards extraction and convention identification

### Standard Template Structure

#### Basic Structure (Manual Prompts)
```bash
gemini --all-files -p "@{target_patterns} @{CLAUDE.md,**/*CLAUDE.md}

Context: [Analysis type] targeting @{target_patterns}
Guidelines: Include CLAUDE.md standards

## Analysis:
1. [Point 1]
2. [Point 2] 
3. [Point 3]

## Output:
- File:line references
- Code examples
- Actionable guidance
- Standards compliance"
```

#### Template-Enhanced Structure (Recommended)
```bash
# Using predefined templates for consistent analysis
gemini --all-files -p "@{target_patterns} @{CLAUDE.md,**/*CLAUDE.md}
$(cat ~/.claude/workflows/gemini-templates/prompts/[category]/[template].txt)"
```

#### Template Reference Examples
```bash
# Pattern analysis with template
gemini -p "@{src/**/*} @{CLAUDE.md} $(cat ~/.claude/workflows/gemini-templates/prompts/analysis/pattern.txt)"

# Architecture analysis with template  
gemini -p "@{src/**/*} @{CLAUDE.md} $(cat ~/.claude/workflows/gemini-templates/prompts/analysis/architecture.txt)"

# Multi-template composition
gemini -p "@{src/**/*} @{CLAUDE.md} $(cat <<'EOF'
$(cat ~/.claude/workflows/gemini-templates/prompts/analysis/pattern.txt)

Additional Security Focus:
$(cat ~/.claude/workflows/gemini-templates/prompts/analysis/security.txt)
EOF
)"
```

**Template Benefits:**
- **Consistency**: Standardized analysis structure across all uses
- **Completeness**: Pre-defined analysis points ensure comprehensive coverage
- **Quality**: Proven analysis frameworks with specific output requirements
- **Efficiency**: No need to manually construct analysis prompts

**Mandatory**: Always include `@{CLAUDE.md,**/*CLAUDE.md}` for project standards.

## ⚙️ Command Syntax

### Basic Structure
```bash
gemini [flags] -p "@{patterns} prompt"
```

### Key Arguments
- `--all-files`: Includes all files in current directory (path-dependent)
- `-p`: Prompt string with file patterns and query
- `@{pattern}`: File reference pattern

### Execution Modes

#### 1. Directory-Scoped
Navigate first, then execute:
```bash
cd src/components && gemini --all-files -p "@{CLAUDE.md} Analyze patterns"
```

#### 2. Pattern-Based
Target files directly:
```bash
gemini -p "@{src/components/**/*} @{CLAUDE.md} Component analysis"
```

#### 3. Template-Injected
Use `$(cat)` for templates:
```bash
gemini -p "@{src/**/*} $(cat ~/.claude/workflows/gemini-templates/prompts/analysis/pattern.txt)"
```

#### 4. Parallel Execution
Multiple analyses concurrently:
```bash
(
  gemini -p "@{**/*auth*} @{CLAUDE.md} Auth patterns" &
  gemini -p "@{**/api/**/*} @{CLAUDE.md} API patterns" &
  wait
)
```

## 📂 File Patterns

### Pattern Syntax
```bash
@{pattern}                    # Single pattern
@{pattern1,pattern2}          # Multiple patterns
```

### Wildcards
```bash
*         # Any character (not path separators)
**        # Any directory levels
?         # Single character
[abc]     # Character in brackets
{a,b,c}   # Any option in braces
```

### Frontend Patterns
```bash
# React
@{src/components/**/*.{jsx,tsx}}
@{src/hooks/**/*.{js,ts}}
@{src/context/**/*.{jsx,tsx}}

# Vue
@{src/components/**/*.vue}
@{src/composables/**/*.{js,ts}}

# Angular
@{src/app/**/*.component.{ts,html}}
@{src/app/**/*.service.ts}
```

### Backend Patterns
```bash
# Node.js
@{routes/**/*.js,controllers/**/*.js}
@{middleware/**/*.js}
@{models/**/*.js}

# Python
@{**/views.py,**/models.py,**/urls.py}
@{**/serializers.py}

# Java
@{**/*Controller.java}
@{**/*Service.java,**/*Repository.java}
```

### Config & Testing
```bash
# Configuration
@{*.config.{js,ts},**/*.config.*}
@{package.json,yarn.lock}
@{Dockerfile,docker-compose.yml}

# Tests
@{**/*.test.{js,ts,jsx,tsx}}
@{**/*.spec.{js,ts}}
@{**/__tests__/**/*}

# Documentation
@{**/*.md,**/README*}
@{**/*.d.ts,**/types/**/*.ts}
```

### Domain Patterns
```bash
# Auth & Security
@{**/*auth*,**/*login*,**/*session*}
@{**/*permission*,**/*role*}
@{**/*crypto*,**/*hash*}

# API & Data
@{**/api/**/*,**/routes/**/*}
@{**/controllers/**/*,**/handlers/**/*}
@{**/models/**/*,**/entities/**/*}

# UI & Styling
@{src/components/**/*,src/ui/**/*}
@{src/styles/**/*,**/*.{css,scss,sass}}
@{src/layouts/**/*}
```

### Cross-Platform Rules
- Always use forward slashes: `@{src/components/**/*}`
- Quote paths with spaces: `@{"My Project/src/**/*"}`
- Escape special chars: `@{src/**/*\[bracket\]*}`

## 📋 Template System

### Template Categories and Functions

#### Analysis Templates (`prompts/analysis/`)
- **`pattern.txt`** - 分析代码模式、工具库、编码标准和反模式
- **`architecture.txt`** - 映射模块依赖、集成点、可扩展性评估  
- **`security.txt`** - 扫描安全漏洞、认证问题、加密方法
- **`performance.txt`** - 识别瓶颈、算法复杂度、缓存策略
- **`quality.txt`** - 评估可维护性、技术债务、代码组织

#### Planning Templates (`prompts/planning/`)
- **`task-breakdown.txt`** - 任务分解、依赖关系、工作量估算
- **`migration.txt`** - 系统迁移规划、兼容性、风险评估

#### Implementation Templates (`prompts/implementation/`)
- **`component.txt`** - 组件接口设计、状态管理、测试方法

#### Review Templates (`prompts/review/`)
- **`code-review.txt`** - 全面代码审查、质量检查、标准合规

#### DMS Templates (`prompts/dms/`)
- **`hierarchy-analysis.txt`** - 项目复杂度分析、文档结构优化

### Directory Structure
```
~/.claude/workflows/gemini-templates/
├── prompts/
│   ├── analysis/       # Code analysis templates
│   │   ├── pattern.txt      # ✨ Implementation patterns & conventions
│   │   ├── architecture.txt # 🏗️ System architecture & dependencies  
│   │   ├── security.txt     # 🔒 Security vulnerabilities & protection
│   │   ├── performance.txt  # ⚡ Performance bottlenecks & optimization
│   │   └── quality.txt      # 📊 Code quality & maintainability
│   ├── planning/       # Planning templates
│   │   ├── task-breakdown.txt # 📋 Task decomposition & dependencies
│   │   └── migration.txt      # 🚀 System migration & modernization
│   ├── implementation/ # Development templates
│   │   └── component.txt      # 🧩 Component design & implementation
│   ├── review/         # Review templates
│   │   └── code-review.txt    # ✅ Comprehensive review checklist
│   └── dms/           # DMS-specific
│       └── hierarchy-analysis.txt # 📚 Documentation structure optimization
└── commands/          # Command examples
    ├── context-analysis.md    # Complete context gathering examples
    ├── parallel-execution.md  # Parallel analysis patterns
    └── folder-analysis.md     # Directory-specific analysis
```

### Template Selection Guide
| 任务类型 | 主要模板 | 用途 |
|---------|---------|------|
| 理解现有代码 | `pattern.txt` | 学习代码库、入职培训 |
| 规划新功能 | `task-breakdown.txt` | 功能开发规划 |
| 安全审查 | `security.txt` | 安全审计、漏洞评估 |
| 性能优化 | `performance.txt` | 性能问题排查 |
| 代码质量改进 | `quality.txt` | 重构、技术债务减少 |
| 系统现代化 | `migration.txt` | 技术升级、架构变更 |
| 组件开发 | `component.txt` | 构建可复用组件 |
| 发布前审查 | `code-review.txt` | 发布就绪检查 |

### Template Usage Examples

#### Basic Template Usage
```bash
# Single template - pattern analysis
gemini -p "@{src/**/*} $(cat ~/.claude/workflows/gemini-templates/prompts/analysis/pattern.txt)"

# Multi-template composition
gemini -p "@{src/**/*} $(cat <<'EOF'
$(cat ~/.claude/workflows/gemini-templates/prompts/analysis/architecture.txt)

Additional Quality Focus:
$(cat ~/.claude/workflows/gemini-templates/prompts/analysis/quality.txt)
EOF
)"
```

#### Common Use Cases
```bash
# New feature development workflow
gemini -p "@{src/**/*similar*} $(cat ~/.claude/workflows/gemini-templates/prompts/analysis/pattern.txt)"
gemini -p "@{src/**/*} $(cat ~/.claude/workflows/gemini-templates/prompts/planning/task-breakdown.txt)"

# Security audit
gemini -p "@{**/*auth*,**/*login*} $(cat ~/.claude/workflows/gemini-templates/prompts/analysis/security.txt)"

# Performance optimization
gemini -p "@{src/**/*} $(cat ~/.claude/workflows/gemini-templates/prompts/analysis/performance.txt)"
```

#### Template Best Practices
- **Single Template**: 专注分析、特定问题、时间限制
- **Multiple Templates**: 综合审查、复杂项目、全面规划
- **Performance**: 合并相关模板到单个命令，使用特定文件模式减少范围

## 🧠 Intelligent Features

### Technology Detection
```python
# Simplified logic
indicators = {
    'React': ['package.json contains react', '**/*.jsx'],
    'Vue': ['package.json contains vue', '**/*.vue'], 
    'Python': ['requirements.txt', '**/*.py'],
    'Java': ['pom.xml', '**/*.java']
}
```

### Domain Extraction
```python
# Domain mapping
domains = {
    'auth': ['authentication', 'login', 'session'],
    'api': ['api', 'endpoint', 'route'],
    'frontend': ['component', 'ui', 'react'],
    'backend': ['server', 'database', 'model']
}
```

### Fallback Strategy
1. **Primary Pattern**: Try user-specified pattern
2. **Simplified Pattern**: Remove extensions/specificity
3. **Directory Pattern**: Use common directories like `@{src/**/*}`

### Performance Tips
- Avoid patterns matching >1000 files
- Use directory-scoped execution for large projects
- Prefer specific patterns over broad ones
- Process large datasets in parallel chunks

## ⭐ Best Practices

### Core Principles
- **Always include** `@{CLAUDE.md,**/*CLAUDE.md}` for project context
- **Be specific** with patterns to reduce scope and improve performance
- **Group logically** related patterns in single commands
- **Use forward slashes** for cross-platform compatibility

### Common Patterns
```bash
# Get project context
gemini --all-files -p "@{src/**/*} @{CLAUDE.md} Extract patterns and standards"

# Domain analysis
gemini -p "@{**/*auth*} @{CLAUDE.md} Authentication implementation analysis"

# Technology-specific
gemini -p "@{src/components/**/*} $(cat ~/.claude/workflows/gemini-templates/prompts/tech/react-component.txt)"
```

### Error Handling
- Validate patterns match files before execution
- Use fallback patterns for robustness
- Quote paths with spaces or special characters
- Test patterns on small subsets first

### Agent Integration
All agent workflows should begin with context analysis:
```bash
# Mandatory first step
gemini --all-files -p "@{relevant_patterns} @{CLAUDE.md} Context for: [task_description]"
```

### Integration References
- This unified guide replaces all individual Gemini guideline files
- Templates are stored in `~/.claude/workflows/gemini-templates/`
- Always reference this file for Gemini CLI usage patterns