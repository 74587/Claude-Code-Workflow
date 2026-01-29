// ==========================================
// HELP VIEW
// Command guide with categories, workflow diagrams, and CodexLens quick-start
// ==========================================

// State variables
var helpData = {
  commands: [],
  grouped: {},
  workflows: {},
  codexlens: {}
};
var activeHelpTab = 'cli';
var helpSearchQuery = '';
var helpSearchTimeout = null;
var cytoscapeInstance = null;
var activeWorkflowDiagram = 'decision';

// ========== Main Render Function ==========
async function renderHelpView() {
  // Debug: Check if ht function is available
  console.log('[Help View] ht function available:', typeof ht, typeof window.ht);

  hideStatsAndCarousel();

  var container = document.getElementById('mainContent');
  if (!container) return;

  // Show loading state
  container.innerHTML = '<div class="flex items-center justify-center py-16"><i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i></div>';
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Load help data
  await loadHelpData();

  // Render layout
  container.innerHTML = renderHelpLayout();

  // Initialize event handlers
  initializeHelpEventHandlers();

  // Render initial tab
  renderCommandsTab(activeHelpTab);

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ========== Data Loading ==========
async function loadHelpData() {
  try {
    // Load all commands with grouping
    var commandsResp = await fetch('/api/help/commands');
    if (commandsResp.ok) {
      var data = await commandsResp.json();
      helpData.commands = data.commands || [];
      helpData.grouped = data.grouped || {};
    }

    // Load workflow relationships
    var workflowsResp = await fetch('/api/help/workflows');
    if (workflowsResp.ok) {
      helpData.workflows = await workflowsResp.json();
    }

    // Load CodexLens data
    var codexResp = await fetch('/api/help/codexlens');
    if (codexResp.ok) {
      helpData.codexlens = await codexResp.json();
    }
  } catch (err) {
    console.error('Failed to load help data:', err);
  }
}

// ========== Layout Rendering ==========
function renderHelpLayout() {
  return `
    <div class="help-view-container">
      <!-- Page Header -->
      <div class="bg-card border border-border rounded-lg p-6 mb-6">
        <h2 class="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <i data-lucide="help-circle" class="w-6 h-6"></i>
          ${ht('help.title')}
        </h2>
        <p class="text-muted-foreground">
          ${ht('help.subtitle')}
        </p>
      </div>

      <!-- Search Bar -->
      <div class="bg-card border border-border rounded-lg p-4 mb-6">
        <div class="relative">
          <i data-lucide="search" class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground"></i>
          <input
            type="text"
            id="helpSearchInput"
            class="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="${ht('help.search.placeholder')}"
            value="${escapeHtml(helpSearchQuery)}"
          />
        </div>
      </div>

      <!-- Main Tab Navigation -->
      <div class="bg-card border border-border rounded-lg overflow-hidden">
        <div class="flex border-b border-border">
          <button class="help-main-tab flex-1 px-6 py-3 text-sm font-medium transition-colors" data-tab="cli">
            ${ht('help.tab.cli')}
          </button>
          <button class="help-main-tab flex-1 px-6 py-3 text-sm font-medium transition-colors" data-tab="memory">
            ${ht('help.tab.memory')}
          </button>
          <button class="help-main-tab flex-1 px-6 py-3 text-sm font-medium transition-colors" data-tab="workflow">
            ${ht('help.tab.workflow')}
          </button>
          <button class="help-main-tab flex-1 px-6 py-3 text-sm font-medium transition-colors" data-tab="task">
            ${ht('help.tab.task')}
          </button>
          <button class="help-main-tab flex-1 px-6 py-3 text-sm font-medium transition-colors" data-tab="diagrams">
            <i data-lucide="git-branch" class="w-4 h-4 inline-block mr-1"></i>
            ${ht('help.tab.diagrams')}
          </button>
          <button class="help-main-tab flex-1 px-6 py-3 text-sm font-medium transition-colors" data-tab="codexlens">
            <i data-lucide="zap" class="w-4 h-4 inline-block mr-1"></i>
            ${ht('help.tab.codexlens')}
          </button>
        </div>

        <!-- Tab Content Container -->
        <div id="helpTabContent" class="p-6">
          <!-- Content will be dynamically rendered -->
        </div>
      </div>
    </div>
  `;
}

// ========== Event Handlers ==========
function initializeHelpEventHandlers() {
  // Tab switching
  var tabs = document.querySelectorAll('.help-main-tab');
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      var tabName = this.dataset.tab;
      switchHelpTab(tabName);
    });
  });

  // Update active tab styles
  updateActiveTab(activeHelpTab);

  // Search input with debounce
  var searchInput = document.getElementById('helpSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function(e) {
      clearTimeout(helpSearchTimeout);
      helpSearchTimeout = setTimeout(function() {
        helpSearchQuery = e.target.value;
        performHelpSearch();
      }, 300);
    });
  }
}

function switchHelpTab(tabName) {
  activeHelpTab = tabName;
  updateActiveTab(tabName);

  if (tabName === 'diagrams') {
    renderWorkflowDiagrams();
  } else if (tabName === 'codexlens') {
    renderCodexLensQuickStart();
  } else {
    renderCommandsTab(tabName);
  }
}

function updateActiveTab(activeTab) {
  var tabs = document.querySelectorAll('.help-main-tab');
  tabs.forEach(function(tab) {
    if (tab.dataset.tab === activeTab) {
      tab.classList.add('bg-primary', 'text-primary-foreground');
      tab.classList.remove('bg-transparent', 'text-muted-foreground', 'hover:bg-muted');
    } else {
      tab.classList.remove('bg-primary', 'text-primary-foreground');
      tab.classList.add('bg-transparent', 'text-muted-foreground', 'hover:bg-muted');
    }
  });
}

