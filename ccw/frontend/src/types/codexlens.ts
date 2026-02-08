// ========================================
// CodexLens Type Definitions
// ========================================
// TypeScript interfaces for structured env var form schema

/**
 * Model group definition for model-select fields
 */
export interface ModelGroup {
  group: string;
  items: string[];
}

/**
 * Schema for a single environment variable field
 */
export interface EnvVarFieldSchema {
  /** Environment variable key (e.g. CODEXLENS_EMBEDDING_BACKEND) */
  key: string;
  /** i18n label key */
  labelKey: string;
  /** Field type determines which control to render */
  type: 'select' | 'model-select' | 'number' | 'checkbox' | 'text';
  /** Options for select type */
  options?: string[];
  /** Default value */
  default?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Conditional visibility based on current env values */
  showWhen?: (env: Record<string, string>) => boolean;
  /** Mapped path in settings.json (e.g. embedding.backend) */
  settingsPath?: string;
  /** Min value for number type */
  min?: number;
  /** Max value for number type */
  max?: number;
  /** Step value for number type */
  step?: number;
  /** Preset local models for model-select */
  localModels?: ModelGroup[];
  /** Preset API models for model-select */
  apiModels?: ModelGroup[];
}

/**
 * Schema for a group of related environment variables
 */
export interface EnvVarGroup {
  /** Unique group identifier */
  id: string;
  /** i18n label key for group title */
  labelKey: string;
  /** Lucide icon name */
  icon: string;
  /** Ordered map of env var key to field schema */
  vars: Record<string, EnvVarFieldSchema>;
}

/**
 * Complete schema for all env var groups
 */
export type EnvVarGroupsSchema = Record<string, EnvVarGroup>;
