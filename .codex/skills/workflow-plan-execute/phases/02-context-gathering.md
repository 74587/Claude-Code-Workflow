# Phase 2: Context Gathering & Conflict Resolution

Intelligently collect project context using context-search-agent based on task description, packages into standardized JSON. When conflicts are detected, resolve them inline before packaging.

## Objective

- Check for existing valid context-package before executing
- Assess task complexity and launch parallel exploration agents (with conflict detection)
- Detect and resolve conflicts inline (conditional, when conflict indicators found)
- Invoke context-search-agent to analyze codebase
- Generate standardized `context-package.json` with prioritized context

## Core Philosophy

- **Agent Delegation**: Delegate all discovery to `context-search-agent` for autonomous execution
- **Detection-First**: Check for existing context-package before executing
- **Conflict-Aware Exploration**: Explore agents detect conflict indicators during exploration
- **Inline Resolution**: Conflicts resolved as sub-step within this phase, not a separate phase
- **Conditional Trigger**: Conflict resolution only executes when exploration results contain conflict indicators
- **Plan Mode**: Full comprehensive analysis (vs lightweight brainstorm mode)
- **Standardized Output**: Generate `{projectRoot}/.workflow/active/{session}/.process/context-package.json`
- **Explicit Lifecycle**: Manage subagent creation, waiting, and cleanup

## Execution Process

```
Input Parsing:
   ├─ Parse flags: --session
   └─ Parse: task_description (required)

Step 1: Context-Package Detection
   └─ Decision (existing package):
      ├─ Valid package exists → Return existing (skip execution)
      └─ No valid package → Continue to Step 2

Step 2: Complexity Assessment & Parallel Explore (conflict-aware)
   ├─ Analyze task_description → classify Low/Medium/High
   ├─ Select exploration angles (1-4 based on complexity)
   ├─ Launch N cli-explore-agents in parallel (spawn_agent)
   │  └─ Each outputs: exploration-{angle}.json (includes conflict_indicators)
   ├─ Wait for all agents (batch wait)
   ├─ Close all agents
   └─ Generate explorations-manifest.json

Step 3: Inline Conflict Resolution (conditional)
   ├─ 3.1 Aggregate conflict_indicators from all explorations
   ├─ 3.2 Decision: No significant conflicts → Skip to Step 4
   ├─ 3.3 Spawn conflict-analysis agent (cli-execution-agent)
   │  └─ Gemini/Qwen CLI analysis → conflict strategies
   ├─ 3.4 Iterative user clarification (send_input loop, max 10 rounds)
   │  ├─ Display conflict + strategy ONE BY ONE
   │  ├─ ASK_USER for user selection
   │  └─ send_input → agent re-analysis → confirm uniqueness
   ├─ 3.5 Generate conflict-resolution.json
   └─ 3.6 Close conflict agent

Step 4: Invoke Context-Search Agent (enhanced)
   ├─ Receives exploration results + resolved conflicts (if any)
   └─ Generates context-package.json with exploration_results + conflict status

Step 5: Output Verification (enhanced)
   └─ Verify context-package.json contains exploration_results + conflict resolution
```

## Execution Flow

### Step 1: Context-Package Detection

**Execute First** - Check if valid package already exists:

```javascript
const contextPackagePath = `${projectRoot}/.workflow/active/${session_id}/.process/context-package.json`;

if (file_exists(contextPackagePath)) {
  const existing = Read(contextPackagePath);

  // Validate package belongs to current session
  if (existing?.metadata?.session_id === session_id) {
    console.log("Valid context-package found for session:", session_id);
    console.log("Stats:", existing.statistics);
    console.log("Conflict Risk:", existing.conflict_detection.risk_level);
    return existing; // Skip execution, return existing
  } else {
    console.warn("Invalid session_id in existing package, re-generating...");
  }
}
```

### Step 2: Complexity Assessment & Parallel Explore

**Only execute if Step 1 finds no valid package**

