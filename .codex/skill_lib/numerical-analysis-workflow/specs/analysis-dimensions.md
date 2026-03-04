# Analysis Dimensions for Numerical Computation

Defines the 18 analysis dimensions across 6 phases of the NADW workflow.

## Purpose

| Phase | Usage |
|-------|-------|
| Phase 1 (Decomposition) | Reference when assigning analysis_dimension to tasks |
| Phase 2 (Execution) | Agents use to understand their analysis focus |
| Phase 3 (Aggregation) | Organize findings by dimension |

---

## 1. Wave 1: Global Survey Dimensions

### 1.1 Domain Modeling (`domain_modeling`)

**Analyst Role**: Problem_Domain_Analyst

**Focus Areas**:
- Governing equations (PDEs, ODEs, integral equations)
- Physical domain and boundary conditions
- Conservation laws and constitutive relations
- Problem classification (elliptic, parabolic, hyperbolic)
- Dimensional analysis and non-dimensionalization

**Key Outputs**:
- Equation inventory with LaTeX notation
- Boundary condition catalog
- Problem classification matrix
- Physical parameter ranges

**Formula Types to Identify**:
$$\frac{\partial u}{\partial t} + \mathcal{L}u = f \quad \text{(general PDE form)}$$
$$u|_{\partial\Omega} = g \quad \text{(Dirichlet BC)}$$
$$\frac{\partial u}{\partial n}|_{\partial\Omega} = h \quad \text{(Neumann BC)}$$

### 1.2 Architecture Analysis (`architecture_analysis`)

**Analyst Role**: Software_Architect

**Focus Areas**:
- Module decomposition and dependency graph
- Data flow between computational stages
- I/O patterns (mesh input, solution output, checkpointing)
- Parallelism strategy (MPI, OpenMP, GPU)
- Build system and dependency management

**Key Outputs**:
- High-level component diagram
- Data flow diagram
- Technology stack inventory
- Parallelism strategy assessment

### 1.3 Validation Design (`validation_design`)

**Analyst Role**: Validation_Strategist

**Focus Areas**:
- Benchmark cases with known analytical solutions
- Manufactured solution methodology
- Grid convergence study design
- Key Performance Indicators (KPIs)
- Acceptance criteria definition

**Key Outputs**:
- Benchmark case catalog
- Validation methodology matrix
- KPI definitions with targets
- Acceptance test specifications

---

## 2. Wave 2: Theoretical Foundation Dimensions

### 2.1 Formula Derivation (`formula_derivation`)

**Analyst Role**: Mathematician

**Focus Areas**:
- Strong-to-weak form transformation
- Discretization schemes (FEM, FDM, FVM, spectral)
- Variational formulations
- Linearization techniques (Newton, Picard)
- Stabilization methods (SUPG, GLS, VMS)

**Key Formula Templates**:
$$\text{Weak form: } a(u,v) = l(v) \quad \forall v \in V_h$$
$$a(u,v) = \int_\Omega \nabla u \cdot \nabla v \, d\Omega$$
$$l(v) = \int_\Omega f v \, d\Omega + \int_{\Gamma_N} g v \, dS$$

### 2.2 Convergence Analysis (`convergence_analysis`)

**Analyst Role**: Convergence_Analyst

**Focus Areas**:
- A priori error estimates
- A posteriori error estimators
- Convergence order verification
- Lax equivalence theorem applicability
- CFL conditions for time-dependent problems

**Key Formula Templates**:
$$\|u - u_h\|_{L^2} \leq C h^{k+1} |u|_{H^{k+1}} \quad \text{(optimal L2 rate)}$$
$$\|u - u_h\|_{H^1} \leq C h^k |u|_{H^{k+1}} \quad \text{(optimal H1 rate)}$$
$$\Delta t \leq \frac{C h}{\|v\|_\infty} \quad \text{(CFL condition)}$$

### 2.3 Complexity Analysis (`complexity_analysis`)

**Analyst Role**: Complexity_Analyst

**Focus Areas**:
- Assembly operation counts
- Solver complexity (direct vs iterative)
- Preconditioner cost analysis
- Memory scaling with problem size
- Communication overhead in parallel settings

**Key Formula Templates**:
$$T_{assembly} = O(N_{elem} \cdot p^{2d}) \quad \text{(FEM assembly)}$$
$$T_{solve} = O(N^{3/2}) \quad \text{(2D direct)}, \quad O(N \log N) \quad \text{(multigrid)}$$
$$M_{storage} = O(nnz) \quad \text{(sparse storage)}$$

