---
name: artifacts
description: Interactive clarification generating confirmed guidance specification
argument-hint: "topic or challenge description [--count N]"
allowed-tools: TodoWrite(*), Read(*), Write(*), AskUserQuestion(*), Glob(*)
---

## Overview

Five-phase workflow: Extract topic challenges → Select roles → Generate task-specific questions → Detect conflicts → Generate confirmed guidance (declarative statements only).

**Input**: `"GOAL: [objective] SCOPE: [boundaries] CONTEXT: [background]" [--count N]`
**Output**: `.workflow/WFS-{topic}/.brainstorming/guidance-specification.md` (CONFIRMED/SELECTED format)
**Core Principle**: Questions dynamically generated from topic keywords/challenges, NOT from generic templates

**Parameters**:
- `topic` (required): Topic or challenge description (structured format recommended)
- `--count N` (optional): Target number of roles to select (system recommends count+2 roles for user to choose from, default: 3)

## Task Tracking

```json
[
  {"content": "Initialize session (.workflow/.active-* check, parse --count parameter)", "status": "pending", "activeForm": "Initializing"},
  {"content": "Phase 1: Extract challenges, generate 2-4 task-specific questions", "status": "pending", "activeForm": "Phase 1 topic analysis"},
  {"content": "Phase 2: Intelligently recommend count+2 roles, collect multiSelect", "status": "pending", "activeForm": "Phase 2 role selection"},
  {"content": "Phase 3: Generate 3-4 task-specific questions per role (max 4 per round)", "status": "pending", "activeForm": "Phase 3 role questions"},
  {"content": "Phase 4: Detect conflicts in Phase 3 answers, generate clarifications (max 4 per round)", "status": "pending", "activeForm": "Phase 4 conflict resolution"},
  {"content": "Phase 5: Transform Q&A to declarative statements, write guidance-specification.md", "status": "pending", "activeForm": "Phase 5 document generation"}
]
```

## Execution Phases

### Session Management
- Check `.workflow/.active-*` markers first
- Multiple sessions → Prompt selection | Single → Use it | None → Create `WFS-[topic-slug]`
- Parse `--count N` parameter from user input (default: 3 if not specified)
- Store decisions in `workflow-session.json` including count parameter

### Phase 1: Topic Analysis & Intent Classification

**Goal**: Extract keywords/challenges to drive all subsequent question generation

**Steps**:
1. **Deep topic analysis**: Extract technical entities, identify core challenges (what makes this hard?), constraints (timeline/budget/compliance), success metrics (what defines done?)
2. **Generate 2-4 probing questions** targeting root challenges, trade-off priorities, and risk tolerance (NOT surface-level "Project Type")
3. **User interaction via AskUserQuestion tool**: Present 2-4 task-specific questions (multiSelect: false for single-choice questions)
4. **Storage**: Store answers to `session.intent_context` with `{extracted_keywords, identified_challenges, user_answers}`

**Example (Task-Specific)**:
Topic: "Build real-time collaboration platform SCOPE: 100 users"
→ Extract: ["real-time", "collaboration", "100 users"]
→ Challenges: ["data sync", "scalability", "low latency"]
→ Generate: "PRIMARY technical challenge?" → [Real-time data sync / Scalability to 100+ users / Conflict resolution]

**⚠️ CRITICAL**: Questions MUST reference topic keywords. Generic "Project type?" violates dynamic generation.

### Phase 2: Role Selection

**Available Roles**:
- data-architect (数据架构师)
- product-manager (产品经理)
- product-owner (产品负责人)
- scrum-master (敏捷教练)
- subject-matter-expert (领域专家)
- system-architect (系统架构师)
- test-strategist (测试策略师)
- ui-designer (UI 设计师)
- ux-expert (UX 专家)

**Steps**:
1. **Intelligent role recommendation based on topic analysis**:
   - Analyze Phase 1 extracted keywords and challenges
   - Use AI reasoning to determine most relevant roles for the specific topic
   - Recommend count+2 roles (e.g., if user wants 3 roles, recommend 5 options)
   - Provide clear rationale for each recommended role based on topic context

