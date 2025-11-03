---
name: load-skill-memory
description: Automatically discover and activate SKILL packages based on task context with intelligent matching
argument-hint: "\"task description or file path\""
allowed-tools: Bash(*), Read(*), Glob(*), Skill(*)
examples:
  - /memory:load-skill-memory "分析热模型builder pattern实现"
  - /memory:load-skill-memory "修改workflow文档生成逻辑"
  - /memory:load-skill-memory "D:\dongdiankaifa9\hydro_generator_module\builders\base.py"
---

# Memory Load SKILL Command (/memory:load-skill-memory)

## 1. Overview

The `memory:load-skill-memory` command **automatically discovers and activates** the most relevant SKILL package based on task description or file path. It dynamically matches user intent against available SKILL descriptions and activates the best match.

**Core Philosophy**:
- **Dynamic SKILL Discovery**: Automatically finds relevant SKILL without manual specification
- **Intelligent Matching**: Matches task keywords against SKILL descriptions
- **Path-Based Detection**: Recognizes project paths and activates corresponding SKILL
- **Automatic Activation**: Uses Skill() tool to load comprehensive context

## 2. Parameters

- `"task description or file path"` (Required): Task context or file path for SKILL matching
  - **Task description**: "分析热模型实现", "修改workflow逻辑", "学习参数系统"
  - **File path**: "D:\dongdiankaifa9\hydro_generator_module\builders\base.py"
  - **Domain keywords**: "thermal modeling", "workflow management", "multi-physics"

## 3. Three-Step Execution Flow

### Step 1: Discover Available SKILLs

**List All SKILL Packages**:
```bash
bash(ls -1 .claude/skills/ 2>/dev/null || echo "No SKILLs available")
```

**Read Each SKILL.md for Matching**:
```bash
# For each SKILL directory found
for skill in $(ls -1 .claude/skills/); do
  Read(.claude/skills/${skill}/SKILL.md)
done
```

**Extract Matching Information**:
- SKILL name
- Description (with trigger keywords)
- Location path (from description)
- Domain keywords

### Step 2: Match Most Relevant SKILL

**Matching Algorithm**:

1. **Path-Based Matching** (Highest Priority):
   - Extract path from user input if provided
   - Compare against SKILL location paths in descriptions
   - Exact match: `D:\dongdiankaifa9\hydro_generator_module` → `hydro_generator_module` SKILL

2. **Keyword Matching** (Secondary Priority):
   - Extract keywords from task description
   - Match against SKILL description keywords
   - Score each SKILL by keyword overlap count

3. **Action Matching** (Tertiary Priority):
   - Detect action verbs: "分析", "修改", "学习", "实现"
   - Match against SKILL description triggers
   - Prefer SKILLs with matching action patterns

**Scoring Example**:
```javascript
Task: "分析热模型builder pattern实现"

hydro_generator_module SKILL:
- Path match: No
- Keywords: "热模型"(1), "builder"(1), "实现"(1) = 3 points
- Action match: "analyzing"(1) = 1 point
- Total: 4 points ✅ Winner

Claude_dms3 SKILL:
- Path match: No
- Keywords: "workflow"(0) = 0 points
- Action match: "analyzing"(1) = 1 point
- Total: 1 point
```

**No Match Handling**:
```
⚠️  No matching SKILL found for: "{task_description}"

Available SKILLs:
- hydro_generator_module - Hydro-generator thermal modeling
- Claude_dms3 - Workflow orchestration system

Generate SKILL for your project: /memory:skill-memory [path]
```

### Step 3: Activate Matched SKILL

**Activate Best Match**:
```javascript
Skill(command: "{matched_skill_name}")
```

**What Happens**:
1. System reads `.claude/skills/{matched_skill_name}/SKILL.md`
2. Automatically loads appropriate documentation based on:
   - SKILL description triggers (analyzing, modifying, learning)
   - Current conversation context
   - Memory gaps detection
