import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

// Manifest directory location
const MANIFEST_DIR = join(homedir(), '.claude-manifests');

/**
 * Ensure manifest directory exists
 */
function ensureManifestDir() {
  if (!existsSync(MANIFEST_DIR)) {
    mkdirSync(MANIFEST_DIR, { recursive: true });
  }
}

/**
 * Create a new installation manifest
 * @param {string} mode - Installation mode (Global/Path)
 * @param {string} installPath - Installation path
 * @returns {Object} - New manifest object
 */
export function createManifest(mode, installPath) {
  ensureManifestDir();

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').split('.')[0];
  const modePrefix = mode === 'Global' ? 'manifest-global' : 'manifest-path';
  const manifestId = `${modePrefix}-${timestamp}`;

  return {
    manifest_id: manifestId,
    version: '1.0',
    installation_mode: mode,
    installation_path: installPath,
    installation_date: new Date().toISOString(),
    installer_version: '1.0.0',
    files: [],
    directories: []
  };
}

/**
 * Add file entry to manifest
 * @param {Object} manifest - Manifest object
 * @param {string} filePath - File path
 */
export function addFileEntry(manifest, filePath) {
  manifest.files.push({
    path: filePath,
    type: 'File',
    timestamp: new Date().toISOString()
  });
}

/**
 * Add directory entry to manifest
 * @param {Object} manifest - Manifest object
 * @param {string} dirPath - Directory path
 */
export function addDirectoryEntry(manifest, dirPath) {
  manifest.directories.push({
    path: dirPath,
    type: 'Directory',
    timestamp: new Date().toISOString()
  });
}

/**
 * Save manifest to disk
 * @param {Object} manifest - Manifest object
 * @returns {string} - Path to saved manifest
 */
export function saveManifest(manifest) {
  ensureManifestDir();

  // Remove old manifests for same path and mode
  removeOldManifests(manifest.installation_path, manifest.installation_mode);

  const manifestPath = join(MANIFEST_DIR, `${manifest.manifest_id}.json`);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return manifestPath;
}

/**
 * Remove old manifests for the same installation path and mode
 * @param {string} installPath - Installation path
 * @param {string} mode - Installation mode
 */
function removeOldManifests(installPath, mode) {
  if (!existsSync(MANIFEST_DIR)) return;

  const normalizedPath = installPath.toLowerCase().replace(/[\\/]+$/, '');

  try {
    const files = readdirSync(MANIFEST_DIR).filter(f => f.endsWith('.json'));

    for (const file of files) {
      try {
        const filePath = join(MANIFEST_DIR, file);
        const content = JSON.parse(readFileSync(filePath, 'utf8'));

        const manifestPath = (content.installation_path || '').toLowerCase().replace(/[\\/]+$/, '');
        const manifestMode = content.installation_mode || 'Global';

        if (manifestPath === normalizedPath && manifestMode === mode) {
          unlinkSync(filePath);
        }
      } catch {
        // Skip invalid manifest files
      }
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Get all installation manifests
 * @returns {Array} - Array of manifest objects
 */
export function getAllManifests() {
  if (!existsSync(MANIFEST_DIR)) return [];

  const manifests = [];

  try {
    const files = readdirSync(MANIFEST_DIR).filter(f => f.endsWith('.json'));

    for (const file of files) {
      try {
        const filePath = join(MANIFEST_DIR, file);
        const content = JSON.parse(readFileSync(filePath, 'utf8'));

        // Try to read version.json for application version
        let appVersion = 'unknown';
        try {
          const versionPath = join(content.installation_path, '.claude', 'version.json');
          if (existsSync(versionPath)) {
            const versionInfo = JSON.parse(readFileSync(versionPath, 'utf8'));
            appVersion = versionInfo.version || 'unknown';
          }
        } catch {
          // Ignore
        }

        manifests.push({
          ...content,
          manifest_file: filePath,
          application_version: appVersion,
          files_count: content.files?.length || 0,
          directories_count: content.directories?.length || 0
        });
      } catch {
        // Skip invalid manifest files
      }
    }

    // Sort by installation date (newest first)
    manifests.sort((a, b) => new Date(b.installation_date) - new Date(a.installation_date));

  } catch {
    // Ignore errors
  }

  return manifests;
}

/**
 * Find manifest for a specific path and mode
 * @param {string} installPath - Installation path
 * @param {string} mode - Installation mode
 * @returns {Object|null} - Manifest or null
 */
export function findManifest(installPath, mode) {
  const manifests = getAllManifests();
  const normalizedPath = installPath.toLowerCase().replace(/[\\/]+$/, '');

  return manifests.find(m => {
    const manifestPath = (m.installation_path || '').toLowerCase().replace(/[\\/]+$/, '');
    return manifestPath === normalizedPath && m.installation_mode === mode;
  }) || null;
}

/**
 * Delete a manifest file
 * @param {string} manifestFile - Path to manifest file
 */
export function deleteManifest(manifestFile) {
  if (existsSync(manifestFile)) {
    unlinkSync(manifestFile);
  }
}

/**
 * Get manifest directory path
 * @returns {string}
 */
export function getManifestDir() {
  return MANIFEST_DIR;
}
