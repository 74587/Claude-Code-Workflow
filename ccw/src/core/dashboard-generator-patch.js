// Add after line 13 (after REVIEW_TEMPLATE constant)

// Modular dashboard JS files (in dependency order)
const MODULE_FILES = [
  // Base (no dependencies)
  'dashboard-js/state.js',
  'dashboard-js/utils.js',
  'dashboard-js/api.js',
  // Components (independent)
  'dashboard-js/components/theme.js',
  'dashboard-js/components/sidebar.js',
  'dashboard-js/components/modals.js',
  'dashboard-js/components/flowchart.js',
  // Components (dependent)
  'dashboard-js/components/task-drawer-renderers.js',
  'dashboard-js/components/task-drawer-core.js',
  'dashboard-js/components/tabs-context.js',
  'dashboard-js/components/tabs-other.js',
  // Views
  'dashboard-js/views/home.js',
  'dashboard-js/views/project-overview.js',
  'dashboard-js/views/review-session.js',
  'dashboard-js/views/fix-session.js',
  'dashboard-js/views/lite-tasks.js',
  'dashboard-js/views/session-detail.js',
  // Navigation & Main
  'dashboard-js/components/navigation.js',
  'dashboard-js/main.js'
];
