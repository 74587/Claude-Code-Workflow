/**
 * End-to-end orchestration validation tests for cli-executor.
 *
 * Scope: validate a 5-phase workflow:
 * 1) Task Understanding
 * 2) Context Discovery
 * 3) Prompt Enhancement
 * 4) Tool Selection
 * 5) Tool Execution + Output Routing
 *
 * Notes:
 * - Targets the runtime implementation shipped in `ccw/dist`.
 * - Uses stub CLI shims for gemini/qwen/codex.
 * - Stubs LiteLLM Python spawn for endpoint routing.
 */

import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

import {
  closeCliHistoryStores,
  makeEnhancedPrompt,
  setupTestEnv,
  setupTestProject,
  type CliToolName,
  type TestEnv,
  type TestProject,
} from './setup.ts';

// --- LiteLLM spawn stub (intercepts `python -m ccw_litellm.cli ...`) ---

type SpawnBehavior =
  | { type: 'close'; code?: number; stdout?: string; stderr?: string }
  | { type: 'error'; error: Error }
  | { type: 'hang' };

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;

  kill(): boolean {
    this.killed = true;
    return true;
  }
}

const litellmSpawnPlan: SpawnBehavior[] = [];

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const childProcess = require('child_process') as typeof import('child_process');
const originalSpawn = childProcess.spawn;

childProcess.spawn = ((command: string, args: string[] = [], options: any = {}) => {
  const normalizedArgs = (args ?? []).map(String);
  const shouldIntercept = normalizedArgs[0] === '-m' && normalizedArgs[1] === 'ccw_litellm.cli';
  if (!shouldIntercept) {
    return originalSpawn(command as any, args as any, options as any);
  }

  const proc = new FakeChildProcess();
  const next = litellmSpawnPlan.shift() ?? { type: 'close', code: 0, stdout: 'OK' };

  queueMicrotask(() => {
    if (next.type === 'error') {
      proc.emit('error', next.error);
      return;
    }
    if (next.type === 'close') {
      if (next.stdout !== undefined) proc.stdout.emit('data', next.stdout);
      if (next.stderr !== undefined) proc.stderr.emit('data', next.stderr);
      proc.emit('close', next.code ?? 0);
      return;
    }
    // hang: intentionally do nothing
  });

  return proc as any;
}) as any;

// --- Orchestrator helpers (test-only) ---

type Intent = 'analyze' | 'plan' | 'execute' | 'other';
type Complexity = 'low' | 'medium' | 'high';

function understandTask(input: string): { intent: Intent; complexity: Complexity; keywords: string[] } {
  const text = input.toLowerCase();
  const keywords = Array.from(new Set(text.split(/[^a-z0-9_]+/g).filter((t) => t.length >= 4))).slice(0, 8);

  const intent: Intent = text.includes('implement') || text.includes('refactor') || text.includes('fix')
    ? 'execute'
    : text.includes('analy') || text.includes('explain')
      ? 'analyze'
      : text.includes('plan')
        ? 'plan'
        : 'other';

  const complexity: Complexity =
    text.includes('migration') || text.includes('refactor') || text.length > 160 ? 'high' : text.length > 80 ? 'medium' : 'low';

  return { intent, complexity, keywords };
}

function selectTool(understood: { intent: Intent; complexity: Complexity }): CliToolName {
  if (understood.intent === 'execute' || understood.complexity === 'high') return 'codex';
  if (understood.intent === 'analyze' || understood.intent === 'plan') return 'gemini';
  return 'qwen';
}

function discoverContextFiles(projectDir: string, patterns: string[], includeDirs?: string[]): string[] {
  const { globSync } = require('glob') as typeof import('glob');
  const allow = new Set((includeDirs || []).map(String));

  const files = new Set<string>();
  for (const raw of patterns) {
    const pattern = raw.startsWith('@') ? raw.slice(1) : raw;
    const outside = pattern.startsWith('../');
    if (outside) {
      const allowed = Array.from(allow).some((d) => pattern === d || pattern.startsWith(`${d}/`));
      if (!allowed) continue;
    }
    for (const match of globSync(pattern, { cwd: projectDir, nodir: true, dot: true, windowsPathsNoEscape: true })) {
      files.add(String(match).replace(/\\/g, '/'));
    }
  }
  return Array.from(files).sort();
}

