// Memory Module View
// Three-column layout: Context Hotspots | Memory Graph | Recent Context

// ========== Memory State ==========
var memoryStats = null;
var memoryGraphData = null;
var recentContext = [];
var memoryTimeFilter = 'all'; // 'today', 'week', 'all'
var selectedNode = null;

// ========== Main Render Function ==========
async function renderMemoryView() {
  var container = document.getElementById('mainContent');
  if (!container) return;

  // Hide stats grid and search for memory view
  var statsGrid = document.getElementById('statsGrid');
  var searchInput = document.getElementById('searchInput');
  if (statsGrid) statsGrid.style.display = 'none';
  if (searchInput) searchInput.parentElement.style.display = 'none';

  // Show loading state
  container.innerHTML = '<div class="memory-view loading">' +
    '<div class="loading-spinner"><i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i></div>' +
    '<p>' + t('common.loading') + '</p>' +
    '</div>';

  // Load data
  await Promise.all([
    loadMemoryStats(),
    loadMemoryGraph(),
    loadRecentContext()
  ]);

  // Render three-column layout
  container.innerHTML = '<div class="memory-view">' +
    '<div class="memory-columns">' +
    '<div class="memory-column left" id="memory-hotspots"></div>' +
    '<div class="memory-column center" id="memory-graph"></div>' +
    '<div class="memory-column right" id="memory-context"></div>' +
    '</div>' +
    '</div>';

  // Render each column
  renderHotspotsColumn();
  renderGraphColumn();
  renderContextColumn();

  // Initialize Lucide icons
  if (window.lucide) lucide.createIcons();
}

// ========== Data Loading ==========
async function loadMemoryStats() {
  try {
    var response = await fetch('/api/memory/stats?filter=' + memoryTimeFilter);
    if (!response.ok) throw new Error('Failed to load memory stats');
    var data = await response.json();
    memoryStats = data.stats || { mostRead: [], mostEdited: [] };
    return memoryStats;
  } catch (err) {
    console.error('Failed to load memory stats:', err);
    memoryStats = { mostRead: [], mostEdited: [] };
    return memoryStats;
  }
}

async function loadMemoryGraph() {
  try {
    var response = await fetch('/api/memory/graph');
    if (!response.ok) throw new Error('Failed to load memory graph');
    var data = await response.json();
    memoryGraphData = data.graph || { nodes: [], edges: [] };
    return memoryGraphData;
  } catch (err) {
    console.error('Failed to load memory graph:', err);
    memoryGraphData = { nodes: [], edges: [] };
    return memoryGraphData;
  }
}

async function loadRecentContext() {
  try {
    var response = await fetch('/api/memory/recent');
    if (!response.ok) throw new Error('Failed to load recent context');
    var data = await response.json();
    recentContext = data.recent || [];
    return recentContext;
  } catch (err) {
    console.error('Failed to load recent context:', err);
    recentContext = [];
    return [];
  }
}

// ========== Left Column: Context Hotspots ==========
function renderHotspotsColumn() {
  var container = document.getElementById('memory-hotspots');
  if (!container) return;

  var mostRead = memoryStats.mostRead || [];
  var mostEdited = memoryStats.mostEdited || [];

  container.innerHTML = '<div class="memory-section">' +
    '<div class="section-header">' +
    '<div class="section-header-left">' +
    '<h3><i data-lucide="flame" class="w-4 h-4"></i> ' + t('memory.contextHotspots') + '</h3>' +
    '</div>' +
    '<div class="section-header-actions">' +
    '<button class="btn-icon" onclick="refreshMemoryData()" title="' + t('common.refresh') + '">' +
    '<i data-lucide="refresh-cw" class="w-4 h-4"></i>' +
    '</button>' +
    '</div>' +
    '</div>' +
    '<div class="memory-filters">' +
    '<button class="filter-btn ' + (memoryTimeFilter === 'today' ? 'active' : '') + '" onclick="setMemoryTimeFilter(\'today\')">' + t('memory.today') + '</button>' +
    '<button class="filter-btn ' + (memoryTimeFilter === 'week' ? 'active' : '') + '" onclick="setMemoryTimeFilter(\'week\')">' + t('memory.week') + '</button>' +
    '<button class="filter-btn ' + (memoryTimeFilter === 'all' ? 'active' : '') + '" onclick="setMemoryTimeFilter(\'all\')">' + t('memory.allTime') + '</button>' +
    '</div>' +
    '<div class="hotspot-lists">' +
    '<div class="hotspot-list-container">' +
    '<h4 class="hotspot-list-title"><i data-lucide="eye" class="w-3.5 h-3.5"></i> ' + t('memory.mostRead') + '</h4>' +
    renderHotspotList(mostRead, 'read') +
    '</div>' +
    '<div class="hotspot-list-container">' +
    '<h4 class="hotspot-list-title"><i data-lucide="pencil" class="w-3.5 h-3.5"></i> ' + t('memory.mostEdited') + '</h4>' +
    renderHotspotList(mostEdited, 'edit') +
    '</div>' +
    '</div>' +
    '</div>';

  if (window.lucide) lucide.createIcons();
}

