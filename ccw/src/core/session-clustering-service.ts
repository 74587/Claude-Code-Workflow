/**
 * Session Clustering Service
 * Intelligently groups related sessions into clusters using multi-dimensional similarity analysis
 */

import { CoreMemoryStore, SessionCluster, ClusterMember, SessionMetadataCache } from './core-memory-store.js';
import { CliHistoryStore } from '../tools/cli-history-store.js';
import { StoragePaths } from '../config/storage-paths.js';
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';

// Clustering dimension weights
const WEIGHTS = {
  fileOverlap: 0.3,
  temporalProximity: 0.2,
  semanticSimilarity: 0.3,
  intentAlignment: 0.2,
};

// Clustering threshold (0.4 = moderate similarity required)
const CLUSTER_THRESHOLD = 0.4;

export interface ClusteringOptions {
  scope?: 'all' | 'recent' | 'unclustered';
  timeRange?: { start: string; end: string };
  minClusterSize?: number;
}

export interface ClusteringResult {
  clustersCreated: number;
  sessionsProcessed: number;
  sessionsClustered: number;
}

export class SessionClusteringService {
  private coreMemoryStore: CoreMemoryStore;
  private cliHistoryStore: CliHistoryStore;
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.coreMemoryStore = new CoreMemoryStore(projectPath);
    this.cliHistoryStore = new CliHistoryStore(projectPath);
  }

  /**
   * Collect all session sources
   */
  async collectSessions(options?: ClusteringOptions): Promise<SessionMetadataCache[]> {
    const sessions: SessionMetadataCache[] = [];

    // 1. Core Memories
    const memories = this.coreMemoryStore.getMemories({ archived: false, limit: 1000 });
    for (const memory of memories) {
      const cached = this.coreMemoryStore.getSessionMetadata(memory.id);
      if (cached) {
        sessions.push(cached);
      } else {
        const metadata = this.extractMetadata(memory, 'core_memory');
        sessions.push(metadata);
      }
    }

    // 2. CLI History
    const history = this.cliHistoryStore.getHistory({ limit: 1000 });
    for (const exec of history.executions) {
      const cached = this.coreMemoryStore.getSessionMetadata(exec.id);
      if (cached) {
        sessions.push(cached);
      } else {
        const conversation = this.cliHistoryStore.getConversation(exec.id);
        if (conversation) {
          const metadata = this.extractMetadata(conversation, 'cli_history');
          sessions.push(metadata);
        }
      }
    }

    // 3. Workflow Sessions (WFS-*)
    const workflowSessions = await this.parseWorkflowSessions();
    sessions.push(...workflowSessions);

    // Apply scope filter
    if (options?.scope === 'recent') {
      // Last 30 days
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const cutoffStr = cutoff.toISOString();
      return sessions.filter(s => (s.created_at || '') >= cutoffStr);
    } else if (options?.scope === 'unclustered') {
      // Only sessions not in any cluster
      return sessions.filter(s => {
        const clusters = this.coreMemoryStore.getSessionClusters(s.session_id);
        return clusters.length === 0;
      });
    }

    return sessions;
  }

  /**
   * Extract metadata from a session
   */
  extractMetadata(session: any, type: 'core_memory' | 'workflow' | 'cli_history' | 'native'): SessionMetadataCache {
    let content = '';
    let title = '';
    let created_at = '';

    if (type === 'core_memory') {
      content = session.content || '';
      created_at = session.created_at;
      // Extract title from first line
      const lines = content.split('\n');
      title = lines[0].replace(/^#+\s*/, '').trim().substring(0, 100);
    } else if (type === 'cli_history') {
      // Extract from conversation turns
      const turns = session.turns || [];
      if (turns.length > 0) {
        content = turns.map((t: any) => t.prompt).join('\n');
        title = turns[0].prompt.substring(0, 100);
        created_at = session.created_at || turns[0].timestamp;
      }
    } else if (type === 'workflow') {
      content = session.content || '';
      title = session.title || 'Workflow Session';
      created_at = session.created_at || '';
    }

    const summary = content.substring(0, 200).trim();
    const keywords = this.extractKeywords(content);
    const file_patterns = this.extractFilePatterns(content);
    const token_estimate = Math.ceil(content.length / 4);

    return {
      session_id: session.id,
      session_type: type,
      title,
      summary,
      keywords,
      token_estimate,
      file_patterns,
      created_at,
      last_accessed: new Date().toISOString(),
      access_count: 0
    };
  }

  /**
   * Extract keywords from content
   */
  private extractKeywords(content: string): string[] {
    const keywords = new Set<string>();

    // 1. File paths (src/xxx, .ts, .js, etc)
    const filePathRegex = /(?:^|\s|["'`])((?:\.\/|\.\.\/|\/)?[\w-]+(?:\/[\w-]+)*\.[\w]+)(?:\s|["'`]|$)/g;
    let match;
    while ((match = filePathRegex.exec(content)) !== null) {
      keywords.add(match[1]);
    }

    // 2. Function/Class names (camelCase, PascalCase)
    const camelCaseRegex = /\b([A-Z][a-z]+(?:[A-Z][a-z]+)+|[a-z]+[A-Z][a-z]+(?:[A-Z][a-z]+)*)\b/g;
    while ((match = camelCaseRegex.exec(content)) !== null) {
      keywords.add(match[1]);
    }

    // 3. Technical terms (common frameworks/libraries)
    const techTerms = [
      'react', 'vue', 'angular', 'typescript', 'javascript', 'node', 'express',
      'auth', 'authentication', 'jwt', 'oauth', 'session', 'token',
      'api', 'rest', 'graphql', 'database', 'sql', 'mongodb', 'redis',
      'test', 'testing', 'jest', 'mocha', 'vitest',
      'refactor', 'refactoring', 'optimization', 'performance',
      'bug', 'fix', 'error', 'issue', 'debug'
    ];

    const lowerContent = content.toLowerCase();
    for (const term of techTerms) {
      if (lowerContent.includes(term)) {
        keywords.add(term);
      }
    }

    // Return top 20 keywords
    return Array.from(keywords).slice(0, 20);
  }

  /**
   * Extract file patterns from content
   */
  private extractFilePatterns(content: string): string[] {
    const patterns = new Set<string>();

    // Extract directory patterns (src/xxx/, lib/xxx/)
    const dirRegex = /\b((?:src|lib|test|dist|build|public|components|utils|services|config|core|tools)(?:\/[\w-]+)*)\//g;
    let match;
    while ((match = dirRegex.exec(content)) !== null) {
      patterns.add(match[1] + '/**');
    }

    // Extract file extension patterns
    const extRegex = /\.(\w+)(?:\s|$|["'`])/g;
    const extensions = new Set<string>();
    while ((match = extRegex.exec(content)) !== null) {
      extensions.add(match[1]);
    }

    // Add extension patterns
    if (extensions.size > 0) {
      patterns.add(`**/*.{${Array.from(extensions).join(',')}}`);
    }

    return Array.from(patterns).slice(0, 10);
  }

  /**
   * Calculate relevance score between two sessions
   */
  calculateRelevance(session1: SessionMetadataCache, session2: SessionMetadataCache): number {
    const fileScore = this.calculateFileOverlap(session1, session2);
    const temporalScore = this.calculateTemporalProximity(session1, session2);
    const semanticScore = this.calculateSemanticSimilarity(session1, session2);
    const intentScore = this.calculateIntentAlignment(session1, session2);

    return (
      fileScore * WEIGHTS.fileOverlap +
      temporalScore * WEIGHTS.temporalProximity +
      semanticScore * WEIGHTS.semanticSimilarity +
      intentScore * WEIGHTS.intentAlignment
    );
  }

  /**
   * Calculate file path overlap score (Jaccard similarity)
   */
  private calculateFileOverlap(s1: SessionMetadataCache, s2: SessionMetadataCache): number {
    const files1 = new Set(s1.file_patterns || []);
    const files2 = new Set(s2.file_patterns || []);

    if (files1.size === 0 || files2.size === 0) return 0;

    const intersection = new Set([...files1].filter(f => files2.has(f)));
    const union = new Set([...files1, ...files2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate temporal proximity score
   * 24h: 1.0, 7d: 0.7, 30d: 0.4, >30d: 0.1
   */
  private calculateTemporalProximity(s1: SessionMetadataCache, s2: SessionMetadataCache): number {
    if (!s1.created_at || !s2.created_at) return 0.1;

    const t1 = new Date(s1.created_at).getTime();
    const t2 = new Date(s2.created_at).getTime();
    const diffMs = Math.abs(t1 - t2);
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours <= 24) return 1.0;
    if (diffHours <= 24 * 7) return 0.7;
    if (diffHours <= 24 * 30) return 0.4;
    return 0.1;
  }

  /**
   * Calculate semantic similarity using keyword overlap (Jaccard similarity)
   */
  private calculateSemanticSimilarity(s1: SessionMetadataCache, s2: SessionMetadataCache): number {
    const kw1 = new Set(s1.keywords || []);
    const kw2 = new Set(s2.keywords || []);

    if (kw1.size === 0 || kw2.size === 0) return 0;

    const intersection = new Set([...kw1].filter(k => kw2.has(k)));
    const union = new Set([...kw1, ...kw2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate intent alignment score
   * Based on title/summary keyword matching
   */
  private calculateIntentAlignment(s1: SessionMetadataCache, s2: SessionMetadataCache): number {
    const text1 = ((s1.title || '') + ' ' + (s1.summary || '')).toLowerCase();
    const text2 = ((s2.title || '') + ' ' + (s2.summary || '')).toLowerCase();

    if (!text1 || !text2) return 0;

    // Simple word-based TF-IDF approximation
    const words1 = text1.split(/\s+/).filter(w => w.length > 3);
    const words2 = text2.split(/\s+/).filter(w => w.length > 3);

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter(w => set2.has(w)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Find the most relevant existing cluster for a set of session IDs
   * Returns the cluster with highest session overlap
   */
  private findExistingClusterForSessions(sessionIds: string[]): SessionCluster | null {
    if (sessionIds.length === 0) return null;

    const clusterCounts = new Map<string, number>();
    let maxCount = 0;
    let bestClusterId: string | null = null;

    for (const sessionId of sessionIds) {
      const clusters = this.coreMemoryStore.getSessionClusters(sessionId);
      for (const cluster of clusters) {
        if (cluster.status !== 'active') continue;

        const count = (clusterCounts.get(cluster.id) || 0) + 1;
        clusterCounts.set(cluster.id, count);

        if (count > maxCount) {
          maxCount = count;
          bestClusterId = cluster.id;
        }
      }
    }

    if (bestClusterId) {
      return this.coreMemoryStore.getCluster(bestClusterId);
    }
    return null;
  }

  /**
   * Determine if a new cluster should merge with an existing one
   * Based on 70% session overlap threshold
   */
  private shouldMergeWithExisting(newClusterSessions: SessionMetadataCache[], existingCluster: SessionCluster): boolean {
    const MERGE_THRESHOLD = 0.7;

    const existingMembers = this.coreMemoryStore.getClusterMembers(existingCluster.id);
    const newSessionIds = new Set(newClusterSessions.map(s => s.session_id));
    const existingSessionIds = new Set(existingMembers.map(m => m.session_id));

    if (newSessionIds.size === 0) return false;

    const intersection = new Set([...newSessionIds].filter(id => existingSessionIds.has(id)));
    const overlapRatio = intersection.size / newSessionIds.size;

    return overlapRatio > MERGE_THRESHOLD;
  }

  /**
   * Run auto-clustering algorithm
   * Optimized to prevent duplicate clusters by checking existing clusters first
   */
  async autocluster(options?: ClusteringOptions): Promise<ClusteringResult> {
    // 1. Collect sessions based on user-specified scope (default: 'recent')
    const allSessions = await this.collectSessions(options);
    console.log(`[Clustering] Collected ${allSessions.length} sessions (scope: ${options?.scope || 'recent'})`);

    // 2. Filter out already-clustered sessions to prevent duplicates
    const sessions = allSessions.filter(s => {
      const clusters = this.coreMemoryStore.getSessionClusters(s.session_id);
      return clusters.length === 0;
    });
    console.log(`[Clustering] ${sessions.length} unclustered sessions after filtering`);

    // 3. Update metadata cache
    for (const session of sessions) {
      this.coreMemoryStore.upsertSessionMetadata(session);
    }

    // 4. Calculate relevance matrix
    const n = sessions.length;
    const relevanceMatrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));

    let maxScore = 0;
    let avgScore = 0;
    let pairCount = 0;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const score = this.calculateRelevance(sessions[i], sessions[j]);
        relevanceMatrix[i][j] = score;
        relevanceMatrix[j][i] = score;

        if (score > maxScore) maxScore = score;
        avgScore += score;
        pairCount++;
      }
    }

    if (pairCount > 0) {
      avgScore = avgScore / pairCount;
      console.log(`[Clustering] Relevance stats: max=${maxScore.toFixed(3)}, avg=${avgScore.toFixed(3)}, pairs=${pairCount}, threshold=${CLUSTER_THRESHOLD}`);
    }

    // 5. Agglomerative clustering
    const minClusterSize = options?.minClusterSize || 2;

    // Early return if not enough sessions
    if (sessions.length < minClusterSize) {
      console.log('[Clustering] Not enough unclustered sessions to form new clusters');
      return { clustersCreated: 0, sessionsProcessed: allSessions.length, sessionsClustered: 0 };
    }

    const newPotentialClusters = this.agglomerativeClustering(sessions, relevanceMatrix, CLUSTER_THRESHOLD);
    console.log(`[Clustering] Generated ${newPotentialClusters.length} potential clusters`);

    // 6. Process clusters: create new or merge with existing
    let clustersCreated = 0;
    let clustersMerged = 0;
    let sessionsClustered = 0;

    for (const clusterSessions of newPotentialClusters) {
      if (clusterSessions.length < minClusterSize) {
        continue; // Skip small clusters
      }

      const sessionIds = clusterSessions.map(s => s.session_id);
      const existingCluster = this.findExistingClusterForSessions(sessionIds);

      // Check if we should merge with an existing cluster
      if (existingCluster && this.shouldMergeWithExisting(clusterSessions, existingCluster)) {
        const existingMembers = this.coreMemoryStore.getClusterMembers(existingCluster.id);
        const existingSessionIds = new Set(existingMembers.map(m => m.session_id));

        // Only add sessions not already in the cluster
        const newSessions = clusterSessions.filter(s => !existingSessionIds.has(s.session_id));

        if (newSessions.length > 0) {
          newSessions.forEach((session, index) => {
            this.coreMemoryStore.addClusterMember({
              cluster_id: existingCluster.id,
              session_id: session.session_id,
              session_type: session.session_type as 'core_memory' | 'workflow' | 'cli_history' | 'native',
              sequence_order: existingMembers.length + index + 1,
              relevance_score: 1.0
            });
          });

          // Update cluster description
          this.coreMemoryStore.updateCluster(existingCluster.id, {
            description: `Auto-generated cluster with ${existingMembers.length + newSessions.length} sessions`
          });

          clustersMerged++;
          sessionsClustered += newSessions.length;
          console.log(`[Clustering] Merged ${newSessions.length} sessions into existing cluster '${existingCluster.name}'`);
        }
      } else {
        // Create new cluster
        const clusterName = this.generateClusterName(clusterSessions);
        const clusterIntent = this.generateClusterIntent(clusterSessions);

        const clusterRecord = this.coreMemoryStore.createCluster({
          name: clusterName,
          description: `Auto-generated cluster with ${clusterSessions.length} sessions`,
          intent: clusterIntent,
          status: 'active'
        });

        // Add members
        clusterSessions.forEach((session, index) => {
          this.coreMemoryStore.addClusterMember({
            cluster_id: clusterRecord.id,
            session_id: session.session_id,
            session_type: session.session_type as 'core_memory' | 'workflow' | 'cli_history' | 'native',
            sequence_order: index + 1,
            relevance_score: 1.0
          });
        });

        clustersCreated++;
        sessionsClustered += clusterSessions.length;
      }
    }

    console.log(`[Clustering] Summary: ${clustersCreated} created, ${clustersMerged} merged, ${allSessions.length - sessions.length} already clustered`);

    return {
      clustersCreated,
      sessionsProcessed: allSessions.length,
      sessionsClustered
    };
  }

  /**
   * Agglomerative clustering algorithm
   * Returns array of clusters (each cluster is array of sessions)
   */
  private agglomerativeClustering(
    sessions: SessionMetadataCache[],
    relevanceMatrix: number[][],
    threshold: number
  ): SessionMetadataCache[][] {
    const n = sessions.length;

    // Initialize: each session is its own cluster
    const clusters: Set<number>[] = sessions.map((_, i) => new Set([i]));

    while (true) {
      let maxScore = -1;
      let mergeI = -1;
      let mergeJ = -1;

      // Find pair of clusters with highest average linkage
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const score = this.averageLinkage(clusters[i], clusters[j], relevanceMatrix);
          if (score > maxScore) {
            maxScore = score;
            mergeI = i;
            mergeJ = j;
          }
        }
      }

      // Stop if no pair exceeds threshold
      if (maxScore < threshold) break;

      // Merge clusters
      const merged = new Set([...clusters[mergeI], ...clusters[mergeJ]]);
      clusters.splice(mergeJ, 1); // Remove j first (higher index)
      clusters.splice(mergeI, 1);
      clusters.push(merged);
    }

    // Convert cluster indices to sessions
    return clusters.map(cluster =>
      Array.from(cluster).map(i => sessions[i])
    );
  }

  /**
   * Calculate average linkage between two clusters
   */
  private averageLinkage(
    cluster1: Set<number>,
    cluster2: Set<number>,
    relevanceMatrix: number[][]
  ): number {
    let sum = 0;
    let count = 0;

    for (const i of cluster1) {
      for (const j of cluster2) {
        sum += relevanceMatrix[i][j];
        count++;
      }
    }

    return count > 0 ? sum / count : 0;
  }

  /**
   * Generate cluster name from members
   */
  private generateClusterName(members: SessionMetadataCache[]): string {
    // Count keyword frequency
    const keywordFreq = new Map<string, number>();
    for (const member of members) {
      for (const keyword of member.keywords || []) {
        keywordFreq.set(keyword, (keywordFreq.get(keyword) || 0) + 1);
      }
    }

    // Get top 2 keywords
    const sorted = Array.from(keywordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([kw]) => kw);

    if (sorted.length >= 2) {
      return `${sorted[0]}-${sorted[1]}`;
    } else if (sorted.length === 1) {
      return sorted[0];
    } else {
      return 'unnamed-cluster';
    }
  }

  /**
   * Generate cluster intent from members
   */
  private generateClusterIntent(members: SessionMetadataCache[]): string {
    // Extract common action words from titles
    const actionWords = ['implement', 'refactor', 'fix', 'add', 'create', 'update', 'optimize'];
    const titles = members.map(m => (m.title || '').toLowerCase());

    for (const action of actionWords) {
      const count = titles.filter(t => t.includes(action)).length;
      if (count >= members.length / 2) {
        const topic = this.generateClusterName(members);
        return `${action.charAt(0).toUpperCase() + action.slice(1)} ${topic}`;
      }
    }

    return `Work on ${this.generateClusterName(members)}`;
  }

  /**
   * Get progressive disclosure index for hook
   * @param options - Configuration options
   * @param options.type - 'session-start' returns recent sessions, 'context' returns intent-matched sessions
   * @param options.sessionId - Current session ID (optional)
   * @param options.prompt - User prompt for intent matching (required for 'context' type)
   */
  async getProgressiveIndex(options: {
    type: 'session-start' | 'context';
    sessionId?: string;
    prompt?: string;
  }): Promise<string> {
    const { type, sessionId, prompt } = options;

    // For session-start: return recent sessions by time
    if (type === 'session-start') {
      return this.getRecentSessionsIndex();
    }

    // For context: return intent-matched sessions based on prompt
    if (type === 'context' && prompt) {
      return this.getIntentMatchedIndex(prompt, sessionId);
    }

    // Fallback to recent sessions
    return this.getRecentSessionsIndex();
  }

  /**
   * Get recent sessions index (for session-start)
   */
  private async getRecentSessionsIndex(): Promise<string> {
    const sessions = await this.collectSessions({ scope: 'recent' });

    // Sort by created_at descending (most recent first)
    const sortedSessions = sessions
      .filter(s => s.created_at)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .slice(0, 5); // Top 5 recent sessions

    if (sortedSessions.length === 0) {
      return `<ccw-session-context>
## 📋 Recent Sessions

No recent sessions found. Start a new workflow to begin tracking.

**MCP Tools**:
\`\`\`
# Search sessions
Use tool: mcp__ccw-tools__core_memory
Parameters: { "action": "search", "query": "<keyword>" }

# Create new session
Parameters: { "action": "save", "content": "<context>" }
\`\`\`
</ccw-session-context>`;
    }

    // Generate table
    let table = `| # | Session | Type | Title | Date |\n`;
    table += `|---|---------|------|-------|------|\n`;

    sortedSessions.forEach((s, idx) => {
      const type = s.session_type === 'core_memory' ? 'Core' :
                   s.session_type === 'workflow' ? 'Workflow' : 'CLI';
      const title = (s.title || '').substring(0, 40);
      const date = s.created_at ? new Date(s.created_at).toLocaleDateString() : '';
      table += `| ${idx + 1} | ${s.session_id} | ${type} | ${title} | ${date} |\n`;
    });

    return `<ccw-session-context>
## 📋 Recent Sessions (Last 30 days)

${table}

**Resume via MCP**:
\`\`\`
Use tool: mcp__ccw-tools__core_memory
Parameters: { "action": "load", "id": "${sortedSessions[0].session_id}" }
\`\`\`

---
**Tip**: Sessions are sorted by most recent. Use \`search\` action to find specific topics.
</ccw-session-context>`;
  }

  /**
   * Get intent-matched sessions index (for context with prompt)
   */
  private async getIntentMatchedIndex(prompt: string, sessionId?: string): Promise<string> {
    const sessions = await this.collectSessions({ scope: 'all' });

    if (sessions.length === 0) {
      return `<ccw-session-context>
## 📋 Related Sessions

No sessions available for intent matching.
</ccw-session-context>`;
    }

    // Create a virtual session from the prompt for similarity calculation
    const promptSession: SessionMetadataCache = {
      session_id: 'prompt-virtual',
      session_type: 'native',
      title: prompt.substring(0, 100),
      summary: prompt.substring(0, 200),
      keywords: this.extractKeywords(prompt),
      token_estimate: Math.ceil(prompt.length / 4),
      file_patterns: this.extractFilePatterns(prompt),
      created_at: new Date().toISOString(),
      last_accessed: new Date().toISOString(),
      access_count: 0
    };

    // Calculate relevance scores for all sessions
    const scoredSessions = sessions
      .filter(s => s.session_id !== sessionId) // Exclude current session
      .map(s => ({
        session: s,
        score: this.calculateRelevance(promptSession, s)
      }))
      .filter(item => item.score >= 0.3) // Minimum relevance threshold
      .sort((a, b) => b.score - a.score)
      .slice(0, 8); // Top 8 relevant sessions

    if (scoredSessions.length === 0) {
      return `<ccw-session-context>
## 📋 Related Sessions

No sessions match current intent. Consider:
- Starting fresh with a new approach
- Using \`search\` to find sessions by keyword

**MCP Tools**:
\`\`\`
Use tool: mcp__ccw-tools__core_memory
Parameters: { "action": "search", "query": "<keyword>" }
\`\`\`
</ccw-session-context>`;
    }

    // Group by relevance tier
    const highRelevance = scoredSessions.filter(s => s.score >= 0.6);
    const mediumRelevance = scoredSessions.filter(s => s.score >= 0.4 && s.score < 0.6);
    const lowRelevance = scoredSessions.filter(s => s.score < 0.4);

    // Generate output
    let output = `<ccw-session-context>
## 📋 Intent-Matched Sessions

**Detected Intent**: ${(promptSession.keywords || []).slice(0, 5).join(', ') || 'General'}

`;

    if (highRelevance.length > 0) {
      output += `### 🔥 Highly Relevant (${highRelevance.length})\n`;
      output += `| Session | Type | Match | Summary |\n`;
      output += `|---------|------|-------|--------|\n`;
      for (const item of highRelevance) {
        const type = item.session.session_type === 'core_memory' ? 'Core' :
                     item.session.session_type === 'workflow' ? 'Workflow' : 'CLI';
        const matchPct = Math.round(item.score * 100);
        const summary = (item.session.title || item.session.summary || '').substring(0, 35);
        output += `| ${item.session.session_id} | ${type} | ${matchPct}% | ${summary} |\n`;
      }
      output += `\n`;
    }

    if (mediumRelevance.length > 0) {
      output += `### 📌 Related (${mediumRelevance.length})\n`;
      output += `| Session | Type | Match | Summary |\n`;
      output += `|---------|------|-------|--------|\n`;
      for (const item of mediumRelevance) {
        const type = item.session.session_type === 'core_memory' ? 'Core' :
                     item.session.session_type === 'workflow' ? 'Workflow' : 'CLI';
        const matchPct = Math.round(item.score * 100);
        const summary = (item.session.title || item.session.summary || '').substring(0, 35);
        output += `| ${item.session.session_id} | ${type} | ${matchPct}% | ${summary} |\n`;
      }
      output += `\n`;
    }

    if (lowRelevance.length > 0) {
      output += `### 💡 May Be Useful (${lowRelevance.length})\n`;
      const sessionList = lowRelevance.map(s => s.session.session_id).join(', ');
      output += `${sessionList}\n\n`;
    }

    // Add resume command for top match
    const topMatch = scoredSessions[0];
    output += `**Resume Top Match**:
\`\`\`
Use tool: mcp__ccw-tools__core_memory
Parameters: { "action": "load", "id": "${topMatch.session.session_id}" }
\`\`\`

---
**Tip**: Sessions ranked by semantic similarity to your prompt.
</ccw-session-context>`;

    return output;
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use getProgressiveIndex({ type, sessionId, prompt }) instead
   */
  async getProgressiveIndexLegacy(sessionId?: string): Promise<string> {
    let activeCluster: SessionCluster | null = null;
    let members: SessionMetadataCache[] = [];

    if (sessionId) {
      const clusters = this.coreMemoryStore.getSessionClusters(sessionId);
      if (clusters.length > 0) {
        activeCluster = clusters[0];
        const clusterMembers = this.coreMemoryStore.getClusterMembers(activeCluster.id);
        members = clusterMembers
          .map(m => this.coreMemoryStore.getSessionMetadata(m.session_id))
          .filter((m): m is SessionMetadataCache => m !== null)
          .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
      }
    }

    if (!activeCluster || members.length === 0) {
      return `<ccw-session-context>
## 📋 Related Sessions Index

No active cluster found. Start a new workflow or continue from recent sessions.

**MCP Tools**:
\`\`\`
# Search sessions
Use tool: mcp__ccw-tools__core_memory
Parameters: { "action": "search", "query": "<keyword>" }

# Trigger clustering
Parameters: { "action": "cluster", "scope": "auto" }
\`\`\`
</ccw-session-context>`;
    }

    // Generate table
    let table = `| # | Session | Type | Summary | Tokens |\n`;
    table += `|---|---------|------|---------|--------|\n`;

    members.forEach((m, idx) => {
      const type = m.session_type === 'core_memory' ? 'Core' :
                   m.session_type === 'workflow' ? 'Workflow' : 'CLI';
      const summary = (m.summary || '').substring(0, 40);
      const token = `~${m.token_estimate || 0}`;
      table += `| ${idx + 1} | ${m.session_id} | ${type} | ${summary} | ${token} |\n`;
    });

    // Generate timeline - show multiple recent sessions
    let timeline = '';
    if (members.length > 0) {
      const timelineEntries: string[] = [];
      const displayCount = Math.min(members.length, 3); // Show last 3 sessions

      for (let i = members.length - displayCount; i < members.length; i++) {
        const member = members[i];
        const date = member.created_at ? new Date(member.created_at).toLocaleDateString() : '';
        const title = member.title?.substring(0, 30) || 'Untitled';
        const isCurrent = i === members.length - 1;
        const marker = isCurrent ? ' ← Current' : '';
        timelineEntries.push(`${date} ─●─ ${member.session_id} (${title})${marker}`);
      }

      timeline = `\`\`\`\n${timelineEntries.join('\n        │\n')}\n\`\`\``;
    }

    return `<ccw-session-context>
## 📋 Related Sessions Index

### 🔗 Active Cluster: ${activeCluster.name} (${members.length} sessions)
**Intent**: ${activeCluster.intent || 'No intent specified'}

${table}

**Resume via MCP**:
\`\`\`
Use tool: mcp__ccw-tools__core_memory
Parameters: { "action": "load", "id": "${members[members.length - 1].session_id}" }

Or load entire cluster:
{ "action": "load-cluster", "clusterId": "${activeCluster.id}" }
\`\`\`

### 📊 Timeline
${timeline}

---
**Tip**: Use \`mcp__ccw-tools__core_memory({ action: "search", query: "<keyword>" })\` to find more sessions
</ccw-session-context>`;
  }

  /**
   * Parse workflow session files
   */
  private async parseWorkflowSessions(): Promise<SessionMetadataCache[]> {
    const sessions: SessionMetadataCache[] = [];
    const workflowDir = join(this.projectPath, '.workflow', 'sessions');

    if (!existsSync(workflowDir)) {
      return sessions;
    }

    try {
      const sessionDirs = readdirSync(workflowDir).filter(d => d.startsWith('WFS-'));

      for (const sessionDir of sessionDirs) {
        const sessionFile = join(workflowDir, sessionDir, 'session.json');
        if (!existsSync(sessionFile)) continue;

        try {
          const content = readFileSync(sessionFile, 'utf8');
          const sessionData = JSON.parse(content);

          const metadata: SessionMetadataCache = {
            session_id: sessionDir,
            session_type: 'workflow',
            title: sessionData.title || sessionDir,
            summary: (sessionData.description || '').substring(0, 200),
            keywords: this.extractKeywords(JSON.stringify(sessionData)),
            token_estimate: Math.ceil(JSON.stringify(sessionData).length / 4),
            file_patterns: this.extractFilePatterns(JSON.stringify(sessionData)),
            created_at: sessionData.created_at || statSync(sessionFile).mtime.toISOString(),
            last_accessed: new Date().toISOString(),
            access_count: 0
          };

          sessions.push(metadata);
        } catch (err) {
          console.warn(`[Clustering] Failed to parse ${sessionFile}:`, err);
        }
      }
    } catch (err) {
      console.warn('[Clustering] Failed to read workflow sessions:', err);
    }

    return sessions;
  }

  /**
   * Update metadata cache for all sessions
   */
  async refreshMetadataCache(): Promise<number> {
    const sessions = await this.collectSessions({ scope: 'all' });

    for (const session of sessions) {
      this.coreMemoryStore.upsertSessionMetadata(session);
    }

    return sessions.length;
  }
}