```javascript
// 2.1 Complexity Assessment
function analyzeTaskComplexity(taskDescription) {
  const text = taskDescription.toLowerCase();
  if (/architect|refactor|restructure|modular|cross-module/.test(text)) return 'High';
  if (/multiple|several|integrate|migrate|extend/.test(text)) return 'Medium';
  return 'Low';
}

const ANGLE_PRESETS = {
  architecture: ['architecture', 'dependencies', 'modularity', 'integration-points'],
  security: ['security', 'auth-patterns', 'dataflow', 'validation'],
  performance: ['performance', 'bottlenecks', 'caching', 'data-access'],
  bugfix: ['error-handling', 'dataflow', 'state-management', 'edge-cases'],
  feature: ['patterns', 'integration-points', 'testing', 'dependencies'],
  refactor: ['architecture', 'patterns', 'dependencies', 'testing']
};

function selectAngles(taskDescription, complexity) {
  const text = taskDescription.toLowerCase();
  let preset = 'feature';
  if (/refactor|architect|restructure/.test(text)) preset = 'architecture';
  else if (/security|auth|permission/.test(text)) preset = 'security';
  else if (/performance|slow|optimi/.test(text)) preset = 'performance';
  else if (/fix|bug|error|issue/.test(text)) preset = 'bugfix';

  const count = complexity === 'High' ? 4 : (complexity === 'Medium' ? 3 : 1);
  return ANGLE_PRESETS[preset].slice(0, count);
}

const complexity = analyzeTaskComplexity(task_description);
const selectedAngles = selectAngles(task_description, complexity);
const sessionFolder = `${projectRoot}/.workflow/active/${session_id}/.process`;

// 2.2 Launch Parallel Explore Agents (with conflict detection)
const explorationAgents = [];

// Load source_refs from prep-package for supplementary context
const prepPath = `${projectRoot}/.workflow/.prep/plan-prep-package.json`
const prepSourceRefs = fs.existsSync(prepPath)
  ? (JSON.parse(Read(prepPath))?.task?.source_refs || []).filter(r => r.status === 'verified')
  : []
const sourceRefsDirective = prepSourceRefs.length > 0
  ? `\n## SUPPLEMENTARY REQUIREMENT DOCUMENTS (from prep)\nRead these before exploration:\n${prepSourceRefs.map((r, i) => `${i + 1}. Read: ${r.path} (${r.type})`).join('\n')}\nCross-reference findings against these source documents.\n`
  : ''

// Spawn all agents in parallel
selectedAngles.forEach((angle, index) => {
  const agentId = spawn_agent({
    message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/cli-explore-agent.md (MUST read first)
2. Read: ${projectRoot}/.workflow/project-tech.json
3. Read: ${projectRoot}/.workflow/project-guidelines.json

---

## Task Objective
Execute **${angle}** exploration for task planning context. Analyze codebase from this specific angle to discover relevant structure, patterns, and constraints.

**CONFLICT DETECTION**: Additionally detect conflict indicators including module overlaps, breaking changes, incompatible patterns, and scenario boundary ambiguities.
${sourceRefsDirective}

## Assigned Context
- **Exploration Angle**: ${angle}
- **Task Description**: ${task_description}
- **Session ID**: ${session_id}
- **Exploration Index**: ${index + 1} of ${selectedAngles.length}
- **Output File**: ${sessionFolder}/exploration-${angle}.json

## MANDATORY FIRST STEPS (Execute by Agent)
**You (cli-explore-agent) MUST execute these steps in order:**
1. Run: ccw tool exec get_modules_by_depth '{}' (project structure)
2. Run: rg -l "{keyword_from_task}" --type ts (locate relevant files)
3. Execute: cat ~/.ccw/workflows/cli-templates/schemas/explore-json-schema.json (get output schema reference)

## Exploration Strategy (${angle} focus)

**Step 1: Structural Scan** (Bash)
- get_modules_by_depth.sh → identify modules related to ${angle}
- find/rg → locate files relevant to ${angle} aspect
- Analyze imports/dependencies from ${angle} perspective

**Step 2: Semantic Analysis** (Gemini CLI)
- How does existing code handle ${angle} concerns?
- What patterns are used for ${angle}?
- Where would new code integrate from ${angle} viewpoint?
- **Detect conflict indicators**: module overlaps, breaking changes, incompatible patterns

**Step 3: Write Output**
- Consolidate ${angle} findings into JSON
- Identify ${angle}-specific clarification needs
- **Include conflict_indicators array** with detected conflicts

## Expected Output

**File**: ${sessionFolder}/exploration-${angle}.json

**Schema Reference**: Schema obtained in MANDATORY FIRST STEPS step 3, follow schema exactly

**Required Fields** (all ${angle} focused):
- project_structure: Modules/architecture relevant to ${angle}
- relevant_files: Files affected from ${angle} perspective
  **MANDATORY**: Every file MUST use structured object format with ALL required fields:
  \`[{path: "src/file.ts", relevance: 0.85, rationale: "Contains AuthService.login() - entry point for JWT token generation", role: "modify_target", discovery_source: "bash-scan", key_symbols: ["AuthService", "login"]}]\`
  - **rationale** (required): Specific selection basis tied to ${angle} topic (>10 chars, not generic)
  - **role** (required): modify_target|dependency|pattern_reference|test_target|type_definition|integration_point|config|context_only
  - **discovery_source** (recommended): bash-scan|cli-analysis|ace-search|dependency-trace|manual
  - **key_symbols** (recommended): Key functions/classes/types in the file relevant to the task
  - Scores: 0.7+ high priority, 0.5-0.7 medium, <0.5 low
- patterns: ${angle}-related patterns to follow
- dependencies: Dependencies relevant to ${angle}
- integration_points: Where to integrate from ${angle} viewpoint (include file:line locations)
- constraints: ${angle}-specific limitations/conventions
- clarification_needs: ${angle}-related ambiguities (options array + recommended index)
- **conflict_indicators**: Array of detected conflicts from ${angle} perspective
  \`[{type: "ModuleOverlap|BreakingChange|PatternConflict", severity: "high|medium|low", description: "...", affected_files: [...]}]\`
- _metadata.exploration_angle: "${angle}"

## Success Criteria
- [ ] Schema obtained via cat explore-json-schema.json
- [ ] get_modules_by_depth.sh executed
- [ ] At least 3 relevant files identified with specific rationale + role
- [ ] Every file has rationale >10 chars (not generic like "Related to ${angle}")
- [ ] Every file has role classification (modify_target/dependency/etc.)
- [ ] Patterns are actionable (code examples, not generic advice)
- [ ] Integration points include file:line locations
- [ ] Constraints are project-specific to ${angle}
- [ ] conflict_indicators populated (empty array if none detected)
- [ ] JSON output follows schema exactly
- [ ] clarification_needs includes options + recommended

## Output
Write: ${sessionFolder}/exploration-${angle}.json
Return: 2-3 sentence summary of ${angle} findings + conflict indicators count
`
  });

  explorationAgents.push(agentId);
});

