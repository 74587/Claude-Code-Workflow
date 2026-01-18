/**
 * CLI Prompt Parsing Tests
 *
 * Tests different prompt formats and verifies the final prompt passed to CLI executor.
 * Covers: single-line, multi-line, @ symbols, special characters, template concatenation.
 */

import { after, afterEach, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TEST_CCW_HOME = mkdtempSync(join(tmpdir(), 'ccw-prompt-parse-'));
process.env.CCW_DATA_DIR = TEST_CCW_HOME;

const cliCommandPath = new URL('../dist/commands/cli.js', import.meta.url).href;
const cliExecutorPath = new URL('../dist/tools/cli-executor.js', import.meta.url).href;
const historyStorePath = new URL('../dist/tools/cli-history-store.js', import.meta.url).href;

function stubHttpRequest(): void {
  mock.method(http, 'request', () => {
    const req = {
      on(event: string, handler: (arg?: any) => void) {
        if (event === 'socket') handler({ unref() {} });
        return req;
      },
      write() {},
      end() {},
      destroy() {},
    };
    return req as any;
  });
}

function createMockExecutor(calls: any[]) {
  return async (params: any) => {
    calls.push({
      prompt: params.prompt,
      tool: params.tool,
      mode: params.mode,
      model: params.model,
      promptLength: params.prompt?.length,
      hasNewlines: params.prompt?.includes('\n'),
      lineCount: params.prompt?.split('\n').length,
    });
    return {
      success: true,
      stdout: 'ok',
      stderr: '',
      execution: { id: 'EXEC-TEST', duration_ms: 1, status: 'success' },
      conversation: { turn_count: 1, total_duration_ms: 1 },
    };
  };
}

describe('CLI Prompt Parsing', async () => {
  let cliModule: any;
  let cliExecutorModule: any;
  let historyStoreModule: any;

  before(async () => {
    cliModule = await import(cliCommandPath);
    cliExecutorModule = await import(cliExecutorPath);
    historyStoreModule = await import(historyStorePath);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  after(() => {
    try {
      historyStoreModule?.closeAllStores?.();
    } catch { /* ignore */ }
    rmSync(TEST_CCW_HOME, { recursive: true, force: true });
  });

  describe('Single-line prompts', () => {
    it('passes simple single-line prompt via -p option', async () => {
      stubHttpRequest();
      mock.method(console, 'log', () => {});
      mock.method(console, 'error', () => {});
      mock.method(process as any, 'exit', () => {});

      const calls: any[] = [];
      mock.method(cliExecutorModule.cliExecutorTool, 'execute', createMockExecutor(calls));

      await cliModule.cliCommand('exec', [], {
        prompt: 'Simple single line prompt',
        tool: 'gemini',
      });
      await new Promise(r => setTimeout(r, 100));

      assert.equal(calls.length, 1);
      // Prompt contains original + template rules
      assert.ok(calls[0].prompt.includes('Simple single line prompt'));
      assert.equal(calls[0].hasNewlines, true); // Templates add newlines
      console.log('\n📝 Single-line prompt final length:', calls[0].promptLength);
    });

    it('passes prompt with quotes', async () => {
      stubHttpRequest();
      mock.method(console, 'log', () => {});
      mock.method(console, 'error', () => {});
      mock.method(process as any, 'exit', () => {});

      const calls: any[] = [];
      mock.method(cliExecutorModule.cliExecutorTool, 'execute', createMockExecutor(calls));

      await cliModule.cliCommand('exec', [], {
        prompt: 'Say "Hello World" to me',
        tool: 'gemini',
      });
      await new Promise(r => setTimeout(r, 100));

      assert.equal(calls.length, 1);
      assert.ok(calls[0].prompt.includes('Say "Hello World" to me'));
      console.log('\n📝 Quoted prompt preserved:', calls[0].prompt.substring(0, 100));
    });
  });

  describe('Multi-line prompts', () => {
    it('passes multi-line prompt via -p option', async () => {
      stubHttpRequest();
      mock.method(console, 'log', () => {});
      mock.method(console, 'error', () => {});
      mock.method(process as any, 'exit', () => {});

      const calls: any[] = [];
      mock.method(cliExecutorModule.cliExecutorTool, 'execute', createMockExecutor(calls));

      const multiLinePrompt = `PURPOSE: Test multi-line prompt
TASK: • Step 1 • Step 2 • Step 3
MODE: analysis
CONTEXT: @src/**/*
EXPECTED: Test output`;

      await cliModule.cliCommand('exec', [], {
        prompt: multiLinePrompt,
        tool: 'gemini',
      });
      await new Promise(r => setTimeout(r, 100));

      assert.equal(calls.length, 1);
      assert.ok(calls[0].prompt.includes('PURPOSE: Test multi-line prompt'));
      assert.ok(calls[0].prompt.includes('TASK: • Step 1 • Step 2 • Step 3'));
      assert.ok(calls[0].prompt.includes('CONTEXT: @src/**/*'));
      console.log('\n📝 Multi-line prompt lines:', calls[0].lineCount);
    });

    it('reads multi-line prompt from file via -f option', async () => {
      stubHttpRequest();
      mock.method(console, 'log', () => {});
      mock.method(console, 'error', () => {});
      mock.method(process as any, 'exit', () => {});

      const calls: any[] = [];
      mock.method(cliExecutorModule.cliExecutorTool, 'execute', createMockExecutor(calls));

      // Create temp prompt file
      const promptFile = join(TEST_CCW_HOME, 'test-prompt.txt');
      const fileContent = `PURPOSE: File-based prompt test
TASK: • Read from file
MODE: analysis
CONTEXT: @**/*.ts | Memory: test context
EXPECTED: Success`;
      writeFileSync(promptFile, fileContent);

      await cliModule.cliCommand('exec', [], {
        file: promptFile,
        tool: 'gemini',
      });
      await new Promise(r => setTimeout(r, 100));

      assert.equal(calls.length, 1);
      assert.ok(calls[0].prompt.includes('PURPOSE: File-based prompt test'));
      assert.ok(calls[0].prompt.includes('Memory: test context'));
      console.log('\n📝 File prompt loaded, lines:', calls[0].lineCount);
    });
  });

  describe('@ symbol patterns', () => {
    it('preserves @ patterns in CONTEXT field', async () => {
      stubHttpRequest();
      mock.method(console, 'log', () => {});
      mock.method(console, 'error', () => {});
      mock.method(process as any, 'exit', () => {});

      const calls: any[] = [];
      mock.method(cliExecutorModule.cliExecutorTool, 'execute', createMockExecutor(calls));

      const promptWithPatterns = `PURPOSE: Test @ patterns
CONTEXT: @src/auth/**/*.ts @src/middleware/*.ts @shared/utils/security.ts
EXPECTED: Pattern preservation`;

      await cliModule.cliCommand('exec', [], {
        prompt: promptWithPatterns,
        tool: 'gemini',
      });
      await new Promise(r => setTimeout(r, 100));

      assert.equal(calls.length, 1);
      assert.ok(calls[0].prompt.includes('@src/auth/**/*.ts'));
      assert.ok(calls[0].prompt.includes('@src/middleware/*.ts'));
      assert.ok(calls[0].prompt.includes('@shared/utils/security.ts'));
      console.log('\n📝 @ patterns preserved in final prompt');
    });

    it('preserves @ patterns with glob wildcards', async () => {
      stubHttpRequest();
      mock.method(console, 'log', () => {});
      mock.method(console, 'error', () => {});
      mock.method(process as any, 'exit', () => {});

      const calls: any[] = [];
      mock.method(cliExecutorModule.cliExecutorTool, 'execute', createMockExecutor(calls));

      await cliModule.cliCommand('exec', [], {
        prompt: 'CONTEXT: @**/*.{ts,tsx} @!node_modules/** @!dist/**',
        tool: 'gemini',
      });
      await new Promise(r => setTimeout(r, 100));

      assert.equal(calls.length, 1);
      assert.ok(calls[0].prompt.includes('@**/*.{ts,tsx}'));
      assert.ok(calls[0].prompt.includes('@!node_modules/**'));
      console.log('\n📝 Complex glob patterns preserved');
    });

    it('preserves @ patterns with Memory section', async () => {
      stubHttpRequest();
      mock.method(console, 'log', () => {});
      mock.method(console, 'error', () => {});
      mock.method(process as any, 'exit', () => {});

      const calls: any[] = [];
      mock.method(cliExecutorModule.cliExecutorTool, 'execute', createMockExecutor(calls));

      await cliModule.cliCommand('exec', [], {
        prompt: 'CONTEXT: @src/**/* | Memory: Using bcrypt for passwords, JWT for sessions',
        tool: 'gemini',
      });
      await new Promise(r => setTimeout(r, 100));

      assert.equal(calls.length, 1);
      assert.ok(calls[0].prompt.includes('@src/**/*'));
      assert.ok(calls[0].prompt.includes('Memory: Using bcrypt for passwords'));
      console.log('\n📝 @ pattern + Memory preserved');
    });
  });

  describe('Special characters', () => {
    it('preserves bullet points and special characters', async () => {
      stubHttpRequest();
      mock.method(console, 'log', () => {});
      mock.method(console, 'error', () => {});
      mock.method(process as any, 'exit', () => {});

      const calls: any[] = [];
      mock.method(cliExecutorModule.cliExecutorTool, 'execute', createMockExecutor(calls));

      await cliModule.cliCommand('exec', [], {
        prompt: 'TASK: • First item • Second item • Third item ✓ ✗',
        tool: 'gemini',
      });
      await new Promise(r => setTimeout(r, 100));

      assert.equal(calls.length, 1);
      assert.ok(calls[0].prompt.includes('• First item'));
      assert.ok(calls[0].prompt.includes('✓'));
      console.log('\n📝 Special characters preserved');
    });

    it('preserves code-like content', async () => {
      stubHttpRequest();
      mock.method(console, 'log', () => {});
      mock.method(console, 'error', () => {});
      mock.method(process as any, 'exit', () => {});

      const calls: any[] = [];
      mock.method(cliExecutorModule.cliExecutorTool, 'execute', createMockExecutor(calls));

      await cliModule.cliCommand('exec', [], {
        prompt: 'Fix: const x = arr.filter(i => i > 0).map(i => i * 2);',
        tool: 'gemini',
      });
      await new Promise(r => setTimeout(r, 100));

      assert.equal(calls.length, 1);
      assert.ok(calls[0].prompt.includes('const x = arr.filter'));
      assert.ok(calls[0].prompt.includes('=>'));
      console.log('\n📝 Code-like content preserved');
    });

    it('preserves shell-like patterns', async () => {
      stubHttpRequest();
      mock.method(console, 'log', () => {});
      mock.method(console, 'error', () => {});
      mock.method(process as any, 'exit', () => {});

      const calls: any[] = [];
      mock.method(cliExecutorModule.cliExecutorTool, 'execute', createMockExecutor(calls));

      await cliModule.cliCommand('exec', [], {
        prompt: 'Run: npm run build && npm test | grep "passed"',
        tool: 'gemini',
      });
      await new Promise(r => setTimeout(r, 100));

      assert.equal(calls.length, 1);
      assert.ok(calls[0].prompt.includes('npm run build && npm test'));
      assert.ok(calls[0].prompt.includes('| grep'));
      console.log('\n📝 Shell-like patterns preserved');
    });
  });

  describe('Template concatenation', () => {
    it('concatenates system rules and roles to prompt', async () => {
      stubHttpRequest();
      mock.method(console, 'log', () => {});
      mock.method(console, 'error', () => {});
      mock.method(process as any, 'exit', () => {});

      const calls: any[] = [];
      mock.method(cliExecutorModule.cliExecutorTool, 'execute', createMockExecutor(calls));

      await cliModule.cliCommand('exec', [], {
        prompt: 'Test prompt',
        tool: 'gemini',
        rule: 'universal-rigorous-style',
      });
      await new Promise(r => setTimeout(r, 100));

      assert.equal(calls.length, 1);
      // Should have SYSTEM RULES and ROLES sections
      assert.ok(calls[0].prompt.includes('Test prompt'));
      assert.ok(calls[0].prompt.includes('=== SYSTEM RULES ===') || calls[0].promptLength > 100);
      console.log('\n📝 Template concatenated, total length:', calls[0].promptLength);
    });

    it('preserves user prompt structure with templates', async () => {
      stubHttpRequest();
      mock.method(console, 'log', () => {});
      mock.method(console, 'error', () => {});
      mock.method(process as any, 'exit', () => {});

      const calls: any[] = [];
      mock.method(cliExecutorModule.cliExecutorTool, 'execute', createMockExecutor(calls));

      const structuredPrompt = `PURPOSE: Security audit
TASK: • Scan injection flaws • Check auth bypass
MODE: analysis
CONTEXT: @src/auth/**/*
EXPECTED: Security report
CONSTRAINTS: Focus on auth`;

      await cliModule.cliCommand('exec', [], {
        prompt: structuredPrompt,
        tool: 'gemini',
        mode: 'analysis',
      });
      await new Promise(r => setTimeout(r, 100));

      assert.equal(calls.length, 1);
      // User prompt should come first
      const promptStart = calls[0].prompt.indexOf('PURPOSE: Security audit');
      const rulesStart = calls[0].prompt.indexOf('=== SYSTEM RULES ===');
      if (rulesStart > 0) {
        assert.ok(promptStart < rulesStart, 'User prompt should precede system rules');
      }
      console.log('\n📝 User prompt preserved at start');
    });
  });

  describe('Edge cases', () => {
    it('handles empty lines in prompt', async () => {
      stubHttpRequest();
      mock.method(console, 'log', () => {});
      mock.method(console, 'error', () => {});
      mock.method(process as any, 'exit', () => {});

      const calls: any[] = [];
      mock.method(cliExecutorModule.cliExecutorTool, 'execute', createMockExecutor(calls));

      await cliModule.cliCommand('exec', [], {
        prompt: 'Line 1\n\nLine 3\n\n\nLine 6',
        tool: 'gemini',
      });
      await new Promise(r => setTimeout(r, 100));

      assert.equal(calls.length, 1);
      assert.ok(calls[0].prompt.includes('Line 1'));
      assert.ok(calls[0].prompt.includes('Line 3'));
      assert.ok(calls[0].prompt.includes('Line 6'));
      console.log('\n📝 Empty lines handled');
    });

    it('handles very long single-line prompt', async () => {
      stubHttpRequest();
      mock.method(console, 'log', () => {});
      mock.method(console, 'error', () => {});
      mock.method(process as any, 'exit', () => {});

      const calls: any[] = [];
      mock.method(cliExecutorModule.cliExecutorTool, 'execute', createMockExecutor(calls));

      const longPrompt = 'A'.repeat(10000);
      await cliModule.cliCommand('exec', [], {
        prompt: longPrompt,
        tool: 'gemini',
      });
      await new Promise(r => setTimeout(r, 100));

      assert.equal(calls.length, 1);
      assert.ok(calls[0].prompt.includes('A'.repeat(100)));
      console.log('\n📝 Long prompt handled, length:', calls[0].promptLength);
    });

    it('handles Unicode characters', async () => {
      stubHttpRequest();
      mock.method(console, 'log', () => {});
      mock.method(console, 'error', () => {});
      mock.method(process as any, 'exit', () => {});

      const calls: any[] = [];
      mock.method(cliExecutorModule.cliExecutorTool, 'execute', createMockExecutor(calls));

      await cliModule.cliCommand('exec', [], {
        prompt: '中文测试 日本語テスト 한국어테스트 🚀🔥💡',
        tool: 'gemini',
      });
      await new Promise(r => setTimeout(r, 100));

      assert.equal(calls.length, 1);
      assert.ok(calls[0].prompt.includes('中文测试'));
      assert.ok(calls[0].prompt.includes('日本語テスト'));
      assert.ok(calls[0].prompt.includes('🚀'));
      console.log('\n📝 Unicode preserved');
    });
  });

  describe('Full template prompt', () => {
    it('preserves complete CLI tools usage template format', async () => {
      stubHttpRequest();
      mock.method(console, 'log', () => {});
      mock.method(console, 'error', () => {});
      mock.method(process as any, 'exit', () => {});

      const calls: any[] = [];
      mock.method(cliExecutorModule.cliExecutorTool, 'execute', createMockExecutor(calls));

      const fullTemplate = `PURPOSE: Identify OWASP Top 10 vulnerabilities in authentication module to pass security audit; success = all critical/high issues documented with remediation
TASK: • Scan for injection flaws (SQL, command, LDAP) • Check authentication bypass vectors • Evaluate session management • Assess sensitive data exposure
MODE: analysis
CONTEXT: @src/auth/**/* @src/middleware/auth.ts | Memory: Using bcrypt for passwords, JWT for sessions
EXPECTED: Security report with: severity matrix, file:line references, CVE mappings where applicable, remediation code snippets prioritized by risk
CONSTRAINTS: Focus on authentication | Ignore test files`;

      await cliModule.cliCommand('exec', [], {
        prompt: fullTemplate,
        tool: 'gemini',
        mode: 'analysis',
      });
      await new Promise(r => setTimeout(r, 100));

      assert.equal(calls.length, 1);
      // Verify all sections preserved
      assert.ok(calls[0].prompt.includes('PURPOSE:'));
      assert.ok(calls[0].prompt.includes('TASK:'));
      assert.ok(calls[0].prompt.includes('MODE:'));
      assert.ok(calls[0].prompt.includes('CONTEXT:'));
      assert.ok(calls[0].prompt.includes('EXPECTED:'));
      assert.ok(calls[0].prompt.includes('CONSTRAINTS:'));
      // Verify specific content
      assert.ok(calls[0].prompt.includes('OWASP Top 10'));
      assert.ok(calls[0].prompt.includes('@src/auth/**/*'));
      assert.ok(calls[0].prompt.includes('Memory: Using bcrypt'));
      assert.ok(calls[0].prompt.includes('severity matrix'));

      console.log('\n📝 Full template format preserved');
      console.log('   Final prompt length:', calls[0].promptLength);
      console.log('   Line count:', calls[0].lineCount);
    });
  });
});

describe('Prompt Output Visualization', () => {
  let cliModule: any;
  let cliExecutorModule: any;

  before(async () => {
    cliModule = await import(cliCommandPath);
    cliExecutorModule = await import(cliExecutorPath);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('demonstrates final prompt structure (visual output)', async () => {
    stubHttpRequest();
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
    mock.method(process as any, 'exit', () => {});

    const capturedPrompts: string[] = [];
    mock.method(cliExecutorModule.cliExecutorTool, 'execute', async (params: any) => {
      capturedPrompts.push(params.prompt);
      return {
        success: true,
        stdout: 'ok',
        stderr: '',
        execution: { id: 'EXEC-VIS', duration_ms: 1, status: 'success' },
        conversation: { turn_count: 1, total_duration_ms: 1 },
      };
    });

    await cliModule.cliCommand('exec', [], {
      prompt: 'Test visualization prompt',
      tool: 'gemini',
    });
    await new Promise(r => setTimeout(r, 100));

    // Output visualization
    console.log('\n' + '='.repeat(60));
    console.log('📋 FINAL PROMPT PASSED TO CLI:');
    console.log('='.repeat(60));
    if (capturedPrompts[0]) {
      const preview = capturedPrompts[0].substring(0, 500);
      console.log(preview);
      if (capturedPrompts[0].length > 500) {
        console.log(`\n... [${capturedPrompts[0].length - 500} more characters]`);
      }
    }
    console.log('='.repeat(60));
  });
});
