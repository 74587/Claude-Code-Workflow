// ========================================
// State Management
// ========================================
// Global state variables and template placeholders
// This module must be loaded first as other modules depend on these variables

// ========== Data Placeholders ==========
// These placeholders are replaced by the dashboard generator at build time
let workflowData = {{WORKFLOW_DATA}};
let projectPath = '{{PROJECT_PATH}}';
let recentPaths = {{RECENT_PATHS}};

// ========== Application State ==========
// Current filter for session list view ('all', 'active', 'archived')
let currentFilter = 'all';

// Current lite task type ('lite-plan', 'lite-fix', or null)
let currentLiteType = null;

// Current view mode ('sessions', 'liteTasks', 'project-overview', 'sessionDetail', 'liteTaskDetail')
let currentView = 'sessions';

// Current session detail key (null when not in detail view)
let currentSessionDetailKey = null;

// ========== Data Stores ==========
// Store session data for modal/detail access
// Key: session key, Value: session data object
const sessionDataStore = {};

// Store lite task session data for detail page access
// Key: session key, Value: lite session data object
const liteTaskDataStore = {};

// Store task JSON data in a global map instead of inline script tags
// Key: unique task ID, Value: raw task JSON data
const taskJsonStore = {};
