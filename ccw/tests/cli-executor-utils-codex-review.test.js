import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const cliExecutorUtilsPath = new URL('../dist/tools/cli-executor-utils.js', import.meta.url).href;

describe('buildCommand() codex review', () => {
  it('uses `codex exec review --json` (not `codex review`) for structured parsing', async () => {
    const { buildCommand } = await import(cliExecutorUtilsPath);

    const result = buildCommand({
      tool: 'codex',
      mode: 'review',
      prompt: 'Review this',
      model: 'gpt-5.2',
      include: 'a,b',
      reviewOptions: { title: 'Test Review' }
    });

    assert.equal(result.command, 'codex');
    assert.equal(result.useStdin, true);
    assert.equal(result.outputFormat, 'json-lines');

    // Ensure we do NOT call the top-level `codex review` command
    assert.notEqual(result.args[0], 'review');

    // Ensure we call `codex exec review` and request JSONL output
    assert.deepEqual(result.args.slice(0, 3), ['exec', 'review', '--full-auto']);
    assert.ok(result.args.includes('--json'));
    assert.ok(result.args.includes('--skip-git-repo-check'));

    // Review target defaults to --uncommitted when none specified
    assert.ok(result.args.includes('--uncommitted'));

    // `codex exec review` supports -m/--model (not -c model=...)
    assert.ok(result.args.includes('-m'));
    assert.equal(result.args[result.args.indexOf('-m') + 1], 'gpt-5.2');
    assert.equal(result.args.includes('-c'), false);

    // include dirs map to repeated --add-dir flags
    assert.deepEqual(
      result.args.filter((x) => x === '--add-dir').length,
      2
    );

    // Prompt is sent via stdin with "-" marker to avoid quoting issues.
    assert.equal(result.args[result.args.length - 1], '-');
  });
});
