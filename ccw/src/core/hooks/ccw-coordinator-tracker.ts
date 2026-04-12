/**
 * CCW Coordinator Tracker — Progress tracking for /ccw and /ccw-coordinator
 *
 * Tracks session state across two coordinator types:
 *   A) /ccw — reads .workflow/.ccw/{session}/status.json
 *   B) /ccw-coordinator — reads .workflow/.ccw-coordinator/{session}/state.json
 *
 * Bridge file: {tmpdir}/ccw-coord-{cc_session_id}.json
 *
 * Inspired by maestro2's coordinator-tracker design.
 */

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CcwCoordinatorType = 'ccw' | 'ccw-coordinator';

export interface CcwCoordStep {
  index: number;
  command: string;
}

export interface CcwCoordBridgeData {
  session_id: string;
  coordinator: CcwCoordinatorType;
  chain_name: string;
  intent: string;
  steps_total: number;
  steps_completed: number;
  current_step: CcwCoordStep | null;
  next_step: CcwCoordStep | null;
  remaining_steps: Array<{ command: string }>;
  status: string;
  updated_at: number;
}

// ---------------------------------------------------------------------------
// A: Read .workflow/.ccw/{session}/status.json
// ---------------------------------------------------------------------------

interface CcwStatusJson {
  session_id?: string;
  workflow?: string;
  status?: string;
  analysis?: {
    goal?: string;
  };
  command_chain?: Array<{
    index?: number;
    command?: string;
    status?: string;
  }>;
  current_index?: number;
}

/**
 * Scan .workflow/.ccw/ for the most recently modified status.json.
 * Returns parsed bridge data or null if none found.
 */