// 2.3 Batch wait for all exploration agents
const explorationResults = wait({
  ids: explorationAgents,
  timeout_ms: 600000  // 10 minutes
});

// Check for timeouts
if (explorationResults.timed_out) {
  console.log('Some exploration agents timed out - continuing with completed results');
}

// 2.4 Close all exploration agents
explorationAgents.forEach(agentId => {
  close_agent({ id: agentId });
});

// 2.5 Generate Manifest after all complete
const explorationFiles = bash(`find ${sessionFolder} -name "exploration-*.json" -type f`).split('\n').filter(f => f.trim());
const explorationManifest = {
  session_id,
  task_description,
  timestamp: new Date().toISOString(),
  complexity,
  exploration_count: selectedAngles.length,
  angles_explored: selectedAngles,
  explorations: explorationFiles.map(file => {
    const data = JSON.parse(Read(file));
    return { angle: data._metadata.exploration_angle, file: file.split('/').pop(), path: file, index: data._metadata.exploration_index };
  })
};
Write(`${sessionFolder}/explorations-manifest.json`, JSON.stringify(explorationManifest, null, 2));
```

### Step 3: Inline Conflict Resolution

**Conditional execution** - Only runs when exploration results contain significant conflict indicators.

#### 3.1 Aggregate Conflict Indicators

```javascript
// Aggregate conflict_indicators from all explorations
const allConflictIndicators = [];
explorationFiles.forEach(file => {
  const data = JSON.parse(Read(file));
  if (data.conflict_indicators?.length > 0) {
    allConflictIndicators.push(...data.conflict_indicators.map(ci => ({
      ...ci,
      source_angle: data._metadata.exploration_angle
    })));
  }
});

const hasSignificantConflicts = allConflictIndicators.some(ci => ci.severity === 'high') ||
  allConflictIndicators.filter(ci => ci.severity === 'medium').length >= 2;
```

#### 3.2 Decision Gate

```javascript
if (!hasSignificantConflicts) {
  console.log(`No significant conflicts detected (${allConflictIndicators.length} low indicators). Skipping conflict resolution.`);
  // Skip to Step 4
} else {
  console.log(`Significant conflicts detected: ${allConflictIndicators.length} indicators. Launching conflict analysis...`);
  // Continue to 3.3
}
```

#### 3.3 Spawn Conflict-Analysis Agent

```javascript
const conflictAgentId = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/cli-execution-agent.md (MUST read first)
2. Read: ${projectRoot}/.workflow/project-tech.json
3. Read: ${projectRoot}/.workflow/project-guidelines.json

---

## Context
- Session: ${session_id}
- Conflict Indicators: ${JSON.stringify(allConflictIndicators)}
- Files: ${existing_files_list}

## Exploration Context (from exploration results)
- Exploration Count: ${explorationManifest.exploration_count}
- Angles Analyzed: ${JSON.stringify(explorationManifest.angles_explored)}
- Pre-identified Conflict Indicators: ${JSON.stringify(allConflictIndicators)}
- Critical Files: ${JSON.stringify(explorationFiles.flatMap(f => JSON.parse(Read(f)).relevant_files?.filter(rf => rf.relevance >= 0.7).map(rf => rf.path) || []))}

## Analysis Steps

### 0. Load Output Schema (MANDATORY)
Execute: cat ~/.ccw/workflows/cli-templates/schemas/conflict-resolution-schema.json

### 1. Load Context
- Read existing files from conflict indicators
- Load exploration results and use aggregated insights for enhanced analysis

### 2. Execute CLI Analysis (Enhanced with Exploration + Scenario Uniqueness)

Primary (Gemini):
ccw cli -p "
PURPOSE: Detect conflicts between plan and codebase, using exploration insights
TASK:
• **Review pre-identified conflict_indicators from exploration results**
• Compare architectures (use exploration key_patterns)
• Identify breaking API changes
• Detect data model incompatibilities
• Assess dependency conflicts
• **Analyze module scenario uniqueness**
  - Cross-validate with exploration critical_files
  - Generate clarification questions for boundary definition
