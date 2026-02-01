---
description: Interactive collaborative analysis with documented discussions, CLI-assisted exploration, and evolving understanding. Serial analysis for Codex.
argument-hint: "TOPIC=\"<question or topic>\" [--focus=<area>] [--depth=quick|standard|deep] [--continue]"
---

# Codex Analyze-With-File Prompt

## Overview

Interactive collaborative analysis workflow with **documented discussion process**. Records understanding evolution, facilitates multi-round Q&A, and uses CLI tools for deep exploration.

**Core workflow**: Topic → Explore → Discuss → Document → Refine → Conclude

## Target Topic

**$TOPIC**

**Parameters**:
- `--focus`: Focus area (code|architecture|practice|diagnosis, default: code)
- `--depth`: Analysis depth (quick/standard/deep, default: standard)
- `--continue`: Resume existing analysis session

## Execution Process

```
Session Detection:
   ├─ Check if analysis session exists for topic
   ├─ EXISTS + discussion.md exists → Continue mode
   └─ NOT_FOUND → New session mode

Phase 1: Topic Understanding
   ├─ Parse topic/question
   ├─ Identify analysis dimensions
   ├─ Initial scoping with user
   └─ Initialize discussion.md

Phase 2: CLI Exploration (Serial)
   ├─ Step 1: Codebase context gathering (Glob/Grep/Read)
   ├─ Step 2: Gemini CLI analysis (build on codebase findings)
   └─ Aggregate findings into explorations.json

Phase 3: Interactive Discussion (Multi-Round)
   ├─ Present exploration findings
   ├─ Facilitate Q&A with user
   ├─ Capture user insights and corrections
   ├─ Actions: Deepen | Adjust | Answer | Complete
   ├─ Update discussion.md with each round
   └─ Repeat until clarity achieved (max 5 rounds)

Phase 4: Synthesis & Conclusion
   ├─ Consolidate all insights
   ├─ Generate conclusions with recommendations
   ├─ Update discussion.md with final synthesis
   └─ Offer follow-up options

Output:
   ├─ .workflow/.analysis/{slug}-{date}/discussion.md (evolution)
   ├─ .workflow/.analysis/{slug}-{date}/exploration-codebase.json (codebase context)
   ├─ .workflow/.analysis/{slug}-{date}/explorations.json (CLI findings)
   └─ .workflow/.analysis/{slug}-{date}/conclusions.json (final synthesis)
```

## Output Structure

```
.workflow/.analysis/ANL-{slug}-{date}/
├── discussion.md                # ⭐ Evolution of understanding & discussions
├── exploration-codebase.json    # Phase 2: Codebase context
├── explorations.json            # Phase 2: CLI analysis findings
└── conclusions.json             # Phase 4: Final synthesis
```

---

## Implementation Details

### Session Setup

```javascript
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

const topicSlug = "$TOPIC".toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').substring(0, 40)
const dateStr = getUtc8ISOString().substring(0, 10)

const sessionId = `ANL-${topicSlug}-${dateStr}`
const sessionFolder = `.workflow/.analysis/${sessionId}`
const discussionPath = `${sessionFolder}/discussion.md`
const explorationPath = `${sessionFolder}/exploration-codebase.json`
const explorationsPath = `${sessionFolder}/explorations.json`
const conclusionsPath = `${sessionFolder}/conclusions.json`

// Auto-detect mode
const sessionExists = fs.existsSync(sessionFolder)
const hasDiscussion = sessionExists && fs.existsSync(discussionPath)
const mode = hasDiscussion ? 'continue' : 'new'

if (!sessionExists) {
  bash(`mkdir -p ${sessionFolder}`)
}
```

---

### Phase 1: Topic Understanding

#### Step 1.1: Parse Topic & Identify Dimensions

```javascript
const ANALYSIS_DIMENSIONS = {
  architecture: ['架构', 'architecture', 'design', 'structure', '设计', 'pattern'],
  implementation: ['实现', 'implement', 'code', 'coding', '代码', 'logic'],
  performance: ['性能', 'performance', 'optimize', 'bottleneck', '优化', 'speed'],
  security: ['安全', 'security', 'auth', 'permission', '权限', 'vulnerability'],
  concept: ['概念', 'concept', 'theory', 'principle', '原理', 'understand'],
  comparison: ['比较', 'compare', 'vs', 'difference', '区别', 'versus'],
  decision: ['决策', 'decision', 'choice', 'tradeoff', '选择', 'trade-off']
}

function identifyDimensions(topic) {
  const text = topic.toLowerCase()
  const matched = []

  for (const [dimension, keywords] of Object.entries(ANALYSIS_DIMENSIONS)) {
    if (keywords.some(k => text.includes(k))) {
      matched.push(dimension)
    }
  }

  return matched.length > 0 ? matched : ['architecture', 'implementation']
}

const dimensions = identifyDimensions("$TOPIC")
```