// ========== Command Rendering ==========
function renderCommandsTab(category) {
  var container = document.getElementById('helpTabContent');
  if (!container) return;

  var categoryData = helpData.grouped[category];

  if (!categoryData) {
    container.innerHTML = `
      <div class="text-center py-8 text-muted-foreground">
        <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-2"></i>
        <p>No commands found for this category</p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  var filteredCommands = helpSearchQuery
    ? filterCommandsBySearch(categoryData.commands, helpSearchQuery)
    : categoryData.commands;

  var html = '';

  // Show search results count
  if (helpSearchQuery) {
    html += `
      <div class="mb-4 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
        Found ${filteredCommands.length} commands matching "${escapeHtml(helpSearchQuery)}"
      </div>
    `;
  }

  // Render direct commands
  if (filteredCommands.length > 0) {
    html += '<div class="space-y-3">';
    filteredCommands.forEach(function(cmd) {
      html += renderCommandCard(cmd);
    });
    html += '</div>';
  }

  // Render subcategories as accordions
  var subcategories = categoryData.subcategories || {};
  var subcategoryKeys = Object.keys(subcategories);

  if (subcategoryKeys.length > 0) {
    html += '<div class="mt-6 space-y-3">';
    subcategoryKeys.forEach(function(subcat) {
      var subcatCommands = helpSearchQuery
        ? filterCommandsBySearch(subcategories[subcat], helpSearchQuery)
        : subcategories[subcat];

      if (subcatCommands.length > 0) {
        html += renderSubcategoryAccordion(subcat, subcatCommands);
      }
    });
    html += '</div>';
  }

  if (filteredCommands.length === 0 && subcategoryKeys.length === 0) {
    html = `
      <div class="text-center py-8 text-muted-foreground">
        <i data-lucide="search-x" class="w-12 h-12 mx-auto mb-2"></i>
        <p>No commands found matching your search</p>
      </div>
    `;
  }

  container.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Initialize accordion handlers
  initializeAccordions();
  // Initialize command card click handlers
  initializeCommandCardHandlers();
}

function renderCommandCard(cmd) {
  var difficultyColor = {
    'Beginner': 'bg-success-light text-success',
    'Intermediate': 'bg-warning-light text-warning',
    'Advanced': 'bg-error-light text-error'
  }[cmd.difficulty] || 'bg-muted text-muted-foreground';

  // Create safe JSON string for command data
  var cmdJson = escapeHtml(JSON.stringify(cmd));

  return `
    <div class="command-card cursor-pointer bg-background border border-border rounded-lg p-4 hover:border-primary transition-all hover:shadow-md"
         data-command='${cmdJson}'
         title="Click to view details">
      <div class="flex items-start justify-between mb-2">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            <code class="text-sm font-mono text-primary font-semibold">${escapeHtml(cmd.command)}</code>
            <span class="text-xs px-2 py-0.5 rounded ${difficultyColor}">${escapeHtml(cmd.difficulty)}</span>
          </div>
          <p class="text-sm text-muted-foreground">${escapeHtml(cmd.description)}</p>
        </div>
        <i data-lucide="arrow-right" class="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-2"></i>
      </div>
      ${cmd.arguments ? `
        <div class="mt-2 text-xs">
          <span class="text-muted-foreground">Arguments:</span>
          <code class="ml-2 text-foreground">${escapeHtml(cmd.arguments)}</code>
        </div>
      ` : ''}
    </div>
  `;
}

function renderSubcategoryAccordion(subcatName, commands) {
  var accordionId = 'accordion-' + subcatName.replace(/\s+/g, '-').toLowerCase();

  return `
    <div class="border border-border rounded-lg overflow-hidden">
      <button
        class="accordion-header w-full px-4 py-3 bg-muted hover:bg-muted/80 text-left flex items-center justify-between transition-colors"
        data-accordion="${accordionId}"
      >
        <div class="flex items-center gap-2">
          <i data-lucide="chevron-right" class="accordion-icon w-4 h-4 transition-transform"></i>
          <span class="font-medium text-foreground">${escapeHtml(subcatName)}</span>
          <span class="text-xs text-muted-foreground ml-2">(${commands.length} commands)</span>
        </div>
      </button>
      <div class="accordion-content hidden">
        <div class="p-4 space-y-3 bg-card">
          ${commands.map(cmd => renderCommandCard(cmd)).join('')}
        </div>
      </div>
    </div>
  `;
}

function initializeAccordions() {
  var headers = document.querySelectorAll('.accordion-header');
  headers.forEach(function(header) {
    header.addEventListener('click', function() {
      var content = this.nextElementSibling;
      var icon = this.querySelector('.accordion-icon');

      if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        icon.style.transform = 'rotate(90deg)';
      } else {
        content.classList.add('hidden');
        icon.style.transform = 'rotate(0deg)';
      }
    });
  });
}

// ========== Search Functions ==========
function filterCommandsBySearch(commands, query) {
  if (!query) return commands;

  var lowerQuery = query.toLowerCase();
  return commands.filter(function(cmd) {
    return (cmd.name && cmd.name.toLowerCase().includes(lowerQuery)) ||
           (cmd.command && cmd.command.toLowerCase().includes(lowerQuery)) ||
           (cmd.description && cmd.description.toLowerCase().includes(lowerQuery)) ||
           (cmd.category && cmd.category.toLowerCase().includes(lowerQuery));
  });
}

async function performHelpSearch() {
  // Reload data with search query
  try {
    var url = '/api/help/commands' + (helpSearchQuery ? '?q=' + encodeURIComponent(helpSearchQuery) : '');
    var resp = await fetch(url);
    if (resp.ok) {
      var data = await resp.json();
      helpData.commands = data.commands || [];
      helpData.grouped = data.grouped || {};
    }
  } catch (err) {
    console.error('Search failed:', err);
  }

  // Re-render current tab
  if (activeHelpTab !== 'diagrams' && activeHelpTab !== 'codexlens') {
    renderCommandsTab(activeHelpTab);
  }
}

// ========== Workflow Diagrams ==========
function renderWorkflowDiagrams() {
  var container = document.getElementById('helpTabContent');
  if (!container) return;

  container.innerHTML = `
    <div class="workflow-diagrams-section">
      <div class="mb-4">
        <h3 class="text-lg font-semibold text-foreground mb-3">${ht('help.diagrams.title')}</h3>
        <div class="flex gap-2 flex-wrap">
          <button class="workflow-diagram-btn px-4 py-2 rounded-lg text-sm font-medium transition-colors" data-workflow="decision">
            ${ht('help.diagrams.decision')}
          </button>
          <button class="workflow-diagram-btn px-4 py-2 rounded-lg text-sm font-medium transition-colors" data-workflow="brainstorm">
            ${ht('help.diagrams.brainstorm')}
          </button>
          <button class="workflow-diagram-btn px-4 py-2 rounded-lg text-sm font-medium transition-colors" data-workflow="cli-resume">
            ${ht('help.diagrams.cliResume')}
          </button>
          <button class="workflow-diagram-btn px-4 py-2 rounded-lg text-sm font-medium transition-colors" data-workflow="bug-fix">
            ${ht('help.diagrams.bugFix')}
          </button>
          <button class="workflow-diagram-btn px-4 py-2 rounded-lg text-sm font-medium transition-colors" data-workflow="lite">
            ${ht('help.diagrams.lite')}
          </button>
          <button class="workflow-diagram-btn px-4 py-2 rounded-lg text-sm font-medium transition-colors" data-workflow="plan-full">
            ${ht('help.diagrams.planFull')}
          </button>
          <button class="workflow-diagram-btn px-4 py-2 rounded-lg text-sm font-medium transition-colors" data-workflow="tdd">
            ${ht('help.diagrams.tdd')}
          </button>
        </div>
      </div>

      <!-- Cytoscape Container -->
      <div id="cytoscapeContainer" class="bg-background border border-border rounded-lg" style="height: 600px; min-height: 500px;"></div>

      <!-- Diagram Controls -->
      <div class="mt-4 flex gap-2">
        <button id="fitDiagramBtn" class="px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm flex items-center gap-2">
          <i data-lucide="maximize-2" class="w-4 h-4"></i>
          ${ht('help.diagrams.fit')}
        </button>
        <button id="zoomInBtn" class="px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm flex items-center gap-2">
          <i data-lucide="zoom-in" class="w-4 h-4"></i>
          ${ht('help.diagrams.zoomIn')}
        </button>
        <button id="zoomOutBtn" class="px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm flex items-center gap-2">
          <i data-lucide="zoom-out" class="w-4 h-4"></i>
          ${ht('help.diagrams.zoomOut')}
        </button>
      </div>

      <!-- Legend -->
      <div class="mt-4 p-4 bg-muted rounded-lg">
        <h4 class="text-sm font-semibold text-foreground mb-2">${ht('help.diagrams.legend')}</h4>
        <div class="flex gap-4 flex-wrap text-xs">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-primary"></div>
            <span>${ht('help.diagrams.legend.prerequisites')}</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-success"></div>
            <span>${ht('help.diagrams.legend.nextSteps')}</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-warning"></div>
            <span>${ht('help.diagrams.legend.alternatives')}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Initialize workflow diagram buttons
  var diagramBtns = document.querySelectorAll('.workflow-diagram-btn');
  diagramBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      activeWorkflowDiagram = this.dataset.workflow;
      updateActiveWorkflowBtn(activeWorkflowDiagram);
      initializeCytoscapeDiagram(activeWorkflowDiagram);
    });
  });

  // Initialize control buttons
  var fitBtn = document.getElementById('fitDiagramBtn');
  if (fitBtn) {
    fitBtn.addEventListener('click', function() {
      if (cytoscapeInstance) cytoscapeInstance.fit();
    });
  }

  var zoomInBtn = document.getElementById('zoomInBtn');
  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', function() {
      if (cytoscapeInstance) cytoscapeInstance.zoom(cytoscapeInstance.zoom() * 1.2);
    });
  }

  var zoomOutBtn = document.getElementById('zoomOutBtn');
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', function() {
      if (cytoscapeInstance) cytoscapeInstance.zoom(cytoscapeInstance.zoom() * 0.8);
    });
  }

  // Update active button
  updateActiveWorkflowBtn(activeWorkflowDiagram);

  // Initialize Cytoscape diagram
  setTimeout(function() {
    initializeCytoscapeDiagram(activeWorkflowDiagram);
  }, 100);
}

