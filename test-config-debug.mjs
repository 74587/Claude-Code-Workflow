import { getToolConfig, loadClaudeCliTools } from './ccw/dist/tools/claude-cli-tools.js';

const workingDir = 'D:\\Claude_dms3';
const tool = 'claude';

console.log('=== Step 1: Load full config ===');
const fullConfig = loadClaudeCliTools(workingDir);
console.log('Full config:', JSON.stringify(fullConfig, null, 2));

console.log('\n=== Step 2: Get claude tool from config ===');
const claudeTool = fullConfig.tools.claude;
console.log('Claude tool raw:', JSON.stringify(claudeTool, null, 2));

console.log('\n=== Step 3: Get tool config via getToolConfig ===');
const config = getToolConfig(workingDir, tool);
console.log('Claude tool config:', JSON.stringify(config, null, 2));