export function readCcwStatus(workspaceRoot: string): CcwCoordBridgeData | null {
  const ccwDir = join(workspaceRoot, '.workflow', '.ccw');
  if (!existsSync(ccwDir)) return null;

  try {
    const sessions = readdirSync(ccwDir)
      .map(name => {
        const statusPath = join(ccwDir, name, 'status.json');
        if (!existsSync(statusPath)) return null;
        try {
          return { name, mtime: statSync(statusPath).mtimeMs, path: statusPath };
        } catch { return null; }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => b.mtime - a.mtime);

    if (sessions.length === 0) return null;

    const raw: CcwStatusJson = JSON.parse(readFileSync(sessions[0].path, 'utf8'));
    return parseCcwStatus(raw, sessions[0].mtime, sessions[0].name);
  } catch {
    return null;
  }
}

function parseCcwStatus(raw: CcwStatusJson, mtime: number, dirName?: string): CcwCoordBridgeData | null {
  const chain = raw.command_chain ?? [];
  const currentIdx = raw.current_index ?? 0;
  const completed = chain.filter(s => s.status === 'completed').length;

  const currentStep = chain[currentIdx]
    ? { index: currentIdx, command: chain[currentIdx].command ?? '' }
    : null;

  const nextIdx = currentIdx + 1;
  const nextStep = chain[nextIdx]
    ? { index: nextIdx, command: chain[nextIdx].command ?? '' }
    : null;

  const remaining = chain.slice(nextIdx).map(s => ({
    command: s.command ?? '',
  }));

  return {
    session_id: '',
    coordinator: 'ccw',
    chain_name: raw.workflow ?? '',
    intent: raw.analysis?.goal ?? '',
    steps_total: chain.length,
    steps_completed: completed,
    current_step: currentStep,
    next_step: nextStep,
    remaining_steps: remaining,
    status: raw.status ?? 'unknown',
    updated_at: Math.floor(mtime),
  };
}

// ---------------------------------------------------------------------------
// B: Read .workflow/.ccw-coordinator/{session}/state.json
// ---------------------------------------------------------------------------

interface CcwCoordinatorStateJson {
  session_id?: string;
  status?: string;
  workflow?: string;
  analysis?: {
    goal?: string;
  };
  command_chain?: Array<{
    index?: number;
    command?: string;
    status?: string;
  }>;
  execution_results?: Array<{
    index?: number;
    command?: string;
    status?: string;
    session_id?: string;
    artifacts?: string[];
  }>;
}

/**
 * Scan .workflow/.ccw-coordinator/ for the most recently modified state.json.
 * Returns parsed bridge data or null if none found.
 */
export function readCcwCoordinatorStatus(workspaceRoot: string): CcwCoordBridgeData | null {
  const coordDir = join(workspaceRoot, '.workflow', '.ccw-coordinator');
  if (!existsSync(coordDir)) return null;

  try {
    const sessions = readdirSync(coordDir)
      .map(name => {
        const statePath = join(coordDir, name, 'state.json');
        if (!existsSync(statePath)) return null;
        try {
          return { name, mtime: statSync(statePath).mtimeMs, path: statePath };
        } catch { return null; }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => b.mtime - a.mtime);

    if (sessions.length === 0) return null;

    const raw: CcwCoordinatorStateJson = JSON.parse(readFileSync(sessions[0].path, 'utf8'));
    return parseCcwCoordinatorStatus(raw, sessions[0].mtime);
  } catch {
    return null;
  }
}

function parseCcwCoordinatorStatus(raw: CcwCoordinatorStateJson, mtime: number): CcwCoordBridgeData | null {
  const chain = raw.command_chain ?? [];
  const results = raw.execution_results ?? [];
  const currentIdx = results.findIndex(r => r.status === 'in-progress');
  const completed = results.filter(r => r.status === 'completed').length;

  const currentStep = currentIdx >= 0 && chain[currentIdx]
    ? { index: currentIdx, command: chain[currentIdx].command ?? '' }
    : null;

  const nextIdx = currentIdx >= 0 ? currentIdx + 1 : chain.length;
  const nextStep = chain[nextIdx]
    ? { index: nextIdx, command: chain[nextIdx].command ?? '' }
    : null;

  const remaining = chain.slice(nextIdx).map(s => ({
    command: s.command ?? '',
  }));

  return {
    session_id: '',
    coordinator: 'ccw-coordinator',
    chain_name: raw.workflow ?? '',
    intent: raw.analysis?.goal ?? '',
    steps_total: chain.length,
    steps_completed: completed,
    current_step: currentStep,
    next_step: nextStep,
    remaining_steps: remaining,
    status: raw.status ?? 'unknown',
    updated_at: Math.floor(mtime),
  };
}

// ---------------------------------------------------------------------------
// Latest session resolver
// ---------------------------------------------------------------------------

/**
 * Pick the most recently updated session across ccw and ccw-coordinator.
 * Compares file mtime to determine which is newest.
 */
export function readLatestCcwSession(
  workspaceRoot: string,
  existingBridge?: CcwCoordBridgeData | null,
): CcwCoordBridgeData | null {
  const ccw = readCcwStatus(workspaceRoot);
  const coord = readCcwCoordinatorStatus(workspaceRoot);

  const candidates = [ccw, coord, existingBridge ?? null].filter(
    (c): c is CcwCoordBridgeData => c !== null,
  );

  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.updated_at - a.updated_at)[0];
}

// ---------------------------------------------------------------------------
// Bridge file I/O
// ---------------------------------------------------------------------------

const CCW_COORD_BRIDGE_PREFIX = 'ccw-coord-';

function bridgePath(sessionId: string): string {
  return join(tmpdir(), `${CCW_COORD_BRIDGE_PREFIX}${sessionId}.json`);
}

/** Write bridge file to tmpdir. */
export function writeCoordBridge(sessionId: string, data: CcwCoordBridgeData): void {
  try {
    writeFileSync(bridgePath(sessionId), JSON.stringify(data));
  } catch {
    // Best-effort — bridge write must not break hook
  }
}

/** Read bridge file from tmpdir. Returns null if missing/corrupt. */
export function readCoordBridge(sessionId: string): CcwCoordBridgeData | null {
  const p = bridgePath(sessionId);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Next-step hint builder
// ---------------------------------------------------------------------------

/**
 * Build a "next step" hint string for additionalContext injection.
 * Returns null if session is completed/failed or has no next step.
 */
export function buildNextStepHint(data: CcwCoordBridgeData): string | null {
  // Only inject hints for active sessions (running, waiting) with a next step
  const isActive = data.status === 'running' || data.status === 'waiting';
  if (!isActive) return null;
  if (!data.next_step) return null;

  const progress = `[${data.steps_completed}/${data.steps_total}]`;
  const lastCommand = data.current_step?.command ?? '(unknown)';
  const nextCommand = data.next_step.command;

  const lines = [
    `## CCW Coordinator Active`,
    `Chain: ${data.chain_name} ${progress} | Status: ${data.status}`,
    `Last: ${lastCommand}`,
    `Next: ${nextCommand}`,
  ];

  if (data.remaining_steps.length > 1) {
    const remaining = data.remaining_steps.slice(1, 4).map(s => s.command).join(' → ');
    lines.push(`Then: ${remaining}${data.remaining_steps.length > 4 ? ' …' : ''}`);
  }

  return lines.join('\n');
}
