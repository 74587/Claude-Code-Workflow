# E2E Test Suite for CCW

End-to-end tests for the Claude Code Workflow (CCW) project, implementing comprehensive test scenarios based on Gemini's analysis.

## Test Files

### 1. `session-lifecycle.e2e.test.ts`
**Priority: HIGH** - Tests the complete session lifecycle (Golden Path)

**Scenarios Covered:**
- ✅ Session initialization → Add tasks → Update status → Archive
- ✅ Dual parameter format support (legacy/new)
- ✅ Boundary conditions:
  - Invalid JSON in task files
  - Non-existent session references
  - Path traversal prevention
  - Concurrent task updates
- ✅ Data preservation during archiving
- ✅ Multi-location session listing

**Key Test Cases:**
```typescript
// Golden path: Full lifecycle
init → write tasks → update status → archive

// Boundary tests
- Invalid JSON handling
- Path traversal attempts: '../../../etc/passwd'
- Concurrent updates without data loss
- Complex nested data preservation
```

### 2. `dashboard-websocket.e2e.test.ts`
**Priority: HIGH** - Tests Dashboard real-time updates via WebSocket

**Scenarios Covered:**
- ✅ WebSocket connection and event dispatch
- ✅ Fire-and-forget notification behavior
- ✅ Event types:
  - `SESSION_CREATED`
  - `SESSION_UPDATED`
  - `TASK_UPDATED`
  - `SESSION_ARCHIVED`
- ✅ Multiple concurrent WebSocket clients
- ✅ Network failure resilience
- ✅ Event payload validation
- ✅ Client reconnection handling

**Key Test Cases:**
```typescript
// Real-time updates
CLI command → HTTP hook → WebSocket broadcast → Dashboard update

// Fire-and-forget verification
Request duration < 1000ms, no blocking

// Multi-client broadcast
3 concurrent clients receive same event
```

### 3. `mcp-tools.e2e.test.ts`
**Priority: HIGH** - Tests MCP JSON-RPC tool execution

**Scenarios Covered:**
- ✅ Tool discovery (`tools/list`)
- ✅ Tool execution (`tools/call`)
- ✅ Parameter validation
- ✅ Error handling:
  - Missing required parameters
  - Invalid parameter values
  - Non-existent tools
- ✅ Security validation (path traversal prevention)
- ✅ Concurrent tool calls
- ✅ Tool schema completeness

**Key Test Cases:**
```typescript
// JSON-RPC protocol
tools/list → Returns tool schemas
tools/call → Executes with parameters

// Security
Path traversal attempt: '../../../etc/passwd' → Rejected

// Concurrency
3 parallel tool calls → No interference
```

## Running Tests

### Run All E2E Tests
```bash
npm test ccw/tests/e2e/*.test.ts
```

### Run Individual Test Suite
```bash
# Session lifecycle tests
node --experimental-strip-types --test ccw/tests/e2e/session-lifecycle.e2e.test.ts

# WebSocket tests
node --experimental-strip-types --test ccw/tests/e2e/dashboard-websocket.e2e.test.ts

# MCP tools tests
node --experimental-strip-types --test ccw/tests/e2e/mcp-tools.e2e.test.ts
```

### Run with Verbose Output
```bash
node --experimental-strip-types --test --test-reporter=spec ccw/tests/e2e/*.test.ts
```

## Test Architecture

### Mock Strategy
Following Gemini's recommendations:

1. **`executeTool` Mocking** (Avoided)
   - Tests use real `session_manager` tool for authenticity
   - Temporary directories isolate test environments

2. **`memfs` Mocking** (Not needed)
   - Tests use real filesystem with `mkdtempSync`
   - Automatic cleanup with `afterEach` hooks

3. **`http.request` Mocking** (WebSocket tests)
   - Custom `WebSocketClient` class for real protocol testing
   - Fire-and-forget behavior verified via timing measurements

### Test Fixtures

#### Session Lifecycle
```typescript
projectRoot = mkdtempSync('/tmp/ccw-e2e-session-lifecycle-')
sessionPath = projectRoot/.workflow/active/WFS-xxx
```

#### Dashboard WebSocket
```typescript
server = startServer(projectRoot, randomPort)
wsClient = new WebSocketClient()
wsClient.connect(port)
```

#### MCP Tools
```typescript
mcpClient = new McpClient()
mcpClient.start() // Spawns ccw-mcp.js
mcpClient.call('tools/list', {})
```

## Test Patterns

