# Phase 1: Setup

Initialize workspace, parse workflow definition, semantic decomposition for natural language, generate command document, user confirmation, create state and process log.

## Objective

- Parse workflow steps from user input (Format 1-3: direct parse, Format 4: semantic decomposition)
- Generate Command Document (formatted execution plan)
- User confirmation: Execute / Edit steps / Cancel
- Validate step commands/skill paths
- Create isolated workspace directory
- Initialize workflow-state.json and process-log.md

## Execution

### Step 1.1: Parse Input

```javascript
const args = $ARGUMENTS.trim();

// Detect input format
let steps = [];
let workflowName = 'unnamed-workflow';
let workflowContext = '';

// Format 1: JSON file (--file path)
const fileMatch = args.match(/--file\s+"?([^\s"]+)"?/);
if (fileMatch) {
  const wfDef = JSON.parse(Read(fileMatch[1]));
  workflowName = wfDef.name || 'unnamed-workflow';
  workflowContext = wfDef.description || '';
  steps = wfDef.steps;
}

// Format 2: Pipe-separated commands ("cmd1 | cmd2 | cmd3")
else if (args.includes('|')) {
  const rawSteps = args.split(/(?:--context|--depth|-y|--yes|--auto-fix)\s+("[^"]*"|\S+)/)[0];
  steps = rawSteps.split('|').map((cmd, i) => ({
    name: `step-${i + 1}`,
    type: cmd.trim().startsWith('/') ? 'skill'
        : cmd.trim().startsWith('ccw cli') ? 'ccw-cli'
        : 'command',
    command: cmd.trim(),
    expected_artifacts: [],
    success_criteria: ''
  }));
}

// Format 3: Comma-separated skill names (matches pattern: word,word or word-word,word-word)
else if (/^[\w-]+(,[\w-]+)+/.test(args.split(/\s/)[0])) {
  const skillPart = args.match(/^([^\s]+)/);
  const skillNames = skillPart ? skillPart[1].split(',') : [];
  steps = skillNames.map((name, i) => {
    const skillPath = name.startsWith('.claude/') ? name : `.claude/skills/${name}`;
    return {
      name: name.replace('.claude/skills/', ''),
      type: 'skill',
      command: `/${name.replace('.claude/skills/', '')}`,
      skill_path: skillPath,
      expected_artifacts: [],
      success_criteria: ''
    };
  });
}

// Format 4: Natural language → semantic decomposition
else {
  inputFormat = 'natural-language';
  naturalLanguageInput = args.replace(/--\w+\s+"[^"]*"/g, '').replace(/--\w+\s+\S+/g, '').replace(/-y|--yes/g, '').trim();
  // Steps will be populated in Step 1.1b
  steps = [];
}

// Parse --context
const contextMatch = args.match(/--context\s+"([^"]+)"/);
workflowContext = contextMatch ? contextMatch[1] : workflowContext;

// Parse --depth
const depthMatch = args.match(/--depth\s+(quick|standard|deep)/);
if (depthMatch) {
  workflowPreferences.analysisDepth = depthMatch[1];
}

// If no context provided, ask user
if (!workflowContext) {
  const response = AskUserQuestion({
    questions: [{
      question: "请描述这个 workflow 的目标和预期效果：",
      header: "Workflow Context",
      multiSelect: false,
      options: [
        { label: "General quality check", description: "通用质量检查，评估步骤间衔接" },
        { label: "Custom description", description: "自定义描述 workflow 目标" }
      ]
    }]
  });
  workflowContext = response["Workflow Context"];
}
```

### Step 1.1b: Semantic Decomposition (Format 4 only)

> Skip this step if `inputFormat !== 'natural-language'`.

Decompose natural language input into a structured step chain by identifying intent verbs and mapping them to available tools/skills.

