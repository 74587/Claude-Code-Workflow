---
name: manage
description: Interactive issue management (CRUD) via ccw cli endpoints with menu-driven interface
argument-hint: "[issue-id] [--action list|view|edit|delete|bulk]"
allowed-tools: TodoWrite(*), Bash(*), Read(*), Write(*), AskUserQuestion(*), Task(*)
---

# Issue Manage Command (/issue:manage)

## Overview

Interactive menu-driven interface for issue management using `ccw issue` CLI endpoints:
- **List**: Browse and filter issues
- **View**: Detailed issue inspection
- **Edit**: Modify issue fields
- **Delete**: Remove issues
- **Bulk**: Batch operations on multiple issues

## CLI Endpoints Reference

```bash
# Core endpoints (ccw issue)
ccw issue list                    # List all issues
ccw issue list <id> --json        # Get issue details
ccw issue status <id>             # Detailed status
ccw issue init <id> --title "..." # Create issue
ccw issue task <id> --title "..." # Add task

# Queue management
ccw issue queue                   # List queue
ccw issue queue add <id>          # Add to queue
ccw issue next                    # Get next task
ccw issue done <queue-id>         # Complete task
```

## Usage

```bash
# Interactive mode (menu-driven)
/issue:manage

# Direct to specific issue
/issue:manage GH-123

# Direct action
/issue:manage --action list
/issue:manage GH-123 --action edit
```

## Implementation

### Phase 1: Entry Point

```javascript
const issueId = parseIssueId(userInput);
const action = flags.action;

// Show main menu if no action specified
if (!action) {
  await showMainMenu(issueId);
} else {
  await executeAction(action, issueId);
}
```

### Phase 2: Main Menu

```javascript
async function showMainMenu(preselectedIssue = null) {
  // Fetch current issues summary
  const issuesResult = Bash('ccw issue list --json 2>/dev/null || echo "[]"');
  const issues = JSON.parse(issuesResult) || [];
  
  const queueResult = Bash('ccw issue status --json 2>/dev/null');
  const queueStatus = JSON.parse(queueResult || '{}');
  
  console.log(`
## Issue Management Dashboard

**Total Issues**: ${issues.length}
**Queue Status**: ${queueStatus.queue?.total_tasks || 0} tasks (${queueStatus.queue?.pending_count || 0} pending)

### Quick Stats
- Registered: ${issues.filter(i => i.status === 'registered').length}
- Planned: ${issues.filter(i => i.status === 'planned').length}
- Executing: ${issues.filter(i => i.status === 'executing').length}
- Completed: ${issues.filter(i => i.status === 'completed').length}
`);

  const answer = AskUserQuestion({
    questions: [{
      question: 'What would you like to do?',
      header: 'Action',
      multiSelect: false,
      options: [
        { label: 'List Issues', description: 'Browse all issues with filters' },
        { label: 'View Issue', description: 'Detailed view of specific issue' },
        { label: 'Create Issue', description: 'Add new issue from text or GitHub' },
        { label: 'Edit Issue', description: 'Modify issue fields' },
        { label: 'Delete Issue', description: 'Remove issue(s)' },
        { label: 'Bulk Operations', description: 'Batch actions on multiple issues' }
      ]
    }]
  });
  
  const selected = parseAnswer(answer);
  
  switch (selected) {
    case 'List Issues':
      await listIssuesInteractive();
      break;
    case 'View Issue':
      await viewIssueInteractive(preselectedIssue);
      break;
    case 'Create Issue':
      await createIssueInteractive();
      break;
    case 'Edit Issue':
      await editIssueInteractive(preselectedIssue);
      break;
    case 'Delete Issue':
      await deleteIssueInteractive(preselectedIssue);
      break;
    case 'Bulk Operations':
      await bulkOperationsInteractive();
      break;
  }
}
```

### Phase 3: List Issues