function updateActiveWorkflowBtn(workflow) {
  var btns = document.querySelectorAll('.workflow-diagram-btn');
  btns.forEach(function(btn) {
    if (btn.dataset.workflow === workflow) {
      btn.classList.add('bg-primary', 'text-primary-foreground');
      btn.classList.remove('bg-muted', 'text-muted-foreground');
    } else {
      btn.classList.remove('bg-primary', 'text-primary-foreground');
      btn.classList.add('bg-muted', 'text-muted-foreground');
    }
  });
}

function initializeCytoscapeDiagram(workflow) {
  var container = document.getElementById('cytoscapeContainer');
  if (!container) return;

  // Destroy previous instance
  if (cytoscapeInstance) {
    cytoscapeInstance.destroy();
    cytoscapeInstance = null;
  }

  // Get workflow data
  var graphData = getWorkflowGraphData(workflow);

  // Check if cytoscape is available
  if (typeof cytoscape === 'undefined') {
    container.innerHTML = '<div class="flex items-center justify-center h-full text-muted-foreground">' + ht('help.diagrams.notLoaded') + '</div>';
    return;
  }

  // Get computed CSS variable values
  var rootStyles = getComputedStyle(document.documentElement);
  var primaryColor = rootStyles.getPropertyValue('--primary').trim();
  var foregroundColor = rootStyles.getPropertyValue('--foreground').trim();
  var mutedColor = rootStyles.getPropertyValue('--muted-foreground').trim();

  // Convert HSL values to usable format
  var primaryHsl = primaryColor ? 'hsl(' + primaryColor + ')' : '#3B82F6';
  var foregroundHsl = foregroundColor ? 'hsl(' + foregroundColor + ')' : '#1F2937';
  var mutedHsl = mutedColor ? 'hsl(' + mutedColor + ')' : '#6B7280';

  // Initialize Cytoscape
  cytoscapeInstance = cytoscape({
    container: container,
    elements: graphData,
    style: [
      {
        selector: 'node',
        style: {
          'shape': 'roundrectangle',
          'background-color': primaryHsl,
          'background-opacity': 0.9,
          'border-width': 2,
          'border-color': primaryHsl,
          'border-opacity': 1,
          'label': 'data(label)',
          'color': '#FFFFFF',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '14px',
          'font-weight': '600',
          'width': '140px',
          'height': '60px',
          'text-wrap': 'wrap',
          'text-max-width': '130px',
          'padding': '8px',
          'shadow-blur': 10,
          'shadow-color': '#000000',
          'shadow-opacity': 0.2,
          'shadow-offset-x': 0,
          'shadow-offset-y': 2
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 3,
          'line-color': mutedHsl,
          'target-arrow-color': mutedHsl,
          'target-arrow-shape': 'triangle',
          'target-arrow-fill': 'filled',
          'arrow-scale': 1.5,
          'curve-style': 'bezier',
          'label': 'data(label)',
          'font-size': '12px',
          'font-weight': '500',
          'color': foregroundHsl,
          'text-background-color': '#FFFFFF',
          'text-background-opacity': 0.9,
          'text-background-padding': '4px',
          'text-background-shape': 'roundrectangle',
          'text-border-width': 1,
          'text-border-color': mutedHsl,
          'text-border-opacity': 0.3
        }
      },
      {
        selector: 'edge.prerequisite',
        style: {
          'line-color': primaryHsl,
          'target-arrow-color': primaryHsl,
          'width': 3
        }
      },
      {
        selector: 'edge.next-step',
        style: {
          'line-color': '#10B981',
          'target-arrow-color': '#10B981',
          'width': 3,
          'line-style': 'solid'
        }
      },
      {
        selector: 'edge.alternative',
        style: {
          'line-color': '#F59E0B',
          'target-arrow-color': '#F59E0B',
          'line-style': 'dashed',
          'line-dash-pattern': [10, 5],
          'width': 2.5
        }
      }
    ],
    layout: {
      name: 'breadthfirst',
      directed: true,
      padding: 80,
      spacingFactor: 2,
      avoidOverlap: true,
      nodeDimensionsIncludeLabels: true,
      animate: false
    }
  });

  // Add click handler for nodes
  cytoscapeInstance.on('tap', 'node', function(evt) {
    var node = evt.target;
    var commandName = node.data('id');
    showCommandTooltip(commandName, node);
  });

  // Fit to viewport
  cytoscapeInstance.fit();
}

