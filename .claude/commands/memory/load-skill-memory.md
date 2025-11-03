---
name: load-skill-memory
description: Load SKILL package documentation with progressive levels based on task requirements
argument-hint: "<skill_name> [--level 0|1|2|3] [task description]"
allowed-tools: Bash(*), Read(*), Glob(*)
examples:
  - /memory:load-skill-memory hydro_generator_module "分析热模型实现"
  - /memory:load-skill-memory workflow-system --level 2 "修改任务调度逻辑"
  - /memory:load-skill-memory Claude_dms3 "学习文档生成流程"
---

# Memory Load SKILL Command (/memory:load-skill-memory)

## 1. Overview

The `memory:load-skill-memory` command loads SKILL package documentation with **progressive levels** (0-3) based on task requirements. It validates SKILL existence and intelligently selects appropriate documentation depth.

**Core Philosophy**:
- **Two-Step Validation**: Check SKILL existence before loading
- **Progressive Loading**: Load only necessary documentation based on task complexity
- **Token Optimization**: Start with minimal context, expand as needed
- **Task-Driven Selection**: Automatically select level based on task description

## 2. Parameters

- `<skill_name>` (Required): Name of SKILL package to load
  - Example: `hydro_generator_module`
  - Example: `Claude_dms3`
  - Example: `multiphysics_network`

- `--level <0|1|2|3>` (Optional): Force specific documentation level
  - Level 0: Quick Start (~2K tokens) - Overview only
  - Level 1: Core Modules (~10K tokens) - Key module APIs
  - Level 2: Complete (~25K tokens) - All modules + architecture
  - Level 3: Deep Dive (~40K tokens) - Everything including examples
  - Default: Auto-select based on task description

- `[task description]` (Optional): Task context for auto-level selection
  - Example: "分析热模型实现"
  - Example: "修改builder pattern"
  - Example: "学习参数系统设计"

## 3. Two-Step Execution Flow

### Step 1: Validate SKILL Existence

**Check SKILL.md File**:
```bash
bash(test -f .claude/skills/{skill_name}/SKILL.md && echo "exists" || echo "not_found")
```

**Validation Logic**:
- If `exists`: Continue to Step 2
- If `not_found`: Return error message with available SKILLs:
  ```bash
  bash(ls -1 .claude/skills/ 2>/dev/null || echo "No SKILLs available")
  ```

**Error Message Format**:
```
❌ SKILL '{skill_name}' not found.

Available SKILLs:
- hydro_generator_module
- Claude_dms3
- multiphysics_network

Use: /memory:load-skill-memory <skill_name> [task description]
```

### Step 2: Load Documentation by Level

**Level Selection Logic**:

1. **Explicit Level** (--level specified): Use specified level directly
2. **Task-Based Auto-Selection**:
   - **Level 0** (Quick Start):
     - Keywords: "overview", "介绍", "what is", "概述", "快速了解"
     - Use case: Initial exploration, understanding basic capabilities

   - **Level 1** (Core Modules):
     - Keywords: "分析", "analyze", "review", "理解", "understand", "API"
     - Use case: Deep analysis of specific modules, API review

   - **Level 2** (Complete):
     - Keywords: "修改", "modify", "重构", "refactor", "设计", "architecture"
     - Use case: Modifying code, understanding system design

   - **Level 3** (Deep Dive):
     - Keywords: "实现", "implement", "开发", "develop", "示例", "example"
     - Use case: New feature implementation, need complete context

3. **Default**: Level 1 if no task description and no --level flag

**Loading Implementation**:

```bash
# Read SKILL.md to get documentation structure
Read(.claude/skills/{skill_name}/SKILL.md)

# Based on selected level, read corresponding files
case $level in
  0)
    Read(../../../.workflow/docs/{skill_name}/README.md)
    ;;
  1)
    Read(../../../.workflow/docs/{skill_name}/README.md)
    # Read Core Module README.md files listed in SKILL.md Level 1
    ;;
  2)
    # Load all Level 1 docs
    Read(../../../.workflow/docs/{skill_name}/ARCHITECTURE.md)
    # Read all module README.md + API.md files
    ;;
  3)
    # Load all Level 2 docs
    Read(../../../.workflow/docs/{skill_name}/EXAMPLES.md)
    # Read complete documentation set
    ;;
esac
```

## 4. Output Format

**Success Output**:
```
✅ Loaded SKILL: {skill_name} (Level {level})

📦 Documentation Loaded:
- README.md (~2K tokens)
[Level 1+]
- analysis/README.md
- builders/README.md
- params/README.md
[Level 2+]
- ARCHITECTURE.md
- Complete module APIs
[Level 3+]
- EXAMPLES.md

💡 Token Budget: ~{token_count}K

🎯 Task Context: {task_description}
```

## 5. Usage Examples

### Example 1: Quick Overview