#### Step 1.2: Initial Scoping (New Session Only)

Ask user to scope the analysis:

- Focus areas: 代码实现 / 架构设计 / 最佳实践 / 问题诊断
- Analysis depth: 快速概览 / 标准分析 / 深度挖掘

#### Step 1.3: Initialize discussion.md

```markdown
# Analysis Session

**Session ID**: ${sessionId}
**Topic**: $TOPIC
**Started**: ${getUtc8ISOString()}
**Dimensions**: ${dimensions.join(', ')}

---

## Analysis Context

**Focus Areas**: ${focusAreas.join(', ')}
**Depth**: ${analysisDepth}
**Scope**: ${scope || 'Full codebase'}

---

## Initial Questions

${keyQuestions.map((q, i) => `${i+1}. ${q}`).join('\n')}

---

## Discussion Timeline

### Round 1 - Initial Understanding (${timestamp})

#### Key Questions
${keyQuestions.map((q, i) => `${i+1}. ${q}`).join('\n')}

---

## Current Understanding

*To be populated after exploration phases*
```

---

### Phase 2: CLI Exploration (Serial)

#### Step 2.1: Codebase Context Gathering

Use built-in tools (no agent needed):

```javascript
// 1. Get project structure
const modules = bash("ccw tool exec get_modules_by_depth '{}'")

// 2. Search for related code
const topicKeywords = extractKeywords("$TOPIC")
const relatedFiles = Grep({
  pattern: topicKeywords.join('|'),
  path: "src/",
  output_mode: "files_with_matches"
})

// 3. Read project tech context
const projectTech = Read(".workflow/project-tech.json")

// Build exploration context
const explorationContext = {
  relevant_files: relatedFiles.map(f => ({ path: f, relevance: 'high' })),
  patterns: extractPatterns(modules),
  constraints: projectTech?.constraints || [],
  integration_points: projectTech?.integrations || []
}

Write(`${sessionFolder}/exploration-codebase.json`, JSON.stringify(explorationContext, null, 2))
```

#### Step 2.2: Gemini CLI Analysis

**CLI Call** (synchronous):
```bash
ccw cli -p "
PURPOSE: Analyze '${topic}' from ${dimensions.join(', ')} perspectives
Success: Actionable insights with clear reasoning

PRIOR CODEBASE CONTEXT:
- Key files: ${explorationContext.relevant_files.slice(0,5).map(f => f.path).join(', ')}
- Patterns found: ${explorationContext.patterns.slice(0,3).join(', ')}
- Constraints: ${explorationContext.constraints.slice(0,3).join(', ')}

TASK:
• Build on exploration findings above
• Analyze common patterns and anti-patterns
• Highlight potential issues or opportunities
• Generate discussion points for user clarification
• Provide 3-5 key insights with evidence

MODE: analysis

CONTEXT: @**/* | Topic: $TOPIC

EXPECTED:
- Structured analysis with clear sections
- Specific insights tied to evidence (file:line references where applicable)
- Questions to deepen understanding
- Recommendations with rationale
- Confidence levels (high/medium/low) for each conclusion

CONSTRAINTS: Focus on ${dimensions.join(', ')} | Ignore test files
" --tool gemini --mode analysis
```

**⏳ Wait for completion**

#### Step 2.3: Aggregate Findings

```javascript
const explorations = {
  session_id: sessionId,
  timestamp: getUtc8ISOString(),
  topic: "$TOPIC",
  dimensions: dimensions,

  sources: [
    { type: 'codebase', summary: 'Project structure and related files' },
    { type: 'cli_analysis', summary: 'Gemini deep analysis' }
  ],

  key_findings: [
    // Populated from CLI analysis
  ],

  discussion_points: [
    // Questions for user engagement
  ],

  open_questions: [
    // Unresolved items
  ]
}

Write(explorationsPath, JSON.stringify(explorations, null, 2))
```

#### Step 2.4: Update discussion.md

Append Round 2 section:

```markdown
### Round 2 - Initial Exploration (${timestamp})

#### Codebase Findings
${explorationContext.relevant_files.slice(0,5).map(f => `- ${f.path}: ${f.relevance}`).join('\n')}

#### Analysis Results

**Key Findings**:
${keyFindings.map(f => `- 📍 ${f}`).join('\n')}

**Discussion Points**:
${discussionPoints.map(p => `- ❓ ${p}`).join('\n')}

**Recommendations**:
${recommendations.map(r => `- ✅ ${r}`).join('\n')}

---
```

---

### Phase 3: Interactive Discussion

#### Step 3.1: Present & Gather Feedback

```javascript
const MAX_ROUNDS = 5
let roundNumber = 3

while (!analysisComplete && roundNumber <= MAX_ROUNDS) {

  // Present current findings
  console.log(`
## Analysis Round ${roundNumber}

### Current Understanding
${currentUnderstanding}

### Key Questions Still Open
${openQuestions.map((q, i) => `${i+1}. ${q}`).join('\n')}

### User Options:
- 继续深入: Deepen current direction
- 调整方向: Change analysis angle
- 有具体问题: Ask specific question
- 分析完成: Ready for synthesis
`)

  // User selects direction:
  // - 继续深入: Deepen analysis in current direction
  // - 调整方向: Change focus area
  // - 有具体问题: Capture specific questions
  // - 分析完成: Exit discussion loop

  roundNumber++
}
```

#### Step 3.2: Deepen Analysis

**CLI Call** (synchronous):
```bash
ccw cli -p "
PURPOSE: Deepen analysis on '${topic}' - more detailed investigation
Success: Comprehensive understanding with actionable insights

PRIOR FINDINGS:
${priorFindings.join('\n')}

DEEPEN ON:
${focusAreas.map(a => `- ${a}: ${details}`).join('\n')}

TASK:
• Elaborate on prior findings
• Investigate edge cases or special scenarios
• Identify patterns not yet discussed
• Suggest implementation or improvement approaches
• Rate risk/impact for each finding (1-5)

MODE: analysis

CONTEXT: @**/*

EXPECTED:
- Detailed breakdown of prior findings
- Risk/impact assessment
- Specific improvement suggestions
- Code examples or patterns where applicable
" --tool gemini --mode analysis
```

#### Step 3.3: Adjust Direction

**CLI Call** (synchronous):
```bash
ccw cli -p "
PURPOSE: Analyze '${topic}' from different perspective: ${newFocus}
Success: Fresh insights from new angle

PRIOR ANALYSIS:
${priorAnalysis}

NEW FOCUS:
Shift emphasis to: ${newFocus}

TASK:
• Analyze topic from new perspective
• Identify what was missed in prior analysis
• Generate insights specific to new focus
• Cross-reference with prior findings
• Suggest next investigation steps

MODE: analysis

CONTEXT: @**/*

EXPECTED:
- New perspective insights
- Gaps in prior analysis
- Integrated view (prior + new)
" --tool gemini --mode analysis
```

#### Step 3.4: Answer Specific Questions

**CLI Call** (synchronous):
```bash
ccw cli -p "
PURPOSE: Answer specific questions about '${topic}'
Success: Clear, evidence-based answers

QUESTIONS FROM USER:
${userQuestions.map((q, i) => `${i+1}. ${q}`).join('\n')}

PRIOR CONTEXT:
${priorAnalysis}

TASK:
• Answer each question directly
• Provide evidence or examples
• Clarify any ambiguous points
• Suggest related investigation

MODE: analysis

CONTEXT: @**/*

EXPECTED:
- Direct answer to each question
- Supporting evidence
- Confidence level for each answer
" --tool gemini --mode analysis
```

#### Step 3.5: Document Each Round

Append to discussion.md:

```markdown
### Round ${n} - ${action} (${timestamp})

#### User Direction
- **Action**: ${action}
- **Focus**: ${focus || 'Same as prior'}

#### Analysis Results

**Key Findings**:
${newFindings.map(f => `- ${f}`).join('\n')}

**Insights**:
${insights.map(i => `- 💡 ${i}`).join('\n')}

**Next Steps**:
${nextSteps.map(s => `${s.priority} - ${s.action}`).join('\n')}

#### Corrected Assumptions
${corrections.map(c => `- ~~${c.before}~~ → ${c.after}`).join('\n')}
```

---