function renderHotspotList(items, type) {
  if (!items || items.length === 0) {
    return '<div class="hotspot-empty">' +
      '<i data-lucide="inbox" class="w-6 h-6"></i>' +
      '<p>' + t('memory.noData') + '</p>' +
      '</div>';
  }

  return '<div class="hotspot-list">' +
    items.map(function(item, index) {
      var heat = item.heat || item.count || 0;
      var heatClass = heat > 50 ? 'high' : heat > 20 ? 'medium' : 'low';
      var path = item.path || item.file || 'Unknown';
      var fileName = path.split('/').pop().split('\\').pop();

      return '<div class="hotspot-item" onclick="highlightNode(\'' + escapeHtml(path) + '\')">' +
        '<div class="hotspot-rank">' + (index + 1) + '</div>' +
        '<div class="hotspot-info">' +
        '<div class="hotspot-name" title="' + escapeHtml(path) + '">' + escapeHtml(fileName) + '</div>' +
        '<div class="hotspot-path">' + escapeHtml(path.substring(0, path.lastIndexOf(fileName))) + '</div>' +
        '</div>' +
        '<div class="hotspot-heat ' + heatClass + '">' +
        '<span class="heat-badge">' + heat + '</span>' +
        '<i data-lucide="' + (type === 'read' ? 'eye' : 'pencil') + '" class="w-3 h-3"></i>' +
        '</div>' +
        '</div>';
    }).join('') +
    '</div>';
}

// ========== Center Column: Memory Graph ==========
function renderGraphColumn() {
  var container = document.getElementById('memory-graph');
  if (!container) return;

  container.innerHTML = '<div class="memory-section">' +
    '<div class="section-header">' +
    '<div class="section-header-left">' +
    '<h3><i data-lucide="network" class="w-4 h-4"></i> ' + t('memory.memoryGraph') + '</h3>' +
    '<span class="section-count">' + (memoryGraphData.nodes || []).length + ' ' + t('memory.nodes') + '</span>' +
    '</div>' +
    '<div class="section-header-actions">' +
    '<button class="btn-icon" onclick="resetGraphView()" title="' + t('memory.resetView') + '">' +
    '<i data-lucide="maximize-2" class="w-4 h-4"></i>' +
    '</button>' +
    '</div>' +
    '</div>' +
    '<div class="memory-graph-container" id="memoryGraphSvg"></div>' +
    '<div class="memory-graph-legend">' +
    '<div class="legend-item"><span class="legend-dot file"></span> ' + t('memory.file') + '</div>' +
    '<div class="legend-item"><span class="legend-dot module"></span> ' + t('memory.module') + '</div>' +
    '<div class="legend-item"><span class="legend-dot component"></span> ' + t('memory.component') + '</div>' +
    '</div>' +
    '</div>';

  // Render D3 graph
  renderMemoryGraph(memoryGraphData);

  if (window.lucide) lucide.createIcons();
}

