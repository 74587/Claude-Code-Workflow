---
name: clean
description: Intelligent code cleanup with mainline detection, stale artifact discovery, and safe execution (Codex version)
argument-hint: "[--dry-run] [\"focus area\"]"
---

# Clean Command (/workflow:clean) - Codex Version

## Overview

Intelligent cleanup command that explores the codebase to identify the development mainline, discovers artifacts that have drifted from it, and safely removes stale sessions, abandoned documents, and dead code.

**Core capabilities:**
- Mainline detection: Identify active development branches and core modules
- Drift analysis: Find sessions, documents, and code that deviate from mainline
- Intelligent discovery: cli-explore-agent based artifact scanning (using Codex subagent)
- Safe execution: Staged deletion with confirmation and recovery capability

## Usage

```bash
/workflow:clean                          # Full intelligent cleanup (explore -> analyze -> confirm -> execute)
/workflow:clean --dry-run                # Explore and analyze only, no execution
/workflow:clean "auth module"            # Focus cleanup on specific area
```

## Execution Process

```
Phase 0: Initialization
   ├─ Parse command arguments
   ├─ Define utility functions
   └─ Setup session folder

Phase 1: Mainline Detection
   ├─ Analyze git history for development trends
   ├─ Identify core modules (high commit frequency)
   ├─ Map active vs stale branches
   └─ Build mainline profile

Phase 2: Drift Discovery (Codex cli-explore-agent)
   ├─ spawn_agent with role path
   ├─ Scan workflow sessions for orphaned artifacts
   ├─ Identify documents drifted from mainline
   ├─ Detect dead code and unused exports
   ├─ wait() for results with timeout handling
   └─ Generate cleanup manifest

Phase 3: Confirmation
   ├─ Validate manifest schema
   ├─ Display cleanup summary by category
   ├─ Show impact analysis (files, size, risk)
   └─ AskUserQuestion: Select categories to clean

Phase 4: Execution (unless --dry-run)
   ├─ Validate paths (security check)
   ├─ Stage deletion (move to .trash first)
   ├─ Update manifests and indexes
   ├─ Permanent deletion after verification
   └─ Report results
```

## Implementation

### Phase 0: Initialization

