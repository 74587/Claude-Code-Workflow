---
name: brainstorm-with-file
description: Interactive brainstorming with multi-CLI collaboration, idea expansion, and documented thought evolution
argument-hint: "[-y|--yes] [-c|--continue] [-m|--mode creative|structured] \"idea or topic\""
allowed-tools: TodoWrite(*), Task(*), AskUserQuestion(*), Read(*), Grep(*), Glob(*), Bash(*), Edit(*), Write(*)
---

## Auto Mode

When `--yes` or `-y`: Auto-confirm decisions, use balanced exploration across all perspectives.

# Workflow Brainstorm-With-File Command

## Overview

Interactive brainstorming workflow with **multi-CLI collaboration** and **documented thought evolution**. Expands initial ideas through questioning, multi-perspective analysis, and iterative refinement.

**Core workflow**: Seed Idea → Expand → Multi-CLI Discuss → Synthesize → Refine → Crystallize

**Key features**:
- **brainstorm.md**: Complete thought evolution timeline
- **Multi-CLI collaboration**: Gemini (creative), Codex (pragmatic), Claude (systematic) perspectives
- **Idea expansion**: Progressive questioning and exploration
- **Diverge-Converge cycles**: Generate options then focus on best paths
- **Synthesis**: Merge multiple perspectives into coherent solutions

## Usage

```bash
/workflow:brainstorm-with-file [FLAGS] <IDEA_OR_TOPIC>

# Flags
-y, --yes              Skip confirmations, use recommended settings
-c, --continue         Continue existing session (auto-detected if exists)
-m, --mode <mode>      Brainstorm mode: creative (divergent) | structured (goal-oriented)

# Arguments
<idea-or-topic>        Initial idea, problem, or topic to brainstorm (required)

# Examples
/workflow:brainstorm-with-file "如何重新设计用户通知系统"
/workflow:brainstorm-with-file --continue "通知系统"              # Continue existing
/workflow:brainstorm-with-file -y -m creative "创新的AI辅助功能"   # Creative auto mode
/workflow:brainstorm-with-file -m structured "优化缓存策略"       # Goal-oriented mode
```

## Execution Process

```
Session Detection:
   ├─ Check if brainstorm session exists for topic
   ├─ EXISTS + brainstorm.md exists → Continue mode
   └─ NOT_FOUND → New session mode

Phase 1: Seed Understanding
   ├─ Parse initial idea/topic
   ├─ Identify brainstorm dimensions (technical, UX, business, etc.)
   ├─ Initial scoping questions (AskUserQuestion)
   ├─ Expand seed into exploration vectors
   └─ Document in brainstorm.md

Phase 2: Divergent Exploration (Multi-CLI Parallel)
   ├─ Gemini CLI: Creative/innovative perspectives
   ├─ Codex CLI: Pragmatic/implementation perspectives
   ├─ Claude CLI: Systematic/architectural perspectives
   └─ Aggregate diverse viewpoints

Phase 3: Interactive Refinement (Multi-Round)
   ├─ Present multi-perspective findings
   ├─ User selects promising directions
   ├─ Deep dive on selected paths
   ├─ Challenge assumptions (devil's advocate)
   ├─ Update brainstorm.md with evolution
   └─ Repeat diverge-converge cycles

Phase 4: Convergence & Crystallization
   ├─ Synthesize best ideas
   ├─ Resolve conflicts between perspectives
   ├─ Formulate actionable conclusions
   ├─ Generate next steps or implementation plan
   └─ Final brainstorm.md update

Output:
   ├─ .workflow/.brainstorm/{slug}-{date}/brainstorm.md (thought evolution)
   ├─ .workflow/.brainstorm/{slug}-{date}/perspectives.json (CLI findings)
   ├─ .workflow/.brainstorm/{slug}-{date}/synthesis.json (final ideas)
   └─ .workflow/.brainstorm/{slug}-{date}/ideas/ (individual idea deep-dives)
```

---

## Implementation

### Session Setup & Mode Detection

