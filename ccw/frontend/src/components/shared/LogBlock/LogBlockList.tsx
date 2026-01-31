// ========================================
// LogBlockList Component
// ========================================
// Container component for displaying grouped CLI output blocks

import React, { useState, useMemo, useCallback } from 'react';
import { useCliStreamStore } from '@/stores/cliStreamStore';
import { LogBlock } from './LogBlock';
import type { LogBlockData, LogLine } from './types';
import type { CliOutputLine } from '@/stores/cliStreamStore';

/**
 * Parse tool call metadata from content
 * Expected format: "[Tool] toolName(args)"
 */
function parseToolCallMetadata(content: string): { toolName: string; args: string } | undefined {
  const toolCallMatch = content.match(/^\[Tool\]\s+(\w+)\((.*)\)$/);
  if (toolCallMatch) {
    return {
      toolName: toolCallMatch[1],
      args: toolCallMatch[2] || '',
    };
  }
  return undefined;
}

/**
 * Generate block title based on type and content
 */
function generateBlockTitle(lineType: string, content: string): string {
  switch (lineType) {
    case 'tool_call':
      const metadata = parseToolCallMetadata(content);
      if (metadata) {
        return metadata.args ? `${metadata.toolName}(${metadata.args})` : metadata.toolName;
      }
      return 'Tool Call';
    case 'thought':
      return 'Thought';
    case 'system':
      return 'System';
    case 'stderr':
      return 'Error Output';
    case 'stdout':
      return 'Output';
    case 'metadata':
      return 'Metadata';
    default:
      return 'Log';
  }
}

/**
 * Get block type for a line
 */
function getBlockType(lineType: string): LogBlockData['type'] {
  switch (lineType) {
    case 'tool_call':
      return 'tool';
    case 'thought':
      return 'info';
    case 'system':
      return 'info';
    case 'stderr':
      return 'error';
    case 'stdout':
    case 'metadata':
    default:
      return 'output';
  }
}

/**
 * Check if a line type should start a new block
 */
function shouldStartNewBlock(lineType: string, currentBlockType: string | null): boolean {
  // No current block exists
  if (!currentBlockType) {
    return true;
  }

  // These types always start new blocks
  if (lineType === 'tool_call' || lineType === 'thought' || lineType === 'system') {
    return true;
  }

  // stderr starts a new block if not already in stderr
  if (lineType === 'stderr' && currentBlockType !== 'stderr') {
    return true;
  }

  // tool_call block captures all following stdout/stderr until next tool_call
  if (currentBlockType === 'tool_call' && (lineType === 'stdout' || lineType === 'stderr')) {
    return false;
  }

  // stderr block captures all stderr until next different type
  if (currentBlockType === 'stderr' && lineType === 'stderr') {
    return false;
  }

  // stdout merges into current stdout block
  if (currentBlockType === 'stdout' && lineType === 'stdout') {
    return false;
  }

  // Different type - start new block
  if (currentBlockType !== lineType) {
    return true;
  }

  return false;
}

/**
 * Group CLI output lines into log blocks
 *
 * Block grouping rules:
 * 1. tool_call starts new block, includes following stdout/stderr until next tool_call
 * 2. thought becomes independent block
 * 3. system becomes independent block
 * 4. stderr becomes highlighted block
 * 5. Other stdout merges into normal blocks
 */