**Argument Parsing and Utility Functions**:
```javascript
// ==================== Utility Functions ====================

const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

/**
 * Parse command arguments
 * @param {string} args - Raw command arguments
 * @returns {{ flags: string[], focusArea: string | null }}
 */
function parseArguments(args) {
  const parts = (args || '').trim().split(/\s+/)
  const flags = parts.filter(p => p.startsWith('--'))
  const nonFlags = parts.filter(p => !p.startsWith('--'))
  const focusArea = nonFlags.length > 0 ? nonFlags.join(' ').replace(/^["']|["']$/g, '') : null
  return { flags, focusArea }
}

/**
 * Check if file exists
 * @param {string} filePath - Path to check
 * @returns {boolean}
 */
function fileExists(filePath) {
  try {
    const result = Bash({ command: `test -f "${filePath}" && echo "exists" || echo "not_found"` })
    return result.includes('exists')
  } catch {
    return false
  }
}

/**
 * Check if directory exists
 * @param {string} dirPath - Path to check
 * @returns {boolean}
 */
function dirExists(dirPath) {
  try {
    const result = Bash({ command: `test -d "${dirPath}" && echo "exists" || echo "not_found"` })
    return result.includes('exists')
  } catch {
    return false
  }
}

/**
 * Get risk summary for a category from manifest
 * @param {object} manifest - The cleanup manifest
 * @param {string} category - Category name ('sessions' | 'documents' | 'code')
 * @returns {string} Risk summary string
 */
function getRiskSummary(manifest, category) {
  const categoryMap = {
    'sessions': 'stale_sessions',
    'documents': 'drifted_documents',
    'code': 'dead_code'
  }
  const items = manifest.discoveries[categoryMap[category]] || []
  const riskCounts = { low: 0, medium: 0, high: 0 }
  items.forEach(item => {
    if (riskCounts[item.risk] !== undefined) {
      riskCounts[item.risk]++
    }
  })
  const parts = []
  if (riskCounts.high > 0) parts.push(`${riskCounts.high}H`)
  if (riskCounts.medium > 0) parts.push(`${riskCounts.medium}M`)
  if (riskCounts.low > 0) parts.push(`${riskCounts.low}L`)
  return parts.length > 0 ? parts.join('/') : '-'
}

/**
 * Validate path is safe for deletion (security check)
 * @param {string} targetPath - Path to validate
 * @param {string} projectRoot - Project root directory
 * @returns {{ valid: boolean, reason?: string }}
 */
function validatePathForDeletion(targetPath, projectRoot) {
  // Normalize paths
  const normalizedTarget = targetPath.replace(/\\/g, '/').replace(/\/+/g, '/')
  const normalizedRoot = projectRoot.replace(/\\/g, '/').replace(/\/+/g, '/')

  // Check for path traversal attempts
  if (normalizedTarget.includes('..')) {
    return { valid: false, reason: 'Path contains traversal sequence (..)' }
  }

  // Check path is within project
  if (!normalizedTarget.startsWith(normalizedRoot) && !normalizedTarget.startsWith('.')) {
    // Allow relative paths starting with . (like .workflow/)
    if (!normalizedTarget.startsWith('.workflow/') &&
        !normalizedTarget.startsWith('.claude/') &&
        !normalizedTarget.startsWith('src/')) {
      return { valid: false, reason: 'Path is outside allowed directories' }
    }
  }

  // Whitelist of allowed deletion prefixes
  const allowedPrefixes = [
    '.workflow/active/',
    '.workflow/archives/',
    '.workflow/.lite-plan/',
    '.workflow/.debug/',
    '.workflow/.scratchpad/',
    '.workflow/.clean/',
    '.claude/rules/tech/'
  ]

  const isInAllowedDir = allowedPrefixes.some(prefix =>
    normalizedTarget.startsWith(prefix) || normalizedTarget.includes('/' + prefix)
  )

  // For dead code, allow src/ paths but require extra validation
  const isSourceCode = normalizedTarget.includes('/src/') || normalizedTarget.startsWith('src/')

  if (!isInAllowedDir && !isSourceCode) {
    return { valid: false, reason: 'Path not in allowed deletion directories' }
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    /^\/$/, /^\/home$/, /^\/usr$/, /^\/etc$/, /^\/var$/,
    /^C:\\?$/i, /^C:\\Windows/i, /^C:\\Users$/i,
    /node_modules/, /\.git$/
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(normalizedTarget)) {
      return { valid: false, reason: 'Path matches dangerous pattern' }
    }
  }

  return { valid: true }
}

/**
 * Validate manifest schema
 * @param {object} manifest - Manifest object to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateManifestSchema(manifest) {
  const errors = []

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest is not an object'] }
  }

  // Required top-level fields
  if (!manifest.generated_at) errors.push('Missing generated_at')
  if (!manifest.discoveries) errors.push('Missing discoveries')
  if (!manifest.summary) errors.push('Missing summary')

  // Validate discoveries structure
  if (manifest.discoveries) {
    const requiredCategories = ['stale_sessions', 'drifted_documents', 'dead_code']
    for (const cat of requiredCategories) {
      if (!Array.isArray(manifest.discoveries[cat])) {
        errors.push(`discoveries.${cat} is not an array`)
      }
    }

    // Validate each item has required fields
    const allItems = [
      ...(manifest.discoveries.stale_sessions || []),
      ...(manifest.discoveries.drifted_documents || []),
      ...(manifest.discoveries.dead_code || [])
    ]

    allItems.forEach((item, idx) => {
      if (!item.path) errors.push(`Item ${idx} missing path`)
      if (!item.risk) errors.push(`Item ${idx} missing risk`)
      if (!['low', 'medium', 'high'].includes(item.risk)) {
        errors.push(`Item ${idx} has invalid risk: ${item.risk}`)
      }
    })
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Safe JSON parse with error handling
 * @param {string} content - JSON string to parse
 * @param {*} defaultValue - Default value if parse fails
 * @returns {*} Parsed object or default value
 */
function safeJsonParse(content, defaultValue = null) {
  try {
    return JSON.parse(content)
  } catch (error) {
    console.error(`JSON parse error: ${error.message}`)
    return defaultValue
  }
}

// ==================== Session Setup ====================

// Parse command arguments
const { flags, focusArea } = parseArguments(ARGUMENTS)
const isDryRun = flags.includes('--dry-run')

// Setup session
const dateStr = getUtc8ISOString().substring(0, 10)
const sessionId = `clean-${dateStr}`
const sessionFolder = `.workflow/.clean/${sessionId}`
const trashFolder = `${sessionFolder}/.trash`
const projectRoot = Bash({ command: 'pwd' }).trim()

// Create session directories
Bash({ command: `mkdir -p "${sessionFolder}"` })
Bash({ command: `mkdir -p "${trashFolder}"` })

console.log(`Session: ${sessionId}`)
console.log(`Focus: ${focusArea || 'entire project'}`)
console.log(`Mode: ${isDryRun ? 'dry-run (no changes)' : 'execute'}`)
```

