/**
 * Spec Routes Module
 * Handles all spec management API endpoints
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { resolvePath } from '../../utils/path-resolver.js';
import type { RouteContext } from './types.js';

/**
 * Handle Spec routes
 * @returns true if route was handled, false otherwise
 */
export async function handleSpecRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath, handlePostRequest } = ctx;

  // API: List all specs from index
  if (pathname === '/api/specs/list' && req.method === 'GET') {
    const projectPath = url.searchParams.get('path') || initialPath;
    const resolvedPath = resolvePath(projectPath);

    try {
      const { getDimensionIndex, SPEC_DIMENSIONS } = await import(
        '../../tools/spec-index-builder.js'
      );

      const result: Record<string, unknown[]> = {};

      for (const dim of SPEC_DIMENSIONS) {
        const index = await getDimensionIndex(resolvedPath, dim);
        result[dim] = index.entries;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ specs: result }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // API: Get spec detail (MD content)
  if (pathname === '/api/specs/detail' && req.method === 'GET') {
    const projectPath = url.searchParams.get('path') || initialPath;
    const resolvedPath = resolvePath(projectPath);
    const file = url.searchParams.get('file');

    if (!file) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing file parameter' }));
      return true;
    }

    const filePath = join(resolvedPath, file);

    if (!existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found' }));
      return true;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ content }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // API: Update frontmatter (toggle readMode)
  if (pathname === '/api/specs/update-frontmatter' && req.method === 'PUT') {
    handlePostRequest(req, res, async (body) => {
      const projectPath = url.searchParams.get('path') || initialPath;
      const resolvedPath = resolvePath(projectPath);
      const data = body as { file: string; readMode: string };

      if (!data.file || !data.readMode) {
        return { error: 'Missing file or readMode', status: 400 };
      }

      const filePath = join(resolvedPath, data.file);

      if (!existsSync(filePath)) {
        return { error: 'File not found', status: 404 };
      }

      try {
        const matter = (await import('gray-matter')).default;
        const raw = readFileSync(filePath, 'utf-8');
        const parsed = matter(raw);

        parsed.data.readMode = data.readMode;

        const updated = matter.stringify(parsed.content, parsed.data);
        writeFileSync(filePath, updated, 'utf-8');

        return { success: true, readMode: data.readMode };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // API: Rebuild index
  if (pathname === '/api/specs/rebuild' && req.method === 'POST') {
    handlePostRequest(req, res, async () => {
      const projectPath = url.searchParams.get('path') || initialPath;
      const resolvedPath = resolvePath(projectPath);

      try {
        const { buildAllIndices, readCachedIndex, SPEC_DIMENSIONS } = await import(
          '../../tools/spec-index-builder.js'
        );

        await buildAllIndices(resolvedPath);

        const stats: Record<string, number> = {};
        for (const dim of SPEC_DIMENSIONS) {
          const cached = readCachedIndex(resolvedPath, dim);
          stats[dim] = cached?.entries.length ?? 0;
        }

        return { success: true, stats };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // API: Init spec system
  if (pathname === '/api/specs/init' && req.method === 'POST') {
    handlePostRequest(req, res, async () => {
      const projectPath = url.searchParams.get('path') || initialPath;
      const resolvedPath = resolvePath(projectPath);

      try {
        const { initSpecSystem } = await import('../../tools/spec-init.js');
        const result = initSpecSystem(resolvedPath);
        return { success: true, ...result };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // API: Get spec stats (dimensions count + injection length info)
  if (pathname === '/api/specs/stats' && req.method === 'GET') {
    const projectPath = url.searchParams.get('path') || initialPath;
    const resolvedPath = resolvePath(projectPath);

    try {
      const { getDimensionIndex, SPEC_DIMENSIONS } = await import(
        '../../tools/spec-index-builder.js'
      );

      // Get maxLength from system settings
      let maxLength = 8000;
      const settingsPath = join(homedir(), '.claude', 'settings.json');

      if (existsSync(settingsPath)) {
        try {
          const rawSettings = readFileSync(settingsPath, 'utf-8');
          const settings = JSON.parse(rawSettings) as {
            system?: { injectionControl?: { maxLength?: number } };
          };
          maxLength = settings?.system?.injectionControl?.maxLength || 8000;
        } catch { /* ignore */ }
      }

      const dimensions: Record<string, { count: number; requiredCount: number }> = {};
      let totalRequiredLength = 0;
      let totalWithKeywords = 0;

      for (const dim of SPEC_DIMENSIONS) {
        const index = await getDimensionIndex(resolvedPath, dim);
        let count = 0;
        let requiredCount = 0;

        for (const entry of index.entries) {
          count++;
          // Calculate content length by reading the file
          const filePath = join(resolvedPath, entry.file);
          let contentLength = 0;
          try {
            if (existsSync(filePath)) {
              const rawContent = readFileSync(filePath, 'utf-8');
              // Strip frontmatter to get actual content length
              const matter = (await import('gray-matter')).default;
              const parsed = matter(rawContent);
              contentLength = parsed.content.length;
            }
          } catch { /* ignore */ }

          if (entry.readMode === 'required') {
            requiredCount++;
            totalRequiredLength += contentLength;
          }
          totalWithKeywords += contentLength;
        }

        dimensions[dim] = { count, requiredCount };
      }

      const percentage = totalWithKeywords > 0 ? Math.round((totalWithKeywords / maxLength) * 100) : 0;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        dimensions,
        injectionLength: {
          requiredOnly: totalRequiredLength,
          withKeywords: totalWithKeywords,
          maxLength,
          percentage
        }
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  return false;
}
