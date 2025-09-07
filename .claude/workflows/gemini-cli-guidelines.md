# Gemini CLI Core Guidelines

**Streamlined Gemini CLI usage guidelines with parallel execution patterns for enhanced performance.**

## 🎯 Core Command Syntax

### Basic Structure
```bash
gemini --all-files -p "@{file_patterns} analysis_prompt"
```

**Parameters**:
- `--all-files` - Include all files (context-dependent on execution path)
- `-p` - Specify prompt content
- `@{pattern}` - File reference pattern

### Parallel Execution Structure
```bash
# Execute multiple Gemini commands concurrently
(
  gemini_command_1 &
  gemini_command_2 &
  gemini_command_3 &
  wait  # Synchronize all parallel processes
)
```

### ⚠️ Execution Path Dependencies
- `--all-files` adds all text to context memory and depends on execution path
- **For folder-specific analysis**: Navigate to target folder first, then run gemini
- **If errors occur**: Remove `--all-files` and use `@folder` or `@file` in prompts instead

**Example - Analyzing a specific component folder:**
```bash
# Combined command - navigate and analyze in one line
cd src/components/ui && gemini --all-files -p "analyze component structure and patterns in this UI folder"

# For Windows systems
cd src\components\ui && gemini --all-files -p "analyze component structure and patterns in this UI folder"

# Alternative if --all-files fails
cd /project/root && gemini -p "@src/components/ui analyze UI component patterns and structure"

# Cross-platform combined command with fallback
cd src/components/ui && gemini --all-files -p "analyze patterns" || gemini -p "@src/components/ui analyze patterns"
```

## 📂 File Reference Rules

### Required Reference Patterns
```bash
# 1. Project guidelines files (REQUIRED)
@{CLAUDE.md,**/*CLAUDE.md}

# 2. Target analysis files
@{src/**/*,lib/**/*}     # Source code
@{**/*.{ts,tsx,js,jsx}}  # Specific languages
@{**/api/**/*}           # Domain-related

# 3. Test files (RECOMMENDED)
@{**/*.test.*,**/*.spec.*}
```

### Domain Pattern Quick Reference
| Domain | Pattern |
|--------|---------|
| **Frontend Components** | `@{src/components/**/*,src/ui/**/*}` |
| **API Endpoints** | `@{**/api/**/*,**/routes/**/*}` |
| **Authentication** | `@{**/*auth*,**/*login*,**/*session*}` |
| **Database** | `@{**/models/**/*,**/db/**/*}` |
| **Configuration** | `@{*.config.*,**/config/**/*}` |

## ⚡ Parallel Agent Execution Guidelines

### Parallel Task Distribution Rules

**Rule 1: Module Independence Analysis**
- Before parallel execution, identify independent modules
- Group modules by dependency level
- Execute only independent modules in parallel

**Rule 2: Resource-Based Concurrency**
- Default: 3 concurrent Gemini processes
- Maximum: 5 concurrent processes (system dependent)
- Reduce if memory/CPU constraints detected

**Rule 3: Synchronization Points**
- Wait for all modules at same dependency level
- Merge results before proceeding to next level
- Global summary only after all modules complete

### Parallel Template Formats

**Directory-Based Parallel Execution**:
```bash
# Navigate to different directories and analyze in parallel
(
  cd src/components/ui && gemini --all-files -p "@{CLAUDE.md} analyze UI patterns" &
  cd src/components/forms && gemini --all-files -p "@{CLAUDE.md} analyze form patterns" &
  cd src/api && gemini --all-files -p "@{CLAUDE.md} analyze API patterns" &
  wait
)
```

**File Pattern Parallel Execution**:
```bash
# Use file patterns for parallel analysis (when --all-files not suitable)
gemini -p "@src/components/ui/**/* @{CLAUDE.md} analyze UI implementation" &
gemini -p "@src/components/forms/**/* @{CLAUDE.md} analyze form handling" &
gemini -p "@src/api/auth/**/* @{CLAUDE.md} analyze authentication" &
wait
```

### Standard Sequential Template
```bash
gemini --all-files -p "@{target_files} @{CLAUDE.md,**/*CLAUDE.md}

Analysis Task: [specific task description]

Required Output:
- Specific file:line references
- Executable code examples
- Clear implementation guidance"
```

### Agent-Specific Modes
```bash
# Planning Agent (navigate to project root first)
cd /path/to/project && gemini --all-files -p "@{src/**/*} @{CLAUDE.md,**/*CLAUDE.md}
Task planning analysis: [task] - Extract file modification points, implementation sequence, integration requirements"

# Code Developer (navigate to target directory first)
cd /path/to/project && gemini --all-files -p "@{**/*.{ts,js}} @{**/*test*} @{CLAUDE.md,**/*CLAUDE.md}
Code implementation guidance: [feature] - Extract code patterns, insertion points, testing requirements"

# Code Review (use @file references if --all-files fails)
gemini -p "@modified_files @related_files @CLAUDE.md
Code review: [changes] - Compare against standards, check consistency, identify risks"

# Alternative without --all-files for targeted analysis
gemini -p "@src/components @CLAUDE.md
Component analysis: [specific_component] - Extract patterns and implementation guidance"
```

