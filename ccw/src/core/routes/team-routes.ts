/**
 * Team Routes - REST API for team message visualization & management
 *
 * Endpoints:
 * - GET    /api/teams                    - List all teams (with ?location filter)
 * - GET    /api/teams/:name/messages     - Get messages (with filters)
 * - GET    /api/teams/:name/status       - Get member status summary
 * - POST   /api/teams/:name/archive      - Archive a team
 * - POST   /api/teams/:name/unarchive    - Unarchive a team
 * - DELETE  /api/teams/:name              - Delete a team
 */

import { existsSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import type { RouteContext } from './types.js';
import { readAllMessages, getLogDir, getEffectiveTeamMeta, readTeamMeta, writeTeamMeta } from '../../tools/team-msg.js';
import type { TeamMeta } from '../../tools/team-msg.js';
import { getProjectRoot } from '../../utils/path-validator.js';

function jsonResponse(res: import('http').ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export async function handleTeamRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, req, res, url, handlePostRequest } = ctx;

  if (!pathname.startsWith('/api/teams')) return false;

  // ====== GET /api/teams - List all teams ======
  if (pathname === '/api/teams' && req.method === 'GET') {
    try {
      const root = getProjectRoot();
      const teamMsgDir = join(root, '.workflow', '.team-msg');

      if (!existsSync(teamMsgDir)) {
        jsonResponse(res, 200, { teams: [] });
        return true;
      }

      const locationFilter = url.searchParams.get('location') || 'active';
      const entries = readdirSync(teamMsgDir, { withFileTypes: true });

      const teams = entries
        .filter(e => e.isDirectory())
        .map(e => {
          const messages = readAllMessages(e.name);
          const lastMsg = messages[messages.length - 1];
          const meta = getEffectiveTeamMeta(e.name);

          // Count unique members from messages
          const memberSet = new Set<string>();
          for (const msg of messages) {
            memberSet.add(msg.from);
            memberSet.add(msg.to);
          }

          return {
            name: e.name,
            messageCount: messages.length,
            lastActivity: lastMsg?.ts || '',
            status: meta.status,
            created_at: meta.created_at,
            updated_at: meta.updated_at,
            archived_at: meta.archived_at,
            pipeline_mode: meta.pipeline_mode,
            memberCount: memberSet.size,
            members: Array.from(memberSet),
          };
        })
        .filter(t => {
          if (locationFilter === 'all') return true;
          if (locationFilter === 'archived') return t.status === 'archived';
          // 'active' = everything that's not archived
          return t.status !== 'archived';
        })
        .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));

      jsonResponse(res, 200, { teams });
      return true;
    } catch (error) {
      jsonResponse(res, 500, { error: (error as Error).message });
      return true;
    }
  }

  // ====== POST /api/teams/:name/archive ======
  const archiveMatch = pathname.match(/^\/api\/teams\/([^/]+)\/archive$/);
  if (archiveMatch && req.method === 'POST') {
    const teamName = decodeURIComponent(archiveMatch[1]);
    handlePostRequest(req, res, async () => {
      const dir = getLogDir(teamName);
      if (!existsSync(dir)) {
        throw new Error(`Team "${teamName}" not found`);
      }
      const meta = getEffectiveTeamMeta(teamName);
      meta.status = 'archived';
      meta.archived_at = new Date().toISOString();
      meta.updated_at = new Date().toISOString();
      writeTeamMeta(teamName, meta);
      return { success: true, team: teamName, status: 'archived' };
    });
    return true;
  }

  // ====== POST /api/teams/:name/unarchive ======
  const unarchiveMatch = pathname.match(/^\/api\/teams\/([^/]+)\/unarchive$/);
  if (unarchiveMatch && req.method === 'POST') {
    const teamName = decodeURIComponent(unarchiveMatch[1]);
    handlePostRequest(req, res, async () => {
      const dir = getLogDir(teamName);
      if (!existsSync(dir)) {
        throw new Error(`Team "${teamName}" not found`);
      }
      const meta = getEffectiveTeamMeta(teamName);
      meta.status = 'active';
      delete meta.archived_at;
      meta.updated_at = new Date().toISOString();
      writeTeamMeta(teamName, meta);
      return { success: true, team: teamName, status: 'active' };
    });
    return true;
  }

  // ====== DELETE /api/teams/:name ======
  const deleteMatch = pathname.match(/^\/api\/teams\/([^/]+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const teamName = decodeURIComponent(deleteMatch[1]);
    try {
      const dir = getLogDir(teamName);
      if (!existsSync(dir)) {
        jsonResponse(res, 404, { error: `Team "${teamName}" not found` });
        return true;
      }
      rmSync(dir, { recursive: true, force: true });
      jsonResponse(res, 200, { success: true, team: teamName, deleted: true });
      return true;
    } catch (error) {
      jsonResponse(res, 500, { error: (error as Error).message });
      return true;
    }
  }

  // ====== GET /api/teams/:name/messages or /api/teams/:name/status ======
  if (req.method !== 'GET') return false;

  const match = pathname.match(/^\/api\/teams\/([^/]+)\/(messages|status)$/);
  if (!match) return false;

  const teamName = decodeURIComponent(match[1]);
  const action = match[2];

  // GET /api/teams/:name/messages
  if (action === 'messages') {
    try {
      let messages = readAllMessages(teamName);

      // Apply query filters
      const fromFilter = url.searchParams.get('from');
      const toFilter = url.searchParams.get('to');
      const typeFilter = url.searchParams.get('type');
      const last = parseInt(url.searchParams.get('last') || '50', 10);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);

      if (fromFilter) messages = messages.filter(m => m.from === fromFilter);
      if (toFilter) messages = messages.filter(m => m.to === toFilter);
      if (typeFilter) messages = messages.filter(m => m.type === typeFilter);

      const total = messages.length;
      const sliced = messages.slice(Math.max(0, total - last - offset), total - offset);

      jsonResponse(res, 200, { total, showing: sliced.length, messages: sliced });
      return true;
    } catch (error) {
      jsonResponse(res, 500, { error: (error as Error).message });
      return true;
    }
  }

  // GET /api/teams/:name/status
  if (action === 'status') {
    try {
      const messages = readAllMessages(teamName);

      const memberMap = new Map<string, { member: string; lastSeen: string; lastAction: string; messageCount: number }>();

      for (const msg of messages) {
        for (const role of [msg.from, msg.to]) {
          if (!memberMap.has(role)) {
            memberMap.set(role, { member: role, lastSeen: msg.ts, lastAction: '', messageCount: 0 });
          }
        }
        const entry = memberMap.get(msg.from)!;
        entry.lastSeen = msg.ts;
        entry.lastAction = `sent ${msg.type} -> ${msg.to}`;
        entry.messageCount++;
      }

      const members = Array.from(memberMap.values()).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));

      jsonResponse(res, 200, { members, total_messages: messages.length });
      return true;
    } catch (error) {
      jsonResponse(res, 500, { error: (error as Error).message });
      return true;
    }
  }

  return false;
}
