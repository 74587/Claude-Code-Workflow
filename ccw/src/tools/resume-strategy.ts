/**
 * Resume Strategy Engine - Determines optimal resume approach
 * Supports native resume, prompt concatenation, and hybrid modes
 */

import type { ConversationTurn, ConversationRecord, NativeSessionMapping } from './cli-history-store.js';

// Strategy types
export type ResumeStrategy = 'native' | 'prompt-concat' | 'hybrid';

// Resume decision result
export interface ResumeDecision {
  strategy: ResumeStrategy;
  nativeSessionId?: string;      // Native UUID for native/hybrid modes
  isLatest?: boolean;            // Use latest/--last flag
  contextTurns?: ConversationTurn[];  // Turns to include as context prefix
  primaryConversationId?: string; // Primary conversation for append
}

// Resume strategy options
export interface ResumeStrategyOptions {
  tool: string;
  resumeIds: string[];           // CCW IDs to resume from
  customId?: string;             // New custom ID (fork scenario)
  forceNative?: boolean;         // Force native resume
  forcePromptConcat?: boolean;   // Force prompt concatenation

  // Lookup functions (dependency injection)
  getNativeSessionId: (ccwId: string) => string | null;
  getConversation: (ccwId: string) => ConversationRecord | null;
  getConversationTool: (ccwId: string) => string | null;
}

/**
 * Determine the optimal resume strategy based on scenario
 *
 * Scenarios:
 * 1. Single append (no customId) → native if mapping exists
 * 2. Fork (customId provided) → prompt-concat (new conversation)
 * 3. Merge multiple → hybrid (primary native + others as context)
 * 4. Cross-tool → prompt-concat (tools differ)
 * 5. resume=true (latest) → native with isLatest flag
 */
export function determineResumeStrategy(options: ResumeStrategyOptions): ResumeDecision {
  const {
    tool,
    resumeIds,
    customId,
    forceNative,
    forcePromptConcat,
    getNativeSessionId,
    getConversation,
    getConversationTool
  } = options;

  // Force prompt concatenation
  if (forcePromptConcat) {
    return buildPromptConcatDecision(resumeIds, getConversation);
  }

  // No resume IDs - new conversation
  if (resumeIds.length === 0) {
    return { strategy: 'prompt-concat' };
  }

  // Scenario 5: resume=true (latest) - use native latest
  // This is handled before this function is called, but included for completeness

  // Scenario 2: Fork (customId provided) → always prompt-concat
  if (customId) {
    return buildPromptConcatDecision(resumeIds, getConversation);
  }

  // Scenario 4: Check for cross-tool resume
  const crossTool = resumeIds.some(id => {
    const convTool = getConversationTool(id);
    return convTool && convTool !== tool;
  });

  if (crossTool) {
    return buildPromptConcatDecision(resumeIds, getConversation);
  }

  // Scenario 1: Single append
  if (resumeIds.length === 1) {
    const nativeId = getNativeSessionId(resumeIds[0]);

    if (nativeId || forceNative) {
      return {
        strategy: 'native',
        nativeSessionId: nativeId || undefined,
        primaryConversationId: resumeIds[0]
      };
    }

    // No native mapping, fall back to prompt-concat
    return buildPromptConcatDecision(resumeIds, getConversation);
  }

  // Scenario 3: Merge multiple conversations → hybrid mode
  return buildHybridDecision(resumeIds, tool, getNativeSessionId, getConversation);
}

/**
 * Build prompt-concat decision with all turns loaded
 */
function buildPromptConcatDecision(
  resumeIds: string[],
  getConversation: (ccwId: string) => ConversationRecord | null
): ResumeDecision {
  const allTurns: ConversationTurn[] = [];

  for (const id of resumeIds) {
    const conversation = getConversation(id);
    if (conversation) {
      // Add source ID to each turn for tracking
      const turnsWithSource = conversation.turns.map(turn => ({
        ...turn,
        _sourceId: id
      }));
      allTurns.push(...turnsWithSource as ConversationTurn[]);
    }
  }

  // Sort by timestamp
  allTurns.sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return {
    strategy: 'prompt-concat',
    contextTurns: allTurns,
    primaryConversationId: resumeIds[0]
  };
}

/**
 * Build hybrid decision: primary uses native, others as context prefix
 */
function buildHybridDecision(
  resumeIds: string[],
  tool: string,
  getNativeSessionId: (ccwId: string) => string | null,
  getConversation: (ccwId: string) => ConversationRecord | null
): ResumeDecision {
  // Find the first ID with native session mapping
  let primaryId: string | null = null;
  let nativeId: string | null = null;

  for (const id of resumeIds) {
    const native = getNativeSessionId(id);
    if (native) {
      primaryId = id;
      nativeId = native;
      break;
    }
  }

  // If no native mapping found, use first as primary
  if (!primaryId) {
    primaryId = resumeIds[0];
  }

  // Collect context turns from non-primary conversations
  const contextTurns: ConversationTurn[] = [];

  for (const id of resumeIds) {
    if (id === primaryId && nativeId) {
      // Skip primary if using native - its context is handled natively
      continue;
    }

    const conversation = getConversation(id);
    if (conversation) {
      const turnsWithSource = conversation.turns.map(turn => ({
        ...turn,
        _sourceId: id
      }));
      contextTurns.push(...turnsWithSource as ConversationTurn[]);
    }
  }

  // Sort context turns by timestamp
  contextTurns.sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // If we have native ID, use hybrid; otherwise fall back to prompt-concat
  if (nativeId) {
    return {
      strategy: 'hybrid',
      nativeSessionId: nativeId,
      contextTurns: contextTurns.length > 0 ? contextTurns : undefined,
      primaryConversationId: primaryId
    };
  }

  // No native mapping, use full prompt-concat
  return buildPromptConcatDecision(resumeIds, getConversation);
}