```javascript
if (inputFormat === 'natural-language') {
  // Intent-to-tool mapping (regex patterns → tool config)
  const intentMap = [
    { pattern: /分析|analyze|审查|inspect|scan/i, name: 'analyze', tool: 'gemini', mode: 'analysis', rule: 'analysis-analyze-code-patterns' },
    { pattern: /评审|review|code.?review/i, name: 'review', tool: 'gemini', mode: 'analysis', rule: 'analysis-review-code-quality' },
    { pattern: /诊断|debug|排查|diagnose/i, name: 'diagnose', tool: 'gemini', mode: 'analysis', rule: 'analysis-diagnose-bug-root-cause' },
    { pattern: /安全|security|漏洞|vulnerability/i, name: 'security-audit', tool: 'gemini', mode: 'analysis', rule: 'analysis-assess-security-risks' },
    { pattern: /性能|performance|perf/i, name: 'perf-analysis', tool: 'gemini', mode: 'analysis', rule: 'analysis-analyze-performance' },
    { pattern: /架构|architecture/i, name: 'arch-review', tool: 'gemini', mode: 'analysis', rule: 'analysis-review-architecture' },
    { pattern: /修复|fix|repair|解决/i, name: 'fix', tool: 'claude', mode: 'write', rule: 'development-debug-runtime-issues' },
    { pattern: /实现|implement|开发|create|新增/i, name: 'implement', tool: 'claude', mode: 'write', rule: 'development-implement-feature' },
    { pattern: /重构|refactor/i, name: 'refactor', tool: 'claude', mode: 'write', rule: 'development-refactor-codebase' },
    { pattern: /测试|test|generate.?test/i, name: 'test', tool: 'claude', mode: 'write', rule: 'development-generate-tests' },
    { pattern: /规划|plan|设计|design/i, name: 'plan', tool: 'gemini', mode: 'analysis', rule: 'planning-plan-architecture-design' },
    { pattern: /拆解|breakdown|分解/i, name: 'breakdown', tool: 'gemini', mode: 'analysis', rule: 'planning-breakdown-task-steps' },
  ];

  // Segment input by Chinese/English delimiters: 、，,；然后/接着/最后/之后 etc.
  const segments = naturalLanguageInput
    .split(/[，,；;、]|(?:然后|接着|之后|最后|再|并|and then|then|finally|next)\s*/i)
    .map(s => s.trim())
    .filter(Boolean);

  // Match each segment to an intent (with ambiguity resolution)
  steps = segments.map((segment, i) => {
    const allMatches = intentMap.filter(m => m.pattern.test(segment));
    let matched = allMatches[0] || null;

    // ★ Ambiguity resolution: if multiple intents match, ask user
    if (allMatches.length > 1) {
      const disambig = AskUserQuestion({
        questions: [{
          question: `"${segment}" 匹配到多个意图，请选择最符合的：`,
          header: `Disambiguate Step ${i + 1}`,
          multiSelect: false,
          options: allMatches.map(m => ({
            label: m.name,
            description: `Tool: ${m.tool}, Mode: ${m.mode}, Rule: ${m.rule}`
          }))
        }]
      });
      const chosen = disambig[`Disambiguate Step ${i + 1}`];
      matched = allMatches.find(m => m.name === chosen) || allMatches[0];
    }

    if (matched) {
      // Extract target scope from segment (e.g., "分析 src 目录" → scope = "src")
      const scopeMatch = segment.match(/(?:目录|文件|模块|directory|file|module)?\s*[：:]?\s*(\S+)/);
      const scope = scopeMatch ? scopeMatch[1].replace(/[的地得]$/, '') : '**/*';

      return {
        name: `${matched.name}`,
        type: 'ccw-cli',
        command: `ccw cli -p "${segment}" --tool ${matched.tool} --mode ${matched.mode} --rule ${matched.rule}`,
        tool: matched.tool,
        mode: matched.mode,
        rule: matched.rule,
        original_text: segment,
        expected_artifacts: [],
        success_criteria: ''
      };
    } else {
      // Unmatched segment → generic analysis step
      return {
        name: `step-${i + 1}`,
        type: 'ccw-cli',
        command: `ccw cli -p "${segment}" --tool gemini --mode analysis`,
        tool: 'gemini',
        mode: 'analysis',
        rule: 'universal-rigorous-style',
        original_text: segment,
        expected_artifacts: [],
        success_criteria: ''
      };
    }
  });

  // Deduplicate: if same intent name appears twice, suffix with index
  const nameCount = {};
  steps.forEach(s => {
    nameCount[s.name] = (nameCount[s.name] || 0) + 1;
    if (nameCount[s.name] > 1) {
      s.name = `${s.name}-${nameCount[s.name]}`;
    }
  });

  // Set workflow context from the full natural language input
  if (!workflowContext) {
    workflowContext = naturalLanguageInput;
  }
  workflowName = 'nl-workflow';  // natural language derived
}
```

