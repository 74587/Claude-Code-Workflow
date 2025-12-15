// Graph Explorer View
// Interactive code relationship visualization using Cytoscape.js

// ========== State Variables ==========
var graphData = { nodes: [], edges: [] };
var cyInstance = null;
var activeTab = 'graph';
var nodeFilters = {
  MODULE: true,
  CLASS: true,
  FUNCTION: true,
  METHOD: true,
  VARIABLE: false
};
var edgeFilters = {
  CALLS: true,
  IMPORTS: true,
  INHERITS: true
};
var selectedNode = null;
var searchProcessData = null;

// ========== Node/Edge Colors ==========
var NODE_COLORS = {
  MODULE: '#8B5CF6',
  CLASS: '#3B82F6',
  FUNCTION: '#10B981',
  METHOD: '#F59E0B',
  VARIABLE: '#6B7280'
};

var EDGE_COLORS = {
  CALLS: '#10B981',
  IMPORTS: '#3B82F6',
  INHERITS: '#F59E0B'
};

// ========== Main Render Function ==========
async function renderGraphExplorer() {
  var container = document.getElementById('mainContent');
  if (!container) return;

  // Hide stats grid and carousel
  hideStatsAndCarousel();

  // Show loading state
  container.innerHTML = '<div class="graph-explorer-view loading">' +
    '<div class="loading-spinner"><i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i></div>' +
    '<p>' + t('common.loading') + '</p>' +
    '</div>';

  // Load data
  await Promise.all([
    loadGraphData(),
    loadSearchProcessData()
  ]);

  // Render layout
  container.innerHTML = renderGraphLayout();

  // Initialize Cytoscape.js after DOM is ready
  setTimeout(function() {
    if (activeTab === 'graph') {
      initializeCytoscape();
    }
    if (window.lucide) lucide.createIcons();
  }, 100);
}

// ========== Data Loading ==========
async function loadGraphData() {
  try {
    var nodesResp = await fetch('/api/graph/nodes');
    if (!nodesResp.ok) throw new Error('Failed to load graph nodes');
    var nodesData = await nodesResp.json();

    var edgesResp = await fetch('/api/graph/edges');
    if (!edgesResp.ok) throw new Error('Failed to load graph edges');
    var edgesData = await edgesResp.json();

    graphData = {
      nodes: nodesData.nodes || [],
      edges: edgesData.edges || []
    };
    return graphData;
  } catch (err) {
    console.error('Failed to load graph data:', err);
    graphData = { nodes: [], edges: [] };
    return graphData;
  }
}

async function loadSearchProcessData() {
  try {
    var response = await fetch('/api/graph/search-process');
    if (!response.ok) throw new Error('Failed to load search process data');
    var data = await response.json();
    searchProcessData = data.searchProcess || null;
    return searchProcessData;
  } catch (err) {
    console.error('Failed to load search process data:', err);
    searchProcessData = null;
    return null;
  }
}

// ========== UI Layout ==========
function renderGraphLayout() {
  return '<div class="graph-explorer-view">' +
    '<div class="graph-explorer-header">' +
    '<h2><i data-lucide="network" class="w-5 h-5"></i> ' + t('graph.title') + '</h2>' +
    '<div class="graph-explorer-tabs">' +
    '<button class="tab-btn ' + (activeTab === 'graph' ? 'active' : '') + '" onclick="switchGraphTab(\'graph\')">' +
    '<i data-lucide="git-branch" class="w-4 h-4"></i> ' + t('graph.codeRelations') +
    '</button>' +
    '<button class="tab-btn ' + (activeTab === 'search' ? 'active' : '') + '" onclick="switchGraphTab(\'search\')">' +
    '<i data-lucide="search" class="w-4 h-4"></i> ' + t('graph.searchProcess') +
    '</button>' +
    '</div>' +
    '</div>' +
    '<div class="graph-explorer-content">' +
    '<div id="graphTab" class="tab-content ' + (activeTab === 'graph' ? 'active' : '') + '">' +
    renderGraphView() +
    '</div>' +
    '<div id="searchTab" class="tab-content ' + (activeTab === 'search' ? 'active' : '') + '">' +
    renderSearchProcessView() +
    '</div>' +
    '</div>' +
    '</div>';
}

