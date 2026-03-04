# Agent Instruction Template

Template for generating agent instruction prompts used in `spawn_agents_on_csv`.

## Key Concept

The instruction template is a **prompt with column placeholders** (`{column_name}`). When `spawn_agents_on_csv` executes, each agent receives the template with its row's column values substituted.

**Critical rule**: The instruction template is the ONLY context the agent has. It must be self-contained — the agent cannot access the master CSV or other agents' data.

---

## Template

```markdown
## TASK ASSIGNMENT — Numerical Analysis

### MANDATORY FIRST STEPS
1. Read shared discoveries: {session_folder}/discoveries.ndjson (if exists, skip if not)
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

1. **Read discoveries**: Load {session_folder}/discoveries.ndjson for shared exploration findings from other tracks
2. **Use context**: Apply previous tasks' findings from prev_context above — this contains cumulative analysis from all preceding phases
3. **Execute analysis based on your role**:

   #### For Domain Analysis Roles (Wave 1: Problem_Domain_Analyst, Software_Architect, Validation_Strategist)
   - Survey the project codebase within scope: {scope}
   - Identify mathematical models, governing equations, boundary conditions
   - Map software architecture: modules, data flow, dependencies
   - Define validation strategy: benchmarks, KPIs, acceptance criteria

   #### For Theory Roles (Wave 2: Mathematician, Convergence_Analyst, Complexity_Analyst)
   - Build on governing equations from Wave 1 context
   - Derive precise mathematical formulations using LaTeX notation
   - Prove or analyze convergence properties with error bounds
   - Determine computational complexity (time and space)
   - All formulas MUST use LaTeX: `$$formula$$`

   #### For Algorithm Roles (Wave 3: Algorithm_Designer, Stability_Analyst, Performance_Modeler)
   - Select numerical methods based on theoretical analysis from Wave 2
   - Write algorithm pseudocode for core computational kernels
   - Analyze condition numbers and error propagation
   - Build performance model: FLOPS count, memory bandwidth, parallel efficiency

   #### For Module Roles (Wave 4: Module_Implementer, Data_Structure_Designer, Interface_Analyst)
   - Map algorithms from Wave 3 to actual code modules
   - Review data structures: sparse matrix formats, mesh data, memory layout
   - Document module interfaces, data contracts, error handling patterns

   #### For Local Analysis Roles (Wave 5: Code_Optimizer, Edge_Case_Analyst, Precision_Auditor)
   - Identify performance hotspots with file:line references
   - Catalog edge cases: singularities, division by zero, overflow/underflow
   - Audit floating-point operations for catastrophic cancellation, accumulation errors
   - Provide specific optimization recommendations (vectorization, cache, parallelism)

   #### For Integration Roles (Wave 6: Integration_Tester, Benchmark_Engineer, QA_Auditor)
   - Design end-to-end test plans using benchmarks from Wave 1
   - Run or plan performance benchmarks comparing actual vs theoretical (Wave 3)
   - Synthesize ALL findings from Waves 1-5 into final quality report
   - Produce risk matrix and improvement roadmap

4. **Generate analysis document**: Write to {session_folder}/docs/ using this template:

   ```markdown
   # [Phase {wave}] {title}

   ## Metadata
   - **Phase**: {wave} | **Track**: {id} | **Role**: {track_role}
   - **Dimension**: {analysis_dimension}
   - **Date**: [ISO8601]
   - **Input Context**: Context from tasks {context_from}

   ## Executive Summary
   [2-3 sentences: core conclusions]

   ## Analysis Scope
   [Boundaries, assumptions, files analyzed within {scope}]

   ## Findings

   ### Finding 1: [Title]
   **Severity**: Critical / High / Medium / Low
   **Evidence**: [Code reference file:line or formula derivation]
   $$\text{LaTeX formula if applicable}$$
   **Impact**: [Effect on project correctness, performance, or stability]
   **Recommendation**: [Specific actionable suggestion]

   ### Finding N: ...

   ## Mathematical Formulas
   [All key formulas derived or referenced in this analysis]

   ## Cross-References
   [References to findings from other phases/tracks]

   ## Perspective Package
   [Structured summary for context propagation to later phases]
   - Key conclusions: ...
   - Formulas for reuse: ...
   - Open questions: ...
   - Risks identified: ...
   ```

5. **Share discoveries**: Append findings to shared board:
   ```bash
   echo '{"ts":"<ISO8601>","worker":"{id}","type":"<type>","data":{...}}' >> {session_folder}/discoveries.ndjson
   ```

6. **Report result**: Return JSON via report_agent_job_result

### Discovery Types to Share
- `governing_equation`: {eq_name, latex, domain, boundary_conditions} — Governing equations found
- `numerical_method`: {method_name, type, order, stability_class} — Numerical methods identified
- `stability_issue`: {location, condition_number, severity, description} — Stability concerns
- `convergence_property`: {method, rate, order, conditions} — Convergence properties
- `precision_risk`: {location, operation, risk_type, recommendation} — Float precision risks
- `performance_bottleneck`: {location, operation_count, memory_pattern, suggestion} — Performance issues
- `architecture_pattern`: {pattern_name, files, description} — Architecture patterns found
- `test_gap`: {component, missing_coverage, priority} — Missing test coverage

---

## Output (report_agent_job_result)

Return JSON:
{
  "id": "{id}",
  "status": "completed" | "failed",
  "findings": "Key discoveries and conclusions (max 500 chars)",
  "severity_distribution": "Critical:N High:N Medium:N Low:N",
  "latex_formulas": "key formulas in LaTeX separated by semicolons",
  "doc_path": "relative path to generated analysis document (e.g., docs/P2_Mathematical_Formulation.md)",
  "error": ""
}
```

---

## Placeholder Distinction

| Syntax | Resolved By | When |
|--------|-----------|------|
| `{column_name}` | spawn_agents_on_csv | During agent execution (runtime) |
| `{session_folder}` | Wave engine | Before spawning (set in instruction string) |

The SKILL.md embeds this template with `{session_folder}` replaced by the actual session path. Column placeholders `{column_name}` remain for runtime substitution.

---

## Instruction Size Guidelines

| Track Type | Target Length | Notes |
|-----------|-------------|-------|
| Wave 1 (Global) | 500-1000 chars | Broad survey, needs exploration guidance |
| Wave 2 (Theory) | 1000-2000 chars | Requires mathematical rigor instructions |
| Wave 3 (Algorithm) | 1000-1500 chars | Needs pseudocode format guidance |
| Wave 4 (Module) | 800-1200 chars | Focused on code-algorithm mapping |
| Wave 5 (Local) | 800-1500 chars | Detailed precision/optimization criteria |
| Wave 6 (Integration) | 1500-2500 chars | Must synthesize all prior phases |
