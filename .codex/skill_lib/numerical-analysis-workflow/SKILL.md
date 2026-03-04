---
name: numerical-analysis-workflow
description: Global-to-local numerical computation project analysis workflow. Decomposes analysis into 6-phase diamond topology (Global → Theory → Algorithm → Module → Local → Integration) with parallel analysis tracks per phase, cross-phase context propagation, and LaTeX formula support. Produces comprehensive analysis documents covering mathematical foundations, numerical stability, convergence, error bounds, and software architecture.
argument-hint: "[-y|--yes] [-c|--concurrency N] [--continue] \"project path or description\""
allowed-tools: spawn_agents_on_csv, Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

## Auto Mode

When `--yes` or `-y`: Auto-confirm track decomposition, skip interactive validation, use defaults.

# Numerical Analysis Workflow

## Usage

```bash
$numerical-analysis-workflow "Analyze the FEM solver in src/solver/"
$numerical-analysis-workflow -c 3 "Analyze CFD simulation pipeline for numerical stability"
$numerical-analysis-workflow -y "Full analysis of PDE discretization in src/pde/"
$numerical-analysis-workflow --continue "nadw-fem-solver-20260304"
```

**Flags**:
- `-y, --yes`: Skip all confirmations (auto mode)
- `-c, --concurrency N`: Max concurrent agents within each wave (default: 3)
- `--continue`: Resume existing session

**Output Directory**: `.workflow/.csv-wave/{session-id}/`
**Core Output**: `tasks.csv` (master state) + `results.csv` (final) + `discoveries.ndjson` (shared exploration) + `context.md` (human-readable report)

---

## Overview

Six-phase diamond topology for analyzing numerical computation software projects. Each phase represents a wave; within each wave, 2-5 parallel analysis tracks produce focused documents. Context packages propagate cumulatively between waves, enabling perspective reuse — theory informs algorithm design, algorithm informs implementation, all converge at integration.

**Core workflow**: Survey → Theorize → Design → Analyze Modules → Optimize Locally → Integrate & Validate

