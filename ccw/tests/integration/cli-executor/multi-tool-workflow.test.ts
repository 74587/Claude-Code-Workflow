/**
 * Integration tests for cli-executor: qwen/codex and multi-tool scenarios.
 *
 * Notes:
 * - Targets the runtime implementation shipped in `ccw/dist`.
 * - Uses stub CLI shims (gemini/qwen/codex) to avoid external dependencies.
 */

import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

import {
  closeCliHistoryStores,
  makeEnhancedPrompt,
  setupTestEnv,
  setupTestProject,
  validateExecutionResult,
  type CliToolName,
  type TestEnv,
  type TestProject,
} from './setup.ts';

const cliExecutorUrl = new URL('../../../dist/tools/cli-executor.js', import.meta.url);
cliExecutorUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cliExecutor: any;

let env: TestEnv;
let project: TestProject;

function parseFirstJsonLine(text: string): any {
  const line = text.split(/\r?\n/).find((l) => l.trim().length > 0);
  return JSON.parse(line || '{}');
}

function normalizeSlash(value: string): string {
  return value.replace(/\\/g, '/');
}

async function executeWithFallback(params: {
  prompt: string;
  mode: 'analysis' | 'write' | 'auto';
  model?: string;
  cd: string;
  includeDirs?: string;
  timeout?: number;
}): Promise<{ attempts: Array<{ tool: CliToolName; success: boolean }>; result: any }> {
  const attempts: Array<{ tool: CliToolName; success: boolean }> = [];
  const tools: CliToolName[] = ['gemini', 'qwen', 'codex'];

  let last: any = null;
  for (const tool of tools) {
    const res = await cliExecutor.executeCliTool({ tool, ...params });
    last = res;
    attempts.push({ tool, success: Boolean(res?.success) });
    if (res?.success) return { attempts, result: res };
  }

  return { attempts, result: last };
}

function selectToolForTask(task: { intent: string; complexity: 'low' | 'medium' | 'high' }): CliToolName {
  const intent = task.intent.toLowerCase();
  if (intent.includes('implement') || intent.includes('refactor') || task.complexity === 'high') return 'codex';
  if (intent.includes('analyze') || intent.includes('explain') || intent.includes('plan')) return 'gemini';
  return 'qwen';
}

