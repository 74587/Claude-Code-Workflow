import { rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  // Delete ccw-vscode-bridge directory
  const bridgeDir = join(__dirname, 'ccw-vscode-bridge');
  console.log('Deleting:', bridgeDir);
  rmSync(bridgeDir, { recursive: true, force: true });
  console.log('✓ Deleted ccw-vscode-bridge directory');

  // Delete vscode-lsp.ts file
  const vscodeLspFile = join(__dirname, 'ccw', 'src', 'tools', 'vscode-lsp.ts');
  console.log('Deleting:', vscodeLspFile);
  rmSync(vscodeLspFile, { force: true });
  console.log('✓ Deleted vscode-lsp.ts file');

  console.log('\nCleanup complete!');
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
