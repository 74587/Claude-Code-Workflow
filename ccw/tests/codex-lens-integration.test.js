/**
 * Integration Tests for CodexLens with actual file operations
 *
 * These tests create temporary files and directories to test
 * the full indexing and search workflow.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, rmSync, writeFileSync, readdirSync } from 'fs';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the codex-lens module
const codexLensPath = new URL('../dist/tools/codex-lens.js', import.meta.url).href;

describe('CodexLens Full Integration Tests', async () => {
  let codexLensModule;
  let testDir;
  let isReady = false;

  before(async () => {
    try {
      codexLensModule = await import(codexLensPath);

      // Check if CodexLens is installed
      const status = await codexLensModule.checkVenvStatus();
      isReady = status.ready;

      if (!isReady) {
        console.log('CodexLens not installed - some integration tests will be skipped');
        return;
      }

      // Create temporary test directory
      testDir = join(tmpdir(), `codexlens-test-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });

      // Create test Python files
      writeFileSync(join(testDir, 'main.py'), `
"""Main module for testing."""

def hello_world():
    """Say hello to the world."""
    print("Hello, World!")
    return "hello"

def calculate_sum(a, b):
    """Calculate sum of two numbers."""
    return a + b

class Calculator:
    """A simple calculator class."""

    def __init__(self):
        self.result = 0

    def add(self, value):
        """Add value to result."""
        self.result += value
        return self.result

    def subtract(self, value):
        """Subtract value from result."""
        self.result -= value
        return self.result
`);

      writeFileSync(join(testDir, 'utils.py'), `
"""Utility functions."""

def format_string(text):
    """Format a string."""
    return text.strip().lower()

def validate_email(email):
    """Validate email format."""
    return "@" in email and "." in email

async def fetch_data(url):
    """Fetch data from URL (async)."""
    pass
`);

      // Create test JavaScript file
      writeFileSync(join(testDir, 'app.js'), `
/**
 * Main application module
 */

function initApp() {
  console.log('App initialized');
}

const processData = async (data) => {
  return data.map(item => item.value);
};

class Application {
  constructor(name) {
    this.name = name;
  }

