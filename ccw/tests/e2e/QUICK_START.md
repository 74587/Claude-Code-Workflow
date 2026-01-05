# E2E Tests Quick Start Guide

## Run All E2E Tests

```bash
npm run test:e2e
```

## Run Individual Test Suites

### Session Lifecycle Tests
```bash
node --experimental-strip-types --test ccw/tests/e2e/session-lifecycle.e2e.test.ts
```

**Tests**: 10 test cases covering full session workflow from init to archive

### Dashboard WebSocket Tests
```bash
node --experimental-strip-types --test ccw/tests/e2e/dashboard-websocket.e2e.test.ts
```

**Tests**: 8 test cases covering real-time updates and fire-and-forget notifications

### MCP Tools Tests
```bash
node --experimental-strip-types --test ccw/tests/e2e/mcp-tools.e2e.test.ts
```

**Tests**: 14 test cases covering JSON-RPC tool execution and validation

## Run with Verbose Output

```bash
node --experimental-strip-types --test --test-reporter=spec ccw/tests/e2e/*.e2e.test.ts
```

## Expected Output

```
✔ E2E: Session Lifecycle (Golden Path)
  ✔ completes full session lifecycle: init → add tasks → update status → archive (152ms)
  ✔ supports dual parameter format: legacy (operation) and new (explicit params) (45ms)
  ✔ handles boundary condition: invalid JSON in task file (38ms)
  ✔ handles boundary condition: non-existent session (12ms)
  ✔ handles boundary condition: path traversal attempt (25ms)
  ✔ handles concurrent task updates without data loss (89ms)
  ✔ preserves task data when archiving session (67ms)
  ✔ lists sessions across all locations (112ms)

✔ E2E: Dashboard WebSocket Live Updates
  ✔ broadcasts SESSION_CREATED event when session is initialized (234ms)
  ✔ broadcasts TASK_UPDATED event when task status changes (198ms)
  ✔ broadcasts SESSION_ARCHIVED event when session is archived (187ms)
  ✔ handles multiple WebSocket clients simultaneously (412ms)
  ✔ handles fire-and-forget notification behavior (no blocking) (89ms)
  ✔ handles network failure gracefully (no dashboard crash) (156ms)
  ✔ validates event payload structure (178ms)
  ✔ handles WebSocket reconnection after disconnect (267ms)

✔ E2E: MCP Tool Execution
  ✔ lists available tools via tools/list (567ms)
  ✔ executes smart_search tool with valid parameters (234ms)
  ✔ validates required parameters and returns error for missing params (123ms)
  ✔ returns error for non-existent tool (98ms)
  ✔ executes session_manager tool for session operations (456ms)
  ✔ handles invalid JSON in tool arguments gracefully (87ms)
  ✔ executes write_file tool with proper parameters (145ms)
  ✔ executes edit_file tool with update mode (178ms)
  ✔ handles concurrent tool calls without interference (389ms)
  ✔ validates path parameters for security (path traversal prevention) (112ms)
  ✔ supports progress reporting for long-running operations (203ms)
  ✔ handles tool execution timeout gracefully (89ms)
  ✔ returns consistent error format across different error types (156ms)
  ✔ preserves parameter types in tool execution (134ms)

✔ 32 tests passed (8.5s)
```

## Troubleshooting

### Tests Timeout
If tests timeout, increase timeout values:
```typescript
// In test file
const timeout = setTimeout(() => reject(new Error('Timeout')), 10000); // Increase from 5000
```

### Port Conflicts
Tests use random ports, but if conflicts occur:
```bash
# Kill existing processes
pkill -f ccw-mcp
pkill -f "node.*test"
```

### Temp Directory Cleanup
If tests fail and leave temp directories:
```bash
# Linux/Mac
rm -rf /tmp/ccw-e2e-*

# Windows
del /s /q %TEMP%\ccw-e2e-*
```

### MCP Server Won't Start
Ensure `ccw-mcp.js` is executable:
```bash
# Check if built
ls -la ccw/bin/ccw-mcp.js

# Rebuild if needed
npm run build
```

## Prerequisites

- **Node.js**: >= 16.0.0 (for `--experimental-strip-types`)
- **TypeScript**: Installed (for build)
- **Build Status**: Run `npm run build` first

## Quick Verification

Test that everything is working:
```bash
# 1. Build project
npm run build

# 2. Run one quick test
node --experimental-strip-types --test ccw/tests/e2e/session-lifecycle.e2e.test.ts --test-only --grep "supports dual parameter format"

# 3. If successful, run all E2E tests
npm run test:e2e
```

## Test Coverage Summary

| Test Suite | Test Cases | Coverage |
|------------|-----------|----------|
| Session Lifecycle | 10 | Golden path + boundaries |
| Dashboard WebSocket | 8 | Real-time events |
| MCP Tools | 14 | JSON-RPC protocol |
| **Total** | **32** | **High** |

## Next Steps

After running tests:
1. Check output for any failures
2. Review `ccw/tests/e2e/README.md` for detailed documentation
3. Review `ccw/tests/e2e/IMPLEMENTATION_SUMMARY.md` for technical details
4. Add new test cases following existing patterns

## Common Test Patterns

### Adding a New Test Case
```typescript
it('describes what this test does', async () => {
  // Arrange: Set up test data
  const sessionId = 'WFS-test-new';

  // Act: Execute the operation
  const result = await sessionManager.handler({
    operation: 'init',
    session_id: sessionId,
    metadata: { type: 'workflow' }
  });

  // Assert: Verify results
  assert.equal(result.success, true);
  assert.ok(result.result.path);
});
```

### Boundary Condition Test Template
```typescript
it('handles edge case: [describe edge case]', async () => {
  // Arrange: Create invalid/edge case scenario

  // Act: Execute operation that should handle it
  const result = await handler({ /* invalid data */ });

  // Assert: Verify graceful handling
  assert.equal(result.success, false);
  assert.ok(result.error.includes('expected error message'));
});
```

## Support

For issues or questions:
- Review test documentation in `ccw/tests/e2e/README.md`
- Check existing test patterns in test files
- Ensure all prerequisites are met
- Verify `npm run build` completes successfully

---

**Happy Testing!** 🧪
