import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';

import { chromium } from 'playwright';

import { uiInstantiatePrototypesTool } from '../../src/tools/ui-instantiate-prototypes.js';
import { captureSnapshot, compareSnapshots, updateBaseline } from './helpers/visual-tester.ts';

type StaticServer = { baseUrl: string; close: () => Promise<void> };

const VIEWPORT = { width: 900, height: 600 };
const STYLE_VARIANTS = 3;
const LAYOUT_VARIANTS = 2;
const PAGES = ['button', 'card'];

function shouldUpdateBaselines(): boolean {
  return process.env.CCW_VISUAL_UPDATE_BASELINE === '1';
}

// CI environments may render fonts/layouts differently, use higher tolerance
const TOLERANCE_PERCENT = process.env.CI ? 5 : 0.1;

function assertVisualMatch(name: string, currentPath: string): void {
  const baselinePath = resolve(resolve(currentPath, '..', '..'), 'baseline', basename(currentPath));

  if (!existsSync(baselinePath)) {
    if (shouldUpdateBaselines()) {
      updateBaseline(name);
      return;
    }
    throw new Error(
      `Missing baseline snapshot: ${baselinePath}\n` +
        `Re-run with CCW_VISUAL_UPDATE_BASELINE=1 to generate baselines.`
    );
  }

  if (shouldUpdateBaselines()) {
    updateBaseline(name);
    return;
  }

  const result = compareSnapshots(baselinePath, currentPath, TOLERANCE_PERCENT, {
    allowSizeMismatch: !!process.env.CI,
  });
  assert.equal(
    result.pass,
    true,
    `Visual mismatch for ${name}: diffRatio=${result.diffRatio} diffPixels=${result.diffPixels} diff=${result.diffPath ?? 'n/a'}`
  );
}

function contentTypeForPath(filePath: string): string {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.md')) return 'text/markdown; charset=utf-8';
  if (filePath.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

async function startStaticServer(rootDir: string): Promise<StaticServer> {
  const normalizedRoot = resolve(rootDir);
  const normalizedRootPrefix = normalizedRoot.endsWith(sep) ? normalizedRoot : `${normalizedRoot}${sep}`;

  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const pathname = decodeURIComponent(url.pathname);
      const relPath = pathname === '/' ? 'index.html' : pathname.slice(1);
      const filePath = resolve(normalizedRoot, relPath);

      if (!filePath.startsWith(normalizedRootPrefix)) {
        res.writeHead(400);
        res.end('Bad request');
        return;
      }

      if (!existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentTypeForPath(filePath) });
      res.end(content);
    } catch (err) {
      res.writeHead(500);
      res.end((err as Error).message);
    }
  });

  return await new Promise<StaticServer>((resolvePromise, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to start server'));
        return;
      }

      resolvePromise({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise<void>((closeResolve) => {
            server.close(() => closeResolve());
          }),
      });
    });
  });
}

function writeTokensCss(filePath: string, colors: { pageBg: string; panelBg: string; accent: string }): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(
    filePath,
    `:root {\n  --page-bg: ${colors.pageBg};\n  --panel-bg: ${colors.panelBg};\n  --accent: ${colors.accent};\n}\n`,
    'utf8'
  );
}

