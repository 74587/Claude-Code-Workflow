---
description: Interactive brainstorming with serial CLI collaboration, idea expansion, and documented thought evolution. Sequential multi-perspective analysis for Codex.
argument-hint: "TOPIC=\"<idea or topic>\" [--perspectives=creative,pragmatic,systematic] [--max-ideas=<n>] [--focus=<area>] [--mode=creative|structured|balanced]"
---

# Codex Brainstorm-With-File Prompt

## Overview

Interactive brainstorming workflow with **documented thought evolution**. Expands initial ideas through questioning, multi-perspective analysis, and iterative refinement.

**Core workflow**: Seed Idea → Expand → Serial CLI Explore → Synthesize → Refine → Crystallize

**Key features**:
- **brainstorm.md**: Complete thought evolution timeline
- **Serial multi-perspective**: Creative → Pragmatic → Systematic (sequential)
- **Idea expansion**: Progressive questioning and exploration
- **Diverge-Converge cycles**: Generate options then focus on best paths

## Target Topic

**$TOPIC**

**Parameters**:
- `--perspectives`: Analysis perspectives (default: creative,pragmatic,systematic)
- `--max-ideas`: Max number of ideas per perspective (default: 5)
- `--focus`: Focus area (technical/ux/business/innovation)
- `--mode`: Brainstorm mode (creative/structured/balanced, default: balanced)

## Execution Process

```
Session Detection:
   ├─ Check if brainstorm session exists for topic
   ├─ EXISTS + brainstorm.md exists → Continue mode
   └─ NOT_FOUND → New session mode

Phase 1: Seed Understanding
   ├─ Parse initial idea/topic
   ├─ Identify brainstorm dimensions
   ├─ Initial scoping with user
   ├─ Expand seed into exploration vectors
   └─ Document in brainstorm.md

Phase 2: Divergent Exploration (Serial CLI)
   ├─ Step 1: Codebase context gathering (Glob/Grep/Read)
   ├─ Step 2: Creative perspective (Gemini CLI)
   ├─ Step 3: Pragmatic perspective (Codex CLI) ← Wait for Step 2
   ├─ Step 4: Systematic perspective (Claude CLI) ← Wait for Step 3
   └─ Aggregate perspectives sequentially

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
   ├─ Generate next steps
   └─ Final brainstorm.md update

Output:
   ├─ .workflow/.brainstorm/{slug}-{date}/brainstorm.md (thought evolution)
   ├─ .workflow/.brainstorm/{slug}-{date}/perspectives.json (analysis findings)
   ├─ .workflow/.brainstorm/{slug}-{date}/synthesis.json (final ideas)
   └─ .workflow/.brainstorm/{slug}-{date}/ideas/ (individual idea deep-dives)
```

## Output Structure

```
.workflow/.brainstorm/BS-{slug}-{date}/
├── brainstorm.md                  # ⭐ Complete thought evolution timeline
├── exploration-codebase.json      # Phase 2: Codebase context
├── perspectives.json              # Phase 2: Serial CLI findings
├── synthesis.json                 # Phase 4: Final synthesis
└── ideas/                         # Phase 3: Individual idea deep-dives
    ├── idea-1.md
    ├── idea-2.md
    └── merged-idea-1.md
```

---

## Implementation Details

### Session Setup

```javascript
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

const topicSlug = "$TOPIC".toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').substring(0, 40)
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
const mode = hasBrainstorm ? 'continue' : 'new'

if (!sessionExists) {
  bash(`mkdir -p ${sessionFolder}/ideas`)
}
```

---

### Phase 1: Seed Understanding

#### Step 1.1: Parse Seed & Identify Dimensions

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

function identifyDimensions(topic) {
  const text = topic.toLowerCase()
  const matched = []

  for (const [dimension, keywords] of Object.entries(BRAINSTORM_DIMENSIONS)) {
    if (keywords.some(k => text.includes(k))) {
      matched.push(dimension)
    }
  }

  return matched.length > 0 ? matched : ['technical', 'innovation', 'feasibility']
}

