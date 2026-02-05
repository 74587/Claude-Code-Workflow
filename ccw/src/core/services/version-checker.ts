/**
 * Version Checker Service
 * Checks application version against GitHub latest release
 * Uses caching to avoid excessive API calls
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Version check result
 */
export interface VersionCheckResult {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  changelog?: string;
}

/**
 * Version cache entry
 */
interface CacheEntry {
  data: VersionCheckResult;
  timestamp: number;
}

/**
 * Version Checker Service
 * Checks for updates by comparing local version with GitHub releases
 */
export class VersionChecker {
  private cache: CacheEntry | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly GITHUB_OWNER = 'dyw0830';
  private readonly GITHUB_REPO = 'ccw';
  private readonly GITHUB_API_URL = `https://api.github.com/repos/dyw0830/ccw/releases/latest`;

  /**
   * Check for updates
   * Returns cached result if within TTL
   */
  async checkVersion(): Promise<VersionCheckResult> {
    // Check cache first
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL) {
      return this.cache.data;
    }

    // Get versions
    const currentVersion = await this.getLocalVersion();
    const latestVersion = await this.getLatestVersionFromGitHub();

    const result: VersionCheckResult = {
      currentVersion,
      latestVersion,
      updateAvailable: this.compareVersions(currentVersion, latestVersion) < 0
    };

    // Cache result
    this.cache = { data: result, timestamp: Date.now() };
    return result;
  }

  /**
   * Get local version from package.json
   * Searches in monorepo root and ccw package directories
   */
  private async getLocalVersion(): Promise<string> {
    // Try to find package.json with actual CCW version
    const possiblePaths = [
      join(process.cwd(), 'package.json'),           // Current directory
      join(process.cwd(), 'ccw', 'package.json'),     // ccw subdirectory
      join(__dirname, '..', '..', '..', '..', 'package.json'), // From src/core/services -> monorepo root
    ];

    for (const pkgPath of possiblePaths) {
      if (existsSync(pkgPath)) {
        try {
          const content = await readFile(pkgPath, 'utf-8');
          const pkg = JSON.parse(content);
          if (pkg.version && typeof pkg.version === 'string') {
            return pkg.version;
          }
        } catch {
          // Continue to next path
        }
      }
    }

    // Fallback to a default version if no package.json found
    return '0.0.0';
  }

  /**
   * Fetch latest version from GitHub Releases API
   * Returns cached data if available even if expired, on error
   */
  private async getLatestVersionFromGitHub(): Promise<string> {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(this.GITHUB_API_URL, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CCW-VersionChecker', // REQUIRED by GitHub API
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      // Validate response structure
      const data = await response.json() as { tag_name?: string };

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid GitHub API response format');
      }

      if (!data.tag_name || typeof data.tag_name !== 'string') {
        throw new Error('Invalid tag_name in GitHub response');
      }

      // Extract version from tag_name (remove 'v' prefix if present)
      const tagName = data.tag_name;
      return tagName.startsWith('v') ? tagName.substring(1) : tagName;
    } catch (error) {
      // Handle abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('GitHub API request timeout (10s)');
      }

      // Return cached data if available, even if expired
      if (this.cache) {
        console.warn(`[VersionChecker] Using cached version due to error: ${(error as Error).message}`);
        return this.cache.data.latestVersion;
      }
      throw error;
    }
  }

  /**
   * Compare two semantic version strings
   * Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
   */
  private compareVersions(v1: string, v2: string): number {
    // Parse semver versions (major.minor.patch)
    const parts1 = v1.split('.').map((p) => (parseInt(p, 10) || 0));
    const parts2 = v2.split('.').map((p) => (parseInt(p, 10) || 0));

    // Ensure we have at least 3 parts for comparison
    while (parts1.length < 3) parts1.push(0);
    while (parts2.length < 3) parts2.push(0);

    for (let i = 0; i < 3; i++) {
      if (parts1[i] < parts2[i]) return -1;
      if (parts1[i] > parts2[i]) return 1;
    }
    return 0;
  }

  /**
   * Clear the version cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cache = null;
  }
}
