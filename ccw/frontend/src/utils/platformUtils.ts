// ========================================
// Platform Utilities
// ========================================
// Platform detection and compatibility checking for hooks

// ========== Types ==========

/**
 * Detected platform type
 */
export type Platform = 'windows' | 'macos' | 'linux';

/**
 * Available shell types by platform
 */
export type ShellType = 'cmd' | 'bash' | 'powershell' | 'zsh';

/**
 * Compatibility check result
 */
export interface CompatibilityCheck {
  compatible: boolean;
  issues: string[];
  warnings: string[];
}

/**
 * Platform requirements for a hook template
 */
export interface PlatformRequirements {
  requiredPlatforms?: Platform[];
  optionalPlatforms?: Platform[];
  incompatiblePlatforms?: Platform[];
}

// ========== Platform Detection ==========

/**
 * Detect the current platform from user agent
 * @returns Detected platform type
 */
export function detect(): Platform {
  if (typeof window === 'undefined' || typeof window.navigator === 'undefined') {
    return 'linux'; // Default for server-side
  }

  const userAgent = window.navigator.userAgent;

  if (userAgent.includes('Win')) {
    return 'windows';
  } else if (userAgent.includes('Mac')) {
    return 'macos';
  } else {
    return 'linux';
  }
}

/**
 * Get the default shell for the current platform
 * @param platform - Optional platform override, otherwise auto-detects
 * @returns Shell type for the platform
 */
export function getShell(platform?: Platform): ShellType {
  const detectedPlatform = platform ?? detect();

  switch (detectedPlatform) {
    case 'windows':
      return 'cmd';
    case 'macos':
      return 'zsh';
    case 'linux':
      return 'bash';
    default:
      return 'bash';
  }
}

/**
 * Get the shell command prefix for executing scripts
 * @param shell - Shell type, defaults to detected platform
 * @returns Command prefix array (command, args...)
 */
export function getShellCommand(shell?: ShellType): string[] {
  const detectedShell = shell ?? getShell();

  switch (detectedShell) {
    case 'cmd':
      return ['cmd', '/c'];
    case 'powershell':
      return ['powershell', '-Command'];
    case 'bash':
      return ['bash', '-c'];
    case 'zsh':
      return ['zsh', '-c'];
    default:
      return ['bash', '-c'];
  }
}

/**
 * Get platform display name
 * @param platform - Platform type
 * @returns Human-readable platform name
 */
export function getPlatformName(platform: Platform): string {
  const names: Record<Platform, string> = {
    windows: 'Windows',
    macos: 'macOS',
    linux: 'Linux'
  };
  return names[platform];
}

/**
 * Get shell display name
 * @param shell - Shell type
 * @returns Human-readable shell name
 */
export function getShellName(shell: ShellType): string {
  const names: Record<ShellType, string> = {
    cmd: 'Command Prompt (cmd.exe)',
    bash: 'Bash',
    powershell: 'PowerShell',
    zsh: 'Zsh'
  };
  return names[shell];
}

// ========== Compatibility Checking ==========

/**
 * Check if a hook template is compatible with the current platform
 * @param requirements - Platform requirements for the template
 * @param platform - Optional platform override, otherwise auto-detects
 * @returns Compatibility check result with issues and warnings
 */
export function checkCompatibility(
  requirements: PlatformRequirements,
  platform?: Platform
): CompatibilityCheck {
  const detectedPlatform = platform ?? detect();
  const issues: string[] = [];
  const warnings: string[] = [];

  // Check for incompatible platforms
  if (requirements.incompatiblePlatforms?.includes(detectedPlatform)) {
    issues.push(
      `This hook is not compatible with ${getPlatformName(detectedPlatform)}. ` +
      `Incompatible platform detected.`
    );
    return { compatible: false, issues, warnings };
  }

  // Check for required platforms
  if (requirements.requiredPlatforms && requirements.requiredPlatforms.length > 0) {
    if (!requirements.requiredPlatforms.includes(detectedPlatform)) {
      const requiredNames = requirements.requiredPlatforms.map(getPlatformName).join(', ');
      issues.push(
        `This hook requires one of: ${requiredNames}. ` +
        `Current platform: ${getPlatformName(detectedPlatform)}.`
      );
      return { compatible: false, issues, warnings };
    }
  }

  // Check for optional platforms and add warning
  if (requirements.optionalPlatforms && requirements.optionalPlatforms.length > 0) {
    if (!requirements.optionalPlatforms.includes(detectedPlatform)) {
      const optionalNames = requirements.optionalPlatforms.map(getPlatformName).join(', ');
      warnings.push(
        `This hook has optional features for: ${optionalNames}. ` +
        `Some features may not work on ${getPlatformName(detectedPlatform)}.`
      );
    }
  }

  // All checks passed
  return { compatible: true, issues, warnings };
}

/**
 * Get platform-specific hook template adjustment
 * @param templateCommand - Base template command
 * @param platform - Optional platform override
 * @returns Adjusted command with platform-specific shell prefix
 */
export function adjustCommandForPlatform(
  templateCommand: string,
  platform?: Platform
): string[] {
  const shellCmd = getShellCommand(getShell(platform));
  return [...shellCmd, templateCommand];
}

// ========== Default Platform Requirements ==========

/**
 * Default platform requirements for common hook types
 */
export const DEFAULT_PLATFORM_REQUIREMENTS: Record<string, PlatformRequirements> = {
  'memory-update': {
    // Works on all platforms
    requiredPlatforms: undefined,
    optionalPlatforms: undefined,
    incompatiblePlatforms: []
  },
  'danger-protection': {
    // Works on all platforms
    requiredPlatforms: undefined,
    optionalPlatforms: undefined,
    incompatiblePlatforms: []
  },
  'skill-context': {
    // Requires skills API - works on all platforms
    requiredPlatforms: undefined,
    optionalPlatforms: undefined,
    incompatiblePlatforms: []
  },
  'git-operations': {
    // Git operations work on all platforms
    requiredPlatforms: undefined,
    optionalPlatforms: undefined,
    incompatiblePlatforms: []
  },
  'file-operations': {
    // File operations need adjustment for Windows paths
    requiredPlatforms: undefined,
    optionalPlatforms: ['linux', 'macos'],
    incompatiblePlatforms: []
  },
  'windows-specific': {
    // Windows-only hooks (e.g., PowerShell scripts)
    requiredPlatforms: ['windows'],
    optionalPlatforms: undefined,
    incompatiblePlatforms: []
  },
  'unix-specific': {
    // Unix-only hooks (bash scripts with shebang)
    requiredPlatforms: ['linux', 'macos'],
    optionalPlatforms: undefined,
    incompatiblePlatforms: ['windows']
  }
};
