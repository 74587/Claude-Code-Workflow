# Codex Advanced Examples

> **📖 Template Structure**: See [Universal Template Structure](SKILL.md#universal-template-structure) in SKILL.md for detailed field guidelines and session resume patterns.

## Algorithm Implementation with Tests and Benchmarks

```bash
codex -C src/algorithms --full-auto exec "
PURPOSE: Implement efficient graph algorithms for social network friend suggestion feature
TASK: Create graph data structure and algorithms: 1) Directed graph with adjacency list, 2) BFS for shortest path, 3) DFS for connected components, 4) Dijkstra for weighted paths, 5) PageRank-inspired algorithm for friend scoring, 6) Friend suggestion based on mutual connections and activity
MODE: auto
CONTEXT: @{src/models/user.ts,src/models/connection.ts} Social network with 100k users, avg 150 connections per user, need to suggest friends based on: mutual friends (weight 0.5), shared interests (0.3), activity overlap (0.2). Performance target: compute suggestions for user in <100ms.
EXPECTED: Deliverables: 1) graph.ts (DirectedGraph class with generic types), 2) graph-algorithms.ts (BFS, DFS, Dijkstra, shortest path), 3) friend-suggestion.ts (scoring algorithm using graph), 4) graph.test.ts (unit tests for all operations, edge cases), 5) friend-suggestion.test.ts (test accuracy and performance), 6) benchmark.ts (measure performance with production-scale data), 7) Algorithm complexity analysis in ALGORITHMS.md
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt) | Use TypeScript generics for graph nodes | Implement efficient adjacency list (Map<NodeId, Set<NodeId>>) | Optimize for sparse graphs | Handle disconnected components | Implement early termination for BFS/DFS | Use priority queue (heap) for Dijkstra | Cache computation results with TTL | Test with graphs up to 10k nodes | Benchmark against target <100ms | Document time/space complexity (Big-O) | Include edge cases: empty graph, single node, cycles | Verify algorithm correctness with known test cases
" --skip-git-repo-check -s danger-full-access
```

**Key Points**:
- **Real-world application**: Social network friend suggestion
- **Performance targets**: <100ms with 100k users
- **Comprehensive deliverables**: Code + tests + benchmarks + docs
- **Algorithm rigor**: Complexity analysis, correctness verification

## UI Implementation from Design Screenshot

```bash
codex -i design-system.png -i dashboard-mockup.png -C src/components --full-auto exec "
PURPOSE: Implement dashboard UI matching design system for product launch
TASK: Create responsive dashboard component with: 1) Header with user menu and notifications, 2) Sidebar navigation with collapsible sections, 3) Main content area with widget grid, 4) Stat cards with icons and trend indicators, 5) Chart widgets (line, bar, pie), 6) Data table with sorting and pagination, 7) Loading states and error handling, 8) Dark mode support
MODE: auto
CONTEXT: @{src/components/**/*.tsx,src/styles/**/*.css,src/hooks/**/*.ts} React 18, TypeScript, Tailwind CSS, Recharts for charts, react-table for tables. Design system defined in design-system.png. Desktop-first responsive (breakpoints: 1024px, 768px, 640px).
EXPECTED: Deliverables: 1) Dashboard.tsx (main component), 2) Header.tsx, Sidebar.tsx, StatCard.tsx, ChartWidget.tsx, DataTable.tsx (sub-components), 3) useDashboard.ts (data fetching hook), 4) dashboard.test.tsx (component tests with React Testing Library), 5) dashboard.stories.tsx (Storybook stories for all variants), 6) Responsive behavior matches design at all breakpoints, 7) Accessibility compliance (ARIA labels, keyboard navigation), 8) Update design system docs
RULES: Match design pixel-perfect at 1024px | Use Tailwind utility classes (no custom CSS unless necessary) | Implement mobile-first responsive (collapse sidebar on mobile) | Use React.memo for performance | Implement virtual scrolling for large tables | Add loading skeletons (not spinners) | Support dark mode with CSS variables | Ensure WCAG 2.1 AA compliance | Test keyboard navigation | Add error boundaries | Use semantic HTML | Optimize images (lazy load, WebP format) | Test with real API data | Include empty states | Document component props with TypeScript interfaces
" --skip-git-repo-check -s danger-full-access
```

**Key Points**:
- **Image input**: Design files provided with -i flag
- **Comprehensive UI**: Multiple sub-components with state management
- **Quality focus**: Accessibility, performance, responsive design, testing
- **Production-ready**: Error handling, loading states, dark mode

## Security-Focused Implementation with Multiple Templates

```bash
codex -C src/api --full-auto exec "
PURPOSE: Implement admin API with security hardening for enterprise compliance
TASK: Create admin endpoints for user management: 1) List users with advanced filtering, 2) Update user roles and permissions, 3) Suspend/activate users, 4) Audit log viewing, 5) Export user data (GDPR compliance). Implement comprehensive security controls.
MODE: auto
CONTEXT: @{src/models/user.ts,src/middleware/auth.ts,src/middleware/rbac.ts} Admin users have 'admin' role in RBAC. Must comply with SOC 2, log all admin actions, implement IP whitelist, require MFA for admin access.
EXPECTED: Deliverables: 1) admin.controller.ts (5 endpoints), 2) admin.service.ts (business logic with security checks), 3) audit-log.service.ts (log all admin actions), 4) IP whitelist middleware, 5) MFA verification middleware for admin routes, 6) admin.test.ts (security tests >90% coverage), 7) Update SECURITY.md with admin security controls
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt) $(cat ~/.claude/workflows/cli-templates/prompts/analysis/security.txt) | Implement defense in depth: auth + RBAC + MFA + IP whitelist | Log all admin actions with: timestamp, user, action, target, IP, result | Require MFA verification for sensitive operations | Validate IP against whitelist | Implement rate limiting: 20 req/min for admin endpoints | Sanitize all inputs | Use parameterized queries only | Implement audit log retention (7 years for SOC 2) | Add admin action confirmation for destructive ops | Test authorization bypass attempts | Verify no privilege escalation possible | Document security controls in code comments | Include security test scenarios: unauthorized access, role escalation, missing MFA, IP outside whitelist
" --skip-git-repo-check -s danger-full-access
```

**Key Points**:
- **Two templates**: Feature + Security combined
- **Compliance focus**: SOC 2 requirements, audit logging
- **Defense in depth**: Multiple security layers
- **Comprehensive testing**: Security scenarios explicitly tested

## Session Management Example

For interactive session resume patterns and decision rules, see [session-management.md](session-management.md).

**Quick Example**:
```bash
# Show all available sessions for selection
codex resume

# Resume most recent session directly
codex resume --last
```
