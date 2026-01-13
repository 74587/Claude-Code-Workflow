// Memory Module View
// Three-column layout: Context Hotspots | Memory Graph | Recent Context

// ========== Memory State ==========
var memoryStats = null;
var memoryGraphData = null;
var recentContext = [];
var memoryTimeFilter = 'all'; // 'today', 'week', 'all'
var selectedNode = null;
var activeMemoryEnabled = false;
var activeMemoryStatus = null;
var activeMemoryConfig = {
  interval: 'manual', // manual, 5, 15, 30, 60 (minutes)
  tool: 'gemini'      // gemini, qwen
};
var activeMemorySyncTimer = null; // Timer for automatic periodic sync
var insightsHistory = []; // Insights analysis history
var selectedInsight = null; // Currently selected insight for detail view

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
    loadRecentContext(),
    loadActiveMemoryStatus(),
    loadInsightsHistory()
  ]);

  // Render layout with Active Memory header
  container.innerHTML = '<div class="memory-view">' +
    '<div class="memory-header">' +
    '<div class="memory-header-left">' +
    '<h2><i data-lucide="brain" class="w-5 h-5"></i> ' + t('memory.title') + '</h2>' +
    '</div>' +
    '<div class="memory-header-right">' +
    renderActiveMemoryControls() +
    '</div>' +
    '</div>' +
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

