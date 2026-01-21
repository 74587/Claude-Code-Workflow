/**
 * Test Loop Routes - Mock CLI endpoints for Loop system testing
 * Provides simulated CLI tool responses for testing Loop workflows
 */

import type { RouteContext } from './types.js';

/**
 * Mock execution history storage
 * In production, this would be actual CLI execution results
 */
const mockExecutionStore = new Map<string, any[]>();

/**
 * Mock CLI tool responses
 */
const mockResponses = {
  // Bash mock responses
  bash: {
    npm_test_pass: {
      exitCode: 0,
      stdout: 'Test Suites: 1 passed, 1 total\nTests:       15 passed, 15 total\nSnapshots:   0 total\nTime:        2.345 s\nAll tests passed!',
      stderr: ''
    },
    npm_test_fail: {
      exitCode: 1,
      stdout: 'Test Suites: 1 failed, 1 total\nTests:       14 passed, 1 failed, 15 total',
      stderr: 'FAIL src/utils/validation.test.js\n  \u251c Validation should reject invalid input\n    Error: expect(received).toBe(true)\n    Received: false\n        at validation.test.js:42:18'
    },
    npm_lint: {
      exitCode: 0,
      stdout: 'Linting complete!\n0 errors, 2 warnings',
      stderr: ''
    },
    npm_benchmark_slow: {
      exitCode: 0,
      stdout: 'Running benchmark...\nOperation: 10000 ops\nAverage: 125ms\nMin: 110ms\nMax: 145ms',
      stderr: ''
    },
    npm_benchmark_fast: {
      exitCode: 0,
      stdout: 'Running benchmark...\nOperation: 10000 ops\nAverage: 35ms\nMin: 28ms\nMax: 42ms',
      stderr: ''
    }
  },
  // Gemini mock responses
  gemini: {
    analyze_failure: `## Root Cause Analysis

### Failed Test
- Test: Validation should reject invalid input
- File: src/utils/validation.test.js:42

### Error Analysis
The validation function is not properly checking for empty strings. The test expects \`true\` for validation result, but receives \`false\`.

### Affected Files
- src/utils/validation.js

### Fix Suggestion
Update the validation function to handle empty string case:
\`\`\`javascript
function validateInput(input) {
  if (!input || input.trim() === '') {
    return false;
  }
  // ... rest of validation
}
\`\`\``,
    analyze_performance: `## Performance Analysis

### Current Performance
- Average: 125ms per operation
- Target: < 50ms

### Bottleneck Identified
The main loop in src/processor.js has O(n²) complexity due to nested array operations.

### Optimization Suggestion
Replace nested forEach with Map-based lookup to achieve O(n) complexity.`,
    code_review: `## Code Review Summary

### Overall Assessment: LGTM

### Findings
- Code structure is clear
- Error handling is appropriate
- Comments are sufficient

### Score: 9/10`
  },
  // Codex mock responses
  codex: {
    fix_validation: `Modified files:
- src/utils/validation.js

Changes:
Added empty string check in validateInput function:
\`\`\`javascript
function validateInput(input) {
  // Check for null, undefined, or empty string
  if (!input || typeof input !== 'string' || input.trim() === '') {
    return false;
  }
  // ... existing validation logic
}
\`\`\``,
    optimize_performance: `Modified files:
- src/processor.js

Changes:
Replaced nested forEach with Map-based lookup:
\`\`\`javascript
// Before: O(n²)
items.forEach(item => {
  otherItems.forEach(other => {
    if (item.id === other.id) { /* ... */ }
  });
});

// After: O(n)
const lookup = new Map(otherItems.map(o => [o.id, o]));
items.forEach(item => {
  const other = lookup.get(item.id);
  if (other) { /* ... */ }
});
\`\`\``,
    add_tests: `Modified files:
- tests/utils/math.test.js

Added new test cases:
- testAddition()
- testSubtraction()
- testMultiplication()
- testDivision()`
  }
};

/**
 * Handle test loop routes
 * Provides mock CLI endpoints for testing Loop workflows
 */
