/**
 * Integration tests for session-manager: session creation / initialization.
 *
 * Notes:
 * - Targets the runtime implementation shipped in `ccw/dist`.
 * - Uses a real temporary directory as the project root.
 */

import { after, afterEach, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const originalCwd = process.cwd();
const projectRoot = mkdtempSync(join(tmpdir(), 'ccw-session-lifecycle-'));

const sessionManagerUrl = new URL('../../dist/tools/session-manager.js', import.meta.url);
sessionManagerUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sessionManager: any;

function readJson(filePath: string): any {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function workflowPath(...parts: string[]): string {
  return join(projectRoot, '.workflow', ...parts);
}

describe('session-manager integration: init', async () => {
  before(async () => {
    process.chdir(projectRoot);
    sessionManager = await import(sessionManagerUrl.href);
  });

  afterEach(() => {
    rmSync(workflowPath(), { recursive: true, force: true });
  });

  after(() => {
    process.chdir(originalCwd);
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('initializes a WFS session with standard directory structure and workflow-session.json', async () => {
    const sessionId = 'WFS-lifecycle-1';
    const res = await sessionManager.handler({
      operation: 'init',
      session_id: sessionId,
      metadata: { type: 'workflow', description: 'Test WFS init', project: 'test' },
    });

    assert.equal(res.success, true);
    assert.equal(res.result.location, 'active');

    const base = workflowPath('active', sessionId);
    assert.equal(res.result.path, base);

    assert.equal(existsSync(join(base, '.task')), true);
    assert.equal(existsSync(join(base, '.summaries')), true);
    assert.equal(existsSync(join(base, '.process')), true);

    const metaFile = join(base, 'workflow-session.json');
    assert.equal(existsSync(metaFile), true);

    const meta = readJson(metaFile);
    assert.equal(meta.session_id, sessionId);
    assert.equal(meta.type, 'workflow');
    assert.equal(meta.status, 'initialized');
    assert.equal(meta.description, 'Test WFS init');
    assert.equal(meta.project, 'test');
    assert.ok(typeof meta.created_at === 'string' && meta.created_at.length > 0);
  });

  it('initializes lite-plan and lite-fix sessions and writes session-metadata.json', async () => {
    const litePlanId = 'lite-plan-1';
    const liteFixId = 'lite-fix-1';

    const planRes = await sessionManager.handler({
      operation: 'init',
      session_id: litePlanId,
      metadata: { type: 'lite-plan', description: 'Plan session' },
    });
    assert.equal(planRes.success, true);
    assert.equal(planRes.result.location, 'lite-plan');

    const planBase = workflowPath('.lite-plan', litePlanId);
    assert.equal(existsSync(planBase), true);
    assert.equal(existsSync(join(planBase, 'session-metadata.json')), true);
    assert.equal(existsSync(join(planBase, '.task')), false);

    const fixRes = await sessionManager.handler({
      operation: 'init',
      session_id: liteFixId,
      metadata: { type: 'lite-fix', description: 'Fix session' },
    });
    assert.equal(fixRes.success, true);
    assert.equal(fixRes.result.location, 'lite-fix');

    const fixBase = workflowPath('.lite-fix', liteFixId);
    assert.equal(existsSync(fixBase), true);
    assert.equal(existsSync(join(fixBase, 'session-metadata.json')), true);
    assert.equal(existsSync(join(fixBase, '.task')), false);
  });

  it('prevents duplicate session IDs across all locations', async () => {
    const sessionId = 'WFS-dup-1';

    const first = await sessionManager.handler({
      operation: 'init',
      session_id: sessionId,
      metadata: { type: 'workflow' },
    });
    assert.equal(first.success, true);

    const second = await sessionManager.handler({
      operation: 'init',
      session_id: sessionId,
      metadata: { type: 'lite-plan' },
    });
    assert.equal(second.success, false);
    assert.ok(second.error.includes('already exists'));
  });

  it('rejects invalid session IDs', async () => {
    const res = await sessionManager.handler({
      operation: 'init',
      session_id: 'bad/session',
      metadata: { type: 'workflow' },
    });
    assert.equal(res.success, false);
    assert.ok(res.error.includes('Invalid session_id format'));
  });
});

