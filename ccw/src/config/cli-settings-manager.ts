/**
 * CLI Settings File Manager
 * Manages Claude CLI settings files for endpoint configuration
 *
 * Storage: ~/.ccw/cli-settings/{endpoint-id}.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { getCCWHome, ensureStorageDir } from './storage-paths.js';
import {
  ClaudeCliSettings,
  EndpointSettings,
  SettingsListResponse,
  SettingsOperationResult,
  SaveEndpointRequest,
  validateSettings,
  createDefaultSettings
} from '../types/cli-settings.js';

/**
 * Get CLI settings directory path
 */
export function getCliSettingsDir(): string {
  return join(getCCWHome(), 'cli-settings');
}

/**
 * Get settings file path for an endpoint
 */
export function getSettingsFilePath(endpointId: string): string {
  return join(getCliSettingsDir(), `${endpointId}.json`);
}

/**
 * Get index file path (stores endpoint metadata)
 */
function getIndexFilePath(): string {
  return join(getCliSettingsDir(), '_index.json');
}

/**
 * Ensure settings directory exists
 */
export function ensureSettingsDir(): void {
  ensureStorageDir(getCliSettingsDir());
}

/**
 * Load endpoint index (metadata only, not settings content)
 */
function loadIndex(): Map<string, Omit<EndpointSettings, 'settings'>> {
  const indexPath = getIndexFilePath();
  if (!existsSync(indexPath)) {
    return new Map();
  }

  try {
    const data = JSON.parse(readFileSync(indexPath, 'utf-8'));
    return new Map(Object.entries(data));
  } catch {
    return new Map();
  }
}

/**
 * Save endpoint index
 */
function saveIndex(index: Map<string, Omit<EndpointSettings, 'settings'>>): void {
  ensureSettingsDir();
  const indexPath = getIndexFilePath();
  const data = Object.fromEntries(index);
  writeFileSync(indexPath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Generate unique endpoint ID
 */
function generateEndpointId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ep-${timestamp}-${random}`;
}

/**
 * Save endpoint settings to file
 */
export function saveEndpointSettings(request: SaveEndpointRequest): SettingsOperationResult {
  try {
    ensureSettingsDir();

    const now = new Date().toISOString();
    const index = loadIndex();

    // Determine endpoint ID
    const endpointId = request.id || generateEndpointId();

    // Check if updating existing or creating new
    const existing = index.get(endpointId);

    // Create endpoint metadata
    const metadata: Omit<EndpointSettings, 'settings'> = {
      id: endpointId,
      name: request.name,
      description: request.description,
      enabled: request.enabled ?? true,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    // Save settings file
    const settingsPath = getSettingsFilePath(endpointId);
    writeFileSync(settingsPath, JSON.stringify(request.settings, null, 2), 'utf-8');

    // Update index
    index.set(endpointId, metadata);
    saveIndex(index);

    // Return full endpoint settings
    const endpoint: EndpointSettings = {
      ...metadata,
      settings: request.settings
    };

    return {
      success: true,
      message: existing ? 'Endpoint updated' : 'Endpoint created',
      endpoint,
      filePath: settingsPath
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to save endpoint settings: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Load endpoint settings from file
 */
export function loadEndpointSettings(endpointId: string): EndpointSettings | null {
  try {
    const index = loadIndex();
    const metadata = index.get(endpointId);

    if (!metadata) {
      return null;
    }

    const settingsPath = getSettingsFilePath(endpointId);
    if (!existsSync(settingsPath)) {
      return null;
    }

    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));

    if (!validateSettings(settings)) {
      console.error(`[CliSettings] Invalid settings format for ${endpointId}`);
      return null;
    }

    return {
      ...metadata,
      settings
    };
  } catch (e) {
    console.error(`[CliSettings] Failed to load settings for ${endpointId}:`, e);
    return null;
  }
}

/**
 * Delete endpoint settings
 */
export function deleteEndpointSettings(endpointId: string): SettingsOperationResult {
  const index = loadIndex();

  if (!index.has(endpointId)) {
    return {
      success: false,
      message: 'Endpoint not found'
    };
  }

  const settingsPath = getSettingsFilePath(endpointId);

  try {
    // Step 1: Delete file first
    if (existsSync(settingsPath)) {
      unlinkSync(settingsPath);
    }

    // Step 2: Only update index after successful file deletion
    index.delete(endpointId);
    saveIndex(index);

    return {
      success: true,
      message: 'Endpoint deleted'
    };
  } catch (error) {
    // If deletion fails, index remains unchanged for consistency
    return {
      success: false,
      message: `Failed to delete endpoint file: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * List all endpoint settings
 */
export function listAllSettings(): SettingsListResponse {
  try {
    const index = loadIndex();
    const endpoints: EndpointSettings[] = [];

    for (const [endpointId, metadata] of index) {
      const settingsPath = getSettingsFilePath(endpointId);

      if (!existsSync(settingsPath)) {
        continue;
      }

      try {
        const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));

        if (validateSettings(settings)) {
          endpoints.push({
            ...metadata,
            settings
          });
        }
      } catch (e) {
        // Skip invalid settings files, but log the error for debugging
        console.error(`[CliSettings] Failed to load or parse settings for ${endpointId}:`, e);
      }
    }

    return {
      endpoints,
      total: endpoints.length
    };
  } catch (e) {
    console.error('[CliSettings] Failed to list settings:', e);
    return {
      endpoints: [],
      total: 0
    };
  }
}

