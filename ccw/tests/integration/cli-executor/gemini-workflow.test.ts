/**
 * Integration tests for cli-executor: gemini workflows.
 *
 * Notes:
 * - Targets the runtime implementation shipped in `ccw/dist`.
 * - Uses stub CLI shims (gemini.cmd) to avoid external dependencies.
 */

import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  closeCliHistoryStores,
  makeEnhancedPrompt,
  setupTestEnv,
  setupTestProject,
  validateExecutionResult,
} from './setup.ts';

const cliExecutorUrl = new URL('../../../dist/tools/cli-executor.js', import.meta.url);
cliExecutorUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cliExecutor: any;

function parseFirstJsonLine(text: string): any {
  const line = text.split(/\r?\n/).find((l) => l.trim().length > 0);
  return JSON.parse(line || '{}');
}

function normalizeSlash(value: string): string {
  return value.replace(/\\/g, '/');
}

describe('cli-executor integration: gemini workflows', () => {
  before(async () => {
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
    cliExecutor = await import(cliExecutorUrl.href);
  });

  beforeEach(() => {
    cliExecutor?.clearToolCache?.();
  });

  after(async () => {
    try {
      mock.restoreAll();
      await closeCliHistoryStores();
    } catch {
      // ignore
    }
  });

  it('executes analysis mode and passes model arg to gemini', async () => {
    const env = setupTestEnv(['gemini']);
    const project = setupTestProject();
    try {
      const prompt = makeEnhancedPrompt({
        purpose: 'Analyze project structure',
        task: 'List key modules',
        mode: 'analysis',
        context: '@src/**/*.ts',
        expected: 'Module list',
        rules: 'analysis=READ-ONLY',
      });

      const res = await cliExecutor.executeCliTool({
        tool: 'gemini',
        prompt,
        mode: 'analysis',
        model: 'gemini-test-model',
        cd: project.projectDir,
      });

      validateExecutionResult(res, { success: true, tool: 'gemini' });
      const payload = parseFirstJsonLine(res.stdout);
      assert.equal(payload.tool, 'gemini');
      assert.ok(payload.args.includes('-m'));
      assert.ok(payload.args.includes('gemini-test-model'));
      assert.equal(payload.args.includes('--approval-mode'), false);
      assert.equal(payload.cwd, normalizeSlash(project.projectDir));
      assert.equal(payload.prompt.trim(), prompt.trim());
    } finally {
      await closeCliHistoryStores();
      env.restore();
      env.cleanup();
      project.cleanup();
    }
  });

  it('executes write mode and includes --approval-mode yolo', async () => {
    const env = setupTestEnv(['gemini']);
    const project = setupTestProject();
    try {
      const outFile = join(project.projectDir, 'out.txt');
      const prompt = makeEnhancedPrompt({
        purpose: 'Write output file',
        task: 'Create out.txt with hello',
        mode: 'write',
        context: '@src/index.ts',
        expected: 'out.txt created',
        rules: 'write=CREATE',
        directives: { write_files: { 'out.txt': 'hello' } },
      });

      const res = await cliExecutor.executeCliTool({
        tool: 'gemini',
        prompt,
        mode: 'write',
        model: 'gemini-test-model',
        cd: project.projectDir,
      });

      validateExecutionResult(res, { success: true, tool: 'gemini' });
      const payload = parseFirstJsonLine(res.stdout);
      assert.ok(payload.args.includes('--approval-mode'));
      assert.ok(payload.args.includes('yolo'));
      assert.equal(readFileSync(outFile, 'utf8'), 'hello');
    } finally {
      await closeCliHistoryStores();
      env.restore();
      env.cleanup();
      project.cleanup();
    }
  });

  it('resolves @patterns to 10+ files when directives.resolve_patterns=true', async () => {
    const env = setupTestEnv(['gemini']);
    const project = setupTestProject();
    try {
      const prompt = makeEnhancedPrompt({
        purpose: 'Collect context',
        task: 'Resolve patterns',
        mode: 'analysis',
        context: '@src/**/*.ts @py/**/*.py',
        expected: 'Resolved files list',
        rules: 'analysis=READ-ONLY',
        directives: { resolve_patterns: true },
      });

      const res = await cliExecutor.executeCliTool({
        tool: 'gemini',
        prompt,
        mode: 'analysis',
        model: 'gemini-test-model',
        cd: project.projectDir,
      });

      const payload = parseFirstJsonLine(res.stdout);
      assert.ok(Array.isArray(payload.resolved_files));
      assert.ok(payload.resolved_files.length >= 10);
    } finally {
      await closeCliHistoryStores();
      env.restore();
      env.cleanup();
      project.cleanup();
    }
  });

  it('includeDirs allows resolving @../shared/**/* patterns', async () => {
    const env = setupTestEnv(['gemini']);
    const project = setupTestProject();
    try {
      const prompt = makeEnhancedPrompt({
        purpose: 'Collect cross-directory context',
        task: 'Resolve shared files',
        mode: 'analysis',
        context: '@../shared/**/*',
        expected: 'Resolved shared files list',
        rules: 'analysis=READ-ONLY',
        directives: { resolve_patterns: true },
      });

      const res = await cliExecutor.executeCliTool({
        tool: 'gemini',
        prompt,
        mode: 'analysis',
        model: 'gemini-test-model',
        cd: project.projectDir,
        includeDirs: '../shared',
      });

      const payload = parseFirstJsonLine(res.stdout);
      assert.ok(payload.args.includes('--include-directories'));
      assert.ok(payload.args.includes('../shared'));
      assert.ok(payload.resolved_files.some((p: string) => String(p).startsWith('../shared/')));
    } finally {
      await closeCliHistoryStores();
      env.restore();
      env.cleanup();
      project.cleanup();
    }
  });

  it('without includeDirs, @../shared/**/* is ignored by stub resolver', async () => {
    const env = setupTestEnv(['gemini']);
    const project = setupTestProject();
    try {
      const prompt = makeEnhancedPrompt({
        purpose: 'Collect cross-directory context',
        task: 'Resolve shared files',
        mode: 'analysis',
        context: '@../shared/**/*',
        expected: 'Resolved shared files list',
        rules: 'analysis=READ-ONLY',
        directives: { resolve_patterns: true },
      });

      const res = await cliExecutor.executeCliTool({
        tool: 'gemini',
        prompt,
        mode: 'analysis',
        model: 'gemini-test-model',
        cd: project.projectDir,
      });

      const payload = parseFirstJsonLine(res.stdout);
      assert.equal(payload.resolved_files.some((p: string) => String(p).startsWith('../shared/')), false);
    } finally {
      await closeCliHistoryStores();
      env.restore();
      env.cleanup();
      project.cleanup();
    }
  });

  it('treats non-zero exit with valid output and non-fatal stderr as success', async () => {
    const env = setupTestEnv(['gemini']);
    const project = setupTestProject();
    try {
      const prompt = makeEnhancedPrompt({
        purpose: 'Non-fatal exit scenario',
        task: 'Return output even with non-zero exit',
        mode: 'analysis',
        context: '@src/index.ts',
        expected: 'OK',
        rules: 'analysis=READ-ONLY',
        directives: { exit_code: 1, stdout: 'OK\n', stderr: 'warning: something\n' },
      });

      const res = await cliExecutor.executeCliTool({
        tool: 'gemini',
        prompt,
        mode: 'analysis',
        model: 'gemini-test-model',
        cd: project.projectDir,
      });

      assert.equal(res.success, true);
      assert.equal(res.execution.status, 'success');
      assert.equal(res.stdout.trim(), 'OK');
      assert.ok(res.stderr.includes('warning'));
    } finally {
      await closeCliHistoryStores();
      env.restore();
      env.cleanup();
      project.cleanup();
    }
  });

  it('treats Authentication/API key stderr as fatal error', async () => {
    const env = setupTestEnv(['gemini']);
    const project = setupTestProject();
    try {
      const prompt = makeEnhancedPrompt({
        purpose: 'Fatal error scenario',
        task: 'Return fatal stderr',
        mode: 'analysis',
        context: '@src/index.ts',
        expected: 'Error',
        rules: 'analysis=READ-ONLY',
        directives: { exit_code: 1, stdout: 'partial output\n', stderr: 'Authentication failed: API key missing\n' },
      });

      const res = await cliExecutor.executeCliTool({
        tool: 'gemini',
        prompt,
        mode: 'analysis',
        model: 'gemini-test-model',
        cd: project.projectDir,
      });

      assert.equal(res.success, false);
      assert.equal(res.execution.status, 'error');
      assert.equal(res.execution.tool, 'gemini');
      assert.equal(res.execution.model, 'gemini-test-model');
      assert.ok(res.stderr.includes('Authentication failed'));
    } finally {
      await closeCliHistoryStores();
      env.restore();
      env.cleanup();
      project.cleanup();
    }
  });

  it('streams stdout/stderr via onOutput callback', async () => {
    const env = setupTestEnv(['gemini']);
    const project = setupTestProject();
    try {
      const outputs: Array<{ type: string; data: string }> = [];
      const prompt = makeEnhancedPrompt({
        purpose: 'Streaming output',
        task: 'Emit stdout and stderr',
        mode: 'analysis',
        context: '@src/index.ts',
        expected: 'Events captured',
        rules: 'analysis=READ-ONLY',
        directives: { stdout: 'hello', stderr: 'oops', exit_code: 0 },
      });

      const res = await cliExecutor.executeCliTool(
        {
          tool: 'gemini',
          prompt,
          mode: 'analysis',
          model: 'gemini-test-model',
          cd: project.projectDir,
        },
        (data: { type: string; data: string }) => outputs.push(data),
      );

      assert.equal(res.success, true);
      assert.ok(outputs.some((o) => o.type === 'stdout' && o.data.includes('hello')));
      assert.ok(outputs.some((o) => o.type === 'stderr' && o.data.includes('oops')));
    } finally {
      await closeCliHistoryStores();
      env.restore();
      env.cleanup();
      project.cleanup();
    }
  });

  it('stream=true disables cached stdout_full/stderr_full in history turn output', async () => {
    const env = setupTestEnv(['gemini']);
    const project = setupTestProject();
    try {
      const prompt = makeEnhancedPrompt({
        purpose: 'Streaming mode',
        task: 'Disable caching',
        mode: 'analysis',
        context: '@src/index.ts',
        expected: 'No full output cached',
        rules: 'analysis=READ-ONLY',
      });

      const res = await cliExecutor.executeCliTool({
        tool: 'gemini',
        prompt,
        mode: 'analysis',
        model: 'gemini-test-model',
        cd: project.projectDir,
        stream: true,
      });

      assert.equal(res.execution.output.cached, false);
      assert.equal(res.execution.output.stdout_full, undefined);
      assert.equal(res.execution.output.stderr_full, undefined);
    } finally {
      await closeCliHistoryStores();
      env.restore();
      env.cleanup();
      project.cleanup();
    }
  });

  it('stream=false caches stdout_full/stderr_full by default', async () => {
    const env = setupTestEnv(['gemini']);
    const project = setupTestProject();
    try {
      const prompt = makeEnhancedPrompt({
        purpose: 'Caching default',
        task: 'Cache full output',
        mode: 'analysis',
        context: '@src/index.ts',
        expected: 'Full output cached',
        rules: 'analysis=READ-ONLY',
        directives: { stdout: 'cached-output', stderr: 'cached-error' },
      });

      const res = await cliExecutor.executeCliTool({
        tool: 'gemini',
        prompt,
        mode: 'analysis',
        model: 'gemini-test-model',
        cd: project.projectDir,
      });

      assert.equal(res.execution.output.cached, true);
      assert.equal(res.execution.output.stdout_full, 'cached-output');
      assert.equal(res.execution.output.stderr_full, 'cached-error');
    } finally {
      await closeCliHistoryStores();
      env.restore();
      env.cleanup();
      project.cleanup();
    }
  });

  it('includes PURPOSE/TASK/MODE/CONTEXT/EXPECTED/RULES structure in delivered prompt', async () => {
    const env = setupTestEnv(['gemini']);
    const project = setupTestProject();
    try {
      const prompt = makeEnhancedPrompt({
        purpose: 'Validate enhanced prompt',
        task: 'Check all required fields',
        mode: 'analysis',
        context: '@**/*',
        expected: 'Fields present',
        rules: 'analysis=READ-ONLY',
      });

      const res = await cliExecutor.executeCliTool({
        tool: 'gemini',
        prompt,
        mode: 'analysis',
        model: 'gemini-test-model',
        cd: project.projectDir,
      });

      const payload = parseFirstJsonLine(res.stdout);
      assert.ok(payload.parsed);
      for (const field of ['purpose', 'task', 'mode', 'context', 'expected', 'rules']) {
        assert.equal(typeof payload.parsed[field], 'string');
        assert.ok(String(payload.parsed[field]).length > 0);
      }
    } finally {
      await closeCliHistoryStores();
      env.restore();
      env.cleanup();
      project.cleanup();
    }
  });

  it('resume=true uses native gemini latest flag (-r latest)', async () => {
    const env = setupTestEnv(['gemini']);
    const project = setupTestProject();
    try {
      const prompt = makeEnhancedPrompt({
        purpose: 'Resume latest',
        task: 'Use native resume',
        mode: 'analysis',
        context: '@src/index.ts',
        expected: 'Args include -r latest',
        rules: 'analysis=READ-ONLY',
      });

      const res = await cliExecutor.executeCliTool({
        tool: 'gemini',
        prompt,
        mode: 'analysis',
        model: 'gemini-test-model',
        cd: project.projectDir,
        resume: true,
      });

      const payload = parseFirstJsonLine(res.stdout);
      const args = payload.args.map(String);
      const idx = args.indexOf('-r');
      assert.ok(idx >= 0);
      assert.equal(args[idx + 1], 'latest');
    } finally {
      await closeCliHistoryStores();
      env.restore();
      env.cleanup();
      project.cleanup();
    }
  });

  it('noNative=true disables native resume flags', async () => {
    const env = setupTestEnv(['gemini']);
    const project = setupTestProject();
    try {
      const prompt = makeEnhancedPrompt({
        purpose: 'Resume disabled',
        task: 'Force prompt concat',
        mode: 'analysis',
        context: '@src/index.ts',
        expected: 'No -r flag',
        rules: 'analysis=READ-ONLY',
      });

      const res = await cliExecutor.executeCliTool({
        tool: 'gemini',
        prompt,
        mode: 'analysis',
        model: 'gemini-test-model',
        cd: project.projectDir,
        resume: true,
        noNative: true,
      });

      const payload = parseFirstJsonLine(res.stdout);
      assert.equal(payload.args.includes('-r'), false);
    } finally {
      await closeCliHistoryStores();
      env.restore();
      env.cleanup();
      project.cleanup();
    }
  });

  it('resume with --id and noNative preserves previous prompt context via concatenation', async () => {
    const env = setupTestEnv(['gemini']);
    const project = setupTestProject();
    try {
      const firstPrompt = makeEnhancedPrompt({
        purpose: 'First turn',
        task: 'Store conversation',
        mode: 'analysis',
        context: '@src/index.ts',
        expected: 'Stored',
        rules: 'analysis=READ-ONLY',
      });

      const first = await cliExecutor.executeCliTool({
        tool: 'gemini',
        prompt: firstPrompt,
        mode: 'analysis',
        model: 'gemini-test-model',
        cd: project.projectDir,
        id: 'CONV-GEMINI-1',
      });
      assert.equal(first.success, true);

      const secondPrompt = makeEnhancedPrompt({
        purpose: 'Second turn',
        task: 'Resume and include previous context',
        mode: 'analysis',
        context: '@src/utils/**/*.ts',
        expected: 'Previous prompt included',
        rules: 'analysis=READ-ONLY',
      });

      const second = await cliExecutor.executeCliTool({
        tool: 'gemini',
        prompt: secondPrompt,
        mode: 'analysis',
        model: 'gemini-test-model',
        cd: project.projectDir,
        resume: 'CONV-GEMINI-1',
        noNative: true,
      });

      const payload = parseFirstJsonLine(second.stdout);
      assert.ok(String(payload.prompt).includes('First turn'));
      assert.ok(String(payload.prompt).includes('Second turn'));
    } finally {
      await closeCliHistoryStores();
      env.restore();
      env.cleanup();
      project.cleanup();
    }
  });

  it('enforces internal timeout when timeout>0 and tool sleeps longer', async () => {
    const env = setupTestEnv(['gemini']);
    const project = setupTestProject();
    try {
      const prompt = makeEnhancedPrompt({
        purpose: 'Timeout',
        task: 'Simulate slow tool',
        mode: 'analysis',
        context: '@src/index.ts',
        expected: 'Timeout status',
        rules: 'analysis=READ-ONLY',
        directives: { sleep_ms: 2000 },
      });

      const res = await cliExecutor.executeCliTool({
        tool: 'gemini',
        prompt,
        mode: 'analysis',
        model: 'gemini-test-model',
        cd: project.projectDir,
        timeout: 100,
      });

      assert.equal(res.success, false);
      assert.equal(res.execution.status, 'timeout');
    } finally {
      await closeCliHistoryStores();
      env.restore();
      env.cleanup();
      project.cleanup();
    }
  });
});