---

## 3. Wave 3: Algorithm Design Dimensions

### 3.1 Method Selection (`method_selection`)

**Analyst Role**: Algorithm_Designer

**Focus Areas**:
- Spatial discretization method selection
- Time integration scheme selection
- Linear/nonlinear solver selection
- Preconditioner selection
- Mesh generation strategy

**Decision Criteria**:

| Criterion | Weight | Metrics |
|-----------|--------|---------|
| Accuracy order | High | Convergence rate, error bounds |
| Stability | High | Unconditional vs conditional, CFL |
| Efficiency | Medium | FLOPS per DOF, memory per DOF |
| Parallelizability | Medium | Communication-to-computation ratio |
| Implementation complexity | Low | Lines of code, library availability |

### 3.2 Stability Analysis (`stability_analysis`)

**Analyst Role**: Stability_Analyst

**Focus Areas**:
- Von Neumann stability analysis
- Matrix condition numbers
- Amplification factors
- Inf-sup (LBB) stability for mixed methods
- Mesh-dependent stability bounds

**Key Formula Templates**:
$$\kappa(A) = \|A\| \cdot \|A^{-1}\| \quad \text{(condition number)}$$
$$|g(\xi)| \leq 1 \quad \forall \xi \quad \text{(von Neumann stability)}$$
$$\inf_{q_h \in Q_h} \sup_{v_h \in V_h} \frac{b(v_h, q_h)}{\|v_h\| \|q_h\|} \geq \beta > 0 \quad \text{(inf-sup)}$$

### 3.3 Performance Modeling (`performance_modeling`)

**Analyst Role**: Performance_Modeler

**Focus Areas**:
- Arithmetic intensity (FLOPS/byte)
- Roofline model analysis
- Strong/weak scaling prediction
- Memory bandwidth bottleneck identification
- Cache utilization estimates

**Key Formula Templates**:
$$AI = \frac{\text{FLOPS}}{\text{Bytes transferred}} \quad \text{(arithmetic intensity)}$$
$$P_{max} = \min(P_{peak}, AI \times BW_{mem}) \quad \text{(roofline bound)}$$
$$E_{parallel}(p) = \frac{T_1}{p \cdot T_p} \quad \text{(parallel efficiency)}$$

---

## 4. Wave 4: Module Implementation Dimensions

### 4.1 Implementation Analysis (`implementation_analysis`)

**Focus**: Algorithm-to-code mapping, implementation correctness, coding patterns

### 4.2 Data Structure Review (`data_structure_review`)

**Focus**: Sparse matrix formats (CSR/CSC/COO), mesh data structures, memory layout optimization

### 4.3 Interface Analysis (`interface_analysis`)

**Focus**: Module APIs, data contracts between components, error handling patterns

---

## 5. Wave 5: Local Function-Level Dimensions

### 5.1 Optimization (`optimization`)

**Focus**: Hotspot identification, vectorization opportunities, cache optimization, loop restructuring

### 5.2 Edge Case Analysis (`edge_case_analysis`)

**Focus**: Division by zero, matrix singularity, degenerate mesh elements, boundary layer singularities

### 5.3 Precision Audit (`precision_audit`)

**Focus**: Catastrophic cancellation, accumulation errors, mixed-precision opportunities, compensated algorithms

**Critical Patterns to Detect**:

| Pattern | Risk | Mitigation |
|---------|------|-----------|
| `a - b` where `a ≈ b` | Catastrophic cancellation | Reformulate or use higher precision |
| `sum += small_value` in loop | Accumulation error | Kahan summation |
| `1.0/x` where `x → 0` | Overflow/loss of significance | Guard with threshold |
| Mixed float32/float64 | Silent precision loss | Explicit type annotations |

---

## 6. Wave 6: Integration & QA Dimensions

### 6.1 Integration Testing (`integration_testing`)

**Focus**: End-to-end test design, regression suite, manufactured solutions verification

### 6.2 Benchmarking (`benchmarking`)

**Focus**: Actual vs predicted performance, scalability tests, profiling results

### 6.3 Quality Assurance (`quality_assurance`)

**Focus**: All-phase synthesis, risk matrix, improvement roadmap, final recommendations
