# Phase Topology — Diamond Deep Tree

Wave coordination patterns for the Numerical Analysis Diamond Workflow (NADW).

## Purpose

| Phase | Usage |
|-------|-------|
| Phase 1 (Decomposition) | Reference when assigning waves and dependencies |
| Phase 2 (Execution) | Context flow between waves |
| Phase 3 (Aggregation) | Structure the final report by topology |

---

## 1. Topology Overview

The NADW uses a **Staged Diamond** topology — six sequential waves, each with 3 parallel tracks. Context flows cumulatively from earlier waves to later ones.

```
         Wave 1: [T1.1] [T1.2] [T1.3]     Global Survey (3 parallel)
              ↓ Context P1
         Wave 2: [T2.1] [T2.2] [T2.3]     Theory (3 parallel)
              ↓ Context P1+P2
         Wave 3: [T3.1] [T3.2] [T3.3]     Algorithm (3 parallel)
              ↓ Context P1+P2+P3
         Wave 4: [T4.1] [T4.2] [T4.3]     Module (3 parallel)
              ↓ Context P1-P4
         Wave 5: [T5.1] [T5.2] [T5.3]     Local (3 parallel)
              ↓ Context P1-P5
         Wave 6: [T6.1] [T6.2] [T6.3]     Integration (3 parallel)
```

---

## 2. Wave Definitions

### Wave 1: Global Survey

| Property | Value |
|----------|-------|
| Phase Name | Global Survey |
| Track Count | 3 |
| Dependencies | None (entry wave) |
| Context Input | Project codebase only |
| Context Output | Governing equations, architecture map, validation KPIs |
| Max Parallelism | 3 |

**Tracks**:
| ID | Role | Dimension | Scope |
|----|------|-----------|-------|
| T1.1 | Problem_Domain_Analyst | domain_modeling | Full project |
| T1.2 | Software_Architect | architecture_analysis | Full project |
| T1.3 | Validation_Strategist | validation_design | Full project |

### Wave 2: Theoretical Foundations

| Property | Value |
|----------|-------|
| Phase Name | Theoretical Foundations |
| Track Count | 3 |
| Dependencies | Wave 1 |
| Context Input | Context Package P1 |
| Context Output | LaTeX formulas, convergence theorems, complexity bounds |
| Max Parallelism | 3 |

**Tracks**:
| ID | Role | Dimension | Deps | context_from |
|----|------|-----------|------|-------------|
| T2.1 | Mathematician | formula_derivation | T1.1 | T1.1 |
| T2.2 | Convergence_Analyst | convergence_analysis | T1.1 | T1.1 |
| T2.3 | Complexity_Analyst | complexity_analysis | T1.1;T1.2 | T1.1;T1.2 |

### Wave 3: Algorithm Design & Stability

| Property | Value |
|----------|-------|
| Phase Name | Algorithm Design |
| Track Count | 3 |
| Dependencies | Wave 2 |
| Context Input | Context Package P1+P2 |
| Context Output | Pseudocode, stability conditions, performance model |
| Max Parallelism | 3 |

**Tracks**:
| ID | Role | Dimension | Deps | context_from |
|----|------|-----------|------|-------------|
| T3.1 | Algorithm_Designer | method_selection | T2.1 | T2.1;T2.2;T2.3 |
| T3.2 | Stability_Analyst | stability_analysis | T2.1;T2.2 | T2.1;T2.2 |
| T3.3 | Performance_Modeler | performance_modeling | T2.3 | T1.2;T2.3 |

### Wave 4: Module Implementation

| Property | Value |
|----------|-------|
| Phase Name | Module Implementation |
| Track Count | 3 |
| Dependencies | Wave 3 |
| Context Input | Context Package P1-P3 |
| Context Output | Code-algorithm mapping, data structure decisions, API contracts |
| Max Parallelism | 3 |

**Tracks**:
| ID | Role | Dimension | Deps | context_from |
|----|------|-----------|------|-------------|
| T4.1 | Module_Implementer | implementation_analysis | T3.1 | T1.2;T3.1 |
| T4.2 | Data_Structure_Designer | data_structure_review | T3.1;T3.3 | T2.3;T3.1;T3.3 |
| T4.3 | Interface_Analyst | interface_analysis | T3.1 | T1.2;T3.1 |

### Wave 5: Local Function-Level

| Property | Value |
|----------|-------|
| Phase Name | Local Function-Level |
| Track Count | 3 |
| Dependencies | Wave 4 |
| Context Input | Context Package P1-P4 |
| Context Output | Optimization recommendations, edge case catalog, precision risk matrix |
| Max Parallelism | 3 |

