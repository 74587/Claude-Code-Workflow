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
var activeWorkflowDiagram = 'tdd';

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
}

function renderCommandCard(cmd) {
  var difficultyColor = {
    'Beginner': 'bg-success-light text-success',
    'Intermediate': 'bg-warning-light text-warning',
    'Advanced': 'bg-error-light text-error'
  }[cmd.difficulty] || 'bg-muted text-muted-foreground';

  return `
    <div class="bg-background border border-border rounded-lg p-4 hover:border-primary transition-colors">
      <div class="flex items-start justify-between mb-2">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            <code class="text-sm font-mono text-primary font-semibold">${escapeHtml(cmd.command)}</code>
            <span class="text-xs px-2 py-0.5 rounded ${difficultyColor}">${escapeHtml(cmd.difficulty)}</span>
          </div>
          <p class="text-sm text-muted-foreground">${escapeHtml(cmd.description)}</p>
        </div>
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
          <button class="workflow-diagram-btn px-4 py-2 rounded-lg text-sm font-medium transition-colors" data-workflow="tdd">
            ${ht('help.diagrams.tdd')}
          </button>
          <button class="workflow-diagram-btn px-4 py-2 rounded-lg text-sm font-medium transition-colors" data-workflow="feature">
            ${ht('help.diagrams.feature')}
          </button>
          <button class="workflow-diagram-btn px-4 py-2 rounded-lg text-sm font-medium transition-colors" data-workflow="bugfix">
            ${ht('help.diagrams.bugfix')}
          </button>
          <button class="workflow-diagram-btn px-4 py-2 rounded-lg text-sm font-medium transition-colors" data-workflow="review">
            ${ht('help.diagrams.review')}
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

  // Initialize Cytoscape
  cytoscapeInstance = cytoscape({
    container: container,
    elements: graphData,
    style: [
      {
        selector: 'node',
        style: {
          'background-color': 'hsl(var(--primary))',
          'label': 'data(label)',
          'color': 'hsl(var(--foreground))',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '12px',
          'width': '80px',
          'height': '80px',
          'text-wrap': 'wrap',
          'text-max-width': '70px'
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 2,
          'line-color': 'hsl(var(--muted-foreground))',
          'target-arrow-color': 'hsl(var(--muted-foreground))',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'label': 'data(label)',
          'font-size': '10px',
          'color': 'hsl(var(--muted-foreground))'
        }
      },
      {
        selector: 'edge.prerequisite',
        style: {
          'line-color': 'hsl(var(--primary))',
          'target-arrow-color': 'hsl(var(--primary))'
        }
      },
      {
        selector: 'edge.next-step',
        style: {
          'line-color': '#10B981',
          'target-arrow-color': '#10B981'
        }
      },
      {
        selector: 'edge.alternative',
        style: {
          'line-color': '#F59E0B',
          'target-arrow-color': '#F59E0B',
          'line-style': 'dashed'
        }
      }
    ],
    layout: {
      name: 'dagre',
      rankDir: 'TB',
      nodeSep: 50,
      rankSep: 80
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
  var nodes = [];
  var edges = [];

  var workflows = {
    'tdd': ['workflow:tdd-plan', 'workflow:execute', 'workflow:tdd-verify'],
    'feature': ['workflow:plan', 'workflow:action-plan-verify', 'workflow:execute', 'workflow:review'],
    'bugfix': ['workflow:lite-fix', 'workflow:lite-execute', 'workflow:test-cycle-execute'],
    'review': ['workflow:review-session-cycle', 'workflow:review-fix', 'workflow:test-cycle-execute']
  };

  var workflowCommands = workflows[workflow] || workflows['tdd'];

  console.log('Building workflow diagram for:', workflow);
  console.log('Commands:', workflowCommands);
  console.log('Available workflows data:', helpData.workflows ? Object.keys(helpData.workflows).length + ' commands' : 'no data');

  // Build graph from workflow relationships
  workflowCommands.forEach(function(cmd) {
    nodes.push({ data: { id: cmd, label: cmd.replace('workflow:', '').replace('task:', '') } });

    var relationships = helpData.workflows ? helpData.workflows[cmd] : null;
    if (relationships) {
      // Add prerequisites
      if (relationships.prerequisites) {
        relationships.prerequisites.forEach(function(prereq) {
          if (!nodes.find(n => n.data.id === prereq)) {
            nodes.push({ data: { id: prereq, label: prereq.replace('workflow:', '').replace('task:', '') } });
          }
          edges.push({
            data: { source: prereq, target: cmd, label: 'requires' },
            classes: 'prerequisite'
          });
        });
      }

      // Add next steps
      if (relationships.next_steps) {
        relationships.next_steps.forEach(function(next) {
          if (!nodes.find(n => n.data.id === next)) {
            nodes.push({ data: { id: next, label: next.replace('workflow:', '').replace('task:', '') } });
          }
          edges.push({
            data: { source: cmd, target: next, label: 'then' },
            classes: 'next-step'
          });
        });
      }

      // Add alternatives
      if (relationships.alternatives) {
        relationships.alternatives.forEach(function(alt) {
          if (!nodes.find(n => n.data.id === alt)) {
            nodes.push({ data: { id: alt, label: alt.replace('workflow:', '').replace('task:', '') } });
          }
          edges.push({
            data: { source: cmd, target: alt, label: 'or' },
            classes: 'alternative'
          });
        });
      }
    }
  });

  console.log('Generated graph:', nodes.length, 'nodes,', edges.length, 'edges');
  
  // If no edges but we have nodes, create a simple chain
  if (edges.length === 0 && nodes.length > 1) {
    console.log('No relationships found, creating simple chain');
    for (var i = 0; i < nodes.length - 1; i++) {
      edges.push({
        data: { source: nodes[i].data.id, target: nodes[i + 1].data.id },
        classes: 'next-step'
      });
    }
  }

  return nodes.concat(edges);
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
