/**
 * Skill Types Definition
 * Types for skill management including enable/disable functionality
 */

/**
 * Skill location type
 */
export type SkillLocation = 'project' | 'user';

/**
 * Information about a disabled skill
 */
export interface DisabledSkillInfo {
  /** When the skill was disabled */
  disabledAt: string;
  /** Optional reason for disabling */
  reason?: string;
}

/**
 * Configuration for disabled skills
 * Stored in disabled-skills.json
 */
export interface DisabledSkillsConfig {
  /** Map of skill name to disabled info */
  skills: Record<string, DisabledSkillInfo>;
}

/**
 * Result of a skill operation (enable/disable)
 */
export interface SkillOperationResult {
  success: boolean;
  message?: string;
  skillName?: string;
  location?: SkillLocation;
  status?: number;
}

/**
 * Summary information for an active skill
 */
export interface SkillSummary {
  /** Skill name from SKILL.md frontmatter */
  name: string;
  /** Folder name (actual directory name) */
  folderName: string;
  /** Skill description */
  description: string;
  /** Skill version if specified */
  version: string | null;
  /** Allowed tools list */
  allowedTools: string[];
  /** Skill location (project or user) */
  location: SkillLocation;
  /** Full path to skill directory */
  path: string;
  /** Supporting files in the skill folder */
  supportingFiles: string[];
}

/**
 * Summary information for a disabled skill
 */
export interface DisabledSkillSummary extends SkillSummary {
  /** When the skill was disabled */
  disabledAt: string;
  /** Optional reason for disabling */
  reason?: string;
}

/**
 * Skills configuration for active skills only (backward compatible)
 */
export interface SkillsConfig {
  projectSkills: SkillSummary[];
  userSkills: SkillSummary[];
}

/**
 * Extended skills configuration including disabled skills
 */
export interface ExtendedSkillsConfig extends SkillsConfig {
  /** Disabled project skills */
  disabledProjectSkills: DisabledSkillSummary[];
  /** Disabled user skills */
  disabledUserSkills: DisabledSkillSummary[];
}

/**
 * Parsed skill frontmatter from SKILL.md
 */
export interface ParsedSkillFrontmatter {
  name: string;
  description: string;
  version: string | null;
  allowedTools: string[];
  content: string;
}

/**
 * Skill info extracted from validation
 */
export interface SkillInfo {
  name: string;
  description: string;
  version: string | null;
  allowedTools: string[];
  supportingFiles: string[];
}

/**
 * Skill folder validation result
 */
export type SkillFolderValidation =
  | { valid: true; errors: string[]; skillInfo: SkillInfo }
  | { valid: false; errors: string[]; skillInfo: null };
