import os from 'os';

export interface CliSessionPolicy {
  allowedTools: string[];
  maxSessions: number;
  idleTimeoutMs: number;
  allowWorkingDirOutsideProject: boolean;
  maxBufferBytes: number;
  rateLimit: {
    createPerMinute: number;
    executePerMinute: number;
    sendBytesPerMinute: number;
    resizePerMinute: number;
  };
}

function parseIntEnv(name: string, fallback: number): number {
  const raw = (process.env[name] ?? '').trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseBoolEnv(name: string, fallback: boolean): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y') return true;
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'n') return false;
  return fallback;
}

export function getCliSessionPolicy(): CliSessionPolicy {
  const defaultAllowedTools = ['claude', 'codex', 'gemini', 'qwen', 'opencode'];
  const allowedToolsRaw = (process.env.CCW_CLI_SESSIONS_ALLOWED_TOOLS ?? '').trim();
  const allowedTools = allowedToolsRaw
    ? allowedToolsRaw.split(',').map((t) => t.trim()).filter(Boolean)
    : defaultAllowedTools;

  const maxSessionsDefault = os.platform() === 'win32' ? 6 : 8;

  return {
    allowedTools,
    maxSessions: parseIntEnv('CCW_CLI_SESSIONS_MAX', maxSessionsDefault),
    idleTimeoutMs: parseIntEnv('CCW_CLI_SESSIONS_IDLE_TIMEOUT_MS', 30 * 60_000),
    allowWorkingDirOutsideProject: parseBoolEnv('CCW_CLI_SESSIONS_ALLOW_OUTSIDE_PROJECT', false),
    maxBufferBytes: parseIntEnv('CCW_CLI_SESSIONS_MAX_BUFFER_BYTES', 2 * 1024 * 1024),
    rateLimit: {
      createPerMinute: parseIntEnv('CCW_CLI_SESSIONS_RL_CREATE_PER_MIN', 12),
      executePerMinute: parseIntEnv('CCW_CLI_SESSIONS_RL_EXECUTE_PER_MIN', 60),
      sendBytesPerMinute: parseIntEnv('CCW_CLI_SESSIONS_RL_SEND_BYTES_PER_MIN', 256 * 1024),
      resizePerMinute: parseIntEnv('CCW_CLI_SESSIONS_RL_RESIZE_PER_MIN', 120),
    },
  };
}

