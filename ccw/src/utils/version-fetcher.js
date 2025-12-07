import https from 'https';
import { existsSync, mkdirSync, createWriteStream, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createUnzip } from 'zlib';
import { pipeline } from 'stream/promises';

// GitHub repository URL
export const REPO_URL = 'https://github.com/catlog22/Claude-Code-Workflow';
const API_BASE = 'https://api.github.com/repos/catlog22/Claude-Code-Workflow';

/**
 * Make HTTPS request with JSON response
 * @param {string} url - URL to fetch
 * @param {number} timeout - Timeout in ms (default: 10000)
 * @returns {Promise<Object>}
 */
function fetchJson(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'ccw-installer',
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout
    }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location, timeout).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Fetch latest stable release info
 * @returns {Promise<{tag: string, date: string, url: string}>}
 */
export async function fetchLatestRelease() {
  const data = await fetchJson(`${API_BASE}/releases/latest`);

  return {
    tag: data.tag_name,
    version: data.tag_name.replace(/^v/, ''),
    date: data.published_at ? new Date(data.published_at).toLocaleDateString() : '',
    url: data.zipball_url,
    htmlUrl: data.html_url
  };
}

/**
 * Fetch recent releases list
 * @param {number} limit - Number of releases to fetch
 * @returns {Promise<Array<{tag: string, date: string}>>}
 */
export async function fetchRecentReleases(limit = 5) {
  const data = await fetchJson(`${API_BASE}/releases?per_page=${limit}`);

  return data.map(release => ({
    tag: release.tag_name,
    version: release.tag_name.replace(/^v/, ''),
    date: release.published_at ? new Date(release.published_at).toLocaleDateString() : '',
    url: release.zipball_url
  }));
}

/**
 * Fetch latest commit from a branch
 * @param {string} branch - Branch name (default: main)
 * @returns {Promise<{sha: string, shortSha: string, date: string, message: string}>}
 */
export async function fetchLatestCommit(branch = 'main') {
  const data = await fetchJson(`${API_BASE}/commits/${branch}`);

  return {
    sha: data.sha,
    shortSha: data.sha.substring(0, 7),
    date: data.commit.committer.date ? new Date(data.commit.committer.date).toLocaleDateString() : '',
    message: data.commit.message.split('\n')[0]
  };
}

/**
 * Download file from URL
 * @param {string} url - URL to download
 * @param {string} destPath - Destination file path
 * @returns {Promise<void>}
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath);

    https.get(url, {
      headers: {
        'User-Agent': 'ccw-installer',
        'Accept': 'application/octet-stream'
      }
    }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        file.close();
        reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        return;
      }

      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      reject(err);
    });
  });
}

/**
 * Extract zip file using native unzip command or built-in
 * @param {string} zipPath - Path to zip file
 * @param {string} destDir - Destination directory
 * @returns {Promise<string>} - Extracted directory path
 */
async function extractZip(zipPath, destDir) {
  const { execSync } = await import('child_process');

  // Try using native unzip commands
  try {
    // Try PowerShell Expand-Archive (Windows)
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, {
      stdio: 'pipe'
    });
  } catch {
    try {
      // Try unzip command (Unix/Git Bash)
      execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: 'pipe' });
    } catch {
      throw new Error('No unzip utility available. Please install unzip or use PowerShell.');
    }
  }

  // Find extracted directory
  const { readdirSync } = await import('fs');
  const entries = readdirSync(destDir);
  const repoDir = entries.find(e => e.startsWith('Claude-Code-Workflow-') || e.startsWith('catlog22-Claude-Code-Workflow-'));

  if (!repoDir) {
    throw new Error('Could not find extracted repository directory');
  }

  return join(destDir, repoDir);
}

/**
 * Download and extract repository
 * @param {Object} options
 * @param {'stable'|'latest'|'branch'} options.type - Version type
 * @param {string} options.tag - Specific tag (for stable)
 * @param {string} options.branch - Branch name (for branch type)
 * @returns {Promise<{repoDir: string, version: string, branch: string, commit: string}>}
 */
export async function downloadAndExtract(options = {}) {
  const { type = 'stable', tag = '', branch = 'main' } = options;

  // Create temp directory
  const tempDir = join(tmpdir(), `ccw-install-${Date.now()}`);
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  let zipUrl;
  let versionInfo = { version: '', branch: '', commit: '' };

  // Determine download URL based on version type
  if (type === 'stable') {
    if (tag) {
      zipUrl = `${REPO_URL}/archive/refs/tags/${tag}.zip`;
      versionInfo.version = tag.replace(/^v/, '');
      versionInfo.branch = tag;
    } else {
      const release = await fetchLatestRelease();
      zipUrl = `${REPO_URL}/archive/refs/tags/${release.tag}.zip`;
      versionInfo.version = release.version;
      versionInfo.branch = release.tag;
    }
  } else if (type === 'latest') {
    zipUrl = `${REPO_URL}/archive/refs/heads/main.zip`;
    const commit = await fetchLatestCommit('main');
    versionInfo.version = `dev-${commit.shortSha}`;
    versionInfo.branch = 'main';
    versionInfo.commit = commit.shortSha;
  } else {
    zipUrl = `${REPO_URL}/archive/refs/heads/${branch}.zip`;
    const commit = await fetchLatestCommit(branch);
    versionInfo.version = `dev-${commit.shortSha}`;
    versionInfo.branch = branch;
    versionInfo.commit = commit.shortSha;
  }

  // Download zip file
  const zipPath = join(tempDir, 'repo.zip');
  await downloadFile(zipUrl, zipPath);

  // Extract zip
  const repoDir = await extractZip(zipPath, tempDir);

  return {
    repoDir,
    tempDir,
    ...versionInfo
  };
}

/**
 * Cleanup temporary directory
 * @param {string} tempDir - Temp directory to remove
 */
export function cleanupTemp(tempDir) {
  if (existsSync(tempDir)) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
