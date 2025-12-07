// ==========================================
// FLOWCHART RENDERING (D3.js)
// ==========================================

function renderFlowchartForTask(sessionId, task) {
  // Will render on section expand
}

function renderFlowchart(containerId, steps) {
  if (!steps || steps.length === 0) return;
  if (typeof d3 === 'undefined') {
    document.getElementById(containerId).innerHTML = '<div class="flowchart-fallback">D3.js not loaded</div>';
    return;
  }

  const container = document.getElementById(containerId);
  const width = container.clientWidth || 500;
  const nodeHeight = 50;
  const nodeWidth = Math.min(width - 40, 300);
  const padding = 15;
  const height = steps.length * (nodeHeight + padding) + padding * 2;

  // Clear existing content
  container.innerHTML = '';

  const svg = d3.select('#' + containerId)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'flowchart-svg');

  // Arrow marker
  svg.append('defs').append('marker')
    .attr('id', 'arrow-' + containerId)
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 8)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', 'hsl(var(--border))');

  // Draw arrows
  for (let i = 0; i < steps.length - 1; i++) {
    const y1 = padding + i * (nodeHeight + padding) + nodeHeight;
    const y2 = padding + (i + 1) * (nodeHeight + padding);

    svg.append('line')
      .attr('x1', width / 2)
      .attr('y1', y1)
      .attr('x2', width / 2)
      .attr('y2', y2)
      .attr('stroke', 'hsl(var(--border))')
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrow-' + containerId + ')');
  }

  // Draw nodes
  const nodes = svg.selectAll('.node')
    .data(steps)
    .enter()
    .append('g')
    .attr('class', 'flowchart-node')
    .attr('transform', (d, i) => `translate(${(width - nodeWidth) / 2}, ${padding + i * (nodeHeight + padding)})`);

  // Node rectangles
  nodes.append('rect')
    .attr('width', nodeWidth)
    .attr('height', nodeHeight)
    .attr('rx', 6)
    .attr('fill', (d, i) => i === 0 ? 'hsl(var(--primary))' : 'hsl(var(--card))')
    .attr('stroke', 'hsl(var(--border))')
    .attr('stroke-width', 1);

  // Step number circle
  nodes.append('circle')
    .attr('cx', 20)
    .attr('cy', nodeHeight / 2)
    .attr('r', 12)
    .attr('fill', (d, i) => i === 0 ? 'rgba(255,255,255,0.2)' : 'hsl(var(--muted))');

  nodes.append('text')
    .attr('x', 20)
    .attr('y', nodeHeight / 2)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('font-size', '11px')
    .attr('fill', (d, i) => i === 0 ? 'white' : 'hsl(var(--muted-foreground))')
    .text((d, i) => i + 1);

  // Node text (step name)
  nodes.append('text')
    .attr('x', 45)
    .attr('y', nodeHeight / 2)
    .attr('dominant-baseline', 'central')
    .attr('fill', (d, i) => i === 0 ? 'white' : 'hsl(var(--foreground))')
    .attr('font-size', '12px')
    .text(d => {
      const text = d.step || d.action || 'Step';
      return text.length > 35 ? text.substring(0, 32) + '...' : text;
    });
}