function routeOutput(execResult: any): { ok: boolean; tool: string; status: string; stdout: string; stderr: string } {
  return {
    ok: Boolean(execResult?.success),
    tool: String(execResult?.execution?.tool ?? ''),
    status: String(execResult?.execution?.status ?? ''),
    stdout: String(execResult?.stdout ?? ''),
    stderr: String(execResult?.stderr ?? ''),
  };
}

async function orchestrate(cliExecutor: any, naturalPrompt: string, opts: {
  projectDir: string;
  includeDirs?: string;
  id?: string;
  model?: string;
  forceTool?: CliToolName;
  directives?: Record<string, unknown>;
}): Promise<any> {
  const understood = understandTask(naturalPrompt);
  const primaryTool = opts.forceTool || selectTool(understood);

  const contextPatterns = ['@src/**/*.ts', '@py/**/*.py'];
  if (opts.includeDirs) contextPatterns.push('@../shared/**/*');

  const discoveredFiles = discoverContextFiles(opts.projectDir, contextPatterns, opts.includeDirs ? [opts.includeDirs] : undefined);
  const enhanced = makeEnhancedPrompt({
    purpose: `Orchestrate: intent=${understood.intent} complexity=${understood.complexity}`,
    task: naturalPrompt,
    mode: understood.intent === 'execute' ? 'write' : 'analysis',
    context: contextPatterns.join(' '),
    expected: 'Structured execution result',
    rules: 'analysis=READ-ONLY | write=CREATE',
    directives: opts.directives,
  });

  const fallbackOrder: CliToolName[] = ['gemini', 'qwen', 'codex'];
  const candidates: CliToolName[] = [
    primaryTool,
    ...fallbackOrder.filter((t) => t !== primaryTool),
  ];

  const attempts: Array<{ tool: CliToolName; success: boolean }> = [];
  let execRes: any = null;
  let usedTool: CliToolName = primaryTool;

  for (const tool of candidates) {
    execRes = await cliExecutor.executeCliTool({
      tool,
      prompt: enhanced,
      mode: understood.intent === 'execute' ? 'write' : 'analysis',
      model: opts.model || 'm',
      cd: opts.projectDir,
      includeDirs: opts.includeDirs,
      id: opts.id,
    });
    attempts.push({ tool, success: Boolean(execRes?.success) });
    if (execRes?.success) {
      usedTool = tool;
      break;
    }
  }

  return {
    phases: {
      understanding: understood,
      context: { patterns: contextPatterns, file_count: discoveredFiles.length },
      prompt: enhanced,
      tool: usedTool,
      fallback: attempts,
      routed: routeOutput(execRes),
    },
    exec: execRes,
  };
}