```javascript
async function listIssuesInteractive() {
  // Ask for filter
  const filterAnswer = AskUserQuestion({
    questions: [{
      question: 'Filter issues by status?',
      header: 'Filter',
      multiSelect: true,
      options: [
        { label: 'All', description: 'Show all issues' },
        { label: 'Registered', description: 'New, unplanned issues' },
        { label: 'Planned', description: 'Issues with bound solutions' },
        { label: 'Queued', description: 'In execution queue' },
        { label: 'Executing', description: 'Currently being worked on' },
        { label: 'Completed', description: 'Finished issues' },
        { label: 'Failed', description: 'Failed issues' }
      ]
    }]
  });
  
  const filters = parseMultiAnswer(filterAnswer);
  
  // Fetch and filter issues
  const result = Bash('ccw issue list --json');
  let issues = JSON.parse(result) || [];
  
  if (!filters.includes('All')) {
    const statusMap = {
      'Registered': 'registered',
      'Planned': 'planned',
      'Queued': 'queued',
      'Executing': 'executing',
      'Completed': 'completed',
      'Failed': 'failed'
    };
    const allowedStatuses = filters.map(f => statusMap[f]).filter(Boolean);
    issues = issues.filter(i => allowedStatuses.includes(i.status));
  }
  
  if (issues.length === 0) {
    console.log('No issues found matching filters.');
    return showMainMenu();
  }
  
  // Display issues table
  console.log(`
## Issues (${issues.length})

| ID | Status | Priority | Title |
|----|--------|----------|-------|
${issues.map(i => `| ${i.id} | ${i.status} | P${i.priority} | ${i.title.substring(0, 40)} |`).join('\n')}
`);

  // Ask for action on issue
  const actionAnswer = AskUserQuestion({
    questions: [{
      question: 'Select an issue to view/edit, or return to menu:',
      header: 'Select',
      multiSelect: false,
      options: [
        ...issues.slice(0, 10).map(i => ({
          label: i.id,
          description: i.title.substring(0, 50)
        })),
        { label: 'Back to Menu', description: 'Return to main menu' }
      ]
    }]
  });
  
  const selected = parseAnswer(actionAnswer);
  
  if (selected === 'Back to Menu') {
    return showMainMenu();
  }
  
  // View selected issue
  await viewIssueInteractive(selected);
}
```

### Phase 4: View Issue

```javascript
async function viewIssueInteractive(issueId) {
  if (!issueId) {
    // Ask for issue ID
    const issues = JSON.parse(Bash('ccw issue list --json') || '[]');
    
    const idAnswer = AskUserQuestion({
      questions: [{
        question: 'Select issue to view:',
        header: 'Issue',
        multiSelect: false,
        options: issues.slice(0, 10).map(i => ({
          label: i.id,
          description: `${i.status} - ${i.title.substring(0, 40)}`
        }))
      }]
    });
    
    issueId = parseAnswer(idAnswer);
  }
  
  // Fetch detailed status
  const result = Bash(`ccw issue status ${issueId} --json`);
  const data = JSON.parse(result);
  
  const issue = data.issue;
  const solutions = data.solutions || [];
  const bound = data.bound;
  
  console.log(`
## Issue: ${issue.id}

**Title**: ${issue.title}
**Status**: ${issue.status}
**Priority**: P${issue.priority}
**Created**: ${issue.created_at}
**Updated**: ${issue.updated_at}

### Context
${issue.context || 'No context provided'}

### Solutions (${solutions.length})
${solutions.length === 0 ? 'No solutions registered' :
  solutions.map(s => `- ${s.is_bound ? '◉' : '○'} ${s.id}: ${s.tasks?.length || 0} tasks`).join('\n')}

${bound ? `### Bound Solution: ${bound.id}\n**Tasks**: ${bound.tasks?.length || 0}` : ''}
`);

  // Show tasks if bound solution exists
  if (bound?.tasks?.length > 0) {
    console.log(`
### Tasks
| ID | Action | Scope | Title |
|----|--------|-------|-------|
${bound.tasks.map(t => `| ${t.id} | ${t.action} | ${t.scope?.substring(0, 20) || '-'} | ${t.title.substring(0, 30)} |`).join('\n')}
`);
  }
  
  // Action menu
  const actionAnswer = AskUserQuestion({
    questions: [{
      question: 'What would you like to do?',
      header: 'Action',
      multiSelect: false,
      options: [
        { label: 'Edit Issue', description: 'Modify issue fields' },
        { label: 'Plan Issue', description: 'Generate solution (/issue:plan)' },
        { label: 'Add to Queue', description: 'Queue bound solution tasks' },
        { label: 'View Queue', description: 'See queue status' },
        { label: 'Delete Issue', description: 'Remove this issue' },
        { label: 'Back to Menu', description: 'Return to main menu' }
      ]
    }]
  });
  
  const action = parseAnswer(actionAnswer);
  
  switch (action) {
    case 'Edit Issue':
      await editIssueInteractive(issueId);
      break;
    case 'Plan Issue':
      console.log(`Running: /issue:plan ${issueId}`);
      // Invoke plan skill
      break;
    case 'Add to Queue':
      Bash(`ccw issue queue add ${issueId}`);
      console.log(`✓ Added ${issueId} tasks to queue`);
      break;
    case 'View Queue':
      const queueOutput = Bash('ccw issue queue');
      console.log(queueOutput);
      break;
    case 'Delete Issue':
      await deleteIssueInteractive(issueId);
      break;
    default:
      return showMainMenu();
  }
}
```

