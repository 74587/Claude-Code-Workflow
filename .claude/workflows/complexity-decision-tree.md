# Workflow Complexity Decision Tree

## Task Classification

```
Task Type?
├── Single file/bug fix → Simple Workflow
├── Multi-file feature → Medium Workflow  
├── System changes → Complex Workflow
└── Uncertain complexity → Start with Medium, escalate if needed
```

## Complexity Patterns

### Always Use Simple Workflow For:
- Bug fixes in single files
- Minor UI adjustments
- Text/message updates
- Simple validation additions
- Quick documentation fixes

### Always Use Medium Workflow For:
- New feature implementations
- Multi-component changes
- API endpoint additions
- Database schema updates
- Integration implementations

### Always Use Complex Workflow For:
- Architecture changes
- Security implementations
- Performance optimizations
- Migration projects
- System integrations
- Authentication/authorization systems

## Workflow Pattern Matrix

| Task Type | Recommended Workflow | Agent Sequence | Iteration Requirements |
|-----------|---------------------|----------------|----------------------|
| Bug Fix (Simple) | Simple | code-developer → review | Minimal |
| Bug Fix (Complex) | Medium | planning → developer → review | 1 round |
| New Feature (Small) | Simple | developer → review | Minimal |
| New Feature (Large) | Medium | planning → developer → review | 1-2 rounds |
| Architecture Changes | Complex | planning → developer → review → iterate | Multiple rounds |
| Security Implementation | Complex | planning → developer → review → validate | Mandatory multiple rounds |
| Performance Optimization | Complex | planning → developer → review → test | Performance validation |
| Prototype Development | Simple | developer → minimal review | Fast |

## Progressive Complexity Strategy

```bash
# Start simple and escalate as needed
/workflow simple "initial implementation"
# If complexity emerges during development:
/workflow medium "enhance with additional requirements"
# If system-wide impact discovered:
/workflow complex "complete system integration"
```