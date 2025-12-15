// @ts-nocheck
/**
 * Graph Routes Module
 * Handles graph visualization API endpoints for codex-lens data
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { executeCodexLens } from '../../tools/codex-lens.js';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';
import Database from 'better-sqlite3';

export interface RouteContext {
  pathname: string;
  url: URL;
  req: IncomingMessage;
  res: ServerResponse;
  initialPath: string;
  handlePostRequest: (req: IncomingMessage, res: ServerResponse, handler: (body: unknown) => Promise<any>) => void;
  broadcastToClients: (data: unknown) => void;
}

/**
 * PathMapper utility class (simplified from codex-lens Python implementation)
 * Maps source paths to index database paths
 */
class PathMapper {
  private indexRoot: string;

  constructor(indexRoot?: string) {
    this.indexRoot = indexRoot || join(homedir(), '.codexlens', 'indexes');
  }

  /**
   * Normalize path to cross-platform storage format
   * Windows: D:\path\to\dir → D/path/to/dir
   * Unix: /home/user/path → home/user/path
   */
  normalizePath(sourcePath: string): string {
    const resolved = sourcePath.replace(/\\/g, '/');

    // Handle Windows paths with drive letters
    if (process.platform === 'win32' && /^[A-Za-z]:/.test(resolved)) {
      const drive = resolved[0]; // D
      const rest = resolved.slice(2); // /path/to/dir
      return `${drive}${rest}`.replace(/^\//, '');
    }

    // Handle Unix paths - remove leading slash
    return resolved.replace(/^\//, '');
  }

  /**
   * Convert source path to index database path
   */
  sourceToIndexDb(sourcePath: string): string {
    const normalized = this.normalizePath(sourcePath);
    return join(this.indexRoot, normalized, '_index.db');
  }
}

interface GraphNode {
  id: string;
  name: string;
  type: string;
  file: string;
  line: number;
  docstring?: string;
  tokenCount?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
  sourceLine: number;
  sourceFile: string;
}

interface ImpactAnalysis {
  directDependents: string[];
  affectedFiles: string[];
}

/**
 * Map codex-lens symbol kinds to graph node types
 */
function mapSymbolKind(kind: string): string {
  const kindMap: Record<string, string> = {
    'function': 'FUNCTION',
    'class': 'CLASS',
    'method': 'METHOD',
    'variable': 'VARIABLE',
    'module': 'MODULE',
    'interface': 'CLASS', // TypeScript interfaces as CLASS
    'type': 'CLASS', // Type aliases as CLASS
  };
  return kindMap[kind.toLowerCase()] || 'VARIABLE';
}

/**
 * Map codex-lens relationship types to graph edge types
 */
function mapRelationType(relType: string): string {
  const typeMap: Record<string, string> = {
    'call': 'CALLS',
    'import': 'IMPORTS',
    'inherits': 'INHERITS',
    'uses': 'CALLS', // Fallback uses → CALLS
  };
  return typeMap[relType.toLowerCase()] || 'CALLS';
}

/**
 * Query symbols from codex-lens database
 */
async function querySymbols(projectPath: string): Promise<GraphNode[]> {
  const mapper = new PathMapper();
  const dbPath = mapper.sourceToIndexDb(projectPath);

  if (!existsSync(dbPath)) {
    return [];
  }

  try {
    const db = Database(dbPath, { readonly: true });

    const rows = db.prepare(`
      SELECT
        s.id,
        s.name,
        s.kind,
        s.start_line,
        s.token_count,
        s.symbol_type,
        f.path as file
      FROM symbols s
      JOIN files f ON s.file_id = f.id
      ORDER BY f.path, s.start_line
    `).all();

    db.close();

    return rows.map((row: any) => ({
      id: `${row.file}:${row.name}:${row.start_line}`,
      name: row.name,
      type: mapSymbolKind(row.kind),
      file: row.file,
      line: row.start_line,
      docstring: row.symbol_type || undefined,
      tokenCount: row.token_count || undefined,
    }));
  } catch (err) {
    console.error(`[Graph] Failed to query symbols: ${err.message}`);
    return [];
  }
}

/**
 * Query code relationships from codex-lens database
 */
async function queryRelationships(projectPath: string): Promise<GraphEdge[]> {
  const mapper = new PathMapper();
  const dbPath = mapper.sourceToIndexDb(projectPath);

  if (!existsSync(dbPath)) {
    return [];
  }

  try {
    const db = Database(dbPath, { readonly: true });

    const rows = db.prepare(`
      SELECT
        s.name as source_name,
        s.start_line as source_line,
        f.path as source_file,
        r.target_qualified_name,
        r.relationship_type,
        r.target_file
      FROM code_relationships r
      JOIN symbols s ON r.source_symbol_id = s.id
      JOIN files f ON s.file_id = f.id
      ORDER BY f.path, s.start_line
    `).all();

    db.close();

    return rows.map((row: any) => ({
      source: `${row.source_file}:${row.source_name}:${row.source_line}`,
      target: row.target_qualified_name,
      type: mapRelationType(row.relationship_type),
      sourceLine: row.source_line,
      sourceFile: row.source_file,
    }));
  } catch (err) {
    console.error(`[Graph] Failed to query relationships: ${err.message}`);
    return [];
  }
}

/**
 * Perform impact analysis for a symbol
 * Find all symbols that depend on this symbol (direct and transitive)
 */
async function analyzeImpact(projectPath: string, symbolId: string): Promise<ImpactAnalysis> {
  const mapper = new PathMapper();
  const dbPath = mapper.sourceToIndexDb(projectPath);

  if (!existsSync(dbPath)) {
    return { directDependents: [], affectedFiles: [] };
  }

  try {
    const db = Database(dbPath, { readonly: true });

    // Parse symbolId to extract symbol name
    const parts = symbolId.split(':');
    const symbolName = parts.length >= 2 ? parts[1] : symbolId;

    // Find all symbols that reference this symbol
    const rows = db.prepare(`
      SELECT DISTINCT
        s.name as dependent_name,
        f.path as dependent_file,
        s.start_line as dependent_line
      FROM code_relationships r
      JOIN symbols s ON r.source_symbol_id = s.id
      JOIN files f ON s.file_id = f.id
      WHERE r.target_qualified_name LIKE ?
    `).all(`%${symbolName}%`);

    db.close();

    const directDependents = rows.map((row: any) =>
      `${row.dependent_file}:${row.dependent_name}:${row.dependent_line}`
    );

    const affectedFiles = [...new Set(rows.map((row: any) => row.dependent_file))];

    return {
      directDependents,
      affectedFiles,
    };
  } catch (err) {
    console.error(`[Graph] Failed to analyze impact: ${err.message}`);
    return { directDependents: [], affectedFiles: [] };
  }
}

/**
 * Handle Graph routes
 * @returns true if route was handled, false otherwise
 */
export async function handleGraphRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath } = ctx;

  // API: Graph Nodes - Get all symbols as graph nodes
  if (pathname === '/api/graph/nodes') {
    const projectPath = url.searchParams.get('path') || initialPath;

    try {
      const nodes = await querySymbols(projectPath);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ nodes }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message, nodes: [] }));
    }
    return true;
  }

  // API: Graph Edges - Get all relationships as graph edges
  if (pathname === '/api/graph/edges') {
    const projectPath = url.searchParams.get('path') || initialPath;

    try {
      const edges = await queryRelationships(projectPath);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ edges }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message, edges: [] }));
    }
    return true;
  }

  // API: Impact Analysis - Get impact analysis for a symbol
  if (pathname === '/api/graph/impact') {
    const projectPath = url.searchParams.get('path') || initialPath;
    const symbolId = url.searchParams.get('symbol');

    if (!symbolId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'symbol parameter is required' }));
      return true;
    }

    try {
      const impact = await analyzeImpact(projectPath, symbolId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(impact));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: err.message,
        directDependents: [],
        affectedFiles: []
      }));
    }
    return true;
  }

  return false;
}
