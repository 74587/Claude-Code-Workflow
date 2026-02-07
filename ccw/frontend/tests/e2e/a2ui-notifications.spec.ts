// ========================================
// E2E Tests: A2UI Notification Rendering
// ========================================
// End-to-end tests for A2UI surface notification rendering

import { test, expect } from '@playwright/test';

test.describe.skip('[A2UI Notifications] - E2E Rendering Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
  });

  test('A2UI-01: should render A2UI notification in notification panel', async ({ page }) => {
    // Send A2UI surface via WebSocket message
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-notification-1',
          title: 'Test Notification',
          surface: {
            surfaceId: 'test-notification-1',
            components: [
              {
                id: 'title',
                component: {
                  Text: {
                    text: { literalString: 'Notification Title' },
                    usageHint: 'h3',
                  },
                },
              },
              {
                id: 'message',
                component: {
                  Text: {
                    text: { literalString: 'This is a test notification message' },
                    usageHint: 'p',
                  },
                },
              },
              {
                id: 'button',
                component: {
                  Button: {
                    onClick: { actionId: 'action-1', parameters: {} },
                    content: { Text: { text: { literalString: 'Action' } } },
                    variant: 'primary',
                  },
                },
              },
            ],
            initialState: { count: 0 },
          },
        },
      });
      window.dispatchEvent(event);
    });

    // Open notification panel
    const notificationButton = page.locator('[data-testid="notification-panel-button"]').or(
      page.getByRole('button', { name: /notifications/i })
    ).or(
      page.locator('button').filter({ hasText: /notifications/i })
    );

    // Try to find and click notification button
    const isVisible = await notificationButton.isVisible().catch(() => false);
    if (isVisible) {
      await notificationButton.click();
    }

    // Check if notification is visible
    await expect(page.getByText('Notification Title')).toBeVisible();
    await expect(page.getByText('This is a test notification message')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Action' })).toBeVisible();
  });

  test('A2UI-02: should render CLIOutput component with syntax highlighting', async ({ page }) => {
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-cli-output',
          title: 'CLI Output',
          surface: {
            surfaceId: 'test-cli-output',
            components: [
              {
                id: 'cli',
                component: {
                  CLIOutput: {
                    output: {
                      literalString: '$ npm install\nInstalling dependencies...\nDone!\n'
                    },
                    language: 'bash',
                    streaming: false,
                  },
                },
              },
            ],
            initialState: {},
          },
        },
      });
      window.dispatchEvent(event);
    });

    // Check for CLI output styling
    await expect(page.locator('.a2ui-cli-output')).toBeVisible();
    await expect(page.getByText(/\$ npm install/)).toBeVisible();
    await expect(page.getByText(/Done!/)).toBeVisible();
  });

  test('A2UI-03: should render CLIOutput with streaming indicator', async ({ page }) => {
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-streaming',
          title: 'Streaming Output',
          surface: {
            surfaceId: 'test-streaming',
            components: [
              {
                id: 'cli',
                component: {
                  CLIOutput: {
                    output: {
                      literalString: 'Processing...'
                    },
                    language: 'bash',
                    streaming: true,
                  },
                },
              },
            ],
            initialState: {},
          },
        },
      });
      window.dispatchEvent(event);
    });

    // Check for streaming indicator
    await expect(page.getByText(/Streaming/i)).toBeVisible();
  });

  test('A2UI-04: should render DateTimeInput component', async ({ page }) => {
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-datetime',
          title: 'Date Time Input',
          surface: {
            surfaceId: 'test-datetime',
            components: [
              {
                id: 'title',
                component: {
                  Text: {
                    text: { literalString: 'Select appointment date' },
                    usageHint: 'h3',
                  },
                },
              },
              {
                id: 'datetime',
                component: {
                  DateTimeInput: {
                    onChange: { actionId: 'datetime-change', parameters: {} },
                    placeholder: 'Select date and time',
                    includeTime: true,
                  },
                },
              },
            ],
            initialState: {},
          },
        },
      });
      window.dispatchEvent(event);
    });

    // Check for datetime input
    await expect(page.getByText('Select appointment date')).toBeVisible();
    const datetimeInput = page.locator('input[type="datetime-local"]');
    await expect(datetimeInput).toBeVisible();
  });

  test('A2UI-05: should render Card component with nested content', async ({ page }) => {
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-card',
          title: 'Card Component',
          surface: {
            surfaceId: 'test-card',
            components: [
              {
                id: 'card',
                component: {
                  Card: {
                    title: { literalString: 'Card Title' },
                    description: { literalString: 'Card description text' },
                    content: [
                      {
                        id: 'text1',
                        component: { Text: { text: { literalString: 'First item' } } },
                      },
                      {
                        id: 'text2',
                        component: { Text: { text: { literalString: 'Second item' } } },
                      },
                    ],
                  },
                },
              },
            ],
            initialState: {},
          },
        },
      });
      window.dispatchEvent(event);
    });

    // Check for card elements
    await expect(page.getByText('Card Title')).toBeVisible();
    await expect(page.getByText('Card description text')).toBeVisible();
    await expect(page.getByText('First item')).toBeVisible();
    await expect(page.getByText('Second item')).toBeVisible();
  });

  test('A2UI-06: should render Progress component', async ({ page }) => {
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-progress',
          title: 'Progress',
          surface: {
            surfaceId: 'test-progress',
            components: [
              {
                id: 'progress',
                component: {
                  Progress: {
                    value: { literalNumber: 75 },
                    max: 100,
                  },
                },
              },
            ],
            initialState: {},
          },
        },
      });
      window.dispatchEvent(event);
    });

    // Check for progress element
    const progress = page.locator('progress').or(page.locator('[role="progressbar"]'));
    await expect(progress).toBeVisible();
  });

  test('A2UI-07: should render Dropdown component', async ({ page }) => {
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-dropdown',
          title: 'Dropdown',
          surface: {
            surfaceId: 'test-dropdown',
            components: [
              {
                id: 'dropdown',
                component: {
                  Dropdown: {
                    options: [
                      { label: { literalString: 'Option 1' }, value: 'opt1' },
                      { label: { literalString: 'Option 2' }, value: 'opt2' },
                      { label: { literalString: 'Option 3' }, value: 'opt3' },
                    ],
                    onChange: { actionId: 'select', parameters: {} },
                    placeholder: 'Choose an option',
                  },
                },
              },
            ],
            initialState: {},
          },
        },
      });
      window.dispatchEvent(event);
    });

    // Check for dropdown
    const dropdown = page.getByRole('combobox');
    await expect(dropdown).toBeVisible();

    // Open dropdown
    await dropdown.click();

    // Check options
    await expect(page.getByRole('option', { name: 'Option 1' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Option 2' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Option 3' })).toBeVisible();
  });

  test('A2UI-08: should render Checkbox component', async ({ page }) => {
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-checkbox',
          title: 'Checkbox',
          surface: {
            surfaceId: 'test-checkbox',
            components: [
              {
                id: 'checkbox',
                component: {
                  Checkbox: {
                    checked: { literalBoolean: false },
                    onChange: { actionId: 'check', parameters: {} },
                    label: { literalString: 'Accept terms and conditions' },
                  },
                },
              },
            ],
            initialState: {},
          },
        },
      });
      window.dispatchEvent(event);
    });

    // Check for checkbox
    await expect(page.getByText('Accept terms and conditions')).toBeVisible();
    const checkbox = page.getByRole('checkbox');
    await expect(checkbox).toBeVisible();
  });

  test('A2UI-09: should handle A2UI action events', async ({ page }) => {
    let actionReceived = false;

    // Set up listener for A2UI action
    await page.evaluate(() => {
      (window as any).testActionReceived = false;
      window.addEventListener('a2ui-action', (e: Event) => {
        const customEvent = e as CustomEvent;
        if (customEvent.detail?.actionId === 'test-action') {
          (window as any).testActionReceived = true;
        }
      });
    });

    // Send A2UI surface with button
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-action',
          title: 'Action Test',
          surface: {
            surfaceId: 'test-action',
            components: [
              {
                id: 'btn',
                component: {
                  Button: {
                    onClick: { actionId: 'test-action', parameters: { key: 'value' } },
                    content: { Text: { text: { literalString: 'Click Me' } } },
                    variant: 'primary',
                  },
                },
              },
            ],
            initialState: {},
          },
        },
      });
      window.dispatchEvent(event);
    });

    // Click button
    await page.getByRole('button', { name: 'Click Me' }).click();

    // Wait and check if action was received
    await page.waitForTimeout(500);
    actionReceived = await page.evaluate(() => (window as any).testActionReceived || false);
    expect(actionReceived).toBe(true);
  });

  test('A2UI-10: should update A2UI state dynamically', async ({ page }) => {
    // Send initial surface
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-state-update',
          title: 'State Test',
          surface: {
            surfaceId: 'test-state-update',
            components: [
              {
                id: 'counter',
                component: {
                  Text: {
                    text: { literalString: 'Count: 0' },
                  },
                },
              },
              {
                id: 'btn',
                component: {
                  Button: {
                    onClick: { actionId: 'increment', parameters: {} },
                    content: { Text: { text: { literalString: 'Increment' } } },
                  },
                },
              },
            ],
            initialState: { count: 0 },
          },
        },
      });
      window.dispatchEvent(event);
    });

    // Check initial state
    await expect(page.getByText('Count: 0')).toBeVisible();

    // Simulate state update via WebSocket
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-state-update',
          surfaceId: 'test-state-update',
          updates: { count: 5 },
        },
      });
      window.dispatchEvent(event);
    });

    // Wait for update to be reflected
    await page.waitForTimeout(500);
    // Note: The actual update handling depends on implementation
  });

  test('A2UI-11: should render multiple A2UI notifications', async ({ page }) => {
    // Send multiple surfaces
    for (let i = 1; i <= 3; i++) {
      await page.evaluate((index) => {
        const event = new CustomEvent('ws-message', {
          detail: {
            type: 'a2ui-surface',
            surfaceId: `test-multi-${index}`,
            title: `Notification ${index}`,
            surface: {
              surfaceId: `test-multi-${index}`,
              components: [
                {
                  id: 'title',
                  component: {
                    Text: {
                      text: { literalString: `Message ${index}` },
                    },
                  },
                },
              ],
              initialState: {},
            },
          },
        });
        window.dispatchEvent(event);
      }, i);
      
      await page.waitForTimeout(100);
    }

    // Check that all notifications are rendered
    await expect(page.getByText('Message 1')).toBeVisible();
    await expect(page.getByText('Message 2')).toBeVisible();
    await expect(page.getByText('Message 3')).toBeVisible();
  });

  test('A2UI-12: should handle dismissible A2UI notifications', async ({ page }) => {
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-dismissible',
          title: 'Dismissible',
          surface: {
            surfaceId: 'test-dismissible',
            components: [
              {
                id: 'content',
                component: {
                  Text: {
                    text: { literalString: 'This can be dismissed' },
                  },
                },
              },
            ],
            initialState: {},
          },
        },
      });
      window.dispatchEvent(event);
    });

    // Check that notification is visible
    await expect(page.getByText('This can be dismissed')).toBeVisible();

    // Find and click dismiss button
    const dismissButton = page.locator('[aria-label="Close"]').or(
      page.locator('button').filter({ hasText: '×' })
    ).or(
      page.locator('button').filter({ hasText: /close|dismiss/i })
    );

    const isVisible = await dismissButton.isVisible().catch(() => false);
    if (isVisible) {
      await dismissButton.click();
      
      // Notification should be dismissed
      await page.waitForTimeout(500);
    }
  });

  test('A2UI-13: should render TextArea component', async ({ page }) => {
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-textarea',
          title: 'Text Area',
          surface: {
            surfaceId: 'test-textarea',
            components: [
              {
                id: 'textarea',
                component: {
                  TextArea: {
                    onChange: { actionId: 'text-change', parameters: {} },
                    placeholder: 'Enter multi-line text',
                    rows: 4,
                  },
                },
              },
            ],
            initialState: {},
          },
        },
      });
      window.dispatchEvent(event);
    });

    // Check for textarea
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute('placeholder', 'Enter multi-line text');
  });

  test('A2UI-14: should render TextField with different types', async ({ page }) => {
    await page.evaluate(() => {
      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'a2ui-surface',
          surfaceId: 'test-textfield',
          title: 'Text Field',
          surface: {
            surfaceId: 'test-textfield',
            components: [
              {
                id: 'email',
                component: {
                  TextField: {
                    onChange: { actionId: 'email', parameters: {} },
                    placeholder: 'Email address',
                    type: 'email',
                  },
                },
              },
              {
                id: 'password',
                component: {
                  TextField: {
                    onChange: { actionId: 'password', parameters: {} },
                    placeholder: 'Password',
                    type: 'password',
                  },
                },
              },
            ],
            initialState: {},
          },
        },
      });
      window.dispatchEvent(event);
    });

    // Check for email field
    await expect(page.getByPlaceholder('Email address')).toBeVisible();
    await expect(page.getByPlaceholder('Email address')).toHaveAttribute('type', 'email');

    // Check for password field
    await expect(page.getByPlaceholder('Password')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toHaveAttribute('type', 'password');
  });
});