MODE: analysis
CONTEXT: @**/*.ts @**/*.js @**/*.tsx @**/*.jsx @${projectRoot}/.workflow/active/${session_id}/**/*
EXPECTED: Conflict list with severity ratings, including:
  - Validation of exploration conflict_indicators
  - ModuleOverlap conflicts with overlap_analysis
  - Targeted clarification questions
CONSTRAINTS: Focus on breaking changes, migration needs, and functional overlaps | Prioritize exploration-identified conflicts | analysis=READ-ONLY
" --tool gemini --mode analysis --rule analysis-code-patterns --cd ${project_root}

Fallback: Qwen (same prompt) → Claude (manual analysis)

### 3. Generate Strategies (2-4 per conflict)

Template per conflict:
- Severity: Critical/High/Medium
- Category: Architecture/API/Data/Dependency/ModuleOverlap
- Affected files + impact
- **For ModuleOverlap**: Include overlap_analysis with existing modules and scenarios
- Options with pros/cons, effort, risk
- **For ModuleOverlap strategies**: Add clarification_needed questions for boundary definition
- Recommended strategy + rationale

### 4. Return Structured Conflict Data

**Schema Reference**: Execute \`cat ~/.ccw/workflows/cli-templates/schemas/conflict-resolution-schema.json\` to get full schema

Return JSON following the schema above. Key requirements:
- Minimum 2 strategies per conflict, max 4
- All text in Chinese for user-facing fields (brief, name, pros, cons, modification_suggestions)
- modifications.old_content: 20-100 chars for unique Edit tool matching
- modifications.new_content: preserves markdown formatting
- modification_suggestions: 2-5 actionable suggestions for custom handling

### 5. Planning Notes Record (REQUIRED)
After analysis complete, append a brief execution record to planning-notes.md:

**File**: ${projectRoot}/.workflow/active/${session_id}/planning-notes.md
**Location**: Under "## Conflict Decisions (Phase 2)" section
**Format**:
\`\`\`
### [Conflict-Resolution Agent] YYYY-MM-DD
- **Note**: [brief summary of conflict types, resolution strategies, key decisions]
\`\`\`
`
});

// Wait for initial analysis
const analysisResult = wait({
  ids: [conflictAgentId],
  timeout_ms: 600000  // 10 minutes
});

// Parse conflicts from result
const conflicts = parseConflictsFromResult(analysisResult);
```

#### Conflict Categories

| Category | Description |
|----------|-------------|
| **Architecture** | Incompatible design patterns, module structure changes, pattern migration |
| **API** | Breaking contract changes, signature modifications, public interface impacts |
| **Data Model** | Schema modifications, type breaking changes, data migration needs |
| **Dependency** | Version incompatibilities, setup conflicts, breaking updates |
| **ModuleOverlap** | Functional overlap, scenario boundary ambiguity, duplicate responsibility |

#### 3.4 Iterative User Clarification

```javascript
const autoYes = $ARGUMENTS.includes('--yes') || $ARGUMENTS.includes('-y')
const resolvedConflicts = [];
const customConflicts = [];

FOR each conflict:
  round = 0, clarified = false, userClarifications = []

  WHILE (!clarified && round++ < 10):
    // 1. Display conflict info (text output for context)
    displayConflictSummary(conflict)  // id, brief, severity, overlap_analysis if ModuleOverlap

    // 2. Strategy selection
    if (autoYes) {
      console.log(`[--yes] Auto-selecting recommended strategy`)
      selectedStrategy = conflict.strategies[conflict.recommended || 0]
      clarified = true  // Skip clarification loop
    } else {
      ASK_USER([{
        id: `conflict-${conflict.id}-strategy`,
        type: "select",
        prompt: formatStrategiesForDisplay(conflict.strategies),
        options: [
          ...conflict.strategies.map((s, i) => ({
            label: `${s.name}${i === conflict.recommended ? ' (推荐)' : ''}`,
            description: `${s.complexity}复杂度 | ${s.risk}风险${s.clarification_needed?.length ? ' | 需澄清' : ''}`
          })),
          { label: "自定义修改", description: `建议: ${conflict.modification_suggestions?.slice(0,2).join('; ')}` }
        ]
      }])  // BLOCKS (wait for user response)

      // 3. Handle selection
      if (userChoice === "自定义修改") {
        customConflicts.push({ id, brief, category, suggestions, overlap_analysis })
        break
      }

      selectedStrategy = findStrategyByName(userChoice)
    }

    // 4. Clarification (if needed) - using send_input for agent re-analysis
    if (!autoYes && selectedStrategy.clarification_needed?.length > 0) {
      for (batch of chunk(selectedStrategy.clarification_needed, 4)) {
        ASK_USER(batch.map((q, i) => ({
          id: `clarify-${conflict.id}-${i+1}`,
          type: "select",
          prompt: q,
          options: [{ label: "详细说明", description: "提供答案" }]
        })))  // BLOCKS (wait for user response)
        userClarifications.push(...collectAnswers(batch))
      }

      // 5. Agent re-analysis via send_input (key: agent stays active)
      send_input({
        id: conflictAgentId,
        message: `
## CLARIFICATION ANSWERS
Conflict: ${conflict.id}
Strategy: ${selectedStrategy.name}
User Clarifications: ${JSON.stringify(userClarifications)}

## REQUEST
Based on the clarifications above, update the strategy assessment.
Output: { uniqueness_confirmed: boolean, rationale: string, updated_strategy: {...}, remaining_questions: [...] }
`
      });

      // Wait for re-analysis result
      const reanalysisResult = wait({
        ids: [conflictAgentId],
        timeout_ms: 300000  // 5 minutes
      });

      const parsedResult = parseReanalysisResult(reanalysisResult);

      if (parsedResult.uniqueness_confirmed) {
        selectedStrategy = { ...parsedResult.updated_strategy, clarifications: userClarifications }
        clarified = true
      } else {
        selectedStrategy.clarification_needed = parsedResult.remaining_questions
      }
    } else {
      clarified = true
    }

    if (clarified) resolvedConflicts.push({ conflict, strategy: selectedStrategy })
  END WHILE