function renderActiveMemoryControls() {
  var html = '<div class="active-memory-controls">' +
    '<div class="active-memory-toggle">' +
    '<span class="toggle-label">' + t('memory.activeMemory') + '</span>' +
    '<label class="toggle-switch">' +
    '<input type="checkbox" id="activeMemorySwitch" ' + (activeMemoryEnabled ? 'checked' : '') + ' onchange="toggleActiveMemory(this.checked)">' +
    '<span class="toggle-slider"></span>' +
    '</label>' +
    (activeMemoryEnabled ? '<span class="toggle-status active"><i data-lucide="zap" class="w-3 h-3"></i> ' + t('memory.active') + '</span>' : '<span class="toggle-status">' + t('memory.inactive') + '</span>') +
    '</div>';

  if (activeMemoryEnabled) {
    var isAutoSync = activeMemoryConfig.interval !== 'manual';
    html += '<div class="active-memory-config">' +
      // Interval selector
      '<div class="config-item">' +
      '<label>' + t('memory.interval') + '</label>' +
      '<select id="activeMemoryInterval" onchange="updateActiveMemoryConfig(\'interval\', this.value)">' +
      '<option value="manual"' + (activeMemoryConfig.interval === 'manual' ? ' selected' : '') + '>' + t('memory.intervalManual') + '</option>' +
      '<option value="5"' + (activeMemoryConfig.interval === '5' ? ' selected' : '') + '>5 ' + t('memory.minutes') + '</option>' +
      '<option value="15"' + (activeMemoryConfig.interval === '15' ? ' selected' : '') + '>15 ' + t('memory.minutes') + '</option>' +
      '<option value="30"' + (activeMemoryConfig.interval === '30' ? ' selected' : '') + '>30 ' + t('memory.minutes') + '</option>' +
      '<option value="60"' + (activeMemoryConfig.interval === '60' ? ' selected' : '') + '>60 ' + t('memory.minutes') + '</option>' +
      '</select>' +
      '</div>' +
      // CLI tool selector
      '<div class="config-item">' +
      '<label>' + t('memory.cliTool') + '</label>' +
      '<select id="activeMemoryCli" onchange="updateActiveMemoryConfig(\'tool\', this.value)">' +
      '<option value="gemini"' + (activeMemoryConfig.tool === 'gemini' ? ' selected' : '') + '>Gemini</option>' +
      '<option value="qwen"' + (activeMemoryConfig.tool === 'qwen' ? ' selected' : '') + '>Qwen</option>' +
      '</select>' +
      '</div>' +
      // Auto-sync indicator
      (isAutoSync ? '<div class="auto-sync-indicator"><i data-lucide="timer" class="w-3 h-3"></i> ' + t('memory.autoSyncActive') + '</div>' : '') +
      '</div>' +
      // Sync button and status
      '<div class="active-memory-actions">' +
      '<button class="btn-icon btn-sync" onclick="syncActiveMemory()" title="' + t('memory.syncNow') + '">' +
      '<i data-lucide="refresh-cw" class="w-4 h-4"></i>' +
      '</button>' +
      (activeMemoryStatus && activeMemoryStatus.lastSync ?
        '<span class="last-sync">' + t('memory.lastSync') + ': ' + formatTimestamp(activeMemoryStatus.lastSync) + '</span>' : '') +
      '</div>';
  }

  html += '</div>';
  return html;
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

async function loadInsightsHistory() {
  try {
    var response = await fetch('/api/memory/insights?limit=10');
    if (!response.ok) throw new Error('Failed to load insights history');
    var data = await response.json();
    insightsHistory = data.insights || [];
    return insightsHistory;
  } catch (err) {
    console.error('Failed to load insights history:', err);
    insightsHistory = [];
    return [];
  }
}

// ========== Active Memory Functions ==========
// Timer management for automatic sync
function startActiveMemorySyncTimer() {
  // Clear any existing timer
  stopActiveMemorySyncTimer();

  // Only start timer if interval is not manual
  if (activeMemoryConfig.interval === 'manual' || !activeMemoryEnabled) {
    return;
  }

  var intervalMs = parseInt(activeMemoryConfig.interval, 10) * 60 * 1000; // Convert minutes to ms
  console.log('[ActiveMemory] Starting auto-sync timer:', activeMemoryConfig.interval, 'minutes');

  activeMemorySyncTimer = setInterval(function() {
    console.log('[ActiveMemory] Auto-sync triggered');
    syncActiveMemory();
  }, intervalMs);
}

function stopActiveMemorySyncTimer() {
  if (activeMemorySyncTimer) {
    console.log('[ActiveMemory] Stopping auto-sync timer');
    clearInterval(activeMemorySyncTimer);
    activeMemorySyncTimer = null;
  }
}

async function loadActiveMemoryStatus() {
  try {
    var response = await fetch('/api/memory/active/status');
    if (!response.ok) throw new Error('Failed to load active memory status');
    var data = await response.json();
    activeMemoryEnabled = data.enabled || false;
    activeMemoryStatus = data.status || null;
    // Load config if available
    if (data.config) {
      activeMemoryConfig = Object.assign(activeMemoryConfig, data.config);
    }

    // Start timer if active memory is enabled and interval is not manual
    if (activeMemoryEnabled && activeMemoryConfig.interval !== 'manual') {
      startActiveMemorySyncTimer();
    }

    return data;
  } catch (err) {
    console.error('Failed to load active memory status:', err);
    activeMemoryEnabled = false;
    activeMemoryStatus = null;
    return { enabled: false };
  }
}

async function toggleActiveMemory(enabled) {
  try {
    var response = await fetch('/api/memory/active/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: enabled,
        config: activeMemoryConfig
      })
    });
    if (!response.ok) throw new Error('Failed to toggle active memory');
    var data = await response.json();
    activeMemoryEnabled = data.enabled;

    // Manage auto-sync timer based on enabled state
    if (activeMemoryEnabled) {
      startActiveMemorySyncTimer();
    } else {
      stopActiveMemorySyncTimer();
    }

    // Show notification
    if (window.showToast) {
      showToast(enabled ? t('memory.activeMemoryEnabled') : t('memory.activeMemoryDisabled'), 'success');
    }

    // Re-render the view to update UI
    renderMemoryView();
  } catch (err) {
    console.error('Failed to toggle active memory:', err);
    if (window.showToast) {
      showToast(t('memory.activeMemoryError'), 'error');
    }
    // Revert checkbox state
    var checkbox = document.getElementById('activeMemorySwitch');
    if (checkbox) checkbox.checked = !enabled;
  }
}