export async function handleTestLoopRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, req, res, initialPath, handlePostRequest } = ctx;
  const workflowDir = initialPath || process.cwd();

  // Only handle test routes in test mode
  if (!pathname.startsWith('/api/test/loop')) {
    return false;
  }

  // GET /api/test/loop/mock/reset - Reset mock execution store
  if (pathname === '/api/test/loop/mock/reset' && req.method === 'POST') {
    mockExecutionStore.clear();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Mock execution store reset' }));
    return true;
  }

  // GET /api/test/loop/mock/history - Get mock execution history
  if (pathname === '/api/test/loop/mock/history' && req.method === 'GET') {
    const history = Array.from(mockExecutionStore.entries()).map(([loopId, records]) => ({
      loopId,
      records
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: history }));
    return true;
  }

  // POST /api/test/loop/mock/cli/execute - Mock CLI execution
  if (pathname === '/api/test/loop/mock/cli/execute' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { loopId, stepId, tool, command, prompt } = body as {
        loopId?: string;
        stepId?: string;
        tool?: string;
        command?: string;
        prompt?: string;
      };

      if (!loopId || !stepId || !tool) {
        return { success: false, error: 'loopId, stepId, and tool are required', status: 400 };
      }

      // Simulate execution delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get mock response based on tool and command/prompt
      let mockResult: any;

      if (tool === 'bash') {
        if (command?.includes('test')) {
          // Determine pass/fail based on iteration
          const history = mockExecutionStore.get(loopId) || [];
          const iterationCount = history.filter(r => r.stepId === 'run_tests').length;
          mockResult = iterationCount >= 2 ? mockResponses.bash.npm_test_pass : mockResponses.bash.npm_test_fail;
        } else if (command?.includes('lint')) {
          mockResult = mockResponses.bash.npm_lint;
        } else if (command?.includes('benchmark')) {
          const history = mockExecutionStore.get(loopId) || [];
          const iterationCount = history.filter(r => r.stepId === 'run_benchmark').length;
          mockResult = iterationCount >= 3 ? mockResponses.bash.npm_benchmark_fast : mockResponses.bash.npm_benchmark_slow;
        } else {
          mockResult = { exitCode: 0, stdout: 'Command executed', stderr: '' };
        }
      } else if (tool === 'gemini') {
        if (prompt?.includes('failure')) {
          mockResult = { exitCode: 0, stdout: mockResponses.gemini.analyze_failure, stderr: '' };
        } else if (prompt?.includes('performance')) {
          mockResult = { exitCode: 0, stdout: mockResponses.gemini.analyze_performance, stderr: '' };
        } else if (prompt?.includes('review')) {
          mockResult = { exitCode: 0, stdout: mockResponses.gemini.code_review, stderr: '' };
        } else {
          mockResult = { exitCode: 0, stdout: 'Analysis complete', stderr: '' };
        }
      } else if (tool === 'codex') {
        if (prompt?.includes('validation') || prompt?.includes('fix')) {
          mockResult = { exitCode: 0, stdout: mockResponses.codex.fix_validation, stderr: '' };
        } else if (prompt?.includes('performance') || prompt?.includes('optimize')) {
          mockResult = { exitCode: 0, stdout: mockResponses.codex.optimize_performance, stderr: '' };
        } else if (prompt?.includes('test')) {
          mockResult = { exitCode: 0, stdout: mockResponses.codex.add_tests, stderr: '' };
        } else {
          mockResult = { exitCode: 0, stdout: 'Code modified successfully', stderr: '' };
        }
      } else {
        mockResult = { exitCode: 0, stdout: 'Execution complete', stderr: '' };
      }

      // Store execution record
      if (!mockExecutionStore.has(loopId)) {
        mockExecutionStore.set(loopId, []);
      }
      mockExecutionStore.get(loopId)!.push({
        loopId,
        stepId,
        tool,
        command: command || prompt || 'N/A',
        ...mockResult,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        data: {
          exitCode: mockResult.exitCode,
          stdout: mockResult.stdout,
          stderr: mockResult.stderr
        }
      };
    });
    return true;
  }

  // POST /api/test/loop/run-full-scenario - Run a complete test scenario
  if (pathname === '/api/test/loop/run-full-scenario' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { scenario } = body as { scenario?: string };

      // Reset mock store
      mockExecutionStore.clear();

      const scenarios: Record<string, any> = {
        'test-fix': {
          description: 'Test-Fix Loop Scenario',
          steps: [
            { stepId: 'run_tests', tool: 'bash', command: 'npm test', expectedToFail: true },
            { stepId: 'analyze_failure', tool: 'gemini', prompt: 'Analyze failure' },
            { stepId: 'apply_fix', tool: 'codex', prompt: 'Apply fix' },
            { stepId: 'run_tests', tool: 'bash', command: 'npm test', expectedToPass: true }
          ]
        },
        'performance-opt': {
          description: 'Performance Optimization Loop Scenario',
          steps: [
            { stepId: 'run_benchmark', tool: 'bash', command: 'npm run benchmark', expectedSlow: true },
            { stepId: 'analyze_bottleneck', tool: 'gemini', prompt: 'Analyze performance' },
            { stepId: 'optimize', tool: 'codex', prompt: 'Optimize code' },
            { stepId: 'run_benchmark', tool: 'bash', command: 'npm run benchmark', expectedFast: true }
          ]
        },
        'doc-review': {
          description: 'Documentation Review Loop Scenario',
          steps: [
            { stepId: 'generate_docs', tool: 'bash', command: 'npm run docs' },
            { stepId: 'review_docs', tool: 'gemini', prompt: 'Review documentation' },
            { stepId: 'fix_docs', tool: 'codex', prompt: 'Fix documentation issues' },
            { stepId: 'final_review', tool: 'gemini', prompt: 'Final review' }
          ]
        }
      };

      const selectedScenario = scenarios[scenario || 'test-fix'];
      if (!selectedScenario) {
        return { success: false, error: 'Invalid scenario. Available: test-fix, performance-opt, doc-review', status: 400 };
      }

      return {
        success: true,
        data: {
          scenario: selectedScenario.description,
          steps: selectedScenario.steps,
          instructions: 'Use POST /api/test/loop/mock/cli/execute for each step'
        }
      };
    });
    return true;
  }

  return false;
}
