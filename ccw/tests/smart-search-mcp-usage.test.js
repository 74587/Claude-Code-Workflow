import { after, afterEach, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const smartSearchPath = new URL('../dist/tools/smart-search.js', import.meta.url).href;
const originalAutoInitMissing = process.env.CODEXLENS_AUTO_INIT_MISSING;
const originalAutoEmbedMissing = process.env.CODEXLENS_AUTO_EMBED_MISSING;

describe('Smart Search MCP usage defaults and path handling', async () => {
  let smartSearchModule;
  const tempDirs = [];

  before(async () => {
    process.env.CODEXLENS_AUTO_INIT_MISSING = 'false';
    try {
      smartSearchModule = await import(smartSearchPath);
    } catch (err) {
      console.log('Note: smart-search module import skipped:', err?.message ?? String(err));
    }
  });

  after(() => {
    if (originalAutoInitMissing === undefined) {
      delete process.env.CODEXLENS_AUTO_INIT_MISSING;
    } else {
      process.env.CODEXLENS_AUTO_INIT_MISSING = originalAutoInitMissing;
    }

    if (originalAutoEmbedMissing === undefined) {
      delete process.env.CODEXLENS_AUTO_EMBED_MISSING;
      return;
    }
    process.env.CODEXLENS_AUTO_EMBED_MISSING = originalAutoEmbedMissing;
  });

  afterEach(() => {
    while (tempDirs.length > 0) {
      rmSync(tempDirs.pop(), { recursive: true, force: true });
    }
    if (smartSearchModule?.__testables) {
      smartSearchModule.__testables.__resetRuntimeOverrides();
      smartSearchModule.__testables.__resetBackgroundJobs();
    }
    process.env.CODEXLENS_AUTO_INIT_MISSING = 'false';
    delete process.env.CODEXLENS_AUTO_EMBED_MISSING;
  });

  function createWorkspace() {
    const dir = mkdtempSync(join(tmpdir(), 'ccw-smart-search-'));
    tempDirs.push(dir);
    return dir;
  }

  function createDetachedChild() {
    return {
      on() {
        return this;
      },
      unref() {},
    };
  }

  it('keeps schema defaults aligned with runtime docs', () => {
    if (!smartSearchModule) return;

    const { schema } = smartSearchModule;
    const props = schema.inputSchema.properties;

    assert.equal(props.maxResults.default, 5);
    assert.equal(props.limit.default, 5);
    assert.match(schema.description, /static FTS index/i);
    assert.match(schema.description, /semantic\/vector embeddings/i);
    assert.ok(props.action.enum.includes('embed'));
    assert.match(props.embeddingBackend.description, /litellm\/api/i);
    assert.match(props.apiMaxWorkers.description, /endpoint pool/i);
    assert.match(schema.description, /apiMaxWorkers=8/i);
    assert.match(props.path.description, /single file path/i);
    assert.ok(props.output_mode.enum.includes('ace'));
    assert.match(props.output_mode.description, /ACE-style/i);
    assert.equal(props.output_mode.default, 'ace');
  });

  it('defaults auto embedding warmup off on Windows unless explicitly enabled', () => {
    if (!smartSearchModule) return;

    const { __testables } = smartSearchModule;
    delete process.env.CODEXLENS_AUTO_EMBED_MISSING;
    assert.equal(__testables.isAutoEmbedMissingEnabled(undefined), process.platform !== 'win32');
    assert.equal(__testables.isAutoEmbedMissingEnabled({}), process.platform !== 'win32');
    assert.equal(
      __testables.isAutoEmbedMissingEnabled({ embedding_auto_embed_missing: true }),
      process.platform === 'win32' ? false : true,
    );
    assert.equal(__testables.isAutoEmbedMissingEnabled({ embedding_auto_embed_missing: false }), false);
    process.env.CODEXLENS_AUTO_EMBED_MISSING = 'true';
    assert.equal(__testables.isAutoEmbedMissingEnabled({ embedding_auto_embed_missing: false }), true);
    process.env.CODEXLENS_AUTO_EMBED_MISSING = 'off';
    assert.equal(__testables.isAutoEmbedMissingEnabled({ embedding_auto_embed_missing: true }), false);
  });

  it('defaults auto index warmup off on Windows unless explicitly enabled', () => {
    if (!smartSearchModule) return;

    const { __testables } = smartSearchModule;
    delete process.env.CODEXLENS_AUTO_INIT_MISSING;
    assert.equal(__testables.isAutoInitMissingEnabled(), process.platform !== 'win32');
    process.env.CODEXLENS_AUTO_INIT_MISSING = 'off';
    assert.equal(__testables.isAutoInitMissingEnabled(), false);
    process.env.CODEXLENS_AUTO_INIT_MISSING = '1';
    assert.equal(__testables.isAutoInitMissingEnabled(), true);
  });

  it('explains when Windows disables background warmup by default', () => {
    if (!smartSearchModule) return;

    const { __testables } = smartSearchModule;
    delete process.env.CODEXLENS_AUTO_INIT_MISSING;
    delete process.env.CODEXLENS_AUTO_EMBED_MISSING;

    const initReason = __testables.getAutoInitMissingDisabledReason();
    const embedReason = __testables.getAutoEmbedMissingDisabledReason({});

    if (process.platform === 'win32') {
      assert.match(initReason, /disabled by default on Windows/i);
      assert.match(embedReason, /disabled by default on Windows/i);
      assert.match(embedReason, /auto_embed_missing=true/i);
    } else {
      assert.match(initReason, /disabled/i);
      assert.match(embedReason, /disabled/i);
    }
  });

  it('builds hidden subprocess options for Smart Search child processes', () => {
    if (!smartSearchModule) return;

    const options = smartSearchModule.__testables.buildSmartSearchSpawnOptions(tmpdir(), {
      detached: true,
      stdio: 'ignore',
      timeout: 12345,
    });

    assert.equal(options.cwd, tmpdir());
    assert.equal(options.shell, false);
    assert.equal(options.windowsHide, true);
    assert.equal(options.detached, true);
    assert.equal(options.timeout, 12345);
    assert.equal(options.env.PYTHONIOENCODING, 'utf-8');
  });

  it('avoids detached background warmup children on Windows consoles', () => {
    if (!smartSearchModule) return;

    assert.equal(
      smartSearchModule.__testables.shouldDetachBackgroundSmartSearchProcess(),
      process.platform !== 'win32',
    );
  });

  it('checks tool availability without shell-based lookup popups', () => {
    if (!smartSearchModule) return;

    const lookupCalls = [];
    const available = smartSearchModule.__testables.checkToolAvailability(
      'rg',
      (command, args, options) => {
        lookupCalls.push({ command, args, options });
        return { status: 0, stdout: '', stderr: '' };
      },
    );

    assert.equal(available, true);
    assert.equal(lookupCalls.length, 1);
    assert.equal(lookupCalls[0].command, process.platform === 'win32' ? 'where' : 'which');
    assert.deepEqual(lookupCalls[0].args, ['rg']);
    assert.equal(lookupCalls[0].options.shell, false);
    assert.equal(lookupCalls[0].options.windowsHide, true);
    assert.equal(lookupCalls[0].options.stdio, 'ignore');
    assert.equal(lookupCalls[0].options.env.PYTHONIOENCODING, 'utf-8');
  });

  it('starts background static index build once for unindexed paths', async () => {
    if (!smartSearchModule) return;

    const { __testables } = smartSearchModule;
    const dir = createWorkspace();
    const fakePython = join(dir, 'python.exe');
    writeFileSync(fakePython, '');
    process.env.CODEXLENS_AUTO_INIT_MISSING = 'true';

    const spawnCalls = [];
    __testables.__setRuntimeOverrides({
      getVenvPythonPath: () => fakePython,
      now: () => 1234567890,
      spawnProcess: (command, args, options) => {
        spawnCalls.push({ command, args, options });
        return createDetachedChild();
      },
    });

    const scope = { workingDirectory: dir, searchPaths: ['.'] };
    const indexStatus = { indexed: false, has_embeddings: false };

    const first = await __testables.maybeStartBackgroundAutoInit(scope, indexStatus);
    const second = await __testables.maybeStartBackgroundAutoInit(scope, indexStatus);

    assert.match(first.note, /started/i);
    assert.match(second.note, /already running/i);
    assert.equal(spawnCalls.length, 1);
    assert.equal(spawnCalls[0].command, fakePython);
    assert.deepEqual(spawnCalls[0].args, ['-m', 'codexlens', 'index', 'init', dir, '--no-embeddings']);
    assert.equal(spawnCalls[0].options.cwd, dir);
    assert.equal(
      spawnCalls[0].options.detached,
      smartSearchModule.__testables.shouldDetachBackgroundSmartSearchProcess(),
    );
    assert.equal(spawnCalls[0].options.windowsHide, true);
  });

  it('starts background embedding build without detached Windows consoles', async () => {
    if (!smartSearchModule) return;

    const { __testables } = smartSearchModule;
    const dir = createWorkspace();
    const fakePython = join(dir, 'python.exe');
    writeFileSync(fakePython, '');
    process.env.CODEXLENS_AUTO_EMBED_MISSING = 'true';

    const spawnCalls = [];
    __testables.__setRuntimeOverrides({
      getVenvPythonPath: () => fakePython,
      checkSemanticStatus: async () => ({ available: true, litellmAvailable: true }),
      now: () => 1234567890,
      spawnProcess: (command, args, options) => {
        spawnCalls.push({ command, args, options });
        return createDetachedChild();
      },
    });

    const status = await __testables.maybeStartBackgroundAutoEmbed(
      { workingDirectory: dir, searchPaths: ['.'] },
      {
        indexed: true,
        has_embeddings: false,
        config: { embedding_backend: 'fastembed' },
      },
    );

    assert.match(status.note, /started/i);
    assert.equal(spawnCalls.length, 1);
    assert.equal(spawnCalls[0].command, fakePython);
    assert.deepEqual(spawnCalls[0].args.slice(0, 1), ['-c']);
    assert.equal(spawnCalls[0].options.cwd, dir);
    assert.equal(
      spawnCalls[0].options.detached,
      smartSearchModule.__testables.shouldDetachBackgroundSmartSearchProcess(),
    );
    assert.equal(spawnCalls[0].options.windowsHide, true);
    assert.equal(spawnCalls[0].options.stdio, 'ignore');
  });

  it('surfaces warnings when background static index warmup cannot start', async () => {
    if (!smartSearchModule) return;

    const { __testables } = smartSearchModule;
    const dir = createWorkspace();
    process.env.CODEXLENS_AUTO_INIT_MISSING = 'true';

    __testables.__setRuntimeOverrides({
      getVenvPythonPath: () => join(dir, 'missing-python.exe'),
    });

    const status = await __testables.maybeStartBackgroundAutoInit(
      { workingDirectory: dir, searchPaths: ['.'] },
      { indexed: false, has_embeddings: false },
    );

    assert.match(status.warning, /Automatic static index warmup could not start/i);
    assert.match(status.warning, /not ready yet/i);
  });

  it('honors explicit small limit values', async () => {
    if (!smartSearchModule) return;

    const dir = createWorkspace();
    const file = join(dir, 'many.ts');
    writeFileSync(file, ['const hit = 1;', 'const hit = 2;', 'const hit = 3;'].join('\n'));

    const toolResult = await smartSearchModule.handler({
      action: 'search',
      query: 'hit',
      path: dir,
      output_mode: 'full',
      limit: 1,
      regex: false,
      tokenize: false,
    });

    assert.equal(toolResult.success, true, toolResult.error);
    assert.equal(toolResult.result.success, true);
    assert.equal(toolResult.result.results.length, 1);
    assert.equal(toolResult.result.metadata.pagination.limit, 1);
  });

  it('scopes search results to a single file path', async () => {
    if (!smartSearchModule) return;

    const dir = createWorkspace();
    const target = join(dir, 'target.ts');
    const other = join(dir, 'other.ts');
    writeFileSync(target, 'const TARGET_TOKEN = 1;\n');
    writeFileSync(other, 'const TARGET_TOKEN = 2;\n');

    const toolResult = await smartSearchModule.handler({
      action: 'search',
      query: 'TARGET_TOKEN',
      path: target,
      output_mode: 'full',
      regex: false,
      tokenize: false,
    });

    assert.equal(toolResult.success, true, toolResult.error);
    assert.equal(toolResult.result.success, true);
    assert.ok(Array.isArray(toolResult.result.results));
    assert.ok(toolResult.result.results.length >= 1);

    const normalizedFiles = toolResult.result.results.map((item) => String(item.file).replace(/\\/g, '/'));
    assert.ok(normalizedFiles.every((file) => file.endsWith('/target.ts') || file === 'target.ts'));
    assert.ok(normalizedFiles.every((file) => !file.endsWith('/other.ts')));
  });

  it('normalizes wrapped multiline query and file path inputs', async () => {
    if (!smartSearchModule) return;

    const dir = createWorkspace();
    const nestedDir = join(dir, 'hydro_generator_module', 'builders');
    mkdirSync(nestedDir, { recursive: true });
    const target = join(nestedDir, 'full_machine_builders.py');
    writeFileSync(target, 'def _resolve_rotor_inner():\n    return rotor_main_seg\n');

    const wrappedPath = target.replace(/([\\/])builders([\\/])/, '$1\n        builders$2');
    const wrappedQuery = '_resolve_rotor_inner OR\n        rotor_main_seg';

    const toolResult = await smartSearchModule.handler({
      action: 'search',
      query: wrappedQuery,
      path: wrappedPath,
      output_mode: 'full',
      regex: false,
      caseSensitive: false,
    });

    assert.equal(toolResult.success, true, toolResult.error);
    assert.equal(toolResult.result.success, true);
    assert.ok(toolResult.result.results.length >= 1);
  });

  it('falls back to literal ripgrep matching for invalid regex-like code queries', async () => {
    if (!smartSearchModule) return;

    const dir = createWorkspace();
    const target = join(dir, 'component.ts');
    writeFileSync(target, 'defineExpose({ handleResize });\n');

    const toolResult = await smartSearchModule.handler({
      action: 'search',
      query: 'defineExpose({ handleResize',
      path: dir,
      output_mode: 'full',
      limit: 5,
    });

    assert.equal(toolResult.success, true, toolResult.error);
    assert.equal(toolResult.result.success, true);
    assert.ok(toolResult.result.results.length >= 1);
    assert.match(toolResult.result.metadata.warning, /literal ripgrep matching/i);
  });

  it('renders grouped ace-style output by default with multi-line chunks', async () => {
    if (!smartSearchModule) return;

    const dir = createWorkspace();
    const target = join(dir, 'ace-target.ts');
    writeFileSync(target, [
      'const before = 1;',
      'const TARGET_TOKEN = 1;',
      'const after = 2;',
      '',
      'function useToken() {',
      '  return TARGET_TOKEN;',
      '}',
    ].join('\n'));

    const toolResult = await smartSearchModule.handler({
      action: 'search',
      query: 'TARGET_TOKEN',
      path: dir,
      contextLines: 1,
      regex: false,
      tokenize: false,
    });

    assert.equal(toolResult.success, true, toolResult.error);
    assert.equal(toolResult.result.success, true);
    assert.equal(toolResult.result.results.format, 'ace');
    assert.equal(Array.isArray(toolResult.result.results.groups), true);
    assert.equal(Array.isArray(toolResult.result.results.sections), true);
    assert.equal(toolResult.result.results.groups.length, 1);
    assert.equal(toolResult.result.results.groups[0].sections.length, 2);
    assert.match(toolResult.result.results.text, /The following code sections were retrieved:/);
    assert.match(toolResult.result.results.text, /Path: .*ace-target\.ts/);
    assert.match(toolResult.result.results.text, /Chunk 1: lines 1-3/);
    assert.match(toolResult.result.results.text, />\s+2 \| const TARGET_TOKEN = 1;/);
    assert.match(toolResult.result.results.text, /Chunk 2: lines 5-7/);
    assert.equal(toolResult.result.metadata.pagination.total >= 1, true);
  });

  it('defaults embed selection to local-fast for bulk indexing', () => {
    if (!smartSearchModule) return;

    const selection = smartSearchModule.__testables.resolveEmbeddingSelection(undefined, undefined, {
      embedding_backend: 'litellm',
      embedding_model: 'qwen3-embedding-sf',
    });

    assert.equal(selection.backend, 'fastembed');
    assert.equal(selection.model, 'fast');
    assert.equal(selection.preset, 'bulk-local-fast');
    assert.match(selection.note, /local-fast/i);
  });

  it('keeps explicit api embedding selection when requested', () => {
    if (!smartSearchModule) return;

    const selection = smartSearchModule.__testables.resolveEmbeddingSelection('api', 'qwen3-embedding-sf', {
      embedding_backend: 'fastembed',
      embedding_model: 'fast',
    });

    assert.equal(selection.backend, 'litellm');
    assert.equal(selection.model, 'qwen3-embedding-sf');
    assert.equal(selection.preset, 'explicit');
  });

  it('parses warning-prefixed JSON and plain-text file lists for semantic fallback', () => {
    if (!smartSearchModule) return;

    const dir = createWorkspace();
    const target = join(dir, 'target.ts');
    writeFileSync(target, 'export const target = 1;\n');

    const parsed = smartSearchModule.__testables.parseCodexLensJsonOutput([
      'RuntimeWarning: compatibility shim',
      JSON.stringify({ results: [{ file: 'target.ts', score: 0.25, excerpt: 'target' }] }),
    ].join('\n'));
    assert.equal(Array.isArray(parsed.results), true);
    assert.equal(parsed.results[0].file, 'target.ts');

    const matches = smartSearchModule.__testables.parsePlainTextFileMatches(target, {
      workingDirectory: dir,
      searchPaths: ['.'],
    });
    assert.equal(matches.length, 1);
    assert.match(String(matches[0].file).replace(/\\/g, '/'), /target\.ts$/);
  });

  it('uses root-scoped embedding status instead of subtree artifacts', () => {
    if (!smartSearchModule) return;

    const summary = smartSearchModule.__testables.extractEmbeddingsStatusSummary({
      total_indexes: 3,
      indexes_with_embeddings: 2,
      total_chunks: 24,
      coverage_percent: 66.7,
      root: {
        total_files: 4,
        files_with_embeddings: 0,
        total_chunks: 0,
        coverage_percent: 0,
        has_embeddings: false,
      },
      subtree: {
        total_indexes: 3,
        indexes_with_embeddings: 2,
        total_files: 12,
        files_with_embeddings: 8,
        total_chunks: 24,
        coverage_percent: 66.7,
      },
      centralized: {
        dense_index_exists: true,
        binary_index_exists: true,
        meta_db_exists: true,
        usable: false,
      },
    });

    assert.equal(summary.coveragePercent, 0);
    assert.equal(summary.totalChunks, 0);
    assert.equal(summary.hasEmbeddings, false);
  });

  it('accepts validated root centralized readiness from CLI status payloads', () => {
    if (!smartSearchModule) return;

    const summary = smartSearchModule.__testables.extractEmbeddingsStatusSummary({
      total_indexes: 2,
      indexes_with_embeddings: 1,
      total_chunks: 10,
      coverage_percent: 25,
      root: {
        total_files: 2,
        files_with_embeddings: 1,
        total_chunks: 3,
        coverage_percent: 50,
        has_embeddings: true,
      },
      centralized: {
        usable: true,
        dense_ready: true,
        chunk_metadata_rows: 3,
      },
    });

    assert.equal(summary.coveragePercent, 50);
    assert.equal(summary.totalChunks, 3);
    assert.equal(summary.hasEmbeddings, true);
  });

  it('prefers embeddings_status over legacy embeddings summary payloads', () => {
    if (!smartSearchModule) return;

    const payload = smartSearchModule.__testables.selectEmbeddingsStatusPayload({
      embeddings: {
        total_indexes: 7,
        indexes_with_embeddings: 4,
        total_chunks: 99,
      },
      embeddings_status: {
        total_indexes: 7,
        total_chunks: 3,
        root: {
          total_files: 2,
          files_with_embeddings: 1,
          total_chunks: 3,
          coverage_percent: 50,
          has_embeddings: true,
        },
        centralized: {
          usable: true,
          dense_ready: true,
          chunk_metadata_rows: 3,
        },
      },
    });

    assert.equal(payload.root.total_chunks, 3);
    assert.equal(payload.centralized.usable, true);
  });

  it('recognizes CodexLens CLI compatibility failures and invalid regex fallback', () => {
    if (!smartSearchModule) return;

    const compatibilityError = [
      'UsageError: Got unexpected extra arguments (20 0 fts)',
      'TypeError: TyperArgument.make_metavar() takes 1 positional argument but 2 were given',
    ].join('\n');

    assert.equal(
      smartSearchModule.__testables.isCodexLensCliCompatibilityError(compatibilityError),
      true,
    );

    const resolution = smartSearchModule.__testables.resolveRipgrepQueryMode(
      'defineExpose({ handleResize',
      true,
      true,
    );

    assert.equal(resolution.regex, false);
    assert.equal(resolution.literalFallback, true);
    assert.match(resolution.warning, /literal ripgrep matching/i);
  });

  it('suppresses compatibility-only fuzzy warnings when ripgrep already produced hits', () => {
    if (!smartSearchModule) return;

    assert.equal(
      smartSearchModule.__testables.shouldSurfaceCodexLensFtsCompatibilityWarning({
        compatibilityTriggeredThisQuery: true,
        skipExactDueToCompatibility: false,
        ripgrepResultCount: 2,
      }),
      false,
    );

    assert.equal(
      smartSearchModule.__testables.shouldSurfaceCodexLensFtsCompatibilityWarning({
        compatibilityTriggeredThisQuery: true,
        skipExactDueToCompatibility: false,
        ripgrepResultCount: 0,
      }),
      true,
    );

    assert.equal(
      smartSearchModule.__testables.shouldSurfaceCodexLensFtsCompatibilityWarning({
        compatibilityTriggeredThisQuery: false,
        skipExactDueToCompatibility: true,
        ripgrepResultCount: 0,
      }),
      true,
    );
  });

  it('builds actionable index suggestions for unhealthy index states', () => {
    if (!smartSearchModule) return;

    const suggestions = smartSearchModule.__testables.buildIndexSuggestions(
      {
        indexed: true,
        has_embeddings: false,
        embeddings_coverage_percent: 0,
        warning: 'Index exists but no embeddings generated. Run smart_search(action="embed") to build the vector index.',
      },
      {
        workingDirectory: 'D:/tmp/demo',
        searchPaths: ['.'],
      },
    );

    assert.equal(Array.isArray(suggestions), true);
    assert.match(suggestions[0].command, /smart_search\(action="embed"/);
  });

  it('surfaces backend failure details when fuzzy search fully fails', async () => {
    if (!smartSearchModule) return;

    const missingPath = join(createWorkspace(), 'missing-folder', 'missing.ts');
    const toolResult = await smartSearchModule.handler({
      action: 'search',
      query: 'TARGET_TOKEN',
      path: missingPath,
      output_mode: 'full',
      regex: false,
      tokenize: false,
    });

    assert.equal(toolResult.success, false);
    assert.match(toolResult.error, /Both search backends failed:/);
    assert.match(toolResult.error, /(FTS|Ripgrep)/);
  });

  it('returns structured semantic results after local init and embed without JSON parse warnings', async () => {
    if (!smartSearchModule) return;

    const codexLensModule = await import(new URL(`../dist/tools/codex-lens.js?smart-semantic=${Date.now()}`, import.meta.url).href);
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

    const dir = createWorkspace();
    writeFileSync(
      join(dir, 'sample.ts'),
      'export function parseCodexLensOutput() { return stripAnsiOutput(); }\nexport const sum = (a, b) => a + b;\n',
    );

    const init = await smartSearchModule.handler({ action: 'init', path: dir });
    assert.equal(init.success, true, init.error ?? 'Expected init to succeed');

    const embed = await smartSearchModule.handler({
      action: 'embed',
      path: dir,
      embeddingBackend: 'local',
      force: true,
    });
    assert.equal(embed.success, true, embed.error ?? 'Expected local embed to succeed');

    const search = await smartSearchModule.handler({
      action: 'search',
      mode: 'semantic',
      path: dir,
      query: 'parse CodexLens output strip ANSI',
      limit: 5,
    });

    assert.equal(search.success, true, search.error ?? 'Expected semantic search to succeed');
    assert.equal(search.result.success, true);
    assert.equal(search.result.results.format, 'ace');
    assert.ok(search.result.results.total >= 1, 'Expected at least one structured semantic match');
    assert.doesNotMatch(search.result.metadata?.warning ?? '', /Failed to parse JSON output/i);
  });
});
