# Phase 2: Execute Step

> **COMPACT SENTINEL [Phase 2: Execute Step]**
> This phase contains 4 execution steps (Step 2.1 -- 2.4).
> If you can read this sentinel but cannot find the full Step protocol below, context has been compressed.
> Recovery: `Read("phases/02-step-execute.md")`

Execute a single workflow step and collect its output artifacts.

## Objective

- Determine step execution method (skill invoke / ccw cli / shell command)
- Execute step with appropriate tool
- Collect output artifacts into step directory
- Write artifacts manifest

## Execution

### Step 2.1: Prepare Step Directory

```javascript
const stepIdx = currentStepIndex;  // from orchestrator loop
const step = state.steps[stepIdx];
const stepDir = `${state.work_dir}/steps/step-${stepIdx + 1}`;
const artifactsDir = `${stepDir}/artifacts`;

// Capture pre-execution state (git status, file timestamps)
const preGitStatus = Bash('git status --porcelain 2>/dev/null || echo "not a git repo"').stdout;

// ★ Warn if dirty git working directory (first step only)
if (stepIdx === 0 && preGitStatus.trim() && preGitStatus.trim() !== 'not a git repo') {
  const dirtyLines = preGitStatus.trim().split('\n').length;
  // Log warning — artifact collection via git diff may be unreliable
  // This is informational; does not block execution
  console.warn(`⚠ Dirty git working directory detected (${dirtyLines} changed files). Artifact collection via git diff may include pre-existing changes.`);
}

const preExecSnapshot = {
  timestamp: new Date().toISOString(),
  git_status: preGitStatus,
  working_files: Glob('**/*.{ts,js,md,json}').slice(0, 50)  // sample
};
Write(`${stepDir}/pre-exec-snapshot.json`, JSON.stringify(preExecSnapshot, null, 2));
```

### Step 2.2: Execute by Step Type

```javascript
let executionResult = { success: false, method: '', output: '', duration: 0 };
const startTime = Date.now();

switch (step.type) {
  case 'skill': {
    // Skill invocation — use Skill tool
    // Extract skill name and arguments from command
    const skillCmd = step.command.replace(/^\//, '');
    const [skillName, ...skillArgs] = skillCmd.split(/\s+/);

    // Execute skill (this runs synchronously within current context)
    // Note: Skill execution produces artifacts in the working directory
    // We capture changes by comparing pre/post state
    Skill({
      name: skillName,
      arguments: skillArgs.join(' ')
    });

    executionResult.method = 'skill';
    executionResult.success = true;
    break;
  }

  case 'ccw-cli': {
    // Direct ccw cli command
    const cliCommand = step.command;

    Bash({
      command: cliCommand,
      run_in_background: true,
      timeout: 600000  // 10 minutes
    });

    // STOP — wait for hook callback
    // After callback:
    executionResult.method = 'ccw-cli';
    executionResult.success = true;
    break;
  }

  case 'command': {
    // Generic shell command
    const result = Bash({
      command: step.command,
      timeout: 300000  // 5 minutes
    });

    executionResult.method = 'command';
    executionResult.output = result.stdout || '';
    executionResult.success = result.exitCode === 0;

    // Save command output
    if (executionResult.output) {
      Write(`${artifactsDir}/command-output.txt`, executionResult.output);
    }
    if (result.stderr) {
      Write(`${artifactsDir}/command-stderr.txt`, result.stderr);
    }
    break;
  }
}

executionResult.duration = Date.now() - startTime;
```

### Step 2.3: Collect Artifacts

```javascript
// Capture post-execution state
const postExecSnapshot = {
  timestamp: new Date().toISOString(),
  git_status: Bash('git status --porcelain 2>/dev/null || echo "not a git repo"').stdout,
  working_files: Glob('**/*.{ts,js,md,json}').slice(0, 50)
};

// Detect changed/new files by comparing snapshots
const preFiles = new Set(preExecSnapshot.working_files);
const newOrChanged = postExecSnapshot.working_files.filter(f => !preFiles.has(f));

// Also check git diff for modified files
const gitDiff = Bash('git diff --name-only 2>/dev/null || true').stdout.trim().split('\n').filter(Boolean);

// Collect all artifacts (new files + git-changed files + declared expected_artifacts)
const declaredArtifacts = (step.expected_artifacts || []).filter(f => {
  // Verify declared artifacts actually exist
  const exists = Glob(f);
  return exists.length > 0;
}).flatMap(f => Glob(f));

const allArtifacts = [...new Set([...newOrChanged, ...gitDiff, ...declaredArtifacts])];

// Copy detected artifacts to step artifacts dir (or record references)
const artifactManifest = {
  step: step.name,
  step_index: stepIdx,
  execution_method: executionResult.method,
  success: executionResult.success,
  duration_ms: executionResult.duration,
  artifacts: allArtifacts.map(f => ({
    path: f,
    type: f.endsWith('.md') ? 'markdown' : f.endsWith('.json') ? 'json' : 'other',
    size: 'unknown'  // Can be filled by stat if needed
  })),
  // For skill type: also check .workflow/.scratchpad for generated files
  scratchpad_files: step.type === 'skill'
    ? Glob('.workflow/.scratchpad/**/*').filter(f => {
        // Only include files created after step started
        return true;  // Heuristic: include recent scratchpad files
      }).slice(0, 20)
    : [],
  collected_at: new Date().toISOString()
};

Write(`${stepDir}/artifacts-manifest.json`, JSON.stringify(artifactManifest, null, 2));
```

### Step 2.4: Update State

```javascript
state.steps[stepIdx].status = 'executed';
state.steps[stepIdx].execution = {
  method: executionResult.method,
  success: executionResult.success,
  duration_ms: executionResult.duration,
  artifacts_dir: artifactsDir,
  manifest_path: `${stepDir}/artifacts-manifest.json`,
  artifact_count: artifactManifest.artifacts.length,
  started_at: preExecSnapshot.timestamp,
  completed_at: new Date().toISOString()
};

state.updated_at = new Date().toISOString();
Write(`${state.work_dir}/workflow-state.json`, JSON.stringify(state, null, 2));
```

## Error Handling

| Error | Recovery |
|-------|----------|
| Skill not found | Record failure, set success=false, continue to Phase 3 |
| CLI timeout (10min) | Retry once with shorter timeout, then record failure |
| Command exit non-zero | Record stderr, set success=false, continue to Phase 3 |
| No artifacts detected | Continue to Phase 3 — analysis evaluates step definition quality |

## Output

- **Files**: `pre-exec-snapshot.json`, `artifacts-manifest.json`, `artifacts/` (if command type)
- **State**: `steps[stepIdx].execution` updated
- **Next**: Phase 3 (Analyze Step)
