import open from 'open';
import { platform } from 'os';
import { resolve } from 'path';

/**
 * Launch a file in the default browser
 * Cross-platform compatible (Windows/macOS/Linux)
 * @param {string} filePath - Path to HTML file
 * @returns {Promise<void>}
 */
export async function launchBrowser(filePath) {
  const absolutePath = resolve(filePath);

  // Construct file:// URL based on platform
  let url;
  if (platform() === 'win32') {
    // Windows: file:///C:/path/to/file.html
    url = `file:///${absolutePath.replace(/\\/g, '/')}`;
  } else {
    // Unix: file:///path/to/file.html
    url = `file://${absolutePath}`;
  }

  try {
    // Use the 'open' package which handles cross-platform browser launching
    await open(url);
  } catch (error) {
    // Fallback: try opening the file path directly
    try {
      await open(absolutePath);
    } catch (fallbackError) {
      throw new Error(`Failed to open browser: ${error.message}`);
    }
  }
}

/**
 * Check if we're running in a headless/CI environment
 * @returns {boolean}
 */
export function isHeadlessEnvironment() {
  return !!(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.JENKINS_URL
  );
}