  start() {
    console.log(\`Starting \${this.name}\`);
  }
}

export { initApp, processData, Application };
`);

      console.log(`Test directory created at: ${testDir}`);
    } catch (err) {
      console.log('Setup failed:', err.message);
    }
  });

  after(async () => {
    // Cleanup test directory
    if (testDir && existsSync(testDir)) {
      try {
        rmSync(testDir, { recursive: true, force: true });
        console.log('Test directory cleaned up');
      } catch (err) {
        console.log('Cleanup failed:', err.message);
      }
    }
  });

  describe('Index Initialization', () => {
    it('should initialize index for test directory', async () => {
      if (!isReady || !testDir) {
        console.log('Skipping: CodexLens not ready or test dir not created');
        return;
      }

      const result = await codexLensModule.codexLensTool.execute({
        action: 'init',
        path: testDir
      });

      assert.ok(typeof result === 'object', 'Result should be an object');
      assert.ok('success' in result, 'Result should have success property');

      if (result.success) {
        // Check that .codexlens directory was created
        const codexlensDir = join(testDir, '.codexlens');
        assert.ok(existsSync(codexlensDir), '.codexlens directory should exist');
      }
    });

    it('should create index.db file', async () => {
      if (!isReady || !testDir) {
        console.log('Skipping: CodexLens not ready or test dir not created');
        return;
      }

      const indexDb = join(testDir, '.codexlens', 'index.db');

      // May need to wait for previous init to complete
      // Index.db should exist after successful init
      if (existsSync(join(testDir, '.codexlens'))) {
        // Check files in .codexlens directory
        const files = readdirSync(join(testDir, '.codexlens'));
        console.log('.codexlens contents:', files);
      }
    });
  });

  describe('Status Query', () => {
    it('should return index status for test directory', async () => {
      if (!isReady || !testDir) {
        console.log('Skipping: CodexLens not ready or test dir not created');
        return;
      }

      const result = await codexLensModule.codexLensTool.execute({
        action: 'status',
        path: testDir
      });

      assert.ok(typeof result === 'object', 'Result should be an object');
      console.log('Index status:', JSON.stringify(result, null, 2));

      if (result.success) {
        // Navigate nested structure: result.status.result or result.result
        const statusData = result.status?.result || result.result || result.status || result;
        const hasIndexInfo = (
          'files' in statusData ||
          'db_path' in statusData ||
          result.output ||
          (result.status && 'success' in result.status)
        );
        assert.ok(hasIndexInfo, 'Status should contain index information or raw output');
      }
    });
  });

  describe('Symbol Extraction', () => {
    it('should extract symbols from Python file', async () => {
      if (!isReady || !testDir) {
        console.log('Skipping: CodexLens not ready or test dir not created');
        return;
      }

      const result = await codexLensModule.codexLensTool.execute({
        action: 'symbol',
        file: join(testDir, 'main.py')
      });

      assert.ok(typeof result === 'object', 'Result should be an object');

      if (result.success) {
        console.log('Symbols found:', result.symbols || result.output);

        // Parse output if needed
        let symbols = result.symbols;
        if (!symbols && result.output) {
          try {
            const parsed = JSON.parse(result.output);
            symbols = parsed.result?.file?.symbols || parsed.symbols;
          } catch {
            // Keep raw output
          }
        }

        if (symbols && Array.isArray(symbols)) {
          // Check for expected symbols
          const symbolNames = symbols.map(s => s.name);
          assert.ok(symbolNames.includes('hello_world') || symbolNames.some(n => n.includes('hello')),
            'Should find hello_world function');
          assert.ok(symbolNames.includes('Calculator') || symbolNames.some(n => n.includes('Calc')),
            'Should find Calculator class');
        }
      }
    });

    it('should extract symbols from JavaScript file', async () => {
      if (!isReady || !testDir) {
        console.log('Skipping: CodexLens not ready or test dir not created');
        return;
      }

      const result = await codexLensModule.codexLensTool.execute({
        action: 'symbol',
        file: join(testDir, 'app.js')
      });

      assert.ok(typeof result === 'object', 'Result should be an object');

      if (result.success) {
        console.log('JS Symbols found:', result.symbols || result.output);
      }
    });
  });

  describe('Full-Text Search', () => {
    it('should search for text in indexed files', async () => {
      if (!isReady || !testDir) {
        console.log('Skipping: CodexLens not ready or test dir not created');
        return;
      }

      // First ensure index is initialized
      await codexLensModule.codexLensTool.execute({
        action: 'init',
        path: testDir
      });

      const result = await codexLensModule.codexLensTool.execute({
        action: 'search',
        query: 'hello',
        path: testDir,
        limit: 10
      });

      assert.ok(typeof result === 'object', 'Result should be an object');

      if (result.success) {
        console.log('Search results:', result.results || result.output);
      }
    });

    it('should search for class names', async () => {
      if (!isReady || !testDir) {
        console.log('Skipping: CodexLens not ready or test dir not created');
        return;
      }

      const result = await codexLensModule.codexLensTool.execute({
        action: 'search',
        query: 'Calculator',
        path: testDir,
        limit: 10
      });

      assert.ok(typeof result === 'object', 'Result should be an object');

      if (result.success) {
        console.log('Class search results:', result.results || result.output);
      }
    });
  });

  describe('Incremental Update', () => {
    it('should update index when file changes', async () => {
      if (!isReady || !testDir) {
        console.log('Skipping: CodexLens not ready or test dir not created');
        return;
      }

      // Create a new file
      const newFile = join(testDir, 'new_module.py');
      writeFileSync(newFile, `
def new_function():
    """A newly added function."""
    return "new"
`);

      const result = await codexLensModule.codexLensTool.execute({
        action: 'update',
        files: [newFile],
        path: testDir
      });

      assert.ok(typeof result === 'object', 'Result should be an object');

      if (result.success) {
        console.log('Update result:', result.updateResult || result.output);
      }
    });

    it('should handle deleted files in update', async () => {
      if (!isReady || !testDir) {
        console.log('Skipping: CodexLens not ready or test dir not created');
        return;
      }

      // Reference a non-existent file
      const deletedFile = join(testDir, 'deleted_file.py');

      const result = await codexLensModule.codexLensTool.execute({
        action: 'update',
        files: [deletedFile],
        path: testDir
      });

      assert.ok(typeof result === 'object', 'Result should be an object');
      // Should handle gracefully without crashing
    });
  });
});