async function updateActiveMemoryConfig(key, value) {
  activeMemoryConfig[key] = value;

  try {
    var response = await fetch('/api/memory/active/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: activeMemoryConfig })
    });
    if (!response.ok) throw new Error('Failed to update config');

    // Restart timer if interval changed and active memory is enabled
    if (key === 'interval' && activeMemoryEnabled) {
      startActiveMemorySyncTimer();
    }

    if (window.showToast) {
      showToast(t('memory.configUpdated'), 'success');
    }
  } catch (err) {
    console.error('Failed to update active memory config:', err);
    if (window.showToast) {
      showToast(t('memory.configError'), 'error');
    }
  }
}

async function syncActiveMemory() {
  var syncBtn = document.querySelector('.btn-sync');
  if (syncBtn) {
    syncBtn.classList.add('syncing');
    syncBtn.disabled = true;
  }

  try {
    var response = await fetch('/api/memory/active/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: activeMemoryConfig.tool
      })
    });
    if (!response.ok) throw new Error('Failed to sync active memory');
    var data = await response.json();

    if (window.showToast) {
      showToast(t('memory.syncComplete') + ' (' + (data.filesAnalyzed || 0) + ' ' + t('memory.filesAnalyzed') + ')', 'success');
    }

    // Refresh data and update last sync time
    await loadActiveMemoryStatus();
    // Update last sync display without full re-render
    var lastSyncEl = document.querySelector('.last-sync');
    if (lastSyncEl && activeMemoryStatus && activeMemoryStatus.lastSync) {
      lastSyncEl.textContent = t('memory.lastSync') + ': ' + formatTimestamp(activeMemoryStatus.lastSync);
    }
  } catch (err) {
    console.error('Failed to sync active memory:', err);
    if (window.showToast) {
      showToast(t('memory.syncError'), 'error');
    }
  } finally {
    if (syncBtn) {
      syncBtn.classList.remove('syncing');
      syncBtn.disabled = false;
    }
  }
}

// ========== Left Column: Context Hotspots ==========
function renderHotspotsColumn() {
  var container = document.getElementById('memory-hotspots');
  if (!container) return;

  var mostRead = memoryStats.mostRead || [];
  var mostEdited = memoryStats.mostEdited || [];
  var mostMentioned = memoryStats.mostMentioned || [];

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
    '<div class="hotspot-list-container">' +
    '<h4 class="hotspot-list-title"><i data-lucide="message-circle" class="w-3.5 h-3.5"></i> ' + t('memory.mostMentioned') + '</h4>' +
    renderTopicList(mostMentioned) +
    '</div>' +
    '</div>' +
    '</div>';

  if (window.lucide) lucide.createIcons();
}

