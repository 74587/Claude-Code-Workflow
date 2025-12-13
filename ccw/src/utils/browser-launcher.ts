import open from 'open';
import { platform } from 'os';
import { resolve } from 'path';

/**
 * Launch a URL or file in the default browser
 * Cross-platform compatible (Windows/macOS/Linux)
 * @param urlOrPath - HTTP URL or path to HTML file
 * @returns Promise that resolves when browser is launched
 */
export async function launchBrowser(urlOrPath: string): Promise<void> {
  // Check if it's already a URL (http:// or https://)
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    try {
      await open(urlOrPath);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to open browser: ${message}`);
    }
  }

  // It's a file path - convert to file:// URL
  const absolutePath = resolve(urlOrPath);

  // Construct file:// URL based on platform
  let url: string;
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
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to open browser: ${message}`);
    }
  }
}

/**
 * Check if we're running in a headless/CI environment
 * @returns True if running in headless environment
 */
export function isHeadlessEnvironment(): boolean {
  return !!(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.JENKINS_URL
  );
}