```
┌─────────────────────────────────────────────────────────────────────────┐
│              NUMERICAL ANALYSIS DIAMOND WORKFLOW (NADW)                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Wave 1: Global Survey                                       [3 tracks] │
│     ├─ T1.1 Problem Domain Survey (math models, governing equations)     │
│     ├─ T1.2 Software Architecture Overview (modules, data flow)          │
│     └─ T1.3 Validation Strategy (benchmarks, KPIs, acceptance)           │
│           ↓ Context Package P1                                           │
│                                                                          │
│  Wave 2: Theoretical Foundations                             [3 tracks] │
│     ├─ T2.1 Mathematical Formulation (LaTeX derivation, weak forms)      │
│     ├─ T2.2 Convergence Analysis (error bounds, convergence order)       │
│     └─ T2.3 Complexity Analysis (time/space Big-O, operation counts)     │
│           ↓ Context Package P1+P2                                        │
│                                                                          │
│  Wave 3: Algorithm Design & Stability                        [3 tracks] │
│     ├─ T3.1 Algorithm Specification (method selection, pseudocode)        │
│     ├─ T3.2 Numerical Stability Report (condition numbers, error prop)   │
│     └─ T3.3 Performance Model (FLOPS, memory bandwidth, parallelism)     │
│           ↓ Context Package P1+P2+P3                                     │
│                                                                          │
│  Wave 4: Module Implementation                               [3 tracks] │
│     ├─ T4.1 Core Module Analysis (algorithm-code mapping)                │
│     ├─ T4.2 Data Structure Review (sparse formats, memory layout)        │
│     └─ T4.3 API Contract Analysis (interfaces, error handling)           │
│           ↓ Context Package P1-P4                                        │
│                                                                          │
│  Wave 5: Local Function-Level                                [3 tracks] │
│     ├─ T5.1 Optimization Report (hotspots, vectorization, cache)         │
│     ├─ T5.2 Edge Case Analysis (singularities, overflow, degeneracy)     │
│     └─ T5.3 Precision Audit (catastrophic cancellation, accumulation)    │
│           ↓ Context Package P1-P5                                        │
│                                                                          │
│  Wave 6: Integration & QA                                    [3 tracks] │
│     ├─ T6.1 Integration Test Plan (end-to-end, regression, benchmark)    │
│     ├─ T6.2 Benchmark Results (actual vs theoretical performance)        │
│     └─ T6.3 Final QA Report (all-phase synthesis, risk matrix, roadmap)  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Diamond Topology** (Wide → Deep → Wide):
```
Wave 1:  [T1.1] [T1.2] [T1.3]          ← Global扇出
Wave 2:  [T2.1] [T2.2] [T2.3]          ← Theory深入
Wave 3:  [T3.1] [T3.2] [T3.3]          ← Algorithm桥接
Wave 4:  [T4.1] [T4.2] [T4.3]          ← Module聚焦
Wave 5:  [T5.1] [T5.2] [T5.3]          ← Local最细
Wave 6:  [T6.1] [T6.2] [T6.3]          ← Integration汇聚
```

---

## CSV Schema

### tasks.csv (Master State)

```csv
id,title,description,track_role,analysis_dimension,formula_refs,precision_req,scope,deps,context_from,wave,status,findings,severity_distribution,latex_formulas,doc_path,error
"T1.1","Problem Domain Survey","Survey governing equations and mathematical models for the numerical computation project. Identify PDE types, boundary conditions, conservation laws.","Problem_Domain_Analyst","domain_modeling","","","src/**","","","1","","","","","",""
"T2.1","Mathematical Formulation","Derive precise mathematical formulations using LaTeX. Transform governing equations into weak forms suitable for discretization.","Mathematician","formula_derivation","T1.1:governing_eqs","","src/**","T1.1","T1.1","2","","","","","",""
"T3.1","Algorithm Specification","Select numerical methods and design algorithms based on theoretical analysis. Produce pseudocode for core computational kernels.","Algorithm_Designer","method_selection","T2.1:weak_forms;T2.2:convergence_conds","double","src/solver/**","T2.1","T2.1;T2.2;T2.3","3","","","","","",""
```

**Columns**:

| Column | Phase | Description |
|--------|-------|-------------|
| `id` | Input | Unique task identifier (T{wave}.{track}) |
| `title` | Input | Short task title |
| `description` | Input | Detailed task description (self-contained for agent) |
| `track_role` | Input | Analysis role name (e.g., Mathematician, Stability_Analyst) |
| `analysis_dimension` | Input | Analysis focus area (domain_modeling, formula_derivation, stability, etc.) |
| `formula_refs` | Input | Semicolon-separated references to formulas from earlier tasks (TaskID:formula_name) |
| `precision_req` | Input | Required floating-point precision (float/double/quad/adaptive) |
| `scope` | Input | File/directory scope for analysis (glob pattern) |
| `deps` | Input | Semicolon-separated dependency task IDs |
| `context_from` | Input | Semicolon-separated task IDs whose findings this task needs |
| `wave` | Computed | Wave number (1-6, from phase assignment) |
| `status` | Output | `pending` → `completed` / `failed` / `skipped` |
| `findings` | Output | Key discoveries and conclusions (max 500 chars) |
| `severity_distribution` | Output | Issue counts: Critical/High/Medium/Low |
| `latex_formulas` | Output | Key LaTeX formulas discovered or derived (semicolon-separated) |
| `doc_path` | Output | Path to generated analysis document |
| `error` | Output | Error message if failed |

### Per-Wave CSV (Temporary)

Each wave generates a temporary `wave-{N}.csv` with extra `prev_context` column.

---

## Output Artifacts

| File | Purpose | Lifecycle |
|------|---------|-----------|
| `tasks.csv` | Master state — all tasks with status/findings | Updated after each wave |
| `wave-{N}.csv` | Per-wave input (temporary) | Created before wave, deleted after |
| `results.csv` | Final export of all task results | Created in Phase 3 |
| `discoveries.ndjson` | Shared exploration board across all agents | Append-only, carries across waves |
| `context.md` | Human-readable execution report | Created in Phase 3 |
| `docs/P{N}_*.md` | Per-track analysis documents | Created by each agent |

---

## Session Structure

```
.workflow/.csv-wave/{session-id}/
├── tasks.csv                  # Master state (updated per wave)
├── results.csv                # Final results export
├── discoveries.ndjson         # Shared discovery board (all agents)
├── context.md                 # Human-readable report
├── docs/                      # Analysis documents per track
│   ├── P1_Domain_Survey.md
│   ├── P1_Architecture_Overview.md
│   ├── P1_Validation_Strategy.md
│   ├── P2_Mathematical_Formulation.md
│   ├── P2_Convergence_Analysis.md
│   ├── P2_Complexity_Analysis.md
│   ├── P3_Algorithm_Specification.md
│   ├── P3_Numerical_Stability_Report.md
│   ├── P3_Performance_Model.md
│   ├── P4_Module_Implementation_Analysis.md
│   ├── P4_Data_Structure_Review.md
│   ├── P4_API_Contract.md
│   ├── P5_Optimization_Report.md
│   ├── P5_Edge_Case_Analysis.md
│   ├── P5_Precision_Audit.md
│   ├── P6_Integration_Test_Plan.md
│   ├── P6_Benchmark_Results.md
│   └── P6_Final_QA_Report.md
└── wave-{N}.csv               # Temporary per-wave input (cleaned up)
```

---

## Implementation

### Session Initialization

```javascript
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