END FOR

selectedStrategies = resolvedConflicts.map(r => ({
  conflict_id: r.conflict.id, strategy: r.strategy, clarifications: r.strategy.clarifications || []
}))
```

**Key Points**:
- ASK_USER: max 4 questions/call, batch if more
- Strategy options: 2-4 strategies + "自定义修改"
- Clarification loop via send_input: max 10 rounds, agent determines uniqueness_confirmed
- Agent stays active throughout interaction (no close_agent until Step 3.6)
- Custom conflicts: record overlap_analysis for subsequent manual handling

#### 3.5 Generate conflict-resolution.json

```javascript
// Apply modifications from resolved strategies
const modifications = [];
selectedStrategies.forEach(item => {
  if (item.strategy && item.strategy.modifications) {
    modifications.push(...item.strategy.modifications.map(mod => ({
      ...mod,
      conflict_id: item.conflict_id,
      clarifications: item.clarifications
    })));
  }
});

console.log(`\nApplying ${modifications.length} modifications...`);

const appliedModifications = [];
const failedModifications = [];
const fallbackConstraints = [];

modifications.forEach((mod, idx) => {
  try {
    console.log(`[${idx + 1}/${modifications.length}] Modifying ${mod.file}...`);

    if (!file_exists(mod.file)) {
      console.log(`  File not found, recording as constraint`);
      fallbackConstraints.push({
        source: "conflict-resolution",
        conflict_id: mod.conflict_id,
        target_file: mod.file,
        section: mod.section,
        change_type: mod.change_type,
        content: mod.new_content,
        rationale: mod.rationale
      });
      return;
    }

    if (mod.change_type === "update") {
      Edit({ file_path: mod.file, old_string: mod.old_content, new_string: mod.new_content });
    } else if (mod.change_type === "add") {
      const fileContent = Read(mod.file);
      const updated = insertContentAfterSection(fileContent, mod.section, mod.new_content);
      Write(mod.file, updated);
    } else if (mod.change_type === "remove") {
      Edit({ file_path: mod.file, old_string: mod.old_content, new_string: "" });
    }

    appliedModifications.push(mod);
  } catch (error) {
    failedModifications.push({ ...mod, error: error.message });
  }
});

// Generate conflict-resolution.json
const resolutionOutput = {
  session_id: session_id,
  resolved_at: new Date().toISOString(),
  summary: {
    total_conflicts: conflicts.length,
    resolved_with_strategy: selectedStrategies.length,
    custom_handling: customConflicts.length,
    fallback_constraints: fallbackConstraints.length
  },
  resolved_conflicts: selectedStrategies.map(s => ({
    conflict_id: s.conflict_id,
    strategy_name: s.strategy.name,
    strategy_approach: s.strategy.approach,
    clarifications: s.clarifications || [],
    modifications_applied: s.strategy.modifications?.filter(m =>
      appliedModifications.some(am => am.conflict_id === s.conflict_id)
    ) || []
  })),
  custom_conflicts: customConflicts.map(c => ({
    id: c.id, brief: c.brief, category: c.category,
    suggestions: c.suggestions, overlap_analysis: c.overlap_analysis || null
  })),
  planning_constraints: fallbackConstraints,
  failed_modifications: failedModifications
};

const resolutionPath = `${projectRoot}/.workflow/active/${session_id}/.process/conflict-resolution.json`;
Write(resolutionPath, JSON.stringify(resolutionOutput, null, 2));

