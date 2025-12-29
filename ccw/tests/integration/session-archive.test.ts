/**
 * Integration tests for session-manager: archiving, stats, and cleanup helpers.
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
const projectRoot = mkdtempSync(join(tmpdir(), 'ccw-session-archive-'));

const sessionManagerUrl = new URL('../../dist/tools/session-manager.js', import.meta.url);
sessionManagerUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sessionManager: any;

function workflowPath(...parts: string[]): string {
  return join(projectRoot, '.workflow', ...parts);
}

function readJson(filePath: string): any {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

async function initWfsSession(sessionId: string): Promise<any> {
  const res = await sessionManager.handler({
    operation: 'init',
    session_id: sessionId,
    metadata: { type: 'workflow', description: 'Archive test session' },
  });
  assert.equal(res.success, true);
  return res;
}

describe('session-manager integration: archive/stats/delete', async () => {
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

  it('archives an active WFS session into archives/ and updates status when requested', async () => {
    const sessionId = `WFS-archive-${Date.now()}`;
    const init = await initWfsSession(sessionId);

    // Write some session content for stats.
    await sessionManager.handler({
      operation: 'write',
      session_id: sessionId,
      content_type: 'plan',
      content: '# plan\n',
    });
    await sessionManager.handler({
      operation: 'write',
      session_id: sessionId,
      content_type: 'task',
      path_params: { task_id: 'T1' },
      content: { id: 'T1', status: 'pending' },
    });
    await sessionManager.handler({
      operation: 'write',
      session_id: sessionId,
      content_type: 'task',
      path_params: { task_id: 'T2' },
      content: { id: 'T2', status: 'completed' },
    });
    await sessionManager.handler({
      operation: 'write',
      session_id: sessionId,
      content_type: 'summary',
      path_params: { task_id: 'T2' },
      content: 'done\n',
    });

    const archive = await sessionManager.handler({
      operation: 'archive',
      session_id: sessionId,
    });
    assert.equal(archive.success, true);
    assert.equal(archive.result.status, 'archived');

    const activePath = workflowPath('active', sessionId);
    const archivedPath = workflowPath('archives', sessionId);
    assert.equal(existsSync(activePath), false);
    assert.equal(existsSync(archivedPath), true);
    assert.equal(existsSync(join(archivedPath, '.task')), true);
    assert.equal(existsSync(join(archivedPath, '.summaries')), true);
    assert.equal(existsSync(join(archivedPath, '.process')), true);

    const meta = readJson(join(archivedPath, 'workflow-session.json'));
    assert.equal(meta.session_id, sessionId);
    assert.equal(meta.status, 'completed');
    assert.ok(typeof meta.archived_at === 'string' && meta.archived_at.length > 0);

    const list = await sessionManager.handler({
      operation: 'list',
      location: 'archived',
      include_metadata: true,
    });
    assert.equal(list.success, true);
    assert.ok(list.result.archived.some((s: any) => s.session_id === sessionId));

    const stats = await sessionManager.handler({ operation: 'stats', session_id: sessionId });
    assert.equal(stats.success, true);
    assert.equal(stats.result.location, 'archived');
    assert.equal(stats.result.tasks.total, 2);
    assert.equal(stats.result.tasks.pending, 1);
    assert.equal(stats.result.tasks.completed, 1);
    assert.equal(stats.result.summaries, 1);
    assert.equal(stats.result.has_plan, true);

    // Cleanup helper: delete a file within the (archived) session.
    const del = await sessionManager.handler({
      operation: 'delete',
      session_id: sessionId,
      file_path: 'IMPL_PLAN.md',
    });
    assert.equal(del.success, true);
    assert.equal(existsSync(join(archivedPath, 'IMPL_PLAN.md')), false);

    // Ensure init path matches expected base.
    assert.equal(init.result.path, activePath);
  });

  it('archives without status update when update_status=false', async () => {
    const sessionId = `WFS-archive-nostatus-${Date.now()}`;
    await initWfsSession(sessionId);

    const archive = await sessionManager.handler({
      operation: 'archive',
      session_id: sessionId,
      update_status: false,
    });
    assert.equal(archive.success, true);

    const archivedPath = workflowPath('archives', sessionId);
    const meta = readJson(join(archivedPath, 'workflow-session.json'));
    assert.equal(meta.status, 'initialized');
    assert.equal(meta.archived_at, undefined);
  });

  it('rejects archiving lite sessions', async () => {
    const sessionId = `lite-plan-${Date.now()}`;
    const init = await sessionManager.handler({
      operation: 'init',
      session_id: sessionId,
      metadata: { type: 'lite-plan', description: 'lite session' },
    });
    assert.equal(init.success, true);

    const archive = await sessionManager.handler({ operation: 'archive', session_id: sessionId });
    assert.equal(archive.success, false);
    assert.ok(archive.error.includes('do not support archiving'));
  });

  it('returns clear error for archiving non-existent sessions', async () => {
    const archive = await sessionManager.handler({
      operation: 'archive',
      session_id: 'WFS-does-not-exist',
    });
    assert.equal(archive.success, false);
    assert.ok(archive.error.includes('not found'));
  });
});

