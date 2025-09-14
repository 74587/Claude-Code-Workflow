---
name: plan
description: Create implementation plans with intelligent input detection
usage: /workflow:plan <input>
argument-hint: "text description"|file.md|ISS-001|template-name
examples:
  - /workflow:plan "Build authentication system"
  - /workflow:plan requirements.md
  - /workflow:plan ISS-001
---

# Workflow Plan Command (/workflow:plan)

## Overview
Creates actionable implementation plans with intelligent input source detection. Supports text, files, issues, and templates through automatic recognition.

## Core Principles
**File Structure:** @~/.claude/workflows/workflow-architecture.md

## Usage
```bash
/workflow:plan [--AM gemini|codex] <input>
```

### Analysis Method Flag (--AM)
Optional flag to specify which CLI tool to use for context analysis:
- **gemini** (default): Uses Gemini CLI for pattern-based analysis and architectural understanding
- **codex**: Uses Codex CLI for autonomous development context gathering with intelligent file discovery

**Examples**:
```bash
/workflow:plan --AM codex "Build authentication system"
/workflow:plan --AM gemini requirements.md
```

## Input Detection Logic
The command automatically detects input type:

### File Input (Auto-detected)
```bash
/workflow:plan requirements.md
/workflow:plan config.json
```
**Triggers**: Extensions: .md, .txt, .json, .yaml, .yml
**Processing**: Reads file contents and extracts requirements

### Issue Input (Auto-detected)
```bash
/workflow:plan ISS-001
/workflow:plan ISSUE-123
```
**Triggers**: Patterns: ISS-*, ISSUE-*, *-request-*
**Processing**: Loads issue data and acceptance criteria


### Text Input (Default)
```bash
/workflow:plan "Build user authentication with JWT and OAuth2"
```
**Triggers**: Everything else
**Processing**: Parse natural language requirements

## Automatic Behaviors

### Session Management
- Creates new session if none exists
- Uses active session if available
- Generates session ID: WFS-[topic-slug]

### Complexity Detection with Saturation
- **Simple**: ≤8 saturated tasks → Direct IMPL_PLAN.md
- **Medium**: 9-15 saturated tasks → IMPL_PLAN.md + TODO_LIST.md
- **Complex**: >15 saturated tasks → Full decomposition

**Note**: 1 complex preparation task = 0.5 saturated task for counting

### Task Granularity Principles
- **按功能分解，不按文件分解**: 一个任务应该完成一个完整功能
- **保持功能完整性**: 每个任务产出可独立运行或测试的功能单元
- **相关组件一起实现**: UI、逻辑、测试等相关部分在同一任务中完成
- **避免技术步骤分解**: 不要把"创建文件"、"添加函数"作为独立任务

### 任务分解反模式
❌ **错误示例 - 按文件/步骤分解**：
- IMPL-001: 创建数据库模型
- IMPL-002: 创建API端点
- IMPL-003: 创建前端组件
- IMPL-004: 添加路由配置
- IMPL-005: 编写单元测试

✅ **正确示例 - 按功能分解**：
- IMPL-001: 实现用户认证功能（包含模型、API、UI、测试）
- IMPL-002: 实现数据导出功能（包含处理逻辑、UI、文件生成）

### Task Generation with Saturation Control
- **Task Saturation Assessment**: Evaluates whether to merge preparation and execution
- **Default merge mode**: "Analyze and implement X" instead of "Analyze X" + "Implement X"
- **Smart splitting**: Only separate when preparation complexity > threshold
- Automatically creates .task/ files when complexity warrants
- Generates hierarchical task structure (max 2 levels)
- Main tasks with subtasks become container tasks (not directly executable)
- Updates session state with task references
- Runs project structure analysis to populate paths field

### Task Saturation Assessment
Evaluates whether to merge preparation and execution:

**默认合并原则** (Saturated Tasks):
- 同一功能模块的所有组件
- 前后端配套实现
- 功能与其对应的测试
- 配置与其使用的代码
- 相互依赖的多个小功能

**仅在以下情况分离任务**:
- 完全独立的功能模块（无共享代码）
- 不同技术栈的独立服务（如前端/后端分离部署）
- 需要不同专业知识的模块（如ML模型训练 vs Web开发）
- 有明确先后顺序依赖的大型功能