2. **User selection via AskUserQuestion tool (multiSelect mode)**:
   - **Tool**: `AskUserQuestion` with `multiSelect: true`
   - **Question format**: "请选择 {count} 个角色参与头脑风暴分析（可多选）："
   - **Options**: Each recommended role with label (role name) and description (relevance rationale)
   - **User interaction**: Allow user to select multiple roles (typically count roles, but flexible)
   - **Storage**: Store selections to `session.selected_roles`

**AskUserQuestion Syntax**:
```javascript
AskUserQuestion({
  questions: [{
    question: "请选择 {count} 个角色参与头脑风暴分析（可多选）：",
    header: "角色选择",
    multiSelect: true,  // Enable multiple selection
    options: [
      {label: "{role-name} ({中文名})", description: "{基于topic的相关性说明}"}
      // count+2 recommended roles
    ]
  }]
});
```

**Role Recommendation Rules**:
- NO hardcoded keyword-to-role mappings
- Use intelligent analysis of topic, challenges, and requirements
- Consider role synergies and coverage gaps
- Explain WHY each role is relevant to THIS specific topic
- Default recommendation: count+2 roles for user to choose from

### Phase 3: Role-Specific Questions (Dynamic Generation)

**Goal**: Generate deep questions mapping role expertise to Phase 1 challenges

**Algorithm**:
```
FOR each selected role:
  1. Map Phase 1 challenges to role domain:
     - "real-time sync" + system-architect → State management pattern
     - "100 users" + system-architect → Communication protocol
     - "low latency" + system-architect → Conflict resolution

  2. Generate 3-4 questions per role probing implementation depth, trade-offs, edge cases:
     Q: "How handle real-time state sync for 100+ users?" (explores approach)
     Q: "How resolve conflicts when 2 users edit simultaneously?" (explores edge case)
     Options: [Event Sourcing/Centralized/CRDT] (concrete, explain trade-offs for THIS use case)

  3. Ask questions via AskUserQuestion tool (max 4 questions per call):
     - Tool: AskUserQuestion with questions array (1-4 questions)
     - Each question: multiSelect: false (single-choice)
     - If role has 3-4 questions: Single AskUserQuestion call with multiple questions
     - Store answers to session.role_decisions[role]
```

**AskUserQuestion Tool Usage**:
- **Batching**: Maximum 4 questions per AskUserQuestion call
- **Mode**: `multiSelect: false` for each question (single-choice answers)
- **Language**: Questions MUST be asked in Chinese (用中文提问)
- **Format**: Each question includes header (short label), question text, and 2-4 options with descriptions

**Question Batching Rules**:
- ✅ Each role generates 3-4 questions
- ✅ AskUserQuestion supports maximum 4 questions per call
- ✅ Single round per role (all questions asked together)
- ✅ Questions MUST be asked in Chinese (用中文提问) for better user understanding
- ✅ Questions MUST reference Phase 1 keywords (e.g., "real-time", "100 users")
- ✅ Options MUST be concrete approaches, explain relevance to topic
- ❌ NEVER generic "Architecture style?" without task context

**Examples by Role** (for "real-time collaboration platform"):
- **system-architect** (4 questions in one round):
  1. "100+ 用户实时状态同步方案?" → [Event Sourcing/集中式状态/CRDT]
  2. "两个用户同时编辑冲突如何解决?" → [自动合并/手动解决/版本控制]
  3. "低延迟通信协议选择?" → [WebSocket/SSE/轮询]
  4. "系统扩展性架构方案?" → [微服务/单体+缓存/Serverless]

- **ui-designer** (3 questions in one round):
  1. "如何展示实时协作状态?" → [实时光标/活动流/最小化指示器]
  2. "冲突时的用户界面反馈?" → [即时警告/合并界面/回滚选项]
  3. "多用户在线状态展示?" → [头像列表/活动面板/状态栏]