// Output custom conflict summary (if any)
if (customConflicts.length > 0) {
  customConflicts.forEach(conflict => {
    console.log(`[${conflict.category}] ${conflict.id}: ${conflict.brief}`);
    if (conflict.category === 'ModuleOverlap' && conflict.overlap_analysis) {
      console.log(`  New module: ${conflict.overlap_analysis.new_module.name}`);
      conflict.overlap_analysis.existing_modules.forEach(mod => {
        console.log(`    Overlaps: ${mod.name} (${mod.file})`);
      });
    }
    conflict.suggestions.forEach(s => console.log(`  - ${s}`));
  });
}
```

#### 3.6 Close Conflict Agent

```javascript
close_agent({ id: conflictAgentId });
```

### Step 4: Invoke Context-Search Agent

**Execute after Step 2 (and Step 3 if triggered)**

```javascript
// Load user intent from planning-notes.md (from Phase 1)
const planningNotesPath = `${projectRoot}/.workflow/active/${session_id}/planning-notes.md`;
let userIntent = { goal: task_description, key_constraints: "None specified" };

if (file_exists(planningNotesPath)) {
  const notesContent = Read(planningNotesPath);
  const goalMatch = notesContent.match(/\*\*GOAL\*\*:\s*(.+)/);
  const constraintsMatch = notesContent.match(/\*\*KEY_CONSTRAINTS\*\*:\s*(.+)/);
  if (goalMatch) userIntent.goal = goalMatch[1].trim();
  if (constraintsMatch) userIntent.key_constraints = constraintsMatch[1].trim();
}

// Prepare conflict resolution context for agent
const conflictContext = hasSignificantConflicts
  ? `Conflict Resolution: ${resolutionPath} (${selectedStrategies.length} resolved, ${customConflicts.length} custom)`
  : `Conflict Resolution: None needed (no significant conflicts detected)`;

// Spawn context-search-agent
const contextAgentId = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/context-search-agent.md (MUST read first)
2. Read: ${projectRoot}/.workflow/project-tech.json
3. Read: ${projectRoot}/.workflow/project-guidelines.json

---

## Execution Mode
**PLAN MODE** (Comprehensive) - Full Phase 1-3 execution with priority sorting

## Session Information
- **Session ID**: ${session_id}
- **Task Description**: ${task_description}
- **Output Path**: ${projectRoot}/.workflow/active/${session_id}/.process/context-package.json

## User Intent (from Phase 1 - Planning Notes)
**GOAL**: ${userIntent.goal}
**KEY_CONSTRAINTS**: ${userIntent.key_constraints}

This is the PRIMARY context source - all subsequent analysis must align with user intent.

## Exploration Input (from Step 2)
- **Manifest**: ${sessionFolder}/explorations-manifest.json
- **Exploration Count**: ${explorationManifest.exploration_count}
- **Angles**: ${explorationManifest.angles_explored.join(', ')}
- **Complexity**: ${complexity}

## Conflict Resolution Input (from Step 3)
- **${conflictContext}**
${hasSignificantConflicts ? `- **Resolution File**: ${resolutionPath}
- **Resolved Conflicts**: ${selectedStrategies.length}
- **Custom Conflicts**: ${customConflicts.length}
- **Planning Constraints**: ${fallbackConstraints.length}` : ''}

## Mission
Execute complete context-search-agent workflow for implementation planning:

