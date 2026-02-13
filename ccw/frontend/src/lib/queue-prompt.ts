// ========================================
// Queue Prompt Builder
// ========================================
// Unified prompt/instruction builder for queue item execution.
// Merges buildQueueItemPrompt (QueueExecuteInSession) and
// buildQueueItemInstruction (QueueSendToOrchestrator) into a single function.

import type { QueueItem } from '@/lib/api';

/**
 * Build a context string for executing a queue item.
 *
 * This produces the same output that both `buildQueueItemPrompt` and
 * `buildQueueItemInstruction` used to produce. The only difference between
 * the two originals was that the "in-session" variant included the matched
 * task block from `solution.tasks[]`; this unified version always includes
 * it when available, which is strictly a superset.
 */
export function buildQueueItemContext(
  item: QueueItem,
  issue: any | undefined
): string {
  const lines: string[] = [];

  // Header
  lines.push(`Queue Item: ${item.item_id}`);
  lines.push(`Issue: ${item.issue_id}`);
  lines.push(`Solution: ${item.solution_id}`);
  if (item.task_id) lines.push(`Task: ${item.task_id}`);
  lines.push('');

  if (issue) {
    if (issue.title) lines.push(`Title: ${issue.title}`);
    if (issue.context) {
      lines.push('');
      lines.push('Context:');
      lines.push(String(issue.context));
    }

    const solution = Array.isArray(issue.solutions)
      ? issue.solutions.find((s: any) => s?.id === item.solution_id)
      : undefined;

    if (solution) {
      lines.push('');
      lines.push('Solution Description:');
      if (solution.description) lines.push(String(solution.description));
      if (solution.approach) {
        lines.push('');
        lines.push('Approach:');
        lines.push(String(solution.approach));
      }

      // Include matched task from solution.tasks when available
      const tasks = Array.isArray(solution.tasks) ? solution.tasks : [];
      const task = item.task_id
        ? tasks.find((t: any) => t?.id === item.task_id)
        : undefined;
      if (task) {
        lines.push('');
        lines.push('Task:');
        if (task.title) lines.push(`- ${task.title}`);
        if (task.description) lines.push(String(task.description));
      }
    }
  }

  // Footer instruction
  lines.push('');
  lines.push('Instruction:');
  lines.push(
    'Implement the above queue item in this repository. Prefer small, testable changes; run relevant tests; report blockers if any.'
  );

  return lines.join('\n');
}