function groupLinesIntoBlocks(
  lines: CliOutputLine[],
  executionId: string,
  executionStatus: 'running' | 'completed' | 'error'
): LogBlockData[] {
  const blocks: LogBlockData[] = [];
  let currentLines: LogLine[] = [];
  let currentType: string | null = null;
  let currentTitle = '';
  let currentToolName: string | undefined;
  let blockStartTime = 0;
  let blockIndex = 0;

  for (const line of lines) {
    const blockType = getBlockType(line.type);

    // Check if we need to start a new block
    if (shouldStartNewBlock(line.type, currentType)) {
      // Save current block if exists
      if (currentLines.length > 0) {
        const duration = blockStartTime > 0 ? line.timestamp - blockStartTime : undefined;
        blocks.push({
          id: `${executionId}-block-${blockIndex}`,
          title: currentTitle || generateBlockTitle(currentType || '', currentLines[0]?.content || ''),
          type: getBlockType(currentType || ''),
          status: executionStatus === 'running' ? 'running' : 'completed',
          toolName: currentToolName,
          lineCount: currentLines.length,
          duration,
          lines: currentLines,
          timestamp: blockStartTime,
        });
        blockIndex++;
      }

      // Start new block
      currentType = line.type;
      currentTitle = generateBlockTitle(line.type, line.content);
      currentLines = [
        {
          type: line.type,
          content: line.content,
          timestamp: line.timestamp,
        },
      ];
      blockStartTime = line.timestamp;

      // Extract tool name for tool_call blocks
      if (line.type === 'tool_call') {
        const metadata = parseToolCallMetadata(line.content);
        currentToolName = metadata?.toolName;
      } else {
        currentToolName = undefined;
      }
    } else {
      // Add line to current block
      currentLines.push({
        type: line.type,
        content: line.content,
        timestamp: line.timestamp,
      });
    }
  }

  // Finalize the last block
  if (currentLines.length > 0) {
    const lastLine = currentLines[currentLines.length - 1];
    const duration = blockStartTime > 0 ? lastLine.timestamp - blockStartTime : undefined;
    blocks.push({
      id: `${executionId}-block-${blockIndex}`,
      title: currentTitle || generateBlockTitle(currentType || '', currentLines[0]?.content || ''),
      type: getBlockType(currentType || ''),
      status: executionStatus === 'running' ? 'running' : 'completed',
      toolName: currentToolName,
      lineCount: currentLines.length,
      duration,
      lines: currentLines,
      timestamp: blockStartTime,
    });
  }

  return blocks;
}

/**
 * Props for LogBlockList component
 */
export interface LogBlockListProps {
  /** Execution ID to display logs for */
  executionId: string | null;
  /** Optional CSS class name */
  className?: string;
}

/**
 * LogBlockList component
 * Displays CLI output grouped into collapsible blocks
 */
export function LogBlockList({ executionId, className }: LogBlockListProps) {
  // Get execution data from store
  const executions = useCliStreamStore((state) => state.executions);

  // Get current execution or execution by ID
  const currentExecution = useMemo(() => {
    if (!executionId) return null;
    return executions[executionId] || null;
  }, [executions, executionId]);

  // Manage expanded blocks state
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());

  // Group output lines into blocks
  const blocks = useMemo(() => {
    if (!currentExecution?.output || currentExecution.output.length === 0) {
      return [];
    }

    return groupLinesIntoBlocks(currentExecution.output, executionId!, currentExecution.status);
  }, [currentExecution, executionId]);

  // Toggle block expand/collapse
  const toggleBlockExpand = useCallback((blockId: string) => {
    setExpandedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  }, []);

  // Copy command to clipboard
  const copyCommand = useCallback((block: LogBlockData) => {
    const command = block.lines.find((l) => l.type === 'tool_call')?.content || '';
    navigator.clipboard.writeText(command).catch((err) => {
      console.error('Failed to copy command:', err);
    });
  }, []);

  // Copy output to clipboard
  const copyOutput = useCallback((block: LogBlockData) => {
    const output = block.lines.map((l) => l.content).join('\n');
    navigator.clipboard.writeText(output).catch((err) => {
      console.error('Failed to copy output:', err);
    });
  }, []);

  // Re-run block (placeholder for future implementation)
  const reRun = useCallback((block: LogBlockData) => {
    console.log('Re-run block:', block.id);
    // TODO: Implement re-run functionality
  }, []);

  // Empty states
  if (!executionId) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-full text-muted-foreground">
          No execution selected
        </div>
      </div>
    );
  }

  if (!currentExecution) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Execution not found
        </div>
      </div>
    );
  }

  if (blocks.length === 0) {
    const isRunning = currentExecution.status === 'running';
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-full text-muted-foreground">
          {isRunning ? 'Waiting for output...' : 'No output available'}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-2 p-3">
        {blocks.map((block) => (
          <LogBlock
            key={block.id}
            block={block}
            isExpanded={expandedBlocks.has(block.id)}
            onToggleExpand={() => toggleBlockExpand(block.id)}
            onCopyCommand={() => copyCommand(block)}
            onCopyOutput={() => copyOutput(block)}
            onReRun={() => reRun(block)}
          />
        ))}
      </div>
    </div>
  );
}

export default LogBlockList;
