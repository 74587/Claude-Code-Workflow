/**
 * Integration tests for provider routes.
 *
 * Notes:
 * - Targets runtime implementation shipped in `ccw/dist`.
 * - Exercises real HTTP request/response flow via a minimal test server.
 */

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';

const providerRoutesUrl = new URL('../../dist/core/routes/provider-routes.js', import.meta.url);
providerRoutesUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any;

before(async () => {
  mod = await import(providerRoutesUrl.href);
});

describe('Provider Routes Integration', () => {
  let server: http.Server;
  const PORT = 19998;

  function startServer() {
    server = http.createServer((req, res) => {
      const routeContext = {
        pathname: new URL(req.url!, `http://localhost:${PORT}`).pathname,
        url: new URL(req.url!, `http://localhost:${PORT}`),
        req,
        res,
        initialPath: process.cwd(),
        handlePostRequest: () => {},
        broadcastToClients: () => {},
        extractSessionIdFromPath: () => null,
        server
      };

      mod.handleProviderRoutes(routeContext).then((handled: boolean) => {
        if (!handled) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not Found' }));
        }
      }).catch((err: Error) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
    });

    return new Promise<void>((resolve) => {
      server.listen(PORT, () => resolve());
    });
  }

  function stopServer() {
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }

  describe('GET /api/providers', () => {
    it('should return list of all providers', async () => {
      await startServer();

      const response = await fetch(`http://localhost:${PORT}/api/providers`);
      const data: any = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);
      assert(Array.isArray(data.providers));
      assert(data.providers.length > 0);
      assert(data.providers.some((p: any) => p.id === 'google'));
      assert(data.providers.some((p: any) => p.id === 'qwen'));
      assert(data.providers.some((p: any) => p.id === 'openai'));
      assert(data.providers.some((p: any) => p.id === 'anthropic'));

      await stopServer();
    });

    it('should include provider name and model count', async () => {
      await startServer();

      const response = await fetch(`http://localhost:${PORT}/api/providers`);
      const data: any = await response.json();

      const googleProvider = data.providers.find((p: any) => p.id === 'google');
      assert(googleProvider);
      assert.strictEqual(googleProvider.name, 'Google AI');
      assert(typeof googleProvider.modelCount === 'number');
      assert(googleProvider.modelCount > 0);

      await stopServer();
    });
  });

  describe('GET /api/providers/:provider/models', () => {
    it('should return models for google provider', async () => {
      await startServer();

      const response = await fetch(`http://localhost:${PORT}/api/providers/google/models`);
      const data: any = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.provider, 'google');
      assert.strictEqual(data.providerName, 'Google AI');
      assert(Array.isArray(data.models));
      assert(data.models.some((m: any) => m.id === 'gemini-2.5-pro'));
      assert(data.models.some((m: any) => m.id === 'gemini-2.5-flash'));

      await stopServer();
    });

    it('should return models with capabilities and context window', async () => {
      await startServer();

      const response = await fetch(`http://localhost:${PORT}/api/providers/google/models`);
      const data: any = await response.json();

      const geminiPro = data.models.find((m: any) => m.id === 'gemini-2.5-pro');
      assert(geminiPro);
      assert.strictEqual(geminiPro.name, 'Gemini 2.5 Pro');
      assert(Array.isArray(geminiPro.capabilities));
      assert(geminiPro.capabilities.includes('text'));
      assert(geminiPro.capabilities.includes('vision'));
      assert(geminiPro.capabilities.includes('code'));
      assert(typeof geminiPro.contextWindow === 'number');

      await stopServer();
    });

    it('should return models for qwen provider', async () => {
      await startServer();

      const response = await fetch(`http://localhost:${PORT}/api/providers/qwen/models`);
      const data: any = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.provider, 'qwen');
      assert(Array.isArray(data.models));
      assert(data.models.some((m: any) => m.id === 'coder-model'));

      await stopServer();
    });

    it('should return models for openai provider', async () => {
      await startServer();

      const response = await fetch(`http://localhost:${PORT}/api/providers/openai/models`);
      const data: any = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.provider, 'openai');
      assert(Array.isArray(data.models));
      assert(data.models.some((m: any) => m.id === 'gpt-5.2'));

      await stopServer();
    });

    it('should return models for anthropic provider', async () => {
      await startServer();

      const response = await fetch(`http://localhost:${PORT}/api/providers/anthropic/models`);
      const data: any = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.provider, 'anthropic');
      assert(Array.isArray(data.models));
      assert(data.models.some((m: any) => m.id === 'sonnet'));
      assert(data.models.some((m: any) => m.id === 'opus'));

      await stopServer();
    });

    it('should return 404 for unknown provider', async () => {
      await startServer();

      const response = await fetch(`http://localhost:${PORT}/api/providers/unknown/models`);
      const data: any = await response.json();

      assert.strictEqual(response.status, 404);
      assert.strictEqual(data.success, false);
      assert(data.error.includes('Provider not found'));

      await stopServer();
    });

    it('should handle URL encoding in provider name', async () => {
      await startServer();

      const response = await fetch(`http://localhost:${PORT}/api/providers/${encodeURIComponent('google')}/models`);
      const data: any = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);

      await stopServer();
    });
  });
});