**Task Examples**:
- **合并示例**: "IMPL-001: 实现用户认证系统（包含JWT管理、API端点、UI组件和测试）"
- **分离示例**: "IMPL-001: 设计跨服务认证架构" + "IMPL-002: 实现前端认证模块" + "IMPL-003: 实现后端认证服务"

### Task Breakdown Process
- **Automatic decomposition**: Only when task count >15 are tasks broken into subtasks (impl-N.M format)
- **Function-based decomposition**: Split by independent functional boundaries, not by technical layers
- **Container tasks**: Parent tasks with subtasks become containers (marked with ▸ in TODO_LIST)
- **Smart decomposition**: AI analyzes task title to suggest logical functional subtask structure
- **Complete unit principle**: Each subtask must still represent a complete functional unit
- **Context inheritance**: Subtasks inherit parent's requirements and scope, refined for specific needs
- **Agent assignment**: Automatic agent mapping based on subtask type (planning/code/test/review)
- **Maximum depth**: 2 levels (impl-N.M) to maintain manageable hierarchy

### Implementation Field Requirements  
- **analysis_source**: Determines context gathering method (manual|auto-detected|gemini|codex)
- **Auto-assignment**: manual (user provides details) → auto-detected (system infers) → gemini/codex (needs analysis)
- **Required fields**: files (with path/location/modifications), context_notes, analysis_source
- **Paths format**: Semicolon-separated list (e.g., "src/auth;tests/auth;config/auth.json")

## Session Check Process
⚠️ **CRITICAL**: Check for existing active session before planning

1. **Check Active Session**: Check for `.workflow/.active-*` marker file
2. **Session Selection**: Use existing active session or create new
3. **Context Integration**: Load session state and existing context

## Output Documents

### Document References for Execution

#### Primary References
- **Planning Document**: `.workflow/WFS-[topic-slug]/IMPL_PLAN.md`
  - Used by: `/workflow:execute` for context loading
  - Contains: Requirements, task overview, success criteria

- **Task Definitions**: `.workflow/WFS-[topic-slug]/.task/impl-*.json`
  - Used by: Agents for implementation context
  - Contains: Complete task details with implementation field including preparation_complexity

- **Progress Tracking**: `.workflow/WFS-[topic-slug]/TODO_LIST.md`
  - Used by: `/workflow:execute` for status tracking
  - Updated by: Agents after task completion

### IMPL_PLAN.md (Always Created)
```markdown
# Implementation Plan - [Project Name]
*Generated from: [input_source]*

## Requirements
[Extracted requirements from input source]

## Task Breakdown
- **IMPL-001**: [Saturated task description with merged preparation and execution]
- **IMPL-002**: [Task description]

## Success Criteria
[Measurable completion conditions]
```

### Optional TODO_LIST.md (Auto-triggered)
Created when complexity > simple or task count > 5

**TODO_LIST Structure**: Uses unified hierarchical list format
- Container tasks (with subtasks) marked with `▸` symbol
- Leaf tasks use standard `- [ ]` / `- [x]` checkboxes
- Indentation shows hierarchy (2 spaces per level)
- Container tasks represent logical grouping, not executable items

### Task JSON Files (Auto-created)
Generated in .task/ directory when decomposition enabled

## Error Handling

### Input Processing Errors
- **File not found**: Clear error message with suggestions
- **Invalid issue**: Verify issue ID exists
- **Unknown template**: List available templates
- **Empty input**: Prompt for valid input
- **Vague text input**: Auto-reject without guidance
  - Rejected examples: "do something", "fix it", "make it better", "add feature"
  - Response: Direct rejection message, no further assistance

### Recommended Task Patterns

#### Complete Feature Implementation
"Implement user management system" - includes CRUD operations, permissions, UI components, API endpoints, and tests

#### End-to-End Features
"Add Excel export functionality" - includes data processing, file generation, download API, UI buttons, and error handling

#### System Integration
"Integrate payment gateway" - includes API integration, order processing, payment flows, webhook handling, and testing

#### Problem Resolution
"Fix and optimize search functionality" - includes bug fixes, performance optimization, UI improvements, and related tests

#### Module Development
"Create notification system" - includes email/SMS sending, template management, subscription handling, and admin interface

**System ensures**: Unified planning interface with intelligent input detection and function-based task granularity