### Phase 1: Initialization & Pre-Analysis
1. **Project State Loading**:
   - Read and parse \`${projectRoot}/.workflow/project-tech.json\`. Use its \`overview\` section as the foundational \`project_context\`. This is your primary source for architecture, tech stack, and key components.
   - Read and parse \`${projectRoot}/.workflow/project-guidelines.json\`. Load \`conventions\`, \`constraints\`, and \`learnings\` into a \`project_guidelines\` section.
   - If files don't exist, proceed with fresh analysis.
2. **Detection**: Check for existing context-package (early exit if valid)
3. **Foundation**: Initialize CodexLens, get project structure, load docs
4. **Analysis**: Extract keywords, determine scope, classify complexity based on task description and project state

### Phase 2: Multi-Source Context Discovery
Execute all discovery tracks (WITH USER INTENT INTEGRATION):
- **Track -1**: User Intent & Priority Foundation (EXECUTE FIRST)
  - Load user intent (GOAL, KEY_CONSTRAINTS) from session input
  - Map user requirements to codebase entities (files, modules, patterns)
  - Establish baseline priority scores based on user goal alignment
  - Output: user_intent_mapping.json with preliminary priority scores

- **Track 0**: Exploration Synthesis (load ${sessionFolder}/explorations-manifest.json, prioritize critical_files, deduplicate patterns/integration_points)
- **Track 1**: Historical archive analysis (query manifest.json for lessons learned)
- **Track 2**: Reference documentation (CLAUDE.md, architecture docs)
- **Track 3**: Web examples (use Exa MCP for unfamiliar tech/APIs)
- **Track 4**: Codebase analysis (5-layer discovery: files, content, patterns, deps, config/tests)

### Phase 3: Synthesis, Assessment & Packaging
1. Apply relevance scoring and build dependency graph
2. **Synthesize 5-source data** (including Track -1): Merge findings from all sources
   - Priority order: User Intent > Archive > Docs > Exploration > Code > Web
   - **Prioritize the context from \`project-tech.json\`** for architecture and tech stack unless code analysis reveals it's outdated
3. **Context Priority Sorting**:
   a. Combine scores from Track -1 (user intent alignment) + relevance scores + exploration critical_files
   b. Classify files into priority tiers:
      - **Critical** (score >= 0.85): Directly mentioned in user goal OR exploration critical_files
      - **High** (0.70-0.84): Key dependencies, patterns required for goal
      - **Medium** (0.50-0.69): Supporting files, indirect dependencies
      - **Low** (< 0.50): Contextual awareness only
   c. Generate dependency_order: Based on dependency graph + user goal sequence
   d. Document sorting_rationale: Explain prioritization logic

4. **Populate \`project_context\`**: Directly use the \`overview\` from \`project-tech.json\` to fill the \`project_context\` section. Include description, technology_stack, architecture, and key_components.
5. **Populate \`project_guidelines\`**: Load conventions, constraints, and learnings from \`project-guidelines.json\` into a dedicated section.
6. Integrate brainstorm artifacts (if .brainstorming/ exists, read content)
7. Perform conflict detection with risk assessment
8. **Inject conflict resolution results** (if conflict-resolution.json exists) into conflict_detection
9. **Generate prioritized_context section**:
   \`\`\`json
   {
     "prioritized_context": {
       "user_intent": {
         "goal": "...",
         "scope": "...",
         "key_constraints": ["..."]
       },
       "priority_tiers": {
         "critical": [{ "path": "...", "relevance": 0.95, "rationale": "..." }],
         "high": [...],
         "medium": [...],
         "low": [...]
       },
       "dependency_order": ["module1", "module2", "module3"],
       "sorting_rationale": "Based on user goal alignment (Track -1), exploration critical files, and dependency graph analysis"
     }
   }
   \`\`\`
10. Generate and validate context-package.json with prioritized_context field

## Output Requirements
Complete context-package.json with:
- **metadata**: task_description, keywords, complexity, tech_stack, session_id
- **project_context**: description, technology_stack, architecture, key_components (sourced from \`project-tech.json\`)
- **project_guidelines**: {conventions, constraints, quality_rules, learnings} (sourced from \`project-guidelines.json\`)
- **assets**: {documentation[], source_code[], config[], tests[]} with relevance scores
- **dependencies**: {internal[], external[]} with dependency graph
- **brainstorm_artifacts**: {guidance_specification, role_analyses[], synthesis_output} with content
- **conflict_detection**: {risk_level, risk_factors, affected_modules[], mitigation_strategy, historical_conflicts[], resolution_file (if exists)}
- **exploration_results**: {manifest_path, exploration_count, angles, explorations[], aggregated_insights} (from Track 0)
- **prioritized_context**: {user_intent, priority_tiers{critical, high, medium, low}, dependency_order[], sorting_rationale}

## Quality Validation
Before completion verify:
- [ ] Valid JSON format with all required fields
- [ ] File relevance accuracy >80%
- [ ] Dependency graph complete (max 2 transitive levels)
- [ ] Conflict risk level calculated correctly
- [ ] No sensitive data exposed
- [ ] Total files <=50 (prioritize high-relevance)

## Planning Notes Record (REQUIRED)
After completing context-package.json, append a brief execution record to planning-notes.md:

**File**: ${projectRoot}/.workflow/active/${session_id}/planning-notes.md
**Location**: Under "## Context Findings (Phase 2)" section
**Format**:
\`\`\`
### [Context-Search Agent] YYYY-MM-DD
- **Note**: [brief summary of key findings]
\`\`\`

Execute autonomously following agent documentation.
Report completion with statistics.
`
});

// Wait for context agent to complete
const contextResult = wait({
  ids: [contextAgentId],
  timeout_ms: 900000  // 15 minutes
});

// Close context agent
close_agent({ id: contextAgentId });
```

### Step 5: Output Verification

After agent completes, verify output:

```javascript
// Verify file was created
const outputPath = `${projectRoot}/.workflow/active/${session_id}/.process/context-package.json`;
if (!file_exists(outputPath)) {
  throw new Error("Agent failed to generate context-package.json");
}

// Verify exploration_results included
const pkg = JSON.parse(Read(outputPath));
if (pkg.exploration_results?.exploration_count > 0) {
  console.log(`Exploration results aggregated: ${pkg.exploration_results.exploration_count} angles`);
}