function renderMemoryGraph(graphData) {
  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
    var container = document.getElementById('memoryGraphSvg');
    if (container) {
      container.innerHTML = '<div class="graph-empty-state">' +
        '<i data-lucide="network" class="w-12 h-12"></i>' +
        '<p>' + t('memory.noGraphData') + '</p>' +
        '</div>';
      if (window.lucide) lucide.createIcons();
    }
    return;
  }

  // Check if D3 is available
  if (typeof d3 === 'undefined') {
    var container = document.getElementById('memoryGraphSvg');
    if (container) {
      container.innerHTML = '<div class="graph-error">' +
        '<i data-lucide="alert-triangle" class="w-8 h-8"></i>' +
        '<p>' + t('memory.d3NotLoaded') + '</p>' +
        '</div>';
      if (window.lucide) lucide.createIcons();
    }
    return;
  }

  var container = document.getElementById('memoryGraphSvg');
  if (!container) return;

  var width = container.clientWidth || 600;
  var height = container.clientHeight || 500;

  // Clear existing
  container.innerHTML = '';

  var svg = d3.select('#memoryGraphSvg')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'memory-graph-svg');

  // Create force simulation
  var simulation = d3.forceSimulation(graphData.nodes)
    .force('link', d3.forceLink(graphData.edges).id(function(d) { return d.id; }).distance(100))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(function(d) { return (d.heat || 10) + 5; }));

  // Draw edges
  var link = svg.append('g')
    .selectAll('line')
    .data(graphData.edges)
    .enter()
    .append('line')
    .attr('class', 'graph-edge')
    .attr('stroke-width', function(d) { return Math.sqrt(d.weight || 1); });

  // Draw nodes
  var node = svg.append('g')
    .selectAll('circle')
    .data(graphData.nodes)
    .enter()
    .append('circle')
    .attr('class', function(d) { return 'graph-node ' + (d.type || 'file'); })
    .attr('r', function(d) { return (d.heat || 10); })
    .attr('data-id', function(d) { return d.id; })
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended))
    .on('click', function(event, d) {
      selectNode(d);
    });

  // Node labels
  var label = svg.append('g')
    .selectAll('text')
    .data(graphData.nodes)
    .enter()
    .append('text')
    .attr('class', 'graph-label')
    .text(function(d) { return d.name || d.id; })
    .attr('x', 8)
    .attr('y', 3);

  // Update positions on simulation tick
  simulation.on('tick', function() {
    link
      .attr('x1', function(d) { return d.source.x; })
      .attr('y1', function(d) { return d.source.y; })
      .attr('x2', function(d) { return d.target.x; })
      .attr('y2', function(d) { return d.target.y; });

    node
      .attr('cx', function(d) { return d.x; })
      .attr('cy', function(d) { return d.y; });

    label
      .attr('x', function(d) { return d.x + 8; })
      .attr('y', function(d) { return d.y + 3; });
  });

  // Drag functions
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
}

function selectNode(node) {
  selectedNode = node;

  // Highlight in graph
  d3.selectAll('.graph-node').classed('selected', false);
  d3.selectAll('.graph-node[data-id="' + node.id + '"]').classed('selected', true);

  // Show node details in context column
  showNodeDetails(node);
}

