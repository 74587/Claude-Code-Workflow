---
prefix: TEST
inner_loop: false
message_types:
  success: test_complete
  error: error
  fix: fix_required
---

# Test Engineer

Generate and run tests to verify fixes (loading states, error handling, state updates).

## Phase 2: Environment Detection

1. Detect test framework from project files:

| Signal | Framework |
|--------|-----------|
| package.json has "jest" | Jest |
| package.json has "vitest" | Vitest |
| package.json has "@testing-library/react" | React Testing Library |
| package.json has "@vue/test-utils" | Vue Test Utils |

2. Get changed files from implementer state:
   ```
   team_msg(operation="get_state", session_id=<session-id>, role="implementer")
   ```

3. Load test strategy from design guide

## Phase 3: Test Generation & Execution

### Test Generation

For each modified file, generate test cases:

**React Example**:
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Upload from '../Upload';

describe('Upload Component', () => {
  it('shows loading state during upload', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true }));

    render(<Upload />);
    const uploadButton = screen.getByRole('button', { name: /upload/i });

    fireEvent.click(uploadButton);

    // Check loading state
    await waitFor(() => {
      expect(screen.getByText(/uploading.../i)).toBeInTheDocument();
      expect(uploadButton).toBeDisabled();
    });

    // Check normal state restored
    await waitFor(() => {
      expect(uploadButton).not.toBeDisabled();
    });
  });

  it('displays error message on failure', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Upload failed')));

    render(<Upload />);
    fireEvent.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
    });
  });
});
```

### Test Execution

Iterative test-fix cycle (max 5 iterations):

1. Run tests: `npm test` or `npm run test:unit`
2. Parse results -> calculate pass rate
3. If pass rate >= 95% -> exit (success)
4. If pass rate < 95% and iterations < 5:
   - Analyze failures
   - Use CLI to generate fixes:
     ```
     Bash(`ccw cli -p "PURPOSE: Fix test failures
     CONTEXT: @<test-file> @<source-file>
     EXPECTED: Fixed code that passes tests
     CONSTRAINTS: Maintain existing functionality" --tool gemini --mode write`)
     ```
   - Increment iteration counter
   - Loop to step 1
5. If iterations >= 5 -> send fix_required message

## Phase 4: Test Report

Generate test report:

```markdown
# Test Report

## Summary
- Total tests: <count>
- Passed: <count>
- Failed: <count>
- Pass rate: <percentage>%
- Fix iterations: <count>

## Test Results

### Passed Tests
- ✅ Upload Component > shows loading state during upload
- ✅ Upload Component > displays error message on failure

### Failed Tests
- ❌ Form Component > validates input before submit
  - Error: Expected validation message not found

## Coverage
- Statements: 85%
- Branches: 78%
- Functions: 90%
- Lines: 84%

## Remaining Issues
- Form validation test failing (needs manual review)
```

Write report to `<session>/artifacts/test-report.md`

Share state via team_msg:
```
team_msg(operation="log", session_id=<session-id>, from="tester",
         type="state_update", data={
           total_tests: <count>,
           passed: <count>,
           failed: <count>,
           pass_rate: <percentage>,
           fix_iterations: <count>
         })
```

If pass rate < 95%, send fix_required message:
```
SendMessage({
  recipient: "coordinator",
  type: "message",
  content: "[tester] Test validation incomplete. Pass rate: <percentage>%. Manual review needed."
})
```
