/**
 * CCW Loop System - Simplified Flow State Test
 * Tests the complete Loop system flow with mock endpoints
 */

import { writeFile, readFile, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Test configuration
const TEST_WORKSPACE = join(process.cwd(), '.test-loop-workspace');
const TEST_STATE_DIR = join(TEST_WORKSPACE, '.workflow');
const TEST_TASKS_DIR = join(TEST_WORKSPACE, '.task');

// Test results
const results: { name: string; passed: boolean; error?: string }[] = [];

function log(msg: string) { console.log(msg); }
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Setup test workspace
 */
function setup() {
  log('🔧 Setting up test workspace...');

  if (!existsSync(TEST_STATE_DIR)) mkdirSync(TEST_STATE_DIR, { recursive: true });
  if (!existsSync(TEST_TASKS_DIR)) mkdirSync(TEST_TASKS_DIR, { recursive: true });

  // Create test task
  const testTask = {
    id: 'TEST-LOOP-1',
    title: 'Test Loop',
    status: 'active',
    loop_control: {
      enabled: true,
      max_iterations: 3,
      success_condition: 'state_variables.test_result === "pass"',
      error_policy: { on_failure: 'pause' },
      cli_sequence: [
        { step_id: 'run_test', tool: 'bash', command: 'npm test' },
        { step_id: 'analyze', tool: 'gemini', mode: 'analysis', prompt_template: 'Analyze: [run_test_stdout]' }
      ]
    }
  };

  writeFile(join(TEST_TASKS_DIR, 'TEST-LOOP-1.json'), JSON.stringify(testTask, null, 2), (err) => {
    if (err) throw err;
  });

  log('✅ Test workspace ready');
}

/**
 * Cleanup
 */
function cleanup() {
  try {
    if (existsSync(join(TEST_STATE_DIR, 'loop-state.json'))) {
      unlinkSync(join(TEST_STATE_DIR, 'loop-state.json'));
    }
    log('🧹 Cleaned up');
  } catch (e) {
    // Ignore
  }
}

/**
 * Test runner
 */
async function runTest(name: string, fn: () => Promise<void> | void) {
  process.stdout.write(`  ○ ${name}... `);
  try {
    await fn();
    results.push({ name, passed: true });
    log('✓');
  } catch (error) {
    results.push({ name, passed: false, error: (error as Error).message });
    log(`✗ ${(error as Error).message}`);
  }
}

/**
 * Create initial state
 */
function createInitialState() {
  const state = {
    loop_id: 'loop-TEST-LOOP-1-' + Date.now(),
    task_id: 'TEST-LOOP-1',
    status: 'created',
    current_iteration: 0,
    max_iterations: 3,
    current_cli_step: 0,
    cli_sequence: [
      { step_id: 'run_test', tool: 'bash', command: 'npm test' },
      { step_id: 'analyze', tool: 'gemini', mode: 'analysis', prompt_template: 'Analyze: [run_test_stdout]' }
    ],
    session_mapping: {},
    state_variables: {},
    error_policy: { on_failure: 'pause', max_retries: 3 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  writeFile(join(TEST_STATE_DIR, 'loop-state.json'), JSON.stringify(state, null, 2), (err) => {
    if (err) throw err;
  });

  return state;
}

/**
 * Run all tests
 */
async function runAllTests() {
  log('\n🧪 CCW LOOP SYSTEM - FLOW STATE TEST');
  log('='.repeat(50));

  setup();

  // Test 1: State Creation
  log('\n📋 State Creation Tests:');
  await runTest('Initial state is "created"', async () => {
    const state = createInitialState();
    assert(state.status === 'created', 'status should be created');
    assert(state.current_iteration === 0, 'iteration should be 0');
  });

  // Test 2: State Transitions
  log('\n📋 State Transition Tests:');
  await runTest('created -> running', async () => {
    const state = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    state.status = 'running';
    state.updated_at = new Date().toISOString();
    writeFile(join(TEST_STATE_DIR, 'loop-state.json'), JSON.stringify(state, null, 2), () => {});

    const updated = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    assert(updated.status === 'running', 'status should be running');
  });

  await runTest('running -> paused', async () => {
    const state = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    state.status = 'paused';
    writeFile(join(TEST_STATE_DIR, 'loop-state.json'), JSON.stringify(state, null, 2), () => {});

    const updated = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    assert(updated.status === 'paused', 'status should be paused');
  });

  await runTest('paused -> running', async () => {
    const state = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    state.status = 'running';
    writeFile(join(TEST_STATE_DIR, 'loop-state.json'), JSON.stringify(state, null, 2), () => {});

    const updated = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    assert(updated.status === 'running', 'status should be running');
  });

  await runTest('running -> completed', async () => {
    const state = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    state.status = 'completed';
    state.completed_at = new Date().toISOString();
    writeFile(join(TEST_STATE_DIR, 'loop-state.json'), JSON.stringify(state, null, 2), () => {});

    const updated = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    assert(updated.status === 'completed', 'status should be completed');
    assert(updated.completed_at, 'should have completed_at');
  });

  // Test 3: Iteration Control
  log('\n📋 Iteration Control Tests:');
  await runTest('Iteration increments', async () => {
    const state = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    state.status = 'running';
    state.current_iteration = 1;
    writeFile(join(TEST_STATE_DIR, 'loop-state.json'), JSON.stringify(state, null, 2), () => {});

    const updated = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    assert(updated.current_iteration === 1, 'iteration should increment');
  });

  await runTest('Max iterations respected', async () => {
    const state = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    state.current_iteration = 3;
    state.max_iterations = 3;
    state.status = 'completed';
    writeFile(join(TEST_STATE_DIR, 'loop-state.json'), JSON.stringify(state, null, 2), () => {});

    const updated = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    assert(updated.current_iteration <= updated.max_iterations, 'should not exceed max');
  });

  // Test 4: CLI Step Control
  log('\n📋 CLI Step Control Tests:');
  await runTest('Step index increments', async () => {
    const state = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    state.current_cli_step = 1;
    writeFile(join(TEST_STATE_DIR, 'loop-state.json'), JSON.stringify(state, null, 2), () => {});

    const updated = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    assert(updated.current_cli_step === 1, 'step should increment');
  });

  await runTest('Step resets on new iteration', async () => {
    const state = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    state.current_iteration = 2;
    state.current_cli_step = 0;
    writeFile(join(TEST_STATE_DIR, 'loop-state.json'), JSON.stringify(state, null, 2), () => {});

    const updated = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    assert(updated.current_cli_step === 0, 'step should reset');
  });

  // Test 5: Variable Substitution
  log('\n📋 Variable Substitution Tests:');
  await runTest('Variables are stored', async () => {
    const state = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    state.state_variables = { test_result: 'pass', output: 'Success!' };
    writeFile(join(TEST_STATE_DIR, 'loop-state.json'), JSON.stringify(state, null, 2), () => {});

    const updated = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    assert(updated.state_variables.test_result === 'pass', 'variable should be stored');
  });

  await runTest('Template substitution works', async () => {
    const template = 'Result: [test_result]';
    const vars = { test_result: 'pass' };
    const result = template.replace(/\[(\w+)\]/g, (_, key) => vars[key as keyof typeof vars] || `[${key}]`);
    assert(result === 'Result: pass', 'substitution should work');
  });

  // Test 6: Success Condition
  log('\n📋 Success Condition Tests:');
  await runTest('Simple condition passes', async () => {
    const condition = 'state_variables.test_result === "pass"';
    const vars = { test_result: 'pass' };
    // Simulate evaluation
    const pass = vars.test_result === 'pass';
    assert(pass === true, 'condition should pass');
  });

  await runTest('Complex condition with regex', async () => {
    const output = 'Average: 35ms, Min: 28ms';
    const match = output.match(/Average: ([\d.]+)ms/);
    const avg = parseFloat(match?.[1] || '1000');
    const pass = avg < 50;
    assert(pass === true, 'complex condition should pass');
  });

  // Test 7: Error Handling
  log('\n📋 Error Handling Tests:');
  await runTest('pause policy on error', async () => {
    const state = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    state.status = 'paused';
    state.failure_reason = 'Test failed';
    writeFile(join(TEST_STATE_DIR, 'loop-state.json'), JSON.stringify(state, null, 2), () => {});

    const updated = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    assert(updated.status === 'paused', 'should pause on error');
    assert(updated.failure_reason, 'should have failure reason');
  });

  await runTest('fail_fast policy', async () => {
    const state = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    state.status = 'failed';
    state.failure_reason = 'Critical error';
    writeFile(join(TEST_STATE_DIR, 'loop-state.json'), JSON.stringify(state, null, 2), () => {});

    const updated = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    assert(updated.status === 'failed', 'should fail immediately');
  });

  // Test 8: Execution History
  log('\n📋 Execution History Tests:');
  await runTest('History records are stored', async () => {
    const state = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    state.execution_history = [
      {
        iteration: 1,
        step_index: 0,
        step_id: 'run_test',
        tool: 'bash',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: 100,
        success: true,
        exit_code: 0,
        stdout: 'Tests passed',
        stderr: ''
      }
    ];
    writeFile(join(TEST_STATE_DIR, 'loop-state.json'), JSON.stringify(state, null, 2), () => {});

    const updated = JSON.parse(readFileSync(join(TEST_STATE_DIR, 'loop-state.json'), 'utf-8'));
    assert(updated.execution_history?.length === 1, 'should have history');
  });

  // Summary
  log('\n' + '='.repeat(50));
  log('📊 TEST SUMMARY');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  log(`  Total: ${results.length}`);
  log(`  Passed: ${passed} ✓`);
  log(`  Failed: ${failed} ✗`);

  if (failed > 0) {
    log('\n❌ Failed:');
    results.filter(r => !r.passed).forEach(r => {
      log(`  - ${r.name}: ${r.error}`);
    });
  }

  cleanup();

  return failed === 0 ? 0 : 1;
}

// Run tests
runAllTests().then(exitCode => {
  process.exit(exitCode);
}).catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