function renderGraphView() {
  return '<div class="graph-view">' +
    '<div class="graph-sidebar">' +
    '<div class="graph-controls-section">' +
    '<h3>' + t('graph.filters') + '</h3>' +
    renderFilterDropdowns() +
    '</div>' +
    '<div class="graph-legend-section">' +
    '<h3>' + t('graph.legend') + '</h3>' +
    renderGraphLegend() +
    '</div>' +
    '<div id="nodeDetailsPanel" class="node-details-panel hidden">' +
    '</div>' +
    '</div>' +
    '<div class="graph-main">' +
    '<div class="graph-toolbar">' +
    '<div class="graph-toolbar-left">' +
    '<span class="graph-stats">' +
    '<i data-lucide="circle" class="w-3 h-3"></i> ' +
    graphData.nodes.length + ' ' + t('graph.nodes') +
    '</span>' +
    '<span class="graph-stats">' +
    '<i data-lucide="arrow-right" class="w-3 h-3"></i> ' +
    graphData.edges.length + ' ' + t('graph.edges') +
    '</span>' +
    '</div>' +
    '<div class="graph-toolbar-right">' +
    '<button class="btn-icon" onclick="fitCytoscape()" title="' + t('graph.fitView') + '">' +
    '<i data-lucide="maximize-2" class="w-4 h-4"></i>' +
    '</button>' +
    '<button class="btn-icon" onclick="centerCytoscape()" title="' + t('graph.center') + '">' +
    '<i data-lucide="crosshair" class="w-4 h-4"></i>' +
    '</button>' +
    '<button class="btn-icon" onclick="resetGraphFilters()" title="' + t('graph.resetFilters') + '">' +
    '<i data-lucide="filter-x" class="w-4 h-4"></i>' +
    '</button>' +
    '<button class="btn-icon" onclick="refreshGraphData()" title="' + t('common.refresh') + '">' +
    '<i data-lucide="refresh-cw" class="w-4 h-4"></i>' +
    '</button>' +
    '</div>' +
    '</div>' +
    '<div id="cytoscapeContainer" class="cytoscape-container"></div>' +
    '</div>' +
    '</div>';
}

function renderFilterDropdowns() {
  return '<div class="filter-dropdowns">' +
    '<div class="filter-group">' +
    '<label>' + t('graph.nodeTypes') + '</label>' +
    Object.keys(NODE_COLORS).map(function(type) {
      return '<label class="filter-checkbox">' +
        '<input type="checkbox" ' + (nodeFilters[type] ? 'checked' : '') + ' onchange="toggleNodeFilter(\'' + type + '\', this.checked)">' +
        '<span class="filter-color" style="background-color: ' + NODE_COLORS[type] + '"></span>' +
        '<span>' + type + '</span>' +
        '</label>';
    }).join('') +
    '</div>' +
    '<div class="filter-group">' +
    '<label>' + t('graph.edgeTypes') + '</label>' +
    Object.keys(EDGE_COLORS).map(function(type) {
      return '<label class="filter-checkbox">' +
        '<input type="checkbox" ' + (edgeFilters[type] ? 'checked' : '') + ' onchange="toggleEdgeFilter(\'' + type + '\', this.checked)">' +
        '<span class="filter-color" style="background-color: ' + EDGE_COLORS[type] + '"></span>' +
        '<span>' + type + '</span>' +
        '</label>';
    }).join('') +
    '</div>' +
    '</div>';
}

function renderGraphLegend() {
  return '<div class="graph-legend">' +
    '<div class="legend-title">' + t('graph.nodeTypes') + '</div>' +
    Object.keys(NODE_COLORS).map(function(type) {
      return '<div class="legend-item">' +
        '<span class="legend-dot" style="background-color: ' + NODE_COLORS[type] + '"></span>' +
        '<span>' + type + '</span>' +
        '</div>';
    }).join('') +
    '<div class="legend-title" style="margin-top: 1rem;">' + t('graph.edgeTypes') + '</div>' +
    Object.keys(EDGE_COLORS).map(function(type) {
      return '<div class="legend-item">' +
        '<span class="legend-line" style="background-color: ' + EDGE_COLORS[type] + '"></span>' +
        '<span>' + type + '</span>' +
        '</div>';
    }).join('') +
    '</div>';
}

