/**
 * Cross-project regression coverage for `ccw cli history` and `ccw cli detail`.
 */

import { after, afterEach, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TEST_CCW_HOME = mkdtempSync(join(tmpdir(), 'ccw-cli-history-cross-home-'));
process.env.CCW_DATA_DIR = TEST_CCW_HOME;

const cliCommandPath = new URL('../dist/commands/cli.js', import.meta.url).href;
const cliExecutorPath = new URL('../dist/tools/cli-executor.js', import.meta.url).href;
const historyStorePath = new URL('../dist/tools/cli-history-store.js', import.meta.url).href;

function createConversation({ id, prompt, updatedAt }) {
  return {
    id,
    created_at: updatedAt,
    updated_at: updatedAt,
    tool: 'gemini',
    model: 'default',
    mode: 'analysis',
    category: 'user',
    total_duration_ms: 456,
    turn_count: 1,
    latest_status: 'success',
    turns: [
      {
        turn: 1,
        timestamp: updatedAt,
        prompt,
        duration_ms: 456,
        status: 'success',
        exit_code: 0,
        output: {
          stdout: 'CROSS PROJECT OK',
          stderr: '',
          truncated: false,
          cached: false,
        },
      },
    ],
  };
}

describe('ccw cli history/detail cross-project', async () => {
  let cliModule;
  let cliExecutorModule;
  let historyStoreModule;

  before(async () => {
    cliModule = await import(cliCommandPath);
    cliExecutorModule = await import(cliExecutorPath);
    historyStoreModule = await import(historyStorePath);
  });

  afterEach(() => {
    mock.restoreAll();
    try {
      historyStoreModule?.closeAllStores?.();
    } catch {
      // ignore
    }
  });

  after(() => {
    try {
      historyStoreModule?.closeAllStores?.();
    } catch {
      // ignore
    }
    rmSync(TEST_CCW_HOME, { recursive: true, force: true });
  });

  it('finds history and detail for executions stored in another registered project', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'ccw-cli-cross-project-history-'));
    const unrelatedCwd = mkdtempSync(join(tmpdir(), 'ccw-cli-cross-project-cwd-'));
    const previousCwd = process.cwd();

    try {
      const store = new historyStoreModule.CliHistoryStore(projectRoot);
      store.saveConversation(createConversation({
        id: 'CONV-CROSS-PROJECT-1',
        prompt: 'Cross project prompt',
        updatedAt: new Date('2025-02-01T00:00:01.000Z').toISOString(),
      }));
      store.close();

      const logs = [];
      mock.method(console, 'log', (...args) => {
        logs.push(args.map(String).join(' '));
      });
      mock.method(console, 'error', (...args) => {
        logs.push(args.map(String).join(' '));
      });

      process.chdir(unrelatedCwd);

      await cliModule.cliCommand('history', [], { limit: '20' });
      assert.ok(logs.some((line) => line.includes('CONV-CROSS-PROJECT-1')));

      await cliExecutorModule.getExecutionHistoryAsync(projectRoot, { limit: 1 });

      logs.length = 0;
      await cliModule.cliCommand('detail', ['CONV-CROSS-PROJECT-1'], {});
      assert.ok(logs.some((line) => line.includes('Conversation Detail')));
      assert.ok(logs.some((line) => line.includes('CONV-CROSS-PROJECT-1')));
      assert.ok(logs.some((line) => line.includes('Cross project prompt')));
    } finally {
      process.chdir(previousCwd);
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(unrelatedCwd, { recursive: true, force: true });
    }
  });
});
