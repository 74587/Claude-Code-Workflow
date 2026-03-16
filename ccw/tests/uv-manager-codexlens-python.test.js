import { afterEach, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

const uvManagerPath = new URL('../dist/utils/uv-manager.js', import.meta.url).href;
const pythonUtilsPath = new URL('../dist/utils/python-utils.js', import.meta.url).href;

describe('CodexLens UV python preference', async () => {
  let mod;
  let pythonUtils;
  const originalPython = process.env.CCW_PYTHON;

  before(async () => {
    mod = await import(uvManagerPath);
    pythonUtils = await import(pythonUtilsPath);
  });

  afterEach(() => {
    if (originalPython === undefined) {
      delete process.env.CCW_PYTHON;
      return;
    }
    process.env.CCW_PYTHON = originalPython;
  });

  it('honors CCW_PYTHON override', () => {
    process.env.CCW_PYTHON = 'C:/Custom/Python/python.exe';
    assert.equal(mod.getPreferredCodexLensPythonSpec(), 'C:/Custom/Python/python.exe');
  });

  it('parses py launcher commands into spawn-safe command specs', () => {
    const spec = pythonUtils.parsePythonCommandSpec('py -3.11');

    assert.equal(spec.command, 'py');
    assert.deepEqual(spec.args, ['-3.11']);
    assert.equal(spec.display, 'py -3.11');
  });

  it('treats unquoted Windows-style executable paths as a single command', () => {
    const spec = pythonUtils.parsePythonCommandSpec('C:/Program Files/Python311/python.exe');

    assert.equal(spec.command, 'C:/Program Files/Python311/python.exe');
    assert.deepEqual(spec.args, []);
    assert.equal(spec.display, '"C:/Program Files/Python311/python.exe"');
  });

  it('probes Python launcher versions without opening a shell window', () => {
    const probeCalls = [];
    const version = pythonUtils.probePythonCommandVersion(
      { command: 'py', args: ['-3.11'], display: 'py -3.11' },
      (command, args, options) => {
        probeCalls.push({ command, args, options });
        return { status: 0, stdout: '', stderr: 'Python 3.11.9\n' };
      },
    );

    assert.equal(version, 'Python 3.11.9');
    assert.equal(probeCalls.length, 1);
    assert.equal(probeCalls[0].command, 'py');
    assert.deepEqual(probeCalls[0].args, ['-3.11', '--version']);
    assert.equal(probeCalls[0].options.shell, false);
    assert.equal(probeCalls[0].options.windowsHide, true);
    assert.equal(probeCalls[0].options.env.PYTHONIOENCODING, 'utf-8');
  });

  it('looks up uv on PATH without spawning a visible shell window', () => {
    const lookupCalls = [];
    const found = mod.__testables.findExecutableOnPath('uv', (command, args, options) => {
      lookupCalls.push({ command, args, options });
      return { status: 0, stdout: 'C:/Tools/uv.exe\n', stderr: '' };
    });

    assert.equal(found, 'C:/Tools/uv.exe');
    assert.equal(lookupCalls.length, 1);
    assert.equal(lookupCalls[0].command, process.platform === 'win32' ? 'where' : 'which');
    assert.deepEqual(lookupCalls[0].args, ['uv']);
    assert.equal(lookupCalls[0].options.shell, false);
    assert.equal(lookupCalls[0].options.windowsHide, true);
    assert.equal(lookupCalls[0].options.env.PYTHONIOENCODING, 'utf-8');
  });

  it('checks Windows launcher preferences with hidden subprocess options', () => {
    const probeCalls = [];
    const available = mod.__testables.hasWindowsPythonLauncherVersion('3.11', (command, args, options) => {
      probeCalls.push({ command, args, options });
      return { status: 0, stdout: '', stderr: 'Python 3.11.9\n' };
    });

    assert.equal(available, true);
    assert.equal(probeCalls.length, 1);
    assert.equal(probeCalls[0].command, 'py');
    assert.deepEqual(probeCalls[0].args, ['-3.11', '--version']);
    assert.equal(probeCalls[0].options.shell, false);
    assert.equal(probeCalls[0].options.windowsHide, true);
    assert.equal(probeCalls[0].options.env.PYTHONIOENCODING, 'utf-8');
  });

  it('prefers Python 3.11 or 3.10 on Windows when available', () => {
    if (process.platform !== 'win32') return;
    delete process.env.CCW_PYTHON;

    let installed = '';
    try {
      installed = execSync('py -0p', { encoding: 'utf-8' });
    } catch {
      return;
    }

    const has311 = installed.includes('-V:3.11');
    const has310 = installed.includes('-V:3.10');
    if (!has311 && !has310) {
      return;
    }

    const preferred = mod.getPreferredCodexLensPythonSpec();
    assert.ok(
      preferred === '3.11' || preferred === '3.10',
      `expected Windows preference to avoid 3.12 when 3.11/3.10 exists, got ${preferred}`,
    );
  });
});
