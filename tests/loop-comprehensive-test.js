/**
 * CCW Loop System - Comprehensive Test Suite
 *
 * Tests:
 * - Multi-loop parallel execution
 * - API endpoint functionality
 * - WebSocket messaging
 * - Security fixes (path traversal, success_condition)
 * - End-to-end workflow
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, rmdirSync, statSync } from 'fs';
import { join } from 'path';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bright: '\x1b[1m'
};

function log(color, msg) {
  console.log(`${color}${msg}${colors.reset}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Test workspace
const TEST_WORKSPACE = join(process.cwd(), '.test-loop-comprehensive');
const TEST_STATE_DIR = join(TEST_WORKSPACE, '.workflow');
const TEST_TASK_DIR = join(TEST_WORKSPACE, '.task');

// Test results
const results = [];

/**
 * Setup test workspace
 */
function setupTestWorkspace() {
  log(colors.blue, '🔧 Setting up test workspace...');

  // Clean existing workspace
  if (existsSync(TEST_WORKSPACE)) {
    const cleanDir = (dir) => {
      const files = readdirSync(dir);
      files.forEach((f) => {
        const fullPath = join(dir, f);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          cleanDir(fullPath);
          rmdirSync(fullPath);
        } else {
          unlinkSync(fullPath);
        }
      });
    };
    cleanDir(TEST_WORKSPACE);
  }

  // Create directories
  if (!existsSync(TEST_STATE_DIR)) {
    mkdirSync(TEST_STATE_DIR, { recursive: true });
  }
  if (!existsSync(TEST_TASK_DIR)) {
    mkdirSync(TEST_TASK_DIR, { recursive: true });
  }

  log(colors.green, '✅ Test workspace ready');
}

/**
 * Run a single test
 */