### Step 1.1c: Generate Command Document

Generate a formatted execution plan for user review. This runs for ALL input formats, not just Format 4.

```javascript
function generateCommandDoc(steps, workflowName, workflowContext, analysisDepth) {
  const stepTable = steps.map((s, i) => {
    const tool = s.tool || (s.type === 'skill' ? '-' : 'claude');
    const mode = s.mode || (s.type === 'skill' ? '-' : 'write');
    const cmdPreview = s.command.length > 60 ? s.command.substring(0, 57) + '...' : s.command;
    return `| ${i + 1} | ${s.name} | ${s.type} | \`${cmdPreview}\` | ${tool} | ${mode} |`;
  }).join('\n');

  const flowDiagram = steps.map((s, i) => {
    const arrow = i < steps.length - 1 ? '\n     ↓' : '';
    const feedsInto = i < steps.length - 1 ? `Feeds into: Step ${i + 2} (${steps[i + 1].name})` : 'Final step';
    const originalText = s.original_text ? `\n  Source: "${s.original_text}"` : '';
    return `Step ${i + 1}: ${s.name}
  Command: ${s.command}
  Type: ${s.type} | Tool: ${s.tool || '-'} | Mode: ${s.mode || '-'}${originalText}
  ${feedsInto}${arrow}`;
  }).join('\n');

  const totalCli = steps.filter(s => s.type === 'ccw-cli').length;
  const totalSkill = steps.filter(s => s.type === 'skill').length;
  const totalCmd = steps.filter(s => s.type === 'command').length;

  return `# Workflow Tune — Execution Plan

**Workflow**: ${workflowName}
**Goal**: ${workflowContext}
**Steps**: ${steps.length}
**Analysis Depth**: ${analysisDepth}

## Step Chain

| # | Name | Type | Command | Tool | Mode |
|---|------|------|---------|------|------|
${stepTable}

## Execution Flow

\`\`\`
${flowDiagram}
\`\`\`

## Estimated Scope

- CLI execute calls: ${totalCli}
- Skill invocations: ${totalSkill}
- Shell commands: ${totalCmd}
- Analysis calls (gemini --resume chain): ${steps.length} (per-step) + 1 (synthesis)
- Process documentation: process-log.md (accumulated)
- Final output: final-report.md with optimization recommendations
`;
}

const commandDoc = generateCommandDoc(steps, workflowName, workflowContext, workflowPreferences.analysisDepth);