### Phase 5: Edit Issue

```javascript
async function editIssueInteractive(issueId) {
  if (!issueId) {
    const issues = JSON.parse(Bash('ccw issue list --json') || '[]');
    const idAnswer = AskUserQuestion({
      questions: [{
        question: 'Select issue to edit:',
        header: 'Issue',
        multiSelect: false,
        options: issues.slice(0, 10).map(i => ({
          label: i.id,
          description: `${i.status} - ${i.title.substring(0, 40)}`
        }))
      }]
    });
    issueId = parseAnswer(idAnswer);
  }
  
  // Get current issue data
  const result = Bash(`ccw issue list ${issueId} --json`);
  const issueData = JSON.parse(result);
  const issue = issueData.issue || issueData;
  
  // Ask which field to edit
  const fieldAnswer = AskUserQuestion({
    questions: [{
      question: 'Which field to edit?',
      header: 'Field',
      multiSelect: false,
      options: [
        { label: 'Title', description: `Current: ${issue.title?.substring(0, 40)}` },
        { label: 'Priority', description: `Current: P${issue.priority}` },
        { label: 'Status', description: `Current: ${issue.status}` },
        { label: 'Context', description: 'Edit problem description' },
        { label: 'Labels', description: `Current: ${issue.labels?.join(', ') || 'none'}` },
        { label: 'Back', description: 'Return without changes' }
      ]
    }]
  });
  
  const field = parseAnswer(fieldAnswer);
  
  if (field === 'Back') {
    return viewIssueInteractive(issueId);
  }
  
  let updatePayload = {};
  
  switch (field) {
    case 'Title':
      const titleAnswer = AskUserQuestion({
        questions: [{
          question: 'Enter new title (or select current to keep):',
          header: 'Title',
          multiSelect: false,
          options: [
            { label: issue.title.substring(0, 50), description: 'Keep current title' }
          ]
        }]
      });
      const newTitle = parseAnswer(titleAnswer);
      if (newTitle && newTitle !== issue.title.substring(0, 50)) {
        updatePayload.title = newTitle;
      }
      break;
      
    case 'Priority':
      const priorityAnswer = AskUserQuestion({
        questions: [{
          question: 'Select priority:',
          header: 'Priority',
          multiSelect: false,
          options: [
            { label: 'P1 - Critical', description: 'Production blocking' },
            { label: 'P2 - High', description: 'Major functionality' },
            { label: 'P3 - Medium', description: 'Normal priority (default)' },
            { label: 'P4 - Low', description: 'Minor issues' },
            { label: 'P5 - Trivial', description: 'Nice to have' }
          ]
        }]
      });
      const priorityStr = parseAnswer(priorityAnswer);
      updatePayload.priority = parseInt(priorityStr.charAt(1));
      break;
      
    case 'Status':
      const statusAnswer = AskUserQuestion({
        questions: [{
          question: 'Select status:',
          header: 'Status',
          multiSelect: false,
          options: [
            { label: 'registered', description: 'New issue, not yet planned' },
            { label: 'planning', description: 'Solution being generated' },
            { label: 'planned', description: 'Solution bound, ready for queue' },
            { label: 'queued', description: 'In execution queue' },
            { label: 'executing', description: 'Currently being worked on' },
            { label: 'completed', description: 'All tasks finished' },
            { label: 'failed', description: 'Execution failed' },
            { label: 'paused', description: 'Temporarily on hold' }
          ]
        }]
      });
      updatePayload.status = parseAnswer(statusAnswer);
      break;
      
    case 'Context':
      console.log(`Current context:\n${issue.context || '(empty)'}\n`);
      const contextAnswer = AskUserQuestion({
        questions: [{
          question: 'Enter new context (problem description):',
          header: 'Context',
          multiSelect: false,
          options: [
            { label: 'Keep current', description: 'No changes' }
          ]
        }]
      });
      const newContext = parseAnswer(contextAnswer);
      if (newContext && newContext !== 'Keep current') {
        updatePayload.context = newContext;
      }
      break;
      
    case 'Labels':
      const labelsAnswer = AskUserQuestion({
        questions: [{
          question: 'Enter labels (comma-separated):',
          header: 'Labels',
          multiSelect: false,
          options: [
            { label: issue.labels?.join(',') || '', description: 'Keep current labels' }
          ]
        }]
      });
      const labelsStr = parseAnswer(labelsAnswer);
      if (labelsStr) {
        updatePayload.labels = labelsStr.split(',').map(l => l.trim());
      }
      break;
  }
  
  // Apply update if any
  if (Object.keys(updatePayload).length > 0) {
    // Read, update, write issues.jsonl
    const issuesPath = '.workflow/issues/issues.jsonl';
    const allIssues = Bash(`cat "${issuesPath}"`)
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
    
    const idx = allIssues.findIndex(i => i.id === issueId);
    if (idx !== -1) {
      allIssues[idx] = {
        ...allIssues[idx],
        ...updatePayload,
        updated_at: new Date().toISOString()
      };
      
      Write(issuesPath, allIssues.map(i => JSON.stringify(i)).join('\n'));
      console.log(`✓ Updated ${issueId}: ${Object.keys(updatePayload).join(', ')}`);
    }
  }
  
  // Continue editing or return
  const continueAnswer = AskUserQuestion({
    questions: [{
      question: 'Continue editing?',
      header: 'Continue',
      multiSelect: false,
      options: [
        { label: 'Edit Another Field', description: 'Continue editing this issue' },
        { label: 'View Issue', description: 'See updated issue' },
        { label: 'Back to Menu', description: 'Return to main menu' }
      ]
    }]
  });
  
  const cont = parseAnswer(continueAnswer);
  if (cont === 'Edit Another Field') {
    await editIssueInteractive(issueId);
  } else if (cont === 'View Issue') {
    await viewIssueInteractive(issueId);
  } else {
    return showMainMenu();
  }
}
```

