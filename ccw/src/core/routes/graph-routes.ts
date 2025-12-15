/**
 * Graph Routes Module
 * Handles graph visualization API endpoints for codex-lens data
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { homedir } from 'os';
import { join, resolve, normalize } from 'path';
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
 * Validate and sanitize project path to prevent path traversal attacks
 * @returns sanitized absolute path or null if invalid
 */
function validateProjectPath(projectPath: string, initialPath: string): string | null {
  if (!projectPath) {
    return initialPath;
  }

  // Resolve to absolute path
  const resolved = resolve(projectPath);
  const normalized = normalize(resolved);

  // Check for path traversal attempts
  if (normalized.includes('..') || normalized !== resolved) {
    console.error(`[Graph] Path traversal attempt blocked: ${projectPath}`);
    return null;
  }

  // Ensure path exists and is a directory
  if (!existsSync(normalized)) {
    console.error(`[Graph] Path does not exist: ${normalized}`);
    return null;
  }

  return normalized;
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
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Graph] Failed to query symbols: ${message}`);
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
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Graph] Failed to query relationships: ${message}`);
    return [];
  }
}

/**
 * Sanitize a string for use in SQL LIKE patterns
 * Escapes special characters: %, _, [, ]
 */
function sanitizeForLike(input: string): string {
  return input
    .replace(/\[/g, '[[]')  // Escape [ first
    .replace(/%/g, '[%]')   // Escape %
    .replace(/_/g, '[_]');  // Escape _
}

/**
 * Validate and parse symbol ID format
 * Expected format: file:name:line or just symbolName
 * @returns sanitized symbol name or null if invalid
 */
function parseSymbolId(symbolId: string): string | null {
  if (!symbolId || symbolId.length > 500) {
    return null;
  }

  // Remove any potentially dangerous characters
  const sanitized = symbolId.replace(/[<>'";&|`$\\]/g, '');

  // Parse the format: file:name:line
  const parts = sanitized.split(':');
  if (parts.length >= 2) {
    // Return the name part (second element)
    const name = parts[1].trim();
    return name.length > 0 ? name : null;
  }

  // If no colons, use the whole string as name
  return sanitized.trim() || null;
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

  // Parse and validate symbol ID
  const symbolName = parseSymbolId(symbolId);
  if (!symbolName) {
    console.error(`[Graph] Invalid symbol ID format: ${symbolId}`);
    return { directDependents: [], affectedFiles: [] };
  }

  try {
    const db = Database(dbPath, { readonly: true });

    // Sanitize for LIKE query to prevent injection via special characters
    const sanitizedName = sanitizeForLike(symbolName);

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
    `).all(`%${sanitizedName}%`);

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
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Graph] Failed to analyze impact: ${message}`);
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
    const rawPath = url.searchParams.get('path') || initialPath;
    const projectPath = validateProjectPath(rawPath, initialPath);

    if (!projectPath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid project path', nodes: [] }));
      return true;
    }

    try {
      const nodes = await querySymbols(projectPath);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ nodes }));
    } catch (err) {
      console.error(`[Graph] Error fetching nodes:`, err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to fetch graph nodes', nodes: [] }));
    }
    return true;
  }

  // API: Graph Edges - Get all relationships as graph edges
  if (pathname === '/api/graph/edges') {
    const rawPath = url.searchParams.get('path') || initialPath;
    const projectPath = validateProjectPath(rawPath, initialPath);

    if (!projectPath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid project path', edges: [] }));
      return true;
    }

    try {
      const edges = await queryRelationships(projectPath);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ edges }));
    } catch (err) {
      console.error(`[Graph] Error fetching edges:`, err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to fetch graph edges', edges: [] }));
    }
    return true;
  }

  // API: Impact Analysis - Get impact analysis for a symbol
  if (pathname === '/api/graph/impact') {
    const rawPath = url.searchParams.get('path') || initialPath;
    const projectPath = validateProjectPath(rawPath, initialPath);
    const symbolId = url.searchParams.get('symbol');

    if (!projectPath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid project path', directDependents: [], affectedFiles: [] }));
      return true;
    }

    if (!symbolId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'symbol parameter is required', directDependents: [], affectedFiles: [] }));
      return true;
    }

    try {
      const impact = await analyzeImpact(projectPath, symbolId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(impact));
    } catch (err) {
      console.error(`[Graph] Error analyzing impact:`, err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Failed to analyze impact',
        directDependents: [],
        affectedFiles: []
      }));
    }
    return true;
  }

  // API: Search Process - Get search pipeline visualization data (placeholder)
  if (pathname === '/api/graph/search-process') {
    // This endpoint returns mock data for the search process visualization
    // In a real implementation, this would integrate with codex-lens search pipeline
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      stages: [
        { id: 1, name: 'Query Parsing', duration: 0, status: 'pending' },
        { id: 2, name: 'Vector Search', duration: 0, status: 'pending' },
        { id: 3, name: 'Graph Enrichment', duration: 0, status: 'pending' },
        { id: 4, name: 'Chunk Hierarchy', duration: 0, status: 'pending' },
        { id: 5, name: 'Result Ranking', duration: 0, status: 'pending' }
      ],
      chunks: [],
      callers: [],
      callees: [],
      message: 'Search process visualization requires an active search query'
    }));
    return true;
  }

  return false;
}