---

### Phase 1: Mainline Detection

**Step 1.1: Git History Analysis**
```javascript
// Check if git repository exists
const isGitRepo = Bash({ command: 'git rev-parse --git-dir 2>/dev/null && echo "yes" || echo "no"' }).includes('yes')

let gitAnalysis = {
  commitFrequency: [],
  recentBranches: [],
  recentFiles: []
}

if (isGitRepo) {
  // Get commit frequency by directory (last 30 days)
  const freqResult = Bash({
    command: 'git log --since="30 days ago" --name-only --pretty=format: 2>/dev/null | grep -v "^$" | cut -d/ -f1-2 | sort | uniq -c | sort -rn | head -20'
  })

  // Get recent active branches
  const branchResult = Bash({
    command: 'git for-each-ref --sort=-committerdate refs/heads/ --format="%(refname:short) %(committerdate:relative)" 2>/dev/null | head -10'
  })

  // Get files with most recent changes
  const filesResult = Bash({
    command: 'git log --since="7 days ago" --name-only --pretty=format: 2>/dev/null | grep -v "^$" | sort | uniq -c | sort -rn | head -30'
  })

  gitAnalysis = {
    commitFrequency: freqResult.trim().split('\n').filter(Boolean),
    recentBranches: branchResult.trim().split('\n').filter(Boolean),
    recentFiles: filesResult.trim().split('\n').filter(Boolean)
  }
} else {
  console.log('Warning: Not a git repository. Using file timestamps only.')
}
```

**Step 1.2: Build Mainline Profile**
```javascript
// Parse commit frequency to identify core modules
const coreModules = gitAnalysis.commitFrequency
  .map(line => {
    const match = line.trim().match(/^\s*(\d+)\s+(.+)$/)
    return match ? { count: parseInt(match[1]), path: match[2] } : null
  })
  .filter(item => item && item.count >= 5)
  .map(item => item.path)

const mainlineProfile = {
  coreModules,
  activeFiles: gitAnalysis.recentFiles.slice(0, 20),
  activeBranches: gitAnalysis.recentBranches.map(b => b.split(' ')[0]),
  staleThreshold: {
    sessions: 7,          // Days
    branches: 30,
    documents: 14
  },
  isGitRepo,
  timestamp: getUtc8ISOString()
}

Write(`${sessionFolder}/mainline-profile.json`, JSON.stringify(mainlineProfile, null, 2))
console.log(`Mainline profile saved. Core modules: ${coreModules.length}`)
```

---

### Phase 2: Drift Discovery (Codex Subagent)

**Codex Implementation: spawn_agent + wait with proper lifecycle management**