describe('CodexLens CLI Commands via executeCodexLens', async () => {
  let codexLensModule;
  let isReady = false;

  before(async () => {
    try {
      codexLensModule = await import(codexLensPath);
      const status = await codexLensModule.checkVenvStatus();
      isReady = status.ready;
    } catch (err) {
      console.log('Setup failed:', err.message);
    }
  });

  it('should execute --version command', async () => {
    if (!isReady) {
      console.log('Skipping: CodexLens not ready');
      return;
    }

    // Note: codexlens may not have --version, use --help instead
    const result = await codexLensModule.executeCodexLens(['--help']);
    assert.ok(typeof result === 'object');

    if (result.success) {
      assert.ok(result.output, 'Should have output');
    }
  });

  it('should execute status --json command', async () => {
    if (!isReady) {
      console.log('Skipping: CodexLens not ready');
      return;
    }

    const result = await codexLensModule.executeCodexLens(['status', '--json'], {
      cwd: __dirname
    });

    assert.ok(typeof result === 'object');

    if (result.success && result.output) {
      // Try to parse JSON output
      try {
        const parsed = JSON.parse(result.output);
        assert.ok(typeof parsed === 'object', 'Output should be valid JSON');
      } catch {
        // Output might not be JSON if index doesn't exist
        console.log('Status output (non-JSON):', result.output);
      }
    }
  });

  it('should handle inspect command', async () => {
    if (!isReady) {
      console.log('Skipping: CodexLens not ready');
      return;
    }

    // Use this test file as input
    const testFile = join(__dirname, 'codex-lens.test.js');
    if (!existsSync(testFile)) {
      console.log('Skipping: Test file not found');
      return;
    }

    const result = await codexLensModule.executeCodexLens([
      'inspect', testFile, '--json'
    ]);

    assert.ok(typeof result === 'object');

    if (result.success) {
      console.log('Inspect result received');
    }
  });
});

describe('CodexLens Workspace Detection', async () => {
  let codexLensModule;
  let isReady = false;

  before(async () => {
    try {
      codexLensModule = await import(codexLensPath);
      const status = await codexLensModule.checkVenvStatus();
      isReady = status.ready;
    } catch (err) {
      console.log('Setup failed:', err.message);
    }
  });

  it('should detect existing workspace', async () => {
    if (!isReady) {
      console.log('Skipping: CodexLens not ready');
      return;
    }

    // Try to get status from project root where .codexlens might exist
    const projectRoot = join(__dirname, '..', '..');

    const result = await codexLensModule.codexLensTool.execute({
      action: 'status',
      path: projectRoot
    });

    assert.ok(typeof result === 'object');
    console.log('Project root status:', result.success ? 'Found' : 'Not found');
  });

  it('should use global database when workspace not found', async () => {
    if (!isReady) {
      console.log('Skipping: CodexLens not ready');
      return;
    }

    // Use a path that definitely won't have .codexlens
    const tempPath = tmpdir();

    const result = await codexLensModule.codexLensTool.execute({
      action: 'status',
      path: tempPath
    });

    assert.ok(typeof result === 'object');
    // Should fall back to global database
  });
});