### Phase 4: Cross-Role Clarification (Conflict Detection)

**Goal**: Resolve ACTUAL conflicts from Phase 3 answers, not pre-defined relationships

**Algorithm**:
```
1. Analyze Phase 3 answers for conflicts:
   - Contradictory choices: product-manager "fast iteration" vs system-architect "complex Event Sourcing"
   - Missing integration: ui-designer "Optimistic updates" but system-architect didn't address conflict handling
   - Implicit dependencies: ui-designer "Live cursors" but no auth approach defined

2. FOR each detected conflict:
   Generate clarification questions referencing SPECIFIC Phase 3 choices

3. Ask via AskUserQuestion tool in batches (max 4 questions per call):
   - Tool: AskUserQuestion with questions array (1-4 questions)
   - Each question: multiSelect: false (single-choice)
   - If conflicts ≤ 4: Single AskUserQuestion call
   - If conflicts > 4: Multiple AskUserQuestion calls (max 4 questions each)
   - Store answers to session.cross_role_decisions

4. If NO conflicts: Skip Phase 4 (inform user)
```

**AskUserQuestion Tool Usage**:
- **Batching**: Maximum 4 questions per AskUserQuestion call
- **Mode**: `multiSelect: false` for each question (single-choice answers)
- **Language**: Questions in Chinese (用中文提问)
- **Multiple rounds**: If conflicts > 4, call AskUserQuestion multiple times sequentially

**Batching Rules**:
- ✅ Maximum 4 clarification questions per AskUserQuestion call
- ✅ Multiple rounds if more than 4 conflicts detected
- ✅ Prioritize most critical conflicts first
- ✅ Questions in Chinese (用中文提问)

**Example Conflict**:
- Detect: system-architect "CRDT sync" (conflict-free) + ui-designer "Rollback on conflict" (expects conflicts)
- Generate: "CRDT 与 UI 回滚期望冲突,如何解决?" → [CRDT 自动合并/显示合并界面/切换到 OT]

**⚠️ CRITICAL**: NEVER use static "Cross-Role Matrix". ALWAYS analyze actual Phase 3 answers.

### Phase 5: Generate Guidance Specification

**Steps**:
1. Load all decisions: `intent_context` + `selected_roles` + `role_decisions` + `cross_role_decisions`
2. Transform Q&A pairs to declarative: Questions → Headers, Answers → CONFIRMED/SELECTED statements
3. Generate guidance-specification.md (template below)
4. Validate: No interrogative sentences, all decisions traceable

**⚠️ CRITICAL**: NO questions in output. Use CONFIRMED/SELECTED format only.

## Output Document Template

**File**: `.workflow/WFS-{topic}/.brainstorming/guidance-specification.md`

```markdown
# [Project] - Confirmed Guidance Specification

**Metadata**: [timestamp, type, focus, roles]

## 1. Project Positioning & Goals
**CONFIRMED Objectives**: [from topic + Phase 1]
**CONFIRMED Success Criteria**: [from Phase 1 answers]

## 2-N. [Role] Decisions
### SELECTED Choices
**[Question topic]**: [User's answer]
- **Rationale**: [From option description]
- **Impact**: [Implications]

### Cross-Role Considerations
**[Conflict resolved]**: [Resolution from Phase 4]
- **Affected Roles**: [Roles involved]

## Cross-Role Integration
**CONFIRMED Integration Points**: [API/Data/Auth from multiple roles]

## Risks & Constraints
**Identified Risks**: [From answers] → Mitigation: [Approach]

## Next Steps
**Immediate Actions**: [Derived from decisions]
**Recommended Workflow**:
```bash
/workflow:concept-clarify --session WFS-{id}  # Optional
/workflow:plan --session WFS-{id}
```

## Appendix: Decision Tracking
| Decision ID | Category | Question | Selected | Phase | Rationale |
|-------------|----------|----------|----------|-------|-----------|
| D-001 | Intent | [Q] | [A] | 1 | [Why] |
| D-002 | Roles | [Selected] | [Roles] | 2 | [Why] |
| D-003+ | [Role] | [Q] | [A] | 3 | [Why] |
```

