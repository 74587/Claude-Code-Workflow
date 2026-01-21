import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PackageInfo {
  name: string;
  version: string;
  [key: string]: unknown;
}

/**
 * Find project root by searching upward for package.json
 * More robust than hardcoded relative paths
 */
export function findProjectRoot(startDir: string = __dirname): string | null {
  let currentDir = startDir;
  let previousDir = '';

  // Traverse up until we find package.json or reach filesystem root
  while (currentDir !== previousDir) {
    const pkgPath = join(currentDir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        // Verify this is our package (not a nested node_modules package)
        if (pkg.name === 'claude-code-workflow' || pkg.bin?.ccw) {
          return currentDir;
        }
      } catch {
        // Invalid JSON, continue searching
      }
    }
    previousDir = currentDir;
    currentDir = dirname(currentDir);
  }

  return null;
}

/**
 * Load package.json from project root
 * Returns null if not found or invalid
 */
export function loadPackageInfo(): PackageInfo | null {
  const projectRoot = findProjectRoot();
  if (!projectRoot) return null;

  const pkgPath = join(projectRoot, 'package.json');
  try {
    const content = readFileSync(pkgPath, 'utf8');
    return JSON.parse(content) as PackageInfo;
  } catch {
    return null;
  }
}

/**
 * Get package version from project root
 */
export function getPackageVersion(): string {
  const pkg = loadPackageInfo();
  return pkg?.version || '1.0.0';
}

/**
 * Get package root directory
 */
export function getPackageRoot(): string {
  return findProjectRoot() || join(__dirname, '..', '..', '..');
}
