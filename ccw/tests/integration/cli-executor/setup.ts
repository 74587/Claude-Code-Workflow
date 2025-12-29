import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, relative, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

export type CliToolName = 'gemini' | 'qwen' | 'codex';

export const DEFAULT_INTEGRATION_TEST_TIMEOUT_MS = 5 * 60 * 1000;

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
export const CLI_TOOL_STUB_PATH = join(THIS_DIR, 'tool-stub.js');

export type EnvSnapshot = Record<string, string | undefined>;

function getPathKey(): string {
  if (process.platform !== 'win32') return 'PATH';
  const existing = Object.keys(process.env).find((k) => k.toLowerCase() === 'path');
  return existing || 'Path';
}

export function snapshotEnv(keys: string[]): EnvSnapshot {
  const snapshot: EnvSnapshot = {};
  for (const key of keys) snapshot[key] = process.env[key];
  return snapshot;
}

export function restoreEnv(snapshot: EnvSnapshot): void {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

export interface TestProject {
  baseDir: string;
  projectDir: string;
  sharedDir: string;
  sampleFiles: string[];
  cleanup: () => void;
}

function writeFixtureFile(rootDir: string, filePath: string, content: string): void {
  const absPath = join(rootDir, filePath);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, content, 'utf8');
}

export function setupTestProject(): TestProject {
  const baseDir = mkdtempSync(join(tmpdir(), 'ccw-cli-executor-int-'));
  const projectDir = join(baseDir, 'project');
  const sharedDir = join(baseDir, 'shared');
  mkdirSync(projectDir, { recursive: true });
  mkdirSync(sharedDir, { recursive: true });

  const sampleFiles: string[] = [
    'src/index.ts',
    'src/utils/math.ts',
    'src/utils/strings.ts',
    'src/services/api.ts',
    'src/models/user.ts',
    'src/models/order.ts',
    'scripts/build.ts',
    'py/main.py',
    'py/utils.py',
    'py/models.py',
    'py/services/api.py',
    'py/tests/test_basic.py',
  ];

  const sharedFiles: string[] = ['shared.ts', 'shared.py', 'constants.ts'];

  for (const relPath of sampleFiles) {
    const ext = relPath.split('.').pop();
    const content =
      ext === 'py'
        ? `# ${relPath}\n\ndef hello(name: str) -> str:\n    return f\"hello {name}\"\n`
        : `// ${relPath}\nexport function hello(name: string): string {\n  return \`hello \${name}\`;\n}\n`;
    writeFixtureFile(projectDir, relPath, content);
  }

  for (const relPath of sharedFiles) {
    const ext = relPath.split('.').pop();
    const content =
      ext === 'py'
        ? `# shared/${relPath}\n\ndef shared() -> str:\n    return \"shared\"\n`
        : `// shared/${relPath}\nexport const SHARED = 'shared';\n`;
    writeFixtureFile(sharedDir, relPath, content);
  }

  return {
    baseDir,
    projectDir,
    sharedDir,
    sampleFiles,
    cleanup() {
      rmSync(baseDir, { recursive: true, force: true });
    },
  };
}

export interface TestEndpoint {
  tool: CliToolName;
  binDir: string;
  commandPath: string;
}

function writeExecutable(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
  try {
    chmodSync(filePath, 0o755);
  } catch {
    // ignore (Windows)
  }
}

export function createTestEndpoint(tool: CliToolName, options?: { binDir?: string }): TestEndpoint {
  const binDir = options?.binDir ?? mkdtempSync(join(tmpdir(), 'ccw-cli-executor-bin-'));
  const isWindows = process.platform === 'win32';

  const commandPath = isWindows ? join(binDir, `${tool}.cmd`) : join(binDir, tool);
  if (isWindows) {
    writeExecutable(
      commandPath,
      `@echo off\r\nnode "${CLI_TOOL_STUB_PATH}" "${tool}" %*\r\n`,
    );
  } else {
    writeExecutable(
      commandPath,
      `#!/usr/bin/env sh\nexec node "${CLI_TOOL_STUB_PATH}" "${tool}" "$@"\n`,
    );
  }

  return { tool, binDir, commandPath };
}

export interface TestEnv {
  ccwHome: string;
  binDir: string;
  endpoints: TestEndpoint[];
  restore: () => void;
  cleanup: () => void;
}

export function setupTestEnv(tools: CliToolName[] = ['gemini', 'qwen', 'codex']): TestEnv {
  const ccwHome = mkdtempSync(join(tmpdir(), 'ccw-cli-executor-home-'));
  const binDir = mkdtempSync(join(tmpdir(), 'ccw-cli-executor-bin-'));

  const endpoints = tools.map((tool) => createTestEndpoint(tool, { binDir }));

  const pathKey = getPathKey();
  const envSnapshot = snapshotEnv(['CCW_DATA_DIR', pathKey]);

  process.env.CCW_DATA_DIR = ccwHome;
  const existingPath = envSnapshot[pathKey] ?? '';
  process.env[pathKey] = existingPath ? `${binDir}${delimiter}${existingPath}` : binDir;

  return {
    ccwHome,
    binDir,
    endpoints,
    restore() {
      restoreEnv(envSnapshot);
    },
    cleanup() {
      rmSync(binDir, { recursive: true, force: true });
      rmSync(ccwHome, { recursive: true, force: true });
    },
  };
}

export function validateExecutionResult(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any,
  expectations: { success?: boolean; tool?: CliToolName } = {},
): void {
  assert.equal(typeof result, 'object');
  assert.equal(typeof result.success, 'boolean');
  assert.equal(typeof result.stdout, 'string');
  assert.equal(typeof result.stderr, 'string');
  assert.equal(typeof result.execution, 'object');
  assert.equal(typeof result.conversation, 'object');

  if (expectations.success !== undefined) assert.equal(result.success, expectations.success);
  if (expectations.tool) assert.equal(result.execution.tool, expectations.tool);
}

export function makeEnhancedPrompt(input: {
  purpose: string;
  task: string;
  mode: 'analysis' | 'write' | 'auto';
  context: string;
  expected: string;
  rules: string;
  directives?: Record<string, unknown>;
}): string {
  const base = [
    `PURPOSE: ${input.purpose}`,
    `TASK: ${input.task}`,
    `MODE: ${input.mode}`,
    `CONTEXT: ${input.context}`,
    `EXPECTED: ${input.expected}`,
    `RULES: ${input.rules}`,
  ].join('\n');

  if (!input.directives) return base;
  return `${base}\nCCW_TEST_DIRECTIVES: ${JSON.stringify(input.directives)}`;
}

export function assertPathWithin(rootDir: string, targetPath: string): void {
  const rel = relative(rootDir, targetPath);
  assert.equal(rel.startsWith('..'), false);
  assert.equal(resolvePath(rootDir, rel), resolvePath(targetPath));
}

export async function closeCliHistoryStores(): Promise<void> {
  try {
    const url = new URL('../../../dist/tools/cli-history-store.js', import.meta.url);
    const historyStoreMod: any = await import(url.href);
    historyStoreMod?.closeAllStores?.();
  } catch {
    // ignore
  }
}