### Phase 6: Delete Issue

```javascript
async function deleteIssueInteractive(issueId) {
  if (!issueId) {
    const issues = JSON.parse(Bash('ccw issue list --json') || '[]');
    const idAnswer = AskUserQuestion({
      questions: [{
        question: 'Select issue to delete:',
        header: 'Delete',
        multiSelect: false,
        options: issues.slice(0, 10).map(i => ({
          label: i.id,
          description: `${i.status} - ${i.title.substring(0, 40)}`
        }))
      }]
    });
    issueId = parseAnswer(idAnswer);
  }
  
  // Confirm deletion
  const confirmAnswer = AskUserQuestion({
    questions: [{
      question: `Delete issue ${issueId}? This will also remove associated solutions.`,
      header: 'Confirm',
      multiSelect: false,
      options: [
        { label: 'Delete', description: 'Permanently remove issue and solutions' },
        { label: 'Cancel', description: 'Keep issue' }
      ]
    }]
  });
  
  if (parseAnswer(confirmAnswer) !== 'Delete') {
    console.log('Deletion cancelled.');
    return showMainMenu();
  }
  
  // Remove from issues.jsonl
  const issuesPath = '.workflow/issues/issues.jsonl';
  const allIssues = Bash(`cat "${issuesPath}"`)
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
  
  const filtered = allIssues.filter(i => i.id !== issueId);
  Write(issuesPath, filtered.map(i => JSON.stringify(i)).join('\n'));
  
  // Remove solutions file if exists
  const solPath = `.workflow/issues/solutions/${issueId}.jsonl`;
  Bash(`rm -f "${solPath}" 2>/dev/null || true`);
  
  // Remove from queue if present
  const queuePath = '.workflow/issues/queue.json';
  if (Bash(`test -f "${queuePath}" && echo exists`) === 'exists') {
    const queue = JSON.parse(Bash(`cat "${queuePath}"`));
    queue.queue = queue.queue.filter(q => q.issue_id !== issueId);
    Write(queuePath, JSON.stringify(queue, null, 2));
  }
  
  console.log(`✓ Deleted issue ${issueId}`);
  return showMainMenu();
}
```

### Phase 7: Bulk Operations

