/**
 * Analysis Routes Module
 * Provides API endpoints for viewing analysis sessions from .workflow/.analysis/
 *
 * Endpoints:
 * - GET /api/analysis - Returns list of all analysis sessions
 * - GET /api/analysis/:id - Returns detailed content of a specific session
 */

import { readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { RouteContext } from './types.js';
import { resolvePath } from '../../utils/path-resolver.js';
import { readJsonFileEx, readTextFileEx, toNullable } from '../../utils/file-reader.js';

// Concurrency limit for processing folders
const MAX_CONCURRENT = 10;
// Timeout for individual file operations (ms)
const FILE_TIMEOUT = 5000;

/**
 * Analysis session summary for list view
 */
export interface AnalysisSessionSummary {
  id: string;
  name: string;
  topic: string;
  createdAt: string;
  status: 'in_progress' | 'completed' | 'error';
  hasConclusions: boolean;
}

/**
 * Analysis session detail
 */
export interface AnalysisSessionDetail {
  id: string;
  name: string;
  topic: string;
  createdAt: string;
  status: 'in_progress' | 'completed' | 'error';
  discussion: string | null;
  conclusions: Record<string, unknown> | null;
  explorations: Record<string, unknown> | null;
  perspectives: Record<string, unknown> | null;
}

/**
 * Parse session folder name to extract metadata
 */
function parseSessionId(folderName: string): { slug: string; date: string } | null {
  // Preferred format: ANL-{YYYY-MM-DD}-{slug}
  const matchNew = folderName.match(/^ANL-(\d{4}-\d{2}-\d{2})-(.+)$/);
  if (matchNew) return { slug: matchNew[2], date: matchNew[1] };

  // Legacy format: ANL-{slug}-{YYYY-MM-DD} (kept for backward compatibility)
  const matchOld = folderName.match(/^ANL-(.+)-(\d{4}-\d{2}-\d{2})$/);
  if (matchOld) return { slug: matchOld[1], date: matchOld[2] };

  return null;
}

/**
 * Get analysis session summary from folder
 */
async function getSessionSummary(
  analysisDir: string,
  folderName: string
): Promise<AnalysisSessionSummary | null> {
  const parsed = parseSessionId(folderName);
  if (!parsed) return null;

  const sessionPath = join(analysisDir, folderName);
  const folderStat = await stat(sessionPath);
  if (!folderStat.isDirectory()) return null;

  const conclusionsPath = join(sessionPath, 'conclusions.json');
  const conclusionsResult = await readJsonFileEx<Record<string, unknown>>(conclusionsPath);
  const conclusions = toNullable(conclusionsResult);

  // Derive status from 3-state result
  const status: 'in_progress' | 'completed' | 'error' =
    conclusionsResult.status === 'ok' ? 'completed'
    : conclusionsResult.status === 'corrupt' ? 'error'
    : 'in_progress';

  // Extract topic from conclusions or folder name (3-tier fallback)
  const topic = (conclusions?.topic as string) || parsed.slug.replace(/-/g, ' ');

  return {
    id: folderName,
    name: folderName,
    topic,
    createdAt: parsed.date,
    status,
    hasConclusions: conclusionsResult.status === 'ok'
  };
}

/**
 * Get detailed session content
 */
async function getSessionDetail(
  analysisDir: string,
  sessionId: string
): Promise<AnalysisSessionDetail | null> {
  const parsed = parseSessionId(sessionId);
  if (!parsed) return null;

  const sessionPath = join(analysisDir, sessionId);
  if (!existsSync(sessionPath)) return null;

  const [discussionResult, conclusionsResult, explorationsResult, perspectivesResult] = await Promise.all([
    readTextFileEx(join(sessionPath, 'discussion.md')),
    readJsonFileEx<Record<string, unknown>>(join(sessionPath, 'conclusions.json')),
    readJsonFileEx<Record<string, unknown>>(join(sessionPath, 'explorations.json')),
    readJsonFileEx<Record<string, unknown>>(join(sessionPath, 'perspectives.json'))
  ]);

  const discussion = toNullable(discussionResult);
  const conclusions = toNullable(conclusionsResult);
  const explorations = toNullable(explorationsResult);
  const perspectives = toNullable(perspectivesResult);

  const topic = (conclusions?.topic as string) || parsed.slug.replace(/-/g, ' ');

  // Derive status from 3-state conclusions result
  const status: 'in_progress' | 'completed' | 'error' =
    conclusionsResult.status === 'ok' ? 'completed'
    : conclusionsResult.status === 'corrupt' ? 'error'
    : 'in_progress';

  return {
    id: sessionId,
    name: sessionId,
    topic,
    createdAt: parsed.date,
    status,
    discussion,
    conclusions,
    explorations,
    perspectives
  };
}

/**
 * Handle analysis routes
 * @returns true if route was handled, false otherwise
 */
export async function handleAnalysisRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, req, res, initialPath } = ctx;

  // GET /api/analysis - List all analysis sessions
  if (pathname === '/api/analysis' && req.method === 'GET') {
    try {
      const projectPath = ctx.url.searchParams.get('projectPath') || initialPath;
      const limit = Math.min(parseInt(ctx.url.searchParams.get('limit') || '50', 10), 100);
      const offset = parseInt(ctx.url.searchParams.get('offset') || '0', 10);
      const resolvedPath = resolvePath(projectPath);
      const analysisDir = join(resolvedPath, '.workflow', '.analysis');

      if (!existsSync(analysisDir)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: [], total: 0 }));
        return true;
      }

      const folders = await readdir(analysisDir);

      // Parallel processing for better performance
      const summaries = await Promise.all(
        folders.map(folder => getSessionSummary(analysisDir, folder))
      );

      // Filter valid sessions and sort by date descending
      const allSessions = summaries
        .filter((s): s is AnalysisSessionSummary => s !== null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const total = allSessions.length;
      const paginatedSessions = allSessions.slice(offset, offset + limit);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: paginatedSessions, total }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (error as Error).message }));
      return true;
    }
  }

  // GET /api/analysis/:id - Get session detail
  const detailMatch = pathname.match(/^\/api\/analysis\/([^/]+)$/);
  if (detailMatch && req.method === 'GET') {
    try {
      const sessionId = decodeURIComponent(detailMatch[1]!);
      const projectPath = ctx.url.searchParams.get('projectPath') || initialPath;
      const resolvedPath = resolvePath(projectPath);
      const analysisDir = join(resolvedPath, '.workflow', '.analysis');

      const detail = await getSessionDetail(analysisDir, sessionId);

      if (!detail) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Session not found' }));
        return true;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: detail }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (error as Error).message }));
      return true;
    }
  }

  return false;
}