function renderSearchProcessView() {
  if (!searchProcessData) {
    return '<div class="search-process-empty">' +
      '<i data-lucide="search-x" class="w-8 h-8"></i>' +
      '<p>' + t('graph.noSearchData') + '</p>' +
      '</div>';
  }

  return '<div class="search-process-view">' +
    '<div class="search-process-header">' +
    '<h3>' + t('graph.searchProcessTitle') + '</h3>' +
    '<p class="search-process-desc">' + t('graph.searchProcessDesc') + '</p>' +
    '</div>' +
    '<div class="search-process-timeline">' +
    (searchProcessData.steps || []).map(function(step, index) {
      return '<div class="search-step">' +
        '<div class="search-step-number">' + (index + 1) + '</div>' +
        '<div class="search-step-content">' +
        '<h4>' + escapeHtml(step.name || 'Step ' + (index + 1)) + '</h4>' +
        '<p>' + escapeHtml(step.description || '') + '</p>' +
        (step.results ? '<div class="search-step-results">' +
          '<span class="result-count">' + (step.results.length || 0) + ' ' + t('graph.resultsFound') + '</span>' +
          '</div>' : '') +
        '</div>' +
        '</div>';
    }).join('') +
    '</div>' +
    '</div>';
}

// ========== Tab Switching ==========
function switchGraphTab(tab) {
  activeTab = tab;

  // Update tab buttons
  var tabBtns = document.querySelectorAll('.graph-explorer-tabs .tab-btn');
  tabBtns.forEach(function(btn) {
    btn.classList.remove('active');
  });
  event.target.closest('.tab-btn').classList.add('active');

  // Update tab content
  document.getElementById('graphTab').classList.toggle('active', tab === 'graph');
  document.getElementById('searchTab').classList.toggle('active', tab === 'search');

  // Initialize Cytoscape if switching to graph tab
  if (tab === 'graph' && !cyInstance) {
    setTimeout(function() {
      initializeCytoscape();
    }, 100);
  }
}