3. Progressive loading levels (0-3) handled automatically
4. Context loaded directly into conversation memory

**Confirmation Output**:
```
✅ Matched and activated SKILL: {matched_skill_name}
🎯 Match reason: {path/keyword/action match}
📦 Location: {project_path}
💡 Context loaded for: {domain_description}
```

## 4. Output Format

**Success Output**:
```
✅ Activated SKILL: {skill_name}

📦 SKILL Package Information:
- Location: {project_path}
- Description: {description from SKILL.md}
- Documentation: .workflow/docs/{skill_name}/

💡 Context loaded automatically by SKILL system based on:
- Current task requirements
- Conversation memory gaps
- SKILL description triggers

🎯 Ready for: analyzing, modifying, or learning about {domain_description}
```

## 5. Usage Examples

### Example 1: Task-Based Discovery (Keyword Matching)

**User Command**:
```bash
/memory:load-skill-memory "分析热模型builder pattern实现"
```

**Execution Flow**:
```javascript
// Step 1: Discover available SKILLs
bash(ls -1 .claude/skills/)
// Output: hydro_generator_module, Claude_dms3

// Read each SKILL.md
Read(.claude/skills/hydro_generator_module/SKILL.md)
Read(.claude/skills/Claude_dms3/SKILL.md)

// Step 2: Match keywords
Keywords extracted: ["热模型", "builder", "pattern", "实现", "分析"]

Matching scores:
- hydro_generator_module: 4 points (thermal modeling, builder, analyzing)
- Claude_dms3: 1 point (analyzing only)

Best match: hydro_generator_module

// Step 3: Activate matched SKILL
Skill(command: "hydro_generator_module")
```

**Output**:
```
✅ Matched and activated SKILL: hydro_generator_module
🎯 Match reason: Keywords ["thermal", "builder"] + Action ["analyzing"]
📦 Location: D:\dongdiankaifa9\hydro_generator_module
💡 Context loaded for: hydro-generator thermal modeling
```

### Example 2: Path-Based Discovery (Direct Path Match)

**User Command**:
```bash
/memory:load-skill-memory "D:\dongdiankaifa9\hydro_generator_module\builders\base.py"
```

**Execution Flow**:
```javascript
// Step 1: Discover SKILLs
bash(ls -1 .claude/skills/)

// Step 2: Match path
Path extracted: "D:\dongdiankaifa9\hydro_generator_module"

Matching:
- hydro_generator_module location: "D:\dongdiankaifa9\hydro_generator_module" ✅ Exact match
- Claude_dms3 location: "D:\Claude_dms3" ❌ No match

Best match: hydro_generator_module (path match - highest priority)

// Step 3: Activate
Skill(command: "hydro_generator_module")
```

**Output**:
```
✅ Matched and activated SKILL: hydro_generator_module
🎯 Match reason: Path match (D:\dongdiankaifa9\hydro_generator_module)
📦 Location: D:\dongdiankaifa9\hydro_generator_module
💡 Context loaded for: hydro-generator thermal modeling
```

### Example 3: Domain Keyword Discovery

**User Command**:
```bash
/memory:load-skill-memory "修改workflow文档生成调度逻辑"
```

**Execution Flow**:
```javascript
// Step 1: Discover SKILLs
bash(ls -1 .claude/skills/)

// Step 2: Match keywords
Keywords: ["workflow", "文档生成", "调度", "修改"]

Matching scores:
- Claude_dms3: 3 points (workflow, docs generation, modifying)
- hydro_generator_module: 1 point (modifying only)

Best match: Claude_dms3

// Step 3: Activate
Skill(command: "Claude_dms3")
```

**Output**:
```
✅ Matched and activated SKILL: Claude_dms3
🎯 Match reason: Keywords ["workflow", "docs"] + Action ["modifying"]
📦 Location: D:\Claude_dms3
💡 Context loaded for: workflow orchestration and documentation
```

## 6. SKILL Trigger Mechanism