```javascript
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

const topicSlug = idea_or_topic.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').substring(0, 40)
const dateStr = getUtc8ISOString().substring(0, 10)

const sessionId = `BS-${topicSlug}-${dateStr}`
const sessionFolder = `.workflow/.brainstorm/${sessionId}`
const brainstormPath = `${sessionFolder}/brainstorm.md`
const perspectivesPath = `${sessionFolder}/perspectives.json`
const synthesisPath = `${sessionFolder}/synthesis.json`
const ideasFolder = `${sessionFolder}/ideas`

// Auto-detect mode
const sessionExists = fs.existsSync(sessionFolder)
const hasBrainstorm = sessionExists && fs.existsSync(brainstormPath)
const forcesContinue = $ARGUMENTS.includes('--continue') || $ARGUMENTS.includes('-c')

const mode = (hasBrainstorm || forcesContinue) ? 'continue' : 'new'

// Brainstorm mode
const brainstormMode = $ARGUMENTS.includes('--mode')
  ? $ARGUMENTS.match(/--mode\s+(creative|structured)/)?.[1] || 'balanced'
  : 'balanced'

if (!sessionExists) {
  bash(`mkdir -p ${sessionFolder}/ideas`)
}
```

---

### Phase 1: Seed Understanding

**Step 1.1: Parse Seed & Identify Dimensions**

```javascript
// See Configuration section for BRAINSTORM_DIMENSIONS definition

function identifyDimensions(topic) {
  const text = topic.toLowerCase()
  const matched = []

  for (const [dimension, keywords] of Object.entries(BRAINSTORM_DIMENSIONS)) {
    if (keywords.some(k => text.includes(k))) {
      matched.push(dimension)
    }
  }

  // Default dimensions based on mode
  if (matched.length === 0) {
    return brainstormMode === 'creative'
      ? ['innovation', 'ux', 'technical']
      : ['technical', 'feasibility', 'business']
  }

  return matched
}

const dimensions = identifyDimensions(idea_or_topic)
```

**Step 1.2: Initial Scoping Questions**

```javascript
const autoYes = $ARGUMENTS.includes('--yes') || $ARGUMENTS.includes('-y')

if (mode === 'new' && !autoYes) {
  AskUserQuestion({
    questions: [
      {
        question: `头脑风暴主题: "${idea_or_topic}"\n\n您希望探索哪些方向?`,
        header: "方向",
        multiSelect: true,
        options: [
          { label: "技术方案", description: "探索技术实现可能性" },
          { label: "用户体验", description: "从用户角度出发" },
          { label: "创新突破", description: "寻找非常规解决方案" },
          { label: "可行性评估", description: "评估实际落地可能" }
        ]
      },
      {
        question: "头脑风暴深度?",
        header: "深度",
        multiSelect: false,
        options: [
          { label: "快速发散", description: "广度优先，快速生成多个想法 (15-20分钟)" },
          { label: "平衡探索", description: "深度和广度平衡 (30-60分钟)" },
          { label: "深度挖掘", description: "深入探索少数核心想法 (1-2小时)" }
        ]
      },
      {
        question: "是否有任何约束或必须考虑的因素?",
        header: "约束",
        multiSelect: true,
        options: [
          { label: "现有架构", description: "需要与现有系统兼容" },
          { label: "时间限制", description: "有实施时间约束" },
          { label: "资源限制", description: "开发资源有限" },
          { label: "无约束", description: "完全开放探索" }
        ]
      }
    ]
  })
}
```

**Step 1.3: Expand Seed into Exploration Vectors**

```javascript
// Generate exploration vectors from seed idea
const expansionPrompt = `
Given the initial idea: "${idea_or_topic}"
User focus areas: ${userFocusAreas.join(', ')}
Constraints: ${constraints.join(', ')}

Generate 5-7 exploration vectors (questions/directions) to expand this idea:

1. Core question: What is the fundamental problem/opportunity?
2. User perspective: Who benefits and how?
3. Technical angle: What enables this technically?
4. Alternative approaches: What other ways could this be solved?
5. Challenges: What could go wrong or block success?
6. Innovation angle: What would make this 10x better?
7. Integration: How does this fit with existing systems/processes?

Output as structured exploration vectors for multi-perspective analysis.
`

// ⚠️ CRITICAL: Must wait for CLI completion - do NOT proceed until result received
const expansionResult = await Bash({
  command: `ccw cli -p "${expansionPrompt}" --tool gemini --mode analysis --model gemini-2.5-flash`,
  run_in_background: false
})

const explorationVectors = parseExpansionResult(expansionResult)
```