function renderHotspotList(items, type) {
  if (!items || items.length === 0) {
    return '<div class="hotspot-empty">' +
      '<i data-lucide="inbox" class="w-5 h-5"></i>' +
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

function renderTopicList(items) {
  if (!items || items.length === 0) {
    return '<div class="hotspot-empty">' +
      '<i data-lucide="inbox" class="w-5 h-5"></i>' +
      '<p>' + t('memory.noData') + '</p>' +
      '</div>';
  }

  return '<div class="hotspot-list topic-list">' +
    items.map(function(item, index) {
      var heat = item.heat || item.count || 0;
      var heatClass = heat > 10 ? 'high' : heat > 5 ? 'medium' : 'low';
      var preview = item.preview || item.topic || 'Unknown';

      return '<div class="hotspot-item topic-item">' +
        '<div class="hotspot-rank">' + (index + 1) + '</div>' +
        '<div class="hotspot-info">' +
        '<div class="hotspot-name topic-preview" title="' + escapeHtml(item.topic || '') + '">' + escapeHtml(preview) + '</div>' +
        '</div>' +
        '<div class="hotspot-heat ' + heatClass + '">' +
        '<span class="heat-badge">' + heat + '</span>' +
        '<i data-lucide="message-circle" class="w-3 h-3"></i>' +
        '</div>' +
        '</div>';
    }).join('') +
    '</div>';
}

// ========== Center Column: Memory Graph ==========
// Store graph state for zoom/pan
var graphZoom = null;
var graphSvg = null;
var graphGroup = null;
var graphSimulation = null;

function renderGraphColumn() {
  var container = document.getElementById('memory-graph');
  if (!container) return;

  container.innerHTML = '<div class="memory-section">' +
    '<div class="section-header">' +
    '<div class="section-header-left">' +
    '<h3><i data-lucide="network" class="w-4 h-4"></i> ' + t('memory.memoryGraph') + '</h3>' +
    '<span class="section-count">' + (memoryGraphData.nodes || []).length + ' ' + t('memory.nodes') + '</span>' +
    '</div>' +
    '<div class="section-header-actions graph-controls">' +
    '<button class="btn-icon" onclick="zoomGraphIn()" title="' + t('memory.zoomIn') + '">' +
    '<i data-lucide="zoom-in" class="w-4 h-4"></i>' +
    '</button>' +
    '<button class="btn-icon" onclick="zoomGraphOut()" title="' + t('memory.zoomOut') + '">' +
    '<i data-lucide="zoom-out" class="w-4 h-4"></i>' +
    '</button>' +
    '<button class="btn-icon" onclick="fitGraphToView()" title="' + t('memory.fitView') + '">' +
    '<i data-lucide="maximize-2" class="w-4 h-4"></i>' +
    '</button>' +
    '<button class="btn-icon" onclick="resetGraphView()" title="' + t('memory.resetView') + '">' +
    '<i data-lucide="refresh-cw" class="w-4 h-4"></i>' +
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
        '<i data-lucide="network" class="w-8 h-8"></i>' +
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
        '<i data-lucide="alert-triangle" class="w-6 h-6"></i>' +
        '<p>' + t('memory.d3NotLoaded') + '</p>' +
        '</div>';
      if (window.lucide) lucide.createIcons();
    }
    return;
  }

  var container = document.getElementById('memoryGraphSvg');
  if (!container) return;

  var width = container.clientWidth || 600;
  var height = container.clientHeight || 400;

  // Clear existing
  container.innerHTML = '';

  // Filter and clean nodes - remove invalid names (like JSON data)
  var cleanNodes = graphData.nodes.filter(function(node) {
    var name = node.name || node.id || '';
    // Filter out JSON-like data, error messages, and very long strings
    if (name.length > 100) return false;
    if (name.includes('"status"') || name.includes('"content"')) return false;
    if (name.includes('"todos"') || name.includes('"activeForm"')) return false;
    if (name.startsWith('{') || name.startsWith('[')) return false;
    // Allow all valid node types: file, module, component
    return true;
  }).map(function(node) {
    // Truncate long names for display
    var displayName = node.name || node.id || 'Unknown';
    if (displayName.length > 25) {
      displayName = displayName.substring(0, 22) + '...';
    }
    return Object.assign({}, node, { displayName: displayName });
  });

  // Filter edges to only include valid nodes
  var nodeIds = new Set(cleanNodes.map(function(n) { return n.id; }));
  var cleanEdges = graphData.edges.filter(function(edge) {
    var sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
    var targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;
    return nodeIds.has(sourceId) && nodeIds.has(targetId);
  });

  // Create SVG with zoom support
  graphSvg = d3.select('#memoryGraphSvg')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'memory-graph-svg')
    .attr('viewBox', [0, 0, width, height]);

  // Create a group for zoom/pan transformations
  graphGroup = graphSvg.append('g').attr('class', 'graph-content');

  // Setup zoom behavior
  graphZoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', function(event) {
      graphGroup.attr('transform', event.transform);
    });

  graphSvg.call(graphZoom);

  // Create force simulation
  graphSimulation = d3.forceSimulation(cleanNodes)
    .force('link', d3.forceLink(cleanEdges).id(function(d) { return d.id; }).distance(80))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(function(d) { return Math.max(15, (d.heat || 10) + 10); }))
    .force('x', d3.forceX(width / 2).strength(0.05))
    .force('y', d3.forceY(height / 2).strength(0.05));

  // Draw edges
  var link = graphGroup.append('g')
    .attr('class', 'graph-links')
    .selectAll('line')
    .data(cleanEdges)
    .enter()
    .append('line')
    .attr('class', 'graph-edge')
    .attr('stroke-width', function(d) { return Math.sqrt(d.weight || 1); });

  // Draw nodes
  var node = graphGroup.append('g')
    .attr('class', 'graph-nodes')
    .selectAll('g')
    .data(cleanNodes)
    .enter()
    .append('g')
    .attr('class', function(d) { return 'graph-node-group ' + (d.type || 'file'); })
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended))
    .on('click', function(event, d) {
      event.stopPropagation();
      selectNode(d);
    });

  // Add circles to nodes
  node.append('circle')
    .attr('class', function(d) { return 'graph-node ' + (d.type || 'file'); })
    .attr('r', function(d) { return Math.max(8, Math.min(20, (d.heat || 10))); })
    .attr('data-id', function(d) { return d.id; });

  // Add labels to nodes
  node.append('text')
    .attr('class', 'graph-label')
    .text(function(d) {
      // Show file count for modules
      if (d.type === 'module' && d.fileCount) {
        return d.displayName + ' (' + d.fileCount + ')';
      }
      return d.displayName;
    })
    .attr('x', function(d) { return Math.max(10, (d.heat || 10)) + 4; })
    .attr('y', 4)
    .attr('font-size', '11px');

  // Update positions on simulation tick
  graphSimulation.on('tick', function() {
    link
      .attr('x1', function(d) { return d.source.x; })
      .attr('y1', function(d) { return d.source.y; })
      .attr('x2', function(d) { return d.target.x; })
      .attr('y2', function(d) { return d.target.y; });

    node.attr('transform', function(d) {
      return 'translate(' + d.x + ',' + d.y + ')';
    });
  });

  // Auto-fit after simulation stabilizes
  graphSimulation.on('end', function() {
    fitGraphToView();
  });

  // Also fit after initial layout
  setTimeout(function() {
    fitGraphToView();
  }, 1000);

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

