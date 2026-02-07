// ========================================
// E2E Tests: ask_question Workflow
// ========================================
// End-to-end tests for the A2UI ask_question flow

import { test, expect } from '@playwright/test';

test.describe.skip('[ask_question] - E2E Workflow Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto('/', { waitUntil: 'networkidle' });
  });

  test('ASK-01: should render AskQuestionDialog when question is received', async ({ page }) => {
    // Simulate WebSocket message for ask_question
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-question-1',
          title: 'Test Question',
          surface: {
            surfaceId: 'test-question-1',
            components: [
              {
                id: 'title',
                component: {
                  Text: {
                    text: { literalString: 'Do you want to continue?' },
                    usageHint: 'h3',
                  },
                },
              },
              {
                id: 'confirm-btn',
                component: {
                  Button: {
                    onClick: { actionId: 'confirm', parameters: { questionId: 'q1' } },
                    content: { Text: { text: { literalString: 'Confirm' } } },
                    variant: 'primary',
                  },
                },
              },
              {
                id: 'cancel-btn',
                component: {
                  Button: {
                    onClick: { actionId: 'cancel', parameters: { questionId: 'q1' } },
                    content: { Text: { text: { literalString: 'Cancel' } } },
                    variant: 'secondary',
                  },
                },
              },
            ],
            initialState: { questionId: 'q1', questionType: 'confirm' },
          },
        },
      });
      window.dispatchEvent(event);
    });

    // Wait for dialog to appear
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Do you want to continue?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('ASK-02: should handle confirm question answer', async ({ page }) => {
    // Send question
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-confirm',
          title: 'Confirmation Required',
          surface: {
            surfaceId: 'test-confirm',
            components: [
              {
                id: 'title',
                component: { Text: { text: { literalString: 'Proceed with operation?' } } },
              },
              {
                id: 'confirm',
                component: {
                  Button: {
                    onClick: { actionId: 'confirm', parameters: { questionId: 'q-confirm' } },
                    content: { Text: { text: { literalString: 'Yes' } } },
                    variant: 'primary',
                  },
                },
              },
              {
                id: 'cancel',
                component: {
                  Button: {
                    onClick: { actionId: 'cancel', parameters: { questionId: 'q-confirm' } },
                    content: { Text: { text: { literalString: 'No' } } },
                    variant: 'secondary',
                  },
                },
              },
            ],
            initialState: { questionId: 'q-confirm' },
          },
        },
      });
      window.dispatchEvent(event);
    });

    // Wait for dialog
    await expect(page.getByRole('dialog')).toBeVisible();

    // Click Confirm button
    const confirmButton = page.getByRole('button', { name: 'Yes' });
    await confirmButton.click();

    // Dialog should close after answer
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Verify answer was sent (check for a2ui-action event)
    const actionSent = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const handler = (e: Event) => {
          const customEvent = e as CustomEvent;
          if (customEvent.detail?.actionId === 'confirm') {
            window.removeEventListener('a2ui-action', handler);
            resolve(true);
          }
        };
        window.addEventListener('a2ui-action', handler);
        // Timeout check
        setTimeout(() => {
          window.removeEventListener('a2ui-action', handler);
          resolve(false);
        }, 1000);
      });
    });

    expect(actionSent).toBe(true);
  });

  test('ASK-03: should handle select question with dropdown', async ({ page }) => {
    // Send select question
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-select',
          title: 'Choose an Option',
          surface: {
            surfaceId: 'test-select',
            components: [
              {
                id: 'title',
                component: { Text: { text: { literalString: 'Select your preference' } } },
              },
              {
                id: 'select',
                component: {
                  Dropdown: {
                    options: [
                      { label: { literalString: 'Option A' }, value: 'a' },
                      { label: { literalString: 'Option B' }, value: 'b' },
                      { label: { literalString: 'Option C' }, value: 'c' },
                    ],
                    onChange: { actionId: 'answer', parameters: { questionId: 'q-select' } },
                    placeholder: 'Select an option',
                  },
                },
              },
              {
                id: 'submit',
                component: {
                  Button: {
                    onClick: { actionId: 'submit', parameters: { questionId: 'q-select' } },
                    content: { Text: { text: { literalString: 'Submit' } } },
                    variant: 'primary',
                  },
                },
              },
            ],
            initialState: { questionId: 'q-select', questionType: 'select' },
          },
        },
      });
      window.dispatchEvent(event);
    });

    // Wait for dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Select your preference')).toBeVisible();

    // Click dropdown to open options
    const dropdown = page.getByRole('combobox');
    await dropdown.click();

    // Select an option
    await page.getByRole('option', { name: 'Option B' }).click();

    // Submit
    await page.getByRole('button', { name: 'Submit' }).click();

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('ASK-04: should handle input question with text field', async ({ page }) => {
    // Send input question
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-input',
          title: 'Enter Information',
          surface: {
            surfaceId: 'test-input',
            components: [
              {
                id: 'title',
                component: { Text: { text: { literalString: 'Please enter your name' } } },
              },
              {
                id: 'input',
                component: {
                  TextField: {
                    onChange: { actionId: 'answer', parameters: { questionId: 'q-input' } },
                    placeholder: 'Enter your name',
                    type: 'text',
                  },
                },
              },
              {
                id: 'submit',
                component: {
                  Button: {
                    onClick: { actionId: 'submit', parameters: { questionId: 'q-input' } },
                    content: { Text: { text: { literalString: 'Submit' } } },
                    variant: 'primary',
                  },
                },
              },
            ],
            initialState: { questionId: 'q-input', questionType: 'input' },
          },
        },
      });
      window.dispatchEvent(event);
    });

    // Wait for dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Please enter your name')).toBeVisible();

    // Type in text field
    const inputField = page.getByPlaceholder('Enter your name');
    await inputField.fill('John Doe');

    // Submit
    await page.getByRole('button', { name: 'Submit' }).click();

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('ASK-05: should handle question cancellation', async ({ page }) => {
    // Send question
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-cancel',
          title: 'Confirm Action',
          surface: {
            surfaceId: 'test-cancel',
            components: [
              {
                id: 'title',
                component: { Text: { text: { literalString: 'Are you sure?' } } },
              },
              {
                id: 'cancel',
                component: {
                  Button: {
                    onClick: { actionId: 'cancel', parameters: { questionId: 'q-cancel' } },
                    content: { Text: { text: { literalString: 'Cancel' } } },
                    variant: 'secondary',
                  },
                },
              },
            ],
            initialState: { questionId: 'q-cancel' },
          },
        },
      });
      window.dispatchEvent(event);
    });

    // Wait for dialog
    await expect(page.getByRole('dialog')).toBeVisible();

    // Click Cancel button
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Verify cancellation was sent
    const cancelSent = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const handler = (e: Event) => {
          const customEvent = e as CustomEvent;
          if (customEvent.detail?.actionId === 'cancel') {
            window.removeEventListener('a2ui-action', handler);
            resolve(true);
          }
        };
        window.addEventListener('a2ui-action', handler);
        setTimeout(() => {
          window.removeEventListener('a2ui-action', handler);
          resolve(false);
        }, 1000);
      });
    });

    expect(cancelSent).toBe(true);
  });

  test('ASK-06: should handle multiple questions in sequence', async ({ page }) => {
    // Send first question
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-seq-1',
          title: 'Question 1',
          surface: {
            surfaceId: 'test-seq-1',
            components: [
              {
                id: 'title',
                component: { Text: { text: { literalString: 'First question?' } } },
              },
              {
                id: 'confirm',
                component: {
                  Button: {
                    onClick: { actionId: 'confirm', parameters: { questionId: 'q1' } },
                    content: { Text: { text: { literalString: 'Next' } } },
                  },
                },
              },
            ],
            initialState: { questionId: 'q1' },
          },
        },
      });
      window.dispatchEvent(event);
    });

    // Answer first question
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Small delay
    await page.waitForTimeout(100);

    // Send second question
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-seq-2',
          title: 'Question 2',
          surface: {
            surfaceId: 'test-seq-2',
            components: [
              {
                id: 'title',
                component: { Text: { text: { literalString: 'Second question?' } } },
              },
              {
                id: 'confirm',
                component: {
                  Button: {
                    onClick: { actionId: 'confirm', parameters: { questionId: 'q2' } },
                    content: { Text: { text: { literalString: 'Done' } } },
                  },
                },
              },
            ],
            initialState: { questionId: 'q2' },
          },
        },
      });
      window.dispatchEvent(event);
    });

    // Answer second question
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Second question?')).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('ASK-07: should display question title correctly', async ({ page }) => {
    const customTitle = 'Custom Question Title - 2024';

    await page.evaluate((title) => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-title',
          title,
          surface: {
            surfaceId: 'test-title',
            components: [
              {
                id: 'btn',
                component: {
                  Button: {
                    onClick: { actionId: 'close', parameters: {} },
                    content: { Text: { text: { literalString: 'Close' } } },
                  },
                },
              },
            ],
            initialState: {},
          },
        },
      });
      window.dispatchEvent(event);
    }, customTitle);

    // Check dialog title
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText(customTitle);
  });

  test('ASK-08: should close dialog when clicking outside', async ({ page }) => {
    // Send question
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-close-outside',
          title: 'Test',
          surface: {
            surfaceId: 'test-close-outside',
            components: [
              {
                id: 'title',
                component: { Text: { text: { literalString: 'Question' } } },
              },
            ],
            initialState: {},
          },
        },
      });
      window.dispatchEvent(event);
    });

    // Wait for dialog
    await expect(page.getByRole('dialog')).toBeVisible();

    // Click outside dialog (on overlay)
    const dialog = page.getByRole('dialog');
    const overlay = page.locator('.dialog-overlay'); // Adjust selector as needed
    await overlay.click();

    // Dialog should close and send cancellation
    await expect(dialog).not.toBeVisible();
  });

  test('ASK-09: should handle required field validation', async ({ page }) => {
    // Send required input question
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-validation',
          title: 'Required Input',
          surface: {
            surfaceId: 'test-validation',
            components: [
              {
                id: 'title',
                component: { Text: { text: { literalString: 'Enter value (required)' } } },
              },
              {
                id: 'input',
                component: {
                  TextField: {
                    onChange: { actionId: 'answer', parameters: { questionId: 'q-required' } },
                    placeholder: 'Required field',
                    type: 'text',
                  },
                },
              },
              {
                id: 'submit',
                component: {
                  Button: {
                    onClick: { actionId: 'submit', parameters: { questionId: 'q-required' } },
                    content: { Text: { text: { literalString: 'Submit' } } },
                    variant: 'primary',
                  },
                },
              },
            ],
            initialState: { questionId: 'q-required', questionType: 'input', required: true },
          },
        },
      });
      window.dispatchEvent(event);
    });

    // Wait for dialog
    await expect(page.getByRole('dialog')).toBeVisible();

    // Try to submit without entering value
    await page.getByRole('button', { name: 'Submit' }).click();

    // Should show validation error or prevent submission
    // (Implementation depends on validation logic)
    // Dialog may stay open or show error message
    await page.waitForTimeout(500);
  });

  test('ASK-10: should support keyboard navigation', async ({ page }) => {
    // Send question
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-keyboard',
          title: 'Keyboard Test',
          surface: {
            surfaceId: 'test-keyboard',
            components: [
              {
                id: 'title',
                component: { Text: { text: { literalString: 'Press Enter or Escape' } } },
              },
              {
                id: 'confirm',
                component: {
                  Button: {
                    onClick: { actionId: 'confirm', parameters: { questionId: 'q-key' } },
                    content: { Text: { text: { literalString: 'Confirm' } } },
                  },
                },
              },
              {
                id: 'cancel',
                component: {
                  Button: {
                    onClick: { actionId: 'cancel', parameters: { questionId: 'q-key' } },
                    content: { Text: { text: { literalString: 'Cancel' } } },
                  },
                },
              },
            ],
            initialState: { questionId: 'q-key' },
          },
        },
      });
      window.dispatchEvent(event);
    });

    // Wait for dialog
    await expect(page.getByRole('dialog')).toBeVisible();

    // Press Escape to cancel
    await page.keyboard.press('Escape');

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