const dimensions = identifyDimensions("$TOPIC")
```

#### Step 1.2: Initial Scoping (New Session Only)

Ask user to scope the brainstorm:

- Focus areas: 技术方案 / 用户体验 / 创新突破 / 可行性评估
- Brainstorm depth: Quick Divergence / Balanced Exploration / Deep Dive

#### Step 1.3: Expand Seed into Exploration Vectors

**CLI Call** (synchronous):
```bash
ccw cli -p "
Given the initial idea: '$TOPIC'
Dimensions: ${dimensions}

Generate 5-7 exploration vectors (questions/directions) to expand this idea:
1. Core question: What is the fundamental problem/opportunity?
2. User perspective: Who benefits and how?
3. Technical angle: What enables this technically?
4. Alternative approaches: What other ways could this be solved?
5. Challenges: What could go wrong or block success?
6. Innovation angle: What would make this 10x better?
7. Integration: How does this fit with existing systems/processes?

Output as structured exploration vectors for multi-perspective analysis.
" --tool gemini --mode analysis --model gemini-2.5-flash
```

#### Step 1.4: Create brainstorm.md

```markdown
# Brainstorm Session

**Session ID**: ${sessionId}
**Topic**: $TOPIC
**Started**: ${getUtc8ISOString()}
**Dimensions**: ${dimensions.join(', ')}

---

## Initial Context

**Focus Areas**: ${userFocusAreas.join(', ')}
**Depth**: ${brainstormDepth}
**Constraints**: ${constraints.join(', ') || 'None specified'}

---

## Seed Expansion

### Original Idea
> $TOPIC

### Exploration Vectors
${explorationVectors.map((v, i) => `
#### Vector ${i+1}: ${v.title}
**Question**: ${v.question}
**Angle**: ${v.angle}
**Potential**: ${v.potential}
`).join('\n')}

---

## Thought Evolution Timeline

### Round 1 - Seed Understanding (${timestamp})

#### Initial Parsing
- **Core concept**: ${coreConcept}
- **Problem space**: ${problemSpace}
- **Opportunity**: ${opportunity}

#### Key Questions to Explore
${keyQuestions.map((q, i) => `${i+1}. ${q}`).join('\n')}

---

## Current Ideas

*To be populated after exploration phases*

---

## Idea Graveyard

*Discarded ideas with reasons - kept for reference*
```

---

### Phase 2: Divergent Exploration (Serial CLI)

**⚠️ CRITICAL: Execute CLI calls SERIALLY, not in parallel**

Codex does not support parallel agent execution. Each perspective must complete before starting the next.

#### Step 2.1: Codebase Context Gathering

Use built-in tools to gather context (no agent needed):

```javascript
// 1. Get project structure
const modules = bash("ccw tool exec get_modules_by_depth '{}'")

// 2. Search for related code
const relatedFiles = Glob("**/*.{ts,js,tsx,jsx}")
const topicSearch = Grep({
  pattern: topicKeywords.join('|'),
  path: "src/",
  output_mode: "files_with_matches"
})

// 3. Read project tech context
const projectTech = Read(".workflow/project-tech.json")

// Build exploration context
const explorationContext = {
  relevant_files: topicSearch.files,
  existing_patterns: extractPatterns(modules),
  architecture_constraints: projectTech?.architecture || [],
  integration_points: projectTech?.integrations || []
}

Write(`${sessionFolder}/exploration-codebase.json`, JSON.stringify(explorationContext, null, 2))
```

#### Step 2.2: Creative Perspective (FIRST)

```bash
ccw cli -p "
PURPOSE: Creative brainstorming for '$TOPIC' - generate innovative, unconventional ideas
Success: 5+ unique creative solutions that push boundaries

PRIOR CODEBASE CONTEXT:
- Key files: ${explorationContext.relevant_files.slice(0,5).join(', ')}
- Existing patterns: ${explorationContext.existing_patterns.slice(0,3).join(', ')}

TASK:
• Think beyond obvious solutions - what would be surprising/delightful?
• Explore cross-domain inspiration (what can we learn from other industries?)
• Challenge assumptions - what if the opposite were true?
• Generate 'moonshot' ideas alongside practical ones
• Consider future trends and emerging technologies

MODE: analysis

