/**
 * CLI Settings Type Definitions
 * Supports Claude CLI --settings parameter format
 */

/**
 * Claude CLI Settings 文件格式
 * 对应 `claude --settings <file-or-json>` 参数
 */
export interface ClaudeCliSettings {
  /** 环境变量配置 */
  env: {
    /** Anthropic API Token */
    ANTHROPIC_AUTH_TOKEN?: string;
    /** Anthropic API Base URL */
    ANTHROPIC_BASE_URL?: string;
    /** 禁用自动更新 */
    DISABLE_AUTOUPDATER?: string;
    /** 其他自定义环境变量 */
    [key: string]: string | undefined;
  };
  /** 模型选择 */
  model?: 'opus' | 'sonnet' | 'haiku' | string;
  /** 是否包含 co-authored-by */
  includeCoAuthoredBy?: boolean;
}

/**
 * 端点 Settings 配置（带元数据）
 */
export interface EndpointSettings {
  /** 端点唯一标识 */
  id: string;
  /** 端点显示名称 */
  name: string;
  /** 端点描述 */
  description?: string;
  /** Claude CLI Settings */
  settings: ClaudeCliSettings;
  /** 是否启用 */
  enabled: boolean;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * Settings 列表响应
 */
export interface SettingsListResponse {
  endpoints: EndpointSettings[];
  total: number;
}

/**
 * Settings 操作结果
 */
export interface SettingsOperationResult {
  success: boolean;
  message?: string;
  endpoint?: EndpointSettings;
  filePath?: string;
}

/**
 * 创建/更新端点请求
 */
export interface SaveEndpointRequest {
  id?: string;
  name: string;
  description?: string;
  settings: ClaudeCliSettings;
  enabled?: boolean;
}

/**
 * 从 LiteLLM Provider 映射到 Claude CLI env
 */
export function mapProviderToClaudeEnv(provider: {
  apiKey?: string;
  apiBase?: string;
}): ClaudeCliSettings['env'] {
  const env: ClaudeCliSettings['env'] = {};

  if (provider.apiKey) {
    env.ANTHROPIC_AUTH_TOKEN = provider.apiKey;
  }
  if (provider.apiBase) {
    env.ANTHROPIC_BASE_URL = provider.apiBase;
  }
  // 默认禁用自动更新
  env.DISABLE_AUTOUPDATER = '1';

  return env;
}

/**
 * 创建默认 Settings
 */
export function createDefaultSettings(): ClaudeCliSettings {
  return {
    env: {
      DISABLE_AUTOUPDATER: '1'
    },
    model: 'sonnet',
    includeCoAuthoredBy: false
  };
}

/**
 * 验证 Settings 格式
 */
export function validateSettings(settings: unknown): settings is ClaudeCliSettings {
  if (!settings || typeof settings !== 'object') {
    return false;
  }

  const s = settings as Record<string, unknown>;

  // env 必须存在且为对象
  if (!s.env || typeof s.env !== 'object') {
    return false;
  }

  // model 可选，但如果存在必须是字符串
  if (s.model !== undefined && typeof s.model !== 'string') {
    return false;
  }

  // includeCoAuthoredBy 可选，但如果存在必须是布尔值
  if (s.includeCoAuthoredBy !== undefined && typeof s.includeCoAuthoredBy !== 'boolean') {
    return false;
  }

  return true;
}