function writeTemplate(filePath: string, page: string, layout: number): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const layoutCss =
    layout === 1
      ? '.canvas { display: flex; gap: 16px; } .block-a { flex: 2; } .block-b { flex: 1; }'
      : '.canvas { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; } .block-a { grid-column: 1 / -1; }';

  writeFileSync(
    filePath,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${page} layout ${layout}</title>
  <style>
    {{tokens.css}}

    html, body { margin: 0; padding: 0; background: var(--page-bg); }
    .frame { width: 860px; height: 520px; margin: 20px auto; border-radius: 18px; background: rgba(255,255,255,0.9); box-shadow: 0 8px 24px rgba(0,0,0,0.08); padding: 18px; }
    .canvas { width: 100%; height: 100%; ${layoutCss} }
    .block { border-radius: 16px; background: var(--panel-bg); position: relative; overflow: hidden; }
    .block::after { content: ''; position: absolute; inset: 14px; border-radius: 14px; background: linear-gradient(135deg, var(--accent), rgba(255,255,255,0.0)); opacity: 0.85; }
    .block-a { min-height: 220px; }
    .block-b { min-height: 220px; }
  </style>
</head>
<body>
  <div class="frame">
    <div class="canvas" data-page="${page}" data-layout="${layout}">
      <div class="block block-a"></div>
      <div class="block block-b"></div>
    </div>
  </div>
</body>
</html>`,
    'utf8'
  );
}

describe('ui_instantiate_prototypes visual regression', () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'ccw-ui-instantiate-prototypes-'));
  const prototypesDir = join(projectRoot, 'prototypes');
  const templatesDir = join(prototypesDir, '_templates');
  const styleExtractionDir = join(projectRoot, 'style-extraction');

  let server: StaticServer | undefined;
  let browser: import('playwright').Browser | undefined;

  before(async () => {
    // Tokens: 3 style variants
    const tokenSets = [
      { pageBg: '#0b1020', panelBg: '#fee2e2', accent: '#ef4444' },
      { pageBg: '#0b1020', panelBg: '#dcfce7', accent: '#22c55e' },
      { pageBg: '#0b1020', panelBg: '#dbeafe', accent: '#3b82f6' },
    ];

    for (let s = 1; s <= STYLE_VARIANTS; s++) {
      const tokenPath = join(styleExtractionDir, `style-${s}`, 'tokens.css');
      writeTokensCss(tokenPath, tokenSets[s - 1]);
    }

    // Templates: 2 pages × 2 layouts
    for (const page of PAGES) {
      for (let l = 1; l <= LAYOUT_VARIANTS; l++) {
        const templatePath = join(templatesDir, `${page}-layout-${l}.html`);
        writeTemplate(templatePath, page, l);
      }
    }

    await uiInstantiatePrototypesTool.execute({
      prototypesDir,
      pages: PAGES.join(','),
      styleVariants: STYLE_VARIANTS,
      layoutVariants: LAYOUT_VARIANTS,
      runId: 'run-test',
      sessionId: 'test',
      generatePreview: false,
    });

    const samplePath = join(prototypesDir, `${PAGES[0]}-style-2-layout-1.html`);
    const generatedHtml = readFileSync(samplePath, 'utf8');
    assert.ok(!generatedHtml.includes('{{tokens.css}}'), 'Expected tokens placeholder to be replaced');
    assert.ok(generatedHtml.includes('--accent: #22c55e'), 'Expected injected tokens.css from style-2');

    const notesPath = join(prototypesDir, `${PAGES[0]}-style-1-layout-1-notes.md`);
    assert.ok(existsSync(notesPath), 'Expected implementation notes to be generated');

    server = await startStaticServer(prototypesDir);
    browser = await chromium.launch();
  });

  after(async () => {
    await browser?.close();
    await server?.close();
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it(
    'captures snapshots for pages × styles × layouts (2×3×2 = 12)',
    { timeout: 120_000 },
    async () => {
      assert.ok(server);
      assert.ok(browser);

      const page = await browser.newPage({ viewport: VIEWPORT });

      for (const component of PAGES) {
        for (let s = 1; s <= STYLE_VARIANTS; s++) {
          for (let l = 1; l <= LAYOUT_VARIANTS; l++) {
            const fileName = `${component}-style-${s}-layout-${l}.html`;
            await page.goto(`${server.baseUrl}/${fileName}`, { waitUntil: 'load' });
            await page.waitForSelector('.canvas');

            const snapshotName = `ui-instantiate-prototypes_${component}_style${s}_layout${l}`;
            const currentPath = await captureSnapshot(`${server.baseUrl}/${fileName}`, undefined, snapshotName, {
              page,
              skipGoto: true,
              fullPage: false,
            });
            assertVisualMatch(snapshotName, currentPath);
          }
        }
      }

      await page.close();
    }
  );

  it('handles missing tokens.css gracefully', async () => {
    const missingProjectRoot = mkdtempSync(join(tmpdir(), 'ccw-ui-instantiate-prototypes-missing-tokens-'));
    const missingPrototypesDir = join(missingProjectRoot, 'prototypes');
    const missingTemplatesDir = join(missingPrototypesDir, '_templates');

    writeTemplate(join(missingTemplatesDir, 'card-layout-1.html'), 'card', 1);

    await uiInstantiatePrototypesTool.execute({
      prototypesDir: missingPrototypesDir,
      pages: 'card',
      styleVariants: 2,
      layoutVariants: 1,
      runId: 'run-test',
      sessionId: 'test',
      generatePreview: false,
    });

    const html = readFileSync(join(missingPrototypesDir, 'card-style-2-layout-1.html'), 'utf8');
    assert.ok(html.includes('/* No tokens.css found */'));

    rmSync(missingProjectRoot, { recursive: true, force: true });
  });
});