```javascript
let exploreAgent = null

try {
  // Step 1: Launch cli-explore-agent (role path passed, agent reads it)
  exploreAgent = spawn_agent({
    message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/cli-explore-agent.md (MUST read first)
2. Read: .workflow/project-tech.json (if exists)
3. Read: .workflow/project-guidelines.json (if exists)

---

## Task Objective
Discover artifacts that have drifted from the development mainline. Identify stale sessions, abandoned documents, and dead code for cleanup.

## Context
- **Session Folder**: ${sessionFolder}
- **Mainline Profile**: ${sessionFolder}/mainline-profile.json
- **Focus Area**: ${focusArea || 'entire project'}
- **Project Root**: ${projectRoot}

## Discovery Categories

### Category 1: Stale Workflow Sessions
Scan and analyze workflow session directories:

**Locations to scan**:
- .workflow/active/WFS-* (active sessions)
- .workflow/archives/WFS-* (archived sessions)
- .workflow/.lite-plan/* (lite-plan sessions)
- .workflow/.debug/DBG-* (debug sessions)

**Staleness criteria**:
- Active sessions: No modification >7 days + no related git commits
- Archives: >30 days old + no feature references in project-tech.json
- Lite-plan: >7 days old + plan.json not executed
- Debug: >3 days old + issue not in recent commits

**Analysis steps**:
1. List all session directories with modification times
2. Cross-reference with git log (are session topics in recent commits?)
3. Check manifest.json for orphan entries
4. Identify sessions with .archiving marker (interrupted)

### Category 2: Drifted Documents
Scan documentation that no longer aligns with code:

**Locations to scan**:
- .claude/rules/tech/* (generated tech rules)
- .workflow/.scratchpad/* (temporary notes)
- **/CLAUDE.md (module documentation)

**Drift criteria**:
- Tech rules: Referenced files no longer exist
- Scratchpad: Any file (always temporary)
- Module docs: Describe functions/classes that were removed

**Analysis steps**:
1. Parse document content for file/function references
2. Verify referenced entities still exist in codebase
3. Flag documents with >30% broken references

### Category 3: Dead Code
Identify code that is no longer used:

**Scan patterns**:
- Unused exports (exported but never imported)
- Orphan files (not imported anywhere)
- Commented-out code blocks (>10 lines)
- TODO/FIXME comments >90 days old

**Analysis steps**:
1. Build import graph using rg/grep
2. Identify exports with no importers
3. Find files not in import graph
4. Scan for large comment blocks

## Output Format

Write to: ${sessionFolder}/cleanup-manifest.json

\`\`\`json
{
  "generated_at": "ISO timestamp",
  "mainline_summary": {
    "core_modules": ["src/core", "src/api"],
    "active_branches": ["main", "feature/auth"],
    "health_score": 0.85
  },
  "discoveries": {
    "stale_sessions": [
      {
        "path": ".workflow/active/WFS-old-feature",
        "type": "active",
        "age_days": 15,
        "reason": "No related commits in 15 days",
        "size_kb": 1024,
        "risk": "low"
      }
    ],
    "drifted_documents": [
      {
        "path": ".claude/rules/tech/deprecated-lib",
        "type": "tech_rules",
        "broken_references": 5,
        "total_references": 6,
        "drift_percentage": 83,
        "reason": "Referenced library removed",
        "risk": "low"
      }
    ],
    "dead_code": [
      {
        "path": "src/utils/legacy.ts",
        "type": "orphan_file",
        "reason": "Not imported by any file",
        "last_modified": "2025-10-01",
        "risk": "medium"
      }
    ]
  },
  "summary": {
    "total_items": 12,
    "total_size_mb": 45.2,
    "by_category": {
      "stale_sessions": 5,
      "drifted_documents": 4,
      "dead_code": 3
    },
    "by_risk": {
      "low": 8,
      "medium": 3,
      "high": 1
    }
  }
}
\`\`\`

## Execution Commands

\`\`\`bash
# Session directories (cross-platform)
find .workflow -type d \\( -name "WFS-*" -o -name "DBG-*" \\) 2>/dev/null

# Check modification times
find .workflow -type d -name "WFS-*" -mtime +7 2>/dev/null

# Find orphan exports (TypeScript)
rg "export (const|function|class|interface|type)" --type ts -l

# Find imports
rg "import.*from" --type ts

# Find large comment blocks
rg "^\\s*/\\*" -A 10 --type ts

# Find old TODOs
rg "TODO|FIXME" --type ts -n
\`\`\`

## Success Criteria
- [ ] All session directories scanned with age calculation
- [ ] Documents cross-referenced with existing code
- [ ] Dead code detection via import graph analysis
- [ ] cleanup-manifest.json written with complete data
- [ ] Each item has risk level and cleanup reason
`
  })

  // Step 2: Wait for discovery results with timeout handling
  console.log('Waiting for discovery agent (timeout: 10 minutes)...')
  let exploreResult = wait({
    ids: [exploreAgent],
    timeout_ms: 600000  // 10 minutes
  })

  // Step 3: Handle timeout with retry
  if (exploreResult.timed_out) {
    console.log('Warning: Discovery agent timed out. Sending prompt to complete...')

    // Send prompt to encourage completion
    send_input({
      id: exploreAgent,
      message: 'Please complete the analysis now and write cleanup-manifest.json with the findings so far.'
    })

    // Wait for additional time
    const retryResult = wait({
      ids: [exploreAgent],
      timeout_ms: 300000  // 5 more minutes
    })

    if (retryResult.timed_out) {
      console.error('Error: Discovery agent timed out twice. Aborting.')
      throw new Error('Discovery agent timeout')
    }
  }

  // Step 4: Verify manifest file exists
  if (!fileExists(`${sessionFolder}/cleanup-manifest.json`)) {
    console.error('Error: cleanup-manifest.json not generated by exploration agent')
    throw new Error('Manifest file not generated')
  }

  console.log('Discovery completed successfully.')

} finally {
  // Step 5: Always cleanup agent (try-finally ensures cleanup)
  if (exploreAgent) {
    close_agent({ id: exploreAgent })
    console.log('Discovery agent closed.')
  }
}
```

---

### Phase 3: Confirmation

**Step 3.1: Load and Validate Manifest**
```javascript
// Read manifest with error handling
const manifestContent = Read(`${sessionFolder}/cleanup-manifest.json`)
const manifest = safeJsonParse(manifestContent)