function getWorkflowGraphData(workflow) {
  var workflows = {
    'decision': {
      nodes: [
        { data: { id: 'start', label: ht('help.workflows.decision.start') } },
        { data: { id: 'cli-analyze', label: ht('help.workflows.decision.cliAnalyze') } },
        { data: { id: 'understand', label: ht('help.workflows.decision.understand') } },
        { data: { id: 'simple', label: ht('help.workflows.decision.simple') } },
        { data: { id: 'medium', label: ht('help.workflows.decision.medium') } },
        { data: { id: 'complex', label: ht('help.workflows.decision.complex') } },
        { data: { id: 'claude-exec', label: ht('help.workflows.decision.claudeExec') } },
        { data: { id: 'cli-exec', label: ht('help.workflows.decision.cliExec') } },
        { data: { id: 'claude-plan', label: ht('help.workflows.decision.claudePlan') } },
        { data: { id: 'lite-plan', label: '/workflow:lite-plan' } },
        { data: { id: 'full-plan', label: '/workflow:plan' } }
      ],
      edges: [
        { data: { source: 'start', target: 'cli-analyze' }, classes: 'next-step' },
        { data: { source: 'cli-analyze', target: 'understand' }, classes: 'next-step' },
        { data: { source: 'understand', target: 'simple' }, classes: 'alternative' },
        { data: { source: 'understand', target: 'medium' }, classes: 'alternative' },
        { data: { source: 'understand', target: 'complex' }, classes: 'alternative' },
        { data: { source: 'simple', target: 'claude-exec', label: '优先' }, classes: 'next-step' },
        { data: { source: 'simple', target: 'cli-exec' }, classes: 'alternative' },
        { data: { source: 'medium', target: 'claude-plan' }, classes: 'next-step' },
        { data: { source: 'medium', target: 'lite-plan' }, classes: 'alternative' },
        { data: { source: 'complex', target: 'full-plan' }, classes: 'next-step' }
      ]
    },
    'brainstorm': {
      nodes: [
        { data: { id: 'start', label: ht('help.workflows.brainstorm.start') } },
        { data: { id: 'question', label: ht('help.workflows.brainstorm.question') } },
        { data: { id: 'product', label: ht('help.workflows.brainstorm.product') } },
        { data: { id: 'design', label: ht('help.workflows.brainstorm.design') } },
        { data: { id: 'brainstorm-product', label: '/workflow:brainstorm:auto-parallel' } },
        { data: { id: 'brainstorm-design', label: '/workflow:brainstorm:auto-parallel' } },
        { data: { id: 'next', label: ht('help.workflows.brainstorm.next') } }
      ],
      edges: [
        { data: { source: 'start', target: 'question' }, classes: 'next-step' },
        { data: { source: 'question', target: 'product' }, classes: 'alternative' },
        { data: { source: 'question', target: 'design' }, classes: 'alternative' },
        { data: { source: 'product', target: 'brainstorm-product' }, classes: 'next-step' },
        { data: { source: 'design', target: 'brainstorm-design' }, classes: 'next-step' },
        { data: { source: 'brainstorm-product', target: 'next' }, classes: 'next-step' },
        { data: { source: 'brainstorm-design', target: 'next' }, classes: 'next-step' }
      ]
    },
    'cli-resume': {
      nodes: [
        { data: { id: 'first-exec', label: ht('help.workflows.cliResume.firstExec') } },
        { data: { id: 'save-context', label: ht('help.workflows.cliResume.saveContext') } },
        { data: { id: 'resume-cmd', label: ht('help.workflows.cliResume.resumeCmd') } },
        { data: { id: 'merge', label: ht('help.workflows.cliResume.merge') } },
        { data: { id: 'continue', label: ht('help.workflows.cliResume.continue') } },
        { data: { id: 'split-output', label: ht('help.workflows.cliResume.splitOutput') } },
        { data: { id: 'complete', label: ht('help.workflows.cliResume.complete') } }
      ],
      edges: [
        { data: { source: 'first-exec', target: 'save-context' }, classes: 'next-step' },
        { data: { source: 'save-context', target: 'resume-cmd' }, classes: 'next-step' },
        { data: { source: 'resume-cmd', target: 'merge' }, classes: 'next-step' },
        { data: { source: 'merge', target: 'continue' }, classes: 'next-step' },
        { data: { source: 'continue', target: 'split-output' }, classes: 'next-step' },
        { data: { source: 'split-output', target: 'complete' }, classes: 'next-step' }
      ]
    },
    'bug-fix': {
      nodes: [
        { data: { id: 'start', label: ht('help.workflows.bugFix.start') } },
        { data: { id: 'cli-analyze', label: ht('help.workflows.bugFix.cliAnalyze') } },
        { data: { id: 'lite-fix', label: '/workflow:lite-fix' } },
        { data: { id: 'diagnosis', label: ht('help.workflows.bugFix.diagnosis') } },
        { data: { id: 'impact', label: ht('help.workflows.bugFix.impact') } },
        { data: { id: 'strategy', label: ht('help.workflows.bugFix.strategy') } },
        { data: { id: 'execute', label: ht('help.workflows.bugFix.execute') } },
        { data: { id: 'complete', label: ht('help.workflows.bugFix.complete') } }
      ],
      edges: [
        { data: { source: 'start', target: 'cli-analyze' }, classes: 'next-step' },
        { data: { source: 'cli-analyze', target: 'lite-fix' }, classes: 'next-step' },
        { data: { source: 'lite-fix', target: 'diagnosis' }, classes: 'next-step' },
        { data: { source: 'diagnosis', target: 'impact' }, classes: 'next-step' },
        { data: { source: 'impact', target: 'strategy' }, classes: 'next-step' },
        { data: { source: 'strategy', target: 'execute' }, classes: 'next-step' },
        { data: { source: 'execute', target: 'complete' }, classes: 'next-step' }
      ]
    },
    'plan-full': {
      nodes: [
        { data: { id: 'start', label: ht('help.workflows.planFull.start') } },
        { data: { id: 'cli-analyze', label: ht('help.workflows.planFull.cliAnalyze') } },
        { data: { id: 'plan', label: '/workflow:plan' } },
        { data: { id: 'verify', label: '/workflow:plan-verify' } },
        { data: { id: 'execute', label: '/workflow:execute' } },
        { data: { id: 'test', label: '/workflow:test-gen' } },
        { data: { id: 'review', label: '/workflow:review' } },
        { data: { id: 'complete', label: '/workflow:session:complete' } }
      ],
      edges: [
        { data: { source: 'start', target: 'cli-analyze' }, classes: 'next-step' },
        { data: { source: 'cli-analyze', target: 'plan' }, classes: 'next-step' },
        { data: { source: 'plan', target: 'verify' }, classes: 'next-step' },
        { data: { source: 'verify', target: 'execute' }, classes: 'next-step' },
        { data: { source: 'execute', target: 'test' }, classes: 'next-step' },
        { data: { source: 'test', target: 'review' }, classes: 'next-step' },
        { data: { source: 'review', target: 'complete' }, classes: 'next-step' }
      ]
    },
    'lite': {
      nodes: [
        { data: { id: 'start', label: ht('help.workflows.lite.start') } },
        { data: { id: 'lite-plan', label: '/workflow:lite-plan' } },
        { data: { id: 'confirm', label: ht('help.workflows.lite.confirm') } },
        { data: { id: 'lite-execute', label: '/workflow:lite-execute' } },
        { data: { id: 'complete', label: ht('help.workflows.lite.complete') } }
      ],
      edges: [
        { data: { source: 'start', target: 'lite-plan' }, classes: 'next-step' },
        { data: { source: 'lite-plan', target: 'confirm' }, classes: 'next-step' },
        { data: { source: 'confirm', target: 'lite-execute' }, classes: 'next-step' },
        { data: { source: 'lite-execute', target: 'complete' }, classes: 'next-step' }
      ]
    },
    'tdd': {
      nodes: [
        { data: { id: 'start', label: ht('help.workflows.tdd.start') } },
        { data: { id: 'tdd-plan', label: '/workflow:tdd-plan' } },
        { data: { id: 'red', label: ht('help.workflows.tdd.red') } },
        { data: { id: 'green', label: ht('help.workflows.tdd.green') } },
        { data: { id: 'refactor', label: ht('help.workflows.tdd.refactor') } },
        { data: { id: 'verify', label: '/workflow:tdd-verify' } },
        { data: { id: 'complete', label: ht('help.workflows.tdd.complete') } }
      ],
      edges: [
        { data: { source: 'start', target: 'tdd-plan' }, classes: 'next-step' },
        { data: { source: 'tdd-plan', target: 'red' }, classes: 'next-step' },
        { data: { source: 'red', target: 'green' }, classes: 'next-step' },
        { data: { source: 'green', target: 'refactor' }, classes: 'next-step' },
        { data: { source: 'refactor', target: 'verify' }, classes: 'next-step' },
        { data: { source: 'verify', target: 'complete' }, classes: 'next-step' }
      ]
    }
  };

  var workflowData = workflows[workflow] || workflows['decision'];
  console.log('Building workflow diagram for:', workflow);
  console.log('Generated graph:', workflowData.nodes.length, 'nodes,', workflowData.edges.length, 'edges');

  return workflowData.nodes.concat(workflowData.edges);
}

