/**
 * Theme Sharing Module
 * Encodes/decodes theme configurations as compact base64url strings
 * for copy-paste sharing between users.
 *
 * Format: 'ccw{version}:{base64url_payload}'
 * Payload uses short field names for compactness:
 *   v=version, c=colorScheme, h=customHue, t=styleTier,
 *   g=gradientLevel, w=enableHoverGlow, a=enableBackgroundAnimation
 *   bm=backgroundMode, bi=backgroundImageUrl, bp=photographerName,
 *   bu=photographerUrl, bpu=photoUrl, be=backgroundEffects
 *
 * @module themeShare
 */

import type { ThemeSlot, BackgroundConfig, BackgroundEffects } from '../types/store';
import type { ColorScheme, GradientLevel, StyleTier, BackgroundMode } from '../types/store';
import { DEFAULT_BACKGROUND_EFFECTS } from './theme';

// ========== Constants ==========

/** Current share format version. Bump when payload schema changes. */
export const SHARE_VERSION = 2;

/** Maximum encoded string length accepted for import */
const MAX_ENCODED_LENGTH = 800;

/** Version prefix pattern: 'ccw' followed by version number and colon */
const PREFIX_PATTERN = /^ccw(\d+):(.+)$/;

// ========== Types ==========

/** Serializable theme state for encoding/decoding */
export interface ThemeSharePayload {
  version: number;
  colorScheme: ColorScheme;
  customHue: number | null;
  styleTier: StyleTier;
  gradientLevel: GradientLevel;
  enableHoverGlow: boolean;
  enableBackgroundAnimation: boolean;
  backgroundConfig?: BackgroundConfig;
}

/** Compact wire format using short keys for smaller base64 output */
interface CompactPayload {
  v: number;
  c: string;
  h: number | null;
  t: string;
  g: string;
  w: boolean;
  a: boolean;
  // v2 background fields (optional)
  bm?: string;
  bi?: string;
  bp?: string;
  bu?: string;
  bpu?: string;
  be?: CompactEffects;
}

/** Compact background effects */
interface CompactEffects {
  b: number;  // blur
  d: number;  // darkenOpacity
  s: number;  // saturation
  f: boolean; // enableFrostedGlass
  g: boolean; // enableGrain
  v: boolean; // enableVignette
}

/** Result of decoding and validating an import string */
export type ImportResult =
  | { ok: true; payload: ThemeSharePayload; warning?: string }
  | { ok: false; error: string };

/** Version compatibility check result */
export interface VersionCheckResult {
  compatible: boolean;
  warning?: string;
}

// ========== Validation Constants ==========

const VALID_COLOR_SCHEMES: readonly string[] = ['blue', 'green', 'orange', 'purple'];
const VALID_STYLE_TIERS: readonly string[] = ['soft', 'standard', 'high-contrast'];
const VALID_GRADIENT_LEVELS: readonly string[] = ['off', 'standard', 'enhanced'];
const VALID_BACKGROUND_MODES: readonly string[] = ['gradient-only', 'image-only', 'image-gradient'];

// ========== Encoding ==========

/**
 * Encode a theme slot into a compact URL-safe base64 string with version prefix.
 *
 * Output format: 'ccw2:{base64url}'
 * The base64url payload contains JSON with short keys for compactness.
 * Background fields are only included when mode != gradient-only.
 *
 * @param slot - Theme slot to encode
 * @returns Encoded theme string (typically under 300 characters)
 */
export function encodeTheme(slot: ThemeSlot): string {
  const compact: CompactPayload = {
    v: SHARE_VERSION,
    c: slot.colorScheme,
    h: slot.customHue,
    t: slot.styleTier,
    g: slot.gradientLevel,
    w: slot.enableHoverGlow,
    a: slot.enableBackgroundAnimation,
  };

  // Only include background fields when mode != gradient-only
  const bg = slot.backgroundConfig;
  if (bg && bg.mode !== 'gradient-only') {
    compact.bm = bg.mode;
    if (bg.imageUrl) compact.bi = bg.imageUrl;
    if (bg.attribution) {
      compact.bp = bg.attribution.photographerName;
      compact.bu = bg.attribution.photographerUrl;
      compact.bpu = bg.attribution.photoUrl;
    }
    compact.be = {
      b: bg.effects.blur,
      d: bg.effects.darkenOpacity,
      s: bg.effects.saturation,
      f: bg.effects.enableFrostedGlass,
      g: bg.effects.enableGrain,
      v: bg.effects.enableVignette,
    };
  }

  const json = JSON.stringify(compact);

  // Use TextEncoder for consistent UTF-8 handling
  const encoder = new TextEncoder();
  const bytes = encoder.encode(json);

  // Convert bytes to binary string for btoa
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  // Base64 encode, then make URL-safe
  const base64 = btoa(binary);
  const base64url = base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `ccw${SHARE_VERSION}:${base64url}`;
}

// ========== Decoding ==========

/**
 * Decode and validate a theme share string.
 * Checks version compatibility and validates all field types/ranges.
 * Invalid input never causes side effects.
 * Handles both v1 (no background) and v2 (with background) payloads.
 *
 * @param encoded - The encoded theme string to decode
 * @returns ImportResult with decoded payload on success, or error message on failure
 */