```javascript
async function bulkOperationsInteractive() {
  const bulkAnswer = AskUserQuestion({
    questions: [{
      question: 'Select bulk operation:',
      header: 'Bulk',
      multiSelect: false,
      options: [
        { label: 'Update Status', description: 'Change status of multiple issues' },
        { label: 'Update Priority', description: 'Change priority of multiple issues' },
        { label: 'Add Labels', description: 'Add labels to multiple issues' },
        { label: 'Delete Multiple', description: 'Remove multiple issues' },
        { label: 'Queue All Planned', description: 'Add all planned issues to queue' },
        { label: 'Retry All Failed', description: 'Reset all failed tasks to pending' },
        { label: 'Back', description: 'Return to main menu' }
      ]
    }]
  });
  
  const operation = parseAnswer(bulkAnswer);
  
  if (operation === 'Back') {
    return showMainMenu();
  }
  
  // Get issues for selection
  const allIssues = JSON.parse(Bash('ccw issue list --json') || '[]');
  
  if (operation === 'Queue All Planned') {
    const planned = allIssues.filter(i => i.status === 'planned' && i.bound_solution_id);
    for (const issue of planned) {
      Bash(`ccw issue queue add ${issue.id}`);
      console.log(`✓ Queued ${issue.id}`);
    }
    console.log(`\n✓ Queued ${planned.length} issues`);
    return showMainMenu();
  }
  
  if (operation === 'Retry All Failed') {
    Bash('ccw issue retry');
    console.log('✓ Reset all failed tasks to pending');
    return showMainMenu();
  }
  
  // Multi-select issues
  const selectAnswer = AskUserQuestion({
    questions: [{
      question: 'Select issues (multi-select):',
      header: 'Select',
      multiSelect: true,
      options: allIssues.slice(0, 15).map(i => ({
        label: i.id,
        description: `${i.status} - ${i.title.substring(0, 30)}`
      }))
    }]
  });
  
  const selectedIds = parseMultiAnswer(selectAnswer);
  
  if (selectedIds.length === 0) {
    console.log('No issues selected.');
    return showMainMenu();
  }
  
  // Execute bulk operation
  const issuesPath = '.workflow/issues/issues.jsonl';
  let issues = Bash(`cat "${issuesPath}"`)
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
  
  switch (operation) {
    case 'Update Status':
      const statusAnswer = AskUserQuestion({
        questions: [{
          question: 'Select new status:',
          header: 'Status',
          multiSelect: false,
          options: [
            { label: 'registered', description: 'Reset to registered' },
            { label: 'paused', description: 'Pause issues' },
            { label: 'completed', description: 'Mark completed' }
          ]
        }]
      });
      const newStatus = parseAnswer(statusAnswer);
      issues = issues.map(i => 
        selectedIds.includes(i.id) 
          ? { ...i, status: newStatus, updated_at: new Date().toISOString() }
          : i
      );
      break;
      
    case 'Update Priority':
      const prioAnswer = AskUserQuestion({
        questions: [{
          question: 'Select new priority:',
          header: 'Priority',
          multiSelect: false,
          options: [
            { label: 'P1', description: 'Critical' },
            { label: 'P2', description: 'High' },
            { label: 'P3', description: 'Medium' },
            { label: 'P4', description: 'Low' },
            { label: 'P5', description: 'Trivial' }
          ]
        }]
      });
      const newPrio = parseInt(parseAnswer(prioAnswer).charAt(1));
      issues = issues.map(i => 
        selectedIds.includes(i.id) 
          ? { ...i, priority: newPrio, updated_at: new Date().toISOString() }
          : i
      );
      break;
      
    case 'Add Labels':
      const labelAnswer = AskUserQuestion({
        questions: [{
          question: 'Enter labels to add (comma-separated):',
          header: 'Labels',
          multiSelect: false,
          options: [
            { label: 'bug', description: 'Bug fix' },
            { label: 'feature', description: 'New feature' },
            { label: 'urgent', description: 'Urgent priority' }
          ]
        }]
      });
      const newLabels = parseAnswer(labelAnswer).split(',').map(l => l.trim());
      issues = issues.map(i => 
        selectedIds.includes(i.id) 
          ? { 
              ...i, 
              labels: [...new Set([...(i.labels || []), ...newLabels])],
              updated_at: new Date().toISOString() 
            }
          : i
      );
      break;
      
    case 'Delete Multiple':
      const confirmDelete = AskUserQuestion({
        questions: [{
          question: `Delete ${selectedIds.length} issues permanently?`,
          header: 'Confirm',
          multiSelect: false,
          options: [
            { label: 'Delete All', description: 'Remove selected issues' },
            { label: 'Cancel', description: 'Keep issues' }
          ]
        }]
      });
      if (parseAnswer(confirmDelete) === 'Delete All') {
        issues = issues.filter(i => !selectedIds.includes(i.id));
        // Clean up solutions
        for (const id of selectedIds) {
          Bash(`rm -f ".workflow/issues/solutions/${id}.jsonl" 2>/dev/null || true`);
        }
      } else {
        console.log('Deletion cancelled.');
        return showMainMenu();
      }
      break;
  }
  
  Write(issuesPath, issues.map(i => JSON.stringify(i)).join('\n'));
  console.log(`✓ Updated ${selectedIds.length} issues`);
  return showMainMenu();
}
```