**Tracks**:
| ID | Role | Dimension | Deps | context_from |
|----|------|-----------|------|-------------|
| T5.1 | Code_Optimizer | optimization | T4.1 | T3.3;T4.1 |
| T5.2 | Edge_Case_Analyst | edge_case_analysis | T4.1 | T1.1;T3.2;T4.1 |
| T5.3 | Precision_Auditor | precision_audit | T4.1;T4.2 | T3.2;T4.1;T4.2 |

### Wave 6: Integration & QA

| Property | Value |
|----------|-------|
| Phase Name | Integration & QA |
| Track Count | 3 |
| Dependencies | Wave 5 |
| Context Input | Context Package P1-P5 (ALL cumulative) |
| Context Output | Final test plan, benchmark report, QA assessment |
| Max Parallelism | 3 |

**Tracks**:
| ID | Role | Dimension | Deps | context_from |
|----|------|-----------|------|-------------|
| T6.1 | Integration_Tester | integration_testing | T5.1;T5.2 | T1.3;T5.1;T5.2 |
| T6.2 | Benchmark_Engineer | benchmarking | T5.1 | T1.3;T3.3;T5.1 |
| T6.3 | QA_Auditor | quality_assurance | T5.1;T5.2;T5.3 | T1.1;T2.1;T3.1;T4.1;T5.1;T5.2;T5.3 |

---

## 3. Context Flow Map

### Directed Context (prev_context column)

```
T1.1 ──► T2.1, T2.2, T2.3
T1.2 ──► T2.3, T3.3, T4.1, T4.3
T1.3 ──► T6.1, T6.2
T2.1 ──► T3.1, T3.2
T2.2 ──► T3.1, T3.2
T2.3 ──► T3.1, T3.3, T4.2
T3.1 ──► T4.1, T4.2, T4.3
T3.2 ──► T5.2, T5.3
T3.3 ──► T4.2, T5.1, T6.2
T4.1 ──► T5.1, T5.2, T5.3
T4.2 ──► T5.3
T5.1 ──► T6.1, T6.2
T5.2 ──► T6.1
T5.3 ──► T6.3
```

### Broadcast Context (discoveries.ndjson)

All agents read/append to the same discoveries.ndjson. Key discovery types flow across waves:

```
Wave 1: governing_equation, architecture_pattern ──► all subsequent waves
Wave 2: convergence_property ──► Wave 3-6
Wave 3: stability_issue, numerical_method ──► Wave 4-6
Wave 4: (implementation findings) ──► Wave 5-6
Wave 5: precision_risk, performance_bottleneck ──► Wave 6
```

---

## 4. Perspective Reuse Matrix

How each wave's output is reused by later waves:

| Source | P2 Reuse | P3 Reuse | P4 Reuse | P5 Reuse | P6 Reuse |
|--------|---------|---------|---------|---------|---------|
| **P1 Equations** | Formalize → LaTeX | Constrain methods | Code-eq mapping | Singularity sources | Correctness baseline |
| **P1 Architecture** | Constrain discretization | Parallel strategy | Module boundaries | Hotspot location | Integration scope |
| **P1 Validation** | - | Benchmark selection | Test criteria | Edge case sources | Final validation |
| **P2 Formulas** | - | Parameter constraints | Loop termination | Precision requirements | Theory verification |
| **P2 Convergence** | - | Mesh refinement | Iteration control | Error tolerance | Rate verification |
| **P2 Complexity** | - | Performance baseline | Data structure choice | Optimization targets | Perf comparison |
| **P3 Pseudocode** | - | - | Impl reference | Line-by-line audit | Regression baseline |
| **P3 Stability** | - | - | Precision selection | Cancellation detection | Numerical verification |
| **P3 Performance** | - | - | Memory layout | Vectorization targets | Benchmark targets |
| **P4 Modules** | - | - | - | Function-level focus | Module test plan |
| **P5 Optimization** | - | - | - | - | Performance tests |
| **P5 Edge Cases** | - | - | - | - | Regression tests |
| **P5 Precision** | - | - | - | - | Numerical tests |

---

## 5. Diamond Properties

| Property | Value |
|----------|-------|
| Total Waves | 6 |
| Total Tasks | 18 (3 per wave) |
| Max Parallelism per Wave | 3 |
| Widest Context Fan-in | T6.3 (receives from 7 tasks) |
| Deepest Dependency Chain | T1.1 → T2.1 → T3.1 → T4.1 → T5.1 → T6.1 (depth 6) |
| Context Accumulation | Cumulative (each wave adds to previous context) |
| Topology Type | Staged Parallel with Diamond convergence at Wave 6 |