## AskUserQuestion Tool Reference

### Syntax Structure
```javascript
AskUserQuestion({
  questions: [
    {
      question: "{动态生成的问题文本}",
      header: "{短标签,最多12字符}",
      multiSelect: false,  // Phase 1,3,4: false | Phase 2: true
      options: [
        {label: "{选项标签}", description: "{选项说明}"},
        // 2-4 options per question
      ]
    }
    // Maximum 4 questions per call
  ]
});
```

### Usage Rules
- **Maximum**: 4 questions per AskUserQuestion call
- **Language**: Questions in Chinese (用中文提问)
- **multiSelect**:
  - `false` (Phase 1, 3, 4): Single-choice
  - `true` (Phase 2): Multiple role selection
- **Options**: 2-4 options with label + description
- **Multiple rounds**: Call tool multiple times if > 4 questions needed

## Question Generation Guidelines

### Core Principle: Developer-Facing Questions with User Context

**Target Audience**: 开发者（理解技术但需要从用户需求出发）

**Generation Philosophy**:
1. **Phase 1**: 用户场景、业务约束、优先级（建立上下文）
2. **Phase 2**: 基于话题分析的智能角色推荐（非关键词映射）
3. **Phase 3**: 业务需求 + 技术选型（需求驱动的技术决策）
4. **Phase 4**: 技术冲突的业务权衡（帮助开发者理解影响）

### Question Quality Rules

**Balanced Question Pattern** (需求 → 技术):
```
问题结构：[用户场景/业务需求] + [技术关注点]
选项格式：[技术方案简称] + [业务影响说明]
```

**Phase 1 Focus**:
- 用户使用场景（谁用？怎么用？多频繁？）
- 业务约束（预算、时间、团队、合规）
- 成功标准（性能指标、用户体验目标）
- 优先级排序（MVP vs 长期规划）

**Phase 3 Focus**:
- 业务需求驱动的技术问题
- 技术选项带业务影响说明
- 包含量化指标（并发数、延迟、可用性）

**Phase 4 Focus**:
- 技术冲突的业务权衡
- 帮助开发者理解不同选择的影响

**Question Structure**:
```
[业务场景/需求前提] + [技术关注点]
```

**Option Structure**:
```
标签：[技术方案简称] + (业务特征)
说明：[业务影响] + [技术权衡]
```

**MUST Include**:
- 业务场景作为问题前提
- 技术选项的业务影响说明
- 量化指标和约束条件

**MUST Avoid**:
- 纯技术选型无业务上下文
- 过度抽象的用户体验问题
- 脱离话题的通用架构问题

## Validation Checklist

Generated guidance-specification.md MUST:
- ✅ No interrogative sentences (use CONFIRMED/SELECTED)
- ✅ Every decision traceable to user answer
- ✅ Cross-role conflicts resolved or documented
- ✅ Next steps concrete and specific
- ✅ All Phase 1-4 decisions in session metadata

## Update Mechanism

```
IF guidance-specification.md EXISTS:
  Prompt: "Regenerate completely / Update sections / Cancel"
ELSE:
  Run full Phase 1-5 flow
```

## Governance Rules

**Output Requirements**:
- All decisions MUST use CONFIRMED/SELECTED (NO "?" in decision sections)
- Every decision MUST trace to user answer
- Conflicts MUST be resolved (not marked "TBD")
- Next steps MUST be actionable
- Topic preserved as authoritative reference in session

**CRITICAL**: Guidance is single source of truth for downstream phases. Ambiguity violates governance.

## File Structure

```
.workflow/WFS-[topic]/
├── .active-brainstorming
├── workflow-session.json              # All decisions
└── .brainstorming/
    └── guidance-specification.md      # Output
```