**Step 1.4: Create brainstorm.md**

See **Templates** section for complete brainstorm.md structure. Initialize with:
- Session metadata
- Initial context (user focus, depth, constraints)
- Seed expansion (original idea + exploration vectors)
- Empty sections for thought evolution timeline

---

### Phase 2: Divergent Exploration (Multi-CLI Parallel)

**⚠️ CRITICAL - CLI EXECUTION REQUIREMENT**:
- **MUST** wait for ALL CLI executions to fully complete before proceeding
- After launching CLI with `run_in_background: true`, **STOP** and wait for hook callback
- **DO NOT** proceed to Phase 3 until all CLI results are received
- Minimize output: No processing until 100% results available

**Step 2.1: Launch Multi-CLI Perspectives**

```javascript
const cliPromises = []

// 1. Gemini: Creative/Innovative Perspective
cliPromises.push(
  Bash({
    command: `ccw cli -p "
PURPOSE: Creative brainstorming for '${idea_or_topic}' - generate innovative, unconventional ideas
Success: 5+ unique creative solutions that push boundaries

TASK:
• Think beyond obvious solutions - what would be surprising/delightful?
• Explore cross-domain inspiration (what can we learn from other industries?)
• Challenge assumptions - what if the opposite were true?
• Generate 'moonshot' ideas alongside practical ones
• Consider future trends and emerging technologies

MODE: analysis

CONTEXT: @**/* | Topic: ${idea_or_topic}
Exploration vectors: ${explorationVectors.map(v => v.title).join(', ')}

EXPECTED:
- 5+ creative ideas with brief descriptions
- Each idea rated: novelty (1-5), potential impact (1-5)
- Key assumptions challenged
- Cross-domain inspirations
- One 'crazy' idea that might just work

CONSTRAINTS: ${brainstormMode === 'structured' ? 'Keep ideas technically feasible' : 'No constraints - think freely'}
" --tool gemini --mode analysis`,
    run_in_background: true
  })
)

// 2. Codex: Pragmatic/Implementation Perspective
cliPromises.push(
  Bash({
    command: `ccw cli -p "
PURPOSE: Pragmatic analysis for '${idea_or_topic}' - focus on implementation reality
Success: Actionable approaches with clear implementation paths

TASK:
• Evaluate technical feasibility of core concept
• Identify existing patterns/libraries that could help
• Consider integration with current codebase
• Estimate implementation complexity
• Highlight potential technical blockers
• Suggest incremental implementation approach

MODE: analysis

CONTEXT: @**/* | Topic: ${idea_or_topic}
Exploration vectors: ${explorationVectors.map(v => v.title).join(', ')}

EXPECTED:
- 3-5 practical implementation approaches
- Each rated: effort (1-5), risk (1-5), reuse potential (1-5)
- Technical dependencies identified
- Quick wins vs long-term solutions
- Recommended starting point

CONSTRAINTS: Focus on what can actually be built with current tech stack
" --tool codex --mode analysis`,
    run_in_background: true
  })
)

// 3. Claude: Systematic/Architectural Perspective
cliPromises.push(
  Bash({
    command: `ccw cli -p "
PURPOSE: Systematic analysis for '${idea_or_topic}' - architectural and structural thinking
Success: Well-structured solution framework with clear tradeoffs

TASK:
• Decompose the problem into sub-problems
• Identify architectural patterns that apply
• Map dependencies and interactions
• Consider scalability implications
• Evaluate long-term maintainability
• Propose systematic solution structure

MODE: analysis

CONTEXT: @**/* | Topic: ${idea_or_topic}
Exploration vectors: ${explorationVectors.map(v => v.title).join(', ')}

EXPECTED:
- Problem decomposition diagram (text)
- 2-3 architectural approaches with tradeoffs
- Dependency mapping
- Scalability assessment
- Recommended architecture pattern
- Risk matrix

CONSTRAINTS: Consider existing system architecture
" --tool claude --mode analysis`,
    run_in_background: true
  })
)