// Parse flags
const AUTO_YES = $ARGUMENTS.includes('--yes') || $ARGUMENTS.includes('-y')
const continueMode = $ARGUMENTS.includes('--continue')
const concurrencyMatch = $ARGUMENTS.match(/(?:--concurrency|-c)\s+(\d+)/)
const maxConcurrency = concurrencyMatch ? parseInt(concurrencyMatch[1]) : 3

// Clean requirement text
const requirement = $ARGUMENTS
  .replace(/--yes|-y|--continue|--concurrency\s+\d+|-c\s+\d+/g, '')
  .trim()

const slug = requirement.toLowerCase()
  .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
  .substring(0, 40)
const dateStr = getUtc8ISOString().substring(0, 10).replace(/-/g, '')
const sessionId = `nadw-${slug}-${dateStr}`
const sessionFolder = `.workflow/.csv-wave/${sessionId}`

Bash(`mkdir -p ${sessionFolder}/docs`)
```

---

### Phase 1: Requirement → CSV (Decomposition)

**Objective**: Analyze the target project/requirement, decompose into 18 analysis tasks (6 waves × 3 tracks), compute wave assignments, generate tasks.csv.

**Decomposition Rules**:

| Wave | Phase Name | Track Roles | Analysis Focus |
|------|-----------|-------------|----------------|
| 1 | Global Survey | Problem_Domain_Analyst, Software_Architect, Validation_Strategist | Mathematical models, architecture, validation strategy |
| 2 | Theoretical Foundations | Mathematician, Convergence_Analyst, Complexity_Analyst | Formula derivation, convergence proofs, complexity bounds |
| 3 | Algorithm Design | Algorithm_Designer, Stability_Analyst, Performance_Modeler | Method selection, numerical stability, performance prediction |
| 4 | Module Implementation | Module_Implementer, Data_Structure_Designer, Interface_Analyst | Code-algorithm mapping, data structures, API contracts |
| 5 | Local Function-Level | Code_Optimizer, Edge_Case_Analyst, Precision_Auditor | Hotspot optimization, boundary handling, float precision |
| 6 | Integration & QA | Integration_Tester, Benchmark_Engineer, QA_Auditor | End-to-end testing, benchmarks, final quality report |

**Dependency Structure** (Diamond Topology):

| Task | deps | context_from | Rationale |
|------|------|-------------|-----------|
| T1.* | (none) | (none) | Wave 1: independent, global survey |
| T2.1 | T1.1 | T1.1 | Formalization needs governing equations |
| T2.2 | T1.1 | T1.1 | Convergence analysis needs model identification |
| T2.3 | T1.1;T1.2 | T1.1;T1.2 | Complexity needs both model and architecture |
| T3.1 | T2.1 | T2.1;T2.2;T2.3 | Algorithm design needs all theory |
| T3.2 | T2.1;T2.2 | T2.1;T2.2 | Stability needs formulas and convergence |
| T3.3 | T2.3 | T1.2;T2.3 | Performance model needs architecture + complexity |
| T4.* | T3.* | T1.*;T3.* | Module analysis needs global + algorithm context |
| T5.* | T4.* | T3.*;T4.* | Local analysis needs algorithm + module context |
| T6.* | T5.* | T1.*;T2.*;T3.*;T4.*;T5.* | Integration receives ALL context |

**Decomposition CLI Call**:

```javascript
Bash({
  command: `ccw cli -p "PURPOSE: Decompose numerical computation project analysis into 18 tasks across 6 phases.
TASK:
  • Analyze the project to identify: governing equations, numerical methods used, module structure
  • Generate 18 analysis tasks (3 per phase × 6 phases) following the NADW diamond topology
  • Each task must be self-contained with clear scope and analysis dimension
  • Assign track_role, analysis_dimension, formula_refs, precision_req, scope for each task
  • Set deps and context_from following the diamond dependency pattern
MODE: analysis
CONTEXT: @**/*
EXPECTED: JSON with tasks array. Each task: {id, title, description, track_role, analysis_dimension, formula_refs, precision_req, scope, deps[], context_from[]}
CONSTRAINTS: Exactly 6 waves, 3 tasks per wave. Wave 1=Global, Wave 2=Theory, Wave 3=Algorithm, Wave 4=Module, Wave 5=Local, Wave 6=Integration.

PROJECT TO ANALYZE: ${requirement}" --tool gemini --mode analysis --rule planning-breakdown-task-steps`,
  run_in_background: true
})
```

**Wave Computation**: Fixed 6-wave assignment per the diamond topology. Tasks within each wave are independent.

**CSV Generation**: Parse JSON response, validate 18 tasks with correct wave assignments, generate tasks.csv with proper escaping.

**User Validation**: Display task breakdown grouped by wave (skip if AUTO_YES):

```
Wave 1 (Global Survey):
  T1.1 Problem Domain Survey         → Problem_Domain_Analyst
  T1.2 Software Architecture Overview → Software_Architect
  T1.3 Validation Strategy           → Validation_Strategist

