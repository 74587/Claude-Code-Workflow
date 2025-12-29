/**
 * Integration tests for session-manager: read/write/update session content.
 *
 * Notes:
 * - Targets the runtime implementation shipped in `ccw/dist`.
 * - Uses a real temporary directory as the project root.
 */

import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const originalCwd = process.cwd();
const projectRoot = mkdtempSync(join(tmpdir(), 'ccw-session-content-'));

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

describe('session-manager integration: read/write/update', async () => {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastInit: any;
  let sessionId = 'WFS-content-1';

  beforeEach(async () => {
    sessionId = `WFS-content-${Date.now()}`;
    lastInit = await sessionManager.handler({
      operation: 'init',
      session_id: sessionId,
      metadata: { type: 'workflow', description: 'Content test session' },
    });
    assert.equal(lastInit.success, true);
  });

  it('reads session metadata and returns structured JSON', async () => {
    const res = await sessionManager.handler({
      operation: 'read',
      session_id: sessionId,
      content_type: 'session',
    });

    assert.equal(res.success, true);
    assert.equal(res.result.session_id, sessionId);
    assert.equal(res.result.is_json, true);
    assert.equal(res.result.content.session_id, sessionId);
    assert.equal(res.result.location, 'active');
  });

  it('writes and reads plan content (IMPL_PLAN.md)', async () => {
    const planText = '# Plan\n\nDo the thing.\n';
    const write = await sessionManager.handler({
      operation: 'write',
      session_id: sessionId,
      content_type: 'plan',
      content: planText,
    });
    assert.equal(write.success, true);

    const read = await sessionManager.handler({
      operation: 'read',
      session_id: sessionId,
      content_type: 'plan',
    });
    assert.equal(read.success, true);
    assert.equal(read.result.is_json, false);
    assert.equal(read.result.content, planText);
    assert.equal(existsSync(join(lastInit.result.path, 'IMPL_PLAN.md')), true);
  });

  it('writes and reads task JSON content', async () => {
    const taskId = 'T1';
    const task = { id: taskId, title: 'My Task', status: 'pending' };

    const write = await sessionManager.handler({
      operation: 'write',
      session_id: sessionId,
      content_type: 'task',
      path_params: { task_id: taskId },
      content: task,
    });
    assert.equal(write.success, true);
    assert.deepEqual(write.result.written_content, task);

    const read = await sessionManager.handler({
      operation: 'read',
      session_id: sessionId,
      content_type: 'task',
      path_params: { task_id: taskId },
    });
    assert.equal(read.success, true);
    assert.equal(read.result.is_json, true);
    assert.deepEqual(read.result.content, task);
  });

  it('writes and reads summary content', async () => {
    const taskId = 'T2';
    const summary = 'Summary text\n';

    const write = await sessionManager.handler({
      operation: 'write',
      session_id: sessionId,
      content_type: 'summary',
      path_params: { task_id: taskId },
      content: summary,
    });
    assert.equal(write.success, true);
    assert.equal(write.result.written_content, summary);

    const read = await sessionManager.handler({
      operation: 'read',
      session_id: sessionId,
      content_type: 'summary',
      path_params: { task_id: taskId },
    });
    assert.equal(read.success, true);
    assert.equal(read.result.is_json, false);
    assert.equal(read.result.content, summary);
  });

  it('updates existing JSON content via shallow merge', async () => {
    const taskId = 'T3';
    const write = await sessionManager.handler({
      operation: 'write',
      session_id: sessionId,
      content_type: 'task',
      path_params: { task_id: taskId },
      content: { id: taskId, title: 'Merge target', status: 'pending' },
    });
    assert.equal(write.success, true);

    const update = await sessionManager.handler({
      operation: 'update',
      session_id: sessionId,
      content_type: 'task',
      path_params: { task_id: taskId },
      content: { status: 'completed', extra: { ok: true } },
    });
    assert.equal(update.success, true);
    assert.deepEqual(update.result.fields_updated, ['status', 'extra']);

    const filePath = join(lastInit.result.path, '.task', `${taskId}.json`);
    const onDisk = readJson(filePath);
    assert.equal(onDisk.status, 'completed');
    assert.equal(onDisk.title, 'Merge target');
    assert.deepEqual(onDisk.extra, { ok: true });
  });

  it('returns clear errors for non-existent sessions', async () => {
    const res = await sessionManager.handler({
      operation: 'read',
      session_id: 'WFS-does-not-exist',
      content_type: 'plan',
    });
    assert.equal(res.success, false);
    assert.ok(res.error.includes('not found'));
  });

  it('rejects invalid content types via schema validation', async () => {
    const res = await sessionManager.handler({
      operation: 'read',
      session_id: sessionId,
      content_type: 'not-a-type',
    });
    assert.equal(res.success, false);
    assert.ok(res.error.includes('Invalid params'));
  });

  it('rejects path traversal characters in path_params', async () => {
    const res = await sessionManager.handler({
      operation: 'read',
      session_id: sessionId,
      content_type: 'task',
      path_params: { task_id: '../evil' },
    });
    assert.equal(res.success, false);
    assert.ok(res.error.includes('path traversal'));
  });
});