// ⚠️ CRITICAL: Must wait for ALL results - do NOT proceed until all CLIs complete
await Promise.all(cliPromises)
```

**⚠️ STOP POINT**: After launching CLI calls, stop output immediately. Wait for hook callback to receive results before continuing to Step 2.2.

**Step 2.2: Aggregate Multi-Perspective Findings**

```javascript
const perspectives = {
  session_id: sessionId,
  timestamp: getUtc8ISOString(),
  topic: idea_or_topic,

  creative: {
    source: 'gemini',
    ideas: [...],
    insights: [...],
    challenges: [...]
  },

  pragmatic: {
    source: 'codex',
    approaches: [...],
    blockers: [...],
    recommendations: [...]
  },

  systematic: {
    source: 'claude',
    decomposition: [...],
    patterns: [...],
    tradeoffs: [...]
  },

  synthesis: {
    convergent_themes: [],
    conflicting_views: [],
    unique_contributions: []
  }
}

Write(perspectivesPath, JSON.stringify(perspectives, null, 2))
```

**Step 2.3: Update brainstorm.md with Perspectives**

Append to brainstorm.md the Round 2 multi-perspective exploration findings (see Templates section for format).

---

### Phase 3: Interactive Refinement (Multi-Round)

**Step 3.1: Present & Select Directions**

```javascript
const MAX_ROUNDS = 6
let roundNumber = 3  // After initial exploration
let brainstormComplete = false