function renderFullFlowchart(flowControl) {
  if (!flowControl) return;

  const container = document.getElementById('flowchartContainer');
  if (!container) return;

  const preAnalysis = Array.isArray(flowControl.pre_analysis) ? flowControl.pre_analysis : [];
  const implSteps = Array.isArray(flowControl.implementation_approach) ? flowControl.implementation_approach : [];

  if (preAnalysis.length === 0 && implSteps.length === 0) {
    container.innerHTML = '<div class="empty-section">No flowchart data available</div>';
    return;
  }

  const width = container.clientWidth || 500;
  const nodeHeight = 90;
  const nodeWidth = Math.min(width - 40, 420);
  const nodeGap = 45;
  const sectionGap = 30;

  // Calculate total nodes and height
  const totalPreNodes = preAnalysis.length;
  const totalImplNodes = implSteps.length;
  const hasBothSections = totalPreNodes > 0 && totalImplNodes > 0;
  const height = (totalPreNodes + totalImplNodes) * (nodeHeight + nodeGap) +
    (hasBothSections ? sectionGap + 60 : 0) + 60;

  // Clear existing
  d3.select('#flowchartContainer').selectAll('*').remove();

  const svg = d3.select('#flowchartContainer')
    .append('svg')
    .attr('width', '100%')
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  // Add arrow markers
  const defs = svg.append('defs');

  defs.append('marker')
    .attr('id', 'arrowhead-pre')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 8)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#f59e0b');

  defs.append('marker')
    .attr('id', 'arrowhead-impl')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 8)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', 'hsl(var(--primary))');

  let currentY = 20;

  // Render Pre-Analysis section
  if (totalPreNodes > 0) {
    // Section label
    svg.append('text')
      .attr('x', 20)
      .attr('y', currentY)
      .attr('fill', '#f59e0b')
      .attr('font-weight', 'bold')
      .attr('font-size', '13px')
      .text('📋 Pre-Analysis Steps');

    currentY += 25;

    preAnalysis.forEach((step, idx) => {
      const x = (width - nodeWidth) / 2;

      // Connection line to next node
      if (idx < preAnalysis.length - 1) {
        svg.append('line')
          .attr('x1', width / 2)
          .attr('y1', currentY + nodeHeight)
          .attr('x2', width / 2)
          .attr('y2', currentY + nodeHeight + nodeGap - 10)
          .attr('stroke', '#f59e0b')
          .attr('stroke-width', 2)
          .attr('marker-end', 'url(#arrowhead-pre)');
      }

      // Node group
      const nodeG = svg.append('g')
        .attr('class', 'flowchart-node')
        .attr('transform', `translate(${x}, ${currentY})`);

      // Node rectangle (pre-analysis style - amber/orange)
      nodeG.append('rect')
        .attr('width', nodeWidth)
        .attr('height', nodeHeight)
        .attr('rx', 10)
        .attr('fill', 'hsl(var(--card))')
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,3');

      // Step badge
      nodeG.append('circle')
        .attr('cx', 25)
        .attr('cy', 25)
        .attr('r', 15)
        .attr('fill', '#f59e0b');

      nodeG.append('text')
        .attr('x', 25)
        .attr('y', 30)
        .attr('text-anchor', 'middle')
        .attr('fill', 'white')
        .attr('font-weight', 'bold')
        .attr('font-size', '11px')
        .text('P' + (idx + 1));

      // Step name
      const stepName = step.step || step.action || 'Pre-step ' + (idx + 1);
      nodeG.append('text')
        .attr('x', 50)
        .attr('y', 28)
        .attr('fill', 'hsl(var(--foreground))')
        .attr('font-weight', '600')
        .attr('font-size', '13px')
        .text(truncateText(stepName, 40));

      // Action description
      if (step.action && step.action !== stepName) {
        nodeG.append('text')
          .attr('x', 15)
          .attr('y', 52)
          .attr('fill', 'hsl(var(--muted-foreground))')
          .attr('font-size', '11px')
          .text(truncateText(step.action, 50));
      }

      // Output indicator
      if (step.output_to) {
        nodeG.append('text')
          .attr('x', 15)
          .attr('y', 75)
          .attr('fill', '#f59e0b')
          .attr('font-size', '10px')
          .text('→ ' + truncateText(step.output_to, 45));
      }

      currentY += nodeHeight + nodeGap;
    });
  }

  // Section divider if both sections exist
  if (hasBothSections) {
    currentY += 10;
    svg.append('line')
      .attr('x1', 40)
      .attr('y1', currentY)
      .attr('x2', width - 40)
      .attr('y2', currentY)
      .attr('stroke', 'hsl(var(--border))')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4');

    // Connecting arrow from pre-analysis to implementation
    svg.append('line')
      .attr('x1', width / 2)
      .attr('y1', currentY - nodeGap + 5)
      .attr('x2', width / 2)
      .attr('y2', currentY + sectionGap - 5)
      .attr('stroke', 'hsl(var(--primary))')
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead-impl)');

    currentY += sectionGap;
  }

  // Render Implementation section
  if (totalImplNodes > 0) {
    // Section label
    svg.append('text')
      .attr('x', 20)
      .attr('y', currentY)
      .attr('fill', 'hsl(var(--primary))')
      .attr('font-weight', 'bold')
      .attr('font-size', '13px')
      .text('🔧 Implementation Steps');

    currentY += 25;

    implSteps.forEach((step, idx) => {
      const x = (width - nodeWidth) / 2;

      // Connection line to next node
      if (idx < implSteps.length - 1) {
        svg.append('line')
          .attr('x1', width / 2)
          .attr('y1', currentY + nodeHeight)
          .attr('x2', width / 2)
          .attr('y2', currentY + nodeHeight + nodeGap - 10)
          .attr('stroke', 'hsl(var(--primary))')
          .attr('stroke-width', 2)
          .attr('marker-end', 'url(#arrowhead-impl)');
      }

      // Node group
      const nodeG = svg.append('g')
        .attr('class', 'flowchart-node')
        .attr('transform', `translate(${x}, ${currentY})`);

      // Node rectangle (implementation style - blue)
      nodeG.append('rect')
        .attr('width', nodeWidth)
        .attr('height', nodeHeight)
        .attr('rx', 10)
        .attr('fill', 'hsl(var(--card))')
        .attr('stroke', 'hsl(var(--primary))')
        .attr('stroke-width', 2);

      // Step badge
      nodeG.append('circle')
        .attr('cx', 25)
        .attr('cy', 25)
        .attr('r', 15)
        .attr('fill', 'hsl(var(--primary))');

      nodeG.append('text')
        .attr('x', 25)
        .attr('y', 30)
        .attr('text-anchor', 'middle')
        .attr('fill', 'white')
        .attr('font-weight', 'bold')
        .attr('font-size', '12px')
        .text(step.step || idx + 1);

      // Step title
      nodeG.append('text')
        .attr('x', 50)
        .attr('y', 28)
        .attr('fill', 'hsl(var(--foreground))')
        .attr('font-weight', '600')
        .attr('font-size', '13px')
        .text(truncateText(step.title || 'Step ' + (idx + 1), 40));

      // Description
      if (step.description) {
        nodeG.append('text')
          .attr('x', 15)
          .attr('y', 52)
          .attr('fill', 'hsl(var(--muted-foreground))')
          .attr('font-size', '11px')
          .text(truncateText(step.description, 50));
      }

      // Output/depends indicator
      if (step.depends_on?.length) {
        nodeG.append('text')
          .attr('x', 15)
          .attr('y', 75)
          .attr('fill', 'var(--warning-color)')
          .attr('font-size', '10px')
          .text('← Depends: ' + step.depends_on.join(', '));
      }

      currentY += nodeHeight + nodeGap;
    });
  }
}

