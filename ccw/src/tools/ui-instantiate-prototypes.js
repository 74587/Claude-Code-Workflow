/**
 * UI Instantiate Prototypes Tool
 * Create final UI prototypes from templates (Style × Layout × Page matrix)
 */

import { readdirSync, existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs';
import { resolve, join, basename } from 'path';

/**
 * Auto-detect pages from templates directory
 */
function autoDetectPages(templatesDir) {
  if (!existsSync(templatesDir)) {
    return [];
  }

  const files = readdirSync(templatesDir).filter(f => f.match(/.*-layout-\d+\.html$/));
  const pages = new Set();

  files.forEach(file => {
    const match = file.match(/^(.+)-layout-\d+\.html$/);
    if (match) pages.add(match[1]);
  });

  return Array.from(pages).sort();
}

/**
 * Auto-detect style variants count
 */
function autoDetectStyleVariants(basePath) {
  const styleDir = resolve(basePath, '..', 'style-extraction');

  if (!existsSync(styleDir)) {
    return 3; // Default
  }

  const dirs = readdirSync(styleDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('style-'));

  return dirs.length > 0 ? dirs.length : 3;
}

/**
 * Auto-detect layout variants count
 */
function autoDetectLayoutVariants(templatesDir) {
  if (!existsSync(templatesDir)) {
    return 3; // Default
  }

  const files = readdirSync(templatesDir);
  const firstPage = files.find(f => f.endsWith('-layout-1.html'));

  if (!firstPage) return 3;

  const pageName = firstPage.replace(/-layout-1\.html$/, '');
  const layoutFiles = files.filter(f => f.match(new RegExp(`^${pageName}-layout-\\d+\\.html$`)));

  return layoutFiles.length > 0 ? layoutFiles.length : 3;
}

/**
 * Load CSS tokens file
 */
function loadTokensCss(styleDir, styleNum) {
  const tokenPath = join(styleDir, `style-${styleNum}`, 'tokens.css');

  if (existsSync(tokenPath)) {
    return readFileSync(tokenPath, 'utf8');
  }

  return '/* No tokens.css found */';
}

/**
 * Replace CSS placeholder in template
 */
function replaceCssPlaceholder(html, tokensCss) {
  // Replace {{tokens.css}} placeholder
  return html.replace(/\{\{tokens\.css\}\}/g, tokensCss);
}

/**
 * Generate prototype from template
 */
function generatePrototype(templatePath, styleDir, styleNum, outputPath) {
  const templateHtml = readFileSync(templatePath, 'utf8');
  const tokensCss = loadTokensCss(styleDir, styleNum);
  const finalHtml = replaceCssPlaceholder(templateHtml, tokensCss);

  writeFileSync(outputPath, finalHtml, 'utf8');
}

/**
 * Generate implementation notes
 */
function generateImplementationNotes(page, styleNum, layoutNum) {
  return `# Implementation Notes: ${page}-style-${styleNum}-layout-${layoutNum}

## Overview
Prototype combining:
- **Page/Component**: ${page}
- **Style Variant**: ${styleNum}
- **Layout Variant**: ${layoutNum}

## Implementation Checklist

### 1. Style Integration
- [ ] Verify all CSS custom properties are applied correctly
- [ ] Check color palette consistency
- [ ] Validate typography settings
- [ ] Test spacing and border radius values

### 2. Layout Verification
- [ ] Confirm component structure matches layout variant
- [ ] Test responsive behavior
- [ ] Verify flex/grid layouts
- [ ] Check alignment and spacing

### 3. Accessibility
- [ ] Color contrast ratios (WCAG AA minimum)
- [ ] Keyboard navigation
- [ ] Screen reader compatibility
- [ ] Focus indicators

### 4. Browser Testing
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari
- [ ] Mobile browsers

## Next Steps
1. Review prototype in browser
2. Compare with design specifications
3. Implement in production codebase
4. Add interactive functionality
5. Write tests
`;
}

/**
 * Main execute function
 */
async function execute(params) {
  const {
    prototypesDir,
    pages: pagesParam,
    styleVariants: styleVariantsParam,
    layoutVariants: layoutVariantsParam,
    runId: runIdParam,
    sessionId = 'standalone',
    generatePreview = true
  } = params;

  if (!prototypesDir) {
    throw new Error('Parameter "prototypesDir" is required');
  }

  const basePath = resolve(process.cwd(), prototypesDir);

  if (!existsSync(basePath)) {
    throw new Error(`Directory not found: ${basePath}`);
  }

  const templatesDir = join(basePath, '_templates');
  const styleDir = resolve(basePath, '..', 'style-extraction');

  // Auto-detect or use provided parameters
  let pages, styleVariants, layoutVariants;

  if (pagesParam && styleVariantsParam && layoutVariantsParam) {
    // Manual mode
    pages = Array.isArray(pagesParam) ? pagesParam : pagesParam.split(',').map(p => p.trim());
    styleVariants = parseInt(styleVariantsParam);
    layoutVariants = parseInt(layoutVariantsParam);
  } else {
    // Auto-detect mode
    pages = autoDetectPages(templatesDir);
    styleVariants = autoDetectStyleVariants(basePath);
    layoutVariants = autoDetectLayoutVariants(templatesDir);
  }

  if (pages.length === 0) {
    throw new Error('No pages detected. Ensure _templates directory contains layout files.');
  }

  // Generate run ID
  const runId = runIdParam || `run-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}`;

  // Phase 1: Copy templates and replace CSS placeholders
  const generatedFiles = [];

  for (const page of pages) {
    for (let s = 1; s <= styleVariants; s++) {
      for (let l = 1; l <= layoutVariants; l++) {
        const templateFile = `${page}-layout-${l}.html`;
        const templatePath = join(templatesDir, templateFile);

        if (!existsSync(templatePath)) {
          console.warn(`Template not found: ${templateFile}, skipping...`);
          continue;
        }

        const outputFile = `${page}-style-${s}-layout-${l}.html`;
        const outputPath = join(basePath, outputFile);

        // Generate prototype
        generatePrototype(templatePath, styleDir, s, outputPath);

        // Generate implementation notes
        const notesFile = `${page}-style-${s}-layout-${l}-notes.md`;
        const notesPath = join(basePath, notesFile);
        const notes = generateImplementationNotes(page, s, l);
        writeFileSync(notesPath, notes, 'utf8');

        generatedFiles.push(outputFile);
      }
    }
  }

  // Phase 2: Generate preview files (optional)
  const previewFiles = [];
  if (generatePreview) {
    // Import and execute ui_generate_preview tool
    const { uiGeneratePreviewTool } = await import('./ui-generate-preview.js');
    const previewResult = await uiGeneratePreviewTool.execute({ prototypesDir: basePath });

    if (previewResult.success) {
      previewFiles.push(...previewResult.files_generated);
    }
  }

  return {
    success: true,
    run_id: runId,
    session_id: sessionId,
    prototypes_dir: basePath,
    pages,
    style_variants: styleVariants,
    layout_variants: layoutVariants,
    total_prototypes: generatedFiles.length,
    files_generated: generatedFiles,
    preview_files: previewFiles,
    message: `Generated ${generatedFiles.length} prototypes (${styleVariants} styles × ${layoutVariants} layouts × ${pages.length} pages)`
  };
}

/**
 * Tool Definition
 */
export const uiInstantiatePrototypesTool = {
  name: 'ui_instantiate_prototypes',
  description: `Create final UI prototypes from templates (Style × Layout × Page matrix).

Two Modes:
1. Auto-detect (recommended): Only specify prototypesDir
2. Manual: Specify prototypesDir, pages, styleVariants, layoutVariants

Features:
- Copies templates and replaces CSS placeholders with tokens.css
- Generates implementation notes for each prototype
- Optionally generates preview files (compare.html, index.html, PREVIEW.md)`,
  parameters: {
    type: 'object',
    properties: {
      prototypesDir: {
        type: 'string',
        description: 'Prototypes directory path'
      },
      pages: {
        type: 'string',
        description: 'Comma-separated list of pages (auto-detected if not provided)'
      },
      styleVariants: {
        type: 'number',
        description: 'Number of style variants (auto-detected if not provided)'
      },
      layoutVariants: {
        type: 'number',
        description: 'Number of layout variants (auto-detected if not provided)'
      },
      runId: {
        type: 'string',
        description: 'Run ID (auto-generated if not provided)'
      },
      sessionId: {
        type: 'string',
        description: 'Session ID (default: standalone)',
        default: 'standalone'
      },
      generatePreview: {
        type: 'boolean',
        description: 'Generate preview files (default: true)',
        default: true
      }
    },
    required: ['prototypesDir']
  },
  execute
};