## 📋 Core Principles

### 1. File Reference Principles
- **Must include**: `@{CLAUDE.md,**/*CLAUDE.md}` 
- **Precise targeting**: Use specific file patterns, avoid over-inclusion
- **Logical grouping**: Combine related file patterns

### 2. Prompt Construction Principles
- **Single objective**: Each command completes one analysis task
- **Specific requirements**: Clearly specify required output format
- **Context integration**: Reference project standards and existing patterns

### 3. Output Requirements
- **File references**: Provide specific `file:line` locations
- **Code examples**: Give executable code snippets
- **Implementation guidance**: Clear next-step actions

## 🔧 Common Command Patterns

### Quick Analysis
```bash
# Architecture analysis (navigate to project root first)
cd /project/root && gemini --all-files -p "@{src/**/*} @{CLAUDE.md} system architecture and component relationships"

# Pattern detection (navigate to project root first)
cd /project/root && gemini --all-files -p "@{**/*.ts} @{CLAUDE.md} TypeScript usage patterns"

# Security review (fallback to @file if --all-files fails)
gemini -p "@**/*auth* @CLAUDE.md authentication and authorization implementation patterns"

# Folder-specific analysis (navigate to target folder)
cd /project/src/components && gemini --all-files -p "component structure and patterns analysis"
```

### Parallel Analysis Patterns
```bash
# Parallel architecture analysis by layer
(
  cd src/frontend && gemini --all-files -p "analyze frontend architecture" &
  cd src/backend && gemini --all-files -p "analyze backend architecture" &
  cd src/database && gemini --all-files -p "analyze data layer architecture" &
  wait
)

# Parallel pattern detection across modules
gemini -p "@src/components/**/*.tsx analyze React patterns" &
gemini -p "@src/api/**/*.ts analyze API patterns" &
gemini -p "@src/utils/**/*.ts analyze utility patterns" &
wait

# Parallel security review
(
  gemini -p "@**/*auth* analyze authentication implementation" &
  gemini -p "@**/*permission* analyze authorization patterns" &
  gemini -p "@**/*crypto* analyze encryption usage" &
  wait
)
```

### Integration Standards
1. **Path awareness**: Navigate to appropriate directory before using `--all-files`
2. **Fallback strategy**: Use `@file` or `@folder` references if `--all-files` errors
3. **Minimal references**: Only reference files you actually need
4. **Self-contained**: Avoid complex cross-file dependencies
5. **Focused analysis**: Use for specific analysis, not general exploration
6. **Result reuse**: Reuse analysis results when possible

### Parallel Execution Standards
1. **Dependency verification**: Ensure modules are independent before parallel execution
2. **Resource monitoring**: Check system capacity before increasing concurrency
3. **Synchronization discipline**: Always use `wait` after parallel commands
4. **Result aggregation**: Merge outputs from parallel executions properly
5. **Error isolation**: Handle failures in individual parallel tasks gracefully
6. **Performance tracking**: Monitor speedup to validate parallel benefit

## 📊 Parallel Execution Rules

### Rule-Based Parallel Coordination

**Execution Order Rules**:
1. **Level 0 (Leaf Modules)**: Execute all in parallel (max 5)
2. **Level N**: Wait for Level N-1 completion before starting
3. **Root Level**: Process only after all module levels complete

**File Partitioning Rules**:
1. **Size-based**: Split large directories into ~equal file counts
2. **Type-based**: Group by file extension for focused analysis
3. **Logic-based**: Separate by functionality (auth, api, ui, etc.)

**Memory Management Rules**:
1. **Per-process limit**: Each Gemini process uses ~500MB-1GB
2. **Total limit**: Don't exceed 80% system memory
3. **Throttling**: Reduce parallelism if memory pressure detected

**Synchronization Rules**:
1. **Barrier sync**: All tasks at level must complete
2. **Queue sync**: Next task starts when worker available
3. **Async sync**: Collect results as they complete

### Performance Optimization Rules

**When to use parallel execution**:
- Project has >5 independent modules
- Modules have clear separation
- System has adequate resources (>8GB RAM)
- Time savings justify coordination overhead

**When to avoid parallel execution**:
- Small projects (<5 modules)
- Highly interdependent modules
- Limited system resources
- Sequential dependencies required

### Error Handling Rules

**Parallel Failure Recovery**:
1. If one parallel task fails, continue others
2. Retry failed tasks once with reduced scope
3. Fall back to sequential for persistent failures
4. Report all failures at synchronization point

**Resource Exhaustion Handling**:
1. Detect high memory/CPU usage
2. Pause new parallel tasks
3. Wait for current tasks to complete
4. Resume with reduced concurrency

---
*Enhanced version with parallel execution patterns and coordination rules*