describe('cli-executor integration: qwen/codex + multi-tool', () => {
  before(async () => {
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
    cliExecutor = await import(cliExecutorUrl.href);
  });

  beforeEach(() => {
    cliExecutor?.clearToolCache?.();
    env = setupTestEnv(['gemini', 'qwen', 'codex']);
    project = setupTestProject();
  });

  afterEach(async () => {
    await closeCliHistoryStores();
    env.restore();
    env.cleanup();
    project.cleanup();
  });

  after(() => {
    mock.restoreAll();
  });

  it('qwen analysis mode passes -m model and no approval flag', async () => {
    const prompt = makeEnhancedPrompt({
      purpose: 'Qwen analysis',
      task: 'Inspect code',
      mode: 'analysis',
      context: '@src/**/*.ts',
      expected: 'OK',
      rules: 'analysis=READ-ONLY',
    });

    const res = await cliExecutor.executeCliTool({
      tool: 'qwen',
      prompt,
      mode: 'analysis',
      model: 'qwen-test-model',
      cd: project.projectDir,
    });

    validateExecutionResult(res, { success: true, tool: 'qwen' });
    const payload = parseFirstJsonLine(res.stdout);
    assert.ok(payload.args.includes('-m'));
    assert.ok(payload.args.includes('qwen-test-model'));
    assert.equal(payload.args.includes('--approval-mode'), false);
  });

  it('qwen write mode includes --approval-mode yolo', async () => {
    const prompt = makeEnhancedPrompt({
      purpose: 'Qwen write',
      task: 'Create file',
      mode: 'write',
      context: '@src/index.ts',
      expected: 'file written',
      rules: 'write=CREATE',
      directives: { write_files: { 'qwen.txt': 'hello' } },
    });

    const res = await cliExecutor.executeCliTool({
      tool: 'qwen',
      prompt,
      mode: 'write',
      model: 'qwen-test-model',
      cd: project.projectDir,
    });

    validateExecutionResult(res, { success: true, tool: 'qwen' });
    const payload = parseFirstJsonLine(res.stdout);
    assert.ok(payload.args.includes('--approval-mode'));
    assert.ok(payload.args.includes('yolo'));
    assert.ok(payload.wrote_files.includes('qwen.txt'));
  });

  it('qwen includeDirs maps to --include-directories', async () => {
    const prompt = makeEnhancedPrompt({
      purpose: 'Qwen includeDirs',
      task: 'Resolve shared files',
      mode: 'analysis',
      context: '@../shared/**/*',
      expected: 'Resolved shared files list',
      rules: 'analysis=READ-ONLY',
      directives: { resolve_patterns: true },
    });

    const res = await cliExecutor.executeCliTool({
      tool: 'qwen',
      prompt,
      mode: 'analysis',
      model: 'qwen-test-model',
      cd: project.projectDir,
      includeDirs: '../shared',
    });

    const payload = parseFirstJsonLine(res.stdout);
    assert.ok(payload.args.includes('--include-directories'));
    assert.ok(payload.args.includes('../shared'));
    assert.ok(payload.resolved_files.some((p: string) => String(p).startsWith('../shared/')));
  });

  it('qwen resume=true uses native --continue', async () => {
    const prompt = makeEnhancedPrompt({
      purpose: 'Qwen resume latest',
      task: 'Use native resume',
      mode: 'analysis',
      context: '@src/index.ts',
      expected: 'Args include --continue',
      rules: 'analysis=READ-ONLY',
    });

    const res = await cliExecutor.executeCliTool({
      tool: 'qwen',
      prompt,
      mode: 'analysis',
      model: 'qwen-test-model',
      cd: project.projectDir,
      resume: true,
    });

    const payload = parseFirstJsonLine(res.stdout);
    assert.ok(payload.args.includes('--continue'));
  });

  it('qwen noNative=true disables native resume flags', async () => {
    const prompt = makeEnhancedPrompt({
      purpose: 'Qwen resume disabled',
      task: 'Force prompt concat',
      mode: 'analysis',
      context: '@src/index.ts',
      expected: 'No --continue flag',
      rules: 'analysis=READ-ONLY',
    });

    const res = await cliExecutor.executeCliTool({
      tool: 'qwen',
      prompt,
      mode: 'analysis',
      model: 'qwen-test-model',
      cd: project.projectDir,
      resume: true,
      noNative: true,
    });

    const payload = parseFirstJsonLine(res.stdout);
    assert.equal(payload.args.includes('--continue'), false);
    assert.equal(payload.args.includes('--resume'), false);
  });

  it('codex analysis mode uses exec + --full-auto and reads prompt from stdin (-)', async () => {
    const prompt = makeEnhancedPrompt({
      purpose: 'Codex analysis',
      task: 'Read-only review',
      mode: 'analysis',
      context: '@src/index.ts',
      expected: 'OK',
      rules: 'analysis=READ-ONLY',
    });

    const res = await cliExecutor.executeCliTool({
      tool: 'codex',
      prompt,
      mode: 'analysis',
      model: 'codex-test-model',
      cd: project.projectDir,
    });

    validateExecutionResult(res, { success: true, tool: 'codex' });
    const payload = parseFirstJsonLine(res.stdout);
    assert.deepEqual(payload.args.slice(0, 2), ['exec', '--full-auto']);
    assert.equal(payload.args.includes('--dangerously-bypass-approvals-and-sandbox'), false);
    assert.equal(payload.args.at(-1), '-');
    assert.ok(String(payload.prompt).includes('PURPOSE: Codex analysis'));
    assert.equal(payload.args.join(' ').includes('PURPOSE: Codex analysis'), false);
  });

  it('codex write mode uses --dangerously-bypass-approvals-and-sandbox', async () => {
    const prompt = makeEnhancedPrompt({
      purpose: 'Codex write',
      task: 'Write file',
      mode: 'write',
      context: '@src/index.ts',
      expected: 'file written',
      rules: 'write=CREATE',
      directives: { write_files: { 'codex.txt': 'hello' } },
    });

    const res = await cliExecutor.executeCliTool({
      tool: 'codex',
      prompt,
      mode: 'write',
      model: 'codex-test-model',
      cd: project.projectDir,
    });

    const payload = parseFirstJsonLine(res.stdout);
    assert.equal(payload.args[0], 'exec');
    assert.ok(payload.args.includes('--dangerously-bypass-approvals-and-sandbox'));
    assert.ok(payload.wrote_files.includes('codex.txt'));
  });

  it('codex auto mode uses --dangerously-bypass-approvals-and-sandbox', async () => {
    const prompt = makeEnhancedPrompt({
      purpose: 'Codex auto',
      task: 'Autonomous execution',
      mode: 'auto',
      context: '@src/index.ts',
      expected: 'OK',
      rules: 'auto=ALLOW',
    });

    const res = await cliExecutor.executeCliTool({
      tool: 'codex',
      prompt,
      mode: 'auto',
      model: 'codex-test-model',
      cd: project.projectDir,
    });

    const payload = parseFirstJsonLine(res.stdout);
    assert.ok(payload.args.includes('--dangerously-bypass-approvals-and-sandbox'));
  });

  it('codex includeDirs maps to repeated --add-dir flags', async () => {
    const prompt = makeEnhancedPrompt({
      purpose: 'Codex includeDirs',
      task: 'Resolve shared files',
      mode: 'analysis',
      context: '@../shared/**/*',
      expected: 'Resolved shared files list',
      rules: 'analysis=READ-ONLY',
      directives: { resolve_patterns: true },
    });

    const res = await cliExecutor.executeCliTool({
      tool: 'codex',
      prompt,
      mode: 'analysis',
      model: 'codex-test-model',
      cd: project.projectDir,
      includeDirs: '../shared,../shared', // duplicates should still map to flags
    });

    const payload = parseFirstJsonLine(res.stdout);
    const addDirCount = payload.args.filter((a: string) => a === '--add-dir').length;
    assert.ok(addDirCount >= 1);
    assert.ok(payload.resolved_files.some((p: string) => String(p).startsWith('../shared/')));
  });

  it('codex resume=true uses `resume --last` and respects analysis permissions', async () => {
    const prompt = makeEnhancedPrompt({
      purpose: 'Codex resume latest',
      task: 'Use native resume',
      mode: 'analysis',
      context: '@src/index.ts',
      expected: 'Args include resume --last',
      rules: 'analysis=READ-ONLY',
    });

    const res = await cliExecutor.executeCliTool({
      tool: 'codex',
      prompt,
      mode: 'analysis',
      model: 'codex-test-model',
      cd: project.projectDir,
      resume: true,
    });

    const payload = parseFirstJsonLine(res.stdout);
    assert.equal(payload.args[0], 'resume');
    assert.ok(payload.args.includes('--last'));
    assert.ok(payload.args.includes('--full-auto'));
    assert.equal(payload.args.includes('--dangerously-bypass-approvals-and-sandbox'), false);
  });

  it('working directory is isolated per execution via --cd', async () => {
    const prompt = makeEnhancedPrompt({
      purpose: 'Working directory',
      task: 'Echo cwd',
      mode: 'analysis',
      context: '@src/index.ts',
      expected: 'cwd matches',
      rules: 'analysis=READ-ONLY',
    });

    const res = await cliExecutor.executeCliTool({
      tool: 'qwen',
      prompt,
      mode: 'analysis',
      model: 'qwen-test-model',
      cd: project.projectDir,
    });

    const payload = parseFirstJsonLine(res.stdout);
    assert.equal(payload.cwd, normalizeSlash(project.projectDir));
  });

  it('model override is passed as -m for codex', async () => {
    const prompt = makeEnhancedPrompt({
      purpose: 'Model override',
      task: 'Use model',
      mode: 'analysis',
      context: '@src/index.ts',
      expected: 'args include -m',
      rules: 'analysis=READ-ONLY',
    });

    const res = await cliExecutor.executeCliTool({
      tool: 'codex',
      prompt,
      mode: 'analysis',
      model: 'codex-model-override',
      cd: project.projectDir,
    });

    const payload = parseFirstJsonLine(res.stdout);
    const idx = payload.args.indexOf('-m');
    assert.ok(idx >= 0);
    assert.equal(payload.args[idx + 1], 'codex-model-override');
  });

  it('non-zero exit with output and no fatal stderr is treated as success (qwen)', async () => {
    const prompt = makeEnhancedPrompt({
      purpose: 'Non-fatal exit',
      task: 'exit=1 without fatal stderr',
      mode: 'analysis',
      context: '@src/index.ts',
      expected: 'success',
      rules: 'analysis=READ-ONLY',
      directives: { exit_code: 1 },
    });

    const res = await cliExecutor.executeCliTool({
      tool: 'qwen',
      prompt,
      mode: 'analysis',
      model: 'qwen-test-model',
      cd: project.projectDir,
    });

    assert.equal(res.success, true);
    assert.equal(res.execution.status, 'success');
  });

  it('rate limit exceeded is treated as fatal error', async () => {
    const prompt = makeEnhancedPrompt({
      purpose: 'Fatal exit',
      task: 'stderr contains rate limit exceeded',
      mode: 'analysis',
      context: '@src/index.ts',
      expected: 'error',
      rules: 'analysis=READ-ONLY',
      directives: { exit_code: 1, stderr: 'rate limit exceeded\n' },
    });

    const res = await cliExecutor.executeCliTool({
      tool: 'qwen',
      prompt,
      mode: 'analysis',
      model: 'qwen-test-model',
      cd: project.projectDir,
    });

    assert.equal(res.success, false);
    assert.equal(res.execution.status, 'error');
  });

  it('fallback chain: gemini fatal error -> qwen success', async () => {
    const prompt = makeEnhancedPrompt({
      purpose: 'Fallback test',
      task: 'Try tools in order',
      mode: 'analysis',
      context: '@src/index.ts',
      expected: 'qwen used',
      rules: 'analysis=READ-ONLY',
      directives: {
        tool_overrides: {
          gemini: { exit_code: 1, stderr: 'FATAL: Authentication failed: API key\n' },
        },
      },
    });

    const { attempts, result } = await executeWithFallback({
      prompt,
      mode: 'analysis',
      model: 'test-model',
      cd: project.projectDir,
    });

    assert.deepEqual(attempts.map((a) => a.tool), ['gemini', 'qwen']);
    assert.equal(attempts[0].success, false);
    assert.equal(attempts[1].success, true);
    assert.equal(result.execution.tool, 'qwen');
  });

  it('fallback chain: gemini fail + qwen fail -> codex success', async () => {
    const prompt = makeEnhancedPrompt({
      purpose: 'Fallback test 2',
      task: 'Try tools in order',
      mode: 'analysis',
      context: '@src/index.ts',
      expected: 'codex used',
      rules: 'analysis=READ-ONLY',
      directives: {
        tool_overrides: {
          gemini: { exit_code: 1, stderr: 'FATAL: rate limit exceeded\n' },
          qwen: { exit_code: 1, stderr: 'FATAL: rate limit exceeded\n' },
        },
      },
    });

    const { attempts, result } = await executeWithFallback({
      prompt,
      mode: 'analysis',
      model: 'test-model',
      cd: project.projectDir,
    });

    assert.deepEqual(attempts.map((a) => a.tool), ['gemini', 'qwen', 'codex']);
    assert.equal(attempts[0].success, false);
    assert.equal(attempts[1].success, false);
    assert.equal(attempts[2].success, true);
    assert.equal(result.execution.tool, 'codex');
  });

  it('tool selection heuristic chooses expected tool for 5+ task types', () => {
    const cases: Array<{ intent: string; complexity: 'low' | 'medium' | 'high'; expected: CliToolName }> = [
      { intent: 'analyze architecture', complexity: 'low', expected: 'gemini' },
      { intent: 'explain error', complexity: 'medium', expected: 'gemini' },
      { intent: 'plan migration steps', complexity: 'medium', expected: 'gemini' },
      { intent: 'implement new feature', complexity: 'medium', expected: 'codex' },
      { intent: 'refactor core module', complexity: 'high', expected: 'codex' },
      { intent: 'summarize notes', complexity: 'low', expected: 'qwen' },
    ];

    for (const c of cases) {
      assert.equal(selectToolForTask({ intent: c.intent, complexity: c.complexity }), c.expected);
    }
  });

  it('compares enhanced prompt parsing across gemini/qwen/codex for consistency', async () => {
    const prompt = makeEnhancedPrompt({
      purpose: 'Compare tools',
      task: 'Parse enhanced prompt',
      mode: 'analysis',
      context: '@src/index.ts',
      expected: 'same parsed fields',
      rules: 'analysis=READ-ONLY',
    });

    const results = await Promise.all(
      (['gemini', 'qwen', 'codex'] as CliToolName[]).map((tool) =>
        cliExecutor.executeCliTool({ tool, prompt, mode: 'analysis', model: 'm', cd: project.projectDir }),
      ),
    );

    const payloads = results.map((r) => parseFirstJsonLine(r.stdout));
    const parsed = payloads.map((p) => p.parsed);

    assert.deepEqual(parsed[0], parsed[1]);
    assert.deepEqual(parsed[1], parsed[2]);
  });

  it('parallel execution returns results from at least two tools', async () => {
    const projectA = setupTestProject();
    const projectB = setupTestProject();
    try {
      const prompt = makeEnhancedPrompt({
        purpose: 'Parallel',
        task: 'Run two tools',
        mode: 'analysis',
        context: '@src/index.ts',
        expected: 'two results',
        rules: 'analysis=READ-ONLY',
      });

      const [geminiRes, codexRes] = await Promise.all([
        cliExecutor.executeCliTool({ tool: 'gemini', prompt, mode: 'analysis', model: 'm', cd: projectA.projectDir }),
        cliExecutor.executeCliTool({ tool: 'codex', prompt, mode: 'analysis', model: 'm', cd: projectB.projectDir }),
      ]);

      assert.equal(geminiRes.success, true);
      assert.equal(codexRes.success, true);
      assert.equal(geminiRes.execution.tool, 'gemini');
      assert.equal(codexRes.execution.tool, 'codex');
    } finally {
      await closeCliHistoryStores();
      projectA.cleanup();
      projectB.cleanup();
    }
  });

  it('stdin vs args: gemini/qwen do not use "-" marker, codex does', async () => {
    const prompt = makeEnhancedPrompt({
      purpose: 'stdin vs args',
      task: 'Validate prompt delivery mechanism',
      mode: 'analysis',
      context: '@src/index.ts',
      expected: 'codex uses -',
      rules: 'analysis=READ-ONLY',
    });

    const [geminiRes, qwenRes, codexRes] = await Promise.all([
      cliExecutor.executeCliTool({ tool: 'gemini', prompt, mode: 'analysis', model: 'm', cd: project.projectDir }),
      cliExecutor.executeCliTool({ tool: 'qwen', prompt, mode: 'analysis', model: 'm', cd: project.projectDir }),
      cliExecutor.executeCliTool({ tool: 'codex', prompt, mode: 'analysis', model: 'm', cd: project.projectDir }),
    ]);

    const geminiArgs = parseFirstJsonLine(geminiRes.stdout).args;
    const qwenArgs = parseFirstJsonLine(qwenRes.stdout).args;
    const codexArgs = parseFirstJsonLine(codexRes.stdout).args;

    assert.equal(geminiArgs.includes('-'), false);
    assert.equal(qwenArgs.includes('-'), false);
    assert.equal(codexArgs.at(-1), '-');
  });
});
