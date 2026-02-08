/**
 * Unsplash Proxy Routes & Background Image Upload
 * Proxies Unsplash API requests to keep API key server-side.
 * API key is read from process.env.UNSPLASH_ACCESS_KEY.
 * Also handles local background image upload and serving.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { homedir } from 'os';
import type { RouteContext } from './types.js';

const UNSPLASH_API = 'https://api.unsplash.com';

// Background upload config
const UPLOADS_DIR = join(homedir(), '.ccw', 'uploads', 'backgrounds');
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

function getAccessKey(): string | undefined {
  return process.env.UNSPLASH_ACCESS_KEY;
}

interface UnsplashPhoto {
  id: string;
  urls: { thumb: string; small: string; regular: string };
  user: { name: string; links: { html: string } };
  links: { html: string; download_location: string };
  blur_hash: string | null;
}

interface UnsplashSearchResult {
  results: UnsplashPhoto[];
  total: number;
  total_pages: number;
}

export async function handleBackgroundRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, req, res } = ctx;

  // POST /api/background/upload
  if (pathname === '/api/background/upload' && req.method === 'POST') {
    const contentType = req.headers['content-type'] || '';
    if (!ALLOWED_TYPES.has(contentType)) {
      res.writeHead(415, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unsupported image type. Only JPEG, PNG, WebP, GIF allowed.' }));
      return true;
    }

    try {
      const chunks: Buffer[] = [];
      let totalSize = 0;

      for await (const chunk of req) {
        totalSize += chunk.length;
        if (totalSize > MAX_UPLOAD_SIZE) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'File too large. Maximum size is 10MB.' }));
          return true;
        }
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      const ext = EXT_MAP[contentType] || 'bin';
      const filename = `${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`;

      mkdirSync(UPLOADS_DIR, { recursive: true });
      writeFileSync(join(UPLOADS_DIR, filename), buffer);

      const url = `/api/background/uploads/${filename}`;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ url, filename }));
    } catch (err) {
      console.error('[background] Upload error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Upload failed' }));
    }
    return true;
  }

  // GET /api/background/uploads/:filename
  if (pathname.startsWith('/api/background/uploads/') && req.method === 'GET') {
    const filename = pathname.slice('/api/background/uploads/'.length);

    // Security: reject path traversal
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid filename' }));
      return true;
    }

    const filePath = join(UPLOADS_DIR, filename);
    if (!existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found' }));
      return true;
    }

    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mime = MIME_MAP[ext] || 'application/octet-stream';

    try {
      const data = readFileSync(filePath);
      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': data.length,
        'Cache-Control': 'public, max-age=86400',
      });
      res.end(data);
    } catch (err) {
      console.error('[background] Serve error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read file' }));
    }
    return true;
  }

  return false;
}

export async function handleUnsplashRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res } = ctx;

  // GET /api/unsplash/search?query=...&page=1&per_page=20
  if (pathname === '/api/unsplash/search' && req.method === 'GET') {
    const accessKey = getAccessKey();
    if (!accessKey) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unsplash API key not configured' }));
      return true;
    }

    const query = url.searchParams.get('query') || '';
    const page = url.searchParams.get('page') || '1';
    const perPage = url.searchParams.get('per_page') || '20';

    if (!query.trim()) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing query parameter' }));
      return true;
    }

    try {
      const apiUrl = `${UNSPLASH_API}/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}&orientation=landscape`;
      const response = await fetch(apiUrl, {
        headers: { Authorization: `Client-ID ${accessKey}` },
      });

      if (!response.ok) {
        const status = response.status;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Unsplash API error: ${status}` }));
        return true;
      }

      const data = (await response.json()) as UnsplashSearchResult;

      // Return simplified data
      const photos = data.results.map((photo) => ({
        id: photo.id,
        thumbUrl: photo.urls.thumb,
        smallUrl: photo.urls.small,
        regularUrl: photo.urls.regular,
        photographer: photo.user.name,
        photographerUrl: photo.user.links.html,
        photoUrl: photo.links.html,
        blurHash: photo.blur_hash,
        downloadLocation: photo.links.download_location,
      }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        photos,
        total: data.total,
        totalPages: data.total_pages,
      }));
    } catch (err) {
      console.error('[unsplash] Search error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to search Unsplash' }));
    }
    return true;
  }

  // POST /api/unsplash/download — trigger download event (Unsplash API requirement)
  if (pathname === '/api/unsplash/download' && req.method === 'POST') {
    const accessKey = getAccessKey();
    if (!accessKey) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unsplash API key not configured' }));
      return true;
    }

    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString());
      const downloadLocation = body.downloadLocation;

      if (!downloadLocation) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing downloadLocation' }));
        return true;
      }

      // Trigger download event (Unsplash API guideline)
      await fetch(downloadLocation, {
        headers: { Authorization: `Client-ID ${accessKey}` },
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      console.error('[unsplash] Download trigger error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to trigger download' }));
    }
    return true;
  }

  return false;
}
