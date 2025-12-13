// ============================================
// I18N - Internationalization Module
// ============================================
// Supports English and Chinese (Simplified)

// Current language (default: detect from browser or use 'en')
let currentLang = 'en';

// Translation dictionaries
const i18n = {
  en: {
    // App title and brand
    'app.title': 'CCW Dashboard',
    'app.brand': 'Claude Code Workflow',
    
    // Header
    'header.project': 'Project:',
    'header.recentProjects': 'Recent Projects',
    'header.browse': 'Browse...',
    'header.refreshWorkspace': 'Refresh workspace',
    'header.toggleTheme': 'Toggle theme',
    'header.language': 'Language',
    
    // Sidebar - Project section
    'nav.project': 'Project',
    'nav.overview': 'Overview',
    'nav.explorer': 'Explorer',
    'nav.status': 'Status',
    'nav.history': 'History',
    'nav.memory': 'Memory',
    'nav.contextMemory': 'Context',
    'nav.promptHistory': 'Prompts',
    
    // Sidebar - Sessions section
    'nav.sessions': 'Sessions',
    'nav.all': 'All',
    'nav.active': 'Active',
    'nav.archived': 'Archived',
    
    // Sidebar - Lite Tasks section
    'nav.liteTasks': 'Lite Tasks',
    'nav.litePlan': 'Lite Plan',
    'nav.liteFix': 'Lite Fix',
    
    // Sidebar - MCP section
    'nav.mcpServers': 'MCP Servers',
    'nav.manage': 'Manage',
    
    // Sidebar - Hooks section
    'nav.hooks': 'Hooks',
    
    // Sidebar - Footer
    'nav.collapse': 'Collapse',
    'nav.expand': 'Expand',
    
    // Stats cards
    'stats.totalSessions': 'Total Sessions',
    'stats.activeSessions': 'Active Sessions',
    'stats.totalTasks': 'Total Tasks',
    'stats.completedTasks': 'Completed Tasks',
    
    // Carousel
    'carousel.noActiveSessions': 'No active sessions',
    'carousel.previous': 'Previous',
    'carousel.next': 'Next',
    'carousel.pause': 'Pause auto-play',
    
    // Content titles
    'title.allSessions': 'All Sessions',
    'title.activeSessions': 'Active Sessions',
    'title.archivedSessions': 'Archived Sessions',
    'title.sessions': 'Sessions',
    'title.projectOverview': 'Project Overview',
    'title.mcpManagement': 'MCP Server Management',
    'title.fileExplorer': 'File Explorer',
    'title.cliTools': 'CLI Tools & CCW',
    'title.cliHistory': 'CLI Execution History',
    'title.litePlanSessions': 'Lite Plan Sessions',
    'title.liteFixSessions': 'Lite Fix Sessions',
    'title.liteTasks': 'Lite Tasks',
    'title.sessionDetail': 'Session Detail',
    'title.liteTaskDetail': 'Lite Task Detail',
    'title.hookManager': 'Hook Manager',
    'title.memoryModule': 'Memory Module',
    'title.promptHistory': 'Prompt History',
    
    // Search
    'search.placeholder': 'Search...',
    
    // Session cards
    'session.status.active': 'ACTIVE',
    'session.status.archived': 'ARCHIVED',
    'session.status.planning': 'PLANNING',
    'session.tasks': 'tasks',
    'session.findings': 'findings',
    'session.dimensions': 'dimensions',
    'session.progress': 'Progress',
    
    // Empty states
    'empty.noSessions': 'No Sessions Found',
    'empty.noSessionsText': 'No workflow sessions match your current filter.',
    'empty.noTasks': 'No Tasks',
    'empty.noTasksText': 'This session has no tasks defined.',
    'empty.noTaskFiles': 'No Task Files',
    'empty.noTaskFilesText': 'No IMPL-*.json files found in .task/',
    'empty.noLiteSessions': 'No {type} Sessions',
    'empty.noLiteSessionsText': 'No sessions found in .workflow/.{type}/',
    'empty.noMcpServers': 'No MCP servers configured for this project',
    'empty.addMcpServersHint': 'Add servers from the available list below',
    'empty.noAdditionalMcp': 'No additional MCP servers found in other projects',
    'empty.noHooks': 'No hooks configured for this project',
    'empty.createHookHint': 'Create a hook to automate actions on tool usage',
    'empty.noGlobalHooks': 'No global hooks configured',
    'empty.globalHooksHint': 'Global hooks apply to all Claude Code sessions',
    'empty.noDiagnoses': 'No Diagnoses',
    'empty.noDiagnosesText': 'No diagnosis-*.json files found for this session.',
    
    // Session detail tabs
    'tab.tasks': 'Tasks',
    'tab.context': 'Context',
    'tab.summary': 'Summary',
    'tab.implPlan': 'IMPL Plan',
    'tab.conflict': 'Conflict',
    'tab.review': 'Review',
    'tab.plan': 'Plan',
    'tab.diagnoses': 'Diagnoses',
    
    // Session detail
    'detail.backToSessions': 'Back to Sessions',
    'detail.backToLiteTasks': 'Back to {type}',
    'detail.created': 'Created:',
    'detail.archived': 'Archived:',
    'detail.project': 'Project:',
    'detail.tasks': 'Tasks:',
    'detail.completed': 'completed',
    
    // Task status
    'task.status.pending': 'Pending',
    'task.status.inProgress': 'In Progress',
    'task.status.completed': 'Completed',
    'task.completed': 'completed',
    'task.inProgress': 'in progress',
    'task.pending': 'pending',
    
    // Task actions
    'task.quickActions': 'Quick Actions:',
    'task.allPending': 'All Pending',
    'task.allInProgress': 'All In Progress',
    'task.allCompleted': 'All Completed',
    'task.setAllConfirm': 'Set all {count} tasks to "{status}"?',
    'task.statusUpdated': 'Task {id} status updated',
    'task.tasksUpdated': 'All {count} tasks updated',
    'task.noPendingTasks': 'No pending tasks to start',
    'task.noInProgressTasks': 'No in-progress tasks to complete',
    'task.movedToInProgress': '{count} tasks moved to In Progress',
    'task.tasksCompleted': '{count} tasks completed',
    
    // Context tab
    'context.description': 'description:',
    'context.requirements': 'requirements:',
    'context.focusPaths': 'focus_paths:',
    'context.modificationPoints': 'modification_points:',
    'context.acceptance': 'acceptance:',
    'context.noData': 'No context data',
    'context.loading': 'Loading context data...',
    'context.loadError': 'Failed to load context: {error}',
    
    // Flow control
    'flow.implementationApproach': 'implementation_approach:',
    'flow.preAnalysis': 'pre_analysis:',
    'flow.targetFiles': 'target_files:',
    'flow.noData': 'No flow control data',
    
    // Summary tab
    'summary.loading': 'Loading summaries...',
    'summary.title': 'Summaries',
    'summary.hint': 'Session summaries will be loaded from .summaries/',
    'summary.noSummaries': 'No Summaries',
    'summary.noSummariesText': 'No summaries found in .summaries/',
    
    // IMPL Plan tab
    'implPlan.loading': 'Loading IMPL plan...',
    'implPlan.title': 'IMPL Plan',
    'implPlan.hint': 'IMPL plan will be loaded from IMPL_PLAN.md',
    
    // Review tab
    'review.loading': 'Loading review data...',
    'review.title': 'Review Data',
    'review.hint': 'Review data will be loaded from review files',
    
    // CLI Manager
    'cli.tools': 'CLI Tools',
    'cli.available': 'available',
    'cli.refreshStatus': 'Refresh Status',
    'cli.ready': 'Ready',
    'cli.notInstalled': 'Not Installed',
    'cli.setDefault': 'Set Default',
    'cli.default': 'Default',
    'cli.install': 'Install',
    'cli.initIndex': 'Init Index',
    'cli.geminiDesc': 'Google AI for code analysis',
    'cli.qwenDesc': 'Alibaba AI assistant',
    'cli.codexDesc': 'OpenAI code generation',
    'cli.codexLensDesc': 'Code indexing & FTS search',
    'cli.codexLensDescFull': 'Full-text code search engine',
    'cli.semanticDesc': 'AI-powered code understanding',
    'cli.semanticDescFull': 'Natural language code search',
    'cli.settings': 'CLI Execution Settings',
    'cli.promptFormat': 'Prompt Format',
    'cli.promptFormatDesc': 'Format for multi-turn conversation concatenation',
    'cli.storageBackend': 'Storage Backend',
    'cli.storageBackendDesc': 'CLI history stored in SQLite with FTS search',
    'cli.smartContext': 'Smart Context',
    'cli.smartContextDesc': 'Auto-analyze prompt and add relevant file paths',
    'cli.nativeResume': 'Native Resume',
    'cli.nativeResumeDesc': 'Use native tool resume (gemini -r, qwen --resume, codex resume)',
    'cli.maxContextFiles': 'Max Context Files',
    'cli.maxContextFilesDesc': 'Maximum files to include in smart context',
    
    // CCW Install
    'ccw.install': 'CCW Install',
    'ccw.installations': 'installation',
    'ccw.installationsPlural': 'installations',
    'ccw.noInstallations': 'No installations found',
    'ccw.installCcw': 'Install CCW',
    'ccw.upgrade': 'Upgrade',
    'ccw.uninstall': 'Uninstall',
    'ccw.files': 'files',
    'ccw.globalInstall': 'Global Installation',
    'ccw.globalInstallDesc': 'Install to user home directory (~/.claude)',
    'ccw.pathInstall': 'Path Installation',
    'ccw.pathInstallDesc': 'Install to a specific project folder',
    'ccw.installPath': 'Installation Path',
    'ccw.installToPath': 'Install to Path',
    'ccw.uninstallConfirm': 'Uninstall CCW from this location?',
    'ccw.upgradeStarting': 'Starting upgrade...',
    'ccw.upgradeCompleted': 'Upgrade completed! Refreshing...',
    'ccw.upgradeFailed': 'Upgrade failed: {error}',
    
    // CCW Endpoint Tools
    'ccw.endpointTools': 'CCW Endpoint Tools',
    'ccw.tool': 'tool',
    'ccw.tools': 'tools',
    'ccw.noEndpointTools': 'No endpoint tools found',
    'ccw.parameters': 'Parameters',
    'ccw.required': 'required',
    'ccw.optional': 'optional',
    'ccw.default': 'Default:',
    'ccw.options': 'Options:',
    'ccw.noParams': 'This tool has no parameters',
    'ccw.usageExample': 'Usage Example',
    'ccw.endpointTool': 'endpoint tool',
    
    // Explorer
    'explorer.title': 'Explorer',
    'explorer.refresh': 'Refresh',
    'explorer.selectFile': 'Select a file to preview',
    'explorer.selectFileHint': 'Select a file from the tree to preview its contents',
    'explorer.loading': 'Loading file tree...',
    'explorer.loadingFile': 'Loading file...',
    'explorer.emptyDir': 'Empty directory',
    'explorer.loadError': 'Failed to load: {error}',
    'explorer.preview': 'Preview',
    'explorer.source': 'Source',
    'explorer.lines': 'lines',
    'explorer.updateClaudeMd': 'Update CLAUDE.md',
    'explorer.currentFolderOnly': 'Update CLAUDE.md (current folder only)',
    'explorer.withSubdirs': 'Update CLAUDE.md (with subdirectories)',
    
    // Task Queue
    'taskQueue.title': 'Update Tasks',
    'taskQueue.cli': 'CLI:',
    'taskQueue.addTask': 'Add update task',
    'taskQueue.startAll': 'Start all tasks',
    'taskQueue.clearCompleted': 'Clear completed',
    'taskQueue.noTasks': 'No tasks in queue',
    'taskQueue.noTasksHint': 'Hover folder and click icons to add tasks',
    'taskQueue.processing': 'Processing...',
    'taskQueue.updated': 'Updated successfully',
    'taskQueue.failed': 'Update failed',
    'taskQueue.currentOnly': 'Current only',
    'taskQueue.withSubdirs': 'With subdirs',
    'taskQueue.startingTasks': 'Starting {count} task(s) in parallel...',
    'taskQueue.queueCompleted': 'Queue completed: {success} succeeded, {failed} failed',
    
    // Update CLAUDE.md Modal
    'updateClaudeMd.title': 'Update CLAUDE.md',
    'updateClaudeMd.targetDir': 'Target Directory',
    'updateClaudeMd.cliTool': 'CLI Tool',
    'updateClaudeMd.strategy': 'Strategy',
    'updateClaudeMd.singleLayer': 'Single Layer - Current dir + child CLAUDE.md refs',
    'updateClaudeMd.multiLayer': 'Multi Layer - Generate CLAUDE.md in all subdirs',
    'updateClaudeMd.running': 'Running update...',
    'updateClaudeMd.execute': 'Execute',
    'updateClaudeMd.addToQueue': 'Add to Queue',
    'updateClaudeMd.cancel': 'Cancel',
    
    // MCP Manager
    'mcp.currentProject': 'Current Project MCP Servers',
    'mcp.newServer': 'New Server',
    'mcp.serversConfigured': 'servers configured',
    'mcp.enterprise': 'Enterprise MCP Servers',
    'mcp.enterpriseManaged': 'Managed',
    'mcp.enterpriseReadOnly': 'servers (read-only)',
    'mcp.user': 'User MCP Servers',
    'mcp.userServersFrom': 'servers from ~/.claude.json',
    'mcp.availableOther': 'Available from Other Projects',
    'mcp.serversAvailable': 'servers available',
    'mcp.allProjects': 'All Projects MCP Overview',
    'mcp.projects': 'projects',
    'mcp.project': 'Project',
    'mcp.servers': 'MCP Servers',
    'mcp.status': 'Status',
    'mcp.current': '(Current)',
    'mcp.noMcpServers': 'No MCP servers',
    'mcp.add': 'Add',
    'mcp.addToProject': 'Add to Project',
    'mcp.removeFromProject': 'Remove from project',
    'mcp.removeConfirm': 'Remove MCP server "{name}" from this project?',
    'mcp.readOnly': 'Read-only',
    'mcp.usedIn': 'Used in {count} project',
    'mcp.usedInPlural': 'Used in {count} projects',
    'mcp.availableToAll': 'Available to all projects from ~/.claude.json',
    'mcp.managedByOrg': 'Managed by organization (highest priority)',
    'mcp.variables': 'variables',
    
    // MCP Create Modal
    'mcp.createTitle': 'Create MCP Server',
    'mcp.form': 'Form',
    'mcp.json': 'JSON',
    'mcp.serverName': 'Server Name',
    'mcp.serverNamePlaceholder': 'e.g., my-mcp-server',
    'mcp.command': 'Command',
    'mcp.commandPlaceholder': 'e.g., npx, uvx, node, python',
    'mcp.arguments': 'Arguments (one per line)',
    'mcp.envVars': 'Environment Variables (KEY=VALUE per line)',
    'mcp.pasteJson': 'Paste MCP Server JSON Configuration',
    'mcp.jsonFormatsHint': 'Supports {"servers": {...}}, {"mcpServers": {...}}, and direct server config formats.',
    'mcp.previewServers': 'Preview (servers to be added):',
    'mcp.create': 'Create',
    
    // Hook Manager
    'hook.projectHooks': 'Project Hooks',
    'hook.projectFile': '.claude/settings.json',
    'hook.newHook': 'New Hook',
    'hook.hooksConfigured': 'hooks configured',
    'hook.globalHooks': 'Global Hooks',
    'hook.globalFile': '~/.claude/settings.json',
    'hook.wizards': 'Hook Wizards',
    'hook.guidedSetup': 'Guided Setup',
    'hook.wizardsDesc': 'Configure complex hooks with guided wizards',
    'hook.quickInstall': 'Quick Install Templates',
    'hook.oneClick': 'One-click hook installation',
    'hook.envVarsRef': 'Environment Variables Reference',
    'hook.filePaths': 'Space-separated file paths affected',
    'hook.toolName': 'Name of the tool being executed',
    'hook.toolInput': 'JSON input passed to the tool',
    'hook.sessionId': 'Current Claude session ID',
    'hook.projectDir': 'Current project directory path',
    'hook.workingDir': 'Current working directory',
    'hook.openWizard': 'Open Wizard',
    'hook.installed': 'Installed',
    'hook.installProject': 'Install (Project)',
    'hook.installGlobal': 'Global',
    'hook.uninstall': 'Uninstall',
    'hook.viewDetails': 'View template details',
    'hook.edit': 'Edit hook',
    'hook.delete': 'Delete hook',
    'hook.deleteConfirm': 'Remove this {event} hook?',
    
    // Hook Create Modal
    'hook.createTitle': 'Create Hook',
    'hook.event': 'Hook Event',
    'hook.selectEvent': 'Select an event...',
    'hook.preToolUse': 'PreToolUse - Before a tool is executed',
    'hook.postToolUse': 'PostToolUse - After a tool completes',
    'hook.notification': 'Notification - On notifications',
    'hook.stop': 'Stop - When agent stops',
    'hook.matcher': 'Matcher (optional)',
    'hook.matcherPlaceholder': 'e.g., Write, Edit, Bash (leave empty for all)',
    'hook.matcherHint': 'Tool name to match. Leave empty to match all tools.',
    'hook.commandLabel': 'Command',
    'hook.commandPlaceholder': 'e.g., curl, bash, node',
    'hook.argsLabel': 'Arguments (one per line)',
    'hook.scope': 'Scope',
    'hook.scopeProject': 'Project (.claude/settings.json)',
    'hook.scopeGlobal': 'Global (~/.claude/settings.json)',
    'hook.quickTemplates': 'Quick Templates',
    
    // Hook templates
    'hook.template.ccwNotify': 'CCW Notify',
    'hook.template.ccwNotifyDesc': 'Notify dashboard on Write',
    'hook.template.logTool': 'Log Tool Usage',
    'hook.template.logToolDesc': 'Log all tool executions',
    'hook.template.lintCheck': 'Lint Check',
    'hook.template.lintCheckDesc': 'Run eslint on file changes',
    'hook.template.gitAdd': 'Git Add',
    'hook.template.gitAddDesc': 'Auto stage written files',

    // Hook Quick Install Templates
    'hook.tpl.codexlensSync': 'CodexLens Auto-Sync',
    'hook.tpl.codexlensSyncDesc': 'Auto-update code index when files are written or edited',
    'hook.tpl.ccwDashboardNotify': 'CCW Dashboard Notify',
    'hook.tpl.ccwDashboardNotifyDesc': 'Notify CCW dashboard when files are written',
    'hook.tpl.toolLogger': 'Tool Usage Logger',
    'hook.tpl.toolLoggerDesc': 'Log all tool executions to a file',
    'hook.tpl.autoLint': 'Auto Lint Check',
    'hook.tpl.autoLintDesc': 'Run ESLint on JavaScript/TypeScript files after write',
    'hook.tpl.autoGitStage': 'Auto Git Stage',
    'hook.tpl.autoGitStageDesc': 'Automatically stage written files to git',

    // Hook Template Categories
    'hook.category.indexing': 'indexing',
    'hook.category.notification': 'notification',
    'hook.category.logging': 'logging',
    'hook.category.quality': 'quality',
    'hook.category.git': 'git',
    'hook.category.memory': 'memory',
    'hook.category.skill': 'skill',

    // Hook Wizard Templates
    'hook.wizard.memoryUpdate': 'Memory Update Hook',
    'hook.wizard.memoryUpdateDesc': 'Automatically update CLAUDE.md documentation based on code changes',
    'hook.wizard.onSessionEnd': 'On Session End',
    'hook.wizard.onSessionEndDesc': 'Update documentation when Claude session ends',
    'hook.wizard.periodicUpdate': 'Periodic Update',
    'hook.wizard.periodicUpdateDesc': 'Update documentation at regular intervals during session',
    'hook.wizard.skillContext': 'SKILL Context Loader',
    'hook.wizard.skillContextDesc': 'Automatically load SKILL packages based on keywords in user prompts',
    'hook.wizard.keywordMatching': 'Keyword Matching',
    'hook.wizard.keywordMatchingDesc': 'Load specific SKILLs when keywords are detected in prompt',
    'hook.wizard.autoDetection': 'Auto Detection',
    'hook.wizard.autoDetectionDesc': 'Automatically detect and load SKILLs by name in prompt',
    'hook.wizard.memorySetup': 'Memory Module Setup',
    'hook.wizard.memorySetupDesc': 'Configure automatic context tracking (lightweight metadata recording)',
    'hook.wizard.fileReadTracker': 'File Read Tracker',
    'hook.wizard.fileReadTrackerDesc': 'Track file reads to build context heatmap',
    'hook.wizard.fileWriteTracker': 'File Write Tracker',
    'hook.wizard.fileWriteTrackerDesc': 'Track file modifications to identify core modules',
    'hook.wizard.promptTracker': 'Prompt Tracker',
    'hook.wizard.promptTrackerDesc': 'Record user prompts for pattern analysis',
    'hook.wizard.selectTrackers': 'Select Trackers',

    // Hook Wizard Labels
    'hook.wizard.cliTools': 'CLI Tools:',
    'hook.wizard.event': 'Event:',
    'hook.wizard.availableSkills': 'Available SKILLs:',
    'hook.wizard.loading': 'Loading...',
    'hook.wizard.matches': 'Matches:',
    'hook.wizard.whenToTrigger': 'When to Trigger',
    'hook.wizard.configuration': 'Configuration',
    'hook.wizard.commandPreview': 'Generated Command Preview',
    'hook.wizard.installTo': 'Install To',
    'hook.wizard.installHook': 'Install Hook',
    'hook.wizard.noSkillsConfigured': 'No SKILLs configured yet',
    'hook.wizard.clickAddSkill': 'Click "Add SKILL" to configure keyword triggers',
    'hook.wizard.configureSkills': 'Configure SKILLs',
    'hook.wizard.addSkill': 'Add SKILL',
    'hook.wizard.selectSkill': 'Select SKILL...',
    'hook.wizard.triggerKeywords': 'Trigger Keywords (comma-separated)',
    'hook.wizard.autoDetectionMode': 'Auto Detection Mode',
    'hook.wizard.autoDetectionInfo': 'SKILLs will be automatically loaded when their name appears in your prompt.',
    'hook.wizard.noSkillsFound': 'No SKILLs found. Create SKILL packages in .claude/skills/',
    'hook.wizard.noSkillConfigs': '# No SKILL configurations yet',
    'hook.wizard.cliTool': 'CLI Tool',
    'hook.wizard.intervalSeconds': 'Interval (seconds)',
    'hook.wizard.updateStrategy': 'Update Strategy',
    'hook.wizard.toolForDocGen': 'Tool for documentation generation',
    'hook.wizard.timeBetweenUpdates': 'Time between updates',
    'hook.wizard.relatedStrategy': 'Related: changed modules, Single-layer: current directory',
    
    // Lite Tasks
    'lite.plan': 'PLAN',
    'lite.fix': 'FIX',
    'lite.summary': 'Summary',
    'lite.rootCause': 'Root Cause',
    'lite.fixStrategy': 'Fix Strategy',
    'lite.approach': 'Approach',
    'lite.userRequirements': 'User Requirements',
    'lite.focusPaths': 'Focus Paths',
    'lite.metadata': 'Metadata',
    'lite.severity': 'Severity:',
    'lite.riskLevel': 'Risk Level:',
    'lite.estimatedTime': 'Estimated Time:',
    'lite.complexity': 'Complexity:',
    'lite.execution': 'Execution:',
    'lite.fixTasks': 'Fix Tasks',
    'lite.modificationPoints': 'Modification Points:',
    'lite.implementationSteps': 'Implementation Steps:',
    'lite.verification': 'Verification:',
    'lite.rawJson': 'Raw JSON',
    'lite.noPlanData': 'No Plan Data',
    'lite.noPlanDataText': 'No {file} found for this session.',
    'lite.diagnosisSummary': 'Diagnosis Summary',
    'lite.diagnosisDetails': 'Diagnosis Details',
    'lite.totalDiagnoses': 'Total Diagnoses:',
    'lite.angles': 'Angles:',
    
    // Modals
    'modal.contentPreview': 'Content Preview',
    'modal.raw': 'Raw',
    'modal.preview': 'Preview',
    'modal.templateDetails': 'Template Details',
    'modal.sessionJson': 'Session JSON',
    'modal.copyToClipboard': 'Copy to Clipboard',
    
    // Toast messages
    'toast.workspaceRefreshed': 'Workspace refreshed',
    'toast.refreshFailed': 'Refresh failed: {error}',
    'toast.statusUpdateRequires': 'Status update requires server mode',
    'toast.bulkUpdateRequires': 'Bulk update requires server mode',
    'toast.failedToUpdate': 'Failed to update status',
    'toast.errorUpdating': 'Error updating status: {error}',
    'toast.failedToBulkUpdate': 'Failed to bulk update',
    'toast.errorInBulk': 'Error in bulk update: {error}',
    'toast.enterPrompt': 'Please enter a prompt',
    'toast.enterPath': 'Please enter a path',
    'toast.commandCopied': 'Command copied: {command}',
    'toast.runCommand': 'Run: {command}',
    'toast.completed': 'Completed',
    'toast.failed': 'Failed',
    'toast.error': 'Error: {error}',
    'toast.templateNotFound': 'Template not found',
    
    // Footer
    'footer.generated': 'Generated:',
    'footer.version': 'CCW Dashboard v1.0',
    
    // Prompt History
    'prompt.timeline': 'Prompt Timeline',
    'prompt.searchPlaceholder': 'Search prompts...',
    'prompt.allProjects': 'All Projects',
    'prompt.currentProject': 'Current Project',
    'prompt.noPromptsFound': 'No Prompts Found',
    'prompt.noPromptsText': 'No prompts found matching your search criteria.',
    'prompt.insights': 'Insights & Suggestions',
    'prompt.analyze': 'Analyze',
    'prompt.analyzing': 'Analyzing...',
    'prompt.selectTool': 'Select Tool',
    'prompt.quality': 'Quality',
    'prompt.intent': 'Intent',
    'prompt.project': 'Project',
    'prompt.session': 'Session',
    'prompt.noInsights': 'No insights yet',
    'prompt.noInsightsText': 'Select a CLI tool and click Analyze to generate insights.',
    'prompt.loadingInsights': 'Generating insights...',
    'prompt.insightsError': 'Failed to generate insights',
    'prompt.intent.implement': 'Implement',
    'prompt.intent.fix': 'Fix',
    'prompt.intent.explore': 'Explore',
    'prompt.intent.debug': 'Debug',
    'prompt.intent.refactor': 'Refactor',
    'prompt.intent.test': 'Test',
    'prompt.intent.document': 'Document',
    'prompt.intent.general': 'General',
    'prompt.timeJustNow': 'Just now',
    'prompt.timeMinutesAgo': '{count} min ago',
    'prompt.timeHoursAgo': '{count} hours ago',
    'prompt.timeDaysAgo': '{count} days ago',

    // Memory Module
    'memory.contextHotspots': 'Context Hotspots',
    'memory.mostRead': 'Most Read Files',
    'memory.mostEdited': 'Most Edited Files',
    'memory.today': 'Today',
    'memory.week': 'Week',
    'memory.allTime': 'All Time',
    'memory.noData': 'No data available',
    'memory.memoryGraph': 'Memory Graph',
    'memory.nodes': 'nodes',
    'memory.resetView': 'Reset View',
    'memory.zoomIn': 'Zoom In',
    'memory.zoomOut': 'Zoom Out',
    'memory.fitView': 'Fit to View',
    'memory.file': 'File',
    'memory.module': 'Module',
    'memory.component': 'Component',
    'memory.noGraphData': 'No graph data available',
    'memory.d3NotLoaded': 'D3.js not loaded',
    'memory.recentContext': 'Recent Context',
    'memory.activities': 'activities',
    'memory.searchContext': 'Search context...',
    'memory.noRecentActivity': 'No recent activity',
    'memory.reads': 'Reads',
    'memory.edits': 'Edits',
    'memory.mentions': 'Mentions',
    'memory.prompts': 'Prompts',
    'memory.nodeDetails': 'Node Details',
    'memory.heat': 'Heat',
    'memory.associations': 'Associations',
    'memory.type': 'Type',
    'memory.relatedNodes': 'Related Nodes',
    'memory.noAssociations': 'No associations found',
    'memory.justNow': 'Just now',
    'memory.minutesAgo': 'minutes ago',
    'memory.hoursAgo': 'hours ago',
    'memory.title': 'Memory',
    'memory.activeMemory': 'Active Memory',
    'memory.active': 'Active',
    'memory.inactive': 'Inactive',
    'memory.syncNow': 'Sync Now',
    'memory.syncComplete': 'Sync complete',
    'memory.syncError': 'Sync failed',
    'memory.filesAnalyzed': 'files analyzed',
    'memory.activeMemoryEnabled': 'Active Memory enabled',
    'memory.activeMemoryDisabled': 'Active Memory disabled',
    'memory.activeMemoryError': 'Failed to toggle Active Memory',
    'memory.interval': 'Interval',
    'memory.intervalManual': 'Manual',
    'memory.minutes': 'min',
    'memory.cliTool': 'CLI',
    'memory.lastSync': 'Last sync',
    'memory.autoSyncActive': 'Auto-sync',
    'memory.configUpdated': 'Configuration updated',
    'memory.configError': 'Failed to update configuration',

    // Common
    'common.cancel': 'Cancel',
    'common.create': 'Create',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.close': 'Close',
    'common.refresh': 'Refresh',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.warning': 'Warning',
    'common.info': 'Info',
    'common.remove': 'Remove',
    'common.removeFromRecent': 'Remove from recent',
    'common.noDescription': 'No description',
  },
  
  zh: {
    // App title and brand
    'app.title': 'CCW 控制面板',
    'app.brand': 'Claude Code 工作流',
    
    // Header
    'header.project': '项目:',
    'header.recentProjects': '最近项目',
    'header.browse': '浏览...',
    'header.refreshWorkspace': '刷新工作区',
    'header.toggleTheme': '切换主题',
    'header.language': '语言',
    
    // Sidebar - Project section
    'nav.project': '项目',
    'nav.overview': '概览',
    'nav.explorer': '文件浏览器',
    'nav.status': '状态',
    'nav.history': '历史',
    'nav.memory': '记忆',
    'nav.contextMemory': '活动',
    'nav.promptHistory': '洞察',
    
    // Sidebar - Sessions section
    'nav.sessions': '会话',
    'nav.all': '全部',
    'nav.active': '活跃',
    'nav.archived': '已归档',
    
    // Sidebar - Lite Tasks section
    'nav.liteTasks': '轻量任务',
    'nav.litePlan': '轻量规划',
    'nav.liteFix': '轻量修复',
    
    // Sidebar - MCP section
    'nav.mcpServers': 'MCP 服务器',
    'nav.manage': '管理',
    
    // Sidebar - Hooks section
    'nav.hooks': '钩子',
    
    // Sidebar - Footer
    'nav.collapse': '收起',
    'nav.expand': '展开',
    
    // Stats cards
    'stats.totalSessions': '总会话数',
    'stats.activeSessions': '活跃会话',
    'stats.totalTasks': '总任务数',
    'stats.completedTasks': '已完成任务',
    
    // Carousel
    'carousel.noActiveSessions': '暂无活跃会话',
    'carousel.previous': '上一个',
    'carousel.next': '下一个',
    'carousel.pause': '暂停自动播放',
    
    // Content titles
    'title.allSessions': '所有会话',
    'title.activeSessions': '活跃会话',
    'title.archivedSessions': '已归档会话',
    'title.sessions': '会话',
    'title.projectOverview': '项目概览',
    'title.mcpManagement': 'MCP 服务器管理',
    'title.fileExplorer': '文件浏览器',
    'title.cliTools': 'CLI 工具 & CCW',
    'title.cliHistory': 'CLI 执行历史',
    'title.litePlanSessions': '轻量规划会话',
    'title.liteFixSessions': '轻量修复会话',
    'title.liteTasks': '轻量任务',
    'title.sessionDetail': '会话详情',
    'title.liteTaskDetail': '轻量任务详情',
    'title.hookManager': '钩子管理',
    'title.memoryModule': '记忆模块',
    'title.promptHistory': '提示历史',

    // Search
    'search.placeholder': '搜索...',
    
    // Session cards
    'session.status.active': '活跃',
    'session.status.archived': '已归档',
    'session.status.planning': '规划中',
    'session.tasks': '个任务',
    'session.findings': '个发现',
    'session.dimensions': '个维度',
    'session.progress': '进度',
    
    // Empty states
    'empty.noSessions': '未找到会话',
    'empty.noSessionsText': '没有符合当前筛选条件的工作流会话。',
    'empty.noTasks': '暂无任务',
    'empty.noTasksText': '该会话没有定义任务。',
    'empty.noTaskFiles': '未找到任务文件',
    'empty.noTaskFilesText': '在 .task/ 目录中未找到 IMPL-*.json 文件',
    'empty.noLiteSessions': '暂无 {type} 会话',
    'empty.noLiteSessionsText': '在 .workflow/.{type}/ 目录中未找到会话',
    'empty.noMcpServers': '该项目未配置 MCP 服务器',
    'empty.addMcpServersHint': '从下方可用列表中添加服务器',
    'empty.noAdditionalMcp': '其他项目中未找到其他 MCP 服务器',
    'empty.noHooks': '该项目未配置钩子',
    'empty.createHookHint': '创建钩子以自动化工具使用时的操作',
    'empty.noGlobalHooks': '未配置全局钩子',
    'empty.globalHooksHint': '全局钩子适用于所有 Claude Code 会话',
    'empty.noDiagnoses': '暂无诊断',
    'empty.noDiagnosesText': '未找到该会话的 diagnosis-*.json 文件。',
    
    // Session detail tabs
    'tab.tasks': '任务',
    'tab.context': '上下文',
    'tab.summary': '摘要',
    'tab.implPlan': '实现计划',
    'tab.conflict': '冲突',
    'tab.review': '审查',
    'tab.plan': '计划',
    'tab.diagnoses': '诊断',
    
    // Session detail
    'detail.backToSessions': '返回会话列表',
    'detail.backToLiteTasks': '返回 {type}',
    'detail.created': '创建时间:',
    'detail.archived': '归档时间:',
    'detail.project': '项目:',
    'detail.tasks': '任务:',
    'detail.completed': '已完成',
    
    // Task status
    'task.status.pending': '待处理',
    'task.status.inProgress': '进行中',
    'task.status.completed': '已完成',
    'task.completed': '已完成',
    'task.inProgress': '进行中',
    'task.pending': '待处理',
    
    // Task actions
    'task.quickActions': '快捷操作:',
    'task.allPending': '全部待处理',
    'task.allInProgress': '全部进行中',
    'task.allCompleted': '全部完成',
    'task.setAllConfirm': '将所有 {count} 个任务设置为"{status}"？',
    'task.statusUpdated': '任务 {id} 状态已更新',
    'task.tasksUpdated': '所有 {count} 个任务已更新',
    'task.noPendingTasks': '没有待处理的任务',
    'task.noInProgressTasks': '没有进行中的任务',
    'task.movedToInProgress': '{count} 个任务已移至进行中',
    'task.tasksCompleted': '{count} 个任务已完成',
    
    // Context tab
    'context.description': '描述:',
    'context.requirements': '需求:',
    'context.focusPaths': '关注路径:',
    'context.modificationPoints': '修改点:',
    'context.acceptance': '验收标准:',
    'context.noData': '暂无上下文数据',
    'context.loading': '正在加载上下文数据...',
    'context.loadError': '加载上下文失败: {error}',
    
    // Flow control
    'flow.implementationApproach': '实现方案:',
    'flow.preAnalysis': '预分析:',
    'flow.targetFiles': '目标文件:',
    'flow.noData': '暂无流程控制数据',
    
    // Summary tab
    'summary.loading': '正在加载摘要...',
    'summary.title': '摘要',
    'summary.hint': '会话摘要将从 .summaries/ 加载',
    'summary.noSummaries': '暂无摘要',
    'summary.noSummariesText': '在 .summaries/ 中未找到摘要',
    
    // IMPL Plan tab
    'implPlan.loading': '正在加载实现计划...',
    'implPlan.title': '实现计划',
    'implPlan.hint': '实现计划将从 IMPL_PLAN.md 加载',
    
    // Review tab
    'review.loading': '正在加载审查数据...',
    'review.title': '审查数据',
    'review.hint': '审查数据将从审查文件加载',
    
    // CLI Manager
    'cli.tools': 'CLI 工具',
    'cli.available': '可用',
    'cli.refreshStatus': '刷新状态',
    'cli.ready': '就绪',
    'cli.notInstalled': '未安装',
    'cli.setDefault': '设为默认',
    'cli.default': '默认',
    'cli.install': '安装',
    'cli.initIndex': '初始化索引',
    'cli.geminiDesc': 'Google AI 代码分析',
    'cli.qwenDesc': '阿里通义 AI 助手',
    'cli.codexDesc': 'OpenAI 代码生成',
    'cli.codexLensDesc': '代码索引 & 全文搜索',
    'cli.codexLensDescFull': '全文代码搜索引擎',
    'cli.semanticDesc': 'AI 驱动的代码理解',
    'cli.semanticDescFull': '自然语言代码搜索',
    'cli.settings': 'CLI 调用设置',
    'cli.promptFormat': '提示词格式',
    'cli.promptFormatDesc': '多轮对话拼接格式',
    'cli.storageBackend': '存储后端',
    'cli.storageBackendDesc': 'CLI 历史使用 SQLite 存储，支持全文搜索',
    'cli.smartContext': '智能上下文',
    'cli.smartContextDesc': '自动分析提示词并添加相关文件路径',
    'cli.nativeResume': '原生恢复',
    'cli.nativeResumeDesc': '使用工具原生恢复命令 (gemini -r, qwen --resume, codex resume)',
    'cli.maxContextFiles': '最大上下文文件数',
    'cli.maxContextFilesDesc': '智能上下文包含的最大文件数',
    
    // CCW Install
    'ccw.install': 'CCW 安装',
    'ccw.installations': '个安装',
    'ccw.installationsPlural': '个安装',
    'ccw.noInstallations': '未找到安装',
    'ccw.installCcw': '安装 CCW',
    'ccw.upgrade': '升级',
    'ccw.uninstall': '卸载',
    'ccw.files': '个文件',
    'ccw.globalInstall': '全局安装',
    'ccw.globalInstallDesc': '安装到用户主目录 (~/.claude)',
    'ccw.pathInstall': '路径安装',
    'ccw.pathInstallDesc': '安装到指定项目文件夹',
    'ccw.installPath': '安装路径',
    'ccw.installToPath': '安装到路径',
    'ccw.uninstallConfirm': '从此位置卸载 CCW？',
    'ccw.upgradeStarting': '开始升级...',
    'ccw.upgradeCompleted': '升级完成！正在刷新...',
    'ccw.upgradeFailed': '升级失败: {error}',
    
    // CCW Endpoint Tools
    'ccw.endpointTools': 'CCW 端点工具',
    'ccw.tool': '个工具',
    'ccw.tools': '个工具',
    'ccw.noEndpointTools': '未找到端点工具',
    'ccw.parameters': '参数',
    'ccw.required': '必填',
    'ccw.optional': '可选',
    'ccw.default': '默认值:',
    'ccw.options': '选项:',
    'ccw.noParams': '此工具没有参数',
    'ccw.usageExample': '使用示例',
    'ccw.endpointTool': '端点工具',
    
    // Explorer
    'explorer.title': '浏览器',
    'explorer.refresh': '刷新',
    'explorer.selectFile': '选择文件预览',
    'explorer.selectFileHint': '从树中选择文件以预览其内容',
    'explorer.loading': '正在加载文件树...',
    'explorer.loadingFile': '正在加载文件...',
    'explorer.emptyDir': '空目录',
    'explorer.loadError': '加载失败: {error}',
    'explorer.preview': '预览',
    'explorer.source': '源码',
    'explorer.lines': '行',
    'explorer.updateClaudeMd': '更新 CLAUDE.md',
    'explorer.currentFolderOnly': '更新 CLAUDE.md（仅当前文件夹）',
    'explorer.withSubdirs': '更新 CLAUDE.md（包含子目录）',
    
    // Task Queue
    'taskQueue.title': '更新任务',
    'taskQueue.cli': 'CLI:',
    'taskQueue.addTask': '添加更新任务',
    'taskQueue.startAll': '开始所有任务',
    'taskQueue.clearCompleted': '清除已完成',
    'taskQueue.noTasks': '队列中没有任务',
    'taskQueue.noTasksHint': '悬停文件夹并点击图标添加任务',
    'taskQueue.processing': '处理中...',
    'taskQueue.updated': '更新成功',
    'taskQueue.failed': '更新失败',
    'taskQueue.currentOnly': '仅当前',
    'taskQueue.withSubdirs': '含子目录',
    'taskQueue.startingTasks': '正在并行启动 {count} 个任务...',
    'taskQueue.queueCompleted': '队列完成: {success} 个成功, {failed} 个失败',
    
    // Update CLAUDE.md Modal
    'updateClaudeMd.title': '更新 CLAUDE.md',
    'updateClaudeMd.targetDir': '目标目录',
    'updateClaudeMd.cliTool': 'CLI 工具',
    'updateClaudeMd.strategy': '策略',
    'updateClaudeMd.singleLayer': '单层 - 仅当前目录 + 子 CLAUDE.md 引用',
    'updateClaudeMd.multiLayer': '多层 - 在所有子目录生成 CLAUDE.md',
    'updateClaudeMd.running': '正在更新...',
    'updateClaudeMd.execute': '执行',
    'updateClaudeMd.addToQueue': '添加到队列',
    'updateClaudeMd.cancel': '取消',
    
    // MCP Manager
    'mcp.currentProject': '当前项目 MCP 服务器',
    'mcp.newServer': '新建服务器',
    'mcp.serversConfigured': '个服务器已配置',
    'mcp.enterprise': '企业 MCP 服务器',
    'mcp.enterpriseManaged': '托管',
    'mcp.enterpriseReadOnly': '个服务器（只读）',
    'mcp.user': '用户 MCP 服务器',
    'mcp.userServersFrom': '个服务器来自 ~/.claude.json',
    'mcp.availableOther': '其他项目可用',
    'mcp.serversAvailable': '个服务器可用',
    'mcp.allProjects': '所有项目 MCP 概览',
    'mcp.projects': '个项目',
    'mcp.project': '项目',
    'mcp.servers': 'MCP 服务器',
    'mcp.status': '状态',
    'mcp.current': '（当前）',
    'mcp.noMcpServers': '无 MCP 服务器',
    'mcp.add': '添加',
    'mcp.addToProject': '添加到项目',
    'mcp.removeFromProject': '从项目移除',
    'mcp.removeConfirm': '从此项目移除 MCP 服务器 "{name}"？',
    'mcp.readOnly': '只读',
    'mcp.usedIn': '用于 {count} 个项目',
    'mcp.usedInPlural': '用于 {count} 个项目',
    'mcp.availableToAll': '可用于所有项目，来自 ~/.claude.json',
    'mcp.managedByOrg': '由组织管理（最高优先级）',
    'mcp.variables': '个变量',
    
    // MCP Create Modal
    'mcp.createTitle': '创建 MCP 服务器',
    'mcp.form': '表单',
    'mcp.json': 'JSON',
    'mcp.serverName': '服务器名称',
    'mcp.serverNamePlaceholder': '例如: my-mcp-server',
    'mcp.command': '命令',
    'mcp.commandPlaceholder': '例如: npx, uvx, node, python',
    'mcp.arguments': '参数（每行一个）',
    'mcp.envVars': '环境变量（每行 KEY=VALUE）',
    'mcp.pasteJson': '粘贴 MCP 服务器 JSON 配置',
    'mcp.jsonFormatsHint': '支持 {"servers": {...}}、{"mcpServers": {...}} 和直接服务器配置格式。',
    'mcp.previewServers': '预览（将添加的服务器）:',
    'mcp.create': '创建',
    
    // Hook Manager
    'hook.projectHooks': '项目钩子',
    'hook.projectFile': '.claude/settings.json',
    'hook.newHook': '新建钩子',
    'hook.hooksConfigured': '个钩子已配置',
    'hook.globalHooks': '全局钩子',
    'hook.globalFile': '~/.claude/settings.json',
    'hook.wizards': '钩子向导',
    'hook.guidedSetup': '引导设置',
    'hook.wizardsDesc': '通过向导配置复杂钩子',
    'hook.quickInstall': '快速安装模板',
    'hook.oneClick': '一键安装钩子',
    'hook.envVarsRef': '环境变量参考',
    'hook.filePaths': '受影响文件的空格分隔路径',
    'hook.toolName': '正在执行的工具名称',
    'hook.toolInput': '传递给工具的 JSON 输入',
    'hook.sessionId': '当前 Claude 会话 ID',
    'hook.projectDir': '当前项目目录路径',
    'hook.workingDir': '当前工作目录',
    'hook.openWizard': '打开向导',
    'hook.installed': '已安装',
    'hook.installProject': '安装（项目）',
    'hook.installGlobal': '全局',
    'hook.uninstall': '卸载',
    'hook.viewDetails': '查看模板详情',
    'hook.edit': '编辑钩子',
    'hook.delete': '删除钩子',
    'hook.deleteConfirm': '删除此 {event} 钩子？',
    
    // Hook Create Modal
    'hook.createTitle': '创建钩子',
    'hook.event': '钩子事件',
    'hook.selectEvent': '选择事件...',
    'hook.preToolUse': 'PreToolUse - 工具执行前',
    'hook.postToolUse': 'PostToolUse - 工具完成后',
    'hook.notification': 'Notification - 通知时',
    'hook.stop': 'Stop - 代理停止时',
    'hook.matcher': '匹配器（可选）',
    'hook.matcherPlaceholder': '例如: Write, Edit, Bash（留空匹配所有）',
    'hook.matcherHint': '要匹配的工具名称。留空匹配所有工具。',
    'hook.commandLabel': '命令',
    'hook.commandPlaceholder': '例如: curl, bash, node',
    'hook.argsLabel': '参数（每行一个）',
    'hook.scope': '作用域',
    'hook.scopeProject': '项目（.claude/settings.json）',
    'hook.scopeGlobal': '全局（~/.claude/settings.json）',
    'hook.quickTemplates': '快速模板',
    
    // Hook templates
    'hook.template.ccwNotify': 'CCW 通知',
    'hook.template.ccwNotifyDesc': '写入时通知控制面板',
    'hook.template.logTool': '工具使用日志',
    'hook.template.logToolDesc': '记录所有工具执行',
    'hook.template.lintCheck': 'Lint 检查',
    'hook.template.lintCheckDesc': '文件更改时运行 eslint',
    'hook.template.gitAdd': 'Git 暂存',
    'hook.template.gitAddDesc': '自动暂存写入的文件',

    // Hook Quick Install Templates
    'hook.tpl.codexlensSync': 'CodexLens 自动同步',
    'hook.tpl.codexlensSyncDesc': '文件写入或编辑时自动更新代码索引',
    'hook.tpl.ccwDashboardNotify': 'CCW 控制面板通知',
    'hook.tpl.ccwDashboardNotifyDesc': '文件写入时通知 CCW 控制面板',
    'hook.tpl.toolLogger': '工具使用记录器',
    'hook.tpl.toolLoggerDesc': '将所有工具执行记录到文件',
    'hook.tpl.autoLint': '自动 Lint 检查',
    'hook.tpl.autoLintDesc': '写入后对 JavaScript/TypeScript 文件运行 ESLint',
    'hook.tpl.autoGitStage': '自动 Git 暂存',
    'hook.tpl.autoGitStageDesc': '自动将写入的文件添加到 Git 暂存区',

    // Hook Template Categories
    'hook.category.indexing': '索引',
    'hook.category.notification': '通知',
    'hook.category.logging': '日志',
    'hook.category.quality': '质量',
    'hook.category.git': 'Git',
    'hook.category.memory': '记忆',
    'hook.category.skill': '技能',

    // Hook Wizard Templates
    'hook.wizard.memoryUpdate': '记忆更新钩子',
    'hook.wizard.memoryUpdateDesc': '根据代码更改自动更新 CLAUDE.md 文档',
    'hook.wizard.onSessionEnd': '会话结束时',
    'hook.wizard.onSessionEndDesc': 'Claude 会话结束时更新文档',
    'hook.wizard.periodicUpdate': '定期更新',
    'hook.wizard.periodicUpdateDesc': '会话期间定期更新文档',
    'hook.wizard.skillContext': 'SKILL 上下文加载器',
    'hook.wizard.skillContextDesc': '根据用户提示中的关键词自动加载 SKILL 包',
    'hook.wizard.keywordMatching': '关键词匹配',
    'hook.wizard.keywordMatchingDesc': '当提示中检测到关键词时加载特定 SKILL',
    'hook.wizard.autoDetection': '自动检测',
    'hook.wizard.autoDetectionDesc': '根据提示中的名称自动检测并加载 SKILL',
    'hook.wizard.memorySetup': '记忆模块设置',
    'hook.wizard.memorySetupDesc': '配置自动上下文跟踪（轻量级元数据记录）',
    'hook.wizard.fileReadTracker': '文件读取追踪器',
    'hook.wizard.fileReadTrackerDesc': '追踪文件读取以构建上下文热图',
    'hook.wizard.fileWriteTracker': '文件写入追踪器',
    'hook.wizard.fileWriteTrackerDesc': '追踪文件修改以识别核心模块',
    'hook.wizard.promptTracker': '提示追踪器',
    'hook.wizard.promptTrackerDesc': '记录用户提示用于模式分析',
    'hook.wizard.selectTrackers': '选择追踪器',

    // Hook Wizard Labels
    'hook.wizard.cliTools': 'CLI 工具:',
    'hook.wizard.event': '事件:',
    'hook.wizard.availableSkills': '可用 SKILL:',
    'hook.wizard.loading': '加载中...',
    'hook.wizard.matches': '匹配:',
    'hook.wizard.whenToTrigger': '触发时机',
    'hook.wizard.configuration': '配置',
    'hook.wizard.commandPreview': '生成的命令预览',
    'hook.wizard.installTo': '安装到',
    'hook.wizard.installHook': '安装钩子',
    'hook.wizard.noSkillsConfigured': '尚未配置任何 SKILL',
    'hook.wizard.clickAddSkill': '点击"添加 SKILL"配置关键词触发器',
    'hook.wizard.configureSkills': '配置 SKILL',
    'hook.wizard.addSkill': '添加 SKILL',
    'hook.wizard.selectSkill': '选择 SKILL...',
    'hook.wizard.triggerKeywords': '触发关键词（逗号分隔）',
    'hook.wizard.autoDetectionMode': '自动检测模式',
    'hook.wizard.autoDetectionInfo': '当 SKILL 名称出现在提示中时将自动加载。',
    'hook.wizard.noSkillsFound': '未找到 SKILL。请在 .claude/skills/ 中创建 SKILL 包',
    'hook.wizard.noSkillConfigs': '# 尚未配置 SKILL',
    'hook.wizard.cliTool': 'CLI 工具',
    'hook.wizard.intervalSeconds': '间隔（秒）',
    'hook.wizard.updateStrategy': '更新策略',
    'hook.wizard.toolForDocGen': '用于生成文档的工具',
    'hook.wizard.timeBetweenUpdates': '更新之间的时间间隔',
    'hook.wizard.relatedStrategy': 'related: 已更改的模块, single-layer: 当前目录',
    
    // Lite Tasks
    'lite.plan': '规划',
    'lite.fix': '修复',
    'lite.summary': '摘要',
    'lite.rootCause': '根本原因',
    'lite.fixStrategy': '修复策略',
    'lite.approach': '方法',
    'lite.userRequirements': '用户需求',
    'lite.focusPaths': '关注路径',
    'lite.metadata': '元数据',
    'lite.severity': '严重性:',
    'lite.riskLevel': '风险等级:',
    'lite.estimatedTime': '预计时间:',
    'lite.complexity': '复杂度:',
    'lite.execution': '执行:',
    'lite.fixTasks': '修复任务',
    'lite.modificationPoints': '修改点:',
    'lite.implementationSteps': '实现步骤:',
    'lite.verification': '验证:',
    'lite.rawJson': '原始 JSON',
    'lite.noPlanData': '暂无计划数据',
    'lite.noPlanDataText': '未找到该会话的 {file}。',
    'lite.diagnosisSummary': '诊断摘要',
    'lite.diagnosisDetails': '诊断详情',
    'lite.totalDiagnoses': '总诊断数:',
    'lite.angles': '分析角度:',
    
    // Modals
    'modal.contentPreview': '内容预览',
    'modal.raw': '原始',
    'modal.preview': '预览',
    'modal.templateDetails': '模板详情',
    'modal.sessionJson': '会话 JSON',
    'modal.copyToClipboard': '复制到剪贴板',
    
    // Toast messages
    'toast.workspaceRefreshed': '工作区已刷新',
    'toast.refreshFailed': '刷新失败: {error}',
    'toast.statusUpdateRequires': '状态更新需要服务器模式',
    'toast.bulkUpdateRequires': '批量更新需要服务器模式',
    'toast.failedToUpdate': '更新状态失败',
    'toast.errorUpdating': '更新状态出错: {error}',
    'toast.failedToBulkUpdate': '批量更新失败',
    'toast.errorInBulk': '批量更新出错: {error}',
    'toast.enterPrompt': '请输入提示',
    'toast.enterPath': '请输入路径',
    'toast.commandCopied': '命令已复制: {command}',
    'toast.runCommand': '运行: {command}',
    'toast.completed': '已完成',
    'toast.failed': '失败',
    'toast.error': '错误: {error}',
    'toast.templateNotFound': '未找到模板',
    
    // Footer
    'footer.generated': '生成时间:',
    'footer.version': 'CCW 控制面板 v1.0',

    // Prompt History
    'prompt.timeline': '提示词时间线',
    'prompt.searchPlaceholder': '搜索提示词...',
    'prompt.allProjects': '所有项目',
    'prompt.currentProject': '当前项目',
    'prompt.noPromptsFound': '未找到提示词',
    'prompt.noPromptsText': '没有符合搜索条件的提示词。',
    'prompt.insights': '洞察与建议',
    'prompt.analyze': '分析',
    'prompt.analyzing': '分析中...',
    'prompt.selectTool': '选择工具',
    'prompt.quality': '质量',
    'prompt.intent': '意图',
    'prompt.project': '项目',
    'prompt.session': '会话',
    'prompt.noInsights': '暂无洞察',
    'prompt.noInsightsText': '选择 CLI 工具并点击分析以生成洞察。',
    'prompt.loadingInsights': '正在生成洞察...',
    'prompt.insightsError': '生成洞察失败',
    'prompt.intent.implement': '实现',
    'prompt.intent.fix': '修复',
    'prompt.intent.explore': '探索',
    'prompt.intent.debug': '调试',
    'prompt.intent.refactor': '重构',
    'prompt.intent.test': '测试',
    'prompt.intent.document': '文档',
    'prompt.intent.general': '通用',
    'prompt.timeJustNow': '刚刚',
    'prompt.timeMinutesAgo': '{count} 分钟前',
    'prompt.timeHoursAgo': '{count} 小时前',
    'prompt.timeDaysAgo': '{count} 天前',

    // Memory Module
    'memory.contextHotspots': '上下文热点',
    'memory.mostRead': '最常读取的文件',
    'memory.mostEdited': '最常编辑的文件',
    'memory.today': '今天',
    'memory.week': '本周',
    'memory.allTime': '全部时间',
    'memory.noData': '无可用数据',
    'memory.memoryGraph': '记忆图谱',
    'memory.nodes': '节点',
    'memory.resetView': '重置视图',
    'memory.zoomIn': '放大',
    'memory.zoomOut': '缩小',
    'memory.fitView': '自适应',
    'memory.file': '文件',
    'memory.module': '模块',
    'memory.component': '组件',
    'memory.noGraphData': '无图谱数据',
    'memory.d3NotLoaded': 'D3.js 未加载',
    'memory.recentContext': '最近上下文',
    'memory.activities': '活动',
    'memory.searchContext': '搜索上下文...',
    'memory.noRecentActivity': '无最近活动',
    'memory.reads': '读取',
    'memory.edits': '编辑',
    'memory.mentions': '提及',
    'memory.prompts': '提示',
    'memory.nodeDetails': '节点详情',
    'memory.heat': '热度',
    'memory.associations': '关联',
    'memory.type': '类型',
    'memory.relatedNodes': '相关节点',
    'memory.noAssociations': '未找到关联',
    'memory.justNow': '刚刚',
    'memory.minutesAgo': '分钟前',
    'memory.hoursAgo': '小时前',
    'memory.title': '记忆',
    'memory.activeMemory': '活动记忆',
    'memory.active': '已启用',
    'memory.inactive': '未启用',
    'memory.syncNow': '立即同步',
    'memory.syncComplete': '同步完成',
    'memory.syncError': '同步失败',
    'memory.filesAnalyzed': '个文件已分析',
    'memory.activeMemoryEnabled': '活动记忆已启用',
    'memory.activeMemoryDisabled': '活动记忆已禁用',
    'memory.activeMemoryError': '切换活动记忆失败',
    'memory.interval': '间隔',
    'memory.intervalManual': '手动',
    'memory.minutes': '分钟',
    'memory.cliTool': 'CLI',
    'memory.lastSync': '上次同步',
    'memory.autoSyncActive': '自动同步',
    'memory.configUpdated': '配置已更新',
    'memory.configError': '配置更新失败',

    // Common
    'common.cancel': '取消',
    'common.create': '创建',
    'common.save': '保存',
    'common.delete': '删除',
    'common.edit': '编辑',
    'common.close': '关闭',
    'common.refresh': '刷新',
    'common.loading': '加载中...',
    'common.error': '错误',
    'common.success': '成功',
    'common.warning': '警告',
    'common.info': '信息',
    'common.remove': '移除',
    'common.removeFromRecent': '从最近中移除',
    'common.noDescription': '无描述',
  }
};