### Phase 8: Create Issue (Redirect)

```javascript
async function createIssueInteractive() {
  const typeAnswer = AskUserQuestion({
    questions: [{
      question: 'Create issue from:',
      header: 'Source',
      multiSelect: false,
      options: [
        { label: 'GitHub URL', description: 'Import from GitHub issue' },
        { label: 'Text Description', description: 'Enter problem description' },
        { label: 'Quick Create', description: 'Just title and priority' }
      ]
    }]
  });
  
  const type = parseAnswer(typeAnswer);
  
  if (type === 'GitHub URL' || type === 'Text Description') {
    console.log('Use /issue:new for structured issue creation');
    console.log('Example: /issue:new https://github.com/org/repo/issues/123');
    return showMainMenu();
  }
  
  // Quick create
  const titleAnswer = AskUserQuestion({
    questions: [{
      question: 'Enter issue title:',
      header: 'Title',
      multiSelect: false,
      options: [
        { label: 'Authentication Bug', description: 'Example title' }
      ]
    }]
  });
  
  const title = parseAnswer(titleAnswer);
  
  const prioAnswer = AskUserQuestion({
    questions: [{
      question: 'Select priority:',
      header: 'Priority',
      multiSelect: false,
      options: [
        { label: 'P3 - Medium (Recommended)', description: 'Normal priority' },
        { label: 'P1 - Critical', description: 'Production blocking' },
        { label: 'P2 - High', description: 'Major functionality' }
      ]
    }]
  });
  
  const priority = parseInt(parseAnswer(prioAnswer).charAt(1));
  
  // Generate ID and create
  const id = `ISS-${Date.now()}`;
  Bash(`ccw issue init ${id} --title "${title}" --priority ${priority}`);
  
  console.log(`✓ Created issue ${id}`);
  await viewIssueInteractive(id);
}
```

## Helper Functions

```javascript
function parseAnswer(answer) {
  // Extract selected option from AskUserQuestion response
  if (typeof answer === 'string') return answer;
  if (answer.answers) {
    const values = Object.values(answer.answers);
    return values[0] || '';
  }
  return '';
}

function parseMultiAnswer(answer) {
  // Extract multiple selections
  if (typeof answer === 'string') return answer.split(',').map(s => s.trim());
  if (answer.answers) {
    const values = Object.values(answer.answers);
    return values.flatMap(v => v.split(',').map(s => s.trim()));
  }
  return [];
}

function parseFlags(input) {
  const flags = {};
  const matches = input.matchAll(/--(\w+)\s+([^\s-]+)/g);
  for (const match of matches) {
    flags[match[1]] = match[2];
  }
  return flags;
}

function parseIssueId(input) {
  const match = input.match(/^([A-Z]+-\d+|ISS-\d+|GH-\d+)/i);
  return match ? match[1] : null;
}
```

## Error Handling

| Error | Resolution |
|-------|------------|
| No issues found | Suggest creating with /issue:new |
| Issue not found | Show available issues, ask for correction |
| Invalid selection | Show error, re-prompt |
| Write failure | Check permissions, show error |
| Queue operation fails | Show ccw issue error, suggest fix |

## Related Commands

- `/issue:new` - Create structured issue
- `/issue:plan` - Plan solution for issue
- `/issue:queue` - Form execution queue
- `/issue:execute` - Execute queued tasks
- `ccw issue list` - CLI list command
- `ccw issue status` - CLI status command