Wave 2 (Theoretical Foundations):
  T2.1 Mathematical Formulation      → Mathematician
  T2.2 Convergence Analysis          → Convergence_Analyst
  T2.3 Complexity Analysis           → Complexity_Analyst
...
```

**Success Criteria**:
- tasks.csv created with 18 tasks, 6 waves, valid schema
- No circular dependencies
- Each task has track_role and analysis_dimension
- User approved (or AUTO_YES)

---

### Phase 2: Wave Execution Engine

**Objective**: Execute analysis tasks wave-by-wave via spawn_agents_on_csv with cross-wave context propagation and cumulative context packages.

```javascript
// Read master CSV
const masterCsv = Read(`${sessionFolder}/tasks.csv`)
const tasks = parseCsv(masterCsv)
const maxWave = 6

for (let wave = 1; wave <= maxWave; wave++) {
  // 1. Filter tasks for this wave
  const waveTasks = tasks.filter(t => t.wave === wave && t.status === 'pending')

  // 2. Skip tasks whose deps failed/skipped
  for (const task of waveTasks) {
    const depIds = task.deps.split(';').filter(Boolean)
    const depStatuses = depIds.map(id => tasks.find(t => t.id === id)?.status)
    if (depStatuses.some(s => s === 'failed' || s === 'skipped')) {
      task.status = 'skipped'
      task.error = `Dependency failed: ${depIds.filter((id, i) => ['failed','skipped'].includes(depStatuses[i])).join(', ')}`
      continue
    }
  }

  const pendingTasks = waveTasks.filter(t => t.status === 'pending')
  if (pendingTasks.length === 0) continue

  // 3. Build prev_context from context_from + master CSV findings
  for (const task of pendingTasks) {
    const contextIds = task.context_from.split(';').filter(Boolean)
    const prevFindings = contextIds.map(id => {
      const src = tasks.find(t => t.id === id)
      return src?.findings ? `[${src.id} ${src.title}]: ${src.findings}` : ''
    }).filter(Boolean).join('\n\n')

    // Also include latex_formulas from context sources
    const prevFormulas = contextIds.map(id => {
      const src = tasks.find(t => t.id === id)
      return src?.latex_formulas ? `[${src.id} formulas]: ${src.latex_formulas}` : ''
    }).filter(Boolean).join('\n')

    task.prev_context = prevFindings + (prevFormulas ? '\n\n--- Referenced Formulas ---\n' + prevFormulas : '')
  }

  // 4. Write per-wave CSV
  Write(`${sessionFolder}/wave-${wave}.csv`, toCsv(pendingTasks))

  // 5. Execute wave
  spawn_agents_on_csv({
    csv_path: `${sessionFolder}/wave-${wave}.csv`,
    id_column: "id",
    instruction: buildInstructionTemplate(sessionFolder, wave),
    max_concurrency: maxConcurrency,
    max_runtime_seconds: 900,
    output_csv_path: `${sessionFolder}/wave-${wave}-results.csv`,
    output_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string", enum: ["completed", "failed"] },
        findings: { type: "string" },
        severity_distribution: { type: "string" },
        latex_formulas: { type: "string" },
        doc_path: { type: "string" },
        error: { type: "string" }
      },
      required: ["id", "status", "findings"]
    }
  })

  // 6. Merge results into master CSV
  const waveResults = parseCsv(Read(`${sessionFolder}/wave-${wave}-results.csv`))
  for (const result of waveResults) {
    const masterTask = tasks.find(t => t.id === result.id)
    if (masterTask) {
      masterTask.status = result.status
      masterTask.findings = result.findings
      masterTask.severity_distribution = result.severity_distribution || ''
      masterTask.latex_formulas = result.latex_formulas || ''
      masterTask.doc_path = result.doc_path || ''
      masterTask.error = result.error || ''
    }
  }
  Write(`${sessionFolder}/tasks.csv`, toCsv(tasks))

  // 7. Cleanup temp wave CSV
  Bash(`rm -f ${sessionFolder}/wave-${wave}.csv ${sessionFolder}/wave-${wave}-results.csv`)

  // 8. Display wave summary
  const completed = waveResults.filter(r => r.status === 'completed').length
  const failed = waveResults.filter(r => r.status === 'failed').length
  // Output: "Wave {wave}: {completed} completed, {failed} failed"
}
```

**Instruction Template** (embedded — see instructions/agent-instruction.md for standalone):

```javascript
function buildInstructionTemplate(sessionFolder, wave) {
  const phaseNames = {
    1: 'Global Survey', 2: 'Theoretical Foundations', 3: 'Algorithm Design',
    4: 'Module Implementation', 5: 'Local Function-Level', 6: 'Integration & QA'
  }
  return `## TASK ASSIGNMENT — ${phaseNames[wave]}

### MANDATORY FIRST STEPS
1. Read shared discoveries: ${sessionFolder}/discoveries.ndjson (if exists, skip if not)
2. Read project context: .workflow/project-tech.json (if exists)

---

## Your Task

**Task ID**: {id}
**Title**: {title}
**Role**: {track_role}
**Analysis Dimension**: {analysis_dimension}
**Description**: {description}
**Formula References**: {formula_refs}
**Precision Requirement**: {precision_req}
**Scope**: {scope}

### Previous Tasks' Findings (Context)
{prev_context}

---

## Execution Protocol

1. **Read discoveries**: Load ${sessionFolder}/discoveries.ndjson for shared exploration findings
2. **Use context**: Apply previous tasks' findings from prev_context above
3. **Execute analysis**:
   - Read target files within scope: {scope}
   - Apply analysis criteria for dimension: {analysis_dimension}
   - Document mathematical formulas in LaTeX notation ($$...$$)
   - Classify findings by severity (Critical/High/Medium/Low)
   - Include file:line references for code-related findings
4. **Generate document**: Write analysis report to ${sessionFolder}/docs/ following the standard template:
   - Metadata (Phase, Track, Date)
   - Executive Summary
   - Analysis Scope
   - Findings with severity, evidence, LaTeX formulas, impact, recommendations
   - Cross-References to other phases
   - Perspective Package (structured summary for context propagation)
5. **Share discoveries**: Append exploration findings to shared board:
   \`\`\`bash
   echo '{"ts":"<ISO8601>","worker":"{id}","type":"<type>","data":{...}}' >> ${sessionFolder}/discoveries.ndjson
   \`\`\`
6. **Report result**: Return JSON via report_agent_job_result

### Discovery Types to Share
- \`governing_equation\`: {eq_name, latex, domain, boundary_conditions} — Governing equations found
- \`numerical_method\`: {method_name, type, order, stability_class} — Numerical methods identified
- \`stability_issue\`: {location, condition_number, severity, description} — Stability concerns
- \`convergence_property\`: {method, rate, order, conditions} — Convergence properties
- \`precision_risk\`: {location, operation, risk_type, recommendation} — Floating-point precision risks
- \`performance_bottleneck\`: {location, operation_count, memory_pattern, suggestion} — Performance issues
- \`architecture_pattern\`: {pattern_name, files, description} — Architecture patterns found
- \`test_gap\`: {component, missing_coverage, priority} — Missing test coverage

---

## Output (report_agent_job_result)

Return JSON:
{
  "id": "{id}",
  "status": "completed" | "failed",
  "findings": "Key discoveries and conclusions (max 500 chars)",
  "severity_distribution": "Critical:N High:N Medium:N Low:N",
  "latex_formulas": "key formulas separated by semicolons",
  "doc_path": "relative path to generated analysis document",
  "error": ""
}`
}
```

**Success Criteria**:
- All 6 waves executed in order
- Each wave's results merged into master CSV before next wave starts
- Dependent tasks skipped when predecessor failed
- discoveries.ndjson accumulated across all waves
- Analysis documents generated in docs/ directory

---

### Phase 3: Results Aggregation

**Objective**: Generate final results and comprehensive human-readable report synthesizing all 6 phases.

```javascript
// 1. Export final results.csv
Bash(`cp ${sessionFolder}/tasks.csv ${sessionFolder}/results.csv`)