/**
 * Build context prefix for hybrid mode
 * Formats non-primary conversation turns as context
 */
export function buildContextPrefix(
  contextTurns: ConversationTurn[],
  format: 'plain' | 'yaml' | 'json' = 'plain'
): string {
  if (!contextTurns || contextTurns.length === 0) {
    return '';
  }

  const maxOutputLength = 4096; // Truncate long outputs

  switch (format) {
    case 'yaml':
      return buildYamlContext(contextTurns, maxOutputLength);
    case 'json':
      return buildJsonContext(contextTurns, maxOutputLength);
    default:
      return buildPlainContext(contextTurns, maxOutputLength);
  }
}

function buildPlainContext(turns: ConversationTurn[], maxLength: number): string {
  const lines: string[] = [
    '=== MERGED CONTEXT FROM OTHER CONVERSATIONS ===',
    ''
  ];

  for (const turn of turns) {
    const sourceId = (turn as any)._sourceId || 'unknown';
    lines.push(`--- Turn ${turn.turn} [${sourceId}] ---`);
    lines.push(`USER:`);
    lines.push(turn.prompt);
    lines.push('');
    lines.push(`ASSISTANT:`);
    const output = turn.output.stdout || '';
    lines.push(output.length > maxLength ? output.substring(0, maxLength) + '\n[truncated]' : output);
    lines.push('');
  }

  lines.push('=== END MERGED CONTEXT ===');
  lines.push('');

  return lines.join('\n');
}

function buildYamlContext(turns: ConversationTurn[], maxLength: number): string {
  const lines: string[] = [
    'merged_context:',
    '  source: "other_conversations"',
    '  turns:'
  ];

  for (const turn of turns) {
    const sourceId = (turn as any)._sourceId || 'unknown';
    const output = turn.output.stdout || '';
    const truncatedOutput = output.length > maxLength
      ? output.substring(0, maxLength) + '\n[truncated]'
      : output;

    lines.push(`    - turn: ${turn.turn}`);
    lines.push(`      source: "${sourceId}"`);
    lines.push(`      user: |`);
    lines.push(turn.prompt.split('\n').map(l => `        ${l}`).join('\n'));
    lines.push(`      assistant: |`);
    lines.push(truncatedOutput.split('\n').map(l => `        ${l}`).join('\n'));
  }

  lines.push('');
  return lines.join('\n');
}

function buildJsonContext(turns: ConversationTurn[], maxLength: number): string {
  const context = {
    merged_context: {
      source: 'other_conversations',
      turns: turns.map(turn => {
        const output = turn.output.stdout || '';
        return {
          turn: turn.turn,
          source: (turn as any)._sourceId || 'unknown',
          user: turn.prompt,
          assistant: output.length > maxLength
            ? output.substring(0, maxLength) + '\n[truncated]'
            : output
        };
      })
    }
  };

  return JSON.stringify(context, null, 2) + '\n\n';
}

/**
 * Check if a resume scenario requires native resume
 */
export function shouldUseNativeResume(
  tool: string,
  resumeIds: string[],
  customId: string | undefined,
  getNativeSessionId: (ccwId: string) => string | null,
  getConversationTool: (ccwId: string) => string | null
): boolean {
  // Fork always uses prompt-concat
  if (customId) return false;

  // No resume IDs
  if (resumeIds.length === 0) return false;

  // Cross-tool not supported natively
  const crossTool = resumeIds.some(id => {
    const convTool = getConversationTool(id);
    return convTool && convTool !== tool;
  });
  if (crossTool) return false;

  // Single resume with native mapping
  if (resumeIds.length === 1) {
    return !!getNativeSessionId(resumeIds[0]);
  }

  // Merge: at least one needs native mapping for hybrid
  return resumeIds.some(id => !!getNativeSessionId(id));
}

/**
 * Get resume mode description for logging
 */
export function getResumeModeDescription(decision: ResumeDecision): string {
  switch (decision.strategy) {
    case 'native':
      return `Native resume (session: ${decision.nativeSessionId || 'latest'})`;
    case 'hybrid':
      const contextCount = decision.contextTurns?.length || 0;
      return `Hybrid (native + ${contextCount} context turns)`;
    case 'prompt-concat':
      const turnCount = decision.contextTurns?.length || 0;
      return `Prompt concat (${turnCount} turns)`;
    default:
      return 'Unknown';
  }
}