while (!brainstormComplete && roundNumber <= MAX_ROUNDS) {

  // Present current state
  console.log(`
## Brainstorm Round ${roundNumber}

### Top Ideas So Far

${topIdeas.map((idea, i) => `
${i+1}. **${idea.title}** (${idea.source})
   ${idea.brief}
   - Novelty: ${'⭐'.repeat(idea.novelty)} | Feasibility: ${'✅'.repeat(idea.feasibility)}
`).join('\n')}

### Open Questions
${openQuestions.map((q, i) => `${i+1}. ${q}`).join('\n')}
`)

  // Gather user direction
  const userDirection = AskUserQuestion({
    questions: [
      {
        question: "哪些想法值得深入探索?",
        header: "选择",
        multiSelect: true,
        options: topIdeas.slice(0, 4).map(idea => ({
          label: idea.title,
          description: idea.brief
        }))
      },
      {
        question: "下一步?",
        header: "方向",
        multiSelect: false,
        options: [
          { label: "深入探索", description: "深入分析选中的想法" },
          { label: "继续发散", description: "生成更多新想法" },
          { label: "挑战验证", description: "Devil's advocate - 挑战当前想法" },
          { label: "合并综合", description: "尝试合并多个想法" },
          { label: "准备收敛", description: "开始整理最终结论" }
        ]
      }
    ]
  })

  // Process based on direction
  switch (userDirection.direction) {
    case "深入探索":
      await deepDiveIdeas(userDirection.selectedIdeas)
      break
    case "继续发散":
      await generateMoreIdeas()
      break
    case "挑战验证":
      await devilsAdvocate(topIdeas)
      break
    case "合并综合":
      await mergeIdeas(userDirection.selectedIdeas)
      break
    case "准备收敛":
      brainstormComplete = true
      break
  }

  // Update brainstorm.md
  updateBrainstormDocument(roundNumber, userDirection, findings)
  roundNumber++
}
```

**Step 3.2: Deep Dive on Selected Ideas**

```javascript
async function deepDiveIdeas(selectedIdeas) {
  for (const idea of selectedIdeas) {
    const ideaPath = `${ideasFolder}/${idea.slug}.md`

    // ⚠️ CRITICAL: Must wait for CLI completion before saving results
    await Bash({
      command: `ccw cli -p "
PURPOSE: Deep dive analysis on idea '${idea.title}'
Success: Comprehensive understanding with actionable next steps

TASK:
• Elaborate the core concept in detail
• Identify implementation requirements
• List potential challenges and mitigations
• Suggest proof-of-concept approach
• Define success metrics
• Map related/dependent features

MODE: analysis

CONTEXT: @**/*
Original idea: ${idea.description}
Source perspective: ${idea.source}
User interest reason: ${idea.userReason || 'Selected for exploration'}

EXPECTED:
- Detailed concept description
- Technical requirements list
- Risk/challenge matrix
- MVP definition
- Success criteria
- Recommendation: pursue/pivot/park

CONSTRAINTS: Focus on actionability
" --tool gemini --mode analysis`,
      run_in_background: false
    })

    Write(ideaPath, deepDiveContent)
  }
}
```

**Step 3.3: Devil's Advocate Challenge**

```javascript
async function devilsAdvocate(ideas) {
  // ⚠️ CRITICAL: Must wait for CLI completion before returning results
  const challengeResult = await Bash({
    command: `ccw cli -p "
PURPOSE: Devil's advocate - rigorously challenge these brainstorm ideas
Success: Uncover hidden weaknesses and strengthen viable ideas

IDEAS TO CHALLENGE:
${ideas.map((idea, i) => `${i+1}. ${idea.title}: ${idea.brief}`).join('\n')}

TASK:
• For each idea, identify 3 strongest objections
• Challenge core assumptions
• Identify scenarios where this fails
• Consider competitive/alternative solutions
• Assess whether this solves the right problem
• Rate survivability after challenge (1-5)

MODE: analysis

EXPECTED:
- Per-idea challenge report
- Critical weaknesses exposed
- Counter-arguments to objections (if any)
- Ideas that survive the challenge
- Modified/strengthened versions

CONSTRAINTS: Be genuinely critical, not just contrarian
" --tool codex --mode analysis`,
    run_in_background: false
  })

  return challengeResult
}
```

**Step 3.4: Merge & Synthesize Ideas**

```javascript
async function mergeIdeas(ideaIds) {
  const selectedIdeas = ideas.filter(i => ideaIds.includes(i.id))

  // ⚠️ CRITICAL: Must wait for CLI completion before processing merge result
  const mergeResult = await Bash({
    command: `ccw cli -p "
PURPOSE: Synthesize multiple ideas into unified concept
Success: Coherent merged idea that captures best elements

IDEAS TO MERGE:
${selectedIdeas.map((idea, i) => `
${i+1}. ${idea.title} (${idea.source})
   ${idea.description}
   Strengths: ${idea.strengths.join(', ')}
`).join('\n')}

TASK:
• Identify complementary elements
• Resolve contradictions
• Create unified concept
• Preserve key strengths from each
• Describe the merged solution
• Assess viability of merged idea

MODE: analysis

EXPECTED:
- Merged concept description
- Elements taken from each source idea
- Contradictions resolved (or noted as tradeoffs)
- New combined strengths
- Implementation considerations

CONSTRAINTS: Don't force incompatible ideas together
" --tool gemini --mode analysis`,
    run_in_background: false
  })

  const mergedIdea = parseMergeResult(mergeResult)
  ideas.push(mergedIdea)

  return mergedIdea
}
```

**Step 3.5: Document Each Round**

Append each round's findings to brainstorm.md (see Templates section for format).

---

### Phase 4: Convergence & Crystallization

**Step 4.1: Final Synthesis**

```javascript
const synthesis = {
  session_id: sessionId,
  topic: idea_or_topic,
  completed: getUtc8ISOString(),
  total_rounds: roundNumber,

  top_ideas: ideas.filter(i => i.status === 'active').sort((a,b) => b.score - a.score).slice(0, 5).map(idea => ({
    title: idea.title,
    description: idea.description,
    source_perspective: idea.source,
    score: idea.score,
    novelty: idea.novelty,
    feasibility: idea.feasibility,
    key_strengths: idea.strengths,
    main_challenges: idea.challenges,
    next_steps: idea.nextSteps
  })),

  parked_ideas: ideas.filter(i => i.status === 'parked').map(idea => ({
    title: idea.title,
    reason_parked: idea.parkReason,
    potential_future_trigger: idea.futureTrigger
  })),

  key_insights: keyInsights,

  recommendations: {
    primary: primaryRecommendation,
    alternatives: alternativeApproaches,
    not_recommended: notRecommended
  },

  follow_up: [
    { type: 'implementation', summary: '...' },
    { type: 'research', summary: '...' },
    { type: 'validation', summary: '...' }
  ]
}