if (!manifest) {
  console.error('Error: Failed to parse cleanup-manifest.json')
  console.log('Attempting to regenerate from filesystem scan...')
  // Fallback: could trigger re-scan here
  return
}

// Validate manifest schema
const validation = validateManifestSchema(manifest)
if (!validation.valid) {
  console.error('Error: Manifest validation failed:')
  validation.errors.forEach(e => console.error(`  - ${e}`))
  return
}

console.log('Manifest validated successfully.')
```

**Step 3.2: Display Summary**
```javascript
console.log(`
## Cleanup Discovery Report

**Mainline Health**: ${Math.round((manifest.mainline_summary?.health_score || 0) * 100)}%
**Core Modules**: ${(manifest.mainline_summary?.core_modules || []).join(', ') || 'N/A'}

### Summary
| Category | Count | Risk Distribution |
|----------|-------|-------------------|
| Stale Sessions | ${manifest.summary.by_category.stale_sessions} | ${getRiskSummary(manifest, 'sessions')} |
| Drifted Documents | ${manifest.summary.by_category.drifted_documents} | ${getRiskSummary(manifest, 'documents')} |
| Dead Code | ${manifest.summary.by_category.dead_code} | ${getRiskSummary(manifest, 'code')} |

**Total**: ${manifest.summary.total_items} items, ~${manifest.summary.total_size_mb || 0} MB

### Stale Sessions
${(manifest.discoveries.stale_sessions || []).map(s =>
  `- ${s.path} (${s.age_days}d, ${s.risk}): ${s.reason}`
).join('\n') || '(none)'}

### Drifted Documents
${(manifest.discoveries.drifted_documents || []).map(d =>
  `- ${d.path} (${d.drift_percentage}% broken, ${d.risk}): ${d.reason}`
).join('\n') || '(none)'}

### Dead Code
${(manifest.discoveries.dead_code || []).map(c =>
  `- ${c.path} (${c.type}, ${c.risk}): ${c.reason}`
).join('\n') || '(none)'}
`)
```

**Step 3.3: Dry-Run Exit**
```javascript
if (isDryRun) {
  console.log(`
---
**Dry-run mode**: No changes made.
Manifest saved to: ${sessionFolder}/cleanup-manifest.json

To execute cleanup: /workflow:clean
`)
  return
}
```

**Step 3.4: User Confirmation**
```javascript
// Skip confirmation if no items to clean
if (manifest.summary.total_items === 0) {
  console.log('Codebase is clean. No items to delete.')
  return
}

const userSelection = AskUserQuestion({
  questions: [
    {
      question: "Which categories to clean?",
      header: "Categories",
      multiSelect: true,
      options: [
        {
          label: "Sessions",
          description: `${manifest.summary.by_category.stale_sessions} stale workflow sessions`
        },
        {
          label: "Documents",
          description: `${manifest.summary.by_category.drifted_documents} drifted documents`
        },
        {
          label: "Dead Code",
          description: `${manifest.summary.by_category.dead_code} unused code files`
        }
      ]
    },
    {
      question: "Risk level to include?",
      header: "Risk",
      multiSelect: false,
      options: [
        { label: "Low only", description: "Safest - only obviously stale items (Recommended)" },
        { label: "Low + Medium", description: "Includes likely unused items" },
        { label: "All", description: "Aggressive - includes high-risk items" }
      ]
    }
  ]
})
```

---

### Phase 4: Execution

**Step 4.1: Filter Items by Selection**
```javascript
const selectedCategories = userSelection.categories || []
const riskLevel = userSelection.risk || 'Low only'

const riskFilter = {
  'Low only': ['low'],
  'Low + Medium': ['low', 'medium'],
  'All': ['low', 'medium', 'high']
}[riskLevel]

