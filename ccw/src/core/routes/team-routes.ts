/**
 * Team Routes - REST API for team message visualization
 *
 * Endpoints:
 * - GET /api/teams           - List all teams
 * - GET /api/teams/:name/messages - Get messages (with filters)
 * - GET /api/teams/:name/status   - Get member status summary
 */

import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import type { RouteContext } from './types.js';
import { readAllMessages, getLogDir } from '../../tools/team-msg.js';
import { getProjectRoot } from '../../utils/path-validator.js';

export async function handleTeamRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, req, res, url } = ctx;

  if (!pathname.startsWith('/api/teams')) return false;
  if (req.method !== 'GET') return false;

  // GET /api/teams - List all teams
  if (pathname === '/api/teams') {
    try {
      const root = getProjectRoot();
      const teamMsgDir = join(root, '.workflow', '.team-msg');

      if (!existsSync(teamMsgDir)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ teams: [] }));
        return true;
      }

      const entries = readdirSync(teamMsgDir, { withFileTypes: true });
      const teams = entries
        .filter(e => e.isDirectory())
        .map(e => {
          const messages = readAllMessages(e.name);
          const lastMsg = messages[messages.length - 1];
          return {
            name: e.name,
            messageCount: messages.length,
            lastActivity: lastMsg?.ts || '',
          };
        })
        .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ teams }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (error as Error).message }));
      return true;
    }
  }

  // Match /api/teams/:name/messages or /api/teams/:name/status
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

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ total, showing: sliced.length, messages: sliced }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (error as Error).message }));
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

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ members, total_messages: messages.length }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (error as Error).message }));
      return true;
    }
  }

  return false;
}