Write(synthesisPath, JSON.stringify(synthesis, null, 2))
```

**Step 4.2: Final brainstorm.md Update**

Update brainstorm.md with synthesis & conclusions (see Templates section for format).

**Step 4.3: Post-Completion Options**

```javascript
AskUserQuestion({
  questions: [{
    question: "头脑风暴完成。是否需要后续操作?",
    header: "后续",
    multiSelect: true,
    options: [
      { label: "创建实施计划", description: "将最佳想法转为实施计划" },
      { label: "创建Issue", description: "将想法转为可追踪的Issue" },
      { label: "深入分析", description: "对某个想法进行深度技术分析" },
      { label: "导出分享", description: "生成可分享的报告" },
      { label: "完成", description: "不需要后续操作" }
    ]
  }]
})

// Handle selections
if (selection.includes("创建实施计划")) {
  const topIdea = synthesis.top_ideas[0]
  SlashCommand("/workflow:plan", `实施: ${topIdea.title} - ${topIdea.description}`)
}
if (selection.includes("创建Issue")) {
  for (const idea of synthesis.top_ideas.slice(0, 3)) {
    SlashCommand("/issue:new", `${idea.title}: ${idea.next_steps[0]}`)
  }
}
if (selection.includes("深入分析")) {
  SlashCommand("/workflow:analyze-with-file", synthesis.top_ideas[0].title)
}
if (selection.includes("导出分享")) {
  exportBrainstormReport(sessionFolder)
}
```

---

## Configuration

### Brainstorm Dimensions

```javascript
const BRAINSTORM_DIMENSIONS = {
  technical: ['技术', 'technical', 'implementation', 'code', '实现', 'architecture'],
  ux: ['用户', 'user', 'experience', 'UX', 'UI', '体验', 'interaction'],
  business: ['业务', 'business', 'value', 'ROI', '价值', 'market'],
  innovation: ['创新', 'innovation', 'novel', 'creative', '新颖'],
  feasibility: ['可行', 'feasible', 'practical', 'realistic', '实际'],
  scalability: ['扩展', 'scale', 'growth', 'performance', '性能'],
  security: ['安全', 'security', 'risk', 'protection', '风险']
}
```

### Multi-CLI Collaboration Strategy

**Perspective Roles**

| CLI | Role | Focus | Best For |
|-----|------|-------|----------|
| Gemini | Creative | Innovation, cross-domain | Generating novel ideas |
| Codex | Pragmatic | Implementation, feasibility | Reality-checking ideas |
| Claude | Systematic | Architecture, structure | Organizing solutions |

**Collaboration Patterns**

1. **Parallel Divergence**: All CLIs explore simultaneously from different angles
2. **Sequential Deep-Dive**: One CLI expands, others critique/refine
3. **Debate Mode**: CLIs argue for/against specific approaches
4. **Synthesis Mode**: Combine insights from all perspectives

**When to Use Each Pattern**

- **New topic**: Parallel Divergence → get diverse initial ideas
- **Promising idea**: Sequential Deep-Dive → thorough exploration
- **Controversial approach**: Debate Mode → uncover hidden issues
- **Ready to decide**: Synthesis Mode → create actionable conclusion

### Error Handling

| Situation | Action |
|-----------|--------|
| CLI timeout | Retry with shorter prompt, or continue without that perspective |
| No good ideas | Reframe the problem, adjust constraints, try different angles |
| User disengaged | Summarize progress, offer break point with resume option |
| Perspectives conflict | Present as tradeoff, let user decide direction |
| Max rounds reached | Force synthesis, highlight unresolved questions |
| All ideas fail challenge | Return to divergent phase with new constraints |

---

## Templates

### Session Folder Structure

```
.workflow/.brainstorm/BS-{slug}-{date}/
├── brainstorm.md        # Complete thought evolution
├── perspectives.json    # Multi-CLI perspective findings
├── synthesis.json       # Final synthesis
└── ideas/               # Individual idea deep-dives
    ├── idea-1.md
    ├── idea-2.md
    └── merged-idea-1.md
```

### Brainstorm Document Template

```markdown
# Brainstorm Session

**Session ID**: BS-xxx-YYYY-MM-DD
**Topic**: [idea or topic]
**Started**: YYYY-MM-DDTHH:mm:ss+08:00
**Mode**: creative | structured | balanced
**Dimensions**: [technical, ux, innovation, ...]