### Arrangement-Act-Assert (AAA)
```typescript
it('test description', async () => {
  // Arrange
  const sessionId = 'WFS-test-001';
  await sessionManager.handler({ operation: 'init', ... });

  // Act
  const result = await sessionManager.handler({ operation: 'read', ... });

  // Assert
  assert.equal(result.success, true);
  assert.equal(result.result.session_id, sessionId);
});
```

### Setup and Teardown
```typescript
before(async () => {
  projectRoot = mkdtempSync('/tmp/ccw-test-');
  process.chdir(projectRoot);
});

afterEach(() => {
  rmSync(workflowPath(projectRoot), { recursive: true, force: true });
});

after(() => {
  process.chdir(originalCwd);
  rmSync(projectRoot, { recursive: true, force: true });
});
```

### Error Assertion
```typescript
// Verify error handling
const result = await handler({ invalid: 'params' });
assert.equal(result.success, false);
assert.ok(result.error.includes('expected error message'));
```

## Boundary Conditions Tested

### Invalid Input
- ❌ Malformed JSON in files
- ❌ Missing required parameters
- ❌ Invalid parameter types
- ❌ Non-existent resources

### Security
- 🔒 Path traversal attempts: `../../../etc/passwd`
- 🔒 Invalid session ID formats: `bad/session/id`
- 🔒 Directory escape in task IDs

### Concurrency
- 🔄 Multiple simultaneous task updates
- 🔄 Concurrent WebSocket clients (3+)
- 🔄 Parallel MCP tool calls

### Network Failures
- 🌐 Dashboard server unreachable
- 🌐 WebSocket disconnect/reconnect
- 🌐 Fire-and-forget behavior (no blocking)

## Integration with Existing Tests

These E2E tests complement existing integration tests:

```
ccw/tests/
├── integration/
│   ├── session-lifecycle.test.ts      (Unit-level session ops)
│   ├── session-routes.test.ts         (HTTP API routes)
│   └── ...
└── e2e/
    ├── session-lifecycle.e2e.test.ts  (Full workflow golden path)
    ├── dashboard-websocket.e2e.test.ts (Real-time updates)
    └── mcp-tools.e2e.test.ts          (JSON-RPC protocol)
```

**Difference:**
- **Integration tests**: Test individual components in isolation
- **E2E tests**: Test complete user workflows across components

## Coverage Goals

Based on Gemini's analysis:

- ✅ **Session Lifecycle**: 100% golden path coverage
- ✅ **WebSocket Events**: All event types (`SESSION_*`, `TASK_*`)
- ✅ **MCP Tools**: Core tools (`session_manager`, `smart_search`, `write_file`, `edit_file`)
- ✅ **Boundary Conditions**: 8+ edge cases per test suite
- ✅ **Error Handling**: Consistent error format validation

## Known Limitations

1. **File System Mock**: Tests use real filesystem (not `memfs`)
   - **Reason**: Ensures compatibility with actual file operations
   - **Trade-off**: Slightly slower than in-memory tests

2. **Process Spawning**: MCP tests spawn real Node processes
   - **Reason**: Verifies JSON-RPC stdio protocol accurately
   - **Trade-off**: Platform-dependent (requires Node.js)

3. **Network Timing**: WebSocket tests may be flaky on slow systems
   - **Mitigation**: Timeout values set to 5000ms (generous)

## Future Enhancements

1. **Performance Benchmarks**
   - Measure session operations latency
   - WebSocket event dispatch time
   - MCP tool execution overhead

2. **Load Testing**
   - 100+ concurrent WebSocket clients
   - Bulk session creation (1000+ sessions)
   - High-frequency task updates

3. **Visual Testing** (Playwright)
   - Dashboard UI interaction
   - Real-time chart updates
   - Task queue drag-and-drop

## References

- **Gemini Analysis**: Based on comprehensive test analysis report
- **Node.js Test Runner**: Native test framework (no external dependencies)
- **MCP Protocol**: Model Context Protocol JSON-RPC specification
- **WebSocket Protocol**: RFC 6455 compliance

## Contributing

When adding new E2E tests:

1. Follow AAA pattern (Arrange-Act-Assert)
2. Use descriptive test names: `it('completes full session lifecycle: init → add tasks → update status → archive')`
3. Test both happy path and boundary conditions
4. Clean up resources in `afterEach` hooks
5. Mock console output to reduce noise: `mock.method(console, 'error', () => {})`
6. Add test documentation to this README

## License

MIT - Same as CCW project