function showCommandTooltip(commandName, node) {
  // Find command in helpData
  var command = helpData.commands.find(function(cmd) {
    return cmd.command === '/' + commandName;
  });

  if (command) {
    alert(command.command + '\n\n' + command.description);
  }
}

// ========== CodexLens Quick Start ==========
function renderCodexLensQuickStart() {
  var container = document.getElementById('helpTabContent');
  if (!container) return;

  var data = helpData.codexlens;

  var html = `
    <div class="codexlens-quickstart">
      <div class="mb-6">
        <h3 class="text-xl font-bold text-foreground mb-2">${ht('help.codexlens.title')}</h3>
        <p class="text-muted-foreground">${ht('help.codexlens.subtitle')}</p>
      </div>

      ${data.sections ? data.sections.map(function(section) {
        return `
          <div class="mb-8">
            <h4 class="text-lg font-semibold text-foreground mb-4">${escapeHtml(section.title)}</h4>
            <div class="space-y-4">
              ${section.items.map(function(item) {
                return `
                  <div class="bg-background border border-border rounded-lg p-4">
                    ${item.name ? `<h5 class="font-medium text-foreground mb-2">${escapeHtml(item.name)}</h5>` : ''}
                    <p class="text-sm text-muted-foreground mb-2">${escapeHtml(item.description)}</p>
                    ${item.command ? `
                      <div class="bg-muted rounded p-3 mt-2">
                        <code class="text-xs font-mono text-foreground">${escapeHtml(item.command)}</code>
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('') : ''}

      ${data.links && data.links.length > 0 ? `
        <div class="mt-8 p-4 bg-muted rounded-lg">
          <h4 class="text-sm font-semibold text-foreground mb-3">Additional Resources</h4>
          <div class="space-y-2">
            ${data.links.map(function(link) {
              return `
                <a href="${escapeHtml(link.url)}" class="block text-sm text-primary hover:underline">
                  <i data-lucide="external-link" class="w-3 h-3 inline-block mr-1"></i>
                  ${escapeHtml(link.text)}
                </a>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  container.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ========== Command Detail Modal ==========
function showCommandDetailModal(cmd) {
  var modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
  modal.id = 'commandDetailModal';

  var difficultyColor = {
    'Beginner': 'bg-success/10 text-success',
    'Intermediate': 'bg-warning/10 text-warning',
    'Advanced': 'bg-error/10 text-error'
  }[cmd.difficulty] || 'bg-muted/10 text-muted-foreground';

  var sourceLink = cmd.source ? cmd.source.replace(/\.\.\/..\/..\//g, '') : '';

  var html = `
    <div class="bg-card border border-border rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-start justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-2">
            <code class="text-lg font-mono text-primary font-bold">${escapeHtml(cmd.command)}</code>
            <span class="text-xs px-3 py-1 rounded-full ${difficultyColor} font-medium">${escapeHtml(cmd.difficulty || 'Intermediate')}</span>
          </div>
          <p class="text-sm text-muted-foreground">${escapeHtml(cmd.category || 'general')}${cmd.subcategory ? ' / ' + escapeHtml(cmd.subcategory) : ''}</p>
        </div>
        <button class="close-modal text-muted-foreground hover:text-foreground transition-colors" title="Close">
          <i data-lucide="x" class="w-6 h-6"></i>
        </button>
      </div>

      <!-- Content - Tabs -->
      <div class="border-b border-border flex">
        <button class="detail-tab active px-4 py-3 text-sm font-medium transition-colors border-b-2 border-primary" data-tab="overview">
          Overview
        </button>
        ${cmd.source ? `
        <button class="detail-tab px-4 py-3 text-sm font-medium transition-colors border-b-2 border-transparent text-muted-foreground hover:text-foreground" data-tab="document">
          <i data-lucide="file-text" class="w-4 h-4 inline-block mr-1"></i>
          Full Document
        </button>
        ` : ''}
      </div>

      <!-- Tab Content -->
      <div class="flex-1 overflow-y-auto">
        <!-- Overview Tab -->
        <div id="overview-tab" class="detail-tab-content p-6 space-y-6">
          <!-- Description -->
          <div>
            <h3 class="text-sm font-semibold text-foreground mb-2">Description</h3>
            <p class="text-sm text-muted-foreground leading-relaxed">${escapeHtml(cmd.description || 'No description available')}</p>
          </div>

          <!-- Usage Scenario -->
          ${cmd.usage_scenario ? `
          <div>
            <h3 class="text-sm font-semibold text-foreground mb-2">Use Case</h3>
            <p class="text-sm text-muted-foreground">${escapeHtml(cmd.usage_scenario)}</p>
          </div>
          ` : ''}

          <!-- Arguments -->
          ${cmd.arguments ? `
          <div>
            <h3 class="text-sm font-semibold text-foreground mb-2">Arguments</h3>
            <div class="bg-background rounded-lg p-3 border border-border">
              <code class="text-xs font-mono text-foreground">${escapeHtml(cmd.arguments)}</code>
            </div>
          </div>
          ` : ''}

          <!-- Flow Information -->
          ${cmd.flow ? `
          <div>
            <h3 class="text-sm font-semibold text-foreground mb-3">Workflow</h3>
            <div class="space-y-2">
              ${cmd.flow.prerequisites ? `
              <div class="text-xs">
                <span class="text-muted-foreground">Prerequisites:</span>
                <div class="mt-1 space-y-1">
                  ${cmd.flow.prerequisites.map(p => `
                    <div class="inline-block px-2 py-1 bg-primary/10 text-primary rounded text-xs mr-2">
                      ${escapeHtml(p)}
                    </div>
                  `).join('')}
                </div>
              </div>
              ` : ''}

              ${cmd.flow.next_steps ? `
              <div class="text-xs">
                <span class="text-muted-foreground">Next Steps:</span>
                <div class="mt-1 space-y-1">
                  ${cmd.flow.next_steps.map(n => `
                    <div class="inline-block px-2 py-1 bg-success/10 text-success rounded text-xs mr-2">
                      ${escapeHtml(n)}
                    </div>
                  `).join('')}
                </div>
              </div>
              ` : ''}

              ${cmd.flow.alternatives ? `
              <div class="text-xs">
                <span class="text-muted-foreground">Alternatives:</span>
                <div class="mt-1 space-y-1">
                  ${cmd.flow.alternatives.map(a => `
                    <div class="inline-block px-2 py-1 bg-warning/10 text-warning rounded text-xs mr-2">
                      ${escapeHtml(a)}
                    </div>
                  `).join('')}
                </div>
              </div>
              ` : ''}
            </div>
          </div>
          ` : ''}

          <!-- Source -->
          ${sourceLink ? `
          <div>
            <h3 class="text-sm font-semibold text-foreground mb-2">Source File</h3>
            <div class="text-xs text-muted-foreground font-mono break-all">${escapeHtml(sourceLink)}</div>
          </div>
          ` : ''}
        </div>

        <!-- Document Tab -->
        ${cmd.source ? `
        <div id="document-tab" class="detail-tab-content hidden p-6">
          <div class="bg-background border border-border rounded-lg p-4">
            <div id="document-loader" class="flex items-center justify-center py-8">
              <i data-lucide="loader-2" class="w-5 h-5 animate-spin text-primary mr-2"></i>
              <span class="text-sm text-muted-foreground">Loading document...</span>
            </div>
            <div id="document-content" class="hidden prose prose-invert max-w-none text-sm">
              <!-- Markdown content will be loaded here -->
            </div>
            <div id="document-error" class="hidden text-sm text-error">
              Failed to load document
            </div>
          </div>
        </div>
        ` : ''}
      </div>

      <!-- Footer -->
      <div class="border-t border-border px-6 py-3 flex gap-2 justify-end bg-background rounded-b-lg">
        <button class="close-modal px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors">
          Close
        </button>
      </div>
    </div>
  `;

  modal.innerHTML = html;
  document.body.appendChild(modal);

  // Initialize tab switching
  var tabButtons = modal.querySelectorAll('.detail-tab');
  tabButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var tabName = this.getAttribute('data-tab');

      // Update active tab button
      tabButtons.forEach(function(b) {
        b.classList.remove('active', 'border-primary', 'text-foreground');
        b.classList.add('border-transparent', 'text-muted-foreground');
      });
      this.classList.add('active', 'border-primary', 'text-foreground');
      this.classList.remove('border-transparent', 'text-muted-foreground');

      // Show/hide tab content
      var tabContents = modal.querySelectorAll('.detail-tab-content');
      tabContents.forEach(function(content) {
        content.classList.add('hidden');
      });
      var activeTab = modal.querySelector('#' + tabName + '-tab');
      if (activeTab) {
        activeTab.classList.remove('hidden');
      }

      // Load document content if needed
      if (tabName === 'document' && cmd.source) {
        loadCommandDocument(modal, cmd.source);
      }
    });
  });

  // Close handlers
  var closeButtons = modal.querySelectorAll('.close-modal');
  closeButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      modal.remove();
    });
  });

  // Close on background click
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Close on Escape key
  var closeOnEscape = function(e) {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', closeOnEscape);
    }
  };
  document.addEventListener('keydown', closeOnEscape);

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ========== Load Command Document ==========
function loadCommandDocument(modal, sourcePath) {
  var contentDiv = modal.querySelector('#document-content');
  var loaderDiv = modal.querySelector('#document-loader');
  var errorDiv = modal.querySelector('#document-error');

  // Check if already loaded
  if (contentDiv && !contentDiv.classList.contains('hidden')) {
    return;
  }

  // Start loading
  if (loaderDiv) loaderDiv.classList.remove('hidden');
  if (errorDiv) errorDiv.classList.add('hidden');
  if (contentDiv) contentDiv.classList.add('hidden');

  // Fetch document content
  fetch('/api/help/command-content?source=' + encodeURIComponent(sourcePath))
    .then(function(response) {
      if (!response.ok) {
        throw new Error('Failed to load document');
      }
      return response.text();
    })
    .then(function(markdown) {
      // Parse markdown to HTML
      var html = parseMarkdown(markdown);

      if (contentDiv) {
        contentDiv.innerHTML = html;
        contentDiv.classList.remove('hidden');
      }
      if (loaderDiv) loaderDiv.classList.add('hidden');

      if (typeof lucide !== 'undefined') lucide.createIcons();
    })
    .catch(function(error) {
      console.error('Failed to load document:', error);
      if (errorDiv) {
        errorDiv.classList.remove('hidden');
      }
      if (loaderDiv) loaderDiv.classList.add('hidden');
    });
}