CONTEXT: @**/* | Topic: $TOPIC

EXPECTED:
- 5+ creative ideas with brief descriptions
- Each idea rated: novelty (1-5), potential impact (1-5)
- Key assumptions challenged
- Cross-domain inspirations
- One 'crazy' idea that might just work

OUTPUT FORMAT: JSON with ideas[], challenged_assumptions[], inspirations[]
" --tool gemini --mode analysis
```

**⏳ Wait for completion before proceeding**

#### Step 2.3: Pragmatic Perspective (AFTER Creative)

```bash
ccw cli -p "
PURPOSE: Pragmatic analysis for '$TOPIC' - focus on implementation reality
Success: Actionable approaches with clear implementation paths

PRIOR CODEBASE CONTEXT:
- Key files: ${explorationContext.relevant_files.slice(0,5).join(', ')}
- Architecture constraints: ${explorationContext.architecture_constraints.slice(0,3).join(', ')}

CREATIVE IDEAS FROM PREVIOUS STEP:
${creativeResult.ideas.map(i => `- ${i.title}`).join('\n')}

TASK:
• Evaluate technical feasibility of creative ideas above
• Identify existing patterns/libraries that could help
• Consider integration with current codebase
• Estimate implementation complexity
• Highlight potential technical blockers
• Suggest incremental implementation approach

MODE: analysis

CONTEXT: @**/* | Topic: $TOPIC

EXPECTED:
- 3-5 practical implementation approaches
- Each rated: effort (1-5), risk (1-5), reuse potential (1-5)
- Technical dependencies identified
- Quick wins vs long-term solutions
- Recommended starting point

OUTPUT FORMAT: JSON with approaches[], blockers[], recommendations[]
" --tool codex --mode analysis
```

**⏳ Wait for completion before proceeding**

#### Step 2.4: Systematic Perspective (AFTER Pragmatic)

```bash
ccw cli -p "
PURPOSE: Systematic analysis for '$TOPIC' - architectural and structural thinking
Success: Well-structured solution framework with clear tradeoffs

PRIOR CODEBASE CONTEXT:
- Architecture constraints: ${explorationContext.architecture_constraints.join(', ')}
- Integration points: ${explorationContext.integration_points.join(', ')}

CREATIVE IDEAS: ${creativeResult.ideas.map(i => i.title).join(', ')}
PRAGMATIC APPROACHES: ${pragmaticResult.approaches.map(a => a.title).join(', ')}

TASK:
• Decompose the problem into sub-problems
• Identify architectural patterns that apply
• Map dependencies and interactions
• Consider scalability implications
• Evaluate long-term maintainability
• Propose systematic solution structure

MODE: analysis