// Output command document to user (direct text output)
// The orchestrator displays this as formatted text before confirmation
```

### Step 1.1d: Pre-Execution Confirmation

```javascript
// ★ Skip confirmation if -y/--yes auto mode
if (!workflowPreferences.autoYes) {
  // Display commandDoc to user as formatted text output
  // Then ask for confirmation

  const confirmation = AskUserQuestion({
    questions: [{
      question: "确认执行以上 Workflow 调优计划？",
      header: "Confirm Execution",
      multiSelect: false,
      options: [
        { label: "Execute (确认执行)", description: "按计划开始执行所有步骤" },
        { label: "Edit steps (修改步骤)", description: "调整步骤顺序、增删步骤、更换工具" },
        { label: "Cancel (取消)", description: "取消本次调优" }
      ]
    }]
  });

  const choice = confirmation["Confirm Execution"];

  if (choice.startsWith("Cancel")) {
    // Abort: no workspace created, no state written
    // Output: "Workflow tune cancelled."
    return;
  }

  if (choice.startsWith("Edit")) {
    // Enter edit loop: ask user what to change, apply, re-display, re-confirm
    let editing = true;
    while (editing) {
      const editResponse = AskUserQuestion({
        questions: [{
          question: "请描述要修改的内容：\n" +
            "  - 删除步骤: '删除步骤2' 或 'remove step 2'\n" +
            "  - 添加步骤: '在步骤1后加入安全扫描' 或 'add security scan after step 1'\n" +
            "  - 修改工具: '步骤3改用codex' 或 'step 3 use codex'\n" +
            "  - 调换顺序: '步骤2和步骤3互换' 或 'swap step 2 and 3'\n" +
            "  - 修改命令: '步骤1命令改为 ccw cli -p \"...\" --tool gemini'",
          header: "Edit Steps"
        }]
      });

      const editText = editResponse["Edit Steps"];

      // Apply edits to steps[] based on user instruction
      // The orchestrator interprets the edit instruction and modifies steps:
      //
      // Delete: filter out the specified step, re-index
      // Add: insert new step at specified position
      // Modify tool: update the step's tool/mode/command
      // Swap: exchange positions of two steps
      // Modify command: replace command string
      //
      // After applying edits, re-generate command doc and re-display

      const updatedCommandDoc = generateCommandDoc(steps, workflowName, workflowContext, workflowPreferences.analysisDepth);
      // Display updatedCommandDoc to user

      const reconfirm = AskUserQuestion({
        questions: [{
          question: "修改后的计划如上，是否确认？",
          header: "Confirm Execution",
          multiSelect: false,
          options: [
            { label: "Execute (确认执行)", description: "按修改后的计划执行" },
            { label: "Edit more (继续修改)", description: "还需要调整" },
            { label: "Cancel (取消)", description: "取消本次调优" }
          ]
        }]
      });

      const reChoice = reconfirm["Confirm Execution"];
      if (reChoice.startsWith("Execute")) {
        editing = false;
      } else if (reChoice.startsWith("Cancel")) {
        return;  // Abort
      }
      // else: continue editing loop
    }
  }

  // choice === "Execute" → proceed to workspace creation
}

// Save command doc for reference
// Will be written to workspace after Step 1.3
```

### Step 1.2: Validate Steps

```javascript
for (const step of steps) {
  if (step.type === 'skill' && step.skill_path) {
    const skillFiles = Glob(`${step.skill_path}/SKILL.md`);
    if (skillFiles.length === 0) {
      step.validation = 'warning';
      step.validation_msg = `Skill not found: ${step.skill_path}`;
    } else {
      step.validation = 'ok';
    }
  } else {
    // Command-type steps: basic validation (non-empty)
    step.validation = step.command && step.command.trim() ? 'ok' : 'invalid';
  }
}

const invalidSteps = steps.filter(s => s.validation === 'invalid');
if (invalidSteps.length > 0) {
  throw new Error(`Invalid steps: ${invalidSteps.map(s => s.name).join(', ')}`);
}
```

### Step 1.2b: Generate Test Requirements (Acceptance Criteria)

> 调优的前提：为每一步生成跟任务匹配的验收标准。没有预期基准，就无法判断命令执行是否达标。

用 Gemini 根据 step command + workflow context + 上下游关系，自动推断每步的验收标准。

```javascript
// Build step chain description for context
const stepChainDesc = steps.map((s, i) =>
  `Step ${i + 1}: ${s.name} (${s.type}) — ${s.command}`
).join('\n');

const reqGenPrompt = `PURPOSE: Generate concrete acceptance criteria (test requirements) for each step in a workflow pipeline. These criteria will be used to objectively judge whether each step's execution succeeded or failed.

WORKFLOW:
Name: ${workflowName}
Goal: ${workflowContext}

STEP CHAIN:
${stepChainDesc}

TASK:
For each step, generate:
1. **expected_outputs** — what files/artifacts should be produced (specific filenames or patterns)
2. **content_signals** — what content patterns indicate success (keywords, structures, data shapes)
3. **quality_thresholds** — minimum quality bar (e.g., "no empty files", "JSON must be parseable", "must contain at least N items")
4. **pass_criteria** — 1-2 sentence description of what "pass" looks like for this step
5. **fail_signals** — what patterns indicate failure (error messages, empty output, wrong format)
6. **handoff_contract** — what this step must provide for the next step to work (data format, required fields)

CONTEXT RULES:
- Infer from the command what the step is supposed to do
- Consider workflow goal when judging what "good enough" means
- Each step's handoff_contract should match what the next step needs as input
- Be specific: "report.md with ## Summary section" not "a report file"

EXPECTED OUTPUT (strict JSON, no markdown):
{
  "step_requirements": [
    {
      "step_index": 0,
      "step_name": "<name>",
      "expected_outputs": ["<file or pattern>"],
      "content_signals": ["<keyword or pattern that indicates success>"],
      "quality_thresholds": ["<minimum bar>"],
      "pass_criteria": "<what pass looks like>",
      "fail_signals": ["<pattern that indicates failure>"],
      "handoff_contract": "<what next step needs from this step>"
    }
  ]
}

CONSTRAINTS: Be specific to each command, output ONLY JSON`;

