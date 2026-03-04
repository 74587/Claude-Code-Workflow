# Numerical Analysis Workflow — CSV Schema

## Master CSV: tasks.csv

### Column Definitions

#### Input Columns (Set by Decomposer)

| Column | Type | Required | Description | Example |
|--------|------|----------|-------------|---------|
| `id` | string | Yes | Unique task identifier (T{wave}.{track}) | `"T2.1"` |
| `title` | string | Yes | Short task title | `"Mathematical Formulation"` |
| `description` | string | Yes | Detailed task description (self-contained) | `"Derive precise mathematical formulations..."` |
| `track_role` | string | Yes | Analysis role name | `"Mathematician"` |
| `analysis_dimension` | string | Yes | Analysis focus area | `"formula_derivation"` |
| `formula_refs` | string | No | References to formulas from earlier tasks (TaskID:formula_name;...) | `"T1.1:governing_eqs;T2.2:convergence_conds"` |
| `precision_req` | string | No | Required floating-point precision | `"double"` |
| `scope` | string | No | File/directory scope for analysis (glob) | `"src/solver/**"` |
| `deps` | string | No | Semicolon-separated dependency task IDs | `"T2.1;T2.2"` |
| `context_from` | string | No | Semicolon-separated task IDs for context | `"T1.1;T2.1"` |

#### Computed Columns (Set by Wave Engine)

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `wave` | integer | Wave number (1-6, fixed per diamond topology) | `3` |
| `prev_context` | string | Aggregated findings + formulas from context_from tasks (per-wave CSV only) | `"[T2.1] Weak form derived..."` |

#### Output Columns (Set by Agent)

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `status` | enum | `pending` → `completed` / `failed` / `skipped` | `"completed"` |
| `findings` | string | Key discoveries (max 500 chars) | `"Identified CFL condition..."` |
| `severity_distribution` | string | Issue counts by severity | `"Critical:0 High:2 Medium:3 Low:1"` |
| `latex_formulas` | string | Key LaTeX formulas (semicolon-separated) | `"\\Delta t \\leq \\frac{h}{c};\\kappa(A) = \\|A\\|\\|A^{-1}\\|"` |
| `doc_path` | string | Path to generated analysis document | `"docs/P3_Numerical_Stability_Report.md"` |
| `error` | string | Error message if failed | `""` |

---

### Example Data

```csv
id,title,description,track_role,analysis_dimension,formula_refs,precision_req,scope,deps,context_from,wave,status,findings,severity_distribution,latex_formulas,doc_path,error
"T1.1","Problem Domain Survey","Survey governing equations and mathematical models. Identify PDE types, boundary conditions, conservation laws, and physical domain.","Problem_Domain_Analyst","domain_modeling","","","src/**","","","1","completed","Identified Navier-Stokes equations with k-epsilon turbulence model. Incompressible flow assumption. No-slip boundary conditions.","Critical:0 High:0 Medium:1 Low:2","\\rho(\\frac{\\partial v}{\\partial t} + v \\cdot \\nabla v) = -\\nabla p + \\mu \\nabla^2 v","docs/P1_Domain_Survey.md",""
"T2.1","Mathematical Formulation","Derive precise mathematical formulations using LaTeX. Transform governing equations into weak forms suitable for FEM discretization.","Mathematician","formula_derivation","T1.1:governing_eqs","","src/**","T1.1","T1.1","2","completed","Weak form derived for NS equations. Galerkin formulation with inf-sup stable elements (Taylor-Hood P2/P1).","Critical:0 High:0 Medium:0 Low:1","\\int_\\Omega \\mu \\nabla u : \\nabla v \\, d\\Omega - \\int_\\Omega p \\nabla \\cdot v \\, d\\Omega = \\int_\\Omega f \\cdot v \\, d\\Omega","docs/P2_Mathematical_Formulation.md",""
"T3.2","Numerical Stability Report","Analyze numerical stability of selected algorithms. Evaluate condition numbers, error propagation characteristics, and precision requirements.","Stability_Analyst","stability_analysis","T2.1:weak_forms;T2.2:convergence_conds","double","src/solver/**","T2.1;T2.2","T2.1;T2.2","3","pending","","","","",""
```

---

### Column Lifecycle

```
Decomposer (Phase 1)     Wave Engine (Phase 2)    Agent (Execution)
─────────────────────    ────────────────────     ─────────────────
id          ───────────►  id          ──────────►  id
title       ───────────►  title       ──────────►  (reads)
description ───────────►  description ──────────►  (reads)
track_role  ───────────►  track_role  ──────────►  (reads)
analysis_dimension ─────► analysis_dimension ────►  (reads)
formula_refs ──────────►  formula_refs ─────────►  (reads)
precision_req ─────────►  precision_req ─────────► (reads)
scope       ───────────►  scope       ──────────►  (reads)
deps        ───────────►  deps        ──────────►  (reads)
context_from───────────►  context_from──────────►  (reads)
                          wave         ──────────►  (reads)
                          prev_context ──────────►  (reads)
                                                    status
                                                    findings
                                                    severity_distribution
                                                    latex_formulas
                                                    doc_path
                                                    error
```