/**
 * Toggle endpoint enabled status
 */
export function toggleEndpointEnabled(endpointId: string, enabled: boolean): SettingsOperationResult {
  try {
    const index = loadIndex();
    const metadata = index.get(endpointId);

    if (!metadata) {
      return {
        success: false,
        message: 'Endpoint not found'
      };
    }

    metadata.enabled = enabled;
    metadata.updatedAt = new Date().toISOString();
    index.set(endpointId, metadata);
    saveIndex(index);

    // Load full settings for response
    const endpoint = loadEndpointSettings(endpointId);

    return {
      success: true,
      message: enabled ? 'Endpoint enabled' : 'Endpoint disabled',
      endpoint: endpoint || undefined
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to toggle endpoint: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Get settings file path for CLI execution
 * Returns null if endpoint not found or disabled
 */
export function getExecutableSettingsPath(endpointId: string): string | null {
  const endpoint = loadEndpointSettings(endpointId);

  if (!endpoint || !endpoint.enabled) {
    return null;
  }

  const settingsPath = getSettingsFilePath(endpointId);
  return existsSync(settingsPath) ? settingsPath : null;
}

/**
 * Create settings from LiteLLM provider configuration
 */
export function createSettingsFromProvider(provider: {
  apiKey?: string;
  apiBase?: string;
  name?: string;
}, options?: {
  model?: string;
  includeCoAuthoredBy?: boolean;
}): ClaudeCliSettings {
  const settings = createDefaultSettings();

  // Map provider credentials to env
  if (provider.apiKey) {
    settings.env.ANTHROPIC_AUTH_TOKEN = provider.apiKey;
  }
  if (provider.apiBase) {
    settings.env.ANTHROPIC_BASE_URL = provider.apiBase;
  }

  // Apply options
  if (options?.model) {
    settings.model = options.model;
  }
  if (options?.includeCoAuthoredBy !== undefined) {
    settings.includeCoAuthoredBy = options.includeCoAuthoredBy;
  }

  return settings;
}

/**
 * Validate and sanitize endpoint ID
 */
export function sanitizeEndpointId(id: string): string {
  // Remove special characters, keep alphanumeric and hyphens
  return id.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Check if endpoint ID exists
 */
export function endpointExists(endpointId: string): boolean {
  const index = loadIndex();
  return index.has(endpointId);
}

/**
 * Get enabled endpoints only
 */
export function getEnabledEndpoints(): EndpointSettings[] {
  const { endpoints } = listAllSettings();
  return endpoints.filter(ep => ep.enabled);
}