// D3.js Vertical Flowchart for Implementation Approach (legacy)
function renderImplementationFlowchart(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return;

  const container = document.getElementById('flowchartContainer');
  if (!container) return;

  const width = container.clientWidth || 500;
  const nodeHeight = 100;
  const nodeWidth = Math.min(width - 40, 400);
  const nodeGap = 50;
  const height = steps.length * (nodeHeight + nodeGap) + 40;

  // Clear existing
  d3.select('#flowchartContainer').selectAll('*').remove();

  const svg = d3.select('#flowchartContainer')
    .append('svg')
    .attr('width', '100%')
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  // Add arrow marker
  svg.append('defs').append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 8)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', 'hsl(var(--primary))');

  // Draw nodes and connections
  steps.forEach((step, idx) => {
    const y = idx * (nodeHeight + nodeGap) + 20;
    const x = (width - nodeWidth) / 2;

    // Connection line to next node
    if (idx < steps.length - 1) {
      svg.append('line')
        .attr('x1', width / 2)
        .attr('y1', y + nodeHeight)
        .attr('x2', width / 2)
        .attr('y2', y + nodeHeight + nodeGap - 10)
        .attr('stroke', 'hsl(var(--primary))')
        .attr('stroke-width', 2)
        .attr('marker-end', 'url(#arrowhead)');
    }

    // Node group
    const nodeG = svg.append('g')
      .attr('class', 'flowchart-node')
      .attr('transform', `translate(${x}, ${y})`);

    // Node rectangle with gradient
    nodeG.append('rect')
      .attr('width', nodeWidth)
      .attr('height', nodeHeight)
      .attr('rx', 10)
      .attr('fill', 'hsl(var(--card))')
      .attr('stroke', 'hsl(var(--primary))')
      .attr('stroke-width', 2)
      .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');

    // Step number badge
    nodeG.append('circle')
      .attr('cx', 25)
      .attr('cy', 25)
      .attr('r', 15)
      .attr('fill', 'hsl(var(--primary))');

    nodeG.append('text')
      .attr('x', 25)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-weight', 'bold')
      .attr('font-size', '12px')
      .text(step.step || idx + 1);

    // Step title
    nodeG.append('text')
      .attr('x', 50)
      .attr('y', 30)
      .attr('fill', 'hsl(var(--foreground))')
      .attr('font-weight', '600')
      .attr('font-size', '14px')
      .text(truncateText(step.title || 'Step ' + (idx + 1), 35));

    // Step description (if available)
    if (step.description) {
      nodeG.append('text')
        .attr('x', 15)
        .attr('y', 55)
        .attr('fill', 'hsl(var(--muted-foreground))')
        .attr('font-size', '12px')
        .text(truncateText(step.description, 45));
    }

    // Output indicator
    if (step.output) {
      nodeG.append('text')
        .attr('x', 15)
        .attr('y', 80)
        .attr('fill', 'var(--success-color)')
        .attr('font-size', '11px')
        .text('→ ' + truncateText(step.output, 40));
    }
  });
}
