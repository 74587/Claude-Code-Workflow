/**
 * Unit tests for PTY session execute command builder
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const builderUrl = new URL('../dist/core/services/cli-session-command-builder.js', import.meta.url).href;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod;

describe('buildCliSessionExecuteCommand', async () => {
  mod = await import(builderUrl);

  it('builds a node-piped command with resume + promptConcat', () => {
    const { command } = mod.buildCliSessionExecuteCommand({
      projectRoot: 'D:\\\\Claude_dms3',
      shellKind: 'pwsh',
      tool: 'codex',
      prompt: 'line1\nline2',
      mode: 'write',
      workingDir: 'D:\\\\Claude_dms3',
      resumeStrategy: 'promptConcat',
      prevExecutionId: 'prev-123',
      executionId: 'rk-1'
    });

    assert.match(command, /^node -e "process\.stdout\.write\(Buffer\.from\('/);
    assert.match(command, /\| node /);
    assert.match(command, / cli\b/);
    assert.match(command, / --tool codex\b/);
    assert.match(command, / --mode write\b/);
    assert.match(command, / --stream\b/);
    assert.match(command, / --id rk-1\b/);
    assert.match(command, / --resume prev-123\b/);
    assert.match(command, / --no-native\b/);
  });

  it('uses wslpath to pass Windows paths to node.exe in wsl-bash', () => {
    const { command } = mod.buildCliSessionExecuteCommand({
      projectRoot: 'D:\\\\Claude_dms3',
      shellKind: 'wsl-bash',
      tool: 'claude',
      prompt: 'hello',
      mode: 'analysis',
      workingDir: 'D:\\\\Claude_dms3',
      resumeStrategy: 'nativeResume',
      executionId: 'exec-1'
    });

    assert.match(command, /^CCW_WIN=\$\(\s*wslpath -w /);
    assert.match(command, /WD_WIN=\$\(\s*wslpath -w /);
    assert.match(command, /node\.exe -e /);
    assert.match(command, /\| node\.exe "\$CCW_WIN" cli/);
    assert.match(command, / --cd "\$WD_WIN"/);
    assert.match(command, / --tool claude\b/);
    assert.match(command, / --mode analysis\b/);
    assert.match(command, / --id exec-1\b/);
    assert.ok(!command.includes('--no-native'));
  });
});