---

## Initial Context

**User Focus**: [selected focus areas]
**Depth**: [quick|balanced|deep]
**Constraints**: [if any]

---

## Seed Expansion

### Original Idea
> [the initial idea]

### Exploration Vectors

#### Vector 1: [title]
**Question**: [question]
**Angle**: [angle]
**Potential**: [potential]

[... more vectors ...]

---

## Thought Evolution Timeline

### Round 1 - Seed Understanding (timestamp)

#### Initial Parsing
- **Core concept**: [concept]
- **Problem space**: [space]
- **Opportunity**: [opportunity]

#### Key Questions to Explore
1. [question 1]
2. [question 2]
...

---

### Round 2 - Multi-Perspective Exploration (timestamp)

#### Creative Perspective (Gemini)

**Top Creative Ideas**:
1. **[Title]** ⭐ Novelty: X/5 | Impact: Y/5
   [description]

**Challenged Assumptions**:
- ~~[assumption]~~ → Consider: [alternative]

**Cross-Domain Inspirations**:
- [inspiration]

---

#### Pragmatic Perspective (Codex)

**Implementation Approaches**:
1. **[Title]** | Effort: X/5 | Risk: Y/5
   [description]
   - Quick win: [win]
   - Dependencies: [deps]

**Technical Blockers**:
- ⚠️ [blocker]

---

#### Systematic Perspective (Claude)

**Problem Decomposition**:
[decomposition]

**Architectural Options**:
1. **[Pattern]**
   - Pros: [pros]
   - Cons: [cons]
   - Best for: [context]

---

#### Perspective Synthesis

**Convergent Themes** (all perspectives agree):
- ✅ [theme]

**Conflicting Views** (need resolution):
- 🔄 [topic]
  - Creative: [view]
  - Pragmatic: [view]
  - Systematic: [view]

**Unique Contributions**:
- 💡 [source] [insight]

---

### Round 3+ - [Round Type] (timestamp)

[Round-specific content: deep-dive, challenge, merge, etc.]

---

## Synthesis & Conclusions (timestamp)

### Executive Summary

[summary]

### Top Ideas (Final Ranking)

#### 1. [Title] ⭐ Score: X/10

**Description**: [description]

**Why This Idea**:
- ✅ [strength]

**Main Challenges**:
- ⚠️ [challenge]

**Recommended Next Steps**:
1. [step]
2. [step]

---

[... more ideas ...]

### Primary Recommendation

> [recommendation]

**Rationale**: [rationale]

**Quick Start Path**:
1. [step]
2. [step]
3. [step]

### Alternative Approaches

1. **[Title]**
   - When to consider: [when]
   - Tradeoff: [tradeoff]

### Ideas Parked for Future

- **[Title]** (Parked: [reason])
  - Revisit when: [trigger]

---

## Key Insights

### Process Discoveries

- 💡 [discovery]

### Assumptions Challenged

- ~~[original]~~ → [updated]

### Unexpected Connections

- 🔗 [connection]

---

## Current Understanding (Final)

### Problem Reframed

[reframed problem]

### Solution Space Mapped

[solution space]

### Decision Framework

When to choose each approach:
[framework]

---

## Session Statistics

- **Total Rounds**: [n]
- **Ideas Generated**: [n]
- **Ideas Survived**: [n]
- **Perspectives Used**: Gemini (creative), Codex (pragmatic), Claude (systematic)
- **Duration**: [duration]
- **Artifacts**: brainstorm.md, perspectives.json, synthesis.json, [n] idea deep-dives
```

---

## Usage Recommendations

**Use `/workflow:brainstorm-with-file` when:**
- Starting a new feature/product without clear direction
- Facing a complex problem with multiple possible solutions
- Need to explore alternatives before committing
- Want documented thinking process for team review
- Combining multiple stakeholder perspectives

**Use `/workflow:analyze-with-file` when:**
- Investigating existing code/system
- Need factual analysis over ideation
- Debugging or troubleshooting
- Understanding current state

**Use `/workflow:plan` when:**
- Direction is already clear
- Ready to move from ideas to execution
- Need implementation breakdown