**How SKILL System Determines Context Loading**:

The SKILL.md description includes trigger patterns that automatically activate when:

1. **Keyword Matching**:
   - User mentions domain keywords (e.g., "热模型", "workflow", "多物理场")
   - Description keywords match task requirements

2. **Action Detection**:
   - "analyzing" triggers for analysis tasks
   - "modifying" triggers for code modification
   - "learning" triggers for exploration

3. **Memory Gap Detection**:
   - "especially when no relevant context exists in memory"
   - System prioritizes SKILL loading when conversation lacks context

4. **Path-Based Triggering**:
   - User mentions file paths matching SKILL location
   - "files under this path" clause activates

**Progressive Loading (Automatic)**:
- Level 0: ~2K tokens (Quick overview)
- Level 1: ~10K tokens (Core modules)
- Level 2: ~25K tokens (Complete system)
- Level 3: ~40K tokens (Full documentation)

System automatically selects appropriate level based on task complexity and context requirements.

## 7. Implementation Steps

**Execution Logic**:

```javascript
// Step 1: Validate SKILL existence
skill_path = `.claude/skills/${skill_name}/SKILL.md`
if (!exists(skill_path)) {
  list_available_skills()
  return error_message
}

// Step 2: Activate SKILL
Skill(command: skill_name)

// Step 3: System handles automatically
// - Reads SKILL.md description
// - Matches triggers with task context
// - Loads appropriate documentation level
// - Injects context into conversation memory

// Step 4: Confirm activation
output_success_message(skill_name, project_path, description)
```

## 8. Error Handling

### SKILL Not Found
```
❌ SKILL 'unknown_module' not found.

Available SKILLs:
- hydro_generator_module (D:\dongdiankaifa9\hydro_generator_module)
- Claude_dms3 (D:\Claude_dms3)

Activate SKILL: Skill(command: "skill_name")
Generate new SKILL: /memory:skill-memory [path]
```

### Documentation Missing
```
⚠️  SKILL 'hydro_generator_module' exists but documentation incomplete.

Missing files:
- .workflow/docs/hydro_generator_module/ARCHITECTURE.md

Regenerate documentation: /memory:skill-memory --regenerate
```

## 9. Integration with Other Commands

**Workflow Integration**:
```javascript
// 1. Activate SKILL context
Skill(command: "hydro_generator_module")

// 2. Use loaded context for planning
SlashCommand(command: "/workflow:plan \"增强thermal template支持动态阻抗\"")

// 3. Execute implementation
SlashCommand(command: "/workflow:execute")
```

**Memory Refresh Pattern**:
```javascript
// Refresh SKILL context after code changes
Skill(command: "hydro_generator_module")
// System automatically detects changes and loads updated documentation
```

## 10. Token Optimization Strategy

**Automatic Progressive Loading**:
The SKILL system automatically handles token optimization:

1. **Initial Load**: Starts with minimum required context
2. **On-Demand Escalation**: Loads more documentation if needed
3. **Task-Driven**: Adjusts depth based on task complexity
4. **Memory-Aware**: Avoids loading redundant context

**Token Budget (Automatic)**:
- **Simple queries**: ~2-10K tokens
- **Code analysis**: ~10-25K tokens
- **Implementation**: ~25-40K tokens

**Optimization Benefits**:
- No manual level selection required
- System learns from conversation context
- Efficient memory usage
- Automatic reload when context insufficient

## 11. Notes

- **Validation First**: Always checks SKILL existence before activation
- **Automatic Loading**: Skill tool handles all documentation reading
- **Session-Scoped**: Activated SKILL context valid for current session
- **Trigger-Based**: Description patterns drive automatic activation
- **Path-Aware**: Triggers on project path mentions
- **Memory-Smart**: Prioritizes loading when conversation lacks context
- **Read-Only**: Does not modify SKILL files or documentation
- **Reactivation**: Can re-activate SKILL to refresh context after changes
