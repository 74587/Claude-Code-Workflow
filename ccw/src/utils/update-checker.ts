import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import { loadPackageInfo } from './project-root.js';

interface CacheData {
  lastCheck: number;
  latestVersion: string | null;
}

const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_DIR = join(homedir(), '.config', 'ccw');
const CACHE_FILE = join(CACHE_DIR, 'update-check.json');

/**
 * Load cached update check data
 */
function loadCache(): CacheData | null {
  try {
    if (existsSync(CACHE_FILE)) {
      return JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save update check data to cache
 */
function saveCache(data: CacheData): void {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Parse semver version into components
 * Handles: 1.2.3, v1.2.3, 1.2.3-alpha.1, 1.2.3-beta, 1.2.3-rc.2
 */
function parseVersion(version: string): { major: number; minor: number; patch: number; prerelease: string[] } {
  const cleaned = version.replace(/^v/, '');
  const [mainPart, prereleasePart] = cleaned.split('-');
  const parts = mainPart.split('.');
  const major = parseInt(parts[0], 10) || 0;
  const minor = parseInt(parts[1], 10) || 0;
  const patch = parseInt(parts[2], 10) || 0;
  const prerelease = prereleasePart ? prereleasePart.split('.') : [];

  return { major, minor, patch, prerelease };
}

/**
 * Compare two semver versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 * Properly handles prerelease versions (1.0.0-alpha < 1.0.0)
 */
function compareVersions(a: string, b: string): number {
  const vA = parseVersion(a);
  const vB = parseVersion(b);

  // Compare major.minor.patch
  if (vA.major !== vB.major) return vA.major > vB.major ? 1 : -1;
  if (vA.minor !== vB.minor) return vA.minor > vB.minor ? 1 : -1;
  if (vA.patch !== vB.patch) return vA.patch > vB.patch ? 1 : -1;

  // Handle prerelease: no prerelease > has prerelease
  // e.g., 1.0.0 > 1.0.0-alpha
  if (vA.prerelease.length === 0 && vB.prerelease.length > 0) return 1;
  if (vA.prerelease.length > 0 && vB.prerelease.length === 0) return -1;

  // Compare prerelease identifiers
  const maxLen = Math.max(vA.prerelease.length, vB.prerelease.length);
  for (let i = 0; i < maxLen; i++) {
    const partA = vA.prerelease[i];
    const partB = vB.prerelease[i];

    // Missing part is less (1.0.0-alpha < 1.0.0-alpha.1)
    if (partA === undefined) return -1;
    if (partB === undefined) return 1;

    // Numeric comparison if both are numbers
    const numA = parseInt(partA, 10);
    const numB = parseInt(partB, 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      if (numA !== numB) return numA > numB ? 1 : -1;
    } else {
      // String comparison
      if (partA !== partB) return partA > partB ? 1 : -1;
    }
  }

  return 0;
}

/**
 * Fetch latest version from npm registry
 */
async function fetchLatestVersion(packageName: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json() as { version?: string };
    return data.version || null;
  } catch {
    return null;
  }
}

/**
 * Check for npm package updates and notify user
 * Non-blocking, with caching to avoid frequent requests
 */
export async function checkForUpdates(): Promise<void> {
  try {
    const pkg = loadPackageInfo();
    if (!pkg) return;

    // Check cache first
    const cache = loadCache();
    const now = Date.now();

    let latestVersion: string | null = null;

    // Use cached version if within check interval
    if (cache && (now - cache.lastCheck) < CHECK_INTERVAL) {
      latestVersion = cache.latestVersion;
    } else {
      // Fetch from npm registry
      latestVersion = await fetchLatestVersion(pkg.name);

      // Update cache
      saveCache({
        lastCheck: now,
        latestVersion
      });
    }

    // Compare and notify (only for stable releases, ignore prerelease)
    if (latestVersion && compareVersions(latestVersion, pkg.version) > 0) {
      console.log('');
      console.log(chalk.yellow.bold('  \u26a0 New version available!'));
      console.log(chalk.gray(`    Current: ${pkg.version} \u2192 Latest: ${chalk.green(latestVersion)}`));
      console.log(chalk.cyan(`    Run: npm update -g ${pkg.name}`));
      console.log('');
    }
  } catch {
    // Silently ignore update check errors
  }
}

/**
 * Check for updates and notify (async, non-blocking)
 * Call this at the start of commands that should show update notifications
 */
export function notifyUpdates(): void {
  // Run in background, don't block main execution
  checkForUpdates().catch(() => {
    // Ignore errors
  });
}