const itemsToClean = []

if (selectedCategories.includes('Sessions')) {
  itemsToClean.push(...(manifest.discoveries.stale_sessions || []).filter(s => riskFilter.includes(s.risk)))
}
if (selectedCategories.includes('Documents')) {
  itemsToClean.push(...(manifest.discoveries.drifted_documents || []).filter(d => riskFilter.includes(d.risk)))
}
if (selectedCategories.includes('Dead Code')) {
  itemsToClean.push(...(manifest.discoveries.dead_code || []).filter(c => riskFilter.includes(c.risk)))
}

if (itemsToClean.length === 0) {
  console.log('No items match the selected criteria.')
  return
}

console.log(`\nPreparing to clean ${itemsToClean.length} items...`)

// Create todo list for tracking
TodoWrite({
  todos: itemsToClean.map(item => ({
    content: `Clean: ${item.path}`,
    status: "pending",
    activeForm: `Cleaning ${item.path}`
  }))
})
```

**Step 4.2: Validate All Paths (Security Check)**
```javascript
const validItems = []
const invalidItems = []

for (const item of itemsToClean) {
  const pathValidation = validatePathForDeletion(item.path, projectRoot)
  if (pathValidation.valid) {
    validItems.push(item)
  } else {
    invalidItems.push({ ...item, validationError: pathValidation.reason })
  }
}

if (invalidItems.length > 0) {
  console.log(`\nWarning: ${invalidItems.length} items failed security validation:`)
  invalidItems.forEach(item => {
    console.log(`  - ${item.path}: ${item.validationError}`)
  })
}

if (validItems.length === 0) {
  console.log('No valid items to clean after security validation.')
  return
}

console.log(`\n${validItems.length} items passed security validation.`)
```

**Step 4.3: Stage Deletion (Move to .trash)**
```javascript
const results = {
  staged: [],
  deleted: [],
  failed: [],
  skipped: invalidItems.map(i => ({ path: i.path, reason: i.validationError }))
}

console.log('\nStaging items for deletion...')

for (const item of validItems) {
  try {
    // Check if path exists
    const pathType = dirExists(item.path) ? 'dir' : (fileExists(item.path) ? 'file' : null)

    if (!pathType) {
      results.skipped.push({ path: item.path, reason: 'Path does not exist' })
      continue
    }

    // Create target directory in trash
    const trashTarget = `${trashFolder}/${item.path.replace(/\//g, '_')}`

    // Move to trash (staging)
    Bash({ command: `mv "${item.path}" "${trashTarget}"` })

    results.staged.push({
      path: item.path,
      trashPath: trashTarget,
      type: pathType
    })

  } catch (error) {
    results.failed.push({ path: item.path, error: error.message })
  }
}

console.log(`Staged: ${results.staged.length}, Failed: ${results.failed.length}, Skipped: ${results.skipped.length}`)
```

**Step 4.4: Update Manifests**
```javascript
// Update archives manifest if sessions were deleted
if (selectedCategories.includes('Sessions') && results.staged.length > 0) {
  const archiveManifestPath = '.workflow/archives/manifest.json'

  if (fileExists(archiveManifestPath)) {
    try {
      const archiveContent = Read(archiveManifestPath)
      const archiveManifest = safeJsonParse(archiveContent, [])

      if (Array.isArray(archiveManifest)) {
        const deletedSessionIds = results.staged
          .filter(s => s.path.includes('WFS-'))
          .map(s => s.path.split('/').pop())

        const updatedManifest = archiveManifest.filter(entry =>
          !deletedSessionIds.includes(entry.session_id)
        )

        Write(archiveManifestPath, JSON.stringify(updatedManifest, null, 2))
        console.log('Updated archives manifest.')
      }
    } catch (error) {
      console.error(`Warning: Failed to update archives manifest: ${error.message}`)
    }
  }
}

// Update project-tech.json if features referenced deleted sessions
const projectPath = '.workflow/project-tech.json'

if (fileExists(projectPath)) {
  try {
    const projectContent = Read(projectPath)
    const project = safeJsonParse(projectContent)

    if (project && Array.isArray(project.features)) {
      const deletedPaths = new Set(results.staged.map(s => s.path))

      project.features = project.features.filter(f =>
        !deletedPaths.has(f.traceability?.archive_path)
      )

      project.statistics = project.statistics || {}
      project.statistics.total_features = project.features.length
      project.statistics.last_updated = getUtc8ISOString()

      Write(projectPath, JSON.stringify(project, null, 2))
      console.log('Updated project-tech.json.')
    }
  } catch (error) {
    console.error(`Warning: Failed to update project-tech.json: ${error.message}`)
  }
}
```

**Step 4.5: Permanent Deletion**
```javascript
console.log('\nPermanently deleting staged items...')

