# Worker: VALIDATE

Testing and verification worker. Run tests, check coverage, quality gates.

## Purpose

- Detect test framework and run tests
- Measure code coverage
- Check quality gates (lint, types, security)
- Generate validation report
- Determine pass/fail status

## Preconditions

- Code exists to validate
- `state.status === 'running'`

## Execution

### Step 1: Detect Test Framework

```javascript
const packageJson = JSON.parse(Read('package.json') || '{}')
const testScript = packageJson.scripts?.test || 'npm test'
const coverageScript = packageJson.scripts?.['test:coverage']
```

### Step 2: Run Tests

```javascript
const testResult = await Bash({
  command: testScript,
  timeout: 300000  // 5 minutes
})

const testResults = parseTestOutput(testResult.stdout, testResult.stderr)
```

### Step 3: Run Coverage (if available)

```javascript
let coverageData = null
if (coverageScript) {
  const coverageResult = await Bash({ command: coverageScript, timeout: 300000 })
  coverageData = parseCoverageReport(coverageResult.stdout)
}
```

### Step 4: Quality Checks

```javascript
// Lint check
const lintResult = await Bash({ command: 'npm run lint 2>&1 || true' })

// Type check
const typeResult = await Bash({ command: 'npx tsc --noEmit 2>&1 || true' })
```

### Step 5: Generate Validation Report

```javascript
Write(`${progressDir}/validate.md`, `# Validation Report

**Loop ID**: ${loopId}
**Validated**: ${getUtc8ISOString()}

## Test Results

| Metric | Value |
|--------|-------|
| Total | ${testResults.total} |
| Passed | ${testResults.passed} |
| Failed | ${testResults.failed} |
| Pass Rate | ${((testResults.passed / testResults.total) * 100).toFixed(1)}% |

## Coverage

${coverageData ? `Overall: ${coverageData.overall}%` : 'N/A'}

## Quality Checks

- Lint: ${lintResult.exitCode === 0 ? 'PASS' : 'FAIL'}
- Types: ${typeResult.exitCode === 0 ? 'PASS' : 'FAIL'}

## Failed Tests

${testResults.failures?.map(f => `- ${f.name}: ${f.error}`).join('\n') || 'None'}
`)
```

### Step 6: Save Structured Results

```javascript
Write(`${workersDir}/validate.output.json`, JSON.stringify({
  action: 'validate',
  timestamp: getUtc8ISOString(),
  summary: { total: testResults.total, passed: testResults.passed, failed: testResults.failed },
  coverage: coverageData?.overall || null,
  quality: { lint: lintResult.exitCode === 0, types: typeResult.exitCode === 0 }
}, null, 2))
```

## Output Format

```
WORKER_RESULT:
- action: validate
- status: success
- summary: {passed}/{total} tests pass, coverage {N}%
- files_changed: []
- next_suggestion: complete | develop
- loop_back_to: develop (if tests fail)

DETAILED_OUTPUT:
TEST_RESULTS:
  unit_tests: { passed: 98, failed: 0 }
  integration_tests: { passed: 15, failed: 0 }
  coverage: "95%"

QUALITY_CHECKS:
  lint: PASS
  types: PASS
```

## Error Handling

| Error | Recovery |
|-------|----------|
| Tests don't run | Check config, report error |
| All tests fail | Suggest debug action |
| Coverage tool missing | Skip coverage, tests only |
| Timeout | Increase timeout or split tests |
