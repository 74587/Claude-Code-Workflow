// ========================================
// ExecutionMonitor Integration Example
// ========================================
// This file demonstrates how to use ExecutionHeader and NodeExecutionChain components
// in a typical execution monitoring scenario

import { useExecutionStore } from '@/stores/executionStore';
import { useFlowStore } from '@/stores';
import { ExecutionHeader, NodeExecutionChain } from '@/components/orchestrator';

/**
 * Example execution monitor component
 *
 * This example shows how to integrate ExecutionHeader and NodeExecutionChain
 * with the executionStore and flowStore.
 */
export function ExecutionMonitorExample() {
  // Get execution state from executionStore
  const currentExecution = useExecutionStore((state) => state.currentExecution);
  const nodeStates = useExecutionStore((state) => state.nodeStates);
  const selectedNodeId = useExecutionStore((state) => state.selectedNodeId);
  const selectNode = useExecutionStore((state) => state.selectNode);

  // Get flow nodes from flowStore
  const nodes = useFlowStore((state) => state.nodes);

  return (
    <div className="w-full">
      {/* Execution Overview Header */}
      <ExecutionHeader
        execution={currentExecution}
        nodeStates={nodeStates}
      />

      {/* Node Execution Chain */}
      <NodeExecutionChain
        nodes={nodes}
        nodeStates={nodeStates}
        selectedNodeId={selectedNodeId}
        onNodeSelect={selectNode}
      />

      {/* Rest of the monitor UI would go here */}
      {/* - Node Detail Panel */}
      {/* - Tool Calls Timeline */}
      {/* - Global Logs */}
    </div>
  );
}

/**
 * Integration Notes:
 *
 * 1. ExecutionHeader requires:
 *    - execution: ExecutionState from executionStore.currentExecution
 *    - nodeStates: Record<string, NodeExecutionState> from executionStore.nodeStates
 *
 * 2. NodeExecutionChain requires:
 *    - nodes: FlowNode[] from flowStore.nodes
 *    - nodeStates: Record<string, NodeExecutionState> from executionStore.nodeStates
 *    - selectedNodeId: string | null from executionStore.selectedNodeId
 *    - onNodeSelect: (nodeId: string) => void (use executionStore.selectNode)
 *
 * 3. Data flow:
 *    - WebSocket messages update executionStore
 *    - ExecutionHeader reacts to execution state changes
 *    - NodeExecutionChain reacts to node state changes
 *    - Clicking a node calls selectNode, updating selectedNodeId
 *    - Selected node can be used to show detail panel
 */

export default ExecutionMonitorExample;