---

## Output Schema (JSON)

Agent output via `report_agent_job_result`:

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string", "description": "Task ID (T{wave}.{track})" },
    "status": { "type": "string", "enum": ["completed", "failed"] },
    "findings": { "type": "string", "description": "Key discoveries, max 500 chars" },
    "severity_distribution": { "type": "string", "description": "Critical:N High:N Medium:N Low:N" },
    "latex_formulas": { "type": "string", "description": "Key formulas in LaTeX, semicolon-separated" },
    "doc_path": { "type": "string", "description": "Path to generated analysis document" },
    "error": { "type": "string", "description": "Error message if failed" }
  },
  "required": ["id", "status", "findings"]
}
```

---

## Discovery Types

| Type | Dedup Key | Data Schema | Description |
|------|-----------|-------------|-------------|
| `governing_equation` | `eq_name` | `{eq_name, latex, domain, boundary_conditions}` | Governing equations found |
| `numerical_method` | `method_name` | `{method_name, type, order, stability_class}` | Numerical methods identified |
| `stability_issue` | `location` | `{location, condition_number, severity, description}` | Stability concerns |
| `convergence_property` | `method` | `{method, rate, order, conditions}` | Convergence properties |
| `precision_risk` | `location+operation` | `{location, operation, risk_type, recommendation}` | Float precision risks |
| `performance_bottleneck` | `location` | `{location, operation_count, memory_pattern, suggestion}` | Performance bottlenecks |
| `architecture_pattern` | `pattern_name` | `{pattern_name, files, description}` | Architecture patterns |
| `test_gap` | `component` | `{component, missing_coverage, priority}` | Missing test coverage |

### Discovery NDJSON Format

```jsonl
{"ts":"2026-03-04T10:00:00Z","worker":"T1.1","type":"governing_equation","data":{"eq_name":"Navier-Stokes","latex":"\\rho(\\frac{\\partial v}{\\partial t} + v \\cdot \\nabla v) = -\\nabla p + \\mu \\nabla^2 v","domain":"fluid_dynamics","boundary_conditions":"no-slip walls"}}
{"ts":"2026-03-04T10:05:00Z","worker":"T2.2","type":"convergence_property","data":{"method":"Galerkin FEM","rate":"optimal","order":"h^{k+1}","conditions":"quasi-uniform mesh"}}
{"ts":"2026-03-04T10:10:00Z","worker":"T3.2","type":"stability_issue","data":{"location":"src/solver/assembler.rs:142","condition_number":"1e12","severity":"High","description":"Ill-conditioned stiffness matrix"}}
{"ts":"2026-03-04T10:15:00Z","worker":"T5.3","type":"precision_risk","data":{"location":"src/solver/residual.rs:87","operation":"subtraction of nearly equal values","risk_type":"catastrophic_cancellation","recommendation":"Use compensated summation or reformulate"}}
```

---

## Validation Rules

| Rule | Check | Error |
|------|-------|-------|
| Unique IDs | No duplicate `id` values | "Duplicate task ID: {id}" |
| Valid deps | All dep IDs exist in tasks | "Unknown dependency: {dep_id}" |
| No self-deps | Task cannot depend on itself | "Self-dependency: {id}" |
| No circular deps | Topological sort completes | "Circular dependency detected involving: {ids}" |
| context_from valid | All context IDs exist and in earlier waves | "Invalid context_from: {id}" |
| Description non-empty | Every task has description | "Empty description for task: {id}" |
| Status enum | status in {pending, completed, failed, skipped} | "Invalid status: {status}" |
| Wave range | wave in {1..6} | "Invalid wave number: {wave}" |
| Track role valid | track_role matches known roles | "Unknown track_role: {role}" |
| Formula refs format | TaskID:formula_name pattern | "Malformed formula_refs: {value}" |

### Analysis Dimension Values

| Dimension | Used In Wave | Description |
|-----------|-------------|-------------|
| `domain_modeling` | 1 | Physical/mathematical domain survey |
| `architecture_analysis` | 1 | Software architecture analysis |
| `validation_design` | 1 | Validation and benchmark strategy |
| `formula_derivation` | 2 | Mathematical formulation and derivation |
| `convergence_analysis` | 2 | Convergence theory and error bounds |
| `complexity_analysis` | 2 | Computational complexity analysis |
| `method_selection` | 3 | Numerical method selection and design |
| `stability_analysis` | 3 | Numerical stability assessment |
| `performance_modeling` | 3 | Performance prediction and modeling |
| `implementation_analysis` | 4 | Module-level code analysis |
| `data_structure_review` | 4 | Data structure and memory layout review |
| `interface_analysis` | 4 | API contract and interface analysis |
| `optimization` | 5 | Function-level performance optimization |
| `edge_case_analysis` | 5 | Boundary and singularity handling |
| `precision_audit` | 5 | Floating-point precision audit |
| `integration_testing` | 6 | System integration testing |
| `benchmarking` | 6 | Performance benchmarking |
| `quality_assurance` | 6 | Final quality audit and synthesis |
