/**
 * Provider Reference Routes Module
 * Handles read-only provider model reference API endpoints
 */

import type { RouteContext } from './types.js';
import {
  PROVIDER_MODELS,
  getAllProviders,
  getProviderModels
} from '../../config/provider-models.js';

/**
 * Handle Provider Reference routes
 * @returns true if route was handled, false otherwise
 */
export async function handleProviderRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, req, res } = ctx;

  // ========== GET ALL PROVIDERS ==========
  // GET /api/providers
  if (pathname === '/api/providers' && req.method === 'GET') {
    try {
      const providers = getAllProviders().map(id => ({
        id,
        name: PROVIDER_MODELS[id].name,
        modelCount: PROVIDER_MODELS[id].models.length
      }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, providers }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: (err as Error).message
      }));
    }
    return true;
  }

  // ========== GET MODELS FOR PROVIDER ==========
  // GET /api/providers/:provider/models
  const providerMatch = pathname.match(/^\/api\/providers\/([^\/]+)\/models$/);
  if (providerMatch && req.method === 'GET') {
    const provider = decodeURIComponent(providerMatch[1]);

    try {
      const models = getProviderModels(provider);

      if (models.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: `Provider not found: ${provider}`
        }));
        return true;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        provider,
        providerName: PROVIDER_MODELS[provider].name,
        models
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: (err as Error).message
      }));
    }
    return true;
  }

  return false;
}
