import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PNG } = require('pngjs') as typeof import('pngjs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pixelmatchModule = require('pixelmatch');
const pixelmatch =
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  typeof pixelmatchModule === 'function' ? pixelmatchModule : pixelmatchModule.default;

const DEFAULT_TOLERANCE_PERCENT = 0.1;

function getSnapshotsRoot(): string {
  const envRoot = process.env.CCW_VISUAL_SNAPSHOT_ROOT;
  if (envRoot) {
    return resolve(process.cwd(), envRoot);
  }

  return fileURLToPath(new URL('../snapshots', import.meta.url));
}

function ensureSnapshotDirsExist(): { baselineDir: string; currentDir: string; diffDir: string } {
  const root = getSnapshotsRoot();
  const baselineDir = join(root, 'baseline');
  const currentDir = join(root, 'current');
  const diffDir = join(root, 'diff');

  mkdirSync(baselineDir, { recursive: true });
  mkdirSync(currentDir, { recursive: true });
  mkdirSync(diffDir, { recursive: true });

  return { baselineDir, currentDir, diffDir };
}

function toPngName(name: string): string {
  const sanitized = name.replace(/[\\/]/g, '_').trim();
  return sanitized.toLowerCase().endsWith('.png') ? sanitized : `${sanitized}.png`;
}

function getSnapshotPaths(name: string): { baseline: string; current: string; diff: string } {
  const fileName = toPngName(name);
  const { baselineDir, currentDir, diffDir } = ensureSnapshotDirsExist();
  return {
    baseline: join(baselineDir, fileName),
    current: join(currentDir, fileName),
    diff: join(diffDir, fileName),
  };
}

type CaptureOptions = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browser?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page?: any;
  viewport?: { width: number; height: number };
  fullPage?: boolean;
  timeoutMs?: number;
  waitForMs?: number;
  skipGoto?: boolean;
};

export async function captureSnapshot(
  url: string,
  selector: string | undefined,
  name: string,
  options?: CaptureOptions
): Promise<string> {
  const { current } = getSnapshotPaths(name);
  const timeoutMs = options?.timeoutMs ?? 30_000;
  const fullPage = options?.fullPage ?? true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any = options?.browser;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let page: any = options?.page;
  let ownsBrowser = false;
  let ownsPage = false;

  if (!page) {
    if (!browser) {
      browser = await chromium.launch();
      ownsBrowser = true;
    }

    page = await browser.newPage({ viewport: options?.viewport });
    ownsPage = true;
  } else if (options?.viewport) {
    await page.setViewportSize(options.viewport);
  }

  try {
    if (!options?.skipGoto) {
      await page.goto(url, { waitUntil: 'load', timeout: timeoutMs });
    }

    if (options?.waitForMs) {
      await page.waitForTimeout(options.waitForMs);
    }

    const screenshot = selector
      ? await page.locator(selector).screenshot()
      : await page.screenshot({ fullPage });

    writeFileSync(current, screenshot);
    return current;
  } finally {
    if (ownsPage) {
      await page.close();
    }
    if (ownsBrowser) {
      await browser.close();
    }
  }
}

type CompareResult = {
  pass: boolean;
  baselinePath: string;
  currentPath: string;
  diffPath?: string;
  diffPixels: number;
  diffRatio: number;
  tolerancePercent: number;
};

type CompareOptions = {
  pixelmatchThreshold?: number;
  diffPath?: string;
  allowSizeMismatch?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractRegion(png: any, width: number, height: number): Buffer {
  const bytesPerPixel = 4; // RGBA
  const result = Buffer.alloc(width * height * bytesPerPixel);

  for (let y = 0; y < height; y++) {
    const srcOffset = y * png.width * bytesPerPixel;
    const dstOffset = y * width * bytesPerPixel;
    png.data.copy(result, dstOffset, srcOffset, srcOffset + width * bytesPerPixel);
  }

  return result;
}

export function compareSnapshots(
  baselinePath: string,
  currentPath: string,
  tolerancePercent: number = DEFAULT_TOLERANCE_PERCENT,
  options?: CompareOptions
): CompareResult {
  const baselinePng = PNG.sync.read(readFileSync(baselinePath));
  const currentPng = PNG.sync.read(readFileSync(currentPath));

  const sizeMismatch =
    baselinePng.width !== currentPng.width || baselinePng.height !== currentPng.height;

  if (sizeMismatch && !options?.allowSizeMismatch) {
    throw new Error(
      `Snapshot size mismatch: baseline=${baselinePng.width}x${baselinePng.height} current=${currentPng.width}x${currentPng.height}`
    );
  }

  // Use minimum dimensions for comparison when sizes differ
  const compareWidth = Math.min(baselinePng.width, currentPng.width);
  const compareHeight = Math.min(baselinePng.height, currentPng.height);
  const diffPng = new PNG({ width: compareWidth, height: compareHeight });

  // Extract comparable regions when sizes differ
  let baselineData = baselinePng.data;
  let currentData = currentPng.data;

  if (sizeMismatch) {
    baselineData = extractRegion(baselinePng, compareWidth, compareHeight);
    currentData = extractRegion(currentPng, compareWidth, compareHeight);
  }

  const diffPixels = pixelmatch(
    baselineData,
    currentData,
    diffPng.data,
    compareWidth,
    compareHeight,
    { threshold: options?.pixelmatchThreshold ?? 0.1 }
  );

  const totalPixels = compareWidth * compareHeight;
  const diffRatio = totalPixels > 0 ? diffPixels / totalPixels : 0;
  const pass = diffRatio <= tolerancePercent / 100;

  if (pass) {
    return {
      pass: true,
      baselinePath,
      currentPath,
      diffPixels,
      diffRatio,
      tolerancePercent,
    };
  }

  const resolvedDiffPath =
    options?.diffPath ?? join(ensureSnapshotDirsExist().diffDir, basename(currentPath));
  writeFileSync(resolvedDiffPath, PNG.sync.write(diffPng));

  return {
    pass: false,
    baselinePath,
    currentPath,
    diffPath: resolvedDiffPath,
    diffPixels,
    diffRatio,
    tolerancePercent,
  };
}

export function updateBaseline(name: string): string {
  const { baseline, current } = getSnapshotPaths(name);
  copyFileSync(current, baseline);
  return baseline;
}
