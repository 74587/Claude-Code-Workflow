import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const tempDirs = [];

after(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('CodexLens CLI compatibility retries', () => {
  it('builds hidden Python spawn options for CLI invocations', async () => {
    const moduleUrl = new URL(`../dist/tools/codex-lens.js?spawn-opts=${Date.now()}`, import.meta.url).href;
    const { __testables } = await import(moduleUrl);

    const options = __testables.buildCodexLensSpawnOptions(tmpdir(), 12345);

    assert.equal(options.cwd, tmpdir());
    assert.equal(options.shell, false);
    assert.equal(options.timeout, 12345);
    assert.equal(options.windowsHide, true);
    assert.equal(options.env.PYTHONIOENCODING, 'utf-8');
  });

  it('probes Python version without a shell-backed console window', async () => {
    const moduleUrl = new URL(`../dist/tools/codex-lens.js?python-probe=${Date.now()}`, import.meta.url).href;
    const { __testables } = await import(moduleUrl);
    const probeCalls = [];

    const version = __testables.probePythonVersion({ command: 'python', args: [], display: 'python' }, (command, args, options) => {
      probeCalls.push({ command, args, options });
      return { status: 0, stdout: '', stderr: 'Python 3.11.9\n' };
    });

    assert.equal(version, 'Python 3.11.9');
    assert.equal(probeCalls.length, 1);
    assert.equal(probeCalls[0].command, 'python');
    assert.deepEqual(probeCalls[0].args, ['--version']);
    assert.equal(probeCalls[0].options.shell, false);
    assert.equal(probeCalls[0].options.windowsHide, true);
    assert.equal(probeCalls[0].options.env.PYTHONIOENCODING, 'utf-8');
  });

  it('initializes a tiny index even when CLI emits compatibility conflicts first', async () => {
    const moduleUrl = new URL(`../dist/tools/codex-lens.js?compat=${Date.now()}`, import.meta.url).href;
    const { checkVenvStatus, executeCodexLens } = await import(moduleUrl);

    const ready = await checkVenvStatus(true);
    if (!ready.ready) {
      console.log('Skipping: CodexLens not ready');
      return;
    }

    const projectDir = mkdtempSync(join(tmpdir(), 'codexlens-init-'));
    tempDirs.push(projectDir);
    writeFileSync(join(projectDir, 'sample.ts'), 'export const sample = 1;\n');

    const result = await executeCodexLens(['index', 'init', projectDir, '--force'], { timeout: 600000 });

    assert.equal(result.success, true, result.error ?? 'Expected init to succeed');
    assert.ok((result.output ?? '').length > 0 || (result.warning ?? '').length > 0, 'Expected init output or compatibility warning');
  });

  it('synthesizes a machine-readable fallback when JSON search output is empty', async () => {
    const moduleUrl = new URL(`../dist/tools/codex-lens.js?compat-empty=${Date.now()}`, import.meta.url).href;
    const { __testables } = await import(moduleUrl);

    const normalized = __testables.normalizeSearchCommandResult(
      { success: true },
      { query: 'missing symbol', cwd: tmpdir(), limit: 5, filesOnly: false },
    );

    assert.equal(normalized.success, true);
    assert.match(normalized.warning ?? '', /empty stdout/i);
    assert.deepEqual(normalized.results, {
      success: true,
      result: {
        query: 'missing symbol',
        count: 0,
        results: [],
      },
    });
  });

  it('returns structured semantic search results for a local embedded workspace', async () => {
    const codexLensUrl = new URL(`../dist/tools/codex-lens.js?compat-search=${Date.now()}`, import.meta.url).href;
    const smartSearchUrl = new URL(`../dist/tools/smart-search.js?compat-search=${Date.now()}`, import.meta.url).href;
    const codexLensModule = await import(codexLensUrl);
    const smartSearchModule = await import(smartSearchUrl);

    const ready = await codexLensModule.checkVenvStatus(true);
    if (!ready.ready) {
      console.log('Skipping: CodexLens not ready');
      return;
    }

    const semantic = await codexLensModule.checkSemanticStatus();
    if (!semantic.available) {
      console.log('Skipping: semantic dependencies not ready');
      return;
    }

    const projectDir = mkdtempSync(join(tmpdir(), 'codexlens-search-'));
    tempDirs.push(projectDir);
    writeFileSync(
      join(projectDir, 'sample.ts'),
      'export function greet(name) { return `hello ${name}`; }\nexport const sum = (a, b) => a + b;\n',
    );

    const init = await smartSearchModule.handler({ action: 'init', path: projectDir });
    assert.equal(init.success, true, init.error ?? 'Expected smart-search init to succeed');

    const embed = await smartSearchModule.handler({
      action: 'embed',
      path: projectDir,
      embeddingBackend: 'local',
      force: true,
    });
    assert.equal(embed.success, true, embed.error ?? 'Expected smart-search embed to succeed');

    const result = await codexLensModule.codexLensTool.execute({
      action: 'search',
      path: projectDir,
      query: 'greet function',
      mode: 'semantic',
      format: 'json',
    });

    assert.equal(result.success, true, result.error ?? 'Expected semantic search compatibility fallback to succeed');
    const payload = result.results?.result ?? result.results;
    assert.ok(Array.isArray(payload?.results), 'Expected structured search results payload');
    assert.ok(payload.results.length > 0, 'Expected at least one structured semantic search result');
    assert.doesNotMatch(result.error ?? '', /unexpected extra arguments/i);
  });
});