### Phase 4: Synthesis & Conclusion

#### Step 4.1: Final Synthesis

```javascript
const conclusions = {
  session_id: sessionId,
  topic: "$TOPIC",
  completed: getUtc8ISOString(),
  total_rounds: roundNumber,

  summary: executiveSummary,

  key_conclusions: [
    { point: '...', evidence: '...', confidence: 'high|medium|low' }
  ],

  recommendations: [
    { action: '...', rationale: '...', priority: 'high|medium|low' }
  ],

  open_questions: remainingQuestions,

  follow_up_suggestions: [
    { type: 'issue|task|research', summary: '...' }
  ]
}

Write(conclusionsPath, JSON.stringify(conclusions, null, 2))
```

#### Step 4.2: Final discussion.md Update

```markdown
---

## Synthesis & Conclusions (${timestamp})

### Executive Summary
${summary}

### Key Conclusions

${keyConclusions.map((c, i) => `
${i+1}. **${c.point}** (Confidence: ${c.confidence})
   Evidence: ${c.evidence}
`).join('\n')}

### Recommendations

${recommendations.map((r, i) => `
${i+1}. **[${r.priority}]** ${r.action}
   Rationale: ${r.rationale}
`).join('\n')}

### Remaining Open Questions

${openQuestions.map((q, i) => `${i+1}. ${q}`).join('\n')}

---

## Current Understanding (Final)

### What We Established
${established.map(p => `- ✅ ${p}`).join('\n')}

### What Was Clarified
${clarified.map(c => `- ~~${c.before}~~ → ${c.after}`).join('\n')}

### Key Insights
${insights.map(i => `- 💡 ${i}`).join('\n')}

---

## Session Statistics

- **Total Rounds**: ${totalRounds}
- **Key Findings**: ${keyFindings.length}
- **Dimensions Analyzed**: ${dimensions.join(', ')}
- **Artifacts**: discussion.md, exploration-codebase.json, explorations.json, conclusions.json
```

#### Step 4.3: Post-Completion Options

Offer follow-up options:
- Create Issue (for findings)
- Generate Task (for improvements)
- Export Report
- Complete

---

## Configuration

### Analysis Dimensions

| Dimension | Keywords |
|-----------|----------|
| architecture | 架构, architecture, design, structure, 设计 |
| implementation | 实现, implement, code, coding, 代码 |
| performance | 性能, performance, optimize, bottleneck, 优化 |
| security | 安全, security, auth, permission, 权限 |
| concept | 概念, concept, theory, principle, 原理 |
| comparison | 比较, compare, vs, difference, 区别 |
| decision | 决策, decision, choice, tradeoff, 选择 |

### Depth Settings

| Depth | Time | Scope | Questions |
|-------|------|-------|-----------|
| Quick (10-15min) | 1-2 | Surface level | 3-5 key |
| Standard (30-60min) | 2-4 | Moderate depth | 5-8 key |
| Deep (1-2hr) | 4+ | Comprehensive | 10+ key |

---

## Error Handling

| Situation | Action |
|-----------|--------|
| CLI timeout | Retry with shorter prompt, skip analysis |
| No relevant findings | Broaden search, adjust keywords |
| User disengaged | Summarize progress, offer break point |
| Max rounds reached | Force synthesis, highlight remaining questions |
| Session folder conflict | Append timestamp suffix |

---

## Iteration Flow

```
First Call (TOPIC="topic"):
   ├─ No session exists → New mode
   ├─ Identify dimensions
   ├─ Scope with user
   ├─ Create discussion.md
   ├─ Codebase exploration
   ├─ Gemini CLI analysis
   └─ Enter discussion loop

Continue Call (TOPIC="topic"):
   ├─ Session exists → Continue mode
   ├─ Load discussion.md
   ├─ Resume from last round
   └─ Continue discussion loop

Discussion Loop:
   ├─ Present current findings
   ├─ Gather user feedback
   ├─ Process response:
   │   ├─ Deepen → Deeper analysis on same topic
   │   ├─ Adjust → Shift analysis focus
   │   ├─ Questions → Answer specific questions
   │   └─ Complete → Exit loop for synthesis
   ├─ Update discussion.md
   └─ Repeat until complete or max rounds

Completion:
   ├─ Generate conclusions.json
   ├─ Update discussion.md with final synthesis
   └─ Offer follow-up options
```

---

**Now execute the analysis-with-file workflow for topic**: $TOPIC