// ========== Cytoscape.js Integration ==========
function initializeCytoscape() {
  var container = document.getElementById('cytoscapeContainer');
  if (!container) return;

  // Check if Cytoscape.js is loaded
  if (typeof cytoscape === 'undefined') {
    container.innerHTML = '<div class="cytoscape-error">' +
      '<i data-lucide="alert-triangle" class="w-6 h-6"></i>' +
      '<p>' + t('graph.cytoscapeNotLoaded') + '</p>' +
      '</div>';
    if (window.lucide) lucide.createIcons();
    return;
  }

  if (graphData.nodes.length === 0) {
    container.innerHTML = '<div class="cytoscape-empty">' +
      '<i data-lucide="network" class="w-8 h-8"></i>' +
      '<p>' + t('graph.noGraphData') + '</p>' +
      '</div>';
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Transform data for Cytoscape
  var elements = transformDataForCytoscape();

  // Create Cytoscape instance
  cyInstance = cytoscape({
    container: container,
    elements: elements,
    style: getCytoscapeStyles(),
    layout: {
      name: 'cose',
      idealEdgeLength: 100,
      nodeOverlap: 20,
      refresh: 20,
      fit: true,
      padding: 30,
      randomize: false,
      componentSpacing: 100,
      nodeRepulsion: 400000,
      edgeElasticity: 100,
      nestingFactor: 5,
      gravity: 80,
      numIter: 1000,
      initialTemp: 200,
      coolingFactor: 0.95,
      minTemp: 1.0
    },
    minZoom: 0.1,
    maxZoom: 3,
    wheelSensitivity: 0.2
  });

  // Bind events
  cyInstance.on('tap', 'node', function(evt) {
    var node = evt.target;
    selectNode(node.data());
  });

  cyInstance.on('tap', function(evt) {
    if (evt.target === cyInstance) {
      deselectNode();
    }
  });

  // Fit view after layout
  setTimeout(function() {
    fitCytoscape();
  }, 100);
}

function transformDataForCytoscape() {
  var elements = [];

  // Filter nodes
  var filteredNodes = graphData.nodes.filter(function(node) {
    var type = node.type || 'MODULE';
    return nodeFilters[type];
  });

  // Add nodes
  filteredNodes.forEach(function(node) {
    elements.push({
      group: 'nodes',
      data: {
        id: node.id,
        label: node.name || node.id,
        type: node.type || 'MODULE',
        symbolType: node.symbolType,
        path: node.path,
        lineNumber: node.lineNumber,
        imports: node.imports || 0,
        exports: node.exports || 0,
        references: node.references || 0
      }
    });
  });

  // Create node ID set for filtering edges
  var nodeIdSet = new Set(filteredNodes.map(function(n) { return n.id; }));

  // Filter edges
  var filteredEdges = graphData.edges.filter(function(edge) {
    var type = edge.type || 'CALLS';
    return edgeFilters[type] &&
           nodeIdSet.has(edge.source) &&
           nodeIdSet.has(edge.target);
  });

  // Add edges
  filteredEdges.forEach(function(edge, index) {
    elements.push({
      group: 'edges',
      data: {
        id: 'edge-' + index,
        source: edge.source,
        target: edge.target,
        type: edge.type || 'CALLS',
        weight: edge.weight || 1
      }
    });
  });

  return elements;
}

function getCytoscapeStyles() {
  var styles = [
    // Node styles by type
    {
      selector: 'node',
      style: {
        'background-color': function(ele) {
          return NODE_COLORS[ele.data('type')] || '#6B7280';
        },
        'label': 'data(label)',
        'width': function(ele) {
          var refs = ele.data('references') || 0;
          return Math.max(20, Math.min(60, 20 + refs * 2));
        },
        'height': function(ele) {
          var refs = ele.data('references') || 0;
          return Math.max(20, Math.min(60, 20 + refs * 2));
        },
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': '10px',
        'color': '#000',
        'text-outline-color': '#fff',
        'text-outline-width': 2,
        'overlay-padding': 6
      }
    },
    // Selected node
    {
      selector: 'node:selected',
      style: {
        'border-width': 3,
        'border-color': '#000',
        'overlay-color': '#000',
        'overlay-opacity': 0.2
      }
    },
    // Edge styles by type
    {
      selector: 'edge',
      style: {
        'width': function(ele) {
          return Math.max(1, ele.data('weight') || 1);
        },
        'line-color': function(ele) {
          return EDGE_COLORS[ele.data('type')] || '#6B7280';
        },
        'target-arrow-color': function(ele) {
          return EDGE_COLORS[ele.data('type')] || '#6B7280';
        },
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'arrow-scale': 1.2,
        'opacity': 0.6
      }
    },
    // Selected edge
    {
      selector: 'edge:selected',
      style: {
        'line-color': '#000',
        'target-arrow-color': '#000',
        'width': 3,
        'opacity': 1
      }
    }
  ];

  return styles;
}

// ========== Node Selection ==========
function selectNode(nodeData) {
  selectedNode = nodeData;

  // Highlight in cytoscape
  if (cyInstance) {
    cyInstance.nodes().removeClass('selected');
    var node = cyInstance.getElementById(nodeData.id);
    if (node) {
      node.addClass('selected');
      // Highlight connected edges
      cyInstance.edges().removeClass('highlighted');
      node.connectedEdges().addClass('highlighted');
    }
  }

  // Show details panel
  var panel = document.getElementById('nodeDetailsPanel');
  if (panel) {
    panel.classList.remove('hidden');
    panel.innerHTML = renderNodeDetails(nodeData);
    if (window.lucide) lucide.createIcons();

    // Attach event listener for impact analysis button (prevents XSS)
    var impactBtn = document.getElementById('impactAnalysisBtn');
    if (impactBtn) {
      impactBtn.addEventListener('click', function() {
        var nodeId = this.getAttribute('data-node-id');
        if (nodeId) showImpactAnalysis(nodeId);
      });
    }
  }
}

function deselectNode() {
  selectedNode = null;

  // Remove highlights
  if (cyInstance) {
    cyInstance.nodes().removeClass('selected');
    cyInstance.edges().removeClass('highlighted');
  }

  // Hide details panel
  var panel = document.getElementById('nodeDetailsPanel');
  if (panel) {
    panel.classList.add('hidden');
  }
}

function renderNodeDetails(node) {
  var typeIcon = node.type === 'MODULE' ? 'package' :
                 node.type === 'CLASS' ? 'box' :
                 node.type === 'FUNCTION' ? 'code' :
                 node.type === 'METHOD' ? 'code-2' :
                 'variable';

  return '<div class="node-details-content">' +
    '<div class="node-details-header">' +
    '<h4><i data-lucide="' + typeIcon + '" class="w-4 h-4"></i> ' + escapeHtml(node.label || node.id) + '</h4>' +
    '<button class="btn-icon btn-sm" onclick="deselectNode()" title="' + t('common.close') + '">' +
    '<i data-lucide="x" class="w-3 h-3"></i>' +
    '</button>' +
    '</div>' +
    '<div class="node-details-meta">' +
    '<div class="meta-item">' +
    '<span class="meta-label">' + t('graph.type') + '</span>' +
    '<span class="meta-value">' + (node.type || 'MODULE') + '</span>' +
    '</div>' +
    (node.symbolType ? '<div class="meta-item">' +
      '<span class="meta-label">' + t('graph.symbolType') + '</span>' +
      '<span class="meta-value">' + escapeHtml(node.symbolType) + '</span>' +
      '</div>' : '') +
    (node.path ? '<div class="meta-item">' +
      '<span class="meta-label">' + t('graph.path') + '</span>' +
      '<span class="meta-value path-value">' + escapeHtml(node.path) + '</span>' +
      '</div>' : '') +
    (node.lineNumber ? '<div class="meta-item">' +
      '<span class="meta-label">' + t('graph.line') + '</span>' +
      '<span class="meta-value">' + node.lineNumber + '</span>' +
      '</div>' : '') +
    '</div>' +
    '<div class="node-details-stats">' +
    '<div class="stat-item">' +
    '<i data-lucide="download" class="w-3 h-3"></i>' +
    '<span>' + (node.imports || 0) + ' ' + t('graph.imports') + '</span>' +
    '</div>' +
    '<div class="stat-item">' +
    '<i data-lucide="upload" class="w-3 h-3"></i>' +
    '<span>' + (node.exports || 0) + ' ' + t('graph.exports') + '</span>' +
    '</div>' +
    '<div class="stat-item">' +
    '<i data-lucide="link" class="w-3 h-3"></i>' +
    '<span>' + (node.references || 0) + ' ' + t('graph.references') + '</span>' +
    '</div>' +
    '</div>' +
    '<div class="node-details-actions">' +
    '<button class="btn btn-sm btn-primary" id="impactAnalysisBtn" data-node-id="' + escapeHtml(node.id) + '">' +
    '<i data-lucide="target" class="w-3 h-3"></i> ' + t('graph.impactAnalysis') +
    '</button>' +
    '</div>' +
    '</div>';
}

// ========== Filter Actions ==========
function toggleNodeFilter(type, checked) {
  nodeFilters[type] = checked;
  refreshCytoscape();
}

function toggleEdgeFilter(type, checked) {
  edgeFilters[type] = checked;
  refreshCytoscape();
}

function resetGraphFilters() {
  // Reset all filters to true
  Object.keys(nodeFilters).forEach(function(key) {
    nodeFilters[key] = true;
  });
  Object.keys(edgeFilters).forEach(function(key) {
    edgeFilters[key] = true;
  });

  // Update checkboxes
  var checkboxes = document.querySelectorAll('.filter-checkbox input[type="checkbox"]');
  checkboxes.forEach(function(cb) {
    cb.checked = true;
  });

  refreshCytoscape();
}

function refreshCytoscape() {
  if (!cyInstance) return;

  var elements = transformDataForCytoscape();
  cyInstance.elements().remove();
  cyInstance.add(elements);
  cyInstance.layout({
    name: 'cose',
    idealEdgeLength: 100,
    nodeOverlap: 20,
    refresh: 20,
    fit: true,
    padding: 30
  }).run();

  deselectNode();
}

// ========== Cytoscape Controls ==========
function fitCytoscape() {
  if (cyInstance) {
    cyInstance.fit(null, 30);
  }
}

function centerCytoscape() {
  if (cyInstance) {
    cyInstance.center();
  }
}

// ========== Impact Analysis ==========
async function showImpactAnalysis(symbolId) {
  try {
    var response = await fetch('/api/graph/impact?symbol=' + encodeURIComponent(symbolId));
    if (!response.ok) throw new Error('Failed to fetch impact analysis');
    var data = await response.json();

    // Show modal with impact analysis results
    showImpactModal(data.impact);
  } catch (err) {
    console.error('Failed to fetch impact analysis:', err);
    if (window.showToast) {
      showToast(t('graph.impactAnalysisError'), 'error');
    }
  }
}

function showImpactModal(impact) {
  var modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = '<div class="modal-container">' +
    '<div class="modal-header">' +
    '<h3><i data-lucide="target" class="w-4 h-4"></i> ' + t('graph.impactAnalysis') + '</h3>' +
    '<button class="btn-icon" onclick="closeImpactModal()">' +
    '<i data-lucide="x" class="w-4 h-4"></i>' +
    '</button>' +
    '</div>' +
    '<div class="modal-body">' +
    '<div class="impact-summary">' +
    '<div class="impact-stat">' +
    '<span class="impact-stat-value">' + (impact.affectedFiles || 0) + '</span>' +
    '<span class="impact-stat-label">' + t('graph.affectedFiles') + '</span>' +
    '</div>' +
    '<div class="impact-stat">' +
    '<span class="impact-stat-value">' + (impact.affectedSymbols || 0) + '</span>' +
    '<span class="impact-stat-label">' + t('graph.affectedSymbols') + '</span>' +
    '</div>' +
    '<div class="impact-stat">' +
    '<span class="impact-stat-value">' + (impact.depth || 0) + '</span>' +
    '<span class="impact-stat-label">' + t('graph.depth') + '</span>' +
    '</div>' +
    '</div>' +
    (impact.files && impact.files.length > 0 ? '<div class="impact-files">' +
      '<h4>' + t('graph.affectedFiles') + '</h4>' +
      '<div class="impact-files-list">' +
      impact.files.map(function(file) {
        return '<div class="impact-file-item">' +
          '<i data-lucide="file" class="w-3 h-3"></i>' +
          '<span>' + escapeHtml(file) + '</span>' +
          '</div>';
      }).join('') +
      '</div>' +
      '</div>' : '') +
    '</div>' +
    '<div class="modal-footer">' +
    '<button class="btn btn-secondary" onclick="closeImpactModal()">' + t('common.close') + '</button>' +
    '</div>' +
    '</div>';

  document.body.appendChild(modal);
  if (window.lucide) lucide.createIcons();

  // Close on overlay click
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeImpactModal();
    }
  });
}

