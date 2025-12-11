#!/usr/bin/env python3
import re

# Read the file
with open('ccw/src/tools/smart-search.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Update imports
content = content.replace(
    "import { existsSync, readdirSync, statSync } from 'fs';",
    "import { existsSync, readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'fs';"
)

# Fix 2: Remove duplicate query declaration in buildRipgrepCommand (keep fuzzy version)
content = re.sub(
    r'(function buildRipgrepCommand\(params\) \{\s*const \{ query, paths = \[.*?\], contextLines = 0, maxResults = 100, includeHidden = false \} = params;\s*)',
    '',
    content,
    count=1
)

# Fix 3: Remove errant 'n' character
content = re.sub(r'\nn/\*\*', r'\n/**', content)

# Fix 4: Remove duplicated lines in buildRipgrepCommand
lines = content.split('\n')
fixed_lines = []
skip_next = False
for i, line in enumerate(lines):
    if skip_next:
        skip_next = False
        continue

    # Skip duplicate ripgrep command logic
    if '// Use literal/fixed string matching for exact mode' in line:
        # Skip old version
        if i + 3 < len(lines) and 'args.push(...paths)' in lines[i + 3]:
            skip_next = False
            continue

    if '// Use fuzzy regex or literal matching based on mode' in line:
        # Keep fuzzy version
        fixed_lines.append(line)
        continue

    fixed_lines.append(line)

content = '\n'.join(fixed_lines)

# Fix 5: Replace executeGraphMode implementation
graph_impl = '''/**
 * Parse import statements from file content
 * @param {string} fileContent - File content to parse
 * @returns {Array<{source: string, specifiers: string[]}>}
 */
function parseImports(fileContent) {
  const imports = [];

  // Pattern 1: ES6 import statements
  const es6ImportPattern = /import\\s+(?:(?:(\\*\\s+as\\s+\\w+)|(\\w+)|(?:\\{([^}]+)\\}))\\s+from\\s+)?['\"]([^'\"]+)['\"]/g;
  let match;

  while ((match = es6ImportPattern.exec(fileContent)) !== null) {
    const source = match[4];
    const specifiers = [];

    if (match[1]) specifiers.push(match[1]);
    else if (match[2]) specifiers.push(match[2]);
    else if (match[3]) {
      const named = match[3].split(',').map(s => s.trim());
      specifiers.push(...named);
    }

    imports.push({ source, specifiers });
  }

  // Pattern 2: CommonJS require()
  const requirePattern = /require\\(['\"]([^'\"]+)['\"]\\)/g;
  while ((match = requirePattern.exec(fileContent)) !== null) {
    imports.push({ source: match[1], specifiers: [] });
  }

  // Pattern 3: Dynamic import()
  const dynamicImportPattern = /import\\(['\"]([^'\"]+)['\"]\\)/g;
  while ((match = dynamicImportPattern)) !== null) {
    imports.push({ source: match[1], specifiers: [] });
  }

  // Pattern 4: TypeScript import type
  const typeImportPattern = /import\\s+type\\s+(?:\\{([^}]+)\\})\\s+from\\s+['\"]([^'\"]+)['\"]/g;
  while ((match = typeImportPattern.exec(fileContent)) !== null) {
    const source = match[2];
    const specifiers = match[1].split(',').map(s => s.trim());
    imports.push({ source, specifiers });
  }

  return imports;
}

/**
 * Parse export statements from file content
 * @param {string} fileContent - File content to parse
 * @returns {Array<{name: string, type: string}>}
 */
function parseExports(fileContent) {
  const exports = [];

  // Pattern 1: export default
  const defaultExportPattern = /export\\s+default\\s+(?:class|function|const|let|var)?\\s*(\\w+)?/g;
  let match;

  while ((match = defaultExportPattern.exec(fileContent)) !== null) {
    exports.push({ name: match[1] || 'default', type: 'default' });
  }

  // Pattern 2: export named declarations
  const namedDeclPattern = /export\\s+(?:const|let|var|function|class)\\s+(\\w+)/g;
  while ((match = namedDeclPattern.exec(fileContent)) !== null) {
    exports.push({ name: match[1], type: 'named' });
  }

  // Pattern 3: export { ... }
  const namedExportPattern = /export\\s+\\{([^}]+)\\}/g;
  while ((match = namedExportPattern.exec(fileContent)) !== null) {
    const names = match[1].split(',').map(s => {
      const parts = s.trim().split(/\\s+as\\s+/);
      return parts[parts.length - 1];
    });

    names.forEach(name => {
      exports.push({ name: name.trim(), type: 'named' });
    });
  }

  return exports;
}

/**
 * Build dependency graph by scanning project files
 * @param {string} rootPath - Root directory to scan
 * @param {string[]} gitignorePatterns - Patterns to exclude
 * @returns {{nodes: Array, edges: Array, metadata: Object}}
 */
function buildDependencyGraph(rootPath, gitignorePatterns = []) {
  const nodes = [];
  const edges = [];
  const processedFiles = new Set();

  const SYSTEM_EXCLUDES = [
    '.git', 'node_modules', '.npm', '.yarn', '.pnpm',
    'dist', 'build', 'out', 'coverage', '.cache',
    '.next', '.nuxt', '.vite', '__pycache__', 'venv'
  ];

  function shouldExclude(name) {
    if (SYSTEM_EXCLUDES.includes(name)) return true;
    for (const pattern of gitignorePatterns) {
      if (name === pattern) return true;
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\\*/g, '.*') + '$');
        if (regex.test(name)) return true;
      }
    }
    return false;
  }

  function scanDirectory(dirPath) {
    if (!existsSync(dirPath)) return;

    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (shouldExclude(entry.name)) continue;

        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          scanDirectory(fullPath);
        } else if (entry.isFile()) {
          const ext = entry.name.split('.').pop();
          if (['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx'].includes(ext)) {
            processFile(fullPath);
          }
        }
      }
    } catch (err) {
      // Skip directories we can't read
    }
  }

  function processFile(filePath) {
    if (processedFiles.has(filePath)) return;
    processedFiles.add(filePath);

    try {
      const content = readFileSync(filePath, 'utf8');
      const relativePath = './' + filePath.replace(rootPath, '').replace(/\\\\/g, '/').replace(/^\\//, '');

      const fileExports = parseExports(content);

      nodes.push({
        id: relativePath,
        path: filePath,
        exports: fileExports
      });

      const imports = parseImports(content);

      imports.forEach(imp => {
        let targetPath = imp.source;

        if (!targetPath.startsWith('.') && !targetPath.startsWith('/')) {
          return;
        }

        const targetRelative = './' + targetPath.replace(/^\\.\\//, '');

        edges.push({
          from: relativePath,
          to: targetRelative,
          imports: imp.specifiers
        });
      });
    } catch (err) {
      // Skip files we can't read or parse
    }
  }

  scanDirectory(rootPath);

  const circularDeps = detectCircularDependencies(edges);

  return {
    nodes,
    edges,
    metadata: {
      timestamp: Date.now(),
      rootPath,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      circular_deps_detected: circularDeps.length > 0,
      circular_deps: circularDeps
    }
  };
}

/**
 * Detect circular dependencies in the graph
 * @param {Array} edges - Graph edges
 * @returns {Array} List of circular dependency chains
 */
function detectCircularDependencies(edges) {
  const cycles = [];
  const visited = new Set();
  const recStack = new Set();

  const graph = {};
  edges.forEach(edge => {
    if (!graph[edge.from]) graph[edge.from] = [];
    graph[edge.from].push(edge.to);
  });

  function dfs(node, path = []) {
    if (recStack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        cycles.push(path.slice(cycleStart).concat(node));
      }
      return;
    }

    if (visited.has(node)) return;

    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = graph[node] || [];
    for (const neighbor of neighbors) {
      dfs(neighbor, [...path]);
    }

    recStack.delete(node);
  }

  Object.keys(graph).forEach(node => {
    if (!visited.has(node)) {
      dfs(node);
    }
  });

  return cycles;
}

/**
 * Mode: graph - Dependency and relationship traversal
 * Analyzes code relationships (imports, exports, dependencies)
 */
async function executeGraphMode(params) {
  const { query, paths = [], maxResults = 100 } = params;

  const rootPath = resolve(process.cwd(), paths[0] || '.');
  const cacheDir = join(process.cwd(), '.ccw-cache');
  const cacheFile = join(cacheDir, 'dependency-graph.json');
  const CACHE_TTL = 5 * 60 * 1000;

  let graph;

  if (existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(readFileSync(cacheFile, 'utf8'));
      const age = Date.now() - cached.metadata.timestamp;

      if (age < CACHE_TTL) {
        graph = cached;
      }
    } catch (err) {
      // Cache invalid, will rebuild
    }
  }

  if (!graph) {
    const gitignorePatterns = [];
    const gitignorePath = join(rootPath, '.gitignore');

    if (existsSync(gitignorePath)) {
      const content = readFileSync(gitignorePath, 'utf8');
      content.split('\\n').forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        gitignorePatterns.push(line.replace(/\\/$/, ''));
      });
    }

    graph = buildDependencyGraph(rootPath, gitignorePatterns);

    try {
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(cacheFile, JSON.stringify(graph, null, 2), 'utf8');
    } catch (err) {
      // Cache write failed, continue
    }
  }

  const queryLower = query.toLowerCase();
  let queryType = 'unknown';
  let filteredNodes = [];
  let filteredEdges = [];
  let queryPaths = [];

  if (queryLower.match(/imports?\\s+(\\S+)/)) {
    queryType = 'imports';
    const target = queryLower.match(/imports?\\s+(\\S+)/)[1];

    filteredEdges = graph.edges.filter(edge =>
      edge.to.includes(target) || edge.imports.some(imp => imp.toLowerCase().includes(target))
    );

    const nodeIds = new Set(filteredEdges.map(e => e.from));
    filteredNodes = graph.nodes.filter(n => nodeIds.has(n.id));
  } else if (queryLower.match(/exports?\\s+(\\S+)/)) {
    queryType = 'exports';
    const target = queryLower.match(/exports?\\s+(\\S+)/)[1];

    filteredNodes = graph.nodes.filter(node =>
      node.exports.some(exp => exp.name.toLowerCase().includes(target))
    );

    const nodeIds = new Set(filteredNodes.map(n => n.id));
    filteredEdges = graph.edges.filter(e => nodeIds.has(e.from) || nodeIds.has(e.to));
  } else if (queryLower.includes('dependency') || queryLower.includes('chain') || queryLower.includes('depends')) {
    queryType = 'dependency_chain';

    filteredNodes = graph.nodes.slice(0, maxResults);
    filteredEdges = graph.edges;

    if (graph.metadata.circular_deps && graph.metadata.circular_deps.length > 0) {
      queryPaths = graph.metadata.circular_deps.slice(0, 10);
    }
  } else {
    queryType = 'module_search';

    filteredNodes = graph.nodes.filter(node =>
      node.id.toLowerCase().includes(queryLower) ||
      node.path.toLowerCase().includes(queryLower)
    );

    const nodeIds = new Set(filteredNodes.map(n => n.id));
    filteredEdges = graph.edges.filter(e => nodeIds.has(e.from) || nodeIds.has(e.to));
  }

  if (filteredNodes.length > maxResults) {
    filteredNodes = filteredNodes.slice(0, maxResults);
  }

  return {
    success: true,
    graph: {
      nodes: filteredNodes,
      edges: filteredEdges,
      paths: queryPaths
    },
    metadata: {
      mode: 'graph',
      storage: 'json',
      query_type: queryType,
      total_nodes: graph.metadata.nodeCount,
      total_edges: graph.metadata.edgeCount,
      filtered_nodes: filteredNodes.length,
      filtered_edges: filteredEdges.length,
      circular_deps_detected: graph.metadata.circular_deps_detected,
      cached: existsSync(cacheFile),
      query
    }
  };
}
'''

# Find and replace executeGraphMode
pattern = r'/\*\*\s*\* Mode: graph.*?\* Analyzes code relationships.*?\*/\s*async function executeGraphMode\(params\) \{.*?error: \'Graph mode not implemented - dependency analysis pending\'\s*\};?\s*\}'

content = re.sub(pattern, graph_impl, content, flags=re.DOTALL)

# Write the file
with open('ccw/src/tools/smart-search.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('File updated successfully')
