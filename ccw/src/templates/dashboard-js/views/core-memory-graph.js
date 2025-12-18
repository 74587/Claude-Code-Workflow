// Knowledge Graph and Evolution visualization functions for Core Memory

async function viewKnowledgeGraph(memoryId) {
  try {
    const response = await fetch(`/api/core-memory/memories/${memoryId}/knowledge-graph?path=${encodeURIComponent(projectPath)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const graph = await response.json();

    const modal = document.getElementById('memoryDetailModal');
    document.getElementById('memoryDetailTitle').textContent = `${t('coreMemory.knowledgeGraph')} - ${memoryId}`;

    const body = document.getElementById('memoryDetailBody');
    body.innerHTML = `
      <div class="knowledge-graph">
        <div id="knowledgeGraphContainer" class="knowledge-graph-container"></div>
      </div>
    `;

    modal.style.display = 'flex';
    lucide.createIcons();

    // Render D3 graph after modal is visible
    setTimeout(() => {
      renderKnowledgeGraphD3(graph);
    }, 100);
  } catch (error) {
    console.error('Failed to fetch knowledge graph:', error);
    showNotification(t('coreMemory.graphError'), 'error');
  }
}

function renderKnowledgeGraphD3(graph) {
  // Check if D3 is available
  if (typeof d3 === 'undefined') {
    const container = document.getElementById('knowledgeGraphContainer');
    if (container) {
      container.innerHTML = `
        <div class="graph-error">
          <i data-lucide="alert-triangle"></i>
          <p>D3.js not loaded</p>
        </div>
      `;
      lucide.createIcons();
    }
    return;
  }

  if (!graph || !graph.entities || graph.entities.length === 0) {
    const container = document.getElementById('knowledgeGraphContainer');
    if (container) {
      container.innerHTML = `
        <div class="graph-empty-state">
          <i data-lucide="network"></i>
          <p>${t('coreMemory.noEntities')}</p>
        </div>
      `;
      lucide.createIcons();
    }
    return;
  }

  const container = document.getElementById('knowledgeGraphContainer');
  if (!container) return;

  const width = container.clientWidth || 800;
  const height = 400;

  // Clear existing
  container.innerHTML = '';

  // Transform data to D3 format
  const nodes = graph.entities.map(entity => ({
    id: entity.name,
    name: entity.name,
    type: entity.type || 'entity',
    displayName: entity.name.length > 25 ? entity.name.substring(0, 22) + '...' : entity.name
  }));

  const nodeIds = new Set(nodes.map(n => n.id));
  const edges = (graph.relationships || []).filter(rel =>
    nodeIds.has(rel.source) && nodeIds.has(rel.target)
  ).map(rel => ({
    source: rel.source,
    target: rel.target,
    type: rel.type || 'related'
  }));

  // Create SVG with zoom support
  graphSvg = d3.select('#knowledgeGraphContainer')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'knowledge-graph-svg')
    .attr('viewBox', [0, 0, width, height]);

  // Create a group for zoom/pan transformations
  graphGroup = graphSvg.append('g').attr('class', 'graph-content');

  // Setup zoom behavior
  graphZoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      graphGroup.attr('transform', event.transform);
    });

  graphSvg.call(graphZoom);

  // Add arrowhead marker
  graphSvg.append('defs').append('marker')
    .attr('id', 'arrowhead-core')
    .attr('viewBox', '-0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('orient', 'auto')
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('xoverflow', 'visible')
    .append('svg:path')
    .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
    .attr('fill', '#999')
    .style('stroke', 'none');

  // Create force simulation
  graphSimulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(edges).id(d => d.id).distance(100))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(20))
    .force('x', d3.forceX(width / 2).strength(0.05))
    .force('y', d3.forceY(height / 2).strength(0.05));

  // Draw edges
  const link = graphGroup.append('g')
    .attr('class', 'graph-links')
    .selectAll('line')
    .data(edges)
    .enter()
    .append('line')
    .attr('class', 'graph-edge')
    .attr('stroke', '#999')
    .attr('stroke-width', 2)
    .attr('marker-end', 'url(#arrowhead-core)');

  // Draw nodes
  const node = graphGroup.append('g')
    .attr('class', 'graph-nodes')
    .selectAll('g')
    .data(nodes)
    .enter()
    .append('g')
    .attr('class', d => 'graph-node-group ' + (d.type || 'entity'))
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended))
    .on('click', (event, d) => {
      event.stopPropagation();
      showNodeDetail(d);
    });

  // Add circles to nodes (color by type)
  node.append('circle')
    .attr('class', d => 'graph-node ' + (d.type || 'entity'))
    .attr('r', 10)
    .attr('fill', d => {
      if (d.type === 'file') return '#3b82f6'; // blue
      if (d.type === 'function') return '#10b981'; // green
      if (d.type === 'module') return '#8b5cf6'; // purple
      return '#6b7280'; // gray
    })
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .attr('data-id', d => d.id);

  // Add labels to nodes
  node.append('text')
    .attr('class', 'graph-label')
    .text(d => d.displayName)
    .attr('x', 14)
    .attr('y', 4)
    .attr('font-size', '11px')
    .attr('fill', '#333');

  // Update positions on simulation tick
  graphSimulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    node.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
  });

  // Drag functions
  function dragstarted(event, d) {
    if (!event.active) graphSimulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) graphSimulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
}

function showNodeDetail(node) {
  showNotification(`${node.name} (${node.type})`, 'info');
}

async function viewEvolutionHistory(memoryId) {
  try {
    const response = await fetch(`/api/core-memory/memories/${memoryId}/evolution?path=${encodeURIComponent(projectPath)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const versions = await response.json();

    const modal = document.getElementById('memoryDetailModal');
    document.getElementById('memoryDetailTitle').textContent = `${t('coreMemory.evolutionHistory')} - ${memoryId}`;

    const body = document.getElementById('memoryDetailBody');
    body.innerHTML = `
      <div class="evolution-timeline">
        ${versions && versions.length > 0
          ? versions.map((version, index) => renderEvolutionVersion(version, index)).join('')
          : `<div class="evolution-empty-state">
               <i data-lucide="git-branch"></i>
               <p>${t('coreMemory.noHistory')}</p>
             </div>`
        }
      </div>
    `;

    modal.style.display = 'flex';
    lucide.createIcons();
  } catch (error) {
    console.error('Failed to fetch evolution history:', error);
    showNotification(t('coreMemory.evolutionError'), 'error');
  }
}

function renderEvolutionVersion(version, index) {
  const timestamp = new Date(version.timestamp).toLocaleString();
  const contentPreview = version.content 
    ? (version.content.substring(0, 150) + (version.content.length > 150 ? '...' : ''))
    : '';
  
  // Parse diff stats
  const diffStats = version.diff_stats || {};
  const added = diffStats.added || 0;
  const modified = diffStats.modified || 0;
  const deleted = diffStats.deleted || 0;
  
  return `
    <div class="version-card">
      <div class="version-header">
        <div class="version-info">
          <span class="version-number">v${version.version}</span>
          <span class="version-date">${timestamp}</span>
          ${index === 0 ? `<span class="badge badge-current">${t('coreMemory.current')}</span>` : ''}
        </div>
      </div>
      
      ${contentPreview ? `
        <div class="version-content-preview">
          ${escapeHtml(contentPreview)}
        </div>
      ` : ''}
      
      ${(added > 0 || modified > 0 || deleted > 0) ? `
        <div class="version-diff-stats">
          ${added > 0 ? `<span class="diff-stat diff-added"><i data-lucide="plus"></i> ${added} added</span>` : ''}
          ${modified > 0 ? `<span class="diff-stat diff-modified"><i data-lucide="edit-3"></i> ${modified} modified</span>` : ''}
          ${deleted > 0 ? `<span class="diff-stat diff-deleted"><i data-lucide="minus"></i> ${deleted} deleted</span>` : ''}
        </div>
      ` : ''}
      
      ${version.reason ? `
        <div class="version-reason">
          <strong>Reason:</strong> ${escapeHtml(version.reason)}
        </div>
      ` : ''}
    </div>
  `;
}