// Verify conflict resolution status
if (hasSignificantConflicts) {
  const resolutionFileRef = pkg.conflict_detection?.resolution_file;
  if (resolutionFileRef) {
    console.log(`Conflict resolution integrated: ${resolutionFileRef}`);
  }
}
```

## Parameter Reference

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `--session` | string | Yes | Workflow session ID (e.g., WFS-user-auth) |
| `task_description` | string | Yes | Detailed task description for context extraction |

## Auto Mode

When `--yes` or `-y`: Auto-select recommended strategy for each conflict in Step 3, skip clarification questions.

## Post-Phase Update

After context-gather completes, update planning-notes.md:

```javascript
const contextPackage = JSON.parse(Read(contextPath))
const conflictRisk = contextPackage.conflict_detection?.risk_level || 'low'
const criticalFiles = (contextPackage.exploration_results?.aggregated_insights?.critical_files || [])
  .slice(0, 5).map(f => f.path)
const archPatterns = contextPackage.project_context?.architecture_patterns || []
const constraints = contextPackage.exploration_results?.aggregated_insights?.constraints || []

// Update Phase 2 section
Edit(planningNotesPath, {
  old: '## Context Findings (Phase 2)\n(To be filled by context-gather)',
  new: `## Context Findings (Phase 2)

- **CRITICAL_FILES**: ${criticalFiles.join(', ') || 'None identified'}
- **ARCHITECTURE**: ${archPatterns.join(', ') || 'Not detected'}
- **CONFLICT_RISK**: ${conflictRisk}
- **CONSTRAINTS**: ${constraints.length > 0 ? constraints.join('; ') : 'None'}`
})

// If conflicts were resolved inline, update conflict decisions section
if (hasSignificantConflicts && file_exists(resolutionPath)) {
  const conflictRes = JSON.parse(Read(resolutionPath))
  const resolved = conflictRes.resolved_conflicts || []
  const planningConstraints = conflictRes.planning_constraints || []

  Edit(planningNotesPath, {
    old: '## Conflict Decisions (Phase 2)\n(To be filled if conflicts detected)',
    new: `## Conflict Decisions (Phase 2)

- **RESOLVED**: ${resolved.map(r => `${r.conflict_id} → ${r.strategy_name}`).join('; ') || 'None'}
- **CUSTOM_HANDLING**: ${conflictRes.custom_conflicts?.map(c => c.id).join(', ') || 'None'}
- **CONSTRAINTS**: ${planningConstraints.map(c => c.content).join('; ') || 'None'}`
  })

  // Append conflict constraints to consolidated list
  if (planningConstraints.length > 0) {
    Edit(planningNotesPath, {
      old: '## Consolidated Constraints (Phase 3 Input)',
      new: `## Consolidated Constraints (Phase 3 Input)
${planningConstraints.map((c, i) => `${constraintCount + i + 1}. [Conflict] ${c.content}`).join('\n')}`
    })
  }
}

// Append Phase 2 constraints to consolidated list
Edit(planningNotesPath, {
  old: '## Consolidated Constraints (Phase 3 Input)',
  new: `## Consolidated Constraints (Phase 3 Input)
${constraints.map((c, i) => `${i + 2}. [Context] ${c}`).join('\n')}`
})
```

## Error Handling

### Recovery Strategy
```
1. Pre-check: Verify exploration results before conflict analysis
2. Monitor: Track agents via wait with timeout
3. Validate: Parse agent JSON output
4. Recover:
   - Agent failure → check logs + report error
   - Invalid JSON → retry once with Claude fallback
   - CLI failure → fallback to Claude analysis
   - Edit tool failure → report affected files + rollback option
   - User cancels → mark as "unresolved", continue to Step 4
5. Degrade: If conflict analysis fails, skip and continue with context packaging
6. Cleanup: Always close_agent even on error path
```

### Rollback Handling
```
If Edit tool fails mid-application:
1. Log all successfully applied modifications
2. Output rollback option via text interaction
3. If rollback selected: restore files from git or backups
4. If continue: mark partial resolution in context-package.json
```

## Notes

- **Detection-first**: Always check for existing package before invoking agent
- **User intent integration**: Load user intent from planning-notes.md (Phase 1 output)
- **Conflict-aware exploration**: Explore agents detect conflict indicators during their work
- **Inline conflict resolution**: Conflicts resolved within this phase when significant indicators found
- **Output**: Generates `context-package.json` with `prioritized_context` field + optional `conflict-resolution.json`
- **Plan-specific**: Use this for implementation planning; brainstorm mode uses direct agent call
- **Explicit Lifecycle**: Always close_agent after wait to free resources
- **Batch Wait**: Use single wait call for multiple parallel agents for efficiency

## Output

- **Variable**: `contextPath` (e.g., `{projectRoot}/.workflow/active/WFS-xxx/.process/context-package.json`)
- **Variable**: `conflictRisk` (none/low/medium/high/resolved)
- **File**: Updated `planning-notes.md` with context findings + conflict decisions (if applicable)
- **File**: Optional `conflict-resolution.json` (when conflicts resolved inline)

## Next Phase

Return to orchestrator, then auto-continue to [Phase 3: Task Generation](03-task-generation.md).