for (const staged of results.staged) {
  try {
    Bash({ command: `rm -rf "${staged.trashPath}"` })
    results.deleted.push(staged.path)
  } catch (error) {
    console.error(`Failed to delete ${staged.trashPath}: ${error.message}`)
    // Item remains in trash for manual cleanup
  }
}

// Clean up trash folder if empty
Bash({ command: `rmdir "${trashFolder}" 2>/dev/null || true` })
```

**Step 4.6: Report Results**
```javascript
// Save cleanup report
const cleanupReport = {
  timestamp: getUtc8ISOString(),
  session_id: sessionId,
  selection: {
    categories: selectedCategories,
    risk_level: riskLevel
  },
  results: {
    deleted: results.deleted,
    failed: results.failed,
    skipped: results.skipped
  },
  summary: {
    total_deleted: results.deleted.length,
    total_failed: results.failed.length,
    total_skipped: results.skipped.length
  }
}

Write(`${sessionFolder}/cleanup-report.json`, JSON.stringify(cleanupReport, null, 2))

// Display final report
console.log(`
## Cleanup Complete

**Deleted**: ${results.deleted.length} items
**Failed**: ${results.failed.length} items
**Skipped**: ${results.skipped.length} items

### Deleted Items
${results.deleted.map(p => `- ${p}`).join('\n') || '(none)'}

${results.failed.length > 0 ? `
### Failed Items
${results.failed.map(f => `- ${f.path}: ${f.error}`).join('\n')}
` : ''}

${results.skipped.length > 0 ? `
### Skipped Items
${results.skipped.map(s => `- ${s.path}: ${s.reason}`).join('\n')}
` : ''}

Reports saved to: ${sessionFolder}/
`)

// Update todo list
TodoWrite({
  todos: results.deleted.map(p => ({
    content: `Clean: ${p}`,
    status: "completed",
    activeForm: `Cleaned ${p}`
  }))
})
```

---

## Session Folder Structure

```
.workflow/.clean/{YYYY-MM-DD}/
├── mainline-profile.json     # Git history analysis
├── cleanup-manifest.json     # Discovery results from agent
├── cleanup-report.json       # Execution results
└── .trash/                   # Staging area (temporary)
```

## Risk Level Definitions

| Risk | Description | Examples |
|------|-------------|----------|
| **Low** | Safe to delete, no dependencies | Empty sessions, scratchpad files, 100% broken docs |
| **Medium** | Likely unused, verify before delete | Orphan files, old archives, partially broken docs |
| **High** | May have hidden dependencies | Files with some imports, recent modifications |

## Security Features

| Feature | Description |
|---------|-------------|
| **Path Validation** | All paths checked against whitelist before deletion |
| **Traversal Protection** | Paths with `..` or outside project rejected |
| **Staged Deletion** | Items moved to .trash before permanent deletion |
| **Schema Validation** | Manifest validated before processing |
| **Safe JSON Parsing** | All JSON operations use try-catch |

## Error Handling

| Situation | Action |
|-----------|--------|
| No git repository | Skip mainline detection, use file timestamps only |
| Session in use (.archiving) | Skip with warning |
| Permission denied | Report error, continue with others |
| Manifest parse error | Abort with error message |
| Schema validation failure | Abort with detailed errors |
| Path validation failure | Skip item, report reason |
| Subagent timeout | Send prompt, retry once, then abort |
| Empty discovery | Report "codebase is clean" |

## Testing Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| No items to clean | Report "codebase is clean", exit gracefully |
| All items fail validation | Report validation errors, no deletion |
| Mixed valid/invalid items | Delete valid items, skip invalid with reasons |
| Manifest parse error | Abort with clear error message |
| Agent timeout | Retry once with prompt, then abort |
| Partial deletion failure | Complete successful items, report failures |
| Dry-run mode | Display summary, no deletion, save manifest |

## Related Commands

- `/workflow:session:complete` - Properly archive active sessions
- `/memory:compact` - Save session memory before cleanup
- `/workflow:status` - View current workflow state