function writeLiteLlmConfig(ccwHome: string, endpointId: string): void {
  const configDir = join(ccwHome, 'config');
  mkdirSync(configDir, { recursive: true });
  const configPath = join(configDir, 'litellm-api-config.json');

  const config = {
    version: 1,
    providers: [
      {
        id: 'prov-1',
        name: 'Provider 1',
        type: 'openai',
        apiKey: 'sk-test',
        apiBase: undefined,
        enabled: true,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
    ],
    endpoints: [
      {
        id: endpointId,
        name: 'Endpoint 1',
        providerId: 'prov-1',
        model: 'gpt-4o',
        description: 'test endpoint',
        cacheStrategy: { enabled: true, ttlMinutes: 60, maxSizeKB: 8, filePatterns: [] },
        enabled: true,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
    ],
    globalCacheSettings: { enabled: true, cacheDir: '~/.ccw/cache/context', maxTotalSizeMB: 100 },
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

const cliExecutorUrl = new URL('../../../dist/tools/cli-executor.js', import.meta.url);
cliExecutorUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cliExecutor: any;

let env: TestEnv;
let project: TestProject;

describe('cli-executor integration: orchestration validation', () => {
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

  it('Phase 1: extracts intent from 10+ varied prompts', () => {
    const prompts = [
      'Analyze the module dependencies for the CLI executor',
      'Explain why the tool is timing out in write mode',
      'Plan a refactor for cli-executor to improve logging',
      'Implement integration tests for gemini execution',
      'Fix failing tests in orchestration pipeline',
      'Refactor the prompt builder to use shared utilities',
      'Summarize recent changes in the CLI tools config',
      'Investigate performance regression in context discovery',
      'Plan release notes for v6.3.13',
      'Implement a new endpoint routing feature',
      'Explain how includeDirs works across tools',
    ];

    const results = prompts.map((p) => understandTask(p));
    assert.equal(results.length >= 10, true);
    assert.ok(results.some((r) => r.intent === 'analyze'));
    assert.ok(results.some((r) => r.intent === 'plan'));
    assert.ok(results.some((r) => r.intent === 'execute'));
  });

  it('Phase 2: discovers context files from patterns (>=10 files)', () => {
    const files = discoverContextFiles(project.projectDir, ['@src/**/*.ts', '@py/**/*.py']);
    assert.ok(files.length >= 10);
    assert.ok(files.some((f) => f.endsWith('src/index.ts')));
    assert.ok(files.some((f) => f.endsWith('py/main.py')));
  });

  it('Phase 2: respects includeDirs for outside patterns', () => {
    const noInclude = discoverContextFiles(project.projectDir, ['@../shared/**/*']);
    assert.equal(noInclude.length, 0);

    const withInclude = discoverContextFiles(project.projectDir, ['@../shared/**/*'], ['../shared']);
    assert.ok(withInclude.length >= 1);
  });

  it('Phase 3: builds enhanced prompt with required fields', () => {
    const enhanced = makeEnhancedPrompt({
      purpose: 'Test',
      task: 'Do thing',
      mode: 'analysis',
      context: '@**/*',
      expected: 'Output',
      rules: 'analysis=READ-ONLY',
    });

    for (const field of ['PURPOSE:', 'TASK:', 'MODE:', 'CONTEXT:', 'EXPECTED:', 'RULES:']) {
      assert.ok(enhanced.includes(field));
    }
  });

  it('Phase 4: tool selection chooses correct tool for 5+ task types', () => {
    const cases: Array<{ prompt: string; expected: CliToolName }> = [
      { prompt: 'Analyze this module', expected: 'gemini' },
      { prompt: 'Explain why this fails', expected: 'gemini' },
      { prompt: 'Plan the next steps', expected: 'gemini' },
      { prompt: 'Implement the feature', expected: 'codex' },
      { prompt: 'Refactor core logic', expected: 'codex' },
      { prompt: 'Summarize output', expected: 'qwen' },
    ];

    for (const c of cases) {
      const u = understandTask(c.prompt);
      assert.equal(selectTool(u), c.expected);
    }
  });

  it('Phase 5: output routing returns structured success result', async () => {
    const res = await orchestrate(cliExecutor, 'Analyze the project structure', {
      projectDir: project.projectDir,
      model: 'm',
      forceTool: 'gemini',
    });

    assert.equal(res.phases.routed.ok, true);
    assert.equal(res.phases.routed.tool, 'gemini');
    assert.equal(res.phases.routed.status, 'success');
  });

  it('Phase 5: output routing returns structured error result', async () => {
    const res = await orchestrate(cliExecutor, 'Analyze with fatal error', {
      projectDir: project.projectDir,
      model: 'm',
      forceTool: 'gemini',
      directives: {
        tool_overrides: {
          gemini: { exit_code: 1, stderr: 'FATAL: Authentication failed: API key\n' },
          qwen: { exit_code: 1, stderr: 'FATAL: Authentication failed: API key\n' },
          codex: { exit_code: 1, stderr: 'FATAL: Authentication failed: API key\n' },
        },
      },
    });

    assert.equal(res.phases.routed.ok, false);
    assert.ok(['gemini', 'qwen', 'codex'].includes(res.phases.routed.tool));
    assert.equal(res.phases.routed.status, 'error');
    assert.ok(res.phases.routed.stderr.includes('Authentication'));
    assert.ok(Array.isArray(res.phases.fallback));
    assert.ok(res.phases.fallback.length >= 2);
  });

  it('fallback chain switches tools when primary fails', async () => {
    const res = await orchestrate(cliExecutor, 'Analyze with fallback', {
      projectDir: project.projectDir,
      model: 'm',
      forceTool: 'gemini',
      directives: {
        tool_overrides: {
          gemini: { exit_code: 1, stderr: 'FATAL: rate limit exceeded\n' },
        },
      },
    });

    assert.equal(res.phases.tool, 'qwen');
    assert.ok(res.phases.fallback.some((a: any) => a.tool === 'gemini' && a.success === false));
    assert.ok(res.phases.fallback.some((a: any) => a.tool === 'qwen' && a.success === true));
  });

  it('Phase 5: output routing returns structured timeout result', async () => {
    const res = await orchestrate(cliExecutor, 'Analyze with timeout', {
      projectDir: project.projectDir,
      model: 'm',
      forceTool: 'gemini',
      directives: {
        tool_overrides: {
          gemini: { sleep_ms: 2000 },
        },
      },
    });

    const execRes = await cliExecutor.executeCliTool({
      tool: 'gemini',
      prompt: res.phases.prompt,
      mode: 'analysis',
      model: 'm',
      cd: project.projectDir,
      timeout: 100,
    });

    const routed = routeOutput(execRes);
    assert.equal(routed.ok, false);
    assert.equal(routed.status, 'timeout');
  });

  it('end-to-end workflow: execute intent selects codex and can write files', async () => {
    const res = await orchestrate(cliExecutor, 'Implement a file creation task', {
      projectDir: project.projectDir,
      model: 'm',
      directives: { write_files: { 'e2e.txt': 'hello' } },
    });

    assert.equal(res.phases.tool, 'codex');
    assert.equal(res.phases.routed.ok, true);
  });

  it('execution ID tracking propagates --id into conversation/execution record', async () => {
    const res = await orchestrate(cliExecutor, 'Analyze with explicit ID', {
      projectDir: project.projectDir,
      id: 'EXEC-ORCH-1',
      model: 'm',
      forceTool: 'gemini',
    });

    assert.equal(res.exec.execution.id, 'EXEC-ORCH-1');
    assert.equal(res.exec.conversation.id, 'EXEC-ORCH-1');
  });

  it('LiteLLM endpoint routing runs when model matches endpoint ID', async () => {
    writeLiteLlmConfig(env.ccwHome, 'ep-test');
    litellmSpawnPlan.push({ type: 'close', code: 0, stdout: 'OK', stderr: '' });

    const res = await cliExecutor.executeCliTool({
      tool: 'gemini',
      prompt: 'hi',
      mode: 'analysis',
      model: 'ep-test',
      cd: project.projectDir,
    });

    assert.equal(res.success, true);
    assert.equal(res.execution.tool, 'litellm');
    assert.ok(String(res.stdout).includes('OK'));
  });

  it('concurrent executions complete without interference (>=3 workflows)', async () => {
    const a = setupTestProject();
    const b = setupTestProject();
    const c = setupTestProject();
    try {
      const tasks = [
        orchestrate(cliExecutor, 'Analyze A', { projectDir: a.projectDir, model: 'm', forceTool: 'gemini' }),
        orchestrate(cliExecutor, 'Analyze B', { projectDir: b.projectDir, model: 'm', forceTool: 'qwen' }),
        orchestrate(cliExecutor, 'Implement C', { projectDir: c.projectDir, model: 'm', forceTool: 'codex' }),
      ];

      const results = await Promise.all(tasks);
      assert.equal(results.length, 3);
      assert.ok(results.every((r) => r.exec && typeof r.exec.success === 'boolean'));
    } finally {
      await closeCliHistoryStores();
      a.cleanup();
      b.cleanup();
      c.cleanup();
    }
  });

  it('performance: simple orchestration completes within 30s', async () => {
    const start = Date.now();
    const res = await orchestrate(cliExecutor, 'Analyze quickly', {
      projectDir: project.projectDir,
      model: 'm',
      forceTool: 'gemini',
    });
    const duration = Date.now() - start;
    assert.equal(res.exec.success, true);
    assert.ok(duration < 30000);
  });

  it('performance: complex orchestration completes within 5min', async () => {
    const start = Date.now();
    const res = await orchestrate(cliExecutor, 'Refactor and migrate modules across directories (complex)', {
      projectDir: project.projectDir,
      model: 'm',
      forceTool: 'codex',
    });
    const duration = Date.now() - start;
    assert.equal(typeof duration, 'number');
    assert.ok(duration < 5 * 60 * 1000);
    assert.ok(typeof res.phases.context.file_count === 'number');
  });
});