Bash({
  command: `ccw cli -p "${escapeForShell(reqGenPrompt)}" --tool gemini --mode analysis --rule universal-rigorous-style`,
  run_in_background: true,
  timeout: 300000
});

// STOP — wait for hook callback
// After callback: parse JSON, attach requirements to each step

const reqOutput = /* CLI output from callback */;
const reqJsonMatch = reqOutput.match(/\{[\s\S]*\}/);

if (reqJsonMatch) {
  try {
    const reqData = JSON.parse(reqJsonMatch[0]);
    (reqData.step_requirements || []).forEach(req => {
      const idx = req.step_index;
      if (idx >= 0 && idx < steps.length) {
        steps[idx].test_requirements = {
          expected_outputs: req.expected_outputs || [],
          content_signals: req.content_signals || [],
          quality_thresholds: req.quality_thresholds || [],
          pass_criteria: req.pass_criteria || '',
          fail_signals: req.fail_signals || [],
          handoff_contract: req.handoff_contract || ''
        };
      }
    });
  } catch (e) {
    // Fallback: proceed without generated requirements
    // Steps will use any manually provided success_criteria
  }
}

// Capture session ID for resume chain start
const reqSessionMatch = reqOutput.match(/\[CCW_EXEC_ID=([^\]]+)\]/);
const reqSessionId = reqSessionMatch ? reqSessionMatch[1] : null;
```

### Step 1.3: Create Workspace

```javascript
const ts = Date.now();
const workDir = `.workflow/.scratchpad/workflow-tune-${ts}`;

Bash(`mkdir -p "${workDir}/steps"`);

// Create per-step directories
for (let i = 0; i < steps.length; i++) {
  Bash(`mkdir -p "${workDir}/steps/step-${i + 1}/artifacts"`);
}
```

### Step 1.3b: Save Command Document

```javascript
// Save confirmed command doc to workspace for reference
Write(`${workDir}/command-doc.md`, commandDoc);
```

### Step 1.4: Initialize State

```javascript
const initialState = {
  status: 'running',
  started_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  workflow_name: workflowName,
  workflow_context: workflowContext,
  analysis_depth: workflowPreferences.analysisDepth,
  auto_fix: workflowPreferences.autoFix,
  steps: steps.map((s, i) => ({
    ...s,
    index: i,
    status: 'pending',
    execution: null,
    analysis: null,
    test_requirements: s.test_requirements || null  // from Step 1.2b
  })),
  analysis_session_id: reqSessionId || null,  // resume chain starts from requirements generation
  process_log_entries: [],
  synthesis: null,
  errors: [],
  error_count: 0,
  max_errors: 3,
  work_dir: workDir
};

Write(`${workDir}/workflow-state.json`, JSON.stringify(initialState, null, 2));
```

### Step 1.5: Initialize Process Log

```javascript
const processLog = `# Workflow Tune Process Log

**Workflow**: ${workflowName}
**Context**: ${workflowContext}
**Steps**: ${steps.length}
**Analysis Depth**: ${workflowPreferences.analysisDepth}
**Started**: ${new Date().toISOString()}

---

`;

Write(`${workDir}/process-log.md`, processLog);
```

## Output

- **Variables**: `workDir`, `steps[]`, `workflowContext`, `commandDoc`, initialized state
- **Files**: `workflow-state.json`, `process-log.md`, `command-doc.md`, per-step directories
- **User Confirmation**: Execution plan confirmed (or cancelled → abort)
- **TaskUpdate**: Mark Phase 1 completed, start Step Loop