// 2. Generate context.md
const tasks = parseCsv(Read(`${sessionFolder}/tasks.csv`))
const completed = tasks.filter(t => t.status === 'completed').length
const failed = tasks.filter(t => t.status === 'failed').length
const skipped = tasks.filter(t => t.status === 'skipped').length

let contextMd = `# Numerical Analysis Report: ${requirement}\n\n`
contextMd += `**Session**: ${sessionId}\n`
contextMd += `**Date**: ${getUtc8ISOString().substring(0, 10)}\n`
contextMd += `**Total Tasks**: ${tasks.length} | Completed: ${completed} | Failed: ${failed} | Skipped: ${skipped}\n\n`

// Per-wave summary
const phaseNames = ['', 'Global Survey', 'Theoretical Foundations', 'Algorithm Design',
                    'Module Implementation', 'Local Function-Level', 'Integration & QA']
for (let w = 1; w <= 6; w++) {
  const waveTasks = tasks.filter(t => t.wave === w)
  contextMd += `## Wave ${w}: ${phaseNames[w]}\n\n`
  for (const t of waveTasks) {
    contextMd += `### ${t.id}: ${t.title} [${t.status}]\n`
    contextMd += `**Role**: ${t.track_role} | **Dimension**: ${t.analysis_dimension}\n\n`
    if (t.findings) contextMd += `**Findings**: ${t.findings}\n\n`
    if (t.latex_formulas) contextMd += `**Key Formulas**:\n$$${t.latex_formulas.split(';').join('$$\n\n$$')}$$\n\n`
    if (t.severity_distribution) contextMd += `**Issues**: ${t.severity_distribution}\n\n`
    if (t.doc_path) contextMd += `**Full Report**: [${t.doc_path}](${t.doc_path})\n\n`
    contextMd += `---\n\n`
  }
}

