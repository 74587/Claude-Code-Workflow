// ========================================
// Edge Components Barrel Export
// ========================================

export { ImportsEdge } from './ImportsEdge';
export { CallsEdge } from './CallsEdge';
export { InheritsEdge } from './InheritsEdge';

import { ImportsEdge } from './ImportsEdge';
import { CallsEdge } from './CallsEdge';
import { InheritsEdge } from './InheritsEdge';

// Edge types map for React Flow registration
export const edgeTypes = {
  imports: ImportsEdge,
  calls: CallsEdge,
  extends: InheritsEdge,
  implements: InheritsEdge,
};
