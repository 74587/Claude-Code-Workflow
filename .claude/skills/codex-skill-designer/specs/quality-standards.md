# Quality Standards

Quality criteria and validation gates for generated Codex skills.

## Purpose

| Phase | Usage |
|-------|-------|
| Phase 3 | Reference during generation |
| Phase 4 | Apply during validation |

---

## 1. Quality Dimensions

### 1.1 Structural Completeness (30%)

| Check | Weight | Criteria |
|-------|--------|----------|
| Orchestrator exists | 5 | File present at expected path |
| Frontmatter valid | 3 | Contains name, description |
| Architecture diagram | 3 | ASCII flow showing spawn/wait/close |
| Agent Registry | 4 | Table with all agents, role paths, responsibilities |
| Phase Execution blocks | 5 | Code blocks for each phase with spawn/wait/close |
| Lifecycle Management | 5 | Timeout handling + cleanup protocol |
| Agent files complete | 5 | All new agent roles have complete role files |

**Scoring**: Each check passes (full weight) or fails (0). Total = sum / max.

### 1.2 Pattern Compliance (40%)

| Check | Weight | Criteria |
|-------|--------|----------|
| Lifecycle balanced | 6 | Every spawn_agent has matching close_agent |
| Role loading correct | 6 | MANDATORY FIRST STEPS pattern used (not inline content) |
| Wait for results | 5 | wait() used for results (not close_agent) |
| Batch wait for parallel | 5 | Parallel agents use wait({ ids: [...] }) |
| Timeout specified | 4 | All wait() calls have timeout_ms |
| Timeout handled | 4 | timed_out checked after every wait() |
| Structured output | 5 | Agents produce Summary/Findings/Changes/Tests/Questions |
| No Claude patterns | 5 | No Task(), TaskOutput(), resume: remaining |

**Scoring**: Each check passes (full weight) or fails (0). Total = sum / max.

### 1.3 Content Quality (30%)

| Check | Weight | Criteria |
|-------|--------|----------|
| Orchestrator substantive | 4 | Content > 500 chars, not boilerplate |
| Code blocks present | 3 | >= 4 code blocks with executable patterns |
| Error handling | 3 | Timeout + recovery + partial results handling |
| No placeholders | 4 | No `{{...}}` or `TODO` remaining in output |
| Agent roles substantive | 4 | Each agent role > 300 chars with actionable steps |
| Output format defined | 3 | Structured output template in each agent |
| Goals/scope clear | 4 | Every spawn_agent has Goal + Scope + Deliverables |
| Conversion faithful | 5 | Source content preserved (if converting) |

**Scoring**: Each check passes (full weight) or fails (0). Total = sum / max.

## 2. Quality Gates

| Verdict | Score | Action |
|---------|-------|--------|
| **PASS** | >= 80% | Deliver to target location |
| **REVIEW** | 60-79% | Report issues, user decides |
| **FAIL** | < 60% | Block delivery, list critical issues |

### 2.1 Critical Failures (Auto-FAIL)

These issues force FAIL regardless of overall score:

1. **No orchestrator file** — skill has no entry point
2. **Task() calls in output** — runtime incompatible with Codex
3. **No agent registry** — agents cannot be identified
4. **Missing close_agent** — resource leak risk
5. **Inline role content** — violates Codex pattern (message bloat)

### 2.2 Warnings (Non-blocking)

1. **Missing timeout handling** — degraded reliability
2. **No error handling section** — reduced robustness
3. **Placeholder text remaining** — needs manual completion
4. **Phase files missing** — acceptable for simple skills

## 3. Validation Process

### 3.1 Automated Checks

```javascript
function validateSkill(generatedFiles, codexSkillConfig) {
  const checks = []

  // Structural
  checks.push(checkFileExists(generatedFiles.orchestrator))
  checks.push(checkFrontmatter(generatedFiles.orchestrator))
  checks.push(checkSection(generatedFiles.orchestrator, "Architecture"))
  checks.push(checkSection(generatedFiles.orchestrator, "Agent Registry"))
  // ...

  // Pattern compliance
  const content = Read(generatedFiles.orchestrator)
  checks.push(checkBalancedLifecycle(content))
  checks.push(checkRoleLoading(content))
  checks.push(checkWaitPattern(content))
  // ...

  // Content quality
  checks.push(checkNoPlaceholders(content))
  checks.push(checkSubstantiveContent(content))
  // ...

  // Critical failures
  const criticals = checkCriticalFailures(content, generatedFiles)
  if (criticals.length > 0) return { verdict: "FAIL", criticals }

  // Score
  const score = calculateWeightedScore(checks)
  const verdict = score >= 80 ? "PASS" : score >= 60 ? "REVIEW" : "FAIL"

  return { score, verdict, checks, issues: checks.filter(c => !c.passed) }
}
```

### 3.2 Manual Review Points

For REVIEW verdict, highlight these for user attention:

1. Agent role completeness — are all capabilities covered?
2. Interaction model appropriateness — right pattern for use case?
3. Timeout values — appropriate for expected task duration?
4. Scope definitions — clear boundaries for each agent?
5. Output format — suitable for downstream consumers?

## 4. Scoring Formula

```
Overall = Structural × 0.30 + PatternCompliance × 0.40 + ContentQuality × 0.30
```

Pattern compliance weighted highest because Codex runtime correctness is critical.

## 5. Quality Improvement Guidance

### Low Structural Score

- Add missing sections to orchestrator
- Create missing agent role files
- Add frontmatter to all files

### Low Pattern Score

- Add MANDATORY FIRST STEPS to all spawn_agent messages
- Replace inline role content with path references
- Add close_agent for every spawn_agent
- Add timeout_ms and timed_out handling to all wait calls
- Remove any remaining Claude patterns

### Low Content Score

- Expand agent role definitions with more specific steps
- Add concrete Goal/Scope/Deliverables to spawn messages
- Replace placeholders with actual content
- Add error handling for each phase