```bash
/memory:load-skill-memory hydro_generator_module "快速了解模块功能"
```

**Auto-Selected Level**: 0 (keyword: "快速了解")

**Loaded Files**:
- `.workflow/docs/hydro_generator_module/README.md`

**Token Budget**: ~2K

### Example 2: Module Analysis

```bash
/memory:load-skill-memory hydro_generator_module "分析builder pattern实现"
```

**Auto-Selected Level**: 1 (keyword: "分析")

**Loaded Files**:
- README.md
- builders/README.md
- builders/API.md
- interfaces/README.md
- params/README.md

**Token Budget**: ~10K

### Example 3: Code Modification

```bash
/memory:load-skill-memory Claude_dms3 --level 2 "修改文档生成workflow"
```

**Explicit Level**: 2

**Loaded Files**:
- README.md
- All module README.md + API.md
- ARCHITECTURE.md

**Token Budget**: ~25K

### Example 4: New Feature Implementation

```bash
/memory:load-skill-memory multiphysics_network "实现新的电磁耦合器"
```

**Auto-Selected Level**: 3 (keyword: "实现")

**Loaded Files**:
- Complete documentation set
- EXAMPLES.md with 20+ examples

**Token Budget**: ~40K

## 6. Level Selection Matrix

| Task Type | Keywords | Auto Level | Token Budget |
|-----------|----------|------------|--------------|
| **Explore** | overview, 介绍, what is, 概述 | 0 | ~2K |
| **Analyze** | 分析, analyze, review, 理解 | 1 | ~10K |
| **Modify** | 修改, modify, 重构, refactor | 2 | ~25K |
| **Implement** | 实现, implement, 开发, develop | 3 | ~40K |

## 7. Implementation Steps

**Pseudo-code**:

```javascript
// Step 1: Validate SKILL existence
skill_path = `.claude/skills/${skill_name}/SKILL.md`
if (!exists(skill_path)) {
  list_available_skills()
  return error_message
}

// Step 2: Determine level
if (--level specified) {
  level = specified_level
} else if (task_description) {
  level = auto_select_level(task_description)
} else {
  level = 1  // Default
}

// Step 3: Read SKILL.md structure
skill_content = Read(skill_path)
doc_structure = parse_progressive_loading(skill_content)

// Step 4: Load documentation by level
loaded_docs = []
for (doc in doc_structure[level]) {
  loaded_docs.push(Read(doc.path))
}

// Step 5: Calculate token count
token_count = estimate_tokens(loaded_docs)

// Step 6: Output summary
output_success_message(skill_name, level, loaded_docs, token_count, task_description)
```

## 8. Error Handling

### SKILL Not Found
```
❌ SKILL 'unknown_module' not found.

Available SKILLs:
- hydro_generator_module (D:\dongdiankaifa9\hydro_generator_module)
- Claude_dms3 (D:\Claude_dms3)

Generate new SKILL: /memory:skill-memory [path]
```

### Documentation Missing
```
⚠️  SKILL 'hydro_generator_module' exists but documentation incomplete.

Missing files:
- .workflow/docs/hydro_generator_module/ARCHITECTURE.md

Regenerate documentation: /memory:skill-memory --regenerate
```

### Invalid Level
```
❌ Invalid level: 4

Valid levels:
- Level 0: Quick Start (~2K)
- Level 1: Core Modules (~10K)
- Level 2: Complete (~25K)
- Level 3: Deep Dive (~40K)
```

## 9. Integration with Other Commands

**Workflow Integration**:
```bash
# 1. Load SKILL context
/memory:load-skill-memory hydro_generator_module "修改thermal template"

# 2. Use loaded context for planning
/workflow:plan "增强thermal template支持动态阻抗"

# 3. Execute implementation
/workflow:execute
```

**Memory Refresh**:
```bash
# Load fresh context after code changes
/memory:load-skill-memory hydro_generator_module --level 2 "review recent changes"
```

## 10. Token Optimization Strategy

**Progressive Loading Pattern**:
1. Start with Level 0 for exploration
2. Escalate to Level 1 for analysis
3. Load Level 2 for modification tasks
4. Use Level 3 only for complex implementations

**Token Budget Guidelines**:
- **Simple queries**: Level 0-1 (2-10K)
- **Code review**: Level 1-2 (10-25K)
- **Feature development**: Level 2-3 (25-40K)

**Reload Strategy**:
- Reload with higher level if insufficient context
- Use explicit --level to override auto-selection

## 11. Notes

- **Read-Only**: Does not modify SKILL files or documentation
- **Session-Scoped**: Loaded documentation valid for current session
- **Auto-Selection**: Keywords matched case-insensitively
- **Path Relative**: All documentation paths relative to SKILL.md location
- **Token Aware**: Automatically estimates token consumption
- **Fallback**: Defaults to Level 1 if auto-selection unclear
