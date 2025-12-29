/**
 * UI Generate Preview Tool
 * Generate compare.html and index.html for UI prototypes
 */

import { readdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, basename } from 'path';

/**
 * Auto-detect matrix dimensions from file patterns
 * Pattern: {target}-style-{s}-layout-{l}.html
 */
function detectMatrixDimensions(prototypesDir) {
  const files = readdirSync(prototypesDir).filter(f => f.match(/.*-style-\d+-layout-\d+\.html$/));

  const styles = new Set();
  const layouts = new Set();
  const targets = new Set();

  files.forEach(file => {
    const styleMatch = file.match(/-style-(\d+)-/);
    const layoutMatch = file.match(/-layout-(\d+)\.html/);
    const targetMatch = file.match(/^(.+)-style-/);

    if (styleMatch) styles.add(parseInt(styleMatch[1]));
    if (layoutMatch) layouts.add(parseInt(layoutMatch[1]));
    if (targetMatch) targets.add(targetMatch[1]);
  });

  return {
    styles: Math.max(...Array.from(styles)),
    layouts: Math.max(...Array.from(layouts)),
    targets: Array.from(targets).sort()
  };
}

/**
 * Load template from file
 */
function loadTemplate(templatePath) {
  const defaultPath = resolve(
    process.env.HOME || process.env.USERPROFILE,
    '.claude/workflows/_template-compare-matrix.html'
  );

  const path = templatePath || defaultPath;

  if (!existsSync(path)) {
    // Return minimal fallback template
    return `<!DOCTYPE html>
<html>
<head><title>UI Prototypes Comparison</title></head>
<body>
<h1>UI Prototypes Matrix</h1>
<p>Styles: {{style_variants}} | Layouts: {{layout_variants}}</p>
<p>Pages: {{pages_json}}</p>
<p>Generated: {{timestamp}}</p>
</body>
</html>`;
  }

  return readFileSync(path, 'utf8');
}

/**
 * Generate compare.html from template
 */
function generateCompareHtml(template, metadata) {
  const { runId, sessionId, timestamp, styles, layouts, targets } = metadata;

  const pagesJson = JSON.stringify(targets);

  return template
    .replace(/\{\{run_id\}\}/g, runId)
    .replace(/\{\{session_id\}\}/g, sessionId)
    .replace(/\{\{timestamp\}\}/g, timestamp)
    .replace(/\{\{style_variants\}\}/g, styles.toString())
    .replace(/\{\{layout_variants\}\}/g, layouts.toString())
    .replace(/\{\{pages_json\}\}/g, pagesJson);
}

/**
 * Generate index.html
 */
