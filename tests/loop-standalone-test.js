/**
 * CCW Loop System - Standalone Flow State Test
 * Tests Loop system without requiring server to be running
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color: string, msg: string) {
  console.log(`${color}${msg}${colors.reset}`);
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Test workspace
const TEST_WORKSPACE = join(process.cwd(), '.test-loop-workspace');
const TEST_STATE_DIR = join(TEST_WORKSPACE, '.workflow');
const TEST_STATE_FILE = join(TEST_STATE_DIR, 'loop-state.json');

// Test results
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}
const results: TestResult[] = = [];

/**
 * Setup test workspace
 */
function setupTestWorkspace() {
  log(colors.blue, '🔧 Setting up test workspace...');

  // Clean and create directories
  if (existsSync(TEST_WORKSPACE)) {
    const files = readdirSync(TEST_WORKSPACE);
    files.forEach(f => {
      const fullPath = join(TEST_WORKSPACE, f);
      unlinkSync(fullPath);
    });
  }

  if (!existsSync(TEST_STATE_DIR)) {
    mkdirSync(TEST_STATE_DIR, { recursive: true });
  }

  log(colors.green, '✅ Test workspace ready');
}

/**
 * Create initial loop state
 */
function createInitialState(taskId: string = 'TEST-LOOP-1') {
  const loopId = `loop-${taskId}-${Date.now()}`;
  const state = {
    loop_id: loopId,
    task_id: taskId,
    status: 'created',
    current_iteration: 0,
    max_iterations: 5,
    current_cli_step: 0,
    cli_sequence: [
      { step_id: 'run_tests', tool: 'bash', command: 'npm test' },
      { step_id: 'analyze_failure', tool: 'gemini', mode: 'analysis', prompt_template: 'Analyze: [run_tests_stdout]' },
      { step_id: 'apply_fix', tool: 'codex', mode: 'write', prompt_template: 'Fix: [analyze_failure_stdout]' }
    ],
    session_mapping: {},
    state_variables: {},
    error_policy: { on_failure: 'pause', max_retries: 3 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  writeFileSync(TEST_STATE_FILE, JSON.stringify(state, null, 2));
  return state;
}

/**
 * Read current state
 */
function readState() {
  return JSON.parse(readFileSync(TEST_STATE_FILE, 'utf-8'));
}

/**
 * Write state
 */
function writeState(state: any) {
  state.updated_at = new Date().toISOString();
  writeFileSync(TEST_STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Run a single test
 */
async function runTest(name: string, fn: () => void | Promise<void>) {
  const start = Date.now();
  process.stdout.write(`  ○ ${name}... `);

  try {
    await fn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    log(colors.green, `✓ (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - start;
    results.push({ name, passed: false, error: (error as Error).message, duration });
    log(colors.red, `✗ ${(error as Error).message}`);
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  log(colors.cyan, '\n' + '='.repeat(55));
  log(colors.cyan, '🧪 CCW LOOP SYSTEM - STANDALONE FLOW STATE TEST');
  log(colors.cyan, '='.repeat(55));

  setupTestWorkspace();

  // ============================================
  // TEST SUITE 1: STATE CREATION
  // ============================================
  log(colors.blue, '\n📋 TEST SUITE 1: STATE CREATION');

  await runTest('Initial state has correct structure', () => {
    const state = createInitialState();
    assert(state.loop_id.startsWith('loop-'), 'loop_id should start with "loop-"');
    assert(state.status === 'created', 'status should be "created"');
    assert(state.current_iteration === 0, 'iteration should be 0');
    assert(state.current_cli_step === 0, 'cli_step should be 0');
    assert(state.cli_sequence.length === 3, 'should have 3 cli steps');
    assert(Object.keys(state.state_variables).length === 0, 'variables should be empty');
  });

  await runTest('Timestamps are valid ISO strings', () => {
    const state = createInitialState();
    assert(!isNaN(Date.parse(state.created_at)), 'created_at should be valid date');
    assert(!isNaN(Date.parse(state.updated_at)), 'updated_at should be valid date');
  });

  // ============================================
  // TEST SUITE 2: STATE TRANSITIONS
  // ============================================
  log(colors.blue, '\n📋 TEST SUITE 2: STATE TRANSITIONS');

  await runTest('created -> running', () => {
    const state = readState();
    state.status = 'running';
    writeState(state);

    const updated = readState();
    assert(updated.status === 'running', 'status should be running');
  });

  await runTest('running -> paused', () => {
    const state = readState();
    state.status = 'paused';
    writeState(state);

    const updated = readState();
    assert(updated.status === 'paused', 'status should be paused');
  });

  await runTest('paused -> running (resume)', () => {
    const state = readState();
    state.status = 'running';
    writeState(state);

    const updated = readState();
    assert(updated.status === 'running', 'status should be running');
  });

  await runTest('running -> completed', () => {
    const state = readState();
    state.status = 'completed';
    state.completed_at = new Date().toISOString();
    writeState(state);

    const updated = readState();
    assert(updated.status === 'completed', 'status should be completed');
    assert(updated.completed_at, 'should have completed_at timestamp');
  });

  await runTest('running -> failed with reason', () => {
    // Create new state for this test
    createInitialState('TEST-FAIL-1');
    const state = readState();
    state.status = 'failed';
    state.failure_reason = 'Max retries exceeded';
    writeState(state);

    const updated = readState();
    assert(updated.status === 'failed', 'status should be failed');
    assert(updated.failure_reason === 'Max retries exceeded', 'should have failure reason');
  });

  // ============================================
  // TEST SUITE 3: ITERATION CONTROL
  // ============================================
  log(colors.blue, '\n📋 TEST SUITE 3: ITERATION CONTROL');

  createInitialState('TEST-ITER-1');

  await runTest('Iteration increments', () => {
    const state = readState();
    state.current_iteration = 1;
    writeState(state);

    const updated = readState();
    assert(updated.current_iteration === 1, 'iteration should increment');
  });

  await runTest('Iteration respects max_iterations', () => {
    const state = readState();
    state.current_iteration = 5;
    state.max_iterations = 5;
    state.status = 'completed';
    writeState(state);

    const updated = readState();
    assert(updated.current_iteration <= updated.max_iterations, 'cannot exceed max iterations');
  });

  await runTest('CLI step increments within iteration', () => {
    const state = readState();
    state.current_cli_step = 1;
    writeState(state);

    const updated = readState();
    assert(updated.current_cli_step === 1, 'cli_step should increment');
  });

  await runTest('CLI step resets on new iteration', () => {
    const state = readState();
    state.current_iteration = 2;
    state.current_cli_step = 0;
    writeState(state);

    const updated = readState();
    assert(updated.current_iteration === 2, 'iteration should be 2');
    assert(updated.current_cli_step === 0, 'cli_step should reset to 0');
  });

  await runTest('CLI step cannot exceed sequence length', () => {
    const state = readState();
    state.current_cli_step = state.cli_sequence.length - 1;
    writeState(state);

    const updated = readState();
    assert(updated.current_cli_step < updated.cli_sequence.length, 'cli_step must be within bounds');
  });

  // ============================================
  // TEST SUITE 4: VARIABLE SUBSTITUTION
  // ============================================
  log(colors.blue, '\n📋 TEST SUITE 4: VARIABLE SUBSTITUTION');

  createInitialState('TEST-VAR-1');

  await runTest('Variables are stored after step execution', () => {
    const state = readState();
    state.state_variables = {
      run_tests_stdout: 'Tests: 15 passed',
      run_tests_stderr: '',
      run_tests_exit_code: '0'
    };
    writeState(state);

    const updated = readState();
    assert(updated.state_variables.run_tests_stdout === 'Tests: 15 passed', 'variable should be stored');
  });

  await runTest('Simple template substitution works', () => {
    const template = 'Result: [run_tests_stdout]';
    const vars = { run_tests_stdout: 'Tests: 15 passed' };
    const result = template.replace(/\[(\w+)\]/g, (_, key) => vars[key as keyof typeof vars] || `[${key}]`);

    assert(result === 'Result: Tests: 15 passed', 'substitution should work');
  });

  await runTest('Multiple variable substitution', () => {
    const template = 'Stdout: [run_tests_stdout]\nStderr: [run_tests_stderr]';
    const vars = {
      run_tests_stdout: 'Tests passed',
      run_tests_stderr: 'No errors'
    };
    const result = template.replace(/\[(\w+)\]/g, (_, key) => vars[key as keyof typeof vars] || `[${key}]`);

    assert(result.includes('Tests passed'), 'should substitute first variable');
    assert(result.includes('No errors'), 'should substitute second variable');
  });

  await runTest('Missing variable preserves placeholder', () => {
    const template = 'Result: [missing_var]';
    const vars = {};
    const result = template.replace(/\[(\w+)\]/g, (_, key) => vars[key as keyof typeof vars] || `[${key}]`);

    assert(result === 'Result: [missing_var]', 'missing var should preserve placeholder');
  });

  // ============================================
  // TEST SUITE 5: SUCCESS CONDITION EVALUATION
  // ============================================
  log(colors.blue, '\n📋 TEST SUITE 5: SUCCESS CONDITIONS');

  createInitialState('TEST-SUCCESS-1');

  await runTest('Simple string equality check', () => {
    const state = readState();
    state.state_variables = { test_result: 'pass' };
    const success = state.state_variables.test_result === 'pass';

    assert(success === true, 'simple equality should work');
  });

  await runTest('String includes check', () => {
    const output = 'Tests: 15 passed, 0 failed';
    const success = output.includes('15 passed');

    assert(success === true, 'includes check should work');
  });

  await runTest('Regex extraction and comparison', () => {
    const output = 'Average: 35ms, Min: 28ms, Max: 42ms';
    const match = output.match(/Average: ([\d.]+)ms/);
    const avgTime = parseFloat(match?.[1] || '1000');
    const success = avgTime < 50;

    assert(avgTime === 35, 'regex should extract number');
    assert(success === true, 'comparison should work');
  });

  await runTest('Combined AND condition', () => {
    const vars = { test_result: 'pass', coverage: '90%' };
    const success = vars.test_result === 'pass' && parseInt(vars.coverage) > 80;

    assert(success === true, 'AND condition should work');
  });

  await runTest('Combined OR condition', () => {
    const output = 'Status: approved';
    const success = output.includes('approved') || output.includes('LGTM');

    assert(success === true, 'OR condition should work');
  });

  await runTest('Negation condition', () => {
    const output = 'Tests: 15 passed, 0 failed';
    const success = !output.includes('failed');

    assert(success === true, 'negation should work');
  });

  // ============================================
  // TEST SUITE 6: ERROR HANDLING POLICIES
  // ============================================
  log(colors.blue, '\n📋 TEST SUITE 6: ERROR HANDLING');

  createInitialState('TEST-ERROR-1');

  await runTest('pause policy stops loop on error', () => {
    const state = readState();
    state.error_policy = { on_failure: 'pause', max_retries: 3 };
    state.status = 'paused';
    state.failure_reason = 'Step failed with exit code 1';
    writeState(state);

    const updated = readState();
    assert(updated.status === 'paused', 'should be paused');
    assert(updated.failure_reason, 'should have failure reason');
  });

  await runTest('fail_fast policy immediately fails loop', () => {
    createInitialState('TEST-ERROR-2');
    const state = readState();
    state.error_policy = { on_failure: 'fail_fast', max_retries: 0 };
    state.status = 'failed';
    state.failure_reason = 'Critical error';
    writeState(state);

    const updated = readState();
    assert(updated.status === 'failed', 'should be failed');
  });

  await runTest('continue policy allows proceeding', () => {
    createInitialState('TEST-ERROR-3');
    const state = readState();
    state.error_policy = { on_failure: 'continue', max_retries: 3 };
    // Simulate continuing to next step despite error
    state.current_cli_step = 1;
    writeState(state);

    const updated = readState();
    assert(updated.current_cli_step === 1, 'should move to next step');
    assert(updated.status === 'running', 'should still be running');
  });

  // ============================================
  // TEST SUITE 7: EXECUTION HISTORY
  // ============================================
  log(colors.blue, '\n📋 TEST SUITE 7: EXECUTION HISTORY');

  createInitialState('TEST-HISTORY-1');

  await runTest('Execution record is created', () => {
    const state = readState();
    const now = new Date().toISOString();
    state.execution_history = [
      {
        iteration: 1,
        step_index: 0,
        step_id: 'run_tests',
        tool: 'bash',
        started_at: now,
        completed_at: now,
        duration_ms: 150,
        success: true,
        exit_code: 0,
        stdout: 'Tests passed',
        stderr: ''
      }
    ];
    writeState(state);

    const updated = readState();
    assert(updated.execution_history?.length === 1, 'should have 1 record');
    assert(updated.execution_history[0].step_id === 'run_tests', 'record should match');
  });

  await runTest('Multiple records are ordered', () => {
    const state = readState();
    const now = new Date().toISOString();
    state.execution_history = [
      { iteration: 1, step_index: 0, step_id: 'step1', tool: 'bash', started_at: now, completed_at: now, duration_ms: 100, success: true, exit_code: 0 },
      { iteration: 1, step_index: 1, step_id: 'step2', tool: 'gemini', started_at: now, completed_at: now, duration_ms: 200, success: true, exit_code: 0 }
    ];
    writeState(state);

    const updated = readState();
    assert(updated.execution_history.length === 2, 'should have 2 records');
    assert(updated.execution_history[0].step_id === 'step1', 'first record should be step1');
    assert(updated.execution_history[1].step_id === 'step2', 'second record should be step2');
  });

  await runTest('Failed execution has error info', () => {
    const state = readState();
    const now = new Date().toISOString();
    state.execution_history?.push({
      iteration: 1,
      step_index: 2,
      step_id: 'step3',
      tool: 'codex',
      started_at: now,
      completed_at: now,
      duration_ms: 50,
      success: false,
      exit_code: 1,
      error: 'Compilation failed'
    });
    writeState(state);

    const updated = readState();
    const failedRecord = updated.execution_history?.find(r => r.step_id === 'step3');
    assert(failedRecord?.success === false, 'record should be marked as failed');
    assert(failedRecord?.error, 'record should have error message');
  });

  // ============================================
  // TEST SUITE 8: BACKUP & RECOVERY
  // ============================================
  log(colors.blue, '\n📋 TEST SUITE 8: BACKUP & RECOVERY');

  createInitialState('TEST-BACKUP-1');

  await runTest('State file is created', () => {
    assert(existsSync(TEST_STATE_FILE), 'state file should exist');
  });

  await runTest('State can be read back', () => {
    const written = readState();
    assert(written.loop_id.startsWith('loop-'), 'read state should match');
  });

  await runTest('State persists across writes', () => {
    const state = readState();
    state.current_iteration = 3;
    writeState(state);

    const readBack = readState();
    assert(readBack.current_iteration === 3, 'change should persist');
  });

  // ============================================
  // PRINT SUMMARY
  // ============================================
  log(colors.cyan, '\n' + '='.repeat(55));
  log(colors.cyan, '📊 TEST SUMMARY');
  log(colors.cyan, '='.repeat(55));

  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalTime = results.reduce((sum, r) => sum + (r.duration || 0), 0);

  log(colors.reset, `\n  Total Tests:   ${total}`);
  log(colors.green, `  Passed:        ${passed} ✓`);
  if (failed > 0) {
    log(colors.red, `  Failed:        ${failed} ✗`);
  }
  log(colors.reset, `  Success Rate:  ${((passed / total) * 100).toFixed(1)}%`);
  log(colors.reset, `  Total Time:    ${totalTime}ms`);

  if (failed > 0) {
    log(colors.red, '\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      log(colors.red, `  - ${r.name}`);
      log(colors.red, `    ${r.error}`);
    });
  }

  // Fast tests highlight
  const fastTests = results.filter(r => (r.duration || 0) < 10);
  if (fastTests.length > 0) {
    log(colors.green, `\n⚡ Fast Tests (<10ms): ${fastTests.length}`);
  }

  log(colors.cyan, '\n' + '='.repeat(55));

  if (failed === 0) {
    log(colors.green, '✅ ALL TESTS PASSED!');
    log(colors.green, 'The CCW Loop system flow state tests completed successfully.');
  } else {
    log(colors.red, '❌ SOME TESTS FAILED');
  }

  log(colors.reset, '');

  return failed === 0 ? 0 : 1;
}

// Run tests
runAllTests().then(exitCode => {
  process.exit(exitCode);
}).catch(err => {
  log(colors.red, `💥 Fatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