export function decodeTheme(encoded: string): ImportResult {
  // Guard: reject empty input
  if (!encoded || typeof encoded !== 'string') {
    return { ok: false, error: 'empty_input' };
  }

  const trimmed = encoded.trim();

  // Guard: reject strings exceeding max length
  if (trimmed.length > MAX_ENCODED_LENGTH) {
    return { ok: false, error: 'too_long' };
  }

  // Extract version and payload from prefix
  const prefixMatch = trimmed.match(PREFIX_PATTERN);
  if (!prefixMatch) {
    return { ok: false, error: 'invalid_format' };
  }

  const prefixVersion = parseInt(prefixMatch[1], 10);
  const base64url = prefixMatch[2];

  // Restore standard base64 from URL-safe variant
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const remainder = base64.length % 4;
  if (remainder === 2) base64 += '==';
  else if (remainder === 3) base64 += '=';

  // Decode base64 to bytes
  let json: string;
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    // Use TextDecoder for consistent UTF-8 handling
    const decoder = new TextDecoder();
    json = decoder.decode(bytes);
  } catch {
    return { ok: false, error: 'decode_failed' };
  }

  // Parse JSON
  let compact: unknown;
  try {
    compact = JSON.parse(json);
  } catch {
    return { ok: false, error: 'parse_failed' };
  }

  // Validate object shape
  if (!compact || typeof compact !== 'object' || Array.isArray(compact)) {
    return { ok: false, error: 'invalid_payload' };
  }

  const obj = compact as Record<string, unknown>;

  // Extract and validate version
  const payloadVersion = typeof obj.v === 'number' ? obj.v : prefixVersion;

  // Check version compatibility
  const versionCheck = isVersionCompatible(payloadVersion);
  if (!versionCheck.compatible) {
    return { ok: false, error: 'incompatible_version' };
  }

  // Validate colorScheme
  if (typeof obj.c !== 'string' || !VALID_COLOR_SCHEMES.includes(obj.c)) {
    return { ok: false, error: 'invalid_field' };
  }

  // Validate customHue
  if (obj.h !== null && (typeof obj.h !== 'number' || !isFinite(obj.h))) {
    return { ok: false, error: 'invalid_field' };
  }

  // Validate styleTier
  if (typeof obj.t !== 'string' || !VALID_STYLE_TIERS.includes(obj.t)) {
    return { ok: false, error: 'invalid_field' };
  }

  // Validate gradientLevel
  if (typeof obj.g !== 'string' || !VALID_GRADIENT_LEVELS.includes(obj.g)) {
    return { ok: false, error: 'invalid_field' };
  }

  // Validate booleans
  if (typeof obj.w !== 'boolean' || typeof obj.a !== 'boolean') {
    return { ok: false, error: 'invalid_field' };
  }

  const payload: ThemeSharePayload = {
    version: payloadVersion,
    colorScheme: obj.c as ColorScheme,
    customHue: obj.h as number | null,
    styleTier: obj.t as StyleTier,
    gradientLevel: obj.g as GradientLevel,
    enableHoverGlow: obj.w,
    enableBackgroundAnimation: obj.a,
  };

  // Decode v2 background fields (optional — v1 payloads simply lack them)
  if (typeof obj.bm === 'string' && VALID_BACKGROUND_MODES.includes(obj.bm)) {
    const effects: BackgroundEffects = { ...DEFAULT_BACKGROUND_EFFECTS };

    // Parse compact effects
    if (obj.be && typeof obj.be === 'object' && !Array.isArray(obj.be)) {
      const be = obj.be as Record<string, unknown>;
      if (typeof be.b === 'number') effects.blur = be.b;
      if (typeof be.d === 'number') effects.darkenOpacity = be.d;
      if (typeof be.s === 'number') effects.saturation = be.s;
      if (typeof be.f === 'boolean') effects.enableFrostedGlass = be.f;
      if (typeof be.g === 'boolean') effects.enableGrain = be.g;
      if (typeof be.v === 'boolean') effects.enableVignette = be.v;
    }

    payload.backgroundConfig = {
      mode: obj.bm as BackgroundMode,
      imageUrl: typeof obj.bi === 'string' ? obj.bi : null,
      attribution: (typeof obj.bp === 'string' && typeof obj.bu === 'string' && typeof obj.bpu === 'string')
        ? { photographerName: obj.bp, photographerUrl: obj.bu, photoUrl: obj.bpu }
        : null,
      effects,
    };
  }

  return {
    ok: true,
    payload,
    warning: versionCheck.warning,
  };
}

// ========== Version Compatibility ==========

/**
 * Check if a payload version is within +/-2 of the current SHARE_VERSION.
 * Versions outside range are incompatible. Versions within range but
 * not equal get a warning that accuracy may vary.
 *
 * @param payloadVersion - Version number from the decoded payload
 * @returns Compatibility result with optional warning
 */
export function isVersionCompatible(payloadVersion: number): VersionCheckResult {
  const diff = Math.abs(payloadVersion - SHARE_VERSION);

  if (diff > 2) {
    return { compatible: false };
  }

  if (diff > 0) {
    return {
      compatible: true,
      warning: 'version_mismatch',
    };
  }

  return { compatible: true };
}
