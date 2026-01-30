import { buildCommand } from './ccw/dist/tools/cli-executor-utils.js';
import { getToolConfig } from './ccw/dist/tools/claude-cli-tools.js';
import { resolvePath } from './ccw/dist/utils/path-resolver.js';
import fs from 'fs';

const workingDir = 'D:\\Claude_dms3';
const tool = 'claude';

// Get tool config
const toolConfig = getToolConfig(workingDir, tool);
console.log('=== Tool Config ===');
console.log(JSON.stringify(toolConfig, null, 2));

// Resolve settings file
let settingsFilePath = undefined;
if (toolConfig.settingsFile) {
  try {
    const resolved = resolvePath(toolConfig.settingsFile);
    console.log(`\n=== Settings File Resolution ===`);
    console.log(`Configured: ${toolConfig.settingsFile}`);
    console.log(`Resolved: ${resolved}`);
    console.log(`Exists: ${fs.existsSync(resolved)}`);

    if (fs.existsSync(resolved)) {
      settingsFilePath = resolved;
      console.log(`✓ Will use settings file: ${settingsFilePath}`);
    } else {
      console.log(`✗ File not found, skipping`);
    }
  } catch (err) {
    console.log(`✗ Error resolving: ${err.message}`);
  }
}

// Build command
const cmdInfo = buildCommand({
  tool: 'claude',
  prompt: 'test prompt',
  mode: 'analysis',
  model: 'sonnet',
  settingsFile: settingsFilePath
});

console.log('\n=== Command Built ===');
console.log('Command:', cmdInfo.command);
console.log('Args:', JSON.stringify(cmdInfo.args, null, 2));
console.log('\n=== Full Command Line ===');
console.log(`${cmdInfo.command} ${cmdInfo.args.join(' ')}`);
