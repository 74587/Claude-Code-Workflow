/**
 * CodexLens Tool - STUB (v1 removed)
 *
 * The v1 Python bridge has been removed. This module provides no-op stubs
 * so that existing consumers compile without errors.
 * Semantic search is now handled entirely by codexlens-search v2.
 */

import type { ToolSchema, ToolResult } from '../types/tool.js';

// ---------------------------------------------------------------------------
// Types (kept for backward compatibility)
// ---------------------------------------------------------------------------

interface ReadyStatus {
  ready: boolean;
  installed: boolean;
  error?: string;
  version?: string;
  pythonVersion?: string;
  venvPath?: string;
}

interface SemanticStatus {
  available: boolean;
  backend?: string;
  accelerator?: string;
  providers?: string[];
  litellmAvailable?: boolean;
  error?: string;
}

interface BootstrapResult {
  success: boolean;
  message?: string;
  error?: string;
  details?: {
    pythonVersion?: string;
    venvPath?: string;
    packagePath?: string;
    installer?: 'uv' | 'pip';
    editable?: boolean;
  };
}

interface ExecuteResult {
  success: boolean;
  output?: string;
  error?: string;
  message?: string;
  warning?: string;
  results?: unknown;
  files?: unknown;
  symbols?: unknown;
}

interface ExecuteOptions {
  timeout?: number;
  cwd?: string;
  onProgress?: (progress: ProgressInfo) => void;
}

interface ProgressInfo {
  stage: string;
  message: string;
  percent: number;
  filesProcessed?: number;
  totalFiles?: number;
}

type GpuMode = 'cpu' | 'cuda' | 'directml';

interface PythonEnvInfo {
  version: string;
  majorMinor: string;
  architecture: number;
  compatible: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// No-op implementations
// ---------------------------------------------------------------------------

const V1_REMOVED = 'CodexLens v1 has been removed. Use codexlens-search v2.';

async function ensureReady(): Promise<ReadyStatus> {
  return { ready: false, installed: false, error: V1_REMOVED };
}

async function executeCodexLens(_args: string[], _options: ExecuteOptions = {}): Promise<ExecuteResult> {
  return { success: false, error: V1_REMOVED };
}

async function checkVenvStatus(_force?: boolean): Promise<ReadyStatus> {
  return { ready: false, installed: false, error: V1_REMOVED };
}

async function bootstrapVenv(): Promise<BootstrapResult> {
  return { success: false, error: V1_REMOVED };
}

async function checkSemanticStatus(_force?: boolean): Promise<SemanticStatus> {
  return { available: false, error: V1_REMOVED };
}

async function ensureLiteLLMEmbedderReady(): Promise<BootstrapResult> {
  return { success: false, error: V1_REMOVED };
}

async function installSemantic(_gpuMode: GpuMode = 'cpu'): Promise<BootstrapResult> {
  return { success: false, error: V1_REMOVED };
}

async function detectGpuSupport(): Promise<{ mode: GpuMode; available: GpuMode[]; info: string; pythonEnv?: PythonEnvInfo }> {
  return { mode: 'cpu', available: ['cpu'], info: V1_REMOVED };
}

async function uninstallCodexLens(): Promise<BootstrapResult> {
  return { success: false, error: V1_REMOVED };
}

function cancelIndexing(): { success: boolean; message?: string; error?: string } {
  return { success: false, error: V1_REMOVED };
}

function isIndexingInProgress(): boolean {
  return false;
}

async function bootstrapWithUv(_gpuMode: GpuMode = 'cpu'): Promise<BootstrapResult> {
  return { success: false, error: V1_REMOVED };
}

async function installSemanticWithUv(_gpuMode: GpuMode = 'cpu'): Promise<BootstrapResult> {
  return { success: false, error: V1_REMOVED };
}

function useCodexLensV2(): boolean {
  return true; // v2 is now the only option
}

function isCodexLensV2Installed(): boolean {
  return false;
}

async function bootstrapV2WithUv(): Promise<BootstrapResult> {
  return { success: false, error: V1_REMOVED };
}

function getVenvPythonPath(): string {
  return 'python';
}

// ---------------------------------------------------------------------------
// Tool schema / handler (no-op)
// ---------------------------------------------------------------------------

export const schema: ToolSchema = {
  name: 'codex_lens',
  description: '[REMOVED] CodexLens v1 tool has been removed. Use smart_search instead.',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', description: 'Action (v1 removed)' },
    },
  },
};

export async function handler(_params: Record<string, unknown>): Promise<ToolResult<ExecuteResult>> {
  return {
    success: false,
    error: V1_REMOVED,
    result: { success: false, error: V1_REMOVED },
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type { ProgressInfo, ExecuteOptions, GpuMode, PythonEnvInfo };

export {
  ensureReady,
  executeCodexLens,
  checkVenvStatus,
  bootstrapVenv,
  checkSemanticStatus,
  ensureLiteLLMEmbedderReady,
  installSemantic,
  detectGpuSupport,
  uninstallCodexLens,
  cancelIndexing,
  isIndexingInProgress,
  bootstrapWithUv,
  installSemanticWithUv,
  useCodexLensV2,
  isCodexLensV2Installed,
  bootstrapV2WithUv,
  getVenvPythonPath,
};

export const __testables = {};

export const codexLensTool = {
  name: schema.name,
  description: schema.description,
  parameters: schema.inputSchema,
  execute: async (_params: Record<string, unknown>) => {
    return { success: false, error: V1_REMOVED };
  },
};