// ========== Markdown Parser (Simple) ==========
function parseMarkdown(markdown) {
  // Remove frontmatter
  var lines = markdown.split('\n');
  var startIdx = 0;
  if (lines[0] === '---') {
    for (var i = 1; i < lines.length; i++) {
      if (lines[i] === '---') {
        startIdx = i + 1;
        break;
      }
    }
  }

  var content = lines.slice(startIdx).join('\n').trim();

  var html = '';
  var currentList = null;
  var inCodeBlock = false;
  var codeBlockContent = '';
  var codeBlockLang = '';

  lines = content.split('\n');

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    // Code blocks
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.substring(3).trim();
        codeBlockContent = '';
      } else {
        inCodeBlock = false;
        var langClass = codeBlockLang ? ' language-' + escapeHtml(codeBlockLang) : '';
        html += '<pre class="bg-background border border-border rounded-lg p-4 overflow-x-auto my-3"><code class="text-xs font-mono text-foreground' + langClass + '">' +
                escapeHtml(codeBlockContent).replace(/\n/g, '<br>') + '</code></pre>';
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent += line + '\n';
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      html += '<h1 class="text-2xl font-bold text-foreground mt-6 mb-3">' + escapeHtml(line.substring(2)) + '</h1>';
      continue;
    }
    if (line.startsWith('## ')) {
      html += '<h2 class="text-xl font-bold text-foreground mt-5 mb-2">' + escapeHtml(line.substring(3)) + '</h2>';
      continue;
    }
    if (line.startsWith('### ')) {
      html += '<h3 class="text-lg font-semibold text-foreground mt-4 mb-2">' + escapeHtml(line.substring(4)) + '</h3>';
      continue;
    }

    // Lists
    if (line.match(/^[\s]*[-*+]\s/)) {
      var listContent = line.replace(/^[\s]*[-*+]\s/, '');
      if (currentList !== 'ul') {
        if (currentList === 'ol') html += '</ol>';
        html += '<ul class="list-disc list-inside text-sm text-muted-foreground space-y-1 my-2">';
        currentList = 'ul';
      }
      html += '<li>' + escapeHtml(listContent) + '</li>';
      continue;
    }

    if (line.match(/^[\s]*\d+\.\s/)) {
      var listContent = line.replace(/^[\s]*\d+\.\s/, '');
      if (currentList !== 'ol') {
        if (currentList === 'ul') html += '</ul>';
        html += '<ol class="list-decimal list-inside text-sm text-muted-foreground space-y-1 my-2">';
        currentList = 'ol';
      }
      html += '<li>' + escapeHtml(listContent) + '</li>';
      continue;
    }

    // Close list if we encounter non-list content
    if (line.trim() && (currentList === 'ul' || currentList === 'ol')) {
      html += currentList === 'ul' ? '</ul>' : '</ol>';
      currentList = null;
    }

    // Paragraphs
    if (line.trim()) {
      // Convert inline formatting
      var formatted = line
        .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>')
        .replace(/`([^`]+)`/g, '<code class="bg-background px-1 rounded text-xs font-mono text-primary">$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline">$1</a>');

      html += '<p class="text-sm text-muted-foreground leading-relaxed my-2">' + formatted + '</p>';
    }
  }

  // Close any open lists
  if (currentList === 'ul') html += '</ul>';
  if (currentList === 'ol') html += '</ol>';

  return html;
}

// ========== Command Card Click Handlers ==========
function initializeCommandCardHandlers() {
  var cards = document.querySelectorAll('.command-card');
  cards.forEach(function(card) {
    card.addEventListener('click', function(e) {
      e.preventDefault();
      var cmdJson = this.getAttribute('data-command');
      if (cmdJson) {
        try {
          var cmd = JSON.parse(unescapeHtml(cmdJson));
          showCommandDetailModal(cmd);
        } catch (err) {
          console.error('Failed to parse command data:', err);
        }
      }
    });
  });
}

// Helper function to unescape HTML
function unescapeHtml(html) {
  var map = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'"
  };
  return html.replace(/&(?:amp|lt|gt|quot|#039);/g, function(match) {
    return map[match];
  });
}