CONTEXT: @**/* | Topic: $TOPIC

EXPECTED:
- Problem decomposition diagram (text)
- 2-3 architectural approaches with tradeoffs
- Dependency mapping
- Scalability assessment
- Recommended architecture pattern
- Risk matrix

OUTPUT FORMAT: JSON with decomposition[], patterns[], tradeoffs[], risks[]
" --tool claude --mode analysis
```

**⏳ Wait for completion before proceeding**

#### Step 2.5: Aggregate Perspectives

```javascript
const perspectives = {
  session_id: sessionId,
  timestamp: getUtc8ISOString(),
  topic: "$TOPIC",

  creative: creativeResult,
  pragmatic: pragmaticResult,
  systematic: systematicResult,

  synthesis: {
    convergent_themes: findConvergentThemes(creativeResult, pragmaticResult, systematicResult),
    conflicting_views: findConflicts(creativeResult, pragmaticResult, systematicResult),
    unique_contributions: extractUniqueInsights(creativeResult, pragmaticResult, systematicResult)
  }
}

Write(perspectivesPath, JSON.stringify(perspectives, null, 2))
```

#### Step 2.6: Update brainstorm.md

Append Round 2 section:

```markdown
### Round 2 - Multi-Perspective Exploration (${timestamp})

#### Creative Perspective
${creativeIdeas.map((idea, i) => `
${i+1}. **${idea.title}** ⭐ Novelty: ${idea.novelty}/5 | Impact: ${idea.impact}/5
   ${idea.description}
`).join('\n')}

**Challenged Assumptions**:
${challengedAssumptions.map(a => `- ~~${a.assumption}~~ → Consider: ${a.alternative}`).join('\n')}

---

#### Pragmatic Perspective
${pragmaticApproaches.map((a, i) => `
${i+1}. **${a.title}** | Effort: ${a.effort}/5 | Risk: ${a.risk}/5
   ${a.description}
   - Quick win: ${a.quickWin}
   - Dependencies: ${a.dependencies.join(', ')}
`).join('\n')}

**Technical Blockers**:
${blockers.map(b => `- ⚠️ ${b}`).join('\n')}

---

#### Systematic Perspective
**Problem Decomposition**:
${decomposition}

**Architectural Options**:
${architecturalOptions.map((opt, i) => `
${i+1}. **${opt.pattern}**
   - Pros: ${opt.pros.join(', ')}
   - Cons: ${opt.cons.join(', ')}
   - Best for: ${opt.bestFor}
`).join('\n')}

---

#### Perspective Synthesis

**Convergent Themes** (all perspectives agree):
${convergentThemes.map(t => `- ✅ ${t}`).join('\n')}

**Conflicting Views** (need resolution):
${conflictingViews.map(v => `- 🔄 ${v.topic}: ${v.summary}`).join('\n')}

**Unique Contributions**:
${uniqueContributions.map(c => `- 💡 [${c.source}] ${c.insight}`).join('\n')}
```

---

### Phase 3: Interactive Refinement

#### Step 3.1: Present & Select Directions

```javascript
const MAX_ROUNDS = 6
let roundNumber = 3

while (!brainstormComplete && roundNumber <= MAX_ROUNDS) {

  // Present current top ideas
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

  // User selects direction:
  // - 深入探索: Deep dive on selected ideas
  // - 继续发散: Generate more ideas
  // - 挑战验证: Devil's advocate challenge
  // - 合并综合: Merge multiple ideas
  // - 准备收敛: Start concluding

  roundNumber++
}
```

#### Step 3.2: Deep Dive on Selected Idea

**CLI Call** (synchronous):
```bash
ccw cli -p "
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

EXPECTED:
- Detailed concept description
- Technical requirements list
- Risk/challenge matrix
- MVP definition
- Success criteria
- Recommendation: pursue/pivot/park
" --tool gemini --mode analysis
```

Write output to `${ideasFolder}/${idea.slug}.md`

#### Step 3.3: Devil's Advocate Challenge

**CLI Call** (synchronous):
```bash
ccw cli -p "
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
" --tool codex --mode analysis
```

#### Step 3.4: Merge Ideas

**CLI Call** (synchronous):
```bash
ccw cli -p "
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
" --tool gemini --mode analysis
```

#### Step 3.5: Document Each Round

Append to brainstorm.md:

```markdown
### Round ${n} - ${roundType} (${timestamp})

#### User Direction
- **Selected ideas**: ${selectedIdeas.join(', ')}
- **Action**: ${action}
- **Reasoning**: ${userReasoning || 'Not specified'}

${roundContent}

#### Updated Idea Ranking
${updatedRanking.map((idea, i) => `
${i+1}. **${idea.title}** ${idea.status}
   - Score: ${idea.score}/10
   - Source: ${idea.source}
`).join('\n')}
```

---

### Phase 4: Convergence & Crystallization

#### Step 4.1: Final Synthesis

```javascript
const synthesis = {
  session_id: sessionId,
  topic: "$TOPIC",
  completed: getUtc8ISOString(),
  total_rounds: roundNumber,

  top_ideas: ideas.filter(i => i.status === 'active')
    .sort((a,b) => b.score - a.score)
    .slice(0, 5)
    .map(idea => ({
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

  parked_ideas: ideas.filter(i => i.status === 'parked')
    .map(idea => ({
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

#### Step 4.2: Final brainstorm.md Update

```markdown
---

## Synthesis & Conclusions (${timestamp})

### Executive Summary
${executiveSummary}

### Top Ideas (Final Ranking)
${topIdeas.map((idea, i) => `
#### ${i+1}. ${idea.title} ⭐ Score: ${idea.score}/10

**Description**: ${idea.description}

**Why This Idea**:
${idea.strengths.map(s => `- ✅ ${s}`).join('\n')}

**Main Challenges**:
${idea.challenges.map(c => `- ⚠️ ${c}`).join('\n')}

**Recommended Next Steps**:
${idea.nextSteps.map((s, j) => `${j+1}. ${s}`).join('\n')}

---
`).join('\n')}

### Primary Recommendation
> ${primaryRecommendation}

**Rationale**: ${primaryRationale}

### Alternative Approaches
${alternatives.map((alt, i) => `
${i+1}. **${alt.title}**
   - When to consider: ${alt.whenToConsider}
   - Tradeoff: ${alt.tradeoff}
`).join('\n')}

### Ideas Parked for Future
${parkedIdeas.map(idea => `
- **${idea.title}** (Parked: ${idea.reason})
  - Revisit when: ${idea.futureTrigger}
`).join('\n')}

---

## Key Insights

### Process Discoveries
${processDiscoveries.map(d => `- 💡 ${d}`).join('\n')}

### Assumptions Challenged
${challengedAssumptions.map(a => `- ~~${a.original}~~ → ${a.updated}`).join('\n')}

---

## Session Statistics

- **Total Rounds**: ${totalRounds}
- **Ideas Generated**: ${totalIdeas}
- **Ideas Survived**: ${survivedIdeas}
- **Perspectives Used**: Creative → Pragmatic → Systematic (serial)
- **Artifacts**: brainstorm.md, perspectives.json, synthesis.json, ${ideaFiles.length} idea deep-dives
```

#### Step 4.3: Post-Completion Options

Offer follow-up options:
- Create Implementation Plan
- Create Issue
- Deep Analysis
- Export Report
- Complete

---

## Configuration

### Brainstorm Dimensions

| Dimension | Keywords |
|-----------|----------|
| technical | 技术, technical, implementation, code, 实现 |
| ux | 用户, user, experience, UX, UI, 体验 |
| business | 业务, business, value, ROI, 价值 |
| innovation | 创新, innovation, novel, creative, 新颖 |
| feasibility | 可行, feasible, practical, realistic, 实际 |
| scalability | 扩展, scale, growth, performance, 性能 |
| security | 安全, security, risk, protection, 风险 |

### Perspective Configuration

| Perspective | CLI Tool | Focus | Execution Order |
|-------------|----------|-------|-----------------|
| Creative | Gemini | Innovation, cross-domain | 1st (baseline) |
| Pragmatic | Codex | Implementation, feasibility | 2nd (builds on Creative) |
| Systematic | Claude | Architecture, structure | 3rd (integrates both) |

### Serial Execution Benefits

1. **Context building**: Each perspective builds on previous findings
2. **No race conditions**: Deterministic output order
3. **Better synthesis**: Later perspectives can reference earlier ones
4. **Simpler error handling**: Single failure point at a time

---

## Error Handling

| Situation | Action |
|-----------|--------|
| CLI timeout | Retry with shorter prompt, or skip perspective |
| No good ideas | Reframe the problem, adjust constraints |
| User disengaged | Summarize progress, offer break point |
| Perspectives conflict | Present as tradeoff, let user decide |
| Max rounds reached | Force synthesis, highlight unresolved questions |
| Session folder conflict | Append timestamp suffix |

---

## Iteration Flow

```
First Call (TOPIC="topic"):
   ├─ No session exists → New mode
   ├─ Identify brainstorm dimensions
   ├─ Scope with user
   ├─ Create brainstorm.md
   ├─ Expand seed into exploration vectors
   ├─ Serial CLI exploration (Creative → Pragmatic → Systematic)
   └─ Enter refinement loop

Continue Call (TOPIC="topic"):
   ├─ Session exists → Continue mode
   ├─ Load brainstorm.md
   ├─ Resume from last round
   └─ Continue refinement loop

Refinement Loop:
   ├─ Present current findings and top ideas
   ├─ Gather user feedback
   ├─ Process response:
   │   ├─ Deep dive → Explore selected ideas
   │   ├─ Diverge → Generate more ideas
   │   ├─ Challenge → Devil's advocate testing
   │   ├─ Merge → Combine multiple ideas
   │   └─ Converge → Exit loop for synthesis
   ├─ Update brainstorm.md
   └─ Repeat until complete or max rounds

Completion:
   ├─ Generate synthesis.json
   ├─ Update brainstorm.md with final synthesis
   └─ Offer follow-up options
```

---

**Now execute the brainstorm-with-file workflow for topic**: $TOPIC