// ========== Graph Zoom Controls ==========
function zoomGraphIn() {
  if (graphSvg && graphZoom) {
    graphSvg.transition().duration(300).call(graphZoom.scaleBy, 1.3);
  }
}

function zoomGraphOut() {
  if (graphSvg && graphZoom) {
    graphSvg.transition().duration(300).call(graphZoom.scaleBy, 0.7);
  }
}

function fitGraphToView() {
  if (!graphSvg || !graphGroup || !graphZoom) return;

  var container = document.getElementById('memoryGraphSvg');
  if (!container) return;

  var width = container.clientWidth || 600;
  var height = container.clientHeight || 400;

  // Get the bounds of all nodes
  var bounds = graphGroup.node().getBBox();
  if (bounds.width === 0 || bounds.height === 0) return;

  // Calculate scale to fit with padding
  var padding = 40;
  var scale = Math.min(
    (width - padding * 2) / bounds.width,
    (height - padding * 2) / bounds.height
  );
  scale = Math.min(Math.max(scale, 0.2), 2); // Clamp scale between 0.2 and 2

  // Calculate translation to center
  var tx = (width - bounds.width * scale) / 2 - bounds.x * scale;
  var ty = (height - bounds.height * scale) / 2 - bounds.y * scale;

  // Apply transform with animation
  graphSvg.transition()
    .duration(500)
    .call(graphZoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
}

function centerGraphOnNode(nodeId) {
  if (!graphSvg || !graphGroup || !graphZoom) return;

  var container = document.getElementById('memoryGraphSvg');
  if (!container) return;

  var width = container.clientWidth || 600;
  var height = container.clientHeight || 400;

  // Find the node
  var nodeData = null;
  graphGroup.selectAll('.graph-node-group').each(function(d) {
    if (d.id === nodeId) nodeData = d;
  });

  if (!nodeData || nodeData.x === undefined) return;

  // Calculate translation to center on node
  var scale = 1.2;
  var tx = width / 2 - nodeData.x * scale;
  var ty = height / 2 - nodeData.y * scale;

  graphSvg.transition()
    .duration(500)
    .call(graphZoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
}

function selectNode(node) {
  selectedNode = node;

  // Highlight in graph
  if (graphGroup) {
    graphGroup.selectAll('.graph-node').classed('selected', false);
    graphGroup.selectAll('.graph-node[data-id="' + node.id + '"]').classed('selected', true);
  }

  // Center graph on selected node
  centerGraphOnNode(node.id);

  // Show node details in context column
  showNodeDetails(node);
}

function highlightNode(path) {
  var node = memoryGraphData.nodes.find(function(n) { return n.path === path || n.id === path; });
  if (node) {
    selectNode(node);
  }
}

function resetGraphView() {
  selectedNode = null;
  if (graphGroup) {
    graphGroup.selectAll('.graph-node').classed('selected', false);
  }
  fitGraphToView();
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
      '<i data-lucide="inbox" class="w-6 h-6"></i>' +
      '<p>' + t('memory.noRecentActivity') + '</p>' +
      '</div>';
  }

  return '<div class="context-timeline">' +
    prompts.map(function(item, index) {
      var timestamp = item.timestamp ? formatTimestamp(item.timestamp) : 'Unknown time';
      var type = item.type || 'unknown';
      var typeIcon = type === 'read' ? 'eye' : type === 'write' ? 'pencil' : type === 'edit' ? 'pencil' : 'file-text';
      var files = item.files || [];
      var description = item.prompt || item.description || 'No description';

      return '<div class="timeline-item" data-index="' + index + '" onclick="toggleTimelineItem(this)">' +
        '<div class="timeline-icon ' + type + '">' +
        '<i data-lucide="' + typeIcon + '" class="w-3.5 h-3.5"></i>' +
        '</div>' +
        '<div class="timeline-content">' +
        '<div class="timeline-header">' +
        '<span class="timeline-type">' + escapeHtml(type.charAt(0).toUpperCase() + type.slice(1)) + '</span>' +
        '<span class="timeline-time">' + timestamp + '</span>' +
        '</div>' +
        '<div class="timeline-prompt">' + escapeHtml(description) + '</div>' +
        (files.length > 0 ? '<div class="timeline-files">' +
          files.map(function(f) {
            return '<span class="file-tag" onclick="event.stopPropagation(); highlightNode(\'' + escapeHtml(f) + '\')">' +
              '<i data-lucide="file" class="w-3 h-3"></i> ' + escapeHtml(f.split('/').pop().split('\\').pop()) +
              '</span>';
          }).join('') +
          '</div>' : '') +
        '</div>' +
        '</div>';
    }).join('') +
    '</div>';
}

/**
 * Toggle timeline item expansion
 */
function toggleTimelineItem(element) {
  element.classList.toggle('expanded');
}

function renderContextStats() {
  var totalReads = recentContext.filter(function(c) { return c.type === 'read'; }).length;
  var totalEdits = recentContext.filter(function(c) { return c.type === 'edit' || c.type === 'write'; }).length;
  var totalMentions = recentContext.filter(function(c) { return c.type === 'mention'; }).length;

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
    '<span class="stat-label">' + t('memory.mentions') + '</span>' +
    '<span class="stat-value">' + totalMentions + '</span>' +
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

// ========== Insights Section ==========
function renderInsightsSection() {
  var container = document.getElementById('memory-insights');
  if (!container) return;

  container.innerHTML = '<div class="insights-section">' +
    '<div class="section-header">' +
    '<div class="section-header-left">' +
    '<h3><i data-lucide="lightbulb" class="w-4 h-4"></i> ' + t('memory.insightsHistory') + '</h3>' +
    '<span class="section-count">' + insightsHistory.length + ' ' + t('memory.analyses') + '</span>' +
    '</div>' +
    '<div class="section-header-actions">' +
    '<button class="btn-icon" onclick="refreshInsightsHistory()" title="' + t('common.refresh') + '">' +
    '<i data-lucide="refresh-cw" class="w-4 h-4"></i>' +
    '</button>' +
    '</div>' +
    '</div>' +
    '<div class="insights-cards-container">' +
    renderInsightsCards() +
    '</div>' +
    (selectedInsight ? '<div class="insight-detail-panel" id="insightDetailPanel">' + renderInsightDetail(selectedInsight) + '</div>' : '') +
    '</div>';

  if (window.lucide) lucide.createIcons();
}

function renderInsightsCards() {
  if (!insightsHistory || insightsHistory.length === 0) {
    return '<div class="insights-empty">' +
      '<i data-lucide="lightbulb-off" class="w-8 h-8"></i>' +
      '<p>' + t('memory.noInsightsYet') + '</p>' +
      '<p class="insights-empty-hint">' + t('memory.triggerAnalysis') + '</p>' +
      '</div>';
  }

  return '<div class="insights-cards">' +
    insightsHistory.map(function(insight) {
      var patternCount = (insight.patterns || []).length;
      var suggestionCount = (insight.suggestions || []).length;
      var severity = getInsightSeverity(insight.patterns);
      var date = new Date(insight.created_at);
      var timeAgo = formatTimestamp(insight.created_at);

      return '<div class="insight-card ' + severity + '" onclick="showInsightDetail(\'' + insight.id + '\')">' +
        '<div class="insight-card-header">' +
        '<div class="insight-card-tool">' +
        '<i data-lucide="' + getToolIcon(insight.tool) + '" class="w-4 h-4"></i>' +
        '<span>' + insight.tool + '</span>' +
        '</div>' +
        '<div class="insight-card-time">' + timeAgo + '</div>' +
        '</div>' +
        '<div class="insight-card-stats">' +
        '<div class="insight-stat">' +
        '<span class="insight-stat-value">' + patternCount + '</span>' +
        '<span class="insight-stat-label">' + t('memory.patterns') + '</span>' +
        '</div>' +
        '<div class="insight-stat">' +
        '<span class="insight-stat-value">' + suggestionCount + '</span>' +
        '<span class="insight-stat-label">' + t('memory.suggestions') + '</span>' +
        '</div>' +
        '<div class="insight-stat">' +
        '<span class="insight-stat-value">' + insight.prompt_count + '</span>' +
        '<span class="insight-stat-label">' + t('memory.prompts') + '</span>' +
        '</div>' +
        '</div>' +
        '<div class="insight-card-preview">' +
        (insight.patterns && insight.patterns.length > 0 ?
          '<div class="pattern-preview ' + (insight.patterns[0].severity || 'low') + '">' +
          '<span class="pattern-type">' + escapeHtml(insight.patterns[0].type || 'pattern') + '</span>' +
          '<span class="pattern-desc">' + escapeHtml((insight.patterns[0].description || '').substring(0, 60)) + '...</span>' +
          '</div>' : '') +
        '</div>' +
        '</div>';
    }).join('') +
    '</div>';
}

function getInsightSeverity(patterns) {
  if (!patterns || patterns.length === 0) return 'low';
  var hasHigh = patterns.some(function(p) { return p.severity === 'high'; });
  var hasMedium = patterns.some(function(p) { return p.severity === 'medium'; });
  return hasHigh ? 'high' : (hasMedium ? 'medium' : 'low');
}

function getToolIcon(tool) {
  switch(tool) {
    case 'gemini': return 'sparkles';
    case 'qwen': return 'bot';
    case 'codex': return 'code-2';
    default: return 'cpu';
  }
}

async function showInsightDetail(insightId) {
  try {
    var response = await fetch('/api/memory/insights/' + insightId);
    if (!response.ok) throw new Error('Failed to load insight detail');
    var data = await response.json();
    selectedInsight = data.insight;
    renderInsightsSection();
  } catch (err) {
    console.error('Failed to load insight detail:', err);
    if (window.showToast) {
      showToast(t('memory.loadInsightError'), 'error');
    }
  }
}

function closeInsightDetail() {
  selectedInsight = null;
  renderInsightsSection();
}

function renderInsightDetail(insight) {
  if (!insight) return '';

  var html = '<div class="insight-detail">' +
    '<div class="insight-detail-header">' +
    '<h4><i data-lucide="lightbulb" class="w-4 h-4"></i> ' + t('memory.insightDetail') + '</h4>' +
    '<button class="btn-icon" onclick="closeInsightDetail()" title="' + t('common.close') + '">' +
    '<i data-lucide="x" class="w-4 h-4"></i>' +
    '</button>' +
    '</div>' +
    '<div class="insight-detail-meta">' +
    '<span><i data-lucide="' + getToolIcon(insight.tool) + '" class="w-3 h-3"></i> ' + insight.tool + '</span>' +
    '<span><i data-lucide="clock" class="w-3 h-3"></i> ' + formatTimestamp(insight.created_at) + '</span>' +
    '<span><i data-lucide="file-text" class="w-3 h-3"></i> ' + insight.prompt_count + ' ' + t('memory.promptsAnalyzed') + '</span>' +
    '</div>';

  // Patterns
  if (insight.patterns && insight.patterns.length > 0) {
    html += '<div class="insight-patterns">' +
      '<h5><i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> ' + t('memory.patternsFound') + ' (' + insight.patterns.length + ')</h5>' +
      '<div class="patterns-list">' +
      insight.patterns.map(function(p) {
        return '<div class="pattern-item ' + (p.severity || 'low') + '">' +
          '<div class="pattern-header">' +
          '<span class="pattern-type-badge">' + escapeHtml(p.type || 'pattern') + '</span>' +
          '<span class="pattern-severity">' + (p.severity || 'low') + '</span>' +
          (p.occurrences ? '<span class="pattern-occurrences">' + p.occurrences + 'x</span>' : '') +
          '</div>' +
          '<div class="pattern-description">' + escapeHtml(p.description || '') + '</div>' +
          (p.suggestion ? '<div class="pattern-suggestion"><i data-lucide="arrow-right" class="w-3 h-3"></i> ' + escapeHtml(p.suggestion) + '</div>' : '') +
          '</div>';
      }).join('') +
      '</div>' +
      '</div>';
  }

  // Suggestions
  if (insight.suggestions && insight.suggestions.length > 0) {
    html += '<div class="insight-suggestions">' +
      '<h5><i data-lucide="lightbulb" class="w-3.5 h-3.5"></i> ' + t('memory.suggestionsProvided') + ' (' + insight.suggestions.length + ')</h5>' +
      '<div class="suggestions-list">' +
      insight.suggestions.map(function(s) {
        return '<div class="suggestion-item">' +
          '<div class="suggestion-title">' + escapeHtml(s.title || '') + '</div>' +
          '<div class="suggestion-description">' + escapeHtml(s.description || '') + '</div>' +
          (s.example ? '<div class="suggestion-example"><code>' + escapeHtml(s.example) + '</code></div>' : '') +
          '</div>';
      }).join('') +
      '</div>' +
      '</div>';
  }

  html += '<div class="insight-detail-actions">' +
    '<button class="btn btn-sm btn-danger" onclick="deleteInsight(\'' + insight.id + '\')">' +
    '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i> ' + t('common.delete') +
    '</button>' +
    '</div>' +
    '</div>';

  return html;
}

async function deleteInsight(insightId) {
  if (!confirm(t('memory.confirmDeleteInsight'))) return;

  try {
    var response = await csrfFetch('/api/memory/insights/' + insightId, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete insight');

    selectedInsight = null;
    await loadInsightsHistory();
    renderInsightsSection();

    if (window.showToast) {
      showToast(t('memory.insightDeleted'), 'success');
    }
  } catch (err) {
    console.error('Failed to delete insight:', err);
    if (window.showToast) {
      showToast(t('memory.deleteInsightError'), 'error');
    }
  }
}

async function refreshInsightsHistory() {
  await loadInsightsHistory();
  renderInsightsSection();
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