function highlightNode(path) {
  var node = memoryGraphData.nodes.find(function(n) { return n.path === path || n.id === path; });
  if (node) {
    selectNode(node);
    // Center graph on node if possible
    if (typeof d3 !== 'undefined') {
      var container = document.getElementById('memoryGraphSvg');
      if (container) {
        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }
}

function resetGraphView() {
  selectedNode = null;
  d3.selectAll('.graph-node').classed('selected', false);
  renderContextColumn();
}

// ========== Right Column: Recent Context ==========
function renderContextColumn() {
  var container = document.getElementById('memory-context');
  if (!container) return;

  if (selectedNode) {
    showNodeDetails(selectedNode);
    return;
  }

  container.innerHTML = '<div class="memory-section">' +
    '<div class="section-header">' +
    '<div class="section-header-left">' +
    '<h3><i data-lucide="clock" class="w-4 h-4"></i> ' + t('memory.recentContext') + '</h3>' +
    '<span class="section-count">' + recentContext.length + ' ' + t('memory.activities') + '</span>' +
    '</div>' +
    '</div>' +
    '<div class="context-search">' +
    '<input type="text" id="contextSearchInput" class="context-search-input" placeholder="' + t('memory.searchContext') + '" onkeyup="filterRecentContext(this.value)">' +
    '<i data-lucide="search" class="w-4 h-4 search-icon"></i>' +
    '</div>' +
    renderContextTimeline(recentContext) +
    renderContextStats() +
    '</div>';

  if (window.lucide) lucide.createIcons();
}

function renderContextTimeline(prompts) {
  if (!prompts || prompts.length === 0) {
    return '<div class="context-empty">' +
      '<i data-lucide="inbox" class="w-8 h-8"></i>' +
      '<p>' + t('memory.noRecentActivity') + '</p>' +
      '</div>';
  }

  return '<div class="context-timeline">' +
    prompts.map(function(item) {
      var timestamp = item.timestamp ? formatTimestamp(item.timestamp) : 'Unknown time';
      var type = item.type || 'unknown';
      var typeIcon = type === 'read' ? 'eye' : type === 'edit' ? 'pencil' : 'file-text';
      var files = item.files || [];

      return '<div class="timeline-item">' +
        '<div class="timeline-icon ' + type + '">' +
        '<i data-lucide="' + typeIcon + '" class="w-3.5 h-3.5"></i>' +
        '</div>' +
        '<div class="timeline-content">' +
        '<div class="timeline-header">' +
        '<span class="timeline-type">' + escapeHtml(type.charAt(0).toUpperCase() + type.slice(1)) + '</span>' +
        '<span class="timeline-time">' + timestamp + '</span>' +
        '</div>' +
        '<div class="timeline-prompt">' + escapeHtml(item.prompt || item.description || 'No description') + '</div>' +
        (files.length > 0 ? '<div class="timeline-files">' +
          files.slice(0, 3).map(function(f) {
            return '<span class="file-tag" onclick="highlightNode(\'' + escapeHtml(f) + '\')">' +
              '<i data-lucide="file" class="w-3 h-3"></i> ' + escapeHtml(f.split('/').pop().split('\\').pop()) +
              '</span>';
          }).join('') +
          (files.length > 3 ? '<span class="file-tag more">+' + (files.length - 3) + ' more</span>' : '') +
          '</div>' : '') +
        '</div>' +
        '</div>';
    }).join('') +
    '</div>';
}

function renderContextStats() {
  var totalReads = recentContext.filter(function(c) { return c.type === 'read'; }).length;
  var totalEdits = recentContext.filter(function(c) { return c.type === 'edit'; }).length;
  var totalPrompts = recentContext.filter(function(c) { return c.type === 'prompt'; }).length;

  return '<div class="context-stats">' +
    '<div class="context-stat-item">' +
    '<i data-lucide="eye" class="w-4 h-4"></i>' +
    '<span class="stat-label">' + t('memory.reads') + '</span>' +
    '<span class="stat-value">' + totalReads + '</span>' +
    '</div>' +
    '<div class="context-stat-item">' +
    '<i data-lucide="pencil" class="w-4 h-4"></i>' +
    '<span class="stat-label">' + t('memory.edits') + '</span>' +
    '<span class="stat-value">' + totalEdits + '</span>' +
    '</div>' +
    '<div class="context-stat-item">' +
    '<i data-lucide="message-square" class="w-4 h-4"></i>' +
    '<span class="stat-label">' + t('memory.prompts') + '</span>' +
    '<span class="stat-value">' + totalPrompts + '</span>' +
    '</div>' +
    '</div>';
}

function showNodeDetails(node) {
  var container = document.getElementById('memory-context');
  if (!container) return;

  var associations = memoryGraphData.edges
    .filter(function(e) { return e.source.id === node.id || e.target.id === node.id; })
    .map(function(e) {
      var other = e.source.id === node.id ? e.target : e.source;
      return { node: other, weight: e.weight || 1 };
    })
    .sort(function(a, b) { return b.weight - a.weight; });

  container.innerHTML = '<div class="memory-section">' +
    '<div class="section-header">' +
    '<div class="section-header-left">' +
    '<h3><i data-lucide="info" class="w-4 h-4"></i> ' + t('memory.nodeDetails') + '</h3>' +
    '</div>' +
    '<div class="section-header-actions">' +
    '<button class="btn-icon" onclick="resetGraphView()" title="' + t('common.close') + '">' +
    '<i data-lucide="x" class="w-4 h-4"></i>' +
    '</button>' +
    '</div>' +
    '</div>' +
    '<div class="node-details">' +
    '<div class="node-detail-header">' +
    '<div class="node-detail-icon ' + (node.type || 'file') + '">' +
    '<i data-lucide="' + (node.type === 'module' ? 'package' : node.type === 'component' ? 'box' : 'file') + '" class="w-5 h-5"></i>' +
    '</div>' +
    '<div class="node-detail-info">' +
    '<div class="node-detail-name">' + escapeHtml(node.name || node.id) + '</div>' +
    '<div class="node-detail-path">' + escapeHtml(node.path || node.id) + '</div>' +
    '</div>' +
    '</div>' +
    '<div class="node-detail-stats">' +
    '<div class="detail-stat">' +
    '<span class="detail-stat-label">' + t('memory.heat') + '</span>' +
    '<span class="detail-stat-value">' + (node.heat || 0) + '</span>' +
    '</div>' +
    '<div class="detail-stat">' +
    '<span class="detail-stat-label">' + t('memory.associations') + '</span>' +
    '<span class="detail-stat-value">' + associations.length + '</span>' +
    '</div>' +
    '<div class="detail-stat">' +
    '<span class="detail-stat-label">' + t('memory.type') + '</span>' +
    '<span class="detail-stat-value">' + (node.type || 'file') + '</span>' +
    '</div>' +
    '</div>' +
    (associations.length > 0 ? '<div class="node-associations">' +
      '<h4 class="associations-title">' + t('memory.relatedNodes') + '</h4>' +
      '<div class="associations-list">' +
      associations.slice(0, 10).map(function(a) {
        return '<div class="association-item" onclick="selectNode(' + JSON.stringify(a.node).replace(/"/g, '&quot;') + ')">' +
          '<div class="association-node">' +
          '<i data-lucide="' + (a.node.type === 'module' ? 'package' : a.node.type === 'component' ? 'box' : 'file') + '" class="w-3.5 h-3.5"></i>' +
          '<span>' + escapeHtml(a.node.name || a.node.id) + '</span>' +
          '</div>' +
          '<div class="association-weight">' + a.weight + '</div>' +
          '</div>';
      }).join('') +
      (associations.length > 10 ? '<div class="associations-more">+' + (associations.length - 10) + ' more</div>' : '') +
      '</div>' +
      '</div>' : '<div class="node-no-associations">' + t('memory.noAssociations') + '</div>') +
    '</div>' +
    '</div>';

  if (window.lucide) lucide.createIcons();
}

// ========== Actions ==========
async function setMemoryTimeFilter(filter) {
  memoryTimeFilter = filter;
  await loadMemoryStats();
  renderHotspotsColumn();
}

async function refreshMemoryData() {
  await Promise.all([
    loadMemoryStats(),
    loadMemoryGraph(),
    loadRecentContext()
  ]);
  renderHotspotsColumn();
  renderGraphColumn();
  renderContextColumn();
}

function filterRecentContext(query) {
  var filtered = recentContext;
  if (query && query.trim()) {
    var q = query.toLowerCase();
    filtered = recentContext.filter(function(item) {
      var promptMatch = (item.prompt || '').toLowerCase().includes(q);
      var filesMatch = (item.files || []).some(function(f) { return f.toLowerCase().includes(q); });
      return promptMatch || filesMatch;
    });
  }

  var container = document.getElementById('memory-context');
  if (!container) return;

  var timeline = container.querySelector('.context-timeline');
  if (timeline) {
    timeline.outerHTML = renderContextTimeline(filtered);
    if (window.lucide) lucide.createIcons();
  }
}

// ========== WebSocket Event Handlers ==========
function handleMemoryUpdated(payload) {
  // Refresh graph and stats without full re-render
  if (payload.type === 'stats') {
    loadMemoryStats().then(function() { renderHotspotsColumn(); });
  } else if (payload.type === 'graph') {
    loadMemoryGraph().then(function() { renderGraphColumn(); });
  } else if (payload.type === 'context') {
    loadRecentContext().then(function() { renderContextColumn(); });
  } else {
    // Full refresh
    refreshMemoryData();
  }

  // Highlight updated node if provided
  if (payload.nodeId) {
    highlightNode(payload.nodeId);
  }
}

// ========== Utilities ==========
function formatTimestamp(timestamp) {
  var date = new Date(timestamp);
  var now = new Date();
  var diff = now - date;

  // Less than 1 minute
  if (diff < 60000) {
    return t('memory.justNow');
  }
  // Less than 1 hour
  if (diff < 3600000) {
    var minutes = Math.floor(diff / 60000);
    return minutes + ' ' + t('memory.minutesAgo');
  }
  // Less than 1 day
  if (diff < 86400000) {
    var hours = Math.floor(diff / 3600000);
    return hours + ' ' + t('memory.hoursAgo');
  }
  // Otherwise show date
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}