// Collected formulas section
const allFormulas = tasks.filter(t => t.latex_formulas).flatMap(t =>
  t.latex_formulas.split(';').map(f => ({ task: t.id, formula: f.trim() }))
)
if (allFormulas.length > 0) {
  contextMd += `## Collected Mathematical Formulas\n\n`
  for (const f of allFormulas) {
    contextMd += `- **${f.task}**: $$${f.formula}$$\n`
  }
  contextMd += `\n`
}

// All discoveries summary
contextMd += `## Discovery Board Summary\n\n`
contextMd += `See: ${sessionFolder}/discoveries.ndjson\n\n`

Write(`${sessionFolder}/context.md`, contextMd)

// 3. Display summary
// Output wave-by-wave completion status table
```

**Success Criteria**:
- results.csv exported
- context.md generated with all findings, formulas, cross-references
- Summary displayed to user

---

## Shared Discovery Board Protocol

### Standard Discovery Types

| Type | Dedup Key | Data Schema | Description |
|------|-----------|-------------|-------------|
| `governing_equation` | `eq_name` | `{eq_name, latex, domain, boundary_conditions}` | Governing equations found in the project |
| `numerical_method` | `method_name` | `{method_name, type, order, stability_class}` | Numerical methods identified |
| `stability_issue` | `location` | `{location, condition_number, severity, description}` | Numerical stability concerns |
| `convergence_property` | `method` | `{method, rate, order, conditions}` | Convergence properties proven or observed |
| `precision_risk` | `location+operation` | `{location, operation, risk_type, recommendation}` | Floating-point precision risks |
| `performance_bottleneck` | `location` | `{location, operation_count, memory_pattern, suggestion}` | Performance bottlenecks |
| `architecture_pattern` | `pattern_name` | `{pattern_name, files, description}` | Software architecture patterns |
| `test_gap` | `component` | `{component, missing_coverage, priority}` | Missing test coverage |

### Protocol Rules

1. **Read first**: Always read discoveries.ndjson before starting analysis
2. **Write immediately**: Append discoveries as soon as found, don't batch
3. **Deduplicate**: Check dedup key before appending (same key = skip)
4. **Append-only**: Never clear, modify, or recreate discoveries.ndjson
5. **Cross-wave accumulation**: Discoveries persist and accumulate across all 6 waves

### NDJSON Format

```jsonl
{"ts":"2026-03-04T10:00:00Z","worker":"T1.1","type":"governing_equation","data":{"eq_name":"Navier-Stokes","latex":"\\rho(\\frac{\\partial \\mathbf{v}}{\\partial t} + \\mathbf{v} \\cdot \\nabla \\mathbf{v}) = -\\nabla p + \\mu \\nabla^2 \\mathbf{v}","domain":"fluid_dynamics","boundary_conditions":"no-slip walls, inlet velocity"}}
{"ts":"2026-03-04T10:05:00Z","worker":"T2.2","type":"convergence_property","data":{"method":"Galerkin FEM","rate":"optimal","order":"h^{k+1} in L2","conditions":"quasi-uniform mesh, sufficient regularity"}}
{"ts":"2026-03-04T10:10:00Z","worker":"T3.2","type":"stability_issue","data":{"location":"src/solver/assembler.rs:142","condition_number":"1e12","severity":"High","description":"Ill-conditioned stiffness matrix for high aspect ratio elements"}}
```

---

## Perspective Reuse Matrix

Each phase's output serves as context for subsequent phases:

| Source Phase | P2 Reuse | P3 Reuse | P4 Reuse | P5 Reuse | P6 Reuse |
|-------------|---------|---------|---------|---------|---------|
| P1 Governing Eqs | Formalize → LaTeX | Constrain method selection | Code-equation mapping | Singularity sources | Correctness baseline |
| P1 Architecture | Constrain discretization | Parallel strategy | Module boundaries | Hotspot location | Integration scope |
| P1 Validation | - | Benchmark selection | Test criteria | Edge case sources | Final validation |
| P2 Formulas | - | Parameter constraints | Loop termination | Precision requirements | Theoretical verification |
| P2 Convergence | - | Mesh refinement strategy | Iteration control | Error tolerance | Rate verification |
| P2 Complexity | - | Performance baseline | Data structure choice | Optimization targets | Performance comparison |
| P3 Pseudocode | - | - | Implementation reference | Line-by-line audit | Regression baseline |
| P3 Stability | - | - | Precision selection | Cancellation detection | Numerical verification |
| P3 Performance | - | - | Memory layout | Vectorization targets | Benchmark targets |

---

## Error Handling

| Error | Resolution |
|-------|------------|
| Circular dependency | Detect in wave computation, abort with error message |
| Agent timeout | Mark as failed in results, continue with wave |
| Agent failed | Mark as failed, skip dependent tasks in later waves |
| All agents in wave failed | Log error, offer retry or abort |
| CSV parse error | Validate CSV format before execution, show line number |
| discoveries.ndjson corrupt | Ignore malformed lines, continue with valid entries |
| Continue mode: no session found | List available sessions, prompt user to select |
| LaTeX parse error | Store raw formula, flag for manual review |
| Scope files not found | Warn and continue with available files |
| Precision conflict between tracks | Flag in discoveries, defer to QA_Auditor in Wave 6 |

---

## Quality Gates (Per-Wave)

| Wave | Gate Criteria | Threshold |
|------|--------------|-----------|
| 1 | Core model identified + architecture mapped + KPI defined | All 3 tracks completed |
| 2 | Key formulas in LaTeX + convergence conditions stated + complexity determined | All 3 tracks completed |
| 3 | Pseudocode producible + stability assessed + performance predicted | ≥ 2 of 3 tracks completed |
| 4 | Code-algorithm mapping complete + data structures reviewed + APIs documented | ≥ 2 of 3 tracks completed |
| 5 | Hotspots identified + edge cases cataloged + precision risks flagged | ≥ 2 of 3 tracks completed |
| 6 | Test plan complete + benchmarks run + QA report synthesized | All 3 tracks completed |

---

## Core Rules

1. **Start Immediately**: First action is session initialization, then Phase 1
2. **Wave Order is Sacred**: Never execute wave N before wave N-1 completes and results are merged
3. **CSV is Source of Truth**: Master tasks.csv holds all state
4. **Context Propagation**: prev_context built from master CSV findings, not from memory
5. **Discovery Board is Append-Only**: Never clear, modify, or recreate discoveries.ndjson
6. **Skip on Failure**: If a dependency failed, skip the dependent task
7. **Cleanup Temp Files**: Remove wave-{N}.csv after results are merged
8. **LaTeX Preservation**: Mathematical formulas must be preserved in LaTeX notation throughout all phases
9. **Perspective Compounding**: Each wave MUST receive cumulative context from all preceding waves
10. **DO NOT STOP**: Continuous execution until all waves complete or all remaining tasks are skipped
