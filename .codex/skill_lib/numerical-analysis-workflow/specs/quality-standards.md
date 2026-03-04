# Quality Standards for Numerical Analysis Workflow

Quality assessment criteria for NADW analysis reports.

## When to Use

| Phase | Usage | Section |
|-------|-------|---------|
| Phase 2 (Execution) | Guide agent analysis quality | All dimensions |
| Phase 3 (Aggregation) | Score generated reports | Quality Gates |

---

## Quality Dimensions

### 1. Mathematical Rigor (30%)

| Score | Criteria |
|-------|----------|
| 100% | All formulas correct, properly derived, LaTeX well-formatted, error bounds proven |
| 80% | Formulas correct, some derivation steps skipped, bounds stated without full proof |
| 60% | Key formulas present, some notation inconsistencies, bounds estimated |
| 40% | Formulas incomplete or contain errors |
| 0% | No mathematical content |

**Checklist**:
- [ ] Governing equations identified and written in LaTeX
- [ ] Weak forms correctly derived from strong forms
- [ ] Convergence order stated with conditions
- [ ] Error bounds provided (a priori or a posteriori)
- [ ] CFL/stability conditions explicitly stated
- [ ] Condition numbers estimated for key matrices
- [ ] Complexity bounds (time and space) determined
- [ ] LaTeX notation consistent throughout all documents

### 2. Code-Theory Mapping (25%)

| Score | Criteria |
|-------|----------|
| 100% | Every algorithm mapped to code with file:line references, data structures justified |
| 80% | Major algorithms mapped, most references accurate |
| 60% | Key mappings present, some code references missing |
| 40% | Superficial mapping, few code references |
| 0% | No code-theory connection |

**Checklist**:
- [ ] Each numerical method traced to implementing function/module
- [ ] Data structures justified against algorithm requirements
- [ ] Sparse matrix format matched to access patterns
- [ ] Time integration scheme identified in code
- [ ] Boundary condition implementation verified
- [ ] Solver configuration traced to convergence requirements
- [ ] Preconditioner choice justified

### 3. Numerical Quality Assessment (25%)

| Score | Criteria |
|-------|----------|
| 100% | Stability fully analyzed, precision risks cataloged, all edge cases covered |
| 80% | Stability assessed, major precision risks found, common edge cases covered |
| 60% | Basic stability check, some precision risks, incomplete edge cases |
| 40% | Superficial stability mention, few precision issues found |
| 0% | No numerical quality analysis |

**Checklist**:
- [ ] Condition numbers estimated for key operations
- [ ] Catastrophic cancellation risks identified with file:line
- [ ] Accumulation error potential assessed
- [ ] Float precision choices justified (float32 vs float64)
- [ ] Edge cases cataloged (singularities, degenerate inputs)
- [ ] Overflow/underflow risks identified
- [ ] Mixed-precision operations flagged

### 4. Cross-Phase Coherence (20%)

| Score | Criteria |
|-------|----------|
| 100% | All 6 phases connected, findings build on each other, no contradictions |
| 80% | Most phases connected, minor gaps in context propagation |
| 60% | Key connections present, some phases isolated |
| 40% | Limited cross-referencing between phases |
| 0% | Phases completely isolated |

**Checklist**:
- [ ] Wave 2 formulas reference Wave 1 governing equations
- [ ] Wave 3 algorithms justified by Wave 2 theory
- [ ] Wave 4 implementation verified against Wave 3 pseudocode
- [ ] Wave 5 optimization targets from Wave 3 performance model
- [ ] Wave 5 precision requirements from Wave 2/3 analysis
- [ ] Wave 6 test plan covers findings from all prior waves
- [ ] Wave 6 benchmarks compare against Wave 3 predictions
- [ ] No contradictory findings between phases
- [ ] Discoveries board used for cross-track sharing

---

## Quality Gates (Per-Wave)

| Wave | Phase | Gate Criteria | Required Tracks |
|------|-------|--------------|-----------------|
| 1 | Global Survey | Core model identified + architecture mapped + ≥1 KPI | 3/3 completed |
| 2 | Theory | Key formulas LaTeX'd + convergence stated + complexity determined | 3/3 completed |
| 3 | Algorithm | Pseudocode produced + stability assessed + performance predicted | ≥2/3 completed |
| 4 | Module | Code-algorithm mapping + data structures reviewed + APIs documented | ≥2/3 completed |
| 5 | Local | Hotspots identified + edge cases cataloged + precision risks flagged | ≥2/3 completed |
| 6 | Integration | Test plan complete + benchmarks planned + QA report synthesized | 3/3 completed |

---

## Overall Quality Gates

| Gate | Threshold | Action |
|------|-----------|--------|
| PASS | >= 80% across all dimensions | Report ready for delivery |
| REVIEW | 70-79% in any dimension | Flag dimension for improvement, user decides |
| FAIL | < 70% in any dimension | Block delivery, identify gaps, suggest re-analysis |

---

## Issue Classification

### Errors (Must Fix)

- Missing governing equation identification (Wave 1)
- LaTeX formulas with mathematical errors (Wave 2)
- Algorithm pseudocode that doesn't match convergence requirements (Wave 3)
- Code references to non-existent files/functions (Wave 4)
- Unidentified catastrophic cancellation in critical path (Wave 5)
- Test plan that doesn't cover identified stability issues (Wave 6)
- Contradictory findings between phases
- Missing context propagation (later phase ignores earlier findings)

### Warnings (Should Fix)

- Formulas without derivation steps
- Convergence bounds stated without proof or reference
- Missing edge case for known singularity
- Performance model without memory bandwidth consideration
- Data structure choice not justified
- Test plan without manufactured solution verification
- Benchmark without theoretical baseline comparison

### Notes (Nice to Have)

- Additional bibliography references
- Alternative algorithm comparisons
- Extended precision sensitivity analysis
- Scaling prediction beyond current problem size
- Code style or naming convention suggestions

---

## Severity Levels for Findings

| Severity | Definition | Example |
|----------|-----------|---------|
| **Critical** | Incorrect results or numerical failure | Wrong boundary condition → divergent solution |
| **High** | Significant accuracy or performance degradation | Condition number 10^15 → double precision insufficient |
| **Medium** | Suboptimal but functional | O(N^2) where O(N log N) is possible |
| **Low** | Minor improvement opportunity | Unnecessary array copy in non-critical path |

---

## Document Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Formula coverage | ≥ 90% of core equations in LaTeX | Count identified vs documented |
| Code reference density | ≥ 1 file:line per finding | Count references per finding |
| Cross-phase references | ≥ 3 per document (Waves 3-6) | Count cross-references |
| Severity distribution | ≥ 1 per severity level | Count per level |
| Discovery board contributions | ≥ 2 per track | Count NDJSON entries per worker |
| Perspective package | Present in every document | Boolean per document |