/**
 * Initialize i18n - detect browser language or use stored preference
 */
function initI18n() {
  // Check stored preference
  const stored = localStorage.getItem('ccw-lang');
  if (stored && i18n[stored]) {
    currentLang = stored;
  } else {
    // Detect browser language
    const browserLang = navigator.language || navigator.userLanguage;
    if (browserLang.startsWith('zh')) {
      currentLang = 'zh';
    } else {
      currentLang = 'en';
    }
  }
  
  // Apply translations to DOM
  applyTranslations();
  updateLangToggle();
}

/**
 * Get translation for a key with optional replacements
 * @param {string} key - Translation key
 * @param {Object} replacements - Optional key-value pairs for replacements
 * @returns {string} Translated string
 */
function t(key, replacements = {}) {
  const dict = i18n[currentLang] || i18n.en;
  let text = dict[key] || i18n.en[key] || key;
  
  // Apply replacements
  for (const [k, v] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  
  return text;
}

/**
 * Switch language
 * @param {string} lang - Language code ('en' or 'zh')
 */
function switchLang(lang) {
  if (i18n[lang]) {
    currentLang = lang;
    localStorage.setItem('ccw-lang', lang);
    applyTranslations();
    updateLangToggle();
    
    // Re-render current view to update dynamic content
    if (typeof updateContentTitle === 'function') {
      updateContentTitle();
    }
  }
}

/**
 * Apply translations to all elements with data-i18n attribute
 */
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const translated = t(key);
    
    // Handle different element types
    if (el.tagName === 'INPUT' && el.type === 'text') {
      el.placeholder = translated;
    } else if (el.hasAttribute('title')) {
      el.title = translated;
    } else {
      el.textContent = translated;
    }
  });
  
  // Update elements with data-i18n-title
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  
  // Update elements with data-i18n-placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  
  // Update document title
  document.title = t('app.title');
}

/**
 * Update language toggle button state
 */
function updateLangToggle() {
  const langBtn = document.getElementById('langToggle');
  if (langBtn) {
    langBtn.textContent = currentLang.toUpperCase();
    langBtn.title = t('header.language');
  }
}

/**
 * Get current language
 * @returns {string} Current language code
 */
function getLang() {
  return currentLang;
}

/**
 * Check if current language is Chinese
 * @returns {boolean}
 */
function isZh() {
  return currentLang === 'zh';
}