function closeImpactModal() {
  var modal = document.querySelector('.modal-overlay');
  if (modal) {
    modal.remove();
  }
}

// ========== Data Refresh ==========
async function refreshGraphData() {
  if (window.showToast) {
    showToast(t('common.refreshing'), 'info');
  }

  await loadGraphData();

  if (activeTab === 'graph' && cyInstance) {
    refreshCytoscape();
  }

  if (window.showToast) {
    showToast(t('common.refreshed'), 'success');
  }
}

// ========== Utility ==========
function hideStatsAndCarousel() {
  var statsGrid = document.getElementById('statsGrid');
  var carousel = document.getElementById('carouselContainer');
  if (statsGrid) statsGrid.style.display = 'none';
  if (carousel) carousel.style.display = 'none';
}

// ========== Cleanup Function ==========
/**
 * Clean up Cytoscape instance to prevent memory leaks
 * Should be called when navigating away from the graph explorer view
 */
function cleanupGraphExplorer() {
  if (cyInstance) {
    cyInstance.destroy();
    cyInstance = null;
  }
  selectedNode = null;
  searchProcessData = null;
}

// Register cleanup on navigation (called by navigation.js before switching views)
if (typeof window !== 'undefined') {
  window.cleanupGraphExplorer = cleanupGraphExplorer;
}