function generateIndexHtml(metadata) {
  const { styles, layouts, targets } = metadata;
  const total = styles * layouts * targets.length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UI Prototypes Index</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #f5f5f5;
        }
        h1 { margin-bottom: 10px; color: #333; }
        .subtitle { color: #666; margin-bottom: 30px; }
        .cta {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .cta h2 { margin-bottom: 10px; }
        .cta a {
            display: inline-block;
            background: white;
            color: #667eea;
            padding: 10px 20px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 10px;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        .stat {
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stat-label { font-size: 0.85em; color: #666; margin-bottom: 5px; }
        .stat-value { font-size: 1.5em; font-weight: bold; color: #333; }
        .files {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .files h2 { margin-bottom: 15px; color: #333; }
        .file-list { list-style: none; }
        .file-list li {
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        .file-list li:last-child { border-bottom: none; }
        .file-list a {
            color: #667eea;
            text-decoration: none;
        }
        .file-list a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>UI Prototypes</h1>
    <p class="subtitle">Interactive design exploration matrix</p>

    <div class="cta">
        <h2>📊 Interactive Comparison</h2>
        <p>View all prototypes side-by-side with synchronized scrolling</p>
        <a href="compare.html">Open Comparison Matrix →</a>
    </div>

    <div class="stats">
        <div class="stat">
            <div class="stat-label">Style Variants</div>
            <div class="stat-value">${styles}</div>
        </div>
        <div class="stat">
            <div class="stat-label">Layout Variants</div>
            <div class="stat-value">${layouts}</div>
        </div>
        <div class="stat">
            <div class="stat-label">Pages/Components</div>
            <div class="stat-value">${targets.length}</div>
        </div>
        <div class="stat">
            <div class="stat-label">Total Prototypes</div>
            <div class="stat-value">${total}</div>
        </div>
    </div>

    <div class="files">
        <h2>Individual Prototypes</h2>
        <ul class="file-list">
${targets.map(target => {
  const items = [];
  for (let s = 1; s <= styles; s++) {
    for (let l = 1; l <= layouts; l++) {
      const filename = `${target}-style-${s}-layout-${l}.html`;
      items.push(`            <li><a href="${filename}">${filename}</a></li>`);
    }
  }
  return items.join('\n');
}).join('\n')}
        </ul>
    </div>
</body>
</html>`;
}

/**
 * Generate PREVIEW.md
 */
function generatePreviewMd(metadata) {
  const { styles, layouts, targets } = metadata;

  return `# UI Prototypes Preview

## Matrix Dimensions

- **Style Variants**: ${styles}
- **Layout Variants**: ${layouts}
- **Pages/Components**: ${targets.join(', ')}
- **Total Prototypes**: ${styles * layouts * targets.length}

## Quick Start

1. **Interactive Comparison**: Open \`compare.html\` for side-by-side view with synchronized scrolling
2. **Browse Index**: Open \`index.html\` for a navigable list of all prototypes
3. **Individual Files**: Access specific prototypes directly (e.g., \`${targets[0]}-style-1-layout-1.html\`)

## File Naming Convention

\`\`\`
{page}-style-{s}-layout-{l}.html
\`\`\`

- **page**: Component/page name (${targets.join(', ')})
- **s**: Style variant number (1-${styles})
- **l**: Layout variant number (1-${layouts})

## Tips

- Use compare.html for quick visual comparison across all variants
- Synchronized scrolling helps identify consistency issues
- Check responsive behavior across different layout variants
`;
}

/**
 * Main execute function
 */
async function execute(params) {
  const {
    prototypesDir = '.',
    template: templatePath,
    runId: runIdParam,
    sessionId: sessionIdParam,
    timestamp: timestampParam,
  } = params;

  const targetPath = resolve(process.cwd(), prototypesDir);

  if (!existsSync(targetPath)) {
    throw new Error(`Directory not found: ${targetPath}`);
  }

  // Auto-detect matrix dimensions
  const { styles, layouts, targets } = detectMatrixDimensions(targetPath);

  if (styles === 0 || layouts === 0 || targets.length === 0) {
    throw new Error('No prototype files found matching pattern {target}-style-{s}-layout-{l}.html');
  }

  const now = new Date();
  const runId = runIdParam || `run-${now.toISOString().replace(/[:.]/g, '-').slice(0, -5)}`;
  const sessionId = sessionIdParam || 'standalone';
  const timestamp = timestampParam || now.toISOString();

  // Generate metadata
  const metadata = {
    runId,
    sessionId,
    timestamp,
    styles,
    layouts,
    targets
  };

  // Load template
  const template = loadTemplate(templatePath);

  // Generate files
  const compareHtml = generateCompareHtml(template, metadata);
  const indexHtml = generateIndexHtml(metadata);
  const previewMd = generatePreviewMd(metadata);

  // Write files
  writeFileSync(resolve(targetPath, 'compare.html'), compareHtml, 'utf8');
  writeFileSync(resolve(targetPath, 'index.html'), indexHtml, 'utf8');
  writeFileSync(resolve(targetPath, 'PREVIEW.md'), previewMd, 'utf8');

  return {
    success: true,
    prototypes_dir: prototypesDir,
    styles,
    layouts,
    targets,
    total_prototypes: styles * layouts * targets.length,
    files_generated: ['compare.html', 'index.html', 'PREVIEW.md']
  };
}

/**
 * Tool Definition
 */
export const uiGeneratePreviewTool = {
  name: 'ui_generate_preview',
  description: `Generate interactive preview files for UI prototypes.
Generates:
- compare.html: Interactive matrix view with synchronized scrolling
- index.html: Navigation and statistics
- PREVIEW.md: Usage guide

Auto-detects matrix dimensions from file pattern: {target}-style-{s}-layout-{l}.html`,
  parameters: {
    type: 'object',
    properties: {
      prototypesDir: {
        type: 'string',
        description: 'Prototypes directory path (default: current directory)',
        default: '.'
      },
      template: {
        type: 'string',
        description: 'Optional path to compare.html template'
      },
      runId: {
        type: 'string',
        description: 'Optional run identifier to inject into compare.html (defaults to generated timestamp-based run id)'
      },
      sessionId: {
        type: 'string',
        description: 'Optional session identifier to inject into compare.html (default: standalone)'
      },
      timestamp: {
        type: 'string',
        description: 'Optional ISO timestamp to inject into compare.html (defaults to current time)'
      }
    },
    required: []
  },
  execute
};