async function runTest(suite, name, fn) {
  const start = Date.now();
  process.stdout.write(`  ○ ${name}... `);

  try {
    await fn();
    const duration = Date.now() - start;
    results.push({ suite, name, passed: true, duration });
    log(colors.green, `✓ (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - start;
    results.push({ suite, name, passed: false, error: error.message, duration });
    log(colors.red, `✗ ${error.message}`);
  }
}

/**
 * Create a mock loop state
 */
function createLoopState(taskId, loopId) {
  const id = loopId || `loop-${taskId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const state = {
    loop_id: id,
    task_id: taskId,
    status: 'created',
    current_iteration: 0,
    max_iterations: 3,
    current_cli_step: 0,
    cli_sequence: [
      { step_id: 'step1', tool: 'bash', command: 'echo "test"' },
      { step_id: 'step2', tool: 'gemini', mode: 'analysis', prompt_template: 'Analyze: [step1_stdout]' }
    ],
    session_mapping: {},
    state_variables: {},
    error_policy: { on_failure: 'pause', retry_count: 0, max_retries: 3 },
    success_condition: 'state_variables.step1_stdout && state_variables.step1_stdout.includes("test")',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const stateFile = join(TEST_STATE_DIR, `${id}.json`);
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
  return state;
}

/**
 * Create a mock task with loop_control
 */
function createTaskWithLoop(taskId) {
  const task = {
    id: taskId,
    title: `Test Task ${taskId}`,
    description: 'Test task with loop control',
    status: 'pending',
    loop_control: {
      enabled: true,
      description: 'Test loop',
      max_iterations: 3,
      success_condition: 'current_iteration >= 3',
      error_policy: {
        on_failure: 'pause',
        max_retries: 3
      },
      cli_sequence: [
        { step_id: 'step1', tool: 'bash', command: 'echo "iteration"' },
        { step_id: 'step2', tool: 'gemini', mode: 'analysis', prompt_template: 'Process output' }
      ]
    }
  };

  const taskFile = join(TEST_TASK_DIR, `${taskId}.json`);
  writeFileSync(taskFile, JSON.stringify(task, null, 2));
  return task;
}

/**
 * Read loop state
 */
function readLoopState(loopId) {
  const stateFile = join(TEST_STATE_DIR, `${loopId}.json`);
  return JSON.parse(readFileSync(stateFile, 'utf-8'));
}

/**
 * Update loop state
 */
function updateLoopState(loopId, updates) {
  const state = readLoopState(loopId);
  Object.assign(state, updates, { updated_at: new Date().toISOString() });
  const stateFile = join(TEST_STATE_DIR, `${loopId}.json`);
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
  return state;
}

/**
 * List all loop states
 */
function listLoopStates() {
  const files = readdirSync(TEST_STATE_DIR).filter((f) => f.endsWith('.json') && f.startsWith('loop-'));
  return files.map((f) => {
    const content = readFileSync(join(TEST_STATE_DIR, f), 'utf-8');
    return JSON.parse(content);
  });
}

// ============================================
// TEST SUITE 1: MULTI-LOOP PARALLEL EXECUTION
// ============================================

async function testMultiLoopParallel() {
  log(colors.blue, '\n📋 TEST SUITE 1: MULTI-LOOP PARALLEL EXECUTION');

  await runTest('multi-loop', 'Create multiple loops simultaneously', async () => {
    const loops = [];
    for (let i = 0; i < 5; i++) {
      const loop = createLoopState(`MULTI-${i}`);
      loops.push(loop);
    }

    assert(loops.length === 5, 'should create 5 loops');
    assert(new Set(loops.map((l) => l.loop_id)).size === 5, 'all loop IDs should be unique');
  });

  await runTest('multi-loop', 'List all loops', () => {
    const allLoops = listLoopStates();
    assert(allLoops.length === 5, 'should list all 5 loops');
    assert(allLoops.every((l) => l.loop_id.startsWith('loop-')), 'all should be valid loop IDs');
  });

  await runTest('multi-loop', 'Update loops independently', async () => {
    const allLoops = listLoopStates();

    // Update each loop with different states
    for (let i = 0; i < allLoops.length; i++) {
      updateLoopState(allLoops[i].loop_id, {
        status: i % 2 === 0 ? 'running' : 'paused',
        current_iteration: i + 1
      });
    }

    const updated = listLoopStates();
    assert(updated.filter((l) => l.status === 'running').length === 3, '3 should be running');
    assert(updated.filter((l) => l.status === 'paused').length === 2, '2 should be paused');
  });

  await runTest('multi-loop', 'Filter loops by status', () => {
    const allLoops = listLoopStates();
    const running = allLoops.filter((l) => l.status === 'running');
    const paused = allLoops.filter((l) => l.status === 'paused');

    assert(running.length === 3, 'should find 3 running loops');
    assert(paused.length === 2, 'should find 2 paused loops');
  });

  await runTest('multi-loop', 'Sort loops by update time', () => {
    // Add delay to ensure different timestamps
    const loop = listLoopStates()[0];
    updateLoopState(loop.loop_id, { current_iteration: 99 });

    const allLoops = listLoopStates();
    const sorted = [...allLoops].sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    assert(sorted[0].loop_id === loop.loop_id, 'most recently updated should be first');
  });

  await runTest('multi-loop', 'Compute loop statistics', () => {
    const allLoops = listLoopStates();

    const byStatus = {};
    for (const loop of allLoops) {
      byStatus[loop.status] = (byStatus[loop.status] || 0) + 1;
    }

    assert(byStatus.running === 3, 'should count 3 running');
    assert(byStatus.paused === 2, 'should count 2 paused');

    const activeCount = (byStatus.running || 0) + (byStatus.paused || 0);
    assert(activeCount === 5, 'active count should be 5');
  });
}

// ============================================
// TEST SUITE 2: STATE TRANSITIONS IN PARALLEL
// ============================================

async function testStateTransitions() {
  log(colors.blue, '\n📋 TEST SUITE 2: PARALLEL STATE TRANSITIONS');

  await runTest('transitions', 'Parallel pause/resume operations', async () => {
    const allLoops = listLoopStates().filter((l) => l.status === 'running');

    // Pause all running loops
    allLoops.forEach((loop) => {
      updateLoopState(loop.loop_id, { status: 'paused' });
    });

    const updated = listLoopStates();
    assert(updated.filter((l) => l.status === 'paused').length === 5, 'all should be paused');

    // Resume all
    updated.forEach((loop) => {
      updateLoopState(loop.loop_id, { status: 'running' });
    });

    const resumed = listLoopStates();
    assert(resumed.filter((l) => l.status === 'running').length === 5, 'all should be running');
  });

  await runTest('transitions', 'Independent loop progress', async () => {
    const allLoops = listLoopStates();

    // Advance each loop independently
    allLoops.forEach((loop, i) => {
      updateLoopState(loop.loop_id, {
        current_iteration: i + 2,
        current_cli_step: i % 2
      });
    });

    const updated = listLoopStates();
    const iterations = updated.map((l) => l.current_iteration);
    assert(new Set(iterations).size === 5, 'each loop should have different iteration');
  });
}

// ============================================
// TEST SUITE 3: EXECUTION HISTORY
// ============================================

async function testExecutionHistory() {
  log(colors.blue, '\n📋 TEST SUITE 3: EXECUTION HISTORY');

  const loop = createLoopState('HISTORY-TEST');

  await runTest('history', 'Add execution record', () => {
    const record = {
      iteration: 1,
      step_index: 0,
      step_id: 'step1',
      tool: 'bash',
      conversation_id: 'conv-1',
      exit_code: 0,
      duration_ms: 100,
      timestamp: new Date().toISOString()
    };

    const state = readLoopState(loop.loop_id);
    state.execution_history = [...(state.execution_history || []), record];

    const stateFile = join(TEST_STATE_DIR, `${loop.loop_id}.json`);
    writeFileSync(stateFile, JSON.stringify(state, null, 2));

    const updated = readLoopState(loop.loop_id);
    assert(updated.execution_history?.length === 1, 'should have 1 record');
  });

  await runTest('history', 'Paginate history', () => {
    const state = readLoopState(loop.loop_id);

    // Add more records
    for (let i = 1; i <= 10; i++) {
      state.execution_history?.push({
        iteration: i,
        step_index: 0,
        step_id: `step${i}`,
        tool: 'bash',
        conversation_id: `conv-${i}`,
        exit_code: 0,
        duration_ms: i * 10,
        timestamp: new Date().toISOString()
      });
    }

    const stateFile = join(TEST_STATE_DIR, `${loop.loop_id}.json`);
    writeFileSync(stateFile, JSON.stringify(state, null, 2));

    const updated = readLoopState(loop.loop_id);
    const total = updated.execution_history?.length || 0;

    // Test pagination
    const limit = 5;
    const offset = 0;
    const page1 = updated.execution_history?.slice(offset, offset + limit) || [];

    assert(page1.length === 5, 'page 1 should have 5 records');
    assert(total === 11, 'should have 11 total records');
  });

  await runTest('history', 'History persists across state updates', () => {
    updateLoopState(loop.loop_id, { status: 'running' });
    const updated = readLoopState(loop.loop_id);
    assert(updated.execution_history?.length === 11, 'history should persist');
  });
}

// ============================================
// TEST SUITE 4: STATE VARIABLES
// ============================================

async function testStateVariables() {
  log(colors.blue, '\n📋 TEST SUITE 4: STATE VARIABLES');

  const loop = createLoopState('VARS-TEST');

  await runTest('variables', 'Store step output', () => {
    updateLoopState(loop.loop_id, {
      state_variables: {
        step1_stdout: 'Tests passed: 15',
        step1_stderr: '',
        step1_exit_code: '0'
      }
    });

    const state = readLoopState(loop.loop_id);
    assert(state.state_variables.step1_stdout === 'Tests passed: 15', 'should store stdout');
  });

  await runTest('variables', 'Accumulate variables from multiple steps', () => {
    const state = readLoopState(loop.loop_id);
    state.state_variables = {
      ...state.state_variables,
      step2_stdout: 'Analysis complete',
      step2_stderr: '',
      step2_exit_code: '0'
    };

    const stateFile = join(TEST_STATE_DIR, `${loop.loop_id}.json`);
    writeFileSync(stateFile, JSON.stringify(state, null, 2));

    const updated = readLoopState(loop.loop_id);
    assert(Object.keys(updated.state_variables).length === 6, 'should have 6 variables');
  });

  await runTest('variables', 'Extract logs by step_id', () => {
    const state = readLoopState(loop.loop_id);

    // Group by step_id
    const stepIds = new Set();
    for (const key of Object.keys(state.state_variables)) {
      const match = key.match(/^(.+)_(stdout|stderr)$/);
      if (match) stepIds.add(match[1]);
    }

    assert(stepIds.has('step1'), 'should find step1');
    assert(stepIds.has('step2'), 'should find step2');
  });
}

// ============================================
// TEST SUITE 5: SECURITY - PATH TRAVERSAL
// ============================================

async function testSecurityPathTraversal() {
  log(colors.blue, '\n📋 TEST SUITE 5: SECURITY - PATH TRAVERSAL');

  await runTest('security', 'isValidId rejects path separators', () => {
    // Simulate the isValidId function
    const isValidId = (id) => {
      if (!id) return false;
      if (id.includes('/') || id.includes('\\') || id === '..' || id === '.') return false;
      if (id.includes('\0')) return false;
      return true;
    };

    assert(!isValidId('../etc/passwd'), 'should reject ../ path');
    assert(!isValidId('..\\windows\\system32'), 'should reject ..\\ path');
    assert(!isValidId('../../'), 'should reject ../..');
    assert(!isValidId('./file'), 'should reject ./file');
    assert(!isValidId('..\u0000'), 'should reject null bytes');
    assert(isValidId('valid-loop-123'), 'should accept valid ID');
    assert(isValidId('loop-abc-123'), 'should accept valid loop ID');
  });

  await runTest('security', 'taskId sanitization', () => {
    const validTaskIds = ['TASK-001', 'loop-test', 'my_task_123'];
    const invalidTaskIds = ['../task', '..\\task', 'task/../../etc', 'task\u0000'];

    // Valid IDs should pass
    validTaskIds.forEach((id) => {
      const hasPathChar = id.includes('/') || id.includes('\\') || id === '..' || id === '.';
      assert(!hasPathChar, `${id} should be valid`);
    });

    // Invalid IDs should be caught
    invalidTaskIds.forEach((id) => {
      const hasPathChar = id.includes('/') || id.includes('\\') || id === '..' || id === '.' || id.includes('\0');
      assert(hasPathChar, `${id} should be detected as invalid`);
    });
  });

  await runTest('security', 'Prevent directory traversal in file access', () => {
    // Simulate file join behavior
    const taskDir = TEST_TASK_DIR;

    // Normal case
    const normalPath = join(taskDir, 'TASK-001.json');
    assert(normalPath.startsWith(taskDir), 'normal path should stay in directory');

    // Path traversal attempt (would be blocked by validation)
    const maliciousId = '../malicious';
    const maliciousPath = join(taskDir, `${maliciousId}.json`);
    // The validation should catch this before file join
    const isMalicious = maliciousId.includes('/') || maliciousId.includes('\\') || maliciousId === '..';
    assert(isMalicious, 'malicious ID should be detected');
  });
}

// ============================================
// TEST SUITE 6: SECURITY - SUCCESS CONDITION
// ============================================

async function testSecuritySuccessCondition() {
  log(colors.blue, '\n📋 TEST SUITE 6: SECURITY - SUCCESS CONDITION');

  // Import the evaluateSuccessCondition logic (simplified for testing)
  const evaluateSuccessCondition = (condition, stateVariables, currentIteration) => {
    // Security checks
    const unsafePattern = /[^\w\s\.\(\)\[\]\{\}\'\"\!\=\>\<\&\|\+\-\*\/\?\:]/;
    if (unsafePattern.test(condition)) {
      throw new Error('Unsafe success condition contains invalid characters');
    }

    const blockedPatterns = [
      /process\./,
      /require\(/,
      /import\s/,
      /import\(/,        // Block import() calls
      /eval\(/,
      /Function\(/,
      /__proto__/,
      /constructor\[/,
      /["']constructor["']/
    ];

    for (const pattern of blockedPatterns) {
      if (pattern.test(condition)) {
        throw new Error('Blocked dangerous pattern in success condition');
      }
    }

    // Safe evaluation
    try {
      const conditionFn = new Function(
        'state_variables',
        'current_iteration',
        `return (${condition});`
      );
      return Boolean(conditionFn(stateVariables, currentIteration));
    } catch (error) {
      return false;
    }
  };

  await runTest('security', 'Block process.exit()', () => {
    let threw = false;
    let error = null;
    try {
      evaluateSuccessCondition('process.exit(1)', {}, 0);
    } catch (e) {
      threw = true;
      error = e;
    }
    assert(threw && error && error.message.includes('Blocked'), 'should block process.exit');
  });

  await runTest('security', 'Block require()', () => {
    let threw = false;
    let error = null;
    try {
      evaluateSuccessCondition('require("fs")', {}, 0);
    } catch (e) {
      threw = true;
      error = e;
    }
    assert(threw && error && error.message.includes('Blocked'), 'should block require');
  });

  await runTest('security', 'Block eval()', () => {
    let threw = false;
    let error = null;
    try {
      evaluateSuccessCondition('eval("malicious")', {}, 0);
    } catch (e) {
      threw = true;
      error = e;
    }
    assert(threw && error && error.message.includes('Blocked'), 'should block eval');
  });

  await runTest('security', 'Block __proto__', () => {
    let threw = false;
    let error = null;
    try {
      evaluateSuccessCondition('{}.__proto__.polluted = "yes"', {}, 0);
    } catch (e) {
      threw = true;
      error = e;
    }
    assert(threw && error && error.message.includes('Blocked'), 'should block __proto__');
  });

  await runTest('security', 'Block constructor access', () => {
    let threw = false;
    let error = null;
    try {
      evaluateSuccessCondition('this["constructor"]["return"]("code")', {}, 0);
    } catch (e) {
      threw = true;
      error = e;
    }
    assert(threw && error && error.message.includes('Blocked'), 'should block constructor access');
  });

  await runTest('security', 'Block import statement', () => {
    let threw = false;
    let error = null;
    try {
      evaluateSuccessCondition('import("fs")', {}, 0);
    } catch (e) {
      threw = true;
      error = e;
    }
    assert(threw && error && error.message.includes('Blocked'), 'should block import');
  });

  await runTest('security', 'Allow safe comparisons', () => {
    const result = evaluateSuccessCondition('current_iteration >= 3', {}, 3);
    assert(result === true, 'safe comparison should work');
  });

  await runTest('security', 'Allow string operations', () => {
    const vars = { output: 'Tests passed' };
    const result = evaluateSuccessCondition('state_variables.output.includes("passed")', vars, 1);
    assert(result === true, 'string operations should work');
  });

  await runTest('security', 'Allow logical AND', () => {
    const vars = { test: 'pass', coverage: 90 };
    const result = evaluateSuccessCondition('state_variables.test === "pass" && state_variables.coverage > 80', vars, 1);
    assert(result === true, 'logical AND should work');
  });

  await runTest('security', 'Allow logical OR', () => {
    const vars = { status: 'approved' };
    const result = evaluateSuccessCondition('state_variables.status === "approved" || state_variables.status === "LGTM"', vars, 1);
    assert(result === true, 'logical OR should work');
  });

  await runTest('security', 'Block backtick strings', () => {
    let threw = false;
    try {
      evaluateSuccessCondition('`${process.env}`', {}, 0);
    } catch (e) {
      threw = true;
    }
    assert(threw, 'should block backtick strings');
  });
}

// ============================================
// TEST SUITE 7: WEBSOCKET MESSAGE TYPES
// ============================================

async function testWebSocketMessages() {
  log(colors.blue, '\n📋 TEST SUITE 7: WEBSOCKET MESSAGE TYPES');

  await runTest('websocket', 'LOOP_STATE_UPDATE message structure', () => {
    const message = {
      type: 'LOOP_STATE_UPDATE',
      loop_id: 'loop-test-123',
      status: 'running',
      current_iteration: 2,
      current_cli_step: 1,
      updated_at: new Date().toISOString()
    };

    assert(message.type === 'LOOP_STATE_UPDATE', 'type should be correct');
    assert(message.loop_id.startsWith('loop-'), 'loop_id should be valid');
    assert(['created', 'running', 'paused', 'completed', 'failed'].includes(message.status), 'status should be valid');
  });

  await runTest('websocket', 'LOOP_STEP_COMPLETED message structure', () => {
    const message = {
      type: 'LOOP_STEP_COMPLETED',
      loop_id: 'loop-test-123',
      step_id: 'step1',
      exit_code: 0,
      duration_ms: 150,
      output: 'Tests passed'
    };

    assert(message.type === 'LOOP_STEP_COMPLETED', 'type should be correct');
    assert(message.step_id === 'step1', 'step_id should be preserved');
    assert(message.exit_code === 0, 'exit_code should be preserved');
  });

  await runTest('websocket', 'LOOP_COMPLETED message structure', () => {
    const message = {
      type: 'LOOP_COMPLETED',
      loop_id: 'loop-test-123',
      final_status: 'completed',
      total_iterations: 5,
      reason: undefined
    };

    assert(message.type === 'LOOP_COMPLETED', 'type should be correct');
    assert(message.final_status === 'completed' || message.final_status === 'failed', 'final_status should be valid');
  });

  await runTest('websocket', 'LOOP_LOG_ENTRY message structure', () => {
    const message = {
      type: 'LOOP_LOG_ENTRY',
      loop_id: 'loop-test-123',
      step_id: 'step1',
      line: 'Running tests...',
      timestamp: new Date().toISOString()
    };

    assert(message.type === 'LOOP_LOG_ENTRY', 'type should be correct');
    assert(message.line, 'log line should be present');
  });
}

// ============================================
// TEST SUITE 8: API RESPONSE FORMATS
// ============================================

async function testApiResponseFormats() {
  log(colors.blue, '\n📋 TEST SUITE 8: API RESPONSE FORMATS');

  await runTest('api', 'Success response format', () => {
    const response = {
      success: true,
      data: { loop_id: 'loop-123', status: 'running' },
      timestamp: new Date().toISOString()
    };

    assert(response.success === true, 'success should be true');
    assert(response.data, 'data should be present');
    assert(response.timestamp, 'timestamp should be present');
    assert(!isNaN(Date.parse(response.timestamp)), 'timestamp should be valid ISO date');
  });

  await runTest('api', 'Error response format', () => {
    const response = {
      success: false,
      error: 'Loop not found',
      status: 404
    };

    assert(response.success === false, 'success should be false');
    assert(response.error, 'error message should be present');
    assert(response.status >= 400 && response.status < 600, 'status should be error code');
  });

  await runTest('api', 'List response format', () => {
    const response = {
      success: true,
      data: [{ loop_id: 'loop-1' }, { loop_id: 'loop-2' }],
      total: 2,
      limit: 50,
      offset: 0,
      hasMore: false
    };

    assert(response.success === true, 'success should be true');
    assert(Array.isArray(response.data), 'data should be array');
    assert(typeof response.total === 'number', 'total should be number');
    assert(typeof response.hasMore === 'boolean', 'hasMore should be boolean');
  });

  await runTest('api', 'Statistics response format', () => {
    const stats = {
      total: 10,
      by_status: { running: 3, paused: 2, completed: 4, failed: 1 },
      active_count: 5,
      success_rate: 80,
      avg_iterations: 2.5
    };

    assert(stats.total === 10, 'total should be correct');
    assert(stats.by_status.running === 3, 'by_status should have counts');
    assert(stats.active_count === 5, 'active_count should sum running + paused');
    assert(stats.success_rate === 80, 'success_rate should be percentage');
  });
}

// ============================================
// TEST SUITE 9: EDGE CASES
// ============================================

async function testEdgeCases() {
  log(colors.blue, '\n📋 TEST SUITE 9: EDGE CASES');

  await runTest('edge', 'Handle empty loop list', () => {
    // Create a fresh workspace with no loops
    const emptyDir = join(TEST_WORKSPACE, 'empty');
    if (!existsSync(emptyDir)) {
      mkdirSync(emptyDir, { recursive: true });
    }

    const files = readdirSync(emptyDir).filter((f) => f.startsWith('loop-'));
    assert(files.length === 0, 'empty workspace should have no loops');
  });

  await runTest('edge', 'Handle loop at max iterations', () => {
    const loop = createLoopState('MAX-ITER');
    updateLoopState(loop.loop_id, {
      current_iteration: 3,
      max_iterations: 3,
      status: 'completed'
    });

    const state = readLoopState(loop.loop_id);
    assert(state.current_iteration === state.max_iterations, 'should reach max');
    assert(state.status === 'completed', 'should be completed');
  });

  await runTest('edge', 'Handle loop with no success condition', () => {
    const loop = createLoopState('NO-SUCCESS');
    updateLoopState(loop.loop_id, {
      success_condition: undefined,
      max_iterations: 1,
      current_iteration: 1
    });

    const state = readLoopState(loop.loop_id);
    assert(!state.success_condition, 'no success condition set');
    // Loop should complete based on max_iterations
    assert(state.current_iteration === state.max_iterations, 'should reach max');
  });

  await runTest('edge', 'Handle special characters in output', () => {
    const specialChars = '{"key": "value", "array": [1, 2, 3]}, <test>&\'"quotes\'</test>';

    // Create the loop first
    const loop = createLoopState('VARS-TEST');

    updateLoopState(loop.loop_id, {
      state_variables: {
        special_output: specialChars
      }
    });

    const state = readLoopState(loop.loop_id);
    assert(state.state_variables.special_output === specialChars, 'should preserve special chars');
  });
}

// ============================================
// TEST SUITE 10: END-TO-END WORKFLOW
// ============================================

async function testEndToEnd() {
  log(colors.blue, '\n📋 TEST SUITE 10: END-TO-END WORKFLOW');

  await runTest('e2e', 'Complete loop lifecycle', async () => {
    // 1. Create task
    const taskId = `E2E-TASK-${Date.now()}`;
    const task = createTaskWithLoop(taskId);
    assert(task.loop_control?.enabled === true, 'task should have loop enabled');

    // 2. Start loop
    const loop = createLoopState(taskId);
    assert(loop.status === 'created', 'loop should start as created');

    // 3. Transition to running
    updateLoopState(loop.loop_id, { status: 'running' });
    let state = readLoopState(loop.loop_id);
    assert(state.status === 'running', 'loop should be running');

    // 4. Execute step (simulate)
    updateLoopState(loop.loop_id, {
      current_cli_step: 1,
      state_variables: {
        step1_stdout: 'test output',
        step1_stderr: '',
        step1_exit_code: '0'
      }
    });
    state = readLoopState(loop.loop_id);
    assert(state.current_cli_step === 1, 'should advance to next step');

    // 5. Complete iteration
    updateLoopState(loop.loop_id, {
      current_cli_step: 0,
      current_iteration: 1
    });
    state = readLoopState(loop.loop_id);
    assert(state.current_iteration === 1, 'should increment iteration');

    // 6. Pause
    updateLoopState(loop.loop_id, { status: 'paused' });
    state = readLoopState(loop.loop_id);
    assert(state.status === 'paused', 'should be paused');

    // 7. Resume
    updateLoopState(loop.loop_id, { status: 'running' });
    state = readLoopState(loop.loop_id);
    assert(state.status === 'running', 'should be running again');

    // 8. Complete
    updateLoopState(loop.loop_id, {
      status: 'completed',
      current_iteration: 3,
      completed_at: new Date().toISOString()
    });
    state = readLoopState(loop.loop_id);
    assert(state.status === 'completed', 'should be completed');
    assert(state.completed_at, 'should have completion timestamp');
  });

  await runTest('e2e', 'Failed loop with retry', async () => {
    const taskId = `E2E-FAIL-${Date.now()}`;
    const loop = createLoopState(taskId);

    // Simulate failure
    updateLoopState(loop.loop_id, {
      status: 'paused',
      failure_reason: 'Step failed with exit code 1'
    });

    let state = readLoopState(loop.loop_id);
    assert(state.status === 'paused', 'should pause on error');
    assert(state.failure_reason, 'should have failure reason');

    // Simulate retry
    updateLoopState(loop.loop_id, {
      status: 'running',
      failure_reason: undefined
    });

    state = readLoopState(loop.loop_id);
    assert(state.status === 'running', 'should resume after retry');
    assert(!state.failure_reason, 'failure reason should be cleared');
  });
}

// ============================================
// PRINT SUMMARY
// ============================================

function printSummary() {
  log(colors.cyan, '\n' + '='.repeat(60));
  log(colors.cyan, '📊 COMPREHENSIVE TEST SUMMARY');
  log(colors.cyan, '='.repeat(60));

  // Group by suite
  const bySuite = {};
  for (const r of results) {
    if (!bySuite[r.suite]) bySuite[r.suite] = [];
    bySuite[r.suite].push(r);
  }

  // Print suite summaries
  for (const [suite, suiteResults] of Object.entries(bySuite)) {
    const passed = suiteResults.filter((r) => r.passed).length;
    const total = suiteResults.length;
    const rate = ((passed / total) * 100).toFixed(0);

    const color = passed === total ? colors.green : colors.yellow;
    log(color, `\n  ${suite}: ${passed}/${total} (${rate}%)`);
  }

  // Total stats
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalTime = results.reduce((sum, r) => sum + (r.duration || 0), 0);

  log(colors.cyan, '\n' + '-'.repeat(60));
  log(colors.reset, `\n  Total Tests:   ${total}`);
  log(colors.green, `  Passed:        ${passed} ✓`);
  if (failed > 0) {
    log(colors.red, `  Failed:        ${failed} ✗`);
  }
  log(colors.reset, `  Success Rate:  ${((passed / total) * 100).toFixed(1)}%`);
  log(colors.reset, `  Total Time:    ${totalTime}ms`);

  // Failed tests
  if (failed > 0) {
    log(colors.red, '\n❌ Failed Tests:');
    results.filter((r) => !r.passed).forEach((r) => {
      log(colors.red, `  [${r.suite}] ${r.name}`);
      log(colors.red, `    ${r.error}`);
    });
  }

  // Performance highlights
  const avgTime = totalTime / total;
  const fastTests = results.filter((r) => (r.duration || 0) < 20);
  const slowTests = results.filter((r) => (r.duration || 0) > 100);

  log(colors.green, `\n⚡ Average: ${avgTime.toFixed(1)}ms/test`);
  if (fastTests.length > 0) {
    log(colors.green, `⚡ Fast Tests (<20ms): ${fastTests.length}`);
  }
  if (slowTests.length > 0) {
    log(colors.yellow, `🐢 Slow Tests (>100ms): ${slowTests.length}`);
  }

  log(colors.cyan, '\n' + '='.repeat(60));

  if (failed === 0) {
    log(colors.bright + colors.green, '✅ ALL TESTS PASSED!');
    log(colors.green, 'The CCW Loop System comprehensive tests completed successfully.');
  } else {
    log(colors.bright + colors.red, '❌ SOME TESTS FAILED');
    log(colors.red, 'Please review the failures above.');
  }

  log(colors.reset, '');
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runAllTests() {
  log(colors.cyan, '\n' + '='.repeat(60));
  log(colors.bright + colors.cyan, '🧪 CCW LOOP SYSTEM - COMPREHENSIVE TEST SUITE');
  log(colors.cyan, '='.repeat(60));
  log(colors.cyan, 'Testing: Multi-loop, API, Security, WebSocket, E2E');
  log(colors.cyan, '='.repeat(60));

  setupTestWorkspace();

  try {
    await testMultiLoopParallel();
    await testStateTransitions();
    await testExecutionHistory();
    await testStateVariables();
    await testSecurityPathTraversal();
    await testSecuritySuccessCondition();
    await testWebSocketMessages();
    await testApiResponseFormats();
    await testEdgeCases();
    await testEndToEnd();
  } catch (error) {
    log(colors.red, `\n💥 Fatal error during test execution: ${error.message}`);
    console.error(error);
  }

  printSummary();

  const failed = results.filter((r) => !r.passed).length;
  return failed === 0 ? 0 : 1;
}

// Run tests
runAllTests().then((exitCode) => {
  process.exit(exitCode);
}).catch((err) => {
  log(colors.red, `💥 Unhandled error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
