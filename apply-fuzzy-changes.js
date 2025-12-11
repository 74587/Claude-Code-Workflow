import { readFileSync, writeFileSync } from 'fs';

const filePath = 'ccw/src/tools/smart-search.js';
let content = readFileSync(filePath, 'utf8');

// 1. Add buildFuzzyRegex function after detectRelationship
const buildFuzzyRegexFunc = `
/**
 * Build fuzzy regex pattern for approximate matching
 * @param {string} query - Search query string
 * @param {number} maxDistance - Edit distance tolerance (default: 1)
 * @returns {string} - Regex pattern suitable for ripgrep -e flag
 */
function buildFuzzyRegex(query, maxDistance = 1) {
  const escaped = query.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
  let pattern;
  if (maxDistance === 1) {
    pattern = escaped.split('').map(c => {
      const upper = c.toUpperCase();
      const lower = c.toLowerCase();
      if (upper !== lower) {
        return \`[\${upper}\${lower}]\`;
      }
      return c;
    }).join('');
  } else if (maxDistance === 2) {
    pattern = escaped.split('').map(c => \`\${c}?\`).join('.*');
  } else {
    pattern = escaped;
  }
  if (/^[a-zA-Z0-9_]+$/.test(query)) {
    pattern = \`\\\\b\${pattern}\\\\b\`;
  }
  return pattern;
}
`;

content = content.replace(
  /(function detectRelationship\(query\) \{[\s\S]*?\n\})\n\n(\/\*\*\n \* Classify query intent)/,
  `$1\n${buildFuzzyRegexFunc}\n$2`
);

// 2. Add fuzzy parameter to buildRipgrepCommand
content = content.replace(
  'const { query, paths = [\'.\'], contextLines = 0, maxResults = 100, includeHidden = false } = params;',
  'const { query, paths = [\'.\'], contextLines = 0, maxResults = 100, includeHidden = false, fuzzy = false } = params;'
);

// 3. Replace literal matching line with fuzzy conditional
content = content.replace(
  /\/\/ Use literal\/fixed string matching for exact mode\n  args\.push\('-F', query\);/,
  `// Use fuzzy regex or literal matching based on mode
  if (fuzzy) {
    args.push('-i', '-e', buildFuzzyRegex(query));
  } else {
    args.push('-F', query);
  }`
);

// 4. Add fuzzy case in executeAutoMode
content = content.replace(
  /(case 'exact':[\s\S]*?\};\n\n)(    case 'fuzzy':\n    case 'semantic':)/,
  `$1    case 'fuzzy':
      // Execute fuzzy mode and enrich result with classification metadata
      const fuzzyResult = await executeFuzzyMode(params);
      return {
        ...fuzzyResult,
        metadata: {
          ...fuzzyResult.metadata,
          classified_as: classification.mode,
          confidence: classification.confidence,
          reasoning: classification.reasoning
        }
      };

    case 'semantic':`
);

// 5. Replace executeFuzzyMode implementation
const fuzzyModeImpl = `async function executeFuzzyMode(params) {
  const { query, paths = [], contextLines = 0, maxResults = 100, includeHidden = false } = params;

  // Check ripgrep availability
  if (!checkToolAvailability('rg')) {
    return {
      success: false,
      error: 'ripgrep not available - please install ripgrep (rg) to use fuzzy search mode'
    };
  }

  // Build ripgrep command with fuzzy=true
  const { command, args } = buildRipgrepCommand({
    query,
    paths: paths.length > 0 ? paths : ['.'],
    contextLines,
    maxResults,
    includeHidden,
    fuzzy: true
  });

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      const results = [];

      if (code === 0 || (code === 1 && stdout.trim())) {
        const lines = stdout.split('\\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const item = JSON.parse(line);
            if (item.type === 'match') {
              const match = {
                file: item.data.path.text,
                line: item.data.line_number,
                column: item.data.submatches && item.data.submatches[0] ? item.data.submatches[0].start + 1 : 1,
                content: item.data.lines.text.trim()
              };
              results.push(match);
            }
          } catch (err) {
            continue;
          }
        }

        resolve({
          success: true,
          results,
          metadata: {
            mode: 'fuzzy',
            backend: 'ripgrep-regex',
            fuzzy_strategy: 'approximate regex',
            count: results.length,
            query
          }
        });
      } else {
        resolve({
          success: false,
          error: \`ripgrep execution failed with code \${code}: \${stderr}\`,
          results: []
        });
      }
    });

    child.on('error', (error) => {
      resolve({
        success: false,
        error: \`Failed to spawn ripgrep: \${error.message}\`,
        results: []
      });
    });
  });
}`;

content = content.replace(
  /async function executeFuzzyMode\(params\) \{[\s\S]*?  \}\n\}/,
  fuzzyModeImpl
);

writeFileSync(filePath, content, 'utf8');
console.log('Fuzzy mode implementation applied successfully');
